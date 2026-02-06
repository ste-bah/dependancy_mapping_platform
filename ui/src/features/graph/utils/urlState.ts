/**
 * URL State Serialization
 * Serialize and deserialize graph state to/from URL parameters
 * @module features/graph/utils/urlState
 */

import type {
  GraphFilters,
  ExtendedGraphFilters,
  GraphNodeType,
  EdgeType,
  GraphViewState,
} from '../types';
import {
  ALL_NODE_TYPES,
  ALL_EDGE_TYPES,
  defaultGraphFilters,
  defaultExtendedGraphFilters,
  isGraphNodeType,
  isEdgeType,
} from '../types';
import { URL_PARAM_KEYS, URL_ARRAY_SEPARATOR } from './constants';

// ============================================================================
// Filter Serialization
// ============================================================================

/**
 * Serialize graph filters to URL search params
 * Only includes non-default values to keep URLs clean
 *
 * @param filters - Graph filter state to serialize
 * @returns URLSearchParams with filter values
 *
 * @example
 * ```ts
 * const params = filtersToSearchParams({
 *   nodeTypes: ['terraform_resource'],
 *   search: 'database',
 *   showBlastRadius: true,
 * });
 * // params.toString() = 'types=terraform_resource&q=database&blast=true'
 * ```
 */
export function filtersToSearchParams(filters: GraphFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Node types (only if not all types are selected)
  if (filters.nodeTypes.length > 0 && filters.nodeTypes.length < ALL_NODE_TYPES.length) {
    params.set(URL_PARAM_KEYS.nodeTypes, filters.nodeTypes.join(URL_ARRAY_SEPARATOR));
  }

  // Search query
  if (filters.search && filters.search.trim() !== '') {
    params.set(URL_PARAM_KEYS.search, filters.search.trim());
  }

  // Blast radius mode
  if (filters.showBlastRadius) {
    params.set(URL_PARAM_KEYS.blastRadius, 'true');
  }

  return params;
}

/**
 * Serialize extended filters to URL search params
 *
 * @param filters - Extended filter state to serialize
 * @returns URLSearchParams with all filter values
 */
export function extendedFiltersToSearchParams(filters: ExtendedGraphFilters): URLSearchParams {
  const params = filtersToSearchParams(filters);

  // Edge types (only if not all types)
  if (filters.edgeTypes.length > 0 && filters.edgeTypes.length < ALL_EDGE_TYPES.length) {
    params.set(URL_PARAM_KEYS.edgeTypes, filters.edgeTypes.join(URL_ARRAY_SEPARATOR));
  }

  // Min confidence (only if non-zero)
  if (filters.minConfidence > 0) {
    params.set(URL_PARAM_KEYS.minConfidence, filters.minConfidence.toString());
  }

  // Max depth (only if finite)
  if (isFinite(filters.maxDepth) && filters.maxDepth !== Infinity) {
    params.set(URL_PARAM_KEYS.maxDepth, filters.maxDepth.toString());
  }

  // Connected only
  if (filters.showConnectedOnly) {
    params.set(URL_PARAM_KEYS.connectedOnly, 'true');
  }

  return params;
}

// ============================================================================
// Filter Deserialization
// ============================================================================

/**
 * Deserialize URL search params to graph filters
 * Missing params default to defaultGraphFilters values
 *
 * @param params - URLSearchParams to parse
 * @returns GraphFilters object with parsed values
 *
 * @example
 * ```ts
 * const params = new URLSearchParams('types=terraform_resource&q=bucket');
 * const filters = searchParamsToFilters(params);
 * // filters.nodeTypes = ['terraform_resource']
 * // filters.search = 'bucket'
 * ```
 */
export function searchParamsToFilters(params: URLSearchParams): GraphFilters {
  // Parse node types
  const nodeTypesParam = params.get(URL_PARAM_KEYS.nodeTypes);
  let nodeTypes: GraphNodeType[] = [...defaultGraphFilters.nodeTypes];

  if (nodeTypesParam) {
    const parsed = nodeTypesParam
      .split(URL_ARRAY_SEPARATOR)
      .filter(isGraphNodeType);

    if (parsed.length > 0) {
      nodeTypes = parsed;
    }
  }

  // Parse search
  const search = params.get(URL_PARAM_KEYS.search) ?? '';

  // Parse blast radius
  const showBlastRadius = params.get(URL_PARAM_KEYS.blastRadius) === 'true';

  return {
    nodeTypes,
    search,
    showBlastRadius,
  };
}

