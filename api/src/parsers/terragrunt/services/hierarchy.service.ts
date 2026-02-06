/**
 * Terragrunt Hierarchy Service
 * @module parsers/terragrunt/services/hierarchy.service
 *
 * TASK-TG-001: Service for Terragrunt configuration hierarchy resolution
 *
 * Provides:
 * - Complete hierarchy resolution (multi-level includes)
 * - Merged configuration computation
 * - Dependency graph building
 * - Topological sorting for execution order
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  TerragruntFile,
  TerragruntBlock,
  IncludeBlock,
  LocalsBlock,
  InputsBlock,
  DependencyBlock,
  DependenciesBlock,
  RemoteStateBlock,
  TerraformBlock,
  ResolvedInclude,
  ResolvedDependency,
  isIncludeBlock,
  isLocalsBlock,
  isInputsBlock,
  isDependencyBlock,
  isDependenciesBlock,
  isRemoteStateBlock,
  isTerraformBlock,
} from '../types';
import { IncludeResolver, createIncludeResolver, PathEvaluationContext } from '../include-resolver';
import { ParseResult, isParseSuccess } from '../../base/parser';
import { parseTerragruntFile } from '../tg-parser';
import { HCLExpression } from '../../terraform/types';

// ============================================================================
// Service Types
// ============================================================================

/**
 * Represents a node in the configuration hierarchy
 */
export interface HierarchyNode {
  /** Absolute path to the terragrunt.hcl file */
  readonly path: string;
  /** Parsed Terragrunt file */
  readonly file: TerragruntFile;
  /** Parent nodes (included configurations) */
  readonly parents: readonly HierarchyNode[];
  /** Child nodes (configurations that include this one) */
  readonly children: readonly HierarchyNode[];
  /** Depth in the hierarchy (0 = root) */
  readonly depth: number;
  /** Include labels used */
  readonly includeLabels: readonly string[];
}

/**
 * Merged configuration from the hierarchy
 */
export interface MergedConfiguration {
  /** Source file path */
  readonly sourcePath: string;
  /** Merged locals from all levels */
  readonly locals: Record<string, HCLExpression>;
  /** Merged inputs from all levels */
  readonly inputs: Record<string, HCLExpression>;
  /** Remote state configuration (from deepest override) */
  readonly remoteState: RemoteStateBlock | null;
  /** Terraform block (from deepest override) */
  readonly terraform: TerraformBlock | null;
  /** All dependencies (combined from all levels) */
  readonly dependencies: readonly ResolvedDependency[];
  /** Merge trace showing origin of each value */
  readonly mergeTrace: MergeTrace;
}

/**
 * Trace of where each merged value came from
 */
export interface MergeTrace {
  /** Origin path for each local variable */
  readonly locals: Record<string, string>;
  /** Origin path for each input */
  readonly inputs: Record<string, string>;
  /** Origin path for remote_state */
  readonly remoteState: string | null;
  /** Origin path for terraform block */
  readonly terraform: string | null;
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  /** Module path */
  readonly path: string;
  /** Display name */
  readonly name: string;
  /** Direct dependencies (modules this depends on) */
  readonly dependencies: readonly string[];
  /** Dependents (modules that depend on this) */
  readonly dependents: readonly string[];
  /** Whether this module is resolved */
  readonly resolved: boolean;
  /** Mock outputs if unresolved */
  readonly mockOutputs: Record<string, unknown>;
}

/**
 * Complete dependency graph
 */
export interface DependencyGraph {
  /** All nodes in the graph */
  readonly nodes: Map<string, DependencyNode>;
  /** Root nodes (no dependencies) */
  readonly roots: readonly string[];
  /** Leaf nodes (no dependents) */
  readonly leaves: readonly string[];
  /** Execution order (topologically sorted) */
  readonly executionOrder: readonly string[];
  /** Circular dependency paths if any */
  readonly cycles: readonly string[][];
}

/**
 * Options for hierarchy resolution
 */
