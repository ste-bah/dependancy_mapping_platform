/**
 * E2E Test Reporter
 * @module e2e/logging/test-reporter
 *
 * Provides test result reporting in multiple formats:
 * - JUnit XML format for CI integration
 * - JSON format for programmatic processing
 * - Console summary for human readability
 * - HTML report generation
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #28 of 47 | Phase 4: Implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  TestRunResult,
  TestSuiteResult,
  TestResult,
  TestStatus,
  TestRunStats,
  TestSuiteStats,
  TestMetrics,
} from '../types/test-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Reporter configuration
 */
export interface ReporterConfig {
  /** Output directory for reports */
  readonly outputDir: string;
  /** Generate JUnit XML report */
  readonly junit: boolean;
  /** JUnit XML filename */
  readonly junitFilename: string;
  /** Generate JSON report */
  readonly json: boolean;
  /** JSON filename */
  readonly jsonFilename: string;
  /** Generate HTML report */
  readonly html: boolean;
  /** HTML filename */
  readonly htmlFilename: string;
  /** Print console summary */
  readonly console: boolean;
  /** Use colors in console output */
  readonly colors: boolean;
  /** Include timestamps in reports */
  readonly timestamps: boolean;
  /** Include stack traces in failure reports */
  readonly stackTraces: boolean;
  /** CI mode (minimal console output) */
  readonly ciMode: boolean;
}

/**
 * Default reporter configuration
 */
export const DEFAULT_REPORTER_CONFIG: ReporterConfig = {
  outputDir: './e2e/reports',
  junit: true,
  junitFilename: 'junit-results.xml',
  json: true,
  jsonFilename: 'test-results.json',
  html: true,
  htmlFilename: 'test-report.html',
  console: true,
  colors: process.stdout.isTTY ?? false,
  timestamps: true,
  stackTraces: true,
  ciMode: process.env.CI === 'true',
};

/**
 * JUnit test case
 */
interface JUnitTestCase {
  readonly name: string;
  readonly classname: string;
  readonly time: number;
  readonly status: TestStatus;
  readonly failure?: {
    readonly message: string;
    readonly type: string;
    readonly content: string;
  };
  readonly skipped?: boolean;
  readonly systemOut?: string;
  readonly systemErr?: string;
}

/**
 * JUnit test suite
 */
interface JUnitTestSuite {
  readonly name: string;
  readonly tests: number;
  readonly failures: number;
  readonly errors: number;
  readonly skipped: number;
  readonly time: number;
  readonly timestamp: string;
  readonly testCases: ReadonlyArray<JUnitTestCase>;
}

/**
 * JSON report format
 */
export interface JsonReport {
  readonly version: string;
  readonly generatedAt: string;
  readonly duration: number;
  readonly status: TestStatus;
  readonly stats: ReportStats;
  readonly environment: ReportEnvironment;
  readonly suites: ReadonlyArray<JsonSuiteReport>;
  readonly failures: ReadonlyArray<JsonFailureReport>;
  readonly performance: PerformanceReport;
}

/**
 * Report statistics
 */
interface ReportStats {
  readonly totalSuites: number;
  readonly passedSuites: number;
  readonly failedSuites: number;
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
  readonly skippedTests: number;
  readonly passRate: number;
  readonly averageDuration: number;
}

/**
 * Environment info for reports
 */
interface ReportEnvironment {
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly ci: boolean;
  readonly ciName?: string;
  readonly gitBranch?: string;
  readonly gitCommit?: string;
  readonly timestamp: string;
}

/**
 * Suite report
 */
interface JsonSuiteReport {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly status: TestStatus;
  readonly duration: number;
  readonly tests: ReadonlyArray<JsonTestReport>;
}

/**
 * Test report
 */
interface JsonTestReport {
  readonly id: string;
  readonly name: string;
  readonly status: TestStatus;
  readonly duration: number;
  readonly retries: number;
  readonly error?: {
    readonly message: string;
    readonly stack?: string;
    readonly expected?: unknown;
    readonly actual?: unknown;
  };
}

/**
 * Failure report
 */
