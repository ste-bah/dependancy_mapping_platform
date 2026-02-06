/**
 * Dead Code Detector
 * @module quality/dead-code-detector
 *
 * Identifies unused exports, unreachable code, and redundant patterns
 * in TypeScript/JavaScript codebases. Helps reduce technical debt
 * by finding code that can be safely removed.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Complete dead code analysis report
 */
export interface DeadCodeReport {
  /** Exports that are never imported */
  unusedExports: UnusedExport[];
  /** Code that can never be executed */
  unreachableCode: UnreachableCode[];
  /** Redundant or obsolete patterns */
  redundantPatterns: RedundantPattern[];
  /** Unused variables within functions */
  unusedVariables: UnusedVariable[];
  /** Summary statistics */
  summary: DeadCodeSummary;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * An export that is never imported elsewhere
 */
export interface UnusedExport {
  /** File containing the export */
  filePath: string;
  /** Name of the exported item */
  exportName: string;
  /** Type of export */
  exportType: 'function' | 'class' | 'const' | 'let' | 'type' | 'interface' | 'enum' | 'default';
  /** Line number of export */
  lineNumber: number;
  /** Whether it's re-exported from an index file */
  reExportedFrom?: string;
  /** Confidence that this is truly unused (0-100) */
  confidence: number;
}

/**
 * Code that can never be executed
 */
export interface UnreachableCode {
  /** File path */
  filePath: string;
  /** Starting line */
  lineStart: number;
  /** Ending line */
  lineEnd: number;
  /** Reason the code is unreachable */
  reason: string;
  /** Type of unreachability */
  type: 'after_return' | 'after_throw' | 'dead_branch' | 'unreferenced';
  /** The unreachable code snippet */
  codeSnippet: string;
}

/**
 * Redundant code pattern that should be simplified
 */
export interface RedundantPattern {
  /** File path */
  filePath: string;
  /** Line number */
  lineNumber: number;
  /** Pattern description */
  pattern: string;
  /** What was found */
  found: string;
  /** Suggested replacement */
  suggestion: string;
  /** Category of redundancy */
  category: 'operator' | 'comparison' | 'null_check' | 'constructor' | 'async' | 'other';
}

/**
 * Unused variable within a function/module
 */
export interface UnusedVariable {
  /** File path */
  filePath: string;
  /** Variable name */
  name: string;
  /** Line where declared */
  lineNumber: number;
  /** Type of declaration */
  declarationType: 'const' | 'let' | 'var' | 'parameter' | 'destructured';
}

/**
 * Summary of dead code analysis
 */
export interface DeadCodeSummary {
  /** Total issues found */
  totalIssues: number;
  /** Issues by category */
  byCategory: {
    unusedExports: number;
    unreachableCode: number;
    redundantPatterns: number;
    unusedVariables: number;
  };
  /** Estimated hours to clean up */
  estimatedDebtHours: number;
  /** Files with most issues */
  topFiles: Array<{ path: string; issueCount: number }>;
}

/**
 * File content for analysis
 */
interface AnalyzedFile {
  path: string;
  content: string;
  lines: string[];
}

// ============================================================================
// Redundant Pattern Definitions
// ============================================================================

/**
 * Patterns that indicate redundant code
 */
const REDUNDANT_PATTERNS = [
  {
    regex: /!!([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    pattern: 'Double negation coercion',
    category: 'operator' as const,
    suggestion: 'Use Boolean() for explicit conversion: Boolean($1)',
  },
  {
    regex: /===\s*true\b/g,
    pattern: 'Explicit true comparison',
    category: 'comparison' as const,
    suggestion: 'Remove === true, the condition is already boolean',
  },
  {
    regex: /===\s*false\b/g,
    pattern: 'Explicit false comparison',
    category: 'comparison' as const,
    suggestion: 'Use negation operator instead: !expression',
  },
  {
    regex: /!==\s*undefined\s*&&\s*\w+\s*!==\s*null/g,
    pattern: 'Verbose null/undefined check',
    category: 'null_check' as const,
    suggestion: 'Use optional chaining (?.) or nullish coalescing (??)',
  },
  {
    regex: /(\w+)\s*!==\s*null\s*&&\s*\1\s*!==\s*undefined/g,
    pattern: 'Verbose null/undefined check',
    category: 'null_check' as const,
    suggestion: 'Use != null to check both null and undefined',
  },
  {
    regex: /typeof\s+\w+\s*!==?\s*['"]undefined['"]/g,
    pattern: 'typeof undefined check',
    category: 'comparison' as const,
    suggestion: 'Use direct comparison: variable !== undefined',
  },
  {
    regex: /new\s+Array\s*\(\s*\)/g,
    pattern: 'Array constructor without arguments',
    category: 'constructor' as const,
    suggestion: 'Use array literal: []',
  },
  {
    regex: /new\s+Object\s*\(\s*\)/g,
    pattern: 'Object constructor without arguments',
    category: 'constructor' as const,
    suggestion: 'Use object literal: {}',
  },
  {
    regex: /\.then\s*\([^)]*\)\s*\.catch\s*\([^)]*\)/g,
    pattern: 'Promise .then().catch() chain',
    category: 'async' as const,
    suggestion: 'Consider using async/await for cleaner error handling',
  },
  {
    regex: /async\s+\([^)]*\)\s*=>\s*\{?\s*return\s+(?!await)/g,
    pattern: 'Async function with immediate return',
    category: 'async' as const,
    suggestion: 'Remove async if not awaiting anything',
  },
  {
    regex: /return\s+await\s+(?!Promise\.all)/g,
    pattern: 'Unnecessary return await',
    category: 'async' as const,
    suggestion: 'Return the promise directly unless in try-catch',
  },
  {
    regex: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(/g,
    pattern: 'Deep clone via JSON',
    category: 'other' as const,
    suggestion: 'Use structuredClone() or a dedicated cloning library',
  },
  {
    regex: /\.indexOf\s*\([^)]+\)\s*!==?\s*-1/g,
    pattern: 'indexOf !== -1 check',
    category: 'comparison' as const,
    suggestion: 'Use .includes() for better readability',
  },
  {
    regex: /\.indexOf\s*\([^)]+\)\s*>=?\s*0/g,
    pattern: 'indexOf >= 0 check',
    category: 'comparison' as const,
    suggestion: 'Use .includes() for better readability',
  },
] as const;

// ============================================================================
// Dead Code Detector Implementation
// ============================================================================

/**
 * Detects dead code, unused exports, and redundant patterns
 */
export class DeadCodeDetector {
  private exportMap: Map<string, Set<string>> = new Map();
  private importMap: Map<string, Map<string, Set<string>>> = new Map();

