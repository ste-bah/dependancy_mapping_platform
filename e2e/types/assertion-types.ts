/**
 * E2E Test Assertion Types
 * @module e2e/types/assertion-types
 *
 * Assertion helper type definitions:
 * - AssertionResult - Assertion outcome
 * - GraphAssertionConfig - Graph validation options
 * - PerformanceThreshold - Performance benchmarks
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #20 of 47 | Phase 4: Implementation
 */

import type { Brand } from '../../api/src/types/utility.js';
import type {
  GraphNodeFixture,
  GraphEdgeFixture,
  NodeType,
  EdgeType,
} from './fixture-types.js';
import type { TestResponse } from './api-types.js';

// ============================================================================
// Branded Types for Assertions
// ============================================================================

/**
 * Branded type for Assertion IDs
 */
export type AssertionId = Brand<string, 'AssertionId'>;

/**
 * Branded type for Benchmark IDs
 */
export type BenchmarkId = Brand<string, 'BenchmarkId'>;

/**
 * Create an AssertionId from a string
 */
export function createAssertionId(id: string): AssertionId {
  return id as AssertionId;
}

/**
 * Create a BenchmarkId from a string
 */
export function createBenchmarkId(id: string): BenchmarkId {
  return id as BenchmarkId;
}

// ============================================================================
// Assertion Result Types
// ============================================================================

/**
 * Generic assertion result
 */
export interface AssertionResult<T = unknown> {
  /** Whether assertion passed */
  readonly passed: boolean;
  /** Assertion ID */
  readonly id: AssertionId;
  /** Assertion name/description */
  readonly name: string;
  /** Expected value */
  readonly expected: T;
  /** Actual value */
  readonly actual: T;
  /** Error message if failed */
  readonly message?: string;
  /** Diff between expected and actual */
  readonly diff?: string;
  /** Assertion duration in milliseconds */
  readonly duration: number;
  /** Stack trace if failed */
  readonly stack?: string;
  /** Additional context */
  readonly context?: AssertionContext;
}

/**
 * Assertion context
 */
export interface AssertionContext {
  /** Test file */
  readonly file?: string;
  /** Test name */
  readonly testName?: string;
  /** Line number */
  readonly line?: number;
  /** Custom data */
  readonly data?: Readonly<Record<string, unknown>>;
}

/**
 * Compound assertion result (multiple assertions)
 */
export interface CompoundAssertionResult {
  /** Overall pass/fail */
  readonly passed: boolean;
  /** Individual assertion results */
  readonly assertions: ReadonlyArray<AssertionResult>;
  /** Summary statistics */
  readonly summary: AssertionSummary;
  /** Total duration */
  readonly duration: number;
}

/**
 * Assertion summary
 */
export interface AssertionSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

/**
 * Assertion error type
 */
export interface AssertionError {
  readonly name: 'AssertionError';
  readonly message: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly operator: AssertionOperator;
  readonly stack?: string;
  readonly generatedMessage: boolean;
}

/**
 * Assertion operators
 */
export type AssertionOperator =
  | 'strictEqual'
  | 'deepStrictEqual'
  | 'notStrictEqual'
  | 'notDeepStrictEqual'
  | 'toBe'
  | 'toEqual'
  | 'toContain'
  | 'toMatch'
  | 'toBeGreaterThan'
  | 'toBeLessThan'
  | 'toBeDefined'
  | 'toBeUndefined'
  | 'toBeNull'
  | 'toBeTruthy'
  | 'toBeFalsy'
  | 'toHaveLength'
  | 'toHaveProperty'
  | 'toThrow';

// ============================================================================
// Graph Assertion Types
// ============================================================================

/**
 * Graph assertion configuration
 */
export interface GraphAssertionConfig {
  /** Allow additional nodes not in expected set */
  readonly allowExtraNodes: boolean;
  /** Allow additional edges not in expected set */
  readonly allowExtraEdges: boolean;
  /** Ignore node metadata in comparison */
  readonly ignoreMetadata: boolean;
  /** Ignore edge confidence values */
  readonly ignoreConfidence: boolean;
  /** Ignore line numbers in comparison */
  readonly ignoreLineNumbers: boolean;
  /** Confidence tolerance for comparison */
  readonly confidenceTolerance: number;
  /** Custom node comparator */
  readonly nodeComparator?: NodeComparator;
  /** Custom edge comparator */
  readonly edgeComparator?: EdgeComparator;
}

/**
 * Default graph assertion configuration
 */
