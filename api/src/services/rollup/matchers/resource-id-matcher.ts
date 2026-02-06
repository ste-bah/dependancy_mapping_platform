/**
 * Resource ID Matcher Strategy
 * @module services/rollup/matchers/resource-id-matcher
 *
 * Matches nodes across repositories by resource identifier.
 * Supports configurable ID extraction paths and normalization options.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation Resource ID matching strategy
 */

import {
  MatchingStrategy,
  ResourceIdMatcherConfig,
  isResourceIdMatcherConfig,
  MatcherConfig,
} from '../../../types/rollup.js';
import { NodeType, TerraformResourceNode } from '../../../types/graph.js';
import { ValidationError, ValidationWarning, MatchCandidate } from '../interfaces.js';
import { BaseMatcher } from './base-matcher.js';

/**
 * Matcher that identifies resources by their unique identifier.
 * Useful for matching resources that have stable IDs across repositories.
 */
export class ResourceIdMatcher extends BaseMatcher {
  readonly strategy: MatchingStrategy = 'resource_id';

  private readonly idConfig: ResourceIdMatcherConfig;
  private readonly extractionRegex: RegExp | null;

  /**
   * Create a new ResourceIdMatcher
   * @param config - Resource ID matcher configuration
   */
  constructor(config: MatcherConfig) {
    super(config);

    if (!isResourceIdMatcherConfig(config)) {
      throw new Error('Invalid configuration: expected ResourceIdMatcherConfig');
    }

    this.idConfig = config;
    this.extractionRegex = config.extractionPattern
      ? new RegExp(config.extractionPattern)
      : null;
  }

  /**
   * Check if this matcher can handle the given node.
   * Only handles nodes of the configured resource type.
   */
  protected canHandleNode(node: NodeType): boolean {
    // Must be a terraform resource
    if (node.type !== 'terraform_resource') {
      return false;
    }

    // Check resource type matches
    const resourceNode = node as TerraformResourceNode;
    return this.matchesResourceType(resourceNode.resourceType);
  }

  /**
   * Extract the resource ID from a node.
   */
  protected extractMatchKey(node: NodeType): string | null {
    // Get the ID value using configured path
    const idPath = this.idConfig.idAttribute || 'id';
    let idValue = this.getIdValue(node, idPath);

    if (idValue === null) {
      return null;
    }

    // Apply extraction pattern if configured
    if (this.extractionRegex) {
      idValue = this.applyExtractionPattern(idValue);
      if (idValue === null) {
        return null;
      }
    }

    // Normalize if configured
    if (this.idConfig.normalize) {
      idValue = this.normalizeId(idValue);
    }

    // Validate the extracted ID
    if (!this.isValidId(idValue)) {
      return null;
    }

    return idValue;
  }

  /**
   * Get the name of the matched attribute.
   */
  protected getMatchedAttributeName(): string {
    return this.idConfig.idAttribute || 'id';
  }

  /**
   * Validate Resource ID-specific configuration.
   */
  protected validateStrategyConfig(): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate resourceType
    if (!this.idConfig.resourceType || this.idConfig.resourceType.trim().length === 0) {
      errors.push({
        code: 'RESOURCE_TYPE_REQUIRED',
        message: 'Resource type is required for resource_id matching',
        path: 'resourceType',
      });
    }

    // Validate extractionPattern if provided
    if (this.idConfig.extractionPattern) {
      try {
        new RegExp(this.idConfig.extractionPattern);
      } catch {
        errors.push({
          code: 'INVALID_EXTRACTION_PATTERN',
          message: 'Extraction pattern is not a valid regular expression',
          path: 'extractionPattern',
          value: this.idConfig.extractionPattern,
        });
      }
    }

    // Validate idAttribute path
    if (this.idConfig.idAttribute) {
      const validPathPattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
      if (!validPathPattern.test(this.idConfig.idAttribute)) {
        errors.push({
          code: 'INVALID_ID_ATTRIBUTE',
          message: 'ID attribute path contains invalid characters',
          path: 'idAttribute',
          value: this.idConfig.idAttribute,
        });
      }
    }

    // Warn about broad resource type patterns
    if (this.idConfig.resourceType.includes('*')) {
      warnings.push({
        code: 'BROAD_RESOURCE_TYPE',
        message: 'Resource type contains wildcards which may match many resource types',
        path: 'resourceType',
        suggestion: 'Consider using a more specific resource type',
      });
    }

