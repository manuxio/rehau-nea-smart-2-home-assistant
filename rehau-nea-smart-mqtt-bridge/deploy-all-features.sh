#!/bin/bash

# REHAU NEA SMART 2.0 - Deploy All New Features
# This script builds and deploys:
# - OAuth2 POP3 support (Gmail/Outlook)
# - Directional indicators in logging
# - PWA support (manifest, service worker)
# - Pull-to-refresh gesture
# - Haptic feedback
# - Offline indicator

set -e

echo "========================================="
echo "REHAU NEA SMART 2.0 - Feature Deployment"
echo "========================================="
echo ""

# Colors
GREEN='\033[0.32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Install dependencies
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 2: Build backend
echo -e "${YELLOW}Step 2: Building backend...${NC}"
npm run build
echo -e "${GREEN}✓ Backend built${NC}"
echo ""

# Step 3: Build web UI
echo -e "${YELLOW}Step 3: Building web UI...${NC}"
cd web-ui
npm install
npm run build
cd ..
echo -e "${GREEN}✓ Web UI built${NC}"
echo ""

# Step 4: Create icon files (if they don't exist)
echo -e "${YELLOW}Step 4: Setting up PWA icons...${NC}"
if [ -f "icon.png" ]; then
  cp icon.png web-ui/dist/icon-192.png
  cp icon.png web-ui/dist/icon-512.png
  echo -e "${GREEN}✓ Icons copied${NC}"
else
  echo -e "${YELLOW}⚠ icon.png not found, using placeholders${NC}"
fi
echo ""

# Step 5: Copy service worker and manifest to dist
echo -e "${YELLOW}Step 5: Copying PWA files...${NC}"
cp web-ui/public/sw.js web-ui/dist/sw.js
cp web-ui/public/manifest.json web-ui/dist/manifest.json
echo -e "${GREEN}✓ PWA files copied${NC}"
echo ""

# Step 6: Show configuration instructions
echo ""
echo "========================================="
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "New Features Available:"
echo "  ✓ OAuth2 POP3 (Gmail/Outlook)"
echo "  ✓ Directional indicators in logs"
echo "  ✓ PWA support (installable app)"
echo "  ✓ Pull-to-refresh gesture"
echo "  ✓ Haptic feedback"
echo "  ✓ Offline indicator"
echo ""
echo "To enable OAuth2 POP3:"
echo "  1. See docs/oauth2-setup.md for setup instructions"
echo "  2. Run scripts/get-gmail-oauth2-token.py (for Gmail)"
echo "  3. Run scripts/get-outlook-oauth2-token.py (for Outlook)"
echo "  4. Add credentials to .env file"
echo ""
echo "To start the server:"
echo "  npm start"
echo ""
echo "To test in development mode:"
echo "  npm run dev"
echo ""
