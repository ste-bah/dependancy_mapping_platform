/**
 * Graph Data Service
 * Orchestrates data fetching, transformation, and caching for graph visualization
 * @module features/graph/services/graphDataService
 */

import { QueryClient } from '@tanstack/react-query';
import {
  fetchGraph,
  fetchNodeDetail,
  graphKeys,
  type FetchGraphOptions,
  type NodeDetailResponse,
} from '../api';
import type {
  GraphData,
  GraphNode,
  FlowNode,
  FlowEdge,
  GraphFilters,
  ExtendedGraphFilters,
} from '../types';
import {
  transformGraphData,
  calculateLayout,
  createNodeMap,
  type LayoutOptions,
  type LayoutResult,
} from '../utils';
import { CACHE_TIMES } from '../utils/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Node detail with additional computed properties
 */
export interface NodeDetail extends NodeDetailResponse {
  /** Incoming edge count */
  incomingEdgeCount: number;
  /** Outgoing edge count */
  outgoingEdgeCount: number;
  /** Is root node (no dependencies) */
  isRoot: boolean;
  /** Is leaf node (no dependents) */
  isLeaf: boolean;
}

/**
 * Graph data result with transformed nodes and edges
 */
export interface GraphDataResult {
  /** Original graph data from API */
  raw: GraphData;
  /** Transformed Flow nodes (unpositioned) */
  nodes: FlowNode[];
  /** Transformed Flow edges */
  edges: FlowEdge[];
  /** Node lookup map */
  nodeMap: Map<string, FlowNode>;
}

/**
 * Layouted graph result
 */
export interface LayoutedGraphResult extends GraphDataResult {
  /** Layout result with positioned nodes */
  layout: LayoutResult;
}

/**
 * Graph data service configuration
 */
export interface GraphDataServiceConfig {
  /** React Query client for cache operations */
  queryClient?: QueryClient;
  /** Default layout options */
  defaultLayoutOptions?: Partial<LayoutOptions>;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Service for orchestrating graph data operations
 *
 * @example
 * ```ts
 * const service = new GraphDataService({ queryClient });
 *
 * // Fetch and transform graph data
 * const result = await service.getGraph('scan-123');
 *
 * // Get node details
 * const detail = await service.getNodeDetail('scan-123', 'node-456');
 *
 * // Invalidate cache
 * service.invalidateCache('scan-123');
 * ```
 */
export class GraphDataService {
  private queryClient: QueryClient | undefined;
  private defaultLayoutOptions: Partial<LayoutOptions>;

  constructor(config: GraphDataServiceConfig = {}) {
    this.queryClient = config.queryClient;
    this.defaultLayoutOptions = config.defaultLayoutOptions ?? {};
  }

  // ==========================================================================
  // Graph Data Operations
  // ==========================================================================

  /**
   * Fetch graph data for a scan and transform to Flow format
   *
   * @param scanId - Scan ID to fetch graph for
   * @param options - Optional fetch parameters
   * @returns Transformed graph data result
   */
  async getGraph(
    scanId: string,
    options: FetchGraphOptions = {}
  ): Promise<GraphDataResult> {
    // Fetch raw graph data
    const rawData = await fetchGraph(scanId, options);

    // Transform to Flow format
    const { nodes, edges } = transformGraphData(rawData);

    // Create lookup map
    const nodeMap = createNodeMap(nodes);

    return {
      raw: rawData,
      nodes,
      edges,
      nodeMap,
    };
  }

  /**
   * Fetch graph data and apply layout
   *
   * @param scanId - Scan ID to fetch graph for
   * @param options - Optional fetch parameters
   * @param layoutOptions - Layout configuration
   * @returns Layouted graph result
   */
  async getGraphWithLayout(
    scanId: string,
    options: FetchGraphOptions = {},
    layoutOptions?: Partial<LayoutOptions>
  ): Promise<LayoutedGraphResult> {
    const result = await this.getGraph(scanId, options);

    // Apply layout
    const mergedLayoutOptions = {
      ...this.defaultLayoutOptions,
      ...layoutOptions,
    };

    const layout = calculateLayout(
      result.raw.nodes,
      result.raw.edges,
      mergedLayoutOptions
    );

    return {
      ...result,
      nodes: layout.nodes,
      layout,
    };
  }

  /**
   * Fetch filtered graph data
   *
   * @param scanId - Scan ID
   * @param filters - Filter configuration
   * @returns Filtered and transformed graph data
   */
  async getFilteredGraph(
    scanId: string,
    filters: GraphFilters | ExtendedGraphFilters
  ): Promise<GraphDataResult> {
    const options: FetchGraphOptions = {
      nodeTypes: filters.nodeTypes,
      search: filters.search || undefined,
    };

    // Add extended filter options if present
    if ('maxDepth' in filters && isFinite(filters.maxDepth)) {
      options.maxDepth = filters.maxDepth;
    }

    return this.getGraph(scanId, options);
  }

  // ==========================================================================
  // Node Detail Operations
  // ==========================================================================

