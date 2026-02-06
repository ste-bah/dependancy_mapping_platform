/**
 * Database Entity Type Definitions
 * @module types/entities
 *
 * Type definitions for database entities including scans, repositories, and tenants.
 * Provides branded types for type-safe IDs and complete entity representations.
 *
 * Follows the established patterns from auth.ts and api-key.ts for TypeBox schemas.
 */

import { Type, Static } from '@sinclair/typebox';
import { NodeTypeName, EdgeType } from './graph';

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Branded type for Scan IDs
 * @example
 * const scanId = 'scan_01HXYZ...' as ScanId;
 */
export type ScanId = string & { readonly __brand: 'ScanId' };

/**
 * Branded type for Node IDs in database
 * @example
 * const nodeId = 'node_01HXYZ...' as DbNodeId;
 */
export type DbNodeId = string & { readonly __brand: 'DbNodeId' };

/**
 * Branded type for Edge IDs in database
 * @example
 * const edgeId = 'edge_01HXYZ...' as DbEdgeId;
 */
export type DbEdgeId = string & { readonly __brand: 'DbEdgeId' };

/**
 * Branded type for Repository IDs
 * @example
 * const repoId = 'repo_01HXYZ...' as RepositoryId;
 */
export type RepositoryId = string & { readonly __brand: 'RepositoryId' };

/**
 * Branded type for Tenant IDs
 * @example
 * const tenantId = 'tenant_01HXYZ...' as TenantId;
 */
export type TenantId = string & { readonly __brand: 'TenantId' };

/**
 * Branded type for User IDs
 * @example
 * const userId = 'user_01HXYZ...' as UserId;
 */
export type UserId = string & { readonly __brand: 'UserId' };

// ============================================================================
// Scan Status Types
// ============================================================================

/**
 * Scan status enum
 */
export const ScanStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type ScanStatus = typeof ScanStatus[keyof typeof ScanStatus];

/**
 * Scan status TypeBox schema
 */
export const ScanStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('queued'),
  Type.Literal('running'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
]);

// ============================================================================
// Scan Entity
// ============================================================================

/**
 * Scan configuration options
 */
export interface ScanConfig {
  /** Types of IaC to detect */
  readonly detectTypes: readonly ('terraform' | 'kubernetes' | 'helm' | 'cloudformation')[];
  /** Include implicit dependencies */
  readonly includeImplicit: boolean;
  /** Minimum confidence threshold */
  readonly minConfidence: number;
  /** Maximum depth for module traversal */
  readonly maxDepth: number;
  /** File patterns to include */
  readonly includePatterns: readonly string[];
  /** File patterns to exclude */
  readonly excludePatterns: readonly string[];
  /** Whether to analyze Helm charts */
  readonly analyzeHelmCharts: boolean;
  /** Whether to resolve remote modules */
  readonly resolveRemoteModules: boolean;
}

/**
 * Default scan configuration
 */
export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  detectTypes: ['terraform', 'kubernetes', 'helm'],
  includeImplicit: true,
  minConfidence: 40,
  maxDepth: 10,
  includePatterns: ['**/*.tf', '**/*.yaml', '**/*.yml', '**/Chart.yaml'],
  excludePatterns: ['**/node_modules/**', '**/.git/**', '**/vendor/**'],
  analyzeHelmCharts: true,
  resolveRemoteModules: false,
};

/**
 * Scan progress information
 */
export interface ScanProgress {
  /** Current phase */
  readonly phase: ScanPhase;
  /** Percentage complete (0-100) */
  readonly percentage: number;
  /** Files processed */
  readonly filesProcessed: number;
  /** Total files to process */
  readonly totalFiles: number;
  /** Current file being processed */
  readonly currentFile?: string;
  /** Nodes detected so far */
  readonly nodesDetected: number;
  /** Edges detected so far */
  readonly edgesDetected: number;
  /** Errors encountered */
  readonly errors: number;
  /** Warnings encountered */
  readonly warnings: number;
}

