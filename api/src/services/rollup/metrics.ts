/**
 * Rollup Metrics Collector
 * @module services/rollup/metrics
 *
 * Prometheus-compatible metrics for Cross-Repository Aggregation (Rollup) operations.
 * Provides counters, histograms, and gauges for monitoring rollup performance and health.
 *
 * Metrics tracked:
 * - Execution counts and durations
 * - Match counts by strategy
 * - Node processing throughput
 * - Error rates by type
 * - Cache hit/miss ratios
 * - Active execution counts
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation metrics implementation
 */

import {
  Counter,
  Histogram,
  Gauge,
  Summary,
  Registry,
} from 'prom-client';
import { metricsRegistry } from '../../logging/metrics.js';
import { MatchingStrategy } from '../../types/rollup.js';

// ============================================================================
// Metric Labels
// ============================================================================

/**
 * Common label names for rollup metrics
 */
const ROLLUP_LABEL_NAMES = {
  TENANT_ID: 'tenant_id',
  ROLLUP_ID: 'rollup_id',
  STATUS: 'status',
  PHASE: 'phase',
  STRATEGY: 'strategy',
  ERROR_CODE: 'error_code',
  OPERATION: 'operation',
} as const;

/**
 * Valid status values for execution metrics
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Valid phase values for execution metrics
 */
export type ExecutionPhase = 'fetch' | 'match' | 'merge' | 'store' | 'callback' | 'total';

// ============================================================================
// Counter Metrics
// ============================================================================

/**
 * Total rollup executions counter
 */
export const rollupExecutionsTotal = new Counter({
  name: 'iac_rollup_executions_total',
  help: 'Total number of rollup executions',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.STATUS,
  ],
  registers: [metricsRegistry],
});

/**
 * Total nodes processed counter
 */
export const rollupNodesProcessedTotal = new Counter({
  name: 'iac_rollup_nodes_processed_total',
  help: 'Total number of nodes processed across all rollup executions',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.OPERATION,
  ],
  registers: [metricsRegistry],
});

/**
 * Total matches found counter
 */
export const rollupMatchesFoundTotal = new Counter({
  name: 'iac_rollup_matches_found_total',
  help: 'Total number of matches found across all rollup executions',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.STRATEGY,
  ],
  registers: [metricsRegistry],
});

/**
 * Total rollup errors counter
 */
export const rollupErrorsTotal = new Counter({
  name: 'iac_rollup_errors_total',
  help: 'Total number of rollup errors by error code',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.ERROR_CODE,
    ROLLUP_LABEL_NAMES.PHASE,
  ],
  registers: [metricsRegistry],
});

/**
 * Total rollup CRUD operations counter
 */
export const rollupOperationsTotal = new Counter({
  name: 'iac_rollup_operations_total',
  help: 'Total number of rollup CRUD operations',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.OPERATION,
    ROLLUP_LABEL_NAMES.STATUS,
  ],
  registers: [metricsRegistry],
});

/**
 * Cross-repository edges created counter
 */
export const rollupCrossRepoEdgesTotal = new Counter({
  name: 'iac_rollup_cross_repo_edges_total',
  help: 'Total number of cross-repository edges created',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
  ],
  registers: [metricsRegistry],
});

/**
 * Merge conflicts counter
 */
export const rollupMergeConflictsTotal = new Counter({
  name: 'iac_rollup_merge_conflicts_total',
  help: 'Total number of merge conflicts encountered',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    'conflict_type',
    'resolution',
  ],
  registers: [metricsRegistry],
});

// ============================================================================
// Histogram Metrics
// ============================================================================

/**
 * Rollup execution duration histogram
 */
export const rollupExecutionDurationSeconds = new Histogram({
  name: 'iac_rollup_execution_duration_seconds',
  help: 'Rollup execution duration in seconds',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.STATUS,
  ],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [metricsRegistry],
});

/**
 * Rollup phase duration histogram
 */
export const rollupPhaseDurationSeconds = new Histogram({
  name: 'iac_rollup_phase_duration_seconds',
  help: 'Duration of individual rollup phases in seconds',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.PHASE,
  ],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
});

/**
 * Nodes processed per execution histogram
 */
export const rollupNodesPerExecution = new Histogram({
  name: 'iac_rollup_nodes_per_execution',
  help: 'Number of nodes processed per rollup execution',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
  ],
  buckets: [10, 50, 100, 500, 1000, 2500, 5000, 10000, 25000, 50000],
  registers: [metricsRegistry],
});

/**
 * Matches per execution histogram
 */
