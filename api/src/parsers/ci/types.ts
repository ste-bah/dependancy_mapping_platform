/**
 * GitLab CI Parser Types
 * @module parsers/ci/types
 *
 * Type definitions for GitLab CI/CD pipeline parsing and dependency detection.
 * Implements comprehensive typing for .gitlab-ci.yml configuration files.
 *
 * TASK-XREF-002: GitLab CI Parser - Core type definitions
 * TASK-GITLAB-001: Pipeline structure parsing
 * TASK-GITLAB-002: Job and stage extraction
 * TASK-GITLAB-003: Terraform/Helm step detection
 */

import { SourceLocation } from '../terraform/types';
import { BaseNode, EdgeMetadata, GraphEdge } from '../../types/graph';

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Brand utility type for creating nominal types from primitives
 */
type Brand<T, B> = T & { readonly __brand: B };

/**
 * Branded type for GitLab CI pipeline IDs
 * @example
 * const pipelineId = 'pipeline-main' as GitLabPipelineId;
 */
export type GitLabPipelineId = Brand<string, 'GitLabPipelineId'>;

/**
 * Branded type for GitLab CI stage IDs
 * @example
 * const stageId = 'stage-build' as GitLabStageId;
 */
export type GitLabStageId = Brand<string, 'GitLabStageId'>;

/**
 * Branded type for GitLab CI job IDs
 * @example
 * const jobId = 'job-test' as GitLabJobId;
 */
export type GitLabJobId = Brand<string, 'GitLabJobId'>;

/**
 * Branded type for GitLab CI include IDs
 * @example
 * const includeId = 'include-templates' as GitLabIncludeId;
 */
export type GitLabIncludeId = Brand<string, 'GitLabIncludeId'>;

/**
 * Branded type for GitLab CI variable paths
 * @example
 * const varPath = '$CI_COMMIT_REF_NAME' as GitLabVariablePath;
 */
export type GitLabVariablePath = Brand<string, 'GitLabVariablePath'>;

// ============================================================================
// Pipeline Structure Types
// ============================================================================

/**
 * Complete GitLab CI pipeline representation
 * Parsed from .gitlab-ci.yml files
 */
export interface GitLabCIPipeline {
  /** File path of the pipeline configuration */
  readonly filePath: string;
  /** Pipeline stages in execution order */
  readonly stages: readonly GitLabStage[];
  /** Jobs defined in the pipeline */
  readonly jobs: ReadonlyMap<string, GitLabJob>;
  /** Pipeline-level variables */
  readonly variables: Readonly<Record<string, GitLabVariable>>;
  /** Pipeline-level default settings */
  readonly default?: GitLabDefault;
  /** Workflow rules for pipeline creation */
  readonly workflow?: GitLabWorkflow;
  /** Include directives */
  readonly includes: readonly GitLabInclude[];
  /** Source location in file */
  readonly location: SourceLocation;
}

/**
 * GitLab CI stage definition
 */
export interface GitLabStage {
  /** Stage name */
  readonly name: string;
  /** Stage order index (0-based) */
  readonly order: number;
  /** Jobs in this stage */
  readonly jobNames: readonly string[];
  /** Source location */
  readonly location?: SourceLocation;
}

/**
 * GitLab CI default configuration
 */
export interface GitLabDefault {
  /** Default image */
  readonly image?: GitLabImage;
  /** Default services */
  readonly services?: readonly GitLabService[];
  /** Default before_script */
  readonly beforeScript?: readonly string[];
  /** Default after_script */
  readonly afterScript?: readonly string[];
  /** Default tags */
  readonly tags?: readonly string[];
  /** Default artifacts */
  readonly artifacts?: GitLabArtifacts;
  /** Default cache */
  readonly cache?: GitLabCache;
  /** Default retry configuration */
  readonly retry?: GitLabRetry;
  /** Default timeout */
  readonly timeout?: string;
  /** Default interruptible setting */
  readonly interruptible?: boolean;
}

/**
 * GitLab CI workflow configuration
 */
export interface GitLabWorkflow {
  /** Pipeline rules */
  readonly rules: readonly GitLabRule[];
  /** Pipeline name */
  readonly name?: string;
}

// ============================================================================
// Include Types
// ============================================================================

/**
 * GitLab CI include directive
 */
export type GitLabInclude =
  | GitLabLocalInclude
  | GitLabFileInclude
  | GitLabRemoteInclude
  | GitLabTemplateInclude
  | GitLabProjectInclude
  | GitLabComponentInclude;

/**
 * Base interface for includes
 */
export interface GitLabIncludeBase {
  /** Include type discriminator */
  readonly type: GitLabIncludeType;
  /** Resolved content (if resolved) */
  readonly resolved?: boolean;
  /** Source location */
  readonly location?: SourceLocation;
}

/**
 * Include type discriminator
 */
export type GitLabIncludeType =
  | 'local'
  | 'file'
  | 'remote'
  | 'template'
  | 'project'
  | 'component';

/**
 * Local file include
 */
export interface GitLabLocalInclude extends GitLabIncludeBase {
  readonly type: 'local';
  /** Local file path */
  readonly local: string;
}

/**
 * Multi-file include from same project
 */
export interface GitLabFileInclude extends GitLabIncludeBase {
  readonly type: 'file';
  /** File paths */
  readonly file: readonly string[];
}

/**
 * Remote URL include
 */
export interface GitLabRemoteInclude extends GitLabIncludeBase {
  readonly type: 'remote';
  /** Remote URL */
  readonly remote: string;
}

/**
 * GitLab template include
 */
export interface GitLabTemplateInclude extends GitLabIncludeBase {
  readonly type: 'template';
  /** Template name */
  readonly template: string;
}

/**
 * Project include
 */
export interface GitLabProjectInclude extends GitLabIncludeBase {
  readonly type: 'project';
  /** Project path */
  readonly project: string;
  /** File path(s) in project */
  readonly file: string | readonly string[];
  /** Git ref */
  readonly ref?: string;
}

/**
 * Component include (CI/CD Catalog)
 */
export interface GitLabComponentInclude extends GitLabIncludeBase {
  readonly type: 'component';
  /** Component path (e.g., gitlab.com/namespace/project/component@version) */
  readonly component: string;
  /** Component inputs */
  readonly inputs?: Readonly<Record<string, unknown>>;
}

// ============================================================================
// Job Structure Types
// ============================================================================

/**
 * GitLab CI job definition
 */
