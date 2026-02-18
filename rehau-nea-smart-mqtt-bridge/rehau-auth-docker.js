"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const logger_1 = __importStar(require("./logger"));
const parsers_1 = require("./parsers");
const pop3_client_1 = require("./pop3-client");
const tough_cookie_1 = require("tough-cookie");
const native_https_client_1 = require("./native-https-client");
/**
 * Type guard to check if an error is an AxiosError
 */
function isAxiosError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'isAxiosError' in error &&
        error.isAxiosError === true);
}
class RehauAuthPersistent {
    constructor(email, password) {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.installs = [];
        this.tokenRefreshTimer = null;
        this.isCleanedUp = false;
        this.pop3Client = null;
        this.email = email;
        this.password = password;
        this.clientId = `app-${crypto.randomUUID()}`;
        this.tokenRefreshInterval = parseInt(process.env.TOKEN_REFRESH_INTERVAL || '21600') * 1000; // Default 6 hours
        // Initialize POP3 client if configured
        if (process.env.POP3_EMAIL && process.env.POP3_PASSWORD) {
            logger_1.default.info('POP3 configuration detected - automated 2FA enabled');
            const pop3Config = {
                email: process.env.POP3_EMAIL,
                password: process.env.POP3_PASSWORD,
                host: process.env.POP3_HOST || 'pop.gmx.com',
                port: parseInt(process.env.POP3_PORT || '995'),
                secure: process.env.POP3_SECURE === 'true',
                debug: process.env.POP3_DEBUG === 'true',
                timeout: parseInt(process.env.POP3_TIMEOUT || '600000')
            };
            this.pop3Client = new pop3_client_1.POP3Client(pop3Config);
        }
        else {
            logger_1.default.warn('POP3 configuration not found. If 2FA is enabled, authentication will fail. ' +
                'Please configure POP3_EMAIL and POP3_PASSWORD environment variables.');
        }
    }
    /**
     * Start automatic token refresh
     */
    startTokenRefresh() {
        if (this.tokenRefreshTimer) {
            clearInterval(this.tokenRefreshTimer);
        }
        this.tokenRefreshTimer = setInterval(async () => {
            try {
                logger_1.default.info('Refreshing token automatically...');
                await this.refresh();
                logger_1.default.info('Token refreshed successfully');
            }
            catch (error) {
                logger_1.default.error('Failed to refresh token:', error.message);
                // Try fresh login if refresh fails
                try {
                    logger_1.default.info('Attempting fresh login after refresh failure...');
                    await this.login();
                }
                catch (loginError) {
                    logger_1.default.error('Fresh login also failed:', loginError.message);
                }
            }
        }, this.tokenRefreshInterval);
        logger_1.default.info(`Token refresh scheduled every ${this.tokenRefreshInterval / 1000} seconds`);
    }
    /**
     * Stop automatic token refresh
     */
    stopTokenRefresh() {
        if (this.tokenRefreshTimer) {
            clearInterval(this.tokenRefreshTimer);
            this.tokenRefreshTimer = null;
        }
    }
    /**
     * Cleanup method to stop timers and release resources
     * Idempotent: safe to call multiple times
     */
    cleanup() {
        if (this.isCleanedUp) {
            logger_1.default.debug('RehauAuthPersistent already cleaned up, skipping');
            return;
        }
        logger_1.default.info('Cleaning up RehauAuthPersistent...');
        this.stopTokenRefresh();
        // Cleanup POP3 connection
        if (this.pop3Client) {
            this.pop3Client.disconnect().catch(err => {
                logger_1.default.warn('Error disconnecting POP3 client:', err);
            });
            this.pop3Client = null;
        }
        // Verify cleanup completed
        if (this.tokenRefreshTimer !== null) {
            logger_1.default.warn('Token refresh timer was not properly cleaned up');
        }
        this.isCleanedUp = true;
        logger_1.default.info('RehauAuthPersistent cleanup completed');
    }
    /**
     * Generate PKCE parameters
     */
    generateCodeVerifier() {
        return crypto.randomBytes(32).toString('base64url');
    }
    generateCodeChallenge(verifier) {
        return crypto.createHash('sha256').update(verifier).digest('base64url');
    }
    generateNonce() {
        return crypto.randomBytes(16).toString('base64url');
    }
    /**
     * Authenticate with username and password via form submission
     */
    async login() {
        try {
            // Register email for obfuscation before logging
            (0, logger_1.registerObfuscation)('email', this.email);
            logger_1.default.info('Authenticating with form-based flow...');
            logger_1.default.info(`Email: ${this.email}`);
            // Use native HTTPS client instead of axios (axios triggers Cloudflare 403 in Docker)
            const jar = new tough_cookie_1.CookieJar();
            const client = new native_https_client_1.NativeHttpsClient(jar);
            // Generate PKCE parameters
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = this.generateCodeChallenge(codeVerifier);
            const nonce = this.generateNonce();
            const clientId = '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1';
            const redirectUri = 'https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg';
            const scope = 'email roles profile offline_access groups';
            // Step 1: Get authorization page
            logger_1.default.debug('Step 1: Initiating OAuth flow...');
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
            logger_1.default.debug('Making auth request with native HTTPS client...');
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
            logger_1.default.debug(`Auth response status: ${authResponse.statusCode}`);
            logger_1.default.debug(`Auth response final URL: ${authResponse.finalUrl}`);
            // Extract requestId from final URL - if we have it, the redirect worked even if status is 403
            const requestIdMatch = authResponse.finalUrl.match(/[?&]requestId=([^&]+)/);
            if (!requestIdMatch) {
                // Only fail if we don't have a requestId
                logger_1.default.error(`Auth failed with status ${authResponse.statusCode}`);
                logger_1.default.error(`Response body preview: ${authResponse.body.substring(0, 200)}`);
                throw new Error('Failed to extract requestId from authorization flow');
            }
            // Debug: Check if cookies were set
            logger_1.default.debug('Auth response set-cookie headers:', authResponse.headers['set-cookie']);
            // We have a requestId, so the OAuth flow succeeded even if final page returned 403
            logger_1.default.debug('OAuth redirect successful - requestId obtained despite 403 status');
            const requestId = requestIdMatch[1];
            logger_1.default.debug(`RequestId obtained: ${requestId}`);
            logger_1.default.debug('Step 2: Submitting credentials...');
            // Step 2: Submit login form
            const loginData = new URLSearchParams({
                username: this.email,
                username_type: 'email',
                password: this.password,
                requestId: requestId,
                rememberMe: 'true'
            });
            logger_1.default.debug('=== LOGIN REQUEST ===');
            logger_1.default.debug('URL: POST https://accounts.rehau.com/login-srv/login');
            logger_1.default.debug('Payload:', loginData.toString());
            logger_1.default.debug('Payload fields:', {
                username: this.email,
                username_type: 'email',
                password: '***',
                requestId: requestId,
                rememberMe: 'true'
            });
            const loginPayloadString = loginData.toString();
            logger_1.default.debug('Login payload length:', loginPayloadString.length);
            let loginResponse;
            try {
                logger_1.default.debug('About to make login POST request...');
                const startTime = Date.now();
                loginResponse = await client.post('https://accounts.rehau.com/login-srv/login', loginPayloadString, {
                    maxRedirects: 5, // Allow redirects for login POST
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Origin': 'https://accounts.rehau.com',
                        'Referer': `https://accounts.rehau.com/rehau-ui/login?requestId=${requestId}&view_type=login`,
                        'Connection': 'close'
                    }
                });
                const elapsed = Date.now() - startTime;
                logger_1.default.debug(`Login POST completed in ${elapsed}ms`);
                logger_1.default.debug('Response received, type:', typeof loginResponse);
                
                // DIRECT FILE DEBUG
                const fs = require('fs');
                const debugData = {
                    timestamp: new Date().toISOString(),
                    elapsed: elapsed,
                    responseType: typeof loginResponse,
                    responseKeys: loginResponse ? Object.keys(loginResponse) : null,
                    statusCode: loginResponse?.statusCode,
                    hasHeaders: !!loginResponse?.headers,
                    headerKeys: loginResponse?.headers ? Object.keys(loginResponse.headers) : null,
                    bodyLength: loginResponse?.body?.length || 0,
                    finalUrl: loginResponse?.finalUrl,
                    rawResponse: JSON.stringify(loginResponse, null, 2)
                };
                fs.writeFileSync('/tmp/login-debug.json', JSON.stringify(debugData, null, 2));
                logger_1.default.info('DEBUG: Wrote debug data to /tmp/login-debug.json');
            }
            catch (error) {
                logger_1.default.error('=== LOGIN ERROR ===');
                logger_1.default.error('Error message:', error.message);
                logger_1.default.error('Error stack:', error.stack);
                throw error;
            }
            logger_1.default.debug('=== LOGIN RESPONSE ===');
            logger_1.default.debug('Full response object:', JSON.stringify(loginResponse, null, 2));
            logger_1.default.debug('Status:', loginResponse?.statusCode);
            logger_1.default.debug('Location header:', loginResponse?.headers?.location);
            logger_1.default.debug('Final URL:', loginResponse?.finalUrl);
            logger_1.default.debug('Body length:', loginResponse?.body?.length || 0);
            // Extract authorization code or handle MFA from location header or final URL
            const finalLoginUrl = loginResponse?.headers?.location || loginResponse?.finalUrl;
            // Check if we have a valid redirect URL (MFA or auth code)
            if (!finalLoginUrl || (!finalLoginUrl.includes('/mfa') && !finalLoginUrl.includes('code='))) {
                logger_1.default.error('Unexpected login status:', loginResponse.statusCode);
                logger_1.default.error('No valid redirect URL found');
                logger_1.default.error('Response body:', loginResponse.body.substring(0, 500));
                throw new Error(`Login failed with status ${loginResponse.statusCode}`);
            }
            logger_1.default.debug('Login redirect URL obtained:', finalLoginUrl);
            let authCode = null;
            // Check for MFA redirect
            if (finalLoginUrl && finalLoginUrl.includes('/rehau-ui/mfa')) {
                logger_1.default.info('MFA required - initiating automated 2FA flow');
                // Extract MFA parameters from URL
                const url = new URL(finalLoginUrl);
                const trackId = url.searchParams.get('track_id');
                const sub = url.searchParams.get('sub');
                const mfaRequestId = url.searchParams.get('requestId');
                if (!trackId || !sub || !mfaRequestId) {
                    throw new Error('Failed to extract MFA parameters from redirect URL');
                }
                logger_1.default.debug(`MFA Parameters: track_id=${trackId}, sub=${sub}, requestId=${mfaRequestId}`);
                // Handle MFA flow with POP3 using the client with cookie jar
                authCode = await this.handleMfaFlowWithPOP3(trackId, sub, mfaRequestId, client);
            }
            else {
                // Original flow - extract auth code directly
                if (finalLoginUrl) {
                    const codeMatch = finalLoginUrl.match(/[?&]code=([^&]+)/);
                    if (codeMatch) {
                        authCode = codeMatch[1];
                    }
                }
                if (!authCode && loginResponse.headers.location) {
                    const location = loginResponse.headers.location;
                    const url = new URL(location, 'https://accounts.rehau.com');
                    authCode = url.searchParams.get('code');
                }
                if (!authCode) {
                    throw new Error('No authorization code found - check credentials');
                }
                logger_1.default.debug('Authorization code obtained');
            }
            // Step 3: Exchange code for tokens
            logger_1.default.debug('Step 3: Exchanging code for tokens...');
            const tokenPayload = {
                grant_type: 'authorization_code',
                client_id: clientId,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
                code: authCode
            };
            const tokenResponse = await client.post('https://accounts.rehau.com/token-srv/token', JSON.stringify(tokenPayload), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            this.accessToken = tokenResponse.data.access_token;
            this.refreshToken = tokenResponse.data.refresh_token;
            this.tokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000);
            logger_1.default.debug('Tokens obtained');
            // Get user info
            await this.getUserInfo();
            logger_1.default.info('Authentication successful');
            return true;
        }
        catch (error) {
            const axiosError = error;
            logger_1.default.error('Authentication failed:', axiosError.response?.data || axiosError.message);
            if (axiosError.response?.status === 401) {
                logger_1.default.error('Invalid username or password');
            }
            throw error;
        }
    }
    /**
     * Handle MFA flow with POP3 email polling
     */
    async handleMfaFlowWithPOP3(trackId, sub, requestId, client) {
        logger_1.default.info('Starting automated MFA flow with POP3 email polling');
        if (!this.pop3Client) {
            throw new Error('POP3 client not configured. Please set POP3_EMAIL, POP3_PASSWORD, ' +
                'and other POP3_* environment variables.');
        }
        try {
            // Step 1: Get current email count
            logger_1.default.debug('Step 1: Getting current email count...');
            await this.pop3Client.getMessageCount();
            // Step 1.5: Visit the MFA page to establish session context
            logger_1.default.debug('=== VISITING MFA PAGE ===');
            const mfaPageUrl = `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`;
            logger_1.default.debug('URL: GET', mfaPageUrl);
            await client.get(mfaPageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': `https://accounts.rehau.com/login-srv/login`
                }
            });
            logger_1.default.debug('MFA page visited successfully');
            // Step 2: Check configured MFA methods
            logger_1.default.debug('=== CONFIGURED METHODS REQUEST ===');
            logger_1.default.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/setup/public/configured/list');
            const configuredPayload = { request_id: requestId, sub: sub };
            logger_1.default.debug('Payload:', JSON.stringify(configuredPayload));
            let configuredResponse;
            try {
                configuredResponse = await client.post('https://accounts.rehau.com/verification-srv/v2/setup/public/configured/list', JSON.stringify(configuredPayload), {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Origin': 'https://accounts.rehau.com',
                        'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
                    }
                });
            }
            catch (error) {
                logger_1.default.error('=== CONFIGURED METHODS ERROR ===');
                logger_1.default.error('Error message:', error.message);
                logger_1.default.error('Error response status:', error.response?.status);
                logger_1.default.error('Error response data:', JSON.stringify(error.response?.data));
                throw error;
            }
            logger_1.default.debug('=== CONFIGURED METHODS RESPONSE ===');
            logger_1.default.debug('Response object exists:', !!configuredResponse);
            logger_1.default.debug('HTTP Status:', String(configuredResponse.status));
            // Log the entire response structure
            const responseData = configuredResponse.data;
            logger_1.default.debug('Response data exists:', !!responseData);
            if (responseData) {
                logger_1.default.debug('Configured methods response received', { success: responseData.success, status: responseData.status });
            }
            // Extract medium_id from response - the actual data is in response.data.data
            const actualData = configuredResponse.data?.data || configuredResponse.data;
            const mediumId = this.extractMediumId(actualData);
            logger_1.default.debug(`Medium ID: ${mediumId}`);
            // Step 3: Initiate email verification
            logger_1.default.debug('=== INITIATE EMAIL REQUEST ===');
            logger_1.default.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/authenticate/initiate/email');
            const initiatePayload = {
                sub: sub,
                medium_id: mediumId,
                request_id: requestId,
                usage_type: 'MULTIFACTOR_AUTHENTICATION'
            };
            logger_1.default.debug('Payload:', JSON.stringify(initiatePayload));
            let initiateResponse;
            try {
                initiateResponse = await client.post('https://accounts.rehau.com/verification-srv/v2/authenticate/initiate/email', JSON.stringify(initiatePayload), {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Origin': 'https://accounts.rehau.com',
                        'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
                    }
                });
            }
            catch (error) {
                logger_1.default.error('=== INITIATE EMAIL ERROR ===');
                logger_1.default.error('Error message:', error.message);
                logger_1.default.error('Error response status:', error.response?.status);
                logger_1.default.error('Error response data:', JSON.stringify(error.response?.data));
                throw error;
            }
            logger_1.default.debug('=== INITIATE EMAIL RESPONSE ===');
            logger_1.default.debug('Status:', initiateResponse.status);
            logger_1.default.debug('Initiate response data:', JSON.stringify(initiateResponse.data));
            const exchangeId = this.extractExchangeId(initiateResponse.data);
            logger_1.default.debug(`Exchange ID: ${exchangeId}`);
            logger_1.default.info('Verification email sent. Waiting for email...');
            // Step 3.5: Visit the MFA verify page to establish session
            logger_1.default.debug('=== VISITING MFA VERIFY PAGE ===');
            const mfaVerifyUrl = `https://accounts.rehau.com/rehau-ui/mfaverify/${exchangeId}/email/${sub}/${mediumId}/${requestId}`;
            logger_1.default.debug('MFA verify URL:', mfaVerifyUrl);
            try {
                const verifyPageResponse = await client.get(mfaVerifyUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Referer': `https://accounts.rehau.com/rehau-ui/mfa?track_id=${trackId}&sub=${sub}&q=${sub}&requestId=${requestId}`
                    }
                });
                logger_1.default.debug('MFA verify page visited successfully, status:', verifyPageResponse.status);
            }
            catch (error) {
                logger_1.default.error('Failed to visit MFA verify page:', error.message);
                logger_1.default.error('Response status:', error.response?.status);
                throw error;
            }
            // Step 4: Wait for verification email
            logger_1.default.debug('Step 4: Polling POP3 for verification email...');
            const timeout = parseInt(process.env.POP3_TIMEOUT || '600000');
            const verificationEmail = await this.pop3Client.waitForNewMessage('noreply@accounts.rehau.com', timeout);
            if (!verificationEmail) {
                throw new Error('Timeout waiting for verification email');
            }
            logger_1.default.info('Verification email received');
            // Step 5: Extract verification code
            logger_1.default.debug('Step 5: Extracting verification code from email...');
            const verificationCode = this.pop3Client.extractVerificationCode(verificationEmail.body);
            if (!verificationCode) {
                throw new Error('Failed to extract verification code from email');
            }
            logger_1.default.info(`Verification code extracted: ${verificationCode}`);
            // Step 6: Verify the code
            logger_1.default.debug('=== VERIFY CODE REQUEST ===');
            logger_1.default.debug('URL: POST https://accounts.rehau.com/verification-srv/v2/authenticate/authenticate/email');
            const verifyPayload = {
                pass_code: verificationCode,
                exchange_id: exchangeId,
                sub: sub
            };
            logger_1.default.debug('Verify code payload:', JSON.stringify(verifyPayload));
            let verifyResponse;
            try {
                verifyResponse = await client.post('https://accounts.rehau.com/verification-srv/v2/authenticate/authenticate/email', JSON.stringify(verifyPayload), {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Origin': 'https://accounts.rehau.com',
                        'Referer': `https://accounts.rehau.com/rehau-ui/mfaverify/${exchangeId}/email/${sub}/${mediumId}/${requestId}`
                    }
                });
            }
            catch (error) {
                logger_1.default.error('=== VERIFY CODE ERROR ===');
                logger_1.default.error('Error message:', error.message);
                logger_1.default.error('Error response status:', error.response?.status);
                logger_1.default.error('Error response data:', JSON.stringify(error.response?.data));
                throw new Error(`Failed to verify code: ${error.response?.data?.error?.error || error.message}`);
            }
            logger_1.default.debug('=== VERIFY CODE RESPONSE ===');
            logger_1.default.debug('Verify response:', JSON.stringify(verifyResponse.data));
            const statusId = verifyResponse.data?.data?.status_id || verifyResponse.data?.status_id;
            if (!statusId) {
                logger_1.default.error('No status_id in verify response:', JSON.stringify(verifyResponse.data));
                throw new Error('Failed to get status_id from verify response');
            }
            logger_1.default.debug(`Status ID: ${statusId}`);
            // Step 7: Complete authentication with form POST
            logger_1.default.debug('Step 7: Completing authentication...');
            const continueParams = new URLSearchParams({
                status_id: statusId,
                track_id: trackId,
                requestId: requestId,
                sub: sub,
                verificationType: 'EMAIL'
            });
            const continueResponse = await client.post(`https://accounts.rehau.com/login-srv/precheck/continue/${trackId}`, continueParams.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                maxRedirects: 0,
                validateStatus: (status) => status === 302
            });
            // Step 8: Extract authorization code from redirect
            logger_1.default.debug('Step 8: Extracting authorization code...');
            const location = continueResponse.headers.location;
            if (!location) {
                throw new Error('No redirect location found after MFA verification');
            }
            const redirectUrl = new URL(location);
            const authCode = redirectUrl.searchParams.get('code');
            if (!authCode) {
                throw new Error('No authorization code found in redirect URL');
            }
            logger_1.default.info('MFA flow completed successfully');
            return authCode;
        }
        catch (error) {
            logger_1.default.error('MFA flow failed:', error);
            throw error;
        }
        finally {
            // Cleanup POP3 connection
            if (this.pop3Client) {
                await this.pop3Client.disconnect();
            }
        }
    }
    /**
     * Extract medium_id from configured MFA methods response
     */
    extractMediumId(responseData) {
        logger_1.default.debug('Extracting medium_id from configured methods');
        // The actual structure is: { configured_list: [ { type: 'EMAIL', mediums: [...] } ] }
        if (responseData.configured_list && Array.isArray(responseData.configured_list)) {
            const emailConfig = responseData.configured_list.find((item) => item.type === 'EMAIL');
            if (emailConfig && emailConfig.mediums && Array.isArray(emailConfig.mediums) && emailConfig.mediums.length > 0) {
                const mediumId = emailConfig.mediums[0].medium_id || emailConfig.mediums[0].id;
                logger_1.default.debug('Found medium_id:', mediumId);
                return mediumId;
            }
        }
        throw new Error('No email medium found in configured MFA methods');
    }
    /**
     * Extract exchange_id from initiate email response
     */
    extractExchangeId(responseData) {
        logger_1.default.debug('Extracting exchange_id from response');
        // The response structure is: responseData.data.exchange_id.exchange_id (string)
        if (responseData.data && responseData.data.exchange_id) {
            const exchangeIdObj = responseData.data.exchange_id;
            // Extract the actual exchange_id string from the object
            if (typeof exchangeIdObj === 'string') {
                logger_1.default.debug('Extracted exchange_id:', exchangeIdObj);
                return exchangeIdObj;
            }
            else if (exchangeIdObj.exchange_id) {
                logger_1.default.debug('Extracted exchange_id:', exchangeIdObj.exchange_id);
                return exchangeIdObj.exchange_id;
            }
        }
        // Check for status_id as fallback
        if (responseData.data && responseData.data.status_id) {
            logger_1.default.debug('Using status_id as exchange_id:', responseData.data.status_id);
            return responseData.data.status_id;
        }
        logger_1.default.error('No exchange_id found in initiate email response');
        throw new Error('No exchange_id found in initiate email response');
    }
    /**
     * Get user information and installations
     */
    async getUserInfo() {
        try {
            logger_1.default.debug('Fetching user data...');
            const headers = {
                'Authorization': this.accessToken,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
                'Origin': 'http://android.neasmart.de',
                'Referer': 'http://android.neasmart.de/',
                'Accept': 'application/json, text/plain, */*'
            };
            const response = await axios_1.default.get(`https://api.nea2aws.aws.rehau.cloud/v2/users/${this.email}/getUserData`, { headers });
            // Log HTTP response details
            logger_1.default.info(`getUserData HTTP Response: status=${response.status}`);
            logger_1.default.debug('Response headers:', response.headers);
            (0, logger_1.debugDump)('getUserData API Response', response.data);
            // Use V2 parser to extract user data
            const parser = new parsers_1.UserDataParserV2();
            const parsed = parser.parse(response.data);
            this.installs = parsed.installations.map(install => ({
                unique: install.unique,
                name: install.name,
                _id: install._id
            }));
            logger_1.default.info(`Found ${this.installs.length} installation(s)`);
            logger_1.default.debug('Parsed user data:', parser.getSummary(parsed));
        }
        catch (error) {
            if (isAxiosError(error)) {
                logger_1.default.error(`getUserData HTTP Error: status=${error.response?.status}`);
                logger_1.default.error('Error response headers:', error.response?.headers);
                logger_1.default.error('Error response body:', error.response?.data);
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.default.warn('Failed to get user info:', errorMessage);
        }
    }
    /**
     * Refresh access token
     */
    async refresh() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available. Please login first.');
        }
        try {
            logger_1.default.debug('Refreshing access token...');
            const response = await axios_1.default.post('https://accounts.rehau.com/token-srv/token', {
                grant_type: 'refresh_token',
                client_id: '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1',
                refresh_token: this.refreshToken
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            logger_1.default.debug('Tokens obtained');
            logger_1.default.info('Token refreshed');
            return true;
        }
        catch (error) {
            const axiosError = error;
            logger_1.default.error('Token refresh failed:', axiosError.response?.data || axiosError.message);
            if (axiosError.response?.status === 401) {
                logger_1.default.info('Refresh token expired, logging in again...');
                return await this.login();
            }
            throw error;
        }
    }
    /**
     * Check if token is expired or about to expire
     */
    isTokenExpired() {
        if (!this.tokenExpiry)
            return true;
        // Consider expired if less than 5 minutes remaining
        return Date.now() >= (this.tokenExpiry - 300000);
    }
    /**
     * Ensure we have a valid access token
     * Always performs fresh login on first call
     */
    async ensureValidToken() {
        // Always perform fresh login
        await this.login();
        // Start automatic token refresh
        this.startTokenRefresh();
    }
    getAccessToken() {
        return this.accessToken;
    }
    getClientId() {
        return this.clientId;
    }
    getEmail() {
        return this.email;
    }
    getInstalls() {
        return this.installs;
    }
    getPrimaryInstallUnique() {
        return this.installs.length > 0 ? this.installs[0].unique : null;
    }
    isAuthenticated() {
        return this.accessToken !== null;
    }
    /**
     * Get full installation data including zones and controllers
     */
    async getInstallationData(install) {
        try {
            const installIds = this.installs.map(i => i._id).join(',');
            const url = `https://api.nea2aws.aws.rehau.cloud/v2/users/${this.email}/getDataofInstall` +
                `?demand=${install._id}` +
                `&installsList=${installIds}`;
            const response = await axios_1.default.get(url, {
                headers: {
                    'Authorization': this.accessToken,
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
                    'Origin': 'http://android.neasmart.de',
                    'Referer': 'http://android.neasmart.de/',
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json'
                }
            });
            // Log HTTP response details
            logger_1.default.info(`getInstallationData HTTP Response: status=${response.status}`);
            logger_1.default.debug('Response headers:', response.headers);
            // Use condensed format for large installation data
            (0, logger_1.debugDump)('getInstallationData API Response', response.data, true);
            // Use V2 parser to extract installation data
            const parser = new parsers_1.InstallationDataParserV2();
            const parsed = parser.parse(response.data, install.unique);
            logger_1.default.debug('Parsed installation data:', parser.getSummary(parsed));
            // Get typed installation data (without raw fields)
            const typedData = parser.getTyped(parsed);
            // Find the specific installation
            const installation = typedData.installs.find(i => i.unique === install.unique);
            if (!installation) {
                throw new Error(`Installation ${install.unique} not found in parsed data`);
            }
            return installation;
        }
        catch (error) {
            if (isAxiosError(error)) {
                logger_1.default.error(`getInstallationData HTTP Error: status=${error.response?.status}`);
                logger_1.default.error('Error response headers:', error.response?.headers);
                logger_1.default.error('Error response body:', error.response?.data);
            }
            throw error;
        }
    }
}
exports.default = RehauAuthPersistent;
//# sourceMappingURL=rehau-auth.js.map