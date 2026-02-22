# REHAU NEA SMART 2.0 - Enhancement Roadmap

> **⚠️ IMPORTANT**: This roadmap is a living document and MUST be updated after each development round to reflect progress, learnings, and adjustments.

> **🌿 BRANCH**: All development work MUST be done on the `feature/v5-enhancements` branch, NOT on main!

> **🧪 TESTING**: Every single task MUST be tested on real REHAU system before marking [x]. See [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)

## Testing Philosophy - READ THIS FIRST! 🚨

### The Golden Rule
**A task is ONLY complete when it's tested and working on a real REHAU system!**

### Before Marking ANY Task as [x]
1. ✅ Code compiles without errors
2. ✅ Bridge starts successfully  
3. ✅ Feature works on real REHAU system
4. ✅ Existing features still work
5. ✅ No errors in logs
6. ✅ No memory leaks
7. ✅ Changes committed to git
8. ✅ Roadmap updated

### Testing Frequency
- **After every task** → Test immediately
- **After every commit** → Verify bridge still works
- **After every file change** → Check logs
- **Before marking [x]** → Full regression test

### Use the Checklist
See [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) for detailed testing steps for each task type.

## Vision

Transform this bridge from a background service into a **full-featured REHAU control platform** with:
- 🎨 Beautiful, colorful logging with emojis (because this is FUN!)
- 🚀 Complete REST API for all REHAU operations
- 📱 Mobile-first web interface for direct control
- 🔐 Enhanced authentication with OAuth2 POP3
- 📊 Better status reporting to Home Assistant
- ⚡ Optimized Playwright usage for speed and efficiency
- 🔄 Smart command completion detection

## Core Principles

1. **Preserve existing functionality** - Don't break what works (reverse engineering was hard)
2. **Add, don't replace** - Build on top of current logic
3. **Test early, test often** - Every change must be tested immediately with real REHAU system
4. **Mark progress** - Check [x] every completed task in this roadmap
5. **Have fun** - Use colors, emojis, make it enjoyable to use
6. **Mobile-first** - Web UI must feel like a native app
7. **API-driven** - Everything through documented REST APIs
8. **Future-proof** - React code ready for React Native migration
9. **Branch discipline** - All work on feature branch, merge when stable

## Testing Philosophy

> **⚠️ CRITICAL**: Every single change MUST be tested immediately with a real REHAU system before moving to the next task!

### Testing Rules

1. **After every task** - Test the specific feature you just implemented
2. **After every commit** - Run the bridge and verify it still works
3. **After every file change** - Check logs for errors
4. **Before marking [x]** - Task is only complete when tested and working
5. **Real system only** - No mocking for final validation, use actual REHAU API

### Testing Checklist (Use for Every Task)

```
Before marking task as [x] complete:
□ Code compiles without errors
□ No TypeScript errors
□ Bridge starts successfully
□ Feature works as expected
□ Existing features still work
□ Logs show correct behavior
□ No memory leaks observed
□ Tested on real REHAU system
□ Changes committed to feature branch
```

---

## Current State Assessment

### What Works Well ✅
- Playwright-based authentication (hard-won, keep it)
- MQTT bridge with HA discovery (stable, enhance it)
- POP3 2FA handling (works, but can be improved)
- TypeScript architecture (solid foundation)
- Parser logic (complex but functional)

### What We're Adding 🚀
- Full REST API with Swagger docs
- Mobile-first React web interface
- OAuth2 POP3 authentication
- Enhanced HA status sensors
- Persistent session management
- Stale status detection

---

## Development Workflow

### Branch Strategy
```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/v5-enhancements

# Work on feature branch
git add .
git commit -m "feat: description"
git push origin feature/v5-enhancements

# When phase is complete and tested
git checkout main
git merge feature/v5-enhancements
git push origin main
```

### After Each Round
1. ✅ Update this roadmap with progress
2. ✅ Mark all completed tasks with [x]
3. ✅ Document any issues encountered
4. ✅ Adjust timeline if needed
5. ✅ Update success criteria
6. ✅ Commit roadmap changes to feature branch

### Task Completion Rules

**A task is ONLY marked [x] when:**
- Code is written and compiles
- Feature is tested on real REHAU system
- Existing features still work
- Changes are committed to git
- No errors in logs

**Example**:
```markdown
### Tasks
- [ ] Create enhanced logger with colors
  → Working on it...
  
- [x] Create enhanced logger with colors
  → ✅ Tested: Logs show colors and emojis correctly
  → ✅ Tested: Existing MQTT bridge still works
  → ✅ Committed: feat(logging): add colorful logger
```

---

## PRIORITY 1: Enhanced Logging (Week 1) 🎨

### Goal
Beautiful, informative, directional logging with colors and emojis that makes debugging FUN!

### Requirements

#### 1.1 Directional Logging
**Every log must show direction of data flow**

```typescript
// Incoming (from REHAU/MQTT)
[INFO] ⬇️  [MQTT→Bridge] Zone "Living Room" temperature update: 21.5°C
[INFO] ⬇️  [REHAU→Bridge] Authentication successful for j***@g***.com
[DEBUG] ⬇️  [MQTT→Bridge] Message received: rehau/home/living_room/temperature/set

// Outgoing (to REHAU/MQTT)
[INFO] ⬆️  [Bridge→REHAU] Setting "Living Room" temperature to 22.0°C
[INFO] ⬆️  [Bridge→MQTT] Publishing temperature state: 22.0°C
[DEBUG] ⬆️  [Bridge→MQTT] Topic: rehau/home/living_room/temperature/state

// Internal processing
[INFO] 🔄 [Bridge] Processing temperature command for "Living Room"
[INFO] 🔄 [Bridge] Validating command parameters
[DEBUG] 🔄 [Bridge] Command queue: 3 pending commands

// Bidirectional/Status
[INFO] 🔌 [Bridge↔MQTT] Connected to broker at core-mosquitto:1883
[INFO] 🔌 [Bridge↔REHAU] WebSocket connection established
```

#### 1.2 Colors and Emojis
**Make logs visually appealing and easy to scan**

```typescript
// Log levels with colors and emojis
[ERROR] ❌ Something went wrong
[WARN]  ⚠️  Warning message
[INFO]  ℹ️  Information message
[DEBUG] 🔍 Debug details
[TRACE] 🔬 Trace details

// Component-specific emojis
[Auth]   🔐 Authentication events
[MQTT]   📡 MQTT operations
[REHAU]  🏠 REHAU API calls
[Zone]   🌡️  Zone operations
[API]    🚀 REST API requests
[Web]    🌐 Web UI events
[POP3]   📧 Email operations
[Playwright] 🎭 Browser automation

// Status emojis
✅ Success
❌ Failure
⏳ In progress
🔄 Retry
⚡ Fast operation
🐌 Slow operation
💾 Saved
🗑️  Deleted
```

#### 1.3 Readable vs Shareable Modes
**Default: Show real names. Shareable: Obfuscate personal info**

**Normal Mode** (default):
```
[INFO] 🌡️  ⬇️  [MQTT→Bridge] Zone "Living Room" temperature: 21.5°C
[INFO] 🏠 ⬆️  [Bridge→REHAU] Setting "Master Bedroom" to 22.0°C
[INFO] 🔐 ✅ [Auth] User john.doe@gmail.com authenticated
```

**Shareable Mode** (for GitHub/support):
```
[INFO] 🌡️  ⬇️  [MQTT→Bridge] Zone "Zone_A" temperature: 21.5°C
[INFO] 🏠 ⬆️  [Bridge→REHAU] Setting "Zone_B" to 22.0°C
[INFO] 🔐 ✅ [Auth] User j***@g***.com authenticated
```

#### 1.4 Smart Command Completion Detection
**Handle REHAU's silent command rejection**

