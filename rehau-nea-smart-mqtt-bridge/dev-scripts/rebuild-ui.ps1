Write-Host "Stopping Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Installing dependencies..." -ForegroundColor Yellow
Push-Location web-ui
npm install

Write-Host "Building web UI..." -ForegroundColor Yellow
npm run build

Write-Host "Copying PWA files..." -ForegroundColor Yellow
Copy-Item "public\sw.js" "dist\sw.js" -Force
Copy-Item "public\manifest.json" "dist\manifest.json" -Force

Pop-Location

Write-Host "Build complete!" -ForegroundColor Green
Write-Host "You can now start the server with: npm start" -ForegroundColor Cyan
