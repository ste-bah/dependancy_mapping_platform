/**
 * Graph Feature Flags
 * Feature flag utilities for graph visualization feature
 * @module features/graph/config/featureFlags
 */

import type { GraphConfig, FeaturesConfig } from './types';
import { getGraphConfig, onConfigChange } from './runtime';

// ============================================================================
// Feature Flag Types
// ============================================================================

/**
 * Feature flag key type
 */
export type FeatureFlagKey = keyof FeaturesConfig;

/**
 * Feature flag definition
 */
export interface FeatureFlagDefinition {
  /** Flag key */
  key: FeatureFlagKey;
  /** Human-readable name */
  name: string;
  /** Description of the feature */
  description: string;
  /** Default value */
  defaultValue: boolean;
  /** Whether the flag is experimental */
  experimental?: boolean;
  /** Dependencies on other flags */
  dependencies?: FeatureFlagKey[];
}

// ============================================================================
// Feature Flag Definitions
// ============================================================================

/**
 * Complete feature flag definitions with metadata
 */
export const FEATURE_FLAG_DEFINITIONS: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  enableExport: {
    key: 'enableExport',
    name: 'Export',
    description: 'Enable exporting graph as PNG, SVG, or JSON',
    defaultValue: true,
  },
  enableCycleDetection: {
    key: 'enableCycleDetection',
    name: 'Cycle Detection',
    description: 'Detect and highlight circular dependencies in the graph',
    defaultValue: true,
  },
  enableClusterView: {
    key: 'enableClusterView',
    name: 'Cluster View',
    description: 'Group related nodes into collapsible clusters',
    defaultValue: false,
    experimental: true,
  },
  enableBlastRadius: {
    key: 'enableBlastRadius',
    name: 'Blast Radius',
    description: 'Show impact analysis when selecting a node',
    defaultValue: true,
  },
  enableAdvancedFilters: {
    key: 'enableAdvancedFilters',
    name: 'Advanced Filters',
    description: 'Show advanced filtering options like confidence and depth',
    defaultValue: true,
  },
  enableKeyboardShortcuts: {
    key: 'enableKeyboardShortcuts',
    name: 'Keyboard Shortcuts',
    description: 'Enable keyboard navigation and shortcuts',
    defaultValue: true,
  },
  enableMinimap: {
    key: 'enableMinimap',
    name: 'Minimap',
    description: 'Show a minimap for navigation in large graphs',
    defaultValue: true,
  },
  enableNodePreview: {
    key: 'enableNodePreview',
    name: 'Node Preview',
    description: 'Show a preview panel when hovering over nodes',
    defaultValue: true,
  },
  enableUrlState: {
    key: 'enableUrlState',
    name: 'URL State',
    description: 'Persist view state in the URL for sharing',
    defaultValue: true,
  },
  enableDarkMode: {
    key: 'enableDarkMode',
    name: 'Dark Mode',
    description: 'Allow switching to dark theme',
    defaultValue: true,
  },
  enablePerformanceMonitoring: {
    key: 'enablePerformanceMonitoring',
    name: 'Performance Monitoring',
    description: 'Track and report performance metrics',
    defaultValue: false,
  },
  enableErrorReporting: {
    key: 'enableErrorReporting',
    name: 'Error Reporting',
    description: 'Report errors to monitoring service',
    defaultValue: true,
  },
};

// ============================================================================
// Feature Flag Access
// ============================================================================

/**
 * Check if a feature is enabled
 *
 * @param feature - Feature flag key
 * @returns Whether the feature is enabled
 *
 * @example
 * ```ts
 * if (isFeatureEnabled('enableExport')) {
 *   showExportButton();
 * }
 * ```
 */
export function isFeatureEnabled(feature: FeatureFlagKey): boolean {
  const config = getGraphConfig();
  const enabled = config.features[feature];

  // Check dependencies
  const definition = FEATURE_FLAG_DEFINITIONS[feature];
  if (enabled && definition.dependencies) {
    return definition.dependencies.every((dep) => config.features[dep]);
  }

  return enabled;
}

