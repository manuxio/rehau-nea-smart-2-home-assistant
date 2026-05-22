#!/usr/bin/env node
// Builds + copies the addon bundle to a local samba-mounted HA host so a
// change can be sanity-checked before pushing the commit to GitHub.
//
// What it does (in order):
//   1. Builds @rehau/types, @rehau/bridge (tsup), and @rehau/web (vite).
//   2. Copies apps/web/dist/  → rehau-bridge/web/   (committed to the repo).
//   3. Copies apps/bridge/dist/main.js{,.map} → rehau-bridge/dist/  (also committed).
//   4. Copies the bundle into the samba target with a bumped -devN suffix
//      on rehau-bridge/config.yaml (samba copy only — the repo's config
//      stays at the published version so the next real release is clean).
//
// The samba target is `REHAU_DEPLOY_SAMBA_PATH` (env var) — the absolute
// Windows path to the HA addon folder. Defaults to the user's noted setup:
//   \\homeassistant.local\addons\local-disabled\rehau-bridge
//
// Usage:
//   npm run deploy:local                       # full cycle: build + samba
//   npm run deploy:local -- --skip-build       # already built locally
//   npm run deploy:local -- --target=Z:\\rehau-bridge   # override target
//   REHAU_DEPLOY_SAMBA_PATH=... npm run deploy:local
//
// After the script finishes, in HA Supervisor:
//   ⋮ → Reload   (picks up the new version)
//   Then on the rehau-bridge addon card: Update → Start.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    if (arg.startsWith("--")) {
      const [k, v] = arg.slice(2).split("=");
      return [[k, v ?? "true"]];
    }
    return [];
  }),
);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_BRIDGE_DIR = join(ROOT, "rehau-bridge");
const APPS_WEB_DIST = join(ROOT, "apps", "web", "dist");
const APPS_BRIDGE_DIST = join(ROOT, "apps", "bridge", "dist");

const sambaTarget =
  args.get("target") ??
  process.env.REHAU_DEPLOY_SAMBA_PATH ??
  "\\\\homeassistant.local\\addons\\local-disabled\\rehau-bridge";

const skipBuild = args.get("skip-build") === "true";

const log = (msg) => console.log(`[deploy-local] ${msg}`);
const die = (msg, code = 1) => {
  console.error(`[deploy-local] ✗ ${msg}`);
  process.exit(code);
};

// ─── 1. Build ─────────────────────────────────────────────────────────
if (!skipBuild) {
  log("building @rehau/types (tsup) …");
  execSync("npm run -w @rehau/types build", { stdio: "inherit", cwd: ROOT });
  log("building @rehau/bridge (tsup) …");
  execSync("npm run -w @rehau/bridge build", { stdio: "inherit", cwd: ROOT });
  log("building @rehau/web (vite) …");
  execSync("npm run -w @rehau/web build", { stdio: "inherit", cwd: ROOT });
} else {
  log("--skip-build: using existing apps/*/dist/");
  if (!existsSync(APPS_WEB_DIST)) die("apps/web/dist missing — run without --skip-build");
  if (!existsSync(APPS_BRIDGE_DIST)) die("apps/bridge/dist missing — run without --skip-build");
}

// ─── 2. Update the in-repo rehau-bridge/ (so a follow-up `git push` ships it) ─
log("syncing apps/web/dist → rehau-bridge/web/");
rmSync(join(REPO_BRIDGE_DIR, "web"), { recursive: true, force: true });
mkdirSync(join(REPO_BRIDGE_DIR, "web"), { recursive: true });
cpSync(APPS_WEB_DIST, join(REPO_BRIDGE_DIR, "web"), { recursive: true });

log("syncing apps/bridge/dist → rehau-bridge/dist/");
mkdirSync(join(REPO_BRIDGE_DIR, "dist"), { recursive: true });
cpSync(join(APPS_BRIDGE_DIST, "main.js"), join(REPO_BRIDGE_DIR, "dist", "main.js"));
const mapPath = join(APPS_BRIDGE_DIST, "main.js.map");
if (existsSync(mapPath)) cpSync(mapPath, join(REPO_BRIDGE_DIR, "dist", "main.js.map"));

// ─── 3. Samba target ──────────────────────────────────────────────────
log(`samba target: ${sambaTarget}`);
try {
  // statSync over a UNC path can be slow on Windows but it's our reachability check.
  statSync(sambaTarget);
} catch (err) {
  die(
    `cannot access samba target — share not mounted or path wrong?\n` +
      `Set REHAU_DEPLOY_SAMBA_PATH or pass --target=<path>.\n` +
      `(${(err && err.message) || err})`,
  );
}

// Read repo version + figure out the -devN suffix to write to the samba config.
const repoConfigYaml = readFileSync(join(REPO_BRIDGE_DIR, "config.yaml"), "utf8");
const versionMatch = /^version:\s*"?([0-9]+\.[0-9]+\.[0-9]+)(?:-dev[0-9]+)?"?\s*$/m.exec(repoConfigYaml);
if (!versionMatch) die("could not parse version: from rehau-bridge/config.yaml");
const repoVersion = versionMatch[1];

const sambaConfigPath = join(sambaTarget, "config.yaml");
let nextSuffix = 1;
try {
  if (existsSync(sambaConfigPath)) {
    const current = readFileSync(sambaConfigPath, "utf8");
    const m = /^version:\s*"?([0-9]+\.[0-9]+\.[0-9]+)(?:-dev([0-9]+))?"?\s*$/m.exec(current);
    if (m && m[1] === repoVersion && m[2]) nextSuffix = Number(m[2]) + 1;
  }
} catch {
  // unreadable → start from -dev1
}
const sambaVersion = `${repoVersion}-dev${nextSuffix}`;

// ─── 4. Copy everything to samba ──────────────────────────────────────
log(`syncing rehau-bridge/ → ${sambaTarget} (version ${sambaVersion})`);
// Wipe the samba dist + web only — leave config-adjacent files alone in case
// the user has notes / pinned state on the share.
rmSync(join(sambaTarget, "web"), { recursive: true, force: true });
rmSync(join(sambaTarget, "dist"), { recursive: true, force: true });
cpSync(REPO_BRIDGE_DIR, sambaTarget, {
  recursive: true,
  // Don't try to copy the (possibly stale) config — we write a custom one
  // below with the -devN bumped version. `sep` handles both Windows and POSIX.
  filter: (src) => !src.endsWith(`${sep}config.yaml`),
});

// Rewrite version: line in the samba config.yaml to the -devN suffix.
const sambaConfig = repoConfigYaml.replace(
  /^(version:\s*)"?[^"\n]+"?\s*$/m,
  `$1"${sambaVersion}"`,
);
writeFileSync(sambaConfigPath, sambaConfig, "utf8");

log("");
log(`✓ deployed to samba as version ${sambaVersion}`);
log("");
log("Next steps in Home Assistant:");
log("  1. Settings → Add-ons → ⋮ → Reload");
log(`  2. On the REHAU Bridge addon card: Update (to ${sambaVersion}) → Start`);
log("");
log("When you're happy with the build, push to GitHub with:");
log("  git add rehau-bridge && git commit -m \"…\" && git push");
