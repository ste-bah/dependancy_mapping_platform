/**
 * Terragrunt Node Factory
 * @module parsers/terragrunt/node-factory
 *
 * TASK-TG-022: Factory functions for creating Terragrunt graph nodes
 * from parsed TerragruntFile objects.
 *
 * Supported Node Types:
 * - TerragruntConfigNode: Main configuration file nodes
 * - TerragruntIncludeNode: Include block nodes for parent config references
 * - TerragruntDependencyNode: Dependency block nodes for module references
 *
 * Design Principles:
 * - Pure factory functions with no side effects
 * - Type-safe node creation with proper validation
 * - Integration with metadata-extractor for consistent metadata extraction
 * - Support for batch creation from multiple files
 * - Dual factory pattern: from resolved types or from original blocks
 */

import { TerragruntConfigNode, TerragruntIncludeNode, TerragruntDependencyNode, NodeLocation } from '../../types/graph';
import { TerragruntFile, ResolvedInclude, ResolvedDependency, IncludeBlock, DependencyBlock } from './types';
import { extractTerragruntMetadata } from './metadata-extractor';
import { randomUUID } from 'crypto';
import * as path from 'path';

// ============================================================================
// Factory Options
// ============================================================================

/**
 * Options for TerragruntConfigNode factory functions
 */
export interface TerragruntNodeFactoryOptions {
  /** Unique identifier for the current scan/analysis session */
  readonly scanId: string;
  /** Root directory of the repository for relative path calculation */
  readonly repositoryRoot: string;
  /** Optional custom ID generator (defaults to randomUUID) */
  readonly idGenerator?: () => string;
}

/**
 * Default options for node factory
 */
export const DEFAULT_FACTORY_OPTIONS: Partial<TerragruntNodeFactoryOptions> = {
  idGenerator: () => randomUUID(),
};

// ============================================================================
// Main Factory Functions
// ============================================================================

/**
 * Create a TerragruntConfigNode from a parsed TerragruntFile.
 *
 * Transforms a TerragruntFile into a graph node suitable for visualization
 * and dependency analysis. Uses metadata-extractor for consistent metadata.
 *
 * @param file - The parsed TerragruntFile to transform
 * @param options - Factory options including scanId and repositoryRoot
 * @returns A new TerragruntConfigNode instance
 *
 * @example
 * ```typescript
 * const file = await parseTerragruntFile('/repo/env/dev/terragrunt.hcl');
 * const node = createTerragruntConfigNode(file, {
 *   scanId: 'scan-123',
 *   repositoryRoot: '/repo',
 * });
 * console.log(node.name); // => "dev"
 * console.log(node.location.file); // => "env/dev/terragrunt.hcl"
 * ```
 */
export function createTerragruntConfigNode(
  file: TerragruntFile,
  options: TerragruntNodeFactoryOptions
): TerragruntConfigNode {
  // Extract metadata using existing extractor
  const metadata = extractTerragruntMetadata(file);

  // Calculate relative path from repository root
  const relativePath = path.relative(options.repositoryRoot, file.path);

  // Derive node name from directory name (Terragrunt convention)
  const nodeName = deriveNodeName(file.path);

  // Generate unique ID
  const idGenerator = options.idGenerator ?? DEFAULT_FACTORY_OPTIONS.idGenerator!;
  const nodeId = idGenerator();

  // Create node location from file information
  const location = createNodeLocation(relativePath, file);

  return {
    id: nodeId,
    type: 'tg_config',
    name: nodeName,
    location,
    metadata: {
      scanId: options.scanId,
      absolutePath: file.path,
      encoding: metadata.encoding,
      size: metadata.size,
      blockCount: metadata.blockCount,
      errorCount: metadata.errorCount,
      dependencyNames: metadata.dependencyNames,
      includeLabels: metadata.includeLabels,
    },
    terraformSource: metadata.terraformSource,
    hasRemoteState: metadata.hasRemoteState,
    remoteStateBackend: metadata.remoteStateBackend,
    includeCount: metadata.includeCount,
    dependencyCount: metadata.dependencyCount,
    inputCount: metadata.inputCount,
    generateBlocks: metadata.generateBlocks,
  };
}

