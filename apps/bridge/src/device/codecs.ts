// Encoding/decoding helpers between REHAU device semantics and our domain.
// All bridge code MUST go through these — keeps the quirks in one place.

/** Quantize a temperature to 0.5 °C steps. */
export const quantizeSetpoint = (c: number): number => Math.round(c * 2) / 2;

/**
 * The REHAU web UI sends setpoints as BOTH:
 *  - `RSH` in °C (0.5 step, range 5..31 heat / 15..35 cool), and
 *  - `temp` as `round((°C * 9/5 + 32) * 10)` (i.e. °F × 10 as integer).
 * The firmware appears to read only one of them, but we mirror the UI exactly.
 */
export const setpointToDeviceForm = (
  c: number,
  mode: "standby" | "normal" | "reduced" | "program" | "program_override",
): { RSH: string; temp: string } => {
  // The UI uses the literal "a" for RSH when entering standby.
  if (mode === "standby") return { RSH: "a", temp: "0" };
  const q = quantizeSetpoint(c);
  // Mirror the UI: `Math.round((°C * 9/5 + 32) * 10)`. The `*10` is INSIDE the
  // round, otherwise we drift by ~0.1 °C on round-trip.
  const tempIntF10 = Math.round((q * 9 / 5 + 32) * 10);
  return { RSH: q.toFixed(1), temp: String(tempIntF10) };
};

/** REHAU `initialState` (0..7) → our `RoomMode`. */
export const deviceStateToRoomMode = (
  s: number,
): "normal" | "reduced" | "standby" | "program" | "program_override" => {
  switch (s) {
    case 0: return "normal";
    case 1: return "reduced";
    case 2: return "standby";
    case 3: // program-day
    case 4: // program-current
      return "program";
    case 5: return "program_override";
    case 6:
    case 7:
      // Party / forced — surfaced as override for now.
      return "program_override";
    default: return "standby";
  }
};

/** Reverse of {@link deviceStateToRoomMode} for writes (POST `mode` field). */
export const roomModeToDeviceMode = (
  m: "normal" | "reduced" | "standby" | "program" | "program_override",
): string => {
  switch (m) {
    case "normal":          return "normal";
    case "reduced":         return "reduced";
    case "standby":         return "standby";
    case "program":         return "program";
    case "program_override":return "programO";
  }
};

export const operatingModeFromDevice = (n: number):
  | "heating_only" | "cooling_only" | "manual_heating" | "manual_cooling" => {
  switch (n) {
    case 1: return "heating_only";
    case 2: return "cooling_only";
    case 5: return "manual_heating";
    case 6: return "manual_cooling";
    default: return "manual_heating";
  }
};

export const operatingModeToDevice = (
  m: "heating_only" | "cooling_only" | "manual_heating" | "manual_cooling",
): number => {
  switch (m) {
    case "heating_only":    return 1;
    case "cooling_only":    return 2;
    case "manual_heating":  return 5;
    case "manual_cooling":  return 6;
  }
};

export const energyLevelFromDevice = (n: number):
  | "normal" | "reduced" | "standby" | "auto" | "vacation" => {
  switch (n) {
    case 0: return "normal";
    case 1: return "reduced";
    case 2: return "standby";
    case 3: return "auto";
    case 4: return "vacation";
    default: return "standby";
  }
};

export const energyLevelToDevice = (
  l: "normal" | "reduced" | "standby" | "auto" | "vacation",
): number => {
  switch (l) {
    case "normal":   return 0;
    case "reduced":  return 1;
    case "standby":  return 2;
    case "auto":     return 3;
    case "vacation": return 4;
  }
};

// ───────────── daily program: 96 bits ↔ {start,end}[] ─────────────

const pad2 = (n: number): string => n.toString().padStart(2, "0");

/** Quarter-hour index (0..96) → "HH:MM". 96 is rendered as "24:00". */
export const quarterToHHMM = (q: number): string => {
  if (q === 96) return "24:00";
  const h = Math.floor(q / 4);
  const m = (q % 4) * 15;
  return `${pad2(h)}:${pad2(m)}`;
};

/** "HH:MM" → quarter-hour index (0..96). Throws on misalignment. */
export const hhmmToQuarter = (s: string): number => {
  const m = /^([01]?\d|2[0-4]):([0-5]\d)$/.exec(s);
  if (!m) throw new Error(`bad time: ${s}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min % 15 !== 0) throw new Error(`time must be on a 15-min boundary: ${s}`);
  return h * 4 + min / 15;
};

export const bitsToIntervals = (bits: number[]): { start: string; end: string }[] => {
  if (bits.length !== 96) throw new Error(`bits must be length 96, got ${bits.length}`);
  const out: { start: string; end: string }[] = [];
  let runStart: number | null = null;
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

export const intervalsToBits = (intervals: { start: string; end: string }[]): number[] => {
  const bits = new Array(96).fill(0);
  for (const { start, end } of intervals) {
    const a = hhmmToQuarter(start);
    const b = hhmmToQuarter(end);
    if (b <= a) throw new Error(`interval end must be after start: ${start}..${end}`);
    for (let i = a; i < b; i++) bits[i] = 1;
  }
  return bits;
};
