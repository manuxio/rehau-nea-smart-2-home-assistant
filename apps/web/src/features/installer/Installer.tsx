import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type {
  CalibrationState,
  InstallerSettingField,
  InstallerSettingsGroup,
  InstallerSettingsSnapshot,
  RoomCalibration,
} from "@rehau/types";

type CalibrationPatch = { outdoor?: number; rooms?: RoomCalibration[] };

/**
 * Sticky footer for any installer-tab editor: explicit Save / Cancel
 * with a pending-count indicator. Replaces the old 500 ms-debounced
 * auto-flush which was firing one POST per field tweak and stacking up
 * against REHAU's all-or-nothing form semantics — multiple consecutive
 * +/-/toggle interactions now coalesce into a single batch write the
 * user can review before committing.
 *
 * Save  → flushes everything pending in one device round trip.
 * Cancel → discards the local draft and pulls the canonical server
 *          state back into the cache.
 */
const SaveBar = ({
  pendingCount,
  saving,
  onSave,
  onCancel,
}: {
  pendingCount: number;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const disabled = pendingCount === 0 || saving;
  if (pendingCount === 0 && !saving) return null;
  return (
    <div
      style={{
        position: "sticky",
        // Lift just enough to clear the TabBar (52 pt + safe-area on iOS).
        bottom: "calc(72px + env(safe-area-inset-bottom))",
        zIndex: 20,
        margin: "16px",
        padding: "10px 12px",
        background: "color-mix(in oklab, var(--accent) 14%, var(--surface))",
        border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
        borderRadius: 12,
        boxShadow: "0 12px 24px rgba(0,0,0,.25)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          flex: 1,
          fontFamily: "var(--mono)",
          fontSize: "0.6875rem",
          color: "var(--text)",
        }}
      >
        {saving ? t("installer.savebar.saving") : t("installer.savebar.pending", { n: pendingCount })}
      </span>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          fontFamily: "var(--body)",
          fontSize: "0.75rem",
          fontWeight: 600,
          padding: "6px 12px",
          borderRadius: 8,
          cursor: saving ? "default" : "pointer",
        }}
      >
        {t("installer.savebar.cancel")}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        style={{
          background: disabled ? "var(--surface)" : "var(--accent)",
          border: "none",
          color: disabled ? "var(--muted)" : "#1a1024",
          fontFamily: "var(--body)",
          fontSize: "0.75rem",
          fontWeight: 700,
          padding: "6px 14px",
          borderRadius: 8,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {t("installer.savebar.save")}
      </button>
    </div>
  );
};

/**
 * Merge two calibration patches. `outdoor` takes the latest value;
 * room offsets merge per-zone (latest wins).
 */
const mergePatches = (prev: CalibrationPatch | null, add: CalibrationPatch): CalibrationPatch => {
  const out: CalibrationPatch = { ...(prev ?? {}) };
  if (add.outdoor !== undefined) out.outdoor = add.outdoor;
  if (add.rooms) {
    const roomMap = new Map<number, RoomCalibration>();
    for (const r of out.rooms ?? []) roomMap.set(r.zone, r);
    for (const r of add.rooms) roomMap.set(r.zone, r);
    out.rooms = [...roomMap.values()];
  }
  return out;
};
import {
  AppHeader,
  Card,
  Glyph,
  KV,
  SectionHead,
  Sep,
  Stepper,
  Toggle,
  btnStyle,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";

type Tab = "curve" | "calib" | "devices" | "io" | "diag" | "advanced";

const TAB_VALUES: Tab[] = ["curve", "calib", "devices", "io", "diag", "advanced"];

/** Icon per tab. Mostly reuses existing Glyphs; `chart`, `network` and
 * `io` were added to ui.tsx in v6.0.16 specifically for this. */
const TAB_ICONS: Record<Tab, string> = {
  curve:    "chart",
  calib:    "sliders",
  devices:  "network",
  io:       "io",
  diag:     "eye",
  advanced: "wrench",
};

const ADVANCED_GROUP_KEYS: InstallerSettingsGroup[] = ["heatcool", "devices", "functions", "pid", "fancoil"];

export function Installer() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("calib");

  return (
    <div style={{ paddingBottom: 110, maxWidth: 420, margin: "0 auto" }}>
      <AppHeader
        title={t("installer.title")}
        subtitle={t("installer.subtitle")}
        right={
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.5625rem",
              color: "var(--accent)",
              letterSpacing: 1,
              textTransform: "uppercase",
              border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
              padding: "3px 7px",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--accent) 14%, transparent)",
            }}
          >
            {t("installer.role")}
          </span>
        }
      >
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {TAB_VALUES.map((v) => {
            const isActive = tab === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setTab(v)}
                aria-label={t(`installer.tabs.${v}`)}
                title={t(`installer.tabs.${v}`)}
                style={{
                  ...btnStyle(isActive ? "primary" : "ghost", "sm"),
                  padding: "8px 12px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // flex children default to shrink:1, which collapses
                  // SVG icons to near-zero width when total content
                  // exceeds the strip — overflow-x:auto on the parent
                  // only helps if buttons keep their natural size.
                  flexShrink: 0,
                }}
              >
                {isActive ? (
                  <Glyph name={TAB_ICONS[v]} size={22} />
                ) : (
                  <Glyph name={TAB_ICONS[v]} size={22} color="var(--accent)" />
                )}
              </button>
            );
          })}
        </div>
      </AppHeader>

      {tab === "curve"    && <CurveTab />}
      {tab === "calib"    && <CalibrationTab />}
      {tab === "devices"  && <DevicesTab />}
      {tab === "io"       && <IOTab />}
      {tab === "diag"     && <DiagnosticsTab />}
      {tab === "advanced" && <AdvancedTab />}
    </div>
  );
}

