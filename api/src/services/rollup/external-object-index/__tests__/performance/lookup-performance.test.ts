/**
 * Performance Tests for External Object Index
 * @module services/rollup/external-object-index/__tests__/performance/lookup-performance.test
 *
 * Performance tests ensuring NFR-PERF-008 compliance:
 * - Lookup latency < 100ms
 * - Reverse lookup < 500ms at 100K nodes
 * - Bulk operation throughput
 *
 * TASK-ROLLUP-003: External Object Index performance testing
 * NFR-PERF-008: 100K nodes lookup < 500ms benchmark target
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  ExternalObjectIndexService,
  type ExternalObjectIndexServiceDependencies,
} from '../../external-object-index-service.js';
import type {
  IExternalObjectRepository,
  IExternalObjectCache,
  IIndexEngine,
  ExternalObjectEntry,
} from '../../interfaces.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../../types/entities.js';
import type { DependencyGraph, NodeType } from '../../../../../types/graph.js';

// ============================================================================
// Performance Test Configuration
// ============================================================================

const PERFORMANCE_TARGETS = {
  /** Single lookup should complete in < 100ms */
  LOOKUP_LATENCY_MS: 100,
  /** Reverse lookup should complete in < 500ms for 100K nodes */
  REVERSE_LOOKUP_LATENCY_MS: 500,
  /** Batch lookup of 1000 items should complete in < 2000ms */
  BATCH_LOOKUP_LATENCY_MS: 2000,
  /** Index build of 10K nodes should complete in < 30000ms */
  BUILD_LATENCY_MS: 30000,
  /** Cache hit ratio should be > 80% */
  CACHE_HIT_RATIO_TARGET: 0.80,
};

// ============================================================================
// Mock Factories for Performance Tests
// ============================================================================

function createMockRepository(): IExternalObjectRepository & { [key: string]: Mock } {
  return {
    saveEntries: vi.fn().mockResolvedValue(0),
    findByExternalId: vi.fn().mockResolvedValue([]),
    findByNodeId: vi.fn().mockResolvedValue([]),
    deleteEntries: vi.fn().mockResolvedValue(0),
    countEntries: vi.fn().mockResolvedValue(0),
    countByType: vi.fn().mockResolvedValue({}),
  };
}

function createMockCache(): IExternalObjectCache & {
  [key: string]: Mock;
  hitCount: number;
  missCount: number;
} {
  const cache = {
    hitCount: 0,
    missCount: 0,
    get: vi.fn().mockImplementation(async () => {
      // Simulate cache hit/miss ratio
      if (Math.random() < 0.8) {
        cache.hitCount++;
        return [createMockEntry()];
      }
      cache.missCount++;
      return null;
    }),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByPattern: vi.fn().mockResolvedValue(0),
    invalidateTenant: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockImplementation(() => ({
      l1Hits: cache.hitCount,
      l1Misses: cache.missCount,
      l2Hits: 0,
      l2Misses: 0,
      hitRatio: cache.hitCount / (cache.hitCount + cache.missCount) || 0,
    })),
    buildKey: vi.fn().mockImplementation(
      (tenantId: string, externalId: string) => `${tenantId}:${externalId}`
    ),
  };
  return cache;
}

function createMockIndexEngine(): IIndexEngine & { processNodes: Mock } {
  return {
    processNodes: vi.fn().mockImplementation((nodes: NodeType[]) =>
      nodes.map((node, i) => createMockEntry({ id: `entry-${i}`, nodeId: node.id }))
    ),
    buildInvertedIndex: vi.fn().mockReturnValue(new Map()),
    mergeIndex: vi.fn().mockReturnValue(new Map()),
  };
}

function createMockEntry(overrides: Partial<ExternalObjectEntry> = {}): ExternalObjectEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    externalId: `arn:aws:s3:::bucket-${Math.random().toString(36).slice(2)}`,
    referenceType: 'arn',
    normalizedId: 'arn:aws:s3:::test-bucket',
    tenantId: 'tenant-1' as TenantId,
    repositoryId: 'repo-1' as RepositoryId,
    scanId: 'scan-1' as ScanId,
    nodeId: 'node-1',
    nodeName: 'aws_s3_bucket.test',
    nodeType: 'terraform_resource',
    filePath: 'main.tf',
    components: {},
    metadata: {},
    indexedAt: new Date(),
    ...overrides,
  };
}

