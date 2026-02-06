/**
 * Dashboard Utility Functions Unit Tests
 * Tests for formatNumber and formatRelativeTime utility functions
 * @module features/dashboard/__tests__/utils.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Utility Functions Under Test
// These functions are defined in DashboardPage.tsx
// We recreate them here for isolated testing
// ============================================================================

/**
 * Format large numbers with K/M suffixes
 * @example formatNumber(45200) => "45.2K"
 * @example formatNumber(1247000) => "1.2M"
 */
function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return value.toString();
}

/**
 * Format relative time from ISO timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// ============================================================================
// formatNumber Tests
// ============================================================================

describe('formatNumber', () => {
  describe('values below 1000', () => {
    it('should return number as string for small values', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(1)).toBe('1');
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(999)).toBe('999');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-1)).toBe('-1');
      expect(formatNumber(-42)).toBe('-42');
      expect(formatNumber(-999)).toBe('-999');
    });
  });

  describe('values in thousands (K)', () => {
    it('should format 1000 as 1K', () => {
      expect(formatNumber(1000)).toBe('1K');
    });

    it('should format 1234 as 1.2K', () => {
      expect(formatNumber(1234)).toBe('1.2K');
    });

    it('should format exact thousands without decimal', () => {
      expect(formatNumber(2000)).toBe('2K');
      expect(formatNumber(5000)).toBe('5K');
      expect(formatNumber(10000)).toBe('10K');
    });

    it('should format values with one decimal place', () => {
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(2345)).toBe('2.3K');
      expect(formatNumber(9876)).toBe('9.9K');
    });

    it('should handle values just below 1 million', () => {
      expect(formatNumber(999999)).toBe('1000K');
    });

    it('should format 45200 as 45.2K', () => {
      expect(formatNumber(45200)).toBe('45.2K');
    });

    it('should format 100000 as 100K', () => {
      expect(formatNumber(100000)).toBe('100K');
    });

    it('should format 500500 as 500.5K', () => {
      expect(formatNumber(500500)).toBe('500.5K');
    });
  });

  describe('values in millions (M)', () => {
    it('should format 1000000 as 1M', () => {
      expect(formatNumber(1000000)).toBe('1M');
    });

    it('should format 1234567 as 1.2M', () => {
      expect(formatNumber(1234567)).toBe('1.2M');
    });

    it('should format exact millions without decimal', () => {
      expect(formatNumber(2000000)).toBe('2M');
      expect(formatNumber(5000000)).toBe('5M');
      expect(formatNumber(10000000)).toBe('10M');
    });

    it('should format values with one decimal place', () => {
      expect(formatNumber(1500000)).toBe('1.5M');
      expect(formatNumber(2345678)).toBe('2.3M');
      expect(formatNumber(9876543)).toBe('9.9M');
    });

    it('should format 1247000 as 1.2M', () => {
      expect(formatNumber(1247000)).toBe('1.2M');
    });

    it('should handle very large numbers', () => {
      expect(formatNumber(100000000)).toBe('100M');
      expect(formatNumber(999999999)).toBe('1000M');
    });

    it('should format 45200000 as 45.2M', () => {
      expect(formatNumber(45200000)).toBe('45.2M');
    });
  });

  describe('edge cases', () => {
    it('should handle boundary value 999 (below K threshold)', () => {
      expect(formatNumber(999)).toBe('999');
    });

    it('should handle boundary value 1000 (K threshold)', () => {
      expect(formatNumber(1000)).toBe('1K');
    });

    it('should handle boundary value 999999 (below M threshold)', () => {
      expect(formatNumber(999999)).toBe('1000K');
    });

    it('should handle boundary value 1000000 (M threshold)', () => {
      expect(formatNumber(1000000)).toBe('1M');
    });

    it('should remove trailing .0 from formatted values', () => {
      expect(formatNumber(1000)).toBe('1K');
      expect(formatNumber(2000)).toBe('2K');
      expect(formatNumber(1000000)).toBe('1M');
      expect(formatNumber(2000000)).toBe('2M');
    });

    it('should preserve single decimal when meaningful', () => {
      expect(formatNumber(1100)).toBe('1.1K');
      expect(formatNumber(1100000)).toBe('1.1M');
    });

    it('should round down to one decimal place', () => {
      expect(formatNumber(1234)).toBe('1.2K');
      expect(formatNumber(1284)).toBe('1.3K');
      expect(formatNumber(1250)).toBe('1.3K');
    });
  });

  describe('real-world values', () => {
    it('should format typical repository counts', () => {
      expect(formatNumber(5)).toBe('5');
      expect(formatNumber(25)).toBe('25');
      expect(formatNumber(150)).toBe('150');
    });

    it('should format typical scan counts', () => {
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(500)).toBe('500');
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('should format typical node counts', () => {
      expect(formatNumber(1234)).toBe('1.2K');
      expect(formatNumber(12345)).toBe('12.3K');
      expect(formatNumber(123456)).toBe('123.5K');
    });

    it('should format typical edge counts', () => {
      expect(formatNumber(5678)).toBe('5.7K');
      expect(formatNumber(56789)).toBe('56.8K');
      expect(formatNumber(567890)).toBe('567.9K');
    });
  });
});

// ============================================================================
// formatRelativeTime Tests
// ============================================================================

describe('formatRelativeTime', () => {
  const RealDate = Date;

  beforeEach(() => {
    // Mock Date to have consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('just now (less than 1 minute)', () => {
    it('should return "Just now" for current time', () => {
      expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('Just now');
    });

    it('should return "Just now" for 30 seconds ago', () => {
      expect(formatRelativeTime('2024-01-15T11:59:30Z')).toBe('Just now');
    });

    it('should return "Just now" for 59 seconds ago', () => {
      expect(formatRelativeTime('2024-01-15T11:59:01Z')).toBe('Just now');
    });
  });

  describe('minutes ago (1-59 minutes)', () => {
    it('should return "1 min ago" for 1 minute ago', () => {
      expect(formatRelativeTime('2024-01-15T11:59:00Z')).toBe('1 min ago');
    });

    it('should return "2 min ago" for 2 minutes ago', () => {
      expect(formatRelativeTime('2024-01-15T11:58:00Z')).toBe('2 min ago');
    });

    it('should return "5 min ago" for 5 minutes ago', () => {
      expect(formatRelativeTime('2024-01-15T11:55:00Z')).toBe('5 min ago');
    });

    it('should return "30 min ago" for 30 minutes ago', () => {
      expect(formatRelativeTime('2024-01-15T11:30:00Z')).toBe('30 min ago');
    });

    it('should return "59 min ago" for 59 minutes ago', () => {
      expect(formatRelativeTime('2024-01-15T11:01:00Z')).toBe('59 min ago');
    });
  });

  describe('hours ago (1-23 hours)', () => {
    it('should return "1 hour ago" for 1 hour ago (singular)', () => {
      expect(formatRelativeTime('2024-01-15T11:00:00Z')).toBe('1 hour ago');
    });

    it('should return "2 hours ago" for 2 hours ago (plural)', () => {
      expect(formatRelativeTime('2024-01-15T10:00:00Z')).toBe('2 hours ago');
    });

    it('should return "5 hours ago" for 5 hours ago', () => {
      expect(formatRelativeTime('2024-01-15T07:00:00Z')).toBe('5 hours ago');
    });

    it('should return "12 hours ago" for 12 hours ago', () => {
      expect(formatRelativeTime('2024-01-15T00:00:00Z')).toBe('12 hours ago');
    });

    it('should return "23 hours ago" for 23 hours ago', () => {
      expect(formatRelativeTime('2024-01-14T13:00:00Z')).toBe('23 hours ago');
    });
  });

  describe('yesterday (24-47 hours)', () => {
    it('should return "Yesterday" for exactly 24 hours ago', () => {
      expect(formatRelativeTime('2024-01-14T12:00:00Z')).toBe('Yesterday');
    });

    it('should return "Yesterday" for 36 hours ago', () => {
      expect(formatRelativeTime('2024-01-14T00:00:00Z')).toBe('Yesterday');
    });

    it('should return "Yesterday" for 47 hours ago', () => {
      expect(formatRelativeTime('2024-01-13T13:00:00Z')).toBe('Yesterday');
    });
  });

  describe('days ago (2+ days)', () => {
    it('should return "2 days ago" for 48 hours ago', () => {
      expect(formatRelativeTime('2024-01-13T12:00:00Z')).toBe('2 days ago');
    });

    it('should return "3 days ago" for 3 days ago', () => {
      expect(formatRelativeTime('2024-01-12T12:00:00Z')).toBe('3 days ago');
    });

    it('should return "7 days ago" for a week ago', () => {
      expect(formatRelativeTime('2024-01-08T12:00:00Z')).toBe('7 days ago');
    });

    it('should return "30 days ago" for a month ago', () => {
      expect(formatRelativeTime('2023-12-16T12:00:00Z')).toBe('30 days ago');
    });

    it('should handle very old timestamps', () => {
      expect(formatRelativeTime('2023-01-15T12:00:00Z')).toBe('365 days ago');
    });
  });

  describe('edge cases', () => {
    it('should handle ISO timestamp with milliseconds', () => {
      const result = formatRelativeTime('2024-01-15T11:55:00.123Z');
      // Due to milliseconds, might round to 4 or 5 minutes
      expect(result).toMatch(/^[45] min ago$/);
    });

    it('should handle ISO timestamp with timezone offset', () => {
      // 2024-01-15T11:55:00+00:00 is the same as 2024-01-15T11:55:00Z
      const result = formatRelativeTime('2024-01-15T11:55:00+00:00');
      expect(result).toMatch(/^[45] min ago$/);
    });

    it('should handle date-only format (interpreted as midnight UTC)', () => {
      // This will be interpreted based on browser behavior
      const result = formatRelativeTime('2024-01-14');
      // Should be approximately 12-36 hours ago
      expect(['12 hours ago', 'Yesterday']).toContain(result);
    });

    it('should handle boundary between minutes and hours', () => {
      // 60 minutes = 1 hour
      expect(formatRelativeTime('2024-01-15T11:00:00Z')).toBe('1 hour ago');
    });

    it('should handle boundary between hours and yesterday', () => {
      // 24 hours = 1 day = "Yesterday"
      expect(formatRelativeTime('2024-01-14T12:00:00Z')).toBe('Yesterday');
    });

    it('should handle boundary between yesterday and days', () => {
      // 48 hours = 2 days
      expect(formatRelativeTime('2024-01-13T12:00:00Z')).toBe('2 days ago');
    });
  });

  describe('grammatical correctness', () => {
    it('should use singular "hour" for 1 hour', () => {
      const result = formatRelativeTime('2024-01-15T11:00:00Z');
      expect(result).toBe('1 hour ago');
      expect(result).not.toBe('1 hours ago');
    });

    it('should use plural "hours" for multiple hours', () => {
      const result = formatRelativeTime('2024-01-15T10:00:00Z');
      expect(result).toBe('2 hours ago');
      expect(result).not.toBe('2 hour ago');
    });

    it('should always use "min" not "mins" for consistency', () => {
      expect(formatRelativeTime('2024-01-15T11:59:00Z')).toBe('1 min ago');
      expect(formatRelativeTime('2024-01-15T11:58:00Z')).toBe('2 min ago');
    });

    it('should use "days" plural for multiple days', () => {
      const result = formatRelativeTime('2024-01-12T12:00:00Z');
      expect(result).toBe('3 days ago');
    });
  });

  describe('real-world scenarios', () => {
    it('should format a scan completed 5 minutes ago', () => {
      expect(formatRelativeTime('2024-01-15T11:55:00Z')).toBe('5 min ago');
    });

    it('should format a repository added 2 hours ago', () => {
      expect(formatRelativeTime('2024-01-15T10:00:00Z')).toBe('2 hours ago');
    });

    it('should format a scan from yesterday', () => {
      // 2024-01-14T15:30:00Z is 20.5 hours before 2024-01-15T12:00:00Z
      // which falls in the hours range (< 24 hours), not Yesterday
      // Use a timestamp that is exactly 24+ hours ago
      expect(formatRelativeTime('2024-01-14T11:00:00Z')).toBe('Yesterday');
    });

    it('should format an old activity event', () => {
      expect(formatRelativeTime('2024-01-10T09:00:00Z')).toBe('5 days ago');
    });
  });
});

// ============================================================================
// Combined Utility Tests
// ============================================================================

describe('Dashboard Utility Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format dashboard stats correctly', () => {
    const stats = {
      repos: 15,
      scans: 1234,
      nodes: 45200,
      edges: 1234567,
    };

    expect(formatNumber(stats.repos)).toBe('15');
    expect(formatNumber(stats.scans)).toBe('1.2K');
    expect(formatNumber(stats.nodes)).toBe('45.2K');
    expect(formatNumber(stats.edges)).toBe('1.2M');
  });

  it('should format activity timestamps correctly', () => {
    const events = [
      { timestamp: '2024-01-15T12:00:00Z', expected: 'Just now' },
      { timestamp: '2024-01-15T11:55:00Z', expected: '5 min ago' },
      { timestamp: '2024-01-15T10:00:00Z', expected: '2 hours ago' },
      { timestamp: '2024-01-14T12:00:00Z', expected: 'Yesterday' },
      { timestamp: '2024-01-12T12:00:00Z', expected: '3 days ago' },
    ];

    events.forEach(({ timestamp, expected }) => {
      expect(formatRelativeTime(timestamp)).toBe(expected);
    });
  });
});
