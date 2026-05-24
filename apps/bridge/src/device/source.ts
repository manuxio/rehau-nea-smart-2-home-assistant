// A `DeviceSource` is the only thing the bridge core talks to. It exposes
// typed reads (dashboard, room list, room detail, messages, system info)
// and typed writes (setpoint, mode, system mode, energy level).
//
// Two implementations:
//   - `LiveDeviceSource` — talks to a real REHAU base station via DeviceClient.
//   - `MockDeviceSource`  — synthesises state from `@rehau/types/mocks`. Used
//     when DEVICE_INSTALLER_CODE is absent or DEVICE_URL is unreachable, and
//     by parser tests / dev environments without LAN access.
//
// Single-flight + write serialisation lives in DeviceClient; this layer
// stays pure-functional w.r.t. the typed surface.

import type {
  AlarmMessage,
  EnergyLevel,
  HeatCurveState,
  InstallerSettingField,
  InstallerSettingsGroup,
  InstallerSettingsSnapshot,
  IOSnapshot,
  RoomCalibration,
  RoomMode,
  SystemMode,
  Topology,
  UptimeState,
} from "@rehau/types";
import {
  seedAlarms,
  seedDailyPrograms,
  seedRooms,
  seedSystem,
  seedWeeklyPrograms,
} from "@rehau/types/mocks";
import {
  energyLevelToDevice,
  operatingModeToDevice,
  roomModeToDeviceMode,
  setpointToDeviceForm,
} from "./codecs.js";
import { DeviceClient } from "./client.js";
import {
  parseCalibration,
  parseDailyProgram,
  parseDashboard,
  parseHeatCurve,
  parseIO,
  parseMessages,
  parseRoomDetail,
  parseRoomList,
  parseRoomSetup,
  parseSystemInfo,
  parseTopology,
  parseUptime,
  parseWeeklyProgram,
  type CalibrationSnapshot,
  type DailyProgramSnapshot,
  type DashboardSnapshot,
  type RoomDetailSnapshot,
  type RoomListEntry,
  type RoomSetupSnapshot,
  type SystemInfoSnapshot,
  type WeeklyProgramSnapshot,
} from "./parsers.js";
import { InstallerSession } from "./installer.js";
import {
  buildSettingsForm,
  mergeSettings,
  parseSettings,
  settingsGroupDef,
} from "./settings.js";

export interface DeviceSource {
  readonly kind: "live" | "mock";
  readonly hasInstaller: boolean;
  /** Open the always-held installer session, if available. No-op on mock /
   *  when no installer code is configured. Called by the Poller at boot
   *  before the priority sequence walks installer-gated pages. */
  openInstallerSession?(): Promise<void>;
  fetchDashboard(): Promise<DashboardSnapshot>;
  fetchRoomList(): Promise<RoomListEntry[]>;
  fetchRoomDetail(zone: number): Promise<RoomDetailSnapshot>;
  fetchMessages(): Promise<AlarmMessage[]>;
  /**
   * Acknowledge all REHAU alarms. The device's /messages.html page wraps
   * its table in `<form action="user-menu.html" method="post">` carrying
   * a single hidden `MessagesHidden` input — POSTing that form back is
   * what its built-in "Confirm" button does. After acknowledgement the
   * device clears the messages table on the next /messages.html GET.
   */
  clearMessages(): Promise<void>;
  fetchSystemInfo(): Promise<SystemInfoSnapshot>;
  fetchDailyProgram(id: number): Promise<DailyProgramSnapshot>;
  fetchWeeklyProgram(id: number): Promise<WeeklyProgramSnapshot>;
  setRoomSetpoint(input: SetRoomSetpointInput): Promise<void>;
  setRoomMode(input: SetRoomModeInput): Promise<void>;
  setRoomLight(input: SetRoomLightInput): Promise<void>;
  fetchRoomSetup(zone: number): Promise<RoomSetupSnapshot>;
  setRoomSetup(zone: number, patch: RoomSetupPatch): Promise<RoomSetupSnapshot>;
  setOperatingMode(mode: SystemMode): Promise<void>;
  setEnergyLevel(level: EnergyLevel): Promise<void>;
  setDailyProgram(id: number, bits: number[]): Promise<void>;
  setWeeklyProgram(id: number, days: [number, number, number, number, number, number, number]): Promise<void>;
  // ── installer (only when installer code is configured) ──
  fetchCalibration(): Promise<CalibrationSnapshot>;
  /**
   * Apply a partial update: only fields present in `patch` change. Returns
   * the new full state so the caller can avoid a second installer session.
   */
  setCalibration(patch: { outdoor?: number; rooms?: RoomCalibration[] }): Promise<CalibrationSnapshot>;
  fetchIO(): Promise<IOSnapshot>;
  fetchUptime(): Promise<UptimeState>;
  fetchTopology(): Promise<Topology>;
  fetchHeatCurve(): Promise<Omit<HeatCurveState, "meta">>;
  fetchSettings(group: InstallerSettingsGroup): Promise<Omit<InstallerSettingsSnapshot, "meta">>;
  setSettings(
    group: InstallerSettingsGroup,
    patch: Array<{ name: string; value: number | boolean }>,
  ): Promise<Omit<InstallerSettingsSnapshot, "meta">>;
  close(): Promise<void>;
}

