/**
 * Graph Query Hooks
 * React Query hooks for fetching and managing graph data
 * @module features/graph/hooks/queries
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { calculateBlastRadius } from '../api';
import type { GraphData, BlastRadius, GraphFilters } from '../types';
import type { NodeDetailResponse } from '../types/api';
import { graphQueryKeys, toQueryFilters, type GraphQueryFilters } from './queryKeys';
import {
  graphQueryOptions,
  nodeDetailQueryOptions,
  blastRadiusQueryOptions,
} from './queryOptions';
import { CACHE_TIMES } from '../utils/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useGraphQuery hook
 */
export interface UseGraphQueryOptions {
  /** Filter configuration for the query */
  filters?: GraphQueryFilters;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Stale time override */
  staleTime?: number;
  /** Select/transform the data */
  select?: (data: GraphData) => GraphData;
}

/**
 * Options for the useNodeDetailQuery hook
 */
export interface UseNodeDetailQueryOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Stale time override */
  staleTime?: number;
  /** Callback on success */
  onSuccess?: (data: NodeDetailResponse) => void;
}

/**
 * Options for the useBlastRadiusMutation hook
 */
export interface UseBlastRadiusMutationOptions {
  /** Callback on success */
  onSuccess?: (data: BlastRadius, nodeId: string) => void;
  /** Callback on error */
  onError?: (error: Error, nodeId: string) => void;
}

// ============================================================================
// Graph Data Query Hook
// ============================================================================

/**
 * Hook for fetching graph data with React Query
 *
 * Provides automatic caching, background refetching, and error handling.
 *
 * @param scanId - The scan identifier
 * @param options - Query options
 * @returns Query result with graph data
 *
 * @example
 * ```tsx
 * function GraphContainer({ scanId }: { scanId: string }) {
 *   const {
 *     data: graphData,
 *     isLoading,
 *     isError,
 *     error,
 *   } = useGraphQuery(scanId, {
 *     filters: { nodeTypes: ['terraform_resource'] },
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (isError) return <Error message={error.message} />;
 *
 *   return <GraphVisualization data={graphData} />;
 * }
 * ```
 */
export function useGraphQuery(
  scanId: string,
  options: UseGraphQueryOptions = {}
) {
  const {
    filters,
    enabled = true,
    staleTime,
    select,
  } = options;

  const baseOptions = graphQueryOptions(scanId, filters);

  // Build query options
  const resolvedStaleTime = staleTime ?? baseOptions.staleTime ?? CACHE_TIMES.stale;
  const resolvedGcTime = baseOptions.gcTime ?? CACHE_TIMES.gc;

  return useQuery({
    queryKey: baseOptions.queryKey,
    queryFn: baseOptions.queryFn!,
    staleTime: resolvedStaleTime,
    gcTime: resolvedGcTime,
    enabled: Boolean(scanId) && enabled,
    ...(select && { select }),
  });
}

/**
 * Hook for fetching graph with GraphFilters object
 * Automatically extracts query-relevant filters
 *
 * @param scanId - The scan identifier
 * @param filters - Full GraphFilters object
 * @param options - Additional query options
 */
export function useGraphQueryWithFilters(
  scanId: string,
  filters: GraphFilters,
  options: Omit<UseGraphQueryOptions, 'filters'> = {}
) {
  const queryFilters = toQueryFilters(filters);
  return useGraphQuery(scanId, { ...options, filters: queryFilters });
}

// ============================================================================
// Node Detail Query Hook
// ============================================================================

/**
 * Hook for fetching detailed information about a specific node
 *
 * @param scanId - The scan identifier
 * @param nodeId - The node identifier (null disables query)
 * @param options - Query options
 * @returns Query result with node detail
 *
 * @example
 * ```tsx
 * function NodeDetailPanel({ scanId, nodeId }: Props) {
 *   const { data, isLoading } = useNodeDetailQuery(scanId, nodeId);
 *
 *   if (!nodeId) return <SelectNodePrompt />;
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>{data.name}</h2>
 *       <p>Dependencies: {data.dependencies.length}</p>
 *       <p>Dependents: {data.dependents.length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useNodeDetailQuery(
  scanId: string,
  nodeId: string | null,
  options: UseNodeDetailQueryOptions = {}
) {
  const { enabled = true, staleTime } = options;

  return useQuery({
    ...nodeDetailQueryOptions(scanId, nodeId),
    enabled: Boolean(scanId) && Boolean(nodeId) && enabled,
    staleTime: staleTime ?? CACHE_TIMES.nodeDetailStale,
  });
}

// ============================================================================
// Blast Radius Mutation Hook
// ============================================================================

/**
 * Hook for calculating blast radius with mutation pattern
 *
 * Uses mutation for on-demand calculation rather than automatic fetching.
 * This is more appropriate since blast radius is an expensive operation
 * that should only run when explicitly requested.
 *
 * @param scanId - The scan identifier
 * @param options - Mutation options
 * @returns Mutation result with calculate function
 *
 * @example
 * ```tsx
 * function BlastRadiusButton({ scanId, nodeId }: Props) {
 *   const {
 *     mutate: calculateBlast,
 *     data,
 *     isPending,
 *   } = useBlastRadiusMutation(scanId, {
 *     onSuccess: (data) => {
 *       console.log(`Impact score: ${data.impactScore}`);
 *     },
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => calculateBlast(nodeId)}
 *       disabled={isPending}
 *     >
 *       {isPending ? 'Calculating...' : 'Show Blast Radius'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useBlastRadiusMutation(
  scanId: string,
  options: UseBlastRadiusMutationOptions = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  return useMutation({
    mutationFn: (nodeId: string) => calculateBlastRadius(scanId, nodeId),
    onSuccess: (data, nodeId) => {
      // Cache the result for future queries
      queryClient.setQueryData(
        graphQueryKeys.blastRadius(scanId, nodeId),
        data
      );
      onSuccess?.(data, nodeId);
    },
    onError: (error: Error, nodeId: string) => {
      onError?.(error, nodeId);
    },
  });
}

/**
 * Hook for querying blast radius data (read-only)
 * Use this when you want to read cached blast radius data
 * without triggering a new calculation
 *
 * @param scanId - The scan identifier
 * @param nodeId - The node identifier
 * @param enabled - Whether to enable the query
 */
