// HTML scrapers for the REHAU Nea Smart 2 web UI.
// Every function takes raw HTML and returns a typed shape; no I/O.
//
// Stability: HTML drift between firmwares is the single biggest risk. Each
// parser is unit-tested against snapshots under `tests/fixtures/<fw>/`.

import * as cheerio from "cheerio";
import type {
  AlarmMessage,
  AlarmSeverity,
  EnergyLevel,
  FirmwareInfo,
  HeatCurveState,
  IOSnapshot,
  RoomCalibration,
  RoomMode,
  SystemMode,
  Topology,
  UptimeState,
} from "@rehau/types";
import {
  deviceStateToRoomMode,
  energyLevelFromDevice,
  operatingModeFromDevice,
} from "./codecs.js";

export interface DashboardSnapshot {
  outdoorTemp: number;
  clock: string;
  operatingMode: SystemMode;
  energyLevel: EnergyLevel;
}

export interface RoomListEntry {
  zone: number;
  name: string;
  temperature: number;
}

export interface RoomDetailSnapshot {
  zone: number;
  name: string;
  temperature: number;
  humidity: number;
  setpoint: number;
  setpointHeatingNormal: number;
  setpointHeatingReduced: number;
  setpointStandby: number;
  mode: RoomMode;
  hasFan: boolean;
  hasFlap: boolean;
  /**
   * True when the fancoil is currently running (motor on). REHAU signals this
   * by emitting an extra `document.getElementById("FFF").style.fill="#DD0060"`
   * line in the page script for the active room only — this paints the fan
   * SVG pink. Idle rooms get no such line so the icon stays black. We mirror
   * the same visual signal in the app.
   */
  fanRunning: boolean;
  programActive: number;
  fan: number;
  flap: number;
  light: boolean;
  /** True when the room-operating form carries a `lightH` field. */
  hasLight: boolean;
}

export interface SystemInfoSnapshot {
  uniqueCode: string;
  fw: FirmwareInfo;
  seasonStart: string;
  seasonEnd: string;
  outdoorOffset: number;
}

/**
 * Full snapshot of the room-set-up.html form. Captures every field so we can
 * patch one and resubmit the lot (REHAU forms are all-or-nothing). Exposed
 * fields on `Room`: `lock`, `autoStart`, `windowDetection`. The rest is read
 * internally for the writer.
 */
export interface RoomSetupSnapshot {
  zone: number;
  name: string;
  setpoints: {
    /** Heating · Normal, °C. */
    normalH: number;
    /** Heating · Reduced, °C. */
    reducedH: number;
    /** Heating · Standby, °C. */
    standby: number;
    /** Cooling · Normal, °C. */
    normalC: number;
    /** Cooling · Reduced, °C. */
    reducedC: number;
    /** Upper limit allowed for the room setpoint in heating, °C. */
    maxH: number;
    /** Lower limit allowed for the room setpoint in cooling, °C. */
    minC: number;
  };
  flags: {
    /** `Auto` — "Abilita auto avviamento" (adaptive start). */
    auto: boolean;
    /** `SWOW` — "Rilevamento finestra aperta" (open-window detection). */
    swow: boolean;
    /** `Lock` — "Blocca display" (physical thermostat keypad lock). */
    lock: boolean;
  };
  /** Per-room weekly program (0 = none, 1..5 = slot). */
  weekly: number;
  /** Per-room day overrides — 7 entries, each 1..10 (daily program slot). */
  daysProgram: [number, number, number, number, number, number, number];
}

export const parseRoomSetup = (html: string): RoomSetupSnapshot => {
  const $ = cheerio.load(html);
  const zone = Number($('input[name="zone"]').attr("value") ?? "0");
  const name = $("#RoomName").attr("value")?.trim() ?? "";
  const numVal = (id: string): number => Number($(`#${id}`).attr("value") ?? "0");
  const checked = (id: string): boolean => $(`input[name="${id}"]`).attr("checked") !== undefined;
  const dayProg = (i: number): number => {
    const sel = $(`select[name="PDay0${i}"] option[selected]`).first().attr("value");
    return (sel !== undefined ? Number(sel) : 0) + 1; // device 0-indexed → 1-indexed
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
      minC: numVal("SPMin"),
    },
    flags: {
      auto: checked("Auto"),
      swow: checked("SWOW"),
      lock: checked("Lock"),
    },
    weekly: Number($('select[name="PWeek"] option[selected]').first().attr("value") ?? "0"),
    daysProgram: [0, 1, 2, 3, 4, 5, 6].map((i) => dayProg(i)) as RoomSetupSnapshot["daysProgram"],
  };
};

