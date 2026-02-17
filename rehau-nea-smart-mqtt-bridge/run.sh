#!/bin/sh

echo "[DEBUG] ==== REHAU NEA MQTT Bridge entrypoint starting ===="
echo "[DEBUG] Shell: $(ps -p $$ -o comm= 2>/dev/null || echo 'unknown')"
echo "[DEBUG] UID: $(id 2>/dev/null || echo 'id not available')"
echo "[DEBUG] PWD at start: $(pwd)"

OPTIONS_FILE="/data/options.json"
echo "[DEBUG] OPTIONS_FILE set to: $OPTIONS_FILE"

if [ -f "$OPTIONS_FILE" ]; then
  echo "[DEBUG] Detected $OPTIONS_FILE - assuming HA add-on / container with JSON config"

  echo "[DEBUG] Checking for jq..."
  if command -v jq >/dev/null 2>&1; then
    echo "[DEBUG] jq found at: $(command -v jq)"
  else
    echo "[ERROR] /data/options.json exists but 'jq' is NOT installed or not in PATH."
    echo "[ERROR] PATH is: $PATH"
    echo "[ERROR] Install jq in the image or remove /data/options.json and use env vars instead."
    exit 1
  fi

  echo "[DEBUG] Reading configuration from JSON..."

  # REHAU_EMAIL
  echo "[DEBUG] Reading 'rehau_email'..."
  REHAU_EMAIL="$(jq -r '.rehau_email // empty' "$OPTIONS_FILE" 2>/tmp/jq_rehau_email.err || echo "")"
  JQ_STATUS_REHAU_EMAIL=$?
  echo "[DEBUG] jq status for rehau_email: $JQ_STATUS_REHAU_EMAIL"
  if [ -s /tmp/jq_rehau_email.err ]; then
    echo "[DEBUG] jq stderr for rehau_email:"
    cat /tmp/jq_rehau_email.err
  fi
  echo "[DEBUG] REHAU_EMAIL length: ${#REHAU_EMAIL}"

  # REHAU_PASSWORD
  echo "[DEBUG] Reading 'rehau_password'..."
  REHAU_PASSWORD="$(jq -r '.rehau_password // empty' "$OPTIONS_FILE" 2>/tmp/jq_rehau_password.err || echo "")"
  JQ_STATUS_REHAU_PASSWORD=$?
  echo "[DEBUG] jq status for rehau_password: $JQ_STATUS_REHAU_PASSWORD"
  if [ -s /tmp/jq_rehau_password.err ]; then
    echo "[DEBUG] jq stderr for rehau_password:"
    cat /tmp/jq_rehau_password.err
  fi
  echo "[DEBUG] REHAU_PASSWORD length: ${#REHAU_PASSWORD} (not printing actual value for safety)"

  # POP3_EMAIL
  echo "[DEBUG] Reading 'pop3_email'..."
  POP3_EMAIL="$(jq -r '.pop3_email // empty' "$OPTIONS_FILE" 2>/tmp/jq_pop3_email.err || echo "")"
  echo "[DEBUG] POP3_EMAIL='$POP3_EMAIL'"

  # POP3_PASSWORD
  echo "[DEBUG] Reading 'pop3_password'..."
  POP3_PASSWORD="$(jq -r '.pop3_password // empty' "$OPTIONS_FILE" 2>/tmp/jq_pop3_password.err || echo "")"
  echo "[DEBUG] POP3_PASSWORD length: ${#POP3_PASSWORD} (not printing actual value for safety)"

  # POP3_HOST
  echo "[DEBUG] Reading 'pop3_host'..."
  POP3_HOST="$(jq -r '.pop3_host // empty' "$OPTIONS_FILE" 2>/tmp/jq_pop3_host.err || echo "")"
  echo "[DEBUG] POP3_HOST='$POP3_HOST'"

  # MQTT_HOST
  echo "[DEBUG] Reading 'mqtt_host'..."
  MQTT_HOST="$(jq -r '.mqtt_host // empty' "$OPTIONS_FILE" 2>/tmp/jq_mqtt_host.err || echo "")"
  JQ_STATUS_MQTT_HOST=$?
  echo "[DEBUG] jq status for mqtt_host: $JQ_STATUS_MQTT_HOST"
  if [ -s /tmp/jq_mqtt_host.err ]; then
    echo "[DEBUG] jq stderr for mqtt_host:"
    cat /tmp/jq_mqtt_host.err
  fi
  echo "[DEBUG] MQTT_HOST='$MQTT_HOST'"

  # Optional values with defaults from JSON
  echo "[DEBUG] Reading optional values with defaults..."

  MQTT_PORT="$(jq -r '.mqtt_port // 1883' "$OPTIONS_FILE" 2>/tmp/jq_mqtt_port.err || echo "1883")"
  echo "[DEBUG] MQTT_PORT(from JSON or default)= '$MQTT_PORT'"

  MQTT_USER="$(jq -r '.mqtt_user // empty' "$OPTIONS_FILE" 2>/tmp/jq_mqtt_user.err || echo "")"
  echo "[DEBUG] MQTT_USER='$MQTT_USER'"

  MQTT_PASSWORD="$(jq -r '.mqtt_password // empty' "$OPTIONS_FILE" 2>/tmp/jq_mqtt_password.err || echo "")"
  echo "[DEBUG] MQTT_PASSWORD length: ${#MQTT_PASSWORD} (not printing actual value)"

  API_PORT="$(jq -r '.api_port // 3000' "$OPTIONS_FILE" 2>/tmp/jq_api_port.err || echo "3000")"
  echo "[DEBUG] API_PORT='$API_PORT'"

  LOG_LEVEL="$(jq -r '.log_level // "info"' "$OPTIONS_FILE" 2>/tmp/jq_log_level.err || echo "info")"
  echo "[DEBUG] LOG_LEVEL='$LOG_LEVEL'"

  ZONE_RELOAD_INTERVAL="$(jq -r '.zone_reload_interval // 300' "$OPTIONS_FILE" 2>/tmp/jq_zone_reload.err || echo "300")"
  echo "[DEBUG] ZONE_RELOAD_INTERVAL='$ZONE_RELOAD_INTERVAL'"

  TOKEN_REFRESH_INTERVAL="$(jq -r '.token_refresh_interval // 21600' "$OPTIONS_FILE" 2>/tmp/jq_token_refresh.err || echo "21600")"
  echo "[DEBUG] TOKEN_REFRESH_INTERVAL='$TOKEN_REFRESH_INTERVAL'"

  REFERENTIALS_RELOAD_INTERVAL="$(jq -r '.referentials_reload_interval // 86400' "$OPTIONS_FILE" 2>/tmp/jq_ref_reload.err || echo "86400")"
  echo "[DEBUG] REFERENTIALS_RELOAD_INTERVAL='$REFERENTIALS_RELOAD_INTERVAL'"

  USE_GROUP_IN_NAMES="$(jq -r '.use_group_in_names // false' "$OPTIONS_FILE" 2>/tmp/jq_use_group.err || echo "false")"
  echo "[DEBUG] USE_GROUP_IN_NAMES='$USE_GROUP_IN_NAMES'"

  # POP3 optional settings with defaults
  POP3_PORT="$(jq -r '.pop3_port // 995' "$OPTIONS_FILE" 2>/tmp/jq_pop3_port.err || echo "995")"
  echo "[DEBUG] POP3_PORT='$POP3_PORT'"

  POP3_SECURE="$(jq -r '.pop3_secure // true' "$OPTIONS_FILE" 2>/tmp/jq_pop3_secure.err || echo "true")"
  echo "[DEBUG] POP3_SECURE='$POP3_SECURE'"

  POP3_TIMEOUT="$(jq -r '.pop3_timeout // 300000' "$OPTIONS_FILE" 2>/tmp/jq_pop3_timeout.err || echo "300000")"
  echo "[DEBUG] POP3_TIMEOUT='$POP3_TIMEOUT'"

  POP3_DEBUG="$(jq -r '.pop3_debug // false' "$OPTIONS_FILE" 2>/tmp/jq_pop3_debug.err || echo "false")"
  echo "[DEBUG] POP3_DEBUG='$POP3_DEBUG'"

  echo "[DEBUG] Exporting variables from JSON..."
  export \
    REHAU_EMAIL \
    REHAU_PASSWORD \
    POP3_EMAIL \
    POP3_PASSWORD \
    POP3_HOST \
    POP3_PORT \
    POP3_SECURE \
    POP3_TIMEOUT \
    POP3_DEBUG \
    MQTT_HOST \
    MQTT_PORT \
    MQTT_USER \
    MQTT_PASSWORD \
    API_PORT \
    LOG_LEVEL \
    ZONE_RELOAD_INTERVAL \
    TOKEN_REFRESH_INTERVAL \
    REFERENTIALS_RELOAD_INTERVAL \
    USE_GROUP_IN_NAMES

  echo "[DEBUG] Configuration exported from options.json"

