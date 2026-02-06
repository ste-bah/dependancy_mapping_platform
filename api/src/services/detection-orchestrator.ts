/**
 * Detection Orchestrator Service
 * @module services/detection-orchestrator
 *
 * Coordinates the detection pipeline for IaC dependency analysis.
 * Runs module detection, reference resolution, data source detection,
 * and evidence collection in sequence.
 *
 * TASK-DETECT-002, 003, 004, 005: Detection pipeline orchestration
 */

import pino from 'pino';
import {
  BaseDetector,
  DetectionContext,
  DetectionResult,
  DetectionOptions,
  EvidenceCollector,
  IEvidenceCollector,
  DEFAULT_DETECTION_OPTIONS,
  isDetectionSuccess,
  createDetectionContext,
} from '../detectors/index.js';
import {
  ReferenceResolver,
  ReferenceDetectionResult,
  createReferenceResolver,
} from '../detectors/reference-resolver.js';
import {
  DataSourceDetector,
  DataSourceDetectionResult,
  createDataSourceDetector,
} from '../detectors/data-source-detector.js';
import { moduleDetector, ModuleNode } from '../parsers/terraform/module-detector.js';
import { NodeType, GraphEdge, EdgeType } from '../types/graph.js';
import { Evidence, EvidenceCollection } from '../types/evidence.js';
import { ScanConfig } from '../types/entities.js';
import type { ParsedFile } from './parser-orchestrator.js';

const logger = pino({ name: 'detection-orchestrator' });

// ============================================================================
// Types
// ============================================================================

/**
 * Detection orchestrator configuration
 */
export interface DetectionOrchestratorConfig {
  /** Run detectors in parallel where possible */
  readonly parallelDetection: boolean;
  /** Continue detection on individual failures */
  readonly continueOnError: boolean;
  /** Collect evidence from all sources */
  readonly collectEvidence: boolean;
  /** Maximum detection depth */
  readonly maxDepth: number;
  /** Detection timeout in milliseconds */
  readonly timeoutMs: number;
}

/**
 * Default detection orchestrator configuration
 */
export const DEFAULT_DETECTION_ORCHESTRATOR_CONFIG: DetectionOrchestratorConfig = {
  parallelDetection: false, // Dependencies between detectors
  continueOnError: true,
  collectEvidence: true,
  maxDepth: 10,
  timeoutMs: 120000,
};

/**
 * Detection orchestrator input
 */
export interface DetectionOrchestratorInput {
  /** Parsed files from parser orchestrator */
  readonly parsedFiles: ParsedFile[];
  /** Base path for resolving references */
  readonly basePath: string;
  /** Scan configuration */
  readonly config: ScanConfig;
  /** Progress callback */
  readonly onProgress?: (progress: DetectionProgress) => void | Promise<void>;
}

/**
 * Detection progress
 */
export interface DetectionProgress {
  /** Current phase */
  readonly phase: DetectionPhase;
  /** Nodes detected so far */
  readonly nodes: number;
  /** Edges detected so far */
  readonly edges: number;
  /** Progress percentage (0-1) */
  readonly progress: number;
  /** Current file being processed */
  readonly currentFile?: string;
}

/**
 * Detection phase
 */
export type DetectionPhase =
  | 'module_detection'
  | 'reference_resolution'
  | 'data_source_detection'
  | 'evidence_collection'
  | 'completed';

/**
 * Detection error detail
 */
export interface DetectionErrorDetail {
  /** Detection phase */
  readonly phase: DetectionPhase;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code: string;
  /** File (if applicable) */
  readonly file?: string;
  /** Whether recoverable */
  readonly recoverable: boolean;
}

/**
 * Detection warning detail
 */
export interface DetectionWarningDetail {
  /** Detection phase */
  readonly phase: DetectionPhase;
  /** Warning message */
  readonly message: string;
  /** File (if applicable) */
  readonly file?: string;
}

/**
 * Detection orchestrator result
 */
export interface DetectionOrchestratorResult {
  /** Whether detection succeeded */
  readonly success: boolean;
  /** Detected nodes */
  readonly nodes: NodeType[];
  /** Detected edges */
  readonly edges: GraphEdge[];
  /** Collected evidence */
  readonly evidence: EvidenceCollection;
  /** Errors encountered */
  readonly errors: DetectionErrorDetail[];
  /** Warnings */
  readonly warnings: DetectionWarningDetail[];
  /** Detection statistics */
  readonly stats: DetectionOrchestratorStats;
}

