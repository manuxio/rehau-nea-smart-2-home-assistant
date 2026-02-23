import { Router, Request, Response } from 'express';
import { getInstallations } from '../services/data-service';

const router = Router();

/**
 * @swagger
 * /api/v1/status/system:
 *   get:
 *     summary: Get system status
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System status
 */
router.get('/system', (_req: Request, res: Response) => {
  try {
    const installations = getInstallations();
    const firstInstall = installations[0];
    
    res.json({
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '5.0.0',
      outdoorTemperature: (firstInstall as any)?.outsideTemperature || undefined
    });
  } catch (error) {
    res.json({
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '5.0.0'
    });
  }
});

export default router;
