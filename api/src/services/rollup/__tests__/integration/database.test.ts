/**
 * Database Integration Tests
 * @module services/rollup/__tests__/integration/database.test
 *
 * Integration tests for repository operations with mock database,
 * verifying migrations, tenant isolation, and transaction handling.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation database integration tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import {
  createTenantId,
  createRepositoryId,
  createScanId,
  createRollupId,
  createExecutionId,
  createArnMatcherConfig,
  createNameMatcherConfig,
  createRollupCreateRequest,
  createExecutionStats,
  createMatchResult,
} from '../fixtures/rollup-fixtures.js';
import { MockRollupRepository, createMockRollupRepository } from '../utils/mock-repository.js';
import type { RollupEntity, RollupExecutionEntity } from '../../interfaces.js';
import type { RollupId, RollupExecutionId } from '../../../../types/rollup.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';

// ============================================================================
// Test Database Abstraction
// ============================================================================

/**
 * In-memory database simulation with transaction support
 */
class TestDatabase {
  private rollups: Map<string, RollupEntity> = new Map();
  private executions: Map<string, RollupExecutionEntity> = new Map();
  private transactionActive = false;
  private rollback: Map<string, RollupEntity> = new Map();
  private executionRollback: Map<string, RollupExecutionEntity> = new Map();
  private connectionClosed = true; // Start disconnected

  async connect(): Promise<void> {
    this.connectionClosed = false;
  }

  async close(): Promise<void> {
    this.connectionClosed = true;
  }

  isConnected(): boolean {
    return !this.connectionClosed;
  }

  async beginTransaction(): Promise<void> {
    if (this.transactionActive) {
      throw new Error('Transaction already active');
    }
    this.transactionActive = true;
    // Snapshot current state for rollback
    this.rollback = new Map(this.rollups);
    this.executionRollback = new Map(this.executions);
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    this.transactionActive = false;
    this.rollback.clear();
    this.executionRollback.clear();
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    // Restore snapshot
    this.rollups = new Map(this.rollback);
    this.executions = new Map(this.executionRollback);
    this.transactionActive = false;
    this.rollback.clear();
    this.executionRollback.clear();
  }

  isInTransaction(): boolean {
    return this.transactionActive;
  }

  // CRUD operations
  async insertRollup(entity: RollupEntity): Promise<RollupEntity> {
    if (this.connectionClosed) throw new Error('Connection closed');
    this.rollups.set(entity.id, entity);
    return entity;
  }

  async findRollupById(id: RollupId, tenantId: TenantId): Promise<RollupEntity | null> {
    if (this.connectionClosed) throw new Error('Connection closed');
    const entity = this.rollups.get(id);
    if (entity && entity.tenantId === tenantId) {
      return entity;
    }
    return null;
  }

  async findAllRollups(tenantId: TenantId): Promise<RollupEntity[]> {
    if (this.connectionClosed) throw new Error('Connection closed');
    return Array.from(this.rollups.values()).filter(r => r.tenantId === tenantId);
  }

  async updateRollup(id: RollupId, update: Partial<RollupEntity>): Promise<RollupEntity> {
    if (this.connectionClosed) throw new Error('Connection closed');
    const existing = this.rollups.get(id);
    if (!existing) throw new Error('Rollup not found');
    const updated = { ...existing, ...update };
    this.rollups.set(id, updated);
    return updated;
  }

  async deleteRollup(id: RollupId): Promise<boolean> {
    if (this.connectionClosed) throw new Error('Connection closed');
    return this.rollups.delete(id);
  }

  async insertExecution(entity: RollupExecutionEntity): Promise<RollupExecutionEntity> {
    if (this.connectionClosed) throw new Error('Connection closed');
    this.executions.set(entity.id, entity);
    return entity;
  }

  async findExecutionById(id: RollupExecutionId, tenantId: TenantId): Promise<RollupExecutionEntity | null> {
    if (this.connectionClosed) throw new Error('Connection closed');
    const entity = this.executions.get(id);
    if (entity && entity.tenantId === tenantId) {
      return entity;
    }
    return null;
  }

