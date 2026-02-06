/**
 * ArgoCD Application Parser Types
 * @module parsers/argocd/types
 *
 * Type definitions for ArgoCD Application and ApplicationSet parsing.
 * Implements TASK-XREF-005: ArgoCD GitOps deployment pattern detection.
 *
 * TASK-XREF-005: Parse ArgoCD Application manifests to detect GitOps deployment patterns.
 */

import { NodeLocation } from '../../types/graph';

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Brand utility type for creating nominal types from primitives
 */
type Brand<T, B> = T & { readonly __brand: B };

/**
 * Branded type for ArgoCD Application IDs
 * @example
 * const appId = 'argocd-app-my-app' as ArgoCDApplicationId;
 */
export type ArgoCDApplicationId = Brand<string, 'ArgoCDApplicationId'>;

/**
 * Branded type for ArgoCD ApplicationSet IDs
 * @example
 * const appSetId = 'argocd-appset-cluster-apps' as ArgoCDApplicationSetId;
 */
export type ArgoCDApplicationSetId = Brand<string, 'ArgoCDApplicationSetId'>;

// ============================================================================
// Core ArgoCD Application Types
// ============================================================================

/**
 * Represents an ArgoCD Application resource
 * Parsed from manifests with apiVersion: argoproj.io/v1alpha1, kind: Application
 */
export interface ArgoCDApplication {
  /** Application name from metadata.name */
  readonly name: string;
  /** Namespace where the Application resource is deployed (usually argocd) */
  readonly namespace: string;
  /** ArgoCD project name */
  readonly project: string;
  /** Source configuration (Git repo, Helm, etc.) */
  readonly source: ApplicationSource;
  /** Multiple source configurations (for multi-source Applications) */
  readonly sources?: readonly ApplicationSource[];
  /** Destination cluster and namespace */
  readonly destination: ApplicationDestination;
  /** Sync policy configuration */
  readonly syncPolicy?: SyncPolicy;
  /** File path where this Application was defined */
  readonly filePath: string;
  /** Labels from metadata */
  readonly labels?: Readonly<Record<string, string>>;
  /** Annotations from metadata */
  readonly annotations?: Readonly<Record<string, string>>;
  /** Health check configuration */
  readonly ignoreDifferences?: readonly ResourceIgnoreDifferences[];
  /** Finalizers */
  readonly finalizers?: readonly string[];
}

/**
 * Resource ignore differences configuration
 */
export interface ResourceIgnoreDifferences {
  readonly group?: string;
  readonly kind: string;
  readonly name?: string;
  readonly namespace?: string;
  readonly jsonPointers?: readonly string[];
  readonly jqPathExpressions?: readonly string[];
  readonly managedFieldsManagers?: readonly string[];
}

/**
 * Application source configuration
 */
export interface ApplicationSource {
  /** Git repository URL */
  readonly repoURL: string;
  /** Target revision (branch, tag, commit) */
  readonly targetRevision: string;
  /** Path within the repository */
  readonly path: string;
  /** Detected source type */
  readonly sourceType: ApplicationSourceType;
  /** Helm-specific configuration */
  readonly helm?: HelmSource;
  /** Kustomize-specific configuration */
  readonly kustomize?: KustomizeSource;
  /** Directory-specific configuration */
  readonly directory?: DirectorySource;
  /** Plugin-specific configuration */
  readonly plugin?: PluginSource;
  /** Chart name (for Helm repository sources) */
  readonly chart?: string;
  /** Reference to another source (for multi-source) */
  readonly ref?: string;
}

/**
 * Application source types
 */
export type ApplicationSourceType = 'helm' | 'kustomize' | 'directory' | 'plugin';

/**
 * Helm source configuration
 */
export interface HelmSource {
  /** Value files to use */
  readonly valueFiles: readonly string[];
  /** Helm parameters (--set) */
  readonly parameters: readonly HelmParameter[];
  /** Release name override */
  readonly releaseName?: string;
  /** Inline values YAML */
  readonly values?: string;
  /** File parameters (--set-file) */
  readonly fileParameters?: readonly HelmFileParameter[];
  /** Skip CRDs installation */
  readonly skipCrds?: boolean;
  /** Pass credentials to all domains */
  readonly passCredentials?: boolean;
  /** Helm version to use */
  readonly version?: string;
  /** Values from external sources */
  readonly valuesObject?: Readonly<Record<string, unknown>>;
}

