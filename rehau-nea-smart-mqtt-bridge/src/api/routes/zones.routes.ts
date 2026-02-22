import { Router, Request, Response } from 'express';
import { getAllZones, getZoneById, getClimateController } from '../services/data-service';
import enhancedLogger from '../../logging/enhanced-logger';

const router = Router();

/**
 * @swagger
 * /api/v1/zones:
 *   get:
 *     summary: List all zones
 *     description: Returns a list of all heating zones with their current status
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of zones retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 zones:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Zone unique identifier
 *                       name:
 *                         type: string
 *                         description: Zone name
 *                       temperature:
 *                         type: number
 *                         format: float
 *                         description: Current temperature in °C
 *                       targetTemperature:
 *                         type: number
 *                         format: float
 *                         description: Target temperature in °C
 *                       humidity:
 *                         type: integer
 *                         description: Current humidity percentage
 *                       mode:
 *                         type: string
 *                         enum: [heat, cool, off]
 *                         description: Current operating mode
 *                       preset:
 *                         type: string
 *                         enum: [comfort, reduced, standby, off]
 *                         description: Current preset mode
 *                       installName:
 *                         type: string
 *                         description: Installation name
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
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
 *     description: Returns detailed information about a specific zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Zone unique identifier
 *     responses:
 *       200:
 *         description: Zone details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 temperature:
 *                   type: number
 *                   format: float
 *                 targetTemperature:
 *                   type: number
 *                   format: float
 *                 humidity:
 *                   type: integer
 *                 mode:
 *                   type: string
 *                   enum: [heat, cool, off]
 *                 preset:
 *                   type: string
 *                   enum: [comfort, reduced, standby, off]
 *                 installName:
 *                   type: string
 *                 groupName:
 *                   type: string
 *       404:
 *         description: Zone not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
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
 *     description: Sets the target temperature for a specific zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Zone unique identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - temperature
 *             properties:
 *               temperature:
 *                 type: number
 *                 format: float
 *                 minimum: 5
 *                 maximum: 35
 *                 description: Target temperature in °C (5-35)
 *     responses:
 *       200:
 *         description: Temperature set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 temperature:
 *                   type: number
 *                   format: float
 *       400:
 *         description: Invalid temperature value
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
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
    
    // Get installation ID from the installations map
    const installations = (climateController as any).installations;
    let installId = '';
    
    // Get first installation ID from the Map
    for (const [key] of installations) {
      // The key format is already "installId_zone_zoneId", extract just the installId part
      const parts = key.split('_zone_');
      if (parts.length > 0) {
        installId = parts[0];
        break;
      }
    }
    
    // If we couldn't get it from installations, try installationNames
    if (!installId) {
      const installationNames = (climateController as any).installationNames;
      for (const [id] of installationNames) {
        installId = id;
        break;
      }
    }
    
    
    const command = {
      type: 'ha_command',
      installId: installId,
      zoneNumber: zoneId,  // This is the actual zoneId (MongoDB ObjectId)
      commandType: 'temperature',
      payload: temperature.toString()
    };
    
    enhancedLogger.info(`Sending temperature command for zone: ${zoneId}`, {
      component: 'API',
      direction: 'OUTGOING'
    });
    
    enhancedLogger.info(`Command object: ${JSON.stringify(command)}`, {
      component: 'API',
      direction: 'OUTGOING'
    });
    
    // Send command via climate controller
    (climateController as any).handleHomeAssistantCommand(command);
    
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
    
    // Map Home Assistant presets to REHAU presets
    const presetMap: { [key: string]: string } = {
      'comfort': 'comfort',
      'reduced': 'away',      // HA "reduced" = REHAU "away"
      'standby': 'none',      // HA "standby" = REHAU "none"
      'off': 'none'           // HA "off" = REHAU "none"
    };
    
    const rehauPreset = presetMap[preset];
    
    const climateController = getClimateController();
    
    // Get installation ID from the installations map
    const installations = (climateController as any).installations;
    let installId = '';
    
    // Get first installation ID from the Map
    for (const [key] of installations) {
      // The key format is already "installId_zone_zoneId", extract just the installId part
      const parts = key.split('_zone_');
      if (parts.length > 0) {
        installId = parts[0];
        break;
      }
    }
    
    // If we couldn't get it from installations, try installationNames
    if (!installId) {
      const installationNames = (climateController as any).installationNames;
      for (const [id] of installationNames) {
        installId = id;
        break;
      }
    }
    
    
    enhancedLogger.info(`Sending preset command for zone: ${zoneId} (${preset} -> ${rehauPreset})`, {
      component: 'API',
      direction: 'OUTGOING'
    });
    
    // Send command via climate controller
    (climateController as any).handleHomeAssistantCommand({
      type: 'ha_command',
      installId: installId,
      zoneNumber: zoneId,  // This is the actual zoneId (MongoDB ObjectId)
      commandType: 'preset',
      payload: rehauPreset  // Use mapped REHAU preset
    });
    
    enhancedLogger.info(`Preset set to ${preset} (REHAU: ${rehauPreset}) for zone ${zoneId}`, {
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
