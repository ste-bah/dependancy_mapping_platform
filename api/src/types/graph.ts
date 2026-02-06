/**
 * Graph Type Definitions
 * @module types/graph
 *
 * Core type definitions for the dependency graph system.
 * Implements NodeType (20+ K8s types) and EdgeType (26 variants) from Phase 3 design.
 *
 * TASK-DETECT-010: Graph builder types for IaC dependency detection
 * TASK-TG-008: Terragrunt edge types (tg_includes, tg_depends_on, tg_passes_input, tg_sources)
 */

// ============================================================================
// Node Types - Discriminated Union
// ============================================================================

/**
 * All supported node types in the dependency graph.
 * Extended with 20 Kubernetes resource types per architecture spec.
 */
export type NodeType =
  // Terraform Node Types
  | TerraformResourceNode
  | TerraformDataNode
  | TerraformModuleNode
  | TerraformVariableNode
  | TerraformOutputNode
  | TerraformLocalNode
  | TerraformProviderNode
  // Kubernetes Node Types
  | K8sDeploymentNode
  | K8sServiceNode
  | K8sConfigMapNode
  | K8sSecretNode
  | K8sIngressNode
  | K8sPodNode
  | K8sStatefulSetNode
  | K8sDaemonSetNode
  | K8sJobNode
  | K8sCronJobNode
  | K8sNamespaceNode
  | K8sServiceAccountNode
  | K8sRoleNode
  | K8sRoleBindingNode
  | K8sClusterRoleNode
  | K8sClusterRoleBindingNode
  | K8sPersistentVolumeNode
  | K8sPersistentVolumeClaimNode
  | K8sStorageClassNode
  | K8sNetworkPolicyNode
  // Helm Node Types
  | HelmChartNode
  | HelmReleaseNode
  | HelmValueNode
  // Terragrunt Node Types
  | TerragruntConfigNode
  | TerragruntIncludeNode
  | TerragruntDependencyNode;

/**
 * Base interface for all graph nodes
 */
export interface BaseNode {
  /** Unique node identifier */
  readonly id: string;
  /** Human-readable node name */
  readonly name: string;
  /** Source file location */
  readonly location: NodeLocation;
  /** Node-specific metadata */
  readonly metadata: Record<string, unknown>;
}

/**
 * Source location for a node
 */
export interface NodeLocation {
  readonly file: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly columnStart?: number;
  readonly columnEnd?: number;
}

// ============================================================================
// Terraform Node Types
// ============================================================================

export interface TerraformResourceNode extends BaseNode {
  readonly type: 'terraform_resource';
  readonly resourceType: string;
  readonly provider: string;
  readonly providerAlias?: string;
  readonly count?: number | string;
  readonly forEach?: string;
  readonly dependsOn: string[];
}

export interface TerraformDataNode extends BaseNode {
  readonly type: 'terraform_data';
  readonly dataType: string;
  readonly provider: string;
  readonly providerAlias?: string;
}

export interface TerraformModuleNode extends BaseNode {
  readonly type: 'terraform_module';
  readonly source: string;
  readonly sourceType: 'local' | 'registry' | 'git' | 'github' | 's3' | 'gcs' | 'unknown';
  readonly version?: string;
  readonly providers: Record<string, string>;
}

export interface TerraformVariableNode extends BaseNode {
  readonly type: 'terraform_variable';
  readonly variableType?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive: boolean;
  readonly nullable: boolean;
}

export interface TerraformOutputNode extends BaseNode {
  readonly type: 'terraform_output';
  readonly value: string;
  readonly description?: string;
  readonly sensitive: boolean;
}

export interface TerraformLocalNode extends BaseNode {
  readonly type: 'terraform_local';
  readonly value: string;
}

export interface TerraformProviderNode extends BaseNode {
  readonly type: 'terraform_provider';
  readonly providerName: string;
  readonly alias?: string;
  readonly version?: string;
}

// ============================================================================
// Kubernetes Node Types
// ============================================================================

export interface K8sDeploymentNode extends BaseNode {
  readonly type: 'k8s_deployment';
  readonly namespace?: string;
  readonly replicas?: number;
  readonly selector: Record<string, string>;
  readonly containers: K8sContainerSpec[];
}

