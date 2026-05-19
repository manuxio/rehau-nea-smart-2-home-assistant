import { describe, expect, it } from "vitest";
import {
  bitsToIntervals,
  deviceStateToRoomMode,
  energyLevelFromDevice,
  hhmmToQuarter,
  intervalsToBits,
  operatingModeFromDevice,
  operatingModeToDevice,
  quantizeSetpoint,
  quarterToHHMM,
  roomModeToDeviceMode,
  setpointToDeviceForm,
} from "./codecs.js";

describe("setpoint encoding", () => {
  it("quantizes to 0.5 step", () => {
    expect(quantizeSetpoint(20.24)).toBe(20.0);
    expect(quantizeSetpoint(20.25)).toBe(20.5);
    expect(quantizeSetpoint(21)).toBe(21.0);
  });

  it("encodes 20.0 °C → RSH=20.0 temp=680 (°F×10)", () => {
    expect(setpointToDeviceForm(20, "normal")).toEqual({ RSH: "20.0", temp: "680" });
  });

  it("encodes 21.0 °C → temp=698 (round((21.0*9/5+32)*10))", () => {
    // Critical: the *10 must be inside the round to mirror the device UI.
    expect(setpointToDeviceForm(21, "normal")).toEqual({ RSH: "21.0", temp: "698" });
  });

  it("encodes 21.5 °C → temp = round((21.5*9/5+32)*10) = 707", () => {
    expect(setpointToDeviceForm(21.5, "normal")).toEqual({ RSH: "21.5", temp: "707" });
  });

  it("uses RSH=a literal for standby", () => {
    expect(setpointToDeviceForm(20, "standby")).toEqual({ RSH: "a", temp: "0" });
  });
});

describe("mode encoding", () => {
  it("decodes device initialState values", () => {
    expect(deviceStateToRoomMode(0)).toBe("normal");
    expect(deviceStateToRoomMode(1)).toBe("reduced");
    expect(deviceStateToRoomMode(2)).toBe("standby");
    expect(deviceStateToRoomMode(3)).toBe("program");
    expect(deviceStateToRoomMode(4)).toBe("program");
    expect(deviceStateToRoomMode(5)).toBe("program_override");
  });

  it("encodes our mode → device form (programO for override)", () => {
    expect(roomModeToDeviceMode("program_override")).toBe("programO");
    expect(roomModeToDeviceMode("normal")).toBe("normal");
  });
});

describe("system + energy enums", () => {
  it("operating mode round-trips", () => {
    for (const m of ["heating_only", "cooling_only", "manual_heating", "manual_cooling"] as const) {
      expect(operatingModeFromDevice(operatingModeToDevice(m))).toBe(m);
    }
  });

  it("energy level decode", () => {
    expect(energyLevelFromDevice(2)).toBe("standby");
    expect(energyLevelFromDevice(4)).toBe("vacation");
  });
});

describe("daily program: bits ↔ intervals", () => {
  it("quarter ↔ HH:MM", () => {
    expect(quarterToHHMM(0)).toBe("00:00");
    expect(quarterToHHMM(24)).toBe("06:00");
    expect(quarterToHHMM(94)).toBe("23:30");
    expect(quarterToHHMM(96)).toBe("24:00");
    expect(hhmmToQuarter("06:00")).toBe(24);
    expect(hhmmToQuarter("24:00")).toBe(96);
  });

  it("rejects non-quarter-aligned times", () => {
    expect(() => hhmmToQuarter("06:10")).toThrow();
  });

  it("decodes a morning + evening pattern", () => {
    const bits = new Array(96).fill(0);
    for (let i = 24; i < 36; i++) bits[i] = 1;   // 06:00..09:00
    for (let i = 68; i < 92; i++) bits[i] = 1;   // 17:00..23:00
    expect(bitsToIntervals(bits)).toEqual([
      { start: "06:00", end: "09:00" },
      { start: "17:00", end: "23:00" },
    ]);
  });

  it("round-trips intervals → bits → intervals", () => {
    const ints = [
      { start: "06:00", end: "09:00" },
      { start: "17:00", end: "23:00" },
    ];
    expect(bitsToIntervals(intervalsToBits(ints))).toEqual(ints);
  });

  it("handles a full-day run", () => {
    const bits = new Array(96).fill(1);
    expect(bitsToIntervals(bits)).toEqual([{ start: "00:00", end: "24:00" }]);
  });

  it("rejects bad length", () => {
    expect(() => bitsToIntervals([1, 0, 1])).toThrow();
  });

  it("rejects intervals with end <= start", () => {
    expect(() => intervalsToBits([{ start: "10:00", end: "10:00" }])).toThrow();
  });
});
