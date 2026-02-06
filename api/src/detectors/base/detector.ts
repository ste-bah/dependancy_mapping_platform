/**
 * Base Detector Infrastructure
 * @module detectors/base/detector
 *
 * Provides the foundational interfaces and base classes for all dependency detectors.
 * Implements the Detector<T> interface from Phase 3 architecture design.
 *
 * TASK-DETECT: Core detector infrastructure for IaC dependency detection
 */

import {
  NodeType,
  GraphEdge,
  EdgeType,
  NodeLocation,
  EdgeMetadata,
} from '../../types/graph';
import {
  Evidence,
  EvidenceType,
  EvidenceCategory,
  EvidenceMethod,
  EvidenceCollection,
  ConfidenceScore,
  ScoringRule,
  createEmptyEvidenceCollection,
  calculateAggregatedConfidence,
  getConfidenceLevel,
} from '../../types/evidence';

// ============================================================================
// Detection Result Types
// ============================================================================

/**
 * Result of a detection operation
 */
export type DetectionResult<T extends NodeType = NodeType> =
  | DetectionSuccess<T>
  | DetectionFailure;

/**
 * Successful detection result
 */
export interface DetectionSuccess<T extends NodeType = NodeType> {
  readonly success: true;
  readonly nodes: T[];
  readonly edges: GraphEdge[];
  readonly evidence: EvidenceCollection;
  readonly metadata: DetectionMetadata;
}

/**
 * Failed detection result
 */
export interface DetectionFailure {
  readonly success: false;
  readonly errors: DetectionError[];
  readonly partialNodes: NodeType[];
  readonly partialEdges: GraphEdge[];
  readonly metadata: DetectionMetadata;
}

/**
 * Detection error
 */
export interface DetectionError {
  readonly code: DetectionErrorCode;
  readonly message: string;
  readonly location?: NodeLocation;
  readonly severity: 'error' | 'warning';
  readonly recoverable: boolean;
}

/**
 * Detection error codes
 */
export type DetectionErrorCode =
  | 'PARSE_ERROR'
  | 'INVALID_INPUT'
  | 'MISSING_REQUIRED_FIELD'
  | 'CIRCULAR_REFERENCE'
  | 'UNRESOLVED_REFERENCE'
  | 'INVALID_REFERENCE'
  | 'UNSUPPORTED_FEATURE'
  | 'DETECTION_TIMEOUT'
  | 'INTERNAL_ERROR';

/**
 * Detection metadata
 */
export interface DetectionMetadata {
  readonly detectorName: string;
  readonly detectorVersion: string;
  readonly detectionTimeMs: number;
  readonly inputFiles: string[];
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly evidenceCount: number;
}

// ============================================================================
// Detector Interface
// ============================================================================

/**
 * Generic detector interface for dependency detection.
 * Implementations analyze parsed ASTs to find relationships.
 *
 * @typeParam T - The node type this detector produces
 * @typeParam I - The input type this detector accepts
 */
export interface IDetector<T extends NodeType = NodeType, I = unknown> {
  /** Unique detector identifier */
  readonly name: string;

  /** Semantic version of the detector */
  readonly version: string;

  /** Node types this detector produces */
  readonly producedNodeTypes: readonly string[];

  /** Edge types this detector can detect */
  readonly producedEdgeTypes: readonly EdgeType[];

  /**
   * Detect dependencies from input.
   *
   * @param input - Parsed AST or other input
   * @param context - Detection context with configuration
   * @returns Detection result with nodes and edges
   */
  detect(input: I, context: DetectionContext): Promise<DetectionResult<T>>;

  /**
   * Check if this detector can process the input.
   *
   * @param input - Input to check
   * @returns Whether this detector can process the input
   */
  canDetect(input: I): boolean;

  /**
   * Get scoring rules for confidence calculation.
   *
   * @returns Array of scoring rules
   */
  getScoringRules(): ScoringRule[];
}

/**
 * Detection context providing configuration and utilities
 */
export interface DetectionContext {
  /** Base directory for resolving paths */
  readonly basePath: string;
  /** Files being processed */
  readonly files: string[];
  /** Already detected nodes (for cross-detector references) */
  readonly existingNodes: Map<string, NodeType>;
  /** Already detected edges */
  readonly existingEdges: GraphEdge[];
  /** Detection options */
  readonly options: DetectionOptions;
  /** Evidence collector */
  readonly evidenceCollector: IEvidenceCollector;
}

/**
 * Detection options
 */