```typescript
// Problem: REHAU silently discards no-op commands
// Solution: Track and detect

[INFO] 🌡️  ⬆️  [Bridge→REHAU] Setting "Living Room" to 22.0°C
[DEBUG] 🔄 [Bridge] Current temperature: 22.0°C, Target: 22.0°C
[WARN] ⚠️  [Bridge] Command has zero effect, REHAU may silently discard
[INFO] ⏳ [Bridge] Waiting for confirmation (timeout: 30s)...

// Case 1: Command accepted (temperature changed)
[INFO] ✅ [REHAU] Command confirmed: temperature changed to 22.0°C

// Case 2: Command silently discarded (no change)
[WARN] ⚠️  [REHAU] No response after 30s, command likely discarded (zero effect)
[INFO] 🔄 [Bridge] Marking command as "completed-no-change"

// Case 3: Command rejected (error)
[ERROR] ❌ [REHAU] Command rejected: Invalid temperature value
```

**Command Tracking**:
```typescript
interface CommandTracking {
  id: string;
  timestamp: number;
  zone: string;
  type: 'temperature' | 'mode' | 'preset';
  oldValue: any;
  newValue: any;
  isNoOp: boolean;  // true if oldValue === newValue
  status: 'pending' | 'confirmed' | 'timeout' | 'rejected' | 'no-change';
  confirmationTime?: number;
}
```

#### 1.5 Performance Logging
**Track operation timing with visual indicators**

```typescript
[INFO] ⚡ [Auth] Login completed in 1.2s
[INFO] 🐌 [REHAU] API call took 5.8s (slow!)
[INFO] ⚡ [MQTT] Message published in 12ms
[DEBUG] 🔍 [Performance] Average response time: 234ms
```

### Tasks

> **⚠️ TEST EACH TASK**: Mark [x] only after testing on real REHAU system!

- [x] Create enhanced logger with colors (chalk/ansi-colors)
  - ✅ Tested: Colors work (emojis display correctly)
  - ✅ Tested: Logs are readable
  - ✅ Committed: `feat(logging): add enhanced logger`
  
- [x] Add emoji support for all log types
  - ✅ Tested: Emojis display correctly (🔐, 🚀, 📊, ⏭️, 📦, 📤, ⏱️, 📨, ✅, 🔌)
  - ✅ Tested: Works on Windows terminal
  
- [ ] Implement directional indicators (⬆️⬇️🔄)
  - ⚠️ Code written but not yet integrated into existing files
  - **TODO**: Update MQTT bridge to use logger context
  - **TODO**: Update climate controller to use logger context
  - **TODO**: Update rehau-auth to use logger context
  
- [x] Add component-specific emojis
  - ✅ Tested: Each component has correct emoji
  - ✅ Tested: Logs are easy to scan visually
  
- [ ] Implement shareable mode with obfuscation
  - ✅ Code written
  - **TODO**: Test export shareable logs
  - **TODO**: Verify personal info is hidden
  - **TODO**: Verify technical info is preserved
  
- [x] Add command tracking system
  - ✅ Tested: Commands are tracked
  - ✅ Tested: Saw "Command confirmed" messages in logs
  - ✅ Tested: Tracking survives during operation
  
- [ ] Implement zero-effect detection
  - ✅ Code written
  - **TODO**: Test by sending same temperature twice
  - **TODO**: Verify detection of no-op command
  - **TODO**: Check warning appears in logs
  
- [ ] Add timeout-based completion detection
  - ✅ Code written
  - **TODO**: Test by sending command and waiting for timeout
  - **TODO**: Verify timeout detection works
  - **TODO**: Check command marked as "no-change"
  
- [ ] Create performance timing logger
  - ✅ Code written
  - **TODO**: Verify timing is accurate
  - **TODO**: Check slow operation warnings (>5s)
  - **TODO**: Verify fast operation indicators (<1s)
  
- [ ] Add log export (both modes)
  - **TODO**: Implement export API endpoint
  - **TODO**: Test export normal logs to file
  - **TODO**: Test export shareable logs to file
  - **TODO**: Verify file format is correct

### Files to Create/Modify
```
src/logging/
├── enhanced-logger.ts       # Main logger with colors/emojis
├── log-formatter.ts         # Format logs with colors
├── log-sanitizer.ts         # Obfuscation for shareable mode
├── command-tracker.ts       # Track command completion
├── performance-tracker.ts   # Track operation timing
├── log-exporter.ts          # Export logs
└── log-stream.ts            # WebSocket log streaming

src/types.ts                 # Add CommandTracking interface
```

### Success Criteria
- [ ] All logs show direction (⬆️⬇️🔄)
- [ ] Colors and emojis work in terminal
- [ ] Shareable mode properly obfuscates
- [ ] Command tracking detects zero-effect commands
- [ ] Performance timing visible for slow operations
- [ ] Logs are fun and easy to read!

### Roadmap Update After Round 1
```
## Round 1 Completion: 2026-02-22

### What Worked ✅
- Enhanced logger with colors and emojis works perfectly
- Emojis display correctly in Windows terminal
- Real room names showing (no obfuscation by default)
- Command tracking system operational
- Bridge still works with all existing features
- Authentication successful
- MQTT communication working
- Commands confirmed successfully

### What Didn't Work ❌
- Directional indicators not yet integrated (code written but not used)
- Need to update existing files to use new logger context
- Shareable mode not yet tested
- Zero-effect detection not yet tested
- Performance timing not yet visible in logs

### Adjustments Needed 🔧
- Need to update MQTT bridge, climate controller, and rehau-auth to use new logger with context
- Need to add API endpoints for log export
- Need to test zero-effect detection with real commands
- Need to test shareable mode export

### Next Steps ➡️
- Complete directional indicator integration
- Test remaining logging features
- Move to Priority 2: REST API Foundation

### Metrics 📊
- Build time: < 5s ✅
- Bridge startup: ~40s (authentication) ✅
- Memory usage: Not measured yet
- All existing features working: ✅
- Test coverage: Manual testing only
```

---

## PRIORITY 2: REST API Foundation (Week 2-3) 🚀

### Goal
Complete REST API for all REHAU operations with Swagger documentation

### Requirements

#### 2.1 Single User Authentication
**Simple JWT-based auth with credentials from .env**

```typescript
// .env configuration
API_USERNAME=admin
API_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret

// Login endpoint
POST /api/v1/auth/login
{
  "username": "admin",
  "password": "your-secure-password"
}

Response:
{
  "token": "eyJhbGc...",
  "expiresIn": 86400
}

// All other endpoints require:
Authorization: Bearer eyJhbGc...
```

**No multi-user support needed** - Single admin user only

#### 2.2 API Architecture

#### 2.2 API Architecture
**Express.js with TypeScript, versioned, fully documented**

**API Endpoints**:
```
Authentication (Single User):
POST   /api/v1/auth/login          # Get JWT token
POST   /api/v1/auth/refresh        # Refresh token
GET    /api/v1/auth/status         # Check if token valid

Installations:
GET    /api/v1/installations       # List all installations
GET    /api/v1/installations/:id   # Get installation details
GET    /api/v1/installations/:id/zones  # Get zones for installation

Zones:
GET    /api/v1/zones               # List all zones
GET    /api/v1/zones/:id           # Get zone details
PUT    /api/v1/zones/:id/temperature  # Set temperature
PUT    /api/v1/zones/:id/mode      # Set mode (heat/cool/off)
PUT    /api/v1/zones/:id/preset    # Set preset (comfort/away)
PUT    /api/v1/zones/:id/ring-light  # Control ring light
PUT    /api/v1/zones/:id/lock      # Lock/unlock zone

Live Data:
GET    /api/v1/live/installations/:id  # Real-time installation data
GET    /api/v1/live/zones/:id      # Real-time zone data
WS     /api/v1/live/stream         # WebSocket for live updates

Status & Monitoring:
GET    /api/v1/status/system       # System health
GET    /api/v1/status/mqtt         # MQTT status
GET    /api/v1/status/rehau        # REHAU connection status
GET    /api/v1/status/metrics      # Performance metrics

Logs:
GET    /api/v1/logs                # Get recent logs (normal mode)
GET    /api/v1/logs?mode=shareable # Get shareable logs
POST   /api/v1/logs/export         # Download logs
WS     /api/v1/logs/stream         # Live log streaming

Settings (REHAU):
GET    /api/v1/settings/rehau      # Get REHAU settings
PUT    /api/v1/settings/rehau      # Update REHAU settings
GET    /api/v1/settings/schedules/:zoneId  # Get zone schedule
PUT    /api/v1/settings/schedules/:zoneId  # Update schedule
```