/**
 * Get a value based on feature flag state
 *
 * @param feature - Feature flag key
 * @param enabledValue - Value when feature is enabled
 * @param disabledValue - Value when feature is disabled
 * @returns The appropriate value based on flag state
 *
 * @example
 * ```ts
 * const buttonText = withFeatureFlag(
 *   'enableExport',
 *   'Export Graph',
 *   undefined
 * );
 * ```
 */
export function withFeatureFlag<T>(
  feature: FeatureFlagKey,
  enabledValue: T,
  disabledValue: T
): T {
  return isFeatureEnabled(feature) ? enabledValue : disabledValue;
}

/**
 * Execute a callback only if feature is enabled
 *
 * @param feature - Feature flag key
 * @param callback - Callback to execute if enabled
 * @returns Result of callback or undefined
 *
 * @example
 * ```ts
 * whenFeatureEnabled('enableExport', () => {
 *   initializeExporter();
 * });
 * ```
 */
export function whenFeatureEnabled<T>(
  feature: FeatureFlagKey,
  callback: () => T
): T | undefined {
  if (isFeatureEnabled(feature)) {
    return callback();
  }
  return undefined;
}

/**
 * Get all feature flags with their current states
 *
 * @returns Object mapping flag keys to their states
 *
 * @example
 * ```ts
 * const flags = getAllFeatureFlags();
 * console.log(flags.enableExport); // true
 * ```
 */
export function getAllFeatureFlags(): FeaturesConfig {
  return { ...getGraphConfig().features };
}

/**
 * Get all enabled features
 *
 * @returns Array of enabled feature keys
 *
 * @example
 * ```ts
 * const enabled = getEnabledFeatures();
 * console.log(enabled); // ['enableExport', 'enableBlastRadius', ...]
 * ```
 */
export function getEnabledFeatures(): FeatureFlagKey[] {
  const features = getAllFeatureFlags();
  return (Object.keys(features) as FeatureFlagKey[]).filter(
    (key) => features[key]
  );
}

/**
 * Get all disabled features
 *
 * @returns Array of disabled feature keys
 */
export function getDisabledFeatures(): FeatureFlagKey[] {
  const features = getAllFeatureFlags();
  return (Object.keys(features) as FeatureFlagKey[]).filter(
    (key) => !features[key]
  );
}

/**
 * Get all experimental features
 *
 * @returns Array of experimental feature keys
 */
export function getExperimentalFeatures(): FeatureFlagKey[] {
  return (Object.keys(FEATURE_FLAG_DEFINITIONS) as FeatureFlagKey[]).filter(
    (key) => FEATURE_FLAG_DEFINITIONS[key].experimental
  );
}

/**
 * Check if any experimental features are enabled
 *
 * @returns Whether any experimental feature is enabled
 */
export function hasExperimentalFeaturesEnabled(): boolean {
  const experimental = getExperimentalFeatures();
  return experimental.some((key) => isFeatureEnabled(key));
}

// ============================================================================
// Feature Flag Subscriptions
// ============================================================================

/**
 * Subscribe to changes in a specific feature flag
 *
 * @param feature - Feature flag key to watch
 * @param callback - Callback when flag changes
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * const unsubscribe = onFeatureFlagChange('enableExport', (enabled) => {
 *   if (enabled) {
 *     showExportButton();
 *   } else {
 *     hideExportButton();
 *   }
 * });
 * ```
 */
export function onFeatureFlagChange(
  feature: FeatureFlagKey,
  callback: (enabled: boolean) => void
): () => void {
  let previousValue = isFeatureEnabled(feature);

  return onConfigChange((newConfig, changedKeys) => {
    const featureKey = `features.${feature}`;
    if (changedKeys.includes(featureKey)) {
      const newValue = newConfig.features[feature];
      if (newValue !== previousValue) {
        previousValue = newValue;
        callback(newValue);
      }
    }
  });
}

