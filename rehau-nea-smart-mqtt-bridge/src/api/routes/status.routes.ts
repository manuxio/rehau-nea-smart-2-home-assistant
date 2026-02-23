import { Router, Request, Response } from 'express';
import { getInstallations } from '../services/data-service';
import packageJson from '../../../package.json';

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
      version: packageJson.version,
      outdoorTemperature: (firstInstall as any)?.outsideTemperature || undefined
    });
  } catch (error) {
    res.json({
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: packageJson.version
    });
  }
});

export default router;
