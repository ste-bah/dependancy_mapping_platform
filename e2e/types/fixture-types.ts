/**
 * E2E Test Fixture Types
 * @module e2e/types/fixture-types
 *
 * Fixture data type definitions:
 * - TerraformFixture - Terraform test data
 * - HelmFixture - Helm chart test data
 * - UserFixture - User authentication fixture
 * - GraphFixture - Graph node/edge fixtures
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #20 of 47 | Phase 4: Implementation
 */

import type {
  TenantId,
  RepositoryId,
  ScanId,
  UserId,
  DbNodeId,
  DbEdgeId,
  ScanStatus,
  GitProvider,
} from '../../api/src/types/entities.js';
import type { Brand } from '../../api/src/types/utility.js';

// ============================================================================
// Branded Types for Fixtures
// ============================================================================

/**
 * Branded type for Fixture File IDs
 */
export type FixtureFileId = Brand<string, 'FixtureFileId'>;

/**
 * Branded type for Mock Response IDs
 */
export type MockResponseId = Brand<string, 'MockResponseId'>;

/**
 * Create a FixtureFileId from a string
 */
export function createFixtureFileId(id: string): FixtureFileId {
  return id as FixtureFileId;
}

/**
 * Create a MockResponseId from a string
 */
export function createMockResponseId(id: string): MockResponseId {
  return id as MockResponseId;
}

// ============================================================================
// Terraform Fixture Types
// ============================================================================

/**
 * Terraform fixture configuration
 */
export interface TerraformFixture {
  /** Fixture name/identifier */
  readonly name: string;
  /** Directory path relative to fixtures/repos */
  readonly path: string;
  /** Main .tf files in the fixture */
  readonly mainFiles: ReadonlyArray<string>;
  /** Module directories if any */
  readonly modules: ReadonlyArray<string>;
  /** Expected node count after parsing */
  readonly expectedNodeCount: number;
  /** Expected edge count after parsing */
  readonly expectedEdgeCount: number;
  /** Description of what this fixture tests */
  readonly description: string;
  /** Tags for categorizing fixtures */
  readonly tags: ReadonlyArray<TerraformFixtureTag>;
  /** Terraform version requirement */
  readonly terraformVersion?: string;
  /** Required providers */
  readonly providers: ReadonlyArray<TerraformProvider>;
  /** Expected resource types */
  readonly expectedResourceTypes: ReadonlyArray<string>;
  /** Expected data source types */
  readonly expectedDataSourceTypes: ReadonlyArray<string>;
  /** Whether fixture uses remote modules */
  readonly hasRemoteModules: boolean;
  /** Whether fixture has backend configuration */
  readonly hasBackend: boolean;
}

/**
 * Terraform fixture tags
 */
export type TerraformFixtureTag =
  | 'simple'
  | 'complex'
  | 'modules'
  | 'remote-state'
  | 'workspaces'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'kubernetes'
  | 'multi-provider'
  | 'count'
  | 'for-each'
  | 'dynamic-blocks'
  | 'conditionals';

/**
 * Terraform provider configuration
 */
export interface TerraformProvider {
  readonly name: string;
  readonly source: string;
  readonly version: string;
  readonly alias?: string;
  readonly region?: string;
}

/**
 * Terraform resource fixture
 */
export interface TerraformResourceFixture {
  /** Resource type (e.g., 'aws_s3_bucket') */
  readonly type: string;
  /** Resource name (e.g., 'main') */
  readonly name: string;
  /** Full address (e.g., 'aws_s3_bucket.main') */
  readonly address: string;
  /** Provider alias */
  readonly provider?: string;
  /** Configuration attributes */
  readonly config: Readonly<Record<string, unknown>>;
  /** Dependencies (explicit depends_on) */
  readonly dependencies: ReadonlyArray<string>;
  /** Count expression */
  readonly count?: string | number;
  /** For each expression */
  readonly forEach?: string;
  /** File location */
  readonly location: FileLocation;
}

/**
 * Terraform variable fixture
 */
export interface TerraformVariableFixture {
  readonly name: string;
  readonly type: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly validation?: TerraformValidation;
  readonly location: FileLocation;
}

/**
 * Terraform validation block
 */
export interface TerraformValidation {
  readonly condition: string;
  readonly errorMessage: string;
}

/**
 * Terraform output fixture
 */
