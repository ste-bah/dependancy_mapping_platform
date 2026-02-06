/**
 * Fixture Registry Domain Entity
 * @module e2e/domain/fixture-registry
 *
 * Singleton registry for managing test fixtures with dependency resolution,
 * lazy loading, and lifecycle management.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #21 of 47 | Phase 4: Implementation
 */

import type { Brand, Result } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';
import type { FixtureId } from '../types/test-types.js';
import { createFixtureId } from '../types/test-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Fixture definition with factory and metadata
 */
export interface FixtureDefinition<T = unknown> {
  /** Unique fixture ID */
  readonly id: FixtureId;
  /** Fixture name */
  readonly name: string;
  /** Fixture description */
  readonly description: string;
  /** Factory function that creates the fixture */
  readonly factory: FixtureFactory<T>;
  /** Dependencies on other fixtures */
  readonly dependencies: ReadonlyArray<FixtureId>;
  /** Tags for categorization */
  readonly tags: ReadonlyArray<string>;
  /** Whether to cache the fixture value */
  readonly cached: boolean;
  /** TTL for cached value in milliseconds (0 = no expiry) */
  readonly cacheTtl: number;
  /** Setup hook called before fixture is created */
  readonly setup?: () => Promise<void>;
  /** Teardown hook called when fixture is disposed */
  readonly teardown?: (value: T) => Promise<void>;
}

/**
 * Factory function for creating fixtures
 */
export type FixtureFactory<T> = (
  dependencies: ReadonlyMap<FixtureId, unknown>
) => T | Promise<T>;

/**
 * Cached fixture entry
 */
interface CachedFixture<T = unknown> {
  /** The cached value */
  readonly value: T;
  /** When the value was cached */
  readonly cachedAt: Date;
  /** When the cache expires (undefined = never) */
  readonly expiresAt?: Date;
}

/**
 * Fixture registration options
 */
export interface FixtureRegistrationOptions<T = unknown> {
  /** Fixture name */
  name: string;
  /** Fixture description */
  description?: string;
  /** Factory function */
  factory: FixtureFactory<T>;
  /** Dependencies */
  dependencies?: ReadonlyArray<string>;
  /** Tags */
  tags?: ReadonlyArray<string>;
  /** Whether to cache */
  cached?: boolean;
  /** Cache TTL */
  cacheTtl?: number;
  /** Setup hook */
  setup?: () => Promise<void>;
  /** Teardown hook */
  teardown?: (value: T) => Promise<void>;
}

/**
 * Registry error
 */
export interface RegistryError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Fixture ID if applicable */
  readonly fixtureId?: FixtureId;
  /** Additional context */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Dependency resolution result
 */
interface ResolutionResult {
  /** Ordered list of fixture IDs to load */
  readonly order: ReadonlyArray<FixtureId>;
  /** Detected cycles (empty if none) */
  readonly cycles: ReadonlyArray<ReadonlyArray<FixtureId>>;
}

// ============================================================================
// Fixture Registry Singleton
// ============================================================================

/**
 * Fixture Registry manages test fixture definitions and instances.
 * Uses singleton pattern to ensure consistent fixture state across tests.
 */
export class FixtureRegistry {
  private static _instance: FixtureRegistry | null = null;

  private readonly _definitions: Map<FixtureId, FixtureDefinition<unknown>>;
  private readonly _cache: Map<FixtureId, CachedFixture<unknown>>;
  private readonly _loadingStack: Set<FixtureId>;

  private constructor() {
    this._definitions = new Map();
    this._cache = new Map();
    this._loadingStack = new Set();
  }

  // ============================================================================
  // Singleton Access
  // ============================================================================