else
  echo "[DEBUG] $OPTIONS_FILE does NOT exist."
  echo "[DEBUG] Running in standalone / HA Core / plain Linux mode (using environment variables only)..."
fi

echo "[DEBUG] Current environment snapshot (redacted secrets):"
echo "  REHAU_EMAIL='${REHAU_EMAIL:-<unset>}'"
echo "  REHAU_PASSWORD length='${REHAU_PASSWORD:+${#REHAU_PASSWORD}}'"
echo "  POP3_EMAIL='${POP3_EMAIL:-<unset>}'"
echo "  POP3_PASSWORD length='${POP3_PASSWORD:+${#POP3_PASSWORD}}'"
echo "  POP3_HOST='${POP3_HOST:-<unset>}'"
echo "  POP3_PORT='${POP3_PORT:-<unset>}'"
echo "  POP3_SECURE='${POP3_SECURE:-<unset>}'"
echo "  POP3_TIMEOUT='${POP3_TIMEOUT:-<unset>}'"
echo "  POP3_DEBUG='${POP3_DEBUG:-<unset>}'"
echo "  MQTT_HOST='${MQTT_HOST:-<unset>}'"
echo "  MQTT_PORT='${MQTT_PORT:-<unset>}'"
echo "  MQTT_USER='${MQTT_USER:-<unset>}'"
echo "  MQTT_PASSWORD length='${MQTT_PASSWORD:+${#MQTT_PASSWORD}}'"
echo "  API_PORT='${API_PORT:-<unset>}'"
echo "  LOG_LEVEL='${LOG_LEVEL:-<unset>}'"
echo "  ZONE_RELOAD_INTERVAL='${ZONE_RELOAD_INTERVAL:-<unset>}'"
echo "  TOKEN_REFRESH_INTERVAL='${TOKEN_REFRESH_INTERVAL:-<unset>}'"
echo "  REFERENTIALS_RELOAD_INTERVAL='${REFERENTIALS_RELOAD_INTERVAL:-<unset>}'"
echo "  USE_GROUP_IN_NAMES='${USE_GROUP_IN_NAMES:-<unset>}'"