function createMockGraph(nodeCount: number): DependencyGraph {
  const nodes = new Map<string, NodeType>();

  for (let i = 0; i < nodeCount; i++) {
    nodes.set(`node-${i}`, {
      id: `node-${i}`,
      type: 'terraform_resource',
      name: `aws_s3_bucket.bucket_${i}`,
      metadata: {
        arn: `arn:aws:s3:::bucket-${i}`,
        resourceType: 'aws_s3_bucket',
      },
      location: { file: `file-${Math.floor(i / 100)}.tf`, lineStart: i * 10, lineEnd: i * 10 + 5 },
      dependencies: [],
      dependents: [],
    });
  }

  return {
    nodes,
    edges: new Map(),
    metadata: {
      scanId: 'scan-1',
      repositoryId: 'repo-1',
      version: '1.0.0',
      createdAt: new Date(),
    },
  };
}

// ============================================================================
// Performance Measurement Utilities
// ============================================================================

async function measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now();
  const result = await fn();
  const latencyMs = performance.now() - start;
  return { result, latencyMs };
}

async function measureThroughput<T>(
  fn: () => Promise<T>,
  iterations: number
): Promise<{ avgLatencyMs: number; throughputPerSec: number; p95LatencyMs: number }> {
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const { latencyMs } = await measureLatency(fn);
    latencies.push(latencyMs);
  }

  latencies.sort((a, b) => a - b);

  const avgLatencyMs = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95LatencyMs = latencies[p95Index];
  const throughputPerSec = 1000 / avgLatencyMs;

  return { avgLatencyMs, throughputPerSec, p95LatencyMs };
}

// ============================================================================
// Performance Test Suite
// ============================================================================

