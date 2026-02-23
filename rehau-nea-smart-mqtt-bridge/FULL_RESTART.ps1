# Complete Restart Script
Write-Host "=== FULL RESTART ===" -ForegroundColor Cyan
Write-Host ""

# 1. Stop all Node processes
Write-Host "1. Stopping all Node.js processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Write-Host "   Done" -ForegroundColor Green
Write-Host ""

# 2. Clean build artifacts
Write-Host "2. Cleaning build artifacts..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "web-ui\dist") { Remove-Item -Recurse -Force "web-ui\dist" }
if (Test-Path "web-ui\.vite") { Remove-Item -Recurse -Force "web-ui\.vite" }
Write-Host "   Done" -ForegroundColor Green
Write-Host ""

# 3. Build backend
Write-Host "3. Building backend..." -ForegroundColor Yellow
npm run build | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Done" -ForegroundColor Green
} else {
    Write-Host "   FAILED" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Build web UI
Write-Host "4. Building web UI..." -ForegroundColor Yellow
Push-Location web-ui
npm run build | Out-Null
Pop-Location
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Done" -ForegroundColor Green
} else {
    Write-Host "   FAILED" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 5. Copy PWA files
Write-Host "5. Copying PWA files..." -ForegroundColor Yellow
Copy-Item "web-ui\public\sw.js" "web-ui\dist\sw.js" -Force -ErrorAction SilentlyContinue
Copy-Item "web-ui\public\manifest.json" "web-ui\dist\manifest.json" -Force -ErrorAction SilentlyContinue
Write-Host "   Done" -ForegroundColor Green
Write-Host ""

Write-Host "=== BUILD COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Cyan
Write-Host ""

# Start server
npm start
