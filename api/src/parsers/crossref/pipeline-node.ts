/**
 * Pipeline Node Type Definitions
 * @module parsers/crossref/pipeline-node
 *
 * Defines PIPELINE and PIPELINE_JOB node types for representing CI/CD configurations
 * in the infrastructure graph. Supports multiple CI systems including GitHub Actions,
 * GitLab CI, Jenkins, Azure Pipelines, and CircleCI.
 *
 * TASK-XREF-007: PIPELINE Node Type Implementation
 */

import { createHash } from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported CI/CD pipeline types
 */
export type CIPipelineType =
  | 'github_actions'
  | 'gitlab_ci'
  | 'jenkins'
  | 'azure_pipelines'
  | 'circleci';

/**
 * Pipeline trigger types
 */
export type TriggerType =
  | 'push'
  | 'pull_request'
  | 'schedule'
  | 'workflow_dispatch'
  | 'manual'
  | 'api'
  | 'tag';

/**
 * Operation types that jobs can perform
 */
export type OperationType =
  | 'terraform'
  | 'helm'
  | 'kubectl'
  | 'docker'
  | 'script'
  | 'other';

/**
 * Pipeline trigger configuration
 */
export interface PipelineTrigger {
  /** Type of trigger */
  readonly type: TriggerType;
  /** Branches that trigger the pipeline */
  readonly branches?: readonly string[];
  /** File paths that trigger the pipeline */
  readonly paths?: readonly string[];
  /** Tags that trigger the pipeline */
  readonly tags?: readonly string[];
  /** Cron schedule expression */
  readonly schedule?: string;
}

/**
 * Operation performed within a job step
 */
export interface JobOperation {
  /** Type of operation */
  readonly type: OperationType;
  /** Command executed */
  readonly command: string;
  /** Step index within the job */
  readonly stepIndex: number;
  /** Working directory for the operation */
  readonly workingDir?: string;
  /** Outputs produced by the operation */
  readonly outputs?: readonly string[];
  /** Inputs consumed by the operation */
  readonly inputs?: readonly string[];
}

/**
 * Artifact configuration for a job
 */
export interface JobArtifact {
  /** Artifact name */
  readonly name: string;
  /** Paths included in the artifact */
  readonly paths: readonly string[];
  /** Expiration time */
  readonly expireIn?: string;
}

/**
 * Metadata for a CI Pipeline node
 */
export interface PipelineNodeMetadata {
  /** CI system type */
  readonly pipelineType: CIPipelineType;
  /** Pipeline name */
  readonly name: string;
  /** Configured triggers */
  readonly triggers: readonly PipelineTrigger[];
  /** Number of jobs in the pipeline */
  readonly jobCount: number;
  /** Whether pipeline contains Terraform jobs */
  readonly hasTerraformJobs: boolean;
  /** Whether pipeline contains Helm jobs */
  readonly hasHelmJobs: boolean;
  /** Default branch for the pipeline */
  readonly defaultBranch?: string;
  /** Workflow dispatch inputs */
  readonly workflowDispatchInputs?: Record<string, unknown>;
}

/**
 * CI Pipeline node representation
 */
export interface PipelineNode {
  /** Unique node identifier */
  readonly id: string;
  /** Node type discriminator */
  readonly type: 'ci_pipeline';
  /** Pipeline name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** Start line in source file */
  readonly lineStart?: number;
  /** End line in source file */
  readonly lineEnd?: number;
  /** Scan ID this node belongs to */
  readonly scanId: string;
  /** Pipeline metadata */
  readonly metadata: PipelineNodeMetadata;
}

/**
 * Metadata for a Pipeline Job node
 */
export interface PipelineJobNodeMetadata {
  /** Parent pipeline ID */
  readonly pipelineId: string;
  /** Job name */
  readonly jobName: string;
  /** Stage/phase the job belongs to */
  readonly stage?: string;
  /** Runner/agent specification */
  readonly runsOn?: string;
  /** Deployment environment */
  readonly environment?: string;
  /** Jobs this job depends on */
  readonly dependsOn: readonly string[];
  /** Operations performed by the job */
  readonly operations: readonly JobOperation[];
  /** Artifacts produced by the job */
  readonly artifacts: readonly JobArtifact[];
  /** Job outputs */
  readonly outputs?: Record<string, string>;
  /** Conditional expression for job execution */
  readonly condition?: string;
}

/**
 * Pipeline Job node representation
 */
