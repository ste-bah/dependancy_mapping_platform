/**
 * Dashboard Hooks
 * Barrel export for dashboard React Query hooks
 * @module features/dashboard/hooks
 */

export {
  useDashboardStats,
  DASHBOARD_STATS_KEY,
} from './useDashboardStats';

export {
  useRecentScans,
  RECENT_SCANS_KEY,
} from './useRecentScans';

export {
  useHighImpactNodes,
  HIGH_IMPACT_NODES_KEY,
} from './useHighImpactNodes';

export {
  useActivityEvents,
  ACTIVITY_EVENTS_KEY,
} from './useActivityEvents';
