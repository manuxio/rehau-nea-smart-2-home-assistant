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
import { canWrite, useConnection } from "../../lib/connection";
import { FloorsEditor, ScenesEditor } from "./FloorsAndScenes";
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
  const { state: connState, diag } = useConnection();
  // While the bridge can't reach REHAU, operating-mode / energy-level
  // writes would queue up against a dead socket. Disable the controls;
  // the persistent banner already explains why.
  const writesDisabled = !canWrite(connState);
  const versions = diag?.versions;
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
              disabled={setOp.isPending || writesDisabled}
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
              disabled={setEnergy.isPending || writesDisabled}
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

      <SectionHead title={t("system.floors.title")} />
      <FloorsEditor />

      <SectionHead title={t("system.scenes.title")} />
      <ScenesEditor />

      <SectionHead title={t("system.app")} />
      <Card style={{ margin: "0 16px" }}>
        <KV label={t("system.appVersion")} value={versions?.addon ?? "—"} />
        <Sep />
        <KV label={t("system.appBridge")} value={versions?.bridge ?? "—"} />
      </Card>

      <SectionHead title={t("system.rehauState")} />
      <RehauState />

      <SectionHead title={t("system.fingerprint.title")} />
      <FingerprintCard />

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
          // Trailing slash matters under HA ingress. Without it, fastify-
          // swagger-ui 301-redirects /docs → /docs/ with an absolute
          // Location header, which the browser resolves against the host
          // root (not the ingress prefix) and 404s. Hitting /docs/
          // directly skips the redirect and lets the HTML's relative
          // asset paths resolve through ingress correctly.
          href={new URL("./docs/", document.baseURI).toString()}
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

// ─── REHAU state panel (TODO.md §"Server-error visibility" layer 3) ─────
// Reads diag from useConnection and renders the rolling fetch buffer +
// aggregates so a slow/buggy device is visible at a glance from the SPA.
//
// Style is matching the rest of the System tab's "spec sheet" feel —
// monospaced figures, low-contrast labels, accent colour for the state
// dot. No write controls live here; this is pure observability.

