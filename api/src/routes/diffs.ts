/**
 * Graph Diff Routes
 * @module routes/diffs
 *
 * REST API endpoints for Graph Diff Computation operations.
 * Enables computing structural differences between graph snapshots
 * for incremental rollup execution and change detection.
 *
 * TASK-ROLLUP-005: Graph Diff Computation API endpoints
 *
 * Endpoints:
 * - POST /api/v1/diffs - Compute or retrieve a graph diff
 * - GET /api/v1/diffs - List diffs with filtering
 * - GET /api/v1/diffs/:diffId - Get diff by ID
 * - DELETE /api/v1/diffs/:diffId - Delete a diff result
 * - POST /api/v1/diffs/estimate - Estimate diff computation cost
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../middleware/error-handler.js';
import { ErrorResponseSchema, PaginationInfoSchema } from './schemas/common.js';
import { createTenantId, createScanId } from '../types/entities.js';
import type {
  IGraphDiffService,
  GraphDiffRequest,
  DiffListItem,
} from '../services/rollup/graph-diff/graph-diff-service.js';
import {
  GraphDiffResult,
  DiffComputationOptions,
  GraphDiffError,
  GraphDiffErrorCodes,
  createGraphDiffId,
} from '../services/rollup/graph-diff/interfaces.js';

const logger = pino({ name: 'diff-routes' });

// ============================================================================
// TypeBox Schemas
// ============================================================================

/**
 * Diff computation options schema
 */
const DiffComputationOptionsSchema = Type.Object({
  includeUnchanged: Type.Optional(
    Type.Boolean({
      description: 'Include unchanged nodes/edges in result (default: false)',
    })
  ),
  includeAttributeChanges: Type.Optional(
    Type.Boolean({
      description: 'Include detailed attribute changes (default: true)',
    })
  ),
  significantChangeThreshold: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 1,
      description: 'Threshold for significant change detection (0-1, default: 0.1)',
    })
  ),
  includeNodeTypes: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Node types to include in diff (default: all)',
    })
  ),
  excludeNodeTypes: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Node types to exclude from diff',
    })
  ),
  includeEdgeTypes: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Edge types to include in diff (default: all)',
    })
  ),
  excludeEdgeTypes: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Edge types to exclude from diff',
    })
  ),
  maxNodes: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 1000000,
      description: 'Maximum nodes to process (for performance limits)',
    })
  ),
  maxEdges: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 5000000,
      description: 'Maximum edges to process (for performance limits)',
    })
  ),
  enableParallelProcessing: Type.Optional(
    Type.Boolean({
      description: 'Enable parallel processing (default: true)',
    })
  ),
  batchSize: Type.Optional(
    Type.Number({
      minimum: 100,
      maximum: 10000,
      description: 'Batch size for parallel processing',
    })
  ),
  timeoutMs: Type.Optional(
    Type.Number({
      minimum: 1000,
      maximum: 300000,
      description: 'Timeout in milliseconds',
    })
  ),
  enableCaching: Type.Optional(
    Type.Boolean({
      description: 'Enable caching of intermediate results',
    })
  ),
  cacheTtlSeconds: Type.Optional(
    Type.Number({
      minimum: 60,
      maximum: 86400,
      description: 'Cache TTL in seconds',
    })
  ),
});

// DiffComputationOptionsInput type derived from schema (for request validation)
export type DiffComputationOptionsInput = Static<typeof DiffComputationOptionsSchema>;

/**
 * Create diff request body schema
 */
const CreateDiffRequestSchema = Type.Object({
  baseScanId: Type.String({
    format: 'uuid',
    description: 'UUID of the base (older) scan',
  }),
  compareScanId: Type.String({
    format: 'uuid',
    description: 'UUID of the comparison (newer) scan',
  }),
  repositoryId: Type.Optional(
    Type.String({
      format: 'uuid',
      description: 'Optional repository ID filter',
    })
  ),
  options: Type.Optional(DiffComputationOptionsSchema),
  forceRecompute: Type.Optional(
    Type.Boolean({
      description: 'Force recomputation bypassing cache (default: false)',
    })
  ),
  async: Type.Optional(
    Type.Boolean({
      description: 'Run computation asynchronously (default: false)',
    })
  ),
});