/**
 * Deserialize URL params to extended filters
 *
 * @param params - URLSearchParams to parse
 * @returns ExtendedGraphFilters object
 */
export function searchParamsToExtendedFilters(params: URLSearchParams): ExtendedGraphFilters {
  const baseFilters = searchParamsToFilters(params);

  // Parse edge types
  const edgeTypesParam = params.get(URL_PARAM_KEYS.edgeTypes);
  let edgeTypes: EdgeType[] = [...defaultExtendedGraphFilters.edgeTypes];

  if (edgeTypesParam) {
    const parsed = edgeTypesParam
      .split(URL_ARRAY_SEPARATOR)
      .filter(isEdgeType);

    if (parsed.length > 0) {
      edgeTypes = parsed;
    }
  }

  // Parse min confidence
  const confidenceParam = params.get(URL_PARAM_KEYS.minConfidence);
  let minConfidence = defaultExtendedGraphFilters.minConfidence;

  if (confidenceParam) {
    const parsed = parseFloat(confidenceParam);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      minConfidence = parsed;
    }
  }

  // Parse max depth
  const depthParam = params.get(URL_PARAM_KEYS.maxDepth);
  let maxDepth = defaultExtendedGraphFilters.maxDepth;

  if (depthParam) {
    const parsed = parseInt(depthParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      maxDepth = parsed;
    }
  }

  // Parse connected only
  const showConnectedOnly = params.get(URL_PARAM_KEYS.connectedOnly) === 'true';

  return {
    ...baseFilters,
    edgeTypes,
    minConfidence,
    maxDepth,
    showConnectedOnly,
  };
}

// ============================================================================
// Selected Node Serialization
// ============================================================================

/**
 * Serialize selected node ID to URL param value
 *
 * @param nodeId - Selected node ID or null
 * @returns URL param value (empty string if null)
 */
export function selectedNodeToParam(nodeId: string | null): string {
  return nodeId ?? '';
}

/**
 * Deserialize URL param to selected node ID
 *
 * @param param - URL param value or null
 * @returns Node ID or null
 */
export function paramToSelectedNode(param: string | null): string | null {
  if (!param || param.trim() === '') {
    return null;
  }
  return param.trim();
}

// ============================================================================
// Viewport Serialization
// ============================================================================

/**
 * Serialize viewport state to URL search params
 *
 * @param viewport - Viewport state (x, y, zoom)
 * @returns URLSearchParams with viewport values
 */
export function viewportToSearchParams(viewport: GraphViewState): URLSearchParams {
  const params = new URLSearchParams();

  // Round to 2 decimal places to keep URLs clean
  params.set(URL_PARAM_KEYS.viewX, viewport.x.toFixed(2));
  params.set(URL_PARAM_KEYS.viewY, viewport.y.toFixed(2));
  params.set(URL_PARAM_KEYS.zoom, viewport.zoom.toFixed(2));

  return params;
}

/**
 * Deserialize URL params to viewport state
 *
 * @param params - URLSearchParams to parse
 * @param defaults - Default viewport values
 * @returns Viewport state
 */
export function searchParamsToViewport(
  params: URLSearchParams,
  defaults: GraphViewState = { x: 0, y: 0, zoom: 1 }
): GraphViewState {
  const xParam = params.get(URL_PARAM_KEYS.viewX);
  const yParam = params.get(URL_PARAM_KEYS.viewY);
  const zoomParam = params.get(URL_PARAM_KEYS.zoom);

  return {
    x: xParam ? parseFloat(xParam) : defaults.x,
    y: yParam ? parseFloat(yParam) : defaults.y,
    zoom: zoomParam ? parseFloat(zoomParam) : defaults.zoom,
  };
}

// ============================================================================
// Combined State Management
// ============================================================================

/**
 * Full graph state for URL serialization
 */
export interface GraphUrlState {
  filters: GraphFilters;
  selectedNodeId: string | null;
  viewport?: GraphViewState;
}

