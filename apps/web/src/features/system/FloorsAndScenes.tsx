// Floors + Scenes editors shown inside the System tab. Both persist
// through /data/state.json on the bridge side; UI stays optimistic via
// TanStack Query cache updates.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  type FloorAssignments,
  type RoomMode,
  type Scene,
  type SceneCreate,
  type SceneIcon,
  SCENE_ICONS,
  sceneModeWantsSetpoint,
} from "@rehau/types";
import { Card, Glyph, SectionHead, Stepper, btnStyle } from "../../components/ui";
import { useAuth } from "../../lib/auth";

const ROOM_MODES: RoomMode[] = ["standby", "normal", "reduced", "program"];

// Reasonable default when the user picks a setpoint-bearing mode for
// the first time. Inside REHAU's accepted range; the Stepper still
// enforces 5..35.
const DEFAULT_SCENE_SETPOINT = 21;

// ─── Floors editor ─────────────────────────────────────────────────────

export function FloorsEditor() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const roomsQ = useQuery({ queryKey: ["rooms"], queryFn: () => api.rooms.list() });
  const floorsQ = useQuery({ queryKey: ["floors"], queryFn: () => api.floors.get() });

  // Local draft — keyed by zone string for input control. Synced from the
  // server query result whenever it changes, but the user's in-progress
  // edits take priority until they hit Save.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!floorsQ.data || dirty) return;
    setDraft(floorsQ.data as Record<string, string>);
  }, [floorsQ.data, dirty]);

  const save = useMutation({
    mutationFn: () => api.floors.set(draft as FloorAssignments),
    onSuccess: (next) => {
      qc.setQueryData(["floors"], next);
      // Force room re-fetch so Home picks up the new floor labels.
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      setDirty(false);
      toast.success(t("system.floors.saved"));
    },
    onError: () => toast.error(t("system.floors.saveFailed")),
  });

  const rooms = roomsQ.data ?? [];
  if (rooms.length === 0) {
    return (
      <Card style={{ margin: "0 16px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--muted)" }}>
          {t("common.loading")}
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ margin: "0 16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rooms
          .slice()
          .sort((a, b) => a.zone - b.zone)
          .map((r) => {
            const value = draft[String(r.zone)] ?? "";
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--body)",
                      fontSize: "0.8125rem",
                      color: "var(--text)",
                    }}
                  >
                    {r.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "0.5625rem",
                      color: "var(--dim)",
                      letterSpacing: 0.5,
                    }}
                  >
                    {t("system.floors.zone", { n: r.zone })}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder={t("system.floors.placeholder")}
                  value={value}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, [String(r.zone)]: e.target.value }));
                    setDirty(true);
                  }}
                  style={{
                    width: 140,
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontFamily: "var(--body)",
                    fontSize: "0.8125rem",
                    padding: "6px 8px",
                  }}
                />
              </div>
            );
          })}
        {dirty && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                setDraft((floorsQ.data as Record<string, string>) ?? {});
                setDirty(false);
              }}
              style={{
                ...btnStyle("ghost", "sm"),
                fontSize: "0.75rem",
              }}
            >
              {t("installer.savebar.cancel")}
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              style={{
                ...btnStyle("primary", "sm"),
                fontSize: "0.75rem",
              }}
            >
              {save.isPending ? t("installer.savebar.saving") : t("installer.savebar.save")}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Scenes editor ─────────────────────────────────────────────────────

// `kind` toggles the editor between two action shapes:
//   - "global"  → action is `applyRoomMode` with one mode for every room
//   - "perRoom" → action is `perRoom` with a per-room map; "skip" means
//                 omit the room from the map entirely (left untouched
//                 when the scene fires)
type RoomModeOrSkip = RoomMode | "skip";
interface SceneFormState {
  id: string | null; // null = new
  name: string;
  icon: SceneIcon;
  kind: "global" | "perRoom";
  // Used when kind === "global".
  globalMode: RoomMode;
  // Only meaningful when globalMode is normal/reduced. Kept across
  // mode toggles so flipping normal↔reduced doesn't lose the value.
  globalSetpoint: number;
  // Used when kind === "perRoom". Keyed by room id; "skip" rooms get
  // serialised as missing entries in the persisted scene.
  perRoom: Record<string, RoomModeOrSkip>;
  // Parallel per-room setpoints; only the entries whose mode is
  // normal/reduced get serialised on save.
  perRoomSetpoints: Record<string, number>;
}

const emptySceneForm = (): SceneFormState => ({
  id: null,
  name: "",
  icon: "sun",
  kind: "global",
  globalMode: "normal",
  globalSetpoint: DEFAULT_SCENE_SETPOINT,
  perRoom: {},
  perRoomSetpoints: {},
});

