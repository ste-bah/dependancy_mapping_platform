/**
 * Dashboard API Functions
 * API functions for fetching dashboard data
 * @module features/dashboard/api
 */

import { get } from '@/core/api/client';
import type {
  DashboardStats,
  RecentScan,
  HighImpactNode,
  ActivityEvent,
} from './types';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch dashboard statistics
 * @returns Dashboard stats including repos, scans, nodes, edges with trends
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return get<DashboardStats>('/dashboard/stats');
}

/**
 * Fetch recent scans
 * @param limit - Maximum number of scans to return (default: 10)
 * @returns Array of recent scans sorted by creation date
 */
export async function fetchRecentScans(limit = 10): Promise<RecentScan[]> {
  return get<RecentScan[]>('/scans', {
    params: { limit, sort: '-createdAt' },
  });
}

/**
 * Fetch high-impact nodes from the dependency graph
 * @param limit - Maximum number of nodes to return (default: 10)
 * @returns Array of high-impact nodes sorted by impact score
 */
export async function fetchHighImpactNodes(limit = 10): Promise<HighImpactNode[]> {
  return get<HighImpactNode[]>('/nodes/high-impact', {
    params: { limit },
  });
}

/**
 * Fetch activity events
 * @param limit - Maximum number of events to return (default: 20)
 * @returns Array of activity events sorted by timestamp
 */
export async function fetchActivityEvents(limit = 20): Promise<ActivityEvent[]> {
  return get<ActivityEvent[]>('/activity', {
    params: { limit },
  });
}