/**
 * Helm parameter (--set equivalent)
 */
export interface HelmParameter {
  /** Parameter name */
  readonly name: string;
  /** Parameter value */
  readonly value: string;
  /** Force value to be treated as string */
  readonly forceString?: boolean;
}

/**
 * Helm file parameter (--set-file equivalent)
 */
export interface HelmFileParameter {
  /** Parameter name */
  readonly name: string;
  /** File path */
  readonly path: string;
}

/**
 * Kustomize source configuration
 */
export interface KustomizeSource {
  /** Name prefix for resources */
  readonly namePrefix?: string;
  /** Name suffix for resources */
  readonly nameSuffix?: string;
  /** Image overrides */
  readonly images?: readonly string[];
  /** Common labels to add */
  readonly commonLabels?: Readonly<Record<string, string>>;
  /** Common annotations to add */
  readonly commonAnnotations?: Readonly<Record<string, string>>;
  /** Force common labels */
  readonly forceCommonLabels?: boolean;
  /** Force common annotations */
  readonly forceCommonAnnotations?: boolean;
  /** Kustomize version */
  readonly version?: string;
  /** Namespace to set */
  readonly namespace?: string;
  /** Replicas overrides */
  readonly replicas?: readonly KustomizeReplica[];
}

/**
 * Kustomize replica configuration
 */
export interface KustomizeReplica {
  readonly name: string;
  readonly count: number;
}

/**
 * Directory source configuration
 */
export interface DirectorySource {
  /** Recurse into subdirectories */
  readonly recurse?: boolean;
  /** JSON/YAML detection settings */
  readonly jsonnet?: DirectoryJsonnet;
  /** Exclude patterns */
  readonly exclude?: string;
  /** Include patterns */
  readonly include?: string;
}

/**
 * Jsonnet configuration for directory source
 */
export interface DirectoryJsonnet {
  /** External variables */
  readonly extVars?: readonly JsonnetVar[];
  /** Top-level arguments */
  readonly tlas?: readonly JsonnetVar[];
  /** Library paths */
  readonly libs?: readonly string[];
}

/**
 * Jsonnet variable
 */
export interface JsonnetVar {
  readonly name: string;
  readonly value: string;
  readonly code?: boolean;
}

/**
 * Plugin source configuration
 */
export interface PluginSource {
  /** Plugin name */
  readonly name?: string;
  /** Plugin environment variables */
  readonly env?: readonly PluginEnvEntry[];
  /** Plugin parameters */
  readonly parameters?: readonly ApplicationSourcePluginParameter[];
}

/**
 * Plugin environment entry
 */
export interface PluginEnvEntry {
  readonly name: string;
  readonly value: string;
}

/**
 * Plugin parameter
 */
export interface ApplicationSourcePluginParameter {
  readonly name: string;
  readonly string?: string;
  readonly array?: readonly string[];
  readonly map?: Readonly<Record<string, string>>;
}

/**
 * Application destination configuration
 */
export interface ApplicationDestination {
  /** Target cluster API server URL */
  readonly server: string;
  /** Target namespace */
  readonly namespace: string;
  /** Target cluster name (alternative to server) */
  readonly name?: string;
}

/**
 * Sync policy configuration
 */
export interface SyncPolicy {
  /** Automated sync configuration */
  readonly automated?: AutomatedSyncPolicy;
  /** Sync options */
  readonly syncOptions?: readonly string[];
  /** Retry policy */
  readonly retry?: RetryPolicy;
  /** Managed namespace metadata */
  readonly managedNamespaceMetadata?: ManagedNamespaceMetadata;
}

/**
 * Automated sync policy configuration
 */
export interface AutomatedSyncPolicy {
  /** Prune resources that are no longer in Git */
  readonly prune: boolean;
  /** Self-heal drifted resources */
  readonly selfHeal: boolean;
  /** Allow empty (delete all resources) */
  readonly allowEmpty?: boolean;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum retry attempts */
  readonly limit: number;
  /** Backoff configuration */
  readonly backoff?: RetryBackoff;
}

/**
 * Retry backoff configuration
 */
export interface RetryBackoff {
  /** Initial duration (e.g., "5s") */
  readonly duration?: string;
  /** Factor to multiply duration */
  readonly factor?: number;
  /** Maximum duration (e.g., "5m") */
  readonly maxDuration?: string;
}

