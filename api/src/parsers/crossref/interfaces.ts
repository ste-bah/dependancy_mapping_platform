/**
 * TF-Helm Cross-Reference Detection Interfaces
 * @module parsers/crossref/interfaces
 *
 * Interface definitions for dependency injection in the TF-Helm cross-reference
 * detection system. Enables loose coupling and testability through abstractions.
 *
 * TASK-XREF-003: TF-Helm Cross-Reference Detection - Interface definitions
 */

import { SourceLocation } from '../terraform/types';
import {
  TerraformToHelmFlow,
  TfHelmFlowPattern,
  TfHelmDetectionContext,
  TfHelmDetectorOptions,
  TfHelmDetectionResult,
  PartialFlow,
  ScoredFlow,
  ScoreBreakdown,
  VariableOrigin,
  TerraformOutputInfo,
  HelmValueSource,
  FlowEvidence,
  TerraformOutputName,
  HelmValuePath,
  ConfidenceLevel,
} from './types';

// ============================================================================
// Core Detector Interface
// ============================================================================

/**
 * Main detector interface for TF-Helm cross-reference detection.
 * Implementations analyze workflows to find data flows from Terraform outputs
 * to Helm value inputs.
 *
 * @example
 * ```typescript
 * const detector: ITfHelmDetector = new TfHelmDetector(workflow, options);
 * const flows = detector.detect(workflow);
 * const highConfidence = detector.getFlowsAboveConfidence(80);
 * ```
 */
export interface ITfHelmDetector {
  /**
   * Detect all TF-Helm flows in a workflow
   * @param workflow - Parsed workflow object
   * @returns Array of detected flows
   */
  detect(workflow: unknown): TerraformToHelmFlow[];

  /**
   * Detect flows with full analysis metadata
   * @returns Complete detection result with summary and metadata
   */
  detectWithAnalysis(): TfHelmDetectionResult;

  /**
   * Get flows above a confidence threshold
   * @param minConfidence - Minimum confidence score (0-100)
   * @returns Flows meeting the threshold
   */
  getFlowsAboveConfidence(minConfidence: number): TerraformToHelmFlow[];

  /**
   * Get flows matching a specific pattern
   * @param pattern - Flow pattern to filter by
   * @returns Flows matching the pattern
   */
  getFlowsByPattern(pattern: TfHelmFlowPattern): TerraformToHelmFlow[];

  /**
   * Get flows by confidence level
   * @param level - Confidence level filter
   * @returns Flows at the specified confidence level
   */
  getFlowsByConfidenceLevel(level: ConfidenceLevel): TerraformToHelmFlow[];

  /**
   * Check if any flows exist between two jobs
   * @param sourceJobId - Terraform job ID
   * @param targetJobId - Helm job ID
   * @returns True if flows exist
   */
  hasFlowBetweenJobs(sourceJobId: string, targetJobId: string): boolean;

  /**
   * Get all source jobs (jobs that produce TF outputs)
   * @returns Set of job IDs
   */
  getSourceJobs(): Set<string>;

  /**
   * Get all target jobs (jobs that consume via Helm)
   * @returns Set of job IDs
   */
  getTargetJobs(): Set<string>;
}

// ============================================================================
// Flow Analyzer Interface
// ============================================================================

/**
 * Interface for analyzing workflow steps and tracing data flows.
 * Responsible for identifying Terraform and Helm steps and tracing
 * variable origins through the workflow.
 *
 * @example
 * ```typescript
 * const analyzer: IFlowAnalyzer = new FlowAnalyzer();
 * const tfSteps = analyzer.findTerraformSteps(job.steps, jobId);
 * const origins = analyzer.traceVariable('cluster_endpoint', 'deploy', ctx);
 * ```
 */
export interface IFlowAnalyzer {
  /**
   * Find all Terraform steps in a job's steps
   * @param steps - Array of workflow steps
   * @param jobId - ID of the containing job
   * @returns Array of Terraform step information
   */
  findTerraformSteps(
    steps: readonly unknown[],
    jobId: string
  ): TerraformStepInfo[];

  /**
   * Find all Helm steps in a job's steps
   * @param steps - Array of workflow steps
   * @param jobId - ID of the containing job
   * @returns Array of Helm step information
   */
  findHelmSteps(
    steps: readonly unknown[],
    jobId: string
  ): HelmStepInfo[];

  /**
   * Trace the origin of a variable value
   * @param name - Variable name to trace
   * @param scope - Scope (job or step ID) where variable is used
   * @param ctx - Trace context with workflow information
   * @returns Array of possible origins
   */
  traceVariable(
    name: string,
    scope: string,
    ctx: TraceContext
  ): VariableOrigin[];

