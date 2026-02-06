/**
 * Graph Utilities Index
 * Barrel export for all graph utility functions
 * @module features/graph/utils
 */

// ============================================================================
// Constants
// ============================================================================

export {
  // Layout constants
  DEFAULT_LAYOUT_OPTIONS,
  LAYOUT_PRESETS,
  type LayoutOptions,
  type LayoutDirection,
  type LayoutAlign,

  // Search constants
  FUSE_OPTIONS,
  SEARCH_DEFAULTS,

  // Cache constants
  CACHE_TIMES,

  // UI constants
  ANIMATION_DURATIONS,
  VIEWPORT_CONSTRAINTS,
  NODE_DIMENSIONS,

  // URL constants
  URL_PARAM_KEYS,
  URL_ARRAY_SEPARATOR,

  // Blast radius constants
  IMPACT_THRESHOLDS,
  MAX_BLAST_RADIUS_DEPTH,
  IMPACT_COLORS,
} from './constants';

// ============================================================================
// Layout Utilities
// ============================================================================

export {
  calculateLayout,
  calculateGraphBounds,
  getOptimalDirection,
  relayoutSubgraph,
  hasCycles,
  type LayoutResult,
  type GraphBounds,
} from './layout';

// ============================================================================
// Transformer Utilities
// ============================================================================

export {
  // Node transformers
  transformToFlowNode,
  transformToFlowNodes,

  // Edge transformers
  transformToFlowEdge,
  transformToFlowEdges,
  transformToFlowEdgesValidated,

  // Combined transformers
  transformGraphData,

  // Update transformers
  updateNodeData,
  updateEdgeData,
  updateNodesState,
  updateEdgesState,

  // Reverse transformers
  flowNodeToGraphNode,
  flowNodesToGraphNodes,
  flowEdgeToGraphEdge,
  flowEdgesToGraphEdges,

  // Utility transformers
  createNodeMap,
  createEdgeMap,
  getConnectedEdges,
} from './transformers';

// ============================================================================
// Filter Utilities
// ============================================================================

export {
  // Node filtering
  filterNodes,
  filterNodesByType,
  filterNodesBySearch,

  // Edge filtering
  filterEdges,
  filterEdgesByType,
  filterEdgesByConfidence,
  filterEdgesExtended,

  // Connected filtering
  getConnectedNodeIds,
  filterConnectedNodes,

  // Highlighting
  applyHighlighting,
  applyEdgeHighlighting,
  clearHighlighting,
  clearEdgeHighlighting,

  // Combined
  applyFiltersAndHighlighting,
} from './filters';

// ============================================================================
// Search Utilities
// ============================================================================

export {
  // Index creation
  createSearchIndex,
  createFlowNodeSearchIndex,

  // Search functions
  searchNodes,
  searchFlowNodes,

  // Highlight utilities
  highlightMatch,
  highlightSearchResult,

  // Quick search (no index)
  quickSearch,
  quickSearchFlowNodes,

  // Helpers
  isValidSearchQuery,
  normalizeQuery,
  getBestMatchField,

  // Types
  type SearchResult,
  type SearchMatch,
  type FlowNodeSearchResult,
} from './search';

// ============================================================================
// URL State Utilities
// ============================================================================

export {
  // Filter serialization
  filtersToSearchParams,
  extendedFiltersToSearchParams,
  searchParamsToFilters,
  searchParamsToExtendedFilters,

  // Selected node serialization
  selectedNodeToParam,
  paramToSelectedNode,

  // Viewport serialization
  viewportToSearchParams,
  searchParamsToViewport,

  // Combined state
  stateToSearchParams,
  extendedStateToSearchParams,
  searchParamsToState,
  searchParamsToExtendedState,

  // URL manipulation
  updateUrlParams,
  getCurrentUrlParams,
  mergeUrlParams,
  clearGraphUrlParams,

  // Types
  type GraphUrlState,
  type ExtendedGraphUrlState,
} from './urlState';

// ============================================================================
// Blast Radius Utilities
// ============================================================================

export {
  // Affected node extraction
  getAffectedNodeIds,
  getAffectedByType,
  getAffectedByDepth,

  // Impact level calculation
  getImpactLevel,
  getImpactSeverityFromScore,
  getImpactColor,
  getImpactColorFromScore,

  // Sorting and ranking
  sortByImpact,
  sortFlowNodesByImpact,

  // Client-side calculation
  calculateClientBlastRadius,
  clientBlastRadiusToResponse,

  // Utility functions
  isNodeAffected,
  isDirectlyAffected,
  getBlastRadiusSummary,
  getAffectedEdgeIds,

  // Types
  type ClientBlastRadius,
} from './blastRadius';

// ============================================================================
// Error Handling Utilities
// ============================================================================

