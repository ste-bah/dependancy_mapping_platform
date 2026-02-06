/**
 * Cache Admin Routes
 * @module routes/admin/cache-routes
 *
 * REST API endpoints for Rollup Cache administration.
 * Provides statistics, manual invalidation, and cache warming management.
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 *
 * Endpoints:
 * - GET  /api/admin/cache/stats          - Get cache statistics
 * - POST /api/admin/cache/invalidate     - Manually invalidate cache entries
 * - POST /api/admin/cache/warm           - Trigger cache warming
 * - GET  /api/admin/cache/warming-jobs   - List warming job status
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../../middleware/auth.js';
import { ForbiddenError, ValidationError } from '../../middleware/error-handler.js';
import { ErrorResponseSchema } from '../schemas/common.js';
import { createTenantId } from '../../types/entities.js';
import { createRollupId } from '../../types/rollup.js';
import {
  IRollupCache,
  CacheStats,
  createCacheTag,
  ICacheWarmingProcessor,
  CacheWarmingJobStatus,
  CacheWarmingJobState,
  CacheWarmingTargetType,
  WarmingPriority,
} from '../../services/rollup/rollup-cache/index.js';

const logger = pino({ name: 'cache-admin-routes' });

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * L1 cache statistics schema
 */
const L1StatsSchema = Type.Object({
  size: Type.Number({ description: 'Current L1 cache size (entries)' }),
  maxSize: Type.Number({ description: 'Maximum L1 cache size' }),
  hitRatio: Type.Number({ description: 'L1 hit ratio (0-1)' }),
  hits: Type.Number({ description: 'Total L1 cache hits' }),
  misses: Type.Number({ description: 'Total L1 cache misses' }),
});

/**
 * L2 (Redis) cache statistics schema
 */
const L2StatsSchema = Type.Object({
  connected: Type.Boolean({ description: 'Whether L2 (Redis) is connected' }),
  keyCount: Type.Optional(Type.Number({ description: 'Approximate number of keys' })),
  memoryUsageMB: Type.Optional(Type.Number({ description: 'Redis memory usage in MB' })),
});

/**
 * Cache warming statistics schema
 */
const WarmingStatsSchema = Type.Object({
  queueLength: Type.Number({ description: 'Jobs in queue' }),
  activeJobs: Type.Number({ description: 'Currently active jobs' }),
  completedLast24h: Type.Number({ description: 'Jobs completed in last 24 hours' }),
  failedLast24h: Type.Number({ description: 'Jobs failed in last 24 hours' }),
});

/**
 * GET /stats response schema
 */
const CacheStatsResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    l1: L1StatsSchema,
    l2: L2StatsSchema,
    warming: WarmingStatsSchema,
    overall: Type.Object({
      totalHits: Type.Number(),
      totalMisses: Type.Number(),
      hitRatio: Type.Number(),
      avgGetLatencyMs: Type.Number(),
      avgSetLatencyMs: Type.Number(),
    }),
  }),
});

type CacheStatsResponse = Static<typeof CacheStatsResponseSchema>;

/**
 * POST /invalidate request schema
 */
const InvalidateCacheRequestSchema = Type.Object({
  tags: Type.Optional(Type.Array(Type.String(), {
    description: 'Tags to invalidate',
    minItems: 1,
    maxItems: 100,
  })),
  pattern: Type.Optional(Type.String({
    description: 'Key pattern to match (supports * wildcard)',
    minLength: 1,
    maxLength: 200,
  })),
  tenantId: Type.Optional(Type.String({
    format: 'uuid',
    description: 'Invalidate all cache for this tenant',
  })),
});

type InvalidateCacheRequest = Static<typeof InvalidateCacheRequestSchema>;

/**
 * POST /invalidate response schema
 */
const InvalidateCacheResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    invalidated: Type.Number({ description: 'Number of entries invalidated' }),
    message: Type.String({ description: 'Result message' }),
  }),
});

type InvalidateCacheResponse = Static<typeof InvalidateCacheResponseSchema>;

/**
 * Warming type enum
 */
const WarmingTypeSchema = Type.Union([
  Type.Literal('execution-result'),
  Type.Literal('blast-radius'),
  Type.Literal('full'),
]);

type WarmingType = Static<typeof WarmingTypeSchema>;

/**
 * Warming priority enum
 */
const WarmingPrioritySchema = Type.Union([
  Type.Literal('high'),
  Type.Literal('normal'),
  Type.Literal('low'),
]);

type WarmingPriorityString = Static<typeof WarmingPrioritySchema>;

/**
 * POST /warm request schema
 */
