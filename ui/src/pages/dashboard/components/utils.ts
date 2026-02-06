/**
 * Dashboard Utility Functions
 * Formatting, transformation, and helper functions for dashboard components
 * @module pages/dashboard/components/utils
 */

import type { ActivityEvent, ActivityEventType } from '@/features/dashboard';
import type { ActivityType, ActivityStatus } from './ActivityItem';

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format large numbers with K/M suffixes
 * @example formatNumber(45200) => "45.2K"
 * @example formatNumber(1247000) => "1.2M"
 * @example formatNumber(500) => "500"
 */
export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return value.toString();
}

/**
 * Format relative time from ISO timestamp
 * @example formatRelativeTime(recentDate) => "5 min ago"
 * @example formatRelativeTime(hourAgo) => "1 hour ago"
 * @example formatRelativeTime(yesterday) => "Yesterday"
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// ============================================================================
// Activity Event Transformation Functions
// ============================================================================

/**
 * Map ActivityEventType from API to ActivityType for UI components
 * @param type - The API event type
 * @returns The UI activity type
 */
export function mapEventTypeToActivityType(type: ActivityEventType): ActivityType {
  switch (type) {
    case 'scan_completed':
    case 'scan_started':
    case 'scan_failed':
      return 'scan';
    case 'repository_added':
      return 'repository';
    case 'dependency_changed':
      return 'dependency';
    default:
      return 'scan';
  }
}

/**
 * Map ActivityEventType to ActivityStatus for UI status badges
 * @param type - The API event type
 * @returns The UI status or undefined if no status applies
 */
export function mapEventTypeToStatus(type: ActivityEventType): ActivityStatus | undefined {
  switch (type) {
    case 'scan_completed':
      return 'success';
    case 'scan_started':
      return 'pending';
    case 'scan_failed':
      return 'error';
    default:
      return undefined;
  }
}

/**
 * Props for the ActivityItem component
 * Duplicated here to avoid circular imports when used in transformActivityEvent
 */
export interface TransformedActivityItem {
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

/**
 * Transform an ActivityEvent from the API to props for ActivityItem component
 * @param event - The raw activity event from API
 * @returns Transformed props ready for ActivityItem component
 */
export function transformActivityEvent(event: ActivityEvent): TransformedActivityItem {
  const status = mapEventTypeToStatus(event.type);
  const result: TransformedActivityItem = {
    type: mapEventTypeToActivityType(event.type),
    title: event.message,
    description: (event.metadata?.description as string) || '',
    timestamp: formatRelativeTime(event.timestamp),
  };
  // Only add status if defined (exactOptionalPropertyTypes)
  if (status !== undefined) {
    result.status = status;
  }
  return result;
}
