import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { alarmCodeLookup } from "@rehau/types/mocks";
import {
  AppHeader,
  Card,
  Glyph,
  SEVERITY_COLOR,
  Toggle,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { fmtRelTime } from "../../lib/labels";

export function Messages() {
  const { api } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [activeOnly, setActiveOnly] = useState(false);
  const q = useQuery({ queryKey: ["messages"], queryFn: () => api.messages.list(false), refetchInterval: 15_000 });
  const all = q.data ?? [];
  const list = activeOnly ? all.filter((a) => !a.resolvedAt) : all;
  const activeCount = all.filter((a) => !a.resolvedAt).length;

  // POST /api/v1/messages/clear → REHAU's "acknowledge all" form. The
  // bridge wipes the cached message list too, so the SPA shows zero
  // messages instantly without waiting for the next poll.
  const clear = useMutation({
    mutationFn: () => api.messages.clear(),
    onSuccess: () => {
      qc.setQueryData(["messages"], []);
      toast.success(t("messages.cleared"));
    },
    onError: () => toast.error(t("messages.clearFailed")),
  });

  return (
    <div style={{ paddingBottom: 110, maxWidth: 420, margin: "0 auto" }}>
      <AppHeader title={t("messages.title")} subtitle={t("messages.summary", { active: activeCount, total: all.length })}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontFamily: "var(--body)", fontSize: "0.875rem", color: "var(--text)" }}>{t("messages.activeOnly")}</span>
          <Toggle value={activeOnly} onChange={setActiveOnly} />
        </div>
        {all.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("messages.clearConfirm"))) clear.mutate();
              }}
              disabled={clear.isPending}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: clear.isPending ? "var(--muted)" : "var(--alert)",
                fontFamily: "var(--body)",
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 8,
                cursor: clear.isPending ? "default" : "pointer",
              }}
            >
              {clear.isPending ? t("messages.clearing") : t("messages.clear")}
            </button>
          </div>
        )}
      </AppHeader>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 16px 0" }}>
        {list.map((a) => {
          const lookup = alarmCodeLookup[a.code];
          const isActive = !a.resolvedAt;
          const color = SEVERITY_COLOR[a.severity] ?? "var(--muted)";
          return (
            <Card key={a.id} padding={14}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: `color-mix(in oklab, ${color} 20%, transparent)`,
                    color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Glyph name="alert" size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontFamily: "var(--display)",
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      {a.title || a.source}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: color,
                          boxShadow: `0 0 10px ${color}`,
                        }}
                      />
                    )}
                  </div>
                  {a.detail && (
                    <div
                      style={{
                        fontFamily: "var(--body)",
                        fontSize: "0.75rem",
                        color: "var(--muted)",
                        marginTop: 3,
                        lineHeight: 1.4,
                      }}
                    >
                      {a.detail}
                    </div>
                  )}
                  {lookup && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "var(--surface2)",
                        border: "1px dashed var(--border)",
                        fontFamily: "var(--mono)",
                        fontSize: "0.625rem",
                        color: "var(--accent)",
                      }}
                    >
                      ↳ {lookup}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 8,
                      fontFamily: "var(--mono)",
                      fontSize: "0.625rem",
                      color: "var(--dim)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ color, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      {a.severity}
                    </span>
                    <span>{a.source}</span>
                    <span>{a.code}</span>
                    <span>{t("messages.startedAt", { when: fmtRelTime(a.startedAt) })}</span>
                    {a.resolvedAt && <span>{t("messages.resolvedAt", { when: fmtRelTime(a.resolvedAt) })}</span>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {list.length === 0 && (
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--dim)", textAlign: "center" }}>
            {t("messages.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
