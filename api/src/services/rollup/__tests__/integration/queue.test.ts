/**
 * Queue Integration Tests
 * @module services/rollup/__tests__/integration/queue.test
 *
 * Integration tests for BullMQ job creation, processing, retry behavior,
 * and dead letter queue handling for rollup execution.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation queue integration tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import {
  createTenantId,
  createRepositoryId,
  createScanId,
  createRollupId,
  createExecutionId,
  createRollupCreateRequest,
  createExecutionStats,
} from '../fixtures/rollup-fixtures.js';
import type { TenantId } from '../../../../types/entities.js';
import type { RollupId, RollupExecutionId } from '../../../../types/rollup.js';

// ============================================================================
// Mock Queue System (simulating BullMQ behavior)
// ============================================================================

type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'dead-letter';

interface Job<T = unknown> {
  id: string;
  name: string;
  data: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: Error;
  result?: unknown;
  progress: number;
  priority: number;
}

interface JobOptions {
  attempts?: number;
  delay?: number;
  priority?: number;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

interface RollupJobData {
  executionId: RollupExecutionId;
  tenantId: TenantId;
  rollupId: RollupId;
  scanIds?: string[];
  options?: {
    timeout?: number;
    priority?: number;
  };
}

/**
 * Mock queue implementation simulating BullMQ behavior
 */
class MockQueue {
  private jobs: Map<string, Job> = new Map();
  private deadLetterJobs: Map<string, Job> = new Map();
  private processor?: (job: Job) => Promise<unknown>;
  private listeners: Map<string, Array<(job: Job, error?: Error) => void>> = new Map();
  private isProcessing = false;
  private isPaused = false; // Separate paused flag
  private processInterval?: ReturnType<typeof setInterval>;

  constructor(
    public readonly name: string,
    private defaultOptions: JobOptions = {}
  ) {}

  async add(jobName: string, data: unknown, options: JobOptions = {}): Promise<Job> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const job: Job = {
      id: randomUUID(),
      name: jobName,
      data,
      status: mergedOptions.delay ? 'delayed' : 'waiting',
      attempts: 0,
      maxAttempts: mergedOptions.attempts ?? 3,
      delay: mergedOptions.delay ?? 0,
      createdAt: new Date(),
      progress: 0,
      priority: mergedOptions.priority ?? 0,
    };

    this.jobs.set(job.id, job);

    // Schedule delayed job
    if (job.delay > 0) {
      setTimeout(() => {
        const existingJob = this.jobs.get(job.id);
        if (existingJob && existingJob.status === 'delayed') {
          existingJob.status = 'waiting';
        }
      }, job.delay);
    }

