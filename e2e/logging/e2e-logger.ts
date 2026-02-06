/**
 * E2E Test Logger
 * @module e2e/logging/e2e-logger
 *
 * Provides structured logging for E2E tests with:
 * - Test-scoped logging context
 * - Multiple log levels (debug, info, warn, error)
 * - Structured JSON format for machine parsing
 * - File and console output transports
 * - Sensitive data redaction
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #28 of 47 | Phase 4: Implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  TestRunId,
  TestSuiteId,
  TestCaseId,
  TestPhase,
} from '../types/test-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Log levels supported by E2E logger
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Log context for E2E tests
 */
export interface E2ELogContext {
  /** Test run ID */
  readonly runId?: TestRunId;
  /** Test suite ID */
  readonly suiteId?: TestSuiteId;
  /** Test case ID */
  readonly caseId?: TestCaseId;
  /** Test name */
  readonly testName?: string;
  /** Test file path */
  readonly testFile?: string;
  /** Current test phase */
  readonly phase?: TestPhase;
  /** Request ID for API calls */
  readonly requestId?: string;
  /** Operation being performed */
  readonly operation?: string;
  /** Additional custom context */
  readonly [key: string]: unknown;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  /** ISO timestamp */
  readonly timestamp: string;
  /** Log level */
  readonly level: LogLevel;
  /** Log message */
  readonly message: string;
  /** Log context */
  readonly context: E2ELogContext;
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Error details if applicable */
  readonly error?: LogEntryError;
}

/**
 * Error information in log entry
 */
export interface LogEntryError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
}

/**
 * Logger configuration
 */
export interface E2ELoggerConfig {
  /** Minimum log level to output */
  readonly level: LogLevel;
  /** Enable console output */
  readonly console: boolean;
  /** Enable file output */
  readonly file: boolean;
  /** Log file path (relative to project root or absolute) */
  readonly filePath: string;
  /** Use pretty format for console (vs JSON) */
  readonly pretty: boolean;
  /** Include timestamps in output */
  readonly timestamps: boolean;
  /** Include stack traces for errors */
  readonly stackTraces: boolean;
  /** Paths to redact in metadata */
  readonly redactPaths: ReadonlyArray<string>;
  /** Maximum log file size in bytes before rotation */
  readonly maxFileSize: number;
  /** Maximum number of log files to keep */
  readonly maxFiles: number;
}

/**
 * Log transport interface
 */
export interface ILogTransport {
  write(entry: LogEntry): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default logger configuration
 */
export const DEFAULT_E2E_LOGGER_CONFIG: E2ELoggerConfig = {
  level: (process.env.E2E_LOG_LEVEL as LogLevel) ?? 'info',
  console: process.env.E2E_LOG_CONSOLE !== 'false',
  file: process.env.E2E_LOG_FILE === 'true',
  filePath: process.env.E2E_LOG_PATH ?? './e2e/logs/e2e-tests.log',
  pretty: process.env.NODE_ENV === 'development' || process.env.E2E_LOG_PRETTY === 'true',
  timestamps: true,
  stackTraces: true,
  redactPaths: [
    'password',
    'token',
    'authorization',
    'apiKey',
    'api_key',
    'secret',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'cookie',
    'jwt',
    'bearer',
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
};

// ============================================================================
// Transports
// ============================================================================

/**
 * Console transport with pretty or JSON output
 */
class ConsoleTransport implements ILogTransport {
  constructor(
    private readonly pretty: boolean,
    private readonly timestamps: boolean
  ) {}

  write(entry: LogEntry): void {
    const output = this.pretty ? this.formatPretty(entry) : JSON.stringify(entry);
    const method = this.getConsoleMethod(entry.level);
    console[method](output);
  }

  async flush(): Promise<void> {
    // Console doesn't need flushing
  }

  async close(): Promise<void> {
    // Console doesn't need closing
  }

  private formatPretty(entry: LogEntry): string {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      silent: '',
    };
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';
    const bold = '\x1b[1m';

    const color = colors[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const timestamp = this.timestamps ? `${dim}[${entry.timestamp}]${reset} ` : '';
    const context = this.formatContext(entry.context);

    let output = `${timestamp}${color}${bold}${levelStr}${reset} ${context}${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n${dim}${JSON.stringify(entry.metadata, null, 2)}${reset}`;
    }

    if (entry.error) {
      output += `\n${color}Error: ${entry.error.message}${reset}`;
      if (entry.error.stack) {
        output += `\n${dim}${entry.error.stack}${reset}`;
      }
    }

    return output;
  }

  private formatContext(context: E2ELogContext): string {
    const parts: string[] = [];

    if (context.testName) {
      parts.push(`test:${context.testName}`);
    } else if (context.caseId) {
      parts.push(`case:${String(context.caseId).slice(0, 12)}`);
    }

    if (context.phase) {
      parts.push(`phase:${context.phase}`);
    }

    if (context.operation) {
      parts.push(`op:${context.operation}`);
    }

    if (context.requestId) {
      parts.push(`req:${context.requestId.slice(0, 8)}`);
    }

    return parts.length > 0 ? `[${parts.join(' ')}] ` : '';
  }

  private getConsoleMethod(level: LogLevel): 'log' | 'warn' | 'error' {
    switch (level) {
      case 'debug':
      case 'info':
        return 'log';
      case 'warn':
        return 'warn';
      case 'error':
        return 'error';
      default:
        return 'log';
    }
  }
}

/**
 * File transport with rotation support
 */
class FileTransport implements ILogTransport {
  private stream: fs.WriteStream | null = null;
  private currentSize = 0;
  private fileIndex = 0;
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly filePath: string,
    private readonly maxSize: number,
    private readonly maxFiles: number
  ) {
    this.ensureDirectory();
    this.openStream();

    // Flush buffer periodically
    this.flushTimer = setInterval(() => this.flush(), 1000);
  }

