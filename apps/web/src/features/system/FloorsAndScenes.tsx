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
} from "@rehau/types";
import { Card, Glyph, SectionHead, btnStyle } from "../../components/ui";
import { useAuth } from "../../lib/auth";

const ROOM_MODES: RoomMode[] = ["standby", "normal", "reduced", "program"];

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

interface SceneFormState {
  id: string | null; // null = new
  name: string;
  icon: SceneIcon;
  mode: RoomMode;
}

const emptySceneForm = (): SceneFormState => ({
  id: null,
  name: "",
  icon: "sun",
  mode: "normal",
});

const sceneToForm = (s: Scene): SceneFormState => ({
  id: s.id,
  name: s.name,
  icon: s.icon,
  mode: s.action.type === "applyRoomMode" ? s.action.mode : "normal",
});

const formToPayload = (f: SceneFormState): SceneCreate => ({
  name: f.name.trim(),
  icon: f.icon,
  action: { type: "applyRoomMode", mode: f.mode },
});

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

  const scenes = scenesQ.data ?? [];
  const canSave = useMemo(() => (form?.name.trim().length ?? 0) > 0, [form]);

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
            <Label>{t("system.scenes.mode")}</Label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {ROOM_MODES.map((m) => {
                const active = form.mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, mode: m })}
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
          </div>

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
