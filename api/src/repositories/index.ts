/**
 * Repository Module Exports
 * @module repositories
 *
 * Exports all repository interfaces, implementations, and factory functions
 * for the IaC dependency detection data layer.
 *
 * TASK-DETECT: Data layer module exports
 * TASK-ROLLUP-001: Cross-Repository Aggregation data layer exports
 * TASK-FINAL-004: Documentation system data layer exports
 */

// ============================================================================
// Interfaces
// ============================================================================

export type {
  // Common types
  PaginationParams,
  PaginatedResult,
  SortDirection,
  SortParams,
  RepositoryResult,
  BatchResult,
  // Transaction support
  ITransactionClient,
  ITransactionManager,
  // Scan repository
  CreateScanInput,
  ScanFilterCriteria,
  IScanRepository,
  // Node repository
  CreateNodeInput,
  NodeFilterCriteria,
  INodeRepository,
  // Edge repository
  CreateEdgeInput,
  EdgeFilterCriteria,
  IEdgeRepository,
  // Evidence repository
  EvidenceEntity,
  CreateEvidenceInput,
  EvidenceFilterCriteria,
  IEvidenceRepository,
  // Graph querier
  TraversalDirection,
  GraphPath,
  CycleInfo,
  ImpactAnalysisResult,
  IGraphQuerier,
  // Unit of work
  IUnitOfWork,
} from './interfaces.js';

// Rollup repository interfaces (from service layer)
export type { IRollupRepository } from '../services/rollup/interfaces.js';

// ============================================================================
// Implementations
// ============================================================================

export { BaseRepository } from './base-repository.js';
export type { QueryOptions, ColumnMapping } from './base-repository.js';

export { ScanRepository, createScanRepository } from './scan-repository.js';
export { NodeRepository, createNodeRepository } from './node-repository.js';
export { EdgeRepository, createEdgeRepository } from './edge-repository.js';
export { EvidenceRepository, createEvidenceRepository } from './evidence-repository.js';
export { GraphQuerier, createGraphQuerier } from './graph-querier.js';
export {
  UnitOfWork,
  createUnitOfWork,
  ScanPersistenceAdapter,
  createScanPersistenceAdapter,
} from './unit-of-work.js';

// ============================================================================
// Rollup Repositories (TASK-ROLLUP-001)
// ============================================================================

export { RollupRepository, createRollupRepository } from './rollup-repository.js';

export {
  RollupMatchRepository,
  createRollupMatchRepository,
} from './rollup-match-repository.js';
export type {
  IRollupMatchRepository,
  RollupMatchEntity,
  CreateMatchInput,
  MatchCountByStrategy,
} from './rollup-match-repository.js';

export {
  MergedNodeRepository,
  createMergedNodeRepository,
} from './merged-node-repository.js';
export type {
  IMergedNodeRepository,
  MergedNodeEntity,
  UpsertMergedNodeInput,
  MergedNodeFilterCriteria,
} from './merged-node-repository.js';

// ============================================================================
// Terragrunt Node Helpers (TASK-TG-007)
// ============================================================================

export {
  TerragruntNodeHelpers,
  createTerragruntNodeHelpers,
  // TerragruntConfigNode mappers
  rowToTerragruntConfigNode,
  terragruntConfigNodeToInput,
  dbResultToTerragruntConfigNode,
  // TerragruntIncludeNode mappers
  terragruntIncludeNodeToInput,
  rowToTerragruntIncludeNode,
  // TerragruntDependencyNode mappers
  terragruntDependencyNodeToInput,
  rowToTerragruntDependencyNode,
  // Batch persistence utilities (TASK-TG-023)
  prepareTerragruntNodesForInsert,
  prepareTerragruntEdgesForInsert,
  calculateNodeCounts,
} from './terragrunt-node-helpers.js';
export type {
  NodeRow,
  TerragruntNodeRow,
  TerragruntNodeMetadata,
  TerragruntConfigNodeDbResult,
  TerragruntConfigStats,
  TerragruntFilterCriteria,
  // Batch persistence types (TASK-TG-023)
  BatchTerragruntPersistInput,
  BatchTerragruntPersistResult,
  DependencyHintInput,
  IncludeHintInput,
} from './terragrunt-node-helpers.js';