export interface SetRoomSetpointInput {
  zone: number;
  name: string;
  value: number;
  mode: RoomMode;
  /** Preserve the current light state — every `/room-page.html` POST also
   *  carries `lightH`, so omitting it would inadvertently flip the light. */
  light: boolean;
}
export interface SetRoomModeInput {
  zone: number;
  name: string;
  mode: RoomMode;
  /** Required when mode ≠ standby. */
  setpoint?: number;
  light: boolean;
}
export interface SetRoomLightInput {
  zone: number;
  name: string;
  light: boolean;
  setpoint: number;
  mode: RoomMode;
}

/** Partial patch to room-set-up.html — only listed fields change. */
export interface RoomSetupPatch {
  lock?: boolean;
  autoStart?: boolean;
  windowDetection?: boolean;
}

// ───────────── live ─────────────

export class LiveDeviceSource implements DeviceSource {
  readonly kind = "live" as const;
  readonly hasInstaller: boolean;
  constructor(
    private readonly http: DeviceClient,
    private readonly installer?: InstallerSession,
  ) {
    this.hasInstaller = installer !== undefined;
  }

  async close(): Promise<void> {
    // Best-effort: drop the always-held installer session so the device
    // returns to user mode for any other LAN clients on the AP.
    if (this.installer) {
      try { await this.installer.close(); } catch { /* logged inside */ }
    }
    await this.http.close();
  }

  /** Open the always-held installer session at boot. */
  async openInstallerSession(): Promise<void> {
    if (!this.installer) return;
    await this.installer.open();
  }

  fetchDashboard = async (): Promise<DashboardSnapshot> =>
    parseDashboard(await this.http.get("/"));

  fetchRoomList = async (): Promise<RoomListEntry[]> =>
    parseRoomList(await this.http.get("/room-page.html"));

  fetchRoomDetail = async (zone: number): Promise<RoomDetailSnapshot> =>
    parseRoomDetail(await this.http.postKey("/room-operating.html", String(zone)));

  fetchMessages = async (): Promise<AlarmMessage[]> =>
    parseMessages(await this.http.get("/messages.html"));

  // POST the messages-page form back. REHAU's table is wrapped in
  // `<form action="user-menu.html"><input name="MessagesHidden" ...>`
  // — submitting it (no extra fields needed) is the device's
  // "acknowledge all alarms" trigger. The body string mirrors what the
  // built-in Confirm button submits.
  clearMessages = async (): Promise<void> => {
    await this.http.postForm("/user-menu.html", { MessagesHidden: "" });
  };

  fetchSystemInfo = async (): Promise<SystemInfoSnapshot> =>
    parseSystemInfo(await this.http.get("/user-config-installer.html"));

  async setRoomSetpoint(i: SetRoomSetpointInput): Promise<void> {
    const { RSH, temp } = setpointToDeviceForm(i.value, i.mode);
    await this.http.postForm("/room-page.html", {
      zone: String(i.zone),
      RoomName: i.name,
      RSH,
      temp,
      mode: roomModeToDeviceMode(i.mode),
      lightH: i.light ? "1" : "0",
    });
  }

  async setRoomMode(i: SetRoomModeInput): Promise<void> {
    const sp = i.setpoint ?? 20;
    const { RSH, temp } = setpointToDeviceForm(sp, i.mode);
    await this.http.postForm("/room-page.html", {
      zone: String(i.zone),
      RoomName: i.name,
      RSH,
      temp,
      mode: roomModeToDeviceMode(i.mode),
      lightH: i.light ? "1" : "0",
    });
  }

