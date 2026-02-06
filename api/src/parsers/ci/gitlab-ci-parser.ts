/**
 * GitLab CI Parser
 * @module parsers/ci/gitlab-ci-parser
 *
 * Parses GitLab CI/CD configuration files (.gitlab-ci.yml)
 * Extracts pipeline structure, jobs, stages, includes, and tool detection.
 *
 * TASK-XREF-002: GitLab CI Parser
 * TASK-GITLAB-001: Pipeline structure parsing
 * TASK-GITLAB-002: Job and stage extraction
 * TASK-GITLAB-003: Terraform/Helm step detection
 */

import * as yaml from 'yaml';
import * as path from 'path';
import {
  BaseParser,
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
} from '../base/parser';
import { SourceLocation } from '../terraform/types';
import {
  GitLabCIParseResult,
  GitLabCIPipeline,
  GitLabJob,
  GitLabStage,
  GitLabInclude,
  GitLabLocalInclude,
  GitLabFileInclude,
  GitLabRemoteInclude,
  GitLabTemplateInclude,
  GitLabProjectInclude,
  GitLabComponentInclude,
  GitLabCIParserOptions,
  GitLabCIParseError,
  GitLabCIParseMetadata,
  GitLabDefault,
  GitLabWorkflow,
  GitLabRule,
  GitLabImage,
  GitLabService,
  GitLabVariable,
  GitLabNeed,
  GitLabArtifacts,
  GitLabCache,
  GitLabEnvironment,
  GitLabTrigger,
  GitLabParallel,
  GitLabRetry,
  GitLabPipelineNode,
  GitLabStageNode,
  GitLabJobNode,
  GitLabEdge,
  GitLabTerraformStepInfo,
  GitLabHelmStepInfo,
  GitLabKubernetesStepInfo,
  GitLabDockerStepInfo,
  GitLabToolStepInfo,
  GitLabToolOperation,
  TerraformCommand,
  HelmCommand,
  KubernetesCommand,
  DockerCommand,
  GitLabWhen,
  DEFAULT_GITLAB_CI_PARSER_OPTIONS,
  GITLAB_RESERVED_KEYWORDS,
  GITLAB_DEFAULT_STAGES,
  GITLAB_TERRAFORM_COMMAND_PATTERNS,
  GITLAB_HELM_COMMAND_PATTERNS,
  GITLAB_KUBERNETES_COMMAND_PATTERNS,
  GITLAB_DOCKER_COMMAND_PATTERNS,
  isGitLabNeedObject,
  isGitLabVariableObject,
  createEmptyGitLabCIParseResult,
  createGitLabPipelineId,
  createGitLabStageId,
  createGitLabJobId,
} from './types';
import { BaseNode, NodeLocation, EdgeMetadata } from '../../types/graph';

// ============================================================================
// Include Resolver
// ============================================================================

/**
 * Resolves GitLab CI include directives
 */
export class GitLabIncludeResolver {
  private readonly maxDepth: number;
  private readonly basePath: string;

  constructor(basePath: string, maxDepth: number = 10) {
    this.basePath = basePath;
    this.maxDepth = maxDepth;
  }

  /**
   * Parse include directive from YAML
   */
  parseInclude(includeValue: unknown, location?: SourceLocation): GitLabInclude[] {
    const includes: GitLabInclude[] = [];

    if (typeof includeValue === 'string') {
      // Simple string include - treated as local
      includes.push({
        type: 'local',
        local: includeValue,
        location,
      });
    } else if (Array.isArray(includeValue)) {
      // Array of includes
      for (const item of includeValue) {
        includes.push(...this.parseSingleInclude(item, location));
      }
    } else if (typeof includeValue === 'object' && includeValue !== null) {
      // Single object include
      includes.push(...this.parseSingleInclude(includeValue, location));
    }

    return includes;
  }

  /**
   * Parse a single include object
   */
  private parseSingleInclude(
    item: unknown,
    location?: SourceLocation
  ): GitLabInclude[] {
    if (typeof item === 'string') {
      return [{
        type: 'local',
        local: item,
        location,
      }];
    }

    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const obj = item as Record<string, unknown>;

    // Local include
    if ('local' in obj && typeof obj.local === 'string') {
      return [{
        type: 'local',
        local: obj.local,
        location,
      } as GitLabLocalInclude];
    }

    // File include (same project, multiple files)
    if ('file' in obj) {
      const files = Array.isArray(obj.file)
        ? obj.file.filter((f): f is string => typeof f === 'string')
        : typeof obj.file === 'string' ? [obj.file] : [];
      return [{
        type: 'file',
        file: files,
        location,
      } as GitLabFileInclude];
    }

    // Remote include
    if ('remote' in obj && typeof obj.remote === 'string') {
      return [{
        type: 'remote',
        remote: obj.remote,
        location,
      } as GitLabRemoteInclude];
    }

    // Template include
    if ('template' in obj && typeof obj.template === 'string') {
      return [{
        type: 'template',
        template: obj.template,
        location,
      } as GitLabTemplateInclude];
    }

    // Project include
    if ('project' in obj && typeof obj.project === 'string') {
      const file = Array.isArray(obj.file)
        ? obj.file.filter((f): f is string => typeof f === 'string')
        : typeof obj.file === 'string' ? obj.file : [];
      return [{
        type: 'project',
        project: obj.project,
        file,
        ref: typeof obj.ref === 'string' ? obj.ref : undefined,
        location,
      } as GitLabProjectInclude];
    }

    // Component include
    if ('component' in obj && typeof obj.component === 'string') {
      return [{
        type: 'component',
        component: obj.component,
        inputs: obj.inputs as Record<string, unknown> | undefined,
        location,
      } as GitLabComponentInclude];
    }

    return [];
  }

  /**
   * Resolve local include path
   */
  resolveLocalPath(localPath: string): string {
    if (path.isAbsolute(localPath)) {
      return localPath;
    }
    return path.resolve(this.basePath, localPath);
  }
}

// ============================================================================
// Tool Detector
// ============================================================================

/**
 * Detector for IaC tools in GitLab CI jobs
 */
export class GitLabToolDetector {
  /**
   * Detect Terraform commands in job scripts
   */
  detectTerraformInJob(
    job: GitLabJob,
    filePath: string
  ): GitLabTerraformStepInfo | null {
    const scripts = this.getAllScripts(job);
    const scriptContent = scripts.join('\n');

    for (const pattern of GITLAB_TERRAFORM_COMMAND_PATTERNS) {
      const match = pattern.exec(scriptContent);
      if (match) {
        const command = this.parseTerraformCommand(match[1]);
        const workingDirectory = this.extractWorkingDirectory(scriptContent);
        const varFiles = this.extractVarFiles(scriptContent);
        const variables = this.extractTerraformVariables(scriptContent);

        return {
          jobName: job.name,
          stage: job.stage,
          command,
          workingDirectory,
          usesCloud: this.detectsTerraformCloud(scriptContent, job),
          varFiles,
          variables,
          envVars: this.extractEnvVars(job),
          confidence: 90,
          location: job.location,
        };
      }
    }

    // Check for GitLab Terraform template usage
    if (job.extends) {
      const extendsArray = Array.isArray(job.extends) ? job.extends : [job.extends];
      if (extendsArray.some(e => e.includes('terraform') || e.includes('Terraform'))) {
        return {
          jobName: job.name,
          stage: job.stage,
          command: 'unknown',
          usesCloud: false,
          varFiles: [],
          envVars: this.extractEnvVars(job),
          confidence: 70,
          location: job.location,
        };
      }
    }

    return null;
  }

