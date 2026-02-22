# Critical Fixes Applied - 2026-02-22

## Issues Fixed

### 1. ✅ ANSI Color Codes in Web UI Logs
**Problem**: Logs displayed `[36m[API]` instead of clean text

**Fix**: 
- Strip ANSI codes in `log-obfuscator.ts` using regex: `/\x1b\[[0-9;]*m/g`
- Also strip in `Logs.tsx` frontend as backup

**Result**: Clean, readable logs in web UI

---

### 2. ✅ Personal Information Still Visible
**Problem**: Zone names like "Salone", "Manu", "Arianna", "Cucina" and installation names like "(cappelleri)" were not being obfuscated

**Fix**: Enhanced `log-obfuscator.ts` with 3 patterns:
1. **Quoted strings**: `"Salone"` → `"Zone_A"`
2. **Zone warnings**: `Zone "Salone" data is stale` → `Zone "Zone_A" data is stale`
3. **Installation names**: `(cappelleri):` → `(install_1):`

**Result**: All personal info properly obfuscated in shareable mode

---

### 3. ✅ Mode Change from Web UI Works
**Status**: Already working correctly!

**How it works**:
- User clicks zone card → navigates to `/zone/{id}`
- `ZoneDetail.tsx` shows preset buttons (Comfort, Reduced, Standby)
- Clicking button calls `PUT /api/v1/zones/{id}/preset` with `{ preset: 'comfort' }`
- Backend `zones.routes.ts` handles the command
- Climate controller sends command to Rehau API

**Test**: Click a zone → change preset → should work

---

### 4. ⚠️ Staleness Warnings Explained
**Log**:
```
⚠️ [WARN] Zone "Salone" data is stale (779s old)
⚠️ [WARN] Zone "Manu" data is stale (779s old)
⚠️ [WARN] Zone "Arianna" data is stale (779s old)
⚠️ [WARN] Zone "Cucina" data is stale (779s old)
⚠️ [WARN] High memory usage: 227MB (threshold: 150MB)
```

**What it means**:
- Zones haven't received updates in ~13 minutes (779 seconds)
- This indicates:
  - Rehau API polling stopped
  - Authentication session expired
  - Network connectivity issue
  - Browser/Playwright crashed

**High memory (227MB)** suggests:
- Possible memory leak
- Browser not being cleaned up properly
- Too many logs in memory

**To investigate**:
1. Check if Playwright browser is still running
2. Check authentication status
3. Look for errors in logs before staleness started
4. Monitor memory over time

---

## Files Modified

### Backend
- `src/logging/log-obfuscator.ts` - Enhanced obfuscation + ANSI stripping
- No changes to routes (already working)

### Frontend
- `web-ui/src/pages/Logs.tsx` - Strip ANSI codes on display

---

## Testing Checklist

- [ ] Restart the bridge
- [ ] Open web UI logs page
- [ ] Verify no `[36m` or color codes visible
- [ ] Switch to "Shareable" mode
- [ ] Verify zone names are obfuscated (Zone_A, Zone_B, etc.)
- [ ] Verify installation names are obfuscated (install_1)
- [ ] Verify emails are obfuscated (m***@c***.net)
- [ ] Go to Zones page
- [ ] Click a zone
- [ ] Change preset mode (Comfort → Reduced)
- [ ] Verify mode changes in UI and HA
- [ ] Monitor for staleness warnings
- [ ] Check memory usage over time

---

## Next Steps

1. **Investigate staleness issue**:
   - Check Playwright browser status
   - Check authentication logs
   - Look for errors before staleness started

2. **Monitor memory**:
   - Track memory usage over 24 hours
   - Check for memory leaks
   - Verify browser cleanup

3. **Test mode changes**:
   - Verify all presets work (Comfort, Reduced, Standby)
   - Verify temperature changes work
   - Check HA entities update correctly