export interface PipelineJobNode {
  /** Unique node identifier */
  readonly id: string;
  /** Node type discriminator */
  readonly type: 'ci_job';
  /** Job name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** Start line in source file */
  readonly lineStart?: number;
  /** End line in source file */
  readonly lineEnd?: number;
  /** Scan ID this node belongs to */
  readonly scanId: string;
  /** Job metadata */
  readonly metadata: PipelineJobNodeMetadata;
}

// ============================================================================
// Edge Type Definitions
// ============================================================================

/**
 * Edge representing pipeline-to-job containment
 */
export interface PipelineContainsEdge {
  /** Unique edge identifier */
  readonly id: string;
  /** Edge type discriminator */
  readonly type: 'PIPELINE_CONTAINS';
  /** Source node ID (Pipeline) */
  readonly sourceNodeId: string;
  /** Target node ID (Job) */
  readonly targetNodeId: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
}

/**
 * Edge representing job dependency
 */
export interface JobDependsOnEdge {
  /** Unique edge identifier */
  readonly id: string;
  /** Edge type discriminator */
  readonly type: 'JOB_DEPENDS_ON';
  /** Source node ID (dependency job) */
  readonly sourceNodeId: string;
  /** Target node ID (dependent job) */
  readonly targetNodeId: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
  /** Edge metadata */
  readonly metadata: {
    /** Whether artifacts are required from the dependency */
    readonly artifactRequired?: boolean;
    /** Conditional expression for the dependency */
    readonly condition?: string;
  };
}

/**
 * Edge representing job operating on infrastructure
 */
export interface OperatesOnEdge {
  /** Unique edge identifier */
  readonly id: string;
  /** Edge type discriminator */
  readonly type: 'OPERATES_ON';
  /** Source node ID (Job) */
  readonly sourceNodeId: string;
  /** Target node ID (TF/Helm node) */
  readonly targetNodeId: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
  /** Edge metadata */
  readonly metadata: {
    /** Operation being performed */
    readonly operation: string;
    /** Type of operation */
    readonly operationType: OperationType;
    /** Step index within the job */
    readonly stepIndex: number;
  };
}

// ============================================================================
// Parsed Workflow Types (Input)
// ============================================================================

/**
 * Generic parsed workflow structure
 */
export interface ParsedWorkflow {
  /** Workflow name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** CI system type */
  readonly pipelineType: CIPipelineType;
  /** Trigger configuration */
  readonly triggers: readonly ParsedTrigger[];
  /** Jobs in the workflow */
  readonly jobs: ReadonlyMap<string, ParsedJob>;
  /** Default branch */
  readonly defaultBranch?: string;
  /** Workflow dispatch inputs */
  readonly workflowDispatchInputs?: Record<string, unknown>;
  /** Source location */
  readonly location?: {
    readonly lineStart: number;
    readonly lineEnd: number;
  };
}

/**
 * Parsed trigger configuration
 */
export interface ParsedTrigger {
  /** Trigger type */
  readonly type: string;
  /** Branches */
  readonly branches?: readonly string[];
  /** Paths */
  readonly paths?: readonly string[];
  /** Tags */
  readonly tags?: readonly string[];
  /** Schedule */
  readonly schedule?: string;
}

/**
 * Parsed job structure
 */
export interface ParsedJob {
  /** Job ID/name */
  readonly id: string;
  /** Display name */
  readonly name?: string;
  /** Stage */
  readonly stage?: string;
  /** Runner specification */
  readonly runsOn?: string;
  /** Dependencies */
  readonly needs?: readonly string[];
  /** Environment */
  readonly environment?: string;
  /** Steps */
  readonly steps: readonly ParsedStep[];
  /** Outputs */
  readonly outputs?: Record<string, string>;
  /** Condition */
  readonly condition?: string;
  /** Artifacts */
  readonly artifacts?: ParsedArtifacts;
  /** Source location */
  readonly location?: {
    readonly lineStart: number;
    readonly lineEnd: number;
  };
}

/**
 * Parsed step structure
 */
export interface ParsedStep {
  /** Step ID */
  readonly id?: string;
  /** Step name */
  readonly name?: string;
  /** Run command */
  readonly run?: string;
  /** Uses action */
  readonly uses?: string;
  /** Working directory */
  readonly workingDirectory?: string;
  /** Environment variables */
  readonly env?: Record<string, string>;
  /** Step index */
  readonly index: number;
}

/**
 * Parsed artifacts configuration
 */
export interface ParsedArtifacts {
  /** Artifact name */
  readonly name?: string;
  /** Paths */
  readonly paths?: readonly string[];
  /** Expiration */
  readonly expireIn?: string;
}

// ============================================================================
// ID Generation Functions
// ============================================================================

