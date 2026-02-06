/**
 * Terragrunt Node Repository Helpers
 * @module repositories/terragrunt-node-helpers
 *
 * TASK-TG-007: Repository helper functions for TerragruntConfigNode persistence.
 * TASK-TG-023: Extended with TerragruntIncludeNode and TerragruntDependencyNode support.
 * TASK-TG-008: Updated edge types to use tg_* variants (tg_depends_on, tg_includes).
 *              Added prepareTgEdgesForInsert and prepareSyntheticNodesForInsert functions.
 *
 * Provides specialized query and mapping functions for Terragrunt nodes.
 *
 * These helpers complement the generic NodeRepository by providing:
 * - Type-safe mapping to/from TerragruntConfigNode, TerragruntIncludeNode, TerragruntDependencyNode
 * - Optimized queries using metadata indexes
 * - Terragrunt-specific aggregation and filtering
 * - Batch persistence utilities for all Terragrunt node types
 */

import {
  TerragruntConfigNode,
  TerragruntIncludeNode,
  TerragruntDependencyNode,
  TerraformModuleNode,
  NodeLocation,
  EdgeType,
  NodeTypeName,
} from '../types/graph.js';
import { ScanId, TenantId, DbNodeId } from '../types/entities.js';
import {
  TerragruntEdgeResult,
} from '../services/terragrunt-edge-service.js';
import { CreateNodeInput, CreateEdgeInput, PaginatedResult, PaginationParams, BatchResult } from './interfaces.js';
import { BaseRepository } from './base-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Generic database row type for all node types.
 * Used by row-to-node mapper functions.
 */
export interface NodeRow {
  readonly id: string;
  readonly scan_id: string;
  readonly tenant_id: string;
  readonly original_id: string | null;
  readonly node_type: string;
  readonly name: string;
  readonly file_path: string;
  readonly line_start: number;
  readonly line_end: number;
  readonly column_start: number | null;
  readonly column_end: number | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: Date;
}

/**
 * Database row type for Terragrunt config nodes
 * Matches the nodes table schema with expanded metadata
 */
export interface TerragruntNodeRow {
  readonly id: string;
  readonly scan_id: string;
  readonly tenant_id: string;
  readonly original_id: string;
  readonly node_type: 'tg_config';
  readonly name: string;
  readonly file_path: string;
  readonly line_start: number;
  readonly line_end: number;
  readonly column_start: number | null;
  readonly column_end: number | null;
  readonly metadata: TerragruntNodeMetadata;
  readonly created_at: Date;
}

/**
 * Metadata structure for Terragrunt config nodes in the database
 */
export interface TerragruntNodeMetadata {
  readonly scanId?: string;
  readonly absolutePath?: string;
  readonly encoding?: string;
  readonly size?: number;
  readonly blockCount?: number;
  readonly errorCount?: number;
  readonly dependencyNames?: readonly string[];
  readonly includeLabels?: readonly string[];
  readonly terraformSource?: string | null;
  readonly hasRemoteState?: boolean;
  readonly remoteStateBackend?: string | null;
  readonly includeCount?: number;
  readonly dependencyCount?: number;
  readonly inputCount?: number;
  readonly generateBlocks?: readonly string[];
}

/**
 * Result from database function get_terragrunt_config_nodes
 */
export interface TerragruntConfigNodeDbResult {
  readonly node_id: string;
  readonly node_name: string;
  readonly file_path: string;
  readonly terraform_source: string | null;
  readonly has_remote_state: boolean;
  readonly remote_state_backend: string | null;
  readonly include_count: number;
  readonly dependency_count: number;
  readonly input_count: number;
  readonly generate_blocks: readonly string[];
  readonly line_start: number;
  readonly line_end: number;
  readonly created_at: Date;
  readonly total_count: number;
}

/**
 * Statistics for Terragrunt config nodes in a scan
 */
export interface TerragruntConfigStats {
  readonly totalConfigs: number;
  readonly withRemoteState: number;
  readonly withTerraformSource: number;
  readonly totalDependencies: number;
  readonly totalIncludes: number;
  readonly totalInputs: number;
  readonly uniqueBackends: number;
  readonly backendDistribution: Record<string, number>;
}

/**
 * Filter criteria specific to Terragrunt config nodes
 */
export interface TerragruntFilterCriteria {
  /** Filter by remote state backend type */
  readonly remoteStateBackend?: string;
  /** Filter configs that have remote state */
  readonly hasRemoteState?: boolean;
  /** Filter configs with minimum dependency count */
  readonly minDependencyCount?: number;
  /** Filter by terraform source pattern (ILIKE) */
  readonly terraformSourcePattern?: string;
  /** Filter by file path pattern (ILIKE) */
  readonly filePathPattern?: string;
}

/**
 * Input for batch persisting Terragrunt nodes.
 * Mirrors BatchTerragruntNodeResult from node-factory but allows for optional fields.
 */