  /**
   * Get the singleton instance
   */
  static getInstance(): FixtureRegistry {
    if (!FixtureRegistry._instance) {
      FixtureRegistry._instance = new FixtureRegistry();
    }
    return FixtureRegistry._instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static reset(): void {
    if (FixtureRegistry._instance) {
      FixtureRegistry._instance._definitions.clear();
      FixtureRegistry._instance._cache.clear();
      FixtureRegistry._instance._loadingStack.clear();
    }
    FixtureRegistry._instance = null;
  }

  // ============================================================================
  // Registration
  // ============================================================================

  /**
   * Register a fixture definition
   */
  register<T>(options: FixtureRegistrationOptions<T>): Result<FixtureId, RegistryError> {
    const id = createFixtureId(`fixture_${options.name.toLowerCase().replace(/\s+/g, '_')}`);

    // Check for duplicate
    if (this._definitions.has(id)) {
      return failure({
        code: 'FIXTURE_EXISTS',
        message: `Fixture "${options.name}" is already registered`,
        fixtureId: id,
      });
    }

    // Validate dependencies exist (if specified)
    const dependencies = (options.dependencies ?? []).map((d) => createFixtureId(d));
    for (const depId of dependencies) {
      if (!this._definitions.has(depId) && depId !== id) {
        // Allow forward references but validate on resolution
      }
    }

    const definition: FixtureDefinition<T> = {
      id,
      name: options.name,
      description: options.description ?? '',
      factory: options.factory,
      dependencies,
      tags: options.tags ?? [],
      cached: options.cached ?? true,
      cacheTtl: options.cacheTtl ?? 0,
      setup: options.setup,
      teardown: options.teardown,
    };

    this._definitions.set(id, definition as FixtureDefinition<unknown>);
    return success(id);
  }

  /**
   * Register a fixture with explicit ID
   */
  registerWithId<T>(
    id: string,
    options: Omit<FixtureRegistrationOptions<T>, 'name'> & { name?: string }
  ): Result<FixtureId, RegistryError> {
    const fixtureId = createFixtureId(id);

    if (this._definitions.has(fixtureId)) {
      return failure({
        code: 'FIXTURE_EXISTS',
        message: `Fixture with ID "${id}" is already registered`,
        fixtureId,
      });
    }

    const definition: FixtureDefinition<T> = {
      id: fixtureId,
      name: options.name ?? id,
      description: options.description ?? '',
      factory: options.factory,
      dependencies: (options.dependencies ?? []).map((d) => createFixtureId(d)),
      tags: options.tags ?? [],
      cached: options.cached ?? true,
      cacheTtl: options.cacheTtl ?? 0,
      setup: options.setup,
      teardown: options.teardown,
    };

    this._definitions.set(fixtureId, definition as FixtureDefinition<unknown>);
    return success(fixtureId);
  }

  /**
   * Unregister a fixture
   */
  unregister(id: FixtureId): boolean {
    this._cache.delete(id);
    return this._definitions.delete(id);
  }

  // ============================================================================
  // Lookup
  // ============================================================================

  /**
   * Get a fixture definition
   */
  getDefinition<T>(id: FixtureId): FixtureDefinition<T> | undefined {
    return this._definitions.get(id) as FixtureDefinition<T> | undefined;
  }

  /**
   * Check if a fixture is registered
   */
  has(id: FixtureId): boolean {
    return this._definitions.has(id);
  }

  /**
   * Get all registered fixture IDs
   */
  getAllIds(): ReadonlyArray<FixtureId> {
    return Array.from(this._definitions.keys());
  }

  /**
   * Get fixtures by tag
   */
  getByTag(tag: string): ReadonlyArray<FixtureDefinition<unknown>> {
    return Array.from(this._definitions.values()).filter((d) => d.tags.includes(tag));
  }

  /**
   * Get fixtures count
   */
  get size(): number {
    return this._definitions.size;
  }

  // ============================================================================
  // Resolution & Loading
  // ============================================================================

  /**
   * Resolve fixture and its dependencies
   */
  async resolve<T>(id: FixtureId): Promise<Result<T, RegistryError>> {
    // Check cache first
    const cached = this.getCachedValue<T>(id);
    if (cached !== undefined) {
      return success(cached);
    }

    // Detect circular dependency
    if (this._loadingStack.has(id)) {
      const cycle = Array.from(this._loadingStack);
      return failure({
        code: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependency detected: ${cycle.join(' -> ')} -> ${id}`,
        fixtureId: id,
        context: { cycle },
      });
    }

    const definition = this._definitions.get(id);
    if (!definition) {
      return failure({
        code: 'FIXTURE_NOT_FOUND',
        message: `Fixture "${id}" is not registered`,
        fixtureId: id,
      });
    }

    // Mark as loading
    this._loadingStack.add(id);

    try {
      // Resolve dependencies first
      const resolvedDeps = new Map<FixtureId, unknown>();

      for (const depId of definition.dependencies) {
        const depResult = await this.resolve(depId);
        if (!depResult.success) {
          return depResult as Result<T, RegistryError>;
        }
        resolvedDeps.set(depId, depResult.value);
      }

      // Run setup hook
      if (definition.setup) {
        await definition.setup();
      }

      // Create fixture value
      const value = await definition.factory(resolvedDeps);

      // Cache if configured
      if (definition.cached) {
        this.cacheValue(id, value, definition.cacheTtl);
      }

      return success(value as T);
    } finally {
      this._loadingStack.delete(id);
    }
  }

  /**
   * Resolve dependencies for a fixture (without creating it)
   */
  resolveDependencies(id: FixtureId): Result<ResolutionResult, RegistryError> {
    const visited = new Set<FixtureId>();
    const order: FixtureId[] = [];
    const cycles: FixtureId[][] = [];

    const visit = (
      current: FixtureId,
      path: FixtureId[]
    ): Result<void, RegistryError> => {
      if (path.includes(current)) {
        const cycleStart = path.indexOf(current);
        cycles.push([...path.slice(cycleStart), current]);
        return success(undefined);
      }

      if (visited.has(current)) {
        return success(undefined);
      }

      const definition = this._definitions.get(current);
      if (!definition) {
        return failure({
          code: 'FIXTURE_NOT_FOUND',
          message: `Dependency "${current}" is not registered`,
          fixtureId: current,
        });
      }

      visited.add(current);
      path.push(current);

      for (const dep of definition.dependencies) {
        const result = visit(dep, path);
        if (!result.success) {
          return result;
        }
      }

      path.pop();
      order.push(current);
      return success(undefined);
    };

    const result = visit(id, []);
    if (!result.success) {
      return failure(result.error);
    }

    return success({ order, cycles });
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Get cached value if available and not expired
   */
  private getCachedValue<T>(id: FixtureId): T | undefined {
    const cached = this._cache.get(id);
    if (!cached) {
      return undefined;
    }

    // Check expiry
    if (cached.expiresAt && cached.expiresAt < new Date()) {
      this._cache.delete(id);
      return undefined;
    }

    return cached.value as T;
  }

  /**
   * Cache a fixture value
   */
  private cacheValue(id: FixtureId, value: unknown, ttl: number): void {
    const entry: CachedFixture = {
      value,
      cachedAt: new Date(),
      expiresAt: ttl > 0 ? new Date(Date.now() + ttl) : undefined,
    };
    this._cache.set(id, entry);
  }

  /**
   * Invalidate cache for a fixture
   */
  invalidateCache(id: FixtureId): boolean {
    return this._cache.delete(id);
  }

  /**
   * Invalidate all cached fixtures
   */
  invalidateAllCaches(): void {
    this._cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    expired: number;
    active: number;
  } {
    const now = new Date();
    let expired = 0;
    let active = 0;

    for (const cached of this._cache.values()) {
      if (cached.expiresAt && cached.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      size: this._cache.size,
      expired,
      active,
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose a fixture (run teardown and remove from cache)
   */
  async dispose(id: FixtureId): Promise<Result<void, RegistryError>> {
    const definition = this._definitions.get(id);
    if (!definition) {
      return failure({
        code: 'FIXTURE_NOT_FOUND',
        message: `Fixture "${id}" is not registered`,
        fixtureId: id,
      });
    }

    const cached = this._cache.get(id);
    if (cached && definition.teardown) {
      try {
        await definition.teardown(cached.value);
      } catch (error) {
        return failure({
          code: 'TEARDOWN_FAILED',
          message: `Teardown failed for fixture "${id}": ${error instanceof Error ? error.message : String(error)}`,
          fixtureId: id,
        });
      }
    }

    this._cache.delete(id);
    return success(undefined);
  }

  /**
   * Dispose all fixtures in reverse dependency order
   */
  async disposeAll(): Promise<ReadonlyArray<RegistryError>> {
    const errors: RegistryError[] = [];

    // Build reverse dependency order
    const allIds = Array.from(this._definitions.keys());
    const disposed = new Set<FixtureId>();

    // Simple approach: dispose fixtures without dependents first
    const canDispose = (id: FixtureId): boolean => {
      for (const def of this._definitions.values()) {
        if (def.id !== id && !disposed.has(def.id) && def.dependencies.includes(id)) {
          return false;
        }
      }
      return true;
    };

    let changed = true;
    while (changed && disposed.size < allIds.length) {
      changed = false;
      for (const id of allIds) {
        if (!disposed.has(id) && canDispose(id)) {
          const result = await this.dispose(id);
          if (!result.success) {
            errors.push(result.error);
          }
          disposed.add(id);
          changed = true;
        }
      }
    }

    // Force dispose remaining (in case of cycles)
    for (const id of allIds) {
      if (!disposed.has(id)) {
        const result = await this.dispose(id);
        if (!result.success) {
          errors.push(result.error);
        }
      }
    }

    return errors;
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Get registry state for debugging
   */
  toJSON(): Record<string, unknown> {
    return {
      definitions: Array.from(this._definitions.values()).map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        dependencies: d.dependencies,
        tags: d.tags,
        cached: d.cached,
        cacheTtl: d.cacheTtl,
      })),
      cacheStats: this.getCacheStats(),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the fixture registry instance
 */
export function getFixtureRegistry(): FixtureRegistry {
  return FixtureRegistry.getInstance();
}

/**
 * Register a fixture with the global registry
 */
export function registerFixture<T>(
  options: FixtureRegistrationOptions<T>
): Result<FixtureId, RegistryError> {
  return FixtureRegistry.getInstance().register(options);
}

/**
 * Resolve a fixture from the global registry
 */
export async function resolveFixture<T>(
  id: FixtureId | string
): Promise<Result<T, RegistryError>> {
  const fixtureId = typeof id === 'string' ? createFixtureId(id) : id;
  return FixtureRegistry.getInstance().resolve(fixtureId);
}

/**
 * Type guard for RegistryError
 */
export function isRegistryError(value: unknown): value is RegistryError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
