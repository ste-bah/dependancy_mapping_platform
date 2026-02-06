/**
 * ActivitySkeleton Component
 * Loading skeleton for the activity feed
 * @module pages/dashboard/components/ActivitySkeleton
 */

import { Skeleton } from '@/shared';

/**
 * ActivitySkeleton displays loading placeholders for activity items
 */
export function ActivitySkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-4 py-3">
          <Skeleton circle width={32} height={32} />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={14} />
          </div>
          <Skeleton width={60} height={12} />
        </div>
      ))}
    </div>
  );
}