  /**
   * Fetch detailed information for a specific node
   *
   * @param scanId - Scan ID
   * @param nodeId - Node ID to fetch details for
   * @returns Enhanced node detail with computed properties
   */
  async getNodeDetail(scanId: string, nodeId: string): Promise<NodeDetail> {
    const response = await fetchNodeDetail(scanId, nodeId);

    // Compute additional properties
    const incomingEdgeCount = response.dependents.length;
    const outgoingEdgeCount = response.dependencies.length;
    const isRoot = response.dependencies.length === 0;
    const isLeaf = response.dependents.length === 0;

    return {
      ...response,
      incomingEdgeCount,
      outgoingEdgeCount,
      isRoot,
      isLeaf,
    };
  }

  /**
   * Fetch details for multiple nodes
   *
   * @param scanId - Scan ID
   * @param nodeIds - Array of node IDs
   * @returns Map of node ID to node detail
   */
  async getNodeDetails(
    scanId: string,
    nodeIds: string[]
  ): Promise<Map<string, NodeDetail>> {
    const results = await Promise.all(
      nodeIds.map(async (nodeId) => {
        try {
          const detail = await this.getNodeDetail(scanId, nodeId);
          return { nodeId, detail, error: null };
        } catch (error) {
          return { nodeId, detail: null, error };
        }
      })
    );

    const detailMap = new Map<string, NodeDetail>();
    for (const result of results) {
      if (result.detail) {
        detailMap.set(result.nodeId, result.detail);
      }
    }

    return detailMap;
  }

  // ==========================================================================
  // Cache Operations
  // ==========================================================================

  /**
   * Refresh graph data (force refetch)
   *
   * @param scanId - Scan ID to refresh
   */
  async refreshGraph(scanId: string): Promise<void> {
    if (!this.queryClient) {
      return;
    }

    // Invalidate and refetch
    await this.queryClient.invalidateQueries({
      queryKey: graphKeys.graph(scanId),
    });
  }

  /**
   * Invalidate all cached data for a scan
   *
   * @param scanId - Scan ID to invalidate cache for
   */
  invalidateCache(scanId: string): void {
    if (!this.queryClient) {
      return;
    }

    // Invalidate graph data
    this.queryClient.invalidateQueries({
      queryKey: graphKeys.graph(scanId),
    });

    // Invalidate all node details for this scan
    this.queryClient.invalidateQueries({
      queryKey: ['graph', 'node-detail', scanId],
    });

    // Invalidate blast radius data
    this.queryClient.invalidateQueries({
      queryKey: ['graph', 'blast-radius', scanId],
    });
  }

  /**
   * Prefetch graph data for faster loading
   *
   * @param scanId - Scan ID to prefetch
   * @param options - Fetch options
   */
  async prefetchGraph(
    scanId: string,
    options: FetchGraphOptions = {}
  ): Promise<void> {
    if (!this.queryClient) {
      return;
    }

    await this.queryClient.prefetchQuery({
      queryKey: graphKeys.graph(scanId, options),
      queryFn: () => fetchGraph(scanId, options),
      staleTime: CACHE_TIMES.stale,
    });
  }

  /**
   * Prefetch node detail for faster loading
   *
   * @param scanId - Scan ID
   * @param nodeId - Node ID to prefetch
   */
  async prefetchNodeDetail(scanId: string, nodeId: string): Promise<void> {
    if (!this.queryClient) {
      return;
    }

    await this.queryClient.prefetchQuery({
      queryKey: graphKeys.nodeDetail(scanId, nodeId),
      queryFn: () => fetchNodeDetail(scanId, nodeId),
      staleTime: CACHE_TIMES.nodeDetailStale,
    });
  }

  /**
   * Get cached graph data if available
   *
   * @param scanId - Scan ID
   * @param options - Fetch options
   * @returns Cached data or undefined
   */
  getCachedGraph(
    scanId: string,
    options?: FetchGraphOptions
  ): GraphData | undefined {
    if (!this.queryClient) {
      return undefined;
    }

    return this.queryClient.getQueryData<GraphData>(
      graphKeys.graph(scanId, options)
    );
  }

  /**
   * Set graph data in cache (useful for optimistic updates)
   *
   * @param scanId - Scan ID
   * @param data - Graph data to cache
   * @param options - Fetch options
   */
  setCachedGraph(
    scanId: string,
    data: GraphData,
    options?: FetchGraphOptions
  ): void {
    if (!this.queryClient) {
      return;
    }

    this.queryClient.setQueryData(graphKeys.graph(scanId, options), data);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Find a node by ID in cached data
   *
   * @param scanId - Scan ID
   * @param nodeId - Node ID to find
   * @returns GraphNode or undefined
   */
  findNodeInCache(scanId: string, nodeId: string): GraphNode | undefined {
    const cachedData = this.getCachedGraph(scanId);
    if (!cachedData) {
      return undefined;
    }

    return cachedData.nodes.find((node) => node.id === nodeId);
  }

  /**
   * Get graph statistics from cached data
   *
   * @param scanId - Scan ID
   * @returns Statistics or undefined if not cached
   */
  getGraphStats(
    scanId: string
  ): { nodeCount: number; edgeCount: number } | undefined {
    const cachedData = this.getCachedGraph(scanId);
    if (!cachedData) {
      return undefined;
    }

    return {
      nodeCount: cachedData.nodes.length,
      edgeCount: cachedData.edges.length,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new GraphDataService instance
 *
 * @param config - Service configuration
 * @returns GraphDataService instance
 */
export function createGraphDataService(
  config: GraphDataServiceConfig = {}
): GraphDataService {
  return new GraphDataService(config);
}

export default GraphDataService;