export interface DailyProgramSnapshot {
  /** 1..10 (the device stores it as `idProgDay` zero-based; we surface 1-based). */
  id: number;
  /** Exactly 96 quarter-hour bits (00:00–24:00). */
  bits: number[];
}

export interface WeeklyProgramSnapshot {
  /** 1..5 weekly slot. */
  id: number;
  /** Mon..Sun → daily slot id 1..10. */
  days: [number, number, number, number, number, number, number];
}

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(s);
  return m ? Number(m[0]) : null;
};

const jsVar = (script: string, name: string): number | null => {
  const re = new RegExp(`var\\s+${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`);
  const m = re.exec(script);
  return m ? Number(m[1]) : null;
};

const collectScripts = ($: cheerio.CheerioAPI): string =>
  $("script").map((_, el) => $(el).html() ?? "").get().join("\n");

// ─── dashboard ────────────────────────────────────────────────

export const parseDashboard = (html: string): DashboardSnapshot => {
  const $ = cheerio.load(html);

  const opSelected = $("#opMode option[selected]").attr("value")
    ?? $("#opMode option").first().attr("value")
    ?? "5";
  const elSelected = $("#energyL option[selected]").attr("value")
    ?? $("#energyL option").first().attr("value")
    ?? "2";

  // The dashboard has a single `<h3 class="textCenter">` carrying the outdoor
  // temperature (eg. "Temp. esterna. 16.6" in Italian, "Ext. temperature 16.6"
  // in English). We don't try to match the localized prefix — we just pull
  // the first signed decimal out of that one heading.
  const outdoorText = $("h3.textCenter").first().text();
  const outdoorMatch = /(-?\d+(?:\.\d+)?)/.exec(outdoorText);
  const outdoor = outdoorMatch ? Number(outdoorMatch[1]) : 0;
  const clock = $("h2.textCenter").first().text().trim();

  return {
    outdoorTemp: outdoor,
    clock,
    operatingMode: operatingModeFromDevice(Number(opSelected)),
    energyLevel: energyLevelFromDevice(Number(elSelected)),
  };
};

// ─── room list ────────────────────────────────────────────────

export const parseRoomList = (html: string): RoomListEntry[] => {
  const $ = cheerio.load(html);
  const out: RoomListEntry[] = [];
  $('form[action="room-operating.html"] button[name]').each((_, el) => {
    const zone = Number($(el).attr("name"));
    const name = $(el).find(".labelLeft").text().trim();
    const temp = num($(el).find(".labelRight").text()) ?? 0;
    if (Number.isFinite(zone)) out.push({ zone, name, temperature: temp });
  });
  return out;
};

// ─── room detail ──────────────────────────────────────────────

export const parseRoomDetail = (html: string): RoomDetailSnapshot => {
  const $ = cheerio.load(html);

  const zone = Number($('input[name="zone"]').attr("value") ?? "0");
  const name = $("#RoomName").attr("value")?.trim() ?? "";
  const temperature = num($("label.labelRight.roomName").text()) ?? 0;
  const humidity = num($('.spanHum label.labelRight').text()) ?? 0;
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

  // The fancoil button (`<svg id="FFF">`) is rendered by REHAU only when the
  // current system mode is compatible with this room's fancoil assignment:
  //   FanH = HC  → button always visible
  //   FanH = Heating only → visible only when system is in heating
  //   FanH = Cooling only → visible only when system is in cooling
  // This exactly matches what the REHAU UI shows the user, so it's the right
  // signal for "should the app expose fan controls?". hasFlap pairs with it
  // (the FFF popup combines speed + flap).
  const hasFan = $('#FFF').length > 0;
  const hasFlap = hasFan;
  // See `fanRunning` doc on RoomDetailSnapshot for the rationale.
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
    fanRunning,
  };
};

