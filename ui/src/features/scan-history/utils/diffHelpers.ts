/**
 * Diff Helpers
 * Pure utility functions for comparing scan metrics and formatting deltas
 * @module features/scan-history/utils/diffHelpers
 */

import type { ScanMetrics } from '../types/domain';
import type { DiffMetrics, MetricComparison, ScanMetricsDiff } from '../types/api';

// ============================================================================
// Types
// ============================================================================

/**
 * Trend direction indicator
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Semantic meaning of a trend (for coloring)
 */
export type TrendSemantics = 'positive' | 'negative' | 'neutral';

/**
 * Complete metrics delta with all comparisons
 */
export interface MetricsDelta {
  /** Total files delta */
  totalFiles: MetricComparison;
  /** Analyzed files delta */
  analyzedFiles: MetricComparison;
  /** Issues found delta */
  issuesFound: MetricComparison;
  /** Critical issues delta */
  criticalIssues: MetricComparison;
  /** Warning count delta */
  warningCount: MetricComparison;
}

// ============================================================================
// Metric Comparison
// ============================================================================

/**
 * Creates a metric comparison object from before/after values
 *
 * @param before - Value from baseline scan
 * @param after - Value from comparison scan
 * @returns MetricComparison with calculated delta
 */
function createComparison(before: number, after: number): MetricComparison {
  return {
    before,
    after,
    delta: after - before,
  };
}

/**
 * Calculates the full metrics delta between two scans
 *
 * @param before - Metrics from baseline (older) scan
 * @param after - Metrics from comparison (newer) scan
 * @returns MetricsDelta with all field comparisons
 *
 * @example
 * ```ts
 * const before = { totalFiles: 100, issuesFound: 10, criticalIssues: 2, ... };
 * const after = { totalFiles: 105, issuesFound: 8, criticalIssues: 1, ... };
 * const delta = calculateMetricsDelta(before, after);
 * // delta.issuesFound = { before: 10, after: 8, delta: -2 }
 * // delta.criticalIssues = { before: 2, after: 1, delta: -1 }
 * ```
 */
export function calculateMetricsDelta(
  before: ScanMetrics,
  after: ScanMetrics
): MetricsDelta {
  return {
    totalFiles: createComparison(before.totalFiles, after.totalFiles),
    analyzedFiles: createComparison(before.analyzedFiles, after.analyzedFiles),
    issuesFound: createComparison(before.issuesFound, after.issuesFound),
    criticalIssues: createComparison(before.criticalIssues, after.criticalIssues),
    warningCount: createComparison(before.warningCount, after.warningCount),
  };
}

/**
 * Calculates just the scan metrics diff (for API compatibility)
 *
 * @param before - Metrics from baseline scan
 * @param after - Metrics from comparison scan
 * @returns ScanMetricsDiff with issue-related comparisons
 */
export function calculateScanMetricsDiff(
  before: ScanMetrics,
  after: ScanMetrics
): ScanMetricsDiff {
  return {
    issuesFound: createComparison(before.issuesFound, after.issuesFound),
    criticalIssues: createComparison(before.criticalIssues, after.criticalIssues),
    warningCount: createComparison(before.warningCount, after.warningCount),
  };
}

// ============================================================================
// Delta Formatting
// ============================================================================

/**
 * Formats a numeric delta as a string with sign prefix
 *
 * @param delta - Numeric difference (can be positive, negative, or zero)
 * @returns Formatted string with +/- prefix (e.g., "+5", "-3", "0")
 *
 * @example
 * ```ts
 * formatDelta(5);   // "+5"
 * formatDelta(-3);  // "-3"
 * formatDelta(0);   // "0"
 * formatDelta(1.5); // "+2" (rounds to nearest integer)
 * ```
 */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta);

  if (rounded > 0) {
    return `+${rounded}`;
  }

  if (rounded < 0) {
    return rounded.toString();
  }

  return '0';
}

/**
 * Formats a delta as a percentage change
 *
 * @param before - Original value
 * @param after - New value
 * @returns Formatted percentage string (e.g., "+50%", "-25%")
 *
 * @example
 * ```ts
 * formatDeltaPercent(10, 15); // "+50%"
 * formatDeltaPercent(20, 15); // "-25%"
 * formatDeltaPercent(10, 10); // "0%"
 * formatDeltaPercent(0, 5);   // "+inf%"
 * ```
 */
