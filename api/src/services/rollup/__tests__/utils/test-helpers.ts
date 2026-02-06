/**
 * Test Helpers
 * @module services/rollup/__tests__/utils/test-helpers
 *
 * Common test utilities for rollup tests.
 */

import { vi, type Mock, type MockInstance } from 'vitest';
import type { IMatcherFactory, IMergeEngine, IBlastRadiusEngine, IMatcher, MatchCandidate, MergeInput, MergeOutput, ConfigurationValidationResult } from '../../interfaces.js';
import type { IRollupEventEmitter, RollupEvent } from '../../rollup-event-emitter.js';
import type { MatchingStrategy, MatchResult, BlastRadiusQuery, BlastRadiusResponse, RollupExecutionId, MatcherConfig, MergedNode } from '../../../../types/rollup.js';
import type { NodeType, DependencyGraph, GraphEdge } from '../../../../types/graph.js';
import type { RepositoryId, ScanId } from '../../../../types/entities.js';
import { createEmptyGraph, createTerraformResourceNode } from '../fixtures/graph-fixtures.js';

// ============================================================================
// Mock Matcher
// ============================================================================

export function createMockMatcher(
  strategy: MatchingStrategy = 'arn',
  overrides: Partial<IMatcher> = {}
): IMatcher {
  return {
    strategy,
    config: {
      type: strategy,
      enabled: true,
      priority: 50,
      minConfidence: 80,
    } as MatcherConfig,
    extractCandidates: vi.fn().mockReturnValue([]),
    compare: vi.fn().mockReturnValue(null),
    validateConfig: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
    }),
    isEnabled: vi.fn().mockReturnValue(true),
    getPriority: vi.fn().mockReturnValue(50),
    ...overrides,
  };
}

// ============================================================================
// Mock Matcher Factory
// ============================================================================

export function createMockMatcherFactory(
  matchers: IMatcher[] = []
): IMatcherFactory {
  const defaultMatchers = matchers.length > 0 ? matchers : [createMockMatcher()];

  return {
    createMatcher: vi.fn().mockImplementation((config: MatcherConfig) => {
      const matcher = defaultMatchers.find(m => m.strategy === config.type);
      return matcher ?? createMockMatcher(config.type);
    }),
    createMatchers: vi.fn().mockReturnValue(defaultMatchers),
    getAvailableTypes: vi.fn().mockReturnValue(['arn', 'resource_id', 'name', 'tag']),
  };
}

// ============================================================================
// Mock Merge Engine
// ============================================================================

export function createMockMergeEngine(
  mergeOutput?: Partial<MergeOutput>
): IMergeEngine {
  const defaultOutput: MergeOutput = {
    mergedNodes: [],
    edges: [],
    unmatchedNodes: [],
    stats: {
      nodesBeforeMerge: 0,
      nodesAfterMerge: 0,
      edgesBeforeMerge: 0,
      edgesAfterMerge: 0,
      crossRepoEdges: 0,
      conflicts: 0,
      conflictsResolved: 0,
    },
    ...mergeOutput,
  };

  return {
    merge: vi.fn().mockReturnValue(defaultOutput),
    validateInput: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
    }),
  };
}

// ============================================================================
// Mock Blast Radius Engine
// ============================================================================

export function createMockBlastRadiusEngine(
  response?: Partial<BlastRadiusResponse>
): IBlastRadiusEngine & { registerGraph: Mock } {
  const defaultResponse: BlastRadiusResponse = {
    query: { nodeIds: [], maxDepth: 5, includeCrossRepo: true, includeIndirect: true },
    rollupId: '',
    executionId: '' as RollupExecutionId,
    directImpact: [],
    indirectImpact: [],
    crossRepoImpact: [],
    summary: {
      totalImpacted: 0,
      directCount: 0,
      indirectCount: 0,
      crossRepoCount: 0,
      impactByType: {},
      impactByRepo: {},
      impactByDepth: {},
      riskLevel: 'low',
    },
    ...response,
  };

  return {
    analyze: vi.fn().mockResolvedValue(defaultResponse),
    getCached: vi.fn().mockResolvedValue(null),
    registerGraph: vi.fn(),
  };
}

// ============================================================================
// Mock Event Emitter
// ============================================================================

