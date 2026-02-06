/**
 * Graph Hooks Index
 * Barrel export for graph hooks
 * @module features/graph/hooks
 */

// ============================================================================
// Main Graph Hook
// ============================================================================

export {
  useGraph,
  type UseGraphOptions,
  type UseGraphReturn,
} from './useGraph';

// ============================================================================
// Query Keys
// ============================================================================

export {
  graphQueryKeys,
  toQueryFilters,
  type GraphQueryFilters,
  type GraphAllKey,
  type GraphScanKey,
  type GraphDataKey,
  type NodeDetailKey,
  type BlastRadiusKey,
  type SearchKey,
} from './queryKeys';

// ============================================================================
// Query Options
// ============================================================================

export {
  graphQueryOptions,
  graphByTypesQueryOptions,
  graphSearchQueryOptions,
  nodeDetailQueryOptions,
  blastRadiusQueryOptions,
  stableGraphQueryOptions,
  prefetchNodeDetailOptions,
  graphQueryDefaults,
} from './queryOptions';

// ============================================================================
// Query Hooks
// ============================================================================

export {
  useGraphQuery,
  useGraphQueryWithFilters,
  useNodeDetailQuery,
  useBlastRadiusMutation,
  useBlastRadiusQuery,
  useInvalidateGraph,
  usePrefetchGraph,
  useGraphOptimisticUpdate,
  type UseGraphQueryOptions,
  type UseNodeDetailQueryOptions,
  type UseBlastRadiusMutationOptions,
} from './queries';

// ============================================================================
// Preferences Hook
// ============================================================================

export {
  useGraphPreferences,
  DEFAULT_PREFERENCES,
  type GraphPreferences,
  type UseGraphPreferencesReturn,
} from './useGraphPreferences';

// ============================================================================
// URL State Hook
// ============================================================================

export {
  useGraphUrlState,
  type UseGraphUrlStateOptions,
  type UseGraphUrlStateReturn,
} from './useGraphUrlState';

// ============================================================================
// Error Handling Hook
// ============================================================================

export {
  useGraphErrorHandling,
  graphQueryErrorHandler,
  useErrorDisplay,
  useErrorState,
  type ErrorEntry,
  type UseGraphErrorHandlingOptions,
  type UseGraphErrorHandlingReturn,
} from './useGraphErrorHandling';

// ============================================================================
// Query Logger Hook
// ============================================================================

export {
  useQueryLogger,
  useMutationLogger,
  useQueryTiming,
  getActiveQueryLogs,
  clearActiveQueryLogs,
  type UseQueryLoggerOptions,
} from './useQueryLogger';