/**
 * Detection orchestrator statistics
 */
export interface DetectionOrchestratorStats {
  /** Total files processed */
  readonly filesProcessed: number;
  /** Total nodes detected */
  readonly totalNodes: number;
  /** Total edges detected */
  readonly totalEdges: number;
  /** Nodes by type */
  readonly nodesByType: Record<string, number>;
  /** Edges by type */
  readonly edgesByType: Record<string, number>;
  /** Detection time in milliseconds */
  readonly detectionTimeMs: number;
  /** Time per phase */
  readonly phaseTimings: Record<DetectionPhase, number>;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Detection orchestrator interface
 */
export interface IDetectionOrchestrator {
  /**
   * Run detection pipeline on parsed files
   */
  detect(input: DetectionOrchestratorInput): Promise<DetectionOrchestratorResult>;

  /**
   * Run only module detection
   */
  detectModules(
    parsedFiles: ParsedFile[],
    context: DetectionContext
  ): Promise<ModuleDetectionPhaseResult>;

  /**
   * Run only reference resolution
   */
  resolveReferences(
    parsedFiles: ParsedFile[],
    context: DetectionContext
  ): Promise<ReferenceDetectionPhaseResult>;

  /**
   * Run only data source detection
   */
  detectDataSources(
    parsedFiles: ParsedFile[],
    context: DetectionContext
  ): Promise<DataSourceDetectionPhaseResult>;
}

/**
 * Module detection phase result
 */
export interface ModuleDetectionPhaseResult {
  readonly success: boolean;
  readonly modules: ModuleNode[];
  readonly edges: GraphEdge[];
  readonly errors: DetectionErrorDetail[];
  readonly warnings: DetectionWarningDetail[];
}

/**
 * Reference detection phase result
 */
export interface ReferenceDetectionPhaseResult {
  readonly success: boolean;
  readonly referenceResult: ReferenceDetectionResult;
  readonly edges: GraphEdge[];
  readonly errors: DetectionErrorDetail[];
  readonly warnings: DetectionWarningDetail[];
}

/**
 * Data source detection phase result
 */
export interface DataSourceDetectionPhaseResult {
  readonly success: boolean;
  readonly dataSourceResult: DataSourceDetectionResult;
  readonly nodes: NodeType[];
  readonly edges: GraphEdge[];
  readonly errors: DetectionErrorDetail[];
  readonly warnings: DetectionWarningDetail[];
}

// ============================================================================
// Detection Orchestrator Implementation
// ============================================================================

/**
 * Detection orchestrator for coordinating multiple detectors
 */
export class DetectionOrchestrator implements IDetectionOrchestrator {
  private readonly config: DetectionOrchestratorConfig;
  private readonly referenceResolver: ReferenceResolver;
  private readonly dataSourceDetector: DataSourceDetector;

  constructor(config: Partial<DetectionOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_DETECTION_ORCHESTRATOR_CONFIG, ...config };
    this.referenceResolver = createReferenceResolver();
    this.dataSourceDetector = createDataSourceDetector();
  }

