/**
 * Graph Diff API Schemas
 * @module routes/schemas/diff
 *
 * TypeBox schemas for Graph Diff API endpoints.
 * Provides request/response validation for diff computation operations.
 *
 * TASK-ROLLUP-005: Graph Diff Computation API schemas
 */

import { Type, Static, TSchema } from '@sinclair/typebox';
import {
  PaginationQuerySchema,
  PaginationInfoSchema,
  SortOrderSchema,
  ErrorResponseSchema,
} from './common.js';

// ============================================================================
// Status Enums
// ============================================================================

/**
 * Diff computation status
 */
export const DiffStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('computing'),
  Type.Literal('completed'),
  Type.Literal('failed'),
], { description: 'Diff computation status' });

export type DiffStatus = Static<typeof DiffStatusSchema>;

/**
 * Change type for diff operations
 */
export const DiffChangeTypeSchema = Type.Union([
  Type.Literal('added'),
  Type.Literal('removed'),
  Type.Literal('modified'),
  Type.Literal('unchanged'),
], { description: 'Type of change in diff' });

export type DiffChangeType = Static<typeof DiffChangeTypeSchema>;

/**
 * Attribute change type (subset of DiffChangeType)
 */
export const AttributeChangeTypeSchema = Type.Union([
  Type.Literal('added'),
  Type.Literal('removed'),
  Type.Literal('modified'),
], { description: 'Type of attribute change' });

export type AttributeChangeType = Static<typeof AttributeChangeTypeSchema>;

// ============================================================================
// Computation Options Schema
// ============================================================================

/**
 * Diff computation options schema
 */
export const DiffOptionsSchema = Type.Object({
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

export type DiffOptions = Static<typeof DiffOptionsSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * POST /diffs - Create/compute a graph diff
 */
export const DiffCreateRequestSchema = Type.Object({
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
  options: Type.Optional(DiffOptionsSchema),
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

export type DiffCreateRequest = Static<typeof DiffCreateRequestSchema>;

/**
 * GET /diffs - Query parameters for listing diffs
 */
export const DiffListQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
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
    status: Type.Optional(DiffStatusSchema),
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
    sortOrder: Type.Optional(SortOrderSchema),
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
  }),
]);

export type DiffListQuery = Static<typeof DiffListQuerySchema>;

/**
 * Path parameter for diff ID
 */
export const DiffIdParamsSchema = Type.Object({
  diffId: Type.String({
    description: 'Diff identifier',
  }),
});

export type DiffIdParams = Static<typeof DiffIdParamsSchema>;

/**
 * POST /diffs/estimate - Estimate computation cost
 */
export const DiffEstimateRequestSchema = Type.Object({
  baseScanId: Type.String({
    format: 'uuid',
    description: 'UUID of the base scan',
  }),
  compareScanId: Type.String({
    format: 'uuid',
    description: 'UUID of the comparison scan',
  }),
});

export type DiffEstimateRequest = Static<typeof DiffEstimateRequestSchema>;

// ============================================================================
// Component Schemas for Responses
// ============================================================================

/**
 * Change breakdown by type
 */
export const ChangeBreakdownSchema = Type.Object({
  added: Type.Number({ description: 'Number of items added' }),
  removed: Type.Number({ description: 'Number of items removed' }),
  modified: Type.Number({ description: 'Number of items modified' }),
});

export type ChangeBreakdown = Static<typeof ChangeBreakdownSchema>;

/**
 * Diff summary statistics
 */