/**
 * Create a TerragruntIncludeNode from a ResolvedInclude.
 *
 * Transforms a resolved include block into a graph node suitable for
 * visualization and dependency analysis.
 *
 * @param include - The resolved include block
 * @param parentConfigId - ID of the parent TerragruntConfigNode
 * @param options - Factory options including scanId and repositoryRoot
 * @returns A new TerragruntIncludeNode instance
 *
 * @example
 * ```typescript
 * const includeNode = createTerragruntIncludeNode(
 *   file.includes[0],
 *   parentNode.id,
 *   { scanId: 'scan-123', repositoryRoot: '/repo' }
 * );
 * console.log(includeNode.label); // => "root"
 * ```
 */
export function createTerragruntIncludeNode(
  include: ResolvedInclude,
  parentConfigId: string,
  options: TerragruntNodeFactoryOptions
): TerragruntIncludeNode {
  const idGenerator = options.idGenerator ?? DEFAULT_FACTORY_OPTIONS.idGenerator!;
  const nodeId = idGenerator();

  return {
    id: nodeId,
    type: 'tg_include',
    name: include.label || 'unnamed',
    location: createIncludeLocation(include, options.repositoryRoot),
    metadata: {
      scanId: options.scanId,
      parentConfigId,
    },
    label: include.label || '',
    path: include.pathExpression.raw,
    resolvedPath: include.resolvedPath,
    expose: false, // ResolvedInclude doesn't have exposeAsVariable; default to false
    mergeStrategy: include.mergeStrategy,
  };
}

/**
 * Create a TerragruntIncludeNode from an IncludeBlock with full metadata.
 *
 * Use this factory when you have access to the original IncludeBlock
 * which contains additional properties like exposeAsVariable.
 *
 * @param block - The original include block from parsing
 * @param parentConfigId - ID of the parent TerragruntConfigNode
 * @param resolvedPath - Resolved absolute path (if available)
 * @param options - Factory options including scanId and repositoryRoot
 * @returns A new TerragruntIncludeNode instance
 */
export function createTerragruntIncludeNodeFromBlock(
  block: IncludeBlock,
  parentConfigId: string,
  resolvedPath: string | null,
  options: TerragruntNodeFactoryOptions
): TerragruntIncludeNode {
  const idGenerator = options.idGenerator ?? DEFAULT_FACTORY_OPTIONS.idGenerator!;
  const nodeId = idGenerator();

  // Calculate relative file path for location
  const relativeFile = path.relative(options.repositoryRoot, block.location.file);

  return {
    id: nodeId,
    type: 'tg_include',
    name: block.label || 'unnamed',
    location: {
      file: relativeFile,
      lineStart: block.location.startLine,
      lineEnd: block.location.endLine,
    },
    metadata: {
      scanId: options.scanId,
      parentConfigId,
    },
    label: block.label,
    path: block.path.raw,
    resolvedPath,
    expose: block.exposeAsVariable,
    mergeStrategy: block.mergeStrategy,
  };
}

/**
 * Create a TerragruntDependencyNode from a ResolvedDependency.
 *
 * Transforms a resolved dependency block into a graph node suitable for
 * visualization and dependency analysis.
 *
 * @param dependency - The resolved dependency block
 * @param parentConfigId - ID of the parent TerragruntConfigNode
 * @param options - Factory options including scanId and repositoryRoot
 * @returns A new TerragruntDependencyNode instance
 *
 * @example
 * ```typescript
 * const depNode = createTerragruntDependencyNode(
 *   file.dependencies[0],
 *   parentNode.id,
 *   { scanId: 'scan-123', repositoryRoot: '/repo' }
 * );
 * console.log(depNode.dependencyName); // => "vpc"
 * ```
 */
export function createTerragruntDependencyNode(
  dependency: ResolvedDependency,
  parentConfigId: string,
  options: TerragruntNodeFactoryOptions
): TerragruntDependencyNode {
  const idGenerator = options.idGenerator ?? DEFAULT_FACTORY_OPTIONS.idGenerator!;
  const nodeId = idGenerator();

  return {
    id: nodeId,
    type: 'tg_dependency',
    name: dependency.name,
    location: createDependencyLocation(dependency, options.repositoryRoot),
    metadata: {
      scanId: options.scanId,
      parentConfigId,
    },
    dependencyName: dependency.name,
    configPath: dependency.configPathExpression.raw,
    resolvedPath: dependency.resolvedPath,
    skipOutputs: false, // ResolvedDependency doesn't have skipOutputs; default to false
    hasMockOutputs: false, // ResolvedDependency doesn't have mockOutputs; default to false
  };
}

