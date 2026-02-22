/**
 * OAuth2 Provider Base Class
 * Handles OAuth2 token management for email providers
 */

import axios from 'axios';
import logger from '../logger';

export interface OAuth2Tokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenEndpoint: string;
  scope: string;
}

export abstract class OAuth2Provider {
  protected config: OAuth2Config;
  protected cachedAccessToken: string | null = null;
  protected tokenExpiry: number | null = null;

  constructor(config: OAuth2Config) {
    this.config = config;
  }

  /**
   * Get a valid access token (cached or refreshed)
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.cachedAccessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
      logger.debug('Using cached OAuth2 access token');
      return this.cachedAccessToken;
    }

    // Refresh token
    logger.info('Refreshing OAuth2 access token...');
    const tokens = await this.refreshAccessToken();
    
    this.cachedAccessToken = tokens.access_token;
    this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    logger.info('OAuth2 access token refreshed successfully');
    return this.cachedAccessToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  protected async refreshAccessToken(): Promise<OAuth2Tokens> {
    try {
      const response = await axios.post(
        this.config.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data as OAuth2Tokens;
    } catch (error: any) {
      logger.error('Failed to refresh OAuth2 token:', error.response?.data || error.message);
      throw new Error(`OAuth2 token refresh failed: ${error.message}`);
    }
  }

  /**
   * Generate XOAUTH2 authentication string for POP3/IMAP
   */
  async generateXOAuth2String(email: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const authString = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
  }

  /**
   * Clear cached tokens
   */
  clearCache(): void {
    this.cachedAccessToken = null;
    this.tokenExpiry = null;
  }
}
