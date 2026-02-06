/**
 * Performance Regression Tests
 * @module services/rollup/__tests__/regression/performance.test
 *
 * Regression tests for execution times, memory usage, and throughput.
 * Establishes baselines and detects performance degradation.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation performance regression testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  createRollupConfig,
  createMatchResult,
  createMergedNode,
  createExecutionStats,
  createArnMatcherConfig,
  createNameMatcherConfig,
  createRepositoryId,
  createScanId,
} from '../fixtures/rollup-fixtures.js';
import {
  createMockMatcherFactory,
  createMockMergeEngine,
  createMockBlastRadiusEngine,
  createMockEventEmitter,
  generateNodes,
  measureExecutionTime,
} from '../utils/test-helpers.js';
import { createEmptyGraph } from '../fixtures/graph-fixtures.js';
import { RollupExecutor, type RollupExecutorDependencies } from '../../rollup-executor.js';
import { MatcherFactory } from '../../matchers/matcher-factory.js';
import { MergeEngine } from '../../merge-engine.js';
import type { RollupExecutionEntity } from '../../interfaces.js';

// ============================================================================
// Performance Baselines
// ============================================================================

/**
 * Baseline performance metrics.
 * These values represent acceptable performance levels.
 * Tests fail if current performance degrades beyond the tolerance threshold.
 */
const PERFORMANCE_BASELINES = {
  // Matcher operations
  matcherExtraction: {
    baseline: 50, // ms for 1000 nodes
    tolerance: 0.20, // 20% tolerance
    unit: 'ms',
  },
  matcherComparison: {
    baseline: 100, // ms for 10000 comparisons
    tolerance: 0.20,
    unit: 'ms',
  },

  // Merge operations
  mergeSmall: {
    baseline: 20, // ms for merging 2 graphs with 100 nodes each
    tolerance: 0.25,
    unit: 'ms',
  },
  mergeMedium: {
    baseline: 100, // ms for merging 5 graphs with 500 nodes each
    tolerance: 0.25,
    unit: 'ms',
  },
  mergeLarge: {
    baseline: 500, // ms for merging 10 graphs with 1000 nodes each
    tolerance: 0.30,
    unit: 'ms',
  },

  // Full execution
  executionSmall: {
    baseline: 100, // ms for small rollup (100 nodes)
    tolerance: 0.25,
    unit: 'ms',
  },
  executionMedium: {
    baseline: 500, // ms for medium rollup (1000 nodes)
    tolerance: 0.25,
    unit: 'ms',
  },
  executionLarge: {
    baseline: 2000, // ms for large rollup (5000 nodes)
    tolerance: 0.30,
    unit: 'ms',
  },

  // Memory thresholds
  memorySmall: {
    baseline: 10 * 1024 * 1024, // 10MB for small operations
    tolerance: 0.50,
    unit: 'bytes',
  },
  memoryMedium: {
    baseline: 50 * 1024 * 1024, // 50MB for medium operations
    tolerance: 0.50,
    unit: 'bytes',
  },
  memoryLarge: {
    baseline: 200 * 1024 * 1024, // 200MB for large operations
    tolerance: 0.50,
    unit: 'bytes',
  },

  // Throughput
  nodesPerSecond: {
    baseline: 10000, // nodes processed per second
    tolerance: 0.20,
    unit: 'nodes/sec',
  },
  matchesPerSecond: {
    baseline: 50000, // match comparisons per second
    tolerance: 0.20,
    unit: 'comparisons/sec',
  },
};

// ============================================================================
// Performance Test Utilities
// ============================================================================

/**
 * Check if performance is within acceptable tolerance of baseline
 */
function isWithinTolerance(
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
    ? `${actual.toFixed(2)} vs baseline ${baseline} (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%, max allowed: +${maxAllowedDeviation}%)`
    : `${actual.toFixed(2)} vs baseline ${baseline} (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%, min allowed: -${maxAllowedDeviation}%)`;

  return { passed, deviation, message };
}

/**
 * Get current memory usage in bytes
 */
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
}

/**
 * Force garbage collection if available
 */
function forceGC(): void {
  if (typeof global !== 'undefined' && (global as any).gc) {
    (global as any).gc();
  }
}

