/**
 * Quality Tools - Code Quality Analysis and Technical Debt Management
 * @module quality
 *
 * Provides comprehensive code quality analysis tools for the IaC Dependency
 * Mapping Platform. Includes complexity analysis, dead code detection,
 * technical debt tracking, and custom ESLint rules.
 *
 * Features:
 * - Cyclomatic & cognitive complexity analysis
 * - Halstead metrics and maintainability index
 * - Dead code detection (unused exports, unreachable code)
 * - Redundant pattern detection
 * - Technical debt tracking and prioritization
 * - Custom ESLint rules for project patterns
 *
 * @example
 * ```typescript
 * import {
 *   complexityAnalyzer,
 *   deadCodeDetector,
 *   debtTracker,
 * } from '@/quality';
 *
 * // Analyze complexity
 * const report = complexityAnalyzer.analyze(sourceCode, 'file.ts');
 *
 * // Detect dead code
 * const deadCode = await deadCodeDetector.analyze(files);
 *
 * // Track technical debt
 * debtTracker.addDebt({
 *   category: 'code-smell',
 *   priority: 'medium',
 *   title: 'Complex function needs refactoring',
 *   description: 'Function exceeds cyclomatic complexity threshold',
 *   filePath: 'src/service.ts',
 *   estimatedHours: 2,
 *   tags: ['complexity', 'refactor'],
 * });
 * ```
 */

// ============================================================================
// Complexity Analyzer
// ============================================================================

export {
  ComplexityAnalyzer,
  complexityAnalyzer,
  createComplexityAnalyzer,
  COMPLEXITY_THRESHOLDS,
  type ComplexityMetrics,
  type FileComplexityReport,
  type FunctionComplexity,
  type ComplexityViolation,
} from './complexity-analyzer.js';

// ============================================================================
// Dead Code Detector
// ============================================================================

export {
  DeadCodeDetector,
  deadCodeDetector,
  createDeadCodeDetector,
  type DeadCodeReport,
  type UnusedExport,
  type UnreachableCode,
  type RedundantPattern,
  type UnusedVariable,
  type DeadCodeSummary,
} from './dead-code-detector.js';

// ============================================================================
// Technical Debt Tracker
// ============================================================================

export {
  TechnicalDebtTracker,
  debtTracker,
  createDebtTracker,
  CATEGORY_INFO,
  type TechnicalDebt,
  type CreateDebtInput,
  type DebtCategory,
  type DebtPriority,
  type DebtStatus,
  type DebtSummary,
  type DebtFilter,
  type DebtSort,
} from './debt-tracker.js';

// ============================================================================
// ESLint Rules
// ============================================================================

export {
  noAnyInDomain,
  noAnyInDomainName,
  requireBrandedIds,
  requireBrandedIdsName,
  rules as eslintRules,
  plugin as eslintPlugin,
} from './eslint-rules/index.js';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Quality report combining all analyzers
 */
export interface CombinedQualityReport {
  /** Timestamp of analysis */
  analyzedAt: Date;
  /** Complexity analysis results */
  complexity: {
    reports: import('./complexity-analyzer.js').FileComplexityReport[];
    summary: {
      totalFiles: number;
      totalFunctions: number;
      totalViolations: number;
      averageComplexity: number;
      averageMaintainability: number;
    };
  };
  /** Dead code analysis results */
  deadCode: import('./dead-code-detector.js').DeadCodeReport;
  /** Technical debt summary */
  debt: import('./debt-tracker.js').DebtSummary;
  /** Overall quality score (0-100) */
  qualityScore: number;
  /** Key recommendations */
  recommendations: string[];
}

// ============================================================================
// Combined Analysis Function
// ============================================================================

/**
 * Run a combined quality analysis on a set of files
 */
