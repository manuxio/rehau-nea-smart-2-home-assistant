import axios, { AxiosResponse, AxiosError } from 'axios';
import * as crypto from 'crypto';
import logger, { registerObfuscation, debugDump } from './logger';
import { RehauTokenResponse } from './types';
import { UserDataParserV2, InstallationDataParserV2, type IInstall } from './parsers';

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

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
    this.clientId = `app-${crypto.randomUUID()}`;
    this.tokenRefreshInterval = parseInt(process.env.TOKEN_REFRESH_INTERVAL || '21600') * 1000; // Default 6 hours
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
      
      const authResponse = await axios.get(authUrl, {
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      // Extract requestId
      const finalUrl = (authResponse.request?.res?.responseUrl as string) || authResponse.config.url;
      const requestIdMatch = finalUrl?.match(/[?&]requestId=([^&]+)/);
      if (!requestIdMatch) {
        throw new Error('Failed to extract requestId from authorization flow');
      }
      const requestId = requestIdMatch[1];
      logger.debug(`RequestId obtained: ${requestId}`);

      // Extract session cookies
      const cookies = authResponse.headers['set-cookie'] || [];
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

      logger.debug('Step 2: Submitting credentials...');
      
      // Step 2: Submit login form
      const loginData = new URLSearchParams({
        username: this.email,
        username_type: 'email',
        password: this.password,
        requestId: requestId,
        rememberMe: 'true'
      });

      const loginResponse = await axios.post(
        'https://accounts.rehau.com/login-srv/login',
        loginData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Origin': 'https://accounts.rehau.com',
            'Referer': `https://accounts.rehau.com/rehau-ui/login?requestId=${requestId}&view_type=login`
          },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400
        }
      );

      // Extract authorization code
      const finalLoginUrl = (loginResponse.request?.res?.responseUrl as string) || loginResponse.config.url;
      let authCode: string | null = null;
      
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

      logger.debug('Authorization code obtained');

      // Step 3: Exchange code for tokens
      logger.debug('Step 3: Exchanging code for tokens...');
      const tokenResponse: AxiosResponse<RehauTokenResponse> = await axios.post(
        'https://accounts.rehau.com/token-srv/token',
        {
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
          code: authCode
        },
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
    }
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
