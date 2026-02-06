/**
 * Regression Test Module Index
 * @module services/rollup/__tests__/regression
 *
 * Exports regression testing utilities and baselines for the Rollup service.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation regression testing
 */

// ============================================================================
// Performance Baselines
// ============================================================================

/**
 * Performance baseline metrics for regression detection.
 * Values represent acceptable performance levels.
 */
export const PERFORMANCE_BASELINES = {
  // Matcher operations
  matcherExtraction: {
    baseline: 50, // ms for 1000 nodes
    tolerance: 0.20, // 20% tolerance
    unit: 'ms' as const,
  },
  matcherComparison: {
    baseline: 100, // ms for 10000 comparisons
    tolerance: 0.20,
    unit: 'ms' as const,
  },

  // Merge operations
  mergeSmall: {
    baseline: 20,
    tolerance: 0.25,
    unit: 'ms' as const,
  },
  mergeMedium: {
    baseline: 100,
    tolerance: 0.25,
    unit: 'ms' as const,
  },
  mergeLarge: {
    baseline: 500,
    tolerance: 0.30,
    unit: 'ms' as const,
  },

  // Full execution
  executionSmall: {
    baseline: 100,
    tolerance: 0.25,
    unit: 'ms' as const,
  },
  executionMedium: {
    baseline: 500,
    tolerance: 0.25,
    unit: 'ms' as const,
  },
  executionLarge: {
    baseline: 2000,
    tolerance: 0.30,
    unit: 'ms' as const,
  },

  // Memory thresholds
  memorySmall: {
    baseline: 10 * 1024 * 1024,
    tolerance: 0.50,
    unit: 'bytes' as const,
  },
  memoryMedium: {
    baseline: 50 * 1024 * 1024,
    tolerance: 0.50,
    unit: 'bytes' as const,
  },
  memoryLarge: {
    baseline: 200 * 1024 * 1024,
    tolerance: 0.50,
    unit: 'bytes' as const,
  },

  // Throughput
  nodesPerSecond: {
    baseline: 10000,
    tolerance: 0.20,
    unit: 'nodes/sec' as const,
  },
  matchesPerSecond: {
    baseline: 50000,
    tolerance: 0.20,
    unit: 'comparisons/sec' as const,
  },
} as const;

export type PerformanceBaseline = typeof PERFORMANCE_BASELINES;
export type PerformanceMetricKey = keyof PerformanceBaseline;

// ============================================================================
// API Contract Baselines
// ============================================================================

/**
 * Expected API response structure for regression detection.
 */
export const API_RESPONSE_BASELINES = {
  rollupConfig: {
    requiredFields: [
      'id', 'tenantId', 'name', 'status', 'repositoryIds',
      'matchers', 'mergeOptions', 'version', 'createdBy',
      'createdAt', 'updatedAt',
    ],
    optionalFields: [
      'description', 'scanIds', 'includeNodeTypes', 'excludeNodeTypes',
      'preserveEdgeTypes', 'schedule', 'updatedBy', 'lastExecutedAt',
    ],
  },
  executionResult: {
    requiredFields: [
      'id', 'rollupId', 'tenantId', 'status', 'scanIds', 'createdAt',
    ],
    optionalFields: [
      'stats', 'matches', 'mergedNodes', 'errorMessage',
      'errorDetails', 'startedAt', 'completedAt',
    ],
  },
  matchResult: {
    requiredFields: [
      'sourceNodeId', 'targetNodeId', 'sourceRepoId', 'targetRepoId',
      'strategy', 'confidence', 'details',
    ],
  },
  mergedNode: {
    requiredFields: [
      'id', 'sourceNodeIds', 'sourceRepoIds', 'type',
      'name', 'locations', 'metadata', 'matchInfo',
    ],
  },
  blastRadiusResponse: {
    requiredFields: [
      'query', 'rollupId', 'executionId', 'directImpact',
      'indirectImpact', 'crossRepoImpact', 'summary',
    ],
  },
} as const;

