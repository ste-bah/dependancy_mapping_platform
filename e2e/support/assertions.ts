/**
 * E2E Test Assertions
 * @module e2e/support/assertions
 *
 * Provides custom assertion helpers for E2E tests:
 * - GraphAssertion helpers for graph validation
 * - API response assertions
 * - Database state assertions
 * - Performance assertions
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { expect } from 'vitest';
import type { TestResponse } from './test-context.js';
import type { GraphNodeFixture, GraphEdgeFixture } from './fixtures.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Graph assertion options
 */
export interface GraphAssertionOptions {
  /** Allow additional nodes not in expected set */
  allowExtraNodes?: boolean;
  /** Allow additional edges not in expected set */
  allowExtraEdges?: boolean;
  /** Ignore node metadata in comparison */
  ignoreMetadata?: boolean;
  /** Ignore edge confidence values */
  ignoreConfidence?: boolean;
}

/**
 * Graph structure for assertions
 */
export interface GraphStructure {
  readonly nodes: GraphNodeFixture[];
  readonly edges: GraphEdgeFixture[];
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Pagination response structure
 */
export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrevious: boolean;
  };
}

/**
 * Performance assertion options
 */
export interface PerformanceAssertionOptions {
  /** Maximum allowed duration in milliseconds */
  maxDurationMs: number;
  /** Description for error messages */
  description?: string;
  /** Warn instead of fail for performance issues */
  warnOnly?: boolean;
}

// ============================================================================
// Graph Assertions
// ============================================================================

/**
 * Graph assertion builder
 */
export class GraphAssertion {
  private readonly actual: GraphStructure;
  private options: GraphAssertionOptions = {};

  constructor(actual: GraphStructure) {
    this.actual = actual;
  }

