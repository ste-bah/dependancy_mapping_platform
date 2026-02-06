/**
 * Rollup API Schemas
 * @module routes/schemas/rollup
 *
 * TypeBox schemas for Rollup API endpoints.
 * Provides request/response validation for cross-repository aggregation operations.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation route schemas
 */

import { Type, Static, TSchema } from '@sinclair/typebox';
import {
  RollupConfigSchema,
  RollupCreateRequestSchema,
  RollupUpdateRequestSchema,
  RollupExecuteRequestSchema,
  RollupListQuerySchema,
  RollupIdParamSchema,
  RollupResponseSchema,
  RollupListResponseSchema,
  RollupExecutionResultSchema,
  RollupExecutionStatsSchema,
  BlastRadiusQuerySchema,
  BlastRadiusResponseSchema,
  MatchingStrategySchema,
  RollupStatusSchema,
  MatcherConfigSchema,
} from '../../types/rollup.js';
import { ErrorResponseSchema, PaginationInfoSchema } from './common.js';

// ============================================================================
// Route Definitions
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
// Request Schemas (re-exported with route context)
// ============================================================================

/**
 * Rollup ID path parameter
 */
export const RollupIdParams = RollupIdParamSchema;
export type RollupIdParams = Static<typeof RollupIdParams>;

/**
 * Rollup execution ID path parameter
 */
export const ExecutionIdParamsSchema = Type.Object({
  rollupId: Type.String({ format: 'uuid', description: 'Rollup UUID' }),
  executionId: Type.String({ format: 'uuid', description: 'Execution UUID' }),
});
export type ExecutionIdParams = Static<typeof ExecutionIdParamsSchema>;

/**
 * Blast radius path parameters
 */
export const BlastRadiusParamsSchema = Type.Object({
  rollupId: Type.String({ format: 'uuid', description: 'Rollup UUID' }),
});
export type BlastRadiusParams = Static<typeof BlastRadiusParamsSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Success response wrapper
 */
const SuccessResponseSchema = <T extends TSchema>(dataSchema: T) =>
  Type.Object({
    success: Type.Literal(true),
    data: dataSchema,
  });

/**
 * Empty success response
 */
export const EmptySuccessResponseSchema = Type.Object({
  success: Type.Literal(true),
  message: Type.Optional(Type.String()),
});

/**
 * Single rollup response
 */
export const RollupSingleResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: RollupConfigSchema,
  latestExecution: Type.Optional(Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.String(),
    startedAt: Type.Optional(Type.String({ format: 'date-time' })),
    completedAt: Type.Optional(Type.String({ format: 'date-time' })),
    stats: Type.Optional(RollupExecutionStatsSchema),
  })),
});
export type RollupSingleResponse = Static<typeof RollupSingleResponseSchema>;

/**
 * Rollup list response
 */
export const RollupPaginatedResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Array(RollupConfigSchema),
  pagination: PaginationInfoSchema,
});
export type RollupPaginatedResponse = Static<typeof RollupPaginatedResponseSchema>;

/**
 * Execution result response
 */
export const ExecutionResultResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: RollupExecutionResultSchema,
});
export type ExecutionResultResponse = Static<typeof ExecutionResultResponseSchema>;

/**
 * Blast radius response
 */
export const BlastRadiusResultResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: BlastRadiusResponseSchema,
});
export type BlastRadiusResultResponse = Static<typeof BlastRadiusResultResponseSchema>;

/**
 * Validation response
 */
export const ValidationResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    isValid: Type.Boolean(),
    errors: Type.Array(Type.Object({
      code: Type.String(),
      message: Type.String(),
      path: Type.String(),
      value: Type.Optional(Type.Unknown()),
    })),
    warnings: Type.Array(Type.Object({
      code: Type.String(),
      message: Type.String(),
      path: Type.String(),
      suggestion: Type.Optional(Type.String()),
    })),
  }),
});
export type ValidationResponse = Static<typeof ValidationResponseSchema>;

// ============================================================================
// Route Schema Definitions
// ============================================================================

/**
 * POST /rollups - Create a new rollup
 */