/**
 * Managed namespace metadata
 */
export interface ManagedNamespaceMetadata {
  readonly labels?: Readonly<Record<string, string>>;
  readonly annotations?: Readonly<Record<string, string>>;
}

// ============================================================================
// ApplicationSet Types
// ============================================================================

/**
 * Represents an ArgoCD ApplicationSet resource
 * Parsed from manifests with apiVersion: argoproj.io/v1alpha1, kind: ApplicationSet
 */
export interface ArgoCDApplicationSet {
  /** ApplicationSet name from metadata.name */
  readonly name: string;
  /** Namespace where the ApplicationSet is deployed */
  readonly namespace: string;
  /** Generators that produce Application parameters */
  readonly generators: readonly ApplicationSetGenerator[];
  /** Application template */
  readonly template: ApplicationTemplate;
  /** File path where this ApplicationSet was defined */
  readonly filePath: string;
  /** Sync policy for the ApplicationSet */
  readonly syncPolicy?: ApplicationSetSyncPolicy;
  /** Go template option */
  readonly goTemplate?: boolean;
  /** Go template options */
  readonly goTemplateOptions?: readonly string[];
  /** Strategy for applying changes */
  readonly strategy?: ApplicationSetStrategy;
  /** Preserve resources on delete */
  readonly preservedFields?: PreservedFields;
}

/**
 * ApplicationSet generator configuration
 */
export interface ApplicationSetGenerator {
  /** Generator type */
  readonly type: ApplicationSetGeneratorType;
  /** Generator-specific configuration */
  readonly config: Readonly<Record<string, unknown>>;
  /** Selector for filtering */
  readonly selector?: GeneratorSelector;
}

/**
 * Generator types
 */
export type ApplicationSetGeneratorType =
  | 'list'
  | 'clusters'
  | 'git'
  | 'scmProvider'
  | 'clusterDecisionResource'
  | 'pullRequest'
  | 'matrix'
  | 'merge';

/**
 * Generator selector
 */
export interface GeneratorSelector {
  readonly matchLabels?: Readonly<Record<string, string>>;
  readonly matchExpressions?: readonly LabelSelectorRequirement[];
}

/**
 * Label selector requirement
 */
export interface LabelSelectorRequirement {
  readonly key: string;
  readonly operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
  readonly values?: readonly string[];
}

/**
 * Application template for ApplicationSet
 */
export interface ApplicationTemplate {
  /** Template metadata */
  readonly metadata: ApplicationTemplateMetadata;
  /** Template spec */
  readonly spec: ApplicationTemplateSpec;
}

/**
 * Application template metadata
 */
export interface ApplicationTemplateMetadata {
  readonly name?: string;
  readonly namespace?: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly annotations?: Readonly<Record<string, string>>;
  readonly finalizers?: readonly string[];
}

/**
 * Application template spec
 */
export interface ApplicationTemplateSpec {
  readonly project: string;
  readonly source?: ApplicationSource;
  readonly sources?: readonly ApplicationSource[];
  readonly destination: ApplicationDestination;
  readonly syncPolicy?: SyncPolicy;
  readonly ignoreDifferences?: readonly ResourceIgnoreDifferences[];
}

/**
 * ApplicationSet sync policy
 */
export interface ApplicationSetSyncPolicy {
  readonly preserveResourcesOnDeletion?: boolean;
  readonly applicationsSync?: 'create-only' | 'create-update' | 'create-delete' | 'sync';
}

/**
 * ApplicationSet strategy
 */
export interface ApplicationSetStrategy {
  readonly type: 'AllAtOnce' | 'RollingSync';
  readonly rollingSync?: RollingSyncStrategy;
}

/**
 * Rolling sync strategy
 */
export interface RollingSyncStrategy {
  readonly steps?: readonly RollingSyncStep[];
}

/**
 * Rolling sync step
 */
export interface RollingSyncStep {
  readonly matchExpressions?: readonly LabelSelectorRequirement[];
  readonly maxUpdate?: string | number;
}

/**
 * Preserved fields configuration
 */
export interface PreservedFields {
  readonly annotations?: readonly string[];
  readonly labels?: readonly string[];
}

// ============================================================================
// Graph Node Types
// ============================================================================

/**
 * ArgoCD Application node for dependency graph
 */
