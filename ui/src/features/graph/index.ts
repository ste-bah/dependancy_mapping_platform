/**
 * Graph Feature Index
 * Barrel export for the graph visualization feature module
 * @module features/graph
 */

// ============================================================================
// Core Types
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
} from './types';

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

  // Utility functions
  getImpactSeverity,
} from './types';

// ============================================================================
// API Types (re-exported from types directory)
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
  BlastRadiusApiResponse,
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
} from './types/api';

export { GraphErrorCodes, isGraphError } from './types/api';

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
} from './types/components';

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
} from './types/hooks';

// ============================================================================
// API Functions
// ============================================================================

export {
  fetchGraph,
  fetchNodeDetail,
  calculateBlastRadius,
  graphKeys,
  type FetchGraphOptions,
} from './api';

// ============================================================================
// Hooks
// ============================================================================

export { useGraph } from './hooks';

// ============================================================================
// Components
// ============================================================================

export {
  // Core components
  CustomNode,
  GraphCanvas,
  FilterPanel,
  SearchBar,
  DetailPanel,
  type CustomNodeType,

  // State components
  GraphSkeleton,
  GraphEmptyState,
  GraphErrorBoundary,
  GraphErrorDisplay,
  type GraphSkeletonProps,
  type GraphErrorBoundaryProps,
  type GraphErrorDisplayProps,

  // UI components
  GraphToolbar,
  GraphToolbarCompact,
  GraphLegend,
  GraphLegendInline,
  type GraphToolbarCompactProps,
  type GraphLegendInlineProps,
} from './components';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Constants
  DEFAULT_LAYOUT_OPTIONS,
  LAYOUT_PRESETS,
  FUSE_OPTIONS,
  SEARCH_DEFAULTS,
  CACHE_TIMES,
  ANIMATION_DURATIONS,
  VIEWPORT_CONSTRAINTS,
  NODE_DIMENSIONS,
  URL_PARAM_KEYS,
  IMPACT_THRESHOLDS,
  MAX_BLAST_RADIUS_DEPTH,
  IMPACT_COLORS,

  // Layout utilities
  calculateLayout,
  calculateGraphBounds,
  getOptimalDirection,
  relayoutSubgraph,
  hasCycles,

  // Transformer utilities
  transformToFlowNode,
  transformToFlowNodes,
  transformToFlowEdge,
  transformToFlowEdges,
  transformGraphData,
  updateNodeData,
  updateEdgeData,
  updateNodesState,
  updateEdgesState,
  flowNodeToGraphNode,
  flowNodesToGraphNodes,
  createNodeMap,
  createEdgeMap,
  getConnectedEdges,

  // Filter utilities
  filterNodes,
  filterNodesByType,
  filterNodesBySearch,
  filterEdges,
  filterEdgesByType,
  filterEdgesByConfidence,
  getConnectedNodeIds,
  filterConnectedNodes,
  applyHighlighting,
  applyEdgeHighlighting,
  clearHighlighting,
  applyFiltersAndHighlighting,

  // Search utilities
  createSearchIndex,
  createFlowNodeSearchIndex,
  searchNodes,
  searchFlowNodes,
  highlightMatch,
  highlightSearchResult,
  quickSearch,
  quickSearchFlowNodes,
  isValidSearchQuery,
  normalizeQuery,

  // URL state utilities
  filtersToSearchParams,
  searchParamsToFilters,
  selectedNodeToParam,
  paramToSelectedNode,
  stateToSearchParams,
  searchParamsToState,
  updateUrlParams,
  getCurrentUrlParams,
  mergeUrlParams,
  clearGraphUrlParams,

  // Blast radius utilities
  getAffectedNodeIds,
  getAffectedByType,
  getAffectedByDepth,
  getImpactLevel,
  getImpactSeverityFromScore,
  getImpactColor,
  sortByImpact,
  sortFlowNodesByImpact,
  calculateClientBlastRadius,
  isNodeAffected,
  isDirectlyAffected,
  getBlastRadiusSummary,
  getAffectedEdgeIds,

  // Types
  type LayoutOptions,
  type LayoutDirection,
  type LayoutResult,
  type GraphBounds,
  type SearchResult,
  type SearchMatch,
  type FlowNodeSearchResult,
  type GraphUrlState,
  type ExtendedGraphUrlState,
  type ClientBlastRadius,
} from './utils';

