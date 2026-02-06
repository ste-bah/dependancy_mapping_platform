/**
 * GitHub Actions Edge Factory
 * @module parsers/github-actions/edge-factory
 *
 * Factory functions for creating GitHub Actions graph edges
 * from parsed workflow data.
 *
 * TASK-GHA-025: Edge Factory for GHA Graph Edges
 *
 * Supported Edge Types:
 * - GhaNeedsEdge: Job dependency edges (needs:)
 * - GhaUsesTfEdge: Terraform tool usage edges
 * - GhaUsesHelmEdge: Helm tool usage edges
 * - GhaOutputsToEdge: Job output consumption edges
 * - GhaUsesActionEdge: Action usage edges
 *
 * Design Principles:
 * - Pure factory functions with no side effects
 * - Type-safe edge creation with proper validation
 * - Evidence-based confidence scoring
 * - Integration with node factory for complete graph building
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GhaWorkflow,
  GhaJob,
  GhaStep,
  GhaRunStep,
  GhaUsesStep,
  GhaJobNode,
  GhaWorkflowNode,
  GhaStepNode,
  GhaEdge,
  GhaEdgeType,
  GhaEdgeMetadata,
  TerraformStepInfo,
  HelmStepInfo,
  isGhaRunStep,
  isGhaUsesStep,
  GhaEdgeFactoryOptions as BaseEdgeFactoryOptions,
} from './types';
import { NodeLocation, EdgeMetadata, EdgeEvidence } from '../../types/graph';

// ============================================================================
// Edge Type Definitions
// ============================================================================

/**
 * Evidence for edge relationships
 */
export interface GhaEdgeEvidence {
  /** Source file path */
  readonly file: string;
  /** Starting line number */
  readonly lineStart: number;
  /** Ending line number */
  readonly lineEnd: number;
  /** Code snippet showing the relationship */
  readonly snippet: string;
  /** Type of evidence */
  readonly type: 'declaration' | 'tool_invocation' | 'output_reference' | 'action_call';
}

/**
 * Base metadata for all GHA edges
 */
export interface GhaBaseEdgeMetadata extends EdgeMetadata {
  /** Scan ID for association */
  readonly scanId: string;
  /** Tenant ID for multi-tenancy */
  readonly tenantId: string;
  /** When the edge was created */
  readonly createdAt: Date;
}

/**
 * Edge representing a job dependency (needs:)
 */
