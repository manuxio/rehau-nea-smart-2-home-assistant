# ============================================
# REHAU NEA SMART 2.0 - Clean Build & Restart
# ============================================
# This script will:
# 1. Stop all Node.js processes
# 2. Clean all build artifacts
# 3. Rebuild backend
# 4. Rebuild web UI
# 5. Start server
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "REHAU - Clean Build & Restart" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all Node.js processes
Write-Host "Step 1: Stopping all Node.js processes..." -ForegroundColor Yellow
try {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "✓ All Node.js processes stopped" -ForegroundColor Green
} catch {
    Write-Host "✓ No Node.js processes running" -ForegroundColor Green
}
Write-Host ""

# Step 2: Clean build artifacts
Write-Host "Step 2: Cleaning build artifacts..." -ForegroundColor Yellow
try {
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
        Write-Host "  ✓ Removed backend dist/" -ForegroundColor Green
    }
    if (Test-Path "web-ui\dist") {
        Remove-Item -Recurse -Force "web-ui\dist"
        Write-Host "  ✓ Removed web-ui dist/" -ForegroundColor Green
    }
    if (Test-Path "web-ui\.vite") {
        Remove-Item -Recurse -Force "web-ui\.vite"
        Write-Host "  ✓ Removed Vite cache" -ForegroundColor Green
    }
    Write-Host "✓ Build artifacts cleaned" -ForegroundColor Green
} catch {
    Write-Host "⚠ Error cleaning: $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Build backend
Write-Host "Step 3: Building backend..." -ForegroundColor Yellow
try {
    $output = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backend built successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend build failed" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
} catch {
    Write-Host "✗ Backend build failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Build web UI
Write-Host "Step 4: Building web UI..." -ForegroundColor Yellow
try {
    Push-Location web-ui
    $output = npm run build 2>&1
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Web UI built successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Web UI build failed" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
} catch {
    Pop-Location
    Write-Host "✗ Web UI build failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Copy PWA files
Write-Host "Step 5: Copying PWA files..." -ForegroundColor Yellow
try {
    Copy-Item "web-ui\public\sw.js" "web-ui\dist\sw.js" -Force -ErrorAction Stop
    Copy-Item "web-ui\public\manifest.json" "web-ui\dist\manifest.json" -Force -ErrorAction Stop
    
    if (Test-Path "icon.png") {
        Copy-Item "icon.png" "web-ui\dist\icon-192.png" -Force
        Copy-Item "icon.png" "web-ui\dist\icon-512.png" -Force
    }
    Write-Host "✓ PWA files copied" -ForegroundColor Green
} catch {
    Write-Host "⚠ Warning: Could not copy PWA files: $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Show success and instructions
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✓ Clean Build Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the server:" -ForegroundColor Yellow
Write-Host "  npm start" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Clear your browser cache!" -ForegroundColor Yellow
Write-Host "  1. Press Ctrl+Shift+Delete" -ForegroundColor White
Write-Host "  2. Select 'Cached images and files'" -ForegroundColor White
Write-Host "  3. Click 'Clear data'" -ForegroundColor White
Write-Host "  OR" -ForegroundColor Yellow
Write-Host "  Press Ctrl+F5 for hard reload" -ForegroundColor White
Write-Host ""
Write-Host "Fixes Applied:" -ForegroundColor Cyan
Write-Host "  ✓ 200 OK logs hidden by default" -ForegroundColor Green
Write-Host "  ✓ LOG_SHOW_OK_REQUESTS option added" -ForegroundColor Green
Write-Host "  ✓ Log viewer dark mode fixed" -ForegroundColor Green
Write-Host ""
