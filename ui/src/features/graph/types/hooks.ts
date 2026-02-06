/**
 * Graph Hook Types
 * Type definitions for graph-related hooks
 * @module features/graph/types/hooks
 */

import type { RefObject } from 'react';
import type { ReactFlowInstance, Viewport } from '@xyflow/react';
import type {
  GraphData,
  GraphFilters,
  ExtendedGraphFilters,
  GraphNodeType,
  BlastRadius,
  FlowNode,
  FlowEdge,
  GraphViewState,
  CustomNodeData,
} from '../types';
import type { NodeDetailResponse } from './api';

// ============================================================================
// useGraph Hook Types
// ============================================================================

/**
 * Options for the useGraph hook
 */
export interface UseGraphOptions {
  /** Scan ID to fetch graph for */
  scanId: string;
  /** Enable automatic persistence of filters to URL */
  persistFilters?: boolean;
  /** Custom initial filters */
  initialFilters?: Partial<GraphFilters>;
  /** Stale time for graph data cache (ms) */
  staleTime?: number;
  /** Enable automatic refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Enable background refetch */
  refetchOnMount?: boolean;
  /** Retry count on failure */
  retryCount?: number;
}

/**
 * Return type for the useGraph hook
 */
export interface UseGraphReturn {
  /** React Flow nodes */
  nodes: FlowNode[];
  /** React Flow edges */
  edges: FlowEdge[];
  /** Original graph data from API */
  graphData: GraphData | undefined;
  /** Initial loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Is currently fetching (including background) */
  isFetching: boolean;
  /** Current filters */
  filters: GraphFilters;
  /** Set node type filters */
  setNodeTypes: (types: GraphNodeType[]) => void;
  /** Toggle a single node type filter */
  toggleNodeType: (type: GraphNodeType) => void;
  /** Set search query */
  setSearch: (search: string) => void;
  /** Toggle blast radius mode */
  toggleBlastRadius: () => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Set selected node */
  setSelectedNodeId: (nodeId: string | null) => void;
  /** Selected node details */
  selectedNodeDetail: NodeDetailResponse | undefined;
  /** Is loading node details */
  isLoadingNodeDetail: boolean;
  /** Blast radius data for selected node */
  blastRadiusData: BlastRadius | undefined;
  /** Is loading blast radius */
  isLoadingBlastRadius: boolean;
  /** Fetch blast radius for a specific node */
  fetchBlastRadius: (nodeId: string) => void;
  /** Refetch graph data */
  refetch: () => void;
  /** Highlighted node IDs (affected by blast radius) */
  highlightedNodeIds: Set<string>;
}

// ============================================================================
// useGraphLayout Hook Types
// ============================================================================

/**
 * Layout algorithm type
 */
export type LayoutAlgorithm = 'hierarchical' | 'force' | 'radial' | 'dagre';

/**
 * Options for the useGraphLayout hook
 */
export interface UseGraphLayoutOptions {
  /** Layout algorithm to use */
  algorithm?: LayoutAlgorithm;
  /** Direction for hierarchical layout */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Node width for spacing calculations */
  nodeWidth?: number;
  /** Node height for spacing calculations */
  nodeHeight?: number;
  /** Horizontal gap between nodes */
  horizontalGap?: number;
  /** Vertical gap between nodes */
  verticalGap?: number;
  /** Enable animation during layout */
  animated?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
}

/**
 * Return type for the useGraphLayout hook
 */
export interface UseGraphLayoutReturn {
  /** Apply layout to nodes */
  applyLayout: (nodes: FlowNode[], edges: FlowEdge[]) => FlowNode[];
  /** Current layout algorithm */
  algorithm: LayoutAlgorithm;
  /** Set layout algorithm */
  setAlgorithm: (algorithm: LayoutAlgorithm) => void;
  /** Is layout being computed */
  isComputing: boolean;
}

// ============================================================================
// useGraphSelection Hook Types
// ============================================================================

/**
 * Options for the useGraphSelection hook
 */
