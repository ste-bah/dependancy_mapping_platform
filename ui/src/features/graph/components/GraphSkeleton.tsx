/**
 * GraphSkeleton Component
 * Skeleton loading state for graph visualization
 * @module features/graph/components/GraphSkeleton
 */

import { Skeleton } from '@/shared';
import { cn } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export interface GraphSkeletonProps {
  /** Additional CSS class names */
  className?: string;
  /** Show filter panel skeleton */
  showFilters?: boolean;
  /** Show search bar skeleton */
  showSearch?: boolean;
  /** Show minimap skeleton */
  showMinimap?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Skeleton loading state that matches the GraphCanvas layout
 * Displays animated placeholders while graph data loads
 */
export function GraphSkeleton({
  className,
  showFilters = true,
  showSearch = true,
  showMinimap = true,
}: GraphSkeletonProps): JSX.Element {
  return (
    <div
      className={cn(
        'relative h-full w-full bg-gray-50 overflow-hidden',
        className
      )}
      role="status"
      aria-label="Loading graph..."
    >
      {/* Background dots pattern simulation */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      {/* Top panel: Filters and Search */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-10">
        {showFilters && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 space-y-3">
            <Skeleton width={120} height={16} />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} width={70} height={28} variant="rounded" />
              ))}
            </div>
          </div>
        )}

        {showSearch && (
          <div className="flex-1 max-w-xs mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
              <Skeleton width="100%" height={32} variant="rounded" />
            </div>
          </div>
        )}

        <div className="w-[120px]" /> {/* Spacer for balance */}
      </div>

      {/* Simulated graph nodes */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[600px] h-[400px]">
          {/* Central node */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <GraphNodeSkeleton size="lg" />
          </div>

          {/* Surrounding nodes */}
          <div className="absolute top-[15%] left-[20%]">
            <GraphNodeSkeleton />
          </div>
          <div className="absolute top-[10%] right-[25%]">
            <GraphNodeSkeleton />
          </div>
          <div className="absolute bottom-[20%] left-[15%]">
            <GraphNodeSkeleton />
          </div>
          <div className="absolute bottom-[15%] right-[20%]">
            <GraphNodeSkeleton />
          </div>
          <div className="absolute top-[40%] left-[5%]">
            <GraphNodeSkeleton size="sm" />
          </div>
          <div className="absolute top-[35%] right-[8%]">
            <GraphNodeSkeleton size="sm" />
          </div>
          <div className="absolute bottom-[40%] left-[35%]">
            <GraphNodeSkeleton size="sm" />
          </div>
          <div className="absolute bottom-[45%] right-[30%]">
            <GraphNodeSkeleton size="sm" />
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2 space-y-1">
          <Skeleton width={32} height={32} variant="rounded" />
          <Skeleton width={32} height={32} variant="rounded" />
          <Skeleton width={32} height={32} variant="rounded" />
          <Skeleton width={32} height={32} variant="rounded" />
        </div>
      </div>

      {/* Minimap */}
      {showMinimap && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
            <Skeleton width={150} height={100} variant="rounded" />
          </div>
        </div>
      )}

      {/* Screen reader text */}
      <span className="sr-only">Loading graph visualization...</span>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface GraphNodeSkeletonProps {
  size?: 'sm' | 'md' | 'lg';
}

function GraphNodeSkeleton({ size = 'md' }: GraphNodeSkeletonProps): JSX.Element {
  const sizeClasses = {
    sm: 'w-24 h-12',
    md: 'w-32 h-16',
    lg: 'w-40 h-20',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm p-2 animate-pulse',
        sizeClasses[size]
      )}
    >
      <div className="flex items-center gap-2 h-full">
        <Skeleton circle width={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} height={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
        <div className="flex-1 space-y-1">
          <Skeleton width="80%" height={size === 'sm' ? 10 : 12} />
          <Skeleton width="50%" height={size === 'sm' ? 8 : 10} />
        </div>
      </div>
    </div>
  );
}

export default GraphSkeleton;
