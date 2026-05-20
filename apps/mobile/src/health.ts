import type { HealthOk } from "./types";

const DEFAULT_TIMEOUT_MS = 6000;

export type ProbeResult =
  | { ok: true; payload: HealthOk }
  | { ok: false; reason: string };

export const probe = async (
  url: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProbeResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const composite = signal
    ? mergeSignals(signal, controller.signal)
    : controller.signal;
  try {
    const res = await fetch(`${url}/healthz`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: composite,
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return { ok: false, reason: "not a REHAU bridge (unexpected response)" };
    }
    const json = (await res.json()) as Partial<HealthOk>;
    if (json && json.ok === true) return { ok: true, payload: json as HealthOk };
    return { ok: false, reason: "bridge responded but not ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) return { ok: false, reason: "timeout" };
    return { ok: false, reason: msg.includes("Network") ? "network unreachable" : msg };
  } finally {
    clearTimeout(timer);
  }
};

const mergeSignals = (a: AbortSignal, b: AbortSignal): AbortSignal => {
  if (typeof (AbortSignal as unknown as { any?: unknown }).any === "function") {
    return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([a, b]);
  }
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (a.aborted || b.aborted) ctrl.abort();
  else {
    a.addEventListener("abort", onAbort);
    b.addEventListener("abort", onAbort);
  }
  return ctrl.signal;
};
