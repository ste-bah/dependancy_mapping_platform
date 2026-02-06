/**
 * Scan Routes
 * @module routes/scans
 *
 * REST API endpoints for IaC dependency scan operations.
 * Implements CRUD operations and status tracking for scans.
 *
 * Endpoints:
 * - POST /api/v1/scans - Start new scan
 * - GET /api/v1/scans - List scans (paginated)
 * - GET /api/v1/scans/:id - Get scan by ID
 * - GET /api/v1/scans/:id/status - Get scan status/progress
 * - DELETE /api/v1/scans/:id - Cancel scan
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../middleware/error-handler.js';
import {
  ScanIdParamSchema,
  UuidParamSchema,
  ErrorResponseSchema,
  createPaginationInfo,
} from './schemas/common.js';
import {
  CreateScanRequestSchema,
  CancelScanRequestSchema,
  ListScansQuerySchema,
  ScanResponseSchema,
  ScanListResponseSchema,
  ScanStatusResponseSchema,
  type CreateScanRequest,
  type CancelScanRequest,
  type ListScansQuery,
  type ScanResponse,
} from './schemas/scan.js';
import { createScanId, ScanStatus } from '../types/entities.js';

const logger = pino({ name: 'scans-routes' });

/**
 * Scan routes plugin
 */
const scanRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * POST /api/v1/scans - Start a new scan
   */
  fastify.post<{
    Body: CreateScanRequest;
  }>('/', {
    schema: {
      description: 'Start a new IaC dependency scan',
      tags: ['Scans'],
      body: CreateScanRequestSchema,
      response: {
        201: ScanResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<ScanResponse> => {
    const auth = getAuthContext(request);
    const { repositoryId, ref, config, priority, callbackUrl } = request.body;

    logger.info({ userId: auth.userId, repositoryId, ref }, 'Creating new scan');

    // Get tenant from auth context
    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject actual scan service and repository
    // For now, return a mock response structure
    const scanId = crypto.randomUUID();
    const now = new Date().toISOString();

    const scan: ScanResponse = {
      id: scanId,
      repositoryId,
      status: 'pending',
      ref: ref || 'main',
      config: {
        detectTypes: config?.detectTypes || ['terraform', 'kubernetes', 'helm'],
        includeImplicit: config?.includeImplicit ?? true,
        minConfidence: config?.minConfidence ?? 40,
        maxDepth: config?.maxDepth ?? 10,
      },
      progress: {
        phase: 'initializing',
        percentage: 0,
        filesProcessed: 0,
        totalFiles: 0,
        nodesDetected: 0,
        edgesDetected: 0,
        errors: 0,
        warnings: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    logger.info({ scanId, repositoryId }, 'Scan created');

    reply.status(201);
    return scan;
  });

  /**
   * GET /api/v1/scans - List scans
   */
  fastify.get<{
    Querystring: ListScansQuery;
  }>('/', {
    schema: {
      description: 'List scans with filtering and pagination',
      tags: ['Scans'],
      querystring: ListScansQuerySchema,
      response: {
        200: ScanListResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const {
      page = 1,
      pageSize = 20,
      repositoryId,
      status,
      ref,
      since,
      until,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = request.query;

    logger.debug({ userId: auth.userId, page, pageSize, status }, 'Listing scans');

    // TODO: Inject actual scan repository
    // Mock response for demonstration
    const scans: ScanResponse[] = [];
    const total = 0;

    return {
      data: scans,
      pagination: createPaginationInfo(page, pageSize, total),
    };
  });

  /**
   * GET /api/v1/scans/:id - Get scan by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', {
    schema: {
      description: 'Get scan details by ID',
      tags: ['Scans'],
      params: UuidParamSchema,
      response: {
        200: ScanResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<ScanResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ scanId: id, userId: auth.userId }, 'Getting scan');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject actual scan repository
    // const scan = await scanRepository.findById(createScanId(id), tenantId);

    // Mock: throw not found for now
    throw new NotFoundError('Scan', id);
  });

  /**
   * GET /api/v1/scans/:id/status - Get scan status/progress
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id/status', {
    schema: {
      description: 'Get lightweight scan status and progress',
      tags: ['Scans'],
      params: UuidParamSchema,
      response: {
        200: ScanStatusResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ scanId: id, userId: auth.userId }, 'Getting scan status');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject actual scan repository/service
    // const scan = await scanRepository.findById(createScanId(id), tenantId);

    // Mock: throw not found for now
    throw new NotFoundError('Scan', id);
  });

  /**
   * DELETE /api/v1/scans/:id - Cancel a running scan
   */
  fastify.delete<{
    Params: { id: string };
    Body: CancelScanRequest;
  }>('/:id', {
    schema: {
      description: 'Cancel a running scan',
      tags: ['Scans'],
      params: UuidParamSchema,
      body: CancelScanRequestSchema,
      response: {
        200: ScanResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<ScanResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const { reason } = request.body || {};

    logger.info({ scanId: id, userId: auth.userId, reason }, 'Cancelling scan');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject actual scan service
    // const scan = await scanRepository.findById(createScanId(id), tenantId);
    // if (!scan) throw new NotFoundError('Scan', id);
    // if (scan.status !== 'running' && scan.status !== 'pending') {
    //   throw new ConflictError(`Cannot cancel scan with status: ${scan.status}`);
    // }
    // await scanService.cancelScan(createScanId(id));

    // Mock: throw not found for now
    throw new NotFoundError('Scan', id);
  });
};

export default scanRoutes;
