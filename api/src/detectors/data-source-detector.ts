/**
 * Data Source Detector
 * @module detectors/data-source-detector
 *
 * Detects Terraform data source blocks, extracts filter criteria,
 * and links them to provider requirements.
 *
 * TASK-DETECT-004: Data source dependency detection
 */

import {
  BaseDetector,
  DetectionResult,
  DetectionContext,
  EvidenceCollector,
  createDetectionContext,
} from './base/detector';
import {
  DataSourceNode,
  DataSourceId,
  DataSourceFilter,
  DataSourceDependency,
  FilterDependency,
  DataSourceDetectionResult,
  DataSourceDetectionStats,
  DataSourceDetectionOptions,
  DEFAULT_DATA_SOURCE_DETECTION_OPTIONS,
  createDataSourceId,
  createEmptyDataSourceStats,
} from './types';
import {
  NodeType,
  TerraformDataNode,
  GraphEdge,
  EdgeType,
  NodeLocation,
} from '../types/graph';
import {
  TerraformFile,
  TerraformBlock,
  HCLExpression,
} from '../parsers/terraform/types';
import { extractReferences, ExtractedReference } from '../parsers/terraform/expression-parser';
import { ConfidenceLevel } from '../types/evidence';

// ============================================================================
// Data Source Detector Types
// ============================================================================

/**
 * Input for data source detection
 */
export interface DataSourceDetectorInput {
  /** Parsed Terraform files */
  readonly files: readonly TerraformFile[];
  /** Existing resource nodes for dependency linking */
  readonly existingNodes?: ReadonlyMap<string, NodeType>;
}

/**
 * Common data source types by provider
 */
const PROVIDER_DATA_SOURCES: Record<string, string[]> = {
  aws: [
    'aws_ami', 'aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_iam_role',
    'aws_iam_policy', 'aws_s3_bucket', 'aws_route53_zone', 'aws_caller_identity',
    'aws_region', 'aws_availability_zones', 'aws_kms_key', 'aws_secretsmanager_secret',
    'aws_ssm_parameter', 'aws_ecr_repository', 'aws_ecs_cluster', 'aws_lb',
  ],
  azurerm: [
    'azurerm_resource_group', 'azurerm_virtual_network', 'azurerm_subnet',
    'azurerm_key_vault', 'azurerm_storage_account', 'azurerm_container_registry',
    'azurerm_subscription', 'azurerm_client_config',
  ],
  google: [
    'google_project', 'google_compute_network', 'google_compute_subnetwork',
    'google_service_account', 'google_container_cluster', 'google_storage_bucket',
    'google_secret_manager_secret', 'google_kms_crypto_key',
  ],
  kubernetes: [
    'kubernetes_namespace', 'kubernetes_service', 'kubernetes_secret',
    'kubernetes_config_map', 'kubernetes_service_account',
  ],
};

/**
 * Attributes commonly used for output
 */
const OUTPUT_ATTRIBUTES: Record<string, string[]> = {
  aws_ami: ['id', 'image_id', 'architecture', 'root_device_type'],
  aws_vpc: ['id', 'cidr_block', 'main_route_table_id', 'default_security_group_id'],
  aws_subnet: ['id', 'cidr_block', 'availability_zone', 'vpc_id'],
  aws_security_group: ['id', 'name', 'vpc_id', 'arn'],
  aws_iam_role: ['arn', 'id', 'name', 'unique_id'],
  aws_caller_identity: ['account_id', 'arn', 'user_id'],
  aws_region: ['name', 'endpoint'],
  aws_availability_zones: ['names', 'zone_ids', 'all_availability_zones'],
};

// ============================================================================
// Data Source Detector
// ============================================================================

/**
 * Detector for Terraform data source blocks.
 * Extracts filter criteria and links to providers and resources.
 */
