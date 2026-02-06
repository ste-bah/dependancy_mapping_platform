/**
 * Baseline Comparison Utilities
 * @module e2e/tests/regression/baseline-compare
 *
 * Utilities for comparing test results against established baselines.
 * Supports baseline management, drift detection, and comparison reports.
 *
 * TASK-DETECT: Baseline comparison for regression testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface BaselineEntry<T = unknown> {
  version: string;
  createdAt: string;
  updatedAt: string;
  hash: string;
  generator: string;
  data: T;
}

export interface ComparisonResult {
  testId: string;
  status: 'match' | 'mismatch' | 'missing_baseline' | 'missing_current';
  baseline?: BaselineEntry;
  current?: unknown;
  changes?: FieldChange[];
}

export interface FieldChange {
  field: string;
  baselineValue: unknown;
  currentValue: unknown;
}

export interface RegressionReport {
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  newTests: number;
  missingBaselines: number;
  results: ComparisonResult[];
  performanceMetrics: PerformanceMetric[];
}

export interface PerformanceMetric {
  name: string;
  baselineMs: number;
  currentMs: number;
  percentChange: number;
  status: 'improved' | 'regressed' | 'stable';
  threshold: number;
}

// ============================================================================
// Baseline Manager
// ============================================================================

export class BaselineManager {
  private readonly baselineDir: string;
  private cache: Map<string, BaselineEntry> = new Map();

  constructor(baselineDir?: string) {
    this.baselineDir = baselineDir || path.join(__dirname, '../../../api/tests/regression/baselines');
  }

  /**
   * Load a baseline by name
   */
  async loadBaseline<T>(name: string): Promise<BaselineEntry<T> | null> {
    const cached = this.cache.get(name);
    if (cached) {
      return cached as BaselineEntry<T>;
    }

    const filePath = path.join(this.baselineDir, `${name}.json`);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const baseline = JSON.parse(content) as BaselineEntry<T>;
      this.cache.set(name, baseline);
      return baseline;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save a baseline
   */
  async saveBaseline<T>(name: string, data: T, generator: string = 'manual'): Promise<BaselineEntry<T>> {
    const now = new Date().toISOString();
    const existing = await this.loadBaseline<T>(name);

    const baseline: BaselineEntry<T> = {
      version: '1.0.0',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      hash: hashObject(data),
      generator,
      data,
    };

    const filePath = path.join(this.baselineDir, `${name}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(baseline, null, 2));

    this.cache.set(name, baseline);
    return baseline;
  }

  /**
   * Compare current value against baseline
   */
  async compare<T>(name: string, current: T): Promise<ComparisonResult> {
    const baseline = await this.loadBaseline<T>(name);

    if (!baseline) {
      return {
        testId: name,
        status: 'missing_baseline',
        current,
      };
    }

    const currentHash = hashObject(current);

    if (baseline.hash === currentHash) {
      return {
        testId: name,
        status: 'match',
        baseline,
        current,
      };
    }

    const changes = findChanges('', baseline.data, current);

    return {
      testId: name,
      status: 'mismatch',
      baseline,
      current,
      changes,
    };
  }

  /**
   * Check if baseline exists
   */
  async exists(name: string): Promise<boolean> {
    const filePath = path.join(this.baselineDir, `${name}.json`);
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all available baselines
   */
  async listBaselines(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.baselineDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Hash an object for comparison
 */
export function hashObject(obj: unknown): string {
  const normalized = JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: Record<string, unknown>, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
  return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Find all changes between baseline and current
 */
export function findChanges(
  path: string,
  baseline: unknown,
  current: unknown
): FieldChange[] {
  const changes: FieldChange[] = [];

  // Type mismatch
  if (typeof baseline !== typeof current) {
    changes.push({
      field: path || 'root',
      baselineValue: baseline,
      currentValue: current,
    });
    return changes;
  }

  // Null handling
  if (baseline === null || current === null) {
    if (baseline !== current) {
      changes.push({
        field: path || 'root',
        baselineValue: baseline,
        currentValue: current,
      });
    }
    return changes;
  }

  // Array comparison
  if (Array.isArray(baseline) && Array.isArray(current)) {
    if (baseline.length !== current.length) {
      changes.push({
        field: `${path}.length`,
        baselineValue: baseline.length,
        currentValue: current.length,
      });
    }

    const maxLen = Math.max(baseline.length, current.length);
    for (let i = 0; i < maxLen; i++) {
      const nestedChanges = findChanges(`${path}[${i}]`, baseline[i], current[i]);
      changes.push(...nestedChanges);
    }
    return changes;
  }

  // Object comparison
  if (typeof baseline === 'object') {
    const allKeys = new Set([
      ...Object.keys(baseline as object),
      ...Object.keys(current as object),
    ]);

    for (const key of allKeys) {
      const baselineVal = (baseline as Record<string, unknown>)[key];
      const currentVal = (current as Record<string, unknown>)[key];
      const fieldPath = path ? `${path}.${key}` : key;

      const nestedChanges = findChanges(fieldPath, baselineVal, currentVal);
      changes.push(...nestedChanges);
    }
    return changes;
  }

  // Primitive comparison
  if (baseline !== current) {
    changes.push({
      field: path || 'root',
      baselineValue: baseline,
      currentValue: current,
    });
  }

  return changes;
}

// ============================================================================
// Performance Comparison
// ============================================================================

/**
 * Compare performance metrics against baselines
 */
export function comparePerformance(
  metrics: Array<{ name: string; currentMs: number; baselineMs: number }>,
  thresholdPercent: number = 10
): PerformanceMetric[] {
  return metrics.map(({ name, currentMs, baselineMs }) => {
    const percentChange = baselineMs !== 0
      ? ((currentMs - baselineMs) / baselineMs) * 100
      : 0;

    let status: PerformanceMetric['status'];
    if (percentChange > thresholdPercent) {
      status = 'regressed';
    } else if (percentChange < -thresholdPercent) {
      status = 'improved';
    } else {
      status = 'stable';
    }

    return {
      name,
      baselineMs,
      currentMs,
      percentChange,
      status,
      threshold: thresholdPercent,
    };
  });
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a regression report
 */
export function generateReport(results: ComparisonResult[]): RegressionReport {
  const passed = results.filter((r) => r.status === 'match').length;
  const failed = results.filter((r) => r.status === 'mismatch').length;
  const missingBaselines = results.filter((r) => r.status === 'missing_baseline').length;
  const newTests = results.filter((r) => r.status === 'missing_current').length;

  return {
    timestamp: new Date(),
    totalTests: results.length,
    passed,
    failed,
    newTests,
    missingBaselines,
    results,
    performanceMetrics: [],
  };
}

/**
 * Format report as markdown
 */
export function formatReportAsMarkdown(report: RegressionReport): string {
  const lines: string[] = [
    '# Regression Test Report',
    '',
    `Generated: ${report.timestamp.toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total Tests | ${report.totalTests} |`,
    `| Passed | ${report.passed} |`,
    `| Failed | ${report.failed} |`,
    `| New Tests | ${report.newTests} |`,
    `| Missing Baselines | ${report.missingBaselines} |`,
    '',
  ];

  if (report.failed > 0) {
    lines.push('## Failed Tests', '');

    const failed = report.results.filter((r) => r.status === 'mismatch');
    for (const result of failed) {
      lines.push(`### ${result.testId}`, '');

      if (result.changes && result.changes.length > 0) {
        lines.push('| Field | Baseline | Current |');
        lines.push('|-------|----------|---------|');

        for (const change of result.changes.slice(0, 10)) {
          const baseline = JSON.stringify(change.baselineValue).substring(0, 30);
          const current = JSON.stringify(change.currentValue).substring(0, 30);
          lines.push(`| ${change.field} | ${baseline} | ${current} |`);
        }

        if (result.changes.length > 10) {
          lines.push(`| ... | ${result.changes.length - 10} more changes | ... |`);
        }

        lines.push('');
      }
    }
  }

  if (report.performanceMetrics.length > 0) {
    lines.push('## Performance Metrics', '');
    lines.push('| Metric | Baseline | Current | Change | Status |');
    lines.push('|--------|----------|---------|--------|--------|');

    for (const metric of report.performanceMetrics) {
      const changeStr = `${metric.percentChange >= 0 ? '+' : ''}${metric.percentChange.toFixed(1)}%`;
      lines.push(
        `| ${metric.name} | ${metric.baselineMs}ms | ${metric.currentMs}ms | ${changeStr} | ${metric.status} |`
      );
    }

    lines.push('');
  }

  if (report.missingBaselines > 0) {
    lines.push('## Missing Baselines', '');
    lines.push('The following tests need baseline generation:', '');

    const missing = report.results.filter((r) => r.status === 'missing_baseline');
    for (const result of missing) {
      lines.push(`- ${result.testId}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Export Default Instance
// ============================================================================

export const baselineManager = new BaselineManager();
