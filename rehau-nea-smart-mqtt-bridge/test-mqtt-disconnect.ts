import dotenv from 'dotenv';
import RehauAuthPersistent from './src/rehau-auth';
import RehauMQTTBridge from './src/mqtt-bridge';
import logger from './src/logger';

// Load environment variables
dotenv.config();

async function testMqttDisconnection() {
  logger.info('=== MQTT Disconnection Test ===');
  logger.info('This test will:');
  logger.info('1. Authenticate with REHAU');
  logger.info('2. Connect to MQTT brokers');
  logger.info('3. Wait 60 seconds');
  logger.info('4. Simulate MQTT disconnection');
  logger.info('5. Observe reconnection behavior');
  logger.info('================================\n');

  const email = process.env.REHAU_EMAIL;
  const password = process.env.REHAU_PASSWORD;
  const mqttHost = process.env.MQTT_HOST || 'localhost';
  const mqttPort = parseInt(process.env.MQTT_PORT || '1883');
  const mqttUser = process.env.MQTT_USER || '';
  const mqttPassword = process.env.MQTT_PASSWORD || '';

  if (!email || !password) {
    logger.error('REHAU_EMAIL and REHAU_PASSWORD must be set in .env file');
    process.exit(1);
  }

  // Initialize auth
  const auth = new RehauAuthPersistent(email, password);
  
  try {
    // Authenticate
    logger.info('🔐 Authenticating with REHAU...');
    await auth.ensureValidToken();
    logger.info('✅ Authentication successful\n');

    // Initialize MQTT bridge
    logger.info('🔌 Initializing MQTT bridge...');
    const mqttConfig = {
      host: mqttHost,
      port: mqttPort,
      username: mqttUser,
      password: mqttPassword
    };
    const mqttBridge = new RehauMQTTBridge(auth, mqttConfig);
    await mqttBridge.connect();
    logger.info('✅ MQTT bridge connected\n');

    // Wait 60 seconds
    logger.info('⏳ Waiting 60 seconds before simulating disconnection...');
    for (let i = 60; i > 0; i--) {
      if (i % 10 === 0 || i <= 5) {
        logger.info(`   ${i} seconds remaining...`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('\n💥 Simulating MQTT disconnection...');
    
    // Force disconnect both MQTT clients
    const rehauClient = (mqttBridge as any).rehauClient;
    const homeAssistantClient = (mqttBridge as any).homeAssistantClient;

    if (rehauClient && rehauClient.connected) {
      logger.info('   Forcing REHAU MQTT client disconnect...');
      rehauClient.end(true); // Force disconnect without waiting
      logger.info('   ✓ REHAU client disconnected');
    }

    if (homeAssistantClient && homeAssistantClient.connected) {
      logger.info('   Forcing Home Assistant MQTT client disconnect...');
      homeAssistantClient.end(true); // Force disconnect without waiting
      logger.info('   ✓ Home Assistant client disconnected');
    }

    logger.info('\n📊 Observing initial reconnection behavior...');
    logger.info('   Waiting 30 seconds for reconnection...\n');
    
    // Wait 30 seconds to observe first reconnection
    await new Promise(resolve => setTimeout(resolve, 30000));

    logger.info('\n💥 Simulating authentication token expiration...');
    logger.info('   Invalidating refresh token to force full reauthentication...\n');
    
    // Invalidate the refresh token to force full reauthentication
    (auth as any).refreshToken = null;
    (auth as any).accessToken = null;
    (auth as any).tokenExpiry = null;
    
    logger.info('   ✓ Tokens invalidated - next reconnection will require full login\n');
    
    // Force another disconnection to trigger reauthentication
    logger.info('💥 Forcing second disconnection to trigger reauthentication...');
    const rehauClient2 = (mqttBridge as any).rehauClient;
    if (rehauClient2 && rehauClient2.connected) {
      logger.info('   Forcing REHAU MQTT client disconnect...');
      rehauClient2.end(true);
      logger.info('   ✓ REHAU client disconnected');
    }

    logger.info('\n📊 Observing reauthentication flow...');
    logger.info('   This should trigger full MFA login flow');
    logger.info('   (Press Ctrl+C to stop)\n');

    // Keep the process running to observe reauthentication
    await new Promise(() => {}); // Run forever

  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('\n\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n\n🛑 Test terminated');
  process.exit(0);
});

// Run the test
testMqttDisconnection().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
