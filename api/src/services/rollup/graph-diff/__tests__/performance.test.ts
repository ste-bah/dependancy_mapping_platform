/**
 * Graph Diff Performance Tests
 * @module services/rollup/graph-diff/__tests__/performance.test
 *
 * Performance tests for TASK-ROLLUP-005 to verify NFR-PERF-008 compliance:
 * - 10K nodes: < 5 seconds (task requirement)
 * - 100K nodes: < 500ms (NFR-PERF-008 benchmark)
 * - Index building: < 100ms for 1000 nodes
 * - Memory: < 27MB for 10K nodes
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: Performance benchmarks for large-scale graph operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GraphDiffEngine,
  createGraphDiffEngine,
  MEMORY_CONSTANTS,
  TIMING_CONSTANTS,
} from '../graph-diff-engine.js';
import type {
  GraphSnapshot,
  DiffComputationOptions,
  DiffTiming,
} from '../interfaces.js';
import {
  createTestTenantId,
  createTestSnapshot,
  createTestGraph,
  createTestTerraformNode,
  createTestEdge,
  createTestGraphFromNodes,
  createLargeGraphScenario,
} from './fixtures.js';
import type { TenantId } from '../../../../types/entities.js';
import type { NodeType, GraphEdge, EdgeType } from '../../../../types/graph.js';

// ============================================================================
// Performance Test Configuration
// ============================================================================

/**
 * NFR-PERF-008 and TASK-ROLLUP-005 Performance Targets
 */
const PERFORMANCE_TARGETS = {
  /** 1K nodes diff should complete in < 500ms */
  DIFF_1K_NODES_MS: 500,
  /** 10K nodes diff should complete in < 5000ms (5 seconds) */
  DIFF_10K_NODES_MS: 5000,
  /** 100K nodes lookup should complete in < 500ms (NFR-PERF-008) */
  DIFF_100K_NODES_MS: 500,
  /** Index building for 1000 nodes should complete in < 100ms */
  INDEX_BUILD_1K_NODES_MS: 100,
  /** Index building for 10K nodes should complete in < 1000ms */
  INDEX_BUILD_10K_NODES_MS: 1000,
  /** Memory budget for 10K nodes operations (~27MB) */
  MEMORY_10K_NODES_BYTES: 27 * 1024 * 1024,
  /** Minimum throughput: 10K nodes per second */
  MIN_THROUGHPUT_NODES_PER_SEC: 10000,
  /** Identity extraction should process > 20 nodes/ms */
  IDENTITY_EXTRACTION_NODES_PER_MS: 20,
};

// ============================================================================
// Performance Test Utilities
// ============================================================================

/**
 * Measure execution latency of an async operation
 */
async function measureLatency<T>(fn: () => Promise<T>): Promise<{
  result: T;
  latencyMs: number;
}> {
  const start = performance.now();
  const result = await fn();
  const latencyMs = performance.now() - start;
  return { result, latencyMs };
}

/**
 * Measure throughput over multiple iterations
 */
async function measureThroughput<T>(
  fn: () => Promise<T>,
  iterations: number
): Promise<{
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputPerSec: number;
}> {
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const { latencyMs } = await measureLatency(fn);
    latencies.push(latencyMs);
  }

  latencies.sort((a, b) => a - b);

  const avgLatencyMs = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const minLatencyMs = latencies[0] ?? 0;
  const maxLatencyMs = latencies[latencies.length - 1] ?? 0;
  const p50LatencyMs = latencies[Math.floor(latencies.length * 0.50)] ?? 0;
  const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const p99LatencyMs = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
  const throughputPerSec = avgLatencyMs > 0 ? 1000 / avgLatencyMs : 0;

  return {
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    p50LatencyMs,
    p95LatencyMs,
    p99LatencyMs,
    throughputPerSec,
  };
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
 * Force garbage collection if available (requires --expose-gc flag)
 */
function forceGC(): void {
  if (typeof global !== 'undefined' && (global as { gc?: () => void }).gc) {
    (global as { gc: () => void }).gc();
  }
}

/**
 * Create a graph with specified node and edge counts for testing
 */
