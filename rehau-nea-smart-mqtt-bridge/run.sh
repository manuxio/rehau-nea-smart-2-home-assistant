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

  API_ENABLED="$(jq -r '.api_enabled // true' "$OPTIONS_FILE" 2>/tmp/jq_api_enabled.err || echo "true")"
  echo "[DEBUG] API_ENABLED='$API_ENABLED'"

  WEB_UI_ENABLED="$(jq -r '.web_ui_enabled // true' "$OPTIONS_FILE" 2>/tmp/jq_web_ui.err || echo "true")"
  echo "[DEBUG] WEB_UI_ENABLED='$WEB_UI_ENABLED'"

  API_USERNAME="$(jq -r '.api_username // "admin"' "$OPTIONS_FILE" 2>/tmp/jq_api_user.err || echo "admin")"
  echo "[DEBUG] API_USERNAME='$API_USERNAME'"

  API_PASSWORD="$(jq -r '.api_password // empty' "$OPTIONS_FILE" 2>/tmp/jq_api_pass.err || echo "")"
  echo "[DEBUG] API_PASSWORD length: ${#API_PASSWORD} (not printing actual value)"

  JWT_SECRET="$(jq -r '.jwt_secret // empty' "$OPTIONS_FILE" 2>/tmp/jq_jwt.err || echo "")"
  echo "[DEBUG] JWT_SECRET length: ${#JWT_SECRET} (not printing actual value)"

  LOG_LEVEL="$(jq -r '.log_level // "info"' "$OPTIONS_FILE" 2>/tmp/jq_log_level.err || echo "info")"
  echo "[DEBUG] LOG_LEVEL='$LOG_LEVEL'"

  LOG_SHOW_OK_REQUESTS="$(jq -r '.log_show_ok_requests // false' "$OPTIONS_FILE" 2>/tmp/jq_log_ok.err || echo "false")"
  echo "[DEBUG] LOG_SHOW_OK_REQUESTS='$LOG_SHOW_OK_REQUESTS'"

  ZONE_RELOAD_INTERVAL="$(jq -r '.zone_reload_interval // 300' "$OPTIONS_FILE" 2>/tmp/jq_zone_reload.err || echo "300")"
  echo "[DEBUG] ZONE_RELOAD_INTERVAL='$ZONE_RELOAD_INTERVAL'"

  TOKEN_REFRESH_INTERVAL="$(jq -r '.token_refresh_interval // 21600' "$OPTIONS_FILE" 2>/tmp/jq_token_refresh.err || echo "21600")"
  echo "[DEBUG] TOKEN_REFRESH_INTERVAL='$TOKEN_REFRESH_INTERVAL'"

  REFERENTIALS_RELOAD_INTERVAL="$(jq -r '.referentials_reload_interval // 86400' "$OPTIONS_FILE" 2>/tmp/jq_ref_reload.err || echo "86400")"
  echo "[DEBUG] REFERENTIALS_RELOAD_INTERVAL='$REFERENTIALS_RELOAD_INTERVAL'"

  USE_GROUP_IN_NAMES="$(jq -r '.use_group_in_names // false' "$OPTIONS_FILE" 2>/tmp/jq_use_group.err || echo "false")"
  echo "[DEBUG] USE_GROUP_IN_NAMES='$USE_GROUP_IN_NAMES'"

  LIVE_DATA_INTERVAL="$(jq -r '.live_data_interval // 300' "$OPTIONS_FILE" 2>/tmp/jq_live_data.err || echo "300")"
  echo "[DEBUG] LIVE_DATA_INTERVAL='$LIVE_DATA_INTERVAL'"

  COMMAND_RETRY_TIMEOUT="$(jq -r '.command_retry_timeout // 30' "$OPTIONS_FILE" 2>/tmp/jq_cmd_timeout.err || echo "30")"
  echo "[DEBUG] COMMAND_RETRY_TIMEOUT='$COMMAND_RETRY_TIMEOUT'"

  COMMAND_MAX_RETRIES="$(jq -r '.command_max_retries // 3' "$OPTIONS_FILE" 2>/tmp/jq_cmd_retries.err || echo "3")"
  echo "[DEBUG] COMMAND_MAX_RETRIES='$COMMAND_MAX_RETRIES'"

  FORCE_FRESH_LOGIN="$(jq -r '.force_fresh_login // false' "$OPTIONS_FILE" 2>/tmp/jq_force_login.err || echo "false")"
  echo "[DEBUG] FORCE_FRESH_LOGIN='$FORCE_FRESH_LOGIN'"

  FORCE_TOKEN_EXPIRED="$(jq -r '.force_token_expired // false' "$OPTIONS_FILE" 2>/tmp/jq_force_expired.err || echo "false")"
  echo "[DEBUG] FORCE_TOKEN_EXPIRED='$FORCE_TOKEN_EXPIRED'"

  SIMULATE_DISCONNECT_AFTER_SECONDS="$(jq -r '.simulate_disconnect_after_seconds // 0' "$OPTIONS_FILE" 2>/tmp/jq_sim_disconnect.err || echo "0")"
  echo "[DEBUG] SIMULATE_DISCONNECT_AFTER_SECONDS='$SIMULATE_DISCONNECT_AFTER_SECONDS'"

  PLAYWRIGHT_HEADLESS="$(jq -r '.playwright_headless // true' "$OPTIONS_FILE" 2>/tmp/jq_playwright.err || echo "true")"
  echo "[DEBUG] PLAYWRIGHT_HEADLESS='$PLAYWRIGHT_HEADLESS'"

  PLAYWRIGHT_IDLE_TIMEOUT="$(jq -r '.playwright_idle_timeout // 300000' "$OPTIONS_FILE" 2>/tmp/jq_playwright_idle.err || echo "300000")"
  echo "[DEBUG] PLAYWRIGHT_IDLE_TIMEOUT='$PLAYWRIGHT_IDLE_TIMEOUT'"

  MEMORY_WARNING_MB="$(jq -r '.memory_warning_mb // 250' "$OPTIONS_FILE" 2>/tmp/jq_memory.err || echo "250")"
  echo "[DEBUG] MEMORY_WARNING_MB='$MEMORY_WARNING_MB'"

  STALENESS_WARNING_MS="$(jq -r '.staleness_warning_ms // 600000' "$OPTIONS_FILE" 2>/tmp/jq_stale_warn.err || echo "600000")"
  echo "[DEBUG] STALENESS_WARNING_MS='$STALENESS_WARNING_MS'"

  STALENESS_STALE_MS="$(jq -r '.staleness_stale_ms // 1800000' "$OPTIONS_FILE" 2>/tmp/jq_stale.err || echo "1800000")"
  echo "[DEBUG] STALENESS_STALE_MS='$STALENESS_STALE_MS'"

  POP3_PROVIDER="$(jq -r '.pop3_provider // "basic"' "$OPTIONS_FILE" 2>/tmp/jq_pop3_provider.err || echo "basic")"
  echo "[DEBUG] POP3_PROVIDER='$POP3_PROVIDER'"

  POP3_OAUTH2_CLIENT_ID="$(jq -r '.pop3_oauth2_client_id // empty' "$OPTIONS_FILE" 2>/tmp/jq_oauth_id.err || echo "")"
  echo "[DEBUG] POP3_OAUTH2_CLIENT_ID length: ${#POP3_OAUTH2_CLIENT_ID}"

  POP3_OAUTH2_CLIENT_SECRET="$(jq -r '.pop3_oauth2_client_secret // empty' "$OPTIONS_FILE" 2>/tmp/jq_oauth_secret.err || echo "")"
  echo "[DEBUG] POP3_OAUTH2_CLIENT_SECRET length: ${#POP3_OAUTH2_CLIENT_SECRET}"

  POP3_OAUTH2_REFRESH_TOKEN="$(jq -r '.pop3_oauth2_refresh_token // empty' "$OPTIONS_FILE" 2>/tmp/jq_oauth_refresh.err || echo "")"
  echo "[DEBUG] POP3_OAUTH2_REFRESH_TOKEN length: ${#POP3_OAUTH2_REFRESH_TOKEN}"

  POP3_OAUTH2_TENANT_ID="$(jq -r '.pop3_oauth2_tenant_id // "common"' "$OPTIONS_FILE" 2>/tmp/jq_oauth_tenant.err || echo "common")"
  echo "[DEBUG] POP3_OAUTH2_TENANT_ID='$POP3_OAUTH2_TENANT_ID'"

  DISABLE_REDUNDANT_COMMANDS="$(jq -r '.disable_redundant_commands // false' "$OPTIONS_FILE" 2>/tmp/jq_redundant.err || echo "false")"
  echo "[DEBUG] DISABLE_REDUNDANT_COMMANDS='$DISABLE_REDUNDANT_COMMANDS'"

  # POP3 optional settings with defaults
  POP3_PORT="$(jq -r '.pop3_port // 995' "$OPTIONS_FILE" 2>/tmp/jq_pop3_port.err || echo "995")"
  echo "[DEBUG] POP3_PORT='$POP3_PORT'"

  POP3_SECURE="$(jq -r '.pop3_secure // true' "$OPTIONS_FILE" 2>/tmp/jq_pop3_secure.err || echo "true")"
  echo "[DEBUG] POP3_SECURE='$POP3_SECURE'"

  POP3_TIMEOUT="$(jq -r '.pop3_timeout // 300000' "$OPTIONS_FILE" 2>/tmp/jq_pop3_timeout.err || echo "300000")"
  echo "[DEBUG] POP3_TIMEOUT='$POP3_TIMEOUT'"

  POP3_DEBUG="$(jq -r '.pop3_debug // false' "$OPTIONS_FILE" 2>/tmp/jq_pop3_debug.err || echo "false")"
  echo "[DEBUG] POP3_DEBUG='$POP3_DEBUG'"

  POP3_FROM_ADDRESS="$(jq -r '.pop3_from_address // "noreply@accounts.rehau.com"' "$OPTIONS_FILE" 2>/tmp/jq_pop3_from.err || echo "noreply@accounts.rehau.com")"
  echo "[DEBUG] POP3_FROM_ADDRESS='$POP3_FROM_ADDRESS'"

  POP3_IGNORE_TLS_ERRORS="$(jq -r '.pop3_ignore_tls_errors // true' "$OPTIONS_FILE" 2>/tmp/jq_pop3_tls.err || echo "true")"
  echo "[DEBUG] POP3_IGNORE_TLS_ERRORS='$POP3_IGNORE_TLS_ERRORS'"

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
    POP3_FROM_ADDRESS \
    POP3_IGNORE_TLS_ERRORS \
    POP3_PROVIDER \
    POP3_OAUTH2_CLIENT_ID \
    POP3_OAUTH2_CLIENT_SECRET \
    POP3_OAUTH2_REFRESH_TOKEN \
    POP3_OAUTH2_TENANT_ID \
    MQTT_HOST \
    MQTT_PORT \
    MQTT_USER \
    MQTT_PASSWORD \
    API_ENABLED \
    WEB_UI_ENABLED \
    API_PORT \
    API_USERNAME \
    API_PASSWORD \
    JWT_SECRET \
    LOG_LEVEL \
    LOG_SHOW_OK_REQUESTS \
    ZONE_RELOAD_INTERVAL \
    TOKEN_REFRESH_INTERVAL \
    REFERENTIALS_RELOAD_INTERVAL \
    USE_GROUP_IN_NAMES \
    LIVE_DATA_INTERVAL \
    COMMAND_RETRY_TIMEOUT \
    COMMAND_MAX_RETRIES \
    FORCE_FRESH_LOGIN \
    FORCE_TOKEN_EXPIRED \
    SIMULATE_DISCONNECT_AFTER_SECONDS \
    PLAYWRIGHT_HEADLESS \
    PLAYWRIGHT_IDLE_TIMEOUT \
    MEMORY_WARNING_MB \
    STALENESS_WARNING_MS \
    STALENESS_STALE_MS \
    DISABLE_REDUNDANT_COMMANDS

  echo "[DEBUG] Configuration exported from options.json"

