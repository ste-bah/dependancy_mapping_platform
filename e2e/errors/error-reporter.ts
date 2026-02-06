/**
 * E2E Error Reporter
 * @module e2e/errors/error-reporter
 *
 * Error reporting utilities for E2E testing:
 * - Format errors for display in test reports
 * - Stack trace processing and filtering
 * - Context capture and enrichment
 * - Multi-format report generation
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #26 of 47 | Phase 4: Implementation
 */

import {
  E2ETestError,
  AssertionError,
  TimeoutError,
  SetupError,
  FixtureError,
  RetryExhaustedError,
  FlakyTestError,
  ApiTestError,
  isE2ETestError,
  isAssertionError,
  isTimeoutError,
  isSetupError,
  isFixtureError,
  type SerializedE2EError,
  type E2EErrorCode,
  type E2EErrorContext,
} from './e2e-errors.js';
import { AggregatedE2EError } from './error-handlers.js';
import type { TestPhase, TestResult, TestSuiteResult, TestRunResult } from '../types/test-types.js';

// ============================================================================
// Report Types
// ============================================================================

/**
 * Error report format options
 */
export type ErrorReportFormat = 'text' | 'json' | 'html' | 'markdown';

/**
 * Error report configuration
 */
export interface ErrorReportConfig {
  /** Report format */
  format: ErrorReportFormat;
  /** Include full stack traces */
  includeStackTraces: boolean;
  /** Maximum stack frames to include */
  maxStackFrames: number;
  /** Filter internal frames from stack */
  filterInternalFrames: boolean;
  /** Include error context details */
  includeContext: boolean;
  /** Include timestamp */
  includeTimestamp: boolean;
  /** Include source code snippets */
  includeSourceSnippets: boolean;
  /** Color output (for terminal) */
  colorOutput: boolean;
  /** Verbose mode with all details */
  verbose: boolean;
}

/**
 * Default report configuration
 */
export const DEFAULT_REPORT_CONFIG: ErrorReportConfig = {
  format: 'text',
  includeStackTraces: true,
  maxStackFrames: 10,
  filterInternalFrames: true,
  includeContext: true,
  includeTimestamp: true,
  includeSourceSnippets: false,
  colorOutput: true,
  verbose: false,
};

/**
 * Structured error report
 */
export interface ErrorReport {
  readonly summary: ErrorSummary;
  readonly errors: ReadonlyArray<FormattedError>;
  readonly timestamp: string;
  readonly testInfo?: TestInfo;
}

/**
 * Error summary statistics
 */
export interface ErrorSummary {
  readonly total: number;
  readonly byType: Record<string, number>;
  readonly byPhase: Record<string, number>;
  readonly byCode: Record<string, number>;
  readonly recoverable: number;
  readonly nonRecoverable: number;
}

/**
 * Formatted error for reporting
 */
export interface FormattedError {
  readonly id: string;
  readonly type: string;
  readonly code: E2EErrorCode;
  readonly message: string;
  readonly phase?: TestPhase;
  readonly timestamp: string;
  readonly stack?: ProcessedStackTrace;
  readonly context?: Record<string, unknown>;
  readonly diff?: AssertionDiff;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Assertion diff for display
 */
export interface AssertionDiff {
  readonly expected: string;
  readonly actual: string;
  readonly diffLines?: string[];
}

/**
 * Processed stack trace
 */
export interface ProcessedStackTrace {
  readonly frames: StackFrame[];
  readonly truncated: boolean;
  readonly totalFrames: number;
}

/**
 * Individual stack frame
 */
export interface StackFrame {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
  readonly functionName?: string;
  readonly isInternal: boolean;
  readonly sourceSnippet?: string[];
}

/**
 * Test info for context
 */
export interface TestInfo {
  readonly testName?: string;
  readonly suiteName?: string;
  readonly testFile?: string;
  readonly duration?: number;
}

// ============================================================================
// Error Reporter Implementation
// ============================================================================

/**
 * E2E Error Reporter for formatting and reporting test errors
 */
export class E2EErrorReporter {
  private readonly config: ErrorReportConfig;

