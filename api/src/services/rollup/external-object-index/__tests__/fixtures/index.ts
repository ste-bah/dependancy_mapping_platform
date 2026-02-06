/**
 * Test Fixtures for External Object Index
 * @module services/rollup/external-object-index/__tests__/fixtures
 *
 * Provides test data factories, mock creators, and utility functions
 * for External Object Index testing.
 *
 * TASK-ROLLUP-003: External Object Index testing infrastructure
 */

import { vi, type Mock } from 'vitest';
import type {
  ExternalObjectEntry,
  IExternalObjectRepository,
  IExternalObjectCache,
  IIndexEngine,
  ExternalReferenceType,
} from '../../interfaces.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../../types/entities.js';
import type { DependencyGraph, NodeType } from '../../../../../types/graph.js';
import { CloudProvider, computeReferenceHash, type ReferenceHash } from '../../domain/types.js';

// ============================================================================
// Constants
// ============================================================================

export const TEST_TENANT_ID = 'test-tenant-1' as TenantId;
export const TEST_REPO_ID = 'test-repo-1' as RepositoryId;
export const TEST_SCAN_ID = 'test-scan-1' as ScanId;

export const SAMPLE_ARNS = {
  S3_BUCKET: 'arn:aws:s3:::my-test-bucket',
  LAMBDA_FUNCTION: 'arn:aws:lambda:us-east-1:123456789012:function:my-function',
  IAM_ROLE: 'arn:aws:iam::123456789012:role/MyRole',
  DYNAMODB_TABLE: 'arn:aws:dynamodb:us-east-1:123456789012:table/MyTable',
  SQS_QUEUE: 'arn:aws:sqs:us-east-1:123456789012:MyQueue',
  SNS_TOPIC: 'arn:aws:sns:us-east-1:123456789012:MyTopic',
  EC2_INSTANCE: 'arn:aws:ec2:us-west-2:123456789012:instance/i-1234567890abcdef0',
  RDS_DATABASE: 'arn:aws:rds:us-east-1:123456789012:db:my-database',
  ECS_CLUSTER: 'arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster',
  ELB: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-alb/50dc6c495c0c9188',
};

export const SAMPLE_K8S_REFS = {
  CONFIGMAP: 'default/ConfigMap/app-config',
  SECRET: 'production/Secret/db-credentials',
  SERVICE: 'default/Service/api-service',
  SERVICE_ACCOUNT: 'kube-system/ServiceAccount/admin',
  PVC: 'default/PersistentVolumeClaim/data-pvc',
  DEPLOYMENT: 'default/Deployment/nginx',
  ROLE: 'default/Role/pod-reader',
  CLUSTER_ROLE: 'ClusterRole/cluster-admin',
};

// ============================================================================
// Entry Factory
// ============================================================================

export interface CreateMockEntryOptions {
  id?: string;
  externalId?: string;
  referenceType?: ExternalReferenceType;
  tenantId?: TenantId;
  repositoryId?: RepositoryId;
  scanId?: ScanId;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  filePath?: string;
  components?: Record<string, string>;
  metadata?: Record<string, unknown>;
  indexedAt?: Date;
}

export function createMockEntry(options: CreateMockEntryOptions = {}): ExternalObjectEntry {
  const externalId = options.externalId ?? SAMPLE_ARNS.S3_BUCKET;
  const referenceType = options.referenceType ?? 'arn';

  return {
    id: options.id ?? `entry-${Math.random().toString(36).slice(2, 10)}`,
    externalId,
    referenceType,
    normalizedId: externalId.toLowerCase(),
    tenantId: options.tenantId ?? TEST_TENANT_ID,
    repositoryId: options.repositoryId ?? TEST_REPO_ID,
    scanId: options.scanId ?? TEST_SCAN_ID,
    nodeId: options.nodeId ?? `node-${Math.random().toString(36).slice(2, 10)}`,
    nodeName: options.nodeName ?? 'aws_s3_bucket.test',
    nodeType: options.nodeType ?? 'terraform_resource',
    filePath: options.filePath ?? 'main.tf',
    components: options.components ?? { service: 's3', resource: 'test-bucket' },
    metadata: options.metadata ?? {},
    indexedAt: options.indexedAt ?? new Date(),
  };
}

