/**
 * GitHub Actions Parser Types
 * @module parsers/github-actions/types
 *
 * Type definitions for GitHub Actions workflow parsing and dependency detection.
 * Implements comprehensive typing for GitHub Actions YAML workflow files.
 *
 * TASK-XREF-001: GitHub Actions Parser - Core type definitions
 * TASK-GHA-001: Workflow structure parsing
 * TASK-GHA-002: Job and step extraction
 * TASK-GHA-003: Terraform/Helm step detection
 */

import { SourceLocation } from '../terraform/types';
import { BaseNode, NodeLocation, EdgeMetadata, GraphEdge } from '../../types/graph';

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Brand utility type for creating nominal types from primitives
 */
type Brand<T, B> = T & { readonly __brand: B };

/**
 * Branded type for GitHub Actions workflow IDs
 * @example
 * const workflowId = 'workflow-ci' as GhaWorkflowId;
 */
export type GhaWorkflowId = Brand<string, 'GhaWorkflowId'>;

/**
 * Branded type for GitHub Actions job IDs
 * @example
 * const jobId = 'job-build' as GhaJobId;
 */
export type GhaJobId = Brand<string, 'GhaJobId'>;

/**
 * Branded type for GitHub Actions step IDs
 * @example
 * const stepId = 'step-checkout' as GhaStepId;
 */
export type GhaStepId = Brand<string, 'GhaStepId'>;

/**
 * Branded type for GitHub Actions expression paths
 * @example
 * const expr = '${{ github.event.inputs.name }}' as GhaExpressionPath;
 */
export type GhaExpressionPath = Brand<string, 'GhaExpressionPath'>;

// ============================================================================
// Workflow Structure Types
// ============================================================================

/**
 * Complete GitHub Actions workflow representation
 * Parsed from .github/workflows/*.yml files
 */
export interface GhaWorkflow {
  /** Workflow name (from 'name' field or filename) */
  readonly name: string;
  /** Absolute path to workflow file */
  readonly filePath: string;
  /** Workflow triggers (on:) */
  readonly triggers: readonly GhaTrigger[];
  /** Workflow-level environment variables */
  readonly env: Readonly<Record<string, string>>;
  /** Jobs defined in the workflow */
  readonly jobs: ReadonlyMap<string, GhaJob>;
  /** Workflow defaults for run steps */
  readonly defaults?: GhaDefaults;
  /** Workflow-level permissions */
  readonly permissions?: GhaPermissions;
  /** Concurrency settings */
  readonly concurrency?: GhaConcurrency;
  /** Source location in file */
  readonly location: SourceLocation;
}

/**
 * Workflow defaults configuration
 */
export interface GhaDefaults {
  /** Default run step settings */
  readonly run?: GhaRunDefaults;
}

/**
 * Default settings for run steps
 */
export interface GhaRunDefaults {
  /** Default shell */
  readonly shell?: GhaShellType;
  /** Default working directory */
  readonly workingDirectory?: string;
}

/**
 * Supported shell types for run steps
 */
export type GhaShellType =
  | 'bash'
  | 'pwsh'
  | 'python'
  | 'sh'
  | 'cmd'
  | 'powershell';

/**
 * Workflow permissions configuration
 * Maps GitHub token scopes to permission levels
 */
export interface GhaPermissions {
  readonly actions?: GhaPermissionLevel;
  readonly checks?: GhaPermissionLevel;
  readonly contents?: GhaPermissionLevel;
  readonly deployments?: GhaPermissionLevel;
  readonly discussions?: GhaPermissionLevel;
  readonly idToken?: GhaPermissionLevel;
  readonly issues?: GhaPermissionLevel;
  readonly packages?: GhaPermissionLevel;
  readonly pages?: GhaPermissionLevel;
  readonly pullRequests?: GhaPermissionLevel;
  readonly repositoryProjects?: GhaPermissionLevel;
  readonly securityEvents?: GhaPermissionLevel;
  readonly statuses?: GhaPermissionLevel;
}

/**
 * Permission levels for GitHub token scopes
 */
export type GhaPermissionLevel = 'read' | 'write' | 'none';

/**
 * Workflow concurrency settings
 */
export interface GhaConcurrency {
  /** Concurrency group name (can contain expressions) */
  readonly group: string;
  /** Whether to cancel in-progress runs */
  readonly cancelInProgress: boolean;
}

// ============================================================================
// Job Structure Types
// ============================================================================

/**
 * GitHub Actions job definition
 */
