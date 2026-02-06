/**
 * Tag Matcher Strategy
 * @module services/rollup/matchers/tag-matcher
 *
 * Matches nodes across repositories by tag key-value pairs.
 * Supports matching all tags or any tag, with optional value patterns.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation Tag matching strategy
 */

import {
  MatchingStrategy,
  TagMatcherConfig,
  isTagMatcherConfig,
  MatcherConfig,
} from '../../../types/rollup.js';
import { NodeType, TerraformResourceNode } from '../../../types/graph.js';
import { ValidationError, ValidationWarning, MatchCandidate } from '../interfaces.js';
import { BaseMatcher } from './base-matcher.js';

/**
 * Extracted tag information from a node
 */
interface ExtractedTags {
  /** Raw tags as key-value pairs */
  readonly tags: Record<string, string>;
  /** Whether tags were found */
  readonly hasTags: boolean;
}

/**
 * Tag match result for a single required tag
 */
interface TagMatchResult {
  /** Tag key */
  readonly key: string;
  /** Whether the tag matched */
  readonly matched: boolean;
  /** The matched value */
  readonly value: string | null;
  /** Expected value or pattern */
  readonly expected: string | null;
}

/**
 * Matcher that identifies resources by tag key-value pairs.
 * Tags are commonly used to categorize and identify cloud resources.
 */
export class TagMatcher extends BaseMatcher {
  readonly strategy: MatchingStrategy = 'tag';

  private readonly tagConfig: TagMatcherConfig;
  private readonly ignoredTagsSet: Set<string>;
  private readonly valuePatterns: Map<string, RegExp>;

  /**
   * Create a new TagMatcher
   * @param config - Tag matcher configuration
   */
  constructor(config: MatcherConfig) {
    super(config);

    if (!isTagMatcherConfig(config)) {
      throw new Error('Invalid configuration: expected TagMatcherConfig');
    }

    this.tagConfig = config;
    this.ignoredTagsSet = new Set(config.ignoreTags?.map((t) => t.toLowerCase()) ?? []);
    this.valuePatterns = this.compileValuePatterns(config.requiredTags);
  }

  /**
   * Check if this matcher can handle the given node.
   * Only handles nodes that can have tags.
   */
  protected canHandleNode(node: NodeType): boolean {
    // Only Terraform resources commonly have tags
    if (node.type !== 'terraform_resource') {
      return false;
    }

    // Must have tags
    const { hasTags, tags } = this.extractTags(node);
    if (!hasTags) {
      return false;
    }

    // Must have at least one matching required tag
    return this.hasRequiredTags(tags);
  }

  /**
   * Extract the match key from a node.
   * Match key is a sorted, normalized string of matching tag values.
   */
  protected extractMatchKey(node: NodeType): string | null {
    const { tags } = this.extractTags(node);

    // Build match key from required tags
    const matchingValues: string[] = [];

    for (const requiredTag of this.tagConfig.requiredTags) {
      const tagValue = this.getTagValue(tags, requiredTag.key);
      if (tagValue === null) {
        // Tag not found - if matchMode is 'all', return null
        if (this.tagConfig.matchMode === 'all') {
          return null;
        }
        continue;
      }

      // Check value match
      if (requiredTag.value !== undefined) {
        if (tagValue !== requiredTag.value) {
          if (this.tagConfig.matchMode === 'all') {
            return null;
          }
          continue;
        }
      } else if (requiredTag.valuePattern !== undefined) {
        const pattern = this.valuePatterns.get(requiredTag.key);
        if (pattern && !pattern.test(tagValue)) {
          if (this.tagConfig.matchMode === 'all') {
            return null;
          }
          continue;
        }
      }

      matchingValues.push(`${requiredTag.key}=${tagValue}`);
    }

    // Must have at least one matching value
    if (matchingValues.length === 0) {
      return null;
    }

    // Sort for consistent key generation
    return matchingValues.sort().join('|');
  }

  /**
   * Get the name of the matched attribute.
   */
  protected getMatchedAttributeName(): string {
    const tagKeys = this.tagConfig.requiredTags.map((t) => t.key);
    return `tags[${tagKeys.join(',')}]`;
  }

