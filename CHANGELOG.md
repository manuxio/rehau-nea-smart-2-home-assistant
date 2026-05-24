# Changelog

## 6.1.2 — 2026-05-24

- **Drop the `[uptime] parser returned 0 0 0` diagnostic dump.** It
  was a debug helper added back when the parser was Italian-locked
  and silently returning all-zeros (fixed in v6.0.x). With the
  locale-agnostic parser in place, REHAU genuinely reports
  `0 Year(s) 0 Day(s) 0 Hour(s)` when the controller has just booted
  — the warning is a false positive and was spamming the addon log
  with an HTML snippet that wasn't actionable.

## 6.1.1 — 2026-05-24

Three fixes on top of 6.1.0 surfaced by reading the actual addon
boot log:

- **Fingerprint and MQTT raced ahead with empty data.** The Poller's
  `kickoffPromise` was assigned inside `start()`, so any consumer that
  awaited `kickoffComplete()` BEFORE `start()` ran got
  `Promise.resolve()` immediately. The fingerprint emitted at 1 s of
  uptime with `roomCount: 0, rooms: [], recentOps: []`, and MQTT
  would have connected pre-boot too. `kickoffPromise` is now
  pre-allocated in the constructor with a manual resolver and
  fulfilled at the end of the kickoff — always a real awaitable.
- **`/room-page.html` failing at boot left the store with zero rooms.**
  The per-room detail / set-up loops iterate `store.listRooms()` and
  silently skipped; with no rooms registered until the next 120 s
  runtime tick, the SPA + MQTT saw nothing. The boot priority
  sequence now retries `pollRoomList` once after a 2 s pause if the
  store is still empty.
- **Per-fetch INFO log was burying the headline.** Every fetch
  produced both a verbose `device GET /path → 200 in Xms` INFO line
  AND an `op.fetch` INFO line with the summary as a sub-field.
  Two lines per fetch, hard to skim. The device-client per-request
  success log is now demoted to debug (still INFO on failure), and
  `op.fetch` uses the summary directly as pino's message
  (`dashboard ok 434 ms` instead of `op.fetch` + buried fields).
  `boot.start` / `boot.end` / `safety.*` also pass descriptive
  summaries so the addon log narrates the priority sequence in
  plain English.

## 6.1.0 — 2026-05-24

Full implementation of `POLLING-PLAN.md` — the bridge's polling
strategy is reorganised around the source-of-truth model. Behavioural
contract is now: boot kickoff fetches everything once in priority
order, MQTT and runtime polls don't start until boot completes, a
30-minute safety re-sync re-walks the same priority list, runtime
polls hold off during safety, every operation produces a parseable
INFO log line + a 50-entry rolling buffer that the SPA can copy as
markdown for bug reports.

### Bridge

- **Poller rewritten end-to-end** ([apps/bridge/src/core/poller.ts](apps/bridge/src/core/poller.ts)).
  - Boot kickoff in fixed priority order: `/` → `/room-page.html` →
    per-room `/room-operating.html` → IO + `/user-config-installer.html`
    → messages + calibration + per-room `/room-set-up.html` → 10 daily
    + 5 weekly programs + 7 installer-tab reads. 36 fetches on a
    4-room install, MQTT connects when this resolves.
  - Per-room scheduled cycle replaces the legacy round-robin:
    `clamp(SLOT × N, MIN, MAX)` seconds per cycle, all rooms back-to-back.
    Defaults `5/10/30` → per-room freshness 10–30 s vs ~4 min before.
  - Safety re-sync timer (default 1800 s) re-walks the same priority
    sequence. Runtime polls hold off via a `safetyBusy` flag.
  - Every runtime tick (and boot/safety step) goes through `tick()`
    which `safe()`-wraps the call AND emits an `op.fetch` entry —
    no more unhandled rejections from undici timeouts crashing the
    addon.
- **InstallerSession kept open continuously** ([apps/bridge/src/device/installer.ts](apps/bridge/src/device/installer.ts)).
  `open()` once at boot, `close()` at graceful shutdown, no per-call
  login/logout. Saves the 3-round-trip dance on every installer-gated
  read. Closes the global trade-off: other LAN clients see installer
  pages while the bridge is up.
