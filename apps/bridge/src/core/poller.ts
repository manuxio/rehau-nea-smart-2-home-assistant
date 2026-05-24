// Polling orchestrator.
//
// See POLLING-PLAN.md for the model. The summary:
//
//   - Three buckets of state: sensor (A), bridge-owned mirror (B),
//     identity (C). Only bucket A drives recurring polls.
//   - Boot phase walks every URL with a "boot priority" in a fixed,
//     hard-coded order through DeviceClient's single-flight chain.
//   - Runtime intervals only start AFTER boot completes (`kickoffComplete`).
//   - A periodic safety re-sync re-walks the same priority list, catching
//     out-of-band edits to bucket B (someone touching REHAU's own web UI).
//   - During safety re-sync, the runtime polls hold off — guaranteed
//     coherent snapshot.
//   - Writes always queue through the same device-client single-flight chain,
//     so they don't conflict with anything else.
//
// Priority numbers are PLANNING constructs; the implementation hard-codes
// the order in `runPrioritySequence()`. No knob to reorder at runtime.

import type { Config } from "../config.js";
import type { DeviceSource } from "../device/source.js";
import type { RoomDetailSnapshot } from "../device/parsers.js";
import type { Logger } from "../observability/log.js";
import type { OpLog } from "../observability/ops-log.js";
import type { InstallerSettingsGroup } from "@rehau/types";
import type { Store } from "./store.js";

const SECOND = 1000;

const INSTALLER_SETTINGS_GROUPS: InstallerSettingsGroup[] = [
  "heatcool",
  "devices",
  "functions",
  "pid",
];

/**
 * REHAU's room-operating.html exposes three setpoints as JS variables
 * (normal / reduced / standby) plus the *active* RSH input value that
 * mirrors whichever one is in use for the current mode. Pick the right
 * one for our `setpointHeating` / `setpointCooling` mirror.
 */
const activeSetpoint = (d: RoomDetailSnapshot): number => {
  switch (d.mode) {
    case "normal":  return d.setpointHeatingNormal;
    case "reduced": return d.setpointHeatingReduced;
    case "program":
    case "program_override":
      return d.programActive === 1 ? d.setpointHeatingReduced : d.setpointHeatingNormal;
    case "standby": return d.setpointHeatingNormal;
  }
};

const clampFan = (n: number): 0 | 1 | 2 | 3 | 4 => {
  const c = Math.max(0, Math.min(4, Math.round(n)));
  return c as 0 | 1 | 2 | 3 | 4;
};

export interface PollerOptions {
  config: Config;
  source: DeviceSource;
  store: Store;
  logger: Logger;
  ops: OpLog;
}

