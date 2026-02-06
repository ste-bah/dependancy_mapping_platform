/**
 * Scan History Configuration
 * Default configuration for scan history feature
 * @module features/scan-history/config
 */

import type {
  ScanHistoryConfig,
  ApiConfig,
  CacheConfig,
  PaginationConfig,
  TimelineConfig,
  ExportConfig,
  UiConfig,
  FeaturesConfig,
  ThemeConfig,
  PartialScanHistoryConfig,
} from './types';
import { STATUS_COLORS, SEVERITY_COLORS, TREND_COLORS } from './constants';

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
  listStaleTime: 60_000,        // 1 minute
  detailStaleTime: 300_000,     // 5 minutes
  diffStaleTime: 600_000,       // 10 minutes
  timelineStaleTime: 120_000,   // 2 minutes
  gcTime: 1_800_000,            // 30 minutes
  refetchOnFocus: true,
  refetchOnMount: false,
};

// ============================================================================
// Default Pagination Configuration
// ============================================================================

/**
 * Default pagination settings
 */
export const defaultPaginationConfig: PaginationConfig = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100] as const,
  maxPageSize: 100,
};

// ============================================================================
// Default Timeline Configuration
// ============================================================================

/**
 * Default timeline settings
 */
export const defaultTimelineConfig: TimelineConfig = {
  defaultZoom: 'month',
  zoomLevels: ['day', 'week', 'month', 'quarter', 'year'] as const,
  maxDataPoints: 365,
  enableAnimations: true,
};

// ============================================================================
// Default Export Configuration
// ============================================================================

/**
 * Default export settings
 */
export const defaultExportConfig: ExportConfig = {
  maxScans: 1000,
  formats: ['csv', 'json', 'pdf'] as const,
  defaultFormat: 'csv',
  includeMetrics: true,
  includeFileBreakdown: false,
};

// ============================================================================
// Default UI Configuration
// ============================================================================

/**
 * Default UI settings
 */
export const defaultUiConfig: UiConfig = {
  debounceMs: 300,
  animationDuration: 200,
  toastDuration: 5000,
  minSearchLength: 2,
  enableVirtualScroll: true,
  virtualScrollItemHeight: 64,
};

// ============================================================================
// Default Feature Flags
// ============================================================================

/**
 * Default feature flags
 */
export const defaultFeaturesConfig: FeaturesConfig = {
  enableTimeline: true,
  enableExport: true,
  enableComparison: true,
  enablePdfExport: false,      // Coming soon
  enableBulkActions: true,
  enableScanRetry: true,
  enableUrlState: true,
  enableKeyboardShortcuts: true,
  enableRealtimeUpdates: false,
  enableAdvancedFilters: true,
};

// ============================================================================
// Default Theme Configuration
// ============================================================================

/**
 * Default theme settings
 */
export const defaultThemeConfig: ThemeConfig = {
  statusColors: STATUS_COLORS,
  trendColors: {
    positive: TREND_COLORS.positive,
    negative: TREND_COLORS.negative,
    neutral: TREND_COLORS.neutral,
  },
  severityColors: {
    critical: SEVERITY_COLORS.critical,
    high: SEVERITY_COLORS.high,
    medium: SEVERITY_COLORS.medium,
    low: SEVERITY_COLORS.low,
    info: SEVERITY_COLORS.info,
  },
};

// ============================================================================
// Complete Default Configuration
// ============================================================================

/**
 * Complete default scan history configuration
 * This serves as the base configuration that can be overridden
 * by environment variables or runtime updates
 */
export const scanHistoryConfig: ScanHistoryConfig = {
  api: defaultApiConfig,
  cache: defaultCacheConfig,
  pagination: defaultPaginationConfig,
  timeline: defaultTimelineConfig,
  export: defaultExportConfig,
  ui: defaultUiConfig,
  features: defaultFeaturesConfig,
  theme: defaultThemeConfig,
};

// ============================================================================
// Convenience Export (Named for clarity)
// ============================================================================

/**
 * Main configuration export with descriptive name
 * Use this for importing the scan history configuration
 *
 * @example
 * ```ts
 * import { SCAN_HISTORY_CONFIG } from '@features/scan-history/config';
 *
 * const pageSize = SCAN_HISTORY_CONFIG.pagination.defaultPageSize;
 * const isTimelineEnabled = SCAN_HISTORY_CONFIG.features.enableTimeline;
 * ```
 */
export const SCAN_HISTORY_CONFIG = scanHistoryConfig;

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
export const FROZEN_DEFAULT_CONFIG: Readonly<ScanHistoryConfig> = deepFreeze({
  ...scanHistoryConfig,
});