export interface ArgoCDApplicationNode {
  /** Unique node identifier */
  readonly id: string;
  /** Node type discriminator */
  readonly type: 'argocd_application';
  /** Application name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** Line start in source file */
  readonly lineStart?: number;
  /** Line end in source file */
  readonly lineEnd?: number;
  /** Application metadata */
  readonly metadata: ArgoCDApplicationNodeMetadata;
  /** Source location */
  readonly location: NodeLocation;
}

/**
 * ArgoCD Application node metadata
 */
export interface ArgoCDApplicationNodeMetadata {
  /** Application name */
  readonly appName: string;
  /** ArgoCD project */
  readonly project: string;
  /** Source repository URL */
  readonly sourceRepo: string;
  /** Source path within repo */
  readonly sourcePath: string;
  /** Source type (helm, kustomize, directory) */
  readonly sourceType: ApplicationSourceType;
  /** Target cluster */
  readonly targetCluster: string;
  /** Target namespace */
  readonly targetNamespace: string;
  /** Whether auto-sync is enabled */
  readonly autoSync: boolean;
  /** Value files (for Helm sources) */
  readonly valueFiles?: readonly string[];
  /** Number of Helm parameters */
  readonly parameterCount?: number;
  /** Whether this is a multi-source application */
  readonly isMultiSource?: boolean;
  /** Chart name (for Helm repo sources) */
  readonly chartName?: string;
}

/**
 * ArgoCD ApplicationSet node for dependency graph
 */
export interface ArgoCDApplicationSetNode {
  /** Unique node identifier */
  readonly id: string;
  /** Node type discriminator */
  readonly type: 'argocd_applicationset';
  /** ApplicationSet name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** Line start in source file */
  readonly lineStart?: number;
  /** Line end in source file */
  readonly lineEnd?: number;
  /** ApplicationSet metadata */
  readonly metadata: ArgoCDApplicationSetNodeMetadata;
  /** Source location */
  readonly location: NodeLocation;
}

/**
 * ArgoCD ApplicationSet node metadata
 */
export interface ArgoCDApplicationSetNodeMetadata {
  /** ApplicationSet name */
  readonly appSetName: string;
  /** Generator types used */
  readonly generatorTypes: readonly ApplicationSetGeneratorType[];
  /** Number of generators */
  readonly generatorCount: number;
  /** Template source type */
  readonly templateSourceType: ApplicationSourceType;
  /** Template target namespace */
  readonly templateTargetNamespace: string;
  /** Whether Go template is enabled */
  readonly goTemplateEnabled: boolean;
}

// ============================================================================
// Graph Edge Types
// ============================================================================

/**
 * Edge representing ArgoCD deploying to a target
 */
export interface ArgoCDDeploysEdge {
  /** Unique edge identifier */
  readonly id: string;
  /** Edge type discriminator */
  readonly type: 'ARGOCD_DEPLOYS';
  /** Source node ID (ArgoCD Application) */
  readonly sourceNodeId: string;
  /** Target node ID (Helm chart, Kustomize, etc.) */
  readonly targetNodeId: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
  /** Edge metadata */
  readonly metadata: ArgoCDDeploysEdgeMetadata;
}

/**
 * ArgoCD deploys edge metadata
 */
export interface ArgoCDDeploysEdgeMetadata {
  /** Application name */
  readonly appName: string;
  /** Chart/manifest path */
  readonly chartPath: string;
  /** Source type */
  readonly sourceType: string;
  /** Repository URL */
  readonly repoURL?: string;
  /** Target revision */
  readonly targetRevision?: string;
}

/**
 * Edge representing ApplicationSet generating Applications
 */
export interface ArgoCDGeneratesEdge {
  /** Unique edge identifier */
  readonly id: string;
  /** Edge type discriminator */
  readonly type: 'ARGOCD_GENERATES';
  /** Source node ID (ApplicationSet) */
  readonly sourceNodeId: string;
  /** Target node ID (Generated Application pattern) */
  readonly targetNodeId: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
  /** Edge metadata */
  readonly metadata: ArgoCDGeneratesEdgeMetadata;
}

/**
 * ArgoCD generates edge metadata
 */
export interface ArgoCDGeneratesEdgeMetadata {
  /** ApplicationSet name */
  readonly appSetName: string;
  /** Generator type */
  readonly generatorType: ApplicationSetGeneratorType;
}

