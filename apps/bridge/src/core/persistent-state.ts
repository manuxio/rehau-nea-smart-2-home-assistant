// Persistent state file for user-editable data that should survive addon
// restarts: floor labels, scenes. Lives at `STATE_FILE` (default
// `/data/state.json`), inside HA's addon persistent dir — same volume
// where `run.sh` keeps `jwt_secret`. NOT used for device-sourced state;
// that's always re-fetched from REHAU on boot.
//
// Format is forward-compatible via the `version` field. Unknown keys
// are preserved so a hand-edit won't get clobbered by the next save.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { FloorAssignments, Scene } from "@rehau/types";

const FILE_VERSION = 1 as const;

export interface PersistentState {
  version: typeof FILE_VERSION;
  floors: FloorAssignments;
  scenes: Scene[];
  /** Anything extra a future bridge version (or hand-edit) wrote. Preserved on save. */
  [extra: string]: unknown;
}

export const emptyPersistentState = (): PersistentState => ({
  version: FILE_VERSION,
  floors: {},
  scenes: [],
});

/**
 * Load + validate the state file. Returns `emptyPersistentState()` on
 * missing file, parse error, or version mismatch — better to start
 * fresh than crash the bridge boot. Errors are logged once via the
 * passed-in `warn` callback so the addon-log reader sees why.
 */
export const loadPersistentState = (
  path: string,
  warn: (msg: string, err?: unknown) => void,
): PersistentState => {
  if (!existsSync(path)) return emptyPersistentState();
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistentState>;
    if (parsed?.version !== FILE_VERSION) {
      warn(`state-file version mismatch (got ${String(parsed?.version)}, expected ${FILE_VERSION}); starting empty`);
      return emptyPersistentState();
    }
    return {
      version: FILE_VERSION,
      floors: typeof parsed.floors === "object" && parsed.floors ? parsed.floors as FloorAssignments : {},
      scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
      ...parsed, // preserve unknown keys (future-version metadata)
    };
  } catch (err) {
    warn("state-file unreadable; starting empty", err);
    return emptyPersistentState();
  }
};

/**
 * Atomic write: write to `<path>.tmp` then rename, so a crash mid-write
 * can't corrupt the file. Throws on I/O error — caller decides whether
 * to swallow or surface.
 */
export const savePersistentState = (path: string, state: PersistentState): void => {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
};
