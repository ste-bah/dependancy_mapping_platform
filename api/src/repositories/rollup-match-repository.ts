/**
 * Rollup Match Repository Implementation
 * @module repositories/rollup-match-repository
 *
 * Implements match result persistence for cross-repository aggregation.
 * Handles batch insert, querying by execution/strategy, and analytics.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation match data layer
 */

import { TenantId, RepositoryId } from '../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  MatchResult,
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
 * Database row type for rollup_matches table
 */
interface RollupMatchRow {
  id: string;
  rollup_id: string;
  execution_id: string;
  tenant_id: string;
  source_node_id: string;
  target_node_id: string;
  source_repo_id: string;
  target_repo_id: string;
  strategy: string;
  confidence: number;
  matched_attribute: string;
  source_value: string;
  target_value: string;
  context: Record<string, unknown> | null;
  merged_node_id: string | null;
  created_at: Date;
}

/**
 * Match entity for domain use
 */
export interface RollupMatchEntity {
  readonly id: string;
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly tenantId: TenantId;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceRepoId: RepositoryId;
  readonly targetRepoId: RepositoryId;
  readonly strategy: MatchingStrategy;
  readonly confidence: number;
  readonly matchedAttribute: string;
  readonly sourceValue: string;
  readonly targetValue: string;
  readonly context: Record<string, unknown> | null;
  readonly mergedNodeId: string | null;
  readonly createdAt: Date;
}

/**
 * Input for batch inserting matches
 */
export interface CreateMatchInput {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly tenantId: TenantId;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceRepoId: RepositoryId;
  readonly targetRepoId: RepositoryId;
  readonly strategy: MatchingStrategy;
  readonly confidence: number;
  readonly details: MatchResult['details'];
  readonly mergedNodeId?: string;
}

/**
 * Match count by strategy result
 */
export interface MatchCountByStrategy {
  readonly strategy: MatchingStrategy;
  readonly count: number;
  readonly avgConfidence: number;
  readonly minConfidence: number;
  readonly maxConfidence: number;
}

/**
 * Rollup match repository interface
 */
