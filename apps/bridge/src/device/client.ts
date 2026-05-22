import { Pool } from "undici";
import type { FetchTelemetryEntry } from "@rehau/types";
import type { Logger } from "../observability/log.js";

export interface DeviceClientOptions {
  baseUrl: string;
  timeoutMs: number;
  /**
   * Minimum gap between two consecutive requests (ms). Even with single-flight
   * the REHAU TCP stack saturates if we churn connections back-to-back —
   * each closed socket sits in TIME_WAIT for a while and the embedded socket
   * table is small. A short cool-down breaks the saturation loop.
   */
  minGapMs?: number;
  logger: Logger;
  /**
   * Optional sink for fetch telemetry — called once per request with the
   * final outcome (`ok` if the body came back 2xx, otherwise a classified
   * failure). Wired to `store.recordFetch` in main.ts so the connection
   * state machine and `/api/v1/diagnostics` see every call.
   */
  onTelemetry?: (entry: FetchTelemetryEntry) => void;
}

/**
 * Thin HTTP client over the device. `Pool({connections:1})` matches the
 * device's single-tasked behaviour; we also gate every call through a
 * promise-chain so at most one request is in flight, with predictable
 * ordering for writes.
 *
 * IMPORTANT — the REHAU firmware mishandles HTTP keep-alive: a second
 * request on a reused TCP connection often stalls for 5–15 s before any
 * headers come back. We force one-shot connections by combining:
 *   - `keepAliveTimeout: 1` on the Pool (the client side closes immediately)
 *   - `Connection: close` header on every request (the server is told to
 *     close after the response).
 * With both in place, latency drops from 5–15 s (worst case) to ~300 ms.
 */
export class DeviceClient {
  private readonly pool: Pool;
  private readonly minGapMs: number;
  private chain: Promise<unknown> = Promise.resolve();
  private lastRequestEndedAt = 0;

  constructor(private readonly opts: DeviceClientOptions) {
    this.pool = new Pool(opts.baseUrl, {
      connections: 1,
      pipelining: 0,
      keepAliveTimeout: 1,
      keepAliveMaxTimeout: 1,
      keepAliveTimeoutThreshold: 0,
    });
    this.minGapMs = opts.minGapMs ?? 150;
  }

  async close(): Promise<void> {
    await this.pool.close();
  }

  /**
   * Serialised, single-flight wrapper with a cool-down between calls. Wraps
   * `fn` so that no two requests overlap *and* the previous request's end is
   * at least `minGapMs` in the past before the next starts.
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const sinceLast = Date.now() - this.lastRequestEndedAt;
      const wait = this.minGapMs - sinceLast;
      if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        this.lastRequestEndedAt = Date.now();
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  async get(path: string): Promise<string> {
    return this.enqueue(() => this.request("GET", path));
  }

  async postForm(path: string, body: Record<string, string>): Promise<string> {
    const form = new URLSearchParams(body).toString();
    return this.enqueue(() => this.request("POST", path, form));
  }

  /** Empty-key POST used by the device for "open detail for zone N". */
  async postKey(path: string, key: string): Promise<string> {
    return this.enqueue(() => this.request("POST", path, `${encodeURIComponent(key)}=`));
  }

  private async request(method: "GET" | "POST", path: string, body?: string): Promise<string> {
    const { logger, timeoutMs, onTelemetry } = this.opts;
    const t0 = Date.now();
    const startedAt = new Date().toISOString();
    const reqBytes = body?.length ?? 0;
    const headers: Record<string, string> = { connection: "close" };
    if (body) headers["content-type"] = "application/x-www-form-urlencoded";

    // Classify an error caught from `once()` so we can record a meaningful
    // outcome in the telemetry buffer. The categories are coarse but enough
    // for the Diagnostics page to highlight what's going wrong.
    const classify = (err: unknown): { outcome: "timeout" | "http" | "tcp"; status?: number } => {
      const code = (err as { code?: string }).code;
      if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
        return { outcome: "timeout" };
      }
      // Errors thrown by our `once()` wrapper for non-2xx responses match
      // `device ... → <status>`.
      const m = /→\s+(\d{3})$/.exec((err as { message?: string }).message ?? "");
      if (m) return { outcome: "http", status: Number(m[1]) };
      return { outcome: "tcp" };
    };

    const emit = (
      ms: number,
      outcome: "ok" | "timeout" | "http" | "tcp",
      status?: number,
      error?: string,
    ): void => {
      if (!onTelemetry) return;
      try {
        onTelemetry({
          at: startedAt,
          what: `${method} ${path}`,
          ms,
          outcome,
          ...(status !== undefined ? { status } : {}),
          ...(error ? { error: error.slice(0, 200) } : {}),
        });
      } catch {
        /* never let telemetry interfere with the request flow */
      }
    };

    /**
     * Internal call → either resolves with the body or throws. Used by the
     * single-shot path and the one-retry recovery path below.
     */
    const once = async (): Promise<string> => {
      const res = await this.pool.request({
        method,
        path,
        headers,
        ...(body ? { body } : {}),
        bodyTimeout: timeoutMs,
        headersTimeout: timeoutMs,
      });
      const text = await res.body.text();
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`device ${method} ${path} → ${res.statusCode}`);
      }
      return text;
    };

    try {
      const text = await once();
      const ms = Date.now() - t0;
      logger.info(
        { method, path, ms, reqBytes, resBytes: text.length },
        `device ${method} ${path} → 200 in ${ms}ms`,
      );
      emit(ms, "ok");
      return text;
    } catch (err) {
      const code = (err as { code?: string }).code;
      const retryable = code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_CONNECT_TIMEOUT";
      // One-shot retry on timeout: REHAU has occasional 3-5s hiccups; a single
      // re-attempt after a brief pause recovers without surfacing a fake error
      // to the rest of the bridge. Both GET and POST writes are idempotent for
      // our use cases (mode/setpoint/light are set-to-X, not incremental).
      if (retryable) {
        const firstMs = Date.now() - t0;
        logger.warn(
          { method, path, ms: firstMs, code },
          `device ${method} ${path} timed out after ${firstMs}ms — retrying once`,
        );
        await new Promise<void>((r) => setTimeout(r, 400));
        try {
          const text = await once();
          const ms = Date.now() - t0;
          logger.info(
            { method, path, ms, reqBytes, resBytes: text.length, retried: true },
            `device ${method} ${path} → 200 in ${ms}ms (after retry)`,
          );
          emit(ms, "ok");
          return text;
        } catch (retryErr) {
          const ms = Date.now() - t0;
          logger.warn(
            { err: retryErr, method, path, ms, reqBytes },
            `device ${method} ${path} FAILED after ${ms}ms (incl. retry)`,
          );
          const cls = classify(retryErr);
          emit(ms, cls.outcome, cls.status, (retryErr as { message?: string }).message);
          throw retryErr;
        }
      }
      const ms = Date.now() - t0;
      logger.warn(
        { err, method, path, ms, reqBytes },
        `device ${method} ${path} FAILED after ${ms}ms`,
      );
      const cls = classify(err);
      emit(ms, cls.outcome, cls.status, (err as { message?: string }).message);
      throw err;
    }
  }
}
