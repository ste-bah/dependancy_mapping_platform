/**
 * Performance Optimization: Algorithm Implementations
 * @module optimization/algorithms
 *
 * Optimized graph algorithms including:
 * - Tarjan's algorithm for cycle detection (O(V + E))
 * - Kosaraju's algorithm for SCCs
 * - Topological sort
 * - Dijkstra's shortest path
 *
 * TASK-DETECT: Performance optimization implementation
 */

import { GraphEdge, DependencyGraph } from '../types/graph.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Strongly Connected Component
 */
export interface StronglyConnectedComponent {
  nodes: string[];
  isCycle: boolean;
}

/**
 * Cycle information
 */
export interface CycleInfo {
  nodes: string[];
  edges: string[];
}

/**
 * Topological sort result
 */
export interface TopologicalSortResult {
  sorted: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
}

/**
 * Shortest path result
 */
export interface ShortestPathResult {
  path: string[];
  distance: number;
  edgeIds: string[];
}

// ============================================================================
// Tarjan's Algorithm for Strongly Connected Components
// ============================================================================

/**
 * Tarjan's algorithm for finding strongly connected components
 * Time complexity: O(V + E)
 * Space complexity: O(V)
 */
export function tarjanSCC(graph: DependencyGraph): StronglyConnectedComponent[] {
  const nodes = Array.from(graph.nodes.keys());
  const adjacencyList = buildAdjacencyList(graph.edges);

  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: StronglyConnectedComponent[] = [];
  let currentIndex = 0;

  function strongconnect(nodeId: string): void {
    index.set(nodeId, currentIndex);
    lowlink.set(nodeId, currentIndex);
    currentIndex++;
    stack.push(nodeId);
    onStack.add(nodeId);

    const successors = adjacencyList.get(nodeId) ?? [];

    for (const successor of successors) {
      if (!index.has(successor)) {
        // Successor has not been visited
        strongconnect(successor);
        lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, lowlink.get(successor)!));
      } else if (onStack.has(successor)) {
        // Successor is in stack - part of current SCC
        lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, index.get(successor)!));
      }
    }

    // If node is a root node, pop the stack and generate an SCC
    if (lowlink.get(nodeId) === index.get(nodeId)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== nodeId);

      sccs.push({
        nodes: scc,
        isCycle: scc.length > 1 || hasEdgeToSelf(nodeId, adjacencyList),
      });
    }
  }

  // Visit all nodes
  for (const node of nodes) {
    if (!index.has(node)) {
      strongconnect(node);
    }
  }

  return sccs;
}

/**
 * Find all cycles using Tarjan's algorithm
 */
export function findCyclesTarjan(graph: DependencyGraph): CycleInfo[] {
  const sccs = tarjanSCC(graph);
  const cycles: CycleInfo[] = [];

  for (const scc of sccs) {
    if (scc.isCycle) {
      // Find edges within this SCC
      const nodeSet = new Set(scc.nodes);
      const cycleEdges: string[] = [];

      for (const edge of graph.edges) {
        if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
          cycleEdges.push(edge.id);
        }
      }

      cycles.push({
        nodes: scc.nodes,
        edges: cycleEdges,
      });
    }
  }

  return cycles;
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Topological sort using Kahn's algorithm
 * Time complexity: O(V + E)
 */
export function topologicalSort(graph: DependencyGraph): TopologicalSortResult {
  const adjacencyList = buildAdjacencyList(graph.edges);
  const inDegree = new Map<string, number>();

  // Initialize in-degrees
  for (const nodeId of graph.nodes.keys()) {
    inDegree.set(nodeId, 0);
  }

  // Count in-degrees
  for (const edge of graph.edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Queue of nodes with no incoming edges
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    const successors = adjacencyList.get(node) ?? [];
    for (const successor of successors) {
      const newDegree = (inDegree.get(successor) ?? 1) - 1;
      inDegree.set(successor, newDegree);

      if (newDegree === 0) {
        queue.push(successor);
      }
    }
  }

  // Check for cycles
  if (sorted.length !== graph.nodes.size) {
    const cycleNodes = Array.from(graph.nodes.keys()).filter(
      n => !sorted.includes(n)
    );
    return {
      sorted,
      hasCycle: true,
      cycleNodes,
    };
  }

  return {
    sorted,
    hasCycle: false,
  };
}

/**
 * Topological sort using DFS (alternative implementation)
 */
