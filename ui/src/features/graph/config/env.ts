/**
 * Graph Environment Configuration
 * Environment-specific configuration overrides using Vite's import.meta.env
 * @module features/graph/config/env
 */

import type {
  GraphConfig,
  PartialGraphConfig,
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
function getApiEnvConfig(): Partial<GraphConfig['api']> {
  return {
    baseUrl: parseEnvString(
      import.meta.env.VITE_GRAPH_API_BASE_URL,
      '/api/v1'
    ),
    timeout: parseEnvNumber(
      import.meta.env.VITE_GRAPH_API_TIMEOUT,
      30_000
    ),
    retryAttempts: parseEnvNumber(
      import.meta.env.VITE_GRAPH_API_RETRY_ATTEMPTS,
      3
    ),
    enableRequestLogging: parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_REQUEST_LOGGING,
      isDevelopment()
    ),
  };
}

/**
 * Get cache configuration from environment variables
 */
function getCacheEnvConfig(): Partial<GraphConfig['cache']> {
  return {
    staleTime: parseEnvNumber(
      import.meta.env.VITE_GRAPH_CACHE_STALE_TIME,
      60_000
    ),
    gcTime: parseEnvNumber(
      import.meta.env.VITE_GRAPH_CACHE_GC_TIME,
      5 * 60_000
    ),
    refetchOnFocus: parseEnvBoolean(
      import.meta.env.VITE_GRAPH_REFETCH_ON_FOCUS,
      false
    ),
  };
}

/**
 * Get UI configuration from environment variables
 */
function getUiEnvConfig(): Partial<GraphConfig['ui']> {
  return {
    maxSearchResults: parseEnvNumber(
      import.meta.env.VITE_GRAPH_MAX_SEARCH_RESULTS,
      20
    ),
    debounceMs: parseEnvNumber(
      import.meta.env.VITE_GRAPH_DEBOUNCE_MS,
      300
    ),
    animationDuration: parseEnvNumber(
      import.meta.env.VITE_GRAPH_ANIMATION_DURATION,
      200
    ),
  };
}

/**
 * Get limits configuration from environment variables
 */
function getLimitsEnvConfig(): Partial<GraphConfig['limits']> {
  return {
    maxNodesForAnimation: parseEnvNumber(
      import.meta.env.VITE_GRAPH_MAX_NODES_ANIMATION,
      500
    ),
    maxNodesForLabels: parseEnvNumber(
      import.meta.env.VITE_GRAPH_MAX_NODES_LABELS,
      200
    ),
    maxBlastRadiusDepth: parseEnvNumber(
      import.meta.env.VITE_GRAPH_MAX_BLAST_DEPTH,
      10
    ),
  };
}

/**
 * Get feature flags from environment variables
 */
function getFeaturesEnvConfig(): Partial<FeaturesConfig> {
  const features: Partial<FeaturesConfig> = {};

  // Only override if explicitly set in environment
  if (import.meta.env.VITE_GRAPH_ENABLE_EXPORT !== undefined) {
    features.enableExport = parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_EXPORT,
      true
    );
  }

  if (import.meta.env.VITE_GRAPH_ENABLE_CYCLE_DETECTION !== undefined) {
    features.enableCycleDetection = parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_CYCLE_DETECTION,
      true
    );
  }

  if (import.meta.env.VITE_GRAPH_ENABLE_CLUSTER_VIEW !== undefined) {
    features.enableClusterView = parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_CLUSTER_VIEW,
      false
    );
  }

  if (import.meta.env.VITE_GRAPH_ENABLE_BLAST_RADIUS !== undefined) {
    features.enableBlastRadius = parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_BLAST_RADIUS,
      true
    );
  }

  if (import.meta.env.VITE_GRAPH_ENABLE_ADVANCED_FILTERS !== undefined) {
    features.enableAdvancedFilters = parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_ADVANCED_FILTERS,
      true
    );
  }

  if (import.meta.env.VITE_GRAPH_ENABLE_PERFORMANCE_MONITORING !== undefined) {
    features.enablePerformanceMonitoring = parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_PERFORMANCE_MONITORING,
      false
    );
  }

  if (import.meta.env.VITE_GRAPH_ENABLE_ERROR_REPORTING !== undefined) {
    features.enableErrorReporting = parseEnvBoolean(
      import.meta.env.VITE_GRAPH_ENABLE_ERROR_REPORTING,
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
const developmentOverrides: PartialGraphConfig = {
  api: {
    enableRequestLogging: true,
    timeout: 60_000, // Longer timeout for debugging
  },
  cache: {
    staleTime: 30_000, // Shorter stale time for development
  },
  features: {
    enablePerformanceMonitoring: true,
  },
};

/**
 * Staging environment overrides
 */
const stagingOverrides: PartialGraphConfig = {
  api: {
    enableRequestLogging: true,
  },
  features: {
    enablePerformanceMonitoring: true,
    enableErrorReporting: true,
  },
};

/**
 * Production environment overrides
 */
const productionOverrides: PartialGraphConfig = {
  api: {
    enableRequestLogging: false,
  },
  cache: {
    staleTime: 120_000, // Longer stale time for production
    gcTime: 10 * 60_000,
  },
  features: {
    enablePerformanceMonitoring: false,
  },
};

/**
 * Test environment overrides
 */
const testOverrides: PartialGraphConfig = {
  api: {
    timeout: 5_000, // Short timeout for tests
    retryAttempts: 1,
  },
  cache: {
    staleTime: 0, // No caching in tests
    gcTime: 0,
  },
  ui: {
    debounceMs: 0, // No debounce in tests
    animationDuration: 0, // No animations in tests
  },
  layout: {
    enableAnimation: false,
    animationDuration: 0,
  },
  features: {
    enablePerformanceMonitoring: false,
    enableErrorReporting: false,
  },
};

/**
 * Get environment-specific overrides based on current environment
 */
function getEnvironmentOverrides(): PartialGraphConfig {
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
 * Get graph configuration overrides from environment
 * Combines environment-specific overrides with explicit environment variables
 *
 * @returns Partial configuration to merge with defaults
 *
 * @example
 * ```ts
 * import { graphConfig } from './index';
 * import { getGraphEnvConfig } from './env';
 *
 * const config = mergeConfig(graphConfig, getGraphEnvConfig());
 * ```
 */
export function getGraphEnvConfig(): PartialGraphConfig {
  const envOverrides = getEnvironmentOverrides();

  // Explicit environment variables take precedence
  const explicitOverrides: PartialGraphConfig = {
    api: getApiEnvConfig(),
    cache: getCacheEnvConfig(),
    ui: getUiEnvConfig(),
    limits: getLimitsEnvConfig(),
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
  base: PartialGraphConfig,
  override: PartialGraphConfig
): PartialGraphConfig {
  const result: PartialGraphConfig = { ...base };

  (Object.keys(override) as Array<keyof PartialGraphConfig>).forEach((key) => {
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
    if (!import.meta.env.VITE_GRAPH_API_BASE_URL) {
      warnings.push('VITE_GRAPH_API_BASE_URL is not set, using default');
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
    console.group('[Graph Config] Environment');
    console.log('Environment:', getEnvironment());
    console.log('Is Development:', isDevelopment());
    console.log('Is Production:', isProduction());
    console.log('Config:', getGraphEnvConfig());
    console.groupEnd();
  }
}
