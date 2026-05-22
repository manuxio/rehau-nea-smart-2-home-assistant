// src/main.ts
import dotenv from "dotenv";
import { execFile } from "child_process";
import { resolve as resolve2 } from "path";
import { promisify } from "util";

// src/config.ts
import { z } from "zod";
var csvNumbers = z.string().transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));
var roomFloorsSchema = z.string().default("").transform((s) => {
  const out = {};
  for (const pair of s.split(",").map((p) => p.trim()).filter(Boolean)) {
    const [idx, ...rest] = pair.split(":");
    const i = Number(idx);
    const floor = rest.join(":").trim();
    if (Number.isFinite(i) && floor) out[i] = floor;
  }
  return out;
});
var envSchema = z.object({
  // device
  DEVICE_URL: z.string().url(),
  DEVICE_MODE: z.enum(["live", "mock"]).default("live"),
  DEVICE_INSTALLER_CODE: z.string().optional(),
  DEVICE_ID: z.string().optional(),
  DEVICE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5e3),
  /** Mandatory cool-down between two consecutive device calls, in ms. */
  DEVICE_MIN_GAP_MS: z.coerce.number().int().min(0).default(150),
  INSTALLER_MAX_SESSION_S: z.coerce.number().int().positive().default(30),
  // http
  HTTP_PORT: z.coerce.number().int().positive().default(8080),
  HTTP_CORS_ORIGINS: z.string().default(""),
  JWT_SECRET: z.string().min(16),
  JWT_TTL: z.string().default("1h"),
  API_USER: z.string().default("admin"),
  API_PASSWORD_HASH: z.string(),
  ADMIN_ROLE: z.enum(["user", "installer"]).default("installer"),
  // installation
  /**
   * Human-readable name for this REHAU installation. Lets multiple instances
   * coexist on the same MQTT broker / HA — used as:
   *   - HA device "name" (so two installations show up as e.g. "Casa" and "Ufficio")
   *   - slug component injected into the MQTT topic path
   */
  INSTALLATION_NAME: z.string().min(1).default("Casa"),
  // mqtt
  MQTT_URL: z.string().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_BASE_TOPIC: z.string().default("rehau"),
  MQTT_HA_DISCOVERY: z.coerce.boolean().default(true),
  MQTT_HA_DISCOVERY_PREFIX: z.string().default("homeassistant"),
  // polling (seconds)
  POLL_DASHBOARD_S: z.coerce.number().int().positive().default(30),
  POLL_ROOMS_S: z.coerce.number().int().positive().default(15),
  POLL_ROOM_DETAIL_S: z.coerce.number().int().positive().default(60),
  POLL_MESSAGES_S: z.coerce.number().int().positive().default(300),
  POLL_IO_S: z.coerce.number().int().positive().default(10),
  // Calibration auto-poll cadence. Calibration lives behind an installer
  // session (full open/close per fetch), so we keep it slow by default.
  // 0 disables the auto-poll entirely; the force-refresh button in the
  // SPA (POST /api/v1/installer/refresh) and the existing Installer-tab
  // GET still trigger one-shot fetches on demand.
  POLL_CALIBRATION_S: z.coerce.number().int().nonnegative().default(180),
  EXPOSE_IO: z.coerce.boolean().default(true),
  EXPOSE_CALIBRATION: z.coerce.boolean().default(false),
  // ui-only mapping
  ROOM_FLOORS: roomFloorsSchema,
  // logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).default("json")
});
var loadConfig = (env = process.env) => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:
${issues}`);
  }
  return parsed.data;
};

// src/core/commander.ts
var slotForMode = (room, mode) => {
  switch (mode) {
    case "normal":
      return room.setpointNormal ?? room.setpointHeating;
    case "reduced":
      return room.setpointReduced ?? room.setpointHeating;
    case "standby":
      return room.setpointStandby ?? room.setpointHeating;
    case "program":
    case "program_override":
      return room.setpointNormal ?? room.setpointHeating;
  }
};
var Commander = class {
  constructor(a) {
    this.a = a;
  }
  a;
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
  async optimistic(room, next, doWrite, afterWrite) {
    const prev = {};
    const prevRec = prev;
    const roomRec = room;
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
  async setRoomSetpoint(roomId, value) {
    const room = this.a.store.getRoom(roomId);
    if (!room) return void 0;
    return this.optimistic(
      room,
      { setpointHeating: value },
      () => this.a.source.setRoomSetpoint({
        zone: room.zone,
        name: room.name,
        value,
        mode: room.mode,
        light: room.light
      }),
      () => this.a.poller.refreshRoom(room.zone)
    );
  }
  async setRoomMode(roomId, mode, setpoint) {
    const room = this.a.store.getRoom(roomId);
    if (!room) return void 0;
    const slot = setpoint ?? slotForMode(room, mode);
    if (slot === null) {
      throw Object.assign(new Error("room setpoint not yet known"), { statusCode: 503 });
    }
    return this.optimistic(
      room,
      { mode, setpointHeating: slot },
      () => this.a.source.setRoomMode({
        zone: room.zone,
        name: room.name,
        mode,
        setpoint: slot,
        light: room.light
      }),
      () => this.a.poller.refreshRoom(room.zone)
    );
  }
  async setRoomLight(roomId, light) {
    const room = this.a.store.getRoom(roomId);
    if (!room) return void 0;
    if (room.setpointHeating === null) {
      throw Object.assign(new Error("room setpoint not yet known"), { statusCode: 503 });
    }
    const heat = room.setpointHeating;
    return this.optimistic(
      room,
      { light },
      () => this.a.source.setRoomLight({
        zone: room.zone,
        name: room.name,
        light,
        setpoint: heat,
        mode: room.mode
      }),
      () => this.a.poller.refreshRoom(room.zone)
    );
  }
  /**
   * Generic patch for the three room-set-up flags. Only fields explicitly set
   * are forwarded — the source handles read+merge+POST internally.
   */
  async setRoomFlags(roomId, patch) {
    const room = this.a.store.getRoom(roomId);
    if (!room) return void 0;
    return this.optimistic(
      room,
      patch,
      // setRoomSetup returns RoomSetupSnapshot; the optimistic helper
      // only needs a Promise<void>, so swallow the value.
      async () => {
        await this.a.source.setRoomSetup(room.zone, patch);
      },
      () => this.a.poller.refreshRoomSetup(room.zone)
    );
  }
  async setOperatingMode(mode) {
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
  async setEnergyLevel(level) {
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
  async refreshDailyProgram(id) {
    const snap = await this.a.source.fetchDailyProgram(id);
    const cur = this.a.store.getDailyProgram(id);
    const next = {
      id: snap.id,
      name: cur?.name ?? "",
      bits: snap.bits
    };
    this.a.store.upsertDailyProgram(next);
    return next;
  }
  async refreshWeeklyProgram(id) {
    const snap = await this.a.source.fetchWeeklyProgram(id);
    const cur = this.a.store.getWeeklyProgram(id);
    const next = {
      id: snap.id,
      name: cur?.name ?? "",
      days: snap.days
    };
    this.a.store.upsertWeeklyProgram(next);
    return next;
  }
  async setDailyProgram(id, bits) {
    await this.a.source.setDailyProgram(id, bits);
    return this.refreshDailyProgram(id);
  }
  async setWeeklyProgram(id, days) {
    await this.a.source.setWeeklyProgram(id, days);
    return this.refreshWeeklyProgram(id);
  }
};

// src/core/poller.ts
var activeSetpoint = (d) => {
  switch (d.mode) {
    case "normal":
      return d.setpointHeatingNormal;
    case "reduced":
      return d.setpointHeatingReduced;
    case "program":
    case "program_override":
      return d.programActive === 1 ? d.setpointHeatingReduced : d.setpointHeatingNormal;
    case "standby":
      return d.setpointHeatingNormal;
  }
};
var SECOND = 1e3;
var safe = async (logger, store, label, fn) => {
  try {
    await fn();
    store.setReachable(true);
  } catch (err) {
    logger.warn({ err, label }, "poll failed");
    store.setReachable(false);
  }
};
var Poller = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  timers = [];
  rrIndex = 0;
  start() {
    const { config: c, logger } = this.opts;
    logger.info({ source: this.opts.source.kind }, "poller starting");
    this.timers.push(setInterval(() => void this.pollDashboard(), c.POLL_DASHBOARD_S * SECOND));
    this.timers.push(setInterval(() => void this.pollRoomList(), c.POLL_ROOMS_S * SECOND));
    this.timers.push(setInterval(() => void this.pollRoomDetailRR(), c.POLL_ROOM_DETAIL_S * SECOND));
    this.timers.push(setInterval(() => void this.pollMessages(), c.POLL_MESSAGES_S * SECOND));
    if (c.EXPOSE_IO && this.opts.source.hasInstaller) {
      this.timers.push(setInterval(() => void this.pollIO(), c.POLL_IO_S * SECOND));
      void this.pollIO();
    }
    if (c.POLL_CALIBRATION_S > 0 && this.opts.source.hasInstaller) {
      this.timers.push(
        setInterval(() => void this.pollCalibration(), c.POLL_CALIBRATION_S * SECOND)
      );
      setTimeout(() => void this.pollCalibration(), 8e3);
    }
    void (async () => {
      await this.pollDashboard();
      await this.pollRoomList();
      await this.pollAllRoomDetails();
      void this.pollMessages();
      void this.pollSystemInfo();
    })();
  }
  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }
  // ─── one-shot helpers used after writes ──────────────────────
  refreshDashboard() {
    return this.pollDashboard();
  }
  refreshRoomList() {
    return this.pollRoomList();
  }
  refreshRoom(zone) {
    return this.pollRoomDetail(zone);
  }
  refreshCalibration() {
    return this.pollCalibration();
  }
  /**
   * Force-refresh hook used by the SPA's "Refresh" button — kicks off
   * every cheap poll in parallel plus the expensive calibration one if
   * the bridge has installer access. Returns when all of them have
   * settled so the SPA can show progress feedback.
   */
  async refreshAll() {
    const tasks = [
      this.pollSystemInfo(),
      this.pollDashboard(),
      this.pollRoomList(),
      this.pollAllRoomDetails(),
      this.pollMessages()
    ];
    if (this.opts.source.hasInstaller) tasks.push(this.pollCalibration());
    await Promise.allSettled(tasks);
  }
  // ─── poll bodies ────────────────────────────────────────────
  pollSystemInfo() {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "system-info", async () => {
      const info = await source.fetchSystemInfo();
      store.patchSystem({
        uniqueCode: info.uniqueCode,
        fw: info.fw,
        seasonStart: info.seasonStart,
        seasonEnd: info.seasonEnd,
        outdoorOffset: info.outdoorOffset
      });
    });
  }
  pollDashboard() {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "dashboard", async () => {
      const d = await source.fetchDashboard();
      store.patchSystem({
        outdoorTemp: d.outdoorTemp,
        operatingMode: d.operatingMode,
        energyLevel: d.energyLevel,
        reachable: true
      });
    });
  }
  pollRoomList() {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "room-list", async () => {
      const list = await source.fetchRoomList();
      for (const r of list) {
        const room = store.ensureRoomForZone(r.zone, r.name);
        store.patchRoom(room.id, { name: r.name, temperature: r.temperature, zone: r.zone });
      }
    });
  }
  pollRoomDetailRR() {
    const rooms = this.opts.store.listRooms();
    if (rooms.length === 0) return Promise.resolve();
    const room = rooms[this.rrIndex % rooms.length];
    this.rrIndex++;
    return this.pollRoomDetail(room.zone);
  }
  pollRoomDetail(zone) {
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
        programOverride: d.mode === "program_override"
      });
    });
  }
  /** Reads the room-set-up.html page for the flags (lock / auto / SWOW). */
  refreshRoomSetup(zone) {
    return this.pollRoomSetup(zone);
  }
  pollRoomSetup(zone) {
    const { source, store, logger } = this.opts;
    return safe(logger, store, `room-setup-${zone}`, async () => {
      const s = await source.fetchRoomSetup(zone);
      const room = store.ensureRoomForZone(s.zone, s.name);
      store.patchRoom(room.id, {
        name: s.name,
        lock: s.flags.lock,
        autoStart: s.flags.auto,
        windowDetection: s.flags.swow
      });
    });
  }
  async pollAllRoomDetails() {
    await new Promise((r) => setTimeout(r, 300));
    for (const r of this.opts.store.listRooms()) {
      await this.pollRoomDetail(r.zone);
      await this.pollRoomSetup(r.zone);
    }
  }
  pollMessages() {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "messages", async () => {
      const list = await source.fetchMessages();
      store.setMessages(list);
    });
  }
  pollIO() {
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
  pollCalibration() {
    const { source, store, logger } = this.opts;
    return safe(logger, store, "calibration", async () => {
      const snap = await source.fetchCalibration();
      for (const c of snap.rooms) {
        const room = store.getRoomByZone(c.zone);
        if (!room) continue;
        store.patchRoom(room.id, {
          calibrationTemp: c.tempOffset,
          calibrationHumidity: c.humidityOffset
        });
      }
    });
  }
};
var clampFan = (n) => {
  const c = Math.max(0, Math.min(4, Math.round(n)));
  return c;
};

// src/core/store.ts
import { EventEmitter } from "events";

// ../../packages/types/src/mocks.ts
var NOW = Date.now();
var ago = (sec) => new Date(NOW - sec * 1e3).toISOString();
var seedRooms = [
  {
    id: "r-arianna",
    zone: 0,
    name: "Arianna",
    temperature: 22.5,
    humidity: 47,
    setpointHeating: 20,
    setpointCooling: 24,
    setpointNormal: 20,
    setpointReduced: 18.5,
    setpointStandby: 23,
    mode: "standby",
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
    lock: false,
    autoStart: true,
    windowDetection: true,
    floor: "Piano 1",
    meta: { lastUpdatedAt: ago(4) }
  },
  {
    id: "r-manu",
    zone: 1,
    name: "Manu",
    temperature: 23.8,
    humidity: 47,
    setpointHeating: 20,
    setpointCooling: 24,
    setpointNormal: 20,
    setpointReduced: 18.5,
    setpointStandby: 23,
    mode: "standby",
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
    lock: false,
    autoStart: true,
    windowDetection: true,
    floor: "Piano 1",
    meta: { lastUpdatedAt: ago(6) }
  },
  {
    id: "r-cucina",
    zone: 2,
    name: "Cucina",
    temperature: 24.7,
    humidity: 47,
    setpointHeating: 20,
    setpointCooling: 24,
    setpointNormal: 20,
    setpointReduced: 18.5,
    setpointStandby: 23,
    mode: "standby",
    programOverride: false,
    hasFan: false,
    hasFlap: false,
    hasLight: false,
    fan: 0,
    flap: 0,
    light: false,
    fanRunning: false,
    calibrationTemp: -0.2,
    calibrationHumidity: 0,
    programDailyId: 1,
    programWeeklyId: 1,
    lock: false,
    autoStart: true,
    windowDetection: true,
    floor: "Piano Terra",
    meta: { lastUpdatedAt: ago(2) }
  },
  {
    id: "r-salone",
    zone: 3,
    name: "Salone",
    temperature: 21.7,
    humidity: 47,
    setpointHeating: 20,
    setpointCooling: 24,
    setpointNormal: 20,
    setpointReduced: 18.5,
    setpointStandby: 23,
    mode: "program",
    programOverride: false,
    hasFan: false,
    hasFlap: false,
    hasLight: false,
    fan: 0,
    flap: 0,
    light: false,
    fanRunning: false,
    calibrationTemp: 0.1,
    calibrationHumidity: -1,
    programDailyId: 1,
    programWeeklyId: 1,
    lock: false,
    autoStart: true,
    windowDetection: true,
    floor: "Piano Terra",
    meta: { lastUpdatedAt: ago(12) }
  }
];
var seedSystem = {
  installationName: "Casa",
  operatingMode: "manual_heating",
  energyLevel: "standby",
  outdoorTemp: 19,
  outdoorOffset: 0,
  seasonStart: "10-15",
  seasonEnd: "04-30",
  reachable: true,
  fw: {
    master: "6.15",
    web: "0.25",
    umodules: { umodule0: "1.2" }
  },
  uniqueCode: "aabbccdd00112233445566778899aabbccddeeff00112233",
  ssid: "manu-iot",
  meta: { lastUpdatedAt: ago(3) }
};
var seedAlarms = [
  {
    id: "a-1",
    severity: "warning",
    source: "MC 1",
    code: "2/02/06/06/01/051/3",
    title: "Curva mista oltre soglia",
    detail: "Temperatura mandata superiore al setpoint per >5 min.",
    startedAt: ago(60 * 18),
    resolvedAt: null
  },
  {
    id: "a-2",
    severity: "info",
    source: "Base",
    code: "1/00/01/00/00/002/1",
    title: "Riavvio pianificato",
    detail: "Aggiornamento FW Master 6.14 \u2192 6.15.",
    startedAt: ago(60 * 60 * 6),
    resolvedAt: ago(60 * 60 * 6 - 120)
  },
  {
    id: "a-3",
    severity: "error",
    source: "Salone",
    code: "3/04/02/01/00/103/2",
    title: "Sensore umidit\xE0 fuori range",
    detail: "Lettura 110 % \u2013 calibrazione richiesta.",
    startedAt: ago(60 * 60 * 26),
    resolvedAt: ago(60 * 60 * 25)
  },
  {
    id: "a-4",
    severity: "warning",
    source: "U-Modul 1",
    code: "2/01/03/02/00/021/1",
    title: "Comunicazione intermittente",
    detail: "3 pacchetti persi su MC1 in 1 min.",
    startedAt: ago(60 * 60 * 48),
    resolvedAt: ago(60 * 60 * 47)
  },
  {
    id: "a-5",
    severity: "info",
    source: "System",
    code: "1/00/02/00/00/004/1",
    title: "Cambio stagione",
    detail: "Passaggio automatico estate \u2192 inverno.",
    startedAt: ago(60 * 60 * 24 * 7),
    resolvedAt: ago(60 * 60 * 24 * 7 - 60)
  },
  {
    id: "a-6",
    severity: "warning",
    source: "Cucina",
    code: "2/02/06/06/01/044/2",
    title: "Setpoint non raggiunto",
    detail: "\u0394 > 2 \xB0C dopo 120 min di richiesta.",
    startedAt: ago(60 * 60 * 24 * 9),
    resolvedAt: ago(60 * 60 * 24 * 9 - 800)
  },
  {
    id: "a-7",
    severity: "critical",
    source: "Base",
    code: "4/00/00/01/00/200/3",
    title: "Caldaia non risponde",
    detail: "Nessun ack su richiesta calore.",
    startedAt: ago(60 * 60 * 24 * 14),
    resolvedAt: ago(60 * 60 * 24 * 14 - 1800)
  },
  {
    id: "a-8",
    severity: "info",
    source: "System",
    code: "1/00/01/00/00/001/1",
    title: "Avvio sistema",
    detail: "Boot completato in 38 s.",
    startedAt: ago(60 * 60 * 24 * 30),
    resolvedAt: ago(60 * 60 * 24 * 30 - 40)
  }
];
var buildDaily = (pattern) => {
  const bits = new Array(96).fill(0);
  for (let i = 0; i < pattern.length; i += 2) {
    const start = pattern[i];
    const end = pattern[i + 1];
    for (let q = start; q < end; q++) bits[q] = 1;
  }
  return bits;
};
var seedDailyPrograms = [
  { id: 1, name: "", bits: buildDaily([24, 36, 68, 92]) },
  { id: 2, name: "", bits: buildDaily([32, 96]) },
  { id: 3, name: "", bits: buildDaily([24, 92]) },
  { id: 4, name: "", bits: buildDaily([0, 96]) },
  { id: 5, name: "", bits: buildDaily([0, 28, 84, 96]) },
  { id: 6, name: "", bits: buildDaily([20, 44]) },
  { id: 7, name: "", bits: buildDaily([48, 76]) },
  { id: 8, name: "", bits: buildDaily([72, 92]) },
  { id: 9, name: "", bits: buildDaily([28, 40, 64, 88]) },
  { id: 10, name: "", bits: buildDaily([24, 32, 56, 92]) }
];
var seedWeeklyPrograms = [
  { id: 1, name: "", days: [1, 1, 1, 1, 1, 2, 2] },
  { id: 2, name: "", days: [3, 3, 3, 3, 3, 2, 2] },
  { id: 3, name: "", days: [4, 4, 4, 4, 4, 4, 4] },
  { id: 4, name: "", days: [5, 5, 5, 5, 5, 5, 5] },
  { id: 5, name: "", days: [1, 9, 1, 9, 1, 2, 2] }
];

// src/core/store.ts
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var FAIL_STREAK_FOR_DEGRADED = 3;
var QUIET_MS_FOR_DEGRADED = 6e4;
var QUIET_MS_FOR_OFFLINE = 3e5;
var FETCH_BUFFER_SIZE = 15;
var Store = class {
  rooms = /* @__PURE__ */ new Map();
  system;
  messages;
  daily = /* @__PURE__ */ new Map();
  weekly = /* @__PURE__ */ new Map();
  io = null;
  reachable = true;
  lastReadAt = nowIso();
  connection = {
    // Start as "online" — we haven't seen a failure yet. The first
    // successful poll will reinforce that; the first failure starts a streak.
    state: "online",
    lastSuccessAt: null,
    lastAttemptAt: null,
    consecutiveFailures: 0,
    reason: null
  };
  fetches = [];
  events = new EventEmitter();
  /**
   * @param opts.seed When `true`, populate every collection from the mock
   *   fixtures so the bridge has plausible answers from boot — useful in
   *   `DEVICE_MODE=mock` and tests. When `false` (default), boot empty:
   *   rooms get created on demand by the LiveSource through
   *   `ensureRoomForZone`, with EVERY device-sourced field starting as
   *   `null`. This is the no-defaults rule the SPA depends on.
   */
  constructor(opts = {}) {
    if (opts.seed) {
      for (const r of seedRooms) this.rooms.set(r.id, { ...r });
      for (const d of seedDailyPrograms) this.daily.set(d.id, { ...d, bits: [...d.bits] });
      for (const w of seedWeeklyPrograms)
        this.weekly.set(w.id, { ...w, days: [...w.days] });
    }
    this.system = { ...seedSystem };
    this.messages = opts.seed ? seedAlarms.slice() : [];
  }
  // ─── reads ────────────────────────────────────────────────
  listRooms() {
    return [...this.rooms.values()];
  }
  getRoom(id) {
    return this.rooms.get(id);
  }
  getRoomByZone(zone) {
    for (const r of this.rooms.values()) if (r.zone === zone) return r;
    return void 0;
  }
  getSystem() {
    return this.system;
  }
  getMessages() {
    return this.messages;
  }
  getDeviceStatus() {
    return { online: this.reachable, lastReadAt: this.lastReadAt };
  }
  getConnection() {
    return { ...this.connection };
  }
  getDiagnostics() {
    const recent = this.fetches.slice().reverse();
    const successes = this.fetches.filter((f) => f.outcome === "ok");
    const failures = this.fetches.length - successes.length;
    const avgMsSuccess = successes.length > 0 ? Math.round(successes.reduce((a, f) => a + f.ms, 0) / successes.length) : null;
    let p95MsSuccess = null;
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
        p95MsSuccess
      }
    };
  }
  listDailyPrograms() {
    return [...this.daily.values()].sort((a, b) => a.id - b.id);
  }
  getDailyProgram(id) {
    return this.daily.get(id);
  }
  upsertDailyProgram(p) {
    this.daily.set(p.id, p);
    this.events.emit("daily.changed", p);
  }
  listWeeklyPrograms() {
    return [...this.weekly.values()].sort((a, b) => a.id - b.id);
  }
  getWeeklyProgram(id) {
    return this.weekly.get(id);
  }
  upsertWeeklyProgram(p) {
    this.weekly.set(p.id, p);
    this.events.emit("weekly.changed", p);
  }
  getIO() {
    return this.io;
  }
  setIO(io) {
    const next = JSON.stringify(io);
    const prev = this.io ? JSON.stringify(this.io) : null;
    if (next === prev) return;
    this.io = io;
    this.events.emit("io.changed", io);
  }
  // ─── writes ───────────────────────────────────────────────
  /** Merge a partial room update; emits only when something actually changed. */
  patchRoom(id, patch) {
    const cur = this.rooms.get(id);
    if (!cur) return void 0;
    const merged = { ...cur, ...patch, meta: { lastUpdatedAt: nowIso() } };
    if (!shallowChanged(cur, merged)) return cur;
    this.rooms.set(id, merged);
    this.events.emit("room.changed", merged, { ...patch });
    return merged;
  }
  patchSystem(patch) {
    const merged = { ...this.system, ...patch, meta: { lastUpdatedAt: nowIso() } };
    if (!shallowChanged(this.system, merged)) return this.system;
    this.system = merged;
    this.events.emit("system.changed", merged, { ...patch });
    return merged;
  }
  setMessages(next) {
    if (JSON.stringify(next) === JSON.stringify(this.messages)) return;
    this.messages = next;
    this.events.emit("messages.changed", next);
  }
  setReachable(online) {
    this.lastReadAt = nowIso();
    if (this.reachable !== online) this.reachable = online;
    this.events.emit("device.status", { online, lastReadAt: this.lastReadAt });
  }
  /**
   * Record a single device fetch (success or failure). Maintains the recent-
   * fetch ring buffer and the connection state machine. Called from
   * `device/client.ts` via the `onTelemetry` callback.
   */
  recordFetch(entry) {
    this.fetches.push(entry);
    while (this.fetches.length > FETCH_BUFFER_SIZE) this.fetches.shift();
    const prev = this.connection;
    const next = { ...prev, lastAttemptAt: entry.at };
    if (entry.outcome === "ok") {
      next.lastSuccessAt = entry.at;
      next.consecutiveFailures = 0;
      next.state = "online";
      next.reason = null;
    } else {
      next.consecutiveFailures = prev.consecutiveFailures + 1;
      const quietMs = next.lastSuccessAt ? Date.now() - new Date(next.lastSuccessAt).getTime() : Number.POSITIVE_INFINITY;
      let computed = prev.state;
      if (quietMs >= QUIET_MS_FOR_OFFLINE) computed = "offline";
      else if (next.consecutiveFailures >= FAIL_STREAK_FOR_DEGRADED || quietMs >= QUIET_MS_FOR_DEGRADED) {
        computed = "degraded";
      }
      next.state = computed;
      next.reason = computed === "offline" ? `No successful fetch in ${Math.round(quietMs / 1e3)}s` : computed === "degraded" ? `${next.consecutiveFailures} consecutive failures (${entry.outcome}${entry.error ? `: ${entry.error}` : ""})` : null;
    }
    this.connection = next;
    if (prev.state !== next.state || prev.consecutiveFailures !== next.consecutiveFailures || prev.reason !== next.reason) {
      this.events.emit("connection.changed", { ...next });
    }
  }
  /** Best-effort lookup by name for new rooms that the live device returned. */
  ensureRoomForZone(zone, name) {
    const existing = this.getRoomByZone(zone);
    if (existing) return existing;
    const room = {
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
      mode: "standby",
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
      floor: "",
      lock: false,
      autoStart: true,
      windowDetection: true,
      meta: { lastUpdatedAt: nowIso() }
    };
    this.rooms.set(room.id, room);
    return room;
  }
};
var shallowChanged = (a, b) => {
  for (const k of Object.keys(b)) {
    if (k === "meta") continue;
    if (a[k] !== b[k]) return true;
  }
  return false;
};

// src/device/client.ts
import { Pool } from "undici";
var DeviceClient = class {
  constructor(opts) {
    this.opts = opts;
    this.pool = new Pool(opts.baseUrl, {
      connections: 1,
      pipelining: 0,
      keepAliveTimeout: 1,
      keepAliveMaxTimeout: 1,
      keepAliveTimeoutThreshold: 0
    });
    this.minGapMs = opts.minGapMs ?? 150;
  }
  opts;
  pool;
  minGapMs;
  chain = Promise.resolve();
  lastRequestEndedAt = 0;
  async close() {
    await this.pool.close();
  }
  /**
   * Serialised, single-flight wrapper with a cool-down between calls. Wraps
   * `fn` so that no two requests overlap *and* the previous request's end is
   * at least `minGapMs` in the past before the next starts.
   */
  enqueue(fn) {
    const next = this.chain.then(async () => {
      const sinceLast = Date.now() - this.lastRequestEndedAt;
      const wait = this.minGapMs - sinceLast;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        this.lastRequestEndedAt = Date.now();
      }
    });
    this.chain = next.catch(() => void 0);
    return next;
  }
  async get(path) {
    return this.enqueue(() => this.request("GET", path));
  }
  async postForm(path, body) {
    const form = new URLSearchParams(body).toString();
    return this.enqueue(() => this.request("POST", path, form));
  }
  /** Empty-key POST used by the device for "open detail for zone N". */
  async postKey(path, key) {
    return this.enqueue(() => this.request("POST", path, `${encodeURIComponent(key)}=`));
  }
  async request(method, path, body) {
    const { logger, timeoutMs, onTelemetry } = this.opts;
    const t0 = Date.now();
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    const reqBytes = body?.length ?? 0;
    const headers = { connection: "close" };
    if (body) headers["content-type"] = "application/x-www-form-urlencoded";
    const classify = (err) => {
      const code = err.code;
      if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
        return { outcome: "timeout" };
      }
      const m = /→\s+(\d{3})$/.exec(err.message ?? "");
      if (m) return { outcome: "http", status: Number(m[1]) };
      return { outcome: "tcp" };
    };
    const emit = (ms, outcome, status, error) => {
      if (!onTelemetry) return;
      try {
        onTelemetry({
          at: startedAt,
          what: `${method} ${path}`,
          ms,
          outcome,
          ...status !== void 0 ? { status } : {},
          ...error ? { error: error.slice(0, 200) } : {}
        });
      } catch {
      }
    };
    const once = async () => {
      const res = await this.pool.request({
        method,
        path,
        headers,
        ...body ? { body } : {},
        bodyTimeout: timeoutMs,
        headersTimeout: timeoutMs
      });
      const text = await res.body.text();
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`device ${method} ${path} \u2192 ${res.statusCode}`);
      }
      return text;
    };
    try {
      const text = await once();
      const ms = Date.now() - t0;
      logger.info(
        { method, path, ms, reqBytes, resBytes: text.length },
        `device ${method} ${path} \u2192 200 in ${ms}ms`
      );
      emit(ms, "ok");
      return text;
    } catch (err) {
      const code = err.code;
      const retryable = code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_CONNECT_TIMEOUT";
      if (retryable) {
        const firstMs = Date.now() - t0;
        logger.warn(
          { method, path, ms: firstMs, code },
          `device ${method} ${path} timed out after ${firstMs}ms \u2014 retrying once`
        );
        await new Promise((r) => setTimeout(r, 400));
        try {
          const text = await once();
          const ms2 = Date.now() - t0;
          logger.info(
            { method, path, ms: ms2, reqBytes, resBytes: text.length, retried: true },
            `device ${method} ${path} \u2192 200 in ${ms2}ms (after retry)`
          );
          emit(ms2, "ok");
          return text;
        } catch (retryErr) {
          const ms2 = Date.now() - t0;
          logger.warn(
            { err: retryErr, method, path, ms: ms2, reqBytes },
            `device ${method} ${path} FAILED after ${ms2}ms (incl. retry)`
          );
          const cls2 = classify(retryErr);
          emit(ms2, cls2.outcome, cls2.status, retryErr.message);
          throw retryErr;
        }
      }
      const ms = Date.now() - t0;
      logger.warn(
        { err, method, path, ms, reqBytes },
        `device ${method} ${path} FAILED after ${ms}ms`
      );
      const cls = classify(err);
      emit(ms, cls.outcome, cls.status, err.message);
      throw err;
    }
  }
};

// src/device/installer.ts
var InstallerSession = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  busy = false;
  waiters = [];
  /** Acquire mutex → login → fn() → logout → release. */
  async run(fn) {
    await this.acquire();
    try {
      await this.login();
      try {
        return await fn();
      } finally {
        await this.logout().catch((err) => {
          this.opts.logger.warn({ err }, "installer logout failed");
        });
      }
    } finally {
      this.release();
    }
  }
  acquire() {
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve();
    }
    return new Promise((resolve3) => this.waiters.push(resolve3));
  }
  release() {
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.busy = false;
    }
  }
  async login() {
    this.opts.logger.debug("installer login");
    await this.opts.http.postForm("/menu.html", { instPart: this.opts.code });
  }
  async logout() {
    this.opts.logger.debug("installer logout");
    await this.opts.http.get("/user-menu.html");
  }
};

// src/device/codecs.ts
var quantizeSetpoint = (c) => Math.round(c * 2) / 2;
var setpointToDeviceForm = (c, mode) => {
  if (mode === "standby") return { RSH: "a", temp: "0" };
  const q = quantizeSetpoint(c);
  const tempIntF10 = Math.round((q * 9 / 5 + 32) * 10);
  return { RSH: q.toFixed(1), temp: String(tempIntF10) };
};
var deviceStateToRoomMode = (s) => {
  switch (s) {
    case 0:
      return "normal";
    case 1:
      return "reduced";
    case 2:
      return "standby";
    case 3:
    // program-day
    case 4:
      return "program";
    case 5:
      return "program_override";
    case 6:
    case 7:
      return "program_override";
    default:
      return "standby";
  }
};
var roomModeToDeviceMode = (m) => {
  switch (m) {
    case "normal":
      return "normal";
    case "reduced":
      return "reduced";
    case "standby":
      return "standby";
    case "program":
      return "program";
    case "program_override":
      return "programO";
  }
};
var operatingModeFromDevice = (n) => {
  switch (n) {
    case 1:
      return "heating_only";
    case 2:
      return "cooling_only";
    case 5:
      return "manual_heating";
    case 6:
      return "manual_cooling";
    default:
      return "manual_heating";
  }
};
var operatingModeToDevice = (m) => {
  switch (m) {
    case "heating_only":
      return 1;
    case "cooling_only":
      return 2;
    case "manual_heating":
      return 5;
    case "manual_cooling":
      return 6;
  }
};
var energyLevelFromDevice = (n) => {
  switch (n) {
    case 0:
      return "normal";
    case 1:
      return "reduced";
    case 2:
      return "standby";
    case 3:
      return "auto";
    case 4:
      return "vacation";
    default:
      return "standby";
  }
};
var energyLevelToDevice = (l) => {
  switch (l) {
    case "normal":
      return 0;
    case "reduced":
      return 1;
    case "standby":
      return 2;
    case "auto":
      return 3;
    case "vacation":
      return 4;
  }
};
var pad2 = (n) => n.toString().padStart(2, "0");
var quarterToHHMM = (q) => {
  if (q === 96) return "24:00";
  const h = Math.floor(q / 4);
  const m = q % 4 * 15;
  return `${pad2(h)}:${pad2(m)}`;
};
var hhmmToQuarter = (s) => {
  const m = /^([01]?\d|2[0-4]):([0-5]\d)$/.exec(s);
  if (!m) throw new Error(`bad time: ${s}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min % 15 !== 0) throw new Error(`time must be on a 15-min boundary: ${s}`);
  return h * 4 + min / 15;
};
var bitsToIntervals = (bits) => {
  if (bits.length !== 96) throw new Error(`bits must be length 96, got ${bits.length}`);
  const out = [];
  let runStart = null;
  for (let i = 0; i < 96; i++) {
    if (bits[i] === 1 && runStart === null) runStart = i;
    if (bits[i] === 0 && runStart !== null) {
      out.push({ start: quarterToHHMM(runStart), end: quarterToHHMM(i) });
      runStart = null;
    }
  }
  if (runStart !== null) out.push({ start: quarterToHHMM(runStart), end: quarterToHHMM(96) });
  return out;
};
var intervalsToBits = (intervals) => {
  const bits = new Array(96).fill(0);
  for (const { start, end } of intervals) {
    const a = hhmmToQuarter(start);
    const b = hhmmToQuarter(end);
    if (b <= a) throw new Error(`interval end must be after start: ${start}..${end}`);
    for (let i = a; i < b; i++) bits[i] = 1;
  }
  return bits;
};

