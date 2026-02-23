# REHAU NEA SMART 2.0 - Deploy All New Features
# This script builds and deploys:
# - OAuth2 POP3 support (Gmail/Outlook)
# - Directional indicators in logging
# - PWA support (manifest, service worker)
# - Pull-to-refresh gesture
# - Haptic feedback
# - Offline indicator

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "REHAU NEA SMART 2.0 - Feature Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install dependencies
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 2: Build backend
Write-Host "Step 2: Building backend..." -ForegroundColor Yellow
npm run build
Write-Host "✓ Backend built" -ForegroundColor Green
Write-Host ""

# Step 3: Build web UI
Write-Host "Step 3: Building web UI..." -ForegroundColor Yellow
Set-Location web-ui
npm install
npm run build
Set-Location ..
Write-Host "✓ Web UI built" -ForegroundColor Green
Write-Host ""

# Step 4: Create icon files (if they don't exist)
Write-Host "Step 4: Setting up PWA icons..." -ForegroundColor Yellow
if (Test-Path "icon.png") {
  Copy-Item "icon.png" "web-ui\dist\icon-192.png" -Force
  Copy-Item "icon.png" "web-ui\dist\icon-512.png" -Force
  Write-Host "✓ Icons copied" -ForegroundColor Green
} else {
  Write-Host "⚠ icon.png not found, using placeholders" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Copy service worker and manifest to dist
Write-Host "Step 5: Copying PWA files..." -ForegroundColor Yellow
Copy-Item "web-ui\public\sw.js" "web-ui\dist\sw.js" -Force
Copy-Item "web-ui\public\manifest.json" "web-ui\dist\manifest.json" -Force
Write-Host "✓ PWA files copied" -ForegroundColor Green
Write-Host ""

# Step 6: Show configuration instructions
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✓ Deployment Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "New Features Available:"
Write-Host "  ✓ OAuth2 POP3 (Gmail/Outlook)"
Write-Host "  ✓ Directional indicators in logs"
Write-Host "  ✓ PWA support (installable app)"
Write-Host "  ✓ Pull-to-refresh gesture"
Write-Host "  ✓ Haptic feedback"
Write-Host "  ✓ Offline indicator"
Write-Host ""
Write-Host "To enable OAuth2 POP3:"
Write-Host "  1. See docs\oauth2-setup.md for setup instructions"
Write-Host "  2. Run scripts\get-gmail-oauth2-token.py (for Gmail)"
Write-Host "  3. Run scripts\get-outlook-oauth2-token.py (for Outlook)"
Write-Host "  4. Add credentials to .env file"
Write-Host ""
Write-Host "To start the server:"
Write-Host "  npm start"
Write-Host ""
Write-Host "To test in development mode:"
Write-Host "  npm run dev"
Write-Host ""
