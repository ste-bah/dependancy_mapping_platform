/**
 * Cross-Tool Rollup Module Exports
 * @module rollup
 *
 * Exports for cross-tool rollup queries that span Terraform, Helm, and CI/CD.
 * Provides blast radius calculation, end-to-end flow tracing, and impact analysis.
 *
 * TASK-XREF-008: Cross-Tool Rollup Query Module
 */

// ============================================================================
// Type Exports
// ============================================================================

export {
  // Tool types
  type ToolType,

  // Node and edge references
  type GraphNodeRef,
  type GraphEdgeRef,

  // Impact analysis
  type ImpactedNodes,
  type CrossToolPath,
  type CrossToolBlastRadius,

  // End-to-end flows
  type FlowSourceType,
  type FlowDestinationType,
  type EndToEndFlow,

  // Summary types
  type CrossToolConnection,
  type CrossToolSummary,

  // Options
  type BlastRadiusOptions,
  type EdgeQueryOptions,

  // Query interface
  type GraphQueryInterface,

  // Constants
  NODE_TYPE_TO_TOOL,
  CROSS_TOOL_EDGE_TYPES,

  // Factory functions
  createEmptyImpactedNodes,
  createEmptyCrossToolSummary,
  createGraphNodeRef,
  createGraphEdgeRef,

  // Type guards
  isToolType,
  isGraphNodeRef,
  isGraphEdgeRef,
  isCrossToolBlastRadius,
  isEndToEndFlow,
  isCrossToolSummary,
} from './types';

// ============================================================================
// Cross-Tool Rollup Exports
// ============================================================================

export {
  // Constants
  TF_HELM_DETECTION_TARGET,

  // Classification functions
  classifyNodeTool,
  isCrossToolEdge,
  areNodesDifferentTools,

  // Impact analysis
  generateImpactSummary,
  findCriticalPaths,
  findCriticalPathsAsync,

  // Main blast radius function
  calculateCrossToolBlastRadius,

  // Summary generation
  generateCrossToolSummary,

  // Filtering utilities
  filterNodesByTool,
  groupNodesByTool,
  countNodesByTool,
} from './cross-tool-rollup';

// ============================================================================
// Flow Tracer Exports
// ============================================================================

export {
  // Flow ID generation
  generateFlowId,

  // Node classification
  getFlowSourceType,
  getFlowDestinationType,
  isFlowSource,
  isFlowDestination,

  // Single node flow tracing
  traceEndToEndFlows,

  // Scan-wide flow tracing
  traceAllEndToEndFlows,

  // Aggregation
  aggregateFlowsByPipeline,
  type PipelineFlowAggregation,

  // Filtering
  filterFlows,
  type FlowFilterOptions,

  // Statistics
  calculateFlowStatistics,
  type FlowStatistics,

  // Visualization helpers
  describeFlow,
  getFlowToolPath,
  flowCrossesTools,
} from './flow-tracer';
