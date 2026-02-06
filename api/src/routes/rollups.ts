/**
 * Rollup Routes
 * @module routes/rollups
 *
 * REST API endpoints for Cross-Repository Aggregation (Rollup) operations.
 * Implements CRUD operations, execution, and blast radius analysis.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation API endpoints
 *
 * Endpoints:
 * - POST /api/v1/rollups - Create rollup configuration
 * - GET /api/v1/rollups - List rollups (paginated)
 * - GET /api/v1/rollups/:rollupId - Get rollup by ID
 * - PATCH /api/v1/rollups/:rollupId - Update rollup
 * - DELETE /api/v1/rollups/:rollupId - Delete rollup
 * - POST /api/v1/rollups/:rollupId/execute - Execute rollup
 * - GET /api/v1/rollups/:rollupId/executions/:executionId - Get execution result
 * - POST /api/v1/rollups/:rollupId/blast-radius - Compute blast radius
 * - POST /api/v1/rollups/validate - Validate rollup configuration
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
  CreateRollupRoute,
  ListRollupsRoute,
  GetRollupRoute,
  UpdateRollupRoute,
  DeleteRollupRoute,
  ExecuteRollupRoute,
  GetExecutionResultRoute,
  GetBlastRadiusRoute,
  ValidateRollupRoute,
  RollupIdParams,
  ExecutionIdParamsSchema,
  BlastRadiusParamsSchema,
  RollupSingleResponseSchema,
  RollupPaginatedResponseSchema,
  ExecutionResultResponseSchema,
  BlastRadiusResultResponseSchema,
  EmptySuccessResponseSchema,
  ValidationResponseSchema,
  createRollupPaginationInfo,
  parseRollupListQuery,
  type RollupSingleResponse,
  type RollupPaginatedResponse,
  type ExecutionResultResponse,
  type BlastRadiusResultResponse,
  type ValidationResponse,
  type ExecutionIdParams,
  type BlastRadiusParams,
} from './schemas/rollup.js';
import {
  RollupCreateRequest,
  RollupUpdateRequest,
  RollupExecuteRequest,
  RollupListQuery,
  BlastRadiusQuery,
  RollupCreateRequestSchema,
  RollupUpdateRequestSchema,
  RollupExecuteRequestSchema,
  RollupListQuerySchema,
  BlastRadiusQuerySchema,
  createRollupId,
  createRollupExecutionId,
} from '../types/rollup.js';
import { createTenantId } from '../types/entities.js';
import { IRollupService } from '../services/rollup/interfaces.js';
import {
  RollupError,
  RollupNotFoundError,
  RollupExecutionNotFoundError,
  RollupConfigurationError,
  RollupLimitExceededError,
  isRollupError,
} from '../services/rollup/errors.js';

const logger = pino({ name: 'rollup-routes' });

// ============================================================================
// Route Configuration
// ============================================================================

/**
 * Rate limiting configuration for rollup endpoints
 */
const RATE_LIMITS = {
  create: { max: 10, timeWindow: '1 minute' },
  list: { max: 100, timeWindow: '1 minute' },
  read: { max: 200, timeWindow: '1 minute' },
  update: { max: 20, timeWindow: '1 minute' },
  delete: { max: 10, timeWindow: '1 minute' },
  execute: { max: 5, timeWindow: '1 minute' },
  blastRadius: { max: 20, timeWindow: '1 minute' },
} as const;

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map rollup errors to HTTP status codes
 */
function mapRollupErrorToStatusCode(error: RollupError): number {
  if (error instanceof RollupNotFoundError) {
    return 404;
  }
  if (error instanceof RollupExecutionNotFoundError) {
    return 404;
  }
  if (error instanceof RollupConfigurationError) {
    return 422;
  }
  if (error instanceof RollupLimitExceededError) {
    return 400;
  }
  if (error.code?.includes('PERMISSION_DENIED')) {
    return 403;
  }
  if (error.code?.includes('RATE_LIMITED')) {
    return 429;
  }
  if (error.code?.includes('IN_PROGRESS')) {
    return 409;
  }
  return 500;
}

/**
 * Handle errors and throw appropriate HTTP errors
 */
function handleRollupError(error: unknown): never {
  if (isRollupError(error)) {
    const statusCode = mapRollupErrorToStatusCode(error);

    switch (statusCode) {
      case 404:
        throw new NotFoundError('Rollup', (error as RollupNotFoundError).rollupId || 'unknown');
      case 422:
        throw new ValidationError(error.message, (error as RollupConfigurationError).validationErrors);
      case 409:
        throw new ConflictError(error.message);
      case 403:
        throw new ForbiddenError(error.message);
      default:
        throw error;
    }
  }
  throw error;
}