export {
  // Error class
  GraphError,
  handleApiError,

  // Error classification
  isRetryableError,
  isAuthError,
  isValidationError,
  isNotFoundError,
  isGraphError,
  hasErrorCode,

  // User messages
  getErrorMessage,
  getErrorTitle,
  getErrorRecoveryActions,
  getPrimaryRecoveryAction,

  // Types
  type GraphErrorCode,
  type RecoveryAction,
  type RecoveryActionType,
} from './errorHandler';

// ============================================================================
// Validation Utilities
// ============================================================================

export {
  // ID validation
  validateScanId,
  validateNodeId,

  // Type validation
  isValidNodeType,
  isValidEdgeType,

  // Filter validation
  validateFilters,
  validateExtendedFilters,

  // Search validation
  validateSearchQuery,

  // Numeric validation
  validateDepth,
  validateConfidence,
  MAX_DEPTH,

  // Composite validation
  validateGraphFetchParams,
  validateBlastRadiusParams,

  // Utilities
  formatValidationErrors,
  getFirstError,
  hasFieldError,
  getFieldError,

  // Types
  type ValidationResult,
  type ValidationErrors,
  type FieldError,
} from './validation';

// ============================================================================
// Recovery Utilities
// ============================================================================

export {
  // Retry
  withRetry,
  DEFAULT_RETRY_OPTIONS,
  type RetryOptions,

  // Circuit breaker
  createCircuitBreaker,
  CircuitOpenError,
  DEFAULT_CIRCUIT_BREAKER_OPTIONS,
  type CircuitBreaker,
  type CircuitBreakerOptions,
  type CircuitState,

  // Fallback
  withFallback,
  type FallbackOptions,

  // Timeout
  withTimeout,

  // Auto-recovery
  attemptAutoRecovery,
  createRecoveryHandlers,
  type AutoRecoveryResult,

  // Graceful degradation
  withGracefulDegradation,
  type DegradationOptions,
  type DegradationResult,
} from './recovery';

// ============================================================================
// Error Logging Utilities
// ============================================================================

export {
  // Logging
  logGraphError,
  type ErrorContext,
  type ErrorLogEntry,

  // Metrics
  trackErrorMetrics,
  getErrorMetrics,
  resetErrorMetrics,
  getErrorRate,
  hasFrequentErrors,

  // Debug
  formatErrorForDebug,
  getErrorDebugSummary,
} from './errorLogging';

// ============================================================================
// Logger Utilities
// ============================================================================

export {
  // Main logger
  graphLogger,
  createComponentLogger,
  createOperationLogger,

  // Types
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LoggerConfig,
} from './logger';

// ============================================================================
// Performance Logger Utilities
// ============================================================================

export {
  // Timing functions
  startTimer,
  logPerformance,

  // Metrics
  getPerformanceMetrics,
  getOperationMetrics,
  resetPerformanceMetrics,

  // Thresholds
  setThreshold,
  clearCustomThresholds,

  // Wrappers
  withPerformanceTracking,
  measureAsync,
  measureSync,

  // Reporting
  generatePerformanceReport,

  // Types
  type TimingEntry,
  type PerformanceMetrics,
  type OperationMetrics,
  type PerformanceThresholds,
} from './performanceLogger';

// ============================================================================
// Action Logger Utilities
// ============================================================================

export {
  // Main logging function
  logUserAction,

  // Convenience functions
  logNodeClick,
  logNodeHover,
  logFilterChange,
  logSearch,
  logBlastRadius,
  logExport,
  logZoom,
  logPan,
  logLayoutChange,
  logGraphLoad,
  logSelectionChange,
  logErrorAction,

  // History and analytics
  getActionHistory,
  getActionCounts,
  getSessionSummary,
  clearActionHistory,
  startNewSession,
  getSessionId,

  // Configuration
  configureActionLogger,
  resetActionLoggerConfig,

  // Types
  type UserAction,
  type NodeClickAction,
  type NodeHoverAction,
  type FilterChangeAction,
  type SearchAction,
  type BlastRadiusAction,
  type ExportAction,
  type ZoomAction,
  type PanAction,
  type LayoutChangeAction,
  type ErrorAction,
  type GraphLoadAction,
  type SelectionChangeAction,
  type ActionLogEntry,
  type ActionLoggerConfig,
} from './actionLogger';

// ============================================================================
// Debug Utilities
// ============================================================================

export {
  // Enable/disable
  enableGraphDebug,
  disableGraphDebug,
  isDebugEnabled,

  // State management
  updateDebugState,
  setDebugGraphData,
  useGraphDebugState,

  // Debug functions
  dumpGraphState,
  inspectNode,

  // Reporting
  printFullReport,
  createDebugInterface,

  // Types
  type GraphDebugState,
  type NodeInspection,
  type GraphDebugInterface,
} from './debug';
