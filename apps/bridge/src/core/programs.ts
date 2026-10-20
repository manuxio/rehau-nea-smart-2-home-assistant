import type { Room, WeeklyProgram } from "@rehau/types";

export type RoomProgramAssignment = Pick<Room, "programWeeklyId" | "programDays">;

/** True when two Mon..Sun daily-program assignments hold the same slots. */
export const sameProgramDays = (
  a: RoomProgramAssignment["programDays"],
  b: RoomProgramAssignment["programDays"],
): boolean => a.every((slot, i) => slot === b[i]);

/** REHAU numbers the week Monday..Sunday (0..6); `Date#getDay()` starts on Sunday. */
export const rehauWeekdayIndex = (date: Date): number => (date.getDay() + 6) % 7;

/**
 * Daily program slot (1..10) a room follows on `date`, or `0` when it can't
 * be known yet. A room either follows a weekly program (`PWeek` 1..5), which
 * maps each weekday to a daily program, or — with `PWeek` "- - -" (0) — its
 * own per-day picks (`PDay00`..`PDay06`).
 */
export const resolveDailyProgramId = (
  room: RoomProgramAssignment,
  getWeeklyProgram: (id: number) => WeeklyProgram | undefined,
  date: Date,
): number => {
  const day = rehauWeekdayIndex(date);
  if (room.programWeeklyId > 0) return getWeeklyProgram(room.programWeeklyId)?.days[day] ?? 0;
  return room.programDays[day] ?? 0;
};