export interface GhaNeedsEdge extends GhaEdge {
  readonly type: 'gha_needs';
  readonly metadata: GhaBaseEdgeMetadata & {
    /** ID of the dependent job */
    readonly dependentJobId: string;
    /** ID of the dependency job */
    readonly dependencyJobId: string;
    /** Outputs consumed from the dependency */
    readonly outputsConsumed: readonly string[];
  };
  /** Evidence supporting this edge */
  readonly evidence: readonly GhaEdgeEvidence[];
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * Edge representing Terraform tool usage in a job
 */
export interface GhaUsesTfEdge extends GhaEdge {
  readonly type: 'gha_uses_tf';
  readonly metadata: GhaBaseEdgeMetadata & {
    /** Terraform command being run */
    readonly command: string;
    /** Working directory for terraform */
    readonly workingDir?: string;
    /** Terraform variable file */
    readonly varsFile?: string;
    /** Backend configuration */
    readonly backend?: string;
    /** Outputs exported by this step */
    readonly outputsExported?: readonly string[];
    /** Terraform version */
    readonly version?: string;
    /** Action reference if using a Terraform action */
    readonly actionRef?: string;
  };
  /** Evidence supporting this edge */
  readonly evidence: readonly GhaEdgeEvidence[];
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * Edge representing Helm tool usage in a job
 */
export interface GhaUsesHelmEdge extends GhaEdge {
  readonly type: 'gha_uses_helm';
  readonly metadata: GhaBaseEdgeMetadata & {
    /** Helm command being run */
    readonly command: string;
    /** Release name */
    readonly releaseName?: string;
    /** Chart path or reference */
    readonly chartPath?: string;
    /** Target namespace */
    readonly namespace?: string;
    /** Values files used */
    readonly valuesFiles?: readonly string[];
    /** Set values passed via --set */
    readonly setValues?: Readonly<Record<string, string>>;
    /** Helm version */
    readonly version?: string;
    /** Action reference if using a Helm action */
    readonly actionRef?: string;
  };
  /** Evidence supporting this edge */
  readonly evidence: readonly GhaEdgeEvidence[];
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * Edge representing job output consumption
 */
export interface GhaOutputsToEdge extends GhaEdge {
  readonly type: 'gha_outputs_to';
  readonly metadata: GhaBaseEdgeMetadata & {
    /** Name of the output being passed */
    readonly outputName: string;
    /** Expression used to access the output */
    readonly expression: string;
    /** Source job ID */
    readonly sourceJobId: string;
    /** Target job ID */
    readonly targetJobId: string;
  };
  /** Evidence supporting this edge */
  readonly evidence: readonly GhaEdgeEvidence[];
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * Edge representing action usage
 */
export interface GhaUsesActionEdge extends GhaEdge {
  readonly type: 'gha_uses_action';
  readonly metadata: GhaBaseEdgeMetadata & {
    /** Full action reference */
    readonly actionRef: string;
    /** Action owner/org */
    readonly actionOwner: string;
    /** Action repository name */
    readonly actionRepo: string;
    /** Action version/ref */
    readonly actionVersion: string;
    /** Inputs passed to the action */
    readonly inputs: Readonly<Record<string, string | number | boolean>>;
  };
  /** Evidence supporting this edge */
  readonly evidence: readonly GhaEdgeEvidence[];
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * Union type for all GHA-specific edges
 */
export type GhaSpecificEdge =
  | GhaNeedsEdge
  | GhaUsesTfEdge
  | GhaUsesHelmEdge
  | GhaOutputsToEdge
  | GhaUsesActionEdge;

// ============================================================================
// Factory Options
// ============================================================================

/**
 * Extended options for GHA edge factory functions.
 * Extends the base options from types.ts with tenant support.
 */
export interface GhaEdgeFactoryOptions extends BaseEdgeFactoryOptions {
  /** Tenant ID for multi-tenancy */
  readonly tenantId: string;
  /** Default confidence for explicit edges (defaults to 1.0) */
  readonly defaultExplicitConfidence?: number;
  /** Default confidence for inferred edges (defaults to 0.8) */
  readonly defaultInferredConfidence?: number;
}

/**
 * Default factory options
 */
const DEFAULT_EDGE_FACTORY_OPTIONS: Partial<GhaEdgeFactoryOptions> = {
  idGenerator: () => uuidv4(),
  defaultExplicitConfidence: 1.0,
  defaultInferredConfidence: 0.8,
};

// ============================================================================
// Edge Factory Class
// ============================================================================

/**
 * Factory for creating GitHub Actions graph edges.
 *
 * Creates edges representing:
 * - Job dependencies (needs:)
 * - Terraform tool usage
 * - Helm tool usage
 * - Job output flow
 * - Action usage
 *
 * @example
 * ```typescript
 * const factory = new GhaEdgeFactory('scan-123', 'tenant-456');
 * const edges = factory.createEdgesForWorkflow(workflow, jobNodes, filePath);
 * ```
 */
export class GhaEdgeFactory {
  private readonly scanId: string;
  private readonly tenantId: string;
  private readonly idGenerator: () => string;
  private readonly defaultExplicitConfidence: number;
  private readonly defaultInferredConfidence: number;

  constructor(scanId: string, tenantId: string, options?: Partial<GhaEdgeFactoryOptions>) {
    this.scanId = scanId;
    this.tenantId = tenantId;
    this.idGenerator = options?.idGenerator ?? DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator!;
    this.defaultExplicitConfidence = options?.defaultExplicitConfidence ?? DEFAULT_EDGE_FACTORY_OPTIONS.defaultExplicitConfidence!;
    this.defaultInferredConfidence = options?.defaultInferredConfidence ?? DEFAULT_EDGE_FACTORY_OPTIONS.defaultInferredConfidence!;
  }

