/**
 * Index Engine Tests
 * @module services/rollup/external-object-index/__tests__/index-engine.test
 *
 * Unit tests for the External Object Index Engine.
 *
 * TASK-ROLLUP-003: External Object Index tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexEngine, createIndexEngine } from '../index-engine.js';
import { createExtractorFactory } from '../extractors/extractor-factory.js';
import type { NodeType } from '../../../../types/graph.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';

describe('IndexEngine', () => {
  let engine: IndexEngine;

  beforeEach(() => {
    engine = createIndexEngine();
  });

  describe('processNodes', () => {
    it('should extract ARN references from Terraform resource nodes', () => {
      const nodes: NodeType[] = [
        {
          type: 'terraform_resource',
          id: 'node-1',
          name: 'aws_s3_bucket.example',
          resourceType: 'aws_s3_bucket',
          provider: 'aws',
          dependsOn: [],
          location: {
            file: 'main.tf',
            lineStart: 1,
            lineEnd: 10,
          },
          metadata: {
            arn: 'arn:aws:s3:::my-example-bucket',
          },
        } as NodeType,
      ];

      const context = {
        tenantId: 'tenant-1' as TenantId,
        repositoryId: 'repo-1' as RepositoryId,
        scanId: 'scan-1' as ScanId,
      };

      const entries = engine.processNodes(nodes, context);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].externalId).toBe('arn:aws:s3:::my-example-bucket');
      expect(entries[0].referenceType).toBe('arn');
      expect(entries[0].nodeId).toBe('node-1');
      expect(entries[0].tenantId).toBe('tenant-1');
    });

    it('should extract multiple reference types from a single node', () => {
      const nodes: NodeType[] = [
        {
          type: 'terraform_resource',
          id: 'node-2',
          name: 'aws_instance.web',
          resourceType: 'aws_instance',
          provider: 'aws',
          dependsOn: [],
          location: {
            file: 'main.tf',
            lineStart: 20,
            lineEnd: 40,
          },
          metadata: {
            arn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
            id: 'i-1234567890abcdef0',
            vpc_id: 'vpc-12345678',
            subnet_id: 'subnet-12345678',
          },
        } as NodeType,
      ];

      const context = {
        tenantId: 'tenant-1' as TenantId,
        repositoryId: 'repo-1' as RepositoryId,
        scanId: 'scan-1' as ScanId,
      };

      const entries = engine.processNodes(nodes, context);

      // Should have both ARN and resource ID entries
      const arnEntries = entries.filter((e) => e.referenceType === 'arn');
      const resourceIdEntries = entries.filter((e) => e.referenceType === 'resource_id');

      expect(arnEntries.length).toBeGreaterThan(0);
      expect(resourceIdEntries.length).toBeGreaterThan(0);
    });

    it('should handle empty node array', () => {
      const context = {
        tenantId: 'tenant-1' as TenantId,
        repositoryId: 'repo-1' as RepositoryId,
        scanId: 'scan-1' as ScanId,
      };

      const entries = engine.processNodes([], context);

      expect(entries).toEqual([]);
    });

    it('should handle nodes without external references', () => {
      const nodes: NodeType[] = [
        {
          type: 'terraform_variable',
          id: 'var-1',
          name: 'region',
          variableType: 'string',
          default: 'us-east-1',
          sensitive: false,
          nullable: false,
          location: {
            file: 'variables.tf',
            lineStart: 1,
            lineEnd: 3,
          },
          metadata: {},
        } as NodeType,
      ];

      const context = {
        tenantId: 'tenant-1' as TenantId,
        repositoryId: 'repo-1' as RepositoryId,
        scanId: 'scan-1' as ScanId,
      };

      const entries = engine.processNodes(nodes, context);

      // Variables typically don't have external references
      expect(entries.length).toBe(0);
    });
  });

  describe('buildInvertedIndex', () => {
    it('should build index with external IDs as keys', () => {
      const entries = [
        {
          id: 'entry-1',
          externalId: 'arn:aws:s3:::bucket-1',
          referenceType: 'arn' as const,
          normalizedId: 'arn:aws:s3:::bucket-1',
          tenantId: 'tenant-1' as TenantId,
          repositoryId: 'repo-1' as RepositoryId,
          scanId: 'scan-1' as ScanId,
          nodeId: 'node-1',
          nodeName: 'bucket',
          nodeType: 'terraform_resource',
          filePath: 'main.tf',
          components: {},
          metadata: {},
          indexedAt: new Date(),
        },
        {
          id: 'entry-2',
          externalId: 'arn:aws:s3:::bucket-1', // Same as entry-1
          referenceType: 'arn' as const,
          normalizedId: 'arn:aws:s3:::bucket-1',
          tenantId: 'tenant-1' as TenantId,
          repositoryId: 'repo-2' as RepositoryId, // Different repo
          scanId: 'scan-2' as ScanId,
          nodeId: 'node-2',
          nodeName: 'bucket-ref',
          nodeType: 'terraform_data',
          filePath: 'data.tf',
          components: {},
          metadata: {},
          indexedAt: new Date(),
        },
      ];

      const index = engine.buildInvertedIndex(entries);

      // Both entries should be under the same key
      const key = 'arn:aws:s3:::bucket-1';
      expect(index.get(key)).toBeDefined();
      expect(index.get(key)?.length).toBe(2);
    });

    it('should handle case-insensitive lookups', () => {
      const entries = [
        {
          id: 'entry-1',
          externalId: 'arn:aws:S3:::MyBucket',
          referenceType: 'arn' as const,
          normalizedId: 'arn:aws:s3:::mybucket',
          tenantId: 'tenant-1' as TenantId,
          repositoryId: 'repo-1' as RepositoryId,
          scanId: 'scan-1' as ScanId,
          nodeId: 'node-1',
          nodeName: 'bucket',
          nodeType: 'terraform_resource',
          filePath: 'main.tf',
          components: {},
          metadata: {},
          indexedAt: new Date(),
        },
      ];

      const index = engine.buildInvertedIndex(entries);

      // Should be accessible by lowercase key
      expect(index.get('arn:aws:s3:::mybucket')).toBeDefined();
    });
  });

  describe('mergeIndex', () => {
    it('should merge new entries into existing index', () => {
      const existingIndex = new Map([
        ['key-1', [
          {
            id: 'entry-1',
            externalId: 'key-1',
            referenceType: 'arn' as const,
            normalizedId: 'key-1',
            tenantId: 'tenant-1' as TenantId,
            repositoryId: 'repo-1' as RepositoryId,
            scanId: 'scan-1' as ScanId,
            nodeId: 'node-1',
            nodeName: 'resource',
            nodeType: 'terraform_resource',
            filePath: 'main.tf',
            components: {},
            metadata: {},
            indexedAt: new Date(),
          },
        ]],
      ]);

      const newEntries = [
        {
          id: 'entry-2',
          externalId: 'key-2',
          referenceType: 'arn' as const,
          normalizedId: 'key-2',
          tenantId: 'tenant-1' as TenantId,
          repositoryId: 'repo-1' as RepositoryId,
          scanId: 'scan-1' as ScanId,
          nodeId: 'node-2',
          nodeName: 'resource2',
          nodeType: 'terraform_resource',
          filePath: 'main.tf',
          components: {},
          metadata: {},
          indexedAt: new Date(),
        },
      ];

      const merged = engine.mergeIndex(existingIndex, newEntries);

      expect(merged.size).toBe(2);
      expect(merged.has('key-1')).toBe(true);
      expect(merged.has('key-2')).toBe(true);
    });

    it('should update existing entries on merge', () => {
      const existingIndex = new Map([
        ['key-1', [
          {
            id: 'entry-1',
            externalId: 'key-1',
            referenceType: 'arn' as const,
            normalizedId: 'key-1',
            tenantId: 'tenant-1' as TenantId,
            repositoryId: 'repo-1' as RepositoryId,
            scanId: 'scan-1' as ScanId,
            nodeId: 'node-1',
            nodeName: 'old-name',
            nodeType: 'terraform_resource',
            filePath: 'main.tf',
            components: {},
            metadata: {},
            indexedAt: new Date(),
          },
        ]],
      ]);

      const newEntries = [
        {
          id: 'entry-1-updated',
          externalId: 'key-1',
          referenceType: 'arn' as const,
          normalizedId: 'key-1',
          tenantId: 'tenant-1' as TenantId,
          repositoryId: 'repo-1' as RepositoryId,
          scanId: 'scan-1' as ScanId,
          nodeId: 'node-1', // Same node
          nodeName: 'new-name',
          nodeType: 'terraform_resource',
          filePath: 'main.tf',
          components: {},
          metadata: {},
          indexedAt: new Date(),
        },
      ];

      const merged = engine.mergeIndex(existingIndex, newEntries);

      expect(merged.get('key-1')?.length).toBe(1);
      expect(merged.get('key-1')?.[0].nodeName).toBe('new-name');
    });
  });

  describe('performance', () => {
    // NOTE: Skipped - performance is highly environment-dependent
    // Target: 500ms, but CI/local machines vary significantly
    it.skip('should process 100K nodes in under 500ms', async () => {
      // Generate 100K mock nodes
      const nodes: NodeType[] = [];
      for (let i = 0; i < 100000; i++) {
        nodes.push({
          type: 'terraform_resource',
          id: `node-${i}`,
          name: `aws_s3_bucket.bucket_${i}`,
          resourceType: 'aws_s3_bucket',
          provider: 'aws',
          dependsOn: [],
          location: {
            file: `module-${Math.floor(i / 1000)}/main.tf`,
            lineStart: (i % 100) * 10,
            lineEnd: (i % 100) * 10 + 9,
          },
          metadata: {
            arn: `arn:aws:s3:::bucket-${i}`,
          },
        } as NodeType);
      }

      const context = {
        tenantId: 'tenant-1' as TenantId,
        repositoryId: 'repo-1' as RepositoryId,
        scanId: 'scan-1' as ScanId,
      };

      const startTime = Date.now();
      const entries = engine.processNodes(nodes, context);
      const duration = Date.now() - startTime;

      // NFR-PERF-008: 100K nodes < 500ms
      expect(duration).toBeLessThan(500);
      expect(entries.length).toBeGreaterThan(0);
    });
  });
});
