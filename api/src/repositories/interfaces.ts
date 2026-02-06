/**
 * Repository Interface Definitions
 * @module repositories/interfaces
 *
 * Defines contracts for all data access repositories.
 * Implements repository pattern for clean separation of concerns.
 *
 * TASK-DETECT: Data layer interfaces for IaC dependency detection
 */

import {
  ScanId,
  ScanEntity,
  ScanStatus,
  ScanProgress,
  ScanResultSummary,
  NodeEntity,
  EdgeEntity,
  TenantId,
  RepositoryId,
  DbNodeId,
  DbEdgeId,
} from '../types/entities.js';
import { NodeTypeName, EdgeType } from '../types/graph.js';
import { EvidenceType, EvidenceCategory } from '../types/evidence.js';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  readonly data: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams<T> {
  readonly field: keyof T;
  readonly direction: SortDirection;
}

/**
 * Base repository result
 */
export interface RepositoryResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Batch operation result
 */
export interface BatchResult {
  readonly inserted: number;
  readonly updated: number;
  readonly failed: number;
  readonly errors: Array<{ index: number; error: string }>;
}

// ============================================================================
// Transaction Support
// ============================================================================

/**
 * Transaction client interface
 */
export interface ITransactionClient {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(text: string, params?: unknown[]): Promise<T | null>;
}

/**
 * Transaction manager interface
 */
export interface ITransactionManager {
  /**
   * Execute operations within a transaction
   */
  transaction<T>(
    fn: (client: ITransactionClient) => Promise<T>
  ): Promise<T>;

  /**
   * Set tenant context for RLS
   */
  setTenantContext(tenantId: TenantId): Promise<void>;
}

// ============================================================================
// Scan Repository Interface
// ============================================================================

/**
 * Scan creation input
 */
export interface CreateScanInput {
  readonly tenantId: TenantId;
  readonly repositoryId: RepositoryId;
  readonly initiatedBy: string;
  readonly ref: string;
  readonly commitSha: string;
  readonly config: Record<string, unknown>;
}

/**
 * Scan filter criteria
 */
export interface ScanFilterCriteria {
  readonly status?: ScanStatus | ScanStatus[];
  readonly repositoryId?: RepositoryId;
  readonly initiatedBy?: string;
  readonly startedAfter?: Date;
  readonly startedBefore?: Date;
}

/**
 * Scan repository interface
 */
export interface IScanRepository {
  /**
   * Create a new scan
   */
  create(input: CreateScanInput): Promise<ScanEntity>;

  /**
   * Find scan by ID
   */
  findById(id: ScanId, tenantId: TenantId): Promise<ScanEntity | null>;

