import { Router, Request, Response } from 'express';
import { logExporter } from '../../logging/log-exporter';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

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
 *       - in: query
 *         name: lines
 *         schema:
 *           type: number
 *         description: Number of recent lines to return
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *         description: Filter by log level
 *       - in: query
 *         name: component
 *         schema:
 *           type: string
 *         description: Filter by component name
 *     responses:
 *       200:
 *         description: Recent logs
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'normal';
    const lines = req.query.lines ? parseInt(req.query.lines as string) : 100;
    const level = req.query.level as string;
    const component = req.query.component as string;

    const logs = await logExporter.exportLogs({
      mode: mode as 'normal' | 'shareable',
      lines,
      level,
      component
    });

    const logLines = logs ? logs.split('\n').filter(line => line.trim()) : [];

    res.json({
      mode,
      lines: logLines.length,
      logs: logLines
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch logs',
      message: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/v1/logs/export:
 *   post:
 *     summary: Export logs as downloadable gzipped file
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [normal, shareable]
 *               lines:
 *                 type: number
 *               level:
 *                 type: string
 *               component:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gzipped log file download
 *         content:
 *           application/gzip:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { mode = 'normal', lines, level, component } = req.body;

    const logs = await logExporter.exportLogs({
      mode: mode as 'normal' | 'shareable',
      lines,
      level,
      component
    });

    const filename = `betterehau-logs-${mode}-${new Date().toISOString().split('T')[0]}.log.gz`;
    
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Create gzip stream
    const gzip = createGzip();
    const readable = Readable.from([logs]);
    
    // Pipe through gzip to response
    await pipeline(readable, gzip, res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to export logs',
        message: (error as Error).message
      });
    }
  }
});

export default router;
