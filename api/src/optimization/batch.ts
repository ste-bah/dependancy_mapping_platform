/**
 * Performance Optimization: Batch Processing Utilities
 * @module optimization/batch
 *
 * Provides efficient batch processing for:
 * - Database operations (inserts, updates, upserts)
 * - Parallel execution with concurrency control
 * - Stream processing for large datasets
 *
 * TASK-DETECT: Performance optimization implementation
 */

import { getPool } from '../db/connection.js';
import pino from 'pino';

const logger = pino({ name: 'optimization:batch' });

// ============================================================================
// Types
// ============================================================================

/**
 * Batch operation options
 */
export interface BatchOptions {
  /** Batch size for chunked operations */
  readonly batchSize: number;
  /** Maximum concurrent batches */
  readonly concurrency: number;
  /** Whether to continue on error */
  readonly continueOnError: boolean;
  /** Delay between batches (ms) */
  readonly delayBetweenBatches?: number;
}

/**
 * Batch result statistics
 */
export interface BatchResultStats {
  readonly processed: number;
  readonly successful: number;
  readonly failed: number;
  readonly errors: Array<{ index: number; error: string }>;
  readonly durationMs: number;
  readonly itemsPerSecond: number;
}

/**
 * Progress callback for batch operations
 */
export type BatchProgressCallback = (
  processed: number,
  total: number,
  currentBatch: number,
  totalBatches: number
) => void;

/**
 * Default batch options
 */
const DEFAULT_BATCH_OPTIONS: BatchOptions = {
  batchSize: 1000,
  concurrency: 1,
  continueOnError: true,
  delayBetweenBatches: 0,
};

// ============================================================================
// Batch Processor
// ============================================================================

/**
 * Generic batch processor for array operations
 */
export class BatchProcessor<T, R> {
  private readonly options: BatchOptions;

  constructor(options: Partial<BatchOptions> = {}) {
    this.options = { ...DEFAULT_BATCH_OPTIONS, ...options };
  }

  /**
   * Process items in batches with a processor function
   */
  async process(
    items: T[],
    processor: (batch: T[], batchIndex: number) => Promise<R[]>,
    onProgress?: BatchProgressCallback
  ): Promise<{ results: R[]; stats: BatchResultStats }> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    let successful = 0;
    let failed = 0;

    const chunks = this.createChunks(items);
    const totalBatches = chunks.length;

    // Process with concurrency control
    for (let i = 0; i < chunks.length; i += this.options.concurrency) {
      const batchPromises = chunks
        .slice(i, i + this.options.concurrency)
        .map(async (chunk, batchOffset) => {
          const batchIndex = i + batchOffset;
          const startIndex = batchIndex * this.options.batchSize;

          try {
            const batchResults = await processor(chunk, batchIndex);
            results.push(...batchResults);
            successful += chunk.length;
            return { success: true, count: chunk.length };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({ error, batchIndex }, 'Batch processing error');

            chunk.forEach((_, idx) => {
              errors.push({ index: startIndex + idx, error: errorMessage });
            });

            failed += chunk.length;

            if (!this.options.continueOnError) {
              throw error;
            }

            return { success: false, count: 0 };
          }
        });

      await Promise.all(batchPromises);

      // Progress callback
      if (onProgress) {
        const processed = Math.min((i + this.options.concurrency) * this.options.batchSize, items.length);
        const currentBatch = Math.min(i + this.options.concurrency, totalBatches);
        onProgress(processed, items.length, currentBatch, totalBatches);
      }

      // Delay between batches
      if (this.options.delayBetweenBatches && i + this.options.concurrency < chunks.length) {
        await this.delay(this.options.delayBetweenBatches);
      }
    }

    const durationMs = Date.now() - startTime;
    const stats: BatchResultStats = {
      processed: items.length,
      successful,
      failed,
      errors,
      durationMs,
      itemsPerSecond: durationMs > 0 ? (items.length / durationMs) * 1000 : 0,
    };