// ============================================================================
// Parse Result Types
// ============================================================================

/**
 * ArgoCD parse error
 */
export interface ArgoCDParseError {
  /** Error message */
  readonly message: string;
  /** Source file path */
  readonly file: string;
  /** Line number */
  readonly line?: number;
  /** Column number */
  readonly column?: number;
  /** Error severity */
  readonly severity: 'error' | 'warning';
  /** Error code */
  readonly code: ArgoCDParseErrorCode;
}

/**
 * ArgoCD parse error codes
 */
export type ArgoCDParseErrorCode =
  | 'INVALID_YAML'
  | 'INVALID_API_VERSION'
  | 'INVALID_KIND'
  | 'MISSING_METADATA'
  | 'MISSING_SPEC'
  | 'INVALID_SOURCE'
  | 'INVALID_DESTINATION'
  | 'INVALID_GENERATOR'
  | 'INVALID_TEMPLATE'
  | 'PARSE_TIMEOUT'
  | 'FILE_TOO_LARGE'
  | 'UNKNOWN_ERROR';

/**
 * ArgoCD Application parse result
 */
export interface ArgoCDParseResult {
  /** Whether parsing succeeded */
  readonly success: boolean;
  /** Parsed Applications */
  readonly applications: readonly ArgoCDApplication[];
  /** Parsed ApplicationSets */
  readonly applicationSets: readonly ArgoCDApplicationSet[];
  /** Generated graph nodes */
  readonly nodes: readonly (ArgoCDApplicationNode | ArgoCDApplicationSetNode)[];
  /** Generated graph edges */
  readonly edges: readonly (ArgoCDDeploysEdge | ArgoCDGeneratesEdge)[];
  /** Parse errors */
  readonly errors: readonly ArgoCDParseError[];
  /** Parse warnings */
  readonly warnings: readonly ArgoCDParseError[];
  /** Parse metadata */
  readonly metadata: ArgoCDParseMetadata;
}

/**
 * ArgoCD parse metadata
 */
export interface ArgoCDParseMetadata {
  /** Source file path */
  readonly filePath: string;
  /** Parser name */
  readonly parserName: string;
  /** Parser version */
  readonly parserVersion: string;
  /** Parse time in milliseconds */
  readonly parseTimeMs: number;
  /** File size in bytes */
  readonly fileSize: number;
  /** Line count */
  readonly lineCount: number;
  /** Number of Applications parsed */
  readonly applicationCount: number;
  /** Number of ApplicationSets parsed */
  readonly applicationSetCount: number;
  /** Number of documents in multi-doc YAML */
  readonly documentCount: number;
}

// ============================================================================
// Parser Options
// ============================================================================

/**
 * ArgoCD parser options
 */
export interface ArgoCDParserOptions {
  /** Continue parsing after errors */
  readonly errorRecovery?: boolean;
  /** Maximum file size in bytes */
  readonly maxFileSize?: number;
  /** File encoding */
  readonly encoding?: BufferEncoding;
  /** Parse timeout in milliseconds */
  readonly timeout?: number;
  /** Strict mode (fail on warnings) */
  readonly strict?: boolean;
  /** Detect source types automatically */
  readonly detectSourceTypes?: boolean;
  /** Parse ApplicationSets */
  readonly parseApplicationSets?: boolean;
  /** Generate graph nodes/edges */
  readonly generateGraph?: boolean;
}

/**
 * Default ArgoCD parser options
 */
export const DEFAULT_ARGOCD_PARSER_OPTIONS: Required<ArgoCDParserOptions> = {
  errorRecovery: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  encoding: 'utf-8',
  timeout: 30000, // 30 seconds
  strict: false,
  detectSourceTypes: true,
  parseApplicationSets: true,
  generateGraph: true,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ArgoCDApplication
 */
export function isArgoCDApplication(value: unknown): value is ArgoCDApplication {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'source' in value &&
    'destination' in value &&
    'project' in value
  );
}

/**
 * Type guard for ArgoCDApplicationSet
 */
export function isArgoCDApplicationSet(value: unknown): value is ArgoCDApplicationSet {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'generators' in value &&
    'template' in value
  );
}

/**
 * Type guard for ArgoCDApplicationNode
 */
export function isArgoCDApplicationNode(
  node: ArgoCDApplicationNode | ArgoCDApplicationSetNode
): node is ArgoCDApplicationNode {
  return node.type === 'argocd_application';
}