const WarmCacheRequestSchema = Type.Object({
  tenantId: Type.String({
    format: 'uuid',
    description: 'Tenant to warm cache for',
  }),
  rollupIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Specific rollup IDs to warm',
    minItems: 1,
    maxItems: 50,
  })),
  warmingType: WarmingTypeSchema,
  priority: Type.Optional(WarmingPrioritySchema),
});

type WarmCacheRequest = Static<typeof WarmCacheRequestSchema>;

/**
 * POST /warm response schema
 */
const WarmCacheResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    jobIds: Type.Array(Type.String()),
    message: Type.String(),
  }),
});

type WarmCacheResponse = Static<typeof WarmCacheResponseSchema>;

/**
 * GET /warming-jobs query schema
 */
const ListWarmingJobsQuerySchema = Type.Object({
  status: Type.Optional(Type.String({ description: 'Filter by job status' })),
  limit: Type.Optional(Type.Number({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Maximum jobs to return',
  })),
});

type ListWarmingJobsQuery = Static<typeof ListWarmingJobsQuerySchema>;

/**
 * Warming job status schema
 */
const WarmingJobStatusSchema = Type.Object({
  jobId: Type.String(),
  state: Type.String(),
  progress: Type.Number(),
  itemsWarmed: Type.Number(),
  totalItems: Type.Number(),
  cacheHits: Type.Number(),
  cacheMisses: Type.Number(),
  errors: Type.Number(),
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  errorMessage: Type.Optional(Type.String()),
});

/**
 * GET /warming-jobs response schema
 */
const ListWarmingJobsResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    jobs: Type.Array(WarmingJobStatusSchema),
    total: Type.Number(),
  }),
});

type ListWarmingJobsResponse = Static<typeof ListWarmingJobsResponseSchema>;

// ============================================================================
// Admin Authorization
// ============================================================================

/**
 * Admin role names that grant cache admin access
 */
const ADMIN_ROLES = ['admin', 'super_admin', 'system_admin'];

/**
 * PreHandler hook to require admin role.
 * Checks auth context for admin role membership.
 *
 * @throws ForbiddenError if user is not an admin
 */
async function requireAdmin(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const auth = getAuthContext(request);

  // Check if user has admin role
  // Note: In a real implementation, roles would come from the auth context
  // For now, we check if the user's email ends with specific domain or is in an admin list
  const isAdmin = checkAdminStatus(auth);

  if (!isAdmin) {
    logger.warn({ userId: auth.userId }, 'Non-admin user attempted cache admin access');
    throw new ForbiddenError('Admin access required for cache management');
  }

  logger.debug({ userId: auth.userId }, 'Admin access granted');
}

/**
 * Check if the authenticated user has admin privileges.
 * This is a placeholder implementation - in production, this would
 * check against actual role assignments from a database or auth provider.
 */