// ─── Curva ───────────────────────────────────────────────────────────
// Editable settings/curve plus the SVG preview at the top, driven by the
// same query.
function CurveTab() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["installer", "settings", "curve"],
    queryFn: () => api.installer.getSettings("curve"),
  });
  const slope = (q.data?.fields.find((f) => f.name === "HC00")?.value as number | undefined) ?? 0.6;
  const reduction = (q.data?.fields.find((f) => f.name === "HR0")?.value as number | undefined) ?? 0;
  const maxFlow = (q.data?.fields.find((f) => f.name === "HI00")?.value as number | undefined) ?? 0;

  return (
    <>
      <SectionHead title={t("installer.curve.title")} />
      <Card style={{ margin: "0 16px" }}>
        {q.data ? <HeatCurve slope={slope} /> : <Loading />}
        {q.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
            <Mini label={t("installer.curve.slope")} value={slope.toFixed(2)} />
            <Mini label={t("installer.curve.reduction")} value={`${reduction} K`} />
            <Mini label={t("installer.curve.maxFlow")} value={`${maxFlow} °C`} />
          </div>
        )}
      </Card>

      <SectionHead title={t("installer.curve.parameters")} />
      <SettingsEditor group="curve" />
    </>
  );
}

function HeatCurve({ slope }: { slope: number }) {
  const W = 280;
  const H = 140;
  const pad = 18;
  const curves = [0.6, 1.0, 1.4, 1.8];
  const flow = (outdoor: number, s: number): number => Math.max(20, Math.min(60, 35 - (outdoor - 5) * s * 0.9));
  const xs = Array.from({ length: 30 }, (_, i) => -10 + i);
  const xMap = (x: number): number => pad + ((x + 10) / 30) * (W - pad * 2);
  const yMap = (y: number): number => H - pad - ((y - 18) / 44) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={140} style={{ display: "block" }}>
      {[20, 30, 40, 50, 60].map((y) => (
        <line key={y} x1={pad} x2={W - pad} y1={yMap(y)} y2={yMap(y)} stroke="var(--border)" strokeWidth="0.5" />
      ))}
      {curves.map((s) => (
        <polyline
          key={s}
          fill="none"
          stroke={Math.abs(s - slope) < 0.21 ? "var(--heat)" : "var(--border)"}
          strokeWidth={Math.abs(s - slope) < 0.21 ? 2.5 : 1}
          opacity={Math.abs(s - slope) < 0.21 ? 1 : 0.5}
          points={xs.map((x) => `${xMap(x)},${yMap(flow(x, s))}`).join(" ")}
        />
      ))}
      <text x={pad} y={H - 4} fontFamily="var(--mono)" fontSize="8" fill="var(--dim)">-10°</text>
      <text x={W - pad - 14} y={H - 4} fontFamily="var(--mono)" fontSize="8" fill="var(--dim)">+20°</text>
      <text x={2} y={pad + 4} fontFamily="var(--mono)" fontSize="8" fill="var(--dim)">60°</text>
      <text x={2} y={H - pad} fontFamily="var(--mono)" fontSize="8" fill="var(--dim)">20°</text>
    </svg>
  );
}