// src/device/parsers.ts
import * as cheerio from "cheerio";
var parseRoomSetup = (html) => {
  const $ = cheerio.load(html);
  const zone = Number($('input[name="zone"]').attr("value") ?? "0");
  const name = $("#RoomName").attr("value")?.trim() ?? "";
  const numVal = (id) => Number($(`#${id}`).attr("value") ?? "0");
  const checked = (id) => $(`input[name="${id}"]`).attr("checked") !== void 0;
  const dayProg = (i) => {
    const sel = $(`select[name="PDay0${i}"] option[selected]`).first().attr("value");
    return (sel !== void 0 ? Number(sel) : 0) + 1;
  };
  return {
    zone,
    name,
    setpoints: {
      normalH: numVal("HNorm"),
      reducedH: numVal("HRed"),
      standby: numVal("HStand"),
      normalC: numVal("CNorm"),
      reducedC: numVal("CRed"),
      maxH: numVal("SPMax"),
      minC: numVal("SPMin")
    },
    flags: {
      auto: checked("Auto"),
      swow: checked("SWOW"),
      lock: checked("Lock")
    },
    weekly: Number($('select[name="PWeek"] option[selected]').first().attr("value") ?? "0"),
    daysProgram: [0, 1, 2, 3, 4, 5, 6].map((i) => dayProg(i))
  };
};
var num = (s) => {
  if (!s) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(s);
  return m ? Number(m[0]) : null;
};
var jsVar = (script, name) => {
  const re = new RegExp(`var\\s+${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`);
  const m = re.exec(script);
  return m ? Number(m[1]) : null;
};
var collectScripts = ($) => $("script").map((_, el) => $(el).html() ?? "").get().join("\n");
var parseDashboard = (html) => {
  const $ = cheerio.load(html);
  const opSelected = $("#opMode option[selected]").attr("value") ?? $("#opMode option").first().attr("value") ?? "5";
  const elSelected = $("#energyL option[selected]").attr("value") ?? $("#energyL option").first().attr("value") ?? "2";
  const outdoorText = $("h3.textCenter").first().text();
  const outdoorMatch = /(-?\d+(?:\.\d+)?)/.exec(outdoorText);
  const outdoor = outdoorMatch ? Number(outdoorMatch[1]) : 0;
  const clock = $("h2.textCenter").first().text().trim();
  return {
    outdoorTemp: outdoor,
    clock,
    operatingMode: operatingModeFromDevice(Number(opSelected)),
    energyLevel: energyLevelFromDevice(Number(elSelected))
  };
};
var parseRoomList = (html) => {
  const $ = cheerio.load(html);
  const out = [];
  $('form[action="room-operating.html"] button[name]').each((_, el) => {
    const zone = Number($(el).attr("name"));
    const name = $(el).find(".labelLeft").text().trim();
    const temp = num($(el).find(".labelRight").text()) ?? 0;
    if (Number.isFinite(zone)) out.push({ zone, name, temperature: temp });
  });
  return out;
};
var parseRoomDetail = (html) => {
  const $ = cheerio.load(html);
  const zone = Number($('input[name="zone"]').attr("value") ?? "0");
  const name = $("#RoomName").attr("value")?.trim() ?? "";
  const temperature = num($("label.labelRight.roomName").text()) ?? 0;
  const humidity = num($(".spanHum label.labelRight").text()) ?? 0;
  const setpoint = num($("#RSH").attr("value")) ?? 0;
  const scripts = collectScripts($);
  const normalSetPoint = jsVar(scripts, "normalSetPoint") ?? setpoint;
  const reducedSetPoint = jsVar(scripts, "reducedSetPoint") ?? setpoint;
  const standbySetPoint = jsVar(scripts, "standbySetPoint") ?? setpoint;
  const programActual = jsVar(scripts, "programActual") ?? 0;
  const initialState = jsVar(scripts, "initialState") ?? 2;
  const initialFan = jsVar(scripts, "initialFan") ?? 0;
  const initialFla = jsVar(scripts, "initialFla") ?? 0;
  const lightHiddenEl = $('input[name="lightH"]');
  const lightHidden = lightHiddenEl.attr("value");
  const hasLight = lightHiddenEl.length > 0;
  const hasFan = $("#FFF").length > 0;
  const hasFlap = hasFan;
  const fanRunning = scripts.includes('FFF").style.fill="#DD0060"');
  return {
    zone,
    name,
    temperature,
    humidity,
    setpoint,
    setpointHeatingNormal: normalSetPoint,
    setpointHeatingReduced: reducedSetPoint,
    setpointStandby: standbySetPoint,
    mode: deviceStateToRoomMode(initialState),
    programActive: programActual,
    fan: initialFan,
    flap: initialFla,
    light: lightHidden === "1",
    hasLight,
    hasFan,
    hasFlap,
    fanRunning
  };
};
var severityFromChar = (c) => {
  switch (c.trim().toUpperCase()) {
    case "I":
      return "info";
    case "W":
      return "warning";
    case "E":
      return "error";
    case "C":
      return "critical";
    default:
      return "info";
  }
};
var parseRehauTimestamp = (s) => {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return (/* @__PURE__ */ new Date()).toISOString();
  const [, y, mo, d, h, mi] = m;
  const iso = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi)
  ).toISOString();
  return iso;
};
var parseMessages = (html) => {
  const $ = cheerio.load(html);
  const out = [];
  $('form[action="user-menu.html"] table tr').each((_, tr) => {
    const cells = $(tr).find("td").map((_i, td) => $(td).text().trim()).get();
    if (cells.length < 6) return;
    const [idx, started, sev, source, ended, code] = cells;
    if (!started?.includes("/")) return;
    out.push({
      id: `m-${idx}`,
      severity: severityFromChar(sev ?? "I"),
      source: (source ?? "").replace(/:$/, "").trim(),
      code: (code ?? "").trim(),
      title: "",
      detail: "",
      startedAt: parseRehauTimestamp(started ?? ""),
      resolvedAt: ended && /\d{4}/.test(ended) ? parseRehauTimestamp(ended) : null
    });
  });
  return out;
};
var parseDailyProgram = (html) => {
  const $ = cheerio.load(html);
  const idZero = Number($('input[name="idProgDay"]').attr("value") ?? "0");
  const id = idZero + 1;
  const raw = $('input[name="prog"]').attr("value") ?? "";
  const bits = [];
  for (let i = 0; i < 96; i++) bits.push(raw[i] === "1" ? 1 : 0);
  return { id, bits };
};
var parseWeeklyProgram = (html) => {
  const $ = cheerio.load(html);
  const id = Number($('input[name="weeklyProgram"]').attr("value") ?? "1");
  const days = [];
  for (let i = 0; i < 7; i++) {
    const sel = $(`select[name="PDay${i}"] option[selected]`).first().attr("value");
    const v = sel !== void 0 ? Number(sel) : 0;
    days.push(v + 1);
  }
  return {
    id,
    days
  };
};
var parseCalibration = (html) => {
  const $ = cheerio.load(html);
  const outdoor = Number($('input[name="out00"]').attr("value") ?? "0");
  const rooms = [];
  for (let i = 0; i < 20; i++) {
    const idx = i.toString().padStart(2, "0");
    const air = $(`input[name="air${idx}"]`).attr("value");
    const hum = $(`input[name="humi${idx}"]`).attr("value");
    if (air === void 0 && hum === void 0) continue;
    rooms.push({
      zone: i,
      tempOffset: Number(air ?? "0"),
      humidityOffset: Number(hum ?? "0")
    });
  }
  return { outdoor, rooms };
};
var parseUptime = (html) => {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = /(\d+)\s+[^\d\s]+\s+(\d+)\s+[^\d\s]+\s+(\d+)\s+[^\d\s]+/.exec(text);
  return {
    years: m ? Number(m[1]) : 0,
    days: m ? Number(m[2]) : 0,
    hours: m ? Number(m[3]) : 0
  };
};
var parseTopology = (html) => {
  const $ = cheerio.load(html);
  const num2 = (name) => Number($(`input[name="${name}"]`).attr("value") ?? "0");
  return {
    baseModules: num2("ccDiag"),
    rModules: num2("emr"),
    uModules: num2("emu"),
    rooms: num2("room"),
    mixedCircuits: num2("mc"),
    dehumidifiers: num2("dehu")
  };
};
var parseHeatCurve = (html) => {
  const $ = cheerio.load(html);
  const num2 = (name) => Number($(`input[name="${name}"]`).attr("value") ?? "0");
  return {
    slopeNormal: num2("HC00"),
    slopeAbsent: num2("HD00"),
    startNormal: num2("HA00"),
    startAbsent: num2("HB00"),
    reductionK: num2("HR0"),
    minFlowNormalC: num2("HF00"),
    minFlowAbsentC: num2("HG00"),
    maxFlowNormalC: num2("HI00"),
    maxFlowAbsentC: num2("HK00")
  };
};
var parseIO = (html) => {
  const $ = cheerio.load(html);
  const master = { rz: [], relay: [], di: [] };
  const umodules = {};
  let target = null;
  let umoduleData = null;
  const parseList = (text) => {
    const after = text.split(":").slice(1).join(":");
    return after.trim().split(/\s+/).map((p) => Number(p.replace(/°C|%/g, ""))).filter((n) => Number.isFinite(n));
  };
  const parseAiC = (text) => {
    const after = text.split(":").slice(1).join(":");
    return after.trim().split(/\s+/).map((p) => p.startsWith("--") ? null : Number(p.replace(/°C/g, "")));
  };
  $("h3, label").each((_, el) => {
    const $el = $(el);
    if (el.type === "tag" && el.name === "h3") {
      const t2 = $el.text().trim();
      if (/master/i.test(t2)) {
        target = "master";
        umoduleData = null;
      } else {
        const m = /(\d+)\s*$/.exec(t2);
        if (m) {
          const key = `umodule${m[1]}`;
          umoduleData = { relay: [], di: [], aiC: [], aoPct: 0 };
          umodules[key] = umoduleData;
          target = key;
        }
      }
      return;
    }
    const t = $el.text();
    if (/RZ\s*1\s*-\s*8/i.test(t) && target === "master") {
      master.rz = parseList(t);
    } else if (/RELAY\s*1\s*-\s*4/i.test(t)) {
      const nums = parseList(t);
      if (target === "master") master.relay = nums;
      else if (umoduleData) umoduleData.relay = nums;
    } else if (/DI\s*1\s*-\s*4/i.test(t)) {
      const nums = parseList(t);
      if (target === "master") master.di = nums;
      else if (umoduleData) umoduleData.di = nums;
    } else if (/AI\s*1\s*-\s*4/i.test(t) && umoduleData) {
      umoduleData.aiC = parseAiC(t);
    } else if (/^\s*AO\s*:/i.test(t) && umoduleData) {
      const m = /:\s*(\d+(?:\.\d+)?)/.exec(t);
      if (m) umoduleData.aoPct = Number(m[1]);
    }
  });
  return { master, umodules };
};
var parseSystemInfo = (html) => {
  const $ = cheerio.load(html);
  const text = $("body").text();
  const uniqueCode = (/Unique code\s*:\s*([0-9a-f]+)/i.exec(text)?.[1] ?? "").trim();
  const master = (/Master:\s*([\d.]+)/.exec(text)?.[1] ?? "").trim();
  const umodules = {};
  let web = "";
  $("label").each((_, el) => {
    const t = $(el).text().trim();
    if (!t || /master/i.test(t)) return;
    const um = /\b(\d+)\s*:\s*([\d.\s]+?)\s*$/.exec(t);
    if (um) {
      umodules[`umodule${um[1]}`] = (um[2] ?? "").replace(/\s+/g, "");
      return;
    }
    if (!web) {
      const v = /(\d+\.\d+(?:\.\d+)?)\s*$/.exec(t);
      if (v) web = v[1] ?? "";
    }
  });
  return {
    uniqueCode,
    fw: { master, web, umodules },
    seasonStart: $("#HCP2").attr("value") ?? "10-01",
    seasonEnd: $("#HCP3").attr("value") ?? "05-01",
    outdoorOffset: Number($("#HLS").attr("value") ?? "0")
  };
};