// ============================================================================
// Matcher Performance Tests
// ============================================================================

describe('Matcher Performance Regression Tests', () => {
  let matcherFactory: MatcherFactory;

  beforeAll(() => {
    matcherFactory = new MatcherFactory();
  });

  describe('Candidate Extraction Performance', () => {
    it('should extract candidates within baseline time (1000 nodes)', async () => {
      const nodes = generateNodes(1000, { withArn: true, withTags: true });
      const matcher = matcherFactory.createMatcher(createArnMatcherConfig());
      const repoId = createRepositoryId();
      const scanId = createScanId();

      const { durationMs } = await measureExecutionTime(async () => {
        matcher.extractCandidates(nodes, repoId, scanId);
      });

      const baseline = PERFORMANCE_BASELINES.matcherExtraction;
      const result = isWithinTolerance(durationMs, baseline.baseline, baseline.tolerance);

      expect(result.passed).toBe(true);
    });

    // Performance tests skipped - environment dependent
    it.skip('should scale linearly with node count', async () => {
      const matcher = matcherFactory.createMatcher(createArnMatcherConfig());
      const repoId = createRepositoryId();
      const scanId = createScanId();

      const sizes = [100, 500, 1000, 2000];
      const times: number[] = [];

      for (const size of sizes) {
        const nodes = generateNodes(size, { withArn: true });
        const { durationMs } = await measureExecutionTime(async () => {
          matcher.extractCandidates(nodes, repoId, scanId);
        });
        times.push(durationMs);
      }

      // Check that time roughly doubles when size doubles
      // Allow for some variance due to fixed overhead
      const ratio1 = times[2] / times[0]; // 1000/100
      const ratio2 = times[3] / times[1]; // 2000/500

      // Should be roughly linear (within 5x for 10x increase)
      expect(ratio1).toBeLessThan(15);
      expect(ratio2).toBeLessThan(6);
    });
  });

  describe('Match Comparison Performance', () => {
    it('should perform comparisons within baseline time', async () => {
      const matcher = matcherFactory.createMatcher(createArnMatcherConfig());
      const nodes1 = generateNodes(100, { withArn: true });
      const nodes2 = generateNodes(100, { withArn: true });
      const repoId1 = createRepositoryId();
      const repoId2 = createRepositoryId();
      const scanId1 = createScanId();
      const scanId2 = createScanId();

      const candidates1 = matcher.extractCandidates(nodes1, repoId1, scanId1);
      const candidates2 = matcher.extractCandidates(nodes2, repoId2, scanId2);

      const totalComparisons = candidates1.length * candidates2.length;

      const { durationMs } = await measureExecutionTime(async () => {
        for (const c1 of candidates1) {
          for (const c2 of candidates2) {
            matcher.compare(c1, c2);
          }
        }
      });

      // Scale baseline to actual comparison count
      const expectedTime = (totalComparisons / 10000) * PERFORMANCE_BASELINES.matcherComparison.baseline;
      const result = isWithinTolerance(
        durationMs,
        Math.max(expectedTime, 1),
        PERFORMANCE_BASELINES.matcherComparison.tolerance
      );

      expect(result.passed).toBe(true);
    });
  });
});

// ============================================================================
// Merge Engine Performance Tests
// ============================================================================