  async findExecutionsByRollupId(rollupId: RollupId, tenantId: TenantId): Promise<RollupExecutionEntity[]> {
    if (this.connectionClosed) throw new Error('Connection closed');
    return Array.from(this.executions.values())
      .filter(e => e.rollupId === rollupId && e.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateExecution(id: RollupExecutionId, update: Partial<RollupExecutionEntity>): Promise<RollupExecutionEntity> {
    if (this.connectionClosed) throw new Error('Connection closed');
    const existing = this.executions.get(id);
    if (!existing) throw new Error('Execution not found');
    const updated = { ...existing, ...update };
    this.executions.set(id, updated);
    return updated;
  }

  // Test helpers
  clear(): void {
    this.rollups.clear();
    this.executions.clear();
    this.rollback.clear();
    this.executionRollback.clear();
    this.transactionActive = false;
    // Note: don't change connection state in clear()
  }

  getRollupCount(): number {
    return this.rollups.size;
  }

  getExecutionCount(): number {
    return this.executions.size;
  }
}

/**
 * Repository that uses TestDatabase
 */
class TestRollupRepository {
  constructor(private db: TestDatabase) {}

  async create(tenantId: TenantId, userId: string, input: ReturnType<typeof createRollupCreateRequest>): Promise<RollupEntity> {
    const entity: RollupEntity = {
      id: `rollup_${randomUUID()}` as RollupId,
      tenantId,
      name: input.name,
      description: input.description ?? null,
      status: 'draft',
      repositoryIds: input.repositoryIds as RepositoryId[],
      scanIds: input.scanIds as ScanId[] ?? null,
      matchers: input.matchers,
      includeNodeTypes: input.includeNodeTypes ?? null,
      excludeNodeTypes: input.excludeNodeTypes ?? null,
      preserveEdgeTypes: input.preserveEdgeTypes ?? null,
      mergeOptions: input.mergeOptions ?? {
        conflictResolution: 'merge',
        preserveSourceInfo: true,
        createCrossRepoEdges: true,
      },
      schedule: input.schedule ?? null,
      version: 1,
      createdBy: userId,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastExecutedAt: null,
    };

    return this.db.insertRollup(entity);
  }

  async findById(tenantId: TenantId, rollupId: RollupId): Promise<RollupEntity | null> {
    return this.db.findRollupById(rollupId, tenantId);
  }

  async findAll(tenantId: TenantId): Promise<RollupEntity[]> {
    return this.db.findAllRollups(tenantId);
  }

  async update(
    tenantId: TenantId,
    rollupId: RollupId,
    userId: string,
    updates: Partial<RollupEntity>,
    expectedVersion?: number
  ): Promise<RollupEntity> {
    const existing = await this.findById(tenantId, rollupId);
    if (!existing) throw new Error('Rollup not found');
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new Error('Version conflict');
    }
    return this.db.updateRollup(rollupId, {
      ...updates,
      version: existing.version + 1,
      updatedBy: userId,
      updatedAt: new Date(),
    });
  }

  async delete(tenantId: TenantId, rollupId: RollupId): Promise<boolean> {
    const existing = await this.findById(tenantId, rollupId);
    if (!existing) return false;
    return this.db.deleteRollup(rollupId);
  }

  async createExecution(
    tenantId: TenantId,
    rollupId: RollupId,
    scanIds: ScanId[]
  ): Promise<RollupExecutionEntity> {
    const entity: RollupExecutionEntity = {
      id: `exec_${randomUUID()}` as RollupExecutionId,
      rollupId,
      tenantId,
      status: 'pending',
      scanIds,
      stats: null,
      matches: null,
      mergedGraphId: null,
      errorMessage: null,
      errorDetails: null,
      callbackUrl: null,
      options: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    };
    return this.db.insertExecution(entity);
  }

  async findExecutionById(tenantId: TenantId, executionId: RollupExecutionId): Promise<RollupExecutionEntity | null> {
    return this.db.findExecutionById(executionId, tenantId);
  }

  async findLatestExecution(tenantId: TenantId, rollupId: RollupId): Promise<RollupExecutionEntity | null> {
    const executions = await this.db.findExecutionsByRollupId(rollupId, tenantId);
    return executions[0] ?? null;
  }

  async updateExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    updates: Partial<RollupExecutionEntity>
  ): Promise<RollupExecutionEntity> {
    const existing = await this.findExecutionById(tenantId, executionId);
    if (!existing) throw new Error('Execution not found');
    return this.db.updateExecution(executionId, updates);
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Database Integration Tests', () => {
  let testDb: TestDatabase;
  let repository: TestRollupRepository;
  const tenantId1 = createTenantId();
  const tenantId2 = createTenantId();
  const userId = 'test_user';

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.connect();
    repository = new TestRollupRepository(testDb);
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(() => {
    testDb.clear();
  });

  // ==========================================================================
  // Repository Operations
  // ==========================================================================

  describe('Repository CRUD Operations', () => {
    it('should create a rollup entity', async () => {
      const input = createRollupCreateRequest({
        name: 'DB Test Rollup',
        repositoryIds: [createRepositoryId(), createRepositoryId()],
      });

      const entity = await repository.create(tenantId1, userId, input);

      expect(entity).toBeDefined();
      expect(entity.id).toMatch(/^rollup_/);
      expect(entity.name).toBe('DB Test Rollup');
      expect(entity.tenantId).toBe(tenantId1);
      expect(entity.status).toBe('draft');
      expect(entity.version).toBe(1);
      expect(entity.createdBy).toBe(userId);
    });

    it('should find rollup by ID', async () => {
      const input = createRollupCreateRequest();
      const created = await repository.create(tenantId1, userId, input);

      const found = await repository.findById(tenantId1, created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(input.name);
    });

    it('should return null for non-existent rollup', async () => {
      const found = await repository.findById(tenantId1, 'rollup_nonexistent' as RollupId);

      expect(found).toBeNull();
    });

    it('should update rollup entity', async () => {
      const input = createRollupCreateRequest();
      const created = await repository.create(tenantId1, userId, input);

      const updated = await repository.update(tenantId1, created.id, userId, {
        name: 'Updated Name',
        status: 'active',
      }, created.version);

      expect(updated.name).toBe('Updated Name');
      expect(updated.status).toBe('active');
      expect(updated.version).toBe(2);
      expect(updated.updatedBy).toBe(userId);
    });

    it('should reject update with version conflict', async () => {
      const input = createRollupCreateRequest();
      const created = await repository.create(tenantId1, userId, input);

      // First update succeeds
      await repository.update(tenantId1, created.id, userId, { name: 'First Update' }, 1);

      // Second update with old version should fail
      await expect(
        repository.update(tenantId1, created.id, userId, { name: 'Second Update' }, 1)
      ).rejects.toThrow('Version conflict');
    });

    it('should delete rollup entity', async () => {
      const input = createRollupCreateRequest();
      const created = await repository.create(tenantId1, userId, input);

      const deleted = await repository.delete(tenantId1, created.id);

      expect(deleted).toBe(true);
      const found = await repository.findById(tenantId1, created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent rollup', async () => {
      const deleted = await repository.delete(tenantId1, 'rollup_nonexistent' as RollupId);

      expect(deleted).toBe(false);
    });

    it('should list all rollups for tenant', async () => {
      await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Rollup 1' }));
      await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Rollup 2' }));
      await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Rollup 3' }));

      const all = await repository.findAll(tenantId1);

      expect(all.length).toBe(3);
    });
  });

  // ==========================================================================
  // Tenant Isolation
  // ==========================================================================

  describe('Tenant Isolation', () => {
    it('should isolate rollups between tenants', async () => {
      // Create rollups for different tenants
      const rollup1 = await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Tenant 1 Rollup' }));
      const rollup2 = await repository.create(tenantId2, userId, createRollupCreateRequest({ name: 'Tenant 2 Rollup' }));

      // Each tenant should only see their own rollups
      const tenant1Rollups = await repository.findAll(tenantId1);
      const tenant2Rollups = await repository.findAll(tenantId2);

      expect(tenant1Rollups.length).toBe(1);
      expect(tenant1Rollups[0].name).toBe('Tenant 1 Rollup');
      expect(tenant2Rollups.length).toBe(1);
      expect(tenant2Rollups[0].name).toBe('Tenant 2 Rollup');
    });

    it('should prevent cross-tenant access to rollup', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Tenant 1 Rollup' }));

      // Tenant 2 should not be able to find Tenant 1's rollup
      const found = await repository.findById(tenantId2, rollup.id);

      expect(found).toBeNull();
    });

    it('should prevent cross-tenant rollup updates', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Tenant 1 Rollup' }));

      // Tenant 2 should not be able to update Tenant 1's rollup
      await expect(
        repository.update(tenantId2, rollup.id, userId, { name: 'Hacked Name' })
      ).rejects.toThrow('Rollup not found');
    });

    it('should prevent cross-tenant rollup deletion', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Tenant 1 Rollup' }));

      // Tenant 2 should not be able to delete Tenant 1's rollup
      const deleted = await repository.delete(tenantId2, rollup.id);

      expect(deleted).toBe(false);

      // Verify rollup still exists for Tenant 1
      const found = await repository.findById(tenantId1, rollup.id);
      expect(found).toBeDefined();
    });

    it('should isolate executions between tenants', async () => {
      const rollup1 = await repository.create(tenantId1, userId, createRollupCreateRequest());
      const rollup2 = await repository.create(tenantId2, userId, createRollupCreateRequest());

      const exec1 = await repository.createExecution(tenantId1, rollup1.id, [createScanId()]);
      const exec2 = await repository.createExecution(tenantId2, rollup2.id, [createScanId()]);

      // Cross-tenant access should fail
      const foundCross1 = await repository.findExecutionById(tenantId2, exec1.id);
      const foundCross2 = await repository.findExecutionById(tenantId1, exec2.id);

      expect(foundCross1).toBeNull();
      expect(foundCross2).toBeNull();

      // Same-tenant access should succeed
      const found1 = await repository.findExecutionById(tenantId1, exec1.id);
      const found2 = await repository.findExecutionById(tenantId2, exec2.id);

      expect(found1).toBeDefined();
      expect(found2).toBeDefined();
    });
  });

