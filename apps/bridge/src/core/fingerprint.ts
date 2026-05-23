// Installation fingerprint — the single source of truth for "what does
// this addon installation look like right now". Same shape used by:
//
//   1. The boot-time `INSTALLATION_FINGERPRINT` log line (emitted once,
//      after the kickoff polls have settled, so the snapshot reflects a
//      fully-polled installation, not a half-baked partial one).
//
//   2. `GET /api/v1/diagnostics/fingerprint`, what the SPA's System tab
//      reads when the user taps "Copy diagnostic snapshot" to paste
//      into a bug report.
//
// Keep this dependency-light. The function should be pure relative to
// the inputs so it's trivially testable. Don't put secrets in the
// payload — no installer code, no JWT secret, no bcrypt hash, no
// MQTT password. The device URL and uniqueCode are already in the
// addon's log output at info level, so they're already shareable; the
// caller (SPA or user) can redact further if they want.
import type { Config } from "../config.js";
import type { Store } from "./store.js";

export interface FingerprintRoom {
  zone: number;
  name: string;
  id: string;
  hasFan: boolean;
  hasFlap: boolean;
  hasLight: boolean;
  mode: string;
  temperature: number | null;
  setpointHeating: number | null;
  setpointCooling: number | null;
}

export interface InstallationFingerprint {
  /** When this fingerprint was generated. Useful when comparing two
   *  snapshots from the same user a few minutes apart. */
  emittedAt: string;
  /** Process uptime in seconds at emission. Helps spot "fingerprint at
   *  3 s after boot" → polls couldn't have completed. */
  uptimeSeconds: number;
  addonVersion: string;
  bridgeVersion: string;
  nodeVersion: string;
  platform: string;
  deviceMode: string;
  deviceUrl: string;
  installationName: string;
  uniqueCode: string | null;
  fw: { master: string; web: string; umodules: Record<string, string> };
  operatingMode: string;
  energyLevel: string;
  installerAccess: boolean;
  mqtt: "enabled" | "disabled";
  exposeIo: boolean;
  exposeCalibration: boolean;
  /** Live REHAU connection state from the bridge's state machine — the
   *  single most common cause of bug reports is "REHAU went unreachable
   *  for an hour", and this captures it. */
  connection: {
    state: string;
    consecutiveFailures: number;
    lastSuccessAt: string | null;
    reason: string | null;
  };
  /** Aggregate fetch outcomes over the bridge's rolling ring buffer.
   *  Helps separate "REHAU is unreachable" from "REHAU is responding
   *  but extremely slow" from "everything is fine". */
  fetches: {
    total: number;
    success: number;
    failure: number;
    avgMsSuccess: number | null;
    p95MsSuccess: number | null;
  };
  roomCount: number;
  rooms: FingerprintRoom[];
}

export const BRIDGE_VERSION = "0.1.0";

export const buildFingerprint = (store: Store, config: Config): InstallationFingerprint => {
  const sys = store.getSystem();
  const rooms = store.listRooms();
  const diag = store.getDiagnostics();
  return {
    emittedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    addonVersion: process.env.ADDON_VERSION ?? "dev",
    bridgeVersion: BRIDGE_VERSION,
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    deviceMode: config.DEVICE_MODE,
    deviceUrl: config.DEVICE_URL,
    installationName: config.INSTALLATION_NAME,
    uniqueCode: sys.uniqueCode || null,
    fw: sys.fw,
    operatingMode: sys.operatingMode,
    energyLevel: sys.energyLevel,
    installerAccess: Boolean(config.DEVICE_INSTALLER_CODE),
    mqtt: config.MQTT_URL ? "enabled" : "disabled",
    exposeIo: config.EXPOSE_IO,
    exposeCalibration: config.EXPOSE_CALIBRATION,
    connection: {
      state: diag.connection.state,
      consecutiveFailures: diag.connection.consecutiveFailures,
      lastSuccessAt: diag.connection.lastSuccessAt,
      reason: diag.connection.reason,
    },
    fetches: diag.aggregates,
    roomCount: rooms.length,
    rooms: rooms.map((r) => ({
      zone: r.zone,
      name: r.name,
      id: r.id,
      hasFan: r.hasFan,
      hasFlap: r.hasFlap,
      hasLight: r.hasLight,
      mode: r.mode,
      temperature: r.temperature,
      setpointHeating: r.setpointHeating,
      setpointCooling: r.setpointCooling,
    })),
  };
};