// src/device/settings.ts
import * as cheerio2 from "cheerio";
var CURVE = [
  { name: "HA00", label: "Punto di partenza normale", kind: "number", min: 10, max: 40, step: 1, unit: "\xB0C" },
  { name: "HB00", label: "Punto di partenza assenza", kind: "number", min: 10, max: 40, step: 1, unit: "\xB0C" },
  { name: "HC00", label: "Pendenza normale", kind: "number", min: 0, max: 5, step: 0.01 },
  { name: "HD00", label: "Pendenza assenza", kind: "number", min: 0, max: 5, step: 0.01 },
  { name: "HR0", label: "Riduzione mandata in modo ridotto", kind: "number", min: 0, max: 10, step: 1, unit: "K" },
  { name: "HF00", label: "Min mandata normale", kind: "number", min: 15, max: 50, step: 1, unit: "\xB0C" },
  { name: "HG00", label: "Min mandata assenza", kind: "number", min: 15, max: 50, step: 1, unit: "\xB0C" },
  { name: "HI00", label: "Max mandata normale", kind: "number", min: 20, max: 70, step: 1, unit: "\xB0C" },
  { name: "HK00", label: "Max mandata assenza", kind: "number", min: 20, max: 70, step: 1, unit: "\xB0C" },
  { name: "HL00", label: "Filtro temp. esterna", kind: "number", min: 0, max: 99, step: 1 },
  { name: "CA0", label: "Min mandata raffrescamento", kind: "number", min: 8, max: 25, step: 0.1, unit: "\xB0C" },
  { name: "CB0", label: "Distanza dal punto di rugiada", kind: "number", min: -5, max: 10, step: 0.1, unit: "K" },
  { name: "CD0", label: "Limite ritorno raffrescamento", kind: "number", min: 10, max: 25, step: 0.1, unit: "\xB0C" },
  { name: "MIX10", label: "Banda proporzionale heating", kind: "number", min: 2, max: 80, step: 0.5, unit: "K" },
  { name: "MIX20", label: "Banda proporzionale cooling", kind: "number", min: 2, max: 80, step: 0.5, unit: "K" },
  { name: "MIX30", label: "Tempo integrale miscelatore", kind: "number", min: 0, max: 999, step: 1 },
  { name: "MIX60", label: "Ritardo avviamento PI", kind: "number", min: 0, max: 999, step: 1 }
];
var HEATCOOL = [
  { name: "Tout", label: "Filtro temp. esterna", kind: "number", min: 0, max: 99, step: 1 },
  { name: "HG1", label: "Limite riscaldamento normale", kind: "number", min: 5, max: 25, step: 0.1, unit: "\xB0C" },
  { name: "HG2", label: "Limite riscaldamento assenza", kind: "number", min: 5, max: 25, step: 0.1, unit: "\xB0C" },
  { name: "C01", label: "Ritardo avvio raffrescamento", kind: "number", min: 0, max: 1440, step: 10, unit: "min" },
  { name: "C02", label: "Tempo min raffrescamento", kind: "number", min: 0, max: 1440, step: 10, unit: "min" },
  { name: "C03", label: "Blocco riscaldamento dopo raffrescamento", kind: "number", min: 0, max: 96, step: 1, unit: "h" },
  { name: "C12", label: "Compensazione estiva", kind: "boolean" }
];
var DEVICES = [
  { name: "HE1", label: "Caldaia \xB7 tempo min funzionamento", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "HE4", label: "Caldaia \xB7 ritardo richiesta", kind: "number", min: 0, max: 10, step: 1, unit: "min" },
  { name: "HE5", label: "Caldaia \xB7 lockout prima del riavvio", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "CH1", label: "Chiller \xB7 tempo min funzionamento", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "CH4", label: "Chiller \xB7 ritardo richiesta", kind: "number", min: 0, max: 10, step: 1, unit: "min" },
  { name: "CH5", label: "Chiller \xB7 lockout prima del riavvio", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "PU6", label: "Antibloccaggio pompa \xB7 durata", kind: "number", min: 1, max: 30, step: 1, unit: "min" },
  { name: "VA2", label: "Antibloccaggio valvola \xB7 periodo", kind: "number", min: 1, max: 200, step: 1, unit: "giorni" },
  { name: "HE20", label: "Valvola misc. \xB7 posizione richiesta riscaldamento", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "HE30", label: "Valvola misc. \xB7 isteresi richiesta riscaldamento", kind: "number", min: 0, max: 25, step: 1, unit: "%" },
  { name: "CH20", label: "Valvola misc. \xB7 posizione richiesta raffrescamento", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "CH30", label: "Valvola misc. \xB7 isteresi richiesta raffrescamento", kind: "number", min: 0, max: 25, step: 1, unit: "%" },
  { name: "MI70", label: "Inverti segnale di controllo", kind: "boolean" },
  { name: "PU75", label: "Pompa misc. \xB7 ritardo avviamento", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "PU85", label: "Pompa misc. \xB7 post funzionamento", kind: "number", min: 0, max: 15, step: 1, unit: "min" }
];
var FUNCTIONS = [
  { name: "PU20", label: "Master \xB7 pompa alta efficienza", kind: "boolean" },
  { name: "PU25", label: "Circuito misc. \xB7 pompa alta efficienza", kind: "boolean" },
  { name: "PU3", label: "Antibloccaggio pompa abilitato", kind: "boolean" },
  { name: "PU4", label: "Antibloccaggio pompa \xB7 periodo", kind: "number", min: 1, max: 200, step: 1, unit: "giorni" },
  { name: "PU5", label: "Antibloccaggio pompa \xB7 orario", kind: "number", min: 0, max: 24, step: 1, unit: "h" },
  { name: "VA1", label: "Antibloccaggio valvola abilitato", kind: "boolean" },
  { name: "VA3", label: "Antibloccaggio valvola \xB7 orario", kind: "number", min: 0, max: 24, step: 1, unit: "h" },
  { name: "VA4", label: "Antibloccaggio valvola \xB7 durata", kind: "number", min: 1, max: 30, step: 1, unit: "min" }
];
var PID = [
  { name: "a0", label: "Banda proporzionale heating", kind: "number", min: 0, max: 10, step: 0.1, unit: "K" },
  { name: "b0", label: "Banda proporzionale cooling", kind: "number", min: 0, max: 10, step: 0.1, unit: "K" },
  { name: "c0", label: "Tempo impulso ambiente", kind: "number", min: 10, max: 120, step: 10, unit: "min" },
  { name: "d0", label: "Tempo impulso min ambiente", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "e0", label: "Tempo integrale ambiente", kind: "number", min: 0, max: 600, step: 5 },
  { name: "f0", label: "Limitazione parte integrale", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "g0", label: "Fattore di ottimizzazione", kind: "number", min: 0, max: 10, step: 1 },
  { name: "h0", label: "Limite durata impulso in continua", kind: "number", min: 50, max: 100, step: 1, unit: "%" },
  { name: "i0", label: "Spostamento banda proporzionale", kind: "number", min: -50, max: 50, step: 1, unit: "%" }
];
var FANCOIL = [
  { name: "FCMT", label: "Tempo minimo funzionamento", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "FCXT", label: "Tempo massimo funzionamento", kind: "number", min: 10, max: 241, step: 1, unit: "min" },
  { name: "FCPT", label: "Tempo minimo di pausa", kind: "number", min: 0, max: 20, step: 1, unit: "min" }
];
var GROUPS = {
  curve: { path: "/circSett.html", formKey: "MCSettings", fields: CURVE },
  heatcool: { path: "/hCSett.html", formKey: "heatcoolSett", fields: HEATCOOL },
  devices: { path: "/deviSett.html", formKey: "Devices", fields: DEVICES },
  functions: { path: "/funcSett.html", formKey: "Functions", fields: FUNCTIONS },
  pid: { path: "/advSett.html", formKey: "AdvSett", fields: PID },
  fancoil: { path: "/installer-fanc-settings.html", formKey: "Devices", fields: FANCOIL }
};
var settingsGroupDef = (group) => GROUPS[group];
var formatForDevice = (n, step) => {
  if (step >= 1) return Math.round(n).toString();
  if (step >= 0.1) return n.toFixed(1);
  if (step >= 0.01) return n.toFixed(2);
  return String(n);
};
var parseSettings = (group, html) => {
  const def = GROUPS[group];
  const $ = cheerio2.load(html);
  const fields = def.fields.map((f) => {
    if (f.kind === "boolean") {
      const checked = $(`input[name="${f.name}"]`).attr("checked");
      const out2 = { ...f, value: checked !== void 0 };
      return out2;
    }
    const raw = $(`input[name="${f.name}"]`).attr("value");
    const v = raw !== void 0 && raw !== "" ? Number(raw) : f.min ?? 0;
    const out = { ...f, value: Number.isFinite(v) ? v : f.min ?? 0 };
    return out;
  });
  return { group, fields };
};
var buildSettingsForm = (group, fields) => {
  const def = GROUPS[group];
  const form = { [def.formKey]: "" };
  for (const f of fields) {
    const defField = def.fields.find((d) => d.name === f.name);
    if (!defField) continue;
    if (defField.kind === "boolean") {
      if (f.value === true) form[f.name] = "on";
    } else {
      form[f.name] = formatForDevice(Number(f.value), defField.step ?? 1);
    }
  }
  return form;
};
var mergeSettings = (current, patch) => {
  const m = new Map(current.map((f) => [f.name, f]));
  for (const p of patch) {
    const cur = m.get(p.name);
    if (cur) m.set(p.name, { ...cur, value: p.value });
  }
  return [...m.values()];
};

