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
