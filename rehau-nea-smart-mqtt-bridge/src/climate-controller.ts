import logger, { registerObfuscation } from './logger';
import RehauMQTTBridge from './mqtt-bridge';
import RehauAuthPersistent from './rehau-auth';
import {
  ClimateState,
  HACommand,
  RehauMQTTMessage,
  RehauCommandData,
  LiveEMUData,
  LiveDIDOData,
  PendingCommand,
  QueuedCommand,
  RawChannelData,
  RawZoneData,
  RingLightCommand,
  LockCommand
} from './types';
import type { IInstall, IChannel, IZone, IGroup } from './parsers';
import packageJson from '../package.json';

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
const COMMAND_RETRY_TIMEOUT = parseInt(process.env.COMMAND_RETRY_TIMEOUT || '30') * 1000; // Default 30 seconds
const COMMAND_MAX_RETRIES = parseInt(process.env.COMMAND_MAX_RETRIES || '3'); // Default 3 retries
const COMMAND_CHECK_INTERVAL = 5000; // Check pending commands every 5 seconds

// Get version from package.json (single source of truth)
const SW_VERSION = packageJson.version;

class ClimateController {
  private mqttBridge: RehauMQTTBridge;
  private installations: Map<string, ClimateState>;
  private installationNames: Map<string, string>; // Map installId -> installName
  private installationData: Map<string, IInstall>; // Map installId -> IInstall data
  private channelToZoneKey: Map<string, string>; // Map channelId -> zoneKey for fast lookup
  private channelZoneToChannelId: Map<number, string>; // Cache channelZone -> channel ID mapping
  
  // Command queue and retry mechanism
  private commandQueue: QueuedCommand[] = [];
  private pendingCommand: PendingCommand | null = null;
  private commandCheckTimer: NodeJS.Timeout | null = null;
  private commandIdCounter: number = 0;
  private autoConfirmTimeout: NodeJS.Timeout | null = null;
  private isCleanedUp: boolean = false;

