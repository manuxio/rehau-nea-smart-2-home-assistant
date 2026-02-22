import { Router, Request, Response } from 'express';
import { getAllZones, getZoneById, getClimateController } from '../services/data-service';
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

/**
 * @swagger
 * /api/v1/zones/{id}/temperature:
 *   put:
 *     summary: Set zone temperature
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               temperature:
 *                 type: number
 *     responses:
 *       200:
 *         description: Temperature set successfully
 */
router.put('/:id/temperature', async (req: Request, res: Response): Promise<void> => {
  try {
    const { temperature } = req.body;
    const zoneId = req.params.id;
    
    if (typeof temperature !== 'number' || temperature < 5 || temperature > 35) {
      res.status(400).json({ error: 'Invalid temperature (must be between 5 and 35)' });
      return;
    }
    
    const climateController = getClimateController();
    
    // Get installation ID to build proper zone key
    const installations = (climateController as any).installationNames;
    let installId = '';
    for (const [id] of installations) {
      installId = id;
      break; // Use first installation
    }
    
    const zoneKey = `${installId}_zone_${zoneId}`;
    
    // Send command via climate controller
    (climateController as any).handleHomeAssistantCommand({
      type: 'ha_command',
      zoneId: zoneKey,
      command: 'temperature',
      value: temperature
    });
    
    enhancedLogger.info(`Temperature set to ${temperature}°C for zone ${zoneId}`, {
      component: 'API',
      direction: 'OUTGOING'
    });
    
    res.json({ success: true, temperature });
  } catch (error) {
    enhancedLogger.error('Failed to set temperature', error as Error, {
      component: 'API',
      direction: 'INTERNAL'
    });
    res.status(500).json({ error: 'Failed to set temperature' });
  }
});

/**
 * @swagger
 * /api/v1/zones/{id}/preset:
 *   put:
 *     summary: Set zone preset mode
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preset:
 *                 type: string
 *                 enum: [comfort, reduced, standby, off]
 *     responses:
 *       200:
 *         description: Preset set successfully
 */
router.put('/:id/preset', async (req: Request, res: Response): Promise<void> => {
  try {
    const { preset } = req.body;
    const zoneId = req.params.id;
    
    const validPresets = ['comfort', 'reduced', 'standby', 'off'];
    if (!validPresets.includes(preset)) {
      res.status(400).json({ error: 'Invalid preset (must be comfort, reduced, standby, or off)' });
      return;
    }
    
    const climateController = getClimateController();
    
    // Get installation ID to build proper zone key
    const installations = (climateController as any).installationNames;
    let installId = '';
    for (const [id] of installations) {
      installId = id;
      break; // Use first installation
    }
    
    const zoneKey = `${installId}_zone_${zoneId}`;
    
    // Send command via climate controller
    (climateController as any).handleHomeAssistantCommand({
      type: 'ha_command',
      zoneId: zoneKey,
      command: 'preset',
      value: preset
    });
    
    enhancedLogger.info(`Preset set to ${preset} for zone ${zoneId}`, {
      component: 'API',
      direction: 'OUTGOING'
    });
    
    res.json({ success: true, preset });
  } catch (error) {
    enhancedLogger.error('Failed to set preset', error as Error, {
      component: 'API',
      direction: 'INTERNAL'
    });
    res.status(500).json({ error: 'Failed to set preset' });
  }
});

export default router;
