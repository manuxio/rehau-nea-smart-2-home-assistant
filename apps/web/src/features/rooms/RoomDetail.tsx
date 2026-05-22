import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Room, RoomMode } from "@rehau/types";
import {
  Banner,
  Card,
  ControlRow,
  Glyph,
  SectionHead,
  Segmented,
  SetpointDial,
  Toggle,
  btnStyle,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { canWrite, useConnection } from "../../lib/connection";
import { fmtRelTime } from "../../lib/labels";

const ROOM_MODE_VALUES: RoomMode[] = ["standby", "normal", "reduced", "program"];

const COMMIT_DEBOUNCE_MS = 350;

function FlagRow({
  icon,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  icon: string;
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Card padding={12}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--surface2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: value ? "var(--accent)" : "var(--muted)",
            flexShrink: 0,
          }}
        >
          <Glyph name={icon} size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text)", fontFamily: "var(--body)", fontSize: "0.875rem" }}>{label}</div>
          <div style={{ color: "var(--muted)", fontFamily: "var(--body)", fontSize: "0.6875rem", marginTop: 2 }}>
            {hint}
          </div>
        </div>
        <Toggle value={value} disabled={disabled ?? false} ariaLabel={label} onChange={onChange} />
      </div>
    </Card>
  );
}