/**
 * Scan phases
 */
export type ScanPhase =
  | 'initializing'
  | 'cloning'
  | 'discovering'
  | 'parsing'
  | 'detecting'
  | 'building_graph'
  | 'storing'
  | 'completed'
  | 'failed';

/**
 * Scan result summary
 */
export interface ScanResultSummary {
  /** Total nodes detected */
  readonly totalNodes: number;
  /** Total edges detected */
  readonly totalEdges: number;
  /** Node counts by type */
  readonly nodesByType: Record<string, number>;
  /** Edge counts by type */
  readonly edgesByType: Record<string, number>;
  /** Files analyzed */
  readonly filesAnalyzed: number;
  /** Errors encountered */
  readonly errors: readonly ScanError[];
  /** Warnings encountered */
  readonly warnings: readonly ScanWarning[];
  /** Confidence distribution */
  readonly confidenceDistribution: ConfidenceDistribution;
}

/**
 * Scan error
 */
export interface ScanError {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly recoverable: boolean;
}

/**
 * Scan warning
 */
export interface ScanWarning {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
}

/**
 * Confidence distribution
 */
export interface ConfidenceDistribution {
  readonly certain: number;   // 95-100
  readonly high: number;      // 80-94
  readonly medium: number;    // 60-79
  readonly low: number;       // 40-59
  readonly uncertain: number; // 0-39
}

/**
 * Scan entity (database representation)
 */
export interface ScanEntity {
  /** Unique scan ID */
  readonly id: ScanId;
  /** Tenant ID (multi-tenancy) */
  readonly tenantId: TenantId;
  /** Repository ID */
  readonly repositoryId: RepositoryId;
  /** User who initiated the scan */
  readonly initiatedBy: UserId;
  /** Scan status */
  readonly status: ScanStatus;
  /** Scan configuration */
  readonly config: ScanConfig;
  /** Branch/ref scanned */
  readonly ref: string;
  /** Commit SHA */
  readonly commitSha: string;
  /** Scan progress */
  readonly progress: ScanProgress;
  /** Result summary (when completed) */
  readonly resultSummary?: ScanResultSummary;
  /** Error message (when failed) */
  readonly errorMessage?: string;
  /** Start time */
  readonly startedAt?: Date;
  /** End time */
  readonly completedAt?: Date;
  /** Creation time */
  readonly createdAt: Date;
  /** Last update time */
  readonly updatedAt: Date;
}

/**
 * Scan entity TypeBox schema
 */
export const ScanEntitySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  tenantId: Type.String({ format: 'uuid' }),
  repositoryId: Type.String({ format: 'uuid' }),
  initiatedBy: Type.String({ format: 'uuid' }),
  status: ScanStatusSchema,
  config: Type.Object({
    detectTypes: Type.Array(Type.String()),
    includeImplicit: Type.Boolean(),
    minConfidence: Type.Number({ minimum: 0, maximum: 100 }),
    maxDepth: Type.Number({ minimum: 1 }),
    includePatterns: Type.Array(Type.String()),
    excludePatterns: Type.Array(Type.String()),
    analyzeHelmCharts: Type.Boolean(),
    resolveRemoteModules: Type.Boolean(),
  }),
  ref: Type.String(),
  commitSha: Type.String(),
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type ScanEntityDTO = Static<typeof ScanEntitySchema>;

// ============================================================================
// Repository Entity
// ============================================================================

/**
 * Git provider type
 */
export const GitProvider = {
  GITHUB: 'github',
  GITLAB: 'gitlab',
  BITBUCKET: 'bitbucket',
  AZURE_DEVOPS: 'azure_devops',
} as const;

export type GitProvider = typeof GitProvider[keyof typeof GitProvider];

/**
 * Repository entity (database representation)
 */
