// Connection state polling for the bridge ↔ REHAU link.
//
// The bridge exposes /api/v1/diagnostics/fetches; one component (the
// System tab's RehauState panel) drives the poll while it's mounted —
// every other consumer (ConnectionBanner, write-gating in System +
// RoomDetail) reads the resulting cache without contributing to the
// fetch traffic.
//
// Rationale: at 8 s the poll was the single most chatty network call in
// the SPA; the user observed it consuming "a lot of resources/bandwidth"
// on the mobile WebView. Trading a stale banner outside of System for
// zero background traffic is the right call — when REHAU goes offline
// the user notices via failed writes, not a banner update.
//
// Auth-gated like the rest of /api/v1, so the hook only fires once we
// have a session AND a component asked for active polling.

import { useQuery } from "@tanstack/react-query";
import type { BridgeConnection, DiagnosticsSnapshot } from "@rehau/types";
import { useAuth } from "./auth";

const POLL_MS = 8_000;
const DIAGNOSTICS_KEY = ["diagnostics", "fetches"] as const;

export interface UseConnectionOptions {
  /**
   * When `true`, this component takes responsibility for keeping the
   * diagnostics cache fresh — TanStack Query starts a `refetchInterval`
   * timer of POLL_MS while the component is mounted. When `false`
   * (default), the hook is a pure read-from-cache: data shows up only
   * after some OTHER mounted component (currently the System tab's
   * RehauState panel) populates it. This is the lever the user pulled
   * to cut idle bandwidth.
   */
  active?: boolean;
}

export const useConnection = (
  opts: UseConnectionOptions = {},
): {
  state: BridgeConnection["state"];
  conn: BridgeConnection | null;
  diag: DiagnosticsSnapshot | null;
} => {
  const { session, api } = useAuth();
  const active = opts.active ?? false;
  const q = useQuery({
    queryKey: DIAGNOSTICS_KEY,
    queryFn: () => api.diagnostics.fetches(),
    // Only one mounted active consumer triggers the fetch; inactive
    // consumers just read from cache. `enabled` plumbs the gate.
    enabled: !!session && active,
    // While active, poll on a short interval; otherwise the timer is moot
    // because `enabled: false` suppresses any scheduled refetch.
    refetchInterval: active ? POLL_MS : false,
    refetchIntervalInBackground: false,
    // Cache stays "fresh" for a generous window — when the user leaves
    // System and the poll stops, the banner / write-gate keeps reading
    // the last value without ever re-fetching on tab switches.
    staleTime: 60 * 60 * 1_000,
    gcTime: Infinity,
  });
  const diag = q.data ?? null;
  const conn = diag?.connection ?? null;
  // Default to "online" while we haven't seen a response yet — we don't
  // want to flash a red banner on every cold load.
  const state = conn?.state ?? "online";
  return { state, conn, diag };
};

/** True iff the bridge is fully reachable. Use to gate write controls. */
export const canWrite = (state: BridgeConnection["state"]): boolean => state !== "offline";
