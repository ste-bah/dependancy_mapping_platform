/**
 * GitHub Actions Output Flow Detector
 * @module parsers/github-actions/output-flow-detector
 *
 * Detects data flows through output references in GitHub Actions workflows.
 * Tracks how outputs from one job or step are consumed by another,
 * including special handling for Terraform-to-Helm data flows.
 *
 * TASK-XREF-001: GitHub Actions Parser - Output Flow Detection
 * TASK-GHA-004: Cross-job dependency tracking
 */

import {
  GhaWorkflow,
  GhaJob,
  GhaStep,
  GhaExpression,
  GhaExpressionContext,
  isGhaRunStep,
  isGhaUsesStep,
  TerraformStepInfo,
  HelmStepInfo,
} from './types';
import {
  GhaExpressionParser,
  extractExpressionsFromContent,
} from './expression-parser';
import { GhaToolDetector } from './tool-detector';

// ============================================================================
// Types
// ============================================================================

/**
 * Flow types that can be detected
 */
export type OutputFlowType =
  | 'job_output'          // Job outputs consumed via needs.jobId.outputs.name
  | 'step_output'         // Step outputs consumed via steps.stepId.outputs.name
  | 'terraform_to_helm'   // Special case: Terraform outputs flowing to Helm
  | 'env_propagation';    // Environment variable propagation via outputs

/**
 * Represents a detected output flow between workflow components
 */
export interface OutputFlow {
  /** Unique identifier for this flow */
  readonly id: string;
  /** Source job ID that produces the output */
  readonly sourceJob: string;
  /** Source step ID (if flow originates from a step) */
  readonly sourceStep?: string;
  /** Name of the output being produced */
  readonly sourceOutput: string;
  /** Target job ID that consumes the output */
  readonly targetJob: string;
  /** Target step ID (if flow is consumed by a specific step) */
  readonly targetStep?: string;
  /** Name/key used to consume the output */
  readonly targetInput: string;
  /** Classification of the flow type */
  readonly flowType: OutputFlowType;
  /** Confidence score (0-1) for this detection */
  readonly confidence: number;
  /** Evidence supporting this flow detection */
  readonly evidence: OutputFlowEvidence;
}

/**
 * Evidence for an output flow detection
 */
export interface OutputFlowEvidence {
  /** Location where output is defined (if detectable) */
  readonly sourceLocation?: {
    readonly line: number;
    readonly snippet: string;
  };
  /** Location where output is consumed */
  readonly targetLocation: {
    readonly line: number;
    readonly snippet: string;
  };
}

/**
 * Options for output flow detection
 */
export interface OutputFlowDetectorOptions {
  /** Minimum confidence threshold (0-1) for including flows */
  readonly minConfidence?: number;
  /** Include Terraform-to-Helm flow detection */
  readonly detectTerraformToHelm?: boolean;
  /** Include environment propagation detection */
  readonly detectEnvPropagation?: boolean;
}

/**
 * Default options for output flow detection
 */
const DEFAULT_OPTIONS: Required<OutputFlowDetectorOptions> = {
  minConfidence: 0.5,
  detectTerraformToHelm: true,
  detectEnvPropagation: true,
};

// ============================================================================
// OutputFlowDetector Class
// ============================================================================

/**
 * Detects data flows through output references in GitHub Actions workflows.
 *
 * Analyzes workflow files to identify:
 * - Job-to-job output flows via `needs.jobId.outputs.outputName`
 * - Step-to-step output flows via `steps.stepId.outputs.outputName`
 * - Terraform output to Helm input patterns
 * - Environment variable propagation through outputs
 *
 * @example
 * ```typescript
 * const detector = new OutputFlowDetector(parsedWorkflow);
 * const flows = detector.detectFlows();
 *
 * for (const flow of flows) {
 *   console.log(`Flow: ${flow.sourceJob} -> ${flow.targetJob} (${flow.flowType})`);
 * }
 * ```
 */
export class OutputFlowDetector {
  private readonly workflow: GhaWorkflow;
  private readonly options: Required<OutputFlowDetectorOptions>;
  private readonly expressionParser: GhaExpressionParser;
  private readonly toolDetector: GhaToolDetector;

