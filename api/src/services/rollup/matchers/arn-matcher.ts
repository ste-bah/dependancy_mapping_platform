/**
 * ARN Matcher Strategy
 * @module services/rollup/matchers/arn-matcher
 *
 * Matches nodes across repositories by AWS ARN (Amazon Resource Name) patterns.
 * Supports wildcard patterns and component-level matching.
 *
 * ARN Format: arn:partition:service:region:account-id:resource-type/resource-id
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation ARN matching strategy
 */

import {
  MatchingStrategy,
  ArnMatcherConfig,
  isArnMatcherConfig,
  MatcherConfig,
} from '../../../types/rollup.js';
import { NodeType } from '../../../types/graph.js';
import { ValidationError, ValidationWarning, MatchCandidate } from '../interfaces.js';
import { BaseMatcher } from './base-matcher.js';

/**
 * Parsed ARN structure
 */
interface ParsedArn {
  /** AWS partition (e.g., 'aws', 'aws-cn', 'aws-us-gov') */
  readonly partition: string;
  /** AWS service (e.g., 's3', 'ec2', 'lambda') */
  readonly service: string;
  /** AWS region (e.g., 'us-east-1') */
  readonly region: string;
  /** AWS account ID */
  readonly account: string;
  /** Resource identifier (everything after account) */
  readonly resource: string;
  /** Original ARN string */
  readonly original: string;
}

/**
 * ARN pattern matching result
 */
interface ArnMatchResult {
  /** Whether the ARN matches the pattern */
  readonly matches: boolean;
  /** Match confidence (0-100) */
  readonly confidence: number;
  /** Components that matched */
  readonly matchedComponents: string[];
  /** Extracted values from wildcards */
  readonly extractedValues: Record<string, string>;
}

/**
 * Matcher that identifies resources by AWS ARN patterns.
 * Useful for matching cloud infrastructure resources across repositories.
 */
export class ArnMatcher extends BaseMatcher {
  readonly strategy: MatchingStrategy = 'arn';

  private readonly arnConfig: ArnMatcherConfig;
  private readonly compiledPattern: RegExp;

  /**
   * Create a new ArnMatcher
   * @param config - ARN matcher configuration
   */
  constructor(config: MatcherConfig) {
    super(config);

    if (!isArnMatcherConfig(config)) {
      throw new Error('Invalid configuration: expected ArnMatcherConfig');
    }

    this.arnConfig = config;
    this.compiledPattern = this.compilePattern(config.pattern);
  }

  /**
   * Check if this matcher can handle the given node.
   * ARN matcher works with terraform_resource and terraform_data nodes.
   */
  protected canHandleNode(node: NodeType): boolean {
    // Only handle Terraform resource and data nodes
    return node.type === 'terraform_resource' || node.type === 'terraform_data';
  }

  /**
   * Extract the ARN from a node.
   * Looks for ARN in metadata or computed from resource attributes.
   */
  protected extractMatchKey(node: NodeType): string | null {
    // Try to find ARN in metadata
    const arn = this.findArnInMetadata(node.metadata);
    if (arn) {
      // Check if ARN matches our pattern
      if (this.matchesPattern(arn)) {
        return arn;
      }
      // If allowPartial, try to match partial ARN
      if (this.arnConfig.allowPartial) {
        const partialMatch = this.tryPartialMatch(arn);
        if (partialMatch) {
          return partialMatch;
        }
      }
    }

    return null;
  }

  /**
   * Get the name of the matched attribute.
   */
  protected getMatchedAttributeName(): string {
    return 'arn';
  }

