// Generic installer-settings layer.
//
// Every REHAU installer page (circSett, hCSett, deviSett, funcSett, advSett,
// installer-fanc-settings) is just a flat HTML form with named number /
// checkbox inputs that all POST back to `/installer-setting.html` with a
// distinguishing `formKey` hidden field.
//
// Rather than write one parser/source-method per page we keep the field
// catalogue here and let the bridge handle any group uniformly.

import * as cheerio from "cheerio";
import type {
  InstallerSettingField,
  InstallerSettingsGroup,
  InstallerSettingsSnapshot,
} from "@rehau/types";

/** Field metadata as declared by us (matches the REHAU input attributes).
 *
 * No human-readable `label` lives here: the field `name` (e.g. "HA00") is a
 * stable id and the web SPA localises it via `settings.fields.<name>` in
 * apps/web/src/lib/i18n.ts. Keeping labels server-side would hard-code one
 * language (it was Italian-only) regardless of the user's chosen UI language. */
interface FieldDef {
  name: string;
  kind: "number" | "boolean";
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

interface GroupDef {
  /** REHAU page to GET for reading the current values. */
  path: string;
  /** Hidden form key sent on POST to /installer-setting.html. */
  formKey: string;
  fields: FieldDef[];
}

// ─── Field catalogue ─────────────────────────────────────────

const CURVE: FieldDef[] = [
  { name: "HA00", kind: "number", min: 10, max: 40, step: 1, unit: "°C" },
  { name: "HB00", kind: "number", min: 10, max: 40, step: 1, unit: "°C" },
  { name: "HC00", kind: "number", min: 0, max: 5, step: 0.01 },
  { name: "HD00", kind: "number", min: 0, max: 5, step: 0.01 },
  { name: "HR0",  kind: "number", min: 0, max: 10, step: 1, unit: "K" },
  { name: "HF00", kind: "number", min: 15, max: 50, step: 1, unit: "°C" },
  { name: "HG00", kind: "number", min: 15, max: 50, step: 1, unit: "°C" },
  { name: "HI00", kind: "number", min: 20, max: 70, step: 1, unit: "°C" },
  { name: "HK00", kind: "number", min: 20, max: 70, step: 1, unit: "°C" },
  { name: "HL00", kind: "number", min: 0, max: 99, step: 1 },
  { name: "CA0",  kind: "number", min: 8, max: 25, step: 0.1, unit: "°C" },
  { name: "CB0",  kind: "number", min: -5, max: 10, step: 0.1, unit: "K" },
  { name: "CD0",  kind: "number", min: 10, max: 25, step: 0.1, unit: "°C" },
  { name: "MIX10", kind: "number", min: 2, max: 80, step: 0.5, unit: "K" },
  { name: "MIX20", kind: "number", min: 2, max: 80, step: 0.5, unit: "K" },
  { name: "MIX30", kind: "number", min: 0, max: 999, step: 1 },
  { name: "MIX60", kind: "number", min: 0, max: 999, step: 1 },
];

const HEATCOOL: FieldDef[] = [
  { name: "Tout", kind: "number", min: 0, max: 99, step: 1 },
  { name: "HG1",  kind: "number", min: 5, max: 25, step: 0.1, unit: "°C" },
  { name: "HG2",  kind: "number", min: 5, max: 25, step: 0.1, unit: "°C" },
  { name: "C01",  kind: "number", min: 0, max: 1440, step: 10, unit: "min" },
  { name: "C02",  kind: "number", min: 0, max: 1440, step: 10, unit: "min" },
  { name: "C03",  kind: "number", min: 0, max: 96, step: 1, unit: "h" },
  { name: "C12",  kind: "boolean" },
];

const DEVICES: FieldDef[] = [
  { name: "HE1",  kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "HE4",  kind: "number", min: 0, max: 10, step: 1, unit: "min" },
  { name: "HE5",  kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "CH1",  kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "CH4",  kind: "number", min: 0, max: 10, step: 1, unit: "min" },
  { name: "CH5",  kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "PU6",  kind: "number", min: 1, max: 30, step: 1, unit: "min" },
  { name: "VA2",  kind: "number", min: 1, max: 200, step: 1, unit: "days" },
  { name: "HE20", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "HE30", kind: "number", min: 0, max: 25, step: 1, unit: "%" },
  { name: "CH20", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "CH30", kind: "number", min: 0, max: 25, step: 1, unit: "%" },
  { name: "MI70", kind: "boolean" },
  { name: "PU75", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "PU85", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
];

const FUNCTIONS: FieldDef[] = [
  { name: "PU20", kind: "boolean" },
  { name: "PU25", kind: "boolean" },
  { name: "PU3",  kind: "boolean" },
  { name: "PU4",  kind: "number", min: 1, max: 200, step: 1, unit: "days" },
  { name: "PU5",  kind: "number", min: 0, max: 24, step: 1, unit: "h" },
  { name: "VA1",  kind: "boolean" },
  { name: "VA3",  kind: "number", min: 0, max: 24, step: 1, unit: "h" },
  { name: "VA4",  kind: "number", min: 1, max: 30, step: 1, unit: "min" },
];

const PID: FieldDef[] = [
  { name: "a0", kind: "number", min: 0, max: 10, step: 0.1, unit: "K" },
  { name: "b0", kind: "number", min: 0, max: 10, step: 0.1, unit: "K" },
  { name: "c0", kind: "number", min: 10, max: 120, step: 10, unit: "min" },
  { name: "d0", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "e0", kind: "number", min: 0, max: 600, step: 5 },
  { name: "f0", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "g0", kind: "number", min: 0, max: 10, step: 1 },
  { name: "h0", kind: "number", min: 50, max: 100, step: 1, unit: "%" },
  { name: "i0", kind: "number", min: -50, max: 50, step: 1, unit: "%" },
];

const FANCOIL: FieldDef[] = [
  { name: "FCMT", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "FCXT", kind: "number", min: 10, max: 241, step: 1, unit: "min" },
  { name: "FCPT", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
];

const GROUPS: Record<InstallerSettingsGroup, GroupDef> = {
  curve:     { path: "/circSett.html",                formKey: "MCSettings",    fields: CURVE     },
  heatcool:  { path: "/hCSett.html",                  formKey: "heatcoolSett",  fields: HEATCOOL  },
  devices:   { path: "/deviSett.html",                formKey: "Devices",       fields: DEVICES   },
  functions: { path: "/funcSett.html",                formKey: "Functions",     fields: FUNCTIONS },
  pid:       { path: "/advSett.html",                 formKey: "AdvSett",       fields: PID       },
  fancoil:   { path: "/installer-fanc-settings.html", formKey: "Devices",       fields: FANCOIL   },
};

export const settingsGroupDef = (group: InstallerSettingsGroup): GroupDef => GROUPS[group];

// ─── Number formatting that mirrors the REHAU input precision ──────

const formatForDevice = (n: number, step: number): string => {
  if (step >= 1) return Math.round(n).toString();
  if (step >= 0.1) return n.toFixed(1);
  if (step >= 0.01) return n.toFixed(2);
  return String(n);
};

// ─── Parsing ─────────────────────────────────────────────────

export const parseSettings = (
  group: InstallerSettingsGroup,
  html: string,
): Omit<InstallerSettingsSnapshot, "meta"> => {
  const def = GROUPS[group];
  const $ = cheerio.load(html);
  const fields: InstallerSettingField[] = def.fields.map((f) => {
    if (f.kind === "boolean") {
      const checked = $(`input[name="${f.name}"]`).attr("checked");
      const out: InstallerSettingField = { ...f, value: checked !== undefined };
      return out;
    }
    const raw = $(`input[name="${f.name}"]`).attr("value");
    const v = raw !== undefined && raw !== "" ? Number(raw) : (f.min ?? 0);
    const out: InstallerSettingField = { ...f, value: Number.isFinite(v) ? v : (f.min ?? 0) };
    return out;
  });
  return { group, fields };
};

// ─── Writing: merge patch into current snapshot, produce form ──────

export const buildSettingsForm = (
  group: InstallerSettingsGroup,
  fields: InstallerSettingField[],
): Record<string, string> => {
  const def = GROUPS[group];
  const form: Record<string, string> = { [def.formKey]: "" };
  for (const f of fields) {
    const defField = def.fields.find((d) => d.name === f.name);
    if (!defField) continue;
    if (defField.kind === "boolean") {
      // HTML form semantics: unchecked checkboxes are omitted from the POST.
      if (f.value === true) form[f.name] = "on";
    } else {
      form[f.name] = formatForDevice(Number(f.value), defField.step ?? 1);
    }
  }
  return form;
};

/** Merge a patch onto a snapshot's fields, returning a new field list. */
export const mergeSettings = (
  current: InstallerSettingField[],
  patch: Array<{ name: string; value: number | boolean }>,
): InstallerSettingField[] => {
  const m = new Map(current.map((f) => [f.name, f] as const));
  for (const p of patch) {
    const cur = m.get(p.name);
    if (cur) m.set(p.name, { ...cur, value: p.value });
  }
  return [...m.values()];
};
