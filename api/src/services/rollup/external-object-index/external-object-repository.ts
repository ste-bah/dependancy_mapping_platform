/**
 * External Object Repository
 * @module services/rollup/external-object-index/external-object-repository
 *
 * Repository implementation for external object index persistence.
 * Handles CRUD operations for external object entries in the database.
 * Includes optimized operations for the node_external_objects junction table.
 *
 * TASK-ROLLUP-003: External Object Index persistence
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 *
 * Performance Targets:
 * - findByReferenceHash: < 20ms with covering index
 * - findNodesByExternalObject: < 200ms for pagination
 * - bulkInsertJunction: 1000+ entries efficiently
 */

import pino from 'pino';
import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import type {
  IExternalObjectRepository,
  ExternalObjectEntry,
  ExternalReferenceType,
} from './interfaces.js';
import {
  computeReferenceHash,
  type ReferenceHash,
  type ExternalRefType,
} from './domain/types.js';

const logger = pino({ name: 'external-object-repository' });

/**
 * Database client interface (to be injected)
 */
export interface IDatabaseClient {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
  transaction<T>(fn: (client: IDatabaseClient) => Promise<T>): Promise<T>;
}

// ============================================================================
// Types for Junction Table Operations (NFR-PERF-008)
// ============================================================================

/**
 * External object ID type (UUID reference to external_objects_master)
 */
export type ExternalObjectId = string & { readonly __brand: 'ExternalObjectId' };

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
  readonly orderBy?: string;
  readonly orderDir?: 'asc' | 'desc';
}

/**
 * Node reference from reverse lookup
 */
export interface NodeReference {
  readonly nodeId: string;
  readonly repositoryId: RepositoryId;
  readonly scanId: ScanId;
  readonly refType: ExternalReferenceType;
  readonly confidence: number;
  readonly context: Record<string, unknown>;
  readonly createdAt: Date;
}

/**
 * Index entry for junction table operations
 */
export interface IndexEntry {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly nodeId: string;
  readonly externalObjectId: ExternalObjectId;
  readonly scanId: ScanId;
  readonly repositoryId: RepositoryId;
  readonly referenceHash: ReferenceHash;
  readonly refType: ExternalRefType;
  readonly confidence: number;
  readonly context: Record<string, unknown>;
  readonly createdAt: Date;
}

/**
 * Input for creating an index entry
 */
export interface IndexEntryCreate {
  readonly tenantId: TenantId;
  readonly nodeId: string;
  readonly externalObjectId: ExternalObjectId;
  readonly scanId: ScanId;
  readonly repositoryId: RepositoryId;
  readonly referenceHash: ReferenceHash;
  readonly refType: ExternalRefType;
  readonly confidence?: number;
  readonly context?: Record<string, unknown>;
}

/**
 * Repository statistics
 */
export interface RepositoryIndexStats {
  readonly totalEntries: number;
  readonly entriesByType: Record<ExternalReferenceType, number>;
  readonly uniqueExternalObjects: number;
  readonly uniqueNodes: number;
  readonly avgConfidence: number;
  readonly latestIndexedAt: Date | null;
}

/**
 * Extended repository interface for junction table operations
 */
export interface IExternalObjectIndexRepository extends IExternalObjectRepository {
  /**
   * Find by external ID using reference hash
   * CRITICAL: < 20ms with covering index
   */
  findByReferenceHash(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    referenceHash: ReferenceHash
  ): Promise<IndexEntry | null>;

  /**
   * Find by external ID (computes hash automatically)
   * CRITICAL: < 20ms with covering index
   */
  findByExternalIdHash(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    externalId: string,
    externalType?: ExternalRefType
  ): Promise<IndexEntry | null>;

  /**
   * Reverse lookup: find all nodes referencing an external object
   * CRITICAL: < 200ms for pagination (NFR-PERF-008)
   */
  findNodesByExternalObject(
    tenantId: TenantId,
    externalObjectId: ExternalObjectId,
    options: PaginationOptions
  ): Promise<{ nodes: NodeReference[]; total: number }>;

