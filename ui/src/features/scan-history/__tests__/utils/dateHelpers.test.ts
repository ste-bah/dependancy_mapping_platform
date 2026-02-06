/**
 * Date Helpers Tests
 * Tests for date utility functions
 * @module features/scan-history/__tests__/utils/dateHelpers.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDate,
  formatRelativeTime,
  formatDuration,
  formatDurationCompact,
  getDateRangePreset,
  isDateInRange,
  getDaysBetween,
  getRangeDays,
  getTimelineBuckets,
  getBucketLabel,
  toISODateString,
  dateRangeToISO,
  parseISOToDateRange,
} from '../../utils/dateHelpers';
import type { DateRange } from '../../types/domain';
import type { TimelineZoom } from '../../types/store';

describe('Date Helpers', () => {
  // ==========================================================================
  // Date Formatting
  // ==========================================================================

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15T14:30:00Z');

    it('should format date with default medium pattern', () => {
      const result = formatDate(testDate);
      expect(result).toMatch(/Jan\s+15,\s+2024/);
    });

    it('should format date with short pattern', () => {
      const result = formatDate(testDate, 'short');
      expect(result).toMatch(/1\/15\/24/);
    });

    it('should format date with long pattern', () => {
      const result = formatDate(testDate, 'long');
      expect(result).toMatch(/January\s+15,\s+2024/);
    });

    it('should format date with full pattern', () => {
      const result = formatDate(testDate, 'full');
      expect(result).toMatch(/Monday,\s+January\s+15,\s+2024/);
    });

    it('should format date with iso pattern', () => {
      const result = formatDate(testDate, 'iso');
      expect(result).toBe('2024-01-15');
    });

    it('should format date with datetime pattern', () => {
      const result = formatDate(testDate, 'datetime');
      // Should include date and time
      expect(result).toMatch(/Jan\s+15,\s+2024/);
    });

    it('should format date with time pattern', () => {
      const result = formatDate(testDate, 'time');
      // Should include time only
      expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    });

    it('should accept ISO string input', () => {
      const result = formatDate('2024-01-15T14:30:00Z', 'iso');
      expect(result).toBe('2024-01-15');
    });

    it('should return "Invalid date" for invalid input', () => {
      expect(formatDate(new Date('invalid'))).toBe('Invalid date');
      expect(formatDate('not-a-date')).toBe('Invalid date');
    });

    it('should handle edge case dates', () => {
      expect(formatDate(new Date('2000-01-01'), 'iso')).toBe('2000-01-01');
      expect(formatDate(new Date('2099-12-31'), 'iso')).toBe('2099-12-31');
    });
  });

  // ==========================================================================
  // Relative Time
  // ==========================================================================

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "just now" for very recent times', () => {
      const recentDate = new Date(Date.now() - 5000); // 5 seconds ago
      expect(formatRelativeTime(recentDate)).toBe('just now');
    });

    it('should format seconds ago', () => {
      const date = new Date(Date.now() - 30000); // 30 seconds ago
      const result = formatRelativeTime(date);
      expect(result).toMatch(/30\s*second/i);
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const result = formatRelativeTime(date);
      expect(result).toMatch(/5\s*minute/i);
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const result = formatRelativeTime(date);
      expect(result).toMatch(/3\s*hour/i);
    });

    it('should format days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const result = formatRelativeTime(date);
      expect(result).toMatch(/2\s*day/i);
    });

    it('should format weeks ago', () => {
      const date = new Date(Date.now() - 2 * 7 * 24 * 60 * 60 * 1000); // 2 weeks ago
      const result = formatRelativeTime(date);
      expect(result).toMatch(/2\s*week/i);
    });

    it('should format months ago', () => {
      const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // ~2 months ago
      const result = formatRelativeTime(date);
      expect(result).toMatch(/month/i);
    });

    it('should format years ago', () => {
      const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // ~1 year ago
      const result = formatRelativeTime(date);
      expect(result).toMatch(/year/i);
    });

    it('should accept ISO string input', () => {
      const date = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const result = formatRelativeTime(date);
      expect(result).toMatch(/1\s*hour/i);
    });

    it('should return "Invalid date" for invalid input', () => {
      expect(formatRelativeTime('not-a-date')).toBe('Invalid date');
    });
  });

  // ==========================================================================
  // Duration Formatting
  // ==========================================================================

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1)).toBe('1ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(30000)).toBe('30s');
      expect(formatDuration(59000)).toBe('59s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(3599000)).toBe('59m 59s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3600000)).toBe('1h');
      expect(formatDuration(5400000)).toBe('1h 30m');
      expect(formatDuration(86399000)).toBe('23h 59m');
    });

    it('should format days and hours', () => {
      expect(formatDuration(86400000)).toBe('1d 0h');
      expect(formatDuration(90000000)).toBe('1d 1h');
      expect(formatDuration(172800000)).toBe('2d 0h');
    });

    it('should return "0ms" for negative values', () => {
      expect(formatDuration(-100)).toBe('0ms');
      expect(formatDuration(-1000)).toBe('0ms');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0ms');
    });

    it('should round milliseconds', () => {
      expect(formatDuration(500.4)).toBe('500ms');
      expect(formatDuration(500.6)).toBe('501ms');
    });
  });

  describe('formatDurationCompact', () => {
    it('should format with M:SS pattern for under 1 hour', () => {
      expect(formatDurationCompact(0)).toBe('0:00');
      expect(formatDurationCompact(1000)).toBe('0:01');
      expect(formatDurationCompact(60000)).toBe('1:00');
      expect(formatDurationCompact(90000)).toBe('1:30');
      expect(formatDurationCompact(3599000)).toBe('59:59');
    });

    it('should format with H:MM:SS pattern for 1+ hours', () => {
      expect(formatDurationCompact(3600000)).toBe('1:00:00');
      expect(formatDurationCompact(3661000)).toBe('1:01:01');
      expect(formatDurationCompact(7200000)).toBe('2:00:00');
    });

    it('should handle negative values', () => {
      expect(formatDurationCompact(-100)).toBe('0:00');
    });
  });

  // ==========================================================================
  // Date Range Presets
  // ==========================================================================

  describe('getDateRangePreset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return today range', () => {
      const range = getDateRangePreset('today');
      expect(range.start.getDate()).toBe(15);
      expect(range.end.getDate()).toBe(15);
      expect(range.start.getHours()).toBe(0);
      expect(range.end.getHours()).toBe(23);
    });

    it('should return yesterday range', () => {
      const range = getDateRangePreset('yesterday');
      expect(range.start.getDate()).toBe(14);
      expect(range.end.getDate()).toBe(14);
    });

    it('should return last7days range', () => {
      const range = getDateRangePreset('last7days');
      // Verify the range spans 7 days (today + 6 days back)
      // Start is at 00:00 and end is at 23:59, so getDaysBetween rounds up
      expect(range.start.getDate()).toBe(9); // Jan 15 - 6 = Jan 9
      expect(range.end.getDate()).toBe(15);
    });

    it('should return last30days range', () => {
      const range = getDateRangePreset('last30days');
      // Implementation subtracts 29 days for "last 30 days" (inclusive)
      const daysDiff = getDaysBetween(range.start, range.end);
      // getDaysBetween returns rounded time difference
      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(30);
    });

    it('should return last90days range', () => {
      const range = getDateRangePreset('last90days');
      // Implementation subtracts 89 days for "last 90 days" (inclusive)
      const daysDiff = getDaysBetween(range.start, range.end);
      expect(daysDiff).toBeGreaterThanOrEqual(89);
      expect(daysDiff).toBeLessThanOrEqual(90);
    });

    it('should return thisWeek range', () => {
      const range = getDateRangePreset('thisWeek');
      // Start should be Sunday (day 0) of current week
      expect(range.start.getDay()).toBe(0);
    });

    it('should return thisMonth range', () => {
      const range = getDateRangePreset('thisMonth');
      expect(range.start.getDate()).toBe(1);
      expect(range.start.getMonth()).toBe(0); // January
    });

    it('should return thisQuarter range', () => {
      const range = getDateRangePreset('thisQuarter');
      expect(range.start.getDate()).toBe(1);
      // January is in Q1, so start month should be 0 (January)
      expect(range.start.getMonth()).toBe(0);
    });

    it('should return thisYear range', () => {
      const range = getDateRangePreset('thisYear');
      expect(range.start.getMonth()).toBe(0);
      expect(range.start.getDate()).toBe(1);
      expect(range.start.getFullYear()).toBe(2024);
    });

    it('should return allTime range (365 days)', () => {
      const range = getDateRangePreset('allTime');
      // Implementation subtracts 364 days for "all time" (365 days inclusive)
      const daysDiff = getDaysBetween(range.start, range.end);
      expect(daysDiff).toBeGreaterThanOrEqual(364);
      expect(daysDiff).toBeLessThanOrEqual(365);
    });
  });

  // ==========================================================================
  // Date Range Utilities
  // ==========================================================================

  describe('isDateInRange', () => {
    const range: DateRange = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-12-31T23:59:59Z'),
    };

    it('should return true for date within range', () => {
      expect(isDateInRange(new Date('2024-06-15'), range)).toBe(true);
      expect(isDateInRange('2024-06-15', range)).toBe(true);
    });

    it('should return true for date at start boundary', () => {
      expect(isDateInRange(range.start, range)).toBe(true);
    });

    it('should return true for date at end boundary', () => {
      expect(isDateInRange(range.end, range)).toBe(true);
    });

    it('should return false for date before range', () => {
      expect(isDateInRange(new Date('2023-12-31'), range)).toBe(false);
    });

    it('should return false for date after range', () => {
      expect(isDateInRange(new Date('2025-01-01'), range)).toBe(false);
    });

    it('should return false for invalid date', () => {
      expect(isDateInRange('invalid', range)).toBe(false);
      expect(isDateInRange(new Date('invalid'), range)).toBe(false);
    });
  });

  describe('getDaysBetween', () => {
    it('should return 0 for same date', () => {
      const date = new Date('2024-01-15');
      expect(getDaysBetween(date, date)).toBe(0);
    });

    it('should return positive for end after start', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-08');
      expect(getDaysBetween(start, end)).toBe(7);
    });

    it('should return negative for end before start', () => {
      const start = new Date('2024-01-08');
      const end = new Date('2024-01-01');
      expect(getDaysBetween(start, end)).toBe(-7);
    });

    it('should handle large ranges', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2024-01-01');
      const days = getDaysBetween(start, end);
      expect(days).toBeGreaterThan(1000);
    });
  });

  describe('getRangeDays', () => {
    it('should return 1 for same day range', () => {
      const range: DateRange = {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-15'),
      };
      expect(getRangeDays(range)).toBe(1);
    });

    it('should return correct count for multi-day range', () => {
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
      };
      expect(getRangeDays(range)).toBe(7);
    });
  });

  // ==========================================================================
  // Timeline Buckets
  // ==========================================================================

  describe('getTimelineBuckets', () => {
    const range: DateRange = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-07'),
    };

    it('should generate daily buckets', () => {
      const buckets = getTimelineBuckets(range, 'day');
      expect(buckets.length).toBeGreaterThanOrEqual(7);
      buckets.forEach((bucket) => {
        expect(bucket).toBeInstanceOf(Date);
      });
    });

    it('should generate weekly buckets', () => {
      const wideRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };
      const buckets = getTimelineBuckets(wideRange, 'week');
      expect(buckets.length).toBeGreaterThanOrEqual(4);
    });

    it('should generate monthly buckets', () => {
      const yearRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const buckets = getTimelineBuckets(yearRange, 'month');
      expect(buckets.length).toBe(12);
    });

    it('should generate quarterly buckets', () => {
      const yearRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };
      const buckets = getTimelineBuckets(yearRange, 'quarter');
      expect(buckets.length).toBe(4);
    });

    it('should generate yearly buckets', () => {
      const multiYearRange: DateRange = {
        start: new Date('2020-01-01'),
        end: new Date('2024-12-31'),
      };
      const buckets = getTimelineBuckets(multiYearRange, 'year');
      expect(buckets.length).toBe(5);
    });

    it('should return at least one bucket', () => {
      const singleDay: DateRange = {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-15'),
      };
      const buckets = getTimelineBuckets(singleDay, 'day');
      expect(buckets.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getBucketLabel', () => {
    const date = new Date('2024-01-15');

    it('should format day label', () => {
      const label = getBucketLabel(date, 'day');
      expect(label).toMatch(/Jan\s+15/);
    });

    it('should format week label', () => {
      const label = getBucketLabel(date, 'week');
      expect(label).toMatch(/Jan/);
      expect(label).toMatch(/\d+-\d+/); // Should have range like "15-21"
    });

    it('should format month label', () => {
      const label = getBucketLabel(date, 'month');
      expect(label).toBe('January');
    });

    it('should format quarter label', () => {
      const label = getBucketLabel(date, 'quarter');
      expect(label).toBe('Q1 2024');
    });

    it('should format year label', () => {
      const label = getBucketLabel(date, 'year');
      expect(label).toBe('2024');
    });

    it('should handle week spanning two months', () => {
      const monthEndDate = new Date('2024-01-29'); // Week spans into February
      const label = getBucketLabel(monthEndDate, 'week');
      expect(label).toMatch(/Jan|Feb/);
    });
  });

  // ==========================================================================
  // ISO String Utilities
  // ==========================================================================

  describe('toISODateString', () => {
    it('should convert date to ISO date string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(toISODateString(date)).toBe('2024-01-15');
    });

    it('should handle different timezones', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = toISODateString(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('dateRangeToISO', () => {
    it('should convert DateRange to ISO strings', () => {
      const range: DateRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T23:59:59Z'),
      };

      const result = dateRangeToISO(range);

      expect(result.dateStart).toBe('2024-01-01T00:00:00.000Z');
      expect(result.dateEnd).toBe('2024-01-31T23:59:59.000Z');
    });
  });

  describe('parseISOToDateRange', () => {
    it('should parse valid ISO strings to DateRange', () => {
      const result = parseISOToDateRange(
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      expect(result).not.toBeNull();
      expect(result!.start.getFullYear()).toBe(2024);
      expect(result!.end.getMonth()).toBe(0);
    });

    it('should return null for null inputs', () => {
      expect(parseISOToDateRange(null, '2024-01-31')).toBeNull();
      expect(parseISOToDateRange('2024-01-01', null)).toBeNull();
      expect(parseISOToDateRange(null, null)).toBeNull();
    });

    it('should return null for undefined inputs', () => {
      expect(parseISOToDateRange(undefined, '2024-01-31')).toBeNull();
      expect(parseISOToDateRange('2024-01-01', undefined)).toBeNull();
    });

    it('should return null for invalid date strings', () => {
      expect(parseISOToDateRange('invalid', '2024-01-31')).toBeNull();
      expect(parseISOToDateRange('2024-01-01', 'invalid')).toBeNull();
    });
  });
});
