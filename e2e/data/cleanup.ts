/**
 * Data Cleanup Utilities
 * @module e2e/data/cleanup
 *
 * Cleanup utilities for E2E test data:
 * - Per-test cleanup
 * - Full database reset
 * - Orphan data removal
 * - Transaction rollback cleanup
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #23 of 47 | Phase 4: Implementation
 */

import type { Result, AsyncResult } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';
import type { TenantId, RepositoryId, ScanId } from '../../api/src/types/entities.js';
import type { TestDatabase, TransactionId } from '../domain/test-database.js';
import type { TestRunId } from '../types/test-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Cleanup configuration
 */
export interface CleanupConfig {
  /** Tables to clean (in order) */
  readonly tables: ReadonlyArray<string>;
  /** Use CASCADE for foreign key relationships */
  readonly cascade: boolean;
  /** Use TRUNCATE instead of DELETE (faster but resets sequences) */
  readonly useTruncate: boolean;
  /** Preserve specific IDs */
  readonly preserveIds?: PreserveConfig;
  /** Verbose logging */
  readonly verbose: boolean;
  /** Timeout in milliseconds */
  readonly timeout: number;
}

/**
 * IDs to preserve during cleanup
 */
export interface PreserveConfig {
  readonly tenantIds?: ReadonlyArray<TenantId>;
  readonly repositoryIds?: ReadonlyArray<RepositoryId>;
  readonly scanIds?: ReadonlyArray<ScanId>;
  readonly custom?: Readonly<Record<string, ReadonlyArray<string>>>;
}

/**
 * Default cleanup configuration
 */
export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  tables: [
    'test_results',
    'test_suite_results',
    'test_run_results',
    'test_baselines',
    'test_fixtures',
    'edges',
    'nodes',
    'scans',
    'repositories',
    'users',
    'tenants',
  ],
  cascade: true,
  useTruncate: false,
  verbose: false,
  timeout: 30000,
};

/**
 * Cleanup result
 */
export interface CleanupResult {
  /** Tables cleaned */
  readonly tables: ReadonlyArray<TableCleanupResult>;
  /** Total rows deleted */
  readonly totalDeleted: number;
  /** Duration in milliseconds */
  readonly duration: number;
  /** Whether cleanup was successful */
  readonly success: boolean;
  /** Errors encountered */
  readonly errors: ReadonlyArray<string>;
}

/**
 * Per-table cleanup result
 */
export interface TableCleanupResult {
  readonly table: string;
  readonly deleted: number;
  readonly duration: number;
  readonly error?: string;
}

/**
 * Orphan detection result
 */
export interface OrphanDetectionResult {
  /** Orphaned nodes (no edges) */
  readonly orphanedNodes: number;
  /** Edges with missing source node */
  readonly edgesMissingSource: number;
  /** Edges with missing target node */
  readonly edgesMissingTarget: number;
  /** Scans with no nodes */
  readonly emptyScans: number;
  /** Repositories with no scans */
  readonly emptyRepositories: number;
}

/**
 * Cleanup error
 */
export interface CleanupError {
  readonly code: CleanupErrorCode;
  readonly message: string;
  readonly table?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Error codes
 */
export type CleanupErrorCode =
  | 'DATABASE_ERROR'
  | 'TRANSACTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'PERMISSION_ERROR'
  | 'CONSTRAINT_ERROR';

/**
 * Transaction cleanup handle
 */
export interface TransactionCleanupHandle {
  /** Transaction ID */
  readonly transactionId: TransactionId;
  /** Tables modified in transaction */
  readonly modifiedTables: Set<string>;
  /** Rows inserted (for cleanup) */
  readonly insertedIds: Map<string, string[]>;
  /** Commit the transaction (keeping data) */
  commit(): AsyncResult<void, CleanupError>;
  /** Rollback the transaction (removing data) */
  rollback(): AsyncResult<void, CleanupError>;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Cleanup service interface
 */
export interface ICleanupService {
  /**
   * Clean all test data
   */
  cleanAll(config?: Partial<CleanupConfig>): AsyncResult<CleanupResult, CleanupError>;

