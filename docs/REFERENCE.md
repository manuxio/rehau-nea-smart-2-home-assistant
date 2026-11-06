# Add-on reference

Technical details for the **REHAU Nea Smart 2 Bridge (local)** Home Assistant
add-on. For a gentle introduction start from the [main README](../README.md);
for a step-by-step setup see [INSTALL.md](../INSTALL.md).

- [Configuration options](#configuration-options)
- [Authentication & HA ingress](#authentication--ha-ingress)
- [What appears in Home Assistant](#what-appears-in-home-assistant)
- [MQTT topics](#mqtt-topics)
- [REST API](#rest-api)
- [How it works](#how-it-works)
- [Common issues](#common-issues)

---

## Configuration options

All options live in the add-on's **Configuration** tab. Defaults shown.

| Option | Default | What it does |
| --- | --- | --- |
| `device_url` | `http://10.0.0.1` | Address of the REHAU base station |
| `device_installer_code` | *(empty)* | The 8-character installer code (required) |
| `installation_name` | `Casa` | Name of the HA device, also used in the MQTT topic path |
| `device_request_timeout_ms` | `22000` | Timeout of a single request to the base station |
| `device_min_gap_ms` | `150` | Pause between two requests. Raise to 250–400 if you see `ConnectTimeout` |
| `api_user` / `api_password_hash` | `admin` / hash of `admin123` | Web app login. **Change the password** (see below) |
| `jwt_secret` / `jwt_ttl` | auto / `30d` | Login token secret and lifetime. An empty secret is generated once and kept |
| `admin_role` | `installer` | `user` or `installer` (the installer role unlocks the Installer tab) |
| `mqtt_url` / `mqtt_username` / `mqtt_password` | *(empty)* | Leave empty to use the Mosquitto add-on automatically |
| `mqtt_base_topic` | `rehau` | Root of the MQTT topics |
| `mqtt_ha_discovery` | `true` | Create the entities in HA automatically |
| `mqtt_ha_discovery_prefix` | `homeassistant` | Change only if your HA uses a different discovery prefix |
| `poll_dashboard_s` / `poll_rooms_s` / `poll_room_detail_s` / `poll_messages_s` / `poll_io_s` | 30 / 15 / 60 / 300 / 10 | How often each part is refreshed, in seconds |
| `expose_io` | `true` | Publish the raw I/O channels as diagnostic entities |
| `expose_calibration` | `true` | Publish the calibration offsets as diagnostic entities |
| `room_floors` | *(empty)* | Initial room → floor mapping, e.g. `0:First floor,1:First floor,2:Ground floor` (you can also edit floors in the web app) |
| `log_level` / `log_format` | `info` / `json` | `fatal` … `trace`; `json` or `pretty` |

**Changing the password.** Generate a bcrypt hash and paste it into
`api_password_hash`: `npm run hashpw -- <your-password>` from a checkout of this
repository, or any bcrypt tool (cost 10–12).

---

## Authentication & HA ingress

The web app and the REST API (`/api/v1/*`) need a login token (JWT). There are
two ways to get one:

- **Password login**: `POST /api/v1/auth/login` with `api_user` and your
  password. This is what you use on `http://<ha-host>:8080/`, in the installed
  PWA and from scripts.
- **HA ingress auto-login**: `POST /api/v1/auth/ingress`, called by the web app
  when you open it from the HA sidebar. No password is asked, because Home
  Assistant has already logged you in.

The auto-login is accepted **only** when both are true:

1. the request carries the `X-Ingress-Path` header that HA's ingress proxy adds,
   **and**
2. the TCP connection really comes from the HA Supervisor's ingress proxy,
   `172.30.32.2` (its fixed address on the Supervisor's internal network).

The bridge checks the real socket address, not `X-Forwarded-For`, so this can't
be faked with headers. Everything else (a browser or a script on your LAN
talking to port 8080 directly, with or without a forged `X-Ingress-Path`) gets
`401` and must log in with the password.

> **Security note (fixed in 6.1.4).** Up to 6.1.3, `/api/v1/auth/ingress`
> trusted the `X-Ingress-Path` header alone, so any device that could reach
> port 8080 could get an admin (installer) token without the password. If port
> 8080 was reachable by devices you don't trust, update and also rotate the
> token secret: set a new `jwt_secret`, or delete `/data/jwt_secret` and restart
> the add-on.

**Outside Home Assistant** (plain Docker / `docker compose`) there is no ingress
proxy, so the auto-login never triggers and the web app shows the login form.
If you put the bridge behind your own trusted reverse proxy that sets
`X-Ingress-Path`, list that proxy's IP(s) in the `INGRESS_PROXY_IPS`
environment variable (comma-separated; empty disables the auto-login). Inside
the HA add-on you don't need to set anything.

---

## What appears in Home Assistant

One device per installation, created through MQTT discovery:

- a **climate** entity per room, with REHAU's own modes (normal, reduced,
  program, party, standby, …) available as presets;
- **temperature** and **humidity** sensors per room, plus a **remote
  temperature** sensor for room units that have a floor / remote probe;
- **switches** per room: display lock, auto-start, open-window detection, and
  the light where present;
- **selects** for the system operating mode and energy level;
- **outdoor temperature** and **alarms** sensors;
- diagnostic entities for fancoils (running, speed, flap), I/O channels of the
  Master base and U-modules (`expose_io`) and calibration offsets
  (`expose_calibration`). Slave bases are currently supported by the
  [firmware](../FIRMWARE.md) only.

Entity names are currently in Italian; see
[issue #68](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues/68).

---

## MQTT topics

```text
<base>/<installation-slug>/<device-id>/
├── availability                 "online" | "offline" (last will)
├── system/state                 JSON
├── system/operating_mode/set    command
├── system/energy_level/set      command
├── messages                     JSON array
├── alarms/active                "true" | "false"
├── alarms/count                 integer
├── io                           JSON snapshot
└── rooms/<room-id>/
    ├── state                    full room JSON
    ├── setpoint/set             °C, e.g. 21.5
    ├── mode/set                 standby | normal | reduced | program
    ├── light/set                "true" | "false"
    ├── lock/set                 "true" | "false"
    ├── auto_start/set           "true" | "false"
    └── window_detection/set     "true" | "false"
```

Example: `rehau/casa/27165454/rooms/r-salone/state`. The installation slug in
the path lets several installations share the same broker.

---

## REST API

Everything the web app does goes through a documented REST API under
`/api/v1/`, plus a Server-Sent Events stream at `/api/v1/events`. The
interactive documentation (Swagger UI) is at `http://<ha-host>:8080/docs`.

---

## How it works

```text
 REHAU base station  ◄── local HTTP ──►  bridge (Node.js)  ── MQTT ──►  Mosquitto ──► Home Assistant
                                              │
                                              ├── web app ──► HA sidebar (ingress) or :8080 / PWA
                                              └── REST API + Swagger ──► :8080
```

1. A poller reads the base station's own web pages on a schedule (see the
   `poll_*` options) and keeps a live copy of the state.
2. Every change is published to MQTT (retained), together with the discovery
   messages that make HA build the device.
3. Commands from HA, the web app or the API are written back to the base
   station and confirmed by the next read. The web app updates immediately and
   rolls back if REHAU refuses the change.

The base station's web server is small and fragile: the bridge closes every
connection and leaves a short gap between requests (`device_min_gap_ms`).

---

## Common issues

**The add-on starts but shows no rooms.** The base station can't be reached.
Check `device_url` and that the HA host can reach it; the log shows the exact
URL that failed.

**`ConnectTimeout` in the log.** The base station is being asked too much too
fast. Raise `device_min_gap_ms` to 250 or 400.

**No entities in Home Assistant.** Make sure the **Mosquitto broker** add-on is
installed and running (or set `mqtt_url` for an external broker), and that
`mqtt_ha_discovery` is on. The log shows `mqtt connected` and
`ha discovery published`.

**Every action in the web app fails with 401.** Your login expired (default
30 days, see `jwt_ttl`). Log in again.

**A room with a fancoil shows no fancoil.** The bridge shows what the base
station shows. Check the room's fancoil setting (`FanH`) on the REHAU installer
page: it must match the current system mode (heating, cooling or both).

**The update isn't offered on a 32-bit system.** Since 6.2.0 the add-on is built
for `amd64` and `aarch64` only (Home Assistant has deprecated 32-bit systems).
32-bit `armv7` hosts can stay on 6.1.4.
