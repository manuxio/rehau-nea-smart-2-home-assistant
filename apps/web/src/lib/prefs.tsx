// User preferences (theme + language) persisted in localStorage and exposed
// via a tiny context. The app shell binds `data-theme` to <html> so CSS vars
// can flip between light and dark.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { i18n } from "./i18n";

type Theme = "dark" | "light";
type Lang = "it" | "en";

interface PrefsValue {
  theme: Theme;
  lang: Lang;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
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

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const [lang, setLang] = useState<Lang>(() => readLang());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [lang]);

  const handleTheme = useCallback((t: Theme) => {
    localStorage.setItem("rehau.theme", t);
    setTheme(t);
  }, []);
  const handleLang = useCallback((l: Lang) => {
    localStorage.setItem("rehau.lang", l);
    setLang(l);
  }, []);

  const value = useMemo<PrefsValue>(
    () => ({ theme, lang, setTheme: handleTheme, setLang: handleLang }),
    [theme, lang, handleTheme, handleLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = (): PrefsValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs: missing PrefsProvider");
  return v;
};
