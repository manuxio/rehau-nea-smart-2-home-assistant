import { useCallback, useEffect, useState } from "react";

// Tiny hash-router. URLs:
//   #/                → home
//   #/system          → system tab
//   #/messages        → messages tab
//   #/programs        → programs tab
//   #/installer       → installer tab (role-guarded; falls back to home)
//   #/room/<id>       → room detail (back returns to whatever tab spawned it,
//                       though for shareability the "implicit parent" is home)
//
// Browser back/forward Just Works because hashchange fires on every history
// move. Tab changes and openRoom both push a new entry, so back rewinds them.

export type Tab = "home" | "system" | "messages" | "programs" | "installer";

export interface Route {
  tab: Tab;
  roomId: string | null;
}

const TABS: readonly Tab[] = ["home", "system", "messages", "programs", "installer"] as const;
const isTab = (s: string): s is Tab => (TABS as readonly string[]).includes(s);

export const parseHash = (hash: string): Route => {
  const h = hash.replace(/^#\/?/, "");
  if (h.startsWith("room/")) {
    const roomId = decodeURIComponent(h.slice("room/".length));
    return { tab: "home", roomId: roomId || null };
  }
  return { tab: isTab(h) ? h : "home", roomId: null };
};

export const buildHash = (r: Route): string => {
  if (r.roomId) return `#/room/${encodeURIComponent(r.roomId)}`;
  if (r.tab === "home") return "#/";
  return `#/${r.tab}`;
};

const readRoute = (): Route => parseHash(window.location.hash);

export function useHashRoute(): [Route, (next: Partial<Route>) => void] {
  const [route, setRoute] = useState<Route>(() => readRoute());

  useEffect(() => {
    const onChange = (): void => setRoute(readRoute());
    window.addEventListener("hashchange", onChange);
    // First mount: if the user landed on a bare URL, normalise to `#/`.
    if (window.location.hash === "" || window.location.hash === "#") {
      history.replaceState(null, "", "#/");
    }
    onChange();
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((next: Partial<Route>): void => {
    const cur = readRoute();
    const merged: Route = { ...cur, ...next };
    const newHash = buildHash(merged);
    if (newHash !== window.location.hash) {
      // Setting location.hash pushes a new entry → browser back/forward.
      window.location.hash = newHash;
    }
  }, []);

  return [route, navigate];
}