  /**
   * Analyze a Terraform command string for output information
   * @param cmd - Terraform command string
   * @returns Output information if detectable, null otherwise
   */
  analyzeTerraformCommand(cmd: string): TerraformOutputInfo | null;

  /**
   * Analyze Helm step for set values and their sources
   * @param step - Helm step object
   * @returns Array of value sources
   */
  analyzeHelmSetValues(step: unknown): HelmValueSource[];

  /**
   * Extract output names from Terraform output command
   * @param command - Full command string
   * @returns Array of output names
   */
  extractTerraformOutputNames(command: string): TerraformOutputName[];

  /**
   * Extract value paths from Helm set flags
   * @param setFlags - Array of --set flag values
   * @returns Array of value paths
   */
  extractHelmValuePaths(setFlags: readonly string[]): HelmValuePath[];

  /**
   * Check if a step is a Terraform step
   * @param step - Step to check
   * @returns True if step runs Terraform
   */
  isTerraformStep(step: unknown): boolean;

  /**
   * Check if a step is a Helm step
   * @param step - Step to check
   * @returns True if step runs Helm
   */
  isHelmStep(step: unknown): boolean;
}

/**
 * Information about a Terraform step extracted from workflow
 */
export interface TerraformStepInfo {
  /** Step index in the job's steps array */
  readonly stepIndex: number;
  /** Step ID if defined */
  readonly stepId?: string;
  /** Full Terraform command */
  readonly command: string;
  /** Output names produced by this step */
  readonly outputs: readonly string[];
  /** Working directory */
  readonly workingDir?: string;
  /** Environment variables available to the step */
  readonly envVars?: Readonly<Record<string, string>>;
}

/**
 * Information about a Helm step extracted from workflow
 */
export interface HelmStepInfo {
  /** Step index in the job's steps array */
  readonly stepIndex: number;
  /** Step ID if defined */
  readonly stepId?: string;
  /** Full Helm command */
  readonly command: string;
  /** Values set via --set flags */
  readonly setValues: ReadonlyMap<string, string>;
  /** Values files used */
  readonly valuesFiles: readonly string[];
  /** Release name */
  readonly releaseName?: string;
  /** Chart reference */
  readonly chart?: string;
  /** Target namespace */
  readonly namespace?: string;
}

/**
 * Context for variable tracing
 */
export interface TraceContext {
  /** Full workflow object */
  readonly workflow: unknown;
  /** Current job being analyzed */
  readonly job: unknown;
  /** Steps in the current job */
  readonly steps: readonly unknown[];
  /** Map of dependent jobs by ID */
  readonly dependentJobs: ReadonlyMap<string, unknown>;
  /** Environment variables in scope */
  readonly envInScope: Readonly<Record<string, string>>;
  /** Outputs available from dependent jobs */
  readonly availableOutputs: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

// ============================================================================
// Confidence Scorer Interface
// ============================================================================

/**
 * Interface for computing confidence scores for detected flows.
 * Implements the scoring algorithm that determines flow reliability.
 *
 * @example
 * ```typescript
 * const scorer: IConfidenceScorer = new ConfidenceScorer();
 * const scoredFlow = scorer.scoreFlow(partialFlow);
 * const breakdown = scorer.getBreakdown(partialFlow);
 * ```
 */
export interface IConfidenceScorer {
  /**
   * Score a partial flow and return a fully scored flow
   * @param flow - Partial flow without confidence score
   * @returns Scored flow with confidence
   */
  scoreFlow(flow: PartialFlow): ScoredFlow;

  /**
   * Get detailed score breakdown for a flow
   * @param flow - Partial flow to analyze
   * @returns Score breakdown with component scores
   */
  getBreakdown(flow: PartialFlow): ScoreBreakdown;

  /**
   * Get the base score for a pattern type
   * @param pattern - Flow pattern
   * @returns Base confidence score (0-100)
   */
  getPatternBaseScore(pattern: TfHelmFlowPattern): number;

  /**
   * Calculate evidence contribution to score
   * @param evidence - Array of flow evidence
   * @returns Evidence score component
   */
  calculateEvidenceScore(evidence: readonly FlowEvidence[]): number;

  /**
   * Determine confidence level from score
   * @param score - Confidence score (0-100)
   * @returns Confidence level classification
   */
  getConfidenceLevel(score: number): ConfidenceLevel;
}

// ============================================================================
// Pattern Detector Interface (Strategy Pattern)
// ============================================================================

/**
 * Interface for individual pattern detectors.
 * Implements the Strategy pattern to allow pluggable detection algorithms.
 *
 * @example
 * ```typescript
 * const detectors: IPatternDetector[] = [
 *   new DirectOutputDetector(),
 *   new JobChainDetector(),
 *   new EnvPropagationDetector(),
 * ];
 *
 * for (const detector of detectors) {
 *   if (detector.isApplicable(context)) {
 *     flows.push(...detector.detect(context));
 *   }
 * }
 * ```
 */
export interface IPatternDetector {
  /** Pattern type this detector handles */
  readonly pattern: TfHelmFlowPattern;

