/**
 * Terragrunt Edge Creation Service
 * @module services/terragrunt-edge-service
 *
 * TASK-TG-008: Domain service for creating Terragrunt graph edges from node factory results.
 *
 * This service orchestrates the creation of all Terragrunt edge types:
 * - tg_includes: Include relationships (child -> parent config)
 * - tg_depends_on: Dependency relationships (config -> dependency config)
 * - tg_sources: Terraform source relationships (TG config -> TF module)
 *
 * Integrates with:
 * - edge-factory: Creates individual edge instances
 * - tf-linker: Resolves terraform.source references
 * - node-factory: Consumes BatchTerragruntNodeResult
 *
 * Design Principles:
 * - Stateless service with dependency injection
 * - Pure edge creation with no side effects
 * - Comprehensive error handling and statistics
 * - Support for synthetic node creation for external sources
 */

import pino from 'pino';
import {
  GraphEdge,
  TerraformModuleNode,
  TerragruntConfigNode,
} from '../types/graph';
import {
  BatchTerragruntNodeResult,
  DependencyHint,
  IncludeHint,
} from '../parsers/terragrunt/node-factory';
import {
  createTgIncludesEdge,
  createTgDependsOnEdge,
  createTgSourcesEdge,
  TgEdgeFactoryOptions,
  TgIncludesEdgeOptions,
  TgDependsOnEdgeOptions,
  TgSourcesEdgeOptions,
  TgEdge,
  TG_EDGE_TYPES,
  TgEdgeType,
  createEvidenceBuilder,
  TgEdgeEvidence,
} from '../parsers/terragrunt/edge-factory';
import {
  ITerraformLinker,
  createTerraformLinker,
  TfLinkerContext,
  TfLinkerResult,
  TerraformSourceType,
} from '../parsers/terragrunt/tf-linker';
import {
  TerragruntEdgeError,
  SourceResolutionError,
  BatchEdgeError,
  wrapEdgeError,
  wrapSourceError,
  canContinueAfterEdgeError,
  isTerragruntEdgeError,
  isSourceResolutionError,
} from '../parsers/terragrunt/errors';

const logger = pino({ name: 'terragrunt-edge-service' });

// ============================================================================
// Service Interfaces and Types
// ============================================================================

/**
 * Context for edge creation operations.
 * Provides necessary context for resolving references and creating edges.
 */
export interface EdgeCreationContext {
  /** Unique identifier for the current scan */
  readonly scanId: string;
  /** Tenant ID for multi-tenant isolation */
  readonly tenantId: string;
  /** Root directory of the repository */
  readonly repositoryRoot: string;
  /** Map of existing Terraform module paths to node IDs */
  readonly existingTfModules: Map<string, string>;
  /** Optional custom ID generator */
  readonly idGenerator?: () => string;
}

/**
 * Result of edge creation from node factory output.
 * Contains all created edges, synthetic nodes, and statistics.
 */
export interface TerragruntEdgeResult {
  /** All created graph edges */
  readonly edges: readonly GraphEdge[];
  /** Synthetic TerraformModuleNode instances for external sources */
  readonly syntheticNodes: readonly TerraformModuleNode[];
  /** References that could not be resolved */
  readonly unresolvedReferences: readonly UnresolvedReference[];
  /** Edge creation statistics */
  readonly statistics: EdgeStatistics;
}

/**
 * An unresolved reference that could not be linked.
 */
export interface UnresolvedReference {
  /** Type of reference (include, dependency, source) */
  readonly type: 'include' | 'dependency' | 'source';
  /** Source node ID where the reference occurs */
  readonly sourceNodeId: string;
  /** Target path that could not be resolved */
  readonly targetPath: string;
  /** Reason for failure */
  readonly reason: string;
  /** Original hint if available */
  readonly hint?: DependencyHint | IncludeHint | string;
  /** Error code if structured error was raised */
  readonly errorCode?: string;
  /** Original error if available */
  readonly error?: TerragruntEdgeError | SourceResolutionError;
}

/**
 * Statistics about edge creation.
 */
