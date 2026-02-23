# Zone Command Fix - February 22, 2026

## Problem
Zone temperature and preset commands from the Web UI were failing with the error:
```
Zone undefined not found for command
```

## Root Cause
The API routes were sending commands with incorrect field names that didn't match the `HACommand` interface expected by the climate controller:

**API was sending:**
```typescript
{
  type: 'ha_command',
  zoneId: zoneKey,        // ❌ Wrong field name
  command: 'temperature', // ❌ Wrong field name
  value: temperature      // ❌ Wrong field name
}
```

**Climate controller expected:**
```typescript
interface HACommand {
  type: 'ha_command';
  installId: string;
  zoneNumber: string;     // ✅ Correct field name (contains zoneId)
  commandType: string;    // ✅ Correct field name
  payload: string;        // ✅ Correct field name
}
```

## Solution
Updated `src/api/routes/zones.routes.ts` to send commands with the correct field names:

### Temperature Command (PUT /api/v1/zones/:id/temperature)
```typescript
const command = {
  type: 'ha_command',
  installId: installId,
  zoneNumber: zoneId,  // ✅ Now using correct field name
  commandType: 'temperature',
  payload: temperature.toString()
};
```

### Preset Command (PUT /api/v1/zones/:id/preset)
```typescript
{
  type: 'ha_command',
  installId: installId,
  zoneNumber: zoneId,  // ✅ Now using correct field name
  commandType: 'preset',
  payload: preset
}
```

## Files Modified
- `src/api/routes/zones.routes.ts` - Fixed both temperature and preset command endpoints

## Testing
After the fix:
1. Rebuild: `npm run build`
2. Restart API server: `npm run dev`
3. Test temperature control from Web UI
4. Test preset mode control from Web UI

## Result
Zone commands now properly route through the climate controller and reach the REHAU heating system.