type CreateDiffRequest = Static<typeof CreateDiffRequestSchema>;

/**
 * Diff ID path parameter schema
 */
const DiffIdParamsSchema = Type.Object({
  diffId: Type.String({
    description: 'Diff identifier',
  }),
});

type DiffIdParams = Static<typeof DiffIdParamsSchema>;

/**
 * Diff list query parameters schema
 */
const DiffListQuerySchema = Type.Object({
  page: Type.Optional(
    Type.Number({
      minimum: 1,
      default: 1,
      description: 'Page number',
    })
  ),
  pageSize: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Items per page',
    })
  ),
  scanId: Type.Optional(
    Type.String({
      format: 'uuid',
      description: 'Filter by scan ID (base or target)',
    })
  ),
  repositoryId: Type.Optional(
    Type.String({
      format: 'uuid',
      description: 'Filter by repository ID',
    })
  ),
  status: Type.Optional(
    Type.Union([
      Type.Literal('pending'),
      Type.Literal('computing'),
      Type.Literal('completed'),
      Type.Literal('failed'),
    ], {
      description: 'Filter by computation status',
    })
  ),
  sortBy: Type.Optional(
    Type.Union([
      Type.Literal('computedAt'),
      Type.Literal('baseSnapshotId'),
      Type.Literal('targetSnapshotId'),
    ], {
      default: 'computedAt',
      description: 'Sort field',
    })
  ),
  sortOrder: Type.Optional(
    Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
      default: 'desc',
      description: 'Sort order',
    })
  ),
  computedAfter: Type.Optional(
    Type.String({
      format: 'date-time',
      description: 'Filter diffs computed after this date',
    })
  ),
  computedBefore: Type.Optional(
    Type.String({
      format: 'date-time',
      description: 'Filter diffs computed before this date',
    })
  ),
});

type DiffListQuery = Static<typeof DiffListQuerySchema>;

/**
 * Estimate cost request body schema
 */
const EstimateCostRequestSchema = Type.Object({
  baseScanId: Type.String({
    format: 'uuid',
    description: 'UUID of the base scan',
  }),
  compareScanId: Type.String({
    format: 'uuid',
    description: 'UUID of the comparison scan',
  }),
});

type EstimateCostRequest = Static<typeof EstimateCostRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Change breakdown by type schema
 */
const ChangeBreakdownSchema = Type.Object({
  added: Type.Number(),
  removed: Type.Number(),
  modified: Type.Number(),
});

/**
 * Diff summary schema
 */
const DiffSummarySchema = Type.Object({
  baseNodeCount: Type.Number({ description: 'Total nodes in base snapshot' }),
  targetNodeCount: Type.Number({ description: 'Total nodes in target snapshot' }),
  nodesAdded: Type.Number({ description: 'Number of nodes added' }),
  nodesRemoved: Type.Number({ description: 'Number of nodes removed' }),
  nodesModified: Type.Number({ description: 'Number of nodes modified' }),
  nodesUnchanged: Type.Number({ description: 'Number of nodes unchanged' }),
  baseEdgeCount: Type.Number({ description: 'Total edges in base snapshot' }),
  targetEdgeCount: Type.Number({ description: 'Total edges in target snapshot' }),
  edgesAdded: Type.Number({ description: 'Number of edges added' }),
  edgesRemoved: Type.Number({ description: 'Number of edges removed' }),
  edgesModified: Type.Number({ description: 'Number of edges modified' }),
  edgesUnchanged: Type.Number({ description: 'Number of edges unchanged' }),
  nodeChangeRatio: Type.Number({ description: 'Node change ratio (0-1)' }),
  edgeChangeRatio: Type.Number({ description: 'Edge change ratio (0-1)' }),
  overallChangeRatio: Type.Number({ description: 'Overall change ratio (0-1)' }),
  isSignificantChange: Type.Boolean({ description: 'Whether this is a significant change' }),
  changesByNodeType: Type.Record(Type.String(), ChangeBreakdownSchema, {
    description: 'Change breakdown by node type',
  }),
  changesByEdgeType: Type.Record(Type.String(), ChangeBreakdownSchema, {
    description: 'Change breakdown by edge type',
  }),
});