/** Best-effort wrap that logs errors and records the outcome on the store. */
const safe = async (
  logger: Logger,
  store: Store,
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> => {
  try {
    await fn();
    store.setReachable(true);
    return true;
  } catch (err) {
    logger.warn({ err, label }, "poll failed");
    store.setReachable(false);
    return false;
  }
};

export class Poller {
  private timers: NodeJS.Timeout[] = [];
  private kickoffDone = false;
  /** When true, runtime ticks skip themselves so the safety pass owns the device. */
  private safetyBusy = false;
  /**
   * Pre-allocated awaitable so `kickoffComplete()` ALWAYS returns the
   * real promise — even if a consumer calls it before `start()` runs.
   * Previously kickoffPromise was assigned inside start(), which meant
   * the fingerprint emitter and MQTT bridge raced ahead with empty data
   * if they awaited too early.
   */
  private kickoffResolve!: () => void;
  private readonly kickoffPromise: Promise<void> = new Promise((r) => {
    this.kickoffResolve = r;
  });

  constructor(private readonly opts: PollerOptions) {}

  /**
   * Boot. Holds the installer session open (if available), then walks the
   * priority sequence once. Runtime timers are scheduled AFTER the kickoff
   * resolves — every URL is fetched at least once before any interval fires.
   */
  start(): void {
    const { logger, source } = this.opts;
    logger.info({ source: source.kind }, "poller starting");

    void (async () => {
      if (source.openInstallerSession) {
        try { await source.openInstallerSession(); }
        catch (err) { logger.warn({ err }, "installer session open failed at boot"); }
      }
      await this.runPrioritySequence("boot");
      this.kickoffDone = true;
      this.startRuntimeTimers();
      this.kickoffResolve();
    })();
  }

  /** Resolves once the initial boot kickoff has completed. Always safe
   *  to await — the underlying promise is created eagerly in the
   *  constructor. */
  kickoffComplete(): Promise<void> {
    return this.kickoffPromise;
  }

  /** True when boot is done and runtime timers are scheduled. */
  isReady(): boolean { return this.kickoffDone; }

  stop(): void {
    for (const t of this.timers) clearInterval(t as NodeJS.Timeout);
    this.timers = [];
  }

  /**
   * Wrap a single REHAU-facing operation: safe-catch any failure (so an
   * unhandled rejection from an undici timeout never kills the process)
   * AND emit an `op.fetch` entry into the operations log. Used by both
   * the boot/safety priority walk AND every runtime tick — every REHAU
   * round-trip ends up in the 50-entry diagnostic snapshot.
   */
  private async tick(label: string, fn: () => Promise<void>): Promise<boolean> {
    const t0 = Date.now();
    const success = await safe(this.opts.logger, this.opts.store, label, fn);
    const ms = Date.now() - t0;
    this.opts.ops.emit("fetch", `${label}  ${success ? "ok" : "err"}  ${ms} ms`, {
      label, ms, ok: success,
    });
    return success;
  }

  // ─── Priority sequence (shared by boot + safety) ──────────────
  /**
   * The single source of truth for "what does the bridge fetch when it
   * needs a complete picture of the appliance". Walks one URL at a time
   * through the device-client single-flight chain.
   */
  private async runPrioritySequence(phase: "boot" | "safety"): Promise<void> {
    const start = Date.now();
    const startKind = phase === "boot" ? "boot.start" : "safety.start";
    const endKind = phase === "boot" ? "boot.end" : "safety.end";
    this.opts.ops.emit(startKind, `${phase} sequence starting`);

    let total = 0;
    let ok = 0;
    const step = async (label: string, fn: () => Promise<void>): Promise<void> => {
      total++;
      if (await this.tick(label, fn)) ok++;
    };

    // prio 1: dashboard (outdoor + op mode + energy)
    await step("dashboard", () => this.pollDashboard());
    // prio 2: room list (creates rooms in store). On boot, retry ONCE
    // if it fails — otherwise the per-room loops below see an empty
    // store and quietly skip, leaving the bridge with no room data
    // until the 120 s runtime tick. A single REHAU stall at boot
    // shouldn't cost us a coherent first snapshot.
    await step("room-list", () => this.pollRoomList());
    if (this.opts.store.listRooms().length === 0) {
      this.opts.logger.warn("room-list returned no rooms; retrying once after 2 s");
      await new Promise((r) => setTimeout(r, 2_000));
      await step("room-list (retry)", () => this.pollRoomList());
    }
    // prio 5: per-room detail for every room created above
    for (const r of this.opts.store.listRooms()) {
      await step(`room-detail z=${r.zone}`, () => this.pollRoomDetail(r.zone));
    }
    // prio 9: IO + system-info
    if (this.canInstaller() && this.opts.config.EXPOSE_IO) {
      await step("io", () => this.pollIO());
    }
    await step("system-info", () => this.pollSystemInfo());
    // prio 10: messages + calibration + per-room set-up
    await step("messages", () => this.pollMessages());
    if (this.canInstaller()) {
      await step("calibration", () => this.pollCalibration());
    }
    for (const r of this.opts.store.listRooms()) {
      await step(`room-setup z=${r.zone}`, () => this.pollRoomSetup(r.zone));
    }
    // prio 15: programs (10 daily + 5 weekly) + 7 installer-tab reads
    for (let id = 1; id <= 10; id++) {
      await step(`daily-program ${id}`, () => this.pollDailyProgram(id));
    }
    for (let id = 1; id <= 5; id++) {
      await step(`weekly-program ${id}`, () => this.pollWeeklyProgram(id));
    }
    if (this.canInstaller()) {
      await step("uptime", () => this.pollUptime());
      await step("topology", () => this.pollTopology());
      await step("heat-curve", () => this.pollHeatCurve());
      for (const g of INSTALLER_SETTINGS_GROUPS) {
        await step(`settings ${g}`, () => this.pollSettings(g));
      }
    }

    const ms = Date.now() - start;
    const secs = (ms / 1000).toFixed(1);
    this.opts.ops.emit(endKind, `${phase} sequence done in ${secs}s — ${ok}/${total} ok`, {
      ms, ok, total,
    });
  }

  // ─── Runtime timers (scheduled after boot completes) ─────────
  private startRuntimeTimers(): void {
    const c = this.opts.config;
    /** Gate every runtime tick on the safety-busy flag AND route through
     *  tick() so a thrown poll never leaks as an unhandled rejection
     *  (an undici body-timeout used to kill the process). */
    const gated = (label: string, fn: () => Promise<void>) => () => {
      if (this.safetyBusy) return;
      void this.tick(label, fn);
    };

    this.timers.push(setInterval(gated("dashboard", () => this.pollDashboard()), c.POLL_DASHBOARD_S * SECOND));
    this.timers.push(setInterval(gated("room-list", () => this.pollRoomList()), c.POLL_ROOMS_S * SECOND));
    this.timers.push(setInterval(gated("messages", () => this.pollMessages()), c.POLL_MESSAGES_S * SECOND));
    this.timers.push(setInterval(gated("system-info", () => this.pollSystemInfo()), c.POLL_SYSTEM_INFO_S * SECOND));

    if (this.canInstaller() && c.EXPOSE_IO) {
      this.timers.push(setInterval(gated("io", () => this.pollIO()), c.POLL_IO_S * SECOND));
    }

    // Per-room scheduled cycle — every clamp(SLOT*N, MIN, MAX) seconds a
    // cycle starts and fetches all rooms back-to-back. N is dynamic, so
    // we re-arm with setTimeout instead of a fixed setInterval.
    this.scheduleNextRoomCycle();

    if (c.SAFETY_RESYNC_S > 0) {
      this.timers.push(setInterval(() => void this.safetyResync(), c.SAFETY_RESYNC_S * SECOND));
    }
  }

  private scheduleNextRoomCycle(): void {
    const ms = this.roomCyclePeriodMs();
    const t = setTimeout(async () => {
      if (!this.safetyBusy) await this.runRoomCycle();
      // re-arm whether or not we ran (so safety doesn't permanently kill us)
      this.scheduleNextRoomCycle();
    }, ms);
    this.timers.push(t);
  }

  private roomCyclePeriodMs(): number {
    const c = this.opts.config;
    const n = Math.max(1, this.opts.store.listRooms().length);
    const target = c.POLL_ROOM_DETAIL_SLOT_S * n;
    const clamped = Math.min(c.POLL_ROOM_DETAIL_MAX_S, Math.max(c.POLL_ROOM_DETAIL_MIN_S, target));
    return clamped * SECOND;
  }

  /** Fetch every room sequentially through the single-flight chain. */
  private async runRoomCycle(): Promise<void> {
    for (const r of this.opts.store.listRooms()) {
      await this.tick(`room-detail z=${r.zone}`, () => this.pollRoomDetail(r.zone));
    }
  }

  // ─── Safety re-sync ──────────────────────────────────────────
  /**
   * Re-walks the priority sequence. Re-entrant safe — back-to-back calls
   * are coalesced. Runtime ticks hold off via `safetyBusy` for the
   * duration so the snapshot is coherent.
   */
  async safetyResync(): Promise<void> {
    if (this.safetyBusy) return;
    if (!this.kickoffDone) return; // first walk is the boot kickoff itself
    this.safetyBusy = true;
    try {
      await this.runPrioritySequence("safety");
    } finally {
      this.safetyBusy = false;
    }
  }

  // ─── one-shot helpers used after writes ──────────────────────
  refreshDashboard(): Promise<void> { return this.pollDashboard(); }
  refreshRoomList(): Promise<void> { return this.pollRoomList(); }
  refreshRoom(zone: number): Promise<void> { return this.pollRoomDetail(zone); }
  refreshRoomSetup(zone: number): Promise<void> { return this.pollRoomSetup(zone); }
  refreshCalibration(): Promise<void> { return this.pollCalibration(); }
  refreshAll(): Promise<void> { return this.safetyResync(); }

  // ─── poll bodies ────────────────────────────────────────────
  private canInstaller(): boolean { return this.opts.source.hasInstaller; }

  private async pollSystemInfo(): Promise<void> {
    const info = await this.opts.source.fetchSystemInfo();
    this.opts.store.patchSystem({
      uniqueCode: info.uniqueCode,
      fw: info.fw,
      seasonStart: info.seasonStart,
      seasonEnd: info.seasonEnd,
      outdoorOffset: info.outdoorOffset,
    });
  }

  private async pollDashboard(): Promise<void> {
    const d = await this.opts.source.fetchDashboard();
    this.opts.store.patchSystem({
      outdoorTemp: d.outdoorTemp,
      operatingMode: d.operatingMode,
      energyLevel: d.energyLevel,
      reachable: true,
    });
  }

  private async pollRoomList(): Promise<void> {
    const list = await this.opts.source.fetchRoomList();
    for (const r of list) {
      const room = this.opts.store.ensureRoomForZone(r.zone, r.name);
      this.opts.store.patchRoom(room.id, { name: r.name, temperature: r.temperature, zone: r.zone });
    }
  }

  private async pollRoomDetail(zone: number): Promise<void> {
    const d = await this.opts.source.fetchRoomDetail(zone);
    const room = this.opts.store.ensureRoomForZone(d.zone, d.name);
    const sysMode = this.opts.store.getSystem().operatingMode;
    const isCooling = sysMode === "cooling_only" || sysMode === "manual_cooling";
    const active = activeSetpoint(d);
    this.opts.store.patchRoom(room.id, {
      name: d.name,
      temperature: d.temperature,
      humidity: d.humidity,
      setpointHeating: isCooling ? null : active,
      setpointCooling: isCooling ? active : null,
      setpointNormal: d.setpointHeatingNormal,
      setpointReduced: d.setpointHeatingReduced,
      setpointStandby: d.setpointStandby,
      mode: d.mode,
      fan: clampFan(d.fan),
      flap: d.flap === 1 ? 1 : 0,
      light: d.light,
      hasLight: d.hasLight,
      hasFan: d.hasFan,
      hasFlap: d.hasFlap,
      fanRunning: d.fanRunning,
      programDailyId: room.programDailyId,
      programWeeklyId: room.programWeeklyId,
      programOverride: d.mode === "program_override",
    });
  }

  private async pollRoomSetup(zone: number): Promise<void> {
    const s = await this.opts.source.fetchRoomSetup(zone);
    const room = this.opts.store.ensureRoomForZone(s.zone, s.name);
    this.opts.store.patchRoom(room.id, {
      name: s.name,
      lock: s.flags.lock,
      autoStart: s.flags.auto,
      windowDetection: s.flags.swow,
    });
  }

  private async pollMessages(): Promise<void> {
    const list = await this.opts.source.fetchMessages();
    this.opts.store.setMessages(list);
  }

  private async pollIO(): Promise<void> {
    const io = await this.opts.source.fetchIO();
    this.opts.store.setIO(io);
  }

  private async pollCalibration(): Promise<void> {
    const snap = await this.opts.source.fetchCalibration();
    this.opts.store.setCalibration({ ...snap, meta: { lastUpdatedAt: new Date().toISOString() } });
    for (const c of snap.rooms) {
      const room = this.opts.store.getRoomByZone(c.zone);
      if (!room) continue;
      this.opts.store.patchRoom(room.id, {
        calibrationTemp: c.tempOffset,
        calibrationHumidity: c.humidityOffset,
      });
    }
  }

  private async pollDailyProgram(id: number): Promise<void> {
    const p = await this.opts.source.fetchDailyProgram(id);
    this.opts.store.upsertDailyProgram({ id: p.id, name: "", bits: p.bits });
  }

  private async pollWeeklyProgram(id: number): Promise<void> {
    const w = await this.opts.source.fetchWeeklyProgram(id);
    this.opts.store.upsertWeeklyProgram({ id: w.id, name: "", days: w.days });
  }

  private async pollUptime(): Promise<void> {
    const u = await this.opts.source.fetchUptime();
    this.opts.store.setUptime(u);
  }

  private async pollTopology(): Promise<void> {
    const t = await this.opts.source.fetchTopology();
    this.opts.store.setTopology(t);
  }

  private async pollHeatCurve(): Promise<void> {
    const c = await this.opts.source.fetchHeatCurve();
    this.opts.store.setHeatCurve({ ...c, meta: { lastUpdatedAt: new Date().toISOString() } });
  }

  private async pollSettings(group: InstallerSettingsGroup): Promise<void> {
    const snap = await this.opts.source.fetchSettings(group);
    this.opts.store.setInstallerSettings({
      ...snap,
      meta: { lastUpdatedAt: new Date().toISOString() },
    });
  }
}