else
  echo "[DEBUG] $OPTIONS_FILE does NOT exist."
  echo "[DEBUG] Running in standalone / HA Core / plain Linux mode (using environment variables only)..."
fi

echo "[DEBUG] Current environment snapshot (redacted secrets):"
echo "  REHAU_EMAIL='${REHAU_EMAIL:-<unset>}'"
echo "  REHAU_PASSWORD length='${REHAU_PASSWORD:+${#REHAU_PASSWORD}}'"
echo "  POP3_PROVIDER='${POP3_PROVIDER:-<unset>}'"
echo "  POP3_EMAIL='${POP3_EMAIL:-<unset>}'"
echo "  POP3_PASSWORD length='${POP3_PASSWORD:+${#POP3_PASSWORD}}'"
echo "  POP3_HOST='${POP3_HOST:-<unset>}'"
echo "  POP3_PORT='${POP3_PORT:-<unset>}'"
echo "  POP3_SECURE='${POP3_SECURE:-<unset>}'"
echo "  POP3_TIMEOUT='${POP3_TIMEOUT:-<unset>}'"
echo "  POP3_DEBUG='${POP3_DEBUG:-<unset>}'"
echo "  POP3_FROM_ADDRESS='${POP3_FROM_ADDRESS:-<unset>}'"
echo "  POP3_IGNORE_TLS_ERRORS='${POP3_IGNORE_TLS_ERRORS:-<unset>}'"
echo "  POP3_OAUTH2_CLIENT_ID length='${POP3_OAUTH2_CLIENT_ID:+${#POP3_OAUTH2_CLIENT_ID}}'"
echo "  POP3_OAUTH2_CLIENT_SECRET length='${POP3_OAUTH2_CLIENT_SECRET:+${#POP3_OAUTH2_CLIENT_SECRET}}'"
echo "  POP3_OAUTH2_REFRESH_TOKEN length='${POP3_OAUTH2_REFRESH_TOKEN:+${#POP3_OAUTH2_REFRESH_TOKEN}}'"
echo "  POP3_OAUTH2_TENANT_ID='${POP3_OAUTH2_TENANT_ID:-<unset>}'"
echo "  MQTT_HOST='${MQTT_HOST:-<unset>}'"
echo "  MQTT_PORT='${MQTT_PORT:-<unset>}'"
echo "  MQTT_USER='${MQTT_USER:-<unset>}'"
echo "  MQTT_PASSWORD length='${MQTT_PASSWORD:+${#MQTT_PASSWORD}}'"
echo "  API_ENABLED='${API_ENABLED:-<unset>}'"
echo "  WEB_UI_ENABLED='${WEB_UI_ENABLED:-<unset>}'"
echo "  API_PORT='${API_PORT:-<unset>}'"
echo "  API_USERNAME='${API_USERNAME:-<unset>}'"
echo "  API_PASSWORD length='${API_PASSWORD:+${#API_PASSWORD}}'"
echo "  JWT_SECRET length='${JWT_SECRET:+${#JWT_SECRET}}'"
echo "  LOG_LEVEL='${LOG_LEVEL:-<unset>}'"
echo "  LOG_SHOW_OK_REQUESTS='${LOG_SHOW_OK_REQUESTS:-<unset>}'"
echo "  ZONE_RELOAD_INTERVAL='${ZONE_RELOAD_INTERVAL:-<unset>}'"
echo "  TOKEN_REFRESH_INTERVAL='${TOKEN_REFRESH_INTERVAL:-<unset>}'"
echo "  REFERENTIALS_RELOAD_INTERVAL='${REFERENTIALS_RELOAD_INTERVAL:-<unset>}'"
echo "  USE_GROUP_IN_NAMES='${USE_GROUP_IN_NAMES:-<unset>}'"
echo "  LIVE_DATA_INTERVAL='${LIVE_DATA_INTERVAL:-<unset>}'"
echo "  COMMAND_RETRY_TIMEOUT='${COMMAND_RETRY_TIMEOUT:-<unset>}'"
echo "  COMMAND_MAX_RETRIES='${COMMAND_MAX_RETRIES:-<unset>}'"
echo "  FORCE_FRESH_LOGIN='${FORCE_FRESH_LOGIN:-<unset>}'"
echo "  FORCE_TOKEN_EXPIRED='${FORCE_TOKEN_EXPIRED:-<unset>}'"
echo "  SIMULATE_DISCONNECT_AFTER_SECONDS='${SIMULATE_DISCONNECT_AFTER_SECONDS:-<unset>}'"
echo "  PLAYWRIGHT_HEADLESS='${PLAYWRIGHT_HEADLESS:-<unset>}'"
echo "  PLAYWRIGHT_IDLE_TIMEOUT='${PLAYWRIGHT_IDLE_TIMEOUT:-<unset>}'"
echo "  MEMORY_WARNING_MB='${MEMORY_WARNING_MB:-<unset>}'"
echo "  STALENESS_WARNING_MS='${STALENESS_WARNING_MS:-<unset>}'"
echo "  STALENESS_STALE_MS='${STALENESS_STALE_MS:-<unset>}'"
echo "  DISABLE_REDUNDANT_COMMANDS='${DISABLE_REDUNDANT_COMMANDS:-<unset>}'"

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
: "${API_ENABLED:=true}"
: "${WEB_UI_ENABLED:=true}"
: "${API_PORT:=3000}"
: "${API_USERNAME:=admin}"
: "${API_PASSWORD:=admin}"
: "${JWT_SECRET:=change-this-secret-in-production}"
: "${LOG_LEVEL:=info}"
: "${LOG_SHOW_OK_REQUESTS:=false}"
: "${ZONE_RELOAD_INTERVAL:=300}"
: "${TOKEN_REFRESH_INTERVAL:=21600}"
: "${REFERENTIALS_RELOAD_INTERVAL:=86400}"
: "${USE_GROUP_IN_NAMES:=false}"
: "${LIVE_DATA_INTERVAL:=300}"
: "${COMMAND_RETRY_TIMEOUT:=30}"
: "${COMMAND_MAX_RETRIES:=3}"
: "${FORCE_FRESH_LOGIN:=false}"
: "${FORCE_TOKEN_EXPIRED:=false}"
: "${SIMULATE_DISCONNECT_AFTER_SECONDS:=0}"
: "${PLAYWRIGHT_HEADLESS:=true}"
: "${PLAYWRIGHT_IDLE_TIMEOUT:=300000}"
: "${MEMORY_WARNING_MB:=250}"
: "${STALENESS_WARNING_MS:=600000}"
: "${STALENESS_STALE_MS:=1800000}"
: "${DISABLE_REDUNDANT_COMMANDS:=false}"
: "${POP3_PROVIDER:=basic}"
: "${POP3_PORT:=995}"
: "${POP3_SECURE:=true}"
: "${POP3_TIMEOUT:=300000}"
: "${POP3_DEBUG:=false}"
: "${POP3_FROM_ADDRESS:=noreply@accounts.rehau.com}"
: "${POP3_IGNORE_TLS_ERRORS:=true}"
: "${POP3_OAUTH2_TENANT_ID:=common}"