export function createMockEntries(
  count: number,
  baseOptions: CreateMockEntryOptions = {}
): ExternalObjectEntry[] {
  return Array.from({ length: count }, (_, i) =>
    createMockEntry({
      ...baseOptions,
      id: baseOptions.id ? `${baseOptions.id}-${i}` : undefined,
      nodeId: baseOptions.nodeId ? `${baseOptions.nodeId}-${i}` : undefined,
      externalId: baseOptions.externalId
        ? `${baseOptions.externalId}-${i}`
        : `arn:aws:s3:::bucket-${i}`,
    })
  );
}

// ============================================================================
// Node Factory
// ============================================================================

export interface CreateMockNodeOptions {
  id?: string;
  type?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  dependencies?: string[];
  dependents?: string[];
}

export function createMockNode(options: CreateMockNodeOptions = {}): NodeType {
  return {
    id: options.id ?? `node-${Math.random().toString(36).slice(2, 10)}`,
    type: options.type ?? 'terraform_resource',
    name: options.name ?? 'aws_s3_bucket.test',
    metadata: options.metadata ?? {
      arn: SAMPLE_ARNS.S3_BUCKET,
      resourceType: 'aws_s3_bucket',
    },
    location: {
      file: options.file ?? 'main.tf',
      lineStart: options.lineStart ?? 1,
      lineEnd: options.lineEnd ?? 10,
    },
    dependencies: options.dependencies ?? [],
    dependents: options.dependents ?? [],
  };
}

export function createTerraformResourceNode(options: {
  resourceType: string;
  resourceName?: string;
  arn?: string;
  metadata?: Record<string, unknown>;
} & Partial<CreateMockNodeOptions>): NodeType {
  const resourceName = options.resourceName ?? 'test_resource';
  return createMockNode({
    ...options,
    type: 'terraform_resource',
    name: `${options.resourceType}.${resourceName}`,
    metadata: {
      resourceType: options.resourceType,
      arn: options.arn,
      ...options.metadata,
    },
  });
}

export function createK8sNode(options: {
  kind: string;
  resourceName?: string;
  namespace?: string;
  metadata?: Record<string, unknown>;
} & Partial<CreateMockNodeOptions>): NodeType {
  const resourceName = options.resourceName ?? 'test-resource';
  const namespace = options.namespace ?? 'default';

  return createMockNode({
    ...options,
    type: `k8s_${options.kind.toLowerCase()}`,
    name: resourceName,
    metadata: {
      kind: options.kind,
      namespace,
      ...options.metadata,
    },
    file: options.file ?? `${resourceName}.yaml`,
  });
}

// ============================================================================
// Graph Factory
// ============================================================================

export interface CreateMockGraphOptions {
  nodeCount?: number;
  scanId?: ScanId;
  repositoryId?: RepositoryId;
  nodeFactory?: (index: number) => NodeType;
}

export function createMockGraph(options: CreateMockGraphOptions = {}): DependencyGraph {
  const nodeCount = options.nodeCount ?? 10;
  const nodes = new Map<string, NodeType>();

  for (let i = 0; i < nodeCount; i++) {
    const node = options.nodeFactory
      ? options.nodeFactory(i)
      : createMockNode({
          id: `node-${i}`,
          name: `aws_s3_bucket.bucket_${i}`,
          metadata: {
            arn: `arn:aws:s3:::bucket-${i}`,
            resourceType: 'aws_s3_bucket',
          },
        });

    nodes.set(node.id, node);
  }

  return {
    nodes,
    edges: new Map(),
    metadata: {
      scanId: options.scanId ?? TEST_SCAN_ID,
      repositoryId: options.repositoryId ?? TEST_REPO_ID,
      version: '1.0.0',
      createdAt: new Date(),
    },
  };
}

export function createEmptyGraph(): DependencyGraph {
  return createMockGraph({ nodeCount: 0 });
}

// ============================================================================
// Mock Repository Factory
// ============================================================================

export interface MockRepository extends IExternalObjectRepository {
  saveEntries: Mock;
  findByExternalId: Mock;
  findByNodeId: Mock;
  deleteEntries: Mock;
  countEntries: Mock;
  countByType: Mock;
  // Test helpers
  _entries: Map<string, ExternalObjectEntry[]>;
  _simulateLatency: number;
}