export const DEFAULT_GRAPH_ASSERTION_CONFIG: GraphAssertionConfig = {
  allowExtraNodes: false,
  allowExtraEdges: false,
  ignoreMetadata: false,
  ignoreConfidence: false,
  ignoreLineNumbers: false,
  confidenceTolerance: 0.01,
};

/**
 * Node comparator function type
 */
export type NodeComparator = (
  actual: GraphNodeFixture,
  expected: Partial<GraphNodeFixture>
) => boolean;

/**
 * Edge comparator function type
 */
export type EdgeComparator = (
  actual: GraphEdgeFixture,
  expected: Partial<GraphEdgeFixture>
) => boolean;

/**
 * Graph structure for assertions
 */
export interface GraphStructure {
  readonly nodes: ReadonlyArray<GraphNodeFixture>;
  readonly edges: ReadonlyArray<GraphEdgeFixture>;
}

/**
 * Graph assertion result
 */
export interface GraphAssertionResult extends AssertionResult<GraphStructure> {
  /** Node assertion details */
  readonly nodeAssertions: NodeAssertionDetails;
  /** Edge assertion details */
  readonly edgeAssertions: EdgeAssertionDetails;
  /** Structural assertions */
  readonly structuralAssertions: StructuralAssertionDetails;
}

/**
 * Node assertion details
 */
export interface NodeAssertionDetails {
  /** Total expected nodes */
  readonly expectedCount: number;
  /** Total actual nodes */
  readonly actualCount: number;
  /** Missing nodes */
  readonly missing: ReadonlyArray<GraphNodeFixture>;
  /** Extra nodes (unexpected) */
  readonly extra: ReadonlyArray<GraphNodeFixture>;
  /** Mismatched nodes */
  readonly mismatched: ReadonlyArray<NodeMismatch>;
}

/**
 * Node mismatch
 */
export interface NodeMismatch {
  readonly nodeId: string;
  readonly expected: Partial<GraphNodeFixture>;
  readonly actual: GraphNodeFixture;
  readonly differences: ReadonlyArray<PropertyDifference>;
}

/**
 * Property difference
 */
