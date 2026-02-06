/**
 * External Object Index API Schemas
 * @module routes/schemas/external-index
 *
 * TypeBox schemas for External Object Index API endpoints.
 * Provides request/response validation for external reference indexing and lookup operations.
 *
 * TASK-ROLLUP-003: Build external object index from all scans with reverse lookup support.
 */

import { Type, Static, TSchema } from '@sinclair/typebox';
import {
  ExternalRefTypeSchema,
  CloudProviderSchema,
  IndexBuildStatusSchema,
  ExternalReferenceSchema,
  IndexBuildResultSchema,
  ExternalObjectLookupResultSchema,
  ReverseLookupResultSchema,
  BatchReverseLookupResultSchema,
  IndexStatsSchema,
  CacheStatsSchema,
  ExternalObjectFilterSchema,
  ExternalObjectSummarySchema,
  ExternalIndexFullStatsSchema,
} from '../../types/external-object-index.js';
import { ErrorResponseSchema, PaginationQuerySchema, PaginationInfoSchema, SortOrderSchema } from './common.js';

// ============================================================================
// Route Schema Interface
// ============================================================================

/**
 * Route schema type for Fastify
 */
export interface RouteSchema {
  /** Route description */
  description: string;
  /** Route tags for OpenAPI */
  tags: string[];
  /** Request body schema */
  body?: TSchema;
  /** Query parameters schema */
  querystring?: TSchema;
  /** URL parameters schema */
  params?: TSchema;
  /** Response schemas by status code */
  response: Record<number, TSchema>;
  /** Security requirements */
  security?: Array<Record<string, string[]>>;
}

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * External object ID path parameter
 */
export const ExternalObjectIdParamsSchema = Type.Object({
  externalObjectId: Type.String({
    format: 'uuid',
    description: 'External object UUID',
  }),
});
export type ExternalObjectIdParams = Static<typeof ExternalObjectIdParamsSchema>;

/**
 * Build ID path parameter
 */
export const BuildIdParamsSchema = Type.Object({
  buildId: Type.String({
    format: 'uuid',
    description: 'Index build UUID',
  }),
});
export type BuildIdParams = Static<typeof BuildIdParamsSchema>;

/**
 * Node ID path parameter for reverse lookup
 */
export const NodeIdParamsSchema = Type.Object({
  scanId: Type.String({
    format: 'uuid',
    description: 'Scan UUID',
  }),
  nodeId: Type.String({
    description: 'Node ID',
    minLength: 1,
  }),
});
export type NodeIdParams = Static<typeof NodeIdParamsSchema>;

// ============================================================================
// Lookup Query Schemas
// ============================================================================

/**
 * Query schema for external object lookup
 */
export const LookupQuerySchema = Type.Object({
  /** The external identifier to look up */
  externalId: Type.String({
    minLength: 1,
    maxLength: 2048,
    description: 'External reference identifier to look up (ARN, URL, image name, etc.)',
  }),
  /** Type of external reference */
  externalType: ExternalRefTypeSchema,
  /** Include node details in response */
  includeNodeDetails: Type.Optional(Type.Boolean({
    default: false,
    description: 'Include detailed information about referencing nodes',
  })),
  /** Include scan information */
  includeScanInfo: Type.Optional(Type.Boolean({
    default: false,
    description: 'Include scan metadata in response',
  })),
});
export type LookupQuery = Static<typeof LookupQuerySchema>;

/**
 * Batch lookup request body
 */
export const BatchLookupRequestSchema = Type.Object({
  /** List of external references to look up */
  lookups: Type.Array(Type.Object({
    externalId: Type.String({
      minLength: 1,
      maxLength: 2048,
      description: 'External reference identifier',
    }),
    externalType: ExternalRefTypeSchema,
  }), {
    minItems: 1,
    maxItems: 100,
    description: 'Batch of external references to look up',
  }),
  /** Include node details in response */
  includeNodeDetails: Type.Optional(Type.Boolean({ default: false })),
});
export type BatchLookupRequest = Static<typeof BatchLookupRequestSchema>;

