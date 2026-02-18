import { CurlHttpsClient } from './src/curl-https-client';
import * as crypto from 'crypto';

// Load environment variables
const email = process.env.REHAU_EMAIL || 'manu@cappelleri.net';
const password = process.env.REHAU_PASSWORD || '';

if (!password) {
  console.error('ERROR: REHAU_PASSWORD environment variable not set');
  process.exit(1);
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

async function testCurlAuth() {
  console.log('=== Testing Curl-Based Authentication ===\n');
  
  const client = new CurlHttpsClient();
  
  try {
    // Step 1: OAuth flow
    console.log('Step 1: Initiating OAuth flow...');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const nonce = generateNonce();
    
    const clientId = '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1';
    const redirectUri = 'https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg';
    const scope = 'email roles profile offline_access groups';
    
    const authUrl = `https://accounts.rehau.com/authz-srv/authz?client_id=${clientId}&scope=${encodeURIComponent(scope)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&nonce=${nonce}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
    
    const authResponse = await client.get(authUrl, {
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    console.log(`✓ Auth response status: ${authResponse.statusCode}`);
    console.log(`✓ Final URL: ${authResponse.finalUrl}`);
    
    // Extract requestId from finalUrl
    const requestIdMatch = authResponse.finalUrl.match(/requestId=([^&]+)/);
    if (!requestIdMatch) {
      console.error('✗ Failed to extract requestId from URL:', authResponse.finalUrl);
      console.error('Response body preview:', authResponse.body.substring(0, 500));
      process.exit(1);
    }
    
    const requestId = requestIdMatch[1];
    console.log(`✓ RequestId: ${requestId}\n`);
    
    // Step 2: Submit login credentials
    console.log('Step 2: Submitting login credentials...');
    const loginData = new URLSearchParams();
    loginData.append('username', email);
    loginData.append('username_type', 'email');
    loginData.append('password', password);
    loginData.append('requestId', requestId);
    loginData.append('rememberMe', 'true');
    
    const loginResponse = await client.post(
      'https://accounts.rehau.com/login-srv/login',
      loginData.toString(),
      {
        maxRedirects: 5,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Origin': 'https://accounts.rehau.com',
          'Referer': `https://accounts.rehau.com/rehau-ui/login?requestId=${requestId}&view_type=login`,
          'Connection': 'close'
        }
      }
    );
    
    console.log(`✓ Login response status: ${loginResponse.statusCode}`);
    console.log(`✓ Final URL: ${loginResponse.finalUrl}`);
    console.log(`✓ Body length: ${loginResponse.body.length} bytes`);
    
    if (loginResponse.statusCode === 403) {
      console.error('✗ Got 403 - Cloudflare blocked the request');
      console.error('Response body preview:', loginResponse.body.substring(0, 500));
      process.exit(1);
    }
    
    if (loginResponse.statusCode === 302 || loginResponse.statusCode === 200) {
      console.log('✓ Login succeeded (got redirect or success page)');
      
      // Check if MFA is required
      if (loginResponse.finalUrl.includes('/mfa') || loginResponse.body.includes('mfa')) {
        console.log('✓ MFA required - authentication flow working correctly!');
      } else if (loginResponse.finalUrl.includes('code=')) {
        console.log('✓ Got authorization code - no MFA required!');
      } else {
        console.log('⚠ Unexpected response - check finalUrl and body');
        console.log('Final URL:', loginResponse.finalUrl);
        console.log('Body preview:', loginResponse.body.substring(0, 300));
      }
    } else {
      console.error(`✗ Unexpected status code: ${loginResponse.statusCode}`);
      console.error('Body preview:', loginResponse.body.substring(0, 500));
      process.exit(1);
    }
    
    console.log('\n✓✓✓ Curl-based authentication test PASSED! ✓✓✓');
    
  } catch (error: any) {
    console.error('\n✗✗✗ Test FAILED ✗✗✗');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    client.cleanup();
  }
}

testCurlAuth();