  /**
   * Run the full detection pipeline
   */
  async detect(input: DetectionOrchestratorInput): Promise<DetectionOrchestratorResult> {
    const startTime = Date.now();
    const { parsedFiles, basePath, config, onProgress } = input;

    logger.info({ fileCount: parsedFiles.length }, 'Starting detection pipeline');

    const nodes: NodeType[] = [];
    const edges: GraphEdge[] = [];
    const errors: DetectionErrorDetail[] = [];
    const warnings: DetectionWarningDetail[] = [];
    const phaseTimings: Record<DetectionPhase, number> = {
      module_detection: 0,
      reference_resolution: 0,
      data_source_detection: 0,
      evidence_collection: 0,
      completed: 0,
    };

    // Create shared evidence collector
    const evidenceCollector = new EvidenceCollector();

    // Create detection context
    const detectionOptions: DetectionOptions = {
      includeImplicit: config.detectImplicit,
      minConfidence: config.minConfidence,
      maxDepth: this.config.maxDepth,
      experimental: false,
      timeout: this.config.timeoutMs,
    };

    const context: DetectionContext = {
      basePath,
      files: parsedFiles.map(f => f.path),
      existingNodes: new Map(),
      existingEdges: [],
      options: detectionOptions,
      evidenceCollector,
    };

    // Helper for progress updates
    const updateProgress = async (
      phase: DetectionPhase,
      progress: number
    ): Promise<void> => {
      if (onProgress) {
        try {
          await onProgress({
            phase,
            nodes: nodes.length,
            edges: edges.length,
            progress,
          });
        } catch (err) {
          logger.warn({ err }, 'Progress callback failed');
        }
      }
    };

    try {
      // ================================================================
      // Phase 1: Module Detection
      // ================================================================
      const moduleStart = Date.now();
      await updateProgress('module_detection', 0);

      logger.debug('Phase 1: Module detection');

      const moduleResult = await this.detectModules(parsedFiles, context);
      phaseTimings.module_detection = Date.now() - moduleStart;

      if (!moduleResult.success && !this.config.continueOnError) {
        throw new Error('Module detection failed');
      }

      // Add module nodes
      for (const module of moduleResult.modules) {
        const node: NodeType = {
          id: module.id,
          type: 'terraform_module',
          name: module.name,
          location: module.location,
          metadata: {
            source: module.source,
            version: module.version,
            count: module.count,
            forEach: module.forEach,
          },
        };
        nodes.push(node);
        context.existingNodes.set(node.id, node);
      }

      edges.push(...moduleResult.edges);
      context.existingEdges.push(...moduleResult.edges);
      errors.push(...moduleResult.errors);
      warnings.push(...moduleResult.warnings);

      await updateProgress('module_detection', 1);

      logger.debug(
        { modules: moduleResult.modules.length, edges: moduleResult.edges.length },
        'Module detection completed'
      );

      // ================================================================
      // Phase 2: Reference Resolution
      // ================================================================
      const refStart = Date.now();
      await updateProgress('reference_resolution', 0);

      logger.debug('Phase 2: Reference resolution');

      const refResult = await this.resolveReferences(parsedFiles, context);
      phaseTimings.reference_resolution = Date.now() - refStart;

      if (!refResult.success && !this.config.continueOnError) {
        throw new Error('Reference resolution failed');
      }

      edges.push(...refResult.edges);
      context.existingEdges.push(...refResult.edges);
      errors.push(...refResult.errors);
      warnings.push(...refResult.warnings);

      await updateProgress('reference_resolution', 1);

      logger.debug(
        {
          references: refResult.referenceResult.references.length,
          unresolved: refResult.referenceResult.unresolvedReferences.length,
        },
        'Reference resolution completed'
      );

      // ================================================================
      // Phase 3: Data Source Detection
      // ================================================================
      const dsStart = Date.now();
      await updateProgress('data_source_detection', 0);

      logger.debug('Phase 3: Data source detection');

      const dsResult = await this.detectDataSources(parsedFiles, context);
      phaseTimings.data_source_detection = Date.now() - dsStart;

      if (!dsResult.success && !this.config.continueOnError) {
        throw new Error('Data source detection failed');
      }

      nodes.push(...dsResult.nodes);
      for (const node of dsResult.nodes) {
        context.existingNodes.set(node.id, node);
      }

      edges.push(...dsResult.edges);
      context.existingEdges.push(...dsResult.edges);
      errors.push(...dsResult.errors);
      warnings.push(...dsResult.warnings);

      await updateProgress('data_source_detection', 1);

      logger.debug(
        {
          dataSources: dsResult.dataSourceResult.dataSources.length,
          dependencies: dsResult.dataSourceResult.dependencies.length,
        },
        'Data source detection completed'
      );

      // ================================================================
      // Phase 4: Extract Nodes from Parsed Files
      // ================================================================
      await updateProgress('evidence_collection', 0);

      // Extract resource nodes from parsed ASTs
      const resourceNodes = this.extractResourceNodes(parsedFiles, context);
      nodes.push(...resourceNodes);
      for (const node of resourceNodes) {
        context.existingNodes.set(node.id, node);
      }

      await updateProgress('evidence_collection', 1);

      // ================================================================
      // Finalize
      // ================================================================
      phaseTimings.completed = Date.now() - startTime;

      // Calculate statistics
      const stats = this.calculateStats(
        parsedFiles,
        nodes,
        edges,
        phaseTimings
      );

      const evidence = evidenceCollector.collect();

      logger.info(
        {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          durationMs: phaseTimings.completed,
        },
        'Detection pipeline completed'
      );

      await updateProgress('completed', 1);

      return {
        success: true,
        nodes,
        edges,
        evidence,
        errors,
        warnings,
        stats,
      };

    } catch (error) {
      logger.error({ err: error }, 'Detection pipeline failed');

      phaseTimings.completed = Date.now() - startTime;

      errors.push({
        phase: 'completed',
        message: error instanceof Error ? error.message : String(error),
        code: 'DETECTION_FAILED',
        recoverable: false,
      });

      return {
        success: false,
        nodes,
        edges,
        evidence: evidenceCollector.collect(),
        errors,
        warnings,
        stats: this.calculateStats(parsedFiles, nodes, edges, phaseTimings),
      };
    }
  }

