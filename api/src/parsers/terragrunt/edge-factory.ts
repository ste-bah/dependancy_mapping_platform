/**
 * Terragrunt Edge Factory
 * @module parsers/terragrunt/edge-factory
 * TASK-TG-008: Factory functions for creating Terragrunt graph edges.
 */

import { NodeLocation, GraphEdge, EdgeMetadata, EdgeEvidence as GraphEdgeEvidence } from '../../types/graph';
import { randomUUID } from 'crypto';
import {
  TgEdgeEvidence,
  calculateAggregatedConfidence,
  validateTgEdgeEvidenceArray,
} from './edge-evidence';
import {
  TerragruntEdgeError,
  SourceResolutionError,
  BatchEdgeError,
  wrapEdgeError,
  wrapSourceError,
  canContinueAfterEdgeError,
  isTerragruntEdgeError,
  isSourceResolutionError,
  isBatchEdgeError,
} from './errors';

// Re-export evidence types for convenience
export {
  TgEdgeEvidence,
  TgEvidenceBuilder,
  createEvidenceBuilder,
  createEvidence,
  calculateAggregatedConfidence,
  validateTgEdgeEvidence,
  validateTgEdgeEvidenceArray,
} from './edge-evidence';

// Re-export edge error types for convenience
export {
  TerragruntEdgeError,
  SourceResolutionError,
  BatchEdgeError,
  wrapEdgeError,
  wrapSourceError,
  canContinueAfterEdgeError,
  isTerragruntEdgeError,
  isSourceResolutionError,
  isBatchEdgeError,
} from './errors';

// ============================================================================
// Edge Type Constants
// ============================================================================

/** Terragrunt-specific edge type constants */
export const TG_EDGE_TYPES = {
  INCLUDES: 'tg_includes',
  DEPENDS_ON: 'tg_depends_on',
  PASSES_INPUT: 'tg_passes_input',
  SOURCES: 'tg_sources',
} as const;

/** Type for Terragrunt edge type values */
export type TgEdgeType = typeof TG_EDGE_TYPES[keyof typeof TG_EDGE_TYPES];

/** All valid Terragrunt edge type values as a set for runtime validation */
export const TG_EDGE_TYPE_VALUES = new Set<TgEdgeType>(
  Object.values(TG_EDGE_TYPES) as TgEdgeType[]
);

// ============================================================================
// Factory Options
// ============================================================================

/** Options for Terragrunt edge factory functions */
export interface TgEdgeFactoryOptions {
  readonly scanId: string;
  readonly idGenerator?: () => string;
}

/** Default factory options */
export const DEFAULT_EDGE_FACTORY_OPTIONS: Partial<TgEdgeFactoryOptions> = {
  idGenerator: () => randomUUID(),
};

// ============================================================================
// Edge Option Interfaces
// ============================================================================

/** Options for creating a TgIncludesEdge */
export interface TgIncludesEdgeOptions {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly includeName: string;
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
  readonly inheritedBlocks: readonly string[];
  readonly exposeAsVariable: boolean;
  readonly evidence: readonly TgEdgeEvidence[];
}

/** Options for creating a TgDependsOnEdge */
export interface TgDependsOnEdgeOptions {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly dependencyName: string;
  readonly skipOutputs: boolean;
  readonly outputsConsumed: readonly string[];
  readonly hasMockOutputs: boolean;
  readonly evidence: readonly TgEdgeEvidence[];
}

/** Options for creating a TgPassesInputEdge */
export interface TgPassesInputEdgeOptions {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly inputName: string;
  readonly sourceExpression: string;
  readonly viaDependencyOutputs: boolean;
  readonly dependencyName: string | null;
  readonly evidence: readonly TgEdgeEvidence[];
}

/** Options for creating a TgSourcesEdge */
export interface TgSourcesEdgeOptions {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceExpression: string;
  readonly sourceType: 'local' | 'git' | 'registry' | 's3' | 'gcs' | 'http' | 'unknown';
  readonly versionConstraint: string | null;
  readonly evidence: readonly TgEdgeEvidence[];
}

