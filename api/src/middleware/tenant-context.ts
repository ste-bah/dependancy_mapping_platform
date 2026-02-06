/**
 * Tenant Context Middleware
 * Wraps PostgreSQL Row-Level Security tenant functions
 * @module middleware/tenant-context
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import pino from 'pino';
import { getClient } from '../db/connection.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import type { TenantContext } from '../types/index.js';
import type { PoolClient } from 'pg';

const logger = pino({ name: 'tenant-context' });

/**
 * Tenant context plugin options
 */
interface TenantContextOptions {
  /**
   * Header name for tenant ID
   * @default 'x-tenant-id'
   */
  tenantHeader?: string;

  /**
   * Header name for user ID
   * @default 'x-user-id'
   */
  userHeader?: string;

  /**
   * Routes to skip tenant validation
   */
  skipRoutes?: string[];

  /**
   * Whether tenant context is required
   * @default true
   */
  required?: boolean;
}

/**
 * Default options
 */
const defaultOptions: Required<TenantContextOptions> = {
  tenantHeader: 'x-tenant-id',
  userHeader: 'x-user-id',
  skipRoutes: ['/health', '/health/live', '/health/ready'],
  required: true,
};

/**
 * Set tenant context in PostgreSQL session
 */
async function setTenantContext(
  client: PoolClient,
  tenantId: string,
  userId?: string
): Promise<void> {
  await client.query('SELECT set_tenant_context($1, $2)', [tenantId, userId || null]);
  logger.debug({ tenantId, userId }, 'Tenant context set');
}

/**
 * Clear tenant context in PostgreSQL session
 */
async function clearTenantContext(client: PoolClient): Promise<void> {
  await client.query('SELECT clear_tenant_context()');
  logger.debug('Tenant context cleared');
}

/**
 * Get current tenant ID from PostgreSQL session
 */
async function getCurrentTenant(client: PoolClient): Promise<string | null> {
  const result = await client.query<{ current_tenant_id: string | null }>(
    'SELECT current_tenant_id()'
  );
  return result.rows[0]?.current_tenant_id || null;
}

/**
 * Execute a function within a tenant context
 */
export async function withTenantContext<T>(
  tenantId: string,
  userId: string | undefined,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    await setTenantContext(client, tenantId, userId);
    const result = await fn(client);
    return result;
  } finally {
    await clearTenantContext(client);
    client.release();
  }
}

/**
 * Validate UUID format
 */
function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Tenant context Fastify plugin
 */
const tenantContextPlugin: FastifyPluginAsync<TenantContextOptions> = async (
  fastify: FastifyInstance,
  opts: TenantContextOptions
): Promise<void> => {
  const options = { ...defaultOptions, ...opts };

  // Decorate request with tenant property
  fastify.decorateRequest('tenant', undefined);

  // Add preHandler hook to extract and validate tenant context
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Skip tenant validation for excluded routes
    const routePath = request.routeOptions?.url || request.url;
    if (options.skipRoutes.some(route => routePath.startsWith(route))) {
      return;
    }

    const tenantId = request.headers[options.tenantHeader] as string | undefined;
    const userId = request.headers[options.userHeader] as string | undefined;

    // Check if tenant ID is required
    if (options.required && !tenantId) {
      throw new UnauthorizedError(`Missing required header: ${options.tenantHeader}`);
    }

    // Validate tenant ID format if provided
    if (tenantId) {
      if (!isValidUuid(tenantId)) {
        throw new ForbiddenError(`Invalid tenant ID format: ${tenantId}`);
      }

      // Validate user ID format if provided
      if (userId && !isValidUuid(userId)) {
        throw new ForbiddenError(`Invalid user ID format: ${userId}`);
      }

      // Set tenant context on request
      const tenant: TenantContext = {
        tenantId,
        userId,
      };
      request.tenant = tenant;

      logger.debug({ tenantId, userId, path: routePath }, 'Tenant context attached to request');
    }
  });

  // Add helper methods to fastify instance
  fastify.decorate('withTenantContext', withTenantContext);
  fastify.decorate('setTenantContext', setTenantContext);
  fastify.decorate('clearTenantContext', clearTenantContext);
  fastify.decorate('getCurrentTenant', getCurrentTenant);
};

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    withTenantContext: typeof withTenantContext;
    setTenantContext: typeof setTenantContext;
    clearTenantContext: typeof clearTenantContext;
    getCurrentTenant: typeof getCurrentTenant;
  }
}

export default fp(tenantContextPlugin, {
  name: 'tenant-context',
  fastify: '4.x',
  dependencies: ['error-handler'],
});
