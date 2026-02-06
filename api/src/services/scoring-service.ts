/**
 * Scoring Service
 * @module services/scoring-service
 *
 * Coordinates confidence scoring for detected dependencies.
 * Applies scoring rules, aggregates evidence, and calculates final confidence scores.
 *
 * TASK-DETECT-009: Confidence scoring service for IaC dependency detection
 */

import pino from 'pino';
import {
  Evidence,
  EvidenceCollection,
  EvidenceType,
  ConfidenceScore,
  ConfidenceLevel,
  ScoringRule,
  createEmptyEvidenceCollection,
  getConfidenceLevel,
} from '../types/evidence.js';
import { GraphEdge, EdgeMetadata } from '../types/graph.js';
import {
  ScoringEngine,
  IScoringEngine,
  ScoringContext,
  RuleEngine,
  IRuleEngine,
  RuleEvaluationResult,
  createScoringEngine,
  DEFAULT_SCORING_CONFIG,
  CONFIDENCE_THRESHOLDS,
} from '../scoring/index.js';

const logger = pino({ name: 'scoring-service' });

// ============================================================================
// Types
// ============================================================================

/**
 * Scoring service configuration
 */
export interface ScoringServiceConfig {
  /** Minimum confidence threshold for edges */
  readonly minConfidence: number;
  /** Enable rule-based scoring */
  readonly enableRules: boolean;
  /** Custom scoring rules */
  readonly customRules: ScoringRule[];
  /** Weight for explicit evidence */
  readonly explicitWeight: number;
  /** Weight for implicit evidence */
  readonly implicitWeight: number;
  /** Enable confidence normalization */
  readonly normalizeScores: boolean;
}

/**
 * Default scoring service configuration
 */
export const DEFAULT_SCORING_SERVICE_CONFIG: ScoringServiceConfig = {
  minConfidence: 40,
  enableRules: true,
  customRules: [],
  explicitWeight: 1.0,
  implicitWeight: 0.6,
  normalizeScores: true,
};

/**
 * Edge with evidence mapping
 */
export interface EdgeEvidenceMap {
  /** Edge ID */
  readonly edgeId: string;
  /** Evidence items */
  readonly evidence: Evidence[];
}

/**
 * Batch scoring input
 */
export interface BatchScoringInput {
  /** Edges to score */
  readonly edges: GraphEdge[];
  /** Evidence collection */
  readonly evidence: EvidenceCollection;
  /** Edge to evidence mapping (optional, will be inferred if not provided) */
  readonly edgeEvidenceMap?: Map<string, Evidence[]>;
}

/**
 * Batch scoring result
 */
export interface BatchScoringResult {
  /** Scored edges */
  readonly edges: GraphEdge[];
  /** Scoring statistics */
  readonly stats: BatchScoringStats;
  /** Edges filtered out */
  readonly filteredEdges: FilteredEdge[];
}

/**
 * Filtered edge
 */
export interface FilteredEdge {
  /** Edge ID */
  readonly edgeId: string;
  /** Original confidence */
  readonly originalConfidence: number;
  /** Reason for filtering */
  readonly reason: string;
}

/**
 * Batch scoring statistics
 */
export interface BatchScoringStats {
  /** Total edges processed */
  readonly totalEdges: number;
  /** Edges above threshold */
  readonly edgesAboveThreshold: number;
  /** Edges below threshold */
  readonly edgesBelowThreshold: number;
  /** Average confidence */
  readonly averageConfidence: number;
  /** Confidence distribution */
  readonly distribution: ConfidenceDistribution;
  /** Rules applied */
  readonly rulesApplied: number;
  /** Scoring time in milliseconds */
  readonly scoringTimeMs: number;
}

/**
 * Confidence distribution
 */
export interface ConfidenceDistribution {
  readonly certain: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly uncertain: number;
}

/**
 * Evidence score breakdown
 */