export async function analyzeQuality(
  files: Array<{ path: string; content: string }>,
  options?: {
    includeDeadCode?: boolean;
    includeComplexity?: boolean;
  }
): Promise<CombinedQualityReport> {
  const { complexityAnalyzer } = await import('./complexity-analyzer.js');
  const { deadCodeDetector } = await import('./dead-code-detector.js');
  const { debtTracker } = await import('./debt-tracker.js');

  const includeDeadCode = options?.includeDeadCode ?? true;
  const includeComplexity = options?.includeComplexity ?? true;

  // Run complexity analysis
  const complexityReports = includeComplexity
    ? complexityAnalyzer.analyzeMultiple(files)
    : [];

  const complexitySummary = includeComplexity
    ? complexityAnalyzer.getSummary(complexityReports)
    : { totalFiles: 0, totalFunctions: 0, totalViolations: 0, averageComplexity: 0, averageMaintainability: 100, highComplexityFunctions: [] };

  // Run dead code analysis
  const deadCodeReport = includeDeadCode
    ? await deadCodeDetector.analyze(files)
    : {
        unusedExports: [],
        unreachableCode: [],
        redundantPatterns: [],
        unusedVariables: [],
        summary: { totalIssues: 0, byCategory: { unusedExports: 0, unreachableCode: 0, redundantPatterns: 0, unusedVariables: 0 }, estimatedDebtHours: 0, topFiles: [] },
        analyzedAt: new Date(),
      };

  // Get debt summary
  const debtSummary = debtTracker.getSummary();

  // Calculate quality score
  const qualityScore = calculateQualityScore(
    complexitySummary,
    deadCodeReport,
    debtSummary
  );

  // Generate recommendations
  const recommendations = generateRecommendations(
    complexitySummary,
    deadCodeReport,
    debtSummary
  );

  return {
    analyzedAt: new Date(),
    complexity: {
      reports: complexityReports,
      summary: complexitySummary,
    },
    deadCode: deadCodeReport,
    debt: debtSummary,
    qualityScore,
    recommendations,
  };
}

/**
 * Calculate overall quality score
 */
function calculateQualityScore(
  complexity: { averageMaintainability: number; totalViolations: number },
  deadCode: { summary: { totalIssues: number } },
  debt: { totalItems: number; totalHours: number }
): number {
  // Start with 100 and deduct for issues
  let score = 100;

  // Deduct for complexity violations (max -20)
  score -= Math.min(20, complexity.totalViolations * 2);

  // Deduct for low maintainability (max -20)
  const maintainabilityPenalty = Math.max(0, 80 - complexity.averageMaintainability) * 0.25;
  score -= Math.min(20, maintainabilityPenalty);

  // Deduct for dead code (max -20)
  score -= Math.min(20, deadCode.summary.totalIssues * 0.5);

  // Deduct for technical debt (max -20)
  const debtPenalty = debt.totalHours * 0.1;
  score -= Math.min(20, debtPenalty);

  // Deduct for open debt items (max -20)
  score -= Math.min(20, debt.totalItems * 0.5);

  return Math.max(0, Math.round(score));
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  complexity: { totalViolations: number; averageComplexity: number; highComplexityFunctions: Array<{ name: string; metrics: { cyclomaticComplexity: number } }> },
  deadCode: { summary: { byCategory: Record<string, number> }; unusedExports: Array<{ exportName: string }> },
  debt: { totalItems: number; byPriority: Record<string, { count: number }> }
): string[] {
  const recommendations: string[] = [];

  // Complexity recommendations
  if (complexity.totalViolations > 0) {
    recommendations.push(
      `Address ${complexity.totalViolations} complexity violations by extracting complex logic into smaller functions.`
    );
  }

  if (complexity.averageComplexity > 8) {
    recommendations.push(
      `Average cyclomatic complexity (${complexity.averageComplexity.toFixed(1)}) is high. Consider simplifying conditional logic.`
    );
  }

  if (complexity.highComplexityFunctions.length > 0) {
    const topComplex = complexity.highComplexityFunctions[0];
    if (topComplex) {
      recommendations.push(
        `Function "${topComplex.name}" has complexity ${topComplex.metrics.cyclomaticComplexity}. Prioritize refactoring.`
      );
    }
  }

  // Dead code recommendations
  if (deadCode.summary.byCategory.unusedExports > 10) {
    recommendations.push(
      `Found ${deadCode.summary.byCategory.unusedExports} unused exports. Review and remove to reduce bundle size.`
    );
  }

  if (deadCode.summary.byCategory.redundantPatterns > 5) {
    recommendations.push(
      `Found ${deadCode.summary.byCategory.redundantPatterns} redundant patterns. Apply modern JavaScript idioms.`
    );
  }

  // Debt recommendations
  if (debt.byPriority.critical?.count > 0) {
    recommendations.push(
      `Address ${debt.byPriority.critical.count} critical debt items immediately.`
    );
  }

  if (debt.totalItems > 20) {
    recommendations.push(
      `Technical debt is accumulating (${debt.totalItems} items). Schedule regular debt reduction sprints.`
    );
  }

  // General recommendations if nothing specific
  if (recommendations.length === 0) {
    recommendations.push('Code quality is within acceptable thresholds. Continue monitoring.');
  }

  return recommendations.slice(0, 5); // Limit to top 5
}

export default {
  complexityAnalyzer: () => import('./complexity-analyzer.js').then(m => m.complexityAnalyzer),
  deadCodeDetector: () => import('./dead-code-detector.js').then(m => m.deadCodeDetector),
  debtTracker: () => import('./debt-tracker.js').then(m => m.debtTracker),
  analyzeQuality,
};
