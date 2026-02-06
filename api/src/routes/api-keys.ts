/**
 * API Key Management Routes
 * CRUD operations for API keys
 * @module routes/api-keys
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import {
  CreateApiKeyRequestSchema,
  CreateApiKeyResponseSchema,
  ListApiKeysResponseSchema,
  RotateApiKeyResponseSchema,
  ApiKeySchema,
  type CreateApiKeyRequest,
  type CreateApiKeyResponse,
  type ListApiKeysResponse,
  type RotateApiKeyResponse,
  type ApiKey,
} from '../types/api-key.js';
import { ErrorResponseSchema } from '../types/index.js';
import {
  createApiKey,
  listApiKeys,
  getApiKey,
  revokeApiKey,
  rotateApiKey,
} from '../services/api-key.js';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { Type, Static } from '@sinclair/typebox';

const logger = pino({ name: 'api-keys-routes' });

/**
 * Rate limiting configuration for key operations
 */
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

/**
 * ID parameter schema
 */
const IdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

type IdParams = Static<typeof IdParamsSchema>;

/**
 * Success response schema
 */
const SuccessResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.Optional(Type.String()),
});

/**
 * API key management routes plugin
 */
const apiKeyRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * List all API keys for the authenticated user's tenant
   * GET /api-keys
   */
  fastify.get<{
    Reply: ListApiKeysResponse;
  }>(
    '/',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'List all API keys',
        description: 'Returns all API keys for the current tenant. Full keys are never returned.',
        response: {
          200: ListApiKeysResponseSchema,
          401: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);

      if (!auth.tenantId) {
        throw new ValidationError('Tenant context required');
      }

      const result = await listApiKeys(auth.tenantId, auth.userId);

      logger.debug(
        { tenantId: auth.tenantId, count: result.total },
        'API keys listed'
      );

      return reply.status(200).send(result);
    }
  );

  /**
   * Create a new API key
   * POST /api-keys
   */
  fastify.post<{
    Body: CreateApiKeyRequest;
    Reply: CreateApiKeyResponse;
  }>(
    '/',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Create a new API key',
        description: 'Creates a new API key. The full key is returned only once in the response.',
        body: CreateApiKeyRequestSchema,
        response: {
          201: CreateApiKeyResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: RATE_LIMIT_MAX,
          timeWindow: RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { name, type, scopes, expiresAt } = request.body;

      if (!auth.tenantId) {
        throw new ValidationError('Tenant context required');
      }

      // Validate expiration date if provided
      let expiresAtDate: Date | undefined;
      if (expiresAt) {
        expiresAtDate = new Date(expiresAt);
        if (expiresAtDate <= new Date()) {
          throw new ValidationError('Expiration date must be in the future');
        }
      }

      const { apiKey, fullKey } = await createApiKey(
        auth.tenantId,
        auth.userId,
        name,
        type,
        scopes || ['read'],
        expiresAtDate
      );

      logger.info(
        { apiKeyId: apiKey.id, tenantId: auth.tenantId, name, type },
        'API key created'
      );

      const response: CreateApiKeyResponse = {
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      };

      return reply.status(201).send(response);
    }
  );

  /**
   * Get a single API key by ID
   * GET /api-keys/:id
   */
  fastify.get<{
    Params: IdParams;
    Reply: ApiKey;
  }>(
    '/:id',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Get API key details',
        description: 'Returns details for a specific API key. The full key is never returned.',
        params: IdParamsSchema,
        response: {
          200: ApiKeySchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { id } = request.params;

      if (!auth.tenantId) {
        throw new ValidationError('Tenant context required');
      }

      const apiKey = await getApiKey(id, auth.tenantId);

      if (!apiKey) {
        throw new NotFoundError('API key', id);
      }

      return reply.status(200).send(apiKey);
    }
  );

  /**
   * Revoke (delete) an API key
   * DELETE /api-keys/:id
   */
  fastify.delete<{
    Params: IdParams;
    Reply: Static<typeof SuccessResponseSchema>;
  }>(
    '/:id',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Revoke an API key',
        description: 'Revokes an API key. The key will immediately stop working.',
        params: IdParamsSchema,
        response: {
          200: SuccessResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: RATE_LIMIT_MAX,
          timeWindow: RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { id } = request.params;

      if (!auth.tenantId) {
        throw new ValidationError('Tenant context required');
      }

      await revokeApiKey(id, auth.tenantId);

      logger.info(
        { apiKeyId: id, tenantId: auth.tenantId, userId: auth.userId },
        'API key revoked'
      );

      return reply.status(200).send({
        success: true,
        message: 'API key revoked successfully',
      });
    }
  );

  /**
   * Rotate an API key (revoke old, create new with same settings)
   * POST /api-keys/:id/rotate
   */
  fastify.post<{
    Params: IdParams;
    Reply: RotateApiKeyResponse;
  }>(
    '/:id/rotate',
    {
      schema: {
        tags: ['API Keys'],
        summary: 'Rotate an API key',
        description: 'Rotates an API key by revoking the old one and creating a new one with the same settings. The new key is returned only once.',
        params: IdParamsSchema,
        response: {
          200: RotateApiKeyResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 10, // More restrictive for rotation
          timeWindow: RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { id } = request.params;

      if (!auth.tenantId) {
        throw new ValidationError('Tenant context required');
      }

      const { apiKey, fullKey } = await rotateApiKey(id, auth.tenantId);

      logger.info(
        { oldKeyId: id, newKeyId: apiKey.id, tenantId: auth.tenantId },
        'API key rotated'
      );

      const response: RotateApiKeyResponse = {
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        rotatedAt: apiKey.createdAt,
      };

      return reply.status(200).send(response);
    }
  );
};

export default apiKeyRoutes;