// ============================================================================
// Services
// ============================================================================

export {
  // Service classes
  GraphDataService,
  LayoutService,
  SelectionService,
  FilterService,
  BlastRadiusService,
  ExportService,

  // Factory functions
  createGraphDataService,
  createLayoutService,
  createSelectionService,
  createFilterService,
  createBlastRadiusService,
  createExportService,

  // Service container
  createGraphServices,
  initializeGraphServices,
  getGraphServices,
  isGraphServicesInitialized,
  resetGraphServices,

  // Service types
  type GraphDataServiceConfig,
  type GraphDataResult,
  type LayoutedGraphResult,
  type NodeDetail,
  type LayoutServiceConfig,
  type LayoutPreset,
  type CycleDetectionResult,
  type OptimizationResult,
  type SubgraphLayoutResult,
  type SelectionServiceConfig,
  type SelectionMode,
  type PathResult,
  type ConnectedNodesResult,
  type SelectionUpdate,
  type FilterServiceConfig,
  type FilteredGraph,
  type FilterSummary,
  type BlastRadiusServiceConfig,
  type ImpactSummary,
  type VisualizedNode,
  type BlastRadiusResult,
  type ExportServiceConfig,
  type ExportFormat as ServiceExportFormat,
  type ExportOptions,
  type ExportResult,
  type GraphServicesConfig,
  type GraphServices,
} from './services';

// ============================================================================
// Configuration
// ============================================================================

export {
  // Default configuration
  graphConfig,
  defaultApiConfig,
  defaultCacheConfig,
  defaultLayoutConfig,
  defaultUiConfig,
  defaultLimitsConfig,
  defaultFeaturesConfig,
  defaultThemeConfig,
  FROZEN_DEFAULT_CONFIG,

  // Configuration helpers
  deepFreeze,
  getConfigSection,
  shouldDisableAnimations,
  shouldHideLabels,
  isNodeCountWarning,

  // Configuration types
  type GraphConfig,
  type ApiConfig,
  type CacheConfig,
  type LayoutConfig,
  type UiConfig,
  type LimitsConfig,
  type FeaturesConfig,
  type ThemeConfig,
  type PartialGraphConfig,
  type Environment,
  type NodeColors,
  type EdgeColors,
  type ImpactColors,
  type LayoutAlgorithm as ConfigLayoutAlgorithm,
  type ConfigChangeCallback,
} from './config';

export {
  // Environment utilities
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,
  getGraphEnvConfig,
  validateEnvConfig,
  logEnvConfig,
} from './config/env';

export {
  // Runtime configuration
  getGraphConfig,
  getConfigValue,
  updateGraphConfig,
  updateConfigSection,
  setConfigValue,
  resetGraphConfig,
  resetConfigSection,
  resetToDefaults,
  onConfigChange,
  clearConfigListeners,
  getConfigHistory,
  clearConfigHistory,
  logCurrentConfig,
  getConfigDiff,
} from './config/runtime';

export {
  // React context
  GraphConfigProvider,
  GraphConfigContext,
  useGraphConfig,
  useGraphConfigSection,
  useFeatureEnabled,
  useGraphFeatures,
  useGraphTheme,
  useGraphLayoutConfig,
  useGraphLimits,
  type GraphConfigContextValue,
  type GraphConfigProviderProps,
} from './config/GraphConfigProvider';

export {
  // Feature flags
  isFeatureEnabled,
  withFeatureFlag,
  whenFeatureEnabled,
  getAllFeatureFlags,
  getEnabledFeatures,
  getDisabledFeatures,
  getExperimentalFeatures,
  hasExperimentalFeaturesEnabled,
  onFeatureFlagChange,
  onAnyFeatureFlagChange,
  guardWithFeature,
  createFeatureGate,
  logFeatureFlags,
  getFeatureFlagSummary,
  FEATURE_FLAG_DEFINITIONS,
  type FeatureFlagKey,
  type FeatureFlagDefinition,
} from './config/featureFlags';
