/**
 * Rollup Service Module Exports
 * @module services/rollup
 *
 * Central exports for the Cross-Repository Aggregation (Rollup) service.
 * Provides interfaces, matchers, engines, error types, and configuration.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation module
 */

// ============================================================================
// Interfaces
// ============================================================================

export {
  // Service interface
  type IRollupService,
  type RollupServiceConfig,
  DEFAULT_ROLLUP_SERVICE_CONFIG,
  // Repository interface
  type IRollupRepository,
  // Matcher interfaces
  type IMatcher,
  type IMatcherFactory,
  type MatchCandidate,
  // Engine interfaces
  type IMergeEngine,
  type MergeInput,
  type MergeOutput,
  type IBlastRadiusEngine,
  // Entity interfaces
  type RollupEntity,
  type RollupExecutionEntity,
  // Validation interfaces
  type ConfigurationValidationResult,
  type ValidationError,
  type ValidationWarning,
  // Legacy error class (from interfaces)
  RollupServiceError,
} from './interfaces.js';

// ============================================================================
// Service Implementation
// ============================================================================

export {
  // Main service
  RollupService,
  createRollupService,
  type RollupServiceDependencies,
  type ICacheService,
  type IQueueService,
} from './rollup-service.js';

// ============================================================================
// Executor Implementation
// ============================================================================

export {
  RollupExecutor,
  createRollupExecutor,
  type RollupExecutorDependencies,
  type IScanRepository,
} from './rollup-executor.js';

// ============================================================================
// Event Emitter Implementation
// ============================================================================

export {
  // Event emitter
  RollupEventEmitter,
  InMemoryRollupEventEmitter,
  createRollupEventEmitter,
  createInMemoryEventEmitter,
  // Interfaces
  type IRollupEventEmitter,
  type IEventPublisher,
  // Types
  type RollupEvent,
  type RollupEventWithMetadata,
  type RollupEventType,
  type RollupEventEmitterConfig,
  DEFAULT_EVENT_EMITTER_CONFIG,
} from './rollup-event-emitter.js';

// ============================================================================
// Factory Functions
// ============================================================================

export {
  // Module factory
  createRollupModule,
  createTestRollupModule,
  // Configuration
  type RollupModuleConfig,
  type RollupModuleExternalDependencies,
  type RollupModule,
  getDefaultRollupModuleConfig,
  mergeRollupConfig,
  validateExternalDependencies,
} from './factory.js';

// ============================================================================
// Matcher Implementations
// ============================================================================

export {
  // Base matcher class
  BaseMatcher,
  // Concrete matchers
  ArnMatcher,
  ResourceIdMatcher,
  NameMatcher,
  TagMatcher,
  // Matcher factory
  MatcherFactory,
  createMatcherFactory,
  getDefaultMatcherFactory,
  resetDefaultMatcherFactory,
} from './matchers/index.js';

// ============================================================================
// Engine Implementations
// ============================================================================

export {
  // Merge engine
  MergeEngine,
  createMergeEngine,
} from './merge-engine.js';

export {
  // Blast radius engine
  BlastRadiusEngine,
  createBlastRadiusEngine,
} from './blast-radius-engine.js';

// ============================================================================
// Error Classes
// ============================================================================

export {
  // Error codes
  RollupErrorCodes,
  type RollupErrorCode,
  // Error classes
  RollupError,
  RollupConfigurationError,
  RollupNotFoundError,
  RollupExecutionNotFoundError,
  RollupExecutionError,
  RollupMergeError,
  RollupBlastRadiusError,
  RollupBlastRadiusExceededError,
  RollupLimitExceededError,
  RollupAggregateError,
  // Type guards
  isRollupError,
  isRollupNotFoundError,
  isRollupConfigurationError,
  isRollupMergeError,
  isRollupExecutionError,
  isRollupBlastRadiusError,
  isRetryableRollupError,
  // Error factory functions
  createRollupError,
  wrapAsRollupError,
  // Extended types
  type RollupErrorContext,
  type SerializedRollupError,
} from './errors.js';

// ============================================================================
// Error Codes Module
// ============================================================================

export {
  // Error code enumeration
  RollupErrorCode as RollupErrorCodeEnum,
  type RollupErrorCodeType,
  // Severity levels
  RollupErrorSeverity,
  // Error info mappings
  RollupErrorMessage,
  RollupErrorSeverityMap,
  RollupErrorHttpStatus,
  RollupErrorRetryable,
  RollupErrorAction,
  // Utility functions
  getRollupErrorInfo,
  isValidationError,
  isResourceError,
  isExecutionError,
  isInfrastructureError,
  isPermissionError,
  isLimitError,
  getErrorCodesBySeverity,
  getRetryableErrorCodes,
} from './error-codes.js';

// ============================================================================
// Error Recovery Service
// ============================================================================

