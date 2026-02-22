import winston from 'winston';
import chalk from 'chalk';

// Direction indicators
export const Direction = {
  INCOMING: '⬇️ ',
  OUTGOING: '⬆️ ',
  INTERNAL: '🔄',
  BIDIRECTIONAL: '🔌'
} as const;

// Component emojis
export const ComponentEmoji = {
  AUTH: '🔐',
  MQTT: '📡',
  REHAU: '🏠',
  ZONE: '🌡️ ',
  API: '🚀',
  WEB: '🌐',
  POP3: '📧',
  PLAYWRIGHT: '🎭',
  BRIDGE: '🔄',
  SESSION: '💾',
  PERFORMANCE: '⚡'
} as const;

// Status emojis
export const StatusEmoji = {
  SUCCESS: '✅',
  FAILURE: '❌',
  WARNING: '⚠️ ',
  INFO: 'ℹ️ ',
  DEBUG: '🔍',
  TRACE: '🔬',
  PROGRESS: '⏳',
  RETRY: '🔄',
  FAST: '⚡',
  SLOW: '🐌',
  SAVED: '💾',
  DELETED: '🗑️ '
} as const;

export interface LogContext {
  component?: keyof typeof ComponentEmoji;
  direction?: keyof typeof Direction;
  installationName?: string;
  zoneName?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

class EnhancedLogger {
  private logger: winston.Logger;
  private shareableMode: boolean = false;
  private obfuscationMap: Map<string, string> = new Map();

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf((info) => {
          return this.formatLog(info.timestamp as string, info.level, info.message, info);
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5
        })
      ]
    });
  }

  private formatLog(timestamp: string, level: string, message: unknown, meta: any): string {
    // Convert message to string
    const messageStr = String(message);
    
    // Get level emoji and color
    const levelInfo = this.getLevelInfo(level);
    
    // Get component emoji
    const componentEmoji = meta.component ? ComponentEmoji[meta.component as keyof typeof ComponentEmoji] || '' : '';
    
    // Get direction indicator
    const direction = meta.direction ? Direction[meta.direction as keyof typeof Direction] || '' : '';
    
    // Format the message with obfuscation if in shareable mode
    const formattedMessage = this.shareableMode ? this.obfuscate(messageStr, meta) : messageStr;
    
    // Build the log line
    let logLine = `${chalk.gray(timestamp)} ${levelInfo.emoji} ${levelInfo.colorFn(`[${level.toUpperCase()}]`)}`;
    
    if (componentEmoji) {
      logLine += ` ${componentEmoji}`;
    }
    
    if (direction) {
      logLine += ` ${direction}`;
    }
    
    if (meta.component) {
      logLine += ` ${chalk.cyan(`[${meta.component}]`)}`;
    }
    
    logLine += ` ${formattedMessage}`;
    
    // Add duration if present
    if (meta.duration !== undefined) {
      const durationEmoji = meta.duration < 1000 ? StatusEmoji.FAST : meta.duration > 5000 ? StatusEmoji.SLOW : '';
      logLine += ` ${durationEmoji} ${chalk.yellow(`(${meta.duration}ms)`)}`;
    }
    
    return logLine;
  }

  private getLevelInfo(level: string): { emoji: string; colorFn: (text: string) => string } {
    switch (level.toLowerCase()) {
      case 'error':
        return { emoji: StatusEmoji.FAILURE, colorFn: chalk.red };
      case 'warn':
        return { emoji: StatusEmoji.WARNING, colorFn: chalk.yellow };
      case 'info':
        return { emoji: StatusEmoji.INFO, colorFn: chalk.blue };
      case 'debug':
        return { emoji: StatusEmoji.DEBUG, colorFn: chalk.magenta };
      default:
        return { emoji: StatusEmoji.TRACE, colorFn: chalk.gray };
    }
  }

  private obfuscate(message: string, meta: any): string {
    let obfuscated = message;
    
    // Obfuscate zone names
    if (meta.zoneName) {
      const obfuscatedZone = this.getObfuscatedZone(meta.zoneName, meta.installationId || '');
      obfuscated = obfuscated.replace(new RegExp(meta.zoneName, 'g'), obfuscatedZone);
    }
    
    // Obfuscate installation names
    if (meta.installationName) {
      const obfuscatedInstall = this.getObfuscatedInstallation(meta.installationName);
      obfuscated = obfuscated.replace(new RegExp(meta.installationName, 'g'), obfuscatedInstall);
    }
    
    // Obfuscate email addresses
    obfuscated = obfuscated.replace(
      /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g,
      (_match, user, domain) => {
        const domainParts = domain.split('.');
        return `${user[0]}***@${domainParts[0][0]}***.${domainParts[domainParts.length - 1]}`;
      }
    );
    
    return obfuscated;
  }

  private getObfuscatedZone(zoneName: string, installationId: string): string {
    const key = `zone:${installationId}:${zoneName}`;
    if (!this.obfuscationMap.has(key)) {
      const letter = String.fromCharCode(65 + this.obfuscationMap.size % 26); // A, B, C...
      this.obfuscationMap.set(key, `Zone_${letter}`);
    }
    return this.obfuscationMap.get(key)!;
  }

  private getObfuscatedInstallation(name: string): string {
    const key = `install:${name}`;
    if (!this.obfuscationMap.has(key)) {
      const index = Array.from(this.obfuscationMap.keys()).filter(k => k.startsWith('install:')).length + 1;
      this.obfuscationMap.set(key, `Install_${index}`);
    }
    return this.obfuscationMap.get(key)!;
  }

  // Public logging methods
  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, { ...context, error: error?.message, stack: error?.stack });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  // Enable/disable shareable mode
  setShareableMode(enabled: boolean): void {
    this.shareableMode = enabled;
  }

  isShareableMode(): boolean {
    return this.shareableMode;
  }
}

// Export singleton instance
export const enhancedLogger = new EnhancedLogger();
export default enhancedLogger;
