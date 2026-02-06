/**
 * Node Repository Implementation
 * @module repositories/node-repository
 *
 * Implements INodeRepository for graph node persistence.
 * Handles batch insert, upsert, and efficient querying by scan/type.
 *
 * TASK-DETECT: Node data layer implementation
 */

import {
  ScanId,
  NodeEntity,
  TenantId,
  DbNodeId,
  createDbNodeId,
  createScanId,
} from '../types/entities.js';
import { NodeTypeName } from '../types/graph.js';
import {
  INodeRepository,
  CreateNodeInput,
  NodeFilterCriteria,
  PaginationParams,
  PaginatedResult,
  BatchResult,
} from './interfaces.js';
import { BaseRepository } from './base-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row type for nodes table
 */
interface NodeRow {
  id: string;
  scan_id: string;
  tenant_id: string;
  original_id: string;
  node_type: string;
  name: string;
  file_path: string;
  line_start: number;
  line_end: number;
  column_start: number | null;
  column_end: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Node repository for managing graph nodes
 */
export class NodeRepository extends BaseRepository implements INodeRepository {
  constructor() {
    super('nodes');
  }

  /**
   * Batch insert nodes
   */
  async batchInsert(nodes: CreateNodeInput[]): Promise<BatchResult> {
    if (nodes.length === 0) {
      return { inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    const columns = [
      'id',
      'scan_id',
      'tenant_id',
      'original_id',
      'node_type',
      'name',
      'file_path',
      'line_start',
      'line_end',
      'column_start',
      'column_end',
      'metadata',
      'created_at',
    ];

    return this.batchInsertWithChunks(
      nodes,
      columns,
      (node) => [
        this.generateId(),
        node.scanId,
        node.tenantId,
        node.originalId,
        node.nodeType,
        node.name,
        node.filePath,
        node.lineStart,
        node.lineEnd,
        node.columnStart ?? null,
        node.columnEnd ?? null,
        JSON.stringify(node.metadata),
        new Date(),
      ],
      500 // Smaller chunks for nodes (more data per row)
    );
  }

  /**
   * Find node by ID
   */
  async findById(id: DbNodeId, tenantId: TenantId): Promise<NodeEntity | null> {
    const query = `
      SELECT * FROM nodes
      WHERE id = $1 AND tenant_id = $2
    `;

    const row = await this.queryOne<NodeRow>(query, [id, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapRowToNodeEntity(row);
  }

  /**
   * Find nodes by scan
   */
  async findByScan(
    scanId: ScanId,
    tenantId: TenantId,
    filter?: NodeFilterCriteria,
    pagination: PaginationParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResult<NodeEntity>> {
    const conditions: string[] = ['scan_id = $1', 'tenant_id = $2'];
    const params: unknown[] = [scanId, tenantId];
    let paramIndex = 3;

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

    if (filter?.filePath) {
      conditions.push(`file_path ILIKE $${paramIndex++}`);
      params.push(`%${filter.filePath}%`);
    }

    if (filter?.name) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filter.name}%`);
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT * FROM nodes
      WHERE ${whereClause}
      ORDER BY file_path, line_start
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM nodes
      WHERE ${whereClause}
    `;

    const result = await this.queryPaginated<NodeRow>(
      baseQuery,
      countQuery,
      params,
      pagination
    );

    return {
      ...result,
      data: result.data.map(row => this.mapRowToNodeEntity(row)),
    };
  }

  /**
   * Find nodes by type
   */
  async findByType(
    scanId: ScanId,
    tenantId: TenantId,
    nodeType: NodeTypeName | NodeTypeName[]
  ): Promise<NodeEntity[]> {
    let query: string;
    let params: unknown[];

    if (Array.isArray(nodeType)) {
      const placeholders = nodeType.map((_, i) => `$${i + 3}`);
      query = `
        SELECT * FROM nodes
        WHERE scan_id = $1 AND tenant_id = $2 AND node_type IN (${placeholders.join(', ')})
        ORDER BY file_path, line_start
      `;
      params = [scanId, tenantId, ...nodeType];
    } else {
      query = `
        SELECT * FROM nodes
        WHERE scan_id = $1 AND tenant_id = $2 AND node_type = $3
        ORDER BY file_path, line_start
      `;
      params = [scanId, tenantId, nodeType];
    }

    const rows = await this.queryAll<NodeRow>(query, params);
    return rows.map(row => this.mapRowToNodeEntity(row));
  }

  /**
   * Find node by original ID
   */
  async findByOriginalId(
    scanId: ScanId,
    tenantId: TenantId,
    originalId: string
  ): Promise<NodeEntity | null> {
    const query = `
      SELECT * FROM nodes
      WHERE scan_id = $1 AND tenant_id = $2 AND original_id = $3
    `;

    const row = await this.queryOne<NodeRow>(query, [scanId, tenantId, originalId]);

    if (!row) {
      return null;
    }

    return this.mapRowToNodeEntity(row);
  }

  /**
   * Bulk upsert nodes
   */
  async bulkUpsert(nodes: CreateNodeInput[]): Promise<BatchResult> {
    if (nodes.length === 0) {
      return { inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    const columns = [
      'id',
      'scan_id',
      'tenant_id',
      'original_id',
      'node_type',
      'name',
      'file_path',
      'line_start',
      'line_end',
      'column_start',
      'column_end',
      'metadata',
      'created_at',
    ];

    const conflictColumns = ['scan_id', 'tenant_id', 'original_id'];
    const updateColumns = [
      'node_type',
      'name',
      'file_path',
      'line_start',
      'line_end',
      'column_start',
      'column_end',
      'metadata',
    ];

    return this.batchUpsert(
      nodes,
      columns,
      conflictColumns,
      updateColumns,
      (node) => [
        this.generateId(),
        node.scanId,
        node.tenantId,
        node.originalId,
        node.nodeType,
        node.name,
        node.filePath,
        node.lineStart,
        node.lineEnd,
        node.columnStart ?? null,
        node.columnEnd ?? null,
        JSON.stringify(node.metadata),
        new Date(),
      ],
      500
    );
  }

  /**
   * Delete all nodes for a scan
   */
  async deleteByScan(scanId: ScanId, tenantId: TenantId): Promise<number> {
    const query = `
      DELETE FROM nodes
      WHERE scan_id = $1 AND tenant_id = $2
    `;

    const result = await this.query(query, [scanId, tenantId]);
    return result.rowCount ?? 0;
  }

  /**
   * Get node counts by type for a scan
   */
  async getCountsByType(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<NodeTypeName, number>> {
    const query = `
      SELECT node_type, COUNT(*)::int as count
      FROM nodes
      WHERE scan_id = $1 AND tenant_id = $2
      GROUP BY node_type
    `;

    const rows = await this.queryAll<{ node_type: string; count: number }>(
      query,
      [scanId, tenantId]
    );

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.node_type] = row.count;
    }

    return counts as Record<NodeTypeName, number>;
  }

  /**
   * Get node ID mapping (original to database ID)
   */
  async getIdMapping(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Map<string, DbNodeId>> {
    const query = `
      SELECT id, original_id
      FROM nodes
      WHERE scan_id = $1 AND tenant_id = $2
    `;

    const rows = await this.queryAll<{ id: string; original_id: string }>(
      query,
      [scanId, tenantId]
    );

    const mapping = new Map<string, DbNodeId>();
    for (const row of rows) {
      mapping.set(row.original_id, createDbNodeId(row.id));
    }

    return mapping;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Map database row to NodeEntity
   */
  private mapRowToNodeEntity(row: NodeRow): NodeEntity {
    return {
      id: createDbNodeId(row.id),
      scanId: createScanId(row.scan_id),
      tenantId: row.tenant_id as TenantId,
      originalId: row.original_id,
      nodeType: row.node_type as NodeTypeName,
      name: row.name,
      filePath: row.file_path,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      columnStart: row.column_start ?? undefined,
      columnEnd: row.column_end ?? undefined,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new node repository instance
 */
export function createNodeRepository(): INodeRepository {
  return new NodeRepository();
}
