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

    // Calibration auto-poll. Each pass opens + closes a full installer
    // session, so the cadence is generous by default (config:
    // POLL_CALIBRATION_S, default 180 s). 0 disables; the force-refresh
    // button still works via the on-demand HTTP route.
    if (c.POLL_CALIBRATION_S > 0 && this.opts.source.hasInstaller) {
      this.timers.push(
        setInterval(() => void this.pollCalibration(), c.POLL_CALIBRATION_S * SECOND),
      );
      // Defer the first fetch a few seconds so the initial dashboard +
      // room list passes land first — calibration is useless until the
      // rooms it mirrors into actually exist in the Store.
      setTimeout(() => void this.pollCalibration(), 8_000);
    }

    // Boot sequence — prioritised so the SPA + MQTT see meaningful data
    // FAST. Every fetch funnels through DeviceClient's single-flight
    // chain (REHAU's TCP stack can't take overlapping requests), so the
    // ORDER below is the order the user perceives state landing in.
    //
    //   1. Dashboard      — outdoor temp + operating mode + energy level
    //   2. Room list      — creates the Room entries with names + temps
    //   3. All room details — fills setpoint / humidity / mode per room
    //   4. Messages       — alerts (rarely changes; can wait)
    //   5. System info    — firmware versions etc. (installer page,
    //                       slowest; pure metadata, can wait)
    //
    // System info used to run first; on a fresh boot it opened an
    // installer session before any user-visible data landed,
    // adding 2-3 s of latency in front of every other fetch.
    void (async () => {
      await this.pollDashboard();
      await this.pollRoomList();
      await this.pollAllRoomDetails();
      void this.pollMessages();
      void this.pollSystemInfo();
    })();
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  // ─── one-shot helpers used after writes ──────────────────────
  refreshDashboard(): Promise<void> { return this.pollDashboard(); }
  refreshRoomList(): Promise<void> { return this.pollRoomList(); }
  refreshRoom(zone: number): Promise<void> { return this.pollRoomDetail(zone); }
  refreshCalibration(): Promise<void> { return this.pollCalibration(); }
  /**
   * Force-refresh hook used by the SPA's "Refresh" button — kicks off
   * every cheap poll in parallel plus the expensive calibration one if
   * the bridge has installer access. Returns when all of them have
   * settled so the SPA can show progress feedback.
   */
  async refreshAll(): Promise<void> {
    const tasks: Promise<void>[] = [
      this.pollSystemInfo(),
      this.pollDashboard(),
      this.pollRoomList(),
      this.pollAllRoomDetails(),
      this.pollMessages(),
    ];
    if (this.opts.source.hasInstaller) tasks.push(this.pollCalibration());
    await Promise.allSettled(tasks);
  }

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
        // ensureRoomForZone() is what CREATES the room if it doesn't exist
        // yet (with every nullable field starting as null per the
        // no-defaults rule). Before the seed was gated to mock-only, this
        // step relied on the seed rooms always being present; without
        // them, patchRoom() silently no-ops when the zone is unseen, and
        // no detail polls ever fire because store.listRooms() stays empty.
        const room = store.ensureRoomForZone(r.zone, r.name);
        store.patchRoom(room.id, { name: r.name, temperature: r.temperature, zone: r.zone });
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

  /**
   * Fetch calibration (outdoor + per-room offsets) and mirror it into the
   * matching Room entries so RoomDetail's "Calibration (read-only)" card
   * has values without the SPA needing to hit the installer endpoint.
   * Each call opens + closes an installer session, so this is the most
   * expensive poll — hence the long default interval.
   */
  private pollCalibration(): Promise<void> {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "calibration", async () => {
      const snap = await source.fetchCalibration();
      for (const c of snap.rooms) {
        const room = store.getRoomByZone(c.zone);
        if (!room) continue;
        store.patchRoom(room.id, {
          calibrationTemp: c.tempOffset,
          calibrationHumidity: c.humidityOffset,
        });
      }
    });
  }
}

const clampFan = (n: number): 0 | 1 | 2 | 3 | 4 => {
  const c = Math.max(0, Math.min(4, Math.round(n)));
  return c as 0 | 1 | 2 | 3 | 4;
};