/**
 * Create a TerragruntDependencyNode from a DependencyBlock with full metadata.
 *
 * Use this factory when you have access to the original DependencyBlock
 * which contains additional properties like skipOutputs and mockOutputs.
 *
 * @param block - The original dependency block from parsing
 * @param parentConfigId - ID of the parent TerragruntConfigNode
 * @param resolvedPath - Resolved absolute path (if available)
 * @param options - Factory options including scanId and repositoryRoot
 * @returns A new TerragruntDependencyNode instance
 */
export function createTerragruntDependencyNodeFromBlock(
  block: DependencyBlock,
  parentConfigId: string,
  resolvedPath: string | null,
  options: TerragruntNodeFactoryOptions
): TerragruntDependencyNode {
  const idGenerator = options.idGenerator ?? DEFAULT_FACTORY_OPTIONS.idGenerator!;
  const nodeId = idGenerator();

  // Calculate relative file path for location
  const relativeFile = path.relative(options.repositoryRoot, block.location.file);

  return {
    id: nodeId,
    type: 'tg_dependency',
    name: block.name,
    location: {
      file: relativeFile,
      lineStart: block.location.startLine,
      lineEnd: block.location.endLine,
    },
    metadata: {
      scanId: options.scanId,
      parentConfigId,
    },
    dependencyName: block.name,
    configPath: block.configPath.raw,
    resolvedPath,
    skipOutputs: block.skipOutputs,
    hasMockOutputs: Object.keys(block.mockOutputs).length > 0,
  };
}

/**
 * Batch create TerragruntConfigNode instances from multiple files.
 *
 * Creates nodes for all provided files using the same factory options.
 * Useful for processing an entire directory of Terragrunt configurations.
 *
 * @param files - Array of parsed TerragruntFile objects
 * @param options - Factory options applied to all nodes
 * @returns Array of TerragruntConfigNode instances
 *
 * @example
 * ```typescript
 * const files = await parseDirectory('/repo/environments');
 * const nodes = createTerragruntConfigNodes(files, {
 *   scanId: 'scan-456',
 *   repositoryRoot: '/repo',
 * });
 * console.log(nodes.length); // Number of configs parsed
 * ```
 */
export function createTerragruntConfigNodes(
  files: readonly TerragruntFile[],
  options: TerragruntNodeFactoryOptions
): readonly TerragruntConfigNode[] {
  return files.map(file => createTerragruntConfigNode(file, options));
}

/**
 * Create nodes with additional context about relationships.
 *
 * Enhanced batch creation that also captures relationship hints
 * from dependencies and includes for later edge creation.
 *
 * @param files - Array of parsed TerragruntFile objects
 * @param options - Factory options applied to all nodes
 * @returns Object containing nodes and relationship hints
 */
export function createTerragruntConfigNodesWithRelationships(
  files: readonly TerragruntFile[],
  options: TerragruntNodeFactoryOptions
): TerragruntNodeFactoryResult {
  const nodes: TerragruntConfigNode[] = [];
  const dependencyHints: DependencyHint[] = [];
  const includeHints: IncludeHint[] = [];

  // Create a path-to-ID map for relationship resolution
  const pathToId = new Map<string, string>();

  // First pass: create all nodes
  for (const file of files) {
    const node = createTerragruntConfigNode(file, options);
    nodes.push(node);
    pathToId.set(file.path, node.id);
  }

  // Second pass: extract relationship hints
  for (const file of files) {
    const sourceId = pathToId.get(file.path);
    if (!sourceId) continue;

    // Extract dependency hints
    for (const dep of file.dependencies) {
      if (dep.resolvedPath) {
        const targetId = pathToId.get(dep.resolvedPath);
        dependencyHints.push({
          sourceId,
          targetPath: dep.resolvedPath,
          targetId: targetId ?? null,
          dependencyName: dep.name,
          resolved: dep.resolved,
        });
      }
    }

    // Extract include hints
    for (const inc of file.includes) {
      if (inc.resolvedPath) {
        const targetId = pathToId.get(inc.resolvedPath);
        includeHints.push({
          sourceId,
          targetPath: inc.resolvedPath,
          targetId: targetId ?? null,
          includeLabel: inc.label,
          mergeStrategy: inc.mergeStrategy,
          resolved: inc.resolved,
        });
      }
    }
  }

  return {
    nodes,
    dependencyHints,
    includeHints,
    pathToIdMap: pathToId,
  };
}