#### 2.3 Swagger Documentation
**Auto-generated, interactive API docs**

- OpenAPI 3.0 specification
- Interactive testing interface
- Request/response examples
- Authentication flows documented
- Available at: `http://addon-ip:3000/api-docs`

### Tasks
- [ ] Set up Express.js with TypeScript
- [ ] Implement JWT authentication (single user)
- [ ] Create all API endpoints
- [ ] Add Swagger/OpenAPI documentation
- [ ] Implement WebSocket for live updates
- [ ] Add request/response validation
- [ ] Add error handling middleware
- [ ] Connect API to existing REHAU/MQTT logic
- [ ] Add rate limiting
- [ ] Add CORS configuration

### Files to Create
```
src/api/
├── server.ts                 # Express server
├── middleware/
│   ├── auth.ts              # JWT authentication
│   ├── error-handler.ts     # Error handling
│   ├── rate-limiter.ts      # Rate limiting
│   └── cors.ts              # CORS config
├── routes/
│   ├── auth.routes.ts
│   ├── installations.routes.ts
│   ├── zones.routes.ts
│   ├── live.routes.ts
│   ├── status.routes.ts
│   ├── logs.routes.ts
│   └── settings.routes.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── installations.controller.ts
│   ├── zones.controller.ts
│   ├── live.controller.ts
│   ├── status.controller.ts
│   ├── logs.controller.ts
│   └── settings.controller.ts
├── dto/                     # Data Transfer Objects
└── swagger/
    └── swagger.config.ts
```

### Success Criteria
- [ ] All endpoints working and documented
- [ ] Swagger UI accessible and complete
- [ ] JWT authentication working
- [ ] WebSocket live updates working
- [ ] API doesn't interfere with MQTT bridge
- [ ] Rate limiting prevents abuse

### Roadmap Update After Round 2
```
## Round 2 Completion: [DATE]

### What Worked
- [List successes]

### What Didn't Work
- [List issues]

### Adjustments Needed
- [List changes to plan]

### Next Steps
- [Updated priorities]
```

---

## PRIORITY 3: Mobile-First Web Interface (Week 4-6) 📱

### Goal
Beautiful, mobile-first React web interface that feels like a native app

### Requirements

#### 3.1 React Project Setup
**Modern React with TypeScript, mobile-optimized**

**Tech Stack**:
- React 18+ with TypeScript
- Vite (fast builds)
- Material-UI or Chakra UI (mobile-first)
- React Router v6
- Zustand (state management)
- React Query (API caching)
- Socket.io-client (real-time)

**Project Structure**:
```
web-ui/
├── src/
│   ├── api/                 # API client
│   ├── components/
│   │   ├── common/          # Reusable components
│   │   ├── zones/           # Zone components
│   │   └── layout/          # Layout components
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── ZoneDetail.tsx
│   │   ├── Settings.tsx
│   │   ├── Logs.tsx
│   │   └── Login.tsx
│   ├── hooks/               # Custom hooks
│   ├── store/               # Zustand store
│   ├── types/               # TypeScript types
│   └── utils/
├── public/
└── package.json
```

#### 3.2 Pages & Features

**1. Login Page** (`/login`)
- Simple username/password form
- Remember me checkbox
- JWT token storage
- Redirect to dashboard on success

**2. Dashboard** (`/`)
- List of all installations
- Zone cards with current temperature
- Quick status indicators
- Pull-to-refresh
- Bottom navigation

**3. Zone Control** (`/zone/:id`)
- Large temperature display
- Temperature slider (mobile-friendly)
- Mode buttons (heat/cool/off)
- Preset buttons (comfort/away)
- Ring light toggle
- Lock toggle
- Current humidity
- Last update timestamp
- Real-time updates

**4. Logs Viewer** (`/logs`)
- Live log streaming
- Filter by level
- Filter by component
- Search logs
- Toggle normal/shareable mode
- Download logs button
- Colorful display with emojis

**5. Settings** (`/settings`)
- System status
- Connection info
- About/version
- Logout button

#### 3.3 Mobile App Features
**Native app experience**

- PWA (add to home screen)
- Bottom navigation
- Large touch targets (44x44px min)
- Swipe gestures
- Pull-to-refresh
- Haptic feedback
- Dark mode
- Offline indicator
- Loading states
- Optimistic updates

#### 3.4 Real-time Updates
**WebSocket integration**

- Live temperature updates
- Live status changes
- Live log streaming
- Connection status indicator
- Auto-reconnect

### Tasks
- [ ] Create React project with Vite
- [ ] Set up routing and navigation
- [ ] Implement authentication flow
- [ ] Create Dashboard page
- [ ] Create Zone Control page
- [ ] Create Logs Viewer page
- [ ] Create Settings page
- [ ] Implement WebSocket integration
- [ ] Add PWA support
- [ ] Add dark mode
- [ ] Optimize for mobile
- [ ] Test on iOS/Android devices

### Files to Create
```
web-ui/src/
├── api/client.ts
├── components/
│   ├── ZoneCard.tsx
│   ├── TemperatureSlider.tsx
│   ├── LogViewer.tsx
│   └── BottomNav.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── ZoneDetail.tsx
│   ├── Logs.tsx
│   ├── Settings.tsx
│   └── Login.tsx
├── hooks/
│   ├── useWebSocket.ts
│   ├── useZoneData.ts
│   └── useAuth.ts
└── store/
    └── auth.store.ts
```

### Success Criteria
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Feels like native app
- [ ] Real-time updates < 2s latency
- [ ] PWA installable
- [ ] Dark mode working
- [ ] All features accessible on mobile

### Roadmap Update After Round 3
```
## Round 3 Completion: [DATE]

### What Worked
- [List successes]

### What Didn't Work
- [List issues]

### Adjustments Needed
- [List changes to plan]

### Next Steps
- [Updated priorities]
```

---

## PRIORITY 4: Playwright Optimization (Week 7) ⚡

### Goal
Reduce Playwright resource usage and increase speed

### Current Issues
- Playwright keeps browser running
- High memory usage
- Slow authentication
- Browser not closed when idle

### Optimization Strategy

#### 4.1 Lazy Browser Initialization
**Only start browser when needed**

```typescript
class OptimizedPlaywrightClient {
  private browser?: Browser;
  private context?: BrowserContext;
  private lastUsed: number = 0;
  private idleTimeout = 5 * 60 * 1000; // 5 minutes
  
  async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      logger.info('🎭 ⬆️  [Playwright] Starting browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });
    }
    this.lastUsed = Date.now();
    return this.browser;
  }
  
  async closeBrowserIfIdle(): Promise<void> {
    if (this.browser && Date.now() - this.lastUsed > this.idleTimeout) {
      logger.info('🎭 ⬇️  [Playwright] Closing idle browser');
      await this.browser.close();
      this.browser = undefined;
      this.context = undefined;
    }
  }
}
```

#### 4.2 Browser Lifecycle Management
**Close browser when not needed**

- Start browser only for authentication
- Close browser after successful auth
- Reuse browser context when possible
- Implement idle timeout (5 minutes)
- Monitor memory usage

#### 4.3 Optimized Browser Settings
**Reduce resource usage**

```typescript
const browserOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-hang-monitor',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--metrics-recording-only',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
    '--mute-audio',
    '--disable-sync'
  ]
};
```

#### 4.4 Page Optimization
**Faster page loads**

```typescript
// Block unnecessary resources
await page.route('**/*', (route) => {
  const resourceType = route.request().resourceType();
  if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
    route.abort();
  } else {
    route.continue();
  }
});

// Set shorter timeouts
page.setDefaultTimeout(30000); // 30s instead of default 60s
```

#### 4.5 Smart Authentication Caching
**Avoid unnecessary browser launches**

- Cache valid tokens longer
- Validate tokens before launching browser
- Only use Playwright when tokens expired
- Implement token refresh without browser