  // ==========================================================================
  // Main Factory Methods
  // ==========================================================================

  /**
   * Create all edges for a workflow.
   *
   * Analyzes the workflow structure and creates edges for:
   * - Job dependencies (needs:)
   * - Terraform tool usage in steps
   * - Helm tool usage in steps
   * - Job output consumption patterns
   *
   * @param workflow - The parsed workflow
   * @param jobNodes - Job nodes created by node factory
   * @param filePath - Source file path for evidence
   * @returns Array of created edges
   */
  createEdgesForWorkflow(
    workflow: GhaWorkflow,
    jobNodes: readonly GhaJobNode[],
    filePath: string
  ): GhaSpecificEdge[] {
    const edges: GhaSpecificEdge[] = [];

    // Create job ID to node lookup map
    const jobNodeMap = new Map<string, GhaJobNode>();
    for (const node of jobNodes) {
      // Extract job ID from node metadata or name
      const jobId = this.extractJobIdFromNode(node);
      if (jobId) {
        jobNodeMap.set(jobId, node);
      }
    }

    // Process each job for edges
    for (const [jobId, job] of workflow.jobs) {
      const jobNode = jobNodeMap.get(jobId);
      if (!jobNode) continue;

      // Create needs edges (job dependencies)
      for (const neededJobId of job.needs) {
        const neededNode = jobNodeMap.get(neededJobId);
        if (neededNode) {
          edges.push(this.createNeedsEdge(jobNode, neededNode, job, filePath));
        }
      }

      // Create Terraform edges
      const tfEdges = this.createTerraformEdgesForJob(jobNode, job, filePath);
      edges.push(...tfEdges);

      // Create Helm edges
      const helmEdges = this.createHelmEdgesForJob(jobNode, job, filePath);
      edges.push(...helmEdges);

      // Create action usage edges
      const actionEdges = this.createActionEdgesForJob(jobNode, job, filePath);
      edges.push(...actionEdges);
    }

    // Create output flow edges
    const outputEdges = this.createOutputFlowEdges(workflow, jobNodeMap, filePath);
    edges.push(...outputEdges);

    return edges;
  }

  /**
   * Create a GHA_NEEDS edge between dependent jobs.
   *
   * @param dependentJob - The job that has the dependency
   * @param dependencyJob - The job being depended upon
   * @param jobConfig - The original job configuration
   * @param filePath - Source file path for evidence
   * @returns A GhaNeedsEdge
   */
  createNeedsEdge(
    dependentJob: GhaJobNode,
    dependencyJob: GhaJobNode,
    jobConfig: GhaJob,
    filePath: string
  ): GhaNeedsEdge {
    const dependentJobId = this.extractJobIdFromNode(dependentJob) || dependentJob.name;
    const dependencyJobId = this.extractJobIdFromNode(dependencyJob) || dependencyJob.name;

    // Find outputs consumed from the dependency
    const outputsConsumed = this.findConsumedOutputs(jobConfig, dependencyJobId);

    return {
      id: `gha_needs_${this.idGenerator()}`,
      source: dependentJob.id,
      target: dependencyJob.id,
      type: 'gha_needs',
      label: `needs: ${dependencyJobId}`,
      confidence: this.defaultExplicitConfidence, // Explicit declaration
      evidence: [{
        file: filePath,
        lineStart: jobConfig.location.lineStart,
        lineEnd: jobConfig.location.lineStart + 1,
        snippet: `needs: [${dependencyJobId}]`,
        type: 'declaration',
      }],
      metadata: {
        scanId: this.scanId,
        tenantId: this.tenantId,
        createdAt: new Date(),
        implicit: false,
        confidence: 100,
        dependentJobId,
        dependencyJobId,
        outputsConsumed,
      },
    };
  }