export interface BatchTerragruntPersistInput {
  /** TerragruntConfigNode instances to persist */
  readonly configNodes: readonly TerragruntConfigNode[];
  /** TerragruntIncludeNode instances to persist */
  readonly includeNodes: readonly TerragruntIncludeNode[];
  /** TerragruntDependencyNode instances to persist */
  readonly dependencyNodes: readonly TerragruntDependencyNode[];
  /** Dependency hints for edge creation (source to target via dependency block) */
  readonly dependencyHints?: readonly DependencyHintInput[];
  /** Include hints for edge creation (source to target via include block) */
  readonly includeHints?: readonly IncludeHintInput[];
}

/**
 * Hint about a dependency relationship for edge creation.
 * Used to create 'depends_on' edges between config nodes.
 */
export interface DependencyHintInput {
  /** ID of the source node (the config with the dependency block) */
  readonly sourceId: string;
  /** ID of the target node if it was resolved (null if external) */
  readonly targetId: string | null;
  /** Name of the dependency block */
  readonly dependencyName: string;
}

/**
 * Hint about an include relationship for edge creation.
 * Used to create 'module_source' edges for include relationships.
 */
export interface IncludeHintInput {
  /** ID of the source node (the config with the include block) */
  readonly sourceId: string;
  /** ID of the target node if it was resolved (null if external) */
  readonly targetId: string | null;
  /** Label of the include block */
  readonly includeLabel: string;
  /** Merge strategy used for the include */
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
}

/**
 * Result from batch persisting Terragrunt nodes.
 */