  /**
   * Validate Tag-specific configuration.
   */
  protected validateStrategyConfig(): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate requiredTags
    if (!this.tagConfig.requiredTags || this.tagConfig.requiredTags.length === 0) {
      errors.push({
        code: 'NO_REQUIRED_TAGS',
        message: 'At least one required tag must be specified',
        path: 'requiredTags',
      });
    } else {
      // Validate each required tag
      this.tagConfig.requiredTags.forEach((tag, index) => {
        // Key is required
        if (!tag.key || tag.key.trim().length === 0) {
          errors.push({
            code: 'EMPTY_TAG_KEY',
            message: 'Tag key cannot be empty',
            path: `requiredTags[${index}].key`,
          });
        }

        // Validate value pattern if provided
        if (tag.valuePattern) {
          try {
            new RegExp(tag.valuePattern);
          } catch {
            errors.push({
              code: 'INVALID_TAG_VALUE_PATTERN',
              message: 'Tag value pattern is not a valid regular expression',
              path: `requiredTags[${index}].valuePattern`,
              value: tag.valuePattern,
            });
          }
        }

        // Can't have both value and valuePattern
        if (tag.value !== undefined && tag.valuePattern !== undefined) {
          warnings.push({
            code: 'REDUNDANT_TAG_VALUE',
            message: 'Both value and valuePattern specified; value takes precedence',
            path: `requiredTags[${index}]`,
            suggestion: 'Remove either value or valuePattern',
          });
        }
      });

      // Check for duplicate tag keys
      const tagKeys = this.tagConfig.requiredTags.map((t) => t.key.toLowerCase());
      const uniqueKeys = new Set(tagKeys);
      if (uniqueKeys.size !== tagKeys.length) {
        warnings.push({
          code: 'DUPLICATE_TAG_KEYS',
          message: 'Duplicate tag keys in requiredTags',
          path: 'requiredTags',
          suggestion: 'Remove duplicate tag definitions',
        });
      }
    }

    // Warn about 'any' match mode with multiple tags
    if (
      this.tagConfig.matchMode === 'any' &&
      this.tagConfig.requiredTags.length > 5
    ) {
      warnings.push({
        code: 'MANY_TAGS_ANY_MODE',
        message: 'Many tags with "any" match mode may produce many false positives',
        path: 'matchMode',
        suggestion: 'Consider using "all" match mode or reducing the number of tags',
      });
    }

