/**
 * Graph Querier Implementation
 * @module repositories/graph-querier
 *
 * Implements IGraphQuerier for graph traversal operations.
 * Uses recursive CTEs for efficient dependency traversal and cycle detection.
 *
 * TASK-DETECT: Graph traversal data layer implementation
 */

import {
  ScanId,
  NodeEntity,
  EdgeEntity,
  TenantId,
  DbNodeId,
  createDbNodeId,
  createDbEdgeId,
  createScanId,
} from '../types/entities.js';
import { NodeTypeName, EdgeType } from '../types/graph.js';
import {
  IGraphQuerier,
  GraphPath,
  CycleInfo,
  ImpactAnalysisResult,
} from './interfaces.js';
import { BaseRepository } from './base-repository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row for node query results
 */
interface NodeRow {
  id: string;
  scan_id: string;
  tenant_id: string;
  original_id: string;
  node_type: string;
  name: string;
  file_path: string;
  line_start: number;
  line_end: number;
  column_start: number | null;
  column_end: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Database row for edge query results
 */
interface EdgeRow {
  id: string;
  scan_id: string;
  tenant_id: string;
  original_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  label: string | null;
  is_implicit: boolean;
  confidence: number;
  attribute: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Graph querier for traversal operations
 */
export class GraphQuerier extends BaseRepository implements IGraphQuerier {
  constructor() {
    super('nodes'); // Primary table for graph queries
  }

  /**
   * Get downstream dependencies (nodes that depend on given node)
   * Uses recursive CTE to traverse the dependency graph
   */
  async getDownstreamDependencies(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth: number = 10
  ): Promise<NodeEntity[]> {
    const query = `
      WITH RECURSIVE downstream AS (
        -- Base case: start with edges from the given node
        SELECT
          e.target_node_id as node_id,
          e.id as edge_id,
          1 as depth,
          ARRAY[e.source_node_id] as path
        FROM edges e
        WHERE e.source_node_id = $1
          AND e.scan_id = $2
          AND e.tenant_id = $3

        UNION

        -- Recursive case: follow edges to dependent nodes
        SELECT
          e.target_node_id,
          e.id,
          d.depth + 1,
          d.path || e.source_node_id
        FROM edges e
        INNER JOIN downstream d ON e.source_node_id = d.node_id
        WHERE e.scan_id = $2
          AND e.tenant_id = $3
          AND d.depth < $4
          AND NOT e.target_node_id = ANY(d.path)  -- Prevent cycles
      )
      SELECT DISTINCT n.*
      FROM downstream d
      INNER JOIN nodes n ON n.id = d.node_id
      WHERE n.tenant_id = $3
      ORDER BY n.file_path, n.line_start
    `;

    const rows = await this.queryAll<NodeRow>(query, [
      nodeId,
      scanId,
      tenantId,
      maxDepth,
    ]);

    return rows.map(row => this.mapRowToNodeEntity(row));
  }

  /**
   * Get upstream dependents (nodes that the given node depends on)
   */
  async getUpstreamDependents(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth: number = 10
  ): Promise<NodeEntity[]> {
    const query = `
      WITH RECURSIVE upstream AS (
        -- Base case: start with edges to the given node
        SELECT
          e.source_node_id as node_id,
          e.id as edge_id,
          1 as depth,
          ARRAY[e.target_node_id] as path
        FROM edges e
        WHERE e.target_node_id = $1
          AND e.scan_id = $2
          AND e.tenant_id = $3

        UNION

        -- Recursive case: follow edges backwards to source nodes
        SELECT
          e.source_node_id,
          e.id,
          u.depth + 1,
          u.path || e.target_node_id
        FROM edges e
        INNER JOIN upstream u ON e.target_node_id = u.node_id
        WHERE e.scan_id = $2
          AND e.tenant_id = $3
          AND u.depth < $4
          AND NOT e.source_node_id = ANY(u.path)  -- Prevent cycles
      )
      SELECT DISTINCT n.*
      FROM upstream u
      INNER JOIN nodes n ON n.id = u.node_id
      WHERE n.tenant_id = $3
      ORDER BY n.file_path, n.line_start
    `;

    const rows = await this.queryAll<NodeRow>(query, [
      nodeId,
      scanId,
      tenantId,
      maxDepth,
    ]);

    return rows.map(row => this.mapRowToNodeEntity(row));
  }

