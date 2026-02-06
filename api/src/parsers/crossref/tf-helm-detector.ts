/**
 * TF-Helm Detector - Main Orchestrator for Cross-Reference Detection
 * @module parsers/crossref/tf-helm-detector
 *
 * Implements the main TfHelmDetector orchestrator class that coordinates
 * pattern detectors, flow analysis, and confidence scoring to detect
 * Terraform-to-Helm data flows in CI/CD workflows.
 *
 * TASK-XREF-003: TF-Helm Cross-Reference Detection - Main Orchestrator
 *
 * @example
 * ```typescript
 * import { TfHelmDetector, createTfHelmDetector } from './tf-helm-detector';
 *
 * // Using factory function
 * const detector = createTfHelmDetector({ minConfidence: 60 });
 * const result = detector.detectWithAnalysis();
 *
 * // Direct instantiation with dependency injection
 * const customDetector = new TfHelmDetector(workflow, {
 *   minConfidence: 50,
 *   patterns: { directOutput: true, jobChain: true },
 * }, {
 *   flowAnalyzer: customAnalyzer,
 *   confidenceScorer: customScorer,
 * });
 * ```
 */

import {
  TerraformToHelmFlow,
  TfHelmFlowPattern,
  TfHelmDetectionContext,
  TfHelmDetectorOptions,
  TfHelmDetectionResult,
  DetectionSummary,
  DetectionMetadata,
  DetectionError,
  DetectionWarning,
  TerraformStepContext,
  HelmStepContext,
  ConfidenceLevel,
  DEFAULT_TF_HELM_DETECTOR_OPTIONS,
  createEmptyDetectionResult,
  getConfidenceLevel,
} from './types';
import {
  ITfHelmDetector,
  IFlowAnalyzer,
  IPatternDetector,
  TerraformStepInfo,
  HelmStepInfo,
} from './interfaces';
import { IConfidenceScorer } from './types';
import { createFlowAnalyzer, FlowAnalyzer } from './flow-analyzer';
import { createConfidenceScorer, ConfidenceScorer } from './confidence-scorer';
import { createPatternDetectors } from './pattern-detectors';

// ============================================================================
// Detector Configuration
// ============================================================================

/**
 * Internal configuration for the TfHelmDetector
 */
interface DetectorConfig {
  /** Minimum confidence threshold for including flows (0-100) */
  readonly minConfidence: number;
  /** Maximum flows to return per workflow */
  readonly maxFlows: number;
  /** Pattern-specific enable/disable flags */
  readonly patterns: Readonly<{
    readonly directOutput: boolean;
    readonly outputToEnv: boolean;
    readonly outputToFile: boolean;
    readonly outputToSecret: boolean;
    readonly jobChain: boolean;
    readonly artifactTransfer: boolean;
    readonly matrixPropagation: boolean;
    readonly inferred: boolean;
  }>;
  /** Enable debug logging */
  readonly debug: boolean;
}

/**
 * Dependencies that can be injected for testing
 */
export interface TfHelmDetectorDeps {
  readonly flowAnalyzer?: IFlowAnalyzer;
  readonly confidenceScorer?: IConfidenceScorer;
  readonly patternDetectors?: readonly IPatternDetector[];
}

// ============================================================================
// Pattern to TfHelmFlowPattern Mapping
// ============================================================================

/**
 * Map from options pattern names to TfHelmFlowPattern enum values
 */
const PATTERN_NAME_MAP: Readonly<Record<string, TfHelmFlowPattern>> = {
  directOutput: 'direct_output',
  outputToEnv: 'output_to_env',
  outputToFile: 'output_to_file',
  outputToSecret: 'output_to_secret',
  jobChain: 'job_chain',
  artifactTransfer: 'artifact_transfer',
  matrixPropagation: 'matrix_propagation',
  inferred: 'inferred',
};

// ============================================================================
// TfHelmDetector Implementation
// ============================================================================

/**
 * Main orchestrator for TF-Helm cross-reference detection.
 *
 * Coordinates pattern detectors, flow analysis, and confidence scoring
 * to identify data flows from Terraform outputs to Helm value inputs
 * in CI/CD workflows.
 *
 * Architecture:
 * - Pattern Detectors: Identify specific patterns (direct set, env var, etc.)
 * - Flow Analyzer: Traces data flow through the workflow
 * - Confidence Scorer: Assigns confidence scores to detected flows
 *
 * @implements {ITfHelmDetector}
 *
 * @example
 * ```typescript
 * const detector = new TfHelmDetector(parsedWorkflow);
 * const flows = detector.detect(parsedWorkflow);
 * console.log(`Found ${flows.length} TF-Helm flows`);
 *
 * const highConfidence = detector.getFlowsAboveConfidence(80);
 * console.log(`${highConfidence.length} high confidence flows`);
 * ```
 */
