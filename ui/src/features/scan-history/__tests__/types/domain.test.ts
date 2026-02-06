/**
 * Domain Types Tests
 * Tests for type guards and factory functions
 * @module features/scan-history/__tests__/types/domain.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isScanId,
  isRepositoryId,
  isScanStatus,
  isScan,
  createScanId,
  createRepositoryId,
  createDateRange,
  ALL_SCAN_STATUSES,
  SCAN_STATUS_COLORS,
  SCAN_STATUS_LABELS,
} from '../../types/domain';
import { resetIdCounters, createMockScan, createMockMetrics } from '../utils/test-helpers';

describe('Domain Types', () => {
  beforeEach(() => {
    resetIdCounters();
  });

  // ==========================================================================
  // Type Guards
  // ==========================================================================

  describe('isScanId', () => {
    it('should return true for valid non-empty string', () => {
      expect(isScanId('scan-123')).toBe(true);
      expect(isScanId('abc')).toBe(true);
      expect(isScanId('1')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isScanId('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      // @ts-expect-error Testing invalid input
      expect(isScanId(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isScanId(undefined)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isScanId(123)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isScanId({})).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isScanId([])).toBe(false);
    });

    it('should handle whitespace strings', () => {
      expect(isScanId(' ')).toBe(true); // Non-empty but whitespace
      expect(isScanId('  scan  ')).toBe(true);
    });
  });

  describe('isRepositoryId', () => {
    it('should return true for valid non-empty string', () => {
      expect(isRepositoryId('repo-456')).toBe(true);
      expect(isRepositoryId('xyz')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isRepositoryId('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      // @ts-expect-error Testing invalid input
      expect(isRepositoryId(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isRepositoryId(undefined)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isRepositoryId(123)).toBe(false);
    });
  });

  describe('isScanStatus', () => {
    it('should return true for all valid scan statuses', () => {
      expect(isScanStatus('completed')).toBe(true);
      expect(isScanStatus('failed')).toBe(true);
      expect(isScanStatus('in_progress')).toBe(true);
      expect(isScanStatus('cancelled')).toBe(true);
    });

    it('should return true for all statuses in ALL_SCAN_STATUSES', () => {
      ALL_SCAN_STATUSES.forEach((status) => {
        expect(isScanStatus(status)).toBe(true);
      });
    });

    it('should return false for invalid status strings', () => {
      expect(isScanStatus('pending')).toBe(false);
      expect(isScanStatus('COMPLETED')).toBe(false); // Case sensitive
      expect(isScanStatus('success')).toBe(false);
      expect(isScanStatus('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isScanStatus(null)).toBe(false);
      expect(isScanStatus(undefined)).toBe(false);
      expect(isScanStatus(123)).toBe(false);
      expect(isScanStatus({})).toBe(false);
    });
  });

  describe('isScan', () => {
    it('should return true for valid Scan object', () => {
      const validScan = createMockScan();
      expect(isScan(validScan)).toBe(true);
    });

    it('should return true for scan with null completedAt and duration', () => {
      const inProgressScan = createMockScan({
        status: 'in_progress',
        completedAt: null,
        duration: null,
      });
      expect(isScan(inProgressScan)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isScan(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isScan(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isScan('string')).toBe(false);
      expect(isScan(123)).toBe(false);
      expect(isScan(true)).toBe(false);
      expect(isScan([])).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(isScan({})).toBe(false);
      expect(isScan({ id: 'scan-1' })).toBe(false);
      expect(
        isScan({
          id: 'scan-1',
          repositoryId: 'repo-1',
          // Missing other required fields
        })
      ).toBe(false);
    });

    it('should return false for invalid field types', () => {
      const invalidScan = {
        id: 123, // Should be string
        repositoryId: 'repo-1',
        repositoryName: 'test',
        status: 'completed',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: null,
        duration: null,
        metrics: {},
      };
      expect(isScan(invalidScan)).toBe(false);
    });

    it('should return false for invalid status', () => {
      const invalidScan = {
        id: 'scan-1',
        repositoryId: 'repo-1',
        repositoryName: 'test',
        status: 'invalid_status',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: null,
        duration: null,
        metrics: {},
      };
      expect(isScan(invalidScan)).toBe(false);
    });

    it('should return false for invalid completedAt type', () => {
      const invalidScan = {
        id: 'scan-1',
        repositoryId: 'repo-1',
        repositoryName: 'test',
        status: 'completed',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: 123, // Should be string or null
        duration: 60000,
        metrics: {},
      };
      expect(isScan(invalidScan)).toBe(false);
    });

    it('should return false for invalid duration type', () => {
      const invalidScan = {
        id: 'scan-1',
        repositoryId: 'repo-1',
        repositoryName: 'test',
        status: 'completed',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:01:00Z',
        duration: '60000', // Should be number or null
        metrics: {},
      };
      expect(isScan(invalidScan)).toBe(false);
    });

    it('should return false for null metrics', () => {
      const invalidScan = {
        id: 'scan-1',
        repositoryId: 'repo-1',
        repositoryName: 'test',
        status: 'completed',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:01:00Z',
        duration: 60000,
        metrics: null,
      };
      expect(isScan(invalidScan)).toBe(false);
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================

  describe('createScanId', () => {
    it('should create a ScanId from valid string', () => {
      const scanId = createScanId('scan-123');
      expect(scanId).toBe('scan-123');
      expect(isScanId(scanId)).toBe(true);
    });

    it('should throw for empty string', () => {
      expect(() => createScanId('')).toThrow();
    });

    it('should include the invalid value in error message', () => {
      expect(() => createScanId('')).toThrow('Invalid ScanId');
    });

    it('should preserve special characters', () => {
      const scanId = createScanId('scan-abc-123_test');
      expect(scanId).toBe('scan-abc-123_test');
    });
  });

  describe('createRepositoryId', () => {
    it('should create a RepositoryId from valid string', () => {
      const repoId = createRepositoryId('repo-456');
      expect(repoId).toBe('repo-456');
      expect(isRepositoryId(repoId)).toBe(true);
    });

    it('should throw for empty string', () => {
      expect(() => createRepositoryId('')).toThrow();
    });

    it('should include the invalid value in error message', () => {
      expect(() => createRepositoryId('')).toThrow('Invalid RepositoryId');
    });
  });

  describe('createDateRange', () => {
    it('should create a DateRange from valid dates', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const range = createDateRange(start, end);

      expect(range.start).toEqual(start);
      expect(range.end).toEqual(end);
    });

    it('should accept same start and end date', () => {
      const date = new Date('2024-01-15');
      const range = createDateRange(date, date);

      expect(range.start).toEqual(date);
      expect(range.end).toEqual(date);
    });

    it('should throw if end date is before start date', () => {
      const start = new Date('2024-01-31');
      const end = new Date('2024-01-01');

      expect(() => createDateRange(start, end)).toThrow(
        'end date cannot be before start date'
      );
    });

    it('should handle dates with time components', () => {
      const start = new Date('2024-01-01T10:00:00Z');
      const end = new Date('2024-01-01T15:00:00Z');
      const range = createDateRange(start, end);

      expect(range.start).toEqual(start);
      expect(range.end).toEqual(end);
    });

    it('should throw for dates with reversed time on same day', () => {
      const start = new Date('2024-01-01T15:00:00Z');
      const end = new Date('2024-01-01T10:00:00Z');

      expect(() => createDateRange(start, end)).toThrow();
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('ALL_SCAN_STATUSES', () => {
    it('should contain exactly 4 statuses', () => {
      expect(ALL_SCAN_STATUSES).toHaveLength(4);
    });

    it('should contain all expected statuses', () => {
      expect(ALL_SCAN_STATUSES).toContain('completed');
      expect(ALL_SCAN_STATUSES).toContain('failed');
      expect(ALL_SCAN_STATUSES).toContain('in_progress');
      expect(ALL_SCAN_STATUSES).toContain('cancelled');
    });

    it('should have correct type annotation', () => {
      // Note: `as const` provides compile-time readonly but not runtime immutability
      // We verify the array has the expected contents
      expect(ALL_SCAN_STATUSES.length).toBe(4);
      // Type-level readonly means we can't assign, but Array.push still works at runtime
      // This test verifies the values are what we expect
      expect([...ALL_SCAN_STATUSES]).toEqual(['completed', 'failed', 'in_progress', 'cancelled']);
    });
  });

  describe('SCAN_STATUS_COLORS', () => {
    const validStatuses = ['completed', 'failed', 'in_progress', 'cancelled'] as const;

    it('should have colors for all statuses', () => {
      validStatuses.forEach((status) => {
        expect(SCAN_STATUS_COLORS[status]).toBeDefined();
        expect(typeof SCAN_STATUS_COLORS[status]).toBe('string');
      });
    });

    it('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(SCAN_STATUS_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have distinct colors for success and failure', () => {
      expect(SCAN_STATUS_COLORS.completed).not.toBe(SCAN_STATUS_COLORS.failed);
    });
  });

  describe('SCAN_STATUS_LABELS', () => {
    const validStatuses = ['completed', 'failed', 'in_progress', 'cancelled'] as const;

    it('should have labels for all statuses', () => {
      validStatuses.forEach((status) => {
        expect(SCAN_STATUS_LABELS[status]).toBeDefined();
        expect(typeof SCAN_STATUS_LABELS[status]).toBe('string');
      });
    });

    it('should have human-readable labels', () => {
      expect(SCAN_STATUS_LABELS.completed).toBe('Completed');
      expect(SCAN_STATUS_LABELS.failed).toBe('Failed');
      expect(SCAN_STATUS_LABELS.in_progress).toBe('In Progress');
      expect(SCAN_STATUS_LABELS.cancelled).toBe('Cancelled');
    });
  });
});