  /**
   * Clean specific tables
   */
  cleanTables(tables: ReadonlyArray<string>): AsyncResult<CleanupResult, CleanupError>;

  /**
   * Clean data for a specific test run
   */
  cleanTestRun(runId: TestRunId): AsyncResult<CleanupResult, CleanupError>;

  /**
   * Clean data for a specific tenant
   */
  cleanTenant(tenantId: TenantId): AsyncResult<CleanupResult, CleanupError>;

  /**
   * Clean data for a specific scan
   */
  cleanScan(scanId: ScanId): AsyncResult<CleanupResult, CleanupError>;

  /**
   * Reset database to initial state
   */
  resetDatabase(): AsyncResult<void, CleanupError>;

  /**
   * Detect orphaned data
   */
  detectOrphans(): AsyncResult<OrphanDetectionResult, CleanupError>;

  /**
   * Remove orphaned data
   */
  removeOrphans(): AsyncResult<CleanupResult, CleanupError>;

  /**
   * Begin a cleanup transaction (for test isolation)
   */
  beginCleanupTransaction(): AsyncResult<TransactionCleanupHandle, CleanupError>;

  /**
   * Clean old test data
   */
  cleanOldData(olderThan: Date): AsyncResult<CleanupResult, CleanupError>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Cleanup service implementation
 */
export class CleanupService implements ICleanupService {
  private readonly config: CleanupConfig;

  constructor(
    private readonly database: TestDatabase,
    config?: Partial<CleanupConfig>
  ) {
    this.config = { ...DEFAULT_CLEANUP_CONFIG, ...config };
  }

  // ============================================================================
  // Main Cleanup Methods
  // ============================================================================

  /**
   * Clean all test data
   */
  async cleanAll(config?: Partial<CleanupConfig>): AsyncResult<CleanupResult, CleanupError> {
    const mergedConfig = { ...this.config, ...config };
    const startTime = Date.now();
    const tableResults: TableCleanupResult[] = [];
    const errors: string[] = [];
    let totalDeleted = 0;

    this.log('Starting full cleanup...');

    for (const table of mergedConfig.tables) {
      const tableStart = Date.now();

      try {
        const deleted = await this.cleanTable(table, mergedConfig);
        tableResults.push({
          table,
          deleted,
          duration: Date.now() - tableStart,
        });
        totalDeleted += deleted;
        this.log(`Cleaned ${table}: ${deleted} rows`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${table}: ${errorMsg}`);
        tableResults.push({
          table,
          deleted: 0,
          duration: Date.now() - tableStart,
          error: errorMsg,
        });
      }
    }

    const duration = Date.now() - startTime;
    this.log(`Cleanup complete: ${totalDeleted} total rows in ${duration}ms`);

    return success({
      tables: tableResults,
      totalDeleted,
      duration,
      success: errors.length === 0,
      errors,
    });
  }

  /**
   * Clean specific tables
   */
  async cleanTables(tables: ReadonlyArray<string>): AsyncResult<CleanupResult, CleanupError> {
    return this.cleanAll({ tables });
  }

  /**
   * Clean data for a specific test run
   */
  async cleanTestRun(runId: TestRunId): AsyncResult<CleanupResult, CleanupError> {
    const startTime = Date.now();
    const tableResults: TableCleanupResult[] = [];
    const errors: string[] = [];
    let totalDeleted = 0;

    this.log(`Cleaning test run: ${runId}`);

    const testTables = [
      { table: 'test_results', column: 'run_id' },
      { table: 'test_suite_results', column: 'run_id' },
      { table: 'test_run_results', column: 'run_id' },
    ];

    for (const { table, column } of testTables) {
      try {
        const sql = `DELETE FROM ${table} WHERE ${column} = $1`;
        const result = await this.database.query(sql, [runId]);
        const deleted = result.success ? result.value.rowCount : 0;
        tableResults.push({
          table,
          deleted,
          duration: 0,
        });
        totalDeleted += deleted;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${table}: ${errorMsg}`);
      }
    }

    return success({
      tables: tableResults,
      totalDeleted,
      duration: Date.now() - startTime,
      success: errors.length === 0,
      errors,
    });
  }

