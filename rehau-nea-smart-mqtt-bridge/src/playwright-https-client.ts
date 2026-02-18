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
  private headless: boolean = true;

  constructor(headless?: boolean) {
    // Use environment variable or constructor parameter
    this.headless = headless !== undefined ? headless : (process.env.PLAYWRIGHT_HEADLESS !== 'false');
    process.stderr.write(`[PlaywrightHttpsClient] Headless mode: ${this.headless}\n`);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.browser && this.context && this.page) {
      return;
    }

    process.stderr.write('[PlaywrightHttpsClient] Initializing Chromium browser...\n');
    
    try {
      // Launch browser in headless mode
      // Use system Chromium if PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      
      this.browser = await chromium.launch({
        headless: this.headless,
        executablePath: executablePath || undefined,
        args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
      timeout: 60000
    });
    
    if (executablePath) {
      process.stderr.write(`[PlaywrightHttpsClient] Using system Chromium at: ${executablePath}\n`);
    }

    

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
    } catch (error: any) {
      process.stderr.write(`[PlaywrightHttpsClient] Failed to initialize browser: ${error.message}\n`);
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
        // POST request - use page.evaluate with fetch to make the request
        // This preserves cookies and session while allowing full control over headers
        const postResult = await this.page.evaluate(async ({ url, body, headers }: { url: string; body: string; headers: Record<string, string> }) => {
          const res = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
            credentials: 'include',
            redirect: 'manual'
          });
          
          const text = await res.text();
          const headersObj: Record<string, string> = {};
          res.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
          
          return {
            status: res.status,
            statusText: res.statusText,
            headers: headersObj,
            body: text,
            url: res.url,
            redirected: res.redirected
          };
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
    
    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
    } catch (error) {
      process.stderr.write('[PlaywrightHttpsClient] Error closing page (may already be closed)\n');
    }
    
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
    } catch (error) {
      process.stderr.write('[PlaywrightHttpsClient] Error closing context (may already be closed)\n');
    }
    
    try {
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
    } catch (error) {
      process.stderr.write('[PlaywrightHttpsClient] Error closing browser (may already be closed)\n');
    }
    
    this.initialized = false;
    process.stderr.write('[PlaywrightHttpsClient] Cleanup complete\n');
  }

  /**
   * Navigate to a URL and wait for page load
   */
  async navigate(url: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    process.stderr.write(`[PlaywrightHttpsClient] Navigating to: ${url}\n`);
    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      process.stderr.write(`[PlaywrightHttpsClient] Navigation complete. Current URL: ${this.page.url()}\n`);
    } catch (error: any) {
      process.stderr.write(`[PlaywrightHttpsClient] Navigation error: ${error.message}\n`);
      process.stderr.write(`[PlaywrightHttpsClient] Current URL after error: ${this.page.url()}\n`);
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
    
    process.stderr.write(`[PlaywrightHttpsClient] Waiting for element with id="${id}"...\n`);
    await this.page.waitForSelector(`#${id}`, { timeout, state: 'visible' });
    process.stderr.write(`[PlaywrightHttpsClient] Element #${id} found\n`);
  }

  /**
   * Type text into an input element by ID
   */
  async typeById(id: string, text: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    process.stderr.write(`[PlaywrightHttpsClient] Typing into element #${id}...\n`);
    await this.page.fill(`#${id}`, text);
    process.stderr.write(`[PlaywrightHttpsClient] Text entered into #${id}\n`);
  }

  /**
   * Click an element by selector
   */
  async clickBySelector(selector: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    process.stderr.write(`[PlaywrightHttpsClient] Clicking element: ${selector}\n`);
    await this.page.click(selector);
    process.stderr.write(`[PlaywrightHttpsClient] Element clicked: ${selector}\n`);
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
    
    process.stderr.write(`[PlaywrightHttpsClient] Waiting for URL to start with: ${prefix}...\n`);
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const currentUrl = this.page.url();
      if (currentUrl.startsWith(prefix)) {
        process.stderr.write(`[PlaywrightHttpsClient] URL matched: ${currentUrl}\n`);
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