  async setRoomLight(i: SetRoomLightInput): Promise<void> {
    const { RSH, temp } = setpointToDeviceForm(i.setpoint, i.mode);
    await this.http.postForm("/room-page.html", {
      zone: String(i.zone),
      RoomName: i.name,
      RSH,
      temp,
      mode: roomModeToDeviceMode(i.mode),
      lightH: i.light ? "1" : "0",
    });
  }

  async fetchRoomSetup(zone: number): Promise<RoomSetupSnapshot> {
    return parseRoomSetup(await this.http.postKey("/room-set-up.html", String(zone)));
  }

  async setRoomSetup(zone: number, patch: RoomSetupPatch): Promise<RoomSetupSnapshot> {
    const cur = parseRoomSetup(await this.http.postKey("/room-set-up.html", String(zone)));
    const next: RoomSetupSnapshot = {
      ...cur,
      flags: {
        auto: patch.autoStart ?? cur.flags.auto,
        swow: patch.windowDetection ?? cur.flags.swow,
        lock: patch.lock ?? cur.flags.lock,
      },
    };
    // Mirror the device JS `validate()`: °C → °F×10 for each H-suffixed hidden.
    const toF10 = (c: number): string => String(Math.round((c * 9 / 5 + 32) * 10));
    const form: Record<string, string> = {
      "user-set-up": "",
      RoomName: next.name,
      zone: String(next.zone),
      HNormH: toF10(next.setpoints.normalH),
      HRedH: toF10(next.setpoints.reducedH),
      HStandH: toF10(next.setpoints.standby),
      CNormH: toF10(next.setpoints.normalC),
      CRedH: toF10(next.setpoints.reducedC),
      SPMaxH: toF10(next.setpoints.maxH),
      SPMinH: toF10(next.setpoints.minC),
      PWeek: String(next.weekly),
    };
    // Per-day program assignments — device is 0-indexed, we store 1-indexed.
    for (let i = 0; i < 7; i++) {
      const d = next.daysProgram[i] ?? 1;
      form[`PDay0${i}`] = String(Math.max(0, d - 1));
    }
    // Checkboxes: include `=on` if true, omit otherwise.
    if (next.flags.auto) form.Auto = "on";
    if (next.flags.swow) form.SWOW = "on";
    if (next.flags.lock) form.Lock = "on";
    await this.http.postForm("/room-page.html", form);
    return next;
  }

  async setOperatingMode(mode: SystemMode): Promise<void> {
    await this.http.postForm("/user-menu.html", {
      operatingMode: "",
      opMode: String(operatingModeToDevice(mode)),
    });
  }

  async setEnergyLevel(level: EnergyLevel): Promise<void> {
    await this.http.postForm("/user-menu.html", {
      energyLevel: "",
      energyL: String(energyLevelToDevice(level)),
    });
  }

  fetchDailyProgram = async (id: number): Promise<DailyProgramSnapshot> =>
    parseDailyProgram(await this.http.postKey("/user-update-daily-program.html", String(id)));

  fetchWeeklyProgram = async (id: number): Promise<WeeklyProgramSnapshot> =>
    parseWeeklyProgram(await this.http.postKey("/user-update-weekly-program.html", String(id)));

  async setDailyProgram(id: number, bits: number[]): Promise<void> {
    if (bits.length !== 96) throw new Error(`bits must be length 96, got ${bits.length}`);
    const bitsStr = bits.map((b) => (b ? "1" : "0")).join("");
    await this.http.postForm("/user-daily-program.html", {
      pDaily: "",
      idProgDay: String(id - 1),
      prog: bitsStr,
    });
  }

  async setWeeklyProgram(
    id: number,
    days: [number, number, number, number, number, number, number],
  ): Promise<void> {
    const form: Record<string, string> = {
      pWeek: "",
      weeklyProgram: String(id),
    };
    for (let i = 0; i < 7; i++) {
      form[`PDay${i}`] = String((days[i] ?? 1) - 1);
    }
    await this.http.postForm("/user-weekly-program.html", form);
  }

  // ─── installer-tier ──────────────────────────────────────
  private requireInstaller(): InstallerSession {
    if (!this.installer) throw new Error("installer code not configured");
    return this.installer;
  }