// ─── Calibrazione ────────────────────────────────────────────────────
function CalibrationTab() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["installer", "calibration"],
    queryFn: () => api.installer.getCalibration(),
  });
  const roomsListQ = useQuery({ queryKey: ["rooms"], queryFn: () => api.rooms.list() });

  const save = useMutation({
    mutationFn: (input: CalibrationPatch) => api.installer.setCalibration(input),
    onError: () => {
      // On failure the optimistic cache is wrong — pull authoritative state
      // back from the device. Cheap because the device is the source of truth.
      void qc.invalidateQueries({ queryKey: ["installer", "calibration"] });
      toast.error(t("toast.calibrationFailed"));
    },
    onSuccess: (next) => {
      qc.setQueryData(["installer", "calibration"], next);
      pendingPatch.current = null;
      setPendingCount(0);
    },
  });

  // Local draft buffer + a counter so the Save button knows when to enable.
  // Every edit (Stepper +/- or a direct value) optimistically updates the
  // query cache for instant feedback, then accumulates into pendingPatch.
  // Nothing leaves the SPA until the user clicks Save — see SaveBar above.
  const pendingPatch = useRef<CalibrationPatch | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const onSave = useCallback(() => {
    const p = pendingPatch.current;
    if (p) save.mutate(p);
  }, [save]);

  const onCancel = useCallback(() => {
    pendingPatch.current = null;
    setPendingCount(0);
    // Pull authoritative state back — the user explicitly threw away the draft.
    void qc.invalidateQueries({ queryKey: ["installer", "calibration"] });
  }, [qc]);

  const schedule = useCallback((input: CalibrationPatch): void => {
    // 1. Optimistic cache update — instant visual feedback.
    const prev = qc.getQueryData<CalibrationState>(["installer", "calibration"]);
    if (prev) {
      const next: CalibrationState = {
        ...prev,
        outdoor: input.outdoor ?? prev.outdoor,
        rooms: input.rooms
          ? prev.rooms.map((r) => {
              const upd = input.rooms!.find((x) => x.zone === r.zone);
              return upd ? { ...r, ...upd } : r;
            })
          : prev.rooms,
      };
      qc.setQueryData(["installer", "calibration"], next);
    }

    // 2. Coalesce into the pending patch.
    pendingPatch.current = mergePatches(pendingPatch.current, input);
    // Pending count: outdoor counts once, each touched room counts once.
    let n = pendingPatch.current?.outdoor !== undefined ? 1 : 0;
    n += pendingPatch.current?.rooms?.length ?? 0;
    setPendingCount(n);
  }, [qc]);

  // Safety net: if the user navigates away with unsaved changes, push them
  // anyway so a slow +/- session isn't lost. The user can still hit Cancel
  // before leaving to discard.
  useEffect(() => {
    return () => {
      if (pendingPatch.current) save.mutate(pendingPatch.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!q.data) return <Loading />;

  const rooms = roomsListQ.data ?? [];
  const cal = q.data;

  return (
    <>
      <SectionHead
        title={t("installer.calib.outdoorProbe")}
        action={
          save.isPending && (
            <span style={{ fontFamily: "var(--mono)", fontSize: "0.625rem", color: "var(--accent)" }}>
              {t("common.saving")}
            </span>
          )
        }
      />
      <Card style={{ margin: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)" }}>
            {t("installer.calib.outdoorOffset")}
          </span>
          <Stepper
            value={cal.outdoor}
            min={-10}
            max={10}
            step={0.1}
            suffix="°"
            onChange={(v) => schedule({ outdoor: Math.round(v * 10) / 10 })}
          />
        </div>
      </Card>

      <SectionHead title={t("installer.calib.perRoom")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
        {cal.rooms.map((r) => {
          const named = rooms.find((rm) => rm.zone === r.zone);
          return (
            <Card key={r.zone} padding={12}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "var(--display)", fontSize: "1rem", color: "var(--text)" }}>
                  {named?.name ?? t("installer.calib.zoneFallback", { n: r.zone })}
                </div>
                {named && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)" }}>
                    {named.temperature !== null ? `${named.temperature.toFixed(1)}°` : "—"}
                    {" / "}
                    {named.humidity !== null ? `${named.humidity}%` : "—"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)" }}>{t("installer.calib.offsetTemp")}</span>
                <Stepper
                  value={r.tempOffset}
                  min={-5}
                  max={5}
                  step={0.1}
                  suffix="°"
                  onChange={(v) =>
                    schedule({
                      rooms: [{ zone: r.zone, tempOffset: Math.round(v * 10) / 10, humidityOffset: r.humidityOffset }],
                    })
                  }
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)" }}>{t("installer.calib.offsetHum")}</span>
                <Stepper
                  value={r.humidityOffset}
                  min={-25}
                  max={25}
                  step={1}
                  suffix="%"
                  onChange={(v) =>
                    schedule({
                      rooms: [{ zone: r.zone, tempOffset: r.tempOffset, humidityOffset: Math.round(v) }],
                    })
                  }
                />
              </div>
            </Card>
          );
        })}
      </div>
      {save.isError && (
        <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: "0.625rem", color: "var(--alert)", textAlign: "center" }}>
          {t("installer.calib.saveFailed")}
        </div>
      )}
      <SaveBar
        pendingCount={pendingCount}
        saving={save.isPending}
        onSave={onSave}
        onCancel={onCancel}
      />
    </>
  );
}