// ============================================================================
// Documentation Repositories (TASK-FINAL-004)
// ============================================================================

export {
  InMemoryDocumentationRepository,
  createDocumentationRepository,
} from './DocumentationRepository.js';
export type {
  IDocumentationRepository,
  DocPageFilterCriteria,
  CreateDocPageDTO,
  UpdateDocPageDTO,
  DocPaginationParams,
  DocPaginatedResult,
} from './DocumentationRepository.js';

export {
  InMemoryBetaCustomerRepository,
  createBetaCustomerRepository,
} from './BetaCustomerRepository.js';
export type {
  IBetaCustomerRepository,
  BetaCustomerFilterCriteria,
  BetaCustomerSortOptions,
  BetaCustomerPaginationParams,
  BetaCustomerPaginatedResult,
} from './BetaCustomerRepository.js';

export {
  InMemoryChecklistRepository,
  createChecklistRepository,
} from './ChecklistRepository.js';
export type {
  IChecklistRepository,
  ChecklistItemFilterCriteria,
  ChecklistSortOptions,
} from './ChecklistRepository.js';

// ============================================================================
// Factory Functions Aggregator
// ============================================================================

// Import for use in createRepositories
import { createUnitOfWork as _createUnitOfWork } from './unit-of-work.js';
import { createRollupRepository as _createRollupRepository } from './rollup-repository.js';
import { createRollupMatchRepository as _createRollupMatchRepository } from './rollup-match-repository.js';
import { createMergedNodeRepository as _createMergedNodeRepository } from './merged-node-repository.js';
import { createTerragruntNodeHelpers as _createTerragruntNodeHelpers } from './terragrunt-node-helpers.js';
import { createDocumentationRepository as _createDocumentationRepository } from './DocumentationRepository.js';
import { createBetaCustomerRepository as _createBetaCustomerRepository } from './BetaCustomerRepository.js';
import { createChecklistRepository as _createChecklistRepository } from './ChecklistRepository.js';

/**
 * Create all repositories with a shared unit of work
 */
export function createRepositories(): {
  scans: import('./interfaces.js').IScanRepository;
  nodes: import('./interfaces.js').INodeRepository;
  edges: import('./interfaces.js').IEdgeRepository;
  evidence: import('./interfaces.js').IEvidenceRepository;
  graphQuerier: import('./interfaces.js').IGraphQuerier;
  unitOfWork: import('./interfaces.js').IUnitOfWork;
} {
  const unitOfWork = _createUnitOfWork();

  return {
    scans: unitOfWork.scans,
    nodes: unitOfWork.nodes,
    edges: unitOfWork.edges,
    evidence: unitOfWork.evidence,
    graphQuerier: unitOfWork.graphQuerier,
    unitOfWork,
  };
}

/**
 * Create all rollup-related repositories
 * TASK-ROLLUP-001: Cross-Repository Aggregation factory
 */
export function createRollupRepositories(): {
  rollups: import('../services/rollup/interfaces.js').IRollupRepository;
  matches: import('./rollup-match-repository.js').IRollupMatchRepository;
  mergedNodes: import('./merged-node-repository.js').IMergedNodeRepository;
} {
  return {
    rollups: _createRollupRepository(),
    matches: _createRollupMatchRepository(),
    mergedNodes: _createMergedNodeRepository(),
  };
}

/**
 * Create Terragrunt-specific repository helpers
 * TASK-TG-007: Terragrunt Config Node persistence helpers
 */
export function createTerragruntRepositories(): {
  terragruntHelpers: import('./terragrunt-node-helpers.js').TerragruntNodeHelpers;
} {
  return {
    terragruntHelpers: _createTerragruntNodeHelpers(),
  };
}

/**
 * Create all documentation-related repositories
 * TASK-FINAL-004: Documentation system factory
 */
export function createDocumentationRepositories(): {
  documentation: import('./DocumentationRepository.js').IDocumentationRepository;
  betaCustomers: import('./BetaCustomerRepository.js').IBetaCustomerRepository;
  checklist: import('./ChecklistRepository.js').IChecklistRepository;
} {
  return {
    documentation: _createDocumentationRepository(),
    betaCustomers: _createBetaCustomerRepository(),
    checklist: _createChecklistRepository(),
  };
}
