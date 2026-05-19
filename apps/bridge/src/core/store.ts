import { EventEmitter } from "node:events";
import type {
  AlarmMessage,
  DailyProgram,
  IOSnapshot,
  Room,
  RoomMode,
  SystemState,
  WeeklyProgram,
} from "@rehau/types";
import {
  seedAlarms,
  seedDailyPrograms,
  seedRooms,
  seedSystem,
  seedWeeklyPrograms,
} from "@rehau/types/mocks";

const nowIso = (): string => new Date().toISOString();

/** Strongly-typed event emitter wrapper. */
type Events = {
  "room.changed": (room: Room, changed: Partial<Room>) => void;
  "system.changed": (sys: SystemState, changed: Partial<SystemState>) => void;
  "messages.changed": (messages: AlarmMessage[]) => void;
  "device.status": (s: { online: boolean; lastReadAt: string }) => void;
  "daily.changed": (p: DailyProgram) => void;
  "weekly.changed": (p: WeeklyProgram) => void;
  "io.changed": (io: IOSnapshot) => void;
};

export class Store {
  private rooms = new Map<string, Room>();
  private system: SystemState;
  private messages: AlarmMessage[];
  private daily = new Map<number, DailyProgram>();
  private weekly = new Map<number, WeeklyProgram>();
  private io: IOSnapshot | null = null;
  private reachable = true;
  private lastReadAt = nowIso();
  readonly events = new EventEmitter() as TypedEmitter<Events>;

  constructor() {
    // Initialise from the seed shapes so the bridge has answers from boot.
    for (const r of seedRooms) this.rooms.set(r.id, { ...r });
    this.system = { ...seedSystem };
    this.messages = seedAlarms.slice();
    for (const d of seedDailyPrograms) this.daily.set(d.id, { ...d, bits: [...d.bits] });
    for (const w of seedWeeklyPrograms) this.weekly.set(w.id, { ...w, days: [...w.days] as WeeklyProgram["days"] });
  }

  // ─── reads ────────────────────────────────────────────────
  listRooms(): Room[] { return [...this.rooms.values()]; }
  getRoom(id: string): Room | undefined { return this.rooms.get(id); }
  getRoomByZone(zone: number): Room | undefined {
    for (const r of this.rooms.values()) if (r.zone === zone) return r;
    return undefined;
  }
  getSystem(): SystemState { return this.system; }
  getMessages(): AlarmMessage[] { return this.messages; }
  getDeviceStatus(): { online: boolean; lastReadAt: string } {
    return { online: this.reachable, lastReadAt: this.lastReadAt };
  }

  listDailyPrograms(): DailyProgram[] {
    return [...this.daily.values()].sort((a, b) => a.id - b.id);
  }
  getDailyProgram(id: number): DailyProgram | undefined { return this.daily.get(id); }
  upsertDailyProgram(p: DailyProgram): void {
    this.daily.set(p.id, p);
    this.events.emit("daily.changed", p);
  }
  listWeeklyPrograms(): WeeklyProgram[] {
    return [...this.weekly.values()].sort((a, b) => a.id - b.id);
  }
  getWeeklyProgram(id: number): WeeklyProgram | undefined { return this.weekly.get(id); }
  upsertWeeklyProgram(p: WeeklyProgram): void {
    this.weekly.set(p.id, p);
    this.events.emit("weekly.changed", p);
  }

  getIO(): IOSnapshot | null { return this.io; }
  setIO(io: IOSnapshot): void {
    // Skip publish if nothing actually changed — cheap deep-compare by JSON.
    const next = JSON.stringify(io);
    const prev = this.io ? JSON.stringify(this.io) : null;
    if (next === prev) return;
    this.io = io;
    this.events.emit("io.changed", io);
  }

  // ─── writes ───────────────────────────────────────────────
  /** Merge a partial room update; emits only when something actually changed. */
  patchRoom(id: string, patch: Partial<Room>): Room | undefined {
    const cur = this.rooms.get(id);
    if (!cur) return undefined;
    const merged: Room = { ...cur, ...patch, meta: { lastUpdatedAt: nowIso() } };
    if (!shallowChanged(cur, merged)) return cur;
    this.rooms.set(id, merged);
    this.events.emit("room.changed", merged, { ...patch });
    return merged;
  }

  patchSystem(patch: Partial<SystemState>): SystemState {
    const merged: SystemState = { ...this.system, ...patch, meta: { lastUpdatedAt: nowIso() } };
    if (!shallowChanged(this.system, merged)) return this.system;
    this.system = merged;
    this.events.emit("system.changed", merged, { ...patch });
    return merged;
  }

  setMessages(next: AlarmMessage[]): void {
    if (JSON.stringify(next) === JSON.stringify(this.messages)) return;
    this.messages = next;
    this.events.emit("messages.changed", next);
  }

  setReachable(online: boolean): void {
    this.lastReadAt = nowIso();
    if (this.reachable === online) {
      this.events.emit("device.status", { online, lastReadAt: this.lastReadAt });
      return;
    }
    this.reachable = online;
    this.events.emit("device.status", { online, lastReadAt: this.lastReadAt });
  }

  /** Best-effort lookup by name for new rooms that the live device returned. */
  ensureRoomForZone(zone: number, name: string): Room {
    const existing = this.getRoomByZone(zone);
    if (existing) return existing;
    const room: Room = {
      id: `r-${name.toLowerCase().replace(/\s+/g, "-")}-z${zone}`,
      zone,
      name,
      temperature: 0,
      humidity: 0,
      setpointHeating: 20,
      setpointCooling: 24,
      setpointNormal: 20,
      setpointReduced: 18.5,
      setpointStandby: 23,
      mode: "standby" satisfies RoomMode,
      programOverride: false,
      hasFan: false,
      hasFlap: false,
      hasLight: false,
      fan: 0,
      flap: 0,
      light: false,
      fanRunning: false,
      calibrationTemp: 0,
      calibrationHumidity: 0,
      programDailyId: 1,
      programWeeklyId: 1,
      floor: "",
      lock: false,
      autoStart: true,
      windowDetection: true,
      meta: { lastUpdatedAt: nowIso() },
    };
    this.rooms.set(room.id, room);
    return room;
  }
}

const shallowChanged = <T extends object>(a: T, b: T): boolean => {
  for (const k of Object.keys(b) as (keyof T)[]) {
    if (k === "meta") continue;
    if (a[k] !== b[k]) return true;
  }
  return false;
};

// ── Minimal typed-emitter helper (avoids an extra dep) ──
interface TypedEmitter<T extends Record<string, (...args: never[]) => void>> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  off<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
}
