/**
 * Scan Comparison Panel Component
 * Sidebar panel for comparing two scans with diff metrics
 * @module features/scan-history/components/ScanComparisonPanel
 */

import { memo, useMemo } from 'react';
import { Button, Badge, Spinner } from '@/shared';
import { cn } from '@/shared/utils';
import type { ScanComparisonPanelProps, MetricDiffDisplayProps } from '../types';
import type { Scan, ScanDiff } from '../types';
import { SCAN_STATUS_LABELS, SCAN_STATUS_COLORS } from '../types';

// ============================================================================
// Icons
// ============================================================================

function SwapIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatPercent(value: number): string {
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// ============================================================================
// Scan Card Component
// ============================================================================

interface ScanCardProps {
  scan: Scan | null;
  label: string;
  onClick?: () => void;
  placeholder?: string;
}

function ScanCard({
  scan,
  label,
  onClick,
  placeholder = 'Select a scan',
}: ScanCardProps): JSX.Element {
  if (!scan) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          {label}
        </p>
        <p className="text-sm text-gray-500">{placeholder}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        onClick && 'cursor-pointer hover:bg-gray-50'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </p>
        {onClick && (
          <ExternalLinkIcon className="h-4 w-4 text-gray-400" />
        )}
      </div>

      <p className="text-sm font-medium text-gray-900 mb-1 truncate" title={scan.repositoryName}>
        {scan.repositoryName}
      </p>
      <p className="text-xs text-gray-500 mb-2">{formatDate(scan.startedAt)}</p>

      <div className="flex items-center gap-2">
        <Badge
          size="sm"
          variant={
            scan.status === 'completed'
              ? 'success'
              : scan.status === 'failed'
              ? 'error'
              : 'secondary'
          }
        >
          {SCAN_STATUS_LABELS[scan.status]}
        </Badge>
        <span className="text-xs text-gray-500">
          {scan.metrics.issuesFound} issues
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Metric Diff Display Component
// ============================================================================

function MetricDiffDisplay({
  label,
  before,
  after,
  delta,
  increaseIsGood = false,
  formatValue = (v) => v.toString(),
}: MetricDiffDisplayProps): JSX.Element {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isNeutral = delta === 0;

  // Determine color based on whether increase is good or bad
  const getColor = () => {
    if (isNeutral) return 'text-gray-500';
    if (increaseIsGood) {
      return isPositive ? 'text-green-600' : 'text-red-600';
    }
    return isPositive ? 'text-red-600' : 'text-green-600';
  };

  const getIcon = () => {
    if (isNeutral) return <MinusIcon className="h-4 w-4" />;
    if (isPositive) return <ArrowUpIcon className="h-4 w-4" />;
    return <ArrowDownIcon className="h-4 w-4" />;
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>{formatValue(before)}</span>
          <span>→</span>
          <span>{formatValue(after)}</span>
        </div>
        <div className={cn('flex items-center gap-0.5 text-sm font-medium', getColor())}>
          {getIcon()}
          <span>{Math.abs(delta)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Diff Summary Component
// ============================================================================

interface DiffSummaryProps {
  diff: ScanDiff;
  showDetailedMetrics: boolean;
}

function DiffSummary({ diff, showDetailedMetrics }: DiffSummaryProps): JSX.Element {
  const { metrics, metricsDiff } = diff;

  return (
    <div className="space-y-4">
      {/* File Changes */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          File Changes
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <PlusIcon className="h-4 w-4" />
              <span className="text-xl font-semibold">{metrics.added}</span>
            </div>
            <span className="text-xs text-gray-500">Added</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <MinusIcon className="h-4 w-4" />
              <span className="text-xl font-semibold">{metrics.removed}</span>
            </div>
            <span className="text-xs text-gray-500">Removed</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <SwapIcon className="h-4 w-4" />
              <span className="text-xl font-semibold">{metrics.changed}</span>
            </div>
            <span className="text-xs text-gray-500">Changed</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <MinusIcon className="h-4 w-4" />
              <span className="text-xl font-semibold">{metrics.unchanged}</span>
            </div>
            <span className="text-xs text-gray-500">Unchanged</span>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      {showDetailedMetrics && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Metrics Comparison
          </h4>
          <div className="space-y-1">
            <MetricDiffDisplay
              label="Total Issues"
              before={metricsDiff.issuesFound.before}
              after={metricsDiff.issuesFound.after}
              delta={metricsDiff.issuesFound.delta}
              increaseIsGood={false}
            />
            <MetricDiffDisplay
              label="Critical Issues"
              before={metricsDiff.criticalIssues.before}
              after={metricsDiff.criticalIssues.after}
              delta={metricsDiff.criticalIssues.delta}
              increaseIsGood={false}
            />
            <MetricDiffDisplay
              label="Warnings"
              before={metricsDiff.warningCount.before}
              after={metricsDiff.warningCount.after}
              delta={metricsDiff.warningCount.delta}
              increaseIsGood={false}
            />
          </div>
        </div>
      )}

      {/* Net Change Summary */}
      {showDetailedMetrics && (
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Net Issue Change</span>
            <span
              className={cn(
                'text-lg font-semibold',
                metricsDiff.issuesFound.delta > 0
                  ? 'text-red-600'
                  : metricsDiff.issuesFound.delta < 0
                  ? 'text-green-600'
                  : 'text-gray-500'
              )}
            >
              {metricsDiff.issuesFound.delta > 0 && '+'}
              {metricsDiff.issuesFound.delta}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {metricsDiff.issuesFound.delta > 0
              ? 'More issues found in comparison scan'
              : metricsDiff.issuesFound.delta < 0
              ? 'Fewer issues found in comparison scan'
              : 'No change in issue count'}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Comparison panel for scan diff visualization
 *
 * @example
 * <ScanComparisonPanel
 *   baseline={baselineScan}
 *   comparison={comparisonScan}
 *   diff={diff}
 *   isLoading={isLoading}
 *   onSwap={handleSwap}
 *   onClear={handleClear}
 * />
 */
function ScanComparisonPanelComponent({
  baseline,
  comparison,
  diff,
  isLoading,
  onSwap,
  onClear,
  onBaselineClick,
  onComparisonClick,
  className,
  showDetailedMetrics = false,
}: ScanComparisonPanelProps): JSX.Element {
  const canSwap = baseline !== null && comparison !== null;
  const hasBothScans = baseline !== null && comparison !== null;

  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">Compare Scans</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Clear comparison"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Baseline Scan */}
        <ScanCard
          scan={baseline}
          label="Baseline (older)"
          onClick={onBaselineClick}
          placeholder="Select baseline scan"
        />

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onSwap}
            disabled={!canSwap}
            leftIcon={<SwapIcon className="h-4 w-4" />}
          >
            Swap
          </Button>
        </div>

        {/* Comparison Scan */}
        <ScanCard
          scan={comparison}
          label="Comparison (newer)"
          onClick={onComparisonClick}
          placeholder="Select comparison scan"
        />

        {/* Diff Results */}
        {hasBothScans && (
          <div className="pt-4 border-t">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Spinner size="md" />
                <p className="mt-2 text-sm text-gray-500">Computing diff...</p>
              </div>
            ) : diff ? (
              <DiffSummary diff={diff} showDetailedMetrics={showDetailedMetrics} />
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">
                  Unable to compute diff for these scans
                </p>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        {!hasBothScans && (
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Select two scans from the list to compare them.
              Click the checkbox next to a scan row.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const ScanComparisonPanel = memo(ScanComparisonPanelComponent);

export type { ScanComparisonPanelProps };