- **MQTT connect deferred** until `poller.kickoffComplete()` resolves
  ([apps/bridge/src/main.ts](apps/bridge/src/main.ts)). HA shows the
  device as unavailable for the full boot duration; in exchange it
  never sees a half-baked installation with partial data.
- **Operations log** ([apps/bridge/src/observability/ops-log.ts](apps/bridge/src/observability/ops-log.ts)) — 50-entry
  ring buffer (`OP_LOG_SIZE`) capturing `boot.start`/`end`,
  `safety.start`/`end`, `fetch`, `mqtt.connect`/`discovery.publish`,
  `installer.session.open`/`close`. Each entry also emits a structured
  INFO log line via pino.
- **Diagnostic snapshot enriched** ([apps/bridge/src/core/fingerprint.ts](apps/bridge/src/core/fingerprint.ts)).
  `recentOps` + `recentOpsMarkdown` fields surfaced through
  `GET /api/v1/diagnostics/fingerprint` and the boot
  `INSTALLATION_FINGERPRINT` log.
- **Installer-tab routes are cache-first** ([apps/bridge/src/http/routes/installer.ts](apps/bridge/src/http/routes/installer.ts)).
  Calibration / IO / uptime / topology / heat-curve / settings groups
  return from the store cache if warm; fall back to a live REHAU read
  on cache miss. Boot warms everything so the SPA's first open of
  the Installer tabs is instant.
- **Process-level safety guards** in main.ts — `unhandledRejection`
  and `uncaughtException` log + swallow instead of crashing the
  addon. Belt-and-braces backup for the per-tick `safe()`-wrap.

### SPA

- **`SPA_INSTALLER_TAB` UI-flag** (default `true`). When `false` the
  bottom TabBar hides the Installer entry and hash-routing to
  `/installer` bounces home. Bridge polling, REST API, MQTT
  publishing are all unchanged — pure UI hide. Exposed through the
  new `GET /api/v1/spa-config` endpoint
  ([apps/bridge/src/http/routes/spa-config.ts](apps/bridge/src/http/routes/spa-config.ts)),
  read once on SPA mount.
- **SPA stops passing `?fresh=true`** on program reads
  ([apps/web/src/features/programs/Programs.tsx](apps/web/src/features/programs/Programs.tsx)).
  Reads come from the bridge cache (warmed at boot), writes invalidate
  via TanStack-Query `onSuccess`. SPA-driven REHAU round-trips on
  read are eliminated.
