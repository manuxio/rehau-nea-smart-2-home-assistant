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
  // ── Device-sourced readings: `null` until the bridge successfully parses
  // them from the device. Consumers MUST render `null` as a placeholder
  // (e.g. `—`) rather than 0 — that's the whole point of the no-defaults
  // rule. Background: showing `+0.0 °C` for unparsed Calibration was the
  // original complaint; it propagated to every "until we know" field.
  /** Current measured temperature in °C, or `null` if unread. */
  temperature: number | null;
  /** Relative humidity %, or `null` if unread. */
  humidity: number | null;
  /**
   * Active heating setpoint °C — whichever of the three slots below is in use
   * for the current `mode`. Range 5.0..31.0 step 0.5. `null` until read.
   */
  setpointHeating: number | null;
  /** Cooling setpoint °C — range 15.0..35.0 step 0.5. `null` until read. */
  setpointCooling: number | null;
  /**
   * REHAU stores three independent heating setpoints per room. We mirror them
   * so a mode change can target the right slot without overwriting another.
   * `null` until the room-detail page has been parsed at least once.
   */
  setpointNormal: number | null;
  setpointReduced: number | null;
  setpointStandby: number | null;
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
  /** -5.0..+5.0 °C, step 0.1. Installer-only write. `null` until first install fetch. */
  calibrationTemp: number | null;
  /** -25..+25 %, step 1. Installer-only write. `null` until first install fetch. */
  calibrationHumidity: number | null;
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

// ─── User-editable persistent state ─────────────────────────────────────
// Lives in /data/state.json (HA addon persistent dir) so floors + scenes
// survive addon restarts. Bridge loads on boot, SPA edits via REST.

/**
 * Map of zone (REHAU device's zero-based zone index) → floor label
 * (free-form, e.g. "Piano Terra"). An empty/missing label means
 * "unassigned" — the Dashboard sorts those rooms last.
 */
export type FloorAssignments = Record<number, string>;

/** Catalogue of icon names the Scene editor offers (subset of Glyph names). */
export const SCENE_ICONS = [
  // Existing — first because users have already chosen them.
  "sun", "moon", "flame", "snow", "drop",
  "calendar", "clock", "home", "bell", "wrench",
  "sliders", "alert",
  // New common scene patterns: power-off, eco/save-money, sleep,
  // morning routine, work / away, vacation, movie night, party.
  "power", "leaf", "bed", "coffee",
  "briefcase", "plane", "film", "gift",
] as const;
export type SceneIcon = (typeof SCENE_ICONS)[number];

export interface Scene {
  /** Stable id, slug-ish. Server-generated on create. */
  id: string;
  /** User-given name (UI label). */
  name: string;
  /** Icon shown on the Dashboard tile. One of `SCENE_ICONS`. */
  icon: SceneIcon;
  /**
   * The action the scene runs. Two shapes today:
   *
   *  - `applyRoomMode` — single mode applied to every existing room.
   *    This is the v1 "global" form; cheap to author, room-agnostic.
   *
   *  - `perRoom` — explicit `roomId → mode` map. Rooms NOT in the map
   *    are left untouched. Lets the user say e.g. "Sera = bedroom
   *    Normal, kitchen Reduced, everywhere else: skip".
   *
   * Keep both forms so legacy scenes still load. System-mode + energy
   * changes can extend this union further later.
   */
  action:
    | { type: "applyRoomMode"; mode: RoomMode }
    | { type: "perRoom"; rooms: Record<string, RoomMode> };
}

/** Body for POST /api/v1/scenes. */
export type SceneCreate = Omit<Scene, "id">;

export interface RoomCalibration {
  /** Device-side zero-based zone index. */
  zone: number;
  /** -5.0..+5.0 °C, step 0.1. */
  tempOffset: number;
  /** -25..+25 %, step 1. */
  humidityOffset: number;
}

// ─── Bridge ↔ device connection health ──────────────────────────────────
// The bridge keeps a small ring buffer of recent device fetches and exposes
// a coarse-grained "online / degraded / offline" state so HA and the SPA can
// surface "REHAU is slow / unreachable" without polling /healthz.
//
// Tolerance is built in — REHAU is slow and bursty. We don't flip "online"
// to "degraded" on a single failure; we wait for either consecutive failures
// OR a sustained gap with no successful fetch (see core/store.ts).

export type BridgeConnectionState = "online" | "degraded" | "offline";

export interface BridgeConnection {
  state: BridgeConnectionState;
  /** ISO timestamp of the last successful device fetch. `null` if no success yet. */
  lastSuccessAt: string | null;
  /** ISO timestamp of the last attempted device fetch (success or failure). */
  lastAttemptAt: string | null;
  /** Consecutive failures since the last success. Resets to 0 on any success. */
  consecutiveFailures: number;
  /** Short human-readable reason when state is degraded/offline. `null` when online. */
  reason: string | null;
}

export type FetchOutcome = "ok" | "timeout" | "http" | "tcp" | "parse";

export interface FetchTelemetryEntry {
  /** ISO timestamp when the fetch started. */
  at: string;
  /** `GET /menu.html`, `POST /room-page.html`, ... */
  what: string;
  /** Duration ms (request start → response body fully received, or failure). */
  ms: number;
  outcome: FetchOutcome;
  /** HTTP status if `outcome === "http"`. */
  status?: number;
  /** Short error message for non-`ok` outcomes. */
  error?: string;
}

export interface DiagnosticsSnapshot {
  connection: BridgeConnection;
  /** Most recent fetches (up to N), newest first. */
  recent: FetchTelemetryEntry[];
  aggregates: {
    /** Total fetches in the buffer. */
    total: number;
    success: number;
    failure: number;
    /** Average duration of successful fetches in ms. `null` if no successes. */
    avgMsSuccess: number | null;
    /** p95 duration of successful fetches in ms. `null` if < 5 successes. */
    p95MsSuccess: number | null;
  };
  /** Build/runtime versions surfaced on the System page. */
  versions?: {
    /** Internal bridge bundle version (apps/bridge). */
    bridge: string;
    /** Addon release version from rehau-bridge/config.yaml. */
    addon: string;
  };
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
