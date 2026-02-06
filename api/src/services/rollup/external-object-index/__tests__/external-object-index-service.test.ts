/**
 * External Object Index Service Unit Tests
 * @module services/rollup/external-object-index/__tests__/external-object-index-service.test
 *
 * Comprehensive unit tests for ExternalObjectIndexService.
 * Tests all service methods including index building, lookup, reverse lookup,
 * invalidation, and statistics.
 *
 * TASK-ROLLUP-003: External Object Index testing
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  ExternalObjectIndexService,
  createExternalObjectIndexService,
  type ExternalObjectIndexServiceDependencies,
  type IGraphService,
} from '../external-object-index-service.js';
import type {
  IExternalObjectRepository,
  IExternalObjectCache,
  IIndexEngine,
  ExternalObjectEntry,
  IndexBuildOptions,
  ExternalReferenceType,
} from '../interfaces.js';
import { ExternalObjectIndexError, LookupError } from '../errors.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';
import type { DependencyGraph, NodeType } from '../../../../types/graph.js';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockRepository(): IExternalObjectRepository & { [key: string]: Mock } {
  return {
    saveEntries: vi.fn().mockResolvedValue(0),
    findByExternalId: vi.fn().mockResolvedValue([]),
    findByNodeId: vi.fn().mockResolvedValue([]),
    deleteEntries: vi.fn().mockResolvedValue(0),
    countEntries: vi.fn().mockResolvedValue(0),
    countByType: vi.fn().mockResolvedValue({
      arn: 0,
      resource_id: 0,
      k8s_reference: 0,
      gcp_resource: 0,
      azure_resource: 0,
    }),
  };
}

function createMockCache(): IExternalObjectCache & { [key: string]: Mock } {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByPattern: vi.fn().mockResolvedValue(0),
    invalidateTenant: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      hitRatio: 0,
    }),
    buildKey: vi.fn().mockImplementation(
      (tenantId: string, externalId: string, repoId?: string) =>
        `${tenantId}:${repoId ?? ''}:${externalId}`
    ),
  };
}

function createMockIndexEngine(): IIndexEngine & { [key: string]: Mock } {
  return {
    processNodes: vi.fn().mockReturnValue([]),
    buildInvertedIndex: vi.fn().mockReturnValue(new Map()),
    mergeIndex: vi.fn().mockReturnValue(new Map()),
  };
}

function createMockGraphService(): IGraphService & { [key: string]: Mock } {
  return {
    getScanGraph: vi.fn().mockResolvedValue(null),
    getLatestScanForRepository: vi.fn().mockResolvedValue(null),
  };
}

function createMockEntry(overrides: Partial<ExternalObjectEntry> = {}): ExternalObjectEntry {
  return {
    id: 'entry-1',
    externalId: 'arn:aws:s3:::test-bucket',
    referenceType: 'arn',
    normalizedId: 'arn:aws:s3:::test-bucket',
    tenantId: 'tenant-1' as TenantId,
    repositoryId: 'repo-1' as RepositoryId,
    scanId: 'scan-1' as ScanId,
    nodeId: 'node-1',
    nodeName: 'aws_s3_bucket.test',
    nodeType: 'terraform_resource',
    filePath: 'main.tf',
    components: { service: 's3', resource: 'test-bucket' },
    metadata: {},
    indexedAt: new Date(),
    ...overrides,
  };
}

function createMockGraph(nodeCount: number = 5): DependencyGraph {
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
      location: { file: 'main.tf', lineStart: i * 10, lineEnd: i * 10 + 5 },
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
// Test Suite
// ============================================================================

describe('ExternalObjectIndexService', () => {
  let service: ExternalObjectIndexService;
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockCache: ReturnType<typeof createMockCache>;
  let mockIndexEngine: ReturnType<typeof createMockIndexEngine>;
  let mockGraphService: ReturnType<typeof createMockGraphService>;

  const tenantId = 'tenant-1' as TenantId;
  const repoId = 'repo-1' as RepositoryId;
  const scanId = 'scan-1' as ScanId;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockCache = createMockCache();
    mockIndexEngine = createMockIndexEngine();
    mockGraphService = createMockGraphService();

    const deps: ExternalObjectIndexServiceDependencies = {
      repository: mockRepository,
      cache: mockCache,
      indexEngine: mockIndexEngine,
      graphService: mockGraphService,
    };

    service = new ExternalObjectIndexService(deps);
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(service).toBeDefined();
    });

    it('should accept custom config', () => {
      const customDeps: ExternalObjectIndexServiceDependencies = {
        repository: mockRepository,
        cache: mockCache,
        indexEngine: mockIndexEngine,
        graphService: mockGraphService,
        config: {
          cache: {
            l1MaxSize: 5000,
            l1TtlSeconds: 150,
            l2TtlSeconds: 1800,
            keyPrefix: 'custom-idx',
            enableL1: true,
            enableL2: false,
          },
          defaultBatchSize: 500,
          maxLookupResults: 500,
          enableParallelProcessing: false,
          parallelWorkers: 2,
          defaultReferenceTypes: ['arn'],
        },
      };

      const customService = new ExternalObjectIndexService(customDeps);
      expect(customService).toBeDefined();
    });
  });

  // ==========================================================================
  // buildIndex Tests
  // ==========================================================================

  describe('buildIndex', () => {
    it('should return empty result when no repositories provided', async () => {
      const result = await service.buildIndex(tenantId, []);

      expect(result.entriesCreated).toBe(0);
      expect(result.entriesUpdated).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.processedScans).toHaveLength(0);
    });

    it('should skip repositories without scans', async () => {
      mockGraphService.getLatestScanForRepository.mockResolvedValue(null);

      const result = await service.buildIndex(tenantId, [repoId]);

      expect(mockGraphService.getLatestScanForRepository).toHaveBeenCalledWith(tenantId, repoId);
      expect(result.entriesCreated).toBe(0);
      expect(result.processedScans).toHaveLength(0);
    });

    it('should process repository scan and create entries', async () => {
      const mockGraph = createMockGraph(5);
      const mockEntries = Array.from({ length: 5 }, (_, i) =>
        createMockEntry({ id: `entry-${i}`, nodeId: `node-${i}` })
      );

      mockGraphService.getLatestScanForRepository.mockResolvedValue(scanId);
      mockGraphService.getScanGraph.mockResolvedValue(mockGraph);
      mockIndexEngine.processNodes.mockReturnValue(mockEntries);
      mockRepository.saveEntries.mockResolvedValue(5);

      const result = await service.buildIndex(tenantId, [repoId]);

      expect(result.entriesCreated).toBe(5);
      expect(result.processedScans).toContain(scanId);
      expect(mockCache.deleteByPattern).toHaveBeenCalledWith(`${tenantId}:${repoId}:*`);
    });

    it('should handle multiple repositories', async () => {
      const repoIds = ['repo-1', 'repo-2', 'repo-3'] as RepositoryId[];

      mockGraphService.getLatestScanForRepository.mockImplementation(
        async (_, repoId) => `scan-${repoId}` as ScanId
      );
      mockGraphService.getScanGraph.mockResolvedValue(createMockGraph(3));
      mockIndexEngine.processNodes.mockReturnValue([createMockEntry()]);
      mockRepository.saveEntries.mockResolvedValue(1);

      const result = await service.buildIndex(tenantId, repoIds);

      expect(result.processedScans).toHaveLength(3);
      expect(mockGraphService.getLatestScanForRepository).toHaveBeenCalledTimes(3);
    });

    it('should continue processing after individual repository failure', async () => {
      const repoIds = ['repo-1', 'repo-2'] as RepositoryId[];

      mockGraphService.getLatestScanForRepository
        .mockResolvedValueOnce('scan-1' as ScanId)
        .mockResolvedValueOnce('scan-2' as ScanId);

      mockGraphService.getScanGraph
        .mockRejectedValueOnce(new Error('Graph fetch failed'))
        .mockResolvedValueOnce(createMockGraph(3));

      mockIndexEngine.processNodes.mockReturnValue([createMockEntry()]);
      mockRepository.saveEntries.mockResolvedValue(1);

      const result = await service.buildIndex(tenantId, repoIds);

      expect(result.errors).toBe(1);
      expect(result.processedScans).toHaveLength(1);
    });

    it('should respect maxNodes option', async () => {
      const mockGraph = createMockGraph(100);
      mockGraphService.getLatestScanForRepository.mockResolvedValue(scanId);
      mockGraphService.getScanGraph.mockResolvedValue(mockGraph);
      mockIndexEngine.processNodes.mockReturnValue([]);
      mockRepository.saveEntries.mockResolvedValue(0);

      const options: IndexBuildOptions = { maxNodes: 10 };
      await service.buildIndex(tenantId, [repoId], options);

      // Verify processNodes was called with limited nodes
      const processNodesCalls = mockIndexEngine.processNodes.mock.calls;
      expect(processNodesCalls).toHaveLength(1);
      expect(processNodesCalls[0][0]).toHaveLength(10);
    });

    it('should throw ExternalObjectIndexError on complete failure', async () => {
      mockGraphService.getLatestScanForRepository.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.buildIndex(tenantId, [repoId])).rejects.toThrow(
        ExternalObjectIndexError
      );
    });

    it('should track build time in stats', async () => {
      mockGraphService.getLatestScanForRepository.mockResolvedValue(scanId);
      mockGraphService.getScanGraph.mockResolvedValue(createMockGraph(1));
      mockIndexEngine.processNodes.mockReturnValue([createMockEntry()]);
      mockRepository.saveEntries.mockResolvedValue(1);

      const result = await service.buildIndex(tenantId, [repoId]);

      expect(result.buildTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // lookupByExternalId Tests
  // ==========================================================================

  describe('lookupByExternalId', () => {
    const externalId = 'arn:aws:s3:::test-bucket';

    it('should return cached result when available', async () => {
      const cachedEntries = [createMockEntry()];
      mockCache.get.mockResolvedValue(cachedEntries);

      const result = await service.lookupByExternalId(tenantId, externalId);

      expect(result.fromCache).toBe(true);
      expect(result.entries).toEqual(cachedEntries);
      expect(mockRepository.findByExternalId).not.toHaveBeenCalled();
    });

    it('should query repository on cache miss', async () => {
      const dbEntries = [createMockEntry()];
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue(dbEntries);

      const result = await service.lookupByExternalId(tenantId, externalId);

      expect(result.fromCache).toBe(false);
      expect(result.entries).toEqual(dbEntries);
      expect(mockRepository.findByExternalId).toHaveBeenCalled();
    });

    it('should cache results after repository query', async () => {
      const dbEntries = [createMockEntry()];
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue(dbEntries);

      await service.lookupByExternalId(tenantId, externalId);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        dbEntries
      );
    });

    it('should not cache empty results', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue([]);

      await service.lookupByExternalId(tenantId, externalId);

      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should throw LookupError for empty externalId', async () => {
      await expect(service.lookupByExternalId(tenantId, '')).rejects.toThrow(LookupError);
    });

    it('should throw LookupError for whitespace-only externalId', async () => {
      await expect(service.lookupByExternalId(tenantId, '   ')).rejects.toThrow(LookupError);
    });

    it('should apply referenceType filter', async () => {
      const dbEntries = [createMockEntry({ referenceType: 'arn' })];
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue(dbEntries);

      await service.lookupByExternalId(tenantId, externalId, {
        referenceType: 'arn',
      });

      expect(mockRepository.findByExternalId).toHaveBeenCalledWith(
        tenantId,
        externalId,
        expect.objectContaining({ referenceType: 'arn' })
      );
    });

    it('should apply repositoryIds filter', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue([]);

      await service.lookupByExternalId(tenantId, externalId, {
        repositoryIds: [repoId],
      });

      expect(mockRepository.findByExternalId).toHaveBeenCalledWith(
        tenantId,
        externalId,
        expect.objectContaining({ repositoryIds: [repoId] })
      );
    });

    it('should apply pagination options', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue([]);

      await service.lookupByExternalId(tenantId, externalId, {
        limit: 50,
        offset: 10,
      });

      expect(mockRepository.findByExternalId).toHaveBeenCalledWith(
        tenantId,
        externalId,
        expect.objectContaining({ limit: 50, offset: 10 })
      );
    });

    it('should filter cached results by referenceType when needed', async () => {
      const cachedEntries = [
        createMockEntry({ referenceType: 'arn' }),
        createMockEntry({ referenceType: 'resource_id' }),
      ];
      mockCache.get.mockResolvedValue(cachedEntries);

      const result = await service.lookupByExternalId(tenantId, externalId, {
        referenceType: 'arn',
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].referenceType).toBe('arn');
    });

    it('should track lookup time', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      const result = await service.lookupByExternalId(tenantId, externalId);

      expect(result.lookupTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should increment lookup statistics', async () => {
      mockCache.get.mockResolvedValue([createMockEntry()]);

      await service.lookupByExternalId(tenantId, externalId);
      await service.lookupByExternalId(tenantId, externalId);

      const stats = await service.getStats(tenantId);
      expect(stats.avgLookupTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // reverseLookup Tests
  // ==========================================================================

  describe('reverseLookup', () => {
    const nodeId = 'node-1';

    it('should return cached result when available', async () => {
      const cachedEntries = [createMockEntry({ nodeId })];
      mockCache.get.mockResolvedValue(cachedEntries);

      const result = await service.reverseLookup(tenantId, nodeId, scanId);

      expect(result.fromCache).toBe(true);
      expect(result.references).toEqual(cachedEntries);
      expect(mockRepository.findByNodeId).not.toHaveBeenCalled();
    });

    it('should query repository on cache miss', async () => {
      const dbEntries = [createMockEntry({ nodeId })];
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByNodeId.mockResolvedValue(dbEntries);

      const result = await service.reverseLookup(tenantId, nodeId, scanId);

      expect(result.fromCache).toBe(false);
      expect(result.references).toEqual(dbEntries);
      expect(mockRepository.findByNodeId).toHaveBeenCalledWith(tenantId, nodeId, scanId);
    });

    it('should cache reverse lookup results', async () => {
      const dbEntries = [createMockEntry({ nodeId })];
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByNodeId.mockResolvedValue(dbEntries);

      await service.reverseLookup(tenantId, nodeId, scanId);

      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should track lookup time', async () => {
      mockCache.get.mockResolvedValue([]);

      const result = await service.reverseLookup(tenantId, nodeId, scanId);

      expect(result.lookupTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw ExternalObjectIndexError on failure', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByNodeId.mockRejectedValue(new Error('Database error'));

      await expect(service.reverseLookup(tenantId, nodeId, scanId)).rejects.toThrow(
        ExternalObjectIndexError
      );
    });
  });

  // ==========================================================================
  // invalidate Tests
  // ==========================================================================

  describe('invalidate', () => {
    it('should delete entries from repository', async () => {
      mockRepository.deleteEntries.mockResolvedValue(5);

      const result = await service.invalidate(tenantId, { repositoryId: repoId });

      expect(mockRepository.deleteEntries).toHaveBeenCalledWith(tenantId, { repositoryId: repoId });
      expect(result).toBe(5);
    });

    it('should invalidate cache by pattern when repositoryId provided', async () => {
      mockRepository.deleteEntries.mockResolvedValue(5);

      await service.invalidate(tenantId, { repositoryId: repoId });

      expect(mockCache.deleteByPattern).toHaveBeenCalledWith(`${tenantId}:${repoId}:*`);
    });

    it('should invalidate entire tenant cache when no repositoryId', async () => {
      mockRepository.deleteEntries.mockResolvedValue(10);

      await service.invalidate(tenantId, {});

      expect(mockCache.invalidateTenant).toHaveBeenCalledWith(tenantId);
    });

    it('should support scanId filter', async () => {
      mockRepository.deleteEntries.mockResolvedValue(3);

      await service.invalidate(tenantId, { scanId });

      expect(mockRepository.deleteEntries).toHaveBeenCalledWith(tenantId, { scanId });
    });

    it('should support referenceType filter', async () => {
      mockRepository.deleteEntries.mockResolvedValue(2);

      await service.invalidate(tenantId, { referenceType: 'arn' });

      expect(mockRepository.deleteEntries).toHaveBeenCalledWith(tenantId, { referenceType: 'arn' });
    });

    it('should throw ExternalObjectIndexError on failure', async () => {
      mockRepository.deleteEntries.mockRejectedValue(new Error('Delete failed'));

      await expect(service.invalidate(tenantId, {})).rejects.toThrow(
        ExternalObjectIndexError
      );
    });
  });

  // ==========================================================================
  // getStats Tests
  // ==========================================================================

  describe('getStats', () => {
    it('should return combined statistics', async () => {
      mockRepository.countEntries.mockResolvedValue(100);
      mockRepository.countByType.mockResolvedValue({
        arn: 50,
        resource_id: 30,
        k8s_reference: 15,
        gcp_resource: 3,
        azure_resource: 2,
      });
      mockCache.getStats.mockReturnValue({
        l1Hits: 80,
        l1Misses: 20,
        l2Hits: 10,
        l2Misses: 10,
        hitRatio: 0.75,
      });

      const stats = await service.getStats(tenantId);

      expect(stats.totalEntries).toBe(100);
      expect(stats.entriesByType.arn).toBe(50);
      expect(stats.cacheHitRatio).toBe(0.75);
    });

    it('should include build time from last build', async () => {
      // Perform a build first
      mockGraphService.getLatestScanForRepository.mockResolvedValue(scanId);
      mockGraphService.getScanGraph.mockResolvedValue(createMockGraph(1));
      mockIndexEngine.processNodes.mockReturnValue([createMockEntry()]);
      mockRepository.saveEntries.mockResolvedValue(1);

      await service.buildIndex(tenantId, [repoId]);

      mockRepository.countEntries.mockResolvedValue(1);
      mockRepository.countByType.mockResolvedValue({
        arn: 1, resource_id: 0, k8s_reference: 0, gcp_resource: 0, azure_resource: 0,
      });

      const stats = await service.getStats(tenantId);

      expect(stats.lastBuildTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.lastBuildAt).not.toBeNull();
    });

    it('should calculate average lookup time', async () => {
      // Perform some lookups
      mockCache.get.mockResolvedValue([createMockEntry()]);

      await service.lookupByExternalId(tenantId, 'arn:aws:s3:::bucket-1');
      await service.lookupByExternalId(tenantId, 'arn:aws:s3:::bucket-2');

      mockRepository.countEntries.mockResolvedValue(10);
      mockRepository.countByType.mockResolvedValue({
        arn: 10, resource_id: 0, k8s_reference: 0, gcp_resource: 0, azure_resource: 0,
      });

      const stats = await service.getStats(tenantId);

      expect(stats.avgLookupTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw ExternalObjectIndexError on failure', async () => {
      mockRepository.countEntries.mockRejectedValue(new Error('Count failed'));

      await expect(service.getStats(tenantId)).rejects.toThrow(
        ExternalObjectIndexError
      );
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('createExternalObjectIndexService', () => {
    it('should create service instance', () => {
      const instance = createExternalObjectIndexService({
        repository: mockRepository,
        cache: mockCache,
        indexEngine: mockIndexEngine,
        graphService: mockGraphService,
      });

      expect(instance).toBeInstanceOf(ExternalObjectIndexService);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle graph with no nodes', async () => {
      const emptyGraph: DependencyGraph = {
        nodes: new Map(),
        edges: new Map(),
        metadata: { scanId: 'scan-1', repositoryId: 'repo-1', version: '1.0.0', createdAt: new Date() },
      };

      mockGraphService.getLatestScanForRepository.mockResolvedValue(scanId);
      mockGraphService.getScanGraph.mockResolvedValue(emptyGraph);
      mockIndexEngine.processNodes.mockReturnValue([]);
      mockRepository.saveEntries.mockResolvedValue(0);

      const result = await service.buildIndex(tenantId, [repoId]);

      expect(result.entriesCreated).toBe(0);
    });

    it('should handle concurrent lookups', async () => {
      const entries = [createMockEntry()];
      mockCache.get.mockResolvedValue(entries);

      const promises = Array.from({ length: 10 }, () =>
        service.lookupByExternalId(tenantId, 'arn:aws:s3:::test')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.entries).toEqual(entries);
      });
    });

    it('should handle special characters in external IDs', async () => {
      const specialId = 'arn:aws:s3:::bucket-with/path+special=chars';
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByExternalId.mockResolvedValue([]);

      const result = await service.lookupByExternalId(tenantId, specialId);

      expect(result.externalId).toBe(specialId);
    });
  });
});
