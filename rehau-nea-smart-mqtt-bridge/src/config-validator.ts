/// <reference types="node" />

interface Config {
  rehau: {
    email: string;
    password: string;
  };
  mqtt: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class ConfigValidator {
  /**
   * Main entry point for configuration validation
   */
  static validateConfig(config: Config): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate REHAU configuration
    errors.push(...this.validateRehauConfig(config.rehau));

    // Validate MQTT configuration
    errors.push(...this.validateMqttConfig(config.mqtt));

    // Validate intervals from environment
    errors.push(...this.validateIntervals());

    // Validate optional configuration (warnings only)
    warnings.push(...this.validateOptionalConfig());

    // Separate errors and warnings by severity
    const criticalErrors = errors.filter(e => e.severity === 'error');
    const errorWarnings = errors.filter(e => e.severity === 'warning');
    warnings.push(...errorWarnings);

    return {
      isValid: criticalErrors.length === 0,
      errors: criticalErrors,
      warnings
    };
  }

  /**
   * Validate REHAU credentials
   */
  static validateRehauConfig(rehau: Config['rehau']): ValidationError[] {
    const errors: ValidationError[] = [];

    // Email validation
    if (!rehau.email || rehau.email.trim() === '') {
      errors.push({
        field: 'REHAU_EMAIL',
        message: 'REHAU email is required',
        severity: 'error'
      });
    } else {
      if (!this.isValidEmail(rehau.email)) {
        errors.push({
          field: 'REHAU_EMAIL',
          message: 'REHAU email format is invalid',
          severity: 'error'
        });
      }
      if (rehau.email.length < 5) {
        errors.push({
          field: 'REHAU_EMAIL',
          message: 'REHAU email must be at least 5 characters long',
          severity: 'error'
        });
      }
    }

    // Password validation
    if (!rehau.password || rehau.password.trim() === '') {
      errors.push({
        field: 'REHAU_PASSWORD',
        message: 'REHAU password is required',
        severity: 'error'
      });
    } else {
      if (rehau.password.length < 8) {
        errors.push({
          field: 'REHAU_PASSWORD',
          message: 'REHAU password is less than 8 characters (security warning)',
          severity: 'warning'
        });
      }
    }

    return errors;
  }