export interface TerraformOutputFixture {
  readonly name: string;
  readonly value: string;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly dependsOn?: ReadonlyArray<string>;
  readonly location: FileLocation;
}

/**
 * Terraform module fixture
 */
export interface TerraformModuleFixture {
  readonly name: string;
  readonly source: string;
  readonly version?: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly providers?: Readonly<Record<string, string>>;
  readonly dependsOn?: ReadonlyArray<string>;
  readonly count?: string | number;
  readonly forEach?: string;
  readonly location: FileLocation;
}

/**
 * Terraform data source fixture
 */
export interface TerraformDataSourceFixture {
  readonly type: string;
  readonly name: string;
  readonly address: string;
  readonly provider?: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly dependsOn?: ReadonlyArray<string>;
  readonly location: FileLocation;
}

// ============================================================================
// Helm Fixture Types
// ============================================================================

/**
 * Helm fixture configuration
 */
export interface HelmFixture {
  /** Fixture name/identifier */
  readonly name: string;
  /** Directory path relative to fixtures/repos */
  readonly path: string;
  /** Chart.yaml path */
  readonly chartFile: string;
  /** Values files */
  readonly valuesFiles: ReadonlyArray<string>;
  /** Template files */
  readonly templateFiles: ReadonlyArray<string>;
  /** Expected node count after parsing */
  readonly expectedNodeCount: number;
  /** Description of what this fixture tests */
  readonly description: string;
  /** Tags for categorizing fixtures */
  readonly tags: ReadonlyArray<HelmFixtureTag>;
  /** Chart metadata */
  readonly chart: HelmChartMetadata;
  /** Dependencies */
  readonly dependencies: ReadonlyArray<HelmDependency>;
}

/**
 * Helm fixture tags
 */
export type HelmFixtureTag =
  | 'simple'
  | 'complex'
  | 'dependencies'
  | 'subcharts'
  | 'library'
  | 'hooks'
  | 'tests'
  | 'crds'
  | 'operators';

/**
 * Helm chart metadata
 */
export interface HelmChartMetadata {
  readonly apiVersion: 'v1' | 'v2';
  readonly name: string;
  readonly version: string;
  readonly appVersion?: string;
  readonly description?: string;
  readonly type?: 'application' | 'library';
  readonly keywords?: ReadonlyArray<string>;
  readonly home?: string;
  readonly sources?: ReadonlyArray<string>;
  readonly maintainers?: ReadonlyArray<HelmMaintainer>;
}

/**
 * Helm maintainer
 */
export interface HelmMaintainer {
  readonly name: string;
  readonly email?: string;
  readonly url?: string;
}

/**
 * Helm dependency
 */
export interface HelmDependency {
  readonly name: string;
  readonly version: string;
  readonly repository: string;
  readonly condition?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly enabled?: boolean;
  readonly alias?: string;
}

/**
 * Helm template fixture
 */
export interface HelmTemplateFixture {
  readonly name: string;
  readonly path: string;
  readonly kind: string;
  readonly apiVersion: string;
  readonly content: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly location: FileLocation;
}

/**
 * Helm values fixture
 */
export interface HelmValuesFixture {
  readonly name: string;
  readonly path: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly isDefault: boolean;
  readonly environment?: string;
}

// ============================================================================
// User Fixture Types
// ============================================================================

/**
 * User fixture configuration
 */
export interface UserFixture {
  /** User ID */
  readonly userId: string;
  /** Email address */
  readonly email: string;
  /** Display name */
  readonly name: string;
  /** GitHub ID */
  readonly githubId: number;
  /** Avatar URL */
  readonly avatarUrl?: string;
  /** Associated tenant ID */
  readonly tenantId: TenantId;
  /** User roles */
  readonly roles: ReadonlyArray<UserRole>;
  /** User permissions */
  readonly permissions: ReadonlyArray<Permission>;
  /** User settings */
  readonly settings: UserSettings;
  /** Whether user is active */
  readonly isActive: boolean;
  /** Created date */
  readonly createdAt: Date;
}

/**
 * User role
 */
export type UserRole = 'admin' | 'owner' | 'member' | 'viewer' | 'guest';

/**
 * User permission
 */