### Tasks
- [ ] Implement lazy browser initialization
- [ ] Add idle timeout and auto-close
- [ ] Optimize browser launch options
- [ ] Block unnecessary resources
- [ ] Reduce page timeouts
- [ ] Implement smart token caching
- [ ] Add memory monitoring
- [ ] Test on Raspberry Pi

### Files to Modify
```
src/playwright-https-client.ts  # Main optimization
src/rehau-auth.ts               # Smart caching
src/monitoring/
└── resource-monitor.ts         # Memory monitoring
```

### Success Criteria
- [ ] Browser closes after 5 min idle
- [ ] Memory usage < 100MB when idle
- [ ] Authentication < 10 seconds
- [ ] Works reliably on Pi 3B+
- [ ] No memory leaks over 24 hours

### Roadmap Update After Round 4
```
## Round 4 Completion: [DATE]

### What Worked
- [List successes]

### What Didn't Work
- [List issues]

### Adjustments Needed
- [List changes to plan]

### Next Steps
- [Updated priorities]
```

---

## PRIORITY 5: Enhanced HA Status Reporting (Week 8) 📊

---

## PRIORITY 5: Enhanced HA Status Reporting (Week 8) 📊

### Goal
Rich status information in Home Assistant with stale detection

### Requirements

#### 5.1 Comprehensive Status Sensors
**New MQTT sensors for HA**

```
homeassistant/sensor/rehau_bridge_status/config
homeassistant/sensor/rehau_bridge_status/state
  → Values: connected | authenticating | error | degraded

homeassistant/sensor/rehau_auth_status/config
homeassistant/sensor/rehau_auth_status/state
  → Values: authenticated | expired | refreshing | failed

homeassistant/sensor/rehau_mqtt_quality/config
homeassistant/sensor/rehau_mqtt_quality/state
  → Values: excellent | good | poor | disconnected

homeassistant/sensor/rehau_session_age/config
homeassistant/sensor/rehau_session_age/state
  → Value: seconds since last authentication

homeassistant/sensor/rehau_zone_{id}_last_update/config
homeassistant/sensor/rehau_zone_{id}_last_update/state
  → Value: timestamp of last update

homeassistant/sensor/rehau_zone_{id}_stale/config
homeassistant/sensor/rehau_zone_{id}_stale/state
  → Values: fresh | stale | very_stale
```

#### 5.2 Stale Status Detection
**Detect when data becomes outdated**

```typescript
interface StalenessConfig {
  warningThreshold: number;  // 10 minutes
  staleThreshold: number;    // 30 minutes
}

class StalenessDetector {
  checkZoneFreshness(zone: Zone): 'fresh' | 'stale' | 'very_stale' {
    const age = Date.now() - zone.lastUpdate;
    
    if (age < this.config.warningThreshold) {
      return 'fresh';
    } else if (age < this.config.staleThreshold) {
      logger.warn(`⚠️  [Zone] "${zone.name}" data is stale (${age}ms old)`);
      return 'stale';
    } else {
      logger.error(`❌ [Zone] "${zone.name}" data is very stale (${age}ms old)`);
      this.triggerRefresh(zone);
      return 'very_stale';
    }
  }
}
```

### Tasks
- [ ] Create status publisher for HA
- [ ] Implement stale detection
- [ ] Add auto-refresh on stale detection
- [ ] Create diagnostic sensors
- [ ] Add session age tracking
- [ ] Publish all status to MQTT

### Files to Create
```
src/ha-integration/
├── status-publisher.ts
├── staleness-detector.ts
└── diagnostics.ts
```

### Success Criteria
- [ ] All status sensors in HA
- [ ] Stale detection working
- [ ] Auto-refresh triggered
- [ ] Status updates < 1 minute

### Roadmap Update After Round 5
```
## Round 5 Completion: [DATE]

### What Worked
- [List successes]

### What Didn't Work
- [List issues]

### Adjustments Needed
- [List changes to plan]

### Next Steps
- [Updated priorities]
```

---

## PRIORITY 6: OAuth2 POP3 Authentication (Week 9) 🔐

### Goal
Support modern email providers with OAuth2 and reduce re-authentication

### Requirements

#### 6.1 OAuth2 Implementation
**Support Gmail, Outlook with OAuth2**

```typescript
interface OAuth2Config {
  provider: 'gmail' | 'outlook' | 'custom';
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

class OAuth2POP3Client {
  async getAccessToken(): Promise<string> {
    // Refresh OAuth2 token
    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });
    
    const data = await response.json();
    return data.access_token;
  }
  
  async connectPOP3(): Promise<void> {
    const accessToken = await this.getAccessToken();
    // Use XOAUTH2 authentication
    await this.pop3.auth('XOAUTH2', accessToken);
  }
}
```

#### 6.2 Persistent Session Management
**Reduce 2FA prompts**

```typescript
class SessionManager {
  async saveSession(tokens: RehauTokens): Promise<void> {
    // Encrypt and save to disk
    const encrypted = this.encrypt(JSON.stringify(tokens));
    await fs.writeFile(this.sessionFile, encrypted);
    
    logger.info('💾 [Session] Tokens saved to disk');
  }
  
  async loadSession(): Promise<RehauTokens | null> {
    try {
      const encrypted = await fs.readFile(this.sessionFile);
      const decrypted = this.decrypt(encrypted);
      const tokens = JSON.parse(decrypted);
      
      if (this.isTokenValid(tokens)) {
        logger.info('✅ [Session] Restored valid session from disk');
        return tokens;
      }
    } catch (error) {
      logger.warn('⚠️  [Session] No valid session found');
    }
    return null;
  }
  
  async refreshTokenProactively(): Promise<void> {
    // Refresh 1 hour before expiry
    const timeUntilExpiry = this.tokens.expiresAt - Date.now();
    if (timeUntilExpiry < 3600000) {
      logger.info('🔄 [Session] Proactively refreshing token');
      await this.refreshToken();
    }
  }
}
```

**Target**: Reduce 2FA from daily to weekly or less

### Tasks
- [ ] Implement OAuth2 for Gmail
- [ ] Implement OAuth2 for Outlook
- [ ] Add persistent session storage
- [ ] Implement proactive token refresh
- [ ] Add token validation without re-auth
- [ ] Create OAuth2 setup wizard in web UI
- [ ] Test with real Gmail/Outlook accounts

### Files to Create
```
src/auth/
├── oauth2/
│   ├── gmail-provider.ts
│   ├── outlook-provider.ts
│   └── token-manager.ts
├── session-manager.ts
├── token-storage.ts
└── pop3-oauth2-client.ts
```

### Success Criteria
- [ ] OAuth2 working with Gmail
- [ ] OAuth2 working with Outlook
- [ ] Sessions persist across restarts
- [ ] 2FA prompts < 1 per week
- [ ] Tokens refresh automatically

### Roadmap Update After Round 6
```
## Round 6 Completion: [DATE]

### What Worked
- [List successes]

### What Didn't Work
- [List issues]

### Adjustments Needed
- [List changes to plan]

### Next Steps
- [Updated priorities]
```

---

## Integration & Testing (Week 10) 🧪

### Goal
Ensure everything works together without breaking existing functionality

### Testing Strategy

#### Integration Tests
- [ ] Test API with existing MQTT bridge
- [ ] Test web UI with real REHAU system
- [ ] Test OAuth2 with real email accounts
- [ ] Test on Raspberry Pi 3B+
- [ ] Test on Raspberry Pi 4
- [ ] Test 24-hour stability
- [ ] Test memory usage over time

#### Regression Tests
- [ ] Verify MQTT bridge still works
- [ ] Verify HA discovery still works
- [ ] Verify all existing features work
- [ ] Verify authentication still works
- [ ] Test with multiple installations

#### Performance Tests
- [ ] Measure API response times
- [ ] Measure WebSocket latency
- [ ] Measure memory usage
- [ ] Measure CPU usage
- [ ] Test on minimum spec hardware

### Success Criteria
- [ ] All existing features work
- [ ] No memory leaks
- [ ] Stable for 24+ hours
- [ ] Works on Pi 3B+
- [ ] API response < 500ms
- [ ] WebSocket latency < 2s

---

## Deployment & Release (Week 11) 🚀

### Docker Configuration

