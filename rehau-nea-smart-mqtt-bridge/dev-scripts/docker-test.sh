#!/bin/bash
# Script to test authentication from inside Docker container

echo "=== Docker Container Authentication Test ==="
echo ""

# Get container ID
CONTAINER_ID=$(docker ps -a --filter "name=rehau" --format "{{.ID}}" | head -1)

if [ -z "$CONTAINER_ID" ]; then
    echo "Error: No REHAU container found"
    exit 1
fi

echo "Container ID: $CONTAINER_ID"
echo ""

# Copy test script
echo "Copying test script..."
docker cp /tmp/test-auth-docker.js $CONTAINER_ID:/app/

# Run test
echo "Running authentication test..."
docker exec $CONTAINER_ID node /app/test-auth-docker.js

echo ""
echo "=== Test Complete ==="
