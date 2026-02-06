/**
 * Performance-Optimized Graph Querier with Caching
 * @module optimization/cached-graph-querier
 *
 * Wraps the base GraphQuerier with caching for expensive operations.
 * Uses Redis for distributed caching with configurable TTLs.
 *
 * TASK-DETECT: Performance optimization implementation
 */

import {
  ScanId,
  NodeEntity,
  TenantId,
  DbNodeId,
} from '../types/entities.js';
import {
  IGraphQuerier,
  GraphPath,
  CycleInfo,
  ImpactAnalysisResult,
} from '../repositories/interfaces.js';
import { GraphQuerier } from '../repositories/graph-querier.js';
import { GraphTraversalCache } from './index.js';
import pino from 'pino';

const logger = pino({ name: 'cached-graph-querier' });

// ============================================================================
// Configuration
// ============================================================================

/**
 * Cache configuration options
 */
export interface CachedQuerierOptions {
  /** Enable caching (default: true) */
  enabled: boolean;
  /** TTL for downstream queries in seconds */
  downstreamTTL: number;
  /** TTL for upstream queries in seconds */
  upstreamTTL: number;
  /** TTL for cycle detection in seconds */
  cycleTTL: number;
  /** TTL for path queries in seconds */
  pathTTL: number;
  /** Enable performance monitoring */
  enableMonitoring: boolean;
}

/**
 * Default cache configuration
 */
const DEFAULT_OPTIONS: CachedQuerierOptions = {
  enabled: true,
  downstreamTTL: 1800, // 30 minutes
  upstreamTTL: 1800,
  cycleTTL: 3600, // 1 hour (cycles change less frequently)
  pathTTL: 900, // 15 minutes
  enableMonitoring: true,
};

// ============================================================================
// Cached Graph Querier
// ============================================================================

/**
 * Graph querier with caching layer
 */
export class CachedGraphQuerier implements IGraphQuerier {
  private readonly baseQuerier: GraphQuerier;
  private readonly cache: GraphTraversalCache;
  private readonly options: CachedQuerierOptions;