/**
 * Subscribe to changes in any feature flag
 *
 * @param callback - Callback when any flag changes
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * const unsubscribe = onAnyFeatureFlagChange((flags) => {
 *   console.log('Features updated:', flags);
 * });
 * ```
 */
export function onAnyFeatureFlagChange(
  callback: (features: FeaturesConfig) => void
): () => void {
  return onConfigChange((newConfig, changedKeys) => {
    const hasFeatureChange = changedKeys.some((key) =>
      key.startsWith('features.')
    );
    if (hasFeatureChange) {
      callback(newConfig.features);
    }
  });
}

// ============================================================================
// Feature Flag Guards
// ============================================================================

/**
 * Higher-order function that wraps a function to only execute if feature is enabled
 *
 * @param feature - Feature flag key
 * @param fn - Function to wrap
 * @returns Wrapped function that checks feature flag
 *
 * @example
 * ```ts
 * const exportGraph = guardWithFeature('enableExport', async (format) => {
 *   // Export logic...
 * });
 *
 * // Will only execute if enableExport is true
 * await exportGraph('png');
 * ```
 */
export function guardWithFeature<T extends (...args: unknown[]) => unknown>(
  feature: FeatureFlagKey,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    if (!isFeatureEnabled(feature)) {
      console.warn(
        `[Feature Guard] Feature "${feature}" is disabled. Operation skipped.`
      );
      return undefined;
    }
    return fn(...args);
  }) as T;
}

/**
 * Create a feature-gated component wrapper
 *
 * @param feature - Feature flag key
 * @returns Object with enabled state and guard function
 *
 * @example
 * ```ts
 * const exportFeature = createFeatureGate('enableExport');
 *
 * if (exportFeature.isEnabled) {
 *   // Show export UI
 * }
 *
 * exportFeature.execute(() => {
 *   // Export logic
 * });
 * ```
 */
export function createFeatureGate(feature: FeatureFlagKey): {
  isEnabled: boolean;
  definition: FeatureFlagDefinition;
  execute: <T>(fn: () => T) => T | undefined;
} {
  return {
    get isEnabled() {
      return isFeatureEnabled(feature);
    },
    definition: FEATURE_FLAG_DEFINITIONS[feature],
    execute: <T>(fn: () => T) => whenFeatureEnabled(feature, fn),
  };
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Log all feature flag states
 */
export function logFeatureFlags(): void {
  const flags = getAllFeatureFlags();
  const enabled = getEnabledFeatures();
  const disabled = getDisabledFeatures();
  const experimental = getExperimentalFeatures();

  console.group('[Feature Flags]');
  console.log('All flags:', flags);
  console.log('Enabled:', enabled);
  console.log('Disabled:', disabled);
  console.log('Experimental:', experimental);
  console.log(
    'Experimental enabled:',
    experimental.filter((f) => isFeatureEnabled(f))
  );
  console.groupEnd();
}

/**
 * Get feature flag summary for debugging or analytics
 */
export function getFeatureFlagSummary(): {
  total: number;
  enabled: number;
  disabled: number;
  experimentalEnabled: number;
  flags: Array<{
    key: FeatureFlagKey;
    enabled: boolean;
    experimental: boolean;
  }>;
} {
  const features = getAllFeatureFlags();
  const keys = Object.keys(features) as FeatureFlagKey[];

  return {
    total: keys.length,
    enabled: getEnabledFeatures().length,
    disabled: getDisabledFeatures().length,
    experimentalEnabled: getExperimentalFeatures().filter((f) =>
      isFeatureEnabled(f)
    ).length,
    flags: keys.map((key) => ({
      key,
      enabled: features[key],
      experimental: FEATURE_FLAG_DEFINITIONS[key]?.experimental ?? false,
    })),
  };
}
