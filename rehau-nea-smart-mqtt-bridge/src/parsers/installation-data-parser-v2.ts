/**
 * Parser V2 for REHAU getInstallationData (getDataofInstall) API responses
 * 
 * This is an improved version with a cleaner hierarchical structure:
 * IUser -> IInstall[] -> IGroup[] -> IZone[] -> IChannel[]
 * 
 * Key improvements:
 * - Better type safety with strict interfaces
 * - Cleaner separation of concerns
 * - Installation-level controllers and mixed circuits
 * - Zone references to controllers
 * - Support for digital I/O in mixed circuits
 * 
 * @example
 * ```typescript
 * import { InstallationDataParserV2 } from './parsers/installation-data-parser-v2';
 * 
 * const parser = new InstallationDataParserV2();
 * const result = parser.parse(apiResponse);
 * 
 * console.log(`User: ${result.email}`);
 * result.installs.forEach(install => {
 *   console.log(`Installation: ${install.name}`);
 *   install.groups.forEach(group => {
 *     console.log(`  Group: ${group.name}`);
 *     group.zones.forEach(zone => {
 *       console.log(`    Zone: ${zone.name}`);
 *     });
 *   });
 * });
 * ```
 */

import logger from '../logger';

const isDebug = process.env.LOG_LEVEL === 'debug';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Temperature value with multiple representations
 */
export interface ITemperature {
  /** Temperature in Celsius */
  celsius: number | null;
  /** Temperature in Fahrenheit */
  fahrenheit: number | null;
  /** Raw API value (Fahrenheit × 10) */
  raw: number | null;
}

/**
 * Channel configuration flags
 */
export interface IChannelConfig {
  /** Heating enabled */
  heating: boolean;
  /** Cooling enabled */
  cooling: boolean;
  /** Ring activation (light ring on thermostat) */
  ringActivation: boolean;
  /** Manual control locked */
  locked: boolean;
}

/**
 * All setpoint temperatures for a channel
 */
export interface ISetpoints {
  heatingNormal: ITemperature;
  heatingReduced: ITemperature;
  heatingStandby: ITemperature;
  coolingNormal: ITemperature;
  coolingReduced: ITemperature;
}

/**
 * Channel (thermostat/sensor) data
 */
export interface IChannel {
  /** Channel database ID */
  id: string;
  /** Channel zone number */
  channelZone: number;
  /** Controller number this channel belongs to */
  controllerNumber: number | null;
  
  // Temperature data
  /** Current temperature */
  currentTemperature: ITemperature;
  /** Target setpoint temperature */
  setpointTemperature: ITemperature;
  
  // Sensor data
  /** Humidity percentage (0-100) */
  humidity: number | null;
  /** Dewpoint temperature in Celsius */
  dewpoint: number | null;
  
  // Status flags
  /** Open window detection active */
  openWindow: boolean;
  /** Low battery warning */
  lowBattery: boolean;
  
  // Operating state
  /** Operating mode (0=comfort, 1=reduced, 2=standby, 3=off) */
  mode: number | null;
  /** Heating demand percentage (0-100) */
  demand: number | null;
  
  // Configuration
  /** Channel configuration */
  config: IChannelConfig;
  /** All setpoint temperatures */
  setpoints: ISetpoints;
  
  /** Raw channel data for debugging */
  raw: Record<string, unknown>;
}

/**
 * Zone data
 */
export interface IZone {
  /** Zone database ID */
  id: string;
  /** Zone number */
  number: number;
  /** Zone display name */
  name: string;
  /** Channels (thermostats) in this zone */
  channels: IChannel[];
  /** Reference to controller ID that manages this zone */
  controllerRef: string | null;
}

/**
 * Group data
 */
export interface IGroup {
  /** Group database ID */
  id: string;
  /** Group display name */
  name: string;
  /** Zones in this group */
  zones: IZone[];
}

/**
 * Controller data (references zones)
 */
export interface IController {
  /** Controller number */
  number: number;
  /** Controller unique identifier */
  unique: string | null;
  /** Zone IDs managed by this controller */
  zoneRefs: string[];
}