  /**
   * Set assertion options
   */
  withOptions(options: GraphAssertionOptions): GraphAssertion {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Assert node count
   */
  hasNodeCount(expected: number): GraphAssertion {
    expect(this.actual.nodes.length).toBe(expected);
    return this;
  }

  /**
   * Assert minimum node count
   */
  hasAtLeastNodes(minimum: number): GraphAssertion {
    expect(this.actual.nodes.length).toBeGreaterThanOrEqual(minimum);
    return this;
  }

  /**
   * Assert edge count
   */
  hasEdgeCount(expected: number): GraphAssertion {
    expect(this.actual.edges.length).toBe(expected);
    return this;
  }

  /**
   * Assert minimum edge count
   */
  hasAtLeastEdges(minimum: number): GraphAssertion {
    expect(this.actual.edges.length).toBeGreaterThanOrEqual(minimum);
    return this;
  }

  /**
   * Assert graph contains a node with given properties
   */
  containsNode(
    properties: Partial<GraphNodeFixture>
  ): GraphAssertion {
    const found = this.actual.nodes.some((node) =>
      this.nodeMatches(node, properties)
    );
    expect(found).toBe(true);
    return this;
  }

  /**
   * Assert graph does not contain a node with given properties
   */
  doesNotContainNode(
    properties: Partial<GraphNodeFixture>
  ): GraphAssertion {
    const found = this.actual.nodes.some((node) =>
      this.nodeMatches(node, properties)
    );
    expect(found).toBe(false);
    return this;
  }

  /**
   * Assert graph contains an edge with given properties
   */
  containsEdge(
    properties: Partial<GraphEdgeFixture>
  ): GraphAssertion {
    const found = this.actual.edges.some((edge) =>
      this.edgeMatches(edge, properties)
    );
    expect(found).toBe(true);
    return this;
  }

  /**
   * Assert edge exists between two nodes
   */
  hasEdgeBetween(
    sourceId: string,
    targetId: string,
    edgeType?: string
  ): GraphAssertion {
    const found = this.actual.edges.some(
      (edge) =>
        edge.sourceNodeId === sourceId &&
        edge.targetNodeId === targetId &&
        (edgeType === undefined || edge.type === edgeType)
    );
    expect(found).toBe(true);
    return this;
  }

  /**
   * Assert graph has specific node types
   */
  hasNodeTypes(expectedTypes: string[]): GraphAssertion {
    const actualTypes = new Set(this.actual.nodes.map((n) => n.type));
    for (const type of expectedTypes) {
      expect(actualTypes.has(type)).toBe(true);
    }
    return this;
  }

  /**
   * Assert graph matches expected structure
   */
  matchesStructure(
    expected: GraphStructure,
    options?: GraphAssertionOptions
  ): GraphAssertion {
    const opts = { ...this.options, ...options };

    // Compare nodes
    if (!opts.allowExtraNodes) {
      expect(this.actual.nodes.length).toBe(expected.nodes.length);
    } else {
      expect(this.actual.nodes.length).toBeGreaterThanOrEqual(
        expected.nodes.length
      );
    }

    for (const expectedNode of expected.nodes) {
      const found = this.actual.nodes.some((node) =>
        this.nodeMatches(node, expectedNode, opts.ignoreMetadata)
      );
      expect(found).toBe(true);
    }

    // Compare edges
    if (!opts.allowExtraEdges) {
      expect(this.actual.edges.length).toBe(expected.edges.length);
    } else {
      expect(this.actual.edges.length).toBeGreaterThanOrEqual(
        expected.edges.length
      );
    }

    for (const expectedEdge of expected.edges) {
      const found = this.actual.edges.some((edge) =>
        this.edgeMatches(edge, expectedEdge, opts.ignoreConfidence)
      );
      expect(found).toBe(true);
    }

    return this;
  }

  /**
   * Assert all nodes have required fields
   */
  allNodesHaveFields(fields: Array<keyof GraphNodeFixture>): GraphAssertion {
    for (const node of this.actual.nodes) {
      for (const field of fields) {
        expect(node[field]).toBeDefined();
      }
    }
    return this;
  }

  /**
   * Assert all edges have valid node references
   */
  allEdgesHaveValidReferences(): GraphAssertion {
    const nodeIds = new Set(this.actual.nodes.map((n) => n.id));
    for (const edge of this.actual.edges) {
      expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
      expect(nodeIds.has(edge.targetNodeId)).toBe(true);
    }
    return this;
  }

  /**
   * Assert graph is acyclic (no circular dependencies)
   */
  isAcyclic(): GraphAssertion {
    const hasCycle = this.detectCycle();
    expect(hasCycle).toBe(false);
    return this;
  }

  /**
   * Check if node matches expected properties
   */
  private nodeMatches(
    actual: GraphNodeFixture,
    expected: Partial<GraphNodeFixture>,
    ignoreMetadata = false
  ): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (ignoreMetadata && key === 'metadata') continue;
      if (key === 'metadata' && value) {
        // Deep compare metadata
        if (!this.metadataMatches(actual.metadata, value as Record<string, unknown>)) {
          return false;
        }
      } else if (actual[key as keyof GraphNodeFixture] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if edge matches expected properties
   */
  private edgeMatches(
    actual: GraphEdgeFixture,
    expected: Partial<GraphEdgeFixture>,
    ignoreConfidence = false
  ): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (ignoreConfidence && key === 'confidence') continue;
      if (actual[key as keyof GraphEdgeFixture] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if metadata matches
   */
  private metadataMatches(
    actual: Record<string, unknown>,
    expected: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Detect cycles in the graph using DFS
   */
  private detectCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const adjacency = new Map<string, string[]>();
    for (const edge of this.actual.edges) {
      if (!adjacency.has(edge.sourceNodeId)) {
        adjacency.set(edge.sourceNodeId, []);
      }
      adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    }

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of this.actual.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }
}

// ============================================================================
// API Response Assertions
// ============================================================================

/**
 * Assert API response is successful (2xx)
 */
export function assertSuccessResponse<T>(
  response: TestResponse<T>
): TestResponse<T> {
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  return response;
}

/**
 * Assert API response is a specific error
 */
export function assertErrorResponse(
  response: TestResponse<ApiErrorResponse>,
  expectedStatus: number,
  expectedCode?: string
): void {
  expect(response.statusCode).toBe(expectedStatus);
  if (expectedCode) {
    expect(response.body.code).toBe(expectedCode);
  }
}

/**
 * Assert paginated response structure
 */
export function assertPaginatedResponse<T>(
  response: TestResponse<PaginatedResponse<T>>,
  options?: {
    minItems?: number;
    maxItems?: number;
    page?: number;
    totalPages?: number;
  }
): void {
  const body = response.body;

  expect(body.data).toBeInstanceOf(Array);
  expect(body.pagination).toBeDefined();
  expect(typeof body.pagination.page).toBe('number');
  expect(typeof body.pagination.pageSize).toBe('number');
  expect(typeof body.pagination.total).toBe('number');
  expect(typeof body.pagination.totalPages).toBe('number');
  expect(typeof body.pagination.hasNext).toBe('boolean');
  expect(typeof body.pagination.hasPrevious).toBe('boolean');

  if (options?.minItems !== undefined) {
    expect(body.data.length).toBeGreaterThanOrEqual(options.minItems);
  }
  if (options?.maxItems !== undefined) {
    expect(body.data.length).toBeLessThanOrEqual(options.maxItems);
  }
  if (options?.page !== undefined) {
    expect(body.pagination.page).toBe(options.page);
  }
  if (options?.totalPages !== undefined) {
    expect(body.pagination.totalPages).toBe(options.totalPages);
  }
}

/**
 * Assert response contains specific headers
 */
export function assertResponseHeaders(
  response: TestResponse<unknown>,
  expectedHeaders: Record<string, string | RegExp>
): void {
  for (const [name, value] of Object.entries(expectedHeaders)) {
    const actualValue = response.headers[name.toLowerCase()];
    expect(actualValue).toBeDefined();

    if (typeof value === 'string') {
      expect(actualValue).toBe(value);
    } else {
      expect(String(actualValue)).toMatch(value);
    }
  }
}

// ============================================================================
// Performance Assertions
// ============================================================================

/**
 * Assert operation completes within time limit
 */
export async function assertPerformance<T>(
  operation: () => Promise<T>,
  options: PerformanceAssertionOptions
): Promise<T> {
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;

  const description = options.description ?? 'Operation';

  if (duration > options.maxDurationMs) {
    const message = `${description} took ${duration.toFixed(2)}ms, expected max ${options.maxDurationMs}ms`;
    if (options.warnOnly) {
      console.warn(`Performance warning: ${message}`);
    } else {
      throw new Error(message);
    }
  }

  return result;
}

/**
 * Measure and log operation duration
 */
export async function measureDuration<T>(
  operation: () => Promise<T>,
  label: string
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await operation();
  const durationMs = performance.now() - start;

  console.log(`[PERF] ${label}: ${durationMs.toFixed(2)}ms`);

  return { result, durationMs };
}

// ============================================================================
// Database Assertions
// ============================================================================

/**
 * Assert record exists in database
 */
export async function assertRecordExists(
  query: () => Promise<unknown[]>,
  message?: string
): Promise<void> {
  const results = await query();
  expect(results.length).toBeGreaterThan(0);
}

/**
 * Assert record does not exist in database
 */
export async function assertRecordNotExists(
  query: () => Promise<unknown[]>,
  message?: string
): Promise<void> {
  const results = await query();
  expect(results.length).toBe(0);
}

/**
 * Assert record count in database
 */
export async function assertRecordCount(
  query: () => Promise<unknown[]>,
  expectedCount: number
): Promise<void> {
  const results = await query();
  expect(results.length).toBe(expectedCount);
}

// ============================================================================
// Evidence Assertions
// ============================================================================

/**
 * Assert edge has valid evidence
 */
export function assertEdgeEvidence(
  edge: GraphEdgeFixture,
  requiredFields: string[]
): void {
  expect(edge.evidence).toBeDefined();
  for (const field of requiredFields) {
    expect(edge.evidence[field]).toBeDefined();
  }
}

/**
 * Assert node has valid location
 */
export function assertNodeLocation(node: GraphNodeFixture): void {
  expect(node.filePath).toBeDefined();
  expect(node.filePath.length).toBeGreaterThan(0);
  expect(node.lineStart).toBeGreaterThan(0);
  expect(node.lineEnd).toBeGreaterThanOrEqual(node.lineStart);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a graph assertion builder
 */
export function assertGraph(graph: GraphStructure): GraphAssertion {
  return new GraphAssertion(graph);
}

/**
 * Create graph from nodes and edges
 */
export function createGraphStructure(
  nodes: GraphNodeFixture[],
  edges: GraphEdgeFixture[]
): GraphStructure {
  return { nodes, edges };
}

// ============================================================================
// Exports
// ============================================================================

export {
  GraphAssertionOptions,
  GraphStructure,
  ApiErrorResponse,
  PaginatedResponse,
  PerformanceAssertionOptions,
  GraphAssertion,
};