**Updated Dockerfile**:
```dockerfile
# Build web UI
FROM node:20-alpine as web-builder
WORKDIR /web-ui
COPY web-ui/package*.json ./
RUN npm ci
COPY web-ui/ ./
RUN npm run build

# Build backend
FROM node:20-alpine as backend-builder
WORKDIR /app
COPY rehau-nea-smart-mqtt-bridge/package*.json ./
RUN npm ci
COPY rehau-nea-smart-mqtt-bridge/ ./
RUN npm run build

# Final image
FROM node:20-alpine
WORKDIR /app

# Install Chromium
RUN apk add --no-cache chromium

# Copy built files
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=web-builder /web-ui/dist ./web-ui/dist

CMD ["node", "dist/index.js"]
```

### Home Assistant Addon

**Updated config.yaml**:
```yaml
name: REHAU NEA SMART 2.0 MQTT Bridge
version: "5.0.0"
slug: rehau_nea_smart_mqtt
description: Full-featured REHAU control platform with API and web interface

ingress: true
ingress_port: 3000
panel_icon: mdi:radiator

options:
  # Existing options...
  api_enabled: true
  api_username: "admin"
  api_password: ""
  web_ui_enabled: true
  log_colorful: true
  log_emojis: true
  staleness_threshold: 600
  playwright_idle_timeout: 300
  session_persistence: true
  pop3_auth_type: "basic"
  pop3_oauth2_provider: ""
```

### Documentation

- [ ] Update README with new features
- [ ] Create API documentation
- [ ] Create web UI user guide
- [ ] Create OAuth2 setup guide
- [ ] Update troubleshooting guide
- [ ] Create video tutorials
- [ ] Update CHANGELOG

### Release Checklist

- [ ] All tests passing
- [ ] Documentation complete
- [ ] CHANGELOG updated
- [ ] Version bumped to 5.0.0
- [ ] Migration guide created
- [ ] Beta testing complete
- [ ] Screenshots updated
- [ ] Demo video created

---

## Success Metrics

### Technical
- [ ] 🎨 Logs are colorful and fun
- [ ] 🚀 API fully functional and documented
- [ ] 📱 Web UI works on mobile
- [ ] ⚡ Playwright optimized (< 100MB idle)
- [ ] 📊 HA status sensors working
- [ ] 🔐 OAuth2 working with Gmail/Outlook
- [ ] 🔄 2FA prompts < 1 per week
- [ ] ✅ All existing features still work

### User Experience
- [ ] Setup is straightforward
- [ ] Logs are easy to read
- [ ] Web UI feels native
- [ ] Status visible in HA
- [ ] Reduced authentication friction

### Performance
- [ ] Memory < 150MB on Pi 3B+
- [ ] API response < 500ms
- [ ] WebSocket latency < 2s
- [ ] Stable for 7+ days
- [ ] No memory leaks

---

## Risk Mitigation

### Risk: Breaking existing functionality
**Mitigation**: 
- Work on feature branch
- Extensive testing before merge
- Beta period with rollback option
- Keep v4.x branch maintained

### Risk: OAuth2 complexity
**Mitigation**:
- Start with Gmail (most common)
- Keep basic auth as fallback
- Detailed setup wizard
- Video tutorials

### Risk: Web UI performance on Pi
**Mitigation**:
- Optimize bundle size
- Test on Pi 3B+ early
- Use production builds
- Lazy load routes

### Risk: Playwright resource usage
**Mitigation**:
- Implement idle timeout
- Monitor memory continuously
- Test on minimum spec hardware
- Add resource limits

---

## Post-Release Roadmap

### v5.1 (Future)
- React Native mobile app
- Advanced scheduling UI
- Energy monitoring
- Push notifications

### v5.2 (Future)
- GraphQL API option
- Advanced analytics
- Backup/restore via UI
- Theme customization

---

## Final Notes

This roadmap is a **living document**. After each development round:

1. ✅ Update completion status
2. ✅ Document what worked/didn't work
3. ✅ Adjust timeline if needed
4. ✅ Update priorities based on learnings
5. ✅ Commit changes to feature branch

**Remember**: All work on `feature/v5-enhancements` branch!

**Have fun!** This is a FUN project - use colors, emojis, and make it enjoyable! 🎉

**Tasks**:
- [ ] Create bridge status sensor (connected/authenticating/error/degraded)
- [ ] Add last successful update timestamp per zone
- [ ] Add authentication status sensor
- [ ] Add MQTT connection quality sensor
- [ ] Add API availability sensor
- [ ] Create diagnostic sensors for each installation
- [ ] Add error count sensors
- [ ] Add session age sensor (time since last auth)

**New MQTT Topics**:
```
homeassistant/sensor/rehau_bridge_status/config
homeassistant/sensor/rehau_bridge_status/state

homeassistant/sensor/rehau_auth_status/config
homeassistant/sensor/rehau_auth_status/state

homeassistant/sensor/rehau_mqtt_quality/config
homeassistant/sensor/rehau_mqtt_quality/state

homeassistant/sensor/rehau_session_age/config
homeassistant/sensor/rehau_session_age/state

homeassistant/sensor/rehau_zone_{id}_last_update/config
homeassistant/sensor/rehau_zone_{id}_last_update/state

homeassistant/sensor/rehau_installation_{id}_status/config
homeassistant/sensor/rehau_installation_{id}_status/state
```

**Files to create**:
```
src/ha-integration/
├── status-publisher.ts      # Publish status to HA
├── sensor-factory.ts        # Create HA sensor configs
└── diagnostics.ts           # Diagnostic data collection
```

### 2.2 Stale Status Detection
**Goal**: Detect and report when data becomes stale

**Tasks**:
- [ ] Track last update time per zone
- [ ] Implement configurable staleness threshold (default 10 minutes)
- [ ] Mark zones as "stale" in HA when threshold exceeded
- [ ] Trigger automatic refresh when stale detected
- [ ] Add stale status to API responses
- [ ] Log staleness events for debugging

**Files to create**:
```
src/monitoring/
├── staleness-detector.ts    # Detect stale data
└── auto-refresh.ts          # Trigger refreshes
```

### 2.3 Enhanced Logging with Privacy Controls
**Goal**: Readable logs for debugging + shareable logs for support

**Current Problem**: 
- Logs obfuscate room names for privacy
- Makes debugging difficult for users
- Hard to understand what's happening

**Solution**: Dual logging modes

**Tasks**:
- [ ] **Default mode**: Show real room names, emails, installation names
- [ ] **Shareable mode**: Obfuscate personal info for sharing
- [ ] Add "Export Shareable Logs" feature (API + Web UI)
- [ ] Structured logging with context (zone name, installation, operation)
- [ ] Create log levels: error, warn, info, debug, trace
- [ ] Add operation tracking (auth, zone update, MQTT publish)
- [ ] Log performance metrics (API response times, auth duration)
- [ ] Add log viewer in web UI with filtering
- [ ] Add log download (both modes)

**Logging Strategy**:

**Normal Logs** (for user debugging):
```
[INFO] Zone "Living Room" temperature updated: 21.5°C → 22.0°C
[INFO] Installation "Home" connected successfully
[DEBUG] MQTT publish: rehau/home_living_room/temperature/state = 22.0
[INFO] User john@example.com authenticated successfully
```

**Shareable Logs** (for support/GitHub issues):
```
[INFO] Zone "Zone_A" temperature updated: 21.5°C → 22.0°C
[INFO] Installation "Install_1" connected successfully
[DEBUG] MQTT publish: rehau/install1_zonea/temperature/state = 22.0
[INFO] User j***@e***.com authenticated successfully
```

**Obfuscation Rules for Shareable Mode**:
- Room names → Zone_A, Zone_B, Zone_C...
- Installation names → Install_1, Install_2...
- Email addresses → First letter + *** + @ + first letter + ***.com
- Installation IDs → hash to consistent ID (same install = same hash)
- IP addresses → 192.168.x.x
- Keep: temperatures, modes, error messages, timestamps

**Files to create**:
```
src/logging/
├── logger.ts               # Enhanced logger
├── log-context.ts          # Contextual logging
├── performance-logger.ts   # Performance tracking
├── log-sanitizer.ts        # Obfuscation for sharing
├── log-exporter.ts         # Export logs via API
└── log-viewer.ts           # Web UI log viewer
```