  /**
   * Find scans by repository
   */
  findByRepository(
    repositoryId: RepositoryId,
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<ScanEntity>>;

  /**
   * Find scans by tenant
   */
  findByTenant(
    tenantId: TenantId,
    filter?: ScanFilterCriteria,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<ScanEntity>>;

  /**
   * Update scan entity
   */
  update(id: ScanId, tenantId: TenantId, updates: Partial<ScanEntity>): Promise<ScanEntity>;

  /**
   * Update scan status
   */
  updateStatus(
    id: ScanId,
    tenantId: TenantId,
    status: ScanStatus,
    errorMessage?: string
  ): Promise<void>;

  /**
   * Update scan progress
   */
  updateProgress(
    id: ScanId,
    tenantId: TenantId,
    progress: ScanProgress
  ): Promise<void>;

  /**
   * Update scan result summary
   */
  updateResultSummary(
    id: ScanId,
    tenantId: TenantId,
    summary: ScanResultSummary
  ): Promise<void>;

  /**
   * Delete scan and all related data
   */
  delete(id: ScanId, tenantId: TenantId): Promise<void>;

  /**
   * Get latest scan for repository
   */
  getLatestForRepository(
    repositoryId: RepositoryId,
    tenantId: TenantId
  ): Promise<ScanEntity | null>;
}

// ============================================================================
// Node Repository Interface
// ============================================================================

/**
 * Node creation input
 */
export interface CreateNodeInput {
  readonly scanId: ScanId;
  readonly tenantId: TenantId;
  readonly originalId: string;
  readonly nodeType: NodeTypeName;
  readonly name: string;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly columnStart?: number;
  readonly columnEnd?: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Node filter criteria
 */
export interface NodeFilterCriteria {
  readonly nodeType?: NodeTypeName | NodeTypeName[];
  readonly filePath?: string;
  readonly name?: string;
}

/**
 * Node repository interface
 */
export interface INodeRepository {
  /**
   * Batch insert nodes
   */
  batchInsert(nodes: CreateNodeInput[]): Promise<BatchResult>;

  /**
   * Find node by ID
   */
  findById(id: DbNodeId, tenantId: TenantId): Promise<NodeEntity | null>;

  /**
   * Find nodes by scan
   */
  findByScan(
    scanId: ScanId,
    tenantId: TenantId,
    filter?: NodeFilterCriteria,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<NodeEntity>>;

  /**
   * Find nodes by type
   */
  findByType(
    scanId: ScanId,
    tenantId: TenantId,
    nodeType: NodeTypeName | NodeTypeName[]
  ): Promise<NodeEntity[]>;

  /**
   * Find node by original ID (from detection)
   */
  findByOriginalId(
    scanId: ScanId,
    tenantId: TenantId,
    originalId: string
  ): Promise<NodeEntity | null>;

  /**
   * Bulk upsert nodes (update if exists, insert if not)
   */
  bulkUpsert(nodes: CreateNodeInput[]): Promise<BatchResult>;

  /**
   * Delete all nodes for a scan
   */
  deleteByScan(scanId: ScanId, tenantId: TenantId): Promise<number>;

  /**
   * Get node counts by type for a scan
   */
  getCountsByType(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<NodeTypeName, number>>;

  /**
   * Get node ID mapping (original to database ID)
   */
  getIdMapping(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Map<string, DbNodeId>>;
}

// ============================================================================
// Edge Repository Interface
// ============================================================================

/**
 * Edge creation input
 */
export interface CreateEdgeInput {
  readonly scanId: ScanId;
  readonly tenantId: TenantId;
  readonly originalId: string;
  readonly sourceNodeId: DbNodeId;
  readonly targetNodeId: DbNodeId;
  readonly edgeType: EdgeType;
  readonly label?: string;
  readonly isImplicit: boolean;
  readonly confidence: number;
  readonly attribute?: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * Edge filter criteria
 */
export interface EdgeFilterCriteria {
  readonly edgeType?: EdgeType | EdgeType[];
  readonly isImplicit?: boolean;
  readonly minConfidence?: number;
  readonly maxConfidence?: number;
}

/**
 * Edge repository interface
 */
export interface IEdgeRepository {
  /**
   * Batch insert edges
   */
  batchInsert(edges: CreateEdgeInput[]): Promise<BatchResult>;

  /**
   * Find edge by ID
   */
  findById(id: DbEdgeId, tenantId: TenantId): Promise<EdgeEntity | null>;

  /**
   * Find edges by scan
   */
  findByScan(
    scanId: ScanId,
    tenantId: TenantId,
    filter?: EdgeFilterCriteria,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<EdgeEntity>>;

  /**
   * Find edges by source node
   */
  findBySource(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId
  ): Promise<EdgeEntity[]>;

  /**
   * Find edges by target node
   */
  findByTarget(
    scanId: ScanId,
    tenantId: TenantId,
    targetNodeId: DbNodeId
  ): Promise<EdgeEntity[]>;

  /**
   * Update confidence score
   */
  updateConfidence(
    id: DbEdgeId,
    tenantId: TenantId,
    confidence: number
  ): Promise<void>;

  /**
   * Bulk update confidence scores
   */
  bulkUpdateConfidence(
    updates: Array<{ id: DbEdgeId; confidence: number }>,
    tenantId: TenantId
  ): Promise<number>;

  /**
   * Delete all edges for a scan
   */
  deleteByScan(scanId: ScanId, tenantId: TenantId): Promise<number>;

  /**
   * Get edge counts by type for a scan
   */
  getCountsByType(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<EdgeType, number>>;

  /**
   * Get confidence distribution for a scan
   */
  getConfidenceDistribution(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<{
    certain: number;
    high: number;
    medium: number;
    low: number;
    uncertain: number;
  }>;
}

// ============================================================================
// Evidence Repository Interface
// ============================================================================

/**
 * Evidence entity for database storage
 */
export interface EvidenceEntity {
  readonly id: string;
  readonly edgeId: DbEdgeId;
  readonly scanId: ScanId;
  readonly tenantId: TenantId;
  readonly type: EvidenceType;
  readonly category: EvidenceCategory;
  readonly description: string;
  readonly confidence: number;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly columnStart?: number;
  readonly columnEnd?: number;
  readonly snippet?: string;
  readonly raw?: Record<string, unknown>;
  readonly createdAt: Date;
}

/**
 * Evidence creation input
 */
export interface CreateEvidenceInput {
  readonly edgeId: DbEdgeId;
  readonly scanId: ScanId;
  readonly tenantId: TenantId;
  readonly type: EvidenceType;
  readonly category: EvidenceCategory;
  readonly description: string;
  readonly confidence: number;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly columnStart?: number;
  readonly columnEnd?: number;
  readonly snippet?: string;
  readonly raw?: Record<string, unknown>;
}

/**
 * Evidence filter criteria
 */
export interface EvidenceFilterCriteria {
  readonly type?: EvidenceType | EvidenceType[];
  readonly category?: EvidenceCategory | EvidenceCategory[];
  readonly minConfidence?: number;
}

/**
 * Evidence repository interface
 */
export interface IEvidenceRepository {
  /**
   * Batch insert evidence
   */
  batchInsert(evidence: CreateEvidenceInput[]): Promise<BatchResult>;

  /**
   * Find evidence by edge
   */
  findByEdge(
    edgeId: DbEdgeId,
    tenantId: TenantId
  ): Promise<EvidenceEntity[]>;

  /**
   * Find evidence by scan
   */
  findByScan(
    scanId: ScanId,
    tenantId: TenantId,
    filter?: EvidenceFilterCriteria,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<EvidenceEntity>>;

  /**
   * Aggregate evidence by type for a scan
   */
  aggregateByType(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<EvidenceType, { count: number; avgConfidence: number }>>;

  /**
   * Aggregate evidence by category for a scan
   */
  aggregateByCategory(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<Record<EvidenceCategory, { count: number; avgConfidence: number }>>;

  /**
   * Delete all evidence for a scan
   */
  deleteByScan(scanId: ScanId, tenantId: TenantId): Promise<number>;

  /**
   * Delete evidence by edge
   */
  deleteByEdge(edgeId: DbEdgeId, tenantId: TenantId): Promise<number>;
}

// ============================================================================
// Graph Querier Interface
// ============================================================================

/**
 * Graph traversal direction
 */
export type TraversalDirection = 'upstream' | 'downstream' | 'both';

/**
 * Path between nodes
 */
export interface GraphPath {
  readonly nodes: DbNodeId[];
  readonly edges: DbEdgeId[];
  readonly length: number;
}

/**
 * Cycle detection result
 */
export interface CycleInfo {
  readonly nodes: DbNodeId[];
  readonly edges: DbEdgeId[];
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  readonly directDependents: NodeEntity[];
  readonly transitiveDependents: NodeEntity[];
  readonly impactedEdges: EdgeEntity[];
  readonly depth: number;
}

/**
 * Graph querier interface for traversal operations
 */
export interface IGraphQuerier {
  /**
   * Get downstream dependencies (nodes that depend on given node)
   */
  getDownstreamDependencies(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth?: number
  ): Promise<NodeEntity[]>;

  /**
   * Get upstream dependents (nodes that the given node depends on)
   */
  getUpstreamDependents(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth?: number
  ): Promise<NodeEntity[]>;

  /**
   * Find shortest path between two nodes
   */
  findShortestPath(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId,
    targetNodeId: DbNodeId
  ): Promise<GraphPath | null>;

  /**
   * Find all paths between two nodes
   */
  findAllPaths(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId,
    targetNodeId: DbNodeId,
    maxDepth?: number
  ): Promise<GraphPath[]>;

  /**
   * Detect cycles in the graph
   */
  detectCycles(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<CycleInfo[]>;

  /**
   * Get connected components
   */
  getConnectedComponents(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<NodeEntity[][]>;

  /**
   * Perform impact analysis for a node change
   */
  analyzeImpact(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth?: number
  ): Promise<ImpactAnalysisResult>;

  /**
   * Get graph statistics
   */
  getGraphStatistics(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<{
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    maxDepth: number;
    componentCount: number;
    hasCycles: boolean;
  }>;

  /**
   * Find nodes with high fan-out (many dependencies)
   */
  findHighFanOutNodes(
    scanId: ScanId,
    tenantId: TenantId,
    threshold?: number
  ): Promise<Array<{ node: NodeEntity; fanOut: number }>>;

  /**
   * Find nodes with high fan-in (many dependents)
   */
  findHighFanInNodes(
    scanId: ScanId,
    tenantId: TenantId,
    threshold?: number
  ): Promise<Array<{ node: NodeEntity; fanIn: number }>>;
}

// ============================================================================
// Unit of Work Interface
// ============================================================================

/**
 * Unit of Work for coordinating multiple repository operations
 */
export interface IUnitOfWork {
  readonly scans: IScanRepository;
  readonly nodes: INodeRepository;
  readonly edges: IEdgeRepository;
  readonly evidence: IEvidenceRepository;
  readonly graphQuerier: IGraphQuerier;

  /**
   * Begin a transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the transaction
   */
  rollback(): Promise<void>;

  /**
   * Execute operations in a transaction
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