// ============================================================================
// Edge Type Interfaces
// ============================================================================

/** Base interface for all Terragrunt edges */
export interface TgBaseEdge extends Omit<GraphEdge, 'type'> {
  readonly type: TgEdgeType;
  readonly scanId: string;
  readonly confidence: number;
  readonly evidence: readonly TgEdgeEvidence[];
}

/** Edge representing an include relationship */
export interface TgIncludesEdge extends TgBaseEdge {
  readonly type: typeof TG_EDGE_TYPES.INCLUDES;
  readonly includeName: string;
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
  readonly inheritedBlocks: readonly string[];
  readonly exposeAsVariable: boolean;
}

/** Edge representing a dependency relationship */
export interface TgDependsOnEdge extends TgBaseEdge {
  readonly type: typeof TG_EDGE_TYPES.DEPENDS_ON;
  readonly dependencyName: string;
  readonly skipOutputs: boolean;
  readonly outputsConsumed: readonly string[];
  readonly hasMockOutputs: boolean;
}

/** Edge representing input value passing */
export interface TgPassesInputEdge extends TgBaseEdge {
  readonly type: typeof TG_EDGE_TYPES.PASSES_INPUT;
  readonly inputName: string;
  readonly sourceExpression: string;
  readonly viaDependencyOutputs: boolean;
  readonly dependencyName: string | null;
}

/** Edge representing Terraform source relationship */
export interface TgSourcesEdge extends TgBaseEdge {
  readonly type: typeof TG_EDGE_TYPES.SOURCES;
  readonly sourceExpression: string;
  readonly sourceType: 'local' | 'git' | 'registry' | 's3' | 'gcs' | 'http' | 'unknown';
  readonly versionConstraint: string | null;
}

/** Union type for all Terragrunt edge types */
export type TgEdge = TgIncludesEdge | TgDependsOnEdge | TgPassesInputEdge | TgSourcesEdge;

// ============================================================================
// Factory Functions
// ============================================================================

/** Create a TgIncludesEdge from include relationship options */
export function createTgIncludesEdge(
  options: TgIncludesEdgeOptions,
  factoryOptions: TgEdgeFactoryOptions
): TgIncludesEdge {
  validateEdgeOptions(options, TG_EDGE_TYPES.INCLUDES);

  const idGenerator = factoryOptions.idGenerator ?? DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator!;
  const confidence = calculateAggregatedConfidence(options.evidence);

  return {
    id: idGenerator(),
    source: options.sourceNodeId,
    target: options.targetNodeId,
    type: TG_EDGE_TYPES.INCLUDES,
    label: `includes:${options.includeName}`,
    metadata: createEdgeMetadata(options.evidence, confidence),
    scanId: factoryOptions.scanId,
    confidence,
    evidence: options.evidence,
    includeName: options.includeName,
    mergeStrategy: options.mergeStrategy,
    inheritedBlocks: options.inheritedBlocks,
    exposeAsVariable: options.exposeAsVariable,
  };
}

/** Create a TgDependsOnEdge from dependency relationship options */
export function createTgDependsOnEdge(
  options: TgDependsOnEdgeOptions,
  factoryOptions: TgEdgeFactoryOptions
): TgDependsOnEdge {
  validateEdgeOptions(options, TG_EDGE_TYPES.DEPENDS_ON);

  const idGenerator = factoryOptions.idGenerator ?? DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator!;
  const confidence = calculateAggregatedConfidence(options.evidence);

  return {
    id: idGenerator(),
    source: options.sourceNodeId,
    target: options.targetNodeId,
    type: TG_EDGE_TYPES.DEPENDS_ON,
    label: `depends_on:${options.dependencyName}`,
    metadata: createEdgeMetadata(options.evidence, confidence),
    scanId: factoryOptions.scanId,
    confidence,
    evidence: options.evidence,
    dependencyName: options.dependencyName,
    skipOutputs: options.skipOutputs,
    outputsConsumed: options.outputsConsumed,
    hasMockOutputs: options.hasMockOutputs,
  };
}

