/**
 * Recent Scans Hook
 * React Query hook for fetching recent scans
 * @module features/dashboard/hooks/useRecentScans
 */

import { useQuery } from '@tanstack/react-query';
import { fetchRecentScans } from '../api';
import type { RecentScan } from '../types';

/**
 * Query key for recent scans
 */
export const RECENT_SCANS_KEY = ['scans', 'recent'] as const;

/**
 * Hook to fetch and cache recent scans
 * @param limit - Maximum number of scans to fetch (default: 10)
 */
export function useRecentScans(limit = 10) {
  return useQuery<RecentScan[]>({
    queryKey: [...RECENT_SCANS_KEY, limit],
    queryFn: () => fetchRecentScans(limit),
    staleTime: 60_000, // 1 minute - scans update moderately often
  });
}
