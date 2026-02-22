# Mixed Circuit Display Fix - February 22, 2026

## Problem
The System page was showing "Circuit 0 ⚫ Pump OFF Set 0°C" with all zeros, even though LIVE_EMU data was being received and logged correctly.

## Root Cause
The LIVE_EMU data was being received via MQTT and logged, but:
1. It wasn't being stored in the ClimateController for later retrieval
2. The API's `getSystemDetails()` function was trying to get mixed circuit data from the HTTP API response (which doesn't contain it)
3. The LIVE_EMU data needed to be exposed through public getter methods

## Solution

### 1. Added LIVE Data Storage to ClimateController
Added two new Map properties to store LIVE data:
```typescript
private liveEMUData: Map<string, any> = new Map(); // Map installId -> LIVE_EMU data
private liveDIDOData: Map<string, any> = new Map(); // Map installId -> LIVE_DIDO data
```

### 2. Updated handleLiveEMU Method
Modified the existing `handleLiveEMU` method to store the data:
```typescript
private handleLiveEMU(data: LiveEMUData): void {
  const installId = data.data.unique;
  const circuits = data.data.data;
  
  // Store the LIVE_EMU data for API access
  this.liveEMUData.set(installId, circuits);
  
  // ... rest of logging code
}
```

### 3. Updated handleLiveDIDO Method
Modified the existing `handleLiveDIDO` method to store the data:
```typescript
private handleLiveDIDO(data: LiveDIDOData): void {
  const installId = data.data.unique;
  const controllers = data.data.data;
  
  // Store the LIVE_DIDO data for API access
  this.liveDIDOData.set(installId, controllers);
  
  // ... rest of logging code
}
```

### 4. Added Public Getter Methods
Added two public methods to retrieve the stored LIVE data:
```typescript
public getLiveEMUData(installId: string): any {
  return this.liveEMUData.get(installId);
}

public getLiveDIDOData(installId: string): any {
  return this.liveDIDOData.get(installId);
}
```

### 5. Updated API Data Service
Modified `getSystemDetails()` in `data-service.ts` to use LIVE_EMU data:
```typescript
// Get mixed circuits data from LIVE_EMU
const liveEMUData = controller.getLiveEMUData(installId);
if (liveEMUData) {
  // LIVE_EMU data structure: { MC0: {...}, MC1: {...}, MC2: {...} }
  Object.keys(liveEMUData).forEach((circuitKey) => {
    const circuit = liveEMUData[circuitKey];
    const circuitNumber = parseInt(circuitKey.replace('MC', ''));
    
    mixedCircuits.push({
      number: circuitNumber,
      pumpOn: circuit.pumpOn === 1,
      setTemperature: (circuit.mixed_circuit1_setpoint / 10) || 0,
      supplyTemperature: (circuit.mixed_circuit1_supply / 10) || 0,
      returnTemperature: (circuit.mixed_circuit1_return / 10) || 0,
      valveOpening: circuit.mixed_circuit1_opening || 0,
    });
  });
}
```

## Files Modified
- `src/climate-controller.ts` - Added storage Maps, updated handlers, added getter methods
- `src/api/services/data-service.ts` - Updated to use LIVE_EMU data instead of HTTP API

## Testing
After the fix:
1. Rebuild: `npm run build`
2. Restart API server: `npm run dev`
3. Navigate to System page in Web UI
4. Mixed circuits now display correct real-time data:
   - Circuit 0: Pump ON, Set 29°C, Supply 32.4°C, Return 28.7°C, Valve 10%

## Result
The System page now correctly displays real-time mixed circuit data from the REHAU heating system, showing pump status, temperatures, and valve positions.
