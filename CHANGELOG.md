# Changelog

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