export function createMockEventEmitter(): IRollupEventEmitter {
  const listeners = new Map<string, Set<(event: RollupEvent) => void>>();

  return {
    emit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockImplementation((type: string, handler: (event: RollupEvent) => void) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)!.add(handler);
      return () => listeners.get(type)?.delete(handler);
    }),
    off: vi.fn().mockImplementation((type: string, handler: (event: RollupEvent) => void) => {
      listeners.get(type)?.delete(handler);
    }),
    removeAllListeners: vi.fn().mockImplementation((type?: string) => {
      if (type) {
        listeners.delete(type);
      } else {
        listeners.clear();
      }
    }),
  };
}

// ============================================================================
// Mock Graph Service
// ============================================================================

export interface MockGraphService {
  getGraphByScanId: Mock;
}

export function createMockGraphService(
  graphs?: Map<string, DependencyGraph>
): MockGraphService {
  const graphMap = graphs ?? new Map();

  return {
    getGraphByScanId: vi.fn().mockImplementation((tenantId: string, scanId: string) => {
      return graphMap.get(scanId) ?? createEmptyGraph();
    }),
  };
}

// ============================================================================
// Test Data Generators
// ============================================================================

export function generateNodes(
  count: number,
  options: {
    withArn?: boolean;
    withTags?: boolean;
    resourceType?: string;
  } = {}
): NodeType[] {
  const nodes: NodeType[] = [];
  const { withArn = true, withTags = true, resourceType = 'aws_s3_bucket' } = options;

  for (let i = 0; i < count; i++) {
    const metadata: Record<string, unknown> = {
      id: `resource-${i}`,
    };

    if (withArn) {
      metadata.arn = `arn:aws:s3:::bucket-${i}`;
    }

    if (withTags) {
      metadata.tags = {
        Environment: i % 2 === 0 ? 'production' : 'staging',
        Project: `project-${Math.floor(i / 5)}`,
      };
    }

    nodes.push(createTerraformResourceNode({
      id: `node_${i}`,
      name: `${resourceType}.resource_${i}`,
      resourceType,
      metadata,
    }));
  }

  return nodes;
}

export function generateMatchCandidates(
  nodes: NodeType[],
  repositoryId: RepositoryId,
  scanId: ScanId
): MatchCandidate[] {
  return nodes.map((node) => ({
    node,
    repositoryId,
    scanId,
    matchKey: node.metadata.arn as string ?? node.name,
    attributes: {
      nodeType: node.type,
      nodeName: node.name,
      file: node.location.file,
    },
  }));
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export function expectValidationError(
  result: ConfigurationValidationResult,
  errorCode: string
): void {
  expect(result.isValid).toBe(false);
  expect(result.errors.some((e) => e.code === errorCode)).toBe(true);
}

export function expectValidationWarning(
  result: ConfigurationValidationResult,
  warningCode: string
): void {
  expect(result.warnings.some((w) => w.code === warningCode)).toBe(true);
}

export function expectNoValidationErrors(
  result: ConfigurationValidationResult
): void {
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
}

export function expectMatchResult(
  match: MatchResult | null,
  expectedStrategy: MatchingStrategy,
  minConfidence: number
): void {
  expect(match).not.toBeNull();
  expect(match!.strategy).toBe(expectedStrategy);
  expect(match!.confidence).toBeGreaterThanOrEqual(minConfidence);
}

// ============================================================================
// Timing Helpers
// ============================================================================

export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

export function createDelayedPromise<T>(value: T, delayMs: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delayMs);
  });
}

// ============================================================================
// Mock Cleanup
// ============================================================================

export function resetAllMocks(...mocks: Array<Mock | MockInstance | { [key: string]: Mock }>): void {
  for (const mock of mocks) {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    } else if (typeof mock === 'object') {
      for (const key of Object.keys(mock)) {
        if (typeof mock[key] === 'function' && 'mockClear' in mock[key]) {
          mock[key].mockClear();
        }
      }
    }
  }
}

// ============================================================================
// Environment Helpers
// ============================================================================

export function setupTestEnvironment(): void {
  // Set test timeouts
  vi.setConfig({ testTimeout: 10000 });
}

export function cleanupTestEnvironment(): void {
  vi.restoreAllMocks();
  vi.clearAllTimers();
}
