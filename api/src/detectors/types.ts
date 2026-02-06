/**
 * Detector Type Definitions
 * @module detectors/types
 *
 * Type definitions for dependency detection across IaC resources.
 * Implements TASK-DETECT-002, 003, 004: Resource references, data sources, module dependencies.
 *
 * TASK-DETECT-002: Resource reference detection types
 * TASK-DETECT-003: Data source dependency detection types
 * TASK-DETECT-004: Module dependency detection types
 */

import { NodeLocation, EdgeType } from '../types/graph';
import { EvidenceType, EvidenceCategory, ConfidenceLevel } from '../types/evidence';

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Branded type for reference IDs
 * @example
 * const refId = 'ref-aws_instance-web-id' as ReferenceId;
 */
export type ReferenceId = string & { readonly __brand: 'ReferenceId' };

/**
 * Branded type for data source IDs
 * @example
 * const dsId = 'data.aws_ami.ubuntu' as DataSourceId;
 */
export type DataSourceId = string & { readonly __brand: 'DataSourceId' };

/**
 * Branded type for module call IDs
 * @example
 * const moduleId = 'module.vpc' as ModuleCallId;
 */
export type ModuleCallId = string & { readonly __brand: 'ModuleCallId' };

// ============================================================================
// Resource Reference Types (TASK-DETECT-002)
// ============================================================================

/**
 * Types of resource references that can be detected
 */
export type ResourceReferenceType =
  | 'attribute'      // aws_instance.web.id
  | 'whole'          // aws_instance.web
  | 'splat'          // aws_instance.web[*].id
  | 'index'          // aws_instance.web[0].id
  | 'for_each_key'   // aws_instance.web["key"].id
  | 'count'          // aws_instance.web.*.id
  | 'module_output'  // module.vpc.vpc_id
  | 'data_source'    // data.aws_ami.ubuntu.id
  | 'variable'       // var.instance_type
  | 'local'          // local.common_tags
  | 'terraform'      // terraform.workspace
  | 'path'           // path.module
  | 'provider';      // provider["aws.us-west-2"]

/**
 * Resource reference detected in IaC code
 */
export interface ResourceReference {
  /** Unique reference ID */
  readonly id: ReferenceId;
  /** Reference type */
  readonly type: ResourceReferenceType;
  /** Source node ID (where reference occurs) */
  readonly sourceId: string;
  /** Target node ID (what is being referenced) */
  readonly targetId: string;
  /** Full reference expression */
  readonly expression: string;
  /** Parsed reference parts */
  readonly parts: ResourceReferenceParts;
  /** Attribute being accessed (if any) */
  readonly attribute?: string;
  /** Index expression (if any) */
  readonly indexExpression?: string;
  /** Source location */
  readonly location: NodeLocation;
  /** Detection confidence */
  readonly confidence: number;
  /** Evidence supporting detection */
  readonly evidence: ReferenceEvidence[];
}

/**
 * Parsed parts of a resource reference
 */
export interface ResourceReferenceParts {
  /** Resource/data/module/var prefix */
  readonly prefix: string;
  /** Resource type (for resources/data) */
  readonly resourceType?: string;
  /** Resource name */
  readonly name: string;
  /** Attribute chain */
  readonly attributes: readonly string[];
  /** Index (numeric or key) */
  readonly index?: string | number;
  /** Whether splat operator is used */
  readonly isSplat: boolean;
}

/**
 * Evidence for a resource reference
 */
export interface ReferenceEvidence {
  readonly type: EvidenceType;
  readonly category: EvidenceCategory;
  readonly description: string;
  readonly confidence: number;
  readonly location?: NodeLocation;
}

/**
 * Reference resolution result
 */
export interface ReferenceResolution {
  /** Whether reference was resolved */
  readonly resolved: boolean;
  /** Resolved target node ID */
  readonly targetNodeId?: string;
  /** Resolved attribute value (if available) */
  readonly resolvedValue?: unknown;
  /** Resolution errors */
  readonly errors: ReferenceResolutionError[];
  /** Resolution path taken */
  readonly resolutionPath: readonly string[];
}