export interface GhaJob {
  /** Job ID (key in jobs map) */
  readonly id: string;
  /** Job display name */
  readonly name: string | null;
  /** Runner specification */
  readonly runsOn: string | readonly string[];
  /** Job dependencies (needs:) */
  readonly needs: readonly string[];
  /** Job outputs */
  readonly outputs: Readonly<Record<string, string>>;
  /** Job steps */
  readonly steps: readonly GhaStep[];
  /** Job-level environment variables */
  readonly env: Readonly<Record<string, string>>;
  /** Conditional execution */
  readonly if?: string;
  /** Matrix strategy */
  readonly strategy?: GhaStrategy;
  /** Container configuration */
  readonly container?: GhaContainer;
  /** Service containers */
  readonly services?: Readonly<Record<string, GhaService>>;
  /** Job timeout in minutes */
  readonly timeoutMinutes?: number;
  /** Continue on error */
  readonly continueOnError?: boolean;
  /** Deployment environment */
  readonly environment?: GhaEnvironment;
  /** Job-level permissions */
  readonly permissions?: GhaPermissions;
  /** Job-level concurrency */
  readonly concurrency?: GhaConcurrency;
  /** Job-level defaults */
  readonly defaults?: GhaDefaults;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Matrix strategy configuration
 */
export interface GhaStrategy {
  /** Matrix configuration */
  readonly matrix: GhaMatrix;
  /** Fail fast behavior */
  readonly failFast: boolean;
  /** Maximum parallel jobs */
  readonly maxParallel?: number;
}

/**
 * Matrix configuration
 */
export interface GhaMatrix {
  /** Matrix dimensions */
  readonly dimensions: Readonly<Record<string, readonly unknown[]>>;
  /** Include additional combinations */
  readonly include?: readonly Readonly<Record<string, unknown>>[];
  /** Exclude specific combinations */
  readonly exclude?: readonly Readonly<Record<string, unknown>>[];
}

/**
 * Container configuration for jobs
 */
export interface GhaContainer {
  /** Container image */
  readonly image: string;
  /** Container credentials */
  readonly credentials?: GhaContainerCredentials;
  /** Environment variables */
  readonly env?: Readonly<Record<string, string>>;
  /** Port mappings */
  readonly ports?: readonly (number | string)[];
  /** Volume mounts */
  readonly volumes?: readonly string[];
  /** Container options */
  readonly options?: string;
}

/**
 * Container registry credentials
 */
export interface GhaContainerCredentials {
  readonly username: string;
  readonly password: string;
}

/**
 * Service container configuration
 */
export interface GhaService {
  /** Service image */
  readonly image: string;
  /** Service credentials */
  readonly credentials?: GhaContainerCredentials;
  /** Environment variables */
  readonly env?: Readonly<Record<string, string>>;
  /** Port mappings */
  readonly ports?: readonly (number | string)[];
  /** Volume mounts */
  readonly volumes?: readonly string[];
  /** Service options */
  readonly options?: string;
}

/**
 * Deployment environment configuration
 */
export interface GhaEnvironment {
  /** Environment name */
  readonly name: string;
  /** Environment URL */
  readonly url?: string;
}

// ============================================================================
// Step Types - Discriminated Union
// ============================================================================

/**
 * GitHub Actions step - discriminated union of run and uses steps
 */
export type GhaStep = GhaRunStep | GhaUsesStep;

/**
 * Base interface for all step types
 */
export interface GhaStepBase {
  /** Step ID for referencing outputs */
  readonly id?: string;
  /** Step display name */
  readonly name?: string;
  /** Conditional execution */
  readonly if?: string;
  /** Step-level environment variables */
  readonly env?: Readonly<Record<string, string>>;
  /** Continue on error */
  readonly continueOnError?: boolean;
  /** Step timeout in minutes */
  readonly timeoutMinutes?: number;
  /** Working directory */
  readonly workingDirectory?: string;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Run step - executes shell commands
 */
export interface GhaRunStep extends GhaStepBase {
  /** Step type discriminator */
  readonly type: 'run';
  /** Shell commands to execute */
  readonly run: string;
  /** Shell to use */
  readonly shell?: GhaShellType;
}

/**
 * Uses step - invokes a reusable action
 */
export interface GhaUsesStep extends GhaStepBase {
  /** Step type discriminator */
  readonly type: 'uses';
  /** Action reference (owner/repo@ref or ./path) */
  readonly uses: string;
  /** Action inputs */
  readonly with?: Readonly<Record<string, string | number | boolean>>;
}

// ============================================================================
// Trigger Types - Discriminated Union
// ============================================================================

/**
 * GitHub Actions trigger - discriminated union of all trigger types
 */
export type GhaTrigger =
  | GhaPushTrigger
  | GhaPullRequestTrigger
  | GhaPullRequestTargetTrigger
  | GhaWorkflowDispatchTrigger
  | GhaScheduleTrigger
  | GhaWorkflowCallTrigger
  | GhaWorkflowRunTrigger
  | GhaRepositoryDispatchTrigger
  | GhaReleaseTrigger
  | GhaIssueTrigger
  | GhaIssueCommentTrigger
  | GhaGenericTrigger;

/**
 * Base interface for all trigger types
 */
export interface GhaTriggerBase {
  /** Trigger type discriminator */
  readonly type: GhaTriggerType;
}

/**
 * All supported trigger types
 */
export type GhaTriggerType =
  | 'push'
  | 'pull_request'
  | 'pull_request_target'
  | 'workflow_dispatch'
  | 'schedule'
  | 'workflow_call'
  | 'workflow_run'
  | 'repository_dispatch'
  | 'release'
  | 'issues'
  | 'issue_comment'
  | 'create'
  | 'delete'
  | 'deployment'
  | 'deployment_status'
  | 'fork'
  | 'gollum'
  | 'label'
  | 'milestone'
  | 'page_build'
  | 'project'
  | 'project_card'
  | 'project_column'
  | 'public'
  | 'registry_package'
  | 'status'
  | 'watch';

/**
 * Push trigger configuration
 */
export interface GhaPushTrigger extends GhaTriggerBase {
  readonly type: 'push';
  /** Branches to include */
  readonly branches?: readonly string[];
  /** Branches to exclude */
  readonly branchesIgnore?: readonly string[];
  /** Tags to include */
  readonly tags?: readonly string[];
  /** Tags to exclude */
  readonly tagsIgnore?: readonly string[];
  /** Paths to include */
  readonly paths?: readonly string[];
  /** Paths to exclude */
  readonly pathsIgnore?: readonly string[];
}

/**
 * Pull request trigger configuration
 */
export interface GhaPullRequestTrigger extends GhaTriggerBase {
  readonly type: 'pull_request';
  /** Branches to include */
  readonly branches?: readonly string[];
  /** Branches to exclude */
  readonly branchesIgnore?: readonly string[];
  /** Paths to include */
  readonly paths?: readonly string[];
  /** Paths to exclude */
  readonly pathsIgnore?: readonly string[];
  /** Activity types to trigger on */
  readonly types?: readonly GhaPullRequestType[];
}

/**
 * Pull request activity types
 */
export type GhaPullRequestType =
  | 'assigned'
  | 'unassigned'
  | 'labeled'
  | 'unlabeled'
  | 'opened'
  | 'edited'
  | 'closed'
  | 'reopened'
  | 'synchronize'
  | 'converted_to_draft'
  | 'ready_for_review'
  | 'locked'
  | 'unlocked'
  | 'review_requested'
  | 'review_request_removed'
  | 'auto_merge_enabled'
  | 'auto_merge_disabled';

/**
 * Pull request target trigger configuration
 */
export interface GhaPullRequestTargetTrigger extends GhaTriggerBase {
  readonly type: 'pull_request_target';
  /** Branches to include */
  readonly branches?: readonly string[];
  /** Branches to exclude */
  readonly branchesIgnore?: readonly string[];
  /** Paths to include */
  readonly paths?: readonly string[];
  /** Paths to exclude */
  readonly pathsIgnore?: readonly string[];
  /** Activity types to trigger on */
  readonly types?: readonly GhaPullRequestType[];
}

/**
 * Workflow dispatch trigger configuration (manual trigger)
 */
export interface GhaWorkflowDispatchTrigger extends GhaTriggerBase {
  readonly type: 'workflow_dispatch';
  /** Input definitions */
  readonly inputs?: Readonly<Record<string, GhaWorkflowInput>>;
}

/**
 * Workflow dispatch input definition
 */
export interface GhaWorkflowInput {
  /** Input description */
  readonly description?: string;
  /** Whether input is required */
  readonly required: boolean;
  /** Default value */
  readonly default?: string;
  /** Input type */
  readonly type: GhaInputType;
  /** Options for choice type */
  readonly options?: readonly string[];
}

/**
 * Workflow input types
 */
export type GhaInputType = 'string' | 'boolean' | 'choice' | 'environment';

/**
 * Schedule trigger configuration (cron)
 */
export interface GhaScheduleTrigger extends GhaTriggerBase {
  readonly type: 'schedule';
  /** Cron expressions */
  readonly cron: readonly string[];
}

/**
 * Workflow call trigger configuration (reusable workflow)
 */
export interface GhaWorkflowCallTrigger extends GhaTriggerBase {
  readonly type: 'workflow_call';
  /** Input definitions */
  readonly inputs?: Readonly<Record<string, GhaWorkflowCallInput>>;
  /** Output definitions */
  readonly outputs?: Readonly<Record<string, GhaWorkflowCallOutput>>;
  /** Secret definitions */
  readonly secrets?: Readonly<Record<string, GhaWorkflowCallSecret>>;
}

/**
 * Workflow call input definition
 */
export interface GhaWorkflowCallInput {
  /** Input description */
  readonly description?: string;
  /** Whether input is required */
  readonly required: boolean;
  /** Default value */
  readonly default?: string;
  /** Input type */
  readonly type: 'string' | 'boolean' | 'number';
}

/**
 * Workflow call output definition
 */
export interface GhaWorkflowCallOutput {
  /** Output description */
  readonly description?: string;
  /** Output value expression */
  readonly value: string;
}

/**
 * Workflow call secret definition
 */
export interface GhaWorkflowCallSecret {
  /** Secret description */
  readonly description?: string;
  /** Whether secret is required */
  readonly required: boolean;
}

/**
 * Workflow run trigger configuration
 */
export interface GhaWorkflowRunTrigger extends GhaTriggerBase {
  readonly type: 'workflow_run';
  /** Workflows that trigger this workflow */
  readonly workflows: readonly string[];
  /** Activity types to trigger on */
  readonly types?: readonly ('completed' | 'requested' | 'in_progress')[];
  /** Branches to filter on */
  readonly branches?: readonly string[];
  /** Branches to exclude */
  readonly branchesIgnore?: readonly string[];
}

/**
 * Repository dispatch trigger configuration
 */
export interface GhaRepositoryDispatchTrigger extends GhaTriggerBase {
  readonly type: 'repository_dispatch';
  /** Event types to trigger on */
  readonly types?: readonly string[];
}

/**
 * Release trigger configuration
 */
export interface GhaReleaseTrigger extends GhaTriggerBase {
  readonly type: 'release';
  /** Activity types to trigger on */
  readonly types?: readonly GhaReleaseType[];
}

/**
 * Release activity types
 */
export type GhaReleaseType =
  | 'published'
  | 'unpublished'
  | 'created'
  | 'edited'
  | 'deleted'
  | 'prereleased'
  | 'released';

/**
 * Issue trigger configuration
 */
export interface GhaIssueTrigger extends GhaTriggerBase {
  readonly type: 'issues';
  /** Activity types to trigger on */
  readonly types?: readonly GhaIssueType[];
}

/**
 * Issue activity types
 */
export type GhaIssueType =
  | 'opened'
  | 'edited'
  | 'deleted'
  | 'transferred'
  | 'pinned'
  | 'unpinned'
  | 'closed'
  | 'reopened'
  | 'assigned'
  | 'unassigned'
  | 'labeled'
  | 'unlabeled'
  | 'locked'
  | 'unlocked'
  | 'milestoned'
  | 'demilestoned';

/**
 * Issue comment trigger configuration
 */
export interface GhaIssueCommentTrigger extends GhaTriggerBase {
  readonly type: 'issue_comment';
  /** Activity types to trigger on */
  readonly types?: readonly ('created' | 'edited' | 'deleted')[];
}

/**
 * Generic trigger for less common event types
 */
export interface GhaGenericTrigger extends GhaTriggerBase {
  readonly type: Exclude<GhaTriggerType,
    | 'push'
    | 'pull_request'
    | 'pull_request_target'
    | 'workflow_dispatch'
    | 'schedule'
    | 'workflow_call'
    | 'workflow_run'
    | 'repository_dispatch'
    | 'release'
    | 'issues'
    | 'issue_comment'
  >;
  /** Activity types to trigger on */
  readonly types?: readonly string[];
}

// ============================================================================
// Expression Types
// ============================================================================

/**
 * GitHub Actions expression found in workflow
 */
export interface GhaExpression {
  /** Raw expression text including ${{ }} */
  readonly raw: string;
  /** Expression content without ${{ }} wrapper */
  readonly content: string;
  /** Expression body (alias for content) */
  readonly body: string;
  /** Expression type classification */
  readonly type: GhaExpressionType;
  /** Location in file */
  readonly location: SourceLocation;
  /** Context being accessed */
  readonly context?: GhaExpressionContext;
  /** Function being called (if function expression) */
  readonly function?: string;
  /** Referenced variables/values (string paths) */
  readonly references: readonly string[];
  /** Structured context references with position info */
  readonly contextReferences: readonly GhaContextReference[];
  /** Function calls in expression */
  readonly functions: readonly GhaFunctionCall[];
}

/**
 * Reference to a GitHub Actions context within an expression
 * Provides detailed position and path information for cross-referencing
 */
export interface GhaContextReference {
  /** Context name (github, secrets, env, etc.) */
  readonly context: GhaExpressionContext;
  /** Property path within context (e.g., ['event', 'inputs', 'name']) */
  readonly path: readonly string[];
  /** Full reference string (e.g., 'github.event.inputs.name') */
  readonly fullPath: string;
  /** Position within expression body */
  readonly position: {
    readonly start: number;
    readonly end: number;
  };
}

/**
 * Function call within a GitHub Actions expression
 */
export interface GhaFunctionCall {
  /** Function name (e.g., 'contains', 'format', 'toJSON') */
  readonly name: string;
  /** Function arguments (may contain nested expressions) */
  readonly arguments: readonly string[];
  /** Position within expression body */
  readonly position: {
    readonly start: number;
    readonly end: number;
  };
}

/**
 * Types of GitHub Actions expressions
 */
export type GhaExpressionType =
  | 'context'        // ${{ github.event.inputs.name }}
  | 'function'       // ${{ contains(github.event.labels.*.name, 'bug') }}
  | 'literal'        // ${{ true }} or ${{ 'string' }}
  | 'comparison'     // ${{ github.event_name == 'push' }}
  | 'logical'        // ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
  | 'ternary'        // ${{ github.event_name == 'push' && 'value1' || 'value2' }}
  | 'mixed';         // Complex combination

/**
 * GitHub Actions expression contexts
 */
export type GhaExpressionContext =
  | 'github'
  | 'env'
  | 'vars'
  | 'job'
  | 'jobs'
  | 'steps'
  | 'runner'
  | 'secrets'
  | 'strategy'
  | 'matrix'
  | 'needs'
  | 'inputs';

// ============================================================================
// Node Types for Graph Building
// ============================================================================

/**
 * GitHub Actions workflow node for dependency graph
 */
export interface GhaWorkflowNode extends BaseNode {
  /** Node type discriminator */
  readonly type: 'gha_workflow';
  /** Workflow trigger types */
  readonly triggers: readonly string[];
  /** Number of jobs in workflow */
  readonly jobCount: number;
  /** Whether workflow uses secrets */
  readonly hasSecrets: boolean;
  /** Whether workflow has manual dispatch */
  readonly hasManualTrigger: boolean;
  /** Whether workflow is reusable (workflow_call) */
  readonly isReusable: boolean;
  /** Cron schedules if scheduled */
  readonly schedules: readonly string[];
}

/**
 * GitHub Actions job node for dependency graph
 */
export interface GhaJobNode extends BaseNode {
  /** Node type discriminator */
  readonly type: 'gha_job';
  /** Parent workflow ID */
  readonly workflowId: string;
  /** Runner specification */
  readonly runsOn: string;
  /** Number of job dependencies */
  readonly needsCount: number;
  /** Number of steps */
  readonly stepCount: number;
  /** Whether job contains Terraform steps */
  readonly hasTerraform: boolean;
  /** Whether job contains Helm steps */
  readonly hasHelm: boolean;
  /** Whether job has matrix strategy */
  readonly hasMatrix: boolean;
  /** Whether job uses container */
  readonly hasContainer: boolean;
  /** Environment name if deploying */
  readonly environment?: string;
}

/**
 * GitHub Actions step node for dependency graph
 */
export interface GhaStepNode extends BaseNode {
  /** Node type discriminator */
  readonly type: 'gha_step';
  /** Parent job ID */
  readonly jobId: string;
  /** Parent workflow ID */
  readonly workflowId: string;
  /** Step type (run or uses) */
  readonly stepType: 'run' | 'uses';
  /** Action being used (if uses step) */
  readonly action?: string;
  /** Whether step is Terraform-related */
  readonly isTerraform: boolean;
  /** Whether step is Helm-related */
  readonly isHelm: boolean;
}

// ============================================================================
// Edge Types for Graph Building
// ============================================================================

/**
 * GitHub Actions specific edge types
 */
export type GhaEdgeType =
  | 'gha_needs'           // Job dependency (needs:)
  | 'gha_uses_action'     // Step uses action
  | 'gha_uses_workflow'   // Workflow calls another workflow
  | 'gha_uses_tf'         // Step runs Terraform
  | 'gha_uses_helm'       // Step runs Helm
  | 'gha_outputs_to'      // Job output consumed by another job
  | 'gha_triggers';       // Workflow triggers another workflow

/**
 * GitHub Actions edge for dependency graph
 */
export interface GhaEdge extends GraphEdge {
  /** Edge type */
  readonly type: GhaEdgeType;
  /** Edge metadata */
  readonly metadata: EdgeMetadata & GhaEdgeMetadata;
}

/**
 * GitHub Actions specific edge metadata
 */
export interface GhaEdgeMetadata {
  /** Output name being passed (for gha_outputs_to) */
  readonly outputName?: string;
  /** Action version (for gha_uses_action) */
  readonly actionVersion?: string;
  /** Terraform command (for gha_uses_tf) */
  readonly terraformCommand?: string;
  /** Helm command (for gha_uses_helm) */
  readonly helmCommand?: string;
}

// ============================================================================
// Terraform/Helm Step Detection Types
// ============================================================================

/**
 * Information about a Terraform step detected in workflow
 * TASK-GHA-003: Terraform step detection
 */
export interface TerraformStepInfo {
  /** Step index within the job's steps array */
  readonly stepIndex: number;
  /** Step ID or generated identifier */
  readonly stepId?: string;
  /** Parent job ID */
  readonly jobId: string;
  /** Terraform command being run */
  readonly command: TerraformCommand;
  /** Working directory */
  readonly workingDirectory?: string;
  /** Action reference if using a Terraform action (e.g., hashicorp/setup-terraform) */
  readonly actionRef?: string;
  /** Detected backend configuration */
  readonly backend?: TerraformBackendInfo;
  /** Detected workspace */
  readonly workspace?: string;
  /** Whether using Terraform Cloud */
  readonly usesCloud: boolean;
  /** Detected var files */
  readonly varFiles: readonly string[];
  /** CLI arguments passed to terraform command */
  readonly arguments?: readonly string[];
  /** Variables passed via -var flag */
  readonly variables?: Readonly<Record<string, string>>;
  /** Environment variables set */
  readonly envVars: Readonly<Record<string, string>>;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Terraform commands detected in workflows
 */
export type TerraformCommand =
  | 'init'
  | 'validate'
  | 'plan'
  | 'apply'
  | 'destroy'
  | 'fmt'
  | 'output'
  | 'import'
  | 'state'
  | 'workspace'
  | 'refresh'
  | 'taint'
  | 'untaint'
  | 'force-unlock'
  | 'unknown';

/**
 * Detected Terraform backend information
 */
export interface TerraformBackendInfo {
  /** Backend type */
  readonly type: string;
  /** Backend configuration (non-sensitive) */
  readonly config: Readonly<Record<string, string>>;
}

/**
 * Information about a Helm step detected in workflow
 * TASK-GHA-003: Helm step detection
 */
export interface HelmStepInfo {
  /** Step index within the job's steps array */
  readonly stepIndex: number;
  /** Step ID or generated identifier */
  readonly stepId?: string;
  /** Parent job ID */
  readonly jobId: string;
  /** Helm command being run */
  readonly command: HelmCommand;
  /** Chart path or name */
  readonly chartPath?: string;
  /** Chart repository URL or alias */
  readonly chartRepository?: string;
  /** Release name */
  readonly releaseName?: string;
  /** Chart reference (alias for chartPath) */
  readonly chart?: string;
  /** Target namespace */
  readonly namespace?: string;
  /** Values files */
  readonly valuesFiles: readonly string[];
  /** Set values */
  readonly setValues: Readonly<Record<string, string>>;
  /** Action reference if using a Helm action (e.g., azure/setup-helm) */
  readonly actionRef?: string;
  /** Whether this is a dry-run */
  readonly dryRun: boolean;
  /** Whether atomic flag is set */
  readonly atomic: boolean;
  /** Whether wait flag is set */
  readonly wait: boolean;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Helm commands detected in workflows
 */
export type HelmCommand =
  | 'install'
  | 'upgrade'
  | 'uninstall'
  | 'rollback'
  | 'template'
  | 'lint'
  | 'package'
  | 'push'
  | 'pull'
  | 'repo'
  | 'dependency'
  | 'test'
  | 'unknown';

// ============================================================================
// Additional Tool Detection Types
// ============================================================================

/**
 * Information about a Kubernetes (kubectl) step detected in workflow
 */
export interface KubernetesStepInfo {
  /** Step index within the job's steps array */
  readonly stepIndex: number;
  /** Step ID if defined */
  readonly stepId?: string;
  /** Parent job ID */
  readonly jobId: string;
  /** Detected kubectl command */
  readonly command: KubernetesCommand;
  /** Resource type (e.g., deployment, service, pod) */
  readonly resourceType?: string;
  /** Resource name */
  readonly resourceName?: string;
  /** Target namespace */
  readonly namespace?: string;
  /** Manifest files applied */
  readonly manifests?: readonly string[];
  /** Action reference if using a K8s action */
  readonly actionRef?: string;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Kubernetes commands detected in workflows
 */
export type KubernetesCommand =
  | 'apply'
  | 'delete'
  | 'create'
  | 'get'
  | 'describe'
  | 'logs'
  | 'exec'
  | 'rollout'
  | 'scale'
  | 'patch'
  | 'label'
  | 'annotate'
  | 'port-forward'
  | 'config'
  | 'unknown';

/**
 * Information about an AWS step detected in workflow
 */
export interface AwsStepInfo {
  /** Step index within the job's steps array */
  readonly stepIndex: number;
  /** Step ID if defined */
  readonly stepId?: string;
  /** Parent job ID */
  readonly jobId: string;
  /** AWS service being used (e.g., s3, ec2, ecs, lambda) */
  readonly service?: string;
  /** AWS CLI command */
  readonly command?: string;
  /** AWS region */
  readonly region?: string;
  /** Action reference if using an AWS action */
  readonly actionRef?: string;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Information about a GCP step detected in workflow
 */
export interface GcpStepInfo {
  /** Step index within the job's steps array */
  readonly stepIndex: number;
  /** Step ID if defined */
  readonly stepId?: string;
  /** Parent job ID */
  readonly jobId: string;
  /** GCP service being used (e.g., compute, gke, storage) */
  readonly service?: string;
  /** gcloud command */
  readonly command?: string;
  /** GCP project ID */
  readonly project?: string;
  /** Action reference if using a GCP action */
  readonly actionRef?: string;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Information about an Azure step detected in workflow
 */
export interface AzureStepInfo {
  /** Step index within the job's steps array */
  readonly stepIndex: number;
  /** Step ID if defined */
  readonly stepId?: string;
  /** Parent job ID */
  readonly jobId: string;
  /** Azure service being used */
  readonly service?: string;
  /** Azure CLI command */
  readonly command?: string;
  /** Resource group */
  readonly resourceGroup?: string;
  /** Action reference if using an Azure action */
  readonly actionRef?: string;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Information about a Docker step detected in workflow
 */
export interface DockerStepInfo {
  /** Step index within the job's steps array */
  readonly stepIndex: number;
  /** Step ID if defined */
  readonly stepId?: string;
  /** Parent job ID */
  readonly jobId: string;
  /** Docker command */
  readonly command: DockerCommand;
  /** Image reference */
  readonly image?: string;
  /** Dockerfile path */
  readonly dockerfile?: string;
  /** Build context path */
  readonly context?: string;
  /** Registry URL */
  readonly registry?: string;
  /** Action reference if using a Docker action */
  readonly actionRef?: string;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Docker commands detected in workflows
 */
export type DockerCommand =
  | 'build'
  | 'push'
  | 'pull'
  | 'run'
  | 'compose'
  | 'login'
  | 'logout'
  | 'tag'
  | 'buildx'
  | 'manifest'
  | 'unknown';

/**
 * Union type for all tool step detection info
 */
export type GhaToolStepInfo =
  | TerraformStepInfo
  | HelmStepInfo
  | KubernetesStepInfo
  | AwsStepInfo
  | GcpStepInfo
  | AzureStepInfo
  | DockerStepInfo;

/**
 * Tool type discriminator
 */
export type GhaToolType =
  | 'terraform'
  | 'helm'
  | 'kubernetes'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'docker';

// ============================================================================
// Parse Result Types
// ============================================================================

/**
 * GitHub Actions parse error
 */
export interface GhaParseError {
  /** Error message */
  readonly message: string;
  /** File path */
  readonly file: string;
  /** Line number */
  readonly line?: number;
  /** Column number */
  readonly column?: number;
  /** Error severity */
  readonly severity: 'error' | 'warning';
  /** Error code */
  readonly code: GhaParseErrorCode;
}

/**
 * GitHub Actions parse error codes
 */
export type GhaParseErrorCode =
  | 'INVALID_YAML'
  | 'INVALID_WORKFLOW'
  | 'INVALID_JOB'
  | 'INVALID_STEP'
  | 'INVALID_TRIGGER'
  | 'INVALID_EXPRESSION'
  | 'INVALID_ACTION_REF'
  | 'INVALID_FIELD_TYPE'
  | 'CIRCULAR_DEPENDENCY'
  | 'MISSING_REQUIRED_FIELD'
  | 'UNKNOWN_CONTEXT'
  | 'FILE_READ_ERROR'
  | 'FILE_TOO_LARGE'
  | 'PARSE_TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * Complete parse result for a GitHub Actions workflow
 */
export interface GhaParseResult {
  /** Whether parsing succeeded */
  readonly success: boolean;
  /** Parsed workflow (present if success or partial parse) */
  readonly workflow?: GhaWorkflow;
  /** Graph nodes generated */
  readonly nodes: readonly (GhaWorkflowNode | GhaJobNode | GhaStepNode)[];
  /** Graph edges generated */
  readonly edges: readonly GhaEdge[];
  /** All expressions found in workflow */
  readonly expressions: readonly GhaExpression[];
  /** Terraform steps detected */
  readonly terraformSteps: readonly TerraformStepInfo[];
  /** Helm steps detected */
  readonly helmSteps: readonly HelmStepInfo[];
  /** Kubernetes steps detected */
  readonly kubernetesSteps: readonly KubernetesStepInfo[];
  /** AWS steps detected */
  readonly awsSteps: readonly AwsStepInfo[];
  /** GCP steps detected */
  readonly gcpSteps: readonly GcpStepInfo[];
  /** Azure steps detected */
  readonly azureSteps: readonly AzureStepInfo[];
  /** Docker steps detected */
  readonly dockerSteps: readonly DockerStepInfo[];
  /** All tool detections (union of all tool steps) */
  readonly allToolSteps: readonly GhaToolStepInfo[];
  /** Parse errors */
  readonly errors: readonly GhaParseError[];
  /** Parse warnings */
  readonly warnings: readonly GhaParseError[];
  /** Parse metadata */
  readonly metadata: GhaParseMetadata;
}

/**
 * Parse metadata for GitHub Actions workflow
 */
export interface GhaParseMetadata {
  /** File path that was parsed */
  readonly filePath: string;
  /** Parser name */
  readonly parserName: string;
  /** Parser version */
  readonly parserVersion: string;
  /** Parse time in milliseconds */
  readonly parseTimeMs: number;
  /** File size in bytes */
  readonly fileSize: number;
  /** Number of lines in file */
  readonly lineCount: number;
  /** Number of jobs in workflow */
  readonly jobCount: number;
  /** Total steps across all jobs */
  readonly stepCount: number;
  /** Number of expressions found */
  readonly expressionCount: number;
  /** Number of tool detections */
  readonly toolDetectionCount: number;
}

// ============================================================================
// Factory Options
// ============================================================================

/**
 * Options for creating GitHub Actions workflow/job/step nodes
 */
export interface GhaNodeFactoryOptions {
  /** Current scan ID for associating nodes */
  readonly scanId: string;
  /** Repository root path for resolving relative paths */
  readonly repositoryRoot: string;
  /** Custom ID generator function */
  readonly idGenerator?: () => string;
  /** Include raw YAML content in nodes */
  readonly includeRaw?: boolean;
  /** Compute tool detection info */
  readonly computeToolInfo?: boolean;
}

/**
 * Options for creating GitHub Actions edges
 */
export interface GhaEdgeFactoryOptions {
  /** Current scan ID for associating edges */
  readonly scanId: string;
  /** Custom ID generator function */
  readonly idGenerator?: () => string;
  /** Default confidence for inferred edges */
  readonly defaultConfidence?: number;
  /** Include source location in edge metadata */
  readonly includeLocation?: boolean;
}

// ============================================================================
// Parser Options
// ============================================================================

/**
 * GitHub Actions parser options
 */
export interface GhaParserOptions {
  /** Continue parsing after errors */
  readonly errorRecovery?: boolean;
  /** Maximum file size in bytes (default: 5MB) */
  readonly maxFileSize?: number;
  /** File encoding (default: utf-8) */
  readonly encoding?: BufferEncoding;
  /** Parse timeout in milliseconds (default: 30000) */
  readonly timeout?: number;
  /** Extract expressions from strings */
  readonly extractExpressions?: boolean;
  /** Parse expression references in detail */
  readonly parseExpressions?: boolean;
  /** Detect Terraform steps */
  readonly detectTerraform?: boolean;
  /** Detect Helm steps */
  readonly detectHelm?: boolean;
  /** Detect Kubernetes/kubectl steps */
  readonly detectKubernetes?: boolean;
  /** Detect cloud provider (AWS/GCP/Azure) steps */
  readonly detectCloudProviders?: boolean;
  /** Resolve action references to determine versions */
  readonly resolveActions?: boolean;
  /** Validate action references against known actions */
  readonly validateActionRefs?: boolean;
  /** Strict mode (fail on warnings) */
  readonly strict?: boolean;
  /** Enable strict YAML parsing */
  readonly strictYaml?: boolean;
  /** Include raw YAML content in parse result */
  readonly includeRaw?: boolean;
}

/**
 * Default GitHub Actions parser options (all fields required)
 */
export const DEFAULT_GHA_PARSER_OPTIONS: Required<GhaParserOptions> = {
  errorRecovery: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  encoding: 'utf-8',
  timeout: 30000, // 30 seconds
  extractExpressions: true,
  parseExpressions: true,
  detectTerraform: true,
  detectHelm: true,
  detectKubernetes: true,
  detectCloudProviders: true,
  resolveActions: false,
  validateActionRefs: true,
  strict: false,
  strictYaml: false,
  includeRaw: false,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for GhaRunStep
 * @param step - Step to check
 * @returns True if step is a run step
 * @example
 * if (isGhaRunStep(step)) {
 *   console.log(step.run);
 * }
 */
export function isGhaRunStep(step: GhaStep): step is GhaRunStep {
  return step.type === 'run';
}

/**
 * Type guard for GhaUsesStep
 * @param step - Step to check
 * @returns True if step is a uses step
 * @example
 * if (isGhaUsesStep(step)) {
 *   console.log(step.uses);
 * }
 */
export function isGhaUsesStep(step: GhaStep): step is GhaUsesStep {
  return step.type === 'uses';
}

/**
 * Type guard for GhaWorkflowNode
 * @param node - Node to check
 * @returns True if node is a workflow node
 */
export function isGhaWorkflowNode(node: BaseNode): node is GhaWorkflowNode {
  return (node as GhaWorkflowNode).type === 'gha_workflow';
}

/**
 * Type guard for GhaJobNode
 * @param node - Node to check
 * @returns True if node is a job node
 */
export function isGhaJobNode(node: BaseNode): node is GhaJobNode {
  return (node as GhaJobNode).type === 'gha_job';
}

/**
 * Type guard for GhaStepNode
 * @param node - Node to check
 * @returns True if node is a step node
 */
export function isGhaStepNode(node: BaseNode): node is GhaStepNode {
  return (node as GhaStepNode).type === 'gha_step';
}

/**
 * Type guard for any GitHub Actions node
 * @param node - Node to check
 * @returns True if node is a GHA node type
 */
export function isGhaNode(node: BaseNode): node is GhaWorkflowNode | GhaJobNode | GhaStepNode {
  const type = (node as GhaWorkflowNode | GhaJobNode | GhaStepNode).type;
  return type === 'gha_workflow' || type === 'gha_job' || type === 'gha_step';
}

/**
 * Type guard for push trigger
 * @param trigger - Trigger to check
 * @returns True if trigger is a push trigger
 */
export function isGhaPushTrigger(trigger: GhaTrigger): trigger is GhaPushTrigger {
  return trigger.type === 'push';
}

/**
 * Type guard for pull request trigger
 * @param trigger - Trigger to check
 * @returns True if trigger is a pull request trigger
 */
export function isGhaPullRequestTrigger(trigger: GhaTrigger): trigger is GhaPullRequestTrigger {
  return trigger.type === 'pull_request';
}

/**
 * Type guard for workflow dispatch trigger
 * @param trigger - Trigger to check
 * @returns True if trigger is a workflow dispatch trigger
 */
export function isGhaWorkflowDispatchTrigger(trigger: GhaTrigger): trigger is GhaWorkflowDispatchTrigger {
  return trigger.type === 'workflow_dispatch';
}

/**
 * Type guard for schedule trigger
 * @param trigger - Trigger to check
 * @returns True if trigger is a schedule trigger
 */
export function isGhaScheduleTrigger(trigger: GhaTrigger): trigger is GhaScheduleTrigger {
  return trigger.type === 'schedule';
}

/**
 * Type guard for workflow call trigger
 * @param trigger - Trigger to check
 * @returns True if trigger is a workflow call trigger
 */
export function isGhaWorkflowCallTrigger(trigger: GhaTrigger): trigger is GhaWorkflowCallTrigger {
  return trigger.type === 'workflow_call';
}

/**
 * Type guard for GhaEdge
 * @param edge - Edge to check
 * @returns True if edge is a GHA edge
 */
export function isGhaEdge(edge: GraphEdge): edge is GhaEdge {
  return edge.type.startsWith('gha_');
}

// ============================================================================
// Tool Detection Type Guards
// ============================================================================

/**
 * Type guard for TerraformStepInfo
 * @param info - Tool info to check
 * @returns True if info is a Terraform step
 */
export function isTerraformStepInfo(info: GhaToolStepInfo): info is TerraformStepInfo {
  return 'command' in info &&
    typeof info.command === 'string' &&
    ['init', 'validate', 'plan', 'apply', 'destroy', 'fmt', 'output', 'import', 'state', 'workspace', 'refresh', 'taint', 'untaint', 'force-unlock', 'unknown'].includes(info.command) &&
    ('usesCloud' in info || 'varFiles' in info);
}

/**
 * Type guard for HelmStepInfo
 * @param info - Tool info to check
 * @returns True if info is a Helm step
 */
export function isHelmStepInfo(info: GhaToolStepInfo): info is HelmStepInfo {
  return 'command' in info &&
    typeof info.command === 'string' &&
    ['install', 'upgrade', 'uninstall', 'rollback', 'template', 'lint', 'package', 'push', 'pull', 'repo', 'dependency', 'test', 'unknown'].includes(info.command) &&
    ('releaseName' in info || 'valuesFiles' in info || 'dryRun' in info);
}

/**
 * Type guard for KubernetesStepInfo
 * @param info - Tool info to check
 * @returns True if info is a Kubernetes step
 */
export function isKubernetesStepInfo(info: GhaToolStepInfo): info is KubernetesStepInfo {
  return 'command' in info &&
    typeof info.command === 'string' &&
    ['apply', 'delete', 'create', 'get', 'describe', 'logs', 'exec', 'rollout', 'scale', 'patch', 'label', 'annotate', 'port-forward', 'config', 'unknown'].includes(info.command) &&
    ('resourceType' in info || 'manifests' in info);
}

/**
 * Type guard for AwsStepInfo
 * @param info - Tool info to check
 * @returns True if info is an AWS step
 */
export function isAwsStepInfo(info: GhaToolStepInfo): info is AwsStepInfo {
  return 'service' in info &&
    !('project' in info) &&
    !('resourceGroup' in info) &&
    !('usesCloud' in info) &&
    !('valuesFiles' in info);
}

/**
 * Type guard for GcpStepInfo
 * @param info - Tool info to check
 * @returns True if info is a GCP step
 */
export function isGcpStepInfo(info: GhaToolStepInfo): info is GcpStepInfo {
  return 'project' in info;
}

/**
 * Type guard for AzureStepInfo
 * @param info - Tool info to check
 * @returns True if info is an Azure step
 */
export function isAzureStepInfo(info: GhaToolStepInfo): info is AzureStepInfo {
  return 'resourceGroup' in info;
}

/**
 * Type guard for DockerStepInfo
 * @param info - Tool info to check
 * @returns True if info is a Docker step
 */
export function isDockerStepInfo(info: GhaToolStepInfo): info is DockerStepInfo {
  return 'command' in info &&
    typeof info.command === 'string' &&
    ['build', 'push', 'pull', 'run', 'compose', 'login', 'logout', 'tag', 'buildx', 'manifest', 'unknown'].includes(info.command) &&
    ('dockerfile' in info || 'image' in info || 'registry' in info);
}

/**
 * Type guard for GhaExpression
 * @param value - Value to check
 * @returns True if value is a GhaExpression
 */
export function isGhaExpression(value: unknown): value is GhaExpression {
  return (
    typeof value === 'object' &&
    value !== null &&
    'raw' in value &&
    'content' in value &&
    'type' in value
  );
}

/**
 * Type guard for GhaContextReference
 * @param value - Value to check
 * @returns True if value is a GhaContextReference
 */
export function isGhaContextReference(value: unknown): value is GhaContextReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    'context' in value &&
    'path' in value &&
    'fullPath' in value &&
    'position' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a GhaWorkflowId from string
 * @param workflowName - Workflow name
 * @returns Branded workflow ID
 * @example
 * const id = createGhaWorkflowId('ci');
 */
export function createGhaWorkflowId(workflowName: string): GhaWorkflowId {
  return `gha-workflow-${workflowName}` as GhaWorkflowId;
}

/**
 * Create a GhaJobId from workflow and job name
 * @param workflowName - Workflow name
 * @param jobName - Job name
 * @returns Branded job ID
 * @example
 * const id = createGhaJobId('ci', 'build');
 */
export function createGhaJobId(workflowName: string, jobName: string): GhaJobId {
  return `gha-job-${workflowName}-${jobName}` as GhaJobId;
}

/**
 * Create a GhaStepId from workflow, job and step identifier
 * @param workflowName - Workflow name
 * @param jobName - Job name
 * @param stepId - Step ID or index
 * @returns Branded step ID
 * @example
 * const id = createGhaStepId('ci', 'build', 'checkout');
 */
export function createGhaStepId(workflowName: string, jobName: string, stepId: string): GhaStepId {
  return `gha-step-${workflowName}-${jobName}-${stepId}` as GhaStepId;
}

/**
 * Create an expression path from string
 * @param path - Expression path
 * @returns Branded expression path
 */
export function createGhaExpressionPath(path: string): GhaExpressionPath {
  return path as GhaExpressionPath;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract node type from GHA node union
 */
export type ExtractGhaNode<T extends 'gha_workflow' | 'gha_job' | 'gha_step'> =
  T extends 'gha_workflow' ? GhaWorkflowNode :
  T extends 'gha_job' ? GhaJobNode :
  T extends 'gha_step' ? GhaStepNode :
  never;

/**
 * All GHA node type names
 */
export type GhaNodeTypeName = 'gha_workflow' | 'gha_job' | 'gha_step';

/**
 * Result type for operations that can fail
 */
export type GhaResultType<T, E = GhaParseError> =
  | { readonly success: true; readonly value: T; readonly warnings: readonly E[] }
  | { readonly success: false; readonly error: E; readonly partialValue?: T };

/**
 * Type guard for successful result
 */
export function isGhaSuccess<T, E>(
  result: GhaResultType<T, E>
): result is { readonly success: true; readonly value: T; readonly warnings: readonly E[] } {
  return result.success === true;
}

/**
 * Type guard for failed result
 */
export function isGhaFailure<T, E>(
  result: GhaResultType<T, E>
): result is { readonly success: false; readonly error: E; readonly partialValue?: T } {
  return result.success === false;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Well-known Terraform GitHub Actions
 */
export const TERRAFORM_ACTIONS: readonly string[] = [
  'hashicorp/setup-terraform',
  'hashicorp/tfc-workflows-tooling/actions/upload-configuration',
  'hashicorp/tfc-workflows-tooling/actions/create-run',
  'dflook/terraform-plan',
  'dflook/terraform-apply',
  'dflook/terraform-fmt',
  'dflook/terraform-validate',
] as const;

/**
 * Well-known Helm GitHub Actions
 */
export const HELM_ACTIONS: readonly string[] = [
  'azure/setup-helm',
  'azure/k8s-bake',
  'deliverybot/helm',
  'WyriHaximus/github-action-helm3',
  'bitovi/github-actions-deploy-eks-helm',
] as const;

/**
 * Terraform command patterns for detection in run steps
 */
export const TERRAFORM_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bterraform\s+(init|plan|apply|destroy|validate|fmt|output|import|state|workspace|refresh)/i,
  /\bterragrunt\s+(init|plan|apply|destroy|validate|run-all)/i,
  /\btf\s+(init|plan|apply|destroy)/i,
] as const;

/**
 * Helm command patterns for detection in run steps
 */
export const HELM_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bhelm\s+(install|upgrade|uninstall|rollback|template|lint|package|push|pull|repo|dependency|test)/i,
  /\bhelmfile\s+(apply|sync|diff|template|lint)/i,
] as const;

/**
 * Well-known Kubernetes GitHub Actions
 */
export const KUBERNETES_ACTIONS: readonly string[] = [
  'azure/setup-kubectl',
  'azure/k8s-deploy',
  'azure/k8s-set-context',
  'azure/k8s-create-secret',
  'google-github-actions/get-gke-credentials',
  'aws-actions/amazon-eks-fargate',
] as const;

/**
 * Kubernetes command patterns for detection in run steps
 */
export const KUBERNETES_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bkubectl\s+(apply|delete|create|get|describe|logs|exec|rollout|scale|patch|label|annotate|port-forward|config)/i,
  /\bkustomize\s+(build|edit)/i,
] as const;

/**
 * Well-known AWS GitHub Actions
 */
export const AWS_ACTIONS: readonly string[] = [
  'aws-actions/configure-aws-credentials',
  'aws-actions/amazon-ecr-login',
  'aws-actions/amazon-ecs-deploy-task-definition',
  'aws-actions/amazon-ecs-render-task-definition',
  'aws-actions/aws-cloudformation-github-deploy',
  'aws-actions/setup-sam',
] as const;

/**
 * AWS command patterns for detection in run steps
 */
export const AWS_COMMAND_PATTERNS: readonly RegExp[] = [
  /\baws\s+(\w+)\s+(\w+)/i,
  /\bsam\s+(build|deploy|package|local)/i,
  /\bcdk\s+(deploy|synth|diff|bootstrap)/i,
] as const;

/**
 * Well-known GCP GitHub Actions
 */
export const GCP_ACTIONS: readonly string[] = [
  'google-github-actions/auth',
  'google-github-actions/setup-gcloud',
  'google-github-actions/deploy-cloudrun',
  'google-github-actions/deploy-appengine',
  'google-github-actions/get-secretmanager-secrets',
] as const;

/**
 * GCP command patterns for detection in run steps
 */
export const GCP_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bgcloud\s+(\w+)\s+(\w+)/i,
  /\bgsutil\s+(\w+)/i,
] as const;

/**
 * Well-known Azure GitHub Actions
 */
export const AZURE_ACTIONS: readonly string[] = [
  'azure/login',
  'azure/cli',
  'azure/webapps-deploy',
  'azure/functions-action',
  'azure/aks-set-context',
  'azure/arm-deploy',
] as const;

/**
 * Azure command patterns for detection in run steps
 */
export const AZURE_COMMAND_PATTERNS: readonly RegExp[] = [
  /\baz\s+(\w+)\s+(\w+)/i,
] as const;

/**
 * Well-known Docker GitHub Actions
 */
export const DOCKER_ACTIONS: readonly string[] = [
  'docker/build-push-action',
  'docker/login-action',
  'docker/setup-buildx-action',
  'docker/setup-qemu-action',
  'docker/metadata-action',
] as const;

/**
 * Docker command patterns for detection in run steps
 */
export const DOCKER_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bdocker\s+(build|push|pull|run|login|logout|tag|buildx)/i,
  /\bdocker-compose\s+(up|down|build|push|pull)/i,
  /\bdocker\s+compose\s+(up|down|build|push|pull)/i,
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty parse result for error cases
 * @param filePath - File path that was attempted to parse
 * @param error - Error that occurred
 * @returns Empty parse result with error
 */
export function createEmptyGhaParseResult(
  filePath: string,
  error?: GhaParseError
): GhaParseResult {
  return {
    success: false,
    nodes: [],
    edges: [],
    expressions: [],
    terraformSteps: [],
    helmSteps: [],
    kubernetesSteps: [],
    awsSteps: [],
    gcpSteps: [],
    azureSteps: [],
    dockerSteps: [],
    allToolSteps: [],
    errors: error ? [error] : [],
    warnings: [],
    metadata: {
      filePath,
      parserName: 'github-actions-parser',
      parserVersion: '1.0.0',
      parseTimeMs: 0,
      fileSize: 0,
      lineCount: 0,
      jobCount: 0,
      stepCount: 0,
      expressionCount: 0,
      toolDetectionCount: 0,
    },
  };
}

/**
 * Create parse metadata
 * @param filePath - File path
 * @param fileSize - File size in bytes
 * @param lineCount - Line count
 * @param parseTimeMs - Parse time in milliseconds
 * @param workflow - Parsed workflow (optional)
 * @returns Parse metadata
 */
export function createGhaParseMetadata(
  filePath: string,
  fileSize: number,
  lineCount: number,
  parseTimeMs: number,
  workflow?: GhaWorkflow
): GhaParseMetadata {
  const jobCount = workflow ? Array.from(workflow.jobs.values()).length : 0;
  const stepCount = workflow
    ? Array.from(workflow.jobs.values()).reduce((sum, job) => sum + job.steps.length, 0)
    : 0;

  return {
    filePath,
    parserName: 'github-actions-parser',
    parserVersion: '1.0.0',
    parseTimeMs,
    fileSize,
    lineCount,
    jobCount,
    stepCount,
    expressionCount: 0,
    toolDetectionCount: 0,
  };
}

/**
 * Get the tool type from a tool step info
 * @param info - Tool step info
 * @returns Tool type or undefined if unknown
 */
export function getToolType(info: GhaToolStepInfo): GhaToolType | undefined {
  if (isTerraformStepInfo(info)) return 'terraform';
  if (isHelmStepInfo(info)) return 'helm';
  if (isKubernetesStepInfo(info)) return 'kubernetes';
  if (isAwsStepInfo(info)) return 'aws';
  if (isGcpStepInfo(info)) return 'gcp';
  if (isAzureStepInfo(info)) return 'azure';
  if (isDockerStepInfo(info)) return 'docker';
  return undefined;
}
