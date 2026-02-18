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
    
    // Store cookies in jar for this request (cookies are managed by tough-cookie)
    await this.jar.getCookieString(url);
    
    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        ...(options.body ? { 'Content-Length': Buffer.byteLength(options.body) } : {})
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(requestOptions, async (res) => {
        process.stderr.write(`[NativeHttpsClient] Got response callback. Status: ${res.statusCode}\n`);
        
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
          process.stderr.write(`[NativeHttpsClient] Following redirect to: ${res.headers.location}\n`);
          const redirectUrl = new URL(res.headers.location, url).toString();
          // Follow redirect and update finalUrl to the redirect destination
          const redirectResponse = await this.request(redirectUrl, { ...options, maxRedirects }, redirectCount + 1);
          return resolve(redirectResponse);
        }

        process.stderr.write(`[NativeHttpsClient] Setting up data/end handlers. Status: ${res.statusCode}\n`);
        
        // Read response body
        let body = '';
        let dataChunks = 0;
        
        res.on('data', (chunk) => {
          dataChunks++;
          body += chunk;
        });

        res.on('end', () => {
          process.stderr.write(`[NativeHttpsClient] Response end event fired. Status: ${res.statusCode}, Body length: ${body.length}, Chunks: ${dataChunks}\n`);
          
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
          
          const responseObj = {
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
            data: parsedData,
            status: res.statusCode || 0,
            finalUrl: url
          };
          
          process.stderr.write(`[NativeHttpsClient] About to resolve with statusCode: ${responseObj.statusCode}\n`);
          resolve(responseObj);
        });
        
        res.on('error', (err) => {
          process.stderr.write(`[NativeHttpsClient] Response error: ${err.message}\n`);
          reject(new Error(`Response error: ${err.message}`));
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Request error: ${err.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

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
    process.stderr.write('[NativeHttpsClient] POST method called\n');
    const response = await this.request(url, { ...options, method: 'POST', body });
    process.stderr.write(`[NativeHttpsClient] POST response: ${response ? 'exists' : 'undefined'}\n`);
    process.stderr.write(`[NativeHttpsClient] POST response statusCode: ${response?.statusCode}\n`);
    return response;
  }
}
