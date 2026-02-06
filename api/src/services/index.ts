/**
 * Services Module Exports
 * @module services
 *
 * Central exports for all domain and application services.
 * Services orchestrate business logic and coordinate operations.
 */

// Scan Service - Main orchestration service
export {
  ScanService,
  createScanService,
  type IScanService,
  type IScanEventEmitter,
  type IFileDiscovery,
  type IScanPersistence,
  type ScanServiceConfig,
  type StartScanInput,
  type ScanResult,
  type ScanEvent,
  type ScanEventType,
  type ProgressCallback,
  type DiscoveredFile,
  ScanServiceError,
  type ScanServiceErrorCode,
  DEFAULT_SCAN_SERVICE_CONFIG,
} from './scan-service.js';

// Parser Orchestrator - Batch file parsing
export {
  ParserOrchestrator,
  createParserOrchestrator,
  type IParserOrchestrator,
  type ParserOrchestratorConfig,
  type ParserOrchestratorInput,
  type ParserOrchestratorResult,
  type ParserOrchestratorStats,
  type FileInput,
  type ParsedFile,
  type ParseFileMetadata,
  type ParseErrorDetail,
  type ParseWarningDetail,
  DEFAULT_PARSER_ORCHESTRATOR_CONFIG,
} from './parser-orchestrator.js';

// Detection Orchestrator - Detection pipeline coordination
export {
  DetectionOrchestrator,
  createDetectionOrchestrator,
  type IDetectionOrchestrator,
  type DetectionOrchestratorConfig,
  type DetectionOrchestratorInput,
  type DetectionOrchestratorResult,
  type DetectionOrchestratorStats,
  type DetectionProgress,
  type DetectionPhase,
  type DetectionErrorDetail,
  type DetectionWarningDetail,
  type ModuleDetectionPhaseResult,
  type ReferenceDetectionPhaseResult,
  type DataSourceDetectionPhaseResult,
  DEFAULT_DETECTION_ORCHESTRATOR_CONFIG,
} from './detection-orchestrator.js';

// Graph Service - Dependency graph operations
export {
  GraphService,
  createGraphService,
  type IGraphService,
  type GraphServiceConfig,
  type BuildGraphInput,
  type TraversalOptions,
  type TraversalResult,
  type TraversalPath,
  type TraversalStats,
  type CycleDetectionResult,
  type DetectedCycle,
  type CycleDetectionStats,
  type ImpactAnalysisResult,
  type ImpactSummary,
  type SubgraphOptions,
  type GraphStats,
  DEFAULT_GRAPH_SERVICE_CONFIG,
  DEFAULT_TRAVERSAL_OPTIONS,
} from './graph-service.js';

// Scoring Service - Confidence scoring
export {
  ScoringService,
  createScoringService,
  type IScoringService,
  type ScoringServiceConfig,
  type BatchScoringInput,
  type BatchScoringResult,
  type BatchScoringStats,
  type EdgeEvidenceMap,
  type FilteredEdge,
  type ConfidenceDistribution,
  type EvidenceScoreBreakdown,
  DEFAULT_SCORING_SERVICE_CONFIG,
} from './scoring-service.js';

// Rollup Service - Cross-Repository Aggregation
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
  // Service implementation
  RollupService,
  createRollupService,
  type RollupServiceDependencies,
  type ICacheService,
  type IQueueService,
  // Executor implementation
  RollupExecutor,
  createRollupExecutor,
  type RollupExecutorDependencies,
  type IScanRepository,
  // Event emitter implementation
  RollupEventEmitter,
  InMemoryRollupEventEmitter,
  createRollupEventEmitter,
  createInMemoryEventEmitter,
  type IRollupEventEmitter,
  type IEventPublisher,
  type RollupEvent,
  type RollupEventWithMetadata,
  type RollupEventType,
  type RollupEventEmitterConfig,
  DEFAULT_EVENT_EMITTER_CONFIG,
  // Factory functions
  createRollupModule,
  createTestRollupModule,
  type RollupModuleConfig,
  type RollupModuleExternalDependencies,
  type RollupModule,
  getDefaultRollupModuleConfig,
  mergeRollupConfig,
  validateExternalDependencies,
  // Matcher implementations
  BaseMatcher,
  ArnMatcher,
  ResourceIdMatcher,
  NameMatcher,
  TagMatcher,
  MatcherFactory,
  createMatcherFactory,
  getDefaultMatcherFactory,
  resetDefaultMatcherFactory,
  // Engine implementations
  MergeEngine,
  createMergeEngine,
  BlastRadiusEngine,
  createBlastRadiusEngine,
  // Error classes
  RollupErrorCodes,
  type RollupErrorCode,
  RollupError,
  RollupConfigurationError,
  RollupNotFoundError,
  RollupExecutionNotFoundError,
  RollupExecutionError,
  RollupMergeError,
  RollupBlastRadiusError,
  RollupBlastRadiusExceededError,
  RollupLimitExceededError,
  // Error type guards
  isRollupError,
  isRollupNotFoundError,
  isRollupConfigurationError,
  isRollupMergeError,
  isRollupExecutionError,
  isRollupBlastRadiusError,
  isRetryableRollupError,
} from './rollup/index.js';

