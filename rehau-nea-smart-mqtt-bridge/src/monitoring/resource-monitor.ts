/**
 * Resource Monitor - Monitor memory and CPU usage
 */

import logger from '../logger';

export interface ResourceStats {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  uptime: number;
  timestamp: number;
}

export class ResourceMonitor {
  private monitorInterval: NodeJS.Timeout | null = null;
  private memoryWarningThreshold: number;
  private lastWarning: number = 0;
  private warningCooldown: number = 60000; // 1 minute between warnings

  constructor(memoryWarningThresholdMB: number = 150) {
    this.memoryWarningThreshold = memoryWarningThresholdMB * 1024 * 1024; // Convert to bytes
  }

  /**
   * Start monitoring resources
   */
  start(intervalMs: number = 60000): void {
    logger.info(`📊 Starting resource monitoring (every ${intervalMs / 1000}s)`);
    
    this.monitorInterval = setInterval(() => {
      this.checkResources();
    }, intervalMs);

    // Log initial stats
    this.checkResources();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Get current resource stats
   */
  getStats(): ResourceStats {
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * Check resources and log warnings if needed
   */
  private checkResources(): void {
    const stats = this.getStats();
    const memoryMB = Math.round(stats.memory.heapUsed / 1024 / 1024);
    const rssMB = Math.round(stats.memory.rss / 1024 / 1024);

    // Log current usage at debug level
    logger.debug(`📊 Memory: ${memoryMB}MB heap, ${rssMB}MB RSS`);

    // Check if memory exceeds threshold
    if (stats.memory.heapUsed > this.memoryWarningThreshold) {
      const now = Date.now();
      
      // Only warn if cooldown period has passed
      if (now - this.lastWarning > this.warningCooldown) {
        logger.warn(`⚠️  High memory usage: ${memoryMB}MB (threshold: ${Math.round(this.memoryWarningThreshold / 1024 / 1024)}MB)`);
        this.lastWarning = now;
      }
    }
  }

  /**
   * Format memory size for display
   */
  static formatMemory(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)}MB`;
  }

  /**
   * Format uptime for display
   */
  static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '< 1m';
  }
}

export default ResourceMonitor;