export interface K8sServiceNode extends BaseNode {
  readonly type: 'k8s_service';
  readonly namespace?: string;
  readonly serviceType: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  readonly selector: Record<string, string>;
  readonly ports: K8sServicePort[];
}

export interface K8sConfigMapNode extends BaseNode {
  readonly type: 'k8s_configmap';
  readonly namespace?: string;
  readonly dataKeys: string[];
}

export interface K8sSecretNode extends BaseNode {
  readonly type: 'k8s_secret';
  readonly namespace?: string;
  readonly secretType: string;
  readonly dataKeys: string[];
}

export interface K8sIngressNode extends BaseNode {
  readonly type: 'k8s_ingress';
  readonly namespace?: string;
  readonly ingressClass?: string;
  readonly rules: K8sIngressRule[];
  readonly tls: K8sTlsConfig[];
}

export interface K8sPodNode extends BaseNode {
  readonly type: 'k8s_pod';
  readonly namespace?: string;
  readonly containers: K8sContainerSpec[];
}

export interface K8sStatefulSetNode extends BaseNode {
  readonly type: 'k8s_statefulset';
  readonly namespace?: string;
  readonly replicas?: number;
  readonly serviceName: string;
  readonly selector: Record<string, string>;
}

export interface K8sDaemonSetNode extends BaseNode {
  readonly type: 'k8s_daemonset';
  readonly namespace?: string;
  readonly selector: Record<string, string>;
}

export interface K8sJobNode extends BaseNode {
  readonly type: 'k8s_job';
  readonly namespace?: string;
  readonly completions?: number;
  readonly parallelism?: number;
}

export interface K8sCronJobNode extends BaseNode {
  readonly type: 'k8s_cronjob';
  readonly namespace?: string;
  readonly schedule: string;
}

export interface K8sNamespaceNode extends BaseNode {
  readonly type: 'k8s_namespace';
}

export interface K8sServiceAccountNode extends BaseNode {
  readonly type: 'k8s_serviceaccount';
  readonly namespace?: string;
}

export interface K8sRoleNode extends BaseNode {
  readonly type: 'k8s_role';
  readonly namespace?: string;
  readonly rules: K8sRbacRule[];
}

export interface K8sRoleBindingNode extends BaseNode {
  readonly type: 'k8s_rolebinding';
  readonly namespace?: string;
  readonly roleRef: K8sRoleRef;
  readonly subjects: K8sSubject[];
}

export interface K8sClusterRoleNode extends BaseNode {
  readonly type: 'k8s_clusterrole';
  readonly rules: K8sRbacRule[];
}

export interface K8sClusterRoleBindingNode extends BaseNode {
  readonly type: 'k8s_clusterrolebinding';
  readonly roleRef: K8sRoleRef;
  readonly subjects: K8sSubject[];
}

export interface K8sPersistentVolumeNode extends BaseNode {
  readonly type: 'k8s_persistentvolume';
  readonly capacity: string;
  readonly storageClass?: string;
  readonly accessModes: string[];
}

export interface K8sPersistentVolumeClaimNode extends BaseNode {
  readonly type: 'k8s_persistentvolumeclaim';
  readonly namespace?: string;
  readonly storageClass?: string;
  readonly accessModes: string[];
  readonly requestedStorage: string;
}

export interface K8sStorageClassNode extends BaseNode {
  readonly type: 'k8s_storageclass';
  readonly provisioner: string;
  readonly reclaimPolicy: string;
}

export interface K8sNetworkPolicyNode extends BaseNode {
  readonly type: 'k8s_networkpolicy';
  readonly namespace?: string;
  readonly podSelector: Record<string, string>;
  readonly policyTypes: ('Ingress' | 'Egress')[];
}

// ============================================================================
// Kubernetes Supporting Types
// ============================================================================

export interface K8sContainerSpec {
  readonly name: string;
  readonly image: string;
  readonly ports?: K8sContainerPort[];
  readonly envFrom?: K8sEnvFromSource[];
  readonly volumeMounts?: K8sVolumeMount[];
}

export interface K8sContainerPort {
  readonly name?: string;
  readonly containerPort: number;
  readonly protocol?: 'TCP' | 'UDP' | 'SCTP';
}

export interface K8sEnvFromSource {
  readonly type: 'configMapRef' | 'secretRef';
  readonly name: string;
  readonly optional?: boolean;
}

