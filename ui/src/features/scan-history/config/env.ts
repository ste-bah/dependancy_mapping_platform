/**
 * Scan History Environment Configuration
 * Environment-specific configuration overrides using Vite's import.meta.env
 * @module features/scan-history/config/env
 */

import type {
  ScanHistoryConfig,
  PartialScanHistoryConfig,
  Environment,
  FeaturesConfig,
} from './types';

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Get the current environment
 * @returns Current environment type
 */
export function getEnvironment(): Environment {
  const mode = import.meta.env.MODE;

  if (mode === 'production') return 'production';
  if (mode === 'staging') return 'staging';
  if (mode === 'test') return 'test';

  return 'development';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV === true;
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD === true;
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getEnvironment() === 'test';
}

// ============================================================================
// Environment Variable Parsing
// ============================================================================

/**
 * Parse a boolean environment variable
 * @param value - Environment variable value
 * @param defaultValue - Default if not set or invalid
 * @returns Parsed boolean
 */
function parseEnvBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse a number environment variable
 * @param value - Environment variable value
 * @param defaultValue - Default if not set or invalid
 * @returns Parsed number
 */
function parseEnvNumber(
  value: string | undefined,
  defaultValue: number
): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a string environment variable
 * @param value - Environment variable value
 * @param defaultValue - Default if not set
 * @returns Parsed string
 */
function parseEnvString(
  value: string | undefined,
  defaultValue: string
): string {
  if (value === undefined || value === '') return defaultValue;
  return value;
}

// ============================================================================
// Environment-Specific Overrides
// ============================================================================

/**
 * Get API configuration from environment variables
 */
function getApiEnvConfig(): Partial<ScanHistoryConfig['api']> {
  return {
    baseUrl: parseEnvString(
      import.meta.env.VITE_SCAN_HISTORY_API_BASE_URL,
      '/api/v1'
    ),
    timeout: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_API_TIMEOUT,
      30_000
    ),
    retryAttempts: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_API_RETRY_ATTEMPTS,
      3
    ),
    enableRequestLogging: parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_REQUEST_LOGGING,
      isDevelopment()
    ),
  };
}

/**
 * Get cache configuration from environment variables
 */
function getCacheEnvConfig(): Partial<ScanHistoryConfig['cache']> {
  return {
    listStaleTime: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_CACHE_LIST_STALE_TIME,
      60_000
    ),
    detailStaleTime: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_CACHE_DETAIL_STALE_TIME,
      300_000
    ),
    diffStaleTime: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_CACHE_DIFF_STALE_TIME,
      600_000
    ),
    timelineStaleTime: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_CACHE_TIMELINE_STALE_TIME,
      120_000
    ),
    gcTime: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_CACHE_GC_TIME,
      1_800_000
    ),
    refetchOnFocus: parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_REFETCH_ON_FOCUS,
      true
    ),
  };
}

/**
 * Get pagination configuration from environment variables
 */
function getPaginationEnvConfig(): Partial<ScanHistoryConfig['pagination']> {
  return {
    defaultPageSize: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_DEFAULT_PAGE_SIZE,
      20
    ),
    maxPageSize: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_MAX_PAGE_SIZE,
      100
    ),
  };
}

/**
 * Get UI configuration from environment variables
 */
function getUiEnvConfig(): Partial<ScanHistoryConfig['ui']> {
  return {
    debounceMs: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_DEBOUNCE_MS,
      300
    ),
    animationDuration: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_ANIMATION_DURATION,
      200
    ),
    toastDuration: parseEnvNumber(
      import.meta.env.VITE_SCAN_HISTORY_TOAST_DURATION,
      5000
    ),
  };
}

/**
 * Get feature flags from environment variables
 */
function getFeaturesEnvConfig(): Partial<FeaturesConfig> {
  const features: Partial<FeaturesConfig> = {};

  // Only override if explicitly set in environment
  if (import.meta.env.VITE_SCAN_HISTORY_ENABLE_TIMELINE !== undefined) {
    features.enableTimeline = parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_TIMELINE,
      true
    );
  }

  if (import.meta.env.VITE_SCAN_HISTORY_ENABLE_EXPORT !== undefined) {
    features.enableExport = parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_EXPORT,
      true
    );
  }

  if (import.meta.env.VITE_SCAN_HISTORY_ENABLE_COMPARISON !== undefined) {
    features.enableComparison = parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_COMPARISON,
      true
    );
  }

  if (import.meta.env.VITE_SCAN_HISTORY_ENABLE_PDF_EXPORT !== undefined) {
    features.enablePdfExport = parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_PDF_EXPORT,
      false
    );
  }

  if (import.meta.env.VITE_SCAN_HISTORY_ENABLE_BULK_ACTIONS !== undefined) {
    features.enableBulkActions = parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_BULK_ACTIONS,
      true
    );
  }

  if (import.meta.env.VITE_SCAN_HISTORY_ENABLE_REALTIME !== undefined) {
    features.enableRealtimeUpdates = parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_REALTIME,
      false
    );
  }

  if (import.meta.env.VITE_SCAN_HISTORY_ENABLE_ADVANCED_FILTERS !== undefined) {
    features.enableAdvancedFilters = parseEnvBoolean(
      import.meta.env.VITE_SCAN_HISTORY_ENABLE_ADVANCED_FILTERS,
      true
    );
  }

  return features;
}

