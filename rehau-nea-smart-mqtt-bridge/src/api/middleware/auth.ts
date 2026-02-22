import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import enhancedLogger from '../../logging/enhanced-logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export interface AuthRequest extends Request {
  user?: {
    username: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    enhancedLogger.warn('Authentication failed: No token provided', {
      component: 'API',
      direction: 'INCOMING',
      operation: 'auth_check'
    });
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string };
    req.user = decoded;
    next();
  } catch (error) {
    enhancedLogger.warn('Authentication failed: Invalid token', {
      component: 'API',
      direction: 'INCOMING',
      operation: 'auth_check'
    });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const generateToken = (username: string): string => {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
};
