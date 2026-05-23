import dotenv from "dotenv";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

// Resolve .env from the repo root so `tsx watch src/main.ts` works regardless of cwd.
dotenv.config({ path: resolve(import.meta.dirname, "../../../.env") });

import { loadConfig } from "./config.js";
import { Commander } from "./core/commander.js";
import { buildFingerprint } from "./core/fingerprint.js";
import {
  loadPersistentState,
  savePersistentState,
  type PersistentState,
} from "./core/persistent-state.js";
import { Poller } from "./core/poller.js";
import { Store } from "./core/store.js";
import { DeviceClient } from "./device/client.js";
import { InstallerSession } from "./device/installer.js";
import {
  LiveDeviceSource,
  MockDeviceSource,
  type DeviceSource,
} from "./device/source.js";
import { buildServer } from "./http/server.js";
import { MqttBridge } from "./mqtt/bridge.js";
import { createLogger } from "./observability/log.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger(config);

  logger.info({
    deviceMode: config.DEVICE_MODE,
    deviceUrl: config.DEVICE_URL,
    installerAccess: Boolean(config.DEVICE_INSTALLER_CODE),
    mqtt: config.MQTT_URL ? "enabled" : "disabled",
  }, "bridge starting");

  // Store first so we can wire device-fetch telemetry into it as the
  // DeviceClient is constructed — every request flows through
  // `store.recordFetch`, which drives the connection state machine.
  // Seed only when running against the mock device — live mode boots
  // with empty rooms and every field starts as `null` until parsed.
  const store = new Store({ seed: config.DEVICE_MODE !== "live" });
  // The installation name comes from env, not the device — patch it in
  // immediately so the first GET /api/v1/system already returns the right
  // label (before the first device poll lands).
  store.patchSystem({ installationName: config.INSTALLATION_NAME });

  // ─── Persistent user state (floors + scenes) ────────────────────────
  // /data/state.json on the HA addon volume. Loaded once at boot; saved
  // by a small wrapper on every persistent.changed event from the Store.
  const persistentState: PersistentState = loadPersistentState(config.STATE_FILE, (msg, err) => {
    logger.warn({ err, path: config.STATE_FILE }, msg);
  });
  // ROOM_FLOORS env var is the legacy default; the persisted file takes
  // priority so SPA edits stick. Merge so a fresh install with only the
  // env var still labels rooms until the user customises.
  const mergedFloors = { ...config.ROOM_FLOORS, ...persistentState.floors };
  store.loadPersistent({ floors: mergedFloors, scenes: persistentState.scenes });
  store.events.on("persistent.changed", () => {
    try {
      savePersistentState(config.STATE_FILE, {
        ...persistentState,
        version: 1,
        floors: store.getFloorAssignments(),
        scenes: store.getScenes(),
      });
    } catch (err) {
      logger.warn({ err, path: config.STATE_FILE }, "could not save state file");
    }
  });

  let source: DeviceSource;
  if (config.DEVICE_MODE === "live") {
    const http = new DeviceClient({
      baseUrl: config.DEVICE_URL,
      timeoutMs: config.DEVICE_REQUEST_TIMEOUT_MS,
      minGapMs: config.DEVICE_MIN_GAP_MS,
      logger,
      onTelemetry: (entry) => store.recordFetch(entry),
    });
    const installer = config.DEVICE_INSTALLER_CODE
      ? new InstallerSession({ http, code: config.DEVICE_INSTALLER_CODE, logger })
      : undefined;
    source = new LiveDeviceSource(http, installer);
  } else {
    source = new MockDeviceSource();
  }
  const poller = new Poller({ config, source, store, logger });
  const commander = new Commander({ source, store, poller });

  // ─── Installation fingerprint ──────────────────────────────────────
  // Emit a single grep-friendly log block AFTER the kickoff poll
  // sequence has completed — dashboard, room list, all room details,
  // system info. Earlier versions fired this on the first room.changed
  // event, which produced a half-baked snapshot ("1 room, hasFan=false")
  // when the user actually had four rooms with full capabilities, just
  // not polled yet. The fingerprint is supposed to be the FIRST thing a
  // user pastes into a bug report — a partial snapshot would actively
  // mislead.
  void (async () => {
    await poller.kickoffComplete();
    logger.info(buildFingerprint(store, config), "INSTALLATION_FINGERPRINT");
  })();

  // SPA dir: in the production container the React build is copied next to
  // dist; in dev it's under apps/web/dist. Either way we resolve relative
  // to the running script.
  const spaDir = resolve(import.meta.dirname, "..", "web");

  const app = await buildServer({ config, logger, store, commander, source, poller, spaDir });
  poller.start();

  let mqttBridge: MqttBridge | null = null;
  if (config.MQTT_URL) {
    mqttBridge = new MqttBridge({ config, store, commander, logger });
    await mqttBridge.start();
  } else {
    logger.info("MQTT_URL not set — MQTT bridge disabled");
  }

  try {
    await app.listen({ port: config.HTTP_PORT, host: "0.0.0.0" });
  } catch (err) {
    // Dev belt-and-suspenders: when `node --watch` restarts the bridge after
    // a code change, the old listener occasionally lingers (Windows, busy
    // event loop, …). Detect EADDRINUSE, kill whoever's squatting the port,
    // and retry once. Production builds (NODE_ENV=production) get the
    // original error so a real config bug isn't masked.
    const isAddrInUse =
      typeof err === "object" && err !== null && (err as { code?: string }).code === "EADDRINUSE";
    if (!isAddrInUse || process.env.NODE_ENV === "production") throw err;
    logger.warn({ port: config.HTTP_PORT }, "port busy on startup, attempting to free it");
    await killPortHolder(config.HTTP_PORT, logger);
    await app.listen({ port: config.HTTP_PORT, host: "0.0.0.0" });
  }

  let shuttingDown = false;
  const shutdown = async (sig: NodeJS.Signals | "manual"): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ sig }, "shutting down");
    // Hard fallback: if graceful close hangs (eg. a poll mid-flight against a
    // slow REHAU, an MQTT broker that's gone away), don't let `tsx watch`
    // restart find port 8080 still bound — exit forcibly after 3 s.
    const killer = setTimeout(() => {
      logger.warn("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 3000);
    killer.unref();
    try {
      poller.stop();
      if (mqttBridge) await mqttBridge.stop();
      await source.close();
      await app.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "shutdown failed");
      process.exit(1);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // `tsx watch` on Windows can't reliably deliver POSIX signals to the child
  // when restarting on a file change — it closes the child's stdin instead.
  // Treat that as a shutdown trigger so we release port 8080 cleanly.
  process.stdin.on("end", () => void shutdown("manual"));
  process.stdin.on("close", () => void shutdown("manual"));
};

main().catch((err: unknown) => {
  console.error("fatal:", err);
  process.exit(1);
});

// ─── port-holder cleanup (dev only) ─────────────────────────────
//
// Cross-platform best-effort kill of whoever's listening on `port`. We rely
// on the shipped `netstat` (Win) / `lsof` (POSIX) — both are present on every
// machine that can run node dev tools. Errors are swallowed: if we can't
// figure it out, the second listen() will throw normally and the user gets
// the real reason in the logs.
const exec = promisify(execFile);

async function killPortHolder(port: number, log: { warn: (o: object, m: string) => void }): Promise<void> {
  const pids = await (process.platform === "win32"
    ? findPidsWindows(port)
    : findPidsPosix(port));
  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, "SIGKILL");
      log.warn({ port, pid }, "killed stale listener");
    } catch {
      // Process may have died between the lookup and the kill.
    }
  }
  // Tiny grace so the OS releases the socket before we retry listen().
  await new Promise((r) => setTimeout(r, 200));
}

async function findPidsWindows(port: number): Promise<number[]> {
  try {
    const { stdout } = await exec("netstat", ["-ano", "-p", "tcp"]);
    const pids = new Set<number>();
    for (const line of stdout.split(/\r?\n/)) {
      // Look for `  TCP  0.0.0.0:8080  ...  LISTENING  <PID>`
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/);
      if (m && Number(m[1]) === port) pids.add(Number(m[2]));
    }
    return [...pids];
  } catch {
    return [];
  }
}

async function findPidsPosix(port: number): Promise<number[]> {
  try {
    const { stdout } = await exec("lsof", ["-i", `tcp:${port}`, "-sTCP:LISTEN", "-t"]);
    return stdout.split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}