export interface PropertyDifference {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

/**
 * Edge assertion details
 */
export interface EdgeAssertionDetails {
  /** Total expected edges */
  readonly expectedCount: number;
  /** Total actual edges */
  readonly actualCount: number;
  /** Missing edges */
  readonly missing: ReadonlyArray<GraphEdgeFixture>;
  /** Extra edges (unexpected) */
  readonly extra: ReadonlyArray<GraphEdgeFixture>;
  /** Mismatched edges */
  readonly mismatched: ReadonlyArray<EdgeMismatch>;
  /** Invalid references (edges pointing to non-existent nodes) */
  readonly invalidReferences: ReadonlyArray<InvalidEdgeReference>;
}

/**
 * Edge mismatch
 */
export interface EdgeMismatch {
  readonly edgeId: string;
  readonly expected: Partial<GraphEdgeFixture>;
  readonly actual: GraphEdgeFixture;
  readonly differences: ReadonlyArray<PropertyDifference>;
}

/**
 * Invalid edge reference
 */
export interface InvalidEdgeReference {
  readonly edgeId: string;
  readonly invalidField: 'sourceNodeId' | 'targetNodeId';
  readonly invalidNodeId: string;
}

/**
 * Structural assertion details
 */
export interface StructuralAssertionDetails {
  /** Whether graph is acyclic */
  readonly isAcyclic: boolean;
  /** Cycles detected (if not acyclic) */
  readonly cycles: ReadonlyArray<ReadonlyArray<string>>;
  /** Connected components count */
  readonly connectedComponents: number;
  /** Max depth */
  readonly maxDepth: number;
  /** Graph density */
  readonly density: number;
  /** Isolated nodes (no edges) */
  readonly isolatedNodes: ReadonlyArray<string>;
}

// ============================================================================
// API Response Assertion Types
// ============================================================================

/**
 * API response assertion options
 */
export interface ApiAssertionOptions {
  /** Expected status code */
  readonly expectedStatus?: number;
  /** Expected status codes (any match) */
  readonly expectedStatuses?: ReadonlyArray<number>;
  /** Expected body properties */
  readonly expectedBody?: Readonly<Record<string, unknown>>;
  /** Expected headers */
  readonly expectedHeaders?: Readonly<Record<string, string | RegExp>>;
  /** Expected content type */
  readonly expectedContentType?: string;
  /** Schema to validate against */
  readonly schema?: unknown;
  /** Ignore extra body properties */
  readonly ignoreExtraProperties?: boolean;
}

/**
 * API assertion result
 */
export interface ApiAssertionResult<T = unknown> extends AssertionResult<TestResponse<T>> {
  /** Status code assertion */
  readonly statusAssertion: AssertionResult<number>;
  /** Body assertion */
  readonly bodyAssertion?: AssertionResult<T>;
  /** Header assertions */
  readonly headerAssertions: ReadonlyArray<HeaderAssertionResult>;
  /** Schema validation result */
  readonly schemaValidation?: SchemaValidationResult;
}

/**
 * Header assertion result
 */
export interface HeaderAssertionResult extends AssertionResult<string> {
  readonly headerName: string;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<SchemaValidationError>;
}

/**
 * Schema validation error
 */
export interface SchemaValidationError {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/**
 * Error response assertion options
 */
export interface ErrorAssertionOptions {
  /** Expected error code */
  readonly expectedCode?: string;
  /** Expected error message (exact or regex) */
  readonly expectedMessage?: string | RegExp;
  /** Expected error field */
  readonly expectedField?: string;
  /** Expected details */
  readonly expectedDetails?: Readonly<Record<string, unknown>>;
}

/**
 * Pagination assertion options
 */
export interface PaginationAssertionOptions {
  /** Minimum items in response */
  readonly minItems?: number;
  /** Maximum items in response */
  readonly maxItems?: number;
  /** Expected page number */
  readonly expectedPage?: number;
  /** Expected page size */
  readonly expectedPageSize?: number;
  /** Expected total items */
  readonly expectedTotal?: number;
  /** Expected total pages */
  readonly expectedTotalPages?: number;
  /** Assert has next page */
  readonly hasNext?: boolean;
  /** Assert has previous page */
  readonly hasPrevious?: boolean;
}

// ============================================================================
// Performance Assertion Types
// ============================================================================

/**
 * Performance threshold configuration
 */
export interface PerformanceThreshold {
  /** Threshold name/description */
  readonly name: string;
  /** Maximum allowed duration in milliseconds */
  readonly maxDurationMs: number;
  /** Warning threshold (optional, less than max) */
  readonly warnDurationMs?: number;
  /** Percentile to measure (e.g., p95, p99) */
  readonly percentile?: number;
  /** Whether to warn instead of fail */
  readonly warnOnly?: boolean;
  /** Custom comparator */
  readonly comparator?: ThresholdComparator;
}

/**
 * Threshold comparator function
 */
export type ThresholdComparator = (
  actual: number,
  threshold: number
) => boolean;

/**
 * Performance assertion options
 */
export interface PerformanceAssertionOptions extends PerformanceThreshold {
  /** Description for error messages */
  readonly description?: string;
  /** Collect samples for percentile calculation */
  readonly collectSamples?: boolean;
  /** Number of samples to collect */
  readonly sampleCount?: number;
  /** Warmup runs before measuring */
  readonly warmupRuns?: number;
}

/**
 * Performance assertion result
 */
export interface PerformanceAssertionResult extends AssertionResult<number> {
  /** Actual duration in milliseconds */
  readonly duration: number;
  /** Threshold that was applied */
  readonly threshold: PerformanceThreshold;
  /** Whether this was a warning */
  readonly isWarning: boolean;
  /** Samples collected (if applicable) */
  readonly samples?: ReadonlyArray<number>;
  /** Statistics (if samples collected) */
  readonly statistics?: PerformanceStatistics;
}

/**
 * Performance statistics
 */
export interface PerformanceStatistics {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
  readonly standardDeviation: number;
  readonly variance: number;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  /** Benchmark ID */
  readonly id: BenchmarkId;
  /** Benchmark name */
  readonly name: string;
  /** Description */
  readonly description?: string;
  /** Number of iterations */
  readonly iterations: number;
  /** Warmup iterations */
  readonly warmupIterations: number;
  /** Thresholds to apply */
  readonly thresholds: ReadonlyArray<PerformanceThreshold>;
  /** Timeout per iteration */
  readonly timeout: number;
  /** Whether to run in isolation */
  readonly isolated: boolean;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark configuration */
  readonly config: BenchmarkConfig;
  /** Overall pass/fail */
  readonly passed: boolean;
  /** Iteration results */
  readonly iterations: ReadonlyArray<IterationResult>;
  /** Aggregated statistics */
  readonly statistics: PerformanceStatistics;
  /** Threshold results */
  readonly thresholdResults: ReadonlyArray<PerformanceAssertionResult>;
  /** Total duration */
  readonly totalDuration: number;
}

/**
 * Iteration result
 */
export interface IterationResult {
  readonly iteration: number;
  readonly duration: number;
  readonly success: boolean;
  readonly error?: string;
}

// ============================================================================
// Database Assertion Types
// ============================================================================

/**
 * Database assertion options
 */
export interface DatabaseAssertionOptions {
  /** Query timeout in milliseconds */
  readonly timeout?: number;
  /** Retry configuration */
  readonly retry?: RetryConfig;
  /** Expected row count */
  readonly expectedCount?: number;
  /** Expected data shape */
  readonly expectedShape?: Readonly<Record<string, unknown>>;
  /** Custom validator */
  readonly validator?: (rows: unknown[]) => boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxRetries: number;
  readonly delay: number;
  readonly backoffMultiplier: number;
}

/**
 * Database assertion result
 */
export interface DatabaseAssertionResult extends AssertionResult<unknown[]> {
  /** Query executed */
  readonly query: string;
  /** Parameters used */
  readonly params: ReadonlyArray<unknown>;
  /** Row count */
  readonly rowCount: number;
  /** Query duration */
  readonly queryDuration: number;
}

// ============================================================================
// Evidence Assertion Types
// ============================================================================

/**
 * Evidence assertion options
 */
export interface EvidenceAssertionOptions {
  /** Required evidence fields */
  readonly requiredFields: ReadonlyArray<string>;
  /** Validate source file exists */
  readonly validateSourceFile?: boolean;
  /** Validate target file exists */
  readonly validateTargetFile?: boolean;
  /** Validate expression format */
  readonly validateExpression?: RegExp;
}

/**
 * Location assertion options
 */
export interface LocationAssertionOptions {
  /** Expected file path pattern */
  readonly filePattern?: RegExp;
  /** Minimum line number */
  readonly minLine?: number;
  /** Maximum line number */
  readonly maxLine?: number;
  /** Validate line exists in file */
  readonly validateLineExists?: boolean;
}

// ============================================================================
// Custom Assertion Types
// ============================================================================

/**
 * Custom assertion function type
 */
export type CustomAssertion<T, TOptions = Record<string, unknown>> = (
  actual: T,
  options?: TOptions
) => AssertionResult<T>;

/**
 * Async custom assertion function type
 */
export type AsyncCustomAssertion<T, TOptions = Record<string, unknown>> = (
  actual: T,
  options?: TOptions
) => Promise<AssertionResult<T>>;

/**
 * Assertion chain interface
 */
export interface AssertionChain<T> {
  /** Chain another assertion */
  and(assertion: CustomAssertion<T>): AssertionChain<T>;
  /** Execute all assertions */
  execute(): CompoundAssertionResult;
  /** Execute all assertions async */
  executeAsync(): Promise<CompoundAssertionResult>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for AssertionResult
 */
export function isAssertionResult<T>(value: unknown): value is AssertionResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'passed' in value &&
    'id' in value &&
    'expected' in value &&
    'actual' in value
  );
}

/**
 * Type guard for GraphAssertionResult
 */
export function isGraphAssertionResult(value: unknown): value is GraphAssertionResult {
  return (
    isAssertionResult(value) &&
    'nodeAssertions' in value &&
    'edgeAssertions' in value
  );
}

/**
 * Type guard for PerformanceAssertionResult
 */
export function isPerformanceAssertionResult(value: unknown): value is PerformanceAssertionResult {
  return (
    isAssertionResult(value) &&
    'threshold' in value &&
    'isWarning' in value
  );
}

/**
 * Type guard for AssertionError
 */
export function isAssertionError(value: unknown): value is AssertionError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    (value as AssertionError).name === 'AssertionError' &&
    'message' in value &&
    'expected' in value &&
    'actual' in value
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract assertion value type
 */
export type AssertionValue<T extends AssertionResult<unknown>> = T extends AssertionResult<infer V> ? V : never;

/**
 * Assertion builder options
 */
export interface AssertionBuilderOptions {
  readonly failFast: boolean;
  readonly collectAll: boolean;
  readonly verbose: boolean;
}

/**
 * Default assertion builder options
 */
export const DEFAULT_ASSERTION_BUILDER_OPTIONS: AssertionBuilderOptions = {
  failFast: false,
  collectAll: true,
  verbose: false,
};
