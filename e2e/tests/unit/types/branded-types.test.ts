/**
 * Branded Types Unit Tests
 * @module e2e/tests/unit/types/branded-types.test
 *
 * Unit tests for branded/nominal types used throughout the codebase:
 * - Type guards validation
 * - Factory function correctness
 * - Type narrowing behavior
 * - UUID validation
 * - Status enum validation
 *
 * TASK-E2E-032: Comprehensive test generation
 */

import { describe, it, expect } from 'vitest';
import {
  // Entity ID Types
  ScanId,
  DbNodeId,
  DbEdgeId,
  RepositoryId,
  TenantId,
  UserId,
  // Status Types
  ScanStatus,
  // Type Guards
  isScanEntity,
  isRepositoryEntity,
  isTenantEntity,
  isNodeEntity,
  isEdgeEntity,
  // Factory Functions
  createScanId,
  createDbNodeId,
  createDbEdgeId,
  createRepositoryId,
  createTenantId,
  createUserId,
  createEmptyScanProgress,
  createEmptyConfidenceDistribution,
  createEmptyTenantUsage,
  // Default Values
  DEFAULT_SCAN_CONFIG,
  DEFAULT_TENANT_LIMITS,
} from '../../../../api/src/types/entities.js';

import {
  // Rollup Type Guards
  isRollupId,
  isRollupExecutionId,
  isMatchingStrategy,
  isRollupStatus,
  isUUID,
  isArnMatcherConfig,
  isResourceIdMatcherConfig,
  isNameMatcherConfig,
  isTagMatcherConfig,
  isMatcherConfig,
  isMatchResult,
  isMergedNode,
  isRollupConfig,
  isRollupExecutionResult,
  isRollupResponse,
  isRollupListResponse,
  isBlastRadiusResponse,
  // Permission Checks
  canExecuteRollup,
  canModifyRollup,
  canArchiveRollup,
  canDeleteRollup,
  canRetryExecution,
  canCancelExecution,
  // Validation Guards
  isValidMatcherConfig,
  hasValidMatchers,
  hasSufficientRepositories,
  isReadyForExecution,
  // Assertion Functions
  assertRollupId,
  assertRollupExecutionId,
  assertMatchingStrategy,
  assertRollupStatus,
  assertMatcherConfig,
} from '../../../../api/src/types/rollup-guards.js';

// ============================================================================
// Test Data Factories
// ============================================================================

function createValidUUID(): string {
  return 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
}

function createInvalidUUID(): string {
  return 'not-a-valid-uuid';
}