/**
 * Reference resolution error
 */
export interface ReferenceResolutionError {
  readonly code: ReferenceErrorCode;
  readonly message: string;
  readonly reference: string;
}

/**
 * Reference error codes
 */
export type ReferenceErrorCode =
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'CIRCULAR'
  | 'INVALID_ATTRIBUTE'
  | 'INVALID_INDEX'
  | 'TYPE_MISMATCH'
  | 'SCOPE_ERROR'
  | 'UNRESOLVED_VARIABLE'
  | 'UNKNOWN';

// ============================================================================
// Cross-Reference Resolution Types
// ============================================================================

/**
 * Cross-reference between resources across files/modules
 */
export interface CrossReference {
  /** Reference ID */
  readonly id: ReferenceId;
  /** Source file path */
  readonly sourceFile: string;
  /** Source module path (if in module) */
  readonly sourceModule?: string;
  /** Target file path */
  readonly targetFile: string;
  /** Target module path (if in module) */
  readonly targetModule?: string;
  /** Reference details */
  readonly reference: ResourceReference;
  /** Cross-reference type */
  readonly crossRefType: CrossReferenceType;
}

/**
 * Types of cross-references
 */
export type CrossReferenceType =
  | 'same_file'       // Reference within same file
  | 'same_module'     // Reference within same module
  | 'parent_module'   // Reference to parent module
  | 'child_module'    // Reference to child module
  | 'sibling_module'  // Reference to sibling module
  | 'external';       // Reference to external resource

/**
 * Cross-reference resolution context
 */
export interface CrossReferenceContext {
  /** Current file being analyzed */
  readonly currentFile: string;
  /** Current module path */
  readonly currentModule: string;
  /** Module hierarchy */
  readonly moduleHierarchy: readonly ModuleHierarchyEntry[];
  /** Known resource index */
  readonly resourceIndex: Map<string, ResourceIndexEntry>;
  /** Known module outputs */
  readonly moduleOutputs: Map<string, ModuleOutputEntry>;
}

/**
 * Module hierarchy entry
 */
export interface ModuleHierarchyEntry {
  readonly path: string;
  readonly name: string;
  readonly source: string;
  readonly parent?: string;
}

/**
 * Resource index entry
 */
export interface ResourceIndexEntry {
  readonly nodeId: string;
  readonly type: string;
  readonly name: string;
  readonly file: string;
  readonly module?: string;
  readonly attributes: readonly string[];
}

/**
 * Module output entry
 */
export interface ModuleOutputEntry {
  readonly moduleId: string;
  readonly outputName: string;
  readonly valueExpression: string;
  readonly sensitive: boolean;
}

// ============================================================================
// Data Source Types (TASK-DETECT-003)
// ============================================================================

/**
 * Data source node representation
 */
export interface DataSourceNode {
  /** Unique data source ID */
  readonly id: DataSourceId;
  /** Node type discriminator */
  readonly type: 'terraform_data';
  /** Data source type (e.g., aws_ami, aws_vpc) */
  readonly dataType: string;
  /** Data source name */
  readonly name: string;
  /** Provider name */
  readonly provider: string;
  /** Provider alias (if any) */
  readonly providerAlias?: string;
  /** Filter blocks */
  readonly filters: readonly DataSourceFilter[];
  /** Query attributes */
  readonly queryAttributes: Record<string, unknown>;
  /** Output attributes available */
  readonly outputAttributes: readonly string[];
  /** Dependencies */
  readonly dependsOn: readonly string[];
  /** Source location */
  readonly location: NodeLocation;
}

/**
 * Data source filter block
 */
export interface DataSourceFilter {
  /** Filter name (e.g., for filter blocks) */
  readonly name: string;
  /** Filter values */
  readonly values: readonly string[];
  /** Whether filter contains references */
  readonly hasReferences: boolean;
  /** References in filter values */
  readonly references: readonly ResourceReference[];
}

/**
 * Data source dependency detection result
 */