export interface EdgeStatistics {
  /** Total edges created */
  readonly totalEdges: number;
  /** Edges by type */
  readonly edgesByType: Record<TgEdgeType, number>;
  /** Number of synthetic nodes created */
  readonly syntheticNodesCreated: number;
  /** Number of unresolved references */
  readonly unresolvedCount: number;
  /** Average confidence score */
  readonly averageConfidence: number;
  /** Processing time in milliseconds */
  readonly processingTimeMs: number;
  /** Breakdown of source types for tg_sources edges */
  readonly sourceTypeBreakdown: Record<TerraformSourceType, number>;
}

/**
 * Configuration options for the edge service.
 */
export interface TerragruntEdgeServiceOptions {
  /** Whether to create edges for unresolved references with lower confidence */
  readonly createEdgesForUnresolved?: boolean;
  /** Minimum confidence threshold for edge creation */
  readonly minConfidenceThreshold?: number;
  /** Custom TerraformLinker instance */
  readonly linker?: ITerraformLinker;
  /** Logger instance */
  readonly logger?: pino.Logger;
}

/**
 * Default service options.
 */
export const DEFAULT_EDGE_SERVICE_OPTIONS: Required<TerragruntEdgeServiceOptions> = {
  createEdgesForUnresolved: false,
  minConfidenceThreshold: 0,
  linker: createTerraformLinker(),
  logger: pino({ name: 'terragrunt-edge-service' }),
};

// ============================================================================
// ITerragruntEdgeService Interface
// ============================================================================

/**
 * Interface for the Terragrunt edge creation service.
 *
 * This service transforms node factory results into graph edges,
 * handling the complexity of include, dependency, and source relationships.
 *
 * @example
 * ```typescript
 * const edgeService = createTerragruntEdgeService();
 *
 * const nodeResult = createAllTerragruntNodesFromFiles(files, nodeOptions);
 *
 * const edgeResult = edgeService.createEdgesFromNodeResult(nodeResult, {
 *   scanId: 'scan-123',
 *   tenantId: 'tenant-456',
 *   repositoryRoot: '/repo',
 *   existingTfModules: tfModuleMap,
 * });
 *
 * // Add edges to graph
 * for (const edge of edgeResult.edges) {
 *   graphBuilder.addEdge(edge);
 * }
 *
 * // Add synthetic nodes for external sources
 * for (const node of edgeResult.syntheticNodes) {
 *   graphBuilder.addNode(node);
 * }
 * ```
 */
export interface ITerragruntEdgeService {
  /**
   * Create all edges from a batch node factory result.
   *
   * Processes include hints, dependency hints, and terraform sources
   * to create the corresponding graph edges.
   *
   * @param nodeResult - Result from createAllTerragruntNodesFromFiles
   * @param context - Edge creation context
   * @returns Result containing edges, synthetic nodes, and statistics
   */
  createEdgesFromNodeResult(
    nodeResult: BatchTerragruntNodeResult,
    context: EdgeCreationContext
  ): TerragruntEdgeResult;

  /**
   * Create include edges from include hints.
   *
   * @param hints - Include hints from node factory
   * @param factoryOptions - Edge factory options
   * @returns Created include edges
   */
  createIncludeEdges(
    hints: readonly IncludeHint[],
    factoryOptions: TgEdgeFactoryOptions
  ): readonly TgEdge[];

  /**
   * Create dependency edges from dependency hints.
   *
   * @param hints - Dependency hints from node factory
   * @param factoryOptions - Edge factory options
   * @returns Created dependency edges
   */
  createDependencyEdges(
    hints: readonly DependencyHint[],
    factoryOptions: TgEdgeFactoryOptions
  ): readonly TgEdge[];

  /**
   * Create source edges from config nodes with terraform.source.
   *
   * Uses TerraformLinker to resolve sources and create appropriate edges.
   *
   * @param configNodes - Terragrunt config nodes
   * @param context - Edge creation context
   * @param factoryOptions - Edge factory options
   * @returns Result containing edges and synthetic nodes
   */
  createSourceEdges(
    configNodes: readonly TerragruntConfigNode[],
    context: EdgeCreationContext,
    factoryOptions: TgEdgeFactoryOptions
  ): SourceEdgeCreationResult;
}

