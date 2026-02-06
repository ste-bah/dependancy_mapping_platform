#!/usr/bin/env tsx
/**
 * Quality Check Script
 * @module scripts/quality-check
 *
 * Run code quality analysis from the command line.
 *
 * Usage:
 *   npm run quality:check          # Run all checks
 *   npm run quality:complexity     # Run complexity analysis only
 *   npm run quality:deadcode       # Run dead code detection only
 *   npm run quality:debt           # Show technical debt summary
 *
 * Options:
 *   --json         Output results as JSON
 *   --verbose      Show detailed output
 *   --path <path>  Analyze specific directory (default: src)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  complexity: args.includes('--complexity'),
  deadcode: args.includes('--deadcode'),
  debt: args.includes('--debt'),
  json: args.includes('--json'),
  verbose: args.includes('--verbose'),
  help: args.includes('--help') || args.includes('-h'),
};

// If no specific check is requested, run all
const runAll = !flags.complexity && !flags.deadcode && !flags.debt;

// Get custom path if provided
const pathIndex = args.indexOf('--path');
const targetPath = pathIndex >= 0 && args[pathIndex + 1]
  ? args[pathIndex + 1]
  : 'src';

// Help text
if (flags.help) {
  console.log(`
Quality Check Script - Code Quality Analysis

Usage:
  npx tsx scripts/quality-check.ts [options]

Options:
  --complexity    Run complexity analysis only
  --deadcode      Run dead code detection only
  --debt          Show technical debt summary only
  --json          Output results as JSON
  --verbose       Show detailed output
  --path <path>   Analyze specific directory (default: src)
  --help, -h      Show this help message

Examples:
  npx tsx scripts/quality-check.ts                    # Run all checks
  npx tsx scripts/quality-check.ts --complexity      # Complexity only
  npx tsx scripts/quality-check.ts --json            # JSON output
  npx tsx scripts/quality-check.ts --path src/services  # Specific directory
`);
  process.exit(0);
}

// Main execution
async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('\n========================================');
  console.log('  Code Quality Analysis');
  console.log('========================================\n');

  // Dynamically import quality tools to avoid module resolution issues
  const { ComplexityAnalyzer } = await import('../src/quality/complexity-analyzer.js');
  const { DeadCodeDetector } = await import('../src/quality/dead-code-detector.js');
  const { TechnicalDebtTracker, CATEGORY_INFO } = await import('../src/quality/debt-tracker.js');

  // Find TypeScript files
  const baseDir = path.resolve(process.cwd(), targetPath);
  const files = await glob('**/*.ts', {
    cwd: baseDir,
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
  });

  console.log(`Analyzing ${files.length} files in ${targetPath}/\n`);

  // Read file contents
  const fileContents = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(baseDir, file);
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      return { path: file, content };
    })
  );

  const results: Record<string, unknown> = {};

  // Complexity Analysis
  if (runAll || flags.complexity) {
    console.log('--- Complexity Analysis ---\n');

    const analyzer = new ComplexityAnalyzer();
    const reports = analyzer.analyzeMultiple(fileContents);
    const summary = analyzer.getSummary(reports);

    results.complexity = {
      summary,
      violations: reports.flatMap(r => r.violations),
    };

    if (!flags.json) {
      console.log(`  Total files:      ${summary.totalFiles}`);
      console.log(`  Total functions:  ${summary.totalFunctions}`);
      console.log(`  Avg complexity:   ${summary.averageComplexity.toFixed(1)}`);
      console.log(`  Avg maintainability: ${summary.averageMaintainability.toFixed(1)}`);
      console.log(`  Violations:       ${summary.totalViolations}`);

      if (summary.highComplexityFunctions.length > 0 && flags.verbose) {
        console.log('\n  High complexity functions:');
        for (const fn of summary.highComplexityFunctions.slice(0, 5)) {
          console.log(`    - ${fn.name}: CC=${fn.metrics.cyclomaticComplexity}`);
        }
      }

      const violations = reports.flatMap(r => r.violations);
      if (violations.length > 0) {
        console.log('\n  Top violations:');
        for (const v of violations.slice(0, 5)) {
          console.log(`    [${v.severity.toUpperCase()}] ${v.function}: ${v.type} = ${v.actual} (threshold: ${v.threshold})`);
        }
      }
    }

    console.log('');
  }

  // Dead Code Detection
  if (runAll || flags.deadcode) {
    console.log('--- Dead Code Detection ---\n');

    const detector = new DeadCodeDetector();
    const report = await detector.analyze(fileContents);

    results.deadCode = report;

    if (!flags.json) {
      console.log(`  Unused exports:     ${report.unusedExports.length}`);
      console.log(`  Unreachable code:   ${report.unreachableCode.length}`);
      console.log(`  Redundant patterns: ${report.redundantPatterns.length}`);
      console.log(`  Unused variables:   ${report.unusedVariables.length}`);
      console.log(`  Total issues:       ${report.summary.totalIssues}`);
      console.log(`  Est. debt hours:    ${report.summary.estimatedDebtHours}`);

      if (flags.verbose && report.unusedExports.length > 0) {
        console.log('\n  Potentially unused exports:');
        for (const exp of report.unusedExports.slice(0, 5)) {
          console.log(`    - ${exp.filePath}: ${exp.exportName} (${exp.exportType})`);
        }
      }

      if (flags.verbose && report.redundantPatterns.length > 0) {
        console.log('\n  Redundant patterns:');
        for (const p of report.redundantPatterns.slice(0, 5)) {
          console.log(`    - ${p.filePath}:${p.lineNumber}: ${p.pattern}`);
        }
      }
    }

    console.log('');
  }

  // Technical Debt Summary
  if (runAll || flags.debt) {
    console.log('--- Technical Debt Summary ---\n');

    const tracker = new TechnicalDebtTracker();

    // Import any existing debt file if present
    const debtFile = path.resolve(process.cwd(), 'technical-debt.json');
    if (fs.existsSync(debtFile)) {
      const debtJson = await fs.promises.readFile(debtFile, 'utf-8');
      tracker.importFromJson(debtJson);
    }

    const summary = tracker.getSummary();

    results.debt = summary;

    if (!flags.json) {
      console.log(`  Open items:    ${summary.totalItems}`);
      console.log(`  Total hours:   ${summary.totalHours}`);

      if (summary.trend) {
        console.log(`  Added (30d):   ${summary.trend.addedLast30Days}`);
        console.log(`  Resolved (30d): ${summary.trend.resolvedLast30Days}`);
        console.log(`  Net change:    ${summary.trend.netChange > 0 ? '+' : ''}${summary.trend.netChange}`);
      }

      console.log('\n  By category:');
      for (const [category, info] of Object.entries(CATEGORY_INFO)) {
        const stats = summary.byCategory[category as keyof typeof summary.byCategory];
        if (stats.count > 0) {
          console.log(`    ${info.label}: ${stats.count} items, ${stats.hours}h`);
        }
      }

      console.log('\n  By priority:');
      for (const priority of ['critical', 'high', 'medium', 'low'] as const) {
        const stats = summary.byPriority[priority];
        if (stats.count > 0) {
          console.log(`    ${priority}: ${stats.count} items, ${stats.hours}h`);
        }
      }
    }

    console.log('');
  }

  // Calculate quality score
  const qualityScore = calculateQualityScore(results);
  results.qualityScore = qualityScore;

  // Output results
  if (flags.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('========================================');
    console.log(`  Quality Score: ${qualityScore}/100`);
    console.log(`  Analysis time: ${Date.now() - startTime}ms`);
    console.log('========================================\n');

    // Quality grade
    const grade =
      qualityScore >= 90 ? 'A' :
      qualityScore >= 80 ? 'B' :
      qualityScore >= 70 ? 'C' :
      qualityScore >= 60 ? 'D' : 'F';

    console.log(`  Grade: ${grade}`);

    if (qualityScore < 70) {
      console.log('\n  [!] Quality score is below threshold. Please address violations.');
    }

    console.log('');
  }

  // Exit with error code if quality is too low
  if (qualityScore < 50) {
    process.exit(1);
  }
}

function calculateQualityScore(results: Record<string, unknown>): number {
  let score = 100;

  // Deduct for complexity violations
  const complexityData = results.complexity as { summary: { totalViolations: number; averageMaintainability: number } } | undefined;
  if (complexityData) {
    score -= Math.min(20, complexityData.summary.totalViolations * 2);
    const maintPenalty = Math.max(0, 80 - complexityData.summary.averageMaintainability) * 0.25;
    score -= Math.min(20, maintPenalty);
  }

  // Deduct for dead code
  const deadCodeData = results.deadCode as { summary: { totalIssues: number } } | undefined;
  if (deadCodeData) {
    score -= Math.min(20, deadCodeData.summary.totalIssues * 0.5);
  }

  // Deduct for technical debt
  const debtData = results.debt as { totalItems: number; totalHours: number } | undefined;
  if (debtData) {
    score -= Math.min(20, debtData.totalHours * 0.1);
    score -= Math.min(20, debtData.totalItems * 0.5);
  }

  return Math.max(0, Math.round(score));
}

// Run main
main().catch(err => {
  console.error('Quality check failed:', err);
  process.exit(1);
});
