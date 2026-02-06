/**
 * Graph Diff Service for API Consumption
 * @module services/rollup/graph-diff/graph-diff-service
 *
 * High-level service layer for graph diff computation.
 * Orchestrates diff engine, caching, rate limiting, and audit logging.
 *
 * Flow for getDiff():
 * 1. Validate request
 * 2. Check rate limit
 * 3. Check cache (via IDiffCache)
 * 4. If cache miss, load graphs from scan repository
 * 5. Compute diff via IGraphDiffEngine
 * 6. Cache result
 * 7. Return response with metadata
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import type { Logger } from 'pino';
import pino from 'pino';
import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import { DependencyGraph, NodeType, EdgeType } from '../../../types/graph.js';
import { IScanRepository } from '../../../repositories/interfaces.js';
import { RollupAuditLogger, getRollupAuditLogger } from '../audit.js';
import {
  IGraphDiffEngine,
  IDiffCache,
  GraphDiffResult,
  GraphDiffId,
  GraphSnapshotId,
  GraphSnapshot,
  GraphSnapshotRef,
  DiffComputationOptions,
  DiffCostEstimate,
  DiffSummary,
  DiffTiming,
  CachedDiffResult,
  GraphDiffError,
  GraphDiffErrorCodes,
  createGraphSnapshotId,
  DEFAULT_DIFF_COMPUTATION_OPTIONS,
} from './interfaces.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Request for computing a graph diff
 */
export interface GraphDiffRequest {
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Base (older) scan ID */
  readonly baseScanId: ScanId;
  /** Target (newer) scan ID */
  readonly targetScanId: ScanId;
  /** Optional repository ID filter */
  readonly repositoryId?: RepositoryId;
  /** Computation options */
  readonly options?: DiffComputationOptions;
  /** Force recomputation (bypass cache) */
  readonly forceRecompute?: boolean;
}

/**
 * Response from graph diff computation
 */
export interface GraphDiffResponse {
  /** The computed diff result */
  readonly diff: GraphDiffResult;
  /** Whether the result was from cache */
  readonly fromCache: boolean;
  /** Cache metadata if applicable */
  readonly cacheInfo?: {
    /** When the cached result was stored */
    readonly cachedAt: Date;
    /** When the cache entry expires */
    readonly expiresAt: Date;
    /** Number of times this cache entry was accessed */
    readonly accessCount: number;
  };
  /** Request metadata */
  readonly metadata: {
    /** When the request was received */
    readonly requestedAt: Date;
    /** Total processing time in milliseconds */
    readonly processingTimeMs: number;
    /** Phases executed (cache_check, load_graphs, compute_diff, cache_store) */
    readonly phases: string[];
  };
}

/**
 * Options for listing diffs
 */
export interface ListOptions {
  /** Page number (1-based) */
  readonly page?: number;
  /** Page size */
  readonly pageSize?: number;
  /** Sort by field */
  readonly sortBy?: 'computedAt' | 'baseSnapshotId' | 'targetSnapshotId';
  /** Sort direction */
  readonly sortDirection?: 'asc' | 'desc';
  /** Filter by date range (start) */
  readonly computedAfter?: Date;
  /** Filter by date range (end) */
  readonly computedBefore?: Date;
}

/**
 * Response for listing diffs
 */
export interface GraphDiffListResponse {
  /** List of diff summaries */
  readonly diffs: readonly DiffListItem[];
  /** Total count */
  readonly total: number;
  /** Page number */
  readonly page: number;
  /** Page size */
  readonly pageSize: number;
  /** Total pages */
  readonly totalPages: number;
  /** Has next page */
  readonly hasNext: boolean;
  /** Has previous page */
  readonly hasPrevious: boolean;
}

/**
 * Lightweight diff list item
 */
export interface DiffListItem {
  /** Diff ID */
  readonly id: GraphDiffId;
  /** Base snapshot ID */
  readonly baseSnapshotId: GraphSnapshotId;
  /** Target snapshot ID */
  readonly targetSnapshotId: GraphSnapshotId;
  /** Summary statistics */
  readonly summary: DiffSummary;
  /** When the diff was computed */
  readonly computedAt: Date;
  /** Computation time in milliseconds */
  readonly computationTimeMs: number;
}