export function createMockRepository(options: {
  entries?: ExternalObjectEntry[];
  latencyMs?: number;
} = {}): MockRepository {
  const entriesMap = new Map<string, ExternalObjectEntry[]>();

  // Index initial entries
  if (options.entries) {
    for (const entry of options.entries) {
      const key = `${entry.tenantId}:${entry.externalId}`;
      const existing = entriesMap.get(key) ?? [];
      entriesMap.set(key, [...existing, entry]);
    }
  }

  const addLatency = async <T>(value: T): Promise<T> => {
    if (options.latencyMs) {
      await new Promise(resolve => setTimeout(resolve, options.latencyMs));
    }
    return value;
  };

  return {
    _entries: entriesMap,
    _simulateLatency: options.latencyMs ?? 0,

    saveEntries: vi.fn().mockImplementation(async (tenantId: TenantId, entries: ExternalObjectEntry[]) => {
      for (const entry of entries) {
        const key = `${tenantId}:${entry.externalId}`;
        const existing = entriesMap.get(key) ?? [];
        entriesMap.set(key, [...existing, entry]);
      }
      return addLatency(entries.length);
    }),

    findByExternalId: vi.fn().mockImplementation(async (tenantId: TenantId, externalId: string) => {
      const key = `${tenantId}:${externalId}`;
      return addLatency(entriesMap.get(key) ?? []);
    }),

    findByNodeId: vi.fn().mockImplementation(async (tenantId: TenantId, nodeId: string) => {
      const results: ExternalObjectEntry[] = [];
      for (const entries of entriesMap.values()) {
        results.push(...entries.filter(e => e.nodeId === nodeId && e.tenantId === tenantId));
      }
      return addLatency(results);
    }),

    deleteEntries: vi.fn().mockImplementation(async (tenantId: TenantId, filter: any) => {
      let count = 0;
      for (const [key, entries] of entriesMap.entries()) {
        if (key.startsWith(tenantId)) {
          const remaining = entries.filter(e => {
            if (filter.repositoryId && e.repositoryId !== filter.repositoryId) return true;
            if (filter.scanId && e.scanId !== filter.scanId) return true;
            if (filter.referenceType && e.referenceType !== filter.referenceType) return true;
            count++;
            return false;
          });
          if (remaining.length > 0) {
            entriesMap.set(key, remaining);
          } else {
            entriesMap.delete(key);
          }
        }
      }
      return addLatency(count);
    }),

    countEntries: vi.fn().mockImplementation(async (tenantId: TenantId) => {
      let count = 0;
      for (const entries of entriesMap.values()) {
        count += entries.filter(e => e.tenantId === tenantId).length;
      }
      return addLatency(count);
    }),

    countByType: vi.fn().mockImplementation(async (tenantId: TenantId) => {
      const counts: Record<string, number> = {
        arn: 0,
        resource_id: 0,
        k8s_reference: 0,
        gcp_resource: 0,
        azure_resource: 0,
        container_image: 0,
        git_url: 0,
        storage_path: 0,
      };

      for (const entries of entriesMap.values()) {
        for (const entry of entries) {
          if (entry.tenantId === tenantId) {
            counts[entry.referenceType] = (counts[entry.referenceType] ?? 0) + 1;
          }
        }
      }

      return addLatency(counts);
    }),
  };
}

// ============================================================================
// Mock Cache Factory
// ============================================================================

export interface MockCache extends IExternalObjectCache {
  get: Mock;
  set: Mock;
  delete: Mock;
  deleteByPattern: Mock;
  invalidateTenant: Mock;
  getStats: Mock;
  buildKey: Mock;
  // Test helpers
  _store: Map<string, ExternalObjectEntry[]>;
  _hits: number;
  _misses: number;
}