export class TfHelmDetector implements ITfHelmDetector {
  /** Parsed workflow object */
  private readonly workflow: unknown;

  /** Detector configuration */
  private readonly config: DetectorConfig;

  /** Flow analyzer for tracing data flows */
  private readonly flowAnalyzer: IFlowAnalyzer;

  /** Confidence scorer for rating flows */
  private readonly confidenceScorer: IConfidenceScorer;

  /** Pattern-specific detectors */
  private readonly patternDetectors: readonly IPatternDetector[];

  /** Cached detection context */
  private cachedContext: TfHelmDetectionContext | null = null;

  /** Cached detection results */
  private cachedFlows: TerraformToHelmFlow[] | null = null;

  /** Workflow file path */
  private readonly workflowFile: string;

  /**
   * Create a new TfHelmDetector instance
   *
   * @param workflow - Parsed workflow object (GitHub Actions or GitLab CI)
   * @param options - Detection options
   * @param deps - Optional dependencies for testing
   * @param workflowFile - Path to the workflow file
   */
  constructor(
    workflow: unknown,
    options: TfHelmDetectorOptions = {},
    deps: TfHelmDetectorDeps = {},
    workflowFile: string = ''
  ) {
    this.workflow = workflow;
    this.workflowFile = workflowFile;

    // Merge options with defaults
    const defaultPatterns = DEFAULT_TF_HELM_DETECTOR_OPTIONS.patterns;
    const mergedPatterns = {
      directOutput: options.patterns?.directOutput ?? defaultPatterns.directOutput,
      outputToEnv: options.patterns?.outputToEnv ?? defaultPatterns.outputToEnv,
      outputToFile: options.patterns?.outputToFile ?? defaultPatterns.outputToFile,
      outputToSecret: options.patterns?.outputToSecret ?? defaultPatterns.outputToSecret,
      jobChain: options.patterns?.jobChain ?? defaultPatterns.jobChain,
      artifactTransfer: options.patterns?.artifactTransfer ?? defaultPatterns.artifactTransfer,
      matrixPropagation: options.patterns?.matrixPropagation ?? defaultPatterns.matrixPropagation,
      inferred: options.patterns?.inferred ?? defaultPatterns.inferred,
    } as const;

    this.config = {
      minConfidence: options.minConfidence ?? DEFAULT_TF_HELM_DETECTOR_OPTIONS.minConfidence,
      maxFlows: options.maxFlows ?? DEFAULT_TF_HELM_DETECTOR_OPTIONS.maxFlows,
      patterns: mergedPatterns,
      debug: options.debug ?? DEFAULT_TF_HELM_DETECTOR_OPTIONS.debug,
    };

    // Initialize dependencies (use provided or create defaults)
    this.flowAnalyzer = deps.flowAnalyzer ?? createFlowAnalyzer();
    this.confidenceScorer = deps.confidenceScorer ?? createConfidenceScorer();
    this.patternDetectors = deps.patternDetectors ?? createPatternDetectors();
  }

  // ==========================================================================
  // ITfHelmDetector Interface Implementation
  // ==========================================================================

  /**
   * Detect all TF-Helm flows in the workflow
   *
   * @param workflow - Optional workflow to analyze (defaults to constructor workflow)
   * @returns Array of detected TerraformToHelmFlow objects
   */
  detect(workflow?: unknown): TerraformToHelmFlow[] {
    const targetWorkflow = workflow ?? this.workflow;

    // Return cached results if available for same workflow
    if (this.cachedFlows !== null && targetWorkflow === this.workflow) {
      return this.cachedFlows;
    }

    const context = this.buildDetectionContext(targetWorkflow);
    const flows = this.runDetection(context);

    // Cache results for the main workflow
    if (targetWorkflow === this.workflow) {
      this.cachedFlows = flows;
      this.cachedContext = context;
    }

    return flows;
  }

