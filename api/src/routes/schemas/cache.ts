/**
 * Cache Admin API Schemas
 * @module routes/schemas/cache
 *
 * TypeBox schemas for Cache Admin API endpoints.
 * Provides request/response validation for cache management operations.
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 */

import { Type, Static, TSchema } from '@sinclair/typebox';

// ============================================================================
// L1 Cache Statistics
// ============================================================================

/**
 * L1 (in-memory) cache statistics
 */
export const L1CacheStatsSchema = Type.Object({
  size: Type.Number({ description: 'Current number of entries in L1 cache' }),
  maxSize: Type.Number({ description: 'Maximum L1 cache capacity' }),
  hitRatio: Type.Number({ description: 'L1 cache hit ratio (0-1)', minimum: 0, maximum: 1 }),
  hits: Type.Number({ description: 'Total L1 cache hits since startup' }),
  misses: Type.Number({ description: 'Total L1 cache misses since startup' }),
});

export type L1CacheStats = Static<typeof L1CacheStatsSchema>;

// ============================================================================
// L2 (Redis) Cache Statistics
// ============================================================================

/**
 * L2 (Redis) cache statistics
 */
export const L2CacheStatsSchema = Type.Object({
  connected: Type.Boolean({ description: 'Whether Redis connection is active' }),
  keyCount: Type.Optional(Type.Number({ description: 'Approximate number of cache keys' })),
  memoryUsageMB: Type.Optional(Type.Number({ description: 'Redis memory usage in megabytes' })),
});

export type L2CacheStats = Static<typeof L2CacheStatsSchema>;

// ============================================================================
// Cache Warming Statistics
// ============================================================================

/**
 * Cache warming job statistics
 */
export const WarmingStatsSchema = Type.Object({
  queueLength: Type.Number({ description: 'Number of warming jobs in queue' }),
  activeJobs: Type.Number({ description: 'Number of currently active warming jobs' }),
  completedLast24h: Type.Number({ description: 'Jobs completed in the last 24 hours' }),
  failedLast24h: Type.Number({ description: 'Jobs failed in the last 24 hours' }),
});

export type WarmingStats = Static<typeof WarmingStatsSchema>;

// ============================================================================
// Overall Cache Statistics
// ============================================================================

/**
 * Overall cache performance statistics
 */
export const OverallCacheStatsSchema = Type.Object({
  totalHits: Type.Number({ description: 'Total cache hits (L1 + L2)' }),
  totalMisses: Type.Number({ description: 'Total cache misses' }),
  hitRatio: Type.Number({ description: 'Overall cache hit ratio (0-1)' }),
  avgGetLatencyMs: Type.Number({ description: 'Average cache get latency in milliseconds' }),
  avgSetLatencyMs: Type.Number({ description: 'Average cache set latency in milliseconds' }),
});

export type OverallCacheStats = Static<typeof OverallCacheStatsSchema>;

// ============================================================================
// Cache Stats Response
// ============================================================================

/**
 * Complete cache statistics response
 */
export const CacheStatsDataSchema = Type.Object({
  l1: L1CacheStatsSchema,
  l2: L2CacheStatsSchema,
  warming: WarmingStatsSchema,
  overall: OverallCacheStatsSchema,
});

export type CacheStatsData = Static<typeof CacheStatsDataSchema>;

export const CacheStatsResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: CacheStatsDataSchema,
});

export type CacheStatsResponse = Static<typeof CacheStatsResponseSchema>;

// ============================================================================
// Cache Invalidation Request
// ============================================================================

/**
 * Cache invalidation request body
 * At least one of tags, pattern, or tenantId must be provided.
 */
export const InvalidateCacheRequestSchema = Type.Object({
  tags: Type.Optional(Type.Array(Type.String({
    description: 'Cache tag (e.g., "tenant:123", "rollup:abc")',
  }), {
    description: 'Tags to invalidate - all keys with matching tags will be removed',
    minItems: 1,
    maxItems: 100,
  })),
  pattern: Type.Optional(Type.String({
    description: 'Key pattern with optional wildcard (*) - e.g., "rollup:v1:tenant123:*"',
    minLength: 1,
    maxLength: 200,
  })),
  tenantId: Type.Optional(Type.String({
    format: 'uuid',
    description: 'Tenant UUID - invalidates all cache entries for this tenant',
  })),
});

export type InvalidateCacheRequest = Static<typeof InvalidateCacheRequestSchema>;

// ============================================================================
// Cache Invalidation Response
// ============================================================================

/**
 * Cache invalidation result
 */
export const InvalidateCacheDataSchema = Type.Object({
  invalidated: Type.Number({ description: 'Number of cache entries invalidated' }),
  message: Type.String({ description: 'Human-readable result message' }),
});

export type InvalidateCacheData = Static<typeof InvalidateCacheDataSchema>;

export const InvalidateCacheResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: InvalidateCacheDataSchema,
});

export type InvalidateCacheResponse = Static<typeof InvalidateCacheResponseSchema>;

// ============================================================================
// Cache Warming Request
// ============================================================================

/**
 * Warming type options
 */
export const WarmingTypeSchema = Type.Union([
  Type.Literal('execution-result', { description: 'Warm execution result cache only' }),
  Type.Literal('blast-radius', { description: 'Warm blast radius calculation cache only' }),
  Type.Literal('full', { description: 'Warm all cache types' }),
]);

export type WarmingType = Static<typeof WarmingTypeSchema>;

/**
 * Warming priority options
 */
export const WarmingPrioritySchema = Type.Union([
  Type.Literal('high', { description: 'High priority - process before other jobs' }),
  Type.Literal('normal', { description: 'Normal priority - default queue position' }),
  Type.Literal('low', { description: 'Low priority - process when idle' }),
]);

