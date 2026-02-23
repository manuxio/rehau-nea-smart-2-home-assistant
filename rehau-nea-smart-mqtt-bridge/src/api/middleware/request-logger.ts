import { Request, Response, NextFunction } from 'express';
import enhancedLogger from '../../logging/enhanced-logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const showOkRequests = process.env.LOG_SHOW_OK_REQUESTS === 'true';
    
    // Skip logging 200 OK responses unless explicitly enabled
    if (res.statusCode === 200 && !showOkRequests) {
      return;
    }
    
    enhancedLogger.info(`${req.method} ${req.path} ${res.statusCode}`, {
      component: 'API',
      direction: 'INCOMING',
      operation: 'http_request',
      duration
    });
  });

  next();
};
