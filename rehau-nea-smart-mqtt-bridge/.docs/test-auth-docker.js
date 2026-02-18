// Test authentication from Docker to debug Cloudflare 403
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

async function testAuth() {
    console.log('Testing authentication from Docker environment...');
    
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    
    const authUrl = 'https://accounts.rehau.com/authz-srv/authz?client_id=3f5d915d-a06f-42b9-89cc-2e5d63aa96f1&scope=email+roles+profile+offline_access+groups&response_type=code&redirect_uri=https%3A%2F%2Frehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com%2Fpublicimages%2Fpreprod%2Frehau.jpg&nonce=test123&code_challenge_method=S256&code_challenge=test456';
    
    console.log('\n1. Testing with current headers...');
    try {
        const response = await client.get(authUrl, {
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
            withCredentials: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        console.log('✅ SUCCESS! Status:', response.status);
        console.log('Response URL:', response.request?.res?.responseUrl);
    } catch (error) {
        console.log('❌ FAILED! Status:', error.response?.status);
        console.log('Error:', error.message);
        console.log('Response headers:', error.response?.headers);
        
        // Check if it's Cloudflare
        if (error.response?.headers?.server === 'cloudflare') {
            console.log('\n🔥 CLOUDFLARE DETECTED!');
            console.log('cf-mitigated:', error.response?.headers?.['cf-mitigated']);
            console.log('cf-ray:', error.response?.headers?.['cf-ray']);
        }
    }
    
    console.log('\n2. Testing with curl-like headers...');
    try {
        const response = await client.get(authUrl, {
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
            withCredentials: true,
            headers: {
                'User-Agent': 'curl/7.68.0',
                'Accept': '*/*'
            }
        });
        console.log('✅ SUCCESS with curl! Status:', response.status);
    } catch (error) {
        console.log('❌ FAILED with curl! Status:', error.response?.status);
    }
    
    console.log('\n3. Testing with Android headers...');
    try {
        const response = await client.get(authUrl, {
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
            withCredentials: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        console.log('✅ SUCCESS with Android! Status:', response.status);
    } catch (error) {
        console.log('❌ FAILED with Android! Status:', error.response?.status);
    }
}

testAuth().catch(console.error);