    return { results, stats };
  }

  /**
   * Create chunks from items array
   */
  private createChunks(items: T[]): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += this.options.batchSize) {
      chunks.push(items.slice(i, i + this.options.batchSize));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Database Batch Operations
// ============================================================================

/**
 * Optimized batch insert using PostgreSQL unnest
 */
export async function batchInsertUnnest<T>(
  tableName: string,
  columns: string[],
  items: T[],
  valueMapper: (item: T) => unknown[],
  options: Partial<BatchOptions> = {}
): Promise<BatchResultStats> {
  const opts = { ...DEFAULT_BATCH_OPTIONS, ...options };
  const pool = getPool();
  const startTime = Date.now();

  let inserted = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];

  // Process in chunks
  for (let i = 0; i < items.length; i += opts.batchSize) {
    const chunk = items.slice(i, i + opts.batchSize);

    try {
      // Build unnest arrays for each column
      const columnArrays: unknown[][] = columns.map(() => []);

      for (const item of chunk) {
        const values = valueMapper(item);
        values.forEach((value, colIndex) => {
          const arr = columnArrays[colIndex];
          if (arr) {
            arr.push(value);
          }
        });
      }

      // Build the query using unnest
      const placeholders = columns.map((_, idx) => {
        const arr = columnArrays[idx];
        const firstValue = arr && arr.length > 0 ? arr[0] : null;
        const type = getPostgresArrayType(firstValue);
        return `$${idx + 1}::${type}[]`;
      });

      const query = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        SELECT * FROM unnest(${placeholders.join(', ')})
        ON CONFLICT DO NOTHING
      `;

      const result = await pool.query(query, columnArrays);
      inserted += result.rowCount ?? 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, batch: i }, 'Batch insert error');

      chunk.forEach((_, idx) => {
        errors.push({ index: i + idx, error: errorMessage });
      });

      failed += chunk.length;

      if (!opts.continueOnError) {
        throw error;
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    processed: items.length,
    successful: inserted,
    failed,
    errors,
    durationMs,
    itemsPerSecond: durationMs > 0 ? (items.length / durationMs) * 1000 : 0,
  };
}

/**
 * Optimized batch upsert using PostgreSQL
 */
export async function batchUpsertUnnest<T>(
  tableName: string,
  columns: string[],
  conflictColumns: string[],
  updateColumns: string[],
  items: T[],
  valueMapper: (item: T) => unknown[],
  options: Partial<BatchOptions> = {}
): Promise<BatchResultStats> {
  const opts = { ...DEFAULT_BATCH_OPTIONS, ...options };
  const pool = getPool();
  const startTime = Date.now();

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < items.length; i += opts.batchSize) {
    const chunk = items.slice(i, i + opts.batchSize);

    try {
      const columnArrays: unknown[][] = columns.map(() => []);

      for (const item of chunk) {
        const values = valueMapper(item);
        values.forEach((value, colIndex) => {
          const arr = columnArrays[colIndex];
          if (arr) {
            arr.push(value);
          }
        });
      }

      const placeholders = columns.map((_, idx) => {
        const arr = columnArrays[idx];
        const firstValue = arr && arr.length > 0 ? arr[0] : null;
        const type = getPostgresArrayType(firstValue);
        return `$${idx + 1}::${type}[]`;
      });

      const updateClause = updateColumns
        .map(col => `${col} = EXCLUDED.${col}`)
        .join(', ');

      const query = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        SELECT * FROM unnest(${placeholders.join(', ')})
        ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateClause}
        RETURNING (xmax = 0) AS is_insert
      `;

      const result = await pool.query(query, columnArrays);

      for (const row of result.rows) {
        if (row.is_insert) {
          inserted++;
        } else {
          updated++;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, batch: i }, 'Batch upsert error');

      chunk.forEach((_, idx) => {
        errors.push({ index: i + idx, error: errorMessage });
      });

      failed += chunk.length;

      if (!opts.continueOnError) {
        throw error;
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    processed: items.length,
    successful: inserted + updated,
    failed,
    errors,
    durationMs,
    itemsPerSecond: durationMs > 0 ? (items.length / durationMs) * 1000 : 0,
  };
}

/**
 * Bulk update using CASE WHEN pattern
 */
export async function bulkUpdateCaseWhen<T>(
  tableName: string,
  idColumn: string,
  updateColumn: string,
  items: Array<{ id: T; value: unknown }>,
  options: Partial<BatchOptions> = {}
): Promise<BatchResultStats> {
  const opts = { ...DEFAULT_BATCH_OPTIONS, ...options };
  const pool = getPool();
  const startTime = Date.now();

  let updated = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < items.length; i += opts.batchSize) {
    const chunk = items.slice(i, i + opts.batchSize);

    try {
      const whenClauses: string[] = [];
      const params: unknown[] = [];

      chunk.forEach((item, idx) => {
        const idParam = idx * 2 + 1;
        const valueParam = idx * 2 + 2;
        whenClauses.push(`WHEN ${idColumn} = $${idParam} THEN $${valueParam}`);
        params.push(item.id, item.value);
      });

      const idPlaceholders = chunk.map((_, idx) => `$${idx * 2 + 1}`).join(', ');

      const query = `
        UPDATE ${tableName}
        SET ${updateColumn} = CASE ${whenClauses.join(' ')} END
        WHERE ${idColumn} IN (${idPlaceholders})
      `;

      const result = await pool.query(query, params);
      updated += result.rowCount ?? 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, batch: i }, 'Bulk update error');

      chunk.forEach((_, idx) => {
        errors.push({ index: i + idx, error: errorMessage });
      });

      failed += chunk.length;

      if (!opts.continueOnError) {
        throw error;
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    processed: items.length,
    successful: updated,
    failed,
    errors,
    durationMs,
    itemsPerSecond: durationMs > 0 ? (items.length / durationMs) * 1000 : 0,
  };
}

// ============================================================================
// Parallel Execution with Concurrency Control
// ============================================================================

/**
 * Execute async operations with controlled concurrency
 */
export async function parallelWithLimit<T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  concurrency: number = 10
): Promise<{ results: R[]; errors: Array<{ index: number; error: unknown }> }> {
  const results: R[] = new Array(items.length);
  const errors: Array<{ index: number; error: unknown }> = [];
  let currentIndex = 0;

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        const item = items[index];

        if (item === undefined) continue;

        try {
          results[index] = await operation(item, index);
        } catch (error) {
          errors.push({ index, error });
        }
      }
    });

  await Promise.all(workers);

  return { results: results.filter(r => r !== undefined), errors };
}