  /**
   * Detect Helm commands in job scripts
   */
  detectHelmInJob(
    job: GitLabJob,
    filePath: string
  ): GitLabHelmStepInfo | null {
    const scripts = this.getAllScripts(job);
    const scriptContent = scripts.join('\n');

    for (const pattern of GITLAB_HELM_COMMAND_PATTERNS) {
      const match = pattern.exec(scriptContent);
      if (match) {
        const command = this.parseHelmCommand(match[1]);
        const releaseName = this.extractHelmReleaseName(scriptContent);
        const chartPath = this.extractHelmChart(scriptContent);
        const namespace = this.extractNamespace(scriptContent);
        const valuesFiles = this.extractHelmValuesFiles(scriptContent);

        return {
          jobName: job.name,
          stage: job.stage,
          command,
          releaseName,
          chartPath,
          namespace,
          valuesFiles,
          setValues: {},
          dryRun: scriptContent.includes('--dry-run'),
          atomic: scriptContent.includes('--atomic'),
          wait: scriptContent.includes('--wait'),
          confidence: 90,
          location: job.location,
        };
      }
    }

    return null;
  }

  /**
   * Detect Kubernetes commands in job scripts
   */
  detectKubernetesInJob(
    job: GitLabJob,
    filePath: string
  ): GitLabKubernetesStepInfo | null {
    const scripts = this.getAllScripts(job);
    const scriptContent = scripts.join('\n');

    for (const pattern of GITLAB_KUBERNETES_COMMAND_PATTERNS) {
      const match = pattern.exec(scriptContent);
      if (match) {
        const command = this.parseKubernetesCommand(match[1]);
        const namespace = this.extractNamespace(scriptContent);
        const manifests = this.extractKubernetesManifests(scriptContent);
        const resourceInfo = this.extractKubernetesResource(scriptContent);

        return {
          jobName: job.name,
          stage: job.stage,
          command,
          resourceType: resourceInfo.type,
          resourceName: resourceInfo.name,
          namespace,
          manifests,
          confidence: 90,
          location: job.location,
        };
      }
    }

    return null;
  }

  /**
   * Detect Docker commands in job scripts
   */
  detectDockerInJob(
    job: GitLabJob,
    filePath: string
  ): GitLabDockerStepInfo | null {
    const scripts = this.getAllScripts(job);
    const scriptContent = scripts.join('\n');

    for (const pattern of GITLAB_DOCKER_COMMAND_PATTERNS) {
      const match = pattern.exec(scriptContent);
      if (match) {
        const command = this.parseDockerCommand(match[1], scriptContent);
        const imageInfo = this.extractDockerImage(scriptContent);
        const dockerfile = this.extractDockerfile(scriptContent);
        const context = this.extractDockerContext(scriptContent);
        const registry = this.extractDockerRegistry(scriptContent);
        const buildArgs = this.extractDockerBuildArgs(scriptContent);
        const tags = this.extractDockerTags(scriptContent);

        return {
          jobName: job.name,
          stage: job.stage,
          command,
          image: imageInfo,
          dockerfile,
          context,
          registry,
          buildArgs,
          tags,
          confidence: 90,
          location: job.location,
        };
      }
    }

    return null;
  }

  /**
   * Get all scripts from a job
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

  /**
   * Parse Terraform command from match
   */
  private parseTerraformCommand(cmd: string): TerraformCommand {
    const normalized = cmd.toLowerCase();
    const commands: TerraformCommand[] = [
      'init', 'validate', 'plan', 'apply', 'destroy', 'fmt',
      'output', 'import', 'state', 'workspace', 'refresh',
      'taint', 'untaint', 'force-unlock',
    ];
    return commands.find(c => normalized === c) ?? 'unknown';
  }

  /**
   * Parse Helm command from match
   */
  private parseHelmCommand(cmd: string): HelmCommand {
    const normalized = cmd.toLowerCase();
    const commands: HelmCommand[] = [
      'install', 'upgrade', 'uninstall', 'rollback', 'template',
      'lint', 'package', 'push', 'pull', 'repo', 'dependency', 'test',
    ];
    return commands.find(c => normalized === c) ?? 'unknown';
  }

  /**
   * Extract working directory from script
   */
  private extractWorkingDirectory(content: string): string | undefined {
    const cdMatch = /cd\s+([^\s;&|]+)/.exec(content);
    if (cdMatch) return cdMatch[1];

    const wdMatch = /TF_ROOT[=:]\s*["']?([^\s"']+)["']?/i.exec(content);
    if (wdMatch) return wdMatch[1];

    return undefined;
  }

  /**
   * Extract var files from script
   */
  private extractVarFiles(content: string): readonly string[] {
    const varFiles: string[] = [];
    const varFilePattern = /-var-file[=\s]+["']?([^\s"']+)["']?/g;

    let match: RegExpExecArray | null;
    while ((match = varFilePattern.exec(content)) !== null) {
      varFiles.push(match[1]);
    }

    return varFiles;
  }