export interface DataSourceDependency {
  /** Data source node ID */
  readonly dataSourceId: DataSourceId;
  /** Resources that depend on this data source */
  readonly dependentResources: readonly string[];
  /** Resources this data source queries */
  readonly queriedResources: readonly string[];
  /** Filter dependencies */
  readonly filterDependencies: readonly FilterDependency[];
  /** Detection confidence */
  readonly confidence: number;
  /** Evidence */
  readonly evidence: ReferenceEvidence[];
}

/**
 * Filter dependency details
 */
export interface FilterDependency {
  /** Filter name */
  readonly filterName: string;
  /** Referenced resource ID */
  readonly referencedResourceId: string;
  /** Reference expression */
  readonly expression: string;
  /** Confidence level */
  readonly confidence: ConfidenceLevel;
}

// ============================================================================
// Module Dependency Types (TASK-DETECT-004)
// ============================================================================

/**
 * Module dependency representation
 */
export interface ModuleDependency {
  /** Module call ID */
  readonly moduleCallId: ModuleCallId;
  /** Module name */
  readonly moduleName: string;
  /** Module source */
  readonly source: ModuleSourceInfo;
  /** Input variable dependencies */
  readonly inputDependencies: readonly ModuleInputDependency[];
  /** Output consumers */
  readonly outputConsumers: readonly ModuleOutputConsumer[];
  /** Provider dependencies */
  readonly providerDependencies: readonly ModuleProviderDependency[];
  /** Explicit depends_on */
  readonly explicitDependsOn: readonly string[];
  /** Count/for_each dependencies */
  readonly iteratorDependencies: readonly IteratorDependency[];
  /** Child modules */
  readonly childModules: readonly ModuleCallId[];
  /** Detection confidence */
  readonly confidence: number;
}

/**
 * Module source information
 */
export interface ModuleSourceInfo {
  /** Source type */
  readonly type: 'local' | 'registry' | 'git' | 'github' | 's3' | 'gcs' | 'http' | 'unknown';
  /** Raw source string */
  readonly raw: string;
  /** Resolved path (for local modules) */
  readonly resolvedPath?: string;
  /** Registry information (for registry modules) */
  readonly registry?: {
    readonly hostname: string;
    readonly namespace: string;
    readonly name: string;
    readonly provider: string;
  };
  /** Git information (for git modules) */
  readonly git?: {
    readonly url: string;
    readonly ref?: string;
    readonly path?: string;
  };
  /** Version constraint */
  readonly version?: string;
}

/**
 * Module input dependency
 */
export interface ModuleInputDependency {
  /** Variable name */
  readonly variableName: string;
  /** Expression value */
  readonly expression: string;
  /** Resources referenced in expression */
  readonly referencedResources: readonly string[];
  /** Variables referenced in expression */
  readonly referencedVariables: readonly string[];
  /** Other modules referenced */
  readonly referencedModules: readonly string[];
  /** Data sources referenced */
  readonly referencedDataSources: readonly string[];
  /** Whether value is sensitive */
  readonly sensitive: boolean;
}

/**
 * Module output consumer
 */
export interface ModuleOutputConsumer {
  /** Output name */
  readonly outputName: string;
  /** Consumer resource ID */
  readonly consumerId: string;
  /** Consumer type */
  readonly consumerType: 'resource' | 'module' | 'output' | 'local';
  /** Usage expression */
  readonly usageExpression: string;
  /** Source location of usage */
  readonly location: NodeLocation;
}

/**
 * Module provider dependency
 */
export interface ModuleProviderDependency {
  /** Provider name in module */
  readonly providerName: string;
  /** Provider alias passed to module */
  readonly providerAlias?: string;
  /** Source provider configuration */
  readonly sourceProviderConfig: string;
}

/**
 * Iterator (count/for_each) dependency
 */
export interface IteratorDependency {
  /** Iterator type */
  readonly iteratorType: 'count' | 'for_each';
  /** Expression */
  readonly expression: string;
  /** Resources referenced */
  readonly referencedResources: readonly string[];
  /** Variables referenced */
  readonly referencedVariables: readonly string[];
  /** Data sources referenced */
  readonly referencedDataSources: readonly string[];
}

// ============================================================================
// Detection Configuration Types
// ============================================================================

/**
 * Reference detection options
 */
