/**
 * Evidence Repository Implementation
 * @module repositories/evidence-repository
 *
 * Implements IEvidenceRepository for evidence persistence.
 * Handles batch insert, aggregation queries, and querying by edge/scan.
 *
 * TASK-DETECT: Evidence data layer implementation
 */

import {
  ScanId,
  TenantId,
  DbEdgeId,
  createDbEdgeId,
  createScanId,
} from '../types/entities.js';
import { EvidenceType, EvidenceCategory } from '../types/evidence.js';
import {
  IEvidenceRepository,
  EvidenceEntity,
  CreateEvidenceInput,
  EvidenceFilterCriteria,
  PaginationParams,
  PaginatedResult,
  BatchResult,
} from './interfaces.js';
import { BaseRepository } from './base-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row type for evidence table
 */
interface EvidenceRow {
  id: string;
  edge_id: string;
  scan_id: string;
  tenant_id: string;
  type: string;
  category: string;
  description: string;
  confidence: number;
  file_path: string;
  line_start: number;
  line_end: number;
  column_start: number | null;
  column_end: number | null;
  snippet: string | null;
  raw: Record<string, unknown> | null;
  created_at: Date;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Evidence repository for managing detection evidence
 */
export class EvidenceRepository extends BaseRepository implements IEvidenceRepository {
  constructor() {
    super('evidence');
  }

