/**
 * Graph Component Props Types
 * Type definitions for graph visualization component props
 * @module features/graph/types/components
 */

import type { CSSProperties, ReactNode } from 'react';
import type { Viewport } from '@xyflow/react';
import type {
  GraphNode,
  GraphFilters,
  ExtendedGraphFilters,
  GraphNodeType,
  BlastRadius,
  FlowNode,
  FlowEdge,
  CustomNodeData,
  NodeSelectHandler,
  FilterChangeHandler,
  GraphViewState,
} from '../types';

// ============================================================================
// GraphCanvas Props
// ============================================================================

/**
 * Props for the main GraphCanvas component
 */
export interface GraphCanvasProps {
  /** Scan ID to display graph for */
  scanId: string;
  /** Callback when a node is selected */
  onNodeSelect?: NodeSelectHandler;
  /** Additional CSS class names */
  className?: string;
  /** Show the filter panel */
  showFilters?: boolean;
  /** Show the search bar */
  showSearch?: boolean;
  /** Show the detail panel on node selection */
  showDetails?: boolean;
  /** Show the minimap navigation */
  showMinimap?: boolean;
  /** Show the zoom/pan controls */
  showControls?: boolean;
  /** Initial viewport settings */
  initialViewport?: Viewport;
  /** Callback when viewport changes */
  onViewportChange?: (viewport: Viewport) => void;
  /** Whether to fit view on initial render */
  fitViewOnInit?: boolean;
  /** Padding for fit view calculation */
  fitViewPadding?: number;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Custom node types mapping */
  nodeTypes?: Record<string, React.ComponentType<NodeComponentProps>>;
  /** Default edge options */
  defaultEdgeOptions?: Partial<FlowEdge>;
  /** Callback when graph data loads */
  onLoad?: (data: { nodes: FlowNode[]; edges: FlowEdge[] }) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Props for a custom node component
 */
export interface NodeComponentProps {
  /** Node ID */
  id: string;
  /** Custom node data */
  data: CustomNodeData;
  /** Whether node is selected */
  selected: boolean;
  /** X position */
  xPos: number;
  /** Y position */
  yPos: number;
  /** Whether node is dragging */
  dragging: boolean;
  /** Node type string */
  type: string;
  /** Z-index */
  zIndex: number;
  /** Whether the node is connectable */
  isConnectable: boolean;
  /** Position absolute mode */
  positionAbsoluteX: number;
  positionAbsoluteY: number;
}

// ============================================================================
// FilterPanel Props
// ============================================================================

/**
 * Props for the FilterPanel component
 */
export interface FilterPanelProps {
  /** Current filter values */
  filters: GraphFilters;
  /** Callback when filters change */
  onFilterChange: (filters: GraphFilters) => void;
  /** Callback to reset all filters */
  onReset?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Whether the panel is expanded by default */
  defaultExpanded?: boolean;
  /** Show blast radius toggle */
  showBlastRadiusToggle?: boolean;
  /** Available node types (for filtering which options to show) */
  availableNodeTypes?: GraphNodeType[];
  /** Compact mode for limited space */
  compact?: boolean;
}

/**
 * Props for ExtendedFilterPanel component
 */
export interface ExtendedFilterPanelProps extends Omit<FilterPanelProps, 'filters' | 'onFilterChange'> {
  /** Extended filter values */
  filters: ExtendedGraphFilters;
  /** Callback when filters change */
  onFilterChange: (filters: ExtendedGraphFilters) => void;
  /** Show confidence slider */
  showConfidenceFilter?: boolean;
  /** Show depth filter */
  showDepthFilter?: boolean;
  /** Show edge type filters */
  showEdgeTypeFilters?: boolean;
}

// ============================================================================
// SearchBar Props
// ============================================================================

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
  /** All nodes available for search */
  nodes: GraphNode[];
  /** Callback when a node is selected from results */
  onSelect: (nodeId: string) => void;
  /** Current search query */
  query: string;
  /** Callback when query changes */
  onQueryChange: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS class names */
  className?: string;
  /** Maximum results to show */
  maxResults?: number;
  /** Minimum characters before searching */
  minSearchLength?: number;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Custom render for result item */
  renderResult?: (node: GraphNode, isHighlighted: boolean) => ReactNode;
  /** Show keyboard shortcuts hint */
  showKeyboardHint?: boolean;
}

/**
 * Search result with match information
 */
export interface SearchResultItem {
  /** The matching node */
  item: GraphNode;
  /** Match score (lower is better in Fuse.js) */
  score: number;
  /** Array of match details */
  matches?: SearchMatch[];
}

/**
 * Match information for highlighting
 */
export interface SearchMatch {
  /** Key that matched */
  key: string;
  /** Indices of matching characters */
  indices: Array<[number, number]>;
  /** The matched value */
  value?: string;
}

// ============================================================================
// DetailPanel Props
// ============================================================================