/**
 * Diff timing schema
 */
const DiffTimingSchema = Type.Object({
  totalMs: Type.Number({ description: 'Total computation time in milliseconds' }),
  nodeIdentityExtractionMs: Type.Number({ description: 'Time for node identity extraction' }),
  nodeComparisonMs: Type.Number({ description: 'Time for node comparison' }),
  edgeIdentityExtractionMs: Type.Number({ description: 'Time for edge identity extraction' }),
  edgeComparisonMs: Type.Number({ description: 'Time for edge comparison' }),
  summaryComputationMs: Type.Number({ description: 'Time for summary computation' }),
  nodesPerSecond: Type.Number({ description: 'Nodes processed per second' }),
  edgesPerSecond: Type.Number({ description: 'Edges processed per second' }),
});

/**
 * Attribute change schema
 */
const AttributeChangeSchema = Type.Object({
  path: Type.String({ description: 'Path to the changed attribute' }),
  previousValue: Type.Optional(Type.Unknown({ description: 'Previous value' })),
  newValue: Type.Optional(Type.Unknown({ description: 'New value' })),
  changeType: Type.Union([
    Type.Literal('added'),
    Type.Literal('removed'),
    Type.Literal('modified'),
  ]),
});

/**
 * Node identity schema
 */
const NodeIdentitySchema = Type.Object({
  key: Type.String({ description: 'Unique identity key' }),
  nodeId: Type.String({ description: 'Original node ID' }),
  nodeType: Type.String({ description: 'Node type' }),
  name: Type.String({ description: 'Node name' }),
  namespace: Type.Optional(Type.String({ description: 'Namespace (for K8s resources)' })),
  repositoryId: Type.Optional(Type.String({ description: 'Repository ID' })),
  identityHash: Type.String({ description: 'Hash of identity attributes' }),
});

/**
 * Node diff schema
 */
const NodeDiffSchema = Type.Object({
  changeType: Type.Union([
    Type.Literal('added'),
    Type.Literal('removed'),
    Type.Literal('modified'),
    Type.Literal('unchanged'),
  ]),
  identity: NodeIdentitySchema,
  attributeChanges: Type.Optional(Type.Array(AttributeChangeSchema)),
});

/**
 * Node diff set schema
 */
const NodeDiffSetSchema = Type.Object({
  added: Type.Array(NodeDiffSchema),
  removed: Type.Array(NodeDiffSchema),
  modified: Type.Array(NodeDiffSchema),
  unchanged: Type.Optional(Type.Array(NodeDiffSchema)),
  baseNodeCount: Type.Number(),
  targetNodeCount: Type.Number(),
});

/**
 * Edge identity schema
 */
const EdgeIdentitySchema = Type.Object({
  key: Type.String({ description: 'Unique identity key' }),
  edgeId: Type.String({ description: 'Original edge ID' }),
  edgeType: Type.String({ description: 'Edge type' }),
  identityHash: Type.String({ description: 'Hash of identity attributes' }),
});

/**
 * Edge diff schema
 */
const EdgeDiffSchema = Type.Object({
  changeType: Type.Union([
    Type.Literal('added'),
    Type.Literal('removed'),
    Type.Literal('modified'),
    Type.Literal('unchanged'),
  ]),
  identity: EdgeIdentitySchema,
  attributeChanges: Type.Optional(Type.Array(AttributeChangeSchema)),
});

/**
 * Edge diff set schema
 */
const EdgeDiffSetSchema = Type.Object({
  added: Type.Array(EdgeDiffSchema),
  removed: Type.Array(EdgeDiffSchema),
  modified: Type.Array(EdgeDiffSchema),
  unchanged: Type.Optional(Type.Array(EdgeDiffSchema)),
  baseEdgeCount: Type.Number(),
  targetEdgeCount: Type.Number(),
});

/**
 * Full diff result schema
 */
