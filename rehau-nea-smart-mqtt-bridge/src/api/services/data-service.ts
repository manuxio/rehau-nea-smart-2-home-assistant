import ClimateController from '../../climate-controller';
import RehauAuthPersistent from '../../rehau-auth';

// Global references to be set by main application
let climateControllerInstance: ClimateController | null = null;
let authInstance: RehauAuthPersistent | null = null;

export function setClimateController(controller: ClimateController): void {
  climateControllerInstance = controller;
}

export function setAuth(auth: RehauAuthPersistent): void {
  authInstance = auth;
}

export function getClimateController(): ClimateController {
  if (!climateControllerInstance) {
    throw new Error('ClimateController not initialized');
  }
  return climateControllerInstance;
}

export function getAuth(): RehauAuthPersistent {
  if (!authInstance) {
    throw new Error('Auth not initialized');
  }
  return authInstance;
}

// Get all installations
export function getInstallations(): any[] {
  const auth = getAuth();
  return auth.getInstalls();
}

// Get zones for all installations
export async function getAllZones() {
  const auth = getAuth();
  const installations = auth.getInstalls();
  
  const zones: any[] = [];
  
  for (const install of installations) {
    try {
      const installData = await auth.getInstallationData(install);
      
      if (installData && (installData as any).groups) {
        for (const group of (installData as any).groups) {
          if (group.zones) {
            for (const zone of group.zones) {
              // Get data from the first channel (thermostat)
              const channel = zone.channels && zone.channels[0];
              
              zones.push({
                id: zone.id,
                name: zone.name,
                temperature: channel?.currentTemperature?.celsius || 0,
                targetTemperature: channel?.setpointTemperature?.celsius || 0,
                humidity: channel?.humidity || 0,
                mode: (installData as any).mode || 'heat',
                preset: channel?.mode === 0 ? 'comfort' : channel?.mode === 1 ? 'reduced' : channel?.mode === 2 ? 'standby' : 'off',
                groupName: group.name,
                installName: install.name,
                installId: install.unique,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to get data for installation ${install.name}:`, error);
    }
  }
  
  return zones;
}

// Get single zone by ID
export async function getZoneById(zoneId: string) {
  const zones = await getAllZones();
  return zones.find(z => z.id === zoneId);
}

// Get system details (mixed circuits, zone demands, etc.)
export async function getSystemDetails() {
  const auth = getAuth();
  const controller = getClimateController();
  const installations = auth.getInstalls();
  
  if (installations.length === 0) {
    throw new Error('No installations found');
  }
  
  const install = installations[0];
  const installData = await auth.getInstallationData(install);
  const installId = install.unique;
  
  const mixedCircuits: any[] = [];
  const zones: any[] = [];
  
  // Get mixed circuits data from LIVE_EMU
  const liveEMUData = controller.getLiveEMUData(installId);
  if (liveEMUData) {
    // LIVE_EMU data structure: { MC0: {...}, MC1: {...}, MC2: {...} }
    Object.keys(liveEMUData).forEach((circuitKey) => {
      const circuit = liveEMUData[circuitKey];
      const circuitNumber = parseInt(circuitKey.replace('MC', ''));
      
      // Temperature conversion: REHAU stores as Fahrenheit * 10
      // Convert to Celsius: (F - 32) / 1.8
      // Value 32767 indicates not present/inactive - return null
      // Also check for converted values around -17.8°C which indicate offline circuits
      const convertTemp = (rawValue: number): number | null => {
        if (rawValue === undefined || rawValue === null) return null;
        // Check for sentinel values before conversion
        if (rawValue === 32767 || rawValue === -32768 || rawValue === 0) return null;
        
        const fahrenheit = rawValue / 10;
        const celsius = Math.round(((fahrenheit - 32) / 1.8) * 10) / 10;
        
        // Additional check: if result is around -17.8°C, it's likely a sentinel
        if (celsius < -15 || celsius > 100) return null;
        
        return celsius;
      };
      
      mixedCircuits.push({
        number: circuitNumber,
        pumpOn: circuit.pumpOn === 1,
        setTemperature: convertTemp(circuit.mixed_circuit1_setpoint),
        supplyTemperature: convertTemp(circuit.mixed_circuit1_supply),
        returnTemperature: convertTemp(circuit.mixed_circuit1_return),
        valveOpening: circuit.mixed_circuit1_opening || 0,
      });
    });
  }
  
  // Get zone demands
  if ((installData as any).groups) {
    for (const group of (installData as any).groups) {
      if (group.zones) {
        for (const zone of group.zones) {
          const channel = zone.channels && zone.channels[0];
          zones.push({
            name: zone.name,
            temperature: channel?.currentTemperature?.celsius || 0,
            targetTemperature: channel?.setpointTemperature?.celsius || 0,
            demand: channel?.demand || 0,
            demandState: channel?.demandState || false,
          });
        }
      }
    }
  }
  
  return {
    installation: {
      name: install.name,
      mode: (installData as any).mode || 'heat',
      outdoorTemperature: (installData as any).outsideTemperature?.celsius,
    },
    mixedCircuits,
    zones,
  };
}
