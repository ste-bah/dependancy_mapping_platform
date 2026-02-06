/**
 * Test Helpers Module
 * @module tests/helpers
 *
 * Common utilities and helpers for integration testing.
 * Provides fixture loading, test data creation, and assertion helpers.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NodeType, GraphEdge, DependencyGraph } from '@/types/graph';
import type { Evidence, EvidenceCollection } from '@/types/evidence';
import type { ParsedFile } from '@/services/parser-orchestrator';
import type { ScanConfig } from '@/types/entities';

// ============================================================================
// Path Helpers
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the path to the fixtures directory
 */
export function getFixturesPath(): string {
  return join(__dirname, '..', 'fixtures');
}

/**
 * Get path to a specific fixture file
 */
export function getFixturePath(relativePath: string): string {
  return join(getFixturesPath(), relativePath);
}

// ============================================================================
// Fixture Loading
// ============================================================================

/**
 * Read a fixture file and return its contents
 */
export function readFixture(relativePath: string): string {
  const fullPath = getFixturePath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Fixture not found: ${relativePath} (resolved to ${fullPath})`);
  }

  return readFileSync(fullPath, 'utf-8');
}

/**
 * Read a JSON fixture file and parse it
 */
export function readJsonFixture<T>(relativePath: string): T {
  const content = readFixture(relativePath);
  return JSON.parse(content) as T;
}

/**
 * Check if a fixture file exists
 */
export function fixtureExists(relativePath: string): boolean {
  return existsSync(getFixturePath(relativePath));
}

/**
 * Read multiple fixtures as an array
 */
export function readFixtures(relativePaths: string[]): string[] {
  return relativePaths.map(path => readFixture(path));
}

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create a test scan configuration
 */
export function createTestScanConfig(overrides: Partial<ScanConfig> = {}): ScanConfig {
  return {
    detectTypes: ['terraform', 'kubernetes', 'helm'],
    includePatterns: ['**/*.tf', '**/*.yaml', '**/*.yml'],
    excludePatterns: ['**/node_modules/**', '**/.git/**'],
    detectImplicit: true,
    minConfidence: 50,
    maxDepth: 10,
    ...overrides,
  };
}

/**
 * Create mock parsed files from fixture paths
 */
export function createParsedFilesFromFixtures(
  fixturePaths: Array<{ path: string; type: 'terraform' | 'kubernetes' | 'helm' | 'cloudformation' | 'unknown' }>
): ParsedFile[] {
  return fixturePaths.map(({ path, type }) => ({
    path,
    type,
    ast: { blocks: [] }, // Minimal AST structure
    metadata: {
      parserName: `${type}-parser`,
      parserVersion: '1.0.0',
      parseTimeMs: 10,
      fileSize: 100,
      lineCount: 10,
      cached: false,
    },
  }));
}

/**
 * Create mock nodes for testing
 */
export interface CreateNodesOptions {
  resources?: number;
  modules?: number;
  dataSources?: number;
  variables?: number;
  outputs?: number;
  locals?: number;
}

export function createMockNodes(options: CreateNodesOptions = {}): NodeType[] {
  const {
    resources = 0,
    modules = 0,
    dataSources = 0,
    variables = 0,
    outputs = 0,
    locals = 0,
  } = options;

  const nodes: NodeType[] = [];

  // Create resources
  for (let i = 0; i < resources; i++) {
    nodes.push({
      type: 'terraform_resource',
      id: `aws_instance.instance_${i}`,
      name: `instance_${i}`,
      location: { file: 'main.tf', lineStart: i * 10 + 1, lineEnd: i * 10 + 8 },
      metadata: { resourceType: 'aws_instance', provider: 'aws' },
    });
  }

  // Create modules
  for (let i = 0; i < modules; i++) {
    nodes.push({
      type: 'terraform_module',
      id: `module.module_${i}`,
      name: `module_${i}`,
      location: { file: 'modules.tf', lineStart: i * 10 + 1, lineEnd: i * 10 + 8 },
      metadata: { source: `./modules/module_${i}` },
    });
  }

  // Create data sources
  for (let i = 0; i < dataSources; i++) {
    nodes.push({
      type: 'terraform_data',
      id: `data.aws_ami.ami_${i}`,
      name: `ami_${i}`,
      location: { file: 'data.tf', lineStart: i * 10 + 1, lineEnd: i * 10 + 8 },
      metadata: { dataType: 'aws_ami', provider: 'aws' },
    });
  }

  // Create variables
  for (let i = 0; i < variables; i++) {
    nodes.push({
      type: 'terraform_variable',
      id: `var.var_${i}`,
      name: `var_${i}`,
      location: { file: 'variables.tf', lineStart: i * 10 + 1, lineEnd: i * 10 + 8 },
      metadata: {},
    });
  }

  // Create outputs
  for (let i = 0; i < outputs; i++) {
    nodes.push({
      type: 'terraform_output',
      id: `output.output_${i}`,
      name: `output_${i}`,
      location: { file: 'outputs.tf', lineStart: i * 10 + 1, lineEnd: i * 10 + 8 },
      metadata: {},
    });
  }

  // Create locals
  for (let i = 0; i < locals; i++) {
    nodes.push({
      type: 'terraform_local',
      id: `local.local_${i}`,
      name: `local_${i}`,
      location: { file: 'locals.tf', lineStart: i * 10 + 1, lineEnd: i * 10 + 8 },
      metadata: {},
    });
  }

  return nodes;
}

/**
 * Create mock edges between nodes
 */
export function createMockEdges(
  nodes: NodeType[],
  edgeCount: number
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  if (nodes.length < 2) {
    return edges;
  }

  for (let i = 0; i < Math.min(edgeCount, nodes.length - 1); i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodes[i + 1].id,
      target: nodes[i].id,
      type: 'references',
      metadata: {
        implicit: false,
        confidence: 85,
      },
    });
  }

  return edges;
}

/**
 * Create a mock detection result
 */
export interface CreateDetectionResultOptions {
  nodeCount?: number;
  edgeCount?: number;
  withCycle?: boolean;
}

export function createMockDetectionResult(options: CreateDetectionResultOptions = {}): {
  nodes: NodeType[];
  edges: GraphEdge[];
} {
  const {
    nodeCount = 5,
    edgeCount = 4,
    withCycle = false,
  } = options;

  const nodes = createMockNodes({ resources: nodeCount });
  const edges = createMockEdges(nodes, edgeCount);

  if (withCycle && nodes.length >= 3) {
    // Add a cycle: last node references first node
    edges.push({
      id: `edge-cycle`,
      source: nodes[0].id,
      target: nodes[nodes.length - 1].id,
      type: 'references',
      metadata: { implicit: false, confidence: 80 },
    });
  }

  return { nodes, edges };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a graph contains expected nodes
 */
export function assertGraphHasNodes(
  graph: DependencyGraph,
  expectedNodeIds: string[]
): void {
  for (const nodeId of expectedNodeIds) {
    if (!graph.nodes.has(nodeId)) {
      throw new Error(`Graph missing expected node: ${nodeId}`);
    }
  }
}

/**
 * Assert that a graph contains expected edges
 */
export function assertGraphHasEdges(
  graph: DependencyGraph,
  expectedEdges: Array<{ source: string; target: string }>
): void {
  for (const expected of expectedEdges) {
    const hasEdge = graph.edges.some(
      e => e.source === expected.source && e.target === expected.target
    );
    if (!hasEdge) {
      throw new Error(
        `Graph missing expected edge: ${expected.source} -> ${expected.target}`
      );
    }
  }
}

/**
 * Assert that all edges have valid source and target nodes
 */
export function assertGraphIntegrity(graph: DependencyGraph): void {
  for (const edge of graph.edges) {
    if (!graph.nodes.has(edge.source)) {
      throw new Error(`Edge ${edge.id} has invalid source: ${edge.source}`);
    }
    if (!graph.nodes.has(edge.target)) {
      throw new Error(`Edge ${edge.id} has invalid target: ${edge.target}`);
    }
  }
}

/**
 * Assert that evidence collection has minimum items
 */
export function assertEvidenceMinCount(
  evidence: EvidenceCollection,
  minCount: number
): void {
  if (evidence.items.length < minCount) {
    throw new Error(
      `Expected at least ${minCount} evidence items, got ${evidence.items.length}`
    );
  }
}

/**
 * Get statistics from a graph for assertions
 */
export function getGraphStats(graph: DependencyGraph): {
  nodeCount: number;
  edgeCount: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
} {
  const nodeTypes: Record<string, number> = {};
  const edgeTypes: Record<string, number> = {};

  for (const node of graph.nodes.values()) {
    nodeTypes[node.type] = (nodeTypes[node.type] ?? 0) + 1;
  }

  for (const edge of graph.edges) {
    edgeTypes[edge.type] = (edgeTypes[edge.type] ?? 0) + 1;
  }

  return {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
    nodeTypes,
    edgeTypes,
  };
}

// ============================================================================
// Timing Helpers
// ============================================================================

/**
 * Measure execution time of an async function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

/**
 * Assert that operation completes within timeout
 */
export async function assertCompletesWithin<T>(
  fn: () => Promise<T>,
  maxMs: number
): Promise<T> {
  const { result, durationMs } = await measureTime(fn);

  if (durationMs > maxMs) {
    throw new Error(
      `Operation took ${durationMs.toFixed(2)}ms, expected under ${maxMs}ms`
    );
  }

  return result;
}

// ============================================================================
// Concurrency Helpers
// ============================================================================

/**
 * Run multiple async operations and collect results
 */
export async function runConcurrent<T>(
  operations: Array<() => Promise<T>>
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(operations.map(op => op()));
}

/**
 * Get counts of fulfilled and rejected promises
 */
export function countSettledResults<T>(
  results: PromiseSettledResult<T>[]
): { fulfilled: number; rejected: number } {
  let fulfilled = 0;
  let rejected = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      fulfilled++;
    } else {
      rejected++;
    }
  }

  return { fulfilled, rejected };
}

// ============================================================================
// Test Data Generation
// ============================================================================

/**
 * Generate a random string of specified length
 */
export function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${randomString(6)}`;
}

/**
 * Create a test timeout promise
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

/**
 * Race an operation against a timeout
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([operation, createTimeout(ms)]);
}
