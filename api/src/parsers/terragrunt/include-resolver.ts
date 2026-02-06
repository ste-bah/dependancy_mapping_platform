/**
 * Terragrunt Include Resolver
 * @module parsers/terragrunt/include-resolver
 *
 * TASK-TG-001: Resolve Terragrunt include and dependency paths
 *
 * Handles the hierarchical nature of Terragrunt configurations by
 * resolving include paths, detecting circular dependencies, and
 * building the configuration inheritance tree.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  HCLExpression,
  HCLLiteralExpression,
  HCLFunctionExpression,
} from '../terraform/types';
import {
  TerragruntFile,
  TerragruntBlock,
  IncludeBlock,
  DependencyBlock,
  DependenciesBlock,
  ResolvedInclude,
  ResolvedDependency,
  TerragruntParseError,
  isIncludeBlock,
  isDependencyBlock,
  isDependenciesBlock,
} from './types';

// ============================================================================
// Resolution Types
// ============================================================================

/**
 * Result of resolving all includes and dependencies
 */
export interface ResolutionResult {
  /** Resolved include references */
  readonly includes: readonly ResolvedInclude[];
  /** Resolved dependency references */
  readonly dependencies: readonly ResolvedDependency[];
  /** Resolution errors */
  readonly errors: readonly TerragruntParseError[];
  /** Circular reference warnings */
  readonly circularWarnings: readonly string[];
}

/**
 * Options for path resolution
 */
export interface ResolutionOptions {
  /** Base directory for relative paths */
  readonly baseDir: string;
  /** Maximum include depth to prevent infinite loops */
  readonly maxDepth: number;
  /** Whether to resolve paths on filesystem */
  readonly resolveFileSystem: boolean;
  /** Already visited paths for circular detection */
  readonly visitedPaths?: Set<string>;
}

/**
 * Context for evaluating path expressions
 */
export interface PathEvaluationContext {
  /** Current terragrunt.hcl directory */
  readonly terragruntDir: string;
  /** Original terragrunt.hcl directory (for nested includes) */
  readonly originalTerragruntDir: string;
  /** Path to repository root */
  readonly repoRoot: string | null;
  /** Local variables from locals block */
  readonly locals: Record<string, unknown>;
}

// ============================================================================
// Include Resolver Class
// ============================================================================

/**
 * Resolves Terragrunt include and dependency paths.
 * Handles hierarchical configuration inheritance and circular dependency detection.
 *
 * @example
 * ```typescript
 * const resolver = new IncludeResolver({
 *   baseDir: '/path/to/project',
 *   maxDepth: 10,
 * });
 *
 * const result = resolver.resolveAll(parsedFile);
 * ```
 */
export class IncludeResolver {
  private readonly options: Required<ResolutionOptions>;

