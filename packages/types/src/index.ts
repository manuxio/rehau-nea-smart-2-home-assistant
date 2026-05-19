// Shared domain types for the REHAU Nea Smart 2 bridge and React app.
// These are the canonical shapes; the generated @rehau/api-client uses them.

export type RoomMode =
  | "standby"
  | "normal"
  | "reduced"
  | "program"
  | "program_override";

export type SystemMode =
  | "heating_only"
  | "cooling_only"
  | "manual_heating"
  | "manual_cooling";

export type EnergyLevel =
  | "normal"
  | "reduced"
  | "standby"
  | "auto"
  | "vacation";

export type AlarmSeverity = "info" | "warning" | "error" | "critical";

export type Role = "user" | "installer";

export type FanLevel = 0 | 1 | 2 | 3 | 4;

export type FlapState = 0 | 1;

export interface Meta {
  /** ISO-8601 timestamp of the last successful read from the device. */
  lastUpdatedAt: string;
}

export interface Room {
  /** Stable client-side id (e.g. `r-arianna`). */
  id: string;
  /** Device-side zero-based zone index used in `room-operating.html` POSTs. */
  zone: number;
  name: string;
  /** Current measured temperature in °C. */
  temperature: number;
  /** Relative humidity %. */
  humidity: number;
  /**
   * Active heating setpoint °C — whichever of the three slots below is in use
   * for the current `mode`. Range 5.0..31.0 step 0.5.
   */
  setpointHeating: number;
  /** Cooling setpoint °C — range 15.0..35.0 step 0.5. */
  setpointCooling: number;
  /**
   * REHAU stores three independent heating setpoints per room. We mirror them
   * so a mode change can target the right slot without overwriting another.
   * Populated from the room-detail page on first poll; default to the active
   * value until then.
   */
  setpointNormal: number;
  setpointReduced: number;
  setpointStandby: number;
  mode: RoomMode;
  /** True when the room is currently overriding its program. */
  programOverride: boolean;
  hasFan: boolean;
  hasFlap: boolean;
  hasLight: boolean;
  fan: FanLevel;
  flap: FlapState;
  light: boolean;
  /** True when the fancoil motor is currently running (REHAU paints its icon pink). */
  fanRunning: boolean;
  /** -5.0..+5.0 °C, step 0.1. Installer-only write. */
  calibrationTemp: number;
  /** -25..+25 %, step 1. Installer-only write. */
  calibrationHumidity: number;
  /** Daily program slot 1..10 currently assigned. */
  programDailyId: number;
  /** Weekly program slot 1..5 currently assigned. */
  programWeeklyId: number;
  /** UI-only floor label, sourced from ROOM_FLOORS config. */
  floor: string;
  // ── room-set-up.html flags ─────────────────────────────────
  /** "Blocca display": physical thermostat buttons are inert when true. */
  lock: boolean;
  /** "Abilita auto avviamento": adaptive pre-heat before scheduled slots. */
  autoStart: boolean;
  /** "Rilevamento finestra aperta": auto setpoint reduction on rapid temp drop. */
  windowDetection: boolean;
  meta: Meta;
}

export interface SystemState {
  /** Human-readable name of this installation (from INSTALLATION_NAME env). */
  installationName: string;
  operatingMode: SystemMode;
  energyLevel: EnergyLevel;
  /** Outdoor temperature in °C. */
  outdoorTemp: number;
  /** Offset °C applied to the outdoor temp before heating-mode decision. */
  outdoorOffset: number;
  /** MM-DD inclusive start of heating season. */
  seasonStart: string;
  /** MM-DD inclusive end of heating season. */
  seasonEnd: string;
  /** True when the bridge can reach the device. */
  reachable: boolean;
  fw: FirmwareInfo;
  uniqueCode: string;
  ssid: string;
  meta: Meta;
}

export interface FirmwareInfo {
  master: string;
  web: string;
  /** Map of "umoduleN" → version. */
  umodules: Record<string, string>;
}

export interface AlarmMessage {
  id: string;
  severity: AlarmSeverity;
  source: string;
  /** REHAU fault code, e.g. `2/02/06/06/01/051/3`. */
  code: string;
  title: string;
  detail: string;
  startedAt: string;
  resolvedAt: string | null;
}

export interface DailyProgram {
  id: number;
  name: string;
  /** Exactly 96 quarter-hour bits (0 absence / 1 presence) from 00:00. */
  bits: number[];
}

export interface DailyProgramInterval {
  /** HH:MM, quarter-hour aligned. */
  start: string;
  /** HH:MM, quarter-hour aligned, exclusive. `24:00` represented as `00:00` of next day → use end=`24:00` literal in API. */
  end: string;
}

