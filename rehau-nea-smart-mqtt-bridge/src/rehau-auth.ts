import axios, { AxiosResponse, AxiosError } from 'axios';
import * as crypto from 'crypto';
import logger, { registerObfuscation, debugDump } from './logger';
import { RehauTokenResponse } from './types';
import { UserDataParserV2, InstallationDataParserV2, type IInstall } from './parsers';
import { POP3Client, POP3Config } from './pop3-client';
import { PlaywrightHttpsClient } from './playwright-https-client';

/**
 * Type guard to check if an error is an AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError?: boolean }).isAxiosError === true
  );
}

interface InstallInfo {
  unique: string;
  name: string;
  _id: string;
}

class RehauAuthPersistent {
  private email: string;
  private password: string;
  private clientId: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private installs: InstallInfo[] = [];
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private tokenRefreshInterval: number;
  private isCleanedUp: boolean = false;
  private pop3Client: POP3Client | null = null;

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
    this.clientId = `app-${crypto.randomUUID()}`;
    this.tokenRefreshInterval = parseInt(process.env.TOKEN_REFRESH_INTERVAL || '21600') * 1000; // Default 6 hours
    
    // Initialize POP3 client if configured
    if (process.env.POP3_EMAIL && process.env.POP3_PASSWORD) {
      logger.info('POP3 configuration detected - automated 2FA enabled');
      
      const pop3Config: POP3Config = {
        email: process.env.POP3_EMAIL,
        password: process.env.POP3_PASSWORD,
        host: process.env.POP3_HOST || 'pop.gmx.com',
        port: parseInt(process.env.POP3_PORT || '995'),
        secure: process.env.POP3_SECURE === 'true',
        debug: process.env.POP3_DEBUG === 'true',
        timeout: parseInt(process.env.POP3_TIMEOUT || '600000')
      };
      
      this.pop3Client = new POP3Client(pop3Config);
    } else {
      logger.warn(
        'POP3 configuration not found. If 2FA is enabled, authentication will fail. ' +
        'Please configure POP3_EMAIL and POP3_PASSWORD environment variables.'
      );
    }
  }

  /**
   * Start automatic token refresh
   */
  private startTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
    }

    this.tokenRefreshTimer = setInterval(async () => {
      try {
        logger.info('Refreshing token automatically...');
        await this.refresh();
        logger.info('Token refreshed successfully');
      } catch (error) {
        logger.error('Failed to refresh token:', (error as Error).message);
        // Try fresh login if refresh fails
        try {
          logger.info('Attempting fresh login after refresh failure...');
          await this.login();
        } catch (loginError) {
          logger.error('Fresh login also failed:', (loginError as Error).message);
        }
      }
    }, this.tokenRefreshInterval);

    logger.info(`Token refresh scheduled every ${this.tokenRefreshInterval / 1000} seconds`);
  }

  /**
   * Stop automatic token refresh
   */
  stopTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /**
   * Cleanup method to stop timers and release resources
   * Idempotent: safe to call multiple times
   */
  cleanup(): void {
    if (this.isCleanedUp) {
      logger.debug('RehauAuthPersistent already cleaned up, skipping');
      return;
    }
    
    logger.info('Cleaning up RehauAuthPersistent...');
    this.stopTokenRefresh();
    
    // Cleanup POP3 connection
    if (this.pop3Client) {
      this.pop3Client.disconnect().catch(err => {
        logger.warn('Error disconnecting POP3 client:', err);
      });
      this.pop3Client = null;
    }
    
    // Verify cleanup completed
    if (this.tokenRefreshTimer !== null) {
      logger.warn('Token refresh timer was not properly cleaned up');
    }
    
    this.isCleanedUp = true;
    logger.info('RehauAuthPersistent cleanup completed');
  }

  /**
   * Generate PKCE parameters
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Authenticate with username and password via form submission
   */
  async login(): Promise<boolean> {
    // Use Playwright-based HTTPS client (real browser bypasses Cloudflare bot detection)
    const client = new PlaywrightHttpsClient();
    
    try {
      // Register email for obfuscation before logging
      registerObfuscation('email', this.email);
      
      logger.info('Authenticating with form-based flow...');
      logger.info(`Email: ${this.email}`);
      
      // Generate PKCE parameters
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const nonce = this.generateNonce();

      const clientId = '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1';
      const redirectUri = 'https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg';
      const scope = 'email roles profile offline_access groups';

      // Step 1: Get authorization page
      logger.debug('Step 1: Initiating OAuth flow...');
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
      
      logger.debug('Making auth request with native HTTPS client...');
      
      // Add small delay to avoid triggering Cloudflare rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const authResponse = await client.get(authUrl, {
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'close'
        }
      });
      
      logger.debug(`Auth response status: ${authResponse.statusCode}`);
      logger.debug(`Auth response final URL: ${authResponse.finalUrl}`);
      
      // Extract requestId from final URL - if we have it, the redirect worked even if status is 403
      const requestIdMatch = authResponse.finalUrl.match(/[?&]requestId=([^&]+)/);
      
      if (!requestIdMatch) {
        // Only fail if we don't have a requestId
        logger.error(`Auth failed with status ${authResponse.statusCode}`);
        logger.error(`Response body preview: ${authResponse.body.substring(0, 200)}`);
        throw new Error('Failed to extract requestId from authorization flow');
      }
      
      // Debug: Check if cookies were set
      logger.debug('Auth response set-cookie headers:', authResponse.headers['set-cookie']);
      
      // We have a requestId, so the OAuth flow succeeded even if final page returned 403
      logger.debug('OAuth redirect successful - requestId obtained despite 403 status');
      const requestId = requestIdMatch[1];
      logger.debug(`RequestId obtained: ${requestId}`);

      logger.debug('Step 2: Submitting credentials...');
      
      // Step 2: Submit login form
      const loginData = new URLSearchParams({
        username: this.email,
        username_type: 'email',
        password: this.password,
        requestId: requestId,
        rememberMe: 'true'
      });

      logger.debug('=== LOGIN REQUEST ===');
      logger.debug('URL: POST https://accounts.rehau.com/login-srv/login');
      logger.debug('Payload:', loginData.toString());
      logger.debug('Payload fields:', {
        username: this.email,
        username_type: 'email',
        password: '***',
        requestId: requestId,
        rememberMe: 'true'
      });
      
      const loginPayloadString = loginData.toString();
      logger.debug('Login payload length:', loginPayloadString.length);
      
      let loginResponse: any;
      try {
        logger.debug('About to make login POST request...');
        const startTime = Date.now();
        
        loginResponse = await client.post(
          'https://accounts.rehau.com/login-srv/login',
          loginPayloadString,
          {
            maxRedirects: 5,  // Allow redirects for login POST
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
        
        const elapsed = Date.now() - startTime;
        logger.debug(`Login POST completed in ${elapsed}ms`);
        logger.debug('Response received, type:', typeof loginResponse);
        logger.info(`CRITICAL DEBUG - Response is undefined: ${loginResponse === undefined}`);
        logger.info(`CRITICAL DEBUG - Response is null: ${loginResponse === null}`);
        logger.info(`CRITICAL DEBUG - Response truthy: ${!!loginResponse}`);
      } catch (error: any) {
        logger.error('=== LOGIN ERROR ===');
        logger.error('Error message:', error.message);
        logger.error('Error stack:', error.stack);
        throw error;
      }
      
      logger.debug('=== LOGIN RESPONSE ===');
      logger.debug('Full response object:', JSON.stringify(loginResponse, null, 2));
      logger.debug('Status:', loginResponse?.statusCode);
      logger.debug('Location header:', loginResponse?.headers?.location);
      logger.debug('Final URL:', loginResponse?.finalUrl);
      logger.debug('Body length:', loginResponse?.body?.length || 0);
      logger.debug('All response headers:', JSON.stringify(loginResponse?.headers, null, 2));
      
      // Log full body if 403 for debugging
      if (loginResponse?.statusCode === 403) {
        logger.error('=== 403 FORBIDDEN DETECTED ===');
        logger.error('Full response body:', loginResponse.body);
        logger.error('Content-Type:', loginResponse?.headers?.['content-type']);
        logger.error('Server:', loginResponse?.headers?.['server']);
        logger.error('CF-Ray:', loginResponse?.headers?.['cf-ray']);
        logger.error('All headers:', JSON.stringify(loginResponse?.headers, null, 2));
      }
      
      // Extract authorization code or handle MFA from location header or final URL
      const finalLoginUrl = (loginResponse?.headers?.location as string) || loginResponse?.finalUrl;
      
      // Check if we have a valid redirect URL (MFA or auth code)
      if (!finalLoginUrl || (!finalLoginUrl.includes('/mfa') && !finalLoginUrl.includes('code='))) {
        logger.error('Unexpected login status:', loginResponse.statusCode);
        logger.error('No valid redirect URL found');
        logger.error('Response body preview:', loginResponse.body.substring(0, 1000));
        throw new Error(`Login failed with status ${loginResponse.statusCode}`);
      }
      
      logger.debug('Login redirect URL obtained:', finalLoginUrl);
      let authCode: string | null = null;
      
      // Check for MFA redirect
      if (finalLoginUrl && finalLoginUrl.includes('/rehau-ui/mfa')) {
        logger.info('MFA required - initiating automated 2FA flow');
        
        // Extract MFA parameters from URL
        const url = new URL(finalLoginUrl);
        const trackId = url.searchParams.get('track_id');
        const sub = url.searchParams.get('sub');
        const mfaRequestId = url.searchParams.get('requestId');
        
        if (!trackId || !sub || !mfaRequestId) {
          throw new Error('Failed to extract MFA parameters from redirect URL');
        }
        
        logger.debug(`MFA Parameters: track_id=${trackId}, sub=${sub}, requestId=${mfaRequestId}`);
        
        // Handle MFA flow with POP3 using the client with cookie jar
        authCode = await this.handleMfaFlowWithPOP3(trackId, sub, mfaRequestId, client);
      } else {
        // Original flow - extract auth code directly
        if (finalLoginUrl) {
          const codeMatch = finalLoginUrl.match(/[?&]code=([^&]+)/);
          if (codeMatch) {
            authCode = codeMatch[1];
          }
        }
        
        if (!authCode && loginResponse.headers.location) {
          const location = loginResponse.headers.location as string;
          const url = new URL(location, 'https://accounts.rehau.com');
          authCode = url.searchParams.get('code');
        }
        
        if (!authCode) {
          throw new Error('No authorization code found - check credentials');
        }

        logger.debug('Authorization code obtained');
      }

      // Step 3: Exchange code for tokens
      logger.debug('Step 3: Exchanging code for tokens...');
      const tokenPayload = {
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        code: authCode
      };
      
      const tokenResponse = await client.post(
        'https://accounts.rehau.com/token-srv/token',
        JSON.stringify(tokenPayload),
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.accessToken = tokenResponse.data.access_token;
      this.refreshToken = tokenResponse.data.refresh_token;
      this.tokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000);

      logger.debug('Tokens obtained');

      // Get user info
      await this.getUserInfo();

      logger.info('Authentication successful');
      return true;
    } catch (error) {
      const axiosError = error as { response?: { data?: unknown; status?: number }; message: string };
      logger.error('Authentication failed:', axiosError.response?.data || axiosError.message);
      if (axiosError.response?.status === 401) {
        logger.error('Invalid username or password');
      }
      throw error;
    } finally {
      // Always cleanup Playwright browser resources
      await client.cleanup();
    }
  }

  /**
   * Handle MFA flow with POP3 email polling
   */
  private async handleMfaFlowWithPOP3(
    trackId: string,
    sub: string,
    requestId: string,
    client: any
  ): Promise<string> {
    logger.info('Starting automated MFA flow with POP3 email polling');
    
    if (!this.pop3Client) {
      throw new Error(
        'POP3 client not configured. Please set POP3_EMAIL, POP3_PASSWORD, ' +
        'and other POP3_* environment variables.'
      );
    }
    
    try {
      // Step 1: Get current email count
      logger.debug('Step 1: Getting current email count...');
      await this.pop3Client.getMessageCount();
      
      // Step 1.5: Visit the MFA page to establish session context
      logger.debug('=== VISITING MFA PAGE ===');
      const mfaPageUrl = `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`;
      logger.debug('URL: GET', mfaPageUrl);
      
      await client.get(mfaPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': `https://accounts.rehau.com/login-srv/login`
        }
      });
      
      logger.debug('MFA page visited successfully');
      
      // Step 2: Check configured MFA methods
      logger.debug('=== CONFIGURED METHODS REQUEST ===');
      logger.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/setup/public/configured/list');
      const configuredPayload = { request_id: requestId, sub: sub };
      logger.debug('Payload:', JSON.stringify(configuredPayload));
      
      let configuredResponse;
      try {
        configuredResponse = await client.post(
          'https://accounts.rehau.com/verification-srv/v2/setup/public/configured/list',
          JSON.stringify(configuredPayload),
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Origin': 'https://accounts.rehau.com',
              'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
            }
          }
        );
      } catch (error: any) {
        logger.error('=== CONFIGURED METHODS ERROR ===');
        logger.error('Error message:', error.message);
        logger.error('Error response status:', error.response?.status);
        logger.error('Error response data:', JSON.stringify(error.response?.data));
        throw error;
      }
      
      logger.debug('=== CONFIGURED METHODS RESPONSE ===');
      logger.debug('Response object exists:', !!configuredResponse);
      logger.debug('HTTP Status:', String(configuredResponse.status));
      
      // Log the entire response structure
      const responseData = configuredResponse.data;
      logger.debug('Response data exists:', !!responseData);
      
      if (responseData) {
        logger.debug('Configured methods response received', { success: responseData.success, status: responseData.status });
      }
      
      // Extract medium_id from response - the actual data is in response.data.data
      const actualData = configuredResponse.data?.data || configuredResponse.data;
      const mediumId = this.extractMediumId(actualData);
      logger.debug(`Medium ID: ${mediumId}`);
      
      // Step 3: Initiate email verification
      logger.debug('=== INITIATE EMAIL REQUEST ===');
      logger.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/authenticate/initiate/email');
      const initiatePayload = {
        sub: sub,
        medium_id: mediumId,
        request_id: requestId,
        usage_type: 'MULTIFACTOR_AUTHENTICATION'
      };
      logger.debug('Payload:', JSON.stringify(initiatePayload));
      
      let initiateResponse;
      try {
        initiateResponse = await client.post(
          'https://accounts.rehau.com/verification-srv/v2/authenticate/initiate/email',
          JSON.stringify(initiatePayload),
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Origin': 'https://accounts.rehau.com',
              'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
            }
          }
        );
      } catch (error: any) {
        logger.error('=== INITIATE EMAIL ERROR ===');
        logger.error('Error message:', error.message);
        logger.error('Error response status:', error.response?.status);
        logger.error('Error response data:', JSON.stringify(error.response?.data));
        throw error;
      }
      
      logger.debug('=== INITIATE EMAIL RESPONSE ===');
      logger.debug('Status:', initiateResponse.status);
      logger.debug('Initiate response data:', JSON.stringify(initiateResponse.data));
      
      const exchangeId = this.extractExchangeId(initiateResponse.data);
      logger.debug(`Exchange ID: ${exchangeId}`);
      logger.info('Verification email sent. Waiting for email...');
      
      // Step 3.5: Visit the MFA verify page to establish session
      logger.debug('=== VISITING MFA VERIFY PAGE ===');
      const mfaVerifyUrl = `https://accounts.rehau.com/rehau-ui/mfaverify/${exchangeId}/email/${sub}/${mediumId}/${requestId}`;
      logger.debug('MFA verify URL:', mfaVerifyUrl);
      
      try {
        const verifyPageResponse = await client.get(mfaVerifyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
          }
        });
        logger.debug('MFA verify page visited successfully, status:', verifyPageResponse.status);
      } catch (error: any) {
        logger.error('Failed to visit MFA verify page:', error.message);
        logger.error('Response status:', error.response?.status);
        throw error;
      }
      
      // Step 4: Wait for verification email
      logger.debug('Step 4: Polling POP3 for verification email...');
      const timeout = parseInt(process.env.POP3_TIMEOUT || '600000');
      const verificationEmail = await this.pop3Client.waitForNewMessage(
        'noreply@accounts.rehau.com',
        timeout
      );
      
      if (!verificationEmail) {
        throw new Error('Timeout waiting for verification email');
      }
      
      logger.info('Verification email received');
      
      // Step 5: Extract verification code
      logger.debug('Step 5: Extracting verification code from email...');
      const verificationCode = this.pop3Client.extractVerificationCode(
        verificationEmail.body
      );
      
      if (!verificationCode) {
        throw new Error('Failed to extract verification code from email');
      }
      
      logger.info(`Verification code extracted: ${verificationCode}`);
      
      // Step 6: Verify the code
      logger.debug('=== VERIFY CODE REQUEST ===');
      logger.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/authenticate/authenticate/email');
      
      const verifyPayload = {
        pass_code: verificationCode,
        exchange_id: exchangeId,
        sub: sub
      };
      logger.debug('Verify code payload:', JSON.stringify(verifyPayload));
      
      let verifyResponse;
      try {
        verifyResponse = await client.post(
          'https://accounts.rehau.com/verification-srv/v2/authenticate/authenticate/email',
          JSON.stringify(verifyPayload),
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
              'Origin': 'https://accounts.rehau.com',
              'Referer': `https://accounts.rehau.com/rehau-ui/mfaverify/${exchangeId}/email/${sub}/${mediumId}/${requestId}`
            }
          }
        );
      } catch (error: any) {
        logger.error('=== VERIFY CODE ERROR ===');
        logger.error('Error message:', error.message);
        logger.error('Error response status:', error.response?.status);
        logger.error('Error response data:', JSON.stringify(error.response?.data));
        throw new Error(`Failed to verify code: ${error.response?.data?.error?.error || error.message}`);
      }
      
      logger.debug('=== VERIFY CODE RESPONSE ===');
      logger.debug('Verify response:', JSON.stringify(verifyResponse.data));
      
      const statusId = verifyResponse.data?.data?.status_id || verifyResponse.data?.status_id;
      if (!statusId) {
        logger.error('No status_id in verify response:', JSON.stringify(verifyResponse.data));
        throw new Error('Failed to get status_id from verify response');
      }
      logger.debug(`Status ID: ${statusId}`);
      
      // Step 7: Complete authentication with form POST
      logger.debug('Step 7: Completing authentication...');
      const continueParams = new URLSearchParams({
        status_id: statusId,
        track_id: trackId,
        requestId: requestId,
        sub: sub,
        verificationType: 'EMAIL'
      });
      
      const continueResponse = await client.post(
        `https://accounts.rehau.com/login-srv/precheck/continue/${trackId}`,
        continueParams.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          maxRedirects: 5
        }
      );
      
      // Step 8: Extract authorization code from final URL
      logger.debug('Step 8: Extracting authorization code...');
      logger.debug('Continue response status:', continueResponse.statusCode);
      logger.debug('Final URL:', continueResponse.finalUrl);
      
      const finalUrl = new URL(continueResponse.finalUrl);
      const authCode = finalUrl.searchParams.get('code');
      
      if (!authCode) {
        logger.error('No authorization code in final URL:', continueResponse.finalUrl);
        throw new Error('No authorization code found in redirect URL');
      }
      
      logger.info('MFA flow completed successfully');
      return authCode;
      
    } catch (error) {
      logger.error('MFA flow failed:', error);
      throw error;
    } finally {
      // Cleanup POP3 connection
      if (this.pop3Client) {
        await this.pop3Client.disconnect();
      }
    }
  }

  /**
   * Extract medium_id from configured MFA methods response
   */
  private extractMediumId(responseData: any): string {
    logger.debug('Extracting medium_id from configured methods');
    
    // The actual structure is: { configured_list: [ { type: 'EMAIL', mediums: [...] } ] }
    if (responseData.configured_list && Array.isArray(responseData.configured_list)) {
      const emailConfig = responseData.configured_list.find((item: any) => item.type === 'EMAIL');
      if (emailConfig && emailConfig.mediums && Array.isArray(emailConfig.mediums) && emailConfig.mediums.length > 0) {
        const mediumId = emailConfig.mediums[0].medium_id || emailConfig.mediums[0].id;
        logger.debug('Found medium_id:', mediumId);
        return mediumId;
      }
    }
    
    throw new Error('No email medium found in configured MFA methods');
  }

  /**
   * Extract exchange_id from initiate email response
   */
  private extractExchangeId(responseData: any): string {
    logger.debug('Extracting exchange_id from response');
    
    // The response structure is: responseData.data.exchange_id.exchange_id (string)
    if (responseData.data && responseData.data.exchange_id) {
      const exchangeIdObj = responseData.data.exchange_id;
      
      // Extract the actual exchange_id string from the object
      if (typeof exchangeIdObj === 'string') {
        logger.debug('Extracted exchange_id:', exchangeIdObj);
        return exchangeIdObj;
      } else if (exchangeIdObj.exchange_id) {
        logger.debug('Extracted exchange_id:', exchangeIdObj.exchange_id);
        return exchangeIdObj.exchange_id;
      }
    }
    
    // Check for status_id as fallback
    if (responseData.data && responseData.data.status_id) {
      logger.debug('Using status_id as exchange_id:', responseData.data.status_id);
      return responseData.data.status_id;
    }
    
    logger.error('No exchange_id found in initiate email response');
    throw new Error('No exchange_id found in initiate email response');
  }

  /**
   * Get user information and installations
   */
  private async getUserInfo(): Promise<void> {
    try {
      logger.debug('Fetching user data...');
      
      const headers = {
        'Authorization': this.accessToken!,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
        'Origin': 'http://android.neasmart.de',
        'Referer': 'http://android.neasmart.de/',
        'Accept': 'application/json, text/plain, */*'
      };

      const response = await axios.get(
        `https://api.nea2aws.aws.rehau.cloud/v2/users/${this.email}/getUserData`,
        { headers }
      );

      // Log HTTP response details
      logger.info(`getUserData HTTP Response: status=${response.status}`);
      logger.debug('Response headers:', response.headers);
      
      debugDump('getUserData API Response', response.data);

      // Use V2 parser to extract user data
      const parser = new UserDataParserV2();
      const parsed = parser.parse(response.data);
      
      this.installs = parsed.installations.map(install => ({
        unique: install.unique,
        name: install.name,
        _id: install._id
      }));
      
      logger.info(`Found ${this.installs.length} installation(s)`);
      logger.debug('Parsed user data:', parser.getSummary(parsed));
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        logger.error(`getUserData HTTP Error: status=${error.response?.status}`);
        logger.error('Error response headers:', error.response?.headers);
        logger.error('Error response body:', error.response?.data);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to get user info:', errorMessage);
    }
  }

  /**
   * Refresh access token
   */
  async refresh(): Promise<boolean> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please login first.');
    }

    try {
      logger.debug('Refreshing access token...');
      
      const response: AxiosResponse<RehauTokenResponse> = await axios.post(
        'https://accounts.rehau.com/token-srv/token',
        {
          grant_type: 'refresh_token',
          client_id: '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1',
          refresh_token: this.refreshToken
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      logger.debug('Tokens obtained');

      logger.info('Token refreshed');
      return true;
    } catch (error) {
      const axiosError = error as { response?: { data?: unknown; status?: number }; message: string };
      logger.error('Token refresh failed:', axiosError.response?.data || axiosError.message);
      
      if (axiosError.response?.status === 401) {
        logger.info('Refresh token expired, logging in again...');
        return await this.login();
      }
      throw error;
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    // Consider expired if less than 5 minutes remaining
    return Date.now() >= (this.tokenExpiry - 300000);
  }

  /**
   * Ensure we have a valid access token
   * Always performs fresh login on first call
   */
  async ensureValidToken(): Promise<void> {
    // Always perform fresh login
    await this.login();
    
    // Start automatic token refresh
    this.startTokenRefresh();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getClientId(): string {
    return this.clientId;
  }

  getEmail(): string {
    return this.email;
  }

  getInstalls(): InstallInfo[] {
    return this.installs;
  }

  getPrimaryInstallUnique(): string | null {
    return this.installs.length > 0 ? this.installs[0].unique : null;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Get full installation data including zones and controllers
   */
  async getInstallationData(install: InstallInfo): Promise<IInstall> {
    try {
      const installIds = this.installs.map(i => i._id).join(',');
      const url = `https://api.nea2aws.aws.rehau.cloud/v2/users/${this.email}/getDataofInstall` +
                  `?demand=${install._id}` +
                  `&installsList=${installIds}`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': this.accessToken!,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
          'Origin': 'http://android.neasmart.de',
          'Referer': 'http://android.neasmart.de/',
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        }
      });

      // Log HTTP response details
      logger.info(`getInstallationData HTTP Response: status=${response.status}`);
      logger.debug('Response headers:', response.headers);
      
      // Use condensed format for large installation data
      debugDump('getInstallationData API Response', response.data, true);
      
      // Use V2 parser to extract installation data
      const parser = new InstallationDataParserV2();
      const parsed = parser.parse(response.data, install.unique);
      
      logger.debug('Parsed installation data:', parser.getSummary(parsed));

      // Get typed installation data (without raw fields)
      const typedData = parser.getTyped(parsed);
      
      // Find the specific installation
      const installation = typedData.installs.find(i => i.unique === install.unique);
      if (!installation) {
        throw new Error(`Installation ${install.unique} not found in parsed data`);
      }
      
      return installation;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        logger.error(`getInstallationData HTTP Error: status=${error.response?.status}`);
        logger.error('Error response headers:', error.response?.headers);
        logger.error('Error response body:', error.response?.data);
      }
      throw error;
    }
  }
}

export default RehauAuthPersistent;
