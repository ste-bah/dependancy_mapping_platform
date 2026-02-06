/**
 * GitLab CI Node Factory
 * @module parsers/ci/gitlab-node-factory
 *
 * Factory for creating GitLab CI graph nodes from parsed pipeline data.
 * Transforms parsed GitLabCIPipeline, GitLabStage, and GitLabJob structures
 * into GitLabPipelineNode, GitLabStageNode, and GitLabJobNode instances
 * for the dependency graph.
 *
 * TASK-XREF-002: GitLab CI Parser - Node Factory
 * TASK-GITLAB-004: Pipeline structure graph building
 * TASK-GITLAB-005: Job node creation with tool detection
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GitLabCIPipeline,
  GitLabStage,
  GitLabJob,
  GitLabPipelineNode,
  GitLabStageNode,
  GitLabJobNode,
  GitLabNodeFactoryOptions,
  GitLabTerraformStepInfo,
  GitLabHelmStepInfo,
  GitLabWhen,
  GitLabNeed,
  GitLabAllowFailure,
  GitLabEnvironment,
  GitLabImage,
  GitLabInclude,
  isGitLabNeedObject,
  isGitLabAllowFailureObject,
  isGitLabLocalInclude,
  isGitLabTemplateInclude,
  jobHasTerraform,
  jobHasHelm,
  jobHasKubernetes,
  jobHasDocker,
} from './types.js';
import { SourceLocation } from '../terraform/types.js';
import { NodeLocation } from '../../types/graph.js';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Result of creating all nodes for a pipeline
 */
export interface GitLabNodeCreationResult {
  /** The pipeline node */
  readonly pipelineNode: GitLabPipelineNode;
  /** All stage nodes */
  readonly stageNodes: readonly GitLabStageNode[];
  /** All job nodes */
  readonly jobNodes: readonly GitLabJobNode[];
  /** Map of job names to their node IDs */
  readonly jobNameToIdMap: ReadonlyMap<string, string>;
  /** Map of stage names to their node IDs */
  readonly stageNameToIdMap: ReadonlyMap<string, string>;
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
const DEFAULT_FACTORY_OPTIONS: Required<GitLabNodeFactoryOptions> = {
  scanId: '',
  repositoryRoot: '',
  idGenerator: () => uuidv4(),
  includeRaw: false,
  computeToolInfo: true,
};

// ============================================================================
// GitLabNodeFactory Class
// ============================================================================

/**
 * Factory for creating GitLab CI graph nodes.
 *
 * Creates typed graph nodes from parsed pipeline data, supporting:
 * - Pipeline nodes with stage and job metadata
 * - Stage nodes with job counts and ordering
 * - Job nodes with runner, dependencies, and tool detection info
 *
 * @example
 * ```typescript
 * const factory = new GitLabNodeFactory({
 *   scanId: 'scan-123',
 *   repositoryRoot: '/repo',
 * });
 *
 * const { pipelineNode, stageNodes, jobNodes } = factory.createNodesForPipeline(
 *   parsedPipeline,
 *   '.gitlab-ci.yml'
 * );
 * ```
 */
export class GitLabNodeFactory {
  private readonly context: NodeCreationContext;