echo "[DEBUG] After defaults:"
echo "  MQTT_PORT='$MQTT_PORT'"
echo "  API_ENABLED='$API_ENABLED'"
echo "  WEB_UI_ENABLED='$WEB_UI_ENABLED'"
echo "  API_PORT='$API_PORT'"
echo "  API_USERNAME='$API_USERNAME'"
echo "  LOG_LEVEL='$LOG_LEVEL'"
echo "  LOG_SHOW_OK_REQUESTS='$LOG_SHOW_OK_REQUESTS'"
echo "  ZONE_RELOAD_INTERVAL='$ZONE_RELOAD_INTERVAL'"
echo "  TOKEN_REFRESH_INTERVAL='$TOKEN_REFRESH_INTERVAL'"
echo "  REFERENTIALS_RELOAD_INTERVAL='$REFERENTIALS_RELOAD_INTERVAL'"
echo "  USE_GROUP_IN_NAMES='$USE_GROUP_IN_NAMES'"
echo "  PLAYWRIGHT_HEADLESS='$PLAYWRIGHT_HEADLESS'"
echo "  PLAYWRIGHT_IDLE_TIMEOUT='$PLAYWRIGHT_IDLE_TIMEOUT'"
echo "  POP3_PROVIDER='$POP3_PROVIDER'"

