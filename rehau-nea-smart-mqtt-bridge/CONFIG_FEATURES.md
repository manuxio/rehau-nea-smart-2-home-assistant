# Configuration Features - 2026-02-22

## New Features Implemented

### 1. ✅ API & Web UI Control via .env

**New Environment Variables:**

```bash
# Enable/Disable API server
API_ENABLED=true

# Enable/Disable Web UI (if enabled, API is automatically enabled)
WEB_UI_ENABLED=true

# Port for both API and Web UI
API_PORT=3000
```

**Logic:**
- If `WEB_UI_ENABLED=true`, then `API_ENABLED` is automatically set to `true` (Web UI needs API)
- If `API_ENABLED=false` and `WEB_UI_ENABLED=false`, no HTTP server starts
- If `API_ENABLED=true` and `WEB_UI_ENABLED=false`, only API endpoints are available (no static files)

**Implementation:**
- `src/index.ts` - Enforces WEB_UI → API dependency
- `src/api/server.ts` - Conditionally serves static files and SPA routes

---

### 2. ✅ Configuration Inspection in Settings Page

**New API Endpoint:**
- `GET /api/v1/config` - Returns all environment variables (read-only)

**What's Exposed:**
- API & Web UI status and port
- MQTT broker configuration (credentials masked)
- REHAU account (email masked, password hidden)
- All polling intervals
- Command configuration
- Logging level
- POP3 configuration (credentials masked)
- Playwright settings
- Monitoring thresholds
- Testing/debug flags

**Security:**
- Passwords are never exposed
- Emails are masked: `manu@cappelleri.net` → `m***@c***.net`
- Only shows if credentials are set, not the actual values

**Settings Page Sections:**
1. Appearance (Dark Mode toggle)
2. API & Web UI (status, port, Swagger link)
3. MQTT Broker
4. REHAU Account
5. Polling Intervals
6. Commands
7. Logging
8. POP3 (OAuth2)
9. Playwright Browser
10. Monitoring
11. Account (Logout)
12. About

---

### 3. ✅ Swagger Documentation Link

**Added to Settings Page:**
- Direct link to Swagger API docs
- URL: `http://localhost:{API_PORT}/api-docs`
- Opens in new tab

---

### 4. ✅ Quick Actions Moved to Top

**Dashboard Layout:**
1. Header (with outdoor temp)
2. **Quick Actions** (moved to top)
3. System Status
4. Authentication Statistics

**Rationale:**
- Most common actions should be immediately visible
- Better UX for mobile users
- Reduces scrolling

---

### 5. ✅ Outdoor Temperature on Dashboard

**Added to Dashboard:**
- Shows outdoor temperature in header (same as Zones page)
- Only displays if temperature is valid: `-30°C ≤ temp ≤ 70°C`
- Hides if value is unavailable or out of scale

**Display:**
```
🌤️ 12.5°C
```

**Validation:**
- Hides if `undefined`
- Hides if `< -30°C` (sensor error)
- Hides if `> 70°C` (sensor error)

---

## Files Modified

### Backend
- `src/index.ts` - WEB_UI → API dependency logic
- `src/api/server.ts` - Conditional Web UI serving
- `src/api/routes/config.routes.ts` - **NEW** Config endpoint
- `.env` - Added `WEB_UI_ENABLED`
- `.env.example` - Added `WEB_UI_ENABLED` with documentation

### Frontend
- `web-ui/src/pages/Settings.tsx` - Complete rewrite with config display
- `web-ui/src/pages/Dashboard.tsx` - Added outdoor temp, moved Quick Actions
- `web-ui/src/pages/Dashboard.css` - Added outdoor-temp style
- `web-ui/src/pages/Zones.tsx` - Added temperature validation

---

## Testing Checklist

### API Control
- [ ] Set `API_ENABLED=false`, `WEB_UI_ENABLED=false` → No HTTP server starts
- [ ] Set `API_ENABLED=true`, `WEB_UI_ENABLED=false` → Only API endpoints work
- [ ] Set `API_ENABLED=false`, `WEB_UI_ENABLED=true` → Both API and Web UI work
- [ ] Set `API_ENABLED=true`, `WEB_UI_ENABLED=true` → Both work

### Port Configuration
- [ ] Change `API_PORT=8080` → Server starts on port 8080
- [ ] Web UI accessible at `http://localhost:8080`
- [ ] Swagger docs at `http://localhost:8080/api-docs`

### Settings Page
- [ ] All configuration sections display correctly
- [ ] Emails are masked properly
- [ ] Passwords show "✅ Set" or "❌ Not set"
- [ ] Swagger link opens in new tab
- [ ] Intervals are formatted correctly (5m, 6h, 24d)
- [ ] Dark mode works on all sections

### Dashboard
- [ ] Quick Actions appear at top
- [ ] Outdoor temperature shows when valid
- [ ] Outdoor temperature hides when < -30 or > 70
- [ ] Outdoor temperature hides when undefined

### Zones Page
- [ ] Outdoor temperature validation works (< -30 or > 70 hides it)

---

## Configuration Examples

### Minimal Setup (API + Web UI)
```bash
API_ENABLED=true
WEB_UI_ENABLED=true
API_PORT=3000
```

### API Only (No Web UI)
```bash
API_ENABLED=true
WEB_UI_ENABLED=false
API_PORT=3000
```

### Completely Disabled
```bash
API_ENABLED=false
WEB_UI_ENABLED=false
```

### Custom Port
```bash
API_ENABLED=true
WEB_UI_ENABLED=true
API_PORT=8080
```

---

## Benefits

1. **Flexibility**: Users can disable Web UI if they only need API
2. **Security**: Sensitive data is never exposed in Settings
3. **Transparency**: All configuration is visible and inspectable
4. **Documentation**: Swagger link makes API exploration easy
5. **UX**: Quick Actions at top, outdoor temp on Dashboard
6. **Validation**: Temperature validation prevents displaying bogus values

---

## Next Steps

1. Test all configuration combinations
2. Verify Settings page displays all values correctly
3. Test outdoor temperature validation edge cases
4. Consider adding config editing in future (currently read-only)
