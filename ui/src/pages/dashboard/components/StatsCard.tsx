/**
 * StatsCard Component
 * Displays a statistic with icon, value, and optional trend indicator
 * @module pages/dashboard/components/StatsCard
 */

import { type ReactNode, memo } from 'react';
import { Card, Skeleton } from '@/shared';

export interface StatsCardProps {
  /** Display title for the stat */
  title: string;
  /** The stat value to display */
  value: string | number;
  /** Icon element to show */
  icon: ReactNode;
  /** Optional trend indicator */
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /** Show loading skeleton */
  loading?: boolean;
  /** Color theme for the icon background */
  color?: 'primary' | 'success' | 'warning' | 'error';
}

const colorStyles = {
  primary: 'bg-primary-100 text-primary-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
} as const;

/**
 * StatsCard displays a metric with icon and optional trend
 */
export const StatsCard = memo(function StatsCard({
  title,
  value,
  icon,
  trend,
  loading = false,
  color = 'primary',
}: StatsCardProps): JSX.Element {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <Skeleton width={80} height={36} />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          )}
          {trend && !loading && (
            <div className="flex items-center gap-1">
              <span
                className={trend.isPositive ? 'text-green-600' : 'text-red-600'}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-sm text-gray-500">from last week</span>
            </div>
          )}
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorStyles[color]}`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
});