  /**
   * Run module detection phase
   */
  async detectModules(
    parsedFiles: ParsedFile[],
    context: DetectionContext
  ): Promise<ModuleDetectionPhaseResult> {
    const modules: ModuleNode[] = [];
    const edges: GraphEdge[] = [];
    const errors: DetectionErrorDetail[] = [];
    const warnings: DetectionWarningDetail[] = [];

    for (const file of parsedFiles) {
      if (file.type !== 'terraform') continue;

      try {
        const ast = file.ast as { blocks?: Array<{ type: string; labels?: string[]; attributes?: Record<string, unknown> }> };
        if (!ast.blocks) continue;

        // Find module blocks
        const moduleBlocks = ast.blocks.filter(b => b.type === 'module');

        for (const block of moduleBlocks) {
          const moduleName = block.labels?.[0] ?? 'unknown';
          const source = String(block.attributes?.source ?? '');

          const moduleNode = moduleDetector.detect(
            moduleName,
            source,
            {
              file: file.path,
              lineStart: 1,
              lineEnd: 1,
            }
          );

          if (moduleNode) {
            modules.push(moduleNode);

            // Create module call edge
            edges.push({
              id: `edge-module-${moduleName}`,
              source: `file:${file.path}`,
              target: moduleNode.id,
              type: 'module_call',
              metadata: {
                implicit: false,
                confidence: 100,
              },
            });

            // Add evidence
            context.evidenceCollector.add({
              type: 'module_source',
              description: `Module ${moduleName} sources from ${source}`,
              category: 'syntax',
              location: {
                file: file.path,
                lines: { start: 1, end: 1 },
              },
              confidence: 100,
              method: 'ast_analysis',
            });
          }
        }
      } catch (err) {
        errors.push({
          phase: 'module_detection',
          message: err instanceof Error ? err.message : String(err),
          code: 'MODULE_DETECTION_ERROR',
          file: file.path,
          recoverable: true,
        });
      }
    }

    return {
      success: errors.filter(e => !e.recoverable).length === 0,
      modules,
      edges,
      errors,
      warnings,
    };
  }

  /**
   * Run reference resolution phase
   */
  async resolveReferences(
    parsedFiles: ParsedFile[],
    context: DetectionContext
  ): Promise<ReferenceDetectionPhaseResult> {
    const edges: GraphEdge[] = [];
    const errors: DetectionErrorDetail[] = [];
    const warnings: DetectionWarningDetail[] = [];

    try {
      // Filter for terraform files and convert to TerraformFile format
      const terraformFiles = parsedFiles
        .filter(f => f.type === 'terraform')
        .map(f => ({
          path: f.path,
          blocks: (f.ast as { blocks?: unknown[] })?.blocks ?? [],
          ...(f.ast as object),
        }));

      // Use the detector's detect method which expects DetectionContext
      const input = {
        files: terraformFiles,
        nodes: context.existingNodes,
      };

      const detectionResult = await this.referenceResolver.detect(input, context);

      // Extract references from detection result
      const result: ReferenceDetectionResult = {
        references: [],
        crossReferences: [],
        unresolvedReferences: [],
        stats: {
          totalReferences: detectionResult.success ? detectionResult.edges.length : 0,
          resolvedReferences: detectionResult.success ? detectionResult.edges.length : 0,
          unresolvedReferences: 0,
          crossModuleReferences: 0,
          averageConfidence: 80,
          referencesByType: {} as Record<string, number>,
        },
      };

      // Convert edges from detection result
      if (detectionResult.success) {
        edges.push(...detectionResult.edges);
      }

      return {
        success: detectionResult.success,
        referenceResult: result,
        edges,
        errors,
        warnings,
      };

    } catch (err) {
      errors.push({
        phase: 'reference_resolution',
        message: err instanceof Error ? err.message : String(err),
        code: 'REFERENCE_RESOLUTION_ERROR',
        recoverable: true,
      });

      return {
        success: false,
        referenceResult: {
          references: [],
          crossReferences: [],
          unresolvedReferences: [],
          stats: {
            totalReferences: 0,
            resolvedReferences: 0,
            unresolvedReferences: 0,
            crossModuleReferences: 0,
            averageConfidence: 0,
            referencesByType: {} as Record<string, number>,
          },
        },
        edges,
        errors,
        warnings,
      };
    }
  }