  /**
   * Create Terraform usage edges for a job.
   *
   * @param jobNode - The job node
   * @param job - The job configuration
   * @param filePath - Source file path
   * @returns Array of Terraform edges
   */
  createTerraformEdgesForJob(
    jobNode: GhaJobNode,
    job: GhaJob,
    filePath: string
  ): GhaUsesTfEdge[] {
    const edges: GhaUsesTfEdge[] = [];

    for (let stepIndex = 0; stepIndex < job.steps.length; stepIndex++) {
      const step = job.steps[stepIndex];
      const tfInfo = this.detectTerraformInStep(step, stepIndex, job.id);

      if (tfInfo) {
        edges.push(this.createTerraformEdge(jobNode, tfInfo, filePath, step.location?.lineStart));
      }
    }

    return edges;
  }

  /**
   * Create a GHA_USES_TF edge for Terraform usage.
   *
   * @param jobNode - The job node containing the Terraform step
   * @param tfInfo - Detected Terraform step information
   * @param filePath - Source file path
   * @param lineStart - Starting line number (optional)
   * @returns A GhaUsesTfEdge
   */
  createTerraformEdge(
    jobNode: GhaJobNode,
    tfInfo: TerraformStepInfo,
    filePath: string,
    lineStart?: number
  ): GhaUsesTfEdge {
    const startLine = lineStart ?? jobNode.location.lineStart;

    return {
      id: `gha_uses_tf_${this.idGenerator()}`,
      source: jobNode.id,
      target: jobNode.id, // Self-reference; links to external TF resources
      type: 'gha_uses_tf',
      label: `terraform ${tfInfo.command}`,
      confidence: tfInfo.confidence / 100, // Convert 0-100 to 0-1
      evidence: [{
        file: filePath,
        lineStart: startLine,
        lineEnd: startLine + 5,
        snippet: this.createTfSnippet(tfInfo),
        type: 'tool_invocation',
      }],
      metadata: {
        scanId: this.scanId,
        tenantId: this.tenantId,
        createdAt: new Date(),
        implicit: false,
        confidence: tfInfo.confidence,
        command: tfInfo.command,
        workingDir: tfInfo.workingDirectory,
        varsFile: tfInfo.varFiles?.[0],
        backend: tfInfo.backend?.type,
        outputsExported: [],
        version: undefined,
        actionRef: tfInfo.actionRef,
      },
    };
  }

  /**
   * Create Helm usage edges for a job.
   *
   * @param jobNode - The job node
   * @param job - The job configuration
   * @param filePath - Source file path
   * @returns Array of Helm edges
   */
  createHelmEdgesForJob(
    jobNode: GhaJobNode,
    job: GhaJob,
    filePath: string
  ): GhaUsesHelmEdge[] {
    const edges: GhaUsesHelmEdge[] = [];

    for (let stepIndex = 0; stepIndex < job.steps.length; stepIndex++) {
      const step = job.steps[stepIndex];
      const helmInfo = this.detectHelmInStep(step, stepIndex, job.id);

      if (helmInfo) {
        edges.push(this.createHelmEdge(jobNode, helmInfo, filePath, step.location?.lineStart));
      }
    }

    return edges;
  }

  /**
   * Create a GHA_USES_HELM edge for Helm usage.
   *
   * @param jobNode - The job node containing the Helm step
   * @param helmInfo - Detected Helm step information
   * @param filePath - Source file path
   * @param lineStart - Starting line number (optional)
   * @returns A GhaUsesHelmEdge
   */
  createHelmEdge(
    jobNode: GhaJobNode,
    helmInfo: HelmStepInfo,
    filePath: string,
    lineStart?: number
  ): GhaUsesHelmEdge {
    const startLine = lineStart ?? jobNode.location.lineStart;

    return {
      id: `gha_uses_helm_${this.idGenerator()}`,
      source: jobNode.id,
      target: jobNode.id, // Self-reference; links to external Helm charts
      type: 'gha_uses_helm',
      label: `helm ${helmInfo.command}`,
      confidence: helmInfo.confidence / 100, // Convert 0-100 to 0-1
      evidence: [{
        file: filePath,
        lineStart: startLine,
        lineEnd: startLine + 5,
        snippet: this.createHelmSnippet(helmInfo),
        type: 'tool_invocation',
      }],
      metadata: {
        scanId: this.scanId,
        tenantId: this.tenantId,
        createdAt: new Date(),
        implicit: false,
        confidence: helmInfo.confidence,
        command: helmInfo.command,
        releaseName: helmInfo.releaseName,
        chartPath: helmInfo.chartPath || helmInfo.chart,
        namespace: helmInfo.namespace,
        valuesFiles: helmInfo.valuesFiles,
        setValues: helmInfo.setValues,
        version: undefined,
        actionRef: helmInfo.actionRef,
      },
    };
  }