export interface WeeklyProgram {
  id: number;
  name: string;
  /** Mon..Sun → daily program id 1..10. */
  days: [number, number, number, number, number, number, number];
}

export type DeviceKind = "base" | "u-module" | "thermostat" | "mixed-circuit";

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  fwVersion: string;
  online: boolean;
  /** Hours since power-on. */
  uptime: number;
}

export interface IOSnapshot {
  master: {
    rz: number[];
    relay: number[];
    di: number[];
  };
  umodules: Record<string, {
    relay: number[];
    di: number[];
    /** Analog input temperatures °C; `null` for unconnected. */
    aiC: (number | null)[];
    /** Analog output 0..100. */
    aoPct: number;
  }>;
}

export interface Topology {
  baseModules: number;
  rModules: number;
  uModules: number;
  rooms: number;
  mixedCircuits: number;
  dehumidifiers: number;
}

export interface RoomCalibration {
  /** Device-side zero-based zone index. */
  zone: number;
  /** -5.0..+5.0 °C, step 0.1. */
  tempOffset: number;
  /** -25..+25 %, step 1. */
  humidityOffset: number;
}

export interface CalibrationState {
  /** Outdoor sensor offset °C (-10..+10 step 0.1). */
  outdoor: number;
  rooms: RoomCalibration[];
  meta: Meta;
}

export interface UptimeState {
  years: number;
  days: number;
  hours: number;
}

export interface HeatCurveState {
  /** Heating curve slope in normal mode. */
  slopeNormal: number;
  slopeAbsent: number;
  startNormal: number;
  startAbsent: number;
  /** Reduction in K applied to flow temp in reduced mode. */
  reductionK: number;
  minFlowNormalC: number;
  minFlowAbsentC: number;
  maxFlowNormalC: number;
  maxFlowAbsentC: number;
  meta: Meta;
}

// ───────────── installer settings groups ─────────────

export type InstallerSettingsGroup =
  | "curve"     // circSett.html      — mixed-circuit heating curve + PI
  | "heatcool"  // hCSett.html        — global heat/cool limits
  | "devices"   // deviSett.html      — boiler, chiller, pumps, valves
  | "functions" // funcSett.html      — anti-block schedules
  | "pid"       // advSett.html       — room PID parameters
  | "fancoil";  // installer-fanc-settings.html — fan coil timings

export type InstallerSettingFieldValue = number | boolean;

export interface InstallerSettingField {
  /** Internal REHAU field name (e.g. "HA00", "MIX10"). Used as id by the UI. */
  name: string;
  label: string;
  kind: "number" | "boolean";
  /** Optional unit displayed next to the value (e.g. "°C", "K"). */
  unit?: string;
  /** For numbers. */
  min?: number;
  max?: number;
  step?: number;
  /** Free-form note shown under the field (e.g. "0 disabilita"). */
  hint?: string;
  /** Current value. */
  value: InstallerSettingFieldValue;
}

export interface InstallerSettingsSnapshot {
  group: InstallerSettingsGroup;
  fields: InstallerSettingField[];
  meta: Meta;
}

/** Partial write — only the fields mentioned change. */
export interface InstallerSettingsPatch {
  fields: Array<Pick<InstallerSettingField, "name" | "value">>;
}

// ───────────── auth ─────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  role: Role;
}

export interface AuthIdentity {
  username: string;
  role: Role;
}

// ───────────── SSE event envelopes ─────────────

export type SSEEvent =
  | { event: "room.state"; data: Partial<Room> & { id: string } }
  | { event: "system.state"; data: Partial<SystemState> }
  | { event: "messages.new"; data: AlarmMessage[] }
  | { event: "io.snapshot"; data: IOSnapshot }
  | { event: "device.status"; data: { online: boolean; lastReadAt: string } };

// ───────────── REHAU domain constants ─────────────

export const SETPOINT_HEAT_MIN = 5.0;
export const SETPOINT_HEAT_MAX = 31.0;
export const SETPOINT_COOL_MIN = 15.0;
export const SETPOINT_COOL_MAX = 35.0;
export const SETPOINT_STEP = 0.5;
export const CALIB_TEMP_MIN = -5.0;
export const CALIB_TEMP_MAX = 5.0;
export const CALIB_TEMP_STEP = 0.1;
export const CALIB_HUMIDITY_MIN = -25;
export const CALIB_HUMIDITY_MAX = 25;
export const QUARTER_HOURS_PER_DAY = 96;

/** Map REHAU room `mode` string → HA `climate.mode` (lossy). */
export const ROOM_MODE_TO_HA_MODE: Record<RoomMode, "off" | "heat" | "cool" | "auto"> = {
  standby: "off",
  normal: "heat",
  reduced: "heat",
  program: "auto",
  program_override: "auto",
};