    return { errors, warnings };
  }

  /**
   * Check if two nodes are compatible for matching.
   * For resource ID matching, both must be the same resource type.
   */
  protected areNodesCompatible(node1: NodeType, node2: NodeType): boolean {
    if (node1.type !== 'terraform_resource' || node2.type !== 'terraform_resource') {
      return false;
    }

    const resource1 = node1 as TerraformResourceNode;
    const resource2 = node2 as TerraformResourceNode;

    // Resource types must match
    return resource1.resourceType === resource2.resourceType;
  }

  /**
   * Calculate confidence for resource ID matches.
   * Exact ID matches get high confidence.
   */
  protected calculateConfidence(
    key1: string,
    key2: string,
    attrs1: Record<string, unknown>,
    attrs2: Record<string, unknown>
  ): number {
    // Exact match gets 100
    if (key1 === key2) {
      // Bonus for same resource type
      if (attrs1['resourceType'] === attrs2['resourceType']) {
        return 100;
      }
      return 95;
    }

    // Case-insensitive match (if normalization is off)
    if (!this.idConfig.normalize && key1.toLowerCase() === key2.toLowerCase()) {
      return 90;
    }

    // No match
    return 0;
  }

  /**
   * Extract additional attributes for matching context.
   */
  protected extractAttributes(node: NodeType): Record<string, unknown> {
    const baseAttrs = super.extractAttributes(node);

    if (node.type === 'terraform_resource') {
      const resourceNode = node as TerraformResourceNode;
      return {
        ...baseAttrs,
        resourceType: resourceNode.resourceType,
        provider: resourceNode.provider,
      };
    }

    return baseAttrs;
  }

  /**
   * Build additional context for resource ID matches.
   */
  protected buildMatchContext(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): Record<string, unknown> {
    return {
      ...super.buildMatchContext(candidate1, candidate2),
      configuredResourceType: this.idConfig.resourceType,
      idAttribute: this.idConfig.idAttribute || 'id',
      normalized: this.idConfig.normalize ?? true,
    };
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Check if a resource type matches the configured type.
   * Supports wildcard patterns.
   */
  private matchesResourceType(resourceType: string): boolean {
    const configuredType = this.idConfig.resourceType;

    // Exact match
    if (configuredType === resourceType) {
      return true;
    }

    // Wildcard matching
    if (configuredType.includes('*')) {
      const pattern = configuredType
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(resourceType);
    }

    return false;
  }

  /**
   * Get the ID value from a node using the configured path.
   */
  private getIdValue(node: NodeType, path: string): string | null {
    // Try direct metadata access
    const metadataValue = this.getNestedValue(node.metadata, path);
    if (metadataValue !== undefined) {
      return this.stringifyValue(metadataValue);
    }

    // Try attributes in metadata
    const attributes = node.metadata['attributes'] as Record<string, unknown> | undefined;
    if (attributes) {
      const attrValue = this.getNestedValue(attributes, path);
      if (attrValue !== undefined) {
        return this.stringifyValue(attrValue);
      }
    }

    // Try common ID locations
    const commonPaths = [
      'id',
      'name',
      'unique_id',
      'resource_id',
      `${path}_id`,
    ];

    for (const commonPath of commonPaths) {
      const value = this.getNestedValue(node.metadata, commonPath);
      if (value !== undefined) {
        return this.stringifyValue(value);
      }
    }

    return null;
  }

  /**
   * Convert a value to string.
   */
  private stringifyValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  /**
   * Apply the extraction pattern to extract a specific part of the ID.
   */
  private applyExtractionPattern(id: string): string | null {
    if (!this.extractionRegex) {
      return id;
    }

    const match = this.extractionRegex.exec(id);
    if (!match) {
      return null;
    }

    // Return first capturing group or entire match
    return match[1] ?? match[0];
  }

  /**
   * Normalize an ID value.
   */
  private normalizeId(id: string): string {
    // Trim whitespace
    let normalized = id.trim();

    // Convert to lowercase
    normalized = normalized.toLowerCase();

    // Remove common prefixes/suffixes that might differ
    normalized = normalized.replace(/^(id[-_:]?|resource[-_:]?)/i, '');
    normalized = normalized.replace(/([-_:]?id)$/i, '');

    return normalized;
  }

  /**
   * Check if an ID value is valid.
   */
  private isValidId(id: string): boolean {
    // Must have some content
    if (!id || id.length === 0) {
      return false;
    }

    // Must not be a placeholder
    const placeholders = [
      '<computed>',
      '(known after apply)',
      'unknown',
      'null',
      'undefined',
      'n/a',
    ];
    if (placeholders.includes(id.toLowerCase())) {
      return false;
    }

    // Should have reasonable length
    if (id.length > 256) {
      return false;
    }

    return true;
  }
}