export function formatDeltaPercent(before: number, after: number): string {
  if (before === 0) {
    if (after === 0) {
      return '0%';
    }
    return after > 0 ? '+inf%' : '-inf%';
  }

  const percentChange = ((after - before) / Math.abs(before)) * 100;
  const rounded = Math.round(percentChange);

  if (rounded > 0) {
    return `+${rounded}%`;
  }

  if (rounded < 0) {
    return `${rounded}%`;
  }

  return '0%';
}

/**
 * Formats a MetricComparison as a display string
 *
 * @param comparison - MetricComparison object
 * @param includePercent - Include percentage change (default: false)
 * @returns Formatted string showing the change
 *
 * @example
 * ```ts
 * formatComparison({ before: 10, after: 15, delta: 5 });
 * // "10 -> 15 (+5)"
 *
 * formatComparison({ before: 10, after: 15, delta: 5 }, true);
 * // "10 -> 15 (+5, +50%)"
 * ```
 */
export function formatComparison(
  comparison: MetricComparison,
  includePercent: boolean = false
): string {
  const deltaStr = formatDelta(comparison.delta);

  if (includePercent) {
    const percentStr = formatDeltaPercent(comparison.before, comparison.after);
    return `${comparison.before} -> ${comparison.after} (${deltaStr}, ${percentStr})`;
  }

  return `${comparison.before} -> ${comparison.after} (${deltaStr})`;
}

// ============================================================================
// Delta Colors
// ============================================================================

/**
 * Color values for delta indicators
 */
export const DELTA_COLORS = {
  /** Green - positive change (reduced issues) */
  positive: '#22c55e',
  /** Red - negative change (increased issues) */
  negative: '#ef4444',
  /** Gray - no change */
  neutral: '#6b7280',
} as const;

/**
 * Gets the color for a delta value based on semantic meaning
 *
 * @param delta - Numeric difference
 * @param invertedSemantics - If true, positive delta is bad (default for issue counts)
 * @returns Hex color code (green/red/gray)
 *
 * @example
 * ```ts
 * // For issues (more is bad)
 * getDeltaColor(5, true);   // "#ef4444" (red - more issues is bad)
 * getDeltaColor(-3, true);  // "#22c55e" (green - fewer issues is good)
 *
 * // For coverage (more is good)
 * getDeltaColor(5, false);  // "#22c55e" (green - more coverage is good)
 * getDeltaColor(-3, false); // "#ef4444" (red - less coverage is bad)
 * ```
 */
export function getDeltaColor(
  delta: number,
  invertedSemantics: boolean = true
): string {
  if (delta === 0) {
    return DELTA_COLORS.neutral;
  }

  const isPositive = delta > 0;

  // With inverted semantics, positive delta (increase) is bad
  if (invertedSemantics) {
    return isPositive ? DELTA_COLORS.negative : DELTA_COLORS.positive;
  }

  // Normal semantics: positive delta is good
  return isPositive ? DELTA_COLORS.positive : DELTA_COLORS.negative;
}

/**
 * Gets the Tailwind CSS color class for a delta value
 *
 * @param delta - Numeric difference
 * @param invertedSemantics - If true, positive delta is bad
 * @returns Tailwind color class (text-green-500, text-red-500, text-gray-500)
 */
export function getDeltaColorClass(
  delta: number,
  invertedSemantics: boolean = true
): string {
  if (delta === 0) {
    return 'text-gray-500';
  }

  const isPositive = delta > 0;

  if (invertedSemantics) {
    return isPositive ? 'text-red-500' : 'text-green-500';
  }

  return isPositive ? 'text-green-500' : 'text-red-500';
}

// ============================================================================
// Trend Indicators
// ============================================================================

/**
 * Gets the trend direction for a delta value
 *
 * @param delta - Numeric difference
 * @returns Trend direction: 'up', 'down', or 'stable'
 *
 * @example
 * ```ts
 * getTrendIndicator(5);   // 'up'
 * getTrendIndicator(-3);  // 'down'
 * getTrendIndicator(0);   // 'stable'
 * ```
 */
export function getTrendIndicator(delta: number): TrendDirection {
  if (delta > 0) {
    return 'up';
  }

  if (delta < 0) {
    return 'down';
  }

  return 'stable';
}

/**
 * Gets the semantic meaning of a trend based on metric type
 *
 * @param direction - Trend direction
 * @param invertedSemantics - If true, 'up' is bad (default for issue counts)
 * @returns Semantic meaning: 'positive', 'negative', or 'neutral'
 */
export function getTrendSemantics(
  direction: TrendDirection,
  invertedSemantics: boolean = true
): TrendSemantics {
  if (direction === 'stable') {
    return 'neutral';
  }

  const isUp = direction === 'up';

  if (invertedSemantics) {
    return isUp ? 'negative' : 'positive';
  }

  return isUp ? 'positive' : 'negative';
}