// ─── Dispositivi ─────────────────────────────────────────────────────
function DevicesTab() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const topo = useQuery({ queryKey: ["installer", "topology"], queryFn: () => api.installer.getTopology() });
  const sys = useQuery({ queryKey: ["system"], queryFn: () => api.system.get() });

  return (
    <>
      <SectionHead title={t("installer.devices.topology")} />
      {topo.data ? (
        <Card style={{ margin: "0 16px" }}>
          <KV label={t("installer.devices.baseModules")} value={String(topo.data.baseModules)} /><Sep />
          <KV label={t("installer.devices.rModules")} value={String(topo.data.rModules)} /><Sep />
          <KV label={t("installer.devices.uModules")} value={String(topo.data.uModules)} /><Sep />
          <KV label={t("installer.devices.rooms")} value={String(topo.data.rooms)} /><Sep />
          <KV label={t("installer.devices.mixedCircuits")} value={String(topo.data.mixedCircuits)} /><Sep />
          <KV label={t("installer.devices.dehumidifiers")} value={String(topo.data.dehumidifiers)} />
        </Card>
      ) : <Loading />}

      <SectionHead title={t("installer.devices.firmware")} />
      {sys.data ? (
        <Card style={{ margin: "0 16px" }}>
          <KV label={t("installer.devices.master")} value={sys.data.fw.master} /><Sep />
          <KV label={t("installer.devices.webPages")} value={sys.data.fw.web} />
          {Object.entries(sys.data.fw.umodules).map(([k, v]) => (
            <div key={k}><Sep /><KV label={t("installer.devices.uModuleLabel", { n: k.replace("umodule", "").trim() })} value={v} /></div>
          ))}
        </Card>
      ) : <Loading />}
    </>
  );
}

// ─── I/O live ────────────────────────────────────────────────────────
function IOTab() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const io = useQuery({
    queryKey: ["installer", "io"],
    queryFn: () => api.installer.getIO(),
    refetchInterval: 8000,
  });

  if (!io.data) return <Loading />;
  const { master, umodules } = io.data;

  const fmt = (v: number): string => (v === 0 ? "0" : String(v));
  const colorFor = (v: number): string => (v ? "var(--on)" : "var(--dim)");

  return (
    <>
      <SectionHead
        title={t("installer.io.master")}
        action={
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.5625rem", color: "var(--dim)", letterSpacing: 0.5 }}>
            {t("installer.io.refreshRate")}
          </span>
        }
      />
      <Card style={{ margin: "0 16px" }}>
        <IORow label={t("installer.io.rz")} values={master.rz} fmt={fmt} colorFor={colorFor} />
        <Sep />
        <IORow label={t("installer.io.relay")} values={master.relay} fmt={fmt} colorFor={colorFor} />
        <Sep />
        <IORow label={t("installer.io.di")} values={master.di} fmt={fmt} colorFor={colorFor} />
      </Card>

      {Object.entries(umodules).map(([k, m]) => (
        <div key={k}>
          <SectionHead title={t("installer.io.uModuleLabel", { n: k.replace("umodule", "").trim() })} />
          <Card style={{ margin: "0 16px" }}>
            <IORow label={t("installer.io.relay")} values={m.relay} fmt={fmt} colorFor={colorFor} />
            <Sep />
            <IORow label={t("installer.io.di")} values={m.di} fmt={fmt} colorFor={colorFor} />
            <Sep />
            <IORow
              label={t("installer.io.ai")}
              values={m.aiC.map((v) => v ?? NaN)}
              fmt={(v) => (Number.isFinite(v) ? v.toFixed(1) : "—")}
              colorFor={(v) => (Number.isFinite(v) ? "var(--cool)" : "var(--dim)")}
            />
            <Sep />
            <KV label={t("installer.io.ao")} value={`${m.aoPct} %`} />
          </Card>
        </div>
      ))}
    </>
  );
}

