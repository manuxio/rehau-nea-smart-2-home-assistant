# @rehau/mobile — REHAU Nea Smart 2 mobile app

A thin Expo (React Native) shell that wraps the existing **@rehau/web** React
SPA in a WebView. Same UI, same code path — the native shell only handles
**bootstrapping** (which server to connect to) and **connection health**.

## Why a WebView shell?

The web SPA is already mobile-first, theming-aware, localized, and exhaustively
tested against the bridge. Re-implementing the UI in React Native would mean
maintaining two divergent codebases for one slow-moving feature surface. The
WebView shell gives us:

- Native distribution (App Store / Play Store) without porting the UI
- Per-installation login persistence (WKWebView/Android WebView keep
  `localStorage` per-origin across launches)
- Native UX for the **server-connection bootstrap** — exactly the part you
  cannot reasonably put inside a web page that doesn't know its server yet

## Architecture

```text
┌──────────────────────────── Expo (React Native) ───────────────────────────┐
│                                                                            │
│  Native chrome (top bar) — installation name + switcher button             │
│  ──────────────────────────────────────────────────────────────────────    │
│                                                                            │
│         WebView ◀── loads http://<bridge>/  (the SPA from @rehau/web)      │
│           │                                                                │
│           ▼                                                                │
│    apps/web bundled SPA — exactly as served by the addon                   │
│                                                                            │
└─ Outside the WebView (modal sheets) ──────────────────────────────────────┘
  • Installations list  (add / edit / delete / switch)
  • Installation editor (name, URL, "Test connection" probe)
  • Connecting / Error screens (cold start + failure recovery)
```

The web app's `apiClient` already resolves URLs relative to `document.baseURI`,
so loading the WebView at `http://<bridge>/` makes every API call hit the
correct server with **zero changes** to the web app itself.

### Multiple installations

Storage shape (AsyncStorage key `@rehau/mobile/v1`):

```ts
{
  version: 1,
  installations: [{ id, name, url }, ...],
  activeId: string | null,
}
```

