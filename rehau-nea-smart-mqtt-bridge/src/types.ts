// REHAU API Types
export interface RehauTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface RehauChannel {
  _id: string;
  index_config: number;
  ca_code: number;
  channel_zone: number;
  temp_zone?: number;
  humidity?: number;
  mode_used?: number;
  setpoint_used?: number;
  setpoint_h_normal?: number;
  setpoint_h_reduced?: number;
  setpoint_h_standby?: number;
  setpoint_c_normal?: number;
  setpoint_c_reduced?: number;
  demand?: number;
  dewpoint?: number;
  openWindow?: boolean;
  [key: string]: unknown;
}

export interface RehauZone {
  _id: string;
  number: number;
  name: string;
  channels: RehauChannel[];
}

export interface RehauGroup {
  _id: string;
  name: string;
  zones: RehauZone[];
}

export interface RehauInstallation {
  _id: string;
  unique: string;
  name: string;
  address?: string;
  version?: string;
  connectionState?: boolean;
  timezone?: string;
  outside_temp?: number;
  outsideTempFiltered?: number;
  coolingConditions?: number;
  groups: RehauGroup[];
  user?: {
    heatcool_auto_01?: {
      heating?: boolean;
      cooling?: boolean;
      manual?: boolean;
    };
  };
}

export interface RehauInstallationsResponse {
  success: boolean;
  data: RehauInstallation[];
}

// MQTT Types
export interface MQTTConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface RehauMQTTMessage {
  type: string;
  success?: boolean;
  data?: unknown;
  zones?: RehauZone[];
  [key: string]: unknown;
}

export interface LiveEMUData {
  success: boolean;
  type: 'live_data';
  data: {
    data: {
      [key: string]: {
        pumpOn: number;
        mixed_circuit1_setpoint: number;
        mixed_circuit1_supply: number;
        mixed_circuit1_return: number;
        mixed_circuit1_opening: number;
      };
    };
    unique: string;
    type: 'LIVE_EMU';
  };
}

export interface LiveDIDOData {
  success: boolean;
  type: 'live_data';
  data: {
    data: {
      [key: string]: {
        DI: boolean[];
        DO: boolean[];
      };
    };
    unique: string;
    type: 'LIVE_DIDO';
  };
}

export interface RehauChannelUpdateMessage {
  type: 'channel_update';
  success: boolean;
  data: {
    channel: string;
    unique: string;
    data: RehauChannel;
  };
}

// Raw MQTT Data Types (for type safety)
/**
 * Raw channel data from MQTT messages
 * All fields are optional as they may not all be present in every message
 */
export interface RawChannelData {
  _id?: string;
  id?: string;
  temp_zone?: number;
  humidity?: number;
  mode_used?: number;
  setpoint_h_normal?: number;
  setpoint_h_reduced?: number;
  setpoint_h_standby?: number;
  setpoint_c_normal?: number;
  setpoint_c_reduced?: number;
  cc_config_bits?: number | string | { ring_activation?: boolean; lock?: boolean; [key: string]: unknown };
  demand?: number;
  dewpoint?: number;
  setpoint_used?: number;
  index_config?: number;
  ca_code?: number;
  channel_zone?: number;
  openWindow?: boolean;
  [key: string]: unknown;
}

/**
 * Raw zone data from MQTT realtime messages
 */
export interface RawZoneData {
  _id?: string;
  id?: string;
  number?: number;
  name?: string;
  channels?: RawChannelData[];
  [key: string]: unknown;
}

/**
 * Raw message data payloads for different MQTT message types
 */
export interface RawMessageData {
  channel_update?: {
    type: 'channel_update';
    success?: boolean;
    data: {
      channel: string;
      unique?: string;
      data: RawChannelData;
    };
  };
  realtime?: {
    type: 'realtime' | 'realtime.update';
    success?: boolean;
    zones?: RawZoneData[];
  };
  live_data?: {
    type: 'live_data';
    success?: boolean;
    data?: {
      type?: 'LIVE_EMU' | 'LIVE_DIDO';
      data?: unknown;
      unique?: string;
    };
  };
}

// Home Assistant Types
export interface HACommand {
  type: 'ha_command';
  installId: string;
  zoneNumber: string; // This is actually zoneId (MongoDB ObjectId string)
  commandType: 'mode' | 'preset' | 'temperature' | 'ring_light';
  payload: string;
}

export interface RingLightCommand {
  type: 'ring_light_command';
  zoneId: string;
  payload: string | boolean;
}

export interface LockCommand {
  type: 'lock_command';
  zoneId: string;
  payload: string | boolean;
}

export interface ClimateState {
  id: string;
  installId: string;
  zoneId: string;
  zoneName: string;
  zoneNumber: number; // Keep for backward compatibility in logs
  channelZone: number; // Actual channel zone number for REHAU commands
  controllerNumber: number; // Controller number for REHAU commands
  installName: string;
  installationMode: 'heat' | 'cool';
  currentTemperature: number | null;
  targetTemperature: number | null;
  humidity: number | null;
  mode: 'off' | 'heat' | 'cool';
  preset: 'comfort' | 'away' | null;
  available: boolean;
}

export interface ZoneInfo {
  zoneId: string;
  zoneName: string;
  zoneNumber: number;
  channelNumber?: number;
  installName: string;
}

// MQTT Discovery Config Types
export interface HADeviceConfig {
  identifiers: string[];
  name: string;
  manufacturer: string;
  model: string;
  sw_version: string;
}

export interface HAClimateDiscoveryConfig {
  name: string;
  unique_id: string;
  device: HADeviceConfig;
  current_temperature_topic: string;
  temperature_state_topic: string;
  temperature_command_topic: string;
  current_humidity_topic: string;
  mode_state_topic: string;
  mode_command_topic: string;
  modes: string[];
  preset_mode_state_topic: string;
  preset_mode_command_topic: string;
  preset_modes: string[];
  availability_topic: string;
  payload_available: string;
  payload_not_available: string;
  temperature_unit: string;
  temp_step: number;
  min_temp: number;
  max_temp: number;
  precision?: number;
  optimistic?: boolean;
}

export interface HASensorDiscoveryConfig {
  name: string;
  unique_id: string;
  device: HADeviceConfig;
  state_topic: string;
  device_class: string;
  unit_of_measurement: string;
  value_template: string;
  availability_topic: string;
  payload_available: string;
  payload_not_available: string;
}

// Referentials Types
export interface ReferentialEntry {
  index: string;
  value: string;
}

export interface ReferentialsMap {
  [key: string]: string;
}

// REHAU Command Types
export interface RehauCommandData {
  [key: string]: number | string | boolean;
}

export interface RehauCommand {
  "11": string; // type
  "12": RehauCommandData; // data
  "35"?: number; // controller/channel
  "36"?: number; // zone
}

// Command Retry Types
export interface PendingCommand {
  id: string;
  installId: string;
  channelZone: number;
  controllerNumber: number;
  data: RehauCommandData;
  timestamp: number;
  retries: number;
  zoneKey: string;
  commandType: 'mode' | 'preset' | 'temperature' | 'ring_light' | 'lock';
}

export interface QueuedCommand {
  installId: string;
  channelZone: number;
  controllerNumber: number;
  data: RehauCommandData;
  zoneKey: string;
  commandType: 'mode' | 'preset' | 'temperature' | 'ring_light' | 'lock';
}

// Logger Types
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerConfig {
  level: LogLevel;
}