/**
 * Generate a deterministic pipeline node ID from file path.
 *
 * @param filePath - Path to the pipeline configuration file
 * @returns Deterministic pipeline node ID
 *
 * @example
 * const id = generatePipelineNodeId('.github/workflows/deploy.yml');
 * // Returns: 'pipeline-a1b2c3d4e5f6...'
 */
export function generatePipelineNodeId(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const hash = createHash('sha256').update(`pipeline:${normalized}`).digest('hex').slice(0, 16);
  return `pipeline-${hash}`;
}

/**
 * Generate a deterministic job node ID from file path and job name.
 *
 * @param filePath - Path to the pipeline configuration file
 * @param jobName - Name of the job
 * @returns Deterministic job node ID
 *
 * @example
 * const id = generateJobNodeId('.github/workflows/deploy.yml', 'terraform');
 * // Returns: 'job-a1b2c3d4e5f6...'
 */
export function generateJobNodeId(filePath: string, jobName: string): string {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const combined = `job:${normalized}:${jobName}`;
  const hash = createHash('sha256').update(combined).digest('hex').slice(0, 16);
  return `job-${hash}`;
}

/**
 * Generate a deterministic edge ID.
 *
 * @param edgeType - Type of edge
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @returns Deterministic edge ID
 */
export function generateEdgeId(
  edgeType: string,
  sourceId: string,
  targetId: string
): string {
  const combined = `${edgeType}:${sourceId}:${targetId}`;
  const hash = createHash('sha256').update(combined).digest('hex').slice(0, 16);
  return `${edgeType.toLowerCase().replace(/_/g, '-')}-${hash}`;
}

// ============================================================================
// Trigger Parsing Functions
// ============================================================================

/**
 * Normalize trigger type from various CI systems to common type.
 *
 * @param triggerType - Raw trigger type string
 * @param pipelineType - CI system type
 * @returns Normalized trigger type
 */
function normalizeTriggerType(
  triggerType: string,
  pipelineType: CIPipelineType
): TriggerType {
  const normalized = triggerType.toLowerCase();

  // GitHub Actions mappings
  if (pipelineType === 'github_actions') {
    switch (normalized) {
      case 'push':
        return 'push';
      case 'pull_request':
      case 'pull_request_target':
        return 'pull_request';
      case 'schedule':
        return 'schedule';
      case 'workflow_dispatch':
        return 'workflow_dispatch';
      case 'repository_dispatch':
        return 'api';
      default:
        return 'manual';
    }
  }

  // GitLab CI mappings
  if (pipelineType === 'gitlab_ci') {
    switch (normalized) {
      case 'push':
      case 'pushes':
        return 'push';
      case 'merge_requests':
      case 'merge_request_events':
        return 'pull_request';
      case 'schedules':
        return 'schedule';
      case 'web':
      case 'trigger':
        return 'manual';
      case 'api':
      case 'triggers':
        return 'api';
      case 'tags':
        return 'tag';
      default:
        return 'manual';
    }
  }

  // Azure Pipelines mappings
  if (pipelineType === 'azure_pipelines') {
    switch (normalized) {
      case 'batch':
      case 'branches':
        return 'push';
      case 'pr':
        return 'pull_request';
      case 'schedules':
        return 'schedule';
      case 'tags':
        return 'tag';
      default:
        return 'manual';
    }
  }

  // Default mappings
  switch (normalized) {
    case 'push':
    case 'commit':
      return 'push';
    case 'pull_request':
    case 'pr':
    case 'merge_request':
      return 'pull_request';
    case 'schedule':
    case 'cron':
      return 'schedule';
    case 'manual':
    case 'workflow_dispatch':
      return 'workflow_dispatch';
    case 'api':
    case 'webhook':
      return 'api';
    case 'tag':
    case 'tags':
      return 'tag';
    default:
      return 'manual';
  }
}

/**
 * Parse triggers from workflow configuration.
 *
 * @param workflow - Raw workflow configuration
 * @param pipelineType - CI system type
 * @returns Array of parsed triggers
 */
