/**
 * Gmail OAuth2 Provider
 * Handles OAuth2 authentication for Gmail POP3 access
 */

import { OAuth2Provider, OAuth2Config } from './oauth2-provider';

export class GmailOAuth2Provider extends OAuth2Provider {
  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    const config: OAuth2Config = {
      clientId,
      clientSecret,
      refreshToken,
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      scope: 'https://mail.google.com/'
    };
    
    super(config);
  }

  /**
   * Get Gmail-specific POP3 server configuration
   */
  static getPOP3Config() {
    return {
      host: 'pop.gmail.com',
      port: 995,
      secure: true
    };
  }
}
