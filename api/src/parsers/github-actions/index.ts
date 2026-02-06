/**
 * GitHub Actions Parser Module
 *
 * Provides comprehensive parsing of GitHub Actions workflow files (.github/workflows/*.yml)
 * with detection of Terraform and Helm operations for cross-tool dependency tracking.
 *
 * @module parsers/github-actions
 *
 * TASK-XREF-001: GitHub Actions Parser
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Branded IDs
  GhaWorkflowId,
  GhaJobId,
  GhaStepId,
  GhaExpressionPath,

  // Core structures
  GhaWorkflow,
  GhaJob,
  GhaStep,
  GhaRunStep,
  GhaUsesStep,
  GhaStepBase,

  // Workflow configuration
  GhaDefaults,
  GhaRunDefaults,
  GhaShellType,
  GhaPermissions,
  GhaPermissionLevel,
  GhaConcurrency,

  // Job configuration
  GhaStrategy,
  GhaMatrix,
  GhaContainer,
  GhaContainerCredentials,
  GhaService,
  GhaEnvironment,

  // Triggers
  GhaTrigger,
  GhaTriggerType,
  GhaTriggerBase,
  GhaPushTrigger,
  GhaPullRequestTrigger,
  GhaPullRequestTargetTrigger,
  GhaPullRequestType,
  GhaWorkflowDispatchTrigger,
  GhaWorkflowInput,
  GhaInputType,
  GhaScheduleTrigger,
  GhaWorkflowCallTrigger,
  GhaWorkflowCallInput,
  GhaWorkflowCallOutput,
  GhaWorkflowCallSecret,
  GhaWorkflowRunTrigger,
  GhaRepositoryDispatchTrigger,
  GhaReleaseTrigger,
  GhaReleaseType,
  GhaIssueTrigger,
  GhaIssueType,
  GhaIssueCommentTrigger,
  GhaGenericTrigger,

  // Expressions
  GhaExpression,
  GhaExpressionType,
  GhaExpressionContext,
  GhaContextReference,
  GhaFunctionCall,

  // Graph nodes
  GhaWorkflowNode,
  GhaJobNode,
  GhaStepNode,

  // Graph edges
  GhaEdgeType,
  GhaEdge,
  GhaEdgeMetadata,

  // Tool info - Terraform
  TerraformStepInfo,
  TerraformCommand,
  TerraformBackendInfo,

  // Tool info - Helm
  HelmStepInfo,
  HelmCommand,

  // Tool info - Other
  KubernetesStepInfo,
  KubernetesCommand,
  AwsStepInfo,
  GcpStepInfo,
  AzureStepInfo,
  DockerStepInfo,
  DockerCommand,
  GhaToolStepInfo,
  GhaToolType,

  // Parse result
  GhaParseResult,
  GhaParseError,
  GhaParseErrorCode,
  GhaParseMetadata,

  // Parser options
  GhaParserOptions,
  GhaNodeFactoryOptions,
  GhaEdgeFactoryOptions,

  // Utility types
  ExtractGhaNode,
  GhaNodeTypeName,
  GhaResultType,
} from './types';

// ============================================================================
// Type Guards
// ============================================================================

export {
  // Step type guards
  isGhaRunStep,
  isGhaUsesStep,

  // Node type guards
  isGhaWorkflowNode,
  isGhaJobNode,
  isGhaStepNode,
  isGhaNode,

  // Trigger type guards
  isGhaPushTrigger,
  isGhaPullRequestTrigger,
  isGhaWorkflowDispatchTrigger,
  isGhaScheduleTrigger,
  isGhaWorkflowCallTrigger,

  // Edge type guards
  isGhaEdge,

  // Tool detection type guards
  isTerraformStepInfo,
  isHelmStepInfo,
  isKubernetesStepInfo,
  isAwsStepInfo,
  isGcpStepInfo,
  isAzureStepInfo,
  isDockerStepInfo,

  // Expression type guards
  isGhaExpression,
  isGhaContextReference,

  // Result type guards
  isGhaSuccess,
  isGhaFailure,
} from './types';

// ============================================================================
// Factory Functions (ID Creation)
// ============================================================================

export {
  createGhaWorkflowId,
  createGhaJobId,
  createGhaStepId,
  createGhaExpressionPath,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

export {
  createEmptyGhaParseResult,
  createGhaParseMetadata,
  getToolType,
} from './types';

// ============================================================================
// Constants
// ============================================================================

export {
  DEFAULT_GHA_PARSER_OPTIONS,
  TERRAFORM_ACTIONS,
  HELM_ACTIONS,
  TERRAFORM_COMMAND_PATTERNS,
  HELM_COMMAND_PATTERNS,
  KUBERNETES_ACTIONS,
  KUBERNETES_COMMAND_PATTERNS,
  AWS_ACTIONS,
  AWS_COMMAND_PATTERNS,
  GCP_ACTIONS,
  GCP_COMMAND_PATTERNS,
  AZURE_ACTIONS,
  AZURE_COMMAND_PATTERNS,
  DOCKER_ACTIONS,
  DOCKER_COMMAND_PATTERNS,
} from './types';

// ============================================================================
// Main Parser
// ============================================================================

export {
  GitHubActionsParser,
  createGitHubActionsParser,
  parseGitHubActionsWorkflow,
} from './gha-parser';

// ============================================================================
// Expression Parsing
// ============================================================================

export {
  GhaExpressionParser,
  createExpressionParser,
  extractExpressionsFromContent,
  hasExpressions,
  countExpressions,
} from './expression-parser';

// Re-export expression parser convenience alias
export { GhaExpressionParser as ExpressionParser } from './gha-parser';

// ============================================================================
// Tool Detection
// ============================================================================

export {
  GhaToolDetector,
  createToolDetector,
  mightContainTerraform,
  mightContainHelm,
  type ToolDetectorOptions,
} from './tool-detector';

// Re-export tool detector from gha-parser for backwards compatibility
export { GhaToolDetector as ToolDetector } from './gha-parser';

// ============================================================================
// Node Factory
// ============================================================================

export {
  GhaNodeFactory,
  createNodeFactory,
  createGhaNodes,
  createGhaWorkflowNode,
  createGhaJobNode,
  type WorkflowNodeCreationResult,
} from './node-factory';

// ============================================================================
// Output Flow Detection
// ============================================================================

export {
  OutputFlowDetector,
  createOutputFlowDetector,
  detectOutputFlows,
  summarizeFlows,
  hasInboundFlows,
  hasOutboundFlows,
  buildFlowGraph,
  type OutputFlow,
  type OutputFlowType,
  type OutputFlowEvidence,
  type OutputFlowDetectorOptions,
} from './output-flow-detector';

// ============================================================================
// Edge Factory
// ============================================================================

export {
  GhaEdgeFactory,
  createGhaEdges,
  createEdgeFactory,
  isGhaNeedsEdge,
  isGhaUsesTfEdge,
  isGhaUsesHelmEdge,
  isGhaOutputsToEdge,
  isGhaUsesActionEdge,
  isGhaSpecificEdge,
  type GhaNeedsEdge,
  type GhaUsesTfEdge,
  type GhaUsesHelmEdge,
  type GhaOutputsToEdge,
  type GhaUsesActionEdge,
  type GhaSpecificEdge,
  type GhaEdgeFactoryOptions as EdgeFactoryOptions,
  type GhaEdgeEvidence,
  type GhaBaseEdgeMetadata,
} from './edge-factory';

// ============================================================================
// Convenience Aliases
// ============================================================================

/**
 * Detect Terraform usage in workflow steps
 * @param steps - Steps to analyze
 * @param jobId - Parent job ID
 * @returns Array of detected Terraform step information
 */