export type ApiResponseBaseline = typeof API_RESPONSE_BASELINES;

// ============================================================================
// Interface Signatures
// ============================================================================

/**
 * Expected interface method signatures for regression detection.
 */
export const INTERFACE_SIGNATURES = {
  IRollupService: {
    methods: [
      'createRollup',
      'getRollup',
      'listRollups',
      'updateRollup',
      'deleteRollup',
      'validateConfiguration',
      'executeRollup',
      'getExecutionResult',
      'getBlastRadius',
    ],
  },
  IRollupRepository: {
    methods: [
      'create',
      'findById',
      'findMany',
      'update',
      'delete',
      'updateStatus',
      'createExecution',
      'findExecutionById',
      'findLatestExecution',
      'updateExecution',
      'listExecutions',
    ],
  },
  IMatcherFactory: {
    methods: ['createMatcher', 'createMatchers', 'getAvailableTypes'],
  },
  IMatcher: {
    methods: ['extractCandidates', 'compare', 'validateConfig', 'isEnabled', 'getPriority'],
    properties: ['strategy', 'config'],
  },
  IMergeEngine: {
    methods: ['merge', 'validateInput'],
  },
  IBlastRadiusEngine: {
    methods: ['analyze', 'getCached'],
  },
  IRollupEventEmitter: {
    methods: ['emit', 'on', 'off', 'removeAllListeners'],
  },
} as const;

export type InterfaceSignature = typeof INTERFACE_SIGNATURES;

// ============================================================================
// Regression Utilities
// ============================================================================

/**
 * Check if a value is within acceptable tolerance of baseline.
 */
export function isWithinTolerance(
  actual: number,
  baseline: number,
  tolerance: number,
  isLowerBetter: boolean = true
): { passed: boolean; deviation: number; message: string } {
  const deviation = ((actual - baseline) / baseline) * 100;
  const maxAllowedDeviation = tolerance * 100;

  const passed = isLowerBetter
    ? deviation <= maxAllowedDeviation
    : deviation >= -maxAllowedDeviation;

  const message = isLowerBetter
    ? `${actual.toFixed(2)} vs baseline ${baseline} (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%, max: +${maxAllowedDeviation}%)`
    : `${actual.toFixed(2)} vs baseline ${baseline} (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%, min: -${maxAllowedDeviation}%)`;

  return { passed, deviation, message };
}

/**
 * Classify regression severity based on deviation percentage.
 */
export function classifyRegressionSeverity(
  deviation: number
): 'critical' | 'major' | 'minor' | 'none' {
  const absDeviation = Math.abs(deviation);

  if (absDeviation > 50) return 'critical';
  if (absDeviation > 25) return 'major';
  if (absDeviation > 10) return 'minor';
  return 'none';
}

/**
 * Generate regression report summary.
 */
export interface RegressionReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  regressions: Array<{
    name: string;
    severity: 'critical' | 'major' | 'minor';
    deviation: number;
    baseline: number;
    actual: number;
  }>;
  improvements: Array<{
    name: string;
    improvement: number;
    baseline: number;
    actual: number;
  }>;
}

export function generateRegressionReport(
  results: Array<{
    name: string;
    baseline: number;
    actual: number;
    tolerance: number;
  }>
): RegressionReport {
  const report: RegressionReport = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: 0,
    failed: 0,
    regressions: [],
    improvements: [],
  };

  for (const result of results) {
    const check = isWithinTolerance(result.actual, result.baseline, result.tolerance);

    if (check.passed) {
      report.passed++;

      // Check for improvements (>10% better)
      if (check.deviation < -10) {
        report.improvements.push({
          name: result.name,
          improvement: Math.abs(check.deviation),
          baseline: result.baseline,
          actual: result.actual,
        });
      }
    } else {
      report.failed++;
      report.regressions.push({
        name: result.name,
        severity: classifyRegressionSeverity(check.deviation),
        deviation: check.deviation,
        baseline: result.baseline,
        actual: result.actual,
      });
    }
  }

  return report;
}
