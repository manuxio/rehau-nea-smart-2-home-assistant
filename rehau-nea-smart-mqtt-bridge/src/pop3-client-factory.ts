/**
 * POP3 Client Factory
 * Creates the appropriate POP3 client based on configuration
 */

import logger from './logger';
import { POP3Client, POP3Config } from './pop3-client';
import { OAuth2POP3Client, OAuth2POP3Config } from './pop3-oauth2-client';

export type UnifiedPOP3Client = POP3Client | OAuth2POP3Client;

export function createPOP3Client(): UnifiedPOP3Client | null {
  const provider = (process.env.POP3_PROVIDER || 'basic').toLowerCase();
  
  if (!process.env.POP3_EMAIL) {
    logger.warn('POP3_EMAIL not configured - 2FA automation disabled');
    return null;
  }

  // OAuth2 providers (Gmail, Outlook)
  if (provider === 'gmail' || provider === 'outlook') {
    const oauth2Config: OAuth2POP3Config = {
      email: process.env.POP3_EMAIL,
      provider: provider as 'gmail' | 'outlook',
      oauth2ClientId: process.env.POP3_OAUTH2_CLIENT_ID,
      oauth2ClientSecret: process.env.POP3_OAUTH2_CLIENT_SECRET,
      oauth2RefreshToken: process.env.POP3_OAUTH2_REFRESH_TOKEN,
      oauth2TenantId: process.env.POP3_OAUTH2_TENANT_ID,
      // Fallback to basic auth if OAuth2 not fully configured
      password: process.env.POP3_PASSWORD,
      debug: process.env.POP3_DEBUG === 'true',
      timeout: parseInt(process.env.POP3_TIMEOUT || '600000')
    };

    // Check if OAuth2 is fully configured
    if (oauth2Config.oauth2ClientId && oauth2Config.oauth2ClientSecret && oauth2Config.oauth2RefreshToken) {
      logger.info(`Creating OAuth2 POP3 client for ${provider}`);
      return new OAuth2POP3Client(oauth2Config);
    } else {
      logger.warn(`OAuth2 configuration incomplete for ${provider}, falling back to basic auth`);
      if (!oauth2Config.password) {
        logger.error('Neither OAuth2 nor basic auth password configured!');
        return null;
      }
      // Fall through to basic auth
    }
  }

  // Basic authentication (GMX, custom servers, or fallback)
  if (!process.env.POP3_PASSWORD) {
    logger.error('POP3_PASSWORD not configured and OAuth2 not available');
    return null;
  }

  const basicConfig: POP3Config = {
    email: process.env.POP3_EMAIL,
    password: process.env.POP3_PASSWORD,
    host: process.env.POP3_HOST || 'pop.gmx.com',
    port: parseInt(process.env.POP3_PORT || '995'),
    secure: process.env.POP3_SECURE !== 'false',
    debug: process.env.POP3_DEBUG === 'true',
    timeout: parseInt(process.env.POP3_TIMEOUT || '600000')
  };

  logger.info(`Creating basic auth POP3 client for ${basicConfig.host}`);
  return new POP3Client(basicConfig);
}
