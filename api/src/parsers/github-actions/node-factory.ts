/**
 * GitHub Actions Node Factory
 * @module parsers/github-actions/node-factory
 *
 * Factory for creating GitHub Actions graph nodes from parsed workflow data.
 * Transforms parsed GhaWorkflow and GhaJob structures into GhaWorkflowNode
 * and GhaJobNode instances for the dependency graph.
 *
 * TASK-XREF-001: GitHub Actions Parser - Node Factory
 * TASK-GHA-001: Workflow structure graph building
 * TASK-GHA-002: Job node creation with tool detection
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GhaWorkflow,
  GhaJob,
  GhaStep,
  GhaWorkflowNode,
  GhaJobNode,
  GhaStepNode,
  GhaNodeFactoryOptions,
  isGhaScheduleTrigger,
  isGhaWorkflowDispatchTrigger,
  isGhaWorkflowCallTrigger,
  isGhaRunStep,
  isGhaUsesStep,
  TerraformStepInfo,
  HelmStepInfo,
} from './types.js';
import { NodeLocation } from '../../types/graph.js';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Result of creating all nodes for a workflow
 */
export interface WorkflowNodeCreationResult {
  /** The workflow node */
  readonly workflowNode: GhaWorkflowNode;
  /** All job nodes */
  readonly jobNodes: readonly GhaJobNode[];
  /** All step nodes (optional, based on factory options) */
  readonly stepNodes: readonly GhaStepNode[];
}

/**
 * Internal context for node creation
 */
interface NodeCreationContext {
  readonly scanId: string;
  readonly repositoryRoot: string;
  readonly idGenerator: () => string;
  readonly includeRaw: boolean;
  readonly computeToolInfo: boolean;
}

// ============================================================================
// Default Options
// ============================================================================

/**
 * Default factory options
 */
const DEFAULT_FACTORY_OPTIONS: Required<GhaNodeFactoryOptions> = {
  scanId: '',
  repositoryRoot: '',
  idGenerator: () => uuidv4(),
  includeRaw: false,
  computeToolInfo: true,
};

// ============================================================================
// GhaNodeFactory Class
// ============================================================================

/**
 * Factory for creating GitHub Actions graph nodes.
 *
 * Creates typed graph nodes from parsed workflow data, supporting:
 * - Workflow nodes with trigger and job metadata
 * - Job nodes with runner, dependencies, and tool detection info
 * - Step nodes with action references and tool usage
 *
 * @example
 * ```typescript
 * const factory = new GhaNodeFactory({
 *   scanId: 'scan-123',
 *   repositoryRoot: '/repo',
 * });
 *
 * const { workflowNode, jobNodes } = factory.createNodesForWorkflow(
 *   parsedWorkflow,
 *   '.github/workflows/ci.yml'
 * );
 * ```
 */
export class GhaNodeFactory {
  private readonly context: NodeCreationContext;

  /**
   * Creates a new GhaNodeFactory
   * @param options - Factory options including scanId and repositoryRoot
   */
  constructor(options: GhaNodeFactoryOptions) {
    const mergedOptions = { ...DEFAULT_FACTORY_OPTIONS, ...options };

    this.context = {
      scanId: mergedOptions.scanId,
      repositoryRoot: mergedOptions.repositoryRoot,
      idGenerator: mergedOptions.idGenerator ?? DEFAULT_FACTORY_OPTIONS.idGenerator,
      includeRaw: mergedOptions.includeRaw ?? false,
      computeToolInfo: mergedOptions.computeToolInfo ?? true,
    };
  }

  // ============================================================================
  // Public API - Workflow Node Creation
  // ============================================================================

  /**
   * Create a workflow node from parsed workflow data
   *
   * @param workflow - Parsed workflow data
   * @param filePath - Path to the workflow file
   * @returns GhaWorkflowNode for the dependency graph
   *
   * @example
   * ```typescript
   * const workflowNode = factory.createWorkflowNode(workflow, '.github/workflows/ci.yml');
   * ```
   */
  createWorkflowNode(workflow: GhaWorkflow, filePath: string): GhaWorkflowNode {
    const nodeId = `gha_workflow_${this.context.idGenerator()}`;

    // Extract trigger types
    const triggerTypes = workflow.triggers.map(t => t.type);

    // Check for specific trigger characteristics
    const hasManualTrigger = workflow.triggers.some(t =>
      isGhaWorkflowDispatchTrigger(t)
    );

    const isReusable = workflow.triggers.some(t =>
      isGhaWorkflowCallTrigger(t)
    );

    // Extract schedule cron expressions
    const schedules = workflow.triggers
      .filter(isGhaScheduleTrigger)
      .flatMap(t => t.cron);

    // Check for secrets usage
    const hasSecrets = this.detectSecretsUsage(workflow);

    // Calculate line count for location
    const lineEnd = this.estimateWorkflowLineEnd(workflow);

    const location: NodeLocation = {
      file: filePath,
      lineStart: workflow.location.lineStart,
      lineEnd,
      columnStart: workflow.location.columnStart,
      columnEnd: workflow.location.columnEnd,
    };

    return {
      id: nodeId,
      name: workflow.name,
      type: 'gha_workflow',
      location,
      metadata: {
        scanId: this.context.scanId,
        workflowFileName: this.extractFileName(filePath),
        triggerTypes,
        envVarCount: Object.keys(workflow.env).length,
        permissions: workflow.permissions,
        concurrency: workflow.concurrency,
        defaults: workflow.defaults,
      },
      triggers: triggerTypes,
      jobCount: workflow.jobs.size,
      hasSecrets,
      hasManualTrigger,
      isReusable,
      schedules,
    };
  }

