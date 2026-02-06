/**
 * Health Check Routes
 * @module routes/health
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  HealthCheckSchema,
  DetailedHealthCheckSchema,
  LivenessProbeSchema,
  ReadinessProbeSchema,
  type HealthCheck,
  type DetailedHealthCheck,
  type LivenessProbe,
  type ReadinessProbe,
} from '../types/index.js';
import { checkConnection } from '../db/connection.js';

/**
 * Application start time for uptime calculation
 */
const startTime = Date.now();

/**
 * Get application version from package.json or environment
 */
function getVersion(): string {
  return process.env.APP_VERSION || process.env.npm_package_version || '0.1.0';
}

/**
 * Calculate uptime in seconds
 */
function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Get memory usage statistics
 */
function getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
  };
}

/**
 * Health check routes plugin
 */
const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * Basic health check endpoint
   * GET /health
   */
  fastify.get<{ Reply: HealthCheck }>(
    '/health',
    {
      schema: {
        tags: ['Health'],
        response: {
          200: HealthCheckSchema,
        },
      },
    },
    async (_request, reply) => {
      const health: HealthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: getVersion(),
        uptime: getUptime(),
      };

      return reply.status(200).send(health);
    }
  );

  /**
   * Detailed health check endpoint
   * GET /health/detailed
   */
  fastify.get<{ Reply: DetailedHealthCheck }>(
    '/health/detailed',
    {
      schema: {
        tags: ['Health'],
        response: {
          200: DetailedHealthCheckSchema,
          503: DetailedHealthCheckSchema,
        },
      },
    },
    async (_request, reply) => {
      const dbStart = Date.now();
      const dbHealthy = await checkConnection();
      const dbLatency = Date.now() - dbStart;

      const memoryUsage = getMemoryUsage();
      const memoryHealthy = memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9;

      const overallHealthy = dbHealthy && memoryHealthy;
      const status = overallHealthy
        ? 'healthy'
        : dbHealthy ? 'degraded' : 'unhealthy';

      const health: DetailedHealthCheck = {
        status,
        timestamp: new Date().toISOString(),
        version: getVersion(),
        uptime: getUptime(),
        checks: {
          database: {
            status: dbHealthy ? 'up' : 'down',
            latency: dbLatency,
            message: dbHealthy ? undefined : 'Database connection failed',
          },
          memory: {
            status: memoryHealthy ? 'up' : 'down',
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external,
          },
        },
      };

      const statusCode = overallHealthy ? 200 : 503;
      return reply.status(statusCode).send(health);
    }
  );

  /**
   * Liveness probe endpoint (Kubernetes)
   * GET /health/live
   */
  fastify.get<{ Reply: LivenessProbe }>(
    '/health/live',
    {
      schema: {
        tags: ['Health'],
        response: {
          200: LivenessProbeSchema,
        },
      },
    },
    async (_request, reply) => {
      const liveness: LivenessProbe = {
        alive: true,
        timestamp: new Date().toISOString(),
      };

      return reply.status(200).send(liveness);
    }
  );

  /**
   * Readiness probe endpoint (Kubernetes)
   * GET /health/ready
   */
  fastify.get<{ Reply: ReadinessProbe }>(
    '/health/ready',
    {
      schema: {
        tags: ['Health'],
        response: {
          200: ReadinessProbeSchema,
          503: ReadinessProbeSchema,
        },
      },
    },
    async (_request, reply) => {
      const dbHealthy = await checkConnection();

      const readiness: ReadinessProbe = {
        ready: dbHealthy,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: dbHealthy,
        },
      };

      const statusCode = dbHealthy ? 200 : 503;
      return reply.status(statusCode).send(readiness);
    }
  );
};

export default healthRoutes;