  /**
   * Creates a new GitLabNodeFactory
   * @param options - Factory options including scanId and repositoryRoot
   */
  constructor(options: GitLabNodeFactoryOptions) {
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
  // Public API - Pipeline Node Creation
  // ============================================================================

  /**
   * Create a pipeline node from parsed pipeline data
   *
   * @param pipeline - Parsed pipeline data
   * @param filePath - Path to the pipeline file
   * @returns GitLabPipelineNode for the dependency graph
   *
   * @example
   * ```typescript
   * const pipelineNode = factory.createPipelineNode(pipeline, '.gitlab-ci.yml');
   * ```
   */
  createPipelineNode(pipeline: GitLabCIPipeline, filePath: string): GitLabPipelineNode {
    const nodeId = `gitlab_pipeline_${this.context.idGenerator()}`;

    // Count various pipeline elements
    const stageCount = pipeline.stages.length;
    const jobCount = pipeline.jobs.size;
    const includeCount = pipeline.includes.length;

    // Check for workflow rules
    const hasWorkflow = pipeline.workflow !== undefined && pipeline.workflow.rules.length > 0;

    // Check for Terraform/Helm in includes (templates)
    const hasTerraformInclude = this.detectTerraformInIncludes(pipeline.includes);
    const hasHelmInclude = this.detectHelmInIncludes(pipeline.includes);

    // Calculate line count for location
    const lineEnd = this.estimatePipelineLineEnd(pipeline);

    const location: NodeLocation = {
      file: filePath,
      lineStart: pipeline.location.lineStart,
      lineEnd,
      columnStart: pipeline.location.columnStart,
      columnEnd: pipeline.location.columnEnd,
    };

    return {
      id: nodeId,
      name: this.extractFileName(filePath),
      type: 'gitlab_pipeline',
      location,
      metadata: {
        scanId: this.context.scanId,
        pipelineFileName: this.extractFileName(filePath),
        variableCount: Object.keys(pipeline.variables).length,
        hasDefault: pipeline.default !== undefined,
        hasWorkflowRules: hasWorkflow,
        hasTerraformInclude,
        hasHelmInclude,
        defaultImage: pipeline.default?.image?.name,
        defaultTags: pipeline.default?.tags ?? [],
      },
      stageCount,
      jobCount,
      hasIncludes: includeCount > 0,
      includeCount,
      hasWorkflow,
    };
  }

  // ============================================================================
  // Public API - Stage Node Creation
  // ============================================================================

  /**
   * Create a stage node from parsed stage data
   *
   * @param stage - Parsed stage data
   * @param pipelineId - ID of the parent pipeline node
   * @param filePath - Path to the pipeline file
   * @returns GitLabStageNode for the dependency graph
   *
   * @example
   * ```typescript
   * const stageNode = factory.createStageNode(stage, pipelineNode.id, '.gitlab-ci.yml');
   * ```
   */
  createStageNode(
    stage: GitLabStage,
    pipelineId: string,
    filePath: string
  ): GitLabStageNode {
    const nodeId = `gitlab_stage_${this.context.idGenerator()}`;

    const location: NodeLocation = this.createLocation(filePath, stage.location);

    return {
      id: nodeId,
      name: stage.name,
      type: 'gitlab_stage',
      location,
      metadata: {
        scanId: this.context.scanId,
        pipelineNodeId: pipelineId,
        stageName: stage.name,
        jobNames: stage.jobNames,
      },
      pipelineId,
      order: stage.order,
      jobCount: stage.jobNames.length,
    };
  }

  // ============================================================================
  // Public API - Job Node Creation
  // ============================================================================

  /**
   * Create a job node from parsed job data
   *
   * @param job - Parsed job data
   * @param pipelineId - ID of the parent pipeline node
   * @param filePath - Path to the pipeline file
   * @param terraformSteps - Optional pre-detected Terraform steps
   * @param helmSteps - Optional pre-detected Helm steps
   * @returns GitLabJobNode for the dependency graph
   *
   * @example
   * ```typescript
   * const jobNode = factory.createJobNode(
   *   job,
   *   pipelineNode.id,
   *   '.gitlab-ci.yml'
   * );
   * ```
   */
  createJobNode(
    job: GitLabJob,
    pipelineId: string,
    filePath: string,
    terraformSteps?: readonly GitLabTerraformStepInfo[],
    helmSteps?: readonly GitLabHelmStepInfo[]
  ): GitLabJobNode {
    const nodeId = `gitlab_job_${this.context.idGenerator()}`;

    // Detect Terraform/Helm/K8s/Docker usage if not provided
    let hasTerraform = false;
    let hasHelm = false;
    let hasKubernetes = false;
    let hasDocker = false;

    if (this.context.computeToolInfo) {
      if (terraformSteps) {
        hasTerraform = terraformSteps.some(s => s.jobName === job.id);
      } else {
        hasTerraform = jobHasTerraform(job);
      }

      if (helmSteps) {
        hasHelm = helmSteps.some(s => s.jobName === job.id);
      } else {
        hasHelm = jobHasHelm(job);
      }

      hasKubernetes = jobHasKubernetes(job);
      hasDocker = jobHasDocker(job);
    }

    // Extract needs count
    const needsCount = this.getNeedsCount(job);

    // Check for rules
    const hasRules = job.rules !== undefined && job.rules.length > 0;

    // Check for artifacts
    const hasArtifacts = job.artifacts !== undefined &&
      (job.artifacts.paths !== undefined || job.artifacts.reports !== undefined);

    // Check for cache
    const hasCache = job.cache !== undefined;

    // Determine when condition
    const when = this.extractWhen(job);

    // Check for allow failure
    const allowFailure = this.extractAllowFailure(job);

    // Extract environment name
    const environment = this.extractEnvironmentName(job);

    // Check if job is a trigger
    const isTrigger = job.trigger !== undefined;

    // Check for parallel/matrix
    const hasParallel = job.parallel !== undefined;

    // Extract image name
    const image = this.extractImageName(job);

    // Extract tags
    const tags = job.tags ?? [];

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
      type: 'gitlab_job',
      location,
      metadata: {
        scanId: this.context.scanId,
        jobId: job.id,
        pipelineNodeId: pipelineId,
        stage: job.stage,
        needs: this.extractNeedsNames(job),
        dependencies: job.dependencies ?? [],
        extends: this.normalizeExtends(job.extends),
        scriptLineCount: this.countScriptLines(job),
        variableCount: job.variables ? Object.keys(job.variables).length : 0,
        hasBeforeScript: job.beforeScript !== undefined && job.beforeScript.length > 0,
        hasAfterScript: job.afterScript !== undefined && job.afterScript.length > 0,
        hasServices: job.services !== undefined && job.services.length > 0,
        hasSecrets: job.secrets !== undefined && Object.keys(job.secrets).length > 0,
        timeout: job.timeout,
        resourceGroup: job.resourceGroup,
        coverage: job.coverage,
      },
      pipelineId,
      stage: job.stage,
      hidden: job.hidden,
      hasRules,
      hasNeeds: needsCount > 0,
      needsCount,
      hasArtifacts,
      hasCache,
      hasTerraform,
      hasHelm,
      hasKubernetes,
      hasDocker,
      when,
      allowFailure,
      environment,
      isTrigger,
      hasParallel,
      image,
      tags,
    };
  }