# ---- Validation of required variables ----
echo "[DEBUG] Validating required environment variables..."

if [ -z "$REHAU_EMAIL" ]; then
  echo "[ERROR] REHAU_EMAIL environment variable is required"
  echo "[ERROR] For Home Assistant addon: ensure 'rehau_email' is set in addon configuration"
  echo "[ERROR] For standalone / HA Core / plain Linux: ensure REHAU_EMAIL environment variable is set"
  exit 1
fi

if [ -z "$REHAU_PASSWORD" ]; then
  echo "[ERROR] REHAU_PASSWORD environment variable is required"
  echo "[ERROR] For Home Assistant addon: ensure 'rehau_password' is set in addon configuration"
  echo "[ERROR] For standalone / HA Core / plain Linux: ensure REHAU_PASSWORD environment variable is set"
  exit 1
fi

if [ -z "$MQTT_HOST" ]; then
echo "[ERROR] MQTT_HOST environment variable is required"
  echo "[ERROR] For Home Assistant addon: ensure 'mqtt_host' is set in addon configuration"
  echo "[ERROR] For standalone / HA Core / plain Linux: ensure MQTT_HOST environment variable is set"
  exit 1
fi

echo "[DEBUG] Required variables are present."

# ---- Defaults for optional values if still not set ----
echo "[DEBUG] Applying defaults for optional variables if needed..."

