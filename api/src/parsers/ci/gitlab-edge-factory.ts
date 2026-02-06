/**
 * GitLab CI Edge Factory
 * @module parsers/ci/gitlab-edge-factory
 *
 * Factory for creating GitLab CI graph edges from parsed pipeline data.
 * Creates edges representing stage ordering, job dependencies, extends relationships,
 * artifact flow, tool usage, and Terraform-to-Helm data flow.
 *
 * TASK-XREF-002: GitLab CI Parser - Edge Factory
 * TASK-GITLAB-025: Edge Factory for GitLab CI Graph Edges
 *
 * Supported Edge Types:
 * - gitlab_stage_order: Stage A → Stage B (implicit ordering)
 * - gitlab_needs: Job A needs Job B (DAG)
 * - gitlab_dependencies: Job A depends on artifacts from Job B (legacy)
 * - gitlab_extends: Job A extends template B
 * - gitlab_includes: Pipeline includes another config
 * - gitlab_uses_tf: Job uses Terraform
 * - gitlab_uses_helm: Job uses Helm
 * - gitlab_artifact_flow: Artifact passes between jobs (TF→Helm)
 *
 * Design Principles:
 * - Pure factory functions with no side effects
 * - Type-safe edge creation with proper validation
 * - Evidence-based confidence scoring
 * - Integration with node factory for complete graph building
 */

import { v4 as uuidv4 } from 'uuid';
import { SourceLocation } from '../terraform/types';
import { NodeLocation, EdgeMetadata, EdgeEvidence } from '../../types/graph';
import {
  GitLabCIPipeline,
  GitLabJob,
  GitLabStage,
  GitLabInclude,
  GitLabEdge,
  GitLabEdgeType,
  GitLabEdgeMetadata,
  GitLabPipelineNode,
  GitLabStageNode,
  GitLabJobNode,
  GitLabNeed,
  GitLabTerraformStepInfo,
  GitLabHelmStepInfo,
  GitLabEdgeFactoryOptions,
  TerraformCommand,
  HelmCommand,
  isGitLabNeedObject,
  createGitLabPipelineId,
  createGitLabStageId,
  createGitLabJobId,
} from './types';

// ============================================================================
// Edge Evidence Types
// ============================================================================

/**
 * Evidence for GitLab CI edge relationships
 */
export interface GitLabEdgeEvidence {
  /** Source file path */
  readonly file: string;
  /** Starting line number */
  readonly lineStart: number;
  /** Ending line number */
  readonly lineEnd: number;
  /** Code snippet showing the relationship */
  readonly snippet: string;
  /** Type of evidence */
  readonly type: 'declaration' | 'tool_invocation' | 'artifact_reference' | 'include_directive' | 'stage_order';
}

// ============================================================================
// Node Creation Result (from node factory)
// ============================================================================

/**
 * Result from node factory containing all created nodes and lookup maps
 */
export interface GitLabNodeCreationResult {
  /** Pipeline node */
  readonly pipelineNode: GitLabPipelineNode;
  /** Stage nodes */
  readonly stageNodes: readonly GitLabStageNode[];
  /** Job nodes */
  readonly jobNodes: readonly GitLabJobNode[];
  /** Map from stage name to stage node ID */
  readonly stageNameToIdMap: Map<string, string>;
  /** Map from job name to job node ID */
  readonly jobNameToIdMap: Map<string, string>;
}

// ============================================================================
// Tool Detection Result
// ============================================================================

/**
 * Result from tool detection for a job
 */
export interface ToolDetectionResult {
  /** Whether job has Terraform commands */
  readonly hasTerraform: boolean;
  /** Whether job has Helm commands */
  readonly hasHelm: boolean;
  /** Terraform step info if detected */
  readonly terraformInfo?: GitLabTerraformStepInfo;
  /** Helm step info if detected */
  readonly helmInfo?: GitLabHelmStepInfo;
}

// ============================================================================
// Edge Creation Result
// ============================================================================

/**
 * Result of creating all edges for a pipeline
 */
export interface GitLabEdgeCreationResult {
  /** All created edges */
  readonly edges: GitLabEdge[];
  /** Stage ordering edges */
  readonly stageOrderEdges: GitLabEdge[];
  /** Job needs/dependency edges */
  readonly needsEdges: GitLabEdge[];
  /** Extends edges (job templates) */
  readonly extendsEdges: GitLabEdge[];
  /** Artifact flow edges */
  readonly artifactEdges: GitLabEdge[];
  /** Include directive edges */
  readonly includeEdges: GitLabEdge[];
  /** Tool usage edges (Terraform/Helm) */
  readonly toolEdges: GitLabEdge[];
  /** Terraform-to-Helm flow edges */
  readonly tfToHelmEdges: GitLabEdge[];
}