export interface ReferenceDetectionOptions {
  /** Include implicit references */
  readonly includeImplicit: boolean;
  /** Minimum confidence threshold (0-100) */
  readonly minConfidence: number;
  /** Resolve cross-module references */
  readonly resolveCrossModule: boolean;
  /** Maximum depth for nested references */
  readonly maxDepth: number;
  /** Include provider references */
  readonly includeProviderRefs: boolean;
  /** Include path references */
  readonly includePathRefs: boolean;
}

/**
 * Default reference detection options
 */
export const DEFAULT_REFERENCE_DETECTION_OPTIONS: ReferenceDetectionOptions = {
  includeImplicit: true,
  minConfidence: 40,
  resolveCrossModule: true,
  maxDepth: 10,
  includeProviderRefs: true,
  includePathRefs: false,
};

/**
 * Data source detection options
 */
export interface DataSourceDetectionOptions {
  /** Detect filter dependencies */
  readonly detectFilterDependencies: boolean;
  /** Infer queried resources */
  readonly inferQueriedResources: boolean;
  /** Track output usage */
  readonly trackOutputUsage: boolean;
}

/**
 * Default data source detection options
 */
export const DEFAULT_DATA_SOURCE_DETECTION_OPTIONS: DataSourceDetectionOptions = {
  detectFilterDependencies: true,
  inferQueriedResources: true,
  trackOutputUsage: true,
};

/**
 * Module detection options
 */
export interface ModuleDetectionOptions {
  /** Recursively detect child modules */
  readonly recursive: boolean;
  /** Maximum recursion depth */
  readonly maxRecursionDepth: number;
  /** Resolve remote module sources */
  readonly resolveRemoteSources: boolean;
  /** Track provider passing */
  readonly trackProviderPassing: boolean;
  /** Track variable flow */
  readonly trackVariableFlow: boolean;
  /** Track output flow */
  readonly trackOutputFlow: boolean;
}

/**
 * Default module detection options
 */
export const DEFAULT_MODULE_DETECTION_OPTIONS: ModuleDetectionOptions = {
  recursive: true,
  maxRecursionDepth: 10,
  resolveRemoteSources: false,
  trackProviderPassing: true,
  trackVariableFlow: true,
  trackOutputFlow: true,
};

// ============================================================================
// Detection Result Types
// ============================================================================

/**
 * Reference detection result
 */
export interface ReferenceDetectionResult {
  /** Detected references */
  readonly references: readonly ResourceReference[];
  /** Cross-references */
  readonly crossReferences: readonly CrossReference[];
  /** Unresolved references */
  readonly unresolvedReferences: readonly UnresolvedReference[];
  /** Detection statistics */
  readonly stats: ReferenceDetectionStats;
}

/**
 * Unresolved reference
 */
export interface UnresolvedReference {
  /** Reference expression */
  readonly expression: string;
  /** Source location */
  readonly location: NodeLocation;
  /** Error code */
  readonly errorCode: ReferenceErrorCode;
  /** Error message */
  readonly errorMessage: string;
}

/**
 * Reference detection statistics
 */
export interface ReferenceDetectionStats {
  readonly totalReferences: number;
  readonly resolvedReferences: number;
  readonly unresolvedReferences: number;
  readonly crossModuleReferences: number;
  readonly averageConfidence: number;
  readonly referencesByType: Record<ResourceReferenceType, number>;
}

/**
 * Data source detection result
 */
export interface DataSourceDetectionResult {
  /** Detected data sources */
  readonly dataSources: readonly DataSourceNode[];
  /** Data source dependencies */
  readonly dependencies: readonly DataSourceDependency[];
  /** Detection statistics */
  readonly stats: DataSourceDetectionStats;
}

/**
 * Data source detection statistics
 */
export interface DataSourceDetectionStats {
  readonly totalDataSources: number;
  readonly dataSourcesByType: Record<string, number>;
  readonly totalDependencies: number;
  readonly averageConfidence: number;
}

/**
 * Module detection result
 */