  constructor(options: Partial<CachedQuerierOptions> = {}) {
    this.baseQuerier = new GraphQuerier();
    this.cache = new GraphTraversalCache();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get downstream dependencies with caching
   */
  async getDownstreamDependencies(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth: number = 10
  ): Promise<NodeEntity[]> {
    const cacheKey = `downstream:${scanId}:${nodeId}:${maxDepth}`;

    if (this.options.enabled) {
      const cached = await this.cache.getCachedDownstream<NodeEntity[]>(
        scanId,
        nodeId,
        maxDepth
      );

      if (cached) {
        logger.debug({ cacheKey }, 'Cache hit for downstream dependencies');
        return cached;
      }
    }

    const startTime = this.options.enableMonitoring ? Date.now() : 0;

    const result = await this.baseQuerier.getDownstreamDependencies(
      scanId,
      tenantId,
      nodeId,
      maxDepth
    );

    if (this.options.enableMonitoring) {
      const duration = Date.now() - startTime;
      logger.debug({ cacheKey, duration, count: result.length }, 'Downstream query executed');
    }

    if (this.options.enabled) {
      await this.cache.cacheDownstream(scanId, nodeId, maxDepth, result);
    }

    return result;
  }

  /**
   * Get upstream dependents with caching
   */
  async getUpstreamDependents(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth: number = 10
  ): Promise<NodeEntity[]> {
    const cacheKey = `upstream:${scanId}:${nodeId}:${maxDepth}`;

    if (this.options.enabled) {
      const cached = await this.cache.getCachedUpstream<NodeEntity[]>(
        scanId,
        nodeId,
        maxDepth
      );

      if (cached) {
        logger.debug({ cacheKey }, 'Cache hit for upstream dependents');
        return cached;
      }
    }

    const startTime = this.options.enableMonitoring ? Date.now() : 0;

    const result = await this.baseQuerier.getUpstreamDependents(
      scanId,
      tenantId,
      nodeId,
      maxDepth
    );

    if (this.options.enableMonitoring) {
      const duration = Date.now() - startTime;
      logger.debug({ cacheKey, duration, count: result.length }, 'Upstream query executed');
    }

    if (this.options.enabled) {
      await this.cache.cacheUpstream(scanId, nodeId, maxDepth, result);
    }

    return result;
  }

  /**
   * Find shortest path (no caching - paths are usually unique queries)
   */
  async findShortestPath(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId,
    targetNodeId: DbNodeId
  ): Promise<GraphPath | null> {
    return this.baseQuerier.findShortestPath(
      scanId,
      tenantId,
      sourceNodeId,
      targetNodeId
    );
  }

  /**
   * Find all paths between nodes
   */
  async findAllPaths(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId,
    targetNodeId: DbNodeId,
    maxDepth?: number
  ): Promise<GraphPath[]> {
    return this.baseQuerier.findAllPaths(
      scanId,
      tenantId,
      sourceNodeId,
      targetNodeId,
      maxDepth
    );
  }

  /**
   * Detect cycles with caching
   */
  async detectCycles(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<CycleInfo[]> {
    if (this.options.enabled) {
      const cached = await this.cache.getCachedCycles<CycleInfo[]>(scanId);
      if (cached) {
        logger.debug({ scanId }, 'Cache hit for cycle detection');
        return cached;
      }
    }

    const startTime = this.options.enableMonitoring ? Date.now() : 0;

    const result = await this.baseQuerier.detectCycles(scanId, tenantId);

    if (this.options.enableMonitoring) {
      const duration = Date.now() - startTime;
      logger.debug({ scanId, duration, cycles: result.length }, 'Cycle detection executed');
    }

    if (this.options.enabled) {
      await this.cache.cacheCycles(scanId, result);
    }

    return result;
  }

  /**
   * Get connected components
   */
  async getConnectedComponents(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<NodeEntity[][]> {
    return this.baseQuerier.getConnectedComponents(scanId, tenantId);
  }

  /**
   * Analyze impact of a node change
   */
  async analyzeImpact(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth?: number
  ): Promise<ImpactAnalysisResult> {
    return this.baseQuerier.analyzeImpact(scanId, tenantId, nodeId, maxDepth);
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<{
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    maxDepth: number;
    componentCount: number;
    hasCycles: boolean;
  }> {
    return this.baseQuerier.getGraphStatistics(scanId, tenantId);
  }

  /**
   * Find nodes with high fan-out
   */
  async findHighFanOutNodes(
    scanId: ScanId,
    tenantId: TenantId,
    threshold?: number
  ): Promise<Array<{ node: NodeEntity; fanOut: number }>> {
    return this.baseQuerier.findHighFanOutNodes(scanId, tenantId, threshold);
  }

  /**
   * Find nodes with high fan-in
   */
  async findHighFanInNodes(
    scanId: ScanId,
    tenantId: TenantId,
    threshold?: number
  ): Promise<Array<{ node: NodeEntity; fanIn: number }>> {
    return this.baseQuerier.findHighFanInNodes(scanId, tenantId, threshold);
  }

  /**
   * Invalidate all caches for a scan
   */
  async invalidateScanCache(scanId: string): Promise<void> {
    await this.cache.invalidateGraphCaches(scanId);
    logger.info({ scanId }, 'Graph caches invalidated');
  }

  /**
   * Warm up cache for a scan by pre-computing common queries
   */
  async warmupCache(
    scanId: ScanId,
    tenantId: TenantId,
    nodeIds: DbNodeId[]
  ): Promise<void> {
    logger.info({ scanId, nodeCount: nodeIds.length }, 'Starting cache warmup');

    const startTime = Date.now();

    // Pre-compute downstream and upstream for given nodes
    const promises = nodeIds.flatMap(nodeId => [
      this.getDownstreamDependencies(scanId, tenantId, nodeId, 5),
      this.getUpstreamDependents(scanId, tenantId, nodeId, 5),
    ]);

    // Also pre-compute cycle detection (separate call)
    await Promise.all(promises);
    await this.detectCycles(scanId, tenantId);

    const duration = Date.now() - startTime;
    logger.info(
      { scanId, nodeCount: nodeIds.length, duration },
      'Cache warmup complete'
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new cached graph querier instance
 */
export function createCachedGraphQuerier(
  options?: Partial<CachedQuerierOptions>
): CachedGraphQuerier {
  return new CachedGraphQuerier(options);
}