/**
 * Full graph state for URL serialization (extended)
 */
export interface ExtendedGraphUrlState {
  filters: ExtendedGraphFilters;
  selectedNodeId: string | null;
  viewport?: GraphViewState;
}

/**
 * Serialize complete graph state to URL search params
 *
 * @param state - Complete graph state
 * @returns URLSearchParams with all state
 */
export function stateToSearchParams(state: GraphUrlState): URLSearchParams {
  const params = filtersToSearchParams(state.filters);

  if (state.selectedNodeId) {
    params.set(URL_PARAM_KEYS.selected, state.selectedNodeId);
  }

  if (state.viewport) {
    const viewportParams = viewportToSearchParams(state.viewport);
    viewportParams.forEach((value, key) => params.set(key, value));
  }

  return params;
}

/**
 * Serialize extended graph state to URL search params
 *
 * @param state - Extended graph state
 * @returns URLSearchParams with all state
 */
export function extendedStateToSearchParams(state: ExtendedGraphUrlState): URLSearchParams {
  const params = extendedFiltersToSearchParams(state.filters);

  if (state.selectedNodeId) {
    params.set(URL_PARAM_KEYS.selected, state.selectedNodeId);
  }

  if (state.viewport) {
    const viewportParams = viewportToSearchParams(state.viewport);
    viewportParams.forEach((value, key) => params.set(key, value));
  }

  return params;
}

/**
 * Deserialize URL search params to complete graph state
 *
 * @param params - URLSearchParams to parse
 * @returns Complete graph state
 */
export function searchParamsToState(params: URLSearchParams): GraphUrlState {
  return {
    filters: searchParamsToFilters(params),
    selectedNodeId: paramToSelectedNode(params.get(URL_PARAM_KEYS.selected)),
    viewport: hasViewportParams(params) ? searchParamsToViewport(params) : undefined,
  };
}

/**
 * Deserialize URL params to extended graph state
 *
 * @param params - URLSearchParams to parse
 * @returns Extended graph state
 */
export function searchParamsToExtendedState(params: URLSearchParams): ExtendedGraphUrlState {
  return {
    filters: searchParamsToExtendedFilters(params),
    selectedNodeId: paramToSelectedNode(params.get(URL_PARAM_KEYS.selected)),
    viewport: hasViewportParams(params) ? searchParamsToViewport(params) : undefined,
  };
}

/**
 * Check if URL params contain viewport information
 */
function hasViewportParams(params: URLSearchParams): boolean {
  return (
    params.has(URL_PARAM_KEYS.viewX) ||
    params.has(URL_PARAM_KEYS.viewY) ||
    params.has(URL_PARAM_KEYS.zoom)
  );
}

// ============================================================================
// URL Manipulation Utilities
// ============================================================================

/**
 * Update URL search params without full page navigation
 *
 * @param params - New URLSearchParams
 * @param replace - Replace history instead of push
 */
export function updateUrlParams(params: URLSearchParams, replace: boolean = false): void {
  const newUrl = `${window.location.pathname}?${params.toString()}`;

  if (replace) {
    window.history.replaceState(null, '', newUrl);
  } else {
    window.history.pushState(null, '', newUrl);
  }
}

/**
 * Get current URL search params
 *
 * @returns Current URLSearchParams
 */
export function getCurrentUrlParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

/**
 * Merge new params into existing URL params
 *
 * @param updates - New values to merge
 * @param current - Current params (defaults to window.location)
 * @returns Merged URLSearchParams
 */
export function mergeUrlParams(
  updates: Record<string, string | null>,
  current: URLSearchParams = getCurrentUrlParams()
): URLSearchParams {
  const merged = new URLSearchParams(current);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      merged.delete(key);
    } else {
      merged.set(key, value);
    }
  }

  return merged;
}

/**
 * Clear all graph-related URL params
 *
 * @returns Empty URLSearchParams (preserving non-graph params)
 */
export function clearGraphUrlParams(): URLSearchParams {
  const current = getCurrentUrlParams();
  const graphKeys = Object.values(URL_PARAM_KEYS);

  for (const key of graphKeys) {
    current.delete(key);
  }

  return current;
}
