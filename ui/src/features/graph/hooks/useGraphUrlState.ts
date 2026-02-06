/**
 * Graph URL State Hook
 * Synchronize graph filters and selection with URL search parameters
 * @module features/graph/hooks/useGraphUrlState
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import type { GraphFilters, GraphNodeType, GraphViewState } from '../types';
import { defaultGraphFilters, ALL_NODE_TYPES } from '../types';
import { URL_PARAM_KEYS } from '../utils/constants';
import {
  searchParamsToFilters,
  filtersToSearchParams,
  paramToSelectedNode,
  searchParamsToViewport,
  viewportToSearchParams,
  type GraphUrlState,
} from '../utils/urlState';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useGraphUrlState hook
 */
export interface UseGraphUrlStateOptions {
  /** Enable URL synchronization (default: true) */
  enabled?: boolean;
  /** Replace history entry instead of push (default: true) */
  replaceState?: boolean;
  /** Debounce URL updates in ms (default: 300) */
  debounceMs?: number;
  /** Include viewport in URL (default: false) */
  syncViewport?: boolean;
  /** Initial filters if not in URL */
  defaultFilters?: Partial<GraphFilters>;
  /** Callback when filters change */
  onFiltersChange?: (filters: GraphFilters) => void;
  /** Callback when selection changes */
  onSelectionChange?: (nodeId: string | null) => void;
}

/**
 * Return type for useGraphUrlState hook
 */