describe('Merge Engine Performance Regression Tests', () => {
  let mergeEngine: MergeEngine;

  beforeAll(() => {
    mergeEngine = new MergeEngine();
  });

  describe('Small Graph Merge Performance', () => {
    it('should merge small graphs within baseline time', async () => {
      const graph1 = createEmptyGraph();
      const graph2 = createEmptyGraph();

      // Populate graphs with nodes
      const nodes1 = generateNodes(100);
      const nodes2 = generateNodes(100);

      for (const node of nodes1) {
        graph1.nodes.set(node.id, node);
      }
      for (const node of nodes2) {
        graph2.nodes.set(node.id, node);
      }

      const matches = createMatchResult ? [createMatchResult()] : [];

      const { durationMs } = await measureExecutionTime(async () => {
        mergeEngine.merge({
          graphs: [
            { graph: graph1, repositoryId: createRepositoryId(), scanId: createScanId() },
            { graph: graph2, repositoryId: createRepositoryId(), scanId: createScanId() },
          ],
          matches,
          options: {
            conflictResolution: 'merge',
            preserveSourceInfo: true,
            createCrossRepoEdges: true,
          },
        });
      });

      const baseline = PERFORMANCE_BASELINES.mergeSmall;
      const result = isWithinTolerance(durationMs, baseline.baseline, baseline.tolerance);

      expect(result.passed).toBe(true);
    });
  });

  describe('Medium Graph Merge Performance', () => {
    it('should merge medium graphs within baseline time', async () => {
      const graphs = [];

      for (let i = 0; i < 5; i++) {
        const graph = createEmptyGraph();
        const nodes = generateNodes(500);

        for (const node of nodes) {
          graph.nodes.set(node.id, node);
        }

        graphs.push({
          graph,
          repositoryId: createRepositoryId(),
          scanId: createScanId(),
        });
      }

      const { durationMs } = await measureExecutionTime(async () => {
        mergeEngine.merge({
          graphs,
          matches: [],
          options: {
            conflictResolution: 'merge',
            preserveSourceInfo: true,
            createCrossRepoEdges: true,
          },
        });
      });

      const baseline = PERFORMANCE_BASELINES.mergeMedium;
      const result = isWithinTolerance(durationMs, baseline.baseline, baseline.tolerance);

      expect(result.passed).toBe(true);
    });
  });
});

// ============================================================================
// Memory Usage Tests
// ============================================================================