export interface IRollupMatchRepository {
  batchInsert(matches: CreateMatchInput[]): Promise<BatchResult>;
  findByExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<RollupMatchEntity>>;
  findByMergedNode(
    tenantId: TenantId,
    mergedNodeId: string
  ): Promise<RollupMatchEntity[]>;
  getMatchCountByStrategy(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<MatchCountByStrategy[]>;
  deleteByExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<number>;
  deleteByRollup(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<number>;
  updateMergedNodeIds(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    updates: Array<{ matchId: string; mergedNodeId: string }>
  ): Promise<number>;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Rollup match repository for managing match results
 */
export class RollupMatchRepository extends BaseRepository implements IRollupMatchRepository {
  constructor() {
    super('rollup_matches');
  }

  /**
   * Batch insert match results
   */
  async batchInsert(matches: CreateMatchInput[]): Promise<BatchResult> {
    if (matches.length === 0) {
      return { inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    const columns = [
      'id',
      'rollup_id',
      'execution_id',
      'tenant_id',
      'source_node_id',
      'target_node_id',
      'source_repo_id',
      'target_repo_id',
      'strategy',
      'confidence',
      'matched_attribute',
      'source_value',
      'target_value',
      'context',
      'merged_node_id',
      'created_at',
    ];

    return this.batchInsertWithChunks(
      matches,
      columns,
      (match) => [
        this.generateId(),
        match.rollupId,
        match.executionId,
        match.tenantId,
        match.sourceNodeId,
        match.targetNodeId,
        match.sourceRepoId,
        match.targetRepoId,
        match.strategy,
        match.confidence,
        match.details.matchedAttribute,
        match.details.sourceValue,
        match.details.targetValue,
        match.details.context ? JSON.stringify(match.details.context) : null,
        match.mergedNodeId ?? null,
        new Date(),
      ],
      500 // Chunk size for batch operations
    );
  }

  /**
   * Find matches by execution with pagination
   */
  async findByExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    pagination: PaginationParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResult<RollupMatchEntity>> {
    const baseQuery = `
      SELECT * FROM rollup_matches
      WHERE execution_id = $1 AND tenant_id = $2
      ORDER BY confidence DESC, created_at ASC
    `;

    const countQuery = `
      SELECT COUNT(*)::int as count FROM rollup_matches
      WHERE execution_id = $1 AND tenant_id = $2
    `;

    const result = await this.queryPaginated<RollupMatchRow>(
      baseQuery,
      countQuery,
      [executionId, tenantId],
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToMatchEntity(row)),
    };
  }

  /**
   * Find all matches that resulted in a specific merged node
   */
  async findByMergedNode(
    tenantId: TenantId,
    mergedNodeId: string
  ): Promise<RollupMatchEntity[]> {
    const query = `
      SELECT * FROM rollup_matches
      WHERE merged_node_id = $1 AND tenant_id = $2
      ORDER BY confidence DESC
    `;

    const rows = await this.queryAll<RollupMatchRow>(query, [mergedNodeId, tenantId]);

    return rows.map(row => this.mapRowToMatchEntity(row));
  }

  /**
   * Get match statistics grouped by strategy
   */
  async getMatchCountByStrategy(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<MatchCountByStrategy[]> {
    const query = `
      SELECT
        strategy,
        COUNT(*)::int as count,
        AVG(confidence)::numeric(5,2) as avg_confidence,
        MIN(confidence)::int as min_confidence,
        MAX(confidence)::int as max_confidence
      FROM rollup_matches
      WHERE execution_id = $1 AND tenant_id = $2
      GROUP BY strategy
      ORDER BY count DESC
    `;

    const rows = await this.queryAll<{
      strategy: string;
      count: number;
      avg_confidence: string;
      min_confidence: number;
      max_confidence: number;
    }>(query, [executionId, tenantId]);

    return rows.map(row => ({
      strategy: row.strategy as MatchingStrategy,
      count: row.count,
      avgConfidence: parseFloat(row.avg_confidence),
      minConfidence: row.min_confidence,
      maxConfidence: row.max_confidence,
    }));
  }

  /**
   * Delete all matches for an execution
   */
  async deleteByExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<number> {
    const result = await this.query(
      `DELETE FROM rollup_matches WHERE execution_id = $1 AND tenant_id = $2`,
      [executionId, tenantId]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Delete all matches for a rollup
   */
  async deleteByRollup(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<number> {
    const result = await this.query(
      `DELETE FROM rollup_matches WHERE rollup_id = $1 AND tenant_id = $2`,
      [rollupId, tenantId]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Update merged node IDs for matches after merge operation
   */
  async updateMergedNodeIds(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    updates: Array<{ matchId: string; mergedNodeId: string }>
  ): Promise<number> {
    if (updates.length === 0) {
      return 0;
    }

    let updatedCount = 0;

    // Process in chunks to avoid query size limits
    const chunkSize = 500;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);

      // Build a values list for bulk update
      const valuesList: string[] = [];
      const params: unknown[] = [tenantId, executionId];
      let paramIndex = 3;

      for (const { matchId, mergedNodeId } of chunk) {
        valuesList.push(`($${paramIndex++}::uuid, $${paramIndex++}::uuid)`);
        params.push(matchId, mergedNodeId);
      }

      const query = `
        UPDATE rollup_matches AS m
        SET merged_node_id = v.merged_node_id
        FROM (VALUES ${valuesList.join(', ')}) AS v(match_id, merged_node_id)
        WHERE m.id = v.match_id
          AND m.tenant_id = $1
          AND m.execution_id = $2
      `;

      const result = await this.query(query, params);
      updatedCount += result.rowCount ?? 0;
    }

    return updatedCount;
  }

  /**
   * Find matches by source or target node
   */
  async findByNode(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    nodeId: string
  ): Promise<RollupMatchEntity[]> {
    const query = `
      SELECT * FROM rollup_matches
      WHERE execution_id = $1
        AND tenant_id = $2
        AND (source_node_id = $3 OR target_node_id = $3)
      ORDER BY confidence DESC
    `;

    const rows = await this.queryAll<RollupMatchRow>(query, [executionId, tenantId, nodeId]);

    return rows.map(row => this.mapRowToMatchEntity(row));
  }

  /**
   * Get cross-repository match summary
   */
  async getCrossRepoSummary(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<Array<{
    sourceRepoId: RepositoryId;
    targetRepoId: RepositoryId;
    matchCount: number;
    avgConfidence: number;
  }>> {
    const query = `
      SELECT
        source_repo_id,
        target_repo_id,
        COUNT(*)::int as match_count,
        AVG(confidence)::numeric(5,2) as avg_confidence
      FROM rollup_matches
      WHERE execution_id = $1 AND tenant_id = $2
      GROUP BY source_repo_id, target_repo_id
      ORDER BY match_count DESC
    `;

    const rows = await this.queryAll<{
      source_repo_id: string;
      target_repo_id: string;
      match_count: number;
      avg_confidence: string;
    }>(query, [executionId, tenantId]);

    return rows.map(row => ({
      sourceRepoId: row.source_repo_id as RepositoryId,
      targetRepoId: row.target_repo_id as RepositoryId,
      matchCount: row.match_count,
      avgConfidence: parseFloat(row.avg_confidence),
    }));
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Map database row to RollupMatchEntity
   */
  private mapRowToMatchEntity(row: RollupMatchRow): RollupMatchEntity {
    return {
      id: row.id,
      rollupId: createRollupId(row.rollup_id),
      executionId: createRollupExecutionId(row.execution_id),
      tenantId: row.tenant_id as TenantId,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      sourceRepoId: row.source_repo_id as RepositoryId,
      targetRepoId: row.target_repo_id as RepositoryId,
      strategy: row.strategy as MatchingStrategy,
      confidence: row.confidence,
      matchedAttribute: row.matched_attribute,
      sourceValue: row.source_value,
      targetValue: row.target_value,
      context: row.context,
      mergedNodeId: row.merged_node_id,
      createdAt: row.created_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new rollup match repository instance
 */
export function createRollupMatchRepository(): IRollupMatchRepository {
  return new RollupMatchRepository();
}
