import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * /api/v1/logs:
 *   get:
 *     summary: Get recent logs
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [normal, shareable]
 *         description: Log mode (normal shows real names, shareable obfuscates)
 *     responses:
 *       200:
 *         description: Recent logs
 */
router.get('/', (_req: Request, res: Response) => {
  // TODO: Implement
  res.json({ logs: [] });
});

export default router;