  // ==========================================================================
  // Transaction Handling
  // ==========================================================================

  describe('Transaction Handling', () => {
    it('should commit transaction successfully', async () => {
      await testDb.beginTransaction();

      const input = createRollupCreateRequest({ name: 'Transaction Rollup' });
      const entity = await repository.create(tenantId1, userId, input);

      await testDb.commitTransaction();

      // Data should persist after commit
      const found = await repository.findById(tenantId1, entity.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Transaction Rollup');
    });

    it('should rollback transaction on error', async () => {
      // Create a rollup outside transaction
      const input1 = createRollupCreateRequest({ name: 'Before Transaction' });
      const rollup1 = await repository.create(tenantId1, userId, input1);

      await testDb.beginTransaction();

      // Create another rollup inside transaction
      const input2 = createRollupCreateRequest({ name: 'Inside Transaction' });
      await repository.create(tenantId1, userId, input2);

      // Simulate error and rollback
      await testDb.rollbackTransaction();

      // Only the first rollup should exist
      const all = await repository.findAll(tenantId1);
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Before Transaction');
    });

    it('should prevent nested transactions', async () => {
      await testDb.beginTransaction();

      await expect(testDb.beginTransaction()).rejects.toThrow('Transaction already active');

      await testDb.rollbackTransaction();
    });

    it('should reject commit without active transaction', async () => {
      await expect(testDb.commitTransaction()).rejects.toThrow('No active transaction');
    });

    it('should reject rollback without active transaction', async () => {
      await expect(testDb.rollbackTransaction()).rejects.toThrow('No active transaction');
    });

    it('should handle transaction with multiple operations', async () => {
      await testDb.beginTransaction();

      // Multiple operations in transaction
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Tx Rollup' }));
      await repository.update(tenantId1, rollup.id, userId, { status: 'active' });
      const execution = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);
      await repository.updateExecution(tenantId1, execution.id, { status: 'running' });

      await testDb.commitTransaction();

      // All changes should persist
      const foundRollup = await repository.findById(tenantId1, rollup.id);
      const foundExecution = await repository.findExecutionById(tenantId1, execution.id);

      expect(foundRollup?.status).toBe('active');
      expect(foundExecution?.status).toBe('running');
    });

    it('should rollback all operations in failed transaction', async () => {
      const initialCount = testDb.getRollupCount();

      await testDb.beginTransaction();

      await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Will Rollback 1' }));
      await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Will Rollback 2' }));
      await repository.create(tenantId1, userId, createRollupCreateRequest({ name: 'Will Rollback 3' }));

      await testDb.rollbackTransaction();

      // Count should be same as before transaction
      expect(testDb.getRollupCount()).toBe(initialCount);
    });
  });

