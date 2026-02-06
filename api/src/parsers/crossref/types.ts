/**
 * TF-Helm Cross-Reference Detection Types
 * @module parsers/crossref/types
 *
 * Type definitions for Terraform-to-Helm data flow detection in CI/CD workflows.
 * Implements cross-reference analysis between Terraform outputs and Helm values.
 *
 * TASK-XREF-003: TF-Helm Cross-Reference Detection - Core type definitions
 */

import { SourceLocation } from '../terraform/types';
import { NodeLocation, EdgeMetadata } from '../../types/graph';

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Brand utility type for creating nominal types from primitives
 */
type Brand<T, B> = T & { readonly __brand: B };

/**
 * Branded type for TF-Helm flow IDs
 * @example
 * const flowId = 'tf-helm-flow-vpc-to-chart' as TfHelmFlowId;
 */
export type TfHelmFlowId = Brand<string, 'TfHelmFlowId'>;

/**
 * Branded type for Terraform output names
 */
export type TerraformOutputName = Brand<string, 'TerraformOutputName'>;

/**
 * Branded type for Helm value paths
 */
export type HelmValuePath = Brand<string, 'HelmValuePath'>;

// ============================================================================
// Flow Pattern Types
// ============================================================================

/**
 * Classification of TF-Helm flow patterns
 */
export type TfHelmFlowPattern =
  | 'direct_output'        // Terraform output directly used in Helm --set
  | 'output_to_env'        // TF output -> env var -> Helm
  | 'output_to_file'       // TF output -> values file -> Helm
  | 'output_to_secret'     // TF output -> K8s secret -> Helm
  | 'job_chain'            // TF job outputs -> needs -> Helm job
  | 'artifact_transfer'    // TF output in artifact -> Helm consumes
  | 'matrix_propagation'   // TF outputs propagated through matrix
  | 'inferred';            // Pattern inferred from naming/proximity

/**
 * Confidence levels for flow detection
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ============================================================================
// Core Flow Types
// ============================================================================

/**
 * Complete Terraform-to-Helm data flow representation
 */
export interface TerraformToHelmFlow {
  /** Unique flow identifier */
  readonly id: TfHelmFlowId;
  /** Source Terraform output information */
  readonly source: TerraformOutputInfo;
  /** Target Helm value information */
  readonly target: HelmValueSource;
  /** Detected flow pattern */
  readonly pattern: TfHelmFlowPattern;
  /** Confidence score (0-100) */
  readonly confidence: number;
  /** Confidence level classification */
  readonly confidenceLevel: ConfidenceLevel;
  /** Evidence supporting this flow detection */
  readonly evidence: readonly FlowEvidence[];
  /** Workflow context where flow was detected */
  readonly workflowContext: WorkflowFlowContext;
}

/**
 * Information about a Terraform output that produces data
 */
export interface TerraformOutputInfo {
  /** Output name */
  readonly name: TerraformOutputName;
  /** Job ID where output is produced */
  readonly jobId: string;
  /** Step ID within the job */
  readonly stepId?: string;
  /** Step index within the job */
  readonly stepIndex: number;
  /** Terraform command that produces this output */
  readonly command: TerraformOutputCommand;
  /** Working directory for Terraform */
  readonly workingDir?: string;
  /** Whether output is marked sensitive */
  readonly sensitive: boolean;
  /** Output type if detectable */
  readonly outputType?: string;
  /** Source location in workflow file */
  readonly location: SourceLocation;
}

/**
 * Terraform commands that can produce outputs
 */
export type TerraformOutputCommand =
  | 'output'
  | 'apply'
  | 'plan'
  | 'show';

/**
 * Information about a Helm value that consumes data
 */
export interface HelmValueSource {
  /** Value path in Helm (e.g., "image.tag") */
  readonly path: HelmValuePath;
  /** Job ID where value is consumed */
  readonly jobId: string;
  /** Step ID within the job */
  readonly stepId?: string;
  /** Step index within the job */
  readonly stepIndex: number;
  /** Helm command being executed */
  readonly command: HelmValueCommand;
  /** How the value is provided */
  readonly sourceType: HelmValueSourceType;
  /** Release name */
  readonly releaseName?: string;
  /** Chart reference */
  readonly chart?: string;
  /** Namespace */
  readonly namespace?: string;
  /** Source location in workflow file */
  readonly location: SourceLocation;
}

/**
 * Helm commands that can consume values
 */
export type HelmValueCommand =
  | 'install'
  | 'upgrade'
  | 'template'
  | 'lint';

/**
 * How Helm receives the value
 */