// ============================================================================
// Rollup Routes Plugin
// ============================================================================

/**
 * Rollup routes plugin
 * Registers all rollup-related API endpoints
 */
const rollupRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Get rollup service from dependency injection
  // The service should be registered in the fastify instance during app setup
  const getRollupService = (): IRollupService => {
    const service = (fastify as FastifyInstance & { rollupService?: IRollupService }).rollupService;
    if (!service) {
      logger.error('RollupService not registered');
      throw new Error('RollupService not available');
    }
    return service;
  };

  // ==========================================================================
  // POST /api/v1/rollups - Create a new rollup configuration
  // ==========================================================================
  fastify.post<{
    Body: RollupCreateRequest;
  }>('/', {
    schema: {
      description: CreateRollupRoute.description,
      tags: CreateRollupRoute.tags,
      body: RollupCreateRequestSchema,
      response: {
        201: RollupSingleResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<RollupSingleResponse> => {
    const auth = getAuthContext(request);
    const body = request.body;

    logger.info({ userId: auth.userId, name: body.name }, 'Creating rollup configuration');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const rollup = await rollupService.createRollup(
        createTenantId(tenantId),
        auth.userId,
        body
      );

      logger.info({ rollupId: rollup.id, tenantId }, 'Rollup configuration created');

      reply.status(201);
      return {
        success: true,
        data: rollup,
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/rollups - List rollup configurations
  // ==========================================================================
  fastify.get<{
    Querystring: RollupListQuery;
  }>('/', {
    schema: {
      description: ListRollupsRoute.description,
      tags: ListRollupsRoute.tags,
      querystring: RollupListQuerySchema,
      response: {
        200: RollupPaginatedResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<RollupPaginatedResponse> => {
    const auth = getAuthContext(request);
    const query = parseRollupListQuery(request.query);

    logger.debug({ userId: auth.userId, query }, 'Listing rollup configurations');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const result = await rollupService.listRollups(
        createTenantId(tenantId),
        query
      );

      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/rollups/:rollupId - Get rollup by ID
  // ==========================================================================
  fastify.get<{
    Params: RollupIdParams;
  }>('/:rollupId', {
    schema: {
      description: GetRollupRoute.description,
      tags: GetRollupRoute.tags,
      params: RollupIdParams,
      response: {
        200: RollupSingleResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<RollupSingleResponse> => {
    const auth = getAuthContext(request);
    const { rollupId } = request.params;

    logger.debug({ rollupId, userId: auth.userId }, 'Getting rollup configuration');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const rollup = await rollupService.getRollup(
        createTenantId(tenantId),
        createRollupId(rollupId)
      );

      return {
        success: true,
        data: rollup,
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // PATCH /api/v1/rollups/:rollupId - Update rollup configuration
  // ==========================================================================
  fastify.patch<{
    Params: RollupIdParams;
    Body: RollupUpdateRequest;
  }>('/:rollupId', {
    schema: {
      description: UpdateRollupRoute.description,
      tags: UpdateRollupRoute.tags,
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
    },
    preHandler: [requireAuth],
  }, async (request): Promise<RollupSingleResponse> => {
    const auth = getAuthContext(request);
    const { rollupId } = request.params;
    const body = request.body;

    logger.info({ rollupId, userId: auth.userId }, 'Updating rollup configuration');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const rollup = await rollupService.updateRollup(
        createTenantId(tenantId),
        createRollupId(rollupId),
        auth.userId,
        body
      );

      logger.info({ rollupId, version: rollup.version }, 'Rollup configuration updated');

      return {
        success: true,
        data: rollup,
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // DELETE /api/v1/rollups/:rollupId - Delete rollup configuration
  // ==========================================================================
  fastify.delete<{
    Params: RollupIdParams;
  }>('/:rollupId', {
    schema: {
      description: DeleteRollupRoute.description,
      tags: DeleteRollupRoute.tags,
      params: RollupIdParams,
      response: {
        200: EmptySuccessResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request) => {
    const auth = getAuthContext(request);
    const { rollupId } = request.params;

    logger.info({ rollupId, userId: auth.userId }, 'Deleting rollup configuration');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      await rollupService.deleteRollup(
        createTenantId(tenantId),
        createRollupId(rollupId)
      );

      logger.info({ rollupId }, 'Rollup configuration deleted');

      return {
        success: true as const,
        message: 'Rollup deleted successfully',
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // POST /api/v1/rollups/:rollupId/execute - Execute rollup aggregation
  // ==========================================================================
  fastify.post<{
    Params: RollupIdParams;
    Body: RollupExecuteRequest;
  }>('/:rollupId/execute', {
    schema: {
      description: ExecuteRollupRoute.description,
      tags: ExecuteRollupRoute.tags,
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
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<ExecutionResultResponse> => {
    const auth = getAuthContext(request);
    const { rollupId } = request.params;
    const body = request.body;

    logger.info(
      { rollupId, userId: auth.userId, async: body.async },
      'Executing rollup aggregation'
    );

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const result = await rollupService.executeRollup(
        createTenantId(tenantId),
        createRollupId(rollupId),
        body
      );

      // Set status based on whether execution was async
      if (result.status === 'pending' || result.status === 'running') {
        reply.status(202);
      }

      logger.info(
        { rollupId, executionId: result.id, status: result.status },
        'Rollup execution initiated'
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // GET /api/v1/rollups/:rollupId/executions/:executionId - Get execution result
  // ==========================================================================
  fastify.get<{
    Params: ExecutionIdParams;
  }>('/:rollupId/executions/:executionId', {
    schema: {
      description: GetExecutionResultRoute.description,
      tags: GetExecutionResultRoute.tags,
      params: ExecutionIdParamsSchema,
      response: {
        200: ExecutionResultResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<ExecutionResultResponse> => {
    const auth = getAuthContext(request);
    const { rollupId, executionId } = request.params;

    logger.debug(
      { rollupId, executionId, userId: auth.userId },
      'Getting rollup execution result'
    );

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const result = await rollupService.getExecutionResult(
        createTenantId(tenantId),
        createRollupExecutionId(executionId)
      );

      // Verify the execution belongs to the specified rollup
      if (result.rollupId !== rollupId) {
        throw new NotFoundError('Execution', executionId);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // POST /api/v1/rollups/:rollupId/blast-radius - Compute blast radius
  // ==========================================================================
  fastify.post<{
    Params: BlastRadiusParams;
    Body: BlastRadiusQuery;
  }>('/:rollupId/blast-radius', {
    schema: {
      description: GetBlastRadiusRoute.description,
      tags: GetBlastRadiusRoute.tags,
      params: BlastRadiusParamsSchema,
      body: BlastRadiusQuerySchema,
      response: {
        200: BlastRadiusResultResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<BlastRadiusResultResponse> => {
    const auth = getAuthContext(request);
    const { rollupId } = request.params;
    const body = request.body;

    logger.info(
      { rollupId, userId: auth.userId, nodeIds: body.nodeIds },
      'Computing blast radius'
    );

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const result = await rollupService.getBlastRadius(
        createTenantId(tenantId),
        createRollupId(rollupId),
        body
      );

      logger.info(
        {
          rollupId,
          totalImpacted: result.summary.totalImpacted,
          riskLevel: result.summary.riskLevel,
        },
        'Blast radius computed'
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  // ==========================================================================
  // POST /api/v1/rollups/validate - Validate rollup configuration
  // ==========================================================================
  fastify.post<{
    Body: RollupCreateRequest;
  }>('/validate', {
    schema: {
      description: ValidateRollupRoute.description,
      tags: ValidateRollupRoute.tags,
      body: RollupCreateRequestSchema,
      response: {
        200: ValidationResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<ValidationResponse> => {
    const auth = getAuthContext(request);
    const body = request.body;

    logger.debug({ userId: auth.userId, name: body.name }, 'Validating rollup configuration');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    try {
      const rollupService = getRollupService();
      const result = await rollupService.validateConfiguration(
        createTenantId(tenantId),
        body
      );

      return {
        success: true,
        data: {
          isValid: result.isValid,
          errors: result.errors.map((e) => ({
            code: e.code,
            message: e.message,
            path: e.path,
            value: e.value,
          })),
          warnings: result.warnings.map((w) => ({
            code: w.code,
            message: w.message,
            path: w.path,
            suggestion: w.suggestion,
          })),
        },
      };
    } catch (error) {
      handleRollupError(error);
    }
  });

  logger.info('Rollup routes registered');
};

export default rollupRoutes;

// Export for testing
export { rollupRoutes };

// ============================================================================
// Type Declarations
// ============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    rollupService?: IRollupService;
  }
}