export function parseTriggers(
  workflow: unknown,
  pipelineType: CIPipelineType
): readonly PipelineTrigger[] {
  const triggers: PipelineTrigger[] = [];

  if (!workflow || typeof workflow !== 'object') {
    return triggers;
  }

  const workflowObj = workflow as Record<string, unknown>;

  // GitHub Actions: 'on' field
  if (pipelineType === 'github_actions' && workflowObj.on) {
    const on = workflowObj.on;

    // Simple string: on: push
    if (typeof on === 'string') {
      triggers.push({
        type: normalizeTriggerType(on, pipelineType),
      });
    }
    // Array: on: [push, pull_request]
    else if (Array.isArray(on)) {
      for (const trigger of on) {
        if (typeof trigger === 'string') {
          triggers.push({
            type: normalizeTriggerType(trigger, pipelineType),
          });
        }
      }
    }
    // Object: on: { push: { branches: [...] } }
    else if (typeof on === 'object') {
      const onObj = on as Record<string, unknown>;
      for (const [triggerType, config] of Object.entries(onObj)) {
        const normalized = normalizeTriggerType(triggerType, pipelineType);
        const triggerConfig: PipelineTrigger = { type: normalized };

        if (config && typeof config === 'object') {
          const configObj = config as Record<string, unknown>;

          if (Array.isArray(configObj.branches)) {
            const branchList = configObj.branches.filter((b): b is string => typeof b === 'string');
            (triggerConfig as unknown as { branches: string[] }).branches = branchList;
          }
          if (Array.isArray(configObj.paths)) {
            const pathList = configObj.paths.filter((p): p is string => typeof p === 'string');
            (triggerConfig as unknown as { paths: string[] }).paths = pathList;
          }
          if (Array.isArray(configObj.tags)) {
            const tagList = configObj.tags.filter((t): t is string => typeof t === 'string');
            (triggerConfig as unknown as { tags: string[] }).tags = tagList;
          }
        }

        triggers.push(triggerConfig);
      }
    }
  }

  // GitLab CI: 'workflow' rules or job 'only/except'
  if (pipelineType === 'gitlab_ci') {
    // GitLab uses rules-based triggering, derive from workflow rules
    const workflowRules = (workflowObj.workflow as Record<string, unknown>)?.rules;
    if (Array.isArray(workflowRules)) {
      const hasPushTrigger = workflowRules.some((rule: Record<string, unknown>) =>
        rule.if?.toString().includes('$CI_PIPELINE_SOURCE == "push"')
      );
      const hasMRTrigger = workflowRules.some((rule: Record<string, unknown>) =>
        rule.if?.toString().includes('merge_request')
      );
      const hasScheduleTrigger = workflowRules.some((rule: Record<string, unknown>) =>
        rule.if?.toString().includes('schedule')
      );

      if (hasPushTrigger) triggers.push({ type: 'push' });
      if (hasMRTrigger) triggers.push({ type: 'pull_request' });
      if (hasScheduleTrigger) triggers.push({ type: 'schedule' });
    }

    // If no explicit triggers found, default to push
    if (triggers.length === 0) {
      triggers.push({ type: 'push' });
    }
  }

  // Azure Pipelines: 'trigger' and 'pr' fields
  if (pipelineType === 'azure_pipelines') {
    if (workflowObj.trigger) {
      const trigger = workflowObj.trigger;
      if (trigger === 'none') {
        // No automatic triggers
      } else if (Array.isArray(trigger)) {
        triggers.push({
          type: 'push',
          branches: trigger.filter((b): b is string => typeof b === 'string'),
        });
      } else if (typeof trigger === 'object') {
        const triggerObj = trigger as Record<string, unknown>;
        triggers.push({
          type: 'push',
          branches: Array.isArray(triggerObj.branches)
            ? triggerObj.branches.filter((b): b is string => typeof b === 'string')
            : undefined,
          paths: Array.isArray(triggerObj.paths)
            ? triggerObj.paths.filter((p): p is string => typeof p === 'string')
            : undefined,
          tags: Array.isArray(triggerObj.tags)
            ? triggerObj.tags.filter((t): t is string => typeof t === 'string')
            : undefined,
        });
      }
    }

    if (workflowObj.pr) {
      const pr = workflowObj.pr;
      if (pr !== 'none') {
        if (Array.isArray(pr)) {
          triggers.push({
            type: 'pull_request',
            branches: pr.filter((b): b is string => typeof b === 'string'),
          });
        } else if (typeof pr === 'object') {
          const prObj = pr as Record<string, unknown>;
          triggers.push({
            type: 'pull_request',
            branches: Array.isArray(prObj.branches)
              ? prObj.branches.filter((b): b is string => typeof b === 'string')
              : undefined,
          });
        } else {
          triggers.push({ type: 'pull_request' });
        }
      }
    }

    if (Array.isArray(workflowObj.schedules)) {
      for (const schedule of workflowObj.schedules) {
        if (typeof schedule === 'object' && schedule !== null) {
          const schedObj = schedule as Record<string, unknown>;
          triggers.push({
            type: 'schedule',
            schedule: typeof schedObj.cron === 'string' ? schedObj.cron : undefined,
          });
        }
      }
    }
  }

  return triggers;
}

