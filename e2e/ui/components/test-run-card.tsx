/**
 * Test Run Card Component
 * Display card for individual test run with status, progress, and actions
 * @module e2e/ui/components/test-run-card
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

import { memo, useCallback } from 'react';
import type { TestRunId } from '../../types/test-types';
import type {
  TestRunCardProps,
  TestRunDisplayStatus,
  TestRunProgress,
} from '../types';
import { TEST_STATUS_LABELS, TEST_STATUS_COLORS } from '../types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Class name utility (simplified for E2E UI)
 */
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/**
 * Format date to relative or absolute string
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Calculate progress percentage
 */
function calculateProgress(progress: TestRunProgress): number {
  if (progress.totalCases === 0) return 0;
  return Math.round((progress.completedCases / progress.totalCases) * 100);
}

// ============================================================================
// Icons
// ============================================================================

function CheckCircleIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 019 14.437V9.564z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Status indicator icon
 */
function StatusIcon({ status, className }: { status: TestRunDisplayStatus; className?: string }): JSX.Element {
  switch (status) {
    case 'passed':
      return <CheckCircleIcon className={cn(className, 'text-green-500')} />;
    case 'failed':
    case 'timeout':
      return <XCircleIcon className={cn(className, 'text-red-500')} />;
    case 'running':
      return (
        <div className={cn(className, 'relative')}>
          <div className="absolute inset-0 animate-spin">
            <div className="h-full w-full rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        </div>
      );
    case 'pending':
      return <ClockIcon className={cn(className, 'text-gray-400')} />;
    case 'cancelled':
      return <StopIcon className={cn(className, 'text-gray-500')} />;
    default:
      return <ClockIcon className={cn(className, 'text-gray-400')} />;
  }
}

/**
 * Status badge
 */
function StatusBadge({ status }: { status: TestRunDisplayStatus }): JSX.Element {
  const colorClasses: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-amber-100 text-amber-800',
    default: 'bg-gray-100 text-gray-800',
  };

  const color = TEST_STATUS_COLORS[status];

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
      colorClasses[color]
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        color === 'success' && 'bg-green-500',
        color === 'error' && 'bg-red-500',
        color === 'warning' && 'bg-amber-500',
        color === 'default' && 'bg-gray-500'
      )} />
      {TEST_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Progress bar
 */
function ProgressBar({
  progress,
  status,
}: {
  progress: TestRunProgress;
  status: TestRunDisplayStatus;
}): JSX.Element {
  const percentage = calculateProgress(progress);
  const isComplete = status === 'passed' || status === 'failed' || status === 'cancelled';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">
          {progress.completedCases} / {progress.totalCases} tests
        </span>
        <span className="font-medium text-gray-700">{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            status === 'passed' && 'bg-green-500',
            status === 'failed' && 'bg-red-500',
            status === 'running' && 'bg-blue-500 animate-pulse',
            status === 'pending' && 'bg-gray-400',
            status === 'cancelled' && 'bg-gray-400',
            status === 'timeout' && 'bg-red-400'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!isComplete && progress.currentCase && (
        <p className="text-xs text-gray-500 truncate">
          Running: {progress.currentCase}
        </p>
      )}
    </div>
  );
}

/**
 * Result summary stats
 */
function ResultSummary({
  passed,
  failed,
  skipped,
  compact = false,
}: {
  passed: number;
  failed: number;
  skipped: number;
  compact?: boolean;
}): JSX.Element {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-green-600">{passed} passed</span>
        {failed > 0 && <span className="text-red-600">{failed} failed</span>}
        {skipped > 0 && <span className="text-gray-500">{skipped} skipped</span>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center">
        <div className="text-lg font-semibold text-green-600">{passed}</div>
        <div className="text-xs text-gray-500">Passed</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-red-600">{failed}</div>
        <div className="text-xs text-gray-500">Failed</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-gray-600">{skipped}</div>
        <div className="text-xs text-gray-500">Skipped</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Test Run Card Component
 *
 * Displays a single test run with:
 * - Status indicator and badge
 * - Progress bar for running tests
 * - Result summary (passed/failed/skipped)
 * - Duration and timing information
 * - Action buttons (view details, cancel)
 *
 * @example
 * <TestRunCard
 *   run={testRun}
 *   onSelect={handleSelect}
 *   onViewDetails={handleViewDetails}
 *   onCancel={handleCancel}
 * />
 */
function TestRunCardComponent({
  run,
  isSelected = false,
  isCompact = false,
  onSelect,
  onViewDetails,
  onCancel,
  className,
}: TestRunCardProps): JSX.Element {
  const handleClick = useCallback(() => {
    onSelect?.(run.id);
  }, [onSelect, run.id]);

  const handleViewDetails = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDetails?.(run.id);
  }, [onViewDetails, run.id]);

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.(run.id);
  }, [onCancel, run.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(run.id);
    }
  }, [onSelect, run.id]);

  const isRunning = run.status === 'running' || run.status === 'pending';
  const canCancel = isRunning && onCancel;

  if (isCompact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border bg-white',
          'hover:bg-gray-50 cursor-pointer transition-colors',
          isSelected && 'ring-2 ring-blue-500 bg-blue-50',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-selected={isSelected}
      >
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon status={run.status} className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{run.name}</p>
            <p className="text-xs text-gray-500">
              {formatDate(run.startedAt)} - {formatDuration(run.duration)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ResultSummary
            passed={run.stats.passed}
            failed={run.stats.failed}
            skipped={run.stats.skipped}
            compact
          />
          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-white shadow-sm',
        'hover:shadow-md cursor-pointer transition-all',
        isSelected && 'ring-2 ring-blue-500',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon status={run.status} className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {run.name}
            </h3>
            <p className="text-sm text-gray-500">
              Started {formatDate(run.startedAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={run.status} />
      </div>

      {/* Progress (for running tests) */}
      {isRunning && (
        <div className="mb-3">
          <ProgressBar progress={run.progress} status={run.status} />
        </div>
      )}

      {/* Result Summary */}
      <div className="mb-3 py-3 border-t border-b">
        <ResultSummary
          passed={run.stats.passed}
          failed={run.stats.failed}
          skipped={run.stats.skipped}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span className="font-medium">{formatDuration(run.duration)}</span>
          {run.stats.passRate > 0 && (
            <span className="ml-2">
              ({run.stats.passRate.toFixed(1)}% pass rate)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md',
                'text-red-700 bg-red-50 hover:bg-red-100',
                'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
              )}
            >
              <StopIcon className="h-4 w-4" />
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleViewDetails}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md',
              'text-gray-700 bg-gray-100 hover:bg-gray-200',
              'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
            )}
          >
            View Details
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const TestRunCard = memo(TestRunCardComponent);

export type { TestRunCardProps };