  constructor(mqttBridge: RehauMQTTBridge, _rehauApi: RehauAuthPersistent) {
    this.mqttBridge = mqttBridge;
    this.installations = new Map<string, ClimateState>();
    this.installationNames = new Map<string, string>();
    this.installationData = new Map<string, IInstall>();
    this.channelToZoneKey = new Map<string, string>();
    this.channelZoneToChannelId = new Map<number, string>(); // Cache channelZone -> channel ID mapping
    
    // Start command retry checker
    this.startCommandRetryChecker();
    
    // Listen to REHAU messages and HA commands
    this.mqttBridge.onMessage((topicOrCommand, payload?) => {
      // Check if this is an HA command (single object argument)
      if (typeof topicOrCommand === 'object' && topicOrCommand !== null && 'type' in topicOrCommand) {
        if (topicOrCommand.type === 'ha_command') {
          this.handleHomeAssistantCommand(topicOrCommand as HACommand);
        } else if (topicOrCommand.type === 'ring_light_command') {
          const cmd = topicOrCommand as unknown as RingLightCommand;
          this.handleRingLightCommand(cmd.zoneId, String(cmd.payload));
        } else if (topicOrCommand.type === 'lock_command') {
          const cmd = topicOrCommand as unknown as LockCommand;
          this.handleLockCommand(cmd.zoneId, String(cmd.payload));
        }
      } else if (typeof topicOrCommand === 'string' && payload) {
        // Check for LIVE data responses
        const msg = payload as RehauMQTTMessage;
        if (msg.type === 'live_data' && 'data' in msg && typeof msg.data === 'object' && msg.data !== null && 'type' in msg.data && msg.data.type === 'LIVE_EMU') {
          this.handleLiveEMU(payload as LiveEMUData);
        } else if (msg.type === 'live_data' && 'data' in msg && typeof msg.data === 'object' && msg.data !== null && 'type' in msg.data && msg.data.type === 'LIVE_DIDO') {
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
        // Cache channelZone -> channel ID mapping for command logging
        this.channelZoneToChannelId.set(zone.channels[0].channelZone, zone.channels[0].id);
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
      if (humidity !== null) {
        this.publishHumidity(zoneKey, humidity);
      }
      
      // Publish demanding sensors
      if (zone.channels && zone.channels[0]) {
        const channel = zone.channels[0];
        this.publishDemanding(zoneKey, channel.demandState);
        if (channel.demand !== null) {
          this.publishDemandingPercent(zoneKey, channel.demand);
        }
        if (channel.dewpoint !== null) {
          this.publishDewpoint(zoneKey, channel.dewpoint);
        }
      }
      
      this.publishMode(zoneKey, mode);
      
      // Handle OFF mode: publish "none" for preset and empty for target_temperature
      if (mode === 'off') {
        this.publishPresetNone(zoneKey);
        this.publishTargetTemperatureNone(zoneKey);
      } else {
        // Only publish actual values when zone is ON
        if (targetTemp !== null) {
          this.publishTargetTemperature(zoneKey, targetTemp);
        }
        if (preset !== null && preset !== undefined) {
          this.publishPreset(zoneKey, preset);
        }
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
    
    // Dump internal memory map for debugging
    this.dumpInternalMemoryMap(installId);
  }

  private dumpInternalMemoryMap(installId: string): void {
    logger.info('\n');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('📊 Internal Memory Map (Command Routing)');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('');
    
    const zones = Array.from(this.installations.values())
      .filter(z => z.installId === installId)
      .sort((a, b) => a.zoneName.localeCompare(b.zoneName));
    
    logger.info(`Total Zones in Memory: ${zones.length}\n`);
    
    zones.forEach((zone, index) => {
      logger.info(`Zone ${index + 1}: ${zone.zoneName}`);
      logger.info(`├─ Zone ID:          ${zone.zoneId}`);
      logger.info(`├─ Zone Number:      ${zone.zoneNumber}`);
      logger.info(`├─ Channel Zone:     ${zone.channelZone} (for commands)`);
      logger.info(`├─ Controller:       ${zone.controllerNumber}`);
      logger.info(`├─ Routing Key:      (channelZone=${zone.channelZone}, controller=${zone.controllerNumber})`);
      logger.info(`└─ Map Key:          ${zone.id}`);
      logger.info('');
    });
    
    // Check for routing conflicts
    const routingMap = new Map<string, string[]>();
    zones.forEach(zone => {
      const key = `${zone.channelZone}_${zone.controllerNumber}`;
      if (!routingMap.has(key)) {
        routingMap.set(key, []);
      }
      routingMap.get(key)!.push(zone.zoneName);
    });
    
    logger.info('Command Routing Table:');
    logger.info('─'.repeat(63));
    
    let hasConflicts = false;
    Array.from(routingMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([key, zoneNames]) => {
        const [channelZone, controller] = key.split('_');
        if (zoneNames.length > 1) {
          hasConflicts = true;
          logger.warn(`❌ (channelZone=${channelZone}, controller=${controller}) → ${zoneNames.join(', ')} [CONFLICT!]`);
        } else {
          logger.info(`✓  (channelZone=${channelZone}, controller=${controller}) → ${zoneNames[0]}`);
        }
      });
    
    if (hasConflicts) {
      logger.warn('⚠️  ROUTING CONFLICTS DETECTED - Commands may be misrouted!');
    } else {
      logger.info('✅ No routing conflicts - All zones have unique routing keys');
    }
    
    // Reverse lookup table: Zone ID -> Routing
    logger.info('─'.repeat(63));
    logger.info('Reverse Lookup Table (ID → Routing):');
    logger.info('─'.repeat(63));
    
    zones.forEach(zone => {
      logger.info(`✓  ${zone.zoneName.padEnd(20)} ${zone.zoneId} → (channelZone=${zone.channelZone}, controller=${zone.controllerNumber})`);
    });
    
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('');
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
        sw_version: SW_VERSION
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
        sw_version: SW_VERSION
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
        sw_version: SW_VERSION
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
    
    // Demanding (binary sensor)
    const demandingConfig = {
      name: `${displayName} Demanding`,
      object_id: `${objectIdBase}_demanding`,
      unique_id: `rehau_${zoneId}_demanding`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: SW_VERSION
      },
      state_topic: `homeassistant/binary_sensor/rehau_${zoneId}_demanding/state`,
      device_class: 'heat',
      payload_on: 'ON',
      payload_off: 'OFF',
      availability_topic: `homeassistant/binary_sensor/rehau_${zoneId}_demanding/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Demanding Percent sensor
    const demandingPercentConfig = {
      name: `${displayName} Demanding Percent`,
      object_id: `${objectIdBase}_demanding_percent`,
      unique_id: `rehau_${zoneId}_demanding_percent`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: SW_VERSION
      },
      state_topic: `homeassistant/sensor/rehau_${zoneId}_demanding_percent/state`,
      unit_of_measurement: '%',
      value_template: '{{ value }}',
      icon: 'mdi:fire',
      availability_topic: `homeassistant/sensor/rehau_${zoneId}_demanding_percent/availability`,
      payload_available: 'online',
      payload_not_available: 'offline'
    };
    
    // Dewpoint sensor
    const dewpointConfig = {
      name: `${displayName} Dewpoint`,
      object_id: `${objectIdBase}_dewpoint`,
      unique_id: `rehau_${zoneId}_dewpoint`,
      device: {
        identifiers: [`rehau_${installId}`],
        name: `REHAU ${installName}`,
        manufacturer: 'REHAU',
        model: 'NEA SMART 2.0',
        sw_version: SW_VERSION
      },
      state_topic: `homeassistant/sensor/rehau_${zoneId}_dewpoint/state`,
      device_class: 'temperature',
      unit_of_measurement: '°C',
      value_template: '{{ value }}',
      availability_topic: `homeassistant/sensor/rehau_${zoneId}_dewpoint/availability`,
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
    
    // Publish demanding binary sensor discovery
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/binary_sensor/rehau_${zoneId}_demanding/config`,
      demandingConfig,
      { retain: true }
    );
    
    // Publish demanding percent sensor discovery
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_demanding_percent/config`,
      demandingPercentConfig,
      { retain: true }
    );
    
    // Publish dewpoint sensor discovery
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_dewpoint/config`,
      dewpointConfig,
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
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/binary_sensor/rehau_${zoneId}_demanding/availability`,
      'online',
      { retain: true }
    );
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_demanding_percent/availability`,
      'online',
      { retain: true }
    );
    this.mqttBridge.publishToHomeAssistant(
      `homeassistant/sensor/rehau_${zoneId}_dewpoint/availability`,
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
        sw_version: SW_VERSION
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
        sw_version: SW_VERSION
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
        sw_version: SW_VERSION
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
        sw_version: SW_VERSION
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
    const sensorCount = zones.length * 5 + 1; // temp + humidity + demanding + demanding_percent + dewpoint per zone + outside temp
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
      
      // Get demanding values from zone channels
      let demandingState = 'N/A';
      let demandingPercent = 'N/A';
      let dewpoint = 'N/A';
      
      // Find the zone in install data to get channel info
      for (const group of install.groups) {
        const zoneData = group.zones.find(z => z.number === zone.zoneNumber);
        if (zoneData && zoneData.channels && zoneData.channels[0]) {
          const channel = zoneData.channels[0];
          demandingState = channel.demandState ? 'ON' : 'OFF';
          demandingPercent = channel.demand !== null ? `${channel.demand}%` : 'N/A';
          dewpoint = channel.dewpoint !== null ? `${channel.dewpoint.toFixed(1)}°C` : 'N/A';
          break;
        }
      }
      
      logger.info(`   │`);
      logger.info(`   ├─ rehau_${zone.state.zoneId}_demanding/             [binary_sensor]`);
      logger.info(`   │  ├─ config                               → "${displayName} Demanding"`);
      logger.info(`   │  ├─ object_id                            → "${objectIdBase}_demanding"`);
      logger.info(`   │  ├─ availability                         → "online"`);
      logger.info(`   │  └─ state                                → ${demandingState}`);
      
      logger.info(`   │`);
      logger.info(`   ├─ rehau_${zone.state.zoneId}_demanding_percent/`);
      logger.info(`   │  ├─ config                               → "${displayName} Demanding Percent"`);
      logger.info(`   │  ├─ object_id                            → "${objectIdBase}_demanding_percent"`);
      logger.info(`   │  ├─ availability                         → "online"`);
      logger.info(`   │  └─ state                                → ${demandingPercent}`);
      
      logger.info(`   │`);
      logger.info(`   ├─ rehau_${zone.state.zoneId}_dewpoint/`);
      logger.info(`   │  ├─ config                               → "${displayName} Dewpoint"`);
      logger.info(`   │  ├─ object_id                            → "${objectIdBase}_dewpoint"`);
      logger.info(`   │  ├─ availability                         → "online"`);
      logger.info(`   │  └─ state                                → ${dewpoint}`);
      
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
    
    // Demanding state (binary)
    this.publishDemanding(zoneKey, channel.demandState);
    
    // Demanding percent
    if (channel.demand !== null) {
      this.publishDemandingPercent(zoneKey, channel.demand);
    }
    
    // Dewpoint
    if (channel.dewpoint !== null) {
      this.publishDewpoint(zoneKey, channel.dewpoint);
    }
    
    // Mode and Preset based on mode (process BEFORE setpoint)
    // mode: 0=COMFORT, 1=REDUCED, 2=STANDBY, 3=OFF
    if (channel.mode !== null) {
      if (channel.mode === 3 || channel.mode === 2) {
        // OFF or STANDBY - zone is off
        state.mode = 'off';
        state.preset = null;
        this.publishMode(zoneKey, 'off');
        // Publish "None" for preset and target_temperature when OFF
        this.publishPresetNone(zoneKey);
        this.publishTargetTemperatureNone(zoneKey);
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
    
    // Target temperature (process AFTER mode to know if zone is off)
    // Only publish if zone is not off
    if (state.mode !== 'off') {
      if (channel.setpointTemperature.celsius !== null) {
        const targetTemp = channel.setpointTemperature.celsius;
        // if (targetTemp !== state.targetTemperature) {
          state.targetTemperature = targetTemp;
          this.publishTargetTemperature(zoneKey, targetTemp);
        // }
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
      const channelUpdatePayload = payload as { type: string; data: { channel: string; data: RawChannelData } };
      const channelId = channelUpdatePayload.data.channel; // CORRECT: Get channel ID from data.channel
      const channelData = channelUpdatePayload.data.data;
      
      if (channelData && channelId) {
        // Check if this confirms a pending command
        this.confirmPendingCommand(channelId);
        
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
      payload.zones.forEach((zoneData) => {
        const zoneId = zoneData._id || (zoneData as RawZoneData).id;
        const zoneKey = `${installId}_zone_${zoneId}`;
        const state = this.installations.get(zoneKey);
        
        if (!state) {
          return;
        }
        
        if (zoneData.channels && zoneData.channels[0]) {
          const channel = zoneData.channels[0] as unknown as RawChannelData;
          const groupName = this.getGroupNameForZone(installId, state.zoneNumber);
          
          logger.info(`📨 Processing MQTT realtime update:`);
          logger.info(`   Group: ${groupName}`);
          logger.info(`   Zone: ${state.zoneName}`);
          
          this.updateZoneFromRawChannel(zoneKey, state, channel, state.installationMode);
        }
      });
    }
  }

  private updateZoneFromRawChannel(zoneKey: string, state: ClimateState, rawChannel: RawChannelData, installationMode: 'heat' | 'cool'): void {
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
        // Publish "None" for preset and target_temperature when OFF
        this.publishPresetNone(zoneKey);
        this.publishTargetTemperatureNone(zoneKey);
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
      // console.log('******************* SETPOINT', setpoint);
      if (setpoint !== undefined) {
        const targetTemp = this.convertTemp(setpoint);
        if (targetTemp !== null) {
          state.targetTemperature = targetTemp;
          this.publishTargetTemperature(zoneKey, targetTemp);
        }
      }
    }
    
    // Ring light and lock states from raw channel data
    if (rawChannel.cc_config_bits && typeof rawChannel.cc_config_bits === 'object' && !Array.isArray(rawChannel.cc_config_bits)) {
      const configBits = rawChannel.cc_config_bits as { ring_activation?: boolean; lock?: boolean };
      const ringActivation = configBits.ring_activation === true;
      const locked = configBits.lock === true;
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
    
    logger.info(`📤 MQTT Publish: ${topic1} = ${temperature}°C (${groupName}/${state.zoneName})`);
    
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
    
    logger.info(`📤 MQTT Publish: ${topic} = ${temperature}°C (${groupName}/${state.zoneName})`);
    
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
    
    logger.info(`📤 MQTT Publish: ${topic} = ${mode} (${groupName}/${state.zoneName})`);
    
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
    
    logger.info(`📤 MQTT Publish: ${topic1} = ${humidity}% (${groupName}/${state.zoneName})`);
    
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

  private publishDemanding(zoneKey: string, demanding: boolean): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/binary_sensor/rehau_${state.zoneId}_demanding/state`;
    const value = demanding ? 'ON' : 'OFF';
    
    logger.info(`📤 MQTT Publish: ${topic} = ${value} (${groupName}/${state.zoneName})`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      value,
      { retain: true }
    );
  }

  private publishDemandingPercent(zoneKey: string, percent: number): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/sensor/rehau_${state.zoneId}_demanding_percent/state`;
    
    logger.info(`📤 MQTT Publish: ${topic} = ${percent} (${groupName}/${state.zoneName})`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      percent.toString(),
      { retain: true }
    );
  }

  private publishDewpoint(zoneKey: string, dewpoint: number): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/sensor/rehau_${state.zoneId}_dewpoint/state`;
    
    logger.info(`📤 MQTT Publish: ${topic} = ${dewpoint}°C (${groupName}/${state.zoneName})`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      dewpoint.toString(),
      { retain: true }
    );
  }

  private publishPreset(zoneKey: string, preset: 'comfort' | 'away'): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/climate/rehau_${state.zoneId}/preset`;
    
    logger.info(`📤 MQTT Publish: ${topic} = ${preset} (${groupName}/${state.zoneName})`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      preset,
      { retain: true }
    );
  }

  private publishPresetNone(zoneKey: string): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/climate/rehau_${state.zoneId}/preset`;
    
    logger.info(`📤 MQTT Publish: ${topic} = None (${groupName}/${state.zoneName})`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      'None',
      { retain: true }
    );
  }

  private publishTargetTemperatureNone(zoneKey: string): void {
    const state = this.installations.get(zoneKey);
    if (!state) return;
    
    const groupName = this.getGroupNameForZone(state.installId, state.zoneNumber);
    const topic = `homeassistant/climate/rehau_${state.zoneId}/target_temperature`;
    
    logger.info(`📤 MQTT Publish: ${topic} = None (${groupName}/${state.zoneName})`);
    
    this.mqttBridge.publishToHomeAssistant(
      topic,
      'None',
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
      logger.info(`📤 MQTT Publish: ${topic} = ${state} (${groupName}/${zoneState.zoneName})`);
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
      logger.info(`📤 MQTT Publish: ${topic} = ${state} (${groupName}/${zoneState.zoneName})`);
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
      
      this.sendRehauCommand(
        foundState.installId,
        foundState.channelZone,
        foundState.controllerNumber,
        commandData,
        foundKey,
        'ring_light'
      );
      
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
      
      this.sendRehauCommand(
        foundState.installId,
        foundState.channelZone,
        foundState.controllerNumber,
        commandData,
        foundKey,
        'lock'
      );
      
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
          this.sendRehauCommand(
            installId,
            state.channelZone,
            state.controllerNumber,
            { "15": 2 },
            zoneKey,
            'mode'
          );
          logger.info(`Set zone ${state.zoneName} to OFF`);
        } else if (payload === 'heat' || payload === 'cool') {
          // Set mode_used to 0 (COMFORT) when turning on
          this.sendRehauCommand(
            installId,
            state.channelZone,
            state.controllerNumber,
            { "15": 0 },
            zoneKey,
            'mode'
          );
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
          this.sendRehauCommand(
            installId,
            state.channelZone,
            state.controllerNumber,
            { "15": modeUsed },
            zoneKey,
            'preset'
          );
          logger.info(`Set zone ${state.zoneName} to preset ${payload} (mode_used=${modeUsed})`);
        }
        
      } else if (commandType === 'temperature') {
        // Temperature command - must set the correct setpoint based on mode and preset
        const tempCelsius = parseFloat(payload);
        const tempF10 = Math.round((tempCelsius * 10) * 1.8 + 320);
        
        // Determine which setpoint to update based on installation mode and zone preset
        const referentials = this.mqttBridge.getReferentials();
        let setpointKey: string;
        let setpointName: string;
        
        if (state.installationMode === 'heat') {
          // Heating system
          if (state.preset === 'away') {
            setpointKey = referentials?.['setpoint_h_reduced'] || '17';
            setpointName = 'setpoint_h_reduced (heating away)';
          } else {
            setpointKey = referentials?.['setpoint_h_normal'] || '16';
            setpointName = 'setpoint_h_normal (heating comfort)';
          }
        } else {
          // Cooling system
          if (state.preset === 'away') {
            setpointKey = referentials?.['setpoint_c_reduced'] || '20';
            setpointName = 'setpoint_c_reduced (cooling away)';
          } else {
            setpointKey = referentials?.['setpoint_c_normal'] || '19';
            setpointName = 'setpoint_c_normal (cooling comfort)';
          }
        }
        
        logger.info(`Command: temperature = ${tempCelsius}°C for zone ${zoneId}`);
        logger.info(`  Zone name: ${state.zoneName} (zoneNumber=${state.zoneNumber})`);
        logger.info(`  Installation mode: ${state.installationMode}, Preset: ${state.preset}`);
        logger.info(`  Target setpoint: ${setpointName} (key=${setpointKey})`);
        logger.info(`  Routing: channelZone=${state.channelZone}, controller=${state.controllerNumber}`);
        
        this.sendRehauCommand(
          installId,
          state.channelZone,
          state.controllerNumber,
          { [setpointKey]: tempF10 },
          zoneKey,
          'temperature'
        );
        logger.info(`Set zone ${state.zoneName} ${setpointName} to ${tempCelsius}°C (${tempF10})`);
      } else if (commandType === 'ring_light') {
        // Get referentials to use proper key for ring light
        const referentials = this.mqttBridge.getReferentials();
        const ringFunctionKey = referentials?.['ring_function'] || '34'; // Fallback to "34" if referentials not loaded
        
        // Ring light command: 1 = ON, 0 = OFF
        const ringLightValue = payload === 'ON' ? 1 : 0;
        const commandData = { [ringFunctionKey]: ringLightValue };
        
        this.sendRehauCommand(
          installId,
          state.channelZone,
          state.controllerNumber,
          commandData,
          zoneKey,
          'ring_light'
        );
        
        logger.info(`Set zone ${state.zoneName} ring light to ${payload}`);
        logger.info(`Full command data: ${JSON.stringify(commandData)}`);
      }
    } catch (error) {
      logger.error(`Failed to handle command for zone ${state.zoneName}:`, (error as Error).message);
    }
  }

  /**
   * Queue a command - NEW COMMAND REPLACES OLD ONE
   */
  private queueCommand(
    installId: string,
    channelZone: number,
    controllerNumber: number,
    data: RehauCommandData,
    zoneKey: string,
    commandType: 'mode' | 'preset' | 'temperature' | 'ring_light' | 'lock'
  ): void {
    // Stop waiting for old command acknowledgment - we only care about the latest
    if (this.pendingCommand) {
      logger.info(`⏸️ Stop waiting for old command: ${this.pendingCommand.id}`);
      logger.info(`   (Command was already sent, just not waiting for ACK anymore)`);
      this.pendingCommand = null;
    }
    
    // Clear the entire queue - we only want the latest command
    if (this.commandQueue.length > 0) {
      logger.info(`🗑️ Clearing ${this.commandQueue.length} old queued commands`);
      this.commandQueue = [];
    }
    
    const command: QueuedCommand = {
      installId,
      channelZone,
      controllerNumber,
      data,
      zoneKey,
      commandType
    };
    
    this.commandQueue.push(command);
    logger.info(`🆕 NEW command: ${commandType} for zone ${zoneKey}`);
    
    // Process immediately
    this.processCommandQueue();
  }

  /**
   * Process the next command in the queue
   */
  private processCommandQueue(): void {
    // Don't process if there's already a pending command
    if (this.pendingCommand) {
      return;
    }
    
    // Get next command from queue
    const command = this.commandQueue.shift();
    if (!command) {
      return;
    }
    
    // Create pending command with comprehensive logging
    this.commandIdCounter++;
    
    // Always infer commandType from data to ensure accuracy
    const inferredCommandType = this.inferCommandType(command.data);
    
    this.pendingCommand = {
      id: `cmd_${this.commandIdCounter}_${Date.now()}`,
      installId: command.installId,
      channelZone: command.channelZone,
      controllerNumber: command.controllerNumber,
      data: command.data,
      timestamp: Date.now(),
      retries: 0,
      zoneKey: command.zoneKey,
      commandType: inferredCommandType  // Always use inferred type
    };
    
    // Get zone name for logging
    const channelName = this.channelZoneToChannelId.get(command.channelZone) || `zone_${command.channelZone}`;
    const zoneName = this.mqttBridge.getZoneName(channelName) || `Zone ${command.channelZone}`;
    
    // Log command creation clearly
    logger.info(`📦 COMMAND CREATED: ${this.pendingCommand.id}`);
    logger.info(`   Zone: ${zoneName} (channelZone=${command.channelZone})`);
    logger.info(`   Type: ${inferredCommandType}`);
    logger.info(`   Data (REHAU format): ${JSON.stringify(command.data)}`);
    logger.info(`   Controller: ${command.controllerNumber}`);
    
    // Send the command
    this.sendRehauCommandImmediate(
      command.installId,
      command.channelZone,
      command.controllerNumber,
      command.data
    );
    
    // Ring light and lock commands NEVER return confirmations (REHAU design)
    // Auto-confirm them after a short delay to allow MQTT delivery
    if (command.commandType === 'ring_light' || command.commandType === 'lock') {
      logger.info(`📤 Command sent (ID: ${this.pendingCommand.id}) - ${command.commandType} (no confirmation expected)`);
      
      // Capture the command ID for the timeout closure
      const commandId = this.pendingCommand.id;
      
      // Auto-confirm after 2 seconds (enough time for MQTT delivery)
      this.autoConfirmTimeout = setTimeout(() => {
        if (this.pendingCommand && this.pendingCommand.id === commandId) {
          logger.info(`✅ Command auto-confirmed (ID: ${commandId}) - ${command.commandType}`);
          this.pendingCommand = null;
          this.autoConfirmTimeout = null;
          this.processCommandQueue();
        }
      }, 2000);
    } else {
      logger.info(`⏱️  Command sent (ID: ${this.pendingCommand.id}), waiting for confirmation...`);
      logger.debug(`   Timeout: ${COMMAND_RETRY_TIMEOUT}ms, Max retries: ${COMMAND_MAX_RETRIES}`);
    }
  }

  /**
   * Start the command retry checker timer
   */
  private startCommandRetryChecker(): void {
    this.commandCheckTimer = setInterval(() => {
      this.checkPendingCommand();
    }, COMMAND_CHECK_INTERVAL);
    
    logger.debug(`Command retry checker started (interval: ${COMMAND_CHECK_INTERVAL}ms)`);
  }

  /**
   * Check if pending command has timed out and needs retry
   */
  private checkPendingCommand(): void {
    if (!this.pendingCommand) {
      return;
    }
    
    // Skip retry check for ring_light and lock - they auto-confirm via setTimeout
    if (this.pendingCommand.commandType === 'ring_light' || this.pendingCommand.commandType === 'lock') {
      return;
    }
    
    const elapsed = Date.now() - this.pendingCommand.timestamp;
    
    if (elapsed >= COMMAND_RETRY_TIMEOUT) {
      // Command timed out
      this.pendingCommand.retries++;
      
      if (this.pendingCommand.retries >= COMMAND_MAX_RETRIES) {
        // Max retries reached, give up
        logger.error(`❌ Command failed after ${COMMAND_MAX_RETRIES} retries (ID: ${this.pendingCommand.id})`);
        logger.error(`   Command: ${this.getCommandDescription(this.pendingCommand)}`);
        logger.error(`   Technical details: Zone ${this.pendingCommand.zoneKey}, Type ${this.pendingCommand.commandType}`);
        
        // Clear pending command and process next
        this.pendingCommand = null;
        this.processCommandQueue();
      } else {
        // Retry the command - LOG CLEARLY
        const channelName = this.channelZoneToChannelId.get(this.pendingCommand.channelZone) || `zone_${this.pendingCommand.channelZone}`;
        const zoneName = this.mqttBridge.getZoneName(channelName) || `Zone ${this.pendingCommand.channelZone}`;
        
        // Get only relevant referentials
        const refs = this.mqttBridge.getReferentials();
        const dataKeys = Object.keys(this.pendingCommand.data);
        const relevantRefs: Record<string, string> = {};
        
        if (refs) {
          for (const [refName, refKey] of Object.entries(refs)) {
            if (dataKeys.includes(refKey)) {
              relevantRefs[refName] = refKey;
            }
          }
        }
        
        logger.warn(`⏱️  COMMAND TIMEOUT: ${this.pendingCommand.id}`);
        logger.warn(`   Retry: ${this.pendingCommand.retries}/${COMMAND_MAX_RETRIES}`);
        logger.warn(`   Zone: ${zoneName} (channelZone=${this.pendingCommand.channelZone})`);
        logger.warn(`   Type: ${this.pendingCommand.commandType}`);
        logger.warn(`   Data (REHAU format): ${JSON.stringify(this.pendingCommand.data)}`);
        logger.warn(`   Referentials used: ${JSON.stringify(relevantRefs)}`);
        logger.warn(`   Elapsed: ${elapsed}ms (timeout: ${COMMAND_RETRY_TIMEOUT}ms)`);
        logger.warn(`   Full REHAU command: ${JSON.stringify({"11":"REQ_TH","12":this.pendingCommand.data,"36":this.pendingCommand.channelZone,"35":this.pendingCommand.controllerNumber})}`);
        logger.warn(`   Resending...`);
        
        // Update timestamp and resend
        this.pendingCommand.timestamp = Date.now();
        this.sendRehauCommandImmediate(
          this.pendingCommand.installId,
          this.pendingCommand.channelZone,
          this.pendingCommand.controllerNumber,
          this.pendingCommand.data
        );
      }
    }
  }

  /**
   * Confirm a pending command (called when we receive matching channel_update)
   * Simple FIFO logic: any update for the correct zone confirms the pending command
   */
  private confirmPendingCommand(channelId: string): void {
    if (!this.pendingCommand) {
      return;
    }
    
    // Check if this update is for the zone we're waiting for
    const zoneKey = this.channelToZoneKey.get(channelId);
    if (!zoneKey || zoneKey !== this.pendingCommand.zoneKey) {
      return;
    }
    
    // Command confirmed! (any update for this zone confirms it)
    const commandDesc = this.getCommandDescription(this.pendingCommand);
    logger.info(`✅ Command confirmed (ID: ${this.pendingCommand.id}) after ${Date.now() - this.pendingCommand.timestamp}ms`);
    logger.info(`   Command: ${commandDesc}`);
    logger.debug(`   Retries: ${this.pendingCommand.retries}`);
    
    // Clear pending command and process next
    this.pendingCommand = null;
    this.processCommandQueue();
  }

  /**
   * Send command immediately (internal method, bypasses queue)
   */
  private sendRehauCommandImmediate(installId: string, channelZone: number, controllerNumber: number, data: RehauCommandData): void {
    // REQ_TH command format using numeric keys from referentials
    const message = {
      "11": "REQ_TH",  // type
      "12": data,      // data object
      "36": channelZone,    // zone (channel zone number)
      "35": controllerNumber  // controller number
    };
    
    const topic = `client/${installId}`;
    this.mqttBridge.publishToRehau(topic, message);
    
    // Get only the relevant referentials for this command
    const refs = this.mqttBridge.getReferentials();
    const dataKeys = Object.keys(data);
    const relevantRefs: Record<string, string> = {};
    
    if (refs) {
      // Find which referential keys match the data keys
      for (const [refName, refKey] of Object.entries(refs)) {
        if (dataKeys.includes(refKey)) {
          relevantRefs[refName] = refKey;
        }
      }
    }
    
    // Log the actual REHAU command
    logger.info(`📤 SENT TO REHAU:`);
    logger.info(`   Topic: ${topic}`);
    logger.info(`   Message: ${JSON.stringify(message)}`);
    logger.info(`   Data keys used: ${JSON.stringify(data)}`);
    logger.info(`   Referentials used: ${JSON.stringify(relevantRefs)}`);
  }

  /**
   * Queue a command (simplified - no field/value tracking needed)
   */
  private sendRehauCommand(
    installId: string,
    channelZone: number,
    controllerNumber: number,
    data: RehauCommandData,
    zoneKey?: string,
    commandType?: 'mode' | 'preset' | 'temperature' | 'ring_light' | 'lock'
  ): void {
    // If we don't have zoneKey, try to find it from channelZone and controller
    let actualZoneKey = zoneKey;
    if (!actualZoneKey) {
      // Find zone by channelZone and controllerNumber
      for (const [key, state] of this.installations.entries()) {
        if (state.installId === installId && 
            state.channelZone === channelZone && 
            state.controllerNumber === controllerNumber) {
          actualZoneKey = key;
          break;
        }
      }
    }
    
    if (!actualZoneKey) {
      logger.warn(`Cannot queue command: zone not found for channelZone=${channelZone}, controller=${controllerNumber}`);
      // Fallback to immediate send
      this.sendRehauCommandImmediate(installId, channelZone, controllerNumber, data);
      return;
    }
    
    // Queue the command
    this.queueCommand(
      installId,
      channelZone,
      controllerNumber,
      data,
      actualZoneKey,
      commandType || 'mode'
    );
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

  /**
   * Get human-readable command description for logging
   */
  private getCommandDescription(command: PendingCommand): string {
    // Use cached channelZone -> channel ID mapping
    const channelName = this.channelZoneToChannelId.get(command.channelZone) || `zone_${command.channelZone}`;
    const zoneName = this.mqttBridge.getZoneName(channelName) || `Zone ${command.channelZone}`;
    const groupName = this.mqttBridge.getGroupName(channelName) || 'Unknown Group';
    
    // Build command type description
    let commandDesc = '';
    switch (command.commandType) {
      case 'mode':
        const mode = command.data.mode_permanent !== undefined 
          ? (command.data.mode_permanent === 1 ? 'HEAT' : command.data.mode_permanent === 0 ? 'AUTO' : `UNKNOWN (${command.data.mode_permanent})`)
          : 'UNKNOWN (undefined)';
        commandDesc = `Set mode to ${mode}`;
        break;
      case 'preset':
        const preset = command.data.preset_mode !== undefined
          ? this.getPresetName(Number(command.data.preset_mode))
          : 'UNKNOWN';
        commandDesc = `Set preset to ${preset}`;
        break;
      case 'temperature':
        // Get referentials for dynamic key mapping
        const refs = this.mqttBridge.getReferentials();
        
        // Find which temperature key is present
        let tempValue: number | undefined;
        let tempType = '';
        
        if (refs) {
          const key15 = refs['setpoint_h_standby'];
          const key16 = refs['setpoint_h_normal'];
          const key17 = refs['setpoint_h_reduced'];
          const key19 = refs['setpoint_c_normal'];
          const key20 = refs['setpoint_c_reduced'];
          
          if (key15 && command.data[key15] !== undefined) {
            tempValue = Number(command.data[key15]);
            tempType = ' (standby/frost protection)';
          } else if (key16 && command.data[key16] !== undefined) {
            tempValue = Number(command.data[key16]);
            tempType = ' (heating comfort)';
          } else if (key17 && command.data[key17] !== undefined) {
            tempValue = Number(command.data[key17]);
            tempType = ' (heating away)';
          } else if (key19 && command.data[key19] !== undefined) {
            tempValue = Number(command.data[key19]);
            tempType = ' (cooling comfort)';
          } else if (key20 && command.data[key20] !== undefined) {
            tempValue = Number(command.data[key20]);
            tempType = ' (cooling away)';
          }
        }
        
        // Fallback to named keys
        if (tempValue === undefined) {
          if (command.data.setpoint_h_standby !== undefined) {
            tempValue = Number(command.data.setpoint_h_standby);
            tempType = ' (standby/frost protection)';
          } else if (command.data.setpoint_h_normal !== undefined) {
            tempValue = Number(command.data.setpoint_h_normal);
            tempType = ' (heating comfort)';
          } else if (command.data.setpoint_h_reduced !== undefined) {
            tempValue = Number(command.data.setpoint_h_reduced);
            tempType = ' (heating away)';
          } else if (command.data.setpoint_c_normal !== undefined) {
            tempValue = Number(command.data.setpoint_c_normal);
            tempType = ' (cooling comfort)';
          } else if (command.data.setpoint_c_reduced !== undefined) {
            tempValue = Number(command.data.setpoint_c_reduced);
            tempType = ' (cooling away)';
          }
        }
        
        const temp = tempValue !== undefined
          ? `${(Number(tempValue) / 32).toFixed(1)}°C${tempType}`
          : 'UNKNOWN';
        commandDesc = `Set temperature to ${temp}`;
        break;
      case 'ring_light':
        const ringState = command.data.ring_light !== undefined
          ? (command.data.ring_light === 1 ? 'ON' : 'OFF')
          : 'UNKNOWN';
        commandDesc = `Turn ring light ${ringState}`;
        break;
      case 'lock':
        const lockState = command.data.lock !== undefined
          ? (command.data.lock === 1 ? 'LOCKED' : 'UNLOCKED')
          : 'UNKNOWN';
        commandDesc = `Set lock to ${lockState}`;
        break;
      default:
        commandDesc = `Unknown command: ${command.commandType}`;
    }
    
    return `${commandDesc} for ${zoneName} (${groupName})`;
  }
  
  /**
   * Get preset name from preset mode value
   */
  private getPresetName(presetMode: number): string {
    switch (presetMode) {
      case 0: return 'MANUAL';
      case 1: return 'ECO';
      case 2: return 'COMFORT';
      case 3: return 'AWAY';
      case 4: return 'OFF';
      default: return `PRESET_${presetMode}`;
    }
  }
  
  /**
   * Infer command type from data structure
   * Uses referentials mapping to identify command types dynamically
   */
  private inferCommandType(data: RehauCommandData): PendingCommand['commandType'] {
    const keys = Object.keys(data);
    const referentials = this.mqttBridge.getReferentials();
    
    if (!referentials) {
      // Fallback to named keys if referentials not loaded
      if (data.setpoint_h_normal !== undefined || data.setpoint_h_reduced !== undefined || 
          data.setpoint_h_standby !== undefined || data.setpoint_c_normal !== undefined || 
          data.setpoint_c_reduced !== undefined) return 'temperature';
      if (data.mode_permanent !== undefined) return 'mode';
      if (data.preset_mode !== undefined) return 'preset';
      if (data.ring_light !== undefined) return 'ring_light';
      if (data.lock !== undefined) return 'lock';
      return 'mode';
    }
    
    // Get numeric keys from referentials
    const tempKeys = [
      referentials['setpoint_h_standby'],
      referentials['setpoint_h_normal'],
      referentials['setpoint_h_reduced'],
      referentials['setpoint_c_normal'],
      referentials['setpoint_c_reduced']
    ].filter(k => k !== undefined);
    
    const modeKey = referentials['mode_permanent'];
    const presetKey = referentials['preset_mode'];
    
    // Check if any data key matches temperature keys
    if (keys.some(k => tempKeys.includes(k))) return 'temperature';
    
    // Check for mode key
    if (modeKey && keys.includes(modeKey)) return 'mode';
    
    // Check for preset key
    if (presetKey && keys.includes(presetKey)) return 'preset';
    
    // Check for named keys (fallback)
    if (data.ring_light !== undefined) return 'ring_light';
    if (data.lock !== undefined) return 'lock';
    
    return 'mode'; // Default fallback
  }

  /**
   * Cleanup method to stop timers and release resources
   * Idempotent: safe to call multiple times
   */
  cleanup(): void {
    if (this.isCleanedUp) {
      logger.debug('ClimateController already cleaned up, skipping');
      return;
    }
    
    logger.info('Cleaning up ClimateController...');
    
    // Stop command retry checker timer
    if (this.commandCheckTimer) {
      clearInterval(this.commandCheckTimer);
      this.commandCheckTimer = null;
      logger.info('Command retry checker stopped');
    }
    
    // Clear auto-confirmation timeout if pending
    if (this.autoConfirmTimeout) {
      clearTimeout(this.autoConfirmTimeout);
      this.autoConfirmTimeout = null;
      logger.info('Auto-confirmation timeout cleared');
    }
    
    // Clear command queue
    this.commandQueue = [];
    logger.info('Command queue cleared');
    
    // Reset pending command
    this.pendingCommand = null;
    logger.info('Pending command reset');
    
    // Clear all Maps
    this.installations.clear();
    this.installationNames.clear();
    this.installationData.clear();
    this.channelToZoneKey.clear();
    logger.info('All Maps cleared');
    
    this.isCleanedUp = true;
    logger.info('ClimateController cleanup completed');
  }
}

export default ClimateController;