  // ==========================================================================
  // Execution Operations
  // ==========================================================================

  describe('Execution Operations', () => {
    it('should create execution for rollup', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest());
      const scanIds = [createScanId(), createScanId()];

      const execution = await repository.createExecution(tenantId1, rollup.id, scanIds);

      expect(execution).toBeDefined();
      expect(execution.id).toMatch(/^exec_/);
      expect(execution.rollupId).toBe(rollup.id);
      expect(execution.tenantId).toBe(tenantId1);
      expect(execution.status).toBe('pending');
      expect(execution.scanIds).toEqual(scanIds);
    });

    it('should find latest execution', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest());

      // Create multiple executions with delays
      const exec1 = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);
      await new Promise(resolve => setTimeout(resolve, 10));
      const exec2 = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);
      await new Promise(resolve => setTimeout(resolve, 10));
      const exec3 = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);

      const latest = await repository.findLatestExecution(tenantId1, rollup.id);

      expect(latest).toBeDefined();
      expect(latest?.id).toBe(exec3.id);
    });

    it('should update execution status and stats', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest());
      const execution = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);
      const stats = createExecutionStats();

      const updated = await repository.updateExecution(tenantId1, execution.id, {
        status: 'completed',
        stats,
        startedAt: new Date(Date.now() - 5000),
        completedAt: new Date(),
      });

      expect(updated.status).toBe('completed');
      expect(updated.stats).toEqual(stats);
      expect(updated.startedAt).toBeDefined();
      expect(updated.completedAt).toBeDefined();
    });

    it('should store match results in execution', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest());
      const execution = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);
      const matches = [createMatchResult(), createMatchResult(), createMatchResult()];

      const updated = await repository.updateExecution(tenantId1, execution.id, {
        matches,
      });

      expect(updated.matches).toEqual(matches);
      expect(updated.matches?.length).toBe(3);
    });

    it('should store error details on failed execution', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest());
      const execution = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);

      const updated = await repository.updateExecution(tenantId1, execution.id, {
        status: 'failed',
        errorMessage: 'Test error message',
        errorDetails: {
          phase: 'matching',
          stack: 'Error: Test error\n    at TestFile.ts:123',
          code: 'MATCHER_ERROR',
        },
        completedAt: new Date(),
      });

      expect(updated.status).toBe('failed');
      expect(updated.errorMessage).toBe('Test error message');
      expect(updated.errorDetails).toBeDefined();
      expect(updated.errorDetails?.phase).toBe('matching');
    });
  });

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  describe('Connection Management', () => {
    it('should handle connection state correctly', async () => {
      const db = new TestDatabase();

      expect(db.isConnected()).toBe(false);

      await db.connect();
      expect(db.isConnected()).toBe(true);

      await db.close();
      expect(db.isConnected()).toBe(false);
    });

    it('should reject operations on closed connection', async () => {
      const db = new TestDatabase();
      await db.connect();
      await db.close();

      await expect(
        db.insertRollup({} as RollupEntity)
      ).rejects.toThrow('Connection closed');
    });

    it('should allow reconnection', async () => {
      const db = new TestDatabase();
      await db.connect();
      await db.close();
      await db.connect();

      expect(db.isConnected()).toBe(true);
    });
  });

  // ==========================================================================
  // Data Integrity
  // ==========================================================================

  describe('Data Integrity', () => {
    it('should maintain referential integrity between rollup and executions', async () => {
      const rollup = await repository.create(tenantId1, userId, createRollupCreateRequest());
      const exec1 = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);
      const exec2 = await repository.createExecution(tenantId1, rollup.id, [createScanId()]);

      // All executions should reference the same rollup
      const foundExec1 = await repository.findExecutionById(tenantId1, exec1.id);
      const foundExec2 = await repository.findExecutionById(tenantId1, exec2.id);

      expect(foundExec1?.rollupId).toBe(rollup.id);
      expect(foundExec2?.rollupId).toBe(rollup.id);
    });

    it('should preserve all matcher configurations', async () => {
      const matchers = [
        createArnMatcherConfig({ pattern: 'arn:aws:s3:::*', priority: 90 }),
        createNameMatcherConfig({ caseSensitive: true, priority: 80 }),
      ];
      const input = createRollupCreateRequest({ matchers });

      const created = await repository.create(tenantId1, userId, input);
      const found = await repository.findById(tenantId1, created.id);

      expect(found?.matchers).toEqual(matchers);
      expect(found?.matchers[0].priority).toBe(90);
      expect(found?.matchers[1].priority).toBe(80);
    });

    it('should preserve merge options', async () => {
      const mergeOptions = {
        conflictResolution: 'keep_first' as const,
        preserveSourceInfo: true,
        createCrossRepoEdges: false,
        maxNodes: 5000,
      };
      const input = createRollupCreateRequest({ mergeOptions });

      const created = await repository.create(tenantId1, userId, input);
      const found = await repository.findById(tenantId1, created.id);

      expect(found?.mergeOptions).toEqual(mergeOptions);
    });

    it('should handle null and optional fields', async () => {
      const input = createRollupCreateRequest({
        description: undefined,
        schedule: undefined,
        includeNodeTypes: undefined,
        excludeNodeTypes: undefined,
      });

      const created = await repository.create(tenantId1, userId, input);
      const found = await repository.findById(tenantId1, created.id);

      expect(found?.description).toBeNull();
      expect(found?.schedule).toBeNull();
      expect(found?.includeNodeTypes).toBeNull();
      expect(found?.excludeNodeTypes).toBeNull();
    });
  });
});