// Terragrunt Edge Service - Edge creation from Terragrunt configs (TASK-TG-008)
export {
  // Service class and factory
  TerragruntEdgeService,
  createTerragruntEdgeService,
  createEdgesFromNodeResult,

  // Service interface
  type ITerragruntEdgeService,

  // Configuration and options
  type TerragruntEdgeServiceOptions,
  DEFAULT_EDGE_SERVICE_OPTIONS,

  // Context types
  type EdgeCreationContext,

  // Result types
  type TerragruntEdgeResult,
  type UnresolvedReference,
  type EdgeStatistics,
  type SourceEdgeCreationResult,

  // Validation utilities
  validateEdgeCreationContext,
  hasUnresolvedReferences,
  filterEdgesByType,

  // Re-exported types for convenience
  type TgEdgeFactoryOptions,
  type TgEdge,
  type TgIncludesEdge,
  type TgDependsOnEdge,
  type TgPassesInputEdge,
  type TgSourcesEdge,
  TG_EDGE_TYPES,
  isTgIncludesEdge,
  isTgDependsOnEdge,
  isTgSourcesEdge,
  isTgEdge,

  // TF Linker re-exports
  type TfLinkerContext,
  type TfLinkerResult,
  type TerraformSourceType,
  type TerraformSourceExpression,
  type ITerraformLinker,
  createTerraformLinker,
  createLinkerContext,
  buildModuleMap,
  isSuccessfulResolution,
  isSyntheticResolution,

  // Node factory re-exports
  type BatchTerragruntNodeResult,
  type DependencyHint,
  type IncludeHint,

  // Edge error re-exports
  TerragruntEdgeError,
  SourceResolutionError,
  BatchEdgeError,
  wrapEdgeError,
  wrapSourceError,
  canContinueAfterEdgeError,
  isTerragruntEdgeError,
  isSourceResolutionError,
  isBatchEdgeError,
  type EdgeErrorContext,
  type SourceErrorContext,
  type BatchEdgeErrorContext,
  type EdgeErrorSummary,
  type EdgeRecoveryResult,
  attemptEdgeRecovery,
} from './terragrunt-edge-service.js';

// Security Audit Service - Security audit and compliance checking (TASK-SECURITY)
export {
  // Service class and factory
  SecurityAuditService,
  createSecurityAuditService,
  getSecurityAuditService,
  resetSecurityAuditService,

  // Service interface
  type ISecurityAuditService,

  // Re-export security audit service instance (deprecated)
  securityAuditService,
} from './security-audit.service.js';

// ============================================================================
// Documentation System Services (TASK-FINAL-004)
// ============================================================================

// Documentation Service - Documentation page management
export {
  // Service class and factory
  DocumentationService,
  createDocumentationService,
  getDocumentationService,
  resetDocumentationService,

  // Service interface
  type IDocumentationService,

  // DTOs
  type CreateDocPageDTO,
  type UpdateDocPageDTO,

  // Filter and sort types
  type ListDocPagesFilter,
  type ListDocPagesSort,

  // Common types
  type PaginationOptions as DocPaginationOptions,
  type PaginatedResult as DocPaginatedResult,
  type ServiceError as DocServiceError,
  type ServiceResult as DocServiceResult,
} from './DocumentationService.js';

// Beta Onboarding Service - Beta customer lifecycle management
export {
  // Service class and factory
  BetaOnboardingService,
  createBetaOnboardingService,
  getBetaOnboardingService,
  resetBetaOnboardingService,

  // Service interface
  type IBetaOnboardingService,

  // DTOs
  type RegisterBetaCustomerDTO,
  type UpdateBetaCustomerDTO,

  // Filter and sort types
  type ListCustomersFilter,
  type ListCustomersSort,

  // Event types
  type NDASignatureInfo,
  type OnboardingProgressEvent,

  // Common types (aliased to avoid conflicts)
  type PaginationOptions as BetaPaginationOptions,
  type PaginatedResult as BetaPaginatedResult,
  type ServiceError as BetaServiceError,
  type ServiceResult as BetaServiceResult,
} from './BetaOnboardingService.js';

// Launch Readiness Service - Launch checklist and readiness tracking
export {
  // Service class and factory
  LaunchReadinessService,
  createLaunchReadinessService,
  getLaunchReadinessService,
  resetLaunchReadinessService,

  // Service interface
  type ILaunchReadinessService,

  // DTOs
  type CreateChecklistItemDTO,
  type UpdateChecklistItemDTO,
  type CompleteItemDTO,

  // Filter types
  type ListItemsFilter,

  // Assessment types
  type LaunchReadinessAssessment,
  type BlockerInfo,
  type BulkOperationResult,

  // Default items
  DEFAULT_LAUNCH_CHECKLIST_ITEMS,
  initializeDefaultChecklist,

  // Common types (aliased to avoid conflicts)
  type ServiceError as LaunchServiceError,
  type ServiceResult as LaunchServiceResult,
} from './LaunchReadinessService.js';