/**
 * Pump data
 */
export interface IPump {
  /** Pump number */
  number: number;
  /** Pump on/off state */
  on: boolean;
  /** Time on in seconds */
  tonSeconds: number | null;
  /** Time off in seconds */
  toffSeconds: number | null;
}

/**
 * Digital Input data
 */
export interface IDi {
  /** Input number */
  number: number;
  /** Input state */
  state: boolean;
  /** Input type/description */
  type: string | null;
}

/**
 * Digital Output data
 */
export interface IDo {
  /** Output number */
  number: number;
  /** Output state */
  state: boolean;
  /** Output type/description */
  type: string | null;
}

/**
 * Mixed circuit (heating/cooling circuit) data
 */
export interface IMixedCircuit {
  /** Circuit number */
  number: number;
  
  // Temperatures
  /** Setpoint temperature */
  setpoint: ITemperature;
  /** Supply temperature */
  supply: ITemperature;
  /** Return temperature */
  return: ITemperature;
  
  // Valve control
  /** Valve opening percentage (0-100) */
  opening: number | null;
  
  // Components
  /** Pumps in this circuit */
  pumps: IPump[];
  /** Digital inputs (optional) */
  digitalInputs: IDi[];
  /** Digital outputs (optional) */
  digitalOutputs: IDo[];
}

/**
 * Global operation mode
 */
export interface IOperationMode {
  /** Heating enabled globally */
  heating: boolean;
  /** Cooling enabled globally */
  cooling: boolean;
  /** Manual mode active */
  manual: boolean;
}

/**
 * Geofencing data
 */
export interface IGeofencing {
  /** Active installations for geofencing */
  installs: Array<{
    id: string;
    active: boolean;
  }>;
  /** Latitude */
  lat: number | null;
  /** Longitude */
  long: number | null;
}

/**
 * User settings (simplified - can be expanded)
 */
export interface IUserSettings {
  /** Temperature unit (false=Celsius, true=Fahrenheit) */
  degreef: boolean;
  /** Heat/Cool/Auto mode settings */
  heatcoolAuto: IOperationMode;
  /** Party mode settings */
  partyMode: {
    active: boolean;
    startTime: string | null;
    periodMinutes: number | null;
  };
  /** Language code */
  language: string | null;
  /** Raw user settings for debugging */
  raw: Record<string, unknown>;
}

/**
 * Installer settings (simplified - can be expanded)
 */
export interface IInstallerSettings {
  /** Software version */
  softwareVersion: string | null;
  /** Signal power */
  signalPower: number | null;
  /** Number of controllers */
  numberOfControllers: number | null;
  /** Number of mixed circuits */
  numberOfMixedCircuits: number | null;
  /** Number of rooms/zones */
  numberOfRooms: number | null;
  /** Number of pumps */
  numberOfPumps: number | null;
  /** Raw installer settings for debugging */
  raw: Record<string, unknown>;
}

/**
 * Installation data
 */
export interface IInstall {
  /** Installation database ID */
  id: string;
  /** Installation unique identifier (used for MQTT) */
  unique: string;
  /** Installation display name */
  name: string;
  /** Installation address */
  address: string | null;
  /** Firmware version */
  version: string | null;
  /** Controller online status */
  connectionState: boolean;
  /** Timezone */
  timezone: string | null;
  
  // Geofencing
  /** Geofencing absence level (0=home, 1+=away) */
  absenceLevel: number | null;
  /** Geofencing active */
  geoInstallActive: boolean;
  
  // System-wide data
  /** Outside temperature */
  outsideTemperature: ITemperature;
  /** Outside temperature (filtered) */
  outsideTemperatureFiltered: ITemperature;
  /** Cooling conditions value */
  coolingConditions: number | null;
  /** Global operation mode */
  operationMode: IOperationMode;
  
  // Configuration
  /** Number of controllers */
  numberOfControllers: number | null;
  /** Number of mixed circuits */
  numberOfMixedCircuits: number | null;
  
