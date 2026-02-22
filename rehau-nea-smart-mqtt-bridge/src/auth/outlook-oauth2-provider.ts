/**
 * Outlook/Office365 OAuth2 Provider
 * Handles OAuth2 authentication for Outlook POP3 access
 */

import { OAuth2Provider, OAuth2Config } from './oauth2-provider';

export class OutlookOAuth2Provider extends OAuth2Provider {
  constructor(clientId: string, clientSecret: string, refreshToken: string, tenantId: string = 'common') {
    const config: OAuth2Config = {
      clientId,
      clientSecret,
      refreshToken,
      tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      scope: 'https://outlook.office365.com/POP.AccessAsUser.All offline_access'
    };
    
    super(config);
  }

  /**
   * Get Outlook-specific POP3 server configuration
   */
  static getPOP3Config() {
    return {
      host: 'outlook.office365.com',
      port: 995,
      secure: true
    };
  }
}