export const DiffSummarySchema = Type.Object({
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

export type DiffSummary = Static<typeof DiffSummarySchema>;

/**
 * Diff timing information
 */
export const DiffTimingSchema = Type.Object({
  totalMs: Type.Number({ description: 'Total computation time in milliseconds' }),
  nodeIdentityExtractionMs: Type.Number({ description: 'Time for node identity extraction' }),
  nodeComparisonMs: Type.Number({ description: 'Time for node comparison' }),
  edgeIdentityExtractionMs: Type.Number({ description: 'Time for edge identity extraction' }),
  edgeComparisonMs: Type.Number({ description: 'Time for edge comparison' }),
  summaryComputationMs: Type.Number({ description: 'Time for summary computation' }),
  nodesPerSecond: Type.Number({ description: 'Nodes processed per second' }),
  edgesPerSecond: Type.Number({ description: 'Edges processed per second' }),
});

export type DiffTiming = Static<typeof DiffTimingSchema>;

/**
 * Attribute change detail
 */
export const AttributeChangeSchema = Type.Object({
  path: Type.String({ description: 'Path to the changed attribute' }),
  previousValue: Type.Optional(Type.Unknown({ description: 'Previous value' })),
  newValue: Type.Optional(Type.Unknown({ description: 'New value' })),
  changeType: AttributeChangeTypeSchema,
});

export type AttributeChange = Static<typeof AttributeChangeSchema>;

/**
 * Node identity for diff comparison
 */
export const NodeIdentitySchema = Type.Object({
  key: Type.String({ description: 'Unique identity key' }),
  nodeId: Type.String({ description: 'Original node ID' }),
  nodeType: Type.String({ description: 'Node type' }),
  name: Type.String({ description: 'Node name' }),
  namespace: Type.Optional(Type.String({ description: 'Namespace (for K8s resources)' })),
  repositoryId: Type.Optional(Type.String({ description: 'Repository ID' })),
  identityHash: Type.String({ description: 'Hash of identity attributes' }),
});

export type NodeIdentity = Static<typeof NodeIdentitySchema>;

/**
 * Individual node diff entry
 */
export const NodeDiffSchema = Type.Object({
  changeType: DiffChangeTypeSchema,
  identity: NodeIdentitySchema,
  attributeChanges: Type.Optional(Type.Array(AttributeChangeSchema)),
});

export type NodeDiff = Static<typeof NodeDiffSchema>;

/**
 * Collection of node differences
 */
export const NodeDiffSetSchema = Type.Object({
  added: Type.Array(NodeDiffSchema),
  removed: Type.Array(NodeDiffSchema),
  modified: Type.Array(NodeDiffSchema),
  unchanged: Type.Optional(Type.Array(NodeDiffSchema)),
  baseNodeCount: Type.Number(),
  targetNodeCount: Type.Number(),
});

export type NodeDiffSet = Static<typeof NodeDiffSetSchema>;

/**
 * Edge identity for diff comparison
 */
export const EdgeIdentitySchema = Type.Object({
  key: Type.String({ description: 'Unique identity key' }),
  edgeId: Type.String({ description: 'Original edge ID' }),
  edgeType: Type.String({ description: 'Edge type' }),
  identityHash: Type.String({ description: 'Hash of identity attributes' }),
});

export type EdgeIdentity = Static<typeof EdgeIdentitySchema>;

/**
 * Individual edge diff entry
 */
export const EdgeDiffSchema = Type.Object({
  changeType: DiffChangeTypeSchema,
  identity: EdgeIdentitySchema,
  attributeChanges: Type.Optional(Type.Array(AttributeChangeSchema)),
});

export type EdgeDiff = Static<typeof EdgeDiffSchema>;

/**
 * Collection of edge differences
 */
export const EdgeDiffSetSchema = Type.Object({
  added: Type.Array(EdgeDiffSchema),
  removed: Type.Array(EdgeDiffSchema),
  modified: Type.Array(EdgeDiffSchema),
  unchanged: Type.Optional(Type.Array(EdgeDiffSchema)),
  baseEdgeCount: Type.Number(),
  targetEdgeCount: Type.Number(),
});

export type EdgeDiffSet = Static<typeof EdgeDiffSetSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Full graph diff result
 */
export const GraphDiffResultSchema = Type.Object({
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

export type GraphDiffResult = Static<typeof GraphDiffResultSchema>;

/**
 * Cache information for cached responses
 */
export const DiffCacheInfoSchema = Type.Object({
  cachedAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.String({ format: 'date-time' }),
  accessCount: Type.Number(),
});

export type DiffCacheInfo = Static<typeof DiffCacheInfoSchema>;

/**
 * Request metadata for response
 */
export const DiffRequestMetadataSchema = Type.Object({
  requestedAt: Type.String({ format: 'date-time' }),
  processingTimeMs: Type.Number(),
  phases: Type.Array(Type.String()),
});

export type DiffRequestMetadata = Static<typeof DiffRequestMetadataSchema>;

/**
 * Single diff response with full result
 */
export const DiffResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: GraphDiffResultSchema,
  fromCache: Type.Boolean({ description: 'Whether result was from cache' }),
  cacheInfo: Type.Optional(DiffCacheInfoSchema),
  metadata: DiffRequestMetadataSchema,
});

export type DiffResponse = Static<typeof DiffResponseSchema>;

/**
 * Lightweight diff list item
 */
export const DiffListItemSchema = Type.Object({
  id: Type.String({ description: 'Diff identifier' }),
  baseSnapshotId: Type.String({ description: 'Base snapshot identifier' }),
  targetSnapshotId: Type.String({ description: 'Target snapshot identifier' }),
  summary: DiffSummarySchema,
  computedAt: Type.String({ format: 'date-time' }),
  computationTimeMs: Type.Number({ description: 'Computation time in milliseconds' }),
});

export type DiffListItem = Static<typeof DiffListItemSchema>;

/**
 * Paginated diff list response
 */
export const DiffPaginatedResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Array(DiffListItemSchema),
  pagination: PaginationInfoSchema,
});