  // Hierarchical data
  /** Groups containing zones */
  groups: IGroup[];
  /** Controllers (reference zones) */
  controllers: IController[];
  /** Mixed circuits (heating/cooling circuits) */
  mixedCircuits: IMixedCircuit[];
  
  // Settings
  /** User settings */
  userSettings: IUserSettings | null;
  /** Installer settings */
  installerSettings: IInstallerSettings | null;
  
  /** Raw API response for debugging */
  raw: unknown;
}

/**
 * User data (top level)
 */
export interface IUser {
  /** User database ID */
  id: string;
  /** User email */
  email: string;
  /** User creation date */
  createdAt: string | null;
  /** User language */
  language: string | null;
  /** User roles */
  roles: string[];
  /** Geofencing data */
  geofencing: IGeofencing | null;
  /** Installations */
  installs: IInstall[];
  /** Raw API response for debugging */
  raw: unknown;
}

/**
 * Raw API response structure from getDataofInstall endpoint
 */
export interface InstallationDataApiResponseV2 {
  success?: boolean;
  data?: {
    token?: string;
    hash?: string;
    user?: {
      _id?: string;
      email?: string;
      createdAt?: string;
      language?: string;
      roles?: string[];
      geofencing?: unknown;
      installs?: unknown[];
    };
  };
}

// ============================================================================
// Parser Class
// ============================================================================

/**
 * Parser V2 class for getInstallationData API responses
 */
export class InstallationDataParserV2 {
  /**
   * Parse a getDataofInstall API response
   * 
   * @param response - Raw API response from getDataofInstall endpoint
   * @param targetUnique - Optional unique ID to filter specific installation
   * @returns Parsed user data with all installations
   * @throws Error if response is invalid
   */
  parse(response: unknown, targetUnique?: string): IUser {
    if (isDebug) {
      logger.debug('🔍 [InstallationDataParserV2] Starting parse...');
      if (targetUnique) logger.debug(`🔍 [InstallationDataParserV2] Filtering for installation: ${targetUnique}`);
    }
    
    // Validate response structure
    if (!this.isValidResponse(response)) {
      throw new Error('Invalid getInstallationData response: missing required fields');
    }

    const apiResponse = response as InstallationDataApiResponseV2;
    const userData = apiResponse.data!.user!;

    if (isDebug) {
      logger.debug(`🔍 [InstallationDataParserV2] User ID: ${userData._id}`);
      logger.debug(`🔍 [InstallationDataParserV2] Email: ${userData.email}`);
      logger.debug(`🔍 [InstallationDataParserV2] Total installations in response: ${Array.isArray(userData.installs) ? userData.installs.length : 0}`);
    }

    // Parse geofencing
    if (isDebug) logger.debug('🔍 [InstallationDataParserV2] Parsing geofencing...');
    const geofencing = this.parseGeofencing(userData.geofencing);

    // Parse installations
    const installs: IInstall[] = [];
    if (Array.isArray(userData.installs)) {
      for (let i = 0; i < userData.installs.length; i++) {
        const install = userData.installs[i];
        if (typeof install === 'object' && install !== null) {
          const installObj = install as Record<string, unknown>;
          
          // Filter by targetUnique if specified
          if (targetUnique && installObj.unique !== targetUnique) {
            if (isDebug) logger.debug(`🔍 [InstallationDataParserV2] Skipping installation ${installObj.unique} (not matching target)`);
            continue;
          }
          
          if (isDebug) logger.debug(`🔍 [InstallationDataParserV2] Parsing installation ${i + 1}/${userData.installs.length}: ${installObj.name}`);
          const parsed = this.parseInstallation(installObj, response);
          if (isDebug) {
            logger.debug(`🔍 [InstallationDataParserV2]   - Groups: ${parsed.groups.length}`);
            parsed.groups.forEach((group, gi) => {
              logger.debug(`🔍 [InstallationDataParserV2]     [${gi + 1}] ${group.name}: ${group.zones.length} zones`);
            });
            logger.debug(`🔍 [InstallationDataParserV2]   - Controllers: ${parsed.controllers.length}`);
            logger.debug(`🔍 [InstallationDataParserV2]   - Mixed circuits: ${parsed.mixedCircuits.length}`);
          }
          installs.push(parsed);
        }
      }
    }

    // If targetUnique specified but not found, throw error
    if (targetUnique && installs.length === 0) {
      throw new Error(`Installation with unique ID "${targetUnique}" not found`);
    }

    if (isDebug) logger.debug(`🔍 [InstallationDataParserV2] Parse complete. Parsed ${installs.length} installation(s)`);

    return {
      id: userData._id || '',
      email: userData.email || '',
      createdAt: userData.createdAt || null,
      language: userData.language || null,
      roles: Array.isArray(userData.roles) ? userData.roles : [],
      geofencing,
      installs,
      raw: response,
    };
  }