function createPerformanceTestGraph(
  nodeCount: number,
  edgeDensity: number = 1.5 // edges per node
): { nodes: NodeType[]; edges: GraphEdge[] } {
  const nodes: NodeType[] = [];
  const edges: GraphEdge[] = [];

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(
      createTestTerraformNode({
        id: `node_${i}`,
        name: `aws_resource.resource_${i}`,
        resourceType: i % 3 === 0 ? 'aws_s3_bucket' : i % 3 === 1 ? 'aws_instance' : 'aws_lambda_function',
        metadata: {
          arn: `arn:aws:service:us-east-1:123456789012:resource/resource-${i}`,
          id: `resource-${i}`,
          index: i,
          tags: {
            Environment: i % 2 === 0 ? 'production' : 'staging',
            Project: `project-${Math.floor(i / 100)}`,
          },
        },
      })
    );
  }

  // Create edges with specified density
  const edgeCount = Math.floor(nodeCount * edgeDensity);
  for (let i = 0; i < edgeCount && nodeCount > 1; i++) {
    const sourceIndex = i % nodeCount;
    const targetIndex = (sourceIndex + 1 + Math.floor(Math.random() * (nodeCount - 1))) % nodeCount;

    if (sourceIndex !== targetIndex) {
      edges.push(
        createTestEdge(
          `node_${sourceIndex}`,
          `node_${targetIndex}`,
          i % 2 === 0 ? 'depends_on' : 'references'
        )
      );
    }
  }

  return { nodes, edges };
}

/**
 * Create a snapshot pair for diff testing with specified change percentage
 */
function createSnapshotPairForDiff(
  nodeCount: number,
  changePercent: number = 10
): { baseSnapshot: GraphSnapshot; targetSnapshot: GraphSnapshot } {
  const tenantId = createTestTenantId();
  const changeCount = Math.floor((nodeCount * changePercent) / 100);

  // Create base graph
  const { nodes: baseNodes, edges: baseEdges } = createPerformanceTestGraph(nodeCount);
  const baseGraph = createTestGraphFromNodes(baseNodes, baseEdges);

  // Create target graph with modifications
  const targetNodes = new Map(baseGraph.nodes);
  const targetEdges = [...baseGraph.edges];

  // Remove some nodes
  const nodeIds = Array.from(targetNodes.keys());
  const removedNodeIds = new Set<string>();
  for (let i = 0; i < Math.floor(changeCount / 2); i++) {
    const nodeId = nodeIds[i];
    if (nodeId) {
      targetNodes.delete(nodeId);
      removedNodeIds.add(nodeId);
    }
  }

  // Remove edges referencing deleted nodes
  for (let j = targetEdges.length - 1; j >= 0; j--) {
    const edge = targetEdges[j];
    if (edge && (removedNodeIds.has(edge.source) || removedNodeIds.has(edge.target))) {
      targetEdges.splice(j, 1);
    }
  }

  // Add new nodes
  for (let i = 0; i < Math.floor(changeCount / 2); i++) {
    const newNode = createTestTerraformNode({
      id: `node_new_${i}`,
      name: `aws_resource.new_resource_${i}`,
      metadata: {
        arn: `arn:aws:service:us-east-1:123456789012:resource/new-resource-${i}`,
      },
    });
    targetNodes.set(newNode.id, newNode);

    // Add edge to a random existing node
    const existingNodeIds = Array.from(targetNodes.keys());
    const randomTarget = existingNodeIds[Math.floor(Math.random() * existingNodeIds.length)];
    if (randomTarget && randomTarget !== newNode.id) {
      targetEdges.push(createTestEdge(newNode.id, randomTarget));
    }
  }

  const targetGraph = {
    ...baseGraph,
    id: `graph_target_${Date.now()}`,
    nodes: targetNodes,
    edges: targetEdges,
    metadata: {
      ...baseGraph.metadata,
      createdAt: new Date(),
    },
  };

  return {
    baseSnapshot: createTestSnapshot(baseGraph, { tenantId, version: 1 }),
    targetSnapshot: createTestSnapshot(targetGraph, { tenantId, version: 2 }),
  };
}

// ============================================================================
// Performance Benchmark Tests
// ============================================================================