export const CreateRollupRoute: RouteSchema = {
  description: 'Create a new cross-repository rollup configuration',
  tags: ['Rollups'],
  body: RollupCreateRequestSchema,
  response: {
    201: RollupSingleResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    422: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /rollups - List rollups
 */
export const ListRollupsRoute: RouteSchema = {
  description: 'List rollup configurations with filtering and pagination',
  tags: ['Rollups'],
  querystring: RollupListQuerySchema,
  response: {
    200: RollupPaginatedResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /rollups/:rollupId - Get a rollup by ID
 */
export const GetRollupRoute: RouteSchema = {
  description: 'Get a rollup configuration by ID',
  tags: ['Rollups'],
  params: RollupIdParams,
  response: {
    200: RollupSingleResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * PATCH /rollups/:rollupId - Update a rollup
 */
export const UpdateRollupRoute: RouteSchema = {
  description: 'Update a rollup configuration',
  tags: ['Rollups'],
  params: RollupIdParams,
  body: RollupUpdateRequestSchema,
  response: {
    200: RollupSingleResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
    409: ErrorResponseSchema,
    422: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * DELETE /rollups/:rollupId - Delete a rollup
 */
export const DeleteRollupRoute: RouteSchema = {
  description: 'Delete a rollup configuration and all associated executions',
  tags: ['Rollups'],
  params: RollupIdParams,
  response: {
    200: EmptySuccessResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
    409: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /rollups/:rollupId/execute - Execute a rollup
 */
export const ExecuteRollupRoute: RouteSchema = {
  description: 'Execute a rollup to aggregate nodes across repositories',
  tags: ['Rollups', 'Executions'],
  params: RollupIdParams,
  body: RollupExecuteRequestSchema,
  response: {
    200: ExecutionResultResponseSchema,
    202: ExecutionResultResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
    409: ErrorResponseSchema,
    422: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * GET /rollups/:rollupId/executions/:executionId - Get execution result
 */
export const GetExecutionResultRoute: RouteSchema = {
  description: 'Get the result of a rollup execution',
  tags: ['Rollups', 'Executions'],
  params: ExecutionIdParamsSchema,
  response: {
    200: ExecutionResultResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /rollups/:rollupId/blast-radius - Get blast radius analysis
 */
export const GetBlastRadiusRoute: RouteSchema = {
  description: 'Analyze blast radius for nodes across the aggregated graph',
  tags: ['Rollups', 'Analysis'],
  params: BlastRadiusParamsSchema,
  body: BlastRadiusQuerySchema,
  response: {
    200: BlastRadiusResultResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    404: ErrorResponseSchema,
    422: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

/**
 * POST /rollups/validate - Validate rollup configuration
 */
export const ValidateRollupRoute: RouteSchema = {
  description: 'Validate a rollup configuration without creating it',
  tags: ['Rollups'],
  body: RollupCreateRequestSchema,
  response: {
    200: ValidationResponseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

// ============================================================================
// Route Registry
// ============================================================================

/**
 * All rollup routes for registration
 */
export const RollupRoutes = [
  {
    method: 'POST' as const,
    url: '/rollups',
    schema: CreateRollupRoute,
  },
  {
    method: 'GET' as const,
    url: '/rollups',
    schema: ListRollupsRoute,
  },
  {
    method: 'GET' as const,
    url: '/rollups/:rollupId',
    schema: GetRollupRoute,
  },
  {
    method: 'PATCH' as const,
    url: '/rollups/:rollupId',
    schema: UpdateRollupRoute,
  },
  {
    method: 'DELETE' as const,
    url: '/rollups/:rollupId',
    schema: DeleteRollupRoute,
  },
  {
    method: 'POST' as const,
    url: '/rollups/:rollupId/execute',
    schema: ExecuteRollupRoute,
  },
  {
    method: 'GET' as const,
    url: '/rollups/:rollupId/executions/:executionId',
    schema: GetExecutionResultRoute,
  },
  {
    method: 'POST' as const,
    url: '/rollups/:rollupId/blast-radius',
    schema: GetBlastRadiusRoute,
  },
  {
    method: 'POST' as const,
    url: '/rollups/validate',
    schema: ValidateRollupRoute,
  },
] as const;

export type RollupRouteDefinition = typeof RollupRoutes[number];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create pagination info from query and results
 */
export function createRollupPaginationInfo(
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
 * Parse rollup list query with defaults
 */
export function parseRollupListQuery(query: Partial<Static<typeof RollupListQuerySchema>>): Static<typeof RollupListQuerySchema> {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    status: query.status,
    repositoryId: query.repositoryId,
    search: query.search,
    sortBy: query.sortBy ?? 'createdAt',
    sortOrder: query.sortOrder ?? 'desc',
  };
}
