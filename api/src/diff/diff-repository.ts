/**
 * Diff Repository Implementation
 * @module diff/diff-repository
 *
 * Implements IDiffRepository for persisting Graph Diff results to the database.
 * Provides CRUD operations for diff entities with multi-tenant isolation,
 * pagination support, and transaction capabilities.
 *
 * TASK-ROLLUP-005: Diff Computation - Database Persistence Layer
 *
 * @example
 * ```typescript
 * const repository = createDiffRepository();
 *
 * // Create a new diff record
 * const entity = await repository.create(graphDiff, tenantId);
 *
 * // Find diffs for a repository
 * const diffs = await repository.findByRepository(repoId, tenantId, {
 *   page: 1,
 *   pageSize: 20,
 * });
 *
 * // Check if diff exists before computing
 * const exists = await repository.exists(baseScanId, compareScanId, tenantId);
 * ```
 */

import pg from 'pg';
import { TenantId } from '../types/entities.js';
import { PaginationParams, PaginatedResult } from '../repositories/interfaces.js';
import { BaseRepository } from '../repositories/base-repository.js';
import {
  DiffId,
  GraphDiff,
  ImpactLevel,
  createDiffId,
  isImpactLevel,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database entity representation of a GraphDiff.
 * Contains denormalized summary counts for efficient querying.
 */
export interface DiffEntity {
  /** Unique diff identifier */
  readonly id: DiffId;
  /** Tenant ID for multi-tenancy isolation */
  readonly tenantId: TenantId;
  /** Repository ID this diff belongs to */
  readonly repositoryId: string;
  /** Base scan ID (the "before" state) */
  readonly baseScanId: string;
  /** Compare scan ID (the "after" state) */
  readonly compareScanId: string;

  // Denormalized summary counts for efficient querying
  /** Count of nodes added in this diff */
  readonly nodesAddedCount: number;
  /** Count of nodes removed in this diff */
  readonly nodesRemovedCount: number;
  /** Count of nodes modified in this diff */
  readonly nodesModifiedCount: number;
  /** Count of edges added in this diff */
  readonly edgesAddedCount: number;
  /** Count of edges removed in this diff */
  readonly edgesRemovedCount: number;
  /** Count of edges modified in this diff */
  readonly edgesModifiedCount: number;

  /** Overall impact assessment level */
  readonly impactAssessment: ImpactLevel;
  /** Time taken to compute the diff in milliseconds */
  readonly computationTimeMs: number;
  /** When the diff was computed */
  readonly computedAt: Date;
  /** When the record was created */
  readonly createdAt: Date;

  /** Full diff data stored as JSONB (optional, may be loaded separately) */
  readonly diffData?: GraphDiff;
}

/**
 * Database row type for graph_diffs table
 */
interface DiffRow {
  id: string;
  tenant_id: string;
  repository_id: string;
  base_scan_id: string;
  compare_scan_id: string;
  nodes_added_count: number;
  nodes_removed_count: number;
  nodes_modified_count: number;
  edges_added_count: number;
  edges_removed_count: number;
  edges_modified_count: number;
  impact_assessment: string;
  computation_time_ms: number;
  computed_at: Date;
  created_at: Date;
  diff_data: Record<string, unknown> | null;
}

/**
 * Repository interface for diff persistence operations.
 * All operations enforce tenant isolation via tenantId parameter.
 */
export interface IDiffRepository {
  /**
   * Create a new diff record from a computed GraphDiff.
   *
   * @param diff - The computed GraphDiff to persist
   * @param tenantId - Tenant ID for isolation
   * @returns Promise resolving to the created DiffEntity
   *
   * @example
   * ```typescript
   * const entity = await repository.create(computedDiff, tenantId);
   * console.log(`Created diff: ${entity.id}`);
   * ```
   */
  create(diff: GraphDiff, tenantId: TenantId): Promise<DiffEntity>;

  /**
   * Find a diff by its ID.
   *
   * @param diffId - The diff ID to find
   * @param tenantId - Tenant ID for isolation
   * @param includeData - Whether to include full diff data (default: true)
   * @returns Promise resolving to DiffEntity or null if not found
   *
   * @example
   * ```typescript
   * const entity = await repository.findById(diffId, tenantId);
   * if (entity) {
   *   console.log(`Impact: ${entity.impactAssessment}`);
   * }
   * ```
   */
  findById(
    diffId: DiffId,
    tenantId: TenantId,
    includeData?: boolean
  ): Promise<DiffEntity | null>;

  /**
   * Find a diff by its scan pair (base + compare scan IDs).
   * Useful for checking if a diff has already been computed.
   *
   * @param baseScanId - Base scan ID
   * @param compareScanId - Compare scan ID
   * @param tenantId - Tenant ID for isolation
   * @param includeData - Whether to include full diff data (default: true)
   * @returns Promise resolving to DiffEntity or null if not found
   *
   * @example
   * ```typescript
   * const existing = await repository.findByScanPair(
   *   baseScanId,
   *   compareScanId,
   *   tenantId
   * );
   * if (existing) {
   *   console.log('Diff already computed');
   *   return existing;
   * }
   * ```
   */
  findByScanPair(
    baseScanId: string,
    compareScanId: string,
    tenantId: TenantId,
    includeData?: boolean
  ): Promise<DiffEntity | null>;

  /**
   * Find all diffs for a repository with pagination.
   *
   * @param repositoryId - Repository ID to find diffs for
   * @param tenantId - Tenant ID for isolation
   * @param pagination - Pagination parameters
   * @param includeData - Whether to include full diff data (default: false for lists)
   * @returns Promise resolving to paginated diff results
   *
   * @example
   * ```typescript
   * const result = await repository.findByRepository(
   *   repositoryId,
   *   tenantId,
   *   { page: 1, pageSize: 20 }
   * );
   * console.log(`Found ${result.total} diffs`);
   * ```
   */
  findByRepository(
    repositoryId: string,
    tenantId: TenantId,
    pagination?: PaginationParams,
    includeData?: boolean
  ): Promise<PaginatedResult<DiffEntity>>;

  /**
   * Find all diffs involving a specific scan (as base or compare).
   *
   * @param scanId - Scan ID to find diffs for
   * @param tenantId - Tenant ID for isolation
   * @returns Promise resolving to array of DiffEntities
   *
   * @example
   * ```typescript
   * const diffs = await repository.findByScan(scanId, tenantId);
   * console.log(`Scan is involved in ${diffs.length} diffs`);
   * ```
   */
  findByScan(scanId: string, tenantId: TenantId): Promise<DiffEntity[]>;

  /**
   * Delete a diff by ID.
   *
   * @param diffId - The diff ID to delete
   * @param tenantId - Tenant ID for isolation
   * @returns Promise that resolves when deletion is complete
   *
   * @example
   * ```typescript
   * await repository.delete(diffId, tenantId);
   * ```
   */
  delete(diffId: DiffId, tenantId: TenantId): Promise<void>;

  /**
   * Delete all diffs involving a specific scan.
   * Useful when a scan is being deleted.
   *
   * @param scanId - Scan ID to delete diffs for
   * @param tenantId - Tenant ID for isolation
   * @returns Promise resolving to the number of deleted diffs
   *
   * @example
   * ```typescript
   * const count = await repository.deleteByScan(scanId, tenantId);
   * console.log(`Deleted ${count} diffs`);
   * ```
   */
  deleteByScan(scanId: string, tenantId: TenantId): Promise<number>;

  /**
   * Check if a diff exists for a scan pair.
   * More efficient than findByScanPair when you only need to check existence.
   *
   * @param baseScanId - Base scan ID
   * @param compareScanId - Compare scan ID
   * @param tenantId - Tenant ID for isolation
   * @returns Promise resolving to true if diff exists
   *
   * @example
   * ```typescript
   * if (await repository.exists(baseScanId, compareScanId, tenantId)) {
   *   console.log('Diff already exists, skipping computation');
   * }
   * ```
   */
  exists(
    baseScanId: string,
    compareScanId: string,
    tenantId: TenantId
  ): Promise<boolean>;

  /**
   * Get diff statistics for a repository.
   *
   * @param repositoryId - Repository ID
   * @param tenantId - Tenant ID for isolation
   * @returns Promise resolving to aggregated statistics
   */
  getRepositoryStats(
    repositoryId: string,
    tenantId: TenantId
  ): Promise<DiffRepositoryStats>;
}

/**
 * Aggregated statistics for diffs in a repository.
 */
export interface DiffRepositoryStats {
  /** Total number of diffs */
  readonly totalDiffs: number;
  /** Average computation time in milliseconds */
  readonly avgComputationTimeMs: number;
  /** Distribution by impact level */
  readonly impactDistribution: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
    readonly critical: number;
  };
  /** Date of most recent diff */
  readonly lastDiffAt: Date | null;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Diff repository implementation using PostgreSQL.
 * Extends BaseRepository for common database operations.
 */
export class DiffRepository extends BaseRepository implements IDiffRepository {
  constructor() {
    super('graph_diffs');
  }

  /**
   * Create a new diff record from a computed GraphDiff.
   */
  async create(diff: GraphDiff, tenantId: TenantId): Promise<DiffEntity> {
    const now = new Date();

    const query = `
      INSERT INTO graph_diffs (
        id, tenant_id, repository_id, base_scan_id, compare_scan_id,
        nodes_added_count, nodes_removed_count, nodes_modified_count,
        edges_added_count, edges_removed_count, edges_modified_count,
        impact_assessment, computation_time_ms, computed_at, created_at,
        diff_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `;

    const params = [
      diff.id,
      tenantId,
      diff.repositoryId,
      diff.baseScanId,
      diff.compareScanId,
      diff.summary.nodesAdded,
      diff.summary.nodesRemoved,
      diff.summary.nodesModified,
      diff.summary.edgesAdded,
      diff.summary.edgesRemoved,
      diff.summary.edgesModified,
      diff.summary.impactAssessment,
      diff.computationTimeMs ?? 0,
      diff.computedAt,
      now,
      JSON.stringify(diff),
    ];

    const row = await this.queryOne<DiffRow>(query, params, { tenantId });

    if (!row) {
      throw new Error('Failed to create diff record');
    }

    return this.mapRowToDiffEntity(row);
  }

  /**
   * Find a diff by its ID.
   */
  async findById(
    diffId: DiffId,
    tenantId: TenantId,
    includeData = true
  ): Promise<DiffEntity | null> {
    const columns = includeData ? '*' : this.getColumnsWithoutData();

    const query = `
      SELECT ${columns} FROM graph_diffs
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<DiffRow>(query, [diffId, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToDiffEntity(row);
  }

  /**
   * Find a diff by its scan pair.
   */
  async findByScanPair(
    baseScanId: string,
    compareScanId: string,
    tenantId: TenantId,
    includeData = true
  ): Promise<DiffEntity | null> {
    const columns = includeData ? '*' : this.getColumnsWithoutData();

    const query = `
      SELECT ${columns} FROM graph_diffs
      WHERE base_scan_id = $1
        AND compare_scan_id = $2
        AND tenant_id = $3
    `;

    const row = await this.queryOne<DiffRow>(query, [
      baseScanId,
      compareScanId,
      tenantId,
    ]);

    if (!row) {
      return null;
    }

    return this.mapRowToDiffEntity(row);
  }

  /**
   * Find all diffs for a repository with pagination.
   */
  async findByRepository(
    repositoryId: string,
    tenantId: TenantId,
    pagination: PaginationParams = { page: 1, pageSize: 20 },
    includeData = false
  ): Promise<PaginatedResult<DiffEntity>> {
    const columns = includeData ? '*' : this.getColumnsWithoutData();

    const baseQuery = `
      SELECT ${columns} FROM graph_diffs
      WHERE repository_id = $1 AND tenant_id = $2
      ORDER BY computed_at DESC
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM graph_diffs
      WHERE repository_id = $1 AND tenant_id = $2
    `;

    const result = await this.queryPaginated<DiffRow>(
      baseQuery,
      countQuery,
      [repositoryId, tenantId],
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToDiffEntity(row)),
    };
  }

  /**
   * Find all diffs involving a specific scan.
   */
  async findByScan(scanId: string, tenantId: TenantId): Promise<DiffEntity[]> {
    const query = `
      SELECT ${this.getColumnsWithoutData()} FROM graph_diffs
      WHERE (base_scan_id = $1 OR compare_scan_id = $1)
        AND tenant_id = $2
      ORDER BY computed_at DESC
    `;

    const rows = await this.queryAll<DiffRow>(query, [scanId, tenantId]);

    return rows.map(row => this.mapRowToDiffEntity(row));
  }

  /**
   * Delete a diff by ID.
   */
  async delete(diffId: DiffId, tenantId: TenantId): Promise<void> {
    const query = `
      DELETE FROM graph_diffs
      WHERE id = $1 AND tenant_id = $2
    `;

    await this.query(query, [diffId, tenantId]);
  }

  /**
   * Delete all diffs involving a specific scan.
   */
  async deleteByScan(scanId: string, tenantId: TenantId): Promise<number> {
    const query = `
      DELETE FROM graph_diffs
      WHERE (base_scan_id = $1 OR compare_scan_id = $1)
        AND tenant_id = $2
    `;

    const result = await this.query(query, [scanId, tenantId]);
    return result.rowCount ?? 0;
  }

  /**
   * Check if a diff exists for a scan pair.
   */
  async exists(
    baseScanId: string,
    compareScanId: string,
    tenantId: TenantId
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM graph_diffs
      WHERE base_scan_id = $1
        AND compare_scan_id = $2
        AND tenant_id = $3
      LIMIT 1
    `;

    const result = await this.queryOne<{ '1': number }>(query, [
      baseScanId,
      compareScanId,
      tenantId,
    ]);

    return result !== null;
  }

  /**
   * Get diff statistics for a repository.
   */
  async getRepositoryStats(
    repositoryId: string,
    tenantId: TenantId
  ): Promise<DiffRepositoryStats> {
    const query = `
      SELECT
        COUNT(*) as total_diffs,
        AVG(computation_time_ms) as avg_computation_time_ms,
        COUNT(*) FILTER (WHERE impact_assessment = 'low') as impact_low,
        COUNT(*) FILTER (WHERE impact_assessment = 'medium') as impact_medium,
        COUNT(*) FILTER (WHERE impact_assessment = 'high') as impact_high,
        COUNT(*) FILTER (WHERE impact_assessment = 'critical') as impact_critical,
        MAX(computed_at) as last_diff_at
      FROM graph_diffs
      WHERE repository_id = $1 AND tenant_id = $2
    `;

    const result = await this.queryOne<{
      total_diffs: string;
      avg_computation_time_ms: string | null;
      impact_low: string;
      impact_medium: string;
      impact_high: string;
      impact_critical: string;
      last_diff_at: Date | null;
    }>(query, [repositoryId, tenantId]);

    if (!result) {
      return {
        totalDiffs: 0,
        avgComputationTimeMs: 0,
        impactDistribution: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
        lastDiffAt: null,
      };
    }

    return {
      totalDiffs: parseInt(result.total_diffs, 10),
      avgComputationTimeMs: result.avg_computation_time_ms
        ? parseFloat(result.avg_computation_time_ms)
        : 0,
      impactDistribution: {
        low: parseInt(result.impact_low, 10),
        medium: parseInt(result.impact_medium, 10),
        high: parseInt(result.impact_high, 10),
        critical: parseInt(result.impact_critical, 10),
      },
      lastDiffAt: result.last_diff_at,
    };
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  /**
   * Execute multiple diff operations within a transaction.
   *
   * @param fn - Function containing operations to execute
   * @returns Promise resolving to the function result
   *
   * @example
   * ```typescript
   * await repository.executeInTransaction(async (txRepo) => {
   *   await txRepo.deleteByScan(oldScanId, tenantId);
   *   await txRepo.create(newDiff, tenantId);
   * });
   * ```
   */
  async executeInTransaction<T>(
    fn: (repo: TransactionalDiffRepository) => Promise<T>
  ): Promise<T> {
    return this.withTransaction(async client => {
      const txRepo = new TransactionalDiffRepository(client);
      return fn(txRepo);
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get column list without the diff_data field for list queries.
   */
  private getColumnsWithoutData(): string {
    return `
      id, tenant_id, repository_id, base_scan_id, compare_scan_id,
      nodes_added_count, nodes_removed_count, nodes_modified_count,
      edges_added_count, edges_removed_count, edges_modified_count,
      impact_assessment, computation_time_ms, computed_at, created_at
    `;
  }

  /**
   * Map a database row to a DiffEntity.
   */
  private mapRowToDiffEntity(row: DiffRow): DiffEntity {
    const impactAssessment = row.impact_assessment;

    const baseEntity = {
      id: createDiffId(row.id),
      tenantId: row.tenant_id as TenantId,
      repositoryId: row.repository_id,
      baseScanId: row.base_scan_id,
      compareScanId: row.compare_scan_id,
      nodesAddedCount: row.nodes_added_count,
      nodesRemovedCount: row.nodes_removed_count,
      nodesModifiedCount: row.nodes_modified_count,
      edgesAddedCount: row.edges_added_count,
      edgesRemovedCount: row.edges_removed_count,
      edgesModifiedCount: row.edges_modified_count,
      impactAssessment: isImpactLevel(impactAssessment)
        ? impactAssessment
        : ('low' as const),
      computationTimeMs: row.computation_time_ms,
      computedAt: row.computed_at,
      createdAt: row.created_at,
    };

    if (row.diff_data) {
      return {
        ...baseEntity,
        diffData: row.diff_data as unknown as GraphDiff,
      };
    }

    return baseEntity;
  }
}

// ============================================================================
// Transactional Repository
// ============================================================================

/**
 * Transactional version of DiffRepository for use within transactions.
 * Uses a specific database client instead of the pool.
 */
export class TransactionalDiffRepository implements IDiffRepository {
  private readonly client: pg.PoolClient;

  constructor(client: pg.PoolClient) {
    this.client = client;
  }

  /**
   * Execute a query using the transaction client.
   */
  private async query<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<pg.QueryResult<T>> {
    return this.client.query<T>(text, params);
  }

  /**
   * Execute a query and return first row or null.
   */
  private async queryOne<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] ?? null;
  }

  /**
   * Execute a query and return all rows.
   */
  private async queryAll<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  async create(diff: GraphDiff, tenantId: TenantId): Promise<DiffEntity> {
    const now = new Date();

    const query = `
      INSERT INTO graph_diffs (
        id, tenant_id, repository_id, base_scan_id, compare_scan_id,
        nodes_added_count, nodes_removed_count, nodes_modified_count,
        edges_added_count, edges_removed_count, edges_modified_count,
        impact_assessment, computation_time_ms, computed_at, created_at,
        diff_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `;

    const params = [
      diff.id,
      tenantId,
      diff.repositoryId,
      diff.baseScanId,
      diff.compareScanId,
      diff.summary.nodesAdded,
      diff.summary.nodesRemoved,
      diff.summary.nodesModified,
      diff.summary.edgesAdded,
      diff.summary.edgesRemoved,
      diff.summary.edgesModified,
      diff.summary.impactAssessment,
      diff.computationTimeMs ?? 0,
      diff.computedAt,
      now,
      JSON.stringify(diff),
    ];

    const row = await this.queryOne<DiffRow>(query, params);

    if (!row) {
      throw new Error('Failed to create diff record');
    }

    return this.mapRowToDiffEntity(row);
  }

  async findById(
    diffId: DiffId,
    tenantId: TenantId,
    includeData = true
  ): Promise<DiffEntity | null> {
    const columns = includeData ? '*' : this.getColumnsWithoutData();

    const query = `
      SELECT ${columns} FROM graph_diffs
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<DiffRow>(query, [diffId, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToDiffEntity(row);
  }

  async findByScanPair(
    baseScanId: string,
    compareScanId: string,
    tenantId: TenantId,
    includeData = true
  ): Promise<DiffEntity | null> {
    const columns = includeData ? '*' : this.getColumnsWithoutData();

    const query = `
      SELECT ${columns} FROM graph_diffs
      WHERE base_scan_id = $1
        AND compare_scan_id = $2
        AND tenant_id = $3
    `;

    const row = await this.queryOne<DiffRow>(query, [
      baseScanId,
      compareScanId,
      tenantId,
    ]);

    if (!row) {
      return null;
    }

    return this.mapRowToDiffEntity(row);
  }

  async findByRepository(
    repositoryId: string,
    tenantId: TenantId,
    pagination: PaginationParams = { page: 1, pageSize: 20 },
    includeData = false
  ): Promise<PaginatedResult<DiffEntity>> {
    const columns = includeData ? '*' : this.getColumnsWithoutData();
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT ${columns} FROM graph_diffs
      WHERE repository_id = $1 AND tenant_id = $2
      ORDER BY computed_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM graph_diffs
      WHERE repository_id = $1 AND tenant_id = $2
    `;

    const [dataResult, countResult] = await Promise.all([
      this.queryAll<DiffRow>(dataQuery, [repositoryId, tenantId, pageSize, offset]),
      this.queryOne<{ count: string }>(countQuery, [repositoryId, tenantId]),
    ]);

    const total = parseInt(countResult?.count ?? '0', 10);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dataResult.map(row => this.mapRowToDiffEntity(row)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findByScan(scanId: string, tenantId: TenantId): Promise<DiffEntity[]> {
    const query = `
      SELECT ${this.getColumnsWithoutData()} FROM graph_diffs
      WHERE (base_scan_id = $1 OR compare_scan_id = $1)
        AND tenant_id = $2
      ORDER BY computed_at DESC
    `;

    const rows = await this.queryAll<DiffRow>(query, [scanId, tenantId]);

    return rows.map(row => this.mapRowToDiffEntity(row));
  }

  async delete(diffId: DiffId, tenantId: TenantId): Promise<void> {
    const query = `
      DELETE FROM graph_diffs
      WHERE id = $1 AND tenant_id = $2
    `;

    await this.query(query, [diffId, tenantId]);
  }

  async deleteByScan(scanId: string, tenantId: TenantId): Promise<number> {
    const query = `
      DELETE FROM graph_diffs
      WHERE (base_scan_id = $1 OR compare_scan_id = $1)
        AND tenant_id = $2
    `;

    const result = await this.query(query, [scanId, tenantId]);
    return result.rowCount ?? 0;
  }

  async exists(
    baseScanId: string,
    compareScanId: string,
    tenantId: TenantId
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM graph_diffs
      WHERE base_scan_id = $1
        AND compare_scan_id = $2
        AND tenant_id = $3
      LIMIT 1
    `;

    const result = await this.queryOne<{ '1': number }>(query, [
      baseScanId,
      compareScanId,
      tenantId,
    ]);

    return result !== null;
  }

  async getRepositoryStats(
    repositoryId: string,
    tenantId: TenantId
  ): Promise<DiffRepositoryStats> {
    const query = `
      SELECT
        COUNT(*) as total_diffs,
        AVG(computation_time_ms) as avg_computation_time_ms,
        COUNT(*) FILTER (WHERE impact_assessment = 'low') as impact_low,
        COUNT(*) FILTER (WHERE impact_assessment = 'medium') as impact_medium,
        COUNT(*) FILTER (WHERE impact_assessment = 'high') as impact_high,
        COUNT(*) FILTER (WHERE impact_assessment = 'critical') as impact_critical,
        MAX(computed_at) as last_diff_at
      FROM graph_diffs
      WHERE repository_id = $1 AND tenant_id = $2
    `;

    const result = await this.queryOne<{
      total_diffs: string;
      avg_computation_time_ms: string | null;
      impact_low: string;
      impact_medium: string;
      impact_high: string;
      impact_critical: string;
      last_diff_at: Date | null;
    }>(query, [repositoryId, tenantId]);

    if (!result) {
      return {
        totalDiffs: 0,
        avgComputationTimeMs: 0,
        impactDistribution: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
        lastDiffAt: null,
      };
    }

    return {
      totalDiffs: parseInt(result.total_diffs, 10),
      avgComputationTimeMs: result.avg_computation_time_ms
        ? parseFloat(result.avg_computation_time_ms)
        : 0,
      impactDistribution: {
        low: parseInt(result.impact_low, 10),
        medium: parseInt(result.impact_medium, 10),
        high: parseInt(result.impact_high, 10),
        critical: parseInt(result.impact_critical, 10),
      },
      lastDiffAt: result.last_diff_at,
    };
  }

  private getColumnsWithoutData(): string {
    return `
      id, tenant_id, repository_id, base_scan_id, compare_scan_id,
      nodes_added_count, nodes_removed_count, nodes_modified_count,
      edges_added_count, edges_removed_count, edges_modified_count,
      impact_assessment, computation_time_ms, computed_at, created_at
    `;
  }

  private mapRowToDiffEntity(row: DiffRow): DiffEntity {
    const impactAssessment = row.impact_assessment;

    const baseEntity = {
      id: createDiffId(row.id),
      tenantId: row.tenant_id as TenantId,
      repositoryId: row.repository_id,
      baseScanId: row.base_scan_id,
      compareScanId: row.compare_scan_id,
      nodesAddedCount: row.nodes_added_count,
      nodesRemovedCount: row.nodes_removed_count,
      nodesModifiedCount: row.nodes_modified_count,
      edgesAddedCount: row.edges_added_count,
      edgesRemovedCount: row.edges_removed_count,
      edgesModifiedCount: row.edges_modified_count,
      impactAssessment: isImpactLevel(impactAssessment)
        ? impactAssessment
        : ('low' as const),
      computationTimeMs: row.computation_time_ms,
      computedAt: row.computed_at,
      createdAt: row.created_at,
    };

    if (row.diff_data) {
      return {
        ...baseEntity,
        diffData: row.diff_data as unknown as GraphDiff,
      };
    }

    return baseEntity;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new DiffRepository instance.
 *
 * @returns Configured DiffRepository instance
 *
 * @example
 * ```typescript
 * const repository = createDiffRepository();
 *
 * // Use the repository
 * const diff = await repository.findById(diffId, tenantId);
 * ```
 */
export function createDiffRepository(): IDiffRepository {
  return new DiffRepository();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a DiffEntity to a GraphDiff.
 * Requires the entity to have diffData loaded.
 *
 * @param entity - DiffEntity with diffData
 * @returns GraphDiff or null if diffData not loaded
 *
 * @example
 * ```typescript
 * const entity = await repository.findById(diffId, tenantId, true);
 * const diff = entityToDiff(entity);
 * if (diff) {
 *   console.log(`Nodes added: ${diff.nodes.added.length}`);
 * }
 * ```
 */
export function entityToDiff(entity: DiffEntity | null): GraphDiff | null {
  if (!entity || !entity.diffData) {
    return null;
  }
  return entity.diffData;
}

/**
 * Check if a DiffEntity has full diff data loaded.
 *
 * @param entity - DiffEntity to check
 * @returns True if diffData is available
 */
export function hasDiffData(entity: DiffEntity): boolean {
  return entity.diffData !== undefined;
}

/**
 * Get total change count from a DiffEntity.
 *
 * @param entity - DiffEntity
 * @returns Total number of changes
 */
export function getTotalChangeCount(entity: DiffEntity): number {
  return (
    entity.nodesAddedCount +
    entity.nodesRemovedCount +
    entity.nodesModifiedCount +
    entity.edgesAddedCount +
    entity.edgesRemovedCount +
    entity.edgesModifiedCount
  );
}

/**
 * Check if a DiffEntity represents a breaking change.
 * Breaking changes are those with high or critical impact.
 *
 * @param entity - DiffEntity to check
 * @returns True if the diff represents a breaking change
 */
export function isBreakingChange(entity: DiffEntity): boolean {
  return (
    entity.impactAssessment === 'high' ||
    entity.impactAssessment === 'critical'
  );
}