export interface HierarchyOptions {
  /** Maximum depth to traverse (default: 10) */
  readonly maxDepth?: number;
  /** Resolve filesystem paths (default: true) */
  readonly resolveFileSystem?: boolean;
  /** Parse included files (default: true) */
  readonly parseIncludes?: boolean;
  /** Base directory for relative paths */
  readonly baseDir?: string;
}

// ============================================================================
// Hierarchy Service Class
// ============================================================================

/**
 * Service for resolving and computing Terragrunt configuration hierarchies.
 *
 * @example
 * ```typescript
 * const service = new TerragruntHierarchyService();
 *
 * // Build hierarchy from a file
 * const hierarchy = await service.buildHierarchy('/path/to/terragrunt.hcl');
 *
 * // Get merged configuration
 * const merged = await service.getMergedConfiguration('/path/to/terragrunt.hcl');
 *
 * // Build dependency graph
 * const graph = await service.buildDependencyGraph('/path/to/project');
 * ```
 */
export class TerragruntHierarchyService {
  private readonly resolver: IncludeResolver;
  private readonly parsedFiles: Map<string, TerragruntFile>;
  private readonly defaultOptions: Required<HierarchyOptions>;

  constructor(options: HierarchyOptions = {}) {
    this.defaultOptions = {
      maxDepth: options.maxDepth ?? 10,
      resolveFileSystem: options.resolveFileSystem ?? true,
      parseIncludes: options.parseIncludes ?? true,
      baseDir: options.baseDir ?? process.cwd(),
    };
    this.resolver = createIncludeResolver({
      baseDir: this.defaultOptions.baseDir,
      maxDepth: this.defaultOptions.maxDepth,
      resolveFileSystem: this.defaultOptions.resolveFileSystem,
    });
    this.parsedFiles = new Map();
  }

  // ============================================================================
  // Hierarchy Building
  // ============================================================================

  /**
   * Build complete hierarchy from a Terragrunt file
   */
  async buildHierarchy(
    filePath: string,
    options?: HierarchyOptions
  ): Promise<HierarchyNode> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const absolutePath = path.resolve(filePath);

    // Parse the root file
    const rootFile = await this.parseAndCache(absolutePath);
    if (!rootFile) {
      throw new Error(`Failed to parse Terragrunt file: ${absolutePath}`);
    }