  // ============================================================================
  // Public API - Job Node Creation
  // ============================================================================

  /**
   * Create a job node from parsed job data
   *
   * @param job - Parsed job data
   * @param workflowId - ID of the parent workflow node
   * @param filePath - Path to the workflow file
   * @param terraformSteps - Optional pre-detected Terraform steps
   * @param helmSteps - Optional pre-detected Helm steps
   * @returns GhaJobNode for the dependency graph
   *
   * @example
   * ```typescript
   * const jobNode = factory.createJobNode(
   *   job,
   *   workflowNode.id,
   *   '.github/workflows/ci.yml'
   * );
   * ```
   */
  createJobNode(
    job: GhaJob,
    workflowId: string,
    filePath: string,
    terraformSteps?: readonly TerraformStepInfo[],
    helmSteps?: readonly HelmStepInfo[]
  ): GhaJobNode {
    const nodeId = `gha_job_${this.context.idGenerator()}`;

    // Normalize runsOn to a single string for display
    const runsOn: string = Array.isArray(job.runsOn)
      ? (job.runsOn as readonly string[]).join(', ')
      : (job.runsOn as string);

    // Detect Terraform/Helm usage if not provided
    let hasTerraform = false;
    let hasHelm = false;

    if (this.context.computeToolInfo) {
      if (terraformSteps) {
        hasTerraform = terraformSteps.some(s => s.jobId === job.id);
      } else {
        hasTerraform = this.detectTerraformInJob(job);
      }

      if (helmSteps) {
        hasHelm = helmSteps.some(s => s.jobId === job.id);
      } else {
        hasHelm = this.detectHelmInJob(job);
      }
    }

    // Check for matrix strategy
    const hasMatrix = job.strategy?.matrix !== undefined;

    // Check for container usage
    const hasContainer = job.container !== undefined;

    // Extract environment name
    const environment = job.environment?.name;

    const location: NodeLocation = {
      file: filePath,
      lineStart: job.location.lineStart,
      lineEnd: job.location.lineEnd,
      columnStart: job.location.columnStart,
      columnEnd: job.location.columnEnd,
    };

    return {
      id: nodeId,
      name: job.name ?? job.id,
      type: 'gha_job',
      location,
      metadata: {
        scanId: this.context.scanId,
        jobId: job.id,
        workflowNodeId: workflowId,
        runsOnRaw: job.runsOn,
        needs: job.needs,
        outputNames: Object.keys(job.outputs),
        outputCount: Object.keys(job.outputs).length,
        envVarCount: Object.keys(job.env).length,
        condition: job.if,
        timeoutMinutes: job.timeoutMinutes,
        continueOnError: job.continueOnError,
        services: job.services ? Object.keys(job.services) : [],
        permissions: job.permissions,
        concurrency: job.concurrency,
        matrixDimensions: job.strategy?.matrix?.dimensions
          ? Object.keys(job.strategy.matrix.dimensions)
          : [],
      },
      workflowId,
      runsOn,
      needsCount: job.needs.length,
      stepCount: job.steps.length,
      hasTerraform,
      hasHelm,
      hasMatrix,
      hasContainer,
      environment,
    };
  }

  // ============================================================================
  // Public API - Step Node Creation
  // ============================================================================