export type HelmValueSourceType =
  | 'set_flag'            // --set key=value
  | 'set_string'          // --set-string key=value
  | 'set_file'            // --set-file key=path
  | 'values_file'         // -f values.yaml
  | 'env_substitution'    // envsubst in values file
  | 'expression';         // GHA expression in values

// ============================================================================
// Evidence Types
// ============================================================================

/**
 * Evidence supporting a flow detection
 */
export interface FlowEvidence {
  /** Type of evidence */
  readonly type: FlowEvidenceType;
  /** Description of the evidence */
  readonly description: string;
  /** Strength of this evidence (0-100) */
  readonly strength: number;
  /** Source location where evidence was found */
  readonly location?: SourceLocation;
  /** Raw text snippet showing the evidence */
  readonly snippet?: string;
}

/**
 * Types of evidence for flow detection
 */
export type FlowEvidenceType =
  | 'explicit_reference'    // Direct ${{ needs.job.outputs.name }} reference
  | 'expression_match'      // Expression parsing matched output to input
  | 'env_variable'          // Environment variable propagation
  | 'artifact_path'         // Artifact download/upload paths match
  | 'naming_convention'     // Names follow a recognizable pattern
  | 'job_dependency'        // Job needs: dependency establishes order
  | 'step_proximity'        // TF and Helm steps are adjacent/nearby
  | 'semantic_match'        // Semantic analysis suggests connection
  | 'file_path_match';      // File paths indicate shared state

// ============================================================================
// Context Types
// ============================================================================

/**
 * Workflow context for a detected flow
 */
export interface WorkflowFlowContext {
  /** Workflow file path */
  readonly workflowFile: string;
  /** Workflow name */
  readonly workflowName: string;
  /** Job chain from TF to Helm */
  readonly jobChain: readonly string[];
  /** Whether jobs are in same workflow */
  readonly sameWorkflow: boolean;
  /** Trigger type that starts the workflow */
  readonly triggerType?: string;
}

/**
 * Detection context passed to pattern detectors
 */
export interface TfHelmDetectionContext {
  /** Parsed workflow (type-agnostic for flexibility) */
  readonly workflow: unknown;
  /** All jobs in the workflow indexed by ID */
  readonly jobs: ReadonlyMap<string, unknown>;
  /** Terraform steps found in workflow */
  readonly terraformSteps: readonly TerraformStepContext[];
  /** Helm steps found in workflow */
  readonly helmSteps: readonly HelmStepContext[];
  /** Job dependency graph */
  readonly jobDependencies: ReadonlyMap<string, readonly string[]>;
  /** Workflow file path */
  readonly workflowFile: string;
}

/**
 * Context for a Terraform step
 */
export interface TerraformStepContext {
  readonly jobId: string;
  readonly stepIndex: number;
  readonly stepId?: string;
  readonly command: string;
  readonly outputs: readonly string[];
  readonly workingDir?: string;
  readonly envVars: Readonly<Record<string, string>>;
}

/**
 * Context for a Helm step
 */
export interface HelmStepContext {
  readonly jobId: string;
  readonly stepIndex: number;
  readonly stepId?: string;
  readonly command: string;
  readonly setValues: ReadonlyMap<string, string>;
  readonly valuesFiles: readonly string[];
  readonly releaseName?: string;
  readonly chart?: string;
}

// ============================================================================
// Detection Result Types
// ============================================================================

/**
 * Complete detection result
 */
export interface TfHelmDetectionResult {
  /** All detected flows */
  readonly flows: readonly TerraformToHelmFlow[];
  /** Detection summary */
  readonly summary: DetectionSummary;
  /** Detection metadata */
  readonly metadata: DetectionMetadata;
  /** Any errors during detection */
  readonly errors: readonly DetectionError[];
  /** Warnings during detection */
  readonly warnings: readonly DetectionWarning[];
}

/**
 * Summary of detection results
 */
export interface DetectionSummary {
  /** Total flows detected */
  readonly totalFlows: number;
  /** Flows by pattern */
  readonly flowsByPattern: Readonly<Record<TfHelmFlowPattern, number>>;
  /** Flows by confidence level */
  readonly flowsByConfidence: Readonly<Record<ConfidenceLevel, number>>;
  /** Average confidence score */
  readonly averageConfidence: number;
  /** Number of TF jobs involved */
  readonly terraformJobCount: number;
  /** Number of Helm jobs involved */
  readonly helmJobCount: number;
}

/**
 * Detection metadata
 */
export interface DetectionMetadata {
  /** Detection timestamp */
  readonly detectedAt: Date;
  /** Detection duration in milliseconds */
  readonly durationMs: number;
  /** Detector version */
  readonly detectorVersion: string;
  /** Options used for detection */
  readonly options: TfHelmDetectorOptions;
}

