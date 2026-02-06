/**
 * Terragrunt Function Parser
 * @module parsers/terragrunt/function-parser
 *
 * TASK-TG-001: Parse and validate Terragrunt-specific functions
 *
 * Handles the 27 Terragrunt built-in functions with proper validation
 * of argument counts and types. Composes with ExpressionParser for
 * standard HCL expressions.
 */

import {
  HCLExpression,
  HCLFunctionExpression,
  HCLReferenceExpression,
} from '../terraform/types';
import {
  ExpressionParser,
  ExtractedReference,
  extractReferences,
} from '../terraform/expression-parser';
import {
  TERRAGRUNT_FUNCTIONS,
  TERRAGRUNT_FUNCTION_NAMES,
  TerragruntFunctionDef,
  TerragruntParseError,
  getTerragruntFunctionDef,
} from './types';

// ============================================================================
// Function Parse Result Types
// ============================================================================

/**
 * Result of parsing a Terragrunt function call
 */
export interface FunctionParseResult {
  /** The parsed function expression */
  readonly expression: HCLFunctionExpression;
  /** Whether this is a Terragrunt-specific function */
  readonly isTerragruntFunction: boolean;
  /** Function definition if Terragrunt function */
  readonly functionDef: TerragruntFunctionDef | null;
  /** Validation errors */
  readonly errors: readonly TerragruntParseError[];
  /** References extracted from arguments */
  readonly references: readonly ExtractedReference[];
}

/**
 * Terragrunt function call information
 */
export interface TerragruntFunctionCall {
  /** Function name */
  readonly name: string;
  /** Function definition */
  readonly def: TerragruntFunctionDef | null;
  /** Parsed arguments */
  readonly args: readonly HCLExpression[];
  /** Raw argument strings */
  readonly rawArgs: readonly string[];
  /** Whether call is valid */
  readonly isValid: boolean;
  /** Validation errors */
  readonly errors: readonly string[];
}

// ============================================================================
// Function Parser Class
// ============================================================================

/**
 * Parser for Terragrunt function calls.
 * Validates function names, argument counts, and extracts references.
 *
 * @example
 * ```typescript
 * const parser = new TerragruntFunctionParser();
 * const result = parser.parseFunctionCall('find_in_parent_folders("terragrunt.hcl")');
 * console.log(result.isTerragruntFunction); // true
 * ```
 */
export class TerragruntFunctionParser {
  private readonly expressionParser: ExpressionParser;
  private readonly strictMode: boolean;