  /**
   * Batch insert evidence
   */
  async batchInsert(evidence: CreateEvidenceInput[]): Promise<BatchResult> {
    if (evidence.length === 0) {
      return { inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    const columns = [
      'id',
      'edge_id',
      'scan_id',
      'tenant_id',
      'type',
      'category',
      'description',
      'confidence',
      'file_path',
      'line_start',
      'line_end',
      'column_start',
      'column_end',
      'snippet',
      'raw',
      'created_at',
    ];

    return this.batchInsertWithChunks(
      evidence,
      columns,
      (ev) => [
        this.generateId(),
        ev.edgeId,
        ev.scanId,
        ev.tenantId,
        ev.type,
        ev.category,
        ev.description,
        ev.confidence,
        ev.filePath,
        ev.lineStart,
        ev.lineEnd,
        ev.columnStart ?? null,
        ev.columnEnd ?? null,
        ev.snippet ?? null,
        ev.raw ? JSON.stringify(ev.raw) : null,
        new Date(),
      ],
      500
    );
  }

  /**
   * Find evidence by edge
   */
  async findByEdge(
    edgeId: DbEdgeId,
    tenantId: TenantId
  ): Promise<EvidenceEntity[]> {
    const query = `
      SELECT * FROM evidence
      WHERE edge_id = $1 AND tenant_id = $2
      ORDER BY confidence DESC, created_at
    `;

    const rows = await this.queryAll<EvidenceRow>(query, [edgeId, tenantId]);
    return rows.map(row => this.mapRowToEvidenceEntity(row));
  }

  /**
   * Find evidence by scan
   */
  async findByScan(
    scanId: ScanId,
    tenantId: TenantId,
    filter?: EvidenceFilterCriteria,
    pagination: PaginationParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResult<EvidenceEntity>> {
    const conditions: string[] = ['scan_id = $1', 'tenant_id = $2'];
    const params: unknown[] = [scanId, tenantId];
    let paramIndex = 3;

    if (filter?.type) {
      if (Array.isArray(filter.type)) {
        const placeholders = filter.type.map(() => `$${paramIndex++}`);
        conditions.push(`type IN (${placeholders.join(', ')})`);
        params.push(...filter.type);
      } else {
        conditions.push(`type = $${paramIndex++}`);
        params.push(filter.type);
      }
    }

    if (filter?.category) {
      if (Array.isArray(filter.category)) {
        const placeholders = filter.category.map(() => `$${paramIndex++}`);
        conditions.push(`category IN (${placeholders.join(', ')})`);
        params.push(...filter.category);
      } else {
        conditions.push(`category = $${paramIndex++}`);
        params.push(filter.category);
      }
    }

    if (filter?.minConfidence !== undefined) {
      conditions.push(`confidence >= $${paramIndex++}`);
      params.push(filter.minConfidence);
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT * FROM evidence
      WHERE ${whereClause}
      ORDER BY confidence DESC, created_at
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM evidence
      WHERE ${whereClause}
    `;

    const result = await this.queryPaginated<EvidenceRow>(
      baseQuery,
      countQuery,
      params,
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToEvidenceEntity(row)),
    };
  }

  /**
   * Aggregate evidence by type for a scan
   */
  async aggregateByType(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<EvidenceType, { count: number; avgConfidence: number }>> {
    const query = `
      SELECT
        type,
        COUNT(*)::int as count,
        AVG(confidence)::numeric(5,2) as avg_confidence
      FROM evidence
      WHERE scan_id = $1 AND tenant_id = $2
      GROUP BY type
      ORDER BY count DESC
    `;

    const rows = await this.queryAll<{
      type: string;
      count: number;
      avg_confidence: number;
    }>(query, [scanId, tenantId]);

    const result: Record<string, { count: number; avgConfidence: number }> = {};
    for (const row of rows) {
      result[row.type] = {
        count: row.count,
        avgConfidence: parseFloat(String(row.avg_confidence)),
      };
    }

    return result as Record<EvidenceType, { count: number; avgConfidence: number }>;
  }

  /**
   * Aggregate evidence by category for a scan
   */
  async aggregateByCategory(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<EvidenceCategory, { count: number; avgConfidence: number }>> {
    const query = `
      SELECT
        category,
        COUNT(*)::int as count,
        AVG(confidence)::numeric(5,2) as avg_confidence
      FROM evidence
      WHERE scan_id = $1 AND tenant_id = $2
      GROUP BY category
      ORDER BY count DESC
    `;

    const rows = await this.queryAll<{
      category: string;
      count: number;
      avg_confidence: number;
    }>(query, [scanId, tenantId]);

    const result: Record<string, { count: number; avgConfidence: number }> = {};
    for (const row of rows) {
      result[row.category] = {
        count: row.count,
        avgConfidence: parseFloat(String(row.avg_confidence)),
      };
    }

    return result as Record<EvidenceCategory, { count: number; avgConfidence: number }>;
  }

  /**
   * Delete all evidence for a scan
   */
  async deleteByScan(scanId: ScanId, tenantId: TenantId): Promise<number> {
    const query = `
      DELETE FROM evidence
      WHERE scan_id = $1 AND tenant_id = $2
    `;

    const result = await this.query(query, [scanId, tenantId]);
    return result.rowCount ?? 0;
  }

  /**
   * Delete evidence by edge
   */
  async deleteByEdge(edgeId: DbEdgeId, tenantId: TenantId): Promise<number> {
    const query = `
      DELETE FROM evidence
      WHERE edge_id = $1 AND tenant_id = $2
    `;

    const result = await this.query(query, [edgeId, tenantId]);
    return result.rowCount ?? 0;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Map database row to EvidenceEntity
   */
  private mapRowToEvidenceEntity(row: EvidenceRow): EvidenceEntity {
    return {
      id: row.id,
      edgeId: createDbEdgeId(row.edge_id),
      scanId: createScanId(row.scan_id),
      tenantId: row.tenant_id as TenantId,
      type: row.type as EvidenceType,
      category: row.category as EvidenceCategory,
      description: row.description,
      confidence: row.confidence,
      filePath: row.file_path,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      columnStart: row.column_start ?? undefined,
      columnEnd: row.column_end ?? undefined,
      snippet: row.snippet ?? undefined,
      raw: row.raw ?? undefined,
      createdAt: row.created_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new evidence repository instance
 */
export function createEvidenceRepository(): IEvidenceRepository {
  return new EvidenceRepository();
}