// ============================================================================
// Default Options
// ============================================================================

/**
 * Default edge factory options
 */
const DEFAULT_EDGE_FACTORY_OPTIONS: Required<GitLabEdgeFactoryOptions> = {
  scanId: '',
  idGenerator: () => uuidv4(),
  defaultConfidence: 100,
  includeLocation: true,
};

// ============================================================================
// GitLabEdgeFactory Class
// ============================================================================

/**
 * Factory for creating GitLab CI graph edges.
 *
 * Creates edges representing:
 * - Stage ordering (implicit sequential flow)
 * - Job dependencies (needs:, dependencies:)
 * - Template inheritance (extends:)
 * - Include relationships (include:)
 * - Artifact flow between jobs
 * - Tool usage (Terraform, Helm)
 * - Terraform-to-Helm data flow
 *
 * @example
 * ```typescript
 * const factory = new GitLabEdgeFactory({
 *   scanId: 'scan-123',
 *   defaultConfidence: 100,
 * });
 *
 * const result = factory.createEdgesForPipeline(pipeline, nodes, filePath);
 * console.log(`Created ${result.edges.length} edges`);
 * ```
 */
export class GitLabEdgeFactory {
  private readonly scanId: string;
  private readonly idGenerator: () => string;
  private readonly defaultConfidence: number;
  private readonly includeLocation: boolean;

  /**
   * Creates a new GitLabEdgeFactory
   * @param options - Factory options
   */
  constructor(options: GitLabEdgeFactoryOptions) {
    const mergedOptions = { ...DEFAULT_EDGE_FACTORY_OPTIONS, ...options };

    this.scanId = mergedOptions.scanId;
    this.idGenerator = mergedOptions.idGenerator ?? DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator;
    this.defaultConfidence = mergedOptions.defaultConfidence ?? 100;
    this.includeLocation = mergedOptions.includeLocation ?? true;
  }

  // ==========================================================================
  // Main Factory Method
  // ==========================================================================

  /**
   * Create all edges for a pipeline.
   *
   * Analyzes the pipeline structure and creates edges for:
   * - Stage ordering (sequential stage flow)
   * - Job dependencies (needs:, dependencies:)
   * - Template inheritance (extends:)
   * - Include relationships
   * - Artifact flow
   * - Tool usage (Terraform, Helm)
   * - Terraform-to-Helm data flow
   *
   * @param pipeline - The parsed pipeline
   * @param nodes - Nodes created by node factory
   * @param filePath - Source file path for evidence
   * @returns EdgeCreationResult with all created edges
   */
  createEdgesForPipeline(
    pipeline: GitLabCIPipeline,
    nodes: GitLabNodeCreationResult,
    filePath: string
  ): GitLabEdgeCreationResult {
    const stageOrderEdges: GitLabEdge[] = [];
    const needsEdges: GitLabEdge[] = [];
    const extendsEdges: GitLabEdge[] = [];
    const artifactEdges: GitLabEdge[] = [];
    const includeEdges: GitLabEdge[] = [];
    const toolEdges: GitLabEdge[] = [];
    const tfToHelmEdges: GitLabEdge[] = [];

    // Create stage ordering edges
    stageOrderEdges.push(...this.createStageOrderEdges(
      pipeline.stages,
      nodes.stageNameToIdMap,
      filePath
    ));

    // Create include edges
    includeEdges.push(...this.createIncludeEdges(
      pipeline.includes,
      nodes.pipelineNode.id,
      filePath
    ));

    // Track Terraform and Helm jobs for artifact flow detection
    const terraformJobs = new Map<string, GitLabJob>();
    const helmJobs = new Map<string, GitLabJob>();

    // Process each job for edges
    for (const [jobName, job] of pipeline.jobs) {
      const jobNodeId = nodes.jobNameToIdMap.get(jobName);
      if (!jobNodeId) continue;

      // Create needs edges
      needsEdges.push(...this.createNeedsEdges(
        job,
        jobNodeId,
        nodes.jobNameToIdMap,
        filePath
      ));

      // Create extends edges
      extendsEdges.push(...this.createExtendsEdges(
        job,
        jobNodeId,
        nodes.jobNameToIdMap,
        filePath
      ));

      // Create artifact flow edges
      artifactEdges.push(...this.createArtifactFlowEdges(
        job,
        pipeline.jobs,
        nodes,
        filePath
      ));

      // Detect Terraform/Helm for tool edges and TF→Helm flow
      const toolInfo = this.detectToolsInJob(job);

      if (toolInfo.hasTerraform) {
        terraformJobs.set(jobName, job);
        if (toolInfo.terraformInfo) {
          toolEdges.push(...this.createToolEdgesForTerraform(
            jobNodeId,
            job,
            toolInfo.terraformInfo,
            filePath
          ));
        }
      }

      if (toolInfo.hasHelm) {
        helmJobs.set(jobName, job);
        if (toolInfo.helmInfo) {
          toolEdges.push(...this.createToolEdgesForHelm(
            jobNodeId,
            job,
            toolInfo.helmInfo,
            filePath
          ));
        }
      }
    }

    // Create Terraform-to-Helm flow edges
    tfToHelmEdges.push(...this.createTerraformToHelmFlowEdges(
      terraformJobs,
      helmJobs,
      pipeline.jobs,
      nodes,
      filePath
    ));

    // Combine all edges
    const edges: GitLabEdge[] = [
      ...stageOrderEdges,
      ...needsEdges,
      ...extendsEdges,
      ...artifactEdges,
      ...includeEdges,
      ...toolEdges,
      ...tfToHelmEdges,
    ];

    return {
      edges,
      stageOrderEdges,
      needsEdges,
      extendsEdges,
      artifactEdges,
      includeEdges,
      toolEdges,
      tfToHelmEdges,
    };
  }