export interface DetectionOptions {
  /** Include implicit dependencies */
  readonly includeImplicit: boolean;
  /** Minimum confidence threshold (0-100) */
  readonly minConfidence: number;
  /** Maximum detection depth for recursive analysis */
  readonly maxDepth: number;
  /** Enable experimental detectors */
  readonly experimental: boolean;
  /** Custom scoring rules to override defaults */
  readonly customRules?: ScoringRule[];
  /** Timeout in milliseconds */
  readonly timeout: number;
}

/**
 * Default detection options
 */
export const DEFAULT_DETECTION_OPTIONS: DetectionOptions = {
  includeImplicit: true,
  minConfidence: 40,
  maxDepth: 10,
  experimental: false,
  timeout: 60000,
};

// ============================================================================
// Evidence Collector Interface
// ============================================================================

/**
 * Interface for collecting evidence during detection
 */
export interface IEvidenceCollector {
  /**
   * Add evidence item
   */
  add(evidence: Omit<Evidence, 'id' | 'collectedAt'>): Evidence;

  /**
   * Get all collected evidence
   */
  getAll(): Evidence[];

  /**
   * Get evidence for a specific node or edge
   */
  getFor(targetId: string): Evidence[];

  /**
   * Create an evidence collection
   */
  collect(): EvidenceCollection;

  /**
   * Calculate confidence score for evidence
   */
  calculateConfidence(evidence: Evidence[], rules?: ScoringRule[]): ConfidenceScore;

  /**
   * Clear all collected evidence
   */
  clear(): void;
}

// ============================================================================
// Base Detector Abstract Class
// ============================================================================

/**
 * Abstract base class providing common detector functionality.
 * Extend this class to implement specific detectors.
 *
 * @typeParam T - The node type this detector produces
 * @typeParam I - The input type this detector accepts
 */
export abstract class BaseDetector<T extends NodeType = NodeType, I = unknown>
  implements IDetector<T, I> {

  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly producedNodeTypes: readonly string[];
  abstract readonly producedEdgeTypes: readonly EdgeType[];

  /**
   * Detect dependencies from input.
   * Template method handling common concerns.
   */
  async detect(input: I, context: DetectionContext): Promise<DetectionResult<T>> {
    const startTime = performance.now();

    if (!this.canDetect(input)) {
      return this.createFailure(
        [{
          code: 'INVALID_INPUT',
          message: 'Input cannot be processed by this detector',
          severity: 'error',
          recoverable: false,
        }],
        [],
        [],
        this.createMetadata(startTime, context)
      );
    }

    try {
      // Apply timeout if specified
      const detectPromise = this.doDetect(input, context);

      if (context.options.timeout > 0) {
        const result = await this.withTimeout(detectPromise, context.options.timeout);
        return this.enrichResult(result, startTime, context);
      }

      const result = await detectPromise;
      return this.enrichResult(result, startTime, context);
    } catch (error) {
      return this.createFailure(
        [{
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
          recoverable: false,
        }],
        [],
        [],
        this.createMetadata(startTime, context)
      );
    }
  }

  /**
   * Check if this detector can process the input.
   * Override in subclasses for specific validation.
   */
  canDetect(_input: I): boolean {
    return true;
  }

  /**
   * Get default scoring rules.
   * Override in subclasses to provide detector-specific rules.
   */
  getScoringRules(): ScoringRule[] {
    return DEFAULT_SCORING_RULES;
  }

  // ============================================================================
  // Abstract Methods
  // ============================================================================

  /**
   * Perform the actual detection. Override in subclasses.
   */
  protected abstract doDetect(
    input: I,
    context: DetectionContext
  ): Promise<DetectionResult<T>>;

  // ============================================================================
  // Protected Helper Methods
  // ============================================================================

  /**
   * Create a successful detection result
   */
  protected createSuccess(
    nodes: T[],
    edges: GraphEdge[],
    evidence: EvidenceCollection,
    metadata: DetectionMetadata
  ): DetectionSuccess<T> {
    return {
      success: true,
      nodes,
      edges,
      evidence,
      metadata,
    };
  }

  /**
   * Create a failed detection result
   */
  protected createFailure(
    errors: DetectionError[],
    partialNodes: NodeType[],
    partialEdges: GraphEdge[],
    metadata: DetectionMetadata
  ): DetectionFailure {
    return {
      success: false,
      errors,
      partialNodes,
      partialEdges,
      metadata,
    };
  }

  /**
   * Create detection metadata
   */
  protected createMetadata(
    startTime: number,
    context: DetectionContext,
    nodeCount: number = 0,
    edgeCount: number = 0,
    evidenceCount: number = 0
  ): DetectionMetadata {
    return {
      detectorName: this.name,
      detectorVersion: this.version,
      detectionTimeMs: performance.now() - startTime,
      inputFiles: context.files,
      nodeCount,
      edgeCount,
      evidenceCount,
    };
  }

  /**
   * Create a graph edge
   */
  protected createEdge(
    source: string,
    target: string,
    type: EdgeType,
    metadata: Partial<EdgeMetadata> = {}
  ): GraphEdge {
    return {
      id: `${source}->${target}:${type}`,
      source,
      target,
      type,
      metadata: {
        implicit: false,
        confidence: 100,
        ...metadata,
      },
    };
  }

  /**
   * Create evidence for a detection
   */
  protected createEvidence(
    type: EvidenceType,
    description: string,
    location: NodeLocation,
    confidence: number,
    options: Partial<{
      category: EvidenceCategory;
      method: EvidenceMethod;
      raw: unknown;
    }> = {}
  ): Omit<Evidence, 'id' | 'collectedAt'> {
    return {
      type,
      description,
      category: options.category ?? this.getDefaultCategory(type),
      location: {
        file: location.file,
        lines: {
          start: location.lineStart,
          end: location.lineEnd,
        },
        columns: location.columnStart !== undefined ? {
          start: location.columnStart,
          end: location.columnEnd ?? location.columnStart,
        } : undefined,
      },
      confidence,
      method: options.method ?? 'ast_analysis',
      raw: options.raw,
    };
  }

  /**
   * Get default evidence category for type
   */
  private getDefaultCategory(type: EvidenceType): EvidenceCategory {
    const syntaxTypes: EvidenceType[] = [
      'explicit_reference',
      'depends_on_directive',
      'module_source',
      'provider_alias',
      'variable_default',
    ];

    const semanticTypes: EvidenceType[] = [
      'interpolation',
      'function_call',
      'for_expression',
      'conditional',
      'splat_operation',
    ];

    const structuralTypes: EvidenceType[] = [
      'block_nesting',
      'attribute_assignment',
      'label_matching',
      'namespace_scoping',
    ];

    if (syntaxTypes.includes(type)) return 'syntax';
    if (semanticTypes.includes(type)) return 'semantic';
    if (structuralTypes.includes(type)) return 'structural';
    return 'heuristic';
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private enrichResult(
    result: DetectionResult<T>,
    startTime: number,
    context: DetectionContext
  ): DetectionResult<T> {
    // Update metadata with timing
    if (result.success) {
      return {
        ...result,
        metadata: {
          ...result.metadata,
          detectionTimeMs: performance.now() - startTime,
        },
      };
    }
    return {
      ...result,
      metadata: {
        ...result.metadata,
        detectionTimeMs: performance.now() - startTime,
      },
    };
  }

  private async withTimeout<R>(
    promise: Promise<R>,
    timeoutMs: number
  ): Promise<R> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Detection timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }
}