/**
 * Type guard for ArgoCDApplicationSetNode
 */
export function isArgoCDApplicationSetNode(
  node: ArgoCDApplicationNode | ArgoCDApplicationSetNode
): node is ArgoCDApplicationSetNode {
  return node.type === 'argocd_applicationset';
}

/**
 * Type guard for ArgoCDDeploysEdge
 */
export function isArgoCDDeploysEdge(
  edge: ArgoCDDeploysEdge | ArgoCDGeneratesEdge
): edge is ArgoCDDeploysEdge {
  return edge.type === 'ARGOCD_DEPLOYS';
}

/**
 * Type guard for ArgoCDGeneratesEdge
 */
export function isArgoCDGeneratesEdge(
  edge: ArgoCDDeploysEdge | ArgoCDGeneratesEdge
): edge is ArgoCDGeneratesEdge {
  return edge.type === 'ARGOCD_GENERATES';
}

/**
 * Type guard for HelmSource
 */
export function hasHelmSource(source: ApplicationSource): boolean {
  return source.sourceType === 'helm' || source.helm !== undefined || source.chart !== undefined;
}

/**
 * Type guard for KustomizeSource
 */
export function hasKustomizeSource(source: ApplicationSource): boolean {
  return source.sourceType === 'kustomize' || source.kustomize !== undefined;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an ArgoCDApplicationId from name and namespace
 */
export function createArgoCDApplicationId(name: string, namespace: string): ArgoCDApplicationId {
  return `argocd-app-${namespace}-${name}` as ArgoCDApplicationId;
}

/**
 * Create an ArgoCDApplicationSetId from name and namespace
 */
export function createArgoCDApplicationSetId(name: string, namespace: string): ArgoCDApplicationSetId {
  return `argocd-appset-${namespace}-${name}` as ArgoCDApplicationSetId;
}

/**
 * Create an empty parse result for error cases
 */
export function createEmptyArgoCDParseResult(
  filePath: string,
  error?: ArgoCDParseError
): ArgoCDParseResult {
  return {
    success: false,
    applications: [],
    applicationSets: [],
    nodes: [],
    edges: [],
    errors: error ? [error] : [],
    warnings: [],
    metadata: {
      filePath,
      parserName: 'argocd-application-parser',
      parserVersion: '1.0.0',
      parseTimeMs: 0,
      fileSize: 0,
      lineCount: 0,
      applicationCount: 0,
      applicationSetCount: 0,
      documentCount: 0,
    },
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * ArgoCD API versions
 */
export const ARGOCD_API_VERSIONS = [
  'argoproj.io/v1alpha1',
] as const;

/**
 * ArgoCD resource kinds
 */
export const ARGOCD_KINDS = {
  APPLICATION: 'Application',
  APPLICATION_SET: 'ApplicationSet',
} as const;

/**
 * Common ArgoCD annotations
 */
export const ARGOCD_ANNOTATIONS = {
  SYNC_OPTIONS: 'argocd.argoproj.io/sync-options',
  HOOK: 'argocd.argoproj.io/hook',
  HOOK_DELETE_POLICY: 'argocd.argoproj.io/hook-delete-policy',
  SYNC_WAVE: 'argocd.argoproj.io/sync-wave',
  COMPARE_OPTIONS: 'argocd.argoproj.io/compare-options',
  MANAGED_BY: 'argocd.argoproj.io/managed-by',
} as const;

/**
 * Common sync options
 */
export const SYNC_OPTIONS = {
  PRUNE_LAST: 'PruneLast=true',
  PRUNE_PROPAGATION_FOREGROUND: 'PrunePropagationPolicy=foreground',
  PRUNE_PROPAGATION_BACKGROUND: 'PrunePropagationPolicy=background',
  PRUNE_PROPAGATION_ORPHAN: 'PrunePropagationPolicy=orphan',
  VALIDATE: 'Validate=true',
  SKIP_DRY_RUN: 'SkipDryRunOnMissingResource=true',
  APPLY_OUT_OF_SYNC: 'ApplyOutOfSyncOnly=true',
  CREATE_NAMESPACE: 'CreateNamespace=true',
  SERVER_SIDE_APPLY: 'ServerSideApply=true',
  RESPECT_IGNORE_DIFFERENCES: 'RespectIgnoreDifferences=true',
} as const;