function IORow({
  label,
  values,
  fmt,
  colorFor,
}: {
  label: string;
  values: number[];
  fmt: (v: number) => string;
  colorFor: (v: number) => string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)" }}>{label}</span>
      <div style={{ display: "flex", gap: 8 }}>
        {values.map((v, i) => (
          <span
            key={i}
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.75rem",
              color: colorFor(v),
              fontVariantNumeric: "tabular-nums",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {fmt(v)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Diagnostica ─────────────────────────────────────────────────────
function DiagnosticsTab() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const up = useQuery({ queryKey: ["installer", "uptime"], queryFn: () => api.installer.getUptime() });
  const sys = useQuery({ queryKey: ["system"], queryFn: () => api.system.get() });
  const dev = useQuery({ queryKey: ["installer", "topology"], queryFn: () => api.installer.getTopology() });

  return (
    <>
      <SectionHead title={t("installer.diag.uptime")} />
      {up.data ? (
        <Card style={{ margin: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, justifyContent: "center" }}>
            <Big v={up.data.years} u={t("installer.diag.years")} />
            <Big v={up.data.days}  u={t("installer.diag.days")} />
            <Big v={up.data.hours} u={t("installer.diag.hours")} />
          </div>
        </Card>
      ) : <Loading />}

      <SectionHead title={t("installer.diag.system")} />
      <Card style={{ margin: "0 16px" }}>
        {sys.data && (
          <>
            <KV label={t("installer.diag.firmwareMaster")} value={sys.data.fw.master} /><Sep />
            <KV label={t("installer.diag.firmwareWeb")} value={sys.data.fw.web} /><Sep />
            <KV label={t("installer.diag.uniqueCode")} value={sys.data.uniqueCode.slice(0, 16) + "…"} /><Sep />
          </>
        )}
        {dev.data && (
          <>
            <KV label={t("installer.diag.rooms")} value={String(dev.data.rooms)} /><Sep />
            <KV label={t("installer.diag.mixedCircuits")} value={String(dev.data.mixedCircuits)} />
          </>
        )}
      </Card>
    </>
  );
}

// ─── Avanzato (lista gruppi) ─────────────────────────────────────────
function AdvancedTab() {
  const { t } = useTranslation();
  const [group, setGroup] = useState<InstallerSettingsGroup | null>(null);

  if (group) {
    return (
      <>
        <div style={{ padding: "8px 16px 0" }}>
          <button
            type="button"
            onClick={() => setGroup(null)}
            style={btnStyle("ghost", "sm")}
          >
            <Glyph name="chevron-left" size={14} /> {t("installer.advanced.backLabel")}
          </button>
        </div>
        <SectionHead title={t(`installer.advanced.groups.${group}.label`)} />
        <SettingsEditor group={group} />
      </>
    );
  }

  return (
    <>
      <SectionHead title={t("installer.advanced.title")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
        {ADVANCED_GROUP_KEYS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            style={{
              textAlign: "left",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              padding: 14,
              cursor: "pointer",
              fontFamily: "var(--body)",
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--display)", fontSize: "0.9375rem", fontWeight: 600 }}>
                {t(`installer.advanced.groups.${g}.label`)}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "0.625rem",
                  color: "var(--muted)",
                  letterSpacing: 0.3,
                  marginTop: 2,
                }}
              >
                {t(`installer.advanced.groups.${g}.desc`)}
              </div>
            </div>
            <Glyph name="chevron-right" size={16} color="var(--dim)" />
          </button>
        ))}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.625rem",
          color: "var(--dim)",
          textAlign: "center",
          marginTop: 12,
          padding: "0 24px",
          letterSpacing: 0.3,
          lineHeight: 1.5,
        }}
      >
        {t("installer.advanced.footerHelp")}
      </div>
    </>
  );
}

