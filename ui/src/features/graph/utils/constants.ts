/**
 * Graph Utility Constants
 * Configuration constants for graph visualization utilities
 * @module features/graph/utils/constants
 */

import type { IFuseOptions } from 'fuse.js';
import type { GraphNode } from '../types';

// ============================================================================
// Layout Constants
// ============================================================================

/**
 * Layout direction options for dagre algorithm
 */
export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

/**
 * Layout alignment options
 */
export type LayoutAlign = 'UL' | 'UR' | 'DL' | 'DR' | undefined;

/**
 * Layout options for the dagre layout algorithm
 */
export interface LayoutOptions {
  /** Layout direction: TB (top-bottom), BT (bottom-top), LR (left-right), RL (right-left) */
  direction: LayoutDirection;
  /** Horizontal spacing between nodes */
  nodeWidth: number;
  /** Vertical spacing between nodes */
  nodeHeight: number;
  /** Horizontal separation between nodes */
  horizontalSpacing: number;
  /** Vertical separation between nodes */
  verticalSpacing: number;
  /** Alignment within the rank */
  align: LayoutAlign;
  /** Ranker algorithm: 'network-simplex', 'tight-tree', 'longest-path' */
  ranker: 'network-simplex' | 'tight-tree' | 'longest-path';
  /** Acyclicer algorithm for handling cycles */
  acyclicer: 'greedy' | undefined;
  /** Margin around the entire graph */
  marginX: number;
  marginY: number;
}

/**
 * Default layout options for dagre algorithm
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: 'TB',
  nodeWidth: 200,
  nodeHeight: 80,
  horizontalSpacing: 50,
  verticalSpacing: 80,
  align: undefined,
  ranker: 'network-simplex',
  acyclicer: 'greedy',
  marginX: 20,
  marginY: 20,
};

/**
 * Preset layout configurations
 */
export const LAYOUT_PRESETS = {
  /** Hierarchical top-down layout (default) */
  hierarchical: {
    ...DEFAULT_LAYOUT_OPTIONS,
    direction: 'TB' as LayoutDirection,
    ranker: 'network-simplex' as const,
  },
  /** Horizontal left-to-right layout */
  horizontal: {
    ...DEFAULT_LAYOUT_OPTIONS,
    direction: 'LR' as LayoutDirection,
    horizontalSpacing: 80,
    verticalSpacing: 50,
  },
  /** Compact layout with tighter spacing */
  compact: {
    ...DEFAULT_LAYOUT_OPTIONS,
    nodeWidth: 160,
    nodeHeight: 60,
    horizontalSpacing: 30,
    verticalSpacing: 50,
  },
  /** Expanded layout for readability */
  expanded: {
    ...DEFAULT_LAYOUT_OPTIONS,
    horizontalSpacing: 100,
    verticalSpacing: 120,
  },
} as const;

// ============================================================================
// Fuse.js Search Constants
// ============================================================================

/**
 * Fuse.js configuration options for node search
 */
export const FUSE_OPTIONS: IFuseOptions<GraphNode> = {
  /** Include match score in results */
  includeScore: true,
  /** Include match indices for highlighting */
  includeMatches: true,
  /** Fuzzy matching threshold (0 = perfect match, 1 = match anything) */
  threshold: 0.4,
  /** Ignore location bonus (match anywhere in string) */
  ignoreLocation: true,
  /** Use extended search syntax */
  useExtendedSearch: false,
  /** Fields to search */
  keys: [
    { name: 'name', weight: 2.0 },
    { name: 'id', weight: 1.5 },
    { name: 'type', weight: 1.0 },
    { name: 'location.filePath', weight: 0.8 },
  ],
  /** Minimum characters before search activates */
  minMatchCharLength: 2,
  /** Find all matches, not just best */
  findAllMatches: false,
  /** Sort results by score */
  shouldSort: true,
};

/**
 * Default search configuration
 */
