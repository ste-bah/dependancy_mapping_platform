/**
 * Base Matcher Abstract Class
 * @module services/rollup/matchers/base-matcher
 *
 * Abstract base class for all matching strategies in the Cross-Repository Aggregation system.
 * Implements the Strategy pattern for flexible node matching across repositories.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation matching strategies
 */

import {
  MatchingStrategy,
  MatchResult,
  MatcherConfig,
} from '../../../types/rollup.js';
import { NodeType } from '../../../types/graph.js';
import { RepositoryId, ScanId } from '../../../types/entities.js';
import {
  IMatcher,
  MatchCandidate,
  ConfigurationValidationResult,
  ValidationError,
  ValidationWarning,
} from '../interfaces.js';

/**
 * Abstract base class for all matcher implementations.
 * Provides common functionality for extracting candidates and validating configurations.
 */
export abstract class BaseMatcher implements IMatcher {
  /**
   * The matching strategy type identifier
   */
  abstract readonly strategy: MatchingStrategy;

  /**
   * The matcher configuration
   */
  public readonly config: MatcherConfig;

  /**
   * Create a new BaseMatcher instance
   * @param config - The matcher configuration
   */
  constructor(config: MatcherConfig) {
    this.config = config;
  }

  /**
   * Extract match candidates from a collection of nodes.
   * Filters nodes based on configuration and extracts match keys.
   *
   * @param nodes - Nodes to process
   * @param repositoryId - Repository these nodes belong to
   * @param scanId - Scan these nodes came from
   * @returns Array of match candidates
   */
  extractCandidates(
    nodes: NodeType[],
    repositoryId: RepositoryId,
    scanId: ScanId
  ): MatchCandidate[] {
    const candidates: MatchCandidate[] = [];

    for (const node of nodes) {
      // Check if this matcher can handle the node
      if (!this.canHandleNode(node)) {
        continue;
      }

      // Extract the match key for this node
      const matchKey = this.extractMatchKey(node);
      if (matchKey === null) {
        continue;
      }

      // Extract additional attributes for matching context
      const attributes = this.extractAttributes(node);

      candidates.push({
        node,
        repositoryId,
        scanId,
        matchKey,
        attributes,
      });
    }

    return candidates;
  }

  /**
   * Compare two candidates and determine if they match.
   * Returns a match result if they match, null otherwise.
   *
   * @param candidate1 - First candidate
   * @param candidate2 - Second candidate
   * @returns Match result or null if no match
   */
  compare(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): MatchResult | null {
    // Skip if from same repository
    if (candidate1.repositoryId === candidate2.repositoryId) {
      return null;
    }

    // Check if nodes are compatible for matching
    if (!this.areNodesCompatible(candidate1.node, candidate2.node)) {
      return null;
    }

    // Calculate match confidence
    const confidence = this.calculateConfidence(
      candidate1.matchKey,
      candidate2.matchKey,
      candidate1.attributes,
      candidate2.attributes
    );

    // Check against minimum confidence threshold
    if (confidence < this.config.minConfidence) {
      return null;
    }

    // Build the match result
    return {
      sourceNodeId: candidate1.node.id,
      targetNodeId: candidate2.node.id,
      sourceRepoId: candidate1.repositoryId,
      targetRepoId: candidate2.repositoryId,
      strategy: this.strategy,
      confidence,
      details: {
        matchedAttribute: this.getMatchedAttributeName(),
        sourceValue: candidate1.matchKey,
        targetValue: candidate2.matchKey,
        context: this.buildMatchContext(candidate1, candidate2),
      },
    };
  }

  /**
   * Validate the matcher configuration.
   * Subclasses should override to add strategy-specific validation.
   *
   * @returns Validation result with errors and warnings
   */
  validateConfig(): ConfigurationValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate base configuration
    if (this.config.priority < 0 || this.config.priority > 100) {
      errors.push({
        code: 'INVALID_PRIORITY',
        message: 'Priority must be between 0 and 100',
        path: 'priority',
        value: this.config.priority,
      });
    }

