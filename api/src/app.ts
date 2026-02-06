/**
 * Fastify Application Factory
 * @module app
 */

import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import pino from 'pino';

import errorHandler from './middleware/error-handler.js';
import tenantContext from './middleware/tenant-context.js';
import authMiddleware from './middleware/auth.js';
import swaggerPlugin from './plugins/swagger.js';
import routes from './routes/index.js';

/**
 * Application configuration options
 */
export interface AppOptions extends FastifyServerOptions {
  /**
   * Enable CORS
   * @default true
   */
  cors?: boolean;

  /**
   * Enable Helmet security headers
   * @default true
   */
  helmet?: boolean;

  /**
   * Enable tenant context middleware
   * @default true
   */
  tenantContext?: boolean;

  /**
   * Tenant context options
   */
  tenantContextOptions?: {
    required?: boolean;
    skipRoutes?: string[];
  };

  /**
   * Enable Swagger documentation
   * @default true in development, false in production
   */
  swagger?: boolean;

  /**
   * Swagger plugin options
   */
  swaggerOptions?: {
    routePrefix?: string;
    exposeRoute?: boolean;
  };
}

/**
 * Default application options
 */
const defaultOptions: AppOptions = {
  cors: true,
  helmet: true,
  tenantContext: true,
  swagger: process.env.NODE_ENV !== 'production',
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
};

/**
 * Create and configure Fastify application instance
 */
export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const options = { ...defaultOptions, ...opts };
  const logger = pino({ name: 'app-factory' });

  // Create Fastify instance
  const app = Fastify({
    logger: options.logger,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Register CORS plugin
  if (options.cors) {
    await app.register(cors, {
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Tenant-ID',
        'X-User-ID',
      ],
    });
    logger.debug('CORS plugin registered');
  }

  // Register Helmet security plugin
  if (options.helmet) {
    await app.register(helmet, {
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    });
    logger.debug('Helmet plugin registered');
  }

  // Register cookie plugin
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
    parseOptions: {},
  });
  logger.debug('Cookie plugin registered');

  // Register rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.ip;
    },
  });
  logger.debug('Rate limit plugin registered');

  // Register error handler (must be before routes)
  await app.register(errorHandler);
  logger.debug('Error handler registered');

  // Register auth middleware (after error handler)
  await app.register(authMiddleware);
  logger.debug('Auth middleware registered');

  // Register tenant context middleware
  if (options.tenantContext) {
    await app.register(tenantContext, {
      required: options.tenantContextOptions?.required ?? false,
      skipRoutes: options.tenantContextOptions?.skipRoutes ?? [
        '/health',
        '/health/live',
        '/health/ready',
        '/health/detailed',
        '/docs',
        '/docs/*',
        '/openapi.json',
        '/openapi.yaml',
      ],
    });
    logger.debug('Tenant context middleware registered');
  }

  // Register Swagger documentation (MUST be before routes)
  if (options.swagger) {
    await app.register(swaggerPlugin, {
      routePrefix: options.swaggerOptions?.routePrefix ?? '/docs',
      exposeRoute: options.swaggerOptions?.exposeRoute ?? true,
    });
    logger.debug('Swagger documentation registered');
  }

  // Register routes
  await app.register(routes);
  logger.debug('Routes registered');

  // Add graceful shutdown hook
  app.addHook('onClose', async () => {
    logger.info('Application closing...');
  });

  return app;
}

/**
 * Create application for testing (disabled logging)
 */
export async function buildTestApp(opts: Partial<AppOptions> = {}): Promise<FastifyInstance> {
  return buildApp({
    ...opts,
    logger: false,
    tenantContext: opts.tenantContext ?? false,
  });
}

export default buildApp;
