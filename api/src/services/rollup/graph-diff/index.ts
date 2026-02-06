/**
 * Graph Diff Computation Module
 * @module services/rollup/graph-diff
 *
 * Exports all types, interfaces, and utilities for the Graph Diff Computation system.
 * Computes structural differences between graph snapshots to enable
 * incremental rollup execution and efficient change detection.
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 */

// ============================================================================
// All Exports from Interfaces
// ============================================================================

export {
  // Branded Types
  type GraphDiffId,
  type NodeIdentityKey,
  type EdgeIdentityKey,
  type GraphSnapshotId,

  // Factory Functions for Branded Types
  createGraphDiffId,
  createNodeIdentityKey,
  createEdgeIdentityKey,
  createGraphSnapshotId,
  generateGraphDiffId,

  // Identity Types
  type NodeIdentity,
  type EdgeIdentity,

  // Diff Set Types
  type DiffChangeType,
  type NodeDiff,
  type AttributeChange,
  type NodeDiffSet,
  type EdgeDiff,
  type EdgeDiffSet,

  // Graph Diff Result Types
  type DiffSummary,
  type GraphDiffResult,
  type DiffTiming,

  // Computation Options
  type DiffComputationOptions,
  DEFAULT_DIFF_COMPUTATION_OPTIONS,
  type NodeIdentityConfig,

  // Graph Snapshot Types
  type GraphSnapshot,
  type GraphSnapshotRef,

  // Core Interfaces
  type IGraphDiffEngine,
  type DiffCostEstimate,
  type DiffValidationResult,
  type DiffValidationError,

  // Matcher Interfaces
  type INodeMatcher,
  type IEdgeMatcher,

  // Cache Interface
  type IDiffCache,
  type CachedDiffResult,
  type DiffCacheMetadata,
  type DiffCacheStats,

  // Error Types
  GraphDiffErrorCodes,
  type GraphDiffErrorCode,
  GraphDiffError,

  // Type Guards
  isNodeIdentity,
  isEdgeIdentity,
  isNodeDiff,
  isEdgeDiff,
  isValidChangeType,
  isGraphDiffResult,
  isGraphSnapshot,
  isGraphDiffErrorCode,

  // Factory Functions for Empty/Default Objects
  createEmptyNodeDiffSet,
  createEmptyEdgeDiffSet,
  createEmptyDiffSummary,
  createEmptyDiffCacheStats,
  createDefaultDiffTiming,
} from './interfaces.js';

// ============================================================================
// Node Matcher Exports
// ============================================================================

export {
  // Core Class
  NodeMatcher,

  // Types
  type NodeIdentityIndex,
  type NodeIndexStats,
  type AttributeChanges,

  // Factory Functions
  createNodeMatcher,
  createConfiguredNodeMatcher,
  createK8sNodeMatcher,
  createTerraformNodeMatcher,
  createNodeIdentityKeyFromParts,

  // Utility Functions
  normalizeFilePath,
  fnv1aHash,
  getNestedValue,
  deepEqual,
  getAllPaths,
  extractNamespace,
  getNodeCategory,
  DEFAULT_IGNORE_ATTRIBUTES,
} from './node-matcher.js';

// ============================================================================
// Edge Matcher Exports
// ============================================================================

export {
  // Core Class
  EdgeMatcher,

  // Types
  type EdgeIdentityIndex,
  type EdgeIndexStats,
  type EdgeAttributeChanges,
  type UnresolvedEdge,
  type ParsedEdgeIdentityKey,

  // Factory Functions
  createEdgeMatcher,
  createEdgeIdentityKeyFromParts,
  createEmptyEdgeIdentityIndex,
  createDefaultEdgeIndexStats,

  // Utility Functions
  hasPlaceholderReferences,
  parseEdgeIdentityKey,
  DEFAULT_EDGE_IGNORE_ATTRIBUTES,
  ALL_EDGE_TYPES,
} from './edge-matcher.js';

// ============================================================================
// Diff Cache Exports
// ============================================================================

export {
  // Core Class
  DiffCache,

  // Types
  type DiffCacheDependencies,
  type DiffCacheOptions,

  // Factory Functions
  createDiffCache,
  getDefaultDiffCache,
  resetDefaultDiffCache,
} from './diff-cache.js';

// ============================================================================
// Graph Diff Engine Exports
// ============================================================================

export {
  // Core Class
  GraphDiffEngine,

  // Factory Functions
  createGraphDiffEngine,
  createConfiguredGraphDiffEngine,
  createK8sGraphDiffEngine,
  createTerraformGraphDiffEngine,

  // Constants
  MEMORY_CONSTANTS,
  TIMING_CONSTANTS,
} from './graph-diff-engine.js';

// ============================================================================
// Graph Diff Service Exports
// ============================================================================

export {
  // Core Class
  GraphDiffService,

  // Service Interface
  type IGraphDiffService,

  // Request/Response Types
  type GraphDiffRequest,
  type GraphDiffResponse,
  type ListOptions,
  type GraphDiffListResponse,
  type DiffListItem,

  // Rate Limiter Types
  type IRateLimiter,
  type RateLimitResult,

  // Dependencies & Config
  type GraphDiffServiceDependencies,
  type GraphDiffServiceConfig,

  // Factory Functions
  createGraphDiffService,
  createGraphDiffServiceWithDefaults,
  getDefaultGraphDiffService,
  resetDefaultGraphDiffService,
} from './graph-diff-service.js';

