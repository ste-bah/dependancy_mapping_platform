/**
 * Confidence Scorer for TF-Helm Cross-Reference Detection
 * @module parsers/crossref/confidence-scorer
 *
 * Implements the confidence scoring algorithm for detected Terraform-to-Helm
 * data flows. Calculates confidence scores based on pattern type, evidence
 * strength, and various bonuses/penalties.
 *
 * TASK-XREF-003: TF-Helm Cross-Reference Detection - Confidence Scoring
 */

import {
  TfHelmFlowPattern,
  PartialFlow,
  ScoredFlow,
  ScoreBreakdown,
  FlowEvidence,
  FlowEvidenceType,
  ConfidenceLevel,
  PATTERN_BASE_SCORES,
  EVIDENCE_TYPE_WEIGHTS,
  getConfidenceLevel,
} from './types';
import { IConfidenceScorer } from './interfaces';

// ============================================================================
// Scoring Configuration
// ============================================================================

/**
 * Configurable weights for scoring adjustments
 */
export interface ScoringWeights {
  /** Weight multiplier for evidence score contribution */
  readonly evidenceWeight: number;
  /** Bonus for explicit ${{ needs.*.outputs.* }} references */
  readonly explicitReferenceBonus: number;
  /** Bonus for job dependency (needs:) being present */
  readonly jobDependencyBonus: number;
  /** Bonus for naming convention matches */
  readonly namingMatchBonus: number;
  /** Penalty per transformation step */
  readonly transformationPenalty: number;
  /** Penalty for weak/inferred evidence */
  readonly weakEvidencePenalty: number;
  /** Maximum penalty cap */
  readonly maxPenalty: number;
  /** Maximum bonus cap */
  readonly maxBonus: number;
}

/**
 * Default scoring weights
 */
export const DEFAULT_SCORING_WEIGHTS: Readonly<ScoringWeights> = {
  evidenceWeight: 0.3,
  explicitReferenceBonus: 10,
  jobDependencyBonus: 5,
  namingMatchBonus: 3,
  transformationPenalty: 3,
  weakEvidencePenalty: 5,
  maxPenalty: 25,
  maxBonus: 20,
};

// ============================================================================
// ConfidenceScorer Implementation
// ============================================================================

/**
 * Calculates confidence scores for detected TF-Helm flows.
 *
 * The scoring algorithm considers:
 * - Base score from flow pattern type
 * - Evidence strength accumulation
 * - Bonuses for explicit references and job dependencies
 * - Penalties for transformations and weak evidence
 *
 * @example
 * ```typescript
 * const scorer = new ConfidenceScorer();
 * const scoredFlow = scorer.scoreFlow(partialFlow);
 * console.log(`Confidence: ${scoredFlow.confidence} (${scoredFlow.confidenceLevel})`);
 * ```
 */
export class ConfidenceScorer implements IConfidenceScorer {
  private readonly weights: ScoringWeights;