  /**
   * Bulk insert index entries
   * CRITICAL: Handle 1000+ entries efficiently
   */
  bulkInsertJunction(entries: IndexEntryCreate[]): Promise<{ inserted: number; skipped: number }>;

  /**
   * Delete entries for a scan (for rebuild)
   */
  deleteForScan(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    scanId: ScanId
  ): Promise<number>;

  /**
   * Get repository statistics
   */
  getStats(
    tenantId: TenantId,
    repositoryId?: RepositoryId
  ): Promise<RepositoryIndexStats>;
}

/**
 * Repository implementation for external object entries.
 * Uses database for persistent storage with optimized queries.
 * Implements both IExternalObjectRepository and IExternalObjectIndexRepository.
 */
export class ExternalObjectRepository implements IExternalObjectIndexRepository {
  private readonly tableName = 'external_object_index';
  private readonly junctionTableName = 'node_external_objects';

  /**
   * Default batch size for bulk operations (optimized for memory/performance balance)
   */
  private readonly BATCH_SIZE = 500;

  /**
   * Create a new ExternalObjectRepository
   * @param db - Database client
   */
  constructor(private readonly db: IDatabaseClient) {}

  /**
   * Save entries to the index
   */
  async saveEntries(entries: ExternalObjectEntry[]): Promise<number> {
    if (entries.length === 0) {
      return 0;
    }

    const startTime = Date.now();

    // Use batch insert with ON CONFLICT for upsert behavior
    const result = await this.db.transaction(async (client) => {
      let saved = 0;

      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchSaved = await this.insertBatch(client, batch);
        saved += batchSaved;
      }

      return saved;
    });

    logger.info(
      {
        entriesCount: entries.length,
        savedCount: result,
        timeMs: Date.now() - startTime,
      },
      'Entries saved to repository'
    );