    // Build hierarchy recursively
    const visited = new Set<string>();
    return this.buildHierarchyNode(absolutePath, rootFile, 0, mergedOptions, visited);
  }

  /**
   * Build hierarchy node recursively
   */
  private async buildHierarchyNode(
    filePath: string,
    file: TerragruntFile,
    depth: number,
    options: Required<HierarchyOptions>,
    visited: Set<string>
  ): Promise<HierarchyNode> {
    visited.add(filePath);

    const parents: HierarchyNode[] = [];
    const includeLabels: string[] = [];

    if (depth < options.maxDepth && options.parseIncludes) {
      // Get include blocks
      const includeBlocks = file.blocks.filter(isIncludeBlock);

      for (const include of includeBlocks) {
        includeLabels.push(include.label || 'default');

        // Resolve include path
        const resolvedInclude = file.includes.find(
          i => i.label === include.label
        );

        if (resolvedInclude?.resolvedPath && !visited.has(resolvedInclude.resolvedPath)) {
          const parentFile = await this.parseAndCache(resolvedInclude.resolvedPath);
          if (parentFile) {
            const parentNode = await this.buildHierarchyNode(
              resolvedInclude.resolvedPath,
              parentFile,
              depth + 1,
              options,
              visited
            );
            parents.push(parentNode);
          }
        }
      }
    }

    return {
      path: filePath,
      file,
      parents,
      children: [], // Populated by caller if needed
      depth,
      includeLabels,
    };
  }

  // ============================================================================
  // Configuration Merging
  // ============================================================================

  /**
   * Get merged configuration from hierarchy
   */
  async getMergedConfiguration(
    filePath: string,
    options?: HierarchyOptions
  ): Promise<MergedConfiguration> {
    const hierarchy = await this.buildHierarchy(filePath, options);
    return this.mergeConfiguration(hierarchy);
  }

  /**
   * Merge configuration from hierarchy tree
   */
  private mergeConfiguration(node: HierarchyNode): MergedConfiguration {
    // Start with empty configuration
    const merged: {
      locals: Record<string, HCLExpression>;
      inputs: Record<string, HCLExpression>;
      remoteState: RemoteStateBlock | null;
      terraform: TerraformBlock | null;
      dependencies: ResolvedDependency[];
    } = {
      locals: {},
      inputs: {},
      remoteState: null,
      terraform: null,
      dependencies: [],
    };

    const trace: MergeTrace = {
      locals: {},
      inputs: {},
      remoteState: null,
      terraform: null,
    };

    // Process parents first (depth-first, oldest ancestor first)
    const ancestors = this.flattenAncestors(node);

    for (const ancestor of ancestors) {
      this.mergeFileConfiguration(ancestor, merged, trace);
    }

    // Process current node (overrides ancestors)
    this.mergeFileConfiguration(node, merged, trace);

    return {
      sourcePath: node.path,
      locals: merged.locals,
      inputs: merged.inputs,
      remoteState: merged.remoteState,
      terraform: merged.terraform,
      dependencies: merged.dependencies,
      mergeTrace: trace,
    };
  }

  /**
   * Flatten ancestors in order (oldest to newest)
   */
  private flattenAncestors(node: HierarchyNode): HierarchyNode[] {
    const ancestors: HierarchyNode[] = [];
    const visited = new Set<string>();

    const collect = (n: HierarchyNode): void => {
      for (const parent of n.parents) {
        if (!visited.has(parent.path)) {
          visited.add(parent.path);
          collect(parent); // Recurse to get older ancestors first
          ancestors.push(parent);
        }
      }
    };

    collect(node);
    return ancestors;
  }

  /**
   * Merge configuration from a single file
   */
  private mergeFileConfiguration(
    node: HierarchyNode,
    merged: {
      locals: Record<string, HCLExpression>;
      inputs: Record<string, HCLExpression>;
      remoteState: RemoteStateBlock | null;
      terraform: TerraformBlock | null;
      dependencies: ResolvedDependency[];
    },
    trace: MergeTrace
  ): void {
    const { file, path: filePath } = node;

    // Merge locals
    for (const block of file.blocks.filter(isLocalsBlock)) {
      for (const [key, value] of Object.entries(block.variables)) {
        merged.locals[key] = value;
        trace.locals[key] = filePath;
      }
    }

    // Merge inputs
    for (const block of file.blocks.filter(isInputsBlock)) {
      for (const [key, value] of Object.entries(block.values)) {
        merged.inputs[key] = value;
        trace.inputs[key] = filePath;
      }
    }

    // Override remote_state
    const remoteState = file.blocks.find(isRemoteStateBlock);
    if (remoteState) {
      merged.remoteState = remoteState;
      trace.remoteState = filePath;
    }

    // Override terraform block
    const terraform = file.blocks.find(isTerraformBlock);
    if (terraform) {
      merged.terraform = terraform;
      trace.terraform = filePath;
    }

    // Collect dependencies
    merged.dependencies.push(...file.dependencies);
  }

  // ============================================================================
  // Dependency Graph Building
  // ============================================================================

  /**
   * Build dependency graph for a project
   */
  async buildDependencyGraph(
    projectPath: string,
    options?: HierarchyOptions
  ): Promise<DependencyGraph> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const absolutePath = path.resolve(projectPath);

    // Find all terragrunt.hcl files
    const files = await this.findTerragruntFiles(absolutePath);

    // Build nodes
    const nodes = new Map<string, DependencyNode>();

    for (const filePath of files) {
      const file = await this.parseAndCache(filePath);
      if (!file) continue;

      const modulePath = path.dirname(filePath);
      const dependencies: string[] = [];
      const mockOutputs: Record<string, unknown> = {};

      // Extract dependencies
      for (const block of file.blocks.filter(isDependencyBlock)) {
        const resolved = file.dependencies.find(d => d.name === block.name);
        if (resolved?.resolvedPath) {
          dependencies.push(resolved.resolvedPath);
        }
        // Collect mock outputs
        for (const [key, value] of Object.entries(block.mockOutputs)) {
          if (value.type === 'literal') {
            mockOutputs[key] = value.value;
          }
        }
      }

      // Handle dependencies block
      for (const block of file.blocks.filter(isDependenciesBlock)) {
        for (const dep of file.dependencies) {
          if (dep.resolvedPath && !dependencies.includes(dep.resolvedPath)) {
            dependencies.push(dep.resolvedPath);
          }
        }
      }

      nodes.set(modulePath, {
        path: modulePath,
        name: path.basename(modulePath),
        dependencies,
        dependents: [], // Populated below
        resolved: file.dependencies.every(d => d.resolved),
        mockOutputs,
      });
    }

    // Populate dependents
    for (const [nodePath, node] of nodes) {
      for (const depPath of node.dependencies) {
        const depNode = nodes.get(depPath);
        if (depNode) {
          const mutableNode = depNode as { dependents: string[] };
          mutableNode.dependents = [...depNode.dependents, nodePath];
        }
      }
    }

    // Find roots and leaves
    const roots = Array.from(nodes.values())
      .filter(n => n.dependencies.length === 0)
      .map(n => n.path);

    const leaves = Array.from(nodes.values())
      .filter(n => n.dependents.length === 0)
      .map(n => n.path);

    // Detect cycles
    const cycles = this.detectCycles(nodes);

    // Topological sort
    const executionOrder = cycles.length === 0
      ? this.topologicalSort(nodes)
      : [];

    return {
      nodes,
      roots,
      leaves,
      executionOrder,
      cycles,
    };
  }

  /**
   * Get execution order for a module and its dependencies
   */
  async getExecutionOrder(
    modulePath: string,
    options?: HierarchyOptions
  ): Promise<string[]> {
    const projectPath = this.findProjectRoot(modulePath);
    const graph = await this.buildDependencyGraph(projectPath, options);

    // Find the module in the graph
    const absolutePath = path.resolve(modulePath);
    const moduleDirPath = absolutePath.endsWith('.hcl')
      ? path.dirname(absolutePath)
      : absolutePath;

    if (!graph.nodes.has(moduleDirPath)) {
      return [moduleDirPath];
    }

    // Get transitive dependencies
    const deps = this.getTransitiveDependencies(moduleDirPath, graph.nodes);

    // Sort by execution order
    return graph.executionOrder.filter(p => deps.has(p) || p === moduleDirPath);
  }

  // ============================================================================
  // Graph Utilities
  // ============================================================================

  /**
   * Detect cycles in the dependency graph
   */
  private detectCycles(nodes: Map<string, DependencyNode>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodePath: string): void => {
      visited.add(nodePath);
      recursionStack.add(nodePath);
      path.push(nodePath);

      const node = nodes.get(nodePath);
      if (node) {
        for (const depPath of node.dependencies) {
          if (!visited.has(depPath)) {
            dfs(depPath);
          } else if (recursionStack.has(depPath)) {
            // Found cycle
            const cycleStart = path.indexOf(depPath);
            cycles.push([...path.slice(cycleStart), depPath]);
          }
        }
      }

      path.pop();
      recursionStack.delete(nodePath);
    };

    for (const nodePath of nodes.keys()) {
      if (!visited.has(nodePath)) {
        dfs(nodePath);
      }
    }

    return cycles;
  }

  /**
   * Topological sort of dependency graph
   */
  private topologicalSort(nodes: Map<string, DependencyNode>): string[] {
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];

    // Initialize in-degrees
    for (const [nodePath, node] of nodes) {
      inDegree.set(nodePath, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(nodePath);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const node = nodes.get(current);
      if (node) {
        for (const dependent of node.dependents) {
          const degree = (inDegree.get(dependent) ?? 0) - 1;
          inDegree.set(dependent, degree);
          if (degree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get transitive dependencies
   */
  private getTransitiveDependencies(
    modulePath: string,
    nodes: Map<string, DependencyNode>
  ): Set<string> {
    const deps = new Set<string>();
    const visited = new Set<string>();

    const collect = (path: string): void => {
      if (visited.has(path)) return;
      visited.add(path);

      const node = nodes.get(path);
      if (node) {
        for (const depPath of node.dependencies) {
          deps.add(depPath);
          collect(depPath);
        }
      }
    };

    collect(modulePath);
    return deps;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Parse and cache a Terragrunt file
   */
  private async parseAndCache(filePath: string): Promise<TerragruntFile | null> {
    // Check cache
    if (this.parsedFiles.has(filePath)) {
      return this.parsedFiles.get(filePath)!;
    }

    // Parse file
    const result = await parseTerragruntFile(filePath);
    if (!isParseSuccess(result)) {
      return null;
    }

    this.parsedFiles.set(filePath, result.data);
    return result.data;
  }

  /**
   * Find all terragrunt.hcl files in a directory
   */
  private async findTerragruntFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const excludePatterns = ['.terragrunt-cache', 'node_modules', '.git'];

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (excludePatterns.some(p => entry.name.includes(p))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.name === 'terragrunt.hcl') {
            files.push(fullPath);
          }
        }
      } catch {
        // Ignore permission errors, etc.
      }
    };

    await walkDir(dirPath);
    return files;
  }

  /**
   * Find project root (directory containing root terragrunt.hcl or .git)
   */
  private findProjectRoot(startPath: string): string {
    let current = path.dirname(path.resolve(startPath));
    const root = path.parse(current).root;

    while (current !== root) {
      // Check for root terragrunt.hcl (one with only includes, no dependencies)
      const tgPath = path.join(current, 'terragrunt.hcl');
      if (fs.existsSync(tgPath)) {
        // Check if it looks like a root config
        const content = fs.readFileSync(tgPath, 'utf-8');
        if (!content.includes('dependency') && !content.includes('include')) {
          return current;
        }
      }

      // Check for .git
      if (fs.existsSync(path.join(current, '.git'))) {
        return current;
      }

      current = path.dirname(current);
    }

    return path.dirname(path.resolve(startPath));
  }

  /**
   * Clear parsed file cache
   */
  clearCache(): void {
    this.parsedFiles.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new hierarchy service
 */
export function createHierarchyService(options?: HierarchyOptions): TerragruntHierarchyService {
  return new TerragruntHierarchyService(options);
}

/**
 * Build hierarchy from a file
 */
export async function buildHierarchy(
  filePath: string,
  options?: HierarchyOptions
): Promise<HierarchyNode> {
  const service = createHierarchyService(options);
  return service.buildHierarchy(filePath, options);
}

/**
 * Get merged configuration
 */
export async function getMergedConfiguration(
  filePath: string,
  options?: HierarchyOptions
): Promise<MergedConfiguration> {
  const service = createHierarchyService(options);
  return service.getMergedConfiguration(filePath, options);
}

/**
 * Build dependency graph
 */
export async function buildDependencyGraph(
  projectPath: string,
  options?: HierarchyOptions
): Promise<DependencyGraph> {
  const service = createHierarchyService(options);
  return service.buildDependencyGraph(projectPath, options);
}

/**
 * Get execution order for a module
 */
export async function getExecutionOrder(
  modulePath: string,
  options?: HierarchyOptions
): Promise<string[]> {
  const service = createHierarchyService(options);
  return service.getExecutionOrder(modulePath, options);
}
