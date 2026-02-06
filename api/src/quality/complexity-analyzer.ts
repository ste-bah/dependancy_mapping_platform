/**
 * Code Complexity Analyzer
 * @module quality/complexity-analyzer
 *
 * Calculates cyclomatic complexity, cognitive complexity, and other
 * maintainability metrics for TypeScript/JavaScript code.
 *
 * Implements industry-standard metrics:
 * - Cyclomatic Complexity (McCabe, 1976)
 * - Cognitive Complexity (SonarSource)
 * - Halstead Metrics
 * - Maintainability Index (Microsoft)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Comprehensive complexity metrics for a code unit
 */
export interface ComplexityMetrics {
  /** McCabe's cyclomatic complexity */
  cyclomaticComplexity: number;
  /** SonarSource cognitive complexity */
  cognitiveComplexity: number;
  /** Lines of code (non-empty, non-comment) */
  linesOfCode: number;
  /** Microsoft's Maintainability Index (0-100) */
  maintainabilityIndex: number;
  /** Halstead program volume */
  halsteadVolume: number;
  /** Halstead difficulty */
  halsteadDifficulty: number;
  /** Halstead effort */
  halsteadEffort: number;
}

/**
 * Complexity report for a single file
 */
export interface FileComplexityReport {
  /** File path */
  filePath: string;
  /** Functions/methods analyzed */
  functions: FunctionComplexity[];
  /** Aggregate metrics for the file */
  aggregateMetrics: ComplexityMetrics;
  /** Complexity violations found */
  violations: ComplexityViolation[];
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Complexity metrics for a single function
 */
export interface FunctionComplexity {
  /** Function name */
  name: string;
  /** Starting line number */
  lineStart: number;
  /** Ending line number */
  lineEnd: number;
  /** Function metrics */
  metrics: ComplexityMetrics;
  /** Whether this function exceeds thresholds */
  exceedsThreshold: boolean;
}

/**
 * A complexity threshold violation
 */
export interface ComplexityViolation {
  /** Type of violation */
  type: 'cyclomatic' | 'cognitive' | 'loc' | 'maintainability';
  /** Function name where violation occurred */
  function: string;
  /** Actual value */
  actual: number;
  /** Threshold exceeded */
  threshold: number;
  /** Severity of violation */
  severity: 'warning' | 'error';
  /** Suggested remediation */
  suggestion: string;
}

/**
 * Parsed function data
 */
interface ParsedFunction {
  name: string;
  body: string;
  lineStart: number;
  lineEnd: number;
  parameterCount: number;
}

/**
 * Halstead metrics breakdown
 */
interface HalsteadMetrics {
  operators: Set<string>;
  operands: Set<string>;
  totalOperators: number;
  totalOperands: number;
  vocabulary: number;
  programLength: number;
  volume: number;
  difficulty: number;
  effort: number;
}

// ============================================================================
// Thresholds Configuration
// ============================================================================

/**
 * Complexity thresholds for warnings and errors
 */
export const COMPLEXITY_THRESHOLDS = {
  cyclomaticComplexity: {
    warning: 10,
    error: 15,
  },
  cognitiveComplexity: {
    warning: 15,
    error: 25,
  },
  linesOfCode: {
    warning: 50,
    error: 100,
  },
  maintainabilityIndex: {
    warning: 65, // Below this is a warning
    error: 50,   // Below this is an error
  },
} as const;

// ============================================================================
// Complexity Analyzer Implementation
// ============================================================================

/**
 * Analyzes code complexity metrics for TypeScript/JavaScript files
 */
export class ComplexityAnalyzer {
  private readonly thresholds: typeof COMPLEXITY_THRESHOLDS;

  constructor(thresholds?: Partial<typeof COMPLEXITY_THRESHOLDS>) {
    this.thresholds = {
      cyclomaticComplexity: {
        ...COMPLEXITY_THRESHOLDS.cyclomaticComplexity,
        ...thresholds?.cyclomaticComplexity,
      },
      cognitiveComplexity: {
        ...COMPLEXITY_THRESHOLDS.cognitiveComplexity,
        ...thresholds?.cognitiveComplexity,
      },
      linesOfCode: {
        ...COMPLEXITY_THRESHOLDS.linesOfCode,
        ...thresholds?.linesOfCode,
      },
      maintainabilityIndex: {
        ...COMPLEXITY_THRESHOLDS.maintainabilityIndex,
        ...thresholds?.maintainabilityIndex,
      },
    };
  }

