/**
 * Activity Events Hook
 * React Query hook for fetching activity events
 * @module features/dashboard/hooks/useActivityEvents
 */

import { useQuery } from '@tanstack/react-query';
import { fetchActivityEvents } from '../api';
import type { ActivityEvent } from '../types';

/**
 * Query key for activity events
 */
export const ACTIVITY_EVENTS_KEY = ['activity'] as const;

/**
 * Hook to fetch and cache activity events
 * Auto-refreshes every minute to show recent activity
 * @param limit - Maximum number of events to fetch (default: 20)
 */
export function useActivityEvents(limit = 20) {
  return useQuery<ActivityEvent[]>({
    queryKey: [...ACTIVITY_EVENTS_KEY, limit],
    queryFn: () => fetchActivityEvents(limit),
    staleTime: 30_000,        // 30 seconds
    refetchInterval: 60_000,  // Refresh every minute
  });
}