export interface BatchTerragruntPersistResult {
  /** Total nodes inserted */
  readonly nodeCount: number;
  /** Total edges created */
  readonly edgeCount: number;
  /** Breakdown of node counts by type */
  readonly nodesByType: {
    readonly config: number;
    readonly include: number;
    readonly dependency: number;
  };
  /** Batch operation results for nodes */
  readonly nodeBatchResult: BatchResult;
  /** Batch operation results for edges (if any edges were created) */
  readonly edgeBatchResult?: BatchResult;
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert a database row to TerragruntConfigNode.
 *
 * Maps the flat database row structure to the nested TerragruntConfigNode
 * type expected by the graph system.
 *
 * @param row - Database row from nodes table
 * @returns TerragruntConfigNode instance
 */
export function rowToTerragruntConfigNode(row: TerragruntNodeRow): TerragruntConfigNode {
  const metadata = row.metadata || {};

  const location: NodeLocation = {
    file: row.file_path,
    lineStart: row.line_start,
    lineEnd: row.line_end,
    ...(row.column_start !== null && { columnStart: row.column_start }),
    ...(row.column_end !== null && { columnEnd: row.column_end }),
  };

  return {
    id: row.id,
    type: 'tg_config',
    name: row.name,
    location,
    metadata: {
      scanId: metadata.scanId ?? row.scan_id,
      absolutePath: metadata.absolutePath,
      encoding: metadata.encoding,
      size: metadata.size,
      blockCount: metadata.blockCount,
      errorCount: metadata.errorCount,
      dependencyNames: metadata.dependencyNames ?? [],
      includeLabels: metadata.includeLabels ?? [],
    },
    terraformSource: metadata.terraformSource ?? null,
    hasRemoteState: metadata.hasRemoteState ?? false,
    remoteStateBackend: metadata.remoteStateBackend ?? null,
    includeCount: metadata.includeCount ?? 0,
    dependencyCount: metadata.dependencyCount ?? 0,
    inputCount: metadata.inputCount ?? 0,
    generateBlocks: Object.freeze(metadata.generateBlocks ?? []),
  };
}

/**
 * Convert a TerragruntConfigNode to database insert parameters.
 *
 * Creates a CreateNodeInput compatible with the NodeRepository batch operations.
 * Flattens the nested node structure into the flat table schema.
 *
 * @param node - TerragruntConfigNode to convert
 * @param scanId - Scan ID for the node
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns CreateNodeInput for database insertion
 */
export function terragruntConfigNodeToInput(
  node: TerragruntConfigNode,
  scanId: ScanId,
  tenantId: TenantId
): CreateNodeInput {
  const input: CreateNodeInput = {
    scanId,
    tenantId,
    originalId: node.id,
    nodeType: 'tg_config',
    name: node.name,
    filePath: node.location.file,
    lineStart: node.location.lineStart,
    lineEnd: node.location.lineEnd,
    metadata: {
      // Pass through existing metadata
      ...node.metadata,
      // Add TerragruntConfigNode-specific fields
      terraformSource: node.terraformSource,
      hasRemoteState: node.hasRemoteState,
      remoteStateBackend: node.remoteStateBackend,
      includeCount: node.includeCount,
      dependencyCount: node.dependencyCount,
      inputCount: node.inputCount,
      generateBlocks: [...node.generateBlocks],
    },
  };

  // Conditionally add optional column properties
  if (node.location.columnStart !== undefined) {
    (input as { columnStart?: number }).columnStart = node.location.columnStart;
  }
  if (node.location.columnEnd !== undefined) {
    (input as { columnEnd?: number }).columnEnd = node.location.columnEnd;
  }

  return input;
}

/**
 * Convert function result to TerragruntConfigNode.
 *
 * Maps the result from get_terragrunt_config_nodes database function
 * to the TerragruntConfigNode type.
 *
 * @param result - Database function result row
 * @returns TerragruntConfigNode instance
 */
export function dbResultToTerragruntConfigNode(
  result: TerragruntConfigNodeDbResult
): TerragruntConfigNode {
  return {
    id: result.node_id,
    type: 'tg_config',
    name: result.node_name,
    location: {
      file: result.file_path,
      lineStart: result.line_start,
      lineEnd: result.line_end,
    },
    metadata: {},
    terraformSource: result.terraform_source,
    hasRemoteState: result.has_remote_state,
    remoteStateBackend: result.remote_state_backend,
    includeCount: result.include_count,
    dependencyCount: result.dependency_count,
    inputCount: result.input_count,
    generateBlocks: Object.freeze([...result.generate_blocks]),
  };
}

// ============================================================================
// TerragruntIncludeNode Mapper Functions
// ============================================================================

/**
 * Convert TerragruntIncludeNode to database input format.
 *
 * Maps the TerragruntIncludeNode structure to CreateNodeInput for
 * batch insertion via NodeRepository.
 *
 * @param node - TerragruntIncludeNode to convert
 * @param scanId - Scan ID for the node
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns CreateNodeInput for database insertion
 */
export function terragruntIncludeNodeToInput(
  node: TerragruntIncludeNode,
  scanId: ScanId,
  tenantId: TenantId
): CreateNodeInput {
  const input: CreateNodeInput = {
    scanId,
    tenantId,
    originalId: node.id,
    nodeType: 'tg_include',
    name: node.name,
    filePath: node.location.file,
    lineStart: node.location.lineStart,
    lineEnd: node.location.lineEnd,
    metadata: {
      label: node.label,
      path: node.path,
      resolvedPath: node.resolvedPath,
      expose: node.expose,
      mergeStrategy: node.mergeStrategy,
      ...node.metadata,
    },
  };

  // Conditionally add optional column properties
  if (node.location.columnStart !== undefined) {
    (input as { columnStart?: number }).columnStart = node.location.columnStart;
  }
  if (node.location.columnEnd !== undefined) {
    (input as { columnEnd?: number }).columnEnd = node.location.columnEnd;
  }

  return input;
}

/**
 * Convert database row to TerragruntIncludeNode.
 *
 * Reconstitutes a TerragruntIncludeNode from database storage,
 * extracting include-specific fields from JSONB metadata.
 *
 * @param row - Database row from nodes table
 * @returns TerragruntIncludeNode instance
 */
export function rowToTerragruntIncludeNode(row: NodeRow): TerragruntIncludeNode {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;

  const location: NodeLocation = {
    file: row.file_path,
    lineStart: row.line_start,
    lineEnd: row.line_end,
    ...(row.column_start !== null && { columnStart: row.column_start }),
    ...(row.column_end !== null && { columnEnd: row.column_end }),
  };

  return {
    id: row.original_id || row.id,
    type: 'tg_include',
    name: row.name,
    location,
    metadata,
    label: (metadata.label as string) || row.name,
    path: (metadata.path as string) || '',
    resolvedPath: (metadata.resolvedPath as string | null) ?? null,
    expose: (metadata.expose as boolean) ?? false,
    mergeStrategy: (metadata.mergeStrategy as 'no_merge' | 'shallow' | 'deep') || 'no_merge',
  };
}

// ============================================================================
// TerragruntDependencyNode Mapper Functions
// ============================================================================

/**
 * Convert TerragruntDependencyNode to database input format.
 *
 * Maps the TerragruntDependencyNode structure to CreateNodeInput for
 * batch insertion via NodeRepository.
 *
 * @param node - TerragruntDependencyNode to convert
 * @param scanId - Scan ID for the node
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns CreateNodeInput for database insertion
 */
export function terragruntDependencyNodeToInput(
  node: TerragruntDependencyNode,
  scanId: ScanId,
  tenantId: TenantId
): CreateNodeInput {
  const input: CreateNodeInput = {
    scanId,
    tenantId,
    originalId: node.id,
    nodeType: 'tg_dependency',
    name: node.name,
    filePath: node.location.file,
    lineStart: node.location.lineStart,
    lineEnd: node.location.lineEnd,
    metadata: {
      dependencyName: node.dependencyName,
      configPath: node.configPath,
      resolvedPath: node.resolvedPath,
      skipOutputs: node.skipOutputs,
      hasMockOutputs: node.hasMockOutputs,
      ...node.metadata,
    },
  };

  // Conditionally add optional column properties
  if (node.location.columnStart !== undefined) {
    (input as { columnStart?: number }).columnStart = node.location.columnStart;
  }
  if (node.location.columnEnd !== undefined) {
    (input as { columnEnd?: number }).columnEnd = node.location.columnEnd;
  }

  return input;
}

/**
 * Convert database row to TerragruntDependencyNode.
 *
 * Reconstitutes a TerragruntDependencyNode from database storage,
 * extracting dependency-specific fields from JSONB metadata.
 *
 * @param row - Database row from nodes table
 * @returns TerragruntDependencyNode instance
 */
export function rowToTerragruntDependencyNode(row: NodeRow): TerragruntDependencyNode {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;

  const location: NodeLocation = {
    file: row.file_path,
    lineStart: row.line_start,
    lineEnd: row.line_end,
    ...(row.column_start !== null && { columnStart: row.column_start }),
    ...(row.column_end !== null && { columnEnd: row.column_end }),
  };

  return {
    id: row.original_id || row.id,
    type: 'tg_dependency',
    name: row.name,
    location,
    metadata,
    dependencyName: (metadata.dependencyName as string) || row.name,
    configPath: (metadata.configPath as string) || '',
    resolvedPath: (metadata.resolvedPath as string | null) ?? null,
    skipOutputs: (metadata.skipOutputs as boolean) ?? false,
    hasMockOutputs: (metadata.hasMockOutputs as boolean) ?? false,
  };
}

// ============================================================================
// Repository Helper Class
// ============================================================================

/**
 * Terragrunt-specific repository helpers.
 *
 * Extends BaseRepository to provide optimized queries and operations
 * for TerragruntConfigNode entities. Uses database functions for
 * complex aggregations.
 */
export class TerragruntNodeHelpers extends BaseRepository {
  constructor() {
    super('nodes');
  }