  /**
   * Analyze files for dead code
   */
  async analyze(
    files: Array<{ path: string; content: string }>
  ): Promise<DeadCodeReport> {
    this.exportMap.clear();
    this.importMap.clear();

    const analyzedFiles: AnalyzedFile[] = files.map(f => ({
      path: f.path,
      content: f.content,
      lines: f.content.split('\n'),
    }));

    // Phase 1: Collect all exports
    const allExports = this.collectExports(analyzedFiles);

    // Phase 2: Build import/usage map
    this.buildImportMap(analyzedFiles);

    // Phase 3: Find unused exports
    const unusedExports = this.findUnusedExports(allExports);

    // Phase 4: Find unreachable code
    const unreachableCode = this.findUnreachableCode(analyzedFiles);

    // Phase 5: Find redundant patterns
    const redundantPatterns = this.findRedundantPatterns(analyzedFiles);

    // Phase 6: Find unused variables
    const unusedVariables = this.findUnusedVariables(analyzedFiles);

    // Generate summary
    const summary = this.generateSummary(
      unusedExports,
      unreachableCode,
      redundantPatterns,
      unusedVariables,
      analyzedFiles
    );

    return {
      unusedExports,
      unreachableCode,
      redundantPatterns,
      unusedVariables,
      summary,
      analyzedAt: new Date(),
    };
  }

  // ============================================================================
  // Export Collection
  // ============================================================================