  /**
   * Creates a new OutputFlowDetector instance
   *
   * @param workflow - Parsed GitHub Actions workflow to analyze
   * @param options - Detection options
   */
  constructor(workflow: GhaWorkflow, options: OutputFlowDetectorOptions = {}) {
    this.workflow = workflow;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.expressionParser = new GhaExpressionParser();
    this.toolDetector = new GhaToolDetector();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Detect all output flows in the workflow
   *
   * @returns Array of detected output flows
   */
  detectFlows(): OutputFlow[] {
    const flows: OutputFlow[] = [];

    // Iterate over all jobs
    for (const [jobId, job] of this.workflow.jobs) {
      // Analyze each step for output references
      for (let stepIndex = 0; stepIndex < job.steps.length; stepIndex++) {
        const step = job.steps[stepIndex];
        const stepFlows = this.analyzeStepForFlows(job, jobId, step, stepIndex);
        flows.push(...stepFlows);
      }

      // Analyze job-level configurations
      const jobFlows = this.analyzeJobForFlows(job, jobId);
      flows.push(...jobFlows);
    }

    // Detect Terraform -> Helm flows if enabled
    if (this.options.detectTerraformToHelm) {
      const tfHelmFlows = this.detectTerraformToHelmFlows();
      flows.push(...tfHelmFlows);
    }

    // Filter by confidence threshold and deduplicate
    return this.deduplicateFlows(
      flows.filter(flow => flow.confidence >= this.options.minConfidence)
    );
  }

  /**
   * Detect flows from a specific job
   *
   * @param jobId - Job ID to analyze
   * @returns Array of detected output flows for this job
   */
  detectFlowsForJob(jobId: string): OutputFlow[] {
    const job = this.workflow.jobs.get(jobId);
    if (!job) {
      return [];
    }

    const flows: OutputFlow[] = [];

    // Analyze steps
    for (let stepIndex = 0; stepIndex < job.steps.length; stepIndex++) {
      const step = job.steps[stepIndex];
      const stepFlows = this.analyzeStepForFlows(job, jobId, step, stepIndex);
      flows.push(...stepFlows);
    }

    // Analyze job-level
    const jobFlows = this.analyzeJobForFlows(job, jobId);
    flows.push(...jobFlows);

    return flows.filter(flow => flow.confidence >= this.options.minConfidence);
  }

  /**
   * Get flows that produce outputs consumed by a specific job
   *
   * @param targetJobId - Job ID that consumes outputs
   * @returns Array of flows into this job
   */
  getInboundFlows(targetJobId: string): OutputFlow[] {
    return this.detectFlows().filter(flow => flow.targetJob === targetJobId);
  }

  /**
   * Get flows that consume outputs from a specific job
   *
   * @param sourceJobId - Job ID that produces outputs
   * @returns Array of flows from this job
   */
  getOutboundFlows(sourceJobId: string): OutputFlow[] {
    return this.detectFlows().filter(flow => flow.sourceJob === sourceJobId);
  }

  // ==========================================================================
  // Private - Step Analysis
  // ==========================================================================

  /**
   * Analyze a step for output references
   */
  private analyzeStepForFlows(
    job: GhaJob,
    jobId: string,
    step: GhaStep,
    stepIndex: number
  ): OutputFlow[] {
    const flows: OutputFlow[] = [];
    const stepContent = this.getStepContent(step);
    const stepId = step.id ?? `step-${stepIndex}`;
    const expressions = this.expressionParser.extractExpressions(stepContent);

    for (const expr of expressions) {
      // Check for needs.*.outputs.* references
      for (const ref of expr.contextReferences) {
        if (ref.context === 'needs' && ref.path.length >= 2) {
          const flow = this.parseNeedsReference(ref, expr, jobId, stepId, step);
          if (flow) flows.push(flow);
        } else if (ref.context === 'steps' && ref.path.length >= 2) {
          const flow = this.parseStepsReference(ref, expr, jobId, stepId, step);
          if (flow) flows.push(flow);
        }
      }
    }

    return flows;
  }

  /**
   * Parse a needs.jobId.outputs.outputName reference
   */
  private parseNeedsReference(
    ref: { context: GhaExpressionContext; path: readonly string[]; fullPath: string },
    expr: GhaExpression,
    targetJobId: string,
    targetStepId: string,
    step: GhaStep
  ): OutputFlow | null {
    // Expected path: ['jobId', 'outputs', 'outputName']
    const path = ref.path;
    if (path.length < 3) return null;

    const sourceJobId = path[0];
    if (path[1] !== 'outputs') return null;
    const outputName = path[2];

    return {
      id: `flow_needs_${targetJobId}_${targetStepId}_${sourceJobId}_${outputName}`,
      sourceJob: sourceJobId,
      sourceOutput: outputName,
      targetJob: targetJobId,
      targetStep: targetStepId,
      targetInput: outputName,
      flowType: 'job_output',
      confidence: 0.95,
      evidence: {
        targetLocation: {
          line: step.location.lineStart,
          snippet: expr.raw,
        },
      },
    };
  }

  /**
   * Parse a steps.stepId.outputs.outputName reference
   */
  private parseStepsReference(
    ref: { context: GhaExpressionContext; path: readonly string[]; fullPath: string },
    expr: GhaExpression,
    targetJobId: string,
    targetStepId: string,
    step: GhaStep
  ): OutputFlow | null {
    // Expected path: ['stepId', 'outputs', 'outputName']
    const path = ref.path;
    if (path.length < 3) return null;

    const sourceStepId = path[0];
    if (path[1] !== 'outputs') return null;
    const outputName = path[2];

    return {
      id: `flow_steps_${targetJobId}_${targetStepId}_${sourceStepId}_${outputName}`,
      sourceJob: targetJobId, // Same job for step references
      sourceStep: sourceStepId,
      sourceOutput: outputName,
      targetJob: targetJobId,
      targetStep: targetStepId,
      targetInput: outputName,
      flowType: 'step_output',
      confidence: 0.95,
      evidence: {
        targetLocation: {
          line: step.location.lineStart,
          snippet: expr.raw,
        },
      },
    };
  }

  // ==========================================================================
  // Private - Job Analysis
  // ==========================================================================

  /**
   * Analyze job-level configurations for flows
   */
  private analyzeJobForFlows(job: GhaJob, jobId: string): OutputFlow[] {
    const flows: OutputFlow[] = [];

    // Check job outputs for references to step outputs
    if (job.outputs) {
      for (const [outputName, outputValue] of Object.entries(job.outputs)) {
        const expressions = this.expressionParser.extractExpressions(outputValue);

        for (const expr of expressions) {
          for (const ref of expr.contextReferences) {
            if (ref.context === 'steps' && ref.path.length >= 2) {
              const stepId = ref.path[0];
              const stepOutputName = ref.path.length >= 3 && ref.path[1] === 'outputs'
                ? ref.path[2]
                : ref.path[1];

              flows.push({
                id: `flow_${jobId}_output_${outputName}`,
                sourceJob: jobId,
                sourceStep: stepId,
                sourceOutput: stepOutputName,
                targetJob: jobId,
                targetInput: outputName,
                flowType: 'step_output',
                confidence: 0.95,
                evidence: {
                  targetLocation: {
                    line: job.location.lineStart,
                    snippet: `${outputName}: \${{ ${expr.content} }}`,
                  },
                },
              });
            }
          }
        }
      }
    }

    // Check job env for needs references
    if (this.options.detectEnvPropagation && job.env) {
      for (const [envName, envValue] of Object.entries(job.env)) {
        if (typeof envValue === 'string') {
          const expressions = this.expressionParser.extractExpressions(envValue);

          for (const expr of expressions) {
            for (const ref of expr.contextReferences) {
              if (ref.context === 'needs' && ref.path.length >= 3) {
                const sourceJobId = ref.path[0];
                if (ref.path[1] === 'outputs') {
                  const outputName = ref.path[2];

                  flows.push({
                    id: `flow_${jobId}_env_${envName}`,
                    sourceJob: sourceJobId,
                    sourceOutput: outputName,
                    targetJob: jobId,
                    targetInput: envName,
                    flowType: 'env_propagation',
                    confidence: 0.9,
                    evidence: {
                      targetLocation: {
                        line: job.location.lineStart,
                        snippet: `${envName}: \${{ ${expr.content} }}`,
                      },
                    },
                  });
                }
              }
            }
          }
        }
      }
    }

    return flows;
  }

  // ==========================================================================
  // Private - Terraform to Helm Flow Detection
  // ==========================================================================

  /**
   * Detect flows from Terraform outputs to Helm inputs
   */
  private detectTerraformToHelmFlows(): OutputFlow[] {
    const flows: OutputFlow[] = [];

    // Identify jobs with Terraform steps
    const tfJobMap = new Map<string, { job: GhaJob; tfSteps: TerraformStepInfo[] }>();

    for (const [jobId, job] of this.workflow.jobs) {
      const tfSteps = this.toolDetector.detectTerraformSteps(job.steps, jobId);
      if (tfSteps.length > 0) {
        tfJobMap.set(jobId, { job, tfSteps });
      }
    }

    // If no TF jobs, no TF->Helm flows possible
    if (tfJobMap.size === 0) return flows;

    // Find jobs with Helm that depend on TF jobs
    for (const [jobId, job] of this.workflow.jobs) {
      const helmSteps = this.toolDetector.detectHelmSteps(job.steps, jobId);
      if (helmSteps.length === 0) continue;

      // Check if this job depends on any TF job
      for (const neededJobId of job.needs) {
        const tfJobData = tfJobMap.get(neededJobId);
        if (!tfJobData) continue;

        // Look for TF output references in Helm steps
        for (const helmStep of helmSteps) {
          const step = job.steps[helmStep.stepIndex];
          const stepContent = this.getStepContent(step);
          const expressions = this.expressionParser.extractExpressions(stepContent);

          for (const expr of expressions) {
            for (const ref of expr.contextReferences) {
              if (ref.context === 'needs' && ref.path[0] === neededJobId) {
                // This is a reference to the TF job's outputs
                if (ref.path.length >= 3 && ref.path[1] === 'outputs') {
                  const outputName = ref.path[2];

                  flows.push({
                    id: `flow_tf_helm_${neededJobId}_${jobId}_${outputName}`,
                    sourceJob: neededJobId,
                    sourceOutput: outputName,
                    targetJob: jobId,
                    targetStep: helmStep.stepId ?? `step-${helmStep.stepIndex}`,
                    targetInput: outputName,
                    flowType: 'terraform_to_helm',
                    confidence: 0.85,
                    evidence: {
                      targetLocation: {
                        line: step.location.lineStart,
                        snippet: expr.raw,
                      },
                    },
                  });
                }
              }
            }
          }
        }
      }
    }

    return flows;
  }

  // ==========================================================================
  // Private - Utilities
  // ==========================================================================

  /**
   * Get searchable content from a step
   */
  private getStepContent(step: GhaStep): string {
    const parts: string[] = [];

    if (isGhaRunStep(step)) {
      parts.push(step.run);
    } else if (isGhaUsesStep(step)) {
      parts.push(step.uses);
      if (step.with) {
        parts.push(JSON.stringify(step.with));
      }
    }

    if (step.env) {
      parts.push(JSON.stringify(step.env));
    }

    if (step.if) {
      parts.push(step.if);
    }

    return parts.join(' ');
  }

  /**
   * Remove duplicate flows (same source and target)
   */
  private deduplicateFlows(flows: OutputFlow[]): OutputFlow[] {
    const seen = new Map<string, OutputFlow>();

    for (const flow of flows) {
      const existing = seen.get(flow.id);
      if (!existing || flow.confidence > existing.confidence) {
        seen.set(flow.id, flow);
      }
    }

    return Array.from(seen.values());
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new OutputFlowDetector instance
 *
 * @param workflow - Parsed GitHub Actions workflow
 * @param options - Detection options
 * @returns New OutputFlowDetector instance
 */
export function createOutputFlowDetector(
  workflow: GhaWorkflow,
  options?: OutputFlowDetectorOptions
): OutputFlowDetector {
  return new OutputFlowDetector(workflow, options);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Detect output flows in a workflow using default options
 *
 * @param workflow - Parsed GitHub Actions workflow
 * @returns Array of detected output flows
 *
 * @example
 * ```typescript
 * const flows = detectOutputFlows(parsedWorkflow);
 * console.log(`Found ${flows.length} data flows`);
 * ```
 */
export function detectOutputFlows(workflow: GhaWorkflow): OutputFlow[] {
  const detector = new OutputFlowDetector(workflow);
  return detector.detectFlows();
}

/**
 * Get a summary of output flows by type
 *
 * @param flows - Array of output flows
 * @returns Summary object with counts by type
 */
export function summarizeFlows(
  flows: readonly OutputFlow[]
): Record<OutputFlowType, number> {
  const summary: Record<OutputFlowType, number> = {
    job_output: 0,
    step_output: 0,
    terraform_to_helm: 0,
    env_propagation: 0,
  };

  for (const flow of flows) {
    summary[flow.flowType]++;
  }

  return summary;
}

/**
 * Check if a job has any inbound flows
 *
 * @param workflow - Parsed GitHub Actions workflow
 * @param jobId - Job ID to check
 * @returns True if job has inbound flows
 */
export function hasInboundFlows(workflow: GhaWorkflow, jobId: string): boolean {
  const detector = new OutputFlowDetector(workflow);
  return detector.getInboundFlows(jobId).length > 0;
}

/**
 * Check if a job has any outbound flows
 *
 * @param workflow - Parsed GitHub Actions workflow
 * @param jobId - Job ID to check
 * @returns True if job has outbound flows
 */
export function hasOutboundFlows(workflow: GhaWorkflow, jobId: string): boolean {
  const detector = new OutputFlowDetector(workflow);
  return detector.getOutboundFlows(jobId).length > 0;
}

/**
 * Build a flow graph showing connections between jobs
 *
 * @param flows - Array of detected flows
 * @returns Map from source job to array of target jobs
 */
export function buildFlowGraph(
  flows: readonly OutputFlow[]
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const flow of flows) {
    let targets = graph.get(flow.sourceJob);
    if (!targets) {
      targets = new Set();
      graph.set(flow.sourceJob, targets);
    }
    targets.add(flow.targetJob);
  }

  return graph;
}

// ============================================================================
// Type Exports
// ============================================================================

export type { OutputFlowDetectorOptions };