/** Create a TgPassesInputEdge from input passing relationship options */
export function createTgPassesInputEdge(
  options: TgPassesInputEdgeOptions,
  factoryOptions: TgEdgeFactoryOptions
): TgPassesInputEdge {
  validateEdgeOptions(options, TG_EDGE_TYPES.PASSES_INPUT);

  const idGenerator = factoryOptions.idGenerator ?? DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator!;
  const confidence = calculateAggregatedConfidence(options.evidence);

  return {
    id: idGenerator(),
    source: options.sourceNodeId,
    target: options.targetNodeId,
    type: TG_EDGE_TYPES.PASSES_INPUT,
    label: `passes:${options.inputName}`,
    metadata: createEdgeMetadata(options.evidence, confidence),
    scanId: factoryOptions.scanId,
    confidence,
    evidence: options.evidence,
    inputName: options.inputName,
    sourceExpression: options.sourceExpression,
    viaDependencyOutputs: options.viaDependencyOutputs,
    dependencyName: options.dependencyName,
  };
}

/** Create a TgSourcesEdge from Terraform source relationship options */
export function createTgSourcesEdge(
  options: TgSourcesEdgeOptions,
  factoryOptions: TgEdgeFactoryOptions
): TgSourcesEdge {
  validateEdgeOptions(options, TG_EDGE_TYPES.SOURCES);

  const idGenerator = factoryOptions.idGenerator ?? DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator!;
  const confidence = calculateAggregatedConfidence(options.evidence);

  return {
    id: idGenerator(),
    source: options.sourceNodeId,
    target: options.targetNodeId,
    type: TG_EDGE_TYPES.SOURCES,
    label: `sources:${options.sourceType}`,
    metadata: createEdgeMetadata(options.evidence, confidence),
    scanId: factoryOptions.scanId,
    confidence,
    evidence: options.evidence,
    sourceExpression: options.sourceExpression,
    sourceType: options.sourceType,
    versionConstraint: options.versionConstraint,
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

type AnyEdgeOptions = TgIncludesEdgeOptions | TgDependsOnEdgeOptions | TgPassesInputEdgeOptions | TgSourcesEdgeOptions;

/**
 * Validate edge options before creating an edge.
 * @throws {TerragruntEdgeError} If validation fails
 */
export function validateEdgeOptions(options: AnyEdgeOptions, edgeType: TgEdgeType): void {
  // Validate source node ID
  if (!options.sourceNodeId || typeof options.sourceNodeId !== 'string') {
    throw TerragruntEdgeError.missingField('sourceNodeId', edgeType, {
      targetNodeId: options.targetNodeId,
    });
  }

  // Validate target node ID
  if (!options.targetNodeId || typeof options.targetNodeId !== 'string') {
    throw TerragruntEdgeError.missingField('targetNodeId', edgeType, {
      sourceNodeId: options.sourceNodeId,
    });
  }

  // Check for self-referential edge
  if (options.sourceNodeId === options.targetNodeId) {
    throw TerragruntEdgeError.selfReferential(options.sourceNodeId, edgeType);
  }

  // Validate evidence array
  try {
    validateTgEdgeEvidenceArray(options.evidence, `${edgeType} evidence`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw TerragruntEdgeError.invalidEvidence(message, edgeType, undefined, {
      sourceNodeId: options.sourceNodeId,
      targetNodeId: options.targetNodeId,
    });
  }

  // Validate type-specific options
  switch (edgeType) {
    case TG_EDGE_TYPES.INCLUDES:
      validateIncludesOptions(options as TgIncludesEdgeOptions, edgeType);
      break;
    case TG_EDGE_TYPES.DEPENDS_ON:
      validateDependsOnOptions(options as TgDependsOnEdgeOptions, edgeType);
      break;
    case TG_EDGE_TYPES.PASSES_INPUT:
      validatePassesInputOptions(options as TgPassesInputEdgeOptions, edgeType);
      break;
    case TG_EDGE_TYPES.SOURCES:
      validateSourcesOptions(options as TgSourcesEdgeOptions, edgeType);
      break;
  }
}

function validateIncludesOptions(options: TgIncludesEdgeOptions, edgeType: string): void {
  const context = { sourceNodeId: options.sourceNodeId, targetNodeId: options.targetNodeId, edgeType };

  if (!options.includeName || typeof options.includeName !== 'string') {
    throw TerragruntEdgeError.missingField('includeName', edgeType, context);
  }
  if (!['no_merge', 'shallow', 'deep'].includes(options.mergeStrategy)) {
    throw TerragruntEdgeError.invalidFieldValue(
      'mergeStrategy',
      'no_merge | shallow | deep',
      String(options.mergeStrategy),
      edgeType,
      context
    );
  }
  if (!Array.isArray(options.inheritedBlocks)) {
    throw TerragruntEdgeError.invalidFieldValue(
      'inheritedBlocks',
      'array',
      typeof options.inheritedBlocks,
      edgeType,
      context
    );
  }
  if (typeof options.exposeAsVariable !== 'boolean') {
    throw TerragruntEdgeError.invalidFieldValue(
      'exposeAsVariable',
      'boolean',
      typeof options.exposeAsVariable,
      edgeType,
      context
    );
  }
}

function validateDependsOnOptions(options: TgDependsOnEdgeOptions, edgeType: string): void {
  const context = { sourceNodeId: options.sourceNodeId, targetNodeId: options.targetNodeId, edgeType };

  if (!options.dependencyName || typeof options.dependencyName !== 'string') {
    throw TerragruntEdgeError.missingField('dependencyName', edgeType, context);
  }
  if (typeof options.skipOutputs !== 'boolean') {
    throw TerragruntEdgeError.invalidFieldValue(
      'skipOutputs',
      'boolean',
      typeof options.skipOutputs,
      edgeType,
      context
    );
  }
  if (!Array.isArray(options.outputsConsumed)) {
    throw TerragruntEdgeError.invalidFieldValue(
      'outputsConsumed',
      'array',
      typeof options.outputsConsumed,
      edgeType,
      context
    );
  }
  if (typeof options.hasMockOutputs !== 'boolean') {
    throw TerragruntEdgeError.invalidFieldValue(
      'hasMockOutputs',
      'boolean',
      typeof options.hasMockOutputs,
      edgeType,
      context
    );
  }
}

function validatePassesInputOptions(options: TgPassesInputEdgeOptions, edgeType: string): void {
  const context = { sourceNodeId: options.sourceNodeId, targetNodeId: options.targetNodeId, edgeType };

  if (!options.inputName || typeof options.inputName !== 'string') {
    throw TerragruntEdgeError.missingField('inputName', edgeType, context);
  }
  if (!options.sourceExpression || typeof options.sourceExpression !== 'string') {
    throw TerragruntEdgeError.missingField('sourceExpression', edgeType, context);
  }
  if (typeof options.viaDependencyOutputs !== 'boolean') {
    throw TerragruntEdgeError.invalidFieldValue(
      'viaDependencyOutputs',
      'boolean',
      typeof options.viaDependencyOutputs,
      edgeType,
      context
    );
  }
  if (options.dependencyName !== null && typeof options.dependencyName !== 'string') {
    throw TerragruntEdgeError.invalidFieldValue(
      'dependencyName',
      'null | string',
      typeof options.dependencyName,
      edgeType,
      context
    );
  }
}

function validateSourcesOptions(options: TgSourcesEdgeOptions, edgeType: string): void {
  const context = { sourceNodeId: options.sourceNodeId, targetNodeId: options.targetNodeId, edgeType };

  if (!options.sourceExpression || typeof options.sourceExpression !== 'string') {
    throw TerragruntEdgeError.missingField('sourceExpression', edgeType, context);
  }
  const validTypes = ['local', 'git', 'registry', 's3', 'gcs', 'http', 'unknown'];
  if (!validTypes.includes(options.sourceType)) {
    throw TerragruntEdgeError.invalidFieldValue(
      'sourceType',
      validTypes.join(' | '),
      options.sourceType,
      edgeType,
      context
    );
  }
  if (options.versionConstraint !== null && typeof options.versionConstraint !== 'string') {
    throw TerragruntEdgeError.invalidFieldValue(
      'versionConstraint',
      'null | string',
      typeof options.versionConstraint,
      edgeType,
      context
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEdgeMetadata(evidence: readonly TgEdgeEvidence[], confidence: number): EdgeMetadata {
  const primary = evidence.length > 0 ? evidence[0] : null;
  const location: NodeLocation | undefined = primary
    ? { file: primary.file, lineStart: primary.lineStart, lineEnd: primary.lineEnd }
    : undefined;

  const graphEvidence: GraphEdgeEvidence[] = evidence.map(e => ({
    type: e.evidenceType === 'explicit' ? 'explicit' : e.evidenceType === 'inferred' ? 'semantic' : 'heuristic',
    description: e.description,
    location: { file: e.file, lineStart: e.lineStart, lineEnd: e.lineEnd },
  }));

  return {
    location,
    implicit: !evidence.some(e => e.evidenceType === 'explicit'),
    confidence,
    evidence: graphEvidence.length > 0 ? graphEvidence : undefined,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTgIncludesEdge(edge: TgEdge): edge is TgIncludesEdge {
  return edge.type === TG_EDGE_TYPES.INCLUDES;
}

export function isTgDependsOnEdge(edge: TgEdge): edge is TgDependsOnEdge {
  return edge.type === TG_EDGE_TYPES.DEPENDS_ON;
}

export function isTgPassesInputEdge(edge: TgEdge): edge is TgPassesInputEdge {
  return edge.type === TG_EDGE_TYPES.PASSES_INPUT;
}

export function isTgSourcesEdge(edge: TgEdge): edge is TgSourcesEdge {
  return edge.type === TG_EDGE_TYPES.SOURCES;
}

export function isTgEdge(edge: GraphEdge | TgEdge): edge is TgEdge {
  return TG_EDGE_TYPE_VALUES.has(edge.type as TgEdgeType);
}

// ============================================================================
// Batch Factory Types
// ============================================================================

/** Result of batch edge creation */
export interface TgEdgeFactoryResult {
  readonly edges: readonly TgEdge[];
  readonly errors: readonly TgEdgeFactoryError[];
  readonly summary: TgEdgeFactorySummary;
}

/** Error during edge creation */
export interface TgEdgeFactoryError {
  readonly edgeType: TgEdgeType;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly message: string;
  readonly cause?: Error;
}

/** Summary of edge creation results */
export interface TgEdgeFactorySummary {
  readonly total: number;
  readonly byType: Record<TgEdgeType, number>;
  readonly averageConfidence: number;
  readonly errorCount: number;
}

/** Create edge factory options with defaults */
export function createEdgeFactoryOptions(
  options: Partial<TgEdgeFactoryOptions> & { scanId: string }
): TgEdgeFactoryOptions {
  return {
    ...DEFAULT_EDGE_FACTORY_OPTIONS,
    ...options,
    idGenerator: options.idGenerator ?? DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator,
  };
}

/** Validate factory options */
export function validateEdgeFactoryOptions(options: TgEdgeFactoryOptions): void {
  if (!options.scanId || typeof options.scanId !== 'string') {
    throw TerragruntEdgeError.missingField('scanId', 'factory', {
      details: { context: 'TgEdgeFactoryOptions' },
    });
  }
  if (options.idGenerator && typeof options.idGenerator !== 'function') {
    throw TerragruntEdgeError.invalidFieldValue(
      'idGenerator',
      'function',
      typeof options.idGenerator,
      'factory',
      { details: { context: 'TgEdgeFactoryOptions' } }
    );
  }
}
