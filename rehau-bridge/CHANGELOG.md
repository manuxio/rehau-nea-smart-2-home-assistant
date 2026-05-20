# Changelog — REHAU Nea Smart 2 Bridge (local)

## 6.0.10

- **Dashboard scroll position survives a room visit.** Going Home →
  Room → Home (via the back button) now lands you exactly where you
  left off in the room list, instead of yanking you back to the top.
  Switching tabs and entering a fresh room still scroll to the top, as
  before.
- **TabBar last icon no longer clips off-screen on narrow phones.**
  Shrunk the active pill's horizontal padding from 22 px to 12 px so
  all five icons (including the installer tab) fit comfortably on a
  360 px viewport.
- **Theme, language, text-size, and logout moved into the System
  page.** The floating gear button is gone. All of these now live in
  the new "Preferences" and "Account" sections at the top of the
  System tab. The login screen still inherits whatever theme/lang you
  last set (it's persisted), there's just no in-place toggle there
  anymore.
- **Room preset chooser now sits above the setpoint dial.** Standby /
  Normal / Reduced / Program is the first decision you make in a
  room; the temperature dial follows. Reorder only — same controls.

## 6.0.9

- **Temporary text-size slider in Settings.** While we tune the right
  body-text baseline, the settings menu now exposes a 0..+40 % slider
  (steps of 5 %) that scales the rem baseline of the whole SPA. The
  big page title (AppHeader h1) and the small uppercase section
  labels (SectionHead) compensate so they stay visually constant —
  only body text, KV rows, captions etc. grow. The choice persists in
  localStorage (`rehau.uiScale`). Will be removed once the right
  baseline is picked and baked into `index.css`.

## 6.0.8

- **Icon-only TabBar.** Removed the text labels under each tab and
  enlarged the icons (20 → 28 px) plus the active pill. Frees a row of
  vertical space at the bottom of the screen. The full label is still
  exposed via `aria-label` and `title` for assistive tech and desktop
  tooltips.

## 6.0.7

- **Scroll position resets on tab change.** Switching between tabs
  (and entering / leaving a room detail) now reliably scrolls back
  to the top of the new view, so a long Dashboard scroll position
  no longer leaks into System or Messages. The previous attempt
  called `window.scrollTo`, but the SPA scrolls `#root` (body is
  locked with `overflow: hidden`) — the call was a no-op.

## 6.0.6

- **Login session now actually lasts 30 days.** The SPA stored the
  JWT in `sessionStorage`, which dies when the browser tab / WebView
  is killed — silently capping every session at one browser session
  regardless of the configured JWT TTL. Moved to `localStorage`. On
  PWA installs and the new mobile app this means you really stay
  signed in across cold starts.
- **Login form keyboard handling on iOS.** The form was locked at
  `100vh` so the soft keyboard covered the password field and you
  could only type blind. Switched to `100dvh` (dynamic viewport
  height) plus a `scrollIntoView` on input focus, so the focused
  input always sits above the keyboard.
- **Native-mobile shell integration.** When the SPA detects it's
  running inside the new `@rehau/mobile` React Native shell (via
  `window.ReactNativeWebView`), it now surfaces two entry points
  back to the native installation manager: a "Switch installation"
  link on the login screen and a new "Installation" row at the top
  of the System tab. In any other context (browser PWA, HA ingress)
  these are invisible — no behaviour change for existing users.

## 6.0.2

- **TabBar bottom gap on iOS PWA.** The fixed bottom bar had a hard
  14 px bottom padding that compounded with the iPhone's home-indicator
  safe area, leaving a noticeable empty band below the icons. The
  TabBar now sets `padding-bottom: calc(env(safe-area-inset-bottom) + 4 px)`
  so the icons sit just above the home indicator on every device, and
  the bar's tinted background extends edge-to-edge.

## 6.0.1

- **Language-agnostic parsing.** The bridge previously assumed the REHAU
  device's web UI was in Italian — it matched the words "esterna" (for
  outdoor temp), "Modulo-U" (for U-module sections in I/O) and
  "Versione" (for firmware versions). Now we extract these values by
  DOM structure / trailing-number regex, so the addon works for any of
  REHAU's UI languages (Deutsch, English, Français, Türk, Italiano,
  русский, românesc, polski, Nederlands, español, český, magyar,
  српски, български, svenska).

## 6.0.0

Complete rewrite. See the [repository CHANGELOG](../CHANGELOG.md) for
the full story.

Headline features:

- Local HTTP scraping of the REHAU base station — no cloud, no 2FA.
- Per-room climate + fancoil + light + room-flags via MQTT discovery.
- React Web UI with auto-login under HA ingress, mobile/PWA optimised.
- Diagnostic sensors for raw I/O, calibration offsets, fancoil state.
- Swagger UI for the REST API.
- 30-day default JWT TTL — won't ask for re-login from your phone for
  a month.