export interface RepositoryEntity {
  /** Unique repository ID */
  readonly id: RepositoryId;
  /** Tenant ID (multi-tenancy) */
  readonly tenantId: TenantId;
  /** Git provider */
  readonly provider: GitProvider;
  /** Provider's repository ID */
  readonly providerId: string;
  /** Repository owner/org */
  readonly owner: string;
  /** Repository name */
  readonly name: string;
  /** Full name (owner/name) */
  readonly fullName: string;
  /** Default branch */
  readonly defaultBranch: string;
  /** Clone URL */
  readonly cloneUrl: string;
  /** Web URL */
  readonly htmlUrl: string;
  /** Description */
  readonly description?: string;
  /** Whether private */
  readonly isPrivate: boolean;
  /** Whether archived */
  readonly isArchived: boolean;
  /** Last scan ID */
  readonly lastScanId?: ScanId;
  /** Last scan status */
  readonly lastScanStatus?: ScanStatus;
  /** Last scanned at */
  readonly lastScannedAt?: Date;
  /** Webhook ID (if registered) */
  readonly webhookId?: string;
  /** Webhook secret */
  readonly webhookSecret?: string;
  /** Creation time */
  readonly createdAt: Date;
  /** Last update time */
  readonly updatedAt: Date;
}

/**
 * Repository entity TypeBox schema
 */
export const RepositoryEntitySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  tenantId: Type.String({ format: 'uuid' }),
  provider: Type.Union([
    Type.Literal('github'),
    Type.Literal('gitlab'),
    Type.Literal('bitbucket'),
    Type.Literal('azure_devops'),
  ]),
  providerId: Type.String(),
  owner: Type.String(),
  name: Type.String(),
  fullName: Type.String(),
  defaultBranch: Type.String(),
  cloneUrl: Type.String({ format: 'uri' }),
  htmlUrl: Type.String({ format: 'uri' }),
  description: Type.Optional(Type.String()),
  isPrivate: Type.Boolean(),
  isArchived: Type.Boolean(),
  lastScanId: Type.Optional(Type.String({ format: 'uuid' })),
  lastScanStatus: Type.Optional(ScanStatusSchema),
  lastScannedAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type RepositoryEntityDTO = Static<typeof RepositoryEntitySchema>;

// ============================================================================
// Tenant Entity
// ============================================================================

/**
 * Tenant plan type
 */
export const TenantPlan = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type TenantPlan = typeof TenantPlan[keyof typeof TenantPlan];

/**
 * Tenant entity (database representation)
 */
export interface TenantEntity {
  /** Unique tenant ID */
  readonly id: TenantId;
  /** Tenant name */
  readonly name: string;
  /** Tenant slug (URL-safe) */
  readonly slug: string;
  /** Subscription plan */
  readonly plan: TenantPlan;
  /** Owner user ID */
  readonly ownerId: UserId;
  /** Settings */
  readonly settings: TenantSettings;
  /** Usage limits */
  readonly limits: TenantLimits;
  /** Current usage */
  readonly usage: TenantUsage;
  /** Whether active */
  readonly isActive: boolean;
  /** Trial end date */
  readonly trialEndsAt?: Date;
  /** Subscription ID (Stripe) */
  readonly subscriptionId?: string;
  /** Creation time */
  readonly createdAt: Date;
  /** Last update time */
  readonly updatedAt: Date;
}

/**
 * Tenant settings
 */
export interface TenantSettings {
  /** Default scan configuration */
  readonly defaultScanConfig: Partial<ScanConfig>;
  /** Webhook URL for notifications */
  readonly webhookUrl?: string;
  /** Slack integration */
  readonly slackWebhookUrl?: string;
  /** Email notifications */
  readonly emailNotifications: boolean;
  /** Auto-scan on push */
  readonly autoScanOnPush: boolean;
}

/**
 * Tenant usage limits
 */
