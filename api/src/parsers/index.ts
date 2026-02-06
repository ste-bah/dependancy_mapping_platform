/**
 * Parsers Module Exports
 * @module parsers
 *
 * Central exports for all parser infrastructure and implementations.
 * TASK-DETECT-001: Parser infrastructure for IaC dependency detection
 */

// Base parser infrastructure
export {
  // Types
  type ParseResult,
  type ParseSuccess,
  type ParseFailure,
  type ParseError,
  type ParseDiagnostic,
  type ParseMetadata,
  type ParseErrorCode,
  type IParser,
  type ParserOptions,
  type ParserCapability,
  type IaCFormat,

  // Classes
  BaseParser,

  // Constants
  DEFAULT_PARSER_OPTIONS,

  // Type Guards
  isParseSuccess,
  isParseFailure,
} from './base';

// Parser registry
export {
  ParserRegistry,
  parserRegistry,
  DEFAULT_REGISTRY_OPTIONS,
  type ParserFactory,
  type RegisteredParser,
  type ParserSelectionCriteria,
  type RegistryOptions,
} from './registry';

// Terraform parser types
export {
  type TerraformFile,
  type TerraformBlock,
  type TerraformBlockType,
  type SourceLocation,
  type HCLExpression,
  type HCLLiteralExpression,
  type HCLReferenceExpression,
  type HCLFunctionExpression,
  type HCLTemplateExpression,
  type HCLForExpression,
  type HCLConditionalExpression,
  type HCLIndexExpression,
  type HCLSplatExpression,
  type HCLObjectExpression,
  type HCLArrayExpression,
  type TerraformResourceNode,
  type TerraformVariableNode,
  type TerraformOutputNode,
  type TerraformLocalNode,
  type TerraformProviderNode,
  type LifecycleBlock,
  type ValidationBlock,
  DEFAULT_PARSER_OPTIONS as DEFAULT_TERRAFORM_PARSER_OPTIONS,
} from './terraform/types';

// Module detector
export {
  type ModuleSource,
  type LocalModuleSource,
  type RegistryModuleSource,
  type GitHubModuleSource,
  type GitModuleSource,
  type S3ModuleSource,
  type GCSModuleSource,
  type UnknownModuleSource,
  type ModuleNode,
  type VersionConstraint,
  ModuleDetector,
  moduleDetector,
  parseModuleSource,
  parseVersionConstraint,
} from './terraform/module-detector';

// Helm parser types (TASK-DETECT-006, 007, 008)
export {
  // Branded types
  type HelmChartId,
  type HelmReleaseId,
  type HelmValuesPath,

  // Chart metadata types
  type ChartApiVersion,
  type ChartType,
  type ChartMaintainer,
  type ChartDependency,
  type ChartValueImport,
  type ChartMetadata,

  // Values types
  type ValuesReference,
  type HelmValueType,
  type HelmValuesFile,

  // Template types
  type HelmTemplateFile,
  type HelmTemplateCall,
  type HelmInclude,

  // K8s resource extraction types (TASK-DETECT-008)
  type K8sResourceExtraction,
  type K8sResourceKind,
  type TemplateExpression,
  type TemplateExpressionType,
  type K8sSpecAnalysis,
  type ContainerImageRef,
  type ConfigMapRef,
  type SecretRef,
  type VolumeMountRef,
  type PortRef,
  type ResourceRequirements,

  // Node types
  type HelmChartNodeData,
  type HelmReleaseNodeData,
  type HelmValuesNodeData,

  // Helmfile types
  type HelmfileRelease,
  type HelmfileSetValue,
  type HelmfileRepository,
  type HelmfileSpec,
  type HelmfileEnvironment,
  type HelmfileDefaults,

  // Parse result types
  type HelmParseError,
  type HelmParseErrorCode,
  type HelmChartParseResult,
  type HelmfileParseResult,

  // Parser options
  type HelmParserOptions,
  DEFAULT_HELM_PARSER_OPTIONS,

  // Type guards
  isHelmChartNode,
  isHelmReleaseNode,
  isHelmValuesNode,
  isK8sResourceExtraction,

  // Factory functions
  createHelmChartId,
  createHelmReleaseId,
  createHelmValuesPath,
  createEmptyChartMetadata,

  // Chart Parser (TASK-DETECT-006)
  HelmChartParser,
  HelmRequirementsParser,
  type ChartParseResult,
  type ChartParseInput,
  createChartParser,
  createRequirementsParser,
  parseChartYaml,
  buildChartNode,

  // Values Parser (TASK-DETECT-008)
  HelmValuesParser,
  type ValuesParseResult,
  type ExternalReference,
  type ExternalRefType,
  type ExternalRefMetadata,
  type ValueOverride,
  createValuesParser,
  parseValuesYaml,
  buildValuesFile,
  detectValueOverrides,

  // Template Analyzer (TASK-DETECT-007)
  HelmTemplateAnalyzer,
  type TemplateAnalysisResult,
  type DefinedTemplate,
  createTemplateAnalyzer,
  analyzeTemplate,
  extractHelpers,
} from './helm/index.js';

