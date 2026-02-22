/**
 * Log Exporter - Export logs in normal or shareable mode
 */

import fs from 'fs/promises';
import path from 'path';
import enhancedLogger from './enhanced-logger';
import { logObfuscator } from './log-obfuscator';

export interface LogExportOptions {
  mode: 'normal' | 'shareable';
  lines?: number;
  level?: string;
  component?: string;
}

export class LogExporter {
  private logDir: string;

  constructor(logDir: string = 'logs') {
    this.logDir = logDir;
  }

  /**
   * Export logs with optional filtering
   */
  async exportLogs(options: LogExportOptions): Promise<string> {
    const { mode = 'normal', lines, level, component } = options;

    // Enable shareable mode if requested
    const wasShareable = enhancedLogger.isShareableMode();
    if (mode === 'shareable') {
      enhancedLogger.setShareableMode(true);
    }

    try {
      // Read combined log file
      const logFile = path.join(this.logDir, 'combined.log');
      
      // Check if file exists
      try {
        await fs.access(logFile);
      } catch {
        // File doesn't exist yet, return empty
        return '';
      }
      
      const content = await fs.readFile(logFile, 'utf-8');
      
      // Split into lines
      let logLines = content.split('\n').filter(line => line.trim());

      // Filter by level if specified
      if (level && level !== 'all') {
        const levelUpper = level.toUpperCase();
        logLines = logLines.filter(line => line.includes(`[${levelUpper}]`));
      }

      // Filter by component if specified
      if (component) {
        logLines = logLines.filter(line => line.includes(`[${component}]`));
      }

      // Limit number of lines if specified
      if (lines && lines > 0) {
        logLines = logLines.slice(-lines);
      }

      // Join back
      let result = logLines.join('\n');

      // Apply obfuscation if in shareable mode
      if (mode === 'shareable') {
        result = result.split('\n').map(line => logObfuscator.obfuscate(line)).join('\n');
      }

      return result;
    } catch (error) {
      enhancedLogger.error('Error exporting logs', error as Error, {
        component: 'API',
        direction: 'INTERNAL'
      });
      return '';
    } finally {
      // Restore original mode
      enhancedLogger.setShareableMode(wasShareable);
    }
  }

  /**
   * Get recent logs as array
   */
  async getRecentLogs(count: number = 100): Promise<string[]> {
    try {
      const logFile = path.join(this.logDir, 'combined.log');
      
      // Check if file exists
      try {
        await fs.access(logFile);
      } catch {
        // Try to create logs directory if it doesn't exist
        try {
          await fs.mkdir(this.logDir, { recursive: true });
        } catch {
          // Directory creation failed, return empty
        }
        return [];
      }
      
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      return lines.slice(-count);
    } catch (error) {
      enhancedLogger.error('Error reading logs', error as Error, {
        component: 'API',
        direction: 'INTERNAL'
      });
      return [];
    }
  }

  /**
   * Export logs to file
   */
  async exportToFile(options: LogExportOptions, outputPath: string): Promise<void> {
    const logs = await this.exportLogs(options);
    await fs.writeFile(outputPath, logs, 'utf-8');
  }
}

export const logExporter = new LogExporter();
export default logExporter;
