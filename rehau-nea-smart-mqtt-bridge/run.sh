#!/bin/sh

# Load configuration from Home Assistant addon options.json if it exists
# This allows the addon to work both as HA addon and standalone
if [ -f "/data/options.json" ]; then
  echo "Loading configuration from /data/options.json (Home Assistant addon mode)..."
  
  # Try to load bashio (Home Assistant addon helper) if available
  BASHIO_AVAILABLE=false
  if [ -f "/usr/lib/bashio/bashio.sh" ]; then
    # Source bashio to make functions available
    if . /usr/lib/bashio/bashio.sh 2>/dev/null; then
      # Test if bashio::config function works by trying a safe call
      # This will succeed if bashio is loaded, even if the key doesn't exist
      if (bashio::config 'rehau_email' >/dev/null 2>&1 || \
          bashio::config.has_value 'rehau_email' >/dev/null 2>&1); then
        BASHIO_AVAILABLE=true
        echo "Using bashio to load configuration..."
      fi
    fi
  fi
  
  # Use bashio if available, otherwise fall back to jq
  if [ "$BASHIO_AVAILABLE" = "true" ]; then
    export REHAU_EMAIL=$(bashio::config 'rehau_email')
    export REHAU_PASSWORD=$(bashio::config 'rehau_password')
    export MQTT_HOST=$(bashio::config 'mqtt_host')
    
    # Get optional values with defaults
    MQTT_PORT_VAL=$(bashio::config 'mqtt_port' || echo '')
    export MQTT_PORT=${MQTT_PORT_VAL:-1883}
    
    MQTT_USER_VAL=$(bashio::config 'mqtt_user' || echo '')
    export MQTT_USER=${MQTT_USER_VAL:-}
    
    MQTT_PASSWORD_VAL=$(bashio::config 'mqtt_password' || echo '')
    export MQTT_PASSWORD=${MQTT_PASSWORD_VAL:-}
    
    API_PORT_VAL=$(bashio::config 'api_port' || echo '')
    export API_PORT=${API_PORT_VAL:-3000}
    
    LOG_LEVEL_VAL=$(bashio::config 'log_level' || echo '')
    export LOG_LEVEL=${LOG_LEVEL_VAL:-info}
    
    ZONE_RELOAD_VAL=$(bashio::config 'zone_reload_interval' || echo '')
    export ZONE_RELOAD_INTERVAL=${ZONE_RELOAD_VAL:-300}
    
    TOKEN_REFRESH_VAL=$(bashio::config 'token_refresh_interval' || echo '')
    export TOKEN_REFRESH_INTERVAL=${TOKEN_REFRESH_VAL:-21600}
    
    REFERENTIALS_RELOAD_VAL=$(bashio::config 'referentials_reload_interval' || echo '')
    export REFERENTIALS_RELOAD_INTERVAL=${REFERENTIALS_RELOAD_VAL:-86400}
    
    USE_GROUP_VAL=$(bashio::config 'use_group_in_names' || echo '')
    export USE_GROUP_IN_NAMES=${USE_GROUP_VAL:-false}
  # Fallback to jq if bashio is not available
  elif command -v jq > /dev/null 2>&1; then
    echo "Using jq to load configuration..."
    export REHAU_EMAIL=$(jq -r '.rehau_email // empty' /data/options.json)
    export REHAU_PASSWORD=$(jq -r '.rehau_password // empty' /data/options.json)
    export MQTT_HOST=$(jq -r '.mqtt_host // empty' /data/options.json)
    export MQTT_PORT=$(jq -r '.mqtt_port // 1883' /data/options.json)
    export MQTT_USER=$(jq -r '.mqtt_user // empty' /data/options.json)
    export MQTT_PASSWORD=$(jq -r '.mqtt_password // empty' /data/options.json)
    export API_PORT=$(jq -r '.api_port // 3000' /data/options.json)
    export LOG_LEVEL=$(jq -r '.log_level // "info"' /data/options.json)
    export ZONE_RELOAD_INTERVAL=$(jq -r '.zone_reload_interval // 300' /data/options.json)
    export TOKEN_REFRESH_INTERVAL=$(jq -r '.token_refresh_interval // 21600' /data/options.json)
    export REFERENTIALS_RELOAD_INTERVAL=$(jq -r '.referentials_reload_interval // 86400' /data/options.json)
    export USE_GROUP_IN_NAMES=$(jq -r '.use_group_in_names // false' /data/options.json)
  else
    echo "ERROR: Neither bashio nor jq is available to parse /data/options.json"
    echo "Please ensure bashio is available (for HA addon) or jq is installed (for standalone)"
    exit 1
  fi
  
  echo "Configuration loaded from options.json"
else
  echo "Running in standalone mode (using environment variables)..."
fi

# Validate required environment variables
if [ -z "$REHAU_EMAIL" ]; then
  echo "ERROR: REHAU_EMAIL environment variable is required"
  echo "For Home Assistant addon: ensure rehau_email is set in addon configuration"
  echo "For standalone: ensure REHAU_EMAIL environment variable is set"
  exit 1
fi

if [ -z "$REHAU_PASSWORD" ]; then
  echo "ERROR: REHAU_PASSWORD environment variable is required"
  echo "For Home Assistant addon: ensure rehau_password is set in addon configuration"
  echo "For standalone: ensure REHAU_PASSWORD environment variable is set"
  exit 1
fi

if [ -z "$MQTT_HOST" ]; then
  echo "ERROR: MQTT_HOST environment variable is required"
  echo "For Home Assistant addon: ensure mqtt_host is set in addon configuration"
  echo "For standalone: ensure MQTT_HOST environment variable is set"
  exit 1
fi

# Set defaults for optional variables (only if not already set)
export MQTT_PORT=${MQTT_PORT:-1883}
export API_PORT=${API_PORT:-3000}
export LOG_LEVEL=${LOG_LEVEL:-info}
export ZONE_RELOAD_INTERVAL=${ZONE_RELOAD_INTERVAL:-300}
export TOKEN_REFRESH_INTERVAL=${TOKEN_REFRESH_INTERVAL:-21600}
export REFERENTIALS_RELOAD_INTERVAL=${REFERENTIALS_RELOAD_INTERVAL:-86400}
export USE_GROUP_IN_NAMES=${USE_GROUP_IN_NAMES:-false}

echo "Starting REHAU NEA SMART 2.0 MQTT Bridge (TypeScript)..."
echo "MQTT Host: ${MQTT_HOST}:${MQTT_PORT}"
echo "API Port: ${API_PORT}"
echo "Zone Reload Interval: ${ZONE_RELOAD_INTERVAL}s"
echo "Token Refresh Interval: ${TOKEN_REFRESH_INTERVAL}s"
echo "Referentials Reload Interval: ${REFERENTIALS_RELOAD_INTERVAL}s"
echo "Use Group in Names: ${USE_GROUP_IN_NAMES}"

# Start the compiled JavaScript application
cd /app
exec node dist/index.js
