# Polling plan

Working document. The premise: once the bridge (MQTT + GUI + REST API) is the
only path to the appliance, REHAU pages fall into three roles:

- **Bucket A — Source-of-truth sensor / dynamic state.** Things REHAU's own
  sensors / controller decide: outdoor temp, per-room temp + humidity,
  fancoil current speed (`initialFan`) and running flag, active scheduled
  setpoint in program mode, alarms, IO state. Polling actually buys fresh
  data.
- **Bucket B — Mirror of what we already wrote.** Setpoints, modes, energy
  level, room flags, calibration, programs. The bridge is the source of
  truth; periodic re-reads are a safety net for out-of-band edits (someone
  joining the REHAU AP from a phone and twiddling knobs).
- **Bucket C — Identity / never-changes-at-runtime.** FW versions,
  uniqueCode, room names, hardware capability flags.

Recurring polls target bucket A. Bucket B uses a **write → refresh contract**
(every write fires a targeted re-poll) AND a periodic **safety re-sync** as
back-pressure. Bucket C is boot-only / safety-only.

Each URL gets two attributes:

- **Boot / safety re-fetch priority** — order during the boot kickoff and
  during a safety re-sync pass. **1 = first.** Ties are broken by grouping
  installer-gated pages contiguously so we can open / close one installer
  session for the whole chunk.

  > **Implementation note:** priority is a PLANNING concept, not a runtime
  > data structure. The implementation hard-codes the sequence in the
  > boot/safety function. No `BOOT_PRIO_*` config knobs, no priority enum
  > in the store. Anything we want to reorder later, we reorder in the
  > code.

- **Runtime interval** — steady-state cadence. `never` means "no scheduled
  poll, only boot + safety + on-write refresh + on-demand fetch from the
  SPA when the corresponding tab opens".

---

## Phase ordering (hard rules)

**1. Runtime intervals do not start until boot has completed.** The Poller
runs the boot kickoff first — every URL with a boot priority gets fetched
once, in priority order, through the device client's single-flight chain.
Only after `kickoffComplete()` resolves does the Poller schedule the runtime
`setInterval` timers for URLs that have a non-`never` cadence.

**2. MQTT connection does not start until boot has completed.** No MQTT
discovery published, no state topics, no LWT, no command subscriptions —
the broker doesn't see the bridge until boot is done. This keeps HA from
seeing a half-baked installation during the warmup. Trade-off accepted: HA
shows the device as unavailable for the full boot duration (~30–50 s with
all installer-gated reads warmed; see Boot cost below).

**3. Writes are queued through every long-running pass.** During boot AND
during a safety re-sync, write requests arriving at the API enter the same
device-client single-flight queue and fire as soon as the in-progress
sequence releases the chain. From the user's perspective: a tap on the
setpoint dial during a safety pass simply takes a bit longer to acknowledge,
but is never lost.

**4. Runtime intervals pause during a safety re-sync.** While safety is
walking the priority list, the scheduled runtime polls (room-operating
cycle, IO, dashboard, etc.) hold off. This guarantees safety produces a
coherent snapshot of every URL and prevents the two pollers from
double-booking the device. Runtime polls resume as soon as safety
completes.

---

## Safety re-sync

Triggered two ways:

- **On a slow timer.** Configurable via `SAFETY_RESYNC_S`, **default
  1800 s (30 min)**. Setting to `0` disables the auto timer; manual
  trigger still works.
- **On a manual trigger.** `POST /api/v1/diagnostics/refresh` (already
  exists) plus the SPA's "Refresh now" button in the System tab.

A safety pass walks every URL with a boot priority — same order as boot —
through the single-flight chain. Bucket B endpoints (`never` runtime
interval) get their only periodic re-read here.

---

## Installer session

REHAU's "installer mode" is a single device-global flag (no cookie, no
per-client scoping — see `CLAUDE.md` §6). Toggling it costs a `POST
/menu.html` to enter, a `GET /user-menu.html` to leave; everything in
between gets installer pages, everyone else on the LAN sees the same
thing.

**Policy: the bridge holds the installer session open continuously**, for
the entire process lifetime, regardless of `EXPOSE_IO`. Open at boot,
close on graceful shutdown.

