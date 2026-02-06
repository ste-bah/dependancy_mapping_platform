/**
 * Rollup Tracing Module
 * @module services/rollup/tracing
 *
 * OpenTelemetry distributed tracing for Cross-Repository Aggregation (Rollup) operations.
 * Provides span creation, trace context propagation, and domain-specific tracing utilities.
 *
 * Features:
 * - OpenTelemetry span creation for rollup operations
 * - Trace context propagation across service boundaries
 * - Span attributes for rollup-specific metadata
 * - Error recording and status management
 * - Phase-based execution tracing
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation tracing implementation
 */

import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
  Context,
  Attributes,
  AttributeValue,
} from '@opentelemetry/api';
import {
  getTracer,
  getActiveSpan,
  startSpan,
  withSpanAsync,
  recordException,
  addSpanAttributes,
  addSpanEvent,
  getTraceContext,
} from '../../logging/tracing.js';
import { TenantId, ScanId, RepositoryId } from '../../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  MatchingStrategy,
} from '../../types/rollup.js';
import { isRollupError } from './errors.js';

// ============================================================================
// Rollup Span Attributes
// ============================================================================

/**
 * Semantic convention attribute names for rollup operations
 */
export const RollupAttributes = {
  // Resource identification
  ROLLUP_ID: 'rollup.id',
  EXECUTION_ID: 'rollup.execution.id',
  TENANT_ID: 'rollup.tenant.id',

  // Operation attributes
  OPERATION_NAME: 'rollup.operation.name',
  OPERATION_PHASE: 'rollup.operation.phase',

  // Node/graph attributes
  NODE_COUNT: 'rollup.node.count',
  NODE_COUNT_PROCESSED: 'rollup.node.count.processed',
  NODE_COUNT_MATCHED: 'rollup.node.count.matched',
  NODE_COUNT_UNMATCHED: 'rollup.node.count.unmatched',
  EDGE_COUNT: 'rollup.edge.count',
  EDGE_COUNT_CROSS_REPO: 'rollup.edge.count.cross_repo',
  GRAPH_COUNT: 'rollup.graph.count',

  // Match attributes
  MATCH_COUNT: 'rollup.match.count',
  MATCH_STRATEGY: 'rollup.match.strategy',
  MATCH_CONFIDENCE: 'rollup.match.confidence',

  // Repository/scan attributes
  REPOSITORY_COUNT: 'rollup.repository.count',
  REPOSITORY_IDS: 'rollup.repository.ids',
  SCAN_COUNT: 'rollup.scan.count',
  SCAN_IDS: 'rollup.scan.ids',

  // Performance attributes
  DURATION_MS: 'rollup.duration.ms',
  THROUGHPUT_NODES_PER_SEC: 'rollup.throughput.nodes_per_sec',

  // Error attributes
  ERROR_CODE: 'rollup.error.code',
  ERROR_PHASE: 'rollup.error.phase',
  ERROR_RETRYABLE: 'rollup.error.retryable',
} as const;

/**
 * Rollup execution phase for tracing
 */
export type RollupTracePhase =
  | 'initialization'
  | 'fetch'
  | 'match'
  | 'merge'
  | 'store'
  | 'callback'
  | 'cleanup';

/**
 * Common attributes for all rollup spans
 */
export interface RollupSpanAttributes {
  rollupId?: RollupId;
  executionId?: RollupExecutionId;
  tenantId?: TenantId;
  phase?: RollupTracePhase;
  [key: string]: AttributeValue | undefined;
}

// ============================================================================
// Span Creation Utilities
// ============================================================================

/**
 * Get a tracer for rollup operations
 */
export function getRollupTracer(): Tracer {
  return getTracer('rollup');
}

/**
 * Create attributes object from rollup context
 */