  /**
   * Detect flows with full analysis metadata
   *
   * @returns Complete detection result with summary and metadata
   */
  detectWithAnalysis(): TfHelmDetectionResult {
    const startTime = Date.now();
    const errors: DetectionError[] = [];
    const warnings: DetectionWarning[] = [];

    let flows: TerraformToHelmFlow[] = [];

    try {
      flows = this.detect();
    } catch (error) {
      errors.push({
        code: 'DETECTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      });
    }

    // Build context for statistics (use cached if available)
    const context = this.cachedContext ?? this.buildDetectionContext(this.workflow);

    // Generate warnings for potential issues
    warnings.push(...this.generateWarnings(context, flows));

    const durationMs = Date.now() - startTime;

    return {
      flows: Object.freeze(flows),
      summary: this.buildSummary(flows, context),
      metadata: this.buildMetadata(durationMs),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
    };
  }

  /**
   * Get flows above a confidence threshold
   *
   * @param minConfidence - Minimum confidence score (0-100)
   * @returns Flows meeting the threshold
   */
  getFlowsAboveConfidence(minConfidence: number): TerraformToHelmFlow[] {
    const flows = this.detect();
    return flows.filter((flow) => flow.confidence >= minConfidence);
  }

  /**
   * Get flows matching a specific pattern
   *
   * @param pattern - Flow pattern to filter by
   * @returns Flows matching the pattern
   */
  getFlowsByPattern(pattern: TfHelmFlowPattern): TerraformToHelmFlow[] {
    const flows = this.detect();
    return flows.filter((flow) => flow.pattern === pattern);
  }

  /**
   * Get flows by confidence level
   *
   * @param level - Confidence level filter
   * @returns Flows at the specified confidence level
   */
  getFlowsByConfidenceLevel(level: ConfidenceLevel): TerraformToHelmFlow[] {
    const flows = this.detect();
    return flows.filter((flow) => flow.confidenceLevel === level);
  }

  /**
   * Check if any flows exist between two jobs
   *
   * @param sourceJobId - Terraform job ID
   * @param targetJobId - Helm job ID
   * @returns True if flows exist
   */
  hasFlowBetweenJobs(sourceJobId: string, targetJobId: string): boolean {
    const flows = this.detect();
    return flows.some(
      (flow) =>
        flow.source.jobId === sourceJobId && flow.target.jobId === targetJobId
    );
  }

  /**
   * Get all source jobs (jobs that produce TF outputs)
   *
   * @returns Set of job IDs
   */
  getSourceJobs(): Set<string> {
    const flows = this.detect();
    return new Set(flows.map((flow) => flow.source.jobId));
  }

  /**
   * Get all target jobs (jobs that consume via Helm)
   *
   * @returns Set of job IDs
   */
  getTargetJobs(): Set<string> {
    const flows = this.detect();
    return new Set(flows.map((flow) => flow.target.jobId));
  }

  // ==========================================================================
  // Private Implementation Methods
  // ==========================================================================

  /**
   * Build detection context from workflow
   */
  private buildDetectionContext(workflow: unknown): TfHelmDetectionContext {
    const wf = workflow as Record<string, unknown>;
    const jobs = this.extractJobs(wf);
    const terraformSteps = this.findAllTerraformSteps(jobs);
    const helmSteps = this.findAllHelmSteps(jobs);
    const jobDependencies = this.buildJobDependencies(jobs);

    return {
      workflow,
      jobs,
      terraformSteps: Object.freeze(terraformSteps),
      helmSteps: Object.freeze(helmSteps),
      jobDependencies,
      workflowFile: this.workflowFile,
    };
  }

  /**
   * Extract jobs map from workflow
   */
  private extractJobs(workflow: Record<string, unknown>): ReadonlyMap<string, unknown> {
    const jobs = new Map<string, unknown>();

    // GitHub Actions format
    const ghJobs = workflow.jobs as Record<string, unknown> | undefined;
    if (ghJobs && typeof ghJobs === 'object') {
      for (const [jobId, job] of Object.entries(ghJobs)) {
        jobs.set(jobId, job);
      }
      return jobs;
    }

    // GitLab CI format (jobs are top-level keys except reserved ones)
    const reservedKeys = [
      'stages',
      'variables',
      'default',
      'include',
      'workflow',
      'image',
      'before_script',
      'after_script',
      'cache',
      'services',
    ];

    for (const [key, value] of Object.entries(workflow)) {
      if (!reservedKeys.includes(key) && typeof value === 'object' && value !== null) {
        // Check if it looks like a job (has script, stage, etc.)
        const obj = value as Record<string, unknown>;
        if (obj.script || obj.stage || obj.extends || obj.needs) {
          jobs.set(key, value);
        }
      }
    }

    return jobs;
  }

  /**
   * Find all Terraform steps across all jobs
   */
  private findAllTerraformSteps(
    jobs: ReadonlyMap<string, unknown>
  ): TerraformStepContext[] {
    const allSteps: TerraformStepContext[] = [];

    for (const [jobId, job] of Array.from(jobs)) {
      const jobObj = job as Record<string, unknown>;
      const steps = this.extractJobSteps(jobObj);

      const tfStepInfos = this.flowAnalyzer.findTerraformSteps(steps, jobId);

      for (const info of tfStepInfos) {
        allSteps.push(this.convertToTerraformStepContext(info, jobId));
      }
    }

    return allSteps;
  }

  /**
   * Find all Helm steps across all jobs
   */
  private findAllHelmSteps(jobs: ReadonlyMap<string, unknown>): HelmStepContext[] {
    const allSteps: HelmStepContext[] = [];

    for (const [jobId, job] of Array.from(jobs)) {
      const jobObj = job as Record<string, unknown>;
      const steps = this.extractJobSteps(jobObj);

      const helmStepInfos = this.flowAnalyzer.findHelmSteps(steps, jobId);

      for (const info of helmStepInfos) {
        allSteps.push(this.convertToHelmStepContext(info, jobId));
      }
    }

    return allSteps;
  }

  /**
   * Extract steps array from a job object
   */
  private extractJobSteps(job: Record<string, unknown>): readonly unknown[] {
    // GitHub Actions format
    if (Array.isArray(job.steps)) {
      return job.steps;
    }

    // GitLab CI format - convert script to pseudo-steps
    const script = job.script;
    if (Array.isArray(script)) {
      return script.map((cmd, index) => ({
        run: cmd,
        id: `step-${index}`,
      }));
    }

    if (typeof script === 'string') {
      return [{ run: script, id: 'step-0' }];
    }

    return [];
  }

  /**
   * Convert TerraformStepInfo to TerraformStepContext
   */
  private convertToTerraformStepContext(
    info: TerraformStepInfo,
    jobId: string
  ): TerraformStepContext {
    return {
      jobId,
      stepIndex: info.stepIndex,
      stepId: info.stepId,
      command: info.command,
      outputs: info.outputs,
      workingDir: info.workingDir,
      envVars: info.envVars ?? Object.freeze({}),
    };
  }

  /**
   * Convert HelmStepInfo to HelmStepContext
   */
  private convertToHelmStepContext(info: HelmStepInfo, jobId: string): HelmStepContext {
    return {
      jobId,
      stepIndex: info.stepIndex,
      stepId: info.stepId,
      command: info.command,
      setValues: info.setValues,
      valuesFiles: info.valuesFiles,
      releaseName: info.releaseName,
      chart: info.chart,
    };
  }

  /**
   * Build job dependency map from workflow
   */
  private buildJobDependencies(
    jobs: ReadonlyMap<string, unknown>
  ): ReadonlyMap<string, readonly string[]> {
    const deps = new Map<string, readonly string[]>();

    for (const [jobId, job] of Array.from(jobs)) {
      const jobObj = job as Record<string, unknown>;
      const jobDeps: string[] = [];

      // GitHub Actions: needs
      if (Array.isArray(jobObj.needs)) {
        jobDeps.push(...(jobObj.needs as string[]));
      } else if (typeof jobObj.needs === 'string') {
        jobDeps.push(jobObj.needs);
      }

      // GitLab CI: needs (can be array of strings or objects)
      const gitlabNeeds = jobObj.needs;
      if (Array.isArray(gitlabNeeds)) {
        for (const need of gitlabNeeds) {
          if (typeof need === 'string') {
            jobDeps.push(need);
          } else if (typeof need === 'object' && need !== null) {
            const needObj = need as Record<string, unknown>;
            if (typeof needObj.job === 'string') {
              jobDeps.push(needObj.job);
            }
          }
        }
      }

      // GitLab CI: dependencies (older syntax)
      if (Array.isArray(jobObj.dependencies)) {
        jobDeps.push(...(jobObj.dependencies as string[]));
      }

      deps.set(jobId, Object.freeze(Array.from(new Set(jobDeps))));
    }

    return deps;
  }

  /**
   * Run detection using all enabled pattern detectors
   */
  private runDetection(context: TfHelmDetectionContext): TerraformToHelmFlow[] {
    const allFlows: TerraformToHelmFlow[] = [];
    const seenFlowIds = new Set<string>();

    // Check if detection is applicable
    if (context.terraformSteps.length === 0 || context.helmSteps.length === 0) {
      this.debugLog('No TF or Helm steps found, skipping detection');
      return [];
    }

    // Run each enabled pattern detector
    for (const detector of this.patternDetectors) {
      // Check if this pattern is enabled
      if (!this.isPatternEnabled(detector.pattern)) {
        this.debugLog(`Skipping disabled pattern: ${detector.pattern}`);
        continue;
      }

      // Check if detector is applicable
      if (!detector.isApplicable(context)) {
        this.debugLog(`Detector not applicable: ${detector.pattern}`);
        continue;
      }

      try {
        const detectedFlows = detector.detect(context);

        // Deduplicate and add flows
        for (const flow of detectedFlows) {
          const flowKey = `${flow.source.jobId}:${flow.source.name}:${flow.target.jobId}:${flow.target.path}`;

          if (!seenFlowIds.has(flowKey)) {
            seenFlowIds.add(flowKey);
            allFlows.push(flow);
          }
        }

        this.debugLog(`Pattern ${detector.pattern}: found ${detectedFlows.length} flows`);
      } catch (error) {
        this.debugLog(`Error in pattern ${detector.pattern}: ${error}`);
      }
    }

    // Filter by minimum confidence
    const filteredFlows = allFlows.filter(
      (flow) => flow.confidence >= this.config.minConfidence
    );

    // Sort by confidence (descending) and limit
    const sortedFlows = filteredFlows
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxFlows);

    this.debugLog(
      `Total: ${allFlows.length} flows, filtered: ${filteredFlows.length}, returned: ${sortedFlows.length}`
    );

    return sortedFlows;
  }

  /**
   * Check if a pattern is enabled in configuration
   */
  private isPatternEnabled(pattern: TfHelmFlowPattern): boolean {
    // Find the config key for this pattern
    for (const [configKey, patternValue] of Object.entries(PATTERN_NAME_MAP)) {
      if (patternValue === pattern) {
        return (this.config.patterns as Record<string, boolean>)[configKey] ?? false;
      }
    }

    // Unknown patterns are disabled by default
    return false;
  }

  /**
   * Build detection summary from flows
   */
  private buildSummary(
    flows: readonly TerraformToHelmFlow[],
    context: TfHelmDetectionContext
  ): DetectionSummary {
    const flowsByPattern: Record<TfHelmFlowPattern, number> = {
      direct_output: 0,
      output_to_env: 0,
      output_to_file: 0,
      output_to_secret: 0,
      job_chain: 0,
      artifact_transfer: 0,
      matrix_propagation: 0,
      inferred: 0,
    };

    const flowsByConfidence: Record<ConfidenceLevel, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalConfidence = 0;
    const terraformJobs = new Set<string>();
    const helmJobs = new Set<string>();

    for (const flow of flows) {
      flowsByPattern[flow.pattern]++;
      flowsByConfidence[flow.confidenceLevel]++;
      totalConfidence += flow.confidence;
      terraformJobs.add(flow.source.jobId);
      helmJobs.add(flow.target.jobId);
    }

    return {
      totalFlows: flows.length,
      flowsByPattern: Object.freeze(flowsByPattern),
      flowsByConfidence: Object.freeze(flowsByConfidence),
      averageConfidence: flows.length > 0 ? Math.round(totalConfidence / flows.length) : 0,
      terraformJobCount: terraformJobs.size,
      helmJobCount: helmJobs.size,
    };
  }

  /**
   * Build detection metadata
   */
  private buildMetadata(durationMs: number): DetectionMetadata {
    return {
      detectedAt: new Date(),
      durationMs,
      detectorVersion: '1.0.0',
      options: {
        minConfidence: this.config.minConfidence,
        patterns: { ...this.config.patterns },
        maxFlows: this.config.maxFlows,
        debug: this.config.debug,
      },
    };
  }

  /**
   * Generate warnings for potential issues
   */
  private generateWarnings(
    context: TfHelmDetectionContext,
    flows: readonly TerraformToHelmFlow[]
  ): DetectionWarning[] {
    const warnings: DetectionWarning[] = [];

    // Warn if TF steps exist but no Helm steps
    if (context.terraformSteps.length > 0 && context.helmSteps.length === 0) {
      warnings.push({
        code: 'NO_HELM_STEPS',
        message: 'Terraform steps found but no Helm steps detected in workflow',
      });
    }

    // Warn if Helm steps exist but no TF steps
    if (context.helmSteps.length > 0 && context.terraformSteps.length === 0) {
      warnings.push({
        code: 'NO_TF_STEPS',
        message: 'Helm steps found but no Terraform steps detected in workflow',
      });
    }

    // Warn about low confidence flows
    const lowConfidenceCount = flows.filter((f) => f.confidenceLevel === 'low').length;
    if (lowConfidenceCount > flows.length / 2 && flows.length > 0) {
      warnings.push({
        code: 'MANY_LOW_CONFIDENCE',
        message: `${lowConfidenceCount} of ${flows.length} flows have low confidence scores`,
      });
    }

    // Warn about potential missing job dependencies
    for (const flow of flows) {
      if (flow.source.jobId !== flow.target.jobId) {
        const targetDeps = context.jobDependencies.get(flow.target.jobId);
        if (!targetDeps?.includes(flow.source.jobId)) {
          warnings.push({
            code: 'MISSING_JOB_DEPENDENCY',
            message: `Flow from ${flow.source.jobId} to ${flow.target.jobId} detected but no explicit job dependency (needs:) found`,
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Debug logging helper
   */
  private debugLog(message: string): void {
    if (this.config.debug) {
      console.debug(`[TfHelmDetector] ${message}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a TfHelmDetector instance for a workflow.
 *
 * @param workflow - Parsed workflow object
 * @param options - Detection options
 * @param workflowFile - Path to the workflow file
 * @returns Configured TfHelmDetector instance
 *
 * @example
 * ```typescript
 * const detector = createTfHelmDetector(parsedWorkflow, {
 *   minConfidence: 60,
 *   patterns: { directOutput: true, outputToEnv: true },
 * });
 *
 * const flows = detector.detect();
 * const result = detector.detectWithAnalysis();
 * ```
 */
export function createTfHelmDetector(
  workflow: unknown,
  options?: TfHelmDetectorOptions,
  workflowFile?: string
): ITfHelmDetector {
  return new TfHelmDetector(workflow, options, {}, workflowFile);
}

/**
 * Create a TfHelmDetector with custom dependencies (for testing).
 *
 * @param workflow - Parsed workflow object
 * @param options - Detection options
 * @param deps - Custom dependencies
 * @param workflowFile - Path to the workflow file
 * @returns Configured TfHelmDetector instance
 *
 * @example
 * ```typescript
 * const mockAnalyzer = createMockFlowAnalyzer();
 * const mockScorer = createMockConfidenceScorer();
 *
 * const detector = createTfHelmDetectorWithDeps(workflow, {}, {
 *   flowAnalyzer: mockAnalyzer,
 *   confidenceScorer: mockScorer,
 * });
 * ```
 */
export function createTfHelmDetectorWithDeps(
  workflow: unknown,
  options: TfHelmDetectorOptions = {},
  deps: TfHelmDetectorDeps = {},
  workflowFile: string = ''
): ITfHelmDetector {
  return new TfHelmDetector(workflow, options, deps, workflowFile);
}

/**
 * Detect TF-Helm flows in a workflow (convenience function).
 *
 * @param workflow - Parsed workflow object
 * @param options - Detection options
 * @returns Array of detected flows
 *
 * @example
 * ```typescript
 * const flows = detectTfHelmFlows(parsedWorkflow, { minConfidence: 70 });
 * for (const flow of flows) {
 *   console.log(`${flow.source.name} -> ${flow.target.path} (${flow.confidence}%)`);
 * }
 * ```
 */
export function detectTfHelmFlows(
  workflow: unknown,
  options?: TfHelmDetectorOptions
): TerraformToHelmFlow[] {
  const detector = createTfHelmDetector(workflow, options);
  return detector.detect(workflow);
}

/**
 * Detect and analyze TF-Helm flows in a workflow (convenience function).
 *
 * @param workflow - Parsed workflow object
 * @param options - Detection options
 * @param workflowFile - Path to the workflow file
 * @returns Complete detection result with metadata
 *
 * @example
 * ```typescript
 * const result = detectAndAnalyzeTfHelmFlows(parsedWorkflow, {}, 'deploy.yml');
 *
 * console.log(`Found ${result.summary.totalFlows} flows`);
 * console.log(`High confidence: ${result.summary.flowsByConfidence.high}`);
 * console.log(`Detected in ${result.metadata.durationMs}ms`);
 * ```
 */
export function detectAndAnalyzeTfHelmFlows(
  workflow: unknown,
  options?: TfHelmDetectorOptions,
  workflowFile?: string
): TfHelmDetectionResult {
  const detector = createTfHelmDetector(workflow, options, workflowFile);
  return detector.detectWithAnalysis();
}
