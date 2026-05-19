import type { EnergyLevel, RoomMode, SystemMode } from "@rehau/types";
import { i18n } from "./i18n";

// Translation helpers. Components inside a React render tree should prefer
// `useTranslation`/`t(...)` directly; these are for non-hook callers (toast
// payloads, formatters, mocks).

export const labelSystemMode = (m: SystemMode): string => i18n.t(`modes.${m}`);

export const labelEnergyLevel = (l: EnergyLevel): string => i18n.t(`energy.${l}`);

export const labelRoomMode = (m: RoomMode): string => i18n.t(`roomMode.${m}`);

export const fmtClock = (d: Date = new Date()): string =>
  d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");

export const fmtRelTime = (iso: string): string => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return i18n.t("rel.secondsAgo", { n: s });
  if (s < 3600) return i18n.t("rel.minutesAgo", { n: Math.floor(s / 60) });
  if (s < 86_400) return i18n.t("rel.hoursAgo", { n: Math.floor(s / 3600) });
  return i18n.t("rel.daysAgo", { n: Math.floor(s / 86_400) });
};

export const staleSec = (iso: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
