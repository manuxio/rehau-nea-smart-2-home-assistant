#!/bin/bash

# Test script to check if wget gets blocked by Cloudflare
# This mimics the exact same request our Node.js code makes

echo "=== Testing REHAU Login with wget ==="
echo ""

# Step 1: Get a requestId from OAuth redirect
echo "Step 1: Getting requestId from OAuth flow..."
OAUTH_RESPONSE=$(wget --max-redirect=0 \
  --header='User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  --header='Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
  --server-response \
  'https://accounts.rehau.com/authz-srv/authz?client_id=rehau-connect-app&redirect_uri=https://connect.rehau.com/oauth2/callback&response_type=code&scope=openid%20profile%20email&code_challenge=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&code_challenge_method=S256' \
  -O - 2>&1)

echo "$OAUTH_RESPONSE" | grep -E "HTTP|Location|cf_bm" | head -10
echo ""

# Extract requestId from Location header
REQUEST_ID=$(echo "$OAUTH_RESPONSE" | grep -i "Location:" | grep -oP 'requestId=\K[^&]+' | head -1)

if [ -z "$REQUEST_ID" ]; then
  echo "ERROR: Could not extract requestId from OAuth response"
  exit 1
fi

echo "✓ RequestId obtained: $REQUEST_ID"
echo ""

# Step 2: Submit login credentials
echo "Step 2: Submitting login credentials..."
echo "Password: (reading from environment or config)"
echo ""

# You need to set REHAU_PASSWORD environment variable
if [ -z "$REHAU_PASSWORD" ]; then
  echo "ERROR: REHAU_PASSWORD environment variable not set"
  echo "Usage: REHAU_PASSWORD='your_password' ./test-wget.sh"
  exit 1
fi

LOGIN_RESPONSE=$(wget --post-data="username=manu@cappelleri.net&username_type=email&password=${REHAU_PASSWORD}&requestId=${REQUEST_ID}&rememberMe=true" \
  --header='Content-Type: application/x-www-form-urlencoded' \
  --header='User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  --header='Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
  --header='Origin: https://accounts.rehau.com' \
  --header="Referer: https://accounts.rehau.com/rehau-ui/login?requestId=${REQUEST_ID}&view_type=login" \
  --header='Connection: close' \
  --server-response \
  --max-redirect=0 \
  'https://accounts.rehau.com/login-srv/login' \
  -O - 2>&1)

echo "$LOGIN_RESPONSE" | head -80
echo ""

# Check for Cloudflare challenge
if echo "$LOGIN_RESPONSE" | grep -q "Just a moment"; then
  echo "❌ BLOCKED: Cloudflare JavaScript challenge detected"
  exit 1
elif echo "$LOGIN_RESPONSE" | grep -q "HTTP.*403"; then
  echo "❌ BLOCKED: HTTP 403 Forbidden"
  exit 1
elif echo "$LOGIN_RESPONSE" | grep -q "HTTP.*302"; then
  echo "✓ SUCCESS: Got redirect (302) - login likely succeeded"
  exit 0
else
  echo "⚠️  UNKNOWN: Check response above"
  exit 2
fi
