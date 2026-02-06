/**
 * FixtureRegistry Unit Tests
 * @module e2e/tests/unit/domain/fixture-registry.test
 *
 * Unit tests for the FixtureRegistry singleton that manages test fixtures:
 * - Singleton pattern enforcement
 * - Fixture registration and retrieval
 * - Lazy loading and caching
 * - Namespace isolation
 * - Cleanup and lifecycle management
 *
 * TASK-E2E-032: Comprehensive test generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface Fixture<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly namespace: string;
  readonly data: T;
  readonly metadata: FixtureMetadata;
}

interface FixtureMetadata {
  readonly createdAt: Date;
  readonly ttl?: number;
  readonly tags: readonly string[];
  readonly lazy: boolean;
}

type FixtureFactory<T> = () => T | Promise<T>;

interface FixtureRegistration<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly namespace: string;
  readonly factory: FixtureFactory<T>;
  readonly options: FixtureOptions;
}

interface FixtureOptions {
  readonly lazy?: boolean;
  readonly ttl?: number;
  readonly tags?: readonly string[];
  readonly singleton?: boolean;
}

// ============================================================================
// FixtureRegistry Implementation (Inline for Unit Testing)
// ============================================================================

class FixtureRegistry {
  private static _instance: FixtureRegistry | null = null;

  private _registrations = new Map<string, FixtureRegistration>();
  private _cache = new Map<string, Fixture>();
  private _namespaces = new Set<string>();
  private _defaultNamespace = 'default';

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): FixtureRegistry {
    if (!FixtureRegistry._instance) {
      FixtureRegistry._instance = new FixtureRegistry();
    }
    return FixtureRegistry._instance;
  }

  static resetInstance(): void {
    if (FixtureRegistry._instance) {
      FixtureRegistry._instance.clear();
      FixtureRegistry._instance = null;
    }
  }

  // ========================================================================
  // Registration
  // ========================================================================

  register<T>(
    name: string,
    factory: FixtureFactory<T>,
    options: FixtureOptions = {}
  ): string {
    const namespace = this.extractNamespace(name);
    const id = this.generateId(namespace, this.extractName(name));

    if (this._registrations.has(id)) {
      throw new Error(`Fixture already registered: ${id}`);
    }

    const registration: FixtureRegistration<T> = {
      id,
      name: this.extractName(name),
      namespace,
      factory,
      options: {
        lazy: options.lazy ?? true,
        ttl: options.ttl,
        tags: options.tags ?? [],
        singleton: options.singleton ?? true,
      },
    };

    this._registrations.set(id, registration);
    this._namespaces.add(namespace);

    // Pre-load if not lazy
    if (!registration.options.lazy) {
      this.loadFixture(registration);
    }

    return id;
  }

  registerMany<T>(
    fixtures: Array<{ name: string; factory: FixtureFactory<T>; options?: FixtureOptions }>
  ): string[] {
    return fixtures.map(({ name, factory, options }) =>
      this.register(name, factory, options)
    );
  }

  // ========================================================================
  // Retrieval
  // ========================================================================

  async get<T>(name: string): Promise<Fixture<T>> {
    const id = this.resolveId(name);
    const registration = this._registrations.get(id);

    if (!registration) {
      throw new Error(`Fixture not found: ${name}`);
    }

    // Check cache first
    if (registration.options.singleton && this._cache.has(id)) {
      const cached = this._cache.get(id)!;

      // Check TTL
      if (this.isExpired(cached)) {
        this._cache.delete(id);
      } else {
        return cached as Fixture<T>;
      }
    }

    // Load fixture
    return this.loadFixture<T>(registration);
  }

  getSync<T>(name: string): Fixture<T> | null {
    const id = this.resolveId(name);

    if (this._cache.has(id)) {
      const cached = this._cache.get(id)!;
      if (!this.isExpired(cached)) {
        return cached as Fixture<T>;
      }
    }

    return null;
  }

  has(name: string): boolean {
    const id = this.resolveId(name);
    return this._registrations.has(id);
  }

  isLoaded(name: string): boolean {
    const id = this.resolveId(name);
    if (!this._cache.has(id)) return false;

    const cached = this._cache.get(id)!;
    return !this.isExpired(cached);
  }

  // ========================================================================
  // Namespace Management
  // ========================================================================

  setDefaultNamespace(namespace: string): void {
    this._defaultNamespace = namespace;
    this._namespaces.add(namespace);
  }

  getDefaultNamespace(): string {
    return this._defaultNamespace;
  }

  getNamespaces(): readonly string[] {
    return Array.from(this._namespaces);
  }

  getByNamespace(namespace: string): string[] {
    const fixtures: string[] = [];

    for (const [id, reg] of this._registrations) {
      if (reg.namespace === namespace) {
        fixtures.push(id);
      }
    }

    return fixtures;
  }

  // ========================================================================
  // Tag Operations
  // ========================================================================

  getByTag(tag: string): string[] {
    const fixtures: string[] = [];

    for (const [id, reg] of this._registrations) {
      if (reg.options.tags?.includes(tag)) {
        fixtures.push(id);
      }
    }

    return fixtures;
  }

  getByTags(tags: string[], matchAll = false): string[] {
    const fixtures: string[] = [];

    for (const [id, reg] of this._registrations) {
      const fixtureTags = reg.options.tags ?? [];

      const matches = matchAll
        ? tags.every((t) => fixtureTags.includes(t))
        : tags.some((t) => fixtureTags.includes(t));

      if (matches) {
        fixtures.push(id);
      }
    }

    return fixtures;
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  unregister(name: string): boolean {
    const id = this.resolveId(name);
    this._cache.delete(id);
    return this._registrations.delete(id);
  }

  clearNamespace(namespace: string): number {
    let count = 0;

    for (const [id, reg] of this._registrations) {
      if (reg.namespace === namespace) {
        this._registrations.delete(id);
        this._cache.delete(id);
        count++;
      }
    }

    return count;
  }

  clearCache(): void {
    this._cache.clear();
  }

  clear(): void {
    this._registrations.clear();
    this._cache.clear();
    this._namespaces.clear();
    this._namespaces.add(this._defaultNamespace);
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  get size(): number {
    return this._registrations.size;
  }

  get cachedSize(): number {
    return this._cache.size;
  }

  getStats(): {
    registered: number;
    cached: number;
    namespaces: number;
    byNamespace: Record<string, number>;
  } {
    const byNamespace: Record<string, number> = {};

    for (const reg of this._registrations.values()) {
      byNamespace[reg.namespace] = (byNamespace[reg.namespace] ?? 0) + 1;
    }

    return {
      registered: this._registrations.size,
      cached: this._cache.size,
      namespaces: this._namespaces.size,
      byNamespace,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async loadFixture<T>(registration: FixtureRegistration): Promise<Fixture<T>> {
    const data = await registration.factory();

    const fixture: Fixture<T> = {
      id: registration.id,
      name: registration.name,
      namespace: registration.namespace,
      data: data as T,
      metadata: {
        createdAt: new Date(),
        ttl: registration.options.ttl,
        tags: registration.options.tags ?? [],
        lazy: registration.options.lazy ?? true,
      },
    };

    if (registration.options.singleton) {
      this._cache.set(registration.id, fixture);
    }

    return fixture;
  }

  private generateId(namespace: string, name: string): string {
    return `${namespace}:${name}`;
  }

  private extractNamespace(name: string): string {
    if (name.includes(':')) {
      return name.split(':')[0];
    }
    return this._defaultNamespace;
  }

  private extractName(name: string): string {
    if (name.includes(':')) {
      return name.split(':').slice(1).join(':');
    }
    return name;
  }

  private resolveId(name: string): string {
    if (name.includes(':')) {
      return name;
    }
    return this.generateId(this._defaultNamespace, name);
  }

  private isExpired(fixture: Fixture): boolean {
    if (!fixture.metadata.ttl) return false;

    const now = Date.now();
    const created = fixture.metadata.createdAt.getTime();
    return now - created > fixture.metadata.ttl;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('FixtureRegistry', () => {
  beforeEach(() => {
    FixtureRegistry.resetInstance();
  });

  afterEach(() => {
    FixtureRegistry.resetInstance();
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = FixtureRegistry.getInstance();
      const instance2 = FixtureRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = FixtureRegistry.getInstance();
      instance1.register('test', () => ({ value: 1 }));

      FixtureRegistry.resetInstance();

      const instance2 = FixtureRegistry.getInstance();
      expect(instance2).not.toBe(instance1);
      expect(instance2.size).toBe(0);
    });

    it('should preserve state within same instance', () => {
      const registry = FixtureRegistry.getInstance();
      registry.register('fixture1', () => 'data1');

      const sameRegistry = FixtureRegistry.getInstance();
      expect(sameRegistry.has('fixture1')).toBe(true);
    });
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================

  describe('Registration', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
    });

    it('should register a fixture', () => {
      const id = registry.register('testFixture', () => ({ name: 'test' }));

      expect(id).toBe('default:testFixture');
      expect(registry.has('testFixture')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should register with namespace', () => {
      const id = registry.register('users:admin', () => ({ role: 'admin' }));

      expect(id).toBe('users:admin');
      expect(registry.has('users:admin')).toBe(true);
    });

    it('should reject duplicate registration', () => {
      registry.register('duplicate', () => 'first');

      expect(() => registry.register('duplicate', () => 'second')).toThrow(
        'Fixture already registered'
      );
    });

    it('should register many fixtures at once', () => {
      const ids = registry.registerMany([
        { name: 'fixture1', factory: () => 1 },
        { name: 'fixture2', factory: () => 2 },
        { name: 'fixture3', factory: () => 3 },
      ]);

      expect(ids).toHaveLength(3);
      expect(registry.size).toBe(3);
    });

    it('should register with options', () => {
      registry.register('tagged', () => 'data', {
        lazy: false,
        ttl: 5000,
        tags: ['test', 'important'],
        singleton: true,
      });

      expect(registry.getByTag('test')).toContain('default:tagged');
      expect(registry.getByTag('important')).toContain('default:tagged');
    });

    it('should pre-load non-lazy fixtures', () => {
      registry.register('eager', () => 'eager-data', { lazy: false });

      expect(registry.isLoaded('eager')).toBe(true);
    });

    it('should not pre-load lazy fixtures', () => {
      registry.register('lazy', () => 'lazy-data', { lazy: true });

      expect(registry.isLoaded('lazy')).toBe(false);
    });
  });

  // ==========================================================================
  // Retrieval Tests
  // ==========================================================================

  describe('Retrieval', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
    });

    it('should get fixture by name', async () => {
      registry.register('myFixture', () => ({ value: 42 }));

      const fixture = await registry.get<{ value: number }>('myFixture');

      expect(fixture.data.value).toBe(42);
      expect(fixture.name).toBe('myFixture');
      expect(fixture.namespace).toBe('default');
    });

    it('should get fixture by full id', async () => {
      registry.register('custom:myFixture', () => 'custom-data');

      const fixture = await registry.get('custom:myFixture');

      expect(fixture.data).toBe('custom-data');
      expect(fixture.namespace).toBe('custom');
    });

    it('should throw for non-existent fixture', async () => {
      await expect(registry.get('nonexistent')).rejects.toThrow('Fixture not found');
    });

    it('should resolve async factories', async () => {
      registry.register('asyncFixture', async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { async: true };
      });

      const fixture = await registry.get<{ async: boolean }>('asyncFixture');

      expect(fixture.data.async).toBe(true);
    });

    it('should cache singleton fixtures', async () => {
      let callCount = 0;
      registry.register('singleton', () => {
        callCount++;
        return { count: callCount };
      });

      const first = await registry.get<{ count: number }>('singleton');
      const second = await registry.get<{ count: number }>('singleton');

      expect(first.data.count).toBe(1);
      expect(second.data.count).toBe(1);
      expect(callCount).toBe(1);
    });

    it('should not cache non-singleton fixtures', async () => {
      let callCount = 0;
      registry.register(
        'nonSingleton',
        () => {
          callCount++;
          return { count: callCount };
        },
        { singleton: false }
      );

      const first = await registry.get<{ count: number }>('nonSingleton');
      const second = await registry.get<{ count: number }>('nonSingleton');

      expect(first.data.count).toBe(1);
      expect(second.data.count).toBe(2);
      expect(callCount).toBe(2);
    });

    it('should return null for getSync on unloaded fixture', () => {
      registry.register('lazy', () => 'data', { lazy: true });

      const result = registry.getSync('lazy');

      expect(result).toBeNull();
    });

    it('should return fixture for getSync on loaded fixture', async () => {
      registry.register('preloaded', () => 'data', { lazy: false });

      const result = registry.getSync<string>('preloaded');

      expect(result).not.toBeNull();
      expect(result!.data).toBe('data');
    });
  });

  // ==========================================================================
  // TTL Tests
  // ==========================================================================

  describe('TTL (Time To Live)', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      vi.useFakeTimers();
      registry = FixtureRegistry.getInstance();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire fixtures after TTL', async () => {
      let callCount = 0;
      registry.register(
        'expiring',
        () => {
          callCount++;
          return { count: callCount };
        },
        { ttl: 1000, singleton: true }
      );

      const first = await registry.get<{ count: number }>('expiring');
      expect(first.data.count).toBe(1);

      // Advance time past TTL
      vi.advanceTimersByTime(1500);

      const second = await registry.get<{ count: number }>('expiring');
      expect(second.data.count).toBe(2);
      expect(callCount).toBe(2);
    });

    it('should not expire fixtures before TTL', async () => {
      let callCount = 0;
      registry.register(
        'notExpiring',
        () => {
          callCount++;
          return { count: callCount };
        },
        { ttl: 5000, singleton: true }
      );

      await registry.get('notExpiring');
      vi.advanceTimersByTime(2000);
      await registry.get('notExpiring');

      expect(callCount).toBe(1);
    });

    it('should not expire fixtures without TTL', async () => {
      let callCount = 0;
      registry.register('noTtl', () => {
        callCount++;
        return callCount;
      });

      await registry.get('noTtl');
      vi.advanceTimersByTime(100000);
      await registry.get('noTtl');

      expect(callCount).toBe(1);
    });
  });

  // ==========================================================================
  // Namespace Tests
  // ==========================================================================

  describe('Namespaces', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
    });

    it('should use default namespace', () => {
      expect(registry.getDefaultNamespace()).toBe('default');
    });

    it('should change default namespace', () => {
      registry.setDefaultNamespace('custom');
      expect(registry.getDefaultNamespace()).toBe('custom');

      const id = registry.register('fixture', () => 'data');
      expect(id).toBe('custom:fixture');
    });

    it('should track all namespaces', () => {
      registry.register('ns1:fixture1', () => 1);
      registry.register('ns2:fixture2', () => 2);
      registry.register('ns1:fixture3', () => 3);

      const namespaces = registry.getNamespaces();

      expect(namespaces).toContain('default');
      expect(namespaces).toContain('ns1');
      expect(namespaces).toContain('ns2');
    });

    it('should get fixtures by namespace', () => {
      registry.register('users:admin', () => 'admin');
      registry.register('users:guest', () => 'guest');
      registry.register('products:item1', () => 'item1');

      const userFixtures = registry.getByNamespace('users');

      expect(userFixtures).toHaveLength(2);
      expect(userFixtures).toContain('users:admin');
      expect(userFixtures).toContain('users:guest');
    });

    it('should clear specific namespace', () => {
      registry.register('ns1:a', () => 'a');
      registry.register('ns1:b', () => 'b');
      registry.register('ns2:c', () => 'c');

      const cleared = registry.clearNamespace('ns1');

      expect(cleared).toBe(2);
      expect(registry.has('ns1:a')).toBe(false);
      expect(registry.has('ns1:b')).toBe(false);
      expect(registry.has('ns2:c')).toBe(true);
    });
  });

  // ==========================================================================
  // Tag Tests
  // ==========================================================================

  describe('Tags', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
      registry.register('f1', () => 1, { tags: ['test', 'unit'] });
      registry.register('f2', () => 2, { tags: ['test', 'integration'] });
      registry.register('f3', () => 3, { tags: ['integration', 'slow'] });
      registry.register('f4', () => 4, { tags: [] });
    });

    it('should get fixtures by single tag', () => {
      const testFixtures = registry.getByTag('test');

      expect(testFixtures).toHaveLength(2);
      expect(testFixtures).toContain('default:f1');
      expect(testFixtures).toContain('default:f2');
    });

    it('should get fixtures by any of tags', () => {
      const fixtures = registry.getByTags(['unit', 'slow'], false);

      expect(fixtures).toHaveLength(2);
      expect(fixtures).toContain('default:f1');
      expect(fixtures).toContain('default:f3');
    });

    it('should get fixtures by all tags', () => {
      const fixtures = registry.getByTags(['test', 'integration'], true);

      expect(fixtures).toHaveLength(1);
      expect(fixtures).toContain('default:f2');
    });

    it('should return empty array for non-existent tag', () => {
      const fixtures = registry.getByTag('nonexistent');

      expect(fixtures).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('Cleanup', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
    });

    it('should unregister single fixture', async () => {
      registry.register('toRemove', () => 'data');
      await registry.get('toRemove'); // Load into cache

      const removed = registry.unregister('toRemove');

      expect(removed).toBe(true);
      expect(registry.has('toRemove')).toBe(false);
      expect(registry.getSync('toRemove')).toBeNull();
    });

    it('should return false for unregistering non-existent', () => {
      const removed = registry.unregister('nonexistent');

      expect(removed).toBe(false);
    });

    it('should clear cache only', async () => {
      registry.register('cached', () => 'data', { lazy: false });

      expect(registry.isLoaded('cached')).toBe(true);

      registry.clearCache();

      expect(registry.has('cached')).toBe(true);
      expect(registry.isLoaded('cached')).toBe(false);
    });

    it('should clear everything', () => {
      registry.register('f1', () => 1);
      registry.register('f2', () => 2);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.cachedSize).toBe(0);
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe('Statistics', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
    });

    it('should track registration count', () => {
      expect(registry.size).toBe(0);

      registry.register('f1', () => 1);
      registry.register('f2', () => 2);

      expect(registry.size).toBe(2);
    });

    it('should track cache count', async () => {
      expect(registry.cachedSize).toBe(0);

      registry.register('f1', () => 1);
      registry.register('f2', () => 2);
      await registry.get('f1');

      expect(registry.cachedSize).toBe(1);
    });

    it('should provide detailed stats', async () => {
      registry.register('ns1:f1', () => 1);
      registry.register('ns1:f2', () => 2);
      registry.register('ns2:f3', () => 3);
      await registry.get('ns1:f1');

      const stats = registry.getStats();

      expect(stats.registered).toBe(3);
      expect(stats.cached).toBe(1);
      expect(stats.namespaces).toBe(3); // default, ns1, ns2
      expect(stats.byNamespace['ns1']).toBe(2);
      expect(stats.byNamespace['ns2']).toBe(1);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
    });

    it('should handle fixture names with multiple colons', () => {
      registry.register('ns:sub:name', () => 'data');

      expect(registry.has('ns:sub:name')).toBe(true);
    });

    it('should handle factory errors', async () => {
      registry.register('failing', () => {
        throw new Error('Factory error');
      });

      await expect(registry.get('failing')).rejects.toThrow('Factory error');
    });

    it('should handle async factory errors', async () => {
      registry.register('asyncFailing', async () => {
        throw new Error('Async factory error');
      });

      await expect(registry.get('asyncFailing')).rejects.toThrow('Async factory error');
    });

    it('should handle empty fixture data', async () => {
      registry.register('empty', () => null);

      const fixture = await registry.get('empty');

      expect(fixture.data).toBeNull();
    });

    it('should handle undefined fixture data', async () => {
      registry.register('undefined', () => undefined);

      const fixture = await registry.get('undefined');

      expect(fixture.data).toBeUndefined();
    });

    it('should handle complex fixture data', async () => {
      const complexData = {
        nested: {
          array: [1, 2, { deep: true }],
          map: new Map([['key', 'value']]),
          set: new Set([1, 2, 3]),
        },
        date: new Date(),
        regexp: /test/i,
      };

      registry.register('complex', () => complexData);

      const fixture = await registry.get<typeof complexData>('complex');

      expect(fixture.data.nested.array[2]).toEqual({ deep: true });
      expect(fixture.data.nested.map.get('key')).toBe('value');
      expect(fixture.data.nested.set.has(2)).toBe(true);
    });
  });

  // ==========================================================================
  // Metadata Tests
  // ==========================================================================

  describe('Metadata', () => {
    let registry: FixtureRegistry;

    beforeEach(() => {
      registry = FixtureRegistry.getInstance();
    });

    it('should include creation timestamp', async () => {
      const before = new Date();
      registry.register('timestamped', () => 'data');

      const fixture = await registry.get('timestamped');
      const after = new Date();

      expect(fixture.metadata.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(fixture.metadata.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include TTL in metadata', async () => {
      registry.register('withTtl', () => 'data', { ttl: 5000 });

      const fixture = await registry.get('withTtl');

      expect(fixture.metadata.ttl).toBe(5000);
    });

    it('should include tags in metadata', async () => {
      registry.register('tagged', () => 'data', { tags: ['a', 'b', 'c'] });

      const fixture = await registry.get('tagged');

      expect(fixture.metadata.tags).toEqual(['a', 'b', 'c']);
    });

    it('should indicate lazy loading status', async () => {
      registry.register('lazy', () => 'lazy', { lazy: true });
      registry.register('eager', () => 'eager', { lazy: false });

      const lazyFixture = await registry.get('lazy');
      const eagerFixture = await registry.get('eager');

      expect(lazyFixture.metadata.lazy).toBe(true);
      expect(eagerFixture.metadata.lazy).toBe(false);
    });
  });
});