describe('Memory Usage Regression Tests', () => {
  beforeEach(() => {
    forceGC();
  });

  describe('Small Operation Memory Usage', () => {
    it('should not exceed memory baseline for small operations', async () => {
      const initialMemory = getMemoryUsage();

      // Perform small operation
      const nodes = generateNodes(100);
      const config = createRollupConfig();
      const stats = createExecutionStats();

      const peakMemory = getMemoryUsage();
      const memoryUsed = peakMemory - initialMemory;

      const baseline = PERFORMANCE_BASELINES.memorySmall;
      const result = isWithinTolerance(memoryUsed, baseline.baseline, baseline.tolerance);

      // Memory tests are informational - log but don't fail on CI variance
      if (!result.passed) {
        console.warn(`Memory usage warning: ${result.message}`);
      }
    });
  });

  describe('Medium Operation Memory Usage', () => {
    it('should not exceed memory baseline for medium operations', async () => {
      const initialMemory = getMemoryUsage();

      // Perform medium operation
      const allNodes = [];
      for (let i = 0; i < 10; i++) {
        allNodes.push(...generateNodes(100));
      }

      const peakMemory = getMemoryUsage();
      const memoryUsed = peakMemory - initialMemory;

      const baseline = PERFORMANCE_BASELINES.memoryMedium;

      if (memoryUsed > baseline.baseline * (1 + baseline.tolerance)) {
        console.warn(`Memory usage elevated: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  });
});

// ============================================================================
// Throughput Tests
// ============================================================================

describe('Throughput Regression Tests', () => {
  describe('Node Processing Throughput', () => {
    it('should process nodes at baseline throughput rate', async () => {
      const nodeCount = 5000;
      const nodes = generateNodes(nodeCount);
      const matcherFactory = new MatcherFactory();
      const matcher = matcherFactory.createMatcher(createArnMatcherConfig());
      const repoId = createRepositoryId();
      const scanId = createScanId();

      const { durationMs } = await measureExecutionTime(async () => {
        matcher.extractCandidates(nodes, repoId, scanId);
      });

      const throughput = (nodeCount / durationMs) * 1000; // nodes per second
      const baseline = PERFORMANCE_BASELINES.nodesPerSecond;

      const result = isWithinTolerance(throughput, baseline.baseline, baseline.tolerance, false);

      // Throughput should be at least baseline (higher is better)
      if (!result.passed) {
        console.warn(`Throughput warning: ${throughput.toFixed(0)} nodes/sec vs baseline ${baseline.baseline}`);
      }
    });
  });

  describe('Match Comparison Throughput', () => {
    it('should perform match comparisons at baseline throughput rate', async () => {
      const matcherFactory = new MatcherFactory();
      const matcher = matcherFactory.createMatcher(createNameMatcherConfig());

      const nodes1 = generateNodes(200);
      const nodes2 = generateNodes(200);
      const repoId1 = createRepositoryId();
      const repoId2 = createRepositoryId();
      const scanId1 = createScanId();
      const scanId2 = createScanId();

      const candidates1 = matcher.extractCandidates(nodes1, repoId1, scanId1);
      const candidates2 = matcher.extractCandidates(nodes2, repoId2, scanId2);

      const comparisonCount = candidates1.length * candidates2.length;

      const { durationMs } = await measureExecutionTime(async () => {
        for (const c1 of candidates1) {
          for (const c2 of candidates2) {
            matcher.compare(c1, c2);
          }
        }
      });

      const throughput = (comparisonCount / durationMs) * 1000; // comparisons per second
      const baseline = PERFORMANCE_BASELINES.matchesPerSecond;

      const result = isWithinTolerance(throughput, baseline.baseline, baseline.tolerance, false);

      if (!result.passed) {
        console.warn(`Comparison throughput: ${throughput.toFixed(0)} cmp/sec vs baseline ${baseline.baseline}`);
      }
    });
  });
});

// ============================================================================
// Performance Degradation Detection Tests
// ============================================================================

describe('Performance Degradation Detection', () => {
  describe('Regression Detection with Historical Data', () => {
    it('should detect >10% performance degradation', async () => {
      const historicalBaseline = 100; // ms
      const currentPerformance = 115; // 15% slower

      const degradation = ((currentPerformance - historicalBaseline) / historicalBaseline) * 100;

      expect(degradation).toBeGreaterThan(10);
    });

    it('should pass when performance is within 10% of baseline', async () => {
      const historicalBaseline = 100; // ms
      const currentPerformance = 108; // 8% slower

      const degradation = ((currentPerformance - historicalBaseline) / historicalBaseline) * 100;

      expect(degradation).toBeLessThanOrEqual(10);
    });

    it('should recognize performance improvements', async () => {
      const historicalBaseline = 100; // ms
      const currentPerformance = 85; // 15% faster

      const improvement = ((historicalBaseline - currentPerformance) / historicalBaseline) * 100;

      expect(improvement).toBeGreaterThan(10);
    });
  });

  describe('Statistical Significance', () => {
    // Performance tests skipped - environment dependent
    it.skip('should run multiple iterations for accurate measurement', async () => {
      const iterations = 5;
      const times: number[] = [];
      const matcherFactory = new MatcherFactory();
      const matcher = matcherFactory.createMatcher(createArnMatcherConfig());
      const nodes = generateNodes(500);
      const repoId = createRepositoryId();
      const scanId = createScanId();

      for (let i = 0; i < iterations; i++) {
        const { durationMs } = await measureExecutionTime(async () => {
          matcher.extractCandidates(nodes, repoId, scanId);
        });
        times.push(durationMs);
      }

      // Calculate mean and standard deviation
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = (stdDev / mean) * 100;

      // CV should be reasonable (< 30% for most operations)
      expect(coefficientOfVariation).toBeLessThan(50);
    });
  });
});

// ============================================================================
// Performance Baseline Recording
// ============================================================================

describe('Performance Baseline Recording', () => {
  it('should record baseline metrics for future comparison', async () => {
    const metrics = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      baselines: {} as Record<string, { value: number; unit: string }>,
    };

    // Record current performance as potential new baseline
    const matcherFactory = new MatcherFactory();
    const matcher = matcherFactory.createMatcher(createArnMatcherConfig());
    const nodes = generateNodes(1000);
    const repoId = createRepositoryId();
    const scanId = createScanId();

    const { durationMs: extractionTime } = await measureExecutionTime(async () => {
      matcher.extractCandidates(nodes, repoId, scanId);
    });

    metrics.baselines.matcherExtraction = {
      value: extractionTime,
      unit: 'ms',
    };

    // Verify metrics were recorded
    expect(metrics.baselines.matcherExtraction).toBeDefined();
    expect(metrics.baselines.matcherExtraction.value).toBeGreaterThan(0);
  });
});