  write(entry: LogEntry): void {
    const line = JSON.stringify(entry) + '\n';
    this.buffer.push(line);

    // Flush immediately if buffer is large
    if (this.buffer.length >= 100) {
      this.flush().catch(console.error);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.stream) {
      return;
    }

    const lines = this.buffer.splice(0);
    const content = lines.join('');
    const contentSize = Buffer.byteLength(content);

    if (this.currentSize + contentSize > this.maxSize) {
      await this.rotate();
    }

    return new Promise((resolve, reject) => {
      if (!this.stream) {
        return resolve();
      }

      this.stream.write(content, (error) => {
        if (error) {
          // Re-add lines to buffer on failure
          this.buffer.unshift(...lines);
          reject(error);
        } else {
          this.currentSize += contentSize;
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();

    return new Promise((resolve) => {
      if (this.stream) {
        this.stream.end(resolve);
        this.stream = null;
      } else {
        resolve();
      }
    });
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private openStream(): void {
    const filename = this.getFilename();
    this.stream = fs.createWriteStream(filename, { flags: 'a' });

    // Get current file size
    try {
      const stats = fs.statSync(filename);
      this.currentSize = stats.size;
    } catch {
      this.currentSize = 0;
    }
  }

  private getFilename(): string {
    if (this.fileIndex === 0) {
      return this.filePath;
    }
    const ext = path.extname(this.filePath);
    const base = path.basename(this.filePath, ext);
    const dir = path.dirname(this.filePath);
    return path.join(dir, `${base}.${this.fileIndex}${ext}`);
  }

  private async rotate(): Promise<void> {
    await this.close();
    this.fileIndex = (this.fileIndex + 1) % this.maxFiles;
    this.currentSize = 0;

    // Delete old file if exists
    const newFilename = this.getFilename();
    if (fs.existsSync(newFilename)) {
      fs.unlinkSync(newFilename);
    }

    this.openStream();
  }
}

// ============================================================================
// E2E Logger Implementation
// ============================================================================

/**
 * E2E Test Logger interface
 */
export interface IE2ELogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;

  // Child logger with additional context
  child(context: Partial<E2ELogContext>): IE2ELogger;
  withContext(context: Partial<E2ELogContext>): IE2ELogger;

  // Test lifecycle logging
  testStarted(testName: string, caseId?: TestCaseId): void;
  testCompleted(testName: string, duration: number, status: 'passed' | 'failed' | 'skipped'): void;
  testFailed(testName: string, error: Error, duration: number): void;

  // Suite lifecycle logging
  suiteStarted(suiteName: string, suiteId?: TestSuiteId): void;
  suiteCompleted(suiteName: string, duration: number, passed: number, failed: number): void;

  // Run lifecycle logging
  runStarted(runId: TestRunId, totalSuites: number): void;
  runCompleted(runId: TestRunId, duration: number, passed: number, failed: number): void;

  // Request/response logging
  requestStarted(method: string, url: string, requestId?: string): void;
  requestCompleted(method: string, url: string, statusCode: number, duration: number): void;
  requestFailed(method: string, url: string, error: Error): void;

  // Fixture logging
  fixtureLoaded(fixtureId: string, duration: number): void;
  fixtureCleanedUp(fixtureId: string): void;

  // Database logging
  databaseSeeded(recordCount: number, duration: number): void;
  databaseCleaned(duration: number): void;

  // Performance logging
  performanceMetric(operation: string, duration: number, metadata?: Record<string, unknown>): void;

  // Utility
  flush(): Promise<void>;
  close(): Promise<void>;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

/**
 * E2E Test Logger implementation
 */
export class E2ELogger implements IE2ELogger {
  private readonly transports: ILogTransport[] = [];
  private level: LogLevel;
  private readonly context: E2ELogContext;
  private readonly redactPaths: Set<string>;
  private readonly stackTraces: boolean;

  constructor(
    config: Partial<E2ELoggerConfig> = {},
    context: E2ELogContext = {}
  ) {
    const mergedConfig = { ...DEFAULT_E2E_LOGGER_CONFIG, ...config };

    this.level = mergedConfig.level;
    this.context = context;
    this.redactPaths = new Set(mergedConfig.redactPaths.map(p => p.toLowerCase()));
    this.stackTraces = mergedConfig.stackTraces;

    // Initialize transports
    if (mergedConfig.console && mergedConfig.level !== 'silent') {
      this.transports.push(new ConsoleTransport(mergedConfig.pretty, mergedConfig.timestamps));
    }

    if (mergedConfig.file && mergedConfig.level !== 'silent') {
      this.transports.push(
        new FileTransport(mergedConfig.filePath, mergedConfig.maxFileSize, mergedConfig.maxFiles)
      );
    }
  }

  // ============================================================================
  // Core Logging Methods
  // ============================================================================

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata, error);
  }

  // ============================================================================
  // Child Logger
  // ============================================================================

  child(context: Partial<E2ELogContext>): IE2ELogger {
    return new E2ELoggerChild(this, { ...this.context, ...context });
  }

  withContext(context: Partial<E2ELogContext>): IE2ELogger {
    return this.child(context);
  }

  // ============================================================================
  // Test Lifecycle Logging
  // ============================================================================

  testStarted(testName: string, caseId?: TestCaseId): void {
    this.info('Test started', {
      event: 'test_started',
      testName,
      caseId,
    });
  }

  testCompleted(testName: string, duration: number, status: 'passed' | 'failed' | 'skipped'): void {
    const level = status === 'failed' ? 'error' : status === 'skipped' ? 'warn' : 'info';
    this.log(level, `Test ${status}`, {
      event: 'test_completed',
      testName,
      status,
      durationMs: duration,
    });
  }

  testFailed(testName: string, error: Error, duration: number): void {
    this.error(`Test failed: ${error.message}`, error, {
      event: 'test_failed',
      testName,
      durationMs: duration,
    });
  }

  // ============================================================================
  // Suite Lifecycle Logging
  // ============================================================================

  suiteStarted(suiteName: string, suiteId?: TestSuiteId): void {
    this.info('Suite started', {
      event: 'suite_started',
      suiteName,
      suiteId,
    });
  }

  suiteCompleted(suiteName: string, duration: number, passed: number, failed: number): void {
    const level = failed > 0 ? 'warn' : 'info';
    this.log(level, `Suite completed: ${passed} passed, ${failed} failed`, {
      event: 'suite_completed',
      suiteName,
      durationMs: duration,
      passed,
      failed,
      passRate: passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : '0',
    });
  }

  // ============================================================================
  // Run Lifecycle Logging
  // ============================================================================

  runStarted(runId: TestRunId, totalSuites: number): void {
    this.info('Test run started', {
      event: 'run_started',
      runId,
      totalSuites,
    });
  }

  runCompleted(runId: TestRunId, duration: number, passed: number, failed: number): void {
    const level = failed > 0 ? 'warn' : 'info';
    this.log(level, `Test run completed: ${passed} passed, ${failed} failed`, {
      event: 'run_completed',
      runId,
      durationMs: duration,
      passed,
      failed,
      passRate: passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : '0',
    });
  }

  // ============================================================================
  // Request/Response Logging
  // ============================================================================

  requestStarted(method: string, url: string, requestId?: string): void {
    this.debug(`${method} ${url}`, {
      event: 'request_started',
      method,
      url,
      requestId,
    });
  }

  requestCompleted(method: string, url: string, statusCode: number, duration: number): void {
    const level = statusCode >= 400 ? 'warn' : 'debug';
    this.log(level, `${method} ${url} - ${statusCode} (${duration}ms)`, {
      event: 'request_completed',
      method,
      url,
      statusCode,
      durationMs: duration,
    });
  }

  requestFailed(method: string, url: string, error: Error): void {
    this.error(`${method} ${url} - Failed`, error, {
      event: 'request_failed',
      method,
      url,
    });
  }

  // ============================================================================
  // Fixture Logging
  // ============================================================================

  fixtureLoaded(fixtureId: string, duration: number): void {
    this.debug(`Fixture loaded: ${fixtureId}`, {
      event: 'fixture_loaded',
      fixtureId,
      durationMs: duration,
    });
  }

  fixtureCleanedUp(fixtureId: string): void {
    this.debug(`Fixture cleaned up: ${fixtureId}`, {
      event: 'fixture_cleanup',
      fixtureId,
    });
  }

  // ============================================================================
  // Database Logging
  // ============================================================================

  databaseSeeded(recordCount: number, duration: number): void {
    this.info(`Database seeded: ${recordCount} records`, {
      event: 'database_seeded',
      recordCount,
      durationMs: duration,
    });
  }

  databaseCleaned(duration: number): void {
    this.debug('Database cleaned', {
      event: 'database_cleaned',
      durationMs: duration,
    });
  }

  // ============================================================================
  // Performance Logging
  // ============================================================================

  performanceMetric(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.debug(`Performance: ${operation} took ${duration}ms`, {
      event: 'performance_metric',
      operation,
      durationMs: duration,
      ...metadata,
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async flush(): Promise<void> {
    await Promise.all(this.transports.map(t => t.flush()));
  }

  async close(): Promise<void> {
    await this.flush();
    await Promise.all(this.transports.map(t => t.close()));
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata: metadata ? this.redactSensitiveData(metadata) : undefined,
      error: error ? this.serializeError(error) : undefined,
    };

    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (e) {
        // Fallback to console if transport fails
        console.error('Logger transport error:', e);
      }
    }
  }

  private redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const redacted = JSON.parse(JSON.stringify(data));
    this.redactObject(redacted);
    return redacted;
  }

  private redactObject(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();

      if (this.redactPaths.has(lowerKey) || this.containsSensitiveWord(lowerKey)) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.redactObject(obj[key] as Record<string, unknown>);
      }
    }
  }

  private containsSensitiveWord(key: string): boolean {
    for (const path of this.redactPaths) {
      if (key.includes(path)) {
        return true;
      }
    }
    return false;
  }

  private serializeError(error: Error): LogEntryError {
    return {
      name: error.name,
      message: error.message,
      stack: this.stackTraces ? error.stack : undefined,
      code: (error as { code?: string }).code,
    };
  }
}

/**
 * Child logger that delegates to parent
 */
class E2ELoggerChild implements IE2ELogger {
  constructor(
    private readonly parent: E2ELogger,
    private readonly context: E2ELogContext
  ) {}

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.parent.child(this.context).debug(message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.parent.child(this.context).info(message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.parent.child(this.context).warn(message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.parent.child(this.context).error(message, error, metadata);
  }

  child(additionalContext: Partial<E2ELogContext>): IE2ELogger {
    return new E2ELoggerChild(this.parent, { ...this.context, ...additionalContext });
  }

  withContext(context: Partial<E2ELogContext>): IE2ELogger {
    return this.child(context);
  }

  testStarted(testName: string, caseId?: TestCaseId): void {
    this.parent.child(this.context).testStarted(testName, caseId);
  }

  testCompleted(testName: string, duration: number, status: 'passed' | 'failed' | 'skipped'): void {
    this.parent.child(this.context).testCompleted(testName, duration, status);
  }

  testFailed(testName: string, error: Error, duration: number): void {
    this.parent.child(this.context).testFailed(testName, error, duration);
  }

  suiteStarted(suiteName: string, suiteId?: TestSuiteId): void {
    this.parent.child(this.context).suiteStarted(suiteName, suiteId);
  }

  suiteCompleted(suiteName: string, duration: number, passed: number, failed: number): void {
    this.parent.child(this.context).suiteCompleted(suiteName, duration, passed, failed);
  }

  runStarted(runId: TestRunId, totalSuites: number): void {
    this.parent.child(this.context).runStarted(runId, totalSuites);
  }

  runCompleted(runId: TestRunId, duration: number, passed: number, failed: number): void {
    this.parent.child(this.context).runCompleted(runId, duration, passed, failed);
  }

  requestStarted(method: string, url: string, requestId?: string): void {
    this.parent.child(this.context).requestStarted(method, url, requestId);
  }

  requestCompleted(method: string, url: string, statusCode: number, duration: number): void {
    this.parent.child(this.context).requestCompleted(method, url, statusCode, duration);
  }

  requestFailed(method: string, url: string, error: Error): void {
    this.parent.child(this.context).requestFailed(method, url, error);
  }

  fixtureLoaded(fixtureId: string, duration: number): void {
    this.parent.child(this.context).fixtureLoaded(fixtureId, duration);
  }

  fixtureCleanedUp(fixtureId: string): void {
    this.parent.child(this.context).fixtureCleanedUp(fixtureId);
  }

  databaseSeeded(recordCount: number, duration: number): void {
    this.parent.child(this.context).databaseSeeded(recordCount, duration);
  }

  databaseCleaned(duration: number): void {
    this.parent.child(this.context).databaseCleaned(duration);
  }

  performanceMetric(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.parent.child(this.context).performanceMetric(operation, duration, metadata);
  }

  async flush(): Promise<void> {
    await this.parent.flush();
  }

  async close(): Promise<void> {
    await this.parent.close();
  }

  setLevel(level: LogLevel): void {
    this.parent.setLevel(level);
  }

  getLevel(): LogLevel {
    return this.parent.getLevel();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Global logger instance
 */
let globalLogger: E2ELogger | null = null;

/**
 * Create a new E2E logger
 */
export function createE2ELogger(
  config?: Partial<E2ELoggerConfig>,
  context?: E2ELogContext
): IE2ELogger {
  return new E2ELogger(config, context);
}

/**
 * Get the global E2E logger instance
 */
export function getE2ELogger(): IE2ELogger {
  if (!globalLogger) {
    globalLogger = new E2ELogger();
  }
  return globalLogger;
}

/**
 * Initialize the global E2E logger
 */
export function initE2ELogger(
  config?: Partial<E2ELoggerConfig>,
  context?: E2ELogContext
): IE2ELogger {
  globalLogger = new E2ELogger(config, context);
  return globalLogger;
}

/**
 * Reset the global E2E logger (for testing)
 */
export function resetE2ELogger(): void {
  if (globalLogger) {
    globalLogger.close().catch(console.error);
  }
  globalLogger = null;
}

/**
 * Create a test-scoped logger
 */
export function createTestLogger(
  testName: string,
  testFile: string,
  caseId?: TestCaseId
): IE2ELogger {
  return getE2ELogger().child({
    testName,
    testFile,
    caseId,
  });
}

/**
 * Create a suite-scoped logger
 */
export function createSuiteLogger(suiteName: string, suiteId?: TestSuiteId): IE2ELogger {
  return getE2ELogger().child({
    operation: `suite:${suiteName}`,
    suiteId,
  });
}

/**
 * Create a run-scoped logger
 */
export function createRunLogger(runId: TestRunId): IE2ELogger {
  return getE2ELogger().child({
    runId,
    operation: 'test-run',
  });
}

/**
 * Wrap an async function with performance logging
 */
export async function withLogging<T>(
  logger: IE2ELogger,
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.performanceMetric(operation, duration, { ...metadata, status: 'success' });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.performanceMetric(operation, duration, { ...metadata, status: 'error' });
    throw error;
  }
}
