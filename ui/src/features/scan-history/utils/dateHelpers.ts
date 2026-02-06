/**
 * Date Helpers
 * Pure utility functions for date manipulation in scan history feature
 * @module features/scan-history/utils/dateHelpers
 */

import type { DateRange } from '../types/domain';
import type { TimelineZoom } from '../types/store';

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format options for date display
 */
export interface DateFormatOptions {
  /** Include time in output */
  includeTime?: boolean;
  /** Use 24-hour format for time */
  use24Hour?: boolean;
  /** Include seconds in time */
  includeSeconds?: boolean;
  /** Locale for formatting (defaults to 'en-US') */
  locale?: string;
}

/**
 * Pre-defined format patterns
 */
export type DateFormatPattern =
  | 'short'      // "1/15/24"
  | 'medium'     // "Jan 15, 2024"
  | 'long'       // "January 15, 2024"
  | 'full'       // "Monday, January 15, 2024"
  | 'iso'        // "2024-01-15"
  | 'datetime'   // "Jan 15, 2024, 2:30 PM"
  | 'time';      // "2:30 PM"

/**
 * Formats a date using the specified format pattern
 *
 * @param date - Date to format (Date object or ISO string)
 * @param format - Format pattern to use (defaults to 'medium')
 * @returns Formatted date string
 *
 * @example
 * ```ts
 * formatDate(new Date(), 'medium');     // "Jan 15, 2024"
 * formatDate('2024-01-15', 'iso');      // "2024-01-15"
 * formatDate(new Date(), 'datetime');   // "Jan 15, 2024, 2:30 PM"
 * ```
 */
export function formatDate(
  date: Date | string,
  format: DateFormatPattern = 'medium'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const locale = 'en-US';

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString(locale, {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
      });

    case 'medium':
      return dateObj.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    case 'long':
      return dateObj.toLocaleDateString(locale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

    case 'full':
      return dateObj.toLocaleDateString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

    case 'iso':
      return dateObj.toISOString().split('T')[0];

    case 'datetime':
      return dateObj.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

    case 'time':
      return dateObj.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

    default:
      return dateObj.toLocaleDateString(locale);
  }
}

// ============================================================================
// Relative Time
// ============================================================================

/**
 * Time units for relative formatting
 */
const TIME_UNITS: Array<{
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
}> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

/**
 * Formats a date as a relative time string (e.g., "2 hours ago", "in 3 days")
 *
 * @param date - Date to format (Date object or ISO string)
 * @returns Relative time string
 *
 * @example
 * ```ts
 * formatRelativeTime(new Date(Date.now() - 3600000));  // "1 hour ago"
 * formatRelativeTime(new Date(Date.now() - 86400000)); // "1 day ago"
 * formatRelativeTime(new Date(Date.now() - 30000));    // "30 seconds ago"
 * ```
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const now = Date.now();
  const diff = dateObj.getTime() - now;
  const absDiff = Math.abs(diff);

  // Handle "just now" for very recent times
  if (absDiff < 10000) {
    return 'just now';
  }

  // Find the appropriate time unit
  for (const { unit, ms } of TIME_UNITS) {
    if (absDiff >= ms) {
      const value = Math.round(diff / ms);
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      return rtf.format(value, unit);
    }
  }

  // Fallback for sub-second differences
  return 'just now';
}

// ============================================================================
// Duration Formatting
// ============================================================================

/**
 * Formats a duration in milliseconds to a human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "1m 30s", "2h 15m")
 *
 * @example
 * ```ts
 * formatDuration(90000);      // "1m 30s"
 * formatDuration(8100000);    // "2h 15m"
 * formatDuration(500);        // "500ms"
 * formatDuration(86400000);   // "1d 0h"
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 0) {
    return '0ms';
  }

  // Less than 1 second - show milliseconds
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // Less than 1 minute - show seconds
  if (minutes === 0) {
    return `${seconds}s`;
  }

  // Less than 1 hour - show minutes and seconds
  if (hours === 0) {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }

  // Less than 1 day - show hours and minutes
  if (days === 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }

  // Show days and hours
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

/**
 * Formats a duration in a compact format for table display
 *
 * @param ms - Duration in milliseconds
 * @returns Compact duration string (e.g., "1:30", "02:15:00")
 */
