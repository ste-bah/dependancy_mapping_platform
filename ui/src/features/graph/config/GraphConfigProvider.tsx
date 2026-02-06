/**
 * Graph Configuration Provider
 * React context provider for graph configuration
 * @module features/graph/config/GraphConfigProvider
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { GraphConfig, PartialGraphConfig } from './types';
import {
  getGraphConfig,
  updateGraphConfig,
  resetGraphConfig,
  onConfigChange,
  getConfigSection,
} from './runtime';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Graph configuration context value
 */
export interface GraphConfigContextValue {
  /** Current configuration */
  config: GraphConfig;
  /** Update configuration */
  updateConfig: (updates: PartialGraphConfig) => void;
  /** Reset configuration to defaults */
  resetConfig: () => void;
  /** Get a specific configuration section */
  getSection: <K extends keyof GraphConfig>(section: K) => GraphConfig[K];
  /** Check if a feature is enabled */
  isFeatureEnabled: (feature: keyof GraphConfig['features']) => boolean;
}

/**
 * Props for GraphConfigProvider
 */
export interface GraphConfigProviderProps {
  /** Child components */
  children: ReactNode;
  /** Optional initial configuration overrides */
  initialConfig?: PartialGraphConfig;
  /** Optional callback when configuration changes */
  onConfigChange?: (config: GraphConfig) => void;
}

// ============================================================================
// Context Creation
// ============================================================================

/**
 * Graph configuration context
 */
const GraphConfigContext = createContext<GraphConfigContextValue | null>(null);

