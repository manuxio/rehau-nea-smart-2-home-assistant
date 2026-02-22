import { Request, Response, NextFunction } from 'express';
import enhancedLogger from '../../logging/enhanced-logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  enhancedLogger.error('API error', err, {
    component: 'API',
    direction: 'INTERNAL',
    operation: 'error_handler',
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};
