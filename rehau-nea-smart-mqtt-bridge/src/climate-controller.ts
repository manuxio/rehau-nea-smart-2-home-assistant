import logger from './logger';
import RehauMQTTBridge from './mqtt-bridge';
import RehauAuthPersistent from './rehau-auth';
import {
  RehauInstallation,
  RehauChannel,
  ClimateState,
  ZoneInfo,
  HACommand,
  RehauMQTTMessage,
  RehauCommandData,
  LiveEMUData,
  LiveDIDOData
} from './types';

interface ExtendedZoneInfo extends ZoneInfo {
  groupName: string;
  installId: string;
  channels: RehauChannel[];
}

class ClimateController {
  private mqttBridge: RehauMQTTBridge;
  private installations: Map<string, ClimateState>;
  private installationNames: Map<string, string>; // Map installId -> installName

  constructor(mqttBridge: RehauMQTTBridge, _rehauApi: RehauAuthPersistent) {
    this.mqttBridge = mqttBridge;
    this.installations = new Map<string, ClimateState>();
    this.installationNames = new Map<string, string>();
    
    // Listen to REHAU messages and HA commands
    this.mqttBridge.onMessage((topicOrCommand, payload?) => {
      // Check if this is an HA command (single object argument)
      if (typeof topicOrCommand === 'object' && topicOrCommand.type === 'ha_command') {
        this.handleHomeAssistantCommand(topicOrCommand);
      } else if (typeof topicOrCommand === 'string' && payload) {
        // Check for LIVE data responses
        const msg = payload as RehauMQTTMessage;
        if (msg.type === 'live_data' && (msg as any).data?.type === 'LIVE_EMU') {
          this.handleLiveEMU(payload as LiveEMUData);
        } else if (msg.type === 'live_data' && (msg as any).data?.type === 'LIVE_DIDO') {
          this.handleLiveDIDO(payload as LiveDIDOData);
        } else {
          // Regular REHAU message (topic, payload arguments)
          this.handleRehauUpdate(topicOrCommand, payload);
        }
      }
    });
  }

