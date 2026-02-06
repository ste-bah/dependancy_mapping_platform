/**
 * Graph Test Utilities
 * Mock data factories and render helpers for graph feature tests
 * @module features/graph/__tests__/utils/testUtils
 */

import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { ReactNode, ReactElement } from 'react';
import { vi } from 'vitest';
import type {
  GraphNode,
  GraphEdge,
  GraphData,
  FlowNode,
  FlowEdge,
  GraphFilters,
  ExtendedGraphFilters,
  GraphNodeType,
  EdgeType,
  BlastRadiusResponse,
  AffectedNode,
  ImpactSeverity,
  CustomNodeData,
  CustomEdgeData,
} from '../../types';
import { defaultGraphFilters, defaultExtendedGraphFilters, ALL_NODE_TYPES, ALL_EDGE_TYPES } from '../../types';

// ============================================================================
// Query Client Factory
// ============================================================================

/**
 * Create a test-specific QueryClient with disabled retries and caching
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================================================
// Provider Wrapper
// ============================================================================

interface WrapperProps {
  children: ReactNode;
}

interface RenderWithProvidersOptions extends RenderOptions {
  queryClient?: QueryClient;
  routerProps?: Omit<MemoryRouterProps, 'children'>;
  initialEntries?: string[];
  /** Include ReactFlowProvider for testing React Flow components */
  withReactFlow?: boolean;
}

/**
 * Render component with all required providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
): ReturnType<typeof render> & { queryClient: QueryClient } {
  const {
    queryClient = createTestQueryClient(),
    routerProps = {},
    initialEntries = ['/'],
    withReactFlow = false,
    ...renderOptions
  } = options;

  function Wrapper({ children }: WrapperProps): JSX.Element {
    const content = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries} {...routerProps}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wrap with ReactFlowProvider if needed for testing React Flow components
    if (withReactFlow) {
      return <ReactFlowProvider>{content}</ReactFlowProvider>;
    }

    return content;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * Create a wrapper component for use with renderHook
 * This returns a React component that wraps children with providers
 */
export function createTestWrapper(options: Omit<RenderWithProvidersOptions, 'wrapper'> = {}) {
  const {
    queryClient = createTestQueryClient(),
    routerProps = {},
    initialEntries = ['/'],
    withReactFlow = false,
  } = options;

  return function TestWrapper({ children }: WrapperProps): JSX.Element {
    const content = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries} {...routerProps}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );

    if (withReactFlow) {
      return <ReactFlowProvider>{content}</ReactFlowProvider>;
    }

    return content;
  };
}

// ============================================================================
// Mock Data Factories - Nodes
// ============================================================================

let nodeIdCounter = 0;

/**
 * Create a mock GraphNode with configurable properties
 */
export function createMockNode(overrides: Partial<GraphNode> = {}): GraphNode {
  const id = overrides.id ?? `node-${++nodeIdCounter}`;
  return {
    id,
    name: overrides.name ?? `Test Node ${id}`,
    type: overrides.type ?? 'terraform_resource',
    location: overrides.location ?? {
      filePath: `src/modules/${id}/main.tf`,
      startLine: 1,
      endLine: 10,
    },
    metadata: overrides.metadata ?? { provider: 'aws' },
  };
}

/**
 * Create multiple mock nodes
 */
export function createMockNodes(count: number, overrides: Partial<GraphNode> = {}): GraphNode[] {
  return Array.from({ length: count }, () => createMockNode(overrides));
}

/**
 * Create a mock node of each type
 */
export function createMockNodesOfEachType(): GraphNode[] {
  return ALL_NODE_TYPES.map((type, index) =>
    createMockNode({
      id: `node-type-${type}`,
      name: `${type} node`,
      type,
    })
  );
}

// ============================================================================
// Mock Data Factories - Edges
// ============================================================================

let edgeIdCounter = 0;

/**
 * Create a mock GraphEdge with configurable properties
 */
export function createMockEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  const id = overrides.id ?? `edge-${++edgeIdCounter}`;
  return {
    id,
    sourceNodeId: overrides.sourceNodeId ?? 'source-node',
    targetNodeId: overrides.targetNodeId ?? 'target-node',
    type: overrides.type ?? 'DEPENDS_ON',
    confidence: overrides.confidence ?? 1.0,
  };
}