  // ==========================================================================
  // Stage Order Edges
  // ==========================================================================

  /**
   * Create stage ordering edges (implicit sequential flow).
   *
   * GitLab CI stages execute in order - this creates edges to represent
   * the implicit ordering between consecutive stages.
   *
   * @param stages - Pipeline stages in order
   * @param stageNameToIdMap - Map from stage name to node ID
   * @param filePath - Source file path for evidence
   * @returns Array of stage order edges
   */
  createStageOrderEdges(
    stages: readonly GitLabStage[],
    stageNameToIdMap: Map<string, string>,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    for (let i = 1; i < stages.length; i++) {
      const prevStage = stages[i - 1];
      const currStage = stages[i];

      const prevStageId = stageNameToIdMap.get(prevStage.name);
      const currStageId = stageNameToIdMap.get(currStage.name);

      if (!prevStageId || !currStageId) continue;

      const evidence = this.createEvidence(
        filePath,
        prevStage.location,
        `stages:\n  - ${prevStage.name}\n  - ${currStage.name}`
      );

      edges.push({
        id: this.generateEdgeId(prevStageId, currStageId, 'gitlab_stage_order'),
        source: prevStageId,
        target: currStageId,
        type: 'gitlab_stage_order',
        label: `${prevStage.name} → ${currStage.name}`,
        metadata: {
          implicit: true,
          confidence: this.defaultConfidence,
          evidence: [evidence],
        },
      });
    }

    return edges;
  }

  // ==========================================================================
  // Needs Edges
  // ==========================================================================

  /**
   * Create needs edges for job dependencies.
   *
   * Creates edges for:
   * - needs: keyword (DAG dependencies)
   * - dependencies: keyword (legacy artifact dependencies)
   *
   * @param job - The job with dependencies
   * @param jobNodeId - ID of the job node
   * @param jobNameToIdMap - Map from job name to node ID
   * @param filePath - Source file path for evidence
   * @returns Array of needs edges
   */
  createNeedsEdges(
    job: GitLabJob,
    jobNodeId: string,
    jobNameToIdMap: Map<string, string>,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    // Process needs: keyword
    if (job.needs && job.needs.length > 0) {
      for (const need of job.needs) {
        const needJobName = isGitLabNeedObject(need) ? need.job : need;
        const needJobId = jobNameToIdMap.get(needJobName);

        if (!needJobId) continue;

        // Determine if artifacts should be passed
        const includeArtifacts = isGitLabNeedObject(need)
          ? need.artifacts !== false
          : true;

        // Determine if this is a cross-project dependency
        const isCrossProject = isGitLabNeedObject(need) && need.project !== undefined;

        const evidence = this.createEvidence(
          filePath,
          job.location,
          `needs:\n  - job: ${needJobName}${includeArtifacts ? '' : '\n    artifacts: false'}`
        );

        edges.push({
          id: this.generateEdgeId(needJobId, jobNodeId, 'gitlab_needs'),
          source: needJobId,
          target: jobNodeId,
          type: 'gitlab_needs',
          label: `needs ${needJobName}`,
          metadata: {
            implicit: false,
            confidence: this.defaultConfidence,
            artifactPaths: includeArtifacts ? [] : undefined,
            evidence: [evidence],
          },
        });
      }
    }

    // Process legacy dependencies: keyword
    if (job.dependencies && job.dependencies.length > 0) {
      for (const depName of job.dependencies) {
        const depJobId = jobNameToIdMap.get(depName);
        if (!depJobId) continue;

        const evidence = this.createEvidence(
          filePath,
          job.location,
          `dependencies:\n  - ${depName}`
        );

        edges.push({
          id: this.generateEdgeId(depJobId, jobNodeId, 'gitlab_dependencies'),
          source: depJobId,
          target: jobNodeId,
          type: 'gitlab_dependencies',
          label: `depends on ${depName}`,
          metadata: {
            implicit: false,
            confidence: this.defaultConfidence,
            evidence: [evidence],
          },
        });
      }
    }

    return edges;
  }

