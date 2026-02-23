/**
 * Test script for Ring Light API endpoint
 * 
 * Usage:
 *   node test-ring-light-api.js <zone-id> <state>
 * 
 * Example:
 *   node test-ring-light-api.js 507f1f77bcf86cd799439011 on
 *   node test-ring-light-api.js 507f1f77bcf86cd799439011 off
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const API_USERNAME = process.env.API_USERNAME || 'admin';
const API_PASSWORD = process.env.API_PASSWORD || 'admin';

async function testRingLight() {
  const zoneId = process.argv[2];
  const state = process.argv[3];

  if (!zoneId || !state) {
    console.error('Usage: node test-ring-light-api.js <zone-id> <state>');
    console.error('Example: node test-ring-light-api.js 507f1f77bcf86cd799439011 on');
    process.exit(1);
  }

  if (state !== 'on' && state !== 'off') {
    console.error('State must be "on" or "off"');
    process.exit(1);
  }

  try {
    console.log(`\n🔦 Testing Ring Light API`);
    console.log(`   Zone ID: ${zoneId}`);
    console.log(`   State: ${state}`);
    console.log('');

    // 1. Login to get token
    console.log('1️⃣  Authenticating...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: API_USERNAME,
      password: API_PASSWORD
    });
    const token = loginResponse.data.token;
    console.log('   ✅ Authenticated');

    // 2. Get zone details before
    console.log('\n2️⃣  Getting zone details (before)...');
    const zoneBefore = await axios.get(`${API_BASE_URL}/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   Zone: ${zoneBefore.data.name}`);
    console.log(`   Ring Light: ${zoneBefore.data.ringLight || 'UNKNOWN'}`);

    // 3. Set ring light
    console.log(`\n3️⃣  Setting ring light to ${state.toUpperCase()}...`);
    const setResponse = await axios.put(
      `${API_BASE_URL}/zones/${zoneId}/ring-light`,
      { state },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`   ✅ Command sent: ${JSON.stringify(setResponse.data)}`);

    // 4. Wait a moment for the command to process
    console.log('\n4️⃣  Waiting 3 seconds for command to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Get zone details after
    console.log('\n5️⃣  Getting zone details (after)...');
    const zoneAfter = await axios.get(`${API_BASE_URL}/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   Zone: ${zoneAfter.data.name}`);
    console.log(`   Ring Light: ${zoneAfter.data.ringLight || 'UNKNOWN'}`);

    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   ${error.message}`);
    }
    console.log('');
    process.exit(1);
  }
}

testRingLight();
