import { EventEmitter } from "node:events";
import type {
  AlarmMessage,
  BridgeConnection,
  BridgeConnectionState,
  DailyProgram,
  DiagnosticsSnapshot,
  FetchTelemetryEntry,
  FloorAssignments,
  IOSnapshot,
  Room,
  RoomMode,
  Scene,
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

// ─── Connection-state tuning ────────────────────────────────────────────
// REHAU is slow and bursty — a single timeout or 503 is normal jitter, not
// a real outage. We only flip OUT of "online" once we've seen real evidence:
//   • DEGRADED ← 3 consecutive failures OR no successful fetch for 60 s
//   • OFFLINE  ← no successful fetch for 5 min
// Any success resets the streak and goes back to online.
const FAIL_STREAK_FOR_DEGRADED = 3;
const QUIET_MS_FOR_DEGRADED = 60_000;
const QUIET_MS_FOR_OFFLINE = 300_000;
const FETCH_BUFFER_SIZE = 15;

/** Strongly-typed event emitter wrapper. */
type Events = {
  "room.changed": (room: Room, changed: Partial<Room>) => void;
  "system.changed": (sys: SystemState, changed: Partial<SystemState>) => void;
  "messages.changed": (messages: AlarmMessage[]) => void;
  "device.status": (s: { online: boolean; lastReadAt: string }) => void;
  /** Coarse "online/degraded/offline" state machine — fires on every transition. */
  "connection.changed": (c: BridgeConnection) => void;
  /** Fires when floors or scenes are edited — main.ts persists to /data/state.json. */
  "persistent.changed": () => void;
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
  private connection: BridgeConnection = {
    // Start as "online" — we haven't seen a failure yet. The first
    // successful poll will reinforce that; the first failure starts a streak.
    state: "online",
    lastSuccessAt: null,
    lastAttemptAt: null,
    consecutiveFailures: 0,
    reason: null,
  };
  private fetches: FetchTelemetryEntry[] = [];
  // ─── User-editable persistent state ─────────────────────────
  // Populated from /data/state.json on boot (see main.ts) and re-saved
  // whenever the SPA edits it via REST. The Store fires `persistent.changed`
  // on any change; main.ts subscribes and writes the file.
  private floorAssignments: FloorAssignments = {};
  private scenes: Scene[] = [];
  readonly events = new EventEmitter() as TypedEmitter<Events>;

  /**
   * @param opts.seed When `true`, populate every collection from the mock
   *   fixtures so the bridge has plausible answers from boot — useful in
   *   `DEVICE_MODE=mock` and tests. When `false` (default), boot empty:
   *   rooms get created on demand by the LiveSource through
   *   `ensureRoomForZone`, with EVERY device-sourced field starting as
   *   `null`. This is the no-defaults rule the SPA depends on.
   */
  constructor(opts: { seed?: boolean } = {}) {
    if (opts.seed) {
      for (const r of seedRooms) this.rooms.set(r.id, { ...r });
      for (const d of seedDailyPrograms) this.daily.set(d.id, { ...d, bits: [...d.bits] });
      for (const w of seedWeeklyPrograms)
        this.weekly.set(w.id, { ...w, days: [...w.days] as WeeklyProgram["days"] });
    }
    // System + messages are always shape-initialised so /api/v1/system returns
    // a complete object on the first request. The installation name + every
    // field gets overwritten by the first poll. (TODO: stage the no-defaults
    // sweep across SystemState too — out of scope for this pass.)
    this.system = { ...seedSystem };
    this.messages = opts.seed ? seedAlarms.slice() : [];
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
  getConnection(): BridgeConnection {
    return { ...this.connection };
  }

  // ─── User-editable persistent state ─────────────────────────
  getFloorAssignments(): FloorAssignments {
    return { ...this.floorAssignments };
  }
  setFloorAssignments(next: FloorAssignments): void {
    // Drop empty-string assignments — "no label" is the absence of an entry.
    const cleaned: FloorAssignments = {};
    for (const [zone, label] of Object.entries(next)) {
      const trimmed = (label ?? "").trim();
      if (trimmed) cleaned[Number(zone)] = trimmed;
    }
    if (JSON.stringify(cleaned) === JSON.stringify(this.floorAssignments)) return;
    this.floorAssignments = cleaned;
    // Apply to current rooms so the SPA's `/api/v1/rooms` reflects the edit
    // without waiting for the next dashboard poll.
    for (const r of this.rooms.values()) {
      const floor = this.floorAssignments[r.zone] ?? "";
      if (r.floor !== floor) this.patchRoom(r.id, { floor });
    }
    this.events.emit("persistent.changed");
  }
  getScenes(): Scene[] {
    return this.scenes.map((s) => ({ ...s }));
  }
  setScenes(next: Scene[]): void {
    this.scenes = next.map((s) => ({ ...s }));
    this.events.emit("persistent.changed");
  }
  /**
   * Replace the persistent-state slices in one call — used by main.ts
   * after reading the file at boot, so we only fire the persisted event
   * once and the file doesn't get rewritten in response to its own load.
   */
  loadPersistent(state: { floors: FloorAssignments; scenes: Scene[] }): void {
    this.floorAssignments = { ...state.floors };
    this.scenes = state.scenes.map((s) => ({ ...s }));
    // Don't emit — caller is the file loader, not a real state change.
  }
  getDiagnostics(): DiagnosticsSnapshot {
    const recent = this.fetches.slice().reverse(); // newest first
    const successes = this.fetches.filter((f) => f.outcome === "ok");
    const failures = this.fetches.length - successes.length;
    const avgMsSuccess =
      successes.length > 0
        ? Math.round(successes.reduce((a, f) => a + f.ms, 0) / successes.length)
        : null;
    let p95MsSuccess: number | null = null;
    if (successes.length >= 5) {
      const sorted = successes.map((f) => f.ms).sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
      p95MsSuccess = sorted[idx] ?? null;
    }
    return {
      connection: this.getConnection(),
      recent,
      aggregates: {
        total: this.fetches.length,
        success: successes.length,
        failure: failures,
        avgMsSuccess,
        p95MsSuccess,
      },
    };
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
    // Legacy entry point used by the poller after every cycle. We keep the
    // binary device.status event for backward compat (some MQTT discovery
    // wiring still hangs off it), and let recordFetch maintain the richer
    // connection state.
    this.lastReadAt = nowIso();
    if (this.reachable !== online) this.reachable = online;
    this.events.emit("device.status", { online, lastReadAt: this.lastReadAt });
  }

  /**
   * Record a single device fetch (success or failure). Maintains the recent-
   * fetch ring buffer and the connection state machine. Called from
   * `device/client.ts` via the `onTelemetry` callback.
   */
  recordFetch(entry: FetchTelemetryEntry): void {
    // 1. Ring buffer
    this.fetches.push(entry);
    while (this.fetches.length > FETCH_BUFFER_SIZE) this.fetches.shift();

    // 2. Connection state update — only emit on transitions.
    const prev = this.connection;
    const next: BridgeConnection = { ...prev, lastAttemptAt: entry.at };
    if (entry.outcome === "ok") {
      next.lastSuccessAt = entry.at;
      next.consecutiveFailures = 0;
      next.state = "online";
      next.reason = null;
    } else {
      next.consecutiveFailures = prev.consecutiveFailures + 1;
      const quietMs = next.lastSuccessAt
        ? Date.now() - new Date(next.lastSuccessAt).getTime()
        : Number.POSITIVE_INFINITY;
      let computed: BridgeConnectionState = prev.state;
      if (quietMs >= QUIET_MS_FOR_OFFLINE) computed = "offline";
      else if (next.consecutiveFailures >= FAIL_STREAK_FOR_DEGRADED || quietMs >= QUIET_MS_FOR_DEGRADED) {
        computed = "degraded";
      }
      next.state = computed;
      next.reason =
        computed === "offline"
          ? `No successful fetch in ${Math.round(quietMs / 1000)}s`
          : computed === "degraded"
            ? `${next.consecutiveFailures} consecutive failures (${entry.outcome}${entry.error ? `: ${entry.error}` : ""})`
            : null;
    }

    this.connection = next;
    if (
      prev.state !== next.state ||
      prev.consecutiveFailures !== next.consecutiveFailures ||
      prev.reason !== next.reason
    ) {
      this.events.emit("connection.changed", { ...next });
    }
  }

  /** Best-effort lookup by name for new rooms that the live device returned. */
  ensureRoomForZone(zone: number, name: string): Room {
    const existing = this.getRoomByZone(zone);
    if (existing) return existing;
    // No-defaults rule — every device-sourced reading starts as `null` and
    // only takes a real value once the parser has it in hand. The SPA
    // renders `null` as a placeholder ("—", or hides the card entirely)
    // so users never see a phantom `+0.0 °C` calibration before the
    // installer page has been fetched.
    const room: Room = {
      id: `r-${name.toLowerCase().replace(/\s+/g, "-")}-z${zone}`,
      zone,
      name,
      temperature: null,
      humidity: null,
      setpointHeating: null,
      setpointCooling: null,
      setpointNormal: null,
      setpointReduced: null,
      setpointStandby: null,
      mode: "standby" satisfies RoomMode,
      programOverride: false,
      hasFan: false,
      hasFlap: false,
      hasLight: false,
      fan: 0,
      flap: 0,
      light: false,
      fanRunning: false,
      calibrationTemp: null,
      calibrationHumidity: null,
      programDailyId: 1,
      programWeeklyId: 1,
      // Pick up the persisted floor label so a SPA-edited assignment
      // applies the moment the room is created by the live poller —
      // not just on the next polling tick.
      floor: this.floorAssignments[zone] ?? "",
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