// ============================================================================
// Extended Factory Functions - All Node Types
// ============================================================================

/**
 * Create all node types from a single TerragruntFile.
 *
 * Creates TerragruntConfigNode, TerragruntIncludeNode, and TerragruntDependencyNode
 * instances from a parsed file, along with edge hints for relationship building.
 *
 * @param file - The parsed TerragruntFile to transform
 * @param options - Factory options including scanId and repositoryRoot
 * @returns Extended result with all node types and edge hints
 *
 * @example
 * ```typescript
 * const file = await parseTerragruntFile('/repo/env/dev/terragrunt.hcl');
 * const result = createAllTerragruntNodes(file, {
 *   scanId: 'scan-123',
 *   repositoryRoot: '/repo',
 * });
 * console.log(result.nodes.length); // => 1 (config node)
 * console.log(result.includeNodes.length); // => number of include blocks
 * console.log(result.dependencyNodes.length); // => number of dependency blocks
 * ```
 */
export function createAllTerragruntNodes(
  file: TerragruntFile,
  options: TerragruntNodeFactoryOptions
): ExtendedTerragruntNodeFactoryResult {
  // Create the main config node
  const configNode = createTerragruntConfigNode(file, options);

  // Create include nodes from file.includes
  const includeNodes = file.includes.map(inc =>
    createTerragruntIncludeNode(inc, configNode.id, options)
  );

  // Create dependency nodes from file.dependencies
  const dependencyNodes = file.dependencies.map(dep =>
    createTerragruntDependencyNode(dep, configNode.id, options)
  );

  // Build edge hints for relationships
  const dependencyHints = buildDependencyEdgeHints(configNode, dependencyNodes, file.dependencies);
  const includeHints = buildIncludeEdgeHints(configNode, includeNodes, file.includes);

  // Create path-to-ID map for this file
  const pathToIdMap = new Map<string, string>([[file.path, configNode.id]]);

  return {
    nodes: [configNode],
    includeNodes,
    dependencyNodes,
    dependencyHints,
    includeHints,
    pathToIdMap,
  };
}

/**
 * Process multiple TerragruntFiles and create all node types.
 *
 * Batch processes an array of parsed TerragruntFiles to create:
 * - TerragruntConfigNode for each file
 * - TerragruntIncludeNode for each include block
 * - TerragruntDependencyNode for each dependency block
 *
 * Also resolves cross-file edge targets using the aggregated pathToIdMap.
 *
 * @param files - Array of parsed TerragruntFile objects
 * @param options - Factory options applied to all nodes
 * @returns Aggregated result with all nodes and resolved edge hints
 *
 * @example
 * ```typescript
 * const files = await parseDirectory('/repo/environments');
 * const result = createAllTerragruntNodesFromFiles(files, {
 *   scanId: 'scan-456',
 *   repositoryRoot: '/repo',
 * });
 *
 * // All nodes ready for graph construction
 * console.log(result.configNodes.length);
 * console.log(result.includeNodes.length);
 * console.log(result.dependencyNodes.length);
 *
 * // Edge hints with resolved target IDs
 * result.dependencyHints.forEach(hint => {
 *   if (hint.targetId) {
 *     console.log(`${hint.sourceId} -> ${hint.targetId}`);
 *   }
 * });
 * ```
 */
