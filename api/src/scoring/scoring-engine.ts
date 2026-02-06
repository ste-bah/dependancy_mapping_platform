/**
 * Scoring Engine Implementation
 * @module scoring/scoring-engine
 *
 * Confidence scoring engine for dependency detection.
 * Implements rule-based scoring with weighted evidence aggregation.
 *
 * TASK-DETECT-009: Confidence scoring for IaC dependency detection
 */

import {
  Evidence,
  EvidenceType,
  EvidenceCategory,
  ConfidenceScore,
  ConfidenceLevel,
  ConfidenceBreakdown,
  ScoringRule,
  ScoringCondition,
  getConfidenceLevel,
} from '../types/evidence';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Scoring engine configuration
 */
export interface ScoringConfig {
  /** Minimum score before penalties */
  readonly minScore: number;
  /** Maximum score cap */
  readonly maxScore: number;
  /** Weight for explicit evidence */
  readonly explicitWeight: number;
  /** Weight for semantic evidence */
  readonly semanticWeight: number;
  /** Weight for structural evidence */
  readonly structuralWeight: number;
  /** Weight for heuristic evidence */
  readonly heuristicWeight: number;
  /** Enable diminishing returns for multiple evidence */
  readonly enableDiminishingReturns: boolean;
  /** Multiplier decay rate for diminishing returns */
  readonly decayRate: number;
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  minScore: 0,
  maxScore: 100,
  explicitWeight: 1.0,
  semanticWeight: 0.9,
  structuralWeight: 0.8,
  heuristicWeight: 0.6,
  enableDiminishingReturns: true,
  decayRate: 0.85,
};

/**
 * Confidence level thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  certain: 95,
  high: 80,
  medium: 60,
  low: 40,
  uncertain: 0,
} as const;

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context for scoring operations
 */
export interface ScoringContext {
  /** Evidence items to score */
  readonly evidence: Evidence[];
  /** Custom rules to apply */
  readonly customRules?: ScoringRule[];
  /** Scoring configuration overrides */
  readonly config?: Partial<ScoringConfig>;
  /** Additional context metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of rule evaluation
 */
export interface RuleEvaluationResult {
  /** Rule that was evaluated */
  readonly rule: ScoringRule;
  /** Whether the rule matched */
  readonly matched: boolean;
  /** Score contribution from this rule */
  readonly scoreContribution: number;
  /** Evidence items that triggered this rule */
  readonly matchedEvidence: Evidence[];
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Scoring engine interface
 */
export interface IScoringEngine {
  /**
   * Calculate confidence score for evidence
   */
  calculate(context: ScoringContext): ConfidenceScore;

  /**
   * Get confidence level for a numeric score
   */
  getLevel(score: number): ConfidenceLevel;

  /**
   * Validate a confidence score
   */
  validate(score: ConfidenceScore): boolean;

  /**
   * Merge multiple confidence scores
   */
  merge(scores: ConfidenceScore[]): ConfidenceScore;
}

/**
 * Rule engine interface
 */
export interface IRuleEngine {
  /**
   * Evaluate rules against evidence
   */
  evaluate(evidence: Evidence[], rules: ScoringRule[]): RuleEvaluationResult[];

  /**
   * Check if a condition matches
   */
  matchCondition(evidence: Evidence, condition: ScoringCondition): boolean;

  /**
   * Get applicable rules for evidence type
   */
  getApplicableRules(type: EvidenceType, rules: ScoringRule[]): ScoringRule[];
}

// ============================================================================
// Rule Engine Implementation
// ============================================================================

/**
 * Rule engine for evaluating scoring rules
 */
export class RuleEngine implements IRuleEngine {
  /**
   * Evaluate rules against evidence
   */
  evaluate(evidence: Evidence[], rules: ScoringRule[]): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    // Sort rules by priority (higher first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const matchedEvidence = evidence.filter(e =>
        rule.appliesTo.includes(e.type) &&
        this.checkConditions(e, rule.conditions)
      );

