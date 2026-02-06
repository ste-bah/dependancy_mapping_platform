/**
 * Graph Preferences Hook
 * Persist user graph visualization preferences to localStorage
 * @module features/graph/hooks/useGraphPreferences
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { LayoutDirection } from '../utils/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * User preferences for graph visualization
 */
export interface GraphPreferences {
  /** Layout direction (TB, BT, LR, RL) */
  layoutDirection: LayoutDirection;
  /** Show minimap overlay */
  showMinimap: boolean;
  /** Show node labels */
  showLabels: boolean;
  /** Show edge labels */
  showEdgeLabels: boolean;
  /** Animate edges (for DEPENDS_ON relationships) */
  animateEdges: boolean;
  /** Auto-fit view when graph loads */
  autoFitView: boolean;
  /** Snap nodes to grid */
  snapToGrid: boolean;
  /** Grid size for snapping */
  gridSize: number;
  /** Default zoom level (0.1 - 2.0) */
  defaultZoom: number;
  /** Highlight dependencies on hover */
  highlightOnHover: boolean;
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Collapsed node types in filter panel */
  collapsedFilterGroups: string[];
  /** Recently selected node types (for quick access) */
  recentNodeTypes: string[];
}

/**
 * Default preferences
 */
export const DEFAULT_PREFERENCES: GraphPreferences = {
  layoutDirection: 'TB',
  showMinimap: true,
  showLabels: true,
  showEdgeLabels: false,
  animateEdges: true,
  autoFitView: true,
  snapToGrid: false,
  gridSize: 20,
  defaultZoom: 0.75,
  highlightOnHover: true,
  theme: 'system',
  collapsedFilterGroups: [],
  recentNodeTypes: [],
};

/**
 * Return type for useGraphPreferences hook
 */
export interface UseGraphPreferencesReturn {
  /** Current preferences */
  preferences: GraphPreferences;
  /** Update a single preference */
  updatePreference: <K extends keyof GraphPreferences>(
    key: K,
    value: GraphPreferences[K]
  ) => void;
  /** Update multiple preferences at once */
  updatePreferences: (updates: Partial<GraphPreferences>) => void;
  /** Reset all preferences to defaults */
  resetPreferences: () => void;
  /** Reset a single preference to default */
  resetPreference: <K extends keyof GraphPreferences>(key: K) => void;
  /** Check if preferences differ from defaults */
  hasCustomPreferences: boolean;
  /** Toggle a boolean preference */
  togglePreference: (key: keyof PickBoolean<GraphPreferences>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'graph-preferences';
const STORAGE_VERSION = 1;

/**
 * Storage format with version for migrations
 */
interface StoredPreferences {
  version: number;
  data: Partial<GraphPreferences>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Pick only boolean keys from an object type
 */
type PickBoolean<T> = {
  [K in keyof T as T[K] extends boolean ? K : never]: T[K];
};

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Safely read preferences from localStorage
 */
function readStoredPreferences(): Partial<GraphPreferences> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed: StoredPreferences = JSON.parse(stored);

    // Handle version migrations if needed
    if (parsed.version !== STORAGE_VERSION) {
      // For now, just return defaults on version mismatch
      // In the future, implement migration logic here
      return {};
    }

    return parsed.data;
  } catch (error) {
    console.warn('Failed to read graph preferences from localStorage:', error);
    return {};
  }
}

/**
 * Safely write preferences to localStorage
 */
function writeStoredPreferences(preferences: Partial<GraphPreferences>): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const stored: StoredPreferences = {
      version: STORAGE_VERSION,
      data: preferences,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn('Failed to write graph preferences to localStorage:', error);
  }
}

/**
 * Validate and sanitize preferences
 */