export {
  // Recovery service
  RollupErrorRecoveryService,
  createErrorRecoveryService,
  // Retry policies
  DEFAULT_EXECUTION_RETRY_POLICY,
  DEFAULT_EXTERNAL_RETRY_POLICY,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  // Convenience functions
  withRollupRetry,
  withRollupCircuitBreaker,
  // Types
  type RollupRetryPolicy,
  type RollupCircuitBreakerConfig,
  type DeadLetterEntry,
  type RecoveryResult,
  type ExecutionState,
} from './error-recovery.js';

// ============================================================================
// Logging, Metrics, Tracing, and Audit
// ============================================================================

export {
  // Rollup Logger
  type RollupLogger,
  type RollupLogContext,
  type RollupLogFields,
  type RollupPhase,
  type ExecutionStats,
  createRollupLogger,
  createExecutionLogger,
  createConfigLogger,
  getRollupLogger,
  resetRollupLogger,
  withRollupLogging,
  createRollupTimer,
} from './logger.js';

export {
  // Rollup Metrics
  rollupMetrics,
  RollupMetricsCollector,
  getRollupMetricsCollector,
  resetRollupMetricsCollector,
  // Individual metrics (for advanced use)
  rollupExecutionsTotal,
  rollupNodesProcessedTotal,
  rollupMatchesFoundTotal,
  rollupErrorsTotal,
  rollupOperationsTotal,
  rollupCrossRepoEdgesTotal,
  rollupExecutionDurationSeconds,
  rollupPhaseDurationSeconds,
  rollupActiveExecutions,
  rollupCacheHitRatio,
  rollupMatcherDurationSeconds,
  rollupMergeDurationSeconds,
  rollupBlastRadiusDurationSeconds,
  allRollupMetrics,
  // Types
  type ExecutionStatus,
  type ExecutionPhase,
} from './metrics.js';

export {
  // Rollup Tracing
  RollupTracer,
  createExecutionTracer,
  createConfigTracer,
  getRollupTracer,
  startRollupSpan,
  withRollupSpan,
  // Domain-specific tracing functions
  traceRollupExecution,
  traceFetchGraphs,
  traceMatcher,
  traceMerge,
  traceBlastRadius,
  traceRollupOperation,
  traceRollupDatabase,
  traceCallback,
  // Attribute helpers
  RollupAttributes,
  addRollupSpanAttributes,
  addExecutionResultAttributes,
  addMatchResultAttributes,
  addMergeResultAttributes,
  // Event helpers
  addRollupSpanEvent,
  recordPhaseStarted,
  recordPhaseCompleted,
  recordMatchFoundEvent,
  recordMergeConflictEvent,
  // Error recording
  recordRollupException,
  recordActiveSpanError,
  // Context propagation
  getRollupTraceContext,
  createRollupTraceHeaders,
  // Types
  type RollupSpanAttributes,
  type RollupTracePhase,
} from './tracing.js';

export {
  // Rollup Audit Logger
  RollupAuditLogger,
  getRollupAuditLogger,
  createRollupAuditLogger,
  resetRollupAuditLogger,
  // Audit event types
  RollupAuditEventType,
  type RollupAuditEventType as RollupAuditEventTypeType,
  // Utility functions
  createRollupUpdateChanges,
  // Types
  type RollupAuditTarget,
  type RollupAuditMetadata,
  type CreateRollupAuditEventOptions,
} from './audit.js';

// ============================================================================
// External Object Index (TASK-ROLLUP-003)
// ============================================================================

export {
  // Main service
  ExternalObjectIndexService,
  createExternalObjectIndexService,
  // Index engine
  IndexEngine,
  createIndexEngine,
  getDefaultIndexEngine,
  // Cache
  ExternalObjectCache,
  createExternalObjectCache,
  getDefaultExternalObjectCache,
  // Repository
  ExternalObjectRepository,
  createExternalObjectRepository,
  // Extractors
  BaseExtractor,
  ArnExtractor,
  createArnExtractor,
  ResourceIdExtractor,
  createResourceIdExtractor,
  K8sExtractor,
  createK8sExtractor,
  ExtractorFactory,
  createExtractorFactory,
  getDefaultExtractorFactory,
  // Event handlers
  ScanCompletedEventHandler,
  createEventHandlers as createExternalObjectIndexEventHandlers,
  registerEventHandlers as registerExternalObjectIndexEventHandlers,
  // Module factory
  createExternalObjectIndexModule,
  createTestExternalObjectIndexModule,
  // Errors
  ExternalObjectIndexErrorCodes,
  ExternalObjectIndexError,
  IndexBuildError,
  LookupError,
  ExtractionError,
  CacheError as ExternalObjectCacheError,
  isExternalObjectIndexError,
  isIndexBuildError,
  isLookupError,
  isExtractionError,
  isCacheError as isExternalObjectCacheError,
  isRetryableIndexError,
  // Types
  type ExternalReferenceType,
  type ExternalObjectEntry,
  type ExternalObjectLookupResult,
  type ReverseLookupResult,
  type ExternalObjectIndexStats,
  type IndexBuildOptions,
  type IndexBuildResult,
  type IExternalObjectIndexService,
  type IIndexEngine,
  type IExternalObjectRepository,
  type IExternalObjectCache,
  type IExternalReferenceExtractor,
  type IExtractorFactory,
  type ExtractedReference,
  type ExternalObjectCacheConfig,
  type ExternalObjectIndexServiceConfig,
  type ExternalObjectIndexModuleDependencies,
  type ExternalObjectIndexModule,
  type IDatabaseClient,
  type ScanCompletedEvent,
  type IndexUpdatedEvent,
  type IEventPublisher as IExternalObjectEventPublisher,
  type EventHandlerConfig as ExternalObjectEventHandlerConfig,
  type ExternalObjectIndexErrorCode,
  // Default configs
  DEFAULT_EXTERNAL_OBJECT_CACHE_CONFIG,
  DEFAULT_EXTERNAL_OBJECT_INDEX_CONFIG,
  DEFAULT_EVENT_HANDLER_CONFIG as DEFAULT_EXTERNAL_OBJECT_EVENT_HANDLER_CONFIG,
} from './external-object-index/index.js';

