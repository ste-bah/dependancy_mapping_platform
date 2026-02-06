/**
 * Authentication Middleware
 * JWT verification and request decoration
 * @module middleware/auth
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import pino from 'pino';
import { verifyAccessToken } from '../services/jwt.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import type { AuthContext } from '../types/auth.js';

const logger = pino({ name: 'auth-middleware' });

/**
 * Auth middleware plugin options
 */
interface AuthMiddlewareOptions {
  /**
   * Routes to skip authentication
   */
  skipRoutes?: string[];
}

/**
 * Default options
 */
const defaultOptions: Required<AuthMiddlewareOptions> = {
  skipRoutes: [
    '/health',
    '/health/live',
    '/health/ready',
    '/health/detailed',
    '/auth/github',
    '/auth/github/callback',
  ],
};

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
 * Authentication middleware plugin
 * Verifies JWT and decorates request with auth context
 */
const authMiddlewarePlugin: FastifyPluginAsync<AuthMiddlewareOptions> = async (
  fastify: FastifyInstance,
  opts: AuthMiddlewareOptions
): Promise<void> => {
  const options = { ...defaultOptions, ...opts };

  // Decorate request with auth property
  fastify.decorateRequest('auth', undefined);

  // Add preHandler hook to verify JWT
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Skip authentication for excluded routes
    const routePath = request.routeOptions?.url || request.url;
    if (options.skipRoutes.some((route) => routePath.startsWith(route))) {
      return;
    }

    const token = extractBearerToken(request);

    if (!token) {
      // Auth is optional - let route handler decide if auth is required
      return;
    }

    try {
      const claims = await verifyAccessToken(token);

      const authContext: AuthContext = {
        userId: claims.sub,
        email: claims.email,
        name: claims.name,
        githubId: claims.githubId,
        tenantId: claims.tenantId,
      };

      request.auth = authContext;

      logger.debug({ userId: authContext.userId, path: routePath }, 'Request authenticated');
    } catch (error) {
      // Clear any partial auth context
      request.auth = undefined;
      throw error;
    }
  });
};

/**
 * PreHandler hook to require authentication
 * Use this on protected routes
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!request.auth) {
    throw new UnauthorizedError('Authentication required');
  }
}

/**
 * PreHandler hook to require specific tenant access
 * Use this on tenant-specific routes
 */
export function requireTenant(tenantId: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      throw new UnauthorizedError('Authentication required');
    }

    if (request.auth.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this tenant');
    }
  };
}

/**
 * Get auth context from request (throws if not authenticated)
 */
export function getAuthContext(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new UnauthorizedError('Authentication required');
  }
  return request.auth;
}

export default fp(authMiddlewarePlugin, {
  name: 'auth-middleware',
  fastify: '4.x',
  dependencies: ['error-handler'],
});