  /**
   * Collect all exports from files
   */
  private collectExports(files: AnalyzedFile[]): UnusedExport[] {
    const exports: UnusedExport[] = [];

    for (const file of files) {
      const fileExports = new Set<string>();

      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i] ?? '';
        const lineNumber = i + 1;

        // Named export: export const/let/function/class/type/interface/enum name
        const namedExport = line.match(
          /^export\s+(const|let|var|function|class|type|interface|enum|async\s+function)\s+(\w+)/
        );
        if (namedExport) {
          const exportType = this.normalizeExportType(namedExport[1] ?? '');
          const exportName = namedExport[2] ?? '';
          exports.push({
            filePath: file.path,
            exportName,
            exportType,
            lineNumber,
            confidence: 85,
          });
          fileExports.add(exportName);
        }

        // Export statement: export { name1, name2 }
        const exportStatement = line.match(/^export\s*\{([^}]+)\}/);
        if (exportStatement) {
          const names = (exportStatement[1] ?? '').split(',').map(n => {
            const parts = n.trim().split(/\s+as\s+/);
            return parts[parts.length - 1]?.trim() ?? '';
          }).filter(Boolean);

          for (const name of names) {
            exports.push({
              filePath: file.path,
              exportName: name,
              exportType: 'const',
              lineNumber,
              confidence: 80,
            });
            fileExports.add(name);
          }
        }

        // Default export
        const defaultExport = line.match(/^export\s+default\s+(?:class|function)?\s*(\w+)?/);
        if (defaultExport) {
          exports.push({
            filePath: file.path,
            exportName: defaultExport[1] ?? 'default',
            exportType: 'default',
            lineNumber,
            confidence: 90,
          });
          fileExports.add('default');
        }

        // Re-export: export * from './module'
        const reExport = line.match(/^export\s+\*\s+(?:as\s+(\w+)\s+)?from\s+['"]([^'"]+)['"]/);
        if (reExport) {
          // Track re-export source for later analysis
          const alias = reExport[1];
          if (alias) {
            fileExports.add(alias);
          }
        }
      }