- **Why:** every installer-gated read (IO, calibration, installer-tab
  reads, settings groups) becomes a single round-trip instead of
  login → fetch → logout. Boot drops by ~10 s on a typical install;
  the per-tab open is instant; the safety re-sync is much faster.
- **Trade-off accepted:** while the bridge is up, anyone else who
  joins REHAU's AP and opens the device web UI sees installer-tier
  pages by default. In our model that's a non-issue because the
  bridge is supposed to be the only path to the appliance; if the
  user is still using REHAU's UI directly, the install isn't
  "betterehau-managed" yet.
- **Recovery:** if the device drops the installer flag mid-flight
  (firmware reboot, watchdog, etc.) the next installer-gated fetch
  comes back as a user page; the bridge detects that and re-issues
  `POST /menu.html` transparently.

---

## Operations logging

The bridge already keeps a 15-entry **fetch** telemetry ring buffer. The
new plan widens that into a **50-entry operations ring buffer** (config:
`OP_LOG_SIZE`, default **50**) that captures every meaningful side effect
the bridge produces, not just outgoing HTTP fetches.

**Every operation emits an INFO-level log line** in a parseable shape
(structured JSON via pino, the existing logger). The same record is also
appended to the in-memory ring buffer so the SPA can surface the last N
without scraping addon logs.

Operations captured:

- `boot.start` / `boot.end` (with duration + URL count + success count)
- `safety.start` / `safety.end` (same shape)
- `fetch` — one entry per outgoing REHAU request (method, path, ms,
  outcome, status)
- `write` — one entry per accepted SPA / MQTT command (kind, target,
  outcome)
- `cache.invalidate` — when a write fires a targeted refresh
- `mqtt.connect` / `mqtt.disconnect`
- `mqtt.discovery.publish` (with reason: initial / capability-changed /
  season-flip)
- `installer.session.open` / `installer.session.close`
- `connection.state` — when the bucket-A connection state machine flips
  (online ↔ degraded ↔ offline)

**SPA integration — diagnostic snapshot enrichment.** The existing
`/api/v1/diagnostics/fingerprint` payload (and the System tab's
"Copy as Markdown" affordance) gains a new section: **"Recent operations
(last 50)"** rendered as a markdown list. When a user pastes the snapshot
into a GitHub issue, the maintainer sees the last few minutes of bridge
activity in chronological order — typically enough to spot a stuck
installer session, a flaky REHAU stretch, or a write that fired but
didn't refresh.

**Example pasted block:**

```markdown
### Recent operations (last 50)

- 14:02:11.043  boot.start
- 14:02:11.198  fetch  GET /                              ok    137 ms
- 14:02:11.354  fetch  GET /room-page.html                ok    142 ms
- 14:02:11.512  fetch  POST /room-operating.html z=0      ok    156 ms
- ...
- 14:02:38.211  installer.session.open
- 14:02:38.890  fetch  GET /installer-inputoutput.html    ok    679 ms
- ...
- 14:02:52.401  boot.end                                  36 s, 36/36 ok
- 14:02:52.420  mqtt.connect
- 14:02:52.480  mqtt.discovery.publish                    initial, 17 entities
- 14:02:53.001  fetch  POST /room-operating.html z=0      ok    198 ms  (cycle)
- ...
- 14:08:11.110  write  setRoomSetpoint r-arianna-z0 → 22.5  ok
- 14:08:11.450  cache.invalidate  room r-arianna-z0
- 14:08:11.811  fetch  POST /room-operating.html z=0      ok    361 ms  (refresh)
```

The shape is intentionally machine-parseable (`HH:MM:SS  kind  args...`)
so a future support tool could ingest it directly.

---

## SPA cache discipline

The SPA stops passing `?fresh=true` on program reads (and any other read
that currently bypasses cache). Reads go through the bridge's in-memory
cache; writes invalidate the relevant cache entry via the SPA's
TanStack-Query `onSuccess`, and the bridge's write → refresh contract
populates the new value before the mutation resolves.

End state:

- First SPA open of any tab is **instant** (boot already warmed the
  cache).
- Every write returns the post-write state, which the SPA installs into
  the cache atomically.
- Boot / safety / write-refresh are the only paths that hit REHAU
  directly for these endpoints. The SPA never causes a REHAU round-trip
  on read.

---

## Endpoints

### `GET /`

- **Boot / safety priority:** 1
- **Runtime interval:** 120 s
- **Carries:** outdoor temperature *(A)*, operating mode *(B)*, energy level
  *(B)*, clock.
