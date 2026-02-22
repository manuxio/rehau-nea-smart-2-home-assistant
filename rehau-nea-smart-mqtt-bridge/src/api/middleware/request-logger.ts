import { Request, Response, NextFunction } from 'express';
import enhancedLogger from '../../logging/enhanced-logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    enhancedLogger.info(`${req.method} ${req.path} ${res.statusCode}`, {
      component: 'API',
      direction: 'INCOMING',
      operation: 'http_request',
      duration
    });
  });

  next();
};
