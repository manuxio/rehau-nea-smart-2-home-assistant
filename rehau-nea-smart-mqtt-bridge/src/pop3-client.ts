// @ts-ignore - poplib doesn't have type definitions
import POP3Client_lib = require('poplib');
import { simpleParser } from 'mailparser';
import logger from './logger';

export interface POP3Config {
  email: string;
  password: string;
  host: string;
  port: number;
  secure: boolean;
  debug: boolean;
  timeout: number;
}

export interface EmailMessage {
  from: string;
  subject: string;
  date: Date;
  body: string;
  messageId: string;
  messageNumber?: number;
}

export class POP3Client {
  private config: POP3Config;
  private client: any = null;
  private connected: boolean = false;

  constructor(config: POP3Config) {
    this.config = config;
  }

  private async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client = new POP3Client_lib(
        this.config.port,
        this.config.host,
        {
          // @ts-ignore
          ignoretlserrs: process.env.POP3_IGNORE_TLS_ERRORS !== 'false',
          enabletls: this.config.secure,
          debug: false  // Never enable poplib debug - it logs passwords and full messages
        }
      );

      this.client.on('error', (err: Error) => {
        logger.error('POP3 connection error:', err);
        reject(err);
      });

      this.client.on('connect', () => {
        logger.debug('POP3 connected, authenticating...');
        this.client.login(this.config.email, this.config.password);
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
          
          // poplib returns an object with count and octets properties
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
        // Reconnect to get fresh message count
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
            // Force disconnect and reset on error
            this.connected = false;
            this.client = null;
          }
        }
        
        // If we checked all new messages but none matched, disconnect and continue polling
        await this.disconnect();
      } else {
        // No new messages, disconnect before next poll
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
