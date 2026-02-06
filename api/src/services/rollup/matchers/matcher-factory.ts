/**
 * Matcher Factory
 * @module services/rollup/matchers/matcher-factory
 *
 * Factory for creating matcher instances based on configuration.
 * Implements the Factory pattern to encapsulate matcher creation logic.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation matcher factory
 */

import {
  MatchingStrategy,
  MatcherConfig,
  isArnMatcherConfig,
  isResourceIdMatcherConfig,
  isNameMatcherConfig,
  isTagMatcherConfig,
} from '../../../types/rollup.js';
import { IMatcher, IMatcherFactory } from '../interfaces.js';
import { ArnMatcher } from './arn-matcher.js';
import { ResourceIdMatcher } from './resource-id-matcher.js';
import { NameMatcher } from './name-matcher.js';
import { TagMatcher } from './tag-matcher.js';

/**
 * Custom matcher registration
 */
interface CustomMatcherRegistration {
  /** Strategy identifier */
  readonly strategy: MatchingStrategy;
  /** Factory function to create the matcher */
  readonly factory: (config: MatcherConfig) => IMatcher;
}

/**
 * Factory for creating and managing matcher instances.
 * Provides centralized matcher creation and registration of custom matchers.
 */
export class MatcherFactory implements IMatcherFactory {
  /**
   * Registry of custom matchers
   */
  private readonly customMatchers: Map<string, CustomMatcherRegistration> = new Map();

  /**
   * Cached matcher instances for reuse
   */
  private readonly matcherCache: Map<string, IMatcher> = new Map();

  /**
   * Whether to cache matcher instances
   */
  private readonly enableCaching: boolean;

  /**
   * Create a new MatcherFactory
   * @param options - Factory options
   */
  constructor(options: { enableCaching?: boolean } = {}) {
    this.enableCaching = options.enableCaching ?? true;
  }

  /**
   * Create a matcher from configuration.
   *
   * @param config - Matcher configuration
   * @returns Configured matcher instance
   * @throws Error if matcher type is unknown or configuration is invalid
   */
  createMatcher(config: MatcherConfig): IMatcher {
    // Check cache first
    if (this.enableCaching) {
      const cacheKey = this.getCacheKey(config);
      const cached = this.matcherCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Create new matcher
    const matcher = this.instantiateMatcher(config);

    // Validate configuration
    const validation = matcher.validateConfig();
    if (!validation.isValid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      throw new Error(
        `Invalid matcher configuration: ${errorMessages.join('; ')}`
      );
    }

    // Cache if enabled
    if (this.enableCaching) {
      const cacheKey = this.getCacheKey(config);
      this.matcherCache.set(cacheKey, matcher);
    }

    return matcher;
  }

  /**
   * Create all matchers from a rollup configuration.
   * Returns matchers sorted by priority (highest first).
   *
   * @param matchers - Array of matcher configurations
   * @returns Array of configured matchers
   */
  createMatchers(matchers: MatcherConfig[]): IMatcher[] {
    // Filter enabled matchers and create instances
    const createdMatchers = matchers
      .filter((config) => config.enabled)
      .map((config) => this.createMatcher(config));

    // Sort by priority (highest first)
    return createdMatchers.sort((a, b) => b.getPriority() - a.getPriority());
  }

  /**
   * Get available matcher types.
   *
   * @returns List of supported matcher strategies
   */
  getAvailableTypes(): MatchingStrategy[] {
    const builtInTypes: MatchingStrategy[] = ['arn', 'resource_id', 'name', 'tag'];
    const customTypes = Array.from(this.customMatchers.values()).map(
      (reg) => reg.strategy
    );

    return [...builtInTypes, ...customTypes];
  }

  /**
   * Register a custom matcher type.
   *
   * @param registration - Custom matcher registration
   */
  registerMatcher(registration: CustomMatcherRegistration): void {
    this.customMatchers.set(registration.strategy, registration);
  }

  /**
   * Unregister a custom matcher type.
   *
   * @param strategy - Strategy to unregister
   */
  unregisterMatcher(strategy: MatchingStrategy): void {
    this.customMatchers.delete(strategy);
  }

  /**
   * Clear the matcher cache.
   */
  clearCache(): void {
    this.matcherCache.clear();
  }

  /**
   * Get the number of cached matchers.
   */
  getCacheSize(): number {
    return this.matcherCache.size;
  }

  /**
   * Check if a matcher type is supported.
   *
   * @param strategy - Strategy to check
   * @returns True if the strategy is supported
   */
  isSupported(strategy: MatchingStrategy): boolean {
    return this.getAvailableTypes().includes(strategy);
  }

  /**
   * Validate a matcher configuration without creating the matcher.
   *
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig(config: MatcherConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      const matcher = this.instantiateMatcher(config);
      const validation = matcher.validateConfig();
      return {
        isValid: validation.isValid,
        errors: validation.errors.map((e) => `${e.path}: ${e.message}`),
        warnings: validation.warnings.map((w) => `${w.path}: ${w.message}`),
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      };
    }
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  /**
   * Instantiate a matcher based on configuration type.
   */
  private instantiateMatcher(config: MatcherConfig): IMatcher {
    // Check for custom matcher first
    const customReg = this.customMatchers.get(config.type);
    if (customReg) {
      return customReg.factory(config);
    }

    // Built-in matchers
    if (isArnMatcherConfig(config)) {
      return new ArnMatcher(config);
    }

    if (isResourceIdMatcherConfig(config)) {
      return new ResourceIdMatcher(config);
    }

    if (isNameMatcherConfig(config)) {
      return new NameMatcher(config);
    }

    if (isTagMatcherConfig(config)) {
      return new TagMatcher(config);
    }

    throw new Error(`Unknown matcher type: ${config.type}`);
  }

  /**
   * Generate a cache key for a matcher configuration.
   */
  private getCacheKey(config: MatcherConfig): string {
    // Use a deterministic JSON representation
    return JSON.stringify(config, Object.keys(config).sort());
  }
}

/**
 * Create a new MatcherFactory instance
 */
export function createMatcherFactory(
  options: { enableCaching?: boolean } = {}
): MatcherFactory {
  return new MatcherFactory(options);
}

/**
 * Default matcher factory instance (with caching enabled)
 */
let defaultFactory: MatcherFactory | null = null;

/**
 * Get the default matcher factory instance.
 * Creates one if it doesn't exist.
 */
export function getDefaultMatcherFactory(): MatcherFactory {
  if (!defaultFactory) {
    defaultFactory = new MatcherFactory({ enableCaching: true });
  }
  return defaultFactory;
}

/**
 * Reset the default matcher factory.
 * Useful for testing.
 */
export function resetDefaultMatcherFactory(): void {
  if (defaultFactory) {
    defaultFactory.clearCache();
    defaultFactory = null;
  }
}
