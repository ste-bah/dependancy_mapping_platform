/**
 * Name Matcher Strategy
 * @module services/rollup/matchers/name-matcher
 *
 * Matches nodes across repositories by resource name.
 * Supports exact matching, fuzzy matching using Levenshtein distance,
 * and configurable normalization options.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation Name matching strategy
 */

import {
  MatchingStrategy,
  NameMatcherConfig,
  isNameMatcherConfig,
  MatcherConfig,
} from '../../../types/rollup.js';
import { NodeType } from '../../../types/graph.js';
import { ValidationError, ValidationWarning, MatchCandidate } from '../interfaces.js';
import { BaseMatcher } from './base-matcher.js';

/**
 * Matcher that identifies resources by name with optional namespace.
 * Supports fuzzy matching for handling minor naming variations.
 */
export class NameMatcher extends BaseMatcher {
  readonly strategy: MatchingStrategy = 'name';

  private readonly nameConfig: NameMatcherConfig;
  private readonly namePattern: RegExp | null;
  private readonly namespacePattern: RegExp | null;

  /**
   * Create a new NameMatcher
   * @param config - Name matcher configuration
   */
  constructor(config: MatcherConfig) {
    super(config);

    if (!isNameMatcherConfig(config)) {
      throw new Error('Invalid configuration: expected NameMatcherConfig');
    }

    this.nameConfig = config;
    this.namePattern = config.pattern ? this.compilePattern(config.pattern) : null;
    this.namespacePattern = config.namespacePattern
      ? this.compilePattern(config.namespacePattern)
      : null;
  }

