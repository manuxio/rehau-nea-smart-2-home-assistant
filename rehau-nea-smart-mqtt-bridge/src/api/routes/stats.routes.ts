import { Router, Request, Response } from 'express';
import { getAuth } from '../services/data-service';
import enhancedLogger from '../../logging/enhanced-logger';

const router = Router();

/**
 * @swagger
 * /api/v1/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics including uptime and auth counts
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const auth = getAuth();
    const stats = auth.getStatistics();
    res.json(stats);
  } catch (error) {
    enhancedLogger.error('Failed to get statistics', error as Error, {
      component: 'API',
      direction: 'INTERNAL'
    });
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

export default router;