  /**
   * Validate ARN-specific configuration.
   */
  protected validateStrategyConfig(): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate pattern
    if (!this.arnConfig.pattern || this.arnConfig.pattern.trim().length === 0) {
      errors.push({
        code: 'ARN_PATTERN_REQUIRED',
        message: 'ARN pattern is required',
        path: 'pattern',
      });
    } else {
      // Validate pattern format
      const patternValidation = this.validateArnPattern(this.arnConfig.pattern);
      if (!patternValidation.valid) {
        errors.push({
          code: 'INVALID_ARN_PATTERN',
          message: patternValidation.error ?? 'Invalid ARN pattern',
          path: 'pattern',
          value: this.arnConfig.pattern,
        });
      }

      // Warn about overly broad patterns
      if (this.isBroadPattern(this.arnConfig.pattern)) {
        warnings.push({
          code: 'BROAD_ARN_PATTERN',
          message: 'ARN pattern is very broad and may match many resources',
          path: 'pattern',
          suggestion: 'Consider adding more specific service or resource constraints',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Calculate confidence for ARN matches.
   * Higher confidence for more matching components.
   */
  protected calculateConfidence(
    key1: string,
    key2: string,
    _attrs1: Record<string, unknown>,
    _attrs2: Record<string, unknown>
  ): number {
    const arn1 = this.parseArn(key1);
    const arn2 = this.parseArn(key2);

    if (!arn1 || !arn2) {
      return 0;
    }

    // Check which components to compare based on config
    const components = this.arnConfig.components ?? {
      partition: true,
      service: true,
      region: false,
      account: false,
      resource: true,
    };

    let matchingComponents = 0;
    let totalComponents = 0;
    let criticalMatch = true;

    // Partition comparison
    if (components.partition) {
      totalComponents++;
      if (arn1.partition === arn2.partition) {
        matchingComponents++;
      }
    }

    // Service comparison (critical)
    if (components.service) {
      totalComponents++;
      if (arn1.service === arn2.service) {
        matchingComponents++;
      } else {
        criticalMatch = false;
      }
    }

    // Region comparison
    if (components.region) {
      totalComponents++;
      if (arn1.region === arn2.region) {
        matchingComponents++;
      }
    }

    // Account comparison
    if (components.account) {
      totalComponents++;
      if (arn1.account === arn2.account) {
        matchingComponents++;
      }
    }

    // Resource comparison (critical)
    if (components.resource) {
      totalComponents++;
      const resourceMatch = this.compareResources(arn1.resource, arn2.resource);
      if (resourceMatch >= 80) {
        matchingComponents++;
      } else {
        criticalMatch = false;
      }
    }

    // If critical components don't match, return 0
    if (!criticalMatch) {
      return 0;
    }

    // Calculate confidence based on matching components
    const baseConfidence = (matchingComponents / totalComponents) * 100;
    return Math.round(baseConfidence);
  }

  /**
   * Build additional context for ARN matches.
   */
  protected buildMatchContext(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): Record<string, unknown> {
    const arn1 = this.parseArn(candidate1.matchKey);
    const arn2 = this.parseArn(candidate2.matchKey);

    return {
      ...super.buildMatchContext(candidate1, candidate2),
      sourceArn: {
        partition: arn1?.partition,
        service: arn1?.service,
        region: arn1?.region,
        account: arn1?.account,
        resource: arn1?.resource,
      },
      targetArn: {
        partition: arn2?.partition,
        service: arn2?.service,
        region: arn2?.region,
        account: arn2?.account,
        resource: arn2?.resource,
      },
      matchedPattern: this.arnConfig.pattern,
    };
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Find an ARN in node metadata.
   */
  private findArnInMetadata(metadata: Record<string, unknown>): string | null {
    // Direct ARN property
    if (typeof metadata['arn'] === 'string') {
      return metadata['arn'];
    }

    // Nested in attributes
    const attributes = metadata['attributes'] as Record<string, unknown> | undefined;
    if (attributes && typeof attributes['arn'] === 'string') {
      return attributes['arn'];
    }

    // Check for common ARN-containing fields
    const arnFields = ['arn', 'resource_arn', 'target_arn', 'function_arn', 'bucket_arn'];
    for (const field of arnFields) {
      const value = this.getNestedValue(metadata, field);
      if (typeof value === 'string' && value.startsWith('arn:')) {
        return value;
      }
    }

    // Scan all string values for ARN patterns
    const arnPattern = /^arn:[\w-]+:[\w-]+:[\w-]*:[\d]*:.+$/;
    for (const value of Object.values(metadata)) {
      if (typeof value === 'string' && arnPattern.test(value)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Parse an ARN string into its components.
   */
  private parseArn(arn: string): ParsedArn | null {
    if (!arn || !arn.startsWith('arn:')) {
      return null;
    }

    const parts = arn.split(':');
    if (parts.length < 6) {
      return null;
    }

    return {
      partition: parts[1],
      service: parts[2],
      region: parts[3],
      account: parts[4],
      resource: parts.slice(5).join(':'),
      original: arn,
    };
  }

  /**
   * Compile an ARN pattern into a RegExp.
   */
  private compilePattern(pattern: string): RegExp {
    // Escape special regex characters except *
    let regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Convert wildcards to regex
    regexPattern = regexPattern.replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Check if an ARN matches the configured pattern.
   */
  private matchesPattern(arn: string): boolean {
    return this.compiledPattern.test(arn);
  }

  /**
   * Try to match a partial ARN (for allowPartial mode).
   */
  private tryPartialMatch(arn: string): string | null {
    const parsed = this.parseArn(arn);
    if (!parsed) {
      return null;
    }

    // Check if service matches
    const patternParts = this.arnConfig.pattern.split(':');
    if (patternParts.length >= 3) {
      const patternService = patternParts[2];
      if (patternService !== '*' && parsed.service !== patternService) {
        return null;
      }
    }

    return arn;
  }

  /**
   * Validate ARN pattern format.
   */
  private validateArnPattern(pattern: string): { valid: boolean; error?: string } {
    // Must start with 'arn:'
    if (!pattern.startsWith('arn:')) {
      return { valid: false, error: 'ARN pattern must start with "arn:"' };
    }

    // Check basic structure
    const parts = pattern.split(':');
    if (parts.length < 6) {
      return {
        valid: false,
        error: 'ARN pattern must have at least 6 colon-separated components',
      };
    }

    // Validate partition (part 1)
    const validPartitions = ['aws', 'aws-cn', 'aws-us-gov', '*'];
    if (!validPartitions.includes(parts[1]) && !parts[1].includes('*')) {
      return {
        valid: false,
        error: `Invalid partition: ${parts[1]}. Must be one of: ${validPartitions.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Check if a pattern is overly broad.
   */
  private isBroadPattern(pattern: string): boolean {
    const parts = pattern.split(':');

    // Count wildcards
    let wildcardCount = 0;
    for (const part of parts) {
      if (part === '*' || part.includes('*')) {
        wildcardCount++;
      }
    }

    // Pattern is broad if more than 3 wildcards or service is wildcard
    return wildcardCount > 3 || parts[2] === '*';
  }

  /**
   * Compare two resource identifiers.
   * Returns a similarity score 0-100.
   */
  private compareResources(resource1: string, resource2: string): number {
    // Exact match
    if (resource1 === resource2) {
      return 100;
    }

    // Extract resource type and name
    const type1 = this.extractResourceType(resource1);
    const type2 = this.extractResourceType(resource2);

    // Types must match
    if (type1 !== type2) {
      return 0;
    }

    // Extract resource names
    const name1 = this.extractResourceName(resource1);
    const name2 = this.extractResourceName(resource2);

    // Names must match
    if (name1 === name2) {
      return 100;
    }

    // No match
    return 0;
  }

  /**
   * Extract resource type from resource string.
   * e.g., "bucket/my-bucket" -> "bucket"
   */
  private extractResourceType(resource: string): string {
    const slashIndex = resource.indexOf('/');
    if (slashIndex > 0) {
      return resource.substring(0, slashIndex);
    }
    const colonIndex = resource.indexOf(':');
    if (colonIndex > 0) {
      return resource.substring(0, colonIndex);
    }
    return resource;
  }

  /**
   * Extract resource name from resource string.
   * e.g., "bucket/my-bucket" -> "my-bucket"
   */
  private extractResourceName(resource: string): string {
    const slashIndex = resource.indexOf('/');
    if (slashIndex > 0) {
      return resource.substring(slashIndex + 1);
    }
    const colonIndex = resource.indexOf(':');
    if (colonIndex > 0) {
      return resource.substring(colonIndex + 1);
    }
    return resource;
  }
}
