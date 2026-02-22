import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import enhancedLogger from '../logging/enhanced-logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import authRoutes from './routes/auth.routes';
import installationsRoutes from './routes/installations.routes';
import zonesRoutes from './routes/zones.routes';
import statusRoutes from './routes/status.routes';
import logsRoutes from './routes/logs.routes';
import systemRoutes from './routes/system.routes';

export class APIServer {
  private app: Express;
  private server?: HTTPServer;
  private io?: SocketIOServer;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupSwagger();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);
    
    // Serve static files from web-ui/dist in production
    const path = require('path');
    const webUIPath = path.join(__dirname, '../../web-ui/dist');
    this.app.use(express.static(webUIPath));
  }

  private setupSwagger(): void {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'REHAU NEA SMART 2.0 API',
          version: '5.0.0',
          description: 'REST API for REHAU NEA SMART 2.0 heating system control',
          contact: {
            name: 'API Support',
            url: 'https://github.com/manuxio/rehau-nea-smart-2-home-assistant'
          }
        },
        servers: [
          {
            url: `http://localhost:${this.port}`,
            description: 'Development server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        },
        security: [{
          bearerAuth: []
        }]
      },
      apis: ['./src/api/routes/*.ts', './src/api/**/*.ts']
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/installations', authMiddleware, installationsRoutes);
    this.app.use('/api/v1/zones', authMiddleware, zonesRoutes);
    this.app.use('/api/v1/status', authMiddleware, statusRoutes);
    this.app.use('/api/v1/logs', authMiddleware, logsRoutes);
    this.app.use('/api/v1/system', authMiddleware, systemRoutes);

    // Serve web UI for all other routes (SPA fallback)
    const path = require('path');
    const webUIPath = path.join(__dirname, '../../web-ui/dist');
    this.app.get('*', (req: Request, res: Response): void => {
      // Skip API routes
      if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
        res.status(404).json({
          error: 'Endpoint not found',
          path: req.originalUrl
        });
        return;
      }
      // Serve index.html for all other routes
      res.sendFile(path.join(webUIPath, 'index.html'));
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        enhancedLogger.info(`API server listening on port ${this.port}`, {
          component: 'API',
          direction: 'INTERNAL'
        });
        enhancedLogger.info(`Swagger docs available at http://localhost:${this.port}/api-docs`, {
          component: 'API',
          direction: 'INTERNAL'
        });
        resolve();
      });

      // Setup Socket.IO for real-time updates
      this.io = new SocketIOServer(this.server, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      });

      this.setupSocketIO();
    });
  }

  private setupSocketIO(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      enhancedLogger.debug('WebSocket client connected', {
        component: 'API',
        direction: 'INCOMING'
      });

      socket.on('disconnect', () => {
        enhancedLogger.debug('WebSocket client disconnected', {
          component: 'API',
          direction: 'OUTGOING'
        });
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.io) {
        this.io.close();
      }
      if (this.server) {
        this.server.close(() => {
          enhancedLogger.info('API server stopped', {
            component: 'API',
            direction: 'INTERNAL'
          });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): Express {
    return this.app;
  }

  getIO(): SocketIOServer | undefined {
    return this.io;
  }
}

export default APIServer;
