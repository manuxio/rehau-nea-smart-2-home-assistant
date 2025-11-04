import mqtt, { MqttClient, IClientOptions, IClientPublishOptions } from 'mqtt';
import LZString from 'lz-string';
import logger, { debugDump, redactSensitiveData } from './logger';
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
  private rehauSubscriptions: Set<string> = new Set();
  private haSubscriptions: Set<string> = new Set();

  constructor(rehauAuth: RehauAuthPersistent, mqttConfig: MQTTConfig) {
    this.rehauAuth = rehauAuth;
    this.mqttConfig = mqttConfig;
  }

  async connect(): Promise<void> {
    // Connect to REHAU MQTT
    await this.connectToRehau();
    
    // Connect to Home Assistant MQTT
    await this.connectToHomeAssistant();
    
    this.connected = true;
    
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
      logger.info('Connecting to REHAU MQTT broker...');
      
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
        reconnectPeriod: 5000,
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

      this.rehauClient.on('connect', () => {
        logger.info('Connected to REHAU MQTT broker');
        
        // Subscribe to user topic
        const userTopic = `client/${this.rehauAuth.getEmail()}`;
        this.rehauClient!.subscribe(userTopic, (err) => {
          if (!err) {
            logger.info(`Subscribed to REHAU user topic: ${userTopic}`);
            this.rehauSubscriptions.add(userTopic);
          } else {
            logger.error('Failed to subscribe to REHAU user topic:', err);
          }
        });
        
        // Re-subscribe to all previously subscribed topics (for reconnection)
        if (this.rehauSubscriptions.size > 1) {
          logger.info(`Re-subscribing to ${this.rehauSubscriptions.size - 1} REHAU topics...`);
          this.rehauSubscriptions.forEach(topic => {
            if (topic !== userTopic) {
              this.rehauClient!.subscribe(topic, (err) => {
                if (!err) {
                  logger.debug(`Re-subscribed to REHAU topic: ${topic}`);
                } else {
                  logger.error(`Failed to re-subscribe to ${topic}:`, err);
                }
              });
            }
          });
        }
        
        resolve();
      });

      this.rehauClient.on('message', (topic, message) => {
        this.handleRehauMessage(topic, message);
      });

      this.rehauClient.on('error', (error) => {
        logger.error('REHAU MQTT error:', error.message);
        logger.error('Error details:', error);
        reject(error);
      });

      this.rehauClient.on('close', () => {
        logger.warn('REHAU MQTT connection closed');
        logger.debug('Connection details:', {
          username,
          clientId: this.rehauAuth.getClientId(),
          hasToken: !!password
        });
      });

      this.rehauClient.on('reconnect', () => {
        logger.info('Reconnecting to REHAU MQTT...');
      });
    });
  }

  private async connectToHomeAssistant(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Connecting to Home Assistant MQTT broker...');
      
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

      this.haClient.on('connect', () => {
        logger.info('Connected to Home Assistant MQTT broker');
        
        // Re-subscribe to all previously subscribed topics (for reconnection)
        if (this.haSubscriptions.size > 0) {
          logger.info(`Re-subscribing to ${this.haSubscriptions.size} Home Assistant topics...`);
          this.haSubscriptions.forEach(topic => {
            this.haClient!.subscribe(topic, (err) => {
              if (!err) {
                logger.debug(`Re-subscribed to HA topic: ${topic}`);
              } else {
                logger.error(`Failed to re-subscribe to ${topic}:`, err);
              }
            });
          });
        }
        
        resolve();
      });

      this.haClient.on('message', (topic, message) => {
        this.handleHomeAssistantMessage(topic, message);
      });

      this.haClient.on('error', (error) => {
        logger.error('Home Assistant MQTT error:', error.message);
        reject(error);
      });

      this.haClient.on('close', () => {
        logger.warn('Home Assistant MQTT connection closed');
      });

      this.haClient.on('reconnect', () => {
        logger.info('Reconnecting to Home Assistant MQTT...');
      });
    });
  }

  async subscribeToInstallation(installUnique: string): Promise<void> {
    const topic = `client/${installUnique}/realtime`;
    
    return new Promise((resolve, reject) => {
      this.rehauClient!.subscribe(topic, (err) => {
        if (!err) {
          logger.info(`Subscribed to installation: ${topic}`);
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
      logger.debug('REHAU message received:', { topic, type: payload.type });
      
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
      logger.debug('Home Assistant message received:', { topic, payload });
      
      // Full message dump in debug mode
      debugDump(`Home Assistant MQTT Message [${topic}]`, { topic, payload });
      
      // Handle command messages from Home Assistant
      if (topic.includes('_command')) {
        this.handleHomeAssistantCommand(topic, payload);
      }
    } catch (error) {
      logger.error('Failed to handle Home Assistant message:', (error as Error).message, (error as Error).stack);
    }
  }

  private handleHomeAssistantCommand(topic: string, payload: string): void {
    // Extract installation ID and command type from topic
    // Format: homeassistant/climate/rehau_{installId}_zone_{zoneNumber}/mode_command
    logger.debug(`HA Command received: topic=${topic}, payload=${payload}`);
    
    const match = topic.match(/rehau_([^/]+)_zone_(\d+)\/(.+)_command/);
    if (!match) {
      logger.warn('Unknown command topic format:', topic);
      return;
    }
    
    const [, installId, zoneNumber, commandType] = match;
    logger.info(`Command: ${commandType} = ${payload} for zone ${zoneNumber}`);
    
    // Emit command event for climate controller to handle
    this.messageHandlers.forEach(handler => {
      try {
        const command: HACommand = {
          type: 'ha_command',
          installId,
          zoneNumber: parseInt(zoneNumber),
          commandType: commandType as 'mode' | 'preset' | 'temperature',
          payload
        };
        handler(command);
      } catch (error) {
        // Ignore errors from handlers that don't expect this format
      }
    });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  subscribeToHomeAssistant(topic: string): void {
    if (!this.haClient || !this.haClient.connected) {
      logger.warn('Home Assistant MQTT not connected, cannot subscribe');
      return;
    }
    
    this.haClient.subscribe(topic, (err) => {
      if (!err) {
        logger.debug(`Subscribed to HA topic: ${topic}`);
        this.haSubscriptions.add(topic);
      } else {
        logger.error(`Failed to subscribe to ${topic}:`, err);
      }
    });
  }

  publishToHomeAssistant(topic: string, payload: string | object, options: IClientPublishOptions = {}): void {
    if (!this.haClient || !this.haClient.connected) {
      logger.warn('Home Assistant MQTT not connected, cannot publish');
      return;
    }
    
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.haClient.publish(topic, message, options, (err) => {
      if (err) {
        logger.error('Failed to publish to Home Assistant:', err);
      } else {
        logger.debug(`Published to Home Assistant: {\n  "topic": "${topic}",\n  "payload": ${typeof payload === 'string' ? `"${payload}"` : JSON.stringify(payload, null, 2)}\n}`);
      }
    });
  }

  publishToRehau(topic: string, payload: string | object): void {
    if (!this.rehauClient || !this.rehauClient.connected) {
      logger.warn('REHAU MQTT not connected, cannot publish');
      return;
    }
    
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.rehauClient.publish(topic, message, (err) => {
      if (err) {
        logger.error('Failed to publish to REHAU:', err);
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

  async disconnect(): Promise<void> {
    logger.info('Disconnecting from MQTT brokers...');
    
    if (this.referentialsTimer) {
      clearInterval(this.referentialsTimer);
    }
    
    if (this.rehauClient) {
      this.rehauClient.end();
    }
    
    if (this.haClient) {
      this.haClient.end();
    }
    
    this.connected = false;
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
      setTimeout(() => {
        const index = this.messageHandlers.indexOf(responseHandler);
        if (index > -1) {
          this.messageHandlers.splice(index, 1);
        }
      }, 10000);
      
    } catch (error) {
      logger.error('Failed to load referentials:', (error as Error).message);
    }
  }

  getReferentials(): ReferentialsMap | null {
    return this.referentials;
  }
}

export default RehauMQTTBridge;