/**
 * Result of source edge creation.
 */
export interface SourceEdgeCreationResult {
  /** Created source edges */
  readonly edges: readonly TgEdge[];
  /** Synthetic nodes created for external sources */
  readonly syntheticNodes: readonly TerraformModuleNode[];
  /** Unresolved source references */
  readonly unresolved: readonly UnresolvedReference[];
}

// ============================================================================
// TerragruntEdgeService Implementation
// ============================================================================

/**
 * Implementation of ITerragruntEdgeService.
 *
 * Provides comprehensive edge creation from Terragrunt node factory results,
 * including support for include, dependency, and terraform source relationships.
 */
export class TerragruntEdgeService implements ITerragruntEdgeService {
  private readonly options: Required<TerragruntEdgeServiceOptions>;
  private readonly linker: ITerraformLinker;
  private readonly log: pino.Logger;

  constructor(options: TerragruntEdgeServiceOptions = {}) {
    this.options = {
      ...DEFAULT_EDGE_SERVICE_OPTIONS,
      ...options,
    };
    this.linker = this.options.linker;
    this.log = this.options.logger;
  }

  /**
   * Create all edges from a batch node factory result.
   */
  createEdgesFromNodeResult(
    nodeResult: BatchTerragruntNodeResult,
    context: EdgeCreationContext
  ): TerragruntEdgeResult {
    const startTime = Date.now();

    this.log.info({
      configNodeCount: nodeResult.configNodes.length,
      includeHintCount: nodeResult.includeHints.length,
      dependencyHintCount: nodeResult.dependencyHints.length,
    }, 'Starting edge creation from node result');

    const allEdges: TgEdge[] = [];
    const allSyntheticNodes: TerraformModuleNode[] = [];
    const allUnresolved: UnresolvedReference[] = [];

    // Create factory options
    const factoryOptions: TgEdgeFactoryOptions = {
      scanId: context.scanId,
      idGenerator: context.idGenerator,
    };

    // 1. Create include edges
    const includeEdges = this.createIncludeEdges(
      nodeResult.includeHints,
      factoryOptions
    );
    allEdges.push(...includeEdges);

    // Track unresolved includes
    for (const hint of nodeResult.includeHints) {
      if (!hint.targetId && hint.resolved === false) {
        allUnresolved.push({
          type: 'include',
          sourceNodeId: hint.sourceId,
          targetPath: hint.targetPath,
          reason: 'Include target not found in processed files',
          hint,
        });
      }
    }

    // 2. Create dependency edges
    const dependencyEdges = this.createDependencyEdges(
      nodeResult.dependencyHints,
      factoryOptions
    );
    allEdges.push(...dependencyEdges);

    // Track unresolved dependencies
    for (const hint of nodeResult.dependencyHints) {
      if (!hint.targetId && hint.resolved === false) {
        allUnresolved.push({
          type: 'dependency',
          sourceNodeId: hint.sourceId,
          targetPath: hint.targetPath,
          reason: 'Dependency target not found in processed files',
          hint,
        });
      }
    }

    // 3. Create source edges using TerraformLinker
    const sourceResult = this.createSourceEdges(
      nodeResult.configNodes,
      context,
      factoryOptions
    );
    allEdges.push(...sourceResult.edges);
    allSyntheticNodes.push(...sourceResult.syntheticNodes);
    allUnresolved.push(...sourceResult.unresolved);

    // Calculate statistics
    const statistics = this.calculateStatistics(
      allEdges,
      allSyntheticNodes,
      allUnresolved,
      sourceResult,
      startTime
    );

    this.log.info({
      totalEdges: statistics.totalEdges,
      syntheticNodes: statistics.syntheticNodesCreated,
      unresolved: statistics.unresolvedCount,
      processingTimeMs: statistics.processingTimeMs,
    }, 'Edge creation completed');

    return {
      edges: allEdges,
      syntheticNodes: allSyntheticNodes,
      unresolvedReferences: allUnresolved,
      statistics,
    };
  }

