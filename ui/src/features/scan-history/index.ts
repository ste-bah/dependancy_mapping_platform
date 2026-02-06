/**
 * Scan History Feature
 * Feature entry point for scan history timeline functionality
 * @module features/scan-history
 */

// ============================================================================
// Type Exports
// ============================================================================

// Re-export all types from the types module
export * from './types';

// ============================================================================
// Utility Exports
// ============================================================================

// Re-export all utilities from the utils module
export * from './utils';

// ============================================================================
// Component Exports
// ============================================================================

// Re-export all components from the components module
export {
  ScanHistoryPage,
  ScanTimelineChart,
  ScanListTable,
  ScanFilterPanel,
  ScanComparisonPanel,
} from './components';

// ============================================================================
// Hook Exports
// ============================================================================

// Re-export hooks from the hooks module
export * from './hooks';

// ============================================================================
// API Exports
// ============================================================================

// Re-export API functions
export * from './api';

// ============================================================================
// Store Exports
// ============================================================================

// Re-export store and selectors
export * from './store';

// ============================================================================
// Config Exports
// ============================================================================

// Re-export configuration and constants
export {
  // Main configuration
  SCAN_HISTORY_CONFIG,
  scanHistoryConfig,
  // Default configurations
  defaultApiConfig,
  defaultCacheConfig,
  defaultPaginationConfig,
  defaultTimelineConfig,
  defaultExportConfig,
  defaultUiConfig,
  defaultFeaturesConfig,
  defaultThemeConfig,
  // Utility functions
  getConfigSection,
  mergeConfig,
  isFeatureEnabled,
  getStaleTime,
  getPageSizeOptions,
  isValidPageSize,
  getAvailableExportFormats,
  // Environment functions
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,
  getScanHistoryEnvConfig,
  // Constants
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
} from './config';

// Re-export config types
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
  ExportFormat as ConfigExportFormat,
  ConfigChangeCallback,
} from './config';
