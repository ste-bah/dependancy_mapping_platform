/**
 * Graph Diff Service - Main Public API for the diff module.
 * Orchestrates GraphDiffer, DiffCache, and DiffRepository.
 * TASK-ROLLUP-005: Diff Computation - Main Service API
 * @module diff/graph-diff-service
 */

import pino from 'pino';
import { TenantId, ScanId, ScanEntity, createScanId } from '../types/entities.js';
import { DependencyGraph, NodeType, EdgeType } from '../types/graph.js';
import { IScanRepository, PaginationParams, PaginatedResult } from '../repositories/interfaces.js';
import { IGraphDiffer, createGraphDiffer, DiffCostEstimate } from './graph-differ.js';
import { IDiffCache, createDiffCache, DiffCacheStats } from './diff-cache.js';
import { IDiffRepository, createDiffRepository } from './diff-repository.js';
import {
  DiffId, GraphDiff, ComputeDiffRequest, ComputeDiffResponse, DiffOptions,
  DiffErrorCodes, generateDiffId, isDiffCacheEntryValid,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

/** Options for listing diffs */
export interface ListDiffsOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'computedAt' | 'impactAssessment';
  sortDirection?: 'asc' | 'desc';
}

/** Lightweight diff list item */
export interface DiffListItem {
  id: DiffId;
  baseScanId: string;
  compareScanId: string;
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  impactAssessment: string;
  computedAt: Date;
  computationTimeMs: number;
}

/** Cost estimate response with cache info */
export interface DiffCostEstimateResponse extends DiffCostEstimate {
  existsInCache: boolean;
  existsInDatabase: boolean;
}

/** Service statistics */
export interface GraphDiffServiceStats {
  cache: DiffCacheStats;
  totalComputations: number;
  totalCacheHits: number;
  avgComputationTimeMs: number;
  rateLimitViolations: number;
  errorsCount: number;
}

/** Service dependencies */
export interface GraphDiffServiceDependencies {
  differ: IGraphDiffer;
  cache: IDiffCache;
  repository: IDiffRepository;
  scanRepository: IScanRepository;
  logger?: pino.Logger;
}

/** Service configuration */
export interface GraphDiffServiceConfig {
  enableCaching?: boolean;
  enableRateLimiting?: boolean;
  enableAuditLogging?: boolean;
  cacheTtlSeconds?: number;
  computationsPerMinute?: number;
  readsPerMinute?: number;
  defaultDiffOptions?: Partial<DiffOptions>;
}

/** Service interface */
export interface IGraphDiffService {
  getDiff(request: ComputeDiffRequest & { tenantId: TenantId }): Promise<ComputeDiffResponse>;
  getDiffById(diffId: DiffId, tenantId: TenantId): Promise<GraphDiff | null>;
  listDiffs(repositoryId: string, tenantId: TenantId, options?: ListDiffsOptions): Promise<PaginatedResult<DiffListItem>>;
  estimateCost(baseScanId: string, compareScanId: string, tenantId: TenantId): Promise<DiffCostEstimateResponse>;
  deleteDiff(diffId: DiffId, tenantId: TenantId): Promise<void>;
  invalidateScan(scanId: string, tenantId: TenantId): Promise<void>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getStats(): GraphDiffServiceStats;
}

// ============================================================================
// Errors
// ============================================================================

export class GraphDiffServiceError extends Error {
  constructor(message: string, public readonly code: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = 'GraphDiffServiceError';
  }
}

export class RateLimitExceededError extends GraphDiffServiceError {
  constructor(public readonly tenantId: TenantId, public readonly operation: string, public readonly retryAfterSeconds: number) {
    super(`Rate limit exceeded for ${operation}. Retry after ${retryAfterSeconds}s.`, 'RATE_LIMIT_EXCEEDED', { tenantId, operation, retryAfterSeconds });
  }
}

export class ScanNotFoundError extends GraphDiffServiceError {
  constructor(scanId: string, tenantId: TenantId) {
    super(`Scan not found: ${scanId}`, DiffErrorCodes.BASE_SCAN_NOT_FOUND, { scanId, tenantId });
  }
}

