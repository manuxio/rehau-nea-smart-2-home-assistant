import dotenv from 'dotenv';

// Load environment variables FIRST before importing logger
dotenv.config();

import logger, { registerObfuscation } from './logger';
import RehauAuthPersistent from './rehau-auth';
import RehauMQTTBridge from './mqtt-bridge';
import ClimateController from './climate-controller';
import { ConfigValidator } from './config-validator';

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

// Configuration from environment
const config: Config = {
  rehau: {
    email: process.env.REHAU_EMAIL || '',
    password: process.env.REHAU_PASSWORD || ''
  },
  mqtt: {
    host: process.env.MQTT_HOST || 'localhost',
    port: parseInt(process.env.MQTT_PORT || '1883'),
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD
  }
};

// Log default values being used
if (!process.env.MQTT_HOST) {
  logger.info('Using default MQTT_HOST: localhost');
}
if (!process.env.MQTT_PORT) {
  logger.info('Using default MQTT_PORT: 1883');
}
if (!process.env.ZONE_RELOAD_INTERVAL) {
  logger.info('Using default ZONE_RELOAD_INTERVAL: 300 seconds');
}
if (!process.env.TOKEN_REFRESH_INTERVAL) {
  logger.info('Using default TOKEN_REFRESH_INTERVAL: 21600 seconds');
}
if (!process.env.REFERENTIALS_RELOAD_INTERVAL) {
  logger.info('Using default REFERENTIALS_RELOAD_INTERVAL: 86400 seconds');
}
if (!process.env.LIVE_DATA_INTERVAL) {
  logger.info('Using default LIVE_DATA_INTERVAL: 300 seconds');
}
if (!process.env.COMMAND_RETRY_TIMEOUT) {
  logger.info('Using default COMMAND_RETRY_TIMEOUT: 30 seconds');
}
if (!process.env.COMMAND_MAX_RETRIES) {
  logger.info('Using default COMMAND_MAX_RETRIES: 3');
}
if (!process.env.LOG_LEVEL) {
  logger.info('Using default LOG_LEVEL: info');
}
if (!process.env.USE_GROUP_IN_NAMES) {
  logger.info('Using default USE_GROUP_IN_NAMES: false');
}

// Validate configuration before initializing components
const validationResult = ConfigValidator.validateConfig(config);
if (!validationResult.isValid) {
  logger.error('═══════════════════════════════════════════════════════════════');
  logger.error('❌ Configuration validation failed');
  logger.error('═══════════════════════════════════════════════════════════════');
  validationResult.errors.forEach(err => {
    logger.error(`  [${err.field}] ${err.message}`);
  });
  logger.error('═══════════════════════════════════════════════════════════════');
  process.exit(1);
}

if (validationResult.warnings.length > 0) {
  logger.warn('═══════════════════════════════════════════════════════════════');
  logger.warn('⚠️  Configuration warnings');
  logger.warn('═══════════════════════════════════════════════════════════════');
  validationResult.warnings.forEach(warn => {
    logger.warn(`  [${warn.field}] ${warn.message}`);
  });
  logger.warn('═══════════════════════════════════════════════════════════════');
}

// Initialize components
const auth = new RehauAuthPersistent(config.rehau.email, config.rehau.password);
const mqttBridge = new RehauMQTTBridge(auth, config.mqtt);
const rehauApi = auth; // RehauAuth has the API methods
const climateController = new ClimateController(mqttBridge, rehauApi);