  constructor(options: Partial<ResolutionOptions> = {}) {
    this.options = {
      baseDir: options.baseDir ?? process.cwd(),
      maxDepth: options.maxDepth ?? 10,
      resolveFileSystem: options.resolveFileSystem ?? true,
      visitedPaths: options.visitedPaths ?? new Set(),
    };
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Resolve all includes and dependencies in a parsed file
   */
  resolveAll(file: TerragruntFile): ResolutionResult {
    const errors: TerragruntParseError[] = [];
    const circularWarnings: string[] = [];

    // Create evaluation context
    const context = this.createContext(file.path);

    // Resolve includes
    const includeBlocks = file.blocks.filter(isIncludeBlock);
    const includes = this.resolveIncludes(includeBlocks, context, errors, circularWarnings);

    // Resolve dependencies
    const dependencyBlocks = file.blocks.filter(isDependencyBlock);
    const dependenciesBlocks = file.blocks.filter(isDependenciesBlock);
    const dependencies = this.resolveDependencies(
      dependencyBlocks,
      dependenciesBlocks,
      context,
      errors,
      circularWarnings
    );

    return {
      includes,
      dependencies,
      errors,
      circularWarnings,
    };
  }

  /**
   * Resolve a single include block
   */
  resolveInclude(
    block: IncludeBlock,
    context: PathEvaluationContext
  ): ResolvedInclude {
    const pathResult = this.evaluatePathExpression(block.path, context);

    return {
      label: block.label,
      pathExpression: block.path,
      resolvedPath: pathResult.resolved ? pathResult.path : null,
      resolved: pathResult.resolved,
      mergeStrategy: block.mergeStrategy,
    };
  }

  /**
   * Resolve a single dependency block
   */
  resolveDependency(
    block: DependencyBlock,
    context: PathEvaluationContext
  ): ResolvedDependency {
    const pathResult = this.evaluatePathExpression(block.configPath, context);

    return {
      name: block.name,
      configPathExpression: block.configPath,
      resolvedPath: pathResult.resolved ? pathResult.path : null,
      resolved: pathResult.resolved,
      outputsUsed: [], // Would need expression analysis to populate
    };
  }

  /**
   * Evaluate a path expression to an actual path
   */
  evaluatePath(expr: HCLExpression, context: PathEvaluationContext): string | null {
    const result = this.evaluatePathExpression(expr, context);
    return result.resolved ? result.path : null;
  }

  /**
   * Find repository root from a starting directory
   */
  findRepoRoot(startDir: string): string | null {
    let current = startDir;
    const root = path.parse(current).root;

    while (current !== root) {
      if (fs.existsSync(path.join(current, '.git'))) {
        return current;
      }
      current = path.dirname(current);
    }

    return null;
  }

  // ============================================================================
  // Private Resolution Methods
  // ============================================================================

  /**
   * Resolve multiple include blocks
   */
  private resolveIncludes(
    blocks: readonly IncludeBlock[],
    context: PathEvaluationContext,
    errors: TerragruntParseError[],
    circularWarnings: string[]
  ): readonly ResolvedInclude[] {
    const resolved: ResolvedInclude[] = [];

    for (const block of blocks) {
      const include = this.resolveInclude(block, context);
      resolved.push(include);

      // Check for circular includes
      if (include.resolvedPath) {
        const normalizedPath = path.normalize(include.resolvedPath);

        if (this.options.visitedPaths.has(normalizedPath)) {
          circularWarnings.push(
            `Circular include detected: ${normalizedPath} has already been included`
          );
          errors.push({
            message: `Circular include detected: ${normalizedPath}`,
            location: block.location,
            severity: 'error',
            code: 'CIRCULAR_INCLUDE',
          });
        } else if (include.resolved && this.options.resolveFileSystem) {
          // Check if file exists
          if (!fs.existsSync(normalizedPath)) {
            errors.push({
              message: `Include file not found: ${normalizedPath}`,
              location: block.location,
              severity: 'error',
              code: 'INCLUDE_NOT_FOUND',
            });
          }
        }
      }
    }

    return resolved;
  }

  /**
   * Resolve dependency blocks
   */
  private resolveDependencies(
    dependencyBlocks: readonly DependencyBlock[],
    dependenciesBlocks: readonly DependenciesBlock[],
    context: PathEvaluationContext,
    errors: TerragruntParseError[],
    circularWarnings: string[]
  ): readonly ResolvedDependency[] {
    const resolved: ResolvedDependency[] = [];

    // Resolve individual dependency blocks
    for (const block of dependencyBlocks) {
      const dependency = this.resolveDependency(block, context);
      resolved.push(dependency);

      // Check for circular dependencies
      if (dependency.resolvedPath) {
        const normalizedPath = path.normalize(dependency.resolvedPath);

        if (this.options.visitedPaths.has(normalizedPath)) {
          circularWarnings.push(
            `Circular dependency detected: ${normalizedPath}`
          );
          errors.push({
            message: `Circular dependency detected: ${normalizedPath}`,
            location: block.location,
            severity: 'error',
            code: 'CIRCULAR_DEPENDENCY',
          });
        } else if (dependency.resolved && this.options.resolveFileSystem) {
          // Check if terragrunt.hcl exists in dependency path
          const tgPath = path.join(normalizedPath, 'terragrunt.hcl');
          if (!fs.existsSync(tgPath) && !fs.existsSync(normalizedPath)) {
            errors.push({
              message: `Dependency not found: ${normalizedPath}`,
              location: block.location,
              severity: 'error',
              code: 'DEPENDENCY_NOT_FOUND',
            });
          }
        }
      }
    }

    // Resolve dependencies blocks (array of paths)
    for (const block of dependenciesBlocks) {
      const paths = this.evaluatePathArray(block.paths, context);

      for (let i = 0; i < paths.length; i++) {
        const depPath = paths[i];
        resolved.push({
          name: `dependency_${i}`,
          configPathExpression: block.paths,
          resolvedPath: depPath,
          resolved: depPath !== null,
          outputsUsed: [],
        });
      }
    }

    return resolved;
  }

  // ============================================================================
  // Expression Evaluation
  // ============================================================================

  /**
   * Evaluate a path expression
   */
  private evaluatePathExpression(
    expr: HCLExpression,
    context: PathEvaluationContext
  ): { resolved: boolean; path: string | null } {
    switch (expr.type) {
      case 'literal':
        return this.evaluateLiteralPath(expr, context);

      case 'function':
        return this.evaluateFunctionPath(expr, context);

      case 'template':
        return this.evaluateTemplatePath(expr, context);

      case 'reference':
        return this.evaluateReferencePath(expr, context);

      default:
        // Cannot statically evaluate complex expressions
        return { resolved: false, path: null };
    }
  }

  /**
   * Evaluate a literal string path
   */
  private evaluateLiteralPath(
    expr: HCLLiteralExpression,
    context: PathEvaluationContext
  ): { resolved: boolean; path: string | null } {
    if (typeof expr.value !== 'string') {
      return { resolved: false, path: null };
    }

    const resolvedPath = this.resolvePath(expr.value, context.terragruntDir);
    return { resolved: true, path: resolvedPath };
  }

  /**
   * Evaluate a function call that returns a path
   */
  private evaluateFunctionPath(
    expr: HCLFunctionExpression,
    context: PathEvaluationContext
  ): { resolved: boolean; path: string | null } {
    switch (expr.name) {
      case 'find_in_parent_folders': {
        const filename = expr.args.length > 0
          ? this.extractStringValue(expr.args[0])
          : 'terragrunt.hcl';

        if (!filename) return { resolved: false, path: null };

        const found = this.findInParentFolders(filename, context.terragruntDir);
        return { resolved: found !== null, path: found };
      }

      case 'get_terragrunt_dir':
        return { resolved: true, path: context.terragruntDir };

      case 'get_original_terragrunt_dir':
        return { resolved: true, path: context.originalTerragruntDir };

      case 'get_path_to_repo_root':
        if (context.repoRoot) {
          const relative = path.relative(context.terragruntDir, context.repoRoot);
          return { resolved: true, path: relative || '.' };
        }
        return { resolved: false, path: null };

      case 'get_path_from_repo_root':
        if (context.repoRoot) {
          const relative = path.relative(context.repoRoot, context.terragruntDir);
          return { resolved: true, path: relative || '.' };
        }
        return { resolved: false, path: null };

      case 'path_relative_to_include':
      case 'path_relative_from_include':
        // These require include context which we may not have statically
        return { resolved: false, path: null };

      default:
        // Unknown function - cannot evaluate
        return { resolved: false, path: null };
    }
  }

  /**
   * Evaluate a template string path
   */
  private evaluateTemplatePath(
    expr: HCLExpression,
    context: PathEvaluationContext
  ): { resolved: boolean; path: string | null } {
    if (expr.type !== 'template') {
      return { resolved: false, path: null };
    }

    let result = '';
    for (const part of expr.parts) {
      if (typeof part === 'string') {
        result += part;
      } else {
        const evaluated = this.evaluatePathExpression(part, context);
        if (!evaluated.resolved || evaluated.path === null) {
          return { resolved: false, path: null };
        }
        result += evaluated.path;
      }
    }

    const resolvedPath = this.resolvePath(result, context.terragruntDir);
    return { resolved: true, path: resolvedPath };
  }

  /**
   * Evaluate a reference path (e.g., local.my_path)
   */
  private evaluateReferencePath(
    expr: HCLExpression,
    context: PathEvaluationContext
  ): { resolved: boolean; path: string | null } {
    if (expr.type !== 'reference') {
      return { resolved: false, path: null };
    }

    // Try to resolve local references
    if (expr.parts[0] === 'local' && expr.parts.length >= 2) {
      const localName = expr.parts.slice(1).join('.');
      const value = context.locals[localName];

      if (typeof value === 'string') {
        const resolvedPath = this.resolvePath(value, context.terragruntDir);
        return { resolved: true, path: resolvedPath };
      }
    }

    return { resolved: false, path: null };
  }

  /**
   * Evaluate a path array expression
   */
  private evaluatePathArray(
    expr: HCLExpression,
    context: PathEvaluationContext
  ): (string | null)[] {
    if (expr.type !== 'array') {
      return [];
    }

    return expr.elements.map(el => {
      const result = this.evaluatePathExpression(el, context);
      return result.resolved ? result.path : null;
    });
  }

  // ============================================================================
  // Path Resolution Utilities
  // ============================================================================

  /**
   * Create evaluation context from file path
   */
  private createContext(filePath: string): PathEvaluationContext {
    const terragruntDir = path.dirname(path.resolve(filePath));
    const repoRoot = this.findRepoRoot(terragruntDir);

    return {
      terragruntDir,
      originalTerragruntDir: terragruntDir,
      repoRoot,
      locals: {},
    };
  }

  /**
   * Resolve a relative path to absolute
   */
  private resolvePath(relativePath: string, baseDir: string): string {
    if (path.isAbsolute(relativePath)) {
      return path.normalize(relativePath);
    }
    return path.normalize(path.join(baseDir, relativePath));
  }

  /**
   * Find a file in parent directories
   */
  private findInParentFolders(filename: string, startDir: string): string | null {
    let current = path.dirname(startDir); // Start from parent
    const root = path.parse(current).root;
    let depth = 0;

    while (current !== root && depth < this.options.maxDepth) {
      const candidate = path.join(current, filename);

      if (this.options.resolveFileSystem) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } else {
        // When not resolving filesystem, just return the first candidate
        return candidate;
      }

      current = path.dirname(current);
      depth++;
    }

    return null;
  }

  /**
   * Extract string value from an expression
   */
  private extractStringValue(expr: HCLExpression): string | null {
    if (expr.type === 'literal' && typeof expr.value === 'string') {
      return expr.value;
    }
    // Try to get from raw if it's a quoted string
    if (expr.raw.startsWith('"') && expr.raw.endsWith('"')) {
      return expr.raw.slice(1, -1);
    }
    return null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new include resolver
 */
export function createIncludeResolver(
  options?: Partial<ResolutionOptions>
): IncludeResolver {
  return new IncludeResolver(options);
}

/**
 * Resolve all references in a file
 */
export function resolveReferences(
  file: TerragruntFile,
  options?: Partial<ResolutionOptions>
): ResolutionResult {
  const resolver = createIncludeResolver(options);
  return resolver.resolveAll(file);
}