  /**
   * Parse geofencing data
   */
  private parseGeofencing(geofencing: unknown): IGeofencing | null {
    if (!geofencing || typeof geofencing !== 'object') {
      return null;
    }

    const geo = geofencing as Record<string, unknown>;
    const installs: IGeofencing['installs'] = [];

    if (Array.isArray(geo.installs)) {
      for (const install of geo.installs) {
        if (typeof install === 'object' && install !== null) {
          const i = install as Record<string, unknown>;
          installs.push({
            id: typeof i._id === 'string' ? i._id : (typeof i.id === 'string' ? i.id : ''),
            active: i.active === true,
          });
        }
      }
    }

    return {
      installs,
      lat: typeof geo.lat === 'number' ? geo.lat : null,
      long: typeof geo.long === 'number' ? geo.long : null,
    };
  }

  /**
   * Parse installation object
   */
  private parseInstallation(install: Record<string, unknown>, rawResponse: unknown): IInstall {
    // Parse operation mode
    const userConfig = install.user as Record<string, unknown> | undefined;
    const heatCoolAuto = userConfig?.heatcool_auto_01 as Record<string, unknown> | undefined;
    const operationMode: IOperationMode = {
      heating: heatCoolAuto?.heating === true,
      cooling: heatCoolAuto?.cooling === true,
      manual: heatCoolAuto?.manual === true,
    };

    // Parse controllers
    const controllers: IController[] = [];
    if (Array.isArray(install.controllers)) {
      for (const ctrl of install.controllers) {
        if (typeof ctrl === 'object' && ctrl !== null) {
          const c = ctrl as Record<string, unknown>;
          controllers.push({
            number: typeof c.number === 'number' ? c.number : 0,
            unique: typeof c.unique === 'string' ? c.unique : null,
            zoneRefs: Array.isArray(c.zones) ? c.zones.filter((z): z is string => typeof z === 'string') : [],
          });
        }
      }
    }

    // Parse groups and zones
    const groups: IGroup[] = [];
    if (Array.isArray(install.groups)) {
      for (const grp of install.groups) {
        if (typeof grp === 'object' && grp !== null) {
          const g = grp as Record<string, unknown>;
          const zones: IZone[] = [];

          if (Array.isArray(g.zones)) {
            for (const zn of g.zones) {
              if (typeof zn === 'object' && zn !== null) {
                const z = zn as Record<string, unknown>;
                const channels: IChannel[] = [];

                if (Array.isArray(z.channels)) {
                  for (const ch of z.channels) {
                    if (typeof ch === 'object' && ch !== null) {
                      channels.push(this.parseChannel(ch as Record<string, unknown>));
                    }
                  }
                }

                // Find controller reference for this zone
                const zoneId = typeof z._id === 'string' ? z._id : '';
                const controllerRef = controllers.find(c => c.zoneRefs.includes(zoneId))?.unique || null;

                zones.push({
                  id: zoneId,
                  number: typeof z.number === 'number' ? z.number : 0,
                  name: typeof z.name === 'string' ? z.name : '',
                  channels,
                  controllerRef,
                });
              }
            }
          }

          groups.push({
            id: typeof g._id === 'string' ? g._id : '',
            name: typeof g.name === 'string' ? g.name : '',
            zones,
          });
        }
      }
    }

    // Parse mixed circuits
    const mixedCircuits: IMixedCircuit[] = [];
    if (Array.isArray(install.mixedCircuits)) {
      for (const mc of install.mixedCircuits) {
        if (typeof mc === 'object' && mc !== null) {
          mixedCircuits.push(this.parseMixedCircuit(mc as Record<string, unknown>));
        }
      }
    }

    // Parse user settings
    const userSettings = userConfig ? this.parseUserSettings(userConfig) : null;

    // Parse installer settings
    const installerConfig = install.installer as Record<string, unknown> | undefined;
    const installerSettings = installerConfig ? this.parseInstallerSettings(installerConfig) : null;

    // Determine which outside temperature to use
    // If number_outsidetemp is 0, no physical sensor is present - set to null
    // Otherwise use outside_temp (primary sensor) or fall back to outsideTempFiltered
    const hasOutsideTempSensor = typeof install.number_outsidetemp === 'number' && install.number_outsidetemp > 0;
    let outsideTemp: ITemperature;
    let outsideTempFiltered: ITemperature;
    
    if (hasOutsideTempSensor) {
      // Physical sensor present - use outside_temp
      outsideTemp = this.parseTemperature(install.outside_temp);
      outsideTempFiltered = this.parseTemperature(install.outsideTempFiltered);
    } else {
      // No physical sensor - set to null
      outsideTemp = { celsius: null, fahrenheit: null, raw: null };
      outsideTempFiltered = { celsius: null, fahrenheit: null, raw: null };
    }

    return {
      id: typeof install._id === 'string' ? install._id : '',
      unique: typeof install.unique === 'string' ? install.unique : '',
      name: typeof install.name === 'string' ? install.name : '',
      address: typeof install.address === 'string' ? install.address : null,
      version: typeof install.version === 'string' ? install.version : null,
      connectionState: install.connectionState === true,
      timezone: typeof install.timezone === 'string' ? install.timezone : null,
      absenceLevel: typeof install.absenceLevel === 'number' ? install.absenceLevel : null,
      geoInstallActive: install.geoInstallActive === true,
      outsideTemperature: outsideTemp,
      outsideTemperatureFiltered: outsideTempFiltered,
      coolingConditions: typeof install.coolingConditions === 'number' ? install.coolingConditions : null,
      operationMode,
      numberOfControllers: typeof install.number_cc === 'number' ? install.number_cc : null,
      numberOfMixedCircuits: typeof install.number_mixed === 'number' ? install.number_mixed : null,
      controllers,
      groups,
      mixedCircuits,
      userSettings,
      installerSettings,
      raw: rawResponse,
    };
  }

