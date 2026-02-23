#!/bin/bash
# Deploy test script for Home Assistant

echo "Building locally..."
npm run build

echo "Finding container..."
CONTAINER=$(ssh root@automation.local "docker ps --format '{{.Names}}' | grep rehau" 2>/dev/null)

if [ -z "$CONTAINER" ]; then
    echo "Error: Could not find REHAU container"
    exit 1
fi

echo "Found container: $CONTAINER"

echo "Copying built files to Home Assistant..."
scp -r dist/* root@automation.local:/tmp/rehau-dist/

echo "Copying files into container..."
ssh root@automation.local "docker cp /tmp/rehau-dist/. $CONTAINER:/app/dist/"

echo "Restarting container..."
ssh root@automation.local "docker restart $CONTAINER"

echo "Done! Watching logs..."
ssh root@automation.local "docker logs -f $CONTAINER"
