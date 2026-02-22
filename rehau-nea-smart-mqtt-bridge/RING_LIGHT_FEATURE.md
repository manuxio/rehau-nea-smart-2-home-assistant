# Ring Light Control Feature

## Overview

The ring light control feature allows users to toggle the LED ring light on REHAU zone thermostats via both the REST API and the web UI.

## Implementation

### Backend (API)

**Endpoint**: `PUT /api/v1/zones/:id/ring-light`

**Request Body**:
```json
{
  "state": "on"  // or "off"
}
```

**Response**:
```json
{
  "success": true,
  "state": "on"
}
```

**Implementation Details**:
- Uses existing `handleRingLightCommand` method in climate controller
- Commands are queued and auto-confirmed after 2 seconds (REHAU doesn't send confirmations)
- Ring light state is retrieved from `channel.config.ringActivation`

### Frontend (Web UI)

**Location**: Zone Detail page (`/zones/:id`)

**Features**:
- Toggle button with emoji icons (💡 when ON, 🔦 when OFF)
- Golden gradient styling when active
- Disabled state during updates
- Optimistic UI updates with 2-second reload

**Styling**:
- Full-width button with rounded corners
- Smooth hover and active transitions
- Golden gradient (#ffd700 → #ffb700) when active
- Gray background when inactive

### Data Flow

1. User clicks ring light button in web UI
2. Web UI sends PUT request to `/api/v1/zones/:id/ring-light`
3. API calls `climateController.handleRingLightCommand(zoneId, state)`
4. Climate controller queues command with proper zone routing
5. Command sent to REHAU via MQTT
6. Auto-confirmed after 2 seconds
7. Web UI reloads zone data to reflect actual state

## Testing

### Manual Testing (Web UI)

1. Start the bridge: `npm start`
2. Open web UI: http://localhost:3000
3. Navigate to any zone detail page
4. Click the ring light button
5. Verify the button changes state
6. Check the physical thermostat to confirm ring light changed

### API Testing

Use the provided test script:

```bash
# Get zone ID from web UI or API
node test-ring-light-api.js <zone-id> on
node test-ring-light-api.js <zone-id> off
```

Or use curl:

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.token')

# Turn on ring light
curl -X PUT http://localhost:3000/api/v1/zones/<zone-id>/ring-light \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"on"}'

# Turn off ring light
curl -X PUT http://localhost:3000/api/v1/zones/<zone-id>/ring-light \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"off"}'
```

## Home Assistant Integration

Ring light control is also available in Home Assistant via MQTT:

**Entity**: `light.rehau_<group>_<zone>_ring_light`

**Commands**:
```yaml
# Turn on
service: light.turn_on
target:
  entity_id: light.rehau_living_room_ring_light

# Turn off
service: light.turn_off
target:
  entity_id: light.rehau_living_room_ring_light
```

## Known Limitations

1. **No Confirmation**: REHAU doesn't send confirmations for ring light commands, so the bridge auto-confirms after 2 seconds
2. **State Sync**: Ring light state is only updated when zone data is refreshed (every 5 minutes by default)
3. **Physical Override**: If someone manually changes the ring light on the thermostat, the state won't update until the next data refresh

## Files Modified

- `src/api/services/data-service.ts` - Added ringLight to zone data
- `src/api/routes/zones.routes.ts` - Ring light API endpoint already existed
- `web-ui/src/pages/ZoneDetail.tsx` - Added ring light toggle button
- `web-ui/src/pages/ZoneDetail.css` - Added ring light button styling
- `CHANGELOG.md` - Documented the feature
- `V5_RELEASE_SUMMARY.md` - Added to feature list

## Version

Added in: **v5.0.1** (unreleased)
