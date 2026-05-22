import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { seedDailyPrograms } from "@rehau/types/mocks";
import type { RoomMode } from "@rehau/types";
import {
  AppHeader,
  Banner,
  Card,
  Glyph,
  ModePill,
  ProgramStrip,
  SectionHead,
  btnStyle,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { fmtClock, labelSystemMode, staleSec } from "../../lib/labels";

const SCENES: { id: string; key: string; icon: string; mode: RoomMode }[] = [
  { id: "stby", key: "home.sceneStandby", icon: "moon",     mode: "standby" },
  { id: "eve",  key: "home.sceneEvening", icon: "flame",    mode: "normal" },
  { id: "away", key: "home.sceneAway",    icon: "calendar", mode: "reduced" },
  { id: "norm", key: "home.sceneNormal",  icon: "sun",      mode: "normal" },
];

export function Dashboard({ onOpenRoom }: { onOpenRoom: (id: string) => void }) {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const sys = useQuery({ queryKey: ["system"], queryFn: () => api.system.get(), refetchInterval: 5000 });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api.rooms.list(), refetchInterval: 5000 });

  const applyScene = useMutation({
    mutationFn: async (mode: RoomMode) => {
      const list = rooms.data ?? [];
      for (const r of list) {
        await api.rooms.setMode(r.id, mode);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const system = sys.data;

  return (
    <div style={{ paddingBottom: 110, maxWidth: 420, margin: "0 auto" }}>
      {system && !system.reachable && (
        <Banner tone="alert">{t("home.readonlyBanner")}</Banner>
      )}

      <AppHeader
        title={system?.installationName ?? t("home.house")}
        subtitle={
          system
            ? `${fmtClock(now)} · ${t("home.outdoorLabel")} ${system.outdoorTemp.toFixed(1)}°C · ${labelSystemMode(system.operatingMode)}`
            : "…"
        }
        right={
          system && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "0.625rem",
                  color: "var(--muted)",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {t("common.energy")}
              </span>
              <ModePill mode={system.energyLevel} />
            </div>
          )
        }
      />

      <SectionHead title={t("home.scenes")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 16px" }}>
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={applyScene.isPending}
            onClick={() => applyScene.mutate(s.mode)}
            style={{
              ...btnStyle("secondary", "md"),
              flexDirection: "column",
              padding: "12px 6px",
              gap: 6,
              fontSize: "0.6875rem",
            }}
          >
            <Glyph name={s.icon} size={20} color="var(--accent)" />
            {t(s.key)}
          </button>
        ))}
      </div>

      <SectionHead
        title={t("home.rooms", { count: rooms.data?.length ?? 0 })}
        action={
          <button
            type="button"
            style={{ ...btnStyle("ghost", "sm"), borderColor: "transparent" }}
            onClick={() => {
              void qc.invalidateQueries({ queryKey: ["rooms"] });
              void qc.invalidateQueries({ queryKey: ["system"] });
            }}
          >
            <Glyph name="refresh" size={12} /> {t("common.refresh")}
          </button>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 16px" }}>
        {(rooms.data ?? []).map((r) => {
          // Program bits only make sense when the room is actually following a
          // schedule — hiding them otherwise reduces visual noise on the card.
          const showProgram = r.mode === "program" || r.mode === "program_override";
          const dp = showProgram
            ? (seedDailyPrograms.find((d) => d.id === r.programDailyId) ?? seedDailyPrograms[0]!)
            : null;
          return (
            <Card
              key={r.id}
              staleSeconds={staleSec(r.meta.lastUpdatedAt)}
              onClick={() => onOpenRoom(r.id)}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--display)",
                        fontSize: "1.375rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        letterSpacing: -0.5,
                      }}
                    >
                      {r.name}
                    </span>
                    {r.floor && (
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "0.625rem",
                          color: "var(--dim)",
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        {r.floor}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 8, alignItems: "baseline" }}>
                    <div>
                      <span
                        style={{
                          fontFamily: "var(--display)",
                          fontSize: "2.125rem",
                          fontWeight: 500,
                          color: "var(--text)",
                          letterSpacing: -1,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {r.temperature !== null ? r.temperature.toFixed(1) : "—"}
                      </span>
                      <span style={{ color: "var(--muted)", fontFamily: "var(--display)", fontSize: "1.125rem", marginLeft: 2 }}>
                        °C
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--cool)" }}>
                      <Glyph name="drop" size={14} />
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.75rem" }}>
                        {r.humidity !== null ? `${r.humidity}%` : "—"}
                      </span>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "0.5625rem",
                          color: "var(--dim)",
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        {t("common.setpoint")}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--display)",
                          fontSize: "1.125rem",
                          color: "var(--heat)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {r.setpointHeating !== null ? `${r.setpointHeating.toFixed(1)}°` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <ModePill mode={r.mode} />
                {r.hasFan && (
                  <span
                    className={r.fanRunning ? "rehau-fan-spin" : undefined}
                    style={{ display: "inline-flex" }}
                  >
                    <Glyph
                      name="fan"
                      size={14}
                      color={r.fanRunning ? "var(--accent)" : "var(--muted)"}
                    />
                  </span>
                )}
                {r.hasLight && (
                  // Warm-yellow + soft glow when on; muted grey when off.
                  // Using --accent (purple) didn't read as "a lit lamp", which
                  // is the whole point of this affordance.
                  <span
                    style={{
                      display: "inline-flex",
                      filter: r.light
                        ? "drop-shadow(0 0 6px rgba(255, 207, 102, 0.85))"
                        : "none",
                    }}
                  >
                    <Glyph
                      name="sun"
                      size={14}
                      color={r.light ? "#FFCF66" : "var(--muted)"}
                    />
                  </span>
                )}
                <div style={{ flex: 1 }} />
              </div>
              {dp && (
                <div style={{ marginTop: 10 }}>
                  <ProgramStrip bits={dp.bits} hour={hour} />
                </div>
              )}
            </Card>
          );
        })}
        {rooms.isLoading && (
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--dim)", textAlign: "center" }}>
            {t("common.loading")}
          </div>
        )}
        {rooms.isError && (
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--alert)", textAlign: "center" }}>
            {t("common.deviceUnreachable")}
          </div>
        )}
      </div>
    </div>
  );
}