  // ============================================================================
  // Public API - Batch Node Creation
  // ============================================================================

  /**
   * Create all nodes for a pipeline (pipeline + stages + jobs)
   *
   * @param pipeline - Parsed pipeline data
   * @param filePath - Path to the pipeline file
   * @param options - Additional options for node creation
   * @returns Object containing pipelineNode, stageNodes, jobNodes, and lookup maps
   *
   * @example
   * ```typescript
   * const { pipelineNode, stageNodes, jobNodes, jobNameToIdMap } = factory.createNodesForPipeline(
   *   parsedPipeline,
   *   '.gitlab-ci.yml'
   * );
   * ```
   */
  createNodesForPipeline(
    pipeline: GitLabCIPipeline,
    filePath: string,
    options?: {
      terraformSteps?: readonly GitLabTerraformStepInfo[];
      helmSteps?: readonly GitLabHelmStepInfo[];
    }
  ): GitLabNodeCreationResult {
    const pipelineNode = this.createPipelineNode(pipeline, filePath);

    const stageNodes: GitLabStageNode[] = [];
    const jobNodes: GitLabJobNode[] = [];
    const jobNameToIdMap = new Map<string, string>();
    const stageNameToIdMap = new Map<string, string>();

    // Create stage nodes
    for (const stage of pipeline.stages) {
      const stageNode = this.createStageNode(stage, pipelineNode.id, filePath);
      stageNodes.push(stageNode);
      stageNameToIdMap.set(stage.name, stageNode.id);
    }

    // Create job nodes
    for (const [_jobId, job] of pipeline.jobs) {
      const jobNode = this.createJobNode(
        job,
        pipelineNode.id,
        filePath,
        options?.terraformSteps,
        options?.helmSteps
      );
      jobNodes.push(jobNode);
      jobNameToIdMap.set(job.id, jobNode.id);
    }

    return {
      pipelineNode,
      stageNodes,
      jobNodes,
      jobNameToIdMap,
      stageNameToIdMap,
    };
  }

