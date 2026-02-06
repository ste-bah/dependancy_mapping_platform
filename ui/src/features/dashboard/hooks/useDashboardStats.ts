/**
 * Dashboard Stats Hook
 * React Query hook for fetching dashboard statistics
 * @module features/dashboard/hooks/useDashboardStats
 */

import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '../api';
import type { DashboardStats } from '../types';

/**
 * Query key for dashboard stats
 */
export const DASHBOARD_STATS_KEY = ['dashboard', 'stats'] as const;

/**
 * Hook to fetch and cache dashboard statistics
 * Auto-refreshes every 30 seconds to keep data current
 */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: DASHBOARD_STATS_KEY,
    queryFn: fetchDashboardStats,
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
    staleTime: 20_000,       // Consider stale after 20 seconds
  });
}