  /**
   * Parse channel data
   */
  private parseChannel(channel: Record<string, unknown>): IChannel {
    const ccConfigBits = channel.cc_config_bits as Record<string, unknown> | undefined;
    const channelConfig = channel.channel_config as Record<string, unknown> | undefined;

    // Parse channel_zone - default to 0 if missing
    const channelZone = typeof channel.channel_zone === 'number' ? channel.channel_zone : 0;
    
    // Parse controllerNumber - can be string or number in API response
    let controllerNumber: number | null = null;
    if (typeof channel.controllerNumber === 'number') {
      controllerNumber = channel.controllerNumber;
    } else if (typeof channel.controllerNumber === 'string') {
      const parsed = parseInt(channel.controllerNumber, 10);
      controllerNumber = isNaN(parsed) ? null : parsed;
    }
    
    return {
      id: typeof channel._id === 'string' ? channel._id : '',
      channelZone: channelZone,
      controllerNumber: controllerNumber,
      currentTemperature: this.parseTemperature(channel.temp_zone),
      setpointTemperature: this.parseTemperature(channel.setpoint_used),
      humidity: typeof channel.humidity === 'number' ? channel.humidity : null,
      dewpoint: typeof channel.dewpoint === 'number' ? channel.dewpoint / 10 : null,
      openWindow: channel.openWindow === true,
      lowBattery: channel.lowBattery === true,
      mode: typeof channel.mode_permanent === 'number' ? channel.mode_permanent : null,
      demand: typeof channel.demand === 'number' ? channel.demand : null,
      config: {
        heating: channelConfig?.heating === true,
        cooling: channelConfig?.cooling === true,
        ringActivation: ccConfigBits?.ring_activation === true,
        locked: ccConfigBits?.lock === true,
      },
      setpoints: {
        heatingNormal: this.parseTemperature(channel.setpoint_h_normal),
        heatingReduced: this.parseTemperature(channel.setpoint_h_reduced),
        heatingStandby: this.parseTemperature(channel.setpoint_h_standby),
        coolingNormal: this.parseTemperature(channel.setpoint_c_normal),
        coolingReduced: this.parseTemperature(channel.setpoint_c_reduced),
      },
      raw: channel,
    };
  }