  /**
   * Analyze a source file and return complexity metrics
   */
  analyze(sourceCode: string, filePath: string): FileComplexityReport {
    const functions = this.extractFunctions(sourceCode);
    const functionMetrics = functions.map(fn => this.analyzeFunction(fn));

    const violations = this.checkViolations(functionMetrics);
    const aggregateMetrics = this.aggregateMetrics(functionMetrics);

    return {
      filePath,
      functions: functionMetrics,
      aggregateMetrics,
      violations,
      analyzedAt: new Date(),
    };
  }

  /**
   * Analyze multiple files and return combined report
   */
  analyzeMultiple(
    files: Array<{ path: string; content: string }>
  ): FileComplexityReport[] {
    return files.map(file => this.analyze(file.content, file.path));
  }

  /**
   * Get summary statistics across multiple reports
   */
  getSummary(reports: FileComplexityReport[]): {
    totalFiles: number;
    totalFunctions: number;
    totalViolations: number;
    averageComplexity: number;
    averageMaintainability: number;
    highComplexityFunctions: FunctionComplexity[];
  } {
    const allFunctions = reports.flatMap(r => r.functions);
    const allViolations = reports.flatMap(r => r.violations);

    const totalCyclomatic = allFunctions.reduce(
      (sum, fn) => sum + fn.metrics.cyclomaticComplexity,
      0
    );

    const totalMaintainability = allFunctions.reduce(
      (sum, fn) => sum + fn.metrics.maintainabilityIndex,
      0
    );

    const highComplexityFunctions = allFunctions
      .filter(fn => fn.metrics.cyclomaticComplexity > this.thresholds.cyclomaticComplexity.warning)
      .sort((a, b) => b.metrics.cyclomaticComplexity - a.metrics.cyclomaticComplexity);

    return {
      totalFiles: reports.length,
      totalFunctions: allFunctions.length,
      totalViolations: allViolations.length,
      averageComplexity: allFunctions.length > 0 ? totalCyclomatic / allFunctions.length : 0,
      averageMaintainability: allFunctions.length > 0 ? totalMaintainability / allFunctions.length : 0,
      highComplexityFunctions: highComplexityFunctions.slice(0, 10),
    };
  }

  // ============================================================================
  // Private Methods - Function Extraction
  // ============================================================================

  /**
   * Extract functions from source code
   */
  private extractFunctions(sourceCode: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];
    const lines = sourceCode.split('\n');

    // Pattern to match various function declarations
    const functionPatterns = [
      // Regular function: function name(...)
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
      // Arrow function: const name = (...) =>
      /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>/,
      // Method: name(...) { or async name(...) {
      /^\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/,
      // Class method with modifiers
      /^\s*(?:public|private|protected)?\s*(?:static)?\s*(?:async)?\s*(\w+)\s*\(([^)]*)\)/,
    ];

