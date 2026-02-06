/**
 * GraphEmptyState Component
 * Shown when graph has no nodes
 * @module features/graph/components/GraphEmptyState
 */

import { Link } from 'react-router-dom';
import { Button } from '@/shared';
import { ROUTES } from '@/core';
import { cn } from '@/shared/utils';
import type { GraphEmptyProps } from '../types/components';

// ============================================================================
// Icons
// ============================================================================

function GraphIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
      />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Empty state displayed when graph has no nodes
 * Provides guidance and action to run a scan
 */
export function GraphEmptyState({
  title = 'No dependencies found',
  message = 'This scan did not detect any dependency relationships. Try running a new scan or check your repository configuration.',
  className,
  actionLabel = 'Run New Scan',
  onAction,
}: GraphEmptyProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center bg-gray-50 p-8',
        className
      )}
      role="status"
      aria-label="Empty graph"
    >
      <div className="flex flex-col items-center justify-center text-center max-w-md">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-6">
          <GraphIcon className="h-10 w-10 text-gray-400" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-gray-500 mb-6">
          {message}
        </p>

        {/* Suggestions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 text-left w-full">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Possible reasons:
          </p>
          <ul className="text-sm text-gray-500 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">1.</span>
              <span>The repository may not contain supported infrastructure files (Terraform, Helm, Kubernetes)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">2.</span>
              <span>The scan may have encountered parsing errors</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">3.</span>
              <span>The analyzed files may not define any dependencies</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {onAction ? (
            <Button
              variant="primary"
              leftIcon={<ScanIcon className="h-4 w-4" />}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          ) : (
            <Button
              variant="primary"
              leftIcon={<ScanIcon className="h-4 w-4" />}
              asChild
            >
              <Link to={ROUTES.SCANS}>{actionLabel}</Link>
            </Button>
          )}
          <Button
            variant="outline"
            asChild
          >
            <Link to={ROUTES.DASHBOARD}>Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GraphEmptyState;