const GraphDiffResultSchema = Type.Object({
  id: Type.String({ description: 'Unique diff identifier' }),
  tenantId: Type.String({ description: 'Tenant ID' }),
  baseSnapshotId: Type.String({ description: 'Base snapshot identifier' }),
  targetSnapshotId: Type.String({ description: 'Target snapshot identifier' }),
  rollupId: Type.Optional(Type.String({ description: 'Associated rollup ID' })),
  executionId: Type.Optional(Type.String({ description: 'Associated execution ID' })),
  nodeDiffs: NodeDiffSetSchema,
  edgeDiffs: EdgeDiffSetSchema,
  summary: DiffSummarySchema,
  timing: DiffTimingSchema,
  computedAt: Type.String({ format: 'date-time', description: 'When the diff was computed' }),
});

/**
 * Cache info schema
 */
const CacheInfoSchema = Type.Object({
  cachedAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.String({ format: 'date-time' }),
  accessCount: Type.Number(),
});

/**
 * Request metadata schema
 */
const RequestMetadataSchema = Type.Object({
  requestedAt: Type.String({ format: 'date-time' }),
  processingTimeMs: Type.Number(),
  phases: Type.Array(Type.String()),
});

/**
 * Single diff response schema
 */
const DiffSingleResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: GraphDiffResultSchema,
  fromCache: Type.Boolean({ description: 'Whether result was from cache' }),
  cacheInfo: Type.Optional(CacheInfoSchema),
  metadata: RequestMetadataSchema,
});

type DiffSingleResponse = Static<typeof DiffSingleResponseSchema>;

/**
 * Diff list item schema (lightweight)
 */
const DiffListItemSchema = Type.Object({
  id: Type.String({ description: 'Diff identifier' }),
  baseSnapshotId: Type.String({ description: 'Base snapshot identifier' }),
  targetSnapshotId: Type.String({ description: 'Target snapshot identifier' }),
  summary: DiffSummarySchema,
  computedAt: Type.String({ format: 'date-time' }),
  computationTimeMs: Type.Number({ description: 'Computation time in milliseconds' }),
});

/**
 * Diff list response schema
 */
const DiffListResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Array(DiffListItemSchema),
  pagination: PaginationInfoSchema,
});

type DiffListResponse = Static<typeof DiffListResponseSchema>;

/**
 * Cost estimate response schema
 */
const CostEstimateResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    estimatedTimeMs: Type.Number({ description: 'Estimated computation time in milliseconds' }),
    estimatedMemoryBytes: Type.Number({ description: 'Estimated memory usage in bytes' }),
    totalNodes: Type.Number({ description: 'Total nodes to process' }),
    totalEdges: Type.Number({ description: 'Total edges to process' }),
    withinLimits: Type.Boolean({ description: 'Whether computation is within limits' }),
    warnings: Type.Array(Type.String(), { description: 'Warning messages' }),
  }),
});

type CostEstimateResponse = Static<typeof CostEstimateResponseSchema>;

/**
 * Empty success response schema - used for 204 No Content responses
 */
export const EmptySuccessResponseSchema = Type.Object({
  success: Type.Literal(true),
  message: Type.Optional(Type.String()),
});

/**
 * Async computation accepted response schema
 */
const AsyncAcceptedResponseSchema = Type.Object({
  success: Type.Literal(true),
  message: Type.String({ description: 'Status message' }),
  diffId: Type.String({ description: 'Diff ID for polling' }),
  estimatedTimeMs: Type.Optional(Type.Number({ description: 'Estimated completion time' })),
});

type AsyncAcceptedResponse = Static<typeof AsyncAcceptedResponseSchema>;

// ============================================================================
// Route Configuration
// ============================================================================

/**
 * Rate limiting configuration for diff endpoints
 */
export const RATE_LIMITS = {
  create: { max: 10, timeWindow: '1 minute' },
  list: { max: 100, timeWindow: '1 minute' },
  read: { max: 200, timeWindow: '1 minute' },
  delete: { max: 10, timeWindow: '1 minute' },
  estimate: { max: 50, timeWindow: '1 minute' },
} as const;

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map graph diff errors to HTTP status codes
 */