const sceneToForm = (s: Scene): SceneFormState => {
  if (s.action.type === "applyRoomMode") {
    return {
      id: s.id,
      name: s.name,
      icon: s.icon,
      kind: "global",
      globalMode: s.action.mode,
      globalSetpoint: s.action.setpoint ?? DEFAULT_SCENE_SETPOINT,
      perRoom: {},
      perRoomSetpoints: {},
    };
  }
  // perRoom — fill the map verbatim. Any room not present is "skip".
  return {
    id: s.id,
    name: s.name,
    icon: s.icon,
    kind: "perRoom",
    globalMode: "normal",
    globalSetpoint: DEFAULT_SCENE_SETPOINT,
    perRoom: { ...s.action.rooms },
    perRoomSetpoints: { ...(s.action.setpoints ?? {}) },
  };
};

const formToPayload = (f: SceneFormState): SceneCreate => {
  if (f.kind === "global") {
    const wantsSp = sceneModeWantsSetpoint(f.globalMode);
    return {
      name: f.name.trim(),
      icon: f.icon,
      action: wantsSp
        ? { type: "applyRoomMode", mode: f.globalMode, setpoint: f.globalSetpoint }
        : { type: "applyRoomMode", mode: f.globalMode },
    };
  }
  // Strip "skip" entries before sending — only rooms the user explicitly
  // assigned a mode to should make it into the persisted scene.
  const rooms: Record<string, RoomMode> = {};
  const setpoints: Record<string, number> = {};
  for (const [roomId, mode] of Object.entries(f.perRoom)) {
    if (mode === "skip") continue;
    rooms[roomId] = mode;
    if (sceneModeWantsSetpoint(mode)) {
      setpoints[roomId] = f.perRoomSetpoints[roomId] ?? DEFAULT_SCENE_SETPOINT;
    }
  }
  return {
    name: f.name.trim(),
    icon: f.icon,
    action: Object.keys(setpoints).length > 0
      ? { type: "perRoom", rooms, setpoints }
      : { type: "perRoom", rooms },
  };
};

