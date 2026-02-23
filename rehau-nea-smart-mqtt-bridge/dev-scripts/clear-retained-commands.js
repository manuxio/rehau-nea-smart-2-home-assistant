/**
 * Clear retained MQTT command messages for all zones
 * This prevents old commands from being replayed on bridge restart
 */

const mqtt = require('mqtt');

const MQTT_HOST = process.env.MQTT_HOST || 'automation.local';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883');
const MQTT_USER = process.env.MQTT_USER || 'rehau';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || 'rehau';

// Zone IDs from your system
const ZONE_IDS = [
  '62b994a6bb2c2d01a4d09567', // Salone
  '62b994a9962fbd025befe62d', // Manu
  '62b994a961043401d5f44475', // Arianna
  '62b994a98bb1b902f28a6520', // Cucina
];

async function clearRetainedCommands() {
  console.log('🧹 Clearing retained MQTT command messages...');
  console.log(`   Broker: ${MQTT_HOST}:${MQTT_PORT}`);
  console.log('');

  const client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
    username: MQTT_USER,
    password: MQTT_PASSWORD,
  });

  client.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    console.log('');

    let cleared = 0;
    const total = ZONE_IDS.length * 3; // 3 command topics per zone

    ZONE_IDS.forEach((zoneId) => {
      const topics = [
        `homeassistant/climate/rehau_${zoneId}/mode_command`,
        `homeassistant/climate/rehau_${zoneId}/preset_command`,
        `homeassistant/climate/rehau_${zoneId}/temperature_command`,
      ];

      topics.forEach((topic) => {
        // Publish empty message with retain flag to clear
        client.publish(topic, '', { retain: true }, (err) => {
          if (err) {
            console.error(`❌ Failed to clear ${topic}:`, err.message);
          } else {
            console.log(`✅ Cleared: ${topic}`);
          }
          
          cleared++;
          if (cleared === total) {
            console.log('');
            console.log(`✅ Cleared ${total} retained command messages`);
            console.log('');
            console.log('You can now restart the bridge without old commands being replayed.');
            client.end();
          }
        });
      });
    });
  });

  client.on('error', (err) => {
    console.error('❌ MQTT connection error:', err.message);
    process.exit(1);
  });
}

clearRetainedCommands();
