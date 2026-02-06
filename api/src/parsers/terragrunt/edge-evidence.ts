/**
 * Terragrunt Edge Evidence Types and Utilities
 * @module parsers/terragrunt/edge-evidence
 *
 * TASK-TG-008: Evidence types and builder utilities for Terragrunt edge creation.
 *
 * Provides:
 * - TgEdgeEvidence interface for capturing relationship evidence
 * - TgEvidenceBuilder for fluent evidence construction
 * - Evidence validation functions
 * - Batch factory result types
 */

// ============================================================================
// Evidence Structure
// ============================================================================

/**
 * Evidence supporting a Terragrunt edge relationship.
 * Captures source code evidence for the relationship.
 *
 * @example
 * ```typescript
 * const evidence: TgEdgeEvidence = {
 *   file: 'env/dev/terragrunt.hcl',
 *   lineStart: 5,
 *   lineEnd: 9,
 *   snippet: 'include "root" {\n  path = find_in_parent_folders()\n}',
 *   confidence: 95,
 *   evidenceType: 'explicit',
 *   description: 'Explicit include block with label "root"',
 * };
 * ```
 */
export interface TgEdgeEvidence {
  /** Relative file path where the evidence was found */
  readonly file: string;
  /** Starting line number (1-based) */
  readonly lineStart: number;
  /** Ending line number (1-based) */
  readonly lineEnd: number;
  /** Code snippet containing the evidence */
  readonly snippet: string;
  /** Confidence score for this evidence (0-100) */
  readonly confidence: number;
  /** Type of evidence collection */
  readonly evidenceType: 'explicit' | 'inferred' | 'heuristic';
  /** Human-readable description of the evidence */
  readonly description: string;
}

// ============================================================================
// Evidence Validation
// ============================================================================

/**
 * Validate a single evidence item.
 *
 * @param evidence - Evidence item to validate
 * @param context - Context string for error messages
 * @throws {Error} If validation fails
 *
 * @example
 * ```typescript
 * validateTgEdgeEvidence(evidence, 'Include edge');
 * ```
 */
export function validateTgEdgeEvidence(
  evidence: TgEdgeEvidence,
  context: string = 'Evidence'
): void {
  if (!evidence.file || typeof evidence.file !== 'string') {
    throw new Error(`${context} must have a valid file path`);
  }

  if (typeof evidence.lineStart !== 'number' || evidence.lineStart < 1) {
    throw new Error(`${context} must have a valid lineStart (>= 1)`);
  }

  if (typeof evidence.lineEnd !== 'number' || evidence.lineEnd < evidence.lineStart) {
    throw new Error(`${context} must have lineEnd >= lineStart`);
  }

  if (typeof evidence.confidence !== 'number' || evidence.confidence < 0 || evidence.confidence > 100) {
    throw new Error(`${context} confidence must be between 0 and 100`);
  }

  const validEvidenceTypes = ['explicit', 'inferred', 'heuristic'];
  if (!validEvidenceTypes.includes(evidence.evidenceType)) {
    throw new Error(`${context} evidenceType must be one of: ${validEvidenceTypes.join(', ')}`);
  }

  if (!evidence.description || typeof evidence.description !== 'string') {
    throw new Error(`${context} must have a description`);
  }
}

/**
 * Validate an array of evidence items.
 *
 * @param evidence - Array of evidence items to validate
 * @param context - Context string for error messages
 * @throws {Error} If any validation fails
 */