**API Endpoints**:
```
GET  /api/v1/logs                    # Get recent logs (normal mode)
GET  /api/v1/logs/shareable          # Get obfuscated logs
POST /api/v1/logs/export             # Download logs as file
POST /api/v1/logs/export/shareable   # Download shareable logs
GET  /api/v1/logs/stream             # WebSocket for live logs
```

**Web UI Features**:
- Live log viewer with auto-scroll
- Filter by level (error, warn, info, debug)
- Filter by component (auth, mqtt, zones, api)
- Search logs
- Download logs button
- **"Share Logs" button** → downloads obfuscated version
- Clear indication when viewing shareable mode

**Configuration**:
```yaml
log_level: "info"              # error, warn, info, debug, trace
log_format: "simple"           # simple, json
log_show_real_names: true      # false = always obfuscate (not recommended)
log_max_size: "10m"            # Max log file size
log_max_files: 5               # Number of rotated logs to keep
```

---

## Phase 3: OAuth2 POP3 Authentication (Week 4)

### 3.1 OAuth2 POP3 Implementation
**Goal**: Support modern email providers (Gmail, Outlook, etc.)

**Tasks**:
- [ ] Research OAuth2 flows for Gmail/Outlook POP3
- [ ] Implement OAuth2 token acquisition flow
- [ ] Add OAuth2 token refresh logic
- [ ] Support both basic auth and OAuth2
- [ ] Add provider-specific configurations
- [ ] Store OAuth2 tokens securely
- [ ] Add OAuth2 setup wizard in web UI

**Supported Providers**:
- Gmail (OAuth2)
- Outlook/Office365 (OAuth2)
- GMX (Basic Auth - existing)
- Generic POP3 (Basic Auth)

**Files to create**:
```
src/auth/
├── oauth2/
│   ├── oauth2-provider.ts   # Base OAuth2 provider
│   ├── gmail-provider.ts    # Gmail-specific
│   ├── outlook-provider.ts  # Outlook-specific
│   └── token-manager.ts     # Token storage/refresh
└── pop3-oauth2-client.ts    # POP3 with OAuth2
```

**Configuration additions**:
```yaml
pop3_auth_type: "basic" | "oauth2"
pop3_oauth2_provider: "gmail" | "outlook" | "custom"
pop3_oauth2_client_id: ""
pop3_oauth2_client_secret: ""
pop3_oauth2_refresh_token: ""
```

### 3.2 Reduced Re-authentication
**Goal**: Minimize 2FA prompts by maximizing session lifetime

**Tasks**:
- [ ] Implement persistent session storage
- [ ] Store REHAU tokens in encrypted file
- [ ] Implement proactive token refresh (before expiry)
- [ ] Add token validity checking without full auth
- [ ] Cache successful authentication state
- [ ] Implement "remember me" functionality
- [ ] Add session restoration on restart
- [ ] Monitor token expiry and refresh automatically

**Session Management Strategy**:
1. Store tokens encrypted on disk
2. Refresh tokens 1 hour before expiry
3. Validate tokens on startup (avoid unnecessary auth)
4. Only trigger 2FA when tokens truly expired
5. Cache 2FA codes for 5 minutes (in case of retry)

**Files to create**:
```
src/auth/
├── session-manager.ts       # Persistent sessions
├── token-storage.ts         # Encrypted token storage
└── token-validator.ts       # Validate without re-auth
```

**Target**: Reduce 2FA prompts from daily to weekly or less

---

## Phase 4: Mobile-First Web Interface (Week 5-7)

### 4.1 React Project Setup
**Goal**: Modern React app with mobile-first design

**Tasks**:
- [ ] Create React app with TypeScript
- [ ] Set up Vite for fast development
- [ ] Configure for React Native compatibility
- [ ] Add Material-UI or Chakra UI (mobile-optimized)
- [ ] Set up React Router for navigation
- [ ] Configure API client (axios/fetch)
- [ ] Add state management (Zustand or Context)
- [ ] Set up PWA capabilities

**Project Structure**:
```
web-ui/
├── src/
│   ├── api/
│   │   ├── client.ts        # API client setup
│   │   ├── auth.api.ts      # Auth endpoints
│   │   ├── zones.api.ts     # Zone endpoints
│   │   └── installations.api.ts
│   ├── components/
│   │   ├── common/          # Reusable components
│   │   ├── zones/           # Zone-specific components
│   │   └── installations/   # Installation components
│   ├── pages/
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── ZoneDetail.tsx   # Zone control page
│   │   ├── Settings.tsx     # Settings page
│   │   └── Login.tsx        # Login page
│   ├── hooks/               # Custom React hooks
│   ├── store/               # State management
│   ├── types/               # TypeScript types
│   └── utils/               # Utilities
├── public/
└── package.json
```

**Tech Stack**:
- React 18+ with TypeScript
- Vite (fast builds, HMR)
- Material-UI or Chakra UI (mobile-first)
- React Router v6
- Zustand (lightweight state)
- React Query (API caching)
- Socket.io-client (real-time updates)

### 4.2 Core UI Components
**Goal**: Mobile app-like interface

**Pages to implement**:

**1. Dashboard** (`/`)
- List of all installations
- Quick status overview
- Current temperatures
- Active alerts/warnings
- Quick actions (all zones off, all comfort mode)

**2. Installation View** (`/installation/:id`)
- Installation details
- List of zones with current status
- Outside temperature
- System mode (heat/cool)
- Live data visualization

**3. Zone Control** (`/zone/:id`)
- Large temperature display
- Temperature slider (mobile-friendly)
- Mode selector (heat/cool/off)
- Preset buttons (comfort/away)
- Ring light toggle
- Lock toggle
- Current humidity
- Demand indicator
- Last update timestamp
- Historical graph (optional)

**4. Settings** (`/settings`)
- REHAU account settings
- POP3/OAuth2 configuration
- MQTT settings
- Notification preferences
- About/version info

**5. Status** (`/status`)
- System health
- Connection status
- Recent errors
- Performance metrics
- Logs viewer

**Design Requirements**:
- Bottom navigation (mobile pattern)
- Large touch targets (min 44x44px)
- Swipe gestures for navigation
- Pull-to-refresh
- Haptic feedback (when available)
- Dark mode support
- Responsive (works on tablet too)
- Offline indicator
- Loading states
- Error boundaries

### 4.3 Real-time Updates
**Goal**: Live data without page refresh

**Tasks**:
- [ ] Implement WebSocket connection to API
- [ ] Subscribe to zone updates
- [ ] Update UI in real-time when MQTT messages arrive
- [ ] Show connection status indicator
- [ ] Handle reconnection gracefully
- [ ] Add optimistic UI updates
- [ ] Implement pull-to-refresh

**Files to create**:
```
web-ui/src/
├── hooks/
│   ├── useWebSocket.ts      # WebSocket hook
│   ├── useZoneData.ts       # Zone data hook
│   └── useRealtime.ts       # Real-time updates
└── services/
    └── websocket.service.ts # WebSocket management
```

### 4.4 Mobile App Features
**Goal**: Native app experience in browser

**Tasks**:
- [ ] Add to home screen support (PWA)
- [ ] Implement service worker for offline support
- [ ] Add push notifications (when supported)
- [ ] Implement haptic feedback
- [ ] Add gesture controls (swipe, long-press)
- [ ] Optimize for mobile performance
- [ ] Add splash screen
- [ ] Implement app-like transitions

**PWA Configuration**:
```json
{
  "name": "REHAU Control",
  "short_name": "REHAU",
  "description": "Control your REHAU heating system",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1976d2",
  "background_color": "#ffffff",
  "icons": [...]
}
```

### 4.5 React Native Preparation
**Goal**: Code ready for React Native migration

**Guidelines**:
- Use React Native compatible components
- Avoid browser-specific APIs
- Use platform-agnostic styling
- Separate platform-specific code
- Use React Native compatible navigation
- Test with React Native Web

