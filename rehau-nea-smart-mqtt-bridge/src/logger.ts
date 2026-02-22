import enhancedLogger, { ComponentEmoji, Direction, StatusEmoji } from './logging/enhanced-logger';

// Re-export for backward compatibility
export { registerObfuscation, obfuscate, clearObfuscation, debugDump, redactSensitiveData } from './logging/legacy-compat';

// Export enhanced logger components
export { ComponentEmoji, Direction, StatusEmoji };

// Create a winston-compatible wrapper around enhanced logger
const logger = {
  error: (message: string, ...args: any[]) => {
    const error = args.find(arg => arg instanceof Error);
    const meta = args.find(arg => typeof arg === 'object' && !(arg instanceof Error));
    enhancedLogger.error(message, error, meta);
  },
  warn: (message: string, meta?: any) => {
    enhancedLogger.warn(message, meta);
  },
  info: (message: string, meta?: any) => {
    enhancedLogger.info(message, meta);
  },
  debug: (message: string, meta?: any) => {
    enhancedLogger.debug(message, meta);
  },
  // Winston compatibility
  log: (level: string, message: string, meta?: any) => {
    switch (level) {
      case 'error':
        enhancedLogger.error(message, undefined, meta);
        break;
      case 'warn':
        enhancedLogger.warn(message, meta);
        break;
      case 'info':
        enhancedLogger.info(message, meta);
        break;
      case 'debug':
        enhancedLogger.debug(message, meta);
        break;
    }
  }
};

export default logger;
