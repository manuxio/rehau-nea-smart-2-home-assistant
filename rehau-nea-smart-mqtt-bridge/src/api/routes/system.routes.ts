import { Router, Request, Response } from 'express';
import { getSystemDetails } from '../services/data-service';
import enhancedLogger from '../../logging/enhanced-logger';

const router = Router();

/**
 * @swagger
 * /api/v1/system/details:
 *   get:
 *     summary: Get system details (mixed circuits, zone demands)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System details
 */
router.get('/details', async (_req: Request, res: Response) => {
  try {
    const details = await getSystemDetails();
    res.json(details);
  } catch (error) {
    enhancedLogger.error('Failed to get system details', error as Error, {
      component: 'API',
      direction: 'INTERNAL'
    });
    res.status(500).json({ error: 'Failed to retrieve system details' });
  }
});

export default router;
