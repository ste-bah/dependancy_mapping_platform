/**
 * ActivityItem Component
 * Displays a single activity event in the activity feed
 * @module pages/dashboard/components/ActivityItem
 */

import { memo } from 'react';
import { Badge } from '@/shared';
import { ScanIcon, RepositoryIcon, CubeIcon } from './icons';

export type ActivityType = 'scan' | 'repository' | 'dependency';
export type ActivityStatus = 'success' | 'pending' | 'error';

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

const iconMap = {
  scan: <ScanIcon className="h-4 w-4" />,
  repository: <RepositoryIcon className="h-4 w-4" />,
  dependency: <CubeIcon className="h-4 w-4" />,
} as const;

const statusVariantMap = {
  success: 'success' as const,
  pending: 'warning' as const,
  error: 'error' as const,
} as const;

/**
 * ActivityItem displays a single activity event with icon, status, and timestamp
 */
export const ActivityItem = memo(function ActivityItem({
  type,
  title,
  description,
  timestamp,
  status,
}: ActivityItemProps): JSX.Element {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
        {iconMap[type]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{title}</p>
          {status && (
            <Badge variant={statusVariantMap[status]} size="sm">
              {status}
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <span className="shrink-0 text-xs text-gray-400">{timestamp}</span>
    </div>
  );
});