export function detectTerraformUsage(
  steps: Parameters<InstanceType<typeof import('./tool-detector').GhaToolDetector>['detectTerraformSteps']>[0],
  jobId?: string
) {
  const detector = new (require('./tool-detector').GhaToolDetector)();
  return detector.detectTerraformSteps(steps, jobId);
}

/**
 * Detect Helm usage in workflow steps
 * @param steps - Steps to analyze
 * @param jobId - Parent job ID
 * @returns Array of detected Helm step information
 */
export function detectHelmUsage(
  steps: Parameters<InstanceType<typeof import('./tool-detector').GhaToolDetector>['detectHelmSteps']>[0],
  jobId?: string
) {
  const detector = new (require('./tool-detector').GhaToolDetector)();
  return detector.detectHelmSteps(steps, jobId);
}

/**
 * Extract expressions from workflow content
 * Convenience re-export from expression-parser
 */
export { extractExpressionsFromContent as extractExpressions } from './expression-parser';

/**
 * Categorize an expression by its type
 * @param body - Expression body (without ${{ }})
 * @returns Expression type classification
 */
export function categorizeExpression(body: string) {
  const parser = new (require('./expression-parser').GhaExpressionParser)();
  return parser.categorizeExpression(body);
}

/**
 * Extract context references from an expression
 * @param body - Expression body (without ${{ }})
 * @returns Array of context references
 */
export function extractContextReferences(body: string) {
  const parser = new (require('./expression-parser').GhaExpressionParser)();
  return parser.extractContextReferences(body);
}

// ============================================================================
// Default Export - Main Parser Factory
// ============================================================================

/**
 * Create a new GitHub Actions parser instance
 * Default export for convenient importing
 *
 * @returns New GitHubActionsParser instance
 *
 * @example
 * ```typescript
 * import createParser from '@parsers/github-actions';
 *
 * const parser = createParser();
 * const result = await parser.parse(content, filePath);
 * ```
 */
export default function createParser() {
  const { GitHubActionsParser } = require('./gha-parser');
  return new GitHubActionsParser();
}