function createMockScanEntity() {
  return {
    id: createValidUUID() as ScanId,
    tenantId: createValidUUID() as TenantId,
    repositoryId: createValidUUID() as RepositoryId,
    initiatedBy: createValidUUID() as UserId,
    status: 'pending' as ScanStatus,
    config: DEFAULT_SCAN_CONFIG,
    ref: 'main',
    commitSha: 'abc123',
    progress: createEmptyScanProgress(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockRepositoryEntity() {
  return {
    id: createValidUUID() as RepositoryId,
    tenantId: createValidUUID() as TenantId,
    provider: 'github' as const,
    providerId: '12345',
    owner: 'test-org',
    name: 'test-repo',
    fullName: 'test-org/test-repo',
    defaultBranch: 'main',
    cloneUrl: 'https://github.com/test-org/test-repo.git',
    htmlUrl: 'https://github.com/test-org/test-repo',
    isPrivate: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockTenantEntity() {
  return {
    id: createValidUUID() as TenantId,
    name: 'Test Tenant',
    slug: 'test-tenant',
    plan: 'professional' as const,
    ownerId: createValidUUID() as UserId,
    settings: {
      defaultScanConfig: {},
      emailNotifications: true,
      autoScanOnPush: false,
    },
    limits: DEFAULT_TENANT_LIMITS.professional,
    usage: createEmptyTenantUsage(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockNodeEntity() {
  return {
    id: createValidUUID() as DbNodeId,
    scanId: createValidUUID() as ScanId,
    tenantId: createValidUUID() as TenantId,
    originalId: 'aws_instance.main',
    nodeType: 'terraform_resource',
    name: 'main',
    filePath: 'main.tf',
    lineStart: 1,
    lineEnd: 10,
    metadata: {},
    createdAt: new Date(),
  };
}

function createMockEdgeEntity() {
  return {
    id: createValidUUID() as DbEdgeId,
    scanId: createValidUUID() as ScanId,
    tenantId: createValidUUID() as TenantId,
    originalId: 'edge-1',
    sourceNodeId: createValidUUID() as DbNodeId,
    targetNodeId: createValidUUID() as DbNodeId,
    edgeType: 'references',
    isImplicit: false,
    confidence: 90,
    metadata: {},
    createdAt: new Date(),
  };
}

function createMockRollupConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: createValidUUID(),
    tenantId: createValidUUID(),
    createdBy: createValidUUID(),
    name: 'Test Rollup',
    status: 'active',
    repositoryIds: [createValidUUID(), createValidUUID()],
    matchers: [
      {
        type: 'arn',
        enabled: true,
        priority: 100,
        minConfidence: 90,
        pattern: 'arn:aws:*',
      },
    ],
    mergeOptions: {},
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Branded Types', () => {
  // ==========================================================================
  // ID Factory Functions
  // ==========================================================================

  describe('ID Factory Functions', () => {
    it('should create ScanId', () => {
      const id = createScanId('test-scan-id');
      expect(id).toBe('test-scan-id');
      // Type system ensures this is branded
    });

    it('should create DbNodeId', () => {
      const id = createDbNodeId('node-123');
      expect(id).toBe('node-123');
    });

    it('should create DbEdgeId', () => {
      const id = createDbEdgeId('edge-456');
      expect(id).toBe('edge-456');
    });

    it('should create RepositoryId', () => {
      const id = createRepositoryId('repo-789');
      expect(id).toBe('repo-789');
    });

    it('should create TenantId', () => {
      const id = createTenantId('tenant-abc');
      expect(id).toBe('tenant-abc');
    });

    it('should create UserId', () => {
      const id = createUserId('user-xyz');
      expect(id).toBe('user-xyz');
    });
  });

  // ==========================================================================
  // UUID Validation
  // ==========================================================================

  describe('UUID Validation', () => {
    it('should validate correct UUID v4', () => {
      expect(isUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID formats', () => {
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('123456789')).toBe(false);
      expect(isUUID('')).toBe(false);
      expect(isUUID('f47ac10b-58cc-4372-a567')).toBe(false); // Too short
    });

    it('should reject non-string values', () => {
      expect(isUUID(null)).toBe(false);
      expect(isUUID(undefined)).toBe(false);
      expect(isUUID(123)).toBe(false);
      expect(isUUID({})).toBe(false);
    });

    it('should validate RollupId', () => {
      expect(isRollupId(createValidUUID())).toBe(true);
      expect(isRollupId(createInvalidUUID())).toBe(false);
    });

    it('should validate RollupExecutionId', () => {
      expect(isRollupExecutionId(createValidUUID())).toBe(true);
      expect(isRollupExecutionId(createInvalidUUID())).toBe(false);
    });
  });

  // ==========================================================================
  // Status Validation
  // ==========================================================================

  describe('Status Validation', () => {
    it('should validate MatchingStrategy', () => {
      expect(isMatchingStrategy('arn')).toBe(true);
      expect(isMatchingStrategy('resource_id')).toBe(true);
      expect(isMatchingStrategy('name')).toBe(true);
      expect(isMatchingStrategy('tag')).toBe(true);
      expect(isMatchingStrategy('invalid')).toBe(false);
    });

    it('should validate RollupStatus', () => {
      expect(isRollupStatus('draft')).toBe(true);
      expect(isRollupStatus('active')).toBe(true);
      expect(isRollupStatus('executing')).toBe(true);
      expect(isRollupStatus('completed')).toBe(true);
      expect(isRollupStatus('failed')).toBe(true);
      expect(isRollupStatus('archived')).toBe(true);
      expect(isRollupStatus('invalid')).toBe(false);
    });
  });

  // ==========================================================================
  // Entity Type Guards
  // ==========================================================================

  describe('Entity Type Guards', () => {
    describe('isScanEntity', () => {
      it('should return true for valid scan entity', () => {
        expect(isScanEntity(createMockScanEntity())).toBe(true);
      });

      it('should return false for missing required fields', () => {
        expect(isScanEntity({})).toBe(false);
        expect(isScanEntity({ id: '123' })).toBe(false);
        expect(isScanEntity({ id: '123', tenantId: '456' })).toBe(false);
      });

      it('should return false for non-objects', () => {
        expect(isScanEntity(null)).toBe(false);
        expect(isScanEntity(undefined)).toBe(false);
        expect(isScanEntity('string')).toBe(false);
      });
    });

    describe('isRepositoryEntity', () => {
      it('should return true for valid repository entity', () => {
        expect(isRepositoryEntity(createMockRepositoryEntity())).toBe(true);
      });

      it('should return false for missing required fields', () => {
        expect(isRepositoryEntity({})).toBe(false);
        expect(isRepositoryEntity({ id: '123', tenantId: '456' })).toBe(false);
      });
    });

    describe('isTenantEntity', () => {
      it('should return true for valid tenant entity', () => {
        expect(isTenantEntity(createMockTenantEntity())).toBe(true);
      });

      it('should return false for missing required fields', () => {
        expect(isTenantEntity({})).toBe(false);
        expect(isTenantEntity({ id: '123', name: 'Test' })).toBe(false);
      });
    });

    describe('isNodeEntity', () => {
      it('should return true for valid node entity', () => {
        expect(isNodeEntity(createMockNodeEntity())).toBe(true);
      });

      it('should return false for missing required fields', () => {
        expect(isNodeEntity({})).toBe(false);
        expect(isNodeEntity({ id: '123', scanId: '456' })).toBe(false);
      });
    });

    describe('isEdgeEntity', () => {
      it('should return true for valid edge entity', () => {
        expect(isEdgeEntity(createMockEdgeEntity())).toBe(true);
      });

      it('should return false for missing required fields', () => {
        expect(isEdgeEntity({})).toBe(false);
        expect(isEdgeEntity({ id: '123', scanId: '456', edgeType: 'references' })).toBe(
          false
        );
      });
    });
  });

  // ==========================================================================
  // Matcher Config Type Guards
  // ==========================================================================

  describe('Matcher Config Type Guards', () => {
    describe('isArnMatcherConfig', () => {
      it('should validate valid ARN matcher config', () => {
        const config = {
          type: 'arn',
          enabled: true,
          priority: 100,
          minConfidence: 90,
          pattern: 'arn:aws:*',
        };
        expect(isArnMatcherConfig(config)).toBe(true);
      });

      it('should reject invalid ARN matcher config', () => {
        expect(isArnMatcherConfig({ type: 'name' })).toBe(false);
        expect(
          isArnMatcherConfig({
            type: 'arn',
            enabled: true,
            priority: 100,
            minConfidence: 90,
            // Missing pattern
          })
        ).toBe(false);
      });
    });

    describe('isResourceIdMatcherConfig', () => {
      it('should validate valid resource ID matcher config', () => {
        const config = {
          type: 'resource_id',
          enabled: true,
          priority: 80,
          minConfidence: 85,
          resourceType: 'aws_instance',
        };
        expect(isResourceIdMatcherConfig(config)).toBe(true);
      });

      it('should reject invalid resource ID matcher config', () => {
        expect(
          isResourceIdMatcherConfig({
            type: 'resource_id',
            enabled: true,
            priority: 80,
            minConfidence: 85,
            // Missing resourceType
          })
        ).toBe(false);
      });
    });

    describe('isNameMatcherConfig', () => {
      it('should validate valid name matcher config', () => {
        const config = {
          type: 'name',
          enabled: true,
          priority: 60,
          minConfidence: 70,
        };
        expect(isNameMatcherConfig(config)).toBe(true);
      });

      it('should validate name matcher with optional fields', () => {
        const config = {
          type: 'name',
          enabled: true,
          priority: 60,
          minConfidence: 70,
          pattern: '.*-prod$',
          caseSensitive: false,
          fuzzyThreshold: 80,
        };
        expect(isNameMatcherConfig(config)).toBe(true);
      });
    });

    describe('isTagMatcherConfig', () => {
      it('should validate valid tag matcher config', () => {
        const config = {
          type: 'tag',
          enabled: true,
          priority: 40,
          minConfidence: 80,
          requiredTags: [{ key: 'Environment', value: 'production' }],
        };
        expect(isTagMatcherConfig(config)).toBe(true);
      });

      it('should reject tag matcher without required tags', () => {
        expect(
          isTagMatcherConfig({
            type: 'tag',
            enabled: true,
            priority: 40,
            minConfidence: 80,
            requiredTags: [],
          })
        ).toBe(false);
      });
    });

    describe('isMatcherConfig', () => {
      it('should validate any valid matcher config', () => {
        expect(
          isMatcherConfig({
            type: 'arn',
            enabled: true,
            priority: 100,
            minConfidence: 90,
            pattern: 'arn:*',
          })
        ).toBe(true);
        expect(
          isMatcherConfig({
            type: 'name',
            enabled: true,
            priority: 60,
            minConfidence: 70,
          })
        ).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Permission Type Guards
  // ==========================================================================

  describe('Permission Type Guards', () => {
    describe('canExecuteRollup', () => {
      it('should allow execution for active rollups', () => {
        const config = createMockRollupConfig({ status: 'active' });
        expect(canExecuteRollup(config as any)).toBe(true);
      });

      it('should allow execution for completed rollups', () => {
        const config = createMockRollupConfig({ status: 'completed' });
        expect(canExecuteRollup(config as any)).toBe(true);
      });

      it('should allow execution for failed rollups', () => {
        const config = createMockRollupConfig({ status: 'failed' });
        expect(canExecuteRollup(config as any)).toBe(true);
      });

      it('should not allow execution for draft rollups', () => {
        const config = createMockRollupConfig({ status: 'draft' });
        expect(canExecuteRollup(config as any)).toBe(false);
      });
    });

    describe('canModifyRollup', () => {
      it('should allow modification for draft rollups', () => {
        const config = createMockRollupConfig({ status: 'draft' });
        expect(canModifyRollup(config as any)).toBe(true);
      });

      it('should not allow modification for executing rollups', () => {
        const config = createMockRollupConfig({ status: 'executing' });
        expect(canModifyRollup(config as any)).toBe(false);
      });

      it('should not allow modification for archived rollups', () => {
        const config = createMockRollupConfig({ status: 'archived' });
        expect(canModifyRollup(config as any)).toBe(false);
      });
    });

    describe('canArchiveRollup', () => {
      it('should allow archiving for most statuses', () => {
        expect(canArchiveRollup(createMockRollupConfig({ status: 'active' }) as any)).toBe(
          true
        );
        expect(canArchiveRollup(createMockRollupConfig({ status: 'draft' }) as any)).toBe(
          true
        );
      });

      it('should not allow archiving executing rollups', () => {
        expect(
          canArchiveRollup(createMockRollupConfig({ status: 'executing' }) as any)
        ).toBe(false);
      });

      it('should not allow archiving already archived rollups', () => {
        expect(
          canArchiveRollup(createMockRollupConfig({ status: 'archived' }) as any)
        ).toBe(false);
      });
    });

    describe('canDeleteRollup', () => {
      it('should allow deleting draft rollups', () => {
        const config = createMockRollupConfig({ status: 'draft' });
        expect(canDeleteRollup(config as any)).toBe(true);
      });

      it('should allow deleting archived rollups', () => {
        const config = createMockRollupConfig({ status: 'archived' });
        expect(canDeleteRollup(config as any)).toBe(true);
      });

      it('should not allow deleting active rollups', () => {
        const config = createMockRollupConfig({ status: 'active' });
        expect(canDeleteRollup(config as any)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Execution Permission Guards
  // ==========================================================================

  describe('Execution Permission Guards', () => {
    describe('canRetryExecution', () => {
      it('should allow retrying failed executions', () => {
        expect(canRetryExecution({ status: 'failed' } as any)).toBe(true);
      });

      it('should not allow retrying completed executions', () => {
        expect(canRetryExecution({ status: 'completed' } as any)).toBe(false);
      });

      it('should not allow retrying running executions', () => {
        expect(canRetryExecution({ status: 'running' } as any)).toBe(false);
      });
    });

    describe('canCancelExecution', () => {
      it('should allow cancelling pending executions', () => {
        expect(canCancelExecution({ status: 'pending' } as any)).toBe(true);
      });

      it('should allow cancelling running executions', () => {
        expect(canCancelExecution({ status: 'running' } as any)).toBe(true);
      });

      it('should not allow cancelling completed executions', () => {
        expect(canCancelExecution({ status: 'completed' } as any)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Validation Guards
  // ==========================================================================

  describe('Validation Guards', () => {
    describe('isValidMatcherConfig', () => {
      it('should validate proper ARN matcher', () => {
        const config = {
          type: 'arn' as const,
          enabled: true,
          priority: 100,
          minConfidence: 90,
          pattern: 'arn:aws:s3:::*',
        };
        expect(isValidMatcherConfig(config)).toBe(true);
      });

      it('should validate disabled matchers', () => {
        const config = {
          type: 'arn' as const,
          enabled: false,
          priority: 100,
          minConfidence: 90,
          pattern: 'invalid',
        };
        expect(isValidMatcherConfig(config)).toBe(true);
      });
    });

    describe('hasValidMatchers', () => {
      it('should return true when rollup has valid enabled matchers', () => {
        const config = createMockRollupConfig({
          matchers: [
            {
              type: 'arn',
              enabled: true,
              priority: 100,
              minConfidence: 90,
              pattern: 'arn:*',
            },
          ],
        });
        expect(hasValidMatchers(config as any)).toBe(true);
      });

      it('should return false when no matchers are enabled', () => {
        const config = createMockRollupConfig({
          matchers: [
            {
              type: 'arn',
              enabled: false,
              priority: 100,
              minConfidence: 90,
              pattern: 'arn:*',
            },
          ],
        });
        expect(hasValidMatchers(config as any)).toBe(false);
      });
    });

    describe('hasSufficientRepositories', () => {
      it('should return true for 2+ repositories', () => {
        const config = createMockRollupConfig({
          repositoryIds: [createValidUUID(), createValidUUID()],
        });
        expect(hasSufficientRepositories(config as any)).toBe(true);
      });

      it('should return false for single repository', () => {
        const config = createMockRollupConfig({
          repositoryIds: [createValidUUID()],
        });
        expect(hasSufficientRepositories(config as any)).toBe(false);
      });
    });

    describe('isReadyForExecution', () => {
      it('should return true for fully valid active rollup', () => {
        const config = createMockRollupConfig({
          status: 'active',
          repositoryIds: [createValidUUID(), createValidUUID()],
          matchers: [
            {
              type: 'arn',
              enabled: true,
              priority: 100,
              minConfidence: 90,
              pattern: 'arn:*',
            },
          ],
        });
        expect(isReadyForExecution(config as any)).toBe(true);
      });

      it('should return false for draft rollup', () => {
        const config = createMockRollupConfig({ status: 'draft' });
        expect(isReadyForExecution(config as any)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Assertion Functions
  // ==========================================================================

  describe('Assertion Functions', () => {
    it('should not throw for valid RollupId', () => {
      expect(() => assertRollupId(createValidUUID())).not.toThrow();
    });

    it('should throw for invalid RollupId', () => {
      expect(() => assertRollupId('invalid')).toThrow('Invalid RollupId');
    });

    it('should not throw for valid RollupExecutionId', () => {
      expect(() => assertRollupExecutionId(createValidUUID())).not.toThrow();
    });

    it('should throw for invalid RollupExecutionId', () => {
      expect(() => assertRollupExecutionId('invalid')).toThrow('Invalid RollupExecutionId');
    });

    it('should not throw for valid MatchingStrategy', () => {
      expect(() => assertMatchingStrategy('arn')).not.toThrow();
    });

    it('should throw for invalid MatchingStrategy', () => {
      expect(() => assertMatchingStrategy('invalid')).toThrow('Invalid MatchingStrategy');
    });

    it('should not throw for valid RollupStatus', () => {
      expect(() => assertRollupStatus('active')).not.toThrow();
    });

    it('should throw for invalid RollupStatus', () => {
      expect(() => assertRollupStatus('invalid')).toThrow('Invalid RollupStatus');
    });

    it('should throw with custom message', () => {
      expect(() => assertRollupId('invalid', 'Custom error')).toThrow('Custom error');
    });
  });

  // ==========================================================================
  // Default Values
  // ==========================================================================

  describe('Default Values', () => {
    it('should have valid default scan config', () => {
      expect(DEFAULT_SCAN_CONFIG.detectTypes).toContain('terraform');
      expect(DEFAULT_SCAN_CONFIG.minConfidence).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_SCAN_CONFIG.minConfidence).toBeLessThanOrEqual(100);
      expect(DEFAULT_SCAN_CONFIG.maxDepth).toBeGreaterThan(0);
    });

    it('should have valid default tenant limits for all plans', () => {
      const plans = ['free', 'starter', 'professional', 'enterprise'] as const;

      for (const plan of plans) {
        const limits = DEFAULT_TENANT_LIMITS[plan];
        expect(limits.maxConcurrentScans).toBeGreaterThan(0);
        expect(limits.retentionDays).toBeGreaterThan(0);
      }
    });

    it('should have increasing limits for higher plans', () => {
      expect(DEFAULT_TENANT_LIMITS.starter.maxRepositories).toBeGreaterThan(
        DEFAULT_TENANT_LIMITS.free.maxRepositories
      );
      expect(DEFAULT_TENANT_LIMITS.professional.maxScansPerMonth).toBeGreaterThan(
        DEFAULT_TENANT_LIMITS.starter.maxScansPerMonth
      );
    });
  });

  // ==========================================================================
  // Empty Factory Functions
  // ==========================================================================

  describe('Empty Factory Functions', () => {
    it('should create empty scan progress', () => {
      const progress = createEmptyScanProgress();

      expect(progress.phase).toBe('initializing');
      expect(progress.percentage).toBe(0);
      expect(progress.filesProcessed).toBe(0);
      expect(progress.nodesDetected).toBe(0);
      expect(progress.edgesDetected).toBe(0);
      expect(progress.errors).toBe(0);
      expect(progress.warnings).toBe(0);
    });

    it('should create empty confidence distribution', () => {
      const dist = createEmptyConfidenceDistribution();

      expect(dist.certain).toBe(0);
      expect(dist.high).toBe(0);
      expect(dist.medium).toBe(0);
      expect(dist.low).toBe(0);
      expect(dist.uncertain).toBe(0);
    });

    it('should create empty tenant usage', () => {
      const usage = createEmptyTenantUsage();

      expect(usage.repositoryCount).toBe(0);
      expect(usage.scansThisMonth).toBe(0);
      expect(usage.apiRequestsThisHour).toBe(0);
      expect(usage.currentConcurrentScans).toBe(0);
      expect(usage.totalNodesStored).toBe(0);
      expect(usage.totalEdgesStored).toBe(0);
      expect(usage.storageUsedBytes).toBe(0);
    });
  });
});
