#!/usr/bin/env npx tsx
/**
 * IaC Dependency Detection Test Runner
 * @module scripts/run-tests
 *
 * Comprehensive test runner that executes all test suites,
 * generates reports, and provides actionable diagnostics.
 *
 * TASK-DETECT-001 through TASK-DETECT-010 implementation
 * Agent #33 of 47 | Phase 5: Testing
 */

import { execSync, spawn, type SpawnOptions } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, '..');
const REPORTS_DIR = join(API_DIR, 'test-reports');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

interface TestResult {
  suite: string;
  file: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestCaseResult[];
}

interface TestCaseResult {
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: string;
}

interface TestSummary {
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  timestamp: string;
  passRate: number;
  coverageAvailable: boolean;
  coverage?: CoverageReport;
}

interface CoverageReport {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

interface FailureAnalysis {
  testName: string;
  file: string;
  error: string;
  category: string;
  suggestedFix: string;
}

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

function checkDependencies(): boolean {
  log('Checking dependencies...', 'cyan');

  if (!existsSync(join(API_DIR, 'node_modules'))) {
    log('Installing dependencies...', 'yellow');
    try {
      execSync('npm install', { cwd: API_DIR, stdio: 'inherit' });
    } catch (error) {
      log('Failed to install dependencies', 'red');
      return false;
    }
  }

  try {
    execSync('npx vitest --version', { cwd: API_DIR, stdio: 'pipe' });
    log('Vitest is available', 'green');
    return true;
  } catch {
    log('Vitest not found, installing...', 'yellow');
    try {
      execSync('npm install vitest @vitest/coverage-v8 --save-dev', {
        cwd: API_DIR,
        stdio: 'inherit',
      });
      return true;
    } catch {
      log('Failed to install vitest', 'red');
      return false;
    }
  }
}

function runCommand(
  command: string,
  args: string[],
  options?: SpawnOptions
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: API_DIR,
      shell: true,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });
  });
}

async function runAllTests(): Promise<{
  success: boolean;
  jsonOutput: string;
}> {
  logSection('Running All Tests with JSON Reporter');

  const { stdout, exitCode } = await runCommand('npx', [
    'vitest',
    'run',
    '--reporter=json',
    '--outputFile=' + join(REPORTS_DIR, 'test-results.json'),
  ]);

  return {
    success: exitCode === 0,
    jsonOutput: stdout,
  };
}

async function runCoverage(): Promise<CoverageReport | null> {
  logSection('Generating Coverage Report');

  try {
    await runCommand('npx', [
      'vitest',
      'run',
      '--coverage',
      '--coverage.reporter=json',
      '--coverage.reporter=text',
      '--coverage.reportsDirectory=' + join(REPORTS_DIR, 'coverage'),
    ]);

    const coveragePath = join(REPORTS_DIR, 'coverage', 'coverage-summary.json');
    if (existsSync(coveragePath)) {
      const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));
      return {
        lines: coverageData.total?.lines?.pct ?? 0,
        branches: coverageData.total?.branches?.pct ?? 0,
        functions: coverageData.total?.functions?.pct ?? 0,
        statements: coverageData.total?.statements?.pct ?? 0,
      };
    }
  } catch (error) {
    log('Coverage generation failed', 'yellow');
  }

  return null;
}

function parseTestResults(jsonPath: string): TestSummary | null {
  try {
    if (!existsSync(jsonPath)) {
      return null;
    }

    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    return {
      totalSuites: data.numTotalTestSuites ?? 0,
      passedSuites: data.numPassedTestSuites ?? 0,
      failedSuites: data.numFailedTestSuites ?? 0,
      totalTests: data.numTotalTests ?? 0,
      passedTests: data.numPassedTests ?? 0,
      failedTests: data.numFailedTests ?? 0,
      skippedTests: data.numPendingTests ?? 0,
      duration: (Date.now() - data.startTime) / 1000,
      timestamp: new Date().toISOString(),
      passRate:
        data.numTotalTests > 0
          ? (data.numPassedTests / data.numTotalTests) * 100
          : 0,
      coverageAvailable: false,
    };
  } catch {
    return null;
  }
}

