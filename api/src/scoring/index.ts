/**
 * Scoring Module Exports
 * @module scoring
 *
 * Confidence scoring system for dependency detection.
 * TASK-DETECT-009: Confidence scoring implementation
 */

export {
  // Classes
  ScoringEngine,
  RuleEngine,

  // Interfaces
  type IScoringEngine,
  type IRuleEngine,
  type ScoringContext,
  type RuleEvaluationResult,

  // Constants
  DEFAULT_SCORING_CONFIG,
  CONFIDENCE_THRESHOLDS,

  // Functions
  createScoringEngine,
  evaluateRules,
  normalizeScore,
} from './scoring-engine';