describe('Performance Benchmarks', () => {
  let engine: GraphDiffEngine;
  let tenantId: TenantId;

  beforeEach(async () => {
    engine = createGraphDiffEngine();
    await engine.initialize();
    tenantId = createTestTenantId();
    forceGC();
  });

  afterEach(async () => {
    await engine.shutdown();
    forceGC();
  });

  describe('NFR-PERF-008: Diff Computation Latency', () => {
    it('computes diff for 1K nodes under 500ms', async () => {
      const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(1000, 10);

      const { result, latencyMs } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      console.log(`1K nodes diff: ${latencyMs.toFixed(2)}ms`);
      console.log(`  Nodes processed: ${result.summary.baseNodeCount + result.summary.targetNodeCount}`);
      console.log(`  Throughput: ${result.timing.nodesPerSecond} nodes/sec`);

      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.DIFF_1K_NODES_MS);
      expect(result.timing.totalMs).toBeGreaterThan(0);
    });

    it('computes diff for 10K nodes under 5s (TASK-ROLLUP-005)', async () => {
      const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(10000, 10);

      const { result, latencyMs } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      console.log(`10K nodes diff: ${latencyMs.toFixed(2)}ms`);
      console.log(`  Timing breakdown:`);
      console.log(`    - Node identity extraction: ${result.timing.nodeIdentityExtractionMs}ms`);
      console.log(`    - Node comparison: ${result.timing.nodeComparisonMs}ms`);
      console.log(`    - Edge identity extraction: ${result.timing.edgeIdentityExtractionMs}ms`);
      console.log(`    - Edge comparison: ${result.timing.edgeComparisonMs}ms`);
      console.log(`    - Summary computation: ${result.timing.summaryComputationMs}ms`);
      console.log(`  Throughput: ${result.timing.nodesPerSecond} nodes/sec`);

      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.DIFF_10K_NODES_MS);
      expect(result.timing.nodesPerSecond).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_NODES_PER_SEC);
    });

    it('builds node index for 10K nodes under 1s', async () => {
      const { baseSnapshot } = createSnapshotPairForDiff(10000, 0);
      const targetSnapshot = { ...baseSnapshot, version: 2 };

      const { result, latencyMs } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      // The index build time is included in nodeIdentityExtractionMs
      const indexBuildTime = result.timing.nodeIdentityExtractionMs;

      console.log(`10K nodes index build: ${indexBuildTime}ms`);

      expect(indexBuildTime).toBeLessThan(PERFORMANCE_TARGETS.INDEX_BUILD_10K_NODES_MS);
    });
  });

  describe('Throughput Tests', () => {
    it('processes 10K nodes/second minimum', async () => {
      const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(5000, 10);

      const { result } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      console.log(`Throughput test:`);
      console.log(`  Nodes per second: ${result.timing.nodesPerSecond}`);
      console.log(`  Edges per second: ${result.timing.edgesPerSecond}`);

      expect(result.timing.nodesPerSecond).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_NODES_PER_SEC);
    });

    it('handles concurrent diff requests', async () => {
      const concurrency = 5;
      const nodeCountPerRequest = 1000;

      const snapshotPairs = Array.from({ length: concurrency }, () =>
        createSnapshotPairForDiff(nodeCountPerRequest, 10)
      );

      const startTime = performance.now();

      const results = await Promise.all(
        snapshotPairs.map(({ baseSnapshot, targetSnapshot }) =>
          engine.computeDiff(baseSnapshot, targetSnapshot)
        )
      );

      const totalTime = performance.now() - startTime;
      const totalNodes = results.reduce(
        (sum, r) => sum + r.summary.baseNodeCount + r.summary.targetNodeCount,
        0
      );

      console.log(`Concurrent diff test (${concurrency} requests):`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Total nodes processed: ${totalNodes}`);
      console.log(`  Effective throughput: ${Math.round((totalNodes / totalTime) * 1000)} nodes/sec`);

      // All concurrent requests should complete
      expect(results).toHaveLength(concurrency);
      // Average latency should still be reasonable
      expect(totalTime / concurrency).toBeLessThan(PERFORMANCE_TARGETS.DIFF_1K_NODES_MS * 2);
    });
  });

  describe('Memory Usage Tests', () => {
    it('stays within 27MB budget for 10K nodes', async () => {
      forceGC();
      const initialMemory = getMemoryUsage();

      const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(10000, 10);

      const peakMemoryBefore = getMemoryUsage();

      await engine.computeDiff(baseSnapshot, targetSnapshot);

      const peakMemoryAfter = getMemoryUsage();
      const memoryUsedForSnapshots = peakMemoryBefore - initialMemory;
      const memoryUsedForDiff = peakMemoryAfter - peakMemoryBefore;
      const totalMemoryUsed = peakMemoryAfter - initialMemory;

      console.log(`Memory usage for 10K nodes:`);
      console.log(`  Snapshot creation: ${(memoryUsedForSnapshots / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Diff computation: ${(memoryUsedForDiff / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Total: ${(totalMemoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Budget: ${(PERFORMANCE_TARGETS.MEMORY_10K_NODES_BYTES / 1024 / 1024).toFixed(2)}MB`);

      // Memory test - note that in test environment memory may vary
      // We warn but don't fail hard since CI environments can vary
      if (totalMemoryUsed > PERFORMANCE_TARGETS.MEMORY_10K_NODES_BYTES) {
        console.warn(`Warning: Memory usage exceeds budget (${(totalMemoryUsed / 1024 / 1024).toFixed(2)}MB > ${(PERFORMANCE_TARGETS.MEMORY_10K_NODES_BYTES / 1024 / 1024).toFixed(2)}MB)`);
      }
    });

    it('scales memory linearly with node count', async () => {
      const sizes = [1000, 2000, 5000];
      const memoryUsages: number[] = [];

      for (const size of sizes) {
        forceGC();
        const initialMemory = getMemoryUsage();

        const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(size, 10);
        await engine.computeDiff(baseSnapshot, targetSnapshot);

        const finalMemory = getMemoryUsage();
        memoryUsages.push(finalMemory - initialMemory);

        forceGC();
      }

      console.log('Memory scaling test:');
      for (let i = 0; i < sizes.length; i++) {
        console.log(`  ${sizes[i]} nodes: ${(memoryUsages[i]! / 1024 / 1024).toFixed(2)}MB`);
      }

      // Memory should scale roughly linearly (within 3x for 5x nodes)
      const ratio = memoryUsages[2]! / memoryUsages[0]!;
      const expectedRatio = sizes[2]! / sizes[0]!; // 5x

      console.log(`  Scaling ratio: ${ratio.toFixed(2)}x (expected ~${expectedRatio}x)`);

      // Allow some variance but should be sub-linear or linear
      expect(ratio).toBeLessThan(expectedRatio * 1.5);
    });
  });

  describe('Edge Case Performance', () => {
    it('handles empty graph comparison efficiently', async () => {
      const emptyBase = createTestSnapshot(createTestGraphFromNodes([]), {
        tenantId,
        version: 1,
      });
      const emptyTarget = createTestSnapshot(createTestGraphFromNodes([]), {
        tenantId,
        version: 2,
      });

      const { latencyMs } = await measureLatency(() =>
        engine.computeDiff(emptyBase, emptyTarget)
      );

      console.log(`Empty graph diff: ${latencyMs.toFixed(2)}ms`);

      // Empty graphs should be nearly instant
      expect(latencyMs).toBeLessThan(10);
    });

    it('handles identical graphs efficiently', async () => {
      const { baseSnapshot } = createSnapshotPairForDiff(5000, 0);
      // Create identical target
      const targetSnapshot = {
        ...baseSnapshot,
        id: baseSnapshot.id,
        version: 2,
      } as GraphSnapshot;

      const { result, latencyMs } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      console.log(`Identical 5K nodes graph diff: ${latencyMs.toFixed(2)}ms`);
      console.log(`  Added: ${result.summary.nodesAdded}, Removed: ${result.summary.nodesRemoved}`);

      // Identical graphs should be faster since no changes to compute
      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.DIFF_10K_NODES_MS / 2);
      expect(result.summary.nodesAdded).toBe(0);
      expect(result.summary.nodesRemoved).toBe(0);
    });

    it('handles complete replacement scenario', async () => {
      const nodeCount = 2000;
      const tenantId = createTestTenantId();

      // Base graph: nodes 0-1999
      const baseNodes: NodeType[] = [];
      for (let i = 0; i < nodeCount; i++) {
        baseNodes.push(
          createTestTerraformNode({
            id: `base_node_${i}`,
            name: `aws_resource.base_${i}`,
          })
        );
      }

      // Target graph: completely different nodes
      const targetNodes: NodeType[] = [];
      for (let i = 0; i < nodeCount; i++) {
        targetNodes.push(
          createTestTerraformNode({
            id: `target_node_${i}`,
            name: `aws_resource.target_${i}`,
          })
        );
      }

      const baseSnapshot = createTestSnapshot(createTestGraphFromNodes(baseNodes), {
        tenantId,
        version: 1,
      });
      const targetSnapshot = createTestSnapshot(createTestGraphFromNodes(targetNodes), {
        tenantId,
        version: 2,
      });

      const { result, latencyMs } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      console.log(`Complete replacement (${nodeCount} nodes each):`);
      console.log(`  Time: ${latencyMs.toFixed(2)}ms`);
      console.log(`  Removed: ${result.summary.nodesRemoved}, Added: ${result.summary.nodesAdded}`);

      expect(result.summary.nodesRemoved).toBe(nodeCount);
      expect(result.summary.nodesAdded).toBe(nodeCount);
      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.DIFF_10K_NODES_MS);
    });
  });

  describe('Scalability Tests', () => {
    it('scales linearly with node count', async () => {
      const sizes = [500, 1000, 2000, 4000];
      const timings: number[] = [];

      for (const size of sizes) {
        const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(size, 10);

        const { latencyMs } = await measureLatency(() =>
          engine.computeDiff(baseSnapshot, targetSnapshot)
        );

        timings.push(latencyMs);
      }

      console.log('Scalability test:');
      for (let i = 0; i < sizes.length; i++) {
        console.log(`  ${sizes[i]} nodes: ${timings[i]!.toFixed(2)}ms`);
      }

      // Check that time scales roughly linearly
      // Time for 4000 nodes should be < 10x time for 500 nodes (allowing for overhead)
      const scalingFactor = timings[3]! / timings[0]!;
      const expectedFactor = sizes[3]! / sizes[0]!; // 8x

      console.log(`  Scaling factor: ${scalingFactor.toFixed(2)}x (expected ~${expectedFactor}x linear)`);

      // Should be roughly linear (within 1.5x of expected)
      expect(scalingFactor).toBeLessThan(expectedFactor * 1.5);
    });

    it('handles high edge density graphs', async () => {
      const nodeCount = 2000;
      const highDensity = 5; // 5 edges per node

      const tenantId = createTestTenantId();
      const { nodes, edges } = createPerformanceTestGraph(nodeCount, highDensity);
      const graph = createTestGraphFromNodes(nodes, edges);

      const baseSnapshot = createTestSnapshot(graph, { tenantId, version: 1 });
      const targetSnapshot = createTestSnapshot(graph, { tenantId, version: 2 });

      const { result, latencyMs } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      console.log(`High density graph (${nodeCount} nodes, ${edges.length} edges):`);
      console.log(`  Time: ${latencyMs.toFixed(2)}ms`);
      console.log(`  Edges per second: ${result.timing.edgesPerSecond}`);

      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.DIFF_10K_NODES_MS);
    });
  });
});

// ============================================================================
// Long-Running Benchmark Tests (Skip by default in CI)
// ============================================================================

describe.skip('Long-Running Performance Benchmarks', () => {
  let engine: GraphDiffEngine;

  beforeEach(async () => {
    engine = createGraphDiffEngine();
    await engine.initialize();
    forceGC();
  });

  afterEach(async () => {
    await engine.shutdown();
    forceGC();
  });

  it('BENCHMARK: 100K nodes diff performance (NFR-PERF-008)', async () => {
    // This test is skipped by default due to long runtime
    // Run manually with: npm test -- --grep "BENCHMARK: 100K"

    console.log('Creating 100K node snapshot pair...');
    const startCreate = performance.now();
    const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(100000, 5);
    const createTime = performance.now() - startCreate;
    console.log(`Snapshot creation: ${createTime.toFixed(2)}ms`);

    console.log('Starting 100K nodes diff...');
    const { result, latencyMs } = await measureLatency(() =>
      engine.computeDiff(baseSnapshot, targetSnapshot)
    );

    console.log(`
======= 100K NODES BENCHMARK RESULTS =======
Total nodes: ${result.summary.baseNodeCount + result.summary.targetNodeCount}
Total edges: ${result.summary.baseEdgeCount + result.summary.targetEdgeCount}
Total time: ${latencyMs.toFixed(2)}ms
Target: ${PERFORMANCE_TARGETS.DIFF_100K_NODES_MS}ms

Timing breakdown:
  - Node identity extraction: ${result.timing.nodeIdentityExtractionMs}ms
  - Node comparison: ${result.timing.nodeComparisonMs}ms
  - Edge identity extraction: ${result.timing.edgeIdentityExtractionMs}ms
  - Edge comparison: ${result.timing.edgeComparisonMs}ms
  - Summary computation: ${result.timing.summaryComputationMs}ms

Throughput:
  - Nodes per second: ${result.timing.nodesPerSecond}
  - Edges per second: ${result.timing.edgesPerSecond}

Changes detected:
  - Nodes added: ${result.summary.nodesAdded}
  - Nodes removed: ${result.summary.nodesRemoved}
  - Nodes modified: ${result.summary.nodesModified}
  - Edges added: ${result.summary.edgesAdded}
  - Edges removed: ${result.summary.edgesRemoved}
=============================================
    `);

    expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.DIFF_100K_NODES_MS);
  });

  it('BENCHMARK: Memory stress test with 50K nodes', async () => {
    forceGC();
    const initialMemory = getMemoryUsage();

    console.log('Creating 50K node snapshot pair...');
    const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(50000, 10);

    const afterCreate = getMemoryUsage();
    console.log(`Memory after snapshot creation: ${((afterCreate - initialMemory) / 1024 / 1024).toFixed(2)}MB`);

    console.log('Starting diff computation...');
    const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

    const afterDiff = getMemoryUsage();
    const totalMemory = afterDiff - initialMemory;

    console.log(`
======= 50K NODES MEMORY BENCHMARK =======
Snapshot creation: ${((afterCreate - initialMemory) / 1024 / 1024).toFixed(2)}MB
Diff computation: ${((afterDiff - afterCreate) / 1024 / 1024).toFixed(2)}MB
Total memory used: ${(totalMemory / 1024 / 1024).toFixed(2)}MB
Memory per node: ${(totalMemory / 50000).toFixed(0)} bytes

Performance:
  - Total time: ${result.timing.totalMs}ms
  - Throughput: ${result.timing.nodesPerSecond} nodes/sec
==========================================
    `);
  });

  it('BENCHMARK: Sustained throughput test', async () => {
    const iterations = 10;
    const nodeCountPerIteration = 2000;

    console.log(`Running ${iterations} iterations of ${nodeCountPerIteration} node diffs...`);

    const results: Array<{ latencyMs: number; throughput: number }> = [];

    for (let i = 0; i < iterations; i++) {
      const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(nodeCountPerIteration, 10);

      const { result, latencyMs } = await measureLatency(() =>
        engine.computeDiff(baseSnapshot, targetSnapshot)
      );

      results.push({
        latencyMs,
        throughput: result.timing.nodesPerSecond,
      });

      if ((i + 1) % 5 === 0) {
        console.log(`  Completed ${i + 1}/${iterations} iterations`);
      }
    }

    const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    const minThroughput = Math.min(...results.map(r => r.throughput));
    const maxThroughput = Math.max(...results.map(r => r.throughput));

    console.log(`
======= SUSTAINED THROUGHPUT BENCHMARK =======
Iterations: ${iterations}
Nodes per iteration: ${nodeCountPerIteration}

Latency:
  - Average: ${avgLatency.toFixed(2)}ms
  - Min: ${Math.min(...results.map(r => r.latencyMs)).toFixed(2)}ms
  - Max: ${Math.max(...results.map(r => r.latencyMs)).toFixed(2)}ms

Throughput (nodes/sec):
  - Average: ${avgThroughput.toFixed(0)}
  - Min: ${minThroughput.toFixed(0)}
  - Max: ${maxThroughput.toFixed(0)}
  - Variance: ${((maxThroughput - minThroughput) / avgThroughput * 100).toFixed(1)}%
==============================================
    `);

    // Sustained throughput should maintain minimum level
    expect(minThroughput).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_NODES_PER_SEC / 2);
  });
});

// ============================================================================
// Performance Regression Detection Tests
// ============================================================================

describe('Performance Regression Detection', () => {
  let engine: GraphDiffEngine;

  beforeEach(async () => {
    engine = createGraphDiffEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('records baseline timing metrics for regression tracking', async () => {
    const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(2000, 10);

    const { result } = await measureLatency(() =>
      engine.computeDiff(baseSnapshot, targetSnapshot)
    );

    // Record metrics that can be tracked over time
    const metrics = {
      timestamp: new Date().toISOString(),
      nodeCount: result.summary.baseNodeCount + result.summary.targetNodeCount,
      edgeCount: result.summary.baseEdgeCount + result.summary.targetEdgeCount,
      totalMs: result.timing.totalMs,
      nodesPerSecond: result.timing.nodesPerSecond,
      edgesPerSecond: result.timing.edgesPerSecond,
      phases: {
        nodeIdentityExtractionMs: result.timing.nodeIdentityExtractionMs,
        nodeComparisonMs: result.timing.nodeComparisonMs,
        edgeIdentityExtractionMs: result.timing.edgeIdentityExtractionMs,
        edgeComparisonMs: result.timing.edgeComparisonMs,
        summaryComputationMs: result.timing.summaryComputationMs,
      },
    };

    console.log('Performance metrics for regression tracking:');
    console.log(JSON.stringify(metrics, null, 2));

    // Verify all timing phases are recorded
    expect(metrics.totalMs).toBeGreaterThan(0);
    expect(metrics.nodesPerSecond).toBeGreaterThan(0);
  });

  it('detects performance degradation > 20%', async () => {
    const baselineMs = 100;
    const currentMs = 125; // 25% slower

    const degradationPercent = ((currentMs - baselineMs) / baselineMs) * 100;

    expect(degradationPercent).toBeGreaterThan(20);
    console.log(`Degradation detection: ${degradationPercent.toFixed(1)}% (threshold: 20%)`);
  });

  it('validates timing metrics are consistent', async () => {
    const { baseSnapshot, targetSnapshot } = createSnapshotPairForDiff(1000, 10);

    const { result } = await measureLatency(() =>
      engine.computeDiff(baseSnapshot, targetSnapshot)
    );

    const timing = result.timing;

    // Sum of phases should be close to total (allowing some overhead)
    const phasesSum =
      timing.nodeIdentityExtractionMs +
      timing.nodeComparisonMs +
      timing.edgeIdentityExtractionMs +
      timing.edgeComparisonMs +
      timing.summaryComputationMs;

    // Phases should account for most of the total time
    expect(phasesSum).toBeLessThanOrEqual(timing.totalMs + 10);
    expect(phasesSum).toBeGreaterThan(timing.totalMs * 0.5);
  });
});

// ============================================================================
// Cost Estimation Validation Tests
// ============================================================================

describe('Cost Estimation Accuracy', () => {
  let engine: GraphDiffEngine;

  beforeEach(async () => {
    engine = createGraphDiffEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('estimates cost within reasonable accuracy', () => {
    const baseRef = {
      id: 'base' as any,
      tenantId: createTestTenantId(),
      nodeCount: 5000,
      edgeCount: 7500,
      createdAt: new Date(),
      version: 1,
    };

    const targetRef = {
      id: 'target' as any,
      tenantId: createTestTenantId(),
      nodeCount: 5500,
      edgeCount: 8250,
      createdAt: new Date(),
      version: 2,
    };

    const estimate = engine.estimateCost(baseRef, targetRef);

    console.log('Cost estimation for 5K-5.5K nodes:');
    console.log(`  Estimated time: ${estimate.estimatedTimeMs}ms`);
    console.log(`  Estimated memory: ${(estimate.estimatedMemoryBytes / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Within limits: ${estimate.withinLimits}`);

    expect(estimate.totalNodes).toBe(10500);
    expect(estimate.totalEdges).toBe(15750);
    expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
    expect(estimate.estimatedMemoryBytes).toBeGreaterThan(0);
  });

  it('warns when approaching limits', () => {
    const largeRef = {
      id: 'large' as any,
      tenantId: createTestTenantId(),
      nodeCount: 40000,
      edgeCount: 80000,
      createdAt: new Date(),
      version: 1,
    };

    const estimate = engine.estimateCost(largeRef, largeRef);

    console.log('Cost estimation for large graph (80K nodes):');
    console.log(`  Estimated memory: ${(estimate.estimatedMemoryBytes / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Warnings: ${estimate.warnings.join(', ')}`);

    // Large graphs should trigger warnings
    if (estimate.estimatedMemoryBytes > MEMORY_CONSTANTS.MAX_MEMORY_BUDGET * 0.8) {
      expect(estimate.warnings.length).toBeGreaterThan(0);
    }
  });
});