export class DataSourceDetector extends BaseDetector<DataSourceNode, DataSourceDetectorInput> {
  readonly name = 'terraform-data-source-detector';
  readonly version = '1.0.0';
  readonly producedNodeTypes = ['terraform_data'] as const;
  readonly producedEdgeTypes: readonly EdgeType[] = [
    'data_source',
    'data_reference',
    'provider_config',
  ];

  private options: DataSourceDetectionOptions;

  constructor(options: Partial<DataSourceDetectionOptions> = {}) {
    super();
    this.options = { ...DEFAULT_DATA_SOURCE_DETECTION_OPTIONS, ...options };
  }

  /**
   * Check if input is valid for this detector
   */
  canDetect(input: DataSourceDetectorInput): boolean {
    return input.files !== undefined && input.files.length > 0;
  }

  /**
   * Detect data sources in Terraform files
   */
  protected async doDetect(
    input: DataSourceDetectorInput,
    context: DetectionContext
  ): Promise<DetectionResult<DataSourceNode>> {
    const startTime = performance.now();
    const nodes: DataSourceNode[] = [];
    const edges: GraphEdge[] = [];
    const dependencies: DataSourceDependency[] = [];

    // Process all files
    for (const file of input.files) {
      const fileResults = this.processFile(file, input.existingNodes ?? new Map(), context);
      nodes.push(...fileResults.nodes);
      edges.push(...fileResults.edges);
      dependencies.push(...fileResults.dependencies);
    }

    // Build evidence collection
    const evidence = context.evidenceCollector.collect();

    return this.createSuccess(
      nodes,
      edges,
      evidence,
      this.createMetadata(startTime, context, nodes.length, edges.length, evidence.items.length)
    );
  }

  // ============================================================================
  // File Processing
  // ============================================================================

  private processFile(
    file: TerraformFile,
    existingNodes: ReadonlyMap<string, NodeType>,
    context: DetectionContext
  ): { nodes: DataSourceNode[]; edges: GraphEdge[]; dependencies: DataSourceDependency[] } {
    const nodes: DataSourceNode[] = [];
    const edges: GraphEdge[] = [];
    const dependencies: DataSourceDependency[] = [];

    // Find all data blocks
    const dataBlocks = file.blocks.filter(block => block.type === 'data');

    for (const block of dataBlocks) {
      const dataNode = this.extractDataSource(block, file.path, context);
      if (dataNode) {
        nodes.push(dataNode);

        // Create provider dependency edge
        const providerEdge = this.createProviderEdge(dataNode);
        if (providerEdge) {
          edges.push(providerEdge);
        }

        // Detect filter dependencies
        const dep = this.detectDependencies(dataNode, existingNodes, context);
        if (dep) {
          dependencies.push(dep);

          // Create edges for filter dependencies
          for (const filterDep of dep.filterDependencies) {
            edges.push(this.createEdge(
              dataNode.id,
              filterDep.referencedResourceId,
              'data_reference',
              {
                attribute: filterDep.filterName,
                confidence: this.confidenceToNumber(filterDep.confidence),
                implicit: false,
              }
            ));
          }
        }

        // Add evidence
        context.evidenceCollector.add(
          this.createEvidence(
            'explicit_reference',
            `Data source: ${dataNode.dataType}.${dataNode.name}`,
            dataNode.location,
            90
          )
        );
      }
    }

    return { nodes, edges, dependencies };
  }

  // ============================================================================
  // Data Source Extraction
  // ============================================================================

  private extractDataSource(
    block: TerraformBlock,
    filePath: string,
    context: DetectionContext
  ): DataSourceNode | null {
    if (block.labels.length < 2) {
      return null;
    }

    const dataType = block.labels[0];
    const name = block.labels[1];
    const provider = this.extractProvider(dataType, block);

    // Extract filters
    const filters = this.extractFilters(block, context);

    // Extract query attributes
    const queryAttributes = this.extractQueryAttributes(block);

    // Get available output attributes
    const outputAttributes = OUTPUT_ATTRIBUTES[dataType] ?? [];

    // Extract depends_on
    const dependsOn = this.extractDependsOn(block);

    // Extract provider alias
    const providerAttr = block.attributes['provider'];
    let providerAlias: string | undefined;
    if (providerAttr && providerAttr.type === 'reference') {
      const refExpr = providerAttr as { parts: string[] };
      providerAlias = refExpr.parts.join('.');
    }

    const id = createDataSourceId(dataType, name);

    return {
      id,
      type: 'terraform_data',
      dataType,
      name,
      provider,
      providerAlias,
      filters,
      queryAttributes,
      outputAttributes,
      dependsOn,
      location: block.location,
    };
  }