    return result;
  }

  /**
   * Find entries by external ID
   */
  async findByExternalId(
    tenantId: TenantId,
    externalId: string,
    options?: {
      referenceType?: ExternalReferenceType;
      repositoryIds?: RepositoryId[];
      limit?: number;
      offset?: number;
    }
  ): Promise<ExternalObjectEntry[]> {
    const startTime = Date.now();

    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    // Support exact match or pattern matching (prefix match)
    if (externalId.endsWith('*')) {
      const prefix = externalId.slice(0, -1);
      conditions.push(`normalized_id LIKE $${paramIndex}`);
      params.push(`${prefix}%`);
    } else {
      conditions.push(`(external_id = $${paramIndex} OR normalized_id = $${paramIndex})`);
      params.push(externalId.toLowerCase());
    }
    paramIndex++;

    if (options?.referenceType) {
      conditions.push(`reference_type = $${paramIndex}`);
      params.push(options.referenceType);
      paramIndex++;
    }

    if (options?.repositoryIds && options.repositoryIds.length > 0) {
      const placeholders = options.repositoryIds.map((_, i) => `$${paramIndex + i}`);
      conditions.push(`repository_id IN (${placeholders.join(', ')})`);
      params.push(...options.repositoryIds);
      paramIndex += options.repositoryIds.length;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const sql = `
      SELECT
        id,
        external_id,
        reference_type,
        normalized_id,
        tenant_id,
        repository_id,
        scan_id,
        node_id,
        node_name,
        node_type,
        file_path,
        components,
        metadata,
        indexed_at
      FROM ${this.tableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY indexed_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const rows = await this.db.query<ExternalObjectEntryRow>(sql, params);

    logger.debug(
      {
        tenantId,
        externalId,
        resultCount: rows.length,
        timeMs: Date.now() - startTime,
      },
      'External ID lookup completed'
    );

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Find entries by node ID
   */
  async findByNodeId(
    tenantId: TenantId,
    nodeId: string,
    scanId: ScanId
  ): Promise<ExternalObjectEntry[]> {
    const startTime = Date.now();

    const sql = `
      SELECT
        id,
        external_id,
        reference_type,
        normalized_id,
        tenant_id,
        repository_id,
        scan_id,
        node_id,
        node_name,
        node_type,
        file_path,
        components,
        metadata,
        indexed_at
      FROM ${this.tableName}
      WHERE tenant_id = $1 AND node_id = $2 AND scan_id = $3
      ORDER BY reference_type, external_id
    `;

    const rows = await this.db.query<ExternalObjectEntryRow>(sql, [
      tenantId,
      nodeId,
      scanId,
    ]);

    logger.debug(
      {
        tenantId,
        nodeId,
        scanId,
        resultCount: rows.length,
        timeMs: Date.now() - startTime,
      },
      'Node ID lookup completed'
    );

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Delete entries matching criteria
   */
  async deleteEntries(
    tenantId: TenantId,
    criteria: {
      repositoryId?: RepositoryId;
      scanId?: ScanId;
      referenceType?: ExternalReferenceType;
    }
  ): Promise<number> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (criteria.repositoryId) {
      conditions.push(`repository_id = $${paramIndex}`);
      params.push(criteria.repositoryId);
      paramIndex++;
    }

    if (criteria.scanId) {
      conditions.push(`scan_id = $${paramIndex}`);
      params.push(criteria.scanId);
      paramIndex++;
    }

    if (criteria.referenceType) {
      conditions.push(`reference_type = $${paramIndex}`);
      params.push(criteria.referenceType);
      paramIndex++;
    }

    const sql = `
      DELETE FROM ${this.tableName}
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.db.execute(sql, params);

    logger.info(
      {
        tenantId,
        criteria,
        deletedCount: result.rowsAffected,
      },
      'Entries deleted'
    );

    return result.rowsAffected;
  }

  /**
   * Count entries matching criteria
   */
  async countEntries(
    tenantId: TenantId,
    criteria?: {
      referenceType?: ExternalReferenceType;
      repositoryId?: RepositoryId;
    }
  ): Promise<number> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (criteria?.referenceType) {
      conditions.push(`reference_type = $${paramIndex}`);
      params.push(criteria.referenceType);
      paramIndex++;
    }

    if (criteria?.repositoryId) {
      conditions.push(`repository_id = $${paramIndex}`);
      params.push(criteria.repositoryId);
      paramIndex++;
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE ${conditions.join(' AND ')}
    `;

    const rows = await this.db.query<{ count: string }>(sql, params);
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  /**
   * Get entry counts by type
   */
  async countByType(tenantId: TenantId): Promise<Record<ExternalReferenceType, number>> {
    const sql = `
      SELECT reference_type, COUNT(*) as count
      FROM ${this.tableName}
      WHERE tenant_id = $1
      GROUP BY reference_type
    `;

    const rows = await this.db.query<{ reference_type: ExternalReferenceType; count: string }>(
      sql,
      [tenantId]
    );

    const counts: Record<ExternalReferenceType, number> = {
      arn: 0,
      resource_id: 0,
      k8s_reference: 0,
      gcp_resource: 0,
      azure_resource: 0,
    };

    for (const row of rows) {
      counts[row.reference_type] = parseInt(row.count, 10);
    }

    return counts;
  }

  // ============================================================================
  // Junction Table Operations (NFR-PERF-008)
  // ============================================================================

  /**
   * Find by reference hash using covering index
   * CRITICAL: < 20ms with idx_neo_reference_hash index
   *
   * @param tenantId - Tenant ID for isolation
   * @param repositoryId - Repository ID
   * @param referenceHash - Pre-computed reference hash
   * @returns IndexEntry or null if not found
   */
  async findByReferenceHash(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    referenceHash: ReferenceHash
  ): Promise<IndexEntry | null> {
    const startTime = Date.now();

    const sql = `
      SELECT
        id, tenant_id, node_id, external_object_id,
        scan_id, repository_id, reference_hash, ref_type,
        confidence, context, created_at
      FROM ${this.junctionTableName}
      WHERE tenant_id = $1
        AND repository_id = $2
        AND reference_hash = $3
      LIMIT 1
    `;

    const rows = await this.db.query<JunctionRow>(sql, [
      tenantId,
      repositoryId,
      referenceHash,
    ]);

    const duration = Date.now() - startTime;
    logger.debug(
      {
        tenantId,
        repositoryId,
        referenceHash,
        found: rows.length > 0,
        timeMs: duration,
      },
      'Reference hash lookup completed'
    );

    // Performance check for NFR-PERF-008
    if (duration > 20) {
      logger.warn(
        { duration, referenceHash },
        'Reference hash lookup exceeded 20ms target'
      );
    }

    if (rows.length === 0 || !rows[0]) {
      return null;
    }
    return this.junctionRowToEntry(rows[0]);
  }

  /**
   * Find by external ID (computes hash automatically)
   * Convenience method that computes the hash and delegates to findByReferenceHash
   *
   * @param tenantId - Tenant ID
   * @param repositoryId - Repository ID
   * @param externalId - External identifier (e.g., ARN)
   * @param externalType - Reference type (defaults to 'arn')
   * @returns IndexEntry or null
   */
  async findByExternalIdHash(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    externalId: string,
    externalType: ExternalRefType = 'arn'
  ): Promise<IndexEntry | null> {
    const hash = computeReferenceHash(externalType, externalId);
    return this.findByReferenceHash(tenantId, repositoryId, hash);
  }

  /**
   * Reverse lookup: find all nodes referencing an external object
   * Uses COUNT(*) OVER() for efficient pagination with total count
   * CRITICAL: < 200ms for pagination (NFR-PERF-008)
   *
   * @param tenantId - Tenant ID
   * @param externalObjectId - External object UUID
   * @param options - Pagination options
   * @returns Paginated node references with total count
   */
  async findNodesByExternalObject(
    tenantId: TenantId,
    externalObjectId: ExternalObjectId,
    options: PaginationOptions
  ): Promise<{ nodes: NodeReference[]; total: number }> {
    const startTime = Date.now();
    const { page, pageSize, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * pageSize;

    // Sanitize orderBy to prevent SQL injection
    const allowedOrderColumns = ['created_at', 'confidence', 'ref_type'];
    const safeOrderBy = allowedOrderColumns.includes(orderBy) ? orderBy : 'created_at';
    const safeOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC';

    const sql = `
      SELECT
        node_id,
        repository_id,
        scan_id,
        ref_type,
        confidence,
        context,
        created_at,
        COUNT(*) OVER() AS total_count
      FROM ${this.junctionTableName}
      WHERE tenant_id = $1
        AND external_object_id = $2
      ORDER BY ${safeOrderBy} ${safeOrderDir}
      LIMIT $3
      OFFSET $4
    `;

    const rows = await this.db.query<NodeReferenceRow>(sql, [
      tenantId,
      externalObjectId,
      pageSize,
      offset,
    ]);

    const duration = Date.now() - startTime;
    const firstRow = rows[0];
    const total = rows.length > 0 && firstRow ? parseInt(firstRow.total_count, 10) : 0;

    logger.debug(
      {
        tenantId,
        externalObjectId,
        resultCount: rows.length,
        total,
        page,
        pageSize,
        timeMs: duration,
      },
      'Reverse lookup completed'
    );

    // Performance check for NFR-PERF-008
    if (duration > 200) {
      logger.warn(
        { duration, externalObjectId, total },
        'Reverse lookup exceeded 200ms target'
      );
    }

    return {
      nodes: rows.map((row) => this.rowToNodeReference(row)),
      total,
    };
  }

  /**
   * Bulk insert index entries with optimized batching
   * Uses INSERT ... ON CONFLICT DO NOTHING for idempotency
   * CRITICAL: Handle 1000+ entries efficiently
   *
   * @param entries - Array of entries to insert
   * @returns Count of inserted and skipped entries
   */
  async bulkInsertJunction(
    entries: IndexEntryCreate[]
  ): Promise<{ inserted: number; skipped: number }> {
    if (entries.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const startTime = Date.now();
    let totalInserted = 0;
    let totalSkipped = 0;

    // Process in batches for memory efficiency
    await this.db.transaction(async (client) => {
      for (let i = 0; i < entries.length; i += this.BATCH_SIZE) {
        const batch = entries.slice(i, i + this.BATCH_SIZE);
        const result = await this.insertJunctionBatch(client, batch);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
      }
    });

    const duration = Date.now() - startTime;
    const entriesPerSecond = Math.round((entries.length / duration) * 1000);

    logger.info(
      {
        totalEntries: entries.length,
        inserted: totalInserted,
        skipped: totalSkipped,
        timeMs: duration,
        entriesPerSecond,
      },
      'Bulk insert completed'
    );

    return { inserted: totalInserted, skipped: totalSkipped };
  }

  /**
   * Delete entries for a scan (for rebuild operations)
   * Uses RETURNING for accurate count
   *
   * @param tenantId - Tenant ID
   * @param repositoryId - Repository ID
   * @param scanId - Scan ID to delete
   * @returns Number of deleted entries
   */
  async deleteForScan(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    scanId: ScanId
  ): Promise<number> {
    const startTime = Date.now();

    const result = await this.db.execute(
      `DELETE FROM ${this.junctionTableName}
       WHERE tenant_id = $1
         AND repository_id = $2
         AND scan_id = $3`,
      [tenantId, repositoryId, scanId]
    );

    logger.info(
      {
        tenantId,
        repositoryId,
        scanId,
        deletedCount: result.rowsAffected,
        timeMs: Date.now() - startTime,
      },
      'Scan entries deleted'
    );

    return result.rowsAffected;
  }

  /**
   * Get repository statistics using the helper function
   *
   * @param tenantId - Tenant ID
   * @param repositoryId - Optional repository ID filter
   * @returns Repository statistics
   */
  async getStats(
    tenantId: TenantId,
    repositoryId?: RepositoryId
  ): Promise<RepositoryIndexStats> {
    const startTime = Date.now();

    // Use the database function for efficient aggregation
    const sql = `
      SELECT * FROM get_external_object_index_stats($1, $2)
    `;

    const rows = await this.db.query<StatsRow>(sql, [tenantId, repositoryId ?? null]);

    if (rows.length === 0) {
      return {
        totalEntries: 0,
        entriesByType: {
          arn: 0,
          resource_id: 0,
          k8s_reference: 0,
          gcp_resource: 0,
          azure_resource: 0,
        },
        uniqueExternalObjects: 0,
        uniqueNodes: 0,
        avgConfidence: 0,
        latestIndexedAt: null,
      };
    }

    const row = rows[0];
    if (!row) {
      return {
        totalEntries: 0,
        entriesByType: {
          arn: 0,
          resource_id: 0,
          k8s_reference: 0,
          gcp_resource: 0,
          azure_resource: 0,
        },
        uniqueExternalObjects: 0,
        uniqueNodes: 0,
        avgConfidence: 0,
        latestIndexedAt: null,
      };
    }

    const entriesByType = typeof row.entries_by_type === 'string'
      ? JSON.parse(row.entries_by_type)
      : row.entries_by_type ?? {};

    logger.debug(
      {
        tenantId,
        repositoryId,
        timeMs: Date.now() - startTime,
      },
      'Stats retrieved'
    );

    return {
      totalEntries: parseInt(row.total_entries ?? '0', 10),
      entriesByType: {
        arn: entriesByType.arn ?? 0,
        resource_id: entriesByType.resource_id ?? 0,
        k8s_reference: entriesByType.k8s_reference ?? 0,
        gcp_resource: entriesByType.gcp_resource ?? 0,
        azure_resource: entriesByType.azure_resource ?? 0,
      },
      uniqueExternalObjects: parseInt(row.unique_external_objects ?? '0', 10),
      uniqueNodes: parseInt(row.unique_nodes ?? '0', 10),
      avgConfidence: parseFloat(row.avg_confidence ?? '0') || 0,
      latestIndexedAt: row.latest_indexed_at ? new Date(row.latest_indexed_at) : null,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Insert a batch of junction table entries
   */
  private async insertJunctionBatch(
    client: IDatabaseClient,
    entries: IndexEntryCreate[]
  ): Promise<{ inserted: number; skipped: number }> {
    if (entries.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    // Build multi-row INSERT with proper parameter indices
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const entry of entries) {
      const rowPlaceholders = [
        `$${paramIndex++}`, // tenant_id
        `$${paramIndex++}`, // node_id
        `$${paramIndex++}`, // external_object_id
        `$${paramIndex++}`, // scan_id
        `$${paramIndex++}`, // repository_id
        `$${paramIndex++}`, // reference_hash
        `$${paramIndex++}`, // ref_type
        `$${paramIndex++}`, // confidence
        `$${paramIndex++}`, // context
      ];

      placeholders.push(`(${rowPlaceholders.join(', ')})`);

      values.push(
        entry.tenantId,
        entry.nodeId,
        entry.externalObjectId,
        entry.scanId,
        entry.repositoryId,
        entry.referenceHash,
        entry.refType,
        entry.confidence ?? 1.0,
        JSON.stringify(entry.context ?? {})
      );
    }

    const sql = `
      INSERT INTO ${this.junctionTableName} (
        tenant_id, node_id, external_object_id, scan_id, repository_id,
        reference_hash, ref_type, confidence, context
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (scan_id, node_id, external_object_id) DO NOTHING
    `;

    const result = await client.execute(sql, values);
    const inserted = result.rowsAffected;
    const skipped = entries.length - inserted;

    return { inserted, skipped };
  }

  /**
   * Convert junction table row to IndexEntry
   */
  private junctionRowToEntry(row: JunctionRow): IndexEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id as TenantId,
      nodeId: row.node_id,
      externalObjectId: row.external_object_id as ExternalObjectId,
      scanId: row.scan_id as ScanId,
      repositoryId: row.repository_id as RepositoryId,
      referenceHash: row.reference_hash as ReferenceHash,
      refType: row.ref_type as ExternalRefType,
      confidence: parseFloat(row.confidence),
      context: typeof row.context === 'string'
        ? JSON.parse(row.context)
        : row.context,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Convert row to NodeReference
   */
  private rowToNodeReference(row: NodeReferenceRow): NodeReference {
    return {
      nodeId: row.node_id,
      repositoryId: row.repository_id as RepositoryId,
      scanId: row.scan_id as ScanId,
      refType: row.ref_type as ExternalReferenceType,
      confidence: parseFloat(row.confidence),
      context: typeof row.context === 'string'
        ? JSON.parse(row.context)
        : row.context,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Insert a batch of entries for external_object_index table
   */
  private async insertBatch(
    client: IDatabaseClient,
    entries: ExternalObjectEntry[]
  ): Promise<number> {
    if (entries.length === 0) {
      return 0;
    }

    // Build multi-row INSERT
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const entry of entries) {
      const rowPlaceholders = [
        `$${paramIndex++}`, // id
        `$${paramIndex++}`, // external_id
        `$${paramIndex++}`, // reference_type
        `$${paramIndex++}`, // normalized_id
        `$${paramIndex++}`, // tenant_id
        `$${paramIndex++}`, // repository_id
        `$${paramIndex++}`, // scan_id
        `$${paramIndex++}`, // node_id
        `$${paramIndex++}`, // node_name
        `$${paramIndex++}`, // node_type
        `$${paramIndex++}`, // file_path
        `$${paramIndex++}`, // components
        `$${paramIndex++}`, // metadata
        `$${paramIndex++}`, // indexed_at
      ];

      placeholders.push(`(${rowPlaceholders.join(', ')})`);

      values.push(
        entry.id,
        entry.externalId,
        entry.referenceType,
        entry.normalizedId,
        entry.tenantId,
        entry.repositoryId,
        entry.scanId,
        entry.nodeId,
        entry.nodeName,
        entry.nodeType,
        entry.filePath,
        JSON.stringify(entry.components),
        JSON.stringify(entry.metadata),
        entry.indexedAt
      );
    }

    const sql = `
      INSERT INTO ${this.tableName} (
        id, external_id, reference_type, normalized_id,
        tenant_id, repository_id, scan_id, node_id, node_name, node_type,
        file_path, components, metadata, indexed_at
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (tenant_id, node_id, external_id) DO UPDATE SET
        normalized_id = EXCLUDED.normalized_id,
        components = EXCLUDED.components,
        metadata = EXCLUDED.metadata,
        indexed_at = EXCLUDED.indexed_at
    `;

    const result = await client.execute(sql, values);
    return result.rowsAffected;
  }

  /**
   * Convert database row to ExternalObjectEntry
   */
  private rowToEntry(row: ExternalObjectEntryRow): ExternalObjectEntry {
    return {
      id: row.id,
      externalId: row.external_id,
      referenceType: row.reference_type,
      normalizedId: row.normalized_id,
      tenantId: row.tenant_id as TenantId,
      repositoryId: row.repository_id as RepositoryId,
      scanId: row.scan_id as ScanId,
      nodeId: row.node_id,
      nodeName: row.node_name,
      nodeType: row.node_type,
      filePath: row.file_path,
      components: typeof row.components === 'string'
        ? JSON.parse(row.components)
        : row.components,
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
      indexedAt: new Date(row.indexed_at),
    };
  }
}

/**
 * Database row type for external_object_index table
 */
interface ExternalObjectEntryRow {
  id: string;
  external_id: string;
  reference_type: ExternalReferenceType;
  normalized_id: string;
  tenant_id: string;
  repository_id: string;
  scan_id: string;
  node_id: string;
  node_name: string;
  node_type: string;
  file_path: string;
  components: string | Record<string, string>;
  metadata: string | Record<string, unknown>;
  indexed_at: string;
}

/**
 * Database row type for node_external_objects junction table
 */
interface JunctionRow {
  id: string;
  tenant_id: string;
  node_id: string;
  external_object_id: string;
  scan_id: string;
  repository_id: string;
  reference_hash: string;
  ref_type: string;
  confidence: string;
  context: string | Record<string, unknown>;
  created_at: string;
}

/**
 * Database row type for node reference queries (with pagination total)
 */
interface NodeReferenceRow {
  node_id: string;
  repository_id: string;
  scan_id: string;
  ref_type: string;
  confidence: string;
  context: string | Record<string, unknown>;
  created_at: string;
  total_count: string;
}

/**
 * Database row type for statistics queries
 */
interface StatsRow {
  total_entries: string;
  entries_by_type: string | Record<string, number>;
  unique_external_objects: string;
  unique_nodes: string;
  avg_confidence: string;
  latest_indexed_at: string | null;
}

/**
 * Create a new ExternalObjectRepository instance
 */
export function createExternalObjectRepository(
  db: IDatabaseClient
): ExternalObjectRepository {
  return new ExternalObjectRepository(db);
}

/**
 * Create an ExternalObjectId from a string
 */
export function createExternalObjectId(id: string): ExternalObjectId {
  return id as ExternalObjectId;
}
