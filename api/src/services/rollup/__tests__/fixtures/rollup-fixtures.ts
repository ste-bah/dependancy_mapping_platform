/**
 * Rollup Test Fixtures
 * @module services/rollup/__tests__/fixtures/rollup-fixtures
 *
 * Test fixtures for rollup configurations and data.
 */

import { randomUUID } from 'crypto';
import type {
  RollupConfig,
  RollupCreateRequest,
  MatcherConfig,
  ArnMatcherConfig,
  ResourceIdMatcherConfig,
  NameMatcherConfig,
  TagMatcherConfig,
  MatchResult,
  MergedNode,
  RollupExecutionStats,
  RollupExecutionResult,
} from '../../../../types/rollup.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';

// ============================================================================
// ID Generators
// ============================================================================

export function createTenantId(): TenantId {
  return randomUUID() as TenantId;
}

export function createRepositoryId(): RepositoryId {
  return randomUUID() as RepositoryId;
}

export function createScanId(): ScanId {
  return randomUUID() as ScanId;
}

export function createRollupId(): string {
  return `rollup_${randomUUID()}`;
}

export function createExecutionId(): string {
  return `exec_${randomUUID()}`;
}

// ============================================================================
// Matcher Configurations
// ============================================================================

export function createArnMatcherConfig(
  overrides: Partial<ArnMatcherConfig> = {}
): ArnMatcherConfig {
  return {
    type: 'arn',
    enabled: true,
    priority: 80,
    minConfidence: 80,
    pattern: 'arn:aws:s3:::*',
    allowPartial: false,
    components: {
      partition: true,
      service: true,
      region: false,
      account: false,
      resource: true,
    },
    ...overrides,
  };
}

export function createResourceIdMatcherConfig(
  overrides: Partial<ResourceIdMatcherConfig> = {}
): ResourceIdMatcherConfig {
  return {
    type: 'resource_id',
    enabled: true,
    priority: 70,
    minConfidence: 90,
    resourceType: 'aws_s3_bucket',
    idAttribute: 'id',
    normalize: true,
    ...overrides,
  };
}

export function createNameMatcherConfig(
  overrides: Partial<NameMatcherConfig> = {}
): NameMatcherConfig {
  return {
    type: 'name',
    enabled: true,
    priority: 60,
    minConfidence: 75,
    caseSensitive: false,
    includeNamespace: true,
    ...overrides,
  };
}

export function createTagMatcherConfig(
  overrides: Partial<TagMatcherConfig> = {}
): TagMatcherConfig {
  return {
    type: 'tag',
    enabled: true,
    priority: 50,
    minConfidence: 85,
    requiredTags: [
      { key: 'Environment', value: 'production' },
      { key: 'Project' },
    ],
    matchMode: 'all',
    ...overrides,
  };
}

// ============================================================================
// Rollup Configurations
// ============================================================================

export function createRollupCreateRequest(
  overrides: Partial<RollupCreateRequest> = {}
): RollupCreateRequest {
  return {
    name: 'Test Rollup',
    description: 'A test rollup configuration',
    repositoryIds: [createRepositoryId(), createRepositoryId()],
    matchers: [
      createArnMatcherConfig(),
      createNameMatcherConfig(),
    ],
    mergeOptions: {
      conflictResolution: 'merge',
      preserveSourceInfo: true,
      createCrossRepoEdges: true,
    },
    ...overrides,
  };
}

