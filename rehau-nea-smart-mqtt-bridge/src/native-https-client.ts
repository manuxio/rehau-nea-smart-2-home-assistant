import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { CookieJar } from 'tough-cookie';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxRedirects?: number;
}

interface Response {
  statusCode: number;
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  data: any;
  finalUrl: string;
}

export class NativeHttpsClient {
  private jar: CookieJar;

  constructor(jar: CookieJar) {
    this.jar = jar;
  }

  private async request(url: string, options: RequestOptions = {}, redirectCount = 0): Promise<Response> {
    const maxRedirects = options.maxRedirects ?? 5;
    
    if (redirectCount > maxRedirects) {
      throw new Error('Too many redirects');
    }

    const parsedUrl = new URL(url);
    
    // Get cookies for this URL
    const cookieString = await this.jar.getCookieString(url);
    
    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        ...(cookieString ? { 'Cookie': cookieString } : {})
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(requestOptions, async (res) => {
        // Store cookies from response
        const setCookieHeaders = res.headers['set-cookie'];
        if (setCookieHeaders) {
          for (const cookie of setCookieHeaders) {
            await this.jar.setCookie(cookie, url);
          }
        }

        // Handle redirects (but respect maxRedirects from options)
        const shouldFollowRedirect = options.maxRedirects === undefined || redirectCount < maxRedirects;
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && shouldFollowRedirect) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          return resolve(await this.request(redirectUrl, { ...options, maxRedirects }, redirectCount + 1));
        }

        // Read response body
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          // Parse JSON responses
          let parsedData = body;
          const contentType = res.headers['content-type'];
          if (contentType && contentType.includes('application/json') && body) {
            try {
              parsedData = JSON.parse(body);
            } catch (e) {
              // Keep as string if JSON parse fails
            }
          }
          
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
            data: parsedData,
            status: res.statusCode || 0,
            finalUrl: url
          });
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async get(url: string, options: RequestOptions = {}): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url: string, body: string, options: RequestOptions = {}): Promise<Response> {
    return this.request(url, { ...options, method: 'POST', body });
  }
}