// ============================================================================
// Operation Extraction Functions
// ============================================================================

/**
 * Terraform command patterns
 */
const TERRAFORM_PATTERNS = [
  /terraform\s+(init|plan|apply|destroy|output|validate|fmt|import|state|workspace|refresh)/i,
  /tofu\s+(init|plan|apply|destroy|output|validate|fmt|import|state|workspace|refresh)/i,
  /terragrunt\s+(init|plan|apply|destroy|output|validate|run-all)/i,
];

/**
 * Helm command patterns
 */
const HELM_PATTERNS = [
  /helm\s+(install|upgrade|uninstall|rollback|template|lint|package|push|pull|repo|dependency)/i,
  /helmfile\s+(sync|apply|diff|template|destroy|repos)/i,
];

/**
 * Kubectl command patterns
 */
const KUBECTL_PATTERNS = [
  /kubectl\s+(apply|delete|create|get|describe|logs|exec|rollout|scale|patch)/i,
];

/**
 * Docker command patterns
 */
const DOCKER_PATTERNS = [
  /docker\s+(build|push|pull|run|compose|login|tag)/i,
  /docker-compose\s+(up|down|build|push|pull)/i,
  /buildah\s+(build|bud|push|pull)/i,
  /kaniko/i,
];

/**
 * Terraform action references
 */
const TERRAFORM_ACTIONS = [
  'hashicorp/setup-terraform',
  'hashicorp/terraform-github-actions',
  'dflook/terraform-',
  'gruntwork-io/terragrunt-action',
];

/**
 * Helm action references
 */
const HELM_ACTIONS = [
  'azure/setup-helm',
  'azure/k8s-deploy',
  'deliverybot/helm',
  'helm/chart-releaser-action',
];

/**
 * Detect operation type from step content.
 *
 * @param step - Parsed step
 * @returns Operation type or null if not detected
 */
function detectOperationType(step: ParsedStep): OperationType | null {
  const content = step.run ?? '';
  const uses = step.uses ?? '';

  // Check Terraform patterns
  for (const pattern of TERRAFORM_PATTERNS) {
    if (pattern.test(content)) {
      return 'terraform';
    }
  }
  for (const action of TERRAFORM_ACTIONS) {
    if (uses.includes(action)) {
      return 'terraform';
    }
  }

  // Check Helm patterns
  for (const pattern of HELM_PATTERNS) {
    if (pattern.test(content)) {
      return 'helm';
    }
  }
  for (const action of HELM_ACTIONS) {
    if (uses.includes(action)) {
      return 'helm';
    }
  }

  // Check kubectl patterns
  for (const pattern of KUBECTL_PATTERNS) {
    if (pattern.test(content)) {
      return 'kubectl';
    }
  }

  // Check Docker patterns
  for (const pattern of DOCKER_PATTERNS) {
    if (pattern.test(content)) {
      return 'docker';
    }
  }

  // Check for script content
  if (content.trim().length > 0) {
    return 'script';
  }

  return null;
}

/**
 * Extract command from step content.
 *
 * @param step - Parsed step
 * @param operationType - Detected operation type
 * @returns Extracted command
 */