  /**
   * Parse mixed circuit data
   */
  private parseMixedCircuit(circuit: Record<string, unknown>): IMixedCircuit {
    const pumps: IPump[] = [];
    
    if (Array.isArray(circuit.PUMPx)) {
      for (const pump of circuit.PUMPx) {
        if (typeof pump === 'object' && pump !== null) {
          const p = pump as Record<string, unknown>;
          const values = Array.isArray(p.values) && p.values.length > 0 ? p.values[0] : null;
          if (values && typeof values === 'object') {
            const v = values as Record<string, unknown>;
            pumps.push({
              number: typeof p.number === 'number' ? p.number : 0,
              on: v.pumpOn === true,
              tonSeconds: typeof v.ton === 'number' ? v.ton : null,
              toffSeconds: typeof v.toff === 'number' ? v.toff : null,
            });
          }
        }
      }
    }

    // Parse digital inputs (if present)
    const digitalInputs: IDi[] = [];
    if (Array.isArray(circuit.DIx)) {
      for (const di of circuit.DIx) {
        if (typeof di === 'object' && di !== null) {
          const d = di as Record<string, unknown>;
          digitalInputs.push({
            number: typeof d.number === 'number' ? d.number : 0,
            state: d.state === true,
            type: typeof d.type === 'string' ? d.type : null,
          });
        }
      }
    }

    // Parse digital outputs (if present)
    const digitalOutputs: IDo[] = [];
    if (Array.isArray(circuit.DOx)) {
      for (const dout of circuit.DOx) {
        if (typeof dout === 'object' && dout !== null) {
          const d = dout as Record<string, unknown>;
          digitalOutputs.push({
            number: typeof d.number === 'number' ? d.number : 0,
            state: d.state === true,
            type: typeof d.type === 'string' ? d.type : null,
          });
        }
      }
    }

    return {
      number: typeof circuit.number === 'number' ? circuit.number : 0,
      setpoint: this.parseTemperature(circuit.mixed_circuit1_setpoint),
      supply: this.parseTemperature(circuit.mixed_circuit1_supply),
      return: this.parseTemperature(circuit.mixed_circuit1_return),
      opening: typeof circuit.mixed_circuit1_opening === 'number' ? circuit.mixed_circuit1_opening : null,
      pumps,
      digitalInputs,
      digitalOutputs,
    };
  }

  /**
   * Parse user settings
   */
  private parseUserSettings(userConfig: Record<string, unknown>): IUserSettings {
    const degreef = userConfig.degreef as Record<string, unknown> | undefined;
    const heatcoolAuto = userConfig.heatcool_auto_01 as Record<string, unknown> | undefined;
    const partyTimeActive = userConfig.partyTimeActive === true;
    const partyTimeStart = typeof userConfig.partyTimeStart === 'string' ? userConfig.partyTimeStart : null;
    const partyTimePeriod = typeof userConfig.partyTimePeriod === 'string' ? parseInt(userConfig.partyTimePeriod) : null;

    return {
      degreef: degreef?.unit === 'true',
      heatcoolAuto: {
        heating: heatcoolAuto?.heating === true,
        cooling: heatcoolAuto?.cooling === true,
        manual: heatcoolAuto?.manual === true,
      },
      partyMode: {
        active: partyTimeActive,
        startTime: partyTimeStart,
        periodMinutes: partyTimePeriod,
      },
      language: typeof userConfig.language === 'string' ? userConfig.language : null,
      raw: userConfig,
    };
  }

