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

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../middleware/error-handler.js';
import {
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
  type ScanStatusResponse,
} from './schemas/scan.js';
import {
  ScanStatus,
  createScanId,
  createRepositoryId,
  createTenantId,
  createUserId,
  type ScanEntity,
  type ScanResultSummary,
} from '../types/entities.js';
import { createScanRepository } from '../repositories/scan-repository.js';
import { query } from '../db/connection.js';

const logger = pino({ name: 'scans-routes' });
const scanRepository = createScanRepository();

interface RepositoryLookupRow {
  id: string;
  default_branch: string;
}

function getTenantId(request: { auth?: { tenantId?: string }; tenant?: { tenantId?: string } }): string {
  const tenantId = request.auth?.tenantId ?? request.tenant?.tenantId;
  if (!tenantId) {
    throw new ForbiddenError('Tenant context required');
  }
  return tenantId;
}

async function getRepositoryForTenant(repositoryId: string, tenantId: string): Promise<RepositoryLookupRow> {
  const result = await query<RepositoryLookupRow>(
    `SELECT id, default_branch FROM repositories WHERE id = $1 AND tenant_id = $2`,
    [repositoryId, tenantId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Repository', repositoryId);
  }

  return result.rows[0];
}

function mapResultSummary(summary?: ScanResultSummary): ScanResponse['resultSummary'] | undefined {
  if (!summary) {
    return undefined;
  }

  return {
    totalNodes: summary.totalNodes,
    totalEdges: summary.totalEdges,
    nodesByType: summary.nodesByType,
    edgesByType: summary.edgesByType,
    filesAnalyzed: summary.filesAnalyzed,
    errorCount: summary.errors.length,
    warningCount: summary.warnings.length,
    confidenceDistribution: summary.confidenceDistribution,
  };
}

function mapScanEntityToResponse(scan: ScanEntity): ScanResponse {
  return {
    id: scan.id,
    repositoryId: scan.repositoryId,
    status: scan.status,
    ref: scan.ref,
    commitSha: scan.commitSha,
    config: {
      detectTypes: [...scan.config.detectTypes],
      includeImplicit: scan.config.includeImplicit,
      minConfidence: scan.config.minConfidence,
      maxDepth: scan.config.maxDepth,
    },
    progress: scan.progress,
    resultSummary: mapResultSummary(scan.resultSummary),
    errorMessage: scan.errorMessage,
    startedAt: scan.startedAt?.toISOString(),
    completedAt: scan.completedAt?.toISOString(),
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}

function estimateTimeRemaining(status: ScanEntity): number | undefined {
  if (!status.startedAt || status.progress.percentage <= 0 || status.progress.percentage >= 100) {
    return undefined;
  }

  const elapsedSeconds = Math.max(1, Math.floor((Date.now() - status.startedAt.getTime()) / 1000));
  const remainingPercentage = 100 - status.progress.percentage;
  return Math.ceil((elapsedSeconds / status.progress.percentage) * remainingPercentage);
}

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
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<ScanResponse> => {
    const auth = getAuthContext(request);
    const { repositoryId, ref, config } = request.body;

    logger.info({ userId: auth.userId, repositoryId, ref }, 'Creating new scan');

    const tenantId = getTenantId(request);
    const repository = await getRepositoryForTenant(repositoryId, tenantId);

    const latestScan = await scanRepository.getLatestForRepository(
      createRepositoryId(repositoryId),
      createTenantId(tenantId)
    );

    if (latestScan && [ScanStatus.PENDING, ScanStatus.QUEUED, ScanStatus.RUNNING].includes(latestScan.status)) {
      throw new ConflictError(`Repository already has an active scan: ${latestScan.id}`);
    }

    const scan = await scanRepository.create({
      tenantId: createTenantId(tenantId),
      repositoryId: createRepositoryId(repository.id),
      initiatedBy: createUserId(auth.userId),
      ref: ref || repository.default_branch || 'main',
      commitSha: '0000000000000000000000000000000000000000',
      config,
    });

    logger.info({ scanId: scan.id, repositoryId }, 'Scan created');

    reply.status(201);
    return mapScanEntityToResponse(scan);
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
  }, async (request) => {
    const auth = getAuthContext(request);
    const {
      page = 1,
      pageSize = 20,
      repositoryId,
      status,
      since,
      until,
    } = request.query;

    logger.debug({ userId: auth.userId, page, pageSize, status }, 'Listing scans');

    const tenantId = getTenantId(request);
    const result = repositoryId
      ? await scanRepository.findByRepository(
          createRepositoryId(repositoryId),
          createTenantId(tenantId),
          { page, pageSize }
        )
      : await scanRepository.findByTenant(
          createTenantId(tenantId),
          {
            repositoryId: repositoryId ? createRepositoryId(repositoryId) : undefined,
            status,
            startedAfter: since ? new Date(since) : undefined,
            startedBefore: until ? new Date(until) : undefined,
          },
          { page, pageSize }
        );

    return {
      data: result.data.map(mapScanEntityToResponse),
      pagination: createPaginationInfo(page, pageSize, result.total),
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
  }, async (request): Promise<ScanResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ scanId: id, userId: auth.userId }, 'Getting scan');

    const tenantId = getTenantId(request);
    const scan = await scanRepository.findById(createScanId(id), createTenantId(tenantId));

    if (!scan) {
      throw new NotFoundError('Scan', id);
    }

    return mapScanEntityToResponse(scan);
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
  }, async (request): Promise<ScanStatusResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ scanId: id, userId: auth.userId }, 'Getting scan status');

    const tenantId = getTenantId(request);
    const scan = await scanRepository.findById(createScanId(id), createTenantId(tenantId));

    if (!scan) {
      throw new NotFoundError('Scan', id);
    }

    return {
      id: scan.id,
      status: scan.status,
      progress: scan.progress,
      startedAt: scan.startedAt?.toISOString(),
      estimatedTimeRemaining: estimateTimeRemaining(scan),
    };
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
  }, async (request): Promise<ScanResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const { reason } = request.body || {};

    logger.info({ scanId: id, userId: auth.userId, reason }, 'Cancelling scan');

    const tenantId = getTenantId(request);
    const scan = await scanRepository.findById(createScanId(id), createTenantId(tenantId));

    if (!scan) {
      throw new NotFoundError('Scan', id);
    }

    if (![ScanStatus.PENDING, ScanStatus.QUEUED, ScanStatus.RUNNING].includes(scan.status)) {
      throw new ConflictError(`Cannot cancel scan with status: ${scan.status}`);
    }

    const updated = await scanRepository.update(
      createScanId(id),
      createTenantId(tenantId),
      {
        status: ScanStatus.CANCELLED,
        completedAt: new Date(),
        errorMessage: reason || 'Cancelled by user',
        progress: {
          ...scan.progress,
          phase: 'failed',
        },
      }
    );

    return mapScanEntityToResponse(updated);
  });
};

export default scanRoutes;