interface JsonFailureReport {
  readonly suiteId: string;
  readonly suiteName: string;
  readonly testId: string;
  readonly testName: string;
  readonly error: {
    readonly message: string;
    readonly stack?: string;
    readonly expected?: unknown;
    readonly actual?: unknown;
  };
}

/**
 * Performance report
 */
interface PerformanceReport {
  readonly totalDuration: number;
  readonly setupDuration: number;
  readonly testDuration: number;
  readonly teardownDuration: number;
  readonly slowestTests: ReadonlyArray<{
    readonly name: string;
    readonly duration: number;
  }>;
}

// ============================================================================
// Reporter Interface
// ============================================================================

/**
 * Test reporter interface
 */
export interface ITestReporter {
  /**
   * Generate all configured reports
   */
  generateReports(result: TestRunResult): Promise<ReportGenerationResult>;

  /**
   * Generate JUnit XML report
   */
  generateJunitReport(result: TestRunResult): Promise<string>;

  /**
   * Generate JSON report
   */
  generateJsonReport(result: TestRunResult): Promise<JsonReport>;

  /**
   * Generate HTML report
   */
  generateHtmlReport(result: TestRunResult): Promise<string>;

  /**
   * Print console summary
   */
  printConsoleSummary(result: TestRunResult): void;
}

/**
 * Report generation result
 */
export interface ReportGenerationResult {
  readonly success: boolean;
  readonly files: ReadonlyArray<GeneratedFile>;
  readonly errors: ReadonlyArray<ReportError>;
}

/**
 * Generated file info
 */
interface GeneratedFile {
  readonly type: 'junit' | 'json' | 'html';
  readonly path: string;
  readonly size: number;
}

/**
 * Report generation error
 */
interface ReportError {
  readonly type: 'junit' | 'json' | 'html' | 'console';
  readonly message: string;
  readonly cause?: Error;
}

// ============================================================================
// Test Reporter Implementation
// ============================================================================

/**
 * Test reporter implementation
 */
export class TestReporter implements ITestReporter {
  private readonly config: ReporterConfig;

  constructor(config: Partial<ReporterConfig> = {}) {
    this.config = { ...DEFAULT_REPORTER_CONFIG, ...config };
  }

  // ============================================================================
  // Main Report Generation
  // ============================================================================

  async generateReports(result: TestRunResult): Promise<ReportGenerationResult> {
    const files: GeneratedFile[] = [];
    const errors: ReportError[] = [];

    // Ensure output directory exists
    this.ensureOutputDir();

    // Generate JUnit XML
    if (this.config.junit) {
      try {
        const xml = await this.generateJunitReport(result);
        const filePath = path.join(this.config.outputDir, this.config.junitFilename);
        fs.writeFileSync(filePath, xml, 'utf-8');
        files.push({
          type: 'junit',
          path: filePath,
          size: Buffer.byteLength(xml),
        });
      } catch (error) {
        errors.push({
          type: 'junit',
          message: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error ? error : undefined,
        });
      }
    }

    // Generate JSON
    if (this.config.json) {
      try {
        const report = await this.generateJsonReport(result);
        const json = JSON.stringify(report, null, 2);
        const filePath = path.join(this.config.outputDir, this.config.jsonFilename);
        fs.writeFileSync(filePath, json, 'utf-8');
        files.push({
          type: 'json',
          path: filePath,
          size: Buffer.byteLength(json),
        });
      } catch (error) {
        errors.push({
          type: 'json',
          message: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error ? error : undefined,
        });
      }
    }

    // Generate HTML
    if (this.config.html) {
      try {
        const html = await this.generateHtmlReport(result);
        const filePath = path.join(this.config.outputDir, this.config.htmlFilename);
        fs.writeFileSync(filePath, html, 'utf-8');
        files.push({
          type: 'html',
          path: filePath,
          size: Buffer.byteLength(html),
        });
      } catch (error) {
        errors.push({
          type: 'html',
          message: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error ? error : undefined,
        });
      }
    }

    // Print console summary
    if (this.config.console) {
      try {
        this.printConsoleSummary(result);
      } catch (error) {
        errors.push({
          type: 'console',
          message: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error ? error : undefined,
        });
      }
    }

    return {
      success: errors.length === 0,
      files,
      errors,
    };
  }