  // ==========================================================================
  // Extends Edges
  // ==========================================================================

  /**
   * Create extends edges for template inheritance.
   *
   * Creates edges from parent templates to jobs that extend them.
   *
   * @param job - The job with extends
   * @param jobNodeId - ID of the job node
   * @param jobNameToIdMap - Map from job name to node ID
   * @param filePath - Source file path for evidence
   * @returns Array of extends edges
   */
  createExtendsEdges(
    job: GitLabJob,
    jobNodeId: string,
    jobNameToIdMap: Map<string, string>,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    if (!job.extends) {
      return edges;
    }

    const extendsArray = Array.isArray(job.extends) ? job.extends : [job.extends];

    for (const parentName of extendsArray) {
      const parentJobId = jobNameToIdMap.get(parentName);

      // Parent might be in an included file, so we still create the edge
      // but target the name as a reference if ID not found
      const targetId = parentJobId ?? `template:${parentName}`;

      const evidence = this.createEvidence(
        filePath,
        job.location,
        `extends: ${Array.isArray(job.extends) ? `[${extendsArray.join(', ')}]` : parentName}`
      );

      edges.push({
        id: this.generateEdgeId(targetId, jobNodeId, 'gitlab_extends'),
        source: targetId,
        target: jobNodeId,
        type: 'gitlab_extends',
        label: `extends ${parentName}`,
        metadata: {
          implicit: false,
          confidence: parentJobId ? this.defaultConfidence : 80,
          extendsFrom: extendsArray,
          evidence: [evidence],
        },
      });
    }

    return edges;
  }

  // ==========================================================================
  // Artifact Flow Edges
  // ==========================================================================

  /**
   * Create artifact flow edges between jobs.
   *
   * Detects artifact flow based on:
   * - Explicit dependencies: keyword
   * - Implicit stage-based artifact passing
   * - needs: with artifacts: true (default)
   *
   * @param job - The job receiving artifacts
   * @param allJobs - All jobs in the pipeline
   * @param nodes - Node creation result with lookup maps
   * @param filePath - Source file path for evidence
   * @returns Array of artifact flow edges
   */
  createArtifactFlowEdges(
    job: GitLabJob,
    allJobs: ReadonlyMap<string, GitLabJob>,
    nodes: GitLabNodeCreationResult,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];
    const jobNodeId = nodes.jobNameToIdMap.get(job.name);
    if (!jobNodeId) return edges;

    // Process explicit dependencies with artifacts
    const artifactSources = new Set<string>();

    // From dependencies: keyword
    if (job.dependencies && job.dependencies.length > 0) {
      for (const depName of job.dependencies) {
        artifactSources.add(depName);
      }
    }

    // From needs: with artifacts (default true)
    if (job.needs && job.needs.length > 0) {
      for (const need of job.needs) {
        const needJobName = isGitLabNeedObject(need) ? need.job : need;
        const includeArtifacts = isGitLabNeedObject(need)
          ? need.artifacts !== false
          : true;

        if (includeArtifacts) {
          artifactSources.add(needJobName);
        }
      }
    }

    // Create artifact flow edges
    for (const sourceName of artifactSources) {
      const sourceJob = allJobs.get(sourceName);
      if (!sourceJob?.artifacts?.paths?.length) continue;

      const sourceJobId = nodes.jobNameToIdMap.get(sourceName);
      if (!sourceJobId) continue;

      const evidence = this.createEvidence(
        filePath,
        job.location,
        `# Artifacts from ${sourceName}:\n${sourceJob.artifacts.paths.map(p => `#   - ${p}`).join('\n')}`
      );

      edges.push({
        id: this.generateEdgeId(sourceJobId, jobNodeId, 'gitlab_artifact_flow'),
        source: sourceJobId,
        target: jobNodeId,
        type: 'gitlab_artifact_flow',
        label: `artifacts from ${sourceName}`,
        metadata: {
          implicit: false,
          confidence: this.defaultConfidence,
          artifactPaths: sourceJob.artifacts.paths,
          evidence: [evidence],
        },
      });
    }

