# Temperature Conversion and Standby Mode Fix - February 22, 2026

## Problems Fixed

### 1. Incorrect Temperature Display in Mixed Circuits
**Problem**: Mixed circuit temperatures were showing as 84.2°C instead of 29°C
**Root Cause**: The LIVE_EMU data stores temperatures as Fahrenheit * 10, but the API was only dividing by 10 without converting from Fahrenheit to Celsius

### 2. Temperature Control Enabled in Standby Mode
**Problem**: Users could adjust temperature even when a zone was in standby mode
**Root Cause**: The UI didn't check the zone's preset mode before allowing temperature adjustments

## Solutions

### 1. Temperature Conversion Fix

Added proper Fahrenheit to Celsius conversion in `data-service.ts`:

```typescript
// Temperature conversion: REHAU stores as Fahrenheit * 10
// Convert to Celsius: (F - 32) / 1.8
const convertTemp = (rawValue: number): number => {
  if (rawValue === undefined || rawValue === null) return 0;
  const fahrenheit = rawValue / 10;
  return Math.round(((fahrenheit - 32) / 1.8) * 10) / 10;
};

mixedCircuits.push({
  number: circuitNumber,
  pumpOn: circuit.pumpOn === 1,
  setTemperature: convertTemp(circuit.mixed_circuit1_setpoint),
  supplyTemperature: convertTemp(circuit.mixed_circuit1_supply),
  returnTemperature: convertTemp(circuit.mixed_circuit1_return),
  valveOpening: circuit.mixed_circuit1_opening || 0,
});
```

**Before**: 
- Set: 84.2°C, Supply: 90.4°C, Return: 83.7°C

**After**: 
- Set: 29°C, Supply: 32.4°C, Return: 28.7°C ✅

### 2. Standby Mode Temperature Control Fix

Updated `ZoneDetail.tsx` to disable temperature controls when in standby mode:

```typescript
{zone.preset === 'standby' ? (
  <p className="control-hint disabled-message">
    Temperature control is disabled in Standby mode. 
    Switch to Comfort or Reduced to adjust temperature.
  </p>
) : (
  <>
    <div className="temp-control">
      <button className="temp-btn" onClick={() => adjustTemperature(-0.5)}>-</button>
      <span className="temp-display">{formatTemperature(zone.targetTemperature)}</span>
      <button className="temp-btn" onClick={() => adjustTemperature(0.5)}>+</button>
    </div>
  </>
)}
```

Added CSS styling for the disabled message:
```css
.disabled-message {
  text-align: center;
  font-size: 14px;
  color: #ff9800;
  background: #fff3e0;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #ffe0b2;
  margin: 0;
  line-height: 1.5;
}
```

## Files Modified

1. `src/api/services/data-service.ts` - Added proper temperature conversion
2. `web-ui/src/pages/ZoneDetail.tsx` - Added standby mode check
3. `web-ui/src/pages/ZoneDetail.css` - Added disabled message styling

## Testing

After the fix:
1. Navigate to System page - mixed circuit temperatures now show correct Celsius values
2. Set a zone to Standby mode - temperature controls are disabled with informative message
3. Switch back to Comfort or Reduced - temperature controls are re-enabled

## Result

- Mixed circuit temperatures now display correctly in Celsius
- Temperature controls are properly disabled in Standby mode with clear user feedback
- Users are guided to switch preset modes to adjust temperature