// ============================================================================
// Evidence Collector Implementation
// ============================================================================

/**
 * Default evidence collector implementation
 */
export class EvidenceCollector implements IEvidenceCollector {
  private evidence: Evidence[] = [];
  private targetMap: Map<string, Evidence[]> = new Map();
  private idCounter: number = 0;

  add(partial: Omit<Evidence, 'id' | 'collectedAt'>): Evidence {
    const evidence: Evidence = {
      ...partial,
      id: `evidence-${++this.idCounter}`,
      collectedAt: new Date(),
    };

    this.evidence.push(evidence);
    return evidence;
  }

  addForTarget(targetId: string, partial: Omit<Evidence, 'id' | 'collectedAt'>): Evidence {
    const evidence = this.add(partial);

    const existing = this.targetMap.get(targetId) ?? [];
    existing.push(evidence);
    this.targetMap.set(targetId, existing);

    return evidence;
  }

  getAll(): Evidence[] {
    return [...this.evidence];
  }

  getFor(targetId: string): Evidence[] {
    return this.targetMap.get(targetId) ?? [];
  }

  collect(): EvidenceCollection {
    const items = this.getAll();

    if (items.length === 0) {
      return createEmptyEvidenceCollection();
    }

    const countByType: Record<EvidenceType, number> = {} as Record<EvidenceType, number>;
    const countByCategory: Record<EvidenceCategory, number> = {} as Record<EvidenceCategory, number>;

    for (const item of items) {
      countByType[item.type] = (countByType[item.type] ?? 0) + 1;
      countByCategory[item.category] = (countByCategory[item.category] ?? 0) + 1;
    }

    const primaryEvidence = items.reduce(
      (max, item) => item.confidence > (max?.confidence ?? 0) ? item : max,
      null as Evidence | null
    );

    return {
      items,
      aggregatedConfidence: calculateAggregatedConfidence(items),
      primaryEvidence,
      countByType,
      countByCategory,
    };
  }

