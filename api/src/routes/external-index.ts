/**
 * External Object Index Routes
 * @module routes/external-index
 *
 * REST API endpoints for External Object Index operations.
 * Provides lookup, reverse lookup, index building, and statistics APIs.
 *
 * TASK-ROLLUP-003: Build external object index from all scans with reverse lookup support.
 *
 * Endpoints:
 * - GET /api/v1/external-index/lookup - Look up external object by identifier
 * - POST /api/v1/external-index/lookup/batch - Batch lookup of external objects
 * - GET /api/v1/external-index/scans/:scanId/nodes/:nodeId/external-objects - Reverse lookup
 * - POST /api/v1/external-index/reverse-lookup/batch - Batch reverse lookup
 * - GET /api/v1/external-index/objects - List external objects
 * - POST /api/v1/external-index/search - Search external objects
 * - GET /api/v1/external-index/objects/:externalObjectId - Get external object details
 * - POST /api/v1/external-index/build - Trigger index build
 * - GET /api/v1/external-index/builds - List build operations
 * - GET /api/v1/external-index/builds/:buildId - Get build status
 * - POST /api/v1/external-index/builds/:buildId/cancel - Cancel a running build
 * - GET /api/v1/external-index/stats - Get index statistics
 * - POST /api/v1/external-index/cache/clear - Clear the index cache
 * - GET /api/v1/external-index/health - Health check for the index
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../middleware/error-handler.js';
import { ErrorResponseSchema, createPaginationInfo } from './schemas/common.js';
import {
  // Param schemas
  ExternalObjectIdParamsSchema,
  BuildIdParamsSchema,
  NodeIdParamsSchema,
  // Query schemas
  LookupQuerySchema,
  ReverseLookupQuerySchema,
  ListExternalObjectsQuerySchema,
  // Request schemas
  BatchLookupRequestSchema,
  BatchReverseLookupRequestSchema,
  BuildIndexRequestSchema,
  CancelBuildRequestSchema,
  SearchExternalObjectsRequestSchema,
  // Response schemas
  LookupResponseSchema,
  BatchLookupResponseSchema,
  ReverseLookupResponseSchema,
  BatchReverseLookupResponseSchema,
  BuildResponseSchema,
  BuildListResponseSchema,
  StatsResponseSchema,
  ListExternalObjectsResponseSchema,
  SearchExternalObjectsResponseSchema,
  EmptySuccessResponseSchema,
  CacheClearResponseSchema,
  // Route schemas
  LookupRoute,
  BatchLookupRoute,
  ReverseLookupRoute,
  BatchReverseLookupRoute,
  ListExternalObjectsRoute,
  SearchExternalObjectsRoute,
  GetExternalObjectRoute,
  BuildIndexRoute,
  ListBuildsRoute,
  GetBuildStatusRoute,
  CancelBuildRoute,
  GetStatsRoute,
  ClearCacheRoute,
  IndexHealthRoute,
  // Types
  type ExternalObjectIdParams,
  type BuildIdParams,
  type NodeIdParams,
  type LookupQuery,
  type ReverseLookupQuery,
  type ListExternalObjectsQuery,
  type BatchLookupRequest,
  type BatchReverseLookupRequest,
  type BuildIndexRequest,
  type CancelBuildRequest,
  type SearchExternalObjectsRequest,
  type LookupResponse,
  type BatchLookupResponse,
  type ReverseLookupResponse,
  type BatchReverseLookupResponse,
  type BuildResponse,
  type BuildListResponse,
  type StatsResponse,
  type ListExternalObjectsResponse,
  type SearchExternalObjectsResponse,
  type EmptySuccessResponse,
  type CacheClearResponse,
  // Helpers
  createExternalIndexPaginationInfo,
  parseListExternalObjectsQuery,
} from './schemas/external-index.js';
import {
  createNotFoundLookupResult,
  createEmptyReverseLookupResult,
  createEmptyIndexStats,
  createEmptyCacheStats,
  ExternalIndexErrorCodes,
  IndexBuildStatus,
  type ExternalObjectLookupResult,
  type ReverseLookupResult,
  type IndexBuildResult,
  type ExternalIndexFullStats,
} from '../types/external-object-index.js';
import { createTenantId, createScanId, createRepositoryId } from '../types/entities.js';
import {
  type IExternalObjectIndexService,
  type IndexBuildOptions,
  type ExternalReferenceType,
} from '../services/rollup/external-object-index/interfaces.js';
import { Type } from '@sinclair/typebox';

const logger = pino({ name: 'external-index-routes' });

// ============================================================================
// Error Handling
// ============================================================================

/**
 * External index specific error class
 */
