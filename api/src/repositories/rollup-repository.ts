/**
 * Rollup Repository Implementation
 * @module repositories/rollup-repository
 *
 * Implements IRollupRepository for rollup configuration and execution persistence.
 * Handles CRUD operations, status updates, and execution tracking.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation data layer
 */

import { TenantId, ScanId } from '../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  RollupStatus,
  RollupCreateRequest,
  RollupUpdateRequest,
  RollupListQuery,
  RollupExecuteRequest,
  RollupExecutionStats,
  MatchResult,
  MatcherConfig,
  createRollupId,
  createRollupExecutionId,
} from '../types/rollup.js';
import {
  IRollupRepository,
  RollupEntity,
  RollupExecutionEntity,
} from '../services/rollup/interfaces.js';
import { BaseRepository } from './base-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row type for rollups table
 */
interface RollupRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: string;
  repository_ids: string[];
  scan_ids: string[] | null;
  matchers: Record<string, unknown>[];
  include_node_types: string[] | null;
  exclude_node_types: string[] | null;
  preserve_edge_types: string[] | null;
  merge_options: Record<string, unknown>;
  schedule: Record<string, unknown> | null;
  version: number;
  created_by: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  last_executed_at: Date | null;
}

/**
 * Database row type for rollup_executions table
 */
interface RollupExecutionRow {
  id: string;
  rollup_id: string;
  tenant_id: string;
  status: string;
  scan_ids: string[];
  stats: Record<string, unknown> | null;
  matches: Record<string, unknown>[] | null;
  merged_graph_id: string | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  callback_url: string | null;
  options: Record<string, unknown> | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Rollup repository for managing rollup configurations and executions
 */
export class RollupRepository extends BaseRepository implements IRollupRepository {
  constructor() {
    super('rollups');
  }

  // ==========================================================================
  // Rollup CRUD
  // ==========================================================================

  /**
   * Create a new rollup configuration
   */
  async create(
    tenantId: TenantId,
    userId: string,
    input: RollupCreateRequest
  ): Promise<RollupEntity> {
    const id = this.generateId();
    const now = new Date();

    const mergeOptions = input.mergeOptions ?? {
      conflictResolution: 'merge',
      preserveSourceInfo: true,
      createCrossRepoEdges: true,
    };

    const query = `
      INSERT INTO rollups (
        id, tenant_id, name, description, status,
        repository_ids, scan_ids, matchers,
        include_node_types, exclude_node_types, preserve_edge_types,
        merge_options, schedule, version,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17
      )
      RETURNING *
    `;

    const params = [
      id,
      tenantId,
      input.name,
      input.description ?? null,
      RollupStatus.DRAFT,
      input.repositoryIds,
      input.scanIds ?? null,
      JSON.stringify(input.matchers),
      input.includeNodeTypes ?? null,
      input.excludeNodeTypes ?? null,
      input.preserveEdgeTypes ?? null,
      JSON.stringify(mergeOptions),
      input.schedule ? JSON.stringify(input.schedule) : null,
      1,
      userId,
      now,
      now,
    ];

    const row = await this.queryOne<RollupRow>(query, params, {
      tenantId,
    });

    if (!row) {
      throw new Error('Failed to create rollup');
    }

    return this.mapRowToRollupEntity(row);
  }