  /**
   * Extract Terraform variables from script
   */
  private extractTerraformVariables(content: string): Record<string, string> {
    const variables: Record<string, string> = {};
    const varPattern = /-var\s+["']?([^=]+)=([^\s"']+)["']?/g;

    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(content)) !== null) {
      variables[match[1]] = match[2];
    }

    return variables;
  }

  /**
   * Detect if using Terraform Cloud
   */
  private detectsTerraformCloud(content: string, job: GitLabJob): boolean {
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

  /**
   * Extract environment variables from job
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

  /**
   * Extract Helm release name
   */
  private extractHelmReleaseName(content: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = /helm\s+(install|upgrade)\s+([^\s]+)/.exec(line);
      if (match) return match[2];
    }
    return undefined;
  }

  /**
   * Extract Helm chart path
   */
  private extractHelmChart(content: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = /helm\s+(install|upgrade)\s+\S+\s+([^\s]+)/.exec(line);
      if (match) return match[2];
    }
    return undefined;
  }

  /**
   * Extract Kubernetes namespace
   */
  private extractNamespace(content: string): string | undefined {
    const match = /-n\s+([^\s]+)|--namespace[=\s]+([^\s]+)/.exec(content);
    if (match) return match[1] || match[2];
    return undefined;
  }

  /**
   * Extract Helm values files
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
   * Parse Kubernetes command from match
   */
  private parseKubernetesCommand(cmd: string): KubernetesCommand {
    const normalized = cmd.toLowerCase();
    const commands: KubernetesCommand[] = [
      'apply', 'delete', 'create', 'get', 'describe', 'logs',
      'exec', 'rollout', 'scale', 'patch', 'label', 'annotate',
      'port-forward', 'config',
    ];
    return commands.find(c => normalized === c) ?? 'unknown';
  }

  /**
   * Parse Docker command from match
   */
  private parseDockerCommand(cmd: string, content: string): DockerCommand {
    // Handle special cases
    if (content.includes('kaniko')) return 'build';
    if (content.includes('buildah')) {
      if (cmd?.toLowerCase() === 'bud') return 'build';
    }

    const normalized = cmd?.toLowerCase();
    const commands: DockerCommand[] = [
      'build', 'push', 'pull', 'run', 'compose', 'login',
      'logout', 'tag', 'buildx', 'manifest',
    ];
    return commands.find(c => normalized === c) ?? 'unknown';
  }

  /**
   * Extract Kubernetes manifests from script
   */
  private extractKubernetesManifests(content: string): readonly string[] {
    const manifests: string[] = [];
    const pattern = /-f\s+([^\s]+\.ya?ml)/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      manifests.push(match[1]);
    }

    return manifests;
  }

  /**
   * Extract Kubernetes resource type and name
   */
  private extractKubernetesResource(content: string): { type?: string; name?: string } {
    const match = /kubectl\s+\w+\s+(\w+)\/(\S+)|kubectl\s+\w+\s+(\w+)\s+(\S+)/.exec(content);
    if (match) {
      if (match[1] && match[2]) {
        return { type: match[1], name: match[2] };
      }
      if (match[3] && match[4]) {
        return { type: match[3], name: match[4] };
      }
    }
    return {};
  }

  /**
   * Extract Docker image reference
   */
  private extractDockerImage(content: string): string | undefined {
    // docker push/pull image
    const pushPullMatch = /docker\s+(push|pull)\s+([^\s]+)/.exec(content);
    if (pushPullMatch) return pushPullMatch[2];

    // docker build -t image
    const buildMatch = /docker\s+build\s+.*-t\s+([^\s]+)/.exec(content);
    if (buildMatch) return buildMatch[1];

    // docker tag source target
    const tagMatch = /docker\s+tag\s+[^\s]+\s+([^\s]+)/.exec(content);
    if (tagMatch) return tagMatch[1];

    return undefined;
  }

  /**
   * Extract Dockerfile path
   */
  private extractDockerfile(content: string): string | undefined {
    const match = /-f\s+([^\s]+Dockerfile[^\s]*)|--file[=\s]+([^\s]+)/.exec(content);
    if (match) return match[1] || match[2];
    return undefined;
  }

  /**
   * Extract Docker build context
   */
  private extractDockerContext(content: string): string | undefined {
    // Usually the last argument to docker build
    const match = /docker\s+build\s+[^-].*\s+(\S+)$/.exec(content);
    if (match) return match[1];
    return '.';
  }

  /**
   * Extract Docker registry
   */
  private extractDockerRegistry(content: string): string | undefined {
    // docker login registry
    const loginMatch = /docker\s+login\s+([^\s]+)/.exec(content);
    if (loginMatch && !loginMatch[1].startsWith('-')) return loginMatch[1];

    // Extract from image name (e.g., registry.gitlab.com/...)
    const imageMatch = /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s:]+)/.exec(content);
    if (imageMatch) return imageMatch[1];

    return undefined;
  }

  /**
   * Extract Docker build arguments
   */
  private extractDockerBuildArgs(content: string): Record<string, string> {
    const args: Record<string, string> = {};
    const pattern = /--build-arg\s+([^=]+)=([^\s]+)/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      args[match[1]] = match[2];
    }

    return Object.keys(args).length > 0 ? args : {};
  }

  /**
   * Extract Docker tags
   */
  private extractDockerTags(content: string): readonly string[] {
    const tags: string[] = [];
    const pattern = /-t\s+([^\s]+)/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      tags.push(match[1]);
    }

    return tags;
  }
}

// ============================================================================
// Node Factory
// ============================================================================

/**
 * Factory for creating GitLab CI graph nodes
 */
export class GitLabNodeFactory {
  private idCounter = 0;

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `gitlab-node-${++this.idCounter}-${Date.now()}`;
  }

  /**
   * Create a pipeline node
   */
  createPipelineNode(
    pipeline: GitLabCIPipeline,
    scanId: string
  ): GitLabPipelineNode {
    const pipelineId = createGitLabPipelineId(pipeline.filePath);
    return {
      id: pipelineId,
      name: path.basename(pipeline.filePath),
      type: 'gitlab_pipeline',
      location: this.toNodeLocation(pipeline.location),
      metadata: { scanId },
      stageCount: pipeline.stages.length,
      jobCount: pipeline.jobs.size,
      hasIncludes: pipeline.includes.length > 0,
      includeCount: pipeline.includes.length,
      hasWorkflow: pipeline.workflow !== undefined,
    };
  }

  /**
   * Create a stage node
   */
  createStageNode(
    stage: GitLabStage,
    pipelineId: string,
    scanId: string
  ): GitLabStageNode {
    const stageId = createGitLabStageId(pipelineId, stage.name);
    return {
      id: stageId,
      name: stage.name,
      type: 'gitlab_stage',
      location: stage.location
        ? this.toNodeLocation(stage.location)
        : { file: '', lineStart: 1, lineEnd: 1 },
      metadata: { scanId },
      pipelineId,
      order: stage.order,
      jobCount: stage.jobNames.length,
    };
  }

  /**
   * Create a job node
   */
  createJobNode(
    job: GitLabJob,
    pipelineId: string,
    scanId: string,
    hasTerraform: boolean,
    hasHelm: boolean,
    hasKubernetes: boolean = false,
    hasDocker: boolean = false
  ): GitLabJobNode {
    const jobId = createGitLabJobId(pipelineId, job.name);

    // Extract environment name from string or object
    const environmentName = typeof job.environment === 'string'
      ? job.environment
      : job.environment?.name;

    // Determine allowFailure boolean value
    const allowFailureValue = typeof job.allowFailure === 'boolean'
      ? job.allowFailure
      : job.allowFailure !== undefined;

    // Extract image name from string or object
    const imageName = typeof job.image === 'string'
      ? job.image
      : job.image?.name;

    return {
      id: jobId,
      name: job.name,
      type: 'gitlab_job',
      location: this.toNodeLocation(job.location),
      metadata: { scanId },
      pipelineId,
      stage: job.stage,
      hidden: job.hidden,
      hasRules: (job.rules?.length ?? 0) > 0,
      hasNeeds: (job.needs?.length ?? 0) > 0,
      needsCount: job.needs?.length ?? 0,
      hasArtifacts: job.artifacts !== undefined,
      hasCache: job.cache !== undefined,
      hasTerraform,
      hasHelm,
      hasKubernetes,
      hasDocker,
      when: job.when ?? 'on_success',
      allowFailure: allowFailureValue,
      environment: environmentName,
      isTrigger: job.trigger !== undefined,
      hasParallel: job.parallel !== undefined,
      image: imageName,
      tags: job.tags ?? [],
    };
  }

  /**
   * Convert SourceLocation to NodeLocation
   */
  private toNodeLocation(location: SourceLocation): NodeLocation {
    return {
      file: location.file,
      lineStart: location.lineStart,
      lineEnd: location.lineEnd,
      columnStart: location.columnStart,
      columnEnd: location.columnEnd,
    };
  }
}

// ============================================================================
// Edge Factory
// ============================================================================

/**
 * Factory for creating GitLab CI graph edges
 */