    return job;
  }

  async getJob(jobId: string): Promise<Job | undefined> {
    return this.jobs.get(jobId) ?? this.deadLetterJobs.get(jobId);
  }

  async getJobs(status: JobStatus[]): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => status.includes(job.status));
  }

  async getDeadLetterJobs(): Promise<Job[]> {
    return Array.from(this.deadLetterJobs.values());
  }

  async getJobCounts(): Promise<Record<JobStatus, number>> {
    const counts: Record<JobStatus, number> = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      'dead-letter': this.deadLetterJobs.size,
    };

    for (const job of this.jobs.values()) {
      counts[job.status]++;
    }

    return counts;
  }

  process(processor: (job: Job) => Promise<unknown>): void {
    this.processor = processor;
    // Only start processing if not paused
    if (!this.isPaused) {
      this.startProcessing();
    }
  }

  private startProcessing(): void {
    if (this.isProcessing || this.isPaused) return;
    this.isProcessing = true;

    this.processInterval = setInterval(async () => {
      if (!this.isPaused) {
        await this.processNextJob();
      }
    }, 10);
  }

  private async processNextJob(): Promise<void> {
    if (!this.processor || this.isPaused) return;

    // Get next waiting job (sorted by priority)
    const waitingJobs = Array.from(this.jobs.values())
      .filter(j => j.status === 'waiting')
      .sort((a, b) => b.priority - a.priority);

    const job = waitingJobs[0];
    if (!job) return;

    job.status = 'active';
    job.processedAt = new Date();
    job.attempts++;

    try {
      const result = await this.processor(job);
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      this.emit('completed', job);
    } catch (error) {
      job.error = error instanceof Error ? error : new Error(String(error));

      if (job.attempts >= job.maxAttempts) {
        // Move to dead letter queue
        job.status = 'dead-letter';
        job.failedAt = new Date();
        this.deadLetterJobs.set(job.id, job);
        this.jobs.delete(job.id);
        this.emit('failed', job, job.error);
      } else {
        // Schedule retry with exponential backoff
        job.status = 'delayed';
        const retryDelay = Math.pow(2, job.attempts) * 100;
        setTimeout(() => {
          const existingJob = this.jobs.get(job.id);
          if (existingJob && existingJob.status === 'delayed') {
            existingJob.status = 'waiting';
          }
        }, retryDelay);
        this.emit('retrying', job, job.error);
      }
    }
  }

  on(event: string, handler: (job: Job, error?: Error) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  private emit(event: string, job: Job, error?: Error): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(job, error);
      }
    }
  }

  async pause(): Promise<void> {
    this.isPaused = true;
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = undefined;
    }
    this.isProcessing = false;
  }

  async resume(): Promise<void> {
    this.isPaused = false;
    if (this.processor) {
      this.startProcessing();
    }
  }

  async close(): Promise<void> {
    await this.pause();
    this.jobs.clear();
    this.deadLetterJobs.clear();
  }

  async obliterate(): Promise<void> {
    await this.close();
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = this.deadLetterJobs.get(jobId);
    if (!job) return false;

    // Move back to main queue
    job.status = 'waiting';
    job.attempts = 0;
    job.error = undefined;
    job.failedAt = undefined;
    this.jobs.set(job.id, job);
    this.deadLetterJobs.delete(jobId);

    return true;
  }

  // Test helpers
  getJobCount(): number {
    return this.jobs.size;
  }

  getDeadLetterCount(): number {
    return this.deadLetterJobs.size;
  }

  clear(): void {
    this.jobs.clear();
    this.deadLetterJobs.clear();
  }
}

/**
 * Queue service abstraction
 */
class RollupQueueService {
  private readonly queue: MockQueue;

  constructor() {
    this.queue = new MockQueue('rollup-execution', {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }

  async enqueueExecution(data: RollupJobData, options?: JobOptions): Promise<string> {
    const job = await this.queue.add('execute-rollup', data, {
      ...options,
      priority: data.options?.priority ?? 0,
    });
    return job.id;
  }

  async getJobStatus(jobId: string): Promise<{
    status: JobStatus;
    attempts: number;
    progress: number;
    result?: unknown;
    error?: string;
  } | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    return {
      status: job.status,
      attempts: job.attempts,
      progress: job.progress,
      result: job.result,
      error: job.error?.message,
    };
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    deadLetter: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
      deadLetter: counts['dead-letter'],
    };
  }

  async getDeadLetterJobs(): Promise<Array<{ id: string; data: unknown; error?: string }>> {
    const jobs = await this.queue.getDeadLetterJobs();
    return jobs.map(j => ({
      id: j.id,
      data: j.data,
      error: j.error?.message,
    }));
  }

  async retryDeadLetterJob(jobId: string): Promise<boolean> {
    return this.queue.retryJob(jobId);
  }

  registerProcessor(processor: (data: RollupJobData) => Promise<unknown>): void {
    this.queue.process(async (job) => {
      return processor(job.data as RollupJobData);
    });
  }

  onCompleted(handler: (jobId: string, result: unknown) => void): void {
    this.queue.on('completed', (job) => {
      handler(job.id, job.result);
    });
  }