export interface UseGraphSelectionOptions {
  /** Allow multi-select with modifier keys */
  multiSelect?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Initial selected node IDs */
  initialSelection?: string[];
}

/**
 * Return type for the useGraphSelection hook
 */
export interface UseGraphSelectionReturn {
  /** Currently selected node IDs */
  selectedIds: Set<string>;
  /** Select a node (add to selection) */
  select: (nodeId: string, addToSelection?: boolean) => void;
  /** Deselect a node */
  deselect: (nodeId: string) => void;
  /** Toggle node selection */
  toggle: (nodeId: string) => void;
  /** Select multiple nodes */
  selectMany: (nodeIds: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Is a specific node selected */
  isSelected: (nodeId: string) => boolean;
  /** Select all nodes */
  selectAll: (nodeIds: string[]) => void;
}

// ============================================================================
// useGraphFilters Hook Types
// ============================================================================

/**
 * Options for the useGraphFilters hook
 */
export interface UseGraphFiltersOptions {
  /** Initial filter state */
  initialFilters?: Partial<GraphFilters>;
  /** Persist to URL search params */
  persistToUrl?: boolean;
  /** Debounce delay for search filter (ms) */
  searchDebounce?: number;
  /** Callback when filters change */
  onFiltersChange?: (filters: GraphFilters) => void;
}

/**
 * Return type for the useGraphFilters hook
 */
export interface UseGraphFiltersReturn {
  /** Current filters */
  filters: GraphFilters;
  /** Set node types filter */
  setNodeTypes: (types: GraphNodeType[]) => void;
  /** Toggle a node type */
  toggleNodeType: (type: GraphNodeType) => void;
  /** Set search query */
  setSearch: (search: string) => void;
  /** Toggle blast radius mode */
  toggleBlastRadius: () => void;
  /** Reset to defaults */
  reset: () => void;
  /** Check if any filters are active */
  hasActiveFilters: boolean;
  /** Number of active node type filters */
  activeNodeTypeCount: number;
  /** Debounced search value */
  debouncedSearch: string;
}

// ============================================================================
// useBlastRadius Hook Types
// ============================================================================

/**
 * Options for the useBlastRadius hook
 */
export interface UseBlastRadiusOptions {
  /** Scan ID */
  scanId: string;
  /** Enable the hook */
  enabled?: boolean;
  /** Stale time for cache */
  staleTime?: number;
  /** Callback when calculation completes */
  onComplete?: (data: BlastRadius) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useBlastRadius hook
 */
export interface UseBlastRadiusReturn {
  /** Blast radius data */
  data: BlastRadius | undefined;
  /** Is currently loading */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Calculate blast radius for a node */
  calculate: (nodeId: string) => void;
  /** Clear current data */
  clear: () => void;
  /** Current node ID being calculated/displayed */
  nodeId: string | null;
  /** Affected node IDs as a Set */
  affectedNodeIds: Set<string>;
}

// ============================================================================
// useNodeDetail Hook Types
// ============================================================================

/**
 * Options for the useNodeDetail hook
 */
export interface UseNodeDetailOptions {
  /** Scan ID */
  scanId: string;
  /** Node ID to fetch details for */
  nodeId: string | null;
  /** Enable the hook */
  enabled?: boolean;
  /** Include dependencies */
  includeDependencies?: boolean;
  /** Include dependents */
  includeDependents?: boolean;
}

/**
 * Return type for the useNodeDetail hook
 */
export interface UseNodeDetailReturn {
  /** Node detail data */
  data: NodeDetailResponse | undefined;
  /** Is currently loading */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Is fetching (including background) */
  isFetching: boolean;
  /** Refetch data */
  refetch: () => void;
}

// ============================================================================
// useGraphViewport Hook Types
// ============================================================================

/**
 * Options for the useGraphViewport hook
 */
export interface UseGraphViewportOptions {
  /** Initial viewport */
  initialViewport?: Viewport;
  /** Min zoom level */
  minZoom?: number;
  /** Max zoom level */
  maxZoom?: number;
  /** Animation duration for transitions */
  animationDuration?: number;
}

/**
 * Return type for the useGraphViewport hook
 */
export interface UseGraphViewportReturn {
  /** Current viewport */
  viewport: Viewport;
  /** Set viewport */
  setViewport: (viewport: Viewport, options?: { duration?: number }) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Fit view to show all nodes */
  fitView: (padding?: number) => void;
  /** Center view on a specific node */
  centerOnNode: (nodeId: string, zoom?: number) => void;
  /** Reset to initial viewport */
  reset: () => void;
  /** React Flow instance ref */
  reactFlowInstance: RefObject<ReactFlowInstance | null>;
}

// ============================================================================
// useGraphSearch Hook Types
// ============================================================================

/**
 * Options for the useGraphSearch hook
 */
export interface UseGraphSearchOptions {
  /** Nodes to search through */
  nodes: FlowNode[];
  /** Minimum characters before searching */
  minLength?: number;
  /** Maximum results to return */
  maxResults?: number;
  /** Debounce delay in ms */
  debounce?: number;
  /** Fuse.js options */
  fuseOptions?: {
    threshold?: number;
    keys?: Array<string | { name: string; weight: number }>;
  };
}

/**
 * Search result item
 */
export interface GraphSearchResult {
  /** The matching node */
  node: FlowNode;
  /** Match score (0-1, lower is better) */
  score: number;
  /** Matched indices for highlighting */
  matches?: Array<{
    key: string;
    indices: Array<[number, number]>;
  }>;
}

/**
 * Return type for the useGraphSearch hook
 */
export interface UseGraphSearchReturn {
  /** Current search query */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;
  /** Search results */
  results: GraphSearchResult[];
  /** Is searching */
  isSearching: boolean;
  /** Clear search */
  clear: () => void;
  /** Has results */
  hasResults: boolean;
  /** Highlighted index for keyboard navigation */
  highlightedIndex: number;
  /** Set highlighted index */
  setHighlightedIndex: (index: number) => void;
  /** Move highlight up */
  highlightPrevious: () => void;
  /** Move highlight down */
  highlightNext: () => void;
  /** Select highlighted result */
  selectHighlighted: () => FlowNode | null;
}

// ============================================================================
// useGraphExport Hook Types
// ============================================================================

/**
 * Export format type
 */
export type ExportFormat = 'png' | 'svg' | 'json' | 'dot';

/**
 * Options for the useGraphExport hook
 */
export interface UseGraphExportOptions {
  /** Graph data */
  graphData: GraphData | undefined;
  /** React Flow instance ref */
  reactFlowInstance: RefObject<ReactFlowInstance | null>;
  /** Default filename */
  defaultFilename?: string;
}

/**
 * Return type for the useGraphExport hook
 */
export interface UseGraphExportReturn {
  /** Export graph */
  exportGraph: (format: ExportFormat, filename?: string) => Promise<void>;
  /** Is exporting */
  isExporting: boolean;
  /** Export error */
  error: Error | null;
  /** Supported formats */
  supportedFormats: ExportFormat[];
}

// ============================================================================
// useGraphStats Hook Types
// ============================================================================

/**
 * Return type for the useGraphStats hook
 */
export interface UseGraphStatsReturn {
  /** Total node count */
  totalNodes: number;
  /** Total edge count */
  totalEdges: number;
  /** Nodes by type */
  nodesByType: Record<GraphNodeType, number>;
  /** Edges by type */
  edgesByType: Record<string, number>;
  /** Average dependencies per node */
  avgDependencies: number;
  /** Max dependencies for any node */
  maxDependencies: number;
  /** Nodes with no connections */
  isolatedNodes: number;
  /** Most connected node */
  mostConnectedNode: FlowNode | null;
}

// ============================================================================
// useDebounce Hook Types
// ============================================================================

/**
 * Return type for useDebounce hook
 */
export type UseDebounceReturn<T> = T;

/**
 * Options for useDebounce hook
 */
export interface UseDebounceOptions {
  /** Delay in milliseconds */
  delay: number;
  /** Leading edge trigger */
  leading?: boolean;
  /** Trailing edge trigger */
  trailing?: boolean;
}
