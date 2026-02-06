/**
 * Terragrunt Parser Module
 * @module parsers/terragrunt
 *
 * TASK-TG-001: Terragrunt HCL Parser exports
 *
 * Provides complete parsing support for Terragrunt configuration files:
 * - TerragruntParser: Main parser class extending BaseParser<TerragruntFile>
 * - TerragruntLexer: Tokenizer for Terragrunt HCL syntax
 * - TerragruntFunctionParser: Parser for 27 Terragrunt built-in functions
 * - IncludeResolver: Resolver for include and dependency paths
 *
 * Service Layer:
 * - TerragruntParserService: Factory functions, batch parsing, caching
 * - TerragruntHierarchyService: Configuration hierarchy resolution
 * - TerragruntValidationService: Block and file validation
 *
 * Node Factory:
 * - createTerragruntConfigNode: Single node creation from parsed file
 * - createTerragruntConfigNodes: Batch node creation
 * - createTerragruntConfigNodesWithRelationships: Batch with relationship hints
 *
 * Edge Factory (TASK-TG-008):
 * - createTgIncludesEdge: Include relationship edges
 * - createTgDependsOnEdge: Dependency relationship edges
 * - createTgPassesInputEdge: Input passing relationship edges
 * - createTgSourcesEdge: Terraform source relationship edges
 *
 * TF Linker (TASK-TG-008):
 * - createTerraformLinker: Factory for Terraform source linker
 * - parseSource: Parse raw source strings to structured expressions
 * - isExternalSource: Check if source is external (registry, git, etc.)
 * - createLinkerContext: Create context for source resolution
 *
 * Configuration:
 * - TerragruntParserConfig: Unified configuration interface
 * - createTerragruntConfig: Factory with defaults and overrides
 * - validateConfig: Configuration validation
 * - CONFIG_PRESETS: Pre-built configurations (default, strict, performance, safe)
 *
 * Logging (TASK-TG-028):
 * - createTerragruntLogger: Factory for namespaced loggers
 * - TerragruntParserLogger: Convenience class for file-scoped logging
 * - TerragruntBatchLogger: Convenience class for batch operation logging
 * - Parse/node/batch/resolution logging functions
 *
 * Usage:
 * ```typescript
 * import {
 *   TerragruntParser,
 *   parseTerragrunt,
 *   parseTerragruntFile,
 *   // Configuration
 *   createTerragruntConfig,
 *   validateConfig,
 *   getConfigPreset,
 *   // Service layer
 *   getParserService,
 *   parseDirectory,
 *   getMergedConfiguration,
 *   validateFile,
 *   // Node factory
 *   createTerragruntConfigNode,
 *   createTerragruntConfigNodes,
 * } from './parsers/terragrunt';
 *
 * // Create configuration with overrides
 * const config = createTerragruntConfig({
 *   maxIncludeDepth: 5,
 *   errorRecovery: false,
 * });
 *
 * // Or use a preset
 * const strictConfig = getConfigPreset('strict');
 *
 * // Validate configuration
 * const issues = validateConfig(config);
 * if (issues.length > 0) {
 *   console.error('Config issues:', issues);
 * }
 *
 * // Parse from string
 * const result = await parseTerragrunt(content, 'terragrunt.hcl');
 *
 * // Parse from file
 * const fileResult = await parseTerragruntFile('/path/to/terragrunt.hcl');
 *
 * // Batch parse directory
 * const batchResult = await parseDirectory('/path/to/project');
 *
 * // Get merged configuration from hierarchy
 * const merged = await getMergedConfiguration('/path/to/terragrunt.hcl');
 *
 * // Validate a parsed file
 * const validationResult = validateFile(parsedFile);
 *
 * // Create graph node from parsed file
 * const node = createTerragruntConfigNode(parsedFile, {
 *   scanId: 'scan-123',
 *   repositoryRoot: '/path/to/repo',
 * });
 *
 * // Batch create nodes with relationship hints
 * const { nodes, dependencyHints, includeHints } =
 *   createTerragruntConfigNodesWithRelationships(parsedFiles, options);
 *
 * // Create edges from relationship hints (TASK-TG-008)
 * import {
 *   createTgIncludesEdge,
 *   createTgDependsOnEdge,
 *   createEvidenceBuilder,
 * } from './parsers/terragrunt';
 *
 * const includeEdge = createTgIncludesEdge(
 *   {
 *     sourceNodeId: 'child-node-id',
 *     targetNodeId: 'parent-node-id',
 *     includeName: 'root',
 *     mergeStrategy: 'deep',
 *     inheritedBlocks: ['remote_state'],
 *     exposeAsVariable: true,
 *     evidence: [
 *       createEvidenceBuilder()
 *         .file('env/dev/terragrunt.hcl')
 *         .lines(1, 5)
 *         .confidence(95)
 *         .explicit()
 *         .description('Include block found')
 *         .build(),
 *     ],
 *   },
 *   { scanId: 'scan-123' }
 * );
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export {
  // Block types
  type TerragruntBlockType,
  type TerragruntBlockBase,
  type TerraformBlock,
  type RemoteStateBlock,
  type IncludeBlock,
  type LocalsBlock,
  type DependencyBlock,
  type DependenciesBlock,
  type GenerateBlock,
  type InputsBlock,
  type IamRoleBlock,
  type RetryConfigBlock,
  type SimpleConfigBlock,
  type TerragruntBlock,

  // Block component types
  type TerraformExtraArguments,
  type TerraformHook,
  type RemoteStateGenerate,

  // File and resolution types
  type TerragruntFile,
  type ResolvedInclude,
  type ResolvedDependency,
  type TerragruntParseError,
  type TerragruntParseErrorCode,

  // Function types
  type TerragruntFunctionCategory,
  type TerragruntFunctionReturnType,
  type TerragruntFunctionDef,

  // Options
  type TerragruntParserOptions,

  // Branded types
  type TerragruntFilePath,
  type IncludeLabel,
  type DependencyName,
  type GenerateLabel,

  // Utility types
  type ParseResultType,
  type TerragruntBlockVisitor,
  type ExtractBlock,
  type LabeledBlock,
  type ExpressionMapBlock,
  type ExecutionBlock,
  type ReferenceBlock,
  type BlockValidationResult,
  type FileValidationResult,
  type BlockValidator,

  // Metadata types
  type TerragruntNodeMetadata,

  // Constants
  TERRAGRUNT_FUNCTIONS,
  TERRAGRUNT_FUNCTION_NAMES,
  DEFAULT_TERRAGRUNT_PARSER_OPTIONS,

  // Type guards
  isTerraformBlock,
  isRemoteStateBlock,
  isIncludeBlock,
  isLocalsBlock,
  isDependencyBlock,
  isDependenciesBlock,
  isGenerateBlock,
  isInputsBlock,
  isIamRoleBlock,
  isRetryConfigBlock,
  isSimpleConfigBlock,
  isTerragruntFunction,
  getTerragruntFunctionDef,
  isParseSuccess,
  isParseFailure,

  // Branded type creators
  createTerragruntFilePath,
  createIncludeLabel,
  createDependencyName,
  createGenerateLabel,

  // Visitor utilities
  visitBlock,
  assertNeverBlock,
  getBlockType,
} from './types';

// ============================================================================
// Lexer Exports
// ============================================================================

export {
  // Lexer class
  TerragruntLexer,

  // Token types
  type TerragruntTokenType,
  type TerragruntToken,
  type LexerError,
  type LexerResult,

  // Utility functions
  filterTokensForParsing,
  extractStringContent,
  extractHeredocContent,
} from './tg-lexer';

// ============================================================================
// Function Parser Exports
// ============================================================================

export {
  // Parser class
  TerragruntFunctionParser,

  // Result types
  type FunctionParseResult,
  type TerragruntFunctionCall,

  // Utility functions
  containsTerragruntFunctions,
  getTerragruntFunctionCalls,
  validateFunctionCalls,
  createFunctionParser,
} from './function-parser';

// ============================================================================
// Include Resolver Exports
// ============================================================================

export {
  // Resolver class
  IncludeResolver,

  // Result types
  type ResolutionResult,
  type ResolutionOptions,
  type PathEvaluationContext,

  // Factory functions
  createIncludeResolver,
  resolveReferences,
} from './include-resolver';

// ============================================================================
// Main Parser Exports
// ============================================================================

export {
  // Parser class
  TerragruntParser,

  // Factory functions
  createTerragruntParser,
  parseTerragrunt,
  parseTerragruntFile,
} from './tg-parser';

// ============================================================================
// Metadata Extractor Exports
// ============================================================================

export {
  // Main extractor
  extractTerragruntMetadata,

  // Block-level extractors
  extractTerraformSource,
  extractRemoteStateInfo,
  countInputs,
  extractGenerateLabels,

  // Utility functions
  hasErrors,
  hasTerraformSource,
  hasRemoteState,
  hasDependencies,
  hasIncludes,
  getConfigurationSummary,
} from './metadata-extractor';

// ============================================================================
// Node Factory Exports
// ============================================================================

export {
  // Factory functions
  createTerragruntConfigNode,
  createTerragruntConfigNodes,
  createTerragruntConfigNodesWithRelationships,

  // Factory options
  type TerragruntNodeFactoryOptions,
  DEFAULT_FACTORY_OPTIONS,
  createFactoryOptions,
  validateFactoryOptions,

  // Result types
  type TerragruntNodeFactoryResult,
  type DependencyHint,
  type IncludeHint,

  // Helper functions
  deriveNodeName,
} from './node-factory';

// ============================================================================
// Edge Factory Exports (TASK-TG-008)
// ============================================================================

export {
  // Edge type constants
  TG_EDGE_TYPES,
  type TgEdgeType,
  TG_EDGE_TYPE_VALUES,

  // Factory options
  type TgEdgeFactoryOptions,
  DEFAULT_EDGE_FACTORY_OPTIONS,
  createEdgeFactoryOptions,
  validateEdgeFactoryOptions,

  // Evidence types
  type TgEdgeEvidence,

  // Edge option interfaces
  type TgIncludesEdgeOptions,
  type TgDependsOnEdgeOptions,
  type TgPassesInputEdgeOptions,
  type TgSourcesEdgeOptions,

  // Edge type interfaces
  type TgBaseEdge,
  type TgIncludesEdge,
  type TgDependsOnEdge,
  type TgPassesInputEdge,
  type TgSourcesEdge,
  type TgEdge,

  // Factory functions
  createTgIncludesEdge,
  createTgDependsOnEdge,
  createTgPassesInputEdge,
  createTgSourcesEdge,

  // Helper functions
  calculateAggregatedConfidence,
  validateEdgeOptions,

  // Type guards
  isTgIncludesEdge,
  isTgDependsOnEdge,
  isTgPassesInputEdge,
  isTgSourcesEdge,
  isTgEdge,

  // Batch factory types
  type TgEdgeFactoryResult,
  type TgEdgeFactoryError,
  type TgEdgeFactorySummary,

  // Evidence builder and utilities
  TgEvidenceBuilder,
  createEvidenceBuilder,
  createEvidence,
  validateTgEdgeEvidence,
  validateTgEdgeEvidenceArray,
} from './edge-factory';

// ============================================================================
// TF Linker Exports (TASK-TG-008)
// ============================================================================

export {
  // Core interface and class
  type ITerraformLinker,
  TerraformLinker,

  // Factory functions
  createTerraformLinker,
  parseSource,
  isExternalSource,
  detectSourceType,

  // Types
  type TerraformSourceType,
  type TerraformSourceExpression,
  type TfLinkerContext,
  type TfLinkerResult,
  type TfLinkerOptions,

  // Source patterns
  SOURCE_PATTERNS,

  // Context utilities
  createLinkerContext,
  buildModuleMap,

  // Type guards
  isLocalSource,
  isRegistrySource,
  isGitSource,
  isS3Source,
  isGcsSource,
  isHttpSource,
  isSuccessfulResolution,
  isSyntheticResolution,

  // Validation
  validateLinkerContext,
  validateLinkerOptions,
} from './tf-linker';

// ============================================================================
// Service Layer Exports
// ============================================================================

export {
  // Parser Service
  TerragruntParserService,
  type BatchParseOptions,
  type BatchParseFileResult,
  type BatchParseResult,
  type AggregatedError,
  type QuickParseResult,
  getParserService,
  parseFile,
  parseContent,
  parseDirectory,
  quickParse,
  batchParse,

  // Hierarchy Service
  TerragruntHierarchyService,
  type HierarchyNode,
  type MergedConfiguration,
  type MergeTrace,
  type DependencyNode,
  type DependencyGraph,
  type HierarchyOptions,
  createHierarchyService,
  buildHierarchy,
  getMergedConfiguration,
  buildDependencyGraph,
  getExecutionOrder,

  // Validation Service
  TerragruntValidationService,
  type ValidationSeverity,
  type ValidationIssue,
  type ValidationRule,
  type ValidationOptions,
  type ValidationResult,
  BUILTIN_RULES,
  createValidationService,
  validateFile,
  validateBlock,
  getValidationRules,
} from './services';

// ============================================================================
// Configuration Exports
// ============================================================================

export {
  // Configuration interface
  type TerragruntParserConfig,

  // Default configuration
  DEFAULT_TERRAGRUNT_CONFIG,

  // Factory functions
  createTerragruntConfig,
  createConfigFromEnv,

  // Validation
  type ConfigValidationIssue,
  validateConfig,
  isValidConfig,
  validateConfigOrThrow,
  ConfigValidationError,

  // Presets
  CONFIG_PRESETS,
  type ConfigPresetName,
  getConfigPreset,

  // Conversion utilities
  toParserOptions,
  toBatchParseOptions,

  // Edge Factory Configuration (TASK-TG-008)
  type TerragruntEdgeConfig,
  DEFAULT_TERRAGRUNT_EDGE_CONFIG,
  createTerragruntEdgeConfig,
  createEdgeConfigFromEnv,
  validateEdgeConfig,

  // TF Linker Configuration (TASK-TG-008)
  type TfLinkerConfig,
  DEFAULT_TF_LINKER_CONFIG,
  createTfLinkerConfig,
  createTfLinkerConfigFromEnv,
  validateTfLinkerConfig,
} from './config';

// ============================================================================
// Logger Exports
// ============================================================================

export {
  // Logger factory
  createTerragruntLogger,

  // Parse operation logging
  logParseStart,
  logParseComplete,
  logParseError,
  logParseWarning,
  logParseSkipped,

  // Node creation logging
  logNodeCreated,
  logNodeCreatedFull,
  logNodeCreationError,

  // Batch operation logging
  logBatchStart,
  logBatchProgress,
  logBatchComplete,

  // Include/dependency resolution logging
  logIncludeResolution,
  logIncludeResolved,
  logIncludeResolutionFailed,
  logDependencyResolution,
  logDependencyResolved,
  logDependencyResolutionFailed,

  // Performance logging
  logPerformanceMetric,
  startTiming,

  // Debug/diagnostic logging
  logLexerComplete,
  logBlockParsed,
  logFunctionDetected,

  // Cache logging
  logCacheHit,
  logCacheMiss,
  logCacheEviction,

  // Convenience classes
  TerragruntParserLogger,
  TerragruntBatchLogger,
} from './logger';

// ============================================================================
// Error Handling Exports
// ============================================================================

export {
  // Error severity enum
  TerragruntErrorSeverity,

  // Error codes
  TerragruntErrorCode,
  type TerragruntErrorCodeType,
  TerragruntErrorMessage,
  TerragruntErrorSeverityMap,
  TerragruntErrorSuggestion,
  TerragruntErrorRecoverable,
  type TerragruntErrorInfo,
  getTerragruntErrorInfo,
  isRecoverableError,

  // Error context types
  type TerragruntErrorContext,
  type SerializedTerragruntError,

  // Error classes (using TerragruntParse prefix to distinguish from existing type)
  TerragruntParseError as TerragruntError,
  LexerError as TerragruntLexerError,
  BlockParseError as TerragruntBlockError,
  IncludeResolutionError as TerragruntIncludeError,
  DependencyResolutionError as TerragruntDependencyError,
  FunctionParseError as TerragruntFunctionError,
  ValidationError as TerragruntValidationError,

  // Type guards for errors
  isTerragruntParseError,
  isLexerError as isTerragruntLexerError,
  isBlockParseError as isTerragruntBlockError,
  isIncludeResolutionError as isTerragruntIncludeError,
  isDependencyResolutionError as isTerragruntDependencyError,
  isFunctionParseError as isTerragruntFunctionError,
  isValidationError as isTerragruntValidationError,

  // Error utilities
  wrapError,
  createError,
  ErrorCollection,

  // Recovery options and types
  type RecoveryOptions,
  DEFAULT_RECOVERY_OPTIONS,
  type RecoveryState,
  type SourceRange,
  type RecoveryPoint,
  type RecoveryResult,
  type RecoveryMethod,
  createRecoveryState,

  // Recovery strategies
  LexerRecoveryStrategy,
  BlockRecoveryStrategy,
  IncludeRecoveryStrategy,
  DependencyRecoveryStrategy,
  ErrorRecoveryManager,
  createRecoveryManager,
  canContinueAfterError,

  // Error reporting
  type ReporterOptions,
  DEFAULT_REPORTER_OPTIONS,
  type ErrorSummary,
  type ErrorReport,
  type FormattedError,
  ErrorReporter,
  createReporter,
  formatErrors,
  formatError,
  printErrors,

  // Edge error classes (TASK-TG-008)
  TerragruntEdgeError,
  SourceResolutionError,
  BatchEdgeError,

  // Edge error type guards
  isTerragruntEdgeError,
  isSourceResolutionError,
  isBatchEdgeError,

  // Edge error utilities
  wrapEdgeError,
  wrapSourceError,
  canContinueAfterEdgeError,

  // Edge error context types
  type EdgeErrorContext,
  type SourceErrorContext,
  type BatchEdgeErrorContext,
  type EdgeErrorSummary,
  type EdgeRecoveryResult,
  attemptEdgeRecovery,
} from './errors';

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default singleton instance of TerragruntParser
 */
import { TerragruntParser } from './tg-parser';
export const terragruntParser = new TerragruntParser();