- **Rationale:** outdoor temp drifts slowly; modes are bucket B (we own
  writes), so 2 min steady-state is a generous safety net.

### `GET /room-page.html`

- **Boot / safety priority:** 2
- **Runtime interval:** 120 s
- **Carries:** room list — zone, name, current temperature.
- **Rationale:** the per-room current temperature is more authoritatively
  covered by `/room-operating.html` below. The 120 s loop here is purely
  the "did a new room appear / get renamed?" safety net.

### `POST /room-operating.html` (per zone)

- **Boot / safety priority:** 5
- **Runtime interval:** **scheduled cycle** — every `clamp(SLOT × N, MIN, MAX)`
  seconds a cycle starts and fetches all rooms sequentially through the
  device client's single-flight chain.

  | Config key | Default | Meaning |
  | --- | --- | --- |
  | `POLL_ROOM_DETAIL_SLOT_S` | **5** | Per-room slot inside the cycle (cycle target = `SLOT × N`). |
  | `POLL_ROOM_DETAIL_MIN_S` | **10** | Floor — even a single-room install polls no faster than this. |
  | `POLL_ROOM_DETAIL_MAX_S` | **30** | Cap — per-room freshness is never worse than this, regardless of N. |

  Worked examples with defaults:

  - N = 1 → 5 → raised to 10 s cycle
  - N = 2 → 10 s
  - N = 4 → 20 s
  - N = 6 → 30 s (formula hits the cap)
  - N ≥ 6 → 30 s (capped)

  Per-room freshness = the cycle period itself (NOT cycle × N — all rooms
  fetched inside one cycle).

- **NOT round-robin.** A cycle gives the SPA a coherent same-moment snapshot
  of every room; no room ever drifts further than the others.
- **Carries:** per-room current temperature + humidity + fancoil current
  speed (`initialFan`) + fancoil running flag + active mode + active
  setpoint indicator. *Bucket A.*
- **Replaces** the legacy `POLL_ROOM_DETAIL_S` (round-robin tick) once
  implemented; that variable goes away.

### `GET /installer-inputoutput.html`

- **Boot / safety priority:** 9
- **Runtime interval:** 10 s *(only when `EXPOSE_IO=true` and installer access
  is configured)*
- **Carries:** master + per-umodule I/O channels (RZ, RELAY, DI, AI, AO).
  *Bucket A.*
- **Operational note:** the installer session is **permanently held open**
  for the entire bridge lifetime (see "Installer session" section); this
  cadence is free of login/logout overhead.

### `GET /user-config-installer.html`

- **Boot / safety priority:** 9
- **Runtime interval:** 600 s
- **Carries:** FW versions, uniqueCode *(C)*, outdoor offset, seasonStart /
  seasonEnd *(B)*.
- **Rationale:** outdoor offset + season window are user-configurable from
  REHAU's own UI, so a 10-min safety net catches out-of-band edits faster
  than the 30-min safety re-sync. FW / uniqueCode never change at runtime
  — they're just along for the ride.
- **Auth note:** NOT installer-gated despite the name (regular `GET`, no
  installer session required).

### `GET /messages.html`

- **Boot / safety priority:** 10
- **Runtime interval:** 300 s
- **Carries:** alarms / notifications. *Bucket A — REHAU emits these on
  its own.*

### `GET /installer-adjustementOffset.html`

- **Boot / safety priority:** 10
- **Runtime interval:** **never** — read on write only + on safety re-sync.
- **Carries:** outdoor probe offset + per-room temperature / humidity
  offsets. *Bucket B — the bridge writes them via
  `POST /installer-diagnosis.html`.*
- **Replaces** the existing `POLL_CALIBRATION_S` runtime poll; that
  variable goes away (the 30-min safety re-sync supersedes it).

### `POST /room-set-up.html` (per zone)

- **Boot / safety priority:** 10
- **Runtime interval:** **never** — read on write only + on safety re-sync.
- **Carries:** per-room flags (lock, auto-start, window detection),
  per-mode slot setpoints, program assignment (PWeek + PDay00..PDay06),
  fancoil profile (FanT). *Bucket B.*

### `POST /user-update-daily-program.html` (per id 1..10)