  /**
   * Validate MQTT configuration
   */
  static validateMqttConfig(mqtt: Config['mqtt']): ValidationError[] {
    const errors: ValidationError[] = [];

    // Host validation
    if (!mqtt.host || mqtt.host.trim() === '') {
      errors.push({
        field: 'MQTT_HOST',
        message: 'MQTT host is required',
        severity: 'error'
      });
    } else {
      if (!this.isValidHostname(mqtt.host)) {
        errors.push({
          field: 'MQTT_HOST',
          message: 'MQTT host format is invalid (must be a valid hostname or IP address)',
          severity: 'error'
        });
      }
    }

    // Port validation
    if (!this.isValidPort(mqtt.port, 1, 65535)) {
      errors.push({
        field: 'MQTT_PORT',
        message: `MQTT port must be between 1 and 65535 (got: ${mqtt.port})`,
        severity: 'error'
      });
    }

    // Username/password consistency
    if (mqtt.username && mqtt.username.trim() !== '') {
      if (!mqtt.password || mqtt.password.trim() === '') {
        errors.push({
          field: 'MQTT_PASSWORD',
          message: 'MQTT password is required when MQTT username is provided',
          severity: 'error'
        });
      }
    } else if (mqtt.password && mqtt.password.trim() !== '') {
      errors.push({
        field: 'MQTT_USER',
        message: 'MQTT username should be provided when MQTT password is set',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Validate all interval environment variables
   */
  static validateIntervals(): ValidationError[] {
    const errors: ValidationError[] = [];

    // ZONE_RELOAD_INTERVAL: 30-86400 seconds
    const zoneReloadInterval = this.parseIntSafe(
      process.env.ZONE_RELOAD_INTERVAL,
      300,
      30,
      86400
    );
    if (zoneReloadInterval === null && process.env.ZONE_RELOAD_INTERVAL) {
      errors.push({
        field: 'ZONE_RELOAD_INTERVAL',
        message: `ZONE_RELOAD_INTERVAL must be between 30 and 86400 seconds (got: ${process.env.ZONE_RELOAD_INTERVAL})`,
        severity: 'error'
      });
    }

    // TOKEN_REFRESH_INTERVAL: 1800-86400 seconds
    const tokenRefreshInterval = this.parseIntSafe(
      process.env.TOKEN_REFRESH_INTERVAL,
      21600,
      1800,
      86400
    );
    if (tokenRefreshInterval === null && process.env.TOKEN_REFRESH_INTERVAL) {
      errors.push({
        field: 'TOKEN_REFRESH_INTERVAL',
        message: `TOKEN_REFRESH_INTERVAL must be between 1800 and 86400 seconds (got: ${process.env.TOKEN_REFRESH_INTERVAL})`,
        severity: 'error'
      });
    }

    // REFERENTIALS_RELOAD_INTERVAL: 3600-604800 seconds
    const referentialsReloadInterval = this.parseIntSafe(
      process.env.REFERENTIALS_RELOAD_INTERVAL,
      86400,
      3600,
      604800
    );
    if (referentialsReloadInterval === null && process.env.REFERENTIALS_RELOAD_INTERVAL) {
      errors.push({
        field: 'REFERENTIALS_RELOAD_INTERVAL',
        message: `REFERENTIALS_RELOAD_INTERVAL must be between 3600 and 604800 seconds (got: ${process.env.REFERENTIALS_RELOAD_INTERVAL})`,
        severity: 'error'
      });
    }

    // LIVE_DATA_INTERVAL: minimum 60 seconds
    const liveDataInterval = this.parseIntSafe(
      process.env.LIVE_DATA_INTERVAL,
      300,
      60
    );
    if (liveDataInterval === null && process.env.LIVE_DATA_INTERVAL) {
      errors.push({
        field: 'LIVE_DATA_INTERVAL',
        message: `LIVE_DATA_INTERVAL must be at least 60 seconds (got: ${process.env.LIVE_DATA_INTERVAL})`,
        severity: 'error'
      });
    }

    // COMMAND_RETRY_TIMEOUT: 1-300 seconds
    const commandRetryTimeout = this.parseIntSafe(
      process.env.COMMAND_RETRY_TIMEOUT,
      30,
      1,
      300
    );
    if (commandRetryTimeout === null && process.env.COMMAND_RETRY_TIMEOUT) {
      errors.push({
        field: 'COMMAND_RETRY_TIMEOUT',
        message: `COMMAND_RETRY_TIMEOUT must be between 1 and 300 seconds (got: ${process.env.COMMAND_RETRY_TIMEOUT})`,
        severity: 'error'
      });
    }

    // COMMAND_MAX_RETRIES: 1-10
    const commandMaxRetries = this.parseIntSafe(
      process.env.COMMAND_MAX_RETRIES,
      3,
      1,
      10
    );
    if (commandMaxRetries === null && process.env.COMMAND_MAX_RETRIES) {
      errors.push({
        field: 'COMMAND_MAX_RETRIES',
        message: `COMMAND_MAX_RETRIES must be between 1 and 10 (got: ${process.env.COMMAND_MAX_RETRIES})`,
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Validate optional configuration (returns warnings only)
   */
  static validateOptionalConfig(): ValidationError[] {
    const warnings: ValidationError[] = [];

    // LOG_LEVEL validation
    const logLevel = process.env.LOG_LEVEL || 'info';
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(logLevel.toLowerCase())) {
      warnings.push({
        field: 'LOG_LEVEL',
        message: `LOG_LEVEL must be one of: ${validLogLevels.join(', ')} (got: ${logLevel}). Using default: 'info'`,
        severity: 'warning'
      });
    }

    // USE_GROUP_IN_NAMES validation
    const useGroupInNames = process.env.USE_GROUP_IN_NAMES;
    if (useGroupInNames !== undefined && useGroupInNames !== 'true' && useGroupInNames !== 'false') {
      warnings.push({
        field: 'USE_GROUP_IN_NAMES',
        message: `USE_GROUP_IN_NAMES must be 'true' or 'false' (got: ${useGroupInNames}). Using default: 'false'`,
        severity: 'warning'
      });
    }

    return warnings;
  }

  /**
   * Check if email format is valid
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if hostname or IP address is valid
   */
  static isValidHostname(host: string): boolean {
    // Remove whitespace
    const trimmed = host.trim();
    if (trimmed === '') {
      return false;
    }

    // IPv4 regex
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(trimmed)) {
      // Validate each octet is 0-255
      const parts = trimmed.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }

    // IPv6 regex (simplified - allows various formats)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    if (ipv6Regex.test(trimmed)) {
      return true;
    }

    // Hostname regex (allows letters, numbers, dots, hyphens)
    // Must start and end with alphanumeric, can contain dots and hyphens in between
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (hostnameRegex.test(trimmed)) {
      return true;
    }

    // Allow 'localhost' as special case
    if (trimmed.toLowerCase() === 'localhost') {
      return true;
    }

    return false;
  }

  /**
   * Check if port number is valid within range
   */
  static isValidPort(port: number, min: number = 1, max: number = 65535): boolean {
    return Number.isInteger(port) && port >= min && port <= max;
  }

  /**
   * Safely parse integer from environment variable with validation
   * Returns null if value is invalid, otherwise returns parsed number
   */
  static parseIntSafe(
    value: string | undefined,
    defaultVal: number,
    min?: number,
    max?: number
  ): number | null {
    if (value === undefined) {
      return defaultVal;
    }

    const trimmed = value.trim();
    if (trimmed === '') {
      return defaultVal;
    }

    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed)) {
      return null;
    }

    if (min !== undefined && parsed < min) {
      return null;
    }

    if (max !== undefined && parsed > max) {
      return null;
    }

    return parsed;
  }
}

