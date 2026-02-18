import { chromium, Browser, BrowserContext, Page } from 'playwright';

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

  constructor() {
    // Browser will be initialized on first request
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.browser && this.context && this.page) {
      return;
    }

    process.stderr.write('[PlaywrightHttpsClient] Initializing Chromium browser...\n');
    
    // Launch browser in headless mode
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

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
    process.stderr.write('[PlaywrightHttpsClient] Browser initialized successfully\n');
  }

  async request(url: string, options: RequestOptions = {}): Promise<Response> {
    await this.ensureInitialized();
    
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const method = options.method || 'GET';
    const startTime = Date.now();
    
    process.stderr.write(`[PlaywrightHttpsClient] ${method} ${url}\n`);
    
    try {
      let response;
      
      if (method === 'GET') {
        // Simple GET request
        response = await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } else if (method === 'POST' && options.body) {
        // POST request - use Playwright's route interception to submit form data
        // This is more reliable than fetch() in page context
        
        // Set up request interception for this specific POST
        await this.page.route(url, async (route) => {
          await route.continue({
            method: 'POST',
            postData: options.body,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              ...options.headers
            }
          });
        });

        // Navigate to the URL which will trigger our intercepted POST
        response = await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Remove the route after use
        await this.page.unroute(url);
        
        if (!response) {
          throw new Error('No response from POST request');
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

      process.stderr.write(`[PlaywrightHttpsClient] ${method} completed in ${elapsed}ms\n`);
      process.stderr.write(`[PlaywrightHttpsClient] Status: ${status}\n`);
      process.stderr.write(`[PlaywrightHttpsClient] Final URL: ${finalUrl}\n`);
      process.stderr.write(`[PlaywrightHttpsClient] Body length: ${body.length} bytes\n`);

      // Log 403 responses for debugging
      if (status === 403) {
        process.stderr.write(`[PlaywrightHttpsClient] === 403 FORBIDDEN DETECTED ===\n`);
        process.stderr.write(`[PlaywrightHttpsClient] Response body preview: ${body.substring(0, 500)}\n`);
        process.stderr.write(`[PlaywrightHttpsClient] Headers: ${JSON.stringify(headers)}\n`);
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
      process.stderr.write(`[PlaywrightHttpsClient] Error: ${error.message}\n`);
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
    process.stderr.write('[PlaywrightHttpsClient] Cleaning up browser resources...\n');
    
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.initialized = false;
    process.stderr.write('[PlaywrightHttpsClient] Cleanup complete\n');
  }
}