    return edges;
  }

  // ==========================================================================
  // Include Edges
  // ==========================================================================

  /**
   * Create include edges for pipeline includes.
   *
   * Creates edges from the pipeline to included configurations.
   *
   * @param includes - Pipeline include directives
   * @param pipelineNodeId - ID of the pipeline node
   * @param filePath - Source file path for evidence
   * @returns Array of include edges
   */
  createIncludeEdges(
    includes: readonly GitLabInclude[],
    pipelineNodeId: string,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    for (const include of includes) {
      const includePath = this.getIncludePath(include);
      const targetId = `include:${includePath}`;

      const evidence = this.createEvidence(
        filePath,
        include.location,
        this.getIncludeSnippet(include)
      );

      edges.push({
        id: this.generateEdgeId(pipelineNodeId, targetId, 'gitlab_includes'),
        source: pipelineNodeId,
        target: targetId,
        type: 'gitlab_includes',
        label: `includes ${includePath}`,
        metadata: {
          implicit: false,
          confidence: this.defaultConfidence,
          includePath,
          evidence: [evidence],
        },
      });
    }

    return edges;
  }

  // ==========================================================================
  // Tool Edges
  // ==========================================================================

  /**
   * Create Terraform tool usage edges.
   *
   * @param jobNodeId - ID of the job node
   * @param job - The job with Terraform
   * @param tfInfo - Detected Terraform information
   * @param filePath - Source file path for evidence
   * @returns Array of Terraform usage edges
   */
  private createToolEdgesForTerraform(
    jobNodeId: string,
    job: GitLabJob,
    tfInfo: GitLabTerraformStepInfo,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    const evidence = this.createEvidence(
      filePath,
      job.location,
      `terraform ${tfInfo.command}${tfInfo.workingDirectory ? ` -chdir=${tfInfo.workingDirectory}` : ''}`
    );

    edges.push({
      id: this.generateEdgeId(jobNodeId, `terraform:${tfInfo.command}`, 'gitlab_uses_tf'),
      source: jobNodeId,
      target: jobNodeId, // Self-reference as TF is external
      type: 'gitlab_uses_tf',
      label: `terraform ${tfInfo.command}`,
      metadata: {
        implicit: false,
        confidence: tfInfo.confidence,
        terraformCommand: tfInfo.command,
        evidence: [evidence],
      },
    });

    return edges;
  }

  /**
   * Create Helm tool usage edges.
   *
   * @param jobNodeId - ID of the job node
   * @param job - The job with Helm
   * @param helmInfo - Detected Helm information
   * @param filePath - Source file path for evidence
   * @returns Array of Helm usage edges
   */
  private createToolEdgesForHelm(
    jobNodeId: string,
    job: GitLabJob,
    helmInfo: GitLabHelmStepInfo,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    const helmCommand = `helm ${helmInfo.command}${helmInfo.releaseName ? ` ${helmInfo.releaseName}` : ''}${helmInfo.chartPath ? ` ${helmInfo.chartPath}` : ''}`;

    const evidence = this.createEvidence(
      filePath,
      job.location,
      helmCommand
    );

    edges.push({
      id: this.generateEdgeId(jobNodeId, `helm:${helmInfo.command}`, 'gitlab_uses_helm'),
      source: jobNodeId,
      target: jobNodeId, // Self-reference as Helm is external
      type: 'gitlab_uses_helm',
      label: `helm ${helmInfo.command}`,
      metadata: {
        implicit: false,
        confidence: helmInfo.confidence,
        helmCommand: helmInfo.command,
        evidence: [evidence],
      },
    });

    return edges;
  }

  // ==========================================================================
  // Terraform-to-Helm Flow Edges
  // ==========================================================================

  /**
   * Create Terraform-to-Helm data flow edges.
   *
   * Detects TF→Helm flows when:
   * 1. Job A has terraform command with `terraform output` or artifacts.reports.terraform
   * 2. Job B has helm command and needs/depends on Job A
   * 3. Creates edge with flowType: 'terraform_to_helm'
   *
   * @param terraformJobs - Jobs with Terraform commands
   * @param helmJobs - Jobs with Helm commands
   * @param allJobs - All jobs in the pipeline
   * @param nodes - Node creation result with lookup maps
   * @param filePath - Source file path for evidence
   * @returns Array of TF→Helm flow edges
   */
  createTerraformToHelmFlowEdges(
    terraformJobs: Map<string, GitLabJob>,
    helmJobs: Map<string, GitLabJob>,
    allJobs: ReadonlyMap<string, GitLabJob>,
    nodes: GitLabNodeCreationResult,
    filePath: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    // Check each Helm job for dependencies on Terraform jobs
    for (const [helmJobName, helmJob] of helmJobs) {
      const helmJobId = nodes.jobNameToIdMap.get(helmJobName);
      if (!helmJobId) continue;

      // Collect all dependencies (needs + dependencies)
      const dependencies = new Set<string>();

      if (helmJob.needs) {
        for (const need of helmJob.needs) {
          const needJobName = isGitLabNeedObject(need) ? need.job : need;
          dependencies.add(needJobName);
        }
      }

      if (helmJob.dependencies) {
        for (const dep of helmJob.dependencies) {
          dependencies.add(dep);
        }
      }

      // Check if any dependency is a Terraform job
      for (const depName of dependencies) {
        const tfJob = terraformJobs.get(depName);
        if (!tfJob) continue;

        const tfJobId = nodes.jobNameToIdMap.get(depName);
        if (!tfJobId) continue;

        // Check if TF job produces outputs or terraform reports
        const hasTfOutputs = this.jobProducesTerraformOutputs(tfJob);
        const hasTfReports = tfJob.artifacts?.reports?.terraform !== undefined;

        if (!hasTfOutputs && !hasTfReports) continue;

        // Determine confidence based on evidence strength
        const confidence = hasTfOutputs && hasTfReports ? 95 : (hasTfOutputs ? 85 : 80);

        const evidence = this.createEvidence(
          filePath,
          helmJob.location,
          `# Terraform → Helm flow:\n# ${depName}: terraform outputs\n# ${helmJobName}: helm deploy using TF outputs`
        );

        edges.push({
          id: this.generateEdgeId(tfJobId, helmJobId, 'gitlab_artifact_flow'),
          source: tfJobId,
          target: helmJobId,
          type: 'gitlab_artifact_flow',
          label: `terraform outputs → helm`,
          metadata: {
            implicit: true, // Inferred relationship
            confidence,
            artifactPaths: tfJob.artifacts?.paths,
            evidence: [evidence],
            // Custom metadata for TF→Helm flow
            flowType: 'terraform_to_helm',
            terraformCommand: 'output',
          } as GitLabEdgeMetadata & { flowType: string; terraformCommand: string },
        });
      }
    }

    return edges;
  }

  // ==========================================================================
  // Tool Detection
  // ==========================================================================

  /**
   * Detect tools used in a job.
   *
   * @param job - The job to analyze
   * @returns Tool detection result
   */
  private detectToolsInJob(job: GitLabJob): ToolDetectionResult {
    const scripts = this.getAllScripts(job);
    const scriptContent = scripts.join('\n');

    const hasTerraform = this.detectTerraformInScript(scriptContent) ||
                          this.detectTerraformInImage(job) ||
                          this.detectTerraformInExtends(job);

    const hasHelm = this.detectHelmInScript(scriptContent) ||
                     this.detectHelmInImage(job);

    let terraformInfo: GitLabTerraformStepInfo | undefined;
    let helmInfo: GitLabHelmStepInfo | undefined;

    if (hasTerraform) {
      const command = this.extractTerraformCommand(scriptContent);
      terraformInfo = {
        jobName: job.name,
        stage: job.stage,
        command: command ?? 'unknown',
        workingDirectory: this.extractWorkingDirectory(scriptContent),
        usesCloud: this.detectTerraformCloud(scriptContent, job),
        varFiles: this.extractVarFiles(scriptContent),
        envVars: this.extractEnvVars(job),
        confidence: command ? 90 : 70,
        location: job.location,
      };
    }

    if (hasHelm) {
      const command = this.extractHelmCommand(scriptContent);
      helmInfo = {
        jobName: job.name,
        stage: job.stage,
        command: command ?? 'unknown',
        releaseName: this.extractHelmReleaseName(scriptContent),
        chartPath: this.extractHelmChart(scriptContent),
        namespace: this.extractNamespace(scriptContent),
        valuesFiles: this.extractHelmValuesFiles(scriptContent),
        setValues: {},
        dryRun: scriptContent.includes('--dry-run'),
        atomic: scriptContent.includes('--atomic'),
        wait: scriptContent.includes('--wait'),
        confidence: command ? 90 : 70,
        location: job.location,
      };
    }

    return { hasTerraform, hasHelm, terraformInfo, helmInfo };
  }

  // ==========================================================================
  // Helper Methods - Script Extraction
  // ==========================================================================

  /**
   * Get all scripts from a job.
   */
  private getAllScripts(job: GitLabJob): string[] {
    const scripts: string[] = [];
    if (job.beforeScript) {
      scripts.push(...job.beforeScript);
    }
    scripts.push(...job.script);
    if (job.afterScript) {
      scripts.push(...job.afterScript);
    }
    return scripts;
  }

  // ==========================================================================
  // Helper Methods - Terraform Detection
  // ==========================================================================

  /**
   * Detect Terraform commands in script.
   */
  private detectTerraformInScript(content: string): boolean {
    return /\bterraform\s+(init|plan|apply|destroy|validate|fmt|output|import|state|workspace|refresh)/i.test(content) ||
           /\bterragrunt\s+(init|plan|apply|destroy|validate|run-all)/i.test(content) ||
           /\bgitlab-terraform\s+/i.test(content);
  }

  /**
   * Detect Terraform from Docker image.
   */
  private detectTerraformInImage(job: GitLabJob): boolean {
    const imageName = typeof job.image === 'string' ? job.image : job.image?.name;
    if (!imageName) return false;

    return imageName.includes('terraform') ||
           imageName.includes('hashicorp') ||
           imageName.includes('gitlab-org/terraform-images');
  }

  /**
   * Detect Terraform from extends templates.
   */
  private detectTerraformInExtends(job: GitLabJob): boolean {
    if (!job.extends) return false;
    const extendsArray = Array.isArray(job.extends) ? job.extends : [job.extends];
    return extendsArray.some(e =>
      e.toLowerCase().includes('terraform') ||
      e.toLowerCase().includes('.tf')
    );
  }

  /**
   * Extract Terraform command from script.
   */
  private extractTerraformCommand(content: string): TerraformCommand | null {
    const match = /\bterraform\s+(init|plan|apply|destroy|validate|fmt|output|import|state|workspace|refresh)/i.exec(content);
    if (match) {
      return match[1].toLowerCase() as TerraformCommand;
    }
    return null;
  }

  /**
   * Check if job produces Terraform outputs.
   */
  private jobProducesTerraformOutputs(job: GitLabJob): boolean {
    const scripts = this.getAllScripts(job);
    const scriptContent = scripts.join('\n');

    return /\bterraform\s+output/i.test(scriptContent) ||
           /\bterragrunt\s+output/i.test(scriptContent) ||
           /TERRAFORM_OUTPUT/i.test(scriptContent) ||
           /TF_OUTPUT/i.test(scriptContent);
  }

  /**
   * Detect Terraform Cloud usage.
   */
  private detectTerraformCloud(content: string, job: GitLabJob): boolean {
    if (content.includes('TF_CLOUD_') || content.includes('TFE_')) {
      return true;
    }
    if (job.variables) {
      const varNames = Object.keys(job.variables);
      return varNames.some(name =>
        name.startsWith('TF_CLOUD_') || name.startsWith('TFE_')
      );
    }
    return false;
  }

  // ==========================================================================
  // Helper Methods - Helm Detection
  // ==========================================================================

  /**
   * Detect Helm commands in script.
   */
  private detectHelmInScript(content: string): boolean {
    return /\bhelm\s+(install|upgrade|uninstall|rollback|template|lint|package|push|pull|repo|dependency|test)/i.test(content) ||
           /\bhelmfile\s+(apply|sync|diff|template|lint)/i.test(content);
  }

  /**
   * Detect Helm from Docker image.
   */
  private detectHelmInImage(job: GitLabJob): boolean {
    const imageName = typeof job.image === 'string' ? job.image : job.image?.name;
    if (!imageName) return false;

    return imageName.includes('helm') ||
           imageName.includes('alpine/k8s') ||
           imageName.includes('dtzar/helm-kubectl');
  }

  /**
   * Extract Helm command from script.
   */
  private extractHelmCommand(content: string): HelmCommand | null {
    const match = /\bhelm\s+(install|upgrade|uninstall|rollback|template|lint|package|push|pull|repo|dependency|test)/i.exec(content);
    if (match) {
      return match[1].toLowerCase() as HelmCommand;
    }
    return null;
  }

  // ==========================================================================
  // Helper Methods - Value Extraction
  // ==========================================================================

  /**
   * Extract working directory from script.
   */
  private extractWorkingDirectory(content: string): string | undefined {
    const cdMatch = /cd\s+([^\s;&|]+)/.exec(content);
    if (cdMatch) return cdMatch[1];

    const wdMatch = /TF_ROOT[=:]\s*["']?([^\s"']+)["']?/i.exec(content);
    if (wdMatch) return wdMatch[1];

    return undefined;
  }

  /**
   * Extract var files from terraform command.
   */
  private extractVarFiles(content: string): readonly string[] {
    const varFiles: string[] = [];
    const pattern = /-var-file[=\s]+["']?([^\s"']+)["']?/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      varFiles.push(match[1]);
    }
    return varFiles;
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
   * Extract namespace from helm/kubectl command.
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
   * Extract environment variables from job.
   */
  private extractEnvVars(job: GitLabJob): Record<string, string> {
    const envVars: Record<string, string> = {};
    if (job.variables) {
      for (const [key, variable] of Object.entries(job.variables)) {
        envVars[key] = typeof variable === 'string' ? variable : variable.value;
      }
    }
    return envVars;
  }

  // ==========================================================================
  // Helper Methods - Include Handling
  // ==========================================================================

  /**
   * Get the path/reference for an include directive.
   */
  private getIncludePath(include: GitLabInclude): string {
    switch (include.type) {
      case 'local':
        return include.local;
      case 'file':
        return Array.isArray(include.file) ? include.file.join(', ') : String(include.file);
      case 'remote':
        return include.remote;
      case 'template':
        return include.template;
      case 'project':
        const files = Array.isArray(include.file) ? include.file.join(', ') : include.file;
        return `${include.project}:${files}${include.ref ? `@${include.ref}` : ''}`;
      case 'component':
        return include.component;
      default:
        return 'unknown';
    }
  }

  /**
   * Get YAML snippet for an include directive.
   */
  private getIncludeSnippet(include: GitLabInclude): string {
    switch (include.type) {
      case 'local':
        return `include:\n  - local: '${include.local}'`;
      case 'file':
        return `include:\n  - file: ${JSON.stringify(include.file)}`;
      case 'remote':
        return `include:\n  - remote: '${include.remote}'`;
      case 'template':
        return `include:\n  - template: '${include.template}'`;
      case 'project':
        return `include:\n  - project: '${include.project}'\n    file: ${JSON.stringify(include.file)}`;
      case 'component':
        return `include:\n  - component: '${include.component}'`;
      default:
        return 'include: ...';
    }
  }

  // ==========================================================================
  // Helper Methods - Edge Utilities
  // ==========================================================================

  /**
   * Generate a unique edge ID.
   *
   * @param source - Source node ID
   * @param target - Target node ID
   * @param type - Edge type
   * @returns Unique edge ID
   */
  private generateEdgeId(source: string, target: string, type: GitLabEdgeType): string {
    return `gitlab_edge_${type}_${this.idGenerator()}`;
  }

  /**
   * Create evidence for an edge.
   *
   * @param filePath - Source file path
   * @param location - Source location (optional)
   * @param snippet - Code snippet
   * @returns Edge evidence object
   */
  private createEvidence(
    filePath: string,
    location: SourceLocation | undefined,
    snippet: string
  ): EdgeEvidence {
    return {
      type: 'syntax',
      description: snippet,
      location: location ? {
        file: filePath,
        lineStart: location.lineStart,
        lineEnd: location.lineEnd,
        columnStart: location.columnStart,
        columnEnd: location.columnEnd,
      } : undefined,
    };
  }
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create a GitLabEdgeFactory with the given options.
 *
 * @param options - Factory options
 * @returns New GitLabEdgeFactory instance
 *
 * @example
 * ```typescript
 * const factory = createGitLabEdgeFactory({ scanId: 'scan-123' });
 * ```
 */