export interface TenantLimits {
  /** Max repositories */
  readonly maxRepositories: number;
  /** Max scans per month */
  readonly maxScansPerMonth: number;
  /** Max API requests per hour */
  readonly maxApiRequestsPerHour: number;
  /** Max concurrent scans */
  readonly maxConcurrentScans: number;
  /** Max nodes per scan */
  readonly maxNodesPerScan: number;
  /** Retention days */
  readonly retentionDays: number;
}

/**
 * Tenant usage tracking
 */
export interface TenantUsage {
  /** Current repository count */
  readonly repositoryCount: number;
  /** Scans this month */
  readonly scansThisMonth: number;
  /** API requests this hour */
  readonly apiRequestsThisHour: number;
  /** Current concurrent scans */
  readonly currentConcurrentScans: number;
  /** Total nodes stored */
  readonly totalNodesStored: number;
  /** Total edges stored */
  readonly totalEdgesStored: number;
  /** Storage used (bytes) */
  readonly storageUsedBytes: number;
}

/**
 * Default tenant limits by plan
 */
export const DEFAULT_TENANT_LIMITS: Record<TenantPlan, TenantLimits> = {
  free: {
    maxRepositories: 3,
    maxScansPerMonth: 10,
    maxApiRequestsPerHour: 100,
    maxConcurrentScans: 1,
    maxNodesPerScan: 1000,
    retentionDays: 7,
  },
  starter: {
    maxRepositories: 10,
    maxScansPerMonth: 50,
    maxApiRequestsPerHour: 500,
    maxConcurrentScans: 2,
    maxNodesPerScan: 5000,
    retentionDays: 30,
  },
  professional: {
    maxRepositories: 50,
    maxScansPerMonth: 200,
    maxApiRequestsPerHour: 2000,
    maxConcurrentScans: 5,
    maxNodesPerScan: 20000,
    retentionDays: 90,
  },
  enterprise: {
    maxRepositories: -1, // unlimited
    maxScansPerMonth: -1,
    maxApiRequestsPerHour: 10000,
    maxConcurrentScans: 20,
    maxNodesPerScan: -1,
    retentionDays: 365,
  },
};

// ============================================================================
// Node Entity (Database Representation)
// ============================================================================

/**
 * Node entity for database storage
 */
export interface NodeEntity {
  /** Database node ID */
  readonly id: DbNodeId;
  /** Scan ID this node belongs to */
  readonly scanId: ScanId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Original node ID from detection */
  readonly originalId: string;
  /** Node type */
  readonly nodeType: NodeTypeName;
  /** Node name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** Line start */
  readonly lineStart: number;
  /** Line end */
  readonly lineEnd: number;
  /** Column start */
  readonly columnStart?: number;
  /** Column end */
  readonly columnEnd?: number;
  /** Node metadata (JSON) */
  readonly metadata: Record<string, unknown>;
  /** Creation time */
  readonly createdAt: Date;
}

/**
 * Node entity TypeBox schema
 */
export const NodeEntitySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  scanId: Type.String({ format: 'uuid' }),
  tenantId: Type.String({ format: 'uuid' }),
  originalId: Type.String(),
  nodeType: Type.String(),
  name: Type.String(),
  filePath: Type.String(),
  lineStart: Type.Number({ minimum: 1 }),
  lineEnd: Type.Number({ minimum: 1 }),
  columnStart: Type.Optional(Type.Number({ minimum: 0 })),
  columnEnd: Type.Optional(Type.Number({ minimum: 0 })),
  metadata: Type.Record(Type.String(), Type.Unknown()),
  createdAt: Type.String({ format: 'date-time' }),
});

export type NodeEntityDTO = Static<typeof NodeEntitySchema>;

// ============================================================================
// Edge Entity (Database Representation)
// ============================================================================

/**
 * Edge entity for database storage
 */