/**
 * Rate limiter interface
 */
export interface IRateLimiter {
  /**
   * Check if request should be rate limited
   * @param tenantId - Tenant ID
   * @param operation - Operation name
   * @returns Whether the request is allowed, or rate limit info
   */
  checkLimit(
    tenantId: TenantId,
    operation: string
  ): Promise<RateLimitResult>;

  /**
   * Record a request for rate limiting purposes
   * @param tenantId - Tenant ID
   * @param operation - Operation name
   */
  recordRequest(tenantId: TenantId, operation: string): Promise<void>;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  readonly allowed: boolean;
  /** Current request count in window */
  readonly currentCount: number;
  /** Maximum requests allowed in window */
  readonly limit: number;
  /** Window size in seconds */
  readonly windowSeconds: number;
  /** Seconds until limit resets */
  readonly retryAfter?: number;
}

/**
 * Service interface for graph diff operations
 */
export interface IGraphDiffService {
  /**
   * Compute or retrieve a graph diff
   * @param request - Diff request
   * @returns Diff response
   */
  getDiff(request: GraphDiffRequest): Promise<GraphDiffResponse>;

  /**
   * List diffs for a repository
   * @param tenantId - Tenant ID
   * @param repositoryId - Repository ID
   * @param options - List options
   * @returns Paginated diff list
   */
  listDiffsForRepository(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    options?: ListOptions
  ): Promise<GraphDiffListResponse>;

  /**
   * Delete a specific diff
   * @param tenantId - Tenant ID
   * @param diffId - Diff ID to delete
   * @returns Whether the diff was deleted
   */
  deleteDiff(tenantId: TenantId, diffId: GraphDiffId): Promise<boolean>;

  /**
   * Estimate cost of computing a diff
   * @param tenantId - Tenant ID
   * @param baseScanId - Base scan ID
   * @param targetScanId - Target scan ID
   * @returns Cost estimate
   */
  estimateDiffCost(
    tenantId: TenantId,
    baseScanId: ScanId,
    targetScanId: ScanId
  ): Promise<DiffCostEstimate>;

  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the service
   */
  shutdown(): Promise<void>;
}

/**
 * Dependencies for GraphDiffService construction
 */
export interface GraphDiffServiceDependencies {
  /** Graph diff computation engine */
  readonly engine: IGraphDiffEngine;
  /** Diff cache */
  readonly cache: IDiffCache;
  /** Scan repository for loading graphs */
  readonly scanRepository: IScanRepository;
  /** Audit logger */
  readonly auditLogger: RollupAuditLogger;
  /** Optional rate limiter */
  readonly rateLimiter?: IRateLimiter;
  /** Optional logger */
  readonly logger?: Logger;
}

/**
 * Configuration for GraphDiffService
 */
export interface GraphDiffServiceConfig {
  /** Enable caching (default: true) */
  readonly enableCaching?: boolean;
  /** Enable rate limiting (default: true) */
  readonly enableRateLimiting?: boolean;
  /** Enable audit logging (default: true) */
  readonly enableAuditLogging?: boolean;
  /** Default computation options */
  readonly defaultOptions?: Partial<DiffComputationOptions>;
}

// ============================================================================
// Constants
// ============================================================================

/** Rate limiting operation name */
const RATE_LIMIT_OPERATION = 'graph_diff_compute';

/** Default page size for list operations */
const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size for list operations */
const MAX_PAGE_SIZE = 100;

// ============================================================================
// Graph Diff Service Implementation
// ============================================================================

/**
 * High-level service for graph diff operations.
 * Orchestrates engine, cache, rate limiting, and audit logging.
 */
export class GraphDiffService implements IGraphDiffService {
  private readonly engine: IGraphDiffEngine;
  private readonly cache: IDiffCache;
  private readonly scanRepository: IScanRepository;
  private readonly auditLogger: RollupAuditLogger;
  private readonly rateLimiter: IRateLimiter | undefined;
  private readonly logger: Logger;
  private readonly config: Required<GraphDiffServiceConfig>;
  private initialized = false;

