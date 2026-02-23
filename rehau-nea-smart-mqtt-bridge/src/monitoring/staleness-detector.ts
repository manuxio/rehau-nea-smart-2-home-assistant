/**
 * Staleness Detector - Detect when zone data becomes stale
 */

import logger from '../logger';

export interface StalenessConfig {
  warningThreshold: number;  // milliseconds
  staleThreshold: number;    // milliseconds
}

export type FreshnessStatus = 'fresh' | 'stale' | 'very_stale';

export interface ZoneFreshness {
  zoneId: string;
  zoneName: string;
  lastUpdate: number;
  status: FreshnessStatus;
  age: number;
}

export class StalenessDetector {
  private config: StalenessConfig;
  private zoneLastUpdate: Map<string, number> = new Map();
  private zoneNames: Map<string, string> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private onStaleCallback?: (zoneId: string, zoneName: string) => void;

  constructor(config?: Partial<StalenessConfig>) {
    // Default: warning at 10 minutes, stale at 30 minutes
    this.config = {
      warningThreshold: config?.warningThreshold || 10 * 60 * 1000,
      staleThreshold: config?.staleThreshold || 30 * 60 * 1000
    };
  }

  /**
   * Start monitoring for stale data
   */
  start(checkIntervalMs: number = 60000): void {
    logger.info(`🔍 Starting staleness detection (check every ${checkIntervalMs / 1000}s)`);
    
    this.checkInterval = setInterval(() => {
      this.checkAllZones();
    }, checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register a zone for monitoring
   */
  registerZone(zoneId: string, zoneName: string): void {
    this.zoneNames.set(zoneId, zoneName);
    this.updateZone(zoneId);
  }

  /**
   * Update zone last update timestamp
   */
  updateZone(zoneId: string): void {
    this.zoneLastUpdate.set(zoneId, Date.now());
  }

  /**
   * Check freshness of a specific zone
   */
  checkZoneFreshness(zoneId: string): FreshnessStatus {
    const lastUpdate = this.zoneLastUpdate.get(zoneId);
    if (!lastUpdate) {
      return 'very_stale'; // Never updated
    }

    const age = Date.now() - lastUpdate;

    if (age < this.config.warningThreshold) {
      return 'fresh';
    } else if (age < this.config.staleThreshold) {
      const zoneName = this.zoneNames.get(zoneId) || zoneId;
      logger.warn(`⚠️  Zone "${zoneName}" data is stale (${Math.floor(age / 1000)}s old)`);
      return 'stale';
    } else {
      const zoneName = this.zoneNames.get(zoneId) || zoneId;
      logger.error(`❌ Zone "${zoneName}" data is very stale (${Math.floor(age / 1000)}s old)`);
      
      // Trigger callback if registered
      if (this.onStaleCallback) {
        this.onStaleCallback(zoneId, zoneName);
      }
      
      return 'very_stale';
    }
  }

  /**
   * Check all zones for staleness
   */
  checkAllZones(): void {
    const staleZones: string[] = [];
    
    for (const [zoneId, zoneName] of this.zoneNames.entries()) {
      const status = this.checkZoneFreshness(zoneId);
      if (status === 'very_stale') {
        staleZones.push(zoneName);
      }
    }

    if (staleZones.length > 0) {
      logger.warn(`⚠️  ${staleZones.length} zone(s) have very stale data: ${staleZones.join(', ')}`);
    }
  }

  /**
   * Get freshness status for all zones
   */
  getAllZoneFreshness(): ZoneFreshness[] {
    const result: ZoneFreshness[] = [];

    for (const [zoneId, zoneName] of this.zoneNames.entries()) {
      const lastUpdate = this.zoneLastUpdate.get(zoneId) || 0;
      const age = Date.now() - lastUpdate;
      const status = this.checkZoneFreshness(zoneId);

      result.push({
        zoneId,
        zoneName,
        lastUpdate,
        status,
        age
      });
    }

    return result;
  }

  /**
   * Register callback for when zone becomes very stale
   */
  onStale(callback: (zoneId: string, zoneName: string) => void): void {
    this.onStaleCallback = callback;
  }

  /**
   * Get configuration
   */
  getConfig(): StalenessConfig {
    return { ...this.config };
  }
}

export default StalenessDetector;