// Start application
async function start() {
  try {
    // Print debug mode warning if enabled
    const logLevel = process.env.LOG_LEVEL || 'info';
    if (logLevel === 'debug') {
      logger.warn('═══════════════════════════════════════════════════════════════');
      logger.warn('⚠️  DEBUG MODE ENABLED - DETAILED LOGGING ACTIVE');
      logger.warn('═══════════════════════════════════════════════════════════════');
      logger.warn('');
      logger.warn('Debug mode logs contain:');
      logger.warn('  • Full MQTT message dumps');
      logger.warn('  • Complete API responses');
      logger.warn('  • System configuration details');
      logger.warn('');
      logger.warn('⚠️  SECURITY WARNING:');
      logger.warn('  While sensitive data is redacted, logs may still contain:');
      logger.warn('  • Partial email addresses');
      logger.warn('  • Installation names and IDs');
      logger.warn('  • Zone names and configuration');
      logger.warn('  • System structure and behavior');
      logger.warn('');
      logger.warn('📋 Before sharing logs:');
      logger.warn('  1. Review all output carefully');
      logger.warn('  2. Check for any personal information');
      logger.warn('  3. Verify redaction is working correctly');
      logger.warn('  4. Look for [DUMP] markers for detailed data');
      logger.warn('');
      logger.warn('💡 Debug logs are useful for:');
      logger.warn('  • Troubleshooting connection issues');
      logger.warn('  • Understanding message formats');
      logger.warn('  • Sharing with developers for parser improvements');
      logger.warn('');
      logger.warn('═══════════════════════════════════════════════════════════════');
      logger.warn('');
    }
    
    // Authenticate with REHAU
    logger.info('🔐 Authenticating with REHAU...');
    await auth.ensureValidToken();
    logger.info('✅ Authentication successful');
    
    // Get installations and register for obfuscation
    const installs = auth.getInstalls();
    logger.info(`📍 Found ${installs.length} installation(s)`);
    
    // Register installation names for obfuscation before logging them
    installs.forEach(install => {
      registerObfuscation('installation', install.name);
    });
    
    // Connect to MQTT
    logger.info('🔌 Connecting to MQTT...');
    await mqttBridge.connect();
    logger.info('✅ MQTT connected');
    
    // Subscribe to installations and get full data
    for (const install of installs) {
      logger.info(`📡 Subscribing to installation: ${install.name} (${install.unique})`);
      await mqttBridge.subscribeToInstallation(install.unique);
      
      // Fetch full installation data with zones via API
      logger.info(`📥 Fetching full installation data for: ${install.name}`);
      const fullInstallData = await auth.getInstallationData(install);
      
      // Initialize climate controller with full data
      climateController.initializeInstallation(fullInstallData);
      logger.info(`✅ Initialized climate control for: ${fullInstallData.name}`);
    }
    
    logger.info('🚀 REHAU NEA SMART 2.0 MQTT Bridge started successfully');
    
    // Request LIVE data for all installations (initial)
    logger.info('📊 Requesting initial LIVE data from installations...');
    for (const install of installs) {
      // Request LIVE_EMU (mixed circuits, pumps, temperatures)
      mqttBridge.requestLiveData(install.unique, 1);
      
      // Wait a bit before requesting next type
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Request LIVE_DIDO (digital inputs/outputs)
      mqttBridge.requestLiveData(install.unique, 0);
    }
    
    // Start periodic LIVE data polling (every 5 minutes)
    const liveDataInterval = parseInt(process.env.LIVE_DATA_INTERVAL || '300'); // Default 5 minutes
    const installUniques = installs.map(i => i.unique);
    mqttBridge.startLiveDataPolling(installUniques, liveDataInterval);
    
    // Start zone reloading with configurable interval
    startPolling();
    
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Reload zones with configurable interval
let pollingInterval: NodeJS.Timeout | null = null;

async function startPolling(): Promise<void> {
  const zoneReloadInterval = parseInt(process.env.ZONE_RELOAD_INTERVAL || '300') * 1000; // Default 5 minutes
  
  pollingInterval = setInterval(async () => {
    try {
      logger.debug('Reloading zone data...');
      const installs = auth.getInstalls();
      
      for (const install of installs) {
        const fullInstallData = await auth.getInstallationData(install);
        climateController.updateInstallationData(fullInstallData);
        logger.debug(`Updated data for: ${fullInstallData.name}`);
      }
    } catch (error) {
      logger.error('Zone reload error:', (error as Error).message);
    }
  }, zoneReloadInterval);
  
  logger.info(`⏰ Zone reload scheduled every ${zoneReloadInterval / 1000} seconds`);
}

function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('⏹️  Stopped HTTP polling');
  }
}

// Flag to prevent multiple cleanup calls
let isShuttingDown = false;

/**
 * Centralized shutdown function with timeout protection
 */
async function shutdown(exitCode: number): Promise<void> {
  // Prevent multiple shutdown calls
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring duplicate call');
    return;
  }
  
  isShuttingDown = true;
  logger.info('🛑 Starting graceful shutdown...');
  
  // Set timeout for shutdown (30 seconds max)
  const shutdownTimeout = setTimeout(() => {
    logger.error('⚠️  Shutdown timeout exceeded (30s), forcing exit');
    process.exit(exitCode);
  }, 30000);
  
  try {
    // Step 1: Stop polling
    logger.info('Step 1: Stopping polling...');
    stopPolling();
    logger.info('✅ Polling stopped');
    
    // Step 2: Cleanup ClimateController
    logger.info('Step 2: Cleaning up ClimateController...');
    climateController.cleanup();
    logger.info('✅ ClimateController cleaned up');
    
    // Step 3: Cleanup MQTT Bridge
    logger.info('Step 3: Cleaning up MQTT Bridge...');
    await mqttBridge.cleanup();
    logger.info('✅ MQTT Bridge cleaned up');
    
    // Step 4: Cleanup Auth
    logger.info('Step 4: Cleaning up Auth...');
    auth.cleanup();
    logger.info('✅ Auth cleaned up');
    
    // Clear shutdown timeout
    clearTimeout(shutdownTimeout);
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(exitCode);
  } catch (error) {
    logger.error('❌ Error during shutdown:', (error as Error).message);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM');
  await shutdown(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT');
  await shutdown(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error: Error) => {
  logger.error('❌ Uncaught Exception:', error.message);
  logger.error('Stack:', error.stack);
  await shutdown(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
  logger.error('❌ Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
  await shutdown(1);
});

// Start the application
start();