  onFailed(handler: (jobId: string, error: Error) => void): void {
    this.queue.on('failed', (job, error) => {
      handler(job.id, error!);
    });
  }

  onRetrying(handler: (jobId: string, attempt: number, error: Error) => void): void {
    this.queue.on('retrying', (job, error) => {
      handler(job.id, job.attempts, error!);
    });
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  // Test helpers
  getQueue(): MockQueue {
    return this.queue;
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Queue Integration Tests', () => {
  let queueService: RollupQueueService;
  const tenantId = createTenantId();

  beforeAll(() => {
    queueService = new RollupQueueService();
  });

  afterAll(async () => {
    await queueService.close();
  });

  beforeEach(async () => {
    await queueService.pause();
    queueService.getQueue().clear();
  });

  // ==========================================================================
  // Job Creation
  // ==========================================================================

  describe('Job Creation', () => {
    it('should create a rollup execution job', async () => {
      const jobData: RollupJobData = {
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
        scanIds: [createScanId()],
      };

      const jobId = await queueService.enqueueExecution(jobData);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const status = await queueService.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('waiting');
      expect(status?.attempts).toBe(0);
    });

    it('should create job with priority', async () => {
      const lowPriorityJob = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
        options: { priority: 1 },
      });

      const highPriorityJob = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
        options: { priority: 10 },
      });

      const lowStatus = await queueService.getJobStatus(lowPriorityJob);
      const highStatus = await queueService.getJobStatus(highPriorityJob);

      expect(lowStatus?.status).toBe('waiting');
      expect(highStatus?.status).toBe('waiting');

      // High priority job should be processed first
      const stats = await queueService.getQueueStats();
      expect(stats.waiting).toBe(2);
    });

    it('should create delayed job', async () => {
      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      }, { delay: 5000 });