// ─── messages / alarms ────────────────────────────────────────

const severityFromChar = (c: string): AlarmSeverity => {
  switch (c.trim().toUpperCase()) {
    case "I": return "info";
    case "W": return "warning";
    case "E": return "error";
    case "C": return "critical";
    default:  return "info";
  }
};

const parseRehauTimestamp = (s: string): string => {
  // "2026/3/31 11:28" → ISO. Time may have single-digit hour.
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi] = m;
  const iso = new Date(
    Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi),
  ).toISOString();
  return iso;
};

export const parseMessages = (html: string): AlarmMessage[] => {
  const $ = cheerio.load(html);
  const out: AlarmMessage[] = [];
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
      resolvedAt: ended && /\d{4}/.test(ended) ? parseRehauTimestamp(ended) : null,
    });
  });
  return out;
};

// ─── programs ─────────────────────────────────────────────────

export const parseDailyProgram = (html: string): DailyProgramSnapshot => {
  const $ = cheerio.load(html);
  const idZero = Number($('input[name="idProgDay"]').attr("value") ?? "0");
  const id = idZero + 1;
  const raw = $('input[name="prog"]').attr("value") ?? "";
  const bits: number[] = [];
  for (let i = 0; i < 96; i++) bits.push(raw[i] === "1" ? 1 : 0);
  return { id, bits };
};

export const parseWeeklyProgram = (html: string): WeeklyProgramSnapshot => {
  const $ = cheerio.load(html);
  const id = Number($('input[name="weeklyProgram"]').attr("value") ?? "1");
  const days: number[] = [];
  for (let i = 0; i < 7; i++) {
    const sel = $(`select[name="PDay${i}"] option[selected]`).first().attr("value");
    const v = sel !== undefined ? Number(sel) : 0;
    days.push(v + 1);
  }
  return {
    id,
    days: days as [number, number, number, number, number, number, number],
  };
};

// ─── system info / firmware ───────────────────────────────────

// ─── installer-tier parsers ───────────────────────────────────

export interface CalibrationSnapshot {
  outdoor: number;
  rooms: RoomCalibration[];
}

export const parseCalibration = (html: string): CalibrationSnapshot => {
  const $ = cheerio.load(html);
  const outdoor = Number($('input[name="out00"]').attr("value") ?? "0");
  const rooms: RoomCalibration[] = [];
  for (let i = 0; i < 20; i++) {
    const idx = i.toString().padStart(2, "0");
    const air = $(`input[name="air${idx}"]`).attr("value");
    const hum = $(`input[name="humi${idx}"]`).attr("value");
    if (air === undefined && hum === undefined) continue;
    rooms.push({
      zone: i,
      tempOffset: Number(air ?? "0"),
      humidityOffset: Number(hum ?? "0"),
    });
  }
  return { outdoor, rooms };
};

export const parseUptime = (html: string): UptimeState => {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  // Language-agnostic match for "<N> <word> <N> <word> <N> <word>".
  // REHAU writes the uptime line as e.g.:
  //   English  "Controller running : 0 Year(s) 0 Day(s) 3 Hour(s)"
  //   Italian  "Sistema operativo da: 0 Anno 0 Giorno 2 Ora"
  //   German   "Steuerung läuft seit: 0 Jahr(e) 0 Tag(e) 3 Stunde(n)"
  //
  // Note the parentheses on the plural suffix (Year(s), Tag(e), …).
  // Previously we restricted the word to \p{L}+ (letters only), which
  // stopped at "(" and the regex never matched — every English/German
  // install showed 0 0 0. Now each "word" is any non-whitespace,
  // non-digit run, which absorbs parentheses, accents, etc.
  // See CLAUDE.md §6 — DO NOT re-introduce locale-specific text matches.
  const m = /(\d+)\s+[^\d\s]+\s+(\d+)\s+[^\d\s]+\s+(\d+)\s+[^\d\s]+/.exec(text);
  return {
    years: m ? Number(m[1]) : 0,
    days: m ? Number(m[2]) : 0,
    hours: m ? Number(m[3]) : 0,
  };
};