export interface K8sVolumeMount {
  readonly name: string;
  readonly mountPath: string;
  readonly readOnly?: boolean;
}

export interface K8sServicePort {
  readonly name?: string;
  readonly port: number;
  readonly targetPort: number | string;
  readonly protocol?: 'TCP' | 'UDP' | 'SCTP';
  readonly nodePort?: number;
}

export interface K8sIngressRule {
  readonly host?: string;
  readonly paths: K8sIngressPath[];
}

export interface K8sIngressPath {
  readonly path: string;
  readonly pathType: 'Prefix' | 'Exact' | 'ImplementationSpecific';
  readonly serviceName: string;
  readonly servicePort: number | string;
}

export interface K8sTlsConfig {
  readonly hosts: string[];
  readonly secretName: string;
}

export interface K8sRbacRule {
  readonly apiGroups: string[];
  readonly resources: string[];
  readonly verbs: string[];
}

export interface K8sRoleRef {
  readonly apiGroup: string;
  readonly kind: 'Role' | 'ClusterRole';
  readonly name: string;
}

export interface K8sSubject {
  readonly kind: 'User' | 'Group' | 'ServiceAccount';
  readonly name: string;
  readonly namespace?: string;
}

// ============================================================================
// Helm Node Types
// ============================================================================

export interface HelmChartNode extends BaseNode {
  readonly type: 'helm_chart';
  readonly chartName: string;
  readonly chartVersion?: string;
  readonly repository?: string;
}

export interface HelmReleaseNode extends BaseNode {
  readonly type: 'helm_release';
  readonly chartRef: string;
  readonly namespace?: string;
  readonly values: Record<string, unknown>;
}

export interface HelmValueNode extends BaseNode {
  readonly type: 'helm_value';
  readonly path: string;
  readonly value: unknown;
}

// ============================================================================
// Terragrunt Node Types
// ============================================================================

/**
 * Terragrunt configuration node representing a terragrunt.hcl file
 */
export interface TerragruntConfigNode extends BaseNode {
  readonly type: 'tg_config';
  /** Terraform source reference (local path, git URL, or registry) */
  readonly terraformSource: string | null;
  /** Whether this config has remote_state block */
  readonly hasRemoteState: boolean;
  /** Remote state backend type (e.g., 's3', 'gcs', 'azurerm') */
  readonly remoteStateBackend: string | null;
  /** Number of include blocks in this config */
  readonly includeCount: number;
  /** Number of dependency blocks in this config */
  readonly dependencyCount: number;
  /** Number of inputs defined in this config */
  readonly inputCount: number;
  /** Names of generate blocks in this config */
  readonly generateBlocks: readonly string[];
}

/**
 * Represents a Terragrunt include block that references a parent configuration.
 * Maps to 'tg_include' in the database node_type enum.
 *
 * @example
 * ```hcl
 * include "root" {
 *   path = find_in_parent_folders("root.hcl")
 *   expose = true
 *   merge_strategy = "deep"
 * }
 * ```
 */
export interface TerragruntIncludeNode extends BaseNode {
  /** Discriminator for include nodes - maps to existing DB enum value */
  readonly type: 'tg_include';
  /** Label of the include block (e.g., "root", "common") */
  readonly label: string;
  /** Original path expression from HCL */
  readonly path: string;
  /** Resolved absolute path to parent config, null if unresolved */
  readonly resolvedPath: string | null;
  /** Whether included values are exposed as variables */
  readonly expose: boolean;
  /** How included values are merged with local values */
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
}

/**
 * Represents a Terragrunt dependency block that references another module.
 * Maps to 'tg_dependency' in the database node_type enum.
 *
 * @example
 * ```hcl
 * dependency "vpc" {
 *   config_path = "../vpc"
 *   skip_outputs = false
 *   mock_outputs = { vpc_id = "mock-vpc-123" }
 * }
 * ```
 */
export interface TerragruntDependencyNode extends BaseNode {
  /** Discriminator for dependency nodes - maps to existing DB enum value */
  readonly type: 'tg_dependency';
  /** Name of the dependency block (e.g., "vpc", "database") */
  readonly dependencyName: string;
  /** Original config_path expression from HCL */
  readonly configPath: string;
  /** Resolved absolute path to dependency config, null if unresolved */
  readonly resolvedPath: string | null;
  /** Whether to skip reading outputs from this dependency */
  readonly skipOutputs: boolean;
  /** Whether mock_outputs block is defined */
  readonly hasMockOutputs: boolean;
}