export function validateTgEdgeEvidenceArray(
  evidence: readonly TgEdgeEvidence[],
  context: string = 'Evidence'
): void {
  if (!Array.isArray(evidence)) {
    throw new Error(`${context} must be an array`);
  }

  evidence.forEach((e, index) => {
    validateTgEdgeEvidence(e, `${context}[${index}]`);
  });
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate aggregated confidence score from multiple evidence items.
 *
 * Uses a weighted average with diminishing returns for additional evidence.
 * Higher confidence evidence items are weighted more heavily.
 *
 * @param evidence - Array of evidence items with individual confidence scores
 * @returns Aggregated confidence score (0-100)
 *
 * @example
 * ```typescript
 * const confidence = calculateAggregatedConfidence([
 *   { confidence: 95, ... },  // Explicit evidence
 *   { confidence: 70, ... },  // Inferred evidence
 * ]);
 * // Returns ~88 (weighted toward higher confidence)
 * ```
 */
export function calculateAggregatedConfidence(
  evidence: readonly TgEdgeEvidence[]
): number {
  if (evidence.length === 0) {
    return 0;
  }

  // Sort by confidence descending
  const sorted = [...evidence].sort((a, b) => b.confidence - a.confidence);

  // Use weighted average with diminishing returns
  let totalWeight = 0;
  let weightedSum = 0;

  sorted.forEach((e, index) => {
    // Weight decreases for each subsequent evidence item
    // First item gets weight 1, second gets 0.5, third gets 0.33, etc.
    const weight = 1 / (index + 1);
    weightedSum += e.confidence * weight;
    totalWeight += weight;
  });

  // Calculate weighted average, capped at 100
  return Math.min(100, Math.round(weightedSum / totalWeight));
}

// ============================================================================
// Evidence Builder
// ============================================================================

/**
 * Builder for creating TgEdgeEvidence instances.
 * Provides a fluent API for evidence construction.
 *
 * @example
 * ```typescript
 * const evidence = new TgEvidenceBuilder()
 *   .file('env/dev/terragrunt.hcl')
 *   .lines(1, 5)
 *   .snippet('include "root" { ... }')
 *   .confidence(95)
 *   .explicit()
 *   .description('Include block with label "root"')
 *   .build();
 * ```
 */
export class TgEvidenceBuilder {
  private _file: string = '';
  private _lineStart: number = 1;
  private _lineEnd: number = 1;
  private _snippet: string = '';
  private _confidence: number = 0;
  private _evidenceType: 'explicit' | 'inferred' | 'heuristic' = 'explicit';
  private _description: string = '';

  /**
   * Set the file path for the evidence.
   */
  file(path: string): this {
    this._file = path;
    return this;
  }

  /**
   * Set the line range for the evidence.
   */
  lines(start: number, end: number): this {
    this._lineStart = start;
    this._lineEnd = end;
    return this;
  }

  /**
   * Set a single line for the evidence.
   */
  line(lineNumber: number): this {
    this._lineStart = lineNumber;
    this._lineEnd = lineNumber;
    return this;
  }

  /**
   * Set the code snippet for the evidence.
   */
  snippet(code: string): this {
    this._snippet = code;
    return this;
  }

  /**
   * Set the confidence score (0-100).
   */
  confidence(score: number): this {
    this._confidence = Math.max(0, Math.min(100, score));
    return this;
  }

  /**
   * Mark evidence as explicit (from direct syntax).
   */
  explicit(): this {
    this._evidenceType = 'explicit';
    return this;
  }

  /**
   * Mark evidence as inferred (from semantic analysis).
   */
  inferred(): this {
    this._evidenceType = 'inferred';
    return this;
  }

  /**
   * Mark evidence as heuristic (from pattern matching).
   */
  heuristic(): this {
    this._evidenceType = 'heuristic';
    return this;
  }

  /**
   * Set the evidence type directly.
   */
  type(evidenceType: 'explicit' | 'inferred' | 'heuristic'): this {
    this._evidenceType = evidenceType;
    return this;
  }

  /**
   * Set the human-readable description.
   */
  description(desc: string): this {
    this._description = desc;
    return this;
  }

  /**
   * Build the evidence instance.
   * @throws {Error} If required fields are missing
   */
  build(): TgEdgeEvidence {
    const evidence: TgEdgeEvidence = {
      file: this._file,
      lineStart: this._lineStart,
      lineEnd: this._lineEnd,
      snippet: this._snippet,
      confidence: this._confidence,
      evidenceType: this._evidenceType,
      description: this._description,
    };

    // Validate the built evidence
    validateTgEdgeEvidence(evidence, 'Built evidence');

    return evidence;
  }

  /**
   * Build without validation (for testing or partial evidence).
   */
  buildUnsafe(): TgEdgeEvidence {
    return {
      file: this._file,
      lineStart: this._lineStart,
      lineEnd: this._lineEnd,
      snippet: this._snippet,
      confidence: this._confidence,
      evidenceType: this._evidenceType,
      description: this._description,
    };
  }
}

/**
 * Create a new evidence builder instance.
 *
 * @returns A new TgEvidenceBuilder
 *
 * @example
 * ```typescript
 * const evidence = createEvidenceBuilder()
 *   .file('terragrunt.hcl')
 *   .lines(1, 3)
 *   .confidence(90)
 *   .explicit()
 *   .description('Found include block')
 *   .build();
 * ```
 */
export function createEvidenceBuilder(): TgEvidenceBuilder {
  return new TgEvidenceBuilder();
}

/**
 * Create evidence from a simple object, applying defaults.
 *
 * @param partial - Partial evidence with at least file and description
 * @returns Complete TgEdgeEvidence
 *
 * @example
 * ```typescript
 * const evidence = createEvidence({
 *   file: 'terragrunt.hcl',
 *   lineStart: 1,
 *   lineEnd: 5,
 *   description: 'Include block',
 *   confidence: 95,
 * });
 * ```
 */
export function createEvidence(
  partial: Partial<TgEdgeEvidence> & Pick<TgEdgeEvidence, 'file' | 'description'>
): TgEdgeEvidence {
  const evidence: TgEdgeEvidence = {
    file: partial.file,
    lineStart: partial.lineStart ?? 1,
    lineEnd: partial.lineEnd ?? partial.lineStart ?? 1,
    snippet: partial.snippet ?? '',
    confidence: partial.confidence ?? 50,
    evidenceType: partial.evidenceType ?? 'explicit',
    description: partial.description,
  };

  return evidence;
}