  initializeInstallation(install: RehauInstallation): void {
    const installId = install.unique;
    const installName = install.name;
    
    // Store installation name for later use
    this.installationNames.set(installId, installName);
    
    // Get zones from groups (not controllers)
    const zones: ExtendedZoneInfo[] = [];
    if (install.groups && install.groups.length > 0) {
      install.groups.forEach(group => {
        if (group.zones && group.zones.length > 0) {
          group.zones.forEach(zone => {
            if (zone.channels && zone.channels.length > 0) {
              zones.push({
                zoneId: zone._id,
                zoneName: zone.name,
                zoneNumber: zone.number,
                groupName: group.name,
                installId: installId,
                installName: install.name,
                channels: zone.channels // Include full channel data
              });
            }
          });
        }
      });
    }
    
    // Determine installation-wide heating/cooling mode from installation data
    let installationMode: 'heat' | 'cool' = 'heat'; // default to heat
    let systemSupportsCooling = false;
    
    // Check system capabilities from coolingConditions
    if (install.coolingConditions) {
      const coolingBits = install.coolingConditions.toString(2).padStart(5, '0');
      systemSupportsCooling = coolingBits[4] === '1'; // bit 0 = cooling enabled
    }
    
    // Determine current mode (heat or cool, not auto)
    // Check if any zone is actively cooling
    const isActivelyCooling = zones.some(z => 
      z.channels && z.channels[0] && 
      (z.channels[0].demand ?? 0) > 0 && 
      z.channels[0].setpoint_c_normal && 
      !z.channels[0].setpoint_h_normal
    );
    
    if (systemSupportsCooling && isActivelyCooling) {
      installationMode = 'cool';
    } else {
      installationMode = 'heat'; // Default to heat
    }
    
    // Initialize state for each zone
    zones.forEach(zone => {
      const zoneKey = `${installId}_zone_${zone.zoneNumber}`;
      
      // Get initial values from zone data if available
      let currentTemp: number | null = null;
      let targetTemp: number | null = null;
      let humidity: number | null = null;
      let mode: 'off' | 'heat' | 'cool' = 'heat';
      let preset: 'comfort' | 'away' | null = null;  // Default to null
      
      if (zone.channels && zone.channels[0]) {
        const channel = zone.channels[0];
        
        // Current temperature (stored as Fahrenheit * 10)
        if (channel.temp_zone !== undefined) {
          const temp = this.convertTemp(channel.temp_zone);
          if (temp !== null) currentTemp = temp;
        }
        
        // Humidity
        if (channel.humidity !== undefined) {
          humidity = channel.humidity;
        }
        
        // Mode and Preset based on mode_used
        // mode_used: 0=COMFORT, 1=POWER SAVING, 2=OFF, 3=PROGRAM (not used)
        if (channel.mode_used === 2) {
          // OFF - zone is off, no preset
          mode = 'off';
          preset = null; // Don't publish preset when off
        } else {
          // Zone is on - use system mode and set preset
          mode = installationMode;
          if (channel.mode_used === 0) {
            preset = 'comfort'; // COMFORT
          } else if (channel.mode_used === 1) {
            preset = 'away'; // POWER SAVING
          }
          // mode_used 3 (PROGRAM) is ignored - defaults to comfort
        }
        
        
        // Get target temperature
        if (channel.setpoint_h_normal) {
          const temp1 = this.convertTemp(channel.setpoint_h_normal);
          if (temp1 !== null) targetTemp = temp1;
        } else if (channel.setpoint_c_normal) {
          const temp2 = this.convertTemp(channel.setpoint_c_normal);
          if (temp2 !== null) targetTemp = temp2;
        }
      }
      
      this.installations.set(zoneKey, {
        id: zoneKey,
        installId: installId,
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        zoneNumber: zone.zoneNumber,
        channelNumber: zone.channelNumber,
        installName: zone.installName,
        installationMode: installationMode, // Store for MQTT updates
        currentTemperature: currentTemp,
        targetTemperature: targetTemp,
        humidity: humidity,
        mode: mode,
        preset: preset,
        available: true
      });
      
      // Publish MQTT discovery config for this zone
      this.publishDiscoveryConfig(zone, installId, installationMode);
      
      // Publish separate temperature and humidity sensors
      this.publishZoneSensors(zone, installId, installName);
      
      // Subscribe to command topics for this zone
      this.subscribeToZoneCommands(installId, zone.zoneNumber);
      
      // Publish initial state values
      if (currentTemp !== null) {
        this.publishCurrentTemperature(zoneKey, currentTemp);
      }
      if (targetTemp !== null) {
        this.publishTargetTemperature(zoneKey, targetTemp);
      }
      if (humidity !== null) {
        this.publishHumidity(zoneKey, humidity);
      }
      this.publishMode(zoneKey, mode);
      if (preset !== null && preset !== undefined) {
        this.publishPreset(zoneKey, preset);
      }
      
      logger.info(`Initialized climate for zone: ${zone.zoneName} - ${currentTemp}°C → ${targetTemp}°C, ${humidity}% (${mode}, ${preset})`);
    });
    
    // Create installation-level mode control
    if (zones.length > 0) {
      this.publishInstallationModeControl(install, installationMode);
    }
    
    // Publish outside temperature sensor
    this.publishOutsideTemperatureSensor(install);
  }

  private subscribeToZoneCommands(installId: string, zoneNumber: number): void {
    const topics = [
      `homeassistant/climate/rehau_${installId}_zone_${zoneNumber}/mode_command`,
      `homeassistant/climate/rehau_${installId}_zone_${zoneNumber}/preset_command`,
      `homeassistant/climate/rehau_${installId}_zone_${zoneNumber}/temperature_command`
    ];
    
    topics.forEach(topic => {
      this.mqttBridge.subscribeToHomeAssistant(topic);
    });
  }

