/**
 * Unit of Work Implementation
 * @module repositories/unit-of-work
 *
 * Coordinates multiple repository operations within a single transaction.
 * Ensures data consistency and provides rollback capabilities.
 *
 * TASK-DETECT: Unit of Work pattern for data layer
 */

import pg from 'pg';
import pino from 'pino';
import { getPool } from '../db/connection.js';
import { TenantId } from '../types/entities.js';
import {
  IUnitOfWork,
  IScanRepository,
  INodeRepository,
  IEdgeRepository,
  IEvidenceRepository,
  IGraphQuerier,
} from './interfaces.js';
import { ScanRepository } from './scan-repository.js';
import { NodeRepository } from './node-repository.js';
import { EdgeRepository } from './edge-repository.js';
import { EvidenceRepository } from './evidence-repository.js';
import { GraphQuerier } from './graph-querier.js';

const logger = pino({ name: 'unit-of-work' });

// ============================================================================
// Unit of Work Implementation
// ============================================================================

/**
 * Unit of Work for coordinating repository operations
 */
export class UnitOfWork implements IUnitOfWork {
  private _scans: IScanRepository | null = null;
  private _nodes: INodeRepository | null = null;
  private _edges: IEdgeRepository | null = null;
  private _evidence: IEvidenceRepository | null = null;
  private _graphQuerier: IGraphQuerier | null = null;

  private readonly pool: pg.Pool;
  private client: pg.PoolClient | null = null;
  private isTransactionActive = false;

  constructor() {
    this.pool = getPool();
  }

  // ============================================================================
  // Repository Accessors
  // ============================================================================

  get scans(): IScanRepository {
    if (!this._scans) {
      this._scans = new ScanRepository();
    }
    return this._scans;
  }

  get nodes(): INodeRepository {
    if (!this._nodes) {
      this._nodes = new NodeRepository();
    }
    return this._nodes;
  }

  get edges(): IEdgeRepository {
    if (!this._edges) {
      this._edges = new EdgeRepository();
    }
    return this._edges;
  }

  get evidence(): IEvidenceRepository {
    if (!this._evidence) {
      this._evidence = new EvidenceRepository();
    }
    return this._evidence;
  }

  get graphQuerier(): IGraphQuerier {
    if (!this._graphQuerier) {
      this._graphQuerier = new GraphQuerier();
    }
    return this._graphQuerier;
  }

  // ============================================================================
  // Transaction Management
  // ============================================================================

  /**
   * Begin a new transaction
   */
  async beginTransaction(): Promise<void> {
    if (this.isTransactionActive) {
      throw new Error('Transaction already in progress');
    }

    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.isTransactionActive = true;

    logger.debug('Transaction started');
  }

  /**
   * Commit the current transaction
   */
  async commit(): Promise<void> {
    if (!this.isTransactionActive || !this.client) {
      throw new Error('No active transaction to commit');
    }

    try {
      await this.client.query('COMMIT');
      logger.debug('Transaction committed');
    } finally {
      this.cleanup();
    }
  }

  /**
   * Rollback the current transaction
   */
  async rollback(): Promise<void> {
    if (!this.isTransactionActive || !this.client) {
      throw new Error('No active transaction to rollback');
    }

    try {
      await this.client.query('ROLLBACK');
      logger.debug('Transaction rolled back');
    } finally {
      this.cleanup();
    }
  }

