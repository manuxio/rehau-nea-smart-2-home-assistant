import mqtt, { MqttClient, IClientOptions, IClientPublishOptions } from 'mqtt';
import LZString from 'lz-string';
import logger, { debugDump, redactSensitiveData, registerObfuscation } from './logger';
import RehauAuthPersistent from './rehau-auth';
import { MQTTConfig, RehauMQTTMessage, ReferentialEntry, ReferentialsMap, HACommand } from './types';

type MessageHandler = (topicOrCommand: string | HACommand, payload?: RehauMQTTMessage) => void;

class RehauMQTTBridge {
  private rehauAuth: RehauAuthPersistent;
  private mqttConfig: MQTTConfig;
  private rehauClient: MqttClient | null = null;
  private haClient: MqttClient | null = null;
  private connected: boolean = false;
  private messageHandlers: MessageHandler[] = [];
  private referentials: ReferentialsMap | null = null;
  private referentialsTimer: NodeJS.Timeout | null = null;
  private liveDataTimer: NodeJS.Timeout | null = null;
  private rehauSubscriptions: Set<string> = new Set();
  private haSubscriptions: Set<string> = new Set();
  private installations: string[] = [];
  private channelToZoneName: Map<string, string> = new Map(); // channelId -> zoneName
  private channelToGroupName: Map<string, string> = new Map(); // channelId -> groupName
  private isReconnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private referentialsHandlerTimeout: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private lastReconnectAttempt: number = 0;
  private readonly RECONNECT_COOLDOWN_MS = 15000; // 15 seconds minimum between attempts
  private isCleanedUp: boolean = false;

  constructor(rehauAuth: RehauAuthPersistent, mqttConfig: MQTTConfig) {
    this.rehauAuth = rehauAuth;
    this.mqttConfig = mqttConfig;
  }

  async connect(): Promise<void> {
    // Register email for obfuscation
    registerObfuscation('email', this.rehauAuth.getEmail());
    
    // Connect to REHAU MQTT
    await this.connectToRehau();
    
    // Connect to Home Assistant MQTT
    await this.connectToHomeAssistant();
    
    this.connected = true;
    
    // Start periodic health check for MQTT connections
    this.startHealthCheck();
    
    // Load referentials immediately
    await this.loadReferentials();
    
    // Reload referentials with configurable interval
    const referentialsInterval = parseInt(process.env.REFERENTIALS_RELOAD_INTERVAL || '86400') * 1000; // Default 24 hours
    this.referentialsTimer = setInterval(() => {
      this.loadReferentials();
    }, referentialsInterval);
    
    logger.info(`Referentials reload scheduled every ${referentialsInterval / 1000} seconds`);
  }

