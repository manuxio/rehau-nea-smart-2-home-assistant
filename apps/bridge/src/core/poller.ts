import type { Config } from "../config.js";
import type { DeviceSource } from "../device/source.js";
import type { RoomDetailSnapshot } from "../device/parsers.js";
import type { Logger } from "../observability/log.js";
import type { Store } from "./store.js";

/**
 * The REHAU room detail page exposes three heating setpoints as JS variables
 * (normal, reduced, standby) plus the *active* RSH input value, which mirrors
 * whichever one is in use for the current mode. Picking the right one for our
 * `setpointHeating` field is what the user actually controls in the UI.
 */
const activeSetpoint = (d: RoomDetailSnapshot): number => {
  switch (d.mode) {
    case "normal":  return d.setpointHeatingNormal;
    case "reduced": return d.setpointHeatingReduced;
    case "program":
    case "program_override":
      return d.programActive === 1 ? d.setpointHeatingReduced : d.setpointHeatingNormal;
    case "standby": return d.setpointHeatingNormal; // not editable; we display the normal value
  }
};

export interface PollerOptions {
  config: Config;
  source: DeviceSource;
  store: Store;
  logger: Logger;
}

const SECOND = 1000;

/** Best-effort wrap that logs errors and reports reachability into the store. */
const safe = async (
  logger: Logger,
  store: Store,
  label: string,
  fn: () => Promise<void>,
): Promise<void> => {
  try {
    await fn();
    store.setReachable(true);
  } catch (err) {
    logger.warn({ err, label }, "poll failed");
    store.setReachable(false);
  }
};

const fmtRoomId = (zone: number, name: string): string =>
  `r-${name.toLowerCase().replace(/\s+/g, "-") || "zone"}-z${zone}`;

export class Poller {
  private timers: NodeJS.Timeout[] = [];
  private rrIndex = 0;

  constructor(private readonly opts: PollerOptions) {}

  start(): void {
    const { config: c, logger } = this.opts;
    logger.info({ source: this.opts.source.kind }, "poller starting");

    this.timers.push(setInterval(() => void this.pollDashboard(), c.POLL_DASHBOARD_S * SECOND));
    this.timers.push(setInterval(() => void this.pollRoomList(), c.POLL_ROOMS_S * SECOND));
    this.timers.push(setInterval(() => void this.pollRoomDetailRR(), c.POLL_ROOM_DETAIL_S * SECOND));
    this.timers.push(setInterval(() => void this.pollMessages(), c.POLL_MESSAGES_S * SECOND));

    // IO polling is installer-tier and locks the installer mutex for the
    // duration. Only enable when the operator explicitly opts in.
    if (c.EXPOSE_IO && this.opts.source.hasInstaller) {
      this.timers.push(setInterval(() => void this.pollIO(), c.POLL_IO_S * SECOND));
      void this.pollIO();
    }

    // Kick off an initial pass so the store is populated quickly.
    void this.pollSystemInfo();
    void this.pollDashboard();
    void this.pollRoomList();
    void this.pollMessages();
    void this.pollAllRoomDetails();
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  // ─── one-shot helpers used after writes ──────────────────────
  refreshDashboard(): Promise<void> { return this.pollDashboard(); }
  refreshRoomList(): Promise<void> { return this.pollRoomList(); }
  refreshRoom(zone: number): Promise<void> { return this.pollRoomDetail(zone); }

  // ─── poll bodies ────────────────────────────────────────────
  private pollSystemInfo(): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "system-info", async () => {
      const info = await source.fetchSystemInfo();
      store.patchSystem({
        uniqueCode: info.uniqueCode,
        fw: info.fw,
        seasonStart: info.seasonStart,
        seasonEnd: info.seasonEnd,
        outdoorOffset: info.outdoorOffset,
      });
    });
  }

  private pollDashboard(): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "dashboard", async () => {
      const d = await source.fetchDashboard();
      store.patchSystem({
        outdoorTemp: d.outdoorTemp,
        operatingMode: d.operatingMode,
        energyLevel: d.energyLevel,
        reachable: true,
      });
    });
  }

  private pollRoomList(): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "room-list", async () => {
      const list = await source.fetchRoomList();
      for (const r of list) {
        const existing = store.getRoomByZone(r.zone);
        const id = existing?.id ?? fmtRoomId(r.zone, r.name);
        store.patchRoom(id, { name: r.name, temperature: r.temperature, zone: r.zone });
      }
    });
  }

  private pollRoomDetailRR(): Promise<void> {
    const rooms = this.opts.store.listRooms();
    if (rooms.length === 0) return Promise.resolve();
    const room = rooms[this.rrIndex % rooms.length]!;
    this.rrIndex++;
    return this.pollRoomDetail(room.zone);
  }

  private pollRoomDetail(zone: number): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, `room-detail-${zone}`, async () => {
      const d = await source.fetchRoomDetail(zone);
      const room = store.ensureRoomForZone(d.zone, d.name);
      store.patchRoom(room.id, {
        name: d.name,
        temperature: d.temperature,
        humidity: d.humidity,
        setpointHeating: activeSetpoint(d),
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
    });
  }

  /** Reads the room-set-up.html page for the flags (lock / auto / SWOW). */
  refreshRoomSetup(zone: number): Promise<void> { return this.pollRoomSetup(zone); }
  private pollRoomSetup(zone: number): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, `room-setup-${zone}`, async () => {
      const s = await source.fetchRoomSetup(zone);
      const room = store.ensureRoomForZone(s.zone, s.name);
      store.patchRoom(room.id, {
        name: s.name,
        lock: s.flags.lock,
        autoStart: s.flags.auto,
        windowDetection: s.flags.swow,
      });
    });
  }

  private async pollAllRoomDetails(): Promise<void> {
    // After the initial room list lands we need at least one detail pass per
    // zone to populate setpoint + mode. Serialised by DeviceClient.
    await new Promise((r) => setTimeout(r, 300));
    for (const r of this.opts.store.listRooms()) {
      await this.pollRoomDetail(r.zone);
      await this.pollRoomSetup(r.zone);
    }
  }

  private pollMessages(): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "messages", async () => {
      const list = await source.fetchMessages();
      store.setMessages(list);
    });
  }

  private pollIO(): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "io", async () => {
      const io = await source.fetchIO();
      store.setIO(io);
    });
  }
}

const clampFan = (n: number): 0 | 1 | 2 | 3 | 4 => {
  const c = Math.max(0, Math.min(4, Math.round(n)));
  return c as 0 | 1 | 2 | 3 | 4;
};
