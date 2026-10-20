import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { MockDeviceSource } from "../device/source.js";
import type { RoomSetupSnapshot } from "../device/parsers.js";
import { createLogger } from "../observability/log.js";
import { OpLog } from "../observability/ops-log.js";
import { Poller } from "./poller.js";
import { Store } from "./store.js";

const config = loadConfig({
  DEVICE_URL: "http://10.0.0.1",
  JWT_SECRET: "x".repeat(32),
  API_PASSWORD_HASH: "$2b$12$abc",
  LOG_LEVEL: "fatal",
} as NodeJS.ProcessEnv);

/** Mock source whose zone 0 has no weekly program ("- - -") and per-day picks instead. */
class PerDaySource extends MockDeviceSource {
  override async fetchRoomSetup(zone: number): Promise<RoomSetupSnapshot> {
    const s = await super.fetchRoomSetup(zone);
    return zone === 0 ? { ...s, weekly: 0, daysProgram: [3, 3, 3, 3, 3, 8, 9] } : s;
  }
}

const setup = (source = new MockDeviceSource()) => {
  const logger = createLogger(config);
  const store = new Store();
  const poller = new Poller({ config, source, store, logger, ops: new OpLog({ size: 10, logger }) });
  return { store, poller };
};

describe("Poller — the room's daily program for today", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays 0 until the room-set-up page has been read (no mock program shown)", async () => {
    const { store, poller } = setup();
    await poller.refreshRoomList();
    await poller.refreshRoom(0);
    const room = store.getRoomByZone(0)!;
    expect(room.programDailyId).toBe(0);
    expect(room.programWeeklyId).toBe(0);
  });

  it("stores the weekly program from room-set-up and resolves today's daily program", async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 12, 0)); // Saturday
    const { store, poller } = setup();
    store.upsertWeeklyProgram({ id: 1, name: "", days: [7, 7, 7, 7, 7, 2, 2] });
    await poller.refreshRoomList();
    await poller.refreshRoomSetup(0);
    const room = store.getRoomByZone(0)!;
    expect(room.programWeeklyId).toBe(1);
    expect(room.programDays).toEqual([1, 1, 1, 1, 1, 2, 2]);
    expect(room.programDailyId).toBe(2);
  });

  it("moves to the next day's program on the next room-detail poll", async () => {
    vi.setSystemTime(new Date(2026, 9, 25, 23, 59)); // Sunday
    const { store, poller } = setup();
    store.upsertWeeklyProgram({ id: 1, name: "", days: [7, 7, 7, 7, 7, 2, 2] });
    await poller.refreshRoomList();
    await poller.refreshRoomSetup(0);
    expect(store.getRoomByZone(0)!.programDailyId).toBe(2);

    vi.setSystemTime(new Date(2026, 9, 26, 0, 1)); // Monday
    await poller.refreshRoom(0);
    expect(store.getRoomByZone(0)!.programDailyId).toBe(7);
  });

  it("resolves as soon as the weekly program is cached after room-set-up (the boot order)", async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 12, 0)); // Saturday
    const { store, poller } = setup();
    await poller.refreshRoomList();
    await poller.refreshRoomSetup(0);
    expect(store.getRoomByZone(0)!.programDailyId).toBe(0);

    store.upsertWeeklyProgram({ id: 1, name: "", days: [7, 7, 7, 7, 7, 2, 2] });
    expect(store.getRoomByZone(0)!.programDailyId).toBe(2);
  });

  it("has every room's daily program by the end of the boot walk", async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 12, 0)); // Saturday
    const { store, poller } = setup();
    poller.start();
    await poller.kickoffComplete();
    poller.stop();
    // Mock rooms all follow weekly program 1, whose seed maps Saturday to daily 2.
    const rooms = store.listRooms();
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.map((r) => r.programDailyId)).toEqual(rooms.map(() => 2));
  });

  it("follows edits to the weekly program without waiting for a poll", async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 12, 0)); // Saturday
    const { store, poller } = setup();
    store.upsertWeeklyProgram({ id: 1, name: "", days: [7, 7, 7, 7, 7, 2, 2] });
    await poller.refreshRoomList();
    await poller.refreshRoomSetup(0);

    store.upsertWeeklyProgram({ id: 1, name: "", days: [7, 7, 7, 7, 7, 4, 4] });
    expect(store.getRoomByZone(0)!.programDailyId).toBe(4);
  });

  it("doesn't report a change when room-set-up is re-read unchanged", async () => {
    const { store, poller } = setup();
    await poller.refreshRoomList();
    await poller.refreshRoomSetup(0);
    const changed = vi.fn();
    store.events.on("room.changed", changed);
    await poller.refreshRoomSetup(0);
    expect(changed).not.toHaveBeenCalled();
  });

  it("uses the per-day picks when the room has no weekly program", async () => {
    vi.setSystemTime(new Date(2026, 9, 25, 12, 0)); // Sunday
    const { store, poller } = setup(new PerDaySource());
    await poller.refreshRoomList();
    await poller.refreshRoomSetup(0);
    const room = store.getRoomByZone(0)!;
    expect(room.programWeeklyId).toBe(0);
    expect(room.programDailyId).toBe(9);
  });
});