/**
 * Create edges connecting nodes in a chain
 */
export function createMockEdgeChain(nodeIds: string[], edgeType: EdgeType = 'DEPENDS_ON'): GraphEdge[] {
  return nodeIds.slice(0, -1).map((sourceId, index) =>
    createMockEdge({
      sourceNodeId: sourceId,
      targetNodeId: nodeIds[index + 1],
      type: edgeType,
    })
  );
}

/**
 * Create edges of each type
 */
export function createMockEdgesOfEachType(sourceId: string, targetIds: string[]): GraphEdge[] {
  return ALL_EDGE_TYPES.map((type, index) =>
    createMockEdge({
      sourceNodeId: sourceId,
      targetNodeId: targetIds[index % targetIds.length],
      type,
    })
  );
}

// ============================================================================
// Mock Data Factories - Graph Data
// ============================================================================

/**
 * Create mock metadata helper
 */
function createMockMetadata(nodeCount: number, edgeCount: number): GraphData['metadata'] {
  return {
    scanId: 'test-scan-123',
    repositoryId: 'repo-456',
    generatedAt: new Date().toISOString(),
    nodeCount,
    edgeCount,
  };
}

/**
 * Create a complete mock GraphData object
 *
 * @overload Create with specific node and edge counts
 * @param nodeCount - Number of nodes to generate
 * @param edgeCount - Number of edges to generate (defaults to nodeCount - 1)
 * @returns GraphData with generated nodes and edges
 */
export function createMockGraphData(nodeCount: number, edgeCount?: number): GraphData;

/**
 * Create a complete mock GraphData object
 *
 * @overload Create with property overrides
 * @param overrides - Partial GraphData to override defaults
 * @returns GraphData with applied overrides
 */
export function createMockGraphData(overrides?: Partial<GraphData>): GraphData;

/**
 * Implementation of createMockGraphData
 */
export function createMockGraphData(
  nodeCountOrOverrides?: number | Partial<GraphData>,
  edgeCount?: number
): GraphData {
  // Handle numeric parameters (nodeCount, edgeCount)
  if (typeof nodeCountOrOverrides === 'number') {
    const nodeCount = nodeCountOrOverrides;
    const targetEdgeCount = edgeCount ?? Math.max(0, nodeCount - 1);
    const nodes = createMockNodes(nodeCount);
    const nodeIds = nodes.map((n) => n.id);
    const edges = createMockEdgeChain(nodeIds.slice(0, Math.min(targetEdgeCount + 1, nodeIds.length)));
    return {
      nodes,
      edges,
      metadata: createMockMetadata(nodes.length, edges.length),
    };
  }

  // Handle object overrides (original behavior)
  const overrides = nodeCountOrOverrides ?? {};
  const nodes = overrides.nodes ?? createMockNodes(5);
  const nodeIds = nodes.map((n) => n.id);

  // Create edges between consecutive nodes
  const edges =
    overrides.edges ??
    createMockEdgeChain(nodeIds.slice(0, Math.min(4, nodeIds.length)));

  return {
    nodes,
    edges,
    metadata: overrides.metadata ?? createMockMetadata(nodes.length, edges.length),
  };
}

/**
 * Create an empty graph
 */
export function createEmptyGraph(): GraphData {
  return {
    nodes: [],
    edges: [],
    metadata: {
      scanId: 'empty-scan',
      repositoryId: 'repo-456',
      generatedAt: new Date().toISOString(),
      nodeCount: 0,
      edgeCount: 0,
    },
  };
}

/**
 * Create a large graph for performance testing
 */
export function createLargeGraph(nodeCount: number = 100, edgeDensity: number = 0.1): GraphData {
  const nodes = createMockNodes(nodeCount);
  const edges: GraphEdge[] = [];

  // Create edges with given density
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.random() < edgeDensity) {
        edges.push(
          createMockEdge({
            sourceNodeId: nodes[i].id,
            targetNodeId: nodes[j].id,
          })
        );
      }
    }
  }

  return createMockGraphData({ nodes, edges });
}

// ============================================================================
// Mock Data Factories - Flow Nodes/Edges
// ============================================================================