  /**
   * Create a step node from parsed step data
   *
   * @param step - Parsed step data
   * @param jobId - ID of the parent job node
   * @param workflowId - ID of the parent workflow node
   * @param filePath - Path to the workflow file
   * @param stepIndex - Index of the step in the job
   * @returns GhaStepNode for the dependency graph
   */
  createStepNode(
    step: GhaStep,
    jobId: string,
    workflowId: string,
    filePath: string,
    stepIndex: number
  ): GhaStepNode {
    const nodeId = `gha_step_${this.context.idGenerator()}`;

    const stepType = step.type;
    const action = isGhaUsesStep(step) ? step.uses : undefined;

    // Detect tool usage
    const isTerraform = this.detectTerraformInStep(step);
    const isHelm = this.detectHelmInStep(step);

    const location: NodeLocation = {
      file: filePath,
      lineStart: step.location.lineStart,
      lineEnd: step.location.lineEnd,
      columnStart: step.location.columnStart,
      columnEnd: step.location.columnEnd,
    };

    return {
      id: nodeId,
      name: step.name ?? step.id ?? `Step ${stepIndex + 1}`,
      type: 'gha_step',
      location,
      metadata: {
        scanId: this.context.scanId,
        stepIndex,
        stepId: step.id,
        condition: step.if,
        envVarCount: step.env ? Object.keys(step.env).length : 0,
        timeoutMinutes: step.timeoutMinutes,
        continueOnError: step.continueOnError,
        workingDirectory: step.workingDirectory,
      },
      jobId,
      workflowId,
      stepType,
      action,
      isTerraform,
      isHelm,
    };
  }

  // ============================================================================
  // Public API - Batch Node Creation
  // ============================================================================

  /**
   * Create all nodes for a workflow (workflow + jobs + optionally steps)
   *
   * @param workflow - Parsed workflow data
   * @param filePath - Path to the workflow file
   * @param options - Additional options for node creation
   * @returns Object containing workflowNode, jobNodes, and stepNodes
   *
   * @example
   * ```typescript
   * const { workflowNode, jobNodes, stepNodes } = factory.createNodesForWorkflow(
   *   parsedWorkflow,
   *   '.github/workflows/ci.yml',
   *   { includeStepNodes: true }
   * );
   * ```
   */
  createNodesForWorkflow(
    workflow: GhaWorkflow,
    filePath: string,
    options?: { includeStepNodes?: boolean; terraformSteps?: readonly TerraformStepInfo[]; helmSteps?: readonly HelmStepInfo[] }
  ): WorkflowNodeCreationResult {
    const workflowNode = this.createWorkflowNode(workflow, filePath);

    const jobNodes: GhaJobNode[] = [];
    const stepNodes: GhaStepNode[] = [];

    for (const [_jobId, job] of workflow.jobs) {
      const jobNode = this.createJobNode(
        job,
        workflowNode.id,
        filePath,
        options?.terraformSteps,
        options?.helmSteps
      );
      jobNodes.push(jobNode);

      // Optionally create step nodes
      if (options?.includeStepNodes) {
        job.steps.forEach((step: GhaStep, index: number) => {
          const stepNode = this.createStepNode(
            step,
            jobNode.id,
            workflowNode.id,
            filePath,
            index
          );
          stepNodes.push(stepNode);
        });
      }
    }

    return {
      workflowNode,
      jobNodes,
      stepNodes,
    };
  }

  /**
   * Create job nodes for all jobs in a workflow
   *
   * @param jobs - Map of job ID to job data
   * @param workflowId - ID of the parent workflow node
   * @param filePath - Path to the workflow file
   * @returns Array of GhaJobNode instances
   */
  createJobNodes(
    jobs: ReadonlyMap<string, GhaJob>,
    workflowId: string,
    filePath: string
  ): GhaJobNode[] {
    const jobNodes: GhaJobNode[] = [];

    for (const [_jobId, job] of jobs) {
      const jobNode = this.createJobNode(job, workflowId, filePath);
      jobNodes.push(jobNode);
    }

    return jobNodes;
  }

  // ============================================================================
  // Private - Tool Detection Helpers
  // ============================================================================

  /**
   * Quick detection of Terraform usage in a job
   */
  private detectTerraformInJob(job: GhaJob): boolean {
    return job.steps.some((step: GhaStep) => this.detectTerraformInStep(step));
  }

  /**
   * Quick detection of Helm usage in a job
   */
  private detectHelmInJob(job: GhaJob): boolean {
    return job.steps.some((step: GhaStep) => this.detectHelmInStep(step));
  }

  /**
   * Quick detection of Terraform usage in a step
   */
  private detectTerraformInStep(step: GhaStep): boolean {
    if (isGhaUsesStep(step)) {
      const uses = step.uses.toLowerCase();
      return (
        uses.includes('terraform') ||
        uses.includes('terragrunt') ||
        uses.includes('hashicorp/setup-terraform') ||
        uses.includes('hashicorp/tfc-')
      );
    }

    if (isGhaRunStep(step)) {
      const run = step.run.toLowerCase();
      return (
        /\bterraform\s+/i.test(run) ||
        /\bterragrunt\s+/i.test(run) ||
        /\btf\s+(init|plan|apply|destroy)\b/i.test(run)
      );
    }

    return false;
  }