export type WarmingPriority = Static<typeof WarmingPrioritySchema>;

/**
 * Cache warming request body
 */
export const WarmCacheRequestSchema = Type.Object({
  tenantId: Type.String({
    format: 'uuid',
    description: 'Tenant UUID to warm cache for',
  }),
  rollupIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Specific rollup UUIDs to warm - if omitted, warms all tenant rollups',
    minItems: 1,
    maxItems: 50,
  })),
  warmingType: WarmingTypeSchema,
  priority: Type.Optional(WarmingPrioritySchema),
});

export type WarmCacheRequest = Static<typeof WarmCacheRequestSchema>;

// ============================================================================
// Cache Warming Response
// ============================================================================

/**
 * Cache warming job created response
 */
export const WarmCacheDataSchema = Type.Object({
  jobIds: Type.Array(Type.String(), {
    description: 'IDs of the created warming jobs',
  }),
  message: Type.String({ description: 'Status message' }),
});

export type WarmCacheData = Static<typeof WarmCacheDataSchema>;

export const WarmCacheResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: WarmCacheDataSchema,
});

export type WarmCacheResponse = Static<typeof WarmCacheResponseSchema>;

// ============================================================================
// Warming Jobs List Request
// ============================================================================

/**
 * Query parameters for listing warming jobs
 */
export const ListWarmingJobsQuerySchema = Type.Object({
  status: Type.Optional(Type.String({
    description: 'Filter by job status (pending, active, completed, failed)',
  })),
  limit: Type.Optional(Type.Number({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Maximum number of jobs to return',
  })),
});

export type ListWarmingJobsQuery = Static<typeof ListWarmingJobsQuerySchema>;

// ============================================================================
// Warming Job Status
// ============================================================================

/**
 * Individual warming job status
 */
export const WarmingJobStatusSchema = Type.Object({
  jobId: Type.String({ description: 'Unique job identifier' }),
  state: Type.String({ description: 'Current job state' }),
  progress: Type.Number({ description: 'Progress percentage (0-100)', minimum: 0, maximum: 100 }),
  itemsWarmed: Type.Number({ description: 'Number of items successfully warmed' }),
  totalItems: Type.Number({ description: 'Total items to warm' }),
  cacheHits: Type.Number({ description: 'Items already in cache (skipped)' }),
  cacheMisses: Type.Number({ description: 'Items newly added to cache' }),
  errors: Type.Number({ description: 'Number of errors encountered' }),
  startedAt: Type.Optional(Type.String({
    format: 'date-time',
    description: 'When the job started processing',
  })),
  completedAt: Type.Optional(Type.String({
    format: 'date-time',
    description: 'When the job completed',
  })),
  errorMessage: Type.Optional(Type.String({
    description: 'Error message if job failed',
  })),
});

export type WarmingJobStatus = Static<typeof WarmingJobStatusSchema>;

// ============================================================================
// Warming Jobs List Response
// ============================================================================

/**
 * Response for listing warming jobs
 */
export const ListWarmingJobsDataSchema = Type.Object({
  jobs: Type.Array(WarmingJobStatusSchema),
  total: Type.Number({ description: 'Total number of jobs matching filter' }),
});

export type ListWarmingJobsData = Static<typeof ListWarmingJobsDataSchema>;

export const ListWarmingJobsResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: ListWarmingJobsDataSchema,
});

export type ListWarmingJobsResponse = Static<typeof ListWarmingJobsResponseSchema>;

// ============================================================================
// Route Schema Definitions
// ============================================================================

/**
 * Route schema type for Fastify
 */
export interface RouteSchema {
  description: string;
  tags: string[];
  body?: TSchema;
  querystring?: TSchema;
  params?: TSchema;
  response: Record<number, TSchema>;
  security?: Array<Record<string, string[]>>;
}

import { ErrorResponseSchema } from './common.js';

/**
 * GET /api/admin/cache/stats
 */
export const GetCacheStatsRoute: RouteSchema = {
  description: 'Get comprehensive cache statistics including L1, L2, and warming metrics',
  tags: ['Admin', 'Cache'],
  response: {
    200: CacheStatsResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /api/admin/cache/invalidate
 */
export const InvalidateCacheRoute: RouteSchema = {
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
  security: [{ bearerAuth: [] }],
};

/**
 * POST /api/admin/cache/warm
 */
export const WarmCacheRoute: RouteSchema = {
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
  security: [{ bearerAuth: [] }],
};

/**
 * GET /api/admin/cache/warming-jobs
 */
export const ListWarmingJobsRoute: RouteSchema = {
  description: 'List cache warming jobs with optional status filtering',
  tags: ['Admin', 'Cache'],
  querystring: ListWarmingJobsQuerySchema,
  response: {
    200: ListWarmingJobsResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

// ============================================================================
// Route Registry
// ============================================================================

/**
 * All cache admin routes for registration
 */
export const CacheAdminRoutes = [
  {
    method: 'GET' as const,
    url: '/api/admin/cache/stats',
    schema: GetCacheStatsRoute,
  },
  {
    method: 'POST' as const,
    url: '/api/admin/cache/invalidate',
    schema: InvalidateCacheRoute,
  },
  {
    method: 'POST' as const,
    url: '/api/admin/cache/warm',
    schema: WarmCacheRoute,
  },
  {
    method: 'GET' as const,
    url: '/api/admin/cache/warming-jobs',
    schema: ListWarmingJobsRoute,
  },
] as const;

export type CacheAdminRouteDefinition = typeof CacheAdminRoutes[number];