function createRollupAttributes(attrs: RollupSpanAttributes): Attributes {
  const attributes: Attributes = {};

  if (attrs.rollupId) {
    attributes[RollupAttributes.ROLLUP_ID] = attrs.rollupId;
  }
  if (attrs.executionId) {
    attributes[RollupAttributes.EXECUTION_ID] = attrs.executionId;
  }
  if (attrs.tenantId) {
    attributes[RollupAttributes.TENANT_ID] = attrs.tenantId;
  }
  if (attrs.phase) {
    attributes[RollupAttributes.OPERATION_PHASE] = attrs.phase;
  }

  // Copy remaining attributes
  for (const [key, value] of Object.entries(attrs)) {
    if (
      value !== undefined &&
      !['rollupId', 'executionId', 'tenantId', 'phase'].includes(key)
    ) {
      attributes[key] = value;
    }
  }

  return attributes;
}

/**
 * Start a new span for a rollup operation
 */
export function startRollupSpan(
  name: string,
  attrs: RollupSpanAttributes,
  kind: SpanKind = SpanKind.INTERNAL
): Span {
  const tracer = getRollupTracer();
  const attributes = createRollupAttributes(attrs);

  return tracer.startSpan(name, {
    kind,
    attributes,
  });
}

/**
 * Run a function within a rollup span
 */
export async function withRollupSpan<T>(
  name: string,
  attrs: RollupSpanAttributes,
  fn: (span: Span) => Promise<T>,
  kind: SpanKind = SpanKind.INTERNAL
): Promise<T> {
  const tracer = getRollupTracer();
  const attributes = createRollupAttributes(attrs);

  return tracer.startActiveSpan(
    name,
    { kind, attributes },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        recordRollupException(span, error as Error, attrs.phase);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

// ============================================================================
// Domain-Specific Tracing Functions
// ============================================================================

/**
 * Trace a rollup execution
 */
export async function traceRollupExecution<T>(
  executionId: RollupExecutionId,
  rollupId: RollupId,
  tenantId: TenantId,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    'rollup.execution',
    {
      rollupId,
      executionId,
      tenantId,
      [RollupAttributes.OPERATION_NAME]: 'execution',
    },
    fn,
    SpanKind.INTERNAL
  );
}

/**
 * Trace fetching source graphs
 */
export async function traceFetchGraphs<T>(
  executionId: RollupExecutionId,
  scanIds: ScanId[],
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    'rollup.fetch_graphs',
    {
      executionId,
      phase: 'fetch',
      [RollupAttributes.SCAN_COUNT]: scanIds.length,
      [RollupAttributes.SCAN_IDS]: scanIds.join(','),
    },
    fn
  );
}

/**
 * Trace matcher execution
 */
export async function traceMatcher<T>(
  strategy: MatchingStrategy,
  nodeCount: number,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    `rollup.matcher.${strategy}`,
    {
      phase: 'match',
      [RollupAttributes.MATCH_STRATEGY]: strategy,
      [RollupAttributes.NODE_COUNT]: nodeCount,
    },
    async (span) => {
      const result = await fn(span);
      return result;
    }
  );
}

/**
 * Trace graph merge operation
 */
export async function traceMerge<T>(
  graphCount: number,
  totalNodes: number,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    'rollup.merge',
    {
      phase: 'merge',
      [RollupAttributes.GRAPH_COUNT]: graphCount,
      [RollupAttributes.NODE_COUNT]: totalNodes,
    },
    fn
  );
}

/**
 * Trace blast radius analysis
 */
export async function traceBlastRadius<T>(
  executionId: RollupExecutionId,
  nodeIds: string[],
  maxDepth: number,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    'rollup.blast_radius',
    {
      executionId,
      [RollupAttributes.NODE_COUNT]: nodeIds.length,
      'rollup.blast_radius.max_depth': maxDepth,
    },
    fn
  );
}

/**
 * Trace rollup CRUD operations
 */
export async function traceRollupOperation<T>(
  operation: 'create' | 'read' | 'update' | 'delete' | 'list',
  rollupId: RollupId | undefined,
  tenantId: TenantId,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    `rollup.${operation}`,
    {
      rollupId,
      tenantId,
      [RollupAttributes.OPERATION_NAME]: operation,
    },
    fn
  );
}

/**
 * Trace database operations for rollup
 */
