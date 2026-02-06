/**
 * Terragrunt Parser Error Reporter
 * @module parsers/terragrunt/errors/reporter
 *
 * User-friendly error reporting for Terragrunt HCL parsing:
 * - Formatted error messages with source context
 * - Error summaries and statistics
 * - Multiple output formats (text, JSON, SARIF)
 * - IDE-friendly location formatting
 *
 * TASK-TG-001: Error reporting for Terragrunt HCL parsing
 */

import {
  TerragruntParseError,
  LexerError,
  BlockParseError,
  IncludeResolutionError,
  DependencyResolutionError,
  FunctionParseError,
  ValidationError,
  SerializedTerragruntError,
} from './errors';
import { TerragruntErrorSeverity } from './error-codes';

// ============================================================================
// Reporter Options
// ============================================================================

/**
 * Configuration for error reporting
 */
export interface ReporterOptions {
  /** Include source code snippets (default: true) */
  includeSourceSnippets: boolean;
  /** Number of context lines in snippets (default: 2) */
  contextLines: number;
  /** Include suggestions (default: true) */
  includeSuggestions: boolean;
  /** Include error codes (default: true) */
  includeErrorCodes: boolean;
  /** Use colors in output (default: true for terminals) */
  useColors: boolean;
  /** Maximum errors to report (default: 50) */
  maxErrors: number;
  /** Sort errors by location (default: true) */
  sortByLocation: boolean;
  /** Group errors by category (default: false) */
  groupByCategory: boolean;
  /** Output format */
  format: 'text' | 'json' | 'sarif' | 'github';
}

/**
 * Default reporter options
 */
export const DEFAULT_REPORTER_OPTIONS: ReporterOptions = {
  includeSourceSnippets: true,
  contextLines: 2,
  includeSuggestions: true,
  includeErrorCodes: true,
  useColors: typeof process !== 'undefined' && process.stdout?.isTTY,
  maxErrors: 50,
  sortByLocation: true,
  groupByCategory: false,
  format: 'text',
};

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  underline: '\x1b[4m',
};

/**
 * Color a string if colors are enabled
 */
