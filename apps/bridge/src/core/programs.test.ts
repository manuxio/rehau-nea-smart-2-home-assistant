import { describe, it, expect } from "vitest";
import type { WeeklyProgram } from "@rehau/types";
import { rehauWeekdayIndex, resolveDailyProgramId, type RoomProgramAssignment } from "./programs.js";

const weekly = (id: number, days: WeeklyProgram["days"]): WeeklyProgram => ({ id, name: "", days });
const lookup = (...programs: WeeklyProgram[]) => (id: number) => programs.find((p) => p.id === id);

// Local-time dates, so the tests don't depend on the machine's time zone.
const MONDAY = new Date(2026, 9, 19, 12, 0);
const TUESDAY = new Date(2026, 9, 20, 12, 0);
const SATURDAY = new Date(2026, 9, 24, 12, 0);
const SUNDAY = new Date(2026, 9, 25, 12, 0);

describe("rehauWeekdayIndex — REHAU weeks run Monday..Sunday", () => {
  it("maps Monday to 0 and Sunday to 6", () => {
    expect(rehauWeekdayIndex(MONDAY)).toBe(0);
    expect(rehauWeekdayIndex(TUESDAY)).toBe(1);
    expect(rehauWeekdayIndex(SATURDAY)).toBe(5);
    expect(rehauWeekdayIndex(SUNDAY)).toBe(6);
  });

  it("uses local time, so 00:05 already counts as the new day", () => {
    expect(rehauWeekdayIndex(new Date(2026, 9, 26, 0, 5))).toBe(0);
  });
});

describe("resolveDailyProgramId", () => {
  const UNREAD_DAYS: RoomProgramAssignment["programDays"] = [0, 0, 0, 0, 0, 0, 0];
  const programs = lookup(weekly(1, [7, 7, 7, 7, 7, 2, 2]), weekly(2, [3, 3, 3, 3, 3, 3, 3]));

  it("follows the room's weekly program for that weekday (PWeek 1..5)", () => {
    const room: RoomProgramAssignment = { programWeeklyId: 1, programDays: UNREAD_DAYS };
    expect(resolveDailyProgramId(room, programs, TUESDAY)).toBe(7);
    expect(resolveDailyProgramId(room, programs, SATURDAY)).toBe(2);
  });

  it("uses the room's own per-day picks when no weekly program is assigned (PWeek '- - -')", () => {
    const room: RoomProgramAssignment = { programWeeklyId: 0, programDays: [3, 3, 3, 3, 3, 8, 9] };
    expect(resolveDailyProgramId(room, programs, MONDAY)).toBe(3);
    expect(resolveDailyProgramId(room, programs, SUNDAY)).toBe(9);
  });

  it("returns 0 while the assigned weekly program hasn't been read yet", () => {
    const room: RoomProgramAssignment = { programWeeklyId: 4, programDays: UNREAD_DAYS };
    expect(resolveDailyProgramId(room, programs, TUESDAY)).toBe(0);
  });

  it("returns 0 when the room's assignment hasn't been read yet", () => {
    const room: RoomProgramAssignment = { programWeeklyId: 0, programDays: UNREAD_DAYS };
    expect(resolveDailyProgramId(room, programs, TUESDAY)).toBe(0);
  });
});
