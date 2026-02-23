# Next Steps - Postponed Features Implementation

## 🎯 Session Goal
Complete the postponed items from the original refactoring plan, starting with the highest value features.

## 📋 Implementation Order

### 1️⃣ Complete Enhanced Logging (Priority 1 - Remaining 30%)

**Estimated Time**: 1-2 days

#### Tasks:
- [ ] **Integrate Directional Indicators**
  - Update `mqtt-bridge.ts` to use enhanced logger with direction context
  - Update `climate-controller.ts` to use enhanced logger with direction context
  - Update `rehau-auth.ts` to use enhanced logger with direction context
  - Test: Verify ⬆️⬇️🔄 indicators appear in logs

- [ ] **Test Shareable Mode**
  - Create test endpoint: `GET /api/v1/logs/shareable`
  - Test obfuscation of zone names, installation names, emails
  - Verify technical info is preserved
  - Test: Export shareable logs and verify privacy

- [ ] **Add Log Export Endpoints**
  - `GET /api/v1/logs` - Get recent logs (normal mode)
  - `GET /api/v1/logs/shareable` - Get obfuscated logs
  - `POST /api/v1/logs/export` - Download logs as file
  - Test: Download logs via API

- [ ] **Test Zero-Effect Detection**
  - Send same temperature command twice
  - Verify warning appears in logs
  - Test: Command marked as "no-change"

**Files to Modify**:
```
src/mqtt-bridge.ts           # Add logger context
src/climate-controller.ts    # Add logger context
src/rehau-auth.ts            # Add logger context
src/api/routes/logs.routes.ts # Add export endpoints
src/logging/log-exporter.ts  # Create exporter
```

**Success Criteria**:
- ✅ Directional indicators visible in all logs
- ✅ Shareable mode obfuscates personal info
- ✅ Log export API working
- ✅ Zero-effect detection working

---

### 2️⃣ HA Status Reporting (Priority 5)

**Estimated Time**: 2-3 days

#### Tasks:
- [ ] **Create Status Publisher**
  - Bridge status sensor (connected/authenticating/error/degraded)
  - Auth status sensor (authenticated/expired/refreshing/failed)
  - MQTT quality sensor (excellent/good/poor/disconnected)
  - Session age sensor (seconds since last auth)

- [ ] **Implement Stale Detection**
  - Track last update time per zone
  - Configurable staleness threshold (default 10 minutes)
  - Mark zones as "stale" when threshold exceeded
  - Log staleness events

- [ ] **Auto-Refresh on Stale**
  - Trigger automatic refresh when stale detected
  - Add retry logic with exponential backoff
  - Log refresh attempts

- [ ] **Zone Last Update Sensors**
  - Add timestamp sensor per zone
  - Publish to Home Assistant
  - Update on every zone data change

**Files to Create**:
```
src/ha-integration/
├── status-publisher.ts      # Publish status to HA
├── sensor-factory.ts        # Create HA sensor configs
├── diagnostics.ts           # Diagnostic data collection
└── staleness-detector.ts    # Detect stale data

src/monitoring/
└── auto-refresh.ts          # Trigger refreshes
```

**MQTT Topics to Add**:
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
```

**Success Criteria**:
- ✅ All status sensors visible in Home Assistant
- ✅ Stale detection working (test by stopping updates)
- ✅ Auto-refresh triggered on stale detection
- ✅ Zone last update timestamps accurate

---

### 3️⃣ Playwright Optimization (Priority 4)

**Estimated Time**: 2-3 days

#### Tasks:
- [ ] **Lazy Browser Initialization**
  - Only start browser when authentication needed
  - Keep browser closed during normal operation
  - Test: Verify browser not running when idle

- [ ] **Idle Timeout**
  - Close browser after 5 minutes of inactivity
  - Track last browser usage time
  - Implement cleanup timer
  - Test: Browser closes after timeout

- [ ] **Optimize Browser Settings**
  - Add resource-saving launch arguments
  - Disable unnecessary features (GPU, extensions, etc.)
  - Block images, stylesheets, fonts during auth
  - Test: Measure memory usage before/after

- [ ] **Smart Token Caching**
  - Validate tokens before launching browser
  - Only use Playwright when tokens truly expired
  - Cache successful authentication state
  - Test: Avoid unnecessary browser launches

- [ ] **Memory Monitoring**
  - Track browser memory usage
  - Log memory stats periodically
  - Add warnings for high memory usage
  - Test: Monitor over 24 hours

**Files to Modify**:
```
src/playwright-https-client.ts  # Lazy init, idle timeout
src/rehau-auth.ts               # Smart caching
src/monitoring/
└── resource-monitor.ts         # Memory monitoring
```

**Configuration to Add**:
```env
PLAYWRIGHT_IDLE_TIMEOUT=300     # 5 minutes
PLAYWRIGHT_MEMORY_LIMIT=100     # MB
PLAYWRIGHT_LAZY_INIT=true       # Default true
```

**Success Criteria**:
- ✅ Browser not running when idle
- ✅ Browser closes after 5 min timeout
- ✅ Memory usage < 100MB when idle
- ✅ Authentication still works reliably
- ✅ Faster startup (no browser launch)

---

### 4️⃣ Web UI Enhancements

**Estimated Time**: 3-5 days

#### Tasks:
- [ ] **PWA Support**
  - Create manifest.json
  - Add service worker for offline support
  - Add install prompt
  - Test: Install on mobile device

- [ ] **WebSocket Real-Time Updates**
  - Connect to Socket.IO from web UI
  - Subscribe to zone updates
  - Update UI in real-time
  - Show connection status
  - Test: See live temperature changes

- [ ] **Temperature Slider**
  - Create mobile-friendly slider component
  - Add haptic feedback (if available)
  - Optimistic UI updates
  - Test: Control temperature from web UI

- [ ] **Pull-to-Refresh**
  - Add pull-to-refresh gesture
  - Refresh data on pull
  - Show loading indicator
  - Test: Pull to refresh on mobile

- [ ] **Historical Graphs**
  - Add chart library (Chart.js or Recharts)
  - Fetch historical data from API
  - Display temperature history
  - Test: View temperature trends

**Files to Create**:
```
web-ui/public/
├── manifest.json            # PWA manifest
└── service-worker.js        # Offline support