export function RoomDetail({ roomId, onBack }: { roomId: string; onBack: () => void }) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const { t } = useTranslation();

  // Local "edit" value while the user is dragging. When set, it shadows the
  // server value and pauses the refetch loop so polls don't snap us back.
  const [edit, setEdit] = useState<number | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [committing, setCommitting] = useState(false);

  /**
   * Optimistic-update helper for boolean/enum room mutations.
   *
   * Without this, a click on the toggle would briefly snap back: REHAU's
   * read-merge-write is slow, and the 5-second poll can fire mid-flight and
   * return the OLD value, which overwrites the cache. We:
   *   1. snapshot the current room,
   *   2. write the new partial into the cache immediately (toggle moves now),
   *   3. cancel any in-flight refetch so it can't clobber us,
   *   4. on error, roll back to the snapshot.
   * The mutation's onSuccess then writes the authoritative server response.
   */
  const optimisticPatch = async (patch: Partial<Room>): Promise<{ previous: Room | null }> => {
    await qc.cancelQueries({ queryKey: ["room", roomId] });
    const previous = qc.getQueryData<Room>(["room", roomId]) ?? null;
    if (previous) qc.setQueryData<Room>(["room", roomId], { ...previous, ...patch });
    return { previous };
  };
  const rollback = (ctx: { previous: Room | null } | undefined): void => {
    if (ctx?.previous) qc.setQueryData(["room", roomId], ctx.previous);
    toast.error(t("toast.saveFailed"));
  };

  // Any in-flight mutation pauses the poll so a late response from REHAU
  // can't overwrite our optimistic state.
  const setSetpoint = useMutation({
    mutationFn: (value: number) => api.rooms.setSetpoint(roomId, value),
    onSuccess: (r: Room) => {
      qc.setQueryData(["room", roomId], r);
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success(t("toast.setpointAt", { room: r.name, value: r.setpointHeating?.toFixed(1) ?? "—" }));
    },
    onError: () => toast.error(t("toast.saveFailed")),
    onSettled: () => {
      setEdit(null);
      setCommitting(false);
    },
  });
  const setMode = useMutation({
    mutationFn: (mode: RoomMode) => api.rooms.setMode(roomId, mode),
    onMutate: (mode) => optimisticPatch({ mode }),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSuccess: (r: Room) => {
      qc.setQueryData(["room", roomId], r);
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success(t("toast.roomMode", { room: r.name, mode: t(`roomMode.${r.mode}`) }));
    },
  });
  const setLight = useMutation({
    mutationFn: (next: boolean) => api.rooms.setLight(roomId, next),
    onMutate: (next) => optimisticPatch({ light: next }),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSuccess: (r: Room) => {
      qc.setQueryData(["room", roomId], r);
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success(
        t("toast.roomLight", {
          room: r.name,
          state: r.light ? t("toast.lightOn") : t("toast.lightOff"),
        }),
      );
    },
  });
  const setFlags = useMutation({
    mutationFn: (patch: { lock?: boolean; autoStart?: boolean; windowDetection?: boolean }) =>
      api.rooms.setFlags(roomId, patch),
    onMutate: (patch) => optimisticPatch(patch),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSuccess: (r: Room) => {
      qc.setQueryData(["room", roomId], r);
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success(t("toast.roomUpdated", { room: r.name }));
    },
  });

  // Pause poll while any write is in flight so a stale REHAU response
  // can't overwrite the optimistic cache.
  const writing =
    setSetpoint.isPending ||
    setMode.isPending ||
    setLight.isPending ||
    setFlags.isPending;

  const roomQ = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => api.rooms.get(roomId),
    refetchInterval: edit !== null || committing || writing ? false : 5000,
  });
  const sysQ = useQuery({ queryKey: ["system"], queryFn: () => api.system.get(), refetchInterval: 5000 });
  // IMPORTANT: must sit ABOVE the `if (!room) return …` early return below
  // so React's hook order stays stable across renders. Moving it down past
  // the conditional return triggered React error #310.
  const { state: connState } = useConnection();

  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  const room = roomQ.data;
  const sys = sysQ.data;
  const isCooling = sys?.operatingMode.includes("cooling") ?? false;

  if (!room) {
    return (
      <div style={{ padding: 24, fontFamily: "var(--mono)", color: "var(--dim)", textAlign: "center" }}>
        …
      </div>
    );
  }

  const serverSp = isCooling ? room.setpointCooling : room.setpointHeating;
  const sp = edit ?? serverSp;
  // Disable every write surface while REHAU is fully unreachable —
  // queued mutations against a dead socket would just toast errors.
  // "degraded" still allows writes (REHAU is just slow); we keep
  // optimistic UI and let TanStack Query retry naturally.
  const writesDisabled = !canWrite(connState);
  const dialDisabled = room.mode === "standby" || writesDisabled;

  /**
   * The setpoint dial fires onChange on every pointer event during a drag.
   * We keep the visual in sync via `edit`, and only POST after the user has
   * been quiet for COMMIT_DEBOUNCE_MS. This stops the device from being
   * hammered and lets us pause polling for the duration of the edit.
   */
  const handleDial = (v: number): void => {
    if (dialDisabled) return;
    setEdit(v);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      setCommitting(true);
      setSetpoint.mutate(v);
    }, COMMIT_DEBOUNCE_MS);
  };

  // ± buttons fire immediately — no debounce needed for one tap.
  const bump = (delta: number): void => {
    if (dialDisabled) return;
    // We never call bump when setpoint is unknown — the dial is disabled in
    // that state — but guard explicitly so TypeScript can narrow `sp` away
    // from null and so a stray gesture can't fire a write with NaN.
    if (sp === null) return;
    const min = isCooling ? 15 : 5;
    const max = isCooling ? 35 : 31;
    const next = Math.max(min, Math.min(max, Math.round((sp + delta) * 2) / 2));
    setEdit(next);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      setCommitting(true);
      setSetpoint.mutate(next);
    }, COMMIT_DEBOUNCE_MS);
  };

  return (
    <div style={{ paddingBottom: 110, maxWidth: 420, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 16px 0",
        }}
      >
        <button type="button" onClick={onBack} style={btnStyle("ghost", "sm")}>
          <Glyph name="chevron-left" size={16} /> {t("room.back")}
        </button>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.625rem",
            color: "var(--dim)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {committing ? t("common.saving") : t("room.updatedAgo", { when: fmtRelTime(room.meta.lastUpdatedAt) })}
        </span>
      </div>

      <div style={{ padding: "16px 16px 0", textAlign: "center" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--display)",
            fontWeight: 600,
            fontSize: "2rem",
            letterSpacing: -0.8,
            color: "var(--text)",
          }}
        >
          {room.name}
        </h1>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)", marginTop: 4 }}>
          {room.floor && `${room.floor.toUpperCase()} · `}{t("room.zone", { n: room.zone })}
        </div>
      </div>

      {room.mode === "program_override" && (
        <Banner tone="info">{t("room.overrideActive")}</Banner>
      )}
      {dialDisabled && (
        <Banner tone="info">{t("room.standbyNotice")}</Banner>
      )}

      <SectionHead title={t("room.sectionMode")} />
      <div style={{ padding: "0 16px", opacity: setMode.isPending ? 0.6 : 1 }}>
        <Segmented<RoomMode>
          value={room.mode === "program_override" ? "program" : room.mode}
          onChange={(m) => {
            if (commitTimer.current) clearTimeout(commitTimer.current);
            setEdit(null);
            setMode.mutate(m);
          }}
          options={ROOM_MODE_VALUES.map((v) => ({ value: v, label: t(`roomMode.${v}`) }))}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "16px 0 8px",
          // Disable the dial while we still don't have a setpoint to draw —
          // the SetpointDial expects concrete numbers (it'd render NaN /
          // crash otherwise). Same visual treatment as "standby" disabled.
          opacity: dialDisabled || sp === null ? 0.4 : 1,
          transition: "opacity .2s",
          pointerEvents: dialDisabled || sp === null ? "none" : "auto",
        }}
      >
        {sp !== null ? (
          <SetpointDial
            value={sp}
            onChange={handleDial}
            current={room.temperature ?? sp}
            mode={isCooling ? "cooling" : "heating"}
            min={isCooling ? 15 : 5}
            max={isCooling ? 35 : 31}
            size={280}
          />
        ) : (
          <div
            style={{
              width: 280,
              height: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--mono)",
              fontSize: "0.75rem",
              color: "var(--dim)",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {t("common.loading")}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          padding: "0 0 12px",
          opacity: dialDisabled ? 0.4 : 1,
        }}
      >
        <button
          type="button"
          aria-label={t("room.decreaseSetpoint")}
          disabled={dialDisabled}
          onClick={() => bump(-0.5)}
          style={{ ...btnStyle("secondary", "md"), width: 56, height: 56, borderRadius: 999, padding: 0 }}
        >
          <Glyph name="minus" size={18} />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            fontFamily: "var(--mono)",
            fontSize: "0.6875rem",
            color: "var(--muted)",
          }}
        >
          <Glyph name="drop" size={13} color="var(--cool)" />
          <span style={{ color: "var(--text)", fontSize: "0.875rem" }}>{room.humidity}%</span>
        </div>
        <button
          type="button"
          aria-label={t("room.increaseSetpoint")}
          disabled={dialDisabled}
          onClick={() => bump(0.5)}
          style={{ ...btnStyle("secondary", "md"), width: 56, height: 56, borderRadius: 999, padding: 0 }}
        >
          <Glyph name="plus" size={18} />
        </button>
      </div>

      <SectionHead title={t("room.sectionPreferences")} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <FlagRow
          icon="sliders"
          label={t("room.lockTitle")}
          hint={t("room.lockHint")}
          value={room.lock}
          disabled={setFlags.isPending}
          onChange={(v) => setFlags.mutate({ lock: v })}
        />
        <FlagRow
          icon="clock"
          label={t("room.autoStartTitle")}
          hint={t("room.autoStartHint")}
          value={room.autoStart}
          disabled={setFlags.isPending}
          onChange={(v) => setFlags.mutate({ autoStart: v })}
        />
        <FlagRow
          icon="snow"
          label={t("room.windowDetTitle")}
          hint={t("room.windowDetHint")}
          value={room.windowDetection}
          disabled={setFlags.isPending}
          onChange={(v) => setFlags.mutate({ windowDetection: v })}
        />
      </div>

      {(room.hasFan || room.hasFlap || room.hasLight) && (
        <>
          <SectionHead title={t("room.sectionAccessories")} />
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {room.hasFan && (
              <ControlRow
                icon="fan"
                label={t("room.fan")}
                value={
                  room.fanRunning
                    ? t("room.fanRunning", { speed: t(`room.fanSpeeds.${room.fan}`) })
                    : t("room.fanIdle")
                }
              />
            )}
            {room.hasFlap && (
              <ControlRow
                icon="sliders"
                label={t("room.flap")}
                value={room.flap ? t("room.flapOpen") : t("room.flapClose")}
              />
            )}
            {room.hasLight && (
              <Card padding={12}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--surface2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: room.light ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    <Glyph name="sun" size={16} />
                  </div>
                  <span style={{ flex: 1, color: "var(--text)", fontFamily: "var(--body)", fontSize: "0.875rem" }}>
                    {t("room.light")}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "0.6875rem",
                      color: room.light ? "var(--on)" : "var(--dim)",
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      marginRight: 4,
                    }}
                  >
                    {room.light ? t("room.lightOn") : t("room.lightOff")}
                  </span>
                  <Toggle
                    value={room.light}
                    disabled={setLight.isPending}
                    ariaLabel={t("room.lightAria")}
                    onChange={(next) => setLight.mutate(next)}
                  />
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Calibration is an installer-only reading — `null` until the
          installer endpoint has been fetched at least once. We keep the
          section visible so the user can see the placeholder ("—") and
          knows the slot exists; the bridge mirrors values into Room when
          /api/v1/installer/calibration runs (e.g. on Installer tab open). */}
      <SectionHead title={t("room.sectionCalibration")} />
      <Card style={{ margin: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: "0.75rem" }}>
          <span style={{ color: "var(--muted)" }}>{t("room.offsetTemp")}</span>
          <span style={{ color: "var(--text)" }}>
            {room.calibrationTemp === null
              ? "—"
              : `${room.calibrationTemp >= 0 ? "+" : ""}${room.calibrationTemp.toFixed(1)} °C`}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--mono)",
            fontSize: "0.75rem",
            marginTop: 6,
          }}
        >
          <span style={{ color: "var(--muted)" }}>{t("room.offsetHum")}</span>
          <span style={{ color: "var(--text)" }}>
            {room.calibrationHumidity === null
              ? "—"
              : `${room.calibrationHumidity >= 0 ? "+" : ""}${room.calibrationHumidity} %`}
          </span>
        </div>
      </Card>

      {(setSetpoint.isError || setMode.isError || setFlags.isError) && (
        <div
          style={{
            margin: "16px 16px 0",
            fontFamily: "var(--mono)",
            fontSize: "0.6875rem",
            color: "var(--alert)",
            textAlign: "center",
          }}
        >
          {t("room.commandFailed")}
        </div>
      )}
    </div>
  );
}
