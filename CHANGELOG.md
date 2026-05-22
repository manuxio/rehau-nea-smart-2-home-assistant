# Changelog

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