export async function traceRollupDatabase<T>(
  operation: string,
  table: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    `rollup.db.${operation}`,
    {
      'db.operation': operation,
      'db.table': table,
      'db.system': 'postgresql',
    },
    fn,
    SpanKind.CLIENT
  );
}

/**
 * Trace callback invocation
 */
export async function traceCallback<T>(
  callbackUrl: string,
  executionId: RollupExecutionId,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withRollupSpan(
    'rollup.callback',
    {
      executionId,
      phase: 'callback',
      'http.url': callbackUrl,
      'http.method': 'POST',
    },
    fn,
    SpanKind.CLIENT
  );
}

// ============================================================================
// Span Attribute Helpers
// ============================================================================

/**
 * Add rollup attributes to the current active span
 */
export function addRollupSpanAttributes(attrs: RollupSpanAttributes): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttributes(createRollupAttributes(attrs));
  }
}

/**
 * Add execution result attributes to span
 */
export function addExecutionResultAttributes(
  span: Span,
  stats: {
    totalNodesProcessed: number;
    nodesMatched: number;
    nodesUnmatched: number;
    crossRepoEdgesCreated: number;
    executionTimeMs: number;
  }
): void {
  span.setAttributes({
    [RollupAttributes.NODE_COUNT_PROCESSED]: stats.totalNodesProcessed,
    [RollupAttributes.NODE_COUNT_MATCHED]: stats.nodesMatched,
    [RollupAttributes.NODE_COUNT_UNMATCHED]: stats.nodesUnmatched,
    [RollupAttributes.EDGE_COUNT_CROSS_REPO]: stats.crossRepoEdgesCreated,
    [RollupAttributes.DURATION_MS]: stats.executionTimeMs,
    [RollupAttributes.THROUGHPUT_NODES_PER_SEC]:
      stats.executionTimeMs > 0
        ? Math.round((stats.totalNodesProcessed / stats.executionTimeMs) * 1000)
        : 0,
  });
}

/**
 * Add match result attributes to span
 */
export function addMatchResultAttributes(
  span: Span,
  strategy: MatchingStrategy,
  matchCount: number,
  avgConfidence?: number
): void {
  span.setAttributes({
    [RollupAttributes.MATCH_STRATEGY]: strategy,
    [RollupAttributes.MATCH_COUNT]: matchCount,
    ...(avgConfidence !== undefined && {
      [RollupAttributes.MATCH_CONFIDENCE]: avgConfidence,
    }),
  });
}

/**
 * Add merge result attributes to span
 */
export function addMergeResultAttributes(
  span: Span,
  mergedNodes: number,
  crossRepoEdges: number,
  durationMs: number
): void {
  span.setAttributes({
    [RollupAttributes.NODE_COUNT]: mergedNodes,
    [RollupAttributes.EDGE_COUNT_CROSS_REPO]: crossRepoEdges,
    [RollupAttributes.DURATION_MS]: durationMs,
  });
}

// ============================================================================
// Span Events
// ============================================================================

/**
 * Add a rollup event to the current span
 */
export function addRollupSpanEvent(
  name: string,
  attributes?: Record<string, AttributeValue>
): void {
  addSpanEvent(name, attributes);
}

/**
 * Add phase started event
 */
export function recordPhaseStarted(phase: RollupTracePhase): void {
  addSpanEvent(`rollup.phase.${phase}.started`, {
    'rollup.phase': phase,
    'event.timestamp': Date.now(),
  });
}

/**
 * Add phase completed event
 */
export function recordPhaseCompleted(phase: RollupTracePhase, durationMs: number): void {
  addSpanEvent(`rollup.phase.${phase}.completed`, {
    'rollup.phase': phase,
    'rollup.duration.ms': durationMs,
  });
}

/**
 * Add match found event
 */
export function recordMatchFoundEvent(
  strategy: MatchingStrategy,
  confidence: number
): void {
  addSpanEvent('rollup.match.found', {
    'rollup.match.strategy': strategy,
    'rollup.match.confidence': confidence,
  });
}

/**
 * Add merge conflict event
 */