      const matched = matchedEvidence.length > 0;
      const scoreContribution = matched
        ? rule.baseScore * rule.multiplier * matchedEvidence.length
        : 0;

      results.push({
        rule,
        matched,
        scoreContribution,
        matchedEvidence,
      });
    }

    return results;
  }

  /**
   * Check if a condition matches
   */
  matchCondition(evidence: Evidence, condition: ScoringCondition): boolean {
    const value = this.getFieldValue(evidence, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return typeof value === 'string' &&
          typeof condition.value === 'string' &&
          value.includes(condition.value);
      case 'matches':
        return typeof value === 'string' &&
          typeof condition.value === 'string' &&
          new RegExp(condition.value).test(value);
      case 'gt':
        return typeof value === 'number' &&
          typeof condition.value === 'number' &&
          value > condition.value;
      case 'lt':
        return typeof value === 'number' &&
          typeof condition.value === 'number' &&
          value < condition.value;
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }

  /**
   * Get applicable rules for evidence type
   */
  getApplicableRules(type: EvidenceType, rules: ScoringRule[]): ScoringRule[] {
    return rules.filter(rule => rule.appliesTo.includes(type));
  }

  /**
   * Check all conditions for a rule
   */
  private checkConditions(evidence: Evidence, conditions: ScoringCondition[]): boolean {
    if (conditions.length === 0) return true;
    return conditions.every(c => this.matchCondition(evidence, c));
  }

  /**
   * Get field value from evidence using dot notation
   */
  private getFieldValue(evidence: Evidence, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = evidence;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }
}

// ============================================================================
// Scoring Engine Implementation
// ============================================================================

/**
 * Confidence scoring engine
 */
export class ScoringEngine implements IScoringEngine {
  private readonly config: ScoringConfig;
  private readonly ruleEngine: IRuleEngine;