export \
  MQTT_PORT \
  API_ENABLED \
  WEB_UI_ENABLED \
  API_PORT \
  API_USERNAME \
  API_PASSWORD \
  JWT_SECRET \
  LOG_LEVEL \
  LOG_SHOW_OK_REQUESTS \
  ZONE_RELOAD_INTERVAL \
  TOKEN_REFRESH_INTERVAL \
  REFERENTIALS_RELOAD_INTERVAL \
  USE_GROUP_IN_NAMES \
  LIVE_DATA_INTERVAL \
  COMMAND_RETRY_TIMEOUT \
  COMMAND_MAX_RETRIES \
  FORCE_FRESH_LOGIN \
  FORCE_TOKEN_EXPIRED \
  SIMULATE_DISCONNECT_AFTER_SECONDS \
  PLAYWRIGHT_HEADLESS \
  PLAYWRIGHT_IDLE_TIMEOUT \
  MEMORY_WARNING_MB \
  STALENESS_WARNING_MS \
  STALENESS_STALE_MS \
  DISABLE_REDUNDANT_COMMANDS \
  POP3_PROVIDER \
  POP3_PORT \
  POP3_SECURE \
  POP3_TIMEOUT \
  POP3_DEBUG \
  POP3_FROM_ADDRESS \
  POP3_IGNORE_TLS_ERRORS \
  POP3_OAUTH2_CLIENT_ID \
  POP3_OAUTH2_CLIENT_SECRET \
  POP3_OAUTH2_REFRESH_TOKEN \
  POP3_OAUTH2_TENANT_ID

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
