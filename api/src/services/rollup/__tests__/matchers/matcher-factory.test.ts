/**
 * Matcher Factory Unit Tests
 * @module services/rollup/__tests__/matchers/matcher-factory.test
 *
 * Tests for MatcherFactory implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MatcherFactory,
  createMatcherFactory,
  getDefaultMatcherFactory,
  resetDefaultMatcherFactory,
} from '../../matchers/matcher-factory.js';
import { ArnMatcher } from '../../matchers/arn-matcher.js';
import { ResourceIdMatcher } from '../../matchers/resource-id-matcher.js';
import { NameMatcher } from '../../matchers/name-matcher.js';
import { TagMatcher } from '../../matchers/tag-matcher.js';
import {
  createArnMatcherConfig,
  createResourceIdMatcherConfig,
  createNameMatcherConfig,
  createTagMatcherConfig,
} from '../fixtures/rollup-fixtures.js';
import type { MatcherConfig, MatchingStrategy } from '../../../../types/rollup.js';
import type { IMatcher } from '../../interfaces.js';

describe('MatcherFactory', () => {
  let factory: MatcherFactory;

  beforeEach(() => {
    factory = new MatcherFactory({ enableCaching: false });
  });

  afterEach(() => {
    resetDefaultMatcherFactory();
  });

  describe('createMatcher', () => {
    it('should create ArnMatcher for arn type', () => {
      const config = createArnMatcherConfig();
      const matcher = factory.createMatcher(config);

      expect(matcher).toBeInstanceOf(ArnMatcher);
      expect(matcher.strategy).toBe('arn');
    });

    it('should create ResourceIdMatcher for resource_id type', () => {
      const config = createResourceIdMatcherConfig();
      const matcher = factory.createMatcher(config);

      expect(matcher).toBeInstanceOf(ResourceIdMatcher);
      expect(matcher.strategy).toBe('resource_id');
    });

    it('should create NameMatcher for name type', () => {
      const config = createNameMatcherConfig();
      const matcher = factory.createMatcher(config);

      expect(matcher).toBeInstanceOf(NameMatcher);
      expect(matcher.strategy).toBe('name');
    });

    it('should create TagMatcher for tag type', () => {
      const config = createTagMatcherConfig();
      const matcher = factory.createMatcher(config);

      expect(matcher).toBeInstanceOf(TagMatcher);
      expect(matcher.strategy).toBe('tag');
    });

    it('should throw for unknown matcher type', () => {
      const invalidConfig = {
        type: 'unknown',
        enabled: true,
        priority: 50,
        minConfidence: 80,
      } as any;

      expect(() => factory.createMatcher(invalidConfig)).toThrow('Unknown matcher type');
    });

    it('should throw for invalid configuration', () => {
      const invalidConfig = createArnMatcherConfig({ pattern: '' }); // Empty pattern

      expect(() => factory.createMatcher(invalidConfig)).toThrow('Invalid matcher configuration');
    });

    it('should validate configuration before returning matcher', () => {
      const invalidConfig = createArnMatcherConfig({
        priority: 150, // Invalid priority
      });

      expect(() => factory.createMatcher(invalidConfig)).toThrow('Invalid matcher configuration');
    });
  });

  describe('createMatchers', () => {
    it('should create all matchers from array', () => {
      const configs: MatcherConfig[] = [
        createArnMatcherConfig(),
        createNameMatcherConfig(),
        createTagMatcherConfig(),
      ];

      const matchers = factory.createMatchers(configs);

      expect(matchers).toHaveLength(3);
    });

    it('should filter out disabled matchers', () => {
      const configs: MatcherConfig[] = [
        createArnMatcherConfig({ enabled: true }),
        createNameMatcherConfig({ enabled: false }),
        createTagMatcherConfig({ enabled: true }),
      ];

      const matchers = factory.createMatchers(configs);

      expect(matchers).toHaveLength(2);
      expect(matchers.every((m) => m.isEnabled())).toBe(true);
    });

    it('should sort matchers by priority (highest first)', () => {
      const configs: MatcherConfig[] = [
        createArnMatcherConfig({ priority: 50 }),
        createNameMatcherConfig({ priority: 90 }),
        createTagMatcherConfig({ priority: 70 }),
      ];

      const matchers = factory.createMatchers(configs);

      expect(matchers[0].getPriority()).toBe(90);
      expect(matchers[1].getPriority()).toBe(70);
      expect(matchers[2].getPriority()).toBe(50);
    });

    it('should return empty array for empty configs', () => {
      const matchers = factory.createMatchers([]);

      expect(matchers).toHaveLength(0);
    });

    it('should return empty array when all disabled', () => {
      const configs: MatcherConfig[] = [
        createArnMatcherConfig({ enabled: false }),
        createNameMatcherConfig({ enabled: false }),
      ];

      const matchers = factory.createMatchers(configs);

      expect(matchers).toHaveLength(0);
    });
  });

  describe('getAvailableTypes', () => {
    it('should return built-in matcher types', () => {
      const types = factory.getAvailableTypes();

      expect(types).toContain('arn');
      expect(types).toContain('resource_id');
      expect(types).toContain('name');
      expect(types).toContain('tag');
    });

    it('should include custom registered types', () => {
      const customStrategy = 'custom' as MatchingStrategy;
      factory.registerMatcher({
        strategy: customStrategy,
        factory: (config) => ({
          strategy: customStrategy,
          config,
          extractCandidates: vi.fn().mockReturnValue([]),
          compare: vi.fn().mockReturnValue(null),
          validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
          isEnabled: vi.fn().mockReturnValue(true),
          getPriority: vi.fn().mockReturnValue(50),
        }),
      });

      const types = factory.getAvailableTypes();

      expect(types).toContain(customStrategy);
    });
  });

  describe('registerMatcher', () => {
    it('should register custom matcher type', () => {
      const customStrategy = 'custom' as MatchingStrategy;
      const customFactory = vi.fn().mockReturnValue({
        strategy: customStrategy,
        config: {},
        extractCandidates: vi.fn(),
        compare: vi.fn(),
        validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        isEnabled: vi.fn().mockReturnValue(true),
        getPriority: vi.fn().mockReturnValue(50),
      });

      factory.registerMatcher({
        strategy: customStrategy,
        factory: customFactory,
      });

      expect(factory.getAvailableTypes()).toContain(customStrategy);
    });

    it('should use custom factory when creating matcher', () => {
      const customStrategy = 'custom' as MatchingStrategy;
      const mockMatcher: IMatcher = {
        strategy: customStrategy,
        config: { type: customStrategy, enabled: true, priority: 50, minConfidence: 80 },
        extractCandidates: vi.fn().mockReturnValue([]),
        compare: vi.fn().mockReturnValue(null),
        validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        isEnabled: vi.fn().mockReturnValue(true),
        getPriority: vi.fn().mockReturnValue(50),
      };
      const customFactory = vi.fn().mockReturnValue(mockMatcher);

      factory.registerMatcher({
        strategy: customStrategy,
        factory: customFactory,
      });

      const config = { type: customStrategy, enabled: true, priority: 50, minConfidence: 80 } as any;
      const matcher = factory.createMatcher(config);

      expect(customFactory).toHaveBeenCalledWith(config);
      expect(matcher).toBe(mockMatcher);
    });
  });

  describe('unregisterMatcher', () => {
    it('should remove registered custom matcher', () => {
      const customStrategy = 'custom' as MatchingStrategy;
      factory.registerMatcher({
        strategy: customStrategy,
        factory: vi.fn().mockReturnValue({
          strategy: customStrategy,
          config: {},
          extractCandidates: vi.fn(),
          compare: vi.fn(),
          validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
          isEnabled: vi.fn(),
          getPriority: vi.fn(),
        }),
      });

      expect(factory.getAvailableTypes()).toContain(customStrategy);

      factory.unregisterMatcher(customStrategy);

      expect(factory.getAvailableTypes()).not.toContain(customStrategy);
    });
  });

  describe('isSupported', () => {
    it('should return true for built-in types', () => {
      expect(factory.isSupported('arn')).toBe(true);
      expect(factory.isSupported('resource_id')).toBe(true);
      expect(factory.isSupported('name')).toBe(true);
      expect(factory.isSupported('tag')).toBe(true);
    });

    it('should return false for unknown types', () => {
      expect(factory.isSupported('unknown' as MatchingStrategy)).toBe(false);
    });

    it('should return true for registered custom types', () => {
      const customStrategy = 'custom' as MatchingStrategy;
      factory.registerMatcher({
        strategy: customStrategy,
        factory: vi.fn().mockReturnValue({
          strategy: customStrategy,
          config: {},
          extractCandidates: vi.fn(),
          compare: vi.fn(),
          validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
          isEnabled: vi.fn(),
          getPriority: vi.fn(),
        }),
      });

      expect(factory.isSupported(customStrategy)).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid config without creating matcher', () => {
      const config = createArnMatcherConfig();

      const result = factory.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid config', () => {
      const config = createArnMatcherConfig({ pattern: '' });

      const result = factory.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for unknown type', () => {
      const config = { type: 'unknown', enabled: true } as any;

      const result = factory.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown'))).toBe(true);
    });

    it('should return warnings', () => {
      const config = createArnMatcherConfig({
        pattern: 'arn:aws:*:*:*:*', // Broad pattern
      });

      const result = factory.validateConfig(config);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('caching', () => {
    it('should cache matchers when caching is enabled', () => {
      const cachingFactory = new MatcherFactory({ enableCaching: true });
      const config = createArnMatcherConfig();

      const matcher1 = cachingFactory.createMatcher(config);
      const matcher2 = cachingFactory.createMatcher(config);

      expect(matcher1).toBe(matcher2);
      expect(cachingFactory.getCacheSize()).toBe(1);
    });

    it('should not cache when caching is disabled', () => {
      const noCacheFactory = new MatcherFactory({ enableCaching: false });
      const config = createArnMatcherConfig();

      const matcher1 = noCacheFactory.createMatcher(config);
      const matcher2 = noCacheFactory.createMatcher(config);

      expect(matcher1).not.toBe(matcher2);
      expect(noCacheFactory.getCacheSize()).toBe(0);
    });

    it('should cache different configs separately', () => {
      const cachingFactory = new MatcherFactory({ enableCaching: true });
      const config1 = createArnMatcherConfig({ pattern: 'arn:aws:s3:::*' });
      const config2 = createArnMatcherConfig({ pattern: 'arn:aws:ec2:*:*:*' });

      const matcher1 = cachingFactory.createMatcher(config1);
      const matcher2 = cachingFactory.createMatcher(config2);

      expect(matcher1).not.toBe(matcher2);
      expect(cachingFactory.getCacheSize()).toBe(2);
    });

    it('should clear cache', () => {
      const cachingFactory = new MatcherFactory({ enableCaching: true });
      const config = createArnMatcherConfig();

      cachingFactory.createMatcher(config);
      expect(cachingFactory.getCacheSize()).toBe(1);

      cachingFactory.clearCache();
      expect(cachingFactory.getCacheSize()).toBe(0);
    });
  });
});

describe('createMatcherFactory', () => {
  it('should create new factory instance', () => {
    const factory = createMatcherFactory();

    expect(factory).toBeInstanceOf(MatcherFactory);
  });

  it('should accept options', () => {
    const factory = createMatcherFactory({ enableCaching: false });
    const config = createArnMatcherConfig();

    factory.createMatcher(config);
    factory.createMatcher(config);

    expect(factory.getCacheSize()).toBe(0);
  });
});

describe('getDefaultMatcherFactory', () => {
  afterEach(() => {
    resetDefaultMatcherFactory();
  });

  it('should return singleton instance', () => {
    const factory1 = getDefaultMatcherFactory();
    const factory2 = getDefaultMatcherFactory();

    expect(factory1).toBe(factory2);
  });

  it('should have caching enabled by default', () => {
    const factory = getDefaultMatcherFactory();
    const config = createArnMatcherConfig();

    factory.createMatcher(config);
    factory.createMatcher(config);

    expect(factory.getCacheSize()).toBe(1);
  });
});

describe('resetDefaultMatcherFactory', () => {
  it('should reset singleton instance', () => {
    const factory1 = getDefaultMatcherFactory();
    const config = createArnMatcherConfig();
    factory1.createMatcher(config);

    resetDefaultMatcherFactory();

    const factory2 = getDefaultMatcherFactory();
    expect(factory1).not.toBe(factory2);
    expect(factory2.getCacheSize()).toBe(0);
  });
});