  /**
   * Create stage nodes for all stages in a pipeline
   *
   * @param stages - Array of stage data
   * @param pipelineId - ID of the parent pipeline node
   * @param filePath - Path to the pipeline file
   * @returns Array of GitLabStageNode instances
   */
  createStageNodes(
    stages: readonly GitLabStage[],
    pipelineId: string,
    filePath: string
  ): GitLabStageNode[] {
    return stages.map(stage => this.createStageNode(stage, pipelineId, filePath));
  }

  /**
   * Create job nodes for all jobs in a pipeline
   *
   * @param jobs - Map of job ID to job data
   * @param pipelineId - ID of the parent pipeline node
   * @param filePath - Path to the pipeline file
   * @returns Array of GitLabJobNode instances
   */
  createJobNodes(
    jobs: ReadonlyMap<string, GitLabJob>,
    pipelineId: string,
    filePath: string
  ): GitLabJobNode[] {
    const jobNodes: GitLabJobNode[] = [];

    for (const [_jobId, job] of jobs) {
      const jobNode = this.createJobNode(job, pipelineId, filePath);
      jobNodes.push(jobNode);
    }

    return jobNodes;
  }

  // ============================================================================
  // Private - Include Detection Helpers
  // ============================================================================

  /**
   * Detect Terraform templates in includes
   */
  private detectTerraformInIncludes(includes: readonly GitLabInclude[]): boolean {
    return includes.some(inc => {
      if (isGitLabTemplateInclude(inc)) {
        return this.isTerraformTemplate(inc.template);
      }
      if (isGitLabLocalInclude(inc)) {
        return inc.local.toLowerCase().includes('terraform');
      }
      return false;
    });
  }

  /**
   * Detect Helm templates in includes
   */
  private detectHelmInIncludes(includes: readonly GitLabInclude[]): boolean {
    return includes.some(inc => {
      if (isGitLabTemplateInclude(inc)) {
        return this.isHelmTemplate(inc.template);
      }
      if (isGitLabLocalInclude(inc)) {
        return inc.local.toLowerCase().includes('helm');
      }
      return false;
    });
  }

  /**
   * Check if template is a Terraform template
   */
  private isTerraformTemplate(templateName: string): boolean {
    const lower = templateName.toLowerCase();
    return lower.includes('terraform') || lower.includes('terragrunt');
  }

  /**
   * Check if template is a Helm template
   */
  private isHelmTemplate(templateName: string): boolean {
    const lower = templateName.toLowerCase();
    return lower.includes('helm') || lower.includes('auto-devops');
  }

  // ============================================================================
  // Private - Job Attribute Extraction
  // ============================================================================

  /**
   * Get the count of needs dependencies
   */
  private getNeedsCount(job: GitLabJob): number {
    if (!job.needs) {
      return 0;
    }
    return job.needs.length;
  }

  /**
   * Extract needs job names
   */
  private extractNeedsNames(job: GitLabJob): readonly string[] {
    if (!job.needs) {
      return [];
    }
    return job.needs.map(need => {
      if (isGitLabNeedObject(need)) {
        return need.job;
      }
      return need as string;
    });
  }

  /**
   * Extract when condition with default
   */
  private extractWhen(job: GitLabJob): GitLabWhen {
    return job.when ?? 'on_success';
  }

  /**
   * Extract allow failure flag
   */
  private extractAllowFailure(job: GitLabJob): boolean {
    if (job.allowFailure === undefined) {
      return false;
    }
    if (typeof job.allowFailure === 'boolean') {
      return job.allowFailure;
    }
    if (isGitLabAllowFailureObject(job.allowFailure)) {
      return true; // If exit_codes is specified, job can fail
    }
    return false;
  }

  /**
   * Extract environment name from job
   */
  private extractEnvironmentName(job: GitLabJob): string | undefined {
    if (!job.environment) {
      return undefined;
    }
    if (typeof job.environment === 'string') {
      return job.environment;
    }
    return (job.environment as GitLabEnvironment).name;
  }