- **Diagnostic snapshot card** now shows a "Recent operations" count
  ([apps/web/src/features/system/System.tsx](apps/web/src/features/system/System.tsx#L729))
  and the **Copy as Markdown** clipboard payload includes the
  `### Recent operations` markdown block under the fenced JSON.

### Config

| New | Default |
| --- | --- |
| `POLL_ROOM_DETAIL_SLOT_S` | 5 |
| `POLL_ROOM_DETAIL_MIN_S` | 10 |
| `POLL_ROOM_DETAIL_MAX_S` | 30 |
| `POLL_SYSTEM_INFO_S` | 600 |
| `SAFETY_RESYNC_S` | 1800 *(0 disables auto-timer)* |
| `OP_LOG_SIZE` | 50 |
| `SPA_INSTALLER_TAB` | true |

| Removed |
| --- |
| `POLL_ROOM_DETAIL_S` *(superseded by SLOT/MIN/MAX)* |
| `POLL_CALIBRATION_S` *(calibration becomes write-only + safety)* |

| Default updated |
| --- |
| `POLL_DASHBOARD_S` 30 → **120** |
| `POLL_ROOMS_S` 15 → **120** |

### Verification

End-to-end Playwright run against a real REHAU device:

- boot kickoff completes (29/36 ok on a flaky-REHAU day — bridge
  survived seven undici timeouts that would have crashed older
  versions);
- MQTT connects after boot, publishes discovery with 79 entities;
- per-room cycle fires every ~20 s for 4 rooms;
- SPA diagnostic snapshot reports 50 ops, "Copy as Markdown"
  clipboard contains the fenced JSON + the `### Recent operations`
  block;
- `SPA_INSTALLER_TAB=false` hides the bottom-tab Installer entry
  and bounces `#/installer` to home, while `/api/v1/installer/io`
  still returns 200 for the same session.

## 6.0.27 — 2026-05-23

### Changed — fingerprint is now actually useful for debugging

Two problems with the v6.0.26 fingerprint:

- It fired on the first room.changed event, which produced half-baked
  snapshots ("1 room, hasFan=false") when the user actually had four
  rooms with fancoils — `pollAllRoomDetails` just hadn't finished yet.
  Bug reports built on partial data are worse than no data.
- It only carried the static room metadata. Missing the bits a
  maintainer actually wants when triaging: is REHAU reachable, how
  often have polls failed, what mode is each room in, what setpoints
  is the bridge seeing.

Fixes:

- Emission now waits on `poller.kickoffComplete()` — a new awaitable
  that resolves once dashboard / room list / all room details /
  system info have all settled. Partial snapshots are gone.
- Payload enriched with:
  - `emittedAt`, `uptimeSeconds` (catch "fingerprint at 3s of uptime"
    timing bugs)
  - `nodeVersion`, `platform`
  - `connection`: { state, consecutiveFailures, lastSuccessAt, reason }
  - `fetches`: { total, success, failure, avgMsSuccess, p95MsSuccess }
  - per-room `mode`, `temperature`, `setpointHeating`, `setpointCooling`
- Builder factored into `apps/bridge/src/core/fingerprint.ts` so the
  log-block and `GET /api/v1/diagnostics/fingerprint` can't drift.

### Added — "Copy diagnostic snapshot" in the System tab

New card under REHAU state. Renders the fingerprint summary inline
(addon version, master FW, current operating mode, room count) plus
three buttons:

- **Copy JSON** — raw payload, byte-identical to the log block.
- **Copy as Markdown** — wraps in `` ```json `` fences so it pastes
  cleanly into GitHub issues.
- **Refresh** — refetches without reloading the page.

Best-effort clipboard write with a `<textarea>+execCommand` fallback
for older browsers / non-secure contexts. End-to-end verified with
Playwright before ship: card renders, JSON parses with the expected
shape, Markdown is fence-wrapped, all four rooms show up.

## 6.0.26 — 2026-05-23

### Fixed — missing thermostat in HA when room name has punctuation

Bug report #66 (smazzone): 7 rooms on the REHAU side, only 6 climate
entities in Home Assistant. Root cause was the room-id slug in
`ensureRoomForZone` only stripped whitespace, letting characters like
`/`, `+`, `#`, `(`, `&`, accented letters etc. through. Two problems
downstream:

- MQTT topic gets split on a stray `/` into extra levels.
- Home Assistant's MQTT discovery spec restricts `unique_id` to
  `[a-zA-Z0-9_-]`. Anything outside is silently dropped — no climate
  entity ever appears for that room. The bridge / SPA / API still
  show it because the room is in the store; only HA misses it.

Slug now normalises NFD (strips accents), maps everything outside
`[a-z0-9]` to `-`, collapses runs of dashes, and trims. Room
`Bagno/Lavanderia` → id `r-bagno-lavanderia-z3` instead of the
previous `r-bagno/lavanderia-z3`. Plain ASCII names are unchanged.

**Heads-up for affected users:** if you currently have a room with
punctuation in its name, its HA `entity_id` will rename on this
upgrade — automations referencing the old id need to be updated.
Users not affected (no punctuation / accents in names) see no
change.

Added `roomIdFromName` to `apps/bridge/src/core/store.ts` with a unit
test pinning the behaviour for `/`, `+`, `#`, parens, ampersands,
accented letters, leading/trailing punctuation, and empty input.

### Added — installation fingerprint

Bridge now logs an `INSTALLATION_FINGERPRINT` block once on boot, the
moment the first system + room polls have landed. Single grep-friendly
JSON line with: addon + bridge version, device URL, firmware build,
operating mode, energy level, installer-access flag, MQTT enable
flag, expose-io / expose-calibration flags, and the per-room
`{zone, name, id, hasFan, hasFlap, hasLight}` list.

Also exposed at `GET /api/v1/diagnostics/fingerprint` with the same
shape, so users can paste it straight into a bug report without
digging through addon logs. No secrets in the payload — no installer
code, no bcrypt hash, no JWT.

## 6.0.25 — 2026-05-22

### Changed — drop `auto` from the HA climate dropdown

The climate card now offers only:

- Heating season: `Off · Heat`
- Cooling season: `Off · Cool`

`auto` was a leftover from v6.0.0 that mapped to REHAU's `program`
mode. Two problems with it:

- "Auto" in HA conventionally means "system picks heating-or-cooling",
  which REHAU doesn't do per-room — the season is a global setting.
- It duplicated functionality already exposed cleanly through the
  `preset_modes` dropdown (which carries the proper REHAU vocabulary:
  `normal` / `reduced` / `program` / `program_override` / `standby`).

To put a room on its weekly schedule from HA, pick `program` from the
preset dropdown. The climate dial still drives the manual setpoint
the same way. No functionality lost.

`program` and `program_override` now render in the climate widget as
the active season's mode (heat or cool) — the room IS calling for
heat/cool when on its schedule, so that's the honest state.

## 6.0.24 — 2026-05-22

### Changed — HA climate modes match the current season

The MQTT climate entity now advertises only the modes that actually
work in the current operating mode:

- Heating season (`heating_only` / `manual_heating`): `Off · Heat · Auto`
- Cooling season (`cooling_only` / `manual_cooling`): `Off · Cool · Auto`

REHAU decides heating vs cooling at the system level (per global
operating mode), so it's wrong for HA's per-room climate card to
offer both — picking "Heat" while the system is in cooling does
nothing. The bridge republishes discovery whenever the season flips
(operatingMode is now part of the discovery capability signature) so
the dropdown updates automatically.

`min_temp` / `max_temp` also narrow to the active season's REHAU
range (5–31 heating, 15–35 cooling) instead of the previous union.

## 6.0.23 — 2026-05-22

### Fixed — cooling mode setpoint routing

REHAU's `room-operating.html` reuses one set of JS variables
(`normalSetPoint`, `reducedSetPoint`, `standbySetPoint`) for whichever
season is active — in heating mode they carry heating values, in
cooling they carry cooling values. The parser correctly extracted the
numbers but the poller wrote them unconditionally into
`setpointHeating`, leaving `setpointCooling` permanently null even
when the system was in `manual_cooling` / `cooling_only`.

Behaviour now:

- Poller routes the active value into `setpointHeating` (heating
  season) or `setpointCooling` (cooling season); the other side is
  set to null so consumers can tell which is live at a glance.
- `commander.setRoomSetpoint` / `setRoomMode` write the optimistic
  patch to the matching slot too.
- `setRoomLight` falls back across both slots (the room-page POST
  needs *a* setpoint regardless of season).
- SPA dashboard tile renders whichever slot is non-null.
- HA MQTT climate template falls back across both, range widened to
  5–35°C to span both seasons, mode list adds `cool`.

Parsers themselves were not changed — they were already correct.
Verified by running every parser against live `10.160.18.139` HTML
in cooling mode.

## 6.0.22 — 2026-05-22

- **Installer tabs go icon-only.** Same treatment as the bottom TabBar
  in v6.0.8 — labels gone, icons bumped to 22 px, `aria-label` + tooltip
  preserved for screen readers and desktop hover. Six tabs now fit
  comfortably on a 360 px screen without the strip overflowing.
- **Wrench icon nudged.** Shifted the Advanced-tab wrench 2 px down /
  2 px left inside its 24-unit viewBox so it visually centres against
  the other icons.
- New phone-framed screenshot gallery in the README, generated by
  `scripts/screenshot-gallery.mjs` (headless Chromium + sharp).

## 6.0.21 — 2026-05-22

- **Scenes can now write a setpoint along with the mode.** When the
  scene's mode is `normal` or `reduced` (the two slots REHAU lets us
  target), the editor shows a Stepper next to the mode chooser; on
  apply, that temperature lands in the matching per-mode slot for
  every targeted room. `standby` and `program` don't take a setpoint
  — standby has its own device-managed slot and `program` defers to
  the weekly schedule, so writing a temperature there would clobber
  the wrong field. Both Global and Per-room scenes support it; legacy
  scenes (no setpoint) keep working unchanged.

## 6.0.20 — 2026-05-22

- **Installer tab icons now actually visible.** The tabs are laid out
  with `display: flex`, and SVG children have default `flex-shrink: 1`,
  so once total content exceeded the strip width the icons got
  squashed to ~3 px wide while the labels stayed full-size — making
  the icons invisible. The strip is already `overflow-x: auto`, so
  the proper behaviour is for the WHOLE button to keep its natural
  size and the strip to scroll. Adding `flex-shrink: 0` to each tab
  button restores that. v6.0.16 ↔ v6.0.19 shipped the icons but
  rendered them invisibly — this is the real fix.
- Also adds a `__SPA_BUILD__` console marker at boot so any future
  "is this even the right bundle?" question is settled by opening
  devtools.

## 6.0.18 — 2026-05-22

- Installer tab icons now larger (16 px) and accent-coloured on
  inactive tabs so they're visible next to the label. 14 px / muted
  was too subtle.

## 6.0.17 — 2026-05-22

- Bridge sets `Cache-Control: no-cache, must-revalidate` on the SPA's
  `index.html` and `immutable` on `/assets/*` so addon updates land
  on the next reload instead of needing a hard refresh.

## 6.0.16 — 2026-05-22

### Added

- Icons in the Installer tab strip — chart, sliders, network, io,
  eye, wrench (Curve / Calibration / Bus / I/O / Diagnostics /
  Advanced).

### Fixed

- Programs tab now shows all 5 weekly + 10 daily slots. The list
  endpoints lazy-fill missing slots on first call instead of
  returning only whatever happened to be cached.

## 6.0.15 — 2026-05-22

- "Text size (testing)" → "Text size" — the slider is staying.
- "API documentation" → "API".
- Fix the API link under HA ingress (was 404). Linked to `./docs/`
  with a trailing slash so fastify-swagger-ui doesn't 301-redirect
  to an absolute `/docs/` (which ingress doesn't rewrite).

## 6.0.14 — 2026-05-22

- **More scene icons** in the editor: power, leaf, bed, coffee,
  briefcase, plane, film, gift — covering off / eco / sleep /
  morning / work / vacation / cinema / party.

## 6.0.13 — 2026-05-22

- **Per-room mode in scenes.** Scene editor gains a Scope toggle —
  "All rooms" keeps the existing single-mode shape, "Per room" lets
  you pick a different mode per room (or skip rooms entirely).
  Persisted as the new `perRoom` action shape; legacy `applyRoomMode`
  scenes keep working.

## 6.0.12 — 2026-05-22

User-editable floors + scenes, persisted to `/data/state.json`.

- **Floors**: assign a floor label per room (System → Floors). The
  Dashboard groups rooms by floor (alphabetic label, then name), with
  unassigned rooms in a single "Unassigned" group at the bottom.
- **Scenes**: create / edit / delete scenes with a name, icon and a
  room-mode to apply (System → Scenes). The Dashboard's scene grid
  now renders saved scenes — the hardcoded placeholders are gone.
  When the list is empty, the section is hidden.
- New endpoints: `GET/PUT /api/v1/floors`, `GET/POST /api/v1/scenes`,
  `PUT/DELETE /api/v1/scenes/:id`, `POST /api/v1/scenes/:id/apply`.
- New `STATE_FILE` config (default `/data/state.json`). `ROOM_FLOORS`
  env var still works as a seed default.

## 6.0.11 — 2026-05-22

See [rehau-bridge/CHANGELOG.md](rehau-bridge/CHANGELOG.md) for the
full set. Headlines: connection-state machine surfaced in HA + SPA,
optimistic writes (bridge-side, so MQTT publishes user intent
instantly), no-defaults rule throughout Room state, installer
Save/Cancel buttons, REHAU-state panel + force-refresh button,
acknowledge-all-messages, fixed uptime parser for non-Italian
firmware, fixed Stepper rounding for `step < 0.1` fields,
`npm run deploy:local` samba helper.

## 6.0.10 — 2026-05-20

### Changed

- **Dashboard scroll position survives a room visit.** Going Home →
  Room → Home (back) now restores the previous Home scroll instead of
  scrolling to the top. Tab changes and entering a fresh room still
  scroll to the top.
- **Preferences moved into the System tab.** Theme, language,
  text-size slider, and logout now live in two new sections at the
  top of the System tab ("Preferences" and "Account"). The floating
  gear icon (`SettingsMenu`) is gone. Login screen inherits the
  persisted prefs but no longer offers an in-place toggle.
- **Room: Mode chooser now precedes the setpoint dial.** Standby /
  Normal / Reduced / Program is the first decision; the temperature
  dial follows.

### Fixed

- **TabBar last icon clipped on narrow viewports.** Shrunk the active
  pill's horizontal padding from 22 px to 12 px so all five icons
  fit on a 360 px screen.

## 6.0.9 — 2026-05-20

### Added

- **Temporary text-size slider in Settings.** While we tune the right
  body-text baseline, the SettingsMenu now exposes a 0..+40 % range
  slider (5 % steps) that scales the global rem baseline via a new
  `--ui-scale` CSS variable on `<html>`. The AppHeader page title and
  SectionHead labels compensate so they stay visually constant — only
  body text, KV rows, captions etc. grow. Persists per-user in
  `localStorage("rehau.uiScale")`. To be removed once a final value
  is baked into `index.css`.

## 6.0.8 — 2026-05-20

### Changed

- **TabBar is icon-only.** Removed the text labels under each tab and
  bumped the icon size from 20 → 28 px (plus a roomier active pill).
  Frees the vertical space the labels were occupying. `aria-label` and
  `title` keep the names available to screen readers and as desktop
  hover tooltips.

## 6.0.7 — 2026-05-20

### Fixed

- **Tab change now scrolls the SPA back to the top.** The existing
  `useEffect` called `window.scrollTo`, but body has `overflow: hidden`
  and `#root` is the real scroller — the call was a no-op. Switched to
  scroll the `#root` element directly. Affects both tab changes in the
  TabBar and entering / leaving a room detail.

## 6.0.6 — 2026-05-20

### Added

- **`@rehau/mobile`** — Expo (React Native) shell that wraps the existing
  React SPA in a WebView, with a native bootstrap UI for selecting which
  bridge to talk to. Supports **multiple installations** (add / edit /
  delete / switch / scan QR code) managed entirely by the native shell,
  outside the WebView. See `apps/mobile/README.md`.
- The SPA now detects when it's running inside the mobile shell
  (`window.ReactNativeWebView`) and surfaces two entry points back to the
  native installation manager: a "Switch installation" link on the login
  screen and an "Installation" row at the top of the System tab. Hidden
  in browser / HA-ingress contexts — no change for existing users.

### Fixed

- **JWT lifetime.** `apps/web/src/lib/auth.tsx` now persists the session
  in `localStorage` instead of `sessionStorage`. The previous behaviour
  silently capped sessions at one browser session, defeating the
  configured 30-day JWT TTL — most visibly on PWA installs and the new
  mobile app, where the user had to re-login on every cold start.
- **iOS login keyboard.** `Login.tsx` was locked to `100vh` so the iOS
  soft keyboard covered the focused input and the user could only type
  blind. Switched to `100dvh` (dynamic viewport height) and added
  `scrollIntoView` on every `Field` focus so the input always sits above
  the keyboard.

## 6.0.0 — 2026-05-20

**Complete rewrite.** The whole add-on has been replaced.

### What changed
- New add-on slug: `rehau_bridge_local` (was `rehau_nea_smart_mqtt`).
- New runtime: Node.js / Fastify / mqtt.js / cheerio. No Playwright,
  no headless browser, no cloud login.
- Local-only: talks HTTP directly to the REHAU base station on the LAN.
  No REHAU account, no e-mail, no 2FA, no POP3, no OAuth2.
- HA MQTT discovery for every room (climate + sensors + switches), the
  system (operating mode, energy level, outdoor temp, alarms), every
  U-module I/O channel, and optional calibration offsets.
- Bundled React Web UI (dark/light, EN/IT, PWA-ready) reachable via HA
  ingress *or* directly on port 8080.
- Auto-login via HA ingress headers — clicking the sidebar entry drops
  you straight into the dashboard.
- Swagger UI for the REST API at `/docs`.

### Migration from v5.x
There is no migration path. If you were running the cloud-based
v5 line:
1. Stop and uninstall the old add-on.
2. Remove any HA helpers / templates / automations that referenced its
   entity IDs — entity IDs in v6 are completely different (different
   slug, different naming).
3. Install v6 (see the README).
4. Re-wire your automations against the new entity IDs (they're
   prefixed with your `installation_name`).

The MQTT topic tree is also new: `<base>/<installation>/<device-id>/...`
instead of v5's flat layout.
