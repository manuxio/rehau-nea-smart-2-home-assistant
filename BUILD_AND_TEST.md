# Build and Test v5.0.0 Docker Container

## ✅ Commit Status

**Branch**: `feature/v5.0.0-release`  
**Commit**: `350c2fd`  
**Status**: Ready for Docker build and testing

## 🐳 Docker Build Instructions

### 1. Navigate to Project Directory

```bash
cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge
```

### 2. Verify .env Configuration

Ensure your `.env` file has all required settings:

```bash
# Check if .env exists
Test-Path .env

# If not, copy from example
cp .env.example .env
# Then edit with your credentials
```

### 3. Build Docker Image

```bash
# Build with tag v5.0.0
docker build -t rehau-bridge:v5.0.0 .

# This will:
# - Install Node.js 20
# - Build web UI (React + Vite)
# - Compile TypeScript
# - Install Chromium for Playwright
# - Create optimized production image
```

**Expected build time**: 5-10 minutes (depending on system)

### 4. Run Docker Container

```bash
# Run in detached mode
docker run -d \
  --name rehau-test \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  rehau-bridge:v5.0.0
```

### 5. Monitor Logs

```bash
# Follow logs in real-time
docker logs rehau-test -f

# Look for:
# ✅ "🚀 API Server started on port 3000"
# ✅ "📡 MQTT Connected"
# ✅ "🔐 Authentication successful"
# ✅ "🏠 Published discovery config"
```

### 6. Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","uptime":...}

# Web UI
# Open browser: http://localhost:3000

# API Documentation
# Open browser: http://localhost:3000/api-docs
```

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Container starts without errors
- [ ] Health endpoint responds
- [ ] Web UI loads successfully
- [ ] API documentation accessible
- [ ] MQTT connection established
- [ ] Authentication completes
- [ ] Zones discovered and published

### Web UI Testing
- [ ] Login page works
- [ ] Dashboard displays system info
- [ ] Zones page shows all zones
- [ ] Zone detail page loads
- [ ] Temperature control works
- [ ] Mode switching works
- [ ] Settings page displays config
- [ ] Logs page shows recent logs
- [ ] Dark/Light mode toggle works
- [ ] Mobile responsive design works

### API Testing
- [ ] Login endpoint returns JWT token
- [ ] GET /api/v1/zones returns zone list
- [ ] GET /api/v1/zones/:id returns zone details
- [ ] PUT /api/v1/zones/:id/temperature works
- [ ] PUT /api/v1/zones/:id/mode works
- [ ] GET /api/v1/system returns system info
- [ ] GET /api/v1/logs returns log entries
- [ ] POST /api/v1/logs/export works

### Home Assistant Integration
- [ ] Climate entities auto-discovered
- [ ] Temperature updates in HA
- [ ] Mode changes reflect in HA
- [ ] Preset changes work
- [ ] Status sensors created
- [ ] Outside temperature sensor works

## 🐛 Troubleshooting

### Build Fails

**Issue**: Docker build fails during web UI build
```bash
# Solution: Increase Docker memory
# Docker Desktop → Settings → Resources → Memory: 4GB+
```

**Issue**: Chromium installation fails
```bash
# Solution: Use --no-cache flag
docker build --no-cache -t rehau-bridge:v5.0.0 .
```

### Container Fails to Start

**Issue**: Port 3000 already in use
```bash
# Check what's using port 3000
netstat -ano | findstr :3000

# Stop conflicting process or use different port
docker run -d --name rehau-test -p 3001:3000 --env-file .env rehau-bridge:v5.0.0
```

**Issue**: Environment variables not loaded
```bash
# Verify .env file exists and has correct format
cat .env

# Check container environment
docker exec rehau-test env | grep REHAU
```

### Authentication Issues

**Issue**: 2FA codes not received
```bash
# Check POP3 settings
docker logs rehau-test | grep POP3

# Verify email credentials
# Test POP3 connection manually
```

**Issue**: Browser launch fails
```bash
# Check Chromium installation
docker exec rehau-test which chromium

# Check memory usage
docker stats rehau-test
```

## 📊 Performance Monitoring

```bash
# Monitor resource usage
docker stats rehau-test

# Expected usage:
# - Memory: 150-300 MB (idle)
# - Memory: 300-500 MB (with browser)
# - CPU: <5% (idle)
# - CPU: 10-30% (during auth)
```

## 🔄 Update and Restart

```bash
# Stop and remove old container
docker stop rehau-test
docker rm rehau-test

# Rebuild with latest changes
docker build -t rehau-bridge:v5.0.0 .

# Start new container
docker run -d --name rehau-test -p 3000:3000 --env-file .env rehau-bridge:v5.0.0
```

## ✅ Success Criteria

Before pushing to main, verify:

1. ✅ Docker build completes without errors
2. ✅ Container starts and stays running
3. ✅ Health endpoint returns healthy status
4. ✅ Web UI loads and is functional
5. ✅ API endpoints respond correctly
6. ✅ MQTT connection established
7. ✅ Authentication successful
8. ✅ Zones discovered and controllable
9. ✅ Home Assistant integration works
10. ✅ No memory leaks after 1 hour runtime

## 📝 Next Steps After Successful Testing

1. **Tag the release**:
   ```bash
   git tag -a v5.0.0 -m "Release v5.0.0 - Complete Control Platform"
   ```

2. **Push to remote**:
   ```bash
   git push origin feature/v5.0.0-release
   git push origin v5.0.0
   ```

3. **Create Pull Request** to merge into main

4. **Build multi-platform images**:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 \
     -t your-registry/rehau-bridge:v5.0.0 \
     --push .
   ```

5. **Update Home Assistant addon** repository

6. **Create GitHub release** with CHANGELOG.md

---

**Current Status**: Ready for Docker build and testing  
**Branch**: feature/v5.0.0-release  
**Commit**: 350c2fd
