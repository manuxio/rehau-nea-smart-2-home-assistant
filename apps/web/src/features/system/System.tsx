import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { EnergyLevel, SystemMode } from "@rehau/types";
import {
  AppHeader,
  Card,
  Glyph,
  KV,
  SectionHead,
  Sep,
  btnStyle,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { labelEnergyLevel, labelSystemMode, staleSec } from "../../lib/labels";
import { usePrefs } from "../../lib/prefs";
import {
  currentNativeInstallation,
  isInNativeShell,
  requestSwitchInstallation,
} from "../../lib/runtime";

const OP_MODES: SystemMode[] = ["heating_only", "cooling_only", "manual_heating", "manual_cooling"];
const ENERGY: EnergyLevel[] = ["normal", "reduced", "standby", "auto", "vacation"];

export function System() {
  const { api, logout } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { theme, lang, uiScale, setTheme, setLang, setUiScale } = usePrefs();
  const scalePercent = Math.round((uiScale - 1) * 100);
  const sysQ = useQuery({ queryKey: ["system"], queryFn: () => api.system.get(), refetchInterval: 5000 });

  const setOp = useMutation({
    mutationFn: (m: SystemMode) => api.system.setOperatingMode(m),
    onSuccess: (s) => {
      qc.setQueryData(["system"], s);
      toast.success(t("toast.systemUpdated", { label: labelSystemMode(s.operatingMode) }));
    },
    onError: () => toast.error(t("toast.systemFailed")),
  });
  const setEnergy = useMutation({
    mutationFn: (l: EnergyLevel) => api.system.setEnergyLevel(l),
    onSuccess: (s) => {
      qc.setQueryData(["system"], s);
      toast.success(t("toast.energyUpdated", { label: labelEnergyLevel(s.energyLevel) }));
    },
    onError: () => toast.error(t("toast.energyFailed")),
  });

  const sys = sysQ.data;
  if (!sys) {
    return (
      <div style={{ padding: 24, fontFamily: "var(--mono)", color: "var(--dim)", textAlign: "center" }}>
        …
      </div>
    );
  }

  const nativeInstallation = currentNativeInstallation();
  const showNativeInstallationRow = isInNativeShell();

  return (
    <div style={{ paddingBottom: 110, maxWidth: 420, margin: "0 auto" }}>
      <AppHeader title={t("system.title")} subtitle={t("system.updatedSeconds", { n: staleSec(sys.meta.lastUpdatedAt) })} />

      {showNativeInstallationRow && (
        <>
          <SectionHead title={t("system.installation")} />
          <Card style={{ margin: "0 16px" }}>
            <button
              type="button"
              onClick={requestSwitchInstallation}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                color: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 4px",
                }}
              >
                <Glyph name="wrench" size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "0.625rem",
                      color: "var(--muted)",
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("system.installationOnLabel")}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--body)",
                      fontSize: "0.9375rem",
                      color: "var(--text)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {nativeInstallation?.name ?? "—"}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "var(--body)",
                    fontSize: "0.8125rem",
                    color: "var(--accent)",
                    fontWeight: 500,
                  }}
                >
                  {t("system.installationSwitch")}
                </div>
              </div>
            </button>
          </Card>
        </>
      )}

      <SectionHead title={t("system.operatingMode")} />
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {OP_MODES.map((m) => {
          const active = sys.operatingMode === m;
          const isHeat = m.includes("heating");
          return (
            <button
              key={m}
              type="button"
              onClick={() => setOp.mutate(m)}
              disabled={setOp.isPending}
              style={{
                ...btnStyle(active ? "primary" : "secondary", "md"),
                flexDirection: "column",
                alignItems: "flex-start",
                padding: 14,
                gap: 6,
                background: active
                  ? `color-mix(in oklab, var(--${isHeat ? "heat" : "cool"}) 22%, var(--surface))`
                  : "var(--surface)",
                color: active ? "var(--text)" : "var(--muted)",
                border:
                  "1px solid " +
                  (active
                    ? `color-mix(in oklab, var(--${isHeat ? "heat" : "cool"}) 50%, transparent)`
                    : "var(--border)"),
              }}
            >
              <Glyph
                name={isHeat ? "flame" : "snow"}
                size={20}
                color={`var(--${isHeat ? "heat" : "cool"})`}
              />
              <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{labelSystemMode(m)}</span>
              {m.startsWith("manual") && (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "0.5625rem",
                    color: "var(--dim)",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {t("system.manual")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <SectionHead title={t("system.energyLevel")} />
      <div style={{ padding: "0 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ENERGY.map((l) => {
          const active = sys.energyLevel === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setEnergy.mutate(l)}
              disabled={setEnergy.isPending}
              style={{
                ...btnStyle(active ? "primary" : "ghost", "sm"),
                padding: "8px 14px",
                borderRadius: 999,
              }}
            >
              {labelEnergyLevel(l)}
            </button>
          );
        })}
      </div>

      <SectionHead title={t("system.outdoor")} />
      <Card style={{ margin: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "0.625rem",
                color: "var(--muted)",
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {t("system.outdoorTemp")}
            </div>
            <div
              style={{
                fontFamily: "var(--display)",
                fontSize: "2rem",
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {sys.outdoorTemp.toFixed(1)}°
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "0.625rem",
                color: "var(--muted)",
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {t("system.activeOffset")}
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "0.875rem",
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {sys.outdoorOffset >= 0 ? "+" : ""}
              {sys.outdoorOffset.toFixed(1)} °C
            </div>
          </div>
        </div>
      </Card>

      <SectionHead title={t("system.seasonWindow")} />
      <Card style={{ margin: "0 16px" }}>
        <KV label={t("system.winter")} value={`${sys.seasonStart} → ${sys.seasonEnd}`} />
      </Card>

      <SectionHead title={t("system.device")} />
      <Card style={{ margin: "0 16px" }}>
        <KV label={t("system.uniqueCode")} value={sys.uniqueCode.slice(0, 16) + "…"} />
        <Sep />
        <KV label={t("system.fwMaster")} value={sys.fw.master} />
        <Sep />
        <KV label={t("system.fwWeb")} value={sys.fw.web} />
        {Object.entries(sys.fw.umodules).map(([k, v]) => (
          <div key={k}>
            <Sep />
            <KV label={t("system.fwModule", { name: k })} value={v} />
          </div>
        ))}
        <Sep />
        <KV label={t("system.ssid")} value={sys.ssid} />
      </Card>

      <SectionHead title={t("system.preferences")} />
      <Card style={{ margin: "0 16px" }}>
        <PrefRow label={t("common.theme")}>
          <Seg>
            <SegBtn active={theme === "dark"} onClick={() => setTheme("dark")}>
              {t("common.dark")}
            </SegBtn>
            <SegBtn active={theme === "light"} onClick={() => setTheme("light")}>
              {t("common.light")}
            </SegBtn>
          </Seg>
        </PrefRow>
        <Sep />
        <PrefRow label={t("common.language")}>
          <Seg>
            <SegBtn active={lang === "it"} onClick={() => setLang("it")}>
              IT
            </SegBtn>
            <SegBtn active={lang === "en"} onClick={() => setLang("en")}>
              EN
            </SegBtn>
          </Seg>
        </PrefRow>
        <Sep />
        <div style={{ padding: "10px 4px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.625rem",
              color: "var(--muted)",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {t("common.uiScale")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={0}
              max={40}
              step={5}
              value={scalePercent}
              onChange={(e) => setUiScale(1 + Number(e.target.value) / 100)}
              aria-label={t("common.uiScale")}
              style={{ flex: 1, accentColor: "var(--accent)" }}
            />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "0.6875rem",
                color: "var(--muted)",
                minWidth: 36,
                textAlign: "right",
              }}
            >
              +{scalePercent}%
            </span>
          </div>
        </div>
      </Card>

      <SectionHead title={t("system.account")} />
      <Card style={{ margin: "0 16px" }}>
        <button
          type="button"
          onClick={logout}
          style={{
            width: "100%",
            padding: "12px 4px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--alert)",
            fontFamily: "var(--body)",
            fontSize: "0.9375rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Glyph name="logout" size={16} color="var(--alert)" />
          <span>{t("common.logout")}</span>
        </button>
      </Card>

      <SectionHead title={t("system.docs")} />
      <Card style={{ margin: "0 16px" }}>
        <a
          href={new URL("./docs", document.baseURI).toString()}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--accent)",
            fontFamily: "var(--body)",
            fontSize: "0.875rem",
            textDecoration: "none",
          }}
        >
          <Glyph name="wrench" size={16} />
          <span style={{ flex: 1 }}>{t("system.docs")}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)" }}>
            {t("system.docsDesc")}
          </span>
        </a>
      </Card>
    </div>
  );
}

// ─── Settings primitives (mirror the ones that used to live in
//     SettingsMenu — small enough that duplicating beats wiring an import) ──

function PrefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 4px",
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.625rem",
          color: "var(--muted)",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </div>
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
