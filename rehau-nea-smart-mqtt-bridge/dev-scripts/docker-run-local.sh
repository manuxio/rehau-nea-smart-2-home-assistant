#!/bin/bash

# Local Docker build and run script for REHAU NEA SMART 2.0 MQTT Bridge
# This script uses .env.local for configuration (excluded from git)

set -e

echo "🐳 Building REHAU NEA SMART 2.0 MQTT Bridge container..."

# Build the container
docker build -t rehau-nea-smart-bridge:local -f rehau-nea-smart-mqtt-bridge/Dockerfile rehau-nea-smart-mqtt-bridge/

echo "✅ Build completed successfully"

echo "🚀 Starting container with local configuration..."

# Run the container with environment variables from .env.test-rehau-only
docker run -d \
  --name rehau-nea-smart-bridge-local \
  --restart unless-stopped \
  --network host \
  --env-file .env.test-rehau-only \
  -v $(pwd)/rehau-nea-smart-mqtt-bridge/data:/app/data \
  rehau-nea-smart-bridge:local

echo "✅ Container started successfully"
echo "📊 Container name: rehau-nea-smart-bridge-local"
echo "📋 View logs with: docker logs -f rehau-nea-smart-bridge-local"
echo "🛑 Stop container with: docker stop rehau-nea-smart-bridge-local"
echo "🔄 Restart container with: docker restart rehau-nea-smart-bridge-local"
