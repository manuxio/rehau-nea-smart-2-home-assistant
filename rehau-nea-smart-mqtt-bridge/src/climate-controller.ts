import logger, { registerObfuscation } from './logger';
import RehauMQTTBridge from './mqtt-bridge';
import RehauAuthPersistent from './rehau-auth';
import {
  ClimateState,
  HACommand,
  RehauMQTTMessage,
  RehauCommandData,
  LiveEMUData,
  LiveDIDOData
} from './types';
import type { IInstall, IChannel, IZone, IGroup } from './parsers';

interface ExtendedZoneInfo {
  zoneId: string;
  zoneName: string;
  zoneNumber: number;
  channelZone: number;
  controllerNumber: number;
  groupName: string;
  installId: string;
  installName: string;
  channels: IChannel[];
}

// Read configuration
const USE_GROUP_IN_NAMES = process.env.USE_GROUP_IN_NAMES === 'true';

class ClimateController {
  private mqttBridge: RehauMQTTBridge;
  private installations: Map<string, ClimateState>;
  private installationNames: Map<string, string>; // Map installId -> installName
  private installationData: Map<string, IInstall>; // Map installId -> IInstall data
  private channelToZoneKey: Map<string, string>; // Map channelId -> zoneKey for fast lookup

  constructor(mqttBridge: RehauMQTTBridge, _rehauApi: RehauAuthPersistent) {
    this.mqttBridge = mqttBridge;
    this.installations = new Map<string, ClimateState>();
    this.installationNames = new Map<string, string>();
    this.installationData = new Map<string, IInstall>();
    this.channelToZoneKey = new Map<string, string>();
    
    // Listen to REHAU messages and HA commands
    this.mqttBridge.onMessage((topicOrCommand, payload?) => {
      // Check if this is an HA command (single object argument)
      if (typeof topicOrCommand === 'object' && topicOrCommand.type === 'ha_command') {
        this.handleHomeAssistantCommand(topicOrCommand);
      } else if (typeof topicOrCommand === 'object' && (topicOrCommand as any).type === 'ring_light_command') {
        this.handleRingLightCommand((topicOrCommand as any).zoneId, (topicOrCommand as any).payload);
      } else if (typeof topicOrCommand === 'object' && (topicOrCommand as any).type === 'lock_command') {
        this.handleLockCommand((topicOrCommand as any).zoneId, (topicOrCommand as any).payload);
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

  initializeInstallation(install: IInstall): void {
    const installId = install.unique;
    const installName = install.name;
    
    // Store installation name and data for later use
    this.installationNames.set(installId, installName);
    this.installationData.set(installId, install);
    
    // Register installation name for obfuscation
    registerObfuscation('installation', installName);
    
    // Get zones from groups
    const zones: ExtendedZoneInfo[] = [];
    if (install.groups && install.groups.length > 0) {
      install.groups.forEach((group: IGroup) => {
        if (group.zones && group.zones.length > 0) {
          group.zones.forEach((zone: IZone) => {
            if (zone.channels && zone.channels.length > 0) {
              zones.push({
                zoneId: zone.id,
                zoneName: zone.name,
                zoneNumber: zone.number,
                channelZone: zone.channels[0].channelZone,
                controllerNumber: zone.channels[0].controllerNumber ?? 0,
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
      z.channels[0].setpoints.coolingNormal.celsius !== null && 
      z.channels[0].setpoints.heatingNormal.celsius === null
    );
    
    if (systemSupportsCooling && isActivelyCooling) {
      installationMode = 'cool';
    } else {
      installationMode = 'heat'; // Default to heat
    }
    
    // Initialize state for each zone
    zones.forEach(zone => {
      const zoneKey = `${installId}_zone_${zone.zoneId}`;
      
      // Register names for obfuscation
      registerObfuscation('group', zone.groupName);
      registerObfuscation('zone', zone.zoneName);
      
      // Register zone name and group name for better logging
      if (zone.channels && zone.channels[0]) {
        this.mqttBridge.registerZoneName(zone.channels[0].id, zone.zoneName, zone.groupName);
        // Map channel ID to zone key for fast lookup
        this.channelToZoneKey.set(zone.channels[0].id, zoneKey);
      }
      
      // Get initial values from zone data if available
      let currentTemp: number | null = null;
      let targetTemp: number | null = null;
      let humidity: number | null = null;
      let mode: 'off' | 'heat' | 'cool' = 'heat';
      let preset: 'comfort' | 'away' | null = null;  // Default to null
      
      if (zone.channels && zone.channels[0]) {
        const channel = zone.channels[0];
        
        // Current temperature (already converted to Celsius)
        if (channel.currentTemperature.celsius !== null) {
          currentTemp = channel.currentTemperature.celsius;
        }
        
        // Humidity
        if (channel.humidity !== null) {
          humidity = channel.humidity;
        }
        
        // Mode and Preset based on mode
        // mode: 0=COMFORT, 1=REDUCED, 2=STANDBY, 3=OFF
        if (channel.mode === 3 || channel.mode === 2) {
          // OFF or STANDBY - zone is off, no preset
          mode = 'off';
          preset = null;
        } else {
          // Zone is on - use system mode and set preset
          mode = installationMode;
          if (channel.mode === 0) {
            preset = 'comfort'; // COMFORT
          } else if (channel.mode === 1) {
            preset = 'away'; // REDUCED/POWER SAVING
          }
        }
        
        // Get target temperature (already converted to Celsius)
        if (channel.setpointTemperature.celsius !== null) {
          targetTemp = channel.setpointTemperature.celsius;
        }
      }
      
      this.installations.set(zoneKey, {
        id: zoneKey,
        installId: installId,
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        zoneNumber: zone.zoneNumber,
        channelZone: zone.channelZone,
        controllerNumber: zone.controllerNumber,
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
      
      // Publish locked sensor and ring light switch
      this.publishZoneControlEntities(zone, installId, installName);
      
      // Subscribe to command topics for this zone
      this.subscribeToZoneCommands(zone.zoneId);
      
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
    
    // Print MQTT structure tree
    this.printMQTTStructure(install);
  }

  private subscribeToZoneCommands(zoneId: string): void {
    const topics = [
      `homeassistant/climate/rehau_${zoneId}/mode_command`,
      `homeassistant/climate/rehau_${zoneId}/preset_command`,
      `homeassistant/climate/rehau_${zoneId}/temperature_command`
    ];
    
    topics.forEach(topic => {
      this.mqttBridge.subscribeToHomeAssistant(topic);
    });
  }

  private publishDiscoveryConfig(zone: ExtendedZoneInfo, installId: string, systemMode: 'heat' | 'cool'): void {
    const zoneKey = `${installId}_zone_${zone.zoneId}`;
    
    // Sanitize names for IDs (lowercase, replace spaces with underscores)
    const installNameSanitized = zone.installName.toLowerCase().replace(/\s+/g, '_');
    const groupNameSanitized = zone.groupName.toLowerCase().replace(/\s+/g, '_');
    const zoneNameSanitized = zone.zoneName.toLowerCase().replace(/\s+/g, '_');
    
    // object_id always includes group name for entity ID
    const objectId = `rehau_${installNameSanitized}_${groupNameSanitized}_${zoneNameSanitized}`;
    
    // Display name controlled by USE_GROUP_IN_NAMES
    const displayName = USE_GROUP_IN_NAMES && zone.groupName
      ? `${zone.groupName} ${zone.zoneName}`
      : zone.zoneName;
    
    // MQTT Discovery configuration for Home Assistant
    const config = {
      name: displayName,
      object_id: objectId,  // Controls entity_id: climate.rehau_install_group_zone
      unique_id: `rehau_${zone.zoneId}`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${zone.installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      
      // Temperature
      current_temperature_topic: `homeassistant/climate/rehau_${zone.zoneId}/current_temperature`,
      temperature_state_topic: `homeassistant/climate/rehau_${zone.zoneId}/target_temperature`,
      temperature_command_topic: `homeassistant/climate/rehau_${zone.zoneId}/temperature_command`,
      
      // Humidity
      current_humidity_topic: `homeassistant/climate/rehau_${zone.zoneId}/current_humidity`,
      
      // Mode (off + system mode)
      mode_state_topic: `homeassistant/climate/rehau_${zone.zoneId}/mode`,
      mode_command_topic: `homeassistant/climate/rehau_${zone.zoneId}/mode_command`,
      modes: ['off', systemMode], // OFF + current system mode (heat or cool)
      
      // Preset modes: Comfort(0), Away(1) - OFF(2) is handled by mode
      preset_mode_state_topic: `homeassistant/climate/rehau_${zone.zoneId}/preset`,
      preset_mode_command_topic: `homeassistant/climate/rehau_${zone.zoneId}/preset_command`,
      preset_modes: ['comfort', 'away'], // comfort=Comfort, away=Power Saving
      
      // Availability
      availability_topic: `homeassistant/climate/rehau_${zone.zoneId}/availability`,
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
    
    // Publish discovery config (using unique zone ID to avoid collisions)
    const discoveryTopic = `homeassistant/climate/rehau_${zone.zoneId}/config`;
    this.mqttBridge.publishToHomeAssistant(discoveryTopic, config, { retain: true });
    
    // Log the full config for debugging
    logger.debug(`Discovery config for ${displayName}:`);
    logger.debug(`Topic: ${discoveryTopic}`);
    logger.debug(`Config: ${JSON.stringify(config, null, 2)}`);
    
    // Publish initial availability
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/climate/rehau_${zone.zoneId}/availability`,
      'online',
      { retain: true }
    );
    
    // Subscribe to command topics
    this.subscribeToCommands(zoneKey);
    
    logger.info(`Published discovery config for ${zone.installName} - ${displayName}`);
  }

  private publishZoneSensors(zone: ExtendedZoneInfo, installId: string, installName: string): void {
    const zoneName = zone.zoneName;
    const zoneId = zone.zoneId;
    const groupName = zone.groupName;
    
    // Sanitize names for IDs (lowercase, replace spaces with underscores)
    const groupNameSanitized = groupName.toLowerCase().replace(/\s+/g, '_');
    const zoneNameSanitized = zoneName.toLowerCase().replace(/\s+/g, '_');
    
    // object_id always includes group name for entity ID
    const objectIdBase = `rehau_${groupNameSanitized}_${zoneNameSanitized}`;
    
    // Display name controlled by USE_GROUP_IN_NAMES
    const displayName = USE_GROUP_IN_NAMES && groupName
      ? `${groupName} - ${zoneName}`
      : zoneName;
    
    // Temperature sensor
    const tempConfig = {
      name: `${displayName} Temperature`,
      object_id: `${objectIdBase}_temperature`,  // Controls entity_id: sensor.rehau_group_zone_temperature
      unique_id: `rehau_${zoneId}_temperature`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      state_topic: `homeassistant/sensor/rehau_${zoneId}_temperature/state`,
      device_class: 'temperature',
      unit_of_measurement: '°C',
      value_template: '{{ value }}',
      availability_topic: `homeassistant/sensor/rehau_${zoneId}_temperature/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Humidity sensor
    const humidityConfig = {
      name: `${displayName} Humidity`,
      object_id: `${objectIdBase}_humidity`,  // Controls entity_id: sensor.rehau_group_zone_humidity
      unique_id: `rehau_${zoneId}_humidity`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      state_topic: `homeassistant/sensor/rehau_${zoneId}_humidity/state`,
      device_class: 'humidity',
      unit_of_measurement: '%',
      value_template: '{{ value }}',
      availability_topic: `homeassistant/sensor/rehau_${zoneId}_humidity/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Publish temperature sensor discovery (using zone ID in topic)
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_temperature/config`,
      tempConfig,
      { retain: true }
    );
    
    // Publish humidity sensor discovery (using zone ID in topic)
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_humidity/config`,
      humidityConfig,
      { retain: true }
    );
    
    // Publish availability
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_temperature/availability`,
      'online',
      { retain: true }
    );
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_humidity/availability`,
      'online',
      { retain: true }
    );
  }

  private publishZoneControlEntities(zone: ExtendedZoneInfo, installId: string, installName: string): void {
    const zoneName = zone.zoneName;
    const zoneId = zone.zoneId;
    const groupName = zone.groupName;
    const channel = zone.channels[0]; // Get first channel for config data
    
    if (!channel) return;
    
    // Sanitize names for IDs
    const groupNameSanitized = groupName.toLowerCase().replace(/\s+/g, '_');
    const zoneNameSanitized = zoneName.toLowerCase().replace(/\s+/g, '_');
    
    // object_id always includes group name
    const objectIdBase = `rehau_${groupNameSanitized}_${zoneNameSanitized}`;
    
    // Display name controlled by USE_GROUP_IN_NAMES
    const displayName = USE_GROUP_IN_NAMES && groupName
      ? `${groupName} - ${zoneName}`
      : zoneName;
    
    // 1. Lock (controllable)
    const lockConfig = {
      name: `${displayName} Lock`,
      object_id: `${objectIdBase}_lock`,
      unique_id: `rehau_${zoneId}_lock`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      state_topic: `homeassistant/lock/rehau_${zoneId}_lock/state`,
      command_topic: `homeassistant/lock/rehau_${zoneId}_lock/command`,
      state_locked: 'LOCKED',
      state_unlocked: 'UNLOCKED',
      payload_lock: 'LOCK',
      payload_unlock: 'UNLOCK',
      availability_topic: `homeassistant/lock/rehau_${zoneId}_lock/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
      optimistic: true
    };
    
    // 2. Ring Light
    const ringLightConfig = {
      name: `${displayName} Ring Light`,
      object_id: `${objectIdBase}_ring_light`,
      unique_id: `rehau_${zoneId}_ring_light`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: '1.0.0'
      },
      state_topic: `homeassistant/light/rehau_${zoneId}_ring_light/state`,
      command_topic: `homeassistant/light/rehau_${zoneId}_ring_light/command`,
      payload_on: 'ON',
      payload_off: 'OFF',
      availability_topic: `homeassistant/light/rehau_${zoneId}_ring_light/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
      optimistic: true,
      icon: 'mdi:lightbulb'
    };
    
    // Publish discovery configs
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/lock/rehau_${zoneId}_lock/config`,
      lockConfig,
      { retain: true }
    );
    
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/light/rehau_${zoneId}_ring_light/config`,
      ringLightConfig,
      { retain: true }
    );
    
    // Publish availability
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/lock/rehau_${zoneId}_lock/availability`,
      'online',
      { retain: true }
    );
    
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/light/rehau_${zoneId}_ring_light/availability`,
      'online',
      { retain: true }
    );
    
    // Publish initial states
    const lockState = channel.config.locked ? 'LOCKED' : 'UNLOCKED';
    const ringLightState = channel.config.ringActivation ? 'ON' : 'OFF';
    
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/lock/rehau_${zoneId}_lock/state`,
      lockState,
      { retain: true }
    );
    
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/light/rehau_${zoneId}_ring_light/state`,
      ringLightState,
      { retain: true }
    );
    
    // Subscribe to commands
    this.mqttBridge.subscribeToHomeAssistant(
      `homeassistant/lock/rehau_${zoneId}_lock/command`
    );
    this.mqttBridge.subscribeToHomeAssistant(
      `homeassistant/light/rehau_${zoneId}_ring_light/command`
    );
  }

  private publishOutsideTemperatureSensor(install: IInstall): void {
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
    
    // Publish initial value (already converted to Celsius)
    if (install.outsideTemperature.celsius !== null) {
      const tempC = install.outsideTemperature.celsius;
      this.mqttBridge.publishToHomeAssistant(
        `homeassistant/sensor/rehau_${installId}_outside_temp/state`,
        tempC.toString(),
        { retain: true }
      );
      logger.info(`Published outside temperature: ${tempC}°C`);
    }
  }

  private publishInstallationModeControl(install: IInstall, currentMode: 'heat' | 'cool'): void {
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

  updateInstallationData(install: IInstall): void {
    // Update zones with fresh data from HTTP API
    const installId = install.unique;
    
    logger.info(`🌐 HTTPS Update received for installation: ${install.name}`);
    
    // Get zones from groups
    if (install.groups && install.groups.length > 0) {
      install.groups.forEach((group: IGroup) => {
        if (group.zones && group.zones.length > 0) {
          group.zones.forEach((zone: IZone) => {
            if (zone.channels && zone.channels.length > 0) {
              const zoneInfo: ExtendedZoneInfo = {
                zoneId: zone.id,
                zoneName: zone.name,
                zoneNumber: zone.number,
                channelZone: zone.channels[0].channelZone,
                controllerNumber: zone.channels[0].controllerNumber ?? 0,
                groupName: group.name,
                installId: installId,
                installName: install.name,
                channels: zone.channels
              };
              this.publishDiscoveryConfig(zoneInfo, installId, 'heat');
              this.publishZoneSensors(zoneInfo, installId, install.name);
            }
          });
        }
      });
    }
    
    // Determine installation mode (same logic as initialization)
    const zones: ExtendedZoneInfo[] = [];
    if (install.groups && install.groups.length > 0) {
      install.groups.forEach((group: IGroup) => {
        if (group.zones && group.zones.length > 0) {
          group.zones.forEach((zone: IZone) => {
            if (zone.channels && zone.channels.length > 0) {
              zones.push({
                zoneId: zone.id,
                zoneName: zone.name,
                zoneNumber: zone.number,
                channelZone: zone.channels[0].channelZone,
                controllerNumber: zone.channels[0].controllerNumber ?? 0,
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
      z.channels[0].setpoints.coolingNormal.celsius !== null && 
      z.channels[0].setpoints.heatingNormal.celsius === null
    );
    
    let systemSupportsCooling = false;
    if (install.coolingConditions) {
      const coolingBits = install.coolingConditions.toString(2).padStart(5, '0');
      systemSupportsCooling = coolingBits[4] === '1';
    }
    
    const installationMode = (systemSupportsCooling && isActivelyCooling) ? 'cool' : 'heat';
    
    // Re-publish outside temperature sensor discovery and state
    this.publishOutsideTemperatureSensor(install);
    if (install.outsideTemperature.celsius !== null) {
      const tempC = install.outsideTemperature.celsius;
      this.mqttBridge.publishToHomeAssistant(
        `homeassistant/sensor/rehau_${installId}_outside_temp/state`,
        tempC.toString(),
        { retain: true }
      );
    }
    
    // Re-publish installation mode control discovery
    if (zones.length > 0) {
      this.publishInstallationModeControl(install, installationMode);
    }
    
    if (install.groups && install.groups.length > 0) {
      install.groups.forEach((group: IGroup) => {
        if (group.zones && group.zones.length > 0) {
          group.zones.forEach((zone: IZone) => {
            if (zone.channels && zone.channels.length > 0) {
              const zoneId = zone.id;
              const zoneKey = `${installId}_zone_${zoneId}`;
              const state = this.installations.get(zoneKey);
              
              if (!state) {
                return;
              }
              
              // Re-publish zone discovery configs to ensure they persist
              const zoneInfo: ExtendedZoneInfo = {
                zoneId: zone.id,
                zoneName: zone.name,
                zoneNumber: zone.number,
                channelZone: zone.channels[0].channelZone,
                controllerNumber: zone.channels[0].controllerNumber ?? 0,
                groupName: group.name,
                installId: installId,
                installName: install.name,
                channels: zone.channels
              };
              this.publishDiscoveryConfig(zoneInfo, installId, installationMode);
              this.publishZoneSensors(zoneInfo, installId, install.name);
              
              const channel = zone.channels[0];
              
              logger.info(`🌐 HTTPS Update:`);
              logger.info(`   Group: ${group.name}`);
              logger.info(`   Zone: ${zone.name}`);
              logger.info(`   Processing channel data...`);
              
              // Update all values
              this.updateZoneFromChannel(zoneKey, state, channel, installationMode);
            }
          });
        }
      });
    }
    
    // Print MQTT structure tree after update
    this.printMQTTStructure(install);
  }

  private printMQTTStructure(install: IInstall): void {
    const installId = install.unique;
    const installName = install.name;
    
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('📊 Home Assistant MQTT Discovery Structure');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('');
    
    // Get all zones for this installation
    const zones: Array<{ zoneNumber: number; zoneName: string; groupName: string; state: ClimateState }> = [];
    this.installations.forEach((state) => {
      if (state.installId === installId) {
        // Find zone info from install data
        let groupName = '';
        if (install.groups) {
          for (const group of install.groups) {
            const zone = group.zones.find(z => z.number === state.zoneNumber);
            if (zone) {
              groupName = group.name;
              break;
            }
          }
        }
        zones.push({
          zoneNumber: state.zoneNumber,
          zoneName: state.zoneName,
          groupName: groupName,
          state: state
        });
      }
    });
    
    // Sort zones by number
    zones.sort((a, b) => a.zoneNumber - b.zoneNumber);
    
    // Count entities
    const climateCount = zones.length + 1; // zones + mode control
    const sensorCount = zones.length * 2 + 1; // temp + humidity per zone + outside temp
    const totalCount = climateCount + sensorCount;
    
    logger.info(`Installation: ${installName} (${installId})`);
    logger.info(`Total Entities: ${totalCount} (${climateCount} climate + ${sensorCount} sensors)`);
    logger.info(`USE_GROUP_IN_NAMES: ${USE_GROUP_IN_NAMES}`);
    logger.info('');
    logger.info('homeassistant/');
    logger.info('│');
    
    // Climate entities
    logger.info('├─ climate/                                    [Climate Entities]');
    zones.forEach((zone, idx) => {
      const isLast = idx === zones.length;
      const prefix = isLast ? '│  └─' : '│  ├─';
      
      // Sanitize names for object_id
      const installNameSanitized = installName.toLowerCase().replace(/\s+/g, '_');
      const groupNameSanitized = zone.groupName.toLowerCase().replace(/\s+/g, '_');
      const zoneNameSanitized = zone.zoneName.toLowerCase().replace(/\s+/g, '_');
      
      // object_id always includes group name
      const objectId = `rehau_${installNameSanitized}_${groupNameSanitized}_${zoneNameSanitized}`;
      
      // Display name controlled by USE_GROUP_IN_NAMES
      const displayName = USE_GROUP_IN_NAMES && zone.groupName 
        ? `${zone.groupName} ${zone.zoneName}` 
        : zone.zoneName;
      
      logger.info(`${prefix} rehau_${zone.state.zoneId}/`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ config                               → "${displayName}"`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ object_id                            → "${objectId}"`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ availability                         → "online"`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ current_temperature                  → ${zone.state.currentTemperature?.toFixed(1) ?? 'N/A'}°C`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ target_temperature                   → ${zone.state.targetTemperature?.toFixed(1) ?? 'N/A'}°C`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ current_humidity                     → ${zone.state.humidity ?? 'N/A'}%`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ mode                                 → "${zone.state.mode}"`);
      if (zone.state.preset) {
        logger.info(`${isLast ? '│     ' : '│  │  '}├─ preset                               → "${zone.state.preset}"`);
      }
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ mode_command                         ← [subscribed]`);
      logger.info(`${isLast ? '│     ' : '│  │  '}├─ preset_command                       ← [subscribed]`);
      logger.info(`${isLast ? '│     ' : '│  │  '}└─ temperature_command                  ← [subscribed]`);
    });
    
    // Installation mode control
    logger.info('│  │');
    logger.info(`│  └─ rehau_${installId}_mode_control/`);
    logger.info('│     ├─ config                               → "Mode Control"');
    logger.info('│     ├─ availability                         → "online"');
    logger.info('│     ├─ mode_command                         ← [subscribed]');
    logger.info('│     └─ temperature_command                  ← [subscribed]');
    logger.info('│');
    
    // Sensor entities
    logger.info('└─ sensor/                                     [Sensor Entities]');
    zones.forEach((zone, idx) => {
      const isLast = idx === zones.length - 1;
      const prefix = isLast ? '   └─' : '   ├─';
      const groupNameSanitized = zone.groupName.toLowerCase().replace(/\s+/g, '_');
      const zoneNameSanitized = zone.zoneName.toLowerCase().replace(/\s+/g, '_');
      
      // Display name controlled by USE_GROUP_IN_NAMES
      const displayName = USE_GROUP_IN_NAMES && zone.groupName
        ? `${zone.groupName} - ${zone.zoneName}`
        : zone.zoneName;
      
      // object_id always includes group name
      const objectIdBase = `rehau_${groupNameSanitized}_${zoneNameSanitized}`;
      
      // Temperature sensor
      logger.info(`${prefix} rehau_${zone.state.zoneId}_temperature/`);
      logger.info(`   │  ├─ config                               → "${displayName} Temperature"`);
      logger.info(`   │  ├─ object_id                            → "${objectIdBase}_temperature"`);
      logger.info(`   │  ├─ availability                         → "online"`);
      logger.info(`   │  └─ state                                → ${zone.state.currentTemperature?.toFixed(1) ?? 'N/A'}°C`);
      
      // Humidity sensor
      logger.info(`   │`);
      logger.info(`   ├─ rehau_${zone.state.zoneId}_humidity/`);
      logger.info(`   │  ├─ config                               → "${displayName} Humidity"`);
      logger.info(`   │  ├─ object_id                            → "${objectIdBase}_humidity"`);
      logger.info(`   │  ├─ availability                         → "online"`);
      logger.info(`   │  └─ state                                → ${zone.state.humidity ?? 'N/A'}%`);
      
      if (!isLast) {
        logger.info('   │');
      }
    });
    
    // Outside temperature sensor
    logger.info('   │');
    logger.info(`   └─ rehau_${installId}_outside_temp/`);
    logger.info('      ├─ config                               → "Outside Temperature"');
    logger.info('      ├─ availability                         → "online"');
    logger.info(`      └─ state                                → ${install.outsideTemperature.celsius?.toFixed(1) ?? 'N/A'}°C`);
    
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('');
  }

  private updateZoneFromChannel(zoneKey: string, state: ClimateState, channel: IChannel, installationMode: 'heat' | 'cool'): void {
    // Current temperature (already converted to Celsius)
    if (channel.currentTemperature.celsius !== null) {
      const temp = channel.currentTemperature.celsius;
      if (temp !== state.currentTemperature) {
        state.currentTemperature = temp;
        this.publishCurrentTemperature(zoneKey, temp);
      }
    }
    
    // Humidity
    if (channel.humidity !== null) {
      if (channel.humidity !== state.humidity) {
        state.humidity = channel.humidity;
        this.publishHumidity(zoneKey, channel.humidity);
      }
    }
    
    // Target temperature (already converted to Celsius)
    if (channel.setpointTemperature.celsius !== null) {
      const targetTemp = channel.setpointTemperature.celsius;
      if (targetTemp !== state.targetTemperature) {
        state.targetTemperature = targetTemp;
        this.publishTargetTemperature(zoneKey, targetTemp);
      }
    }
    
    // Mode and Preset based on mode
    // mode: 0=COMFORT, 1=REDUCED, 2=STANDBY, 3=OFF
    if (channel.mode !== null) {
      if (channel.mode === 3 || channel.mode === 2) {
        // OFF or STANDBY - zone is off
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
        state.preset = (channel.mode in presetMap) ? presetMap[channel.mode] : 'comfort';
        if (state.preset) {
          this.publishPreset(zoneKey, state.preset);
        }
      }
    }
    
    // Ring light and lock states
    this.publishRingLightState(state.zoneId, channel.config.ringActivation);
    this.publishLockState(state.zoneId, channel.config.locked);
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
      // channel_update: payload.data contains channel ID and data
      const channelUpdatePayload = payload as { type: string; data: { channel: string; data: any } };
      const channelId = channelUpdatePayload.data.channel; // CORRECT: Get channel ID from data.channel
      const channelData = channelUpdatePayload.data.data;
      
      if (channelData && channelId) {
        // Fast lookup: Use channel ID to find zone key
        const zoneKey = this.channelToZoneKey.get(channelId);
        
        if (!zoneKey) {
          logger.warn(`No zone found for channel ID: ${channelId}`);
          return;
        }
        
        const state = this.installations.get(zoneKey);
        
        if (!state) {
          return;
        }
        
        const groupName = this.getGroupNameForZone(installId, state.zoneNumber);
        logger.info(`📨 Processing MQTT channel_update:`);
        logger.info(`   Group: ${groupName}`);
        logger.info(`   Zone: ${state.zoneName}`);
        
        // Handle raw MQTT channel data
        this.updateZoneFromRawChannel(zoneKey, state, channelData, state.installationMode);
      }
    } else if (payload.zones && Array.isArray(payload.zones)) {
      // realtime/realtime.update: zones array
      payload.zones.forEach((zoneData: any) => {
        const zoneId = zoneData.id || zoneData._id;
        const zoneKey = `${installId}_zone_${zoneId}`;
        const state = this.installations.get(zoneKey);
        
        if (!state) {
          return;
        }
        
        if (zoneData.channels && zoneData.channels[0]) {
          const channel = zoneData.channels[0];
          const groupName = this.getGroupNameForZone(installId, state.zoneNumber);
          
          logger.info(`📨 Processing MQTT realtime update:`);
          logger.info(`   Group: ${groupName}`);
          logger.info(`   Zone: ${state.zoneName}`);
          
          this.updateZoneFromRawChannel(zoneKey, state, channel, state.installationMode);
        }
      });
    }
  }

  private updateZoneFromRawChannel(zoneKey: string, state: ClimateState, rawChannel: any, installationMode: 'heat' | 'cool'): void {
    // Handle raw MQTT channel data (not typed IChannel)
    // Current temperature
    if (rawChannel.temp_zone !== undefined) {
      const temp = this.convertTemp(rawChannel.temp_zone);
      if (temp !== null && temp !== state.currentTemperature) {
        state.currentTemperature = temp;
        this.publishCurrentTemperature(zoneKey, temp);
      }
    }
    
    // Humidity
    if (rawChannel.humidity !== undefined && rawChannel.humidity !== state.humidity) {
      state.humidity = rawChannel.humidity;
      this.publishHumidity(zoneKey, rawChannel.humidity);
    }
    
    // Mode and Preset based on mode_used (process BEFORE setpoint)
    if (rawChannel.mode_used !== undefined) {
      if (rawChannel.mode_used === 2 || rawChannel.mode_used === 3) {
        // OFF or STANDBY
        state.mode = 'off';
        state.preset = null;
        this.publishMode(zoneKey, 'off');
      } else {
        // Zone is on
        state.mode = installationMode || state.mode;
        this.publishMode(zoneKey, state.mode);
        
        const presetMap: Record<number, 'comfort' | 'away'> = {
          0: 'comfort',
          1: 'away'
        };
        state.preset = (rawChannel.mode_used in presetMap) ? presetMap[rawChannel.mode_used] : 'comfort';
        if (state.preset) {
          this.publishPreset(zoneKey, state.preset);
        }
      }
    }
    
    // Target temperature (process AFTER mode to know which setpoint to use)
    // Only publish if zone is not off
    if (state.mode !== 'off') {
      // Select correct setpoint based on mode (heat/cool) and preset (comfort/away)
      let setpoint: number | undefined;
      
      if (installationMode === 'heat') {
        // Heating mode: use normal or reduced setpoint based on preset
        setpoint = state.preset === 'away' 
          ? rawChannel.setpoint_h_reduced 
          : rawChannel.setpoint_h_normal;
      } else {
        // Cooling mode: use normal or reduced setpoint based on preset
        setpoint = state.preset === 'away' 
          ? rawChannel.setpoint_c_reduced 
          : rawChannel.setpoint_c_normal;
      }
      
      if (setpoint !== undefined) {
        const targetTemp = this.convertTemp(setpoint);
        if (targetTemp !== null && targetTemp !== state.targetTemperature) {
          state.targetTemperature = targetTemp;
          this.publishTargetTemperature(zoneKey, targetTemp);
        }
      }
    }
    
    // Ring light and lock states from raw channel data
    if (rawChannel.cc_config_bits) {
      const ringActivation = rawChannel.cc_config_bits.ring_activation === true;
      const locked = rawChannel.cc_config_bits.lock === true;
      this.publishRingLightState(state.zoneId, ringActivation);
      this.publishLockState(state.zoneId, locked);
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

  private getGroupNameForZone(installId: string, zoneNumber: number): string {
    // Get group name for a zone from installation data
    const install = this.installationData.get(installId);
    if (!install || !install.groups) {
      return 'Unknown';
    }
    
    for (const group of install.groups) {
      const zone = group.zones.find(z => z.number === zoneNumber);
      if (zone) {
        return group.name;
      }
    }
    
    return 'Unknown';
  }

  private publishCurrentTemperature(zoneKey: string, temperature: number): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    // Get group name from installation data
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    
    const topic1 = `homeassistant/climate/rehau_${state.zoneId}/current_temperature`;
    const topic2 = `homeassistant/sensor/rehau_${state.zoneId}_temperature/state`;
    
    logger.info(`📤 MQTT Publish:`);
    logger.info(`   Topic: ${topic1}`);
    logger.info(`   Group: ${groupName}`);
    logger.info(`   Zone: ${state.zoneName}`);
    logger.info(`   Entity: current_temperature`);
    logger.info(`   Value: ${temperature}°C`);
    
    // Publish to climate entity
    this.mqttBridge.publishToHomeAssistant(
      topic1,
      temperature.toString(),
      { retain: true }
    );
    
    // Also publish to separate temperature sensor (using zone ID)
    this.mqttBridge.publishToHomeAssistant(
      topic2,
      temperature.toString(),
      { retain: true }
    );
  }

  private publishTargetTemperature(zoneKey: string, temperature: number): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/climate/rehau_${state.zoneId}/target_temperature`;
    
    logger.info(`📤 MQTT Publish:`);
    logger.info(`   Topic: ${topic}`);
    logger.info(`   Group: ${groupName}`);
    logger.info(`   Zone: ${state.zoneName}`);
    logger.info(`   Entity: target_temperature`);
    logger.info(`   Value: ${temperature}°C`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      temperature.toString(),
      { retain: true }
    );
  }

  private publishMode(zoneKey: string, mode: 'off' | 'heat' | 'cool'): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/climate/rehau_${state.zoneId}/mode`;
    
    logger.info(`📤 MQTT Publish:`);
    logger.info(`   Topic: ${topic}`);
    logger.info(`   Group: ${groupName}`);
    logger.info(`   Zone: ${state.zoneName}`);
    logger.info(`   Entity: mode`);
    logger.info(`   Value: ${mode}`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      mode,
      { retain: true }
    );
  }

  // publishAction removed - action state not used

  private publishHumidity(zoneKey: string, humidity: number): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic1 = `homeassistant/climate/rehau_${state.zoneId}/current_humidity`;
    const topic2 = `homeassistant/sensor/rehau_${state.zoneId}_humidity/state`;
    
    logger.info(`📤 MQTT Publish:`);
    logger.info(`   Topic: ${topic1}`);
    logger.info(`   Group: ${groupName}`);
    logger.info(`   Zone: ${state.zoneName}`);
    logger.info(`   Entity: humidity`);
    logger.info(`   Value: ${humidity}%`);
    
    // Publish to climate entity
    this.mqttBridge.publishToHomeAssistant(
      topic1,
      humidity.toString(),
      { retain: true }
    );
    
    // Also publish to separate humidity sensor (using zone ID)
    this.mqttBridge.publishToHomeAssistant(
      topic2,
      humidity.toString(),
      { retain: true }
    );
  }

  private publishPreset(zoneKey: string, preset: 'comfort' | 'away'): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/climate/rehau_${state.zoneId}/preset`;
    
    logger.info(`📤 MQTT Publish:`);
    logger.info(`   Topic: ${topic}`);
    logger.info(`   Group: ${groupName}`);
    logger.info(`   Zone: ${state.zoneName}`);
    logger.info(`   Entity: preset`);
    logger.info(`   Value: ${preset}`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      preset,
      { retain: true }
    );
  }

  private publishRingLightState(zoneId: string, ringActivation: boolean): void {
    const state = ringActivation ? 'ON' : 'OFF';
    const topic = `homeassistant/light/rehau_${zoneId}_ring_light/state`;
    
    // Find zone info for logging
    const zoneState = Array.from(this.installations.values()).find(s => s.zoneId === zoneId);
    if (zoneState) {
      const groupName = this.getGroupNameForZone(zoneState.installId, zoneState.zoneNumber);
      logger.info(`📤 MQTT Publish:`);
      logger.info(`   Topic: ${topic}`);
      logger.info(`   Group: ${groupName}`);
      logger.info(`   Zone: ${zoneState.zoneName}`);
      logger.info(`   Entity: ring_light`);
      logger.info(`   Value: ${state}`);
    }
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      state,
      { retain: true }
    );
  }

  private publishLockState(zoneId: string, locked: boolean): void {
    const state = locked ? 'LOCKED' : 'UNLOCKED';
    const topic = `homeassistant/lock/rehau_${zoneId}_lock/state`;
    
    // Find zone info for logging
    const zoneState = Array.from(this.installations.values()).find(s => s.zoneId === zoneId);
    if (zoneState) {
      const groupName = this.getGroupNameForZone(zoneState.installId, zoneState.zoneNumber);
      logger.info(`📤 MQTT Publish:`);
      logger.info(`   Topic: ${topic}`);
      logger.info(`   Group: ${groupName}`);
      logger.info(`   Zone: ${zoneState.zoneName}`);
      logger.info(`   Entity: lock`);
      logger.info(`   Value: ${state}`);
    }
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      state,
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

  private handleRingLightCommand(zoneId: string, payload: string): void {
    // Find the zone by zoneId
    let foundState: ClimateState | undefined;
    let foundKey: string | undefined;
    
    for (const [key, state] of this.installations.entries()) {
      if (state.zoneId === zoneId) {
        foundState = state;
        foundKey = key;
        break;
      }
    }
    
    if (!foundState || !foundKey) {
      logger.warn(`Zone with ID ${zoneId} not found for ring light command`);
      return;
    }
    
    try {
      // Get referentials to use proper key for ring light
      const referentials = this.mqttBridge.getReferentials();
      const ringFunctionKey = referentials?.['ring_function'] || '34'; // Fallback to "34" if referentials not loaded
      
      // Ring light: 1 = ON, 0 = OFF
      const ringLightValue = payload === 'ON' ? 1 : 0;
      const commandData = { [ringFunctionKey]: ringLightValue };
      
      this.sendRehauCommand(foundState.installId, foundState.channelZone, foundState.controllerNumber, commandData);
      
      logger.info(`Set zone ${foundState.zoneName} ring light to ${payload}`);
      logger.info(`Full command data: ${JSON.stringify(commandData)}`);
    } catch (error) {
      logger.error(`Failed to handle ring light command for zone ${foundState.zoneName}:`, (error as Error).message);
    }
  }

  private handleLockCommand(zoneId: string, payload: string): void {
    // Find the zone by zoneId
    let foundState: ClimateState | undefined;
    let foundKey: string | undefined;
    
    for (const [key, state] of this.installations.entries()) {
      if (state.zoneId === zoneId) {
        foundState = state;
        foundKey = key;
        break;
      }
    }
    
    if (!foundState || !foundKey) {
      logger.warn(`Zone with ID ${zoneId} not found for lock command`);
      return;
    }
    
    try {
      // Get referentials to use proper key for lock
      const referentials = this.mqttBridge.getReferentials();
      const locActivationKey = referentials?.['loc_activation'] || '31'; // Fallback to "31" if referentials not loaded
      
      // Lock: 1 = LOCKED, 0 = UNLOCKED
      const lockValue = payload === 'LOCK' ? true : false;
      const commandData = { [locActivationKey]: lockValue };
      
      this.sendRehauCommand(foundState.installId, foundState.channelZone, foundState.controllerNumber, commandData);
      
      logger.info(`Set zone ${foundState.zoneName} lock to ${payload}`);
      logger.info(`Full command data: ${JSON.stringify(commandData)}`);
    } catch (error) {
      logger.error(`Failed to handle lock command for zone ${foundState.zoneName}:`, (error as Error).message);
    }
  }

  private async handleHomeAssistantCommand(command: HACommand): Promise<void> {
    const { zoneNumber, commandType, payload } = command;
    // The zoneNumber in HACommand is actually the zoneId from the MQTT topic
    const zoneId = zoneNumber;
    
    logger.debug(`🔍 Looking up zone ${zoneId} for ${commandType} command`);
    logger.debug(`   Total zones in map: ${this.installations.size}`);
    
    // Find the state by zoneId (search through all installations)
    let state: ClimateState | undefined;
    let zoneKey: string | undefined;
    
    for (const [key, s] of this.installations.entries()) {
      logger.debug(`   Checking ${key}: zoneId=${s.zoneId}, zoneName=${s.zoneName}`);
      if (s.zoneId === zoneId) {
        state = s;
        zoneKey = key;
        logger.debug(`   ✅ MATCH FOUND: ${s.zoneName} (channelZone=${s.channelZone}, controller=${s.controllerNumber})`);
        break;
      }
    }
    
    if (!state || !zoneKey) {
      logger.warn(`Zone ${zoneId} not found for command`);
      logger.warn(`Available zones:`);
      for (const [key, s] of this.installations.entries()) {
        logger.warn(`  - ${key}: ${s.zoneName} (zoneId=${s.zoneId})`);
      }
      return;
    }
    
    const installId = state.installId;
    
    try {
      if (commandType === 'mode') {
        // Mode command: off => mode_used=2, heat/cool => mode_used=0 (comfort)
        if (payload === 'off') {
          // Set mode_used to 2 (OFF)
          this.sendRehauCommand(installId, state.channelZone, state.controllerNumber, { "15": 2 });
          logger.info(`Set zone ${state.zoneName} to OFF`);
        } else if (payload === 'heat' || payload === 'cool') {
          // Set mode_used to 0 (COMFORT) when turning on
          this.sendRehauCommand(installId, state.channelZone, state.controllerNumber, { "15": 0 });
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
          this.sendRehauCommand(installId, state.channelZone, state.controllerNumber, { "15": modeUsed });
          logger.info(`Set zone ${state.zoneName} to preset ${payload} (mode_used=${modeUsed})`);
        }
        
      } else if (commandType === 'temperature') {
        // Temperature command
        const tempCelsius = parseFloat(payload);
        const tempF10 = Math.round((tempCelsius * 10) * 1.8 + 320);
        logger.info(`Command: temperature = ${tempCelsius} for zone ${zoneId}`);
        logger.info(`  Zone name: ${state.zoneName} (zoneNumber=${state.zoneNumber})`);
        logger.info(`  Routing: channelZone=${state.channelZone}, controller=${state.controllerNumber}`);
        this.sendRehauCommand(installId, state.channelZone, state.controllerNumber, { "2": tempF10 });
        logger.info(`Set zone ${state.zoneName} temperature to ${tempCelsius}°C (${tempF10})`);
      } else if (commandType === 'ring_light') {
        // Get referentials to use proper key for ring light
        const referentials = this.mqttBridge.getReferentials();
        const ringFunctionKey = referentials?.['ring_function'] || '34'; // Fallback to "34" if referentials not loaded
        
        // Ring light command: 1 = ON, 0 = OFF
        const ringLightValue = payload === 'ON' ? 1 : 0;
        const commandData = { [ringFunctionKey]: ringLightValue };
        
        this.sendRehauCommand(installId, state.channelZone, state.controllerNumber, commandData);
        
        logger.info(`Set zone ${state.zoneName} ring light to ${payload}`);
        logger.info(`Full command data: ${JSON.stringify(commandData)}`);
      }
    } catch (error) {
      logger.error(`Failed to handle command for zone ${state.zoneName}:`, (error as Error).message);
    }
  }

  /**
   * Convert a REHAU message with numeric keys to textual keys using referentials
   */
  private convertMessageToTextualKeys(message: any): any {
    const referentials = this.mqttBridge.getReferentials();
    if (!referentials) {
      return message; // Return as-is if referentials not loaded
    }

    const converted: any = {};
    
    for (const [key, value] of Object.entries(message)) {
      // Get textual key from referentials
      const textualKey = referentials[key] || key;
      
      // If value is an object, recursively convert it
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        converted[textualKey] = this.convertMessageToTextualKeys(value);
      } else {
        converted[textualKey] = value;
      }
    }
    
    return converted;
  }

  private sendRehauCommand(installId: string, channelZone: number, controllerNumber: number, data: RehauCommandData): void {
    // REQ_TH command format using numeric keys from referentials
    const message = {
      "11": "REQ_TH",  // type
      "12": data,      // data object
      "36": channelZone,    // zone (channel zone number)
      "35": controllerNumber  // controller number
    };
    
    const topic = `client/${installId}`;
    this.mqttBridge.publishToRehau(topic, message);
    
    // Log with textual keys for readability
    const textualMessage = this.convertMessageToTextualKeys(message);
    logger.info(`Command sent to channelZone ${channelZone}, controller ${controllerNumber}:`, textualMessage);
    logger.debug(`Sent REHAU command to channelZone ${channelZone}, controller ${controllerNumber}:`, data);
    logger.debug(`Full MQTT message: ${JSON.stringify(message)}`);
  }

  /**
   * Handle LIVE_EMU data (Mixed Circuits)
   */
  private handleLiveEMU(data: LiveEMUData): void {
    const installId = data.data.unique;
    const installName = this.installationNames.get(installId) || installId;
    const circuits = data.data.data;
    
    logger.info(`🔌 LIVE_EMU Data Received:`);
    logger.info(`   Installation: ${installName}`);
    logger.info(`   Circuits: ${Object.keys(circuits).length}`);
    
    Object.entries(circuits).forEach(([mcKey, mcData]) => {
      // Skip if circuit is not present (supply temp = 32767 indicates not present)
      if (mcData.mixed_circuit1_supply === 32767) {
        logger.debug(`Skipping ${mcKey} - not present`);
        return;
      }
      
      const setpointC = this.convertTemp(mcData.mixed_circuit1_setpoint);
      const supplyC = this.convertTemp(mcData.mixed_circuit1_supply);
      const returnC = this.convertTemp(mcData.mixed_circuit1_return);
      const opening = mcData.mixed_circuit1_opening;
      const pumpState = mcData.pumpOn === 1 ? 'ON' : 'OFF';
      
      logger.info(`🔌 ${mcKey} Data:`);
      logger.info(`   Pump: ${pumpState}`);
      logger.info(`   Setpoint: ${setpointC}°C`);
      logger.info(`   Supply: ${supplyC}°C`);
      logger.info(`   Return: ${returnC}°C`);
      logger.info(`   Valve Opening: ${opening}%`);
      
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
          entity_category: 'diagnostic',
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
          entity_category: 'diagnostic',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      if (setpointC !== null) {
        this.mqttBridge.publishToHomeAssistant(
          `${baseTopic}_setpoint/state`,
          setpointC.toString(),
          { retain: true }
        );
      }
      
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
          entity_category: 'diagnostic',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      if (supplyC !== null) {
        this.mqttBridge.publishToHomeAssistant(
          `${baseTopic}_supply/state`,
          supplyC.toString(),
          { retain: true }
        );
      }
      
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
          entity_category: 'diagnostic',
          device: {
            identifiers: [`rehau_${installId}`],
            name: `REHAU ${installName}`,
            manufacturer: 'REHAU',
            model: 'NEA SMART 2.0'
          }
        })
      );
      if (returnC !== null) {
        this.mqttBridge.publishToHomeAssistant(
          `${baseTopic}_return/state`,
          returnC.toString(),
          { retain: true }
        );
      }
      
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
          entity_category: 'diagnostic',
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
      
      logger.info(`📤 Published ${mcKey} to HA:`);
      logger.info(`   Topics: pump, setpoint, supply, return, opening`);
      logger.info(`   Base: ${baseTopic}`);
    });
  }

  /**
   * Handle LIVE_DIDO data (Digital Inputs/Outputs)
   */
  private handleLiveDIDO(data: LiveDIDOData): void {
    const installId = data.data.unique;
    const installName = this.installationNames.get(installId) || installId;
    const controllers = data.data.data;
    
    logger.info(`🔌 LIVE_DIDO Data Received:`);
    logger.info(`   Installation: ${installName}`);
    logger.info(`   Controllers: ${Object.keys(controllers).length}`);
    
    Object.entries(controllers).forEach(([controllerKey, controllerData]) => {
      const controllerNumber = controllerKey.replace(/\D/g, '');
      const diCount = controllerData.DI?.length || 0;
      const doCount = controllerData.DO?.length || 0;
      
      logger.info(`🔌 ${controllerKey}:`);
      logger.info(`   Digital Inputs: ${diCount}`);
      logger.info(`   Digital Outputs: ${doCount}`);
      
      if (controllerData.DI && controllerData.DI.length > 0) {
        const diStates = controllerData.DI.map((state, idx) => `DI${idx}=${state ? 'ON' : 'OFF'}`).join(', ');
        logger.info(`   DI States: ${diStates}`);
      }
      
      if (controllerData.DO && controllerData.DO.length > 0) {
        const doStates = controllerData.DO.map((state, idx) => `DO${idx}=${state ? 'ON' : 'OFF'}`).join(', ');
        logger.info(`   DO States: ${doStates}`);
      }
      
      // Publish Digital Inputs
      if (controllerData.DI && Array.isArray(controllerData.DI)) {
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
            entity_category: 'diagnostic',
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
      }
      
      // Publish Digital Outputs
      if (controllerData.DO && Array.isArray(controllerData.DO)) {
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
            entity_category: 'diagnostic',
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
      }
      
      logger.info(`📤 Published ${controllerKey} to HA:`);
      logger.info(`   Topics: ${diCount} DI + ${doCount} DO binary sensors`);
      logger.info(`   Base: homeassistant/binary_sensor/rehau_${installId}_${controllerKey.toLowerCase()}`);
    });
  }
}

export default ClimateController;