// src/device/source.ts
var LiveDeviceSource = class {
  constructor(http, installer) {
    this.http = http;
    this.installer = installer;
    this.hasInstaller = installer !== void 0;
  }
  http;
  installer;
  kind = "live";
  hasInstaller;
  async close() {
    await this.http.close();
  }
  fetchDashboard = async () => parseDashboard(await this.http.get("/"));
  fetchRoomList = async () => parseRoomList(await this.http.get("/room-page.html"));
  fetchRoomDetail = async (zone) => parseRoomDetail(await this.http.postKey("/room-operating.html", String(zone)));
  fetchMessages = async () => parseMessages(await this.http.get("/messages.html"));
  // POST the messages-page form back. REHAU's table is wrapped in
  // `<form action="user-menu.html"><input name="MessagesHidden" ...>`
  // — submitting it (no extra fields needed) is the device's
  // "acknowledge all alarms" trigger. The body string mirrors what the
  // built-in Confirm button submits.
  clearMessages = async () => {
    await this.http.postForm("/user-menu.html", { MessagesHidden: "" });
  };
  fetchSystemInfo = async () => parseSystemInfo(await this.http.get("/user-config-installer.html"));
  async setRoomSetpoint(i) {
    const { RSH, temp } = setpointToDeviceForm(i.value, i.mode);
    await this.http.postForm("/room-page.html", {
      zone: String(i.zone),
      RoomName: i.name,
      RSH,
      temp,
      mode: roomModeToDeviceMode(i.mode),
      lightH: i.light ? "1" : "0"
    });
  }
  async setRoomMode(i) {
    const sp = i.setpoint ?? 20;
    const { RSH, temp } = setpointToDeviceForm(sp, i.mode);
    await this.http.postForm("/room-page.html", {
      zone: String(i.zone),
      RoomName: i.name,
      RSH,
      temp,
      mode: roomModeToDeviceMode(i.mode),
      lightH: i.light ? "1" : "0"
    });
  }
  async setRoomLight(i) {
    const { RSH, temp } = setpointToDeviceForm(i.setpoint, i.mode);
    await this.http.postForm("/room-page.html", {
      zone: String(i.zone),
      RoomName: i.name,
      RSH,
      temp,
      mode: roomModeToDeviceMode(i.mode),
      lightH: i.light ? "1" : "0"
    });
  }
  async fetchRoomSetup(zone) {
    return parseRoomSetup(await this.http.postKey("/room-set-up.html", String(zone)));
  }
  async setRoomSetup(zone, patch) {
    const cur = parseRoomSetup(await this.http.postKey("/room-set-up.html", String(zone)));
    const next = {
      ...cur,
      flags: {
        auto: patch.autoStart ?? cur.flags.auto,
        swow: patch.windowDetection ?? cur.flags.swow,
        lock: patch.lock ?? cur.flags.lock
      }
    };
    const toF10 = (c) => String(Math.round((c * 9 / 5 + 32) * 10));
    const form = {
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
      PWeek: String(next.weekly)
    };
    for (let i = 0; i < 7; i++) {
      const d = next.daysProgram[i] ?? 1;
      form[`PDay0${i}`] = String(Math.max(0, d - 1));
    }
    if (next.flags.auto) form.Auto = "on";
    if (next.flags.swow) form.SWOW = "on";
    if (next.flags.lock) form.Lock = "on";
    await this.http.postForm("/room-page.html", form);
    return next;
  }
  async setOperatingMode(mode) {
    await this.http.postForm("/user-menu.html", {
      operatingMode: "",
      opMode: String(operatingModeToDevice(mode))
    });
  }
  async setEnergyLevel(level) {
    await this.http.postForm("/user-menu.html", {
      energyLevel: "",
      energyL: String(energyLevelToDevice(level))
    });
  }
  fetchDailyProgram = async (id) => parseDailyProgram(await this.http.postKey("/user-update-daily-program.html", String(id)));
  fetchWeeklyProgram = async (id) => parseWeeklyProgram(await this.http.postKey("/user-update-weekly-program.html", String(id)));
  async setDailyProgram(id, bits) {
    if (bits.length !== 96) throw new Error(`bits must be length 96, got ${bits.length}`);
    const bitsStr = bits.map((b) => b ? "1" : "0").join("");
    await this.http.postForm("/user-daily-program.html", {
      pDaily: "",
      idProgDay: String(id - 1),
      prog: bitsStr
    });
  }
  async setWeeklyProgram(id, days) {
    const form = {
      pWeek: "",
      weeklyProgram: String(id)
    };
    for (let i = 0; i < 7; i++) {
      form[`PDay${i}`] = String((days[i] ?? 1) - 1);
    }
    await this.http.postForm("/user-weekly-program.html", form);
  }
  // ─── installer-tier ──────────────────────────────────────
  requireInstaller() {
    if (!this.installer) throw new Error("installer code not configured");
    return this.installer;
  }
  async fetchCalibration() {
    const s = this.requireInstaller();
    return s.run(async () => parseCalibration(await this.http.get("/installer-adjustementOffset.html")));
  }
  async setCalibration(patch) {
    const s = this.requireInstaller();
    return s.run(async () => {
      const current = parseCalibration(await this.http.get("/installer-adjustementOffset.html"));
      const outdoor = patch.outdoor ?? current.outdoor;
      const merged = /* @__PURE__ */ new Map();
      for (const r of current.rooms) merged.set(r.zone, r);
      for (const r of patch.rooms ?? []) merged.set(r.zone, r);
      const rooms = [...merged.values()].sort((a, b) => a.zone - b.zone);
      const form = {
        OffsetAdj: "",
        out00: outdoor.toFixed(1)
      };
      for (const r of rooms) {
        const idx = r.zone.toString().padStart(2, "0");
        form[`air${idx}`] = r.tempOffset.toFixed(1);
        form[`humi${idx}`] = String(Math.round(r.humidityOffset));
      }
      await this.http.postForm("/installer-diagnosis.html", form);
      return { outdoor, rooms };
    });
  }
  async fetchIO() {
    const s = this.requireInstaller();
    return s.run(async () => parseIO(await this.http.get("/installer-inputoutput.html")));
  }
  async fetchUptime() {
    const s = this.requireInstaller();
    return s.run(async () => {
      const html = await this.http.get("/installer-system-statistics.html");
      const out = parseUptime(html);
      if (out.years === 0 && out.days === 0 && out.hours === 0) {
        console.warn(
          "[uptime] parser returned 0 0 0 \u2014 sample of /installer-system-statistics.html:\n" + html.replace(/<script[\s\S]*?<\/script>/gi, "").slice(0, 1500)
        );
      }
      return out;
    });
  }
  async fetchTopology() {
    const s = this.requireInstaller();
    return s.run(async () => parseTopology(await this.http.get("/diagSett.html")));
  }
  async fetchHeatCurve() {
    const s = this.requireInstaller();
    return s.run(async () => parseHeatCurve(await this.http.get("/circSett.html")));
  }
  async fetchSettings(group) {
    const s = this.requireInstaller();
    const def = settingsGroupDef(group);
    return s.run(async () => parseSettings(group, await this.http.get(def.path)));
  }
  async setSettings(group, patch) {
    const s = this.requireInstaller();
    const def = settingsGroupDef(group);
    return s.run(async () => {
      const cur = parseSettings(group, await this.http.get(def.path));
      const merged = mergeSettings(cur.fields, patch);
      const form = buildSettingsForm(group, merged);
      await this.http.postForm("/installer-setting.html", form);
      return { group, fields: merged };
    });
  }
};
var MockDeviceSource = class {
  kind = "mock";
  hasInstaller = true;
  // Local mutable copy of the seeds so writes update reads.
  rooms = seedRooms.map((r) => ({ ...r }));
  system = { ...seedSystem };
  messages = seedAlarms.slice();
  async close() {
  }
  async fetchDashboard() {
    return {
      outdoorTemp: this.system.outdoorTemp,
      clock: (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " "),
      operatingMode: this.system.operatingMode,
      energyLevel: this.system.energyLevel
    };
  }
  async fetchRoomList() {
    return this.rooms.map((r) => ({ zone: r.zone, name: r.name, temperature: r.temperature ?? 0 }));
  }
  async fetchRoomDetail(zone) {
    const r = this.rooms.find((x) => x.zone === zone);
    if (!r) throw new Error(`unknown zone ${zone}`);
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
      fanRunning: r.fanRunning
    };
  }
  async fetchMessages() {
    return this.messages;
  }
  async clearMessages() {
    this.messages = [];
  }
  async fetchSystemInfo() {
    return {
      uniqueCode: this.system.uniqueCode,
      fw: this.system.fw,
      seasonStart: this.system.seasonStart,
      seasonEnd: this.system.seasonEnd,
      outdoorOffset: this.system.outdoorOffset
    };
  }
  async setRoomSetpoint(i) {
    const r = this.rooms.find((x) => x.zone === i.zone);
    if (r) r.setpointHeating = i.value;
  }
  async setRoomMode(i) {
    const r = this.rooms.find((x) => x.zone === i.zone);
    if (r) {
      r.mode = i.mode;
      if (i.setpoint != null) r.setpointHeating = i.setpoint;
      r.light = i.light;
    }
  }
  async setRoomLight(i) {
    const r = this.rooms.find((x) => x.zone === i.zone);
    if (r) r.light = i.light;
  }
  roomSetups = /* @__PURE__ */ new Map();
  seedSetup(zone, name) {
    return {
      zone,
      name,
      setpoints: { normalH: 20, reducedH: 18.5, standby: 23, normalC: 26, reducedC: 24.5, maxH: 31, minC: 15 },
      flags: { auto: true, swow: true, lock: false },
      weekly: 1,
      daysProgram: [1, 1, 1, 1, 1, 2, 2]
    };
  }
  async fetchRoomSetup(zone) {
    const r = this.rooms.find((x) => x.zone === zone);
    let s = this.roomSetups.get(zone);
    if (!s) {
      s = this.seedSetup(zone, r?.name ?? `Zone ${zone}`);
      this.roomSetups.set(zone, s);
    }
    return { ...s, flags: { ...s.flags } };
  }
  async setRoomSetup(zone, patch) {
    const cur = await this.fetchRoomSetup(zone);
    const next = {
      ...cur,
      flags: {
        auto: patch.autoStart ?? cur.flags.auto,
        swow: patch.windowDetection ?? cur.flags.swow,
        lock: patch.lock ?? cur.flags.lock
      }
    };
    this.roomSetups.set(zone, next);
    return next;
  }
  async setOperatingMode(mode) {
    this.system = { ...this.system, operatingMode: mode };
  }
  async setEnergyLevel(level) {
    this.system = { ...this.system, energyLevel: level };
  }
  daily = seedDailyPrograms.map((p) => ({ ...p, bits: [...p.bits] }));
  weekly = seedWeeklyPrograms.map((p) => ({ ...p, days: [...p.days] }));
  async fetchDailyProgram(id) {
    const p = this.daily.find((d) => d.id === id);
    if (!p) throw new Error(`unknown daily program ${id}`);
    return { id: p.id, bits: p.bits.slice() };
  }
  async fetchWeeklyProgram(id) {
    const p = this.weekly.find((w) => w.id === id);
    if (!p) throw new Error(`unknown weekly program ${id}`);
    return { id: p.id, days: [...p.days] };
  }
  async setDailyProgram(id, bits) {
    const p = this.daily.find((d) => d.id === id);
    if (p) p.bits = bits.slice();
  }
  async setWeeklyProgram(id, days) {
    const p = this.weekly.find((w) => w.id === id);
    if (p) p.days = [...days];
  }
  // ─── installer-tier (synthetic) ──────────────────────────
  // RoomCalibration expects concrete numbers (writes back to the device).
  // The seed Room may carry `null` for calibration after the no-defaults
  // sweep, so coerce to 0 here — mock-only.
  calibration = {
    outdoor: 0,
    rooms: seedRooms.map((r) => ({
      zone: r.zone,
      tempOffset: r.calibrationTemp ?? 0,
      humidityOffset: r.calibrationHumidity ?? 0
    }))
  };
  async fetchCalibration() {
    return { outdoor: this.calibration.outdoor, rooms: this.calibration.rooms.map((r) => ({ ...r })) };
  }
  async setCalibration(patch) {
    this.calibration = {
      outdoor: patch.outdoor ?? this.calibration.outdoor,
      rooms: this.calibration.rooms.map((r) => {
        const upd = patch.rooms?.find((x) => x.zone === r.zone);
        return upd ? { ...r, ...upd } : r;
      })
    };
    return { outdoor: this.calibration.outdoor, rooms: this.calibration.rooms.map((r) => ({ ...r })) };
  }
  async fetchIO() {
    return {
      master: {
        rz: [0, 0, 0, 0, 0, 0, 0, 0],
        relay: [0, 0, 0, 0],
        di: [0, 0, 0, 0]
      },
      umodules: {
        umodule0: {
          relay: [0, 0, 0, 0],
          di: [0, 0, 0, 0],
          aiC: [22.6, 22.6, null, null],
          aoPct: 0
        }
      }
    };
  }
  async fetchUptime() {
    return { years: 0, days: 0, hours: 2 };
  }
  async fetchTopology() {
    return { baseModules: 1, rModules: 0, uModules: 1, rooms: 4, mixedCircuits: 1, dehumidifiers: 0 };
  }
  async fetchHeatCurve() {
    return {
      slopeNormal: 0.6,
      slopeAbsent: 0.5,
      startNormal: 20,
      startAbsent: 17,
      reductionK: 4,
      minFlowNormalC: 25,
      minFlowAbsentC: 20,
      maxFlowNormalC: 45,
      maxFlowAbsentC: 35
    };
  }
  // Local copy of each group's fields, seeded from a stubbed parse on first
  // call. Lets the mock round-trip writes for dev.
  settingsState = /* @__PURE__ */ new Map();
  seedSettings(group) {
    const def = settingsGroupDef(group);
    return def.fields.map((f) => ({
      ...f,
      value: f.kind === "boolean" ? false : f.min ?? 0
    }));
  }
  async fetchSettings(group) {
    let fields = this.settingsState.get(group);
    if (!fields) {
      fields = this.seedSettings(group);
      this.settingsState.set(group, fields);
    }
    return { group, fields: fields.map((f) => ({ ...f })) };
  }
  async setSettings(group, patch) {
    const cur = this.settingsState.get(group) ?? this.seedSettings(group);
    const next = mergeSettings(cur, patch);
    this.settingsState.set(group, next);
    return { group, fields: next.map((f) => ({ ...f })) };
  }
};