  // ============================================================================
  // JUnit XML Report
  // ============================================================================

  async generateJunitReport(result: TestRunResult): Promise<string> {
    const suites = result.suites.map(suite => this.convertToJUnitSuite(suite));

    const totalTests = suites.reduce((sum, s) => sum + s.tests, 0);
    const totalFailures = suites.reduce((sum, s) => sum + s.failures, 0);
    const totalErrors = suites.reduce((sum, s) => sum + s.errors, 0);
    const totalSkipped = suites.reduce((sum, s) => sum + s.skipped, 0);
    const totalTime = result.duration / 1000;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="E2E Tests" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" skipped="${totalSkipped}" time="${totalTime.toFixed(3)}">\n`;

    for (const suite of suites) {
      xml += this.formatJUnitSuite(suite);
    }

    xml += '</testsuites>\n';

    return xml;
  }

  private convertToJUnitSuite(suite: TestSuiteResult): JUnitTestSuite {
    const testCases = suite.tests.map(test => this.convertToJUnitTestCase(test, suite.name));

    return {
      name: suite.name,
      tests: suite.stats.total,
      failures: suite.stats.failed,
      errors: 0,
      skipped: suite.stats.skipped,
      time: suite.duration / 1000,
      timestamp: suite.startTime.toISOString(),
      testCases,
    };
  }

  private convertToJUnitTestCase(test: TestResult, suiteName: string): JUnitTestCase {
    const result: JUnitTestCase = {
      name: test.testName,
      classname: suiteName.replace(/\s+/g, '.'),
      time: test.duration / 1000,
      status: test.status,
      skipped: test.status === 'skipped',
    };

    if (test.status === 'failed' && test.error) {
      return {
        ...result,
        failure: {
          message: test.error.message,
          type: test.error.name ?? 'Error',
          content: this.config.stackTraces ? (test.error.stack ?? test.error.message) : test.error.message,
        },
      };
    }

    return result;
  }

  private formatJUnitSuite(suite: JUnitTestSuite): string {
    let xml = `  <testsuite name="${this.escapeXml(suite.name)}" tests="${suite.tests}" failures="${suite.failures}" errors="${suite.errors}" skipped="${suite.skipped}" time="${suite.time.toFixed(3)}" timestamp="${suite.timestamp}">\n`;

    for (const testCase of suite.testCases) {
      xml += this.formatJUnitTestCase(testCase);
    }

    xml += '  </testsuite>\n';
    return xml;
  }

  private formatJUnitTestCase(testCase: JUnitTestCase): string {
    let xml = `    <testcase name="${this.escapeXml(testCase.name)}" classname="${this.escapeXml(testCase.classname)}" time="${testCase.time.toFixed(3)}"`;

    if (!testCase.failure && !testCase.skipped) {
      xml += ' />\n';
      return xml;
    }

    xml += '>\n';

    if (testCase.skipped) {
      xml += '      <skipped />\n';
    }

    if (testCase.failure) {
      xml += `      <failure message="${this.escapeXml(testCase.failure.message)}" type="${this.escapeXml(testCase.failure.type)}">${this.escapeXml(testCase.failure.content)}</failure>\n`;
    }

    if (testCase.systemOut) {
      xml += `      <system-out>${this.escapeXml(testCase.systemOut)}</system-out>\n`;
    }

    if (testCase.systemErr) {
      xml += `      <system-err>${this.escapeXml(testCase.systemErr)}</system-err>\n`;
    }

    xml += '    </testcase>\n';
    return xml;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================================================
  // JSON Report
  // ============================================================================

  async generateJsonReport(result: TestRunResult): Promise<JsonReport> {
    const failures = this.collectFailures(result);
    const slowestTests = this.findSlowestTests(result, 10);

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      duration: result.duration,
      status: result.status,
      stats: this.calculateReportStats(result),
      environment: this.getEnvironmentInfo(),
      suites: result.suites.map(suite => this.convertToJsonSuite(suite)),
      failures,
      performance: {
        totalDuration: result.duration,
        setupDuration: 0, // Would need to track separately
        testDuration: result.duration,
        teardownDuration: 0, // Would need to track separately
        slowestTests,
      },
    };
  }