  constructor(config: Partial<ErrorReportConfig> = {}) {
    this.config = { ...DEFAULT_REPORT_CONFIG, ...config };
  }

  /**
   * Format a single error
   */
  formatError(error: unknown, testInfo?: TestInfo): string {
    const e2eError = this.normalizeError(error);
    const formatted = this.formatE2EError(e2eError);

    switch (this.config.format) {
      case 'json':
        return this.toJSON(formatted);
      case 'html':
        return this.toHTML(formatted, testInfo);
      case 'markdown':
        return this.toMarkdown(formatted, testInfo);
      default:
        return this.toText(formatted, testInfo);
    }
  }

  /**
   * Generate a complete error report
   */
  generateReport(errors: E2ETestError[], testInfo?: TestInfo): ErrorReport {
    const formatted = errors.map((e) => this.formatE2EError(e));

    const summary = this.generateSummary(errors);

    return {
      summary,
      errors: formatted,
      timestamp: new Date().toISOString(),
      testInfo,
    };
  }

  /**
   * Format error report for output
   */
  formatReport(report: ErrorReport): string {
    switch (this.config.format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.reportToHTML(report);
      case 'markdown':
        return this.reportToMarkdown(report);
      default:
        return this.reportToText(report);
    }
  }

  /**
   * Format errors from test result
   */
  formatTestResultErrors(result: TestResult): string {
    if (!result.error) return '';

    const error = new E2ETestError(
      result.error.message,
      'E2E_TEST_ERROR' as E2EErrorCode,
      {
        caseId: result.caseId,
        phase: 'test',
      }
    );

    return this.formatError(error, {
      testName: result.testName,
      duration: result.duration,
    });
  }

  /**
   * Format errors from test suite result
   */
  formatSuiteResultErrors(result: TestSuiteResult): string {
    const failedTests = result.tests.filter((t) => t.status === 'failed');
    if (failedTests.length === 0) return '';

    const errors = failedTests.map((t) =>
      new E2ETestError(
        t.error?.message ?? 'Unknown error',
        'E2E_TEST_ERROR' as E2EErrorCode,
        {
          suiteId: result.suiteId,
          caseId: t.caseId,
          phase: 'test',
        }
      )
    );

    const report = this.generateReport(errors, {
      suiteName: result.name,
      duration: result.duration,
    });

    return this.formatReport(report);
  }

  // ============================================================================
  // Private Methods - Error Formatting
  // ============================================================================

  private normalizeError(error: unknown): E2ETestError {
    if (isE2ETestError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new E2ETestError(error.message, 'E2E_TEST_ERROR' as E2EErrorCode, {
        cause: error,
      });
    }

    return new E2ETestError(String(error), 'E2E_TEST_ERROR' as E2EErrorCode);
  }

