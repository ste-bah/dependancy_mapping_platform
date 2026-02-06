/**
 * Scan Repository Implementation
 * @module repositories/scan-repository
 *
 * Implements IScanRepository for scan entity persistence.
 * Handles CRUD operations, status updates, and progress tracking.
 *
 * TASK-DETECT: Scan data layer implementation
 */

import {
  ScanId,
  ScanEntity,
  ScanStatus,
  ScanProgress,
  ScanResultSummary,
  ScanConfig,
  TenantId,
  RepositoryId,
  UserId,
  createScanId,
  createEmptyScanProgress,
  DEFAULT_SCAN_CONFIG,
} from '../types/entities.js';
import {
  IScanRepository,
  CreateScanInput,
  ScanFilterCriteria,
  PaginationParams,
  PaginatedResult,
} from './interfaces.js';
import { BaseRepository } from './base-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row type for scans table
 */
interface ScanRow {
  id: string;
  tenant_id: string;
  repository_id: string;
  initiated_by: string;
  status: string;
  config: Record<string, unknown>;
  ref: string;
  commit_sha: string;
  progress: Record<string, unknown>;
  result_summary: Record<string, unknown> | null;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Scan repository for managing scan entities
 */
export class ScanRepository extends BaseRepository implements IScanRepository {
  constructor() {
    super('scans');
  }

  /**
   * Create a new scan
   */
  async create(input: CreateScanInput): Promise<ScanEntity> {
    const id = this.generateId();
    const now = new Date();
    const progress = createEmptyScanProgress();
    const config = { ...DEFAULT_SCAN_CONFIG, ...input.config } as ScanConfig;

    const query = `
      INSERT INTO scans (
        id, tenant_id, repository_id, initiated_by, status,
        config, ref, commit_sha, progress, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING *
    `;

    const params = [
      id,
      input.tenantId,
      input.repositoryId,
      input.initiatedBy,
      ScanStatus.PENDING,
      JSON.stringify(config),
      input.ref,
      input.commitSha,
      JSON.stringify(progress),
      now,
      now,
    ];

    const row = await this.queryOne<ScanRow>(query, params, {
      tenantId: input.tenantId,
    });

    if (!row) {
      throw new Error('Failed to create scan');
    }

    return this.mapRowToScanEntity(row);
  }

  /**
   * Find scan by ID
   */
  async findById(id: ScanId, tenantId: TenantId): Promise<ScanEntity | null> {
    const query = `
      SELECT * FROM scans
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<ScanRow>(query, [id, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToScanEntity(row);
  }

  /**
   * Find scans by repository
   */
  async findByRepository(
    repositoryId: RepositoryId,
    tenantId: TenantId,
    pagination: PaginationParams = { page: 1, pageSize: 20 }
  ): Promise<PaginatedResult<ScanEntity>> {
    const baseQuery = `
      SELECT * FROM scans
      WHERE repository_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM scans
      WHERE repository_id = $1 AND tenant_id = $2
    `;

    const result = await this.queryPaginated<ScanRow>(
      baseQuery,
      countQuery,
      [repositoryId, tenantId],
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToScanEntity(row)),
    };
  }

  /**
   * Find scans by tenant
   */
  async findByTenant(
    tenantId: TenantId,
    filter?: ScanFilterCriteria,
    pagination: PaginationParams = { page: 1, pageSize: 20 }
  ): Promise<PaginatedResult<ScanEntity>> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        const placeholders = filter.status.map(() => `$${paramIndex++}`);
        conditions.push(`status IN (${placeholders.join(', ')})`);
        params.push(...filter.status);
      } else {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filter.status);
      }
    }

    if (filter?.repositoryId) {
      conditions.push(`repository_id = $${paramIndex++}`);
      params.push(filter.repositoryId);
    }

    if (filter?.initiatedBy) {
      conditions.push(`initiated_by = $${paramIndex++}`);
      params.push(filter.initiatedBy);
    }

    if (filter?.startedAfter) {
      conditions.push(`started_at >= $${paramIndex++}`);
      params.push(filter.startedAfter);
    }

    if (filter?.startedBefore) {
      conditions.push(`started_at <= $${paramIndex++}`);
      params.push(filter.startedBefore);
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT * FROM scans
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM scans
      WHERE ${whereClause}
    `;

    const result = await this.queryPaginated<ScanRow>(
      baseQuery,
      countQuery,
      params,
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToScanEntity(row)),
    };
  }

