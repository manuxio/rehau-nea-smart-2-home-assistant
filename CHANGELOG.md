# Changelog

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
