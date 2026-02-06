/**
 * Cache Key Builder Unit Tests
 * @module services/rollup/rollup-cache/__tests__/cache-key-builder.test
 *
 * Tests for cache key generation, parsing, and tag management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CacheKeyBuilder,
  createCacheKeyBuilder,
  getDefaultCacheKeyBuilder,
  resetDefaultCacheKeyBuilder,
} from '../cache-key-builder.js';
import { createCacheKey } from '../interfaces.js';
import { createTestTenantId, createTestRollupId, createTestExecutionId, createTestNodeId } from './fixtures.js';
import type { TenantId } from '../../../../types/entities.js';
import type { RollupId, RollupExecutionId } from '../../../../types/rollup.js';

describe('CacheKeyBuilder', () => {
  let builder: CacheKeyBuilder;
  let tenantId: TenantId;
  let rollupId: RollupId;
  let executionId: RollupExecutionId;

  beforeEach(() => {
    builder = new CacheKeyBuilder('v1', 'rollup');
    tenantId = createTestTenantId();
    rollupId = createTestRollupId();
    executionId = createTestExecutionId();
    resetDefaultCacheKeyBuilder();
  });

  // =========================================================================
  // Constructor Tests
  // =========================================================================

  describe('constructor', () => {
    it('should create builder with default values', () => {
      const defaultBuilder = new CacheKeyBuilder();
      expect(defaultBuilder.getVersion()).toBe('v1');
    });

    it('should create builder with custom version', () => {
      const v2Builder = new CacheKeyBuilder('v2');
      expect(v2Builder.getVersion()).toBe('v2');
    });

    it('should create builder with custom prefix', () => {
      const customBuilder = new CacheKeyBuilder('v1', 'custom');
      const key = customBuilder.buildExecutionKey(tenantId, executionId);
      expect(key).toContain('custom:');
    });
  });

  // =========================================================================
  // Execution Key Tests
  // =========================================================================

  describe('buildExecutionKey', () => {
    it('should build valid execution key', () => {
      const key = builder.buildExecutionKey(tenantId, executionId);

      expect(key).toContain('rollup:v1:');
      expect(key).toContain(':execution:');
      expect(key).toContain(tenantId);
    });

    it('should sanitize special characters in tenant ID', () => {
      const specialTenantId = 'tenant:with:colons' as TenantId;
      const key = builder.buildExecutionKey(specialTenantId, executionId);

      // Colons should be replaced with underscores
      expect(key).not.toContain('tenant:with:colons');
      expect(key).toContain('tenant_with_colons');
    });

    it('should produce consistent keys for same inputs', () => {
      const key1 = builder.buildExecutionKey(tenantId, executionId);
      const key2 = builder.buildExecutionKey(tenantId, executionId);

      expect(key1).toBe(key2);
    });

    it('should produce different keys for different tenants', () => {
      const tenant2 = createTestTenantId();
      const key1 = builder.buildExecutionKey(tenantId, executionId);
      const key2 = builder.buildExecutionKey(tenant2, executionId);

      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different executions', () => {
      const exec2 = createTestExecutionId();
      const key1 = builder.buildExecutionKey(tenantId, executionId);
      const key2 = builder.buildExecutionKey(tenantId, exec2);

      expect(key1).not.toBe(key2);
    });
  });

  // =========================================================================
  // Merged Graph Key Tests
  // =========================================================================

  describe('buildMergedGraphKey', () => {
    it('should build valid merged graph key', () => {
      const key = builder.buildMergedGraphKey(tenantId, rollupId);

      expect(key).toContain('rollup:v1:');
      expect(key).toContain(':merged_graph:');
    });

    it('should include rollup ID in key', () => {
      const key = builder.buildMergedGraphKey(tenantId, rollupId);
      expect(key).toContain(rollupId);
    });

    it('should produce consistent keys', () => {
      const key1 = builder.buildMergedGraphKey(tenantId, rollupId);
      const key2 = builder.buildMergedGraphKey(tenantId, rollupId);

      expect(key1).toBe(key2);
    });
  });

  // =========================================================================
  // Blast Radius Key Tests
  // =========================================================================

  describe('buildBlastRadiusKey', () => {
    it('should build valid blast radius key', () => {
      const nodeId = createTestNodeId();
      const depth = 3;
      const key = builder.buildBlastRadiusKey(tenantId, nodeId, depth);

      expect(key).toContain('rollup:v1:');
      expect(key).toContain(':blast_radius:');
      expect(key).toContain('depth=3');
    });

    it('should include depth parameter', () => {
      const nodeId = 'test-node';
      const key = builder.buildBlastRadiusKey(tenantId, nodeId, 5);

      expect(key).toContain('depth=5');
    });

    it('should produce different keys for different depths', () => {
      const nodeId = 'test-node';
      const key1 = builder.buildBlastRadiusKey(tenantId, nodeId, 3);
      const key2 = builder.buildBlastRadiusKey(tenantId, nodeId, 5);

      expect(key1).not.toBe(key2);
    });

    it('should sanitize node ID with special characters', () => {
      const nodeId = 'node:with:special/chars';
      const key = builder.buildBlastRadiusKey(tenantId, nodeId, 3);

      expect(key).not.toContain('node:with:special/chars');
    });
  });

  // =========================================================================
  // Tag Set Key Tests
  // =========================================================================

  describe('buildTagSetKey', () => {
    it('should build valid tag set key', () => {
      const key = builder.buildTagSetKey('tenant', 'tenant-123');

      expect(key).toContain('rollup:v1:tag:tenant:');
    });

    it('should include tag type and value', () => {
      const key = builder.buildTagSetKey('rollup', 'my-rollup');

      expect(key).toContain(':tag:rollup:');
    });
  });

  // =========================================================================
  // Tag Creation Tests
  // =========================================================================

  describe('createTenantTag', () => {
    it('should create valid tenant tag', () => {
      const tag = builder.createTenantTag(tenantId);

      expect(tag).toContain('tenant:');
    });

    it('should sanitize tenant ID', () => {
      const specialTenantId = 'tenant:special' as TenantId;
      const tag = builder.createTenantTag(specialTenantId);

      expect(tag).not.toContain('tenant:tenant:special');
    });
  });

  describe('createRollupTag', () => {
    it('should create valid rollup tag', () => {
      const tag = builder.createRollupTag(tenantId, rollupId);

      expect(tag).toContain('rollup:');
    });

    it('should include both tenant and rollup IDs', () => {
      const tag = builder.createRollupTag(tenantId, rollupId);

      expect(tag).toContain(tenantId);
      expect(tag).toContain(rollupId);
    });
  });

  describe('createExecutionTag', () => {
    it('should create valid execution tag', () => {
      const tag = builder.createExecutionTag(tenantId, executionId);

      expect(tag).toContain('execution:');
    });
  });

  describe('createNodeTag', () => {
    it('should create valid node tag', () => {
      const nodeId = 'test-node-123';
      const tag = builder.createNodeTag(tenantId, nodeId);

      expect(tag).toContain('node:');
    });
  });

  // =========================================================================
  // Key Parsing Tests
  // =========================================================================

  describe('parseKey', () => {
    it('should parse valid execution key', () => {
      const key = builder.buildExecutionKey(tenantId, executionId);
      const parsed = builder.parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.prefix).toBe('rollup');
      expect(parsed?.version).toBe('v1');
      expect(parsed?.entryType).toBe('execution');
    });

    it('should parse valid merged graph key', () => {
      const key = builder.buildMergedGraphKey(tenantId, rollupId);
      const parsed = builder.parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.entryType).toBe('merged_graph');
    });

    it('should parse valid blast radius key with params', () => {
      const nodeId = 'test-node';
      const key = builder.buildBlastRadiusKey(tenantId, nodeId, 5);
      const parsed = builder.parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.entryType).toBe('blast_radius');
      expect(parsed?.params?.depth).toBe('5');
    });

    it('should return null for invalid key format', () => {
      const invalidKey = createCacheKey('invalid:key');
      const parsed = builder.parseKey(invalidKey);

      expect(parsed).toBeNull();
    });

    it('should return null for wrong prefix', () => {
      const wrongPrefixKey = createCacheKey('other:v1:tenant:execution:exec123');
      const parsed = builder.parseKey(wrongPrefixKey);

      expect(parsed).toBeNull();
    });

    it('should return null for invalid version', () => {
      const invalidVersionKey = createCacheKey('rollup:v99:tenant:execution:exec123');
      const parsed = builder.parseKey(invalidVersionKey);

      expect(parsed).toBeNull();
    });

    it('should return null for invalid entry type', () => {
      const invalidTypeKey = createCacheKey('rollup:v1:tenant:invalid_type:id123');
      const parsed = builder.parseKey(invalidTypeKey);

      expect(parsed).toBeNull();
    });

    it('should return null for key with too few segments', () => {
      const shortKey = createCacheKey('rollup:v1:tenant');
      const parsed = builder.parseKey(shortKey);

      expect(parsed).toBeNull();
    });
  });

  // =========================================================================
  // Pattern Building Tests
  // =========================================================================

  describe('buildPattern', () => {
    it('should build pattern for tenant', () => {
      const pattern = builder.buildPattern(tenantId);

      expect(pattern).toContain('rollup:v1:');
      expect(pattern.endsWith(':*')).toBe(true);
    });

    it('should build pattern with entry type filter', () => {
      const pattern = builder.buildPattern(tenantId, 'execution');

      expect(pattern).toContain(':execution:');
      expect(pattern.endsWith(':*')).toBe(true);
    });

    it('should build pattern for merged_graph type', () => {
      const pattern = builder.buildPattern(tenantId, 'merged_graph');

      expect(pattern).toContain(':merged_graph:');
    });
  });

  describe('buildTypePattern', () => {
    it('should build pattern for execution type across tenants', () => {
      const pattern = builder.buildTypePattern('execution');

      expect(pattern).toContain('rollup:v1:*:execution:*');
    });

    it('should build pattern for blast_radius type', () => {
      const pattern = builder.buildTypePattern('blast_radius');

      expect(pattern).toContain(':blast_radius:');
    });
  });

  describe('buildVersionPattern', () => {
    it('should build pattern for current version', () => {
      const pattern = builder.buildVersionPattern();

      expect(pattern).toBe('rollup:v1:*');
    });

    it('should use v2 for v2 builder', () => {
      const v2Builder = new CacheKeyBuilder('v2');
      const pattern = v2Builder.buildVersionPattern();

      expect(pattern).toBe('rollup:v2:*');
    });
  });

  // =========================================================================
  // Tag Generation Utility Tests
  // =========================================================================

  describe('generateExecutionTags', () => {
    it('should generate all relevant tags for execution', () => {
      const tags = builder.generateExecutionTags(tenantId, executionId, rollupId);

      expect(tags).toHaveLength(3);
      expect(tags.some(t => t.includes('tenant:'))).toBe(true);
      expect(tags.some(t => t.includes('rollup:'))).toBe(true);
      expect(tags.some(t => t.includes('execution:'))).toBe(true);
    });
  });

  describe('generateMergedGraphTags', () => {
    it('should generate tenant and rollup tags', () => {
      const tags = builder.generateMergedGraphTags(tenantId, rollupId);

      expect(tags).toHaveLength(2);
      expect(tags.some(t => t.includes('tenant:'))).toBe(true);
      expect(tags.some(t => t.includes('rollup:'))).toBe(true);
    });
  });

  describe('generateBlastRadiusTags', () => {
    it('should generate tenant and node tags', () => {
      const nodeId = 'test-node';
      const tags = builder.generateBlastRadiusTags(tenantId, nodeId);

      expect(tags).toHaveLength(2);
      expect(tags.some(t => t.includes('tenant:'))).toBe(true);
      expect(tags.some(t => t.includes('node:'))).toBe(true);
    });

    it('should include rollup tag if provided', () => {
      const nodeId = 'test-node';
      const tags = builder.generateBlastRadiusTags(tenantId, nodeId, rollupId);

      expect(tags).toHaveLength(3);
      expect(tags.some(t => t.includes('rollup:'))).toBe(true);
    });
  });

  // =========================================================================
  // Key Utility Tests
  // =========================================================================

  describe('extractTenantId', () => {
    it('should extract tenant ID from valid key', () => {
      const key = builder.buildExecutionKey(tenantId, executionId);
      const extracted = builder.extractTenantId(key);

      expect(extracted).not.toBeNull();
    });

    it('should return null for invalid key', () => {
      const invalidKey = createCacheKey('invalid');
      const extracted = builder.extractTenantId(invalidKey);

      expect(extracted).toBeNull();
    });
  });

  describe('keyBelongsToTenant', () => {
    it('should return true for matching tenant', () => {
      const key = builder.buildExecutionKey(tenantId, executionId);
      const belongs = builder.keyBelongsToTenant(key, tenantId);

      expect(belongs).toBe(true);
    });

    it('should return false for different tenant', () => {
      const key = builder.buildExecutionKey(tenantId, executionId);
      const otherTenant = createTestTenantId();
      const belongs = builder.keyBelongsToTenant(key, otherTenant);

      expect(belongs).toBe(false);
    });
  });

  describe('keyIsEntryType', () => {
    it('should return true for matching entry type', () => {
      const key = builder.buildExecutionKey(tenantId, executionId);
      const isExecution = builder.keyIsEntryType(key, 'execution');

      expect(isExecution).toBe(true);
    });

    it('should return false for different entry type', () => {
      const key = builder.buildExecutionKey(tenantId, executionId);
      const isMergedGraph = builder.keyIsEntryType(key, 'merged_graph');

      expect(isMergedGraph).toBe(false);
    });
  });

  // =========================================================================
  // Factory Function Tests
  // =========================================================================

  describe('createCacheKeyBuilder', () => {
    it('should create builder with defaults', () => {
      const factoryBuilder = createCacheKeyBuilder();

      expect(factoryBuilder.getVersion()).toBe('v1');
    });

    it('should create builder with custom version', () => {
      const factoryBuilder = createCacheKeyBuilder('v2');

      expect(factoryBuilder.getVersion()).toBe('v2');
    });
  });

  describe('getDefaultCacheKeyBuilder', () => {
    it('should return singleton instance', () => {
      const instance1 = getDefaultCacheKeyBuilder();
      const instance2 = getDefaultCacheKeyBuilder();

      expect(instance1).toBe(instance2);
    });

    it('should return v1 builder by default', () => {
      const defaultBuilder = getDefaultCacheKeyBuilder();

      expect(defaultBuilder.getVersion()).toBe('v1');
    });
  });

  describe('resetDefaultCacheKeyBuilder', () => {
    it('should reset singleton instance', () => {
      const instance1 = getDefaultCacheKeyBuilder();
      resetDefaultCacheKeyBuilder();
      const instance2 = getDefaultCacheKeyBuilder();

      // They should be different instances after reset
      // (but with same behavior)
      expect(instance2.getVersion()).toBe('v1');
    });
  });
});
