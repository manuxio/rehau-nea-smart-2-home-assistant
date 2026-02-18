import * as dotenv from 'dotenv';
import { PlaywrightHttpsClient } from './src/playwright-https-client';
import * as crypto from 'crypto';

dotenv.config();

const email = process.env.REHAU_EMAIL || '';
const password = process.env.REHAU_PASSWORD || '';

if (!email || !password) {
  console.error('ERROR: REHAU_EMAIL and REHAU_PASSWORD environment variables must be set');
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

async function testPlaywrightAuth() {
  const client = new PlaywrightHttpsClient();
  
  try {
    console.log('=== Testing Playwright-based Authentication ===\n');
    
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const nonce = generateNonce();

    const clientId = '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1';
    const redirectUri = 'https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg';
    const scope = 'email roles profile offline_access groups';

    // Step 1: Get authorization page
    console.log('Step 1: Initiating OAuth flow...');
    const authParams = new URLSearchParams({
      client_id: clientId,
      scope: scope,
      response_type: 'code',
      redirect_uri: redirectUri,
      nonce: nonce,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });

    const authUrl = `https://accounts.rehau.com/authz-srv/authz?${authParams.toString()}`;
    
    const authResponse = await client.get(authUrl, {
      maxRedirects: 5
    });
    
    console.log(`✓ Auth response status: ${authResponse.statusCode}`);
    console.log(`✓ Auth response final URL: ${authResponse.finalUrl}`);
    
    // Extract requestId from final URL
    const requestIdMatch = authResponse.finalUrl.match(/[?&]requestId=([^&]+)/);
    
    if (!requestIdMatch) {
      console.error('✗ Failed to extract requestId from authorization flow');
      console.error(`Response body preview: ${authResponse.body.substring(0, 200)}`);
      process.exit(1);
    }
    
    const requestId = requestIdMatch[1];
    console.log(`✓ RequestId obtained: ${requestId}\n`);

    // Step 2: Submit login form
    console.log('Step 2: Submitting credentials...');
    const loginData = new URLSearchParams({
      username: email,
      username_type: 'email',
      password: password,
      requestId: requestId,
      rememberMe: 'true'
    });

    const loginResponse = await client.post(
      'https://accounts.rehau.com/login-srv/login',
      loginData.toString(),
      {
        maxRedirects: 5,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log(`✓ Login response status: ${loginResponse.statusCode}`);
    console.log(`✓ Login response final URL: ${loginResponse.finalUrl}`);
    
    // Check for 403
    if (loginResponse.statusCode === 403) {
      console.error('\n✗ 403 FORBIDDEN - Cloudflare is still blocking!');
      console.error('Response body preview:', loginResponse.body.substring(0, 500));
      console.error('Headers:', JSON.stringify(loginResponse.headers, null, 2));
      process.exit(1);
    }
    
    // Extract authorization code or check for MFA
    const finalLoginUrl = loginResponse.headers.location || loginResponse.finalUrl;
    
    if (finalLoginUrl.includes('/mfa')) {
      console.log('\n✓ MFA redirect detected');
      console.log('MFA URL:', finalLoginUrl);
      console.log('\nNote: Full MFA flow requires POP3 configuration');
      console.log('This test confirms Playwright bypasses Cloudflare successfully!\n');
      process.exit(0);
    }
    
    if (finalLoginUrl.includes('code=')) {
      const codeMatch = finalLoginUrl.match(/[?&]code=([^&]+)/);
      if (codeMatch) {
        console.log('\n✓ Authorization code obtained:', codeMatch[1].substring(0, 20) + '...');
        console.log('\n✓✓✓ SUCCESS! Playwright bypasses Cloudflare! ✓✓✓\n');
        process.exit(0);
      }
    }
    
    console.error('\n✗ Unexpected response - no MFA or auth code found');
    console.error('Final URL:', finalLoginUrl);
    process.exit(1);
    
  } catch (error: any) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.cleanup();
  }
}

testPlaywrightAuth();