export class GitLabEdgeFactory {
  private idCounter = 0;

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `gitlab-edge-${++this.idCounter}-${Date.now()}`;
  }

  /**
   * Create stage ordering edges
   */
  createStageOrderEdges(
    stages: readonly GitLabStage[],
    pipelineId: string,
    scanId: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    for (let i = 1; i < stages.length; i++) {
      const prevStageId = createGitLabStageId(pipelineId, stages[i - 1].name);
      const currStageId = createGitLabStageId(pipelineId, stages[i].name);

      edges.push({
        id: this.generateId(),
        source: prevStageId,
        target: currStageId,
        type: 'gitlab_stage_order',
        label: 'precedes',
        metadata: {
          implicit: true,
          confidence: 100,
        },
      });
    }

    return edges;
  }

  /**
   * Create job needs edges
   */
  createNeedsEdges(
    job: GitLabJob,
    pipelineId: string,
    scanId: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    if (!job.needs) {
      return edges;
    }

    const jobId = createGitLabJobId(pipelineId, job.name);

    for (const need of job.needs) {
      // Handle both string and GitLabNeed object formats
      const needJobName = isGitLabNeedObject(need) ? need.job : need;
      const needJobId = createGitLabJobId(pipelineId, needJobName);

      // Determine if artifacts should be passed
      const includeArtifacts = isGitLabNeedObject(need)
        ? need.artifacts !== false
        : true;

      edges.push({
        id: this.generateId(),
        source: needJobId,
        target: jobId,
        type: 'gitlab_needs',
        label: `needs ${needJobName}`,
        metadata: {
          implicit: false,
          confidence: 100,
          artifactPaths: includeArtifacts ? [] : undefined,
        },
      });
    }

    return edges;
  }

  /**
   * Create extends edges
   */
  createExtendsEdges(
    job: GitLabJob,
    pipelineId: string,
    scanId: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    if (!job.extends) {
      return edges;
    }

    const jobId = createGitLabJobId(pipelineId, job.name);
    const extendsArray = Array.isArray(job.extends) ? job.extends : [job.extends];

    for (const parentName of extendsArray) {
      const parentJobId = createGitLabJobId(pipelineId, parentName);

      edges.push({
        id: this.generateId(),
        source: parentJobId,
        target: jobId,
        type: 'gitlab_extends',
        label: `extends ${parentName}`,
        metadata: {
          implicit: false,
          confidence: 100,
          extendsFrom: extendsArray,
        },
      });
    }

    return edges;
  }

  /**
   * Create artifact flow edges based on stage dependencies
   */
  createArtifactFlowEdges(
    job: GitLabJob,
    allJobs: ReadonlyMap<string, GitLabJob>,
    stages: readonly GitLabStage[],
    pipelineId: string,
    scanId: string
  ): GitLabEdge[] {
    const edges: GitLabEdge[] = [];

    // If job has explicit dependencies, use those
    if (job.dependencies && job.dependencies.length > 0) {
      const jobId = createGitLabJobId(pipelineId, job.name);
      for (const depName of job.dependencies) {
        const depJob = allJobs.get(depName);
        if (depJob?.artifacts) {
          const depJobId = createGitLabJobId(pipelineId, depName);
          edges.push({
            id: this.generateId(),
            source: depJobId,
            target: jobId,
            type: 'gitlab_artifact_flow',
            label: `artifacts from ${depName}`,
            metadata: {
              implicit: false,
              confidence: 100,
              artifactPaths: depJob.artifacts.paths,
            },
          });
        }
      }
    }

    return edges;
  }

  /**
   * Create trigger edges
   */
  createTriggerEdge(
    job: GitLabJob,
    pipelineId: string,
    scanId: string
  ): GitLabEdge | null {
    if (!job.trigger) {
      return null;
    }

    const jobId = createGitLabJobId(pipelineId, job.name);

    return {
      id: this.generateId(),
      source: jobId,
      target: job.trigger.project ?? 'downstream-pipeline',
      type: 'gitlab_trigger',
      label: `triggers ${job.trigger.project ?? 'child pipeline'}`,
      metadata: {
        implicit: false,
        confidence: 100,
      },
    };
  }
}

// ============================================================================
// GitLab CI Parser
// ============================================================================

/**
 * Parser for GitLab CI/CD configuration files.
 * Extends BaseParser to provide comprehensive pipeline parsing with
 * tool detection for Terraform, Helm, and other IaC tools.
 */
export class GitLabCIParser extends BaseParser<GitLabCIParseResult> {
  readonly name = 'gitlab-ci-parser';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yml', '.yaml'] as const;
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml'] as const;

  private readonly includeResolver: GitLabIncludeResolver;
  private readonly toolDetector: GitLabToolDetector;
  private readonly nodeFactory: GitLabNodeFactory;
  private readonly edgeFactory: GitLabEdgeFactory;
  private readonly gitlabOptions: Required<GitLabCIParserOptions>;

  constructor(options?: ParserOptions & Partial<GitLabCIParserOptions>) {
    super(options);
    this.gitlabOptions = { ...DEFAULT_GITLAB_CI_PARSER_OPTIONS, ...options };
    this.includeResolver = new GitLabIncludeResolver('.', this.gitlabOptions.maxIncludeDepth);
    this.toolDetector = new GitLabToolDetector();
    this.nodeFactory = new GitLabNodeFactory();
    this.edgeFactory = new GitLabEdgeFactory();
  }

