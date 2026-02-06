/**
 * Dashboard Utilities Unit Tests
 * Tests for formatNumber, formatRelativeTime, and event transformation functions
 * @module pages/dashboard/components/__tests__/utils.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  formatNumber,
  formatRelativeTime,
  mapEventTypeToActivityType,
  mapEventTypeToStatus,
  transformActivityEvent,
} from '../utils';
import type { ActivityEvent, ActivityEventType } from '@/features/dashboard';

// ============================================================================
// formatNumber Tests
// ============================================================================

describe('formatNumber', () => {
  describe('Small Numbers (< 1000)', () => {
    it('should return 0 as "0"', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should return 1 as "1"', () => {
      expect(formatNumber(1)).toBe('1');
    });

    it('should return 42 as "42"', () => {
      expect(formatNumber(42)).toBe('42');
    });

    it('should return 999 as "999"', () => {
      expect(formatNumber(999)).toBe('999');
    });

    it('should return 100 as "100"', () => {
      expect(formatNumber(100)).toBe('100');
    });

    it('should return 500 as "500"', () => {
      expect(formatNumber(500)).toBe('500');
    });
  });

  describe('Thousands (1K - 999K)', () => {
    it('should return 1000 as "1K"', () => {
      expect(formatNumber(1000)).toBe('1K');
    });

    it('should return 1234 as "1.2K"', () => {
      expect(formatNumber(1234)).toBe('1.2K');
    });

    it('should return 5678 as "5.7K"', () => {
      expect(formatNumber(5678)).toBe('5.7K');
    });

    it('should return 10000 as "10K"', () => {
      expect(formatNumber(10000)).toBe('10K');
    });

    it('should return 45200 as "45.2K"', () => {
      expect(formatNumber(45200)).toBe('45.2K');
    });

    it('should return 999999 as "1000K" (edge case)', () => {
      expect(formatNumber(999999)).toBe('1000K');
    });

    it('should return 1500 as "1.5K"', () => {
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('should return 2000 as "2K" (no decimal)', () => {
      expect(formatNumber(2000)).toBe('2K');
    });

    it('should return 99000 as "99K"', () => {
      expect(formatNumber(99000)).toBe('99K');
    });

    it('should return 100500 as "100.5K"', () => {
      expect(formatNumber(100500)).toBe('100.5K');
    });
  });

  describe('Millions (1M+)', () => {
    it('should return 1000000 as "1M"', () => {
      expect(formatNumber(1000000)).toBe('1M');
    });

    it('should return 1247000 as "1.2M"', () => {
      expect(formatNumber(1247000)).toBe('1.2M');
    });

    it('should return 5000000 as "5M"', () => {
      expect(formatNumber(5000000)).toBe('5M');
    });

    it('should return 10500000 as "10.5M"', () => {
      expect(formatNumber(10500000)).toBe('10.5M');
    });

    it('should return 1500000 as "1.5M"', () => {
      expect(formatNumber(1500000)).toBe('1.5M');
    });

    it('should return 2000000 as "2M" (no decimal)', () => {
      expect(formatNumber(2000000)).toBe('2M');
    });

    it('should return 999000000 as "999M"', () => {
      expect(formatNumber(999000000)).toBe('999M');
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative numbers (returns as-is since no special handling)', () => {
      // Current implementation doesn't format negative numbers specially
      expect(formatNumber(-500)).toBe('-500');
    });

    it('should handle negative thousands (returns as-is since comparison fails)', () => {
      // Current implementation: -1500 < 1000 is false, so no K suffix
      expect(formatNumber(-1500)).toBe('-1500');
    });

    it('should handle negative millions (returns as-is since comparison fails)', () => {
      // Current implementation: -1500000 < 1000000 is false, so no M suffix
      expect(formatNumber(-1500000)).toBe('-1500000');
    });

    it('should handle decimal input (rounds down)', () => {
      expect(formatNumber(1234.56)).toBe('1.2K');
    });
  });
});

// ============================================================================
// formatRelativeTime Tests
// ============================================================================

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Just Now (< 1 minute)', () => {
    it('should return "Just now" for current time', () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe('Just now');
    });

    it('should return "Just now" for 30 seconds ago', () => {
      const date = new Date(Date.now() - 30 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('Just now');
    });

    it('should return "Just now" for 59 seconds ago', () => {
      const date = new Date(Date.now() - 59 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('Just now');
    });
  });

  describe('Minutes Ago (1-59 minutes)', () => {
    it('should return "1 min ago" for 1 minute ago', () => {
      const date = new Date(Date.now() - 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('1 min ago');
    });

    it('should return "5 min ago" for 5 minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('5 min ago');
    });

    it('should return "30 min ago" for 30 minutes ago', () => {
      const date = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('30 min ago');
    });

    it('should return "59 min ago" for 59 minutes ago', () => {
      const date = new Date(Date.now() - 59 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('59 min ago');
    });
  });

  describe('Hours Ago (1-23 hours)', () => {
    it('should return "1 hour ago" for 1 hour ago (singular)', () => {
      const date = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('1 hour ago');
    });

    it('should return "2 hours ago" for 2 hours ago (plural)', () => {
      const date = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('2 hours ago');
    });

    it('should return "12 hours ago" for 12 hours ago', () => {
      const date = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('12 hours ago');
    });

    it('should return "23 hours ago" for 23 hours ago', () => {
      const date = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('23 hours ago');
    });
  });

  describe('Yesterday (24 hours)', () => {
    it('should return "Yesterday" for 24 hours ago', () => {
      const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('Yesterday');
    });

    it('should return "Yesterday" for exactly 1 day ago', () => {
      const date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('Yesterday');
    });
  });

  describe('Days Ago (2+ days)', () => {
    it('should return "2 days ago" for 2 days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('2 days ago');
    });

    it('should return "7 days ago" for 1 week ago', () => {
      const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('7 days ago');
    });

    it('should return "30 days ago" for 30 days ago', () => {
      const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('30 days ago');
    });

    it('should return "365 days ago" for 1 year ago', () => {
      const date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('365 days ago');
    });
  });

  describe('Edge Cases', () => {
    it('should handle future dates (negative diff)', () => {
      const futureDate = new Date(Date.now() + 60 * 1000).toISOString();
      // With negative diff, diffMinutes will be negative, so < 1
      expect(formatRelativeTime(futureDate)).toBe('Just now');
    });

    it('should handle ISO date string format', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(date)).toBe('5 min ago');
    });
  });
});

// ============================================================================
// mapEventTypeToActivityType Tests
// ============================================================================

describe('mapEventTypeToActivityType', () => {
  describe('Scan Events', () => {
    it('should map scan_completed to scan', () => {
      expect(mapEventTypeToActivityType('scan_completed')).toBe('scan');
    });

    it('should map scan_started to scan', () => {
      expect(mapEventTypeToActivityType('scan_started')).toBe('scan');
    });

    it('should map scan_failed to scan', () => {
      expect(mapEventTypeToActivityType('scan_failed')).toBe('scan');
    });
  });

  describe('Repository Events', () => {
    it('should map repository_added to repository', () => {
      expect(mapEventTypeToActivityType('repository_added')).toBe('repository');
    });
  });

  describe('Dependency Events', () => {
    it('should map dependency_changed to dependency', () => {
      expect(mapEventTypeToActivityType('dependency_changed')).toBe('dependency');
    });
  });

  describe('Default Fallback', () => {
    it('should default to scan for unknown types', () => {
      // Cast to any to test unknown type handling
      expect(mapEventTypeToActivityType('unknown_type' as ActivityEventType)).toBe('scan');
    });
  });
});

// ============================================================================
// mapEventTypeToStatus Tests
// ============================================================================

describe('mapEventTypeToStatus', () => {
  describe('Status Mapping', () => {
    it('should map scan_completed to success', () => {
      expect(mapEventTypeToStatus('scan_completed')).toBe('success');
    });

    it('should map scan_started to pending', () => {
      expect(mapEventTypeToStatus('scan_started')).toBe('pending');
    });

    it('should map scan_failed to error', () => {
      expect(mapEventTypeToStatus('scan_failed')).toBe('error');
    });
  });

  describe('No Status Cases', () => {
    it('should return undefined for repository_added', () => {
      expect(mapEventTypeToStatus('repository_added')).toBeUndefined();
    });

    it('should return undefined for dependency_changed', () => {
      expect(mapEventTypeToStatus('dependency_changed')).toBeUndefined();
    });

    it('should return undefined for unknown types', () => {
      expect(mapEventTypeToStatus('unknown_type' as ActivityEventType)).toBeUndefined();
    });
  });
});

// ============================================================================
// transformActivityEvent Tests
// ============================================================================

describe('transformActivityEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Scan Completed Event', () => {
    it('should transform scan_completed event correctly', () => {
      const event: ActivityEvent = {
        id: 'event-1',
        type: 'scan_completed',
        message: 'Scan completed for test-repo',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        metadata: { description: 'Full dependency scan' },
      };

      const result = transformActivityEvent(event);

      expect(result).toEqual({
        type: 'scan',
        title: 'Scan completed for test-repo',
        description: 'Full dependency scan',
        timestamp: '5 min ago',
        status: 'success',
      });
    });
  });

  describe('Scan Started Event', () => {
    it('should transform scan_started event correctly', () => {
      const event: ActivityEvent = {
        id: 'event-2',
        type: 'scan_started',
        message: 'Scan started for my-repo',
        timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        metadata: { description: 'Starting analysis' },
      };

      const result = transformActivityEvent(event);

      expect(result.type).toBe('scan');
      expect(result.status).toBe('pending');
      expect(result.timestamp).toBe('1 min ago');
    });
  });

  describe('Scan Failed Event', () => {
    it('should transform scan_failed event correctly', () => {
      const event: ActivityEvent = {
        id: 'event-3',
        type: 'scan_failed',
        message: 'Scan failed for broken-repo',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        metadata: { description: 'Configuration error', error: 'Parse error' },
      };

      const result = transformActivityEvent(event);

      expect(result.type).toBe('scan');
      expect(result.status).toBe('error');
      expect(result.timestamp).toBe('Yesterday');
      expect(result.description).toBe('Configuration error');
    });
  });

  describe('Repository Added Event', () => {
    it('should transform repository_added event correctly', () => {
      const event: ActivityEvent = {
        id: 'event-4',
        type: 'repository_added',
        message: 'Repository my-new-repo was added',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        metadata: { description: 'New repository connected' },
      };

      const result = transformActivityEvent(event);

      expect(result.type).toBe('repository');
      expect(result.status).toBeUndefined();
      expect(result.title).toBe('Repository my-new-repo was added');
    });
  });

  describe('Dependency Changed Event', () => {
    it('should transform dependency_changed event correctly', () => {
      const event: ActivityEvent = {
        id: 'event-5',
        type: 'dependency_changed',
        message: 'Dependencies updated in main-app',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { description: '5 packages updated' },
      };

      const result = transformActivityEvent(event);

      expect(result.type).toBe('dependency');
      expect(result.status).toBeUndefined();
      expect(result.timestamp).toBe('3 days ago');
    });
  });

  describe('Missing Metadata', () => {
    it('should handle event without metadata', () => {
      const event: ActivityEvent = {
        id: 'event-6',
        type: 'scan_completed',
        message: 'Scan completed',
        timestamp: new Date().toISOString(),
      };

      const result = transformActivityEvent(event);

      expect(result.description).toBe('');
      expect(result.title).toBe('Scan completed');
    });

    it('should handle event with empty metadata', () => {
      const event: ActivityEvent = {
        id: 'event-7',
        type: 'scan_completed',
        message: 'Scan completed',
        timestamp: new Date().toISOString(),
        metadata: {},
      };

      const result = transformActivityEvent(event);

      expect(result.description).toBe('');
    });

    it('should handle metadata without description', () => {
      const event: ActivityEvent = {
        id: 'event-8',
        type: 'scan_completed',
        message: 'Scan completed',
        timestamp: new Date().toISOString(),
        metadata: { repositoryId: 'repo-1' },
      };

      const result = transformActivityEvent(event);

      expect(result.description).toBe('');
    });
  });

  describe('Status Exclusion', () => {
    it('should not include status property when undefined', () => {
      const event: ActivityEvent = {
        id: 'event-9',
        type: 'repository_added',
        message: 'Repository added',
        timestamp: new Date().toISOString(),
        metadata: { description: 'Connected' },
      };

      const result = transformActivityEvent(event);

      // Using Object.prototype.hasOwnProperty for exactOptionalPropertyTypes compliance
      expect(Object.prototype.hasOwnProperty.call(result, 'status')).toBe(false);
    });

    it('should include status property when defined', () => {
      const event: ActivityEvent = {
        id: 'event-10',
        type: 'scan_completed',
        message: 'Scan completed',
        timestamp: new Date().toISOString(),
        metadata: { description: 'Done' },
      };

      const result = transformActivityEvent(event);

      expect(Object.prototype.hasOwnProperty.call(result, 'status')).toBe(true);
      expect(result.status).toBe('success');
    });
  });
});