  /**
   * Find shortest path between two nodes using BFS via recursive CTE
   */
  async findShortestPath(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId,
    targetNodeId: DbNodeId
  ): Promise<GraphPath | null> {
    const query = `
      WITH RECURSIVE path_search AS (
        -- Base case: start from source node
        SELECT
          e.target_node_id as current_node,
          ARRAY[e.source_node_id, e.target_node_id] as node_path,
          ARRAY[e.id] as edge_path,
          1 as length
        FROM edges e
        WHERE e.source_node_id = $1
          AND e.scan_id = $3
          AND e.tenant_id = $4

        UNION

        -- Recursive case: extend path
        SELECT
          e.target_node_id,
          p.node_path || e.target_node_id,
          p.edge_path || e.id,
          p.length + 1
        FROM edges e
        INNER JOIN path_search p ON e.source_node_id = p.current_node
        WHERE e.scan_id = $3
          AND e.tenant_id = $4
          AND p.length < 20  -- Max depth limit
          AND NOT e.target_node_id = ANY(p.node_path)  -- Prevent cycles
      )
      SELECT node_path, edge_path, length
      FROM path_search
      WHERE current_node = $2
      ORDER BY length
      LIMIT 1
    `;

    const row = await this.queryOne<{
      node_path: string[];
      edge_path: string[];
      length: number;
    }>(query, [sourceNodeId, targetNodeId, scanId, tenantId]);

    if (!row) {
      return null;
    }

    return {
      nodes: row.node_path.map(id => createDbNodeId(id)),
      edges: row.edge_path.map(id => createDbEdgeId(id)),
      length: row.length,
    };
  }

  /**
   * Find all paths between two nodes
   */
  async findAllPaths(
    scanId: ScanId,
    tenantId: TenantId,
    sourceNodeId: DbNodeId,
    targetNodeId: DbNodeId,
    maxDepth: number = 10
  ): Promise<GraphPath[]> {
    const query = `
      WITH RECURSIVE path_search AS (
        -- Base case
        SELECT
          e.target_node_id as current_node,
          ARRAY[e.source_node_id, e.target_node_id] as node_path,
          ARRAY[e.id] as edge_path,
          1 as length
        FROM edges e
        WHERE e.source_node_id = $1
          AND e.scan_id = $3
          AND e.tenant_id = $4

        UNION

        -- Recursive case
        SELECT
          e.target_node_id,
          p.node_path || e.target_node_id,
          p.edge_path || e.id,
          p.length + 1
        FROM edges e
        INNER JOIN path_search p ON e.source_node_id = p.current_node
        WHERE e.scan_id = $3
          AND e.tenant_id = $4
          AND p.length < $5
          AND NOT e.target_node_id = ANY(p.node_path)
      )
      SELECT node_path, edge_path, length
      FROM path_search
      WHERE current_node = $2
      ORDER BY length
      LIMIT 100  -- Cap results
    `;

    const rows = await this.queryAll<{
      node_path: string[];
      edge_path: string[];
      length: number;
    }>(query, [sourceNodeId, targetNodeId, scanId, tenantId, maxDepth]);

    return rows.map(row => ({
      nodes: row.node_path.map(id => createDbNodeId(id)),
      edges: row.edge_path.map(id => createDbEdgeId(id)),
      length: row.length,
    }));
  }

