/**
 * Cache Key Builder
 * @module services/rollup/rollup-cache/cache-key-builder
 *
 * Generates consistent, versioned cache keys for rollup cache entries.
 * Supports key parsing, tag generation, and pattern building for
 * efficient cache invalidation.
 *
 * Key Patterns:
 * - Execution:    rollup:v1:{tenantId}:execution:{executionId}
 * - Merged Graph: rollup:v1:{tenantId}:merged_graph:{rollupId}
 * - Blast Radius: rollup:v1:{tenantId}:blast_radius:{nodeId}:depth={depth}
 * - Tag Set:      rollup:v1:tag:{tagType}:{tagValue}
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 */

import { TenantId } from '../../../types/entities.js';
import { RollupId, RollupExecutionId } from '../../../types/rollup.js';
import {
  ICacheKeyBuilder,
  CacheKey,
  CacheTag,
  CacheVersion,
  ParsedCacheKey,
  CacheEntryType,
  createCacheKey,
  createCacheTag,
} from './interfaces.js';

// ============================================================================
// Constants
// ============================================================================

/** Default key prefix */
const DEFAULT_PREFIX = 'rollup';

/** Default cache version */
const DEFAULT_VERSION: CacheVersion = 'v1';

/** Key segment separator */
const SEPARATOR = ':';

/** Parameter key-value separator */
const PARAM_KV_SEPARATOR = '=';

// ============================================================================
// Cache Key Builder Implementation
// ============================================================================

/**
 * Builds consistent, versioned cache keys for rollup cache entries.
 * Provides utilities for key generation, parsing, and tag management.
 */
export class CacheKeyBuilder implements ICacheKeyBuilder {
  private readonly version: CacheVersion;
  private readonly prefix: string;

  /**
   * Create a new CacheKeyBuilder
   * @param version - Cache version for key namespacing
   * @param prefix - Key prefix (default: 'rollup')
   */
  constructor(
    version: CacheVersion = DEFAULT_VERSION,
    prefix: string = DEFAULT_PREFIX
  ) {
    this.version = version;
    this.prefix = prefix;
  }

  // =========================================================================
  // Key Building Methods
  // =========================================================================