function extractCommand(step: ParsedStep, operationType: OperationType): string {
  const content = step.run ?? '';

  if (operationType === 'terraform') {
    for (const pattern of TERRAFORM_PATTERNS) {
      const match = pattern.exec(content);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    return 'unknown';
  }

  if (operationType === 'helm') {
    for (const pattern of HELM_PATTERNS) {
      const match = pattern.exec(content);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    return 'unknown';
  }

  if (operationType === 'kubectl') {
    for (const pattern of KUBECTL_PATTERNS) {
      const match = pattern.exec(content);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    return 'unknown';
  }

  if (operationType === 'docker') {
    for (const pattern of DOCKER_PATTERNS) {
      const match = pattern.exec(content);
      if (match) {
        return match[1]?.toLowerCase() ?? 'build';
      }
    }
    return 'build';
  }

  return step.uses ?? 'script';
}

/**
 * Extract outputs from step content.
 *
 * @param step - Parsed step
 * @param operationType - Detected operation type
 * @returns Array of output names
 */
function extractOutputs(step: ParsedStep, operationType: OperationType): readonly string[] {
  const outputs: string[] = [];
  const content = step.run ?? '';

  if (operationType === 'terraform') {
    // terraform output <name>
    const outputMatch = /terraform\s+output\s+(?:-raw\s+)?(?:-json\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    let match: RegExpExecArray | null;
    while ((match = outputMatch.exec(content)) !== null) {
      outputs.push(match[1]);
    }

    // GITHUB_OUTPUT pattern
    const ghOutputMatch = /echo\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)=/g;
    while ((match = ghOutputMatch.exec(content)) !== null) {
      outputs.push(match[1]);
    }
  }

  return outputs;
}

/**
 * Extract operations from job steps.
 *
 * @param steps - Array of parsed steps
 * @returns Array of job operations
 */
export function extractOperations(steps: readonly ParsedStep[]): readonly JobOperation[] {
  const operations: JobOperation[] = [];

  for (const step of steps) {
    const operationType = detectOperationType(step);

    if (operationType) {
      const command = extractCommand(step, operationType);
      const stepOutputs = extractOutputs(step, operationType);

      operations.push({
        type: operationType,
        command,
        stepIndex: step.index,
        workingDir: step.workingDirectory,
        outputs: stepOutputs.length > 0 ? stepOutputs : undefined,
      });
    }
  }

  return operations;
}

// ============================================================================
// Node Creation Functions
// ============================================================================

/**
 * Create pipeline and job nodes from a parsed workflow.
 *
 * @param workflow - Parsed workflow structure
 * @param scanId - Current scan ID
 * @returns Object containing nodes and edges
 *
 * @example
 * const { nodes, edges } = createPipelineNodes(parsedWorkflow, 'scan-123');
 */
export function createPipelineNodes(
  workflow: ParsedWorkflow,
  scanId: string
): {
  readonly nodes: readonly (PipelineNode | PipelineJobNode)[];
  readonly edges: readonly (PipelineContainsEdge | JobDependsOnEdge)[];
} {
  const nodes: (PipelineNode | PipelineJobNode)[] = [];
  const edges: (PipelineContainsEdge | JobDependsOnEdge)[] = [];

  // Generate pipeline node ID
  const pipelineId = generatePipelineNodeId(workflow.filePath);

  // Detect if pipeline has TF/Helm jobs
  let hasTerraformJobs = false;
  let hasHelmJobs = false;

  // Create job nodes and collect metadata
  const jobNodesMap = new Map<string, PipelineJobNode>();

  for (const [jobId, job] of Array.from(workflow.jobs.entries())) {
    const operations = extractOperations(job.steps);

    // Check for TF/Helm operations
    const hasTf = operations.some(op => op.type === 'terraform');
    const hasHelm = operations.some(op => op.type === 'helm');

    if (hasTf) hasTerraformJobs = true;
    if (hasHelm) hasHelmJobs = true;

    // Create job node
    const jobNodeId = generateJobNodeId(workflow.filePath, jobId);
    const jobNode: PipelineJobNode = {
      id: jobNodeId,
      type: 'ci_job',
      name: job.name ?? jobId,
      filePath: workflow.filePath,
      lineStart: job.location?.lineStart,
      lineEnd: job.location?.lineEnd,
      scanId,
      metadata: {
        pipelineId,
        jobName: jobId,
        stage: job.stage,
        runsOn: job.runsOn,
        environment: job.environment,
        dependsOn: job.needs ?? [],
        operations,
        artifacts: job.artifacts
          ? [{
              name: job.artifacts.name ?? 'default',
              paths: job.artifacts.paths ?? [],
              expireIn: job.artifacts.expireIn,
            }]
          : [],
        outputs: job.outputs,
        condition: job.condition,
      },
    };

    jobNodesMap.set(jobId, jobNode);
    nodes.push(jobNode);

    // Create PIPELINE_CONTAINS edge
    edges.push({
      id: generateEdgeId('PIPELINE_CONTAINS', pipelineId, jobNodeId),
      type: 'PIPELINE_CONTAINS',
      sourceNodeId: pipelineId,
      targetNodeId: jobNodeId,
      confidence: 100,
    });
  }

  // Create job dependency edges
  for (const [jobId, job] of Array.from(workflow.jobs.entries())) {
    if (job.needs && job.needs.length > 0) {
      const targetJobNode = jobNodesMap.get(jobId);
      if (!targetJobNode) continue;

      for (const dependencyId of job.needs) {
        const sourceJobNode = jobNodesMap.get(dependencyId);
        if (!sourceJobNode) continue;

        edges.push({
          id: generateEdgeId('JOB_DEPENDS_ON', sourceJobNode.id, targetJobNode.id),
          type: 'JOB_DEPENDS_ON',
          sourceNodeId: sourceJobNode.id,
          targetNodeId: targetJobNode.id,
          confidence: 100,
          metadata: {
            artifactRequired: job.artifacts !== undefined,
          },
        });
      }
    }
  }

  // Parse triggers
  const triggers = workflow.triggers.map(t => ({
    type: normalizeTriggerType(t.type, workflow.pipelineType),
    branches: t.branches,
    paths: t.paths,
    tags: t.tags,
    schedule: t.schedule,
  }));

  // Create pipeline node
  const pipelineNode: PipelineNode = {
    id: pipelineId,
    type: 'ci_pipeline',
    name: workflow.name,
    filePath: workflow.filePath,
    lineStart: workflow.location?.lineStart ?? 1,
    lineEnd: workflow.location?.lineEnd,
    scanId,
    metadata: {
      pipelineType: workflow.pipelineType,
      name: workflow.name,
      triggers,
      jobCount: workflow.jobs.size,
      hasTerraformJobs,
      hasHelmJobs,
      defaultBranch: workflow.defaultBranch,
      workflowDispatchInputs: workflow.workflowDispatchInputs,
    },
  };

  // Insert pipeline node at the beginning
  nodes.unshift(pipelineNode);

  return { nodes, edges };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Valid CI pipeline types
 */
const VALID_PIPELINE_TYPES: readonly CIPipelineType[] = [
  'github_actions',
  'gitlab_ci',
  'jenkins',
  'azure_pipelines',
  'circleci',
];

/**
 * Valid trigger types
 */
const VALID_TRIGGER_TYPES: readonly TriggerType[] = [
  'push',
  'pull_request',
  'schedule',
  'workflow_dispatch',
  'manual',
  'api',
  'tag',
];

/**
 * Valid operation types
 */
const VALID_OPERATION_TYPES: readonly OperationType[] = [
  'terraform',
  'helm',
  'kubectl',
  'docker',
  'script',
  'other',
];

/**
 * Type guard for PipelineNode.
 *
 * @param value - Value to validate
 * @returns True if value is a valid PipelineNode
 */
export function isPipelineNode(value: unknown): value is PipelineNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.type !== 'ci_pipeline') {
    return false;
  }

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.name !== 'string') {
    return false;
  }

  if (typeof obj.filePath !== 'string') {
    return false;
  }

  if (typeof obj.scanId !== 'string') {
    return false;
  }

  // Validate metadata
  if (typeof obj.metadata !== 'object' || obj.metadata === null) {
    return false;
  }

  const metadata = obj.metadata as Record<string, unknown>;

  if (!VALID_PIPELINE_TYPES.includes(metadata.pipelineType as CIPipelineType)) {
    return false;
  }

  if (typeof metadata.jobCount !== 'number') {
    return false;
  }

  if (typeof metadata.hasTerraformJobs !== 'boolean') {
    return false;
  }

  if (typeof metadata.hasHelmJobs !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Type guard for PipelineJobNode.
 *
 * @param value - Value to validate
 * @returns True if value is a valid PipelineJobNode
 */
export function isPipelineJobNode(value: unknown): value is PipelineJobNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.type !== 'ci_job') {
    return false;
  }

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.name !== 'string') {
    return false;
  }

  if (typeof obj.filePath !== 'string') {
    return false;
  }

  if (typeof obj.scanId !== 'string') {
    return false;
  }

  // Validate metadata
  if (typeof obj.metadata !== 'object' || obj.metadata === null) {
    return false;
  }

  const metadata = obj.metadata as Record<string, unknown>;

  if (typeof metadata.pipelineId !== 'string') {
    return false;
  }

  if (typeof metadata.jobName !== 'string') {
    return false;
  }

  if (!Array.isArray(metadata.dependsOn)) {
    return false;
  }

  if (!Array.isArray(metadata.operations)) {
    return false;
  }

  return true;
}

