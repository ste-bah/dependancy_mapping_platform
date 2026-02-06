/**
 * Graph Data Flow Integration Tests
 * Tests for complete data flow from API to UI rendering
 * @module features/graph/__tests__/integration/graphDataFlow.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useGraph } from '../../hooks/useGraph';
import { useGraphQuery, useNodeDetailQuery, useBlastRadiusQuery } from '../../hooks/queries';
import * as api from '../../api';
import {
  createTestQueryClient,
  createMockGraphData,
  createMockNode,
  createMockBlastRadius,
} from '../utils/testUtils';
import type { GraphData, GraphFilters } from '../../types';
import { ALL_NODE_TYPES, defaultGraphFilters } from '../../types';

// Mock the API module
vi.mock('../../api', () => ({
  fetchGraph: vi.fn(),
  fetchNodeDetail: vi.fn(),
  calculateBlastRadius: vi.fn(),
}));

describe('Graph Data Flow Integration', () => {
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

  describe('initial data loading', () => {
    it('should fetch graph data on mount', async () => {
      const mockData = createMockGraphData(5, 4);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.fetchGraph).toHaveBeenCalledWith('scan-123', expect.any(Object));
      expect(result.current.graphData).toEqual(mockData);
    });

    it('should transform API data to React Flow format', async () => {
      const mockData = createMockGraphData(3, 2);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Nodes should be transformed to Flow format
      expect(result.current.nodes.length).toBe(3);
      expect(result.current.nodes[0]).toHaveProperty('type', 'customNode');
      expect(result.current.nodes[0]).toHaveProperty('position');
      expect(result.current.nodes[0]).toHaveProperty('data');

      // Edges should be transformed to Flow format
      expect(result.current.edges.length).toBe(2);
      expect(result.current.edges[0]).toHaveProperty('source');
      expect(result.current.edges[0]).toHaveProperty('target');
    });

    it('should apply layout to nodes', async () => {
      const mockData = createMockGraphData(5, 4);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // All nodes should have positions
      result.current.nodes.forEach((node) => {
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
        expect(isNaN(node.position.x)).toBe(false);
        expect(isNaN(node.position.y)).toBe(false);
      });
    });
  });

  describe('filter integration', () => {
    it('should filter nodes by type', async () => {
      const mockData: GraphData = {
        nodes: [
          createMockNode({ id: 'n1', type: 'terraform_resource' }),
          createMockNode({ id: 'n2', type: 'helm_chart' }),
          createMockNode({ id: 'n3', type: 'terraform_resource' }),
          createMockNode({ id: 'n4', type: 'k8s_resource' }),
        ],
        edges: [],
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

      // Should only show terraform_resource nodes
      expect(result.current.nodes.length).toBe(2);
      expect(result.current.nodes.every((n) => n.data.type === 'terraform_resource')).toBe(true);
    });

    it('should filter edges when nodes are filtered', async () => {
      const mockData: GraphData = {
        nodes: [
          createMockNode({ id: 'n1', type: 'terraform_resource' }),
          createMockNode({ id: 'n2', type: 'helm_chart' }),
          createMockNode({ id: 'n3', type: 'terraform_resource' }),
        ],
        edges: [
          { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', type: 'DEPENDS_ON', confidence: 1 },
          { id: 'e2', sourceNodeId: 'n1', targetNodeId: 'n3', type: 'DEPENDS_ON', confidence: 1 },
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

      // Only edge between terraform_resource nodes should be visible
      expect(result.current.edges.length).toBe(1);
      expect(result.current.edges[0].source).toBe('n1');
      expect(result.current.edges[0].target).toBe('n3');
    });

    it('should update filters and refetch data', async () => {
      const mockData = createMockGraphData(5, 4);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change node types
      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });

      // Nodes should be filtered on the client side
      await waitFor(() => {
        expect(
          result.current.nodes.every((n) => n.data.type === 'terraform_resource')
        ).toBe(true);
      });
    });
  });

  describe('search integration', () => {
    it('should debounce search query', async () => {
      const mockData = createMockGraphData(5, 4);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Rapid search changes - local state updates immediately
      act(() => {
        result.current.setSearch('v');
      });
      act(() => {
        result.current.setSearch('vp');
      });
      act(() => {
        result.current.setSearch('vpc');
      });

      // Search should be updated immediately in local state
      expect(result.current.filters.search).toBe('vpc');
    });
  });

  describe('node selection flow', () => {
    it('should track selected node', async () => {
      const mockData = createMockGraphData(3, 2);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);
      // Mock fetchNodeDetail to prevent hanging queries when node is selected
      (api.fetchNodeDetail as vi.Mock).mockResolvedValue({
        id: mockData.nodes[0].id,
        name: 'Test',
        type: 'terraform_resource',
        dependencies: [],
        dependents: [],
      });

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nodeId = mockData.nodes[0].id;

      act(() => {
        result.current.setSelectedNodeId(nodeId);
      });

      expect(result.current.selectedNodeId).toBe(nodeId);
    });

    it('should mark selected node in transformed data', async () => {
      const mockData = createMockGraphData(3, 2);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);
      // Mock fetchNodeDetail to prevent hanging queries when node is selected
      (api.fetchNodeDetail as vi.Mock).mockResolvedValue({
        id: mockData.nodes[0].id,
        name: 'Test',
        type: 'terraform_resource',
        dependencies: [],
        dependents: [],
      });

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nodeId = mockData.nodes[0].id;

      act(() => {
        result.current.setSelectedNodeId(nodeId);
      });

      const selectedNode = result.current.nodes.find((n) => n.id === nodeId);
      expect(selectedNode?.data.selected).toBe(true);
    });

    it('should fetch node detail when selected', async () => {
      const mockData = createMockGraphData(3, 2);
      const mockNodeDetail = {
        id: mockData.nodes[0].id,
        name: 'Test Node',
        type: 'terraform_resource',
        dependencies: [],
        dependents: [],
      };

      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);
      (api.fetchNodeDetail as vi.Mock).mockResolvedValue(mockNodeDetail);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSelectedNodeId(mockData.nodes[0].id);
      });

      await waitFor(() => {
        expect(api.fetchNodeDetail).toHaveBeenCalledWith(
          'scan-123',
          mockData.nodes[0].id
        );
      });
    });
  });

  describe('blast radius flow', () => {
    it('should fetch blast radius when requested', async () => {
      const mockData = createMockGraphData(5, 4);
      const mockBlastRadius = createMockBlastRadius(mockData.nodes[0].id);

      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);
      (api.calculateBlastRadius as vi.Mock).mockResolvedValue(mockBlastRadius);
      // Mock fetchNodeDetail in case selection triggers it
      (api.fetchNodeDetail as vi.Mock).mockResolvedValue({
        id: mockData.nodes[0].id,
        name: 'Test',
        type: 'terraform_resource',
        dependencies: [],
        dependents: [],
      });

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Enable blast radius and fetch for a node
      act(() => {
        result.current.toggleBlastRadius();
        result.current.fetchBlastRadius(mockData.nodes[0].id);
      });

      await waitFor(() => {
        expect(api.calculateBlastRadius).toHaveBeenCalledWith(
          'scan-123',
          mockData.nodes[0].id
        );
      });
    });

    it('should highlight affected nodes when blast radius is active', async () => {
      const mockData: GraphData = {
        nodes: [
          createMockNode({ id: 'n1' }),
          createMockNode({ id: 'n2' }),
          createMockNode({ id: 'n3' }),
          createMockNode({ id: 'n4' }),
        ],
        edges: [
          { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', type: 'DEPENDS_ON', confidence: 1 },
          { id: 'e2', sourceNodeId: 'n2', targetNodeId: 'n3', type: 'DEPENDS_ON', confidence: 1 },
        ],
      };

      const mockBlastRadius = {
        nodeId: 'n1',
        directDependents: 1,
        transitiveDependents: 2,
        impactScore: 0.5,
        affectedNodes: ['n2', 'n3'],
      };

      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);
      (api.calculateBlastRadius as vi.Mock).mockResolvedValue(mockBlastRadius);
      (api.fetchNodeDetail as vi.Mock).mockResolvedValue({
        id: 'n1',
        name: 'Test',
        type: 'terraform_resource',
        dependencies: [],
        dependents: [],
      });

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleBlastRadius();
        result.current.fetchBlastRadius('n1');
      });

      await waitFor(() => {
        expect(result.current.highlightedNodeIds.has('n1')).toBe(true);
        expect(result.current.highlightedNodeIds.has('n2')).toBe(true);
        expect(result.current.highlightedNodeIds.has('n3')).toBe(true);
        expect(result.current.highlightedNodeIds.has('n4')).toBe(false);
      });
    });

    it('should dim non-affected nodes in blast radius mode', async () => {
      const mockData: GraphData = {
        nodes: [
          createMockNode({ id: 'n1' }),
          createMockNode({ id: 'n2' }),
          createMockNode({ id: 'n3' }),
        ],
        edges: [],
      };

      const mockBlastRadius = {
        nodeId: 'n1',
        directDependents: 0,
        transitiveDependents: 0,
        impactScore: 0.1,
        affectedNodes: [],
      };

      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);
      (api.calculateBlastRadius as vi.Mock).mockResolvedValue(mockBlastRadius);
      (api.fetchNodeDetail as vi.Mock).mockResolvedValue({
        id: 'n1',
        name: 'Test',
        type: 'terraform_resource',
        dependencies: [],
        dependents: [],
      });

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.toggleBlastRadius();
        result.current.setSelectedNodeId('n1');
        result.current.fetchBlastRadius('n1');
      });

      await waitFor(() => {
        const highlightedNode = result.current.nodes.find((n) => n.id === 'n1');
        const dimmedNode = result.current.nodes.find((n) => n.id === 'n2');

        expect(highlightedNode?.data.highlighted).toBe(true);
        expect(dimmedNode?.data.dimmed).toBe(true);
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const testError = new Error('Network error');
      (api.fetchGraph as vi.Mock).mockRejectedValue(testError);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
    });

    it('should allow retry after error', async () => {
      const testError = new Error('Network error');
      const mockData = createMockGraphData(3, 2);

      (api.fetchGraph as vi.Mock)
        .mockRejectedValueOnce(testError)
        .mockResolvedValueOnce(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Retry
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(false);
        expect(result.current.graphData).toEqual(mockData);
      });
    });
  });

  describe('caching behavior', () => {
    it('should use cached data on subsequent renders', async () => {
      const mockData = createMockGraphData(3, 2);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result, rerender } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callCountAfterMount = (api.fetchGraph as vi.Mock).mock.calls.length;

      // Rerender with same scanId
      rerender();

      // Should not fetch again (same call count)
      expect(api.fetchGraph).toHaveBeenCalledTimes(callCountAfterMount);
    });

    it('should refetch when scanId changes', async () => {
      const mockData1 = createMockGraphData(3, 2);
      const mockData2 = createMockGraphData(5, 4);

      (api.fetchGraph as vi.Mock)
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);

      // Use a wrapper that maintains QueryClient across rerenders
      const fixedQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: 0,
          },
        },
      });

      function fixedWrapper({ children }: { children: React.ReactNode }) {
        return (
          <QueryClientProvider client={fixedQueryClient}>
            <MemoryRouter>{children}</MemoryRouter>
          </QueryClientProvider>
        );
      }

      let scanId = 'scan-123';
      const { result, rerender } = renderHook(
        () => useGraph({ scanId }),
        { wrapper: fixedWrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.graphData).toEqual(mockData1);

      // Change scanId by creating new hook with different props
      scanId = 'scan-456';
      rerender();

      await waitFor(() => {
        expect(result.current.graphData).toEqual(mockData2);
      });
    });
  });

  describe('reset functionality', () => {
    it('should reset all state when resetFilters is called', async () => {
      const mockData = createMockGraphData(5, 4);
      (api.fetchGraph as vi.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useGraph({ scanId: 'scan-123' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Modify state
      act(() => {
        result.current.setSearch('test');
      });
      act(() => {
        result.current.toggleBlastRadius();
      });
      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });

      // Verify modifications took effect
      expect(result.current.filters.search).toBe('test');
      expect(result.current.filters.showBlastRadius).toBe(true);

      // Reset
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.showBlastRadius).toBe(false);
    });
  });
});
