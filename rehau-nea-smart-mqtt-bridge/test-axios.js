const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const url = 'https://accounts.rehau.com/authz-srv/authz?client_id=3f5d915d-a06f-42b9-89cc-2e5d63aa96f1&scope=email+roles+profile+offline_access+groups&response_type=code&redirect_uri=https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg&nonce=test123&code_challenge_method=S256&code_challenge=test456';

async function testPlainAxios() {
  console.log('=== Testing PLAIN AXIOS ===');
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
    console.log('Final URL:', response.request?.res?.responseUrl || response.config.url);
  } catch (error) {
    console.log('❌ FAILED!');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.message);
    if (error.response?.headers?.server === 'cloudflare') {
      console.log('Cloudflare detected!');
    }
  }
}

async function testAxiosWithCookieJar() {
  console.log('\n=== Testing AXIOS WITH COOKIEJAR ===');
  try {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    
    const response = await client.get(url, {
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Final URL:', response.request?.res?.responseUrl || response.config.url);
  } catch (error) {
    console.log('❌ FAILED!');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.message);
    if (error.response?.headers?.server === 'cloudflare') {
      console.log('Cloudflare detected!');
    }
  }
}

async function run() {
  await testPlainAxios();
  await testAxiosWithCookieJar();
}

run().catch(console.error);
