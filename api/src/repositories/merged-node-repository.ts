/**
 * Merged Node Repository Implementation
 * @module repositories/merged-node-repository
 *
 * Implements merged node persistence for cross-repository aggregation.
 * Handles upsert operations, querying by rollup, and source tracking.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation merged node data layer
 */

import { TenantId, RepositoryId } from '../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  MergedNode,
  MatchingStrategy,
  createRollupId,
  createRollupExecutionId,
} from '../types/rollup.js';
import { BaseRepository } from './base-repository.js';
import { PaginationParams, PaginatedResult, BatchResult } from './interfaces.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row type for merged_nodes table
 */
interface MergedNodeRow {
  id: string;
  rollup_id: string;
  execution_id: string;
  tenant_id: string;
  canonical_name: string;
  node_type: string;
  source_node_ids: string[];
  source_repo_ids: string[];
  locations: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  match_strategy: string;
  match_confidence: number;
  match_count: number;
  source_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Merged node entity for domain use
 */
export interface MergedNodeEntity {
  readonly id: string;
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly tenantId: TenantId;
  readonly canonicalName: string;
  readonly nodeType: string;
  readonly sourceNodeIds: string[];
  readonly sourceRepoIds: RepositoryId[];
  readonly locations: MergedNode['locations'];
  readonly metadata: Record<string, unknown>;
  readonly matchStrategy: MatchingStrategy;
  readonly matchConfidence: number;
  readonly matchCount: number;
  readonly sourceCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Input for creating/upserting a merged node
 */
export interface UpsertMergedNodeInput {
  readonly id?: string;
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly tenantId: TenantId;
  readonly canonicalName: string;
  readonly nodeType: string;
  readonly sourceNodeIds: string[];
  readonly sourceRepoIds: RepositoryId[];
  readonly locations: MergedNode['locations'];
  readonly metadata: Record<string, unknown>;
  readonly matchStrategy: MatchingStrategy;
  readonly matchConfidence: number;
  readonly matchCount: number;
}

/**
 * Filter criteria for merged nodes
 */
export interface MergedNodeFilterCriteria {
  readonly nodeType?: string | string[];
  readonly minConfidence?: number;
  readonly matchStrategy?: MatchingStrategy;
  readonly sourceRepoId?: RepositoryId;
}

/**
 * Merged node repository interface
 */
export interface IMergedNodeRepository {
  upsert(input: UpsertMergedNodeInput): Promise<MergedNodeEntity>;
  batchUpsertNodes(inputs: UpsertMergedNodeInput[]): Promise<BatchResult>;
  findById(tenantId: TenantId, id: string): Promise<MergedNodeEntity | null>;
  findByRollup(
    tenantId: TenantId,
    rollupId: RollupId,
    filter?: MergedNodeFilterCriteria,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<MergedNodeEntity>>;
  findByExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    filter?: MergedNodeFilterCriteria,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<MergedNodeEntity>>;
  findByCanonicalName(
    tenantId: TenantId,
    rollupId: RollupId,
    canonicalName: string,
    nodeType: string
  ): Promise<MergedNodeEntity | null>;
  findBySourceNode(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    sourceNodeId: string
  ): Promise<MergedNodeEntity | null>;
  updateSourceCounts(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<number>;
  deleteByRollup(tenantId: TenantId, rollupId: RollupId): Promise<number>;
  deleteByExecution(tenantId: TenantId, executionId: RollupExecutionId): Promise<number>;
  getNodeTypeCounts(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<Record<string, number>>;
  getConfidenceDistribution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<{
    high: number;
    medium: number;
    low: number;
  }>;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Merged node repository for managing aggregated nodes
 */
export class MergedNodeRepository extends BaseRepository implements IMergedNodeRepository {
  constructor() {
    super('merged_nodes');
  }

  /**
   * Upsert a merged node
   */
  async upsert(input: UpsertMergedNodeInput): Promise<MergedNodeEntity> {
    const id = input.id ?? this.generateId();
    const now = new Date();

    const query = `
      INSERT INTO merged_nodes (
        id, rollup_id, execution_id, tenant_id,
        canonical_name, node_type,
        source_node_ids, source_repo_ids, locations,
        metadata, match_strategy, match_confidence, match_count,
        source_count, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16
      )
      ON CONFLICT (rollup_id, execution_id, canonical_name, node_type)
      DO UPDATE SET
        source_node_ids = EXCLUDED.source_node_ids,
        source_repo_ids = EXCLUDED.source_repo_ids,
        locations = EXCLUDED.locations,
        metadata = EXCLUDED.metadata,
        match_confidence = EXCLUDED.match_confidence,
        match_count = EXCLUDED.match_count,
        source_count = EXCLUDED.source_count,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const params = [
      id,
      input.rollupId,
      input.executionId,
      input.tenantId,
      input.canonicalName,
      input.nodeType,
      input.sourceNodeIds,
      input.sourceRepoIds,
      JSON.stringify(input.locations),
      JSON.stringify(input.metadata),
      input.matchStrategy,
      input.matchConfidence,
      input.matchCount,
      input.sourceNodeIds.length,
      now,
      now,
    ];

    const row = await this.queryOne<MergedNodeRow>(query, params, {
      tenantId: input.tenantId,
    });

    if (!row) {
      throw new Error('Failed to upsert merged node');
    }

    return this.mapRowToMergedNodeEntity(row);
  }

  /**
   * Batch upsert merged nodes
   */
  async batchUpsertNodes(inputs: UpsertMergedNodeInput[]): Promise<BatchResult> {
    if (inputs.length === 0) {
      return { inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    const columns = [
      'id',
      'rollup_id',
      'execution_id',
      'tenant_id',
      'canonical_name',
      'node_type',
      'source_node_ids',
      'source_repo_ids',
      'locations',
      'metadata',
      'match_strategy',
      'match_confidence',
      'match_count',
      'source_count',
      'created_at',
      'updated_at',
    ];

    const conflictColumns = ['rollup_id', 'execution_id', 'canonical_name', 'node_type'];
    const updateColumns = [
      'source_node_ids',
      'source_repo_ids',
      'locations',
      'metadata',
      'match_confidence',
      'match_count',
      'source_count',
      'updated_at',
    ];

    const now = new Date();

    return this.batchUpsertInternal(
      inputs,
      columns,
      conflictColumns,
      updateColumns,
      (input) => [
        input.id ?? this.generateId(),
        input.rollupId,
        input.executionId,
        input.tenantId,
        input.canonicalName,
        input.nodeType,
        input.sourceNodeIds,
        input.sourceRepoIds,
        JSON.stringify(input.locations),
        JSON.stringify(input.metadata),
        input.matchStrategy,
        input.matchConfidence,
        input.matchCount,
        input.sourceNodeIds.length,
        now,
        now,
      ],
      500
    );
  }

  /**
   * Find merged node by ID
   */
  async findById(tenantId: TenantId, id: string): Promise<MergedNodeEntity | null> {
    const query = `
      SELECT * FROM merged_nodes
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<MergedNodeRow>(query, [id, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToMergedNodeEntity(row);
  }

  /**
   * Find merged nodes by rollup with filtering and pagination
   */
  async findByRollup(
    tenantId: TenantId,
    rollupId: RollupId,
    filter?: MergedNodeFilterCriteria,
    pagination: PaginationParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResult<MergedNodeEntity>> {
    const { whereClause, params, nextIndex } = this.buildFilterClause(
      tenantId,
      filter,
      { rollupId }
    );

    const baseQuery = `
      SELECT * FROM merged_nodes
      WHERE ${whereClause}
      ORDER BY match_confidence DESC, canonical_name ASC
    `;

    const countQuery = `
      SELECT COUNT(*)::int as count FROM merged_nodes
      WHERE ${whereClause}
    `;

    const result = await this.queryPaginated<MergedNodeRow>(
      baseQuery,
      countQuery,
      params,
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToMergedNodeEntity(row)),
    };
  }

  /**
   * Find merged nodes by execution with filtering and pagination
   */
  async findByExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    filter?: MergedNodeFilterCriteria,
    pagination: PaginationParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResult<MergedNodeEntity>> {
    const { whereClause, params, nextIndex } = this.buildFilterClause(
      tenantId,
      filter,
      { executionId }
    );

    const baseQuery = `
      SELECT * FROM merged_nodes
      WHERE ${whereClause}
      ORDER BY match_confidence DESC, canonical_name ASC
    `;

    const countQuery = `
      SELECT COUNT(*)::int as count FROM merged_nodes
      WHERE ${whereClause}
    `;

    const result = await this.queryPaginated<MergedNodeRow>(
      baseQuery,
      countQuery,
      params,
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToMergedNodeEntity(row)),
    };
  }

  /**
   * Find merged node by canonical name and type
   */
  async findByCanonicalName(
    tenantId: TenantId,
    rollupId: RollupId,
    canonicalName: string,
    nodeType: string
  ): Promise<MergedNodeEntity | null> {
    const query = `
      SELECT * FROM merged_nodes
      WHERE rollup_id = $1 AND tenant_id = $2
        AND canonical_name = $3 AND node_type = $4
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const row = await this.queryOne<MergedNodeRow>(query, [
      rollupId,
      tenantId,
      canonicalName,
      nodeType,
    ]);

    if (!row) {
      return null;
    }

    return this.mapRowToMergedNodeEntity(row);
  }

  /**
   * Find merged node containing a specific source node
   */
  async findBySourceNode(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    sourceNodeId: string
  ): Promise<MergedNodeEntity | null> {
    const query = `
      SELECT * FROM merged_nodes
      WHERE execution_id = $1 AND tenant_id = $2
        AND $3 = ANY(source_node_ids)
    `;

    const row = await this.queryOne<MergedNodeRow>(query, [
      executionId,
      tenantId,
      sourceNodeId,
    ]);

    if (!row) {
      return null;
    }

    return this.mapRowToMergedNodeEntity(row);
  }

  /**
   * Update source counts for all merged nodes in an execution
   */
  async updateSourceCounts(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<number> {
    const query = `
      UPDATE merged_nodes
      SET source_count = array_length(source_node_ids, 1),
          updated_at = NOW()
      WHERE execution_id = $1 AND tenant_id = $2
    `;

    const result = await this.query(query, [executionId, tenantId]);
    return result.rowCount ?? 0;
  }

  /**
   * Delete all merged nodes for a rollup
   */
  async deleteByRollup(tenantId: TenantId, rollupId: RollupId): Promise<number> {
    const result = await this.query(
      `DELETE FROM merged_nodes WHERE rollup_id = $1 AND tenant_id = $2`,
      [rollupId, tenantId]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Delete all merged nodes for an execution
   */
  async deleteByExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<number> {
    const result = await this.query(
      `DELETE FROM merged_nodes WHERE execution_id = $1 AND tenant_id = $2`,
      [executionId, tenantId]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Get node type counts for an execution
   */
  async getNodeTypeCounts(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<Record<string, number>> {
    const query = `
      SELECT node_type, COUNT(*)::int as count
      FROM merged_nodes
      WHERE execution_id = $1 AND tenant_id = $2
      GROUP BY node_type
      ORDER BY count DESC
    `;

    const rows = await this.queryAll<{ node_type: string; count: number }>(
      query,
      [executionId, tenantId]
    );

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.node_type] = row.count;
    }

    return counts;
  }

  /**
   * Get confidence distribution for an execution
   */
  async getConfidenceDistribution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<{ high: number; medium: number; low: number }> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE match_confidence >= 80)::int as high,
        COUNT(*) FILTER (WHERE match_confidence >= 50 AND match_confidence < 80)::int as medium,
        COUNT(*) FILTER (WHERE match_confidence < 50)::int as low
      FROM merged_nodes
      WHERE execution_id = $1 AND tenant_id = $2
    `;

    const result = await this.queryOne<{
      high: number;
      medium: number;
      low: number;
    }>(query, [executionId, tenantId]);

    return {
      high: result?.high ?? 0,
      medium: result?.medium ?? 0,
      low: result?.low ?? 0,
    };
  }

  /**
   * Get source repository distribution
   */
  async getSourceRepoDistribution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<Array<{ repoId: RepositoryId; nodeCount: number }>> {
    const query = `
      SELECT unnest(source_repo_ids) as repo_id, COUNT(*)::int as node_count
      FROM merged_nodes
      WHERE execution_id = $1 AND tenant_id = $2
      GROUP BY repo_id
      ORDER BY node_count DESC
    `;

    const rows = await this.queryAll<{ repo_id: string; node_count: number }>(
      query,
      [executionId, tenantId]
    );

    return rows.map(row => ({
      repoId: row.repo_id as RepositoryId,
      nodeCount: row.node_count,
    }));
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build WHERE clause from filter criteria
   */
  private buildFilterClause(
    tenantId: TenantId,
    filter?: MergedNodeFilterCriteria,
    additionalConditions?: { rollupId?: RollupId; executionId?: RollupExecutionId }
  ): { whereClause: string; params: unknown[]; nextIndex: number } {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (additionalConditions?.rollupId) {
      conditions.push(`rollup_id = $${paramIndex++}`);
      params.push(additionalConditions.rollupId);
    }

    if (additionalConditions?.executionId) {
      conditions.push(`execution_id = $${paramIndex++}`);
      params.push(additionalConditions.executionId);
    }

    if (filter?.nodeType) {
      if (Array.isArray(filter.nodeType)) {
        const placeholders = filter.nodeType.map(() => `$${paramIndex++}`);
        conditions.push(`node_type IN (${placeholders.join(', ')})`);
        params.push(...filter.nodeType);
      } else {
        conditions.push(`node_type = $${paramIndex++}`);
        params.push(filter.nodeType);
      }
    }

    if (filter?.minConfidence !== undefined) {
      conditions.push(`match_confidence >= $${paramIndex++}`);
      params.push(filter.minConfidence);
    }

    if (filter?.matchStrategy) {
      conditions.push(`match_strategy = $${paramIndex++}`);
      params.push(filter.matchStrategy);
    }

    if (filter?.sourceRepoId) {
      conditions.push(`$${paramIndex++} = ANY(source_repo_ids)`);
      params.push(filter.sourceRepoId);
    }

    return {
      whereClause: conditions.join(' AND '),
      params,
      nextIndex: paramIndex,
    };
  }

  /**
   * Internal batch upsert with conflict handling
   */
  private async batchUpsertInternal<T>(
    items: T[],
    columns: string[],
    conflictColumns: string[],
    updateColumns: string[],
    valueMapper: (item: T, index: number) => unknown[],
    chunkSize: number
  ): Promise<BatchResult> {
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      try {
        const valuesPerRow = columns.length;
        const valuePlaceholders: string[] = [];
        const allValues: unknown[] = [];

        chunk.forEach((item, idx) => {
          const rowValues = valueMapper(item, i + idx);
          const startParamIndex = idx * valuesPerRow + 1;
          const placeholders = rowValues.map((_, j) => `$${startParamIndex + j}`);
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
          RETURNING (xmax = 0) AS is_insert
        `;

        const result = await this.queryAll<{ is_insert: boolean }>(query, allValues);

        const chunkInserted = result.filter(r => r.is_insert).length;
        const chunkUpdated = result.filter(r => !r.is_insert).length;
        inserted += chunkInserted;
        updated += chunkUpdated;
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
   * Map database row to MergedNodeEntity
   */
  private mapRowToMergedNodeEntity(row: MergedNodeRow): MergedNodeEntity {
    return {
      id: row.id,
      rollupId: createRollupId(row.rollup_id),
      executionId: createRollupExecutionId(row.execution_id),
      tenantId: row.tenant_id as TenantId,
      canonicalName: row.canonical_name,
      nodeType: row.node_type,
      sourceNodeIds: row.source_node_ids,
      sourceRepoIds: row.source_repo_ids as RepositoryId[],
      locations: row.locations as unknown as MergedNode['locations'],
      metadata: row.metadata,
      matchStrategy: row.match_strategy as MatchingStrategy,
      matchConfidence: row.match_confidence,
      matchCount: row.match_count,
      sourceCount: row.source_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new merged node repository instance
 */
export function createMergedNodeRepository(): IMergedNodeRepository {
  return new MergedNodeRepository();
}
