/**
 * Graph Configuration Types
 * Type definitions for graph feature configuration
 * @module features/graph/config/types
 */

import type { LayoutDirection } from '../utils/constants';

// ============================================================================
// API Configuration
// ============================================================================

/**
 * API configuration settings
 */
export interface ApiConfig {
  /** Base URL for API requests */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts for failed requests */
  retryAttempts: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
  /** Enable request logging in development */
  enableRequestLogging: boolean;
}

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache configuration for React Query
 */
export interface CacheConfig {
  /** Time in ms before data is considered stale */
  staleTime: number;
  /** Time in ms before inactive data is garbage collected */
  gcTime: number;
  /** Refetch data when window regains focus */
  refetchOnFocus: boolean;
  /** Refetch data when component mounts */
  refetchOnMount: boolean;
  /** Refetch interval (0 = disabled) */
  refetchInterval: number;
  /** Cache time for blast radius calculations */
  blastRadiusStaleTime: number;
  /** Cache time for node details */
  nodeDetailStaleTime: number;
  /** Cache time for search results */
  searchStaleTime: number;
}

// ============================================================================
// Layout Configuration
// ============================================================================

/**
 * Layout algorithm type
 */
export type LayoutAlgorithm = 'dagre' | 'force' | 'radial' | 'hierarchical';

/**
 * Layout configuration for graph visualization
 */
export interface LayoutConfig {
  /** Default layout algorithm */
  algorithm: LayoutAlgorithm;
  /** Default layout direction for hierarchical layouts */
  direction: LayoutDirection;
  /** Horizontal spacing between nodes */
  nodeSpacing: number;
  /** Vertical spacing between ranks/levels */
  rankSpacing: number;
  /** Default node width */
  nodeWidth: number;
  /** Default node height */
  nodeHeight: number;
  /** Padding around the graph */
  padding: number;
  /** Enable animations during layout */
  enableAnimation: boolean;
  /** Animation duration in milliseconds */
  animationDuration: number;
}

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * UI configuration settings
 */
export interface UiConfig {
  /** Maximum search results to display */
  maxSearchResults: number;
  /** Debounce delay for search input in milliseconds */
  debounceMs: number;
  /** Animation duration for UI transitions */
  animationDuration: number;
  /** Minimum search query length */
  minSearchLength: number;
  /** Default zoom level */
  defaultZoom: number;
  /** Minimum zoom level */
  minZoom: number;
  /** Maximum zoom level */
  maxZoom: number;
  /** Zoom step for zoom controls */
  zoomStep: number;
  /** Padding for fit-to-view */
  fitViewPadding: number;
  /** Show minimap by default */
  showMinimap: boolean;
  /** Show controls by default */
  showControls: boolean;
  /** Enable pan on scroll */
  panOnScroll: boolean;
  /** Enable zoom on scroll */
  zoomOnScroll: boolean;
}

// ============================================================================
// Performance Limits
// ============================================================================

/**
 * Performance limit configuration
 */
export interface LimitsConfig {
  /** Maximum nodes before disabling animations */
  maxNodesForAnimation: number;
  /** Maximum nodes before hiding labels */
  maxNodesForLabels: number;
  /** Maximum depth for blast radius calculation */
  maxBlastRadiusDepth: number;
  /** Maximum nodes for client-side layout */
  maxNodesForClientLayout: number;
  /** Maximum edges for edge bundling */
  maxEdgesForBundling: number;
  /** Warning threshold for node count */
  nodeCountWarning: number;
  /** Maximum concurrent API requests */
  maxConcurrentRequests: number;
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flag configuration
 */
export interface FeaturesConfig {
  /** Enable graph export functionality */
  enableExport: boolean;
  /** Enable cycle detection */
  enableCycleDetection: boolean;
  /** Enable cluster view */
  enableClusterView: boolean;
  /** Enable blast radius analysis */
  enableBlastRadius: boolean;
  /** Enable advanced filters */
  enableAdvancedFilters: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts: boolean;
  /** Enable minimap */
  enableMinimap: boolean;
  /** Enable node preview on hover */
  enableNodePreview: boolean;
  /** Enable URL state persistence */
  enableUrlState: boolean;
  /** Enable dark mode */
  enableDarkMode: boolean;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Enable error reporting */
  enableErrorReporting: boolean;
}

// ============================================================================
// Theme Configuration
// ============================================================================

/**
 * Node color configuration by type
 */
export interface NodeColors {
  function: string;
  class: string;
  module: string;
  file: string;
  package: string;
  interface: string;
  type: string;
  variable: string;
  constant: string;
  enum: string;
  default: string;
}

/**
 * Edge color configuration by type
 */
export interface EdgeColors {
  imports: string;
  exports: string;
  calls: string;
  extends: string;
  implements: string;
  uses: string;
  default: string;
}

/**
 * Impact level colors for blast radius
 */
export interface ImpactColors {
  critical: string;
  high: string;
  medium: string;
  low: string;
  minimal: string;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  nodeColors: NodeColors;
  edgeColors: EdgeColors;
  impactColors: ImpactColors;
  backgroundColor: string;
  nodeSelectedColor: string;
  nodeHoveredColor: string;
  edgeSelectedColor: string;
  gridColor: string;
}

// ============================================================================
// Complete Graph Configuration
// ============================================================================

/**
 * Complete graph feature configuration
 */
export interface GraphConfig {
  /** API configuration */
  api: ApiConfig;
  /** Cache configuration */
  cache: CacheConfig;
  /** Layout configuration */
  layout: LayoutConfig;
  /** UI configuration */
  ui: UiConfig;
  /** Performance limits */
  limits: LimitsConfig;
  /** Feature flags */
  features: FeaturesConfig;
  /** Theme configuration */
  theme: ThemeConfig;
}

/**
 * Partial graph configuration for updates
 */
export type PartialGraphConfig = {
  [K in keyof GraphConfig]?: Partial<GraphConfig[K]>;
};

/**
 * Environment type for configuration
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Configuration change callback
 */
export type ConfigChangeCallback = (
  newConfig: GraphConfig,
  changedKeys: string[]
) => void;
