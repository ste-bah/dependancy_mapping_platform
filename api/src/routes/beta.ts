/**
 * Beta Onboarding Routes
 * @module routes/beta
 *
 * REST API endpoints for beta customer management and onboarding.
 * Implements customer lifecycle, NDA tracking, and status transitions.
 *
 * Endpoints:
 * - GET /api/v1/beta/customers - List beta customers
 * - POST /api/v1/beta/customers - Register beta customer
 * - GET /api/v1/beta/customers/stats - Get customer statistics
 * - GET /api/v1/beta/customers/:id - Get customer by ID
 * - GET /api/v1/beta/customers/email/:email - Get customer by email
 * - PUT /api/v1/beta/customers/:id - Update customer
 * - DELETE /api/v1/beta/customers/:id - Delete customer
 * - POST /api/v1/beta/customers/:id/nda/sign - Sign NDA
 * - POST /api/v1/beta/customers/:id/nda/revoke - Revoke NDA
 * - POST /api/v1/beta/customers/:id/onboarding/start - Start onboarding
 * - POST /api/v1/beta/customers/:id/onboarding/complete - Complete onboarding
 * - POST /api/v1/beta/customers/:id/churn - Mark as churned
 * - POST /api/v1/beta/customers/:id/reactivate - Reactivate customer
 * - POST /api/v1/beta/customers/:id/feedback - Record feedback
 * - POST /api/v1/beta/customers/:id/activity - Record activity
 *
 * TASK-FINAL-004: Beta onboarding routes implementation
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { ForbiddenError } from '../middleware/error-handler.js';
import { ErrorResponseSchema, createPaginationInfo } from './schemas/common.js';
import {
  RegisterBetaCustomerRequestSchema,
  UpdateBetaCustomerRequestSchema,
  ListBetaCustomersQuerySchema,
  BetaCustomerResponseSchema,
  BetaCustomerListResponseSchema,
  BetaCustomerStatsResponseSchema,
  NDASignatureResponseSchema,
  SignNDARequestSchema,
  RevokeNDARequestSchema,
  OnboardingProgressResponseSchema,
  MarkAsChurnedRequestSchema,
  ServiceErrorResponseSchema,
  IdParamSchema,
  type RegisterBetaCustomerRequest,
  type UpdateBetaCustomerRequest,
  type ListBetaCustomersQuery,
  type SignNDARequest,
  type RevokeNDARequest,
  type MarkAsChurnedRequest,
  type IdParam,
} from './schemas/documentation.js';
import { getBetaOnboardingService } from '../services/index.js';
import { Result } from '../domain/documentation/index.js';

const logger = pino({ name: 'beta-routes' });

/**
 * Beta onboarding routes plugin
 */
const betaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  const betaService = getBetaOnboardingService();

  // ==========================================================================
  // List and Read Operations
  // ==========================================================================

  /**
   * GET /api/v1/beta/customers - List beta customers
   */
  fastify.get<{
    Querystring: ListBetaCustomersQuery;
  }>('/customers', {
    schema: {
      description: 'List beta customers with filtering and pagination',
      tags: ['Beta Onboarding'],
      querystring: ListBetaCustomersQuerySchema,
      response: {
        200: BetaCustomerListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const {
      page = 1,
      pageSize = 20,
      status,
      tier,
      ndaSigned,
      search,
      activeInLast30Days,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = request.query;

    logger.debug({ userId: auth.userId, page, pageSize, status }, 'Listing beta customers');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.listCustomers(
      {
        status,
        tier,
        ndaSigned,
        search,
        activeInLast30Days,
      },
      {
        field: sortBy as 'companyName' | 'createdAt' | 'lastActiveAt' | 'feedbackCount',
        direction: sortOrder as 'asc' | 'desc',
      },
      { page, pageSize }
    );

    return {
      data: result.data,
      pagination: createPaginationInfo(result.page, result.pageSize, result.total),
    };
  });

  /**
   * GET /api/v1/beta/customers/stats - Get beta customer statistics
   */
  fastify.get('/customers/stats', {
    schema: {
      description: 'Get beta customer statistics',
      tags: ['Beta Onboarding'],
      response: {
        200: BetaCustomerStatsResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);

    logger.debug({ userId: auth.userId }, 'Getting beta customer statistics');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const stats = await betaService.getStatistics();
    return stats;
  });

  /**
   * GET /api/v1/beta/customers/:id - Get beta customer by ID
   */
  fastify.get<{
    Params: IdParam;
  }>('/customers/:id', {
    schema: {
      description: 'Get beta customer by ID',
      tags: ['Beta Onboarding'],
      params: IdParamSchema,
      response: {
        200: BetaCustomerResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ userId: auth.userId, customerId: id }, 'Getting beta customer');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const customer = await betaService.getCustomer(id);
    if (!customer) {
      return reply.status(404).send({ error: 'Customer not found' });
    }

    return customer;
  });

  /**
   * GET /api/v1/beta/customers/email/:email - Get beta customer by email
   */
  fastify.get<{
    Params: { email: string };
  }>('/customers/email/:email', {
    schema: {
      description: 'Get beta customer by email',
      tags: ['Beta Onboarding'],
      params: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      },
      response: {
        200: BetaCustomerResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { email } = request.params;

    logger.debug({ userId: auth.userId, email }, 'Getting beta customer by email');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const customer = await betaService.getCustomerByEmail(email);
    if (!customer) {
      return reply.status(404).send({ error: 'Customer not found' });
    }

    return customer;
  });

  // ==========================================================================
  // Create and Update Operations
  // ==========================================================================

  /**
   * POST /api/v1/beta/customers - Register beta customer
   */
  fastify.post<{
    Body: RegisterBetaCustomerRequest;
  }>('/customers', {
    schema: {
      description: 'Register a new beta customer',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      body: RegisterBetaCustomerRequestSchema,
      response: {
        201: BetaCustomerResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const dto = request.body;

    logger.info({ userId: auth.userId, companyName: dto.companyName, email: dto.contactEmail }, 'Registering beta customer');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.registerCustomer(dto);

    if (Result.isErr(result)) {
      logger.warn({ error: result.error }, 'Failed to register beta customer');
      const statusCode = result.error.code === 'DUPLICATE_EMAIL' ? 409 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: result.value.id }, 'Beta customer registered');
    return reply.status(201).send(result.value);
  });

  /**
   * PUT /api/v1/beta/customers/:id - Update beta customer
   */
  fastify.put<{
    Params: IdParam;
    Body: UpdateBetaCustomerRequest;
  }>('/customers/:id', {
    schema: {
      description: 'Update beta customer details',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      body: UpdateBetaCustomerRequestSchema,
      response: {
        200: BetaCustomerResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
        409: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const dto = request.body;

    logger.info({ userId: auth.userId, customerId: id, updates: Object.keys(dto) }, 'Updating beta customer');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.updateCustomer(id, dto);

    if (Result.isErr(result)) {
      let statusCode = 400;
      if (result.error.code === 'NOT_FOUND') statusCode = 404;
      if (result.error.code === 'DUPLICATE_EMAIL') statusCode = 409;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'Beta customer updated');
    return result.value;
  });

  /**
   * DELETE /api/v1/beta/customers/:id - Delete beta customer
   */
  fastify.delete<{
    Params: IdParam;
  }>('/customers/:id', {
    schema: {
      description: 'Delete a beta customer',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
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
    const { id } = request.params;

    logger.info({ userId: auth.userId, customerId: id }, 'Deleting beta customer');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const deleted = await betaService.deleteCustomer(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Customer not found' });
    }

    logger.info({ customerId: id }, 'Beta customer deleted');
    return reply.status(204).send();
  });

  // ==========================================================================
  // NDA Operations
  // ==========================================================================

  /**
   * POST /api/v1/beta/customers/:id/nda/sign - Sign NDA
   */
  fastify.post<{
    Params: IdParam;
    Body: SignNDARequest;
  }>('/customers/:id/nda/sign', {
    schema: {
      description: 'Record NDA signature for a customer',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      body: SignNDARequestSchema,
      response: {
        200: NDASignatureResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const { processedBy } = request.body;

    logger.info({ userId: auth.userId, customerId: id, processedBy }, 'Signing NDA');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.signNDA(id, processedBy ?? auth.userId);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'NDA signed');
    return result.value;
  });

  /**
   * POST /api/v1/beta/customers/:id/nda/revoke - Revoke NDA
   */
  fastify.post<{
    Params: IdParam;
    Body: RevokeNDARequest;
  }>('/customers/:id/nda/revoke', {
    schema: {
      description: 'Revoke NDA for a customer',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      body: RevokeNDARequestSchema,
      response: {
        200: BetaCustomerResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const { reason } = request.body;

    logger.info({ userId: auth.userId, customerId: id, reason }, 'Revoking NDA');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.revokeNDA(id, reason);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'NDA revoked');
    return result.value;
  });

  // ==========================================================================
  // Onboarding Status Operations
  // ==========================================================================

  /**
   * POST /api/v1/beta/customers/:id/onboarding/start - Start onboarding
   */
  fastify.post<{
    Params: IdParam;
  }>('/customers/:id/onboarding/start', {
    schema: {
      description: 'Start onboarding for a customer',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: OnboardingProgressResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, customerId: id }, 'Starting onboarding');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.startOnboarding(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'Onboarding started');
    return result.value;
  });

  /**
   * POST /api/v1/beta/customers/:id/onboarding/complete - Complete onboarding
   */
  fastify.post<{
    Params: IdParam;
  }>('/customers/:id/onboarding/complete', {
    schema: {
      description: 'Complete onboarding for a customer',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: OnboardingProgressResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, customerId: id }, 'Completing onboarding');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.completeOnboarding(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'Onboarding completed');
    return result.value;
  });

  /**
   * POST /api/v1/beta/customers/:id/churn - Mark as churned
   */
  fastify.post<{
    Params: IdParam;
    Body: MarkAsChurnedRequest;
  }>('/customers/:id/churn', {
    schema: {
      description: 'Mark customer as churned',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      body: MarkAsChurnedRequestSchema,
      response: {
        200: BetaCustomerResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const { reason } = request.body;

    logger.info({ userId: auth.userId, customerId: id, reason }, 'Marking customer as churned');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.markAsChurned(id, reason);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'Customer marked as churned');
    return result.value;
  });

  /**
   * POST /api/v1/beta/customers/:id/reactivate - Reactivate customer
   */
  fastify.post<{
    Params: IdParam;
  }>('/customers/:id/reactivate', {
    schema: {
      description: 'Reactivate a churned customer',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: OnboardingProgressResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, customerId: id }, 'Reactivating customer');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.reactivateCustomer(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'Customer reactivated');
    return result.value;
  });

  // ==========================================================================
  // Activity Operations
  // ==========================================================================

  /**
   * POST /api/v1/beta/customers/:id/feedback - Record feedback
   */
  fastify.post<{
    Params: IdParam;
  }>('/customers/:id/feedback', {
    schema: {
      description: 'Record customer feedback',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: BetaCustomerResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, customerId: id }, 'Recording feedback');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.recordFeedback(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ customerId: id }, 'Feedback recorded');
    return result.value;
  });

  /**
   * POST /api/v1/beta/customers/:id/activity - Record activity
   */
  fastify.post<{
    Params: IdParam;
  }>('/customers/:id/activity', {
    schema: {
      description: 'Record customer activity',
      tags: ['Beta Onboarding'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: BetaCustomerResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ userId: auth.userId, customerId: id }, 'Recording activity');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await betaService.recordActivity(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    return result.value;
  });
};

export default betaRoutes;
