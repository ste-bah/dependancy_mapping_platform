/**
 * Filter Service
 * Manages filter state, application, and URL serialization
 * @module features/graph/services/filterService
 */

import type {
  FlowNode,
  FlowEdge,
  GraphFilters,
  ExtendedGraphFilters,
  GraphNodeType,
  EdgeType,
  BlastRadiusResponse,
} from '../types';
import {
  ALL_NODE_TYPES,
  ALL_EDGE_TYPES,
  defaultGraphFilters,
  defaultExtendedGraphFilters,
} from '../types';
import {
  filterNodes,
  filterNodesByType,
  filterNodesBySearch,
  filterEdges,
  filterEdgesByType,
  filterEdgesByConfidence,
  filterEdgesExtended,
  getConnectedNodeIds,
  applyFiltersAndHighlighting,
  filtersToSearchParams,
  extendedFiltersToSearchParams,
  searchParamsToFilters,
  searchParamsToExtendedFilters,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Filtered graph result
 */
export interface FilteredGraph {
  /** Filtered nodes */
  nodes: FlowNode[];
  /** Filtered edges */
  edges: FlowEdge[];
  /** Number of nodes filtered out */
  filteredOutNodeCount: number;
  /** Number of edges filtered out */
  filteredOutEdgeCount: number;
  /** Active filter count */
  activeFilterCount: number;
}

/**
 * Filter summary
 */
export interface FilterSummary {
  /** Total active filters */
  activeFilters: number;
  /** Node type filters active */
  nodeTypeFilters: number;
  /** Edge type filters active */
  edgeTypeFilters: number;
  /** Has search query */
  hasSearch: boolean;
  /** Has confidence filter */
  hasConfidenceFilter: boolean;
  /** Has depth filter */
  hasDepthFilter: boolean;
  /** Is showing connected only */
  showingConnectedOnly: boolean;
  /** Is blast radius mode active */
  blastRadiusActive: boolean;
}

/**
 * Filter service configuration
 */
export interface FilterServiceConfig {
  /** Use extended filters by default */
  useExtendedFilters?: boolean;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Service for managing graph filter operations
 *
 * @example
 * ```ts
 * const service = new FilterService();
 *
 * // Apply filters
 * const filtered = service.applyFilters(nodes, edges, filters);
 *
 * // Toggle node type
 * const newFilters = service.toggleNodeType(filters, 'terraform_resource');
 *
 * // Serialize to URL
 * const params = service.serializeToUrl(filters);
 * ```
 */
export class FilterService {
  private useExtendedFilters: boolean;

  constructor(config: FilterServiceConfig = {}) {
    this.useExtendedFilters = config.useExtendedFilters ?? false;
  }

  // ==========================================================================
  // Filter Application
  // ==========================================================================

  /**
   * Apply filters to graph nodes and edges
   *
   * @param nodes - All nodes
   * @param edges - All edges
   * @param filters - Filter configuration
   * @returns Filtered graph result
   */
  applyFilters(
    nodes: FlowNode[],
    edges: FlowEdge[],
    filters: GraphFilters | ExtendedGraphFilters
  ): FilteredGraph {
    const originalNodeCount = nodes.length;
    const originalEdgeCount = edges.length;

    // Convert to extended filters for consistent processing
    const extendedFilters = this.toExtendedFilters(filters);

    // Filter nodes
    let filteredNodes = filterNodes(nodes, extendedFilters);

    // Filter edges to visible nodes
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    let filteredEdges = filterEdgesExtended(edges, visibleNodeIds, extendedFilters);

    const filteredOutNodeCount = originalNodeCount - filteredNodes.length;
    const filteredOutEdgeCount = originalEdgeCount - filteredEdges.length;
    const activeFilterCount = this.countActiveFilters(extendedFilters);

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      filteredOutNodeCount,
      filteredOutEdgeCount,
      activeFilterCount,
    };
  }

  /**
   * Apply filters with highlighting for selection and blast radius
   *
   * @param nodes - All nodes
   * @param edges - All edges
   * @param filters - Filter configuration
   * @param selectedId - Selected node ID
   * @param blastRadius - Blast radius data
   * @returns Filtered and highlighted graph
   */
  applyFiltersWithHighlighting(
    nodes: FlowNode[],
    edges: FlowEdge[],
    filters: GraphFilters | ExtendedGraphFilters,
    selectedId: string | null,
    blastRadius: BlastRadiusResponse | null
  ): FilteredGraph {
    const originalNodeCount = nodes.length;
    const originalEdgeCount = edges.length;

    const extendedFilters = this.toExtendedFilters(filters);

    const { nodes: filteredNodes, edges: filteredEdges } =
      applyFiltersAndHighlighting(
        nodes,
        edges,
        extendedFilters,
        selectedId,
        blastRadius
      );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      filteredOutNodeCount: originalNodeCount - filteredNodes.length,
      filteredOutEdgeCount: originalEdgeCount - filteredEdges.length,
      activeFilterCount: this.countActiveFilters(extendedFilters),
    };
  }

  /**
   * Filter to only connected nodes
   *
   * @param nodes - All nodes
   * @param edges - All edges
   * @param centerId - Center node ID
   * @param maxDepth - Maximum traversal depth
   * @returns Filtered nodes connected to center
   */
  filterToConnected(
    nodes: FlowNode[],
    edges: FlowEdge[],
    centerId: string,
    maxDepth: number = Infinity
  ): FilteredGraph {
    const connectedIds = getConnectedNodeIds(centerId, edges, maxDepth);
    const filteredNodes = nodes.filter((n) => connectedIds.has(n.id));
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = filterEdges(edges, visibleNodeIds);

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      filteredOutNodeCount: nodes.length - filteredNodes.length,
      filteredOutEdgeCount: edges.length - filteredEdges.length,
      activeFilterCount: 1,
    };
  }

  // ==========================================================================
  // Filter Manipulation
  // ==========================================================================

  /**
   * Toggle a node type in filters
   *
   * @param currentFilters - Current filter state
   * @param nodeType - Node type to toggle
   * @returns Updated filters
   */
  toggleNodeType(
    currentFilters: GraphFilters | ExtendedGraphFilters,
    nodeType: GraphNodeType
  ): GraphFilters | ExtendedGraphFilters {
    const currentTypes = currentFilters.nodeTypes;
    const hasType = currentTypes.includes(nodeType);

    // Don't allow deselecting the last type
    if (hasType && currentTypes.length === 1) {
      return currentFilters;
    }

    const newTypes = hasType
      ? currentTypes.filter((t) => t !== nodeType)
      : [...currentTypes, nodeType];

    return {
      ...currentFilters,
      nodeTypes: newTypes,
    };
  }

  /**
   * Toggle an edge type in extended filters
   *
   * @param currentFilters - Current filter state
   * @param edgeType - Edge type to toggle
   * @returns Updated filters
   */
  toggleEdgeType(
    currentFilters: ExtendedGraphFilters,
    edgeType: EdgeType
  ): ExtendedGraphFilters {
    const currentTypes = currentFilters.edgeTypes;
    const hasType = currentTypes.includes(edgeType);

    // Don't allow deselecting the last type
    if (hasType && currentTypes.length === 1) {
      return currentFilters;
    }

    const newTypes = hasType
      ? currentTypes.filter((t) => t !== edgeType)
      : [...currentTypes, edgeType];

    return {
      ...currentFilters,
      edgeTypes: newTypes,
    };
  }

  /**
   * Set search query
   *
   * @param currentFilters - Current filter state
   * @param search - Search query
   * @returns Updated filters
   */
  setSearch(
    currentFilters: GraphFilters | ExtendedGraphFilters,
    search: string
  ): GraphFilters | ExtendedGraphFilters {
    return {
      ...currentFilters,
      search,
    };
  }

  /**
   * Set confidence threshold
   *
   * @param currentFilters - Current filter state
   * @param minConfidence - Minimum confidence (0-1)
   * @returns Updated filters
   */
  setConfidence(
    currentFilters: ExtendedGraphFilters,
    minConfidence: number
  ): ExtendedGraphFilters {
    return {
      ...currentFilters,
      minConfidence: Math.max(0, Math.min(1, minConfidence)),
    };
  }

  /**
   * Set max depth
   *
   * @param currentFilters - Current filter state
   * @param maxDepth - Maximum depth
   * @returns Updated filters
   */
  setMaxDepth(
    currentFilters: ExtendedGraphFilters,
    maxDepth: number
  ): ExtendedGraphFilters {
    return {
      ...currentFilters,
      maxDepth: maxDepth <= 0 ? Infinity : maxDepth,
    };
  }

  /**
   * Toggle connected only filter
   *
   * @param currentFilters - Current filter state
   * @returns Updated filters
   */
  toggleConnectedOnly(
    currentFilters: ExtendedGraphFilters
  ): ExtendedGraphFilters {
    return {
      ...currentFilters,
      showConnectedOnly: !currentFilters.showConnectedOnly,
    };
  }

  /**
   * Toggle blast radius mode
   *
   * @param currentFilters - Current filter state
   * @returns Updated filters
   */
  toggleBlastRadius(
    currentFilters: GraphFilters | ExtendedGraphFilters
  ): GraphFilters | ExtendedGraphFilters {
    return {
      ...currentFilters,
      showBlastRadius: !currentFilters.showBlastRadius,
    };
  }

  /**
   * Reset filters to defaults
   *
   * @param extended - Use extended defaults
   * @returns Default filters
   */
  resetFilters(extended?: boolean): GraphFilters | ExtendedGraphFilters {
    const useExtended = extended ?? this.useExtendedFilters;
    return useExtended
      ? { ...defaultExtendedGraphFilters }
      : { ...defaultGraphFilters };
  }

  /**
   * Select all node types
   *
   * @param currentFilters - Current filter state
   * @returns Updated filters with all node types
   */
  selectAllNodeTypes(
    currentFilters: GraphFilters | ExtendedGraphFilters
  ): GraphFilters | ExtendedGraphFilters {
    return {
      ...currentFilters,
      nodeTypes: [...ALL_NODE_TYPES],
    };
  }

  /**
   * Select all edge types
   *
   * @param currentFilters - Current filter state
   * @returns Updated filters with all edge types
   */
  selectAllEdgeTypes(
    currentFilters: ExtendedGraphFilters
  ): ExtendedGraphFilters {
    return {
      ...currentFilters,
      edgeTypes: [...ALL_EDGE_TYPES],
    };
  }

  // ==========================================================================
  // URL Serialization
  // ==========================================================================

  /**
   * Serialize filters to URL search params
   *
   * @param filters - Filters to serialize
   * @returns URLSearchParams
   */
  serializeToUrl(filters: GraphFilters | ExtendedGraphFilters): URLSearchParams {
    if (this.isExtendedFilters(filters)) {
      return extendedFiltersToSearchParams(filters);
    }
    return filtersToSearchParams(filters);
  }

  /**
   * Deserialize filters from URL search params
   *
   * @param params - URL search params
   * @param extended - Parse as extended filters
   * @returns Parsed filters
   */
  deserializeFromUrl(
    params: URLSearchParams,
    extended?: boolean
  ): GraphFilters | ExtendedGraphFilters {
    const useExtended = extended ?? this.useExtendedFilters;
    return useExtended
      ? searchParamsToExtendedFilters(params)
      : searchParamsToFilters(params);
  }

  /**
   * Merge filters with URL params
   *
   * @param currentFilters - Current filters
   * @param params - URL params to merge
   * @returns Merged filters
   */
  mergeWithUrlParams(
    currentFilters: GraphFilters | ExtendedGraphFilters,
    params: URLSearchParams
  ): GraphFilters | ExtendedGraphFilters {
    const urlFilters = this.isExtendedFilters(currentFilters)
      ? searchParamsToExtendedFilters(params)
      : searchParamsToFilters(params);

    return {
      ...currentFilters,
      ...urlFilters,
    };
  }

  // ==========================================================================
  // Filter Analysis
  // ==========================================================================

  /**
   * Get filter summary
   *
   * @param filters - Filters to analyze
   * @returns Filter summary
   */
  getFilterSummary(filters: GraphFilters | ExtendedGraphFilters): FilterSummary {
    const extendedFilters = this.toExtendedFilters(filters);

    const nodeTypeFilters = ALL_NODE_TYPES.length - extendedFilters.nodeTypes.length;
    const edgeTypeFilters = ALL_EDGE_TYPES.length - extendedFilters.edgeTypes.length;
    const hasSearch = extendedFilters.search.trim().length > 0;
    const hasConfidenceFilter = extendedFilters.minConfidence > 0;
    const hasDepthFilter = isFinite(extendedFilters.maxDepth);

    let activeFilters = 0;
    if (nodeTypeFilters > 0) activeFilters++;
    if (edgeTypeFilters > 0) activeFilters++;
    if (hasSearch) activeFilters++;
    if (hasConfidenceFilter) activeFilters++;
    if (hasDepthFilter) activeFilters++;
    if (extendedFilters.showConnectedOnly) activeFilters++;

    return {
      activeFilters,
      nodeTypeFilters,
      edgeTypeFilters,
      hasSearch,
      hasConfidenceFilter,
      hasDepthFilter,
      showingConnectedOnly: extendedFilters.showConnectedOnly,
      blastRadiusActive: extendedFilters.showBlastRadius,
    };
  }

  /**
   * Check if any filters are active
   *
   * @param filters - Filters to check
   * @returns True if any filters are active
   */
  hasActiveFilters(filters: GraphFilters | ExtendedGraphFilters): boolean {
    return this.countActiveFilters(filters) > 0;
  }

  /**
   * Compare two filter states for equality
   *
   * @param a - First filter state
   * @param b - Second filter state
   * @returns True if filters are equal
   */
  areFiltersEqual(
    a: GraphFilters | ExtendedGraphFilters,
    b: GraphFilters | ExtendedGraphFilters
  ): boolean {
    // Compare node types
    if (a.nodeTypes.length !== b.nodeTypes.length) return false;
    const aTypes = new Set(a.nodeTypes);
    if (!b.nodeTypes.every((t) => aTypes.has(t))) return false;

    // Compare basic properties
    if (a.search !== b.search) return false;
    if (a.showBlastRadius !== b.showBlastRadius) return false;

    // Compare extended properties if both are extended
    if (this.isExtendedFilters(a) && this.isExtendedFilters(b)) {
      if (a.edgeTypes.length !== b.edgeTypes.length) return false;
      const aEdgeTypes = new Set(a.edgeTypes);
      if (!b.edgeTypes.every((t) => aEdgeTypes.has(t))) return false;

      if (a.minConfidence !== b.minConfidence) return false;
      if (a.maxDepth !== b.maxDepth) return false;
      if (a.showConnectedOnly !== b.showConnectedOnly) return false;
    }

    return true;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get default filters
   *
   * @param extended - Get extended defaults
   * @returns Default filters
   */
  getDefaultFilters(extended?: boolean): GraphFilters | ExtendedGraphFilters {
    const useExtended = extended ?? this.useExtendedFilters;
    return useExtended
      ? { ...defaultExtendedGraphFilters }
      : { ...defaultGraphFilters };
  }

  /**
   * Get all available node types
   */
  getAllNodeTypes(): readonly GraphNodeType[] {
    return ALL_NODE_TYPES;
  }

  /**
   * Get all available edge types
   */
  getAllEdgeTypes(): readonly EdgeType[] {
    return ALL_EDGE_TYPES;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Check if filters are extended type
   */
  private isExtendedFilters(
    filters: GraphFilters | ExtendedGraphFilters
  ): filters is ExtendedGraphFilters {
    return 'edgeTypes' in filters;
  }

  /**
   * Convert to extended filters
   */
  private toExtendedFilters(
    filters: GraphFilters | ExtendedGraphFilters
  ): ExtendedGraphFilters {
    if (this.isExtendedFilters(filters)) {
      return filters;
    }

    return {
      ...filters,
      edgeTypes: [...ALL_EDGE_TYPES],
      minConfidence: 0,
      maxDepth: Infinity,
      showConnectedOnly: false,
    };
  }

  /**
   * Count active filters
   */
  private countActiveFilters(
    filters: GraphFilters | ExtendedGraphFilters
  ): number {
    let count = 0;

    // Node type filter (active if not all types selected)
    if (filters.nodeTypes.length < ALL_NODE_TYPES.length) {
      count++;
    }

    // Search filter
    if (filters.search.trim().length > 0) {
      count++;
    }

    // Extended filters
    if (this.isExtendedFilters(filters)) {
      if (filters.edgeTypes.length < ALL_EDGE_TYPES.length) {
        count++;
      }
      if (filters.minConfidence > 0) {
        count++;
      }
      if (isFinite(filters.maxDepth)) {
        count++;
      }
      if (filters.showConnectedOnly) {
        count++;
      }
    }

    return count;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FilterService instance
 *
 * @param config - Service configuration
 * @returns FilterService instance
 */
export function createFilterService(
  config: FilterServiceConfig = {}
): FilterService {
  return new FilterService(config);
}

export default FilterService;
