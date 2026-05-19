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

/** Field metadata as declared by us (matches the REHAU input attributes). */
interface FieldDef {
  name: string;
  label: string;
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
  { name: "HA00", label: "Punto di partenza normale", kind: "number", min: 10, max: 40, step: 1, unit: "°C" },
  { name: "HB00", label: "Punto di partenza assenza", kind: "number", min: 10, max: 40, step: 1, unit: "°C" },
  { name: "HC00", label: "Pendenza normale", kind: "number", min: 0, max: 5, step: 0.01 },
  { name: "HD00", label: "Pendenza assenza", kind: "number", min: 0, max: 5, step: 0.01 },
  { name: "HR0",  label: "Riduzione mandata in modo ridotto", kind: "number", min: 0, max: 10, step: 1, unit: "K" },
  { name: "HF00", label: "Min mandata normale", kind: "number", min: 15, max: 50, step: 1, unit: "°C" },
  { name: "HG00", label: "Min mandata assenza", kind: "number", min: 15, max: 50, step: 1, unit: "°C" },
  { name: "HI00", label: "Max mandata normale", kind: "number", min: 20, max: 70, step: 1, unit: "°C" },
  { name: "HK00", label: "Max mandata assenza", kind: "number", min: 20, max: 70, step: 1, unit: "°C" },
  { name: "HL00", label: "Filtro temp. esterna", kind: "number", min: 0, max: 99, step: 1 },
  { name: "CA0",  label: "Min mandata raffrescamento", kind: "number", min: 8, max: 25, step: 0.1, unit: "°C" },
  { name: "CB0",  label: "Distanza dal punto di rugiada", kind: "number", min: -5, max: 10, step: 0.1, unit: "K" },
  { name: "CD0",  label: "Limite ritorno raffrescamento", kind: "number", min: 10, max: 25, step: 0.1, unit: "°C" },
  { name: "MIX10", label: "Banda proporzionale heating", kind: "number", min: 2, max: 80, step: 0.5, unit: "K" },
  { name: "MIX20", label: "Banda proporzionale cooling", kind: "number", min: 2, max: 80, step: 0.5, unit: "K" },
  { name: "MIX30", label: "Tempo integrale miscelatore", kind: "number", min: 0, max: 999, step: 1 },
  { name: "MIX60", label: "Ritardo avviamento PI", kind: "number", min: 0, max: 999, step: 1 },
];

const HEATCOOL: FieldDef[] = [
  { name: "Tout", label: "Filtro temp. esterna", kind: "number", min: 0, max: 99, step: 1 },
  { name: "HG1",  label: "Limite riscaldamento normale", kind: "number", min: 5, max: 25, step: 0.1, unit: "°C" },
  { name: "HG2",  label: "Limite riscaldamento assenza", kind: "number", min: 5, max: 25, step: 0.1, unit: "°C" },
  { name: "C01",  label: "Ritardo avvio raffrescamento", kind: "number", min: 0, max: 1440, step: 10, unit: "min" },
  { name: "C02",  label: "Tempo min raffrescamento", kind: "number", min: 0, max: 1440, step: 10, unit: "min" },
  { name: "C03",  label: "Blocco riscaldamento dopo raffrescamento", kind: "number", min: 0, max: 96, step: 1, unit: "h" },
  { name: "C12",  label: "Compensazione estiva", kind: "boolean" },
];

const DEVICES: FieldDef[] = [
  { name: "HE1",  label: "Caldaia · tempo min funzionamento", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "HE4",  label: "Caldaia · ritardo richiesta", kind: "number", min: 0, max: 10, step: 1, unit: "min" },
  { name: "HE5",  label: "Caldaia · lockout prima del riavvio", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "CH1",  label: "Chiller · tempo min funzionamento", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "CH4",  label: "Chiller · ritardo richiesta", kind: "number", min: 0, max: 10, step: 1, unit: "min" },
  { name: "CH5",  label: "Chiller · lockout prima del riavvio", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "PU6",  label: "Antibloccaggio pompa · durata", kind: "number", min: 1, max: 30, step: 1, unit: "min" },
  { name: "VA2",  label: "Antibloccaggio valvola · periodo", kind: "number", min: 1, max: 200, step: 1, unit: "giorni" },
  { name: "HE20", label: "Valvola misc. · posizione richiesta riscaldamento", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "HE30", label: "Valvola misc. · isteresi richiesta riscaldamento", kind: "number", min: 0, max: 25, step: 1, unit: "%" },
  { name: "CH20", label: "Valvola misc. · posizione richiesta raffrescamento", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "CH30", label: "Valvola misc. · isteresi richiesta raffrescamento", kind: "number", min: 0, max: 25, step: 1, unit: "%" },
  { name: "MI70", label: "Inverti segnale di controllo", kind: "boolean" },
  { name: "PU75", label: "Pompa misc. · ritardo avviamento", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
  { name: "PU85", label: "Pompa misc. · post funzionamento", kind: "number", min: 0, max: 15, step: 1, unit: "min" },
];

const FUNCTIONS: FieldDef[] = [
  { name: "PU20", label: "Master · pompa alta efficienza", kind: "boolean" },
  { name: "PU25", label: "Circuito misc. · pompa alta efficienza", kind: "boolean" },
  { name: "PU3",  label: "Antibloccaggio pompa abilitato", kind: "boolean" },
  { name: "PU4",  label: "Antibloccaggio pompa · periodo", kind: "number", min: 1, max: 200, step: 1, unit: "giorni" },
  { name: "PU5",  label: "Antibloccaggio pompa · orario", kind: "number", min: 0, max: 24, step: 1, unit: "h" },
  { name: "VA1",  label: "Antibloccaggio valvola abilitato", kind: "boolean" },
  { name: "VA3",  label: "Antibloccaggio valvola · orario", kind: "number", min: 0, max: 24, step: 1, unit: "h" },
  { name: "VA4",  label: "Antibloccaggio valvola · durata", kind: "number", min: 1, max: 30, step: 1, unit: "min" },
];

const PID: FieldDef[] = [
  { name: "a0", label: "Banda proporzionale heating", kind: "number", min: 0, max: 10, step: 0.1, unit: "K" },
  { name: "b0", label: "Banda proporzionale cooling", kind: "number", min: 0, max: 10, step: 0.1, unit: "K" },
  { name: "c0", label: "Tempo impulso ambiente", kind: "number", min: 10, max: 120, step: 10, unit: "min" },
  { name: "d0", label: "Tempo impulso min ambiente", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "e0", label: "Tempo integrale ambiente", kind: "number", min: 0, max: 600, step: 5 },
  { name: "f0", label: "Limitazione parte integrale", kind: "number", min: 0, max: 100, step: 1, unit: "%" },
  { name: "g0", label: "Fattore di ottimizzazione", kind: "number", min: 0, max: 10, step: 1 },
  { name: "h0", label: "Limite durata impulso in continua", kind: "number", min: 50, max: 100, step: 1, unit: "%" },
  { name: "i0", label: "Spostamento banda proporzionale", kind: "number", min: -50, max: 50, step: 1, unit: "%" },
];

const FANCOIL: FieldDef[] = [
  { name: "FCMT", label: "Tempo minimo funzionamento", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
  { name: "FCXT", label: "Tempo massimo funzionamento", kind: "number", min: 10, max: 241, step: 1, unit: "min" },
  { name: "FCPT", label: "Tempo minimo di pausa", kind: "number", min: 0, max: 20, step: 1, unit: "min" },
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