export interface ModuleDetectionResult {
  /** Detected module dependencies */
  readonly modules: readonly ModuleDependency[];
  /** Module hierarchy */
  readonly hierarchy: readonly ModuleHierarchyEntry[];
  /** Detection statistics */
  readonly stats: ModuleDetectionStats;
}

/**
 * Module detection statistics
 */
export interface ModuleDetectionStats {
  readonly totalModules: number;
  readonly modulesBySourceType: Record<string, number>;
  readonly totalInputDependencies: number;
  readonly totalOutputConsumers: number;
  readonly maxNestingDepth: number;
  readonly averageConfidence: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ResourceReference
 */
export function isResourceReference(value: unknown): value is ResourceReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'sourceId' in value &&
    'targetId' in value &&
    'expression' in value
  );
}

/**
 * Type guard for DataSourceNode
 */
export function isDataSourceNode(value: unknown): value is DataSourceNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: unknown }).type === 'terraform_data'
  );
}

/**
 * Type guard for ModuleDependency
 */
export function isModuleDependency(value: unknown): value is ModuleDependency {
  return (
    typeof value === 'object' &&
    value !== null &&
    'moduleCallId' in value &&
    'moduleName' in value &&
    'source' in value
  );
}

/**
 * Type guard for CrossReference
 */
export function isCrossReference(value: unknown): value is CrossReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'sourceFile' in value &&
    'targetFile' in value &&
    'crossRefType' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ReferenceId
 * @example
 * const refId = createReferenceId('aws_instance', 'web', 'id');
 */
export function createReferenceId(
  resourceType: string,
  resourceName: string,
  attribute?: string
): ReferenceId {
  const base = `ref-${resourceType}-${resourceName}`;
  return (attribute ? `${base}-${attribute}` : base) as ReferenceId;
}

/**
 * Create a DataSourceId
 * @example
 * const dsId = createDataSourceId('aws_ami', 'ubuntu');
 */
export function createDataSourceId(dataType: string, name: string): DataSourceId {
  return `data.${dataType}.${name}` as DataSourceId;
}

/**
 * Create a ModuleCallId
 * @example
 * const moduleId = createModuleCallId('vpc');
 */
export function createModuleCallId(name: string): ModuleCallId {
  return `module.${name}` as ModuleCallId;
}

/**
 * Create empty reference detection stats
 */
export function createEmptyReferenceStats(): ReferenceDetectionStats {
  return {
    totalReferences: 0,
    resolvedReferences: 0,
    unresolvedReferences: 0,
    crossModuleReferences: 0,
    averageConfidence: 0,
    referencesByType: {} as Record<ResourceReferenceType, number>,
  };
}

/**
 * Create empty data source detection stats
 */
export function createEmptyDataSourceStats(): DataSourceDetectionStats {
  return {
    totalDataSources: 0,
    dataSourcesByType: {},
    totalDependencies: 0,
    averageConfidence: 0,
  };
}

/**
 * Create empty module detection stats
 */
export function createEmptyModuleStats(): ModuleDetectionStats {
  return {
    totalModules: 0,
    modulesBySourceType: {},
    totalInputDependencies: 0,
    totalOutputConsumers: 0,
    maxNestingDepth: 0,
    averageConfidence: 0,
  };
}

// ============================================================================
// Edge Type Mapping
// ============================================================================

/**
 * Map reference type to edge type
 */
export function referenceTypeToEdgeType(refType: ResourceReferenceType): EdgeType {
  switch (refType) {
    case 'attribute':
    case 'whole':
    case 'splat':
    case 'index':
    case 'for_each_key':
    case 'count':
      return 'references';
    case 'module_output':
      return 'output_value';
    case 'data_source':
      return 'data_reference';
    case 'variable':
      return 'input_variable';
    case 'local':
      return 'local_reference';
    case 'provider':
      return 'provider_alias';
    default:
      return 'references';
  }
}

/**
 * Map cross-reference type to edge type
 */
export function crossRefTypeToEdgeType(crossRefType: CrossReferenceType): EdgeType {
  switch (crossRefType) {
    case 'child_module':
      return 'module_call';
    case 'parent_module':
      return 'output_value';
    default:
      return 'references';
  }
}
