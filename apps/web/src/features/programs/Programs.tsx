import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { DailyProgram, WeeklyProgram } from "@rehau/types";
import {
  AppHeader,
  Card,
  Glyph,
  ProgramStrip,
  SectionHead,
  Segmented,
  btnStyle,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";

const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const COMMIT_DEBOUNCE_MS = 500;

export function Programs() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"daily" | "weekly">("daily");
  const [selectedDaily, setSelectedDaily] = useState(1);
  const [selectedWeekly, setSelectedWeekly] = useState(1);

  // Lists — read from cache (seed data on first hit, real after refresh).
  const dailyListQ = useQuery({
    queryKey: ["programs", "daily"],
    queryFn: () => api.programs.listDaily(),
  });
  const weeklyListQ = useQuery({
    queryKey: ["programs", "weekly"],
    queryFn: () => api.programs.listWeekly(),
  });

  // Active program detail — fetched fresh from device on first selection.
  const dailyQ = useQuery({
    queryKey: ["program", "daily", selectedDaily],
    queryFn: () => api.programs.getDaily(selectedDaily, true),
  });
  const weeklyQ = useQuery({
    queryKey: ["program", "weekly", selectedWeekly],
    queryFn: () => api.programs.getWeekly(selectedWeekly, true),
  });

  const saveDaily = useMutation({
    mutationFn: ({ id, bits }: { id: number; bits: number[] }) => api.programs.setDaily(id, bits),
    onSuccess: (p) => {
      qc.setQueryData(["program", "daily", p.id], p);
      void qc.invalidateQueries({ queryKey: ["programs", "daily"] });
    },
  });
  const saveWeekly = useMutation({
    mutationFn: (input: { id: number; days: WeeklyProgram["days"] }) =>
      api.programs.setWeekly(input.id, {
        monday: input.days[0],
        tuesday: input.days[1],
        wednesday: input.days[2],
        thursday: input.days[3],
        friday: input.days[4],
        saturday: input.days[5],
        sunday: input.days[6],
      }),
    onError: () => {
      void qc.invalidateQueries({ queryKey: ["program", "weekly", selectedWeekly] });
    },
    onSuccess: (p) => {
      qc.setQueryData(["program", "weekly", p.id], p);
      void qc.invalidateQueries({ queryKey: ["programs", "weekly"] });
    },
  });

  const dp: DailyProgram | undefined = dailyQ.data;
  const wp: WeeklyProgram | undefined = weeklyQ.data;

  // Debounced commit for weekly day +/- — the user often pages through 1..10
  // and we want a single POST after they settle, not one per click.
  const pendingDays = useRef<WeeklyProgram["days"] | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushWeekly = useCallback((): void => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    const d = pendingDays.current;
    pendingDays.current = null;
    if (d && wp) saveWeekly.mutate({ id: wp.id, days: d });
  }, [saveWeekly, wp]);

  /** delta = ±1, wraps at 1..10. Optimistic + debounced. */
  const adjustDay = useCallback((dayIdx: number, delta: 1 | -1): void => {
    if (!wp) return;
    const base = pendingDays.current ?? wp.days;
    const cur = base[dayIdx] ?? 1;
    let next = cur + delta;
    if (next < 1) next = 10;
    if (next > 10) next = 1;
    const days = [...base] as WeeklyProgram["days"];
    days[dayIdx] = next;
    pendingDays.current = days;

    qc.setQueryData<WeeklyProgram>(["program", "weekly", wp.id], (prev) =>
      prev ? { ...prev, days } : prev,
    );

    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(flushWeekly, COMMIT_DEBOUNCE_MS);
  }, [wp, qc, flushWeekly]);

  // Flush on unmount / tab switch so we don't lose pending edits.
  useEffect(() => () => flushWeekly(), [flushWeekly]);

  return (
    <div style={{ paddingBottom: 110, maxWidth: 420, margin: "0 auto" }}>
      <AppHeader title={t("programs.title")} subtitle={t("programs.subtitle")}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "daily" as const, label: t("programs.daily") },
            { value: "weekly" as const, label: t("programs.weekly") },
          ]}
        />
      </AppHeader>

      {tab === "daily" ? (
        <>
          <SectionHead title={t("programs.selectDaily")} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, 1fr)",
              gap: 6,
              padding: "0 16px",
            }}
          >
            {(dailyListQ.data ?? []).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDaily(d.id)}
                style={{
                  ...btnStyle(d.id === selectedDaily ? "primary" : "ghost", "sm"),
                  padding: "8px 0",
                  borderRadius: 999,
                }}
              >
                {d.id}{d.name && ` · ${d.name}`}
              </button>
            ))}
          </div>

          <SectionHead
            title={
              dp
                ? dp.name
                  ? t("programs.dailyTitleNamed", { id: dp.id, name: dp.name })
                  : t("programs.dailyTitle", { id: dp.id })
                : t("programs.titleLoading")
            }
            action={
              saveDaily.isPending && (
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.625rem", color: "var(--accent)" }}>
                  {t("programs.saving")}
                </span>
              )
            }
          />
          {dp && (
            <Card style={{ margin: "0 16px" }}>
              <TimelineEditor
                bits={dp.bits}
                onChange={(b) => saveDaily.mutate({ id: dp.id, bits: b })}
                disabled={saveDaily.isPending}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 12,
                  fontFamily: "var(--mono)",
                  fontSize: "0.6875rem",
                  color: "var(--muted)",
                }}
              >
                <span>{t("programs.hoursPresence", { h: dp.bits.filter((b) => b).length / 4 })}</span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 10px",
                  borderRadius: 9,
                  background: "var(--surface2)",
                  fontFamily: "var(--mono)",
                  fontSize: "0.625rem",
                  color: "var(--dim)",
                  letterSpacing: 0.5,
                }}
              >
                {t("programs.legend")}
              </div>
              {saveDaily.isError && (
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: "var(--mono)",
                    fontSize: "0.625rem",
                    color: "var(--alert)",
                    textAlign: "center",
                  }}
                >
                  {t("programs.saveFailedRetry")}
                </div>
              )}
            </Card>
          )}
        </>
      ) : (
        <>
          <SectionHead title={t("programs.selectWeekly")} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 6,
              padding: "0 16px",
            }}
          >
            {(weeklyListQ.data ?? []).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeekly(w.id)}
                style={{
                  ...btnStyle(w.id === selectedWeekly ? "primary" : "ghost", "sm"),
                  padding: "8px 0",
                  borderRadius: 999,
                }}
              >
                {w.id}{w.name && ` · ${w.name}`}
              </button>
            ))}
          </div>

          <SectionHead
            title={
              wp
                ? wp.name
                  ? t("programs.weeklyTitleNamed", { id: wp.id, name: wp.name })
                  : t("programs.weeklyTitle", { id: wp.id })
                : t("programs.titleLoading")
            }
            action={
              saveWeekly.isPending && (
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.625rem", color: "var(--accent)" }}>
                  {t("programs.saving")}
                </span>
              )
            }
          />
          {wp && (
            <Card style={{ margin: "0 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {WEEKDAY_KEYS.map((wk, i) => (
                  <div key={wk} style={{ textAlign: "center" }}>
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
                      {t(`weekdays.short.${wk}`)}
                    </div>
                    <DayStepper
                      value={wp.days[i] ?? 1}
                      labelKey={wk}
                      onInc={() => adjustDay(i, 1)}
                      onDec={() => adjustDay(i, -1)}
                    />
                  </div>
                ))}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "0.625rem",
                  color: "var(--dim)",
                  marginTop: 10,
                  textAlign: "center",
                  letterSpacing: 0.5,
                }}
              >
                {t("programs.daysHelp")}
              </div>
              {saveWeekly.isError && (
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: "var(--mono)",
                    fontSize: "0.625rem",
                    color: "var(--alert)",
                    textAlign: "center",
                  }}
                >
                  {t("programs.saveFailedRetry")}
                </div>
              )}
            </Card>
          )}

          {wp && (dailyListQ.data ?? []).length > 0 && (
            <>
              <SectionHead title={t("programs.weeklyPreview")} />
              <Card style={{ margin: "0 16px" }}>
                {/* Hour markers row above the strips — same alignment trick as the
                    rows below: a 28-px spacer matches the weekday label width. */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 28, flexShrink: 0 }} />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--mono)",
                      fontSize: "0.5625rem",
                      color: "var(--dim)",
                      letterSpacing: 0.3,
                    }}
                  >
                    {[0, 6, 12, 18, 24].map((h) => (
                      <span key={h}>{h.toString().padStart(2, "0")}</span>
                    ))}
                  </div>
                </div>
                {wp.days.map((dailyId, i) => {
                  const day = (dailyListQ.data ?? []).find((d) => d.id === dailyId);
                  if (!day) return null;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: i === 6 ? 0 : 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "0.625rem",
                          color: "var(--muted)",
                          width: 28,
                          flexShrink: 0,
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        {t(`weekdays.micro.${WEEKDAY_KEYS[i]}`)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <ProgramStrip bits={day.bits} />
                      </div>
                    </div>
                  );
                })}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Vertical +/value/- control for picking a daily program id (1..10) per
 * weekday. Wraps at the edges (1 → 10, 10 → 1). Visually a stack:
 *
 *     ┌─────┐
 *     │  +  │   onInc
 *     │─────│
 *     │  N  │   current value, read-only
 *     │─────│
 *     │  −  │   onDec
 *     └─────┘
 */
