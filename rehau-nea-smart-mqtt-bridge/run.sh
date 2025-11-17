#!/bin/sh

# Validate required environment variables
if [ -z "$REHAU_EMAIL" ]; then
  echo "ERROR: REHAU_EMAIL environment variable is required"
  exit 1
fi

if [ -z "$REHAU_PASSWORD" ]; then
  echo "ERROR: REHAU_PASSWORD environment variable is required"
  exit 1
fi

if [ -z "$MQTT_HOST" ]; then
  echo "ERROR: MQTT_HOST environment variable is required"
  exit 1
fi

# Set defaults for optional variables
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
