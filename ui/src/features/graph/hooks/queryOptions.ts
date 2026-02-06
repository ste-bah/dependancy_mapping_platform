/**
 * Graph Query Options
 * Reusable query option factories for React Query
 * @module features/graph/hooks/queryOptions
 */

import { queryOptions } from '@tanstack/react-query';
import {
  fetchGraph,
  fetchNodeDetail,
  calculateBlastRadius,
  type FetchGraphOptions,
} from '../api';
import type { GraphData, BlastRadius } from '../types';
import type { NodeDetailResponse } from '../types/api';
import { graphQueryKeys, type GraphQueryFilters } from './queryKeys';
import { CACHE_TIMES } from '../utils/constants';

// ============================================================================
// Graph Data Query Options
// ============================================================================

/**
 * Create query options for fetching graph data
 *
 * @param scanId - The scan identifier
 * @param filters - Optional filter configuration
 * @returns Query options for use with useQuery or prefetchQuery
 *
 * @example
 * ```ts
 * // Use directly with useQuery
 * const { data } = useQuery(graphQueryOptions(scanId, filters));
 *
 * // Use for prefetching
 * queryClient.prefetchQuery(graphQueryOptions(scanId, filters));
 * ```
 */
export function graphQueryOptions(
  scanId: string,
  filters?: GraphQueryFilters
) {
  const fetchOptions: FetchGraphOptions = {};

  if (filters?.nodeTypes) {
    fetchOptions.nodeTypes = filters.nodeTypes;
  }
  if (filters?.search) {
    fetchOptions.search = filters.search;
  }
  if (filters?.maxDepth !== undefined) {
    fetchOptions.maxDepth = filters.maxDepth;
  }

  return queryOptions<GraphData, Error>({
    queryKey: graphQueryKeys.graph(scanId, filters),
    queryFn: () => fetchGraph(scanId, fetchOptions),
    staleTime: CACHE_TIMES.stale,
    gcTime: CACHE_TIMES.gc,
    enabled: Boolean(scanId),
  });
}

/**
 * Create query options for fetching graph with specific node types
 *
 * @param scanId - The scan identifier
 * @param nodeTypes - Node types to filter by
 */
export function graphByTypesQueryOptions(
  scanId: string,
  nodeTypes: GraphQueryFilters['nodeTypes']
) {
  if (!nodeTypes) {
    return graphQueryOptions(scanId);
  }
  const filters: GraphQueryFilters = { nodeTypes };
  return graphQueryOptions(scanId, filters);
}

/**
 * Create query options for searching graph nodes
 *
 * @param scanId - The scan identifier
 * @param search - Search query string
 */
export function graphSearchQueryOptions(
  scanId: string,
  search: string
) {
  return graphQueryOptions(scanId, { search });
}

// ============================================================================
// Node Detail Query Options
// ============================================================================

/**
 * Create query options for fetching node details
 *
 * @param scanId - The scan identifier
 * @param nodeId - The node identifier (null disables the query)
 * @returns Query options for use with useQuery
 *
 * @example
 * ```ts
 * const { data } = useQuery(nodeDetailQueryOptions(scanId, selectedNodeId));
 * ```
 */
export function nodeDetailQueryOptions(
  scanId: string,
  nodeId: string | null
) {
  return queryOptions<NodeDetailResponse, Error>({
    queryKey: graphQueryKeys.nodeDetail(scanId, nodeId ?? ''),
    queryFn: () => {
      if (!nodeId) {
        throw new Error('Node ID is required');
      }
      return fetchNodeDetail(scanId, nodeId);
    },
    staleTime: CACHE_TIMES.nodeDetailStale,
    gcTime: CACHE_TIMES.gc,
    enabled: Boolean(scanId) && Boolean(nodeId),
  });
}

// ============================================================================
// Blast Radius Query Options
// ============================================================================

/**
 * Create query options for calculating blast radius
 *
 * @param scanId - The scan identifier
 * @param nodeId - The node identifier (null disables the query)
 * @param enabled - Additional enabled condition
 * @returns Query options for use with useQuery
 *
 * @example
 * ```ts
 * const { data } = useQuery(blastRadiusQueryOptions(
 *   scanId,
 *   selectedNodeId,
 *   showBlastRadius
 * ));
 * ```
 */
export function blastRadiusQueryOptions(
  scanId: string,
  nodeId: string | null,
  enabled: boolean = true
) {
  return queryOptions<BlastRadius, Error>({
    queryKey: graphQueryKeys.blastRadius(scanId, nodeId ?? ''),
    queryFn: () => {
      if (!nodeId) {
        throw new Error('Node ID is required');
      }
      return calculateBlastRadius(scanId, nodeId);
    },
    staleTime: CACHE_TIMES.blastRadiusStale,
    gcTime: CACHE_TIMES.gc,
    enabled: Boolean(scanId) && Boolean(nodeId) && enabled,
  });
}

// ============================================================================
// Conditional Query Helpers
// ============================================================================

/**
 * Create graph query options that only fetch when filters are stable
 * Useful for debounced search inputs
 *
 * @param scanId - The scan identifier
 * @param filters - Filter configuration
 * @param isStable - Whether filters are stable (not mid-typing)
 */
export function stableGraphQueryOptions(
  scanId: string,
  filters: GraphQueryFilters | undefined,
  isStable: boolean
) {
  const baseOptions = graphQueryOptions(scanId, filters);

  return {
    ...baseOptions,
    enabled: baseOptions.enabled && isStable,
  };
}

/**
 * Create node detail options that prefetch on hover
 * Returns options suitable for queryClient.prefetchQuery
 *
 * @param scanId - The scan identifier
 * @param nodeId - The node identifier
 */
export function prefetchNodeDetailOptions(
  scanId: string,
  nodeId: string
) {
  return {
    queryKey: graphQueryKeys.nodeDetail(scanId, nodeId),
    queryFn: () => fetchNodeDetail(scanId, nodeId),
    staleTime: CACHE_TIMES.nodeDetailStale,
  };
}

// ============================================================================
// Default Options Factory
// ============================================================================

/**
 * Common default options for all graph queries
 */
export const graphQueryDefaults = {
  /** Retry failed requests up to 3 times */
  retry: 3,
  /** Exponential backoff for retries */
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  /** Refetch on window focus for fresh data */
  refetchOnWindowFocus: true,
  /** Don't refetch on mount if data exists */
  refetchOnMount: false,
  /** Keep previous data during refetch */
  placeholderData: (previousData: unknown) => previousData,
} as const;

export default {
  graphQueryOptions,
  nodeDetailQueryOptions,
  blastRadiusQueryOptions,
};