  /**
   * Quick detection of Helm usage in a step
   */
  private detectHelmInStep(step: GhaStep): boolean {
    if (isGhaUsesStep(step)) {
      const uses = step.uses.toLowerCase();
      return (
        uses.includes('helm') ||
        uses.includes('k8s-bake') ||
        uses.includes('deliverybot')
      );
    }

    if (isGhaRunStep(step)) {
      const run = step.run.toLowerCase();
      return run.includes('helm') || run.includes('helmfile');
    }

    return false;
  }

  /**
   * Detect secrets usage in workflow
   */
  private detectSecretsUsage(workflow: GhaWorkflow): boolean {
    // Check workflow-level env for secrets
    const workflowEnvValues = Object.values(workflow.env) as string[];
    for (const value of workflowEnvValues) {
      if (value.includes('secrets.')) {
        return true;
      }
    }

    // Check job-level and step-level env
    for (const [_jobId, job] of workflow.jobs) {
      const jobEnvValues = Object.values(job.env) as string[];
      for (const value of jobEnvValues) {
        if (value.includes('secrets.')) {
          return true;
        }
      }

      for (const step of job.steps) {
        if (step.env) {
          const stepEnvValues = Object.values(step.env) as string[];
          for (const value of stepEnvValues) {
            if (value.includes('secrets.')) {
              return true;
            }
          }
        }

        // Check uses step with inputs
        if (isGhaUsesStep(step) && step.with) {
          const withValues = Object.values(step.with) as (string | number | boolean)[];
          for (const value of withValues) {
            if (typeof value === 'string' && value.includes('secrets.')) {
              return true;
            }
          }
        }

        // Check run step content
        if (isGhaRunStep(step) && step.run.includes('secrets.')) {
          return true;
        }
      }
    }

    return false;
  }

  // ============================================================================
  // Private - Utility Methods
  // ============================================================================

  /**
   * Extract filename from path
   */
  private extractFileName(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] ?? filePath;
  }

  /**
   * Estimate workflow line end based on content
   */
  private estimateWorkflowLineEnd(workflow: GhaWorkflow): number {
    // Start with base workflow structure lines
    let lines = workflow.location.lineStart + 5; // name, on, etc.

    // Add lines for triggers
    lines += workflow.triggers.length * 3;

    // Add lines for env vars
    lines += Object.keys(workflow.env).length * 1;

    // Add lines for jobs
    for (const [_jobId, job] of workflow.jobs) {
      lines += 5; // Job header
      lines += job.needs.length * 1;
      lines += Object.keys(job.env).length * 1;
      lines += job.steps.length * 5;
    }

    return lines;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a GhaNodeFactory with the given options
 *
 * @param options - Factory options
 * @returns New GhaNodeFactory instance
 *
 * @example
 * ```typescript
 * const factory = createNodeFactory({ scanId: 'scan-123' });
 * ```
 */
export function createNodeFactory(options: GhaNodeFactoryOptions): GhaNodeFactory {
  return new GhaNodeFactory(options);
}

/**
 * Convenience function for one-off node creation from a workflow
 *
 * @param workflow - Parsed workflow data
 * @param filePath - Path to the workflow file
 * @param scanId - Scan ID for tracking
 * @param repositoryRoot - Repository root path
 * @returns Object containing workflowNode, jobNodes, and stepNodes
 *
 * @example
 * ```typescript
 * const { workflowNode, jobNodes } = createGhaNodes(
 *   parsedWorkflow,
 *   '.github/workflows/ci.yml',
 *   'scan-123',
 *   '/repo'
 * );
 * ```
 */
export function createGhaNodes(
  workflow: GhaWorkflow,
  filePath: string,
  scanId: string,
  repositoryRoot: string = ''
): WorkflowNodeCreationResult {
  const factory = new GhaNodeFactory({ scanId, repositoryRoot });
  return factory.createNodesForWorkflow(workflow, filePath);
}

/**
 * Create a single workflow node
 *
 * @param workflow - Parsed workflow data
 * @param filePath - Path to the workflow file
 * @param scanId - Scan ID for tracking
 * @returns GhaWorkflowNode for the dependency graph
 */
export function createGhaWorkflowNode(
  workflow: GhaWorkflow,
  filePath: string,
  scanId: string
): GhaWorkflowNode {
  const factory = new GhaNodeFactory({ scanId, repositoryRoot: '' });
  return factory.createWorkflowNode(workflow, filePath);
}

/**
 * Create a single job node
 *
 * @param job - Parsed job data
 * @param workflowId - ID of the parent workflow node
 * @param filePath - Path to the workflow file
 * @param scanId - Scan ID for tracking
 * @returns GhaJobNode for the dependency graph
 */
export function createGhaJobNode(
  job: GhaJob,
  workflowId: string,
  filePath: string,
  scanId: string
): GhaJobNode {
  const factory = new GhaNodeFactory({ scanId, repositoryRoot: '' });
  return factory.createJobNode(job, workflowId, filePath);
}
