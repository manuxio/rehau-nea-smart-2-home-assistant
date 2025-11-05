/**
 * Parser V2 for REHAU getUserData API responses
 * 
 * This is an improved version with comprehensive typed interfaces for all user data.
 * 
 * @example
 * ```typescript
 * import { UserDataParserV2 } from './parsers/user-data-parser-v2';
 * 
 * const parser = new UserDataParserV2();
 * const result = parser.parse(apiResponse);
 * 
 * console.log(`User: ${result.email}`);
 * result.installations.forEach(install => {
 *   console.log(`Installation: ${install.name}`);
 * });
 * ```
 */

import logger from '../logger';

const isDebug = process.env.LOG_LEVEL === 'debug';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Geofencing installation reference
 */
export interface IGeofencingInstall {
  /** Installation database ID */
  _id: string;
  /** Installation ID reference */
  id: string;
  /** Whether geofencing is active for this installation */
  active: boolean;
}

/**
 * Geofencing data
 */
export interface IGeofencing {
  /** Installations with geofencing enabled */
  installs: IGeofencingInstall[];
  /** Geofencing update date */
  date: string | null;
  /** Latitude */
  lat: number | null;
  /** Longitude */
  long: number | null;
}

/**
 * Program time slot
 */
export interface IProgramTimeSlot {
  /** Start time (HH:MM format) */
  startDate: string;
  /** Activity value (e.g., "absent", "activity") */
  value: string;
  /** End time (HH:MM format) */
  endDate: string;
}

/**
 * Daily program
 */
export interface IDailyProgram {
  /** Time slots for this day */
  values: IProgramTimeSlot[];
  /** Program name (optional) */
  name?: string;
}

/**
 * Weekly program
 */
export interface IWeeklyProgram {
  /** Monday program index */
  monday: number;
  /** Tuesday program index */
  tuesday: number;
  /** Wednesday program index */
  wednesday: number;
  /** Thursday program index */
  thursday: number;
  /** Friday program index */
  friday: number;
  /** Saturday program index */
  saturday: number;
  /** Sunday program index */
  sunday: number;
  /** Program name */
  name: string;
}

/**
 * Programs configuration
 */
export interface IPrograms {
  /** Daily programs (up to 10) */
  days: IDailyProgram[];
  /** Weekly programs (up to 5) */
  weeks: IWeeklyProgram[];
}

/**
 * Associated user or installer
 */
export interface IAssociatedUser {
  /** User database ID */
  _id: string;
  /** User email */
  email: string;
  /** User roles */
  roles: string[];
  /** Geofencing active for this user */
  geoActive: boolean;
  /** Geofencing distance (if available) */
  geofencing?: {
    distance: number;
    direction: string;
  };
}

/**
 * Installation association data
 */
export interface IAssociation {
  /** Regular users with access */
  users: IAssociatedUser[];
  /** Installers with access */
  installers: IAssociatedUser[];
}

/**
 * Absence mode configuration
 */
export interface IAbsenceMode {
  /** Zones affected by absence mode */
  zones: string[];
}

/**
 * Vacation mode configuration
 */
export interface IVacation {
  /** Vacation start date */
  startDate?: string;
  /** Vacation end date */
  endDate?: string;
  /** Zones affected by vacation mode */
  zones: string[];
}

/**
 * Party mode configuration
 */
export interface IPartyMode {
  /** Zones affected by party mode */
  zones: string[];
}

/**
 * Installation information in user data
 */
export interface IInstallationInfo {
  /** Installation database ID */
  _id: string;
  /** Installation unique identifier */
  unique: string;
  /** Installation display name */
  name: string;
  /** Installation address */
  address: string | null;
  /** Installation city */
  city: string | null;
  /** Installation country */
  country: string | null;
  /** Installation street */
  street: string | null;
  /** Installation ZIP code */
  zip: string | null;
  /** Installation icon */
  icon: string | null;
  /** Latitude */
  lat: number | null;
  /** Longitude */
  long: number | null;
  /** Installation owner ID */
  owner: string | null;
  /** Timezone */
  timezone: string | null;
  /** Connection state */
  connectionState: boolean;
  /** Geofencing active */
  geoInstallActive: boolean;
  /** Absence level */
  absenceLevel: number | null;
  /** Last report date */
  lastReportDate: string | null;
  /** Last connection date */
  lastConnection: string | null;
  
