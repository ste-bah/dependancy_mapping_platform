/**
 * Repository Routes
 * REST endpoints for repository management
 * @module routes/repositories
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import pino from 'pino';
import { GitHubAdapter } from '../adapters/git/github.js';
import type { Repository } from '../adapters/git/interface.js';
import { cloneAndStore, getArchiveDownloadUrl } from '../services/repository-clone.js';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware/error-handler.js';
import { ErrorResponseSchema } from '../types/index.js';
import {
  RepositorySchema,
  RepositoryListResponseSchema,
  CloneRequestSchema,
  CloneResponseSchema,
  WebhookRegisterRequestSchema,
  WebhookResponseSchema,
  RepositoryParamsSchema,
  WebhookParamsSchema,
  ListQueryParamsSchema,
  type RepositoryParams,
  type WebhookParams,
  type ListQueryParams,
  type CloneRequest,
  type WebhookRegisterRequest,
} from '../types/repository.js';
import { query } from '../db/connection.js';

const logger = pino({ name: 'repository-routes' });

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
  list: { max: 60, timeWindow: 60000 },
  get: { max: 120, timeWindow: 60000 },
  clone: { max: 10, timeWindow: 60000 },
  webhook: { max: 20, timeWindow: 60000 },
};

/**
 * Get user's GitHub access token from database
 */