    return { errors, warnings };
  }

  /**
   * Check if two nodes are compatible for tag matching.
   */
  protected areNodesCompatible(node1: NodeType, node2: NodeType): boolean {
    // Both must be terraform resources for tag matching
    return node1.type === 'terraform_resource' && node2.type === 'terraform_resource';
  }

  /**
   * Calculate confidence for tag matches.
   * Higher confidence for more matching tags.
   */
  protected calculateConfidence(
    key1: string,
    key2: string,
    attrs1: Record<string, unknown>,
    attrs2: Record<string, unknown>
  ): number {
    // Parse the match keys to compare individual tags
    const tags1 = this.parseMatchKey(key1);
    const tags2 = this.parseMatchKey(key2);

    if (!tags1 || !tags2) {
      return 0;
    }

    // Count matching tags
    let matchingTags = 0;
    const totalTags = new Set([...Object.keys(tags1), ...Object.keys(tags2)]).size;

    for (const [key, value] of Object.entries(tags1)) {
      if (tags2[key] === value) {
        matchingTags++;
      }
    }

    // No matches
    if (matchingTags === 0) {
      return 0;
    }

    // Calculate base confidence from tag matches
    const baseConfidence = (matchingTags / totalTags) * 100;

    // Bonus for same resource type
    if (attrs1['resourceType'] === attrs2['resourceType']) {
      return Math.min(100, baseConfidence + 5);
    }

    return Math.round(baseConfidence);
  }

  /**
   * Extract additional attributes for matching context.
   */
  protected extractAttributes(node: NodeType): Record<string, unknown> {
    const baseAttrs = super.extractAttributes(node);
    const { tags } = this.extractTags(node);

    if (node.type === 'terraform_resource') {
      const resourceNode = node as TerraformResourceNode;
      return {
        ...baseAttrs,
        resourceType: resourceNode.resourceType,
        provider: resourceNode.provider,
        tagCount: Object.keys(tags).length,
      };
    }

    return {
      ...baseAttrs,
      tagCount: Object.keys(tags).length,
    };
  }

  /**
   * Build additional context for tag matches.
   */
  protected buildMatchContext(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): Record<string, unknown> {
    const tags1 = this.parseMatchKey(candidate1.matchKey);
    const tags2 = this.parseMatchKey(candidate2.matchKey);

    return {
      ...super.buildMatchContext(candidate1, candidate2),
      sourceTags: tags1 ?? {},
      targetTags: tags2 ?? {},
      matchMode: this.tagConfig.matchMode ?? 'all',
      requiredTagKeys: this.tagConfig.requiredTags.map((t) => t.key),
    };
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Extract tags from a node.
   */
  private extractTags(node: NodeType): ExtractedTags {
    const tags: Record<string, string> = {};

    // Try different tag locations in metadata
    const tagLocations = ['tags', 'tag', 'labels', 'metadata.labels'];

    for (const location of tagLocations) {
      const tagData = this.getNestedValue(node.metadata, location);
      if (tagData && typeof tagData === 'object') {
        Object.entries(tagData as Record<string, unknown>).forEach(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'number') {
            // Skip ignored tags
            if (!this.ignoredTagsSet.has(key.toLowerCase())) {
              tags[key] = String(value);
            }
          }
        });
      }
    }

    return {
      tags,
      hasTags: Object.keys(tags).length > 0,
    };
  }

  /**
   * Get a tag value by key (case-insensitive).
   */
  private getTagValue(tags: Record<string, string>, key: string): string | null {
    // Exact match first
    if (key in tags) {
      return tags[key];
    }

    // Case-insensitive match
    const lowerKey = key.toLowerCase();
    for (const [tagKey, tagValue] of Object.entries(tags)) {
      if (tagKey.toLowerCase() === lowerKey) {
        return tagValue;
      }
    }

    return null;
  }

  /**
   * Check if tags contain the required tags.
   */
  private hasRequiredTags(tags: Record<string, string>): boolean {
    const matchMode = this.tagConfig.matchMode ?? 'all';

    for (const requiredTag of this.tagConfig.requiredTags) {
      const tagValue = this.getTagValue(tags, requiredTag.key);

      if (tagValue !== null) {
        // Check value match if specified
        if (requiredTag.value !== undefined && tagValue !== requiredTag.value) {
          continue;
        }
        if (requiredTag.valuePattern !== undefined) {
          const pattern = this.valuePatterns.get(requiredTag.key);
          if (pattern && !pattern.test(tagValue)) {
            continue;
          }
        }

        // Found a matching tag
        if (matchMode === 'any') {
          return true;
        }
      } else if (matchMode === 'all') {
        return false;
      }
    }

    // For 'all' mode, reaching here means all tags matched
    // For 'any' mode, reaching here means no tags matched
    return matchMode === 'all';
  }

  /**
   * Compile value patterns from required tags.
   */
  private compileValuePatterns(
    requiredTags: TagMatcherConfig['requiredTags']
  ): Map<string, RegExp> {
    const patterns = new Map<string, RegExp>();

    for (const tag of requiredTags) {
      if (tag.valuePattern) {
        try {
          patterns.set(tag.key, new RegExp(tag.valuePattern));
        } catch {
          // Invalid pattern - will be caught during validation
        }
      }
    }

    return patterns;
  }

  /**
   * Parse a match key back into tag key-value pairs.
   */
  private parseMatchKey(key: string): Record<string, string> | null {
    if (!key) {
      return null;
    }

    const tags: Record<string, string> = {};
    const pairs = key.split('|');

    for (const pair of pairs) {
      const equalsIndex = pair.indexOf('=');
      if (equalsIndex > 0) {
        const tagKey = pair.substring(0, equalsIndex);
        const tagValue = pair.substring(equalsIndex + 1);
        tags[tagKey] = tagValue;
      }
    }

    return Object.keys(tags).length > 0 ? tags : null;
  }
}
