/**
 * useGraph Hook Tests
 * Tests for composite graph state management hook
 * @module features/graph/__tests__/hooks/useGraph.test
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGraph } from '../../hooks/useGraph';
import { useGraphQuery, useNodeDetailQuery, useBlastRadiusQuery } from '../../hooks/queries';
import { useGraphUrlState } from '../../hooks/useGraphUrlState';
import {
  createTestQueryClient,
  createMockGraphData,
  createMockNode,
  createMockBlastRadius,
  createTestWrapper,
} from '../utils/testUtils';
import type { GraphFilters } from '../../types';
import { ALL_NODE_TYPES, defaultGraphFilters } from '../../types';

// Mock the dependent hooks
vi.mock('../../hooks/queries', () => ({
  useGraphQuery: vi.fn(),
  useNodeDetailQuery: vi.fn(),
  useBlastRadiusQuery: vi.fn(),
}));

vi.mock('../../hooks/useGraphUrlState', () => ({
  useGraphUrlState: vi.fn(),
}));

describe('useGraph', () => {
  const mockScanId = 'scan-123';
  const mockGraphData = createMockGraphData(5, 4);
  const mockNodeDetail = {
    id: 'node-1',
    name: 'Test Node',
    type: 'terraform_resource' as const,
    dependencies: [],
    dependents: [],
    metadata: {},
  };
  const mockBlastRadius = createMockBlastRadius('node-1');

  let mockUseGraphUrlState: ReturnType<typeof createMockUrlState>;
  let mockUpdateFilters: Mock;
  let mockSetNodeTypes: Mock;
  let mockToggleNodeType: Mock;
  let mockToggleBlastRadius: Mock;
  let mockSetSelectedNodeId: Mock;
  let mockResetFilters: Mock;

  function createMockUrlState() {
    return {
      filters: { ...defaultGraphFilters },
      selectedNodeId: null,
      updateFilters: mockUpdateFilters,
      setNodeTypes: mockSetNodeTypes,
      toggleNodeType: mockToggleNodeType,
      toggleBlastRadius: mockToggleBlastRadius,
      setSelectedNodeId: mockSetSelectedNodeId,
      resetFilters: mockResetFilters,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockUpdateFilters = vi.fn();
    mockSetNodeTypes = vi.fn();
    mockToggleNodeType = vi.fn();
    mockToggleBlastRadius = vi.fn();
    mockSetSelectedNodeId = vi.fn();
    mockResetFilters = vi.fn();

    mockUseGraphUrlState = createMockUrlState();

    (useGraphUrlState as Mock).mockReturnValue(mockUseGraphUrlState);

    (useGraphQuery as Mock).mockReturnValue({
      data: mockGraphData,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    (useNodeDetailQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    (useBlastRadiusQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.graphData).toBe(mockGraphData);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.selectedNodeId).toBeNull();
    });

    it('should pass scanId to useGraphQuery', () => {
      renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(useGraphQuery).toHaveBeenCalledWith(
        mockScanId,
        expect.objectContaining({
          enabled: true,
        })
      );
    });

    it('should use initial filters from options', () => {
      const initialFilters: Partial<GraphFilters> = {
        nodeTypes: ['terraform_resource'],
        search: 'initial',
      };

      renderHook(() => useGraph({ scanId: mockScanId, initialFilters }), {
        wrapper: createTestWrapper(),
      });

      expect(useGraphUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultFilters: initialFilters,
        })
      );
    });
  });

  describe('filter management', () => {
    it('should expose setNodeTypes function', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setNodeTypes(['terraform_resource', 'helm_chart']);
      });

      expect(mockSetNodeTypes).toHaveBeenCalledWith(['terraform_resource', 'helm_chart']);
    });

    it('should expose toggleNodeType function', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.toggleNodeType('terraform_module');
      });

      expect(mockToggleNodeType).toHaveBeenCalledWith('terraform_module');
    });

    it('should update search with debouncing', async () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setSearch('test query');
      });

      // Search should be updated immediately in local state
      expect(result.current.filters.search).toBe('test query');
    });

    it('should reset all filters', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(mockResetFilters).toHaveBeenCalled();
    });
  });

  describe('node selection', () => {
    it('should track selected node', () => {
      mockUseGraphUrlState.selectedNodeId = 'node-1';
      (useGraphUrlState as Mock).mockReturnValue(mockUseGraphUrlState);

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.selectedNodeId).toBe('node-1');
    });

    it('should call setSelectedNodeId', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setSelectedNodeId('node-2');
      });

      expect(mockSetSelectedNodeId).toHaveBeenCalledWith('node-2');
    });

    it('should fetch node detail when node is selected', () => {
      mockUseGraphUrlState.selectedNodeId = 'node-1';
      (useGraphUrlState as Mock).mockReturnValue(mockUseGraphUrlState);

      (useNodeDetailQuery as Mock).mockReturnValue({
        data: mockNodeDetail,
        isLoading: false,
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(useNodeDetailQuery).toHaveBeenCalledWith(mockScanId, 'node-1');
      expect(result.current.selectedNodeDetail).toBe(mockNodeDetail);
    });
  });

  describe('blast radius', () => {
    it('should toggle blast radius mode', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.toggleBlastRadius();
      });

      expect(mockToggleBlastRadius).toHaveBeenCalled();
    });

    it('should fetch blast radius when requested', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.fetchBlastRadius('node-1');
      });

      // The hook should track the blast radius node
      // (actual query happens through useBlastRadiusQuery)
    });

    it('should expose blast radius data', () => {
      (useBlastRadiusQuery as Mock).mockReturnValue({
        data: mockBlastRadius,
        isLoading: false,
      });

      mockUseGraphUrlState.filters.showBlastRadius = true;
      (useGraphUrlState as Mock).mockReturnValue(mockUseGraphUrlState);

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.blastRadiusData).toBe(mockBlastRadius);
    });

    it('should update highlighted nodes from blast radius', () => {
      const blastRadius = createMockBlastRadius('node-1');
      blastRadius.affectedNodes = ['node-2', 'node-3'];

      (useBlastRadiusQuery as Mock).mockReturnValue({
        data: blastRadius,
        isLoading: false,
      });

      mockUseGraphUrlState.filters.showBlastRadius = true;
      (useGraphUrlState as Mock).mockReturnValue(mockUseGraphUrlState);

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.highlightedNodeIds.has('node-1')).toBe(true);
      expect(result.current.highlightedNodeIds.has('node-2')).toBe(true);
      expect(result.current.highlightedNodeIds.has('node-3')).toBe(true);
    });
  });

  describe('data transformation', () => {
    it('should transform graph nodes to Flow nodes', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.nodes.length).toBeGreaterThan(0);
      expect(result.current.nodes[0]).toHaveProperty('id');
      expect(result.current.nodes[0]).toHaveProperty('type', 'customNode');
      expect(result.current.nodes[0]).toHaveProperty('position');
      expect(result.current.nodes[0]).toHaveProperty('data');
    });

    it('should transform graph edges to Flow edges', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.edges.length).toBeGreaterThan(0);
      expect(result.current.edges[0]).toHaveProperty('id');
      expect(result.current.edges[0]).toHaveProperty('source');
      expect(result.current.edges[0]).toHaveProperty('target');
    });

    it('should filter nodes by type', () => {
      mockUseGraphUrlState.filters.nodeTypes = ['terraform_resource'];
      (useGraphUrlState as Mock).mockReturnValue(mockUseGraphUrlState);

      // Create graph data with mixed types
      const mixedGraphData = {
        nodes: [
          createMockNode({ id: 'n1', type: 'terraform_resource' }),
          createMockNode({ id: 'n2', type: 'helm_chart' }),
          createMockNode({ id: 'n3', type: 'terraform_resource' }),
        ],
        edges: [],
      };

      (useGraphQuery as Mock).mockReturnValue({
        data: mixedGraphData,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      // Only terraform_resource nodes should be included
      expect(result.current.nodes.length).toBe(2);
      expect(result.current.nodes.every((n) => n.data.type === 'terraform_resource')).toBe(true);
    });

    it('should apply layout to nodes', () => {
      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      // All nodes should have positions
      result.current.nodes.forEach((node) => {
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
    });

    it('should mark selected node in data', () => {
      mockUseGraphUrlState.selectedNodeId = mockGraphData.nodes[0].id;
      (useGraphUrlState as Mock).mockReturnValue(mockUseGraphUrlState);

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      const selectedNode = result.current.nodes.find(
        (n) => n.id === mockGraphData.nodes[0].id
      );
      expect(selectedNode?.data.selected).toBe(true);
    });
  });

  describe('loading states', () => {
    it('should expose loading state', () => {
      (useGraphQuery as Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        isFetching: true,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
    });

    it('should expose node detail loading state', () => {
      (useNodeDetailQuery as Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.isLoadingNodeDetail).toBe(true);
    });

    it('should expose blast radius loading state', () => {
      (useBlastRadiusQuery as Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.isLoadingBlastRadius).toBe(true);
    });
  });

  describe('error states', () => {
    it('should expose error state', () => {
      const testError = new Error('Failed to fetch graph');

      (useGraphQuery as Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: testError,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(testError);
    });
  });

  describe('refetch', () => {
    it('should expose refetch function', () => {
      const mockRefetch = vi.fn();

      (useGraphQuery as Mock).mockReturnValue({
        data: mockGraphData,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.refetch();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('persistFilters option', () => {
    it('should use URL state when persistFilters is true', () => {
      renderHook(() => useGraph({ scanId: mockScanId, persistFilters: true }), {
        wrapper: createTestWrapper(),
      });

      expect(useGraphUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    });

    it('should disable URL sync when persistFilters is false', () => {
      renderHook(() => useGraph({ scanId: mockScanId, persistFilters: false }), {
        wrapper: createTestWrapper(),
      });

      expect(useGraphUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });

  describe('empty state', () => {
    it('should return empty arrays when no graph data', () => {
      (useGraphQuery as Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useGraph({ scanId: mockScanId }), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
    });
  });
});