  /**
   * Update scan entity
   */
  async update(
    id: ScanId,
    tenantId: TenantId,
    updates: Partial<ScanEntity>
  ): Promise<ScanEntity> {
    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Map entity fields to database columns
    const fieldMap: Record<string, string> = {
      status: 'status',
      config: 'config',
      progress: 'progress',
      resultSummary: 'result_summary',
      errorMessage: 'error_message',
      startedAt: 'started_at',
      completedAt: 'completed_at',
    };

    for (const [entityField, dbColumn] of Object.entries(fieldMap)) {
      const value = updates[entityField as keyof ScanEntity];
      if (value !== undefined) {
        updateFields.push(`${dbColumn} = $${paramIndex++}`);
        // Serialize objects to JSON
        if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    }

    if (updateFields.length === 0) {
      const existing = await this.findById(id, tenantId);
      if (!existing) {
        throw new Error('Scan not found');
      }
      return existing;
    }

    // Always update updated_at
    updateFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());

    // Add WHERE params
    params.push(id);
    params.push(tenantId);

    const query = `
      UPDATE scans
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
      RETURNING *
    `;

    const row = await this.queryOne<ScanRow>(query, params);

    if (!row) {
      throw new Error('Scan not found');
    }

    return this.mapRowToScanEntity(row);
  }

  /**
   * Update scan status
   */
  async updateStatus(
    id: ScanId,
    tenantId: TenantId,
    status: ScanStatus,
    errorMessage?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };

    if (status === ScanStatus.RUNNING) {
      updates.started_at = new Date();
    } else if (status === ScanStatus.COMPLETED || status === ScanStatus.FAILED) {
      updates.completed_at = new Date();
    }

    if (errorMessage !== undefined) {
      updates.error_message = errorMessage;
    }

    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [column, value] of Object.entries(updates)) {
      updateFields.push(`${column} = $${paramIndex++}`);
      params.push(value);
    }

    params.push(id);
    params.push(tenantId);

    const query = `
      UPDATE scans
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
    `;

    await this.query(query, params);
  }

  /**
   * Update scan progress
   */
  async updateProgress(
    id: ScanId,
    tenantId: TenantId,
    progress: ScanProgress
  ): Promise<void> {
    const query = `
      UPDATE scans
      SET progress = $1, updated_at = $2
      WHERE id = $3 AND tenant_id = $4
    `;

    await this.query(query, [
      JSON.stringify(progress),
      new Date(),
      id,
      tenantId,
    ]);
  }

  /**
   * Update scan result summary
   */
  async updateResultSummary(
    id: ScanId,
    tenantId: TenantId,
    summary: ScanResultSummary
  ): Promise<void> {
    const query = `
      UPDATE scans
      SET result_summary = $1, updated_at = $2
      WHERE id = $3 AND tenant_id = $4
    `;

    await this.query(query, [
      JSON.stringify(summary),
      new Date(),
      id,
      tenantId,
    ]);
  }

  /**
   * Delete scan and all related data
   */
  async delete(id: ScanId, tenantId: TenantId): Promise<void> {
    // Delete in order due to foreign key constraints
    // Evidence -> Edges -> Nodes -> Scan
    await this.withTransaction(async (client) => {
      // Delete evidence
      await client.query(
        `DELETE FROM evidence WHERE scan_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      // Delete edges
      await client.query(
        `DELETE FROM edges WHERE scan_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      // Delete nodes
      await client.query(
        `DELETE FROM nodes WHERE scan_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      // Delete scan
      await client.query(
        `DELETE FROM scans WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
    });
  }

  /**
   * Get latest scan for repository
   */
  async getLatestForRepository(
    repositoryId: RepositoryId,
    tenantId: TenantId
  ): Promise<ScanEntity | null> {
    const query = `
      SELECT * FROM scans
      WHERE repository_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const row = await this.queryOne<ScanRow>(query, [repositoryId, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToScanEntity(row);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Map database row to ScanEntity
   */
  private mapRowToScanEntity(row: ScanRow): ScanEntity {
    return {
      id: createScanId(row.id),
      tenantId: row.tenant_id as TenantId,
      repositoryId: row.repository_id as RepositoryId,
      initiatedBy: row.initiated_by as UserId,
      status: row.status as ScanStatus,
      config: row.config as unknown as ScanConfig,
      ref: row.ref,
      commitSha: row.commit_sha,
      progress: row.progress as unknown as ScanProgress,
      resultSummary: row.result_summary as unknown as ScanResultSummary | undefined,
      errorMessage: row.error_message ?? undefined,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new scan repository instance
 */
export function createScanRepository(): IScanRepository {
  return new ScanRepository();
}
