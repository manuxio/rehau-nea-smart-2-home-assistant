// Mock client used during stub development. Mirrors the shape that the
// generated @rehau/api-client will expose, so the swap is a one-line import.

import type {
  AlarmMessage,
  DailyProgram,
  Device,
  EnergyLevel,
  Role,
  Room,
  RoomMode,
  SystemMode,
  SystemState,
  WeeklyProgram,
} from "@rehau/types";
import {
  seedAlarms,
  seedDailyPrograms,
  seedDevices,
  seedRooms,
  seedSystem,
  seedWeeklyPrograms,
} from "@rehau/types/mocks";

const delay = (ms = 80): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const mockApi = {
  auth: {
    async login(username: string, _password: string, role: Role = "installer") {
      await delay();
      return {
        token: `mock.${role}.${Date.now()}`,
        role,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        username,
      };
    },
  },
  rooms: {
    async list(): Promise<Room[]> {
      await delay();
      return seedRooms;
    },
    async get(id: string): Promise<Room | undefined> {
      await delay();
      return seedRooms.find((r) => r.id === id);
    },
    async setSetpoint(id: string, value: number) {
      await delay();
      return { ok: true as const, id, value };
    },
    async setMode(id: string, mode: RoomMode) {
      await delay();
      return { ok: true as const, id, mode };
    },
  },
  system: {
    async get(): Promise<SystemState> {
      await delay();
      return seedSystem;
    },
    async setOperatingMode(mode: SystemMode) {
      await delay();
      return { ok: true as const, mode };
    },
    async setEnergyLevel(level: EnergyLevel) {
      await delay();
      return { ok: true as const, level };
    },
  },
  messages: {
    async list(activeOnly = false): Promise<AlarmMessage[]> {
      await delay();
      return activeOnly ? seedAlarms.filter((a) => !a.resolvedAt) : seedAlarms;
    },
  },
  programs: {
    async listDaily(): Promise<DailyProgram[]> {
      await delay();
      return seedDailyPrograms;
    },
    async listWeekly(): Promise<WeeklyProgram[]> {
      await delay();
      return seedWeeklyPrograms;
    },
  },
  devices: {
    async list(): Promise<Device[]> {
      await delay();
      return seedDevices;
    },
  },
};