  /**
   * Create include edges from include hints.
   */
  createIncludeEdges(
    hints: readonly IncludeHint[],
    factoryOptions: TgEdgeFactoryOptions
  ): readonly TgEdge[] {
    const edges: TgEdge[] = [];

    for (const hint of hints) {
      // Skip hints without resolved targets unless configured to include them
      if (!hint.targetId) {
        if (!this.options.createEdgesForUnresolved) {
          continue;
        }
      }

      try {
        // Build evidence for the edge
        const evidence = this.buildIncludeEvidence(hint);

        // Skip if below confidence threshold
        const avgConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
        if (avgConfidence < this.options.minConfidenceThreshold) {
          continue;
        }

        const edgeOptions: TgIncludesEdgeOptions = {
          sourceNodeId: hint.sourceId,
          targetNodeId: hint.targetId || `unresolved:${hint.targetPath}`,
          includeName: hint.includeLabel,
          mergeStrategy: hint.mergeStrategy,
          inheritedBlocks: [], // Would need AST analysis to determine
          exposeAsVariable: false, // Not available in hint
          evidence,
        };

        const edge = createTgIncludesEdge(edgeOptions, factoryOptions);
        edges.push(edge);
      } catch (error) {
        // Wrap error with structured type
        const edgeError = isTerragruntEdgeError(error)
          ? error
          : wrapEdgeError(error, TG_EDGE_TYPES.INCLUDES, {
              sourceNodeId: hint.sourceId,
              targetNodeId: hint.targetId,
            });

        this.log.warn({
          hint,
          errorCode: edgeError.code,
          error: edgeError.message,
        }, 'Failed to create include edge');

        // Check if we can continue after this error
        if (!canContinueAfterEdgeError(edgeError)) {
          throw edgeError;
        }
      }
    }

    return edges;
  }

  /**
   * Create dependency edges from dependency hints.
   */
  createDependencyEdges(
    hints: readonly DependencyHint[],
    factoryOptions: TgEdgeFactoryOptions
  ): readonly TgEdge[] {
    const edges: TgEdge[] = [];

    for (const hint of hints) {
      // Skip hints without resolved targets unless configured
      if (!hint.targetId) {
        if (!this.options.createEdgesForUnresolved) {
          continue;
        }
      }

      try {
        // Build evidence for the edge
        const evidence = this.buildDependencyEvidence(hint);

        // Skip if below confidence threshold
        const avgConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
        if (avgConfidence < this.options.minConfidenceThreshold) {
          continue;
        }

        const edgeOptions: TgDependsOnEdgeOptions = {
          sourceNodeId: hint.sourceId,
          targetNodeId: hint.targetId || `unresolved:${hint.targetPath}`,
          dependencyName: hint.dependencyName,
          skipOutputs: false, // Not available in hint
          outputsConsumed: [], // Would need AST analysis to determine
          hasMockOutputs: false, // Not available in hint
          evidence,
        };

        const edge = createTgDependsOnEdge(edgeOptions, factoryOptions);
        edges.push(edge);
      } catch (error) {
        // Wrap error with structured type
        const edgeError = isTerragruntEdgeError(error)
          ? error
          : wrapEdgeError(error, TG_EDGE_TYPES.DEPENDS_ON, {
              sourceNodeId: hint.sourceId,
              targetNodeId: hint.targetId,
            });

        this.log.warn({
          hint,
          errorCode: edgeError.code,
          error: edgeError.message,
        }, 'Failed to create dependency edge');

        // Check if we can continue after this error
        if (!canContinueAfterEdgeError(edgeError)) {
          throw edgeError;
        }
      }
    }

    return edges;
  }