/**
 * Detection error
 */
export interface DetectionError {
  readonly code: string;
  readonly message: string;
  readonly location?: SourceLocation;
  readonly recoverable: boolean;
}

/**
 * Detection warning
 */
export interface DetectionWarning {
  readonly code: string;
  readonly message: string;
  readonly location?: SourceLocation;
}

// ============================================================================
// Detector Options
// ============================================================================

/**
 * Options for TF-Helm flow detection
 */
export interface TfHelmDetectorOptions {
  /** Minimum confidence threshold (0-100) */
  readonly minConfidence?: number;
  /** Enable pattern-specific detection */
  readonly patterns?: {
    readonly directOutput?: boolean;
    readonly outputToEnv?: boolean;
    readonly outputToFile?: boolean;
    readonly outputToSecret?: boolean;
    readonly jobChain?: boolean;
    readonly artifactTransfer?: boolean;
    readonly matrixPropagation?: boolean;
    readonly inferred?: boolean;
  };
  /** Include low-confidence inferred flows */
  readonly includeInferred?: boolean;
  /** Maximum flows to return */
  readonly maxFlows?: number;
  /** Enable debug logging */
  readonly debug?: boolean;
}

/**
 * Default detector options
 */
export const DEFAULT_TF_HELM_DETECTOR_OPTIONS: Required<TfHelmDetectorOptions> = {
  minConfidence: 50,
  patterns: {
    directOutput: true,
    outputToEnv: true,
    outputToFile: true,
    outputToSecret: true,
    jobChain: true,
    artifactTransfer: true,
    matrixPropagation: true,
    inferred: true,
  },
  includeInferred: true,
  maxFlows: 100,
  debug: false,
};

// ============================================================================
// Scoring Types
// ============================================================================

/**
 * Partial flow before scoring
 */
export interface PartialFlow {
  readonly source: TerraformOutputInfo;
  readonly target: HelmValueSource;
  readonly pattern: TfHelmFlowPattern;
  readonly evidence: readonly FlowEvidence[];
  readonly workflowContext: WorkflowFlowContext;
}

/**
 * Flow with computed confidence score
 */
export interface ScoredFlow extends PartialFlow {
  readonly confidence: number;
  readonly confidenceLevel: ConfidenceLevel;
  readonly scoreBreakdown: ScoreBreakdown;
}

/**
 * Breakdown of confidence score components
 */
export interface ScoreBreakdown {
  /** Base score from pattern type */
  readonly patternBase: number;
  /** Score from evidence strength */
  readonly evidenceScore: number;
  /** Bonus from explicit references */
  readonly explicitBonus: number;
  /** Penalty for weak evidence */
  readonly weaknessPenalty: number;
  /** Final computed score */
  readonly total: number;
}

// ============================================================================
// Variable Origin Types
// ============================================================================

/**
 * Traced origin of a variable value
 */
export interface VariableOrigin {
  /** Type of origin */
  readonly type: VariableOriginType;
  /** Source identifier */
  readonly source: string;
  /** Confidence in this trace */
  readonly confidence: number;
  /** Chain of transformations */
  readonly transformations: readonly VariableTransformation[];
}

/**
 * Types of variable origins
 */
export type VariableOriginType =
  | 'terraform_output'
  | 'job_output'
  | 'step_output'
  | 'env_variable'
  | 'secret'
  | 'input'
  | 'artifact'
  | 'unknown';

/**
 * Transformation applied to a variable
 */
export interface VariableTransformation {
  readonly type: 'expression' | 'env_expansion' | 'file_read' | 'json_parse';
  readonly description: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TerraformToHelmFlow
 */
export function isTerraformToHelmFlow(value: unknown): value is TerraformToHelmFlow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'source' in value &&
    'target' in value &&
    'pattern' in value &&
    'confidence' in value
  );
}

/**
 * Type guard for high confidence flows
 */
export function isHighConfidenceFlow(flow: TerraformToHelmFlow): boolean {
  return flow.confidence >= 80;
}

/**
 * Type guard for medium confidence flows
 */
export function isMediumConfidenceFlow(flow: TerraformToHelmFlow): boolean {
  return flow.confidence >= 50 && flow.confidence < 80;
}

/**
 * Type guard for low confidence flows
 */
export function isLowConfidenceFlow(flow: TerraformToHelmFlow): boolean {
  return flow.confidence < 50;
}

/**
 * Type guard for direct output pattern
 */
export function isDirectOutputPattern(flow: TerraformToHelmFlow): boolean {
  return flow.pattern === 'direct_output';
}