// Display name for React DevTools
GraphConfigContext.displayName = 'GraphConfigContext';

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Graph configuration provider component
 * Provides configuration context to child components and manages
 * configuration state with automatic updates.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <GraphConfigProvider
 *       initialConfig={{ features: { enableExport: false } }}
 *     >
 *       <GraphVisualization />
 *     </GraphConfigProvider>
 *   );
 * }
 * ```
 */
export function GraphConfigProvider({
  children,
  initialConfig,
  onConfigChange: onConfigChangeProp,
}: GraphConfigProviderProps): JSX.Element {
  // Initialize state with current runtime config
  const [config, setConfig] = useState<GraphConfig>(() => {
    // Apply initial overrides if provided
    if (initialConfig) {
      updateGraphConfig(initialConfig, 'GraphConfigProvider.initial');
    }
    return getGraphConfig();
  });

  // Subscribe to runtime config changes
  useEffect(() => {
    const unsubscribe = onConfigChange((newConfig) => {
      setConfig(newConfig);
      onConfigChangeProp?.(newConfig);
    });

    return unsubscribe;
  }, [onConfigChangeProp]);

  // Memoized update function
  const updateConfig = useCallback((updates: PartialGraphConfig) => {
    updateGraphConfig(updates, 'GraphConfigProvider.update');
  }, []);

  // Memoized reset function
  const resetConfig = useCallback(() => {
    resetGraphConfig();
  }, []);

  // Memoized getSection function
  const getSection = useCallback(<K extends keyof GraphConfig>(section: K) => {
    return getConfigSection(section);
  }, []);

  // Memoized feature check function
  const isFeatureEnabled = useCallback(
    (feature: keyof GraphConfig['features']) => {
      return config.features[feature];
    },
    [config.features]
  );

  // Memoize context value
  const contextValue = useMemo<GraphConfigContextValue>(
    () => ({
      config,
      updateConfig,
      resetConfig,
      getSection,
      isFeatureEnabled,
    }),
    [config, updateConfig, resetConfig, getSection, isFeatureEnabled]
  );

  return (
    <GraphConfigContext.Provider value={contextValue}>
      {children}
    </GraphConfigContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access graph configuration
 * Must be used within a GraphConfigProvider
 *
 * @returns Graph configuration context value
 * @throws Error if used outside of GraphConfigProvider
 *
 * @example
 * ```tsx
 * function GraphToolbar() {
 *   const { config, isFeatureEnabled } = useGraphConfig();
 *
 *   if (!isFeatureEnabled('enableExport')) {
 *     return null;
 *   }
 *
 *   return <ExportButton timeout={config.api.timeout} />;
 * }
 * ```
 */
export function useGraphConfig(): GraphConfigContextValue {
  const context = useContext(GraphConfigContext);

  if (context === null) {
    throw new Error(
      'useGraphConfig must be used within a GraphConfigProvider. ' +
        'Wrap your component tree with <GraphConfigProvider>.'
    );
  }

  return context;
}

/**
 * Hook to access a specific configuration section
 * Provides automatic re-renders only when the section changes
 *
 * @param section - Configuration section to access
 * @returns Configuration section value
 *
 * @example
 * ```tsx
 * function ApiConsumer() {
 *   const apiConfig = useGraphConfigSection('api');
 *   return <div>Timeout: {apiConfig.timeout}</div>;
 * }
 * ```
 */
export function useGraphConfigSection<K extends keyof GraphConfig>(
  section: K
): GraphConfig[K] {
  const { config } = useGraphConfig();
  return config[section];
}

/**
 * Hook to check if a feature is enabled
 *
 * @param feature - Feature flag key
 * @returns Whether the feature is enabled
 *
 * @example
 * ```tsx
 * function ExportButton() {
 *   const isExportEnabled = useFeatureEnabled('enableExport');
 *
 *   if (!isExportEnabled) return null;
 *
 *   return <button>Export</button>;
 * }
 * ```
 */
export function useFeatureEnabled(
  feature: keyof GraphConfig['features']
): boolean {
  const { isFeatureEnabled } = useGraphConfig();
  return isFeatureEnabled(feature);
}

/**
 * Hook to get all feature flags
 *
 * @returns All feature flag values
 *
 * @example
 * ```tsx
 * function FeatureFlags() {
 *   const features = useGraphFeatures();
 *   return (
 *     <div>
 *       Export: {features.enableExport ? 'On' : 'Off'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGraphFeatures(): GraphConfig['features'] {
  return useGraphConfigSection('features');
}

/**
 * Hook to get theme configuration
 *
 * @returns Theme configuration
 *
 * @example
 * ```tsx
 * function NodeComponent({ type }) {
 *   const theme = useGraphTheme();
 *   const color = theme.nodeColors[type] || theme.nodeColors.default;
 *   return <div style={{ backgroundColor: color }} />;
 * }
 * ```
 */
export function useGraphTheme(): GraphConfig['theme'] {
  return useGraphConfigSection('theme');
}

/**
 * Hook to get layout configuration
 *
 * @returns Layout configuration
 *
 * @example
 * ```tsx
 * function LayoutController() {
 *   const layout = useGraphLayoutConfig();
 *   return <div>Direction: {layout.direction}</div>;
 * }
 * ```
 */
export function useGraphLayoutConfig(): GraphConfig['layout'] {
  return useGraphConfigSection('layout');
}

/**
 * Hook to get limit configuration with computed helpers
 *
 * @param nodeCount - Current number of nodes (optional)
 * @returns Limits config with computed properties
 *
 * @example
 * ```tsx
 * function GraphCanvas({ nodes }) {
 *   const { shouldDisableAnimations, shouldHideLabels } = useGraphLimits(nodes.length);
 *
 *   return (
 *     <Canvas
 *       animated={!shouldDisableAnimations}
 *       showLabels={!shouldHideLabels}
 *     />
 *   );
 * }
 * ```
 */
export function useGraphLimits(nodeCount?: number): GraphConfig['limits'] & {
  shouldDisableAnimations: boolean;
  shouldHideLabels: boolean;
  showWarning: boolean;
} {
  const limits = useGraphConfigSection('limits');

  return useMemo(
    () => ({
      ...limits,
      shouldDisableAnimations:
        nodeCount !== undefined
          ? nodeCount > limits.maxNodesForAnimation
          : false,
      shouldHideLabels:
        nodeCount !== undefined
          ? nodeCount > limits.maxNodesForLabels
          : false,
      showWarning:
        nodeCount !== undefined
          ? nodeCount > limits.nodeCountWarning
          : false,
    }),
    [limits, nodeCount]
  );
}

// ============================================================================
// Exports
// ============================================================================

export { GraphConfigContext };