  // Configuration
  /** Number of controllers */
  number_cc: number | null;
  /** Number of mixed circuits */
  number_mixed: number | null;
  /** Number of rooms */
  number_room_system: number | null;
  /** Number of outside temperature sensors */
  number_outsidetemp: number | null;
  
  // Mode configurations
  /** Absence mode */
  absenceMode: IAbsenceMode;
  /** Vacation mode */
  vacation: IVacation;
  /** Party mode */
  partyMode: IPartyMode;
  
  // Access control
  /** Associated users and installers */
  association: IAssociation;
  
  // Programs
  /** Heating/cooling programs */
  programs: IPrograms;
  
  /** Raw installation data for debugging */
  raw: Record<string, unknown>;
}

/**
 * User data (top level)
 */
export interface IUserData {
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
  /** Installations accessible to this user */
  installations: IInstallationInfo[];
  /** Raw API response for debugging */
  raw: unknown;
}

/**
 * Raw API response structure from getUserData endpoint
 */
export interface UserDataApiResponseV2 {
  success?: boolean;
  data?: {
    token?: string;
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
 * Parser V2 class for getUserData API responses
 */
export class UserDataParserV2 {
  /**
   * Parse a getUserData API response
   * 
   * @param response - Raw API response from getUserData endpoint
   * @returns Parsed user data with all installations
   * @throws Error if response is invalid
   */
  parse(response: unknown): IUserData {
    if (isDebug) logger.debug('🔍 [UserDataParserV2] Starting parse...');
    
    // Validate response structure
    if (!this.isValidResponse(response)) {
      throw new Error('Invalid getUserData response: missing required fields');
    }

    const apiResponse = response as UserDataApiResponseV2;
    const userData = apiResponse.data!.user!;

    if (isDebug) {
      logger.debug(`🔍 [UserDataParserV2] User ID: ${userData._id}`);
      logger.debug(`🔍 [UserDataParserV2] Email: ${userData.email}`);
      logger.debug(`🔍 [UserDataParserV2] Language: ${userData.language}`);
      logger.debug(`🔍 [UserDataParserV2] Roles: ${Array.isArray(userData.roles) ? userData.roles.join(', ') : 'none'}`);
    }

    // Parse geofencing
    if (isDebug) logger.debug('🔍 [UserDataParserV2] Parsing geofencing...');
    const geofencing = this.parseGeofencing(userData.geofencing);
    if (isDebug && geofencing) {
      logger.debug(`🔍 [UserDataParserV2] Geofencing: ${geofencing.installs.length} installs, lat=${geofencing.lat}, long=${geofencing.long}`);
    }

    // Parse installations
    if (isDebug) logger.debug(`🔍 [UserDataParserV2] Parsing ${Array.isArray(userData.installs) ? userData.installs.length : 0} installations...`);
    const installations: IInstallationInfo[] = [];
    if (Array.isArray(userData.installs)) {
      for (let i = 0; i < userData.installs.length; i++) {
        const install = userData.installs[i];
        if (typeof install === 'object' && install !== null) {
          if (isDebug) logger.debug(`🔍 [UserDataParserV2] Parsing installation ${i + 1}/${userData.installs.length}...`);
          const parsed = this.parseInstallation(install as Record<string, unknown>);
          if (isDebug) logger.debug(`🔍 [UserDataParserV2]   - Name: ${parsed.name}, Unique: ${parsed.unique}, Connected: ${parsed.connectionState}`);
          installations.push(parsed);
        }
      }
    }

    if (isDebug) logger.debug(`🔍 [UserDataParserV2] Parse complete. Total installations: ${installations.length}`);

    return {
      id: userData._id || '',
      email: userData.email || '',
      createdAt: userData.createdAt || null,
      language: userData.language || null,
      roles: Array.isArray(userData.roles) ? userData.roles : [],
      geofencing,
      installations,
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
    const installs: IGeofencingInstall[] = [];

    if (Array.isArray(geo.installs)) {
      for (const install of geo.installs) {
        if (typeof install === 'object' && install !== null) {
          const i = install as Record<string, unknown>;
          installs.push({
            _id: typeof i._id === 'string' ? i._id : '',
            id: typeof i.id === 'string' ? i.id : '',
            active: i.active === true,
          });
        }
      }
    }

    return {
      installs,
      date: typeof geo.date === 'string' ? geo.date : null,
      lat: typeof geo.lat === 'number' ? geo.lat : null,
      long: typeof geo.long === 'number' ? geo.long : null,
    };
  }

  /**
   * Parse installation object
   */
  private parseInstallation(install: Record<string, unknown>): IInstallationInfo {
    // Parse absence mode
    const absenceModeData = install.absenceMode as Record<string, unknown> | undefined;
    const absenceMode: IAbsenceMode = {
      zones: Array.isArray(absenceModeData?.zones) ? absenceModeData.zones : [],
    };

    // Parse vacation mode
    const vacationData = install.vacation as Record<string, unknown> | undefined;
    const vacation: IVacation = {
      startDate: typeof vacationData?.startDate === 'string' ? vacationData.startDate : undefined,
      endDate: typeof vacationData?.endDate === 'string' ? vacationData.endDate : undefined,
      zones: Array.isArray(vacationData?.zones) ? vacationData.zones : [],
    };

    // Parse party mode
    const partyModeData = install.partymode as Record<string, unknown> | undefined;
    const partyMode: IPartyMode = {
      zones: Array.isArray(partyModeData?.zones) ? partyModeData.zones : [],
    };

    // Parse association
    const association = this.parseAssociation(install.association);

    // Parse programs
    const programs = this.parsePrograms(install.programs);

    return {
      _id: typeof install._id === 'string' ? install._id : '',
      unique: typeof install.unique === 'string' ? install.unique : '',
      name: typeof install.name === 'string' ? install.name : '',
      address: typeof install.address === 'string' ? install.address : null,
      city: typeof install.city === 'string' ? install.city : null,
      country: typeof install.country === 'string' ? install.country : null,
      street: typeof install.street === 'string' ? install.street : null,
      zip: typeof install.zip === 'string' ? install.zip : null,
      icon: typeof install.icon === 'string' ? install.icon : null,
      lat: typeof install.lat === 'number' ? install.lat : null,
      long: typeof install.long === 'number' ? install.long : null,
      owner: typeof install.owner === 'string' ? install.owner : null,
      timezone: typeof install.timezone === 'string' ? install.timezone : null,
      connectionState: install.connectionState === true,
      geoInstallActive: install.geoInstallActive === true,
      absenceLevel: typeof install.absenceLevel === 'number' ? install.absenceLevel : null,
      lastReportDate: typeof install.lastReportDate === 'string' ? install.lastReportDate : null,
      lastConnection: typeof install.lastConnection === 'string' ? install.lastConnection : null,
      number_cc: typeof install.number_cc === 'number' ? install.number_cc : null,
      number_mixed: typeof install.number_mixed === 'number' ? install.number_mixed : null,
      number_room_system: typeof install.number_room_system === 'number' ? install.number_room_system : null,
      number_outsidetemp: typeof install.number_outsidetemp === 'number' ? install.number_outsidetemp : null,
      absenceMode,
      vacation,
      partyMode,
      association,
      programs,
      raw: install,
    };
  }

  /**
   * Parse association data
   */
  private parseAssociation(association: unknown): IAssociation {
    if (!association || typeof association !== 'object') {
      return { users: [], installers: [] };
    }

    const assoc = association as Record<string, unknown>;
    const users: IAssociatedUser[] = [];
    const installers: IAssociatedUser[] = [];

    if (Array.isArray(assoc.users)) {
      for (const user of assoc.users) {
        if (typeof user === 'object' && user !== null) {
          users.push(this.parseAssociatedUser(user as Record<string, unknown>));
        }
      }
    }

    if (Array.isArray(assoc.installers)) {
      for (const installer of assoc.installers) {
        if (typeof installer === 'object' && installer !== null) {
          installers.push(this.parseAssociatedUser(installer as Record<string, unknown>));
        }
      }
    }

    return { users, installers };
  }

  /**
   * Parse associated user
   */
  private parseAssociatedUser(user: Record<string, unknown>): IAssociatedUser {
    const result: IAssociatedUser = {
      _id: typeof user._id === 'string' ? user._id : '',
      email: typeof user.email === 'string' ? user.email : '',
      roles: Array.isArray(user.roles) ? user.roles : [],
      geoActive: user.geoActive === true,
    };

    if (user.geofencing && typeof user.geofencing === 'object') {
      const geo = user.geofencing as Record<string, unknown>;
      result.geofencing = {
        distance: typeof geo.distance === 'number' ? geo.distance : 0,
        direction: typeof geo.direction === 'string' ? geo.direction : '',
      };
    }

    return result;
  }

  /**
   * Parse programs data
   */
  private parsePrograms(programs: unknown): IPrograms {
    if (!programs || typeof programs !== 'object') {
      return { days: [], weeks: [] };
    }

    const prog = programs as Record<string, unknown>;
    const days: IDailyProgram[] = [];
    const weeks: IWeeklyProgram[] = [];

    if (Array.isArray(prog.days)) {
      for (const day of prog.days) {
        if (typeof day === 'object' && day !== null) {
          const d = day as Record<string, unknown>;
          const values: IProgramTimeSlot[] = [];

          if (Array.isArray(d.values)) {
            for (const slot of d.values) {
              if (typeof slot === 'object' && slot !== null) {
                const s = slot as Record<string, unknown>;
                values.push({
                  startDate: typeof s.startDate === 'string' ? s.startDate : '',
                  value: typeof s.value === 'string' ? s.value : '',
                  endDate: typeof s.endDate === 'string' ? s.endDate : '',
                });
              }
            }
          }

          days.push({
            values,
            name: typeof d.name === 'string' ? d.name : undefined,
          });
        }
      }
    }

    if (Array.isArray(prog.weeks)) {
      for (const week of prog.weeks) {
        if (typeof week === 'object' && week !== null) {
          const w = week as Record<string, unknown>;
          weeks.push({
            monday: typeof w.monday === 'number' ? w.monday : 0,
            tuesday: typeof w.tuesday === 'number' ? w.tuesday : 0,
            wednesday: typeof w.wednesday === 'number' ? w.wednesday : 0,
            thursday: typeof w.thursday === 'number' ? w.thursday : 0,
            friday: typeof w.friday === 'number' ? w.friday : 0,
            saturday: typeof w.saturday === 'number' ? w.saturday : 0,
            sunday: typeof w.sunday === 'number' ? w.sunday : 0,
            name: typeof w.name === 'string' ? w.name : '',
          });
        }
      }
    }

    return { days, weeks };
  }

  /**
   * Type guard to validate response structure
   */
  private isValidResponse(response: unknown): response is UserDataApiResponseV2 {
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
   * @param jsonString - JSON string containing getUserData response
   * @returns Parsed user data
   * @throws Error if JSON is invalid or response structure is wrong
   */
  parseFromJson(jsonString: string): IUserData {
    try {
      const response = JSON.parse(jsonString);
      return this.parse(response);
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
  getTyped(parsed: IUserData): Omit<IUserData, 'raw'> & {
    installations: Array<Omit<IInstallationInfo, 'raw'>>;
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
      installations: parsed.installations,
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
  getSummary(parsed: IUserData): string {
    const lines: string[] = [];
    lines.push(`User: ${parsed.email} (${parsed.id})`);
    lines.push(`Roles: ${parsed.roles.join(', ')}`);
    lines.push(`Installations: ${parsed.installations.length}`);
    
    parsed.installations.forEach((install, idx) => {
      lines.push(`\n[${idx + 1}] Installation: ${install.name} (${install.unique})`);
      if (install.address) {
        lines.push(`    Address: ${install.address}`);
      }
      if (install.city && install.country) {
        lines.push(`    Location: ${install.city}, ${install.country}`);
      }
      lines.push(`    Connected: ${install.connectionState ? 'Yes' : 'No'}`);
      if (install.timezone) {
        lines.push(`    Timezone: ${install.timezone}`);
      }
      lines.push(`    Controllers: ${install.number_cc}, Rooms: ${install.number_room_system}`);
      
      // Association info
      const totalUsers = install.association.users.length + install.association.installers.length;
      if (totalUsers > 0) {
        lines.push(`    Shared with: ${install.association.users.length} users, ${install.association.installers.length} installers`);
      }
      
      // Programs
      if (install.programs.weeks.length > 0) {
        lines.push(`    Programs: ${install.programs.weeks.length} weekly schedules`);
      }
      
      // Vacation mode
      if (install.vacation.zones.length > 0) {
        lines.push(`    Vacation mode: ${install.vacation.zones.length} zones affected`);
        if (install.vacation.startDate && install.vacation.endDate) {
          lines.push(`      From ${install.vacation.startDate} to ${install.vacation.endDate}`);
        }
      }
    });

    return lines.join('\n');
  }
}

export default UserDataParserV2;
