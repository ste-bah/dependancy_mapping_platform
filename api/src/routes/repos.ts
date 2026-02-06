/**
 * Managed Repository Routes for IaC Scanning
 * @module routes/repos
 *
 * REST API endpoints for managing repositories registered for IaC scanning.
 * This is separate from the GitHub repository access routes (repositories.ts).
 *
 * Endpoints:
 * - GET /api/v1/iac/repositories - List managed repositories
 * - POST /api/v1/iac/repositories - Add repository for scanning
 * - GET /api/v1/iac/repositories/:id - Get managed repository by ID
 * - PATCH /api/v1/iac/repositories/:id - Update managed repository settings
 * - DELETE /api/v1/iac/repositories/:id - Remove repository from scanning
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../middleware/error-handler.js';
import {
  UuidParamSchema,
  ErrorResponseSchema,
  createPaginationInfo,
} from './schemas/common.js';
import {
  AddRepositoryRequestSchema,
  UpdateRepositoryRequestSchema,
  ListRepositoriesQuerySchema,
  RepositoryResponseSchema,
  RepositoryListResponseSchema,
  RepositoryDeletedResponseSchema,
  type AddRepositoryRequest,
  type UpdateRepositoryRequest,
  type ListRepositoriesQuery,
  type RepositoryResponse,
  type RepositoryListResponse,
  type RepositoryDeletedResponse,
} from './schemas/repository.js';

const logger = pino({ name: 'repository-routes' });

/**
 * Repository routes plugin
 */
const repositoryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * GET /api/v1/repositories - List repositories
   */
  fastify.get<{
    Querystring: ListRepositoriesQuery;
  }>('/', {
    schema: {
      description: 'List repositories with filtering and pagination',
      tags: ['Repositories'],
      querystring: ListRepositoriesQuerySchema,
      response: {
        200: RepositoryListResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<RepositoryListResponse> => {
    const auth = getAuthContext(request);
    const {
      page = 1,
      pageSize = 20,
      provider,
      owner,
      search,
      hasWebhook,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = request.query;

    logger.debug({ userId: auth.userId, page, provider, search }, 'Listing repositories');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject repository service
    // const filter = { provider, owner, search, hasWebhook };
    // const result = await repositoryRepository.findByTenant(tenantId, filter, { page, pageSize });

    return {
      data: [],
      pagination: createPaginationInfo(page, pageSize, 0),
    };
  });

  /**
   * POST /api/v1/repositories - Add a repository
   */
  fastify.post<{
    Body: AddRepositoryRequest;
  }>('/', {
    schema: {
      description: 'Add a repository to be scanned',
      tags: ['Repositories'],
      body: AddRepositoryRequestSchema,
      response: {
        201: RepositoryResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<RepositoryResponse> => {
    const auth = getAuthContext(request);
    const { provider, owner, name, enableWebhook = false, autoScan = false } = request.body;

    logger.info({ userId: auth.userId, provider, owner, name }, 'Adding repository');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // Validate provider-specific formats
    if (provider === 'github' && !owner.match(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/)) {
      throw new ValidationError('Invalid GitHub owner format');
    }

    // TODO: Inject repository service
    // 1. Check if repository already exists
    // const existing = await repositoryRepository.findByFullName(tenantId, provider, `${owner}/${name}`);
    // if (existing) throw new ConflictError('Repository already added');

    // 2. Fetch repository info from provider API
    // const repoInfo = await githubClient.getRepository(owner, name);

    // 3. Create repository record
    // const repository = await repositoryRepository.create({...});

    // 4. Optionally register webhook
    // if (enableWebhook) { await webhookService.register(repository); }

    // 5. Optionally trigger initial scan
    // if (autoScan) { await scanService.startScan({...}); }

    // Mock response
    const now = new Date().toISOString();
    const repoId = crypto.randomUUID();

    const repository: RepositoryResponse = {
      id: repoId,
      provider,
      providerId: `${provider}-${Date.now()}`,
      owner,
      name,
      fullName: `${owner}/${name}`,
      defaultBranch: 'main',
      cloneUrl: `https://${provider}.com/${owner}/${name}.git`,
      htmlUrl: `https://${provider}.com/${owner}/${name}`,
      isPrivate: false,
      isArchived: false,
      webhookEnabled: enableWebhook,
      createdAt: now,
      updatedAt: now,
    };

    logger.info({ repositoryId: repoId, fullName: repository.fullName }, 'Repository added');

    reply.status(201);
    return repository;
  });

  /**
   * GET /api/v1/repositories/:id - Get repository by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', {
    schema: {
      description: 'Get repository details by ID',
      tags: ['Repositories'],
      params: UuidParamSchema,
      response: {
        200: RepositoryResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<RepositoryResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ repositoryId: id, userId: auth.userId }, 'Getting repository');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject repository service
    // const repository = await repositoryRepository.findById(id, tenantId);
    // if (!repository) throw new NotFoundError('Repository', id);

    throw new NotFoundError('Repository', id);
  });

  /**
   * PATCH /api/v1/repositories/:id - Update repository
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdateRepositoryRequest;
  }>('/:id', {
    schema: {
      description: 'Update repository settings',
      tags: ['Repositories'],
      params: UuidParamSchema,
      body: UpdateRepositoryRequestSchema,
      response: {
        200: RepositoryResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<RepositoryResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const updates = request.body;

    logger.info({ repositoryId: id, userId: auth.userId, updates }, 'Updating repository');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject repository service
    // const repository = await repositoryRepository.findById(id, tenantId);
    // if (!repository) throw new NotFoundError('Repository', id);

    // Handle webhook enable/disable
    // if (updates.enableWebhook !== undefined) {
    //   if (updates.enableWebhook && !repository.webhookId) {
    //     await webhookService.register(repository);
    //   } else if (!updates.enableWebhook && repository.webhookId) {
    //     await webhookService.unregister(repository);
    //   }
    // }

    // await repositoryRepository.update(id, tenantId, updates);

    throw new NotFoundError('Repository', id);
  });

  /**
   * DELETE /api/v1/repositories/:id - Remove repository
   */
  fastify.delete<{
    Params: { id: string };
  }>('/:id', {
    schema: {
      description: 'Remove a repository and all its scan data',
      tags: ['Repositories'],
      params: UuidParamSchema,
      response: {
        200: RepositoryDeletedResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply): Promise<RepositoryDeletedResponse> => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ repositoryId: id, userId: auth.userId }, 'Removing repository');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject repository service
    // const repository = await repositoryRepository.findById(id, tenantId);
    // if (!repository) throw new NotFoundError('Repository', id);

    // 1. Unregister webhook if exists
    // if (repository.webhookId) {
    //   await webhookService.unregister(repository);
    // }

    // 2. Delete all scans for this repository (cascade deletes nodes, edges, evidence)
    // const scansDeleted = await scanRepository.deleteByRepository(id, tenantId);

    // 3. Delete repository record
    // await repositoryRepository.delete(id, tenantId);

    throw new NotFoundError('Repository', id);
  });
};

export default repositoryRoutes;