// src/http/server.ts
import { existsSync } from "fs";
import { resolve } from "path";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler
} from "fastify-type-provider-zod";

// src/http/auth.ts
import bcrypt from "bcrypt";
import fastifyJwt from "@fastify/jwt";
import { z as z2 } from "zod";
var loginBodySchema = z2.object({
  username: z2.string().min(1),
  password: z2.string().min(1)
});
var loginResponseSchema = z2.object({
  token: z2.string(),
  expiresAt: z2.string(),
  role: z2.enum(["user", "installer"])
});
var meResponseSchema = z2.object({
  username: z2.string(),
  role: z2.enum(["user", "installer"])
});
var registerAuth = async (app, cfg) => {
  await app.register(fastifyJwt, {
    secret: cfg.JWT_SECRET,
    sign: { expiresIn: cfg.JWT_TTL }
  });
  app.decorateRequest("requireRole", function(role) {
    if (this.user.role !== role && !(role === "user" && this.user.role === "installer")) {
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    }
  });
  app.addHook("preValidation", async (req) => {
    if (!req.url.startsWith("/api/v1/")) return;
    if (req.url.startsWith("/api/v1/auth/login")) return;
    if (req.url.startsWith("/api/v1/auth/ingress")) return;
    if (req.url.startsWith("/api/v1/events")) {
      const url = new URL(req.url, "http://x");
      const tokenParam = url.searchParams.get("token");
      if (tokenParam) req.headers.authorization = `Bearer ${tokenParam}`;
    }
    try {
      await req.jwtVerify();
    } catch {
      throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
    }
  });
};
var registerAuthRoutes = (app, cfg) => {
  app.post("/api/v1/auth/login", {
    schema: {
      tags: ["auth"],
      body: loginBodySchema,
      response: {
        200: loginResponseSchema,
        401: z2.object({ error: z2.string() })
      }
    }
  }, async (req, reply) => {
    const { username, password } = loginBodySchema.parse(req.body);
    const userOk = username === cfg.API_USER;
    const passOk = userOk && await bcrypt.compare(password, cfg.API_PASSWORD_HASH).catch(() => false);
    if (!userOk || !passOk) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const role = cfg.ADMIN_ROLE;
    const token = app.jwt.sign({ sub: username, role });
    const decoded = app.jwt.decode(token);
    const expiresAt = new Date((decoded?.exp ?? 0) * 1e3).toISOString();
    return reply.code(200).send({ token, expiresAt, role });
  });
  app.post("/api/v1/auth/ingress", {
    schema: {
      tags: ["auth"],
      response: {
        200: loginResponseSchema,
        401: z2.object({ error: z2.string() })
      }
    }
  }, async (req, reply) => {
    const ingressPath = req.headers["x-ingress-path"];
    if (typeof ingressPath !== "string" || ingressPath.length === 0) {
      return reply.code(401).send({ error: "not_via_ingress" });
    }
    const username = typeof req.headers["x-hass-display-name"] === "string" && req.headers["x-hass-display-name"] || cfg.API_USER;
    const role = cfg.ADMIN_ROLE;
    const token = app.jwt.sign({ sub: username, role });
    const decoded = app.jwt.decode(token);
    const expiresAt = new Date((decoded?.exp ?? 0) * 1e3).toISOString();
    return reply.code(200).send({ token, expiresAt, role });
  });
  app.get("/api/v1/auth/me", {
    schema: {
      tags: ["auth"],
      response: { 200: meResponseSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    return { username: req.user.sub, role: req.user.role };
  });
};

// src/http/openapi.ts
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
var registerOpenApi = async (app) => {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "REHAU Nea Smart 2 \u2014 Bridge API",
        description: "REST + SSE access to a REHAU Nea Smart 2.0 base station.",
        version: "0.1.0"
      },
      servers: [{ url: "/" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
        }
      },
      security: [{ bearerAuth: [] }]
    },
    transform: jsonSchemaTransform
  });
  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true }
  });
};

// src/http/routes/installer.ts
import { z as z4 } from "zod";

// src/http/schemas.ts
import { z as z3 } from "zod";

// ../../packages/types/src/index.ts
var SETPOINT_HEAT_MIN = 5;
var SETPOINT_HEAT_MAX = 31;
var SETPOINT_STEP = 0.5;

