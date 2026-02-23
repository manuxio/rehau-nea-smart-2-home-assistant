# Quick Web UI Rebuild
Write-Host "Rebuilding Web UI..." -ForegroundColor Yellow

# Stop dev server if running
Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*web-ui*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Clean and rebuild
Push-Location web-ui
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path ".vite") { Remove-Item -Recurse -Force ".vite" }
npm run build
Pop-Location

# Copy PWA files
Copy-Item "web-ui\public\sw.js" "web-ui\dist\sw.js" -Force
Copy-Item "web-ui\public\manifest.json" "web-ui\dist\manifest.json" -Force

Write-Host "Web UI rebuilt successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Access at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press Ctrl+F5 to hard reload" -ForegroundColor Yellow
