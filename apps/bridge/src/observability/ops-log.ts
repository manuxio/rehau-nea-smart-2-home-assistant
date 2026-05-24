// Bridge operations log — a 50-entry rolling ring of "what the bridge
// just did". Surfaced through the diagnostic snapshot (the SPA's
// "Copy as Markdown" affordance) so bug reports come with a chronological
// trace of the bridge's recent behaviour: which fetches landed, when MQTT
// connected, when the safety re-sync fired, when writes were ack'd.
//
// Every operation ALSO emits a structured INFO log line via pino (the
// existing logger), so addon-log scrapers and the in-memory ring stay
// consistent. See POLLING-PLAN.md → "Operations logging" for the contract.

import type { Logger } from "./log.js";

/** Catalogue of operation kinds. Keep flat — UI / log parsers depend on
 *  the literal strings. Document each in POLLING-PLAN.md when adding. */
export type OpKind =
  | "boot.start"
  | "boot.end"
  | "safety.start"
  | "safety.end"
  | "fetch"
  | "write"
  | "cache.invalidate"
  | "mqtt.connect"
  | "mqtt.disconnect"
  | "mqtt.discovery.publish"
  | "installer.session.open"
  | "installer.session.close"
  | "connection.state";

export interface OpEntry {
  /** ISO timestamp at op emission. */
  ts: string;
  kind: OpKind;
  /** Free-form short summary (matches the second column in the markdown render). */
  summary: string;
  /** Optional structured detail for the log line; not rendered in markdown. */
  detail?: Record<string, unknown>;
}

export interface OpLogOptions {
  size: number;
  logger: Logger;
}

export class OpLog {
  private readonly entries: OpEntry[] = [];

  constructor(private readonly opts: OpLogOptions) {}

  /** Push an entry, emit the matching INFO log line. */
  emit(kind: OpKind, summary: string, detail?: Record<string, unknown>): void {
    const entry: OpEntry = detail === undefined
      ? { ts: new Date().toISOString(), kind, summary }
      : { ts: new Date().toISOString(), kind, summary, detail };
    this.entries.push(entry);
    if (this.entries.length > this.opts.size) this.entries.shift();
    this.opts.logger.info({ op: kind, summary, ...(detail ?? {}) }, `op.${kind}`);
  }

  /** Newest-last snapshot, suitable for the fingerprint payload. */
  list(): OpEntry[] {
    return this.entries.slice();
  }

  /** Render the buffer as a markdown bullet list ready to paste into a
   *  GitHub issue. Format kept stable so a future support tool can parse
   *  it: `- HH:MM:SS.mmm  kind  summary`. */
  toMarkdown(): string {
    if (this.entries.length === 0) return "_no operations recorded yet_";
    const lines = ["### Recent operations (last " + this.entries.length + ")", ""];
    for (const e of this.entries) {
      const t = e.ts.slice(11, 23); // "HH:MM:SS.mmm"
      const summary = e.summary ? "  " + e.summary : "";
      lines.push(`- \`${t}\`  **${e.kind}**${summary}`);
    }
    return lines.join("\n");
  }
}