  private publishDiscoveryConfig(zone: ZoneInfo, installId: string, systemMode: 'heat' | 'cool'): void {
    const zoneKey = `${installId}_zone_${zone.zoneNumber}`;
    const zoneName = zone.zoneName;
    const installName = zone.installName;
    
    // MQTT Discovery configuration for Home Assistant
    const config = {
      name: zoneName,
      unique_id: `rehau_${installId}_zone_${zone.zoneNumber}`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      
      // Temperature
      current_temperature_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/current_temperature`,
      temperature_state_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/target_temperature`,
      temperature_command_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/temperature_command`,
      
      // Humidity
      current_humidity_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/current_humidity`,
      
      // Mode (off + system mode)
      mode_state_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/mode`,
      mode_command_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/mode_command`,
      modes: ['off', systemMode], // OFF + current system mode (heat or cool)
      
      // Preset modes: Comfort(0), Away(1) - OFF(2) is handled by mode
      preset_mode_state_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/preset`,
      preset_mode_command_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/preset_command`,
      preset_modes: ['comfort', 'away'], // comfort=Comfort, away=Power Saving
      
      // Availability
      availability_topic: `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
      
      // Temperature settings
      temperature_unit: 'C',
      temp_step: 0.5,
      min_temp: 5,
      max_temp: 30,
      
      // Precision
      precision: 0.1,
      
      // Optimistic mode - update UI immediately without waiting for state confirmation
      optimistic: true
    };
    
    // Publish discovery config (same format that worked before)
    const discoveryTopic = `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/config`;
    this.mqttBridge.publishToHomeAssistant(discoveryTopic, config, { retain: true });
    
    // Log the full config for debugging
    logger.info(`Discovery config for ${zoneName}:`);
    logger.info(`Topic: ${discoveryTopic}`);
    logger.info(`Config: ${JSON.stringify(config, null, 2)}`);
    
    // Publish initial availability
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${installId}_zone_${zone.zoneNumber}/availability`,
      'online',
      { retain: true }
    );
    
    // Subscribe to command topics
    this.subscribeToCommands(zoneKey);
    
    logger.info(`Published discovery config for ${installName} - ${zoneName}`);
  }