function colorize(text: string, color: keyof typeof colors, useColors: boolean): string {
  if (!useColors) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Get color for severity
 */
function severityColor(severity: TerragruntErrorSeverity): keyof typeof colors {
  switch (severity) {
    case TerragruntErrorSeverity.FATAL:
    case TerragruntErrorSeverity.ERROR:
      return 'red';
    case TerragruntErrorSeverity.WARNING:
      return 'yellow';
    case TerragruntErrorSeverity.INFO:
      return 'cyan';
    default:
      return 'reset';
  }
}

// ============================================================================
// Report Structures
// ============================================================================

/**
 * Summary statistics for errors
 */
export interface ErrorSummary {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<TerragruntErrorSeverity, number>;
  byCategory: Record<string, number>;
  files: string[];
}

/**
 * Full error report
 */
export interface ErrorReport {
  /** Report generation timestamp */
  timestamp: Date;
  /** Summary statistics */
  summary: ErrorSummary;
  /** Formatted errors */
  errors: FormattedError[];
  /** Source file if single file */
  sourceFile?: string;
  /** Source content if available */
  sourceContent?: string;
}

/**
 * Formatted error for display
 */
export interface FormattedError {
  /** Original error */
  error: TerragruntParseError;
  /** Formatted message */
  message: string;
  /** Source snippet if available */
  snippet?: string;
  /** Location string (file:line:col) */
  locationString?: string;
  /** Category (lexer, syntax, block, etc.) */
  category: string;
}

// ============================================================================
// Error Reporter Class
// ============================================================================

/**
 * Reports Terragrunt parsing errors in various formats.
 *
 * @example
 * ```typescript
 * const reporter = new ErrorReporter({ useColors: true });
 * const report = reporter.createReport(errors, source);
 * console.log(reporter.formatText(report));
 * ```
 */
export class ErrorReporter {
  private readonly options: ReporterOptions;

  constructor(options: Partial<ReporterOptions> = {}) {
    this.options = { ...DEFAULT_REPORTER_OPTIONS, ...options };
  }

  // ==========================================================================
  // Report Generation
  // ==========================================================================

  /**
   * Create a full error report
   */
  createReport(
    errors: readonly TerragruntParseError[],
    sourceContent?: string,
    sourceFile?: string
  ): ErrorReport {
    let processedErrors = [...errors];

    // Sort by location if enabled
    if (this.options.sortByLocation) {
      processedErrors.sort((a, b) => {
        if (!a.location && !b.location) return 0;
        if (!a.location) return 1;
        if (!b.location) return -1;
        if (a.location.lineStart !== b.location.lineStart) {
          return a.location.lineStart - b.location.lineStart;
        }
        return a.location.columnStart - b.location.columnStart;
      });
    }

    // Limit errors
    if (processedErrors.length > this.options.maxErrors) {
      processedErrors = processedErrors.slice(0, this.options.maxErrors);
    }

    // Format errors
    const formattedErrors = processedErrors.map(error =>
      this.formatError(error, sourceContent)
    );

    // Create summary
    const summary = this.createSummary(errors);

    return {
      timestamp: new Date(),
      summary,
      errors: formattedErrors,
      sourceFile,
      sourceContent,
    };
  }

  /**
   * Create error summary statistics
   */
  private createSummary(errors: readonly TerragruntParseError[]): ErrorSummary {
    const byType: Record<string, number> = {};
    const bySeverity: Record<TerragruntErrorSeverity, number> = {
      [TerragruntErrorSeverity.INFO]: 0,
      [TerragruntErrorSeverity.WARNING]: 0,
      [TerragruntErrorSeverity.ERROR]: 0,
      [TerragruntErrorSeverity.FATAL]: 0,
    };
    const byCategory: Record<string, number> = {};
    const files = new Set<string>();

    for (const error of errors) {
      // By type
      byType[error.name] = (byType[error.name] ?? 0) + 1;

      // By severity
      bySeverity[error.severity]++;

      // By category
      const category = this.getErrorCategory(error);
      byCategory[category] = (byCategory[category] ?? 0) + 1;

      // Files
      if (error.location?.file) {
        files.add(error.location.file);
      }
    }

    return {
      total: errors.length,
      byType,
      bySeverity,
      byCategory,
      files: Array.from(files),
    };
  }

  /**
   * Format a single error
   */
  private formatError(
    error: TerragruntParseError,
    sourceContent?: string
  ): FormattedError {
    const parts: string[] = [];

    // Severity and error code
    const severityStr = error.severity.toUpperCase();
    if (this.options.includeErrorCodes) {
      parts.push(`[${error.code}]`);
    }
    parts.push(severityStr + ':');

    // Message
    parts.push(error.message);

    // Location
    let locationString: string | undefined;
    if (error.location) {
      locationString = `${error.location.file}:${error.location.lineStart}:${error.location.columnStart}`;
    }

    // Suggestion
    if (this.options.includeSuggestions && error.suggestion) {
      parts.push(`\n  Suggestion: ${error.suggestion}`);
    }

    // Source snippet
    let snippet: string | undefined;
    if (this.options.includeSourceSnippets && sourceContent && error.location) {
      snippet = error.toSourceSnippet(sourceContent, this.options.contextLines);
    }

    return {
      error,
      message: parts.join(' '),
      snippet,
      locationString,
      category: this.getErrorCategory(error),
    };
  }

  /**
   * Get error category from error instance
   */
  private getErrorCategory(error: TerragruntParseError): string {
    if (error instanceof LexerError) return 'lexer';
    if (error instanceof BlockParseError) return 'block';
    if (error instanceof IncludeResolutionError) return 'include';
    if (error instanceof DependencyResolutionError) return 'dependency';
    if (error instanceof FunctionParseError) return 'function';
    if (error instanceof ValidationError) return 'validation';
    return 'syntax';
  }

  // ==========================================================================
  // Output Formatters
  // ==========================================================================

  /**
   * Format report as plain text
   */
  formatText(report: ErrorReport): string {
    const lines: string[] = [];
    const useColors = this.options.useColors;

    // Header
    if (report.sourceFile) {
      lines.push(colorize(`Parsing errors in ${report.sourceFile}:`, 'bold', useColors));
    } else {
      lines.push(colorize('Parsing errors:', 'bold', useColors));
    }
    lines.push('');

    // Group by category if enabled
    if (this.options.groupByCategory) {
      return this.formatTextGrouped(report, lines);
    }

    // Format each error
    for (let i = 0; i < report.errors.length; i++) {
      const formatted = report.errors[i];
      const error = formatted.error;
      const color = severityColor(error.severity);

      // Error header
      const header = formatted.locationString
        ? `${formatted.locationString} - ${formatted.message}`
        : formatted.message;

      lines.push(colorize(`${i + 1}. ${header}`, color, useColors));

      // Source snippet
      if (formatted.snippet) {
        lines.push('');
        lines.push(colorize(formatted.snippet, 'gray', useColors));
      }

      lines.push('');
    }

    // Summary
    lines.push(this.formatSummary(report.summary, useColors));

    // Truncation notice
    if (report.summary.total > this.options.maxErrors) {
      lines.push('');
      lines.push(colorize(
        `... and ${report.summary.total - this.options.maxErrors} more errors`,
        'gray',
        useColors
      ));
    }

    return lines.join('\n');
  }

  /**
   * Format text output grouped by category
   */
  private formatTextGrouped(report: ErrorReport, lines: string[]): string {
    const useColors = this.options.useColors;
    const byCategory = new Map<string, FormattedError[]>();

    for (const formatted of report.errors) {
      const category = formatted.category;
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(formatted);
    }

    for (const [category, errors] of byCategory) {
      lines.push(colorize(`=== ${category.toUpperCase()} ERRORS (${errors.length}) ===`, 'bold', useColors));
      lines.push('');

      for (const formatted of errors) {
        const error = formatted.error;
        const color = severityColor(error.severity);
        const header = formatted.locationString
          ? `${formatted.locationString} - ${formatted.message}`
          : formatted.message;

        lines.push(colorize(`  ${header}`, color, useColors));
        if (formatted.snippet) {
          lines.push(colorize(formatted.snippet.split('\n').map(l => '  ' + l).join('\n'), 'gray', useColors));
        }
        lines.push('');
      }
    }

    lines.push(this.formatSummary(report.summary, useColors));

    return lines.join('\n');
  }

  /**
   * Format summary section
   */
  private formatSummary(summary: ErrorSummary, useColors: boolean): string {
    const parts: string[] = [];

    parts.push(colorize('Summary:', 'bold', useColors));

    const severityParts: string[] = [];
    if (summary.bySeverity[TerragruntErrorSeverity.FATAL] > 0) {
      severityParts.push(colorize(
        `${summary.bySeverity[TerragruntErrorSeverity.FATAL]} fatal`,
        'red',
        useColors
      ));
    }
    if (summary.bySeverity[TerragruntErrorSeverity.ERROR] > 0) {
      severityParts.push(colorize(
        `${summary.bySeverity[TerragruntErrorSeverity.ERROR]} errors`,
        'red',
        useColors
      ));
    }
    if (summary.bySeverity[TerragruntErrorSeverity.WARNING] > 0) {
      severityParts.push(colorize(
        `${summary.bySeverity[TerragruntErrorSeverity.WARNING]} warnings`,
        'yellow',
        useColors
      ));
    }

    parts.push(`  ${summary.total} total problems: ${severityParts.join(', ')}`);

    if (summary.files.length > 1) {
      parts.push(`  Across ${summary.files.length} files`);
    }

    return parts.join('\n');
  }

  /**
   * Format report as JSON
   */
  formatJSON(report: ErrorReport): string {
    return JSON.stringify({
      timestamp: report.timestamp.toISOString(),
      summary: report.summary,
      errors: report.errors.map(f => f.error.toJSON()),
    }, null, 2);
  }

  /**
   * Format report as SARIF (Static Analysis Results Interchange Format)
   */
  formatSARIF(report: ErrorReport): string {
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'terragrunt-parser',
            version: '1.0.0',
            informationUri: 'https://github.com/example/terragrunt-parser',
            rules: this.getSARIFRules(report),
          },
        },
        results: report.errors.map((f, index) => this.toSARIFResult(f, index)),
      }],
    };

    return JSON.stringify(sarif, null, 2);
  }

  /**
   * Get SARIF rules from errors
   */
  private getSARIFRules(report: ErrorReport): object[] {
    const seenCodes = new Set<string>();
    const rules: object[] = [];

    for (const formatted of report.errors) {
      const error = formatted.error;
      if (!seenCodes.has(error.code)) {
        seenCodes.add(error.code);
        rules.push({
          id: error.code,
          name: error.code,
          shortDescription: { text: error.message },
          helpUri: `https://docs.example.com/errors/${error.code}`,
          defaultConfiguration: {
            level: this.severityToSARIFLevel(error.severity),
          },
        });
      }
    }

    return rules;
  }

  /**
   * Convert error to SARIF result
   */
  private toSARIFResult(formatted: FormattedError, index: number): object {
    const error = formatted.error;

    const result: Record<string, unknown> = {
      ruleId: error.code,
      level: this.severityToSARIFLevel(error.severity),
      message: { text: error.message },
    };

    if (error.location) {
      result.locations = [{
        physicalLocation: {
          artifactLocation: { uri: error.location.file },
          region: {
            startLine: error.location.lineStart,
            startColumn: error.location.columnStart,
            endLine: error.location.lineEnd,
            endColumn: error.location.columnEnd,
          },
        },
      }];
    }

    return result;
  }

  /**
   * Convert severity to SARIF level
   */
  private severityToSARIFLevel(severity: TerragruntErrorSeverity): string {
    switch (severity) {
      case TerragruntErrorSeverity.FATAL:
      case TerragruntErrorSeverity.ERROR:
        return 'error';
      case TerragruntErrorSeverity.WARNING:
        return 'warning';
      case TerragruntErrorSeverity.INFO:
        return 'note';
      default:
        return 'none';
    }
  }

  /**
   * Format report for GitHub Actions annotations
   */
  formatGitHub(report: ErrorReport): string {
    const lines: string[] = [];

    for (const formatted of report.errors) {
      const error = formatted.error;
      const level = error.severity === TerragruntErrorSeverity.WARNING ? 'warning' : 'error';

      if (error.location) {
        lines.push(
          `::${level} file=${error.location.file},line=${error.location.lineStart},col=${error.location.columnStart}::${error.message}`
        );
      } else {
        lines.push(`::${level}::${error.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format report using configured format
   */
  format(report: ErrorReport): string {
    switch (this.options.format) {
      case 'json':
        return this.formatJSON(report);
      case 'sarif':
        return this.formatSARIF(report);
      case 'github':
        return this.formatGitHub(report);
      case 'text':
      default:
        return this.formatText(report);
    }
  }

  // ==========================================================================
  // Quick Reporting Functions
  // ==========================================================================

  /**
   * Print errors directly to console
   */
  printErrors(
    errors: readonly TerragruntParseError[],
    sourceContent?: string,
    sourceFile?: string
  ): void {
    const report = this.createReport(errors, sourceContent, sourceFile);
    console.error(this.formatText(report));
  }

  /**
   * Format a single error as a string
   */
  formatSingleError(
    error: TerragruntParseError,
    sourceContent?: string
  ): string {
    const formatted = this.formatError(error, sourceContent);
    const parts: string[] = [];
    const useColors = this.options.useColors;
    const color = severityColor(error.severity);

    parts.push(colorize(formatted.message, color, useColors));

    if (formatted.locationString) {
      parts.push(colorize(`  at ${formatted.locationString}`, 'gray', useColors));
    }

    if (formatted.snippet) {
      parts.push('');
      parts.push(colorize(formatted.snippet, 'gray', useColors));
    }

    return parts.join('\n');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an error reporter with options
 */
export function createReporter(options?: Partial<ReporterOptions>): ErrorReporter {
  return new ErrorReporter(options);
}

/**
 * Quick format errors as text
 */
export function formatErrors(
  errors: readonly TerragruntParseError[],
  sourceContent?: string,
  options?: Partial<ReporterOptions>
): string {
  const reporter = new ErrorReporter(options);
  const report = reporter.createReport(errors, sourceContent);
  return reporter.format(report);
}

/**
 * Format a single error
 */
export function formatError(
  error: TerragruntParseError,
  sourceContent?: string,
  options?: Partial<ReporterOptions>
): string {
  const reporter = new ErrorReporter(options);
  return reporter.formatSingleError(error, sourceContent);
}

/**
 * Print errors to console
 */
export function printErrors(
  errors: readonly TerragruntParseError[],
  sourceContent?: string,
  sourceFile?: string,
  options?: Partial<ReporterOptions>
): void {
  const reporter = new ErrorReporter(options);
  reporter.printErrors(errors, sourceContent, sourceFile);
}