  async fetchCalibration(): Promise<CalibrationSnapshot> {
    const s = this.requireInstaller();
    return s.run(async () => parseCalibration(await this.http.get("/installer-adjustementOffset.html")));
  }

  async setCalibration(patch: { outdoor?: number; rooms?: RoomCalibration[] }): Promise<CalibrationSnapshot> {
    const s = this.requireInstaller();
    return s.run(async () => {
      // The device's calibration form is all-fields-or-nothing — we must
      // resubmit every existing entry alongside the changes.
      const current = parseCalibration(await this.http.get("/installer-adjustementOffset.html"));
      const outdoor = patch.outdoor ?? current.outdoor;
      const merged = new Map<number, RoomCalibration>();
      for (const r of current.rooms) merged.set(r.zone, r);
      for (const r of patch.rooms ?? []) merged.set(r.zone, r);
      const rooms = [...merged.values()].sort((a, b) => a.zone - b.zone);

      const form: Record<string, string> = {
        OffsetAdj: "",
        out00: outdoor.toFixed(1),
      };
      for (const r of rooms) {
        const idx = r.zone.toString().padStart(2, "0");
        form[`air${idx}`] = r.tempOffset.toFixed(1);
        form[`humi${idx}`] = String(Math.round(r.humidityOffset));
      }
      await this.http.postForm("/installer-diagnosis.html", form);
      // We just wrote `outdoor` + `rooms`; trust the write and return.
      return { outdoor, rooms };
    });
  }

  async fetchIO(): Promise<IOSnapshot> {
    const s = this.requireInstaller();
    return s.run(async () => parseIO(await this.http.get("/installer-inputoutput.html")));
  }

  async fetchUptime(): Promise<UptimeState> {
    const s = this.requireInstaller();
    return s.run(async () => parseUptime(await this.http.get("/installer-system-statistics.html")));
  }

  async fetchTopology(): Promise<Topology> {
    const s = this.requireInstaller();
    return s.run(async () => parseTopology(await this.http.get("/diagSett.html")));
  }

  async fetchHeatCurve(): Promise<Omit<HeatCurveState, "meta">> {
    const s = this.requireInstaller();
    return s.run(async () => parseHeatCurve(await this.http.get("/circSett.html")));
  }

  async fetchSettings(group: InstallerSettingsGroup): Promise<Omit<InstallerSettingsSnapshot, "meta">> {
    const s = this.requireInstaller();
    const def = settingsGroupDef(group);
    return s.run(async () => parseSettings(group, await this.http.get(def.path)));
  }

  async setSettings(
    group: InstallerSettingsGroup,
    patch: Array<{ name: string; value: number | boolean }>,
  ): Promise<Omit<InstallerSettingsSnapshot, "meta">> {
    const s = this.requireInstaller();
    const def = settingsGroupDef(group);
    return s.run(async () => {
      // Read first → merge → POST every field (all-or-nothing form semantics).
      const cur = parseSettings(group, await this.http.get(def.path));
      const merged = mergeSettings(cur.fields, patch);
      const form = buildSettingsForm(group, merged);
      await this.http.postForm("/installer-setting.html", form);
      return { group, fields: merged };
    });
  }
}

// ───────────── mock ─────────────

export class MockDeviceSource implements DeviceSource {
  readonly kind = "mock" as const;
  readonly hasInstaller = true;

  // Local mutable copy of the seeds so writes update reads.
  private rooms = seedRooms.map((r) => ({ ...r }));
  private system = { ...seedSystem };
  private messages = seedAlarms.slice();

  async close(): Promise<void> { /* no-op */ }

  async fetchDashboard(): Promise<DashboardSnapshot> {
    return {
      outdoorTemp: this.system.outdoorTemp,
      clock: new Date().toISOString().slice(0, 16).replace("T", " "),
      operatingMode: this.system.operatingMode,
      energyLevel: this.system.energyLevel,
    };
  }

  async fetchRoomList(): Promise<RoomListEntry[]> {
    // The mock-seed Rooms always have real numeric values, but the type is
    // now `number | null` (no-defaults rule). Coerce via `??` so the
    // mock path satisfies the RoomListEntry contract — parsers in live
    // mode produce real numbers, so this fallback is mock-only.
    return this.rooms.map((r) => ({ zone: r.zone, name: r.name, temperature: r.temperature ?? 0 }));
  }

