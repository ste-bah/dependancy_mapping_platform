/**
 * Evidence Type Definitions
 * @module types/evidence
 *
 * Types for evidence collection and management in the dependency detection system.
 * Implements Evidence, EvidencePointer from Phase 3 interface-designer output.
 *
 * TASK-DETECT-009: Evidence and confidence scoring types
 */

import { NodeLocation } from './graph';

// ============================================================================
// Evidence Types
// ============================================================================

/**
 * Evidence supporting a dependency detection
 */
export interface Evidence {
  /** Unique evidence identifier */
  readonly id: string;
  /** Type of evidence collected */
  readonly type: EvidenceType;
  /** Human-readable description */
  readonly description: string;
  /** Evidence category for grouping */
  readonly category: EvidenceCategory;
  /** Source location where evidence was found */
  readonly location: EvidenceLocation;
  /** Confidence contribution (0-100) */
  readonly confidence: number;
  /** Raw data supporting the evidence */
  readonly raw?: unknown;
  /** When the evidence was collected */
  readonly collectedAt: Date;
  /** Evidence collection method */
  readonly method: EvidenceMethod;
}

/**
 * Types of evidence that can be collected
 */
export type EvidenceType =
  // Syntactic Evidence
  | 'explicit_reference'      // Direct attribute reference in code
  | 'depends_on_directive'    // Explicit depends_on declaration
  | 'module_source'           // Module source specification
  | 'provider_alias'          // Provider alias usage
  | 'variable_default'        // Variable with default value
  // Semantic Evidence
  | 'interpolation'           // String interpolation reference
  | 'function_call'           // Function call with reference
  | 'for_expression'          // For expression iteration
  | 'conditional'             // Conditional expression
  | 'splat_operation'         // Splat operator usage
  // Structural Evidence
  | 'block_nesting'           // Nested block relationship
  | 'attribute_assignment'    // Attribute value assignment
  | 'label_matching'          // Label/selector matching
  | 'namespace_scoping'       // Namespace scoping relationship
  // Heuristic Evidence
  | 'naming_convention'       // Naming pattern match
  | 'resource_proximity'      // Resources in same file/module
  | 'provider_inference'      // Inferred provider relationship
  | 'type_compatibility'      // Compatible resource types;

/**
 * Categories for grouping evidence
 */
export type EvidenceCategory =
  | 'syntax'       // Evidence from code syntax
  | 'semantic'     // Evidence from code meaning
  | 'structural'   // Evidence from code structure
  | 'heuristic'    // Evidence from patterns/inference
  | 'explicit';    // Explicitly declared evidence

/**
 * Methods used to collect evidence
 */
export type EvidenceMethod =
  | 'ast_analysis'        // AST traversal and analysis
  | 'regex_pattern'       // Regular expression matching
  | 'semantic_analysis'   // Deep semantic analysis
  | 'graph_traversal'     // Graph-based analysis
  | 'machine_learning'    // ML-based inference
  | 'rule_engine';        // Rule-based detection

/**
 * Location where evidence was found
 */
export interface EvidenceLocation {
  /** File path */
  readonly file: string;
  /** Line range */
  readonly lines: {
    readonly start: number;
    readonly end: number;
  };
  /** Column range (optional) */
  readonly columns?: {
    readonly start: number;
    readonly end: number;
  };
  /** Byte offset range (optional) */
  readonly offset?: {
    readonly start: number;
    readonly end: number;
  };
  /** Code snippet (optional) */
  readonly snippet?: string;
}

// ============================================================================
// Evidence Pointer
// ============================================================================

/**
 * Pointer to evidence location for efficient retrieval
 */
export interface EvidencePointer {
  /** Evidence ID being pointed to */
  readonly evidenceId: string;
  /** File containing the evidence */
  readonly file: string;
  /** Start byte offset */
  readonly startOffset: number;
  /** End byte offset */
  readonly endOffset: number;
  /** Checksum of the content for validation */
  readonly contentHash: string;
}

// ============================================================================
// Evidence Collection
// ============================================================================

/**
 * Collection of evidence for a detection
 */
export interface EvidenceCollection {
  /** All evidence items */
  readonly items: Evidence[];
  /** Aggregated confidence score */
  readonly aggregatedConfidence: number;
  /** Primary evidence (highest confidence) */
  readonly primaryEvidence: Evidence | null;
  /** Evidence count by type */
  readonly countByType: Record<EvidenceType, number>;
  /** Evidence count by category */
  readonly countByCategory: Record<EvidenceCategory, number>;
}

/**
 * Evidence aggregation result
 */