  /**
   * Create a new ConfidenceScorer instance
   * @param weights - Optional custom scoring weights
   */
  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
  }

  /**
   * Score a partial flow and return a fully scored flow
   * @param flow - Partial flow without confidence score
   * @returns Scored flow with confidence score and breakdown
   */
  scoreFlow(flow: PartialFlow): ScoredFlow {
    const breakdown = this.getBreakdown(flow);
    const confidence = breakdown.total;
    const confidenceLevel = this.getConfidenceLevel(confidence);

    return {
      ...flow,
      confidence,
      confidenceLevel,
      scoreBreakdown: breakdown,
    };
  }

  /**
   * Get detailed score breakdown for a flow
   * @param flow - Partial flow to analyze
   * @returns Score breakdown with component scores
   */
  getBreakdown(flow: PartialFlow): ScoreBreakdown {
    const patternBase = this.getPatternBaseScore(flow.pattern);
    const evidenceScore = this.calculateEvidenceScore(flow.evidence);
    const explicitBonus = this.calculateExplicitBonus(flow);
    const weaknessPenalty = this.calculateWeaknessPenalty(flow);

    // Calculate total score with bounds
    const rawTotal = patternBase + evidenceScore + explicitBonus - weaknessPenalty;
    const total = Math.max(0, Math.min(100, Math.round(rawTotal)));

    return {
      patternBase,
      evidenceScore,
      explicitBonus,
      weaknessPenalty,
      total,
    };
  }

  /**
   * Get the base score for a pattern type
   * @param pattern - Flow pattern
   * @returns Base confidence score (0-100)
   */
  getPatternBaseScore(pattern: TfHelmFlowPattern): number {
    return PATTERN_BASE_SCORES[pattern] ?? 40; // Default to 40 for unknown patterns
  }

  /**
   * Calculate evidence contribution to score
   * @param evidence - Array of flow evidence
   * @returns Evidence score component (0-30)
   */
  calculateEvidenceScore(evidence: readonly FlowEvidence[]): number {
    if (evidence.length === 0) {
      return 0;
    }

    // Calculate weighted average of evidence strengths
    let totalWeight = 0;
    let weightedSum = 0;

    for (const item of evidence) {
      const typeWeight = EVIDENCE_TYPE_WEIGHTS[item.type] ?? 0.5;
      weightedSum += item.strength * typeWeight;
      totalWeight += typeWeight;
    }

    if (totalWeight === 0) {
      return 0;
    }

    const averageStrength = weightedSum / totalWeight;

    // Scale to evidence weight contribution (max 30 points)
    return Math.round(averageStrength * this.weights.evidenceWeight);
  }

  /**
   * Determine confidence level from score
   * @param score - Confidence score (0-100)
   * @returns Confidence level classification
   */
  getConfidenceLevel(score: number): ConfidenceLevel {
    return getConfidenceLevel(score);
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Calculate bonus points from explicit references and dependencies
   */
  private calculateExplicitBonus(flow: PartialFlow): number {
    let bonus = 0;

    // Check for explicit reference evidence
    const hasExplicitRef = flow.evidence.some(
      (e) => e.type === 'explicit_reference'
    );
    if (hasExplicitRef) {
      bonus += this.weights.explicitReferenceBonus;
    }

    // Check for job dependency evidence
    const hasJobDependency = flow.evidence.some(
      (e) => e.type === 'job_dependency'
    );
    if (hasJobDependency) {
      bonus += this.weights.jobDependencyBonus;
    }

    // Check for naming convention match
    const hasNamingMatch = flow.evidence.some(
      (e) => e.type === 'naming_convention'
    );
    if (hasNamingMatch) {
      bonus += this.weights.namingMatchBonus;
    }

    // Check evidence snippets for explicit needs references
    const hasNeedsRef = flow.evidence.some(
      (e) =>
        e.snippet?.includes('needs.') ||
        e.snippet?.includes('needs:') ||
        e.description?.includes('explicit reference')
    );
    if (hasNeedsRef && !hasExplicitRef) {
      bonus += this.weights.explicitReferenceBonus * 0.5;
    }

    // Cap the bonus
    return Math.min(bonus, this.weights.maxBonus);
  }

  /**
   * Calculate penalty points from weak evidence and transformations
   */
  private calculateWeaknessPenalty(flow: PartialFlow): number {
    let penalty = 0;

    // Count weak evidence types
    const weakEvidenceTypes: FlowEvidenceType[] = [
      'semantic_match',
      'step_proximity',
      'naming_convention',
    ];

    const weakCount = flow.evidence.filter((e) =>
      weakEvidenceTypes.includes(e.type)
    ).length;

    // Penalty if ONLY weak evidence exists
    const strongEvidenceTypes: FlowEvidenceType[] = [
      'explicit_reference',
      'expression_match',
      'job_dependency',
    ];

    const strongCount = flow.evidence.filter((e) =>
      strongEvidenceTypes.includes(e.type)
    ).length;

    if (weakCount > 0 && strongCount === 0) {
      penalty += this.weights.weakEvidencePenalty;
    }

    // Penalty for transformation complexity (jq, envsubst, etc.)
    const transformationIndicators = ['jq ', 'yq ', 'envsubst', 'sed ', 'awk '];
    for (const indicator of transformationIndicators) {
      const hasTransform = flow.evidence.some(
        (e) => e.snippet?.includes(indicator) || e.description?.includes(indicator)
      );
      if (hasTransform) {
        penalty += this.weights.transformationPenalty;
      }
    }

    // Penalty for inferred pattern
    if (flow.pattern === 'inferred') {
      penalty += this.weights.weakEvidencePenalty;
    }

    // Penalty for low individual evidence strength
    const lowStrengthEvidence = flow.evidence.filter((e) => e.strength < 50);
    if (lowStrengthEvidence.length > flow.evidence.length / 2) {
      penalty += this.weights.weakEvidencePenalty;
    }

    // Cap the penalty
    return Math.min(penalty, this.weights.maxPenalty);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ConfidenceScorer instance with optional custom weights
 * @param weights - Optional partial weights to override defaults
 * @returns Configured ConfidenceScorer instance
 *
 * @example
 * ```typescript
 * // With default weights
 * const scorer = createConfidenceScorer();
 *
 * // With custom weights
 * const customScorer = createConfidenceScorer({
 *   explicitReferenceBonus: 15,
 *   transformationPenalty: 5,
 * });
 * ```
 */
export function createConfidenceScorer(
  weights?: Partial<ScoringWeights>
): IConfidenceScorer {
  return new ConfidenceScorer(weights);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the confidence score for a flow without creating a full ScoredFlow
 * @param flow - Partial flow to score
 * @param weights - Optional custom scoring weights
 * @returns Confidence score (0-100)
 */
export function calculateFlowConfidence(
  flow: PartialFlow,
  weights?: Partial<ScoringWeights>
): number {
  const scorer = new ConfidenceScorer(weights);
  return scorer.getBreakdown(flow).total;
}

/**
 * Batch score multiple flows
 * @param flows - Array of partial flows
 * @param weights - Optional custom scoring weights
 * @returns Array of scored flows
 */
export function scoreFlows(
  flows: readonly PartialFlow[],
  weights?: Partial<ScoringWeights>
): ScoredFlow[] {
  const scorer = new ConfidenceScorer(weights);
  return flows.map((flow) => scorer.scoreFlow(flow));
}

/**
 * Filter flows by minimum confidence score
 * @param flows - Array of scored flows
 * @param minConfidence - Minimum confidence threshold
 * @returns Filtered array of flows meeting the threshold
 */
export function filterByConfidence(
  flows: readonly ScoredFlow[],
  minConfidence: number
): ScoredFlow[] {
  return flows.filter((flow) => flow.confidence >= minConfidence);
}

/**
 * Sort flows by confidence score (descending)
 * @param flows - Array of scored flows
 * @returns Sorted array (highest confidence first)
 */
export function sortByConfidence(flows: readonly ScoredFlow[]): ScoredFlow[] {
  return [...flows].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Group flows by confidence level
 * @param flows - Array of scored flows
 * @returns Map of confidence level to flows
 */
export function groupByConfidenceLevel(
  flows: readonly ScoredFlow[]
): Map<ConfidenceLevel, ScoredFlow[]> {
  const groups = new Map<ConfidenceLevel, ScoredFlow[]>([
    ['high', []],
    ['medium', []],
    ['low', []],
  ]);

  for (const flow of flows) {
    const level = flow.confidenceLevel;
    const group = groups.get(level);
    if (group) {
      group.push(flow);
    }
  }

  return groups;
}

/**
 * Calculate average confidence across flows
 * @param flows - Array of scored flows
 * @returns Average confidence score
 */
export function calculateAverageConfidence(flows: readonly ScoredFlow[]): number {
  if (flows.length === 0) {
    return 0;
  }

  const sum = flows.reduce((acc, flow) => acc + flow.confidence, 0);
  return Math.round(sum / flows.length);
}