  async fetchRoomDetail(zone: number): Promise<RoomDetailSnapshot> {
    const r = this.rooms.find((x) => x.zone === zone);
    if (!r) throw new Error(`unknown zone ${zone}`);
    // Same null-coercion as fetchRoomList — mock seed always has numbers.
    const heat = r.setpointHeating ?? 20;
    return {
      zone: r.zone,
      name: r.name,
      temperature: r.temperature ?? 0,
      humidity: r.humidity ?? 0,
      setpoint: heat,
      setpointHeatingNormal: heat,
      setpointHeatingReduced: Math.max(5, heat - 1.5),
      setpointStandby: 23,
      mode: r.mode,
      programActive: 1,
      fan: r.fan,
      flap: r.flap,
      light: r.light,
      hasLight: r.hasLight,
      hasFan: r.hasFan,
      hasFlap: r.hasFlap,
      fanRunning: r.fanRunning,
    };
  }

  async fetchMessages(): Promise<AlarmMessage[]> {
    return this.messages;
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
  }

  async fetchSystemInfo(): Promise<SystemInfoSnapshot> {
    return {
      uniqueCode: this.system.uniqueCode,
      fw: this.system.fw,
      seasonStart: this.system.seasonStart,
      seasonEnd: this.system.seasonEnd,
      outdoorOffset: this.system.outdoorOffset,
    };
  }

  async setRoomSetpoint(i: SetRoomSetpointInput): Promise<void> {
    const r = this.rooms.find((x) => x.zone === i.zone);
    if (r) r.setpointHeating = i.value;
  }

  async setRoomMode(i: SetRoomModeInput): Promise<void> {
    const r = this.rooms.find((x) => x.zone === i.zone);
    if (r) {
      r.mode = i.mode;
      if (i.setpoint != null) r.setpointHeating = i.setpoint;
      r.light = i.light;
    }
  }

  async setRoomLight(i: SetRoomLightInput): Promise<void> {
    const r = this.rooms.find((x) => x.zone === i.zone);
    if (r) r.light = i.light;
  }

  private roomSetups = new Map<number, RoomSetupSnapshot>();
  private seedSetup(zone: number, name: string): RoomSetupSnapshot {
    return {
      zone,
      name,
      setpoints: { normalH: 20, reducedH: 18.5, standby: 23, normalC: 26, reducedC: 24.5, maxH: 31, minC: 15 },
      flags: { auto: true, swow: true, lock: false },
      weekly: 1,
      daysProgram: [1, 1, 1, 1, 1, 2, 2],
    };
  }

  async fetchRoomSetup(zone: number): Promise<RoomSetupSnapshot> {
    const r = this.rooms.find((x) => x.zone === zone);
    let s = this.roomSetups.get(zone);
    if (!s) {
      s = this.seedSetup(zone, r?.name ?? `Zone ${zone}`);
      this.roomSetups.set(zone, s);
    }
    return { ...s, flags: { ...s.flags } };
  }

  async setRoomSetup(zone: number, patch: RoomSetupPatch): Promise<RoomSetupSnapshot> {
    const cur = await this.fetchRoomSetup(zone);
    const next: RoomSetupSnapshot = {
      ...cur,
      flags: {
        auto: patch.autoStart ?? cur.flags.auto,
        swow: patch.windowDetection ?? cur.flags.swow,
        lock: patch.lock ?? cur.flags.lock,
      },
    };
    this.roomSetups.set(zone, next);
    return next;
  }

  async setOperatingMode(mode: SystemMode): Promise<void> {
    this.system = { ...this.system, operatingMode: mode };
  }

  async setEnergyLevel(level: EnergyLevel): Promise<void> {
    this.system = { ...this.system, energyLevel: level };
  }

  private daily = seedDailyPrograms.map((p) => ({ ...p, bits: [...p.bits] }));
  private weekly = seedWeeklyPrograms.map((p) => ({ ...p, days: [...p.days] as WeeklyProgramSnapshot["days"] }));

  async fetchDailyProgram(id: number): Promise<DailyProgramSnapshot> {
    const p = this.daily.find((d) => d.id === id);
    if (!p) throw new Error(`unknown daily program ${id}`);
    return { id: p.id, bits: p.bits.slice() };
  }

