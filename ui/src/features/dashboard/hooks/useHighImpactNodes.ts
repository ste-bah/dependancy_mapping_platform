/**
 * High Impact Nodes Hook
 * React Query hook for fetching high-impact nodes
 * @module features/dashboard/hooks/useHighImpactNodes
 */

import { useQuery } from '@tanstack/react-query';
import { fetchHighImpactNodes } from '../api';
import type { HighImpactNode } from '../types';

/**
 * Query key for high-impact nodes
 */
export const HIGH_IMPACT_NODES_KEY = ['nodes', 'high-impact'] as const;

/**
 * Hook to fetch and cache high-impact nodes
 * @param limit - Maximum number of nodes to fetch (default: 10)
 */
export function useHighImpactNodes(limit = 10) {
  return useQuery<HighImpactNode[]>({
    queryKey: [...HIGH_IMPACT_NODES_KEY, limit],
    queryFn: () => fetchHighImpactNodes(limit),
    staleTime: 5 * 60_000, // 5 minutes - changes less frequently
  });
}