  /** Base confidence score for flows detected by this pattern */
  readonly baseConfidence: number;

  /** Human-readable description of the pattern */
  readonly description: string;

  /**
   * Detect flows matching this pattern
   * @param context - Detection context with workflow information
   * @returns Array of detected flows
   */
  detect(context: TfHelmDetectionContext): TerraformToHelmFlow[];

  /**
   * Check if this detector is applicable to the context
   * @param context - Detection context
   * @returns True if detector should run
   */
  isApplicable(context: TfHelmDetectionContext): boolean;

  /**
   * Get priority for this detector (higher runs first)
   * @returns Priority value
   */
  getPriority(): number;
}

// ============================================================================
// Evidence Collector Interface
// ============================================================================

/**
 * Interface for collecting and analyzing flow evidence.
 * Gathers supporting information for detected flows.
 */
export interface IEvidenceCollector {
  /**
   * Collect evidence for a potential flow
   * @param source - Terraform output info
   * @param target - Helm value source
   * @param context - Detection context
   * @returns Array of collected evidence
   */
  collectEvidence(
    source: TerraformOutputInfo,
    target: HelmValueSource,
    context: TfHelmDetectionContext
  ): FlowEvidence[];

  /**
   * Check for explicit reference evidence
   * @param source - Source output
   * @param target - Target value
   * @param context - Detection context
   * @returns Evidence if found, undefined otherwise
   */
  findExplicitReference(
    source: TerraformOutputInfo,
    target: HelmValueSource,
    context: TfHelmDetectionContext
  ): FlowEvidence | undefined;

  /**
   * Check for environment variable propagation
   * @param source - Source output
   * @param target - Target value
   * @param context - Detection context
   * @returns Evidence if found, undefined otherwise
   */
  findEnvPropagation(
    source: TerraformOutputInfo,
    target: HelmValueSource,
    context: TfHelmDetectionContext
  ): FlowEvidence | undefined;

  /**
   * Check for naming convention matches
   * @param source - Source output
   * @param target - Target value
   * @returns Evidence if names match patterns
   */
  findNamingMatch(
    source: TerraformOutputInfo,
    target: HelmValueSource
  ): FlowEvidence | undefined;

  /**
   * Calculate total evidence strength
   * @param evidence - Array of evidence items
   * @returns Combined strength score (0-100)
   */
  calculateTotalStrength(evidence: readonly FlowEvidence[]): number;
}

// ============================================================================
// Expression Analyzer Interface
// ============================================================================

/**
 * Interface for analyzing GitHub Actions expressions.
 * Parses and extracts references from ${{ }} expressions.
 */
export interface IExpressionAnalyzer {
  /**
   * Extract all expressions from content
   * @param content - String content to analyze
   * @returns Array of extracted expressions
   */
  extractExpressions(content: string): ExpressionInfo[];

  /**
   * Find needs.*.outputs.* references
   * @param expression - Expression to analyze
   * @returns Array of output references
   */
  findOutputReferences(expression: string): OutputReference[];

  /**
   * Find steps.*.outputs.* references
   * @param expression - Expression to analyze
   * @returns Array of step output references
   */
  findStepOutputReferences(expression: string): StepOutputReference[];

  /**
   * Find env.* references
   * @param expression - Expression to analyze
   * @returns Array of environment references
   */
  findEnvReferences(expression: string): EnvReference[];

  /**
   * Check if expression references a specific output
   * @param expression - Expression to check
   * @param jobId - Job ID to look for
   * @param outputName - Output name to look for
   * @returns True if expression references the output
   */
  referencesOutput(
    expression: string,
    jobId: string,
    outputName: string
  ): boolean;
}

/**
 * Information about an extracted expression
 */
export interface ExpressionInfo {
  /** Raw expression including ${{ }} */
  readonly raw: string;
  /** Expression content without wrapper */
  readonly content: string;
  /** Start position in source */
  readonly start: number;
  /** End position in source */
  readonly end: number;
  /** Context types referenced (needs, steps, env, etc.) */
  readonly contexts: readonly string[];
}

/**
 * Reference to a job output
 */
export interface OutputReference {
  /** Job ID producing the output */
  readonly jobId: string;
  /** Output name */
  readonly outputName: string;
  /** Full reference path */
  readonly fullPath: string;
}

/**
 * Reference to a step output
 */
export interface StepOutputReference {
  /** Step ID producing the output */
  readonly stepId: string;
  /** Output name */
  readonly outputName: string;
  /** Full reference path */
  readonly fullPath: string;
}

/**
 * Reference to an environment variable
 */
export interface EnvReference {
  /** Environment variable name */
  readonly name: string;
  /** Full reference path */
  readonly fullPath: string;
}

// ============================================================================
// Workflow Analyzer Interface
// ============================================================================

/**
 * Interface for high-level workflow analysis.
 * Provides workflow-wide analysis capabilities.
 */
export interface IWorkflowAnalyzer {
  /**
   * Build a detection context from a workflow
   * @param workflow - Parsed workflow object
   * @param filePath - Path to workflow file
   * @returns Detection context
   */
  buildContext(
    workflow: unknown,
    filePath: string
  ): TfHelmDetectionContext;

