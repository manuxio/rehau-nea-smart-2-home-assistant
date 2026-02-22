# Commit v5.0.0 changes
Write-Host "Creating feature branch for v5.0.0..." -ForegroundColor Green

# Create and checkout feature branch
git checkout -b feature/v5.0.0-release 2>&1 | Out-Null

# Add all changes
Write-Host "Staging changes..." -ForegroundColor Green
git add .

# Create commit with detailed message
Write-Host "Creating commit..." -ForegroundColor Green
$commitMessage = @"
feat: Release v5.0.0 - Complete Control Platform

🎉 Major release transforming the bridge into a comprehensive REHAU control platform

## ✨ New Features

### 🚀 REST API
- Complete REST API with full CRUD operations
- Swagger/OpenAPI documentation at /api-docs
- JWT authentication for secure access
- Real-time WebSocket support via Socket.IO
- Health monitoring and log export endpoints

### 📱 Mobile-First Web Interface
- React 19 with TypeScript and Vite
- Mobile-first responsive design with dark/light mode
- PWA support with offline capabilities
- Bottom navigation for mobile app-like experience
- Protected routes with JWT authentication
- Auto-refresh data every 30 seconds

### 🎨 Enhanced Logging System
- Colorful logging with chalk and emoji support
- Component-specific emojis for easy scanning
- Command tracking system for operation monitoring
- Log obfuscation for shareable logs
- Log export API with privacy protection

### 📊 Home Assistant Status Reporting
- Bridge status sensor (connected/authenticating/error/degraded)
- Auth status sensor with session tracking
- MQTT quality sensor with connection monitoring
- Staleness detection with auto-refresh mechanism
- Resource monitoring (memory, CPU usage)

### ⚡ Playwright Optimization
- Lazy browser initialization (only starts when needed)
- Idle timeout with automatic cleanup
- Optimized browser settings for minimal resources
- Cross-platform support (Windows/Linux)
- Smart token caching

### 📱 Progressive Web App Features
- App manifest for home screen installation
- Service worker with offline caching
- Install prompt component
- Standalone display mode
- App shortcuts for quick access

### 🔐 Authentication & Security
- OAuth2 POP3 support (⚠️ incomplete - manual token generation)
- Gmail and Outlook OAuth2 providers
- JWT authentication for API access
- Request rate limiting
- CORS protection
- Input validation

## 🐳 Docker & Deployment
- Multi-stage build for optimized image size
- Web UI build integration
- Chromium installation for Playwright
- Health check endpoint
- Multi-platform support (AMD64, ARM64, ARMv7)

## 📚 Documentation
- Comprehensive CHANGELOG.md with full version history
- Complete README.md with quick start guides
- OAuth2 setup guides with clear limitation warnings
- Docker deployment guide
- Complete API documentation

## ⚠️ Breaking Changes
- Minimum Node.js version: 20+
- New dependencies for web framework
- Port 3000 now required for API and Web UI
- New environment variables for API configuration

## 🐛 Bug Fixes
- Fixed log pollution from 200 OK requests
- Improved dark mode text visibility
- Fixed memory leaks in browser management
- Optimized performance and resource usage

## 📦 Dependencies
- Added: express, socket.io, jsonwebtoken, react, zustand, axios, chalk
- Updated: typescript 5.3+, playwright 1.40+
- Cleaned up unused dependencies

---

**OAuth2 Notice**: OAuth2 implementation is incomplete and requires manual
token generation. Basic authentication with GMX or App Passwords is recommended.

See CHANGELOG.md for complete details.
"@

git commit -m $commitMessage

Write-Host "`n✅ Commit created successfully!" -ForegroundColor Green
Write-Host "`nBranch: feature/v5.0.0-release" -ForegroundColor Cyan
Write-Host "Ready for Docker build and testing" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Build Docker: docker build -t rehau-bridge:v5.0.0 ." -ForegroundColor White
Write-Host "  2. Test container: docker run -d --name rehau-test -p 3000:3000 --env-file .env rehau-bridge:v5.0.0" -ForegroundColor White
Write-Host "  3. Check logs: docker logs rehau-test -f" -ForegroundColor White
Write-Host "  4. If successful: git push origin feature/v5.0.0-release" -ForegroundColor White