function RehauState() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const qc = useQueryClient();
  // ACTIVE consumer — owns the diagnostics poll while the System tab is
  // mounted. Every other useConnection() call across the SPA reads from
  // the same query cache without firing a fetch. See lib/connection.ts.
  const { conn, diag } = useConnection({ active: true });

  // Force-refresh mutation — POST /api/v1/diagnostics/refresh runs every
  // poll on the bridge in parallel, then we invalidate the local caches
  // so the SPA picks up the fresh state. Calibration goes through
  // /api/v1/installer/calibration which is gated on the installer role,
  // so we invalidate it separately; the bridge already mirrored the
  // values into Room during the refresh.
  const refresh = useMutation({
    mutationFn: () => api.diagnostics.refresh(),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["system"] });
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      void qc.invalidateQueries({ queryKey: ["room"] });
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["installer", "calibration"] });
      void qc.invalidateQueries({ queryKey: ["diagnostics", "fetches"] });
    },
  });

  if (!conn || !diag) {
    return (
      <Card style={{ margin: "0 16px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--muted)" }}>
          {t("common.loading")}
        </div>
      </Card>
    );
  }

  const stateColor =
    conn.state === "online"
      ? "var(--accent)"
      : conn.state === "degraded"
        ? "var(--warning, var(--accent))"
        : "var(--alert)";
  const stateLabel = t(`system.connState.${conn.state}` as const);
  const fmtMs = (n: number | null) => (n === null ? "—" : `${n} ms`);

  return (
    <Card style={{ margin: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: stateColor,
            boxShadow: `0 0 10px ${stateColor}`,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              color: "var(--text)",
              fontFamily: "var(--body)",
              fontSize: "0.9375rem",
              fontWeight: 600,
            }}
          >
            {stateLabel}
          </div>
          {conn.reason && (
            <div
              style={{
                color: "var(--muted)",
                fontFamily: "var(--mono)",
                fontSize: "0.6875rem",
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              {conn.reason}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: refresh.isPending ? "var(--muted)" : "var(--accent)",
            fontFamily: "var(--body)",
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 8,
            cursor: refresh.isPending ? "default" : "pointer",
          }}
        >
          {refresh.isPending ? t("system.rehauRefreshing") : t("system.rehauRefresh")}
        </button>
      </div>

      <Sep />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          fontFamily: "var(--mono)",
          fontSize: "0.75rem",
        }}
      >
        <KV label={t("system.rehauOk")} value={`${diag.aggregates.success} / ${diag.aggregates.total}`} />
        <KV label={t("system.rehauFail")} value={String(diag.aggregates.failure)} />
        <KV label={t("system.rehauAvg")} value={fmtMs(diag.aggregates.avgMsSuccess)} />
        <KV label={t("system.rehauP95")} value={fmtMs(diag.aggregates.p95MsSuccess)} />
      </div>

      <Sep />

      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.5625rem",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 6,
        }}
      >
        {t("system.rehauRecent", { n: diag.recent.length })}
      </div>

      {diag.recent.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--dim)" }}>
          {t("system.rehauEmpty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {diag.recent.map((f, i) => {
            const ok = f.outcome === "ok";
            const time = new Date(f.at).toLocaleTimeString();
            return (
              <div
                key={`${f.at}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 8,
                  alignItems: "baseline",
                  fontFamily: "var(--mono)",
                  fontSize: "0.6875rem",
                  color: ok ? "var(--text)" : "var(--alert)",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  paddingTop: i > 0 ? 4 : 0,
                }}
              >
                <span style={{ color: "var(--dim)" }}>{time}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.what}
                </span>
                <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{f.ms} ms</span>
                <span style={{ color: ok ? "var(--accent)" : "var(--alert)" }}>
                  {ok ? "ok" : f.outcome + (f.status ? ` ${f.status}` : "")}
                </span>
                {!ok && f.error && (
                  <span
                    style={{
                      gridColumn: "2 / -1",
                      color: "var(--muted)",
                      fontSize: "0.625rem",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.error}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Settings primitives (mirror the ones that used to live in
//     SettingsMenu — small enough that duplicating beats wiring an import) ──

// ─── Installation fingerprint card ────────────────────────────────────
//
// One-tap "give me the device profile I need to triage your bug
// report" affordance. Lazy fetch on first paint (TanStack Query),
// renders a short human-readable summary plus two buttons:
//
//   - Copy JSON       → the raw payload, identical to what the bridge
//                       logs at boot as INSTALLATION_FINGERPRINT.
//   - Copy as Markdown → wraps the JSON in a ```json … ``` fence so a
//                       user can paste it straight into a GitHub
//                       issue and it renders properly.
//
// No secrets in the payload (no installer code, no JWT, no MQTT
// password) — the server side filters those out of the builder.
function FingerprintCard() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const fpQ = useQuery({
    queryKey: ["fingerprint"],
    queryFn: () => api.diagnostics.fingerprint(),
    // Keep it fresh-ish but don't auto-refetch — the user will hit
    // refresh when they want a new snapshot.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Best-effort clipboard write. `navigator.clipboard.writeText` needs
  // a secure context — works behind HA ingress (HTTPS-equivalent) and
  // on localhost; falls back to a `<textarea>+execCommand` shim for
  // older browsers / non-secure setups. We swallow errors and toast
  // the result either way.
  const copy = async (text: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast.success(t("system.fingerprint.copied", { what: label }));
    } catch {
      toast.error(t("system.fingerprint.copyFailed"));
    }
  };

  if (fpQ.isPending) {
    return (
      <Card style={{ margin: "0 16px" }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.6875rem",
            color: "var(--dim)",
            padding: 12,
          }}
        >
          {t("common.loading")}
        </div>
      </Card>
    );
  }
  if (fpQ.isError || !fpQ.data) {
    return (
      <Card style={{ margin: "0 16px" }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.6875rem",
            color: "var(--alert)",
            padding: 12,
          }}
        >
          {t("system.fingerprint.unavailable")}
        </div>
      </Card>
    );
  }

  // The fingerprint payload is intentionally loose-typed at the API
  // boundary (server returns it as a single object the client just
  // copies verbatim). Pull out the few fields we show in the summary.
  const fp = fpQ.data as Record<string, unknown>;
  const fwMaster = (fp.fw as { master?: string } | undefined)?.master ?? "?";
  const roomCount = (fp.roomCount as number | undefined) ?? 0;
  const opMode = (fp.operatingMode as string | undefined) ?? "?";
  const addonVersion = (fp.addonVersion as string | undefined) ?? "?";

  const opsMd = typeof fp.recentOpsMarkdown === "string" ? fp.recentOpsMarkdown : "";
  const opsCount = Array.isArray(fp.recentOps) ? fp.recentOps.length : 0;
  // Strip the markdown-only field from the JSON copy so the JSON payload
  // stays clean; markdown form keeps the ops block appended after the
  // fenced JSON for GitHub-friendly pasting.
  const fpCore = { ...fp } as Record<string, unknown>;
  delete fpCore.recentOpsMarkdown;
  const json = JSON.stringify(fpCore, null, 2);
  const markdown = ["```json", json, "```", "", opsMd].join("\n");

  return (
    <Card style={{ margin: "0 16px" }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.625rem",
          color: "var(--muted)",
          letterSpacing: 0.4,
          padding: "6px 4px 10px",
          lineHeight: 1.5,
        }}
      >
        {t("system.fingerprint.help")}
      </div>
      <KV label={t("system.fingerprint.addon")} value={addonVersion} />
      <Sep />
      <KV label={t("system.fingerprint.fwMaster")} value={fwMaster} />
      <Sep />
      <KV label={t("system.fingerprint.opMode")} value={opMode} />
      <Sep />
      <KV label={t("system.fingerprint.rooms")} value={String(roomCount)} />
      <Sep />
      <KV label={t("system.fingerprint.ops")} value={String(opsCount)} />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => copy(json, t("system.fingerprint.json"))}
          style={btnStyle("primary", "sm")}
        >
          <Glyph name="check" size={14} /> {t("system.fingerprint.copyJson")}
        </button>
        <button
          type="button"
          onClick={() => copy(markdown, t("system.fingerprint.markdown"))}
          style={btnStyle("secondary", "sm")}
        >
          {t("system.fingerprint.copyMarkdown")}
        </button>
        <button
          type="button"
          onClick={() => fpQ.refetch()}
          style={btnStyle("ghost", "sm")}
          disabled={fpQ.isFetching}
        >
          <Glyph name="refresh" size={14} /> {t("common.refresh")}
        </button>
      </div>
    </Card>
  );
}

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