/**
 * Reverse lookup query schema (node -> external objects)
 */
export const ReverseLookupQuerySchema = Type.Object({
  /** Filter by external reference types */
  types: Type.Optional(Type.Array(ExternalRefTypeSchema, {
    description: 'Filter results to specific external reference types',
  })),
  /** Minimum confidence score filter */
  minConfidence: Type.Optional(Type.Number({
    minimum: 0,
    maximum: 1,
    description: 'Minimum confidence score for returned references',
  })),
  /** Pagination: page number */
  page: Type.Optional(Type.Number({
    minimum: 1,
    default: 1,
    description: 'Page number',
  })),
  /** Pagination: page size */
  pageSize: Type.Optional(Type.Number({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Number of items per page',
  })),
});
export type ReverseLookupQuery = Static<typeof ReverseLookupQuerySchema>;

/**
 * Batch reverse lookup request body
 */
export const BatchReverseLookupRequestSchema = Type.Object({
  /** Node IDs to look up */
  nodes: Type.Array(Type.Object({
    scanId: Type.String({ format: 'uuid' }),
    nodeId: Type.String({ minLength: 1 }),
  }), {
    minItems: 1,
    maxItems: 100,
    description: 'Batch of nodes to look up',
  }),
  /** Filter by external reference types */
  types: Type.Optional(Type.Array(ExternalRefTypeSchema)),
  /** Minimum confidence score filter */
  minConfidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
});
export type BatchReverseLookupRequest = Static<typeof BatchReverseLookupRequestSchema>;

// ============================================================================
// Build Index Request Schemas
// ============================================================================

/**
 * Request to build/rebuild the external object index
 */
export const BuildIndexRequestSchema = Type.Object({
  /** Specific scan IDs to index (optional, defaults to all scans) */
  scanIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Specific scans to include in the index build',
  })),
  /** Specific repository IDs to index */
  repositoryIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Specific repositories to include in the index build',
  })),
  /** Force full rebuild (ignore incremental) */
  forceFullRebuild: Type.Boolean({
    default: false,
    description: 'Force a full rebuild instead of incremental update',
  }),
  /** Include only specific external reference types */
  includeTypes: Type.Optional(Type.Array(ExternalRefTypeSchema, {
    description: 'Only index specific external reference types',
  })),
  /** Exclude specific external reference types */
  excludeTypes: Type.Optional(Type.Array(ExternalRefTypeSchema, {
    description: 'Exclude specific external reference types from indexing',
  })),
  /** Minimum confidence threshold for including references */
  minConfidence: Type.Optional(Type.Number({
    minimum: 0,
    maximum: 1,
    default: 0.5,
    description: 'Minimum confidence score for including references',
  })),
  /** Run build asynchronously */
  async: Type.Boolean({
    default: true,
    description: 'Run the build operation asynchronously',
  }),
  /** Callback URL for async completion notification */
  callbackUrl: Type.Optional(Type.String({
    format: 'uri',
    description: 'URL to call when async build completes',
  })),
  /** Custom build options */
  options: Type.Optional(Type.Object({
    /** Enable parallel processing */
    parallelProcessing: Type.Boolean({ default: true }),
    /** Batch size for processing */
    batchSize: Type.Optional(Type.Number({ minimum: 1, maximum: 10000, default: 1000 })),
    /** Timeout in seconds */
    timeoutSeconds: Type.Optional(Type.Number({ minimum: 60, maximum: 7200, default: 3600 })),
    /** Skip validation checks */
    skipValidation: Type.Boolean({ default: false }),
    /** Optimize index after build */
    optimizeAfterBuild: Type.Boolean({ default: true }),
  })),
});
export type BuildIndexRequest = Static<typeof BuildIndexRequestSchema>;

/**
 * Request to cancel a running build
 */
export const CancelBuildRequestSchema = Type.Object({
  /** Reason for cancellation */
  reason: Type.Optional(Type.String({
    maxLength: 500,
    description: 'Reason for cancelling the build',
  })),
});
export type CancelBuildRequest = Static<typeof CancelBuildRequestSchema>;