  private formatE2EError(error: E2ETestError): FormattedError {
    const id = `error_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const formatted: FormattedError = {
      id,
      type: error.name,
      code: error.code,
      message: error.message,
      phase: error.phase,
      timestamp: error.timestamp.toISOString(),
    };

    // Add stack trace if configured
    if (this.config.includeStackTraces && error.stack) {
      (formatted as { stack: ProcessedStackTrace }).stack = this.processStackTrace(error.stack);
    }

    // Add context if configured
    if (this.config.includeContext && error.details) {
      (formatted as { context: Record<string, unknown> }).context = error.details;
    }

    // Add assertion diff if applicable
    if (isAssertionError(error)) {
      (formatted as { diff: AssertionDiff }).diff = {
        expected: this.formatValue(error.expected),
        actual: this.formatValue(error.actual),
        diffLines: error.diffString?.split('\n'),
      };
    }

    // Add type-specific metadata
    const metadata = this.extractMetadata(error);
    if (Object.keys(metadata).length > 0) {
      (formatted as { metadata: Record<string, unknown> }).metadata = metadata;
    }

    return formatted;
  }

  private processStackTrace(stack: string): ProcessedStackTrace {
    const lines = stack.split('\n');
    const frames: StackFrame[] = [];
    let totalFrames = 0;

    for (const line of lines) {
      const frame = this.parseStackFrame(line);
      if (!frame) continue;

      totalFrames++;

      // Filter internal frames if configured
      if (this.config.filterInternalFrames && frame.isInternal) {
        continue;
      }

      // Limit number of frames
      if (frames.length >= this.config.maxStackFrames) {
        continue;
      }

      frames.push(frame);
    }

    return {
      frames,
      truncated: totalFrames > this.config.maxStackFrames,
      totalFrames,
    };
  }

  private parseStackFrame(line: string): StackFrame | null {
    // Match standard V8 stack frame format
    const match = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (!match) return null;

    const [, functionName, file, lineStr, columnStr] = match;
    const lineNum = parseInt(lineStr, 10);
    const column = columnStr ? parseInt(columnStr, 10) : undefined;

    const isInternal =
      file.includes('node_modules') ||
      file.includes('node:internal') ||
      file.startsWith('internal/');

    return {
      file,
      line: lineNum,
      column,
      functionName: functionName || undefined,
      isInternal,
    };
  }

  private extractMetadata(error: E2ETestError): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if (isTimeoutError(error)) {
      metadata.timeoutMs = error.timeoutMs;
      metadata.operation = error.operation;
      if (error.elapsedMs) metadata.elapsedMs = error.elapsedMs;
    }

    if (isSetupError(error)) {
      metadata.setupType = error.setupType;
      if (error.step) metadata.step = error.step;
    }

    if (isFixtureError(error)) {
      metadata.fixtureId = error.fixtureId;
      metadata.operation = error.operation;
    }

    if (error instanceof RetryExhaustedError) {
      metadata.attempts = error.attempts;
      metadata.maxAttempts = error.maxAttempts;
    }

    if (error instanceof FlakyTestError) {
      metadata.passCount = error.passCount;
      metadata.failCount = error.failCount;
      metadata.totalAttempts = error.totalAttempts;
    }

    if (error instanceof ApiTestError) {
      metadata.method = error.method;
      metadata.url = error.url;
      if (error.statusCode) metadata.statusCode = error.statusCode;
    }

    return metadata;
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[Circular]';
      }
    }
    return String(value);
  }

  // ============================================================================
  // Private Methods - Summary Generation
  // ============================================================================

  private generateSummary(errors: E2ETestError[]): ErrorSummary {
    const byType: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const byCode: Record<string, number> = {};
    let recoverable = 0;
    let nonRecoverable = 0;

    for (const error of errors) {
      // Count by type
      byType[error.name] = (byType[error.name] ?? 0) + 1;

      // Count by phase
      if (error.phase) {
        byPhase[error.phase] = (byPhase[error.phase] ?? 0) + 1;
      }

      // Count by code
      byCode[error.code] = (byCode[error.code] ?? 0) + 1;

      // Count recoverable
      if (error.recoverable) {
        recoverable++;
      } else {
        nonRecoverable++;
      }
    }

    return {
      total: errors.length,
      byType,
      byPhase,
      byCode,
      recoverable,
      nonRecoverable,
    };
  }

  // ============================================================================
  // Private Methods - Output Formatting
  // ============================================================================

  private toJSON(formatted: FormattedError): string {
    return JSON.stringify(formatted, null, 2);
  }

  private toText(formatted: FormattedError, testInfo?: TestInfo): string {
    const lines: string[] = [];
    const color = this.config.colorOutput;

    // Header
    const header = `${formatted.type} [${formatted.code}]`;
    lines.push(color ? `\x1b[31m${header}\x1b[0m` : header);

    // Test info
    if (testInfo?.testName) {
      lines.push(`  Test: ${testInfo.testName}`);
    }

    // Message
    lines.push(`  Message: ${formatted.message}`);

    // Phase
    if (formatted.phase) {
      lines.push(`  Phase: ${formatted.phase}`);
    }

    // Timestamp
    if (this.config.includeTimestamp) {
      lines.push(`  Time: ${formatted.timestamp}`);
    }

    // Diff for assertions
    if (formatted.diff) {
      lines.push('');
      lines.push('  Expected:');
      lines.push(`    ${formatted.diff.expected}`);
      lines.push('  Received:');
      lines.push(`    ${formatted.diff.actual}`);
    }

    // Metadata
    if (formatted.metadata && Object.keys(formatted.metadata).length > 0) {
      lines.push('');
      lines.push('  Details:');
      for (const [key, value] of Object.entries(formatted.metadata)) {
        lines.push(`    ${key}: ${this.formatValue(value)}`);
      }
    }

    // Stack trace
    if (formatted.stack && formatted.stack.frames.length > 0) {
      lines.push('');
      lines.push('  Stack Trace:');
      for (const frame of formatted.stack.frames) {
        const location = `${frame.file}:${frame.line}${frame.column ? `:${frame.column}` : ''}`;
        const fn = frame.functionName ? ` (${frame.functionName})` : '';
        lines.push(`    at ${location}${fn}`);
      }
      if (formatted.stack.truncated) {
        lines.push(`    ... ${formatted.stack.totalFrames - formatted.stack.frames.length} more frames`);
      }
    }

    return lines.join('\n');
  }

  private toHTML(formatted: FormattedError, testInfo?: TestInfo): string {
    const diffHtml = formatted.diff
      ? `
        <div class="diff">
          <div class="expected">
            <strong>Expected:</strong>
            <pre>${this.escapeHtml(formatted.diff.expected)}</pre>
          </div>
          <div class="actual">
            <strong>Received:</strong>
            <pre>${this.escapeHtml(formatted.diff.actual)}</pre>
          </div>
        </div>`
      : '';

    const stackHtml = formatted.stack
      ? `
        <div class="stack-trace">
          <strong>Stack Trace:</strong>
          <ul>
            ${formatted.stack.frames
              .map((f) => `<li>${this.escapeHtml(f.file)}:${f.line}${f.functionName ? ` (${this.escapeHtml(f.functionName)})` : ''}</li>`)
              .join('\n')}
          </ul>
        </div>`
      : '';

    return `
      <div class="error-report" data-error-id="${formatted.id}">
        <h3 class="error-type">${this.escapeHtml(formatted.type)} [${formatted.code}]</h3>
        ${testInfo?.testName ? `<p class="test-name">Test: ${this.escapeHtml(testInfo.testName)}</p>` : ''}
        <p class="error-message">${this.escapeHtml(formatted.message)}</p>
        ${formatted.phase ? `<p class="error-phase">Phase: ${formatted.phase}</p>` : ''}
        ${this.config.includeTimestamp ? `<p class="error-time">Time: ${formatted.timestamp}</p>` : ''}
        ${diffHtml}
        ${stackHtml}
      </div>
    `;
  }

  private toMarkdown(formatted: FormattedError, testInfo?: TestInfo): string {
    const lines: string[] = [];

    // Header
    lines.push(`### ${formatted.type} [${formatted.code}]`);
    lines.push('');

    // Test info
    if (testInfo?.testName) {
      lines.push(`**Test:** ${testInfo.testName}`);
    }

    // Message
    lines.push(`**Message:** ${formatted.message}`);

    // Phase
    if (formatted.phase) {
      lines.push(`**Phase:** ${formatted.phase}`);
    }

    // Timestamp
    if (this.config.includeTimestamp) {
      lines.push(`**Time:** ${formatted.timestamp}`);
    }

    // Diff
    if (formatted.diff) {
      lines.push('');
      lines.push('**Expected:**');
      lines.push('```');
      lines.push(formatted.diff.expected);
      lines.push('```');
      lines.push('');
      lines.push('**Received:**');
      lines.push('```');
      lines.push(formatted.diff.actual);
      lines.push('```');
    }

    // Stack trace
    if (formatted.stack && formatted.stack.frames.length > 0) {
      lines.push('');
      lines.push('**Stack Trace:**');
      lines.push('```');
      for (const frame of formatted.stack.frames) {
        lines.push(`  at ${frame.file}:${frame.line}${frame.functionName ? ` (${frame.functionName})` : ''}`);
      }
      lines.push('```');
    }

    return lines.join('\n');
  }

  private reportToText(report: ErrorReport): string {
    const lines: string[] = [];
    const color = this.config.colorOutput;

    // Header
    const header = '=== E2E Test Error Report ===';
    lines.push(color ? `\x1b[1m${header}\x1b[0m` : header);
    lines.push('');

    // Summary
    lines.push(`Total Errors: ${report.summary.total}`);
    lines.push(`Recoverable: ${report.summary.recoverable}`);
    lines.push(`Non-Recoverable: ${report.summary.nonRecoverable}`);
    lines.push('');

    // Errors by type
    if (Object.keys(report.summary.byType).length > 0) {
      lines.push('By Type:');
      for (const [type, count] of Object.entries(report.summary.byType)) {
        lines.push(`  ${type}: ${count}`);
      }
      lines.push('');
    }

    // Individual errors
    lines.push('--- Errors ---');
    for (const error of report.errors) {
      lines.push('');
      lines.push(this.toText(error, report.testInfo));
    }

    return lines.join('\n');
  }

  private reportToHTML(report: ErrorReport): string {
    const errorsHtml = report.errors
      .map((e) => this.toHTML(e, report.testInfo))
      .join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>E2E Test Error Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
          .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .error-report { border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
          .error-type { color: #d32f2f; margin-top: 0; }
          .error-message { font-family: monospace; background: #fff3e0; padding: 10px; border-radius: 4px; }
          .diff { margin-top: 15px; }
          .expected pre { background: #e8f5e9; padding: 10px; border-radius: 4px; }
          .actual pre { background: #ffebee; padding: 10px; border-radius: 4px; }
          .stack-trace { margin-top: 15px; font-family: monospace; font-size: 12px; }
          .stack-trace ul { list-style: none; padding-left: 10px; }
        </style>
      </head>
      <body>
        <h1>E2E Test Error Report</h1>
        <div class="summary">
          <h2>Summary</h2>
          <p>Total Errors: ${report.summary.total}</p>
          <p>Recoverable: ${report.summary.recoverable}</p>
          <p>Non-Recoverable: ${report.summary.nonRecoverable}</p>
          <p>Generated: ${report.timestamp}</p>
        </div>
        <div class="errors">
          ${errorsHtml}
        </div>
      </body>
      </html>
    `;
  }

  private reportToMarkdown(report: ErrorReport): string {
    const lines: string[] = [];

    lines.push('# E2E Test Error Report');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Errors:** ${report.summary.total}`);
    lines.push(`- **Recoverable:** ${report.summary.recoverable}`);
    lines.push(`- **Non-Recoverable:** ${report.summary.nonRecoverable}`);
    lines.push(`- **Generated:** ${report.timestamp}`);
    lines.push('');

    if (Object.keys(report.summary.byType).length > 0) {
      lines.push('### By Type');
      lines.push('');
      for (const [type, count] of Object.entries(report.summary.byType)) {
        lines.push(`- ${type}: ${count}`);
      }
      lines.push('');
    }

    lines.push('## Errors');
    lines.push('');

    for (const error of report.errors) {
      lines.push(this.toMarkdown(error, report.testInfo));
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ============================================================================
// Context Capture
// ============================================================================

/**
 * Captured context for error enrichment
 */
export interface CapturedContext {
  readonly environment: EnvironmentContext;
  readonly test: TestContext;
  readonly browser?: BrowserContext;
  readonly network?: NetworkContext;
  readonly console?: ConsoleContext;
}

/**
 * Environment context
 */
export interface EnvironmentContext {
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly cwd: string;
  readonly env: Record<string, string>;
}

/**
 * Test context
 */
export interface TestContext {
  readonly testFile?: string;
  readonly testName?: string;
  readonly suiteName?: string;
  readonly phase: TestPhase;
  readonly startTime: Date;
  readonly elapsed: number;
}

/**
 * Browser context (for browser-based tests)
 */
export interface BrowserContext {
  readonly url?: string;
  readonly title?: string;
  readonly viewport?: { width: number; height: number };
  readonly screenshot?: string;
}

/**
 * Network context
 */
export interface NetworkContext {
  readonly pendingRequests: number;
  readonly lastRequest?: {
    method: string;
    url: string;
    status?: number;
  };
}

/**
 * Console context
 */
export interface ConsoleContext {
  readonly logs: string[];
  readonly warnings: string[];
  readonly errors: string[];
}

/**
 * Context capturer for enriching errors with runtime information
 */
export class ContextCapturer {
  private testStartTime: Date = new Date();
  private currentTest?: { name: string; file: string; suite?: string };
  private currentPhase: TestPhase = 'setup';
  private consoleLogs: string[] = [];
  private consoleWarnings: string[] = [];
  private consoleErrors: string[] = [];

  /**
   * Set current test info
   */
  setTest(name: string, file: string, suite?: string): void {
    this.currentTest = { name, file, suite };
    this.testStartTime = new Date();
    this.clearConsoleLogs();
  }

  /**
   * Set current phase
   */
  setPhase(phase: TestPhase): void {
    this.currentPhase = phase;
  }

  /**
   * Add console log
   */
  addConsoleLog(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
    const target =
      level === 'error'
        ? this.consoleErrors
        : level === 'warn'
          ? this.consoleWarnings
          : this.consoleLogs;

    // Limit size
    if (target.length >= 100) {
      target.shift();
    }
    target.push(message);
  }

  /**
   * Clear console logs
   */
  clearConsoleLogs(): void {
    this.consoleLogs.length = 0;
    this.consoleWarnings.length = 0;
    this.consoleErrors.length = 0;
  }

  /**
   * Capture current context
   */
  capture(): CapturedContext {
    return {
      environment: this.captureEnvironment(),
      test: this.captureTest(),
      console: this.captureConsole(),
    };
  }

  private captureEnvironment(): EnvironmentContext {
    // Filter sensitive environment variables
    const safeEnvKeys = ['NODE_ENV', 'CI', 'TEST_ENV'];
    const env: Record<string, string> = {};
    for (const key of safeEnvKeys) {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    }

    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      env,
    };
  }

  private captureTest(): TestContext {
    return {
      testFile: this.currentTest?.file,
      testName: this.currentTest?.name,
      suiteName: this.currentTest?.suite,
      phase: this.currentPhase,
      startTime: this.testStartTime,
      elapsed: Date.now() - this.testStartTime.getTime(),
    };
  }

  private captureConsole(): ConsoleContext {
    return {
      logs: [...this.consoleLogs],
      warnings: [...this.consoleWarnings],
      errors: [...this.consoleErrors],
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an error reporter instance
 */
export function createErrorReporter(
  config?: Partial<ErrorReportConfig>
): E2EErrorReporter {
  return new E2EErrorReporter(config);
}

/**
 * Create a context capturer instance
 */
export function createContextCapturer(): ContextCapturer {
  return new ContextCapturer();
}

/**
 * Format a single error for display
 */
export function formatE2EError(
  error: unknown,
  config?: Partial<ErrorReportConfig>
): string {
  const reporter = new E2EErrorReporter(config);
  return reporter.formatError(error);
}

/**
 * Generate an error report
 */
export function generateE2EErrorReport(
  errors: E2ETestError[],
  config?: Partial<ErrorReportConfig>,
  testInfo?: TestInfo
): string {
  const reporter = new E2EErrorReporter(config);
  const report = reporter.generateReport(errors, testInfo);
  return reporter.formatReport(report);
}
