/**
 * Graph Configuration
 * Default configuration for graph visualization feature
 * @module features/graph/config
 */

import type {
  GraphConfig,
  ApiConfig,
  CacheConfig,
  LayoutConfig,
  UiConfig,
  LimitsConfig,
  FeaturesConfig,
  ThemeConfig,
} from './types';

// ============================================================================
// Default API Configuration
// ============================================================================

/**
 * Default API settings
 */
export const defaultApiConfig: ApiConfig = {
  baseUrl: '/api/v1',
  timeout: 30_000,
  retryAttempts: 3,
  retryDelay: 1_000,
  enableRequestLogging: false,
};

// ============================================================================
// Default Cache Configuration
// ============================================================================

/**
 * Default cache settings for React Query
 */
export const defaultCacheConfig: CacheConfig = {
  staleTime: 60_000,              // 1 minute
  gcTime: 5 * 60_000,             // 5 minutes
  refetchOnFocus: false,
  refetchOnMount: false,
  refetchInterval: 0,
  blastRadiusStaleTime: 10 * 60_000,  // 10 minutes
  nodeDetailStaleTime: 5 * 60_000,    // 5 minutes
  searchStaleTime: 2 * 60_000,        // 2 minutes
};

// ============================================================================
// Default Layout Configuration
// ============================================================================

/**
 * Default layout settings
 */
export const defaultLayoutConfig: LayoutConfig = {
  algorithm: 'dagre',
  direction: 'TB',
  nodeSpacing: 50,
  rankSpacing: 100,
  nodeWidth: 200,
  nodeHeight: 80,
  padding: 50,
  enableAnimation: true,
  animationDuration: 300,
};

// ============================================================================
// Default UI Configuration
// ============================================================================

/**
 * Default UI settings
 */
export const defaultUiConfig: UiConfig = {
  maxSearchResults: 20,
  debounceMs: 300,
  animationDuration: 200,
  minSearchLength: 2,
  defaultZoom: 0.75,
  minZoom: 0.1,
  maxZoom: 2.0,
  zoomStep: 0.2,
  fitViewPadding: 50,
  showMinimap: false,
  showControls: true,
  panOnScroll: true,
  zoomOnScroll: true,
};

// ============================================================================
// Default Limits Configuration
// ============================================================================

/**
 * Default performance limits
 */
export const defaultLimitsConfig: LimitsConfig = {
  maxNodesForAnimation: 500,
  maxNodesForLabels: 200,
  maxBlastRadiusDepth: 10,
  maxNodesForClientLayout: 1000,
  maxEdgesForBundling: 2000,
  nodeCountWarning: 300,
  maxConcurrentRequests: 3,
};

// ============================================================================
// Default Feature Flags
// ============================================================================

/**
 * Default feature flags
 */
export const defaultFeaturesConfig: FeaturesConfig = {
  enableExport: true,
  enableCycleDetection: true,
  enableClusterView: false,
  enableBlastRadius: true,
  enableAdvancedFilters: true,
  enableKeyboardShortcuts: true,
  enableMinimap: true,
  enableNodePreview: true,
  enableUrlState: true,
  enableDarkMode: true,
  enablePerformanceMonitoring: false,
  enableErrorReporting: true,
};

// ============================================================================
// Default Theme Configuration
// ============================================================================

/**
 * Default theme settings
 */
export const defaultThemeConfig: ThemeConfig = {
  nodeColors: {
    function: '#3B82F6',   // Blue
    class: '#8B5CF6',      // Purple
    module: '#10B981',     // Emerald
    file: '#6B7280',       // Gray
    package: '#F59E0B',    // Amber
    interface: '#EC4899',  // Pink
    type: '#06B6D4',       // Cyan
    variable: '#84CC16',   // Lime
    constant: '#F97316',   // Orange
    enum: '#14B8A6',       // Teal
    default: '#6B7280',    // Gray
  },
  edgeColors: {
    imports: '#3B82F6',    // Blue
    exports: '#10B981',    // Emerald
    calls: '#8B5CF6',      // Purple
    extends: '#F59E0B',    // Amber
    implements: '#EC4899', // Pink
    uses: '#6B7280',       // Gray
    default: '#9CA3AF',    // Gray-400
  },
  impactColors: {
    critical: '#EF4444',   // Red
    high: '#F97316',       // Orange
    medium: '#EAB308',     // Yellow
    low: '#22C55E',        // Green
    minimal: '#6B7280',    // Gray
  },
  backgroundColor: '#FFFFFF',
  nodeSelectedColor: '#2563EB',
  nodeHoveredColor: '#60A5FA',
  edgeSelectedColor: '#1D4ED8',
  gridColor: '#E5E7EB',
};

// ============================================================================
// Complete Default Configuration
// ============================================================================

/**
 * Complete default graph configuration
 * This serves as the base configuration that can be overridden
 * by environment variables or runtime updates
 */
export const graphConfig: GraphConfig = {
  api: defaultApiConfig,
  cache: defaultCacheConfig,
  layout: defaultLayoutConfig,
  ui: defaultUiConfig,
  limits: defaultLimitsConfig,
  features: defaultFeaturesConfig,
  theme: defaultThemeConfig,
};

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Deep freeze an object to prevent accidental modifications
 * @param obj - Object to freeze
 * @returns Frozen object
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.keys(obj).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value && typeof value === 'object') {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}

/**
 * Frozen default configuration (immutable)
 */
export const FROZEN_DEFAULT_CONFIG: Readonly<GraphConfig> = deepFreeze({
  ...graphConfig,
});

/**
 * Get a specific configuration section
 * @param section - Configuration section key
 * @returns Configuration section value
 */
export function getConfigSection<K extends keyof GraphConfig>(
  section: K
): GraphConfig[K] {
  return graphConfig[section];
}

/**
 * Check if current node count exceeds animation limit
 * @param nodeCount - Current node count
 * @returns Whether animations should be disabled
 */
export function shouldDisableAnimations(nodeCount: number): boolean {
  return nodeCount > graphConfig.limits.maxNodesForAnimation;
}

/**
 * Check if current node count exceeds label limit
 * @param nodeCount - Current node count
 * @returns Whether labels should be hidden
 */
export function shouldHideLabels(nodeCount: number): boolean {
  return nodeCount > graphConfig.limits.maxNodesForLabels;
}

/**
 * Check if node count is at warning level
 * @param nodeCount - Current node count
 * @returns Whether to show warning
 */
export function isNodeCountWarning(nodeCount: number): boolean {
  return nodeCount > graphConfig.limits.nodeCountWarning;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  GraphConfig,
  ApiConfig,
  CacheConfig,
  LayoutConfig,
  UiConfig,
  LimitsConfig,
  FeaturesConfig,
  ThemeConfig,
  PartialGraphConfig,
  Environment,
  NodeColors,
  EdgeColors,
  ImpactColors,
  LayoutAlgorithm,
  ConfigChangeCallback,
} from './types';
