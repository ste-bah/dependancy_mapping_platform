/**
 * Diff Helpers Tests
 * Tests for scan metrics comparison and formatting utilities
 * @module features/scan-history/__tests__/utils/diffHelpers.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMetricsDelta,
  calculateScanMetricsDiff,
  formatDelta,
  formatDeltaPercent,
  formatComparison,
  getDeltaColor,
  getDeltaColorClass,
  getTrendIndicator,
  getTrendSemantics,
  getTrendArrow,
  getTrendLabel,
  getTotalChanges,
  hasChanges,
  getDiffSummary,
  createEmptyDiffMetrics,
  isImprovement,
  isRegression,
  getOverallDiffStatus,
  DELTA_COLORS,
} from '../../utils/diffHelpers';
import type { ScanMetrics } from '../../types/domain';
import type { DiffMetrics, MetricComparison, ScanMetricsDiff } from '../../types/api';
import { createMockMetrics, createMockDiffMetrics, createMockScanMetricsDiff } from './test-helpers';

describe('Diff Helpers', () => {
  // ==========================================================================
  // Metric Comparison
  // ==========================================================================

  describe('calculateMetricsDelta', () => {
    it('should calculate delta for all metrics', () => {
      const before: ScanMetrics = createMockMetrics({
        totalFiles: 100,
        analyzedFiles: 95,
        issuesFound: 10,
        criticalIssues: 2,
        warningCount: 5,
      });

      const after: ScanMetrics = createMockMetrics({
        totalFiles: 105,
        analyzedFiles: 100,
        issuesFound: 8,
        criticalIssues: 1,
        warningCount: 4,
      });

      const delta = calculateMetricsDelta(before, after);

      expect(delta.totalFiles.before).toBe(100);
      expect(delta.totalFiles.after).toBe(105);
      expect(delta.totalFiles.delta).toBe(5);

      expect(delta.issuesFound.delta).toBe(-2);
      expect(delta.criticalIssues.delta).toBe(-1);
      expect(delta.warningCount.delta).toBe(-1);
    });

    it('should handle identical metrics', () => {
      const metrics = createMockMetrics();
      const delta = calculateMetricsDelta(metrics, metrics);

      expect(delta.totalFiles.delta).toBe(0);
      expect(delta.issuesFound.delta).toBe(0);
      expect(delta.criticalIssues.delta).toBe(0);
    });

    it('should handle large deltas', () => {
      const before = createMockMetrics({ issuesFound: 0 });
      const after = createMockMetrics({ issuesFound: 1000 });

      const delta = calculateMetricsDelta(before, after);
      expect(delta.issuesFound.delta).toBe(1000);
    });

    it('should handle negative deltas (improvements)', () => {
      const before = createMockMetrics({ issuesFound: 100 });
      const after = createMockMetrics({ issuesFound: 0 });

      const delta = calculateMetricsDelta(before, after);
      expect(delta.issuesFound.delta).toBe(-100);
    });
  });

  describe('calculateScanMetricsDiff', () => {
    it('should calculate diff for issue-related metrics only', () => {
      const before = createMockMetrics({
        issuesFound: 10,
        criticalIssues: 2,
        warningCount: 5,
      });

      const after = createMockMetrics({
        issuesFound: 8,
        criticalIssues: 1,
        warningCount: 4,
      });

      const diff = calculateScanMetricsDiff(before, after);

      expect(diff.issuesFound.delta).toBe(-2);
      expect(diff.criticalIssues.delta).toBe(-1);
      expect(diff.warningCount.delta).toBe(-1);
    });
  });

  // ==========================================================================
  // Delta Formatting
  // ==========================================================================

  describe('formatDelta', () => {
    it('should format positive deltas with + prefix', () => {
      expect(formatDelta(5)).toBe('+5');
      expect(formatDelta(100)).toBe('+100');
      expect(formatDelta(1)).toBe('+1');
    });

    it('should format negative deltas with - prefix', () => {
      expect(formatDelta(-5)).toBe('-5');
      expect(formatDelta(-100)).toBe('-100');
      expect(formatDelta(-1)).toBe('-1');
    });

    it('should format zero as "0"', () => {
      expect(formatDelta(0)).toBe('0');
    });

    it('should round fractional values', () => {
      expect(formatDelta(1.4)).toBe('+1');
      expect(formatDelta(1.6)).toBe('+2');
      expect(formatDelta(-1.4)).toBe('-1');
      expect(formatDelta(-1.6)).toBe('-2');
      expect(formatDelta(0.4)).toBe('0');
    });
  });

  describe('formatDeltaPercent', () => {
    it('should format positive percentage change', () => {
      expect(formatDeltaPercent(10, 15)).toBe('+50%');
      expect(formatDeltaPercent(100, 200)).toBe('+100%');
    });

    it('should format negative percentage change', () => {
      expect(formatDeltaPercent(20, 15)).toBe('-25%');
      expect(formatDeltaPercent(100, 50)).toBe('-50%');
    });

    it('should format zero change', () => {
      expect(formatDeltaPercent(10, 10)).toBe('0%');
    });

    it('should handle zero before value', () => {
      expect(formatDeltaPercent(0, 5)).toBe('+inf%');
      expect(formatDeltaPercent(0, -5)).toBe('-inf%');
      expect(formatDeltaPercent(0, 0)).toBe('0%');
    });

    it('should round percentage values', () => {
      expect(formatDeltaPercent(100, 133)).toBe('+33%');
      expect(formatDeltaPercent(100, 166)).toBe('+66%');
    });
  });

  describe('formatComparison', () => {
    const comparison: MetricComparison = {
      before: 10,
      after: 15,
      delta: 5,
    };

    it('should format comparison without percentage', () => {
      expect(formatComparison(comparison)).toBe('10 -> 15 (+5)');
    });

    it('should format comparison with percentage', () => {
      expect(formatComparison(comparison, true)).toBe('10 -> 15 (+5, +50%)');
    });

    it('should handle zero delta', () => {
      const zeroComp: MetricComparison = { before: 10, after: 10, delta: 0 };
      expect(formatComparison(zeroComp)).toBe('10 -> 10 (0)');
    });

    it('should handle negative delta', () => {
      const negComp: MetricComparison = { before: 10, after: 5, delta: -5 };
      expect(formatComparison(negComp)).toBe('10 -> 5 (-5)');
    });
  });

  // ==========================================================================
  // Delta Colors
  // ==========================================================================

  describe('getDeltaColor', () => {
    it('should return neutral color for zero delta', () => {
      expect(getDeltaColor(0)).toBe(DELTA_COLORS.neutral);
    });

    it('should return negative color for positive delta with inverted semantics', () => {
      // For issues, more is bad
      expect(getDeltaColor(5, true)).toBe(DELTA_COLORS.negative);
    });

    it('should return positive color for negative delta with inverted semantics', () => {
      // For issues, fewer is good
      expect(getDeltaColor(-5, true)).toBe(DELTA_COLORS.positive);
    });

    it('should return positive color for positive delta with normal semantics', () => {
      // For coverage, more is good
      expect(getDeltaColor(5, false)).toBe(DELTA_COLORS.positive);
    });

    it('should return negative color for negative delta with normal semantics', () => {
      // For coverage, less is bad
      expect(getDeltaColor(-5, false)).toBe(DELTA_COLORS.negative);
    });

    it('should default to inverted semantics', () => {
      expect(getDeltaColor(5)).toBe(getDeltaColor(5, true));
    });
  });

  describe('getDeltaColorClass', () => {
    it('should return gray class for zero delta', () => {
      expect(getDeltaColorClass(0)).toBe('text-gray-500');
    });

    it('should return red class for positive delta with inverted semantics', () => {
      expect(getDeltaColorClass(5, true)).toBe('text-red-500');
    });

    it('should return green class for negative delta with inverted semantics', () => {
      expect(getDeltaColorClass(-5, true)).toBe('text-green-500');
    });

    it('should return green class for positive delta with normal semantics', () => {
      expect(getDeltaColorClass(5, false)).toBe('text-green-500');
    });

    it('should return red class for negative delta with normal semantics', () => {
      expect(getDeltaColorClass(-5, false)).toBe('text-red-500');
    });
  });

  // ==========================================================================
  // Trend Indicators
  // ==========================================================================

  describe('getTrendIndicator', () => {
    it('should return "up" for positive delta', () => {
      expect(getTrendIndicator(5)).toBe('up');
      expect(getTrendIndicator(0.1)).toBe('up');
    });

    it('should return "down" for negative delta', () => {
      expect(getTrendIndicator(-5)).toBe('down');
      expect(getTrendIndicator(-0.1)).toBe('down');
    });

    it('should return "stable" for zero delta', () => {
      expect(getTrendIndicator(0)).toBe('stable');
    });
  });

  describe('getTrendSemantics', () => {
    it('should return neutral for stable', () => {
      expect(getTrendSemantics('stable')).toBe('neutral');
    });

    it('should return negative for up with inverted semantics', () => {
      expect(getTrendSemantics('up', true)).toBe('negative');
    });

    it('should return positive for down with inverted semantics', () => {
      expect(getTrendSemantics('down', true)).toBe('positive');
    });

    it('should return positive for up with normal semantics', () => {
      expect(getTrendSemantics('up', false)).toBe('positive');
    });

    it('should return negative for down with normal semantics', () => {
      expect(getTrendSemantics('down', false)).toBe('negative');
    });
  });

  describe('getTrendArrow', () => {
    it('should return up arrow for "up"', () => {
      expect(getTrendArrow('up')).toBe('\u2191');
    });

    it('should return down arrow for "down"', () => {
      expect(getTrendArrow('down')).toBe('\u2193');
    });

    it('should return right arrow for "stable"', () => {
      expect(getTrendArrow('stable')).toBe('\u2192');
    });
  });

  describe('getTrendLabel', () => {
    it('should generate label for positive delta', () => {
      expect(getTrendLabel(5, 'issues')).toBe('5 more issues');
    });

    it('should generate label for negative delta', () => {
      expect(getTrendLabel(-3, 'issues')).toBe('3 fewer issues');
    });

    it('should generate label for zero delta', () => {
      expect(getTrendLabel(0, 'issues')).toBe('No change in issues');
    });

    it('should round fractional values', () => {
      expect(getTrendLabel(2.7, 'files')).toBe('3 more files');
      expect(getTrendLabel(-2.3, 'files')).toBe('2 fewer files');
    });
  });

  // ==========================================================================
  // Diff Metrics Utilities
  // ==========================================================================

  describe('getTotalChanges', () => {
    it('should sum added, removed, and changed', () => {
      const metrics = createMockDiffMetrics({
        added: 3,
        removed: 2,
        changed: 5,
        unchanged: 90,
      });
      expect(getTotalChanges(metrics)).toBe(10);
    });

    it('should return 0 for empty diff', () => {
      const metrics = createEmptyDiffMetrics();
      expect(getTotalChanges(metrics)).toBe(0);
    });
  });

  describe('hasChanges', () => {
    it('should return true when there are changes', () => {
      const metrics = createMockDiffMetrics({ added: 1 });
      expect(hasChanges(metrics)).toBe(true);
    });

    it('should return false when there are no changes', () => {
      const metrics = createEmptyDiffMetrics();
      expect(hasChanges(metrics)).toBe(false);
    });
  });

  describe('getDiffSummary', () => {
    it('should generate summary with all change types', () => {
      const metrics = createMockDiffMetrics({
        added: 3,
        removed: 2,
        changed: 5,
      });
      const summary = getDiffSummary(metrics);
      expect(summary).toBe('3 added, 2 removed, 5 changed');
    });

    it('should omit zero counts', () => {
      const metrics: DiffMetrics = {
        added: 3,
        removed: 0,
        changed: 0,
        unchanged: 97,
      };
      expect(getDiffSummary(metrics)).toBe('3 added');
    });

    it('should return "No changes" for empty diff', () => {
      const metrics = createEmptyDiffMetrics();
      expect(getDiffSummary(metrics)).toBe('No changes');
    });

    it('should handle partial changes', () => {
      const metrics: DiffMetrics = {
        added: 0,
        removed: 5,
        changed: 2,
        unchanged: 93,
      };
      expect(getDiffSummary(metrics)).toBe('5 removed, 2 changed');
    });
  });

  describe('createEmptyDiffMetrics', () => {
    it('should create metrics with all zeros', () => {
      const metrics = createEmptyDiffMetrics();
      expect(metrics.added).toBe(0);
      expect(metrics.removed).toBe(0);
      expect(metrics.changed).toBe(0);
      expect(metrics.unchanged).toBe(0);
    });
  });

  // ==========================================================================
  // Comparison Helpers
  // ==========================================================================

  describe('isImprovement', () => {
    it('should return true for negative delta with lowerIsBetter', () => {
      const comparison: MetricComparison = { before: 10, after: 5, delta: -5 };
      expect(isImprovement(comparison, true)).toBe(true);
    });

    it('should return false for positive delta with lowerIsBetter', () => {
      const comparison: MetricComparison = { before: 5, after: 10, delta: 5 };
      expect(isImprovement(comparison, true)).toBe(false);
    });

    it('should return true for positive delta with higherIsBetter', () => {
      const comparison: MetricComparison = { before: 5, after: 10, delta: 5 };
      expect(isImprovement(comparison, false)).toBe(true);
    });

    it('should return false for zero delta', () => {
      const comparison: MetricComparison = { before: 10, after: 10, delta: 0 };
      expect(isImprovement(comparison)).toBe(false);
    });

    it('should default to lowerIsBetter', () => {
      const comparison: MetricComparison = { before: 10, after: 5, delta: -5 };
      expect(isImprovement(comparison)).toBe(isImprovement(comparison, true));
    });
  });

  describe('isRegression', () => {
    it('should return true for positive delta with lowerIsBetter', () => {
      const comparison: MetricComparison = { before: 5, after: 10, delta: 5 };
      expect(isRegression(comparison, true)).toBe(true);
    });

    it('should return false for negative delta with lowerIsBetter', () => {
      const comparison: MetricComparison = { before: 10, after: 5, delta: -5 };
      expect(isRegression(comparison, true)).toBe(false);
    });

    it('should return true for negative delta with higherIsBetter', () => {
      const comparison: MetricComparison = { before: 10, after: 5, delta: -5 };
      expect(isRegression(comparison, false)).toBe(true);
    });

    it('should return false for zero delta', () => {
      const comparison: MetricComparison = { before: 10, after: 10, delta: 0 };
      expect(isRegression(comparison)).toBe(false);
    });
  });

  describe('getOverallDiffStatus', () => {
    it('should return "improved" when critical issues decreased', () => {
      const diff = createMockScanMetricsDiff({
        criticalIssues: { before: 5, after: 3, delta: -2 },
        issuesFound: { before: 10, after: 12, delta: 2 }, // Worsened but critical takes priority
        warningCount: { before: 5, after: 5, delta: 0 },
      });
      expect(getOverallDiffStatus(diff)).toBe('improved');
    });

    it('should return "regressed" when critical issues increased', () => {
      const diff = createMockScanMetricsDiff({
        criticalIssues: { before: 3, after: 5, delta: 2 },
        issuesFound: { before: 10, after: 8, delta: -2 }, // Improved but critical takes priority
        warningCount: { before: 5, after: 5, delta: 0 },
      });
      expect(getOverallDiffStatus(diff)).toBe('regressed');
    });

    it('should check issues when critical is stable', () => {
      const improvedIssues = createMockScanMetricsDiff({
        criticalIssues: { before: 5, after: 5, delta: 0 },
        issuesFound: { before: 10, after: 8, delta: -2 },
        warningCount: { before: 5, after: 5, delta: 0 },
      });
      expect(getOverallDiffStatus(improvedIssues)).toBe('improved');

      const regressedIssues = createMockScanMetricsDiff({
        criticalIssues: { before: 5, after: 5, delta: 0 },
        issuesFound: { before: 8, after: 10, delta: 2 },
        warningCount: { before: 5, after: 5, delta: 0 },
      });
      expect(getOverallDiffStatus(regressedIssues)).toBe('regressed');
    });

    it('should check warnings when critical and issues are stable', () => {
      const improvedWarnings = createMockScanMetricsDiff({
        criticalIssues: { before: 5, after: 5, delta: 0 },
        issuesFound: { before: 10, after: 10, delta: 0 },
        warningCount: { before: 5, after: 3, delta: -2 },
      });
      expect(getOverallDiffStatus(improvedWarnings)).toBe('improved');

      const regressedWarnings = createMockScanMetricsDiff({
        criticalIssues: { before: 5, after: 5, delta: 0 },
        issuesFound: { before: 10, after: 10, delta: 0 },
        warningCount: { before: 3, after: 5, delta: 2 },
      });
      expect(getOverallDiffStatus(regressedWarnings)).toBe('regressed');
    });

    it('should return "stable" when all metrics unchanged', () => {
      const stableDiff = createMockScanMetricsDiff({
        criticalIssues: { before: 5, after: 5, delta: 0 },
        issuesFound: { before: 10, after: 10, delta: 0 },
        warningCount: { before: 3, after: 3, delta: 0 },
      });
      expect(getOverallDiffStatus(stableDiff)).toBe('stable');
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('DELTA_COLORS', () => {
    it('should have all required colors', () => {
      expect(DELTA_COLORS.positive).toBeDefined();
      expect(DELTA_COLORS.negative).toBeDefined();
      expect(DELTA_COLORS.neutral).toBeDefined();
    });

    it('should have valid hex colors', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      expect(DELTA_COLORS.positive).toMatch(hexColorRegex);
      expect(DELTA_COLORS.negative).toMatch(hexColorRegex);
      expect(DELTA_COLORS.neutral).toMatch(hexColorRegex);
    });
  });
});
