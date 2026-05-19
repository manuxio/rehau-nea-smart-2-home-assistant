// Installer-tier authentication. The REHAU device has a single global
// installer-mode flag (no cookie): once we POST `instPart=<code>` to
// /menu.html, every request from any LAN client sees installer pages until
// someone GETs /user-menu.html ("Esci"). To stay sane we wrap every privileged
// op in `run(fn)` which acquires a process-wide mutex, logs in, runs `fn`,
// and unconditionally logs out — even on errors.

import type { DeviceClient } from "./client.js";
import type { Logger } from "../observability/log.js";

export interface InstallerSessionOptions {
  http: DeviceClient;
  /** 8-char installer password (first 8 chars of the device's unique code). */
  code: string;
  logger: Logger;
}

export class InstallerSession {
  private busy = false;
  private waiters: Array<() => void> = [];

  constructor(private readonly opts: InstallerSessionOptions) {}

  /** Acquire mutex → login → fn() → logout → release. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      await this.login();
      try {
        return await fn();
      } finally {
        await this.logout().catch((err: unknown) => {
          this.opts.logger.warn({ err }, "installer logout failed");
        });
      }
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      // The next waiter takes the mutex without unlocking.
      next();
    } else {
      this.busy = false;
    }
  }

  private async login(): Promise<void> {
    this.opts.logger.debug("installer login");
    await this.opts.http.postForm("/menu.html", { instPart: this.opts.code });
  }

  private async logout(): Promise<void> {
    this.opts.logger.debug("installer logout");
    await this.opts.http.get("/user-menu.html");
  }
}