  /**
   * Find all Terragrunt config nodes for a scan.
   *
   * Uses the idx_nodes_tg_config_scan index for efficient filtering.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @param pagination - Optional pagination parameters
   * @returns Paginated list of TerragruntConfigNode
   */
  async findTerragruntConfigNodes(
    scanId: ScanId,
    tenantId: TenantId,
    pagination: PaginationParams = { page: 1, pageSize: 100 }
  ): Promise<PaginatedResult<TerragruntConfigNode>> {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    // Use the database function for expanded metadata
    const query = `
      SELECT * FROM get_terragrunt_config_nodes($1, $2, $3, $4)
    `;

    const rows = await this.queryAll<TerragruntConfigNodeDbResult & { total_count: string }>(
      query,
      [tenantId, scanId, pageSize, offset],
      { tenantId }
    );

    const firstRow = rows[0];
    const total = firstRow !== undefined ? parseInt(String(firstRow.total_count), 10) : 0;
    const data = rows.map(dbResultToTerragruntConfigNode);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Find Terragrunt config nodes with custom filtering.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @param filter - Terragrunt-specific filter criteria
   * @returns Array of matching TerragruntConfigNode
   */
  async findWithFilter(
    scanId: ScanId,
    tenantId: TenantId,
    filter: TerragruntFilterCriteria
  ): Promise<TerragruntConfigNode[]> {
    const conditions: string[] = ['scan_id = $1', "type = 'tg_config'"];
    const params: unknown[] = [scanId];
    let paramIndex = 2;

    if (filter.remoteStateBackend !== undefined) {
      conditions.push(`metadata->>'remoteStateBackend' = $${paramIndex++}`);
      params.push(filter.remoteStateBackend);
    }

    if (filter.hasRemoteState !== undefined) {
      conditions.push(`(metadata->>'hasRemoteState')::boolean = $${paramIndex++}`);
      params.push(filter.hasRemoteState);
    }

    if (filter.minDependencyCount !== undefined) {
      conditions.push(`COALESCE((metadata->>'dependencyCount')::integer, 0) >= $${paramIndex++}`);
      params.push(filter.minDependencyCount);
    }

    if (filter.terraformSourcePattern !== undefined) {
      conditions.push(`metadata->>'terraformSource' ILIKE $${paramIndex++}`);
      params.push(`%${filter.terraformSourcePattern}%`);
    }

    if (filter.filePathPattern !== undefined) {
      conditions.push(`file_path ILIKE $${paramIndex++}`);
      params.push(`%${filter.filePathPattern}%`);
    }

    const query = `
      SELECT * FROM nodes
      WHERE ${conditions.join(' AND ')}
      ORDER BY file_path, line_start
    `;

    const rows = await this.queryAll<TerragruntNodeRow>(query, params, { tenantId });
    return rows.map(rowToTerragruntConfigNode);
  }

  /**
   * Get statistics for Terragrunt config nodes in a scan.
   *
   * Uses the get_terragrunt_config_stats database function.
   *
   * @param scanId - Scan to analyze
   * @param tenantId - Tenant for RLS
   * @returns Aggregate statistics
   */
  async getStats(scanId: ScanId, tenantId: TenantId): Promise<TerragruntConfigStats> {
    const query = `SELECT * FROM get_terragrunt_config_stats($1, $2)`;

    const row = await this.queryOne<{
      total_configs: string;
      with_remote_state: string;
      with_terraform_source: string;
      total_dependencies: string;
      total_includes: string;
      total_inputs: string;
      unique_backends: string;
      backend_distribution: Record<string, number>;
    }>(query, [tenantId, scanId], { tenantId });

    if (!row) {
      return {
        totalConfigs: 0,
        withRemoteState: 0,
        withTerraformSource: 0,
        totalDependencies: 0,
        totalIncludes: 0,
        totalInputs: 0,
        uniqueBackends: 0,
        backendDistribution: {},
      };
    }

    return {
      totalConfigs: parseInt(row.total_configs, 10),
      withRemoteState: parseInt(row.with_remote_state, 10),
      withTerraformSource: parseInt(row.with_terraform_source, 10),
      totalDependencies: parseInt(row.total_dependencies, 10),
      totalIncludes: parseInt(row.total_includes, 10),
      totalInputs: parseInt(row.total_inputs, 10),
      uniqueBackends: parseInt(row.unique_backends, 10),
      backendDistribution: row.backend_distribution || {},
    };
  }

  /**
   * Find Terragrunt configs by remote state backend type.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @param backendType - Backend type (e.g., 's3', 'gcs', 'azurerm')
   * @returns Array of matching nodes
   */
  async findByBackend(
    scanId: ScanId,
    tenantId: TenantId,
    backendType: string
  ): Promise<TerragruntConfigNode[]> {
    const query = `
      SELECT n.* FROM nodes n
      WHERE n.scan_id = $1
        AND n.type = 'tg_config'
        AND n.metadata->>'remoteStateBackend' = $2
      ORDER BY n.file_path
    `;

    const rows = await this.queryAll<TerragruntNodeRow>(
      query,
      [scanId, backendType],
      { tenantId }
    );

    return rows.map(rowToTerragruntConfigNode);
  }

  /**
   * Find Terragrunt configs that have dependencies.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @param minDependencyCount - Minimum number of dependencies
   * @returns Array of nodes with their dependency info
   */
  async findWithDependencies(
    scanId: ScanId,
    tenantId: TenantId,
    minDependencyCount: number = 1
  ): Promise<Array<TerragruntConfigNode & { dependencyNames: readonly string[] }>> {
    const query = `
      SELECT * FROM find_terragrunt_configs_with_dependencies($1, $2, $3)
    `;

    const rows = await this.queryAll<{
      node_id: string;
      node_name: string;
      file_path: string;
      dependency_count: number;
      dependency_names: string[];
    }>(query, [tenantId, scanId, minDependencyCount], { tenantId });

    // Need to fetch full node data for complete conversion
    const nodeIds = rows.map(r => r.node_id);
    if (nodeIds.length === 0) {
      return [];
    }

    const placeholders = nodeIds.map((_, i) => `$${i + 2}`).join(', ');
    const fullQuery = `
      SELECT * FROM nodes
      WHERE scan_id = $1
        AND type = 'tg_config'
        AND id IN (${placeholders})
      ORDER BY file_path
    `;

    const fullRows = await this.queryAll<TerragruntNodeRow>(
      fullQuery,
      [scanId, ...nodeIds],
      { tenantId }
    );

    // Create a map for dependency names lookup
    const depNamesMap = new Map<string, readonly string[]>();
    for (const row of rows) {
      depNamesMap.set(row.node_id, Object.freeze(row.dependency_names));
    }

    return fullRows.map(row => ({
      ...rowToTerragruntConfigNode(row),
      dependencyNames: depNamesMap.get(row.id) ?? [],
    }));
  }

  /**
   * Batch convert TerragruntConfigNode instances to CreateNodeInput.
   *
   * Utility for preparing nodes for batch insertion via NodeRepository.
   *
   * @param nodes - Array of TerragruntConfigNode to convert
   * @param scanId - Scan ID for all nodes
   * @param tenantId - Tenant ID for all nodes
   * @returns Array of CreateNodeInput ready for batch insert
   */
  batchToInput(
    nodes: readonly TerragruntConfigNode[],
    scanId: ScanId,
    tenantId: TenantId
  ): CreateNodeInput[] {
    return nodes.map(node => terragruntConfigNodeToInput(node, scanId, tenantId));
  }

  /**
   * Batch convert TerragruntIncludeNode instances to CreateNodeInput.
   *
   * Utility for preparing include nodes for batch insertion via NodeRepository.
   *
   * @param nodes - Array of TerragruntIncludeNode to convert
   * @param scanId - Scan ID for all nodes
   * @param tenantId - Tenant ID for all nodes
   * @returns Array of CreateNodeInput ready for batch insert
   */
  batchIncludeNodesToInput(
    nodes: readonly TerragruntIncludeNode[],
    scanId: ScanId,
    tenantId: TenantId
  ): CreateNodeInput[] {
    return nodes.map(node => terragruntIncludeNodeToInput(node, scanId, tenantId));
  }

  /**
   * Batch convert TerragruntDependencyNode instances to CreateNodeInput.
   *
   * Utility for preparing dependency nodes for batch insertion via NodeRepository.
   *
   * @param nodes - Array of TerragruntDependencyNode to convert
   * @param scanId - Scan ID for all nodes
   * @param tenantId - Tenant ID for all nodes
   * @returns Array of CreateNodeInput ready for batch insert
   */
  batchDependencyNodesToInput(
    nodes: readonly TerragruntDependencyNode[],
    scanId: ScanId,
    tenantId: TenantId
  ): CreateNodeInput[] {
    return nodes.map(node => terragruntDependencyNodeToInput(node, scanId, tenantId));
  }

  /**
   * Find all Terragrunt include nodes for a scan.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @returns Array of TerragruntIncludeNode
   */
  async findIncludeNodes(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<TerragruntIncludeNode[]> {
    const query = `
      SELECT * FROM nodes
      WHERE scan_id = $1
        AND node_type = 'tg_include'
      ORDER BY file_path, line_start
    `;

    const rows = await this.queryAll<NodeRow>(
      query,
      [scanId],
      { tenantId }
    );

    return rows.map(rowToTerragruntIncludeNode);
  }

  /**
   * Find all Terragrunt dependency nodes for a scan.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @returns Array of TerragruntDependencyNode
   */
  async findDependencyNodes(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<TerragruntDependencyNode[]> {
    const query = `
      SELECT * FROM nodes
      WHERE scan_id = $1
        AND node_type = 'tg_dependency'
      ORDER BY file_path, line_start
    `;

    const rows = await this.queryAll<NodeRow>(
      query,
      [scanId],
      { tenantId }
    );

    return rows.map(rowToTerragruntDependencyNode);
  }

  /**
   * Find include nodes by parent config path.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @param resolvedPath - The resolved path to the parent config
   * @returns Array of include nodes pointing to this path
   */
  async findIncludesByResolvedPath(
    scanId: ScanId,
    tenantId: TenantId,
    resolvedPath: string
  ): Promise<TerragruntIncludeNode[]> {
    const query = `
      SELECT * FROM nodes
      WHERE scan_id = $1
        AND node_type = 'tg_include'
        AND metadata->>'resolvedPath' = $2
      ORDER BY file_path, line_start
    `;

    const rows = await this.queryAll<NodeRow>(
      query,
      [scanId, resolvedPath],
      { tenantId }
    );

    return rows.map(rowToTerragruntIncludeNode);
  }

  /**
   * Find dependency nodes by resolved config path.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @param resolvedPath - The resolved path to the dependency config
   * @returns Array of dependency nodes pointing to this path
   */
  async findDependenciesByResolvedPath(
    scanId: ScanId,
    tenantId: TenantId,
    resolvedPath: string
  ): Promise<TerragruntDependencyNode[]> {
    const query = `
      SELECT * FROM nodes
      WHERE scan_id = $1
        AND node_type = 'tg_dependency'
        AND metadata->>'resolvedPath' = $2
      ORDER BY file_path, line_start
    `;

    const rows = await this.queryAll<NodeRow>(
      query,
      [scanId, resolvedPath],
      { tenantId }
    );

    return rows.map(rowToTerragruntDependencyNode);
  }

  /**
   * Get Terragrunt node counts by type for a scan.
   *
   * Returns counts for tg_config, tg_include, and tg_dependency nodes.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @returns Object with counts for each Terragrunt node type
   */
  async getTerragruntNodeCounts(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<{
    configCount: number;
    includeCount: number;
    dependencyCount: number;
    totalCount: number;
  }> {
    const query = `
      SELECT
        node_type,
        COUNT(*)::int as count
      FROM nodes
      WHERE scan_id = $1
        AND node_type IN ('tg_config', 'tg_include', 'tg_dependency')
      GROUP BY node_type
    `;

    const rows = await this.queryAll<{ node_type: string; count: number }>(
      query,
      [scanId],
      { tenantId }
    );

    const counts = {
      configCount: 0,
      includeCount: 0,
      dependencyCount: 0,
      totalCount: 0,
    };

    for (const row of rows) {
      switch (row.node_type) {
        case 'tg_config':
          counts.configCount = row.count;
          break;
        case 'tg_include':
          counts.includeCount = row.count;
          break;
        case 'tg_dependency':
          counts.dependencyCount = row.count;
          break;
      }
      counts.totalCount += row.count;
    }

    return counts;
  }

  /**
   * Find all unresolved include nodes for a scan.
   *
   * Returns include nodes where resolvedPath is null, indicating
   * the target configuration file was not found during parsing.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @returns Array of unresolved include nodes
   */
  async findUnresolvedIncludes(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<TerragruntIncludeNode[]> {
    const query = `
      SELECT * FROM nodes
      WHERE scan_id = $1
        AND node_type = 'tg_include'
        AND (metadata->>'resolvedPath') IS NULL
      ORDER BY file_path, line_start
    `;

    const rows = await this.queryAll<NodeRow>(
      query,
      [scanId],
      { tenantId }
    );

    return rows.map(rowToTerragruntIncludeNode);
  }

  /**
   * Find all unresolved dependency nodes for a scan.
   *
   * Returns dependency nodes where resolvedPath is null, indicating
   * the target configuration file was not found during parsing.
   *
   * @param scanId - Scan to query
   * @param tenantId - Tenant for RLS
   * @returns Array of unresolved dependency nodes
   */
  async findUnresolvedDependencies(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<TerragruntDependencyNode[]> {
    const query = `
      SELECT * FROM nodes
      WHERE scan_id = $1
        AND node_type = 'tg_dependency'
        AND (metadata->>'resolvedPath') IS NULL
      ORDER BY file_path, line_start
    `;

    const rows = await this.queryAll<NodeRow>(
      query,
      [scanId],
      { tenantId }
    );

    return rows.map(rowToTerragruntDependencyNode);
  }
}

// ============================================================================
// Batch Persistence Functions
// ============================================================================

/**
 * Prepare all nodes from a batch result for database insertion.
 *
 * Converts all TerragruntConfigNode, TerragruntIncludeNode, and TerragruntDependencyNode
 * instances to CreateNodeInput format ready for NodeRepository.batchInsert().
 *
 * @param input - Batch input containing all node types
 * @param scanId - Scan ID for all nodes
 * @param tenantId - Tenant ID for all nodes
 * @returns Array of CreateNodeInput ready for batch insertion
 */
export function prepareTerragruntNodesForInsert(
  input: BatchTerragruntPersistInput,
  scanId: ScanId,
  tenantId: TenantId
): CreateNodeInput[] {
  const nodeInputs: CreateNodeInput[] = [];

  // Add config nodes
  for (const node of input.configNodes) {
    nodeInputs.push(terragruntConfigNodeToInput(node, scanId, tenantId));
  }

  // Add include nodes
  for (const node of input.includeNodes) {
    nodeInputs.push(terragruntIncludeNodeToInput(node, scanId, tenantId));
  }

  // Add dependency nodes
  for (const node of input.dependencyNodes) {
    nodeInputs.push(terragruntDependencyNodeToInput(node, scanId, tenantId));
  }

  return nodeInputs;
}

/**
 * Prepare edges from dependency and include hints for database insertion.
 *
 * Creates edges for resolved hints (where targetId is not null).
 * - Dependency hints create 'depends_on' edges
 * - Include hints create 'module_source' edges (representing configuration inheritance)
 *
 * @param input - Batch input containing hints
 * @param scanId - Scan ID for all edges
 * @param tenantId - Tenant ID for all edges
 * @param nodeIdMapping - Map from original node ID to database node ID
 * @returns Array of CreateEdgeInput ready for batch insertion
 */
export function prepareTerragruntEdgesForInsert(
  input: BatchTerragruntPersistInput,
  scanId: ScanId,
  tenantId: TenantId,
  nodeIdMapping: Map<string, DbNodeId>
): CreateEdgeInput[] {
  const edgeInputs: CreateEdgeInput[] = [];
  let edgeIndex = 0;

  // Create edges from dependency hints
  if (input.dependencyHints) {
    for (const hint of input.dependencyHints) {
      // Only create edges for resolved dependencies
      if (hint.targetId === null) {
        continue;
      }

      const sourceDbId = nodeIdMapping.get(hint.sourceId);
      const targetDbId = nodeIdMapping.get(hint.targetId);

      if (sourceDbId && targetDbId) {
        edgeInputs.push({
          scanId,
          tenantId,
          originalId: `tg_dep_edge_${edgeIndex++}`,
          sourceNodeId: sourceDbId,
          targetNodeId: targetDbId,
          edgeType: 'tg_depends_on' as EdgeType,
          label: `dependency:${hint.dependencyName}`,
          isImplicit: false,
          confidence: 100, // Explicit dependency blocks are certain
          metadata: {
            dependencyName: hint.dependencyName,
            edgeSource: 'terragrunt_dependency_block',
          },
        });
      }
    }
  }

  // Create edges from include hints
  if (input.includeHints) {
    for (const hint of input.includeHints) {
      // Only create edges for resolved includes
      if (hint.targetId === null) {
        continue;
      }

      const sourceDbId = nodeIdMapping.get(hint.sourceId);
      const targetDbId = nodeIdMapping.get(hint.targetId);

      if (sourceDbId && targetDbId) {
        edgeInputs.push({
          scanId,
          tenantId,
          originalId: `tg_inc_edge_${edgeIndex++}`,
          sourceNodeId: sourceDbId,
          targetNodeId: targetDbId,
          edgeType: 'tg_includes' as EdgeType, // Terragrunt-specific include edge type
          label: `include:${hint.includeLabel}`,
          isImplicit: false,
          confidence: 100, // Explicit include blocks are certain
          metadata: {
            includeLabel: hint.includeLabel,
            mergeStrategy: hint.mergeStrategy,
            edgeSource: 'terragrunt_include_block',
          },
        });
      }
    }
  }

  return edgeInputs;
}

/**
 * Calculate counts breakdown from batch persist input.
 *
 * @param input - Batch input to count
 * @returns Node counts by type
 */
export function calculateNodeCounts(input: BatchTerragruntPersistInput): {
  config: number;
  include: number;
  dependency: number;
  total: number;
} {
  const config = input.configNodes.length;
  const include = input.includeNodes.length;
  const dependency = input.dependencyNodes.length;

  return {
    config,
    include,
    dependency,
    total: config + include + dependency,
  };
}

// ============================================================================
// TASK-TG-008: Terragrunt Edge Service Integration Functions
// ============================================================================

/**
 * Prepare Terragrunt-specific edges using the new tg_* edge types.
 *
 * Converts edges from TerragruntEdgeResult (from TerragruntEdgeService) to
 * CreateEdgeInput format for database insertion. Uses the new tg_* edge types
 * defined in TASK-TG-008:
 * - tg_includes: Include relationships (child -> parent config)
 * - tg_depends_on: Dependency relationships (config -> dependency config)
 * - tg_passes_input: Input flow relationships
 * - tg_sources: Terraform source relationships (TG config -> TF module)
 *
 * @param edgeResult - Result from TerragruntEdgeService.createEdgesFromNodeResult()
 * @param scanId - Scan ID for all edges
 * @param tenantId - Tenant ID for multi-tenancy
 * @param nodeIdMapping - Map from original node ID to database node ID
 * @returns Array of CreateEdgeInput ready for batch insertion
 */
export function prepareTgEdgesForInsert(
  edgeResult: TerragruntEdgeResult,
  scanId: ScanId,
  tenantId: TenantId,
  nodeIdMapping: Map<string, DbNodeId>
): CreateEdgeInput[] {
  const edgeInputs: CreateEdgeInput[] = [];

  for (let index = 0; index < edgeResult.edges.length; index++) {
    const edge = edgeResult.edges[index];
    const sourceDbId = nodeIdMapping.get(edge.source);
    const targetDbId = nodeIdMapping.get(edge.target);

    // Skip edges where source or target nodes are not in the mapping
    if (!sourceDbId || !targetDbId) {
      continue;
    }

    edgeInputs.push({
      scanId,
      tenantId,
      originalId: `tg_edge_${index}`,
      sourceNodeId: sourceDbId,
      targetNodeId: targetDbId,
      edgeType: edge.type as EdgeType,
      label: edge.label,
      isImplicit: edge.metadata?.implicit ?? false,
      confidence: edge.metadata?.confidence ?? 100,
      metadata: edge.metadata,
    });
  }

  return edgeInputs;
}

/**
 * Prepare synthetic TerraformModuleNode instances for database insertion.
 *
 * Synthetic nodes are created by TerragruntEdgeService for external Terraform
 * sources (git, registry, etc.) that don't have corresponding nodes in the graph.
 * This function converts them to CreateNodeInput format.
 *
 * @param syntheticNodes - Synthetic TerraformModuleNode instances from TerragruntEdgeResult
 * @param scanId - Scan ID for all nodes
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Array of CreateNodeInput ready for batch insertion
 */
export function prepareSyntheticNodesForInsert(
  syntheticNodes: readonly TerraformModuleNode[],
  scanId: ScanId,
  tenantId: TenantId
): CreateNodeInput[] {
  return syntheticNodes.map((node, index) => ({
    scanId,
    tenantId,
    originalId: `synthetic_tf_${index}`,
    nodeType: 'terraform_module' as NodeTypeName,
    name: node.name,
    filePath: node.location?.file ?? '[external]',
    lineStart: node.location?.lineStart ?? 0,
    lineEnd: node.location?.lineEnd ?? 0,
    metadata: {
      isSynthetic: true,
      sourceType: node.sourceType,
      source: node.source,
      version: node.version,
      providers: node.providers,
      ...node.metadata,
    },
  }));
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new TerragruntNodeHelpers instance.
 *
 * @returns New TerragruntNodeHelpers instance
 */
export function createTerragruntNodeHelpers(): TerragruntNodeHelpers {
  return new TerragruntNodeHelpers();
}