export function formatDurationCompact(ms: number): string {
  if (ms < 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(seconds)}`;
  }

  return `${minutes}:${padZero(seconds)}`;
}

/**
 * Pads a number with leading zero if needed
 */
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

// ============================================================================
// Date Range Presets
// ============================================================================

/**
 * Available preset names for date ranges
 */
export type DateRangePresetName =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last90days'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'allTime';

/**
 * Gets a date range for a named preset
 *
 * @param preset - Preset name
 * @returns DateRange for the preset
 *
 * @example
 * ```ts
 * getDateRangePreset('last7days');
 * // { start: Date 7 days ago, end: Date now }
 *
 * getDateRangePreset('thisMonth');
 * // { start: First day of month, end: Today }
 * ```
 */
export function getDateRangePreset(preset: DateRangePresetName): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  const endOfToday = endOfDay(now);

  switch (preset) {
    case 'today':
      return { start: today, end: endOfToday };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: endOfDay(yesterday) };
    }

    case 'last7days': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return { start: weekAgo, end: endOfToday };
    }

    case 'last30days': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return { start: monthAgo, end: endOfToday };
    }

    case 'last90days': {
      const quarterAgo = new Date(today);
      quarterAgo.setDate(quarterAgo.getDate() - 89);
      return { start: quarterAgo, end: endOfToday };
    }

    case 'thisWeek': {
      const startOfWeek = new Date(today);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      return { start: startOfWeek, end: endOfToday };
    }

    case 'thisMonth': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: startOfMonth, end: endOfToday };
    }

    case 'thisQuarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
      return { start: startOfQuarter, end: endOfToday };
    }

    case 'thisYear': {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      return { start: startOfYear, end: endOfToday };
    }

    case 'allTime':
    default: {
      // Default to last 365 days for "all time"
      const yearAgo = new Date(today);
      yearAgo.setDate(yearAgo.getDate() - 364);
      return { start: yearAgo, end: endOfToday };
    }
  }
}

/**
 * Gets the start of a day (midnight)
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Gets the end of a day (23:59:59.999)
 */
function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

// ============================================================================
// Date Range Utilities
// ============================================================================

/**
 * Checks if a date falls within a given date range
 *
 * @param date - Date to check (Date object or ISO string)
 * @param range - Date range to check against
 * @returns True if date is within the range (inclusive)
 *
 * @example
 * ```ts
 * const range = { start: new Date('2024-01-01'), end: new Date('2024-12-31') };
 * isDateInRange(new Date('2024-06-15'), range); // true
 * isDateInRange(new Date('2023-12-31'), range); // false
 * ```
 */
export function isDateInRange(date: Date | string, range: DateRange): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return false;
  }

  const timestamp = dateObj.getTime();
  return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
}

/**
 * Calculates the number of days between two dates
 *
 * @param start - Start date
 * @param end - End date
 * @returns Number of days (can be negative if end is before start)
 */
export function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Gets the number of days in a date range
 *
 * @param range - Date range
 * @returns Number of days (inclusive)
 */
export function getRangeDays(range: DateRange): number {
  return getDaysBetween(range.start, range.end) + 1;
}

// ============================================================================
// Timeline Bucket Generation
// ============================================================================

/**
 * Timeline bucket configuration
 */
interface BucketConfig {
  /** Number of milliseconds in one bucket */
  bucketMs: number;
  /** Function to get the start of a bucket for a given date */
  getBucketStart: (date: Date) => Date;
}

/**
 * Configuration for each zoom level
 */
const ZOOM_CONFIGS: Record<TimelineZoom, BucketConfig> = {
  day: {
    bucketMs: 24 * 60 * 60 * 1000,
    getBucketStart: startOfDay,
  },
  week: {
    bucketMs: 7 * 24 * 60 * 60 * 1000,
    getBucketStart: (date: Date) => {
      const result = startOfDay(date);
      result.setDate(result.getDate() - result.getDay());
      return result;
    },
  },
  month: {
    bucketMs: 30 * 24 * 60 * 60 * 1000, // Approximate
    getBucketStart: (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1);
    },
  },
  quarter: {
    bucketMs: 90 * 24 * 60 * 60 * 1000, // Approximate
    getBucketStart: (date: Date) => {
      const quarter = Math.floor(date.getMonth() / 3);
      return new Date(date.getFullYear(), quarter * 3, 1);
    },
  },
  year: {
    bucketMs: 365 * 24 * 60 * 60 * 1000, // Approximate
    getBucketStart: (date: Date) => {
      return new Date(date.getFullYear(), 0, 1);
    },
  },
};

/**
 * Generates timeline bucket dates for a given date range and zoom level
 *
 * @param range - Date range to generate buckets for
 * @param zoom - Timeline zoom level (determines bucket size)
 * @returns Array of bucket start dates
 *
 * @example
 * ```ts
 * const range = { start: new Date('2024-01-01'), end: new Date('2024-01-07') };
 * getTimelineBuckets(range, 'day');
 * // [Date(Jan 1), Date(Jan 2), Date(Jan 3), ...]
 *
 * getTimelineBuckets(range, 'week');
 * // [Date(Dec 31 - start of week), Date(Jan 7 - next week)]
 * ```
 */
export function getTimelineBuckets(
  range: DateRange,
  zoom: TimelineZoom
): Date[] {
  const config = ZOOM_CONFIGS[zoom];
  const buckets: Date[] = [];

  // Get the start of the first bucket
  let currentBucket = config.getBucketStart(range.start);

  // Generate buckets until we pass the end date
  while (currentBucket.getTime() <= range.end.getTime()) {
    buckets.push(new Date(currentBucket));
    currentBucket = getNextBucket(currentBucket, zoom);
  }

  return buckets;
}

/**
 * Gets the next bucket start date for a given zoom level
 */
function getNextBucket(current: Date, zoom: TimelineZoom): Date {
  const next = new Date(current);

  switch (zoom) {
    case 'day':
      next.setDate(next.getDate() + 1);
      break;
    case 'week':
      next.setDate(next.getDate() + 7);
      break;
    case 'month':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarter':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'year':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

/**
 * Gets a label for a timeline bucket based on zoom level
 *
 * @param bucketDate - Bucket start date
 * @param zoom - Timeline zoom level
 * @returns Formatted label string
 *
 * @example
 * ```ts
 * getBucketLabel(new Date('2024-01-15'), 'day');   // "Jan 15"
 * getBucketLabel(new Date('2024-01-08'), 'week');  // "Jan 8-14"
 * getBucketLabel(new Date('2024-01-01'), 'month'); // "January"
 * ```
 */
export function getBucketLabel(bucketDate: Date, zoom: TimelineZoom): string {
  const locale = 'en-US';

  switch (zoom) {
    case 'day':
      return bucketDate.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      });

    case 'week': {
      const weekEnd = new Date(bucketDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startMonth = bucketDate.toLocaleDateString(locale, { month: 'short' });
      const endMonth = weekEnd.toLocaleDateString(locale, { month: 'short' });

      if (startMonth === endMonth) {
        return `${startMonth} ${bucketDate.getDate()}-${weekEnd.getDate()}`;
      }
      return `${startMonth} ${bucketDate.getDate()} - ${endMonth} ${weekEnd.getDate()}`;
    }

    case 'month':
      return bucketDate.toLocaleDateString(locale, { month: 'long' });

    case 'quarter': {
      const quarter = Math.floor(bucketDate.getMonth() / 3) + 1;
      return `Q${quarter} ${bucketDate.getFullYear()}`;
    }

    case 'year':
      return bucketDate.getFullYear().toString();

    default:
      return bucketDate.toLocaleDateString(locale);
  }
}

// ============================================================================
// ISO String Utilities
// ============================================================================

/**
 * Converts a Date to ISO 8601 string (date only, no time)
 *
 * @param date - Date to convert
 * @returns ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Converts a DateRange to ISO string format for API requests
 *
 * @param range - Date range to convert
 * @returns Object with ISO string dates
 */
export function dateRangeToISO(range: DateRange): {
  dateStart: string;
  dateEnd: string;
} {
  return {
    dateStart: range.start.toISOString(),
    dateEnd: range.end.toISOString(),
  };
}

/**
 * Parses ISO strings back into a DateRange
 *
 * @param dateStart - Start date ISO string
 * @param dateEnd - End date ISO string
 * @returns DateRange or null if invalid
 */
export function parseISOToDateRange(
  dateStart: string | null | undefined,
  dateEnd: string | null | undefined
): DateRange | null {
  if (!dateStart || !dateEnd) {
    return null;
  }

  const start = new Date(dateStart);
  const end = new Date(dateEnd);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
}
