import { Router, Request, Response } from 'express';
import enhancedLogger from '../../logging/enhanced-logger';

const router = Router();

/**
 * @swagger
 * /api/v1/config:
 *   get:
 *     summary: Get system configuration (read-only)
 *     description: Returns all environment configuration variables with sensitive data masked
 *     tags: [Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                       description: Whether API server is enabled
 *                     port:
 *                       type: integer
 *                       description: API server port
 *                     webUIEnabled:
 *                       type: boolean
 *                       description: Whether Web UI is enabled
 *                     swaggerUrl:
 *                       type: string
 *                       description: URL to Swagger documentation
 *                 mqtt:
 *                   type: object
 *                   properties:
 *                     host:
 *                       type: string
 *                       description: MQTT broker hostname
 *                     port:
 *                       type: integer
 *                       description: MQTT broker port
 *                     hasAuth:
 *                       type: boolean
 *                       description: Whether MQTT authentication is configured
 *                 rehau:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       description: REHAU account email (masked)
 *                     hasPassword:
 *                       type: boolean
 *                       description: Whether password is configured
 *                 intervals:
 *                   type: object
 *                   properties:
 *                     zoneReload:
 *                       type: integer
 *                       description: Zone reload interval in seconds
 *                     tokenRefresh:
 *                       type: integer
 *                       description: Token refresh interval in seconds
 *                     referentialsReload:
 *                       type: integer
 *                       description: Referentials reload interval in seconds
 *                     liveData:
 *                       type: integer
 *                       description: Live data polling interval in seconds
 *                 commands:
 *                   type: object
 *                   properties:
 *                     retryTimeout:
 *                       type: integer
 *                       description: Command retry timeout in seconds
 *                     maxRetries:
 *                       type: integer
 *                       description: Maximum number of command retries
 *                     disableRedundant:
 *                       type: boolean
 *                       description: Whether redundant commands are disabled
 *                 logging:
 *                   type: object
 *                   properties:
 *                     level:
 *                       type: string
 *                       enum: [debug, info, warn, error]
 *                       description: Current log level
 *                 display:
 *                   type: object
 *                   properties:
 *                     useGroupInNames:
 *                       type: boolean
 *                       description: Whether to include group names in entity names
 *                 pop3:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                       description: Whether POP3 OAuth2 is enabled
 *                     email:
 *                       type: string
 *                       description: POP3 email address (masked)
 *                     host:
 *                       type: string
 *                       description: POP3 server hostname
 *                     port:
 *                       type: integer
 *                       description: POP3 server port
 *                     secure:
 *                       type: boolean
 *                       description: Whether to use secure connection
 *                     ignoreTLSErrors:
 *                       type: boolean
 *                       description: Whether to ignore TLS certificate errors
 *                     debug:
 *                       type: boolean
 *                       description: Whether debug mode is enabled
 *                     timeout:
 *                       type: integer
 *                       description: Connection timeout in milliseconds
 *                     fromAddress:
 *                       type: string
 *                       description: Expected sender email address for verification emails
 *                 playwright:
 *                   type: object
 *                   properties:
 *                     headless:
 *                       type: boolean
 *                       description: Whether browser runs in headless mode
 *                     idleTimeout:
 *                       type: integer
 *                       description: Browser idle timeout in seconds
 *                 monitoring:
 *                   type: object
 *                   properties:
 *                     memoryWarningMB:
 *                       type: integer
 *                       description: Memory warning threshold in MB
 *                     stalenessWarningMs:
 *                       type: integer
 *                       description: Staleness warning threshold in milliseconds
 *                     stalenessStaleMs:
 *                       type: integer
 *                       description: Staleness stale threshold in milliseconds
 *                 testing:
 *                   type: object
 *                   properties:
 *                     forceTokenExpired:
 *                       type: boolean
 *                       description: Force token to appear expired (testing)
 *                     simulateDisconnectAfter:
 *                       type: integer
 *                       description: Simulate disconnect after N seconds (testing)
 *                     forceFreshLogin:
 *                       type: boolean
 *                       description: Force fresh login instead of token refresh
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Return safe, non-sensitive configuration
    const config = {
      // API Configuration
      api: {
        enabled: process.env.API_ENABLED !== 'false',
        port: parseInt(process.env.API_PORT || '3000'),
        webUIEnabled: process.env.WEB_UI_ENABLED !== 'false',
        swaggerUrl: `http://localhost:${process.env.API_PORT || '3000'}/api-docs`
      },
      
      // MQTT Configuration (hide credentials)
      mqtt: {
        host: process.env.MQTT_HOST || 'localhost',
        port: parseInt(process.env.MQTT_PORT || '1883'),
        hasAuth: !!(process.env.MQTT_USER && process.env.MQTT_PASSWORD)
      },
      
      // REHAU Configuration (hide credentials)
      rehau: {
        email: process.env.REHAU_EMAIL ? maskEmail(process.env.REHAU_EMAIL) : 'Not set',
        hasPassword: !!process.env.REHAU_PASSWORD
      },
      
      // Intervals
      intervals: {
        zoneReload: parseInt(process.env.ZONE_RELOAD_INTERVAL || '300'),
        tokenRefresh: parseInt(process.env.TOKEN_REFRESH_INTERVAL || '21600'),
        referentialsReload: parseInt(process.env.REFERENTIALS_RELOAD_INTERVAL || '86400'),
        liveData: parseInt(process.env.LIVE_DATA_INTERVAL || '300')
      },
      
      // Command Configuration
      commands: {
        retryTimeout: parseInt(process.env.COMMAND_RETRY_TIMEOUT || '30'),
        maxRetries: parseInt(process.env.COMMAND_MAX_RETRIES || '3'),
        disableRedundant: process.env.DISABLE_REDUNDANT_COMMANDS === 'true'
      },
      
      // Logging
      logging: {
        level: process.env.LOG_LEVEL || 'info'
      },
      
      // Display Options
      display: {
        useGroupInNames: process.env.USE_GROUP_IN_NAMES === 'true'
      },
      
      // POP3 Configuration (hide credentials)
      pop3: {
        enabled: !!(process.env.POP3_EMAIL && process.env.POP3_PASSWORD),
        email: process.env.POP3_EMAIL ? maskEmail(process.env.POP3_EMAIL) : 'Not set',
        host: process.env.POP3_HOST || 'Not set',
        port: parseInt(process.env.POP3_PORT || '995'),
        secure: process.env.POP3_SECURE === 'true',
        ignoreTLSErrors: process.env.POP3_IGNORE_TLS_ERRORS !== 'false',
        debug: process.env.POP3_DEBUG === 'true',
        timeout: parseInt(process.env.POP3_TIMEOUT || '600000'),
        fromAddress: process.env.POP3_FROM_ADDRESS || 'noreply@accounts.rehau.com'
      },
      
      // Playwright Configuration
      playwright: {
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
        idleTimeout: parseInt(process.env.PLAYWRIGHT_IDLE_TIMEOUT || '300')
      },
      
      // Monitoring Configuration
      monitoring: {
        memoryWarningMB: parseInt(process.env.MEMORY_WARNING_MB || '150'),
        stalenessWarningMs: parseInt(process.env.STALENESS_WARNING_MS || '600000'),
        stalenessStaleMs: parseInt(process.env.STALENESS_STALE_MS || '1800000')
      },
      
      // Testing/Debug Options
      testing: {
        forceTokenExpired: process.env.FORCE_TOKEN_EXPIRED === 'true',
        simulateDisconnectAfter: parseInt(process.env.SIMULATE_DISCONNECT_AFTER_SECONDS || '0'),
        forceFreshLogin: process.env.FORCE_FRESH_LOGIN === 'true'
      }
    };
    
    res.json(config);
  } catch (error) {
    enhancedLogger.error('Failed to get config', error as Error, {
      component: 'API',
      direction: 'INTERNAL'
    });
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

/**
 * Mask email address for display
 */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  
  const maskedUser = user.length > 2 
    ? `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}`
    : user[0] + '*';
  
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.length > 1
    ? `${domainParts[0][0]}${'*'.repeat(Math.max(0, domainParts[0].length - 1))}.${domainParts.slice(1).join('.')}`
    : domain;
  
  return `${maskedUser}@${maskedDomain}`;
}

export default router;
