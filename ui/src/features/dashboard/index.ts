/**
 * Dashboard Feature
 * Barrel export for dashboard feature module
 * @module features/dashboard
 */

// Types
export type {
  DashboardStats,
  ScanStatus,
  RecentScan,
  HighImpactNode,
  ActivityEventType,
  ActivityEvent,
} from './types';

// API functions
export {
  fetchDashboardStats,
  fetchRecentScans,
  fetchHighImpactNodes,
  fetchActivityEvents,
} from './api';

// Hooks
export {
  useDashboardStats,
  DASHBOARD_STATS_KEY,
  useRecentScans,
  RECENT_SCANS_KEY,
  useHighImpactNodes,
  HIGH_IMPACT_NODES_KEY,
  useActivityEvents,
  ACTIVITY_EVENTS_KEY,
} from './hooks';
