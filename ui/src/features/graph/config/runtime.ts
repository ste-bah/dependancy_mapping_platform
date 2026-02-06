/**
 * Graph Runtime Configuration
 * Runtime configuration management with update and reset capabilities
 * @module features/graph/config/runtime
 */

import {
  graphConfig,
  defaultApiConfig,
  defaultCacheConfig,
  defaultLayoutConfig,
  defaultUiConfig,
  defaultLimitsConfig,
  defaultFeaturesConfig,
  defaultThemeConfig,
  FROZEN_DEFAULT_CONFIG,
} from './index';
import { getGraphEnvConfig } from './env';
import type {
  GraphConfig,
  PartialGraphConfig,
  ConfigChangeCallback,
} from './types';

// ============================================================================
// Runtime Configuration State
// ============================================================================

/**
 * Current runtime configuration
 * This is the mutable configuration that can be updated at runtime
 */
let currentConfig: GraphConfig = createInitialConfig();

/**
 * List of registered change listeners
 */
const changeListeners: Set<ConfigChangeCallback> = new Set();

/**
 * Configuration update history for debugging
 */
const updateHistory: Array<{
  timestamp: number;
  changes: PartialGraphConfig;
  source: string;
}> = [];

/**
 * Maximum history entries to keep
 */
const MAX_HISTORY_ENTRIES = 50;

// ============================================================================
// Configuration Initialization
// ============================================================================

/**
 * Create initial configuration by merging defaults with environment overrides
 */
function createInitialConfig(): GraphConfig {
  const envConfig = getGraphEnvConfig();
  return mergeConfig(graphConfig, envConfig);
}

/**
 * Deep merge configuration objects
 * @param base - Base configuration
 * @param overrides - Override values
 * @returns Merged configuration
 */
function mergeConfig(
  base: GraphConfig,
  overrides: PartialGraphConfig
): GraphConfig {
  return {
    api: { ...base.api, ...overrides.api },
    cache: { ...base.cache, ...overrides.cache },
    layout: { ...base.layout, ...overrides.layout },
    ui: { ...base.ui, ...overrides.ui },
    limits: { ...base.limits, ...overrides.limits },
    features: { ...base.features, ...overrides.features },
    theme: {
      ...base.theme,
      ...overrides.theme,
      nodeColors: {
        ...base.theme.nodeColors,
        ...overrides.theme?.nodeColors,
      },
      edgeColors: {
        ...base.theme.edgeColors,
        ...overrides.theme?.edgeColors,
      },
      impactColors: {
        ...base.theme.impactColors,
        ...overrides.theme?.impactColors,
      },
    },
  };
}

/**
 * Get the changed keys between two configurations
 * @param oldConfig - Previous configuration
 * @param newConfig - New configuration
 * @returns Array of changed key paths
 */
function getChangedKeys(
  oldConfig: GraphConfig,
  newConfig: GraphConfig
): string[] {
  const changes: string[] = [];

  function compare(
    oldVal: unknown,
    newVal: unknown,
    path: string
  ): void {
    if (typeof oldVal !== typeof newVal) {
      changes.push(path);
      return;
    }

    if (
      typeof oldVal === 'object' &&
      oldVal !== null &&
      typeof newVal === 'object' &&
      newVal !== null
    ) {
      const oldObj = oldVal as Record<string, unknown>;
      const newObj = newVal as Record<string, unknown>;
      const allKeys = new Set([
        ...Object.keys(oldObj),
        ...Object.keys(newObj),
      ]);

      allKeys.forEach((key) => {
        compare(oldObj[key], newObj[key], path ? `${path}.${key}` : key);
      });
    } else if (oldVal !== newVal) {
      changes.push(path);
    }
  }

  compare(oldConfig, newConfig, '');
  return changes;
}

// ============================================================================
// Configuration Access
// ============================================================================

/**
 * Get the current runtime configuration
 * Returns a shallow copy to prevent accidental mutations
 *
 * @returns Current graph configuration
 *
 * @example
 * ```ts
 * const config = getGraphConfig();
 * console.log(config.api.timeout);
 * ```
 */
export function getGraphConfig(): GraphConfig {
  return { ...currentConfig };
}