function DayStepper({
  value,
  labelKey,
  onInc,
  onDec,
}: {
  value: number;
  labelKey: string | undefined;
  onInc: () => void;
  onDec: () => void;
}) {
  const { t } = useTranslation();
  const dayName = labelKey ? t(`weekdays.long.${labelKey}`) : t("programs.fallbackDay");
  const sidebarBtn = {
    width: "100%",
    padding: "4px 0",
    border: "1px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--accent)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "manipulation" as const,
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 9,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      <button
        type="button"
        aria-label={t("programs.incrementAria", { day: dayName })}
        onClick={onInc}
        style={{ ...sidebarBtn, borderTop: 0, borderLeft: 0, borderRight: 0 }}
      >
        <Glyph name="plus" size={12} />
      </button>
      <div
        style={{
          padding: "8px 0",
          background: "var(--surface)",
          color: "var(--accent)",
          fontFamily: "var(--display)",
          fontSize: "1.25rem",
          fontWeight: 600,
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
          userSelect: "none",
        }}
      >
        {value}
      </div>
      <button
        type="button"
        aria-label={t("programs.decrementAria", { day: dayName })}
        onClick={onDec}
        style={{ ...sidebarBtn, borderBottom: 0, borderLeft: 0, borderRight: 0 }}
      >
        <Glyph name="minus" size={12} />
      </button>
    </div>
  );
}