  /**
   * Parse installer settings
   */
  private parseInstallerSettings(installerConfig: Record<string, unknown>): IInstallerSettings {
    return {
      softwareVersion: typeof installerConfig.softwareVersion === 'string' ? installerConfig.softwareVersion : null,
      signalPower: typeof installerConfig.signalPower === 'number' ? installerConfig.signalPower : null,
      numberOfControllers: typeof installerConfig.number_cc === 'number' ? installerConfig.number_cc : null,
      numberOfMixedCircuits: typeof installerConfig.number_mx_circ === 'number' ? installerConfig.number_mx_circ : null,
      numberOfRooms: typeof installerConfig.number_rooms === 'number' ? installerConfig.number_rooms : null,
      numberOfPumps: typeof installerConfig.number_pump === 'number' ? installerConfig.number_pump : null,
      raw: installerConfig,
    };
  }

  /**
   * Parse temperature value from Fahrenheit×10 to multiple formats
   */
  private parseTemperature(value: unknown): ITemperature {
    if (typeof value !== 'number') {
      return { celsius: null, fahrenheit: null, raw: null };
    }

    const fahrenheit = value / 10;
    const celsius = ((fahrenheit - 32) * 5) / 9;

    return {
      celsius: Math.round(celsius * 10) / 10,
      fahrenheit: Math.round(fahrenheit * 10) / 10,
      raw: value,
    };
  }

  /**
   * Type guard to validate response structure
   */
  private isValidResponse(response: unknown): response is InstallationDataApiResponseV2 {
    if (!response || typeof response !== 'object') {
      return false;
    }

    const r = response as Record<string, unknown>;

    // Check if we have data structure
    if (!r.data || typeof r.data !== 'object') {
      return false;
    }

    const data = r.data as Record<string, unknown>;
    if (!data.user || typeof data.user !== 'object') {
      return false;
    }

    const user = data.user as Record<string, unknown>;
    if (!Array.isArray(user.installs)) {
      return false;
    }

    return true;
  }

  /**
   * Parse from JSON string
   * 
   * @param jsonString - JSON string containing getInstallationData response
   * @param targetUnique - Optional unique ID to filter specific installation
   * @returns Parsed user data
   * @throws Error if JSON is invalid or response structure is wrong
   */
  parseFromJson(jsonString: string, targetUnique?: string): IUser {
    try {
      const response = JSON.parse(jsonString);
      return this.parse(response, targetUnique);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate that an object has no raw fields
   * 
   * @param obj - Object to validate
   * @param path - Current path for error reporting
   * @throws Error if raw fields are found
   */
  private validateNoRawFields(obj: any, path: string = 'root'): void {
    if (obj === null || obj === undefined) return;
    
    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => this.validateNoRawFields(item, `${path}[${idx}]`));
      return;
    }
    
    if (typeof obj === 'object') {
      for (const key in obj) {
        if (key === 'raw') {
          throw new Error(`Found 'raw' field at ${path}.${key} - typed object should not contain raw fields`);
        }
        this.validateNoRawFields(obj[key], `${path}.${key}`);
      }
    }
  }

  /**
   * Remove raw fields from parsed data to get clean typed objects
   * 
   * @param parsed - Parsed user data with raw fields
   * @returns Clean typed data without raw fields
   * @throws Error if validation fails
   */
  getTyped(parsed: IUser): Omit<IUser, 'raw'> & {
    installs: Array<Omit<IInstall, 'raw'> & {
      groups: Array<Omit<IGroup, 'raw'> & {
        zones: Array<Omit<IZone, 'raw'> & {
          channels: Array<Omit<IChannel, 'raw'>>;
        }>;
      }>;
      userSettings: Omit<IUserSettings, 'raw'> | null;
      installerSettings: Omit<IInstallerSettings, 'raw'> | null;
    }>;
  } {
    const removeRaw = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(removeRaw);
      if (typeof obj === 'object') {
        const cleaned: any = {};
        for (const key in obj) {
          if (key !== 'raw') {
            cleaned[key] = removeRaw(obj[key]);
          }
        }
        return cleaned;
      }
      return obj;
    };