// ============================================================================
// Environment-Based Configuration
// ============================================================================

/**
 * Development environment overrides
 */
const developmentOverrides: PartialScanHistoryConfig = {
  api: {
    enableRequestLogging: true,
    timeout: 60_000, // Longer timeout for debugging
  },
  cache: {
    listStaleTime: 30_000, // Shorter stale time for development
    refetchOnFocus: true,
  },
  features: {
    enablePdfExport: true, // Enable experimental features in dev
    enableRealtimeUpdates: true,
  },
};

/**
 * Staging environment overrides
 */
const stagingOverrides: PartialScanHistoryConfig = {
  api: {
    enableRequestLogging: true,
  },
  cache: {
    listStaleTime: 60_000,
  },
  features: {
    enablePdfExport: false,
    enableRealtimeUpdates: true,
  },
};

/**
 * Production environment overrides
 */
const productionOverrides: PartialScanHistoryConfig = {
  api: {
    enableRequestLogging: false,
  },
  cache: {
    listStaleTime: 120_000, // Longer stale time for production
    gcTime: 30 * 60_000,    // 30 minutes gc time
    refetchOnFocus: true,
  },
  features: {
    enablePdfExport: false,
    enableRealtimeUpdates: false,
  },
};

/**
 * Test environment overrides
 */
const testOverrides: PartialScanHistoryConfig = {
  api: {
    timeout: 5_000, // Short timeout for tests
    retryAttempts: 1,
    enableRequestLogging: false,
  },
  cache: {
    listStaleTime: 0, // No caching in tests
    detailStaleTime: 0,
    diffStaleTime: 0,
    timelineStaleTime: 0,
    gcTime: 0,
    refetchOnFocus: false,
    refetchOnMount: false,
  },
  ui: {
    debounceMs: 0, // No debounce in tests
    animationDuration: 0, // No animations in tests
  },
  features: {
    enableRealtimeUpdates: false,
  },
};

/**
 * Get environment-specific overrides based on current environment
 */
function getEnvironmentOverrides(): PartialScanHistoryConfig {
  const env = getEnvironment();

  switch (env) {
    case 'production':
      return productionOverrides;
    case 'staging':
      return stagingOverrides;
    case 'test':
      return testOverrides;
    case 'development':
    default:
      return developmentOverrides;
  }
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Get scan history configuration overrides from environment
 * Combines environment-specific overrides with explicit environment variables
 *
 * @returns Partial configuration to merge with defaults
 *
 * @example
 * ```ts
 * import { scanHistoryConfig } from './index';
 * import { getScanHistoryEnvConfig } from './env';
 *
 * const config = mergeConfig(scanHistoryConfig, getScanHistoryEnvConfig());
 * ```
 */
export function getScanHistoryEnvConfig(): PartialScanHistoryConfig {
  const envOverrides = getEnvironmentOverrides();

  // Explicit environment variables take precedence
  const explicitOverrides: PartialScanHistoryConfig = {
    api: getApiEnvConfig(),
    cache: getCacheEnvConfig(),
    pagination: getPaginationEnvConfig(),
    ui: getUiEnvConfig(),
    features: getFeaturesEnvConfig(),
  };

  // Merge environment-based overrides with explicit env var overrides
  return deepMergePartialConfig(envOverrides, explicitOverrides);
}

/**
 * Deep merge two partial configurations
 * @param base - Base partial config
 * @param override - Override partial config
 * @returns Merged partial config
 */
function deepMergePartialConfig(
  base: PartialScanHistoryConfig,
  override: PartialScanHistoryConfig
): PartialScanHistoryConfig {
  const result: PartialScanHistoryConfig = { ...base };

  (Object.keys(override) as Array<keyof PartialScanHistoryConfig>).forEach((key) => {
    const overrideValue = override[key];
    if (overrideValue !== undefined) {
      if (result[key] !== undefined && typeof result[key] === 'object') {
        result[key] = { ...result[key], ...overrideValue } as never;
      } else {
        result[key] = overrideValue as never;
      }
    }
  });

  return result;
}

/**
 * Validate that required environment variables are set for production
 * Logs warnings for missing recommended variables
 */
export function validateEnvConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (isProduction()) {
    // Check for required production variables
    if (!import.meta.env.VITE_SCAN_HISTORY_API_BASE_URL) {
      warnings.push('VITE_SCAN_HISTORY_API_BASE_URL is not set, using default');
    }
  }

  return {
    valid: true, // We don't fail, just warn
    warnings,
  };
}

/**
 * Log environment configuration for debugging
 */
export function logEnvConfig(): void {
  if (isDevelopment()) {
    console.group('[Scan History Config] Environment');
    console.log('Environment:', getEnvironment());
    console.log('Is Development:', isDevelopment());
    console.log('Is Production:', isProduction());
    console.log('Config:', getScanHistoryEnvConfig());
    console.groupEnd();
  }
}
