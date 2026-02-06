/**
 * GitHub Actions Expression Parser
 * @module parsers/github-actions/expression-parser
 *
 * Parses and extracts ${{ }} expressions from GitHub Actions workflow files.
 * Provides detailed context reference extraction and expression classification.
 *
 * TASK-XREF-001: GitHub Actions Parser - Expression Extraction
 */

import { SourceLocation } from '../terraform/types';
import {
  GhaExpression,
  GhaExpressionType,
  GhaExpressionContext,
  GhaContextReference,
  GhaFunctionCall,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Pattern to match GitHub Actions expressions: ${{ ... }}
 * Uses non-greedy matching to handle nested braces correctly
 */
const EXPRESSION_PATTERN = /\$\{\{\s*([\s\S]*?)\s*\}\}/g;

/**
 * All known GitHub Actions expression contexts
 */
const KNOWN_CONTEXTS: readonly GhaExpressionContext[] = [
  'github',
  'env',
  'vars',
  'job',
  'jobs',
  'steps',
  'runner',
  'secrets',
  'strategy',
  'matrix',
  'needs',
  'inputs',
] as const;

/**
 * GitHub Actions built-in functions
 */
const KNOWN_FUNCTIONS: readonly string[] = [
  'contains',
  'startsWith',
  'endsWith',
  'format',
  'join',
  'toJSON',
  'fromJSON',
  'hashFiles',
  'success',
  'always',
  'cancelled',
  'failure',
] as const;

/**
 * Status check functions that take no arguments
 */
const STATUS_FUNCTIONS: readonly string[] = [
  'success',
  'always',
  'cancelled',
  'failure',
] as const;

// ============================================================================
// GhaExpressionParser Class
// ============================================================================

/**
 * Parser for extracting and analyzing GitHub Actions expressions.
 *
 * Extracts ${{ }} expressions from workflow content and provides:
 * - Expression categorization (context, function, literal, comparison, etc.)
 * - Context reference extraction (secrets.*, needs.*.outputs.*, etc.)
 * - Function call detection
 * - Source location tracking
 *
 * @example
 * ```typescript
 * const parser = new GhaExpressionParser();
 * const expressions = parser.extractExpressions(workflowContent, 'workflow.yml');
 *
 * for (const expr of expressions) {
 *   console.log(`Found ${expr.type} expression: ${expr.body}`);
 *   for (const ref of expr.contextReferences) {
 *     console.log(`  References: ${ref.fullPath}`);
 *   }
 * }
 * ```
 */
export class GhaExpressionParser {
  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Extract all expressions from workflow content
   *
   * @param content - The workflow file content to parse
   * @param filePath - Optional file path for source location tracking
   * @returns Array of parsed expressions with full metadata
   *
   * @example
   * ```typescript
   * const parser = new GhaExpressionParser();
   * const expressions = parser.extractExpressions(content, '.github/workflows/ci.yml');
   * ```
   */
  extractExpressions(content: string, filePath: string = ''): GhaExpression[] {
    const expressions: GhaExpression[] = [];

    // Reset regex state for each call
    const regex = new RegExp(EXPRESSION_PATTERN.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const raw = match[0];
      const body = match[1].trim();
      const matchIndex = match.index;

      // Calculate location
      const location = this.calculateLocation(content, matchIndex, raw.length, filePath);

      // Analyze the expression
      const type = this.categorizeExpression(body);
      const context = this.extractPrimaryContext(body);
      const functionName = this.extractPrimaryFunction(body);
      const references = this.extractSimpleReferences(body);
      const contextReferences = this.extractContextReferences(body);
      const functions = this.extractFunctionCalls(body);

      expressions.push({
        raw,
        content: body,
        body,
        type,
        location,
        context,
        function: functionName,
        references,
        contextReferences,
        functions,
      });
    }

    return expressions;
  }

  /**
   * Categorize an expression body by its type
   *
   * @param body - The expression body (without ${{ }})
   * @returns The expression type classification
   *
   * @example
   * ```typescript
   * parser.categorizeExpression('github.event.inputs.name'); // 'context'
   * parser.categorizeExpression('contains(github.event.labels.*.name, "bug")'); // 'function'
   * parser.categorizeExpression('github.event_name == "push"'); // 'comparison'
   * ```
   */
  categorizeExpression(body: string): GhaExpressionType {
    const trimmed = body.trim();

    // Check for literal values
    if (this.isLiteral(trimmed)) {
      return 'literal';
    }

    // Check for logical operators (&&, ||)
    if (this.hasLogicalOperators(trimmed)) {
      // Could be ternary pattern: condition && 'value1' || 'value2'
      if (this.isTernaryPattern(trimmed)) {
        return 'ternary';
      }
      return 'logical';
    }

    // Check for comparison operators
    if (this.hasComparisonOperators(trimmed)) {
      return 'comparison';
    }

    // Check if it's a function call
    if (this.startsWithFunction(trimmed)) {
      return 'function';
    }

    // Check if it's a simple context access
    if (this.isSimpleContextAccess(trimmed)) {
      return 'context';
    }

    // Complex or mixed expression
    return 'mixed';
  }

  /**
   * Extract context references from an expression body
   *
   * @param body - The expression body (without ${{ }})
   * @returns Array of context references with position information
   *
   * @example
   * ```typescript
   * const refs = parser.extractContextReferences('needs.build.outputs.version');
   * // Returns: [{ context: 'needs', path: ['build', 'outputs', 'version'], ... }]
   * ```
   */
  extractContextReferences(body: string): GhaContextReference[] {
    const references: GhaContextReference[] = [];

    // Pattern for context.path.access (including array indexing)
    // Matches: github.event.inputs.name, needs.build.outputs['key'], steps.step1.outputs.result
    const contextPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_.*'-\[\]]+))+/g;

    let match: RegExpExecArray | null;
    while ((match = contextPattern.exec(body)) !== null) {
      const fullPath = match[0];
      const context = match[1];

      if (this.isKnownContext(context)) {
        // Parse the path, handling array notation
        const pathParts = this.parsePath(fullPath);
        const pathWithoutContext = pathParts.slice(1);

        references.push({
          context: context as GhaExpressionContext,
          path: pathWithoutContext,
          fullPath,
          position: {
            start: match.index,
            end: match.index + fullPath.length,
          },
        });
      }
    }

    return references;
  }

  /**
   * Extract function calls from an expression body
   *
   * @param body - The expression body (without ${{ }})
   * @returns Array of function calls with arguments and position
   *
   * @example
   * ```typescript
   * const funcs = parser.extractFunctionCalls('contains(github.event.labels.*.name, "bug")');
   * // Returns: [{ name: 'contains', arguments: ['github.event.labels.*.name', '"bug"'], ... }]
   * ```
   */
  extractFunctionCalls(body: string): GhaFunctionCall[] {
    const functions: GhaFunctionCall[] = [];

    // Match function calls with their arguments
    const functionPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;

    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(body)) !== null) {
      const name = match[1];
      const startPos = match.index;
      const argsStart = match.index + match[0].length;

      // Find the matching closing parenthesis
      const argsEnd = this.findMatchingParen(body, argsStart - 1);
      if (argsEnd === -1) continue;

      const argsString = body.substring(argsStart, argsEnd);
      const args = this.parseArguments(argsString);

      functions.push({
        name,
        arguments: args,
        position: {
          start: startPos,
          end: argsEnd + 1,
        },
      });
    }

    return functions;
  }

  // ==========================================================================
  // Helper Methods - Expression Classification
  // ==========================================================================

  /**
   * Check if expression body is a literal value
   */
  private isLiteral(body: string): boolean {
    // Boolean literals
    if (body === 'true' || body === 'false') {
      return true;
    }

    // Null literal
    if (body === 'null') {
      return true;
    }

    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(body)) {
      return true;
    }

    // String literal (single or double quotes)
    if (/^(['"]).*\1$/.test(body)) {
      return true;
    }

    return false;
  }

  /**
   * Check if expression has logical operators (&& or ||)
   */
  private hasLogicalOperators(body: string): boolean {
    // Avoid matching inside strings
    return this.containsOutsideStrings(body, /&&|\|\|/);
  }

  /**
   * Check if expression has comparison operators
   */
  private hasComparisonOperators(body: string): boolean {
    return this.containsOutsideStrings(body, /[!=<>]=?/);
  }

  /**
   * Check if expression matches ternary pattern: condition && 'value1' || 'value2'
   */
  private isTernaryPattern(body: string): boolean {
    // Simple heuristic: has both && and || with literals on the right side
    const hasAnd = body.includes('&&');
    const hasOr = body.includes('||');

    if (!hasAnd || !hasOr) return false;

    // Check if there's a string literal after || (common ternary pattern)
    const orIndex = body.lastIndexOf('||');
    const afterOr = body.substring(orIndex + 2).trim();

    return /^['"]/.test(afterOr) || afterOr === 'true' || afterOr === 'false';
  }

  /**
   * Check if expression starts with a function call
   */
  private startsWithFunction(body: string): boolean {
    // Check for known functions
    for (const fn of KNOWN_FUNCTIONS) {
      if (body.startsWith(fn + '(')) {
        return true;
      }
    }

    // Check for any function pattern at start
    return /^[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(body);
  }

  /**
   * Check if expression is a simple context access (no operators, no functions)
   */
  private isSimpleContextAccess(body: string): boolean {
    // Pattern for simple context access: context.path.to.value
    const simplePattern = /^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_*][a-zA-Z0-9_.*'-\[\]]*)*$/;
    return simplePattern.test(body);
  }

  /**
   * Check if a pattern exists outside of string literals
   */
  private containsOutsideStrings(body: string, pattern: RegExp): boolean {
    // Remove string literals from consideration
    const withoutStrings = body.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
    return pattern.test(withoutStrings);
  }

  // ==========================================================================
  // Helper Methods - Context and Reference Extraction
  // ==========================================================================

  /**
   * Extract the primary context from an expression
   */
  private extractPrimaryContext(body: string): GhaExpressionContext | undefined {
    for (const ctx of KNOWN_CONTEXTS) {
      if (body.startsWith(ctx + '.') || body.startsWith(ctx + '[')) {
        return ctx;
      }
    }
    return undefined;
  }

  /**
   * Extract the primary function name from an expression
   */
  private extractPrimaryFunction(body: string): string | undefined {
    const match = body.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract simple string references (for backward compatibility)
   */
  private extractSimpleReferences(body: string): readonly string[] {
    const refs: string[] = [];
    const contextPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_.*'-\[\]]+))+/g;

    let match: RegExpExecArray | null;
    while ((match = contextPattern.exec(body)) !== null) {
      const context = match[1];
      if (this.isKnownContext(context)) {
        refs.push(match[0]);
      }
    }

    return refs;
  }

  /**
   * Check if a string is a known GitHub Actions context
   */
  private isKnownContext(context: string): boolean {
    return KNOWN_CONTEXTS.includes(context as GhaExpressionContext);
  }

  /**
   * Parse a dotted path into parts, handling array notation
   */
  private parsePath(fullPath: string): readonly string[] {
    const parts: string[] = [];
    let current = '';
    let inBracket = false;

    for (let i = 0; i < fullPath.length; i++) {
      const char = fullPath[i];

      if (char === '[') {
        if (current) {
          parts.push(current);
          current = '';
        }
        inBracket = true;
      } else if (char === ']') {
        if (current) {
          parts.push(current);
          current = '';
        }
        inBracket = false;
      } else if (char === '.' && !inBracket) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else if (char !== "'" && char !== '"') {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  // ==========================================================================
  // Helper Methods - Function Parsing
  // ==========================================================================

  /**
   * Find the matching closing parenthesis
   */
  private findMatchingParen(body: string, openIndex: number): number {
    let depth = 1;
    let inString = false;
    let stringChar = '';

    for (let i = openIndex + 1; i < body.length; i++) {
      const char = body[i];

      if (inString) {
        if (char === stringChar && body[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * Parse function arguments from argument string
   */
  private parseArguments(argsString: string): readonly string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];

      if (inString) {
        current += char;
        if (char === stringChar && argsString[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '(' || char === '[') {
        depth++;
        current += char;
      } else if (char === ')' || char === ']') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) {
          args.push(trimmed);
        }
        current = '';
      } else {
        current += char;
      }
    }

    const trimmed = current.trim();
    if (trimmed) {
      args.push(trimmed);
    }

    return args;
  }

  // ==========================================================================
  // Helper Methods - Location Calculation
  // ==========================================================================

  /**
   * Calculate source location for an expression
   */
  private calculateLocation(
    content: string,
    matchIndex: number,
    matchLength: number,
    filePath: string
  ): SourceLocation {
    const beforeMatch = content.substring(0, matchIndex);
    const lines = beforeMatch.split('\n');
    const lineStart = lines.length;

    const lastNewlineIndex = beforeMatch.lastIndexOf('\n');
    const columnStart = matchIndex - lastNewlineIndex;

    // Calculate end position
    const matchContent = content.substring(matchIndex, matchIndex + matchLength);
    const matchLines = matchContent.split('\n');
    const lineEnd = lineStart + matchLines.length - 1;

    let columnEnd: number;
    if (matchLines.length === 1) {
      columnEnd = columnStart + matchLength;
    } else {
      columnEnd = matchLines[matchLines.length - 1].length + 1;
    }

    return {
      file: filePath,
      lineStart,
      lineEnd,
      columnStart,
      columnEnd,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new GhaExpressionParser instance
 *
 * @returns A new expression parser instance
 *
 * @example
 * ```typescript
 * const parser = createExpressionParser();
 * const expressions = parser.extractExpressions(content, 'workflow.yml');
 * ```
 */
export function createExpressionParser(): GhaExpressionParser {
  return new GhaExpressionParser();
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Extract expressions from content using a singleton parser
 *
 * @param content - The workflow content to parse
 * @param filePath - Optional file path for location tracking
 * @returns Array of parsed expressions
 *
 * @example
 * ```typescript
 * const expressions = extractExpressionsFromContent(workflowYaml, 'ci.yml');
 * ```
 */
export function extractExpressionsFromContent(
  content: string,
  filePath: string = ''
): GhaExpression[] {
  const parser = new GhaExpressionParser();
  return parser.extractExpressions(content, filePath);
}

/**
 * Check if a string contains GitHub Actions expressions
 *
 * @param value - The string to check
 * @returns True if the string contains ${{ }} expressions
 *
 * @example
 * ```typescript
 * hasExpressions('Hello ${{ github.actor }}'); // true
 * hasExpressions('Hello world'); // false
 * ```
 */
export function hasExpressions(value: string): boolean {
  return EXPRESSION_PATTERN.test(value);
}

/**
 * Count the number of expressions in a string
 *
 * @param value - The string to check
 * @returns The number of ${{ }} expressions found
 *
 * @example
 * ```typescript
 * countExpressions('${{ a }} and ${{ b }}'); // 2
 * ```
 */
export function countExpressions(value: string): number {
  const regex = new RegExp(EXPRESSION_PATTERN.source, 'g');
  let count = 0;
  while (regex.exec(value) !== null) {
    count++;
  }
  return count;
}

// ============================================================================
// Type Re-exports for Convenience
// ============================================================================

export type {
  GhaExpression,
  GhaExpressionType,
  GhaExpressionContext,
  GhaContextReference,
  GhaFunctionCall,
};