export interface UseGraphUrlStateReturn {
  /** Current filters (from URL or defaults) */
  filters: GraphFilters;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Current viewport state (if synced) */
  viewport: GraphViewState | undefined;
  /** Set all filters at once */
  setFilters: (filters: GraphFilters) => void;
  /** Update partial filters */
  updateFilters: (updates: Partial<GraphFilters>) => void;
  /** Set node types filter */
  setNodeTypes: (types: GraphNodeType[]) => void;
  /** Toggle a single node type */
  toggleNodeType: (type: GraphNodeType) => void;
  /** Set search query */
  setSearch: (search: string) => void;
  /** Toggle blast radius mode */
  toggleBlastRadius: () => void;
  /** Set selected node */
  setSelectedNodeId: (nodeId: string | null) => void;
  /** Set viewport state */
  setViewport: (viewport: GraphViewState) => void;
  /** Reset filters to defaults */
  resetFilters: () => void;
  /** Clear URL state entirely */
  clearUrlState: () => void;
  /** Whether any filters are active (differ from defaults) */
  hasActiveFilters: boolean;
  /** Number of hidden node types */
  hiddenNodeTypeCount: number;
  /** Get URL for current state (for sharing) */
  getShareableUrl: () => string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for synchronizing graph state with URL parameters
 *
 * Provides two-way binding between graph state and URL search params,
 * enabling shareable URLs and browser history navigation.
 *
 * @param options - Configuration options
 * @returns State and update functions
 *
 * @example
 * ```tsx
 * function GraphPage() {
 *   const {
 *     filters,
 *     selectedNodeId,
 *     setNodeTypes,
 *     setSelectedNodeId,
 *     resetFilters,
 *     getShareableUrl,
 *   } = useGraphUrlState({
 *     onFiltersChange: (filters) => {
 *       console.log('Filters changed:', filters);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <FilterPanel
 *         filters={filters}
 *         onNodeTypesChange={setNodeTypes}
 *       />
 *       <GraphCanvas
 *         selectedNodeId={selectedNodeId}
 *         onNodeSelect={setSelectedNodeId}
 *       />
 *       <button onClick={() => navigator.clipboard.writeText(getShareableUrl())}>
 *         Copy Link
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGraphUrlState(
  options: UseGraphUrlStateOptions = {}
): UseGraphUrlStateReturn {
  const {
    enabled = true,
    replaceState = true,
    debounceMs = 300,
    syncViewport = false,
    defaultFilters,
    onFiltersChange,
    onSelectionChange,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Refs for debouncing
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalUpdateRef = useRef(false);

  // Parse initial state from URL
  const initialState = useMemo((): GraphUrlState => {
    const urlFilters = searchParamsToFilters(searchParams);
    const merged: GraphFilters = {
      ...defaultGraphFilters,
      ...defaultFilters,
      ...urlFilters,
    };

    // Only use URL values if they were actually present
    if (!searchParams.has(URL_PARAM_KEYS.nodeTypes)) {
      merged.nodeTypes = defaultFilters?.nodeTypes ?? defaultGraphFilters.nodeTypes;
    }
    if (!searchParams.has(URL_PARAM_KEYS.blastRadius)) {
      merged.showBlastRadius = defaultFilters?.showBlastRadius ?? defaultGraphFilters.showBlastRadius;
    }

    const state: GraphUrlState = {
      filters: merged,
      selectedNodeId: paramToSelectedNode(searchParams.get(URL_PARAM_KEYS.selected)),
    };

    if (syncViewport) {
      state.viewport = searchParamsToViewport(searchParams);
    }

    return state;
  }, []); // Only compute on mount

  // State
  const [filters, setFiltersState] = useState<GraphFilters>(initialState.filters);
  const [selectedNodeId, setSelectedNodeIdState] = useState<string | null>(
    initialState.selectedNodeId
  );
  const [viewport, setViewportState] = useState<GraphViewState | undefined>(
    initialState.viewport
  );

  // Sync URL to state on popstate (browser back/forward)
  useEffect(() => {
    if (!enabled) return;

    const handlePopState = () => {
      if (isInternalUpdateRef.current) {
        isInternalUpdateRef.current = false;
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const urlFilters = searchParamsToFilters(params);
      const urlSelection = paramToSelectedNode(params.get(URL_PARAM_KEYS.selected));

      setFiltersState({
        ...defaultGraphFilters,
        ...defaultFilters,
        ...urlFilters,
      });
      setSelectedNodeIdState(urlSelection);

      if (syncViewport) {
        setViewportState(searchParamsToViewport(params));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enabled, defaultFilters, syncViewport]);

  // Debounced URL update
  const updateUrl = useCallback(
    (newFilters: GraphFilters, newSelection: string | null, newViewport?: GraphViewState) => {
      if (!enabled) return;

      // Clear pending update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        isInternalUpdateRef.current = true;

        const params = filtersToSearchParams(newFilters);

        if (newSelection) {
          params.set(URL_PARAM_KEYS.selected, newSelection);
        }

        if (syncViewport && newViewport) {
          const viewportParams = viewportToSearchParams(newViewport);
          viewportParams.forEach((value, key) => params.set(key, value));
        }

        setSearchParams(params, { replace: replaceState });
      }, debounceMs);
    },
    [enabled, debounceMs, replaceState, setSearchParams, syncViewport]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Filter setters
  const setFilters = useCallback(
    (newFilters: GraphFilters) => {
      setFiltersState(newFilters);
      updateUrl(newFilters, selectedNodeId, viewport);
      onFiltersChange?.(newFilters);
    },
    [selectedNodeId, viewport, updateUrl, onFiltersChange]
  );

  const updateFilters = useCallback(
    (updates: Partial<GraphFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...updates };
        updateUrl(next, selectedNodeId, viewport);
        onFiltersChange?.(next);
        return next;
      });
    },
    [selectedNodeId, viewport, updateUrl, onFiltersChange]
  );

  const setNodeTypes = useCallback(
    (types: GraphNodeType[]) => {
      updateFilters({ nodeTypes: types });
    },
    [updateFilters]
  );

  const toggleNodeType = useCallback(
    (type: GraphNodeType) => {
      setFiltersState((prev) => {
        const hasType = prev.nodeTypes.includes(type);

        // Don't allow deselecting the last type
        if (hasType && prev.nodeTypes.length === 1) {
          return prev;
        }

        const next: GraphFilters = {
          ...prev,
          nodeTypes: hasType
            ? prev.nodeTypes.filter((t) => t !== type)
            : [...prev.nodeTypes, type],
        };

        updateUrl(next, selectedNodeId, viewport);
        onFiltersChange?.(next);
        return next;
      });
    },
    [selectedNodeId, viewport, updateUrl, onFiltersChange]
  );

  const setSearch = useCallback(
    (search: string) => {
      updateFilters({ search });
    },
    [updateFilters]
  );

  const toggleBlastRadius = useCallback(() => {
    updateFilters({ showBlastRadius: !filters.showBlastRadius });
  }, [filters.showBlastRadius, updateFilters]);

  // Selection setter
  const setSelectedNodeId = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeIdState(nodeId);
      updateUrl(filters, nodeId, viewport);
      onSelectionChange?.(nodeId);
    },
    [filters, viewport, updateUrl, onSelectionChange]
  );

  // Viewport setter
  const setViewport = useCallback(
    (newViewport: GraphViewState) => {
      setViewportState(newViewport);
      if (syncViewport) {
        updateUrl(filters, selectedNodeId, newViewport);
      }
    },
    [filters, selectedNodeId, syncViewport, updateUrl]
  );

  // Reset filters
  const resetFilters = useCallback(() => {
    const reset: GraphFilters = {
      ...defaultGraphFilters,
      ...defaultFilters,
    };
    setFiltersState(reset);
    updateUrl(reset, selectedNodeId, viewport);
    onFiltersChange?.(reset);
  }, [defaultFilters, selectedNodeId, viewport, updateUrl, onFiltersChange]);

  // Clear all URL state
  const clearUrlState = useCallback(() => {
    setFiltersState({ ...defaultGraphFilters, ...defaultFilters });
    setSelectedNodeIdState(null);
    setViewportState(undefined);

    if (enabled) {
      setSearchParams(new URLSearchParams(), { replace: true });
    }
  }, [enabled, defaultFilters, setSearchParams]);

  // Computed values
  const hasActiveFilters = useMemo(() => {
    const defaults = { ...defaultGraphFilters, ...defaultFilters };
    return (
      filters.search !== '' ||
      filters.showBlastRadius !== defaults.showBlastRadius ||
      filters.nodeTypes.length !== defaults.nodeTypes.length ||
      !filters.nodeTypes.every((t) => defaults.nodeTypes.includes(t))
    );
  }, [filters, defaultFilters]);

  const hiddenNodeTypeCount = useMemo(
    () => ALL_NODE_TYPES.length - filters.nodeTypes.length,
    [filters.nodeTypes.length]
  );

  // Generate shareable URL
  const getShareableUrl = useCallback(() => {
    const params = filtersToSearchParams(filters);
    if (selectedNodeId) {
      params.set(URL_PARAM_KEYS.selected, selectedNodeId);
    }

    const base = `${window.location.origin}${location.pathname}`;
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }, [filters, selectedNodeId, location.pathname]);

  return {
    filters,
    selectedNodeId,
    viewport,
    setFilters,
    updateFilters,
    setNodeTypes,
    toggleNodeType,
    setSearch,
    toggleBlastRadius,
    setSelectedNodeId,
    setViewport,
    resetFilters,
    clearUrlState,
    hasActiveFilters,
    hiddenNodeTypeCount,
    getShareableUrl,
  };
}

export default useGraphUrlState;