export function ScenesEditor() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const scenesQ = useQuery({ queryKey: ["scenes"], queryFn: () => api.scenes.list() });

  const [form, setForm] = useState<SceneFormState | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["scenes"] });
  };

  const create = useMutation({
    mutationFn: (input: SceneCreate) => api.scenes.create(input),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
    onError: () => toast.error(t("system.scenes.saveFailed")),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SceneCreate }) => api.scenes.update(id, input),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
    onError: () => toast.error(t("system.scenes.saveFailed")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.scenes.remove(id),
    onSuccess: invalidate,
  });

  // Rooms list is needed for the per-room editor below + to render the
  // human-readable summary of a perRoom scene in the list.
  const roomsQ = useQuery({ queryKey: ["rooms"], queryFn: () => api.rooms.list() });
  const rooms = roomsQ.data ?? [];
  const scenes = scenesQ.data ?? [];
  const canSave = useMemo(() => (form?.name.trim().length ?? 0) > 0, [form]);

  /** When the user switches the kind toggle: pre-fill the "other" half of
   * the form so they don't get an empty editor surface on flip. */
  const switchKind = (next: SceneFormState["kind"]) => {
    if (!form || form.kind === next) return;
    if (next === "perRoom") {
      // Seed perRoom map with the global mode for every existing room.
      const map: Record<string, RoomModeOrSkip> = {};
      for (const r of rooms) {
        // Use existing entry if present (re-toggle), else seed with current
        // global mode so the user starts with "apply to all" semantics.
        map[r.id] = form.perRoom[r.id] ?? form.globalMode;
      }
      setForm({ ...form, kind: "perRoom", perRoom: map });
    } else {
      setForm({ ...form, kind: "global" });
    }
  };

  return (
    <Card style={{ margin: "0 16px" }}>
      {scenes.length === 0 && form === null && (
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--muted)", marginBottom: 10 }}>
          {t("system.scenes.empty")}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {scenes.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 4px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <Glyph name={s.icon} size={18} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--body)", fontSize: "0.875rem", color: "var(--text)" }}>{s.name}</div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "0.625rem",
                  color: "var(--dim)",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {t(`roomMode.${s.action.type === "applyRoomMode" ? s.action.mode : "normal"}`)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm(sceneToForm(s))}
              style={{ ...btnStyle("ghost", "sm"), fontSize: "0.6875rem" }}
            >
              {t("system.scenes.edit")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("system.scenes.deleteConfirm", { name: s.name }))) {
                  remove.mutate(s.id);
                }
              }}
              style={{ ...btnStyle("ghost", "sm"), fontSize: "0.6875rem", color: "var(--alert)" }}
            >
              {t("system.scenes.delete")}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
        {form === null ? (
          <button
            type="button"
            onClick={() => setForm(emptySceneForm())}
            style={{ ...btnStyle("secondary", "sm"), fontSize: "0.75rem" }}
          >
            <Glyph name="plus" size={12} /> {t("system.scenes.add")}
          </button>
        ) : null}
      </div>

      {form && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div>
            <Label>{t("system.scenes.name")}</Label>
            <input
              type="text"
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("system.scenes.namePlaceholder")}
              style={{
                width: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontFamily: "var(--body)",
                fontSize: "0.875rem",
                padding: "8px 10px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <Label>{t("system.scenes.icon")}</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SCENE_ICONS.map((ic) => {
                const active = form.icon === ic;
                return (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm({ ...form, icon: ic })}
                    aria-label={ic}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: active
                        ? "color-mix(in oklab, var(--accent) 22%, transparent)"
                        : "var(--surface)",
                      color: active ? "var(--accent)" : "var(--muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Glyph name={ic} size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>{t("system.scenes.scope")}</Label>
            <div style={{ display: "flex", gap: 4 }}>
              {(["global", "perRoom"] as const).map((k) => {
                const active = form.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchKind(k)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: active ? "var(--accent)" : "transparent",
                      color: active ? "#1a1024" : "var(--muted)",
                      fontFamily: "var(--body)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t(`system.scenes.scope_${k}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {form.kind === "global" ? (
            <div>
              <Label>{t("system.scenes.mode")}</Label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {ROOM_MODES.map((m) => {
                  const active = form.globalMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, globalMode: m })}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "none",
                        background: active ? "var(--accent)" : "transparent",
                        color: active ? "#1a1024" : "var(--muted)",
                        fontFamily: "var(--body)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {t(`roomMode.${m}`)}
                    </button>
                  );
                })}
              </div>
              {sceneModeWantsSetpoint(form.globalMode) && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <Label>{t("system.scenes.setpoint")}</Label>
                  <Stepper
                    value={form.globalSetpoint}
                    onChange={(v) => setForm({ ...form, globalSetpoint: v })}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <Label>{t("system.scenes.perRoom")}</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rooms
                  .slice()
                  .sort((a, b) =>
                    (a.floor || "￿").localeCompare(b.floor || "￿") || a.name.localeCompare(b.name),
                  )
                  .map((r) => {
                    const cur = form.perRoom[r.id] ?? "skip";
                    const wantsSp = cur !== "skip" && sceneModeWantsSetpoint(cur);
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 0",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: "var(--body)",
                              fontSize: "0.8125rem",
                              color: "var(--text)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {r.name}
                          </div>
                          {r.floor && (
                            <div
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: "0.5625rem",
                                color: "var(--dim)",
                                letterSpacing: 0.5,
                              }}
                            >
                              {r.floor}
                            </div>
                          )}
                        </div>
                        <select
                          aria-label={r.name}
                          value={cur}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              perRoom: {
                                ...form.perRoom,
                                [r.id]: e.target.value as RoomModeOrSkip,
                              },
                            })
                          }
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                            fontFamily: "var(--body)",
                            fontSize: "0.75rem",
                            padding: "5px 8px",
                            borderRadius: 6,
                          }}
                        >
                          <option value="skip">{t("system.scenes.skip")}</option>
                          {ROOM_MODES.map((m) => (
                            <option key={m} value={m}>
                              {t(`roomMode.${m}`)}
                            </option>
                          ))}
                        </select>
                        {wantsSp && (
                          <div style={{ flexBasis: "100%", display: "flex", justifyContent: "flex-end" }}>
                            <Stepper
                              value={form.perRoomSetpoints[r.id] ?? DEFAULT_SCENE_SETPOINT}
                              onChange={(v) =>
                                setForm({
                                  ...form,
                                  perRoomSetpoints: { ...form.perRoomSetpoints, [r.id]: v },
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setForm(null)}
              style={{ ...btnStyle("ghost", "sm"), fontSize: "0.75rem" }}
            >
              {t("installer.savebar.cancel")}
            </button>
            <button
              type="button"
              disabled={!canSave || create.isPending || update.isPending}
              onClick={() => {
                const payload = formToPayload(form);
                if (form.id) update.mutate({ id: form.id, input: payload });
                else create.mutate(payload);
              }}
              style={{ ...btnStyle("primary", "sm"), fontSize: "0.75rem" }}
            >
              {create.isPending || update.isPending
                ? t("installer.savebar.saving")
                : t("installer.savebar.save")}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}
