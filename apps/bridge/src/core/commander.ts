import type {
  DailyProgram,
  EnergyLevel,
  Room,
  RoomMode,
  SystemMode,
  WeeklyProgram,
} from "@rehau/types";
import type { DeviceSource } from "../device/source.js";
import type { Poller } from "./poller.js";
import type { Store } from "./store.js";

/**
 * Pick the stored setpoint for the target mode. Falls back to the active
 * `setpointHeating` if the per-mode slot isn't known yet (e.g. before the
 * first detail poll has landed).
 */
// Returns the device-side setpoint to write when the user picks `mode`.
// Uses `??` (not `||`) so a legitimate 0 doesn't fall through to the next
// candidate. `null` propagates back up so the caller can refuse the write
// instead of synthesising a value — see the no-defaults rule in
// packages/types Room comments.
const slotForMode = (room: Room, mode: RoomMode): number | null => {
  switch (mode) {
    case "normal":  return room.setpointNormal  ?? room.setpointHeating;
    case "reduced": return room.setpointReduced ?? room.setpointHeating;
    case "standby": return room.setpointStandby ?? room.setpointHeating;
    case "program":
    case "program_override":
      // Program-mode RSH on the device starts from the normal slot.
      return room.setpointNormal ?? room.setpointHeating;
  }
};

// The REHAU device exposes programs by index only ("Programma giornaliero
// No. N") — no custom names. We surface `name = ""` and let the UI render the
// id alone; a future rename feature would just populate this field.

export interface CommanderArgs {
  source: DeviceSource;
  store: Store;
  poller: Poller;
}

/**
 * All writes funnel through here. Serialisation is provided by DeviceClient's
 * single-flight chain. After each write we force a targeted re-poll so the
 * REST response reflects the actual device state.
 */
export class Commander {
  constructor(private readonly a: CommanderArgs) {}

  /**
   * Patch the in-memory Store with `next` BEFORE awaiting the device
   * write, then re-poll so the Store ends up with the canonical device
   * value. On failure, revert the touched fields to whatever they were
   * before the write.
   *
   * Why: a slow REHAU write was previously blocking GET responses for
   * other concurrent clients (mobile + browser tabs share the same Store
   * cache). With this, any GET during the write sees the user-intended
   * value immediately. If REHAU rejects the write, we roll back and the
   * client sees the error so its own optimistic state can revert too.
   */
  private async optimistic(
    room: Room,
    next: Partial<Room>,
    doWrite: () => Promise<void>,
    afterWrite: () => Promise<void>,
  ): Promise<Room | undefined> {
    // Snapshot only the keys we're touching so a concurrent poll updating
    // an unrelated field (e.g. temperature) doesn't get clobbered on
    // revert.
    const prev: Partial<Room> = {};
    const prevRec = prev as unknown as Record<string, unknown>;
    const roomRec = room as unknown as Record<string, unknown>;
    for (const k of Object.keys(next)) {
      prevRec[k] = roomRec[k];
    }
    this.a.store.patchRoom(room.id, next);
    try {
      await doWrite();
      await afterWrite();
      return this.a.store.getRoom(room.id);
    } catch (err) {
      this.a.store.patchRoom(room.id, prev);
      throw err;
    }
  }

  async setRoomSetpoint(roomId: string, value: number): Promise<Room | undefined> {
    const room = this.a.store.getRoom(roomId);
    if (!room) return undefined;
    return this.optimistic(
      room,
      { setpointHeating: value },
      () =>
        this.a.source.setRoomSetpoint({
          zone: room.zone,
          name: room.name,
          value,
          mode: room.mode,
          light: room.light,
        }),
      () => this.a.poller.refreshRoom(room.zone),
    );
  }

  async setRoomMode(roomId: string, mode: RoomMode, setpoint?: number): Promise<Room | undefined> {
    const room = this.a.store.getRoom(roomId);
    if (!room) return undefined;
    // When changing mode without an explicit setpoint, target the new mode's
    // stored slot — otherwise we'd overwrite it with the *current* mode's
    // active setpoint (the classic bug: switch to Reduced and the device
    // would file the Normal setpoint into the Reduced slot).
    const slot = setpoint ?? slotForMode(room, mode);
    if (slot === null) {
      // No setpoint known yet — bail rather than POST a synthesised one
      // (the all-or-nothing form would write a wrong value to REHAU).
      // The SPA gets a 503 and shows the user that data isn't ready.
      throw Object.assign(new Error("room setpoint not yet known"), { statusCode: 503 });
    }
    return this.optimistic(
      room,
      { mode, setpointHeating: slot },
      () =>
        this.a.source.setRoomMode({
          zone: room.zone,
          name: room.name,
          mode,
          setpoint: slot,
          light: room.light,
        }),
      () => this.a.poller.refreshRoom(room.zone),
    );
  }