  /**
   * Create action usage edges for a job.
   *
   * @param jobNode - The job node
   * @param job - The job configuration
   * @param filePath - Source file path
   * @returns Array of action edges
   */
  createActionEdgesForJob(
    jobNode: GhaJobNode,
    job: GhaJob,
    filePath: string
  ): GhaUsesActionEdge[] {
    const edges: GhaUsesActionEdge[] = [];

    for (const step of job.steps) {
      if (isGhaUsesStep(step)) {
        const edge = this.createActionEdge(jobNode, step, filePath);
        edges.push(edge);
      }
    }

    return edges;
  }

  /**
   * Create a GHA_USES_ACTION edge for action usage.
   *
   * @param jobNode - The job node containing the step
   * @param step - The uses step
   * @param filePath - Source file path
   * @returns A GhaUsesActionEdge
   */
  createActionEdge(
    jobNode: GhaJobNode,
    step: GhaUsesStep,
    filePath: string
  ): GhaUsesActionEdge {
    const { owner, repo, version } = this.parseActionRef(step.uses);

    return {
      id: `gha_uses_action_${this.idGenerator()}`,
      source: jobNode.id,
      target: jobNode.id, // Self-reference; action is external
      type: 'gha_uses_action',
      label: `uses: ${step.uses}`,
      confidence: this.defaultExplicitConfidence,
      evidence: [{
        file: filePath,
        lineStart: step.location?.lineStart ?? 1,
        lineEnd: (step.location?.lineStart ?? 1) + 3,
        snippet: `uses: ${step.uses}`,
        type: 'action_call',
      }],
      metadata: {
        scanId: this.scanId,
        tenantId: this.tenantId,
        createdAt: new Date(),
        implicit: false,
        confidence: 100,
        actionRef: step.uses,
        actionOwner: owner,
        actionRepo: repo,
        actionVersion: version,
        inputs: step.with ?? {},
      },
    };
  }

  /**
   * Create output flow edges between jobs.
   *
   * Analyzes job outputs and expressions to find output consumption patterns.
   *
   * @param workflow - The workflow
   * @param jobNodeMap - Map of job IDs to nodes
   * @param filePath - Source file path
   * @returns Array of output flow edges
   */
  createOutputFlowEdges(
    workflow: GhaWorkflow,
    jobNodeMap: ReadonlyMap<string, GhaJobNode>,
    filePath: string
  ): GhaOutputsToEdge[] {
    const edges: GhaOutputsToEdge[] = [];

    for (const [jobId, job] of workflow.jobs) {
      const jobNode = jobNodeMap.get(jobId);
      if (!jobNode) continue;

      // Find output references in this job
      const outputRefs = this.findOutputReferences(job);

      for (const ref of outputRefs) {
        const sourceNode = jobNodeMap.get(ref.sourceJobId);
        if (!sourceNode) continue;

        edges.push({
          id: `gha_outputs_to_${this.idGenerator()}`,
          source: sourceNode.id,
          target: jobNode.id,
          type: 'gha_outputs_to',
          label: `output: ${ref.outputName}`,
          confidence: this.defaultInferredConfidence, // Inferred from expression
          evidence: [{
            file: filePath,
            lineStart: job.location.lineStart,
            lineEnd: job.location.lineStart + 1,
            snippet: ref.expression,
            type: 'output_reference',
          }],
          metadata: {
            scanId: this.scanId,
            tenantId: this.tenantId,
            createdAt: new Date(),
            implicit: true,
            confidence: 80,
            outputName: ref.outputName,
            expression: ref.expression,
            sourceJobId: ref.sourceJobId,
            targetJobId: jobId,
          },
        });
      }
    }

    return edges;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Extract job ID from a job node.
   */
  private extractJobIdFromNode(node: GhaJobNode): string | null {
    // Try metadata first
    if (node.metadata && typeof node.metadata === 'object') {
      const meta = node.metadata as Record<string, unknown>;
      if (typeof meta.jobId === 'string') {
        return meta.jobId;
      }
    }
    // Fall back to name
    return node.name;
  }

  /**
   * Find outputs consumed from a specific dependency job.
   */
  private findConsumedOutputs(job: GhaJob, dependencyJobId: string): readonly string[] {
    const outputs: string[] = [];
    const pattern = new RegExp(`needs\\.${dependencyJobId}\\.outputs\\.(\\w+)`, 'g');

    // Check job steps for output references
    for (const step of job.steps) {
      let content = '';

      if (isGhaRunStep(step)) {
        content = step.run;
      } else if (isGhaUsesStep(step) && step.with) {
        content = JSON.stringify(step.with);
      }

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        if (!outputs.includes(match[1])) {
          outputs.push(match[1]);
        }
      }
    }

    // Check job outputs
    for (const value of Object.values(job.outputs)) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(value)) !== null) {
        if (!outputs.includes(match[1])) {
          outputs.push(match[1]);
        }
      }
    }

