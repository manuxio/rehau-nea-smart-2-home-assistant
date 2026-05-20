import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePrefs } from "../lib/prefs";
import { useAuth } from "../lib/auth";
import { Glyph } from "./ui";

/**
 * Floating settings menu in the top-right: theme toggle (dark/light),
 * language toggle (it/en), and logout. Sits over every screen.
 */
export function SettingsMenu() {
  const { t } = useTranslation();
  const { theme, lang, setTheme, setLang } = usePrefs();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        // Without viewport-fit=cover the layout viewport doesn't extend
        // under the status bar; a plain 16 px offset puts the button
        // 16 px below / right of the visible top-right corner everywhere.
        top: 16,
        right: 16,
        zIndex: 40,
      }}
    >
      <button
        type="button"
        aria-label={t("auth.settings")}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Glyph name="sliders" size={14} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            minWidth: 200,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 6,
            boxShadow: "0 12px 32px rgba(0,0,0,.35)",
            fontFamily: "var(--body)",
          }}
        >
          <Row>
            <Label>{t("common.theme")}</Label>
            <Seg>
              <SegBtn active={theme === "dark"} onClick={() => setTheme("dark")}>
                {t("common.dark")}
              </SegBtn>
              <SegBtn active={theme === "light"} onClick={() => setTheme("light")}>
                {t("common.light")}
              </SegBtn>
            </Seg>
          </Row>
          <Sep />
          <Row>
            <Label>{t("common.language")}</Label>
            <Seg>
              <SegBtn active={lang === "it"} onClick={() => setLang("it")}>IT</SegBtn>
              <SegBtn active={lang === "en"} onClick={() => setLang("en")}>EN</SegBtn>
            </Seg>
          </Row>
          <Sep />
          <button
            type="button"
            onClick={() => { setOpen(false); logout(); }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              color: "var(--alert)",
              fontFamily: "var(--body)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Glyph name="logout" size={14} color="var(--alert)" /> {t("common.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: "0.625rem",
        color: "var(--muted)",
        letterSpacing: 0.6,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function Seg({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        padding: 2,
        background: "var(--surface2)",
        borderRadius: 8,
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: "none",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#1a1024" : "var(--muted)",
        fontFamily: "var(--body)",
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: 0.2,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ height: 1, background: "var(--border)", margin: "2px 6px" }} />;
}
