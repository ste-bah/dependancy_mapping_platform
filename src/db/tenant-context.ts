/**
 * @fileoverview Tenant Context Management for PostgreSQL Row-Level Security
 *
 * This module provides TypeScript helpers that wrap PostgreSQL tenant context
 * functions from migration 004 (RLS policies). It enables multi-tenant data
 * isolation by managing the `app.current_tenant_id` session setting.
 *
 * @module db/tenant-context
 * @see migrations/004_rls_policies.sql
 *
 * @example Basic Usage
 * ```typescript
 * import { Pool } from 'pg';
 * import { setTenantContext, withTenantContext } from './tenant-context';
 *
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *
 * // Option 1: Manual context management
 * const client = await pool.connect();
 * try {
 *   await setTenantContext(client, 'tenant-uuid-here');
 *   const result = await client.query('SELECT * FROM repositories');
 *   // Only returns repositories for the specified tenant
 * } finally {
 *   client.release();
 * }
 *
 * // Option 2: Automatic context management (recommended)
 * const repos = await withTenantContext(pool, 'tenant-uuid-here', async (client) => {
 *   const result = await client.query('SELECT * FROM repositories');
 *   return result.rows;
 * });
 * ```
 */

import type { Pool, PoolClient, QueryResult } from 'pg';

/**
 * UUID string type for tenant identifiers.
 * Must be a valid UUID v4 format.
 */
type TenantId = string;

/**
 * Database client interface compatible with both Pool and PoolClient.
 * Allows functions to work with either connection type.
 */
interface DatabaseClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<R>>;
}

/**
 * Express-style request handler for middleware compatibility.
 */
interface Request {
  tenantId?: string;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
}

type NextFunction = (error?: Error) => void;

/**
 * Express-compatible request handler type.
 */
type RequestHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

/**
 * Error thrown when tenant context operations fail.
 */
export class TenantContextError extends Error {
  /** The tenant ID that caused the error, if applicable */
  public readonly tenantId?: string;

  /** The underlying database error, if any */
  public readonly cause?: Error;

  constructor(message: string, tenantId?: string, cause?: Error) {
    super(message);
    this.name = 'TenantContextError';
    this.tenantId = tenantId;
    this.cause = cause;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantContextError);
    }
  }
}

/**
 * Validates that a string is a valid UUID v4 format.
 *
 * @param id - The string to validate
 * @returns True if the string is a valid UUID v4
 *
 * @example
 * ```typescript
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidUUID('not-a-uuid'); // false
 * ```
 */
function isValidUUID(id: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(id);
}

/**
 * Sets the current tenant context for the database session.
 *
 * This calls the PostgreSQL function `set_tenant_id(UUID)` which sets the
 * `app.current_tenant_id` session variable. All subsequent queries on this
 * connection will be filtered by RLS policies to only show data belonging
 * to the specified tenant.
 *
 * @param client - Database client (Pool or PoolClient)
 * @param tenantId - UUID of the tenant to set as current context
 * @throws {TenantContextError} If tenantId is invalid or database operation fails
 *
 * @example
 * ```typescript
 * const client = await pool.connect();
 * try {
 *   await setTenantContext(client, '550e8400-e29b-41d4-a716-446655440000');
 *   // All queries now filtered to this tenant
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function setTenantContext(
  client: Pool | PoolClient | DatabaseClient,
  tenantId: TenantId
): Promise<void> {
  if (!tenantId) {
    throw new TenantContextError('Tenant ID is required', tenantId);
  }

  if (!isValidUUID(tenantId)) {
    throw new TenantContextError(
      `Invalid tenant ID format: "${tenantId}". Must be a valid UUID.`,
      tenantId
    );
  }

  try {
    await client.query('SELECT set_tenant_id($1::UUID)', [tenantId]);
  } catch (error) {
    throw new TenantContextError(
      `Failed to set tenant context for tenant ${tenantId}`,
      tenantId,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Sets the tenant context with validation that the tenant exists.
 *
 * This calls the PostgreSQL function `set_tenant_id_validated(UUID)` which
 * first checks if the tenant exists in the `tenants` table before setting
 * the context. Returns false if the tenant doesn't exist.
 *
 * @param client - Database client (Pool or PoolClient)
 * @param tenantId - UUID of the tenant to validate and set
 * @returns True if tenant exists and context was set, false if tenant not found
 * @throws {TenantContextError} If tenantId is invalid or database operation fails
 *
 * @example
 * ```typescript
 * const client = await pool.connect();
 * try {
 *   const exists = await setTenantContextValidated(client, tenantId);
 *   if (!exists) {
 *     throw new Error('Tenant not found');
 *   }
 *   // Proceed with tenant-scoped operations
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function setTenantContextValidated(
  client: Pool | PoolClient | DatabaseClient,
  tenantId: TenantId
): Promise<boolean> {
  if (!tenantId) {
    throw new TenantContextError('Tenant ID is required', tenantId);
  }

  if (!isValidUUID(tenantId)) {
    throw new TenantContextError(
      `Invalid tenant ID format: "${tenantId}". Must be a valid UUID.`,
      tenantId
    );
  }

  try {
    const result = await client.query<{ set_tenant_id_validated: boolean }>(
      'SELECT set_tenant_id_validated($1::UUID) as set_tenant_id_validated',
      [tenantId]
    );

    return result.rows[0]?.set_tenant_id_validated ?? false;
  } catch (error) {
    throw new TenantContextError(
      `Failed to validate and set tenant context for tenant ${tenantId}`,
      tenantId,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Clears the current tenant context from the database session.
 *
 * This calls the PostgreSQL function `clear_tenant_context()` which resets
 * the `app.current_tenant_id` session variable to an empty string. This is
 * useful for administrative operations that need to bypass RLS or when
 * releasing a connection back to the pool.
 *
 * @param client - Database client (Pool or PoolClient)
 * @throws {TenantContextError} If database operation fails
 *
 * @example
 * ```typescript
 * const client = await pool.connect();
 * try {
 *   await setTenantContext(client, tenantId);
 *   // Do tenant-scoped work...
 * } finally {
 *   await clearTenantContext(client);
 *   client.release();
 * }
 * ```
 */