  /**
   * Build cache key for execution result
   *
   * Pattern: rollup:v1:{tenantId}:execution:{executionId}
   *
   * @param tenantId - Tenant identifier
   * @param executionId - Execution identifier
   * @returns Cache key for the execution result
   */
  buildExecutionKey(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): CacheKey {
    const segments = [
      this.prefix,
      this.version,
      this.sanitizeSegment(tenantId),
      'execution',
      this.sanitizeSegment(executionId),
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  /**
   * Build cache key for merged graph
   *
   * Pattern: rollup:v1:{tenantId}:merged_graph:{rollupId}
   *
   * @param tenantId - Tenant identifier
   * @param rollupId - Rollup identifier
   * @returns Cache key for the merged graph
   */
  buildMergedGraphKey(tenantId: TenantId, rollupId: RollupId): CacheKey {
    const segments = [
      this.prefix,
      this.version,
      this.sanitizeSegment(tenantId),
      'merged_graph',
      this.sanitizeSegment(rollupId),
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  /**
   * Build cache key for blast radius result
   *
   * Pattern: rollup:v1:{tenantId}:blast_radius:{nodeId}:depth={depth}
   *
   * @param tenantId - Tenant identifier
   * @param nodeId - Starting node identifier
   * @param depth - Traversal depth
   * @returns Cache key for the blast radius result
   */
  buildBlastRadiusKey(
    tenantId: TenantId,
    nodeId: string,
    depth: number
  ): CacheKey {
    const segments = [
      this.prefix,
      this.version,
      this.sanitizeSegment(tenantId),
      'blast_radius',
      this.sanitizeSegment(nodeId),
      `depth${PARAM_KV_SEPARATOR}${depth}`,
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  /**
   * Build cache key for tag set
   *
   * Pattern: rollup:v1:tag:{tagType}:{tagValue}
   *
   * Tag sets store the cache keys associated with a particular tag,
   * enabling efficient tag-based invalidation.
   *
   * @param tagType - Type of tag (e.g., 'tenant', 'rollup', 'execution')
   * @param tagValue - Tag value
   * @returns Cache key for the tag set
   */
  buildTagSetKey(tagType: string, tagValue: string): CacheKey {
    const segments = [
      this.prefix,
      this.version,
      'tag',
      this.sanitizeSegment(tagType),
      this.sanitizeSegment(tagValue),
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  // =========================================================================
  // Tag Creation Methods
  // =========================================================================

  /**
   * Create a tenant tag for invalidation
   *
   * Tag Pattern: tenant:{tenantId}
   *
   * @param tenantId - Tenant identifier
   * @returns Cache tag for tenant-level invalidation
   */
  createTenantTag(tenantId: TenantId): CacheTag {
    return createCacheTag(`tenant${SEPARATOR}${this.sanitizeSegment(tenantId)}`);
  }

  /**
   * Create a rollup tag for invalidation
   *
   * Tag Pattern: rollup:{tenantId}:{rollupId}
   *
   * @param tenantId - Tenant identifier
   * @param rollupId - Rollup identifier
   * @returns Cache tag for rollup-level invalidation
   */
  createRollupTag(tenantId: TenantId, rollupId: RollupId): CacheTag {
    return createCacheTag(
      `rollup${SEPARATOR}${this.sanitizeSegment(tenantId)}${SEPARATOR}${this.sanitizeSegment(rollupId)}`
    );
  }

  /**
   * Create an execution tag for invalidation
   *
   * Tag Pattern: execution:{tenantId}:{executionId}
   *
   * @param tenantId - Tenant identifier
   * @param executionId - Execution identifier
   * @returns Cache tag for execution-level invalidation
   */
  createExecutionTag(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): CacheTag {
    return createCacheTag(
      `execution${SEPARATOR}${this.sanitizeSegment(tenantId)}${SEPARATOR}${this.sanitizeSegment(executionId)}`
    );
  }

  /**
   * Create a node tag for blast radius invalidation
   *
   * Tag Pattern: node:{tenantId}:{nodeId}
   *
   * @param tenantId - Tenant identifier
   * @param nodeId - Node identifier
   * @returns Cache tag for node-level invalidation
   */
  createNodeTag(tenantId: TenantId, nodeId: string): CacheTag {
    return createCacheTag(
      `node${SEPARATOR}${this.sanitizeSegment(tenantId)}${SEPARATOR}${this.sanitizeSegment(nodeId)}`
    );
  }

  // =========================================================================
  // Key Parsing Methods
  // =========================================================================

  /**
   * Parse a cache key into its components
   *
   * @param key - Cache key to parse
   * @returns Parsed key components or null if invalid
   */
  parseKey(key: CacheKey): ParsedCacheKey | null {
    const segments = key.split(SEPARATOR);

    // Minimum segments: prefix:version:tenantId:entryType:identifier
    if (segments.length < 5) {
      return null;
    }

    const [prefix, version, tenantId, entryType, ...rest] = segments;

    // Validate prefix and version
    if (prefix === undefined || prefix !== this.prefix) {
      return null;
    }

    if (version === undefined || !this.isValidVersion(version)) {
      return null;
    }

    if (tenantId === undefined || entryType === undefined || !this.isValidEntryType(entryType)) {
      return null;
    }

    // Extract identifier and params
    const { identifier, params } = this.parseIdentifierAndParams(rest);

    const result: ParsedCacheKey = {
      prefix,
      version: version as CacheVersion,
      tenantId: tenantId as TenantId,
      entryType: entryType as CacheEntryType,
      identifier,
    };

    if (Object.keys(params).length > 0) {
      return { ...result, params };
    }

    return result;
  }

  /**
   * Get the current cache version
   */
  getVersion(): CacheVersion {
    return this.version;
  }

  /**
   * Build a pattern for matching keys (supports wildcards)
   *
   * @param tenantId - Tenant identifier
   * @param entryType - Optional entry type filter
   * @returns Pattern string for key matching
   */
  buildPattern(tenantId: TenantId, entryType?: CacheEntryType): string {
    const segments = [
      this.prefix,
      this.version,
      this.sanitizeSegment(tenantId),
    ];

    if (entryType) {
      segments.push(entryType);
    }

    return segments.join(SEPARATOR) + SEPARATOR + '*';
  }

  /**
   * Build a pattern for matching all keys of a specific type across tenants
   *
   * @param entryType - Entry type to match
   * @returns Pattern string for key matching
   */
  buildTypePattern(entryType: CacheEntryType): string {
    return `${this.prefix}${SEPARATOR}${this.version}${SEPARATOR}*${SEPARATOR}${entryType}${SEPARATOR}*`;
  }

  /**
   * Build a pattern for matching all keys for the current version
   *
   * @returns Pattern string for key matching
   */
  buildVersionPattern(): string {
    return `${this.prefix}${SEPARATOR}${this.version}${SEPARATOR}*`;
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Generate cache tags for an execution result
   *
   * @param tenantId - Tenant identifier
   * @param executionId - Execution identifier
   * @param rollupId - Rollup identifier
   * @returns Array of cache tags for the execution
   */
  generateExecutionTags(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    rollupId: RollupId
  ): CacheTag[] {
    return [
      this.createTenantTag(tenantId),
      this.createRollupTag(tenantId, rollupId),
      this.createExecutionTag(tenantId, executionId),
    ];
  }

  /**
   * Generate cache tags for a merged graph
   *
   * @param tenantId - Tenant identifier
   * @param rollupId - Rollup identifier
   * @returns Array of cache tags for the graph
   */
  generateMergedGraphTags(
    tenantId: TenantId,
    rollupId: RollupId
  ): CacheTag[] {
    return [
      this.createTenantTag(tenantId),
      this.createRollupTag(tenantId, rollupId),
    ];
  }

  /**
   * Generate cache tags for a blast radius result
   *
   * @param tenantId - Tenant identifier
   * @param nodeId - Node identifier
   * @param rollupId - Optional rollup identifier
   * @returns Array of cache tags for the blast radius
   */
  generateBlastRadiusTags(
    tenantId: TenantId,
    nodeId: string,
    rollupId?: RollupId
  ): CacheTag[] {
    const tags: CacheTag[] = [
      this.createTenantTag(tenantId),
      this.createNodeTag(tenantId, nodeId),
    ];

    if (rollupId) {
      tags.push(this.createRollupTag(tenantId, rollupId));
    }

    return tags;
  }

  /**
   * Extract the tenant ID from a cache key
   *
   * @param key - Cache key
   * @returns Tenant ID or null if not found
   */
  extractTenantId(key: CacheKey): TenantId | null {
    const parsed = this.parseKey(key);
    return parsed?.tenantId ?? null;
  }

  /**
   * Check if a key belongs to a specific tenant
   *
   * @param key - Cache key
   * @param tenantId - Tenant identifier to check
   * @returns True if key belongs to tenant
   */
  keyBelongsToTenant(key: CacheKey, tenantId: TenantId): boolean {
    const parsed = this.parseKey(key);
    return parsed?.tenantId === tenantId;
  }

  /**
   * Check if a key is for a specific entry type
   *
   * @param key - Cache key
   * @param entryType - Entry type to check
   * @returns True if key is for the entry type
   */
  keyIsEntryType(key: CacheKey, entryType: CacheEntryType): boolean {
    const parsed = this.parseKey(key);
    return parsed?.entryType === entryType;
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Sanitize a segment for use in cache keys
   * Removes or replaces characters that could cause issues
   */
  private sanitizeSegment(segment: string): string {
    // Replace colons with underscores to prevent key parsing issues
    // Remove other problematic characters
    return segment
      .replace(/:/g, '_')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]/g, '');
  }

  /**
   * Parse identifier and parameters from remaining key segments
   */
  private parseIdentifierAndParams(
    segments: string[]
  ): { identifier: string; params: Record<string, string> } {
    const params: Record<string, string> = {};
    const identifierParts: string[] = [];

    for (const segment of segments) {
      if (segment.includes(PARAM_KV_SEPARATOR)) {
        const [key, value] = segment.split(PARAM_KV_SEPARATOR, 2);
        if (key && value !== undefined) {
          params[key] = value;
        }
      } else {
        identifierParts.push(segment);
      }
    }

    return {
      identifier: identifierParts.join(SEPARATOR),
      params,
    };
  }

  /**
   * Check if a version string is valid
   */
  private isValidVersion(version: string): version is CacheVersion {
    return version === 'v1' || version === 'v2';
  }

  /**
   * Check if an entry type string is valid
   */
  private isValidEntryType(entryType: string): entryType is CacheEntryType {
    return (
      entryType === 'execution' ||
      entryType === 'merged_graph' ||
      entryType === 'blast_radius' ||
      entryType === 'tag_set'
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new CacheKeyBuilder with default settings
 */
export function createCacheKeyBuilder(
  version: CacheVersion = DEFAULT_VERSION,
  prefix: string = DEFAULT_PREFIX
): ICacheKeyBuilder {
  return new CacheKeyBuilder(version, prefix);
}

/**
 * Default cache key builder instance
 */
let defaultKeyBuilder: CacheKeyBuilder | null = null;

/**
 * Get the default cache key builder instance
 */
export function getDefaultCacheKeyBuilder(): ICacheKeyBuilder {
  if (!defaultKeyBuilder) {
    defaultKeyBuilder = new CacheKeyBuilder();
  }
  return defaultKeyBuilder;
}

/**
 * Reset the default cache key builder instance
 * (useful for testing)
 */
export function resetDefaultCacheKeyBuilder(): void {
  defaultKeyBuilder = null;
}
