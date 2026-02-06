/**
 * Edge Repository Implementation
 * @module repositories/edge-repository
 *
 * Implements IEdgeRepository for graph edge persistence.
 * Handles batch insert, confidence updates, and querying by source/target.
 *
 * TASK-DETECT: Edge data layer implementation
 */

import {
  ScanId,
  EdgeEntity,
  TenantId,
  DbNodeId,
  DbEdgeId,
  createDbEdgeId,
  createDbNodeId,
  createScanId,
} from '../types/entities.js';
import { EdgeType } from '../types/graph.js';
import {
  IEdgeRepository,
  CreateEdgeInput,
  EdgeFilterCriteria,
  PaginationParams,
  PaginatedResult,
  BatchResult,
} from './interfaces.js';
import { BaseRepository } from './base-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row type for edges table
 */
interface EdgeRow {
  id: string;
  scan_id: string;
  tenant_id: string;
  original_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  label: string | null;
  is_implicit: boolean;
  confidence: number;
  attribute: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Edge repository for managing graph edges
 */
export class EdgeRepository extends BaseRepository implements IEdgeRepository {
  constructor() {
    super('edges');
  }

  /**
   * Batch insert edges
   */
  async batchInsert(edges: CreateEdgeInput[]): Promise<BatchResult> {
    if (edges.length === 0) {
      return { inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    const columns = [
      'id',
      'scan_id',
      'tenant_id',
      'original_id',
      'source_node_id',
      'target_node_id',
      'edge_type',
      'label',
      'is_implicit',
      'confidence',
      'attribute',
      'metadata',
      'created_at',
    ];

    return this.batchInsertWithChunks(
      edges,
      columns,
      (edge) => [
        this.generateId(),
        edge.scanId,
        edge.tenantId,
        edge.originalId,
        edge.sourceNodeId,
        edge.targetNodeId,
        edge.edgeType,
        edge.label ?? null,
        edge.isImplicit,
        edge.confidence,
        edge.attribute ?? null,
        JSON.stringify(edge.metadata),
        new Date(),
      ],
      500
    );
  }

  /**
   * Find edge by ID
   */
  async findById(id: DbEdgeId, tenantId: TenantId): Promise<EdgeEntity | null> {
    const query = `
      SELECT * FROM edges
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<EdgeRow>(query, [id, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToEdgeEntity(row);
  }

  /**
   * Find edges by scan
   */
  async findByScan(
    scanId: ScanId,
    tenantId: TenantId,
    filter?: EdgeFilterCriteria,
    pagination: PaginationParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResult<EdgeEntity>> {
    const conditions: string[] = ['scan_id = $1', 'tenant_id = $2'];
    const params: unknown[] = [scanId, tenantId];
    let paramIndex = 3;

    if (filter?.edgeType) {
      if (Array.isArray(filter.edgeType)) {
        const placeholders = filter.edgeType.map(() => `$${paramIndex++}`);
        conditions.push(`edge_type IN (${placeholders.join(', ')})`);
        params.push(...filter.edgeType);
      } else {
        conditions.push(`edge_type = $${paramIndex++}`);
        params.push(filter.edgeType);
      }
    }

    if (filter?.isImplicit !== undefined) {
      conditions.push(`is_implicit = $${paramIndex++}`);
      params.push(filter.isImplicit);
    }

    if (filter?.minConfidence !== undefined) {
      conditions.push(`confidence >= $${paramIndex++}`);
      params.push(filter.minConfidence);
    }

    if (filter?.maxConfidence !== undefined) {
      conditions.push(`confidence <= $${paramIndex++}`);
      params.push(filter.maxConfidence);
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT * FROM edges
      WHERE ${whereClause}
      ORDER BY confidence DESC, created_at
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM edges
      WHERE ${whereClause}
    `;

    const result = await this.queryPaginated<EdgeRow>(
      baseQuery,
      countQuery,
      params,
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToEdgeEntity(row)),
    };
  }

  /**
   * Find edges by source node
   */
  async findBySource(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId
  ): Promise<EdgeEntity[]> {
    const query = `
      SELECT * FROM edges
      WHERE scan_id = $1 AND tenant_id = $2 AND source_node_id = $3
      ORDER BY confidence DESC
    `;

    const rows = await this.queryAll<EdgeRow>(query, [
      scanId,
      tenantId,
      sourceNodeId,
    ]);

    return rows.map(row => this.mapRowToEdgeEntity(row));
  }

  /**
   * Find edges by target node
   */
  async findByTarget(
    scanId: ScanId,
    tenantId: TenantId,
    targetNodeId: DbNodeId
  ): Promise<EdgeEntity[]> {
    const query = `
      SELECT * FROM edges
      WHERE scan_id = $1 AND tenant_id = $2 AND target_node_id = $3
      ORDER BY confidence DESC
    `;

    const rows = await this.queryAll<EdgeRow>(query, [
      scanId,
      tenantId,
      targetNodeId,
    ]);

    return rows.map(row => this.mapRowToEdgeEntity(row));
  }

  /**
   * Update confidence score
   */
  async updateConfidence(
    id: DbEdgeId,
    tenantId: TenantId,
    confidence: number
  ): Promise<void> {
    const query = `
      UPDATE edges
      SET confidence = $1
      WHERE id = $2 AND tenant_id = $3
    `;

    await this.query(query, [confidence, id, tenantId]);
  }

  /**
   * Bulk update confidence scores
   */
  async bulkUpdateConfidence(
    updates: Array<{ id: DbEdgeId; confidence: number }>,
    tenantId: TenantId
  ): Promise<number> {
    if (updates.length === 0) {
      return 0;
    }

    // Use CASE WHEN for efficient bulk update
    const whenClauses: string[] = [];
    const ids: string[] = [];

    updates.forEach((update, index) => {
      whenClauses.push(`WHEN id = $${index * 2 + 1} THEN $${index * 2 + 2}`);
      ids.push(update.id);
    });

    const params: unknown[] = [];
    updates.forEach(update => {
      params.push(update.id);
      params.push(update.confidence);
    });

    const idPlaceholders = ids.map((_, i) => `$${i * 2 + 1}`).join(', ');

    const query = `
      UPDATE edges
      SET confidence = CASE ${whenClauses.join(' ')} END
      WHERE id IN (${idPlaceholders}) AND tenant_id = $${params.length + 1}
    `;

    params.push(tenantId);

    const result = await this.query(query, params);
    return result.rowCount ?? 0;
  }

  /**
   * Delete all edges for a scan
   */
  async deleteByScan(scanId: ScanId, tenantId: TenantId): Promise<number> {
    const query = `
      DELETE FROM edges
      WHERE scan_id = $1 AND tenant_id = $2
    `;

    const result = await this.query(query, [scanId, tenantId]);
    return result.rowCount ?? 0;
  }

  /**
   * Get edge counts by type for a scan
   */
  async getCountsByType(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<EdgeType, number>> {
    const query = `
      SELECT edge_type, COUNT(*)::int as count
      FROM edges
      WHERE scan_id = $1 AND tenant_id = $2
      GROUP BY edge_type
    `;

    const rows = await this.queryAll<{ edge_type: string; count: number }>(
      query,
      [scanId, tenantId]
    );

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.edge_type] = row.count;
    }

    return counts as Record<EdgeType, number>;
  }