  private publishZoneSensors(zone: ZoneInfo, installId: string, installName: string): void {
    const zoneName = zone.zoneName;
    const zoneNumber = zone.zoneNumber;
    
    // Sanitize names for sensor IDs (lowercase, replace spaces with underscores)
    const installNameSanitized = installName.toLowerCase().replace(/\s+/g, '_');
    const zoneNameSanitized = zoneName.toLowerCase().replace(/\s+/g, '_');
    
    // Temperature sensor
    const tempConfig = {
      name: `${zoneName} Temperature`,
      unique_id: `rehau_${installNameSanitized}_${zoneNameSanitized}_temperature`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      state_topic: `homeassistant/sensor/rehau_${installId}_zone_${zoneNumber}_temperature/state`,
      device_class: 'temperature',
      unit_of_measurement: '°C',
      value_template: '{{ value }}',
      availability_topic: `homeassistant/sensor/rehau_${installId}_zone_${zoneNumber}_temperature/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Humidity sensor
    const humidityConfig = {
      name: `${zoneName} Humidity`,
      unique_id: `rehau_${installNameSanitized}_${zoneNameSanitized}_humidity`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      state_topic: `homeassistant/sensor/rehau_${installId}_zone_${zoneNumber}_humidity/state`,
      device_class: 'humidity',
      unit_of_measurement: '%',
      value_template: '{{ value }}',
      availability_topic: `homeassistant/sensor/rehau_${installId}_zone_${zoneNumber}_humidity/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Publish temperature sensor discovery
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${installNameSanitized}_${zoneNameSanitized}_temperature/config`,
      tempConfig,
      { retain: true }
    );
    
    // Publish humidity sensor discovery
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${installNameSanitized}_${zoneNameSanitized}_humidity/config`,
      humidityConfig,
      { retain: true }
    );
    
    // Publish availability
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${installId}_zone_${zoneNumber}_temperature/availability`,
      'online',
      { retain: true }
    );
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${installId}_zone_${zoneNumber}_humidity/availability`,
      'online',
      { retain: true }
    );
  }

  private publishOutsideTemperatureSensor(install: RehauInstallation): void {
    const installId = install.unique;
    const installName = install.name;
    
    // MQTT Discovery for outside temperature sensor
    const config = {
      name: 'Outside Temperature',
      unique_id: `rehau_${installId}_outside_temp`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      state_topic: `homeassistant/sensor/rehau_${installId}_outside_temp/state`,
      device_class: 'temperature',
      unit_of_measurement: '°C',
      value_template: '{{ value }}',
      availability_topic: `homeassistant/sensor/rehau_${installId}_outside_temp/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Publish discovery config
    const discoveryTopic = `homeassistant/sensor/rehau_${installId}_outside_temp/config`;
    this.mqttBridge.publishToHomeAssistant(discoveryTopic, config, { retain: true });
    
    // Publish availability
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${installId}_outside_temp/availability`,
      'online',
      { retain: true }
    );
    
    // Publish initial value
    if (install.outside_temp !== undefined) {
      const tempC = this.convertTemp(install.outside_temp);
      if (tempC !== null) {
        this.mqttBridge.publishToHomeAssistant(
          `homeassistant/sensor/rehau_${installId}_outside_temp/state`,
          tempC.toString(),
          { retain: true }
        );
        logger.info(`Published outside temperature: ${tempC}°C`);
      }
    }
  }

  private publishInstallationModeControl(install: RehauInstallation, currentMode: 'heat' | 'cool'): void {
    const installId = install.unique;
    const installName = install.name;
    
    // Create a separate climate entity for installation-wide mode control
    const config = {
      name: 'Mode Control',
      unique_id: `rehau_${installId}_mode_control`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      
      // Mode control only (heat/cool)
      mode_state_topic: `homeassistant/climate/rehau_${installId}/mode`,
      mode_command_topic: `homeassistant/climate/rehau_${installId}/mode_command`,
      modes: ['heat', 'cool'],
      
      // Availability
      availability_topic: `homeassistant/climate/rehau_${installId}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Publish discovery config
    const discoveryTopic = `homeassistant/climate/rehau_${installId}_mode/config`;
    this.mqttBridge.publishToHomeAssistant(discoveryTopic, config, { retain: true });
    
    // Publish initial state
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${installId}/availability`,
      'online',
      { retain: true }
    );
    
    // currentMode is already a string ('heat', 'cool', etc.)
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${installId}/mode`,
      currentMode,
      { retain: true }
    );
    
    logger.info(`Published installation mode control for ${installName}: ${currentMode}`);
  }

  subscribeToCommands(_installId: string): void {
    // Note: Subscription is handled by subscribeToZoneCommands
    // This method is kept for compatibility
  }

  updateInstallationData(install: RehauInstallation): void {
    // Update zones with fresh data from HTTP API
    const installId = install.unique;
    
    // Determine installation mode (same logic as initialization)
    const zones: ExtendedZoneInfo[] = [];
    if (install.groups && install.groups.length > 0) {
      install.groups.forEach(group => {
        if (group.zones && group.zones.length > 0) {
          group.zones.forEach(zone => {
            if (zone.channels && zone.channels.length > 0) {
              zones.push({
                zoneId: zone._id,
                zoneName: zone.name,
                zoneNumber: zone.number,
                groupName: group.name,
                installId: installId,
                installName: install.name,
                channels: zone.channels
              });
            }
          });
        }
      });
    }
    
    const isActivelyCooling = zones.some(z => 
      z.channels && z.channels[0] && 
      (z.channels[0].demand ?? 0) > 0 && 
      z.channels[0].setpoint_c_normal && 
      !z.channels[0].setpoint_h_normal
    );
    
    let systemSupportsCooling = false;
    if (install.coolingConditions) {
      const coolingBits = install.coolingConditions.toString(2).padStart(5, '0');
      systemSupportsCooling = coolingBits[4] === '1';
    }
    
    const installationMode = (systemSupportsCooling && isActivelyCooling) ? 'cool' : 'heat';
    
    // Re-publish outside temperature sensor discovery and state
    this.publishOutsideTemperatureSensor(install);
    if (install.outside_temp !== undefined) {
      const tempC = this.convertTemp(install.outside_temp);
      if (tempC !== null) {
        this.mqttBridge.publishToHomeAssistant(
          `homeassistant/sensor/rehau_${installId}_outside_temp/state`,
          tempC.toString(),
          { retain: true }
        );
      }
    }
    
    // Re-publish installation mode control discovery
    if (zones.length > 0) {
      this.publishInstallationModeControl(install, installationMode);
    }
    
    if (install.groups && install.groups.length > 0) {
      install.groups.forEach(group => {
        if (group.zones && group.zones.length > 0) {
          group.zones.forEach(zone => {
            if (zone.channels && zone.channels.length > 0) {
              const zoneNumber = zone.number;
              const zoneKey = `${installId}_zone_${zoneNumber}`;
              const state = this.installations.get(zoneKey);
              
              if (!state) {
                return;
              }
              
              // Re-publish zone discovery configs to ensure they persist
              const zoneInfo: ZoneInfo = {
                zoneId: zone._id,
                zoneName: zone.name,
                zoneNumber: zone.number,
                installName: install.name
              };
              this.publishDiscoveryConfig(zoneInfo, installId, installationMode);
              this.publishZoneSensors(zoneInfo, installId, install.name);
              
              const channel = zone.channels[0];
              
              // Update all values
              this.updateZoneFromChannel(zoneKey, state, channel, installationMode);
            }
          });
        }
      });
    }
  }

  private updateZoneFromChannel(zoneKey: string, state: ClimateState, channel: RehauChannel, installationMode: 'heat' | 'cool'): void {
    // Current temperature
    if (channel.temp_zone !== undefined) {
      const temp = this.convertTemp(channel.temp_zone);
      if (temp !== null) {
        state.currentTemperature = temp;
        this.publishCurrentTemperature(zoneKey, temp);
      }
    }
    
    // Humidity
    if (channel.humidity !== undefined) {
      state.humidity = channel.humidity;
      this.publishHumidity(zoneKey, channel.humidity);
    }
    
    // Target temperature
    let targetTemp = null;
    if (channel.setpoint_h_normal) {
      targetTemp = channel.setpoint_h_normal;
    } else if (channel.setpoint_c_normal) {
      targetTemp = channel.setpoint_c_normal;
    }
    
    if (targetTemp !== null) {
      const setpoint = channel.setpoint_h_normal || channel.setpoint_c_normal;
      if (setpoint) {
        const targetTemp = this.convertTemp(setpoint);
        if (targetTemp !== null && targetTemp !== state.targetTemperature) {
          state.targetTemperature = targetTemp;
          this.publishTargetTemperature(zoneKey, targetTemp);
        }
      }
    }
    
    // Mode and Preset based on mode_used
    if (channel.mode_used !== undefined) {
      if (channel.mode_used === 2) {
        // OFF - zone is off
        state.mode = 'off';
        state.preset = null;
        this.publishMode(zoneKey, 'off');
        // Don't publish preset when off
      } else {
        // Zone is on - use system mode and set preset
        state.mode = installationMode || state.mode;
        this.publishMode(zoneKey, state.mode);
        
        const presetMap: Record<number, 'comfort' | 'away'> = {
          0: 'comfort',
          1: 'away'
        };
        state.preset = (channel.mode_used in presetMap) ? presetMap[channel.mode_used] : 'comfort';
        if (state.preset) {
          this.publishPreset(zoneKey, state.preset);
        }
      }
    }
  }

  private handleRehauUpdate(topic: string, payload: RehauMQTTMessage): void {
    // Extract installation ID from topic
    // Format: client/{installId}/realtime
    const match = topic.match(/client\/([^/]+)\/realtime/);
    if (!match) {
      return;
    }
    
    const installId = match[1];
    
    // Parse REHAU payload
    // Different message types have different structures:
    // - channel_update: payload.data contains the update
    // - realtime: payload.zones contains zones array
    
    if (payload.type === 'channel_update' && payload.data) {
      // channel_update: payload.data.data contains the actual channel data
      const channelUpdatePayload = payload as { type: string; data: { data: RehauChannel } };
      const channelData = channelUpdatePayload.data.data;
      
      if (channelData) {
        // channel_zone is the zone number (0, 1, 2, 3)
        const zoneNumber = channelData.channel_zone;
        const zoneKey = `${installId}_zone_${zoneNumber}`;
        const state = this.installations.get(zoneKey);
        
        if (!state) {
          return;
        }
        
        // Use the shared update method (installationMode from state)
        this.updateZoneFromChannel(zoneKey, state, channelData, state.installationMode);
      }
    } else if (payload.zones && Array.isArray(payload.zones)) {
      // realtime/realtime.update: zones array
      payload.zones.forEach(zoneData => {
        const zoneNumber = zoneData.number;
        const zoneKey = `${installId}_zone_${zoneNumber}`;
        const state = this.installations.get(zoneKey);
        
        if (!state) {
          return;
        }
        
        if (zoneData.channels && zoneData.channels[0]) {
          const channel = zoneData.channels[0];
          this.updateZoneFromChannel(zoneKey, state, channel, state.installationMode);
          logger.info(`Updated zone ${state.zoneName} from MQTT realtime`);
        }
      });
    }
  }

  private convertTemp(rawValue: number | undefined): number | null {
    // Temperature is stored as Fahrenheit * 10
    // Convert to Celsius: (F - 32) / 1.8
    if (rawValue === undefined || rawValue === null) return null;
    const celsius = ((rawValue / 10 - 32) / 1.8);
    return Math.round(celsius * 10) / 10;
  }

  mapRehauModeFromCode(modeCode: number): string {
    // Map REHAU comfort mode codes to Home Assistant climate modes
    // mode_used: 0=COMFORT, 1=POWER SAVING, 2=OFF, 3=PROGRAM
    const modeMap: Record<number, string> = {
      0: 'heat',  // COMFORT = ON
      1: 'heat',  // POWER SAVING = ON (reduced)
      2: 'off',   // OFF
      3: 'heat'   // PROGRAM = ON (scheduled)
    };
    
    return modeMap[modeCode] || 'heat';
  }
  
  mapRehauMode(rehauMode: string): string {
    // Map REHAU modes to Home Assistant climate modes
    const modeMap: Record<string, string> = {
      'off': 'off',
      'heating': 'heat',
      'cooling': 'cool',
      'auto': 'auto'
    };
    
    return modeMap[rehauMode] || 'off';
  }

  mapRehauAction(rehauAction: string): string {
    // Map REHAU actions to Home Assistant climate actions
    const actionMap: Record<string, string> = {
      'off': 'off',
      'heating': 'heating',
      'cooling': 'cooling',
      'idle': 'idle',
      'fan': 'fan'
    };
    
    return actionMap[rehauAction] || 'idle';
  }

  private publishCurrentTemperature(zoneKey: string, temperature: number): void {
    // Publish to climate entity
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${zoneKey}/current_temperature`,
      temperature.toString(),
      { retain: true }
    );
    
    // Also publish to separate temperature sensor
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneKey}_temperature/state`,
      temperature.toString(),
      { retain: true }
    );
  }

  private publishTargetTemperature(zoneKey: string, temperature: number): void {
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${zoneKey}/target_temperature`,
      temperature.toString(),
      { retain: true }
    );
  }

  private publishMode(zoneKey: string, mode: 'off' | 'heat' | 'cool'): void {
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${zoneKey}/mode`,
      mode,
      { retain: true }
    );
  }

  // publishAction removed - action state not used

  private publishHumidity(zoneKey: string, humidity: number): void {
    // Publish to climate entity
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${zoneKey}/current_humidity`,
      humidity.toString(),
      { retain: true }
    );
    
    // Also publish to separate humidity sensor
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneKey}_humidity/state`,
      humidity.toString(),
      { retain: true }
    );
  }

  private publishPreset(zoneKey: string, preset: 'comfort' | 'away'): void {
    logger.debug(`publishPreset called: zoneKey=${zoneKey}, preset=${preset}`);
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${zoneKey}/preset`,
      preset,
      { retain: true }
    );
  }

  async setTemperature(installId: string, temperature: number): Promise<void> {
    const state = this.installations.get(installId);
    if (!state) {
      throw new Error(`Installation ${installId} not found`);
    }
    
    logger.info(`Setting temperature for ${installId} to ${temperature}°C`);
    
    // Send command to REHAU
    // This depends on the REHAU API/MQTT command structure
    const command = {
      type: 'setTemperature',
      temperature: temperature
    };
    
    this.mqttBridge.publishToRehau(
      `client/${installId}/command`,
      command
    );
    
    // Update local state
    state.targetTemperature = temperature;
    this.publishTargetTemperature(installId, temperature);
  }

  async setMode(installId: string, mode: string): Promise<void> {
    const state = this.installations.get(installId);
    if (!state) {
      throw new Error(`Installation ${installId} not found`);
    }
    
    logger.info(`Setting mode for ${installId} to ${mode}`);
    
    // Map Home Assistant mode to REHAU mode
    const rehauMode = this.mapHomeAssistantMode(mode);
    
    // Send command to REHAU
    const command = {
      type: 'setMode',
      mode: rehauMode
    };
    
    this.mqttBridge.publishToRehau(
      `client/${installId}/command`,
      command
    );
    
    // Update local state
    const validMode = (mode === 'off' || mode === 'heat' || mode === 'cool') ? mode : 'heat';
    state.mode = validMode;
    this.publishMode(installId, validMode);
  }

  mapHomeAssistantMode(haMode: string): string {
    // Map Home Assistant modes to REHAU modes
    const modeMap: Record<string, string> = {
      'off': 'off',
      'heat': 'heating',
      'cool': 'cooling',
      'auto': 'auto'
    };
    
    return modeMap[haMode] || 'off';
  }

  getState(installId: string): ClimateState | undefined {
    return this.installations.get(installId);
  }

  getAllStates(): ClimateState[] {
    return Array.from(this.installations.values());
  }

  private async handleHomeAssistantCommand(command: HACommand): Promise<void> {
    const { installId, zoneNumber, commandType, payload } = command;
    const zoneKey = `${installId}_zone_${zoneNumber}`;
    const state = this.installations.get(zoneKey);
    
    if (!state) {
      logger.warn(`Zone ${zoneKey} not found for command`);
      return;
    }
    
    try {
      if (commandType === 'mode') {
        // Mode command: off => mode_used=2, heat/cool => mode_used=0 (comfort)
        if (payload === 'off') {
          // Set mode_used to 2 (OFF)
          this.sendRehauCommand(installId, state.zoneNumber, state.channelNumber, { "15": 2 });
          logger.info(`Set zone ${state.zoneName} to OFF`);
        } else if (payload === 'heat' || payload === 'cool') {
          // Set mode_used to 0 (COMFORT) when turning on
          this.sendRehauCommand(installId, state.zoneNumber, state.channelNumber, { "15": 0 });
          logger.info(`Set zone ${state.zoneName} to ${payload.toUpperCase()} with COMFORT preset`);
        }
        
      } else if (commandType === 'preset') {
        // Preset command: comfort => mode_used=0, away => mode_used=1, none => mode_used=2 (OFF)
        const presetMap: Record<string, number> = {
          'comfort': 0,
          'away': 1,
          'none': 2
        };
        const modeUsed = payload in presetMap ? presetMap[payload] : undefined;
        
        if (modeUsed !== undefined) {
          this.sendRehauCommand(installId, state.zoneNumber, state.channelNumber, { "15": modeUsed });
          logger.info(`Set zone ${state.zoneName} to preset ${payload} (mode_used=${modeUsed})`);
        }
        
      } else if (commandType === 'temperature') {
        // Temperature command
        const tempCelsius = parseFloat(payload);
        const tempF10 = Math.round((tempCelsius * 10) * 1.8 + 320);
        this.sendRehauCommand(installId, state.zoneNumber, state.channelNumber, { "2": tempF10 });
        logger.info(`Set zone ${state.zoneName} temperature to ${tempCelsius}°C (${tempF10})`);
      }
    } catch (error) {
      logger.error(`Failed to handle command for zone ${state.zoneName}:`, (error as Error).message);
    }
  }

  private sendRehauCommand(installId: string, zoneNumber: number, channelNumber: number | undefined, data: RehauCommandData): void {
    // REQ_TH command format using numeric keys from referentials
    const message = {
      "11": "REQ_TH",  // type
      "12": data,      // data object
      "36": zoneNumber,    // zone
      "35": channelNumber || 0  // controller/channel (default to 0)
    };
    
    const topic = `client/${installId}`;
    this.mqttBridge.publishToRehau(topic, message);
    logger.debug(`Sent REHAU command to zone ${zoneNumber}, channel ${channelNumber}:`, data);
  }

  /**
   * Handle LIVE_EMU data (Mixed Circuits)
   */
  private handleLiveEMU(data: LiveEMUData): void {
    const installId = data.data.unique;
    const installName = this.installationNames.get(installId) || installId;
    const circuits = data.data.data;
    
    logger.info(`Processing LIVE_EMU data for installation ${installName}`);
    
    Object.entries(circuits).forEach(([mcKey, mcData]) => {
      // Skip if circuit is not present (supply temp = 32767 indicates not present)
      if (mcData.mixed_circuit1_supply === 32767) {
        logger.debug(`Skipping ${mcKey} - not present`);
        return;
      }
      
      const mcNumber = mcKey.replace('MC', '');
      const baseTopic = `homeassistant/sensor/rehau_${installId}_${mcKey.toLowerCase()}`;
      
      // Publish pump state (binary sensor)
      this.mqttBridge.publishToHomeAssistant(
        `homeassistant/binary_sensor/rehau_${installId}_${mcKey.toLowerCase()}_pump/config`,
        JSON.stringify({
          name: `Mixed Circuit ${mcNumber} Pump`,
          unique_id: `rehau_${installId}_mc${mcNumber}_pump`,
          state_topic: `${baseTopic}_pump/state`,
          device_class: 'running',
          payload_on: 'ON',
          payload_off: 'OFF',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_pump/state`,
        mcData.pumpOn === 1 ? 'ON' : 'OFF',
        { retain: true }
      );
      
      // Publish setpoint temperature
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_setpoint/config`,
        JSON.stringify({
          name: `Mixed Circuit ${mcNumber} Setpoint`,
          unique_id: `rehau_${installId}_mc${mcNumber}_setpoint`,
          state_topic: `${baseTopic}_setpoint/state`,
          unit_of_measurement: '°C',
          device_class: 'temperature',
          state_class: 'measurement',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_setpoint/state`,
        (mcData.mixed_circuit1_setpoint / 10).toFixed(1),
        { retain: true }
      );
      
      // Publish supply temperature
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_supply/config`,
        JSON.stringify({
          name: `Mixed Circuit ${mcNumber} Supply`,
          unique_id: `rehau_${installId}_mc${mcNumber}_supply`,
          state_topic: `${baseTopic}_supply/state`,
          unit_of_measurement: '°C',
          device_class: 'temperature',
          state_class: 'measurement',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_supply/state`,
        (mcData.mixed_circuit1_supply / 10).toFixed(1),
        { retain: true }
      );
      
      // Publish return temperature
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_return/config`,
        JSON.stringify({
          name: `Mixed Circuit ${mcNumber} Return`,
          unique_id: `rehau_${installId}_mc${mcNumber}_return`,
          state_topic: `${baseTopic}_return/state`,
          unit_of_measurement: '°C',
          device_class: 'temperature',
          state_class: 'measurement',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_return/state`,
        (mcData.mixed_circuit1_return / 10).toFixed(1),
        { retain: true }
      );
      
      // Publish valve opening percentage
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_opening/config`,
        JSON.stringify({
          name: `Mixed Circuit ${mcNumber} Opening`,
          unique_id: `rehau_${installId}_mc${mcNumber}_opening`,
          state_topic: `${baseTopic}_opening/state`,
          unit_of_measurement: '%',
          icon: 'mdi:valve',
          state_class: 'measurement',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      this.mqttBridge.publishToHomeAssistant(
        `${baseTopic}_opening/state`,
        mcData.mixed_circuit1_opening.toString(),
        { retain: true }
      );
      
      logger.debug(`Published ${mcKey} sensors: pump=${mcData.pumpOn}, setpoint=${mcData.mixed_circuit1_setpoint/10}°C`);
    });
  }

  /**
   * Handle LIVE_DIDO data (Digital Inputs/Outputs)
   */
  private handleLiveDIDO(data: LiveDIDOData): void {
    const installId = data.data.unique;
    const installName = this.installationNames.get(installId) || installId;
    const controllers = data.data.data;
    
    logger.info(`Processing LIVE_DIDO data for installation ${installName}`);
    
    Object.entries(controllers).forEach(([controllerKey, controllerData]) => {
      const controllerNumber = controllerKey.replace(/\D/g, '');
      
      // Publish Digital Inputs
      controllerData.DI.forEach((state, index) => {
        const baseTopic = `homeassistant/binary_sensor/rehau_${installId}_${controllerKey.toLowerCase()}_di${index}`;
        
        this.mqttBridge.publishToHomeAssistant(
          `${baseTopic}/config`,
          JSON.stringify({
            name: `Controller ${controllerNumber} DI${index}`,
            unique_id: `rehau_${installId}_ctrl${controllerNumber}_di${index}`,
            state_topic: `${baseTopic}/state`,
            payload_on: 'ON',
            payload_off: 'OFF',
            device: {
              identifiers: [`rehau_${installId}`],
              name: `REHAU ${installName}`,
              manufacturer: 'REHAU',
              model: 'NEA SMART 2.0'
            }
          })
        );
        this.mqttBridge.publishToHomeAssistant(
          `${baseTopic}/state`,
          state ? 'ON' : 'OFF',
          { retain: true }
        );
      });
      
      // Publish Digital Outputs
      controllerData.DO.forEach((state, index) => {
        const baseTopic = `homeassistant/binary_sensor/rehau_${installId}_${controllerKey.toLowerCase()}_do${index}`;
        
        this.mqttBridge.publishToHomeAssistant(
          `${baseTopic}/config`,
          JSON.stringify({
            name: `Controller ${controllerNumber} DO${index}`,
            unique_id: `rehau_${installId}_ctrl${controllerNumber}_do${index}`,
            state_topic: `${baseTopic}/state`,
            payload_on: 'ON',
            payload_off: 'OFF',
            device: {
              identifiers: [`rehau_${installId}`],
              name: `REHAU ${installName}`,
              manufacturer: 'REHAU',
              model: 'NEA SMART 2.0'
            }
          })
        );
        this.mqttBridge.publishToHomeAssistant(
          `${baseTopic}/state`,
          state ? 'ON' : 'OFF',
          { retain: true }
        );
      });
      
      logger.debug(`Published ${controllerKey} sensors: ${controllerData.DI.length} DI, ${controllerData.DO.length} DO`);
    });
  }
}

export default ClimateController;