export interface EvidenceScoreBreakdown {
  /** Base score from evidence */
  readonly baseScore: number;
  /** Bonus from explicit evidence */
  readonly explicitBonus: number;
  /** Penalty from heuristic-only evidence */
  readonly heuristicPenalty: number;
  /** Bonus from pattern matching */
  readonly patternBonus: number;
  /** Multiplier from evidence count */
  readonly evidenceMultiplier: number;
  /** Final calculated score */
  readonly finalScore: number;
  /** Factors contributing positively */
  readonly positiveFactors: string[];
  /** Factors contributing negatively */
  readonly negativeFactors: string[];
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Scoring service interface
 */
export interface IScoringService {
  /**
   * Score a collection of edges based on evidence
   */
  scoreEdges(
    edges: GraphEdge[],
    evidence: EvidenceCollection
  ): Promise<GraphEdge[]>;

  /**
   * Score a single edge
   */
  scoreEdge(
    edge: GraphEdge,
    evidence: Evidence[]
  ): Promise<GraphEdge>;

  /**
   * Calculate confidence score for evidence
   */
  calculateConfidence(
    evidence: Evidence[],
    customRules?: ScoringRule[]
  ): ConfidenceScore;

  /**
   * Get confidence level from numeric score
   */
  getConfidenceLevel(score: number): ConfidenceLevel;

  /**
   * Batch score edges with detailed results
   */
  batchScore(input: BatchScoringInput): Promise<BatchScoringResult>;

  /**
   * Get score breakdown for evidence
   */
  getScoreBreakdown(evidence: Evidence[]): EvidenceScoreBreakdown;

  /**
   * Validate scoring rules
   */
  validateRules(rules: ScoringRule[]): ValidationResult;

  /**
   * Get default scoring rules
   */
  getDefaultRules(): ScoringRule[];
}

/**
 * Rule validation result
 */
export interface ValidationResult {
  /** Whether rules are valid */
  readonly valid: boolean;
  /** Validation errors */
  readonly errors: string[];
  /** Validation warnings */
  readonly warnings: string[];
}

// ============================================================================
// Scoring Service Implementation
// ============================================================================

/**
 * Scoring service for dependency confidence calculation
 */
export class ScoringService implements IScoringService {
  private readonly config: ScoringServiceConfig;
  private readonly engine: IScoringEngine;
  private readonly ruleEngine: IRuleEngine;
  private readonly defaultRules: ScoringRule[];

  constructor(config: Partial<ScoringServiceConfig> = {}) {
    this.config = { ...DEFAULT_SCORING_SERVICE_CONFIG, ...config };
    this.engine = createScoringEngine({
      minScore: 0,
      maxScore: 100,
      explicitWeight: this.config.explicitWeight,
      heuristicWeight: this.config.implicitWeight,
    });
    this.ruleEngine = new RuleEngine();
    this.defaultRules = this.createDefaultRules();
  }

  /**
   * Score a collection of edges based on evidence
   */
  async scoreEdges(
    edges: GraphEdge[],
    evidence: EvidenceCollection
  ): Promise<GraphEdge[]> {
    const startTime = Date.now();

    logger.info(
      { edgeCount: edges.length, evidenceCount: evidence.items.length },
      'Scoring edges'
    );

    // Build edge to evidence map
    const edgeEvidenceMap = this.buildEdgeEvidenceMap(edges, evidence);

    // Score each edge
    const scoredEdges: GraphEdge[] = [];

    for (const edge of edges) {
      const edgeEvidence = edgeEvidenceMap.get(edge.id) ?? [];
      const scoredEdge = await this.scoreEdge(edge, edgeEvidence);
      scoredEdges.push(scoredEdge);
    }

    logger.info(
      {
        edgeCount: scoredEdges.length,
        durationMs: Date.now() - startTime,
      },
      'Edge scoring completed'
    );

    return scoredEdges;
  }

