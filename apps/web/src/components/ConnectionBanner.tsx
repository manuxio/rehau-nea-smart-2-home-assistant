// Persistent top banner shown when the bridge can't reach the REHAU base
// station. Sits ABOVE the route content so it's the first thing the user
// sees on every screen. Auto-disappears when state → "online".
//
// Why not a toast: a toast self-dismisses. The user explicitly asked the
// GUI to "clearly state" the situation; staying visible until resolved
// matters more than not interrupting the layout.

import { useTranslation } from "react-i18next";
import type { BridgeConnection } from "@rehau/types";

interface Props {
  conn: BridgeConnection;
}

const minutesSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60_000);
};

export const ConnectionBanner = ({ conn }: Props) => {
  const { t } = useTranslation();
  if (conn.state === "online") return null;

  const mins = minutesSince(conn.lastSuccessAt);
  const since =
    mins === null
      ? t("connection.never")
      : mins < 1
        ? t("connection.justNow")
        : mins === 1
          ? t("connection.oneMinAgo")
          : t("connection.minsAgo", { n: mins });

  const isOffline = conn.state === "offline";
  const accent = isOffline ? "var(--alert)" : "var(--accent)";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        // Sit at the very top of the document, above everything. Fixed so it
        // doesn't disappear when the user scrolls down a long Dashboard.
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "color-mix(in oklab, " + accent + " 18%, var(--bg))",
        borderBottom: "1px solid " + accent,
        color: "var(--text)",
        padding: "10px 14px calc(10px + env(safe-area-inset-top))",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontFamily: "var(--body)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.8125rem",
          fontWeight: 600,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: accent,
            boxShadow: "0 0 8px " + accent,
            flexShrink: 0,
          }}
        />
        <span>{isOffline ? t("connection.offline") : t("connection.degraded")}</span>
      </div>
      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "var(--mono)", lineHeight: 1.4 }}>
        {t("connection.lastSuccess", { since })}
        {conn.reason ? ` · ${conn.reason}` : ""}
      </div>
    </div>
  );
};

/** Vertical space the banner consumes when visible — wire into root padding-top. */
export const BANNER_RESERVED_PX = 56;