/**
 * Props for the DetailPanel component
 */
export interface DetailPanelProps {
  /** Currently selected node */
  node: GraphNode | undefined;
  /** Node's dependencies */
  dependencies?: GraphNode[];
  /** Node's dependents */
  dependents?: GraphNode[];
  /** Loading state for node details */
  isLoading?: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback to show blast radius */
  onBlastRadius: () => void;
  /** Loading state for blast radius calculation */
  isLoadingBlastRadius?: boolean;
  /** Blast radius data */
  blastRadiusData?: BlastRadius;
  /** Callback when clicking a dependency/dependent node */
  onNodeClick?: (nodeId: string) => void;
  /** Additional CSS class names */
  className?: string;
  /** Panel position */
  position?: 'left' | 'right';
  /** Panel width */
  width?: number | string;
  /** Show metadata section */
  showMetadata?: boolean;
  /** Show location section */
  showLocation?: boolean;
  /** Maximum nodes to show in dependency/dependent lists */
  maxListItems?: number;
  /** Custom header renderer */
  renderHeader?: (node: GraphNode) => ReactNode;
}

/**
 * Section component props for DetailPanel
 */
export interface DetailSectionProps {
  /** Section title */
  title: string;
  /** Item count badge */
  count?: number;
  /** Message when section is empty */
  emptyMessage?: string;
  /** Section content */
  children?: ReactNode;
  /** Whether section is collapsible */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
}

// ============================================================================
// CustomNode Props
// ============================================================================

/**
 * Props for the CustomNode component (React Flow node)
 */
export interface CustomNodeProps {
  /** Node ID */
  id: string;
  /** Node data */
  data: CustomNodeData;
  /** Whether node is selected */
  selected?: boolean;
  /** X position */
  xPos?: number;
  /** Y position */
  yPos?: number;
  /** Whether node is being dragged */
  dragging?: boolean;
}

// ============================================================================
// Legend/Helper Components Props
// ============================================================================

/**
 * Props for GraphLegend component
 */
export interface GraphLegendProps {
  /** Node types to show in legend */
  nodeTypes?: GraphNodeType[];
  /** Additional CSS class names */
  className?: string;
  /** Show edge type legend */
  showEdgeTypes?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Click handler for legend items */
  onItemClick?: (type: GraphNodeType) => void;
  /** Currently filtered types (for highlighting) */
  activeTypes?: GraphNodeType[];
}

/**
 * Props for impact badge component
 */
export interface ImpactBadgeProps {
  /** Impact score (0-1) */
  score: number;
  /** Show percentage value */
  showPercentage?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class names */
  className?: string;
}

/**
 * Props for node type badge
 */
export interface NodeTypeBadgeProps {
  /** Node type */
  type: GraphNodeType;
  /** Show icon */
  showIcon?: boolean;
  /** Show label */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class names */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
}

// ============================================================================
// Toolbar Props
// ============================================================================

/**
 * Props for graph toolbar component
 */
export interface GraphToolbarProps {
  /** Callback for zoom in */
  onZoomIn?: () => void;
  /** Callback for zoom out */
  onZoomOut?: () => void;
  /** Callback for fit view */
  onFitView?: () => void;
  /** Callback for reset view */
  onResetView?: () => void;
  /** Callback for export */
  onExport?: (format: 'png' | 'svg' | 'json') => void;
  /** Callback for fullscreen toggle */
  onFullscreen?: () => void;
  /** Current zoom level */
  zoomLevel?: number;
  /** Is in fullscreen mode */
  isFullscreen?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Position of toolbar */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
}

// ============================================================================
// Empty/Loading/Error State Props
// ============================================================================

/**
 * Props for loading state component
 */
export interface GraphLoadingProps {
  /** Loading message */
  message?: string;
  /** Additional CSS class names */
  className?: string;
  /** Show spinner */
  showSpinner?: boolean;
}

/**
 * Props for error state component
 */
export interface GraphErrorProps {
  /** Error object or message */
  error: Error | string;
  /** Callback to retry */
  onRetry?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Props for empty state component
 */
export interface GraphEmptyProps {
  /** Empty state title */
  title?: string;
  /** Empty state message */
  message?: string;
  /** Additional CSS class names */
  className?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action callback */
  onAction?: () => void;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Graph context value type
 */
export interface GraphContextValue {
  /** Scan ID */
  scanId: string;
  /** Current filters */
  filters: GraphFilters;
  /** Filter change handler */
  setFilters: FilterChangeHandler;
  /** Selected node ID */
  selectedNodeId: string | null;
  /** Node selection handler */
  setSelectedNodeId: NodeSelectHandler;
  /** Highlighted node IDs */
  highlightedNodeIds: Set<string>;
  /** View state */
  viewState: GraphViewState;
  /** Set view state */
  setViewState: (state: GraphViewState) => void;
}
