// Installer-tier authentication.
//
// REHAU has a single GLOBAL installer-mode flag on the device (no cookie,
// no per-client scoping). POSTing `instPart=<code>` to `/menu.html` flips
// it on; GET `/user-menu.html` flips it off; every LAN client sees the
// same state in between.
//
// Per the polling plan (POLLING-PLAN.md → "Installer session"), the
// bridge holds the installer session OPEN for its entire lifetime,
// regardless of EXPOSE_IO. Trade-off: while the bridge is up, any other
// client joining REHAU's AP and opening the device web UI sees
// installer-tier surfaces. Win: every installer-gated read is a single
// round-trip instead of login → fetch → logout.
//
// The mutex `run(fn)` of the old design is no longer needed for
// per-fetch login/logout because there isn't any. Every REHAU request
// is already serialised by DeviceClient's single-flight queue. `run` is
// kept as a passthrough so callers don't have to change shape; it also
// transparently re-opens the session if it was closed (e.g. during a
// graceful shutdown that was aborted before close completed).

import type { DeviceClient } from "./client.js";
import type { Logger } from "../observability/log.js";

export interface InstallerSessionOptions {
  http: DeviceClient;
  /** 8-char installer password (first 8 chars of the device's unique code). */
  code: string;
  logger: Logger;
  /** Optional ops-log sink; emits `installer.session.open` / `close`. */
  onOp?: (kind: string, summary: string) => void;
}

export class InstallerSession {
  private opened = false;

  constructor(private readonly opts: InstallerSessionOptions) {}

  /** Idempotent: POSTs `instPart=<code>` once if the session isn't already open. */
  async open(): Promise<void> {
    if (this.opened) return;
    this.opts.logger.info("installer login (session open)");
    await this.opts.http.postForm("/menu.html", { instPart: this.opts.code });
    this.opened = true;
    this.opts.onOp?.("installer.session.open", "");
  }

  /** Idempotent: GETs `/user-menu.html` once if currently open. Best-effort. */
  async close(): Promise<void> {
    if (!this.opened) return;
    this.opened = false;
    try {
      this.opts.logger.info("installer logout (session close)");
      await this.opts.http.get("/user-menu.html");
      this.opts.onOp?.("installer.session.close", "");
    } catch (err) {
      this.opts.logger.warn({ err }, "installer logout failed (best-effort)");
    }
  }

  /**
   * Ensure the session is open, then invoke `fn`. No per-call logout.
   *
   * If the session was closed (shutdown race, device reboot we missed),
   * `open()` runs first transparently. Callers do not need to know
   * whether the session was already open.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.open();
    return fn();
  }

  /** Diagnostic: true when the bridge believes it's logged in. */
  isOpen(): boolean {
    return this.opened;
  }
}