/**
 * Create a mock FlowNode
 */
export function createMockFlowNode(overrides: Partial<FlowNode> = {}): FlowNode {
  const graphNode = createMockNode();
  const data: CustomNodeData = {
    id: graphNode.id,
    name: graphNode.name,
    type: graphNode.type,
    location: graphNode.location,
    metadata: graphNode.metadata,
    selected: false,
    highlighted: false,
    dimmed: false,
    ...(overrides.data ?? {}),
  };

  return {
    id: overrides.id ?? graphNode.id,
    type: 'customNode',
    position: overrides.position ?? { x: 0, y: 0 },
    data,
  };
}

/**
 * Create mock FlowNodes from GraphNodes
 */
export function createMockFlowNodes(nodes: GraphNode[]): FlowNode[] {
  return nodes.map((node, index) => ({
    id: node.id,
    type: 'customNode',
    position: { x: index * 200, y: Math.floor(index / 3) * 150 },
    data: {
      ...node,
      selected: false,
      highlighted: false,
      dimmed: false,
    },
  }));
}

/**
 * Create a mock FlowEdge
 */
export function createMockFlowEdge(overrides: Partial<FlowEdge> = {}): FlowEdge {
  const graphEdge = createMockEdge();
  const data: CustomEdgeData = {
    type: graphEdge.type,
    confidence: graphEdge.confidence,
    highlighted: false,
    ...(overrides.data ?? {}),
  };

  return {
    id: overrides.id ?? graphEdge.id,
    source: overrides.source ?? graphEdge.sourceNodeId,
    target: overrides.target ?? graphEdge.targetNodeId,
    type: 'smoothstep',
    animated: data.type === 'DEPENDS_ON',
    data,
  };
}

/**
 * Create mock FlowEdges from edge configurations
 */
export function createMockFlowEdges(
  configs: Array<{ source: string; target: string; id?: string }>
): FlowEdge[] {
  return configs.map((config, index) =>
    createMockFlowEdge({
      id: config.id ?? `edge-${config.source}-${config.target}`,
      source: config.source,
      target: config.target,
    })
  );
}

// ============================================================================
// Mock Data Factories - Blast Radius
// ============================================================================

/**
 * Create a mock AffectedNode
 */
export function createMockAffectedNode(overrides: Partial<AffectedNode> = {}): AffectedNode {
  const id = overrides.id ?? `affected-${++nodeIdCounter}`;
  return {
    id,
    name: overrides.name ?? `Affected Node ${id}`,
    type: overrides.type ?? 'terraform_resource',
    isDirect: overrides.isDirect ?? true,
    depth: overrides.depth ?? 1,
  };
}

/**
 * Create a mock BlastRadiusResponse
 *
 * @overload Create with specific nodeId
 * @param nodeId - The ID of the source node
 * @returns BlastRadiusResponse with the specified nodeId
 */
export function createMockBlastRadius(nodeId: string): BlastRadiusResponse;

/**
 * Create a mock BlastRadiusResponse
 *
 * @overload Create with property overrides
 * @param overrides - Partial BlastRadiusResponse to override defaults
 * @returns BlastRadiusResponse with applied overrides
 */
export function createMockBlastRadius(overrides?: Partial<BlastRadiusResponse>): BlastRadiusResponse;

/**
 * Implementation of createMockBlastRadius
 */
export function createMockBlastRadius(
  nodeIdOrOverrides?: string | Partial<BlastRadiusResponse>
): BlastRadiusResponse {
  // Handle string parameter (nodeId shorthand)
  if (typeof nodeIdOrOverrides === 'string') {
    return createMockBlastRadius({ nodeId: nodeIdOrOverrides });
  }

  // Handle object overrides (original behavior)
  const overrides = nodeIdOrOverrides ?? {};
  const directCount = overrides.directDependents ?? 3;
  const transitiveCount = overrides.transitiveDependents ?? 5;

  const affectedNodes: AffectedNode[] = overrides.affectedNodes ?? [
    ...Array.from({ length: directCount }, (_, i) =>
      createMockAffectedNode({ isDirect: true, depth: 1 })
    ),
    ...Array.from({ length: transitiveCount }, (_, i) =>
      createMockAffectedNode({ isDirect: false, depth: 2 + Math.floor(i / 2) })
    ),
  ];

  return {
    nodeId: overrides.nodeId ?? 'source-node',
    directDependents: directCount,
    transitiveDependents: transitiveCount,
    impactScore: overrides.impactScore ?? 0.5,
    severity: overrides.severity ?? 'medium',
    affectedNodes,
  };
}