  /**
   * Get confidence distribution for a scan
   */
  async getConfidenceDistribution(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<{
    certain: number;
    high: number;
    medium: number;
    low: number;
    uncertain: number;
  }> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE confidence >= 95)::int as certain,
        COUNT(*) FILTER (WHERE confidence >= 80 AND confidence < 95)::int as high,
        COUNT(*) FILTER (WHERE confidence >= 60 AND confidence < 80)::int as medium,
        COUNT(*) FILTER (WHERE confidence >= 40 AND confidence < 60)::int as low,
        COUNT(*) FILTER (WHERE confidence < 40)::int as uncertain
      FROM edges
      WHERE scan_id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<{
      certain: number;
      high: number;
      medium: number;
      low: number;
      uncertain: number;
    }>(query, [scanId, tenantId]);

    if (!row) {
      return { certain: 0, high: 0, medium: 0, low: 0, uncertain: 0 };
    }

    return row;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Map database row to EdgeEntity
   */
  private mapRowToEdgeEntity(row: EdgeRow): EdgeEntity {
    return {
      id: createDbEdgeId(row.id),
      scanId: createScanId(row.scan_id),
      tenantId: row.tenant_id as TenantId,
      originalId: row.original_id,
      sourceNodeId: createDbNodeId(row.source_node_id),
      targetNodeId: createDbNodeId(row.target_node_id),
      edgeType: row.edge_type as EdgeType,
      label: row.label ?? undefined,
      isImplicit: row.is_implicit,
      confidence: row.confidence,
      attribute: row.attribute ?? undefined,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new edge repository instance
 */
export function createEdgeRepository(): IEdgeRepository {
  return new EdgeRepository();
}
