/**
 * Filter Integration Tests
 * Tests for filter functionality across components
 * @module features/graph/__tests__/integration/filterIntegration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useGraph } from '../../hooks/useGraph';
import { useGraphUrlState } from '../../hooks/useGraphUrlState';
import * as api from '../../api';
import {
  createTestQueryClient,
  createMockGraphData,
  createMockNode,
  createMockFlowNodes,
  createMockBlastRadius,
} from '../utils/testUtils';
import {
  filterNodes,
  filterNodesByType,
  filterNodesBySearch,
  applyHighlighting,
} from '../../utils/filters';
import { ALL_NODE_TYPES, defaultGraphFilters } from '../../types';
import type { GraphData, GraphNode, GraphFilters, FlowNode } from '../../types';

// Mock the API module
vi.mock('../../api', () => ({
  fetchGraph: vi.fn(),
  fetchNodeDetail: vi.fn(),
  calculateBlastRadius: vi.fn(),
}));

describe('Filter Integration', () => {
  let queryClient: QueryClient;

  function createWrapper() {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  describe('node type filtering', () => {
    const mixedTypeGraphNodes: GraphNode[] = [
      createMockNode({ id: 'tf-1', name: 'VPC', type: 'terraform_resource' }),
      createMockNode({ id: 'tf-2', name: 'Subnet', type: 'terraform_resource' }),
      createMockNode({ id: 'mod-1', name: 'Network Module', type: 'terraform_module' }),
      createMockNode({ id: 'helm-1', name: 'Ingress', type: 'helm_chart' }),
      createMockNode({ id: 'k8s-1', name: 'Deployment', type: 'k8s_resource' }),
    ];
    const mixedTypeNodes: FlowNode[] = createMockFlowNodes(mixedTypeGraphNodes);

    it('should filter by single node type', () => {
      const result = filterNodesByType(mixedTypeNodes, ['terraform_resource']);

      expect(result.length).toBe(2);
      expect(result.every((n) => n.data.type === 'terraform_resource')).toBe(true);
    });

    it('should filter by multiple node types', () => {
      const result = filterNodesByType(mixedTypeNodes, [
        'terraform_resource',
        'helm_chart',
      ]);

      expect(result.length).toBe(3);
      expect(result.some((n) => n.data.type === 'terraform_resource')).toBe(true);
      expect(result.some((n) => n.data.type === 'helm_chart')).toBe(true);
      expect(result.some((n) => n.data.type === 'k8s_resource')).toBe(false);
    });

    it('should return all nodes when all types selected', () => {
      const result = filterNodesByType(mixedTypeNodes, [...ALL_NODE_TYPES]);

      expect(result.length).toBe(mixedTypeNodes.length);
    });

    it('should return all nodes when no types selected (show all behavior)', () => {
      const result = filterNodesByType(mixedTypeNodes, []);

      // Empty types array means "no filter" = show all nodes
      expect(result.length).toBe(mixedTypeNodes.length);
    });
  });

  describe('search filtering', () => {
    const searchableGraphNodes: GraphNode[] = [
      createMockNode({ id: 'n1', name: 'aws_vpc_main' }),
      createMockNode({ id: 'n2', name: 'aws_subnet_private' }),
      createMockNode({ id: 'n3', name: 'helm_nginx_ingress' }),
      createMockNode({ id: 'n4', name: 'k8s_deployment_api' }),
      createMockNode({
        id: 'n5',
        name: 'aws_s3_bucket',
        location: { filePath: '/modules/storage/main.tf', startLine: 1, endLine: 10 },
      }),
    ];
    const searchableNodes: FlowNode[] = createMockFlowNodes(searchableGraphNodes);

    it('should filter by name substring', () => {
      const result = filterNodesBySearch(searchableNodes, 'aws');

      expect(result.length).toBe(3);
      expect(result.every((n) => n.data.name.includes('aws'))).toBe(true);
    });

    it('should be case insensitive', () => {
      const result = filterNodesBySearch(searchableNodes, 'AWS');

      expect(result.length).toBe(3);
    });

    it('should filter by file path', () => {
      const result = filterNodesBySearch(searchableNodes, 'storage');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('n5');
    });

    it('should filter by node ID', () => {
      const result = filterNodesBySearch(searchableNodes, 'n3');

      expect(result.length).toBe(1);
      expect(result[0].data.name).toBe('helm_nginx_ingress');
    });

    it('should return all nodes for empty search', () => {
      const result = filterNodesBySearch(searchableNodes, '');

      expect(result.length).toBe(searchableNodes.length);
    });

    it('should return empty for no matches', () => {
      const result = filterNodesBySearch(searchableNodes, 'nonexistent');

      expect(result.length).toBe(0);
    });
  });

  describe('combined filtering', () => {
    const graphNodes: GraphNode[] = [
      createMockNode({ id: 'n1', name: 'aws_vpc', type: 'terraform_resource' }),
      createMockNode({ id: 'n2', name: 'aws_subnet', type: 'terraform_resource' }),
      createMockNode({ id: 'n3', name: 'gcp_vpc', type: 'terraform_resource' }),
      createMockNode({ id: 'n4', name: 'helm_vpc', type: 'helm_chart' }),
    ];
    const nodes: FlowNode[] = createMockFlowNodes(graphNodes);

    it('should apply both type and search filters', () => {
      const filters: GraphFilters = {
        nodeTypes: ['terraform_resource'],
        search: 'aws',
        showBlastRadius: false,
      };

      const typeFiltered = filterNodesByType(nodes, filters.nodeTypes);
      const result = filterNodesBySearch(typeFiltered, filters.search);

      expect(result.length).toBe(2);
      expect(result.every((n) => n.data.type === 'terraform_resource')).toBe(true);
      expect(result.every((n) => n.data.name.includes('aws'))).toBe(true);
    });

    it('should use filterNodes utility for combined filtering', () => {
      const filters: GraphFilters = {
        nodeTypes: ['terraform_resource'],
        search: 'vpc',
        showBlastRadius: false,
      };

      // filterNodes expects ExtendedGraphFilters, so add required fields
      const extendedFilters = {
        ...filters,
        edgeTypes: ['DEPENDS_ON', 'REFERENCES', 'CONTAINS', 'IMPORTS'] as const,
        minConfidence: 0,
        maxDepth: Infinity,
        showConnectedOnly: false,
      };

      const result = filterNodes(nodes, extendedFilters);

      expect(result.length).toBe(2);
      expect(result.some((n) => n.data.name === 'aws_vpc')).toBe(true);
      expect(result.some((n) => n.data.name === 'gcp_vpc')).toBe(true);
    });
  });

  describe('URL state synchronization', () => {
    it('should persist filters to URL', async () => {
      const { result } = renderHook(
        () => useGraphUrlState({ debounceMs: 0 }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.setSearch('vpc');
        result.current.setNodeTypes(['terraform_resource']);
      });

      // Check that shareable URL contains filters
      const url = result.current.getShareableUrl();
      expect(url).toContain('q=vpc');
      expect(url).toContain('types=terraform_resource');
    });

    it('should track active filter count', async () => {
      const { result } = renderHook(
        () => useGraphUrlState(),
        { wrapper: createWrapper() }
      );

      expect(result.current.hasActiveFilters).toBe(false);

      act(() => {
        result.current.setSearch('test');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should track hidden node type count', async () => {
      const { result } = renderHook(
        () => useGraphUrlState(),
        { wrapper: createWrapper() }
      );

      expect(result.current.hiddenNodeTypeCount).toBe(0);

      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });

      expect(result.current.hiddenNodeTypeCount).toBe(ALL_NODE_TYPES.length - 1);
    });
  });

  describe('filter with graph data flow', () => {
    it('should filter fetched data correctly', async () => {
      const mockData: GraphData = {
        nodes: [
          createMockNode({ id: 'n1', name: 'aws_vpc', type: 'terraform_resource' }),
          createMockNode({ id: 'n2', name: 'helm_nginx', type: 'helm_chart' }),
          createMockNode({ id: 'n3', name: 'aws_subnet', type: 'terraform_resource' }),
        ],
        edges: [
          { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n3', type: 'DEPENDS_ON', confidence: 1 },
          { id: 'e2', sourceNodeId: 'n1', targetNodeId: 'n2', type: 'REFERENCES', confidence: 0.8 },
        ],
      };

      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () =>
          useGraph({
            scanId: 'scan-123',
            initialFilters: { nodeTypes: ['terraform_resource'] },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Only terraform resources should be visible
      expect(result.current.nodes.length).toBe(2);
      expect(result.current.nodes.every((n) => n.data.type === 'terraform_resource')).toBe(true);

      // Only edge between terraform resources should be visible
      expect(result.current.edges.length).toBe(1);
      expect(result.current.edges[0].source).toBe('n1');
      expect(result.current.edges[0].target).toBe('n3');
    });

    it('should update view when filters change', async () => {
      const mockData: GraphData = {
        nodes: [
          createMockNode({ id: 'n1', type: 'terraform_resource' }),
          createMockNode({ id: 'n2', type: 'helm_chart' }),
        ],
        edges: [],
      };

      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initially all nodes visible
      expect(result.current.nodes.length).toBe(2);

      // Filter to only terraform_resource
      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });

      // Wait for derived state to update
      await waitFor(() => {
        expect(result.current.nodes.length).toBe(1);
      });
      expect(result.current.nodes[0].data.type).toBe('terraform_resource');
    });
  });

  describe('highlighting integration', () => {
    it('should highlight selected node', () => {
      const graphNodes: GraphNode[] = [
        createMockNode({ id: 'n1', name: 'vpc_main' }),
        createMockNode({ id: 'n2', name: 'subnet_private' }),
        createMockNode({ id: 'n3', name: 'vpc_secondary' }),
      ];
      const nodes: FlowNode[] = createMockFlowNodes(graphNodes);

      // When a node is selected without blast radius, it should be highlighted
      const highlighted = applyHighlighting(nodes, 'n1', null);

      const highlightedNodes = highlighted.filter((n) => n.data.highlighted);
      expect(highlightedNodes.length).toBe(1);
      expect(highlightedNodes[0].id).toBe('n1');
    });

    it('should highlight blast radius affected nodes', () => {
      const graphNodes: GraphNode[] = [
        createMockNode({ id: 'n1', name: 'source' }),
        createMockNode({ id: 'n2', name: 'affected1' }),
        createMockNode({ id: 'n3', name: 'affected2' }),
        createMockNode({ id: 'n4', name: 'unaffected' }),
      ];
      const nodes: FlowNode[] = createMockFlowNodes(graphNodes);

      // Create blast radius with affected nodes n2 and n3 (n1 is the source)
      const blastRadius = createMockBlastRadius({
        nodeId: 'n1',
        affectedNodes: [
          { id: 'n2', name: 'affected1', type: 'terraform_resource', isDirect: true, depth: 1 },
          { id: 'n3', name: 'affected2', type: 'terraform_resource', isDirect: false, depth: 2 },
        ],
      });

      const highlighted = applyHighlighting(nodes, 'n1', blastRadius);

      // n1 (source) + n2 + n3 should be highlighted
      const highlightedNodes = highlighted.filter((n) => n.data.highlighted);
      expect(highlightedNodes.length).toBe(3);

      // n4 should be dimmed (not affected)
      const dimmedNodes = highlighted.filter((n) => n.data.dimmed);
      expect(dimmedNodes.length).toBe(1);
      expect(dimmedNodes[0].id).toBe('n4');
    });

    it('should mark selected node', () => {
      const graphNodes: GraphNode[] = [
        createMockNode({ id: 'n1' }),
        createMockNode({ id: 'n2' }),
      ];
      const nodes: FlowNode[] = createMockFlowNodes(graphNodes);

      const highlighted = applyHighlighting(nodes, 'n1', null);

      expect(highlighted.find((n) => n.id === 'n1')?.data.selected).toBe(true);
      expect(highlighted.find((n) => n.id === 'n2')?.data.selected).toBe(false);
    });
  });

  describe('filter reset', () => {
    it('should reset to default filters', async () => {
      const mockData = createMockGraphData(5, 4);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Apply filters in separate acts for proper state batching
      act(() => {
        result.current.setSearch('test');
      });
      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });
      act(() => {
        result.current.toggleBlastRadius();
      });

      // Verify filters are set
      expect(result.current.filters.search).toBe('test');
      expect(result.current.filters.showBlastRadius).toBe(true);

      // Reset
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.nodeTypes).toEqual(defaultGraphFilters.nodeTypes);
      expect(result.current.filters.showBlastRadius).toBe(false);
    });

    it('should show all nodes after reset', async () => {
      const mockData: GraphData = {
        nodes: [
          createMockNode({ id: 'n1', type: 'terraform_resource' }),
          createMockNode({ id: 'n2', type: 'helm_chart' }),
          createMockNode({ id: 'n3', type: 'k8s_resource' }),
        ],
        edges: [],
      };

      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial state - all nodes visible
      expect(result.current.nodes.length).toBe(3);

      // Filter down
      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });

      // Wait for filter to apply
      await waitFor(() => {
        expect(result.current.nodes.length).toBe(1);
      });

      // Reset
      act(() => {
        result.current.resetFilters();
      });

      // Wait for reset to apply
      await waitFor(() => {
        expect(result.current.nodes.length).toBe(3);
      });
    });
  });

  describe('toggle operations', () => {
    it('should toggle individual node type', async () => {
      const { result } = renderHook(
        () => useGraphUrlState(),
        { wrapper: createWrapper() }
      );

      // Start with all types
      expect(result.current.filters.nodeTypes).toEqual(ALL_NODE_TYPES);

      // Toggle off terraform_resource
      act(() => {
        result.current.toggleNodeType('terraform_resource');
      });

      expect(result.current.filters.nodeTypes).not.toContain('terraform_resource');

      // Toggle back on
      act(() => {
        result.current.toggleNodeType('terraform_resource');
      });

      expect(result.current.filters.nodeTypes).toContain('terraform_resource');
    });

    it('should not allow toggling off the last type', async () => {
      const { result } = renderHook(
        () =>
          useGraphUrlState({
            defaultFilters: { nodeTypes: ['terraform_resource'] },
          }),
        { wrapper: createWrapper() }
      );

      // Try to toggle off the only type
      act(() => {
        result.current.toggleNodeType('terraform_resource');
      });

      // Should still have the type
      expect(result.current.filters.nodeTypes).toContain('terraform_resource');
    });

    it('should toggle blast radius mode', async () => {
      const { result } = renderHook(
        () => useGraphUrlState(),
        { wrapper: createWrapper() }
      );

      expect(result.current.filters.showBlastRadius).toBe(false);

      act(() => {
        result.current.toggleBlastRadius();
      });

      expect(result.current.filters.showBlastRadius).toBe(true);

      act(() => {
        result.current.toggleBlastRadius();
      });

      expect(result.current.filters.showBlastRadius).toBe(false);
    });
  });
});
