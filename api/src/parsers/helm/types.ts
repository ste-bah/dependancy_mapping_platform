/**
 * Helm Parser Types
 * @module parsers/helm/types
 *
 * Type definitions for Helm chart parsing and dependency detection.
 * Implements TASK-DETECT-006, 007, 008: Helm chart detection and K8s resource extraction.
 *
 * TASK-DETECT-006: Helm chart structure detection
 * TASK-DETECT-007: Helm release detection
 * TASK-DETECT-008: K8s resource extraction from templates
 */

import { NodeLocation } from '../../types/graph';

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Branded type for Helm chart IDs
 * @example
 * const chartId = 'chart-nginx' as HelmChartId;
 */
export type HelmChartId = string & { readonly __brand: 'HelmChartId' };

/**
 * Branded type for Helm release IDs
 * @example
 * const releaseId = 'release-nginx-prod' as HelmReleaseId;
 */
export type HelmReleaseId = string & { readonly __brand: 'HelmReleaseId' };

/**
 * Branded type for Helm values path
 * @example
 * const path = 'image.repository' as HelmValuesPath;
 */
export type HelmValuesPath = string & { readonly __brand: 'HelmValuesPath' };

// ============================================================================
// Chart Metadata Types
// ============================================================================

/**
 * Helm chart API version
 */
export type ChartApiVersion = 'v1' | 'v2';

/**
 * Chart type classification
 */
export type ChartType = 'application' | 'library';

/**
 * Chart maintainer information
 */
export interface ChartMaintainer {
  readonly name: string;
  readonly email?: string;
  readonly url?: string;
}

/**
 * Chart dependency definition from Chart.yaml
 */
export interface ChartDependency {
  /** Dependency name */
  readonly name: string;
  /** Version constraint (SemVer) */
  readonly version: string;
  /** Repository URL or alias */
  readonly repository: string;
  /** Condition for enabling (e.g., "redis.enabled") */
  readonly condition?: string;
  /** Tags for grouping dependencies */
  readonly tags?: readonly string[];
  /** Import values from dependency */
  readonly importValues?: readonly (string | ChartValueImport)[];
  /** Alias for the dependency */
  readonly alias?: string;
}

/**
 * Chart value import mapping
 */
export interface ChartValueImport {
  readonly child: string;
  readonly parent: string;
}

/**
 * Complete chart metadata from Chart.yaml
 */
export interface ChartMetadata {
  /** Chart API version */
  readonly apiVersion: ChartApiVersion;
  /** Chart name */
  readonly name: string;
  /** Chart version (SemVer) */
  readonly version: string;
  /** Kubernetes version constraint */
  readonly kubeVersion?: string;
  /** Chart description */
  readonly description?: string;
  /** Chart type */
  readonly type: ChartType;
  /** Keywords for search */
  readonly keywords?: readonly string[];
  /** Project home URL */
  readonly home?: string;
  /** Source code URLs */
  readonly sources?: readonly string[];
  /** Chart dependencies */
  readonly dependencies?: readonly ChartDependency[];
  /** Chart maintainers */
  readonly maintainers?: readonly ChartMaintainer[];
  /** Chart icon URL */
  readonly icon?: string;
  /** App version this chart deploys */
  readonly appVersion?: string;
  /** Whether chart is deprecated */
  readonly deprecated?: boolean;
  /** Annotations */
  readonly annotations?: Record<string, string>;
}

// ============================================================================
// Values Types
// ============================================================================

/**
 * Helm values reference - tracks where values are used
 */
export interface ValuesReference {
  /** Path in values hierarchy (dot-separated) */
  readonly path: HelmValuesPath;
  /** Default value if provided */
  readonly defaultValue?: unknown;
  /** Template file where referenced */
  readonly templateFile: string;
  /** Line number in template */
  readonly lineNumber: number;
  /** Whether value is required */
  readonly required: boolean;
  /** Value type annotation */
  readonly valueType?: HelmValueType;
}

/**
 * Type annotations for Helm values
 */