  /**
   * Get job dependency graph
   * @param workflow - Parsed workflow
   * @returns Map of job ID to dependent job IDs
   */
  getJobDependencies(
    workflow: unknown
  ): ReadonlyMap<string, readonly string[]>;

  /**
   * Find path between two jobs
   * @param fromJob - Source job ID
   * @param toJob - Target job ID
   * @param dependencies - Job dependency map
   * @returns Job chain if path exists, empty array otherwise
   */
  findJobPath(
    fromJob: string,
    toJob: string,
    dependencies: ReadonlyMap<string, readonly string[]>
  ): readonly string[];

  /**
   * Check if target job depends on source job
   * @param sourceJob - Potential dependency
   * @param targetJob - Job that may depend on source
   * @param dependencies - Job dependency map
   * @returns True if dependency exists
   */
  jobDependsOn(
    sourceJob: string,
    targetJob: string,
    dependencies: ReadonlyMap<string, readonly string[]>
  ): boolean;

  /**
   * Get all jobs that have Terraform steps
   * @param workflow - Parsed workflow
   * @returns Set of job IDs
   */
  getTerraformJobs(workflow: unknown): Set<string>;

  /**
   * Get all jobs that have Helm steps
   * @param workflow - Parsed workflow
   * @returns Set of job IDs
   */
  getHelmJobs(workflow: unknown): Set<string>;
}

// ============================================================================
// Flow Repository Interface
// ============================================================================

/**
 * Interface for storing and querying detected flows.
 * Enables caching and persistence of detection results.
 */
export interface IFlowRepository {
  /**
   * Store detected flows
   * @param flows - Flows to store
   * @param workflowId - Workflow identifier
   */
  store(flows: readonly TerraformToHelmFlow[], workflowId: string): void;

  /**
   * Retrieve flows for a workflow
   * @param workflowId - Workflow identifier
   * @returns Stored flows or empty array
   */
  getByWorkflow(workflowId: string): TerraformToHelmFlow[];

  /**
   * Query flows by pattern
   * @param pattern - Pattern to filter by
   * @returns Matching flows
   */
  queryByPattern(pattern: TfHelmFlowPattern): TerraformToHelmFlow[];

  /**
   * Query flows by confidence threshold
   * @param minConfidence - Minimum confidence
   * @returns Flows meeting threshold
   */
  queryByConfidence(minConfidence: number): TerraformToHelmFlow[];

  /**
   * Clear all stored flows
   */
  clear(): void;

  /**
   * Get count of stored flows
   */
  count(): number;
}

// ============================================================================
// Factory Interface
// ============================================================================

/**
 * Factory interface for creating detector components.
 * Supports dependency injection and testing.
 */
export interface ITfHelmDetectorFactory {
  /**
   * Create a detector instance
   * @param workflow - Workflow to analyze
   * @param options - Detection options
   * @returns Configured detector
   */
  createDetector(
    workflow: unknown,
    options?: TfHelmDetectorOptions
  ): ITfHelmDetector;

  /**
   * Create a flow analyzer
   * @returns Flow analyzer instance
   */
  createFlowAnalyzer(): IFlowAnalyzer;

  /**
   * Create a confidence scorer
   * @returns Confidence scorer instance
   */
  createConfidenceScorer(): IConfidenceScorer;

  /**
   * Create an evidence collector
   * @returns Evidence collector instance
   */
  createEvidenceCollector(): IEvidenceCollector;

  /**
   * Create an expression analyzer
   * @returns Expression analyzer instance
   */
  createExpressionAnalyzer(): IExpressionAnalyzer;

  /**
   * Create a workflow analyzer
   * @returns Workflow analyzer instance
   */
  createWorkflowAnalyzer(): IWorkflowAnalyzer;

  /**
   * Get all registered pattern detectors
   * @returns Array of pattern detectors
   */
  getPatternDetectors(): IPatternDetector[];

  /**
   * Register a custom pattern detector
   * @param detector - Pattern detector to register
   */
  registerPatternDetector(detector: IPatternDetector): void;
}