// ============================================================================
// Edge Types - 26 Variant Discriminated Union
// ============================================================================

/**
 * All supported edge types in the dependency graph.
 * Implements 26 variants: 22 from Phase 3 architecture + 4 Terragrunt types (TASK-TG-008).
 */
export type EdgeType =
  // Resource Dependencies
  | 'depends_on'           // Explicit depends_on relationship
  | 'references'           // Attribute reference (e.g., aws_instance.web.id)
  | 'creates'              // Resource creates another resource
  | 'destroys'             // Resource destruction dependency
  // Module Dependencies
  | 'module_call'          // Module invocation
  | 'module_source'        // Module source reference
  | 'module_provider'      // Module provider passing
  // Variable/Output Flow
  | 'input_variable'       // Variable input to module
  | 'output_value'         // Module output value
  | 'local_reference'      // Local value reference
  // Provider Relationships
  | 'provider_config'      // Provider configuration reference
  | 'provider_alias'       // Provider alias reference
  // Data Source Dependencies
  | 'data_source'          // Data source query
  | 'data_reference'       // Data source attribute reference
  // Kubernetes Dependencies
  | 'selector_match'       // Label selector matching
  | 'namespace_member'     // Namespace membership
  | 'volume_mount'         // Volume mounting
  | 'service_target'       // Service targeting pods
  | 'ingress_backend'      // Ingress backend service
  | 'rbac_binding'         // RBAC role binding
  | 'configmap_ref'        // ConfigMap reference
  | 'secret_ref'           // Secret reference
  // Terragrunt Dependencies (TASK-TG-008)
  | 'tg_includes'          // Include block: child config -> parent config
  | 'tg_depends_on'        // Dependency block: config -> dependency config
  | 'tg_passes_input'      // Input flow: parent config -> child config
  | 'tg_sources';          // TF source: TG config -> TF module

/**
 * Graph edge representing a relationship between nodes
 */
export interface GraphEdge {
  /** Unique edge identifier */
  readonly id: string;
  /** Source node ID */
  readonly source: string;
  /** Target node ID */
  readonly target: string;
  /** Type of relationship */
  readonly type: EdgeType;
  /** Optional label for display */
  readonly label?: string;
  /** Edge metadata */
  readonly metadata: EdgeMetadata;
}

// ============================================================================
// Terragrunt Edge Types (TASK-TG-008)
// ============================================================================

/**
 * Metadata for tg_includes edges.
 * Captures include block configuration and merge behavior.
 */
export interface TgIncludesEdgeMetadata {
  /** Name/label of the include block (e.g., "root", "common") */
  readonly includeName: string;
  /** How included values are merged with local values */
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
  /** Names of blocks inherited from the parent config */
  readonly inheritedBlocks: readonly string[];
  /** Whether the included config is exposed as a variable */
  readonly exposeAsVariable: boolean;
}

/**
 * Edge representing a Terragrunt include relationship.
 * Source: child config, Target: parent config.
 *
 * @example
 * ```hcl
 * include "root" {
 *   path = find_in_parent_folders("root.hcl")
 *   expose = true
 *   merge_strategy = "deep"
 * }
 * ```
 */
export interface TgIncludesEdge extends GraphEdge {
  readonly type: 'tg_includes';
  readonly metadata: EdgeMetadata & TgIncludesEdgeMetadata;
}

/**
 * Metadata for tg_depends_on edges.
 * Captures dependency block configuration and output handling.
 */
export interface TgDependsOnEdgeMetadata {
  /** Name of the dependency block (e.g., "vpc", "database") */
  readonly dependencyName: string;
  /** Whether outputs are skipped for this dependency */
  readonly skipOutputs: boolean;
  /** Output keys accessed from this dependency */
  readonly accessedOutputs: readonly string[];
  /** Whether mock outputs are defined */
  readonly hasMockOutputs: boolean;
}

/**
 * Edge representing a Terragrunt dependency relationship.
 * Source: dependent config, Target: dependency config.
 *
 * @example
 * ```hcl
 * dependency "vpc" {
 *   config_path = "../vpc"
 *   skip_outputs = false
 * }
 * ```
 */
