/**
 * Launch Checklist Routes
 * @module routes/launch
 *
 * REST API endpoints for launch readiness tracking and checklist management.
 * Implements checklist CRUD, progress tracking, and readiness assessment.
 *
 * Endpoints:
 * - GET /api/v1/launch/checklist - Get launch checklist
 * - POST /api/v1/launch/checklist/target-date - Set target launch date
 * - DELETE /api/v1/launch/checklist/target-date - Clear target launch date
 * - GET /api/v1/launch/items - List checklist items
 * - POST /api/v1/launch/items - Create checklist item
 * - GET /api/v1/launch/items/:itemId - Get checklist item
 * - PUT /api/v1/launch/items/:itemId - Update checklist item
 * - DELETE /api/v1/launch/items/:itemId - Delete checklist item
 * - POST /api/v1/launch/items/:itemId/complete - Complete item
 * - POST /api/v1/launch/items/:itemId/uncomplete - Uncomplete item
 * - POST /api/v1/launch/items/:itemId/blocker - Add blocker
 * - DELETE /api/v1/launch/items/:itemId/blocker/:blockerId - Remove blocker
 * - POST /api/v1/launch/items/bulk/complete - Bulk complete items
 * - POST /api/v1/launch/items/bulk/assign - Bulk assign items
 * - GET /api/v1/launch/summary - Get readiness summary
 * - GET /api/v1/launch/assessment - Get readiness assessment
 * - GET /api/v1/launch/progress - Get progress by category
 * - GET /api/v1/launch/blocked - Get blocked items
 * - GET /api/v1/launch/overdue - Get overdue items
 * - GET /api/v1/launch/critical - Get critical items
 * - POST /api/v1/launch/reset - Reset checklist
 *
 * TASK-FINAL-004: Launch readiness routes implementation
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { ForbiddenError } from '../middleware/error-handler.js';
import { ErrorResponseSchema } from './schemas/common.js';
import {
  CreateChecklistItemRequestSchema,
  UpdateChecklistItemRequestSchema,
  CompleteChecklistItemRequestSchema,
  ListChecklistItemsQuerySchema,
  ChecklistItemResponseSchema,
  ChecklistItemListResponseSchema,
  LaunchChecklistResponseSchema,
  SetTargetLaunchDateRequestSchema,
  AddBlockerRequestSchema,
  BulkCompleteItemsRequestSchema,
  BulkAssignItemsRequestSchema,
  BulkOperationResponseSchema,
  LaunchReadinessSummaryResponseSchema,
  LaunchReadinessAssessmentResponseSchema,
  ProgressByCategoryResponseSchema,
  ServiceErrorResponseSchema,
  ItemIdParamSchema,
  type CreateChecklistItemRequest,
  type UpdateChecklistItemRequest,
  type CompleteChecklistItemRequest,
  type ListChecklistItemsQuery,
  type SetTargetLaunchDateRequest,
  type AddBlockerRequest,
  type BulkCompleteItemsRequest,
  type BulkAssignItemsRequest,
  type ItemIdParam,
} from './schemas/documentation.js';
import { getLaunchReadinessService } from '../services/index.js';
import { Result } from '../domain/documentation/index.js';

const logger = pino({ name: 'launch-routes' });

/**
 * Launch readiness routes plugin
 */
const launchRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  const launchService = getLaunchReadinessService();

  // ==========================================================================
  // Checklist Management
  // ==========================================================================

  /**
   * GET /api/v1/launch/checklist - Get launch checklist
   */
  fastify.get('/checklist', {
    schema: {
      description: 'Get the launch readiness checklist',
      tags: ['Launch Readiness'],
      response: {
        200: LaunchChecklistResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting launch checklist');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const checklist = await launchService.getChecklist();
    return checklist;
  });

  /**
   * POST /api/v1/launch/checklist/target-date - Set target launch date
   */
  fastify.post<{
    Body: SetTargetLaunchDateRequest;
  }>('/checklist/target-date', {
    schema: {
      description: 'Set the target launch date',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      body: SetTargetLaunchDateRequestSchema,
      response: {
        200: LaunchChecklistResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { targetLaunchDate } = request.body;

    logger.info({ userId: auth.userId, targetLaunchDate }, 'Setting target launch date');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.setTargetLaunchDate(targetLaunchDate);

    if (Result.isErr(result)) {
      return reply.status(400).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ targetLaunchDate }, 'Target launch date set');
    return result.value;
  });

  /**
   * DELETE /api/v1/launch/checklist/target-date - Clear target launch date
   */
  fastify.delete('/checklist/target-date', {
    schema: {
      description: 'Clear the target launch date',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      response: {
        200: LaunchChecklistResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.info({ userId: auth.userId }, 'Clearing target launch date');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.clearTargetLaunchDate();

    if (Result.isErr(result)) {
      return reply.status(400).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info('Target launch date cleared');
    return result.value;
  });

  // ==========================================================================
  // Item CRUD Operations
  // ==========================================================================

  /**
   * GET /api/v1/launch/items - List checklist items
   */
  fastify.get<{
    Querystring: ListChecklistItemsQuery;
  }>('/items', {
    schema: {
      description: 'List checklist items with optional filtering',
      tags: ['Launch Readiness'],
      querystring: ListChecklistItemsQuerySchema,
      response: {
        200: ChecklistItemListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const filter = request.query;

    logger.debug({ userId: auth.userId, filter }, 'Listing checklist items');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const items = await launchService.listItems(filter);
    return { data: items };
  });

  /**
   * POST /api/v1/launch/items - Create checklist item
   */
  fastify.post<{
    Body: CreateChecklistItemRequest;
  }>('/items', {
    schema: {
      description: 'Create a new checklist item',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      body: CreateChecklistItemRequestSchema,
      response: {
        201: ChecklistItemResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const dto = request.body;

    logger.info({ userId: auth.userId, category: dto.category }, 'Creating checklist item');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.createItem(dto);

    if (Result.isErr(result)) {
      return reply.status(400).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ itemId: result.value.id }, 'Checklist item created');
    return reply.status(201).send(result.value);
  });

  /**
   * GET /api/v1/launch/items/:itemId - Get checklist item
   */
  fastify.get<{
    Params: ItemIdParam;
  }>('/items/:itemId', {
    schema: {
      description: 'Get checklist item by ID',
      tags: ['Launch Readiness'],
      params: ItemIdParamSchema,
      response: {
        200: ChecklistItemResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemId } = request.params;

    logger.debug({ userId: auth.userId, itemId }, 'Getting checklist item');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const item = await launchService.getItem(itemId);
    if (!item) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    return item;
  });

  /**
   * PUT /api/v1/launch/items/:itemId - Update checklist item
   */
  fastify.put<{
    Params: ItemIdParam;
    Body: UpdateChecklistItemRequest;
  }>('/items/:itemId', {
    schema: {
      description: 'Update a checklist item',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      params: ItemIdParamSchema,
      body: UpdateChecklistItemRequestSchema,
      response: {
        200: ChecklistItemResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemId } = request.params;
    const dto = request.body;

    logger.info({ userId: auth.userId, itemId, updates: Object.keys(dto) }, 'Updating checklist item');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.updateItem(itemId, dto);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ itemId }, 'Checklist item updated');
    return result.value;
  });

  /**
   * DELETE /api/v1/launch/items/:itemId - Delete checklist item
   */
  fastify.delete<{
    Params: ItemIdParam;
  }>('/items/:itemId', {
    schema: {
      description: 'Delete a checklist item',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      params: ItemIdParamSchema,
      response: {
        204: { type: 'null' },
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemId } = request.params;

    logger.info({ userId: auth.userId, itemId }, 'Deleting checklist item');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const deleted = await launchService.deleteItem(itemId);

    if (!deleted) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    logger.info({ itemId }, 'Checklist item deleted');
    return reply.status(204).send();
  });

  // ==========================================================================
  // Completion Operations
  // ==========================================================================

  /**
   * POST /api/v1/launch/items/:itemId/complete - Complete item
   */
  fastify.post<{
    Params: ItemIdParam;
    Body: CompleteChecklistItemRequest;
  }>('/items/:itemId/complete', {
    schema: {
      description: 'Complete a checklist item',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      params: ItemIdParamSchema,
      body: CompleteChecklistItemRequestSchema,
      response: {
        200: ChecklistItemResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemId } = request.params;
    const dto = request.body;

    logger.info({ userId: auth.userId, itemId }, 'Completing checklist item');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.completeItem(itemId, {
      completedBy: dto.completedBy ?? auth.userId,
      evidence: dto.evidence,
    });

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ itemId }, 'Checklist item completed');
    return result.value;
  });

  /**
   * POST /api/v1/launch/items/:itemId/uncomplete - Uncomplete item
   */
  fastify.post<{
    Params: ItemIdParam;
  }>('/items/:itemId/uncomplete', {
    schema: {
      description: 'Uncomplete a checklist item',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      params: ItemIdParamSchema,
      response: {
        200: ChecklistItemResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemId } = request.params;

    logger.info({ userId: auth.userId, itemId }, 'Uncompleting checklist item');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.uncompleteItem(itemId);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ itemId }, 'Checklist item uncompleted');
    return result.value;
  });

  // ==========================================================================
  // Blocker Operations
  // ==========================================================================

  /**
   * POST /api/v1/launch/items/:itemId/blocker - Add blocker
   */
  fastify.post<{
    Params: ItemIdParam;
    Body: AddBlockerRequest;
  }>('/items/:itemId/blocker', {
    schema: {
      description: 'Add a blocker to a checklist item',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      params: ItemIdParamSchema,
      body: AddBlockerRequestSchema,
      response: {
        200: ChecklistItemResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemId } = request.params;
    const { blockerId } = request.body;

    logger.info({ userId: auth.userId, itemId, blockerId }, 'Adding blocker');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.addBlocker(itemId, blockerId);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' || result.error.code === 'BLOCKER_NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ itemId, blockerId }, 'Blocker added');
    return result.value;
  });

  /**
   * DELETE /api/v1/launch/items/:itemId/blocker/:blockerId - Remove blocker
   */
  fastify.delete<{
    Params: ItemIdParam & { blockerId: string };
  }>('/items/:itemId/blocker/:blockerId', {
    schema: {
      description: 'Remove a blocker from a checklist item',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          blockerId: { type: 'string' },
        },
        required: ['itemId', 'blockerId'],
      },
      response: {
        200: ChecklistItemResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemId, blockerId } = request.params;

    logger.info({ userId: auth.userId, itemId, blockerId }, 'Removing blocker');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.removeBlocker(itemId, blockerId);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ itemId, blockerId }, 'Blocker removed');
    return result.value;
  });

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * POST /api/v1/launch/items/bulk/complete - Bulk complete items
   */
  fastify.post<{
    Body: BulkCompleteItemsRequest;
  }>('/items/bulk/complete', {
    schema: {
      description: 'Complete multiple checklist items',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      body: BulkCompleteItemsRequestSchema,
      response: {
        200: BulkOperationResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemIds, completedBy, evidence } = request.body;

    logger.info({ userId: auth.userId, itemIds }, 'Bulk completing items');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.bulkCompleteItems(itemIds, {
      completedBy: completedBy ?? auth.userId,
      evidence,
    });

    logger.info({ successful: result.successful.length, failed: result.failed.length }, 'Bulk complete finished');
    return result;
  });

  /**
   * POST /api/v1/launch/items/bulk/assign - Bulk assign items
   */
  fastify.post<{
    Body: BulkAssignItemsRequest;
  }>('/items/bulk/assign', {
    schema: {
      description: 'Assign multiple checklist items',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      body: BulkAssignItemsRequestSchema,
      response: {
        200: BulkOperationResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { itemIds, assignee } = request.body;

    logger.info({ userId: auth.userId, itemIds, assignee }, 'Bulk assigning items');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await launchService.bulkAssignItems(itemIds, assignee);

    logger.info({ successful: result.successful.length, failed: result.failed.length }, 'Bulk assign finished');
    return result;
  });

  // ==========================================================================
  // Readiness Assessment
  // ==========================================================================

  /**
   * GET /api/v1/launch/summary - Get readiness summary
   */
  fastify.get('/summary', {
    schema: {
      description: 'Get launch readiness summary',
      tags: ['Launch Readiness'],
      response: {
        200: LaunchReadinessSummaryResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting readiness summary');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const summary = await launchService.getReadinessSummary();
    return summary;
  });

  /**
   * GET /api/v1/launch/assessment - Get readiness assessment
   */
  fastify.get('/assessment', {
    schema: {
      description: 'Get launch readiness assessment with recommendations',
      tags: ['Launch Readiness'],
      response: {
        200: LaunchReadinessAssessmentResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting readiness assessment');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const assessment = await launchService.assessLaunchReadiness();
    return assessment;
  });

  /**
   * GET /api/v1/launch/progress - Get progress by category
   */
  fastify.get('/progress', {
    schema: {
      description: 'Get progress by category',
      tags: ['Launch Readiness'],
      response: {
        200: ProgressByCategoryResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting progress by category');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const progress = await launchService.getProgressByCategory();
    return { data: progress };
  });

  /**
   * GET /api/v1/launch/blocked - Get blocked items
   */
  fastify.get('/blocked', {
    schema: {
      description: 'Get blocked checklist items',
      tags: ['Launch Readiness'],
      response: {
        200: ChecklistItemListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting blocked items');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const items = await launchService.getBlockedItems();
    return { data: items };
  });

  /**
   * GET /api/v1/launch/overdue - Get overdue items
   */
  fastify.get('/overdue', {
    schema: {
      description: 'Get overdue checklist items',
      tags: ['Launch Readiness'],
      response: {
        200: ChecklistItemListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting overdue items');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const items = await launchService.getOverdueItems();
    return { data: items };
  });

  /**
   * GET /api/v1/launch/critical - Get critical items
   */
  fastify.get('/critical', {
    schema: {
      description: 'Get critical checklist items',
      tags: ['Launch Readiness'],
      response: {
        200: ChecklistItemListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting critical items');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const items = await launchService.getCriticalItems();
    return { data: items };
  });

  /**
   * POST /api/v1/launch/reset - Reset checklist
   */
  fastify.post('/reset', {
    schema: {
      description: 'Reset the launch checklist (admin only)',
      tags: ['Launch Readiness'],
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.warn({ userId: auth.userId }, 'Resetting launch checklist');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    await launchService.resetChecklist();

    logger.info('Launch checklist reset');
    return { success: true };
  });
};

export default launchRoutes;