**Shared Code Structure**:
```
shared/
├── components/              # Platform-agnostic components
├── hooks/                   # Shared hooks
├── utils/                   # Shared utilities
└── types/                   # Shared types

web/                        # Web-specific
mobile/                     # React Native-specific (future)
```

---

## Phase 5: Integration & Testing (Week 8)

### 5.1 API Integration Testing
**Tasks**:
- [ ] Test all API endpoints
- [ ] Verify Swagger documentation accuracy
- [ ] Test WebSocket connections
- [ ] Load testing (multiple concurrent users)
- [ ] Test error scenarios
- [ ] Verify authentication flows

### 5.2 Web UI Testing
**Tasks**:
- [ ] Test on mobile devices (iOS/Android)
- [ ] Test on tablets
- [ ] Test on desktop browsers
- [ ] Test offline functionality
- [ ] Test real-time updates
- [ ] Test all user flows

### 5.3 Integration with Existing System
**Tasks**:
- [ ] Verify MQTT bridge still works
- [ ] Verify HA discovery still works
- [ ] Test that API doesn't interfere with MQTT
- [ ] Verify authentication doesn't break
- [ ] Test with real REHAU system
- [ ] Verify all existing features work

### 5.4 Documentation
**Tasks**:
- [ ] API documentation (Swagger)
- [ ] Web UI user guide
- [ ] OAuth2 setup guide
- [ ] Developer documentation
- [ ] Update README
- [ ] Create video tutorials

---

## Phase 6: Deployment & Polish (Week 9)

### 6.1 Docker Configuration
**Tasks**:
- [ ] Update Dockerfile for web UI
- [ ] Serve web UI from Express
- [ ] Configure nginx (if needed)
- [ ] Optimize build process
- [ ] Update docker-compose

**Dockerfile additions**:
```dockerfile
# Build web UI
FROM node:20-alpine as web-builder
WORKDIR /web-ui
COPY web-ui/package*.json ./
RUN npm ci
COPY web-ui/ ./
RUN npm run build

# Main image
FROM node:20-alpine
# ... existing setup ...
COPY --from=web-builder /web-ui/dist /app/web-ui/dist
```

### 6.2 Home Assistant Addon Configuration
**Tasks**:
- [ ] Update config.yaml with new options
- [ ] Add ingress support for web UI
- [ ] Update addon documentation
- [ ] Add screenshots
- [ ] Update version to 5.0.0

**New config options**:
```yaml
api_enabled: true
api_port: 3000
web_ui_enabled: true
pop3_auth_type: "basic"
pop3_oauth2_provider: ""
session_persistence: true
staleness_threshold: 600
```

### 6.3 Release Preparation
**Tasks**:
- [ ] Update CHANGELOG
- [ ] Create migration guide from v4.x
- [ ] Prepare release notes
- [ ] Create demo video
- [ ] Update screenshots
- [ ] Beta testing with community

---

## Implementation Order & Dependencies

### Critical Path:
1. **API Foundation** → Required for everything else
2. **Status Reporting** → Can be done in parallel with API
3. **OAuth2 POP3** → Independent, can be done anytime
4. **Web UI** → Depends on API being complete
5. **Integration Testing** → After all features complete

### Parallel Work Possible:
- API development + Status reporting
- OAuth2 implementation + Web UI design
- Documentation + Testing

---

## Success Criteria

### Technical:
- [ ] All API endpoints documented and working
- [ ] Web UI works on mobile (iOS/Android)
- [ ] OAuth2 POP3 works with Gmail/Outlook
- [ ] 2FA prompts reduced to < 1 per week
- [ ] Stale status detected within 1 minute
- [ ] Real-time updates < 2 second latency
- [ ] Existing MQTT/HA functionality unchanged

### User Experience:
- [ ] Web UI feels like native mobile app
- [ ] Setup process clear and documented
- [ ] Status visible in Home Assistant
- [ ] API usable by third-party tools
- [ ] Reduced authentication friction

### Code Quality:
- [ ] TypeScript strict mode
- [ ] API fully typed
- [ ] Swagger docs 100% accurate
- [ ] React components reusable
- [ ] Ready for React Native migration

---

## Risk Mitigation

### Risk: Breaking existing functionality
**Mitigation**: 
- Add features, don't modify existing code
- Extensive testing before release
- Beta period with rollback option
- Keep v4.x branch maintained

### Risk: OAuth2 complexity
**Mitigation**:
- Start with Gmail (most common)
- Keep basic auth as fallback
- Detailed setup documentation
- Setup wizard in web UI

### Risk: Web UI performance on Pi
**Mitigation**:
- Optimize bundle size
- Lazy load routes
- Use production builds
- Test on Pi 3B+ early

### Risk: API security
**Mitigation**:
- JWT authentication
- Rate limiting
- CORS configuration
- HTTPS recommended
- Security audit before release

---

## Post-Release Roadmap

### v5.1 (Future):
- React Native mobile app
- Advanced scheduling UI
- Energy monitoring
- Multi-user support
- Notification system

### v5.2 (Future):
- GraphQL API option
- Advanced analytics
- Backup/restore via UI
- Theme customization
- Widget support

---

## Notes

This plan transforms the bridge into a **complete REHAU control platform** while preserving all the hard-won reverse engineering work. The API-first approach ensures everything is accessible programmatically, and the mobile-first web UI provides direct control without relying on Home Assistant.

The OAuth2 POP3 implementation and session management will significantly reduce authentication friction, making the system truly "set and forget" for users.

### 1.1 Improve Configuration Management
**Goal**: Make setup errors obvious and fixable for non-technical users