export function createRollupConfig(
  overrides: Partial<RollupConfig> = {}
): RollupConfig {
  const id = overrides.id ?? createRollupId();
  const now = new Date().toISOString();

  return {
    id,
    tenantId: createTenantId(),
    name: 'Test Rollup Configuration',
    description: 'A test rollup for unit testing',
    status: 'active',
    repositoryIds: [createRepositoryId(), createRepositoryId()],
    matchers: [
      createArnMatcherConfig(),
      createNameMatcherConfig(),
    ],
    mergeOptions: {
      conflictResolution: 'merge',
      preserveSourceInfo: true,
      createCrossRepoEdges: true,
    },
    version: 1,
    createdBy: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ============================================================================
// Match Results
// ============================================================================

export function createMatchResult(
  overrides: Partial<MatchResult> = {}
): MatchResult {
  return {
    sourceNodeId: `node_${randomUUID()}`,
    targetNodeId: `node_${randomUUID()}`,
    sourceRepoId: createRepositoryId(),
    targetRepoId: createRepositoryId(),
    strategy: 'arn',
    confidence: 95,
    details: {
      matchedAttribute: 'arn',
      sourceValue: 'arn:aws:s3:::my-bucket',
      targetValue: 'arn:aws:s3:::my-bucket',
      context: {},
    },
    ...overrides,
  };
}

export function createMultipleMatchResults(count: number): MatchResult[] {
  return Array.from({ length: count }, () => createMatchResult());
}

// ============================================================================
// Merged Nodes
// ============================================================================

export function createMergedNode(
  overrides: Partial<MergedNode> = {}
): MergedNode {
  const sourceNodeId1 = `node_${randomUUID()}`;
  const sourceNodeId2 = `node_${randomUUID()}`;
  const repoId1 = createRepositoryId();
  const repoId2 = createRepositoryId();

  return {
    id: `merged_${randomUUID()}`,
    sourceNodeIds: [sourceNodeId1, sourceNodeId2],
    sourceRepoIds: [repoId1, repoId2],
    type: 'terraform_resource',
    name: 'aws_s3_bucket.example',
    locations: [
      {
        repoId: repoId1,
        file: 'main.tf',
        lineStart: 1,
        lineEnd: 10,
      },
      {
        repoId: repoId2,
        file: 'storage.tf',
        lineStart: 5,
        lineEnd: 15,
      },
    ],
    metadata: {
      bucket: 'my-bucket',
      region: 'us-east-1',
    },
    matchInfo: {
      strategy: 'arn',
      confidence: 95,
      matchCount: 1,
    },
    ...overrides,
  };
}

// ============================================================================
// Execution Results
// ============================================================================

export function createExecutionStats(
  overrides: Partial<RollupExecutionStats> = {}
): RollupExecutionStats {
  return {
    totalNodesProcessed: 100,
    nodesMatched: 40,
    nodesUnmatched: 60,
    totalEdgesProcessed: 150,
    crossRepoEdgesCreated: 20,
    matchesByStrategy: {
      arn: 15,
      resource_id: 10,
      name: 10,
      tag: 5,
    },
    nodesByType: {
      terraform_resource: 60,
      terraform_data: 20,
      terraform_module: 20,
    },
    edgesByType: {
      depends_on: 50,
      references: 80,
      module_call: 20,
    },
    executionTimeMs: 1500,
    ...overrides,
  };
}

export function createExecutionResult(
  overrides: Partial<RollupExecutionResult> = {}
): RollupExecutionResult {
  const now = new Date().toISOString();
  const startTime = new Date(Date.now() - 2000).toISOString();

  return {
    id: createExecutionId(),
    rollupId: createRollupId(),
    tenantId: createTenantId(),
    status: 'completed',
    scanIds: [createScanId(), createScanId()],
    stats: createExecutionStats(),
    createdAt: startTime,
    startedAt: startTime,
    completedAt: now,
    ...overrides,
  };
}

// ============================================================================
// Invalid/Edge Case Fixtures
// ============================================================================

export const INVALID_ARN_PATTERNS = [
  '',
  'not-an-arn',
  'arn:',
  'arn:aws',
  'arn:aws:s3',
  'arn:invalid-partition:s3:::bucket',
];

export const VALID_ARN_PATTERNS = [
  'arn:aws:s3:::*',
  'arn:aws:s3:::my-bucket',
  'arn:aws:ec2:us-east-1:123456789012:instance/*',
  'arn:aws:lambda:*:*:function:*',
  'arn:aws-cn:s3:::*',
  'arn:aws-us-gov:s3:::*',
];

export const SAMPLE_ARNS = [
  'arn:aws:s3:::my-bucket',
  'arn:aws:s3:::my-bucket/path/to/object',
  'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
  'arn:aws:lambda:us-east-1:123456789012:function:my-function',
  'arn:aws:iam::123456789012:user/johndoe',
  'arn:aws:rds:us-east-1:123456789012:db:mysql-db',
];

export const PLACEHOLDER_VALUES = [
  '<computed>',
  '(known after apply)',
  'unknown',
  'null',
  'undefined',
  'n/a',
];