export type Permission =
  | 'repository:read'
  | 'repository:write'
  | 'repository:delete'
  | 'scan:create'
  | 'scan:read'
  | 'scan:cancel'
  | 'rollup:create'
  | 'rollup:read'
  | 'rollup:execute'
  | 'rollup:delete'
  | 'settings:read'
  | 'settings:write'
  | 'users:read'
  | 'users:invite'
  | 'users:remove'
  | 'api-keys:create'
  | 'api-keys:revoke';

/**
 * User settings
 */
export interface UserSettings {
  readonly theme: 'light' | 'dark' | 'system';
  readonly language: string;
  readonly notifications: NotificationSettings;
  readonly defaultView: 'grid' | 'list' | 'graph';
  readonly timezone: string;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  readonly email: boolean;
  readonly scanComplete: boolean;
  readonly scanFailed: boolean;
  readonly weeklyDigest: boolean;
  readonly securityAlerts: boolean;
}

/**
 * Tenant fixture configuration
 */
export interface TenantFixture {
  /** Tenant ID */
  readonly id: TenantId;
  /** Tenant name */
  readonly name: string;
  /** Tenant slug */
  readonly slug: string;
  /** Subscription plan */
  readonly plan: TenantPlan;
  /** Owner user fixture name */
  readonly ownerFixture: string;
  /** Member user fixture names */
  readonly memberFixtures: ReadonlyArray<string>;
  /** Tenant settings */
  readonly settings: TenantSettings;
  /** Usage limits */
  readonly limits: TenantLimits;
  /** Whether tenant is active */
  readonly isActive: boolean;
}

/**
 * Tenant plan type
 */
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

/**
 * Tenant settings
 */
export interface TenantSettings {
  readonly webhookUrl?: string;
  readonly slackWebhookUrl?: string;
  readonly emailNotifications: boolean;
  readonly autoScanOnPush: boolean;
  readonly defaultBranch: string;
  readonly requireApproval: boolean;
}

/**
 * Tenant limits
 */
export interface TenantLimits {
  readonly maxRepositories: number;
  readonly maxScansPerMonth: number;
  readonly maxApiRequestsPerHour: number;
  readonly maxConcurrentScans: number;
  readonly maxNodesPerScan: number;
  readonly retentionDays: number;
}

// ============================================================================
// Graph Fixture Types
// ============================================================================

/**
 * Graph fixture configuration
 */
export interface GraphFixture {
  /** Fixture name */
  readonly name: string;
  /** Description */
  readonly description: string;
  /** Nodes in the graph */
  readonly nodes: ReadonlyArray<GraphNodeFixture>;
  /** Edges in the graph */
  readonly edges: ReadonlyArray<GraphEdgeFixture>;
  /** Expected properties */
  readonly expectations: GraphExpectations;
  /** Tags for categorizing */
  readonly tags: ReadonlyArray<GraphFixtureTag>;
}

/**
 * Graph fixture tags
 */
export type GraphFixtureTag =
  | 'simple'
  | 'complex'
  | 'cyclic'
  | 'acyclic'
  | 'sparse'
  | 'dense'
  | 'tree'
  | 'dag'
  | 'cross-reference'
  | 'multi-file';

/**
 * Graph node fixture
 */
export interface GraphNodeFixture {
  /** Unique node identifier */
  readonly id: string;
  /** Node type */
  readonly type: NodeType;
  /** Node name */
  readonly name: string;
  /** Fully qualified name */
  readonly qualifiedName: string;
  /** Source file path */
  readonly filePath: string;
  /** Start line number */
  readonly lineStart: number;
  /** End line number */
  readonly lineEnd: number;
  /** Start column (optional) */
  readonly columnStart?: number;
  /** End column (optional) */
  readonly columnEnd?: number;
  /** Node metadata */
  readonly metadata: NodeMetadata;
  /** Tags for filtering */
  readonly tags?: ReadonlyArray<string>;
}

/**
 * Node type enumeration
 */
export type NodeType =
  // Terraform nodes
  | 'tf_resource'
  | 'tf_data_source'
  | 'tf_variable'
  | 'tf_output'
  | 'tf_local'
  | 'tf_module'
  | 'tf_provider'
  // Kubernetes nodes
  | 'k8s_deployment'
  | 'k8s_service'
  | 'k8s_configmap'
  | 'k8s_secret'
  | 'k8s_ingress'
  | 'k8s_namespace'
  | 'k8s_serviceaccount'
  | 'k8s_role'
  | 'k8s_rolebinding'
  | 'k8s_pvc'
  // Helm nodes
  | 'helm_chart'
  | 'helm_release'
  | 'helm_values'
  | 'helm_template'
  // Generic
  | 'external'
  | 'unknown';