  async fetchWeeklyProgram(id: number): Promise<WeeklyProgramSnapshot> {
    const p = this.weekly.find((w) => w.id === id);
    if (!p) throw new Error(`unknown weekly program ${id}`);
    return { id: p.id, days: [...p.days] as WeeklyProgramSnapshot["days"] };
  }

  async setDailyProgram(id: number, bits: number[]): Promise<void> {
    const p = this.daily.find((d) => d.id === id);
    if (p) p.bits = bits.slice();
  }

  async setWeeklyProgram(
    id: number,
    days: [number, number, number, number, number, number, number],
  ): Promise<void> {
    const p = this.weekly.find((w) => w.id === id);
    if (p) p.days = [...days] as typeof p.days;
  }

  // ─── installer-tier (synthetic) ──────────────────────────
  // RoomCalibration expects concrete numbers (writes back to the device).
  // The seed Room may carry `null` for calibration after the no-defaults
  // sweep, so coerce to 0 here — mock-only.
  private calibration: CalibrationSnapshot = {
    outdoor: 0,
    rooms: seedRooms.map((r) => ({
      zone: r.zone,
      tempOffset: r.calibrationTemp ?? 0,
      humidityOffset: r.calibrationHumidity ?? 0,
    })),
  };

  async fetchCalibration(): Promise<CalibrationSnapshot> {
    return { outdoor: this.calibration.outdoor, rooms: this.calibration.rooms.map((r) => ({ ...r })) };
  }

  async setCalibration(patch: { outdoor?: number; rooms?: RoomCalibration[] }): Promise<CalibrationSnapshot> {
    this.calibration = {
      outdoor: patch.outdoor ?? this.calibration.outdoor,
      rooms: this.calibration.rooms.map((r) => {
        const upd = patch.rooms?.find((x) => x.zone === r.zone);
        return upd ? { ...r, ...upd } : r;
      }),
    };
    return { outdoor: this.calibration.outdoor, rooms: this.calibration.rooms.map((r) => ({ ...r })) };
  }

  async fetchIO(): Promise<IOSnapshot> {
    return {
      master: {
        rz: [0, 0, 0, 0, 0, 0, 0, 0],
        relay: [0, 0, 0, 0],
        di: [0, 0, 0, 0],
      },
      umodules: {
        umodule0: {
          relay: [0, 0, 0, 0],
          di: [0, 0, 0, 0],
          aiC: [22.6, 22.6, null, null],
          aoPct: 0,
        },
      },
    };
  }

  async fetchUptime(): Promise<UptimeState> {
    return { years: 0, days: 0, hours: 2 };
  }

  async fetchTopology(): Promise<Topology> {
    return { baseModules: 1, rModules: 0, uModules: 1, rooms: 4, mixedCircuits: 1, dehumidifiers: 0 };
  }

  async fetchHeatCurve(): Promise<Omit<HeatCurveState, "meta">> {
    return {
      slopeNormal: 0.6, slopeAbsent: 0.5,
      startNormal: 20, startAbsent: 17,
      reductionK: 4,
      minFlowNormalC: 25, minFlowAbsentC: 20,
      maxFlowNormalC: 45, maxFlowAbsentC: 35,
    };
  }

  // Local copy of each group's fields, seeded from a stubbed parse on first
  // call. Lets the mock round-trip writes for dev.
  private settingsState = new Map<InstallerSettingsGroup, InstallerSettingField[]>();

  private seedSettings(group: InstallerSettingsGroup): InstallerSettingField[] {
    const def = settingsGroupDef(group);
    return def.fields.map((f) => ({
      ...f,
      value: f.kind === "boolean" ? false : (f.min ?? 0),
    }));
  }

  async fetchSettings(group: InstallerSettingsGroup): Promise<Omit<InstallerSettingsSnapshot, "meta">> {
    let fields = this.settingsState.get(group);
    if (!fields) {
      fields = this.seedSettings(group);
      this.settingsState.set(group, fields);
    }
    return { group, fields: fields.map((f) => ({ ...f })) };
  }

  async setSettings(
    group: InstallerSettingsGroup,
    patch: Array<{ name: string; value: number | boolean }>,
  ): Promise<Omit<InstallerSettingsSnapshot, "meta">> {
    const cur = this.settingsState.get(group) ?? this.seedSettings(group);
    const next = mergeSettings(cur, patch);
    this.settingsState.set(group, next);
    return { group, fields: next.map((f) => ({ ...f })) };
  }
}
