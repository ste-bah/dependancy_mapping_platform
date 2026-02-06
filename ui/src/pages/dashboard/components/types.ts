/**
 * Dashboard Component Types
 * Centralized type definitions for dashboard components
 * @module pages/dashboard/components/types
 */

import type { FC, ReactNode } from 'react';
import type { BadgeVariant } from '@/shared';

// ============================================
// Icon Types
// ============================================

/**
 * Common props for all icon components
 */
export interface IconProps {
  /** CSS class name for styling */
  className?: string;
}

/**
 * Type for icon functional components
 */
export type IconComponent = FC<IconProps>;

// ============================================
// StatsCard Types
// ============================================

/**
 * Trend indicator data for stats cards
 */
export interface StatsCardTrend {
  /** Percentage change value */
  value: number;
  /** Whether the trend is positive (up) or negative (down) */
  isPositive: boolean;
}

/**
 * Available color themes for stats cards
 */
export type StatsCardColor = 'primary' | 'success' | 'warning' | 'error';

/**
 * Props for the StatsCard component
 */
export interface StatsCardProps {
  /** Display title for the stat */
  title: string;
  /** The stat value to display */
  value: string | number;
  /** Icon element to show */
  icon: ReactNode;
  /** Optional trend indicator */
  trend?: StatsCardTrend;
  /** Show loading skeleton */
  loading?: boolean;
  /** Color theme for the icon background */
  color?: StatsCardColor;
}

// ============================================
// QuickActionCard Types
// ============================================

/**
 * Props for the QuickActionCard component
 */
export interface QuickActionCardProps {
  /** Action title */
  title: string;
  /** Action description */
  description: string;
  /** Icon element to display */
  icon: ReactNode;
  /** Navigation destination */
  href: string;
}

// ============================================
// ActivityItem Types
// ============================================

/**
 * Types of activity events in the activity feed
 */
export type ActivityType = 'scan' | 'repository' | 'dependency';

/**
 * Status values for activity items
 */
export type ActivityStatus = 'success' | 'pending' | 'error';

/**
 * Props for the ActivityItem component
 */
export interface ActivityItemProps {
  /** Type of activity event */
  type: ActivityType;
  /** Activity title/message */
  title: string;
  /** Activity description */
  description: string;
  /** Formatted timestamp string */
  timestamp: string;
  /** Optional status indicator */
  status?: ActivityStatus;
}

// ============================================
// State Component Types
// ============================================

/**
 * Props for the ErrorState component
 */
export interface ErrorStateProps {
  /** Error message to display */
  message: string;
  /** Optional retry callback */
  onRetry?: () => void;
}

/**
 * Props for the EmptyState component
 */
export interface EmptyStateProps {
  /** Title text for empty state */
  title?: string;
  /** Description text for empty state */
  description?: string;
  /** Label for the action button */
  actionLabel?: string;
  /** Navigation destination for action button */
  actionHref?: string;
}

/**
 * Props for the ActivitySkeleton component
 */
export interface ActivitySkeletonProps {
  /** Number of skeleton items to display */
  count?: number;
}

// ============================================
// Constant Types and Values
// ============================================

/**
 * Color styles mapping for stats card icon backgrounds
 * Maps color variants to Tailwind CSS class strings
 */
export const STATS_COLOR_STYLES = {
  primary: 'bg-primary-100 text-primary-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
} as const satisfies Record<StatsCardColor, string>;

/**
 * Mapping from ActivityStatus to Badge variant
 * Used to determine badge styling based on activity status
 */
export const STATUS_BADGE_VARIANT = {
  success: 'success',
  pending: 'warning',
  error: 'error',
} as const satisfies Record<ActivityStatus, Extract<BadgeVariant, 'success' | 'warning' | 'error'>>;

/**
 * Type helper for extracting the mapped Badge variant from an ActivityStatus
 */
export type ActivityStatusBadgeVariant = typeof STATUS_BADGE_VARIANT[ActivityStatus];

// ============================================
// Activity Icon Map Type
// ============================================

/**
 * Type for the activity icon mapping
 * Maps activity types to their corresponding icon elements
 */
export type ActivityIconMap = Record<ActivityType, ReactNode>;

// ============================================
// Utility Types
// ============================================

/**
 * Extract props type from a component
 */
export type ComponentProps<T> = T extends FC<infer P> ? P : never;

/**
 * Make specific properties of a type required
 */
export type RequireProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type for data loading states
 */
export interface DataLoadingState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Dashboard statistics data structure
 */
export interface DashboardStats {
  repositories: number;
  scans: number;
  avgScore: number;
  dependencies: number;
}

/**
 * Activity data item from API
 */
export interface ActivityData {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  status?: ActivityStatus;
}

/**
 * Dashboard page data structure
 */
export interface DashboardPageData {
  stats: DataLoadingState<DashboardStats>;
  activities: DataLoadingState<ActivityData[]>;
}
