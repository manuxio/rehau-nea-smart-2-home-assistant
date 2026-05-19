# Changelog — REHAU Nea Smart 2 Bridge (local)

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
