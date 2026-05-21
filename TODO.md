# TODO

Tracked work that isn't time-boxed enough to live in a single commit.
Things land in `CHANGELOG.md` as they ship.

## Server-error visibility (P1)

The bridge currently silently retries when the REHAU base station is
unreachable or slow. The user sees stale data in HA / the web app without
any signal that something is wrong. Three layers, top → bottom:

### 1. Bridge tracks recent-fetch telemetry

Keep an in-memory ring buffer of the **last 10 device fetches** with:

- timestamp
- target URL (which REHAU page)
- duration ms
- outcome: `ok | timeout | http_<n> | parse_error | tcp_error`
- if failure: the error message

Expose it on `/healthz` (extend the payload) and on a new
`GET /api/v1/diagnostics/fetches` route returning the same buffer with
aggregates:

- failure count in the window
- average / p95 duration
- last successful fetch timestamp
- consecutive-failure count

Implementation hint: a small wrapper around
`apps/bridge/src/device/client.ts` `request()` that pushes a record to
the buffer on every call. Buffer goes in `core/store.ts` alongside the
existing `deviceStatus`.

### 2. Bridge signals connection errors

When the consecutive-failure count crosses a threshold (say 3), or no
fetch has succeeded in N seconds (say 30s), mark the bridge as
**degraded** and surface that downstream:

- **MQTT**: flip the existing `availability` topic for the system /
  per-room entities to `offline` *or* emit a dedicated
  `connection_state` topic (`online | degraded | offline`) so HA's
  `binary_sensor.rehau_bridge_connected` lights up.
- **REST**: include `connection.state` + `connection.reason` in
  `/api/v1/system` so the web app and any external dashboard can
  display the state without polling `/healthz`.
- **SSE** (`/api/v1/events`): emit a `connection` event whenever the
  state transitions, so the web app can react instantly.

Don't take down the WHOLE addon when degraded — keep serving last-known
state, the UI is more useful with stale data than empty.

### 3. React web app surfaces bridge health

When `connection.state !== "online"`:

- Show a **persistent banner** at the top of every screen ("Bridge
  cannot reach the REHAU base station — showing data from
  <relative-time> ago") that disappears as soon as state goes back to
  `online`.
- Disable write controls (setpoint, mode, flags) — they'd just queue
  up against a dead socket and toast errors anyway. Greyed-out
  affordance + tooltip is friendlier than red toasts.
- Mobile shell (`apps/mobile`) doesn't need anything beyond what the
  web app shows — the WebView surfaces it naturally.

Order of work: 1 → 2 → 3. Layer 1 unblocks the others.

## Other known gaps (from CLAUDE.md §10)

- **Full installation guide with screenshots.** See `INSTALL.md` — it
  exists now (2026-05-22). Promote it in `README.md` early. *(done)*
- **CI workflow** to build addon bundles automatically and update
  `rehau-bridge/dist/` on push.
- **Deploy script** in `scripts/`: replace the current manual
  build + copy + bump-version cycle with `npm run deploy`.
- **Per-room fancoil write paths** (flap, possibly other writable I/O
  pieces the device exposes via undocumented POSTs).
- **HA addon icon source** is 762×750 — non-square. Crop or replace
  with a square master for crisper rendering.
