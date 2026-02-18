const axios = require('axios');
const https = require('https');

const url = 'https://accounts.rehau.com/authz-srv/authz?client_id=3f5d915d-a06f-42b9-89cc-2e5d63aa96f1&scope=email+roles+profile+offline_access+groups&response_type=code&redirect_uri=https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg&nonce=test123&code_challenge_method=S256&code_challenge=test456';

async function testWithCustomAgent() {
  console.log('=== Testing axios with custom agent (rejectUnauthorized: false) ===');
  try {
    const httpsAgent = new https.Agent({  
      rejectUnauthorized: false,
      keepAlive: false
    });
    
    const response = await axios.get(url, {
      httpsAgent,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
  } catch (error) {
    console.log('❌ FAILED!');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.message);
  }
}

async function testWithoutAgent() {
  console.log('\n=== Testing axios WITHOUT custom agent ===');
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
  } catch (error) {
    console.log('❌ FAILED!');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.message);
  }
}

async function testWithMinimalConfig() {
  console.log('\n=== Testing axios with MINIMAL config ===');
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
  } catch (error) {
    console.log('❌ FAILED!');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.message);
  }
}

async function run() {
  await testWithCustomAgent();
  await testWithoutAgent();
  await testWithMinimalConfig();
}

run().catch(console.error);