  /**
   * Execute operations in a transaction with automatic commit/rollback
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.beginTransaction();

    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      logger.error({ error }, 'Transaction failed, rolled back');
      throw error;
    }
  }

  /**
   * Set tenant context for RLS policies
   */
  async setTenantContext(tenantId: TenantId): Promise<void> {
    const client = this.client ?? this.pool;
    await client.query(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      [tenantId]
    );
    logger.debug({ tenantId }, 'Tenant context set');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Clean up transaction state
   */
  private cleanup(): void {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    this.isTransactionActive = false;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new unit of work instance
 */
export function createUnitOfWork(): IUnitOfWork {
  return new UnitOfWork();
}

// ============================================================================
// Scan Persistence Adapter
// ============================================================================

/**
 * Adapter implementing IScanPersistence using Unit of Work
 * Used by ScanService for persistence operations
 */
export class ScanPersistenceAdapter {
  constructor(private readonly uow: IUnitOfWork) {}

  /**
   * Save scan entity
   */
  async saveScan(scan: import('../types/entities.js').ScanEntity): Promise<void> {
    const existing = await this.uow.scans.findById(scan.id, scan.tenantId);

    if (existing) {
      await this.uow.scans.update(scan.id, scan.tenantId, scan);
    } else {
      await this.uow.scans.create({
        tenantId: scan.tenantId,
        repositoryId: scan.repositoryId,
        initiatedBy: scan.initiatedBy,
        ref: scan.ref,
        commitSha: scan.commitSha,
        config: scan.config as unknown as Record<string, unknown>,
      });
    }
  }

  /**
   * Update scan progress
   */
  async updateProgress(
    scanId: import('../types/entities.js').ScanId,
    progress: import('../types/entities.js').ScanProgress
  ): Promise<void> {
    // Find the scan to get tenant ID
    // In production, tenant context should be passed through
    const pool = getPool();
    const result = await pool.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM scans WHERE id = $1',
      [scanId]
    );

    if (result.rows[0]) {
      await this.uow.scans.updateProgress(
        scanId,
        result.rows[0].tenant_id as TenantId,
        progress
      );
    }
  }

  /**
   * Save scan results (graph, nodes, edges)
   */
  async saveResults(
    scanId: import('../types/entities.js').ScanId,
    graph: import('../types/graph.js').DependencyGraph,
    summary: import('../types/entities.js').ScanResultSummary
  ): Promise<void> {
    // Find tenant ID
    const pool = getPool();
    const result = await pool.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM scans WHERE id = $1',
      [scanId]
    );

    if (!result.rows[0]) {
      throw new Error('Scan not found');
    }

    const tenantId = result.rows[0].tenant_id as TenantId;

    // Save in a transaction
    await this.uow.transaction(async () => {
      // Insert nodes
      const nodeInputs: import('./interfaces.js').CreateNodeInput[] = [];
      for (const [, node] of graph.nodes) {
        nodeInputs.push({
          scanId,
          tenantId,
          originalId: node.id,
          nodeType: node.type,
          name: node.name,
          filePath: node.location.file,
          lineStart: node.location.lineStart,
          lineEnd: node.location.lineEnd,
          columnStart: node.location.columnStart,
          columnEnd: node.location.columnEnd,
          metadata: node.metadata,
        });
      }

      if (nodeInputs.length > 0) {
        await this.uow.nodes.batchInsert(nodeInputs);
      }

      // Get node ID mapping
      const idMapping = await this.uow.nodes.getIdMapping(scanId, tenantId);

      // Insert edges
      const edgeInputs: import('./interfaces.js').CreateEdgeInput[] = [];
      for (const edge of graph.edges) {
        const sourceDbId = idMapping.get(edge.source);
        const targetDbId = idMapping.get(edge.target);

        if (sourceDbId && targetDbId) {
          edgeInputs.push({
            scanId,
            tenantId,
            originalId: edge.id,
            sourceNodeId: sourceDbId,
            targetNodeId: targetDbId,
            edgeType: edge.type,
            label: edge.label,
            isImplicit: edge.metadata.implicit,
            confidence: edge.metadata.confidence,
            attribute: edge.metadata.attribute,
            metadata: edge.metadata as unknown as Record<string, unknown>,
          });
        }
      }

      if (edgeInputs.length > 0) {
        await this.uow.edges.batchInsert(edgeInputs);
      }

      // Update scan with summary
      await this.uow.scans.updateResultSummary(scanId, tenantId, summary);
    });
  }

  /**
   * Get scan by ID
   */
  async getScan(
    scanId: import('../types/entities.js').ScanId
  ): Promise<import('../types/entities.js').ScanEntity | null> {
    // Find tenant ID first
    const pool = getPool();
    const result = await pool.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM scans WHERE id = $1',
      [scanId]
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.uow.scans.findById(scanId, result.rows[0].tenant_id as TenantId);
  }
}

/**
 * Create a scan persistence adapter
 */
export function createScanPersistenceAdapter(): ScanPersistenceAdapter {
  return new ScanPersistenceAdapter(createUnitOfWork());
}
