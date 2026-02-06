/**
 * Graph Types Index
 * Barrel export for all graph-related type definitions
 * @module features/graph/types
 */

// ============================================================================
// Core Types (from main types.ts)
// ============================================================================

export type {
  // Node types
  GraphNodeType,
  NodeLocation,
  GraphNode,

  // Edge types
  EdgeType,
  GraphEdge,

  // Graph data types
  GraphMetadata,
  GraphData,

  // Terragrunt types
  TerragruntConfigNodeData,

  // React Flow integration types
  CustomNodeData,
  CustomEdgeData,
  FlowNode,
  FlowEdge,
  NodePosition,
  GraphLayout,

  // Blast radius types
  ImpactSeverity,
  AffectedNode,
  BlastRadius,
  BlastRadiusResponse,

  // Filter types
  GraphFilters,
  ExtendedGraphFilters,
  GraphViewState,
  GraphSelectionState,

  // Edge styling
  EdgeStyle,

  // Callback types
  NodeSelectHandler,
  FilterChangeHandler,
  ExtendedFilterChangeHandler,

  // Action types
  GraphAction,

  // Stats types
  GraphStats,
} from '../types';

export {
  // Constants
  ALL_NODE_TYPES,
  ALL_EDGE_TYPES,
  defaultGraphFilters,
  defaultExtendedGraphFilters,
  nodeColors,
  nodeTypeLabels,
  nodeTypeIcons,
  edgeStyles,

  // Type guards
  isGraphNodeType,
  isEdgeType,
  isGraphNode,
  isGraphEdge,
  isGraphData,
  isTerragruntConfigNode,

  // Utility functions
  getImpactSeverity,
  getTerragruntMetadata,
} from '../types';

// ============================================================================
// API Types
// ============================================================================

export type {
  // Request types
  FetchGraphParams,
  FetchNodeDetailParams,
  CalculateBlastRadiusParams,
  SearchNodesParams,

  // Response types
  ApiResponseWrapper,
  GraphDataResponse,
  NodeDetailResponse,
  BlastRadiusResponse as BlastRadiusApiResponse,
  NodeSearchResult,
  SearchNodesResponse,
  GraphStatsResponse,

  // Query key types
  GraphQueryKey,
  NodeDetailQueryKey,
  BlastRadiusQueryKey,
  SearchQueryKey,

  // Error types
  GraphErrorCode,
  GraphError,

  // Mutation types
  UpdateNodeRequest,
  BatchUpdateNodesRequest,
  ExportGraphRequest,
  ExportGraphResponse,
} from './api';

export { GraphErrorCodes, isGraphError } from './api';

// ============================================================================
// Component Props Types
// ============================================================================

export type {
  // Main component props
  GraphCanvasProps,
  NodeComponentProps,

  // Filter panel props
  FilterPanelProps,
  ExtendedFilterPanelProps,

  // Search bar props
  SearchBarProps,
  SearchResultItem,
  SearchMatch,

  // Detail panel props
  DetailPanelProps,
  DetailSectionProps,

  // Custom node props
  CustomNodeProps,

  // Legend/helper component props
  GraphLegendProps,
  ImpactBadgeProps,
  NodeTypeBadgeProps,

  // Toolbar props
  GraphToolbarProps,

  // State component props
  GraphLoadingProps,
  GraphErrorProps,
  GraphEmptyProps,

  // Context types
  GraphContextValue,
} from './components';

// ============================================================================
// Hook Types
// ============================================================================

export type {
  // useGraph hook
  UseGraphOptions,
  UseGraphReturn,

  // useGraphLayout hook
  LayoutAlgorithm,
  UseGraphLayoutOptions,
  UseGraphLayoutReturn,

  // useGraphSelection hook
  UseGraphSelectionOptions,
  UseGraphSelectionReturn,

  // useGraphFilters hook
  UseGraphFiltersOptions,
  UseGraphFiltersReturn,

  // useBlastRadius hook
  UseBlastRadiusOptions,
  UseBlastRadiusReturn,

  // useNodeDetail hook
  UseNodeDetailOptions,
  UseNodeDetailReturn,

  // useGraphViewport hook
  UseGraphViewportOptions,
  UseGraphViewportReturn,

  // useGraphSearch hook
  UseGraphSearchOptions,
  GraphSearchResult,
  UseGraphSearchReturn,

  // useGraphExport hook
  ExportFormat,
  UseGraphExportOptions,
  UseGraphExportReturn,

  // useGraphStats hook
  UseGraphStatsReturn,

  // useDebounce hook
  UseDebounceReturn,
  UseDebounceOptions,
} from './hooks';