/**
 * Node metadata
 */
export interface NodeMetadata {
  /** AWS ARN (if applicable) */
  readonly arn?: string;
  /** Resource ID */
  readonly resourceId?: string;
  /** Resource type */
  readonly resourceType?: string;
  /** Provider */
  readonly provider?: string;
  /** Namespace */
  readonly namespace?: string;
  /** Labels */
  readonly labels?: Readonly<Record<string, string>>;
  /** Tags */
  readonly tags?: Readonly<Record<string, string>>;
  /** Annotations */
  readonly annotations?: Readonly<Record<string, string>>;
  /** Custom metadata */
  readonly custom?: Readonly<Record<string, unknown>>;
}

/**
 * Graph edge fixture
 */
export interface GraphEdgeFixture {
  /** Unique edge identifier */
  readonly id: string;
  /** Source node ID */
  readonly sourceNodeId: string;
  /** Target node ID */
  readonly targetNodeId: string;
  /** Edge type */
  readonly type: EdgeType;
  /** Edge label */
  readonly label?: string;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Whether edge is implicit */
  readonly isImplicit: boolean;
  /** Evidence for the edge */
  readonly evidence: EdgeEvidence;
  /** Edge metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Edge type enumeration
 */
export type EdgeType =
  | 'depends_on'
  | 'references'
  | 'creates'
  | 'uses'
  | 'inherits'
  | 'contains'
  | 'calls'
  | 'configures'
  | 'mounts'
  | 'exposes'
  | 'imports'
  | 'exports';

/**
 * Edge evidence
 */
export interface EdgeEvidence {
  /** Source file path */
  readonly sourceFile: string;
  /** Target file path */
  readonly targetFile: string;
  /** Expression that creates the reference */
  readonly expression: string;
  /** Line number in source */
  readonly sourceLine?: number;
  /** Attribute being referenced */
  readonly attribute?: string;
  /** How the reference was detected */
  readonly detectionMethod: DetectionMethod;
  /** Additional evidence details */
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Detection method
 */
export type DetectionMethod =
  | 'explicit_reference'
  | 'implicit_reference'
  | 'depends_on_block'
  | 'interpolation'
  | 'provider_alias'
  | 'module_source'
  | 'data_source'
  | 'local_value'
  | 'name_matching'
  | 'arn_matching'
  | 'tag_matching';

/**
 * Graph expectations
 */
export interface GraphExpectations {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodeTypes: ReadonlyArray<NodeType>;
  readonly edgeTypes: ReadonlyArray<EdgeType>;
  readonly isAcyclic: boolean;
  readonly connectedComponents: number;
  readonly maxDepth: number;
  readonly density: number;
}

// ============================================================================
// Repository Fixture Types
// ============================================================================

/**
 * Repository fixture configuration
 */
export interface RepositoryFixture {
  /** Repository ID */
  readonly id: RepositoryId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Git provider */
  readonly provider: GitProvider;
  /** Provider repository ID */
  readonly providerId: string;
  /** Repository owner */
  readonly owner: string;
  /** Repository name */
  readonly name: string;
  /** Full name (owner/name) */
  readonly fullName: string;
  /** Clone URL */
  readonly cloneUrl: string;
  /** Web URL */
  readonly htmlUrl: string;
  /** Default branch */
  readonly defaultBranch: string;
  /** Description */
  readonly description?: string;
  /** Whether private */
  readonly isPrivate: boolean;
  /** Whether archived */
  readonly isArchived: boolean;
  /** Associated fixture path */
  readonly fixturePath?: string;
  /** Language distribution */
  readonly languages?: Readonly<Record<string, number>>;
  /** Topics/tags */
  readonly topics?: ReadonlyArray<string>;
}

/**
 * Scan fixture configuration
 */
export interface ScanFixture {
  /** Scan ID */
  readonly id: ScanId;
  /** Repository ID */
  readonly repositoryId: RepositoryId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** User who initiated scan */
  readonly initiatedBy: UserId;
  /** Commit SHA */
  readonly commitSha: string;
  /** Branch name */
  readonly branch: string;
  /** Scan status */
  readonly status: ScanStatus;
  /** Node count */
  readonly nodeCount: number;
  /** Edge count */
  readonly edgeCount: number;
  /** Files analyzed */
  readonly filesAnalyzed: number;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Error message (if failed) */
  readonly errorMessage?: string;
  /** Warnings */
  readonly warnings: ReadonlyArray<string>;
  /** Created date */
  readonly createdAt: Date;
  /** Completed date */
  readonly completedAt?: Date;
}

// ============================================================================
// Common Types
// ============================================================================

/**
 * File location
 */
export interface FileLocation {
  readonly file: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly columnStart?: number;
  readonly columnEnd?: number;
}

/**
 * Loaded fixture with content
 */
export interface LoadedFixture<T> {
  /** Fixture configuration */
  readonly config: T;
  /** Loaded file contents */
  readonly files: ReadonlyMap<string, string>;
  /** Base directory path */
  readonly basePath: string;
  /** Load time */
  readonly loadedAt: Date;
}

// ============================================================================
// Fixture Factory Types
// ============================================================================

/**
 * Fixture generation options
 */
export interface FixtureGenerationOptions {
  /** Number of items to generate */
  readonly count?: number;
  /** Random seed for reproducibility */
  readonly seed?: number;
  /** Density for graph generation (0-1) */
  readonly density?: number;
  /** Tags to apply */
  readonly tags?: ReadonlyArray<string>;
  /** Custom overrides */
  readonly overrides?: Readonly<Record<string, unknown>>;
}

/**
 * Graph generation options
 */
export interface GraphGenerationOptions extends FixtureGenerationOptions {
  /** Node count */
  readonly nodeCount: number;
  /** Edge density (0-1) */
  readonly edgeDensity: number;
  /** Node types to include */
  readonly nodeTypes?: ReadonlyArray<NodeType>;
  /** Edge types to include */
  readonly edgeTypes?: ReadonlyArray<EdgeType>;
  /** Whether to allow cycles */
  readonly allowCycles?: boolean;
  /** Maximum edge confidence */
  readonly maxConfidence?: number;
  /** Minimum edge confidence */
  readonly minConfidence?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TerraformFixture
 */
export function isTerraformFixture(value: unknown): value is TerraformFixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'path' in value &&
    'mainFiles' in value &&
    'expectedNodeCount' in value
  );
}

/**
 * Type guard for HelmFixture
 */
export function isHelmFixture(value: unknown): value is HelmFixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'path' in value &&
    'chartFile' in value &&
    'chart' in value
  );
}