  /**
   * Detect cycles in the graph
   */
  async detectCycles(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<CycleInfo[]> {
    const query = `
      WITH RECURSIVE cycle_search AS (
        -- Start from each node
        SELECT
          e.source_node_id as start_node,
          e.target_node_id as current_node,
          ARRAY[e.source_node_id, e.target_node_id] as node_path,
          ARRAY[e.id] as edge_path,
          false as is_cycle
        FROM edges e
        WHERE e.scan_id = $1
          AND e.tenant_id = $2

        UNION

        -- Follow edges and detect cycles
        SELECT
          c.start_node,
          e.target_node_id,
          c.node_path || e.target_node_id,
          c.edge_path || e.id,
          e.target_node_id = c.start_node  -- Cycle detected when we return to start
        FROM edges e
        INNER JOIN cycle_search c ON e.source_node_id = c.current_node
        WHERE e.scan_id = $1
          AND e.tenant_id = $2
          AND NOT c.is_cycle
          AND array_length(c.node_path, 1) < 20  -- Max depth
          AND (
            e.target_node_id = c.start_node  -- Allow closing the cycle
            OR NOT e.target_node_id = ANY(c.node_path)  -- Or continue if not visited
          )
      )
      SELECT DISTINCT node_path, edge_path
      FROM cycle_search
      WHERE is_cycle
      ORDER BY array_length(node_path, 1)
      LIMIT 50  -- Cap results
    `;

    const rows = await this.queryAll<{
      node_path: string[];
      edge_path: string[];
    }>(query, [scanId, tenantId]);

    return rows.map(row => ({
      nodes: row.node_path.map(id => createDbNodeId(id)),
      edges: row.edge_path.map(id => createDbEdgeId(id)),
    }));
  }

  /**
   * Get connected components using union-find via CTE
   */
  async getConnectedComponents(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<NodeEntity[][]> {
    const query = `
      WITH RECURSIVE component_search AS (
        -- Start from each node as its own component root
        SELECT
          n.id as node_id,
          n.id as component_root,
          ARRAY[n.id] as visited
        FROM nodes n
        WHERE n.scan_id = $1
          AND n.tenant_id = $2

        UNION

        -- Expand components through edges (both directions)
        SELECT
          CASE
            WHEN e.source_node_id = c.node_id THEN e.target_node_id
            ELSE e.source_node_id
          END as node_id,
          c.component_root,
          c.visited || CASE
            WHEN e.source_node_id = c.node_id THEN e.target_node_id
            ELSE e.source_node_id
          END
        FROM edges e
        INNER JOIN component_search c ON (
          e.source_node_id = c.node_id OR e.target_node_id = c.node_id
        )
        WHERE e.scan_id = $1
          AND e.tenant_id = $2
          AND NOT (
            CASE
              WHEN e.source_node_id = c.node_id THEN e.target_node_id
              ELSE e.source_node_id
            END = ANY(c.visited)
          )
      ),
      components AS (
        SELECT
          node_id,
          MIN(component_root) as component_id
        FROM component_search
        GROUP BY node_id
      )
      SELECT
        c.component_id,
        n.*
      FROM components c
      INNER JOIN nodes n ON n.id = c.node_id
      WHERE n.tenant_id = $2
      ORDER BY c.component_id, n.file_path, n.line_start
    `;

    const rows = await this.queryAll<NodeRow & { component_id: string }>(
      query,
      [scanId, tenantId]
    );

    // Group by component
    const componentMap = new Map<string, NodeEntity[]>();
    for (const row of rows) {
      const componentId = row.component_id;
      if (!componentMap.has(componentId)) {
        componentMap.set(componentId, []);
      }
      componentMap.get(componentId)!.push(this.mapRowToNodeEntity(row));
    }

    return Array.from(componentMap.values());
  }

  /**
   * Perform impact analysis for a node change
   */
  async analyzeImpact(
    scanId: ScanId,
    tenantId: TenantId,
    nodeId: DbNodeId,
    maxDepth: number = 10
  ): Promise<ImpactAnalysisResult> {
    // Get direct dependents (nodes that directly reference this node)
    const directQuery = `
      SELECT n.*
      FROM edges e
      INNER JOIN nodes n ON n.id = e.source_node_id
      WHERE e.target_node_id = $1
        AND e.scan_id = $2
        AND e.tenant_id = $3
    `;

    const directRows = await this.queryAll<NodeRow>(directQuery, [
      nodeId,
      scanId,
      tenantId,
    ]);

    // Get transitive dependents using recursive CTE
    const transitiveQuery = `
      WITH RECURSIVE transitive AS (
        -- Direct dependents
        SELECT
          e.source_node_id as node_id,
          e.id as edge_id,
          1 as depth
        FROM edges e
        WHERE e.target_node_id = $1
          AND e.scan_id = $2
          AND e.tenant_id = $3

        UNION

        -- Transitive dependents (nodes that depend on nodes that depend on us)
        SELECT
          e.source_node_id,
          e.id,
          t.depth + 1
        FROM edges e
        INNER JOIN transitive t ON e.target_node_id = t.node_id
        WHERE e.scan_id = $2
          AND e.tenant_id = $3
          AND t.depth < $4
          AND e.source_node_id != $1  -- Don't include original node
      )
      SELECT DISTINCT n.*, MAX(t.depth) as max_depth
      FROM transitive t
      INNER JOIN nodes n ON n.id = t.node_id
      WHERE n.id NOT IN (
        SELECT id FROM nodes
        WHERE id IN (SELECT node_id FROM transitive WHERE depth = 1)
      )
      AND n.tenant_id = $3
      GROUP BY n.id, n.scan_id, n.tenant_id, n.original_id, n.node_type,
               n.name, n.file_path, n.line_start, n.line_end,
               n.column_start, n.column_end, n.metadata, n.created_at
    `;

    const transitiveRows = await this.queryAll<NodeRow & { max_depth: number }>(
      transitiveQuery,
      [nodeId, scanId, tenantId, maxDepth]
    );

    // Get impacted edges
    const edgesQuery = `
      WITH RECURSIVE impacted AS (
        SELECT e.source_node_id as node_id
        FROM edges e
        WHERE e.target_node_id = $1
          AND e.scan_id = $2
          AND e.tenant_id = $3

        UNION

        SELECT e.source_node_id
        FROM edges e
        INNER JOIN impacted i ON e.target_node_id = i.node_id
        WHERE e.scan_id = $2
          AND e.tenant_id = $3
      )
      SELECT e.*
      FROM edges e
      WHERE e.scan_id = $2
        AND e.tenant_id = $3
        AND (
          e.source_node_id IN (SELECT node_id FROM impacted)
          OR e.target_node_id = $1
        )
    `;

    const edgeRows = await this.queryAll<EdgeRow>(edgesQuery, [
      nodeId,
      scanId,
      tenantId,
    ]);

    // Calculate max depth
    const depth = transitiveRows.length > 0
      ? Math.max(...transitiveRows.map(r => r.max_depth))
      : (directRows.length > 0 ? 1 : 0);

    return {
      directDependents: directRows.map(row => this.mapRowToNodeEntity(row)),
      transitiveDependents: transitiveRows.map(row => this.mapRowToNodeEntity(row)),
      impactedEdges: edgeRows.map(row => this.mapRowToEdgeEntity(row)),
      depth,
    };
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(
    scanId: ScanId,
    tenantId: TenantId
  ): Promise<{
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    maxDepth: number;
    componentCount: number;
    hasCycles: boolean;
  }> {
    const statsQuery = `
      WITH node_stats AS (
        SELECT COUNT(*)::int as node_count
        FROM nodes
        WHERE scan_id = $1 AND tenant_id = $2
      ),
      edge_stats AS (
        SELECT COUNT(*)::int as edge_count
        FROM edges
        WHERE scan_id = $1 AND tenant_id = $2
      ),
      degree_stats AS (
        SELECT
          COALESCE(AVG(degree)::numeric(5,2), 0) as avg_degree
        FROM (
          SELECT COUNT(*)::numeric as degree
          FROM edges
          WHERE scan_id = $1 AND tenant_id = $2
          GROUP BY source_node_id
        ) degrees
      )
      SELECT
        n.node_count,
        e.edge_count,
        d.avg_degree
      FROM node_stats n, edge_stats e, degree_stats d
    `;

    const statsRow = await this.queryOne<{
      node_count: number;
      edge_count: number;
      avg_degree: number;
    }>(statsQuery, [scanId, tenantId]);

    // Check for cycles
    const cycles = await this.detectCycles(scanId, tenantId);
    const hasCycles = cycles.length > 0;

    // Get connected components count
    const components = await this.getConnectedComponents(scanId, tenantId);
    const componentCount = components.length;

    // Calculate max depth (simplified - max path length)
    const depthQuery = `
      WITH RECURSIVE depth_calc AS (
        SELECT
          source_node_id as node_id,
          1 as depth,
          ARRAY[source_node_id] as path
        FROM edges
        WHERE scan_id = $1 AND tenant_id = $2

        UNION

        SELECT
          e.target_node_id,
          d.depth + 1,
          d.path || e.target_node_id
        FROM edges e
        INNER JOIN depth_calc d ON e.source_node_id = d.node_id
        WHERE e.scan_id = $1
          AND e.tenant_id = $2
          AND d.depth < 50
          AND NOT e.target_node_id = ANY(d.path)
      )
      SELECT COALESCE(MAX(depth), 0)::int as max_depth
      FROM depth_calc
    `;

    const depthRow = await this.queryOne<{ max_depth: number }>(
      depthQuery,
      [scanId, tenantId]
    );

    return {
      nodeCount: statsRow?.node_count ?? 0,
      edgeCount: statsRow?.edge_count ?? 0,
      avgDegree: parseFloat(String(statsRow?.avg_degree ?? 0)),
      maxDepth: depthRow?.max_depth ?? 0,
      componentCount,
      hasCycles,
    };
  }

  /**
   * Find nodes with high fan-out (many outgoing dependencies)
   */
  async findHighFanOutNodes(
    scanId: ScanId,
    tenantId: TenantId,
    threshold: number = 5
  ): Promise<Array<{ node: NodeEntity; fanOut: number }>> {
    const query = `
      SELECT n.*, COUNT(e.id)::int as fan_out
      FROM nodes n
      INNER JOIN edges e ON e.source_node_id = n.id
      WHERE n.scan_id = $1
        AND n.tenant_id = $2
        AND e.scan_id = $1
        AND e.tenant_id = $2
      GROUP BY n.id, n.scan_id, n.tenant_id, n.original_id, n.node_type,
               n.name, n.file_path, n.line_start, n.line_end,
               n.column_start, n.column_end, n.metadata, n.created_at
      HAVING COUNT(e.id) >= $3
      ORDER BY fan_out DESC
    `;

    const rows = await this.queryAll<NodeRow & { fan_out: number }>(
      query,
      [scanId, tenantId, threshold]
    );

    return rows.map(row => ({
      node: this.mapRowToNodeEntity(row),
      fanOut: row.fan_out,
    }));
  }

  /**
   * Find nodes with high fan-in (many incoming dependencies)
   */
  async findHighFanInNodes(
    scanId: ScanId,
    tenantId: TenantId,
    threshold: number = 5
  ): Promise<Array<{ node: NodeEntity; fanIn: number }>> {
    const query = `
      SELECT n.*, COUNT(e.id)::int as fan_in
      FROM nodes n
      INNER JOIN edges e ON e.target_node_id = n.id
      WHERE n.scan_id = $1
        AND n.tenant_id = $2
        AND e.scan_id = $1
        AND e.tenant_id = $2
      GROUP BY n.id, n.scan_id, n.tenant_id, n.original_id, n.node_type,
               n.name, n.file_path, n.line_start, n.line_end,
               n.column_start, n.column_end, n.metadata, n.created_at
      HAVING COUNT(e.id) >= $3
      ORDER BY fan_in DESC
    `;

    const rows = await this.queryAll<NodeRow & { fan_in: number }>(
      query,
      [scanId, tenantId, threshold]
    );

    return rows.map(row => ({
      node: this.mapRowToNodeEntity(row),
      fanIn: row.fan_in,
    }));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Map database row to NodeEntity
   */
  private mapRowToNodeEntity(row: NodeRow): NodeEntity {
    return {
      id: createDbNodeId(row.id),
      scanId: createScanId(row.scan_id),
      tenantId: row.tenant_id as TenantId,
      originalId: row.original_id,
      nodeType: row.node_type as NodeTypeName,
      name: row.name,
      filePath: row.file_path,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      columnStart: row.column_start ?? undefined,
      columnEnd: row.column_end ?? undefined,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to EdgeEntity
   */
  private mapRowToEdgeEntity(row: EdgeRow): EdgeEntity {
    return {
      id: createDbEdgeId(row.id),
      scanId: createScanId(row.scan_id),
      tenantId: row.tenant_id as TenantId,
      originalId: row.original_id,
      sourceNodeId: createDbNodeId(row.source_node_id),
      targetNodeId: createDbNodeId(row.target_node_id),
      edgeType: row.edge_type as EdgeType,
      label: row.label ?? undefined,
      isImplicit: row.is_implicit,
      confidence: row.confidence,
      attribute: row.attribute ?? undefined,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new graph querier instance
 */
export function createGraphQuerier(): IGraphQuerier {
  return new GraphQuerier();
}