/**
 * Get a specific configuration section
 * @param section - Configuration section key
 * @returns Configuration section value
 *
 * @example
 * ```ts
 * const apiConfig = getConfigSection('api');
 * console.log(apiConfig.timeout);
 * ```
 */
export function getConfigSection<K extends keyof GraphConfig>(
  section: K
): GraphConfig[K] {
  return { ...currentConfig[section] };
}

/**
 * Get a specific configuration value by path
 * @param path - Dot-separated path to value
 * @returns Configuration value or undefined if not found
 *
 * @example
 * ```ts
 * const timeout = getConfigValue('api.timeout'); // 30000
 * const color = getConfigValue('theme.nodeColors.function'); // '#3B82F6'
 * ```
 */
export function getConfigValue<T = unknown>(path: string): T | undefined {
  const parts = path.split('.');
  let current: unknown = currentConfig;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current as T;
}

// ============================================================================
// Configuration Updates
// ============================================================================

/**
 * Update the runtime configuration
 * Merges the updates with the current configuration and notifies listeners
 *
 * @param updates - Partial configuration updates
 * @param source - Optional source identifier for debugging
 *
 * @example
 * ```ts
 * // Update a single section
 * updateGraphConfig({ api: { timeout: 60000 } });
 *
 * // Update multiple sections
 * updateGraphConfig({
 *   api: { timeout: 60000 },
 *   features: { enableExport: false },
 * });
 * ```
 */
export function updateGraphConfig(
  updates: PartialGraphConfig,
  source: string = 'unknown'
): void {
  const oldConfig = currentConfig;
  currentConfig = mergeConfig(currentConfig, updates);

  // Track changes
  const changedKeys = getChangedKeys(oldConfig, currentConfig);

  if (changedKeys.length > 0) {
    // Record in history
    updateHistory.push({
      timestamp: Date.now(),
      changes: updates,
      source,
    });

    // Trim history if needed
    if (updateHistory.length > MAX_HISTORY_ENTRIES) {
      updateHistory.splice(0, updateHistory.length - MAX_HISTORY_ENTRIES);
    }

    // Notify listeners
    notifyListeners(currentConfig, changedKeys);
  }
}

/**
 * Update a specific configuration section
 * @param section - Section to update
 * @param updates - Updates for the section
 * @param source - Optional source identifier
 *
 * @example
 * ```ts
 * updateConfigSection('api', { timeout: 60000 });
 * updateConfigSection('features', { enableExport: false });
 * ```
 */
export function updateConfigSection<K extends keyof GraphConfig>(
  section: K,
  updates: Partial<GraphConfig[K]>,
  source: string = 'unknown'
): void {
  updateGraphConfig({ [section]: updates } as PartialGraphConfig, source);
}

/**
 * Set a specific configuration value by path
 * @param path - Dot-separated path to value
 * @param value - New value
 * @param source - Optional source identifier
 *
 * @example
 * ```ts
 * setConfigValue('api.timeout', 60000);
 * setConfigValue('features.enableExport', false);
 * ```
 */
export function setConfigValue<T>(
  path: string,
  value: T,
  source: string = 'unknown'
): void {
  const parts = path.split('.');
  if (parts.length < 2) {
    console.warn(`[Graph Config] Invalid config path: ${path}`);
    return;
  }

  const section = parts[0] as keyof GraphConfig;
  const rest = parts.slice(1);

  // Build nested update object
  const update = rest.reduceRight(
    (acc, key) => ({ [key]: acc }),
    value as unknown
  );

  updateGraphConfig(
    { [section]: update } as PartialGraphConfig,
    source
  );
}

// ============================================================================
// Configuration Reset
// ============================================================================

/**
 * Reset configuration to defaults (with environment overrides)
 *
 * @example
 * ```ts
 * resetGraphConfig();
 * ```
 */
export function resetGraphConfig(): void {
  const oldConfig = currentConfig;
  currentConfig = createInitialConfig();

  const changedKeys = getChangedKeys(oldConfig, currentConfig);
  if (changedKeys.length > 0) {
    updateHistory.push({
      timestamp: Date.now(),
      changes: { api: {}, cache: {}, layout: {}, ui: {}, limits: {}, features: {}, theme: {} },
      source: 'reset',
    });
    notifyListeners(currentConfig, changedKeys);
  }
}

