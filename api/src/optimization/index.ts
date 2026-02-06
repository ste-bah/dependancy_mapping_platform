/**
 * Performance Optimization Module
 * @module optimization
 *
 * Exports all performance optimization utilities including:
 * - Caching (LRU, Redis, memoization)
 * - Batch processing
 * - Optimized algorithms
 *
 * TASK-DETECT: Performance optimization implementation
 */

// ============================================================================
// Cache Exports
// ============================================================================

export {
  // LRU Cache
  LRUCache,
  type CacheOptions,
  type CacheStats,

  // Expression Cache
  ExpressionCache,
  getExpressionCache,

  // Redis Cache
  RedisCache,

  // Domain-specific caches
  ScanCache,
  GraphTraversalCache,
  CacheFactory,

  // Memoization utilities
  memoize,
  memoizeAsync,
} from './cache.js';

// ============================================================================
// Batch Processing Exports
// ============================================================================

export {
  // Batch processor
  BatchProcessor,
  type BatchOptions,
  type BatchResultStats,
  type BatchProgressCallback,

  // Database batch operations
  batchInsertUnnest,
  batchUpsertUnnest,
  bulkUpdateCaseWhen,

  // Parallel execution
  parallelWithLimit,
  streamBatch,
  collectStream,

  // Utilities
  createBatchInsertQuery,
  chunkArray,
  retryWithBackoff,
} from './batch.js';

// ============================================================================
// Algorithm Exports
// ============================================================================

export {
  // Tarjan's algorithm
  tarjanSCC,
  findCyclesTarjan,
  type StronglyConnectedComponent,
  type CycleInfo,

  // Topological sort
  topologicalSort,
  topologicalSortDFS,
  type TopologicalSortResult,

  // Shortest path
  bfsShortestPath,
  findAllPaths,
  type ShortestPathResult,

  // Reachability
  findReachableNodes,
  findNodesThatReach,

  // Graph metrics
  calculateDensity,
  calculateAverageDegree,
  findArticulationPoints,

  // Utilities
  buildReverseAdjacencyList,
} from './algorithms.js';

// ============================================================================
// Cached Graph Querier Exports
// ============================================================================

export {
  CachedGraphQuerier,
  createCachedGraphQuerier,
  type CachedQuerierOptions,
} from './cached-graph-querier.js';

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Performance timer for measuring operation durations
 */
export class PerformanceTimer {
  private readonly timers: Map<string, number> = new Map();
  private readonly measurements: Map<string, number[]> = new Map();

  /**
   * Start a named timer
   */
  start(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * Stop a timer and record the duration
   */
  stop(name: string): number {
    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      throw new Error(`Timer '${name}' was not started`);
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const measurements = this.measurements.get(name) ?? [];
    measurements.push(duration);
    this.measurements.set(name, measurements);

    return duration;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      return await operation();
    } finally {
      this.stop(name);
    }
  }

  /**
   * Measure a sync operation
   */
  measureSync<T>(name: string, operation: () => T): T {
    this.start(name);
    try {
      return operation();
    } finally {
      this.stop(name);
    }
  }

  /**
   * Get statistics for a timer
   */
  getStats(name: string): {
    count: number;
    total: number;
    mean: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const total = sorted.reduce((a, b) => a + b, 0);
    const len = sorted.length;

    return {
      count: len,
      total,
      mean: total / len,
      min: sorted[0] ?? 0,
      max: sorted[len - 1] ?? 0,
      p50: sorted[Math.floor(len * 0.5)] ?? 0,
      p95: sorted[Math.floor(len * 0.95)] ?? 0,
      p99: sorted[Math.floor(len * 0.99)] ?? 0,
    };
  }

  /**
   * Get all statistics
   */
  getAllStats(): Map<string, ReturnType<PerformanceTimer['getStats']>> {
    const allStats = new Map<string, ReturnType<PerformanceTimer['getStats']>>();

    for (const name of this.measurements.keys()) {
      allStats.set(name, this.getStats(name));
    }

    return allStats;
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.timers.clear();
    this.measurements.clear();
  }
}

// Global performance timer instance
let globalTimer: PerformanceTimer | null = null;

/**
 * Get the global performance timer
 */
export function getPerformanceTimer(): PerformanceTimer {
  if (!globalTimer) {
    globalTimer = new PerformanceTimer();
  }
  return globalTimer;
}

// ============================================================================
// Memory Usage Tracking
// ============================================================================

/**
 * Get current memory usage
 */
export function getMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  formatted: {
    heapUsed: string;
    heapTotal: string;
    external: string;
    rss: string;
  };
} {
  const usage = process.memoryUsage();

  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
    formatted: {
      heapUsed: formatBytes(usage.heapUsed),
      heapTotal: formatBytes(usage.heapTotal),
      external: formatBytes(usage.external),
      rss: formatBytes(usage.rss),
    },
  };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

// ============================================================================
// Performance Configuration
// ============================================================================

/**
 * Performance configuration options
 */
export interface PerformanceConfig {
  /** Expression cache max size */
  expressionCacheSize: number;
  /** Scan cache TTL in seconds */
  scanCacheTTL: number;
  /** Graph cache TTL in seconds */
  graphCacheTTL: number;
  /** Default batch size */
  defaultBatchSize: number;
  /** Default concurrency limit */
  defaultConcurrency: number;
  /** Enable performance monitoring */
  enableMonitoring: boolean;
}

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  expressionCacheSize: 10000,
  scanCacheTTL: 3600,
  graphCacheTTL: 1800,
  defaultBatchSize: 1000,
  defaultConcurrency: 10,
  enableMonitoring: true,
};

/**
 * Get performance configuration from environment
 */
export function getPerformanceConfig(): PerformanceConfig {
  return {
    expressionCacheSize: parseInt(
      process.env.PERF_EXPRESSION_CACHE_SIZE ?? String(DEFAULT_PERFORMANCE_CONFIG.expressionCacheSize),
      10
    ),
    scanCacheTTL: parseInt(
      process.env.PERF_SCAN_CACHE_TTL ?? String(DEFAULT_PERFORMANCE_CONFIG.scanCacheTTL),
      10
    ),
    graphCacheTTL: parseInt(
      process.env.PERF_GRAPH_CACHE_TTL ?? String(DEFAULT_PERFORMANCE_CONFIG.graphCacheTTL),
      10
    ),
    defaultBatchSize: parseInt(
      process.env.PERF_DEFAULT_BATCH_SIZE ?? String(DEFAULT_PERFORMANCE_CONFIG.defaultBatchSize),
      10
    ),
    defaultConcurrency: parseInt(
      process.env.PERF_DEFAULT_CONCURRENCY ?? String(DEFAULT_PERFORMANCE_CONFIG.defaultConcurrency),
      10
    ),
    enableMonitoring: process.env.PERF_ENABLE_MONITORING !== 'false',
  };
}
