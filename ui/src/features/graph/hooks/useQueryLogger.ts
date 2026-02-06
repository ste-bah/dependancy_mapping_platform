/**
 * React Query Logger Hook
 * Hook for logging React Query operations in the graph feature
 * @module features/graph/hooks/useQueryLogger
 */

import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { graphLogger, createOperationLogger } from '../utils/logger';
import { logPerformance } from '../utils/performanceLogger';
import { isDevelopment } from '../config/env';

// ============================================================================
// Types
// ============================================================================

/**
 * Query state for tracking
 */
type QueryState = 'idle' | 'pending' | 'success' | 'error';

/**
 * Query log entry
 */
interface QueryLogEntry {
  queryKey: QueryKey;
  label: string;
  state: QueryState;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: Error;
  dataSize?: number;
}

/**
 * Options for the query logger hook
 */
export interface UseQueryLoggerOptions {
  /** Enable detailed logging (default: development only) */
  verbose?: boolean;
  /** Log data size (default: true) */
  logDataSize?: boolean;
  /** Custom label prefix */
  labelPrefix?: string;
}

// ============================================================================
// State
// ============================================================================

/**
 * Track active queries for timing
 */
const activeQueries = new Map<string, QueryLogEntry>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique key for tracking a query
 */
function getQueryTrackingKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey);
}

/**
 * Calculate approximate size of data in bytes
 */
function estimateDataSize(data: unknown): number {
  try {
    const json = JSON.stringify(data);
    return new Blob([json]).size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for logging React Query operations
 *
 * Automatically logs query start, success, error, and duration.
 * Integrates with the performance logger for metrics tracking.
 *
 * @param queryKey - The query key to monitor
 * @param label - Human-readable label for the query
 * @param options - Logger options
 *
 * @example
 * ```tsx
 * function GraphContainer({ scanId }: Props) {
 *   const query = useGraphQuery(scanId);
 *
 *   // Log query operations
 *   useQueryLogger(
 *     graphQueryKeys.graph(scanId),
 *     'fetchGraph',
 *     { verbose: true }
 *   );
 *
 *   return <Graph data={query.data} />;
 * }
 * ```
 */
export function useQueryLogger(
  queryKey: QueryKey,
  label: string,
  options: UseQueryLoggerOptions = {}
): void {
  const {
    verbose = isDevelopment(),
    logDataSize = true,
    labelPrefix = 'Query',
  } = options;

  const queryClient = useQueryClient();
  const trackingKey = getQueryTrackingKey(queryKey);
  const fullLabel = `${labelPrefix}:${label}`;

  // Track previous state to detect changes
  const prevStateRef = useRef<QueryState>('idle');
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Subscribe to query state changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Only process events for our query
      if (getQueryTrackingKey(event.query.queryKey) !== trackingKey) {
        return;
      }

      const queryState = event.query.state;
      const currentState: QueryState = queryState.status;
      const prevState = prevStateRef.current;

      // State transition: idle/pending -> pending (query started)
      if (currentState === 'pending' && prevState !== 'pending') {
        startTimeRef.current = performance.now();

        activeQueries.set(trackingKey, {
          queryKey,
          label: fullLabel,
          state: 'pending',
          startTime: startTimeRef.current,
        });

        if (verbose) {
          graphLogger.debug(`${fullLabel} started`, {
            action: label,
          });
        }
      }

      // State transition: pending -> success
      if (currentState === 'success' && prevState === 'pending') {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTimeRef.current);

        const entry = activeQueries.get(trackingKey);
        if (entry) {
          entry.state = 'success';
          entry.endTime = endTime;
          entry.duration = duration;

          if (logDataSize && queryState.data) {
            entry.dataSize = estimateDataSize(queryState.data);
          }
        }

        // Log performance metric
        logPerformance(`query-${label}`, duration);

        if (verbose) {
          const dataInfo = entry?.dataSize
            ? ` (${formatBytes(entry.dataSize)})`
            : '';
          graphLogger.debug(`${fullLabel} succeeded${dataInfo}`, {
            action: label,
            duration,
          });
        }

        activeQueries.delete(trackingKey);
      }

      // State transition: pending -> error
      if (currentState === 'error' && prevState === 'pending') {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTimeRef.current);

        const entry = activeQueries.get(trackingKey);
        if (entry) {
          entry.state = 'error';
          entry.endTime = endTime;
          entry.duration = duration;
          entry.error = queryState.error as Error;
        }

        // Log performance metric (even for failures)
        logPerformance(`query-${label}-error`, duration);

        graphLogger.error(
          `${fullLabel} failed after ${duration}ms`,
          queryState.error as Error,
          { action: label, duration }
        );

        activeQueries.delete(trackingKey);
      }

      prevStateRef.current = currentState;
    });

    return () => {
      unsubscribe();
      activeQueries.delete(trackingKey);
    };
  }, [queryClient, trackingKey, fullLabel, label, verbose, logDataSize]);
}

