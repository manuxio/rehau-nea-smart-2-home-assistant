/**
 * OAuth2-enabled POP3 Client
 * Extends the basic POP3 client with OAuth2 XOAUTH2 authentication support
 */

// @ts-ignore - poplib doesn't have type definitions
import POP3Client_lib = require('poplib');
import { simpleParser } from 'mailparser';
import logger from './logger';
import { OAuth2Provider } from './auth/oauth2-provider';
import { GmailOAuth2Provider } from './auth/gmail-oauth2-provider';
import { OutlookOAuth2Provider } from './auth/outlook-oauth2-provider';

export interface OAuth2POP3Config {
  email: string;
  provider: 'gmail' | 'outlook' | 'basic';
  // OAuth2 settings (for gmail/outlook)
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  oauth2RefreshToken?: string;
  oauth2TenantId?: string; // For Outlook
  // Basic auth settings (fallback)
  password?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  debug?: boolean;
  timeout?: number;
}

export interface EmailMessage {
  from: string;
  subject: string;
  date: Date;
  body: string;
  messageId: string;
  messageNumber?: number;
}

export class OAuth2POP3Client {
  private config: OAuth2POP3Config;
  private client: any = null;
  private connected: boolean = false;
  private oauth2Provider: OAuth2Provider | null = null;

  constructor(config: OAuth2POP3Config) {
    this.config = config;

    // Initialize OAuth2 provider if configured
    if (config.provider === 'gmail' && config.oauth2ClientId && config.oauth2ClientSecret && config.oauth2RefreshToken) {
      logger.info('Initializing Gmail OAuth2 provider');
      this.oauth2Provider = new GmailOAuth2Provider(
        config.oauth2ClientId,
        config.oauth2ClientSecret,
        config.oauth2RefreshToken
      );
    } else if (config.provider === 'outlook' && config.oauth2ClientId && config.oauth2ClientSecret && config.oauth2RefreshToken) {
      logger.info('Initializing Outlook OAuth2 provider');
      this.oauth2Provider = new OutlookOAuth2Provider(
        config.oauth2ClientId,
        config.oauth2ClientSecret,
        config.oauth2RefreshToken,
        config.oauth2TenantId
      );
    } else if (config.provider === 'basic') {
      logger.info('Using basic authentication (no OAuth2)');
    } else {
      logger.warn('OAuth2 configuration incomplete, falling back to basic auth');
    }
  }

  private async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    // Get server configuration based on provider
    let host: string;
    let port: number;
    let secure: boolean;

    if (this.config.provider === 'gmail') {
      const gmailConfig = GmailOAuth2Provider.getPOP3Config();
      host = gmailConfig.host;
      port = gmailConfig.port;
      secure = gmailConfig.secure;
    } else if (this.config.provider === 'outlook') {
      const outlookConfig = OutlookOAuth2Provider.getPOP3Config();
      host = outlookConfig.host;
      port = outlookConfig.port;
      secure = outlookConfig.secure;
    } else {
      // Basic auth - use provided config
      host = this.config.host || 'pop.gmail.com';
      port = this.config.port || 995;
      secure = this.config.secure !== false;
    }

