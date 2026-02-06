/**
 * E2E Configuration Module
 * @module e2e/config
 *
 * Centralized exports for E2E test configuration management:
 * - Configuration schemas and types
 * - Environment handling
 * - Test presets
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #27 of 47 | Phase 4: Implementation
 */

// ============================================================================
// E2E Configuration Schema
// ============================================================================

export {
  // Schemas
  TimeoutConfigSchema,
  ParallelConfigSchema,
  TestDatabaseConfigSchema,
  ApiEndpointsConfigSchema,
  MockingConfigSchema,
  RetryConfigSchema,
  TestLoggingConfigSchema,
  CoverageConfigSchema,
  ArtifactConfigSchema,
  ReporterConfigSchema,
  TestContextConfigSchema,
  E2EFeatureFlagsSchema,
  E2EConfigSchema,
  // Types
  type TimeoutConfig,
  type ParallelConfig,
  type TestDatabaseConfig,
  type ApiEndpointsConfig,
  type MockingConfig,
  type RetryConfig,
  type TestLoggingConfig,
  type CoverageConfig,
  type ArtifactConfig,
  type ReporterConfig,
  type TestContextConfig,
  type E2EFeatureFlags,
  type E2EConfig,
  // Constants
  DEFAULT_E2E_CONFIG,
  // Builder
  E2EConfigBuilder,
  createE2EConfigBuilder,
  // Factory Functions
  createE2EConfig,
  mergeE2EConfigs,
  validateE2EConfig,
} from './e2e-config.js';

// ============================================================================
// Environment Handling
// ============================================================================

export {
  // Types
  type TestEnvironment,
  type E2EEnv,
  type EnvironmentOptions,
  // Schemas
  E2EEnvSchema,
  // Constants
  ENVIRONMENT_DEFAULTS,
  REQUIRED_ENV_VARS,
  // Functions
  loadEnvFile,
  loadEnvironmentFiles,
  parseEnvironment,
  resolveEnvironment,
  validateRequiredEnvVars,
  validateDatabaseConnection,
  getCurrentEnvironment,
  isCI,
  isDebug,
  getEnvironmentConfig,
} from './environment.js';

// ============================================================================
// Test Presets
// ============================================================================

export {
  // Types
  type PresetName,
  type TestPreset,
  // Preset Definitions
  FAST_PRESET,
  FULL_PRESET,
  CI_PRESET,
  DEBUG_PRESET,
  SMOKE_PRESET,
  INTEGRATION_PRESET,
  E2E_PRESET,
  PERFORMANCE_PRESET,
  // Registry
  PRESETS,
  // Functions
  getPreset,
  getAllPresets,
  getCICompatiblePresets,
  getPresetsByTag,
  loadPreset,
  loadPresetWithEnvironment,
  extendPreset,
  getRecommendedPreset,
  autoSelectPreset,
} from './test-presets.js';

// ============================================================================
// Convenience Re-exports
// ============================================================================

/**
 * Load E2E configuration with automatic environment detection
 *
 * @example
 * ```typescript
 * import { loadE2EConfig } from './config';
 *
 * // Auto-detect environment and load appropriate config
 * const config = loadE2EConfig();
 *
 * // Load specific preset
 * const ciConfig = loadE2EConfig('ci');
 *
 * // Load with custom options
 * const customConfig = loadE2EConfig('fast', {
 *   timeouts: { testTimeout: 5000 }
 * });
 * ```
 */
export function loadE2EConfig(
  presetOrOptions?: import('./test-presets.js').PresetName | Partial<import('./e2e-config.js').E2EConfig>,
  overrides?: Partial<import('./e2e-config.js').E2EConfig>
): import('./e2e-config.js').E2EConfig {
  const { autoSelectPreset, loadPreset, mergeE2EConfigs } = require('./test-presets.js');
  const { createE2EConfig } = require('./e2e-config.js');

  // No arguments - auto select
  if (!presetOrOptions) {
    return autoSelectPreset();
  }

  // String argument - preset name
  if (typeof presetOrOptions === 'string') {
    const config = loadPreset(presetOrOptions);
    if (overrides) {
      return mergeE2EConfigs(config, overrides);
    }
    return config;
  }

  // Object argument - custom config
  const baseConfig = autoSelectPreset();
  return mergeE2EConfigs(baseConfig, presetOrOptions);
}

/**
 * Get configuration for the current environment
 *
 * @example
 * ```typescript
 * import { getConfig } from './config';
 *
 * const config = getConfig();
 * console.log(config.timeouts.testTimeout);
 * ```
 */
export function getConfig(): import('./e2e-config.js').E2EConfig {
  const { autoSelectPreset } = require('./test-presets.js');
  return autoSelectPreset();
}

/**
 * Check if a feature is enabled
 *
 * @example
 * ```typescript
 * import { isFeatureEnabled } from './config';
 *
 * if (isFeatureEnabled('visualTesting')) {
 *   // Run visual tests
 * }
 * ```
 */
export function isFeatureEnabled(
  feature: keyof import('./e2e-config.js').E2EFeatureFlags
): boolean {
  const config = getConfig();
  return config.features[feature] ?? false;
}
