import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * /api/v1/installations:
 *   get:
 *     summary: List all installations
 *     tags: [Installations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of installations
 */
router.get('/', (_req: Request, res: Response) => {
  // TODO: Implement
  res.json({ installations: [] });
});

/**
 * @swagger
 * /api/v1/installations/{id}:
 *   get:
 *     summary: Get installation details
 *     tags: [Installations]
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
 *         description: Installation details
 */
router.get('/:id', (req: Request, res: Response) => {
  // TODO: Implement
  res.json({ id: req.params.id });
});

export default router;