  /**
   * Find rollup by ID
   */
  async findById(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<RollupEntity | null> {
    const query = `
      SELECT * FROM rollups
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<RollupRow>(query, [rollupId, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToRollupEntity(row);
  }

  /**
   * Find rollup by name
   */
  async findByName(
    tenantId: TenantId,
    name: string
  ): Promise<RollupEntity | null> {
    const query = `
      SELECT * FROM rollups
      WHERE tenant_id = $1 AND name = $2
    `;

    const row = await this.queryOne<RollupRow>(query, [tenantId, name]);

    if (!row) {
      return null;
    }

    return this.mapRowToRollupEntity(row);
  }

  /**
   * List rollups with filtering and pagination
   */
  async findMany(
    tenantId: TenantId,
    query: RollupListQuery
  ): Promise<{ data: RollupEntity[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (query.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(query.status);
    }

    if (query.repositoryId) {
      conditions.push(`$${paramIndex++} = ANY(repository_ids)`);
      params.push(query.repositoryId);
    }

    if (query.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const sortColumn = this.getSortColumn(query.sortBy);
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT * FROM rollups
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const countQuery = `
      SELECT COUNT(*)::int as count FROM rollups
      WHERE ${whereClause}
    `;

    const [rows, countResult] = await Promise.all([
      this.queryAll<RollupRow>(dataQuery, [...params, pageSize, offset]),
      this.queryOne<{ count: number }>(countQuery, params),
    ]);

    return {
      data: rows.map(row => this.mapRowToRollupEntity(row)),
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Update a rollup configuration
   */
  async update(
    tenantId: TenantId,
    rollupId: RollupId,
    userId: string,
    input: RollupUpdateRequest,
    expectedVersion?: number
  ): Promise<RollupEntity> {
    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Map input fields to database columns
    if (input.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }

    if (input.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }

    if (input.repositoryIds !== undefined) {
      updateFields.push(`repository_ids = $${paramIndex++}`);
      params.push(input.repositoryIds);
    }

    if (input.scanIds !== undefined) {
      updateFields.push(`scan_ids = $${paramIndex++}`);
      params.push(input.scanIds);
    }

    if (input.matchers !== undefined) {
      updateFields.push(`matchers = $${paramIndex++}`);
      params.push(JSON.stringify(input.matchers));
    }

    if (input.includeNodeTypes !== undefined) {
      updateFields.push(`include_node_types = $${paramIndex++}`);
      params.push(input.includeNodeTypes);
    }

    if (input.excludeNodeTypes !== undefined) {
      updateFields.push(`exclude_node_types = $${paramIndex++}`);
      params.push(input.excludeNodeTypes);
    }

    if (input.preserveEdgeTypes !== undefined) {
      updateFields.push(`preserve_edge_types = $${paramIndex++}`);
      params.push(input.preserveEdgeTypes);
    }

    if (input.mergeOptions !== undefined) {
      updateFields.push(`merge_options = $${paramIndex++}`);
      params.push(JSON.stringify(input.mergeOptions));
    }

    if (input.schedule !== undefined) {
      updateFields.push(`schedule = $${paramIndex++}`);
      params.push(input.schedule ? JSON.stringify(input.schedule) : null);
    }

    if (updateFields.length === 0) {
      const existing = await this.findById(tenantId, rollupId);
      if (!existing) {
        throw new Error('Rollup not found');
      }
      return existing;
    }

    // Always update version, updated_at, and updated_by
    updateFields.push(`version = version + 1`);
    updateFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());
    updateFields.push(`updated_by = $${paramIndex++}`);
    params.push(userId);

    // Add WHERE clause params
    params.push(rollupId);
    params.push(tenantId);

    let versionCondition = '';
    if (expectedVersion !== undefined) {
      versionCondition = ` AND version = $${paramIndex + 2}`;
      params.push(expectedVersion);
    }

    const updateQuery = `
      UPDATE rollups
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}${versionCondition}
      RETURNING *
    `;

    const row = await this.queryOne<RollupRow>(updateQuery, params);

    if (!row) {
      throw new Error(
        expectedVersion !== undefined
          ? 'Rollup not found or version mismatch (concurrent modification)'
          : 'Rollup not found'
      );
    }

    return this.mapRowToRollupEntity(row);
  }

  /**
   * Delete a rollup configuration
   */
  async delete(tenantId: TenantId, rollupId: RollupId): Promise<boolean> {
    // Delete in order due to foreign key constraints
    await this.withTransaction(async (client) => {
      // Delete match results
      await client.query(
        `DELETE FROM rollup_matches WHERE rollup_id = $1 AND tenant_id = $2`,
        [rollupId, tenantId]
      );

      // Delete merged nodes
      await client.query(
        `DELETE FROM merged_nodes WHERE rollup_id = $1 AND tenant_id = $2`,
        [rollupId, tenantId]
      );

      // Delete executions
      await client.query(
        `DELETE FROM rollup_executions WHERE rollup_id = $1 AND tenant_id = $2`,
        [rollupId, tenantId]
      );

      // Delete rollup
      await client.query(
        `DELETE FROM rollups WHERE id = $1 AND tenant_id = $2`,
        [rollupId, tenantId]
      );
    });

    return true;
  }

  /**
   * Update rollup status
   */
  async updateStatus(
    tenantId: TenantId,
    rollupId: RollupId,
    status: RollupStatus
  ): Promise<RollupEntity> {
    const query = `
      UPDATE rollups
      SET status = $1, updated_at = $2
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `;

    const row = await this.queryOne<RollupRow>(query, [
      status,
      new Date(),
      rollupId,
      tenantId,
    ]);

    if (!row) {
      throw new Error('Rollup not found');
    }

    return this.mapRowToRollupEntity(row);
  }

  // ==========================================================================
  // Execution CRUD
  // ==========================================================================

  /**
   * Create a new execution record
   */
  async createExecution(
    tenantId: TenantId,
    rollupId: RollupId,
    scanIds: ScanId[],
    options?: RollupExecuteRequest['options'],
    callbackUrl?: string
  ): Promise<RollupExecutionEntity> {
    const id = this.generateId();
    const now = new Date();

    const query = `
      INSERT INTO rollup_executions (
        id, rollup_id, tenant_id, status, scan_ids,
        options, callback_url, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING *
    `;

    const params = [
      id,
      rollupId,
      tenantId,
      'pending',
      scanIds,
      options ? JSON.stringify(options) : null,
      callbackUrl ?? null,
      now,
    ];

    const row = await this.queryOne<RollupExecutionRow>(query, params, {
      tenantId,
    });

    if (!row) {
      throw new Error('Failed to create execution');
    }

    // Update rollup's last_executed_at
    await this.query(
      `UPDATE rollups SET last_executed_at = $1 WHERE id = $2 AND tenant_id = $3`,
      [now, rollupId, tenantId]
    );

    return this.mapRowToExecutionEntity(row);
  }

  /**
   * Find execution by ID
   */
  async findExecutionById(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<RollupExecutionEntity | null> {
    const query = `
      SELECT * FROM rollup_executions
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<RollupExecutionRow>(query, [executionId, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToExecutionEntity(row);
  }

  /**
   * Get execution (alias for findExecutionById for interface compatibility)
   */
  async getExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<RollupExecutionEntity | null> {
    return this.findExecutionById(tenantId, executionId);
  }

  /**
   * Find latest execution for a rollup
   */
  async findLatestExecution(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<RollupExecutionEntity | null> {
    const query = `
      SELECT * FROM rollup_executions
      WHERE rollup_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const row = await this.queryOne<RollupExecutionRow>(query, [rollupId, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToExecutionEntity(row);
  }

  /**
   * Update execution status and results
   */
  async updateExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    update: {
      status?: RollupExecutionEntity['status'];
      stats?: RollupExecutionStats;
      matches?: MatchResult[];
      mergedGraphId?: string;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<RollupExecutionEntity> {
    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (update.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      params.push(update.status);
    }

    if (update.stats !== undefined) {
      updateFields.push(`stats = $${paramIndex++}`);
      params.push(JSON.stringify(update.stats));
    }

    if (update.matches !== undefined) {
      updateFields.push(`matches = $${paramIndex++}`);
      params.push(JSON.stringify(update.matches));
    }

    if (update.mergedGraphId !== undefined) {
      updateFields.push(`merged_graph_id = $${paramIndex++}`);
      params.push(update.mergedGraphId);
    }

    if (update.errorMessage !== undefined) {
      updateFields.push(`error_message = $${paramIndex++}`);
      params.push(update.errorMessage);
    }

    if (update.errorDetails !== undefined) {
      updateFields.push(`error_details = $${paramIndex++}`);
      params.push(JSON.stringify(update.errorDetails));
    }

    if (update.startedAt !== undefined) {
      updateFields.push(`started_at = $${paramIndex++}`);
      params.push(update.startedAt);
    }

    if (update.completedAt !== undefined) {
      updateFields.push(`completed_at = $${paramIndex++}`);
      params.push(update.completedAt);
    }

    if (updateFields.length === 0) {
      const existing = await this.findExecutionById(tenantId, executionId);
      if (!existing) {
        throw new Error('Execution not found');
      }
      return existing;
    }

    params.push(executionId);
    params.push(tenantId);

    const query = `
      UPDATE rollup_executions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
      RETURNING *
    `;

    const row = await this.queryOne<RollupExecutionRow>(query, params);

    if (!row) {
      throw new Error('Execution not found');
    }

    return this.mapRowToExecutionEntity(row);
  }

  /**
   * List executions for a rollup
   */
  async listExecutions(
    tenantId: TenantId,
    rollupId: RollupId,
    limit = 10
  ): Promise<RollupExecutionEntity[]> {
    const query = `
      SELECT * FROM rollup_executions
      WHERE rollup_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    const rows = await this.queryAll<RollupExecutionRow>(query, [rollupId, tenantId, limit]);

    return rows.map(row => this.mapRowToExecutionEntity(row));
  }

  /**
   * Count executions for a rollup
   */
  async countExecutions(
    tenantId: TenantId,
    rollupId: RollupId,
    status?: RollupExecutionEntity['status']
  ): Promise<number> {
    let query = `
      SELECT COUNT(*)::int as count FROM rollup_executions
      WHERE rollup_id = $1 AND tenant_id = $2
    `;
    const params: unknown[] = [rollupId, tenantId];

    if (status) {
      query += ` AND status = $3`;
      params.push(status);
    }

    const result = await this.queryOne<{ count: number }>(query, params);
    return result?.count ?? 0;
  }

  /**
   * Delete all executions for a rollup
   */
  async deleteExecutions(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<number> {
    const result = await this.query(
      `DELETE FROM rollup_executions WHERE rollup_id = $1 AND tenant_id = $2`,
      [rollupId, tenantId]
    );
    return result.rowCount ?? 0;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get safe sort column name
   */
  private getSortColumn(sortBy?: string): string {
    const allowedColumns: Record<string, string> = {
      name: 'name',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      lastExecutedAt: 'last_executed_at',
    };

    return allowedColumns[sortBy ?? 'createdAt'] ?? 'created_at';
  }

  /**
   * Map database row to RollupEntity
   */
  private mapRowToRollupEntity(row: RollupRow): RollupEntity {
    return {
      id: createRollupId(row.id),
      tenantId: row.tenant_id as TenantId,
      name: row.name,
      description: row.description,
      status: row.status as RollupStatus,
      repositoryIds: row.repository_ids as unknown as import('../types/entities.js').RepositoryId[],
      scanIds: row.scan_ids as unknown as ScanId[] | null,
      matchers: row.matchers as unknown as MatcherConfig[],
      includeNodeTypes: row.include_node_types,
      excludeNodeTypes: row.exclude_node_types,
      preserveEdgeTypes: row.preserve_edge_types,
      mergeOptions: row.merge_options as unknown as import('../types/rollup.js').RollupConfig['mergeOptions'],
      schedule: row.schedule as unknown as import('../types/rollup.js').RollupConfig['schedule'] | null,
      version: row.version,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastExecutedAt: row.last_executed_at,
    };
  }

  /**
   * Map database row to RollupExecutionEntity
   */
  private mapRowToExecutionEntity(row: RollupExecutionRow): RollupExecutionEntity {
    return {
      id: createRollupExecutionId(row.id),
      rollupId: createRollupId(row.rollup_id),
      tenantId: row.tenant_id as TenantId,
      status: row.status as RollupExecutionEntity['status'],
      scanIds: row.scan_ids as unknown as ScanId[],
      stats: row.stats as unknown as RollupExecutionStats | null,
      matches: row.matches as unknown as MatchResult[] | null,
      mergedGraphId: row.merged_graph_id,
      errorMessage: row.error_message,
      errorDetails: row.error_details,
      callbackUrl: row.callback_url,
      options: row.options as unknown as RollupExecuteRequest['options'] | null,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new rollup repository instance
 */
export function createRollupRepository(): IRollupRepository {
  return new RollupRepository();
}
