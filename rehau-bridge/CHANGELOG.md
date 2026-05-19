# Changelog — REHAU Nea Smart 2 Bridge (local)

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
