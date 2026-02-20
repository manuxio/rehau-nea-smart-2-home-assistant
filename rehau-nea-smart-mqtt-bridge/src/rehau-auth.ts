import axios, { AxiosResponse, AxiosError } from 'axios';
import * as crypto from 'crypto';
import * as https from 'https';
import * as zlib from 'zlib';
import { Readable } from 'stream';
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
   * Authenticate with username and password via Playwright browser automation
   */
  async login(): Promise<boolean> {
    // Use Playwright for interactive browser-based authentication
    const client = new PlaywrightHttpsClient();
    let browserCleaned = false;
    
    try {
      // Register email for obfuscation before logging
      registerObfuscation('email', this.email);
      
      logger.info('=== Starting Playwright-based authentication ===');
      logger.info(`Email: ${this.email}`);
      
      // Generate PKCE parameters
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const nonce = this.generateNonce();
      
      logger.debug('PKCE Parameters:');
      logger.debug('  Code Verifier:', codeVerifier.substring(0, 10) + '...');
      logger.debug('  Code Challenge:', codeChallenge.substring(0, 10) + '...');
      logger.debug('  Nonce:', nonce.substring(0, 10) + '...');

      const clientId = '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1';
      const redirectUri = 'https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg';
      const scope = 'email roles profile offline_access groups';

      // Step 1: Build OAuth authorization URL
      logger.info('Step 1: Building OAuth authorization URL...');
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
      logger.info(`Authorization URL generated: ${authUrl}`);
      
      // Step 2: Navigate to authorization URL
      logger.info('Step 2: Navigating to authorization page...');
      await client.navigate(authUrl);
      logger.info('Authorization page loaded');
      
      // Step 3: Wait for login form elements
      logger.info('Step 3: Waiting for login form elements...');
      await client.waitForElementById('email', 30000);
      await client.waitForElementById('password', 30000);
      logger.info('Login form elements found');
      
      // Step 4: Fill in credentials
      logger.info('Step 4: Filling in credentials...');
      await client.typeById('email', this.email);
      logger.info('Email entered');
      await client.typeById('password', this.password);
      logger.info('Password entered');
      
      // Step 5: Submit login form
      logger.info('Step 5: Submitting login form...');
      await client.clickSubmit();
      logger.info('Login form submitted');
      
      // Step 6: Wait for either MFA code input or redirect to final URL
      logger.info('Step 6: Waiting for response (MFA or redirect)...');
      
      let authCode: string | null = null;
      
      try {
        // Try to wait for MFA code input (with shorter timeout)
        logger.info('Checking for MFA requirement...');
        await client.waitForElementById('code', 10000);
        logger.info('MFA required - 2FA code input detected');
        
        // Step 7: Handle MFA flow
        logger.info('Step 7: Handling MFA flow...');
        authCode = await this.handleMfaFlowWithPlaywright(client);
        
      } catch (error: any) {
        // No MFA required - check if we already have the redirect
        logger.info('No MFA required or already redirected');
        const currentUrl = client.getCurrentUrl();
        logger.info(`Current URL: ${currentUrl}`);
        
        if (currentUrl.startsWith(redirectUri)) {
          // Already redirected - extract code
          const url = new URL(currentUrl);
          authCode = url.searchParams.get('code');
          logger.info('Authorization code extracted from redirect URL');
        } else {
          // Wait for redirect to happen
          logger.info('Waiting for redirect to final URL...');
          const finalUrl = await client.waitForUrlPrefix(redirectUri, 60000);
          const url = new URL(finalUrl);
          authCode = url.searchParams.get('code');
          logger.info('Authorization code extracted after redirect');
        }
      }
      
      if (!authCode) {
        throw new Error('Failed to obtain authorization code');
      }
      
      logger.info(`Authorization code obtained: ${authCode.substring(0, 8)}...`);

      // Step 8: Exchange code for tokens (BEFORE browser cleanup to avoid timing issues)
      logger.info('Step 8: Exchanging authorization code for tokens...');
      logger.debug('Authorization code length:', authCode.length);
      logger.debug('Code verifier length:', codeVerifier.length);
      
      const tokenPayload = {
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        code: authCode
      };
      
      logger.debug('Token exchange request:', {
        url: 'https://accounts.rehau.com/token-srv/token',
        grant_type: tokenPayload.grant_type,
        client_id: tokenPayload.client_id,
        redirect_uri: tokenPayload.redirect_uri,
        code_length: authCode.length,
        code_verifier_length: codeVerifier.length,
        code_verifier_preview: codeVerifier.substring(0, 10) + '...',
        auth_code_preview: authCode.substring(0, 10) + '...'
      });
      
      // Use native https module for better reliability (no axios dependency issues)
      logger.debug('Creating HTTPS request for token exchange...');
      const tokenResponse = await new Promise<RehauTokenResponse>((resolve, reject) => {
        const postData = JSON.stringify(tokenPayload);
        logger.debug('POST data length:', postData.length);
        
        const options = {
          hostname: 'accounts.rehau.com',
          port: 443,
          path: '/token-srv/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://accounts.rehau.com',
            'Referer': 'https://accounts.rehau.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
          }
        };
        
        logger.debug('Sending HTTPS request...');
        const req = https.request(options, (res) => {
          logger.debug('Received response callback, status:', res.statusCode);
          const chunks: Buffer[] = [];
          
          // Handle response stream based on encoding
          let responseStream: Readable = res;
          const encoding = res.headers['content-encoding'];
          logger.debug('Response encoding:', encoding || 'none');
          
          if (encoding === 'gzip') {
            logger.debug('Setting up gzip decompression');
            responseStream = res.pipe(zlib.createGunzip());
          } else if (encoding === 'deflate') {
            logger.debug('Setting up deflate decompression');
            responseStream = res.pipe(zlib.createInflate());
          } else if (encoding === 'br') {
            logger.debug('Setting up brotli decompression');
            responseStream = res.pipe(zlib.createBrotliDecompress());
          }
          
          responseStream.on('data', (chunk: Buffer) => {
            logger.debug('Received data chunk, size:', chunk.length);
            chunks.push(chunk);
          });
          
          responseStream.on('end', () => {
            logger.debug('Response stream ended, total chunks:', chunks.length);
            const data = Buffer.concat(chunks).toString('utf-8');
            logger.debug(`Token exchange response status: ${res.statusCode}`);
            logger.debug(`Response encoding: ${encoding || 'none'}`);
            logger.debug(`Response length: ${data.length} bytes`);
            logger.debug(`Response data: ${data}`);
            
            if (res.statusCode === 200) {
              try {
                const response = JSON.parse(data);
                resolve(response);
              } catch (parseError) {
                logger.error('Failed to parse token response:', data);
                reject(new Error(`Failed to parse token response: ${parseError}`));
              }
            } else {
              logger.error('=== Token Exchange Failed ===');
              logger.error('HTTP Status:', res.statusCode);
              logger.error('Status Message:', res.statusMessage);
              logger.error('Response Headers:', JSON.stringify(res.headers, null, 2));
              logger.error('Response Body:', data);
              reject(new Error(`Token exchange failed with status ${res.statusCode}: ${data}`));
            }
          });
          
          responseStream.on('error', (error) => {
            logger.error('=== Response Stream Decompression Error ===');
            logger.error('Error message:', error.message);
            logger.error('Error code:', (error as any).code);
            logger.error('Error stack:', error.stack);
            logger.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            reject(error);
          });
        });
        
        req.on('error', (error) => {
          logger.error('=== Token Exchange Request Failed ===');
          logger.error('Error Message:', error.message);
          logger.error('Error Code:', (error as any).code || 'N/A');
          logger.error('Stack Trace:', error.stack);
          reject(error);
        });
        
        req.write(postData);
        req.end();
      });

      if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
        logger.error('Invalid token response - missing tokens:', JSON.stringify(tokenResponse, null, 2));
        throw new Error('Token exchange succeeded but response is missing access_token or refresh_token');
      }

      this.accessToken = tokenResponse.access_token;
      this.refreshToken = tokenResponse.refresh_token;
      this.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);

      logger.info('Tokens obtained successfully');
      logger.debug('Token expiry:', new Date(this.tokenExpiry).toISOString());

      // Cleanup browser AFTER token exchange completes
      logger.info('Cleaning up browser resources...');
      await client.cleanup();
      browserCleaned = true;
      logger.info('Browser closed');

      // Step 9: Get user info
      logger.info('Step 9: Fetching user information...');
      await this.getUserInfo();

      logger.info('=== Authentication completed successfully ===');
      return true;
    } catch (error) {
      logger.error('=== Authentication failed ===');
      
      if (isAxiosError(error)) {
        logger.error('Error Type: Axios HTTP Error');
        logger.error('HTTP Status:', error.response?.status || 'N/A');
        logger.error('Status Text:', error.response?.statusText || 'N/A');
        logger.error('Response Data:', error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'N/A');
        logger.error('Request URL:', error.config?.url || 'N/A');
        logger.error('Request Method:', error.config?.method?.toUpperCase() || 'N/A');
        
        if (error.response?.status === 401) {
          logger.error('Authentication rejected - Invalid username or password');
        } else if (error.response?.status === 400) {
          logger.error('Bad request - Check authorization code and PKCE parameters');
        } else if (error.response?.status === 403) {
          logger.error('Forbidden - Access denied');
        } else if (!error.response) {
          logger.error('No response received - Network error or request failed to send');
        }
      } else if (error instanceof Error) {
        logger.error('Error Type:', error.constructor.name);
        logger.error('Error Message:', error.message);
        if (error.stack) {
          logger.error('Stack Trace:', error.stack);
        }
      } else {
        logger.error('Unknown Error Type:', typeof error);
        logger.error('Error:', JSON.stringify(error, null, 2));
      }
      
      throw error;
    } finally {
      // Only cleanup if we haven't already done so in the success path
      if (!browserCleaned) {
        try {
          await client.cleanup();
          logger.debug('Browser cleanup completed (error path)');
        } catch (cleanupError) {
          logger.warn('Browser cleanup failed (non-critical):', cleanupError);
        }
      }
    }
  }

  /**
   * Handle MFA flow with Playwright and POP3 email polling
   */
  private async handleMfaFlowWithPlaywright(client: PlaywrightHttpsClient): Promise<string> {
    logger.info('=== Starting MFA flow with Playwright ===');
    
    if (!this.pop3Client) {
      throw new Error(
        'POP3 client not configured. Please set POP3_EMAIL, POP3_PASSWORD, ' +
        'and other POP3_* environment variables for automated 2FA.'
      );
    }
    
    let verificationEmail: any = null;
    
    try {
      const redirectUri = 'https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg';
      
      // Step 1: Get current email count (baseline)
      logger.info('Step 1: Getting current email count...');
      await this.pop3Client.getMessageCount();
      logger.info('Baseline email count established');
      
      // Step 2: Wait for verification email
      logger.info('Step 2: Waiting for verification email from REHAU...');
      const timeout = parseInt(process.env.POP3_TIMEOUT || '600000');
      const fromAddress = process.env.POP3_FROM_ADDRESS || 'noreply@accounts.rehau.com';
      verificationEmail = await this.pop3Client.waitForNewMessage(
        fromAddress,
        timeout
      );
      
      if (!verificationEmail) {
        throw new Error('Timeout waiting for verification email');
      }
      
      logger.info('Verification email received');
      
      // Step 3: Extract verification code from email
      logger.info('Step 3: Extracting verification code from email...');
      const verificationCode = this.pop3Client.extractVerificationCode(
        verificationEmail.body
      );
      
      if (!verificationCode) {
        throw new Error('Failed to extract verification code from email');
      }
      
      logger.info(`Verification code extracted: ${verificationCode}`);
      
      // Step 4: Enter verification code in browser
      logger.info('Step 4: Entering verification code in browser...');
      await client.typeById('code', verificationCode);
      logger.info('Verification code entered');
      
      // Step 5: Submit verification form
      logger.info('Step 5: Submitting verification form...');
      await client.clickSubmit();
      logger.info('Verification form submitted');
      
      // Step 6: Wait for redirect to final URL with authorization code
      logger.info('Step 6: Waiting for redirect to final URL...');
      const finalUrl = await client.waitForUrlPrefix(redirectUri, 60000);
      logger.info(`Redirected to: ${finalUrl}`);
      
      // Step 7: Extract authorization code from URL
      logger.info('Step 7: Extracting authorization code from URL...');
      const url = new URL(finalUrl);
      const authCode = url.searchParams.get('code');
      
      if (!authCode) {
        throw new Error('No authorization code found in redirect URL');
      }
      
      logger.info(`Authorization code obtained: ${authCode.substring(0, 8)}...`);
      logger.info('=== MFA flow completed successfully ===');
      
      // Step 8: Delete verification email after successful MFA
      if (verificationEmail && verificationEmail.messageNumber) {
        try {
          logger.info('Step 8: Deleting verification email from server...');
          await this.pop3Client.deleteMessage(verificationEmail.messageNumber);
          logger.info('Verification email deleted successfully');
        } catch (deleteError) {
          logger.warn('Failed to delete verification email (non-critical):', deleteError);
        }
      }
      
      return authCode;
      
    } catch (error) {
      logger.error('=== MFA flow failed ===');
      logger.error('Error:', error);
      throw error;
    } finally {
      // Cleanup POP3 connection
      if (this.pop3Client) {
        await this.pop3Client.disconnect();
      }
    }
  }

  /**
   * Handle MFA flow with POP3 email polling (legacy method for non-Playwright flows)
   * @deprecated This method is no longer used by the Playwright-based login flow
   * Kept for reference and potential fallback scenarios
   */
  // private async handleMfaFlowWithPOP3(
  //   trackId: string,
  //   sub: string,
  //   requestId: string,
  //   client: any
  // ): Promise<string> {
  //   logger.info('Starting automated MFA flow with POP3 email polling');
    
  //   if (!this.pop3Client) {
  //     throw new Error(
  //       'POP3 client not configured. Please set POP3_EMAIL, POP3_PASSWORD, ' +
  //       'and other POP3_* environment variables.'
  //     );
  //   }
    
  //   try {
  //     // Step 1: Get current email count
  //     logger.debug('Step 1: Getting current email count...');
  //     await this.pop3Client.getMessageCount();
      
  //     // Step 1.5: Visit the MFA page to establish session context
  //     logger.debug('=== VISITING MFA PAGE ===');
  //     const mfaPageUrl = `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`;
  //     logger.debug('URL: GET', mfaPageUrl);
      
  //     await client.get(mfaPageUrl, {
  //       headers: {
  //         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  //         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  //         'Referer': `https://accounts.rehau.com/login-srv/login`
  //       }
  //     });
      
  //     logger.debug('MFA page visited successfully');
      
  //     // Step 2: Check configured MFA methods
  //     logger.debug('=== CONFIGURED METHODS REQUEST ===');
  //     logger.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/setup/public/configured/list');
  //     const configuredPayload = { request_id: requestId, sub: sub };
  //     logger.debug('Payload:', JSON.stringify(configuredPayload));
      
  //     let configuredResponse;
  //     try {
  //       configuredResponse = await client.post(
  //         'https://accounts.rehau.com/verification-srv/v2/setup/public/configured/list',
  //         JSON.stringify(configuredPayload),
  //         {
  //           headers: {
  //             'Content-Type': 'application/json',
  //             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  //             'Accept': 'application/json, text/plain, */*',
  //             'Origin': 'https://accounts.rehau.com',
  //             'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
  //           }
  //         }
  //       );
  //     } catch (error: any) {
  //       logger.error('=== CONFIGURED METHODS ERROR ===');
  //       logger.error('Error message:', error.message);
  //       logger.error('Error response status:', error.response?.status);
  //       logger.error('Error response data:', JSON.stringify(error.response?.data));
  //       throw error;
  //     }
      
  //     logger.debug('=== CONFIGURED METHODS RESPONSE ===');
  //     logger.debug('Response object exists:', !!configuredResponse);
  //     logger.debug('HTTP Status:', String(configuredResponse.status));
      
  //     // Log the entire response structure
  //     const responseData = configuredResponse.data;
  //     logger.debug('Response data exists:', !!responseData);
      
  //     if (responseData) {
  //       logger.debug('Configured methods response received', { success: responseData.success, status: responseData.status });
  //     }
      
  //     // Extract medium_id from response - the actual data is in response.data.data
  //     const actualData = configuredResponse.data?.data || configuredResponse.data;
  //     const mediumId = this.extractMediumId(actualData);
  //     logger.debug(`Medium ID: ${mediumId}`);
      
  //     // Step 3: Initiate email verification
  //     logger.debug('=== INITIATE EMAIL REQUEST ===');
  //     logger.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/authenticate/initiate/email');
  //     const initiatePayload = {
  //       sub: sub,
  //       medium_id: mediumId,
  //       request_id: requestId,
  //       usage_type: 'MULTIFACTOR_AUTHENTICATION'
  //     };
  //     logger.debug('Payload:', JSON.stringify(initiatePayload));
      
  //     let initiateResponse;
  //     try {
  //       initiateResponse = await client.post(
  //         'https://accounts.rehau.com/verification-srv/v2/authenticate/initiate/email',
  //         JSON.stringify(initiatePayload),
  //         {
  //           headers: {
  //             'Content-Type': 'application/json',
  //             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  //             'Accept': 'application/json, text/plain, */*',
  //             'Origin': 'https://accounts.rehau.com',
  //             'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
  //           }
  //         }
  //       );
  //     } catch (error: any) {
  //       logger.error('=== INITIATE EMAIL ERROR ===');
  //       logger.error('Error message:', error.message);
  //       logger.error('Error response status:', error.response?.status);
  //       logger.error('Error response data:', JSON.stringify(error.response?.data));
  //       throw error;
  //     }
      
  //     logger.debug('=== INITIATE EMAIL RESPONSE ===');
  //     logger.debug('Status:', initiateResponse.status);
  //     logger.debug('Initiate response data:', JSON.stringify(initiateResponse.data));
      
  //     const exchangeId = this.extractExchangeId(initiateResponse.data);
  //     logger.debug(`Exchange ID: ${exchangeId}`);
  //     logger.info('Verification email sent. Waiting for email...');
      
  //     // Step 3.5: Visit the MFA verify page to establish session
  //     logger.debug('=== VISITING MFA VERIFY PAGE ===');
  //     const mfaVerifyUrl = `https://accounts.rehau.com/rehau-ui/mfaverify/${exchangeId}/email/${sub}/${mediumId}/${requestId}`;
  //     logger.debug('MFA verify URL:', mfaVerifyUrl);
      
  //     try {
  //       const verifyPageResponse = await client.get(mfaVerifyUrl, {
  //         headers: {
  //           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  //           'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  //           'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
  //         }
  //       });
  //       logger.debug('MFA verify page visited successfully, status:', verifyPageResponse.status);
  //     } catch (error: any) {
  //       logger.error('Failed to visit MFA verify page:', error.message);
  //       logger.error('Response status:', error.response?.status);
  //       throw error;
  //     }
      
  //     // Step 4: Wait for verification email
  //     logger.debug('Step 4: Polling POP3 for verification email...');
  //     const timeout = parseInt(process.env.POP3_TIMEOUT || '600000');
  //     const verificationEmail = await this.pop3Client.waitForNewMessage(
  //       'noreply@accounts.rehau.com',
  //       timeout
  //     );
      
  //     if (!verificationEmail) {
  //       throw new Error('Timeout waiting for verification email');
  //     }
      
  //     logger.info('Verification email received');
      
  //     // Step 5: Extract verification code
  //     logger.debug('Step 5: Extracting verification code from email...');
  //     const verificationCode = this.pop3Client.extractVerificationCode(
  //       verificationEmail.body
  //     );
      
  //     if (!verificationCode) {
  //       throw new Error('Failed to extract verification code from email');
  //     }
      
  //     logger.info(`Verification code extracted: ${verificationCode}`);
      
  //     // Step 6: Verify the code
  //     logger.debug('=== VERIFY CODE REQUEST ===');
  //     logger.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/authenticate/authenticate/email');
      
  //     const verifyPayload = {
  //       pass_code: verificationCode,
  //       exchange_id: exchangeId,
  //       sub: sub
  //     };
  //     logger.debug('Verify code payload:', JSON.stringify(verifyPayload));
      
  //     let verifyResponse;
  //     try {
  //       verifyResponse = await client.post(
  //         'https://accounts.rehau.com/verification-srv/v2/authenticate/authenticate/email',
  //         JSON.stringify(verifyPayload),
  //         {
  //           headers: {
  //             'Content-Type': 'application/json',
  //             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  //             'Accept': '*/*',
  //             'Origin': 'https://accounts.rehau.com',
  //             'Referer': `https://accounts.rehau.com/rehau-ui/mfaverify/${exchangeId}/email/${sub}/${mediumId}/${requestId}`
  //           }
  //         }
  //       );
  //     } catch (error: any) {
  //       logger.error('=== VERIFY CODE ERROR ===');
  //       logger.error('Error message:', error.message);
  //       logger.error('Error response status:', error.response?.status);
  //       logger.error('Error response data:', JSON.stringify(error.response?.data));
  //       throw new Error(`Failed to verify code: ${error.response?.data?.error?.error || error.message}`);
  //     }
      
  //     logger.debug('=== VERIFY CODE RESPONSE ===');
  //     logger.debug('Verify response:', JSON.stringify(verifyResponse.data));
      
  //     const statusId = verifyResponse.data?.data?.status_id || verifyResponse.data?.status_id;
  //     if (!statusId) {
  //       logger.error('No status_id in verify response:', JSON.stringify(verifyResponse.data));
  //       throw new Error('Failed to get status_id from verify response');
  //     }
  //     logger.debug(`Status ID: ${statusId}`);
      
  //     // Step 7: Complete authentication with form POST
  //     logger.debug('Step 7: Completing authentication...');
  //     const continueParams = new URLSearchParams({
  //       status_id: statusId,
  //       track_id: trackId,
  //       requestId: requestId,
  //       sub: sub,
  //       verificationType: 'EMAIL'
  //     });
      
  //     const continueResponse = await client.post(
  //       `https://accounts.rehau.com/login-srv/precheck/continue/${trackId}`,
  //       continueParams.toString(),
  //       {
  //         headers: {
  //           'Content-Type': 'application/x-www-form-urlencoded'
  //         },
  //         maxRedirects: 5
  //       }
  //     );
      
  //     // Step 8: Extract authorization code from final URL
  //     logger.debug('Step 8: Extracting authorization code...');
  //     logger.debug('Continue response status:', continueResponse.statusCode);
  //     logger.debug('Final URL:', continueResponse.finalUrl);
      
  //     const finalUrl = new URL(continueResponse.finalUrl);
  //     const authCode = finalUrl.searchParams.get('code');
      
  //     if (!authCode) {
  //       logger.error('No authorization code in final URL:', continueResponse.finalUrl);
  //       throw new Error('No authorization code found in redirect URL');
  //     }
      
  //     logger.info('MFA flow completed successfully');
  //     return authCode;
      
  //   } catch (error) {
  //     logger.error('MFA flow failed:', error);
  //     throw error;
  //   } finally {
  //     // Cleanup POP3 connection
  //     if (this.pop3Client) {
  //       await this.pop3Client.disconnect();
  //     }
  //   }
  // }

  /**
   * Extract medium_id from configured MFA methods response
   */
  // private extractMediumId(responseData: any): string {
  //   logger.debug('Extracting medium_id from configured methods');
    
  //   // The actual structure is: { configured_list: [ { type: 'EMAIL', mediums: [...] } ] }
  //   if (responseData.configured_list && Array.isArray(responseData.configured_list)) {
  //     const emailConfig = responseData.configured_list.find((item: any) => item.type === 'EMAIL');
  //     if (emailConfig && emailConfig.mediums && Array.isArray(emailConfig.mediums) && emailConfig.mediums.length > 0) {
  //       const mediumId = emailConfig.mediums[0].medium_id || emailConfig.mediums[0].id;
  //       logger.debug('Found medium_id:', mediumId);
  //       return mediumId;
  //     }
  //   }
    
  //   throw new Error('No email medium found in configured MFA methods');
  // }

  /**
   * Extract exchange_id from initiate email response
   */
  // private extractExchangeId(responseData: any): string {
  //   logger.debug('Extracting exchange_id from response');
    
  //   // The response structure is: responseData.data.exchange_id.exchange_id (string)
  //   if (responseData.data && responseData.data.exchange_id) {
  //     const exchangeIdObj = responseData.data.exchange_id;
      
  //     // Extract the actual exchange_id string from the object
  //     if (typeof exchangeIdObj === 'string') {
  //       logger.debug('Extracted exchange_id:', exchangeIdObj);
  //       return exchangeIdObj;
  //     } else if (exchangeIdObj.exchange_id) {
  //       logger.debug('Extracted exchange_id:', exchangeIdObj.exchange_id);
  //       return exchangeIdObj.exchange_id;
  //     }
  //   }
    
  //   // Check for status_id as fallback
  //   if (responseData.data && responseData.data.status_id) {
  //     logger.debug('Using status_id as exchange_id:', responseData.data.status_id);
  //     return responseData.data.status_id;
  //   }
    
  //   logger.error('No exchange_id found in initiate email response');
  //   throw new Error('No exchange_id found in initiate email response');
  // }

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
   * First call performs fresh login (no refresh token available)
   * Subsequent calls try refresh first, fall back to login if needed
   * 
   * Set FORCE_FRESH_LOGIN=true to always perform fresh login (old behavior)
   */
  async ensureValidToken(): Promise<void> {
    // Check if forced fresh login is enabled
    const forceFreshLogin = process.env.FORCE_FRESH_LOGIN === 'true';
    
    if (forceFreshLogin) {
      logger.info('🔐 FORCE_FRESH_LOGIN enabled - performing fresh login...');
      await this.login();
      this.startTokenRefresh();
      return;
    }
    
    if (this.refreshToken) {
      // We have a refresh token - try refresh first
      logger.info('🔄 Attempting token refresh (have refresh token)...');
      try {
        await this.refresh();
        logger.info('✅ Token refreshed successfully via refresh token');
        this.startTokenRefresh();
        return;
      } catch (error) {
        logger.warn('⚠️ Token refresh failed, falling back to fresh login:', (error as Error).message);
      }
    } else {
      logger.info('🔐 No refresh token available, performing fresh login...');
    }

    // Fresh login (first time or refresh failed)
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