// ============================================================================
// Diff Event Handlers Exports
// ============================================================================

export {
  // Event Types
  type DiffEventType,
  type ScanDeletedEvent,
  type ScanUpdatedEvent,
  type DiffComputedEvent,
  type DiffFailedEvent,
  type CacheInvalidatedEvent,
  type DiffEvent,
  type CloudEvent,

  // Publisher Interface
  type IDiffEventPublisher,

  // Configuration
  type DiffEventHandlerConfig,
  DEFAULT_DIFF_EVENT_HANDLER_CONFIG,

  // Event Emitter Classes
  DiffEventEmitter,
  InMemoryDiffEventEmitter,

  // Event Handler Classes
  ScanEventHandler,

  // Factory Functions
  createDiffEventEmitter,
  createInMemoryDiffEventEmitter,
  createScanEventHandler,
  createDiffEventHandlers,
  registerDiffEventHandlers,
} from './diff-event-handlers.js';

// ============================================================================
// Health Check Exports
// ============================================================================

export {
  // Core Class
  DiffHealthCheck,

  // Types
  type HealthStatus,
  type DependencyStatus,
  type DependencyHealth,
  type DiffServiceMetrics,
  type DiffServiceHealth,
  type DiffHealthCheckDependencies,
  type DiffHealthCheckConfig,
  type DiffHealthRouteOptions,

  // Configuration
  DEFAULT_HEALTH_CHECK_CONFIG,

  // Factory Functions
  createDiffHealthCheck,
  createDiffHealthPlugin,
  getDefaultDiffHealthCheck,
  resetDefaultDiffHealthCheck,

  // Fastify Plugin
  registerDiffHealthRoutes,
} from './health.js';

// ============================================================================
// Error Handling Exports (Enhanced)
// ============================================================================

export {
  // Error Codes (comprehensive)
  GraphDiffErrorCodes as GraphDiffErrorCodesEnhanced,

  // HTTP Status Mapping
  GraphDiffErrorHttpStatus,

  // Error Severity Mapping
  GraphDiffErrorSeverity,

  // Retryability Mapping
  GraphDiffErrorRetryable,

  // User-Friendly Messages
  GraphDiffErrorMessage,

  // Suggested Actions
  GraphDiffErrorAction,

  // Enhanced Error Class
  GraphDiffError as GraphDiffErrorEnhanced,

  // Specialized Error Classes
  DiffNotFoundError,
  ScanNotFoundError,
  ScansIncompatibleError,
  ComputationTimeoutError,
  MaxNodesExceededError,

  // Error Context
  type GraphDiffErrorContext,

  // Type Guards
  isGraphDiffError,
  isDiffNotFoundError,
  isScanNotFoundError,
  isScansIncompatibleError,
  isComputationTimeoutError,
  isMaxNodesExceededError,
  isRetryableGraphDiffError,

  // Error Wrapping
  wrapAsGraphDiffError,

  // HTTP Status Utilities
  graphDiffErrorToHttpStatus,
  graphDiffErrorCodeToHttpStatus,

  // Route Error Handler
  handleGraphDiffRouteError,
  type GraphDiffApiErrorResponse,

  // Factory Functions
  createGraphDiffError,
  getGraphDiffErrorInfo,
  getRetryableGraphDiffErrorCodes,
  getGraphDiffErrorCodesBySeverity,
  type GraphDiffErrorInfo,

  // Code Classification Utilities
  isValidationErrorCode,
  isResourceErrorCode,
  isComputationErrorCode,
  isLimitErrorCode,
  isPermissionErrorCode,
  isCacheErrorCode,
  isInfrastructureErrorCode,
  allowsGracefulDegradation,
} from './errors.js';

// ============================================================================
// Convenience Re-exports for Key Types
// ============================================================================

/**
 * Key types re-exported for convenience.
 * These are the primary interfaces consumers will interact with.
 *
 * Core Engine Interface:
 * - IGraphDiffEngine: Main engine for computing graph differences
 *
 * Matcher Interfaces:
 * - INodeMatcher: Node identity matching and diff detection
 * - IEdgeMatcher: Edge identity matching and diff detection
 *
 * Cache Interface:
 * - IDiffCache: Caching layer for diff results
 *
 * Service Interface:
 * - IGraphDiffService: High-level service for graph diff operations
 *
 * Health Check Interface:
 * - DiffHealthCheck: Health monitoring for the diff service
 * - DiffServiceHealth: Health response structure
 *
 * Result Types:
 * - GraphDiffResult: Complete diff computation result
 * - DiffSummary: Summary statistics of a diff
 *
 * Identity Types:
 * - NodeIdentity: Unique identifier for a node
 * - EdgeIdentity: Unique identifier for an edge
 *
 * Error Handling:
 * - GraphDiffError: Base error class for all graph diff errors
 * - GraphDiffErrorCodes: Enumeration of all error codes
 */