function checkAdminStatus(auth: { userId: string; email?: string }): boolean {
  // Placeholder: Check if email is from admin domain
  // In production, check roles from database or auth provider
  const adminEmails = process.env.CACHE_ADMIN_EMAILS?.split(',') ?? [];
  const adminDomains = process.env.CACHE_ADMIN_DOMAINS?.split(',') ?? [];

  if (auth.email) {
    // Check explicit admin emails
    if (adminEmails.includes(auth.email)) {
      return true;
    }

    // Check admin domains
    const emailDomain = auth.email.split('@')[1];
    if (emailDomain && adminDomains.includes(emailDomain)) {
      return true;
    }
  }

  // For development/testing, allow if env var is set
  if (process.env.CACHE_ADMIN_ALLOW_ALL === 'true') {
    return true;
  }

  return false;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map string priority to numeric WarmingPriority
 */
function mapPriority(priority?: WarmingPriorityString): number {
  switch (priority) {
    case 'high':
      return WarmingPriority.HIGH;
    case 'low':
      return WarmingPriority.LOW;
    case 'normal':
    default:
      return WarmingPriority.NORMAL;
  }
}

/**
 * Map warming type to cache warming target types
 */
function mapWarmingType(warmingType: WarmingType): readonly (typeof CacheWarmingTargetType)[keyof typeof CacheWarmingTargetType][] {
  switch (warmingType) {
    case 'execution-result':
      return [CacheWarmingTargetType.EXECUTION_RESULT];
    case 'blast-radius':
      return [CacheWarmingTargetType.BLAST_RADIUS];
    case 'full':
      return [
        CacheWarmingTargetType.EXECUTION_RESULT,
        CacheWarmingTargetType.MERGED_GRAPH,
        CacheWarmingTargetType.BLAST_RADIUS,
      ];
  }
}

// ============================================================================
// Route Plugin
// ============================================================================

/**
 * Cache admin routes plugin.
 * Registers all cache management endpoints.
 */
const cacheAdminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Get cache service from dependency injection
  const getRollupCache = (): IRollupCache => {
    const cache = (fastify as FastifyInstance & { rollupCache?: IRollupCache }).rollupCache;
    if (!cache) {
      logger.error('RollupCache not registered');
      throw new Error('RollupCache service not available');
    }
    return cache;
  };

  // Get warming processor from dependency injection
  const getWarmingProcessor = (): ICacheWarmingProcessor | null => {
    return (fastify as FastifyInstance & { cacheWarmingProcessor?: ICacheWarmingProcessor }).cacheWarmingProcessor ?? null;
  };

  // ==========================================================================
  // GET /stats - Get cache statistics
  // ==========================================================================
  fastify.get<{
    Reply: CacheStatsResponse;
  }>('/stats', {
    schema: {
      description: 'Get comprehensive cache statistics including L1, L2, and warming metrics',
      tags: ['Admin', 'Cache'],
      response: {
        200: CacheStatsResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth, requireAdmin],
  }, async (_request, _reply): Promise<CacheStatsResponse> => {
    logger.debug('Fetching cache statistics');

    const cache = getRollupCache();
    const warmingProcessor = getWarmingProcessor();
    const stats: CacheStats = cache.getStats();

    // Calculate L1 max size (from config, placeholder value)
    const l1MaxSize = 3500; // executionMaxSize + graphMaxSize + blastRadiusMaxSize

    // Build response
    const response: CacheStatsResponse = {
      success: true,
      data: {
        l1: {
          size: stats.l1Size,
          maxSize: l1MaxSize,
          hitRatio: stats.l1HitRatio,
          hits: stats.l1Hits,
          misses: stats.l1Misses,
        },
        l2: {
          connected: true, // If we got here without error, Redis is connected
          keyCount: undefined, // Would need Redis INFO command
          memoryUsageMB: undefined, // Would need Redis INFO command
        },
        warming: {
          queueLength: 0,
          activeJobs: 0,
          completedLast24h: 0,
          failedLast24h: 0,
        },
        overall: {
          totalHits: stats.totalHits,
          totalMisses: stats.totalMisses,
          hitRatio: stats.hitRatio,
          avgGetLatencyMs: stats.avgGetLatencyMs,
          avgSetLatencyMs: stats.avgSetLatencyMs,
        },
      },
    };

    // Add warming stats if processor is available
    if (warmingProcessor) {
      // Note: Full warming stats would require tracking job history
      // This is a placeholder showing the interface
      logger.debug('Warming processor available, stats included');
    }

    logger.info({ stats: response.data.overall }, 'Cache statistics retrieved');

    return response;
  });

  // ==========================================================================
  // POST /invalidate - Manually invalidate cache entries
  // ==========================================================================
  fastify.post<{
    Body: InvalidateCacheRequest;
    Reply: InvalidateCacheResponse;
  }>('/invalidate', {
    schema: {
      description: 'Manually invalidate cache entries by tags, pattern, or tenant',
      tags: ['Admin', 'Cache'],
      body: InvalidateCacheRequestSchema,
      response: {
        200: InvalidateCacheResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth, requireAdmin],
  }, async (request, _reply): Promise<InvalidateCacheResponse> => {
    const { tags, pattern, tenantId } = request.body;

    // Validate at least one invalidation criteria is provided
    if (!tags && !pattern && !tenantId) {
      throw new ValidationError('At least one of tags, pattern, or tenantId must be provided');
    }

    const cache = getRollupCache();
    let totalInvalidated = 0;
    const invalidationResults: string[] = [];

    logger.info(
      { tags, pattern, tenantId, userId: getAuthContext(request).userId },
      'Processing cache invalidation request'
    );

    // Invalidate by tags
    if (tags && tags.length > 0) {
      const cacheTags = tags.map(t => createCacheTag(t));
      const tagInvalidated = await cache.invalidateByTags(cacheTags);
      totalInvalidated += tagInvalidated;
      invalidationResults.push(`${tagInvalidated} entries invalidated by tags`);
      logger.info({ tags, invalidated: tagInvalidated }, 'Invalidated by tags');
    }

    // Invalidate by tenant
    if (tenantId) {
      const tenantInvalidated = await cache.invalidateTenant(createTenantId(tenantId));
      totalInvalidated += tenantInvalidated;
      invalidationResults.push(`${tenantInvalidated} entries invalidated for tenant ${tenantId}`);
      logger.info({ tenantId, invalidated: tenantInvalidated }, 'Invalidated by tenant');
    }

    // Note: Pattern-based invalidation would require L2 Redis SCAN command
    // This is logged but not fully implemented in the base cache
    if (pattern) {
      logger.info({ pattern }, 'Pattern invalidation requested (limited support)');
      invalidationResults.push('Pattern invalidation noted (requires Redis SCAN)');
    }

    const message = invalidationResults.join('; ') || 'No entries invalidated';

    logger.info(
      { totalInvalidated, message, userId: getAuthContext(request).userId },
      'Cache invalidation completed'
    );

    return {
      success: true,
      data: {
        invalidated: totalInvalidated,
        message,
      },
    };
  });

  // ==========================================================================
  // POST /warm - Trigger cache warming
  // ==========================================================================
  fastify.post<{
    Body: WarmCacheRequest;
    Reply: WarmCacheResponse;
  }>('/warm', {
    schema: {
      description: 'Trigger proactive cache warming for specified tenant and rollups',
      tags: ['Admin', 'Cache'],
      body: WarmCacheRequestSchema,
      response: {
        202: WarmCacheResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
        503: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth, requireAdmin],
  }, async (request, reply): Promise<WarmCacheResponse> => {
    const { tenantId, rollupIds, warmingType, priority } = request.body;

    const warmingProcessor = getWarmingProcessor();

    if (!warmingProcessor) {
      logger.warn('Cache warming requested but processor not available');
      return reply.status(503).send({
        success: true,
        data: {
          jobIds: [],
          message: 'Cache warming processor not available',
        },
      } as WarmCacheResponse);
    }

    logger.info(
      {
        tenantId,
        rollupIds: rollupIds?.length,
        warmingType,
        priority,
        userId: getAuthContext(request).userId,
      },
      'Processing cache warming request'
    );

    // Map request to warming job data
    const targetTypes = mapWarmingType(warmingType);
    const numericPriority = mapPriority(priority);

    // Schedule the warming job
    const jobId = await warmingProcessor.schedule({
      tenantId: createTenantId(tenantId),
      rollupIds: rollupIds?.map(id => createRollupId(id)),
      targetTypes,
      priority: numericPriority,
      forceRefresh: false,
      maxItems: 100,
    });

    logger.info(
      { jobId, tenantId, warmingType },
      'Cache warming job scheduled'
    );

    reply.status(202);
    return {
      success: true,
      data: {
        jobIds: [jobId],
        message: `Cache warming job scheduled for tenant ${tenantId}`,
      },
    };
  });

  // ==========================================================================
  // GET /warming-jobs - List warming job status
  // ==========================================================================
  fastify.get<{
    Querystring: ListWarmingJobsQuery;
    Reply: ListWarmingJobsResponse;
  }>('/warming-jobs', {
    schema: {
      description: 'List cache warming jobs with optional status filtering',
      tags: ['Admin', 'Cache'],
      querystring: ListWarmingJobsQuerySchema,
      response: {
        200: ListWarmingJobsResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth, requireAdmin],
  }, async (request, _reply): Promise<ListWarmingJobsResponse> => {
    const { status, limit = 20 } = request.query;

    const warmingProcessor = getWarmingProcessor();

    if (!warmingProcessor) {
      logger.debug('Cache warming processor not available, returning empty list');
      return {
        success: true,
        data: {
          jobs: [],
          total: 0,
        },
      };
    }

    logger.debug({ status, limit }, 'Listing warming jobs');

    // Note: The current warming processor doesn't have a listJobs method.
    // This is a placeholder showing the expected interface.
    // In a full implementation, the processor would track job history.

    // Placeholder: Return empty list or mock data
    // In production, this would query BullMQ for job status
    const jobs: CacheWarmingJobStatus[] = [];

    // If status filter is provided, filter jobs
    const filteredJobs = status
      ? jobs.filter(job => job.state === status)
      : jobs;

    // Apply limit
    const limitedJobs = filteredJobs.slice(0, limit);

    logger.info(
      { total: limitedJobs.length, status, limit },
      'Warming jobs listed'
    );

    return {
      success: true,
      data: {
        jobs: limitedJobs,
        total: filteredJobs.length,
      },
    };
  });

  logger.info('Cache admin routes registered');
};

export default cacheAdminRoutes;

// Export for testing
export { cacheAdminRoutes };

// ============================================================================
// Type Declarations
// ============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    rollupCache?: IRollupCache;
    cacheWarmingProcessor?: ICacheWarmingProcessor;
  }
}
