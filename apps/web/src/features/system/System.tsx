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

const OP_MODES: SystemMode[] = ["heating_only", "cooling_only", "manual_heating", "manual_cooling"];
const ENERGY: EnergyLevel[] = ["normal", "reduced", "standby", "auto", "vacation"];

export function System() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
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

  return (
    <div style={{ paddingBottom: 110, maxWidth: 420, margin: "0 auto" }}>
      <AppHeader title={t("system.title")} subtitle={t("system.updatedSeconds", { n: staleSec(sys.meta.lastUpdatedAt) })} />

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
