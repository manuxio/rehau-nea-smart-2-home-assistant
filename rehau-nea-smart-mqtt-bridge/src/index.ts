import http from 'http';
import dotenv from 'dotenv';

// Load environment variables FIRST before importing logger
dotenv.config();

import logger, { registerObfuscation } from './logger';
import RehauAuthPersistent from './rehau-auth';
import RehauMQTTBridge from './mqtt-bridge';
import ClimateController from './climate-controller';

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
  api: {
    port: number;
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
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000')
  }
};

// Initialize components
const auth = new RehauAuthPersistent(config.rehau.email, config.rehau.password);
const mqttBridge = new RehauMQTTBridge(auth, config.mqtt);
const rehauApi = auth; // RehauAuth has the API methods
const climateController = new ClimateController(mqttBridge, rehauApi);

// Simple health check server for Docker healthcheck
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      authenticated: auth.isAuthenticated(),
      mqttConnected: mqttBridge.isConnected()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

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
    
    // Start health check server
    healthServer.listen(config.api.port, () => {
      logger.info(`🏥 Health check server listening on port ${config.api.port}`);
    });
    
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

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  stopPolling();
  auth.stopTokenRefresh();
  await mqttBridge.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  stopPolling();
  auth.stopTokenRefresh();
  await mqttBridge.disconnect();
  process.exit(0);
});

// Start the application
start();