Switching installations remounts the WebView (keyed on installation id) at the
new URL. Because `localStorage` is **per origin**, the JWT for each bridge is
kept independently and survives switches and cold starts (see "Auth
persistence" below).

### Adding an installation by QR code

The URL field on the installation editor has a QR scanner button (the small
icon next to the input). Tapping it opens a full-screen camera using
`expo-camera`; on a successful read the URL field (and optionally the name)
is filled in.

Accepted QR payloads, in order of priority — see `src/qrPayload.ts`:

1. **JSON envelope** — `{"url":"http://1.2.3.4:8080","name":"Home"}`. Use
   this when the bridge or installer docs auto-generate a QR with metadata.
2. **Custom deep link** — `rehau-nea://install?url=<u>&name=<n>`. Reserved
   for future "tap to install" flows (the `rehau-nea://` scheme is
   registered in `app.config.ts`).
3. **Plain URL** — `http://1.2.3.4:8080` is taken verbatim.
4. **Bare host[:port]** — `1.2.3.4:8080` is normalized to `http://…`.

Camera permission is requested on first scan attempt. Strings (iOS
`NSCameraUsageDescription` and the Android runtime prompt) live in
`app.config.ts`.

### Where is the URL setting?

> "Such option should be in phone's settings, not directly in the app"

The URL setting is **never inside the WebView** (i.e., never inside the
"app" itself). It lives in two native-shell entry points:

1. The **Installations** sheet, reachable via the hamburger button in the
   native top bar above the WebView. This is the only URL-management UI; it's
   architecturally outside the running web app.
2. The **Error screen** that replaces the WebView when a connection probe
   fails — "Manage installations" button.

iOS `Settings.bundle` was considered but doesn't model a list of installations
well (it's plist-driven and can't host "add/delete row" UI). Skipped for v1.

### Auth persistence

The bridge's web SPA used `sessionStorage` for the JWT — which clears when the
WebView dies. Mobile sessions were therefore dropping on every cold start.

Fix shipped together with the mobile app: `apps/web/src/lib/auth.tsx` now uses
`localStorage`. Effect:

- 30-day JWT TTL now actually delivers 30 days on PWA and mobile.
- In the mobile WebView, JWTs are kept per origin and persist across:
  - app kill + relaunch (WKWebView / Android WebView keep website data)
  - installation switches (different origin = different storage, switching
    back restores the prior session)

## Project layout

```text
apps/mobile/
├── App.tsx                                  # state machine + modal routing
├── index.ts                                 # Expo registerRootComponent
├── app.config.ts                            # Expo manifest
├── babel.config.js
├── package.json
├── tsconfig.json
├── assets/
│   ├── icon.png                             # 1024×1024 (replace before release)
│   ├── adaptive-icon.png                    # Android adaptive foreground
│   └── splash.png                           # splash screen
└── src/
    ├── types.ts                             # Installation, Persisted, HealthOk
    ├── theme.ts                             # mirrors the web app dark palette
    ├── storage.ts                           # AsyncStorage CRUD
    ├── health.ts                            # GET /healthz with timeout
    └── screens/
        ├── ConnectingScreen.tsx
        ├── ErrorScreen.tsx
        ├── InstallationsScreen.tsx
        ├── InstallationEditScreen.tsx
        └── WebAppScreen.tsx                 # native top bar + <WebView>
```

## Develop

From the repo root:

```bash
npm install                                  # workspaces pick this up
npm run -w @rehau/mobile start               # Expo dev server (QR code)
npm run -w @rehau/mobile ios                 # iOS simulator
npm run -w @rehau/mobile android             # Android emulator
npm run -w @rehau/mobile typecheck
```

The first install will fetch Expo SDK 54, react-native 0.81, and
react-native-webview. No native modules require linking — Expo handles
everything.

> **iOS simulator gotcha**: the simulator can reach your dev machine via its
> LAN IP (e.g. `http://192.168.x.x:8080`), not via `localhost`. Add an
> installation with the LAN IP.

> **Android emulator gotcha**: use `http://10.0.2.2:8080` to reach the host
> machine's `localhost`, or the LAN IP for a real bridge.

### Tunnel mode (`expo start --tunnel`)

Use this when your phone can't share Wi-Fi with the dev machine — the Expo
dev server is exposed via an ngrok-style tunnel and the QR code resolves
over the internet.

**ngrok requires a (free) authtoken since 2023.** Without one, `@expo/ngrok`
crashes with:

```text
TypeError: Cannot read properties of undefined (reading 'body')
```

One-time setup:

1. Sign up free: <https://dashboard.ngrok.com/signup>
2. Copy your authtoken from <https://dashboard.ngrok.com/get-started/your-authtoken>
3. Persist it into ngrok's config file:

   ```bash
   npm run -w @rehau/mobile tunnel:auth -- <YOUR_TOKEN>
   # or interactively:
   npm run -w @rehau/mobile tunnel:auth
   ```

4. Start with tunnel:

   ```bash
   npm run -w @rehau/mobile tunnel
   ```

> **Tunnel only fixes one hop**: it routes the phone to the Expo dev server.
> The WebView still loads the bridge URL directly (`http://192.168.x.x:8080`),
> so the phone also needs a route to the bridge. On cellular, use Tailscale
> (or HA's Nabu Casa) and point the installation URL at the resulting
> remote-reachable address.

## Build

For App Store / Play Store distribution, use **EAS Build** (cloud) or local
prebuild + Xcode/Android Studio:

```bash
npx eas build --platform ios
npx eas build --platform android
```

Or local:

```bash
npm run -w @rehau/mobile prebuild            # generates ios/ + android/
# then run xcodebuild or gradlew as usual
```

The `assets/` PNGs shipped here are 1×1 placeholders. Generate proper
1024×1024 versions from `apps/web/public/icon-source.svg` before any release
build — the `apps/web/scripts/build-icons.mjs` pipeline can be extended to
emit them.

## Why HTTP (not HTTPS) by default

`NSAllowsArbitraryLoads` (iOS) and `usesCleartextTraffic` (Android) are
**enabled**. REHAU base stations only speak HTTP on the LAN; the bridge
inherits that. If users front the bridge with a reverse proxy that terminates
TLS (Caddy, Traefik, HA's ingress), HTTPS works without any code change.

## Future

- Reverse-tunnel awareness (mDNS auto-discovery on the LAN)
- Background reachability monitoring + native notifications on bridge offline
- Sharing code with `@rehau/types` for typed health responses (currently inlined
  to avoid Metro/workspace hoisting friction; the `HealthOk` shape is trivial)