export class RepositoryMismatchError extends GraphDiffServiceError {
  constructor(baseScanRepo: string, compareScanRepo: string) {
    super('Scans are from different repositories', DiffErrorCodes.REPOSITORY_MISMATCH, { baseScanRepo, compareScanRepo });
  }
}

// ============================================================================
// Implementation
// ============================================================================

interface RateLimitEntry { count: number; windowStart: number; }

const DEFAULT_CONFIG: Required<GraphDiffServiceConfig> = {
  enableCaching: true,
  enableRateLimiting: true,
  enableAuditLogging: true,
  cacheTtlSeconds: 3600,
  computationsPerMinute: 10,
  readsPerMinute: 100,
  defaultDiffOptions: {},
};

/** Main Graph Diff Service - orchestrates diff components */
export class GraphDiffService implements IGraphDiffService {
  private readonly differ: IGraphDiffer;
  private readonly cache: IDiffCache;
  private readonly repository: IDiffRepository;
  private readonly scanRepository: IScanRepository;
  private readonly logger: pino.Logger;
  private readonly config: Required<GraphDiffServiceConfig>;
  private readonly computeRateLimits = new Map<string, RateLimitEntry>();
  private readonly readRateLimits = new Map<string, RateLimitEntry>();
  private stats = { totalComputations: 0, totalCacheHits: 0, totalComputationTimeMs: 0, rateLimitViolations: 0, errorsCount: 0 };
  private initialized = false;

  constructor(deps: GraphDiffServiceDependencies, config?: GraphDiffServiceConfig) {
    this.differ = deps.differ;
    this.cache = deps.cache;
    this.repository = deps.repository;
    this.scanRepository = deps.scanRepository;
    this.logger = deps.logger ?? pino({ name: 'graph-diff-service' });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.logger.info('Initializing GraphDiffService');
    await this.cache.initialize();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.logger.info('Shutting down GraphDiffService');
    await this.cache.shutdown();
    this.initialized = false;
  }