  constructor(config: Partial<ScoringConfig> = {}, ruleEngine?: IRuleEngine) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
    this.ruleEngine = ruleEngine ?? new RuleEngine();
  }

  /**
   * Calculate confidence score for evidence
   */
  calculate(context: ScoringContext): ConfidenceScore {
    const { evidence, customRules = [], config = {} } = context;
    const mergedConfig = { ...this.config, ...config };

    if (evidence.length === 0) {
      return this.createEmptyScore();
    }

    // Calculate base score from evidence
    const baseScore = this.calculateBaseScore(evidence, mergedConfig);

    // Apply rules
    const allRules = [...DEFAULT_RULES, ...customRules];
    const ruleResults = this.ruleEngine.evaluate(evidence, allRules);

    // Calculate bonuses and penalties
    const explicitBonus = this.calculateExplicitBonus(evidence);
    const heuristicPenalty = this.calculateHeuristicPenalty(evidence);
    const patternBonus = this.calculatePatternBonus(evidence);
    const evidenceMultiplier = this.calculateEvidenceMultiplier(evidence, mergedConfig);

    // Combine scores
    let finalScore = baseScore * evidenceMultiplier;
    finalScore += explicitBonus;
    finalScore -= heuristicPenalty;
    finalScore += patternBonus;

    // Add rule contributions
    for (const result of ruleResults) {
      if (result.matched) {
        finalScore += result.scoreContribution * 0.1; // Rules contribute 10% of their score
      }
    }

    // Normalize to bounds
    finalScore = normalizeScore(finalScore, mergedConfig.minScore, mergedConfig.maxScore);

    // Build breakdown
    const breakdown: ConfidenceBreakdown = {
      baseScore,
      evidenceMultiplier,
      explicitBonus,
      heuristicPenalty,
      patternBonus,
    };

    // Collect factors
    const { positiveFactors, negativeFactors } = this.collectFactors(
      evidence,
      ruleResults,
      breakdown
    );

    return {
      value: Math.round(finalScore),
      breakdown,
      level: this.getLevel(finalScore),
      positiveFactors,
      negativeFactors,
    };
  }

  /**
   * Get confidence level for a numeric score
   */
  getLevel(score: number): ConfidenceLevel {
    return getConfidenceLevel(score);
  }

  /**
   * Validate a confidence score
   */
  validate(score: ConfidenceScore): boolean {
    return (
      score.value >= this.config.minScore &&
      score.value <= this.config.maxScore &&
      score.level === this.getLevel(score.value)
    );
  }

  /**
   * Merge multiple confidence scores
   */
  merge(scores: ConfidenceScore[]): ConfidenceScore {
    if (scores.length === 0) {
      return this.createEmptyScore();
    }

    if (scores.length === 1) {
      return scores[0];
    }

    // Use weighted average based on evidence multiplier
    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of scores) {
      const weight = score.breakdown.evidenceMultiplier;
      weightedSum += score.value * weight;
      totalWeight += weight;
    }

    const mergedValue = Math.round(weightedSum / totalWeight);

    // Merge breakdowns
    const mergedBreakdown: ConfidenceBreakdown = {
      baseScore: this.average(scores.map(s => s.breakdown.baseScore)),
      evidenceMultiplier: this.average(scores.map(s => s.breakdown.evidenceMultiplier)),
      explicitBonus: this.sum(scores.map(s => s.breakdown.explicitBonus)),
      heuristicPenalty: this.max(scores.map(s => s.breakdown.heuristicPenalty)),
      patternBonus: this.max(scores.map(s => s.breakdown.patternBonus)),
    };

    // Merge factors
    const positiveFactors = [...new Set(scores.flatMap(s => s.positiveFactors))];
    const negativeFactors = [...new Set(scores.flatMap(s => s.negativeFactors))];

    return {
      value: mergedValue,
      breakdown: mergedBreakdown,
      level: this.getLevel(mergedValue),
      positiveFactors,
      negativeFactors,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private calculateBaseScore(evidence: Evidence[], config: ScoringConfig): number {
    let total = 0;
    let count = 0;

    for (const e of evidence) {
      const weight = this.getCategoryWeight(e.category, config);
      total += e.confidence * weight;
      count++;
    }

    return count > 0 ? total / count : 0;
  }

  private getCategoryWeight(category: EvidenceCategory, config: ScoringConfig): number {
    switch (category) {
      case 'explicit':
        return config.explicitWeight;
      case 'semantic':
        return config.semanticWeight;
      case 'structural':
        return config.structuralWeight;
      case 'syntax':
        return config.semanticWeight;
      case 'heuristic':
        return config.heuristicWeight;
      default:
        return 1.0;
    }
  }

  private calculateExplicitBonus(evidence: Evidence[]): number {
    const explicitCount = evidence.filter(e => e.category === 'explicit').length;
    return Math.min(20, explicitCount * 10);
  }

  private calculateHeuristicPenalty(evidence: Evidence[]): number {
    const heuristicOnly = evidence.every(e => e.category === 'heuristic');
    if (!heuristicOnly) return 0;

    const avgConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    return avgConfidence < 50 ? 15 : 5;
  }

  private calculatePatternBonus(evidence: Evidence[]): number {
    const categories = new Set(evidence.map(e => e.category));
    const types = new Set(evidence.map(e => e.type));

    let bonus = 0;

    // Bonus for multiple categories
    if (categories.size >= 2) bonus += 5;
    if (categories.size >= 3) bonus += 5;

    // Bonus for multiple evidence types
    if (types.size >= 3) bonus += 5;
    if (types.size >= 5) bonus += 5;

    return bonus;
  }

  private calculateEvidenceMultiplier(evidence: Evidence[], config: ScoringConfig): number {
    if (!config.enableDiminishingReturns) {
      return 1.0;
    }

    // Start at 1.0 and increase with diminishing returns
    let multiplier = 1.0;
    for (let i = 1; i < evidence.length; i++) {
      multiplier += Math.pow(config.decayRate, i) * 0.1;
    }

    return Math.min(1.5, multiplier);
  }

  private collectFactors(
    evidence: Evidence[],
    ruleResults: RuleEvaluationResult[],
    breakdown: ConfidenceBreakdown
  ): { positiveFactors: string[]; negativeFactors: string[] } {
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    // Evidence-based factors
    if (evidence.some(e => e.category === 'explicit')) {
      positiveFactors.push('Explicit dependency declaration found');
    }

    if (evidence.length > 1) {
      positiveFactors.push(`Multiple evidence sources (${evidence.length})`);
    }

    const categories = new Set(evidence.map(e => e.category));
    if (categories.size >= 2) {
      positiveFactors.push('Evidence from multiple categories');
    }

    // Breakdown-based factors
    if (breakdown.explicitBonus > 0) {
      positiveFactors.push(`Explicit evidence bonus (+${breakdown.explicitBonus})`);
    }

    if (breakdown.patternBonus > 0) {
      positiveFactors.push(`Pattern consistency bonus (+${breakdown.patternBonus})`);
    }

    if (breakdown.heuristicPenalty > 0) {
      negativeFactors.push(`Heuristic-only evidence penalty (-${breakdown.heuristicPenalty})`);
    }

    // Rule-based factors
    for (const result of ruleResults) {
      if (result.matched && result.scoreContribution > 0) {
        positiveFactors.push(`Rule matched: ${result.rule.name}`);
      }
    }

    return { positiveFactors, negativeFactors };
  }

  private createEmptyScore(): ConfidenceScore {
    return {
      value: 0,
      breakdown: {
        baseScore: 0,
        evidenceMultiplier: 1,
        explicitBonus: 0,
        heuristicPenalty: 0,
        patternBonus: 0,
      },
      level: 'uncertain',
      positiveFactors: [],
      negativeFactors: ['No evidence provided'],
    };
  }

  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
  }

  private max(values: number[]): number {
    return values.length > 0 ? Math.max(...values) : 0;
  }
}