export type HelmValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'resource'  // K8s resource spec
  | 'selector'  // K8s selector
  | 'port'      // Port number/name
  | 'image'     // Container image reference
  | 'secret'    // Secret reference
  | 'configmap' // ConfigMap reference
  | 'unknown';

/**
 * Values file representation
 */
export interface HelmValuesFile {
  /** File path relative to chart root */
  readonly path: string;
  /** Parsed values structure */
  readonly values: Record<string, unknown>;
  /** All paths in the values hierarchy */
  readonly paths: readonly HelmValuesPath[];
  /** Source location */
  readonly location: NodeLocation;
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Helm template file representation
 */
export interface HelmTemplateFile {
  /** Template file path */
  readonly path: string;
  /** Template name (from define) */
  readonly name?: string;
  /** Raw template content */
  readonly content: string;
  /** K8s resources extracted from template */
  readonly resources: readonly K8sResourceExtraction[];
  /** Values references in template */
  readonly valuesRefs: readonly ValuesReference[];
  /** Named template calls */
  readonly templateCalls: readonly HelmTemplateCall[];
  /** Include statements */
  readonly includes: readonly HelmInclude[];
  /** Source location */
  readonly location: NodeLocation;
}

/**
 * Helm template function call
 */
export interface HelmTemplateCall {
  /** Template name being called */
  readonly templateName: string;
  /** Arguments passed to template */
  readonly arguments: readonly string[];
  /** Line number */
  readonly line: number;
  /** Whether it's a define (vs include) */
  readonly isDefine: boolean;
}

/**
 * Helm include statement
 */
export interface HelmInclude {
  /** Included template name */
  readonly templateName: string;
  /** Context passed (usually ".") */
  readonly context: string;
  /** Line number */
  readonly line: number;
}

// ============================================================================
// K8s Resource Extraction Types
// ============================================================================

/**
 * Kubernetes resource extracted from Helm template
 * TASK-DETECT-008: K8s resource extraction
 */
export interface K8sResourceExtraction {
  /** Resource API version */
  readonly apiVersion: string;
  /** Resource kind */
  readonly kind: K8sResourceKind;
  /** Resource name (may contain template expressions) */
  readonly name: string;
  /** Resource namespace (may contain template expressions) */
  readonly namespace?: string;
  /** Labels extracted from metadata */
  readonly labels: Record<string, string>;
  /** Annotations extracted from metadata */
  readonly annotations: Record<string, string>;
  /** Whether resource has template expressions */
  readonly hasTemplateExpressions: boolean;
  /** Template expressions found in resource */
  readonly templateExpressions: readonly TemplateExpression[];
  /** Line range in template file */
  readonly lineRange: {
    readonly start: number;
    readonly end: number;
  };
  /** Spec analysis (partial extraction) */
  readonly specAnalysis: K8sSpecAnalysis;
}

/**
 * Supported K8s resource kinds for extraction
 */
export type K8sResourceKind =
  // Workloads
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'Job'
  | 'CronJob'
  | 'Pod'
  | 'ReplicaSet'
  // Services
  | 'Service'
  | 'Ingress'
  | 'IngressClass'
  // Config
  | 'ConfigMap'
  | 'Secret'
  // Storage
  | 'PersistentVolume'
  | 'PersistentVolumeClaim'
  | 'StorageClass'
  // RBAC
  | 'ServiceAccount'
  | 'Role'
  | 'ClusterRole'
  | 'RoleBinding'
  | 'ClusterRoleBinding'
  // Network
  | 'NetworkPolicy'
  // Namespace
  | 'Namespace'
  // HPA/VPA
  | 'HorizontalPodAutoscaler'
  | 'VerticalPodAutoscaler'
  | 'PodDisruptionBudget'
  // Custom
  | 'CustomResourceDefinition'
  | string; // Allow unknown kinds

/**
 * Template expression found in K8s resource
 */
export interface TemplateExpression {
  /** Raw expression text */
  readonly raw: string;
  /** Expression type */
  readonly type: TemplateExpressionType;
  /** Resolved path (if values reference) */
  readonly valuesPath?: HelmValuesPath;
  /** Line number */
  readonly line: number;
  /** Column start */
  readonly column: number;
}

/**
 * Types of Helm template expressions
 */
export type TemplateExpressionType =
  | 'values'        // .Values.x.y
  | 'release'       // .Release.Name, .Release.Namespace
  | 'chart'         // .Chart.Name, .Chart.Version
  | 'files'         // .Files.Get, .Files.GetBytes
  | 'capabilities'  // .Capabilities.APIVersions
  | 'template'      // Template name reference
  | 'function'      // Built-in function (include, toYaml, etc.)
  | 'range'         // Range loop
  | 'conditional'   // if/else
  | 'with'          // with block
  | 'define'        // define block
  | 'unknown';

/**
 * Analysis of K8s resource spec
 */
export interface K8sSpecAnalysis {
  /** Container images referenced */
  readonly images: readonly ContainerImageRef[];
  /** ConfigMap references */
  readonly configMapRefs: readonly ConfigMapRef[];
  /** Secret references */
  readonly secretRefs: readonly SecretRef[];
  /** Service account reference */
  readonly serviceAccountRef?: string;
  /** Volume mounts */
  readonly volumeMounts: readonly VolumeMountRef[];
  /** Selector labels */
  readonly selectorLabels: Record<string, string>;
  /** Port definitions */
  readonly ports: readonly PortRef[];
  /** Resource requirements */
  readonly resources?: ResourceRequirements;
}

/**
 * Container image reference
 */
export interface ContainerImageRef {
  readonly containerName: string;
  readonly repository: string;
  readonly tag: string;
  readonly pullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  readonly hasTemplateExpression: boolean;
}

/**
 * ConfigMap reference in pod spec
 */
export interface ConfigMapRef {
  readonly name: string;
  readonly mountPath?: string;
  readonly refType: 'envFrom' | 'volume' | 'env';
  readonly optional?: boolean;
}

/**
 * Secret reference in pod spec
 */
export interface SecretRef {
  readonly name: string;
  readonly mountPath?: string;
  readonly refType: 'envFrom' | 'volume' | 'env' | 'imagePullSecret';
  readonly optional?: boolean;
}

/**
 * Volume mount reference
 */
export interface VolumeMountRef {
  readonly volumeName: string;
  readonly mountPath: string;
  readonly subPath?: string;
  readonly readOnly: boolean;
  readonly volumeType: 'configMap' | 'secret' | 'pvc' | 'emptyDir' | 'hostPath' | 'other';
}

/**
 * Port reference
 */
export interface PortRef {
  readonly name?: string;
  readonly containerPort: number;
  readonly protocol: 'TCP' | 'UDP' | 'SCTP';
  readonly servicePort?: number;
}

/**
 * Resource requirements
 */
export interface ResourceRequirements {
  readonly requests?: {
    readonly cpu?: string;
    readonly memory?: string;
  };
  readonly limits?: {
    readonly cpu?: string;
    readonly memory?: string;
  };
}

// ============================================================================
// Helm Chart Node Types
// ============================================================================

/**
 * Helm chart node for dependency graph
 * TASK-DETECT-006: Helm chart detection
 */
export interface HelmChartNodeData {
  /** Node ID */
  readonly id: HelmChartId;
  /** Node type discriminator */
  readonly type: 'helm_chart';
  /** Chart name */
  readonly name: string;
  /** Chart metadata from Chart.yaml */
  readonly metadata: ChartMetadata;
  /** Chart directory path */
  readonly chartPath: string;
  /** Values files */
  readonly valuesFiles: readonly HelmValuesFile[];
  /** Template files */
  readonly templates: readonly HelmTemplateFile[];
  /** Extracted K8s resources */
  readonly resources: readonly K8sResourceExtraction[];
  /** Chart dependencies */
  readonly dependencies: readonly ChartDependency[];
  /** Source location */
  readonly location: NodeLocation;
}

/**
 * Helm release node for dependency graph
 * TASK-DETECT-007: Helm release detection
 */
export interface HelmReleaseNodeData {
  /** Node ID */
  readonly id: HelmReleaseId;
  /** Node type discriminator */
  readonly type: 'helm_release';
  /** Release name */
  readonly name: string;
  /** Target namespace */
  readonly namespace: string;
  /** Chart reference (name or path) */
  readonly chartRef: string;
  /** Chart version constraint */
  readonly chartVersion?: string;
  /** Repository URL */
  readonly repository?: string;
  /** Values overrides */
  readonly values: Record<string, unknown>;
  /** Values files referenced */
  readonly valuesFiles: readonly string[];
  /** Set values (--set) */
  readonly setValues: Record<string, unknown>;
  /** Whether release is enabled */
  readonly enabled: boolean;
  /** Wait for resources */
  readonly wait: boolean;
  /** Timeout */
  readonly timeout?: string;
  /** Atomic upgrade */
  readonly atomic: boolean;
  /** Create namespace */
  readonly createNamespace: boolean;
  /** Source location */
  readonly location: NodeLocation;
}

/**
 * Helm values node for dependency graph
 */
export interface HelmValuesNodeData {
  /** Node ID */
  readonly id: string;
  /** Node type discriminator */
  readonly type: 'helm_value';
  /** Value path */
  readonly path: HelmValuesPath;
  /** Value data */
  readonly value: unknown;
  /** Value type */
  readonly valueType: HelmValueType;
  /** Parent chart ID */
  readonly chartId: HelmChartId;
  /** References to this value */
  readonly references: readonly ValuesReference[];
  /** Source location */
  readonly location: NodeLocation;
}

// ============================================================================
// Helmfile Types
// ============================================================================

/**
 * Helmfile release specification
 */
export interface HelmfileRelease {
  readonly name: string;
  readonly namespace?: string;
  readonly chart: string;
  readonly version?: string;
  readonly values?: readonly (string | Record<string, unknown>)[];
  readonly set?: readonly HelmfileSetValue[];
  readonly installed?: boolean;
  readonly needs?: readonly string[];
  readonly wait?: boolean;
  readonly timeout?: number;
  readonly atomic?: boolean;
  readonly createNamespace?: boolean;
  readonly labels?: Record<string, string>;
}

/**
 * Helmfile set value
 */
export interface HelmfileSetValue {
  readonly name: string;
  readonly value: string | number | boolean;
  readonly file?: string;
}

/**
 * Helmfile repository definition
 */
export interface HelmfileRepository {
  readonly name: string;
  readonly url: string;
  readonly certFile?: string;
  readonly keyFile?: string;
  readonly caFile?: string;
  readonly username?: string;
  readonly password?: string;
}

/**
 * Parsed Helmfile structure
 */
export interface HelmfileSpec {
  readonly repositories?: readonly HelmfileRepository[];
  readonly releases: readonly HelmfileRelease[];
  readonly environments?: Record<string, HelmfileEnvironment>;
  readonly helmDefaults?: HelmfileDefaults;
  readonly bases?: readonly string[];
}

/**
 * Helmfile environment
 */
export interface HelmfileEnvironment {
  readonly values?: readonly string[];
  readonly secrets?: readonly string[];
  readonly kubeContext?: string;
}

/**
 * Helmfile defaults
 */
export interface HelmfileDefaults {
  readonly tillerNamespace?: string;
  readonly tillerless?: boolean;
  readonly kubeContext?: string;
  readonly cleanupOnFail?: boolean;
  readonly args?: readonly string[];
  readonly verify?: boolean;
  readonly wait?: boolean;
  readonly timeout?: number;
  readonly recreatePods?: boolean;
  readonly force?: boolean;
  readonly atomic?: boolean;
  readonly createNamespace?: boolean;
}

// ============================================================================
// Parse Result Types
// ============================================================================

/**
 * Helm parse error
 */
export interface HelmParseError {
  readonly message: string;
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly severity: 'error' | 'warning';
  readonly code: HelmParseErrorCode;
}

/**
 * Helm parse error codes
 */
export type HelmParseErrorCode =
  | 'INVALID_CHART_YAML'
  | 'INVALID_VALUES_YAML'
  | 'INVALID_TEMPLATE'
  | 'MISSING_CHART_YAML'
  | 'MISSING_VALUES_YAML'
  | 'INVALID_DEPENDENCY'
  | 'CIRCULAR_DEPENDENCY'
  | 'TEMPLATE_SYNTAX_ERROR'
  | 'YAML_PARSE_ERROR'
  | 'K8S_RESOURCE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Helm chart parse result
 */
export interface HelmChartParseResult {
  readonly success: boolean;
  readonly chart?: HelmChartNodeData;
  readonly errors: readonly HelmParseError[];
  readonly warnings: readonly HelmParseError[];
}

/**
 * Helmfile parse result
 */
export interface HelmfileParseResult {
  readonly success: boolean;
  readonly spec?: HelmfileSpec;
  readonly releases: readonly HelmReleaseNodeData[];
  readonly errors: readonly HelmParseError[];
  readonly warnings: readonly HelmParseError[];
}

// ============================================================================
// Parser Options
// ============================================================================

/**
 * Helm parser options
 */
export interface HelmParserOptions {
  /** Parse template files */
  readonly parseTemplates: boolean;
  /** Extract K8s resources from templates */
  readonly extractResources: boolean;
  /** Include raw template content */
  readonly includeRawContent: boolean;
  /** Maximum template size to parse (bytes) */
  readonly maxTemplateSize: number;
  /** Resolve chart dependencies */
  readonly resolveDependencies: boolean;
  /** Strict mode (fail on warnings) */
  readonly strict: boolean;
  /** Skip values validation */
  readonly skipValuesValidation: boolean;
}

/**
 * Default Helm parser options
 */
export const DEFAULT_HELM_PARSER_OPTIONS: HelmParserOptions = {
  parseTemplates: true,
  extractResources: true,
  includeRawContent: false,
  maxTemplateSize: 1024 * 1024, // 1MB
  resolveDependencies: false,
  strict: false,
  skipValuesValidation: false,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for HelmChartNodeData
 * @example
 * if (isHelmChartNode(node)) {
 *   console.log(node.metadata.version);
 * }
 */
export function isHelmChartNode(node: unknown): node is HelmChartNodeData {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'helm_chart'
  );
}

/**
 * Type guard for HelmReleaseNodeData
 * @example
 * if (isHelmReleaseNode(node)) {
 *   console.log(node.namespace);
 * }
 */
export function isHelmReleaseNode(node: unknown): node is HelmReleaseNodeData {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'helm_release'
  );
}