async function getUserGitHubToken(userId: string): Promise<string> {
  const result = await query<{ github_access_token: string }>(
    `SELECT github_access_token FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0 || !result.rows[0].github_access_token) {
    throw new ForbiddenError('GitHub access token not found. Please re-authenticate with GitHub.');
  }

  return result.rows[0].github_access_token;
}

/**
 * Get or create tenant for user
 */
async function getUserTenantId(userId: string): Promise<string> {
  // First try to get existing tenant membership
  const memberResult = await query<{ tenant_id: string }>(
    `SELECT tenant_id FROM tenant_members WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (memberResult.rows.length > 0) {
    return memberResult.rows[0].tenant_id;
  }

  // Create a personal tenant for the user
  const tenantId = crypto.randomUUID();
  await query(
    `INSERT INTO tenants (id, name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [tenantId, 'Personal', `personal-${userId.slice(0, 8)}`, userId]
  );

  await query(
    `INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at)
     VALUES ($1, $2, $3, 'owner', NOW())`,
    [crypto.randomUUID(), tenantId, userId]
  );

  return tenantId;
}

/**
 * Generate webhook secret
 */
function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Repository routes plugin
 */
const repositoryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * List repositories
   * GET /repositories
   */
  fastify.get<{
    Querystring: ListQueryParams;
  }>(
    '/',
    {
      schema: {
        tags: ['Repositories'],
        description: 'List repositories accessible to the authenticated user',
        querystring: ListQueryParamsSchema,
        response: {
          200: RepositoryListResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
      config: {
        rateLimit: RATE_LIMIT_CONFIG.list,
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { page = 1, perPage = 30 } = request.query;

      const accessToken = await getUserGitHubToken(auth.userId);
      const adapter = GitHubAdapter.create(accessToken);

      const repositories = await adapter.listRepositories(auth.userId, page, perPage);

      // Map to response format
      const response = {
        repositories: repositories.map((repo) => ({
          ...repo,
          updatedAt: repo.updatedAt.toISOString(),
        })),
        page,
        perPage,
        hasMore: repositories.length === perPage,
      };

      logger.debug(
        { userId: auth.userId, count: repositories.length, page },
        'Listed repositories'
      );

      return reply.status(200).send(response);
    }
  );

  /**
   * Get repository details
   * GET /repositories/:owner/:name
   */
  fastify.get<{
    Params: RepositoryParams;
  }>(
    '/:owner/:name',
    {
      schema: {
        tags: ['Repositories'],
        description: 'Get repository details',
        params: RepositoryParamsSchema,
        response: {
          200: RepositorySchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
      config: {
        rateLimit: RATE_LIMIT_CONFIG.get,
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { owner, name } = request.params;

      const accessToken = await getUserGitHubToken(auth.userId);
      const adapter = GitHubAdapter.create(accessToken);

      try {
        const repository = await adapter.getRepository(owner, name);

        logger.debug(
          { userId: auth.userId, repo: repository.fullName },
          'Fetched repository'
        );

        return reply.status(200).send({
          ...repository,
          updatedAt: repository.updatedAt.toISOString(),
        });
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) {
          throw new NotFoundError('Repository', `${owner}/${name}`);
        }
        throw error;
      }
    }
  );

  /**
   * Clone repository to storage
   * POST /repositories/:owner/:name/clone
   */
  fastify.post<{
    Params: RepositoryParams;
    Body: CloneRequest;
  }>(
    '/:owner/:name/clone',
    {
      schema: {
        tags: ['Repositories'],
        description: 'Clone repository and store archive in object storage',
        params: RepositoryParamsSchema,
        body: CloneRequestSchema,
        response: {
          200: CloneResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          413: ErrorResponseSchema,
        },
      },
      config: {
        rateLimit: RATE_LIMIT_CONFIG.clone,
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { owner, name } = request.params;
      const { branch, force = false } = request.body || {};

      const accessToken = await getUserGitHubToken(auth.userId);
      const adapter = GitHubAdapter.create(accessToken);
      const tenantId = await getUserTenantId(auth.userId);

      // Get repository details first
      let repository: Repository;
      try {
        repository = await adapter.getRepository(owner, name);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) {
          throw new NotFoundError('Repository', `${owner}/${name}`);
        }
        throw error;
      }

      // Clone and store
      const result = await cloneAndStore(
        repository,
        tenantId,
        accessToken,
        { branch, force }
      );

      // Generate download URL
      const commitSha = result.commitSha;
      const downloadUrl = await getArchiveDownloadUrl(
        tenantId,
        repository.id,
        commitSha
      );

      logger.info(
        {
          userId: auth.userId,
          repo: repository.fullName,
          commitSha,
          cached: result.cached,
        },
        'Repository cloned'
      );

      return reply.status(200).send({
        ...result,
        downloadUrl,
      });
    }
  );

  /**
   * Register webhook
   * POST /repositories/:owner/:name/webhook
   */
  fastify.post<{
    Params: RepositoryParams;
    Body: WebhookRegisterRequest;
  }>(
    '/:owner/:name/webhook',
    {
      schema: {
        tags: ['Repositories'],
        description: 'Register a webhook for repository events',
        params: RepositoryParamsSchema,
        body: WebhookRegisterRequestSchema,
        response: {
          200: WebhookResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
      config: {
        rateLimit: RATE_LIMIT_CONFIG.webhook,
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { owner, name } = request.params;
      const { callbackUrl, events } = request.body;

      // Validate callback URL is HTTPS in production
      if (process.env.NODE_ENV === 'production' && !callbackUrl.startsWith('https://')) {
        throw new ValidationError('Webhook callback URL must use HTTPS in production');
      }

      const accessToken = await getUserGitHubToken(auth.userId);
      const adapter = GitHubAdapter.create(accessToken);
      const tenantId = await getUserTenantId(auth.userId);

      // Get repository details first
      let repository: Repository;
      try {
        repository = await adapter.getRepository(owner, name);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) {
          throw new NotFoundError('Repository', `${owner}/${name}`);
        }
        throw error;
      }

      // Generate webhook secret
      const secret = generateWebhookSecret();

      // Register webhook
      const webhook = await adapter.registerWebhook(
        repository,
        callbackUrl,
        secret,
        events
      );

      // Store webhook info in database
      await query(
        `INSERT INTO repository_webhooks (id, tenant_id, repository_id, webhook_id, callback_url, secret_hash, events, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          crypto.randomUUID(),
          tenantId,
          repository.id,
          webhook.id,
          callbackUrl,
          await hashSecret(secret),
          JSON.stringify(webhook.events),
        ]
      );

      logger.info(
        {
          userId: auth.userId,
          repo: repository.fullName,
          webhookId: webhook.id,
        },
        'Webhook registered'
      );

      return reply.status(200).send(webhook);
    }
  );

  /**
   * Delete webhook
   * DELETE /repositories/:owner/:name/webhook/:id
   */
  fastify.delete<{
    Params: WebhookParams;
  }>(
    '/:owner/:name/webhook/:id',
    {
      schema: {
        tags: ['Repositories'],
        description: 'Delete a webhook from a repository',
        params: WebhookParamsSchema,
        response: {
          204: { type: 'null' },
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
      config: {
        rateLimit: RATE_LIMIT_CONFIG.webhook,
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { owner, name, id: webhookId } = request.params;

      const accessToken = await getUserGitHubToken(auth.userId);
      const adapter = GitHubAdapter.create(accessToken);
      const tenantId = await getUserTenantId(auth.userId);

      // Get repository details first
      let repository: Repository;
      try {
        repository = await adapter.getRepository(owner, name);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) {
          throw new NotFoundError('Repository', `${owner}/${name}`);
        }
        throw error;
      }

      // Verify webhook belongs to tenant
      const webhookResult = await query<{ id: string }>(
        `SELECT id FROM repository_webhooks
         WHERE tenant_id = $1 AND repository_id = $2 AND webhook_id = $3`,
        [tenantId, repository.id, webhookId]
      );

      if (webhookResult.rows.length === 0) {
        throw new NotFoundError('Webhook', webhookId);
      }

      // Delete from GitHub
      await adapter.deleteWebhook(repository, webhookId);

      // Delete from database
      await query(
        `DELETE FROM repository_webhooks WHERE id = $1`,
        [webhookResult.rows[0].id]
      );

      logger.info(
        {
          userId: auth.userId,
          repo: repository.fullName,
          webhookId,
        },
        'Webhook deleted'
      );

      return reply.status(204).send();
    }
  );
};

/**
 * Hash webhook secret for storage
 */
async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default repositoryRoutes;