export interface GitLabJob {
  /** Job ID (key in jobs map) */
  readonly id: string;
  /** Job name (display name or same as id) */
  readonly name: string;
  /** Stage this job belongs to */
  readonly stage: string;
  /** Script commands to execute */
  readonly script: readonly string[];
  /** Commands to run before script */
  readonly beforeScript?: readonly string[];
  /** Commands to run after script */
  readonly afterScript?: readonly string[];
  /** Docker image to use */
  readonly image?: GitLabImage;
  /** Service containers */
  readonly services?: readonly GitLabService[];
  /** Job variables */
  readonly variables?: Readonly<Record<string, string | GitLabVariable>>;
  /** Job rules */
  readonly rules?: readonly GitLabRule[];
  /** Legacy only/except (deprecated) */
  readonly only?: GitLabOnlyExcept;
  readonly except?: GitLabOnlyExcept;
  /** Job dependencies (needs:) */
  readonly needs?: readonly (string | GitLabNeed)[];
  /** Legacy dependencies (dependencies:) */
  readonly dependencies?: readonly string[];
  /** Artifacts configuration */
  readonly artifacts?: GitLabArtifacts;
  /** Cache configuration */
  readonly cache?: GitLabCache | readonly GitLabCache[];
  /** Runner tags */
  readonly tags?: readonly string[];
  /** Allow failure */
  readonly allowFailure?: boolean | GitLabAllowFailure;
  /** Retry configuration */
  readonly retry?: number | GitLabRetry;
  /** Timeout */
  readonly timeout?: string;
  /** When to run the job */
  readonly when?: GitLabWhen;
  /** Start in (for delayed jobs) */
  readonly startIn?: string;
  /** Environment deployment */
  readonly environment?: string | GitLabEnvironment;
  /** Release configuration */
  readonly release?: GitLabRelease;
  /** Coverage regex */
  readonly coverage?: string;
  /** Interruptible setting */
  readonly interruptible?: boolean;
  /** Resource group */
  readonly resourceGroup?: string;
  /** Trigger downstream pipeline */
  readonly trigger?: GitLabTrigger;
  /** Parallel execution configuration */
  readonly parallel?: number | GitLabParallel;
  /** Extends other job templates */
  readonly extends?: string | readonly string[];
  /** Secrets configuration */
  readonly secrets?: Readonly<Record<string, GitLabSecret>>;
  /** ID tokens for OIDC */
  readonly idTokens?: Readonly<Record<string, GitLabIdToken>>;
  /** Inherit configuration */
  readonly inherit?: GitLabInherit;
  /** Whether job is hidden (starts with .) */
  readonly hidden: boolean;
  /** Detected Terraform info (populated by parser) */
  readonly terraformInfo?: GitLabTerraformDetectionInfo;
  /** Detected Helm info (populated by parser) */
  readonly helmInfo?: GitLabHelmDetectionInfo;
  /** Detected Kubernetes info (populated by parser) */
  readonly kubernetesInfo?: GitLabKubernetesDetectionInfo;
  /** Detected Docker info (populated by parser) */
  readonly dockerInfo?: GitLabDockerDetectionInfo;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * GitLab CI secret configuration
 */
export interface GitLabSecret {
  /** Vault secret */
  readonly vault?: GitLabVaultSecret;
  /** Azure Key Vault secret */
  readonly azure_key_vault?: GitLabAzureKeyVaultSecret;
  /** File output */
  readonly file?: boolean;
  /** Token (for OIDC) */
  readonly token?: string;
}

/**
 * GitLab Vault secret configuration
 */
export interface GitLabVaultSecret {
  /** Vault engine */
  readonly engine: GitLabVaultEngine;
  /** Secret path */
  readonly path: string;
  /** Field in secret */
  readonly field: string;
}

/**
 * GitLab Vault engine configuration
 */
export interface GitLabVaultEngine {
  /** Engine name */
  readonly name: string;
  /** Engine path */
  readonly path: string;
}

/**
 * GitLab Azure Key Vault secret configuration
 */
export interface GitLabAzureKeyVaultSecret {
  /** Secret name in Key Vault */
  readonly name: string;
  /** Secret version */
  readonly version?: string;
}

/**
 * GitLab CI ID token configuration for OIDC
 */
export interface GitLabIdToken {
  /** Token audience */
  readonly aud: string | readonly string[];
}

/**
 * GitLab CI inherit configuration
 */
export interface GitLabInherit {
  /** Default settings to inherit */
  readonly default?: boolean | readonly GitLabDefaultKey[];
  /** Variables to inherit */
  readonly variables?: boolean | readonly string[];
}

/**
 * Default configuration keys that can be inherited
 */
export type GitLabDefaultKey =
  | 'after_script'
  | 'artifacts'
  | 'before_script'
  | 'cache'
  | 'image'
  | 'interruptible'
  | 'retry'
  | 'services'
  | 'tags'
  | 'timeout';

/**
 * Detected Terraform information in a job
 */
export interface GitLabTerraformDetectionInfo {
  /** Detected commands */
  readonly commands: readonly TerraformCommand[];
  /** Working directory */
  readonly workingDirectory?: string;
  /** Var files */
  readonly varFiles: readonly string[];
  /** Uses Terraform Cloud */
  readonly usesCloud: boolean;
  /** Confidence score (0-100) */
  readonly confidence: number;
}

/**
 * Detected Helm information in a job
 */
export interface GitLabHelmDetectionInfo {
  /** Detected commands */
  readonly commands: readonly HelmCommand[];
  /** Release name */
  readonly releaseName?: string;
  /** Chart path */
  readonly chartPath?: string;
  /** Namespace */
  readonly namespace?: string;
  /** Values files */
  readonly valuesFiles: readonly string[];
  /** Confidence score (0-100) */
  readonly confidence: number;
}

/**
 * Detected Kubernetes information in a job
 */
export interface GitLabKubernetesDetectionInfo {
  /** Detected commands */
  readonly commands: readonly KubernetesCommand[];
  /** Namespace */
  readonly namespace?: string;
  /** Manifests */
  readonly manifests: readonly string[];
  /** Confidence score (0-100) */
  readonly confidence: number;
}

/**
 * Detected Docker information in a job
 */
export interface GitLabDockerDetectionInfo {
  /** Detected commands */
  readonly commands: readonly DockerCommand[];
  /** Image reference */
  readonly image?: string;
  /** Dockerfile */
  readonly dockerfile?: string;
  /** Registry */
  readonly registry?: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
}

/**
 * GitLab CI image configuration
 */
export interface GitLabImage {
  /** Image name */
  readonly name: string;
  /** Entrypoint override */
  readonly entrypoint?: readonly string[];
  /** Pull policy */
  readonly pullPolicy?: GitLabPullPolicy;
}

/**
 * Image pull policy
 */
export type GitLabPullPolicy = 'always' | 'if-not-present' | 'never';

/**
 * GitLab CI service configuration
 */
export interface GitLabService {
  /** Service name/image */
  readonly name: string;
  /** Service alias */
  readonly alias?: string;
  /** Entrypoint override */
  readonly entrypoint?: readonly string[];
  /** Command override */
  readonly command?: readonly string[];
  /** Service variables */
  readonly variables?: Readonly<Record<string, string>>;
  /** Pull policy */
  readonly pullPolicy?: GitLabPullPolicy;
}

/**
 * GitLab CI variable
 */
export interface GitLabVariable {
  /** Variable value */
  readonly value: string;
  /** Variable description */
  readonly description?: string;
  /** Variable options for dropdown */
  readonly options?: readonly string[];
  /** Whether variable is expandable */
  readonly expand?: boolean;
}

/**
 * GitLab CI rule
 */
export interface GitLabRule {
  /** Condition expression */
  readonly if?: string;
  /** Change patterns */
  readonly changes?: readonly string[] | GitLabRuleChanges;
  /** File existence check */
  readonly exists?: readonly string[];
  /** When to run */
  readonly when?: GitLabWhen;
  /** Allow failure on rule match */
  readonly allowFailure?: boolean;
  /** Variables to set on match */
  readonly variables?: Readonly<Record<string, string>>;
  /** Needs override on match */
  readonly needs?: readonly GitLabNeed[];
  /** Start in status */
  readonly startIn?: string;
}

/**
 * GitLab CI rule changes configuration
 */
export interface GitLabRuleChanges {
  /** File path patterns */
  readonly paths: readonly string[];
  /** Compare to ref */
  readonly compareTo?: string;
}

/**
 * GitLab CI only/except configuration (deprecated)
 */
export interface GitLabOnlyExcept {
  /** Refs to match */
  readonly refs?: readonly string[];
  /** Variables to match */
  readonly variables?: readonly string[];
  /** Changes to match */
  readonly changes?: readonly string[];
  /** Kubernetes state */
  readonly kubernetes?: 'active';
}

/**
 * GitLab CI needs configuration
 */
export interface GitLabNeed {
  /** Job name */
  readonly job: string;
  /** Project path (for cross-project) */
  readonly project?: string;
  /** Git ref (for cross-project) */
  readonly ref?: string;
  /** Whether artifacts are needed */
  readonly artifacts?: boolean;
  /** Whether this need is optional */
  readonly optional?: boolean;
  /** Pipeline type */
  readonly pipeline?: string;
}

/**
 * GitLab CI artifacts configuration
 */
export interface GitLabArtifacts {
  /** File paths to include */
  readonly paths?: readonly string[];
  /** Files to exclude */
  readonly exclude?: readonly string[];
  /** Expire time */
  readonly expireIn?: string;
  /** Whether to expose artifacts as links */
  readonly expose_as?: string;
  /** Artifact name */
  readonly name?: string;
  /** When to upload artifacts */
  readonly when?: 'on_success' | 'on_failure' | 'always';
  /** Untracked files inclusion */
  readonly untracked?: boolean;
  /** Reports configuration */
  readonly reports?: GitLabArtifactReports;
}

/**
 * GitLab CI artifact reports
 */
export interface GitLabArtifactReports {
  /** JUnit report */
  readonly junit?: string | readonly string[];
  /** Cobertura report */
  readonly coverage_report?: GitLabCoverageReport;
  /** DAST report */
  readonly dast?: string | readonly string[];
  /** Dependency scanning report */
  readonly dependency_scanning?: string | readonly string[];
  /** Container scanning report */
  readonly container_scanning?: string | readonly string[];
  /** SAST report */
  readonly sast?: string | readonly string[];
  /** Secret detection report */
  readonly secret_detection?: string | readonly string[];
  /** License scanning report */
  readonly license_scanning?: string | readonly string[];
  /** Terraform report */
  readonly terraform?: string | readonly string[];
  /** Dotenv report */
  readonly dotenv?: string | readonly string[];
  /** Metrics report */
  readonly metrics?: string | readonly string[];
  /** Performance report */
  readonly performance?: string | readonly string[];
}

/**
 * GitLab CI coverage report configuration
 */
export interface GitLabCoverageReport {
  /** Coverage format */
  readonly coverage_format: 'cobertura' | 'jacoco';
  /** Report path */
  readonly path: string;
}

/**
 * GitLab CI cache configuration
 */
export interface GitLabCache {
  /** Cache key */
  readonly key?: string | GitLabCacheKey;
  /** Paths to cache */
  readonly paths?: readonly string[];
  /** Untracked files */
  readonly untracked?: boolean;
  /** Cache policy */
  readonly policy?: 'pull-push' | 'pull' | 'push';
  /** When to cache */
  readonly when?: 'on_success' | 'on_failure' | 'always';
  /** Fallback keys */
  readonly fallback_keys?: readonly string[];
}

/**
 * GitLab CI cache key configuration
 */
export interface GitLabCacheKey {
  /** Key files */
  readonly files?: readonly string[];
  /** Key prefix */
  readonly prefix?: string;
}

/**
 * GitLab CI retry configuration
 */
export interface GitLabRetry {
  /** Maximum retry count */
  readonly max?: number;
  /** Failure types to retry on */
  readonly when?: readonly GitLabRetryWhen[];
}

/**
 * GitLab CI retry conditions
 */
export type GitLabRetryWhen =
  | 'always'
  | 'unknown_failure'
  | 'script_failure'
  | 'api_failure'
  | 'stuck_or_timeout_failure'
  | 'runner_system_failure'
  | 'runner_unsupported'
  | 'stale_schedule'
  | 'job_execution_timeout'
  | 'archived_failure'
  | 'unmet_prerequisites'
  | 'scheduler_failure'
  | 'data_integrity_failure';

/**
 * GitLab CI when condition
 */
export type GitLabWhen =
  | 'on_success'
  | 'on_failure'
  | 'always'
  | 'manual'
  | 'delayed'
  | 'never';

/**
 * GitLab CI allow failure configuration
 */
export interface GitLabAllowFailure {
  /** Exit codes that are allowed */
  readonly exit_codes: number | readonly number[];
}

/**
 * GitLab CI environment configuration
 */
export interface GitLabEnvironment {
  /** Environment name */
  readonly name: string;
  /** Environment URL */
  readonly url?: string;
  /** Environment action */
  readonly action?: 'start' | 'prepare' | 'stop' | 'verify' | 'access';
  /** On-stop job */
  readonly on_stop?: string;
  /** Auto-stop time */
  readonly auto_stop_in?: string;
  /** Deployment tier */
  readonly deployment_tier?: 'production' | 'staging' | 'testing' | 'development' | 'other';
  /** Kubernetes deployment */
  readonly kubernetes?: GitLabKubernetesEnvironment;
}

/**
 * GitLab CI Kubernetes environment configuration
 */
export interface GitLabKubernetesEnvironment {
  /** Kubernetes namespace */
  readonly namespace?: string;
}

/**
 * GitLab CI release configuration
 */
export interface GitLabRelease {
  /** Release tag */
  readonly tag_name: string;
  /** Release name */
  readonly name?: string;
  /** Release description */
  readonly description?: string;
  /** Ref to release from */
  readonly ref?: string;
  /** Milestones */
  readonly milestones?: readonly string[];
  /** Release time */
  readonly released_at?: string;
  /** Release assets */
  readonly assets?: GitLabReleaseAssets;
}

/**
 * GitLab CI release assets
 */
export interface GitLabReleaseAssets {
  /** Asset links */
  readonly links?: readonly GitLabAssetLink[];
}

/**
 * GitLab CI asset link
 */
export interface GitLabAssetLink {
  /** Link name */
  readonly name: string;
  /** Link URL */
  readonly url: string;
  /** Link type */
  readonly link_type?: 'runbook' | 'image' | 'package' | 'other';
  /** File path */
  readonly filepath?: string;
}

/**
 * GitLab CI trigger configuration
 */
export interface GitLabTrigger {
  /** Project to trigger */
  readonly project?: string;
  /** Branch to trigger */
  readonly branch?: string;
  /** Include configuration */
  readonly include?: string | readonly GitLabTriggerInclude[];
  /** Strategy */
  readonly strategy?: 'depend';
  /** Forward variables */
  readonly forward?: GitLabTriggerForward;
}

/**
 * GitLab CI trigger include
 */
export interface GitLabTriggerInclude {
  /** Local file */
  readonly local?: string;
  /** Artifact from job */
  readonly artifact?: string;
  /** Job generating artifact */
  readonly job?: string;
}

/**
 * GitLab CI trigger forward configuration
 */
export interface GitLabTriggerForward {
  /** Forward YAML variables */
  readonly yaml_variables?: boolean;
  /** Forward pipeline variables */
  readonly pipeline_variables?: boolean;
}

/**
 * GitLab CI parallel configuration
 */
export interface GitLabParallel {
  /** Number of parallel jobs or matrix */
  readonly matrix?: readonly Readonly<Record<string, readonly string[]>>[];
}

// ============================================================================
// Node Types for Graph Building
// ============================================================================

/**
 * GitLab CI pipeline node for dependency graph
 */
export interface GitLabPipelineNode extends BaseNode {
  /** Node type discriminator */
  readonly type: 'gitlab_pipeline';
  /** Number of stages */
  readonly stageCount: number;
  /** Number of jobs */
  readonly jobCount: number;
  /** Whether pipeline has includes */
  readonly hasIncludes: boolean;
  /** Include count */
  readonly includeCount: number;
  /** Whether pipeline has workflow rules */
  readonly hasWorkflow: boolean;
}

/**
 * GitLab CI stage node for dependency graph
 */
export interface GitLabStageNode extends BaseNode {
  /** Node type discriminator */
  readonly type: 'gitlab_stage';
  /** Parent pipeline ID */
  readonly pipelineId: string;
  /** Stage order */
  readonly order: number;
  /** Number of jobs in stage */
  readonly jobCount: number;
}

/**
 * GitLab CI job node for dependency graph
 */
export interface GitLabJobNode extends BaseNode {
  /** Node type discriminator */
  readonly type: 'gitlab_job';
  /** Parent pipeline ID */
  readonly pipelineId: string;
  /** Stage name */
  readonly stage: string;
  /** Whether job is hidden */
  readonly hidden: boolean;
  /** Whether job has rules */
  readonly hasRules: boolean;
  /** Whether job has needs */
  readonly hasNeeds: boolean;
  /** Number of needs */
  readonly needsCount: number;
  /** Whether job has artifacts */
  readonly hasArtifacts: boolean;
  /** Whether job has cache */
  readonly hasCache: boolean;
  /** Whether job contains Terraform commands */
  readonly hasTerraform: boolean;
  /** Whether job contains Helm commands */
  readonly hasHelm: boolean;
  /** Whether job contains Kubernetes commands */
  readonly hasKubernetes: boolean;
  /** Whether job contains Docker commands */
  readonly hasDocker: boolean;
  /** When job runs */
  readonly when: GitLabWhen;
  /** Allow failure */
  readonly allowFailure: boolean;
  /** Environment name if deploying */
  readonly environment?: string;
  /** Whether job is a trigger */
  readonly isTrigger: boolean;
  /** Whether job uses matrix */
  readonly hasParallel: boolean;
  /** Image used by job */
  readonly image?: string;
  /** Tags for runner selection */
  readonly tags: readonly string[];
}

// ============================================================================
// Edge Types for Graph Building
// ============================================================================

/**
 * GitLab CI specific edge types
 */
export type GitLabEdgeType =
  | 'gitlab_stage_order'       // Stage ordering
  | 'gitlab_needs'             // Job dependency (needs:)
  | 'gitlab_dependencies'      // Legacy dependencies
  | 'gitlab_extends'           // Job extends another
  | 'gitlab_trigger'           // Trigger downstream pipeline
  | 'gitlab_includes'          // Include configuration
  | 'gitlab_uses_tf'           // Job uses Terraform
  | 'gitlab_uses_helm'         // Job uses Helm
  | 'gitlab_artifact_flow';    // Artifact passing

/**
 * GitLab CI edge for dependency graph
 */
export interface GitLabEdge extends GraphEdge {
  /** Edge type */
  readonly type: GitLabEdgeType;
  /** Edge metadata */
  readonly metadata: EdgeMetadata & GitLabEdgeMetadata;
}

/**
 * GitLab CI specific edge metadata
 */
export interface GitLabEdgeMetadata {
  /** Artifact paths (for artifact_flow) */
  readonly artifactPaths?: readonly string[];
  /** Include path (for includes) */
  readonly includePath?: string;
  /** Terraform command (for uses_tf) */
  readonly terraformCommand?: string;
  /** Helm command (for uses_helm) */
  readonly helmCommand?: string;
  /** Extended job names (for extends) */
  readonly extendsFrom?: readonly string[];
}

// ============================================================================
// Tool Detection Types
// ============================================================================

/**
 * Information about a Terraform command detected in job
 */
export interface GitLabTerraformStepInfo {
  /** Job name */
  readonly jobName: string;
  /** Stage name */
  readonly stage: string;
  /** Terraform command being run */
  readonly command: TerraformCommand;
  /** Working directory */
  readonly workingDirectory?: string;
  /** Whether using Terraform Cloud */
  readonly usesCloud: boolean;
  /** Detected var files */
  readonly varFiles: readonly string[];
  /** Variables passed via -var flag */
  readonly variables?: Readonly<Record<string, string>>;
  /** Environment variables */
  readonly envVars: Readonly<Record<string, string>>;
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Terraform commands
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
 * Information about a Helm command detected in job
 */
export interface GitLabHelmStepInfo {
  /** Job name */
  readonly jobName: string;
  /** Stage name */
  readonly stage: string;
  /** Helm command being run */
  readonly command: HelmCommand;
  /** Release name */
  readonly releaseName?: string;
  /** Chart path */
  readonly chartPath?: string;
  /** Namespace */
  readonly namespace?: string;
  /** Values files */
  readonly valuesFiles: readonly string[];
  /** Set values */
  readonly setValues: Readonly<Record<string, string>>;
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
 * Helm commands
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
// Parse Result Types
// ============================================================================

/**
 * GitLab CI parse error
 */
export interface GitLabCIParseError {
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
  readonly code: GitLabCIParseErrorCode;
}

/**
 * GitLab CI parse error codes
 */
export type GitLabCIParseErrorCode =
  | 'INVALID_YAML'
  | 'INVALID_PIPELINE'
  | 'INVALID_JOB'
  | 'INVALID_STAGE'
  | 'INVALID_INCLUDE'
  | 'INVALID_RULE'
  | 'INVALID_VARIABLE'
  | 'CIRCULAR_DEPENDENCY'
  | 'CIRCULAR_EXTENDS'
  | 'MISSING_REQUIRED_FIELD'
  | 'UNKNOWN_STAGE'
  | 'INCLUDE_RESOLUTION_FAILED'
  | 'FILE_READ_ERROR'
  | 'FILE_TOO_LARGE'
  | 'PARSE_TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * Complete parse result for GitLab CI configuration
 */
export interface GitLabCIParseResult {
  /** Whether parsing succeeded */
  readonly success: boolean;
  /** Parsed pipeline (present if success or partial parse) */
  readonly pipeline?: GitLabCIPipeline;
  /** Graph nodes generated */
  readonly nodes: readonly (GitLabPipelineNode | GitLabStageNode | GitLabJobNode)[];
  /** Graph edges generated */
  readonly edges: readonly GitLabEdge[];
  /** Terraform steps detected */
  readonly terraformSteps: readonly GitLabTerraformStepInfo[];
  /** Helm steps detected */
  readonly helmSteps: readonly GitLabHelmStepInfo[];
  /** Kubernetes steps detected */
  readonly kubernetesSteps: readonly GitLabKubernetesStepInfo[];
  /** Docker steps detected */
  readonly dockerSteps: readonly GitLabDockerStepInfo[];
  /** All tool steps (unified view) */
  readonly allToolSteps: readonly GitLabToolStepInfo[];
  /** All tool operations (cross-parser format) */
  readonly toolOperations: readonly GitLabToolOperation[];
  /** Parse errors */
  readonly errors: readonly GitLabCIParseError[];
  /** Parse warnings */
  readonly warnings: readonly GitLabCIParseError[];
  /** Parse metadata */
  readonly metadata: GitLabCIParseMetadata;
}

/**
 * Parse metadata for GitLab CI configuration
 */
export interface GitLabCIParseMetadata {
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
  /** Number of stages */
  readonly stageCount: number;
  /** Number of jobs */
  readonly jobCount: number;
  /** Number of includes */
  readonly includeCount: number;
  /** Number of tool detections */
  readonly toolDetectionCount: number;
}

// ============================================================================
// Parser Options
// ============================================================================

/**
 * GitLab CI parser options
 */
export interface GitLabCIParserOptions {
  /** Continue parsing after errors */
  readonly errorRecovery?: boolean;
  /** Maximum file size in bytes (default: 5MB) */
  readonly maxFileSize?: number;
  /** File encoding (default: utf-8) */
  readonly encoding?: BufferEncoding;
  /** Parse timeout in milliseconds (default: 30000) */
  readonly timeout?: number;
  /** Resolve include directives */
  readonly resolveIncludes?: boolean;
  /** Maximum depth for include resolution */
  readonly maxIncludeDepth?: number;
  /** Detect Terraform commands in scripts */
  readonly detectTerraform?: boolean;
  /** Detect Helm commands in scripts */
  readonly detectHelm?: boolean;
  /** Resolve extends inheritance */
  readonly resolveExtends?: boolean;
  /** Strict mode (fail on warnings) */
  readonly strict?: boolean;
  /** Enable strict YAML parsing */
  readonly strictYaml?: boolean;
  /** Include raw YAML content in parse result */
  readonly includeRaw?: boolean;
}

/**
 * Default GitLab CI parser options
 */
export const DEFAULT_GITLAB_CI_PARSER_OPTIONS: Required<GitLabCIParserOptions> = {
  errorRecovery: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  encoding: 'utf-8',
  timeout: 30000, // 30 seconds
  resolveIncludes: false,
  maxIncludeDepth: 10,
  detectTerraform: true,
  detectHelm: true,
  resolveExtends: true,
  strict: false,
  strictYaml: false,
  includeRaw: false,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for GitLabLocalInclude
 */
export function isGitLabLocalInclude(include: GitLabInclude): include is GitLabLocalInclude {
  return include.type === 'local';
}

/**
 * Type guard for GitLabFileInclude
 */
export function isGitLabFileInclude(include: GitLabInclude): include is GitLabFileInclude {
  return include.type === 'file';
}

/**
 * Type guard for GitLabRemoteInclude
 */
export function isGitLabRemoteInclude(include: GitLabInclude): include is GitLabRemoteInclude {
  return include.type === 'remote';
}

/**
 * Type guard for GitLabTemplateInclude
 */
export function isGitLabTemplateInclude(include: GitLabInclude): include is GitLabTemplateInclude {
  return include.type === 'template';
}

/**
 * Type guard for GitLabProjectInclude
 */
export function isGitLabProjectInclude(include: GitLabInclude): include is GitLabProjectInclude {
  return include.type === 'project';
}

/**
 * Type guard for GitLabComponentInclude
 */
export function isGitLabComponentInclude(include: GitLabInclude): include is GitLabComponentInclude {
  return include.type === 'component';
}

/**
 * Type guard for GitLabPipelineNode
 */
export function isGitLabPipelineNode(node: BaseNode): node is GitLabPipelineNode {
  return (node as GitLabPipelineNode).type === 'gitlab_pipeline';
}

/**
 * Type guard for GitLabStageNode
 */
export function isGitLabStageNode(node: BaseNode): node is GitLabStageNode {
  return (node as GitLabStageNode).type === 'gitlab_stage';
}

/**
 * Type guard for GitLabJobNode
 */
export function isGitLabJobNode(node: BaseNode): node is GitLabJobNode {
  return (node as GitLabJobNode).type === 'gitlab_job';
}

/**
 * Type guard for any GitLab CI node
 */
export function isGitLabNode(node: BaseNode): node is GitLabPipelineNode | GitLabStageNode | GitLabJobNode {
  const type = (node as GitLabPipelineNode | GitLabStageNode | GitLabJobNode).type;
  return type === 'gitlab_pipeline' || type === 'gitlab_stage' || type === 'gitlab_job';
}

/**
 * Type guard for GitLabEdge
 */
export function isGitLabEdge(edge: GraphEdge): edge is GitLabEdge {
  return edge.type.startsWith('gitlab_');
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a GitLabPipelineId from string
 */
export function createGitLabPipelineId(filePath: string): GitLabPipelineId {
  return `gitlab-pipeline-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}` as GitLabPipelineId;
}

/**
 * Create a GitLabStageId from pipeline and stage name
 */
export function createGitLabStageId(pipelineId: string, stageName: string): GitLabStageId {
  return `gitlab-stage-${pipelineId}-${stageName}` as GitLabStageId;
}

/**
 * Create a GitLabJobId from pipeline and job name
 */
export function createGitLabJobId(pipelineId: string, jobName: string): GitLabJobId {
  return `gitlab-job-${pipelineId}-${jobName}` as GitLabJobId;
}

/**
 * Create an empty parse result for error cases
 * @param filePath - File path that was attempted to parse
 * @param error - Error that occurred
 * @returns Empty parse result with error
 */
export function createEmptyGitLabCIParseResult(
  filePath: string,
  error?: GitLabCIParseError
): GitLabCIParseResult {
  return {
    success: false,
    nodes: [],
    edges: [],
    terraformSteps: [],
    helmSteps: [],
    kubernetesSteps: [],
    dockerSteps: [],
    allToolSteps: [],
    toolOperations: [],
    errors: error ? [error] : [],
    warnings: [],
    metadata: {
      filePath,
      parserName: 'gitlab-ci-parser',
      parserVersion: '1.0.0',
      parseTimeMs: 0,
      fileSize: 0,
      lineCount: 0,
      stageCount: 0,
      jobCount: 0,
      includeCount: 0,
      toolDetectionCount: 0,
    },
  };
}

/**
 * Create parse metadata
 */
export function createGitLabCIParseMetadata(
  filePath: string,
  fileSize: number,
  lineCount: number,
  parseTimeMs: number,
  pipeline?: GitLabCIPipeline
): GitLabCIParseMetadata {
  const stageCount = pipeline ? pipeline.stages.length : 0;
  const jobCount = pipeline ? pipeline.jobs.size : 0;
  const includeCount = pipeline ? pipeline.includes.length : 0;

  return {
    filePath,
    parserName: 'gitlab-ci-parser',
    parserVersion: '1.0.0',
    parseTimeMs,
    fileSize,
    lineCount,
    stageCount,
    jobCount,
    includeCount,
    toolDetectionCount: 0,
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Reserved GitLab CI keywords that are not job names
 */
export const GITLAB_RESERVED_KEYWORDS: readonly string[] = [
  'image',
  'services',
  'stages',
  'types',
  'before_script',
  'after_script',
  'variables',
  'cache',
  'include',
  'default',
  'workflow',
  'pages',
] as const;

/**
 * Default stages if not specified
 */
export const GITLAB_DEFAULT_STAGES: readonly string[] = [
  'build',
  'test',
  'deploy',
] as const;

/**
 * Terraform command patterns for detection
 */
export const GITLAB_TERRAFORM_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bterraform\s+(init|plan|apply|destroy|validate|fmt|output|import|state|workspace|refresh)/i,
  /\bterragrunt\s+(init|plan|apply|destroy|validate|run-all)/i,
  /\btf\s+(init|plan|apply|destroy)/i,
  /\bgitlab-terraform\s+(init|plan|apply|destroy|validate)/i,
] as const;

/**
 * Helm command patterns for detection
 */
export const GITLAB_HELM_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bhelm\s+(install|upgrade|uninstall|rollback|template|lint|package|push|pull|repo|dependency|test)/i,
  /\bhelmfile\s+(apply|sync|diff|template|lint)/i,
] as const;

/**
 * Kubernetes command patterns for detection
 */
export const GITLAB_KUBERNETES_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bkubectl\s+(apply|delete|create|get|describe|logs|exec|rollout|scale|patch|label|annotate|port-forward|config)/i,
  /\bkustomize\s+(build|edit)/i,
] as const;

/**
 * Docker command patterns for detection
 */
export const GITLAB_DOCKER_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bdocker\s+(build|push|pull|run|login|logout|tag|buildx)/i,
  /\bdocker-compose\s+(up|down|build|push|pull)/i,
  /\bdocker\s+compose\s+(up|down|build|push|pull)/i,
  /\bkaniko\b/i,
  /\bbuildah\s+(bud|push|pull|from)/i,
] as const;

/**
 * Well-known Terraform images
 */
export const GITLAB_TERRAFORM_IMAGES: readonly string[] = [
  'hashicorp/terraform',
  'registry.gitlab.com/gitlab-org/terraform-images/stable',
  'registry.gitlab.com/gitlab-org/terraform-images/releases',
  'registry.gitlab.com/gitlab-org/terraform-images/light',
] as const;

/**
 * Well-known Helm images
 */
export const GITLAB_HELM_IMAGES: readonly string[] = [
  'alpine/helm',
  'dtzar/helm-kubectl',
  'lachlanevenson/k8s-helm',
  'alpine/k8s',
] as const;

/**
 * Well-known GitLab CI templates for Terraform
 */
export const GITLAB_TERRAFORM_TEMPLATES: readonly string[] = [
  'Terraform.gitlab-ci.yml',
  'Terraform/Base.gitlab-ci.yml',
  'Terraform.latest.gitlab-ci.yml',
  'Jobs/Terraform.gitlab-ci.yml',
] as const;

/**
 * Well-known GitLab CI templates for Helm
 */
export const GITLAB_HELM_TEMPLATES: readonly string[] = [
  'Helm.gitlab-ci.yml',
  'Auto-DevOps.gitlab-ci.yml',
] as const;

/**
 * Predefined CI/CD variables from GitLab
 */
export const GITLAB_PREDEFINED_VARIABLES: readonly string[] = [
  'CI',
  'CI_COMMIT_REF_NAME',
  'CI_COMMIT_REF_SLUG',
  'CI_COMMIT_SHA',
  'CI_COMMIT_SHORT_SHA',
  'CI_COMMIT_BRANCH',
  'CI_COMMIT_TAG',
  'CI_COMMIT_MESSAGE',
  'CI_COMMIT_TITLE',
  'CI_JOB_ID',
  'CI_JOB_NAME',
  'CI_JOB_STAGE',
  'CI_JOB_TOKEN',
  'CI_PIPELINE_ID',
  'CI_PIPELINE_IID',
  'CI_PIPELINE_SOURCE',
  'CI_PROJECT_ID',
  'CI_PROJECT_NAME',
  'CI_PROJECT_PATH',
  'CI_PROJECT_PATH_SLUG',
  'CI_PROJECT_URL',
  'CI_REGISTRY',
  'CI_REGISTRY_IMAGE',
  'CI_REGISTRY_USER',
  'CI_REGISTRY_PASSWORD',
  'CI_ENVIRONMENT_NAME',
  'CI_ENVIRONMENT_SLUG',
  'CI_ENVIRONMENT_URL',
  'CI_DEFAULT_BRANCH',
  'CI_MERGE_REQUEST_ID',
  'CI_MERGE_REQUEST_IID',
  'CI_MERGE_REQUEST_SOURCE_BRANCH_NAME',
  'CI_MERGE_REQUEST_TARGET_BRANCH_NAME',
  'GITLAB_CI',
] as const;

// ============================================================================
// Additional Tool Detection Types
// ============================================================================

/**
 * Information about a Kubernetes command detected in job
 */
export interface GitLabKubernetesStepInfo {
  /** Job name */
  readonly jobName: string;
  /** Stage name */
  readonly stage: string;
  /** Kubernetes command being run */
  readonly command: KubernetesCommand;
  /** Resource type */
  readonly resourceType?: string;
  /** Resource name */
  readonly resourceName?: string;
  /** Namespace */
  readonly namespace?: string;
  /** Manifest files */
  readonly manifests?: readonly string[];
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Kubernetes commands
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
 * Information about a Docker command detected in job
 */
export interface GitLabDockerStepInfo {
  /** Job name */
  readonly jobName: string;
  /** Stage name */
  readonly stage: string;
  /** Docker command being run */
  readonly command: DockerCommand;
  /** Image reference */
  readonly image?: string;
  /** Dockerfile path */
  readonly dockerfile?: string;
  /** Build context */
  readonly context?: string;
  /** Registry URL */
  readonly registry?: string;
  /** Build arguments */
  readonly buildArgs?: Readonly<Record<string, string>>;
  /** Tags */
  readonly tags?: readonly string[];
  /** Detection confidence score (0-100) */
  readonly confidence: number;
  /** Source location */
  readonly location: SourceLocation;
}

/**
 * Docker commands
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
export type GitLabToolStepInfo =
  | GitLabTerraformStepInfo
  | GitLabHelmStepInfo
  | GitLabKubernetesStepInfo
  | GitLabDockerStepInfo;

/**
 * Tool type discriminator
 */
export type GitLabToolType =
  | 'terraform'
  | 'helm'
  | 'kubernetes'
  | 'docker'
  | 'aws'
  | 'gcp'
  | 'azure';

/**
 * Unified tool operation format for cross-parser compatibility
 */
export interface GitLabToolOperation {
  /** Tool type */
  readonly tool: GitLabToolType;
  /** Operation/command name */
  readonly operation: string;
  /** Job name where detected */
  readonly jobName: string;
  /** Stage name */
  readonly stage: string;
  /** Source file */
  readonly sourceFile: string;
  /** Tool-specific details */
  readonly details: GitLabToolStepInfo;
  /** Detection confidence (0-100) */
  readonly confidence: number;
}

// ============================================================================
// Additional Type Guards
// ============================================================================

/**
 * Type guard for GitLabTerraformStepInfo
 * @param info - Tool info to check
 * @returns True if info is Terraform step info
 */
export function isGitLabTerraformStepInfo(info: GitLabToolStepInfo): info is GitLabTerraformStepInfo {
  return 'usesCloud' in info && 'varFiles' in info;
}

/**
 * Type guard for GitLabHelmStepInfo
 * @param info - Tool info to check
 * @returns True if info is Helm step info
 */
export function isGitLabHelmStepInfo(info: GitLabToolStepInfo): info is GitLabHelmStepInfo {
  return 'valuesFiles' in info && 'dryRun' in info && 'atomic' in info;
}

/**
 * Type guard for GitLabKubernetesStepInfo
 * @param info - Tool info to check
 * @returns True if info is Kubernetes step info
 */
export function isGitLabKubernetesStepInfo(info: GitLabToolStepInfo): info is GitLabKubernetesStepInfo {
  return 'resourceType' in info || ('manifests' in info && !('image' in info));
}

/**
 * Type guard for GitLabDockerStepInfo
 * @param info - Tool info to check
 * @returns True if info is Docker step info
 */
export function isGitLabDockerStepInfo(info: GitLabToolStepInfo): info is GitLabDockerStepInfo {
  return 'dockerfile' in info || 'buildArgs' in info || ('image' in info && !('valuesFiles' in info));
}

/**
 * Type guard for GitLabNeed object vs string
 * @param need - Need value to check
 * @returns True if need is a GitLabNeed object
 */
export function isGitLabNeedObject(need: string | GitLabNeed): need is GitLabNeed {
  return typeof need === 'object' && need !== null && 'job' in need;
}

/**
 * Type guard for GitLabVariable object vs string value
 * @param value - Variable value to check
 * @returns True if value is a GitLabVariable object
 */
export function isGitLabVariableObject(value: string | GitLabVariable): value is GitLabVariable {
  return typeof value === 'object' && value !== null && 'value' in value;
}

/**
 * Type guard for GitLabAllowFailure object vs boolean
 * @param value - Allow failure value to check
 * @returns True if value is a GitLabAllowFailure object
 */
export function isGitLabAllowFailureObject(value: boolean | GitLabAllowFailure): value is GitLabAllowFailure {
  return typeof value === 'object' && value !== null && 'exit_codes' in value;
}

/**
 * Type guard for stage order edge
 * @param edge - Edge to check
 * @returns True if edge is a stage order edge
 */
export function isGitLabStageOrderEdge(edge: GraphEdge): edge is GitLabEdge {
  return edge.type === 'gitlab_stage_order';
}

/**
 * Type guard for needs edge
 * @param edge - Edge to check
 * @returns True if edge is a needs edge
 */
export function isGitLabNeedsEdge(edge: GraphEdge): edge is GitLabEdge {
  return edge.type === 'gitlab_needs';
}

/**
 * Type guard for extends edge
 * @param edge - Edge to check
 * @returns True if edge is an extends edge
 */
export function isGitLabExtendsEdge(edge: GraphEdge): edge is GitLabEdge {
  return edge.type === 'gitlab_extends';
}

/**
 * Type guard for trigger edge
 * @param edge - Edge to check
 * @returns True if edge is a trigger edge
 */
export function isGitLabTriggerEdge(edge: GraphEdge): edge is GitLabEdge {
  return edge.type === 'gitlab_trigger';
}

/**
 * Type guard for includes edge
 * @param edge - Edge to check
 * @returns True if edge is an includes edge
 */
export function isGitLabIncludesEdge(edge: GraphEdge): edge is GitLabEdge {
  return edge.type === 'gitlab_includes';
}

/**
 * Type guard for job that has Terraform commands
 * @param job - Job to check
 * @returns True if job uses Terraform
 */
export function jobHasTerraform(job: GitLabJob): boolean {
  const script = [...(job.beforeScript || []), ...job.script, ...(job.afterScript || [])].join('\n');
  return GITLAB_TERRAFORM_COMMAND_PATTERNS.some(pattern => pattern.test(script));
}

/**
 * Type guard for job that has Helm commands
 * @param job - Job to check
 * @returns True if job uses Helm
 */
export function jobHasHelm(job: GitLabJob): boolean {
  const script = [...(job.beforeScript || []), ...job.script, ...(job.afterScript || [])].join('\n');
  return GITLAB_HELM_COMMAND_PATTERNS.some(pattern => pattern.test(script));
}

/**
 * Type guard for job that has Kubernetes commands
 * @param job - Job to check
 * @returns True if job uses Kubernetes
 */
export function jobHasKubernetes(job: GitLabJob): boolean {
  const script = [...(job.beforeScript || []), ...job.script, ...(job.afterScript || [])].join('\n');
  return GITLAB_KUBERNETES_COMMAND_PATTERNS.some(pattern => pattern.test(script));
}

/**
 * Type guard for job that has Docker commands
 * @param job - Job to check
 * @returns True if job uses Docker
 */
export function jobHasDocker(job: GitLabJob): boolean {
  const script = [...(job.beforeScript || []), ...job.script, ...(job.afterScript || [])].join('\n');
  return GITLAB_DOCKER_COMMAND_PATTERNS.some(pattern => pattern.test(script));
}

// ============================================================================
// Factory Options
// ============================================================================

/**
 * Options for creating GitLab CI pipeline/stage/job nodes
 */
export interface GitLabNodeFactoryOptions {
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
 * Options for creating GitLab CI edges
 */
export interface GitLabEdgeFactoryOptions {
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
// Utility Types
// ============================================================================

/**
 * Extract node type from GitLab CI node union
 */
export type ExtractGitLabNode<T extends 'gitlab_pipeline' | 'gitlab_stage' | 'gitlab_job'> =
  T extends 'gitlab_pipeline' ? GitLabPipelineNode :
  T extends 'gitlab_stage' ? GitLabStageNode :
  T extends 'gitlab_job' ? GitLabJobNode :
  never;

/**
 * All GitLab CI node type names
 */
export type GitLabNodeTypeName = 'gitlab_pipeline' | 'gitlab_stage' | 'gitlab_job';

/**
 * Result type for operations that can fail
 */
export type GitLabResultType<T, E = GitLabCIParseError> =
  | { readonly success: true; readonly value: T; readonly warnings: readonly E[] }
  | { readonly success: false; readonly error: E; readonly partialValue?: T };

/**
 * Type guard for successful result
 */
export function isGitLabSuccess<T, E>(
  result: GitLabResultType<T, E>
): result is { readonly success: true; readonly value: T; readonly warnings: readonly E[] } {
  return result.success === true;
}

/**
 * Type guard for failed result
 */
export function isGitLabFailure<T, E>(
  result: GitLabResultType<T, E>
): result is { readonly success: false; readonly error: E; readonly partialValue?: T } {
  return result.success === false;
}

// ============================================================================
// Additional Factory Functions
// ============================================================================

/**
 * Create a GitLabIncludeId from include reference
 * @param includeRef - Include reference (path, URL, or project)
 * @returns Branded include ID
 */
export function createGitLabIncludeId(includeRef: string): GitLabIncludeId {
  const safeRef = includeRef.replace(/[^a-zA-Z0-9-_]/g, '-');
  return `gitlab-include-${safeRef}` as GitLabIncludeId;
}

/**
 * Create a GitLabVariablePath from string
 * @param path - Variable path
 * @returns Branded variable path
 */
export function createGitLabVariablePath(path: string): GitLabVariablePath {
  return path as GitLabVariablePath;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a job name is a reserved keyword
 * @param name - Job name to check
 * @returns True if name is reserved
 */
export function isReservedKeyword(name: string): boolean {
  return GITLAB_RESERVED_KEYWORDS.includes(name);
}

/**
 * Check if a job is hidden (template job)
 * @param jobName - Job name to check
 * @returns True if job is hidden (starts with .)
 */
export function isHiddenJob(jobName: string): boolean {
  return jobName.startsWith('.');
}

/**
 * Normalize stage name for comparison
 * @param stage - Stage name
 * @returns Normalized stage name
 */
export function normalizeStage(stage: string): string {
  return stage.toLowerCase().trim();
}

/**
 * Get default stage index for ordering
 * @param stage - Stage name
 * @returns Stage index (0-based) or -1 if not a default stage
 */
export function getDefaultStageIndex(stage: string): number {
  return GITLAB_DEFAULT_STAGES.indexOf(stage);
}

/**
 * Detect Terraform command from script line
 * @param line - Script line to check
 * @returns Detected Terraform command or null
 */
export function detectTerraformCommand(line: string): TerraformCommand | null {
  for (const pattern of GITLAB_TERRAFORM_COMMAND_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase() as TerraformCommand;
    }
  }
  return null;
}

/**
 * Detect Helm command from script line
 * @param line - Script line to check
 * @returns Detected Helm command or null
 */
export function detectHelmCommand(line: string): HelmCommand | null {
  for (const pattern of GITLAB_HELM_COMMAND_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase() as HelmCommand;
    }
  }
  return null;
}

/**
 * Detect Kubernetes command from script line
 * @param line - Script line to check
 * @returns Detected Kubernetes command or null
 */
export function detectKubernetesCommand(line: string): KubernetesCommand | null {
  for (const pattern of GITLAB_KUBERNETES_COMMAND_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase() as KubernetesCommand;
    }
  }
  return null;
}

/**
 * Detect Docker command from script line
 * @param line - Script line to check
 * @returns Detected Docker command or null
 */
export function detectDockerCommand(line: string): DockerCommand | null {
  for (const pattern of GITLAB_DOCKER_COMMAND_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      // Handle kaniko/buildah special cases
      if (line.includes('kaniko')) return 'build';
      if (line.includes('buildah')) {
        if (match[1]) return match[1].toLowerCase() === 'bud' ? 'build' : match[1].toLowerCase() as DockerCommand;
        return 'build';
      }
      if (match[1]) return match[1].toLowerCase() as DockerCommand;
    }
  }
  return null;
}

/**
 * Get the tool type from a tool step info
 * @param info - Tool step info
 * @returns Tool type or undefined if unknown
 */
export function getToolType(info: GitLabToolStepInfo): GitLabToolType | undefined {
  if (isGitLabTerraformStepInfo(info)) return 'terraform';
  if (isGitLabHelmStepInfo(info)) return 'helm';
  if (isGitLabKubernetesStepInfo(info)) return 'kubernetes';
  if (isGitLabDockerStepInfo(info)) return 'docker';
  return undefined;
}

/**
 * Check if an image is a Terraform image
 * @param imageName - Image name to check
 * @returns True if image is a known Terraform image
 */
export function isTerraformImage(imageName: string): boolean {
  return GITLAB_TERRAFORM_IMAGES.some(img => imageName.includes(img));
}

/**
 * Check if an image is a Helm image
 * @param imageName - Image name to check
 * @returns True if image is a known Helm image
 */
export function isHelmImage(imageName: string): boolean {
  return GITLAB_HELM_IMAGES.some(img => imageName.includes(img));
}

/**
 * Check if a template is a Terraform template
 * @param templateName - Template name to check
 * @returns True if template is a known Terraform template
 */
export function isTerraformTemplate(templateName: string): boolean {
  return GITLAB_TERRAFORM_TEMPLATES.some(tpl => templateName === tpl || templateName.endsWith(tpl));
}

/**
 * Check if a template is a Helm template
 * @param templateName - Template name to check
 * @returns True if template is a known Helm template
 */
export function isHelmTemplate(templateName: string): boolean {
  return GITLAB_HELM_TEMPLATES.some(tpl => templateName === tpl || templateName.endsWith(tpl));
}

/**
 * Check if a variable is a predefined GitLab CI variable
 * @param varName - Variable name to check
 * @returns True if variable is predefined
 */
export function isPredefinedVariable(varName: string): boolean {
  return GITLAB_PREDEFINED_VARIABLES.includes(varName);
}