/**
 * Gets an arrow character for the trend direction
 *
 * @param direction - Trend direction
 * @returns Unicode arrow character
 */
export function getTrendArrow(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return '\u2191'; // Up arrow
    case 'down':
      return '\u2193'; // Down arrow
    case 'stable':
      return '\u2192'; // Right arrow (no change)
    default:
      return '';
  }
}

/**
 * Gets a descriptive label for the trend
 *
 * @param delta - Numeric difference
 * @param metricName - Name of the metric (for context)
 * @returns Human-readable trend description
 *
 * @example
 * ```ts
 * getTrendLabel(5, 'issues');  // "5 more issues"
 * getTrendLabel(-3, 'issues'); // "3 fewer issues"
 * getTrendLabel(0, 'issues');  // "No change in issues"
 * ```
 */
export function getTrendLabel(delta: number, metricName: string): string {
  const absDelta = Math.abs(Math.round(delta));

  if (delta > 0) {
    return `${absDelta} more ${metricName}`;
  }

  if (delta < 0) {
    return `${absDelta} fewer ${metricName}`;
  }

  return `No change in ${metricName}`;
}

// ============================================================================
// Diff Metrics Utilities
// ============================================================================

/**
 * Calculates the total number of changes in a DiffMetrics object
 *
 * @param metrics - DiffMetrics object
 * @returns Total number of added + removed + changed items
 */
export function getTotalChanges(metrics: DiffMetrics): number {
  return metrics.added + metrics.removed + metrics.changed;
}

/**
 * Checks if there are any changes in a DiffMetrics object
 *
 * @param metrics - DiffMetrics object
 * @returns True if there are any changes
 */
export function hasChanges(metrics: DiffMetrics): boolean {
  return getTotalChanges(metrics) > 0;
}

/**
 * Gets a summary label for DiffMetrics
 *
 * @param metrics - DiffMetrics object
 * @returns Summary string (e.g., "5 added, 3 removed, 2 changed")
 */
export function getDiffSummary(metrics: DiffMetrics): string {
  const parts: string[] = [];

  if (metrics.added > 0) {
    parts.push(`${metrics.added} added`);
  }

  if (metrics.removed > 0) {
    parts.push(`${metrics.removed} removed`);
  }

  if (metrics.changed > 0) {
    parts.push(`${metrics.changed} changed`);
  }

  if (parts.length === 0) {
    return 'No changes';
  }

  return parts.join(', ');
}

/**
 * Creates an empty DiffMetrics object
 *
 * @returns DiffMetrics with all zeros
 */
export function createEmptyDiffMetrics(): DiffMetrics {
  return {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
  };
}

// ============================================================================
// Comparison Helpers
// ============================================================================

/**
 * Determines if a metric comparison shows improvement
 *
 * @param comparison - MetricComparison object
 * @param lowerIsBetter - If true, negative delta is improvement (default for issues)
 * @returns True if the metric improved
 */
export function isImprovement(
  comparison: MetricComparison,
  lowerIsBetter: boolean = true
): boolean {
  if (comparison.delta === 0) {
    return false;
  }

  return lowerIsBetter ? comparison.delta < 0 : comparison.delta > 0;
}

/**
 * Determines if a metric comparison shows regression
 *
 * @param comparison - MetricComparison object
 * @param lowerIsBetter - If true, positive delta is regression (default for issues)
 * @returns True if the metric regressed
 */
export function isRegression(
  comparison: MetricComparison,
  lowerIsBetter: boolean = true
): boolean {
  if (comparison.delta === 0) {
    return false;
  }

  return lowerIsBetter ? comparison.delta > 0 : comparison.delta < 0;
}

/**
 * Gets the overall status of a scan metrics diff
 *
 * @param diff - ScanMetricsDiff object
 * @returns Status: 'improved', 'regressed', or 'stable'
 */
export function getOverallDiffStatus(
  diff: ScanMetricsDiff
): 'improved' | 'regressed' | 'stable' {
  // Critical issues take priority
  if (diff.criticalIssues.delta < 0) {
    return 'improved';
  }
  if (diff.criticalIssues.delta > 0) {
    return 'regressed';
  }

  // Then total issues
  if (diff.issuesFound.delta < 0) {
    return 'improved';
  }
  if (diff.issuesFound.delta > 0) {
    return 'regressed';
  }

  // Then warnings
  if (diff.warningCount.delta < 0) {
    return 'improved';
  }
  if (diff.warningCount.delta > 0) {
    return 'regressed';
  }

  return 'stable';
}
