# ============================================
# REHAU NEA SMART 2.0 - Complete Deployment
# ============================================
# This script will:
# 1. Stop running servers
# 2. Build backend
# 3. Build web UI
# 4. Copy PWA files
# 5. Start server
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "REHAU NEA SMART 2.0 - Complete Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop running servers
Write-Host "Step 1: Stopping running servers..." -ForegroundColor Yellow
try {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Servers stopped" -ForegroundColor Green
} catch {
    Write-Host "✓ No servers running" -ForegroundColor Green
}
Write-Host ""

# Wait a moment for processes to fully stop
Start-Sleep -Seconds 2

# Step 2: Build backend
Write-Host "Step 2: Building backend..." -ForegroundColor Yellow
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backend built successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend build failed" -ForegroundColor Red
        Write-Host "Run 'npm run build' manually to see errors" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Backend build failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Build web UI
Write-Host "Step 3: Building web UI..." -ForegroundColor Yellow
try {
    Push-Location web-ui
    npm run build 2>&1 | Out-Null
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Web UI built successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Web UI build failed" -ForegroundColor Red
        Write-Host "Run 'cd web-ui && npm run build' manually to see errors" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Pop-Location
    Write-Host "✗ Web UI build failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Copy PWA files
Write-Host "Step 4: Copying PWA files..." -ForegroundColor Yellow
try {
    Copy-Item "web-ui\public\sw.js" "web-ui\dist\sw.js" -Force -ErrorAction Stop
    Copy-Item "web-ui\public\manifest.json" "web-ui\dist\manifest.json" -Force -ErrorAction Stop
    
    # Copy icons if available
    if (Test-Path "icon.png") {
        Copy-Item "icon.png" "web-ui\dist\icon-192.png" -Force
        Copy-Item "icon.png" "web-ui\dist\icon-512.png" -Force
        Write-Host "✓ PWA files and icons copied" -ForegroundColor Green
    } else {
        Write-Host "✓ PWA files copied (icons not found)" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Failed to copy PWA files: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Show success message
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✓ Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "New Features Available:" -ForegroundColor White
Write-Host "  ✓ OAuth2 POP3 (Gmail/Outlook)" -ForegroundColor Green
Write-Host "  ✓ PWA support (installable app)" -ForegroundColor Green
Write-Host "  ✓ Pull-to-refresh gesture" -ForegroundColor Green
Write-Host "  ✓ Haptic feedback" -ForegroundColor Green
Write-Host "  ✓ Offline indicator" -ForegroundColor Green
Write-Host "  ✓ Directional logging" -ForegroundColor Green
Write-Host ""
Write-Host "To start the server:" -ForegroundColor Yellow
Write-Host "  npm start" -ForegroundColor White
Write-Host ""
Write-Host "Or start in development mode:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "  - NEW_FEATURES_v5.md - Feature overview" -ForegroundColor White
Write-Host "  - COMPLETE_DEPLOYMENT_GUIDE.md - Detailed guide" -ForegroundColor White
Write-Host "  - docs/oauth2-setup.md - OAuth2 setup" -ForegroundColor White
Write-Host ""
Write-Host "Ready to start? Run: npm start" -ForegroundColor Cyan
Write-Host ""