function sanitizePreferences(
  stored: Partial<GraphPreferences>
): Partial<GraphPreferences> {
  const sanitized: Partial<GraphPreferences> = {};

  // Validate layoutDirection
  if (stored.layoutDirection) {
    const validDirections = ['TB', 'BT', 'LR', 'RL'];
    if (validDirections.includes(stored.layoutDirection)) {
      sanitized.layoutDirection = stored.layoutDirection;
    }
  }

  // Validate boolean fields
  const booleanKeys: Array<keyof PickBoolean<GraphPreferences>> = [
    'showMinimap',
    'showLabels',
    'showEdgeLabels',
    'animateEdges',
    'autoFitView',
    'snapToGrid',
    'highlightOnHover',
  ];

  for (const key of booleanKeys) {
    if (typeof stored[key] === 'boolean') {
      (sanitized as Record<string, unknown>)[key] = stored[key];
    }
  }

  // Validate gridSize (must be positive integer)
  if (typeof stored.gridSize === 'number' && stored.gridSize > 0) {
    sanitized.gridSize = Math.floor(stored.gridSize);
  }

  // Validate defaultZoom (must be between 0.1 and 2.0)
  if (typeof stored.defaultZoom === 'number') {
    sanitized.defaultZoom = Math.max(0.1, Math.min(2.0, stored.defaultZoom));
  }

  // Validate theme
  if (stored.theme) {
    const validThemes = ['light', 'dark', 'system'];
    if (validThemes.includes(stored.theme)) {
      sanitized.theme = stored.theme;
    }
  }

  // Validate array fields
  if (Array.isArray(stored.collapsedFilterGroups)) {
    sanitized.collapsedFilterGroups = stored.collapsedFilterGroups.filter(
      (item) => typeof item === 'string'
    );
  }

  if (Array.isArray(stored.recentNodeTypes)) {
    sanitized.recentNodeTypes = stored.recentNodeTypes
      .filter((item) => typeof item === 'string')
      .slice(0, 10); // Limit to 10 recent items
  }

  return sanitized;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing graph visualization preferences
 *
 * Persists user preferences to localStorage with automatic sync
 * across browser tabs.
 *
 * @returns Preferences state and update functions
 *
 * @example
 * ```tsx
 * function GraphSettings() {
 *   const {
 *     preferences,
 *     updatePreference,
 *     togglePreference,
 *     resetPreferences,
 *   } = useGraphPreferences();
 *
 *   return (
 *     <div>
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={preferences.showMinimap}
 *           onChange={() => togglePreference('showMinimap')}
 *         />
 *         Show Minimap
 *       </label>
 *
 *       <select
 *         value={preferences.layoutDirection}
 *         onChange={(e) => updatePreference('layoutDirection', e.target.value)}
 *       >
 *         <option value="TB">Top to Bottom</option>
 *         <option value="LR">Left to Right</option>
 *       </select>
 *
 *       <button onClick={resetPreferences}>
 *         Reset to Defaults
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGraphPreferences(): UseGraphPreferencesReturn {
  // Initialize state with merged defaults and stored values
  const [preferences, setPreferences] = useState<GraphPreferences>(() => {
    const stored = readStoredPreferences();
    const sanitized = sanitizePreferences(stored);
    return { ...DEFAULT_PREFERENCES, ...sanitized };
  });

  // Track custom preferences (differs from defaults)
  const [customPrefs, setCustomPrefs] = useState<Partial<GraphPreferences>>(() => {
    const stored = readStoredPreferences();
    return sanitizePreferences(stored);
  });

  // Persist changes to localStorage
  useEffect(() => {
    writeStoredPreferences(customPrefs);
  }, [customPrefs]);

  // Listen for changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed: StoredPreferences = JSON.parse(event.newValue);
          if (parsed.version === STORAGE_VERSION) {
            const sanitized = sanitizePreferences(parsed.data);
            setCustomPrefs(sanitized);
            setPreferences({ ...DEFAULT_PREFERENCES, ...sanitized });
          }
        } catch {
          // Ignore parse errors from other tabs
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update a single preference
  const updatePreference = useCallback(
    <K extends keyof GraphPreferences>(key: K, value: GraphPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));

      // Track as custom if different from default
      if (value !== DEFAULT_PREFERENCES[key]) {
        setCustomPrefs((prev) => ({ ...prev, [key]: value }));
      } else {
        // Remove from custom if matches default
        setCustomPrefs((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    []
  );

  // Update multiple preferences at once
  const updatePreferences = useCallback(
    (updates: Partial<GraphPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...updates }));

      setCustomPrefs((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(updates)) {
          const k = key as keyof GraphPreferences;
          if (value !== DEFAULT_PREFERENCES[k]) {
            (next as Record<string, unknown>)[k] = value;
          } else {
            delete next[k];
          }
        }
        return next;
      });
    },
    []
  );

  // Reset all preferences
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    setCustomPrefs({});
  }, []);

  // Reset a single preference
  const resetPreference = useCallback(
    <K extends keyof GraphPreferences>(key: K) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: DEFAULT_PREFERENCES[key],
      }));
      setCustomPrefs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  // Toggle a boolean preference
  const togglePreference = useCallback(
    (key: keyof PickBoolean<GraphPreferences>) => {
      setPreferences((prev) => {
        const newValue = !prev[key];
        // Also update custom prefs
        if (newValue !== DEFAULT_PREFERENCES[key]) {
          setCustomPrefs((p) => ({ ...p, [key]: newValue }));
        } else {
          setCustomPrefs((p) => {
            const next = { ...p };
            delete next[key];
            return next;
          });
        }
        return { ...prev, [key]: newValue };
      });
    },
    []
  );

  // Check if any preferences differ from defaults
  const hasCustomPreferences = useMemo(
    () => Object.keys(customPrefs).length > 0,
    [customPrefs]
  );

  return {
    preferences,
    updatePreference,
    updatePreferences,
    resetPreferences,
    resetPreference,
    hasCustomPreferences,
    togglePreference,
  };
}

export default useGraphPreferences;