    return outputs;
  }

  /**
   * Find output references in a job.
   */
  private findOutputReferences(job: GhaJob): Array<{
    sourceJobId: string;
    outputName: string;
    expression: string;
  }> {
    const refs: Array<{ sourceJobId: string; outputName: string; expression: string }> = [];
    const pattern = /needs\.(\w+)\.outputs\.(\w+)/g;

    // Collect all content to search
    const contents: string[] = [];

    for (const step of job.steps) {
      if (isGhaRunStep(step)) {
        contents.push(step.run);
      } else if (isGhaUsesStep(step) && step.with) {
        contents.push(JSON.stringify(step.with));
      }

      // Check step env
      if (step.env) {
        contents.push(JSON.stringify(step.env));
      }

      // Check step if condition
      if (step.if) {
        contents.push(step.if);
      }
    }

    // Check job-level properties
    if (job.if) {
      contents.push(job.if);
    }

    if (job.env) {
      contents.push(JSON.stringify(job.env));
    }

    // Search for patterns
    for (const content of contents) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        refs.push({
          sourceJobId: match[1],
          outputName: match[2],
          expression: match[0],
        });
      }
    }

    return refs;
  }

  /**
   * Detect Terraform usage in a step.
   */
  private detectTerraformInStep(
    step: GhaStep,
    stepIndex: number,
    jobId: string
  ): TerraformStepInfo | null {
    // Terraform action patterns
    const terraformActions = [
      'hashicorp/setup-terraform',
      'hashicorp/tfc-workflows-tooling',
      'dflook/terraform-plan',
      'dflook/terraform-apply',
      'dflook/terraform-fmt',
      'dflook/terraform-validate',
    ];

    // Check uses steps for Terraform actions
    if (isGhaUsesStep(step)) {
      const actionName = step.uses.split('@')[0];
      if (terraformActions.some(action => actionName.includes(action))) {
        return {
          stepIndex,
          stepId: step.id,
          jobId,
          command: this.inferTfCommandFromAction(actionName),
          actionRef: step.uses,
          usesCloud: actionName.includes('tfc-'),
          varFiles: [],
          envVars: step.env ?? {},
          confidence: 95,
          location: step.location,
        };
      }
    }

    // Check run steps for terraform commands
    if (isGhaRunStep(step)) {
      const tfPattern = /\bterraform\s+(init|plan|apply|destroy|validate|fmt|output|import|state|workspace|refresh)\b/i;
      const match = tfPattern.exec(step.run);

      if (match) {
        const command = match[1].toLowerCase() as TerraformStepInfo['command'];
        return {
          stepIndex,
          stepId: step.id,
          jobId,
          command,
          workingDirectory: this.extractWorkingDir(step.run) ?? step.workingDirectory,
          usesCloud: step.run.includes('TF_CLOUD_') || step.run.includes('TFE_'),
          varFiles: this.extractVarFiles(step.run),
          envVars: step.env ?? {},
          confidence: 90,
          location: step.location,
        };
      }
    }

    return null;
  }