    if (this.config.minConfidence < 0 || this.config.minConfidence > 100) {
      errors.push({
        code: 'INVALID_MIN_CONFIDENCE',
        message: 'Minimum confidence must be between 0 and 100',
        path: 'minConfidence',
        value: this.config.minConfidence,
      });
    }

    // Low confidence threshold warning
    if (this.config.minConfidence < 50) {
      warnings.push({
        code: 'LOW_MIN_CONFIDENCE',
        message: 'Low minimum confidence may result in false positive matches',
        path: 'minConfidence',
        suggestion: 'Consider setting minConfidence to at least 50',
      });
    }

    // Add strategy-specific validation
    const strategyValidation = this.validateStrategyConfig();
    errors.push(...strategyValidation.errors);
    warnings.push(...strategyValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // Abstract methods to be implemented by subclasses
  // ============================================================================

  /**
   * Check if this matcher can handle the given node type.
   * @param node - Node to check
   * @returns True if this matcher can process the node
   */
  protected abstract canHandleNode(node: NodeType): boolean;

  /**
   * Extract the match key from a node.
   * The match key is used to identify potential matches.
   *
   * @param node - Node to extract key from
   * @returns Match key string or null if extraction fails
   */
  protected abstract extractMatchKey(node: NodeType): string | null;

  /**
   * Get the name of the attribute being matched.
   * Used for match result details.
   */
  protected abstract getMatchedAttributeName(): string;

  /**
   * Perform strategy-specific configuration validation.
   */
  protected abstract validateStrategyConfig(): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };

  // ============================================================================
  // Protected helper methods
  // ============================================================================

  /**
   * Extract additional attributes from a node for matching context.
   * Subclasses can override to add strategy-specific attributes.
   *
   * @param node - Node to extract attributes from
   * @returns Record of attribute name to value
   */
  protected extractAttributes(node: NodeType): Record<string, unknown> {
    return {
      nodeType: node.type,
      nodeName: node.name,
      file: node.location.file,
    };
  }

  /**
   * Check if two nodes are compatible for matching.
   * Default implementation checks if node types are the same.
   *
   * @param node1 - First node
   * @param node2 - Second node
   * @returns True if nodes can be matched
   */
  protected areNodesCompatible(node1: NodeType, node2: NodeType): boolean {
    // By default, only match nodes of the same type
    return node1.type === node2.type;
  }

  /**
   * Calculate the confidence score for a match.
   * Default implementation uses exact match (100) or no match (0).
   *
   * @param key1 - First match key
   * @param key2 - Second match key
   * @param attrs1 - First candidate attributes
   * @param attrs2 - Second candidate attributes
   * @returns Confidence score 0-100
   */
  protected calculateConfidence(
    key1: string,
    key2: string,
    _attrs1: Record<string, unknown>,
    _attrs2: Record<string, unknown>
  ): number {
    // Default: exact match gives 100, otherwise 0
    return key1 === key2 ? 100 : 0;
  }

  /**
   * Build additional context for the match result.
   * Subclasses can override to add strategy-specific context.
   *
   * @param candidate1 - First candidate
   * @param candidate2 - Second candidate
   * @returns Context record
   */
  protected buildMatchContext(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): Record<string, unknown> {
    return {
      sourceNodeType: candidate1.node.type,
      targetNodeType: candidate2.node.type,
      sourceFile: candidate1.node.location.file,
      targetFile: candidate2.node.location.file,
    };
  }

  /**
   * Normalize a string value for comparison.
   * Trims whitespace and optionally converts to lowercase.
   *
   * @param value - Value to normalize
   * @param toLowerCase - Whether to convert to lowercase
   * @returns Normalized string
   */
  protected normalizeValue(value: string, toLowerCase = true): string {
    const trimmed = value.trim();
    return toLowerCase ? trimmed.toLowerCase() : trimmed;
  }

  /**
   * Get a nested value from an object using dot notation path.
   *
   * @param obj - Object to extract from
   * @param path - Dot notation path (e.g., 'metadata.id')
   * @returns Extracted value or undefined
   */
  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Check if the matcher is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the matcher priority.
   */
  getPriority(): number {
    return this.config.priority;
  }
}