/**
 * Type guard for UserFixture
 */
export function isUserFixture(value: unknown): value is UserFixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    'email' in value &&
    'githubId' in value &&
    'tenantId' in value
  );
}

/**
 * Type guard for GraphNodeFixture
 */
export function isGraphNodeFixture(value: unknown): value is GraphNodeFixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'name' in value &&
    'filePath' in value &&
    'lineStart' in value
  );
}

/**
 * Type guard for GraphEdgeFixture
 */
export function isGraphEdgeFixture(value: unknown): value is GraphEdgeFixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'sourceNodeId' in value &&
    'targetNodeId' in value &&
    'type' in value &&
    'confidence' in value
  );
}

/**
 * Type guard for NodeType
 */
export function isNodeType(value: unknown): value is NodeType {
  const validTypes: NodeType[] = [
    'tf_resource', 'tf_data_source', 'tf_variable', 'tf_output', 'tf_local', 'tf_module', 'tf_provider',
    'k8s_deployment', 'k8s_service', 'k8s_configmap', 'k8s_secret', 'k8s_ingress',
    'k8s_namespace', 'k8s_serviceaccount', 'k8s_role', 'k8s_rolebinding', 'k8s_pvc',
    'helm_chart', 'helm_release', 'helm_values', 'helm_template',
    'external', 'unknown'
  ];
  return typeof value === 'string' && validTypes.includes(value as NodeType);
}

/**
 * Type guard for EdgeType
 */
export function isEdgeType(value: unknown): value is EdgeType {
  const validTypes: EdgeType[] = [
    'depends_on', 'references', 'creates', 'uses', 'inherits',
    'contains', 'calls', 'configures', 'mounts', 'exposes',
    'imports', 'exports'
  ];
  return typeof value === 'string' && validTypes.includes(value as EdgeType);
}