  private extractProvider(dataType: string, block: TerraformBlock): string {
    // First check for explicit provider attribute
    const providerAttr = block.attributes['provider'];
    if (providerAttr) {
      if (providerAttr.type === 'literal' && typeof providerAttr.value === 'string') {
        return providerAttr.value.split('.')[0];
      }
      if (providerAttr.type === 'reference') {
        return (providerAttr as { parts: string[] }).parts[0];
      }
    }

    // Infer from data type prefix
    const prefix = dataType.split('_')[0];
    for (const [provider, types] of Object.entries(PROVIDER_DATA_SOURCES)) {
      if (types.some(t => t.startsWith(prefix)) || provider === prefix) {
        return provider;
      }
    }

    return prefix;
  }

  // ============================================================================
  // Filter Extraction
  // ============================================================================

  private extractFilters(block: TerraformBlock, context: DetectionContext): readonly DataSourceFilter[] {
    const filters: DataSourceFilter[] = [];

    // Look for filter blocks (common in AWS)
    const filterBlocks = block.nestedBlocks.filter(nb => nb.type === 'filter');
    for (const filterBlock of filterBlocks) {
      const filter = this.extractFilterBlock(filterBlock, context);
      if (filter) {
        filters.push(filter);
      }
    }

    // Look for inline filter attributes
    const filterAttributes = ['filter', 'tags', 'most_recent', 'owners', 'name', 'vpc_id', 'subnet_id'];
    for (const attrName of filterAttributes) {
      if (block.attributes[attrName]) {
        const filter = this.extractFilterAttribute(attrName, block.attributes[attrName], context);
        if (filter) {
          filters.push(filter);
        }
      }
    }

    return filters;
  }

  private extractFilterBlock(block: TerraformBlock, context: DetectionContext): DataSourceFilter | null {
    const nameAttr = block.attributes['name'];
    const valuesAttr = block.attributes['values'];

    if (!nameAttr || !valuesAttr) {
      return null;
    }

    const name = this.extractStringValue(nameAttr);
    const values = this.extractArrayValues(valuesAttr);
    const references = this.extractFilterReferences(valuesAttr, context);

    return {
      name,
      values,
      hasReferences: references.length > 0,
      references,
    };
  }

  private extractFilterAttribute(
    attrName: string,
    expr: HCLExpression,
    context: DetectionContext
  ): DataSourceFilter | null {
    const values = this.extractExpressionValues(expr);
    const references = this.extractFilterReferences(expr, context);

    return {
      name: attrName,
      values,
      hasReferences: references.length > 0,
      references,
    };
  }

  private extractFilterReferences(
    expr: HCLExpression,
    context: DetectionContext
  ): readonly import('./types').ResourceReference[] {
    const refs = extractReferences(expr);
    // Convert ExtractedReference to ResourceReference (simplified)
    return refs.map(ref => ({
      id: `ref-${ref.raw}` as import('./types').ReferenceId,
      type: this.mapRefType(ref.type),
      sourceId: '',
      targetId: ref.parts.join('.'),
      expression: ref.raw,
      parts: {
        prefix: ref.type,
        name: ref.parts[0] ?? '',
        attributes: ref.attribute ? [ref.attribute] : [],
        isSplat: ref.raw.includes('[*]'),
      },
      attribute: ref.attribute ?? undefined,
      location: { file: '', lineStart: 0, lineEnd: 0 },
      confidence: 80,
      evidence: [],
    }));
  }