export function recordMergeConflictEvent(
  conflictType: string,
  resolution: string
): void {
  addSpanEvent('rollup.merge.conflict', {
    'rollup.conflict.type': conflictType,
    'rollup.conflict.resolution': resolution,
  });
}

// ============================================================================
// Error Recording
// ============================================================================

/**
 * Record a rollup exception on a span
 */
export function recordRollupException(
  span: Span,
  error: Error,
  phase?: RollupTracePhase
): void {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });

  const errorAttrs: Attributes = {
    'error.type': error.name,
    'error.message': error.message,
  };

  if (phase) {
    errorAttrs[RollupAttributes.ERROR_PHASE] = phase;
  }

  // Check for rollup-specific error properties using type guard
  if (isRollupError(error)) {
    errorAttrs[RollupAttributes.ERROR_CODE] = error.code;
    if (error.isRetryable !== undefined) {
      errorAttrs[RollupAttributes.ERROR_RETRYABLE] = error.isRetryable;
    }
  }

  span.setAttributes(errorAttrs);
}

/**
 * Record error on the current active span
 */
export function recordActiveSpanError(error: Error, phase?: RollupTracePhase): void {
  const span = getActiveSpan();
  if (span) {
    recordRollupException(span, error, phase);
  }
}

// ============================================================================
// Context Propagation
// ============================================================================

/**
 * Get rollup trace context for propagation
 */
export function getRollupTraceContext(): {
  traceId?: string;
  spanId?: string;
  rollupId?: string;
  executionId?: string;
} {
  const baseContext = getTraceContext();
  const span = getActiveSpan();

  // Try to extract rollup-specific context from span attributes
  let rollupId: string | undefined;
  let executionId: string | undefined;

  // Note: In practice, you'd need to store these in the span context
  // This is a simplified implementation

  return {
    ...baseContext,
    rollupId,
    executionId,
  };
}

/**
 * Create trace headers for outgoing requests
 */
export function createRollupTraceHeaders(
  rollupId?: RollupId,
  executionId?: RollupExecutionId
): Record<string, string> {
  const traceContext = getRollupTraceContext();
  const headers: Record<string, string> = {};

  if (traceContext.traceId) {
    headers['x-trace-id'] = traceContext.traceId;
  }
  if (traceContext.spanId) {
    headers['x-span-id'] = traceContext.spanId;
  }
  if (rollupId) {
    headers['x-rollup-id'] = rollupId;
  }
  if (executionId) {
    headers['x-execution-id'] = executionId;
  }

  return headers;
}

// ============================================================================
// Rollup Tracer Class
// ============================================================================

/**
 * Helper class for managing rollup tracing context
 */
export class RollupTracer {
  private readonly tracer: Tracer;
  private readonly baseContext: RollupSpanAttributes;

  constructor(context: RollupSpanAttributes = {}) {
    this.tracer = getRollupTracer();
    this.baseContext = context;
  }

  /**
   * Create a child tracer with additional context
   */
  withContext(additionalContext: RollupSpanAttributes): RollupTracer {
    return new RollupTracer({
      ...this.baseContext,
      ...additionalContext,
    });
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attrs: RollupSpanAttributes = {}): Span {
    return startRollupSpan(name, {
      ...this.baseContext,
      ...attrs,
    });
  }

  /**
   * Run a function within a span
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attrs: RollupSpanAttributes = {}
  ): Promise<T> {
    return withRollupSpan(
      name,
      {
        ...this.baseContext,
        ...attrs,
      },
      fn
    );
  }

  /**
   * Get the base context
   */
  getContext(): RollupSpanAttributes {
    return { ...this.baseContext };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a rollup tracer for an execution
 */
export function createExecutionTracer(
  executionId: RollupExecutionId,
  rollupId: RollupId,
  tenantId: TenantId
): RollupTracer {
  return new RollupTracer({
    executionId,
    rollupId,
    tenantId,
  });
}

/**
 * Create a rollup tracer for configuration operations
 */
export function createConfigTracer(
  rollupId: RollupId,
  tenantId: TenantId
): RollupTracer {
  return new RollupTracer({
    rollupId,
    tenantId,
  });
}