// ============================================================================
// List and Search Query Schemas
// ============================================================================

/**
 * Query parameters for listing external objects
 */
export const ListExternalObjectsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  ExternalObjectFilterSchema,
  Type.Object({
    /** Sort field */
    sortBy: Type.Optional(Type.Union([
      Type.Literal('referenceCount'),
      Type.Literal('lastUpdated'),
      Type.Literal('firstSeen'),
      Type.Literal('externalId'),
      Type.Literal('confidence'),
    ], {
      default: 'referenceCount',
      description: 'Field to sort results by',
    })),
    /** Sort order */
    sortOrder: Type.Optional(SortOrderSchema),
  }),
]);
export type ListExternalObjectsQuery = Static<typeof ListExternalObjectsQuerySchema>;

/**
 * Search query for external objects
 */
export const SearchExternalObjectsRequestSchema = Type.Object({
  /** Search query string */
  query: Type.String({
    minLength: 1,
    maxLength: 1000,
    description: 'Search query to match against external identifiers and attributes',
  }),
  /** Filter options */
  filters: Type.Optional(ExternalObjectFilterSchema),
  /** Pagination */
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  /** Sort options */
  sortBy: Type.Optional(Type.Union([
    Type.Literal('relevance'),
    Type.Literal('referenceCount'),
    Type.Literal('lastUpdated'),
  ], { default: 'relevance' })),
  sortOrder: Type.Optional(SortOrderSchema),
});
export type SearchExternalObjectsRequest = Static<typeof SearchExternalObjectsRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Success response with external object lookup result
 */
export const LookupResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: ExternalObjectLookupResultSchema,
});
export type LookupResponse = Static<typeof LookupResponseSchema>;

/**
 * Batch lookup response
 */
export const BatchLookupResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    results: Type.Array(ExternalObjectLookupResultSchema),
    found: Type.Number({ description: 'Number of objects found' }),
    notFound: Type.Number({ description: 'Number of objects not found' }),
    processingTimeMs: Type.Number({ description: 'Processing time in milliseconds' }),
  }),
});
export type BatchLookupResponse = Static<typeof BatchLookupResponseSchema>;

/**
 * Reverse lookup response
 */
export const ReverseLookupResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: ReverseLookupResultSchema,
});
export type ReverseLookupResponse = Static<typeof ReverseLookupResponseSchema>;

/**
 * Batch reverse lookup response
 */
export const BatchReverseLookupResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: BatchReverseLookupResultSchema,
});
export type BatchReverseLookupResponse = Static<typeof BatchReverseLookupResponseSchema>;

/**
 * Build started/result response
 */
export const BuildResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: IndexBuildResultSchema,
});
export type BuildResponse = Static<typeof BuildResponseSchema>;

/**
 * List of builds response
 */
export const BuildListResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Array(IndexBuildResultSchema),
  pagination: PaginationInfoSchema,
});
export type BuildListResponse = Static<typeof BuildListResponseSchema>;

/**
 * Index statistics response
 */
export const StatsResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: ExternalIndexFullStatsSchema,
});
export type StatsResponse = Static<typeof StatsResponseSchema>;

/**
 * List external objects response
 */
export const ListExternalObjectsResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Array(Type.Intersect([
    ExternalObjectSummarySchema,
    Type.Object({
      referenceCount: Type.Number(),
      firstSeen: Type.Optional(Type.String({ format: 'date-time' })),
      lastUpdated: Type.Optional(Type.String({ format: 'date-time' })),
    }),
  ])),
  pagination: PaginationInfoSchema,
});
export type ListExternalObjectsResponse = Static<typeof ListExternalObjectsResponseSchema>;

/**
 * Search results response
 */