  /**
   * Check if this parser can handle the given file.
   */
  canParse(filePath: string, content?: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileName = path.basename(normalizedPath);

    // Check for .gitlab-ci.yml filename
    if (fileName === '.gitlab-ci.yml' || fileName === '.gitlab-ci.yaml') {
      return true;
    }

    // Check for files in .gitlab/ci/ directory
    if (normalizedPath.includes('.gitlab/ci/') ||
        normalizedPath.includes('gitlab-ci/') ||
        normalizedPath.includes('/ci/')) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.yml' || ext === '.yaml') {
        // If content provided, check for GitLab CI markers
        if (content) {
          return this.hasGitLabCIMarkers(content);
        }
        return true;
      }
    }

    // Check extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.yml' && ext !== '.yaml') {
      return false;
    }

    // If content provided, check for GitLab CI markers
    if (content) {
      return this.hasGitLabCIMarkers(content);
    }

    return false;
  }

  /**
   * Check if content has GitLab CI markers
   */
  private hasGitLabCIMarkers(content: string): boolean {
    // Check for common GitLab CI patterns
    return (
      /^stages:/m.test(content) ||
      /^include:/m.test(content) ||
      /^\.[a-zA-Z_-]+:/m.test(content) || // Hidden jobs
      (/^[a-zA-Z_-]+:/m.test(content) && /\bscript:/m.test(content)) ||
      /^default:/m.test(content) ||
      /^workflow:/m.test(content) ||
      /^variables:/m.test(content) && /\bstages:/m.test(content)
    );
  }

  /**
   * Parse GitLab CI configuration content
   */
  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<GitLabCIParseResult>> {
    const startTime = performance.now();
    const warnings: ParseDiagnostic[] = [];
    const errors: GitLabCIParseError[] = [];
    const scanId = `scan-${Date.now()}`;

    try {
      // Parse YAML with custom tags for !reference
      const parsed = this.parseYamlWithTags(content, filePath, errors);

      if (!parsed || typeof parsed !== 'object') {
        return this.createFailure(
          [{
            code: 'SYNTAX_ERROR',
            message: 'Invalid pipeline: not a YAML object',
            location: null,
            severity: 'fatal',
          }],
          null,
          this.createMetadata(filePath, startTime, content)
        );
      }

      // Extract stages
      const stages = this.extractStages(parsed as Record<string, unknown>, filePath);

      // Extract includes
      const includes = this.extractIncludes(parsed as Record<string, unknown>, filePath);

      // Extract default settings
      const defaultSettings = this.extractDefault(parsed as Record<string, unknown>);

      // Extract workflow
      const workflow = this.extractWorkflow(parsed as Record<string, unknown>);

      // Extract variables
      const pipelineVariables = this.extractVariables(
        (parsed as Record<string, unknown>).variables
      );

      // Extract jobs (filter out reserved keywords)
      const jobs = this.extractJobs(
        parsed as Record<string, unknown>,
        stages,
        filePath,
        errors
      );

      // Resolve extends if enabled
      if (this.gitlabOptions.resolveExtends) {
        this.resolveJobExtends(jobs, errors);
      }

      // Update stages with job info
      this.assignJobsToStages(stages, jobs);

      // Create pipeline object
      const pipeline: GitLabCIPipeline = {
        filePath,
        stages,
        jobs,
        variables: pipelineVariables ?? {},
        default: defaultSettings,
        workflow,
        includes,
        location: {
          file: filePath,
          lineStart: 1,
          lineEnd: content.split('\n').length,
          columnStart: 1,
          columnEnd: 1,
        },
      };

      // Detect tools
      const terraformSteps: GitLabTerraformStepInfo[] = [];
      const helmSteps: GitLabHelmStepInfo[] = [];
      const kubernetesSteps: GitLabKubernetesStepInfo[] = [];
      const dockerSteps: GitLabDockerStepInfo[] = [];

      // Track which jobs have which tool detections
      const jobTerraformMap = new Map<string, boolean>();
      const jobHelmMap = new Map<string, boolean>();
      const jobKubernetesMap = new Map<string, boolean>();
      const jobDockerMap = new Map<string, boolean>();

      for (const [jobName, job] of jobs) {
        if (job.hidden) continue;

        if (this.gitlabOptions.detectTerraform) {
          const tfInfo = this.toolDetector.detectTerraformInJob(job, filePath);
          if (tfInfo) {
            terraformSteps.push(tfInfo);
            jobTerraformMap.set(jobName, true);
          }
        }

        if (this.gitlabOptions.detectHelm) {
          const helmInfo = this.toolDetector.detectHelmInJob(job, filePath);
          if (helmInfo) {
            helmSteps.push(helmInfo);
            jobHelmMap.set(jobName, true);
          }
        }

        // Always detect Kubernetes and Docker
        const k8sInfo = this.toolDetector.detectKubernetesInJob(job, filePath);
        if (k8sInfo) {
          kubernetesSteps.push(k8sInfo);
          jobKubernetesMap.set(jobName, true);
        }

        const dockerInfo = this.toolDetector.detectDockerInJob(job, filePath);
        if (dockerInfo) {
          dockerSteps.push(dockerInfo);
          jobDockerMap.set(jobName, true);
        }
      }

      // Build unified allToolSteps array
      const allToolSteps: GitLabToolStepInfo[] = [
        ...terraformSteps,
        ...helmSteps,
        ...kubernetesSteps,
        ...dockerSteps,
      ];

      // Build tool operations for cross-parser compatibility
      const toolOperations: GitLabToolOperation[] = [
        ...terraformSteps.map(step => ({
          tool: 'terraform' as const,
          operation: step.command,
          jobName: step.jobName,
          stage: step.stage,
          sourceFile: filePath,
          details: step,
          confidence: step.confidence,
        })),
        ...helmSteps.map(step => ({
          tool: 'helm' as const,
          operation: step.command,
          jobName: step.jobName,
          stage: step.stage,
          sourceFile: filePath,
          details: step,
          confidence: step.confidence,
        })),
        ...kubernetesSteps.map(step => ({
          tool: 'kubernetes' as const,
          operation: step.command,
          jobName: step.jobName,
          stage: step.stage,
          sourceFile: filePath,
          details: step,
          confidence: step.confidence,
        })),
        ...dockerSteps.map(step => ({
          tool: 'docker' as const,
          operation: step.command,
          jobName: step.jobName,
          stage: step.stage,
          sourceFile: filePath,
          details: step,
          confidence: step.confidence,
        })),
      ];

      // Create graph nodes
      const nodes: (GitLabPipelineNode | GitLabStageNode | GitLabJobNode)[] = [];
      const edges: GitLabEdge[] = [];

      // Create pipeline node
      const pipelineNode = this.nodeFactory.createPipelineNode(pipeline, scanId);
      nodes.push(pipelineNode);

      // Create stage nodes and edges
      for (const stage of stages) {
        nodes.push(this.nodeFactory.createStageNode(stage, pipelineNode.id, scanId));
      }
      edges.push(...this.edgeFactory.createStageOrderEdges(stages, pipelineNode.id, scanId));

      // Create job nodes and edges
      for (const [jobName, job] of jobs) {
        const hasTerraform = jobTerraformMap.get(jobName) ?? false;
        const hasHelm = jobHelmMap.get(jobName) ?? false;
        const hasKubernetes = jobKubernetesMap.get(jobName) ?? false;
        const hasDocker = jobDockerMap.get(jobName) ?? false;

        nodes.push(this.nodeFactory.createJobNode(
          job,
          pipelineNode.id,
          scanId,
          hasTerraform,
          hasHelm,
          hasKubernetes,
          hasDocker
        ));
        edges.push(...this.edgeFactory.createNeedsEdges(job, pipelineNode.id, scanId));
        edges.push(...this.edgeFactory.createExtendsEdges(job, pipelineNode.id, scanId));
        edges.push(...this.edgeFactory.createArtifactFlowEdges(job, jobs, stages, pipelineNode.id, scanId));

        const triggerEdge = this.edgeFactory.createTriggerEdge(job, pipelineNode.id, scanId);
        if (triggerEdge) {
          edges.push(triggerEdge);
        }
      }

      // Build result
      const parseTimeMs = performance.now() - startTime;

      const result: GitLabCIParseResult = {
        success: errors.length === 0 || this.gitlabOptions.errorRecovery,
        pipeline,
        nodes,
        edges,
        terraformSteps,
        helmSteps,
        kubernetesSteps,
        dockerSteps,
        allToolSteps,
        toolOperations,
        errors,
        warnings: [],
        metadata: {
          filePath,
          parserName: this.name,
          parserVersion: this.version,
          parseTimeMs,
          fileSize: content.length,
          lineCount: content.split('\n').length,
          stageCount: stages.length,
          jobCount: jobs.size,
          includeCount: includes.length,
          toolDetectionCount: allToolSteps.length,
        },
      };

      return this.createSuccess(result, warnings, this.createMetadata(filePath, startTime, content));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createFailure(
        [{
          code: 'INTERNAL_ERROR',
          message: `Failed to parse pipeline: ${message}`,
          location: null,
          severity: 'fatal',
        }],
        null,
        this.createMetadata(filePath, startTime, content)
      );
    }
  }

  // ============================================================================
  // YAML Parsing with Custom Tags
  // ============================================================================

  /**
   * Parse YAML with support for !reference tag
   */
  private parseYamlWithTags(
    content: string,
    filePath: string,
    errors: GitLabCIParseError[]
  ): unknown {
    try {
      // Create custom YAML parser with !reference tag support
      const doc = yaml.parseDocument(content, {
        customTags: [
          {
            tag: '!reference',
            resolve: (seq: any) => {
              // Return the reference as an array for later resolution
              if (yaml.isSeq(seq)) {
                return { __reference__: seq.toJSON() };
              }
              return { __reference__: seq };
            },
          },
        ],
        strict: this.gitlabOptions.strictYaml,
        uniqueKeys: false,
      });

      // Collect YAML parsing errors
      if (doc.errors.length > 0) {
        for (const err of doc.errors) {
          errors.push({
            message: err.message,
            file: filePath,
            line: err.linePos?.[0]?.line,
            column: err.linePos?.[0]?.col,
            severity: 'error',
            code: 'INVALID_YAML',
          });
        }

        if (!this.gitlabOptions.errorRecovery) {
          return null;
        }
      }

      return doc.toJSON();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        message: `YAML parse error: ${message}`,
        file: filePath,
        severity: 'error',
        code: 'INVALID_YAML',
      });

      if (!this.gitlabOptions.errorRecovery) {
        return null;
      }

      // Try lenient parsing
      try {
        return yaml.parse(content, { strict: false });
      } catch {
        return null;
      }
    }
  }

  // ============================================================================
  // Stages Extraction
  // ============================================================================

  /**
   * Extract stages from parsed YAML
   */
  private extractStages(
    parsed: Record<string, unknown>,
    filePath: string
  ): GitLabStage[] {
    const stages: GitLabStage[] = [];

    // Check for explicit stages array
    if (Array.isArray(parsed.stages)) {
      parsed.stages.forEach((stageName, index) => {
        if (typeof stageName === 'string') {
          stages.push({
            name: stageName,
            order: index,
            jobNames: [],
          });
        }
      });
    } else {
      // Use default stages
      GITLAB_DEFAULT_STAGES.forEach((stageName, index) => {
        stages.push({
          name: stageName,
          order: index,
          jobNames: [],
        });
      });
    }

    return stages;
  }

  // ============================================================================
  // Includes Extraction
  // ============================================================================

  /**
   * Extract includes from parsed YAML
   */
  private extractIncludes(
    parsed: Record<string, unknown>,
    filePath: string
  ): GitLabInclude[] {
    if (!parsed.include) {
      return [];
    }

    return this.includeResolver.parseInclude(parsed.include);
  }

  // ============================================================================
  // Default Settings Extraction
  // ============================================================================

  /**
   * Extract default settings from parsed YAML
   */
  private extractDefault(parsed: Record<string, unknown>): GitLabDefault | undefined {
    const defaultObj = parsed.default;
    if (!defaultObj || typeof defaultObj !== 'object') {
      return undefined;
    }

    const d = defaultObj as Record<string, unknown>;

    return {
      image: this.extractImage(d.image),
      services: this.extractServices(d.services),
      beforeScript: this.extractStringArray(d.before_script),
      afterScript: this.extractStringArray(d.after_script),
      tags: this.extractStringArray(d.tags),
      artifacts: this.extractArtifacts(d.artifacts),
      cache: this.extractCache(d.cache),
      retry: this.extractRetry(d.retry),
      timeout: typeof d.timeout === 'string' ? d.timeout : undefined,
      interruptible: typeof d.interruptible === 'boolean' ? d.interruptible : undefined,
    };
  }

  // ============================================================================
  // Workflow Extraction
  // ============================================================================

  /**
   * Extract workflow from parsed YAML
   */
  private extractWorkflow(parsed: Record<string, unknown>): GitLabWorkflow | undefined {
    const workflowObj = parsed.workflow;
    if (!workflowObj || typeof workflowObj !== 'object') {
      return undefined;
    }

    const w = workflowObj as Record<string, unknown>;

    return {
      rules: this.extractRules(w.rules),
      name: typeof w.name === 'string' ? w.name : undefined,
    };
  }

  // ============================================================================
  // Jobs Extraction
  // ============================================================================

  /**
   * Extract jobs from parsed YAML
   */
  private extractJobs(
    parsed: Record<string, unknown>,
    stages: GitLabStage[],
    filePath: string,
    errors: GitLabCIParseError[]
  ): Map<string, GitLabJob> {
    const jobs = new Map<string, GitLabJob>();

    for (const [key, value] of Object.entries(parsed)) {
      // Skip reserved keywords
      if (this.isReservedKeyword(key)) {
        continue;
      }

      // Skip non-object values
      if (!value || typeof value !== 'object') {
        continue;
      }

      const jobConfig = value as Record<string, unknown>;

      // Check if this looks like a job (has script or extends or trigger)
      if (!jobConfig.script && !jobConfig.extends && !jobConfig.trigger) {
        // Might be a hidden template job (starts with .)
        if (!key.startsWith('.')) {
          continue;
        }
      }

      const job = this.extractJob(key, jobConfig, filePath, stages, errors);
      jobs.set(key, job);
    }

    return jobs;
  }

  /**
   * Extract a single job
   */
  private extractJob(
    name: string,
    config: Record<string, unknown>,
    filePath: string,
    stages: GitLabStage[],
    errors: GitLabCIParseError[]
  ): GitLabJob {
    // Determine stage
    let stage = 'test'; // Default stage
    if (typeof config.stage === 'string') {
      stage = config.stage;
      // Validate stage exists
      if (!stages.some(s => s.name === stage)) {
        errors.push({
          message: `Job "${name}" references unknown stage "${stage}"`,
          file: filePath,
          severity: 'warning',
          code: 'UNKNOWN_STAGE',
        });
      }
    }

    // Extract script
    const script = this.extractStringArray(config.script) ?? [];

    return {
      id: name, // Job ID is the same as its key in the jobs map
      name,
      stage,
      script,
      beforeScript: this.extractStringArray(config.before_script),
      afterScript: this.extractStringArray(config.after_script),
      image: this.extractImage(config.image),
      services: this.extractServices(config.services),
      variables: this.extractVariables(config.variables),
      rules: this.extractRules(config.rules),
      only: this.extractOnlyExcept(config.only),
      except: this.extractOnlyExcept(config.except),
      needs: this.extractNeeds(config.needs),
      dependencies: this.extractStringArray(config.dependencies),
      artifacts: this.extractArtifacts(config.artifacts),
      cache: this.extractCacheOrArray(config.cache),
      tags: this.extractStringArray(config.tags),
      allowFailure: this.extractAllowFailure(config.allow_failure),
      retry: this.extractRetry(config.retry),
      timeout: typeof config.timeout === 'string' ? config.timeout : undefined,
      when: this.extractWhen(config.when),
      environment: this.extractEnvironment(config.environment),
      release: this.extractRelease(config.release),
      coverage: typeof config.coverage === 'string' ? config.coverage : undefined,
      interruptible: typeof config.interruptible === 'boolean' ? config.interruptible : undefined,
      resourceGroup: typeof config.resource_group === 'string' ? config.resource_group : undefined,
      trigger: this.extractTrigger(config.trigger),
      parallel: this.extractParallel(config.parallel),
      extends: this.extractExtends(config.extends),
      hidden: name.startsWith('.'),
      location: {
        file: filePath,
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 1,
      },
    };
  }

  /**
   * Check if a key is a reserved GitLab CI keyword
   */
  private isReservedKeyword(key: string): boolean {
    return GITLAB_RESERVED_KEYWORDS.includes(key);
  }

  // ============================================================================
  // Job Property Extractors
  // ============================================================================

  /**
   * Extract image configuration
   */
  private extractImage(value: unknown): GitLabImage | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return { name: value };
    }

    if (typeof value === 'object') {
      const img = value as Record<string, unknown>;
      return {
        name: typeof img.name === 'string' ? img.name : '',
        entrypoint: this.extractStringArray(img.entrypoint),
        pullPolicy: this.extractPullPolicy(img.pull_policy),
      };
    }

    return undefined;
  }

  /**
   * Extract pull policy
   */
  private extractPullPolicy(value: unknown): 'always' | 'if-not-present' | 'never' | undefined {
    if (value === 'always' || value === 'if-not-present' || value === 'never') {
      return value;
    }
    return undefined;
  }

  /**
   * Extract services configuration
   */
  private extractServices(value: unknown): GitLabService[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.map(svc => {
      if (typeof svc === 'string') {
        return { name: svc };
      }
      if (typeof svc === 'object' && svc !== null) {
        const s = svc as Record<string, unknown>;
        return {
          name: typeof s.name === 'string' ? s.name : '',
          alias: typeof s.alias === 'string' ? s.alias : undefined,
          entrypoint: this.extractStringArray(s.entrypoint),
          command: this.extractStringArray(s.command),
          variables: s.variables as Record<string, string> | undefined,
          pullPolicy: this.extractPullPolicy(s.pull_policy),
        };
      }
      return { name: '' };
    }).filter(s => s.name !== '');
  }

  /**
   * Extract variables
   */
  private extractVariables(value: unknown): Record<string, GitLabVariable> | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const variables: Record<string, GitLabVariable> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === 'string') {
        variables[key] = { value: val };
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        variables[key] = { value: String(val) };
      } else if (typeof val === 'object' && val !== null) {
        const v = val as Record<string, unknown>;
        variables[key] = {
          value: typeof v.value === 'string' ? v.value : String(v.value ?? ''),
          description: typeof v.description === 'string' ? v.description : undefined,
          options: this.extractStringArray(v.options),
          expand: typeof v.expand === 'boolean' ? v.expand : undefined,
        };
      }
    }

    return Object.keys(variables).length > 0 ? variables : undefined;
  }

  /**
   * Extract rules
   */
  private extractRules(value: unknown): GitLabRule[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.map(rule => {
      if (typeof rule !== 'object' || rule === null) {
        return {};
      }
      const r = rule as Record<string, unknown>;
      return {
        if: typeof r.if === 'string' ? r.if : undefined,
        changes: this.extractRuleChanges(r.changes),
        exists: this.extractStringArray(r.exists),
        when: this.extractWhen(r.when),
        allowFailure: typeof r.allow_failure === 'boolean' ? r.allow_failure : undefined,
        variables: r.variables as Record<string, string> | undefined,
        needs: this.extractNeeds(r.needs),
        startIn: typeof r.start_in === 'string' ? r.start_in : undefined,
      };
    }).filter(r => Object.keys(r).length > 0);
  }

  /**
   * Extract rule changes configuration
   */
  private extractRuleChanges(value: unknown): readonly string[] | undefined {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return undefined;
  }

  /**
   * Extract only/except configuration
   */
  private extractOnlyExcept(value: unknown): {
    refs?: readonly string[];
    variables?: readonly string[];
    changes?: readonly string[];
    kubernetes?: 'active';
  } | undefined {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return { refs: value.filter((v): v is string => typeof v === 'string') };
    }

    if (typeof value === 'object') {
      const o = value as Record<string, unknown>;
      return {
        refs: this.extractStringArray(o.refs),
        variables: this.extractStringArray(o.variables),
        changes: this.extractStringArray(o.changes),
        kubernetes: o.kubernetes === 'active' ? 'active' : undefined,
      };
    }

    return undefined;
  }

  /**
   * Extract needs configuration
   */
  private extractNeeds(value: unknown): GitLabNeed[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.map(need => {
      if (typeof need === 'string') {
        return { job: need };
      }
      if (typeof need === 'object' && need !== null) {
        const n = need as Record<string, unknown>;
        return {
          job: typeof n.job === 'string' ? n.job : '',
          project: typeof n.project === 'string' ? n.project : undefined,
          ref: typeof n.ref === 'string' ? n.ref : undefined,
          artifacts: typeof n.artifacts === 'boolean' ? n.artifacts : undefined,
          optional: typeof n.optional === 'boolean' ? n.optional : undefined,
          pipeline: typeof n.pipeline === 'string' ? n.pipeline : undefined,
        };
      }
      return { job: '' };
    }).filter(n => n.job !== '');
  }

  /**
   * Extract artifacts configuration
   */
  private extractArtifacts(value: unknown): GitLabArtifacts | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const a = value as Record<string, unknown>;
    return {
      paths: this.extractStringArray(a.paths),
      exclude: this.extractStringArray(a.exclude),
      expireIn: typeof a.expire_in === 'string' ? a.expire_in : undefined,
      expose_as: typeof a.expose_as === 'string' ? a.expose_as : undefined,
      name: typeof a.name === 'string' ? a.name : undefined,
      when: a.when === 'on_success' || a.when === 'on_failure' || a.when === 'always'
        ? a.when : undefined,
      untracked: typeof a.untracked === 'boolean' ? a.untracked : undefined,
      reports: this.extractArtifactReports(a.reports),
    };
  }

  /**
   * Extract artifact reports
   */
  private extractArtifactReports(value: unknown): GitLabArtifacts['reports'] | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const r = value as Record<string, unknown>;
    return {
      junit: this.extractStringOrArray(r.junit),
      coverage_report: typeof r.coverage_report === 'object' && r.coverage_report
        ? r.coverage_report as any
        : undefined,
      dast: this.extractStringOrArray(r.dast),
      dependency_scanning: this.extractStringOrArray(r.dependency_scanning),
      container_scanning: this.extractStringOrArray(r.container_scanning),
      sast: this.extractStringOrArray(r.sast),
      secret_detection: this.extractStringOrArray(r.secret_detection),
      license_scanning: this.extractStringOrArray(r.license_scanning),
      terraform: this.extractStringOrArray(r.terraform),
      dotenv: this.extractStringOrArray(r.dotenv),
      metrics: this.extractStringOrArray(r.metrics),
      performance: this.extractStringOrArray(r.performance),
    };
  }

  /**
   * Extract cache configuration
   */
  private extractCache(value: unknown): GitLabCache | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const c = value as Record<string, unknown>;
    return {
      key: this.extractCacheKey(c.key),
      paths: this.extractStringArray(c.paths),
      untracked: typeof c.untracked === 'boolean' ? c.untracked : undefined,
      policy: c.policy === 'pull-push' || c.policy === 'pull' || c.policy === 'push'
        ? c.policy : undefined,
      when: c.when === 'on_success' || c.when === 'on_failure' || c.when === 'always'
        ? c.when : undefined,
      fallback_keys: this.extractStringArray(c.fallback_keys),
    };
  }

  /**
   * Extract cache or array of caches
   */
  private extractCacheOrArray(value: unknown): GitLabCache | readonly GitLabCache[] | undefined {
    if (Array.isArray(value)) {
      return value
        .map(c => this.extractCache(c))
        .filter((c): c is GitLabCache => c !== undefined);
    }
    return this.extractCache(value);
  }

  /**
   * Extract cache key
   */
  private extractCacheKey(value: unknown): string | { files?: readonly string[]; prefix?: string } | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      const k = value as Record<string, unknown>;
      return {
        files: this.extractStringArray(k.files),
        prefix: typeof k.prefix === 'string' ? k.prefix : undefined,
      };
    }
    return undefined;
  }

  /**
   * Extract allow failure configuration
   */
  private extractAllowFailure(value: unknown): boolean | { exit_codes: number | readonly number[] } | undefined {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      const a = value as Record<string, unknown>;
      if ('exit_codes' in a) {
        return {
          exit_codes: Array.isArray(a.exit_codes)
            ? a.exit_codes.filter((e): e is number => typeof e === 'number')
            : typeof a.exit_codes === 'number' ? a.exit_codes : 0,
        };
      }
    }
    return undefined;
  }

  /**
   * Extract retry configuration
   */
  private extractRetry(value: unknown): GitLabRetry | undefined {
    if (typeof value === 'number') {
      return { max: value };
    }
    if (typeof value === 'object' && value !== null) {
      const r = value as Record<string, unknown>;
      return {
        max: typeof r.max === 'number' ? r.max : undefined,
        when: Array.isArray(r.when) ? r.when as any : undefined,
      };
    }
    return undefined;
  }

  /**
   * Extract when condition
   */
  private extractWhen(value: unknown): 'on_success' | 'on_failure' | 'always' | 'manual' | 'delayed' | 'never' | undefined {
    const validValues = ['on_success', 'on_failure', 'always', 'manual', 'delayed', 'never'];
    if (typeof value === 'string' && validValues.includes(value)) {
      return value as any;
    }
    return undefined;
  }

  /**
   * Extract environment configuration
   */
  private extractEnvironment(value: unknown): GitLabEnvironment | undefined {
    if (typeof value === 'string') {
      return { name: value };
    }
    if (typeof value === 'object' && value !== null) {
      const e = value as Record<string, unknown>;
      return {
        name: typeof e.name === 'string' ? e.name : '',
        url: typeof e.url === 'string' ? e.url : undefined,
        action: e.action === 'start' || e.action === 'prepare' || e.action === 'stop' ||
                e.action === 'verify' || e.action === 'access' ? e.action : undefined,
        on_stop: typeof e.on_stop === 'string' ? e.on_stop : undefined,
        auto_stop_in: typeof e.auto_stop_in === 'string' ? e.auto_stop_in : undefined,
        deployment_tier: this.extractDeploymentTier(e.deployment_tier),
        kubernetes: e.kubernetes as any,
      };
    }
    return undefined;
  }

  /**
   * Extract deployment tier
   */
  private extractDeploymentTier(value: unknown): 'production' | 'staging' | 'testing' | 'development' | 'other' | undefined {
    const validTiers = ['production', 'staging', 'testing', 'development', 'other'];
    if (typeof value === 'string' && validTiers.includes(value)) {
      return value as any;
    }
    return undefined;
  }

  /**
   * Extract release configuration
   */
  private extractRelease(value: unknown): GitLabJob['release'] | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const r = value as Record<string, unknown>;
    return {
      tag_name: typeof r.tag_name === 'string' ? r.tag_name : '',
      name: typeof r.name === 'string' ? r.name : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
      ref: typeof r.ref === 'string' ? r.ref : undefined,
      milestones: this.extractStringArray(r.milestones),
      released_at: typeof r.released_at === 'string' ? r.released_at : undefined,
      assets: r.assets as any,
    };
  }

  /**
   * Extract trigger configuration
   */
  private extractTrigger(value: unknown): GitLabTrigger | undefined {
    if (typeof value === 'string') {
      return { project: value };
    }
    if (typeof value === 'object' && value !== null) {
      const t = value as Record<string, unknown>;
      return {
        project: typeof t.project === 'string' ? t.project : undefined,
        branch: typeof t.branch === 'string' ? t.branch : undefined,
        include: t.include as any,
        strategy: t.strategy === 'depend' ? 'depend' : undefined,
        forward: t.forward as any,
      };
    }
    return undefined;
  }

  /**
   * Extract parallel configuration
   */
  private extractParallel(value: unknown): GitLabParallel | undefined {
    if (typeof value === 'number') {
      return undefined; // Simple number parallel - no matrix
    }
    if (typeof value === 'object' && value !== null) {
      const p = value as Record<string, unknown>;
      if (Array.isArray(p.matrix)) {
        return {
          matrix: p.matrix as any,
        };
      }
    }
    return undefined;
  }

  /**
   * Extract extends configuration
   */
  private extractExtends(value: unknown): string | readonly string[] | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return undefined;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Extract string array from value
   */
  private extractStringArray(value: unknown): readonly string[] | undefined {
    if (typeof value === 'string') {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return undefined;
  }

  /**
   * Extract string or string array
   */
  private extractStringOrArray(value: unknown): string | readonly string[] | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return undefined;
  }

  // ============================================================================
  // Extends Resolution
  // ============================================================================

  /**
   * Resolve extends inheritance for all jobs
   */
  private resolveJobExtends(
    jobs: Map<string, GitLabJob>,
    errors: GitLabCIParseError[]
  ): void {
    const resolved = new Set<string>();
    const resolving = new Set<string>();

    for (const [jobName, job] of jobs) {
      this.resolveExtendsForJob(jobName, job, jobs, resolved, resolving, errors);
    }
  }

  /**
   * Resolve extends for a single job
   */
  private resolveExtendsForJob(
    jobName: string,
    job: GitLabJob,
    jobs: Map<string, GitLabJob>,
    resolved: Set<string>,
    resolving: Set<string>,
    errors: GitLabCIParseError[]
  ): GitLabJob {
    if (resolved.has(jobName)) {
      return jobs.get(jobName) ?? job;
    }

    if (resolving.has(jobName)) {
      errors.push({
        message: `Circular extends detected for job "${jobName}"`,
        file: job.location.file,
        severity: 'error',
        code: 'CIRCULAR_EXTENDS',
      });
      return job;
    }

    if (!job.extends) {
      resolved.add(jobName);
      return job;
    }

    resolving.add(jobName);

    const extendsArray = Array.isArray(job.extends) ? job.extends : [job.extends];
    let mergedJob = { ...job };

    for (const parentName of extendsArray) {
      const parentJob = jobs.get(parentName);
      if (!parentJob) {
        errors.push({
          message: `Job "${jobName}" extends unknown job "${parentName}"`,
          file: job.location.file,
          severity: 'warning',
          code: 'INVALID_JOB',
        });
        continue;
      }

      // Recursively resolve parent
      const resolvedParent = this.resolveExtendsForJob(
        parentName,
        parentJob,
        jobs,
        resolved,
        resolving,
        errors
      );

      // Merge parent into current job
      mergedJob = this.mergeJobs(resolvedParent, mergedJob);
    }

    resolving.delete(jobName);
    resolved.add(jobName);
    jobs.set(jobName, mergedJob);

    return mergedJob;
  }

  /**
   * Merge two jobs (parent and child)
   */
  private mergeJobs(parent: GitLabJob, child: GitLabJob): GitLabJob {
    return {
      ...parent,
      ...child,
      // Scripts should not be inherited by default unless child has none
      script: child.script.length > 0 ? child.script : parent.script,
      // Merge variables
      variables: {
        ...parent.variables,
        ...child.variables,
      },
      // Keep child's extends reference
      extends: child.extends,
      // Preserve child's name
      name: child.name,
      // Preserve child's stage if specified
      stage: child.stage ?? parent.stage,
      // Preserve child's location
      location: child.location,
    };
  }

  // ============================================================================
  // Stage Assignment
  // ============================================================================

  /**
   * Assign jobs to their respective stages
   */
  private assignJobsToStages(
    stages: GitLabStage[],
    jobs: Map<string, GitLabJob>
  ): void {
    for (const [jobName, job] of jobs) {
      if (job.hidden) continue;

      const stage = stages.find(s => s.name === job.stage);
      if (stage) {
        (stage.jobNames as string[]).push(jobName);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new GitLab CI parser instance
 */
export function createGitLabCIParser(
  options?: ParserOptions & Partial<GitLabCIParserOptions>
): GitLabCIParser {
  return new GitLabCIParser(options);
}

/**
 * Parse a GitLab CI configuration directly
 */
export async function parseGitLabCI(
  content: string,
  filePath: string,
  options?: ParserOptions & Partial<GitLabCIParserOptions>
): Promise<ParseResult<GitLabCIParseResult>> {
  const parser = createGitLabCIParser(options);
  return parser.parse(content, filePath, options);
}

// ============================================================================
// All classes are exported inline with 'export class' declarations above
// ============================================================================