// ============================================================================
// Additional Hooks
// ============================================================================

/**
 * Hook for logging mutation operations
 *
 * @param label - Label for the mutation
 * @returns Logging callbacks for mutation hooks
 *
 * @example
 * ```tsx
 * function BlastRadiusButton({ scanId, nodeId }: Props) {
 *   const mutationLogger = useMutationLogger('calculateBlastRadius');
 *
 *   const mutation = useBlastRadiusMutation(scanId, {
 *     onMutate: mutationLogger.onMutate,
 *     onSuccess: mutationLogger.onSuccess,
 *     onError: mutationLogger.onError,
 *   });
 *
 *   return <button onClick={() => mutation.mutate(nodeId)}>Calculate</button>;
 * }
 * ```
 */
export function useMutationLogger(label: string) {
  const startTimeRef = useRef<number>(0);
  const opLoggerRef = useRef<ReturnType<typeof createOperationLogger> | null>(null);

  return {
    onMutate: (variables: unknown) => {
      startTimeRef.current = performance.now();
      opLoggerRef.current = createOperationLogger(`mutation-${label}`, {
        action: label,
      });

      graphLogger.debug(`Mutation:${label} started`, {
        action: label,
        variables: typeof variables === 'object' ? variables : undefined,
      });
    },

    onSuccess: (data: unknown) => {
      const duration = Math.round(performance.now() - startTimeRef.current);

      logPerformance(`mutation-${label}`, duration);

      graphLogger.debug(`Mutation:${label} succeeded`, {
        action: label,
        duration,
        dataSize: estimateDataSize(data),
      });

      opLoggerRef.current?.complete();
    },

    onError: (error: Error) => {
      const duration = Math.round(performance.now() - startTimeRef.current);

      logPerformance(`mutation-${label}-error`, duration);

      graphLogger.error(
        `Mutation:${label} failed`,
        error,
        { action: label, duration }
      );

      opLoggerRef.current?.fail(error);
    },

    onSettled: () => {
      opLoggerRef.current = null;
    },
  };
}

/**
 * Hook to get query timing information
 * Useful for displaying loading times to users
 *
 * @param queryKey - The query key to track
 * @returns Current timing information
 */
export function useQueryTiming(queryKey: QueryKey): {
  isTracking: boolean;
  startTime: number | null;
  currentDuration: number;
} {
  const trackingKey = getQueryTrackingKey(queryKey);
  const entry = activeQueries.get(trackingKey);

  if (!entry) {
    return {
      isTracking: false,
      startTime: null,
      currentDuration: 0,
    };
  }

  return {
    isTracking: true,
    startTime: entry.startTime,
    currentDuration: Math.round(performance.now() - entry.startTime),
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get all currently active queries being tracked
 */
export function getActiveQueryLogs(): QueryLogEntry[] {
  return Array.from(activeQueries.values());
}

/**
 * Clear all active query tracking
 */
export function clearActiveQueryLogs(): void {
  activeQueries.clear();
}

// ============================================================================
// Development Tools
// ============================================================================

if (isDevelopment() && typeof window !== 'undefined') {
  (window as { __graphQueryLogger?: unknown }).__graphQueryLogger = {
    getActive: getActiveQueryLogs,
    clear: clearActiveQueryLogs,
  };
}