// ============================================================================
// Graph Diff Computation (TASK-ROLLUP-005)
// ============================================================================

export {
  // Branded Types
  type GraphDiffId,
  type NodeIdentityKey,
  type EdgeIdentityKey,
  type GraphSnapshotId,
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

  // Error Types (from interfaces)
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

  // Factory Functions
  createEmptyNodeDiffSet,
  createEmptyEdgeDiffSet,
  createEmptyDiffSummary,
  createEmptyDiffCacheStats,
  createDefaultDiffTiming,

  // Node Matcher
  NodeMatcher,
  type NodeIdentityIndex,
  type NodeIndexStats,
  type AttributeChanges,
  createNodeMatcher,
  createConfiguredNodeMatcher,
  createK8sNodeMatcher,
  createTerraformNodeMatcher,
  createNodeIdentityKeyFromParts,
  normalizeFilePath,
  fnv1aHash,
  getNestedValue,
  deepEqual,
  getAllPaths,
  extractNamespace,
  getNodeCategory,
  DEFAULT_IGNORE_ATTRIBUTES,

  // Edge Matcher
  EdgeMatcher,
  type EdgeIdentityIndex,
  type EdgeIndexStats,
  type EdgeAttributeChanges,
  type UnresolvedEdge,
  type ParsedEdgeIdentityKey,
  createEdgeMatcher,
  createEdgeIdentityKeyFromParts,
  createEmptyEdgeIdentityIndex,
  createDefaultEdgeIndexStats,
  hasPlaceholderReferences,
  parseEdgeIdentityKey,
  DEFAULT_EDGE_IGNORE_ATTRIBUTES,
  ALL_EDGE_TYPES,

  // Diff Cache
  DiffCache,
  type DiffCacheDependencies,
  type DiffCacheOptions,
  createDiffCache,
  getDefaultDiffCache,
  resetDefaultDiffCache,

  // Graph Diff Engine
  GraphDiffEngine,
  createGraphDiffEngine,
  createConfiguredGraphDiffEngine,
  createK8sGraphDiffEngine,
  createTerraformGraphDiffEngine,
  MEMORY_CONSTANTS,
  TIMING_CONSTANTS,

  // Graph Diff Service
  GraphDiffService,
  type IGraphDiffService,
  type GraphDiffRequest,
  type GraphDiffResponse,
  type ListOptions as GraphDiffListOptions,
  type GraphDiffListResponse,
  type DiffListItem,
  type IRateLimiter as IGraphDiffRateLimiter,
  type RateLimitResult as GraphDiffRateLimitResult,
  type GraphDiffServiceDependencies,
  type GraphDiffServiceConfig,
  createGraphDiffService,
  createGraphDiffServiceWithDefaults,
  getDefaultGraphDiffService,
  resetDefaultGraphDiffService,

  // Diff Event Handlers
  type DiffEventType,
  type ScanDeletedEvent as DiffScanDeletedEvent,
  type ScanUpdatedEvent as DiffScanUpdatedEvent,
  type DiffComputedEvent,
  type DiffFailedEvent,
  type CacheInvalidatedEvent,
  type DiffEvent,
  type CloudEvent as DiffCloudEvent,
  type IDiffEventPublisher,
  type DiffEventHandlerConfig,
  DEFAULT_DIFF_EVENT_HANDLER_CONFIG,
  DiffEventEmitter,
  InMemoryDiffEventEmitter,
  ScanEventHandler as DiffScanEventHandler,
  createDiffEventEmitter,
  createInMemoryDiffEventEmitter,
  createScanEventHandler as createDiffScanEventHandler,
  createDiffEventHandlers,
  registerDiffEventHandlers,
} from './graph-diff/index.js';