  constructor(options: { strictMode?: boolean; includeRaw?: boolean } = {}) {
    this.strictMode = options.strictMode ?? false;
    this.expressionParser = new ExpressionParser({
      includeRaw: options.includeRaw ?? true,
      useCache: true,
    });
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Parse a function call expression
   */
  parseFunctionCall(input: string): FunctionParseResult {
    const expression = this.expressionParser.parse(input);

    if (expression.type !== 'function') {
      return {
        expression: this.createEmptyFunction(input),
        isTerragruntFunction: false,
        functionDef: null,
        errors: [{
          message: `Expected function call, got ${expression.type}`,
          location: null,
          severity: 'error',
          code: 'SYNTAX_ERROR',
        }],
        references: [],
      };
    }

    const funcExpr = expression as HCLFunctionExpression;
    const isTerragrunt = TERRAGRUNT_FUNCTION_NAMES.has(funcExpr.name);
    const funcDef = getTerragruntFunctionDef(funcExpr.name) ?? null;
    const errors: TerragruntParseError[] = [];

    // Validate argument count for Terragrunt functions
    if (isTerragrunt && funcDef) {
      const argCount = funcExpr.args.length;
      const validationErrors = this.validateArgumentCount(funcDef, argCount);
      errors.push(...validationErrors);
    } else if (this.strictMode && !isTerragrunt) {
      // In strict mode, warn about unknown functions that look like Terragrunt functions
      if (this.looksLikeTerragruntFunction(funcExpr.name)) {
        errors.push({
          message: `Unknown function '${funcExpr.name}' - did you mean one of: ${this.getSimilarFunctions(funcExpr.name).join(', ')}?`,
          location: null,
          severity: 'warning',
          code: 'UNKNOWN_FUNCTION',
        });
      }
    }

    // Extract references from arguments
    const references = this.extractFunctionReferences(funcExpr);

    return {
      expression: funcExpr,
      isTerragruntFunction: isTerragrunt,
      functionDef: funcDef,
      errors,
      references,
    };
  }

  /**
   * Parse an expression and extract all Terragrunt function calls
   */
  extractFunctionCalls(input: string): readonly TerragruntFunctionCall[] {
    const expression = this.expressionParser.parse(input);
    const calls: TerragruntFunctionCall[] = [];
    this.walkForFunctions(expression, calls);
    return calls;
  }

  /**
   * Validate a function call
   */
  validateFunction(
    name: string,
    args: readonly HCLExpression[]
  ): readonly TerragruntParseError[] {
    const errors: TerragruntParseError[] = [];
    const funcDef = getTerragruntFunctionDef(name);

    if (!funcDef) {
      if (TERRAGRUNT_FUNCTION_NAMES.has(name)) {
        // Should not happen, but defensive check
        return errors;
      }
      if (this.looksLikeTerragruntFunction(name)) {
        errors.push({
          message: `Unknown Terragrunt function '${name}'`,
          location: null,
          severity: 'warning',
          code: 'UNKNOWN_FUNCTION',
        });
      }
      return errors;
    }

    // Validate argument count
    errors.push(...this.validateArgumentCount(funcDef, args.length));

    return errors;
  }

  /**
   * Get list of all Terragrunt function names
   */
  getTerragruntFunctionNames(): readonly string[] {
    return TERRAGRUNT_FUNCTIONS.map(f => f.name);
  }

  /**
   * Check if a name is a Terragrunt function
   */
  isTerragruntFunction(name: string): boolean {
    return TERRAGRUNT_FUNCTION_NAMES.has(name);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate argument count against function definition
   */
  private validateArgumentCount(
    funcDef: TerragruntFunctionDef,
    argCount: number
  ): TerragruntParseError[] {
    const errors: TerragruntParseError[] = [];

    if (argCount < funcDef.minArgs) {
      errors.push({
        message: `Function '${funcDef.name}' requires at least ${funcDef.minArgs} argument(s), got ${argCount}`,
        location: null,
        severity: 'error',
        code: 'INVALID_FUNCTION_ARGS',
      });
    }

    if (funcDef.maxArgs >= 0 && argCount > funcDef.maxArgs) {
      errors.push({
        message: `Function '${funcDef.name}' accepts at most ${funcDef.maxArgs} argument(s), got ${argCount}`,
        location: null,
        severity: 'error',
        code: 'INVALID_FUNCTION_ARGS',
      });
    }

    return errors;
  }

  /**
   * Extract references from function arguments
   */
  private extractFunctionReferences(funcExpr: HCLFunctionExpression): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    for (const arg of funcExpr.args) {
      references.push(...extractReferences(arg));
    }

    return references;
  }

  /**
   * Walk an expression tree and collect function calls
   */
  private walkForFunctions(
    expr: HCLExpression,
    calls: TerragruntFunctionCall[]
  ): void {
    switch (expr.type) {
      case 'function': {
        const funcDef = getTerragruntFunctionDef(expr.name);
        const errors: string[] = [];

        if (funcDef) {
          const validationErrors = this.validateArgumentCount(funcDef, expr.args.length);
          errors.push(...validationErrors.map(e => e.message));
        }

        calls.push({
          name: expr.name,
          def: funcDef ?? null,
          args: expr.args,
          rawArgs: expr.args.map(a => a.raw),
          isValid: funcDef ? errors.length === 0 : true,
          errors,
        });

        // Recursively check arguments for nested function calls
        for (const arg of expr.args) {
          this.walkForFunctions(arg, calls);
        }
        break;
      }

      case 'template':
        for (const part of expr.parts) {
          if (typeof part !== 'string') {
            this.walkForFunctions(part, calls);
          }
        }
        break;

      case 'for':
        this.walkForFunctions(expr.collection, calls);
        this.walkForFunctions(expr.valueExpr, calls);
        if (expr.keyExpr) this.walkForFunctions(expr.keyExpr, calls);
        if (expr.condition) this.walkForFunctions(expr.condition, calls);
        break;

      case 'conditional':
        this.walkForFunctions(expr.condition, calls);
        this.walkForFunctions(expr.trueResult, calls);
        this.walkForFunctions(expr.falseResult, calls);
        break;

      case 'index':
        this.walkForFunctions(expr.collection, calls);
        this.walkForFunctions(expr.key, calls);
        break;

      case 'splat':
        this.walkForFunctions(expr.source, calls);
        if (expr.each) this.walkForFunctions(expr.each, calls);
        break;

      case 'object':
        for (const value of Object.values(expr.attributes)) {
          this.walkForFunctions(value, calls);
        }
        break;

      case 'array':
        for (const element of expr.elements) {
          this.walkForFunctions(element, calls);
        }
        break;
    }
  }

  /**
   * Check if a function name looks like a Terragrunt function
   */
  private looksLikeTerragruntFunction(name: string): boolean {
    // Common Terragrunt function prefixes
    const prefixes = ['get_', 'find_', 'path_', 'read_', 'sops_', 'run_', 'parse_', 'render_', 'mark_'];
    return prefixes.some(p => name.startsWith(p));
  }

  /**
   * Find similar function names for suggestions
   */
  private getSimilarFunctions(name: string): string[] {
    const similar: string[] = [];
    const nameLower = name.toLowerCase();

    for (const func of TERRAGRUNT_FUNCTIONS) {
      // Check for common prefix
      if (func.name.startsWith(nameLower.slice(0, 4))) {
        similar.push(func.name);
      }
      // Check for Levenshtein distance <= 3
      else if (this.levenshteinDistance(nameLower, func.name) <= 3) {
        similar.push(func.name);
      }
    }

    return similar.slice(0, 3);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Create an empty function expression for error cases
   */
  private createEmptyFunction(raw: string): HCLFunctionExpression {
    return {
      type: 'function',
      name: '',
      args: [],
      raw,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an expression contains any Terragrunt function calls
 */
export function containsTerragruntFunctions(expr: HCLExpression): boolean {
  const parser = new TerragruntFunctionParser();
  const calls = parser.extractFunctionCalls(expr.raw);
  return calls.some(c => c.def !== null);
}

/**
 * Get all Terragrunt function calls from an expression
 */
export function getTerragruntFunctionCalls(
  expr: HCLExpression
): readonly TerragruntFunctionCall[] {
  const parser = new TerragruntFunctionParser();
  return parser.extractFunctionCalls(expr.raw).filter(c => c.def !== null);
}

/**
 * Validate all function calls in an expression
 */
export function validateFunctionCalls(
  expr: HCLExpression
): readonly TerragruntParseError[] {
  const parser = new TerragruntFunctionParser({ strictMode: true });
  const result = parser.parseFunctionCall(expr.raw);
  return result.errors;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new function parser with default options
 */
export function createFunctionParser(
  options?: { strictMode?: boolean; includeRaw?: boolean }
): TerragruntFunctionParser {
  return new TerragruntFunctionParser(options);
}