: "${MQTT_PORT:=1883}"
: "${API_PORT:=3000}"
: "${LOG_LEVEL:=info}"
: "${ZONE_RELOAD_INTERVAL:=300}"
: "${TOKEN_REFRESH_INTERVAL:=21600}"
: "${REFERENTIALS_RELOAD_INTERVAL:=86400}"
: "${USE_GROUP_IN_NAMES:=false}"

echo "[DEBUG] After defaults:"
echo "  MQTT_PORT='$MQTT_PORT'"
echo "  API_PORT='$API_PORT'"
echo "  LOG_LEVEL='$LOG_LEVEL'"
echo "  ZONE_RELOAD_INTERVAL='$ZONE_RELOAD_INTERVAL'"
echo "  TOKEN_REFRESH_INTERVAL='$TOKEN_REFRESH_INTERVAL'"
echo "  REFERENTIALS_RELOAD_INTERVAL='$REFERENTIALS_RELOAD_INTERVAL'"
echo "  USE_GROUP_IN_NAMES='$USE_GROUP_IN_NAMES'"

export \
  MQTT_PORT \
  API_PORT \
  LOG_LEVEL \
  ZONE_RELOAD_INTERVAL \
  TOKEN_REFRESH_INTERVAL \
  REFERENTIALS_RELOAD_INTERVAL \
  USE_GROUP_IN_NAMES

# ---- Check runtime environment (node, /app, dist/index.js) ----
echo "[DEBUG] Checking for node in PATH..."
if command -v node >/dev/null 2>&1; then
  echo "[DEBUG] node found at: $(command -v node)"
else
  echo "[ERROR] 'node' binary not found in PATH: $PATH"
  exit 1
fi

echo "[DEBUG] Verifying /app directory..."
if [ -d "/app" ]; then
  echo "[DEBUG] /app exists."
else
  echo "[ERROR] /app directory does NOT exist. Current PWD: $(pwd)"
  echo "[DEBUG] Listing root directory:"
  ls -al /
  exit 1
fi

echo "[DEBUG] Changing directory to /app..."
cd /app || {
  echo "[ERROR] Failed to cd /app"
  exit 1
}

echo "[DEBUG] PWD after cd: $(pwd)"

echo "[DEBUG] Checking for dist/index.js..."
if [ -f "dist/index.js" ]; then
  echo "[DEBUG] Found dist/index.js"
else
  echo "[ERROR] dist/index.js not found in /app."
  echo "[DEBUG] Listing /app contents:"
  ls -al
  if [ -d "dist" ]; then    
    echo "[DEBUG] Listing /app/dist contents:"
    ls -al dist
  fi
  exit 1
fi

# ---- Final summary before exec ----
echo "[INFO] Starting REHAU NEA SMART 2.0 MQTT Bridge (TypeScript)..."
echo "[INFO] MQTT Host: ${MQTT_HOST}:${MQTT_PORT}"
echo "[INFO] API Port: ${API_PORT}"
echo "[INFO] Zone Reload Interval: ${ZONE_RELOAD_INTERVAL}s"
echo "[INFO] Token Refresh Interval: ${TOKEN_REFRESH_INTERVAL}s"
echo "[INFO] Referentials Reload Interval: ${REFERENTIALS_RELOAD_INTERVAL}s"
echo "[INFO] Use Group in Names: ${USE_GROUP_IN_NAMES}"

echo "[DEBUG] Executing: node dist/index.js"
exec node dist/index.js
echo "[DEBUG] If you see this line, exec failed for some reason."