export const rollupMatchesPerExecution = new Histogram({
  name: 'iac_rollup_matches_per_execution',
  help: 'Number of matches found per rollup execution',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.STRATEGY,
  ],
  buckets: [0, 1, 5, 10, 50, 100, 500, 1000, 5000],
  registers: [metricsRegistry],
});

/**
 * Matcher duration histogram
 */
export const rollupMatcherDurationSeconds = new Histogram({
  name: 'iac_rollup_matcher_duration_seconds',
  help: 'Matcher execution duration in seconds',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.STRATEGY,
  ],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Merge duration histogram
 */
export const rollupMergeDurationSeconds = new Histogram({
  name: 'iac_rollup_merge_duration_seconds',
  help: 'Graph merge duration in seconds',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
  ],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

/**
 * Blast radius analysis duration histogram
 */
export const rollupBlastRadiusDurationSeconds = new Histogram({
  name: 'iac_rollup_blast_radius_duration_seconds',
  help: 'Blast radius analysis duration in seconds',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
  ],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Repository count per rollup histogram
 */
export const rollupRepositoryCount = new Histogram({
  name: 'iac_rollup_repository_count',
  help: 'Number of repositories per rollup configuration',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
  ],
  buckets: [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20],
  registers: [metricsRegistry],
});

// ============================================================================
// Gauge Metrics
// ============================================================================

/**
 * Active rollup executions gauge
 */
export const rollupActiveExecutions = new Gauge({
  name: 'iac_rollup_active_executions',
  help: 'Number of currently running rollup executions',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
  ],
  registers: [metricsRegistry],
});

/**
 * Rollup cache size gauge
 */
export const rollupCacheSize = new Gauge({
  name: 'iac_rollup_cache_size',
  help: 'Current rollup cache size',
  labelNames: [
    'cache_type',
  ],
  registers: [metricsRegistry],
});

/**
 * Rollup cache hit ratio gauge
 */
export const rollupCacheHitRatio = new Gauge({
  name: 'iac_rollup_cache_hit_ratio',
  help: 'Rollup cache hit ratio (0-1)',
  labelNames: [
    'cache_type',
  ],
  registers: [metricsRegistry],
});

/**
 * Active rollup configurations gauge
 */
export const rollupActiveConfigurations = new Gauge({
  name: 'iac_rollup_active_configurations',
  help: 'Number of active rollup configurations',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.STATUS,
  ],
  registers: [metricsRegistry],
});

/**
 * Last execution timestamp gauge
 */
export const rollupLastExecutionTimestamp = new Gauge({
  name: 'iac_rollup_last_execution_timestamp_seconds',
  help: 'Unix timestamp of last rollup execution',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.ROLLUP_ID,
  ],
  registers: [metricsRegistry],
});

// ============================================================================
// Summary Metrics
// ============================================================================

/**
 * Match confidence summary
 */
export const rollupMatchConfidence = new Summary({
  name: 'iac_rollup_match_confidence',
  help: 'Match confidence score distribution',
  labelNames: [
    ROLLUP_LABEL_NAMES.TENANT_ID,
    ROLLUP_LABEL_NAMES.STRATEGY,
  ],
  percentiles: [0.5, 0.75, 0.9, 0.95, 0.99],
  registers: [metricsRegistry],
});

// ============================================================================
// Metrics Helper Object
// ============================================================================

/**
 * Rollup metrics helper with convenient recording methods
 */