    let currentFunction: { name: string; startLine: number; params: string } | null = null;
    let braceCount = 0;
    let functionBody: string[] = [];
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmedLine = line.trim();

      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        if (inFunction) {
          functionBody.push(line);
        }
        continue;
      }

      // Check for function start if not in a function
      if (!inFunction) {
        for (const pattern of functionPatterns) {
          const match = line.match(pattern);
          if (match?.[1]) {
            currentFunction = {
              name: match[1],
              startLine: i + 1,
              params: match[2] ?? '',
            };
            braceCount = 0;
            functionBody = [line];
            inFunction = true;
            break;
          }
        }
      }

      if (inFunction) {
        if (!functionBody.includes(line)) {
          functionBody.push(line);
        }

        // Count braces to find function end
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        // Function ends when braces balance
        if (braceCount === 0 && functionBody.length > 0 && line.includes('}')) {
          if (currentFunction) {
            const paramCount = currentFunction.params
              ? currentFunction.params.split(',').filter(p => p.trim()).length
              : 0;

            functions.push({
              name: currentFunction.name,
              body: functionBody.join('\n'),
              lineStart: currentFunction.startLine,
              lineEnd: i + 1,
              parameterCount: paramCount,
            });
          }
          currentFunction = null;
          functionBody = [];
          inFunction = false;
        }
      }
    }

    return functions;
  }

  // ============================================================================
  // Private Methods - Metrics Calculation
  // ============================================================================

  /**
   * Analyze a single function
   */
  private analyzeFunction(fn: ParsedFunction): FunctionComplexity {
    const cyclomatic = this.calculateCyclomaticComplexity(fn.body);
    const cognitive = this.calculateCognitiveComplexity(fn.body);
    const loc = this.calculateLinesOfCode(fn.body);
    const halstead = this.calculateHalsteadMetrics(fn.body);
    const maintainability = this.calculateMaintainabilityIndex(cyclomatic, halstead.volume, loc);

    const metrics: ComplexityMetrics = {
      cyclomaticComplexity: cyclomatic,
      cognitiveComplexity: cognitive,
      linesOfCode: loc,
      maintainabilityIndex: maintainability,
      halsteadVolume: halstead.volume,
      halsteadDifficulty: halstead.difficulty,
      halsteadEffort: halstead.effort,
    };

    const exceedsThreshold =
      cyclomatic > this.thresholds.cyclomaticComplexity.warning ||
      cognitive > this.thresholds.cognitiveComplexity.warning ||
      loc > this.thresholds.linesOfCode.warning ||
      maintainability < this.thresholds.maintainabilityIndex.warning;

    return {
      name: fn.name,
      lineStart: fn.lineStart,
      lineEnd: fn.lineEnd,
      metrics,
      exceedsThreshold,
    };
  }

  /**
   * Calculate McCabe's Cyclomatic Complexity
   * CC = E - N + 2P (simplified: 1 + decision points)
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Decision point patterns
    const decisionPatterns = [
      { pattern: /\bif\s*\(/g, weight: 1 },
      { pattern: /\belse\s+if\s*\(/g, weight: 1 },
      { pattern: /\bfor\s*\(/g, weight: 1 },
      { pattern: /\bwhile\s*\(/g, weight: 1 },
      { pattern: /\bdo\s*\{/g, weight: 1 },
      { pattern: /\bcase\s+[^:]+:/g, weight: 1 },
      { pattern: /\bdefault\s*:/g, weight: 0 }, // default doesn't add complexity
      { pattern: /\bcatch\s*\(/g, weight: 1 },
      { pattern: /\?\?/g, weight: 1 }, // Nullish coalescing
      { pattern: /\?\./g, weight: 1 }, // Optional chaining
      { pattern: /&&(?!=)/g, weight: 1 }, // Logical AND (not &&=)
      { pattern: /\|\|(?!=)/g, weight: 1 }, // Logical OR (not ||=)
      { pattern: /\?[^?:]/g, weight: 1 }, // Ternary (not ??)
    ];

    for (const { pattern, weight } of decisionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length * weight;
      }
    }

    return complexity;
  }

  /**
   * Calculate Cognitive Complexity (SonarSource methodology)
   * Accounts for nesting depth and cognitive burden
   */
  private calculateCognitiveComplexity(code: string): number {
    let complexity = 0;
    let nestingLevel = 0;
    const lines = code.split('\n');

    const controlStructures = /\b(if|else\s+if|for|while|switch|do)\s*[\({]/;
    const catchClause = /\bcatch\s*\(/;
    const elseClause = /\belse\s*\{/;
    const logicalOperators = /&&|\|\|/g;
    const ternaryOperator = /\?[^?:]*:/g;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) {
        continue;
      }

      // Control structures add (1 + nesting level)
      if (controlStructures.test(trimmed)) {
        complexity += 1 + nestingLevel;
        nestingLevel++;
      }

      // Catch adds complexity without nesting penalty
      if (catchClause.test(trimmed)) {
        complexity += 1;
      }

      // Else without if adds 1 (but else if is counted above)
      if (elseClause.test(trimmed) && !/else\s+if/.test(trimmed)) {
        complexity += 1;
      }

      // Logical operators add 1 each (within conditions)
      const logicalMatches = trimmed.match(logicalOperators);
      if (logicalMatches) {
        complexity += logicalMatches.length;
      }

      // Ternary operators add 1 each
      const ternaryMatches = trimmed.match(ternaryOperator);
      if (ternaryMatches) {
        complexity += ternaryMatches.length;
      }

      // Track nesting level
      const opens = (trimmed.match(/\{/g) ?? []).length;
      const closes = (trimmed.match(/\}/g) ?? []).length;
      nestingLevel = Math.max(0, nestingLevel + opens - closes);
    }

    return complexity;
  }

  /**
   * Calculate non-empty, non-comment lines of code
   */
  private calculateLinesOfCode(code: string): number {
    const lines = code.split('\n');
    let loc = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Handle block comments
      if (trimmed.startsWith('/*')) {
        inBlockComment = true;
      }
      if (trimmed.includes('*/')) {
        inBlockComment = false;
        continue;
      }

      if (inBlockComment) {
        continue;
      }

      // Skip empty lines and single-line comments
      if (trimmed && !trimmed.startsWith('//')) {
        loc++;
      }
    }

    return loc;
  }

  /**
   * Calculate Halstead complexity metrics
   */
  private calculateHalsteadMetrics(code: string): HalsteadMetrics {
    const operators = new Set<string>();
    const operands = new Set<string>();
    let totalOperators = 0;
    let totalOperands = 0;

    // Keywords that are operators
    const keywords = new Set([
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally',
      'new', 'delete', 'typeof', 'instanceof', 'in', 'void',
      'function', 'class', 'extends', 'const', 'let', 'var',
      'async', 'await', 'yield', 'import', 'export', 'from',
    ]);

    // Operator patterns
    const operatorPattern = /[+\-*/%=<>!&|^~?:]+|\.{3}|\.|\[|\]|\(|\)|,|;|\{|\}/g;
    const identifierPattern = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
    const numberPattern = /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi;
    const stringPattern = /'[^']*'|"[^"]*"|`[^`]*`/g;

    // Extract operators
    let match;
    while ((match = operatorPattern.exec(code)) !== null) {
      operators.add(match[0]);
      totalOperators++;
    }

    // Extract identifiers and keywords
    while ((match = identifierPattern.exec(code)) !== null) {
      if (keywords.has(match[0])) {
        operators.add(match[0]);
        totalOperators++;
      } else {
        operands.add(match[0]);
        totalOperands++;
      }
    }

    // Extract numbers
    while ((match = numberPattern.exec(code)) !== null) {
      operands.add(match[0]);
      totalOperands++;
    }

    // Extract strings
    while ((match = stringPattern.exec(code)) !== null) {
      operands.add(match[0]);
      totalOperands++;
    }

    const n1 = operators.size; // Unique operators
    const n2 = operands.size;  // Unique operands
    const N1 = totalOperators; // Total operators
    const N2 = totalOperands;  // Total operands

    const vocabulary = n1 + n2;
    const programLength = N1 + N2;
    const volume = programLength * Math.log2(vocabulary || 1);
    const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
    const effort = volume * difficulty;

    return {
      operators,
      operands,
      totalOperators,
      totalOperands,
      vocabulary,
      programLength,
      volume,
      difficulty,
      effort,
    };
  }

  /**
   * Calculate Microsoft's Maintainability Index
   * MI = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC)
   * Normalized to 0-100 scale
   */
  private calculateMaintainabilityIndex(
    cyclomaticComplexity: number,
    halsteadVolume: number,
    linesOfCode: number
  ): number {
    const volume = Math.max(1, halsteadVolume);
    const loc = Math.max(1, linesOfCode);

    const mi = 171 -
      5.2 * Math.log(volume) -
      0.23 * cyclomaticComplexity -
      16.2 * Math.log(loc);

    // Normalize to 0-100 and clamp
    return Math.max(0, Math.min(100, mi));
  }

  // ============================================================================
  // Private Methods - Aggregation & Validation
  // ============================================================================

  /**
   * Check for threshold violations
   */
  private checkViolations(functions: FunctionComplexity[]): ComplexityViolation[] {
    const violations: ComplexityViolation[] = [];

    for (const fn of functions) {
      const { metrics } = fn;

      // Cyclomatic complexity
      if (metrics.cyclomaticComplexity >= this.thresholds.cyclomaticComplexity.error) {
        violations.push({
          type: 'cyclomatic',
          function: fn.name,
          actual: metrics.cyclomaticComplexity,
          threshold: this.thresholds.cyclomaticComplexity.error,
          severity: 'error',
          suggestion: 'Extract complex conditionals into separate functions or use early returns',
        });
      } else if (metrics.cyclomaticComplexity >= this.thresholds.cyclomaticComplexity.warning) {
        violations.push({
          type: 'cyclomatic',
          function: fn.name,
          actual: metrics.cyclomaticComplexity,
          threshold: this.thresholds.cyclomaticComplexity.warning,
          severity: 'warning',
          suggestion: 'Consider simplifying conditional logic or extracting helper functions',
        });
      }

      // Cognitive complexity
      if (metrics.cognitiveComplexity >= this.thresholds.cognitiveComplexity.error) {
        violations.push({
          type: 'cognitive',
          function: fn.name,
          actual: metrics.cognitiveComplexity,
          threshold: this.thresholds.cognitiveComplexity.error,
          severity: 'error',
          suggestion: 'Reduce nesting depth and break into smaller, focused functions',
        });
      } else if (metrics.cognitiveComplexity >= this.thresholds.cognitiveComplexity.warning) {
        violations.push({
          type: 'cognitive',
          function: fn.name,
          actual: metrics.cognitiveComplexity,
          threshold: this.thresholds.cognitiveComplexity.warning,
          severity: 'warning',
          suggestion: 'Consider reducing nested control structures',
        });
      }

      // Lines of code
      if (metrics.linesOfCode >= this.thresholds.linesOfCode.error) {
        violations.push({
          type: 'loc',
          function: fn.name,
          actual: metrics.linesOfCode,
          threshold: this.thresholds.linesOfCode.error,
          severity: 'error',
          suggestion: 'Break function into smaller, single-responsibility functions',
        });
      } else if (metrics.linesOfCode >= this.thresholds.linesOfCode.warning) {
        violations.push({
          type: 'loc',
          function: fn.name,
          actual: metrics.linesOfCode,
          threshold: this.thresholds.linesOfCode.warning,
          severity: 'warning',
          suggestion: 'Consider extracting logical sections into helper functions',
        });
      }

      // Maintainability (lower is worse)
      if (metrics.maintainabilityIndex <= this.thresholds.maintainabilityIndex.error) {
        violations.push({
          type: 'maintainability',
          function: fn.name,
          actual: Math.round(metrics.maintainabilityIndex),
          threshold: this.thresholds.maintainabilityIndex.error,
          severity: 'error',
          suggestion: 'Function has very low maintainability. Refactor to reduce complexity and size.',
        });
      } else if (metrics.maintainabilityIndex <= this.thresholds.maintainabilityIndex.warning) {
        violations.push({
          type: 'maintainability',
          function: fn.name,
          actual: Math.round(metrics.maintainabilityIndex),
          threshold: this.thresholds.maintainabilityIndex.warning,
          severity: 'warning',
          suggestion: 'Maintainability could be improved by simplifying the function',
        });
      }
    }

    return violations;
  }

  /**
   * Aggregate metrics from multiple functions
   */
  private aggregateMetrics(functions: FunctionComplexity[]): ComplexityMetrics {
    if (functions.length === 0) {
      return {
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        linesOfCode: 0,
        maintainabilityIndex: 100,
        halsteadVolume: 0,
        halsteadDifficulty: 0,
        halsteadEffort: 0,
      };
    }

    const totals = functions.reduce(
      (acc, fn) => ({
        cyclomatic: acc.cyclomatic + fn.metrics.cyclomaticComplexity,
        cognitive: acc.cognitive + fn.metrics.cognitiveComplexity,
        loc: acc.loc + fn.metrics.linesOfCode,
        volume: acc.volume + fn.metrics.halsteadVolume,
        difficulty: acc.difficulty + fn.metrics.halsteadDifficulty,
        effort: acc.effort + fn.metrics.halsteadEffort,
        maintainability: acc.maintainability + fn.metrics.maintainabilityIndex,
      }),
      { cyclomatic: 0, cognitive: 0, loc: 0, volume: 0, difficulty: 0, effort: 0, maintainability: 0 }
    );

    const count = functions.length;

    return {
      cyclomaticComplexity: totals.cyclomatic,
      cognitiveComplexity: totals.cognitive,
      linesOfCode: totals.loc,
      maintainabilityIndex: totals.maintainability / count,
      halsteadVolume: totals.volume,
      halsteadDifficulty: totals.difficulty / count,
      halsteadEffort: totals.effort,
    };
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

/**
 * Default complexity analyzer instance
 */
export const complexityAnalyzer = new ComplexityAnalyzer();

/**
 * Create a new complexity analyzer with custom thresholds
 */
export function createComplexityAnalyzer(
  thresholds?: Partial<typeof COMPLEXITY_THRESHOLDS>
): ComplexityAnalyzer {
  return new ComplexityAnalyzer(thresholds);
}

export default ComplexityAnalyzer;