  /**
   * Create a new GraphDiffService
   * @param deps - Service dependencies
   * @param config - Service configuration
   */
  constructor(
    deps: GraphDiffServiceDependencies,
    config?: GraphDiffServiceConfig
  ) {
    this.engine = deps.engine;
    this.cache = deps.cache;
    this.scanRepository = deps.scanRepository;
    this.auditLogger = deps.auditLogger;
    this.rateLimiter = deps.rateLimiter;
    this.logger = deps.logger ?? pino({ name: 'graph-diff-service' });

    // Merge configuration with defaults
    this.config = {
      enableCaching: config?.enableCaching ?? true,
      enableRateLimiting: config?.enableRateLimiting ?? true,
      enableAuditLogging: config?.enableAuditLogging ?? true,
      defaultOptions: config?.defaultOptions ?? {},
    };

    this.logger.info(
      { config: this.config },
      'GraphDiffService initialized with configuration'
    );
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Initialize the service and its dependencies
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing GraphDiffService');

    try {
      // Initialize the diff engine
      await this.engine.initialize();

      this.initialized = true;
      this.logger.info('GraphDiffService initialization complete');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize GraphDiffService');
      throw error;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down GraphDiffService');

    try {
      await this.engine.shutdown();
      this.initialized = false;
      this.logger.info('GraphDiffService shutdown complete');
    } catch (error) {
      this.logger.error({ error }, 'Error during GraphDiffService shutdown');
      throw error;
    }
  }

  // ==========================================================================
  // Core Operations
  // ==========================================================================

  /**
   * Compute or retrieve a graph diff
   * @param request - Diff request
   * @returns Diff response with metadata
   */
  async getDiff(request: GraphDiffRequest): Promise<GraphDiffResponse> {
    const requestedAt = new Date();
    const startTime = performance.now();
    const phases: string[] = [];

    this.logger.debug(
      {
        tenantId: request.tenantId,
        baseScanId: request.baseScanId,
        targetScanId: request.targetScanId,
        forceRecompute: request.forceRecompute,
      },
      'Processing graph diff request'
    );

    // 1. Validate request
    this.validateRequest(request);
    phases.push('validate');

    // 2. Check rate limit
    if (this.config.enableRateLimiting && this.rateLimiter) {
      const rateLimitResult = await this.checkRateLimit(request.tenantId);
      if (!rateLimitResult.allowed) {
        await this.logRateLimited(request.tenantId, rateLimitResult);
        throw this.createRateLimitError(rateLimitResult);
      }
      phases.push('rate_limit_check');
    }

    // 3. Check cache (unless force recompute)
    const baseSnapshotId = createGraphSnapshotId(request.baseScanId);
    const targetSnapshotId = createGraphSnapshotId(request.targetScanId);

    if (this.config.enableCaching && !request.forceRecompute) {
      phases.push('cache_check');
      const cachedResult = await this.checkCache(
        request.tenantId,
        baseSnapshotId,
        targetSnapshotId
      );

      if (cachedResult) {
        const processingTimeMs = performance.now() - startTime;

        await this.logCacheHit(request.tenantId, cachedResult.diff.id);

        return {
          diff: cachedResult.diff,
          fromCache: true,
          cacheInfo: {
            cachedAt: cachedResult.metadata.cachedAt,
            expiresAt: cachedResult.metadata.expiresAt,
            accessCount: cachedResult.metadata.accessCount,
          },
          metadata: {
            requestedAt,
            processingTimeMs: Math.round(processingTimeMs),
            phases,
          },
        };
      }
    }

    // 4. Load graphs from scan repository
    phases.push('load_graphs');
    const [baseSnapshot, targetSnapshot] = await this.loadSnapshots(
      request.tenantId,
      request.baseScanId,
      request.targetScanId,
      request.repositoryId
    );

    // 5. Compute diff via engine
    phases.push('compute_diff');
    await this.logComputationInitiated(
      request.tenantId,
      request.baseScanId,
      request.targetScanId
    );

    const mergedOptions = this.mergeOptions(request.options);

    let diff: GraphDiffResult;
    try {
      diff = await this.engine.computeDiff(
        baseSnapshot,
        targetSnapshot,
        mergedOptions
      );
    } catch (error) {
      await this.logComputationFailed(
        request.tenantId,
        request.baseScanId,
        request.targetScanId,
        error
      );
      throw error;
    }

    await this.logComputationCompleted(request.tenantId, diff);

    // 6. Cache result
    if (this.config.enableCaching) {
      phases.push('cache_store');
      await this.cacheResult(request.tenantId, diff);
    }

    // 7. Record rate limit request
    if (this.config.enableRateLimiting && this.rateLimiter) {
      await this.rateLimiter.recordRequest(
        request.tenantId,
        RATE_LIMIT_OPERATION
      );
    }

    const processingTimeMs = performance.now() - startTime;

    return {
      diff,
      fromCache: false,
      metadata: {
        requestedAt,
        processingTimeMs: Math.round(processingTimeMs),
        phases,
      },
    };
  }

  /**
   * List diffs for a repository
   * @param tenantId - Tenant ID
   * @param repositoryId - Repository ID
   * @param options - List options
   * @returns Paginated diff list
   */
  async listDiffsForRepository(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    options?: ListOptions
  ): Promise<GraphDiffListResponse> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE)
    );

    this.logger.debug(
      { tenantId, repositoryId, page, pageSize },
      'Listing diffs for repository'
    );

    // Note: The actual implementation would query a database or index
    // For now, we return an empty list as this is a cache-based system
    // Real implementation would store diff metadata in a queryable store

    const diffs: DiffListItem[] = [];
    const total = 0;

    return {
      diffs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  /**
   * Delete a specific diff from cache
   * @param tenantId - Tenant ID
   * @param diffId - Diff ID to delete
   * @returns Whether the diff was deleted
   */
  async deleteDiff(tenantId: TenantId, diffId: GraphDiffId): Promise<boolean> {
    this.logger.debug({ tenantId, diffId }, 'Deleting diff');

    try {
      // Try to get the diff to verify it exists and belongs to tenant
      const cached = await this.cache.getDiff(tenantId, diffId);

      if (!cached) {
        this.logger.debug({ tenantId, diffId }, 'Diff not found in cache');
        return false;
      }

      // Invalidate by both snapshot IDs to ensure all cache entries are removed
      await Promise.all([
        this.cache.invalidateBySnapshot(tenantId, cached.diff.baseSnapshotId),
        this.cache.invalidateBySnapshot(tenantId, cached.diff.targetSnapshotId),
      ]);

      this.logger.info({ tenantId, diffId }, 'Diff deleted successfully');
      return true;
    } catch (error) {
      this.logger.error({ error, tenantId, diffId }, 'Error deleting diff');
      return false;
    }
  }

  /**
   * Estimate cost of computing a diff
   * @param tenantId - Tenant ID
   * @param baseScanId - Base scan ID
   * @param targetScanId - Target scan ID
   * @returns Cost estimate
   */
  async estimateDiffCost(
    tenantId: TenantId,
    baseScanId: ScanId,
    targetScanId: ScanId
  ): Promise<DiffCostEstimate> {
    this.logger.debug(
      { tenantId, baseScanId, targetScanId },
      'Estimating diff cost'
    );

    // Load scan metadata (not full graphs) to get counts
    const [baseScan, targetScan] = await Promise.all([
      this.scanRepository.findById(baseScanId, tenantId),
      this.scanRepository.findById(targetScanId, tenantId),
    ]);

    if (!baseScan) {
      throw GraphDiffError.snapshotNotFound(baseScanId, tenantId);
    }
    if (!targetScan) {
      throw GraphDiffError.snapshotNotFound(targetScanId, tenantId);
    }

    // Extract counts from result summary
    const baseNodeCount = baseScan.resultSummary?.totalNodes ?? 0;
    const baseEdgeCount = baseScan.resultSummary?.totalEdges ?? 0;
    const targetNodeCount = targetScan.resultSummary?.totalNodes ?? 0;
    const targetEdgeCount = targetScan.resultSummary?.totalEdges ?? 0;

    // Create snapshot refs for estimation
    const baseRef: GraphSnapshotRef = {
      id: createGraphSnapshotId(baseScanId),
      tenantId,
      nodeCount: baseNodeCount,
      edgeCount: baseEdgeCount,
      createdAt: baseScan.createdAt,
      version: 1,
    };

    const targetRef: GraphSnapshotRef = {
      id: createGraphSnapshotId(targetScanId),
      tenantId,
      nodeCount: targetNodeCount,
      edgeCount: targetEdgeCount,
      createdAt: targetScan.createdAt,
      version: 2,
    };

    return this.engine.estimateCost(baseRef, targetRef);
  }

  // ==========================================================================
  // Private Helper Methods - Validation
  // ==========================================================================

  /**
   * Validate diff request
   */
  private validateRequest(request: GraphDiffRequest): void {
    if (!request.tenantId) {
      throw new GraphDiffError(
        'Tenant ID is required',
        GraphDiffErrorCodes.INVALID_CONFIG,
        { field: 'tenantId' }
      );
    }

    if (!request.baseScanId) {
      throw new GraphDiffError(
        'Base scan ID is required',
        GraphDiffErrorCodes.INVALID_CONFIG,
        { field: 'baseScanId' }
      );
    }

    if (!request.targetScanId) {
      throw new GraphDiffError(
        'Target scan ID is required',
        GraphDiffErrorCodes.INVALID_CONFIG,
        { field: 'targetScanId' }
      );
    }

    if (request.baseScanId === request.targetScanId) {
      throw new GraphDiffError(
        'Base and target scan IDs must be different',
        GraphDiffErrorCodes.INVALID_CONFIG,
        { baseScanId: request.baseScanId, targetScanId: request.targetScanId }
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods - Rate Limiting
  // ==========================================================================

  /**
   * Check rate limit for tenant
   */
  private async checkRateLimit(tenantId: TenantId): Promise<RateLimitResult> {
    if (!this.rateLimiter) {
      return {
        allowed: true,
        currentCount: 0,
        limit: Infinity,
        windowSeconds: 0,
      };
    }

    return this.rateLimiter.checkLimit(tenantId, RATE_LIMIT_OPERATION);
  }

  /**
   * Create rate limit error with retry-after header info
   */
  private createRateLimitError(result: RateLimitResult): GraphDiffError {
    return new GraphDiffError(
      `Rate limit exceeded for graph diff computation. ` +
        `Current: ${result.currentCount}/${result.limit} requests. ` +
        `Retry after ${result.retryAfter ?? 60} seconds.`,
      GraphDiffErrorCodes.TIMEOUT, // Using TIMEOUT as closest match
      {
        currentCount: result.currentCount,
        limit: result.limit,
        retryAfter: result.retryAfter,
      }
    );
  }

  // ==========================================================================
  // Private Helper Methods - Cache
  // ==========================================================================

  /**
   * Check cache for existing diff result
   */
  private async checkCache(
    tenantId: TenantId,
    baseSnapshotId: GraphSnapshotId,
    targetSnapshotId: GraphSnapshotId
  ): Promise<CachedDiffResult | null> {
    try {
      const cached = await this.cache.getDiffBySnapshots(
        tenantId,
        baseSnapshotId,
        targetSnapshotId
      );

      if (cached) {
        this.logger.debug(
          { tenantId, baseSnapshotId, targetSnapshotId },
          'Cache hit for graph diff'
        );
        return cached;
      }

      this.logger.debug(
        { tenantId, baseSnapshotId, targetSnapshotId },
        'Cache miss for graph diff'
      );
      return null;
    } catch (error) {
      this.logger.warn(
        { error, tenantId },
        'Error checking cache, proceeding with computation'
      );
      return null;
    }
  }

  /**
   * Cache diff result
   */
  private async cacheResult(
    tenantId: TenantId,
    diff: GraphDiffResult
  ): Promise<void> {
    try {
      await this.cache.setDiff(tenantId, diff);
      this.logger.debug({ tenantId, diffId: diff.id }, 'Diff result cached');
    } catch (error) {
      // Log but don't fail on cache errors
      this.logger.warn({ error, tenantId, diffId: diff.id }, 'Error caching diff result');
    }
  }

  // ==========================================================================
  // Private Helper Methods - Graph Loading
  // ==========================================================================

  /**
   * Load graph snapshots from scan repository
   */
  private async loadSnapshots(
    tenantId: TenantId,
    baseScanId: ScanId,
    targetScanId: ScanId,
    repositoryId?: RepositoryId
  ): Promise<[GraphSnapshot, GraphSnapshot]> {
    // Load scans in parallel
    const [baseScan, targetScan] = await Promise.all([
      this.scanRepository.findById(baseScanId, tenantId),
      this.scanRepository.findById(targetScanId, tenantId),
    ]);

    if (!baseScan) {
      throw GraphDiffError.snapshotNotFound(baseScanId, tenantId);
    }

    if (!targetScan) {
      throw GraphDiffError.snapshotNotFound(targetScanId, tenantId);
    }

    // Verify repository filter if specified
    if (repositoryId) {
      if (baseScan.repositoryId !== repositoryId) {
        throw new GraphDiffError(
          `Base scan ${baseScanId} does not belong to repository ${repositoryId}`,
          GraphDiffErrorCodes.INVALID_SNAPSHOT,
          { baseScanId, repositoryId }
        );
      }
      if (targetScan.repositoryId !== repositoryId) {
        throw new GraphDiffError(
          `Target scan ${targetScanId} does not belong to repository ${repositoryId}`,
          GraphDiffErrorCodes.INVALID_SNAPSHOT,
          { targetScanId, repositoryId }
        );
      }
    }

    // Build snapshots from scans
    // Note: In a full implementation, we would load the actual graph data
    // from a graph storage service. For now, we create placeholder graphs.
    const baseSnapshot = this.buildSnapshot(
      baseScan,
      tenantId,
      1 // version
    );

    const targetSnapshot = this.buildSnapshot(
      targetScan,
      tenantId,
      2 // version
    );

    return [baseSnapshot, targetSnapshot];
  }

  /**
   * Build a GraphSnapshot from a scan entity
   */
  private buildSnapshot(
    scan: {
      id: ScanId;
      repositoryId: RepositoryId;
      createdAt: Date;
      resultSummary?: { totalNodes?: number; totalEdges?: number } | null;
    },
    tenantId: TenantId,
    version: number
  ): GraphSnapshot {
    // Note: In a real implementation, we would load the actual graph
    // from a graph storage service. This is a placeholder that creates
    // an empty graph structure.
    const graph: DependencyGraph = {
      id: `graph-${scan.id}`,
      nodes: new Map<string, NodeType>(),
      edges: [],
      metadata: {
        createdAt: scan.createdAt,
        sourceFiles: [],
        nodeCounts: {},
        edgeCounts: {} as Record<EdgeType, number>,
        buildTimeMs: 0,
      },
    };

    return {
      id: createGraphSnapshotId(scan.id),
      tenantId,
      repositoryId: scan.repositoryId,
      scanId: scan.id,
      graph,
      createdAt: scan.createdAt,
      version,
      metadata: {
        nodeCount: scan.resultSummary?.totalNodes ?? 0,
        edgeCount: scan.resultSummary?.totalEdges ?? 0,
      },
    };
  }

  // ==========================================================================
  // Private Helper Methods - Options Merging
  // ==========================================================================

  /**
   * Merge request options with defaults
   */
  private mergeOptions(
    requestOptions?: DiffComputationOptions
  ): DiffComputationOptions {
    return {
      ...DEFAULT_DIFF_COMPUTATION_OPTIONS,
      ...this.config.defaultOptions,
      ...requestOptions,
    };
  }

  // ==========================================================================
  // Private Helper Methods - Audit Logging
  // ==========================================================================

  /**
   * Log rate limit exceeded
   */
  private async logRateLimited(
    tenantId: TenantId,
    result: RateLimitResult
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    try {
      await this.auditLogger.rateLimited(
        tenantId,
        RATE_LIMIT_OPERATION,
        result.retryAfter
      );
    } catch (error) {
      this.logger.warn({ error }, 'Error logging rate limit event');
    }
  }

  /**
   * Log cache hit
   */
  private async logCacheHit(
    tenantId: TenantId,
    diffId: GraphDiffId
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    this.logger.debug({ tenantId, diffId }, 'Cache hit for diff computation');
    // Note: Could add audit event for cache hit tracking if needed
  }

  /**
   * Log computation initiated
   */
  private async logComputationInitiated(
    tenantId: TenantId,
    baseScanId: ScanId,
    targetScanId: ScanId
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    this.logger.info(
      { tenantId, baseScanId, targetScanId },
      'Graph diff computation initiated'
    );
  }

  /**
   * Log computation completed
   */
  private async logComputationCompleted(
    tenantId: TenantId,
    diff: GraphDiffResult
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    this.logger.info(
      {
        tenantId,
        diffId: diff.id,
        nodesAdded: diff.summary.nodesAdded,
        nodesRemoved: diff.summary.nodesRemoved,
        nodesModified: diff.summary.nodesModified,
        computationTimeMs: diff.timing.totalMs,
      },
      'Graph diff computation completed'
    );
  }

  /**
   * Log computation failed
   */
  private async logComputationFailed(
    tenantId: TenantId,
    baseScanId: ScanId,
    targetScanId: ScanId,
    error: unknown
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    this.logger.error(
      {
        tenantId,
        baseScanId,
        targetScanId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Graph diff computation failed'
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new GraphDiffService instance
 * @param deps - Service dependencies
 * @param config - Service configuration
 * @returns Configured GraphDiffService instance
 */
export function createGraphDiffService(
  deps: GraphDiffServiceDependencies,
  config?: GraphDiffServiceConfig
): IGraphDiffService {
  return new GraphDiffService(deps, config);
}

/**
 * Create GraphDiffService with default audit logger
 * @param deps - Partial dependencies (auditLogger will be defaulted)
 * @param config - Service configuration
 * @returns Configured GraphDiffService instance
 */
export function createGraphDiffServiceWithDefaults(
  deps: Omit<GraphDiffServiceDependencies, 'auditLogger'> & {
    auditLogger?: RollupAuditLogger;
  },
  config?: GraphDiffServiceConfig
): IGraphDiffService {
  const auditLogger = deps.auditLogger ?? getRollupAuditLogger();

  return new GraphDiffService(
    {
      ...deps,
      auditLogger,
    },
    config
  );
}

// ============================================================================
// Default Instance Management
// ============================================================================

let defaultGraphDiffService: GraphDiffService | null = null;

/**
 * Get the default GraphDiffService instance
 * @param deps - Dependencies for creation if not exists
 * @param config - Configuration for creation if not exists
 * @returns Default GraphDiffService instance
 * @throws Error if no instance exists and deps not provided
 */
export function getDefaultGraphDiffService(
  deps?: GraphDiffServiceDependencies,
  config?: GraphDiffServiceConfig
): IGraphDiffService {
  if (!defaultGraphDiffService) {
    if (!deps) {
      throw new Error(
        'GraphDiffService not initialized. Provide dependencies for first call.'
      );
    }
    defaultGraphDiffService = new GraphDiffService(deps, config);
  }
  return defaultGraphDiffService;
}

/**
 * Reset the default GraphDiffService instance
 */
export async function resetDefaultGraphDiffService(): Promise<void> {
  if (defaultGraphDiffService) {
    await defaultGraphDiffService.shutdown();
    defaultGraphDiffService = null;
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  IGraphDiffEngine,
  IDiffCache,
  GraphDiffResult,
  GraphDiffId,
  GraphSnapshotId,
  GraphSnapshot,
  DiffComputationOptions,
  DiffCostEstimate,
  DiffSummary,
  DiffTiming,
};