  /**
   * Clean data for a specific tenant
   */
  async cleanTenant(tenantId: TenantId): AsyncResult<CleanupResult, CleanupError> {
    const startTime = Date.now();
    const tableResults: TableCleanupResult[] = [];
    const errors: string[] = [];
    let totalDeleted = 0;

    this.log(`Cleaning tenant: ${tenantId}`);

    // Order matters due to foreign keys
    const tenantTables = [
      'edges',
      'nodes',
      'scans',
      'repositories',
      'users',
    ];

    for (const table of tenantTables) {
      try {
        const sql = `DELETE FROM ${table} WHERE tenant_id = $1`;
        const result = await this.database.query(sql, [tenantId]);
        const deleted = result.success ? result.value.rowCount : 0;
        tableResults.push({
          table,
          deleted,
          duration: 0,
        });
        totalDeleted += deleted;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${table}: ${errorMsg}`);
      }
    }

    // Finally delete the tenant
    try {
      const result = await this.database.query(
        `DELETE FROM tenants WHERE id = $1`,
        [tenantId]
      );
      tableResults.push({
        table: 'tenants',
        deleted: result.success ? result.value.rowCount : 0,
        duration: 0,
      });
      totalDeleted += result.success ? result.value.rowCount : 0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`tenants: ${errorMsg}`);
    }

    return success({
      tables: tableResults,
      totalDeleted,
      duration: Date.now() - startTime,
      success: errors.length === 0,
      errors,
    });
  }

  /**
   * Clean data for a specific scan
   */
  async cleanScan(scanId: ScanId): AsyncResult<CleanupResult, CleanupError> {
    const startTime = Date.now();
    const tableResults: TableCleanupResult[] = [];
    const errors: string[] = [];
    let totalDeleted = 0;

    this.log(`Cleaning scan: ${scanId}`);

    // Clean edges first, then nodes, then scan
    const scanTables = ['edges', 'nodes'];

    for (const table of scanTables) {
      try {
        const sql = `DELETE FROM ${table} WHERE scan_id = $1`;
        const result = await this.database.query(sql, [scanId]);
        const deleted = result.success ? result.value.rowCount : 0;
        tableResults.push({
          table,
          deleted,
          duration: 0,
        });
        totalDeleted += deleted;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${table}: ${errorMsg}`);
      }
    }

    // Delete the scan itself
    try {
      const result = await this.database.query(
        `DELETE FROM scans WHERE id = $1`,
        [scanId]
      );
      tableResults.push({
        table: 'scans',
        deleted: result.success ? result.value.rowCount : 0,
        duration: 0,
      });
      totalDeleted += result.success ? result.value.rowCount : 0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`scans: ${errorMsg}`);
    }

    return success({
      tables: tableResults,
      totalDeleted,
      duration: Date.now() - startTime,
      success: errors.length === 0,
      errors,
    });
  }

