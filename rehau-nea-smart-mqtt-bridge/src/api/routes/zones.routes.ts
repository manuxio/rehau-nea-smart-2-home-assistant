import { Router, Request, Response } from 'express';

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
router.get('/', (_req: Request, res: Response) => {
  // TODO: Implement
  res.json({ zones: [] });
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
 */
router.get('/:id', (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ id: req.params.id });
});

export default router;