export function createMockCache(options: {
  initialData?: Map<string, ExternalObjectEntry[]>;
} = {}): MockCache {
  const store = options.initialData ?? new Map<string, ExternalObjectEntry[]>();
  let hits = 0;
  let misses = 0;

  return {
    _store: store,
    _hits: hits,
    _misses: misses,

    get: vi.fn().mockImplementation(async (key: string) => {
      const value = store.get(key);
      if (value) {
        hits++;
        return value;
      }
      misses++;
      return null;
    }),

    set: vi.fn().mockImplementation(async (key: string, value: ExternalObjectEntry[]) => {
      store.set(key, value);
    }),

    delete: vi.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }),

    deleteByPattern: vi.fn().mockImplementation(async (pattern: string) => {
      let count = 0;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of store.keys()) {
        if (regex.test(key)) {
          store.delete(key);
          count++;
        }
      }
      return count;
    }),

    invalidateTenant: vi.fn().mockImplementation(async (tenantId: TenantId) => {
      for (const key of store.keys()) {
        if (key.includes(tenantId)) {
          store.delete(key);
        }
      }
    }),

    getStats: vi.fn().mockImplementation(() => ({
      l1Hits: hits,
      l1Misses: misses,
      l2Hits: 0,
      l2Misses: 0,
      hitRatio: hits / (hits + misses) || 0,
    })),

    buildKey: vi.fn().mockImplementation(
      (tenantId: string, externalId: string, repoId?: string) =>
        `${tenantId}:${repoId ?? ''}:${externalId}`
    ),
  };
}

// ============================================================================
// Mock Index Engine Factory
// ============================================================================

export interface MockIndexEngine extends IIndexEngine {
  processNodes: Mock;
  buildInvertedIndex: Mock;
  mergeIndex: Mock;
}

export function createMockIndexEngine(): MockIndexEngine {
  return {
    processNodes: vi.fn().mockImplementation((nodes: NodeType[]) =>
      nodes.map(node => createMockEntry({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        externalId: (node.metadata.arn as string) ?? `resource-${node.id}`,
      }))
    ),

    buildInvertedIndex: vi.fn().mockReturnValue(new Map()),

    mergeIndex: vi.fn().mockReturnValue(new Map()),
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export function expectEntryToMatch(
  actual: ExternalObjectEntry,
  expected: Partial<ExternalObjectEntry>
): void {
  if (expected.externalId !== undefined) {
    expect(actual.externalId).toBe(expected.externalId);
  }
  if (expected.referenceType !== undefined) {
    expect(actual.referenceType).toBe(expected.referenceType);
  }
  if (expected.tenantId !== undefined) {
    expect(actual.tenantId).toBe(expected.tenantId);
  }
  if (expected.repositoryId !== undefined) {
    expect(actual.repositoryId).toBe(expected.repositoryId);
  }
  if (expected.nodeId !== undefined) {
    expect(actual.nodeId).toBe(expected.nodeId);
  }
}

export function expectEntriesContain(
  entries: ExternalObjectEntry[],
  externalId: string
): void {
  const found = entries.find(e => e.externalId === externalId);
  expect(found).toBeDefined();
}

export function expectEntriesNotContain(
  entries: ExternalObjectEntry[],
  externalId: string
): void {
  const found = entries.find(e => e.externalId === externalId);
  expect(found).toBeUndefined();
}

// ============================================================================
// Time Measurement Helpers
// ============================================================================

export async function measureLatency<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now();
  const result = await fn();
  const latencyMs = performance.now() - start;
  return { result, latencyMs };
}

export function createLatencyTracker(): {
  record: (latencyMs: number) => void;
  getAverage: () => number;
  getP95: () => number;
  getP99: () => number;
} {
  const latencies: number[] = [];

  return {
    record: (latencyMs: number) => {
      latencies.push(latencyMs);
    },
    getAverage: () => {
      if (latencies.length === 0) return 0;
      return latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    },
    getP95: () => {
      if (latencies.length === 0) return 0;
      const sorted = [...latencies].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.95);
      return sorted[index];
    },
    getP99: () => {
      if (latencies.length === 0) return 0;
      const sorted = [...latencies].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.99);
      return sorted[index];
    },
  };
}

// ============================================================================
// Database Record Helpers
// ============================================================================

export function entryToDbRecord(entry: ExternalObjectEntry): Record<string, unknown> {
  return {
    ...entry,
    components: JSON.stringify(entry.components),
    metadata: JSON.stringify(entry.metadata),
  };
}

export function dbRecordToEntry(record: Record<string, unknown>): ExternalObjectEntry {
  return {
    ...record,
    components: typeof record.components === 'string'
      ? JSON.parse(record.components)
      : record.components,
    metadata: typeof record.metadata === 'string'
      ? JSON.parse(record.metadata)
      : record.metadata,
  } as ExternalObjectEntry;
}