export const SEARCH_DEFAULTS = {
  /** Minimum query length to trigger search */
  minQueryLength: 2,
  /** Maximum results to return */
  maxResults: 20,
  /** Debounce delay in milliseconds */
  debounceMs: 200,
  /** Highlight tag for matched text */
  highlightTag: 'mark',
} as const;

// ============================================================================
// Cache Time Constants
// ============================================================================

/**
 * Cache time configuration for React Query
 */
export const CACHE_TIMES = {
  /** Time in ms before data is considered stale */
  stale: 5 * 60 * 1000, // 5 minutes
  /** Time in ms before inactive data is garbage collected */
  gc: 30 * 60 * 1000, // 30 minutes
  /** Refetch interval for active queries (0 = disabled) */
  refetchInterval: 0,
  /** Cache time for blast radius calculations */
  blastRadiusStale: 10 * 60 * 1000, // 10 minutes
  /** Cache time for node details */
  nodeDetailStale: 5 * 60 * 1000, // 5 minutes
  /** Cache time for search results */
  searchStale: 2 * 60 * 1000, // 2 minutes
} as const;

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Animation durations in milliseconds
 */
export const ANIMATION_DURATIONS = {
  /** Layout transition */
  layoutTransition: 300,
  /** Viewport pan/zoom */
  viewportTransition: 200,
  /** Node highlight fade */
  highlightFade: 150,
  /** Panel slide */
  panelSlide: 250,
} as const;

/**
 * Viewport constraints
 */
export const VIEWPORT_CONSTRAINTS = {
  /** Minimum zoom level */
  minZoom: 0.1,
  /** Maximum zoom level */
  maxZoom: 2.0,
  /** Default zoom level */
  defaultZoom: 0.75,
  /** Fit view padding in pixels */
  fitViewPadding: 50,
  /** Zoom step for zoom in/out buttons */
  zoomStep: 0.2,
} as const;

/**
 * Node size constraints
 */
export const NODE_DIMENSIONS = {
  /** Default node width */
  width: 200,
  /** Default node height */
  height: 80,
  /** Minimum node width */
  minWidth: 150,
  /** Maximum node width */
  maxWidth: 300,
  /** Border radius */
  borderRadius: 8,
} as const;

// ============================================================================
// URL State Constants
// ============================================================================

/**
 * URL parameter keys for state serialization
 */
export const URL_PARAM_KEYS = {
  /** Node types filter */
  nodeTypes: 'types',
  /** Edge types filter */
  edgeTypes: 'edges',
  /** Search query */
  search: 'q',
  /** Selected node ID */
  selected: 'node',
  /** Blast radius mode */
  blastRadius: 'blast',
  /** Minimum confidence filter */
  minConfidence: 'conf',
  /** Maximum depth filter */
  maxDepth: 'depth',
  /** Connected only filter */
  connectedOnly: 'connected',
  /** Viewport zoom */
  zoom: 'z',
  /** Viewport x position */
  viewX: 'x',
  /** Viewport y position */
  viewY: 'y',
} as const;

/**
 * Separator for array values in URL params
 */
export const URL_ARRAY_SEPARATOR = ',';

// ============================================================================
// Blast Radius Constants
// ============================================================================

/**
 * Impact level thresholds for blast radius calculations
 */
export const IMPACT_THRESHOLDS = {
  /** Critical impact threshold (>= this score) */
  critical: 0.8,
  /** High impact threshold */
  high: 0.6,
  /** Medium impact threshold */
  medium: 0.4,
  /** Low impact threshold */
  low: 0.2,
  /** Below low is minimal */
} as const;

/**
 * Maximum traversal depth for blast radius
 */
export const MAX_BLAST_RADIUS_DEPTH = 10;

/**
 * Impact level colors for visualization
 */
export const IMPACT_COLORS = {
  critical: '#EF4444', // Red
  high: '#F97316', // Orange
  medium: '#EAB308', // Yellow
  low: '#22C55E', // Green
  minimal: '#6B7280', // Gray
} as const;