      this.exportMap.set(file.path, fileExports);
    }

    return exports;
  }

  /**
   * Normalize export type string
   */
  private normalizeExportType(type: string): UnusedExport['exportType'] {
    const normalized = type.replace(/\s+/g, ' ').trim();
    if (normalized.includes('function')) return 'function';
    if (normalized === 'class') return 'class';
    if (normalized === 'const') return 'const';
    if (normalized === 'let') return 'let';
    if (normalized === 'type') return 'type';
    if (normalized === 'interface') return 'interface';
    if (normalized === 'enum') return 'enum';
    return 'const';
  }

  // ============================================================================
  // Import Analysis
  // ============================================================================

  /**
   * Build a map of imports for each file
   */
  private buildImportMap(files: AnalyzedFile[]): void {
    for (const file of files) {
      const fileImports = new Map<string, Set<string>>();

      for (const line of file.lines) {
        // Named imports: import { a, b } from './module'
        const namedImport = line.match(
          /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/
        );
        if (namedImport) {
          const imports = (namedImport[1] ?? '').split(',').map(i => {
            const parts = i.trim().split(/\s+as\s+/);
            return parts[0]?.trim() ?? '';
          }).filter(Boolean);

          const source = namedImport[2] ?? '';
          const existing = fileImports.get(source) ?? new Set();
          imports.forEach(i => existing.add(i));
          fileImports.set(source, existing);
        }

        // Default import: import Name from './module'
        const defaultImport = line.match(
          /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/
        );
        if (defaultImport && !/\{/.test(line)) {
          const source = defaultImport[2] ?? '';
          const existing = fileImports.get(source) ?? new Set();
          existing.add('default');
          fileImports.set(source, existing);
        }

        // Namespace import: import * as Name from './module'
        const namespaceImport = line.match(
          /import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/
        );
        if (namespaceImport) {
          const source = namespaceImport[2] ?? '';
          const existing = fileImports.get(source) ?? new Set();
          existing.add('*');
          fileImports.set(source, existing);
        }
      }

      this.importMap.set(file.path, fileImports);
    }
  }

  /**
   * Find exports that are never imported
   */
  private findUnusedExports(exports: UnusedExport[]): UnusedExport[] {
    const unused: UnusedExport[] = [];
    const allImportedNames = new Set<string>();

    // Collect all imported names
    for (const [, fileImports] of this.importMap) {
      for (const [, imports] of fileImports) {
        imports.forEach(i => allImportedNames.add(i));
      }
    }

    for (const exp of exports) {
      // Skip index files (they re-export)
      if (exp.filePath.includes('/index.') || exp.filePath.endsWith('index.ts')) {
        continue;
      }

      // Skip test files
      if (
        exp.filePath.includes('.test.') ||
        exp.filePath.includes('.spec.') ||
        exp.filePath.includes('__tests__')
      ) {
        continue;
      }

      // Skip if it's a type (types might be used via declaration merging)
      if (exp.exportType === 'type' || exp.exportType === 'interface') {
        continue;
      }

      // Check if the export is imported anywhere
      if (!allImportedNames.has(exp.exportName) && exp.exportName !== 'default') {
        unused.push({
          ...exp,
          confidence: Math.min(exp.confidence, 70), // Lower confidence since analysis is incomplete
        });
      }
    }

    return unused;
  }

  // ============================================================================
  // Unreachable Code Detection
  // ============================================================================

  /**
   * Find unreachable code in files
   */
  private findUnreachableCode(files: AnalyzedFile[]): UnreachableCode[] {
    const unreachable: UnreachableCode[] = [];

    for (const file of files) {
      let inFunction = false;
      let braceDepth = 0;
      let returnDepth = -1;
      let returnLine = -1;

      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i] ?? '';
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          continue;
        }

        // Track function entry/exit
        if (/(?:function|=>|\{)/.test(trimmed)) {
          inFunction = true;
        }

        // Count braces
        const opens = (line.match(/\{/g) ?? []).length;
        const closes = (line.match(/\}/g) ?? []).length;
        braceDepth += opens - closes;

        if (!inFunction) continue;

        // Check for return/throw
        if (/^(return|throw)\s/.test(trimmed) && !trimmed.includes('=>')) {
          returnLine = i;
          returnDepth = braceDepth;
        }

        // If we've seen a return, check following lines
        if (returnLine >= 0 && returnDepth === braceDepth && i > returnLine) {
          // Check if this line is actual code (not a closing brace)
          if (trimmed && trimmed !== '}' && !trimmed.startsWith('case ') && trimmed !== 'default:') {
            unreachable.push({
              filePath: file.path,
              lineStart: i + 1,
              lineEnd: i + 1,
              reason: 'Code after return/throw statement',
              type: /^return/.test((file.lines[returnLine] ?? '').trim()) ? 'after_return' : 'after_throw',
              codeSnippet: trimmed.substring(0, 60),
            });
          }
          returnLine = -1;
          returnDepth = -1;
        }

        // Reset on block exit
        if (closes > 0 && braceDepth < returnDepth) {
          returnLine = -1;
          returnDepth = -1;
        }

        // Check for always-false conditions
        if (/if\s*\(\s*false\s*\)/.test(trimmed)) {
          unreachable.push({
            filePath: file.path,
            lineStart: i + 1,
            lineEnd: i + 1,
            reason: 'Condition is always false',
            type: 'dead_branch',
            codeSnippet: trimmed.substring(0, 60),
          });
        }

        // Check for always-true conditions with else
        if (/if\s*\(\s*true\s*\)/.test(trimmed)) {
          // The else branch (if exists) would be unreachable
          // This is a simplified check
        }
      }
    }

    return unreachable;
  }

  // ============================================================================
  // Redundant Pattern Detection
  // ============================================================================

  /**
   * Find redundant patterns in code
   */
  private findRedundantPatterns(files: AnalyzedFile[]): RedundantPattern[] {
    const redundant: RedundantPattern[] = [];

    for (const file of files) {
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i] ?? '';

        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }

        for (const patternDef of REDUNDANT_PATTERNS) {
          // Reset regex state
          patternDef.regex.lastIndex = 0;
          const match = patternDef.regex.exec(line);

          if (match) {
            redundant.push({
              filePath: file.path,
              lineNumber: i + 1,
              pattern: patternDef.pattern,
              found: match[0],
              suggestion: patternDef.suggestion,
              category: patternDef.category,
            });
          }
        }
      }
    }

    return redundant;
  }

  // ============================================================================
  // Unused Variable Detection
  // ============================================================================

  /**
   * Find unused variables (simplified detection)
   */
  private findUnusedVariables(files: AnalyzedFile[]): UnusedVariable[] {
    const unused: UnusedVariable[] = [];

    for (const file of files) {
      const declarations: Array<{
        name: string;
        line: number;
        type: UnusedVariable['declarationType'];
      }> = [];

      const usedNames = new Set<string>();

      // First pass: collect declarations
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i] ?? '';

        // const/let/var declarations
        const varDecl = line.match(/(?:const|let|var)\s+(\w+)\s*[=:]/);
        if (varDecl?.[1]) {
          const declType = line.includes('const') ? 'const' : line.includes('let') ? 'let' : 'var';
          declarations.push({
            name: varDecl[1],
            line: i + 1,
            type: declType,
          });
        }

        // Destructuring (simplified)
        const destructure = line.match(/(?:const|let|var)\s*\{([^}]+)\}/);
        if (destructure) {
          const names = (destructure[1] ?? '').split(',').map(n => n.trim().split(':')[0]?.trim() ?? '').filter(Boolean);
          const declType = line.includes('const') ? 'const' : line.includes('let') ? 'let' : 'var';
          for (const name of names) {
            if (name && !name.includes('...')) {
              declarations.push({
                name,
                line: i + 1,
                type: 'destructured',
              });
            }
          }
        }
      }

      // Second pass: find usages
      const fullContent = file.content;
      for (const decl of declarations) {
        // Check if name appears more than once (declaration + at least one use)
        const namePattern = new RegExp(`\\b${decl.name}\\b`, 'g');
        const matches = fullContent.match(namePattern);

        if (matches && matches.length > 1) {
          usedNames.add(decl.name);
        }
      }

      // Report unused
      for (const decl of declarations) {
        // Skip common exceptions
        if (['_', '__', 'err', 'error', 'e'].includes(decl.name)) {
          continue;
        }

        // Skip if starts with underscore (intentionally unused)
        if (decl.name.startsWith('_')) {
          continue;
        }

        if (!usedNames.has(decl.name)) {
          unused.push({
            filePath: file.path,
            name: decl.name,
            lineNumber: decl.line,
            declarationType: decl.type,
          });
        }
      }
    }

    return unused;
  }

  // ============================================================================
  // Summary Generation
  // ============================================================================

  /**
   * Generate summary statistics
   */
  private generateSummary(
    unusedExports: UnusedExport[],
    unreachableCode: UnreachableCode[],
    redundantPatterns: RedundantPattern[],
    unusedVariables: UnusedVariable[],
    files: AnalyzedFile[]
  ): DeadCodeSummary {
    const totalIssues =
      unusedExports.length +
      unreachableCode.length +
      redundantPatterns.length +
      unusedVariables.length;

    // Calculate issues per file
    const fileIssueCount = new Map<string, number>();
    for (const exp of unusedExports) {
      fileIssueCount.set(exp.filePath, (fileIssueCount.get(exp.filePath) ?? 0) + 1);
    }
    for (const code of unreachableCode) {
      fileIssueCount.set(code.filePath, (fileIssueCount.get(code.filePath) ?? 0) + 1);
    }
    for (const pattern of redundantPatterns) {
      fileIssueCount.set(pattern.filePath, (fileIssueCount.get(pattern.filePath) ?? 0) + 1);
    }
    for (const variable of unusedVariables) {
      fileIssueCount.set(variable.filePath, (fileIssueCount.get(variable.filePath) ?? 0) + 1);
    }

    const topFiles = Array.from(fileIssueCount.entries())
      .map(([path, issueCount]) => ({ path, issueCount }))
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);

    // Estimate debt hours (rough estimate)
    const estimatedDebtHours =
      unusedExports.length * 0.25 +      // 15 min to verify and remove
      unreachableCode.length * 0.1 +     // 6 min to remove
      redundantPatterns.length * 0.08 +  // 5 min to fix
      unusedVariables.length * 0.05;     // 3 min to remove

    return {
      totalIssues,
      byCategory: {
        unusedExports: unusedExports.length,
        unreachableCode: unreachableCode.length,
        redundantPatterns: redundantPatterns.length,
        unusedVariables: unusedVariables.length,
      },
      estimatedDebtHours: Math.round(estimatedDebtHours * 10) / 10,
      topFiles,
    };
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

/**
 * Default dead code detector instance
 */
export const deadCodeDetector = new DeadCodeDetector();

/**
 * Create a new dead code detector
 */
export function createDeadCodeDetector(): DeadCodeDetector {
  return new DeadCodeDetector();
}

export default DeadCodeDetector;