export interface EdgeEntity {
  /** Database edge ID */
  readonly id: DbEdgeId;
  /** Scan ID this edge belongs to */
  readonly scanId: ScanId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Original edge ID from detection */
  readonly originalId: string;
  /** Source node ID (database) */
  readonly sourceNodeId: DbNodeId;
  /** Target node ID (database) */
  readonly targetNodeId: DbNodeId;
  /** Edge type */
  readonly edgeType: EdgeType;
  /** Edge label */
  readonly label?: string;
  /** Whether implicit */
  readonly isImplicit: boolean;
  /** Confidence score (0-100) */
  readonly confidence: number;
  /** Referenced attribute */
  readonly attribute?: string;
  /** Edge metadata (JSON) */
  readonly metadata: Record<string, unknown>;
  /** Creation time */
  readonly createdAt: Date;
}

/**
 * Edge entity TypeBox schema
 */
export const EdgeEntitySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  scanId: Type.String({ format: 'uuid' }),
  tenantId: Type.String({ format: 'uuid' }),
  originalId: Type.String(),
  sourceNodeId: Type.String({ format: 'uuid' }),
  targetNodeId: Type.String({ format: 'uuid' }),
  edgeType: Type.String(),
  label: Type.Optional(Type.String()),
  isImplicit: Type.Boolean(),
  confidence: Type.Number({ minimum: 0, maximum: 100 }),
  attribute: Type.Optional(Type.String()),
  metadata: Type.Record(Type.String(), Type.Unknown()),
  createdAt: Type.String({ format: 'date-time' }),
});

export type EdgeEntityDTO = Static<typeof EdgeEntitySchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ScanEntity
 */
export function isScanEntity(value: unknown): value is ScanEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'tenantId' in value &&
    'repositoryId' in value &&
    'status' in value
  );
}

/**
 * Type guard for RepositoryEntity
 */
export function isRepositoryEntity(value: unknown): value is RepositoryEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'tenantId' in value &&
    'provider' in value &&
    'owner' in value &&
    'name' in value
  );
}

/**
 * Type guard for TenantEntity
 */
export function isTenantEntity(value: unknown): value is TenantEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'plan' in value
  );
}

/**
 * Type guard for NodeEntity
 */
export function isNodeEntity(value: unknown): value is NodeEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'scanId' in value &&
    'nodeType' in value
  );
}

/**
 * Type guard for EdgeEntity
 */
export function isEdgeEntity(value: unknown): value is EdgeEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'scanId' in value &&
    'edgeType' in value &&
    'sourceNodeId' in value &&
    'targetNodeId' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ScanId
 */
export function createScanId(id: string): ScanId {
  return id as ScanId;
}

/**
 * Create a DbNodeId
 */
export function createDbNodeId(id: string): DbNodeId {
  return id as DbNodeId;
}

/**
 * Create a DbEdgeId
 */
export function createDbEdgeId(id: string): DbEdgeId {
  return id as DbEdgeId;
}

/**
 * Create a RepositoryId
 */
export function createRepositoryId(id: string): RepositoryId {
  return id as RepositoryId;
}

/**
 * Create a TenantId
 */
export function createTenantId(id: string): TenantId {
  return id as TenantId;
}

/**
 * Create a UserId
 */
export function createUserId(id: string): UserId {
  return id as UserId;
}

/**
 * Create empty scan progress
 */
export function createEmptyScanProgress(): ScanProgress {
  return {
    phase: 'initializing',
    percentage: 0,
    filesProcessed: 0,
    totalFiles: 0,
    nodesDetected: 0,
    edgesDetected: 0,
    errors: 0,
    warnings: 0,
  };
}

/**
 * Create empty confidence distribution
 */
export function createEmptyConfidenceDistribution(): ConfidenceDistribution {
  return {
    certain: 0,
    high: 0,
    medium: 0,
    low: 0,
    uncertain: 0,
  };
}

/**
 * Create empty tenant usage
 */
export function createEmptyTenantUsage(): TenantUsage {
  return {
    repositoryCount: 0,
    scansThisMonth: 0,
    apiRequestsThisHour: 0,
    currentConcurrentScans: 0,
    totalNodesStored: 0,
    totalEdgesStored: 0,
    storageUsedBytes: 0,
  };
}