export interface TgDependsOnEdge extends GraphEdge {
  readonly type: 'tg_depends_on';
  readonly metadata: EdgeMetadata & TgDependsOnEdgeMetadata;
}

/**
 * Metadata for tg_passes_input edges.
 * Captures input flow from parent to child configuration.
 */
export interface TgPassesInputEdgeMetadata {
  /** Name of the input variable being passed */
  readonly inputName: string;
  /** Type of the input value (if specified) */
  readonly inputType: string | null;
  /** Whether this input is from an exposed include */
  readonly fromExposedInclude: boolean;
  /** Source expression for the input value */
  readonly sourceExpression: string | null;
}

/**
 * Edge representing input flow from parent to child Terragrunt config.
 * Source: parent config (via include), Target: child config.
 *
 * @example Child config accessing parent's exposed values:
 * ```hcl
 * inputs = {
 *   region = include.root.locals.region
 * }
 * ```
 */
export interface TgPassesInputEdge extends GraphEdge {
  readonly type: 'tg_passes_input';
  readonly metadata: EdgeMetadata & TgPassesInputEdgeMetadata;
}

/**
 * Metadata for tg_sources edges.
 * Captures Terraform module source configuration.
 */
export interface TgSourcesEdgeMetadata {
  /** Type of the Terraform source */
  readonly sourceType: 'local' | 'git' | 'registry' | 's3' | 'gcs' | 'github' | 'unknown';
  /** Version constraint for registry/git sources */
  readonly versionConstraint: string | null;
  /** Git reference (branch, tag, commit) if applicable */
  readonly gitRef: string | null;
  /** Subdirectory within the source (// syntax) */
  readonly subdirectory: string | null;
}

/**
 * Edge representing Terragrunt config sourcing a Terraform module.
 * Source: Terragrunt config, Target: Terraform module.
 *
 * @example
 * ```hcl
 * terraform {
 *   source = "git::git@github.com:org/modules.git//vpc?ref=v1.0.0"
 * }
 * ```
 */
export interface TgSourcesEdge extends GraphEdge {
  readonly type: 'tg_sources';
  readonly metadata: EdgeMetadata & TgSourcesEdgeMetadata;
}

/**
 * Union type for all Terragrunt edge types.
 * Use this for type-safe handling of Terragrunt-specific edges.
 */
export type TerragruntEdge =
  | TgIncludesEdge
  | TgDependsOnEdge
  | TgPassesInputEdge
  | TgSourcesEdge;

/**
 * Edge metadata containing additional relationship information
 */
export interface EdgeMetadata {
  /** Attribute being referenced (if applicable) */
  readonly attribute?: string;
  /** Source location where the reference occurs */
  readonly location?: NodeLocation;
  /** Whether this is an implicit or explicit dependency */
  readonly implicit: boolean;
  /** Confidence score for inferred edges (0-100) */
  readonly confidence: number;
  /** Evidence supporting this edge */
  readonly evidence?: EdgeEvidence[];
}

/**
 * Evidence supporting an edge relationship
 */
export interface EdgeEvidence {
  /** Type of evidence */
  readonly type: 'syntax' | 'semantic' | 'heuristic' | 'explicit';
  /** Description of the evidence */
  readonly description: string;
  /** Source location of the evidence */
  readonly location?: NodeLocation;
}

// ============================================================================
// Graph Structure
// ============================================================================

/**
 * Complete dependency graph
 */
export interface DependencyGraph {
  /** Graph identifier */
  readonly id: string;
  /** All nodes in the graph */
  readonly nodes: Map<string, NodeType>;
  /** All edges in the graph */
  readonly edges: GraphEdge[];
  /** Graph metadata */
  readonly metadata: GraphMetadata;
}

/**
 * Graph-level metadata
 */