  /**
   * Score a single edge
   */
  async scoreEdge(
    edge: GraphEdge,
    evidence: Evidence[]
  ): Promise<GraphEdge> {
    let confidence: number;

    if (evidence.length === 0) {
      // Use existing confidence or default
      confidence = edge.metadata?.confidence ?? 50;
    } else {
      const score = this.calculateConfidence(evidence);
      confidence = score.value;
    }

    // Apply normalization if enabled
    if (this.config.normalizeScores) {
      confidence = this.normalizeConfidence(confidence);
    }

    // Create updated edge
    return {
      ...edge,
      metadata: {
        ...edge.metadata,
        confidence,
        implicit: confidence < 80,
      },
    };
  }

  /**
   * Calculate confidence score for evidence
   */
  calculateConfidence(
    evidence: Evidence[],
    customRules?: ScoringRule[]
  ): ConfidenceScore {
    const rules = customRules ?? [
      ...this.defaultRules,
      ...this.config.customRules,
    ];

    const context: ScoringContext = {
      evidence,
      customRules: rules,
      config: {
        explicitWeight: this.config.explicitWeight,
        heuristicWeight: this.config.implicitWeight,
      },
    };

    return this.engine.calculate(context);
  }

  /**
   * Get confidence level from numeric score
   */
  getConfidenceLevel(score: number): ConfidenceLevel {
    return getConfidenceLevel(score);
  }

  /**
   * Batch score edges with detailed results
   */
  async batchScore(input: BatchScoringInput): Promise<BatchScoringResult> {
    const startTime = Date.now();
    const { edges, evidence, edgeEvidenceMap } = input;

    // Build or use provided evidence map
    const evidenceMap = edgeEvidenceMap ?? this.buildEdgeEvidenceMap(edges, evidence);

    const scoredEdges: GraphEdge[] = [];
    const filteredEdges: FilteredEdge[] = [];
    const confidenceValues: number[] = [];
    const distribution: ConfidenceDistribution = {
      certain: 0,
      high: 0,
      medium: 0,
      low: 0,
      uncertain: 0,
    };

    let rulesApplied = 0;

    for (const edge of edges) {
      const edgeEvidence = evidenceMap.get(edge.id) ?? [];

      // Apply rules if enabled
      if (this.config.enableRules && edgeEvidence.length > 0) {
        const ruleResults = this.ruleEngine.evaluate(
          edgeEvidence,
          [...this.defaultRules, ...this.config.customRules]
        );
        rulesApplied += ruleResults.filter(r => r.matched).length;
      }

      const scoredEdge = await this.scoreEdge(edge, edgeEvidence);
      const confidence = scoredEdge.metadata?.confidence ?? 0;

      confidenceValues.push(confidence);

      // Update distribution
      if (confidence >= CONFIDENCE_THRESHOLDS.certain) {
        distribution.certain++;
      } else if (confidence >= CONFIDENCE_THRESHOLDS.high) {
        distribution.high++;
      } else if (confidence >= CONFIDENCE_THRESHOLDS.medium) {
        distribution.medium++;
      } else if (confidence >= CONFIDENCE_THRESHOLDS.low) {
        distribution.low++;
      } else {
        distribution.uncertain++;
      }

      // Filter based on threshold
      if (confidence >= this.config.minConfidence) {
        scoredEdges.push(scoredEdge);
      } else {
        filteredEdges.push({
          edgeId: edge.id,
          originalConfidence: confidence,
          reason: `Below threshold (${confidence} < ${this.config.minConfidence})`,
        });
      }
    }

    const averageConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : 0;

    return {
      edges: scoredEdges,
      stats: {
        totalEdges: edges.length,
        edgesAboveThreshold: scoredEdges.length,
        edgesBelowThreshold: filteredEdges.length,
        averageConfidence: Math.round(averageConfidence),
        distribution,
        rulesApplied,
        scoringTimeMs: Date.now() - startTime,
      },
      filteredEdges,
    };
  }