// ============================================================================
// Mock Data Factories - Filters
// ============================================================================

/**
 * Create mock GraphFilters
 */
export function createMockFilters(overrides: Partial<GraphFilters> = {}): GraphFilters {
  return {
    ...defaultGraphFilters,
    ...overrides,
  };
}

/**
 * Create mock ExtendedGraphFilters
 */
export function createMockExtendedFilters(overrides: Partial<ExtendedGraphFilters> = {}): ExtendedGraphFilters {
  return {
    ...defaultExtendedGraphFilters,
    ...overrides,
  };
}

// ============================================================================
// Mock API Responses
// ============================================================================

export const mockApiResponses = {
  /**
   * Success response wrapper
   */
  success: <T,>(data: T) => ({
    success: true,
    data,
    message: 'OK',
  }),

  /**
   * Error response wrapper
   */
  error: (message: string, code: string = 'ERROR') => ({
    success: false,
    error: { message, code },
  }),

  /**
   * Graph data response
   */
  graphData: (overrides: Partial<GraphData> = {}) =>
    mockApiResponses.success(createMockGraphData(overrides)),

  /**
   * Node detail response
   */
  nodeDetail: (node: GraphNode, dependencies: GraphNode[] = [], dependents: GraphNode[] = []) =>
    mockApiResponses.success({
      ...node,
      dependencies,
      dependents,
    }),

  /**
   * Blast radius response
   */
  blastRadius: (overrides: Partial<BlastRadiusResponse> = {}) =>
    mockApiResponses.success(createMockBlastRadius(overrides)),
};

// ============================================================================
// Mock Functions
// ============================================================================

/**
 * Create mock useNavigate function
 */
export function createMockNavigate() {
  return vi.fn();
}

/**
 * Create mock useSearchParams
 */
export function createMockSearchParams(initialParams: Record<string, string> = {}) {
  const params = new URLSearchParams(initialParams);
  const setParams = vi.fn((newParams: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => {
    if (typeof newParams === 'function') {
      const updated = newParams(params);
      updated.forEach((value, key) => params.set(key, value));
    } else {
      newParams.forEach((value, key) => params.set(key, value));
    }
  });

  return [params, setParams] as const;
}

/**
 * Create mock localStorage
 */
export function createMockLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    reset: () => {
      store = {};
    },
  };
}

// ============================================================================
// Reset Utilities
// ============================================================================

/**
 * Reset all ID counters (call in beforeEach)
 */
export function resetIdCounters(): void {
  nodeIdCounter = 0;
  edgeIdCounter = 0;
}

// ============================================================================
// Wait Utilities
// ============================================================================

/**
 * Wait for specified milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for next tick
 */
export function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that all nodes have valid positions
 */
export function assertValidPositions(nodes: FlowNode[]): void {
  nodes.forEach((node) => {
    expect(node.position).toBeDefined();
    expect(typeof node.position.x).toBe('number');
    expect(typeof node.position.y).toBe('number');
    expect(Number.isFinite(node.position.x)).toBe(true);
    expect(Number.isFinite(node.position.y)).toBe(true);
  });
}

/**
 * Assert that edges reference valid nodes
 */
export function assertValidEdges(edges: FlowEdge[], nodeIds: Set<string>): void {
  edges.forEach((edge) => {
    expect(nodeIds.has(edge.source)).toBe(true);
    expect(nodeIds.has(edge.target)).toBe(true);
  });
}

export default {
  createTestQueryClient,
  renderWithProviders,
  createMockNode,
  createMockNodes,
  createMockEdge,
  createMockEdgeChain,
  createMockGraphData,
  createMockFlowNode,
  createMockFlowNodes,
  createMockFlowEdge,
  createMockFlowEdges,
  createMockBlastRadius,
  createMockFilters,
  createMockExtendedFilters,
  mockApiResponses,
  resetIdCounters,
  wait,
  waitForNextTick,
};