// ============================================================================
// Default Rules
// ============================================================================

/**
 * Default scoring rules
 */
const DEFAULT_RULES: ScoringRule[] = [
  {
    id: 'explicit-depends-on',
    name: 'Explicit depends_on',
    description: 'Explicit depends_on declaration in code',
    appliesTo: ['depends_on_directive'],
    baseScore: 40,
    multiplier: 1.2,
    conditions: [],
    priority: 100,
  },
  {
    id: 'explicit-reference',
    name: 'Explicit Reference',
    description: 'Direct attribute reference',
    appliesTo: ['explicit_reference'],
    baseScore: 35,
    multiplier: 1.0,
    conditions: [],
    priority: 95,
  },
  {
    id: 'module-source',
    name: 'Module Source',
    description: 'Module source declaration',
    appliesTo: ['module_source'],
    baseScore: 30,
    multiplier: 1.0,
    conditions: [],
    priority: 90,
  },
  {
    id: 'interpolation',
    name: 'String Interpolation',
    description: 'Reference via interpolation',
    appliesTo: ['interpolation'],
    baseScore: 25,
    multiplier: 1.0,
    conditions: [],
    priority: 80,
  },
  {
    id: 'function-call',
    name: 'Function Call',
    description: 'Reference via function argument',
    appliesTo: ['function_call'],
    baseScore: 20,
    multiplier: 1.0,
    conditions: [],
    priority: 70,
  },
  {
    id: 'label-matching',
    name: 'Label Matching',
    description: 'Kubernetes label/selector matching',
    appliesTo: ['label_matching'],
    baseScore: 25,
    multiplier: 1.0,
    conditions: [],
    priority: 75,
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
// Factory Functions
// ============================================================================

/**
 * Create a new scoring engine
 */
export function createScoringEngine(config?: Partial<ScoringConfig>): IScoringEngine {
  return new ScoringEngine(config);
}

/**
 * Evaluate rules against evidence (convenience function)
 */
export function evaluateRules(evidence: Evidence[], rules: ScoringRule[]): RuleEvaluationResult[] {
  const engine = new RuleEngine();
  return engine.evaluate(evidence, rules);
}

/**
 * Normalize score to bounds
 */
export function normalizeScore(score: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, score));
}
