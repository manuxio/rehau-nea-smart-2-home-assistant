// User preferences (theme + language + UI scale) persisted in localStorage
// and exposed via a tiny context. The app shell binds `data-theme` to <html>
// so CSS vars can flip between light and dark; uiScale writes to the
// `--ui-scale` CSS variable on <html> so the rem baseline grows
// proportionally (see index.css).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { i18n } from "./i18n";

type Theme = "dark" | "light";
type Lang = "it" | "en";

interface PrefsValue {
  theme: Theme;
  lang: Lang;
  /** Multiplier on the rem baseline (1.0 = default OS size). */
  uiScale: number;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  setUiScale: (s: number) => void;
}

const Ctx = createContext<PrefsValue | null>(null);

const readTheme = (): Theme => {
  const s = localStorage.getItem("rehau.theme");
  return s === "light" ? "light" : "dark";
};
const readLang = (): Lang => {
  const s = localStorage.getItem("rehau.lang");
  return s === "it" ? "it" : "en";
};

// TEMPORARY: while we tune the right body-text baseline, the slider in
// SettingsMenu writes a percent-style scale here. The clamp matches the
// slider's range (0..+40 %).
const MIN_UI_SCALE = 1;
const MAX_UI_SCALE = 1.4;
const readUiScale = (): number => {
  const s = localStorage.getItem("rehau.uiScale");
  if (!s) return 1;
  const n = Number(s);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, n));
};

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const [lang, setLang] = useState<Lang>(() => readLang());
  const [uiScale, setUiScale] = useState<number>(() => readUiScale());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
  }, [uiScale]);

  const handleTheme = useCallback((t: Theme) => {
    localStorage.setItem("rehau.theme", t);
    setTheme(t);
  }, []);
  const handleLang = useCallback((l: Lang) => {
    localStorage.setItem("rehau.lang", l);
    setLang(l);
  }, []);
  const handleUiScale = useCallback((s: number) => {
    const clamped = Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, s));
    localStorage.setItem("rehau.uiScale", String(clamped));
    setUiScale(clamped);
  }, []);

  const value = useMemo<PrefsValue>(
    () => ({
      theme,
      lang,
      uiScale,
      setTheme: handleTheme,
      setLang: handleLang,
      setUiScale: handleUiScale,
    }),
    [theme, lang, uiScale, handleTheme, handleLang, handleUiScale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = (): PrefsValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs: missing PrefsProvider");
  return v;
};