  async getDiff(request: ComputeDiffRequest & { tenantId: TenantId }): Promise<ComputeDiffResponse> {
    const startTime = Date.now();
    const { baseScanId, compareScanId, repositoryId, options, tenantId } = request;

    try {
      if (this.config.enableRateLimiting) {
        this.checkRateLimit(tenantId, 'compute', this.config.computationsPerMinute, this.computeRateLimits);
      }

      // Check cache
      if (this.config.enableCaching && !options?.forceRecompute) {
        const cached = await this.cache.getByScanPair(tenantId, baseScanId as string, compareScanId as string);
        if (cached && isDiffCacheEntryValid(cached.metadata)) {
          this.stats.totalCacheHits++;
          this.logAudit(tenantId, 'cache_hit', cached.data.id as string, { baseScanId, compareScanId });
          return { success: true, diff: cached.data, fromCache: true, computationTimeMs: Date.now() - startTime };
        }
      }

      // Check database
      const existing = await this.repository.findByScanPair(baseScanId as string, compareScanId as string, tenantId);
      if (existing?.diffData && !options?.forceRecompute) {
        if (this.config.enableCaching) await this.cache.set(tenantId, existing.diffData, this.config.cacheTtlSeconds);
        this.stats.totalCacheHits++;
        return { success: true, diff: existing.diffData, fromCache: true, computationTimeMs: Date.now() - startTime };
      }

      // Load scans and validate
      const [baseScan, compareScan] = await this.loadScans(baseScanId, compareScanId, tenantId);
      if (repositoryId && baseScan.repositoryId !== repositoryId) {
        throw new RepositoryMismatchError(baseScan.repositoryId as string, repositoryId as string);
      }
      if (baseScan.repositoryId !== compareScan.repositoryId) {
        throw new RepositoryMismatchError(baseScan.repositoryId as string, compareScan.repositoryId as string);
      }

      // Build graphs and compute diff
      const [baseGraph, compareGraph] = this.buildGraphs(baseScan, compareScan);
      const mergedOptions = { ...this.config.defaultDiffOptions, ...options };
      const rawDiff = await this.differ.computeDiff(baseGraph, compareGraph, mergedOptions);

      // Create enriched diff
      const diff: GraphDiff = {
        ...rawDiff,
        id: generateDiffId(baseScanId, compareScanId),
        baseScanId,
        compareScanId,
        repositoryId: baseScan.repositoryId,
        tenantId,
      };

      // Store
      await this.repository.create(diff, tenantId);
      if (this.config.enableCaching) await this.cache.set(tenantId, diff, this.config.cacheTtlSeconds);

      const computationTimeMs = Date.now() - startTime;
      this.stats.totalComputations++;
      this.stats.totalComputationTimeMs += computationTimeMs;
      this.logAudit(tenantId, 'computed', diff.id as string, { baseScanId, compareScanId, computationTimeMs });

      return { success: true, diff, fromCache: false, computationTimeMs };
    } catch (error) {
      this.stats.errorsCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error, tenantId, baseScanId, compareScanId }, 'Error computing diff');
      return { success: false, fromCache: false, error: errorMessage, computationTimeMs: Date.now() - startTime };
    }
  }

  async getDiffById(diffId: DiffId, tenantId: TenantId): Promise<GraphDiff | null> {
    try {
      if (this.config.enableRateLimiting) {
        this.checkRateLimit(tenantId, 'read', this.config.readsPerMinute, this.readRateLimits);
      }
      if (this.config.enableCaching) {
        const cached = await this.cache.get(tenantId, diffId);
        if (cached && isDiffCacheEntryValid(cached.metadata)) {
          this.stats.totalCacheHits++;
          return cached.data;
        }
      }
      const entity = await this.repository.findById(diffId, tenantId, true);
      if (!entity?.diffData) return null;
      if (this.config.enableCaching) await this.cache.set(tenantId, entity.diffData, this.config.cacheTtlSeconds);
      return entity.diffData;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, tenantId, diffId }, 'Error getting diff');
      throw error;
    }
  }

  async listDiffs(repositoryId: string, tenantId: TenantId, options?: ListDiffsOptions): Promise<PaginatedResult<DiffListItem>> {
    if (this.config.enableRateLimiting) {
      this.checkRateLimit(tenantId, 'read', this.config.readsPerMinute, this.readRateLimits);
    }
    const pagination: PaginationParams = { page: options?.page ?? 1, pageSize: Math.min(options?.pageSize ?? 20, 100) };
    const result = await this.repository.findByRepository(repositoryId, tenantId, pagination, false);
    return {
      ...result,
      data: result.data.map(e => ({
        id: e.id, baseScanId: e.baseScanId, compareScanId: e.compareScanId,
        nodesAdded: e.nodesAddedCount, nodesRemoved: e.nodesRemovedCount, nodesModified: e.nodesModifiedCount,
        impactAssessment: e.impactAssessment, computedAt: e.computedAt, computationTimeMs: e.computationTimeMs,
      })),
    };
  }

  async estimateCost(baseScanId: string, compareScanId: string, tenantId: TenantId): Promise<DiffCostEstimateResponse> {
    const cached = this.config.enableCaching ? await this.cache.getByScanPair(tenantId, baseScanId, compareScanId) : null;
    const existsInCache = cached !== null && isDiffCacheEntryValid(cached.metadata);
    const existsInDatabase = await this.repository.exists(baseScanId, compareScanId, tenantId);
    const [baseScan, compareScan] = await this.loadScans(createScanId(baseScanId), createScanId(compareScanId), tenantId);
    const [baseGraph, compareGraph] = this.buildGraphs(baseScan, compareScan);
    const estimate = this.differ.estimateCost(baseGraph, compareGraph);
    return { ...estimate, existsInCache, existsInDatabase };
  }

  async deleteDiff(diffId: DiffId, tenantId: TenantId): Promise<void> {
    const entity = await this.repository.findById(diffId, tenantId, false);
    if (entity) {
      if (this.config.enableCaching) await this.cache.invalidate(tenantId, diffId);
      await this.repository.delete(diffId, tenantId);
      this.logAudit(tenantId, 'deleted', diffId as string, { baseScanId: entity.baseScanId, compareScanId: entity.compareScanId });
    }
  }

  async invalidateScan(scanId: string, tenantId: TenantId): Promise<void> {
    if (this.config.enableCaching) {
      const count = await this.cache.invalidateByScan(tenantId, scanId);
      this.logger.info({ tenantId, scanId, count }, 'Cache invalidated');
    }
  }

  getStats(): GraphDiffServiceStats {
    return {
      cache: this.cache.getStats(),
      totalComputations: this.stats.totalComputations,
      totalCacheHits: this.stats.totalCacheHits,
      avgComputationTimeMs: this.stats.totalComputations > 0 ? this.stats.totalComputationTimeMs / this.stats.totalComputations : 0,
      rateLimitViolations: this.stats.rateLimitViolations,
      errorsCount: this.stats.errorsCount,
    };
  }

  // Private helpers
  private checkRateLimit(tenantId: TenantId, op: string, limit: number, limits: Map<string, RateLimitEntry>): void {
    const key = `${tenantId}:${op}`;
    const now = Date.now();
    let entry = limits.get(key);
    if (!entry || now - entry.windowStart >= 60000) {
      entry = { count: 0, windowStart: now };
      limits.set(key, entry);
    }
    if (entry.count >= limit) {
      this.stats.rateLimitViolations++;
      throw new RateLimitExceededError(tenantId, op, Math.ceil((entry.windowStart + 60000 - now) / 1000));
    }
    entry.count++;
  }

  private async loadScans(baseScanId: ScanId, compareScanId: ScanId, tenantId: TenantId): Promise<[ScanEntity, ScanEntity]> {
    const [base, compare] = await Promise.all([
      this.scanRepository.findById(baseScanId, tenantId),
      this.scanRepository.findById(compareScanId, tenantId),
    ]);
    if (!base) throw new ScanNotFoundError(baseScanId as string, tenantId);
    if (!compare) throw new ScanNotFoundError(compareScanId as string, tenantId);
    return [base, compare];
  }

  private buildGraphs(baseScan: ScanEntity, compareScan: ScanEntity): [DependencyGraph, DependencyGraph] {
    // TODO: Load actual graph data from graph storage service
    const buildGraph = (scan: ScanEntity): DependencyGraph => ({
      id: `graph-${scan.id}`,
      nodes: new Map<string, NodeType>(),
      edges: [],
      metadata: {
        createdAt: scan.createdAt,
        sourceFiles: [],
        nodeCounts: scan.resultSummary?.nodesByType ?? {},
        edgeCounts: (scan.resultSummary?.edgesByType ?? {}) as Record<EdgeType, number>,
        buildTimeMs: 0,
      },
    });
    return [buildGraph(baseScan), buildGraph(compareScan)];
  }

  private logAudit(tenantId: TenantId, action: string, resourceId: string, details: Record<string, unknown>): void {
    if (this.config.enableAuditLogging) {
      this.logger.info({ tenantId, action, resourceId, resourceType: 'diff', ...details }, `Audit: ${action}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createGraphDiffService(deps: GraphDiffServiceDependencies, config?: GraphDiffServiceConfig): IGraphDiffService {
  return new GraphDiffService(deps, config);
}

export function createGraphDiffServiceWithDefaults(scanRepository: IScanRepository, config?: GraphDiffServiceConfig): IGraphDiffService {
  return new GraphDiffService({ differ: createGraphDiffer(), cache: createDiffCache(), repository: createDiffRepository(), scanRepository }, config);
}

let defaultService: GraphDiffService | null = null;

export function getDefaultGraphDiffService(deps?: GraphDiffServiceDependencies, config?: GraphDiffServiceConfig): IGraphDiffService {
  if (!defaultService) {
    if (!deps) throw new Error('GraphDiffService not initialized. Provide dependencies.');
    defaultService = new GraphDiffService(deps, config);
  }
  return defaultService;
}

export async function resetDefaultGraphDiffService(): Promise<void> {
  if (defaultService) {
    await defaultService.shutdown();
    defaultService = null;
  }
}

// Re-exports
export type { DiffId, GraphDiff, ComputeDiffRequest, ComputeDiffResponse, DiffOptions, DiffSummary, ImpactLevel } from './types.js';
export type { DiffCostEstimate } from './graph-differ.js';
export type { DiffCacheStats } from './diff-cache.js';
export type { DiffEntity, DiffRepositoryStats } from './diff-repository.js';