  async setRoomLight(roomId: string, light: boolean): Promise<Room | undefined> {
    const room = this.a.store.getRoom(roomId);
    if (!room) return undefined;
    if (room.setpointHeating === null) {
      throw Object.assign(new Error("room setpoint not yet known"), { statusCode: 503 });
    }
    const heat = room.setpointHeating;
    return this.optimistic(
      room,
      { light },
      () =>
        this.a.source.setRoomLight({
          zone: room.zone,
          name: room.name,
          light,
          setpoint: heat,
          mode: room.mode,
        }),
      () => this.a.poller.refreshRoom(room.zone),
    );
  }

  /**
   * Generic patch for the three room-set-up flags. Only fields explicitly set
   * are forwarded — the source handles read+merge+POST internally.
   */
  async setRoomFlags(
    roomId: string,
    patch: { lock?: boolean; autoStart?: boolean; windowDetection?: boolean },
  ): Promise<Room | undefined> {
    const room = this.a.store.getRoom(roomId);
    if (!room) return undefined;
    return this.optimistic(
      room,
      patch,
      // setRoomSetup returns RoomSetupSnapshot; the optimistic helper
      // only needs a Promise<void>, so swallow the value.
      async () => {
        await this.a.source.setRoomSetup(room.zone, patch);
      },
      () => this.a.poller.refreshRoomSetup(room.zone),
    );
  }

  async setOperatingMode(mode: SystemMode): Promise<void> {
    // Optimistic system-level write — same shape as the per-room helpers
    // but operating on patchSystem. MQTT and SPA see the new mode
    // immediately; if the device write fails, revert. Important: HA
    // sends SystemMode changes through MQTT, so this path is what makes
    // a click in HA feel instant.
    const prev = this.a.store.getSystem().operatingMode;
    this.a.store.patchSystem({ operatingMode: mode });
    try {
      await this.a.source.setOperatingMode(mode);
      await this.a.poller.refreshDashboard();
    } catch (err) {
      this.a.store.patchSystem({ operatingMode: prev });
      throw err;
    }
  }

  async setEnergyLevel(level: EnergyLevel): Promise<void> {
    const prev = this.a.store.getSystem().energyLevel;
    this.a.store.patchSystem({ energyLevel: level });
    try {
      await this.a.source.setEnergyLevel(level);
      await this.a.poller.refreshDashboard();
    } catch (err) {
      this.a.store.patchSystem({ energyLevel: prev });
      throw err;
    }
  }

  /** Lazy-load + cache a single daily program. */
  async refreshDailyProgram(id: number): Promise<DailyProgram | undefined> {
    const snap = await this.a.source.fetchDailyProgram(id);
    const cur = this.a.store.getDailyProgram(id);
    const next: DailyProgram = {
      id: snap.id,
      name: cur?.name ?? "",
      bits: snap.bits,
    };
    this.a.store.upsertDailyProgram(next);
    return next;
  }

  async refreshWeeklyProgram(id: number): Promise<WeeklyProgram | undefined> {
    const snap = await this.a.source.fetchWeeklyProgram(id);
    const cur = this.a.store.getWeeklyProgram(id);
    const next: WeeklyProgram = {
      id: snap.id,
      name: cur?.name ?? "",
      days: snap.days,
    };
    this.a.store.upsertWeeklyProgram(next);
    return next;
  }

  async setDailyProgram(id: number, bits: number[]): Promise<DailyProgram | undefined> {
    await this.a.source.setDailyProgram(id, bits);
    return this.refreshDailyProgram(id);
  }

  async setWeeklyProgram(
    id: number,
    days: [number, number, number, number, number, number, number],
  ): Promise<WeeklyProgram | undefined> {
    await this.a.source.setWeeklyProgram(id, days);
    return this.refreshWeeklyProgram(id);
  }
}