    const result = removeRaw({
      id: parsed.id,
      email: parsed.email,
      createdAt: parsed.createdAt,
      language: parsed.language,
      roles: parsed.roles,
      geofencing: parsed.geofencing,
      installs: parsed.installs.map(install => ({
        id: install.id,
        unique: install.unique,
        name: install.name,
        address: install.address,
        version: install.version,
        connectionState: install.connectionState,
        timezone: install.timezone,
        absenceLevel: install.absenceLevel,
        geoInstallActive: install.geoInstallActive,
        outsideTemperature: install.outsideTemperature,
        outsideTemperatureFiltered: install.outsideTemperatureFiltered,
        coolingConditions: install.coolingConditions,
        operationMode: install.operationMode,
        numberOfControllers: install.numberOfControllers,
        numberOfMixedCircuits: install.numberOfMixedCircuits,
        groups: install.groups,
        controllers: install.controllers,
        mixedCircuits: install.mixedCircuits,
        userSettings: install.userSettings,
        installerSettings: install.installerSettings,
      })),
    });

    // Validate that no raw fields exist
    this.validateNoRawFields(result);

    return result;
  }

  /**
   * Get a summary string of parsed user data
   * 
   * @param parsed - Parsed user data
   * @returns Human-readable summary
   */
  getSummary(parsed: IUser): string {
    const lines: string[] = [];
    lines.push(`User: ${parsed.email} (${parsed.id})`);
    lines.push(`Roles: ${parsed.roles.join(', ')}`);
    lines.push(`Installations: ${parsed.installs.length}`);
    
    parsed.installs.forEach((install, idx) => {
      lines.push(`\n[${idx + 1}] Installation: ${install.name} (${install.unique})`);
      if (install.address) {
        lines.push(`    Address: ${install.address}`);
      }
      lines.push(`    Connected: ${install.connectionState ? 'Yes' : 'No'}`);
      if (install.version) {
        lines.push(`    Version: ${install.version}`);
      }
      if (install.outsideTemperature.celsius !== null) {
        lines.push(`    Outside Temperature: ${install.outsideTemperature.celsius}°C`);
      }
      lines.push(`    Operation Mode: Heating=${install.operationMode.heating}, Cooling=${install.operationMode.cooling}`);
      lines.push(`    Groups: ${install.groups.length}, Controllers: ${install.controllers.length}, Mixed Circuits: ${install.mixedCircuits.length}`);
      
      install.groups.forEach(group => {
        lines.push(`\n      Group: ${group.name}`);
        group.zones.forEach(zone => {
          lines.push(`        Zone ${zone.number}: ${zone.name} (${zone.channels.length} channels)`);
          zone.channels.forEach(channel => {
            const temp = channel.currentTemperature.celsius;
            const setpoint = channel.setpointTemperature.celsius;
            const tempStr = temp !== null ? `${temp}°C` : 'N/A';
            const setpointStr = setpoint !== null ? `${setpoint}°C` : 'N/A';
            lines.push(`          Channel ${channel.channelZone}: ${tempStr} → ${setpointStr}`);
            if (channel.humidity !== null) {
              lines.push(`            Humidity: ${channel.humidity}%`);
            }
          });
        });
      });

      if (install.mixedCircuits.length > 0) {
        lines.push(`\n      Mixed Circuits: ${install.mixedCircuits.length}`);
        install.mixedCircuits.forEach(circuit => {
          const supply = circuit.supply.celsius;
          const supplyStr = supply !== null ? `${supply}°C` : 'N/A';
          lines.push(`        Circuit ${circuit.number}: Supply ${supplyStr}, Opening ${circuit.opening}%`);
          lines.push(`          Pumps: ${circuit.pumps.length}, Digital I/O: ${circuit.digitalInputs.length}/${circuit.digitalOutputs.length}`);
        });
      }
    });

    return lines.join('\n');
  }
}

export default InstallationDataParserV2;