  /**
   * Get score breakdown for evidence
   */
  getScoreBreakdown(evidence: Evidence[]): EvidenceScoreBreakdown {
    if (evidence.length === 0) {
      return {
        baseScore: 0,
        explicitBonus: 0,
        heuristicPenalty: 0,
        patternBonus: 0,
        evidenceMultiplier: 1,
        finalScore: 0,
        positiveFactors: [],
        negativeFactors: ['No evidence provided'],
      };
    }

    const score = this.calculateConfidence(evidence);

    return {
      baseScore: score.breakdown.baseScore,
      explicitBonus: score.breakdown.explicitBonus,
      heuristicPenalty: score.breakdown.heuristicPenalty,
      patternBonus: score.breakdown.patternBonus,
      evidenceMultiplier: score.breakdown.evidenceMultiplier,
      finalScore: score.value,
      positiveFactors: score.positiveFactors,
      negativeFactors: score.negativeFactors,
    };
  }

  /**
   * Validate scoring rules
   */
  validateRules(rules: ScoringRule[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      // Check required fields
      if (!rule.id) {
        errors.push(`Rule missing id`);
      }
      if (!rule.name) {
        errors.push(`Rule ${rule.id ?? 'unknown'} missing name`);
      }
      if (!rule.appliesTo || rule.appliesTo.length === 0) {
        errors.push(`Rule ${rule.id ?? 'unknown'} has no appliesTo types`);
      }
      if (typeof rule.baseScore !== 'number') {
        errors.push(`Rule ${rule.id ?? 'unknown'} has invalid baseScore`);
      }
      if (typeof rule.multiplier !== 'number') {
        errors.push(`Rule ${rule.id ?? 'unknown'} has invalid multiplier`);
      }

      // Check values
      if (rule.baseScore < 0 || rule.baseScore > 100) {
        warnings.push(`Rule ${rule.id} baseScore (${rule.baseScore}) outside typical range`);
      }
      if (rule.multiplier < 0 || rule.multiplier > 2) {
        warnings.push(`Rule ${rule.id} multiplier (${rule.multiplier}) outside typical range`);
      }
      if (rule.priority < 0 || rule.priority > 100) {
        warnings.push(`Rule ${rule.id} priority (${rule.priority}) outside typical range`);
      }

      // Validate conditions
      for (const condition of rule.conditions) {
        if (!condition.field) {
          errors.push(`Rule ${rule.id} has condition with missing field`);
        }
        if (!['equals', 'contains', 'matches', 'gt', 'lt', 'exists'].includes(condition.operator)) {
          errors.push(`Rule ${rule.id} has invalid operator: ${condition.operator}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get default scoring rules
   */
  getDefaultRules(): ScoringRule[] {
    return [...this.defaultRules];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build edge to evidence map
   */
  private buildEdgeEvidenceMap(
    edges: GraphEdge[],
    evidence: EvidenceCollection
  ): Map<string, Evidence[]> {
    const map = new Map<string, Evidence[]>();

    // Initialize map for all edges
    for (const edge of edges) {
      map.set(edge.id, []);
    }

    // Map evidence to edges based on location and type
    for (const item of evidence.items) {
      // Find matching edges
      for (const edge of edges) {
        if (this.evidenceMatchesEdge(item, edge)) {
          const existing = map.get(edge.id) ?? [];
          existing.push(item);
          map.set(edge.id, existing);
        }
      }
    }

    return map;
  }

  /**
   * Check if evidence matches an edge
   */
  private evidenceMatchesEdge(evidence: Evidence, edge: GraphEdge): boolean {
    // Match based on evidence metadata if available
    const raw = evidence.raw as { edgeId?: string; sourceId?: string; targetId?: string } | undefined;

    if (raw?.edgeId === edge.id) {
      return true;
    }

    if (raw?.sourceId === edge.source && raw?.targetId === edge.target) {
      return true;
    }

    // Match based on expression in edge metadata
    const edgeExpression = edge.metadata?.expression as string | undefined;
    if (edgeExpression && evidence.description.includes(edgeExpression)) {
      return true;
    }

    return false;
  }

  /**
   * Normalize confidence score
   */
  private normalizeConfidence(confidence: number): number {
    // Ensure within bounds
    confidence = Math.max(0, Math.min(100, confidence));

    // Round to integer
    return Math.round(confidence);
  }

  /**
   * Create default scoring rules
   */
  private createDefaultRules(): ScoringRule[] {
    return [
      {
        id: 'explicit-depends-on',
        name: 'Explicit depends_on',
        description: 'Direct depends_on declaration in code',
        appliesTo: ['depends_on_directive'],
        baseScore: 45,
        multiplier: 1.2,
        conditions: [],
        priority: 100,
      },
      {
        id: 'explicit-reference',
        name: 'Explicit Reference',
        description: 'Direct attribute reference (e.g., resource.name.attr)',
        appliesTo: ['explicit_reference'],
        baseScore: 40,
        multiplier: 1.0,
        conditions: [],
        priority: 95,
      },
      {
        id: 'module-source',
        name: 'Module Source',
        description: 'Module source declaration',
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
        baseScore: 30,
        multiplier: 1.0,
        conditions: [],
        priority: 85,
      },
      {
        id: 'provider-alias',
        name: 'Provider Alias',
        description: 'Provider alias reference',
        appliesTo: ['provider_alias'],
        baseScore: 30,
        multiplier: 1.0,
        conditions: [],
        priority: 80,
      },
      {
        id: 'function-call',
        name: 'Function Call',
        description: 'Reference via function argument',
        appliesTo: ['function_call'],
        baseScore: 25,
        multiplier: 1.0,
        conditions: [],
        priority: 75,
      },
      {
        id: 'for-expression',
        name: 'For Expression',
        description: 'Reference in for expression',
        appliesTo: ['for_expression'],
        baseScore: 25,
        multiplier: 1.0,
        conditions: [],
        priority: 70,
      },
      {
        id: 'conditional',
        name: 'Conditional Expression',
        description: 'Reference in conditional',
        appliesTo: ['conditional'],
        baseScore: 25,
        multiplier: 1.0,
        conditions: [],
        priority: 70,
      },
      {
        id: 'label-matching',
        name: 'Label Matching',
        description: 'Kubernetes label/selector matching',
        appliesTo: ['label_matching'],
        baseScore: 30,
        multiplier: 1.0,
        conditions: [],
        priority: 75,
      },
      {
        id: 'block-nesting',
        name: 'Block Nesting',
        description: 'Structural relationship via nesting',
        appliesTo: ['block_nesting'],
        baseScore: 20,
        multiplier: 0.9,
        conditions: [],
        priority: 60,
      },
      {
        id: 'attribute-assignment',
        name: 'Attribute Assignment',
        description: 'Indirect reference via attribute',
        appliesTo: ['attribute_assignment'],
        baseScore: 20,
        multiplier: 0.9,
        conditions: [],
        priority: 55,
      },
      {
        id: 'namespace-scoping',
        name: 'Namespace Scoping',
        description: 'Relationship within same namespace',
        appliesTo: ['namespace_scoping'],
        baseScore: 15,
        multiplier: 0.8,
        conditions: [],
        priority: 50,
      },
      {
        id: 'naming-convention',
        name: 'Naming Convention',
        description: 'Inferred from naming patterns',
        appliesTo: ['naming_convention'],
        baseScore: 10,
        multiplier: 0.7,
        conditions: [],
        priority: 30,
      },
      {
        id: 'resource-proximity',
        name: 'Resource Proximity',
        description: 'Resources in same file/module',
        appliesTo: ['resource_proximity'],
        baseScore: 5,
        multiplier: 0.6,
        conditions: [],
        priority: 20,
      },
    ];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new scoring service
 */
export function createScoringService(
  config?: Partial<ScoringServiceConfig>
): IScoringService {
  return new ScoringService(config);
}