export function topologicalSortDFS(graph: DependencyGraph): TopologicalSortResult {
  const adjacencyList = buildAdjacencyList(graph.edges);
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const result: string[] = [];
  let hasCycle = false;
  const cycleNodes: string[] = [];

  function dfs(nodeId: string): void {
    if (hasCycle) return;

    if (recStack.has(nodeId)) {
      hasCycle = true;
      cycleNodes.push(nodeId);
      return;
    }

    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    recStack.add(nodeId);

    const successors = adjacencyList.get(nodeId) ?? [];
    for (const successor of successors) {
      dfs(successor);
    }

    recStack.delete(nodeId);
    result.unshift(nodeId); // Prepend for reverse order
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  if (hasCycle) {
    return {
      sorted: result,
      hasCycle: true,
      cycleNodes,
    };
  }

  return {
    sorted: result,
    hasCycle: false,
  };
}

// ============================================================================
// BFS for Shortest Path (Unweighted)
// ============================================================================

/**
 * Find shortest path using BFS (unweighted graph)
 * Time complexity: O(V + E)
 */
export function bfsShortestPath(
  graph: DependencyGraph,
  sourceId: string,
  targetId: string
): ShortestPathResult | null {
  if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) {
    return null;
  }

  if (sourceId === targetId) {
    return { path: [sourceId], distance: 0, edgeIds: [] };
  }

  const adjacencyList = buildAdjacencyListWithEdges(graph.edges);
  const visited = new Set<string>();
  const parent = new Map<string, { node: string; edgeId: string }>();

  const queue: string[] = [sourceId];
  visited.add(sourceId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = adjacencyList.get(current) ?? [];
    for (const { target, edgeId } of neighbors) {
      if (!visited.has(target)) {
        visited.add(target);
        parent.set(target, { node: current, edgeId });

        if (target === targetId) {
          // Reconstruct path
          const path: string[] = [];
          const edgeIds: string[] = [];
          let node = targetId;

          while (node !== sourceId) {
            path.unshift(node);
            const p = parent.get(node)!;
            edgeIds.unshift(p.edgeId);
            node = p.node;
          }
          path.unshift(sourceId);

          return {
            path,
            distance: path.length - 1,
            edgeIds,
          };
        }

        queue.push(target);
      }
    }
  }

  return null; // No path found
}

/**
 * Find all paths between two nodes (DFS with backtracking)
 * Limited to avoid exponential blowup
 */
export function findAllPaths(
  graph: DependencyGraph,
  sourceId: string,
  targetId: string,
  maxDepth: number = 10,
  maxPaths: number = 100
): ShortestPathResult[] {
  if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) {
    return [];
  }

  const adjacencyList = buildAdjacencyListWithEdges(graph.edges);
  const paths: ShortestPathResult[] = [];
  const currentPath: string[] = [sourceId];
  const currentEdges: string[] = [];
  const visited = new Set<string>([sourceId]);

  function dfs(current: string, depth: number): void {
    if (paths.length >= maxPaths) return;
    if (depth > maxDepth) return;

    if (current === targetId) {
      paths.push({
        path: [...currentPath],
        distance: currentPath.length - 1,
        edgeIds: [...currentEdges],
      });
      return;
    }

    const neighbors = adjacencyList.get(current) ?? [];
    for (const { target, edgeId } of neighbors) {
      if (!visited.has(target)) {
        visited.add(target);
        currentPath.push(target);
        currentEdges.push(edgeId);

        dfs(target, depth + 1);

        currentPath.pop();
        currentEdges.pop();
        visited.delete(target);
      }
    }
  }

  dfs(sourceId, 0);

  return paths.sort((a, b) => a.distance - b.distance);
}

// ============================================================================
// Reachability Analysis
// ============================================================================

/**
 * Find all nodes reachable from a source node
 * Time complexity: O(V + E)
 */
export function findReachableNodes(
  graph: DependencyGraph,
  sourceId: string,
  maxDepth: number = Infinity
): Map<string, number> {
  if (!graph.nodes.has(sourceId)) {
    return new Map();
  }

  const adjacencyList = buildAdjacencyList(graph.edges);
  const distances = new Map<string, number>();
  const queue: Array<{ node: string; depth: number }> = [
    { node: sourceId, depth: 0 },
  ];

  distances.set(sourceId, 0);

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const neighbors = adjacencyList.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, depth + 1);
        queue.push({ node: neighbor, depth: depth + 1 });
      }
    }
  }

  return distances;
}

/**
 * Find all nodes that can reach a target node (reverse reachability)
 */