export function createGitLabEdgeFactory(options: GitLabEdgeFactoryOptions): GitLabEdgeFactory {
  return new GitLabEdgeFactory(options);
}

/**
 * Convenience function for one-off edge creation from a pipeline.
 *
 * @param pipeline - Parsed pipeline data
 * @param nodes - Node creation result
 * @param filePath - Source file path
 * @param scanId - Scan ID for tracking
 * @returns Edge creation result
 *
 * @example
 * ```typescript
 * const result = createGitLabEdges(pipeline, nodes, filePath, 'scan-123');
 * console.log(`Created ${result.edges.length} edges`);
 * ```
 */
export function createGitLabEdges(
  pipeline: GitLabCIPipeline,
  nodes: GitLabNodeCreationResult,
  filePath: string,
  scanId: string
): GitLabEdgeCreationResult {
  const factory = new GitLabEdgeFactory({ scanId });
  return factory.createEdgesForPipeline(pipeline, nodes, filePath);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for GitLab stage order edge.
 */
export function isGitLabStageOrderEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_stage_order';
}

/**
 * Type guard for GitLab needs edge.
 */
export function isGitLabNeedsEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_needs';
}

/**
 * Type guard for GitLab dependencies edge.
 */
export function isGitLabDependenciesEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_dependencies';
}

/**
 * Type guard for GitLab extends edge.
 */
export function isGitLabExtendsEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_extends';
}

/**
 * Type guard for GitLab includes edge.
 */
export function isGitLabIncludesEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_includes';
}

/**
 * Type guard for GitLab Terraform usage edge.
 */
export function isGitLabUsesTfEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_uses_tf';
}

/**
 * Type guard for GitLab Helm usage edge.
 */
export function isGitLabUsesHelmEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_uses_helm';
}

/**
 * Type guard for GitLab artifact flow edge.
 */
export function isGitLabArtifactFlowEdge(edge: GitLabEdge): boolean {
  return edge.type === 'gitlab_artifact_flow';
}

/**
 * Type guard for Terraform-to-Helm flow edge.
 */
export function isTerraformToHelmFlowEdge(edge: GitLabEdge): boolean {
  if (edge.type !== 'gitlab_artifact_flow') return false;
  const metadata = edge.metadata as GitLabEdgeMetadata & { flowType?: string };
  return metadata.flowType === 'terraform_to_helm';
}
