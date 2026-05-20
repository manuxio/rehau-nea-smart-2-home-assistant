import { useEffect, useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TabBar } from "./components/ui";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Installer } from "./features/installer/Installer";
import { Login } from "./features/auth/Login";
import { Messages } from "./features/messages/Messages";
import { Programs } from "./features/programs/Programs";
import { RoomDetail } from "./features/rooms/RoomDetail";
import { System } from "./features/system/System";
import { useAuth } from "./lib/auth";
import { usePullToRefresh } from "./lib/ptr";
import { useHashRoute, type Tab } from "./lib/useHashRoute";

export default function App() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [route, navigate] = useHashRoute();

  // Bounce the installer route if the current session can't see it.
  useEffect(() => {
    if (route.tab === "installer" && session && session.role !== "installer") {
      navigate({ tab: "home" });
    }
  }, [route.tab, session, navigate]);

  // Keep the document title in sync — nice for tab grouping in the browser.
  useEffect(() => {
    document.title = route.roomId
      ? `Betterehau · stanza ${route.roomId.replace(/^r-/, "")}`
      : `Betterehau · ${t(`tabs.${route.tab}` as never, { defaultValue: route.tab })}`;
  }, [route, t]);

  // Tab change → scroll the new view to the top.
  // Entering a room (tab → room) → save the tab's scroll position, scroll
  //   the room view to the top.
  // Leaving a room back to its parent tab (room → tab) → restore the saved
  //   scroll so the user lands exactly where they left off in e.g. a long
  //   Dashboard. Room → different room → top of the new room.
  //
  // Body has `overflow: hidden` and #root is the real scroll container
  // (see index.css and CLAUDE.md §6), so we scroll #root itself.
  // useLayoutEffect runs before paint so the user never sees the wrong
  // offset flash. TanStack Query renders cached data synchronously when
  // re-mounting the Dashboard so the page height is already correct by
  // the time we set scrollTop.
  const prevRouteRef = useRef(route);
  const savedScrollByTab = useRef<Partial<Record<Tab, number>>>({});
  useLayoutEffect(() => {
    const prev = prevRouteRef.current;
    prevRouteRef.current = route;
    const root = document.getElementById("root");
    if (!root) return;
    if (prev.tab !== route.tab) {
      root.scrollTop = 0;
      window.scrollTo(0, 0); // PWA / non-#root host fallback
      return;
    }
    if (prev.roomId !== route.roomId) {
      if (route.roomId) {
        // Entering a room (from tab or a different room) — preserve the tab's
        // scroll only if we came from the tab, not from another room.
        if (!prev.roomId) savedScrollByTab.current[prev.tab] = root.scrollTop;
        root.scrollTop = 0;
        window.scrollTo(0, 0);
      } else {
        // Leaving a room back to the parent tab — restore.
        root.scrollTop = savedScrollByTab.current[route.tab] ?? 0;
      }
    }
  }, [route]);

  const { offset, refreshing } = usePullToRefresh(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["rooms"] }),
      qc.invalidateQueries({ queryKey: ["system"] }),
      qc.invalidateQueries({ queryKey: ["messages"] }),
    ]);
  });

  if (!session) return <Login />;

  const baseTabs = [
    { value: "home" as const,     label: t("tabs.home"),     icon: "home" },
    { value: "system" as const,   label: t("tabs.system"),   icon: "sliders" },
    { value: "messages" as const, label: t("tabs.messages"), icon: "bell" },
    { value: "programs" as const, label: t("tabs.programs"), icon: "clock" },
  ];
  const installerTab = { value: "installer" as const, label: t("tabs.installer"), icon: "wrench" };
  const tabs = session.role === "installer" ? [...baseTabs, installerTab] : baseTabs;

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* Pull-to-refresh indicator */}
      {(offset > 0 || refreshing) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            display: "flex",
            justifyContent: "center",
            paddingTop: Math.max(4, offset / 3),
            pointerEvents: "none",
            transition: refreshing ? "padding-top .2s" : "none",
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.625rem",
              color: "var(--accent)",
              letterSpacing: 1,
              textTransform: "uppercase",
              padding: "6px 14px",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--accent) 14%, var(--surface))",
              border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
              opacity: Math.min(1, offset / 60 + (refreshing ? 1 : 0)),
            }}
          >
            {refreshing ? `${t("common.refresh")}…` : t("common.pullToRefresh")}
          </div>
        </div>
      )}

      <div
        style={{
          transform: offset ? `translateY(${offset * 0.4}px)` : undefined,
          transition: refreshing ? "transform .2s" : "none",
        }}
      >
        {route.roomId ? (
          <RoomDetail
            roomId={route.roomId}
            onBack={() => {
              // Use history.back so the browser's nav stack stays consistent.
              if (window.history.length > 1) window.history.back();
              else navigate({ roomId: null });
            }}
          />
        ) : route.tab === "home" ? (
          <Dashboard onOpenRoom={(id) => navigate({ roomId: id })} />
        ) : route.tab === "system" ? (
          <System />
        ) : route.tab === "messages" ? (
          <Messages />
        ) : route.tab === "programs" ? (
          <Programs />
        ) : (
          <Installer />
        )}
      </div>

      <TabBar
        active={route.tab}
        onChange={(v) => navigate({ tab: v as Tab, roomId: null })}
        items={tabs}
      />
    </div>
  );
}