/**
 * Type guard for PipelineContainsEdge.
 *
 * @param value - Value to validate
 * @returns True if value is a valid PipelineContainsEdge
 */
export function isPipelineContainsEdge(value: unknown): value is PipelineContainsEdge {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.type !== 'PIPELINE_CONTAINS') {
    return false;
  }

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.sourceNodeId !== 'string' || obj.sourceNodeId.length === 0) {
    return false;
  }

  if (typeof obj.targetNodeId !== 'string' || obj.targetNodeId.length === 0) {
    return false;
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) {
    return false;
  }

  return true;
}

/**
 * Type guard for JobDependsOnEdge.
 *
 * @param value - Value to validate
 * @returns True if value is a valid JobDependsOnEdge
 */
export function isJobDependsOnEdge(value: unknown): value is JobDependsOnEdge {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.type !== 'JOB_DEPENDS_ON') {
    return false;
  }

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.sourceNodeId !== 'string' || obj.sourceNodeId.length === 0) {
    return false;
  }

  if (typeof obj.targetNodeId !== 'string' || obj.targetNodeId.length === 0) {
    return false;
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) {
    return false;
  }

  if (typeof obj.metadata !== 'object' || obj.metadata === null) {
    return false;
  }

  return true;
}

/**
 * Type guard for OperatesOnEdge.
 *
 * @param value - Value to validate
 * @returns True if value is a valid OperatesOnEdge
 */