  /**
   * Create source edges from config nodes with terraform.source.
   */
  createSourceEdges(
    configNodes: readonly TerragruntConfigNode[],
    context: EdgeCreationContext,
    factoryOptions: TgEdgeFactoryOptions
  ): SourceEdgeCreationResult {
    const edges: TgEdge[] = [];
    const syntheticNodes: TerraformModuleNode[] = [];
    const unresolved: UnresolvedReference[] = [];

    for (const configNode of configNodes) {
      // Skip configs without terraform.source
      if (!configNode.terraformSource) {
        continue;
      }

      try {
        // Parse the source expression
        const source = this.linker.parseSource(configNode.terraformSource);

        // Build linker context for this config
        const linkerContext: TfLinkerContext = {
          scanId: context.scanId,
          tenantId: context.tenantId,
          configPath: configNode.metadata.absolutePath as string || configNode.location.file,
          repositoryRoot: context.repositoryRoot,
          existingTfModules: context.existingTfModules,
        };

        // Resolve the source
        const result = this.linker.resolve(source, linkerContext);

        if (!result.success) {
          const sourceError = SourceResolutionError.unresolvable(
            configNode.terraformSource,
            source.type,
            result.error,
            {
              configPath: configNode.metadata.absolutePath as string || configNode.location.file,
              repositoryRoot: context.repositoryRoot,
            }
          );

          unresolved.push({
            type: 'source',
            sourceNodeId: configNode.id,
            targetPath: configNode.terraformSource,
            reason: result.error || 'Failed to resolve source',
            hint: configNode.terraformSource,
            errorCode: sourceError.code,
            error: sourceError,
          });
          continue;
        }

        // Collect synthetic node if created
        if (result.isSynthetic && result.syntheticNode) {
          syntheticNodes.push(result.syntheticNode);
        }

        // Build evidence for the source edge
        const evidence = this.buildSourceEvidence(configNode, source.type);

        // Create the source edge
        const edgeOptions: TgSourcesEdgeOptions = {
          sourceNodeId: configNode.id,
          targetNodeId: result.targetNodeId,
          sourceExpression: configNode.terraformSource,
          sourceType: this.mapSourceType(source.type),
          versionConstraint: source.version || source.ref || null,
          evidence,
        };

        const edge = createTgSourcesEdge(edgeOptions, factoryOptions);
        edges.push(edge);
      } catch (error) {
        // Wrap error with structured type
        const sourceError = isSourceResolutionError(error)
          ? error
          : isTerragruntEdgeError(error)
            ? error
            : wrapSourceError(error, configNode.terraformSource, {
                configPath: configNode.metadata.absolutePath as string || configNode.location.file,
                repositoryRoot: context.repositoryRoot,
              });

        this.log.warn({
          configNodeId: configNode.id,
          terraformSource: configNode.terraformSource,
          errorCode: sourceError.code,
          error: sourceError.message,
        }, 'Failed to create source edge');

        unresolved.push({
          type: 'source',
          sourceNodeId: configNode.id,
          targetPath: configNode.terraformSource,
          reason: sourceError.message,
          hint: configNode.terraformSource,
          errorCode: sourceError.code,
          error: sourceError as SourceResolutionError,
        });

        // Check if we can continue after this error
        if (!canContinueAfterEdgeError(sourceError as TerragruntEdgeError | SourceResolutionError)) {
          throw sourceError;
        }
      }
    }

    return { edges, syntheticNodes, unresolved };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build evidence for an include edge.
   */
  private buildIncludeEvidence(hint: IncludeHint): TgEdgeEvidence[] {
    const evidence: TgEdgeEvidence[] = [];

    // Primary evidence: the include block itself
    evidence.push(
      createEvidenceBuilder()
        .file(hint.targetPath)
        .line(1)
        .snippet(`include "${hint.includeLabel}" { path = ... }`)
        .confidence(hint.resolved ? 95 : 60)
        .type(hint.resolved ? 'explicit' : 'inferred')
        .description(
          hint.resolved
            ? `Explicit include block with label "${hint.includeLabel}"`
            : `Unresolved include block with label "${hint.includeLabel}"`
        )
        .build()
    );

    return evidence;
  }

  /**
   * Build evidence for a dependency edge.
   */
  private buildDependencyEvidence(hint: DependencyHint): TgEdgeEvidence[] {
    const evidence: TgEdgeEvidence[] = [];

    // Primary evidence: the dependency block itself
    evidence.push(
      createEvidenceBuilder()
        .file(hint.targetPath)
        .line(1)
        .snippet(`dependency "${hint.dependencyName}" { config_path = ... }`)
        .confidence(hint.resolved ? 95 : 60)
        .type(hint.resolved ? 'explicit' : 'inferred')
        .description(
          hint.resolved
            ? `Explicit dependency block with name "${hint.dependencyName}"`
            : `Unresolved dependency block with name "${hint.dependencyName}"`
        )
        .build()
    );

    return evidence;
  }

  /**
   * Build evidence for a source edge.
   */
  private buildSourceEvidence(
    configNode: TerragruntConfigNode,
    sourceType: TerraformSourceType
  ): TgEdgeEvidence[] {
    const evidence: TgEdgeEvidence[] = [];

    // Primary evidence: the terraform.source block
    evidence.push(
      createEvidenceBuilder()
        .file(configNode.location.file)
        .lines(configNode.location.lineStart, configNode.location.lineEnd)
        .snippet(`terraform { source = "${configNode.terraformSource}" }`)
        .confidence(sourceType === 'local' ? 95 : 90)
        .explicit()
        .description(
          `Terraform source reference of type "${sourceType}"`
        )
        .build()
    );

    return evidence;
  }

  /**
   * Map TerraformSourceType to edge sourceType.
   * The edge factory uses a slightly different type set.
   */
  private mapSourceType(
    type: TerraformSourceType
  ): 'local' | 'git' | 'registry' | 's3' | 'gcs' | 'http' | 'unknown' {
    switch (type) {
      case 'local':
        return 'local';
      case 'registry':
        return 'registry';
      case 'git':
      case 'github':
        return 'git';
      case 's3':
        return 's3';
      case 'gcs':
        return 'gcs';
      case 'http':
        return 'http';
      default:
        return 'unknown';
    }
  }

  /**
   * Calculate comprehensive statistics for the edge creation result.
   */
  private calculateStatistics(
    edges: readonly TgEdge[],
    syntheticNodes: readonly TerraformModuleNode[],
    unresolved: readonly UnresolvedReference[],
    sourceResult: SourceEdgeCreationResult,
    startTime: number
  ): EdgeStatistics {
    // Initialize edge counts by type
    const edgesByType: Record<TgEdgeType, number> = {
      [TG_EDGE_TYPES.INCLUDES]: 0,
      [TG_EDGE_TYPES.DEPENDS_ON]: 0,
      [TG_EDGE_TYPES.PASSES_INPUT]: 0,
      [TG_EDGE_TYPES.SOURCES]: 0,
    };

    // Initialize source type breakdown
    const sourceTypeBreakdown: Record<TerraformSourceType, number> = {
      local: 0,
      registry: 0,
      git: 0,
      github: 0,
      s3: 0,
      gcs: 0,
      http: 0,
      unknown: 0,
    };

    // Count edges by type and calculate confidence
    let totalConfidence = 0;
    for (const edge of edges) {
      edgesByType[edge.type]++;
      totalConfidence += edge.confidence;

      // Track source types for tg_sources edges
      if (edge.type === TG_EDGE_TYPES.SOURCES) {
        const sourceEdge = edge as { sourceType?: TerraformSourceType };
        if (sourceEdge.sourceType) {
          // Map edge sourceType back to TerraformSourceType
          const mappedType = sourceEdge.sourceType === 'git' ? 'git' : sourceEdge.sourceType;
          if (mappedType in sourceTypeBreakdown) {
            sourceTypeBreakdown[mappedType as TerraformSourceType]++;
          }
        }
      }
    }

    const averageConfidence = edges.length > 0
      ? Math.round(totalConfidence / edges.length)
      : 0;

    return {
      totalEdges: edges.length,
      edgesByType,
      syntheticNodesCreated: syntheticNodes.length,
      unresolvedCount: unresolved.length,
      averageConfidence,
      processingTimeMs: Date.now() - startTime,
      sourceTypeBreakdown,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new TerragruntEdgeService instance.
 *
 * @param options - Service configuration options
 * @returns New ITerragruntEdgeService instance
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const service = createTerragruntEdgeService();
 *
 * // Create with custom options
 * const service = createTerragruntEdgeService({
 *   createEdgesForUnresolved: true,
 *   minConfidenceThreshold: 50,
 * });
 * ```
 */
export function createTerragruntEdgeService(
  options: TerragruntEdgeServiceOptions = {}
): ITerragruntEdgeService {
  return new TerragruntEdgeService(options);
}

/**
 * Create edges from node result using default service.
 * Convenience function for one-off edge creation.
 *
 * @param nodeResult - Result from node factory
 * @param context - Edge creation context
 * @returns Edge creation result
 */
export function createEdgesFromNodeResult(
  nodeResult: BatchTerragruntNodeResult,
  context: EdgeCreationContext
): TerragruntEdgeResult {
  const service = createTerragruntEdgeService();
  return service.createEdgesFromNodeResult(nodeResult, context);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate edge creation context.
 *
 * @param context - Context to validate
 * @throws TerragruntEdgeError if context is invalid
 */
export function validateEdgeCreationContext(context: EdgeCreationContext): void {
  if (!context.scanId || typeof context.scanId !== 'string') {
    throw TerragruntEdgeError.missingField('scanId', 'EdgeCreationContext', {
      details: { context: 'EdgeCreationContext' },
    });
  }
  if (!context.tenantId || typeof context.tenantId !== 'string') {
    throw TerragruntEdgeError.missingField('tenantId', 'EdgeCreationContext', {
      details: { context: 'EdgeCreationContext' },
    });
  }
  if (!context.repositoryRoot || typeof context.repositoryRoot !== 'string') {
    throw TerragruntEdgeError.missingField('repositoryRoot', 'EdgeCreationContext', {
      details: { context: 'EdgeCreationContext' },
    });
  }
  if (!(context.existingTfModules instanceof Map)) {
    throw TerragruntEdgeError.invalidFieldValue(
      'existingTfModules',
      'Map<string, string>',
      typeof context.existingTfModules,
      'EdgeCreationContext',
      { details: { context: 'EdgeCreationContext' } }
    );
  }
}

/**
 * Check if edge result has unresolved references.
 *
 * @param result - Edge creation result
 * @returns true if there are unresolved references
 */
export function hasUnresolvedReferences(result: TerragruntEdgeResult): boolean {
  return result.unresolvedReferences.length > 0;
}

/**
 * Filter edges by type.
 *
 * @param edges - Array of edges
 * @param type - Edge type to filter
 * @returns Filtered edges
 */
export function filterEdgesByType<T extends TgEdge>(
  edges: readonly GraphEdge[],
  type: TgEdgeType
): T[] {
  return edges.filter(e => e.type === type) as T[];
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export {
  TgEdgeFactoryOptions,
  TgEdge,
  TgIncludesEdge,
  TgDependsOnEdge,
  TgPassesInputEdge,
  TgSourcesEdge,
  TG_EDGE_TYPES,
  isTgIncludesEdge,
  isTgDependsOnEdge,
  isTgSourcesEdge,
  isTgEdge,
} from '../parsers/terragrunt/edge-factory';

export {
  TfLinkerContext,
  TfLinkerResult,
  TerraformSourceType,
  TerraformSourceExpression,
  ITerraformLinker,
  createTerraformLinker,
  createLinkerContext,
  buildModuleMap,
  isSuccessfulResolution,
  isSyntheticResolution,
} from '../parsers/terragrunt/tf-linker';

export {
  BatchTerragruntNodeResult,
  DependencyHint,
  IncludeHint,
} from '../parsers/terragrunt/node-factory';

// Re-export edge error types for convenience
export {
  TerragruntEdgeError,
  SourceResolutionError,
  BatchEdgeError,
  wrapEdgeError,
  wrapSourceError,
  canContinueAfterEdgeError,
  isTerragruntEdgeError,
  isSourceResolutionError,
  isBatchEdgeError,
  type EdgeErrorContext,
  type SourceErrorContext,
  type BatchEdgeErrorContext,
  type EdgeErrorSummary,
  type EdgeRecoveryResult,
  attemptEdgeRecovery,
} from '../parsers/terragrunt/errors';
