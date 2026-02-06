/**
 * Reference Resolver
 * @module detectors/reference-resolver
 *
 * Resolves Terraform attribute references including var.x, local.x, module.x,
 * data.x patterns. Builds a reference graph for dependency analysis.
 *
 * TASK-DETECT-003: Reference resolution for Terraform expressions
 */

import {
  BaseDetector,
  DetectionResult,
  DetectionContext,
  EvidenceCollector,
  createDetectionContext,
} from './base/detector';
import {
  ResourceReference,
  ResourceReferenceParts,
  ResourceReferenceType,
  ReferenceResolution,
  ReferenceResolutionError,
  ReferenceErrorCode,
  CrossReference,
  CrossReferenceType,
  CrossReferenceContext,
  ResourceIndexEntry,
  ModuleOutputEntry,
  ReferenceEvidence,
  UnresolvedReference,
  ReferenceDetectionResult,
  ReferenceDetectionStats,
  ReferenceDetectionOptions,
  DEFAULT_REFERENCE_DETECTION_OPTIONS,
  createReferenceId,
  createEmptyReferenceStats,
  referenceTypeToEdgeType,
} from './types';
import {
  NodeType,
  TerraformResourceNode,
  TerraformDataNode,
  TerraformModuleNode,
  TerraformVariableNode,
  TerraformLocalNode,
  TerraformOutputNode,
  GraphEdge,
  EdgeType,
  NodeLocation,
} from '../types/graph';
import {
  HCLExpression,
  HCLReferenceExpression,
  TerraformFile,
  TerraformBlock,
} from '../parsers/terraform/types';
import { extractReferences, ExtractedReference } from '../parsers/terraform/expression-parser';

// ============================================================================
// Reference Resolution Types
// ============================================================================

/**
 * Input for reference resolution - parsed Terraform files
 */
export interface ReferenceResolverInput {
  /** Parsed Terraform files */
  readonly files: readonly TerraformFile[];
  /** Existing nodes to resolve against */
  readonly nodes: ReadonlyMap<string, NodeType>;
  /** Module outputs for cross-module resolution */
  readonly moduleOutputs?: ReadonlyMap<string, ModuleOutputEntry>;
}

/**
 * Reference resolution context for tracking state
 */
interface ResolutionState {
  /** Resource index for quick lookup */
  readonly resourceIndex: Map<string, ResourceIndexEntry>;
  /** Module output index */
  readonly moduleOutputIndex: Map<string, ModuleOutputEntry>;
  /** Resolved references */
  readonly resolvedRefs: Map<string, ReferenceResolution>;
  /** Resolution path for cycle detection */
  readonly resolutionPath: string[];
}

// ============================================================================
// Reference Patterns
// ============================================================================

const REFERENCE_PATTERNS = {
  // var.name
  variable: /^var\.([a-zA-Z_][a-zA-Z0-9_]*)$/,

  // local.name
  local: /^local\.([a-zA-Z_][a-zA-Z0-9_]*)$/,

  // module.name.output
  module: /^module\.([a-zA-Z_][a-zA-Z0-9_-]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?$/,

  // data.type.name.attr
  data: /^data\.([a-zA-Z_][a-zA-Z0-9_-]*)\.([a-zA-Z_][a-zA-Z0-9_-]*)(?:\.(.+))?$/,

  // resource_type.name.attr (e.g., aws_instance.web.id)
  resource: /^([a-zA-Z_][a-zA-Z0-9_-]*)\.([a-zA-Z_][a-zA-Z0-9_-]*)(?:\.(.+))?$/,

  // Splat: resource[*].attr
  splat: /^(.+)\[\*\](.*)$/,

  // Index: resource[0].attr or resource["key"].attr
  index: /^(.+)\[([^\]]+)\](.*)$/,

  // Count: count.index
  count: /^count\.index$/,

  // Each: each.key, each.value
  each: /^each\.(key|value)$/,

  // Self: self.attr
  self: /^self\.(.+)$/,

  // Path: path.module, path.root, path.cwd
  path: /^path\.(module|root|cwd)$/,

  // Terraform: terraform.workspace
  terraform: /^terraform\.workspace$/,
};

// ============================================================================
// Reference Resolver Detector
// ============================================================================

/**
 * Detector that resolves Terraform references and builds a reference graph.
 */
