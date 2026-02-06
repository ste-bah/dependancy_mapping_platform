/**
 * Mock Repository Implementation
 * @module services/rollup/__tests__/utils/mock-repository
 *
 * Mock implementation of IRollupRepository for testing.
 */

import { vi, type Mock } from 'vitest';
import type {
  IRollupRepository,
  RollupEntity,
  RollupExecutionEntity,
} from '../../interfaces.js';
import type {
  RollupId,
  RollupExecutionId,
  RollupStatus,
  RollupCreateRequest,
  RollupUpdateRequest,
  RollupListQuery,
  RollupExecuteRequest,
  RollupExecutionStats,
  MatchResult,
} from '../../../../types/rollup.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';
import { randomUUID } from 'crypto';

// ============================================================================
// Mock Repository Implementation
// ============================================================================

export class MockRollupRepository implements IRollupRepository {
  private rollups: Map<string, RollupEntity> = new Map();
  private executions: Map<string, RollupExecutionEntity> = new Map();

  // Spy functions for verification
  public createSpy: Mock;
  public findByIdSpy: Mock;
  public findManySpy: Mock;
  public updateSpy: Mock;
  public deleteSpy: Mock;
  public updateStatusSpy: Mock;
  public createExecutionSpy: Mock;
  public findExecutionByIdSpy: Mock;
  public findLatestExecutionSpy: Mock;
  public updateExecutionSpy: Mock;
  public listExecutionsSpy: Mock;

  constructor() {
    this.createSpy = vi.fn();
    this.findByIdSpy = vi.fn();
    this.findManySpy = vi.fn();
    this.updateSpy = vi.fn();
    this.deleteSpy = vi.fn();
    this.updateStatusSpy = vi.fn();
    this.createExecutionSpy = vi.fn();
    this.findExecutionByIdSpy = vi.fn();
    this.findLatestExecutionSpy = vi.fn();
    this.updateExecutionSpy = vi.fn();
    this.listExecutionsSpy = vi.fn();
  }

  async create(
    tenantId: TenantId,
    userId: string,
    input: RollupCreateRequest
  ): Promise<RollupEntity> {
    this.createSpy(tenantId, userId, input);

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

    this.rollups.set(entity.id, entity);
    return entity;
  }

  async findById(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<RollupEntity | null> {
    this.findByIdSpy(tenantId, rollupId);
    const entity = this.rollups.get(rollupId);
    if (entity && entity.tenantId === tenantId) {
      return entity;
    }
    return null;
  }

  async findMany(
    tenantId: TenantId,
    query: RollupListQuery
  ): Promise<{ data: RollupEntity[]; total: number }> {
    this.findManySpy(tenantId, query);

    const allEntities = Array.from(this.rollups.values())
      .filter((e) => e.tenantId === tenantId);

    let filtered = allEntities;

    if (query.status) {
      filtered = filtered.filter((e) => e.status === query.status);
    }

    if (query.repositoryId) {
      filtered = filtered.filter((e) =>
        e.repositoryIds.includes(query.repositoryId as RepositoryId)
      );
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((e) =>
        e.name.toLowerCase().includes(search) ||
        (e.description?.toLowerCase().includes(search) ?? false)
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: filtered.slice(start, end),
      total: filtered.length,
    };
  }

  async update(
    tenantId: TenantId,
    rollupId: RollupId,
    userId: string,
    input: RollupUpdateRequest,
    expectedVersion?: number
  ): Promise<RollupEntity> {
    this.updateSpy(tenantId, rollupId, userId, input, expectedVersion);

    const existing = this.rollups.get(rollupId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Rollup not found');
    }

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new Error('Version conflict');
    }

    const updated: RollupEntity = {
      ...existing,
      ...input,
      version: existing.version + 1,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    this.rollups.set(rollupId, updated);
    return updated;
  }

  async delete(tenantId: TenantId, rollupId: RollupId): Promise<boolean> {
    this.deleteSpy(tenantId, rollupId);

    const existing = this.rollups.get(rollupId);
    if (!existing || existing.tenantId !== tenantId) {
      return false;
    }

    this.rollups.delete(rollupId);
    return true;
  }

  async updateStatus(
    tenantId: TenantId,
    rollupId: RollupId,
    status: RollupStatus
  ): Promise<RollupEntity> {
    this.updateStatusSpy(tenantId, rollupId, status);

    const existing = this.rollups.get(rollupId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Rollup not found');
    }

    const updated: RollupEntity = {
      ...existing,
      status,
      updatedAt: new Date(),
    };

    this.rollups.set(rollupId, updated);
    return updated;
  }

  async createExecution(
    tenantId: TenantId,
    rollupId: RollupId,
    scanIds: ScanId[],
    options?: RollupExecuteRequest['options'],
    callbackUrl?: string
  ): Promise<RollupExecutionEntity> {
    this.createExecutionSpy(tenantId, rollupId, scanIds, options, callbackUrl);

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
      callbackUrl: callbackUrl ?? null,
      options: options ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    };

    this.executions.set(entity.id, entity);
    return entity;
  }

  async findExecutionById(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<RollupExecutionEntity | null> {
    this.findExecutionByIdSpy(tenantId, executionId);

    const entity = this.executions.get(executionId);
    if (entity && entity.tenantId === tenantId) {
      return entity;
    }
    return null;
  }

  async findLatestExecution(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<RollupExecutionEntity | null> {
    this.findLatestExecutionSpy(tenantId, rollupId);

    const executions = Array.from(this.executions.values())
      .filter((e) => e.tenantId === tenantId && e.rollupId === rollupId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return executions[0] ?? null;
  }

  async updateExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    update: {
      status?: RollupExecutionEntity['status'];
      stats?: RollupExecutionStats;
      matches?: MatchResult[];
      mergedGraphId?: string;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<RollupExecutionEntity> {
    this.updateExecutionSpy(tenantId, executionId, update);

    const existing = this.executions.get(executionId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Execution not found');
    }

    const updated: RollupExecutionEntity = {
      ...existing,
      status: update.status ?? existing.status,
      stats: update.stats ?? existing.stats,
      matches: update.matches ?? existing.matches,
      mergedGraphId: update.mergedGraphId ?? existing.mergedGraphId,
      errorMessage: update.errorMessage ?? existing.errorMessage,
      errorDetails: update.errorDetails ?? existing.errorDetails,
      startedAt: update.startedAt ?? existing.startedAt,
      completedAt: update.completedAt ?? existing.completedAt,
    };

    this.executions.set(executionId, updated);
    return updated;
  }

  async listExecutions(
    tenantId: TenantId,
    rollupId: RollupId,
    limit?: number
  ): Promise<RollupExecutionEntity[]> {
    this.listExecutionsSpy(tenantId, rollupId, limit);

    const executions = Array.from(this.executions.values())
      .filter((e) => e.tenantId === tenantId && e.rollupId === rollupId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return limit ? executions.slice(0, limit) : executions;
  }

  // ============================================================================
  // Test Helpers
  // ============================================================================

  reset(): void {
    this.rollups.clear();
    this.executions.clear();
    vi.clearAllMocks();
  }

  seedRollup(entity: RollupEntity): void {
    this.rollups.set(entity.id, entity);
  }

  seedExecution(entity: RollupExecutionEntity): void {
    this.executions.set(entity.id, entity);
  }

  getRollupCount(): number {
    return this.rollups.size;
  }

  getExecutionCount(): number {
    return this.executions.size;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMockRollupRepository(): MockRollupRepository {
  return new MockRollupRepository();
}