export const rollupMetrics = {
  // ===== Execution Metrics =====

  /**
   * Record execution started
   */
  recordExecutionStarted(tenantId: string): void {
    rollupActiveExecutions.inc({ tenant_id: tenantId });
  },

  /**
   * Record execution completed
   */
  recordExecutionCompleted(
    tenantId: string,
    durationSeconds: number,
    nodeCount: number,
    status: ExecutionStatus = 'completed'
  ): void {
    rollupActiveExecutions.dec({ tenant_id: tenantId });
    rollupExecutionsTotal.inc({ tenant_id: tenantId, status });
    rollupExecutionDurationSeconds.observe({ tenant_id: tenantId, status }, durationSeconds);
    rollupNodesPerExecution.observe({ tenant_id: tenantId }, nodeCount);
  },

  /**
   * Record execution failed
   */
  recordExecutionFailed(
    tenantId: string,
    errorCode: string,
    phase: ExecutionPhase,
    durationSeconds?: number
  ): void {
    rollupActiveExecutions.dec({ tenant_id: tenantId });
    rollupExecutionsTotal.inc({ tenant_id: tenantId, status: 'failed' });
    rollupErrorsTotal.inc({ tenant_id: tenantId, error_code: errorCode, phase });

    if (durationSeconds !== undefined) {
      rollupExecutionDurationSeconds.observe({ tenant_id: tenantId, status: 'failed' }, durationSeconds);
    }
  },

  /**
   * Record phase duration
   */
  recordPhaseDuration(tenantId: string, phase: ExecutionPhase, durationSeconds: number): void {
    rollupPhaseDurationSeconds.observe({ tenant_id: tenantId, phase }, durationSeconds);
  },

  // ===== Matching Metrics =====

  /**
   * Record matcher results
   */
  recordMatcherResults(
    tenantId: string,
    strategy: MatchingStrategy,
    matchCount: number,
    durationSeconds: number
  ): void {
    rollupMatchesFoundTotal.inc({ tenant_id: tenantId, strategy }, matchCount);
    rollupMatchesPerExecution.observe({ tenant_id: tenantId, strategy }, matchCount);
    rollupMatcherDurationSeconds.observe({ tenant_id: tenantId, strategy }, durationSeconds);
  },

  /**
   * Record match confidence
   */
  recordMatchConfidence(tenantId: string, strategy: MatchingStrategy, confidence: number): void {
    rollupMatchConfidence.observe({ tenant_id: tenantId, strategy }, confidence);
  },

  // ===== Merge Metrics =====

  /**
   * Record merge results
   */
  recordMergeResults(
    tenantId: string,
    mergedNodeCount: number,
    crossRepoEdges: number,
    durationSeconds: number
  ): void {
    rollupMergeDurationSeconds.observe({ tenant_id: tenantId }, durationSeconds);
    rollupCrossRepoEdgesTotal.inc({ tenant_id: tenantId }, crossRepoEdges);
  },

  /**
   * Record merge conflict
   */
  recordMergeConflict(tenantId: string, conflictType: string, resolution: string): void {
    rollupMergeConflictsTotal.inc({ tenant_id: tenantId, conflict_type: conflictType, resolution });
  },

  // ===== Node Processing Metrics =====

  /**
   * Record nodes processed
   */
  recordNodesProcessed(tenantId: string, operation: string, count: number): void {
    rollupNodesProcessedTotal.inc({ tenant_id: tenantId, operation }, count);
  },

  // ===== Blast Radius Metrics =====

  /**
   * Record blast radius analysis
   */
  recordBlastRadiusAnalysis(tenantId: string, durationSeconds: number): void {
    rollupBlastRadiusDurationSeconds.observe({ tenant_id: tenantId }, durationSeconds);
  },

  // ===== CRUD Operation Metrics =====

  /**
   * Record CRUD operation
   */
  recordOperation(
    tenantId: string,
    operation: 'create' | 'read' | 'update' | 'delete' | 'list',
    status: 'success' | 'failure'
  ): void {
    rollupOperationsTotal.inc({ tenant_id: tenantId, operation, status });
  },

  // ===== Configuration Metrics =====

  /**
   * Set active configuration count
   */
  setActiveConfigurations(tenantId: string, status: string, count: number): void {
    rollupActiveConfigurations.set({ tenant_id: tenantId, status }, count);
  },

  /**
   * Record repository count for rollup
   */
  recordRepositoryCount(tenantId: string, count: number): void {
    rollupRepositoryCount.observe({ tenant_id: tenantId }, count);
  },

  /**
   * Set last execution timestamp
   */
  setLastExecutionTimestamp(tenantId: string, rollupId: string): void {
    rollupLastExecutionTimestamp.set(
      { tenant_id: tenantId, rollup_id: rollupId },
      Date.now() / 1000
    );
  },

  // ===== Cache Metrics =====

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string): void {
    // This would integrate with the cache hit ratio calculation
    // Implementation depends on how hits/misses are tracked
  },

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string): void {
    // This would integrate with the cache hit ratio calculation
  },

  /**
   * Set cache size
   */
  setCacheSize(cacheType: string, size: number): void {
    rollupCacheSize.set({ cache_type: cacheType }, size);
  },

  /**
   * Set cache hit ratio
   */
  setCacheHitRatio(cacheType: string, ratio: number): void {
    rollupCacheHitRatio.set({ cache_type: cacheType }, ratio);
  },

  // ===== Error Metrics =====

  /**
   * Record error
   */
  recordError(tenantId: string, errorCode: string, phase: ExecutionPhase): void {
    rollupErrorsTotal.inc({ tenant_id: tenantId, error_code: errorCode, phase });
  },
};