export class ReferenceResolver extends BaseDetector<TerraformResourceNode | TerraformDataNode | TerraformModuleNode, ReferenceResolverInput> {
  readonly name = 'terraform-reference-resolver';
  readonly version = '1.0.0';
  readonly producedNodeTypes = ['terraform_resource', 'terraform_data', 'terraform_module'] as const;
  readonly producedEdgeTypes: readonly EdgeType[] = [
    'references',
    'input_variable',
    'local_reference',
    'output_value',
    'data_reference',
    'module_call',
  ];

  private options: ReferenceDetectionOptions;

  constructor(options: Partial<ReferenceDetectionOptions> = {}) {
    super();
    this.options = { ...DEFAULT_REFERENCE_DETECTION_OPTIONS, ...options };
  }

  /**
   * Check if input is valid for this detector
   */
  canDetect(input: ReferenceResolverInput): boolean {
    return input.files !== undefined && input.files.length > 0;
  }

  /**
   * Perform reference detection and resolution
   */
  protected async doDetect(
    input: ReferenceResolverInput,
    context: DetectionContext
  ): Promise<DetectionResult<TerraformResourceNode | TerraformDataNode | TerraformModuleNode>> {
    const startTime = performance.now();
    const nodes: (TerraformResourceNode | TerraformDataNode | TerraformModuleNode)[] = [];
    const edges: GraphEdge[] = [];

    // Build resource index from existing nodes
    const state: ResolutionState = {
      resourceIndex: this.buildResourceIndex(input.nodes),
      moduleOutputIndex: new Map(input.moduleOutputs ?? []),
      resolvedRefs: new Map(),
      resolutionPath: [],
    };

    // Process all files
    const allReferences: ResourceReference[] = [];
    const unresolvedRefs: UnresolvedReference[] = [];
    const stats = createEmptyReferenceStats();

    for (const file of input.files) {
      const fileRefs = this.processFile(file, state, context);
      allReferences.push(...fileRefs.resolved);
      unresolvedRefs.push(...fileRefs.unresolved);
    }

    // Create edges for resolved references
    for (const ref of allReferences) {
      const edge = this.createEdgeFromReference(ref);
      if (edge) {
        edges.push(edge);
      }
    }

    // Update stats
    (stats as { totalReferences: number }).totalReferences = allReferences.length + unresolvedRefs.length;
    (stats as { resolvedReferences: number }).resolvedReferences = allReferences.length;
    (stats as { unresolvedReferences: number }).unresolvedReferences = unresolvedRefs.length;

    // Calculate average confidence
    if (allReferences.length > 0) {
      const totalConfidence = allReferences.reduce((sum, ref) => sum + ref.confidence, 0);
      (stats as { averageConfidence: number }).averageConfidence = totalConfidence / allReferences.length;
    }

    // Count by type
    for (const ref of allReferences) {
      const count = stats.referencesByType[ref.type] ?? 0;
      (stats.referencesByType as Record<ResourceReferenceType, number>)[ref.type] = count + 1;
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
    state: ResolutionState,
    context: DetectionContext
  ): { resolved: ResourceReference[]; unresolved: UnresolvedReference[] } {
    const resolved: ResourceReference[] = [];
    const unresolved: UnresolvedReference[] = [];

    for (const block of file.blocks) {
      const blockRefs = this.processBlock(block, file.path, state, context);
      resolved.push(...blockRefs.resolved);
      unresolved.push(...blockRefs.unresolved);
    }

    return { resolved, unresolved };
  }

  private processBlock(
    block: TerraformBlock,
    filePath: string,
    state: ResolutionState,
    context: DetectionContext
  ): { resolved: ResourceReference[]; unresolved: UnresolvedReference[] } {
    const resolved: ResourceReference[] = [];
    const unresolved: UnresolvedReference[] = [];

    // Get source node ID
    const sourceId = this.getBlockNodeId(block);

    // Process all attributes
    for (const [attrName, expr] of Object.entries(block.attributes)) {
      const refs = this.extractReferencesFromExpression(expr, filePath, sourceId, state, context);
      resolved.push(...refs.resolved);
      unresolved.push(...refs.unresolved);
    }

    // Process nested blocks recursively
    for (const nestedBlock of block.nestedBlocks) {
      const nestedRefs = this.processBlock(nestedBlock, filePath, state, context);
      resolved.push(...nestedRefs.resolved);
      unresolved.push(...nestedRefs.unresolved);
    }

    return { resolved, unresolved };
  }

  // ============================================================================
  // Reference Extraction
  // ============================================================================

  private extractReferencesFromExpression(
    expr: HCLExpression,
    filePath: string,
    sourceId: string,
    state: ResolutionState,
    context: DetectionContext
  ): { resolved: ResourceReference[]; unresolved: UnresolvedReference[] } {
    const resolved: ResourceReference[] = [];
    const unresolved: UnresolvedReference[] = [];

    // Extract all references from the expression
    const extractedRefs = extractReferences(expr);

    for (const extracted of extractedRefs) {
      const resolution = this.resolveReference(extracted, filePath, state, context);

      if (resolution.resolved && resolution.targetNodeId) {
        const ref = this.createResourceReference(
          extracted,
          sourceId,
          resolution.targetNodeId,
          filePath,
          expr,
          context
        );
        resolved.push(ref);

        // Add evidence
        context.evidenceCollector.add(
          this.createEvidence(
            'explicit_reference',
            `Reference to ${resolution.targetNodeId} via ${extracted.raw}`,
            { file: filePath, lineStart: 0, lineEnd: 0 }, // Would need line info from expression
            ref.confidence
          )
        );
      } else {
        unresolved.push({
          expression: extracted.raw,
          location: { file: filePath, lineStart: 0, lineEnd: 0 },
          errorCode: resolution.errors[0]?.code ?? 'NOT_FOUND',
          errorMessage: resolution.errors[0]?.message ?? 'Reference could not be resolved',
        });
      }
    }

    return { resolved, unresolved };
  }

  // ============================================================================
  // Reference Resolution
  // ============================================================================

  private resolveReference(
    extracted: ExtractedReference,
    filePath: string,
    state: ResolutionState,
    context: DetectionContext
  ): ReferenceResolution {
    const errors: ReferenceResolutionError[] = [];
    const resolutionPath: string[] = [];

    // Check for circular reference
    if (state.resolutionPath.includes(extracted.raw)) {
      return {
        resolved: false,
        errors: [{
          code: 'CIRCULAR',
          message: `Circular reference detected: ${extracted.raw}`,
          reference: extracted.raw,
        }],
        resolutionPath: [...state.resolutionPath, extracted.raw],
      };
    }

    // Add to resolution path
    const newState: ResolutionState = {
      ...state,
      resolutionPath: [...state.resolutionPath, extracted.raw],
    };

    switch (extracted.type) {
      case 'var':
        return this.resolveVariableRef(extracted, newState);

      case 'local':
        return this.resolveLocalRef(extracted, newState);

      case 'module':
        return this.resolveModuleRef(extracted, newState);

      case 'data':
        return this.resolveDataRef(extracted, newState);

      case 'resource':
        return this.resolveResourceRef(extracted, newState);

      case 'count':
      case 'each':
      case 'self':
      case 'path':
        // These are contextual references that don't resolve to other nodes
        return {
          resolved: true,
          targetNodeId: undefined,
          resolutionPath: newState.resolutionPath,
          errors: [],
        };

      default:
        return {
          resolved: false,
          errors: [{
            code: 'UNKNOWN',
            message: `Unknown reference type: ${extracted.type}`,
            reference: extracted.raw,
          }],
          resolutionPath: newState.resolutionPath,
        };
    }
  }

  private resolveVariableRef(extracted: ExtractedReference, state: ResolutionState): ReferenceResolution {
    const varName = extracted.parts[0];
    const targetId = `var.${varName}`;
    const entry = state.resourceIndex.get(targetId);

    if (entry) {
      return {
        resolved: true,
        targetNodeId: entry.nodeId,
        resolutionPath: state.resolutionPath,
        errors: [],
      };
    }

    // Variable might be defined but not in index yet
    return {
      resolved: true,
      targetNodeId: targetId,
      resolutionPath: state.resolutionPath,
      errors: [],
    };
  }

  private resolveLocalRef(extracted: ExtractedReference, state: ResolutionState): ReferenceResolution {
    const localName = extracted.parts[0];
    const targetId = `local.${localName}`;
    const entry = state.resourceIndex.get(targetId);

    if (entry) {
      return {
        resolved: true,
        targetNodeId: entry.nodeId,
        resolutionPath: state.resolutionPath,
        errors: [],
      };
    }

    return {
      resolved: true,
      targetNodeId: targetId,
      resolutionPath: state.resolutionPath,
      errors: [],
    };
  }

  private resolveModuleRef(extracted: ExtractedReference, state: ResolutionState): ReferenceResolution {
    const moduleName = extracted.parts[0];
    const outputName = extracted.parts[1];
    const moduleId = `module.${moduleName}`;

    // If accessing an output, look it up
    if (outputName) {
      const outputKey = `${moduleId}.${outputName}`;
      const outputEntry = state.moduleOutputIndex.get(outputKey);

      if (outputEntry) {
        return {
          resolved: true,
          targetNodeId: outputEntry.moduleId,
          resolvedValue: outputEntry.valueExpression,
          resolutionPath: state.resolutionPath,
          errors: [],
        };
      }
    }

    // Just reference to the module itself
    const entry = state.resourceIndex.get(moduleId);
    return {
      resolved: entry !== undefined,
      targetNodeId: entry?.nodeId ?? moduleId,
      resolutionPath: state.resolutionPath,
      errors: entry ? [] : [{
        code: 'NOT_FOUND',
        message: `Module not found: ${moduleName}`,
        reference: extracted.raw,
      }],
    };
  }

  private resolveDataRef(extracted: ExtractedReference, state: ResolutionState): ReferenceResolution {
    const dataType = extracted.parts[0];
    const dataName = extracted.parts[1];
    const targetId = `data.${dataType}.${dataName}`;
    const entry = state.resourceIndex.get(targetId);

    if (entry) {
      return {
        resolved: true,
        targetNodeId: entry.nodeId,
        resolutionPath: state.resolutionPath,
        errors: [],
      };
    }

    return {
      resolved: false,
      errors: [{
        code: 'NOT_FOUND',
        message: `Data source not found: ${targetId}`,
        reference: extracted.raw,
      }],
      resolutionPath: state.resolutionPath,
    };
  }

  private resolveResourceRef(extracted: ExtractedReference, state: ResolutionState): ReferenceResolution {
    const resourceType = extracted.parts[0];
    const resourceName = extracted.parts[1];
    const targetId = `${resourceType}.${resourceName}`;
    const entry = state.resourceIndex.get(targetId);

    if (entry) {
      return {
        resolved: true,
        targetNodeId: entry.nodeId,
        resolutionPath: state.resolutionPath,
        errors: [],
      };
    }

    return {
      resolved: false,
      errors: [{
        code: 'NOT_FOUND',
        message: `Resource not found: ${targetId}`,
        reference: extracted.raw,
      }],
      resolutionPath: state.resolutionPath,
    };
  }

  // ============================================================================
  // Reference Creation
  // ============================================================================

  private createResourceReference(
    extracted: ExtractedReference,
    sourceId: string,
    targetId: string,
    filePath: string,
    expr: HCLExpression,
    context: DetectionContext
  ): ResourceReference {
    const refType = this.classifyReferenceType(extracted);
    const parts = this.parseReferenceParts(extracted);

    return {
      id: createReferenceId(parts.resourceType ?? '', parts.name, parts.attributes[0]),
      type: refType,
      sourceId,
      targetId,
      expression: extracted.raw,
      parts,
      attribute: extracted.attribute ?? undefined,
      location: { file: filePath, lineStart: 0, lineEnd: 0 },
      confidence: this.calculateConfidence(extracted, refType),
      evidence: this.buildEvidence(extracted, refType),
    };
  }

  private classifyReferenceType(extracted: ExtractedReference): ResourceReferenceType {
    switch (extracted.type) {
      case 'var':
        return 'variable';
      case 'local':
        return 'local';
      case 'module':
        return 'module_output';
      case 'data':
        return 'data_source';
      case 'resource':
        // Check for splat/index patterns
        if (extracted.raw.includes('[*]')) return 'splat';
        if (extracted.raw.includes('[')) return 'index';
        if (extracted.attribute) return 'attribute';
        return 'whole';
      default:
        return 'attribute';
    }
  }

  private parseReferenceParts(extracted: ExtractedReference): ResourceReferenceParts {
    return {
      prefix: extracted.type,
      resourceType: extracted.type === 'resource' || extracted.type === 'data' ? extracted.parts[0] : undefined,
      name: extracted.parts[extracted.type === 'data' ? 1 : 0] ?? '',
      attributes: extracted.attribute ? [extracted.attribute] : [],
      isSplat: extracted.raw.includes('[*]'),
    };
  }

  private calculateConfidence(extracted: ExtractedReference, refType: ResourceReferenceType): number {
    // Explicit references have high confidence
    if (['variable', 'local', 'module_output', 'data_source'].includes(refType)) {
      return 95;
    }

    // Direct attribute references
    if (refType === 'attribute') {
      return 90;
    }

    // Whole resource references
    if (refType === 'whole') {
      return 85;
    }

    // Index/splat references (more complex)
    if (refType === 'index' || refType === 'splat') {
      return 80;
    }

    return 70;
  }

  private buildEvidence(extracted: ExtractedReference, refType: ResourceReferenceType): ReferenceEvidence[] {
    return [{
      type: 'explicit_reference',
      category: 'syntax',
      description: `${refType} reference: ${extracted.raw}`,
      confidence: this.calculateConfidence(extracted, refType),
    }];
  }

  // ============================================================================
  // Edge Creation
  // ============================================================================

  private createEdgeFromReference(ref: ResourceReference): GraphEdge | null {
    if (!ref.targetId) {
      return null;
    }

    const edgeType = referenceTypeToEdgeType(ref.type);

    return this.createEdge(ref.sourceId, ref.targetId, edgeType, {
      attribute: ref.attribute,
      confidence: ref.confidence,
      implicit: false,
    });
  }

  // ============================================================================
  // Index Building
  // ============================================================================

  private buildResourceIndex(nodes: ReadonlyMap<string, NodeType>): Map<string, ResourceIndexEntry> {
    const index = new Map<string, ResourceIndexEntry>();

    for (const [nodeId, node] of nodes) {
      let key: string;

      switch (node.type) {
        case 'terraform_resource':
          key = `${(node as TerraformResourceNode).resourceType}.${node.name}`;
          break;
        case 'terraform_data':
          key = `data.${(node as TerraformDataNode).dataType}.${node.name}`;
          break;
        case 'terraform_module':
          key = `module.${node.name}`;
          break;
        case 'terraform_variable':
          key = `var.${node.name}`;
          break;
        case 'terraform_output':
          key = `output.${node.name}`;
          break;
        case 'terraform_local':
          key = `local.${node.name}`;
          break;
        default:
          continue;
      }

      index.set(key, {
        nodeId,
        type: node.type,
        name: node.name,
        file: node.location.file,
        attributes: [],
      });
    }

    return index;
  }

  private getBlockNodeId(block: TerraformBlock): string {
    switch (block.type) {
      case 'resource':
        return `${block.labels[0]}.${block.labels[1]}`;
      case 'data':
        return `data.${block.labels[0]}.${block.labels[1]}`;
      case 'module':
        return `module.${block.labels[0]}`;
      case 'variable':
        return `var.${block.labels[0]}`;
      case 'output':
        return `output.${block.labels[0]}`;
      case 'locals':
        return 'locals';
      case 'provider':
        return block.labels[1]
          ? `provider.${block.labels[0]}.${block.labels[1]}`
          : `provider.${block.labels[0]}`;
      default:
        return `${block.type}.${block.labels.join('.')}`;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new reference resolver instance
 */
export function createReferenceResolver(
  options?: Partial<ReferenceDetectionOptions>
): ReferenceResolver {
  return new ReferenceResolver(options);
}

/**
 * Resolve references in parsed Terraform files
 */
export async function resolveReferences(
  files: readonly TerraformFile[],
  existingNodes?: ReadonlyMap<string, NodeType>,
  options?: Partial<ReferenceDetectionOptions>
): Promise<DetectionResult<TerraformResourceNode | TerraformDataNode | TerraformModuleNode>> {
  const resolver = createReferenceResolver(options);
  const context = createDetectionContext(
    process.cwd(),
    files.map(f => f.path),
    options
  );

  return resolver.detect(
    {
      files,
      nodes: existingNodes ?? new Map(),
    },
    context
  );
}

// ============================================================================
// Note: ReferenceResolver and ReferenceResolverInput are exported inline above
// ============================================================================
