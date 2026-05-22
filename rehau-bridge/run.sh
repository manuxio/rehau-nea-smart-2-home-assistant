#!/usr/bin/env bash
# Startup wrapper for the REHAU Nea Smart 2 bridge HA add-on.
#
# Reads /data/options.json (HA writes this from the add-on's "Configuration"
# tab) and turns each option into an env var the Node bridge already
# understands. If the user left mqtt_url empty AND the HA "mqtt" service is
# available (Mosquitto add-on installed), we synthesize the URL from the
# bashio service helpers.

set -euo pipefail

# bashio gives typed helpers for /data/options.json and HA service discovery.
# It's available in every official addon base image.
# shellcheck source=/dev/null
source /usr/lib/bashio/bashio.sh

bashio::log.info "REHAU bridge addon starting…"

# ── map options → env ───────────────────────────────────────────────
opt() { bashio::config "$1" "${2:-}"; }

export DEVICE_URL="$(opt device_url)"
export DEVICE_MODE="live"
export DEVICE_INSTALLER_CODE="$(opt device_installer_code)"
export INSTALLATION_NAME="$(opt installation_name)"
export DEVICE_REQUEST_TIMEOUT_MS="$(opt device_request_timeout_ms)"
export DEVICE_MIN_GAP_MS="$(opt device_min_gap_ms)"
export INSTALLER_MAX_SESSION_S=30

export HTTP_PORT=8080
export HTTP_CORS_ORIGINS=""
export API_USER="$(opt api_user)"
export API_PASSWORD_HASH="$(opt api_password_hash)"
export ADMIN_ROLE="$(opt admin_role)"
export JWT_TTL="$(opt jwt_ttl)"

# Generate a random JWT secret if the user left it blank — addons get a fresh
# /data on every clean install, so persisting it across restarts is good.
JWT_SECRET_RAW="$(opt jwt_secret)"
if [ -z "${JWT_SECRET_RAW}" ]; then
  if [ ! -f /data/jwt_secret ]; then
    head -c 48 /dev/urandom | base64 | tr -d '\n' > /data/jwt_secret
    bashio::log.info "Generated a random JWT secret (stored in /data/jwt_secret)."
  fi
  JWT_SECRET_RAW="$(cat /data/jwt_secret)"
fi
export JWT_SECRET="${JWT_SECRET_RAW}"

# MQTT — prefer explicit overrides, otherwise fall back to the HA "mqtt"
# service announced by the Mosquitto add-on.
MQTT_URL_OPT="$(opt mqtt_url)"
MQTT_USERNAME_OPT="$(opt mqtt_username)"
MQTT_PASSWORD_OPT="$(opt mqtt_password)"

if [ -n "${MQTT_URL_OPT}" ]; then
  export MQTT_URL="${MQTT_URL_OPT}"
  export MQTT_USERNAME="${MQTT_USERNAME_OPT}"
  export MQTT_PASSWORD="${MQTT_PASSWORD_OPT}"
  bashio::log.info "Using explicit MQTT broker: ${MQTT_URL}"
elif bashio::services.available "mqtt"; then
  MQTT_HOST="$(bashio::services mqtt 'host')"
  MQTT_PORT="$(bashio::services mqtt 'port')"
  export MQTT_URL="mqtt://${MQTT_HOST}:${MQTT_PORT}"
  export MQTT_USERNAME="$(bashio::services mqtt 'username')"
  export MQTT_PASSWORD="$(bashio::services mqtt 'password')"
  bashio::log.info "Using HA-provided MQTT broker: ${MQTT_URL}"
else
  bashio::log.warning "No MQTT broker configured — running REST-only."
  export MQTT_URL=""
  export MQTT_USERNAME=""
  export MQTT_PASSWORD=""
fi

export MQTT_BASE_TOPIC="$(opt mqtt_base_topic)"
export MQTT_HA_DISCOVERY="$(opt mqtt_ha_discovery)"
export MQTT_HA_DISCOVERY_PREFIX="$(opt mqtt_ha_discovery_prefix)"

export POLL_DASHBOARD_S="$(opt poll_dashboard_s)"
export POLL_ROOMS_S="$(opt poll_rooms_s)"
export POLL_ROOM_DETAIL_S="$(opt poll_room_detail_s)"
export POLL_MESSAGES_S="$(opt poll_messages_s)"
export POLL_IO_S="$(opt poll_io_s)"
export EXPOSE_IO="$(opt expose_io)"
export EXPOSE_CALIBRATION="$(opt expose_calibration)"
export ROOM_FLOORS="$(opt room_floors)"

export LOG_LEVEL="$(opt log_level)"
export LOG_FORMAT="$(opt log_format)"

# Surface the addon version to the bridge so the SPA can display it on the
# System page. bashio reads it from the addon's config.yaml at install
# time so we don't have to parse the file ourselves.
export ADDON_VERSION="$(bashio::addon.version || echo "unknown")"

bashio::log.info "Starting bridge on :${HTTP_PORT} (installation '${INSTALLATION_NAME}', version ${ADDON_VERSION})."

cd /app
exec node dist/main.js
