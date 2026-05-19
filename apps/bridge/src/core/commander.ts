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
const slotForMode = (room: Room, mode: RoomMode): number => {
  switch (mode) {
    case "normal":  return room.setpointNormal  || room.setpointHeating;
    case "reduced": return room.setpointReduced || room.setpointHeating;
    case "standby": return room.setpointStandby || room.setpointHeating;
    case "program":
    case "program_override":
      // Program-mode RSH on the device starts from the normal slot.
      return room.setpointNormal || room.setpointHeating;
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

  async setRoomSetpoint(roomId: string, value: number): Promise<Room | undefined> {
    const room = this.a.store.getRoom(roomId);
    if (!room) return undefined;
    await this.a.source.setRoomSetpoint({
      zone: room.zone,
      name: room.name,
      value,
      mode: room.mode,
      light: room.light,
    });
    await this.a.poller.refreshRoom(room.zone);
    return this.a.store.getRoom(roomId);
  }

  async setRoomMode(roomId: string, mode: RoomMode, setpoint?: number): Promise<Room | undefined> {
    const room = this.a.store.getRoom(roomId);
    if (!room) return undefined;
    // When changing mode without an explicit setpoint, target the new mode's
    // stored slot — otherwise we'd overwrite it with the *current* mode's
    // active setpoint (the classic bug: switch to Reduced and the device
    // would file the Normal setpoint into the Reduced slot).
    const slot = setpoint ?? slotForMode(room, mode);
    await this.a.source.setRoomMode({
      zone: room.zone,
      name: room.name,
      mode,
      setpoint: slot,
      light: room.light,
    });
    await this.a.poller.refreshRoom(room.zone);
    return this.a.store.getRoom(roomId);
  }

  async setRoomLight(roomId: string, light: boolean): Promise<Room | undefined> {
    const room = this.a.store.getRoom(roomId);
    if (!room) return undefined;
    await this.a.source.setRoomLight({
      zone: room.zone,
      name: room.name,
      light,
      setpoint: room.setpointHeating,
      mode: room.mode,
    });
    await this.a.poller.refreshRoom(room.zone);
    return this.a.store.getRoom(roomId);
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
    await this.a.source.setRoomSetup(room.zone, patch);
    await this.a.poller.refreshRoomSetup(room.zone);
    return this.a.store.getRoom(roomId);
  }

  async setOperatingMode(mode: SystemMode): Promise<void> {
    await this.a.source.setOperatingMode(mode);
    await this.a.poller.refreshDashboard();
  }

  async setEnergyLevel(level: EnergyLevel): Promise<void> {
    await this.a.source.setEnergyLevel(level);
    await this.a.poller.refreshDashboard();
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
