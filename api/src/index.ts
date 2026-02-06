/**
 * IaC Dependency Detection API
 * @module @code-reviewer/api
 *
 * Main entry point for the IaC Dependency Detection API.
 * Exports all public types, services, and utilities.
 *
 * @example
 * ```typescript
 * // Import specific modules
 * import { ScanService, createScanService } from '@code-reviewer/api/services';
 * import { BaseParser, ParserRegistry } from '@code-reviewer/api/parsers';
 * import { BaseDetector, ReferenceResolver } from '@code-reviewer/api/detectors';
 *
 * // Or import from main entry point
 * import {
 *   // Types
 *   NodeType,
 *   EdgeType,
 *   Evidence,
 *
 *   // Services
 *   ScanService,
 *   GraphService,
 *
 *   // Parsers
 *   ParserRegistry,
 *   HelmChartParser,
 *
 *   // Errors
 *   ParseError,
 *   DetectionError,
 * } from '@code-reviewer/api';
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Health check types
  HealthCheck,
  DetailedHealthCheck,
  LivenessProbe,
  ReadinessProbe,
  ErrorResponse,
  TenantContext,

  // Repository types
  RepositoryType,
  RepositoryListResponse,
  CloneRequest,
  CloneResponse,

  // Graph types (from graph.js)
  NodeType,
  EdgeType,

  // Evidence types (from evidence.js)
  Evidence,
  EvidencePointer,
  ConfidenceScore,
  ScoringRule,

  // Utility types
  Brand,
  DeepReadonly,
  DeepPartial,
  DeepRequired,
  Result,
  AsyncResult,
  NonEmptyArray,
  JsonValue,
  JsonObject,

  // Auth types
  JWTClaims,
  GitHubUser,
  Session,
  AuthTokenResponse,
  AuthContext,
} from './types/index.js';

// ============================================================================
// Parsers
// ============================================================================

export {
  // Base infrastructure
  BaseParser,
  isParseSuccess,
  isParseFailure,
  DEFAULT_PARSER_OPTIONS,

  // Registry
  ParserRegistry,
  parserRegistry,

  // Helm parser
  HelmChartParser,
  HelmValuesParser,
  HelmTemplateAnalyzer,

  // Module detector
  ModuleDetector,
  moduleDetector,
  parseModuleSource,
} from './parsers/index.js';

export type {
  // Parser types
  ParseResult,
  ParseSuccess,
  ParseFailure,
  ParseError as ParseErrorType,
  IParser,
  ParserOptions,
  IaCFormat,

  // Terraform types
  TerraformFile,
  TerraformBlock,
  TerraformResourceNode,

  // Helm types
  HelmChartId,
  ChartMetadata,
  HelmValuesFile,
  HelmTemplateFile,
  K8sResourceExtraction,
} from './parsers/index.js';

// ============================================================================
// Detectors
// ============================================================================

export {
  // Base infrastructure
  BaseDetector,
  EvidenceCollector,
  isDetectionSuccess,
  isDetectionFailure,
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
  DEFAULT_SCORING_RULES,

  // Reference resolver
  ReferenceResolver,
  createReferenceResolver,
  resolveReferences,

  // Data source detector
  DataSourceDetector,
  createDataSourceDetector,
  detectDataSources,
} from './detectors/index.js';

export type {
  // Detection types
  DetectionResult,
  DetectionSuccess,
  DetectionFailure,
  DetectionContext,
  DetectionOptions,
  IDetector,

  // Reference types
  ResourceReference,
  ReferenceResolution,
  CrossReference,

  // Data source types
  DataSourceNode,
  DataSourceDependency,

  // Module types
  ModuleDependency,
  ModuleSourceInfo,
} from './detectors/index.js';

// ============================================================================
// Services
// ============================================================================

export {
  // Scan service
  ScanService,
  createScanService,
  ScanServiceError,
  DEFAULT_SCAN_SERVICE_CONFIG,

  // Parser orchestrator
  ParserOrchestrator,
  createParserOrchestrator,
  DEFAULT_PARSER_ORCHESTRATOR_CONFIG,

  // Detection orchestrator
  DetectionOrchestrator,
  createDetectionOrchestrator,
  DEFAULT_DETECTION_ORCHESTRATOR_CONFIG,

  // Graph service
  GraphService,
  createGraphService,
  DEFAULT_GRAPH_SERVICE_CONFIG,

  // Scoring service
  ScoringService,
  createScoringService,
  DEFAULT_SCORING_SERVICE_CONFIG,
} from './services/index.js';

export type {
  // Scan service types
  IScanService,
  ScanServiceConfig,
  StartScanInput,
  ScanResult,
  ScanEvent,

  // Parser orchestrator types
  IParserOrchestrator,
  ParserOrchestratorConfig,
  ParserOrchestratorResult,

  // Detection orchestrator types
  IDetectionOrchestrator,
  DetectionOrchestratorConfig,
  DetectionOrchestratorResult,

  // Graph service types
  IGraphService,
  GraphServiceConfig,
  TraversalOptions,
  TraversalResult,
  CycleDetectionResult,
  ImpactAnalysisResult as GraphImpactResult,

  // Scoring service types
  IScoringService,
  ScoringServiceConfig,
  BatchScoringResult,
} from './services/index.js';

// ============================================================================
// Repositories
// ============================================================================

export {
  // Base repository
  BaseRepository,

  // Repository implementations
  ScanRepository,
  createScanRepository,
  NodeRepository,
  createNodeRepository,
  EdgeRepository,
  createEdgeRepository,
  EvidenceRepository,
  createEvidenceRepository,
  GraphQuerier,
  createGraphQuerier,

  // Unit of work
  UnitOfWork,
  createUnitOfWork,
  ScanPersistenceAdapter,
  createScanPersistenceAdapter,

  // Factory
  createRepositories,
} from './repositories/index.js';

export type {
  // Common types
  PaginationParams,
  PaginatedResult,
  SortDirection,
  SortParams,
  RepositoryResult,
  BatchResult,

  // Repository interfaces
  IScanRepository,
  INodeRepository,
  IEdgeRepository,
  IEvidenceRepository,
  IGraphQuerier,
  IUnitOfWork,

  // Input types
  CreateScanInput,
  CreateNodeInput,
  CreateEdgeInput,
  CreateEvidenceInput,

  // Filter types
  ScanFilterCriteria,
  NodeFilterCriteria,
  EdgeFilterCriteria,
  EvidenceFilterCriteria,
} from './repositories/index.js';

// ============================================================================
// Errors
// ============================================================================

export {
  // Base error
  BaseError,
  isBaseError,
  isOperationalError,
  wrapError,
  getErrorMessage,

  // Error codes
  ErrorCodes,
  HttpErrorCodes,
  ParserErrorCodes,
  DetectionErrorCodes,

  // Domain errors
  ParseError,
  HCLParseError,
  YAMLParseError,
  HelmParseError,
  DetectionError,
  UnresolvedReferenceError,
  CircularReferenceError,
  ScoringError,
  GraphError,
  ScanError,

  // Infrastructure errors
  DatabaseError,
  RepositoryError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,

  // Recovery strategies
  withRetry,
  CircuitBreaker,
  withFallback,
  withTimeout,
  withResilience,

  // Error tracking
  ErrorReporter,
  createErrorReporter,
  ErrorSeverity,
} from './errors/index.js';

export type {
  // Error types
  ErrorContext,
  SerializedError,
  ErrorCode,

  // Recovery types
  RetryOptions,
  CircuitBreakerOptions,
  CircuitBreakerStats,

  // Tracking types
  ErrorReporterConfig,
  ErrorReport,
} from './errors/index.js';

// ============================================================================
// Logging
// ============================================================================

export {
  // Logger
  createLogger,
  getLogger,
  initLogger,
  createModuleLogger,

  // Request context
  createRequestContext,
  runWithContext,
  getRequestContext,
  getRequestLogger,
  requestLoggerPlugin,

  // Metrics
  metricsRegistry,
  metrics,
  getMetrics,
  metricsPlugin,

  // Audit
  AuditLogger,
  AuditEventType,
  AuditSeverity,
  getAuditLogger,
  audit,

  // Tracing
  initTracing,
  shutdownTracing,
  getTracer,
  startSpan,
  withSpan,
  tracingPlugin,

  // Combined
  initLogging,
  shutdownLogging,
  loggingPlugin,
} from './logging/index.js';

export type {
  // Logger types
  LogContext,
  LoggerConfig,
  StructuredLogger,

  // Request context types
  RequestContext,
  RequestLoggerPluginOptions,

  // Audit types
  AuditEvent,
  AuditActor,
  AuditTarget,

  // Tracing types
  TracingConfig,
  SpanContext,
  CreateSpanOptions,

  // Combined types
  LoggingConfig,
  LoggingPluginOptions,
} from './logging/index.js';

// ============================================================================
// Configuration
// ============================================================================

export {
  // Initialization
  initConfig,
  resetConfig,
  getConfig,
  getConfigAsync,
  isConfigInitialized,

  // Section accessors
  getServerConfig,
  getDatabaseConfig,
  getRedisConfig,
  getParserConfig,
  getDetectionConfig,
  getAuthConfig,
  getEnvironment,
  isProduction,
  isDevelopment,
  isTest,

  // Feature flags
  getFeatureFlagService,
  isFeatureEnabled,
  isFeatureEnabledSync,

  // Loader
  ConfigLoader,
  createConfigLoader,
  validateConfig,

  // Proxy
  config,
} from './config/index.js';

export type {
  // Config types
  AppConfig,
  Environment,
  ServerConfig,
  DatabaseConfig,
  RedisConfig,
  QueueConfig,
  ParserConfig,
  DetectionConfig,
  AuthConfig,
  FeatureFlags,
  LoggingConfig as ConfigLoggingConfig,
  MonitoringConfig,
  StorageConfig,

  // Loader types
  ConfigLoaderOptions,
  ConfigInitOptions,

  // Feature flag types
  FeatureFlagContext,
  FeatureFlagName,
} from './config/index.js';

// ============================================================================
// Application
// ============================================================================

export { buildApp, buildTestApp } from './app.js';

export type { AppOptions } from './app.js';

// ============================================================================
// Constants
// ============================================================================

export {
  // API Constants
  API,
  // Scan Constants
  SCAN,
  type ScanStatus,
  // Parser Constants
  PARSER,
  // Graph Constants
  GRAPH,
  type GraphNodeType,
  type GraphEdgeType,
  // Cache Constants
  CACHE,
  // Queue Constants
  QUEUE,
  type QueuePriority,
  // Scoring Constants
  SCORING,
  // HTTP Status Codes
  HTTP_STATUS,
  // Environment Constants
  ENV,
  type Environment,
  // Rate Limiting Constants
  RATE_LIMIT,
  // Validation Constants
  VALIDATION,
  // Database Constants
  DATABASE,
  // Logging Constants
  LOGGING,
  // Feature Flags
  FEATURE_FLAGS,
  // Utility
  getEnvConstants,
} from './constants/index.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Result Type (ok/err pattern)
  type Ok,
  type Err,
  type Result as OkErrResult,
  ok,
  err,
  isOk,
  isErr,
  unwrap as unwrapResult,
  unwrapOr as unwrapOrResult,
  unwrapOrElse as unwrapOrElseResult,
  map as mapResult,
  mapErr as mapErrResult,
  andThen,
  orElse,
  tryCatch,
  tryCatchSync,
  collect,
  partition as partitionResults,
  combine,
  match,

  // Domain Result Types
  type DomainError,
  type DomainResult,
  notFound,
  validationErr,
  conflictErr,
  permissionErr,
  externalErr,
  timeoutErr,
  matchDomain,
  isDomainErrorType,
  getDomainErrorMessage,
  domainErrorToHttpStatus,
} from './utils/index.js';

// ============================================================================
// Quality
// ============================================================================

export {
  // Complexity Analyzer
  ComplexityAnalyzer,
  complexityAnalyzer,
  createComplexityAnalyzer,
  COMPLEXITY_THRESHOLDS,

  // Dead Code Detector
  DeadCodeDetector,
  deadCodeDetector,
  createDeadCodeDetector,

  // Technical Debt Tracker
  TechnicalDebtTracker,
  debtTracker,
  createDebtTracker,
  CATEGORY_INFO,

  // ESLint Rules
  eslintRules,
  eslintPlugin,

  // Combined Analysis
  analyzeQuality,
} from './quality/index.js';

export type {
  ComplexityMetrics,
  FileComplexityReport,
  FunctionComplexity,
  ComplexityViolation,
  DeadCodeReport,
  UnusedExport,
  UnreachableCode,
  RedundantPattern,
  TechnicalDebt,
  CreateDebtInput,
  DebtCategory,
  DebtPriority,
  DebtSummary,
  CombinedQualityReport,
} from './quality/index.js';

// ============================================================================
// Optimization
// ============================================================================

export {
  // Cache
  LRUCache,
  ExpressionCache,
  getExpressionCache,
  RedisCache,
  ScanCache,
  GraphTraversalCache,
  CacheFactory,
  memoize,
  memoizeAsync,

  // Batch Processing
  BatchProcessor,
  batchInsertUnnest,
  batchUpsertUnnest,
  bulkUpdateCaseWhen,
  parallelWithLimit,
  streamBatch,
  collectStream,
  createBatchInsertQuery,
  chunkArray,
  retryWithBackoff,

  // Algorithms
  tarjanSCC,
  findCyclesTarjan,
  topologicalSort,
  topologicalSortDFS,
  bfsShortestPath,
  findAllPaths,
  findReachableNodes,
  findNodesThatReach,
  calculateDensity,
  calculateAverageDegree,
  findArticulationPoints,
  buildReverseAdjacencyList,

  // Cached Graph Querier
  CachedGraphQuerier,
  createCachedGraphQuerier,

  // Performance Monitoring
  PerformanceTimer,
  getPerformanceTimer,
  getMemoryUsage,
  DEFAULT_PERFORMANCE_CONFIG,
  getPerformanceConfig,
} from './optimization/index.js';

export type {
  CacheOptions,
  CacheStats,
  BatchOptions,
  BatchResultStats,
  BatchProgressCallback,
  StronglyConnectedComponent,
  CycleInfo,
  TopologicalSortResult,
  ShortestPathResult,
  CachedQuerierOptions,
  PerformanceConfig,
} from './optimization/index.js';