  private async connectToRehau(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('🔌 Connecting to REHAU MQTT broker...');
      
      const rehauUrl = 'wss://mqtt.nea2aws.aws.rehau.cloud:443/mqtt';
      const username = `${this.rehauAuth.getEmail()}?x-amz-customauthorizer-name=app-front`;
      const password = this.rehauAuth.getAccessToken();
      
      if (!password) {
        reject(new Error('No access token available'));
        return;
      }

      const options: IClientOptions = {
        clientId: this.rehauAuth.getClientId(),
        username,
        password,
        protocol: 'wss',
        rejectUnauthorized: true,
        keepalive: 60,
        reconnectPeriod: 0, // Disable automatic reconnection - we'll handle it manually
        connectTimeout: 30000,
        protocolVersion: 4,
        wsOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
            'Origin': 'http://android.neasmart.de',
            'Sec-WebSocket-Protocol': 'mqtt'
          }
        }
      };

      this.rehauClient = mqtt.connect(rehauUrl, options);

      const handleRehauConnect = () => {
        const isReconnect = this.rehauSubscriptions.size > 0;
        
        if (isReconnect) {
          logger.info('🔄 Reconnected to REHAU MQTT broker');
          logger.info(`📋 Re-subscribing to ${this.rehauSubscriptions.size} REHAU topics...`);
        } else {
          logger.info('✅ Connected to REHAU MQTT broker');
        }
        
        // Subscribe to user topic
        const userTopic = `client/${this.rehauAuth.getEmail()}`;
        this.rehauClient!.subscribe(userTopic, (err) => {
          if (!err) {
            if (isReconnect) {
              logger.info(`✅ Re-subscribed to REHAU user topic: ${userTopic}`);
            } else {
              logger.info(`✅ Subscribed to REHAU user topic: ${userTopic}`);
            }
            this.rehauSubscriptions.add(userTopic);
          } else {
            logger.error('❌ Failed to subscribe to REHAU user topic:', err);
          }
        });
        
        // Re-subscribe to all installation topics
        if (this.rehauSubscriptions.size > 1 || isReconnect) {
          this.rehauSubscriptions.forEach(topic => {
            if (topic !== userTopic) {
              this.rehauClient!.subscribe(topic, (err) => {
                if (!err) {
                  logger.info(`✅ Re-subscribed to REHAU topic: ${topic}`);
                } else {
                  logger.error(`❌ Failed to re-subscribe to ${topic}:`, err);
                }
              });
            }
          });
        }
        
        if (!isReconnect) {
          resolve();
        }
      };
      
      this.rehauClient.on('connect', handleRehauConnect);

      this.rehauClient.on('message', (topic, message) => {
        this.handleRehauMessage(topic, message);
      });

      this.rehauClient.on('error', (error) => {
        logger.error('❌ REHAU MQTT error:', error.message);
        logger.error('Error details:', error);
        reject(error);
      });

      this.rehauClient.on('close', () => {
        logger.warn('⚠️  REHAU MQTT connection closed');
        logger.info(`📊 Subscriptions to restore: ${this.rehauSubscriptions.size}`);
        
        // Handle manual reconnection with token refresh
        if (!this.isReconnecting) {
          this.handleRehauReconnection();
        }
      });

      this.rehauClient.on('reconnect', () => {
        // This should not fire since reconnectPeriod is 0
        logger.debug('MQTT client reconnect event (should not happen)');
      });
      
      this.rehauClient.on('offline', () => {
        logger.warn('📴 REHAU MQTT client went offline');
      });
    });
  }

  private async connectToHomeAssistant(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('🔌 Connecting to Home Assistant MQTT broker...');
      
      const haUrl = `mqtt://${this.mqttConfig.host}:${this.mqttConfig.port}`;
      
      const options: IClientOptions = {
        clientId: `rehau-bridge-${this.rehauAuth.getClientId()}`,
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 30000
      };
      
      if (this.mqttConfig.username) {
        options.username = this.mqttConfig.username;
        options.password = this.mqttConfig.password;
      }
      
      this.haClient = mqtt.connect(haUrl, options);

      const handleHAConnect = () => {
        const isReconnect = this.haSubscriptions.size > 0;
        
        if (isReconnect) {
          logger.info('🔄 Reconnected to Home Assistant MQTT broker');
          logger.info(`📋 Re-subscribing to ${this.haSubscriptions.size} HA topics...`);
        } else {
          logger.info('✅ Connected to Home Assistant MQTT broker');
        }
        
        // Re-subscribe to all previously subscribed topics
        if (this.haSubscriptions.size > 0) {
          this.haSubscriptions.forEach(topic => {
            this.haClient!.subscribe(topic, (err) => {
              if (!err) {
                logger.info(`✅ Re-subscribed to HA topic: ${topic}`);
              } else {
                logger.error(`❌ Failed to re-subscribe to ${topic}:`, err);
              }
            });
          });
        }
        
        if (!isReconnect) {
          resolve();
        }
      };
      
      this.haClient.on('connect', handleHAConnect);

      this.haClient.on('message', (topic, message) => {
        this.handleHomeAssistantMessage(topic, message);
      });

      this.haClient.on('error', (error) => {
        logger.error('❌ Home Assistant MQTT error:', error.message);
        reject(error);
      });

      this.haClient.on('close', () => {
        logger.warn('⚠️  Home Assistant MQTT connection closed');
        logger.info(`📊 Subscriptions to restore: ${this.haSubscriptions.size}`);
      });

      this.haClient.on('reconnect', () => {
        logger.info('🔄 Attempting to reconnect to Home Assistant MQTT...');
      });
      
      this.haClient.on('offline', () => {
        logger.warn('📴 Home Assistant MQTT client went offline');
      });
    });
  }

  /**
   * Handle REHAU MQTT reconnection with token refresh
   */
  private async handleRehauReconnection(): Promise<void> {
    const now = Date.now();
    
    // Check cooldown to prevent tight loops
    if (now - this.lastReconnectAttempt < this.RECONNECT_COOLDOWN_MS) {
      const remainingCooldown = Math.ceil((this.RECONNECT_COOLDOWN_MS - (now - this.lastReconnectAttempt)) / 1000);
      logger.debug(`🔄 REHAU reconnection in cooldown, waiting ${remainingCooldown}s...`);
      return;
    }
    
    if (this.isReconnecting) {
      logger.debug('REHAU reconnection already in progress, skipping');
      return;
    }

    this.lastReconnectAttempt = now;
    this.isReconnecting = true;
    logger.info('🔄 Preparing to reconnect to REHAU MQTT...');
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Wait 5 seconds before attempting reconnection
    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Step 1: Refresh authentication token
        logger.info('🔐 Refreshing authentication token...');
        await this.rehauAuth.ensureValidToken();
        logger.info('✅ Token refreshed successfully');
        
        // Step 2: Close old connection if it exists
        if (this.rehauClient) {
          logger.debug('Closing old REHAU MQTT connection...');
          this.rehauClient.removeAllListeners();
          this.rehauClient.end(true);
          this.rehauClient = null;
        }
        
        // Step 3: Reconnect with fresh token
        logger.info('🔌 Reconnecting to REHAU MQTT with fresh credentials...');
        await this.connectToRehau();
        
        // Step 4: Restore subscriptions
        logger.info(`📋 Restoring ${this.rehauSubscriptions.size} subscriptions...`);
        const subscriptionsToRestore = Array.from(this.rehauSubscriptions);
        this.rehauSubscriptions.clear(); // Clear and re-add as we subscribe
        
        for (const topic of subscriptionsToRestore) {
          await new Promise<void>((resolve, reject) => {
            this.rehauClient!.subscribe(topic, (err) => {
              if (!err) {
                logger.info(`✅ Restored subscription: ${topic}`);
                this.rehauSubscriptions.add(topic);
                resolve();
              } else {
                logger.error(`❌ Failed to restore subscription ${topic}:`, err);
                reject(err);
              }
            });
          });
        }
        
        logger.info('✅ REHAU MQTT reconnection completed successfully');
        this.isReconnecting = false;
        
      } catch (error) {
        logger.error('❌ Failed to reconnect to REHAU MQTT:', (error as Error).message);
        logger.error('Will retry in 30 seconds...');
        this.isReconnecting = false;
        
        // Retry after 30 seconds
        this.reconnectTimeout = setTimeout(() => {
          this.handleRehauReconnection();
        }, 30000);
      }
    }, 5000);
  }

  /**
   * Handle Home Assistant MQTT reconnection
   */
  private async handleHaReconnection(): Promise<void> {
    const now = Date.now();
    
    // Check cooldown to prevent tight loops
    if (now - this.lastReconnectAttempt < this.RECONNECT_COOLDOWN_MS) {
      const remainingCooldown = Math.ceil((this.RECONNECT_COOLDOWN_MS - (now - this.lastReconnectAttempt)) / 1000);
      logger.debug(`🔄 HA reconnection in cooldown, waiting ${remainingCooldown}s...`);
      return;
    }
    
    if (this.isReconnecting) {
      logger.debug('HA reconnection already in progress, skipping');
      return;
    }

    this.lastReconnectAttempt = now;
    this.isReconnecting = true;
    logger.info('🔄 Attempting to reconnect to Home Assistant MQTT...');
    
    try {
      // Close old connection if it exists
      if (this.haClient) {
        await new Promise<void>((resolve) => {
          this.haClient!.end(false, {}, () => resolve());
        });
      }
      
      // Reconnect to Home Assistant MQTT
      await this.connectToHomeAssistant();
      logger.info('✅ Reconnected to Home Assistant MQTT broker');
      this.isReconnecting = false;
      
    } catch (error) {
      logger.error('❌ Failed to reconnect to Home Assistant MQTT:', (error as Error).message);
      this.isReconnecting = false;
      
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(30000, 5000 * Math.pow(2, 2)); // 20s max
      logger.info(`🔄 Retrying HA MQTT reconnection in ${retryDelay / 1000} seconds...`);
      
      setTimeout(() => {
        this.handleHaReconnection();
      }, retryDelay);
    }
  }

  /**
   * Start periodic health check for MQTT connections
   */
  private startHealthCheck(): void {
    // Clear existing timer if any
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Check connections every 30 seconds
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    logger.info('🏥 Started MQTT connection health check (every 30 seconds)');
  }

  /**
   * Perform health check on both MQTT connections
   */
  private performHealthCheck(): void {
    if (this.isCleanedUp) {
      return; // Don't perform health checks after cleanup
    }
    
    const rehauConnected = !!this.rehauClient?.connected;
    const haConnected = !!this.haClient?.connected;
    
    // Check REHAU MQTT connection
    if (!rehauConnected && this.rehauSubscriptions.size > 0) {
      logger.warn('🏥 Health check: REHAU MQTT connection lost, attempting reconnection...');
      this.handleRehauReconnection();
    }
    
    // Check Home Assistant MQTT connection
    if (!haConnected && this.haSubscriptions.size > 0) {
      logger.warn('🏥 Health check: Home Assistant MQTT connection lost, attempting reconnection...');
      this.handleHaReconnection();
    }
    
    // Log connection status in debug mode
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`🏥 Health check - REHAU: ${rehauConnected ? '✅' : '❌'}, HA: ${haConnected ? '✅' : '❌'}`);
    }
  }

  async subscribeToInstallation(installUnique: string): Promise<void> {
    const topic = `client/${installUnique}/realtime`;
    
    return new Promise((resolve, reject) => {
      this.rehauClient!.subscribe(topic, (err) => {
        if (!err) {
          logger.info(`✅ Subscribed to installation: ${topic}`);
          this.rehauSubscriptions.add(topic);
          resolve();
        } else {
          logger.error(`Failed to subscribe to ${topic}:`, err);
          reject(err);
        }
      });
    });
  }

  private handleRehauMessage(topic: string, message: Buffer): void {
    try {
      const payload: RehauMQTTMessage = JSON.parse(message.toString());
      
      // Log essential information about the message
      if (payload.type === 'channel_update') {
        const channelData = (payload as any).data?.data;
        const channelId = (payload as any).data?.channel;
        const installId = (payload as any).data?.unique;
        const zoneName = this.channelToZoneName.get(channelId) || 'Unknown';
        const groupName = this.channelToGroupName.get(channelId) || 'Unknown';
        
        logger.info(`📨 REHAU MQTT Update: Channel: ${channelId} Group: ${groupName} Zone: ${zoneName} Install: ${installId?.substring(0, 8)}...`);
        
        if (channelData) {
          const updates: string[] = [];
          
          // Temperature
          if (channelData.temp_zone !== undefined && channelData.temp_zone !== null) {
            const tempC = Math.round(((channelData.temp_zone / 10 - 32) / 1.8) * 10) / 10;
            updates.push(`temp=${tempC}°C`);
          }
          
          // Humidity
          if (channelData.humidity !== undefined && channelData.humidity !== null) {
            updates.push(`humidity=${channelData.humidity}%`);
          }
          
          // Setpoints (show both comfort and away/reduced)
          if (channelData.setpoint_h_normal !== undefined && channelData.setpoint_h_normal !== null) {
            const setpointC = Math.round(((channelData.setpoint_h_normal / 10 - 32) / 1.8) * 10) / 10;
            updates.push(`setpoint_heat_comfort=${setpointC}°C`);
          }
          if (channelData.setpoint_h_reduced !== undefined && channelData.setpoint_h_reduced !== null) {
            const setpointC = Math.round(((channelData.setpoint_h_reduced / 10 - 32) / 1.8) * 10) / 10;
            updates.push(`setpoint_heat_away=${setpointC}°C`);
          }
          if (channelData.setpoint_c_normal !== undefined && channelData.setpoint_c_normal !== null) {
            const setpointC = Math.round(((channelData.setpoint_c_normal / 10 - 32) / 1.8) * 10) / 10;
            updates.push(`setpoint_cool_comfort=${setpointC}°C`);
          }
          if (channelData.setpoint_c_reduced !== undefined && channelData.setpoint_c_reduced !== null) {
            const setpointC = Math.round(((channelData.setpoint_c_reduced / 10 - 32) / 1.8) * 10) / 10;
            updates.push(`setpoint_cool_away=${setpointC}°C`);
          }
          
          // Mode
          if (channelData.mode_used !== undefined && channelData.mode_used !== null) {
            const modeNames = ['comfort', 'away', 'standby', 'off'];
            const modeName = modeNames[channelData.mode_used] || channelData.mode_used;
            updates.push(`mode=${modeName}`);
          }
          
          // Ring light and lock
          if (channelData.cc_config_bits?.ring_activation !== undefined) {
            updates.push(`ring_light=${channelData.cc_config_bits.ring_activation ? 'ON' : 'OFF'}`);
          }
          if (channelData.cc_config_bits?.lock !== undefined) {
            updates.push(`lock=${channelData.cc_config_bits.lock ? 'LOCKED' : 'UNLOCKED'}`);
          }
          
          // Demand
          if (channelData.demand !== undefined && channelData.demand !== null) {
            updates.push(`demand=${channelData.demand}%`);
          }
          
          if (updates.length > 0) {
            logger.info(`   Updates: ${updates.join(', ')}`);
          } else {
            logger.info(`   No recognized updates in message`);
          }
        }
      } else if (payload.type === 'realtime' || payload.type === 'realtime.update') {
        const zones = (payload as any).zones;
        logger.info(`📨 REHAU: ${payload.type} with ${zones?.length || 0} zone(s)`);
      } else if (payload.type === 'live_data') {
        const dataType = (payload as any).data?.type;
        const installId = (payload as any).data?.unique;
        logger.info(`📨 REHAU LIVE Data Response:`);
        logger.info(`   Type: ${dataType}`);
        logger.info(`   Install: ${installId?.substring(0, 8)}...`);
        
        if (dataType === 'LIVE_EMU') {
          const circuits = Object.keys((payload as any).data?.data || {});
          logger.info(`   Mixed Circuits: ${circuits.join(', ')}`);
        } else if (dataType === 'LIVE_DIDO') {
          const controllers = Object.keys((payload as any).data?.data || {});
          logger.info(`   Controllers: ${controllers.join(', ')}`);
        }
      } else if (payload.type === 'LIVE_EMU' || payload.type === 'LIVE_DIDO') {
        logger.info(`📨 REHAU: ${payload.type} data received`);
      } else {
        logger.info(`📨 REHAU: ${payload.type} message on ${topic}`);
      }
      
      // Full message dump in debug mode (with redacted sensitive data)
      debugDump(`REHAU MQTT Message [${topic}]`, payload);
      
      // Notify all registered handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(topic, payload);
        } catch (error) {
          logger.error('Error in message handler:', error);
        }
      });
    } catch (error) {
      logger.error('Failed to parse REHAU message:', (error as Error).message);
    }
  }

  private handleHomeAssistantMessage(topic: string, message: Buffer): void {
    try {
      const payload = message.toString();
      logger.debug(`HA MQTT message received: topic=${topic}, payload=${payload}`);
      
      // Check if this is a command topic
      if (topic.includes('_command') || topic.includes('/command')) {
        this.handleHomeAssistantCommand(topic, payload);
      } else {
        logger.debug(`Ignoring non-command topic: ${topic}`);
      }
    } catch (error) {
      logger.error('Failed to handle Home Assistant message:', (error as Error).message, (error as Error).stack);
    }
  }

  private handleHomeAssistantCommand(topic: string, payload: string): void {
    // Extract zone ID and command type from topic
    // Format: homeassistant/climate/rehau_{zoneId}/mode_command
    // Format: homeassistant/light/rehau_{zoneId}_ring_light/command
    logger.debug(`HA Command received: topic=${topic}, payload=${payload}`);
    
    // Try climate command format first
    // Match zone ID (MongoDB ObjectId format: 24 hex characters)
    let match = topic.match(/climate\/rehau_([a-f0-9]{24})\/(.+)_command/);
    if (match) {
      const [, zoneId, commandType] = match;
      logger.info(`Command: ${commandType} = ${payload} for zone ${zoneId}`);
      
      // Find the installId from the zone
      // We need to look up which installation this zone belongs to
      this.messageHandlers.forEach(handler => {
        try {
          const command: HACommand = {
            type: 'ha_command',
            installId: '', // Will be determined by climate controller from zoneId
            zoneNumber: zoneId, // This is actually zoneId
            commandType: commandType as 'mode' | 'preset' | 'temperature',
            payload
          };
          handler(command);
        } catch (error) {
          // Ignore errors from handlers that don't expect this format
        }
      });
      return;
    }
    
    // Try light command format (using zone ID)
    match = topic.match(/light\/rehau_([^/]+)_ring_light\/command/);
    if (match) {
      const [, zoneId] = match;
      logger.info(`Ring light command: ${payload} for zone ${zoneId}`);
      
      // Emit as a special command that climate controller will handle
      this.messageHandlers.forEach(handler => {
        try {
          const command = {
            type: 'ring_light_command',
            zoneId,
            payload
          };
          handler(command as any);
        } catch (error) {
          // Ignore errors from handlers that don't expect this format
        }
      });
      return;
    }
    
    // Try lock command format (using zone ID)
    match = topic.match(/lock\/rehau_([^/]+)_lock\/command/);
    if (match) {
      const [, zoneId] = match;
      logger.info(`Lock command: ${payload} for zone ${zoneId}`);
      
      // Emit as a special command that climate controller will handle
      this.messageHandlers.forEach(handler => {
        try {
          const command = {
            type: 'lock_command',
            zoneId,
            payload
          };
          handler(command as any);
        } catch (error) {
          // Ignore errors from handlers that don't expect this format
        }
      });
      return;
    }
    
    logger.warn('Unknown command topic format:', topic);
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  subscribeToHomeAssistant(topic: string): void {
    // Always add to subscription set for reconnection
    this.haSubscriptions.add(topic);
    
    if (!this.haClient || !this.haClient.connected) {
      logger.warn(`⏳ Home Assistant MQTT not connected yet, queued subscription: ${topic}`);
      return;
    }
    
    this.haClient.subscribe(topic, (err) => {
      if (!err) {
        logger.info(`✅ Subscribed to HA command topic: ${topic}`);
      } else {
        logger.error(`❌ Failed to subscribe to ${topic}:`, err);
      }
    });
  }

  publishToHomeAssistant(topic: string, payload: string | object, options: IClientPublishOptions = {}): void {
    if (!this.haClient || !this.haClient.connected) {
      logger.warn('⚠️  Home Assistant MQTT not connected, attempting reconnection...');
      // Trigger immediate reconnection attempt
      this.handleHaReconnection();
      return;
    }
    
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.haClient.publish(topic, message, options, (err) => {
      if (err) {
        logger.error('Failed to publish to Home Assistant:', err);
        // Trigger reconnection on publish error
        logger.warn('🔄 Publish failed, attempting HA reconnection...');
        this.handleHaReconnection();
      } else {
        logger.debug(`Published to Home Assistant: {\n  "topic": "${topic}",\n  "payload": ${typeof payload === 'string' ? `"${payload}"` : JSON.stringify(payload, null, 2)}\n}`);
      }
    });
  }

  publishToRehau(topic: string, payload: string | object): void {
    if (!this.rehauClient || !this.rehauClient.connected) {
      logger.warn('⚠️  REHAU MQTT not connected, attempting reconnection...');
      // Trigger immediate reconnection attempt
      this.handleRehauReconnection();
      return;
    }
    
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.rehauClient.publish(topic, message, (err) => {
      if (err) {
        logger.error('Failed to publish to REHAU:', err);
        // Trigger reconnection on publish error
        logger.warn('🔄 Publish failed, attempting REHAU reconnection...');
        this.handleRehauReconnection();
      } else {
        // Redact sensitive data before logging
        const redactedPayload = typeof payload === 'object' ? redactSensitiveData(payload) : payload;
        debugDump(`Published to REHAU [${topic}]`, redactedPayload);
      }
    });
  }

  isConnected(): boolean {
    return this.connected && 
           !!this.rehauClient?.connected && 
           !!this.haClient?.connected;
  }

  /**
   * Request live data from REHAU system
   * @param installUnique - Installation unique ID
   * @param dataType - 0 for LIVE_DIDO (digital I/O), 1 for LIVE_EMU (mixed circuits/pumps)
   */
  requestLiveData(installUnique: string, dataType: 0 | 1): void {
    const topic = `client/${installUnique}`;
    const message = {
      "11": "REQ_LIVE",
      "12": {
        "DATA": dataType
      }
    };
    
    const typeName = dataType === 0 ? 'LIVE_DIDO' : 'LIVE_EMU';
    logger.debug(`Requesting ${typeName} data for installation ${installUnique}`);
    this.publishToRehau(topic, message);
  }

  /**
   * Start periodic LIVE data polling
   * @param installUniques - Array of installation unique IDs to poll
   * @param intervalSeconds - Polling interval in seconds (default: 300 = 5 minutes)
   */
  startLiveDataPolling(installUniques: string[], intervalSeconds: number = 300): void {
    this.installations = installUniques;
    
    // Clear existing timer if any
    if (this.liveDataTimer) {
      clearInterval(this.liveDataTimer);
    }
    
    // Set up periodic polling
    this.liveDataTimer = setInterval(() => {
      if (this.rehauClient?.connected) {
        this.installations.forEach(installUnique => {
          // Request LIVE_EMU (mixed circuits)
          this.requestLiveData(installUnique, 1);
          
          // Request LIVE_DIDO (digital I/O) after a short delay
          setTimeout(() => {
            this.requestLiveData(installUnique, 0);
          }, 1000);
        });
      }
    }, intervalSeconds * 1000);
    
    logger.info(`LIVE data polling started: every ${intervalSeconds} seconds for ${installUniques.length} installation(s)`);
  }

  /**
   * Stop LIVE data polling
   */
  stopLiveDataPolling(): void {
    if (this.liveDataTimer) {
      clearInterval(this.liveDataTimer);
      this.liveDataTimer = null;
      logger.info('LIVE data polling stopped');
    }
  }

  async disconnect(): Promise<void> {
    logger.info('🔌 Disconnecting from MQTT brokers...');
    
    // Stop all timers first
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.referentialsTimer) {
      clearInterval(this.referentialsTimer);
      this.referentialsTimer = null;
    }
    
    if (this.liveDataTimer) {
      clearInterval(this.liveDataTimer);
      this.liveDataTimer = null;
    }
    
    if (this.referentialsHandlerTimeout) {
      clearTimeout(this.referentialsHandlerTimeout);
      this.referentialsHandlerTimeout = null;
    }
    
    // Remove all event listeners before disconnecting
    if (this.rehauClient) {
      this.rehauClient.removeAllListeners();
      this.rehauClient.end(true);
      this.rehauClient = null;
    }
    
    if (this.haClient) {
      this.haClient.removeAllListeners();
      this.haClient.end(true);
      this.haClient = null;
    }
    
    this.connected = false;
    this.isReconnecting = false;
  }

  /**
   * Comprehensive cleanup method to release all resources
   * Idempotent: safe to call multiple times
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) {
      logger.debug('RehauMQTTBridge already cleaned up, skipping');
      return;
    }
    
    logger.info('Cleaning up RehauMQTTBridge...');
    
    // Clean up all timers
    if (this.referentialsTimer) {
      clearInterval(this.referentialsTimer);
      this.referentialsTimer = null;
      logger.info('Referentials timer cleared');
    }
    
    if (this.liveDataTimer) {
      clearInterval(this.liveDataTimer);
      this.liveDataTimer = null;
      logger.info('Live data timer cleared');
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
      logger.info('Reconnect timeout cleared');
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.info('Health check timer cleared');
    }
    
    if (this.referentialsHandlerTimeout) {
      clearTimeout(this.referentialsHandlerTimeout);
      this.referentialsHandlerTimeout = null;
      logger.info('Referentials handler timeout cleared');
    }
    
    // Call disconnect to handle MQTT client cleanup
    await this.disconnect();
    
    // Clear subscription sets
    this.rehauSubscriptions.clear();
    this.haSubscriptions.clear();
    logger.info('Subscription sets cleared');
    
    // Clear message handlers array
    this.messageHandlers.length = 0;
    logger.info('Message handlers cleared');
    
    // Clear Maps
    this.channelToZoneName.clear();
    this.channelToGroupName.clear();
    logger.info('Channel mapping Maps cleared');
    
    // Reset reconnection tracking
    this.lastReconnectAttempt = 0;
    logger.info('Reconnection tracking reset');
    
    // Reset flags
    this.connected = false;
    this.isReconnecting = false;
    
    this.isCleanedUp = true;
    logger.info('RehauMQTTBridge cleanup completed');
  }

  private async loadReferentials(): Promise<void> {
    try {
      logger.info('Loading REHAU referentials...');
      
      // Request referentials via MQTT
      const topic = `server/${this.rehauAuth.getEmail()}/v1/install/user/referential`;
      const message = {
        "ID": this.rehauAuth.getEmail(),
        "data": {},
        "sso": true,
        "token": this.rehauAuth.getAccessToken()
      };
      
      // Set up one-time listener for referentials response
      const responseHandler = (topic: string | HACommand, payload?: RehauMQTTMessage): void => {
        if (typeof topic === 'string' && payload && payload.type === 'referential' && payload.data) {
          try {
            // Referentials are LZString-compressed UTF-16 JSON
            const decompressed = LZString.decompressFromUTF16(payload.data as string);
            if (!decompressed) {
              logger.error('Failed to decompress referentials');
              return;
            }
            
            const referentials: ReferentialEntry[] = JSON.parse(decompressed);
            
            // TEMPORARY: Dump referentials for debugging - REMOVE AFTER ANALYSIS
            // logger.info('=== REFERENTIALS DUMP START ===');
            // logger.info(JSON.stringify(referentials, null, 2));
            // logger.info('=== REFERENTIALS DUMP END ===');
            // END TEMPORARY DUMP
            
            // Convert array to map for easy lookup
            const refMap: ReferentialsMap = {};
            referentials.forEach(ref => {
              refMap[ref.value] = ref.index;
              refMap[ref.index] = ref.value;
            });
            this.referentials = refMap;
            
            logger.info(`Loaded ${Object.keys(refMap).length / 2} referentials`);
          } catch (error) {
            logger.error('Failed to parse referentials:', (error as Error).message);
          }
        }
      };
      
      this.messageHandlers.push(responseHandler);
      
      // Publish request
      this.publishToRehau(topic, message);
      
      // Remove handler after 10 seconds
      this.referentialsHandlerTimeout = setTimeout(() => {
        const index = this.messageHandlers.indexOf(responseHandler);
        if (index > -1) {
          this.messageHandlers.splice(index, 1);
        }
        this.referentialsHandlerTimeout = null;
      }, 10000);
      
    } catch (error) {
      logger.error('Failed to load referentials:', (error as Error).message);
    }
  }

  getReferentials(): ReferentialsMap | null {
    return this.referentials;
  }

  registerZoneName(channelId: string, zoneName: string, groupName?: string): void {
    this.channelToZoneName.set(channelId, zoneName);
    if (groupName) {
      this.channelToGroupName.set(channelId, groupName);
    }
  }

  getZoneName(channelId: string): string | undefined {
    return this.channelToZoneName.get(channelId);
  }

  getGroupName(channelId: string): string | undefined {
    return this.channelToGroupName.get(channelId);
  }
}

export default RehauMQTTBridge;