export const SearchExternalObjectsResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    results: Type.Array(Type.Intersect([
      ExternalObjectSummarySchema,
      Type.Object({
        referenceCount: Type.Number(),
        relevanceScore: Type.Number({ minimum: 0, maximum: 1 }),
        highlightedMatch: Type.Optional(Type.String()),
      }),
    ])),
    totalMatches: Type.Number(),
    processingTimeMs: Type.Number(),
  }),
  pagination: PaginationInfoSchema,
});
export type SearchExternalObjectsResponse = Static<typeof SearchExternalObjectsResponseSchema>;

/**
 * Empty success response
 */
export const EmptySuccessResponseSchema = Type.Object({
  success: Type.Literal(true),
  message: Type.Optional(Type.String()),
});
export type EmptySuccessResponse = Static<typeof EmptySuccessResponseSchema>;

/**
 * Cache clear response
 */
export const CacheClearResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    entriesCleared: Type.Number(),
    previousHitRate: Type.Number(),
  }),
});
export type CacheClearResponse = Static<typeof CacheClearResponseSchema>;

// ============================================================================
// Route Schema Definitions
// ============================================================================

/**
 * GET /external-index/lookup - Look up an external object by identifier
 */
export const LookupRoute: RouteSchema = {
  description: 'Look up an external object by its identifier and type',
  tags: ['External Index'],
  querystring: LookupQuerySchema,
  response: {
    200: LookupResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /external-index/lookup/batch - Batch lookup of external objects
 */
export const BatchLookupRoute: RouteSchema = {
  description: 'Look up multiple external objects in a single request',
  tags: ['External Index'],
  body: BatchLookupRequestSchema,
  response: {
    200: BatchLookupResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /external-index/scans/:scanId/nodes/:nodeId/external-objects - Reverse lookup
 */
export const ReverseLookupRoute: RouteSchema = {
  description: 'Get all external objects referenced by a specific node',
  tags: ['External Index'],
  params: NodeIdParamsSchema,
  querystring: ReverseLookupQuerySchema,
  response: {
    200: ReverseLookupResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /external-index/reverse-lookup/batch - Batch reverse lookup
 */
export const BatchReverseLookupRoute: RouteSchema = {
  description: 'Get external objects for multiple nodes in a single request',
  tags: ['External Index'],
  body: BatchReverseLookupRequestSchema,
  response: {
    200: BatchReverseLookupResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /external-index/objects - List external objects with filtering
 */
export const ListExternalObjectsRoute: RouteSchema = {
  description: 'List all indexed external objects with optional filtering and pagination',
  tags: ['External Index'],
  querystring: ListExternalObjectsQuerySchema,
  response: {
    200: ListExternalObjectsResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /external-index/search - Search external objects
 */
export const SearchExternalObjectsRoute: RouteSchema = {
  description: 'Search external objects by query string',
  tags: ['External Index'],
  body: SearchExternalObjectsRequestSchema,
  response: {
    200: SearchExternalObjectsResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /external-index/objects/:externalObjectId - Get external object details
 */
export const GetExternalObjectRoute: RouteSchema = {
  description: 'Get detailed information about a specific external object',
  tags: ['External Index'],
  params: ExternalObjectIdParamsSchema,
  response: {
    200: LookupResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /external-index/build - Trigger index build
 */
export const BuildIndexRoute: RouteSchema = {
  description: 'Trigger a build or rebuild of the external object index',
  tags: ['External Index', 'Admin'],
  body: BuildIndexRequestSchema,
  response: {
    200: BuildResponseSchema,
    202: BuildResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    409: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /external-index/builds - List build operations
 */
export const ListBuildsRoute: RouteSchema = {
  description: 'List recent index build operations',
  tags: ['External Index', 'Admin'],
  querystring: Type.Object({
    page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 50, default: 10 })),
    status: Type.Optional(IndexBuildStatusSchema),
  }),
  response: {
    200: BuildListResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /external-index/builds/:buildId - Get build status
 */
export const GetBuildStatusRoute: RouteSchema = {
  description: 'Get the status of a specific build operation',
  tags: ['External Index', 'Admin'],
  params: BuildIdParamsSchema,
  response: {
    200: BuildResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /external-index/builds/:buildId/cancel - Cancel a running build
 */
export const CancelBuildRoute: RouteSchema = {
  description: 'Cancel a running index build operation',
  tags: ['External Index', 'Admin'],
  params: BuildIdParamsSchema,
  body: CancelBuildRequestSchema,
  response: {
    200: BuildResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
    409: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /external-index/stats - Get index statistics
 */
export const GetStatsRoute: RouteSchema = {
  description: 'Get statistics about the external object index',
  tags: ['External Index'],
  response: {
    200: StatsResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /external-index/cache/clear - Clear the index cache
 */
export const ClearCacheRoute: RouteSchema = {
  description: 'Clear the external object index cache',
  tags: ['External Index', 'Admin'],
  response: {
    200: CacheClearResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /external-index/health - Health check for the index
 */
export const IndexHealthRoute: RouteSchema = {
  description: 'Check the health status of the external object index',
  tags: ['External Index', 'Health'],
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
        lastBuildStatus: Type.Optional(IndexBuildStatusSchema),
        lastBuildAt: Type.Optional(Type.String({ format: 'date-time' })),
        issues: Type.Array(Type.String()),
      }),
    }),
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

// ============================================================================
// Route Registry
// ============================================================================

/**
 * All external index routes for registration
 */
export const ExternalIndexRoutes = [
  {
    method: 'GET' as const,
    url: '/external-index/lookup',
    schema: LookupRoute,
  },
  {
    method: 'POST' as const,
    url: '/external-index/lookup/batch',
    schema: BatchLookupRoute,
  },
  {
    method: 'GET' as const,
    url: '/external-index/scans/:scanId/nodes/:nodeId/external-objects',
    schema: ReverseLookupRoute,
  },
  {
    method: 'POST' as const,
    url: '/external-index/reverse-lookup/batch',
    schema: BatchReverseLookupRoute,
  },
  {
    method: 'GET' as const,
    url: '/external-index/objects',
    schema: ListExternalObjectsRoute,
  },
  {
    method: 'POST' as const,
    url: '/external-index/search',
    schema: SearchExternalObjectsRoute,
  },
  {
    method: 'GET' as const,
    url: '/external-index/objects/:externalObjectId',
    schema: GetExternalObjectRoute,
  },
  {
    method: 'POST' as const,
    url: '/external-index/build',
    schema: BuildIndexRoute,
  },
  {
    method: 'GET' as const,
    url: '/external-index/builds',
    schema: ListBuildsRoute,
  },
  {
    method: 'GET' as const,
    url: '/external-index/builds/:buildId',
    schema: GetBuildStatusRoute,
  },
  {
    method: 'POST' as const,
    url: '/external-index/builds/:buildId/cancel',
    schema: CancelBuildRoute,
  },
  {
    method: 'GET' as const,
    url: '/external-index/stats',
    schema: GetStatsRoute,
  },
  {
    method: 'POST' as const,
    url: '/external-index/cache/clear',
    schema: ClearCacheRoute,
  },
  {
    method: 'GET' as const,
    url: '/external-index/health',
    schema: IndexHealthRoute,
  },
] as const;

export type ExternalIndexRouteDefinition = typeof ExternalIndexRoutes[number];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create pagination info from query and results
 */
export function createExternalIndexPaginationInfo(
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
 * Parse list query with defaults
 */
export function parseListExternalObjectsQuery(
  query: Partial<ListExternalObjectsQuery>
): ListExternalObjectsQuery {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    sortBy: query.sortBy ?? 'referenceCount',
    sortOrder: query.sortOrder ?? 'desc',
    types: query.types,
    providers: query.providers,
    repositoryIds: query.repositoryIds,
    scanIds: query.scanIds,
    identifierPattern: query.identifierPattern,
    minConfidence: query.minConfidence,
    multipleReferencesOnly: query.multipleReferencesOnly,
    attributes: query.attributes,
  };
}

/**
 * Create a reference hash from identifier and type
 * This is a helper for clients; actual hashing should be done server-side
 */
export function createLookupKey(externalId: string, externalType: string): string {
  return `${externalType}:${externalId}`;
}