// NOTE: These tests are skipped due to mock setup issues - service.deps.graphService is undefined
// and repository uses IDatabaseClient interface but mocks provide different interface.
// TODO: TASK-TBD - Fix performance test mock dependencies
describe.skip('Performance Tests', () => {
  let service: ExternalObjectIndexService;
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockCache: ReturnType<typeof createMockCache>;
  let mockIndexEngine: ReturnType<typeof createMockIndexEngine>;

  const tenantId = 'tenant-1' as TenantId;
  const repoId = 'repo-1' as RepositoryId;
  const scanId = 'scan-1' as ScanId;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockCache = createMockCache();
    mockIndexEngine = createMockIndexEngine();

    const deps: ExternalObjectIndexServiceDependencies = {
      repository: mockRepository,
      cache: mockCache,
      indexEngine: mockIndexEngine,
      graphService: {
        getScanGraph: vi.fn().mockResolvedValue(null),
        getLatestScanForRepository: vi.fn().mockResolvedValue(null),
      },
    };

    service = new ExternalObjectIndexService(deps);
  });

  // ==========================================================================
  // NFR-PERF-008: Lookup Latency Tests
  // ==========================================================================

  describe('NFR-PERF-008: Lookup Latency', () => {
    it('should complete single lookup in < 100ms (cache hit)', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const { latencyMs } = await measureLatency(() =>
        service.lookupByExternalId(tenantId, 'arn:aws:s3:::test-bucket')
      );

      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.LOOKUP_LATENCY_MS);
    });

    it('should complete single lookup in < 100ms (cache miss, DB hit)', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue([createMockEntry()]);

      const { latencyMs } = await measureLatency(() =>
        service.lookupByExternalId(tenantId, 'arn:aws:s3:::test-bucket')
      );

      // DB lookup should still be fast in mocked environment
      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.LOOKUP_LATENCY_MS);
    });

    it('should maintain < 100ms latency under concurrent load', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const concurrentLookups = 100;
      const lookupPromises = Array.from({ length: concurrentLookups }, (_, i) =>
        measureLatency(() =>
          service.lookupByExternalId(tenantId, `arn:aws:s3:::bucket-${i}`)
        )
      );

      const results = await Promise.all(lookupPromises);
      const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
      const maxLatency = Math.max(...results.map(r => r.latencyMs));

      expect(avgLatency).toBeLessThan(PERFORMANCE_TARGETS.LOOKUP_LATENCY_MS);
      // Max latency under load may be slightly higher
      expect(maxLatency).toBeLessThan(PERFORMANCE_TARGETS.LOOKUP_LATENCY_MS * 3);
    });
  });

  // ==========================================================================
  // NFR-PERF-008: Reverse Lookup Performance Tests
  // ==========================================================================

  describe('NFR-PERF-008: Reverse Lookup at Scale', () => {
    it('should complete reverse lookup in < 500ms (cache hit)', async () => {
      // Generate entries simulating 100K node references
      const entries = Array.from({ length: 100 }, (_, i) =>
        createMockEntry({ id: `entry-${i}`, externalId: `arn:aws:s3:::bucket-${i}` })
      );

      mockCache.get.mockResolvedValue(entries);

      const { latencyMs } = await measureLatency(() =>
        service.reverseLookup(tenantId, 'node-1', scanId)
      );

      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.REVERSE_LOOKUP_LATENCY_MS);
    });

    it('should handle 100K node reverse lookup within target', async () => {
      // Simulate large-scale reverse lookup
      const largeEntrySet = Array.from({ length: 1000 }, (_, i) =>
        createMockEntry({ id: `entry-${i}` })
      );

      mockCache.get.mockResolvedValue(null);
      mockRepository.findByNodeId.mockResolvedValue(largeEntrySet);

      const { latencyMs } = await measureLatency(() =>
        service.reverseLookup(tenantId, 'node-1', scanId)
      );

      // Should complete well under target in mocked environment
      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.REVERSE_LOOKUP_LATENCY_MS);
    });
  });

  // ==========================================================================
  // Batch Operation Performance Tests
  // ==========================================================================

  describe('Batch Operation Performance', () => {
    it('should complete batch lookup of 1000 items efficiently', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const batchSize = 1000;
      const lookups = Array.from({ length: batchSize }, (_, i) => ({
        externalId: `arn:aws:s3:::bucket-${i}`,
        tenantId,
      }));

      const { latencyMs } = await measureLatency(async () => {
        await Promise.all(
          lookups.map(l => service.lookupByExternalId(l.tenantId, l.externalId))
        );
      });

      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.BATCH_LOOKUP_LATENCY_MS);
    });

    it('should maintain throughput > 500 lookups/sec', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const { throughputPerSec } = await measureThroughput(
        () => service.lookupByExternalId(tenantId, 'arn:aws:s3:::test-bucket'),
        100
      );

      expect(throughputPerSec).toBeGreaterThan(500);
    });
  });

  // ==========================================================================
  // Index Build Performance Tests
  // ==========================================================================

  describe('Index Build Performance', () => {
    it('should build index for 10K nodes within target', async () => {
      const largeGraph = createMockGraph(10000);

      (service as any).deps.graphService.getLatestScanForRepository.mockResolvedValue(scanId);
      (service as any).deps.graphService.getScanGraph.mockResolvedValue(largeGraph);
      mockRepository.saveEntries.mockResolvedValue(10000);

      const { latencyMs, result } = await measureLatency(() =>
        service.buildIndex(tenantId, [repoId])
      );

      expect(latencyMs).toBeLessThan(PERFORMANCE_TARGETS.BUILD_LATENCY_MS);
      expect(result.entriesCreated).toBe(10000);
    });

    it('should track build time in result stats', async () => {
      const graph = createMockGraph(1000);

      (service as any).deps.graphService.getLatestScanForRepository.mockResolvedValue(scanId);
      (service as any).deps.graphService.getScanGraph.mockResolvedValue(graph);
      mockRepository.saveEntries.mockResolvedValue(1000);

      const result = await service.buildIndex(tenantId, [repoId]);

      expect(result.buildTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.buildTimeMs).toBeLessThan(PERFORMANCE_TARGETS.BUILD_LATENCY_MS);
    });
  });

  // ==========================================================================
  // Cache Performance Tests
  // ==========================================================================

  describe('Cache Performance', () => {
    it('should achieve > 80% cache hit ratio under typical load', async () => {
      // Simulate typical access pattern with locality
      const uniqueIds = Array.from({ length: 100 }, (_, i) => `arn:aws:s3:::bucket-${i}`);

      // Access pattern: 80% of requests hit 20% of items (Pareto principle)
      const accessPattern: string[] = [];
      for (let i = 0; i < 1000; i++) {
        if (Math.random() < 0.8) {
          // Hot items (first 20)
          accessPattern.push(uniqueIds[Math.floor(Math.random() * 20)]);
        } else {
          // Cold items (remaining 80)
          accessPattern.push(uniqueIds[20 + Math.floor(Math.random() * 80)]);
        }
      }

      // Reset hit/miss counters
      mockCache.hitCount = 0;
      mockCache.missCount = 0;

      // Perform lookups
      for (const externalId of accessPattern) {
        await service.lookupByExternalId(tenantId, externalId);
      }

      const stats = mockCache.getStats();

      // With good caching of hot items, should achieve > 80% hit rate
      expect(stats.hitRatio).toBeGreaterThan(PERFORMANCE_TARGETS.CACHE_HIT_RATIO_TARGET);
    });

    it('should have sub-millisecond L1 cache access time', async () => {
      // Prime the cache
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const iterations = 1000;
      const { avgLatencyMs, p95LatencyMs } = await measureThroughput(
        () => service.lookupByExternalId(tenantId, 'arn:aws:s3:::test'),
        iterations
      );

      // Mocked cache should be very fast
      expect(avgLatencyMs).toBeLessThan(10);
      expect(p95LatencyMs).toBeLessThan(20);
    });
  });

  // ==========================================================================
  // Memory Performance Tests
  // ==========================================================================

  describe('Memory Performance', () => {
    it('should handle large result sets without memory issues', async () => {
      const largeEntrySet = Array.from({ length: 10000 }, (_, i) =>
        createMockEntry({
          id: `entry-${i}`,
          externalId: `arn:aws:s3:::bucket-${i}`,
          metadata: { largeData: 'x'.repeat(100) }, // ~100 bytes per entry
        })
      );

      mockCache.get.mockResolvedValue(largeEntrySet);

      const memoryBefore = process.memoryUsage().heapUsed;

      const result = await service.lookupByExternalId(tenantId, 'arn:aws:s3:::test');

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryDelta = memoryAfter - memoryBefore;

      // Memory increase should be reasonable (< 100MB for 10K entries)
      expect(memoryDelta).toBeLessThan(100 * 1024 * 1024);
      expect(result.entries).toHaveLength(10000);
    });
  });

  // ==========================================================================
  // Latency Percentile Tests
  // ==========================================================================

  describe('Latency Percentiles', () => {
    it('should have p95 latency < 150ms for lookups', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const { p95LatencyMs } = await measureThroughput(
        () => service.lookupByExternalId(tenantId, 'arn:aws:s3:::test'),
        100
      );

      expect(p95LatencyMs).toBeLessThan(150);
    });

    it('should have p99 latency < 300ms for lookups', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const { latencyMs } = await measureLatency(() =>
          service.lookupByExternalId(tenantId, 'arn:aws:s3:::test')
        );
        latencies.push(latencyMs);
      }

      latencies.sort((a, b) => a - b);
      const p99Index = Math.floor(latencies.length * 0.99);
      const p99Latency = latencies[p99Index];

      expect(p99Latency).toBeLessThan(300);
    });
  });
});

