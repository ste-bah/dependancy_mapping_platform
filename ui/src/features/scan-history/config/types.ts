/**
 * Scan History Configuration Types
 * Type definitions for scan history feature configuration
 * @module features/scan-history/config/types
 */

import type { ScanStatus } from '../types/domain';

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
  /** Time in ms before scan list is considered stale */
  listStaleTime: number;
  /** Time in ms before scan detail is considered stale */
  detailStaleTime: number;
  /** Time in ms before diff data is considered stale */
  diffStaleTime: number;
  /** Time in ms before timeline data is considered stale */
  timelineStaleTime: number;
  /** Time in ms before inactive data is garbage collected */
  gcTime: number;
  /** Refetch data when window regains focus */
  refetchOnFocus: boolean;
  /** Refetch data when component mounts */
  refetchOnMount: boolean;
}

// ============================================================================
// Pagination Configuration
// ============================================================================

/**
 * Pagination configuration settings
 */
export interface PaginationConfig {
  /** Default number of items per page */
  defaultPageSize: number;
  /** Available page size options */
  pageSizeOptions: readonly number[];
  /** Maximum allowed page size */
  maxPageSize: number;
}

// ============================================================================
// Timeline Configuration
// ============================================================================

/**
 * Timeline zoom level type
 */
export type TimelineZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Timeline configuration settings
 */
export interface TimelineConfig {
  /** Default zoom level */
  defaultZoom: TimelineZoomLevel;
  /** Available zoom levels */
  zoomLevels: readonly TimelineZoomLevel[];
  /** Maximum number of data points to display */
  maxDataPoints: number;
  /** Enable timeline animations */
  enableAnimations: boolean;
}

// ============================================================================
// Export Configuration
// ============================================================================

/**
 * Export format type
 */
export type ExportFormat = 'csv' | 'json' | 'pdf';

/**
 * Export configuration settings
 */
export interface ExportConfig {
  /** Maximum number of scans to export at once */
  maxScans: number;
  /** Available export formats */
  formats: readonly ExportFormat[];
  /** Default export format */
  defaultFormat: ExportFormat;
  /** Include metrics in export */
  includeMetrics: boolean;
  /** Include file breakdown in export */
  includeFileBreakdown: boolean;
}

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * UI configuration settings
 */
export interface UiConfig {
  /** Debounce delay for search input in milliseconds */
  debounceMs: number;
  /** Animation duration for UI transitions */
  animationDuration: number;
  /** Toast notification duration in milliseconds */
  toastDuration: number;
  /** Minimum search query length */
  minSearchLength: number;
  /** Enable virtual scrolling for long lists */
  enableVirtualScroll: boolean;
  /** Virtual scroll item height */
  virtualScrollItemHeight: number;
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flag configuration
 */
export interface FeaturesConfig {
  /** Enable timeline visualization */
  enableTimeline: boolean;
  /** Enable export functionality */
  enableExport: boolean;
  /** Enable scan comparison feature */
  enableComparison: boolean;
  /** Enable PDF export (experimental) */
  enablePdfExport: boolean;
  /** Enable bulk actions on scans */
  enableBulkActions: boolean;
  /** Enable scan retry feature */
  enableScanRetry: boolean;
  /** Enable URL state persistence */
  enableUrlState: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts: boolean;
  /** Enable real-time updates */
  enableRealtimeUpdates: boolean;
  /** Enable advanced filtering */
  enableAdvancedFilters: boolean;
}

// ============================================================================
// Theme Configuration
// ============================================================================

/**
 * Status color mapping
 */
export type StatusColors = Record<ScanStatus, string>;

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Colors for scan statuses */
  statusColors: StatusColors;
  /** Colors for metric trends */
  trendColors: {
    positive: string;
    negative: string;
    neutral: string;
  };
  /** Colors for severity levels */
  severityColors: {
    critical: string;
    high: string;
    medium: string;
    low: string;
    info: string;
  };
}

// ============================================================================
// Complete Configuration
// ============================================================================

/**
 * Complete scan history feature configuration
 */
export interface ScanHistoryConfig {
  /** API configuration */
  api: ApiConfig;
  /** Cache configuration */
  cache: CacheConfig;
  /** Pagination configuration */
  pagination: PaginationConfig;
  /** Timeline configuration */
  timeline: TimelineConfig;
  /** Export configuration */
  export: ExportConfig;
  /** UI configuration */
  ui: UiConfig;
  /** Feature flags */
  features: FeaturesConfig;
  /** Theme configuration */
  theme: ThemeConfig;
}

/**
 * Partial scan history configuration for updates
 */
export type PartialScanHistoryConfig = {
  [K in keyof ScanHistoryConfig]?: Partial<ScanHistoryConfig[K]>;
};

/**
 * Environment type for configuration
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Configuration change callback
 */
export type ConfigChangeCallback = (
  newConfig: ScanHistoryConfig,
  changedKeys: string[]
) => void;
