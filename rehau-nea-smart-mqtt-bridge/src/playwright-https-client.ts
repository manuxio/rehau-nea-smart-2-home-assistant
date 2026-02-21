import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import logger from './logger';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxRedirects?: number;
}

interface Response {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  data: any;
  status: number;
  finalUrl: string;
}

export class PlaywrightHttpsClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private initialized: boolean = false;
  private headless: boolean = true;

  constructor(headless?: boolean) {
    // Use environment variable or constructor parameter
    this.headless = headless !== undefined ? headless : (process.env.PLAYWRIGHT_HEADLESS !== 'false');
    logger.debug(`Playwright browser headless mode: ${this.headless}`);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.browser && this.context && this.page) {
      return;
    }

    logger.debug('Initializing Playwright Chromium browser...');
    
    try {
      // Check if system Chromium exists (Docker/Linux), otherwise use Playwright default (Windows)
      const systemChromiumPath = '/usr/bin/chromium';
      let executablePath: string | undefined = undefined;
      
      if (fs.existsSync(systemChromiumPath)) {
        executablePath = systemChromiumPath;
        logger.debug(`Using system Chromium at: ${executablePath}`);
      } else {
        logger.debug('Using Playwright default browser');
      }
      
      this.browser = await chromium.launch({
        headless: this.headless,
        executablePath: executablePath,
        args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
      timeout: 60000
    });
    
    logger.debug('Playwright Chromium launched successfully');

    

    // Create browser context with realistic settings
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'Europe/Rome',
      acceptDownloads: false,
      ignoreHTTPSErrors: false,
      javaScriptEnabled: true
    });

    // Create a new page
    this.page = await this.context.newPage();

    // Set extra headers to look more like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });

      this.initialized = true;
      logger.debug('Playwright browser initialized successfully');
    } catch (error: any) {
      logger.error(`Failed to initialize Playwright browser: ${error.message}`);
      throw error;
    }
  }

  async request(url: string, options: RequestOptions = {}): Promise<Response> {
    await this.ensureInitialized();
    
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const method = options.method || 'GET';
    const startTime = Date.now();
    
    logger.debug(`Playwright ${method} ${url}`);
    
    try {
      let response;
      
      if (method === 'GET') {
        // Simple GET request
        response = await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } else if (method === 'POST' && options.body) {
        // POST request - use page.evaluate with XMLHttpRequest for better compatibility
        // This preserves cookies and session while allowing full control over headers
        interface XHRResult {
          status: number;
          statusText: string;
          headers: Record<string, string>;
          body: string;
          url: string;
        }
        
        const postResult = await this.page.evaluate(async ({ url, body, headers }: { url: string; body: string; headers: Record<string, string> }): Promise<XHRResult> => {
          return new Promise((resolve, reject) => {
            const xhr = new (globalThis as any).XMLHttpRequest();
            xhr.open('POST', url, true);
            
            // Set headers
            for (const [key, value] of Object.entries(headers)) {
              xhr.setRequestHeader(key, value);
            }
            
            xhr.onload = function() {
              const headersObj: Record<string, string> = {};
              const headerLines = xhr.getAllResponseHeaders().split('\r\n');
              for (const line of headerLines) {
                const parts = line.split(': ');
                if (parts.length === 2) {
                  headersObj[parts[0].toLowerCase()] = parts[1];
                }
              }
              
              resolve({
                status: xhr.status,
                statusText: xhr.statusText,
                headers: headersObj,
                body: xhr.responseText,
                url: xhr.responseURL || url
              });
            };
            
            xhr.onerror = function() {
              reject(new Error('XHR request failed'));
            };
            
            xhr.send(body);
          });
        }, { url, body: options.body, headers: options.headers || {} });

        // If we got a redirect, follow it with page.goto
        if (postResult.status >= 300 && postResult.status < 400 && postResult.headers['location']) {
          const redirectUrl = postResult.headers['location'];
          const absoluteRedirectUrl = redirectUrl.startsWith('http') 
            ? redirectUrl 
            : new URL(redirectUrl, url).toString();
          
          response = await this.page.goto(absoluteRedirectUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
        } else {
          // Create a mock response object for non-redirect POST responses
          response = {
            status: () => postResult.status,
            headers: () => postResult.headers,
            text: async () => postResult.body,
            url: () => postResult.url
          } as any;
        }
      } else {
        throw new Error(`Unsupported method: ${method}`);
      }

      if (!response) {
        throw new Error('No response received');
      }

      const elapsed = Date.now() - startTime;
      const status = response.status();
      const body = await response.text();
      const headers = response.headers();
      const finalUrl = this.page.url();

      logger.debug(`Playwright ${method} completed in ${elapsed}ms - Status: ${status}`);
      logger.debug(`Final URL: ${finalUrl}`);
      logger.debug(`Body length: ${body.length} bytes`);

      // Log 403 responses for debugging
      if (status === 403) {
        logger.error('=== 403 FORBIDDEN DETECTED ===');
        logger.error(`Response body preview: ${body.substring(0, 500)}`);
        logger.error(`Headers: ${JSON.stringify(headers)}`);
      }

      return {
        statusCode: status,
        status: status,
        headers: headers,
        body: body,
        data: this.parseBody(body, headers['content-type']),
        finalUrl: finalUrl
      };
    } catch (error: any) {
      logger.error(`Playwright request error: ${error.message}`);
      throw new Error(`Playwright request failed: ${error.message}`);
    }
  }

  private parseBody(body: string, contentType?: string): any {
    if (contentType && contentType.includes('application/json')) {
      try {
        return JSON.parse(body);
      } catch (e) {
        return body;
      }
    }
    return body;
  }

  async get(url: string, options: RequestOptions = {}): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url: string, body: string, options: RequestOptions = {}): Promise<Response> {
    return this.request(url, { ...options, method: 'POST', body });
  }

  async cleanup(): Promise<void> {
    logger.debug('Cleaning up Playwright browser resources...');
    
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
    } catch (error) {
      logger.debug('Error closing page (may already be closed)');
    }
    
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
    } catch (error) {
      logger.debug('Error closing context (may already be closed)');
    }
    
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      logger.debug('Error closing browser (may already be closed)');
    }
    
    this.initialized = false;
    logger.debug('Playwright cleanup complete');
  }

  /**
   * Navigate to a URL and wait for page load
   */
  async navigate(url: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    logger.debug(`Navigating to: ${url}`);
    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      logger.debug(`Navigation complete. Current URL: ${this.page.url()}`);
    } catch (error: any) {
      logger.error(`Navigation error: ${error.message}`);
      logger.debug(`Current URL after error: ${this.page.url()}`);
      throw error;
    }
  }

  /**
   * Wait for an element by ID
   */
  async waitForElementById(id: string, timeout: number = 30000): Promise<void> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    logger.debug(`Waiting for element with id="${id}"...`);
    await this.page.waitForSelector(`#${id}`, { timeout, state: 'visible' });
    logger.debug(`Element #${id} found`);
  }

  /**
   * Type text into an input element by ID
   */
  async typeById(id: string, text: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    logger.debug(`Typing into element #${id}...`);
    await this.page.fill(`#${id}`, text);
    logger.debug(`Text entered into #${id}`);
  }

  /**
   * Click an element by selector
   */
  async clickBySelector(selector: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    logger.debug(`Clicking element: ${selector}`);
    await this.page.click(selector);
    logger.debug(`Element clicked: ${selector}`);
  }

  /**
   * Click a submit button (type="submit")
   */
  async clickSubmit(): Promise<void> {
    await this.clickBySelector('[type="submit"]');
  }

  /**
   * Wait for URL to start with a specific prefix
   */
  async waitForUrlPrefix(prefix: string, timeout: number = 60000): Promise<string> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    logger.debug(`Waiting for URL to start with: ${prefix}...`);
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const currentUrl = this.page.url();
      if (currentUrl.startsWith(prefix)) {
        logger.debug(`URL matched: ${currentUrl}`);
        return currentUrl;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Timeout waiting for URL to start with: ${prefix}`);
  }

  /**
   * Get current page URL
   */
  getCurrentUrl(): string {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    return this.page.url();
  }

  /**
   * Get the page object for advanced operations
   */
  getPage(): Page | null {
    return this.page;
  }
}