  /**
   * Reset database to initial state
   */
  async resetDatabase(): AsyncResult<void, CleanupError> {
    this.log('Resetting database...');

    try {
      // Use TRUNCATE for speed if configured
      if (this.config.useTruncate) {
        const tables = this.config.tables.join(', ');
        const cascade = this.config.cascade ? ' CASCADE' : '';
        const result = await this.database.query(
          `TRUNCATE TABLE ${tables}${cascade}`
        );

        if (!result.success) {
          return failure({
            code: 'DATABASE_ERROR',
            message: result.error.message,
          });
        }
      } else {
        // Use clean() method from TestDatabase
        const result = await this.database.clean();
        if (!result.success) {
          return failure({
            code: 'DATABASE_ERROR',
            message: result.error.message,
          });
        }
      }

      this.log('Database reset complete');
      return success(undefined);
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Detect orphaned data
   */
  async detectOrphans(): AsyncResult<OrphanDetectionResult, CleanupError> {
    this.log('Detecting orphaned data...');

    try {
      // Orphaned nodes (no edges)
      const orphanedNodesResult = await this.database.query(`
        SELECT COUNT(*) as count FROM nodes n
        WHERE NOT EXISTS (
          SELECT 1 FROM edges e
          WHERE e.source_node_id = n.id OR e.target_node_id = n.id
        )
      `);

      // Edges with missing source node
      const missingSourceResult = await this.database.query(`
        SELECT COUNT(*) as count FROM edges e
        WHERE NOT EXISTS (
          SELECT 1 FROM nodes n WHERE n.id = e.source_node_id
        )
      `);

      // Edges with missing target node
      const missingTargetResult = await this.database.query(`
        SELECT COUNT(*) as count FROM edges e
        WHERE NOT EXISTS (
          SELECT 1 FROM nodes n WHERE n.id = e.target_node_id
        )
      `);

      // Scans with no nodes
      const emptyScansResult = await this.database.query(`
        SELECT COUNT(*) as count FROM scans s
        WHERE NOT EXISTS (
          SELECT 1 FROM nodes n WHERE n.scan_id = s.id
        )
      `);

      // Repositories with no scans
      const emptyReposResult = await this.database.query(`
        SELECT COUNT(*) as count FROM repositories r
        WHERE NOT EXISTS (
          SELECT 1 FROM scans s WHERE s.repository_id = r.id
        )
      `);

      const getCount = (result: { success: boolean; value?: { rows: Array<{ count: string }> } }) => {
        return result.success && result.value?.rows[0]
          ? parseInt(result.value.rows[0].count, 10)
          : 0;
      };

      return success({
        orphanedNodes: getCount(orphanedNodesResult),
        edgesMissingSource: getCount(missingSourceResult),
        edgesMissingTarget: getCount(missingTargetResult),
        emptyScans: getCount(emptyScansResult),
        emptyRepositories: getCount(emptyReposResult),
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove orphaned data
   */
  async removeOrphans(): AsyncResult<CleanupResult, CleanupError> {
    const startTime = Date.now();
    const tableResults: TableCleanupResult[] = [];
    const errors: string[] = [];
    let totalDeleted = 0;

    this.log('Removing orphaned data...');

    try {
      // Remove edges with missing nodes
      const edgesResult = await this.database.query(`
        DELETE FROM edges e
        WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.source_node_id)
           OR NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.target_node_id)
      `);
      const edgesDeleted = edgesResult.success ? edgesResult.value.rowCount : 0;
      tableResults.push({ table: 'edges (orphaned)', deleted: edgesDeleted, duration: 0 });
      totalDeleted += edgesDeleted;

      // Remove orphaned nodes (optional - nodes without edges may be valid)
      // This is commented out as it may be too aggressive
      // const nodesResult = await this.database.query(`
      //   DELETE FROM nodes n
      //   WHERE NOT EXISTS (
      //     SELECT 1 FROM edges e
      //     WHERE e.source_node_id = n.id OR e.target_node_id = n.id
      //   )
      // `);

      // Remove empty scans
      const scansResult = await this.database.query(`
        DELETE FROM scans s
        WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.scan_id = s.id)
          AND s.status = 'completed'
      `);
      const scansDeleted = scansResult.success ? scansResult.value.rowCount : 0;
      tableResults.push({ table: 'scans (empty)', deleted: scansDeleted, duration: 0 });
      totalDeleted += scansDeleted;

      return success({
        tables: tableResults,
        totalDeleted,
        duration: Date.now() - startTime,
        success: errors.length === 0,
        errors,
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Begin a cleanup transaction (for test isolation)
   */
  async beginCleanupTransaction(): AsyncResult<TransactionCleanupHandle, CleanupError> {
    const txResult = await this.database.beginTransaction();

    if (!txResult.success) {
      return failure({
        code: 'TRANSACTION_ERROR',
        message: txResult.error.message,
      });
    }

    const transactionId = txResult.value;
    const modifiedTables = new Set<string>();
    const insertedIds = new Map<string, string[]>();
    const database = this.database;

    const handle: TransactionCleanupHandle = {
      transactionId,
      modifiedTables,
      insertedIds,

      async commit(): AsyncResult<void, CleanupError> {
        const result = await database.commit(transactionId);
        if (!result.success) {
          return failure({
            code: 'TRANSACTION_ERROR',
            message: result.error.message,
          });
        }
        return success(undefined);
      },

      async rollback(): AsyncResult<void, CleanupError> {
        const result = await database.rollback(transactionId);
        if (!result.success) {
          return failure({
            code: 'TRANSACTION_ERROR',
            message: result.error.message,
          });
        }
        return success(undefined);
      },
    };

    return success(handle);
  }

  /**
   * Clean old test data
   */
  async cleanOldData(olderThan: Date): AsyncResult<CleanupResult, CleanupError> {
    const startTime = Date.now();
    const tableResults: TableCleanupResult[] = [];
    const errors: string[] = [];
    let totalDeleted = 0;

    this.log(`Cleaning data older than: ${olderThan.toISOString()}`);

    // Clean old test results
    const testTables = [
      { table: 'test_results', column: 'start_time' },
      { table: 'test_suite_results', column: 'start_time' },
      { table: 'test_run_results', column: 'start_time' },
    ];

    for (const { table, column } of testTables) {
      try {
        const sql = `DELETE FROM ${table} WHERE ${column} < $1`;
        const result = await this.database.query(sql, [olderThan]);
        const deleted = result.success ? result.value.rowCount : 0;
        tableResults.push({ table, deleted, duration: 0 });
        totalDeleted += deleted;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${table}: ${errorMsg}`);
      }
    }

    // Clean old scans and their data
    try {
      // First get IDs of old scans
      const oldScansResult = await this.database.query<{ id: string }>(
        `SELECT id FROM scans WHERE created_at < $1`,
        [olderThan]
      );

      if (oldScansResult.success && oldScansResult.value.rows.length > 0) {
        const oldScanIds = oldScansResult.value.rows.map(r => r.id);

        // Delete edges for old scans
        const edgesResult = await this.database.query(
          `DELETE FROM edges WHERE scan_id = ANY($1)`,
          [oldScanIds]
        );
        const edgesDeleted = edgesResult.success ? edgesResult.value.rowCount : 0;
        tableResults.push({ table: 'edges (old scans)', deleted: edgesDeleted, duration: 0 });
        totalDeleted += edgesDeleted;

        // Delete nodes for old scans
        const nodesResult = await this.database.query(
          `DELETE FROM nodes WHERE scan_id = ANY($1)`,
          [oldScanIds]
        );
        const nodesDeleted = nodesResult.success ? nodesResult.value.rowCount : 0;
        tableResults.push({ table: 'nodes (old scans)', deleted: nodesDeleted, duration: 0 });
        totalDeleted += nodesDeleted;

        // Delete the old scans
        const scansResult = await this.database.query(
          `DELETE FROM scans WHERE id = ANY($1)`,
          [oldScanIds]
        );
        const scansDeleted = scansResult.success ? scansResult.value.rowCount : 0;
        tableResults.push({ table: 'scans', deleted: scansDeleted, duration: 0 });
        totalDeleted += scansDeleted;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`old scans: ${errorMsg}`);
    }

    return success({
      tables: tableResults,
      totalDeleted,
      duration: Date.now() - startTime,
      success: errors.length === 0,
      errors,
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async cleanTable(table: string, config: CleanupConfig): Promise<number> {
    // Build exclusion clause if preserving IDs
    let whereClause = '';
    const params: unknown[] = [];

    if (config.preserveIds) {
      const exclusions: string[] = [];
      let paramIndex = 1;

      if (table === 'tenants' && config.preserveIds.tenantIds?.length) {
        exclusions.push(`id != ALL($${paramIndex++})`);
        params.push(config.preserveIds.tenantIds);
      }

      if (table === 'repositories' && config.preserveIds.repositoryIds?.length) {
        exclusions.push(`id != ALL($${paramIndex++})`);
        params.push(config.preserveIds.repositoryIds);
      }

      if (table === 'scans' && config.preserveIds.scanIds?.length) {
        exclusions.push(`id != ALL($${paramIndex++})`);
        params.push(config.preserveIds.scanIds);
      }

      // Custom exclusions
      if (config.preserveIds.custom?.[table]) {
        exclusions.push(`id != ALL($${paramIndex++})`);
        params.push(config.preserveIds.custom[table]);
      }

      if (exclusions.length > 0) {
        whereClause = `WHERE ${exclusions.join(' AND ')}`;
      }
    }

    const sql = `DELETE FROM ${table} ${whereClause}`;
    const result = await this.database.query(sql, params);

    return result.success ? result.value.rowCount : 0;
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[CleanupService] ${message}`);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a cleanup service
 */
export function createCleanupService(
  database: TestDatabase,
  config?: Partial<CleanupConfig>
): ICleanupService {
  return new CleanupService(database, config);
}

/**
 * Quick cleanup for tests
 */
export async function quickCleanup(
  database: TestDatabase
): AsyncResult<CleanupResult, CleanupError> {
  const service = createCleanupService(database, { verbose: false });
  return service.cleanAll();
}

/**
 * Create a test isolation wrapper
 * Automatically rolls back changes after test
 */
export async function withTestIsolation<T>(
  database: TestDatabase,
  testFn: () => Promise<T>
): AsyncResult<T, CleanupError> {
  const service = createCleanupService(database);
  const handleResult = await service.beginCleanupTransaction();

  if (!handleResult.success) {
    return failure(handleResult.error);
  }

  const handle = handleResult.value;

  try {
    const result = await testFn();
    // Always rollback to clean up test data
    await handle.rollback();
    return success(result);
  } catch (error) {
    await handle.rollback();
    return failure({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a cleanup schedule configuration
 */
export interface CleanupSchedule {
  /** Retention period for test results (days) */
  readonly testResultRetentionDays: number;
  /** Retention period for old scans (days) */
  readonly scanRetentionDays: number;
  /** Whether to remove orphaned data */
  readonly removeOrphans: boolean;
  /** Run cleanup at this interval (hours) */
  readonly intervalHours: number;
}

/**
 * Default cleanup schedule
 */
export const DEFAULT_CLEANUP_SCHEDULE: CleanupSchedule = {
  testResultRetentionDays: 30,
  scanRetentionDays: 90,
  removeOrphans: true,
  intervalHours: 24,
};

/**
 * Run scheduled cleanup
 */
export async function runScheduledCleanup(
  database: TestDatabase,
  schedule: CleanupSchedule = DEFAULT_CLEANUP_SCHEDULE
): AsyncResult<CleanupResult, CleanupError> {
  const service = createCleanupService(database, { verbose: true });
  const errors: string[] = [];
  const tableResults: TableCleanupResult[] = [];
  let totalDeleted = 0;
  const startTime = Date.now();

  // Clean old test results
  const testResultCutoff = new Date();
  testResultCutoff.setDate(testResultCutoff.getDate() - schedule.testResultRetentionDays);
  const testCleanResult = await service.cleanOldData(testResultCutoff);
  if (testCleanResult.success) {
    totalDeleted += testCleanResult.value.totalDeleted;
    tableResults.push(...testCleanResult.value.tables);
    errors.push(...testCleanResult.value.errors);
  }

  // Remove orphans if configured
  if (schedule.removeOrphans) {
    const orphanResult = await service.removeOrphans();
    if (orphanResult.success) {
      totalDeleted += orphanResult.value.totalDeleted;
      tableResults.push(...orphanResult.value.tables);
      errors.push(...orphanResult.value.errors);
    }
  }

  return success({
    tables: tableResults,
    totalDeleted,
    duration: Date.now() - startTime,
    success: errors.length === 0,
    errors,
  });
}

/**
 * Type guard for CleanupError
 */
export function isCleanupError(value: unknown): value is CleanupError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