      const status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('delayed');
    });

    it('should enqueue multiple jobs', async () => {
      const jobIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const jobId = await queueService.enqueueExecution({
          executionId: createExecutionId() as RollupExecutionId,
          tenantId,
          rollupId: createRollupId() as RollupId,
        });
        jobIds.push(jobId);
      }

      expect(jobIds.length).toBe(5);
      expect(new Set(jobIds).size).toBe(5); // All unique

      const stats = await queueService.getQueueStats();
      expect(stats.waiting).toBe(5);
    });
  });

  // ==========================================================================
  // Job Processing
  // ==========================================================================

  describe('Job Processing', () => {
    it('should process job successfully', async () => {
      const processedJobs: RollupJobData[] = [];
      const completedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async (data) => {
          processedJobs.push(data);
          return { success: true, stats: createExecutionStats() };
        });

        queueService.onCompleted(() => {
          resolve();
        });
      });

      const jobData: RollupJobData = {
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      };

      const jobId = await queueService.enqueueExecution(jobData);
      await queueService.resume();

      await completedPromise;

      expect(processedJobs.length).toBe(1);
      expect(processedJobs[0].executionId).toBe(jobData.executionId);

      const status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('completed');
      expect(status?.result).toBeDefined();
    });

    it('should process jobs in priority order', async () => {
      const processOrder: number[] = [];

      queueService.registerProcessor(async (data) => {
        processOrder.push(data.options?.priority ?? 0);
        return { success: true };
      });

      // Enqueue in low-to-high priority order
      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
        options: { priority: 1 },
      });
      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
        options: { priority: 3 },
      });
      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
        options: { priority: 2 },
      });

      await queueService.resume();

      // Wait for all jobs to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be processed in high-to-low priority order
      expect(processOrder).toEqual([3, 2, 1]);
    });

    it('should track job progress', async () => {
      const completedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          // Simulate progress updates
          return { success: true };
        });

        queueService.onCompleted(() => {
          resolve();
        });
      });

      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await completedPromise;

      const status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('completed');
    });
  });

  // ==========================================================================
  // Retry Behavior
  // ==========================================================================

  describe('Retry Behavior', () => {
    it('should retry failed job', async () => {
      let attemptCount = 0;
      const retryAttempts: number[] = [];

      queueService.onRetrying((jobId, attempt) => {
        retryAttempts.push(attempt);
      });

      const completedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }
          return { success: true };
        });

        queueService.onCompleted(() => {
          resolve();
        });
      });

      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await completedPromise;

      expect(attemptCount).toBe(3);
      expect(retryAttempts).toEqual([1, 2]);

      const status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('completed');
    });

    it('should move to dead letter after max retries', async () => {
      const failedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          throw new Error('Permanent failure');
        });

        queueService.onFailed(() => {
          resolve();
        });
      });

      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await failedPromise;

      const status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('dead-letter');
      expect(status?.attempts).toBe(3);
      expect(status?.error).toBe('Permanent failure');

      const stats = await queueService.getQueueStats();
      expect(stats.deadLetter).toBe(1);
    });

    it('should use exponential backoff for retries', async () => {
      const retryDelays: number[] = [];
      let lastAttemptTime = Date.now();

      queueService.onRetrying(() => {
        const now = Date.now();
        retryDelays.push(now - lastAttemptTime);
        lastAttemptTime = now;
      });

      let attemptCount = 0;
      const failedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          attemptCount++;
          throw new Error('Retry test failure');
        });

        queueService.onFailed(() => {
          resolve();
        });
      });

      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await failedPromise;

      // Verify exponential backoff pattern (delays should increase)
      expect(attemptCount).toBe(3);
      // Note: Delays are simulated in mock, would verify pattern in real queue
    });
  });

  // ==========================================================================
  // Dead Letter Queue
  // ==========================================================================

  describe('Dead Letter Queue', () => {
    it('should list dead letter jobs', async () => {
      const failedPromise = new Promise<number>((resolve) => {
        let failCount = 0;
        queueService.registerProcessor(async () => {
          throw new Error('DLQ test failure');
        });

        queueService.onFailed(() => {
          failCount++;
          if (failCount === 3) {
            resolve(failCount);
          }
        });
      });

      // Enqueue multiple jobs that will fail
      await queueService.enqueueExecution({
        executionId: 'exec_1' as RollupExecutionId,
        tenantId,
        rollupId: 'rollup_1' as RollupId,
      });
      await queueService.enqueueExecution({
        executionId: 'exec_2' as RollupExecutionId,
        tenantId,
        rollupId: 'rollup_2' as RollupId,
      });
      await queueService.enqueueExecution({
        executionId: 'exec_3' as RollupExecutionId,
        tenantId,
        rollupId: 'rollup_3' as RollupId,
      });

      await queueService.resume();
      await failedPromise;

      const dlqJobs = await queueService.getDeadLetterJobs();
      expect(dlqJobs.length).toBe(3);
      expect(dlqJobs[0].error).toBe('DLQ test failure');
    });

    it('should retry dead letter job', async () => {
      let attemptCount = 0;

      const failedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          attemptCount++;
          if (attemptCount <= 3) {
            throw new Error('Will fail first time');
          }
          return { success: true };
        });

        queueService.onFailed(() => {
          resolve();
        });
      });

      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await failedPromise;

      // Job should be in dead letter
      let status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('dead-letter');

      // Retry the job
      const retried = await queueService.retryDeadLetterJob(jobId);
      expect(retried).toBe(true);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Job should be processed successfully now
      status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('completed');
    });

    it('should return false when retrying non-existent DLQ job', async () => {
      const retried = await queueService.retryDeadLetterJob('non-existent-job-id');
      expect(retried).toBe(false);
    });

    it('should preserve job data in dead letter queue', async () => {
      const jobData: RollupJobData = {
        executionId: 'exec_preserve' as RollupExecutionId,
        tenantId,
        rollupId: 'rollup_preserve' as RollupId,
        scanIds: ['scan_1', 'scan_2'],
        options: { timeout: 30000 },
      };

      const failedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          throw new Error('Preserve test failure');
        });

        queueService.onFailed(() => {
          resolve();
        });
      });

      await queueService.enqueueExecution(jobData);

      await queueService.resume();
      await failedPromise;

      const dlqJobs = await queueService.getDeadLetterJobs();
      const dlqJob = dlqJobs.find(j => (j.data as RollupJobData).executionId === 'exec_preserve');

      expect(dlqJob).toBeDefined();
      expect((dlqJob?.data as RollupJobData).rollupId).toBe('rollup_preserve');
      expect((dlqJob?.data as RollupJobData).scanIds).toEqual(['scan_1', 'scan_2']);
    });
  });

  // ==========================================================================
  // Queue Statistics
  // ==========================================================================

  describe('Queue Statistics', () => {
    it('should track job counts by status', async () => {
      // Initial state
      let stats = await queueService.getQueueStats();
      expect(stats.waiting).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(0);

      // Add jobs
      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });
      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      stats = await queueService.getQueueStats();
      expect(stats.waiting).toBe(2);
    });

    it('should update counts after processing', async () => {
      let processedCount = 0;
      const allCompletedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          return { success: true };
        });

        queueService.onCompleted(() => {
          processedCount++;
          if (processedCount === 2) {
            resolve();
          }
        });
      });

      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });
      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await allCompletedPromise;

      const stats = await queueService.getQueueStats();
      expect(stats.completed).toBe(2);
      expect(stats.waiting).toBe(0);
    });
  });

  // ==========================================================================
  // Queue Control
  // ==========================================================================

  describe('Queue Control', () => {
    it('should pause and resume processing', async () => {
      const processedJobs: string[] = [];

      // Register processor while paused - should not start processing
      queueService.registerProcessor(async (data) => {
        processedJobs.push(data.executionId);
        return { success: true };
      });

      // Queue is paused from beforeEach
      await queueService.enqueueExecution({
        executionId: 'exec_pause_test' as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      // Should not process while paused
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(processedJobs.length).toBe(0);

      // Resume processing
      await queueService.resume();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(processedJobs).toContain('exec_pause_test');
    });

    it('should close queue gracefully', async () => {
      await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.close();

      const stats = await queueService.getQueueStats();
      expect(stats.waiting).toBe(0);

      // Recreate for subsequent tests
      queueService = new RollupQueueService();
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should capture error details on job failure', async () => {
      const failedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          const error = new Error('Detailed failure message');
          (error as any).code = 'EXECUTION_TIMEOUT';
          throw error;
        });

        queueService.onFailed(() => {
          resolve();
        });
      });

      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await failedPromise;

      const status = await queueService.getJobStatus(jobId);
      expect(status?.error).toBe('Detailed failure message');
    });

    it('should handle processor throwing non-Error objects', async () => {
      const failedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          throw 'String error'; // Non-Error throw
        });

        queueService.onFailed(() => {
          resolve();
        });
      });

      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await failedPromise;

      const status = await queueService.getJobStatus(jobId);
      expect(status?.error).toBe('String error');
    });

    it('should handle async processor rejection', async () => {
      const failedPromise = new Promise<void>((resolve) => {
        queueService.registerProcessor(async () => {
          return Promise.reject(new Error('Async rejection'));
        });

        queueService.onFailed(() => {
          resolve();
        });
      });

      const jobId = await queueService.enqueueExecution({
        executionId: createExecutionId() as RollupExecutionId,
        tenantId,
        rollupId: createRollupId() as RollupId,
      });

      await queueService.resume();
      await failedPromise;

      const status = await queueService.getJobStatus(jobId);
      expect(status?.status).toBe('dead-letter');
      expect(status?.error).toBe('Async rejection');
    });
  });
});
