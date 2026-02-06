/**
 * API Key Authentication Middleware
 * Validates API keys and sets tenant context
 * @module middleware/api-key-auth
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import pino from 'pino';
import { validateApiKey, updateApiKeyUsage, hasScope } from '../services/api-key.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import type { ApiKeyContext, ApiKeyScope, ApiKeyType } from '../types/api-key.js';

const logger = pino({ name: 'api-key-auth' });

/**
 * API key prefix patterns
 */
const API_KEY_PREFIXES = ['dmp_live_', 'dmp_test_'] as const;

/**
 * Check if a token looks like an API key
 */
function isApiKey(token: string): boolean {
  return API_KEY_PREFIXES.some(prefix => token.startsWith(prefix));
}

/**
 * Extract key type from API key
 */
function getKeyType(key: string): ApiKeyType {
  return key.startsWith('dmp_live_') ? 'live' : 'test';
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [type, token] = authHeader.split(' ');

  if (type.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

/**
 * API key authentication plugin options
 */
interface ApiKeyAuthOptions {
  /**
   * Routes to skip API key authentication
   */
  skipRoutes?: string[];
}

/**
 * Default options
 */
const defaultOptions: Required<ApiKeyAuthOptions> = {
  skipRoutes: [
    '/health',
    '/health/live',
    '/health/ready',
    '/health/detailed',
    '/auth/github',
    '/auth/github/callback',
    '/auth/refresh',
  ],
};

/**
 * API key authentication middleware plugin
 * Validates API keys and decorates request with apiKey context
 */
const apiKeyAuthPlugin: FastifyPluginAsync<ApiKeyAuthOptions> = async (
  fastify: FastifyInstance,
  opts: ApiKeyAuthOptions
): Promise<void> => {
  const options = { ...defaultOptions, ...opts };

  // Decorate request with apiKey property
  fastify.decorateRequest('apiKey', undefined);

  // Add preHandler hook to validate API keys
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Skip authentication for excluded routes
    const routePath = request.routeOptions?.url || request.url;
    if (options.skipRoutes.some((route) => routePath.startsWith(route))) {
      return;
    }

    const token = extractBearerToken(request);

    if (!token) {
      // No token present - let route handler decide if auth is required
      return;
    }

    // Only process if token looks like an API key
    if (!isApiKey(token)) {
      // Not an API key - might be a JWT, skip API key validation
      return;
    }

    try {
      const result = await validateApiKey(token);

      if (!result.valid || !result.apiKey) {
        throw new UnauthorizedError('Invalid API key');
      }

      // Update usage tracking (async, don't wait)
      updateApiKeyUsage(result.apiKey.id).catch(err => {
        logger.warn({ err, apiKeyId: result.apiKey?.id }, 'Failed to update API key usage');
      });

      const apiKeyContext: ApiKeyContext = {
        apiKeyId: result.apiKey.id,
        tenantId: result.tenantId!,
        userId: result.userId,
        scopes: result.scopes!,
        keyType: getKeyType(token),
      };

      request.apiKey = apiKeyContext;

      logger.debug(
        { apiKeyId: apiKeyContext.apiKeyId, tenantId: apiKeyContext.tenantId, path: routePath },
        'Request authenticated via API key'
      );
    } catch (error) {
      // Clear any partial context
      request.apiKey = undefined;
      throw error;
    }
  });
};

/**
 * PreHandler hook to require API key authentication
 * Use this on protected routes
 */
export async function requireApiKey(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!request.apiKey) {
    throw new UnauthorizedError('API key required');
  }
}

/**
 * PreHandler hook to require specific scope
 * Use this on routes that need specific permissions
 */
export function requireScope(requiredScope: ApiKeyScope) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.apiKey) {
      throw new UnauthorizedError('API key required');
    }

    if (!hasScope(request.apiKey.scopes, requiredScope)) {
      throw new ForbiddenError(`Insufficient permissions. Required scope: ${requiredScope}`);
    }
  };
}

/**
 * PreHandler hook to require live API key (not test)
 * Use this on production-only endpoints
 */
export async function requireLiveKey(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!request.apiKey) {
    throw new UnauthorizedError('API key required');
  }

  if (request.apiKey.keyType !== 'live') {
    throw new ForbiddenError('This endpoint requires a live API key');
  }
}

/**
 * Get API key context from request (throws if not authenticated)
 */
export function getApiKeyContext(request: FastifyRequest): ApiKeyContext {
  if (!request.apiKey) {
    throw new UnauthorizedError('API key required');
  }
  return request.apiKey;
}

export default fp(apiKeyAuthPlugin, {
  name: 'api-key-auth',
  fastify: '4.x',
  dependencies: ['error-handler'],
});
