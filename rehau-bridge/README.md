# REHAU Nea Smart 2 Bridge (local)

Local HTTP/MQTT bridge for the REHAU Nea Smart 2.0 base station. Talks
directly to the device on the LAN — no cloud, no e-mail, no 2FA.

## What it does

- Polls the device's installer web UI on a tight schedule and exposes:
  - REST + Server-Sent Events under `/api/v1/`
  - Bundled web SPA at `/`
  - MQTT discovery for HA (climate, sensors, switches, binary_sensors)
- Publishes per-room and per-system state on retained MQTT topics:
  `<base>/<installation-slug>/<device-id>/…`
- Honours HA's MQTT service announcement (Mosquitto add-on) automatically.

## Quick start

1. Install this add-on (from the **Local add-ons** section, or via a custom
   repository).
2. Open **Configuration** and set at minimum:
   - `device_url` — e.g. `http://10.0.0.50`
   - `device_installer_code` — the 8-character code from the device's unique
     code (REHAU installer password).
3. Start the add-on. Within ~60 s the first poll completes and HA discovers
   one `climate.<installation>_<room>` entity per zone, plus diagnostic
   sensors for I/O and (optionally) calibration offsets.
4. Open the side-bar entry to use the bundled web UI for direct setpoint
   and program editing.

## Notes

- Setting `api_password_hash` to a custom bcrypt is recommended before
  exposing the addon outside HA ingress.
- `jwt_secret` is auto-generated and persisted in `/data/jwt_secret` if you
  leave the option empty.
- The bridge does its own debounce/cool-down to avoid hammering REHAU's
  small TCP socket table — increasing `device_min_gap_ms` to 250-400 ms is
  safe if you observe `ConnectTimeout` errors.