// ============================================================================
// Metrics Collector Class
// ============================================================================

/**
 * Rollup metrics collector for managing metric state
 */
export class RollupMetricsCollector {
  private executionStartTimes: Map<string, number> = new Map();
  private phaseStartTimes: Map<string, Map<string, number>> = new Map();
  private cacheStats: Map<string, { hits: number; misses: number }> = new Map();

  /**
   * Start tracking an execution
   */
  startExecution(executionId: string, tenantId: string): void {
    this.executionStartTimes.set(executionId, Date.now());
    this.phaseStartTimes.set(executionId, new Map());
    rollupMetrics.recordExecutionStarted(tenantId);
  }

  /**
   * Start tracking a phase
   */
  startPhase(executionId: string, phase: ExecutionPhase): void {
    const phases = this.phaseStartTimes.get(executionId);
    if (phases) {
      phases.set(phase, Date.now());
    }
  }

  /**
   * End a phase and record metrics
   */
  endPhase(executionId: string, tenantId: string, phase: ExecutionPhase): number {
    const phases = this.phaseStartTimes.get(executionId);
    const startTime = phases?.get(phase);

    if (startTime) {
      const durationMs = Date.now() - startTime;
      rollupMetrics.recordPhaseDuration(tenantId, phase, durationMs / 1000);
      phases?.delete(phase);
      return durationMs;
    }

    return 0;
  }

  /**
   * End tracking an execution
   */
  endExecution(
    executionId: string,
    tenantId: string,
    nodeCount: number,
    status: ExecutionStatus = 'completed'
  ): number {
    const startTime = this.executionStartTimes.get(executionId);
    const durationMs = startTime ? Date.now() - startTime : 0;

    rollupMetrics.recordExecutionCompleted(tenantId, durationMs / 1000, nodeCount, status);

    // Cleanup
    this.executionStartTimes.delete(executionId);
    this.phaseStartTimes.delete(executionId);

    return durationMs;
  }

  /**
   * Record a cache access
   */
  recordCacheAccess(cacheType: string, hit: boolean): void {
    if (!this.cacheStats.has(cacheType)) {
      this.cacheStats.set(cacheType, { hits: 0, misses: 0 });
    }

    const stats = this.cacheStats.get(cacheType)!;
    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }

    // Update ratio
    const total = stats.hits + stats.misses;
    if (total > 0) {
      rollupMetrics.setCacheHitRatio(cacheType, stats.hits / total);
    }
  }

  /**
   * Get execution duration so far
   */
  getExecutionDuration(executionId: string): number {
    const startTime = this.executionStartTimes.get(executionId);
    return startTime ? Date.now() - startTime : 0;
  }

  /**
   * Get phase duration so far
   */
  getPhaseDuration(executionId: string, phase: ExecutionPhase): number {
    const phases = this.phaseStartTimes.get(executionId);
    const startTime = phases?.get(phase);
    return startTime ? Date.now() - startTime : 0;
  }

  /**
   * Reset all tracking state (for testing)
   */
  reset(): void {
    this.executionStartTimes.clear();
    this.phaseStartTimes.clear();
    this.cacheStats.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let metricsCollectorInstance: RollupMetricsCollector | null = null;

/**
 * Get the singleton metrics collector
 */
export function getRollupMetricsCollector(): RollupMetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new RollupMetricsCollector();
  }
  return metricsCollectorInstance;
}

/**
 * Reset the metrics collector (for testing)
 */
export function resetRollupMetricsCollector(): void {
  metricsCollectorInstance?.reset();
  metricsCollectorInstance = null;
}

// ============================================================================
// Export All Metrics for Prometheus Scraping
// ============================================================================

export const allRollupMetrics = {
  // Counters
  rollupExecutionsTotal,
  rollupNodesProcessedTotal,
  rollupMatchesFoundTotal,
  rollupErrorsTotal,
  rollupOperationsTotal,
  rollupCrossRepoEdgesTotal,
  rollupMergeConflictsTotal,

  // Histograms
  rollupExecutionDurationSeconds,
  rollupPhaseDurationSeconds,
  rollupNodesPerExecution,
  rollupMatchesPerExecution,
  rollupMatcherDurationSeconds,
  rollupMergeDurationSeconds,
  rollupBlastRadiusDurationSeconds,
  rollupRepositoryCount,

  // Gauges
  rollupActiveExecutions,
  rollupCacheSize,
  rollupCacheHitRatio,
  rollupActiveConfigurations,
  rollupLastExecutionTimestamp,

  // Summary
  rollupMatchConfidence,
};