export function createAllTerragruntNodesFromFiles(
  files: readonly TerragruntFile[],
  options: TerragruntNodeFactoryOptions
): BatchTerragruntNodeResult {
  const configNodes: TerragruntConfigNode[] = [];
  const includeNodes: TerragruntIncludeNode[] = [];
  const dependencyNodes: TerragruntDependencyNode[] = [];
  const allDependencyHints: DependencyHint[] = [];
  const allIncludeHints: IncludeHint[] = [];
  const pathToIdMap = new Map<string, string>();

  // First pass: create all nodes and collect hints
  for (const file of files) {
    const result = createAllTerragruntNodes(file, options);

    // Collect config nodes
    configNodes.push(...result.nodes);

    // Collect include nodes
    includeNodes.push(...result.includeNodes);

    // Collect dependency nodes
    dependencyNodes.push(...result.dependencyNodes);

    // Collect edge hints (unresolved)
    allDependencyHints.push(...result.dependencyHints);
    allIncludeHints.push(...result.includeHints);

    // Aggregate path-to-ID mappings
    result.pathToIdMap.forEach((id, filePath) => {
      pathToIdMap.set(filePath, id);
    });
  }

  // Second pass: resolve edge targets using the complete pathToIdMap
  const resolvedDependencyHints = resolveDependencyHintTargets(allDependencyHints, pathToIdMap);
  const resolvedIncludeHints = resolveIncludeHintTargets(allIncludeHints, pathToIdMap);

  return {
    configNodes,
    includeNodes,
    dependencyNodes,
    dependencyHints: resolvedDependencyHints,
    includeHints: resolvedIncludeHints,
    pathToIdMap,
  };
}

// ============================================================================
// Edge Hint Builder Functions
// ============================================================================

/**
 * Build dependency edge hints from a config node and its dependency nodes.
 *
 * Creates hints for:
 * 1. Config -> DependencyNode (contains relationship)
 * 2. DependencyNode -> Target Config (depends_on relationship)
 *
 * @param configNode - The parent config node
 * @param dependencyNodes - Created dependency nodes
 * @param resolvedDependencies - Original resolved dependencies with path info
 * @returns Array of dependency hints for edge creation
 */
function buildDependencyEdgeHints(
  configNode: TerragruntConfigNode,
  dependencyNodes: TerragruntDependencyNode[],
  resolvedDependencies: readonly ResolvedDependency[]
): DependencyHint[] {
  const hints: DependencyHint[] = [];

  // Create a map from dependency name to resolved dependency for lookup
  const resolvedMap = new Map<string, ResolvedDependency>();
  for (const dep of resolvedDependencies) {
    resolvedMap.set(dep.name, dep);
  }

  for (const depNode of dependencyNodes) {
    const resolved = resolvedMap.get(depNode.dependencyName);

    // Hint: DependencyNode points to its target config (if resolved)
    if (depNode.resolvedPath) {
      hints.push({
        sourceId: depNode.id,
        targetPath: depNode.resolvedPath,
        targetId: null, // Will be resolved in second pass
        dependencyName: depNode.dependencyName,
        resolved: resolved?.resolved ?? false,
      });
    }

    // Hint: ConfigNode contains this dependency
    hints.push({
      sourceId: configNode.id,
      targetPath: depNode.location.file,
      targetId: depNode.id,
      dependencyName: depNode.dependencyName,
      resolved: true, // Config always contains its own deps
    });
  }

  return hints;
}

/**
 * Build include edge hints from a config node and its include nodes.
 *
 * Creates hints for:
 * 1. Config -> IncludeNode (contains relationship)
 * 2. IncludeNode -> Target Config (inherits_from relationship)
 *
 * @param configNode - The parent config node
 * @param includeNodes - Created include nodes
 * @param resolvedIncludes - Original resolved includes with path info
 * @returns Array of include hints for edge creation
 */
function buildIncludeEdgeHints(
  configNode: TerragruntConfigNode,
  includeNodes: TerragruntIncludeNode[],
  resolvedIncludes: readonly ResolvedInclude[]
): IncludeHint[] {
  const hints: IncludeHint[] = [];

  // Create a map from include label to resolved include for lookup
  const resolvedMap = new Map<string, ResolvedInclude>();
  for (const inc of resolvedIncludes) {
    resolvedMap.set(inc.label, inc);
  }

  for (const incNode of includeNodes) {
    const resolved = resolvedMap.get(incNode.label);

    // Hint: IncludeNode points to its parent config (if resolved)
    if (incNode.resolvedPath) {
      hints.push({
        sourceId: incNode.id,
        targetPath: incNode.resolvedPath,
        targetId: null, // Will be resolved in second pass
        includeLabel: incNode.label,
        mergeStrategy: incNode.mergeStrategy,
        resolved: resolved?.resolved ?? false,
      });
    }

    // Hint: ConfigNode contains this include
    hints.push({
      sourceId: configNode.id,
      targetPath: incNode.location.file,
      targetId: incNode.id,
      includeLabel: incNode.label,
      mergeStrategy: incNode.mergeStrategy,
      resolved: true, // Config always contains its own includes
    });
  }

  return hints;
}