export async function clearTenantContext(
  client: Pool | PoolClient | DatabaseClient
): Promise<void> {
  try {
    await client.query('SELECT clear_tenant_context()');
  } catch (error) {
    throw new TenantContextError(
      'Failed to clear tenant context',
      undefined,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Retrieves the current tenant ID from the database session.
 *
 * This calls the PostgreSQL function `current_tenant_id()` which returns
 * the UUID currently set in `app.current_tenant_id`, or null if not set.
 *
 * @param client - Database client (Pool or PoolClient)
 * @returns The current tenant UUID or null if not set
 * @throws {TenantContextError} If database operation fails
 *
 * @example
 * ```typescript
 * const currentTenant = await getCurrentTenantId(client);
 * if (currentTenant) {
 *   console.log(`Operating as tenant: ${currentTenant}`);
 * } else {
 *   console.log('No tenant context set');
 * }
 * ```
 */
export async function getCurrentTenantId(
  client: Pool | PoolClient | DatabaseClient
): Promise<string | null> {
  try {
    const result = await client.query<{ current_tenant_id: string | null }>(
      'SELECT current_tenant_id() as current_tenant_id'
    );

    return result.rows[0]?.current_tenant_id ?? null;
  } catch (error) {
    throw new TenantContextError(
      'Failed to get current tenant ID',
      undefined,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Executes a function within a tenant context, automatically managing
 * the connection lifecycle and context cleanup.
 *
 * This is the recommended way to perform tenant-scoped operations as it:
 * - Acquires a connection from the pool
 * - Sets the tenant context
 * - Executes your function
 * - Clears the tenant context
 * - Releases the connection back to the pool
 *
 * @param pool - PostgreSQL connection pool
 * @param tenantId - UUID of the tenant context
 * @param fn - Async function to execute within the tenant context
 * @returns The result of the provided function
 * @throws {TenantContextError} If tenant context operations fail
 * @throws Re-throws any error from the provided function
 *
 * @example
 * ```typescript
 * const repositories = await withTenantContext(
 *   pool,
 *   'tenant-uuid',
 *   async (client) => {
 *     const result = await client.query('SELECT * FROM repositories');
 *     return result.rows;
 *   }
 * );
 * ```
 */
export async function withTenantContext<T>(
  pool: Pool,
  tenantId: TenantId,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await setTenantContext(client, tenantId);
    return await fn(client);
  } finally {
    try {
      await clearTenantContext(client);
    } catch {
      // Log but don't throw - we want to ensure release happens
      console.error('Warning: Failed to clear tenant context before release');
    }
    client.release();
  }
}

/**
 * Executes a function within a tenant context and database transaction,
 * automatically managing commit/rollback and context cleanup.
 *
 * This combines tenant context management with transaction handling:
 * - Acquires a connection from the pool
 * - Sets the tenant context
 * - Begins a transaction
 * - Executes your function
 * - Commits on success, rolls back on error
 * - Clears the tenant context
 * - Releases the connection back to the pool
 *
 * @param pool - PostgreSQL connection pool
 * @param tenantId - UUID of the tenant context
 * @param fn - Async function to execute within the transaction
 * @returns The result of the provided function
 * @throws {TenantContextError} If tenant context operations fail
 * @throws Re-throws any error from the provided function (after rollback)
 *
 * @example
 * ```typescript
 * const newRepo = await withTenantTransaction(
 *   pool,
 *   'tenant-uuid',
 *   async (client) => {
 *     const result = await client.query(
 *       'INSERT INTO repositories (tenant_id, provider, owner, name, clone_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
 *       [tenantId, 'github', 'org', 'repo', 'https://github.com/org/repo']
 *     );
 *     return result.rows[0];
 *   }
 * );
 * ```
 */
export async function withTenantTransaction<T>(
  pool: Pool,
  tenantId: TenantId,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await setTenantContext(client, tenantId);
    await client.query('BEGIN');

    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    try {
      await clearTenantContext(client);
    } catch {
      // Log but don't throw - we want to ensure release happens
      console.error('Warning: Failed to clear tenant context before release');
    }
    client.release();
  }
}

/**
 * Creates an Express-compatible middleware that sets tenant context
 * for each request based on extracted tenant ID.
 *
 * The middleware:
 * - Extracts tenant ID using the provided function
 * - Validates the tenant exists (optional)
 * - Attaches the tenant ID to the request object
 * - Subsequent database operations can use the tenant ID
 *
 * @param pool - PostgreSQL connection pool
 * @param extractTenantId - Function to extract tenant ID from request (headers, JWT, etc.)
 * @param options - Configuration options
 * @param options.validate - Whether to validate tenant exists (default: true)
 * @param options.required - Whether tenant ID is required (default: true)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createTenantMiddleware } from './tenant-context';
 *
 * const app = express();
 *
 * // Extract tenant from X-Tenant-ID header
 * const tenantMiddleware = createTenantMiddleware(
 *   pool,
 *   (req) => req.headers['x-tenant-id'] as string | null,
 *   { validate: true, required: true }
 * );
 *
 * app.use(tenantMiddleware);
 *
 * // Or extract from JWT claims
 * const jwtTenantMiddleware = createTenantMiddleware(
 *   pool,
 *   (req) => (req as { user?: { tenantId?: string } }).user?.tenantId ?? null,
 *   { validate: true }
 * );
 * ```
 */
export function createTenantMiddleware(
  pool: Pool,
  extractTenantId: (req: unknown) => string | null,
  options: {
    validate?: boolean;
    required?: boolean;
  } = {}
): RequestHandler {
  const { validate = true, required = true } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = extractTenantId(req);

      if (!tenantId) {
        if (required) {
          res.status(400).json({
            error: 'Tenant ID is required',
            code: 'TENANT_ID_REQUIRED',
          });
          return;
        }
        // No tenant ID, but not required - proceed without tenant context
        next();
        return;
      }

      if (!isValidUUID(tenantId)) {
        res.status(400).json({
          error: 'Invalid tenant ID format',
          code: 'INVALID_TENANT_ID',
        });
        return;
      }

      if (validate) {
        const client = await pool.connect();
        try {
          const exists = await setTenantContextValidated(client, tenantId);
          if (!exists) {
            res.status(404).json({
              error: 'Tenant not found',
              code: 'TENANT_NOT_FOUND',
            });
            return;
          }
        } finally {
          await clearTenantContext(client);
          client.release();
        }
      }

      // Attach tenant ID to request for downstream handlers
      req.tenantId = tenantId;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Type guard to check if a value is a TenantContextError.
 *
 * @param error - Value to check
 * @returns True if the error is a TenantContextError
 *
 * @example
 * ```typescript
 * try {
 *   await setTenantContext(client, invalidId);
 * } catch (error) {
 *   if (isTenantContextError(error)) {
 *     console.error(`Tenant error for ${error.tenantId}: ${error.message}`);
 *   }
 * }
 * ```
 */
export function isTenantContextError(error: unknown): error is TenantContextError {
  return error instanceof TenantContextError;
}

// Re-export types for consumers
export type { TenantId, DatabaseClient, RequestHandler };
