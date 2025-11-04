import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

// Load environment variables FIRST before importing logger
dotenv.config();

import logger from './logger';
import RehauAuthPersistent from './rehau-auth';
import RehauMQTTBridge from './mqtt-bridge';
import ClimateController from './climate-controller';

const app: Express = express();
app.use(express.json());

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

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    authenticated: auth.isAuthenticated(),
    mqttConnected: mqttBridge.isConnected()
  });
});

// Get all installations
app.get('/api/installations', async (_req: Request, res: Response) => {
  try {
    await auth.ensureValidToken();
    const installs = auth.getInstalls();
    res.json({
      success: true,
      installations: installs
    });
  } catch (error) {
    logger.error('Failed to get installations:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Get installation details
app.get('/api/installations/:installId', async (req: Request, res: Response) => {
  try {
    const { installId } = req.params;
    await auth.ensureValidToken();
    const installs = auth.getInstalls();
    const install = installs.find(i => i.unique === installId || i._id === installId);
    
    if (!install) {
      res.status(404).json({
        success: false,
        error: 'Installation not found'
      });
      return;
    }
    
    // Get full installation data
    const fullInstall = await auth.getInstallationData(install);
    
    res.json({
      success: true,
      installation: fullInstall
    });
  } catch (error) {
    logger.error('Failed to get installation:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Get current climate state
app.get('/api/climate/:installId', (req: Request, res: Response) => {
  try {
    const { installId } = req.params;
    const states = climateController.getAllStates().filter(s => s.installId === installId);
    
    if (states.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Climate state not found'
      });
      return;
    }
    
    res.json({
      success: true,
      states
    });
  } catch (error) {
    logger.error('Failed to get climate state:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Set temperature
app.post('/api/climate/:installId/temperature', async (req: Request, res: Response) => {
  try {
    const { temperature } = req.body;
    
    if (!temperature) {
      res.status(400).json({
        success: false,
        error: 'Temperature is required'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Temperature control via API not yet implemented'
    });
  } catch (error) {
    logger.error('Failed to set temperature:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Set mode
app.post('/api/climate/:installId/mode', async (req: Request, res: Response) => {
  try {
    const { mode } = req.body;
    
    if (!mode) {
      res.status(400).json({
        success: false,
        error: 'Mode is required'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Mode control via API not yet implemented'
    });
  } catch (error) {
    logger.error('Failed to set mode:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
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
    logger.info('Authenticating with REHAU...');
    await auth.ensureValidToken();
    logger.info('Authentication successful');
    
    // Get installations
    const installs = auth.getInstalls();
    logger.info(`Found ${installs.length} installation(s)`);
    
    // Connect to MQTT
    logger.info('Connecting to MQTT...');
    await mqttBridge.connect();
    logger.info('MQTT connected');
    
    // Subscribe to installations and get full data
    for (const install of installs) {
      logger.info(`Subscribing to installation: ${install.name} (${install.unique})`);
      await mqttBridge.subscribeToInstallation(install.unique);
      
      // Fetch full installation data with zones via API
      logger.info(`Fetching full installation data for: ${install.name}`);
      const fullInstallData = await auth.getInstallationData(install);
      
      // Initialize climate controller with full data
      climateController.initializeInstallation(fullInstallData);
      logger.info(`Initialized climate control for: ${fullInstallData.name}`);
    }
    
    // Start REST API
    app.listen(config.api.port, () => {
      logger.info(`REST API listening on port ${config.api.port}`);
    });
    
    logger.info('REHAU NEA SMART 2.0 MQTT Bridge started successfully');
    
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
  
  logger.info(`Zone reload scheduled every ${zoneReloadInterval / 1000} seconds`);
}

function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Stopped HTTP polling');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  stopPolling();
  auth.stopTokenRefresh();
  await mqttBridge.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  stopPolling();
  auth.stopTokenRefresh();
  await mqttBridge.disconnect();
  process.exit(0);
});

// Start the application
start();