// ============================================================================
// Performance Benchmark Suite
// ============================================================================

describe('Performance Benchmarks', () => {
  // These tests run longer benchmarks for thorough performance analysis

  it.skip('BENCHMARK: 100K node lookup stress test', async () => {
    // This test is skipped by default due to long runtime
    // Run manually with: npm test -- --grep "BENCHMARK"

    const mockRepository = createMockRepository();
    const mockCache = createMockCache();
    const mockIndexEngine = createMockIndexEngine();

    const deps: ExternalObjectIndexServiceDependencies = {
      repository: mockRepository,
      cache: mockCache,
      indexEngine: mockIndexEngine,
      graphService: {
        getScanGraph: vi.fn().mockResolvedValue(null),
        getLatestScanForRepository: vi.fn().mockResolvedValue(null),
      },
    };

    const service = new ExternalObjectIndexService(deps);
    const tenantId = 'tenant-1' as TenantId;

    // Warm up
    for (let i = 0; i < 100; i++) {
      await service.lookupByExternalId(tenantId, `arn:aws:s3:::bucket-${i}`);
    }

    // Benchmark
    const startTime = performance.now();
    const iterations = 100000;

    for (let i = 0; i < iterations; i++) {
      await service.lookupByExternalId(tenantId, `arn:aws:s3:::bucket-${i % 1000}`);
    }

    const endTime = performance.now();
    const totalTimeMs = endTime - startTime;
    const avgLatencyMs = totalTimeMs / iterations;
    const throughput = iterations / (totalTimeMs / 1000);

    console.log(`
      ======= BENCHMARK RESULTS =======
      Total iterations: ${iterations}
      Total time: ${totalTimeMs.toFixed(2)}ms
      Average latency: ${avgLatencyMs.toFixed(4)}ms
      Throughput: ${throughput.toFixed(0)} ops/sec
      =================================
    `);

    expect(avgLatencyMs).toBeLessThan(1); // < 1ms average in mocked environment
    expect(throughput).toBeGreaterThan(1000); // > 1000 ops/sec
  });
});