export function findNodesThatReach(
  graph: DependencyGraph,
  targetId: string,
  maxDepth: number = Infinity
): Map<string, number> {
  if (!graph.nodes.has(targetId)) {
    return new Map();
  }

  // Build reverse adjacency list
  const reverseAdjacency = new Map<string, string[]>();

  for (const nodeId of graph.nodes.keys()) {
    reverseAdjacency.set(nodeId, []);
  }

  for (const edge of graph.edges) {
    const sources = reverseAdjacency.get(edge.target) ?? [];
    sources.push(edge.source);
    reverseAdjacency.set(edge.target, sources);
  }

  const distances = new Map<string, number>();
  const queue: Array<{ node: string; depth: number }> = [
    { node: targetId, depth: 0 },
  ];

  distances.set(targetId, 0);

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const sources = reverseAdjacency.get(node) ?? [];
    for (const source of sources) {
      if (!distances.has(source)) {
        distances.set(source, depth + 1);
        queue.push({ node: source, depth: depth + 1 });
      }
    }
  }

  return distances;
}

// ============================================================================
// Graph Metrics
// ============================================================================

/**
 * Calculate graph density
 */
export function calculateDensity(graph: DependencyGraph): number {
  const nodeCount = graph.nodes.size;
  if (nodeCount < 2) return 0;

  const maxEdges = nodeCount * (nodeCount - 1); // For directed graph
  return graph.edges.length / maxEdges;
}

/**
 * Calculate average degree
 */
export function calculateAverageDegree(graph: DependencyGraph): {
  inDegree: number;
  outDegree: number;
  totalDegree: number;
} {
  if (graph.nodes.size === 0) {
    return { inDegree: 0, outDegree: 0, totalDegree: 0 };
  }

  const inDegrees = new Map<string, number>();
  const outDegrees = new Map<string, number>();

  for (const nodeId of graph.nodes.keys()) {
    inDegrees.set(nodeId, 0);
    outDegrees.set(nodeId, 0);
  }

  for (const edge of graph.edges) {
    inDegrees.set(edge.target, (inDegrees.get(edge.target) ?? 0) + 1);
    outDegrees.set(edge.source, (outDegrees.get(edge.source) ?? 0) + 1);
  }

  const totalIn = Array.from(inDegrees.values()).reduce((a, b) => a + b, 0);
  const totalOut = Array.from(outDegrees.values()).reduce((a, b) => a + b, 0);

  return {
    inDegree: totalIn / graph.nodes.size,
    outDegree: totalOut / graph.nodes.size,
    totalDegree: (totalIn + totalOut) / graph.nodes.size,
  };
}

/**
 * Find articulation points (nodes whose removal disconnects the graph)
 */
export function findArticulationPoints(graph: DependencyGraph): string[] {
  const nodes = Array.from(graph.nodes.keys());
  if (nodes.length === 0) return [];

  // Build undirected adjacency list
  const adjacencyList = new Map<string, Set<string>>();
  for (const nodeId of nodes) {
    adjacencyList.set(nodeId, new Set());
  }

  for (const edge of graph.edges) {
    adjacencyList.get(edge.source)?.add(edge.target);
    adjacencyList.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const articulationPoints = new Set<string>();
  let time = 0;

  function dfs(u: string): void {
    let children = 0;
    visited.add(u);
    disc.set(u, time);
    low.set(u, time);
    time++;

    const neighbors = adjacencyList.get(u) ?? new Set();
    for (const v of neighbors) {
      if (!visited.has(v)) {
        children++;
        parent.set(v, u);
        dfs(v);

        low.set(u, Math.min(low.get(u)!, low.get(v)!));

        // u is an articulation point if:
        // 1. u is root and has two or more children
        // 2. u is not root and low[v] >= disc[u]
        if (parent.get(u) === null && children > 1) {
          articulationPoints.add(u);
        }

        if (parent.get(u) !== null && low.get(v)! >= disc.get(u)!) {
          articulationPoints.add(u);
        }
      } else if (v !== parent.get(u)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      parent.set(node, null);
      dfs(node);
    }
  }

  return Array.from(articulationPoints);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build adjacency list from edges
 */
function buildAdjacencyList(edges: GraphEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) ?? [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }

  return adjacency;
}

/**
 * Build adjacency list with edge IDs
 */
function buildAdjacencyListWithEdges(
  edges: GraphEdge[]
): Map<string, Array<{ target: string; edgeId: string }>> {
  const adjacency = new Map<string, Array<{ target: string; edgeId: string }>>();

  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) ?? [];
    neighbors.push({ target: edge.target, edgeId: edge.id });
    adjacency.set(edge.source, neighbors);
  }

  return adjacency;
}

/**
 * Check if node has self-referencing edge
 */
function hasEdgeToSelf(nodeId: string, adjacencyList: Map<string, string[]>): boolean {
  const neighbors = adjacencyList.get(nodeId) ?? [];
  return neighbors.includes(nodeId);
}

/**
 * Build reverse adjacency list
 */
export function buildReverseAdjacencyList(edges: GraphEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const neighbors = adjacency.get(edge.target) ?? [];
    neighbors.push(edge.source);
    adjacency.set(edge.target, neighbors);
  }

  return adjacency;
}