export function isOperatesOnEdge(value: unknown): value is OperatesOnEdge {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.type !== 'OPERATES_ON') {
    return false;
  }

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.sourceNodeId !== 'string' || obj.sourceNodeId.length === 0) {
    return false;
  }

  if (typeof obj.targetNodeId !== 'string' || obj.targetNodeId.length === 0) {
    return false;
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) {
    return false;
  }

  if (typeof obj.metadata !== 'object' || obj.metadata === null) {
    return false;
  }

  const metadata = obj.metadata as Record<string, unknown>;

  if (typeof metadata.operation !== 'string') {
    return false;
  }

  if (!VALID_OPERATION_TYPES.includes(metadata.operationType as OperationType)) {
    return false;
  }

  if (typeof metadata.stepIndex !== 'number') {
    return false;
  }

  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all Terraform operations from a pipeline job node.
 *
 * @param jobNode - Pipeline job node
 * @returns Array of Terraform operations
 */
export function getTerraformOperations(jobNode: PipelineJobNode): readonly JobOperation[] {
  return jobNode.metadata.operations.filter(op => op.type === 'terraform');
}

/**
 * Get all Helm operations from a pipeline job node.
 *
 * @param jobNode - Pipeline job node
 * @returns Array of Helm operations
 */
export function getHelmOperations(jobNode: PipelineJobNode): readonly JobOperation[] {
  return jobNode.metadata.operations.filter(op => op.type === 'helm');
}

/**
 * Check if a job has any infrastructure operations.
 *
 * @param jobNode - Pipeline job node
 * @returns True if job has TF, Helm, or kubectl operations
 */
export function hasInfraOperations(jobNode: PipelineJobNode): boolean {
  return jobNode.metadata.operations.some(
    op => op.type === 'terraform' || op.type === 'helm' || op.type === 'kubectl'
  );
}

/**
 * Get job nodes that depend on a given job.
 *
 * @param jobId - Job ID to find dependents for
 * @param edges - All JOB_DEPENDS_ON edges
 * @returns Array of dependent job node IDs
 */
export function getDependentJobs(
  jobId: string,
  edges: readonly JobDependsOnEdge[]
): readonly string[] {
  return edges
    .filter(edge => edge.sourceNodeId === jobId)
    .map(edge => edge.targetNodeId);
}

/**
 * Get job nodes that a given job depends on.
 *
 * @param jobId - Job ID to find dependencies for
 * @param edges - All JOB_DEPENDS_ON edges
 * @returns Array of dependency job node IDs
 */
export function getJobDependencies(
  jobId: string,
  edges: readonly JobDependsOnEdge[]
): readonly string[] {
  return edges
    .filter(edge => edge.targetNodeId === jobId)
    .map(edge => edge.sourceNodeId);
}

/**
 * Convert pipeline node to database insert format.
 *
 * @param node - Pipeline node
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Database row object
 */
export function pipelineNodeToDbFormat(
  node: PipelineNode,
  tenantId: string
): Record<string, unknown> {
  return {
    id: node.id,
    scan_id: node.scanId,
    tenant_id: tenantId,
    original_id: node.id,
    type: node.type,
    name: node.name,
    file_path: node.filePath,
    line_start: node.lineStart ?? 1,
    line_end: node.lineEnd ?? 1,
    metadata: node.metadata,
    created_at: new Date(),
  };
}

/**
 * Convert job node to database insert format.
 *
 * @param node - Job node
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Database row object
 */
export function jobNodeToDbFormat(
  node: PipelineJobNode,
  tenantId: string
): Record<string, unknown> {
  return {
    id: node.id,
    scan_id: node.scanId,
    tenant_id: tenantId,
    original_id: node.id,
    type: node.type,
    name: node.name,
    file_path: node.filePath,
    line_start: node.lineStart ?? 1,
    line_end: node.lineEnd ?? 1,
    metadata: node.metadata,
    created_at: new Date(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  VALID_PIPELINE_TYPES,
  VALID_TRIGGER_TYPES,
  VALID_OPERATION_TYPES,
  TERRAFORM_PATTERNS,
  HELM_PATTERNS,
  KUBECTL_PATTERNS,
  DOCKER_PATTERNS,
  TERRAFORM_ACTIONS,
  HELM_ACTIONS,
};