function analyzeFailures(jsonPath: string): FailureAnalysis[] {
  const failures: FailureAnalysis[] = [];

  try {
    if (!existsSync(jsonPath)) {
      return failures;
    }

    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    for (const result of data.testResults ?? []) {
      if (result.status === 'failed') {
        if (result.message) {
          failures.push({
            testName: result.name.split('/').pop() ?? 'Unknown',
            file: result.name,
            error: result.message,
            category: categorizeError(result.message),
            suggestedFix: suggestFix(result.message),
          });
        }

        for (const assertion of result.assertionResults ?? []) {
          if (assertion.status === 'failed') {
            failures.push({
              testName: assertion.fullName,
              file: result.name,
              error: assertion.failureMessages?.join('\n') ?? 'Unknown error',
              category: categorizeError(
                assertion.failureMessages?.join('\n') ?? ''
              ),
              suggestedFix: suggestFix(
                assertion.failureMessages?.join('\n') ?? ''
              ),
            });
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return failures;
}

function categorizeError(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return 'timeout';
  }
  if (lowerError.includes('cannot find module') || lowerError.includes('failed to load')) {
    return 'import';
  }
  if (lowerError.includes('multiple exports') || lowerError.includes('duplicate')) {
    return 'export';
  }
  if (lowerError.includes('expect') || lowerError.includes('assertion')) {
    return 'assertion';
  }
  if (lowerError.includes('connection') || lowerError.includes('econnrefused')) {
    return 'connection';
  }

  return 'unknown';
}

function suggestFix(error: string): string {
  const category = categorizeError(error);

  const suggestions: Record<string, string> = {
    timeout: 'Consider increasing test timeout or optimizing async operations',
    import: 'Check import paths and ensure all dependencies are installed',
    export: 'Remove duplicate exports or rename conflicting exports',
    assertion: 'Review expected vs actual values; update test or implementation',
    connection: 'Ensure external services are mocked in test environment',
    unknown: 'Review error message and stack trace for more details',
  };

  return suggestions[category] ?? suggestions.unknown;
}

function generateMarkdownReport(
  summary: TestSummary,
  failures: FailureAnalysis[],
  coverage: CoverageReport | null
): string {
  const statusText = summary.failedTests > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED';

  let md = `# IaC Dependency Detection - Test Execution Report

**Generated:** ${summary.timestamp}
**Status:** ${statusText}

## Summary

| Metric | Value |
|--------|-------|
| Total Test Suites | ${summary.totalSuites} |
| Passed Suites | ${summary.passedSuites} |
| Failed Suites | ${summary.failedSuites} |
| Total Tests | ${summary.totalTests} |
| Passed Tests | ${summary.passedTests} |
| Failed Tests | ${summary.failedTests} |
| Skipped Tests | ${summary.skippedTests} |
| Pass Rate | ${summary.passRate.toFixed(1)}% |
| Duration | ${summary.duration.toFixed(2)}s |

`;

  if (coverage) {
    md += `## Coverage Report

| Metric | Coverage |
|--------|----------|
| Lines | ${coverage.lines.toFixed(1)}% |
| Branches | ${coverage.branches.toFixed(1)}% |
| Functions | ${coverage.functions.toFixed(1)}% |
| Statements | ${coverage.statements.toFixed(1)}% |

`;
  }

  if (failures.length > 0) {
    md += `## Failed Tests

`;
    for (const failure of failures) {
      md += `### ${failure.testName}

- **File:** \`${failure.file}\`
- **Category:** ${failure.category}
- **Suggested Fix:** ${failure.suggestedFix}

\`\`\`
${failure.error.slice(0, 500)}${failure.error.length > 500 ? '...' : ''}
\`\`\`

`;
    }
  }

  md += `
---
*Report generated by IaC Dependency Detection Test Runner*
`;

  return md;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateJUnitReport(jsonPath: string): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="IaC Dependency Detection Tests">
`;

  try {
    if (existsSync(jsonPath)) {
      const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

      for (const result of data.testResults ?? []) {
        const suiteName = result.name.split('/').pop()?.replace('.test.ts', '') ?? 'Unknown';
        const tests = result.assertionResults ?? [];
        const failures = tests.filter((t: any) => t.status === 'failed').length;
        const time = tests.reduce((sum: number, t: any) => sum + (t.duration ?? 0), 0) / 1000;

        xml += `  <testsuite name="${escapeXml(suiteName)}" tests="${tests.length}" failures="${failures}" time="${time.toFixed(3)}">
`;

        for (const test of tests) {
          const testTime = ((test.duration ?? 0) / 1000).toFixed(3);
          xml += `    <testcase name="${escapeXml(test.title)}" classname="${escapeXml(suiteName)}" time="${testTime}"`;

          if (test.status === 'failed') {
            xml += `>
      <failure message="${escapeXml(test.failureMessages?.[0] ?? 'Unknown error')}">${escapeXml(test.failureMessages?.join('\n') ?? '')}</failure>
    </testcase>
`;
          } else if (test.status === 'skipped' || test.status === 'pending') {
            xml += `>
      <skipped/>
    </testcase>
`;
          } else {
            xml += `/>
`;
          }
        }

        xml += `  </testsuite>
`;
      }
    }
  } catch {
    // Ignore parse errors
  }

  xml += `</testsuites>`;
  return xml;
}

async function main(): Promise<void> {
  console.log('\n');
  log('========================================', 'bright');
  log('  IaC Dependency Detection Test Runner', 'cyan');
  log('========================================', 'bright');
  console.log('\n');

  const startTime = Date.now();

  mkdirSync(REPORTS_DIR, { recursive: true });

  if (!checkDependencies()) {
    process.exit(1);
  }

  const { success } = await runAllTests();

  const jsonPath = join(REPORTS_DIR, 'test-results.json');
  const summary = parseTestResults(jsonPath);

  if (!summary) {
    log('Failed to parse test results', 'red');
    process.exit(1);
  }

  const failures = analyzeFailures(jsonPath);

  let coverage: CoverageReport | null = null;
  if (process.argv.includes('--coverage')) {
    coverage = await runCoverage();
    if (coverage) {
      summary.coverageAvailable = true;
      summary.coverage = coverage;
    }
  }

  logSection('Generating Reports');

  const mdReport = generateMarkdownReport(summary, failures, coverage);
  writeFileSync(join(REPORTS_DIR, 'test-report.md'), mdReport);
  log('Generated: test-report.md', 'green');

  const junitReport = generateJUnitReport(jsonPath);
  writeFileSync(join(REPORTS_DIR, 'junit.xml'), junitReport);
  log('Generated: junit.xml', 'green');

  writeFileSync(
    join(REPORTS_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
  log('Generated: summary.json', 'green');

  logSection('Test Execution Summary');

  console.log(`
  Total Suites:   ${summary.totalSuites}
  Passed Suites:  ${colors.green}${summary.passedSuites}${colors.reset}
  Failed Suites:  ${summary.failedSuites > 0 ? colors.red : colors.green}${summary.failedSuites}${colors.reset}

  Total Tests:    ${summary.totalTests}
  Passed Tests:   ${colors.green}${summary.passedTests}${colors.reset}
  Failed Tests:   ${summary.failedTests > 0 ? colors.red : colors.green}${summary.failedTests}${colors.reset}
  Skipped Tests:  ${summary.skippedTests}

  Pass Rate:      ${summary.passRate >= 95 ? colors.green : colors.yellow}${summary.passRate.toFixed(1)}%${colors.reset}
  Duration:       ${((Date.now() - startTime) / 1000).toFixed(2)}s
`);

  if (coverage) {
    console.log(`
  Coverage:
    Lines:      ${coverage.lines >= 60 ? colors.green : colors.red}${coverage.lines.toFixed(1)}%${colors.reset}
    Branches:   ${coverage.branches >= 60 ? colors.green : colors.red}${coverage.branches.toFixed(1)}%${colors.reset}
    Functions:  ${coverage.functions >= 60 ? colors.green : colors.red}${coverage.functions.toFixed(1)}%${colors.reset}
`);
  }

  if (failures.length > 0) {
    logSection('Failure Analysis');
    for (const failure of failures.slice(0, 10)) {
      log(`\n[${failure.category.toUpperCase()}] ${failure.testName}`, 'red');
      log(`  File: ${failure.file}`, 'yellow');
      log(`  Fix: ${failure.suggestedFix}`, 'cyan');
    }

    if (failures.length > 10) {
      log(`\n... and ${failures.length - 10} more failures`, 'yellow');
    }
  }

  console.log('\n');
  log(`Reports saved to: ${REPORTS_DIR}`, 'blue');
  console.log('\n');

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