function mapDiffErrorToStatusCode(error: GraphDiffError): number {
  switch (error.code) {
    case GraphDiffErrorCodes.SNAPSHOT_NOT_FOUND:
      return 404;
    case GraphDiffErrorCodes.INVALID_SNAPSHOT:
    case GraphDiffErrorCodes.INVALID_CONFIG:
      return 400;
    case GraphDiffErrorCodes.INCOMPATIBLE_SNAPSHOTS:
    case GraphDiffErrorCodes.TENANT_MISMATCH:
      return 422;
    case GraphDiffErrorCodes.TIMEOUT:
      return 408;
    case GraphDiffErrorCodes.MAX_NODES_EXCEEDED:
    case GraphDiffErrorCodes.MAX_EDGES_EXCEEDED:
      return 413;
    case GraphDiffErrorCodes.NOT_INITIALIZED:
      return 503;
    default:
      return 500;
  }
}

/**
 * Check if error is a GraphDiffError
 */
function isGraphDiffError(error: unknown): error is GraphDiffError {
  return error instanceof GraphDiffError;
}

/**
 * Handle errors and throw appropriate HTTP errors
 */
function handleDiffError(error: unknown): never {
  if (isGraphDiffError(error)) {
    const statusCode = mapDiffErrorToStatusCode(error);

    switch (statusCode) {
      case 404:
        throw new NotFoundError('Snapshot', error.context?.snapshotId as string || 'unknown');
      case 400:
      case 422:
        throw new ValidationError(error.message, error.context);
      case 408:
        throw new ConflictError(`Computation timeout: ${error.message}`);
      case 413:
        throw new ValidationError(`Limit exceeded: ${error.message}`, error.context);
      case 503:
        throw new Error('Service not initialized');
      default:
        throw error;
    }
  }
  throw error;
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * POST /diffs - Compute or retrieve a graph diff
 */
const CreateDiffRoute = {
  description: 'Compute or retrieve a graph diff between two scans',
  tags: ['Diffs'],
  body: CreateDiffRequestSchema,
  response: {
    201: DiffSingleResponseSchema,
    202: AsyncAcceptedResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    404: ErrorResponseSchema,
    408: ErrorResponseSchema,
    413: ErrorResponseSchema,
    422: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /diffs - List diffs
 */
const ListDiffsRoute = {
  description: 'List graph diffs with filtering and pagination',
  tags: ['Diffs'],
  querystring: DiffListQuerySchema,
  response: {
    200: DiffListResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /diffs/:diffId - Get diff by ID
 */
const GetDiffRoute = {
  description: 'Get a graph diff by ID',
  tags: ['Diffs'],
  params: DiffIdParamsSchema,
  response: {
    200: DiffSingleResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * DELETE /diffs/:diffId - Delete a diff
 */
const DeleteDiffRoute = {
  description: 'Delete a graph diff result',
  tags: ['Diffs'],
  params: DiffIdParamsSchema,
  response: {
    204: Type.Null(),
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /diffs/estimate - Estimate computation cost
 */
const EstimateCostRoute = {
  description: 'Estimate the cost of computing a graph diff',
  tags: ['Diffs'],
  body: EstimateCostRequestSchema,
  response: {
    200: CostEstimateResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

// ============================================================================
// Diff Routes Plugin
// ============================================================================

/**
 * Diff routes plugin
 * Registers all diff-related API endpoints
 */
const diffRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Get diff service from dependency injection
  const getDiffService = (): IGraphDiffService => {
    const service = (fastify as FastifyInstance & { graphDiffService?: IGraphDiffService }).graphDiffService;
    if (!service) {
      logger.error('GraphDiffService not registered');
      throw new Error('GraphDiffService not available');
    }
    return service;
  };

  // ==========================================================================
  // POST /api/v1/diffs - Compute or retrieve a graph diff
  // ==========================================================================
  fastify.post<{
    Body: CreateDiffRequest;
  }>('/', {
    schema: {
      description: CreateDiffRoute.description,
      tags: CreateDiffRoute.tags,
      body: CreateDiffRequestSchema,
      response: CreateDiffRoute.response,
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<DiffSingleResponse | AsyncAcceptedResponse> => {
    const auth = getAuthContext(request);
    const body = request.body;

    logger.info(
      {
        userId: auth.userId,
        baseScanId: body.baseScanId,
        compareScanId: body.compareScanId,
      },
      'Creating graph diff'
    );

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const diffService = getDiffService();

      // Build request for the service
      const diffRequest = {
        tenantId: createTenantId(tenantId),
        baseScanId: createScanId(body.baseScanId),
        targetScanId: createScanId(body.compareScanId),
        ...(body.repositoryId && { repositoryId: createTenantId(body.repositoryId) as any }),
        ...(body.options && { options: body.options as DiffComputationOptions }),
        ...(body.forceRecompute !== undefined && { forceRecompute: body.forceRecompute }),
      } as GraphDiffRequest;

      // Handle async computation request
      if (body.async) {
        // In async mode, we would queue the computation and return immediately
        // For now, we estimate the cost and return a placeholder response
        const estimate = await diffService.estimateDiffCost(
          createTenantId(tenantId),
          createScanId(body.baseScanId),
          createScanId(body.compareScanId)
        );

        reply.status(202);
        return {
          success: true,
          message: 'Diff computation queued for asynchronous processing',
          diffId: `async-${Date.now()}`,
          estimatedTimeMs: estimate.estimatedTimeMs,
        };
      }

      // Synchronous computation
      const response = await diffService.getDiff(diffRequest);

      logger.info(
        {
          diffId: response.diff.id,
          tenantId,
          fromCache: response.fromCache,
          processingTimeMs: response.metadata.processingTimeMs,
        },
        'Graph diff computation completed'
      );

      reply.status(response.fromCache ? 200 : 201);

      // Transform response to match schema
      // Build cacheInfo only if present (exactOptionalPropertyTypes compliance)
      const cacheInfo = response.cacheInfo
        ? {
            cachedAt: response.cacheInfo.cachedAt.toISOString(),
            expiresAt: response.cacheInfo.expiresAt.toISOString(),
            accessCount: response.cacheInfo.accessCount,
          }
        : undefined;

      const result = {
        success: true as const,
        data: transformDiffResult(response.diff),
        fromCache: response.fromCache,
        ...(cacheInfo !== undefined && { cacheInfo }),
        metadata: {
          requestedAt: response.metadata.requestedAt.toISOString(),
          processingTimeMs: response.metadata.processingTimeMs,
          phases: response.metadata.phases,
        },
      } satisfies DiffSingleResponse;

      return result;
    } catch (error) {
      handleDiffError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/diffs - List diffs
  // ==========================================================================
  fastify.get<{
    Querystring: DiffListQuery;
  }>('/', {
    schema: {
      description: ListDiffsRoute.description,
      tags: ListDiffsRoute.tags,
      querystring: DiffListQuerySchema,
      response: ListDiffsRoute.response,
    },
    preHandler: [requireAuth],
  }, async (request): Promise<DiffListResponse> => {
    const auth = getAuthContext(request);
    const query = request.query;

    logger.debug({ userId: auth.userId, query }, 'Listing graph diffs');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const diffService = getDiffService();

      // Use repository ID filter if provided, otherwise list all
      const repositoryId = query.repositoryId;

      if (!repositoryId) {
        // Return empty list if no repository filter
        // In a full implementation, we would have a method to list all diffs
        return {
          success: true,
          data: [],
          pagination: {
            page: query.page ?? 1,
            pageSize: query.pageSize ?? 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        };
      }

      const listOptions = {
        ...(query.page !== undefined && { page: query.page }),
        ...(query.pageSize !== undefined && { pageSize: query.pageSize }),
        ...(query.sortBy !== undefined && { sortBy: query.sortBy }),
        ...(query.sortOrder !== undefined && { sortDirection: query.sortOrder }),
        ...(query.computedAfter && { computedAfter: new Date(query.computedAfter) }),
        ...(query.computedBefore && { computedBefore: new Date(query.computedBefore) }),
      };

      const result = await diffService.listDiffsForRepository(
        createTenantId(tenantId),
        createTenantId(repositoryId) as any,
        listOptions
      );

      return {
        success: true,
        data: result.diffs.map(transformDiffListItem),
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious,
        },
      };
    } catch (error) {
      handleDiffError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/diffs/:diffId - Get diff by ID
  // ==========================================================================
  fastify.get<{
    Params: DiffIdParams;
  }>('/:diffId', {
    schema: {
      description: GetDiffRoute.description,
      tags: GetDiffRoute.tags,
      params: DiffIdParamsSchema,
      response: GetDiffRoute.response,
    },
    preHandler: [requireAuth],
  }, async (request): Promise<DiffSingleResponse> => {
    const auth = getAuthContext(request);
    const { diffId } = request.params;

    logger.debug({ diffId, userId: auth.userId }, 'Getting graph diff');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      // Get the diff service to verify it's available
      getDiffService();

      // TODO: Implement getDiffById method on the service
      // For now, getting a diff by ID is not directly supported
      // The service would need to expose getCachedDiff from the engine
      // For now, we throw not found to indicate this endpoint needs implementation
      throw new NotFoundError('Diff', diffId);
    } catch (error) {
      handleDiffError(error);
    }
  });

  // ==========================================================================
  // DELETE /api/v1/diffs/:diffId - Delete a diff
  // ==========================================================================
  fastify.delete<{
    Params: DiffIdParams;
  }>('/:diffId', {
    schema: {
      description: DeleteDiffRoute.description,
      tags: DeleteDiffRoute.tags,
      params: DiffIdParamsSchema,
      response: DeleteDiffRoute.response,
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { diffId } = request.params;

    logger.info({ diffId, userId: auth.userId }, 'Deleting graph diff');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const diffService = getDiffService();
      const deleted = await diffService.deleteDiff(
        createTenantId(tenantId),
        createGraphDiffId(diffId)
      );

      if (!deleted) {
        throw new NotFoundError('Diff', diffId);
      }

      logger.info({ diffId }, 'Graph diff deleted');

      reply.status(204);
      return;
    } catch (error) {
      handleDiffError(error);
    }
  });

  // ==========================================================================
  // POST /api/v1/diffs/estimate - Estimate computation cost
  // ==========================================================================
  fastify.post<{
    Body: EstimateCostRequest;
  }>('/estimate', {
    schema: {
      description: EstimateCostRoute.description,
      tags: EstimateCostRoute.tags,
      body: EstimateCostRequestSchema,
      response: EstimateCostRoute.response,
    },
    preHandler: [requireAuth],
  }, async (request): Promise<CostEstimateResponse> => {
    const auth = getAuthContext(request);
    const body = request.body;

    logger.debug(
      {
        userId: auth.userId,
        baseScanId: body.baseScanId,
        compareScanId: body.compareScanId,
      },
      'Estimating diff computation cost'
    );

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const diffService = getDiffService();
      const estimate = await diffService.estimateDiffCost(
        createTenantId(tenantId),
        createScanId(body.baseScanId),
        createScanId(body.compareScanId)
      );

      return {
        success: true,
        data: {
          estimatedTimeMs: estimate.estimatedTimeMs,
          estimatedMemoryBytes: estimate.estimatedMemoryBytes,
          totalNodes: estimate.totalNodes,
          totalEdges: estimate.totalEdges,
          withinLimits: estimate.withinLimits,
          warnings: [...estimate.warnings],
        },
      };
    } catch (error) {
      handleDiffError(error);
    }
  });

  logger.info('Diff routes registered');
};

// ============================================================================
// Transform Helpers
// ============================================================================

/**
 * Transform GraphDiffResult to API response format
 */
function transformDiffResult(diff: GraphDiffResult): Static<typeof GraphDiffResultSchema> {
  const nodeDiffsResult: Static<typeof NodeDiffSetSchema> = {
    added: diff.nodeDiffs.added.map(transformNodeDiff),
    removed: diff.nodeDiffs.removed.map(transformNodeDiff),
    modified: diff.nodeDiffs.modified.map(transformNodeDiff),
    baseNodeCount: diff.nodeDiffs.baseNodeCount,
    targetNodeCount: diff.nodeDiffs.targetNodeCount,
  };

  // Only include unchanged if there are items
  if (diff.nodeDiffs.unchanged && diff.nodeDiffs.unchanged.length > 0) {
    nodeDiffsResult.unchanged = diff.nodeDiffs.unchanged.map(transformNodeDiff);
  }

  const edgeDiffsResult: Static<typeof EdgeDiffSetSchema> = {
    added: diff.edgeDiffs.added.map(transformEdgeDiff),
    removed: diff.edgeDiffs.removed.map(transformEdgeDiff),
    modified: diff.edgeDiffs.modified.map(transformEdgeDiff),
    baseEdgeCount: diff.edgeDiffs.baseEdgeCount,
    targetEdgeCount: diff.edgeDiffs.targetEdgeCount,
  };

  // Only include unchanged if there are items
  if (diff.edgeDiffs.unchanged && diff.edgeDiffs.unchanged.length > 0) {
    edgeDiffsResult.unchanged = diff.edgeDiffs.unchanged.map(transformEdgeDiff);
  }

  const result: Static<typeof GraphDiffResultSchema> = {
    id: diff.id,
    tenantId: diff.tenantId,
    baseSnapshotId: diff.baseSnapshotId,
    targetSnapshotId: diff.targetSnapshotId,
    nodeDiffs: nodeDiffsResult,
    edgeDiffs: edgeDiffsResult,
    summary: {
      ...diff.summary,
      changesByNodeType: { ...diff.summary.changesByNodeType },
      changesByEdgeType: { ...diff.summary.changesByEdgeType } as Record<string, { added: number; removed: number; modified: number }>,
    },
    timing: { ...diff.timing },
    computedAt: diff.computedAt.toISOString(),
  };

  // Only include optional fields if they have values
  if (diff.rollupId) {
    result.rollupId = diff.rollupId;
  }
  if (diff.executionId) {
    result.executionId = diff.executionId;
  }

  return result;
}

/**
 * Transform NodeDiff for API response
 */
function transformNodeDiff(nodeDiff: any): Static<typeof NodeDiffSchema> {
  return {
    changeType: nodeDiff.changeType,
    identity: {
      key: nodeDiff.identity.key,
      nodeId: nodeDiff.identity.nodeId,
      nodeType: nodeDiff.identity.nodeType,
      name: nodeDiff.identity.name,
      namespace: nodeDiff.identity.namespace,
      repositoryId: nodeDiff.identity.repositoryId,
      identityHash: nodeDiff.identity.identityHash,
    },
    attributeChanges: nodeDiff.attributeChanges?.map((change: any) => ({
      path: change.path,
      previousValue: change.previousValue,
      newValue: change.newValue,
      changeType: change.changeType,
    })),
  };
}

/**
 * Transform EdgeDiff for API response
 */
function transformEdgeDiff(edgeDiff: any): Static<typeof EdgeDiffSchema> {
  return {
    changeType: edgeDiff.changeType,
    identity: {
      key: edgeDiff.identity.key,
      edgeId: edgeDiff.identity.edgeId,
      edgeType: edgeDiff.identity.edgeType,
      identityHash: edgeDiff.identity.identityHash,
    },
    attributeChanges: edgeDiff.attributeChanges?.map((change: any) => ({
      path: change.path,
      previousValue: change.previousValue,
      newValue: change.newValue,
      changeType: change.changeType,
    })),
  };
}

/**
 * Transform DiffListItem for API response
 */
function transformDiffListItem(item: DiffListItem): Static<typeof DiffListItemSchema> {
  return {
    id: item.id,
    baseSnapshotId: item.baseSnapshotId,
    targetSnapshotId: item.targetSnapshotId,
    summary: {
      ...item.summary,
      changesByNodeType: { ...item.summary.changesByNodeType },
      changesByEdgeType: { ...item.summary.changesByEdgeType } as Record<string, { added: number; removed: number; modified: number }>,
    },
    computedAt: item.computedAt.toISOString(),
    computationTimeMs: item.computationTimeMs,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default diffRoutes;

// Export for testing
export { diffRoutes };

// Export schemas for use in OpenAPI documentation
export {
  CreateDiffRequestSchema,
  DiffListQuerySchema,
  DiffIdParamsSchema,
  EstimateCostRequestSchema,
  DiffSingleResponseSchema,
  DiffListResponseSchema,
  CostEstimateResponseSchema,
  GraphDiffResultSchema,
  DiffSummarySchema,
  DiffTimingSchema,
};

// Export route definitions
export {
  CreateDiffRoute,
  ListDiffsRoute,
  GetDiffRoute,
  DeleteDiffRoute,
  EstimateCostRoute,
};

// ============================================================================
// Type Declarations
// ============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    graphDiffService?: IGraphDiffService;
  }
}