/**
 * Async generator for streaming batch processing
 */
export async function* streamBatch<T, R>(
  items: AsyncIterable<T> | Iterable<T>,
  processor: (batch: T[]) => Promise<R>,
  batchSize: number = 1000
): AsyncGenerator<R> {
  let batch: T[] = [];

  for await (const item of items) {
    batch.push(item);

    if (batch.length >= batchSize) {
      yield await processor(batch);
      batch = [];
    }
  }

  // Process remaining items
  if (batch.length > 0) {
    yield await processor(batch);
  }
}

/**
 * Collect stream into array with optional transform
 */
export async function collectStream<T, R = T>(
  stream: AsyncIterable<T>,
  transform?: (item: T) => R
): Promise<R[]> {
  const results: R[] = [];

  for await (const item of stream) {
    if (transform) {
      results.push(transform(item));
    } else {
      results.push(item as unknown as R);
    }
  }

  return results;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get PostgreSQL array type for a value
 */
function getPostgresArrayType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'text';
  }

  switch (typeof value) {
    case 'string':
      // Check if it looks like a UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return 'uuid';
      }
      return 'text';
    case 'number':
      return Number.isInteger(value) ? 'int' : 'numeric';
    case 'boolean':
      return 'boolean';
    case 'object':
      if (value instanceof Date) {
        return 'timestamp';
      }
      return 'jsonb';
    default:
      return 'text';
  }
}

/**
 * Create a batch insert query with VALUES clause
 */
export function createBatchInsertQuery(
  tableName: string,
  columns: string[],
  rowCount: number
): { query: string; paramCount: number } {
  const rowPlaceholders: string[] = [];
  const valuesPerRow = columns.length;

  for (let row = 0; row < rowCount; row++) {
    const startParam = row * valuesPerRow + 1;
    const placeholders = columns.map((_, i) => `$${startParam + i}`);
    rowPlaceholders.push(`(${placeholders.join(', ')})`);
  }

  const query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES ${rowPlaceholders.join(', ')}
    ON CONFLICT DO NOTHING
  `;

  return { query, paramCount: rowCount * valuesPerRow };
}

/**
 * Split array into chunks
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffFactor, maxDelayMs);
      }
    }
  }

  throw lastError;
}