/**
 * Type guard for job chain pattern
 */
export function isJobChainPattern(flow: TerraformToHelmFlow): boolean {
  return flow.pattern === 'job_chain';
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a TfHelmFlowId from components
 */
export function createTfHelmFlowId(
  sourceJob: string,
  targetJob: string,
  outputName: string
): TfHelmFlowId {
  return `tf-helm-${sourceJob}-${targetJob}-${outputName}` as TfHelmFlowId;
}

/**
 * Create a TerraformOutputName
 */
export function createTerraformOutputName(name: string): TerraformOutputName {
  return name as TerraformOutputName;
}

/**
 * Create a HelmValuePath
 */
export function createHelmValuePath(path: string): HelmValuePath {
  return path as HelmValuePath;
}

/**
 * Determine confidence level from score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * Create an empty detection result
 */
export function createEmptyDetectionResult(
  workflowFile: string,
  options: TfHelmDetectorOptions
): TfHelmDetectionResult {
  return {
    flows: [],
    summary: {
      totalFlows: 0,
      flowsByPattern: {
        direct_output: 0,
        output_to_env: 0,
        output_to_file: 0,
        output_to_secret: 0,
        job_chain: 0,
        artifact_transfer: 0,
        matrix_propagation: 0,
        inferred: 0,
      },
      flowsByConfidence: {
        high: 0,
        medium: 0,
        low: 0,
      },
      averageConfidence: 0,
      terraformJobCount: 0,
      helmJobCount: 0,
    },
    metadata: {
      detectedAt: new Date(),
      durationMs: 0,
      detectorVersion: '1.0.0',
      options,
    },
    errors: [],
    warnings: [],
  };
}

// ============================================================================
// Additional Interface Types (TASK-XREF-003 Requirements)
// ============================================================================

/**
 * Reference to a Terraform output in the flow
 * Extended version with additional metadata
 */
export interface TerraformOutputRef {
  /** Output name */
  readonly name: TerraformOutputName;

  /** Output type classification */
  readonly type: TerraformOutputType;

  /** File path containing the output */
  readonly filePath: string;

  /** Module path for the Terraform configuration */
  readonly modulePath: string;

  /** Job ID where output is produced */
  readonly jobId: string;

  /** Step ID within the job */
  readonly stepId?: string;

  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Terraform output type classification
 */
export type TerraformOutputType =
  | 'string'    // -raw flag
  | 'json'      // -json flag
  | 'unknown';

/**
 * Reference to a Helm input in the flow
 */
export interface HelmInputRef {
  /** Value path in Helm */
  readonly valuePath: HelmValuePath;

  /** Chart path */
  readonly chartPath: string;

  /** Input method */
  readonly inputMethod: HelmInputMethod;

  /** Job ID */
  readonly jobId: string;

  /** Step ID */
  readonly stepId?: string;

  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Helm input method classification
 */
export type HelmInputMethod =
  | 'set'
  | 'set_string'
  | 'set_file'
  | 'values_file'
  | 'env_var';

/**
 * Pipeline context for flow detection
 */
export interface PipelineContext {
  /** Pipeline type */
  readonly type: PipelineType;

  /** File path */
  readonly filePath: string;

  /** Source job ID */
  readonly sourceJob?: string;

  /** Target job ID */
  readonly targetJob?: string;
}

/**
 * Pipeline type classification
 */
export type PipelineType =
  | 'github_actions'
  | 'gitlab_ci'
  | 'direct';

/**
 * Value transformation between source and target
 */
export interface ValueTransformation {
  /** Transformation type */
  readonly type: TransformationType;

  /** Transformation expression */
  readonly expression?: string;
}

/**
 * Transformation type classification
 */
export type TransformationType =
  | 'jq'
  | 'envsubst'
  | 'direct'
  | 'sed'
  | 'awk'
  | 'shell';

/**
 * Confidence score for flow detection
 */
export interface ConfidenceScore {
  /** Numeric value (0-100) */
  readonly value: number;

  /** Level classification */
  readonly level: ConfidenceLevel;

  /** Factors contributing to score */
  readonly factors: readonly string[];
}

/**
 * Evidence pointer for flow detection
 */
export interface EvidencePointer {
  /** Evidence type */
  readonly type: TfHelmEvidenceType;

  /** Source location */
  readonly location: SourceLocation;

  /** Code snippet */
  readonly snippet: string;

  /** Evidence weight (0-1) */
  readonly weight: number;
}

/**
 * Evidence types for TF-Helm flow detection
 */
export type TfHelmEvidenceType =
  | 'terraform_output_command'
  | 'helm_set_value'
  | 'env_variable_assignment'
  | 'json_file_write'
  | 'artifact_upload'
  | 'artifact_download'
  | 'job_dependency';

// ============================================================================
// Analyzer Interfaces (Dependency Injection Support)
// ============================================================================

/**
 * Interface for flow analysis operations
 */
export interface IFlowAnalyzer {
  /**
   * Trace a variable back to its origin
   */
  traceVariable(name: string, scope: string): VariableOrigin[];

  /**
   * Analyze a terraform command for output extraction
   */
  analyzeTerraformCommand(cmd: string): TerraformCommandAnalysis | null;

  /**
   * Analyze helm set values for TF references
   */
  analyzeHelmSetValues(step: unknown): HelmValueAnalysis[];
}

/**
 * Result of terraform command analysis
 */
export interface TerraformCommandAnalysis {
  /** Output name */
  readonly name: string;

  /** Whether output is JSON format */
  readonly isJson: boolean;

  /** Whether output is raw format */
  readonly isRaw: boolean;

  /** Full command string */
  readonly command: string;
}

/**
 * Result of helm value analysis
 */
export interface HelmValueAnalysis {
  /** Value path */
  readonly path: string;

  /** Expression */
  readonly expression: string;

  /** Whether uses TF output */
  readonly usesTerraformOutput: boolean;
}

/**
 * Interface for confidence scoring
 */
export interface IConfidenceScorer {
  /**
   * Score a detected flow
   */
  scoreFlow(flow: PartialFlow): ScoredFlow;

  /**
   * Get detailed score breakdown
   */
  getBreakdown(flow: PartialFlow): ScoreBreakdown;
}

/**
 * Interface for pattern-specific detectors
 */
export interface IPatternDetector {
  /** Pattern this detector handles */
  readonly pattern: TfHelmFlowPattern;

  /** Base confidence for this pattern */
  readonly baseConfidence: number;

  /**
   * Detect flows matching this pattern
   */
  detect(context: TfHelmDetectionContext): TerraformToHelmFlow[];
}

// ============================================================================
// Job Info Types (For Detection Context)
// ============================================================================

/**
 * Information about a Terraform job
 */
export interface TfJobInfo {
  /** Job ID */
  readonly jobId: string;

  /** Steps in the job */
  readonly steps: readonly unknown[];

  /** Outputs from this job */
  readonly outputs: ReadonlyMap<string, string>;
}

/**
 * Information about a Helm job
 */
export interface HelmJobInfo {
  /** Job ID */
  readonly jobId: string;

  /** Steps in the job */
  readonly steps: readonly unknown[];

  /** Dependencies (needs) */
  readonly needs: readonly string[];
}

// ============================================================================
// Detection Statistics
// ============================================================================

/**
 * Statistics from detection run
 */
export interface DetectionStatistics {
  /** Total flows detected */
  readonly totalFlows: number;

  /** Flows by pattern */
  readonly byPattern: Record<TfHelmFlowPattern, number>;

  /** Average confidence */
  readonly averageConfidence: number;

  /** High confidence count */
  readonly highConfidenceCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Pattern base confidence scores
 */
export const PATTERN_BASE_SCORES: Readonly<Record<TfHelmFlowPattern, number>> = {
  direct_output: 90,
  output_to_env: 80,
  output_to_file: 75,
  output_to_secret: 85,
  job_chain: 70,
  artifact_transfer: 65,
  matrix_propagation: 60,
  inferred: 40,
};

/**
 * Evidence type weights
 */
export const EVIDENCE_TYPE_WEIGHTS: Readonly<Record<FlowEvidenceType, number>> = {
  explicit_reference: 1.0,
  expression_match: 0.9,
  env_variable: 0.8,
  artifact_path: 0.7,
  job_dependency: 0.8,
  naming_convention: 0.5,
  step_proximity: 0.4,
  semantic_match: 0.6,
  file_path_match: 0.6,
};

/**
 * Terraform output command patterns
 */
export const TF_OUTPUT_PATTERNS: readonly RegExp[] = [
  /terraform\s+output\s+(-raw\s+)?(-json\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/,
  /\$\(\s*terraform\s+output\s+(-raw\s+)?(-json\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/,
  /`terraform\s+output\s+(-raw\s+)?(-json\s+)?([a-zA-Z_][a-zA-Z0-9_]*)`/,
];

/**
 * Helm set value patterns
 */
export const HELM_SET_PATTERNS: readonly RegExp[] = [
  /--set\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*["']?\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?["']?/,
  /--set-string\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*["']?\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?["']?/,
  /--set-file\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*["']?([^"'\s]+)["']?/,
];