  /**
   * Detect Helm usage in a step.
   */
  private detectHelmInStep(
    step: GhaStep,
    stepIndex: number,
    jobId: string
  ): HelmStepInfo | null {
    // Helm action patterns
    const helmActions = [
      'azure/setup-helm',
      'azure/k8s-bake',
      'deliverybot/helm',
      'WyriHaximus/github-action-helm3',
      'bitovi/github-actions-deploy-eks-helm',
    ];

    // Check uses steps for Helm actions
    if (isGhaUsesStep(step)) {
      const actionName = step.uses.split('@')[0];
      if (helmActions.some(action => actionName.includes(action))) {
        return {
          stepIndex,
          stepId: step.id,
          jobId,
          command: 'install',
          actionRef: step.uses,
          valuesFiles: [],
          setValues: {},
          dryRun: false,
          atomic: false,
          wait: false,
          confidence: 95,
          location: step.location,
        };
      }
    }

    // Check run steps for helm commands
    if (isGhaRunStep(step)) {
      const helmPattern = /\bhelm\s+(install|upgrade|uninstall|rollback|template|lint|package|push|pull|repo|dependency|test)\b/i;
      const match = helmPattern.exec(step.run);

      if (match) {
        const command = match[1].toLowerCase() as HelmStepInfo['command'];
        return {
          stepIndex,
          stepId: step.id,
          jobId,
          command,
          releaseName: this.extractHelmReleaseName(step.run),
          chartPath: this.extractHelmChart(step.run),
          namespace: this.extractNamespace(step.run),
          valuesFiles: this.extractHelmValuesFiles(step.run),
          setValues: {},
          dryRun: step.run.includes('--dry-run'),
          atomic: step.run.includes('--atomic'),
          wait: step.run.includes('--wait'),
          confidence: 90,
          location: step.location,
        };
      }
    }

    return null;
  }

  /**
   * Parse action reference into components.
   */
  private parseActionRef(uses: string): { owner: string; repo: string; version: string } {
    // Handle local actions
    if (uses.startsWith('./') || uses.startsWith('../')) {
      return { owner: 'local', repo: uses, version: 'local' };
    }

    // Parse owner/repo@version format
    const atIndex = uses.indexOf('@');
    const ref = atIndex >= 0 ? uses.substring(0, atIndex) : uses;
    const version = atIndex >= 0 ? uses.substring(atIndex + 1) : 'latest';

    const parts = ref.split('/');
    const owner = parts[0] || 'unknown';
    const repo = parts.slice(1).join('/') || 'unknown';

    return { owner, repo, version };
  }

  /**
   * Infer Terraform command from action name.
   */
  private inferTfCommandFromAction(actionName: string): TerraformStepInfo['command'] {
    if (actionName.includes('plan')) return 'plan';
    if (actionName.includes('apply')) return 'apply';
    if (actionName.includes('fmt')) return 'fmt';
    if (actionName.includes('validate')) return 'validate';
    return 'init';
  }

  /**
   * Extract working directory from run content.
   */
  private extractWorkingDir(content: string): string | undefined {
    const cdMatch = /cd\s+([^\s;&|]+)/.exec(content);
    if (cdMatch) return cdMatch[1];
    return undefined;
  }

