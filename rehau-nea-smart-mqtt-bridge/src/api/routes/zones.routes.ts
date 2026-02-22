import { Router, Request, Response } from 'express';
import { getAllZones, getZoneById } from '../services/data-service';
import enhancedLogger from '../../logging/enhanced-logger';

const router = Router();

/**
 * @swagger
 * /api/v1/zones:
 *   get:
 *     summary: List all zones
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of zones
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const zones = await getAllZones();
    res.json({ zones });
  } catch (error) {
    enhancedLogger.error('Failed to get zones', error as Error, {
      component: 'API',
      direction: 'INTERNAL'
    });
    res.status(500).json({ error: 'Failed to retrieve zones' });
  }
});

/**
 * @swagger
 * /api/v1/zones/{id}:
 *   get:
 *     summary: Get zone details
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Zone details
 *       404:
 *         description: Zone not found
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const zone = await getZoneById(req.params.id);
    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }
    res.json(zone);
  } catch (error) {
    enhancedLogger.error('Failed to get zone', error as Error, {
      component: 'API',
      direction: 'INTERNAL'
    });
    res.status(500).json({ error: 'Failed to retrieve zone' });
  }
});

export default router;