// src/http/schemas.ts
var metaSchema = z3.object({ lastUpdatedAt: z3.string().describe("ISO timestamp") });
var roomModeSchema = z3.enum([
  "standby",
  "normal",
  "reduced",
  "program",
  "program_override"
]);
var systemModeSchema = z3.enum([
  "heating_only",
  "cooling_only",
  "manual_heating",
  "manual_cooling"
]);
var energyLevelSchema = z3.enum(["normal", "reduced", "standby", "auto", "vacation"]);
var fanLevelSchema = z3.number().int().min(0).max(4);
var roomSchema = z3.object({
  id: z3.string(),
  zone: z3.number().int(),
  name: z3.string(),
  // Nullable readings — `null` until the bridge has actually parsed each
  // value from the device. See packages/types Room comments + the no-defaults
  // rule. SPA must render null as a placeholder ("—" or hidden card),
  // never as 0/"" — that was the whole point of removing the seed defaults.
  temperature: z3.number().nullable(),
  humidity: z3.number().nullable(),
  setpointHeating: z3.number().nullable(),
  setpointCooling: z3.number().nullable(),
  setpointNormal: z3.number().nullable(),
  setpointReduced: z3.number().nullable(),
  setpointStandby: z3.number().nullable(),
  mode: roomModeSchema,
  programOverride: z3.boolean(),
  hasFan: z3.boolean(),
  hasFlap: z3.boolean(),
  hasLight: z3.boolean(),
  fan: fanLevelSchema,
  flap: z3.number().int().min(0).max(1),
  light: z3.boolean(),
  fanRunning: z3.boolean(),
  calibrationTemp: z3.number().nullable(),
  calibrationHumidity: z3.number().nullable(),
  programDailyId: z3.number().int(),
  programWeeklyId: z3.number().int(),
  floor: z3.string(),
  lock: z3.boolean(),
  autoStart: z3.boolean(),
  windowDetection: z3.boolean(),
  meta: metaSchema
});
var setpointBodySchema = z3.object({
  value: z3.number().min(SETPOINT_HEAT_MIN).max(SETPOINT_HEAT_MAX).multipleOf(SETPOINT_STEP)
});
var roomModeBodySchema = z3.object({
  mode: roomModeSchema,
  setpoint: z3.number().min(SETPOINT_HEAT_MIN).max(SETPOINT_HEAT_MAX).optional()
});
var roomPatchSchema = z3.object({
  setpoint: z3.number().min(SETPOINT_HEAT_MIN).max(SETPOINT_HEAT_MAX).optional(),
  mode: roomModeSchema.optional(),
  light: z3.boolean().optional(),
  lock: z3.boolean().optional(),
  autoStart: z3.boolean().optional(),
  windowDetection: z3.boolean().optional()
});
var lightBodySchema = z3.object({
  light: z3.boolean()
});
var roomFlagsBodySchema = z3.object({
  lock: z3.boolean().optional(),
  autoStart: z3.boolean().optional(),
  windowDetection: z3.boolean().optional()
});
var systemStateSchema = z3.object({
  installationName: z3.string(),
  operatingMode: systemModeSchema,
  energyLevel: energyLevelSchema,
  outdoorTemp: z3.number(),
  outdoorOffset: z3.number(),
  seasonStart: z3.string(),
  seasonEnd: z3.string(),
  reachable: z3.boolean(),
  fw: z3.object({
    master: z3.string(),
    web: z3.string(),
    umodules: z3.record(z3.string())
  }),
  uniqueCode: z3.string(),
  ssid: z3.string(),
  meta: metaSchema
});
var operatingModeBodySchema = z3.object({ mode: systemModeSchema });
var energyLevelBodySchema = z3.object({ level: energyLevelSchema });
var alarmSeveritySchema = z3.enum(["info", "warning", "error", "critical"]);
var messageSchema = z3.object({
  id: z3.string(),
  severity: alarmSeveritySchema,
  source: z3.string(),
  code: z3.string(),
  title: z3.string(),
  detail: z3.string(),
  startedAt: z3.string(),
  resolvedAt: z3.string().nullable()
});
var dailyProgramSchema = z3.object({
  id: z3.number().int().min(1).max(10),
  name: z3.string(),
  bits: z3.array(z3.number().int().min(0).max(1)).length(96)
});
var dailyProgramWriteSchema = z3.union([
  z3.object({ bits: z3.array(z3.number().int().min(0).max(1)).length(96) }),
  z3.object({
    intervals: z3.array(
      z3.object({
        start: z3.string().regex(/^([01]?\d|2[0-4]):[0-5]\d$/),
        end: z3.string().regex(/^([01]?\d|2[0-4]):[0-5]\d$/)
      })
    )
  })
]);
var weeklyProgramSchema = z3.object({
  id: z3.number().int().min(1).max(5),
  name: z3.string(),
  days: z3.tuple([
    z3.number().int().min(1).max(10),
    z3.number().int().min(1).max(10),
    z3.number().int().min(1).max(10),
    z3.number().int().min(1).max(10),
    z3.number().int().min(1).max(10),
    z3.number().int().min(1).max(10),
    z3.number().int().min(1).max(10)
  ])
});
var weeklyProgramWriteSchema = z3.object({
  monday: z3.number().int().min(1).max(10),
  tuesday: z3.number().int().min(1).max(10),
  wednesday: z3.number().int().min(1).max(10),
  thursday: z3.number().int().min(1).max(10),
  friday: z3.number().int().min(1).max(10),
  saturday: z3.number().int().min(1).max(10),
  sunday: z3.number().int().min(1).max(10)
});
var errorSchema = z3.object({ error: z3.string(), message: z3.string().optional() });
var roomCalibrationSchema = z3.object({
  zone: z3.number().int().min(0).max(63),
  tempOffset: z3.number().min(-5).max(5),
  humidityOffset: z3.number().int().min(-25).max(25)
});
var calibrationStateSchema = z3.object({
  outdoor: z3.number(),
  rooms: z3.array(roomCalibrationSchema),
  meta: metaSchema
});
var calibrationWriteSchema = z3.object({
  outdoor: z3.number().min(-10).max(10).optional(),
  rooms: z3.array(roomCalibrationSchema).optional()
});
var ioSchema = z3.object({
  master: z3.object({
    rz: z3.array(z3.number()),
    relay: z3.array(z3.number()),
    di: z3.array(z3.number())
  }),
  umodules: z3.record(
    z3.object({
      relay: z3.array(z3.number()),
      di: z3.array(z3.number()),
      aiC: z3.array(z3.number().nullable()),
      aoPct: z3.number()
    })
  )
});
var uptimeSchema = z3.object({
  years: z3.number().int().min(0),
  days: z3.number().int().min(0),
  hours: z3.number().int().min(0)
});
var topologySchema = z3.object({
  baseModules: z3.number().int().min(0),
  rModules: z3.number().int().min(0),
  uModules: z3.number().int().min(0),
  rooms: z3.number().int().min(0),
  mixedCircuits: z3.number().int().min(0),
  dehumidifiers: z3.number().int().min(0)
});
var heatCurveSchema = z3.object({
  slopeNormal: z3.number(),
  slopeAbsent: z3.number(),
  startNormal: z3.number(),
  startAbsent: z3.number(),
  reductionK: z3.number(),
  minFlowNormalC: z3.number(),
  minFlowAbsentC: z3.number(),
  maxFlowNormalC: z3.number(),
  maxFlowAbsentC: z3.number(),
  meta: metaSchema
});
var installerSettingsGroupSchema = z3.enum([
  "curve",
  "heatcool",
  "devices",
  "functions",
  "pid",
  "fancoil"
]);
var installerSettingFieldSchema = z3.object({
  name: z3.string(),
  label: z3.string(),
  kind: z3.enum(["number", "boolean"]),
  unit: z3.string().optional(),
  min: z3.number().optional(),
  max: z3.number().optional(),
  step: z3.number().optional(),
  hint: z3.string().optional(),
  value: z3.union([z3.number(), z3.boolean()])
});
var installerSettingsSchema = z3.object({
  group: installerSettingsGroupSchema,
  fields: z3.array(installerSettingFieldSchema),
  meta: metaSchema
});
var installerSettingsPatchSchema = z3.object({
  fields: z3.array(
    z3.object({
      name: z3.string(),
      value: z3.union([z3.number(), z3.boolean()])
    })
  )
});