export interface GraphMetadata {
  /** When the graph was created */
  readonly createdAt: Date;
  /** Source files included in the graph */
  readonly sourceFiles: string[];
  /** Total node count by type */
  readonly nodeCounts: Record<string, number>;
  /** Total edge count by type */
  readonly edgeCounts: Record<EdgeType, number>;
  /** Graph build duration in milliseconds */
  readonly buildTimeMs: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for Terraform nodes
 */
export function isTerraformNode(node: NodeType): node is
  | TerraformResourceNode
  | TerraformDataNode
  | TerraformModuleNode
  | TerraformVariableNode
  | TerraformOutputNode
  | TerraformLocalNode
  | TerraformProviderNode {
  return node.type.startsWith('terraform_');
}

/**
 * Type guard for Kubernetes nodes
 */
export function isK8sNode(node: NodeType): node is NodeType & { type: `k8s_${string}` } {
  return node.type.startsWith('k8s_');
}

/**
 * Type guard for Helm nodes
 */
export function isHelmNode(node: NodeType): node is
  | HelmChartNode
  | HelmReleaseNode
  | HelmValueNode {
  return node.type.startsWith('helm_');
}

/**
 * Type guard for Terragrunt config nodes
 */
export function isTerragruntConfigNode(node: NodeType): node is TerragruntConfigNode {
  return node.type === 'tg_config';
}

/**
 * Type guard for TerragruntIncludeNode.
 */
export function isTerragruntIncludeNode(node: NodeType): node is TerragruntIncludeNode {
  return node.type === 'tg_include';
}

/**
 * Type guard for TerragruntDependencyNode.
 */
export function isTerragruntDependencyNode(node: NodeType): node is TerragruntDependencyNode {
  return node.type === 'tg_dependency';
}

/**
 * Type guard for any Terragrunt node type.
 */
export function isTerragruntNode(node: NodeType): node is
  | TerragruntConfigNode
  | TerragruntIncludeNode
  | TerragruntDependencyNode {
  return node.type.startsWith('tg_');
}

// ============================================================================
// Terragrunt Edge Type Guards (TASK-TG-008)
// ============================================================================

/**
 * Type guard for TgIncludesEdge.
 * Checks if an edge represents a Terragrunt include relationship.
 */
export function isTgIncludesEdge(edge: GraphEdge): edge is TgIncludesEdge {
  return edge.type === 'tg_includes';
}

/**
 * Type guard for TgDependsOnEdge.
 * Checks if an edge represents a Terragrunt dependency relationship.
 */
export function isTgDependsOnEdge(edge: GraphEdge): edge is TgDependsOnEdge {
  return edge.type === 'tg_depends_on';
}

/**
 * Type guard for TgPassesInputEdge.
 * Checks if an edge represents a Terragrunt input passing relationship.
 */
export function isTgPassesInputEdge(edge: GraphEdge): edge is TgPassesInputEdge {
  return edge.type === 'tg_passes_input';
}

/**
 * Type guard for TgSourcesEdge.
 * Checks if an edge represents a Terragrunt-to-Terraform source relationship.
 */
export function isTgSourcesEdge(edge: GraphEdge): edge is TgSourcesEdge {
  return edge.type === 'tg_sources';
}

/**
 * Type guard for any Terragrunt edge type.
 * Checks if an edge is one of the Terragrunt-specific edge types.
 */
export function isTerragruntEdge(edge: GraphEdge): edge is TerragruntEdge {
  return edge.type.startsWith('tg_');
}

// ============================================================================
// Node Type Literal Type
// ============================================================================

/**
 * String literal type for all node types
 */
export type NodeTypeName =
  | 'terraform_resource'
  | 'terraform_data'
  | 'terraform_module'
  | 'terraform_variable'
  | 'terraform_output'
  | 'terraform_local'
  | 'terraform_provider'
  | 'k8s_deployment'
  | 'k8s_service'
  | 'k8s_configmap'
  | 'k8s_secret'
  | 'k8s_ingress'
  | 'k8s_pod'
  | 'k8s_statefulset'
  | 'k8s_daemonset'
  | 'k8s_job'
  | 'k8s_cronjob'
  | 'k8s_namespace'
  | 'k8s_serviceaccount'
  | 'k8s_role'
  | 'k8s_rolebinding'
  | 'k8s_clusterrole'
  | 'k8s_clusterrolebinding'
  | 'k8s_persistentvolume'
  | 'k8s_persistentvolumeclaim'
  | 'k8s_storageclass'
  | 'k8s_networkpolicy'
  | 'helm_chart'
  | 'helm_release'
  | 'helm_value'
  | 'tg_config'
  | 'tg_include'
  | 'tg_dependency';
