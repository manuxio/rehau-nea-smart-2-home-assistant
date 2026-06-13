# BetteRehau Bridge Firmware

### The REHAU Nea Smart 2.0, finally yours.

Your heating system already lives on your wall. **BetteRehau** turns the box next to it
into a tiny, self-contained server that gives you back everything REHAU locked away
behind a sluggish cloud app, e-mail 2FA, and a support forum where issues go to die.

One ESP32. No cloud. No add-on. No account. No telemetry leaving your house.

**➡️ [Download the latest release](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/latest)** — currently [`bridge-fw-v0.13.0`](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/tag/bridge-fw-v0.13.0).

**🔧 [Firmware source code](https://github.com/manuxio/betterehau-bridge)** — ESP-IDF project, security audit, and build instructions.

> ⚠️ **Under active testing.** The plain Olimex ESP32-POE has limited RAM, and running the
> full scrape + MQTT + SPA + API stack pushes it close to the edge — long-run heap
> stability is still being validated. If the headroom proves too tight, the project may
> move to an **Olimex ESP32-POE with PSRAM (WROVER)** for the production board. Treat this
> release as a capable beta, not a final hardware verdict.

> **Why this exists.** The official REHAU software is slow, cloud-tethered, and forgets
> you exist the moment your internet hiccups. The app is clumsy, the integrations are
> non-existent, and asking for help is like shouting into a well. So we stopped asking.
> This firmware is the first kernel of a project with one goal: become a **100% drop-in
> replacement** for REHAU's software stack — local, fast, open, documented, and built by
> people who actually use it every day. If that bothers REHAU, good. It should.

---

## See it

**Admin GUI** — everything about the bridge in one local web app:

![Admin dashboard](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/download/bridge-fw-v0.13.0/v0.13.0-admin-dashboard.jpeg)

**Resident climate app (SPA)** — served *directly from the board*, installable as a PWA on your phone:

![Resident SPA](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/download/bridge-fw-v0.13.0/v0.13.0-resident-spa.jpeg)
![SPA room detail](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/download/bridge-fw-v0.13.0/v0.13.0-spa-room.jpeg)

**Live REHAU status** — scraped straight from the base station, no cloud round-trip:

![REHAU status](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/download/bridge-fw-v0.13.0/v0.13.0-rehau-status.jpeg)

**Direct MQTT / Home Assistant** — point it at your broker and you're done:

![MQTT / Home Assistant](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/download/bridge-fw-v0.13.0/v0.13.0-mqtt-ha.jpeg)

---

## What it does

The firmware runs on a single **Olimex ESP32-POE** board on your LAN. It talks to the
REHAU Nea Smart 2.0 base station over plain local HTTP, understands every page the
controller serves, and re-exposes the whole system through **four independent front
doors** — use one, use all four, they all read and write the same live state:

| Front door | What you get |
|---|---|
| 🌐 **REST API** | A clean, documented OpenAPI 3.0 surface — 69 endpoints — for rooms, system, programs, scenes, installer data, diagnostics and device management. |
| 📡 **MQTT + HA Discovery** | Publishes every room and system entity to your broker. Home Assistant auto-creates the device and all its entities. No add-on, no YAML. |
| 📱 **Resident SPA** | A full mobile-first climate app **hosted by the firmware itself** at `/spa/`. Installable PWA, 15 UI languages, dark theme, scenes, schedules. |
| 🛠️ **Admin GUI** | A second web app for the *bridge* itself: networking, MQTT, users, OTA, diagnostics, recovery. |

It is, fundamentally, **a standalone API server with a heating system attached** — and it
keeps working whether or not Home Assistant, the internet, or REHAU's cloud are alive.

---

## Feature highlights

### 🏠 Full climate control
- **Per-room climate**: current temperature, humidity, setpoint, mode
  (**Standby / Normal / Reduced / Program**), heat/cool demand.
- **Fancoil aware**: native fan modes (`off/auto/low/medium/high`) for SILENT BREEZE
  units, `on/off` driven by *real motor state* for switched fancoils, plus flap control.
- **Virtual fancoils**: every room exposes a firmware-created **virtual fan** entity that
  tracks REHAU's actual fan demand — even for rooms whose physical convector REHAU doesn't
  control directly. Use it as a clean source-of-truth to mirror onto *any* HA fan, switch,
  or third-party unit, so the whole house follows REHAU's logic without touching the base
  station.
- **Room flags**: display lock, auto-start pre-heat, open-window detection.
- **Per-room light** relay control where the controller exposes it.
- **System-wide**: global operating mode, energy level, outdoor temperature, REHAU alarm
  log — all readable and (where the device allows) writable.

### 🗓️ Programs & scenes
- **Daily programs** (10 slots, full 96 quarter-hour resolution) and **weekly programs**
  (7-day assignment) — read *and write*.
- **Scenes**: define multi-room presets once, apply them in a tap. Persisted on-device in NVS.
- **Floors / zones map**: label every zone and group rooms by floor.

### 📡 Home Assistant, the right way
- **Direct MQTT** — the board connects to *your* broker. No companion add-on to install,
  maintain, or break on the HA side.
- **HA Discovery** auto-builds the device card and every entity. One toggle: clear the
  discovery prefix to suppress autodiscovery while keeping state/command topics flowing.
- **Installation name = HA device name.** Rename once, it propagates.

### 🔬 Installer-grade insight
- Master + U-module **I/O snapshot**, **heat curve**, **calibration** (read & write),
  **bus topology**, controller **uptime** — the stuff REHAU hides behind an installer code,
  surfaced as clean JSON.

### 🔐 Local-first security
- **2-tier accounts** (user / admin), JWT bearer auth, boot-bound tokens.
- Wipe-all-accounts mode for trusted LANs. Physical factory reset via a long button press.
- **Nothing leaves your network.** No cloud, no account, no phone-home.

### 🌍 Connectivity & operations
- **PoE Ethernet + Wi-Fi**, static or DHCP, with a transparent TCP proxy to the REHAU box.
- **WireGuard client** built in — reach your heating from anywhere, encrypted, no port-forward.
- **Network diagnostics**: ping, traceroute, routing table, interface list — from the device.
- **OTA updates** for both the firmware *and* the SPA image, straight from the admin GUI.
- **Config backup / restore** of the full NVS configuration.

---

## The API

OpenAPI 3.0 spec embedded at **`/openapi.json`**. REST under **`/api/v1/...`**; device
management under **`/api/...`**. 69 endpoints across 12 groups:

### Rooms
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/rooms` | List rooms |
| GET | `/api/v1/rooms/{id}` | Single room |
| PUT | `/api/v1/rooms/{id}/setpoint` | Set setpoint |
| PUT | `/api/v1/rooms/{id}/mode` | Set mode / preset |
| PUT | `/api/v1/rooms/{id}/fan` | Set fancoil speed |
| PUT | `/api/v1/rooms/{id}/flap` | Set flap state |
| PUT | `/api/v1/rooms/{id}/light` | Toggle light |
| PUT | `/api/v1/rooms/{id}/flags` | Lock / auto-start / window-detection |

### System
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/system` | System state |
| PUT | `/api/v1/system/operating_mode` | Set global mode |
| PUT | `/api/v1/system/energy_level` | Set energy level |

### Programs
| Method | Path | Purpose |
|---|---|---|
| GET / PUT | `/api/v1/programs/daily[/{n}]` | Daily programs (read / replace) |
| GET / PUT | `/api/v1/programs/weekly[/{n}]` | Weekly programs (read / replace) |

### Scenes & layout
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/v1/scenes` | List / create scenes |
| PUT / DELETE | `/api/v1/scenes/{id}` | Replace / delete scene |
| POST | `/api/v1/scenes/{id}/apply` | Apply scene across rooms |
| GET / PUT | `/api/v1/floors` | Floor-to-room map |

### Installer
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/installer/io` | Master + U-module I/O snapshot |
| GET | `/api/v1/installer/curve` | Heat curve |
| GET / PUT | `/api/v1/installer/calibration` | Calibration offsets (read / write) |
| GET / PUT | `/api/v1/installer/settings/{group}` | Installer settings groups |
| GET | `/api/v1/installer/diagnostics/topology` | Bus topology |
| GET | `/api/v1/installer/diagnostics/uptime` | Controller uptime |

### Messages
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/messages` | List alarms |
| POST | `/api/v1/messages/clear` | Acknowledge all |

### Auth & users
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login` | Username / password login |
| POST | `/api/v1/auth/token` | OAuth2 password / refresh_token grant |
| POST | `/api/v1/auth/refresh` | Exchange refresh token for new session |
| POST | `/api/v1/auth/revoke-all` | Sign out all sessions (admin) |
| GET | `/api/v1/auth/me` | Current identity |
| GET / POST | `/api/v1/users` | List / create accounts |
| PUT / DELETE | `/api/v1/users/{name}` | Update / delete account |

### Diagnostics (SPA + network)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/system/status` | SPA boot-gate state (public) |
| GET | `/api/v1/spa-config` | UI flags (public) |
| GET | `/api/v1/diagnostics/fetches` | Scraper telemetry |
| GET | `/api/v1/diagnostics/fingerprint` | Installation fingerprint |
| GET | `/api/netifs` · `/api/route` | lwIP interfaces / routing table |
| GET | `/api/ping` · `/api/traceroute` | ICMP / UDP probes from the board |

### Device management
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | Board + Wi-Fi/ETH/MQTT health (public) |
| GET | `/api/logs` · POST `/api/logs/clear` | In-RAM log ring |
| POST | `/api/mqtt` · `/api/mqtt/republish` | Broker creds / re-emit discovery |
| POST | `/api/wifi` · `/api/lan` · `/api/wg` | Wi-Fi / LAN / WireGuard config |
| POST | `/api/proxy` · `/api/proxy2` | Transparent TCP proxies |
| GET / POST | `/api/cfg/export` · `/api/cfg/import` | Config backup / restore |
| POST | `/api/ota` · `/api/spa` | Firmware / SPA image update |
| POST | `/api/reboot` · `/api/factory_reset` | Reboot / wipe |

Full machine-readable contract: **`GET /openapi.json`** on any running board.

---

## Capacity & specs

| | |
|---|---|
| **Board** | Olimex ESP32-POE (ESP32 dual-core, 4 MB flash, PoE + Wi-Fi) |
| **Partition layout** | Dual-OTA, 1.5 MB app slots, 960 KB SPA SPIFFS — indefinite OTA |
| **Footprint** | ~1.4 MB app image; free heap is tight on the base ESP32 — long-run stability under validation, PSRAM (WROVER) board on the table |
| **Front doors** | REST API · MQTT · resident SPA · admin GUI (all concurrent) |
| **API** | OpenAPI 3.0, 69 endpoints, 12 groups |
| **SPA** | Mobile-first PWA, 15 UI languages, dark theme, installable |
| **Auth** | JWT bearer, 2-tier accounts (user/admin), boot-bound tokens |
| **Networking** | PoE Ethernet + Wi-Fi, static/DHCP, transparent TCP proxy, WireGuard client |
| **Updates** | OTA for firmware *and* SPA, config export/import, in-RAM log ring |
| **Privacy** | 100% local. No cloud, no account, no telemetry. |

---

## Install

Requires an **Olimex ESP32-POE** (the only supported board). Grab the
[latest release](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/latest)
([`bridge-fw-v0.13.0`](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases/tag/bridge-fw-v0.13.0)).

```bash
pip install esptool

# first install (USB cable, one time)
esptool --chip esp32 -p COM5 -b 460800 erase_flash
esptool --chip esp32 -p COM5 -b 460800 write_flash 0x0 betterehau-bridge-<version>-full.bin
```

Then open `http://<board-ip>:81/`, create your `admin` account, point it at your REHAU
base and your MQTT broker, and you're running. Every future update is a one-click OTA
of `…-ota.bin` from the admin GUI — no more cable.

---

## Coming soon: BetteRehau Cloud ☁️

Local-first will *always* be the default — your board never needs us to function. But for
the times you're away from home, we're building an **optional** cloud relay + companion
**mobile app** so you can reach your heating from anywhere without fiddling with VPNs or
port-forwarding.

- **Around ~$1/month.** Cheap on purpose. A popular, no-nonsense subscription — not the
  bloated, sluggish, account-walled experience you're used to.
- **Opt-in and revocable.** Your bridge keeps working 100% locally with the cloud off.
  Nothing is forced, nothing phones home unless *you* switch it on.
- **Native mobile apps** wrapping the same SPA you already run on-device — push
  notifications, multi-home, fast.

Built by people who actually live with this system, priced like we want you to use it —
the opposite of what you're escaping.

> Want in on the beta? Watch this repo and open an issue — early testers get first access.

---

## Roadmap

This firmware is the **kernel**, not the finish line. The destination is a complete,
open replacement for the entire REHAU software experience:

- [x] Full local read/write of rooms, system, programs, fancoils
- [x] MQTT + Home Assistant Discovery, no add-on
- [x] Resident PWA served from the device
- [x] Documented REST API + OpenAPI
- [ ] Richer scene & automation engine on-device
- [ ] Multi-installation / multi-base orchestration
- [ ] First-class mobile app shells (iOS / Android)
- [ ] Zero-touch onboarding

Issues, ideas and "REHAU won't fix this, can you?" requests are welcome.

---

<sub><b>Independent project.</b> BetteRehau is an unofficial, community-built integration.
It is not affiliated with, endorsed by, or supported by REHAU. "REHAU" and "Nea Smart"
are trademarks of their respective owner, used here only to describe compatibility.
Use on your own equipment, at your own risk.</sub>