  calculateConfidence(evidence: Evidence[], rules?: ScoringRule[]): ConfidenceScore {
    const scoringRules = rules ?? DEFAULT_SCORING_RULES;
    const aggregated = calculateAggregatedConfidence(evidence);

    // Calculate breakdown
    let baseScore = 0;
    let evidenceMultiplier = 1;
    let explicitBonus = 0;
    let heuristicPenalty = 0;
    let patternBonus = 0;

    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    for (const item of evidence) {
      // Apply matching rules
      for (const rule of scoringRules) {
        if (rule.appliesTo.includes(item.type)) {
          baseScore += rule.baseScore;
          if (rule.name.includes('explicit')) {
            explicitBonus += 10;
            positiveFactors.push(rule.name);
          }
        }
      }

      // Track factors
      if (item.category === 'explicit') {
        positiveFactors.push(`Explicit ${item.type}`);
        explicitBonus += 15;
      } else if (item.category === 'heuristic') {
        negativeFactors.push(`Heuristic-based: ${item.type}`);
        heuristicPenalty += 5;
      }
    }

    // Evidence multiplier for multiple sources
    if (evidence.length > 1) {
      evidenceMultiplier = Math.min(1.5, 1 + (evidence.length - 1) * 0.1);
      positiveFactors.push(`Multiple evidence sources (${evidence.length})`);
    }

    // Pattern bonus for consistent evidence
    const categories = new Set(evidence.map(e => e.category));
    if (categories.size >= 2) {
      patternBonus = 10;
      positiveFactors.push('Evidence from multiple categories');
    }

    return {
      value: aggregated,
      breakdown: {
        baseScore: Math.min(50, baseScore),
        evidenceMultiplier,
        explicitBonus: Math.min(20, explicitBonus),
        heuristicPenalty: Math.min(20, heuristicPenalty),
        patternBonus,
      },
      level: getConfidenceLevel(aggregated),
      positiveFactors,
      negativeFactors,
    };
  }

  clear(): void {
    this.evidence = [];
    this.targetMap.clear();
    this.idCounter = 0;
  }
}

// ============================================================================
// Default Scoring Rules
// ============================================================================

/**
 * Default scoring rules for confidence calculation
 */
export const DEFAULT_SCORING_RULES: ScoringRule[] = [
  {
    id: 'explicit-reference',
    name: 'Explicit Reference',
    description: 'Direct attribute reference in code',
    appliesTo: ['explicit_reference'],
    baseScore: 30,
    multiplier: 1.0,
    conditions: [],
    priority: 100,
  },
  {
    id: 'depends-on',
    name: 'Explicit depends_on',
    description: 'Explicit depends_on declaration',
    appliesTo: ['depends_on_directive'],
    baseScore: 40,
    multiplier: 1.2,
    conditions: [],
    priority: 100,
  },
  {
    id: 'module-source',
    name: 'Module Source',
    description: 'Module source specification',
    appliesTo: ['module_source'],
    baseScore: 35,
    multiplier: 1.0,
    conditions: [],
    priority: 90,
  },
  {
    id: 'interpolation',
    name: 'String Interpolation',
    description: 'Reference via string interpolation',
    appliesTo: ['interpolation'],
    baseScore: 25,
    multiplier: 1.0,
    conditions: [],
    priority: 80,
  },
  {
    id: 'function-call',
    name: 'Function Call Reference',
    description: 'Reference via function argument',
    appliesTo: ['function_call'],
    baseScore: 20,
    multiplier: 1.0,
    conditions: [],
    priority: 70,
  },
  {
    id: 'naming-convention',
    name: 'Naming Convention',
    description: 'Inferred from naming patterns',
    appliesTo: ['naming_convention'],
    baseScore: 10,
    multiplier: 0.8,
    conditions: [],
    priority: 30,
  },
  {
    id: 'resource-proximity',
    name: 'Resource Proximity',
    description: 'Resources in same file/module',
    appliesTo: ['resource_proximity'],
    baseScore: 5,
    multiplier: 0.7,
    conditions: [],
    priority: 20,
  },
];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for successful detection results
 */
export function isDetectionSuccess<T extends NodeType>(
  result: DetectionResult<T>
): result is DetectionSuccess<T> {
  return result.success === true;
}

/**
 * Type guard for failed detection results
 */
export function isDetectionFailure(
  result: DetectionResult<NodeType>
): result is DetectionFailure {
  return result.success === false;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new detection context
 */
export function createDetectionContext(
  basePath: string,
  files: string[],
  options: Partial<DetectionOptions> = {}
): DetectionContext {
  return {
    basePath,
    files,
    existingNodes: new Map(),
    existingEdges: [],
    options: { ...DEFAULT_DETECTION_OPTIONS, ...options },
    evidenceCollector: new EvidenceCollector(),
  };
}