/**
 * Drag-to-paint timeline: 24 columns × 4 rows of 15-min cells. When the user
 * presses on a cell we lock in a target value (the opposite of that cell) and
 * paint every cell the pointer enters until release. Changes commit on
 * pointer-up so the device sees at most one write per gesture.
 */
function TimelineEditor({
  bits,
  onChange,
  disabled,
}: {
  bits: number[];
  onChange: (bits: number[]) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState<number[] | null>(null);
  const [paint, setPaint] = useState<number | null>(null);
  const current = local ?? bits;

  const apply = (idx: number, v: number): void => {
    const next = (local ?? bits).slice();
    next[idx] = v;
    setLocal(next);
  };

  const commit = (): void => {
    if (paint === null) return;
    setPaint(null);
    if (local) onChange(local);
    setLocal(null);
  };

  const HOUR_LABEL: React.CSSProperties = {
    fontFamily: "var(--mono)",
    fontSize: "0.5rem",
    color: "var(--dim)",
    lineHeight: 1,
    letterSpacing: 0.2,
  };

  return (
    <div
      onPointerLeave={() => setPaint(null)}
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
    >
      {/* Top hour markers: 00..23 — the *start* of each column. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(24, 1fr)",
          gap: 1,
          marginBottom: 3,
        }}
      >
        {Array.from({ length: 24 }).map((_, h) => (
          <span key={h} style={{ ...HOUR_LABEL, textAlign: "left" }}>
            {h.toString().padStart(2, "0")}
          </span>
        ))}
      </div>

      {/* 24 × 4 timeline grid. Each cell shows its quarter-hour offset
           (:00, :15, :30, :45) so it's obvious that the four rows are the
           four 15-minute slices of one hour. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 1, height: 80 }}>
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[0, 1, 2, 3].map((q) => {
              const idx = h * 4 + q;
              const b = current[idx] ?? 0;
              return (
                <div
                  key={q}
                  onPointerDown={() => {
                    const target = b ? 0 : 1;
                    setPaint(target);
                    apply(idx, target);
                  }}
                  onPointerEnter={() => {
                    if (paint !== null) apply(idx, paint);
                  }}
                  onPointerUp={commit}
                  style={{
                    flex: 1,
                    background: b ? "var(--accent)" : "var(--surface2)",
                    borderRadius: 2,
                    cursor: "pointer",
                    opacity: b ? 0.9 : 0.75,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--mono)",
                    fontSize: "0.4375rem",
                    fontWeight: 600,
                    color: b ? "#1a1024" : "var(--muted)",
                    letterSpacing: 0,
                    userSelect: "none",
                    lineHeight: 1,
                  }}
                >
                  {(q * 15).toString().padStart(2, "0")}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom hour markers: 01..24 — the *end* of each column. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(24, 1fr)",
          gap: 1,
          marginTop: 3,
        }}
      >
        {Array.from({ length: 24 }).map((_, h) => (
          <span key={h} style={{ ...HOUR_LABEL, textAlign: "right" }}>
            {(h + 1).toString().padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}
