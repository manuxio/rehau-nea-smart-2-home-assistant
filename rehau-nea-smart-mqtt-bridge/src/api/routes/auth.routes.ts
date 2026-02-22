import { Router, Request, Response } from 'express';
import { generateToken } from '../middleware/auth';
import enhancedLogger, { StatusEmoji } from '../../logging/enhanced-logger';

const router = Router();

// Read from env at runtime, not module load time
const getCredentials = () => ({
  username: process.env.API_USERNAME || 'admin',
  password: process.env.API_PASSWORD || 'admin'
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login and get JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const credentials = getCredentials();

  if (!username || !password) {
    enhancedLogger.warn(`${StatusEmoji.WARNING} Login attempt with missing credentials`, {
      component: 'API',
      direction: 'INCOMING',
      operation: 'login'
    });
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  if (username === credentials.username && password === credentials.password) {
    const token = generateToken(username);
    
    enhancedLogger.info(`${StatusEmoji.SUCCESS} User logged in: ${username}`, {
      component: 'API',
      direction: 'INCOMING',
      operation: 'login'
    });

    res.json({
      token,
      expiresIn: 86400 // 24 hours in seconds
    });
  } else {
    enhancedLogger.warn(`${StatusEmoji.FAILURE} Failed login attempt for user: ${username}`, {
      component: 'API',
      direction: 'INCOMING',
      operation: 'login'
    });
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

/**
 * @swagger
 * /api/v1/auth/status:
 *   get:
 *     summary: Check authentication status
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication status
 *       401:
 *         description: Not authenticated
 */
router.get('/status', (req: Request, res: Response) => {
  // This route doesn't use authMiddleware to allow checking token validity
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.json({ authenticated: false });
    return;
  }

  res.json({ authenticated: true });
});

export default router;