  /**
   * Extract image name from job
   */
  private extractImageName(job: GitLabJob): string | undefined {
    if (!job.image) {
      return undefined;
    }
    if (typeof job.image === 'string') {
      return job.image;
    }
    return (job.image as GitLabImage).name;
  }

  /**
   * Normalize extends to array
   */
  private normalizeExtends(extends_: string | readonly string[] | undefined): readonly string[] {
    if (!extends_) {
      return [];
    }
    if (typeof extends_ === 'string') {
      return [extends_];
    }
    return extends_;
  }

  /**
   * Count total script lines in job
   */
  private countScriptLines(job: GitLabJob): number {
    let count = job.script.length;
    if (job.beforeScript) {
      count += job.beforeScript.length;
    }
    if (job.afterScript) {
      count += job.afterScript.length;
    }
    return count;
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
   * Create NodeLocation from SourceLocation
   */
  private createLocation(filePath: string, location?: SourceLocation): NodeLocation {
    if (!location) {
      return {
        file: filePath,
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 1,
      };
    }
    return {
      file: filePath,
      lineStart: location.lineStart,
      lineEnd: location.lineEnd,
      columnStart: location.columnStart,
      columnEnd: location.columnEnd,
    };
  }

  /**
   * Estimate pipeline line end based on content
   */
  private estimatePipelineLineEnd(pipeline: GitLabCIPipeline): number {
    // Start with base pipeline structure lines
    let lines = pipeline.location.lineStart + 5; // stages, variables, etc.

    // Add lines for includes
    lines += pipeline.includes.length * 3;

    // Add lines for variables
    lines += Object.keys(pipeline.variables).length * 2;

    // Add lines for default block
    if (pipeline.default) {
      lines += 10;
    }

    // Add lines for workflow rules
    if (pipeline.workflow) {
      lines += pipeline.workflow.rules.length * 3;
    }

    // Add lines for stages
    lines += pipeline.stages.length + 2;

    // Add lines for jobs
    for (const [_jobId, job] of pipeline.jobs) {
      lines += 5; // Job header
      lines += job.script.length;
      if (job.beforeScript) lines += job.beforeScript.length;
      if (job.afterScript) lines += job.afterScript.length;
      if (job.rules) lines += job.rules.length * 2;
      if (job.needs) lines += job.needs.length;
      if (job.variables) lines += Object.keys(job.variables).length;
    }

    return lines;
  }

  /**
   * Generate a unique node ID with type prefix
   * @param type - Node type prefix
   * @param name - Name to include in ID
   * @returns Generated node ID
   */
  private generateNodeId(type: string, name: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${type}_${safeName}_${this.context.idGenerator()}`;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a GitLabNodeFactory with the given options
 *
 * @param options - Factory options
 * @returns New GitLabNodeFactory instance
 *
 * @example
 * ```typescript
 * const factory = createGitLabNodeFactory({ scanId: 'scan-123' });
 * ```
 */
export function createGitLabNodeFactory(options: GitLabNodeFactoryOptions): GitLabNodeFactory {
  return new GitLabNodeFactory(options);
}

/**
 * Convenience function for one-off node creation from a pipeline
 *
 * @param pipeline - Parsed pipeline data
 * @param filePath - Path to the pipeline file
 * @param scanId - Scan ID for tracking
 * @param repositoryRoot - Repository root path
 * @returns Object containing pipelineNode, stageNodes, jobNodes, and maps
 *
 * @example
 * ```typescript
 * const { pipelineNode, stageNodes, jobNodes } = createGitLabNodes(
 *   parsedPipeline,
 *   '.gitlab-ci.yml',
 *   'scan-123',
 *   '/repo'
 * );
 * ```
 */
export function createGitLabNodes(
  pipeline: GitLabCIPipeline,
  filePath: string,
  scanId: string,
  repositoryRoot: string = ''
): GitLabNodeCreationResult {
  const factory = new GitLabNodeFactory({ scanId, repositoryRoot });
  return factory.createNodesForPipeline(pipeline, filePath);
}

/**
 * Create a single pipeline node
 *
 * @param pipeline - Parsed pipeline data
 * @param filePath - Path to the pipeline file
 * @param scanId - Scan ID for tracking
 * @returns GitLabPipelineNode for the dependency graph
 */
export function createGitLabPipelineNode(
  pipeline: GitLabCIPipeline,
  filePath: string,
  scanId: string
): GitLabPipelineNode {
  const factory = new GitLabNodeFactory({ scanId, repositoryRoot: '' });
  return factory.createPipelineNode(pipeline, filePath);
}

/**
 * Create a single stage node
 *
 * @param stage - Parsed stage data
 * @param pipelineId - ID of the parent pipeline node
 * @param filePath - Path to the pipeline file
 * @param scanId - Scan ID for tracking
 * @returns GitLabStageNode for the dependency graph
 */
export function createGitLabStageNode(
  stage: GitLabStage,
  pipelineId: string,
  filePath: string,
  scanId: string
): GitLabStageNode {
  const factory = new GitLabNodeFactory({ scanId, repositoryRoot: '' });
  return factory.createStageNode(stage, pipelineId, filePath);
}

/**
 * Create a single job node
 *
 * @param job - Parsed job data
 * @param pipelineId - ID of the parent pipeline node
 * @param filePath - Path to the pipeline file
 * @param scanId - Scan ID for tracking
 * @returns GitLabJobNode for the dependency graph
 */
export function createGitLabJobNode(
  job: GitLabJob,
  pipelineId: string,
  filePath: string,
  scanId: string
): GitLabJobNode {
  const factory = new GitLabNodeFactory({ scanId, repositoryRoot: '' });
  return factory.createJobNode(job, pipelineId, filePath);
}

// ============================================================================
// Node Builders for Programmatic Creation
// ============================================================================

/**
 * Builder for creating GitLabPipelineNode programmatically
 */
export class GitLabPipelineNodeBuilder {
  private id: string = '';
  private name: string = '';
  private location: NodeLocation = { file: '', lineStart: 1, lineEnd: 1 };
  private metadata: Record<string, unknown> = {};
  private stageCount: number = 0;
  private jobCount: number = 0;
  private hasIncludes: boolean = false;
  private includeCount: number = 0;
  private hasWorkflow: boolean = false;

  setId(id: string): this {
    this.id = id;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setLocation(location: NodeLocation): this {
    this.location = location;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.metadata = metadata;
    return this;
  }

  setStageCount(count: number): this {
    this.stageCount = count;
    return this;
  }

  setJobCount(count: number): this {
    this.jobCount = count;
    return this;
  }

  setHasIncludes(hasIncludes: boolean): this {
    this.hasIncludes = hasIncludes;
    return this;
  }

  setIncludeCount(count: number): this {
    this.includeCount = count;
    return this;
  }

  setHasWorkflow(hasWorkflow: boolean): this {
    this.hasWorkflow = hasWorkflow;
    return this;
  }

  build(): GitLabPipelineNode {
    return {
      id: this.id || `gitlab_pipeline_${uuidv4()}`,
      name: this.name,
      type: 'gitlab_pipeline',
      location: this.location,
      metadata: this.metadata,
      stageCount: this.stageCount,
      jobCount: this.jobCount,
      hasIncludes: this.hasIncludes,
      includeCount: this.includeCount,
      hasWorkflow: this.hasWorkflow,
    };
  }
}

/**
 * Builder for creating GitLabStageNode programmatically
 */
export class GitLabStageNodeBuilder {
  private id: string = '';
  private name: string = '';
  private location: NodeLocation = { file: '', lineStart: 1, lineEnd: 1 };
  private metadata: Record<string, unknown> = {};
  private pipelineId: string = '';
  private order: number = 0;
  private jobCount: number = 0;

  setId(id: string): this {
    this.id = id;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setLocation(location: NodeLocation): this {
    this.location = location;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.metadata = metadata;
    return this;
  }

  setPipelineId(pipelineId: string): this {
    this.pipelineId = pipelineId;
    return this;
  }

  setOrder(order: number): this {
    this.order = order;
    return this;
  }

  setJobCount(count: number): this {
    this.jobCount = count;
    return this;
  }

  build(): GitLabStageNode {
    return {
      id: this.id || `gitlab_stage_${uuidv4()}`,
      name: this.name,
      type: 'gitlab_stage',
      location: this.location,
      metadata: this.metadata,
      pipelineId: this.pipelineId,
      order: this.order,
      jobCount: this.jobCount,
    };
  }
}

/**
 * Builder for creating GitLabJobNode programmatically
 */
export class GitLabJobNodeBuilder {
  private id: string = '';
  private name: string = '';
  private location: NodeLocation = { file: '', lineStart: 1, lineEnd: 1 };
  private metadata: Record<string, unknown> = {};
  private pipelineId: string = '';
  private stage: string = 'test';
  private hidden: boolean = false;
  private hasRules: boolean = false;
  private hasNeeds: boolean = false;
  private needsCount: number = 0;
  private hasArtifacts: boolean = false;
  private hasCache: boolean = false;
  private hasTerraform: boolean = false;
  private hasHelm: boolean = false;
  private hasKubernetes: boolean = false;
  private hasDocker: boolean = false;
  private when: GitLabWhen = 'on_success';
  private allowFailure: boolean = false;
  private environment?: string;
  private isTrigger: boolean = false;
  private hasParallel: boolean = false;
  private image?: string;
  private tags: readonly string[] = [];

  setId(id: string): this {
    this.id = id;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setLocation(location: NodeLocation): this {
    this.location = location;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.metadata = metadata;
    return this;
  }

  setPipelineId(pipelineId: string): this {
    this.pipelineId = pipelineId;
    return this;
  }

  setStage(stage: string): this {
    this.stage = stage;
    return this;
  }

  setHidden(hidden: boolean): this {
    this.hidden = hidden;
    return this;
  }

  setHasRules(hasRules: boolean): this {
    this.hasRules = hasRules;
    return this;
  }

  setHasNeeds(hasNeeds: boolean): this {
    this.hasNeeds = hasNeeds;
    return this;
  }

  setNeedsCount(count: number): this {
    this.needsCount = count;
    return this;
  }

  setHasArtifacts(hasArtifacts: boolean): this {
    this.hasArtifacts = hasArtifacts;
    return this;
  }

  setHasCache(hasCache: boolean): this {
    this.hasCache = hasCache;
    return this;
  }

  setHasTerraform(hasTerraform: boolean): this {
    this.hasTerraform = hasTerraform;
    return this;
  }

  setHasHelm(hasHelm: boolean): this {
    this.hasHelm = hasHelm;
    return this;
  }

  setHasKubernetes(hasKubernetes: boolean): this {
    this.hasKubernetes = hasKubernetes;
    return this;
  }

  setHasDocker(hasDocker: boolean): this {
    this.hasDocker = hasDocker;
    return this;
  }

  setWhen(when: GitLabWhen): this {
    this.when = when;
    return this;
  }

  setAllowFailure(allowFailure: boolean): this {
    this.allowFailure = allowFailure;
    return this;
  }

  setEnvironment(environment: string | undefined): this {
    this.environment = environment;
    return this;
  }

  setIsTrigger(isTrigger: boolean): this {
    this.isTrigger = isTrigger;
    return this;
  }

  setHasParallel(hasParallel: boolean): this {
    this.hasParallel = hasParallel;
    return this;
  }

  setImage(image: string | undefined): this {
    this.image = image;
    return this;
  }

  setTags(tags: readonly string[]): this {
    this.tags = tags;
    return this;
  }

  build(): GitLabJobNode {
    return {
      id: this.id || `gitlab_job_${uuidv4()}`,
      name: this.name,
      type: 'gitlab_job',
      location: this.location,
      metadata: this.metadata,
      pipelineId: this.pipelineId,
      stage: this.stage,
      hidden: this.hidden,
      hasRules: this.hasRules,
      hasNeeds: this.hasNeeds,
      needsCount: this.needsCount,
      hasArtifacts: this.hasArtifacts,
      hasCache: this.hasCache,
      hasTerraform: this.hasTerraform,
      hasHelm: this.hasHelm,
      hasKubernetes: this.hasKubernetes,
      hasDocker: this.hasDocker,
      when: this.when,
      allowFailure: this.allowFailure,
      environment: this.environment,
      isTrigger: this.isTrigger,
      hasParallel: this.hasParallel,
      image: this.image,
      tags: this.tags,
    };
  }
}
