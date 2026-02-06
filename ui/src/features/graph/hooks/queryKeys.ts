/**
 * Graph Query Keys
 * Type-safe query key factory for React Query cache management
 * @module features/graph/hooks/queryKeys
 */

import type { GraphFilters, GraphNodeType } from '../types';

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for all graph-related queries
 *
 * Follows the pattern of hierarchical key arrays for proper
 * cache invalidation granularity:
 * - `all`: Invalidates all graph queries
 * - `scan`: Invalidates all queries for a specific scan
 * - `graph`: Specific graph data query
 * - etc.
 *
 * @example
 * ```ts
 * // Use in useQuery
 * useQuery({
 *   queryKey: graphQueryKeys.graph(scanId, filters),
 *   queryFn: () => fetchGraph(scanId, filters),
 * });
 *
 * // Invalidate all graph data for a scan
 * queryClient.invalidateQueries({
 *   queryKey: graphQueryKeys.scan(scanId),
 * });
 * ```
 */
export const graphQueryKeys = {
  /**
   * Root key for all graph queries
   * Use for invalidating entire graph cache
   */
  all: ['graph'] as const,

  /**
   * All queries for a specific scan
   * @param scanId - The scan identifier
   */
  scan: (scanId: string) =>
    [...graphQueryKeys.all, scanId] as const,

  /**
   * Graph data list queries
   */
  graphs: () =>
    [...graphQueryKeys.all, 'data'] as const,

  /**
   * Specific graph data with filters
   * @param scanId - The scan identifier
   * @param filters - Optional filter configuration
   */
  graph: (scanId: string, filters?: GraphQueryFilters) =>
    [...graphQueryKeys.graphs(), scanId, filters ?? {}] as const,

  /**
   * All node detail queries
   */
  nodeDetails: () =>
    [...graphQueryKeys.all, 'node-detail'] as const,

  /**
   * Specific node detail
   * @param scanId - The scan identifier
   * @param nodeId - The node identifier
   */
  nodeDetail: (scanId: string, nodeId: string) =>
    [...graphQueryKeys.nodeDetails(), scanId, nodeId] as const,

  /**
   * All blast radius queries
   */
  blastRadii: () =>
    [...graphQueryKeys.all, 'blast-radius'] as const,

  /**
   * Specific blast radius calculation
   * @param scanId - The scan identifier
   * @param nodeId - The node identifier
   */
  blastRadius: (scanId: string, nodeId: string) =>
    [...graphQueryKeys.blastRadii(), scanId, nodeId] as const,

  /**
   * All search queries
   */
  searches: () =>
    [...graphQueryKeys.all, 'search'] as const,

  /**
   * Specific search query
   * @param scanId - The scan identifier
   * @param query - The search query string
   */
  search: (scanId: string, query: string) =>
    [...graphQueryKeys.searches(), scanId, query] as const,

  /**
   * Graph statistics queries
   */
  stats: (scanId: string) =>
    [...graphQueryKeys.scan(scanId), 'stats'] as const,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Filter configuration used in query keys
 * Subset of GraphFilters that affects data fetching
 */
export interface GraphQueryFilters {
  /** Node types to include */
  nodeTypes?: GraphNodeType[];
  /** Search query string */
  search?: string;
  /** Maximum traversal depth */
  maxDepth?: number;
}

/**
 * Extract the full filters from GraphFilters for query key usage
 * Excludes UI-only filters like showBlastRadius
 */
export function toQueryFilters(filters: GraphFilters): GraphQueryFilters {
  const result: GraphQueryFilters = {
    nodeTypes: filters.nodeTypes,
  };
  if (filters.search) {
    result.search = filters.search;
  }
  return result;
}

// ============================================================================
// Query Key Type Helpers
// ============================================================================

/**
 * Type for the root query key
 */
export type GraphAllKey = typeof graphQueryKeys.all;

/**
 * Type for scan-scoped query key
 */
export type GraphScanKey = ReturnType<typeof graphQueryKeys.scan>;

/**
 * Type for graph data query key
 */
export type GraphDataKey = ReturnType<typeof graphQueryKeys.graph>;

/**
 * Type for node detail query key
 */
export type NodeDetailKey = ReturnType<typeof graphQueryKeys.nodeDetail>;

/**
 * Type for blast radius query key
 */
export type BlastRadiusKey = ReturnType<typeof graphQueryKeys.blastRadius>;

/**
 * Type for search query key
 */
export type SearchKey = ReturnType<typeof graphQueryKeys.search>;

export default graphQueryKeys;