export type DiffPaginatedResponse = Static<typeof DiffPaginatedResponseSchema>;

/**
 * Async computation accepted response
 */
export const DiffAsyncAcceptedResponseSchema = Type.Object({
  success: Type.Literal(true),
  message: Type.String({ description: 'Status message' }),
  diffId: Type.String({ description: 'Diff ID for polling' }),
  estimatedTimeMs: Type.Optional(Type.Number({ description: 'Estimated completion time' })),
});

export type DiffAsyncAcceptedResponse = Static<typeof DiffAsyncAcceptedResponseSchema>;

/**
 * Cost estimation response
 */
export const DiffCostEstimateResponseSchema = Type.Object({
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

export type DiffCostEstimateResponse = Static<typeof DiffCostEstimateResponseSchema>;

/**
 * Empty success response for DELETE
 */
export const DiffDeleteResponseSchema = Type.Object({
  success: Type.Literal(true),
  message: Type.Optional(Type.String()),
});

export type DiffDeleteResponse = Static<typeof DiffDeleteResponseSchema>;

// ============================================================================
// Route Schema Definitions
// ============================================================================

/**
 * Route schema type for Fastify
 */
export interface DiffRouteSchema {
  description: string;
  tags: string[];
  body?: TSchema;
  querystring?: TSchema;
  params?: TSchema;
  response: Record<number, TSchema>;
  security?: Array<Record<string, string[]>>;
}

/**
 * POST /diffs - Create/compute a diff
 */
export const CreateDiffRoute: DiffRouteSchema = {
  description: 'Compute or retrieve a graph diff between two scans',
  tags: ['Diffs'],
  body: DiffCreateRequestSchema,
  response: {
    201: DiffResponseSchema,
    202: DiffAsyncAcceptedResponseSchema,
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
export const ListDiffsRoute: DiffRouteSchema = {
  description: 'List graph diffs with filtering and pagination',
  tags: ['Diffs'],
  querystring: DiffListQuerySchema,
  response: {
    200: DiffPaginatedResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /diffs/:diffId - Get diff by ID
 */
export const GetDiffRoute: DiffRouteSchema = {
  description: 'Get a graph diff by ID',
  tags: ['Diffs'],
  params: DiffIdParamsSchema,
  response: {
    200: DiffResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * DELETE /diffs/:diffId - Delete a diff
 */
export const DeleteDiffRoute: DiffRouteSchema = {
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
export const EstimateDiffCostRoute: DiffRouteSchema = {
  description: 'Estimate the cost of computing a graph diff',
  tags: ['Diffs'],
  body: DiffEstimateRequestSchema,
  response: {
    200: DiffCostEstimateResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

// ============================================================================
// Route Registry
// ============================================================================

/**
 * All diff routes for registration
 */
export const DiffRoutes = [
  {
    method: 'POST' as const,
    url: '/diffs',
    schema: CreateDiffRoute,
  },
  {
    method: 'GET' as const,
    url: '/diffs',
    schema: ListDiffsRoute,
  },
  {
    method: 'GET' as const,
    url: '/diffs/:diffId',
    schema: GetDiffRoute,
  },
  {
    method: 'DELETE' as const,
    url: '/diffs/:diffId',
    schema: DeleteDiffRoute,
  },
  {
    method: 'POST' as const,
    url: '/diffs/estimate',
    schema: EstimateDiffCostRoute,
  },
] as const;

export type DiffRouteDefinition = typeof DiffRoutes[number];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create pagination info from query and results
 */
export function createDiffPaginationInfo(
  page: number,
  pageSize: number,
  total: number
): Static<typeof PaginationInfoSchema> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Parse diff list query with defaults
 */
export function parseDiffListQuery(
  query: Partial<DiffListQuery>
): DiffListQuery {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    scanId: query.scanId,
    repositoryId: query.repositoryId,
    status: query.status,
    sortBy: query.sortBy ?? 'computedAt',
    sortOrder: query.sortOrder ?? 'desc',
    computedAfter: query.computedAfter,
    computedBefore: query.computedBefore,
  };
}

/**
 * Validate diff options have sensible values
 */
export function validateDiffOptions(options: DiffOptions): string[] {
  const errors: string[] = [];

  if (options.maxNodes !== undefined && options.maxEdges !== undefined) {
    if (options.maxEdges < options.maxNodes) {
      errors.push('maxEdges should generally be >= maxNodes');
    }
  }

  if (options.significantChangeThreshold !== undefined) {
    if (options.significantChangeThreshold < 0 || options.significantChangeThreshold > 1) {
      errors.push('significantChangeThreshold must be between 0 and 1');
    }
  }

  if (options.timeoutMs !== undefined && options.timeoutMs < 1000) {
    errors.push('timeoutMs must be at least 1000ms');
  }

  if (options.batchSize !== undefined) {
    if (options.batchSize < 100) {
      errors.push('batchSize must be at least 100');
    }
    if (options.batchSize > 10000) {
      errors.push('batchSize must not exceed 10000');
    }
  }

  return errors;
}

/**
 * Create empty diff summary for initialization
 */
export function createEmptyDiffSummary(): DiffSummary {
  return {
    baseNodeCount: 0,
    targetNodeCount: 0,
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesModified: 0,
    nodesUnchanged: 0,
    baseEdgeCount: 0,
    targetEdgeCount: 0,
    edgesAdded: 0,
    edgesRemoved: 0,
    edgesModified: 0,
    edgesUnchanged: 0,
    nodeChangeRatio: 0,
    edgeChangeRatio: 0,
    overallChangeRatio: 0,
    isSignificantChange: false,
    changesByNodeType: {},
    changesByEdgeType: {},
  };
}

/**
 * Create default diff timing for initialization
 */
export function createDefaultDiffTiming(): DiffTiming {
  return {
    totalMs: 0,
    nodeIdentityExtractionMs: 0,
    nodeComparisonMs: 0,
    edgeIdentityExtractionMs: 0,
    edgeComparisonMs: 0,
    summaryComputationMs: 0,
    nodesPerSecond: 0,
    edgesPerSecond: 0,
  };
}