  private mapRefType(type: string): import('./types').ResourceReferenceType {
    switch (type) {
      case 'var': return 'variable';
      case 'local': return 'local';
      case 'module': return 'module_output';
      case 'data': return 'data_source';
      default: return 'attribute';
    }
  }

  // ============================================================================
  // Query Attribute Extraction
  // ============================================================================

  private extractQueryAttributes(block: TerraformBlock): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};
    const skipAttrs = new Set(['provider', 'depends_on', 'count', 'for_each', 'lifecycle']);

    for (const [key, expr] of Object.entries(block.attributes)) {
      if (!skipAttrs.has(key)) {
        attrs[key] = this.extractExpressionValue(expr);
      }
    }

    return attrs;
  }

  private extractDependsOn(block: TerraformBlock): readonly string[] {
    const dependsOnAttr = block.attributes['depends_on'];
    if (!dependsOnAttr || dependsOnAttr.type !== 'array') {
      return [];
    }

    const arrayExpr = dependsOnAttr as { elements: HCLExpression[] };
    return arrayExpr.elements
      .filter((el): el is { type: 'reference'; parts: string[] } => el.type === 'reference')
      .map(el => el.parts.join('.'));
  }

  // ============================================================================
  // Dependency Detection
  // ============================================================================

  private detectDependencies(
    dataNode: DataSourceNode,
    existingNodes: ReadonlyMap<string, NodeType>,
    context: DetectionContext
  ): DataSourceDependency | null {
    if (!this.options.detectFilterDependencies && !this.options.trackOutputUsage) {
      return null;
    }

    const filterDependencies: FilterDependency[] = [];
    const queriedResources: string[] = [];
    const dependentResources: string[] = [];

    // Analyze filter dependencies
    for (const filter of dataNode.filters) {
      if (filter.hasReferences) {
        for (const ref of filter.references) {
          filterDependencies.push({
            filterName: filter.name,
            referencedResourceId: ref.targetId,
            expression: ref.expression,
            confidence: this.calculateFilterConfidence(filter, ref),
          });
        }
      }
    }

    // Infer queried resources based on data type
    if (this.options.inferQueriedResources) {
      const inferred = this.inferQueriedResources(dataNode, existingNodes);
      queriedResources.push(...inferred);
    }

    // Calculate overall confidence
    const confidence = this.calculateDependencyConfidence(dataNode, filterDependencies);

    return {
      dataSourceId: dataNode.id,
      dependentResources,
      queriedResources,
      filterDependencies,
      confidence,
      evidence: [{
        type: 'explicit_reference',
        category: 'syntax',
        description: `Data source ${dataNode.dataType}.${dataNode.name}`,
        confidence,
      }],
    };
  }

  private inferQueriedResources(
    dataNode: DataSourceNode,
    existingNodes: ReadonlyMap<string, NodeType>
  ): string[] {
    const inferred: string[] = [];

    // Map data types to likely resource types they query
    const dataToResource: Record<string, string> = {
      aws_ami: 'aws_ami',
      aws_vpc: 'aws_vpc',
      aws_subnet: 'aws_subnet',
      aws_security_group: 'aws_security_group',
      aws_iam_role: 'aws_iam_role',
      aws_s3_bucket: 'aws_s3_bucket',
    };

    const resourceType = dataToResource[dataNode.dataType];
    if (resourceType) {
      // Find matching resources in existing nodes
      for (const [nodeId, node] of existingNodes) {
        if (node.type === 'terraform_resource') {
          const resNode = node as import('../types/graph').TerraformResourceNode;
          if (resNode.resourceType === resourceType) {
            inferred.push(nodeId);
          }
        }
      }
    }

    return inferred;
  }

  private calculateFilterConfidence(
    filter: DataSourceFilter,
    ref: import('./types').ResourceReference
  ): ConfidenceLevel {
    // High confidence if filter is a well-known filter type
    const highConfidenceFilters = ['vpc_id', 'subnet_id', 'security_group_ids', 'name', 'id'];
    if (highConfidenceFilters.includes(filter.name)) {
      return 'high';
    }

    // Medium confidence for tags and other filters
    if (filter.name === 'tags' || filter.name.startsWith('filter')) {
      return 'medium';
    }

    return 'low';
  }

  private calculateDependencyConfidence(
    dataNode: DataSourceNode,
    filterDeps: FilterDependency[]
  ): number {
    if (filterDeps.length === 0) {
      return 50; // Base confidence for data sources without filter deps
    }

    // Higher confidence with more explicit dependencies
    const highCount = filterDeps.filter(d => d.confidence === 'high').length;
    const mediumCount = filterDeps.filter(d => d.confidence === 'medium').length;

    return Math.min(95, 50 + (highCount * 15) + (mediumCount * 10));
  }

  // ============================================================================
  // Provider Edge Creation
  // ============================================================================

  private createProviderEdge(dataNode: DataSourceNode): GraphEdge | null {
    const providerId = dataNode.providerAlias ?? `provider.${dataNode.provider}`;

    return this.createEdge(
      dataNode.id,
      providerId,
      'provider_config',
      {
        confidence: 100,
        implicit: true,
      }
    );
  }

  // ============================================================================
  // Value Extraction Helpers
  // ============================================================================

  private extractStringValue(expr: HCLExpression): string {
    if (expr.type === 'literal' && typeof expr.value === 'string') {
      return expr.value;
    }
    if (expr.type === 'template') {
      return expr.raw;
    }
    return '';
  }

  private extractArrayValues(expr: HCLExpression): readonly string[] {
    if (expr.type === 'array') {
      return (expr as { elements: HCLExpression[] }).elements.map(el => this.extractStringValue(el));
    }
    return [];
  }

  private extractExpressionValues(expr: HCLExpression): readonly string[] {
    if (expr.type === 'literal') {
      return [String(expr.value)];
    }
    if (expr.type === 'array') {
      return this.extractArrayValues(expr);
    }
    if (expr.type === 'reference') {
      return [expr.raw];
    }
    return [];
  }

  private extractExpressionValue(expr: HCLExpression): unknown {
    switch (expr.type) {
      case 'literal':
        return expr.value;
      case 'array':
        return (expr as { elements: HCLExpression[] }).elements.map(el => this.extractExpressionValue(el));
      case 'object':
        const obj: Record<string, unknown> = {};
        for (const [key, val] of Object.entries((expr as { attributes: Record<string, HCLExpression> }).attributes)) {
          obj[key] = this.extractExpressionValue(val);
        }
        return obj;
      case 'reference':
        return expr.raw;
      default:
        return expr.raw;
    }
  }

  private confidenceToNumber(level: ConfidenceLevel): number {
    switch (level) {
      case 'certain': return 100;
      case 'high': return 85;
      case 'medium': return 70;
      case 'low': return 50;
      case 'uncertain': return 30;
      default: return 50;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new data source detector instance
 */
export function createDataSourceDetector(
  options?: Partial<DataSourceDetectionOptions>
): DataSourceDetector {
  return new DataSourceDetector(options);
}

/**
 * Detect data sources in parsed Terraform files
 */
export async function detectDataSources(
  files: readonly TerraformFile[],
  existingNodes?: ReadonlyMap<string, NodeType>,
  options?: Partial<DataSourceDetectionOptions>
): Promise<DetectionResult<DataSourceNode>> {
  const detector = createDataSourceDetector(options);
  const context = createDetectionContext(
    process.cwd(),
    files.map(f => f.path),
    options
  );

  return detector.detect(
    {
      files,
      existingNodes,
    },
    context
  );
}

// ============================================================================
// Exports
// ============================================================================

// Note: DataSourceDetector and DataSourceDetectorInput are exported inline above
export { PROVIDER_DATA_SOURCES, OUTPUT_ATTRIBUTES };