/**
 * Get a specific configuration section
 * @param section - Configuration section key
 * @returns Configuration section value
 */
export function getConfigSection<K extends keyof ScanHistoryConfig>(
  section: K
): ScanHistoryConfig[K] {
  return scanHistoryConfig[section];
}

/**
 * Merge partial configuration with defaults
 * @param overrides - Partial configuration overrides
 * @returns Complete configuration with overrides applied
 */
export function mergeConfig(
  overrides: PartialScanHistoryConfig
): ScanHistoryConfig {
  return {
    api: { ...scanHistoryConfig.api, ...overrides.api },
    cache: { ...scanHistoryConfig.cache, ...overrides.cache },
    pagination: { ...scanHistoryConfig.pagination, ...overrides.pagination },
    timeline: { ...scanHistoryConfig.timeline, ...overrides.timeline },
    export: { ...scanHistoryConfig.export, ...overrides.export },
    ui: { ...scanHistoryConfig.ui, ...overrides.ui },
    features: { ...scanHistoryConfig.features, ...overrides.features },
    theme: {
      ...scanHistoryConfig.theme,
      ...overrides.theme,
      statusColors: {
        ...scanHistoryConfig.theme.statusColors,
        ...overrides.theme?.statusColors,
      },
      trendColors: {
        ...scanHistoryConfig.theme.trendColors,
        ...overrides.theme?.trendColors,
      },
      severityColors: {
        ...scanHistoryConfig.theme.severityColors,
        ...overrides.theme?.severityColors,
      },
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a feature is enabled
 * @param feature - Feature flag key
 * @returns Whether the feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeaturesConfig): boolean {
  return scanHistoryConfig.features[feature];
}

/**
 * Get cache stale time for a specific query type
 * @param queryType - Type of query
 * @returns Stale time in milliseconds
 */
export function getStaleTime(
  queryType: 'list' | 'detail' | 'diff' | 'timeline'
): number {
  const staleTimeMap = {
    list: scanHistoryConfig.cache.listStaleTime,
    detail: scanHistoryConfig.cache.detailStaleTime,
    diff: scanHistoryConfig.cache.diffStaleTime,
    timeline: scanHistoryConfig.cache.timelineStaleTime,
  };
  return staleTimeMap[queryType];
}

/**
 * Get pagination options array for select dropdowns
 * @returns Array of page size options
 */
export function getPageSizeOptions(): readonly number[] {
  return scanHistoryConfig.pagination.pageSizeOptions;
}

/**
 * Check if page size is valid
 * @param pageSize - Page size to validate
 * @returns Whether the page size is valid
 */
export function isValidPageSize(pageSize: number): boolean {
  return (
    pageSize > 0 &&
    pageSize <= scanHistoryConfig.pagination.maxPageSize &&
    scanHistoryConfig.pagination.pageSizeOptions.includes(pageSize)
  );
}

/**
 * Get export formats available
 * @returns Array of available export formats
 */
export function getAvailableExportFormats(): readonly string[] {
  const formats = [...scanHistoryConfig.export.formats];
  if (!scanHistoryConfig.features.enablePdfExport) {
    return formats.filter((f) => f !== 'pdf');
  }
  return formats;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  ScanHistoryConfig,
  ApiConfig,
  CacheConfig,
  PaginationConfig,
  TimelineConfig,
  ExportConfig,
  UiConfig,
  FeaturesConfig,
  ThemeConfig,
  PartialScanHistoryConfig,
  Environment,
  TimelineZoomLevel,
  ExportFormat,
  ConfigChangeCallback,
} from './types';

export {
  STATUS_COLORS,
  STATUS_BG_COLORS,
  STATUS_LABELS,
  STATUS_ICONS,
  DATE_FORMATS,
  DEFAULT_LOCALE,
  ROUTES,
  URL_PARAMS,
  URL_ARRAY_SEPARATOR,
  TIMELINE_ZOOM_LEVELS,
  TIMELINE_ZOOM_LABELS,
  TIMELINE_COLORS,
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABELS,
  EXPORT_MIME_TYPES,
  EXPORT_FILE_EXTENSIONS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  TREND_COLORS,
  DATE_RANGE_PRESETS,
  SORT_OPTIONS,
  SORT_ORDERS,
  KEYBOARD_SHORTCUTS,
  ARIA_LABELS,
  buildScanDetailRoute,
  buildCompareRoute,
} from './constants';

export {
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,
  getScanHistoryEnvConfig,
  validateEnvConfig,
  logEnvConfig,
} from './env';
