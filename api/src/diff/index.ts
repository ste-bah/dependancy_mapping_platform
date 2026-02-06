/**
 * Graph Diff Module
 * @module diff
 *
 * Provides comprehensive diff computation between dependency graph scans.
 * Enables tracking what changed in the graph over time across commits,
 * branches, or arbitrary scan pairs.
 *
 * Features:
 * - Efficient O(n) node and edge matching using stable identity keys
 * - Tiered caching (L1 in-memory LRU, L2 Redis) for expensive computations
 * - Database persistence with multi-tenant isolation
 * - Impact assessment and change scoring
 * - Rate limiting and audit logging
 *
 * TASK-ROLLUP-005: Diff Computation for graph comparison
 *
 * @example
 * ```typescript
 * import {
 *   createGraphDiffService,
 *   createGraphDiffer,
 *   createNodeMatcher,
 *   createEdgeMatcher,
 *   GraphDiff,
 *   DiffOptions,
 * } from './diff';
 *
 * // Use the high-level service API
 * const service = createGraphDiffService(deps);
 * await service.initialize();
 *
 * const response = await service.getDiff({
 *   baseScanId,
 *   compareScanId,
 *   repositoryId,
 *   tenantId,
 * });
 *
 * if (response.success) {
 *   console.log(`Impact: ${response.diff.summary.impactAssessment}`);
 * }
 *
 * // Or use the lower-level differ directly
 * const differ = createGraphDiffer();
 * const diff = await differ.computeDiff(baseGraph, compareGraph);
 * ```
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type {
  // Branded ID types
  DiffId,
  DiffCacheKey,

  // Core diff types
  GraphDiff,
  NodeModification,
  EdgeModification,
  FieldChange,
  DiffSummary,
  TypeChangeSummary,

  // Options and configuration
  DiffOptions,
  DiffComputationStats,

  // Cache types
  CachedDiffResult,
  DiffCacheMetadata,

  // Request/Response types
  ComputeDiffRequest,
  ComputeDiffResponse,

  // Identity types
  NodeIdentity,
  EdgeIdentity,

  // Error types
  DiffErrorCode,
} from './types.js';

// ============================================================================
// Constants and Enums
// ============================================================================

export {
  // Change types
  ChangeType,
  ImpactLevel,

  // Error codes
  DiffErrorCodes,

  // Default options
  DEFAULT_DIFF_OPTIONS,
} from './types.js';

// ============================================================================
// Factory Functions for Branded Types
// ============================================================================

export {
  // ID creation
  createDiffId,
  createDiffCacheKey,
  generateDiffId,
  generateDiffCacheKey,

  // Identity key creation
  createNodeIdentityKey,
  createEdgeIdentityKey,

  // Cache metadata creation
  createDiffCacheMetadata,

  // Empty object creation
  createEmptyDiffSummary,
  createEmptyGraphDiff,
  createNodeModification,
  createEdgeModification,

  // Utility extraction
  extractNodeIdentity,

  // Impact calculation
  calculateImpactLevel,
} from './types.js';

// ============================================================================
// Type Guards
// ============================================================================

export {
  isDiffId,
  isDiffCacheKey,
  isGraphDiff,
  isNodeModification,
  isEdgeModification,
  isDiffSummary,
  isCachedDiffResult,
  isChangeType,
  isImpactLevel,
  isDiffCacheEntryValid,
} from './types.js';

// ============================================================================
// Node Matcher
// ============================================================================

export type { INodeMatcher, NodeMatcherOptions } from './node-matcher.js';

export {
  // Factory
  createNodeMatcher,

  // Class (for testing/extension)
  NodeMatcher,

  // Utility functions
  nodeKey,
  parseNodeKey,
  sameIdentity,
  groupNodesByType,
  groupNodesByFile,

  // Constants
  TRANSIENT_FIELDS,
  IDENTITY_FIELDS,
  COMPARABLE_FIELDS,
} from './node-matcher.js';

// ============================================================================
// Edge Matcher
// ============================================================================

export type { IEdgeMatcher, EdgeMatcherOptions } from './edge-matcher.js';

export {
  // Factory
  createEdgeMatcher,

  // Class (for testing/extension)
  EdgeMatcher,

  // Utility functions
  edgeKey,
  parseEdgeKey,
  sameEdgeIdentity,
  groupEdgesByType,
  groupEdgesBySource,
  groupEdgesByTarget,
  filterEdgesByType,
  filterEdgesByConfidence,
  isK8sEdgeType,
  isTerraformEdgeType,

  // Constants
  ALL_EDGE_TYPES,
  TRANSIENT_EDGE_FIELDS,
  IDENTITY_EDGE_FIELDS,
  COMPARABLE_EDGE_FIELDS,
} from './edge-matcher.js';

// ============================================================================
// Graph Differ
// ============================================================================

export type {
  IGraphDiffer,
  GraphDifferOptions,
  GraphDifferFactoryOptions,
  DiffCostEstimate,
} from './graph-differ.js';

export {
  // Factory
  createGraphDiffer,

  // Class (for testing/extension)
  GraphDiffer,

  // Error classes
  DiffError,
  DiffTimeoutError,
  DiffLimitError,

  // Utility functions
  hasDiffChanges,
  isDiffEmpty,
  getTotalChanges,
  filterDiff,
  mergeDiffs,

  // Constants
  ALGORITHM_VERSION,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_EDGES,
} from './graph-differ.js';

// ============================================================================
// Diff Cache
// ============================================================================

export type {
  IDiffCache,
  IDiffCacheConfig,
  DiffCacheStats,
  DiffCacheDependencies,
} from './diff-cache.js';

export {
  // Factory
  createDiffCache,

  // Singleton management
  getDefaultDiffCache,
  resetDefaultDiffCache,

  // Class (for testing/extension)
  DiffCache,

  // Configuration
  DEFAULT_DIFF_CACHE_CONFIG,

  // Constants
  DIFF_CACHE_VERSION,
  DEFAULT_DIFF_TTL_SECONDS,
  DEFAULT_L1_TTL_SECONDS,
  DEFAULT_L1_MAX_SIZE,
  DIFF_CACHE_PREFIX,
} from './diff-cache.js';

// ============================================================================
// Diff Repository
// ============================================================================

export type {
  IDiffRepository,
  DiffEntity,
  DiffRepositoryStats,
} from './diff-repository.js';

export {
  // Factory
  createDiffRepository,

  // Classes (for testing/extension)
  DiffRepository,
  TransactionalDiffRepository,

  // Utility functions
  entityToDiff,
  hasDiffData,
  getTotalChangeCount,
  isBreakingChange,
} from './diff-repository.js';

// ============================================================================
// Graph Diff Service (Main Public API)
// ============================================================================

export type {
  IGraphDiffService,
  GraphDiffServiceDependencies,
  GraphDiffServiceConfig,
  GraphDiffServiceStats,
  ListDiffsOptions,
  DiffListItem,
  DiffCostEstimateResponse,
} from './graph-diff-service.js';

export {
  // Factory functions
  createGraphDiffService,
  createGraphDiffServiceWithDefaults,

  // Singleton management
  getDefaultGraphDiffService,
  resetDefaultGraphDiffService,

  // Class (for testing/extension)
  GraphDiffService,

  // Error classes
  GraphDiffServiceError,
  RateLimitExceededError,
  ScanNotFoundError,
  RepositoryMismatchError,
} from './graph-diff-service.js';