export const parseTopology = (html: string): Topology => {
  const $ = cheerio.load(html);
  const num = (name: string): number => Number($(`input[name="${name}"]`).attr("value") ?? "0");
  return {
    baseModules: num("ccDiag"),
    rModules: num("emr"),
    uModules: num("emu"),
    rooms: num("room"),
    mixedCircuits: num("mc"),
    dehumidifiers: num("dehu"),
  };
};

export const parseHeatCurve = (html: string): Omit<HeatCurveState, "meta"> => {
  const $ = cheerio.load(html);
  const num = (name: string): number => Number($(`input[name="${name}"]`).attr("value") ?? "0");
  return {
    slopeNormal: num("HC00"),
    slopeAbsent: num("HD00"),
    startNormal: num("HA00"),
    startAbsent: num("HB00"),
    reductionK: num("HR0"),
    minFlowNormalC: num("HF00"),
    minFlowAbsentC: num("HG00"),
    maxFlowNormalC: num("HI00"),
    maxFlowAbsentC: num("HK00"),
  };
};

export const parseIO = (html: string): IOSnapshot => {
  const $ = cheerio.load(html);
  const master: IOSnapshot["master"] = { rz: [], relay: [], di: [] };
  const umodules: IOSnapshot["umodules"] = {};

  // Walk h3 + label nodes in DOM order so each label is attributed to the
  // module section it sits under.
  let target: "master" | string | null = null;
  let umoduleData: IOSnapshot["umodules"][string] | null = null;

  const parseList = (text: string): number[] => {
    const after = text.split(":").slice(1).join(":");
    return after
      .trim()
      .split(/\s+/)
      .map((p) => Number(p.replace(/°C|%/g, "")))
      .filter((n) => Number.isFinite(n));
  };
  const parseAiC = (text: string): (number | null)[] => {
    const after = text.split(":").slice(1).join(":");
    return after
      .trim()
      .split(/\s+/)
      .map((p) => (p.startsWith("--") ? null : Number(p.replace(/°C/g, ""))));
  };

  $("h3, label").each((_, el) => {
    const $el = $(el);
    if (el.type === "tag" && el.name === "h3") {
      const t = $el.text().trim();
      if (/master/i.test(t)) {
        target = "master";
        umoduleData = null;
      } else {
        // Any other section heading on the I/O page is a U-module. REHAU
        // labels it "Modulo-U N" in Italian, "U-Module N" in English, etc.
        // — the only universal signal is the trailing index number, so we
        // match that instead of the localized prefix.
        const m = /(\d+)\s*$/.exec(t);
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

export const parseSystemInfo = (html: string): SystemInfoSnapshot => {
  const $ = cheerio.load(html);
  const text = $("body").text();

  // "Unique code" and "Master:" are emitted in English by every REHAU
  // firmware language pack — they're technical labels REHAU doesn't
  // translate. Pulling them out of the flat body text is reliable.
  const uniqueCode = (/Unique code\s*:\s*([0-9a-f]+)/i.exec(text)?.[1] ?? "").trim();
  const master = (/Master:\s*([\d.]+)/.exec(text)?.[1] ?? "").trim();

  // The web/U-module firmware lines DO carry a localized prefix
  // ("Versione pagina Web 0.25", "Versione Modulo-U 0: 1.2" in Italian;
  // "Web page version 0.25", "U-Module 0 version: 1.2" in English, etc.).
  // To stay language-agnostic we iterate the page's <label> elements and
  // classify by structure: "N: X.Y" → umodule N, lone "X.Y" → web.
  const umodules: Record<string, string> = {};
  let web = "";
  $("label").each((_, el) => {
    const t = $(el).text().trim();
    if (!t || /master/i.test(t)) return;
    // "...0: 1. 2" → umodule 0 with version 1.2 (spaces in version OK).
    const um = /\b(\d+)\s*:\s*([\d.\s]+?)\s*$/.exec(t);
    if (um) {
      umodules[`umodule${um[1]}`] = (um[2] ?? "").replace(/\s+/g, "");
      return;
    }
    // Trailing "X.Y" with no preceding "N:" → web pages firmware. Take the
    // first such label we encounter (REHAU emits exactly one).
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
    outdoorOffset: Number($("#HLS").attr("value") ?? "0"),
  };
};