export interface EvidenceAggregation {
  /** Total evidence count */
  readonly totalCount: number;
  /** Unique evidence types found */
  readonly uniqueTypes: EvidenceType[];
  /** Category distribution */
  readonly categoryDistribution: Record<EvidenceCategory, number>;
  /** Confidence statistics */
  readonly confidenceStats: {
    readonly min: number;
    readonly max: number;
    readonly mean: number;
    readonly median: number;
  };
}

// ============================================================================
// Confidence Scoring
// ============================================================================

/**
 * Confidence score for a detection
 */
export interface ConfidenceScore {
  /** Overall confidence score (0-100) */
  readonly value: number;
  /** Score breakdown by factor */
  readonly breakdown: ConfidenceBreakdown;
  /** Confidence level classification */
  readonly level: ConfidenceLevel;
  /** Factors that increased confidence */
  readonly positiveFactors: string[];
  /** Factors that decreased confidence */
  readonly negativeFactors: string[];
}

/**
 * Breakdown of confidence score components
 */
export interface ConfidenceBreakdown {
  /** Base score from evidence type */
  readonly baseScore: number;
  /** Bonus from multiple evidence sources */
  readonly evidenceMultiplier: number;
  /** Bonus from explicit declarations */
  readonly explicitBonus: number;
  /** Penalty from heuristic-only detection */
  readonly heuristicPenalty: number;
  /** Bonus from consistent patterns */
  readonly patternBonus: number;
}

/**
 * Confidence level classification
 */
export type ConfidenceLevel =
  | 'certain'      // 95-100: Explicit declaration or definite reference
  | 'high'         // 80-94: Strong evidence from multiple sources
  | 'medium'       // 60-79: Reasonable evidence
  | 'low'          // 40-59: Weak evidence, likely correct
  | 'uncertain';   // 0-39: Heuristic only, may be incorrect

/**
 * Scoring rule for confidence calculation
 */
export interface ScoringRule {
  /** Unique rule identifier */
  readonly id: string;
  /** Rule name */
  readonly name: string;
  /** Rule description */
  readonly description: string;
  /** Evidence types this rule applies to */
  readonly appliesTo: EvidenceType[];
  /** Base score contribution */
  readonly baseScore: number;
  /** Score multiplier (applied after base) */
  readonly multiplier: number;
  /** Conditions for applying this rule */
  readonly conditions: ScoringCondition[];
  /** Rule priority (higher = applied first) */
  readonly priority: number;
}

/**
 * Condition for applying a scoring rule
 */
export interface ScoringCondition {
  /** Field to check */
  readonly field: string;
  /** Operator for comparison */
  readonly operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt' | 'exists';
  /** Value to compare against */
  readonly value: unknown;
}

// ============================================================================
// Evidence Validation
// ============================================================================

/**
 * Evidence validation result
 */
export interface EvidenceValidation {
  /** Whether the evidence is valid */
  readonly isValid: boolean;
  /** Validation errors if any */
  readonly errors: EvidenceValidationError[];
  /** Validation warnings */
  readonly warnings: EvidenceValidationWarning[];
}

/**
 * Evidence validation error
 */
export interface EvidenceValidationError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Field that failed validation */
  readonly field?: string;
}

/**
 * Evidence validation warning
 */
export interface EvidenceValidationWarning {
  /** Warning code */
  readonly code: string;
  /** Warning message */
  readonly message: string;
  /** Suggested fix */
  readonly suggestion?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new evidence location from NodeLocation
 */
export function createEvidenceLocation(
  file: string,
  nodeLocation: NodeLocation
): EvidenceLocation {
  return {
    file,
    lines: {
      start: nodeLocation.lineStart,
      end: nodeLocation.lineEnd,
    },
    columns: nodeLocation.columnStart !== undefined && nodeLocation.columnEnd !== undefined
      ? {
          start: nodeLocation.columnStart,
          end: nodeLocation.columnEnd,
        }
      : undefined,
  };
}

/**
 * Calculate confidence level from numeric score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 95) return 'certain';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'uncertain';
}

/**
 * Create an empty evidence collection
 */
export function createEmptyEvidenceCollection(): EvidenceCollection {
  return {
    items: [],
    aggregatedConfidence: 0,
    primaryEvidence: null,
    countByType: {} as Record<EvidenceType, number>,
    countByCategory: {} as Record<EvidenceCategory, number>,
  };
}

/**
 * Calculate aggregated confidence from evidence items
 */
export function calculateAggregatedConfidence(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0;

  // Use a weighted average with diminishing returns for additional evidence
  let totalWeight = 0;
  let weightedSum = 0;

  evidence
    .sort((a, b) => b.confidence - a.confidence) // Sort by confidence descending
    .forEach((e, index) => {
      const weight = 1 / (index + 1); // Diminishing weight
      weightedSum += e.confidence * weight;
      totalWeight += weight;
    });

  // Cap at 100
  return Math.min(100, Math.round(weightedSum / totalWeight));
}