class ExternalIndexError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ExternalIndexError';
  }
}

/**
 * Check if error is an external index error
 */
function isExternalIndexError(error: unknown): error is ExternalIndexError {
  return error instanceof ExternalIndexError;
}

/**
 * Map external index error codes to HTTP status codes
 */
function mapErrorCodeToStatus(code: string): number {
  const statusMap: Record<string, number> = {
    [ExternalIndexErrorCodes.EXTERNAL_OBJECT_NOT_FOUND]: 404,
    [ExternalIndexErrorCodes.NODE_NOT_FOUND]: 404,
    [ExternalIndexErrorCodes.BUILD_NOT_FOUND]: 404,
    [ExternalIndexErrorCodes.SCAN_NOT_FOUND]: 404,
    [ExternalIndexErrorCodes.REPOSITORY_NOT_FOUND]: 404,
    [ExternalIndexErrorCodes.INVALID_REFERENCE_TYPE]: 400,
    [ExternalIndexErrorCodes.INVALID_IDENTIFIER]: 400,
    [ExternalIndexErrorCodes.QUERY_TOO_BROAD]: 400,
    [ExternalIndexErrorCodes.BATCH_SIZE_EXCEEDED]: 400,
    [ExternalIndexErrorCodes.BUILD_ALREADY_RUNNING]: 409,
    [ExternalIndexErrorCodes.INDEX_LOCKED]: 409,
    [ExternalIndexErrorCodes.BUILD_CANCELLED]: 409,
    [ExternalIndexErrorCodes.RATE_LIMITED]: 429,
    [ExternalIndexErrorCodes.BUILD_FAILED]: 500,
    [ExternalIndexErrorCodes.BUILD_TIMEOUT]: 504,
    [ExternalIndexErrorCodes.INDEX_CORRUPTED]: 500,
    [ExternalIndexErrorCodes.CACHE_UNAVAILABLE]: 503,
    [ExternalIndexErrorCodes.CACHE_FULL]: 507,
  };
  return statusMap[code] ?? 500;
}

/**
 * Handle external index errors and throw appropriate HTTP errors
 */
function handleExternalIndexError(error: unknown): never {
  if (isExternalIndexError(error)) {
    const statusCode = mapErrorCodeToStatus(error.code);

    switch (statusCode) {
      case 404:
        throw new NotFoundError('External Index Resource', error.message);
      case 400:
        throw new ValidationError(error.message, error.details);
      case 409:
        throw new ConflictError(error.message, error.details);
      case 403:
        throw new ForbiddenError(error.message);
      default:
        throw error;
    }
  }
  throw error;
}

// ============================================================================
// External Index Routes Plugin
// ============================================================================

/**
 * External Index routes plugin
 * Registers all external object index API endpoints
 */
const externalIndexRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Get external index service from dependency injection
  const getExternalIndexService = (): IExternalObjectIndexService => {
    const service = (fastify as FastifyInstance & { externalIndexService?: IExternalObjectIndexService }).externalIndexService;
    if (!service) {
      logger.error('ExternalIndexService not registered');
      throw new Error('ExternalIndexService not available');
    }
    return service;
  };

  // ==========================================================================
  // GET /api/v1/external-index/lookup - Look up external object by identifier
  // ==========================================================================
  fastify.get<{
    Querystring: LookupQuery;
  }>('/lookup', {
    schema: {
      description: LookupRoute.description,
      tags: LookupRoute.tags,
      querystring: LookupQuerySchema,
      response: {
        200: LookupResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<LookupResponse> => {
    const auth = getAuthContext(request);
    const { externalId, externalType, includeNodeDetails, includeScanInfo } = request.query;

    logger.debug({ userId: auth.userId, externalId, externalType }, 'Looking up external object');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const service = getExternalIndexService();
      const result = await service.lookupByExternalId(
        createTenantId(tenantId),
        externalId,
        {
          referenceType: externalType as ExternalReferenceType | undefined,
        }
      );

      // Transform service result to API response format
      const lookupResult: ExternalObjectLookupResult = {
        found: result.totalCount > 0,
        externalId,
        externalType,
        nodeIds: result.entries.map(e => e.nodeId),
        scanIds: [...new Set(result.entries.map(e => e.scanId as string))],
        repositoryIds: [...new Set(result.entries.map(e => e.repositoryId as string))],
        referenceCount: result.totalCount,
        firstSeen: result.entries.length > 0
          ? result.entries.reduce((min, e) => e.indexedAt < min ? e.indexedAt : min, result.entries[0].indexedAt).toISOString()
          : undefined,
        lastUpdated: result.entries.length > 0
          ? result.entries.reduce((max, e) => e.indexedAt > max ? e.indexedAt : max, result.entries[0].indexedAt).toISOString()
          : undefined,
      };

      return {
        success: true,
        data: lookupResult,
      };
    } catch (error) {
      handleExternalIndexError(error);
    }
  });

  // ==========================================================================
  // POST /api/v1/external-index/lookup/batch - Batch lookup of external objects
  // ==========================================================================
  fastify.post<{
    Body: BatchLookupRequest;
  }>('/lookup/batch', {
    schema: {
      description: BatchLookupRoute.description,
      tags: BatchLookupRoute.tags,
      body: BatchLookupRequestSchema,
      response: {
        200: BatchLookupResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<BatchLookupResponse> => {
    const auth = getAuthContext(request);
    const { lookups, includeNodeDetails } = request.body;

    logger.debug({ userId: auth.userId, count: lookups.length }, 'Batch lookup of external objects');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const startTime = Date.now();

    try {
      const service = getExternalIndexService();
      const results: ExternalObjectLookupResult[] = [];
      let found = 0;
      let notFound = 0;

      // Process lookups in parallel (limited concurrency)
      await Promise.all(
        lookups.map(async ({ externalId, externalType }) => {
          const result = await service.lookupByExternalId(
            createTenantId(tenantId),
            externalId,
            { referenceType: externalType as ExternalReferenceType | undefined }
          );

          const lookupResult: ExternalObjectLookupResult = {
            found: result.totalCount > 0,
            externalId,
            externalType,
            nodeIds: result.entries.map(e => e.nodeId),
            scanIds: [...new Set(result.entries.map(e => e.scanId as string))],
            repositoryIds: [...new Set(result.entries.map(e => e.repositoryId as string))],
            referenceCount: result.totalCount,
          };

          results.push(lookupResult);

          if (result.totalCount > 0) {
            found++;
          } else {
            notFound++;
          }
        })
      );

      return {
        success: true,
        data: {
          results,
          found,
          notFound,
          processingTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      handleExternalIndexError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/external-index/scans/:scanId/nodes/:nodeId/external-objects
  // Reverse lookup: node -> external objects
  // ==========================================================================
  fastify.get<{
    Params: NodeIdParams;
    Querystring: ReverseLookupQuery;
  }>('/scans/:scanId/nodes/:nodeId/external-objects', {
    schema: {
      description: ReverseLookupRoute.description,
      tags: ReverseLookupRoute.tags,
      params: NodeIdParamsSchema,
      querystring: ReverseLookupQuerySchema,
      response: {
        200: ReverseLookupResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<ReverseLookupResponse> => {
    const auth = getAuthContext(request);
    const { scanId, nodeId } = request.params;
    const { types, minConfidence, page, pageSize } = request.query;

    logger.debug({ userId: auth.userId, scanId, nodeId }, 'Reverse lookup for node');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const service = getExternalIndexService();
      const result = await service.reverseLookup(
        createTenantId(tenantId),
        nodeId,
        createScanId(scanId)
      );

      // Transform to API response format
      const reverseLookupResult: ReverseLookupResult = {
        nodeId: result.nodeId,
        scanId,
        repositoryId: result.references[0]?.repositoryId as string || '',
        externalObjects: result.references.map(ref => ({
          externalObjectId: ref.id,
          externalId: ref.externalId,
          externalType: ref.referenceType as any,
          confidence: 0.9, // Default confidence
          attributes: ref.components,
        })),
        totalCount: result.totalCount,
        countByType: result.references.reduce((acc, ref) => {
          acc[ref.referenceType] = (acc[ref.referenceType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      return {
        success: true,
        data: reverseLookupResult,
      };
    } catch (error) {
      handleExternalIndexError(error);
    }
  });

  // ==========================================================================
  // POST /api/v1/external-index/reverse-lookup/batch - Batch reverse lookup
  // ==========================================================================
  fastify.post<{
    Body: BatchReverseLookupRequest;
  }>('/reverse-lookup/batch', {
    schema: {
      description: BatchReverseLookupRoute.description,
      tags: BatchReverseLookupRoute.tags,
      body: BatchReverseLookupRequestSchema,
      response: {
        200: BatchReverseLookupResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<BatchReverseLookupResponse> => {
    const auth = getAuthContext(request);
    const { nodes, types, minConfidence } = request.body;

    logger.debug({ userId: auth.userId, count: nodes.length }, 'Batch reverse lookup');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const startTime = Date.now();

    try {
      const service = getExternalIndexService();
      const results: ReverseLookupResult[] = [];
      let nodesWithReferences = 0;

      await Promise.all(
        nodes.map(async ({ scanId, nodeId }) => {
          const result = await service.reverseLookup(
            createTenantId(tenantId),
            nodeId,
            createScanId(scanId)
          );

          const reverseLookupResult: ReverseLookupResult = {
            nodeId: result.nodeId,
            scanId,
            repositoryId: result.references[0]?.repositoryId as string || '',
            externalObjects: result.references.map(ref => ({
              externalObjectId: ref.id,
              externalId: ref.externalId,
              externalType: ref.referenceType as any,
              confidence: 0.9,
              attributes: ref.components,
            })),
            totalCount: result.totalCount,
            countByType: result.references.reduce((acc, ref) => {
              acc[ref.referenceType] = (acc[ref.referenceType] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          };

          results.push(reverseLookupResult);

          if (result.totalCount > 0) {
            nodesWithReferences++;
          }
        })
      );

      return {
        success: true,
        data: {
          results,
          totalNodesQueried: nodes.length,
          nodesWithReferences,
          processingTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      handleExternalIndexError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/external-index/objects - List external objects
  // ==========================================================================
  fastify.get<{
    Querystring: ListExternalObjectsQuery;
  }>('/objects', {
    schema: {
      description: ListExternalObjectsRoute.description,
      tags: ListExternalObjectsRoute.tags,
      querystring: ListExternalObjectsQuerySchema,
      response: {
        200: ListExternalObjectsResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<ListExternalObjectsResponse> => {
    const auth = getAuthContext(request);
    const query = parseListExternalObjectsQuery(request.query);

    logger.debug({ userId: auth.userId, query }, 'Listing external objects');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Implement actual list from service
    // For now, return empty response
    return {
      success: true,
      data: [],
      pagination: createExternalIndexPaginationInfo(
        query.page ?? 1,
        query.pageSize ?? 20,
        0
      ),
    };
  });

  // ==========================================================================
  // POST /api/v1/external-index/search - Search external objects
  // ==========================================================================
  fastify.post<{
    Body: SearchExternalObjectsRequest;
  }>('/search', {
    schema: {
      description: SearchExternalObjectsRoute.description,
      tags: SearchExternalObjectsRoute.tags,
      body: SearchExternalObjectsRequestSchema,
      response: {
        200: SearchExternalObjectsResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<SearchExternalObjectsResponse> => {
    const auth = getAuthContext(request);
    const { query, filters, page, pageSize, sortBy, sortOrder } = request.body;

    logger.debug({ userId: auth.userId, query }, 'Searching external objects');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const startTime = Date.now();

    // TODO: Implement actual search from service
    // For now, return empty response
    return {
      success: true,
      data: {
        results: [],
        totalMatches: 0,
        processingTimeMs: Date.now() - startTime,
      },
      pagination: createExternalIndexPaginationInfo(
        page ?? 1,
        pageSize ?? 20,
        0
      ),
    };
  });

  // ==========================================================================
  // GET /api/v1/external-index/objects/:externalObjectId - Get external object details
  // ==========================================================================
  fastify.get<{
    Params: ExternalObjectIdParams;
  }>('/objects/:externalObjectId', {
    schema: {
      description: GetExternalObjectRoute.description,
      tags: GetExternalObjectRoute.tags,
      params: ExternalObjectIdParamsSchema,
      response: {
        200: LookupResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<LookupResponse> => {
    const auth = getAuthContext(request);
    const { externalObjectId } = request.params;

    logger.debug({ userId: auth.userId, externalObjectId }, 'Getting external object details');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Implement lookup by ID from service
    throw new NotFoundError('External Object', externalObjectId);
  });

  // ==========================================================================
  // POST /api/v1/external-index/build - Trigger index build
  // ==========================================================================
  fastify.post<{
    Body: BuildIndexRequest;
  }>('/build', {
    schema: {
      description: BuildIndexRoute.description,
      tags: BuildIndexRoute.tags,
      body: BuildIndexRequestSchema,
      response: {
        200: BuildResponseSchema,
        202: BuildResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<BuildResponse> => {
    const auth = getAuthContext(request);
    const {
      scanIds,
      repositoryIds,
      forceFullRebuild,
      includeTypes,
      excludeTypes,
      minConfidence,
      async: isAsync,
      callbackUrl,
      options,
    } = request.body;

    logger.info({ userId: auth.userId, async: isAsync, repositoryIds }, 'Triggering index build');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const service = getExternalIndexService();

      // Build options
      const buildOptions: IndexBuildOptions = {
        forceRebuild: forceFullRebuild,
        referenceTypes: includeTypes as ExternalReferenceType[] | undefined,
        batchSize: options?.batchSize,
      };

      // Create repository IDs
      const repoIds = repositoryIds?.map(id => createRepositoryId(id)) ?? [];

      // Execute build
      const result = await service.buildIndex(
        createTenantId(tenantId),
        repoIds,
        buildOptions
      );

      // Transform to API response
      const buildResult: IndexBuildResult = {
        buildId: crypto.randomUUID(),
        tenantId,
        status: 'completed' as const,
        nodesProcessed: 0,
        referencesExtracted: result.entriesCreated + result.entriesUpdated,
        uniqueObjectsIndexed: result.entriesCreated,
        scansProcessed: result.processedScans.length,
        duration: result.buildTimeMs,
        errors: [],
        warnings: [],
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      if (isAsync) {
        reply.status(202);
        buildResult.status = 'running';
        buildResult.completedAt = undefined;
      }

      logger.info({ buildId: buildResult.buildId, entriesCreated: result.entriesCreated }, 'Index build completed');

      return {
        success: true,
        data: buildResult,
      };
    } catch (error) {
      handleExternalIndexError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/external-index/builds - List build operations
  // ==========================================================================
  fastify.get<{
    Querystring: { page?: number; pageSize?: number; status?: string };
  }>('/builds', {
    schema: {
      description: ListBuildsRoute.description,
      tags: ListBuildsRoute.tags,
      querystring: Type.Object({
        page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
        pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 50, default: 10 })),
        status: Type.Optional(Type.String()),
      }),
      response: {
        200: BuildListResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<BuildListResponse> => {
    const auth = getAuthContext(request);
    const { page = 1, pageSize = 10, status } = request.query;

    logger.debug({ userId: auth.userId, page, pageSize, status }, 'Listing index builds');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Implement actual list from service
    return {
      success: true,
      data: [],
      pagination: createExternalIndexPaginationInfo(page, pageSize, 0),
    };
  });

  // ==========================================================================
  // GET /api/v1/external-index/builds/:buildId - Get build status
  // ==========================================================================
  fastify.get<{
    Params: BuildIdParams;
  }>('/builds/:buildId', {
    schema: {
      description: GetBuildStatusRoute.description,
      tags: GetBuildStatusRoute.tags,
      params: BuildIdParamsSchema,
      response: {
        200: BuildResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<BuildResponse> => {
    const auth = getAuthContext(request);
    const { buildId } = request.params;

    logger.debug({ userId: auth.userId, buildId }, 'Getting build status');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Implement actual lookup from service
    throw new NotFoundError('Build', buildId);
  });

  // ==========================================================================
  // POST /api/v1/external-index/builds/:buildId/cancel - Cancel a running build
  // ==========================================================================
  fastify.post<{
    Params: BuildIdParams;
    Body: CancelBuildRequest;
  }>('/builds/:buildId/cancel', {
    schema: {
      description: CancelBuildRoute.description,
      tags: CancelBuildRoute.tags,
      params: BuildIdParamsSchema,
      body: CancelBuildRequestSchema,
      response: {
        200: BuildResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<BuildResponse> => {
    const auth = getAuthContext(request);
    const { buildId } = request.params;
    const { reason } = request.body || {};

    logger.info({ userId: auth.userId, buildId, reason }, 'Cancelling index build');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Implement actual cancel from service
    throw new NotFoundError('Build', buildId);
  });

  // ==========================================================================
  // GET /api/v1/external-index/stats - Get index statistics
  // ==========================================================================
  fastify.get('/stats', {
    schema: {
      description: GetStatsRoute.description,
      tags: GetStatsRoute.tags,
      response: {
        200: StatsResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<StatsResponse> => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting index statistics');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const service = getExternalIndexService();
      const stats = await service.getStats(createTenantId(tenantId));

      // Transform to full stats response
      const fullStats: ExternalIndexFullStats = {
        tenantId,
        generatedAt: new Date().toISOString(),
        index: {
          totalExternalObjects: stats.totalEntries,
          totalIndexedNodes: stats.totalEntries,
          totalReferences: stats.totalEntries,
          indexSizeBytes: 0,
          lastBuildAt: stats.lastBuildAt?.toISOString() ?? null,
          scansIndexed: 0,
          externalTypes: stats.entriesByType as Record<string, number>,
          byProvider: {},
          avgReferencesPerNode: stats.avgLookupTimeMs > 0 ? 1 : 0,
          healthStatus: 'healthy',
        },
        cache: {
          l1Hits: 0,
          l1Misses: 0,
          l1Size: 0,
          l1MaxSize: 10000,
          l2Hits: 0,
          l2Misses: 0,
          hitRate: stats.cacheHitRatio,
          l1HitRate: 0,
          l2HitRate: 0,
          avgLookupLatencyMs: stats.avgLookupTimeMs,
          memorySizeBytes: 0,
          evictionCount: 0,
        },
      };

      return {
        success: true,
        data: fullStats,
      };
    } catch (error) {
      handleExternalIndexError(error);
    }
  });

  // ==========================================================================
  // POST /api/v1/external-index/cache/clear - Clear the index cache
  // ==========================================================================
  fastify.post('/cache/clear', {
    schema: {
      description: ClearCacheRoute.description,
      tags: ClearCacheRoute.tags,
      response: {
        200: CacheClearResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<CacheClearResponse> => {
    const auth = getAuthContext(request);

    logger.info({ userId: auth.userId }, 'Clearing index cache');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const service = getExternalIndexService();

      // Get stats before clearing
      const statsBefore = await service.getStats(createTenantId(tenantId));

      // Invalidate the cache
      await service.invalidate(createTenantId(tenantId), {});

      logger.info({ tenantId }, 'Index cache cleared');

      return {
        success: true,
        data: {
          entriesCleared: statsBefore.totalEntries,
          previousHitRate: statsBefore.cacheHitRatio,
        },
      };
    } catch (error) {
      handleExternalIndexError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/external-index/health - Health check for the index
  // ==========================================================================
  fastify.get('/health', {
    schema: {
      description: IndexHealthRoute.description,
      tags: IndexHealthRoute.tags,
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          data: Type.Object({
            status: Type.Union([
              Type.Literal('healthy'),
              Type.Literal('degraded'),
              Type.Literal('unhealthy'),
            ]),
            indexReady: Type.Boolean(),
            cacheReady: Type.Boolean(),
            lastBuildStatus: Type.Optional(Type.String()),
            lastBuildAt: Type.Optional(Type.String({ format: 'date-time' })),
            issues: Type.Array(Type.String()),
          }),
        }),
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Checking index health');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const service = getExternalIndexService();
      const stats = await service.getStats(createTenantId(tenantId));

      const issues: string[] = [];
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check cache hit ratio
      if (stats.cacheHitRatio < 0.5) {
        issues.push('Low cache hit ratio');
        status = 'degraded';
      }

      // Check if index has been built
      if (!stats.lastBuildAt) {
        issues.push('Index has never been built');
        status = 'degraded';
      }

      // Check average lookup time
      if (stats.avgLookupTimeMs > 500) {
        issues.push('High average lookup latency');
        status = 'degraded';
      }

      return {
        success: true as const,
        data: {
          status,
          indexReady: stats.totalEntries > 0 || stats.lastBuildAt !== null,
          cacheReady: true,
          lastBuildStatus: stats.lastBuildAt ? 'completed' : undefined,
          lastBuildAt: stats.lastBuildAt?.toISOString(),
          issues,
        },
      };
    } catch (error) {
      return {
        success: true as const,
        data: {
          status: 'unhealthy' as const,
          indexReady: false,
          cacheReady: false,
          issues: ['Service unavailable: ' + (error as Error).message],
        },
      };
    }
  });

  logger.info('External Index routes registered');
};

export default externalIndexRoutes;

// Export for testing
export { externalIndexRoutes };

// ============================================================================
// Type Declarations
// ============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    externalIndexService?: IExternalObjectIndexService;
  }
}