/**
 * Type guard for HelmValuesNodeData
 * @example
 * if (isHelmValuesNode(node)) {
 *   console.log(node.path);
 * }
 */
export function isHelmValuesNode(node: unknown): node is HelmValuesNodeData {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'helm_value'
  );
}

/**
 * Type guard for K8sResourceExtraction
 */
export function isK8sResourceExtraction(value: unknown): value is K8sResourceExtraction {
  return (
    typeof value === 'object' &&
    value !== null &&
    'apiVersion' in value &&
    'kind' in value &&
    'name' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a HelmChartId from string
 * @example
 * const chartId = createHelmChartId('nginx');
 */
export function createHelmChartId(name: string): HelmChartId {
  return `chart-${name}` as HelmChartId;
}

/**
 * Create a HelmReleaseId from string
 * @example
 * const releaseId = createHelmReleaseId('nginx', 'production');
 */
export function createHelmReleaseId(name: string, namespace: string): HelmReleaseId {
  return `release-${name}-${namespace}` as HelmReleaseId;
}

/**
 * Create a HelmValuesPath from string
 * @example
 * const path = createHelmValuesPath('image.repository');
 */
export function createHelmValuesPath(path: string): HelmValuesPath {
  return path as HelmValuesPath;
}

/**
 * Create empty chart metadata
 */
export function createEmptyChartMetadata(name: string, version: string): ChartMetadata {
  return {
    apiVersion: 'v2',
    name,
    version,
    type: 'application',
  };
}