// Helmfile parser types (TASK-XREF-004)
export {
  // Branded types
  type HelmfileId,
  type HelmfileReleaseId,

  // Core types
  type HelmDefaults,
  type SetValue as HelmfileSetValue,
  type HelmfileRelease as HelmfileReleaseType,
  type HelmfileHook,
  type HelmfileEnvironment as HelmfileEnvType,
  type HelmRepository,
  type Helmfile,

  // Graph node types
  type HelmfileReleaseNode,
  type HelmfileDependsOnEdge,

  // Error types
  type HelmfileParseErrorCode,
  type HelmfileParseError,

  // Parse result types
  type HelmfileParseResult as HelmfileParseResultType,
  type HelmfileParseMetadata,

  // Parser options
  type HelmfileParserOptions,
  DEFAULT_HELMFILE_PARSER_OPTIONS,

  // Parser class
  HelmfileParser,

  // Factory functions
  createHelmfileParser,
  parseHelmfileAsync,
  parseHelmfileSync,
  createHelmfileGraph,
  createHelmfileId,
  createHelmfileReleaseId,

  // ID generation helpers
  generateNodeId as generateHelmfileNodeId,
  generateEdgeId as generateHelmfileEdgeId,
  resetIdCounters as resetHelmfileIdCounters,

  // Need reference parsing
  type ParsedNeedReference,
  parseNeedReference,
  formatNeedReference,

  // Type guards
  isHelmfileReleaseNode,
  isHelmfileDependsOnEdge,
} from './helmfile/index.js';

// Terragrunt parser types (TASK-TG-001)
export {
  // Block types
  type TerragruntBlockType,
  type TerragruntBlockBase,
  type TerraformBlock as TerragruntTerraformBlock,
  type RemoteStateBlock,
  type IncludeBlock,
  type LocalsBlock as TerragruntLocalsBlock,
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
  type TerragruntFunctionDef,

  // Options
  type TerragruntParserOptions,

  // Constants
  TERRAGRUNT_FUNCTIONS,
  TERRAGRUNT_FUNCTION_NAMES,
  DEFAULT_TERRAGRUNT_PARSER_OPTIONS,

  // Type guards
  isTerraformBlock as isTerragruntTerraformBlock,
  isRemoteStateBlock,
  isIncludeBlock,
  isLocalsBlock as isTerragruntLocalsBlock,
  isDependencyBlock,
  isDependenciesBlock,
  isGenerateBlock,
  isInputsBlock,
  isIamRoleBlock,
  isRetryConfigBlock,
  isTerragruntFunction,
  getTerragruntFunctionDef,

  // Lexer
  TerragruntLexer,
  type TerragruntTokenType,
  type TerragruntToken,
  type LexerError,
  type LexerResult,
  filterTokensForParsing,
  extractStringContent,
  extractHeredocContent,

  // Function Parser
  TerragruntFunctionParser,
  type FunctionParseResult,
  type TerragruntFunctionCall,
  containsTerragruntFunctions,
  getTerragruntFunctionCalls,
  validateFunctionCalls,
  createFunctionParser,

  // Include Resolver
  IncludeResolver,
  type ResolutionResult,
  type ResolutionOptions,
  type PathEvaluationContext,
  createIncludeResolver,
  resolveReferences,

  // Main Parser
  TerragruntParser,
  createTerragruntParser,
  parseTerragrunt,
  parseTerragruntFile,
  terragruntParser,
} from './terragrunt/index.js';

// ArgoCD parser types (TASK-XREF-005)
export {
  // Branded types
  type ArgoCDApplicationId,
  type ArgoCDApplicationSetId,

  // Core types
  type ArgoCDApplication,
  type ArgoCDApplicationSet,
  type ApplicationSource,
  type ApplicationSourceType,
  type ApplicationDestination,
  type SyncPolicy,
  type AutomatedSyncPolicy,
  type RetryPolicy,
  type HelmSource,
  type HelmParameter,
  type HelmFileParameter,
  type KustomizeSource,
  type KustomizeReplica,
  type DirectorySource,
  type PluginSource,
  type ResourceIgnoreDifferences,

  // ApplicationSet types
  type ApplicationSetGenerator,
  type ApplicationSetGeneratorType,
  type ApplicationTemplate,
  type ApplicationTemplateMetadata,
  type ApplicationTemplateSpec,
  type ApplicationSetSyncPolicy,
  type ApplicationSetStrategy,
  type GeneratorSelector,

  // Graph node types
  type ArgoCDApplicationNode,
  type ArgoCDApplicationSetNode,
  type ArgoCDApplicationNodeMetadata,
  type ArgoCDApplicationSetNodeMetadata,

  // Graph edge types
  type ArgoCDDeploysEdge,
  type ArgoCDGeneratesEdge,
  type ArgoCDDeploysEdgeMetadata,
  type ArgoCDGeneratesEdgeMetadata,

  // Parse result types
  type ArgoCDParseResult,
  type ArgoCDParseMetadata,
  type ArgoCDParseError,
  type ArgoCDParseErrorCode,

  // Parser options
  type ArgoCDParserOptions,
  DEFAULT_ARGOCD_PARSER_OPTIONS,

  // Type guards
  isArgoCDApplication,
  isArgoCDApplicationSet,
  isArgoCDApplicationNode,
  isArgoCDApplicationSetNode,
  isArgoCDDeploysEdge,
  isArgoCDGeneratesEdge,
  hasHelmSource,
  hasKustomizeSource,

  // Factory functions
  createArgoCDApplicationId,
  createArgoCDApplicationSetId,
  createEmptyArgoCDParseResult,

  // Constants
  ARGOCD_API_VERSIONS,
  ARGOCD_KINDS,
  ARGOCD_ANNOTATIONS,
  SYNC_OPTIONS,

  // Parser class
  ArgoCDApplicationParser,

  // Parser factory and helpers
  createArgoCDParser,
  parseArgoCDManifest,
  createArgoCDGraph,
} from './argocd/index.js';