web-ui/src/
├── hooks/
│   ├── useWebSocket.ts      # WebSocket hook
│   └── usePullToRefresh.ts  # Pull-to-refresh
├── components/
│   ├── TemperatureSlider.tsx # Slider component
│   └── TemperatureChart.tsx  # Chart component
```

**Success Criteria**:
- ✅ PWA installable on mobile
- ✅ Real-time updates working
- ✅ Temperature slider functional
- ✅ Pull-to-refresh working
- ✅ Historical graphs displaying

---

### 5️⃣ OAuth2 POP3 Authentication (Priority 6)

**Estimated Time**: 5-7 days

#### Tasks:
- [ ] **Research OAuth2 Flows**
  - Gmail OAuth2 POP3 access
  - Outlook OAuth2 POP3 access
  - Document setup process

- [ ] **Implement OAuth2 Providers**
  - Gmail provider
  - Outlook provider
  - Generic OAuth2 provider

- [ ] **Token Management**
  - Store OAuth2 tokens securely (encrypted)
  - Implement token refresh logic
  - Validate tokens without re-auth

- [ ] **Persistent Session Storage**
  - Encrypt and save tokens to disk
  - Load tokens on startup
  - Proactive token refresh (1 hour before expiry)

- [ ] **Setup Wizard**
  - Web UI configuration page
  - OAuth2 authorization flow
  - Test connection button

**Files to Create**:
```
src/auth/
├── oauth2/
│   ├── oauth2-provider.ts   # Base provider
│   ├── gmail-provider.ts    # Gmail-specific
│   ├── outlook-provider.ts  # Outlook-specific
│   └── token-manager.ts     # Token storage/refresh
├── session-manager.ts       # Persistent sessions
├── token-storage.ts         # Encrypted storage
└── pop3-oauth2-client.ts    # POP3 with OAuth2

web-ui/src/pages/
└── OAuth2Setup.tsx          # Setup wizard
```

**Configuration to Add**:
```env
POP3_AUTH_TYPE=basic|oauth2
POP3_OAUTH2_PROVIDER=gmail|outlook|custom
POP3_OAUTH2_CLIENT_ID=
POP3_OAUTH2_CLIENT_SECRET=
POP3_OAUTH2_REFRESH_TOKEN=
SESSION_PERSISTENCE=true
```

**Success Criteria**:
- ✅ OAuth2 working with Gmail
- ✅ OAuth2 working with Outlook
- ✅ Sessions persist across restarts
- ✅ 2FA prompts < 1 per week
- ✅ Setup wizard functional

---

## 🧪 Testing Strategy

### After Each Feature:
1. ✅ Code compiles without errors
2. ✅ Feature works as expected
3. ✅ Existing features still work
4. ✅ No errors in logs
5. ✅ Test on real REHAU system
6. ✅ Commit changes to git

### Integration Testing:
- Test all features together
- 24-hour stability test
- Memory leak check
- Performance benchmarks

### Regression Testing:
- MQTT bridge still works
- HA discovery still works
- Authentication still works
- Zone control still works
- Web UI still works

---

## 📊 Progress Tracking

Update this checklist as you complete each item:

### Enhanced Logging
- [ ] Directional indicators integrated
- [ ] Shareable mode tested
- [ ] Log export endpoints added
- [ ] Zero-effect detection tested

### HA Status Reporting
- [ ] Status sensors created
- [ ] Stale detection implemented
- [ ] Auto-refresh working
- [ ] Zone last update sensors added

### Playwright Optimization
- [ ] Lazy initialization implemented
- [ ] Idle timeout working
- [ ] Browser settings optimized
- [ ] Memory monitoring added

### Web UI Enhancements
- [ ] PWA support added
- [ ] WebSocket updates working
- [ ] Temperature slider created
- [ ] Pull-to-refresh implemented
- [ ] Historical graphs added

### OAuth2 POP3
- [ ] Gmail OAuth2 working
- [ ] Outlook OAuth2 working
- [ ] Session persistence working
- [ ] Setup wizard created

---

## 🎯 Success Metrics

**Target Completion**: 3-4 weeks

**Quality Gates**:
- All features tested on real REHAU system
- No regression in existing functionality
- Memory usage < 150MB on Raspberry Pi
- Startup time < 15 seconds
- 2FA prompts < 1 per week (with OAuth2)
- Web UI feels like native app

**Documentation**:
- Update REFACTORING_PLAN.md after each feature
- Update CHANGELOG.md with new features
- Create user guides for new features
- Update README.md

---

## 🚀 Let's Build!

Ready to tackle these postponed features and make this the best REHAU integration ever! 💪