export function useBlastRadiusQuery(
  scanId: string,
  nodeId: string | null,
  enabled: boolean = true
) {
  return useQuery({
    ...blastRadiusQueryOptions(scanId, nodeId, enabled),
  });
}

// ============================================================================
// Cache Invalidation Hooks
// ============================================================================

/**
 * Hook for invalidating graph cache
 *
 * @returns Functions to invalidate different parts of the graph cache
 *
 * @example
 * ```tsx
 * function RefreshButton({ scanId }: Props) {
 *   const { invalidateGraph, invalidateAll } = useInvalidateGraph();
 *
 *   return (
 *     <>
 *       <button onClick={() => invalidateGraph(scanId)}>
 *         Refresh Graph
 *       </button>
 *       <button onClick={invalidateAll}>
 *         Clear All Cache
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useInvalidateGraph() {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: graphQueryKeys.all,
    });
  }, [queryClient]);

  const invalidateScan = useCallback(
    (scanId: string) => {
      return queryClient.invalidateQueries({
        queryKey: graphQueryKeys.scan(scanId),
      });
    },
    [queryClient]
  );

  const invalidateGraph = useCallback(
    (scanId: string, filters?: GraphQueryFilters) => {
      return queryClient.invalidateQueries({
        queryKey: graphQueryKeys.graph(scanId, filters),
      });
    },
    [queryClient]
  );

  const invalidateNodeDetail = useCallback(
    (scanId: string, nodeId: string) => {
      return queryClient.invalidateQueries({
        queryKey: graphQueryKeys.nodeDetail(scanId, nodeId),
      });
    },
    [queryClient]
  );

  const invalidateBlastRadius = useCallback(
    (scanId: string, nodeId: string) => {
      return queryClient.invalidateQueries({
        queryKey: graphQueryKeys.blastRadius(scanId, nodeId),
      });
    },
    [queryClient]
  );

  return {
    invalidateAll,
    invalidateScan,
    invalidateGraph,
    invalidateNodeDetail,
    invalidateBlastRadius,
  };
}

// ============================================================================
// Prefetch Hooks
// ============================================================================

/**
 * Hook for prefetching graph data
 *
 * Useful for preloading data on hover or anticipated navigation.
 *
 * @returns Prefetch functions
 *
 * @example
 * ```tsx
 * function ScanListItem({ scan }: Props) {
 *   const { prefetchGraph } = usePrefetchGraph();
 *
 *   return (
 *     <Link
 *       to={`/scans/${scan.id}/graph`}
 *       onMouseEnter={() => prefetchGraph(scan.id)}
 *     >
 *       {scan.name}
 *     </Link>
 *   );
 * }
 * ```
 */
export function usePrefetchGraph() {
  const queryClient = useQueryClient();

  const prefetchGraph = useCallback(
    async (scanId: string, filters?: GraphQueryFilters) => {
      await queryClient.prefetchQuery(graphQueryOptions(scanId, filters));
    },
    [queryClient]
  );

  const prefetchNodeDetail = useCallback(
    async (scanId: string, nodeId: string) => {
      await queryClient.prefetchQuery(nodeDetailQueryOptions(scanId, nodeId));
    },
    [queryClient]
  );

  return {
    prefetchGraph,
    prefetchNodeDetail,
  };
}

// ============================================================================
// Optimistic Update Helpers
// ============================================================================

/**
 * Hook for optimistic updates on graph data
 *
 * Provides helpers for temporarily updating cached data before
 * server confirmation, with automatic rollback on error.
 *
 * @param scanId - The scan identifier
 */
export function useGraphOptimisticUpdate(scanId: string) {
  const queryClient = useQueryClient();

  /**
   * Optimistically update a node in the cached graph data
   */
  const updateNode = useCallback(
    (
      nodeId: string,
      updates: Partial<{ name: string; metadata: Record<string, unknown> }>,
      filters?: GraphQueryFilters
    ) => {
      const queryKey = graphQueryKeys.graph(scanId, filters);

      // Snapshot current data for rollback
      const previousData = queryClient.getQueryData<GraphData>(queryKey);

      // Optimistically update
      queryClient.setQueryData<GraphData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.map((node) =>
            node.id === nodeId ? { ...node, ...updates } : node
          ),
        };
      });

      // Return rollback function
      return () => {
        if (previousData) {
          queryClient.setQueryData(queryKey, previousData);
        }
      };
    },
    [queryClient, scanId]
  );

  return { updateNode };
}

export default {
  useGraphQuery,
  useGraphQueryWithFilters,
  useNodeDetailQuery,
  useBlastRadiusMutation,
  useBlastRadiusQuery,
  useInvalidateGraph,
  usePrefetchGraph,
  useGraphOptimisticUpdate,
};
