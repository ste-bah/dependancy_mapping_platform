/**
 * Base Repository Implementation
 * @module repositories/base-repository
 *
 * Provides common database operations and utilities for all repositories.
 * Implements connection pooling, parameterized queries, and transaction support.
 *
 * TASK-DETECT: Base data layer implementation
 */

import pg from 'pg';
import pino from 'pino';
import { TenantId } from '../types/entities.js';
import {
  PaginationParams,
  PaginatedResult,
  SortParams,
  BatchResult,
  ITransactionClient,
} from './interfaces.js';
import { getPool } from '../db/connection.js';

// Pino logger is used per-instance in the class constructor

// ============================================================================
// Types
// ============================================================================

/**
 * Query options
 */
export interface QueryOptions {
  readonly client?: pg.PoolClient;
  readonly tenantId?: TenantId;
}

/**
 * Column mapping for snake_case to camelCase conversion
 */
export type ColumnMapping = Record<string, string>;

// ============================================================================
// Base Repository Class
// ============================================================================

/**
 * Base repository with common database operations
 */
export abstract class BaseRepository {
  protected readonly pool: pg.Pool;
  protected readonly logger: pino.Logger;

  constructor(protected readonly tableName: string) {
    this.pool = getPool();
    this.logger = pino({ name: `repository:${tableName}` });
  }

  // ============================================================================
  // Query Execution
  // ============================================================================

  /**
   * Execute a parameterized query
   */
  protected async query<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    const client = options?.client ?? this.pool;