    return new Promise((resolve, reject) => {
      this.client = new POP3Client_lib(
        port,
        host,
        {
          // @ts-ignore
          ignoretlserrs: process.env.POP3_IGNORE_TLS_ERRORS !== 'false',
          enabletls: secure,
          debug: false  // Never enable poplib debug - it logs passwords
        }
      );

      this.client.on('error', (err: Error) => {
        logger.error('POP3 connection error:', err);
        reject(err);
      });

      this.client.on('connect', async () => {
        logger.debug('POP3 connected, authenticating...');
        
        try {
          if (this.oauth2Provider) {
            // OAuth2 authentication using XOAUTH2
            logger.debug('Using OAuth2 XOAUTH2 authentication');
            const xoauth2String = await this.oauth2Provider.generateXOAuth2String(this.config.email);
            
            // Send AUTH XOAUTH2 command
            this.client.auth('XOAUTH2', xoauth2String);
          } else {
            // Basic authentication
            logger.debug('Using basic authentication');
            if (!this.config.password) {
              reject(new Error('Password required for basic authentication'));
              return;
            }
            this.client.login(this.config.email, this.config.password);
          }
        } catch (error) {
          logger.error('Authentication preparation failed:', error);
          reject(error);
        }
      });

      this.client.on('login', (status: boolean, rawdata: string) => {
        if (status) {
          logger.debug('POP3 authentication successful');
          this.connected = true;
          resolve();
        } else {
          const error = new Error(`POP3 login failed: ${rawdata}`);
          logger.error(error.message);
          reject(error);
        }
      });

      this.client.on('invalid-state', (cmd: string) => {
        logger.error(`POP3 invalid state for command: ${cmd}`);
      });

      this.client.on('locked', (cmd: string) => {
        logger.error(`POP3 locked for command: ${cmd}`);
      });
    });
  }

  async getMessageCount(): Promise<number> {
    await this.connect();

    return new Promise((resolve, reject) => {
      const statHandler = (status: boolean, data: any) => {
        this.client.removeListener('stat', statHandler);
        if (status) {
          let count: number;
          
          if (data && typeof data === 'object' && 'count' in data) {
            count = parseInt(String(data.count), 10);
          } else if (Array.isArray(data)) {
            count = parseInt(String(data[0]), 10);
          } else if (typeof data === 'string') {
            const parts = data.trim().split(/\s+/);
            count = parseInt(parts[0], 10);
          } else if (typeof data === 'number') {
            count = data;
          } else {
            const str = String(data).trim();
            const parts = str.split(/\s+/);
            count = parseInt(parts[0], 10);
          }
          
          if (isNaN(count)) {
            reject(new Error(`Failed to parse message count from: ${JSON.stringify(data)}`));
            return;
          }
          
          logger.debug(`POP3 message count: ${count}`);
          resolve(count);
        } else {
          reject(new Error(`Failed to get message count: ${data}`));
        }
      };
      
      this.client.on('stat', statHandler);
      this.client.stat();
    });
  }

  async getMostRecentMessage(): Promise<EmailMessage | null> {
    const count = await this.getMessageCount();
    
    if (count === 0) {
      logger.debug('No messages in mailbox');
      return null;
    }

    return this.retrieveMessage(count);
  }

  private async retrieveMessage(messageNumber: number): Promise<EmailMessage> {
    return new Promise((resolve, reject) => {
      const retrHandler = async (status: boolean, msgNumber: number, data: string) => {
        if (msgNumber === messageNumber) {
          this.client.removeListener('retr', retrHandler);
          
          if (status) {
            try {
              const parsed = await simpleParser(data);
              
              const message: EmailMessage = {
                from: parsed.from?.text || '',
                subject: parsed.subject || '',
                date: parsed.date || new Date(),
                body: parsed.text || parsed.html || '',
                messageId: parsed.messageId || '',
                messageNumber: messageNumber
              };

              logger.debug(`Retrieved message from: ${message.from}, subject: ${message.subject}`);
              resolve(message);
            } catch (err) {
              logger.error('Failed to parse email:', err);
              reject(err);
            }
          } else {
            reject(new Error(`Failed to retrieve message ${messageNumber}`));
          }
        }
      };
      
      this.client.on('retr', retrHandler);
      this.client.retr(messageNumber);
    });
  }

  async waitForNewMessage(fromAddress: string, timeoutMs: number): Promise<EmailMessage | null> {
    logger.info(`Waiting for email from ${fromAddress} (timeout: ${timeoutMs}ms)`);
    
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    
    // Get initial count and disconnect
    let initialCount: number;
    try {
      initialCount = await this.getMessageCount();
      logger.debug(`Initial message count: ${initialCount}`);
    } catch (error) {
      logger.error('Failed to get initial message count:', error);
      throw error;
    } finally {
      await this.disconnect();
    }

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      let currentCount: number;
      try {
        currentCount = await this.getMessageCount();
        logger.debug(`Current message count: ${currentCount}`);
      } catch (error) {
        logger.warn('Error getting message count, will retry:', error);
        await this.disconnect();
        continue;
      }
      
      if (currentCount > initialCount) {
        logger.debug(`New message detected! Count: ${currentCount} (was ${initialCount})`);
        
        // Check new messages one at a time
        for (let i = initialCount + 1; i <= currentCount; i++) {
          try {
            const message = await this.retrieveMessage(i);
            
            if (message.from.toLowerCase().includes(fromAddress.toLowerCase())) {
              logger.info(`Found email from ${fromAddress}`);
              await this.disconnect();
              return message;
            } else {
              logger.debug(`Message ${i} is from "${message.from}", not "${fromAddress}"`);
            }
          } catch (error) {
            logger.warn(`Error retrieving message ${i}, skipping:`, error);
            this.connected = false;
            this.client = null;
          }
        }
        
        await this.disconnect();
      } else {
        await this.disconnect();
      }
      
      const elapsed = Date.now() - startTime;
      logger.debug(`Still waiting... (${Math.floor(elapsed / 1000)}s elapsed)`);
    }

    logger.error(`Timeout waiting for email from ${fromAddress}`);
    return null;
  }

  async deleteMessage(messageNumber: number): Promise<void> {
    await this.connect();
    
    return new Promise((resolve, reject) => {
      const deleHandler = (status: boolean, msgNumber: number, data: string) => {
        if (msgNumber === messageNumber) {
          this.client.removeListener('dele', deleHandler);
          
          if (status) {
            logger.info(`Deleted message ${messageNumber} from server`);
            resolve();
          } else {
            reject(new Error(`Failed to delete message ${messageNumber}: ${data}`));
          }
        }
      };
      
      this.client.on('dele', deleHandler);
      this.client.dele(messageNumber);
    });
  }

  extractVerificationCode(emailBody: string): string | null {
    const codeRegex = /\b\d{6}\b/g;
    const matches = emailBody.match(codeRegex);
    
    if (matches && matches.length > 0) {
      const code = matches[0];
      logger.debug(`Extracted verification code: ${code}`);
      return code;
    }
    
    logger.warn('No 6-digit verification code found in email body');
    logger.debug(`Email body preview: ${emailBody.substring(0, 200)}...`);
    return null;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      return new Promise((resolve) => {
        this.client.quit();
        
        this.client.on('quit', () => {
          logger.debug('POP3 connection closed');
          this.connected = false;
          this.client = null;
          resolve();
        });
        
        setTimeout(() => {
          this.connected = false;
          this.client = null;
          resolve();
        }, 1000);
      });
    }
  }
}