- **Boot / safety priority:** 15
- **Runtime interval:** **never** — read on write only + on safety re-sync.
- **Carries:** the 96-bit daily program. *Bucket B.*

### `POST /user-update-weekly-program.html` (per id 1..5)

- **Boot / safety priority:** 15
- **Runtime interval:** **never** — read on write only + on safety re-sync.
- **Carries:** the Mon..Sun → daily-id map for the weekly program. *Bucket B.*

### Installer-tab read endpoints

All seven are installer-gated and warmed at boot (per the "full system
overview at boot" requirement). Runtime is on-demand from the SPA's
Installer tab + on safety re-sync; no scheduled poll.

| URL | Parser / purpose |
| --- | --- |
| `GET /installer-system-statistics.html` | `parseUptime` — Installer → Diagnostics |
| `GET /diagSett.html` | `parseTopology` — Installer → Bus |
| `GET /circSett.html` | `parseHeatCurve` — Installer → Curve. Same page also feeds the `curve` installer-settings group. |
| `GET /hCSett.html` | installer settings group `heatcool` — Installer → Advanced |
| `GET /deviSett.html` | installer settings group `devices` — Installer → Advanced |
| `GET /funcSett.html` | installer settings group `functions` — Installer → Advanced |
| `GET /advSett.html` | installer settings group `pid` — Installer → Advanced |

- **Boot / safety priority:** 15 *(all)*
- **Runtime interval:** **never** — on-demand from the SPA + on safety
  re-sync.

---

## Boot / safety order summary

| Prio | URL(s) | Cost (per pass) |
| --- | --- | --- |
| 1 | `GET /` | 1 fast request |
| 2 | `GET /room-page.html` | 1 fast request |
| 5 | `POST /room-operating.html` × N | N fast requests (per zone) |
| 9 | `GET /installer-inputoutput.html` + `GET /user-config-installer.html` | IO installer-gated; sys-info not. Installer session is already open at this point (opened at boot, held for the process lifetime). |
| 10 | `GET /messages.html`, `GET /installer-adjustementOffset.html`, `POST /room-set-up.html` × N | Messages is fast; calibration + room-set-up are installer-gated → free, session already open. |
| 15 | 10 daily program reads + 5 weekly program reads + 7 installer-tab reads = **22 fetches** | Programs use regular POSTs (no installer mode); installer-tab reads are free against the held-open session. |

**Total per pass on a 4-room install:**
~ 1 + 1 + 4 + 2 + (1 + 1 + 4) + 22 = **36 requests**

At ~200–500 ms each (slower for installer-gated pages) plus the 150 ms
`DEVICE_MIN_GAP_MS` between every request, a full pass on a healthy device
is roughly **20–40 s**.

---

## Discrepancies vs the current code

| Aspect | Today | Plan |
| --- | --- | --- |
| `/` cadence | 30 s | 120 s |
| `/room-page.html` cadence | 15 s | 120 s |
| `/room-operating.html` model | round-robin, 1 room per 60 s tick (per-room freshness ≈ 4 min for 4 rooms) | scheduled cycle, all rooms per 10–30 s (per-room freshness 10–30 s) |
| `/installer-inputoutput.html` cadence | 10 s | 10 s *(unchanged)* |
| `/user-config-installer.html` cadence | boot only | 600 s |
| `/installer-adjustementOffset.html` cadence | 180 s (or 0 = off) | never + safety re-sync |
| `/messages.html` cadence | 300 s | 300 s *(unchanged)* |
| `/room-set-up.html` cadence | boot + on-write | boot + on-write + safety re-sync *(safety added)* |
| Daily / weekly program reads | on-demand from Programs tab | **boot warmed** + on-demand + safety re-sync |
| 7 installer-tab reads | on-demand from Installer tab | **boot warmed** + on-demand + safety re-sync |
| Boot duration | ~5–10 s | ~20–40 s **(intentional — see rule 2)** |
| MQTT connection | starts at process start | **starts only after boot completes** |
| Safety re-sync | none (manual `POST /diagnostics/refresh` only) | **slow timer, default 30 min** + existing manual trigger |
| Runtime polls pause during safety | no | **yes** |

### Config variables

**New:**

- `POLL_ROOM_DETAIL_SLOT_S` = 5
- `POLL_ROOM_DETAIL_MIN_S` = 10
- `POLL_ROOM_DETAIL_MAX_S` = 30
- `SAFETY_RESYNC_S` = 1800 *(0 disables the auto timer; manual stays)*
- `POLL_SYSTEM_INFO_S` = 600 *(wasn't previously a knob)*
- `OP_LOG_SIZE` = 50 *(rolling buffer of recent operations — see Operations logging)*

**Existing, kept (defaults updated):**

- `POLL_DASHBOARD_S` 30 → **120**
- `POLL_ROOMS_S` 15 → **120**
- `POLL_MESSAGES_S` 300 → **300** *(unchanged)*
- `POLL_IO_S` 10 → **10** *(unchanged)*

**Existing, removed:**

- `POLL_ROOM_DETAIL_S` — superseded by the three SLOT/MIN/MAX knobs.
- `POLL_CALIBRATION_S` — calibration becomes write-only; safety re-sync
  supersedes the 180 s default.

---

## SPA visibility flags

Independent of polling: a feature flag that hides parts of the SPA
without changing the bridge's behaviour at all.

| Config key | Default | What it does |
| --- | --- | --- |
| `SPA_INSTALLER_TAB` | **true** | When `false`, the SPA hides the Installer tab from the bottom TabBar and refuses to render `#/installer` (route guard, no UI). |

When `SPA_INSTALLER_TAB=false`:

- The bridge still polls every installer-gated endpoint per the boot /
  safety / runtime schedule above.
- The HTTP API still serves `/api/v1/installer/*` to anyone with the
  right role + JWT. CLI / curl / MQTT consumers are unaffected.
- The MQTT integration still publishes calibration / IO entities per the
  `EXPOSE_*` flags.
- Only the SPA's user-facing Installer tab disappears. The cache stays
  warm, the data stays current — it's purely a UI hide.

Intended use: deployments where the homeowner uses the SPA but doesn't
want installer-tier surfaces exposed to family members, while
maintainers / scripts can still reach the installer routes through the
REST API.

The flag is exposed alongside `addonVersion`, `installationName`, etc.
in whatever endpoint the SPA reads at boot (likely the existing
`/api/v1/system` or a new `/api/v1/spa-config` if we want a stricter
boundary). Read once on SPA mount; no live reactivity needed since
addon-config edits already require a restart.

---

## Decisions log

- **`/user-config-installer.html` cadence** → **600 s**. Catches
  out-of-band edits faster than the 30-min safety re-sync, slower than
  the previous draft to reflect that almost everything on the page is
  identity / bucket C.
- **SPA cache discipline** → SPA drops `?fresh=true` on program reads
  (and any equivalent bypass). Reads from cache, writes invalidate. See
  "SPA cache discipline" section.
- **Boot failure handling** → each fetch has a per-request timeout
  (`DEVICE_REQUEST_TIMEOUT_MS`); failures log an `op.fetch error` entry
  and the kickoff continues to the next priority slot. MQTT connects
  when the kickoff RESOLVES regardless of how many fetches failed —
  partial data is marked `null` per the no-defaults rule and HA shows
  "unavailable" for fields we couldn't read.
- **Safety re-sync logging** → covered by the Operations logging
  section (`safety.start` / `safety.end` ops, with duration + success
  ratio).
- **General observability** → 50-entry operations ring buffer, every
  meaningful side effect logged at INFO and surfaced through the SPA's
  "Copy as Markdown" diagnostic snapshot for one-tap GitHub-issue paste.
- **`/room-set-up.html` boot cost (N installer-mode fetches at boot)** →
  **accepted**. The linear-in-N boot time is the price for a snappier
  SPA: first open of any tab finds the cache already warm, no REHAU
  round-trip needed.
- **Installer session always held open** → for the entire bridge
  lifetime, regardless of `EXPOSE_IO`. Every installer-gated read is
  free of login/logout overhead. Trade-off accepted: other clients on
  the REHAU AP see installer pages by default while the bridge is up.
  See "Installer session" section.
- **SPA Installer tab visibility is a UI-only flag** →
  `SPA_INSTALLER_TAB` (default true). Hides the tab from the SPA's
  bottom TabBar without touching the bridge: polls continue, REST API
  still serves `/api/v1/installer/*`, MQTT entities still publish per
  the existing `EXPOSE_*` flags. See "SPA visibility flags" section.

The plan is locked. Implementation can proceed.