/**
 * Resolve dependency hint target IDs using the path-to-ID map.
 *
 * @param hints - Unresolved dependency hints
 * @param pathToIdMap - Map from file paths to node IDs
 * @returns Hints with resolved target IDs where possible
 */
function resolveDependencyHintTargets(
  hints: readonly DependencyHint[],
  pathToIdMap: ReadonlyMap<string, string>
): DependencyHint[] {
  return hints.map(hint => {
    // If targetId is already set (e.g., contains relationship), keep it
    if (hint.targetId !== null) {
      return hint;
    }

    // Try to resolve targetPath to an ID
    const resolvedTargetId = pathToIdMap.get(hint.targetPath) ?? null;

    return {
      ...hint,
      targetId: resolvedTargetId,
    };
  });
}

/**
 * Resolve include hint target IDs using the path-to-ID map.
 *
 * @param hints - Unresolved include hints
 * @param pathToIdMap - Map from file paths to node IDs
 * @returns Hints with resolved target IDs where possible
 */
function resolveIncludeHintTargets(
  hints: readonly IncludeHint[],
  pathToIdMap: ReadonlyMap<string, string>
): IncludeHint[] {
  return hints.map(hint => {
    // If targetId is already set (e.g., contains relationship), keep it
    if (hint.targetId !== null) {
      return hint;
    }

    // Try to resolve targetPath to an ID
    const resolvedTargetId = pathToIdMap.get(hint.targetPath) ?? null;

    return {
      ...hint,
      targetId: resolvedTargetId,
    };
  });
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Result of batch node creation with relationship hints
 */
export interface TerragruntNodeFactoryResult {
  /** Created TerragruntConfigNode instances */
  readonly nodes: readonly TerragruntConfigNode[];
  /** Hints about dependency relationships between configs */
  readonly dependencyHints: readonly DependencyHint[];
  /** Hints about include relationships between configs */
  readonly includeHints: readonly IncludeHint[];
  /** Map from file path to node ID for lookup */
  readonly pathToIdMap: ReadonlyMap<string, string>;
}

/**
 * Extended result type that includes all node types (config, include, dependency).
 * Used by createAllTerragruntNodes for comprehensive node creation.
 */
export interface ExtendedTerragruntNodeFactoryResult extends TerragruntNodeFactoryResult {
  /** Created TerragruntIncludeNode instances */
  readonly includeNodes: readonly TerragruntIncludeNode[];
  /** Created TerragruntDependencyNode instances */
  readonly dependencyNodes: readonly TerragruntDependencyNode[];
}

/**
 * Aggregated result from processing multiple TerragruntFiles.
 * Contains all node types and resolved edge hints for graph construction.
 */
export interface BatchTerragruntNodeResult {
  /** All created TerragruntConfigNode instances */
  readonly configNodes: readonly TerragruntConfigNode[];
  /** All created TerragruntIncludeNode instances */
  readonly includeNodes: readonly TerragruntIncludeNode[];
  /** All created TerragruntDependencyNode instances */
  readonly dependencyNodes: readonly TerragruntDependencyNode[];
  /** Dependency hints with resolved target IDs where possible */
  readonly dependencyHints: readonly DependencyHint[];
  /** Include hints with resolved target IDs where possible */
  readonly includeHints: readonly IncludeHint[];
  /** Map from absolute file path to node ID for cross-file lookups */
  readonly pathToIdMap: ReadonlyMap<string, string>;
}

/**
 * Hint about a dependency relationship for edge creation
 */
export interface DependencyHint {
  /** ID of the source node (the one with the dependency block) */
  readonly sourceId: string;
  /** Path to the dependency target */
  readonly targetPath: string;
  /** ID of the target node if it was created (null if external) */
  readonly targetId: string | null;
  /** Name of the dependency block */
  readonly dependencyName: string;
  /** Whether the dependency path was successfully resolved */
  readonly resolved: boolean;
}

/**
 * Hint about an include relationship for edge creation
 */
export interface IncludeHint {
  /** ID of the source node (the one with the include block) */
  readonly sourceId: string;
  /** Path to the include target */
  readonly targetPath: string;
  /** ID of the target node if it was created (null if external) */
  readonly targetId: string | null;
  /** Label of the include block */
  readonly includeLabel: string;
  /** Merge strategy used for the include */
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
  /** Whether the include path was successfully resolved */
  readonly resolved: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Derive a human-readable node name from a file path.
 *
 * Uses the directory name containing the terragrunt.hcl file,
 * following the Terragrunt convention where each module is in
 * its own directory.
 *
 * @param filePath - Absolute path to the terragrunt.hcl file
 * @returns Human-readable name for the node
 *
 * @example
 * ```typescript
 * deriveNodeName('/repo/env/dev/vpc/terragrunt.hcl'); // => "vpc"
 * deriveNodeName('/repo/terragrunt.hcl'); // => "repo" (root)
 * ```
 */
export function deriveNodeName(filePath: string): string {
  const dirPath = path.dirname(filePath);
  const dirName = path.basename(dirPath);

  // Handle edge case where file is at root
  if (!dirName || dirName === '.' || dirName === '/') {
    return 'root';
  }

  return dirName;
}

/**
 * Create a NodeLocation from a ResolvedInclude.
 *
 * Since ResolvedInclude doesn't directly contain location information,
 * we derive it from the resolved path when available, otherwise use
 * default location values.
 *
 * @param include - The resolved include
 * @param repositoryRoot - Root directory for relative path calculation
 * @returns NodeLocation for the include node
 */
function createIncludeLocation(
  include: ResolvedInclude,
  repositoryRoot: string
): NodeLocation {
  // ResolvedInclude doesn't have direct location info
  // Use resolved path for file if available
  const file = include.resolvedPath
    ? path.relative(repositoryRoot, include.resolvedPath)
    : '';

  return {
    file,
    lineStart: 1,
    lineEnd: 1,
  };
}

/**
 * Create a NodeLocation from a ResolvedDependency.
 *
 * Since ResolvedDependency doesn't directly contain location information,
 * we derive it from the resolved path when available, otherwise use
 * default location values.
 *
 * @param dependency - The resolved dependency
 * @param repositoryRoot - Root directory for relative path calculation
 * @returns NodeLocation for the dependency node
 */
function createDependencyLocation(
  dependency: ResolvedDependency,
  repositoryRoot: string
): NodeLocation {
  // ResolvedDependency doesn't have direct location info
  // Use resolved path for file if available
  const file = dependency.resolvedPath
    ? path.relative(repositoryRoot, dependency.resolvedPath)
    : '';

  return {
    file,
    lineStart: 1,
    lineEnd: 1,
  };
}

/**
 * Create a NodeLocation from file information.
 *
 * @param relativePath - Relative path from repository root
 * @param file - The parsed TerragruntFile
 * @returns NodeLocation for the graph node
 */
function createNodeLocation(
  relativePath: string,
  file: TerragruntFile
): NodeLocation {
  // Find the first and last block locations for line range
  const blocks = file.blocks;

  let lineStart = 1;
  let lineEnd = 1;

  if (blocks.length > 0) {
    // Get the earliest start line
    lineStart = Math.min(
      ...blocks.map(b => b.location.startLine)
    );
    // Get the latest end line
    lineEnd = Math.max(
      ...blocks.map(b => b.location.endLine)
    );
  }

  return {
    file: relativePath,
    lineStart,
    lineEnd,
  };
}

/**
 * Validate factory options before use.
 *
 * @param options - Options to validate
 * @throws Error if options are invalid
 */
export function validateFactoryOptions(
  options: TerragruntNodeFactoryOptions
): void {
  if (!options.scanId || typeof options.scanId !== 'string') {
    throw new Error('Factory options must include a valid scanId string');
  }

  if (!options.repositoryRoot || typeof options.repositoryRoot !== 'string') {
    throw new Error('Factory options must include a valid repositoryRoot path');
  }

  if (!path.isAbsolute(options.repositoryRoot)) {
    throw new Error('repositoryRoot must be an absolute path');
  }
}

/**
 * Create factory options with defaults.
 *
 * @param options - Partial options to merge with defaults
 * @returns Complete factory options
 */
export function createFactoryOptions(
  options: Partial<TerragruntNodeFactoryOptions> & {
    scanId: string;
    repositoryRoot: string;
  }
): TerragruntNodeFactoryOptions {
  return {
    ...DEFAULT_FACTORY_OPTIONS,
    ...options,
    idGenerator: options.idGenerator ?? DEFAULT_FACTORY_OPTIONS.idGenerator,
  };
}