// src/http/routes/installer.ts
var nowIso2 = () => (/* @__PURE__ */ new Date()).toISOString();
var registerInstallerRoutes = (app, { config, source, store }) => {
  const guard = async () => {
    if (!source.hasInstaller || !config.DEVICE_INSTALLER_CODE) {
      const err = Object.assign(new Error("installer_disabled"), { statusCode: 503 });
      throw err;
    }
  };
  const mirrorCalibration = (snap) => {
    for (const c of snap.rooms) {
      const room = store.getRoomByZone(c.zone);
      if (!room) continue;
      store.patchRoom(room.id, {
        calibrationTemp: c.tempOffset,
        calibrationHumidity: c.humidityOffset
      });
    }
  };
  app.get("/api/v1/installer/calibration", {
    schema: {
      tags: ["installer"],
      response: { 200: calibrationStateSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const snap = await source.fetchCalibration();
    mirrorCalibration(snap);
    return { ...snap, meta: { lastUpdatedAt: nowIso2() } };
  });
  app.put("/api/v1/installer/calibration", {
    schema: {
      tags: ["installer"],
      body: calibrationWriteSchema,
      response: { 200: calibrationStateSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const body = req.body;
    const patch = {};
    if (body.outdoor !== void 0) patch.outdoor = body.outdoor;
    if (body.rooms !== void 0) patch.rooms = body.rooms;
    const fresh = await source.setCalibration(patch);
    mirrorCalibration(fresh);
    return { ...fresh, meta: { lastUpdatedAt: nowIso2() } };
  });
  app.get("/api/v1/installer/io", {
    schema: {
      tags: ["installer"],
      response: { 200: ioSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    return source.fetchIO();
  });
  app.get("/api/v1/installer/diagnostics/uptime", {
    schema: {
      tags: ["installer"],
      response: { 200: uptimeSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    return source.fetchUptime();
  });
  app.get("/api/v1/installer/diagnostics/topology", {
    schema: {
      tags: ["installer"],
      response: { 200: topologySchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    return source.fetchTopology();
  });
  app.get("/api/v1/installer/curve", {
    schema: {
      tags: ["installer"],
      response: { 200: heatCurveSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const c = await source.fetchHeatCurve();
    return { ...c, meta: { lastUpdatedAt: nowIso2() } };
  });
  app.get("/api/v1/installer/settings/:group", {
    schema: {
      tags: ["installer"],
      params: z4.object({ group: installerSettingsGroupSchema }),
      response: { 200: installerSettingsSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const { group } = req.params;
    const snap = await source.fetchSettings(group);
    return { ...snap, meta: { lastUpdatedAt: nowIso2() } };
  });
  app.put("/api/v1/installer/settings/:group", {
    schema: {
      tags: ["installer"],
      params: z4.object({ group: installerSettingsGroupSchema }),
      body: installerSettingsPatchSchema,
      response: { 200: installerSettingsSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const { group } = req.params;
    const body = req.body;
    const snap = await source.setSettings(group, body.fields);
    return { ...snap, meta: { lastUpdatedAt: nowIso2() } };
  });
};

// src/http/routes/messages.ts
import { z as z5 } from "zod";
var registerMessagesRoutes = (app, { store, source }) => {
  app.get("/api/v1/messages", {
    schema: {
      tags: ["messages"],
      querystring: z5.object({ activeOnly: z5.coerce.boolean().optional() }),
      response: { 200: z5.array(messageSchema) },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    const { activeOnly } = req.query;
    const all = store.getMessages();
    return activeOnly ? all.filter((m) => !m.resolvedAt) : all;
  });
  app.post("/api/v1/messages/clear", {
    schema: {
      tags: ["messages"],
      response: { 200: z5.object({ ok: z5.literal(true) }) },
      security: [{ bearerAuth: [] }]
    }
  }, async () => {
    await source.clearMessages();
    store.setMessages([]);
    return { ok: true };
  });
};

// src/http/routes/programs.ts
import { z as z6 } from "zod";
var registerProgramsRoutes = (app, { store, commander }) => {
  app.get("/api/v1/programs/daily", {
    schema: {
      tags: ["programs"],
      response: { 200: z6.array(dailyProgramSchema) },
      security: [{ bearerAuth: [] }]
    }
  }, async () => store.listDailyPrograms());
  app.get("/api/v1/programs/daily/:n", {
    schema: {
      tags: ["programs"],
      params: z6.object({ n: z6.coerce.number().int().min(1).max(10) }),
      querystring: z6.object({ fresh: z6.coerce.boolean().optional() }),
      response: { 200: dailyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { n } = req.params;
    const { fresh } = req.query;
    if (fresh || !store.getDailyProgram(n)) {
      const p = await commander.refreshDailyProgram(n);
      if (!p) return reply.code(404).send({ error: "not_found" });
      return p;
    }
    return store.getDailyProgram(n);
  });
  app.put("/api/v1/programs/daily/:n", {
    schema: {
      tags: ["programs"],
      params: z6.object({ n: z6.coerce.number().int().min(1).max(10) }),
      body: dailyProgramWriteSchema,
      response: { 200: dailyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { n } = req.params;
    const body = req.body;
    const bits = "bits" in body ? body.bits : intervalsToBits(body.intervals);
    const p = await commander.setDailyProgram(n, bits);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return p;
  });
  app.get("/api/v1/programs/weekly", {
    schema: {
      tags: ["programs"],
      response: { 200: z6.array(weeklyProgramSchema) },
      security: [{ bearerAuth: [] }]
    }
  }, async () => store.listWeeklyPrograms());
  app.get("/api/v1/programs/weekly/:n", {
    schema: {
      tags: ["programs"],
      params: z6.object({ n: z6.coerce.number().int().min(1).max(5) }),
      querystring: z6.object({ fresh: z6.coerce.boolean().optional() }),
      response: { 200: weeklyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { n } = req.params;
    const { fresh } = req.query;
    if (fresh || !store.getWeeklyProgram(n)) {
      const p = await commander.refreshWeeklyProgram(n);
      if (!p) return reply.code(404).send({ error: "not_found" });
      return p;
    }
    return store.getWeeklyProgram(n);
  });
  app.put("/api/v1/programs/weekly/:n", {
    schema: {
      tags: ["programs"],
      params: z6.object({ n: z6.coerce.number().int().min(1).max(5) }),
      body: weeklyProgramWriteSchema,
      response: { 200: weeklyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { n } = req.params;
    const b = req.body;
    const days = [
      b.monday,
      b.tuesday,
      b.wednesday,
      b.thursday,
      b.friday,
      b.saturday,
      b.sunday
    ];
    const p = await commander.setWeeklyProgram(n, days);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return p;
  });
  app.get("/api/v1/programs/daily/:n/intervals", {
    schema: {
      tags: ["programs"],
      params: z6.object({ n: z6.coerce.number().int().min(1).max(10) }),
      response: {
        200: z6.object({
          intervals: z6.array(z6.object({ start: z6.string(), end: z6.string() }))
        }),
        404: errorSchema
      },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { n } = req.params;
    const p = store.getDailyProgram(n);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return { intervals: bitsToIntervals(p.bits) };
  });
};

// src/http/routes/rooms.ts
import { z as z7 } from "zod";
var registerRoomsRoutes = (app, { store, commander }) => {
  app.get("/api/v1/rooms", {
    schema: {
      tags: ["rooms"],
      response: { 200: z7.array(roomSchema) },
      security: [{ bearerAuth: [] }]
    }
  }, async () => store.listRooms());
  app.get("/api/v1/rooms/:id", {
    schema: {
      tags: ["rooms"],
      params: z7.object({ id: z7.string() }),
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { id } = req.params;
    const room = store.getRoom(id);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
  app.patch("/api/v1/rooms/:id", {
    schema: {
      tags: ["rooms"],
      params: z7.object({ id: z7.string() }),
      body: roomPatchSchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { id } = req.params;
    const body = req.body;
    let room = store.getRoom(id);
    if (!room) return reply.code(404).send({ error: "not_found" });
    if (body.mode !== void 0) {
      room = await commander.setRoomMode(id, body.mode, body.setpoint);
    } else if (body.setpoint !== void 0) {
      room = await commander.setRoomSetpoint(id, body.setpoint);
    }
    if (body.light !== void 0) {
      room = await commander.setRoomLight(id, body.light);
    }
    if (body.lock !== void 0 || body.autoStart !== void 0 || body.windowDetection !== void 0) {
      const flagPatch = {};
      if (body.lock !== void 0) flagPatch.lock = body.lock;
      if (body.autoStart !== void 0) flagPatch.autoStart = body.autoStart;
      if (body.windowDetection !== void 0) flagPatch.windowDetection = body.windowDetection;
      room = await commander.setRoomFlags(id, flagPatch);
    }
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
  app.put("/api/v1/rooms/:id/flags", {
    schema: {
      tags: ["rooms"],
      params: z7.object({ id: z7.string() }),
      body: roomFlagsBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { id } = req.params;
    const body = req.body;
    const flagPatch = {};
    if (body.lock !== void 0) flagPatch.lock = body.lock;
    if (body.autoStart !== void 0) flagPatch.autoStart = body.autoStart;
    if (body.windowDetection !== void 0) flagPatch.windowDetection = body.windowDetection;
    const room = await commander.setRoomFlags(id, flagPatch);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
  app.put("/api/v1/rooms/:id/setpoint", {
    schema: {
      tags: ["rooms"],
      params: z7.object({ id: z7.string() }),
      body: setpointBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { id } = req.params;
    const { value } = req.body;
    const room = await commander.setRoomSetpoint(id, value);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
  app.put("/api/v1/rooms/:id/light", {
    schema: {
      tags: ["rooms"],
      params: z7.object({ id: z7.string() }),
      body: lightBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { id } = req.params;
    const { light } = req.body;
    const room = await commander.setRoomLight(id, light);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
  app.put("/api/v1/rooms/:id/mode", {
    schema: {
      tags: ["rooms"],
      params: z7.object({ id: z7.string() }),
      body: roomModeBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    const { id } = req.params;
    const { mode, setpoint } = req.body;
    const room = await commander.setRoomMode(id, mode, setpoint);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
};

// src/http/routes/system.ts
var registerSystemRoutes = (app, { store, commander }) => {
  app.get("/api/v1/system", {
    schema: {
      tags: ["system"],
      response: { 200: systemStateSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async () => store.getSystem());
  app.put("/api/v1/system/operating_mode", {
    schema: {
      tags: ["system"],
      body: operatingModeBodySchema,
      response: { 200: systemStateSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    const { mode } = operatingModeBodySchema.parse(req.body);
    await commander.setOperatingMode(mode);
    return store.getSystem();
  });
  app.put("/api/v1/system/energy_level", {
    schema: {
      tags: ["system"],
      body: energyLevelBodySchema,
      response: { 200: systemStateSchema },
      security: [{ bearerAuth: [] }]
    }
  }, async (req) => {
    const { level } = energyLevelBodySchema.parse(req.body);
    await commander.setEnergyLevel(level);
    return store.getSystem();
  });
};

// src/http/server.ts
var buildServer = async ({
  config,
  logger,
  store,
  commander,
  source,
  poller,
  spaDir
}) => {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...config.LOG_FORMAT === "pretty" ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}
    },
    disableRequestLogging: false,
    trustProxy: true,
    // Close keep-alive sockets immediately on app.close(). Without this, when
    // `tsx watch` restarts the bridge, idle browser connections keep the
    // listener alive past the SIGTERM and the OS holds port 8080.
    forceCloseConnections: true
  });
  void logger;
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode ?? 500;
    const e = err;
    app.log.error({ err, status }, "request failed");
    reply.code(status).send({ error: e.name ?? "error", message: e.message ?? "" });
  });
  if (config.HTTP_CORS_ORIGINS) {
    const origins = config.HTTP_CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
    await app.register(fastifyCors, { origin: origins, credentials: true });
  }
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: () => false
  });
  await registerOpenApi(app);
  await registerAuth(app, config);
  const addonVersion = process.env.ADDON_VERSION || "dev";
  app.get("/healthz", async () => ({
    ok: true,
    bridge: "0.1.0",
    addon: addonVersion,
    source: config.DEVICE_MODE,
    device: { url: config.DEVICE_URL, ...store.getDeviceStatus() },
    connection: store.getConnection(),
    installerAccess: Boolean(config.DEVICE_INSTALLER_CODE)
  }));
  app.get("/api/v1/diagnostics/fetches", async () => ({
    ...store.getDiagnostics(),
    versions: { bridge: "0.1.0", addon: addonVersion }
  }));
  app.post("/api/v1/diagnostics/refresh", async () => {
    await poller.refreshAll();
    return { ok: true };
  });
  registerAuthRoutes(app, config);
  registerRoomsRoutes(app, { store, commander });
  registerSystemRoutes(app, { store, commander });
  registerMessagesRoutes(app, { store, source });
  registerProgramsRoutes(app, { store, commander });
  registerInstallerRoutes(app, { config, source, store });
  if (spaDir && existsSync(spaDir)) {
    await app.register(fastifyStatic, { root: resolve(spaDir), prefix: "/" });
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/docs") || req.url.startsWith("/openapi")) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html");
    });
  }
  return app;
};

// src/mqtt/client.ts
import mqtt from "mqtt";
var TypedMqttClient = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  client = null;
  connected = false;
  handlers = [];
  async start() {
    const { url, username, password, clientId, availabilityTopic, logger } = this.opts;
    logger.info({ url, clientId }, "mqtt connecting");
    this.client = mqtt.connect(url, {
      ...username ? { username } : {},
      ...password ? { password } : {},
      clientId,
      reconnectPeriod: 5e3,
      will: {
        topic: availabilityTopic,
        payload: Buffer.from("offline"),
        qos: 1,
        retain: true
      }
    });
    this.client.on("connect", () => {
      this.connected = true;
      logger.info("mqtt connected");
      this.publish(availabilityTopic, "online", { retain: true });
    });
    this.client.on("reconnect", () => logger.info("mqtt reconnecting"));
    this.client.on("offline", () => {
      this.connected = false;
      logger.warn("mqtt offline");
    });
    this.client.on("error", (err) => logger.error({ err }, "mqtt error"));
    this.client.on("close", () => {
      this.connected = false;
    });
    this.client.on("message", (topic, payload) => {
      const text = payload.toString("utf8");
      for (const h of this.handlers) h(topic, text);
    });
  }
  isConnected() {
    return this.connected;
  }
  publish(topic, payload, options = {}) {
    if (!this.client) return;
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    this.client.publish(topic, body, {
      qos: options.qos ?? 1,
      retain: options.retain ?? false
    });
  }
  subscribe(topic) {
    if (!this.client) return;
    this.client.subscribe(topic, { qos: 1 });
  }
  onMessage(handler) {
    this.handlers.push(handler);
  }
  async stop() {
    if (!this.client) return;
    this.publish(this.opts.availabilityTopic, "offline", { retain: true });
    await new Promise((resolve3) => {
      this.client.end(false, {}, () => resolve3());
    });
  }
};

// src/mqtt/discovery.ts
var deviceBlock = (ctx) => ({
  identifiers: [`rehau_${ctx.installationSlug}_${ctx.deviceId}`],
  name: ctx.installationName,
  manufacturer: "REHAU",
  model: "Nea Smart 2.0",
  sw_version: ctx.fwVersion
});
var ROOM_MODE_TO_HA_MODE_JINJA = "{{ {'standby':'off','normal':'heat','reduced':'heat','program':'auto','program_override':'auto'}.get(value_json.mode, 'off') }}";
var HA_MODE_TO_ROOM_MODE_JINJA = "{{ {'off':'standby','heat':'normal','auto':'program','cool':'normal'}.get(value, 'normal') }}";
var FAN_SPEED_STATE_JINJA = "{% if value_json.fanRunning %}{{ ['Spento','Bassa','Media','Alta','Massima'][value_json.fan|int] }}{% else %}Spento{% endif %}";
var buildRoomClimate = (ctx, room) => ({
  topic: `${ctx.prefix}/climate/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}/config`,
  payload: {
    name: room.name,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}`,
    availability_topic: ctx.topics.availability,
    current_temperature_topic: ctx.topics.roomState(room.id),
    // Render Python `None` for the no-defaults nullable fields so HA shows
    // "unavailable" instead of "0" / blank. Otherwise an un-polled Room
    // would surface phantom 0°C readings in HA dashboards.
    current_temperature_template: "{% if value_json.temperature is none %}unknown{% else %}{{ value_json.temperature }}{% endif %}",
    current_humidity_topic: ctx.topics.roomState(room.id),
    current_humidity_template: "{% if value_json.humidity is none %}unknown{% else %}{{ value_json.humidity }}{% endif %}",
    temperature_state_topic: ctx.topics.roomState(room.id),
    temperature_state_template: "{% if value_json.setpointHeating is none %}unknown{% else %}{{ value_json.setpointHeating }}{% endif %}",
    temperature_command_topic: ctx.topics.roomSetpointSet(room.id),
    min_temp: 5,
    max_temp: 31,
    temp_step: 0.5,
    modes: ["off", "heat", "auto"],
    mode_state_topic: ctx.topics.roomState(room.id),
    mode_state_template: ROOM_MODE_TO_HA_MODE_JINJA,
    mode_command_topic: ctx.topics.roomModeSet(room.id),
    mode_command_template: HA_MODE_TO_ROOM_MODE_JINJA,
    preset_modes: ["normal", "reduced", "program", "program_override", "standby"],
    preset_mode_state_topic: ctx.topics.roomState(room.id),
    preset_mode_value_template: "{{ value_json.mode }}",
    preset_mode_command_topic: ctx.topics.roomModeSet(room.id),
    // Fancoil speed and flap are exposed as separate `sensor` entities (see
    // buildRoomFanSpeedSensor / buildRoomFlapSensor). HA doesn't have a
    // read-only mode for climate's fan_mode/swing_mode — declaring them
    // without a command topic leaves the dropdown clickable but does nothing,
    // which is worse UX than putting the value on a plain sensor.
    device: deviceBlock(ctx)
  }
});
var buildRoomHumiditySensor = (ctx, room) => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_humidity/config`,
  payload: {
    name: `${room.name} umidit\xE0`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_humidity`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{% if value_json.humidity is none %}unknown{% else %}{{ value_json.humidity }}{% endif %}",
    unit_of_measurement: "%",
    device_class: "humidity",
    state_class: "measurement",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildOutdoorSensor = (ctx) => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor/config`,
  payload: {
    name: "Temperatura esterna",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.outdoorTemp }}",
    unit_of_measurement: "\xB0C",
    device_class: "temperature",
    state_class: "measurement",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildOperatingModeSelect = (ctx) => ({
  topic: `${ctx.prefix}/select/rehau_${ctx.installationSlug}_${ctx.deviceId}_operating_mode/config`,
  payload: {
    name: "Modalit\xE0 operativa",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_operating_mode`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.operatingMode }}",
    command_topic: ctx.topics.setOperatingMode,
    options: ["heating_only", "cooling_only", "manual_heating", "manual_cooling"],
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildEnergyLevelSelect = (ctx) => ({
  topic: `${ctx.prefix}/select/rehau_${ctx.installationSlug}_${ctx.deviceId}_energy_level/config`,
  payload: {
    name: "Livello energia",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_energy_level`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.energyLevel }}",
    command_topic: ctx.topics.setEnergyLevel,
    options: ["normal", "reduced", "standby", "auto", "vacation"],
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildRoomLightSwitch = (ctx, room) => ({
  topic: `${ctx.prefix}/switch/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_light/config`,
  payload: {
    name: `${room.name} luce`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_light`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{{ 'ON' if value_json.light else 'OFF' }}",
    command_topic: ctx.topics.roomLightSet(room.id),
    payload_on: "true",
    payload_off: "false",
    state_on: "ON",
    state_off: "OFF",
    icon: "mdi:lightbulb",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var roomFlagSwitch = (ctx, room, slug, label, field, commandTopic, icon) => ({
  topic: `${ctx.prefix}/switch/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_${slug}/config`,
  payload: {
    name: `${room.name} \xB7 ${label}`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_${slug}`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: `{{ 'ON' if value_json.${field} else 'OFF' }}`,
    command_topic: commandTopic,
    payload_on: "true",
    payload_off: "false",
    state_on: "ON",
    state_off: "OFF",
    icon,
    entity_category: "config",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildRoomLockSwitch = (ctx, room) => roomFlagSwitch(ctx, room, "lock", "Blocco display", "lock", ctx.topics.roomLockSet(room.id), "mdi:lock");
var buildRoomAutoStartSwitch = (ctx, room) => roomFlagSwitch(
  ctx,
  room,
  "auto_start",
  "Auto avviamento",
  "autoStart",
  ctx.topics.roomAutoStartSet(room.id),
  "mdi:clock-start"
);
var buildRoomFanRunningSensor = (ctx, room) => ({
  topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_running/config`,
  payload: {
    name: `${room.name} \xB7 fancoil`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_running`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{{ 'ON' if value_json.fanRunning else 'OFF' }}",
    payload_on: "ON",
    payload_off: "OFF",
    device_class: "running",
    entity_category: "diagnostic",
    icon: "mdi:fan",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildRoomFanSpeedSensor = (ctx, room) => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_speed/config`,
  payload: {
    name: `${room.name} \xB7 velocit\xE0 fancoil`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_speed`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: FAN_SPEED_STATE_JINJA,
    entity_category: "diagnostic",
    icon: "mdi:fan-speed-1",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildRoomFlapSensor = (ctx, room) => ({
  topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_flap/config`,
  payload: {
    name: `${room.name} \xB7 aletta`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_flap`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{{ 'ON' if value_json.flap == 1 else 'OFF' }}",
    payload_on: "ON",
    payload_off: "OFF",
    device_class: "opening",
    entity_category: "diagnostic",
    icon: "mdi:valve",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildRoomWindowDetectionSwitch = (ctx, room) => roomFlagSwitch(
  ctx,
  room,
  "window_detection",
  "Rilev. finestra aperta",
  "windowDetection",
  ctx.topics.roomWindowDetectionSet(room.id),
  "mdi:window-open-variant"
);
var buildAlarmsBinarySensor = (ctx) => ({
  topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_active/config`,
  payload: {
    name: "Allarmi attivi",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_active`,
    state_topic: ctx.topics.alarmsActive,
    payload_on: "true",
    payload_off: "false",
    device_class: "problem",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildRoomTempCalibrationSensor = (ctx, room) => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_temp/config`,
  payload: {
    name: `${room.name} \xB7 offset temperatura`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_temp`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{% if value_json.calibrationTemp is none %}unknown{% else %}{{ value_json.calibrationTemp }}{% endif %}",
    unit_of_measurement: "\xB0C",
    device_class: "temperature",
    state_class: "measurement",
    entity_category: "diagnostic",
    icon: "mdi:thermometer-plus",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildRoomHumidityCalibrationSensor = (ctx, room) => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_humidity/config`,
  payload: {
    name: `${room.name} \xB7 offset umidit\xE0`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_humidity`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{% if value_json.calibrationHumidity is none %}unknown{% else %}{{ value_json.calibrationHumidity }}{% endif %}",
    unit_of_measurement: "%",
    state_class: "measurement",
    entity_category: "diagnostic",
    icon: "mdi:water-percent",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildOutdoorOffsetSensor = (ctx) => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor_offset/config`,
  payload: {
    name: "Offset temperatura esterna",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor_offset`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.outdoorOffset }}",
    unit_of_measurement: "\xB0C",
    device_class: "temperature",
    state_class: "measurement",
    entity_category: "diagnostic",
    icon: "mdi:thermometer-plus",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildAlarmsCountSensor = (ctx) => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_count/config`,
  payload: {
    name: "Allarmi attivi \xB7 numero",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_count`,
    state_topic: ctx.topics.alarmsCount,
    state_class: "measurement",
    icon: "mdi:alert-circle-outline",
    entity_category: "diagnostic",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx)
  }
});
var buildIODiscovery = (ctx, io) => {
  const msgs = [];
  const ioTopic = ctx.topics.io;
  const binarySensor = (suffix, name, template, icon) => ({
    topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}/config`,
    payload: {
      name,
      unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}`,
      state_topic: ioTopic,
      value_template: template,
      payload_on: "1",
      payload_off: "0",
      entity_category: "diagnostic",
      ...icon ? { icon } : {},
      availability_topic: ctx.topics.availability,
      device: deviceBlock(ctx)
    }
  });
  const sensor = (suffix, name, template, unit, deviceClass, icon) => ({
    topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}/config`,
    payload: {
      name,
      unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}`,
      state_topic: ioTopic,
      value_template: template,
      unit_of_measurement: unit,
      state_class: "measurement",
      entity_category: "diagnostic",
      ...deviceClass ? { device_class: deviceClass } : {},
      ...icon ? { icon } : {},
      availability_topic: ctx.topics.availability,
      device: deviceBlock(ctx)
    }
  });
  for (let i = 0; i < io.master.rz.length; i++) {
    msgs.push(
      binarySensor(
        `master_rz_${i + 1}`,
        `Master \xB7 Zona ${i + 1} (RZ)`,
        `{{ value_json.master.rz[${i}] | int }}`,
        "mdi:valve"
      )
    );
  }
  for (let i = 0; i < io.master.relay.length; i++) {
    msgs.push(
      binarySensor(
        `master_relay_${i + 1}`,
        `Master \xB7 Rel\xE8 ${i + 1}`,
        `{{ value_json.master.relay[${i}] | int }}`,
        "mdi:electric-switch"
      )
    );
  }
  for (let i = 0; i < io.master.di.length; i++) {
    msgs.push(
      binarySensor(
        `master_di_${i + 1}`,
        `Master \xB7 Ingresso ${i + 1} (DI)`,
        `{{ value_json.master.di[${i}] | int }}`,
        "mdi:electric-switch-closed"
      )
    );
  }
  for (const [key, um] of Object.entries(io.umodules)) {
    const slug = key.replace(/[^A-Za-z0-9]+/g, "_").toLowerCase();
    const pretty = key.replace(/^umodule/, "Modulo-U ");
    const pathPrefix = `value_json.umodules['${key}']`;
    for (let i = 0; i < um.relay.length; i++) {
      msgs.push(
        binarySensor(
          `${slug}_relay_${i + 1}`,
          `${pretty} \xB7 Rel\xE8 ${i + 1}`,
          `{{ ${pathPrefix}.relay[${i}] | int }}`,
          "mdi:electric-switch"
        )
      );
    }
    for (let i = 0; i < um.di.length; i++) {
      msgs.push(
        binarySensor(
          `${slug}_di_${i + 1}`,
          `${pretty} \xB7 Ingresso ${i + 1} (DI)`,
          `{{ ${pathPrefix}.di[${i}] | int }}`,
          "mdi:electric-switch-closed"
        )
      );
    }
    for (let i = 0; i < um.aiC.length; i++) {
      msgs.push({
        topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${slug}_ai_${i + 1}/config`,
        payload: {
          // AI temperatures are kept OUT of the diagnostic section — they're
          // primary measurements (mandata/ritorno etc.) worth dashboarding.
          name: `${pretty} \xB7 AI ${i + 1} (temperatura)`,
          unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${slug}_ai_${i + 1}`,
          state_topic: ioTopic,
          // Skip "null" values via the template (HA marks the entity as unavailable).
          value_template: `{% set v = ${pathPrefix}.aiC[${i}] %}{% if v is none %}{{ 'unknown' }}{% else %}{{ v }}{% endif %}`,
          unit_of_measurement: "\xB0C",
          device_class: "temperature",
          state_class: "measurement",
          availability_topic: ctx.topics.availability,
          device: deviceBlock(ctx)
        }
      });
    }
    msgs.push(
      sensor(
        `${slug}_ao`,
        `${pretty} \xB7 AO (modulazione)`,
        `{{ ${pathPrefix}.aoPct }}`,
        "%",
        void 0,
        "mdi:gauge"
      )
    );
  }
  return msgs;
};
var buildAllDiscovery = (ctx, rooms, _system, io) => [
  buildOutdoorSensor(ctx),
  buildOperatingModeSelect(ctx),
  buildEnergyLevelSelect(ctx),
  buildAlarmsBinarySensor(ctx),
  buildAlarmsCountSensor(ctx),
  ...ctx.exposeCalibration ? [buildOutdoorOffsetSensor(ctx)] : [],
  ...rooms.flatMap((r) => {
    const msgs = [
      buildRoomClimate(ctx, r),
      buildRoomHumiditySensor(ctx, r),
      buildRoomLockSwitch(ctx, r),
      buildRoomAutoStartSwitch(ctx, r),
      buildRoomWindowDetectionSwitch(ctx, r)
    ];
    if (r.hasLight) msgs.push(buildRoomLightSwitch(ctx, r));
    if (r.hasFan) {
      msgs.push(buildRoomFanRunningSensor(ctx, r));
      msgs.push(buildRoomFanSpeedSensor(ctx, r));
    }
    if (r.hasFlap) msgs.push(buildRoomFlapSensor(ctx, r));
    if (ctx.exposeCalibration) {
      msgs.push(buildRoomTempCalibrationSensor(ctx, r));
      msgs.push(buildRoomHumidityCalibrationSensor(ctx, r));
    }
    return msgs;
  }),
  ...io ? buildIODiscovery(ctx, io) : []
];

// src/mqtt/topics.ts
var slugify = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
var topics = (spec) => {
  const root = `${spec.base}/${spec.installationSlug}/${spec.deviceId}`;
  return {
    root,
    availability: `${root}/availability`,
    systemState: `${root}/system/state`,
    setOperatingMode: `${root}/system/operating_mode/set`,
    setEnergyLevel: `${root}/system/energy_level/set`,
    messages: `${root}/messages`,
    alarmsActive: `${root}/alarms/active`,
    alarmsCount: `${root}/alarms/count`,
    io: `${root}/io`,
    roomState: (roomId) => `${root}/rooms/${roomId}/state`,
    roomSetpointSet: (roomId) => `${root}/rooms/${roomId}/setpoint/set`,
    roomModeSet: (roomId) => `${root}/rooms/${roomId}/mode/set`,
    roomLightSet: (roomId) => `${root}/rooms/${roomId}/light/set`,
    roomLockSet: (roomId) => `${root}/rooms/${roomId}/lock/set`,
    roomAutoStartSet: (roomId) => `${root}/rooms/${roomId}/auto_start/set`,
    roomWindowDetectionSet: (roomId) => `${root}/rooms/${roomId}/window_detection/set`
  };
};
var matchCommand = (t, topic) => {
  if (topic === t.setOperatingMode) return { kind: "setOperatingMode" };
  if (topic === t.setEnergyLevel) return { kind: "setEnergyLevel" };
  const m = topic.match(new RegExp(`^${t.root}/rooms/([^/]+)/(setpoint|mode|light|lock|auto_start|window_detection)/set$`));
  if (!m) return null;
  const roomId = m[1];
  switch (m[2]) {
    case "setpoint":
      return { kind: "roomSetpoint", roomId };
    case "mode":
      return { kind: "roomMode", roomId };
    case "light":
      return { kind: "roomLight", roomId };
    case "lock":
      return { kind: "roomLock", roomId };
    case "auto_start":
      return { kind: "roomAutoStart", roomId };
    case "window_detection":
      return { kind: "roomWindowDetection", roomId };
    default:
      return null;
  }
};

// src/mqtt/bridge.ts
var ENERGY = /* @__PURE__ */ new Set(["normal", "reduced", "standby", "auto", "vacation"]);
var OP_MODE = /* @__PURE__ */ new Set(["heating_only", "cooling_only", "manual_heating", "manual_cooling"]);
var ROOM_MODE = /* @__PURE__ */ new Set(["standby", "normal", "reduced", "program", "program_override"]);
var MqttBridge = class {
  constructor(o) {
    this.o = o;
    const c = o.config;
    this.deviceId = c.DEVICE_ID || this.deriveDeviceId(o.store.getSystem().uniqueCode);
    this.installationName = c.INSTALLATION_NAME;
    this.installationSlug = slugify(c.INSTALLATION_NAME);
    this.topics = topics({
      base: c.MQTT_BASE_TOPIC,
      installationSlug: this.installationSlug,
      deviceId: this.deviceId
    });
    this.mqtt = new TypedMqttClient({
      url: c.MQTT_URL ?? "",
      username: c.MQTT_USERNAME,
      password: c.MQTT_PASSWORD,
      clientId: `rehau-bridge-${this.deviceId}-${Math.random().toString(36).slice(2, 7)}`,
      availabilityTopic: this.topics.availability,
      logger: o.logger
    });
  }
  o;
  mqtt;
  topics;
  deviceId;
  installationName;
  installationSlug;
  /**
   * Snapshot of the room capability flags we last published in HA discovery.
   * When this signature changes (e.g. a room turns out to have a light after
   * the first detail poll), we re-publish discovery so HA picks up the new
   * `switch`/`select` entities.
   */
  capabilitySignature = null;
  deriveDeviceId(uniqueCode) {
    return (uniqueCode || "rehau").slice(-8) || "rehau";
  }
  async start() {
    await this.mqtt.start();
    this.mqtt.subscribe(this.topics.setOperatingMode);
    this.mqtt.subscribe(this.topics.setEnergyLevel);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/setpoint/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/mode/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/light/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/lock/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/auto_start/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/window_detection/set`);
    this.mqtt.onMessage(async (topic, payload) => {
      try {
        await this.handleCommand(topic, payload);
      } catch (err) {
        this.o.logger.warn({ err, topic }, "mqtt command failed");
      }
    });
    this.publishCurrent();
    this.o.store.events.on("room.changed", (r) => this.publishRoom(r));
    this.o.store.events.on("system.changed", (s) => this.publishSystem(s));
    this.o.store.events.on("messages.changed", (m) => this.publishMessages(m));
    this.o.store.events.on("io.changed", (io) => this.publishIO(io));
    this.o.store.events.on("device.status", (s) => {
      this.mqtt.publish(this.topics.availability, s.online ? "online" : "offline", { retain: true });
    });
  }
  async stop() {
    await this.mqtt.stop();
  }
  publishCurrent() {
    setTimeout(() => {
      if (!this.mqtt.isConnected()) return this.publishCurrent();
      this.publishHaDiscovery();
      this.publishSystem(this.o.store.getSystem());
      this.publishMessages(this.o.store.getMessages());
      for (const r of this.o.store.listRooms()) this.publishRoom(r);
      const io = this.o.store.getIO();
      if (io) this.publishIO(io);
    }, 500);
  }
  currentCapabilitySignature() {
    const rooms = this.o.store.listRooms().map((r) => `${r.id}:${r.hasLight ? "L" : ""}${r.hasFan ? "F" : ""}${r.hasFlap ? "P" : ""}`).join("|");
    const io = this.o.store.getIO();
    const ioSig = io ? `m:${io.master.rz.length}/${io.master.relay.length}/${io.master.di.length}|` + Object.entries(io.umodules).map(([k, v]) => `${k}:${v.relay.length}/${v.di.length}/${v.aiC.length}`).join(",") : "noio";
    return `${rooms}||${ioSig}`;
  }
  /**
   * Publish HA discovery. Idempotent: a no-op if the room capability signature
   * hasn't changed since the last publish. This lets us recover from the
   * initial-state race (seed data has `hasLight=false` but the polled value
   * arrives moments later as `true`).
   */
  publishHaDiscovery() {
    if (!this.o.config.MQTT_HA_DISCOVERY) return;
    const sig = this.currentCapabilitySignature();
    if (sig === this.capabilitySignature) return;
    const previous = this.capabilitySignature;
    this.capabilitySignature = sig;
    const ctx = {
      prefix: this.o.config.MQTT_HA_DISCOVERY_PREFIX,
      topics: this.topics,
      deviceId: this.deviceId,
      installationName: this.installationName,
      installationSlug: this.installationSlug,
      fwVersion: `Master ${this.o.store.getSystem().fw.master}`,
      exposeCalibration: this.o.config.EXPOSE_CALIBRATION
    };
    for (const m of buildAllDiscovery(ctx, this.o.store.listRooms(), this.o.store.getSystem(), this.o.store.getIO())) {
      this.mqtt.publish(m.topic, m.payload, { retain: true });
    }
    this.o.logger.info(
      { count: this.o.store.listRooms().length, reason: previous === null ? "initial" : "capabilities-changed" },
      "ha discovery published"
    );
  }
  publishRoom(r) {
    this.mqtt.publish(this.topics.roomState(r.id), r, { retain: true });
    this.publishHaDiscovery();
  }
  publishSystem(s) {
    this.mqtt.publish(this.topics.systemState, s, { retain: true });
  }
  publishMessages(m) {
    this.mqtt.publish(this.topics.messages, m, { retain: true });
    const active = m.filter((a) => !a.resolvedAt).length;
    this.mqtt.publish(this.topics.alarmsActive, active > 0 ? "true" : "false", { retain: true });
    this.mqtt.publish(this.topics.alarmsCount, String(active), { retain: true });
  }
  publishIO(io) {
    this.mqtt.publish(this.topics.io, io, { retain: true });
    this.publishHaDiscovery();
  }
  async handleCommand(topic, payload) {
    const match = matchCommand(this.topics, topic);
    if (!match) return;
    switch (match.kind) {
      case "setOperatingMode": {
        const m = payload.trim();
        if (OP_MODE.has(m)) {
          await this.o.commander.setOperatingMode(m);
        }
        return;
      }
      case "setEnergyLevel": {
        const l = payload.trim();
        if (ENERGY.has(l)) {
          await this.o.commander.setEnergyLevel(l);
        }
        return;
      }
      case "roomSetpoint": {
        const v = Number(payload);
        if (Number.isFinite(v)) await this.o.commander.setRoomSetpoint(match.roomId, v);
        return;
      }
      case "roomMode": {
        const m = payload.trim();
        if (ROOM_MODE.has(m)) {
          await this.o.commander.setRoomMode(match.roomId, m);
        }
        return;
      }
      case "roomLight": {
        const v = payload.trim().toLowerCase();
        const next = v === "true" || v === "on" || v === "1";
        await this.o.commander.setRoomLight(match.roomId, next);
        return;
      }
      case "roomLock":
      case "roomAutoStart":
      case "roomWindowDetection": {
        const v = payload.trim().toLowerCase();
        const next = v === "true" || v === "on" || v === "1";
        const key = match.kind === "roomLock" ? "lock" : match.kind === "roomAutoStart" ? "autoStart" : "windowDetection";
        await this.o.commander.setRoomFlags(match.roomId, { [key]: next });
        return;
      }
    }
  }
};

// src/observability/log.ts
import { pino } from "pino";
var createLogger = (cfg) => pino({
  level: cfg.LOG_LEVEL,
  ...cfg.LOG_FORMAT === "pretty" ? {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss.l" }
    }
  } : {}
});

// src/main.ts
dotenv.config({ path: resolve2(import.meta.dirname, "../../../.env") });
var main = async () => {
  const config = loadConfig();
  const logger = createLogger(config);
  logger.info({
    deviceMode: config.DEVICE_MODE,
    deviceUrl: config.DEVICE_URL,
    installerAccess: Boolean(config.DEVICE_INSTALLER_CODE),
    mqtt: config.MQTT_URL ? "enabled" : "disabled"
  }, "bridge starting");
  const store = new Store({ seed: config.DEVICE_MODE !== "live" });
  store.patchSystem({ installationName: config.INSTALLATION_NAME });
  let source;
  if (config.DEVICE_MODE === "live") {
    const http = new DeviceClient({
      baseUrl: config.DEVICE_URL,
      timeoutMs: config.DEVICE_REQUEST_TIMEOUT_MS,
      minGapMs: config.DEVICE_MIN_GAP_MS,
      logger,
      onTelemetry: (entry) => store.recordFetch(entry)
    });
    const installer = config.DEVICE_INSTALLER_CODE ? new InstallerSession({ http, code: config.DEVICE_INSTALLER_CODE, logger }) : void 0;
    source = new LiveDeviceSource(http, installer);
  } else {
    source = new MockDeviceSource();
  }
  const poller = new Poller({ config, source, store, logger });
  const commander = new Commander({ source, store, poller });
  const spaDir = resolve2(import.meta.dirname, "..", "web");
  const app = await buildServer({ config, logger, store, commander, source, poller, spaDir });
  poller.start();
  let mqttBridge = null;
  if (config.MQTT_URL) {
    mqttBridge = new MqttBridge({ config, store, commander, logger });
    await mqttBridge.start();
  } else {
    logger.info("MQTT_URL not set \u2014 MQTT bridge disabled");
  }
  try {
    await app.listen({ port: config.HTTP_PORT, host: "0.0.0.0" });
  } catch (err) {
    const isAddrInUse = typeof err === "object" && err !== null && err.code === "EADDRINUSE";
    if (!isAddrInUse || process.env.NODE_ENV === "production") throw err;
    logger.warn({ port: config.HTTP_PORT }, "port busy on startup, attempting to free it");
    await killPortHolder(config.HTTP_PORT, logger);
    await app.listen({ port: config.HTTP_PORT, host: "0.0.0.0" });
  }
  let shuttingDown = false;
  const shutdown = async (sig) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ sig }, "shutting down");
    const killer = setTimeout(() => {
      logger.warn("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 3e3);
    killer.unref();
    try {
      poller.stop();
      if (mqttBridge) await mqttBridge.stop();
      await source.close();
      await app.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "shutdown failed");
      process.exit(1);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("end", () => void shutdown("manual"));
  process.stdin.on("close", () => void shutdown("manual"));
};
main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
var exec = promisify(execFile);
async function killPortHolder(port, log) {
  const pids = await (process.platform === "win32" ? findPidsWindows(port) : findPidsPosix(port));
  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, "SIGKILL");
      log.warn({ port, pid }, "killed stale listener");
    } catch {
    }
  }
  await new Promise((r) => setTimeout(r, 200));
}
async function findPidsWindows(port) {
  try {
    const { stdout } = await exec("netstat", ["-ano", "-p", "tcp"]);
    const pids = /* @__PURE__ */ new Set();
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/);
      if (m && Number(m[1]) === port) pids.add(Number(m[2]));
    }
    return [...pids];
  } catch {
    return [];
  }
}
async function findPidsPosix(port) {
  try {
    const { stdout } = await exec("lsof", ["-i", `tcp:${port}`, "-sTCP:LISTEN", "-t"]);
    return stdout.split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}
//# sourceMappingURL=main.js.map