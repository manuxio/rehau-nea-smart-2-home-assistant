import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseDailyProgram,
  parseDashboard,
  parseMessages,
  parseRoomDetail,
  parseRoomList,
  parseSystemInfo,
  parseUptime,
  parseWeeklyProgram,
} from "./parsers.js";

const FIXTURES = resolve(import.meta.dirname, "../../../../tests/fixtures/fw-6.15");
const read = (n: string): string => readFileSync(resolve(FIXTURES, n), "utf8");

describe("parseDashboard", () => {
  it("extracts outdoor temp, clock, operating + energy modes", () => {
    const out = parseDashboard(read("dashboard.html"));
    expect(out.outdoorTemp).toBe(19.0);
    expect(out.clock).toBe("2026-05-18 14:32");
    expect(out.operatingMode).toBe("manual_heating");
    expect(out.energyLevel).toBe("standby");
  });
});

describe("parseRoomList", () => {
  it("lists 4 zones with name + temp", () => {
    const out = parseRoomList(read("room-page.html"));
    expect(out).toEqual([
      { zone: 0, name: "Arianna", temperature: 22.5 },
      { zone: 1, name: "Manu",    temperature: 23.8 },
      { zone: 2, name: "Cucina",  temperature: 24.7 },
      { zone: 3, name: "Salone",  temperature: 21.7 },
    ]);
  });
});

describe("parseRoomDetail", () => {
  it("zone 0 — standby", () => {
    const out = parseRoomDetail(read("room-operating-0.html"));
    expect(out.zone).toBe(0);
    expect(out.name).toBe("Arianna");
    expect(out.temperature).toBe(22.5);
    expect(out.humidity).toBe(47);
    expect(out.setpoint).toBe(20.0);
    expect(out.setpointHeatingNormal).toBe(20.0);
    expect(out.setpointHeatingReduced).toBe(18.5);
    expect(out.setpointStandby).toBe(23.0);
    expect(out.mode).toBe("standby");
    expect(out.fan).toBe(1);
  });

  it("zone 3 — program mode + light", () => {
    const out = parseRoomDetail(read("room-operating-3.html"));
    expect(out.zone).toBe(3);
    expect(out.name).toBe("Salone");
    expect(out.mode).toBe("program");
    expect(out.programActive).toBe(0);
    expect(out.light).toBe(false);
    expect(out.hasLight).toBe(true);
  });

  it("zone 0 — no lightH field → hasLight false", () => {
    const out = parseRoomDetail(read("room-operating-0.html"));
    expect(out.hasLight).toBe(false);
  });
});

describe("parseMessages", () => {
  it("parses 4 rows including severity codes", () => {
    const out = parseMessages(read("messages.html"));
    expect(out.length).toBe(4);
    expect(out[0]?.severity).toBe("warning");
    expect(out[0]?.source).toBe("MC 1");
    expect(out[0]?.code).toBe("2/02/06/06/01/051/3");
    expect(out[3]?.severity).toBe("error");
    expect(out[3]?.source).toBe("Base");
    expect(out[3]?.code).toBe("4/00/00/01/00/200/3");
  });
});

describe("parseDailyProgram", () => {
  it("decodes id (1-based) and 96 bits", () => {
    const html = `<html><body><form action="user-daily-program.html" method="post">
      <input name="pDaily" type="hidden">
      <input name="idProgDay" type="hidden" value="0" id="hidden">
      <input id="prog" name="prog" type="hidden" value="${"0".repeat(24)}${"1".repeat(12)}${"0".repeat(32)}${"1".repeat(24)}${"0".repeat(4)}">
    </form></body></html>`;
    const p = parseDailyProgram(html);
    expect(p.id).toBe(1);
    expect(p.bits.length).toBe(96);
    expect(p.bits.slice(24, 36).every((b) => b === 1)).toBe(true);
    expect(p.bits.slice(0, 24).every((b) => b === 0)).toBe(true);
  });
});

describe("parseUptime", () => {
  // REHAU writes the line in whichever UI language the device is set to,
  // sometimes with parentheses around the plural suffix ("Year(s)").
  // The parser must extract <years, days, hours> from all of these.
  const wrap = (s: string) =>
    `<html><body><h1>System statistics</h1><p>${s}</p></body></html>`;
  it("English with parens", () => {
    expect(parseUptime(wrap("Controller running : 0 Year(s) 0 Day(s) 3 Hour(s)"))).toEqual({
      years: 0,
      days: 0,
      hours: 3,
    });
  });
  it("Italian", () => {
    expect(parseUptime(wrap("Sistema operativo da: 0 Anno 14 Giorno 6 Ora"))).toEqual({
      years: 0,
      days: 14,
      hours: 6,
    });
  });
  it("German with parens", () => {
    expect(parseUptime(wrap("Steuerung läuft seit: 1 Jahr(e) 3 Tag(e) 12 Stunde(n)"))).toEqual({
      years: 1,
      days: 3,
      hours: 12,
    });
  });
  it("returns zeros when no match found", () => {
    expect(parseUptime(wrap("Nothing here"))).toEqual({ years: 0, days: 0, hours: 0 });
  });
});

describe("parseWeeklyProgram", () => {
  it("decodes id and 7 days (1-based)", () => {
    const html = `<html><body><form action="user-weekly-program.html" method="post">
      <input name="pWeek" type="hidden">
      <input name="weeklyProgram" type="hidden" value="2" id="hidden">
      ${[0, 0, 0, 0, 0, 1, 1].map((sel, i) => `
        <select name="PDay${i}">
          ${[0, 1, 2].map((v) => `<option value="${v}"${v === sel ? " selected" : ""}>${v + 1}</option>`).join("")}
        </select>`).join("")}
    </form></body></html>`;
    const p = parseWeeklyProgram(html);
    expect(p.id).toBe(2);
    expect(p.days).toEqual([1, 1, 1, 1, 1, 2, 2]);
  });
});

describe("parseSystemInfo", () => {
  it("extracts unique code + firmware versions + season window", () => {
    const out = parseSystemInfo(read("user-config-installer.html"));
    expect(out.uniqueCode).toBe("aabbccdd00112233445566778899aabbccddeeff00112233");
    expect(out.fw.master).toBe("6.15");
    expect(out.fw.web).toBe("0.25");
    expect(out.fw.umodules).toEqual({ umodule0: "1.2" });
    expect(out.seasonStart).toBe("10-01");
    expect(out.seasonEnd).toBe("05-01");
    expect(out.outdoorOffset).toBe(0);
  });
});