// ─── Generic settings editor (any group) ─────────────────────────────
function SettingsEditor({ group }: { group: InstallerSettingsGroup }) {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const queryKey = ["installer", "settings", group];

  const q = useQuery({
    queryKey,
    queryFn: () => api.installer.getSettings(group),
  });

  const save = useMutation({
    mutationFn: (fields: Array<{ name: string; value: number | boolean }>) =>
      api.installer.setSettings(group, { fields }),
    onError: () => {
      void qc.invalidateQueries({ queryKey });
      toast.error(t("toast.settingsFailed"));
    },
    onSuccess: (next) => {
      qc.setQueryData(queryKey, next);
      pending.current = new Map();
      setPendingCount(0);
    },
  });

  // Local draft (Map of name → value). Every +/-/toggle updates the cache
  // optimistically for instant feedback AND adds an entry here. Nothing
  // leaves the SPA until the user clicks Save — see SaveBar above.
  const pending = useRef<Map<string, number | boolean>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);

  const onSave = useCallback(() => {
    if (pending.current.size === 0) return;
    save.mutate([...pending.current.entries()].map(([name, value]) => ({ name, value })));
  }, [save]);

  const onCancel = useCallback(() => {
    pending.current = new Map();
    setPendingCount(0);
    void qc.invalidateQueries({ queryKey });
  }, [qc, queryKey]);

  const schedule = useCallback(
    (name: string, value: number | boolean): void => {
      pending.current.set(name, value);
      setPendingCount(pending.current.size);
      qc.setQueryData<InstallerSettingsSnapshot>(queryKey, (cur) =>
        cur ? { ...cur, fields: cur.fields.map((f) => (f.name === name ? { ...f, value } : f)) } : cur,
      );
    },
    [qc, queryKey],
  );

  // Safety net: auto-flush pending edits on unmount so a slow editing
  // session isn't silently dropped when the user navigates away.
  useEffect(() => {
    return () => {
      if (pending.current.size > 0) {
        save.mutate(
          [...pending.current.entries()].map(([name, value]) => ({ name, value })),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!q.data) return <Loading />;

  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {q.data.fields.map((f) => (
        <FieldCard key={f.name} field={f} onChange={(v) => schedule(f.name, v)} />
      ))}
      <SaveBar
        pendingCount={pendingCount}
        saving={save.isPending}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}

function FieldCard({
  field,
  onChange,
}: {
  field: InstallerSettingField;
  onChange: (v: number | boolean) => void;
}) {
  const { t } = useTranslation();
  // The bridge sends the stable field `name`; the human label is localised
  // here so it follows the UI language (falls back to the raw name).
  const label = t(`settings.fields.${field.name}`, field.name);
  const unit = field.unit ? t(`settings.units.${field.unit}`, field.unit) : "";
  return (
    <Card padding={12}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--body)", fontSize: "0.8125rem", color: "var(--text)", lineHeight: 1.3 }}>
            {label}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.5625rem",
              color: "var(--dim)",
              letterSpacing: 0.4,
              marginTop: 2,
            }}
          >
            {field.name}{unit ? ` · ${unit}` : ""}
            {field.kind === "number" && field.min !== undefined && field.max !== undefined &&
              ` · ${field.min}..${field.max}`}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {field.kind === "number" ? (
            <Stepper
              value={field.value as number}
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={field.step ?? 1}
              suffix=""
              onChange={onChange}
            />
          ) : (
            <Toggle
              value={field.value as boolean}
              onChange={onChange}
              ariaLabel={label}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────
function Loading() {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 24, fontFamily: "var(--mono)", color: "var(--dim)", textAlign: "center" }}>
      {t("common.loading")}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface2)", borderRadius: 9, padding: "8px 10px" }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.5625rem",
          color: "var(--muted)",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--display)", fontSize: "1rem", color: "var(--text)" }}>{value}</div>
    </div>
  );
}

function Big({ v, u }: { v: number; u: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--display)",
          fontSize: "2rem",
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.625rem",
          color: "var(--muted)",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {u}
      </div>
    </div>
  );
}

// silence unused import — Glyph is exported for downstream use.
void Glyph;