**Tasks**:
- [ ] Create user-friendly configuration validator with clear error messages
- [ ] Add configuration examples for common scenarios
- [ ] Implement configuration migration helper for version upgrades
- [ ] Add startup configuration summary (what's enabled/disabled)

**Files to modify**:
- `src/config-validator.ts` - Enhance with better error messages
- `src/index.ts` - Add configuration summary on startup
- Create `src/config/examples.ts` - Common configuration patterns

**Example improvement**:
```typescript
// Before: "MQTT_HOST is required"
// After: "MQTT broker not configured. Set 'mqtt_host' to your MQTT broker address (usually 'core-mosquitto' for Home Assistant)"
```

### 1.2 Consolidate Parser Logic
**Goal**: Reduce code duplication and improve maintainability

**Tasks**:
- [ ] Merge v1 and v2 parsers into single adaptive parser
- [ ] Create parser factory pattern for different data formats
- [ ] Add parser version detection
- [ ] Improve parser error handling with fallbacks

**Files to modify**:
- `src/parsers/` - Consolidate into unified parser
- Create `src/parsers/parser-factory.ts`
- Create `src/parsers/adaptive-parser.ts`

### 1.3 Enhance Error Handling
**Goal**: Better error messages and recovery for common issues

**Tasks**:
- [ ] Create error classification system (user error vs system error)
- [ ] Add recovery suggestions to error messages
- [ ] Implement exponential backoff for retries
- [ ] Add error context (what was being attempted)

**Files to create**:
- `src/errors/error-types.ts` - Custom error classes
- `src/errors/error-handler.ts` - Centralized error handling
- `src/utils/retry.ts` - Smart retry logic

---

## Phase 2: Resource Optimization (Week 3)

### 2.1 Memory Optimization
**Goal**: Reduce memory footprint for Raspberry Pi deployments

**Tasks**:
- [ ] Implement simple LRU cache for API responses (max 100 entries)
- [ ] Add memory monitoring and warnings
- [ ] Optimize Playwright browser lifecycle (close when not needed)
- [ ] Stream large responses instead of loading into memory
- [ ] Add periodic garbage collection hints

**Files to create**:
- `src/utils/simple-cache.ts` - Lightweight LRU cache
- `src/monitoring/memory-monitor.ts` - Memory usage tracking

**Target**: Keep memory usage under 150MB on Raspberry Pi 3B+

### 2.2 Startup Time Optimization
**Goal**: Faster startup for better user experience

**Tasks**:
- [ ] Lazy-load Playwright (only when authentication needed)
- [ ] Parallel initialization of independent components
- [ ] Cache token validation to skip unnecessary auth
- [ ] Optimize Docker image layers

**Files to modify**:
- `src/index.ts` - Parallel initialization
- `src/rehau-auth.ts` - Lazy Playwright loading
- `Dockerfile` - Layer optimization

**Target**: Startup time under 10 seconds

### 2.3 Docker Image Optimization
**Goal**: Smaller image size for faster updates

**Tasks**:
- [ ] Multi-stage build to remove build dependencies
- [ ] Use Alpine-specific Chromium optimizations
- [ ] Remove unnecessary Playwright browsers
- [ ] Optimize layer caching

**Files to modify**:
- `Dockerfile` - Multi-stage build

**Target**: Reduce image size by 20-30%

---

## Phase 3: Reliability & Recovery (Week 4)

### 3.1 Network Resilience
**Goal**: Handle home network issues gracefully

**Tasks**:
- [ ] Implement connection health checks
- [ ] Add automatic reconnection with exponential backoff
- [ ] Queue commands during disconnection
- [ ] Persist state across restarts
- [ ] Add network status to Home Assistant

**Files to create**:
- `src/resilience/connection-manager.ts` - Connection health
- `src/resilience/command-queue.ts` - Persistent command queue
- `src/state/state-persistence.ts` - Simple JSON state storage

### 3.2 REHAU API Change Detection
**Goal**: Detect and adapt to REHAU API changes

**Tasks**:
- [ ] Add API response validation
- [ ] Detect schema changes and log warnings
- [ ] Implement fallback parsing strategies
- [ ] Add API health monitoring

**Files to create**:
- `src/api/response-validator.ts` - Schema validation
- `src/api/api-monitor.ts` - API health tracking

### 3.3 Graceful Degradation
**Goal**: Keep working even when some features fail

**Tasks**:
- [ ] Separate critical vs non-critical features
- [ ] Continue operation if live data fails
- [ ] Fallback to polling if MQTT realtime fails
- [ ] Clear status indicators for degraded mode

**Files to modify**:
- `src/mqtt-bridge.ts` - Degraded mode handling
- `src/climate-controller.ts` - Feature isolation

---

## Phase 4: User Experience (Week 5)

### 4.1 Better Logging
**Goal**: Logs that help users troubleshoot without developer knowledge

**Tasks**:
- [ ] Add log levels with clear purposes (info for users, debug for devs)
- [ ] Create troubleshooting log mode (captures relevant info)
- [ ] Add log rotation to prevent disk fill
- [ ] Structured logs with context
- [ ] Add "share logs" feature that redacts sensitive data

**Files to modify**:
- `src/logger.ts` - Enhanced logging
- Create `src/logging/log-sanitizer.ts` - Automatic PII removal

### 4.2 Status Reporting
**Goal**: Users can see what's happening without reading logs

**Tasks**:
- [ ] Add status sensor to Home Assistant (connected/disconnected/error)
- [ ] Publish diagnostic info via MQTT
- [ ] Add last update timestamp sensors
- [ ] Create connection quality indicator

**Files to create**:
- `src/monitoring/status-reporter.ts` - Status publishing

### 4.3 Setup Wizard Improvements
**Goal**: Make initial setup easier

**Tasks**:
- [ ] Add connection test feature
- [ ] Validate credentials before starting
- [ ] Test MQTT connection on startup
- [ ] Test POP3 connection on startup
- [ ] Provide clear next steps on failure

**Files to create**:
- `src/setup/connection-tester.ts` - Pre-flight checks

---

## Phase 5: Testing & Documentation (Week 6)

### 5.1 Essential Testing
**Goal**: Test critical paths without over-engineering

**Tasks**:
- [ ] Unit tests for parsers (most fragile part)
- [ ] Unit tests for configuration validation
- [ ] Integration test for MQTT flow
- [ ] Mock REHAU API for testing
- [ ] Test error recovery scenarios

**Files to create**:
- `tests/unit/parsers.test.ts`
- `tests/unit/config-validator.test.ts`
- `tests/integration/mqtt-flow.test.ts`
- `tests/mocks/rehau-api.mock.ts`

**Target**: 60-70% coverage on critical paths

### 5.2 Documentation Updates
**Goal**: Keep docs in sync with improvements

**Tasks**:
- [ ] Update troubleshooting guide with new error messages
- [ ] Add memory optimization tips for Pi users
- [ ] Document new configuration options
- [ ] Add FAQ for common issues
- [ ] Create upgrade guide

**Files to update**:
- `docs/troubleshooting.md`
- `docs/configuration.md`
- Create `docs/faq.md`
- Create `docs/upgrade-guide.md`

---

## Phase 6: Polish & Release (Week 7)

### 6.1 Performance Validation
**Tasks**:
- [ ] Test on Raspberry Pi 3B+ (minimum spec)
- [ ] Test on Raspberry Pi 4 (common spec)
- [ ] Measure memory usage over 24 hours
- [ ] Measure startup time
- [ ] Test with multiple installations

### 6.2 User Acceptance Testing
**Tasks**:
- [ ] Beta release to community
- [ ] Gather feedback on new error messages
- [ ] Test upgrade path from current version
- [ ] Validate documentation accuracy

### 6.3 Release Preparation
**Tasks**:
- [ ] Update CHANGELOG.md
- [ ] Version bump to 5.0.0
- [ ] Create migration guide
- [ ] Update Home Assistant addon metadata
- [ ] Prepare release notes

---

## Implementation Guidelines

### Code Style
- Keep functions small and focused
- Prefer simple solutions over clever ones
- Comment complex logic (especially REHAU API quirks)
- Use TypeScript types strictly
- Avoid external dependencies when possible

### Testing Strategy
- Focus on critical paths (auth, MQTT, parsing)
- Mock external services (REHAU API, POP3, MQTT)
- Test error scenarios more than happy paths
- Keep tests fast (< 30 seconds total)

### Performance Targets
- Memory: < 150MB on Raspberry Pi 3B+
- Startup: < 10 seconds
- Docker image: < 400MB
- CPU: < 5% idle, < 20% during operations

### Backward Compatibility
- Support migration from v4.x
- Maintain existing MQTT topics
- Keep existing configuration options
- Deprecate gracefully (warn, don't break)

---

## Success Metrics

### Technical Metrics
- [ ] Memory usage reduced by 20%
- [ ] Startup time under 10 seconds
- [ ] Zero crashes over 7-day test period
- [ ] Successful recovery from network disconnection
- [ ] 60%+ test coverage on critical paths

### User Experience Metrics
- [ ] Setup success rate > 95% (from community feedback)
- [ ] Reduced support requests for common issues
- [ ] Positive feedback on error messages
- [ ] Faster issue resolution (better logs)

### Community Metrics
- [ ] Clear contribution guidelines
- [ ] Active issue triage
- [ ] Responsive to bug reports
- [ ] Regular releases

---

## Risk Mitigation

### Risk: Breaking existing installations
**Mitigation**: 
- Thorough testing of upgrade path
- Beta release period
- Clear rollback instructions
- Maintain v4.x branch for critical fixes

### Risk: REHAU API changes during refactoring
**Mitigation**:
- Keep Playwright implementation flexible
- Add API change detection early
- Monitor REHAU API in parallel

### Risk: Performance regression
**Mitigation**:
- Benchmark before/after each phase
- Test on minimum spec hardware
- Profile memory usage continuously

### Risk: Scope creep
**Mitigation**:
- Stick to the plan
- Defer nice-to-have features
- Focus on user-reported issues
- Time-box each phase

---

## Post-Release Maintenance

### Ongoing Tasks
- Monitor community issues
- Update for REHAU API changes
- Keep dependencies updated
- Respond to security issues
- Maintain documentation

### Future Enhancements (Not in this refactoring)
- Web UI for configuration
- Advanced scheduling features
- Energy monitoring integration
- Multi-language support
- Backup/restore functionality

---

## Notes

This refactoring focuses on making the add-on more reliable, efficient, and user-friendly for home automation enthusiasts running it on Raspberry Pi devices. The goal is not enterprise-grade complexity, but rock-solid home automation integration that "just works" and is easy to troubleshoot when it doesn't.

The project is already technically sound - this refactoring is about polish, efficiency, and user experience.