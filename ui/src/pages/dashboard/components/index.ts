/**
 * Dashboard Components Index
 * Barrel export for all dashboard-specific components
 * @module pages/dashboard/components
 */

// Types (centralized type definitions)
export type {
  // Icon types
  IconProps,
  IconComponent,
  // StatsCard types
  StatsCardTrend,
  StatsCardColor,
  StatsCardProps,
  // QuickActionCard types
  QuickActionCardProps,
  // ActivityItem types
  ActivityType,
  ActivityStatus,
  ActivityItemProps,
  // State component types
  ErrorStateProps,
  EmptyStateProps,
  ActivitySkeletonProps,
  // Additional types
  ActivityIconMap,
  ActivityStatusBadgeVariant,
  ComponentProps,
  RequireProps,
  DataLoadingState,
  DashboardStats,
  ActivityData,
  DashboardPageData,
} from './types';

// Constants (from types.ts)
export { STATS_COLOR_STYLES, STATUS_BADGE_VARIANT } from './types';

// Icons
export {
  RepositoryIcon,
  ScanIcon,
  BoltIcon,
  CubeIcon,
  ArrowRightIcon,
  PlusIcon,
  RefreshIcon,
  ExclamationIcon,
} from './icons';

// Utilities
export {
  formatNumber,
  formatRelativeTime,
  mapEventTypeToActivityType,
  mapEventTypeToStatus,
  transformActivityEvent,
  type TransformedActivityItem,
} from './utils';

// Components
export { StatsCard } from './StatsCard';
export { QuickActionCard } from './QuickActionCard';
export { ActivityItem } from './ActivityItem';
export { ActivitySkeleton } from './ActivitySkeleton';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