  /**
   * Extract var files from terraform command.
   */
  private extractVarFiles(content: string): readonly string[] {
    const files: string[] = [];
    const pattern = /-var-file[=\s]+["']?([^\s"']+)["']?/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      files.push(match[1]);
    }
    return files;
  }

  /**
   * Extract Helm release name.
   */
  private extractHelmReleaseName(content: string): string | undefined {
    const match = /helm\s+(install|upgrade)\s+([^\s]+)/.exec(content);
    return match?.[2];
  }

  /**
   * Extract Helm chart path.
   */
  private extractHelmChart(content: string): string | undefined {
    const match = /helm\s+(install|upgrade)\s+\S+\s+([^\s]+)/.exec(content);
    return match?.[2];
  }

  /**
   * Extract namespace from helm command.
   */
  private extractNamespace(content: string): string | undefined {
    const match = /-n\s+([^\s]+)|--namespace[=\s]+([^\s]+)/.exec(content);
    return match?.[1] || match?.[2];
  }

  /**
   * Extract Helm values files.
   */
  private extractHelmValuesFiles(content: string): readonly string[] {
    const files: string[] = [];
    const pattern = /-f\s+([^\s]+)|--values[=\s]+([^\s]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      files.push(match[1] || match[2]);
    }
    return files;
  }

  /**
   * Create a Terraform snippet for evidence.
   */
  private createTfSnippet(info: TerraformStepInfo): string {
    if (info.actionRef) {
      return `uses: ${info.actionRef}`;
    }
    const parts = [`terraform ${info.command}`];
    if (info.workingDirectory) {
      parts.push(`-chdir=${info.workingDirectory}`);
    }
    return `run: ${parts.join(' ')}`;
  }

  /**
   * Create a Helm snippet for evidence.
   */
  private createHelmSnippet(info: HelmStepInfo): string {
    if (info.actionRef) {
      return `uses: ${info.actionRef}`;
    }
    const parts = [`helm ${info.command}`];
    if (info.releaseName) parts.push(info.releaseName);
    if (info.chartPath) parts.push(info.chartPath);
    return `run: ${parts.join(' ')}`;
  }
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create GHA edges with a one-liner.
 *
 * @param workflow - The parsed workflow
 * @param jobNodes - Job nodes from node factory
 * @param filePath - Source file path
 * @param scanId - Scan identifier
 * @param tenantId - Tenant identifier
 * @returns Array of created edges
 *
 * @example
 * ```typescript
 * const edges = createGhaEdges(workflow, jobNodes, filePath, 'scan-123', 'tenant-456');
 * ```
 */
export function createGhaEdges(
  workflow: GhaWorkflow,
  jobNodes: readonly GhaJobNode[],
  filePath: string,
  scanId: string,
  tenantId: string
): GhaSpecificEdge[] {
  const factory = new GhaEdgeFactory(scanId, tenantId);
  return factory.createEdgesForWorkflow(workflow, jobNodes, filePath);
}

/**
 * Create a configured edge factory.
 *
 * @param options - Factory options
 * @returns Configured GhaEdgeFactory instance
 */
export function createEdgeFactory(options: GhaEdgeFactoryOptions): GhaEdgeFactory {
  return new GhaEdgeFactory(options.scanId, options.tenantId, options);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for GhaNeedsEdge.
 */
export function isGhaNeedsEdge(edge: GhaEdge): edge is GhaNeedsEdge {
  return edge.type === 'gha_needs';
}

/**
 * Type guard for GhaUsesTfEdge.
 */
export function isGhaUsesTfEdge(edge: GhaEdge): edge is GhaUsesTfEdge {
  return edge.type === 'gha_uses_tf';
}

/**
 * Type guard for GhaUsesHelmEdge.
 */
export function isGhaUsesHelmEdge(edge: GhaEdge): edge is GhaUsesHelmEdge {
  return edge.type === 'gha_uses_helm';
}

/**
 * Type guard for GhaOutputsToEdge.
 */
export function isGhaOutputsToEdge(edge: GhaEdge): edge is GhaOutputsToEdge {
  return edge.type === 'gha_outputs_to';
}

/**
 * Type guard for GhaUsesActionEdge.
 */
export function isGhaUsesActionEdge(edge: GhaEdge): edge is GhaUsesActionEdge {
  return edge.type === 'gha_uses_action';
}

/**
 * Type guard for any GHA-specific edge.
 */
export function isGhaSpecificEdge(edge: GhaEdge): edge is GhaSpecificEdge {
  return (
    edge.type === 'gha_needs' ||
    edge.type === 'gha_uses_tf' ||
    edge.type === 'gha_uses_helm' ||
    edge.type === 'gha_outputs_to' ||
    edge.type === 'gha_uses_action'
  );
}
