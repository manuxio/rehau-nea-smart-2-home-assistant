import winston from 'winston';
import { LogLevel } from './types';

const logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

/**
 * Type guard to check if value is a plain object (not array, not null)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Redact sensitive information from objects for safe logging
 * Useful for sharing logs with other developers
 */
export function redactSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }
  
  if (!isPlainObject(obj)) {
    return obj;
  }
  
  const redacted: Record<string, unknown> = {};
  const sensitiveKeys = [
    'password', 'token', 'access_token', 'refresh_token', 'id_token',
    'authorization', 'auth', 'secret', 'api_key', 'apikey',
    'email', 'username', 'login', 'credential',
    // Address fields
    'address', 'street', 'city', 'zip', 'postal', 'country',
    'latitude', 'longitude', 'lat', 'lng', 'location'
  ];
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key exactly matches or contains sensitive keywords
    // But exclude 'user' as a standalone key (it's usually an object container)
    const isSensitive = sensitiveKeys.some(sk => {
      if (sk === 'user' && lowerKey === 'user') {
        return false; // Don't redact 'user' object itself
      }
      return lowerKey.includes(sk);
    });
    
    if (isSensitive) {
      if (typeof value === 'string' && value.length > 0) {
        // Show first 2 and last 2 characters for strings
        if (value.length <= 4) {
          redacted[key] = '***';
        } else {
          redacted[key] = `${value.substring(0, 2)}...${value.substring(value.length - 2)}`;
        }
      } else if (typeof value === 'number') {
        // Redact numbers (lat/lng, zip codes, etc.)
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Obfuscation registry for consistent name replacement
 */
class ObfuscationRegistry {
  private installationMap: Map<string, string> = new Map();
  private groupMap: Map<string, string> = new Map();
  private zoneMap: Map<string, string> = new Map();
  private emailMap: Map<string, string> = new Map();
  
  private installationCounter = 0;
  private groupCounter = 0;
  private zoneCounter = 0;
  private emailCounter = 0;
  
  obfuscateInstallation(name: string): string {
    if (!this.installationMap.has(name)) {
      this.installationCounter++;
      this.installationMap.set(name, `Installation_${this.installationCounter}`);
    }
    return this.installationMap.get(name)!;
  }
  
  obfuscateGroup(name: string): string {
    if (!this.groupMap.has(name)) {
      this.groupCounter++;
      this.groupMap.set(name, `Group_${this.groupCounter}`);
    }
    return this.groupMap.get(name)!;
  }
  
  obfuscateZone(name: string): string {
    if (!this.zoneMap.has(name)) {
      this.zoneCounter++;
      this.zoneMap.set(name, `Zone_${this.zoneCounter}`);
    }
    return this.zoneMap.get(name)!;
  }
  
  obfuscateEmail(email: string): string {
    if (!this.emailMap.has(email)) {
      this.emailCounter++;
      this.emailMap.set(email, `user${this.emailCounter}@example.com`);
    }
    return this.emailMap.get(email)!;
  }
  
  /**
   * Obfuscate a string by replacing known names with placeholders
   */
  obfuscateString(text: string): string {
    let result = text;
    
    // Replace emails first
    this.emailMap.forEach((placeholder, original) => {
      result = result.replace(new RegExp(this.escapeRegex(original), 'g'), placeholder);
    });
    
    // Replace installation names
    this.installationMap.forEach((placeholder, original) => {
      result = result.replace(new RegExp(this.escapeRegex(original), 'gi'), placeholder);
    });
    
    // Replace group names
    this.groupMap.forEach((placeholder, original) => {
      result = result.replace(new RegExp(this.escapeRegex(original), 'gi'), placeholder);
    });
    
    // Replace zone names
    this.zoneMap.forEach((placeholder, original) => {
      result = result.replace(new RegExp(this.escapeRegex(original), 'gi'), placeholder);
    });
    
    return result;
  }
  
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  clear(): void {
    this.installationMap.clear();
    this.groupMap.clear();
    this.zoneMap.clear();
    this.emailMap.clear();
    this.installationCounter = 0;
    this.groupCounter = 0;
    this.zoneCounter = 0;
    this.emailCounter = 0;
  }
}

// Global obfuscation registry
const obfuscationRegistry = new ObfuscationRegistry();

/**
 * Register names for obfuscation
 */
export function registerObfuscation(type: 'installation' | 'group' | 'zone' | 'email', name: string): void {
  switch (type) {
    case 'installation':
      obfuscationRegistry.obfuscateInstallation(name);
      break;
    case 'group':
      obfuscationRegistry.obfuscateGroup(name);
      break;
    case 'zone':
      obfuscationRegistry.obfuscateZone(name);
      break;
    case 'email':
      obfuscationRegistry.obfuscateEmail(name);
      break;
  }
}

/**
 * Obfuscate a string by replacing all known names with placeholders
 * Only active at info level, debug level shows original
 */
export function obfuscate(text: string): string {
  if (logLevel === 'debug') {
    return text;
  }
  return obfuscationRegistry.obfuscateString(text);
}

/**
 * Clear obfuscation registry (useful for testing)
 */
export function clearObfuscation(): void {
  obfuscationRegistry.clear();
}

/**
 * Safe JSON stringify that handles circular references
 */
function safeStringify(obj: unknown, indent: number = 2): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Filter out functions
    if (typeof value === 'function') {
      return '[Function]';
    }
    return value;
  }, indent);
}

/**
 * Log full message dump in debug mode (with redacted sensitive data)
 * @param label - Label for the dump
 * @param data - Data to dump
 * @param condensed - If true, use single-line format (no indentation)
 */
export function debugDump(label: string, data: unknown, condensed: boolean = false): void {
  if (logLevel === 'debug') {
    try {
      const redacted = redactSensitiveData(data);
      const indent = condensed ? 0 : 2;
      const formatted = safeStringify(redacted, indent);
      
      if (condensed) {
        logger.debug(`[DUMP] ${label}: ${formatted}`);
      } else {
        logger.debug(`[DUMP] ${label}:\n${formatted}`);
      }
    } catch (error) {
      logger.debug(`[DUMP] ${label}: [Unable to serialize data]`);
    }
  }
}

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Apply obfuscation at info level
      let finalMessage = String(message);
      if (level === 'info' && logLevel !== 'debug') {
        finalMessage = obfuscationRegistry.obfuscateString(finalMessage);
      }
      
      let msg = `[${timestamp}] [${level.toUpperCase()}] ${finalMessage}`;
      
      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        // Filter out empty objects and stack traces for cleaner output
        const filteredMeta = Object.entries(meta)
          .filter(([key, value]) => {
            if (key === 'stack') return false;
            if (typeof value === 'object' && value !== null && Object.keys(value as object).length === 0) return false;
            return true;
          })
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
        
        if (Object.keys(filteredMeta).length > 0) {
          try {
            msg += ' ' + safeStringify(filteredMeta, 2);
          } catch (error) {
            msg += ' [Unable to serialize metadata]';
          }
        }
      }
      
      return msg;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
});

export default logger;
