/**
 * Dashboard API Types
 * Type definitions for dashboard-related API responses
 * @module features/dashboard/types
 */

// ============================================================================
// Dashboard Statistics
// ============================================================================

/**
 * Dashboard statistics with optional trend data
 */
export interface DashboardStats {
  repos: number;
  scans: number;
  nodes: number;
  edges: number;
  trends?: {
    repos: number;    // percentage change from previous period
    scans: number;
    nodes: number;
    edges: number;
  };
}

// ============================================================================
// Scan Types
// ============================================================================

/**
 * Possible scan statuses
 */
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Recent scan information
 */
export interface RecentScan {
  id: string;
  repositoryId: string;
  repositoryName: string;
  status: ScanStatus;
  createdAt: string;
  completedAt?: string;
  dependencyCount?: number;
  fileCount?: number;
  errorMessage?: string;
}

// ============================================================================
// Node Types
// ============================================================================

/**
 * High-impact node in the dependency graph
 */
export interface HighImpactNode {
  id: string;
  name: string;
  type: string;
  filePath?: string;
  impactScore: number;
  dependentCount: number;
  repositoryName?: string;
}

// ============================================================================
// Activity Types
// ============================================================================

/**
 * Activity event types
 */
export type ActivityEventType =
  | 'scan_completed'
  | 'scan_started'
  | 'scan_failed'
  | 'repository_added'
  | 'dependency_changed';

/**
 * Activity event from the system
 */
export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