  /**
   * Run data source detection phase
   */
  async detectDataSources(
    parsedFiles: ParsedFile[],
    context: DetectionContext
  ): Promise<DataSourceDetectionPhaseResult> {
    const nodes: NodeType[] = [];
    const edges: GraphEdge[] = [];
    const errors: DetectionErrorDetail[] = [];
    const warnings: DetectionWarningDetail[] = [];

    try {
      // Filter for terraform files and convert to TerraformFile format
      const terraformFiles = parsedFiles
        .filter(f => f.type === 'terraform')
        .map(f => ({
          path: f.path,
          blocks: (f.ast as { blocks?: unknown[] })?.blocks ?? [],
          ...(f.ast as object),
        }));

      // Use the detector's detect method
      const input = {
        files: terraformFiles,
        existingNodes: context.existingNodes,
      };

      const detectionResult = await this.dataSourceDetector.detect(input, context);

      // Build result from detection
      const result: DataSourceDetectionResult = {
        dataSources: [],
        dependencies: [],
        stats: {
          totalDataSources: detectionResult.success ? detectionResult.nodes.length : 0,
          dataSourcesByType: {},
          totalDependencies: 0,
          averageConfidence: 80,
        },
      };

      if (detectionResult.success) {
        // Add nodes from detection result
        for (const node of detectionResult.nodes) {
          nodes.push(node as NodeType);
        }
        edges.push(...detectionResult.edges);
      }

      return {
        success: detectionResult.success,
        dataSourceResult: result,
        nodes,
        edges,
        errors,
        warnings,
      };

    } catch (err) {
      errors.push({
        phase: 'data_source_detection',
        message: err instanceof Error ? err.message : String(err),
        code: 'DATA_SOURCE_DETECTION_ERROR',
        recoverable: true,
      });

      return {
        success: false,
        dataSourceResult: {
          dataSources: [],
          dependencies: [],
          stats: {
            totalDataSources: 0,
            dataSourcesByType: {},
            totalDependencies: 0,
            averageConfidence: 0,
          },
        },
        nodes,
        edges,
        errors,
        warnings,
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Extract resource nodes from parsed files
   */
  private extractResourceNodes(
    parsedFiles: ParsedFile[],
    context: DetectionContext
  ): NodeType[] {
    const nodes: NodeType[] = [];

    for (const file of parsedFiles) {
      try {
        if (file.type === 'terraform') {
          const tfNodes = this.extractTerraformNodes(file, context);
          nodes.push(...tfNodes);
        } else if (file.type === 'kubernetes' || file.type === 'helm') {
          const k8sNodes = this.extractK8sNodes(file, context);
          nodes.push(...k8sNodes);
        }
      } catch (err) {
        logger.warn({ err, file: file.path }, 'Failed to extract nodes from file');
      }
    }

    return nodes;
  }

  /**
   * Extract nodes from Terraform files
   */
  private extractTerraformNodes(
    file: ParsedFile,
    _context: DetectionContext
  ): NodeType[] {
    const nodes: NodeType[] = [];
    const ast = file.ast as {
      blocks?: Array<{
        type: string;
        labels?: string[];
        attributes?: Record<string, unknown>;
      }>;
    };

    if (!ast.blocks) return nodes;

    for (const block of ast.blocks) {
      if (block.type === 'resource') {
        const resourceType = block.labels?.[0] ?? 'unknown';
        const resourceName = block.labels?.[1] ?? 'unknown';
        const nodeId = `${resourceType}.${resourceName}`;

        // Skip if already exists
        if (_context.existingNodes.has(nodeId)) continue;

        nodes.push({
          id: nodeId,
          type: 'terraform_resource',
          name: resourceName,
          location: {
            file: file.path,
            lineStart: 1,
            lineEnd: 1,
          },
          metadata: {
            resourceType,
            provider: resourceType.split('_')[0],
          },
        });
      } else if (block.type === 'variable') {
        const varName = block.labels?.[0] ?? 'unknown';
        const nodeId = `var.${varName}`;

        if (_context.existingNodes.has(nodeId)) continue;

        nodes.push({
          id: nodeId,
          type: 'terraform_variable',
          name: varName,
          location: {
            file: file.path,
            lineStart: 1,
            lineEnd: 1,
          },
          metadata: {
            default: block.attributes?.default,
            type: block.attributes?.type,
          },
        });
      } else if (block.type === 'output') {
        const outputName = block.labels?.[0] ?? 'unknown';
        const nodeId = `output.${outputName}`;

        if (_context.existingNodes.has(nodeId)) continue;

        nodes.push({
          id: nodeId,
          type: 'terraform_output',
          name: outputName,
          location: {
            file: file.path,
            lineStart: 1,
            lineEnd: 1,
          },
          metadata: {
            value: block.attributes?.value,
            sensitive: block.attributes?.sensitive,
          },
        });
      } else if (block.type === 'locals') {
        // Handle locals block
        if (block.attributes) {
          for (const [localName, value] of Object.entries(block.attributes)) {
            const nodeId = `local.${localName}`;

            if (_context.existingNodes.has(nodeId)) continue;

            nodes.push({
              id: nodeId,
              type: 'terraform_local',
              name: localName,
              location: {
                file: file.path,
                lineStart: 1,
                lineEnd: 1,
              },
              metadata: {
                value,
              },
            });
          }
        }
      }
    }

    return nodes;
  }

  /**
   * Extract nodes from Kubernetes/Helm files
   */
  private extractK8sNodes(
    file: ParsedFile,
    _context: DetectionContext
  ): NodeType[] {
    const nodes: NodeType[] = [];
    const ast = file.ast as {
      kind?: string;
      apiVersion?: string;
      metadata?: { name?: string; namespace?: string };
    };

    if (!ast.kind || !ast.metadata?.name) return nodes;

    const nodeId = `${ast.kind}/${ast.metadata.namespace ?? 'default'}/${ast.metadata.name}`;

    if (_context.existingNodes.has(nodeId)) return nodes;

    nodes.push({
      id: nodeId,
      type: 'kubernetes_resource',
      name: ast.metadata.name,
      location: {
        file: file.path,
        lineStart: 1,
        lineEnd: 1,
      },
      metadata: {
        kind: ast.kind,
        apiVersion: ast.apiVersion,
        namespace: ast.metadata.namespace,
      },
    });

    return nodes;
  }

  /**
   * Map reference type to edge type
   */
  private mapReferenceTypeToEdgeType(refType: string): EdgeType {
    const mapping: Record<string, EdgeType> = {
      attribute: 'references',
      whole: 'references',
      splat: 'references',
      index: 'references',
      for_each_key: 'references',
      count: 'references',
      module_output: 'output_value',
      data_source: 'data_reference',
      variable: 'input_variable',
      local: 'local_reference',
      provider: 'provider_alias',
    };

    return mapping[refType] ?? 'references';
  }

  /**
   * Calculate detection statistics
   */
  private calculateStats(
    parsedFiles: ParsedFile[],
    nodes: NodeType[],
    edges: GraphEdge[],
    phaseTimings: Record<DetectionPhase, number>
  ): DetectionOrchestratorStats {
    const nodesByType: Record<string, number> = {};
    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] ?? 0) + 1;
    }

    const edgesByType: Record<string, number> = {};
    for (const edge of edges) {
      edgesByType[edge.type] = (edgesByType[edge.type] ?? 0) + 1;
    }

    return {
      filesProcessed: parsedFiles.length,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType,
      edgesByType,
      detectionTimeMs: phaseTimings.completed,
      phaseTimings,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new detection orchestrator
 */
export function createDetectionOrchestrator(
  config?: Partial<DetectionOrchestratorConfig>
): IDetectionOrchestrator {
  return new DetectionOrchestrator(config);
}