/**
 * Reset a specific configuration section to defaults
 * @param section - Section to reset
 *
 * @example
 * ```ts
 * resetConfigSection('api');
 * resetConfigSection('features');
 * ```
 */
export function resetConfigSection<K extends keyof GraphConfig>(
  section: K
): void {
  const defaults: Record<keyof GraphConfig, GraphConfig[keyof GraphConfig]> = {
    api: defaultApiConfig,
    cache: defaultCacheConfig,
    layout: defaultLayoutConfig,
    ui: defaultUiConfig,
    limits: defaultLimitsConfig,
    features: defaultFeaturesConfig,
    theme: defaultThemeConfig,
  };

  updateGraphConfig({ [section]: defaults[section] } as PartialGraphConfig, 'reset');
}

/**
 * Reset to pure defaults (ignoring environment overrides)
 */
export function resetToDefaults(): void {
  const oldConfig = currentConfig;
  currentConfig = { ...FROZEN_DEFAULT_CONFIG } as GraphConfig;

  const changedKeys = getChangedKeys(oldConfig, currentConfig);
  if (changedKeys.length > 0) {
    notifyListeners(currentConfig, changedKeys);
  }
}

// ============================================================================
// Change Listeners
// ============================================================================

/**
 * Register a configuration change listener
 * @param callback - Callback function to invoke on changes
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * const unsubscribe = onConfigChange((newConfig, changedKeys) => {
 *   console.log('Config changed:', changedKeys);
 * });
 *
 * // Later...
 * unsubscribe();
 * ```
 */
export function onConfigChange(callback: ConfigChangeCallback): () => void {
  changeListeners.add(callback);

  return () => {
    changeListeners.delete(callback);
  };
}

/**
 * Notify all registered listeners of configuration changes
 * @param newConfig - New configuration
 * @param changedKeys - Keys that changed
 */
function notifyListeners(
  newConfig: GraphConfig,
  changedKeys: string[]
): void {
  changeListeners.forEach((callback) => {
    try {
      callback(newConfig, changedKeys);
    } catch (error) {
      console.error('[Graph Config] Error in change listener:', error);
    }
  });
}

/**
 * Remove all registered change listeners
 */
export function clearConfigListeners(): void {
  changeListeners.clear();
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Get configuration update history
 * @returns Array of update entries
 */
export function getConfigHistory(): ReadonlyArray<{
  timestamp: number;
  changes: PartialGraphConfig;
  source: string;
}> {
  return [...updateHistory];
}

/**
 * Clear configuration update history
 */
export function clearConfigHistory(): void {
  updateHistory.length = 0;
}

/**
 * Log current configuration for debugging
 */
export function logCurrentConfig(): void {
  console.group('[Graph Config] Current Configuration');
  console.log('API:', currentConfig.api);
  console.log('Cache:', currentConfig.cache);
  console.log('Layout:', currentConfig.layout);
  console.log('UI:', currentConfig.ui);
  console.log('Limits:', currentConfig.limits);
  console.log('Features:', currentConfig.features);
  console.log('Theme:', currentConfig.theme);
  console.groupEnd();
}

/**
 * Compare current config with defaults
 * @returns Object describing differences from defaults
 */
export function getConfigDiff(): Record<string, { default: unknown; current: unknown }> {
  const diff: Record<string, { default: unknown; current: unknown }> = {};

  function compare(
    defaultVal: unknown,
    currentVal: unknown,
    path: string
  ): void {
    if (
      typeof defaultVal === 'object' &&
      defaultVal !== null &&
      typeof currentVal === 'object' &&
      currentVal !== null
    ) {
      const defaultObj = defaultVal as Record<string, unknown>;
      const currentObj = currentVal as Record<string, unknown>;

      Object.keys(defaultObj).forEach((key) => {
        compare(defaultObj[key], currentObj[key], path ? `${path}.${key}` : key);
      });
    } else if (defaultVal !== currentVal) {
      diff[path] = { default: defaultVal, current: currentVal };
    }
  }

  compare(FROZEN_DEFAULT_CONFIG, currentConfig, '');
  return diff;
}
