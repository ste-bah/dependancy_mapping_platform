/**
 * Rollup Cache Test Fixtures
 * @module services/rollup/rollup-cache/__tests__/fixtures
 *
 * Test fixtures and factory functions for rollup cache testing.
 * Provides mock data for cached entries, execution results, merged graphs,
 * and blast radius responses.
 */

import { randomUUID } from 'crypto';
import type { TenantId } from '../../../../types/entities.js';
import type {
  RollupId,
  RollupExecutionId,
  RollupExecutionResult,
  MergedNode,
  BlastRadiusResponse,
  RollupExecutionStats,
} from '../../../../types/rollup.js';
import type {
  CachedExecutionResult,
  CachedMergedGraph,
  CachedBlastRadius,
  CacheEntryMetadata,
  CacheTag,
  CacheKey,
} from '../interfaces.js';
import { createCacheTag, createCacheKey, createCacheEntryMetadata } from '../interfaces.js';

// ============================================================================
// ID Generators
// ============================================================================

export function createTestTenantId(): TenantId {
  return randomUUID() as TenantId;
}

export function createTestRollupId(): RollupId {
  return `rollup_${randomUUID()}` as RollupId;
}

export function createTestExecutionId(): RollupExecutionId {
  return `exec_${randomUUID()}` as RollupExecutionId;
}

export function createTestNodeId(): string {
  return `node_${randomUUID()}`;
}

export function createTestCacheKey(suffix: string = ''): CacheKey {
  return createCacheKey(`rollup:v1:test:key:${suffix || randomUUID()}`);
}

export function createTestCacheTag(prefix: string = 'test'): CacheTag {
  return createCacheTag(`${prefix}:${randomUUID()}`);
}

// ============================================================================
// Execution Result Fixtures
// ============================================================================

export function createTestExecutionStats(
  overrides: Partial<RollupExecutionStats> = {}
): RollupExecutionStats {
  return {
    nodesBeforeMerge: 100,
    nodesAfterMerge: 80,
    edgesBeforeMerge: 200,
    edgesAfterMerge: 180,
    crossRepoEdges: 20,
    conflicts: 5,
    conflictsResolved: 5,
    matchesFound: 15,
    matchesByType: {
      arn: 10,
      name: 5,
    },
    durationMs: 1500,
    ...overrides,
  };
}

export function createTestExecutionResult(
  overrides: Partial<RollupExecutionResult> = {}
): RollupExecutionResult {
  const executionId = createTestExecutionId();
  return {
    id: executionId,
    rollupId: createTestRollupId(),
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    stats: createTestExecutionStats(),
    mergedNodes: [],
    edges: [],
    ...overrides,
  };
}

export function createTestCacheMetadata(
  ttlSeconds: number = 3600,
  tags: readonly CacheTag[] = [],
  overrides: Partial<CacheEntryMetadata> = {}
): CacheEntryMetadata {
  const base = createCacheEntryMetadata(ttlSeconds, 'computation', tags);
  return {
    ...base,
    ...overrides,
  };
}

export function createTestCachedExecutionResult(
  overrides: Partial<CachedExecutionResult> = {}
): CachedExecutionResult {
  const rollupId = createTestRollupId();
  return {
    data: createTestExecutionResult({ rollupId }),
    rollupId,
    metadata: createTestCacheMetadata(3600, [createTestCacheTag('tenant')]),
    ...overrides,
  };
}

// ============================================================================
// Merged Graph Fixtures
// ============================================================================

export function createTestMergedNode(
  overrides: Partial<MergedNode> = {}
): MergedNode {
  const nodeId = createTestNodeId();
  return {
    id: nodeId,
    type: 'terraform_resource',
    name: `test-resource-${nodeId}`,
    provider: 'aws',
    resourceType: 'aws_s3_bucket',
    attributes: { bucket: 'test-bucket' },
    sourceNodes: [
      {
        repositoryId: randomUUID(),
        scanId: randomUUID(),
        nodeId: randomUUID(),
      },
    ],
    mergedAttributes: {},
    confidence: 95,
    matchType: 'arn',
    ...overrides,
  } as MergedNode;
}

export function createTestCachedMergedGraph(
  overrides: Partial<CachedMergedGraph> = {}
): CachedMergedGraph {
  const nodes = [createTestMergedNode(), createTestMergedNode(), createTestMergedNode()];
  return {
    mergedNodes: nodes,
    nodeCount: nodes.length,
    edgeCount: 5,
    executionId: createTestExecutionId(),
    metadata: createTestCacheMetadata(1800, [createTestCacheTag('rollup')]),
    ...overrides,
  };
}

// ============================================================================
// Blast Radius Fixtures
// ============================================================================

export function createTestBlastRadiusResponse(
  overrides: Partial<BlastRadiusResponse> = {}
): BlastRadiusResponse {
  return {
    query: {
      nodeIds: [createTestNodeId()],
      maxDepth: 3,
      includeCrossRepo: true,
      includeIndirect: true,
    },
    rollupId: createTestRollupId(),
    executionId: createTestExecutionId(),
    directImpact: [],
    indirectImpact: [],
    crossRepoImpact: [],
    summary: {
      totalImpacted: 10,
      directCount: 5,
      indirectCount: 3,
      crossRepoCount: 2,
      impactByType: { aws_s3_bucket: 5, aws_iam_role: 5 },
      impactByRepo: { 'repo-1': 6, 'repo-2': 4 },
      impactByDepth: { '1': 5, '2': 3, '3': 2 },
      riskLevel: 'medium',
    },
    ...overrides,
  };
}

export function createTestCachedBlastRadius(
  overrides: Partial<CachedBlastRadius> = {}
): CachedBlastRadius {
  const nodeId = createTestNodeId();
  return {
    data: createTestBlastRadiusResponse(),
    nodeId,
    depth: 3,
    metadata: createTestCacheMetadata(900, [createTestCacheTag('node')]),
    ...overrides,
  };
}

// ============================================================================
// Mock Cache Configuration
// ============================================================================

export function createTestCacheConfig() {
  return {
    l1: {
      executionMaxSize: 100,
      graphMaxSize: 50,
      blastRadiusMaxSize: 200,
      ttlSeconds: 60,
      enabled: true,
    },
    l2: {
      executionTtlSeconds: 300,
      graphTtlSeconds: 150,
      blastRadiusTtlSeconds: 120,
      keyPrefix: 'test-rollup-cache',
      enabled: true,
    },
    version: 'v1' as const,
    enableLogging: false,
    enableMetrics: true,
  };
}

// ============================================================================
// Expired Metadata Generator
// ============================================================================

export function createExpiredCacheMetadata(tags: readonly CacheTag[] = []): CacheEntryMetadata {
  const now = new Date();
  return {
    cachedAt: new Date(now.getTime() - 7200000), // 2 hours ago
    expiresAt: new Date(now.getTime() - 3600000), // 1 hour ago (expired)
    ttlSeconds: 3600,
    source: 'computation',
    tags,
    formatVersion: 1,
  };
}