    try {
      // Set tenant context if provided
      if (options?.tenantId) {
        await client.query(
          `SELECT set_config('app.current_tenant_id', $1, true)`,
          [options.tenantId]
        );
      }

      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;

      this.logger.debug(
        { duration, rows: result.rowCount, table: this.tableName },
        'Query executed'
      );

      return result;
    } catch (error) {
      this.logger.error(
        { error, text, table: this.tableName },
        'Query failed'
      );
      throw error;
    }
  }

  /**
   * Execute a query and return first row or null
   */
  protected async queryOne<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, options);
    return result.rows[0] ?? null;
  }

  /**
   * Execute a query and return all rows
   */
  protected async queryAll<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<T[]> {
    const result = await this.query<T>(text, params, options);
    return result.rows;
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  /**
   * Get a client for transaction
   */
  protected async getClient(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute operations in a transaction
   */
  protected async withTransaction<T>(
    fn: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a transaction client adapter
   */
  protected createTransactionClient(client: pg.PoolClient): ITransactionClient {
    return {
      async query<T>(text: string, params?: unknown[]): Promise<T[]> {
        const result = await client.query<T & pg.QueryResultRow>(text, params);
        return result.rows;
      },
      async queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
        const result = await client.query<T & pg.QueryResultRow>(text, params);
        return result.rows[0] ?? null;
      },
    };
  }

  // ============================================================================
  // Pagination Support
  // ============================================================================

  /**
   * Execute a paginated query
   */
  protected async queryPaginated<T extends pg.QueryResultRow>(
    baseQuery: string,
    countQuery: string,
    params: unknown[],
    pagination: PaginationParams,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>> {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    // Add pagination to query
    const paginatedQuery = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const paginatedParams = [...params, pageSize, offset];

    // Execute queries in parallel
    const [dataResult, countResult] = await Promise.all([
      this.queryAll<T>(paginatedQuery, paginatedParams, options),
      this.queryOne<{ count: string }>(countQuery, params, options),
    ]);

    const total = parseInt(countResult?.count ?? '0', 10);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dataResult,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Build ORDER BY clause
   */
  protected buildOrderByClause<T>(
    sort?: SortParams<T>,
    defaultColumn = 'created_at',
    defaultDirection: 'asc' | 'desc' = 'desc'
  ): string {
    if (!sort) {
      return `ORDER BY ${defaultColumn} ${defaultDirection.toUpperCase()}`;
    }

    const column = this.camelToSnake(String(sort.field));
    const direction = sort.direction.toUpperCase();

    return `ORDER BY ${this.sanitizeColumn(column)} ${direction}`;
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Execute batch insert with chunking
   */
  protected async batchInsertWithChunks<T>(
    items: T[],
    columns: string[],
    valueMapper: (item: T, index: number) => unknown[],
    chunkSize = 1000
  ): Promise<BatchResult> {
    let inserted = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    // Process in chunks
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      try {
        const result = await this.insertChunk(chunk, columns, valueMapper, i);
        inserted += result;
      } catch (error) {
        // Log individual failures
        chunk.forEach((_, idx) => {
          failed++;
          errors.push({
            index: i + idx,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    return { inserted, updated: 0, failed, errors };
  }

  /**
   * Insert a chunk of items
   */
  private async insertChunk<T>(
    chunk: T[],
    columns: string[],
    valueMapper: (item: T, index: number) => unknown[],
    startIndex: number
  ): Promise<number> {
    if (chunk.length === 0) return 0;

    const valuesPerRow = columns.length;
    const valuePlaceholders: string[] = [];
    const allValues: unknown[] = [];

    chunk.forEach((item, idx) => {
      const rowValues = valueMapper(item, startIndex + idx);
      const startParamIndex = idx * valuesPerRow + 1;
      const placeholders = rowValues.map((_, i) => `$${startParamIndex + i}`);
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
      allValues.push(...rowValues);
    });

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT DO NOTHING
    `;

    const result = await this.query(query, allValues);
    return result.rowCount ?? 0;
  }

  /**
   * Execute batch upsert
   */
  protected async batchUpsert<T>(
    items: T[],
    columns: string[],
    conflictColumns: string[],
    updateColumns: string[],
    valueMapper: (item: T, index: number) => unknown[],
    chunkSize = 1000
  ): Promise<BatchResult> {
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      try {
        const result = await this.upsertChunk(
          chunk,
          columns,
          conflictColumns,
          updateColumns,
          valueMapper,
          i
        );
        inserted += result.inserted;
        updated += result.updated;
      } catch (error) {
        chunk.forEach((_, idx) => {
          failed++;
          errors.push({
            index: i + idx,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    return { inserted, updated, failed, errors };
  }

  /**
   * Upsert a chunk of items
   */
  private async upsertChunk<T>(
    chunk: T[],
    columns: string[],
    conflictColumns: string[],
    updateColumns: string[],
    valueMapper: (item: T, index: number) => unknown[],
    startIndex: number
  ): Promise<{ inserted: number; updated: number }> {
    if (chunk.length === 0) return { inserted: 0, updated: 0 };

    const valuesPerRow = columns.length;
    const valuePlaceholders: string[] = [];
    const allValues: unknown[] = [];

    chunk.forEach((item, idx) => {
      const rowValues = valueMapper(item, startIndex + idx);
      const startParamIndex = idx * valuesPerRow + 1;
      const placeholders = rowValues.map((_, i) => `$${startParamIndex + i}`);
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
      allValues.push(...rowValues);
    });

    const updateClause = updateColumns
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateClause}
      RETURNING (xmax = 0) AS inserted
    `;

    const result = await this.queryAll<{ inserted: boolean }>(query, allValues);

    const inserted = result.filter(r => r.inserted).length;
    const updated = result.filter(r => !r.inserted).length;

    return { inserted, updated };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Convert camelCase to snake_case
   */
  protected camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  protected snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Sanitize column name to prevent SQL injection
   */
  protected sanitizeColumn(column: string): string {
    // Only allow alphanumeric and underscores
    if (!/^[a-z_][a-z0-9_]*$/i.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    return column;
  }

  /**
   * Map database row to entity
   */
  protected mapRowToEntity<TRow extends Record<string, unknown>, TEntity>(
    row: TRow,
    mapping: ColumnMapping
  ): TEntity {
    const entity: Record<string, unknown> = {};

    for (const [dbColumn, entityField] of Object.entries(mapping)) {
      if (dbColumn in row) {
        entity[entityField] = row[dbColumn];
      }
    }

    return entity as TEntity;
  }

  /**
   * Build WHERE clause from filter object
   */
  protected buildWhereClause(
    filters: Record<string, unknown>,
    startParamIndex = 1
  ): { clause: string; params: unknown[]; nextIndex: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = startParamIndex;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;

      const column = this.sanitizeColumn(this.camelToSnake(key));

      if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`);
        conditions.push(`${column} IN (${placeholders.join(', ')})`);
        params.push(...value);
      } else if (value === null) {
        conditions.push(`${column} IS NULL`);
      } else {
        conditions.push(`${column} = $${paramIndex++}`);
        params.push(value);
      }
    }

    const clause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return { clause, params, nextIndex: paramIndex };
  }

  /**
   * Generate UUID
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }
}