  private calculateReportStats(result: TestRunResult): ReportStats {
    const allTests = result.suites.flatMap(s => s.tests);

    return {
      totalSuites: result.suites.length,
      passedSuites: result.suites.filter(s => s.status === 'passed').length,
      failedSuites: result.suites.filter(s => s.status === 'failed').length,
      totalTests: allTests.length,
      passedTests: allTests.filter(t => t.status === 'passed').length,
      failedTests: allTests.filter(t => t.status === 'failed').length,
      skippedTests: allTests.filter(t => t.status === 'skipped').length,
      passRate: allTests.length > 0
        ? (allTests.filter(t => t.status === 'passed').length / allTests.length) * 100
        : 0,
      averageDuration: allTests.length > 0
        ? allTests.reduce((sum, t) => sum + t.duration, 0) / allTests.length
        : 0,
    };
  }

  private getEnvironmentInfo(): ReportEnvironment {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ci: process.env.CI === 'true',
      ciName: process.env.CI_NAME ?? process.env.GITHUB_ACTIONS ? 'GitHub Actions' : undefined,
      gitBranch: process.env.GITHUB_REF_NAME ?? process.env.GIT_BRANCH,
      gitCommit: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT,
      timestamp: new Date().toISOString(),
    };
  }

  private convertToJsonSuite(suite: TestSuiteResult): JsonSuiteReport {
    return {
      id: suite.suiteId,
      name: suite.name,
      file: suite.file,
      status: suite.status,
      duration: suite.duration,
      tests: suite.tests.map(test => this.convertToJsonTest(test)),
    };
  }

  private convertToJsonTest(test: TestResult): JsonTestReport {
    return {
      id: test.caseId,
      name: test.testName,
      status: test.status,
      duration: test.duration,
      retries: test.retry?.attempt ?? 0,
      error: test.error ? {
        message: test.error.message,
        stack: this.config.stackTraces ? test.error.stack : undefined,
        expected: test.error.expected,
        actual: test.error.actual,
      } : undefined,
    };
  }

  private collectFailures(result: TestRunResult): JsonFailureReport[] {
    const failures: JsonFailureReport[] = [];

    for (const suite of result.suites) {
      for (const test of suite.tests) {
        if (test.status === 'failed' && test.error) {
          failures.push({
            suiteId: suite.suiteId,
            suiteName: suite.name,
            testId: test.caseId,
            testName: test.testName,
            error: {
              message: test.error.message,
              stack: this.config.stackTraces ? test.error.stack : undefined,
              expected: test.error.expected,
              actual: test.error.actual,
            },
          });
        }
      }
    }

    return failures;
  }

  private findSlowestTests(result: TestRunResult, limit: number): Array<{ name: string; duration: number }> {
    const allTests = result.suites.flatMap(s => s.tests);

    return allTests
      .filter(t => t.status === 'passed')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(t => ({ name: t.testName, duration: t.duration }));
  }

  // ============================================================================
  // HTML Report
  // ============================================================================

  async generateHtmlReport(result: TestRunResult): Promise<string> {
    const stats = this.calculateReportStats(result);
    const failures = this.collectFailures(result);
    const env = this.getEnvironmentInfo();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    header h1 { font-size: 24px; margin-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
    .stat-card .value { font-size: 32px; font-weight: bold; }
    .stat-card .label { font-size: 14px; color: #666; }
    .stat-card.passed .value { color: #22c55e; }
    .stat-card.failed .value { color: #ef4444; }
    .stat-card.skipped .value { color: #f59e0b; }
    .section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .section h2 { font-size: 18px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
    .suite { margin-bottom: 15px; }
    .suite-header { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 4px; cursor: pointer; }
    .suite-header:hover { background: #e9ecef; }
    .suite-name { font-weight: 600; }
    .suite-stats { font-size: 14px; color: #666; }
    .test-list { padding: 10px 0 0 20px; }
    .test { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .test:last-child { border-bottom: none; }
    .test-name { display: flex; align-items: center; gap: 8px; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .status.passed { background: #dcfce7; color: #166534; }
    .status.failed { background: #fee2e2; color: #991b1b; }
    .status.skipped { background: #fef3c7; color: #92400e; }
    .duration { font-size: 14px; color: #666; }
    .failure { background: #fef2f2; padding: 15px; border-radius: 4px; margin-top: 10px; border-left: 4px solid #ef4444; }
    .failure-title { font-weight: 600; color: #991b1b; margin-bottom: 5px; }
    .failure-message { font-family: monospace; font-size: 13px; color: #7f1d1d; white-space: pre-wrap; }
    .env-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 14px; }
    .env-item { display: flex; justify-content: space-between; padding: 8px; background: #f8f9fa; border-radius: 4px; }
    .env-label { color: #666; }
    .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 10px; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #4ade80); }
    footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>E2E Test Report</h1>
      <p>Generated: ${env.timestamp}</p>
      <p>Duration: ${this.formatDuration(result.duration)}</p>
    </header>

    <div class="summary">
      <div class="stat-card">
        <div class="value">${stats.totalTests}</div>
        <div class="label">Total Tests</div>
      </div>
      <div class="stat-card passed">
        <div class="value">${stats.passedTests}</div>
        <div class="label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="value">${stats.failedTests}</div>
        <div class="label">Failed</div>
      </div>
      <div class="stat-card skipped">
        <div class="value">${stats.skippedTests}</div>
        <div class="label">Skipped</div>
      </div>
      <div class="stat-card">
        <div class="value">${stats.passRate.toFixed(1)}%</div>
        <div class="label">Pass Rate</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${stats.passRate}%"></div>
        </div>
      </div>
    </div>

    ${failures.length > 0 ? `
    <div class="section">
      <h2>Failures (${failures.length})</h2>
      ${failures.map(f => `
        <div class="failure">
          <div class="failure-title">${this.escapeHtml(f.suiteName)} > ${this.escapeHtml(f.testName)}</div>
          <div class="failure-message">${this.escapeHtml(f.error.message)}${f.error.stack ? '\n\n' + this.escapeHtml(f.error.stack) : ''}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section">
      <h2>Test Suites (${stats.totalSuites})</h2>
      ${result.suites.map(suite => `
        <div class="suite">
          <div class="suite-header">
            <span class="suite-name">
              <span class="status ${suite.status}">${suite.status}</span>
              ${this.escapeHtml(suite.name)}
            </span>
            <span class="suite-stats">
              ${suite.stats.passed}/${suite.stats.total} passed | ${this.formatDuration(suite.duration)}
            </span>
          </div>
          <div class="test-list">
            ${suite.tests.map(test => `
              <div class="test">
                <div class="test-name">
                  <span class="status ${test.status}">${test.status}</span>
                  ${this.escapeHtml(test.testName)}
                </div>
                <span class="duration">${this.formatDuration(test.duration)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h2>Environment</h2>
      <div class="env-info">
        <div class="env-item">
          <span class="env-label">Node.js</span>
          <span>${env.nodeVersion}</span>
        </div>
        <div class="env-item">
          <span class="env-label">Platform</span>
          <span>${env.platform} (${env.arch})</span>
        </div>
        <div class="env-item">
          <span class="env-label">CI</span>
          <span>${env.ci ? (env.ciName ?? 'Yes') : 'No'}</span>
        </div>
        ${env.gitBranch ? `
        <div class="env-item">
          <span class="env-label">Branch</span>
          <span>${env.gitBranch}</span>
        </div>
        ` : ''}
        ${env.gitCommit ? `
        <div class="env-item">
          <span class="env-label">Commit</span>
          <span>${env.gitCommit.slice(0, 8)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <footer>
      E2E Test Report | Generated by test-reporter
    </footer>
  </div>

  <script>
    document.querySelectorAll('.suite-header').forEach(header => {
      header.addEventListener('click', () => {
        const testList = header.nextElementSibling;
        testList.style.display = testList.style.display === 'none' ? 'block' : 'none';
      });
    });
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================================================
  // Console Summary
  // ============================================================================

  printConsoleSummary(result: TestRunResult): void {
    const stats = this.calculateReportStats(result);
    const c = this.colors();

    console.log('');
    console.log(c.bold + '=====================================' + c.reset);
    console.log(c.bold + '         E2E TEST SUMMARY           ' + c.reset);
    console.log(c.bold + '=====================================' + c.reset);
    console.log('');

    // Status
    const statusColor = result.status === 'passed' ? c.green : c.red;
    console.log(`Status: ${statusColor}${result.status.toUpperCase()}${c.reset}`);
    console.log(`Duration: ${this.formatDuration(result.duration)}`);
    console.log('');

    // Summary table
    console.log(`${c.cyan}Suites${c.reset}:  ${stats.passedSuites} passed, ${stats.failedSuites} failed, ${stats.totalSuites} total`);
    console.log(`${c.cyan}Tests${c.reset}:   ${c.green}${stats.passedTests} passed${c.reset}, ${stats.failedTests > 0 ? c.red + stats.failedTests + ' failed' + c.reset : stats.failedTests + ' failed'}, ${stats.skippedTests > 0 ? c.yellow + stats.skippedTests + ' skipped' + c.reset : stats.skippedTests + ' skipped'}, ${stats.totalTests} total`);
    console.log(`${c.cyan}Pass Rate${c.reset}: ${stats.passRate >= 80 ? c.green : stats.passRate >= 60 ? c.yellow : c.red}${stats.passRate.toFixed(1)}%${c.reset}`);
    console.log('');

    // Failed tests
    if (stats.failedTests > 0) {
      console.log(c.red + c.bold + 'FAILED TESTS:' + c.reset);
      console.log('');

      for (const suite of result.suites) {
        for (const test of suite.tests) {
          if (test.status === 'failed') {
            console.log(`  ${c.red}x${c.reset} ${suite.name} > ${test.testName}`);
            if (test.error) {
              console.log(`    ${c.dim}${test.error.message}${c.reset}`);
              if (!this.config.ciMode && this.config.stackTraces && test.error.stack) {
                const stackLines = test.error.stack.split('\n').slice(1, 4);
                for (const line of stackLines) {
                  console.log(`    ${c.dim}${line.trim()}${c.reset}`);
                }
              }
            }
            console.log('');
          }
        }
      }
    }

    // CI mode: minimal output
    if (!this.config.ciMode) {
      // Slowest tests
      const slowest = this.findSlowestTests(result, 5);
      if (slowest.length > 0) {
        console.log(c.yellow + 'SLOWEST TESTS:' + c.reset);
        for (const test of slowest) {
          console.log(`  ${this.formatDuration(test.duration).padStart(8)} ${test.name}`);
        }
        console.log('');
      }
    }

    console.log(c.dim + '=====================================' + c.reset);
    console.log('');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }

  private colors(): {
    reset: string;
    bold: string;
    dim: string;
    red: string;
    green: string;
    yellow: string;
    cyan: string;
  } {
    if (!this.config.colors) {
      return {
        reset: '',
        bold: '',
        dim: '',
        red: '',
        green: '',
        yellow: '',
        cyan: '',
      };
    }

    return {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new test reporter
 */
export function createTestReporter(config?: Partial<ReporterConfig>): ITestReporter {
  return new TestReporter(config);
}

/**
 * Global reporter instance
 */
let globalReporter: TestReporter | null = null;

/**
 * Get the global test reporter instance
 */
export function getTestReporter(): ITestReporter {
  if (!globalReporter) {
    globalReporter = new TestReporter();
  }
  return globalReporter;
}

/**
 * Initialize the global test reporter
 */
export function initTestReporter(config?: Partial<ReporterConfig>): ITestReporter {
  globalReporter = new TestReporter(config);
  return globalReporter;
}