  /**
   * Check if this matcher can handle the given node.
   * Name matcher can handle most node types.
   */
  protected canHandleNode(node: NodeType): boolean {
    // Must have a name
    if (!node.name || node.name.trim().length === 0) {
      return false;
    }

    // Check name pattern if configured
    if (this.namePattern && !this.namePattern.test(node.name)) {
      return false;
    }

    // Check namespace pattern for K8s resources
    if (this.namespacePattern && this.nameConfig.includeNamespace) {
      const namespace = this.extractNamespace(node);
      if (namespace && !this.namespacePattern.test(namespace)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract the match key from a node (name with optional namespace).
   */
  protected extractMatchKey(node: NodeType): string | null {
    let key = node.name;

    // Apply case sensitivity
    if (!this.nameConfig.caseSensitive) {
      key = key.toLowerCase();
    }

    // Include namespace if configured
    if (this.nameConfig.includeNamespace) {
      const namespace = this.extractNamespace(node);
      if (namespace) {
        key = `${namespace}/${key}`;
      }
    }

    return key;
  }

  /**
   * Get the name of the matched attribute.
   */
  protected getMatchedAttributeName(): string {
    return this.nameConfig.includeNamespace ? 'namespace/name' : 'name';
  }

  /**
   * Validate Name-specific configuration.
   */
  protected validateStrategyConfig(): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate pattern if provided
    if (this.nameConfig.pattern) {
      try {
        new RegExp(this.nameConfig.pattern);
      } catch {
        errors.push({
          code: 'INVALID_NAME_PATTERN',
          message: 'Name pattern is not a valid regular expression',
          path: 'pattern',
          value: this.nameConfig.pattern,
        });
      }
    }

    // Validate namespace pattern if provided
    if (this.nameConfig.namespacePattern) {
      try {
        new RegExp(this.nameConfig.namespacePattern);
      } catch {
        errors.push({
          code: 'INVALID_NAMESPACE_PATTERN',
          message: 'Namespace pattern is not a valid regular expression',
          path: 'namespacePattern',
          value: this.nameConfig.namespacePattern,
        });
      }
    }

    // Validate fuzzy threshold if provided
    if (this.nameConfig.fuzzyThreshold !== undefined) {
      if (this.nameConfig.fuzzyThreshold < 0 || this.nameConfig.fuzzyThreshold > 100) {
        errors.push({
          code: 'INVALID_FUZZY_THRESHOLD',
          message: 'Fuzzy threshold must be between 0 and 100',
          path: 'fuzzyThreshold',
          value: this.nameConfig.fuzzyThreshold,
        });
      }

      // Warn about very low fuzzy threshold
      if (this.nameConfig.fuzzyThreshold < 60) {
        warnings.push({
          code: 'LOW_FUZZY_THRESHOLD',
          message: 'Low fuzzy threshold may result in false positive matches',
          path: 'fuzzyThreshold',
          suggestion: 'Consider setting fuzzyThreshold to at least 60',
        });
      }
    }

    // Warn if no pattern and not case sensitive
    if (!this.nameConfig.pattern && !this.nameConfig.caseSensitive) {
      warnings.push({
        code: 'BROAD_NAME_MATCHING',
        message: 'No pattern and case insensitive may match many resources',
        path: 'pattern',
        suggestion: 'Consider adding a pattern to filter matches',
      });
    }

    return { errors, warnings };
  }

  /**
   * Check if two nodes are compatible for name matching.
   */
  protected areNodesCompatible(node1: NodeType, node2: NodeType): boolean {
    // Same node type is preferred but not required
    // Name matching can work across types in some cases
    return true;
  }

  /**
   * Calculate confidence for name matches.
   * Uses exact matching or Levenshtein distance for fuzzy matching.
   */
  protected calculateConfidence(
    key1: string,
    key2: string,
    attrs1: Record<string, unknown>,
    attrs2: Record<string, unknown>
  ): number {
    // Exact match
    if (key1 === key2) {
      // Higher confidence if same node type
      if (attrs1['nodeType'] === attrs2['nodeType']) {
        return 100;
      }
      return 95;
    }

    // Fuzzy matching if enabled
    if (this.nameConfig.fuzzyThreshold !== undefined) {
      const similarity = this.calculateStringSimilarity(key1, key2);
      const similarityPercent = Math.round(similarity * 100);

      if (similarityPercent >= this.nameConfig.fuzzyThreshold) {
        // Scale confidence based on similarity
        return similarityPercent;
      }
    }

    // No match
    return 0;
  }

  /**
   * Extract additional attributes for matching context.
   */
  protected extractAttributes(node: NodeType): Record<string, unknown> {
    const baseAttrs = super.extractAttributes(node);
    const namespace = this.extractNamespace(node);

    return {
      ...baseAttrs,
      namespace: namespace ?? null,
      originalName: node.name,
    };
  }

  /**
   * Build additional context for name matches.
   */
  protected buildMatchContext(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): Record<string, unknown> {
    const context = super.buildMatchContext(candidate1, candidate2);

    // Add fuzzy matching details if used
    if (this.nameConfig.fuzzyThreshold !== undefined) {
      const similarity = this.calculateStringSimilarity(
        candidate1.matchKey,
        candidate2.matchKey
      );
      return {
        ...context,
        fuzzyMatchUsed: true,
        fuzzyThreshold: this.nameConfig.fuzzyThreshold,
        stringSimilarity: Math.round(similarity * 100),
      };
    }

    return {
      ...context,
      fuzzyMatchUsed: false,
      caseSensitive: this.nameConfig.caseSensitive ?? false,
    };
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Compile a pattern string into a RegExp.
   * Supports wildcards with *.
   */
  private compilePattern(pattern: string): RegExp {
    // Escape special regex characters except *
    let regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Convert wildcards to regex
    regexPattern = regexPattern.replace(/\*/g, '.*');

    const flags = this.nameConfig.caseSensitive ? '' : 'i';
    return new RegExp(`^${regexPattern}$`, flags);
  }

  /**
   * Extract namespace from a node.
   * Works for K8s resources and can be extended for other types.
   */
  private extractNamespace(node: NodeType): string | null {
    // Check for namespace in metadata
    if (typeof node.metadata['namespace'] === 'string') {
      return node.metadata['namespace'];
    }

    // Check node type-specific namespace
    if ('namespace' in node && typeof node.namespace === 'string') {
      return node.namespace;
    }

    // Check for namespace in file path (common K8s convention)
    const fileParts = node.location.file.split('/');
    const namespaceIndex = fileParts.findIndex((p) => p === 'namespaces');
    if (namespaceIndex !== -1 && namespaceIndex < fileParts.length - 1) {
      return fileParts[namespaceIndex + 1];
    }

    return null;
  }

  /**
   * Calculate string similarity using Levenshtein distance.
   * Returns a value between 0 and 1, where 1 is an exact match.
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate the Levenshtein distance between two strings.
   * This is the minimum number of single-character edits required
   * to transform one string into the other.
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create a 2D array to store the distances
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array<number>(n + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Extract base name by removing common prefixes/suffixes.
   * Used for advanced fuzzy matching.
   */
  private extractBaseName(name: string): string {
    let baseName = name;

    // Remove common prefixes
    const prefixes = ['prod-', 'staging-', 'dev-', 'test-', 'my-'];
    for (const prefix of prefixes) {
      if (baseName.toLowerCase().startsWith(prefix)) {
        baseName = baseName.substring(prefix.length);
        break;
      }
    }

    // Remove common suffixes
    const suffixes = ['-prod', '-staging', '-dev', '-test', '-v1', '-v2'];
    for (const suffix of suffixes) {
      if (baseName.toLowerCase().endsWith(suffix)) {
        baseName = baseName.substring(0, baseName.length - suffix.length);
        break;
      }
    }

    return baseName;
  }
}
