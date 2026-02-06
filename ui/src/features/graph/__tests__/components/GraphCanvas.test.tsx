/**
 * GraphCanvas Component Tests
 * Tests for the main React Flow canvas component
 * @module features/graph/__tests__/components/GraphCanvas.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { GraphCanvas } from '../../components/GraphCanvas';
import {
  renderWithProviders,
  createMockNode,
  createMockGraphData,
} from '../utils/testUtils';

// Mock the useGraph hook
const mockUseGraph = vi.fn();
vi.mock('../../hooks', () => ({
  useGraph: () => mockUseGraph(),
}));

// Mock React Flow
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    ReactFlow: vi.fn(({ children, nodes, edges, onNodeClick, onPaneClick, ...props }) => (
      <div data-testid="react-flow" {...props}>
        <div data-testid="nodes-container">
          {nodes?.map((node: { id: string; data: { name: string } }) => (
            <div
              key={node.id}
              data-testid={`node-${node.id}`}
              onClick={() => onNodeClick?.({} as React.MouseEvent, node)}
            >
              {node.data.name}
            </div>
          ))}
        </div>
        <div data-testid="edges-container">
          {edges?.map((edge: { id: string; source: string; target: string }) => (
            <div key={edge.id} data-testid={`edge-${edge.id}`}>
              {edge.source} - {edge.target}
            </div>
          ))}
        </div>
        <div data-testid="pane" onClick={onPaneClick} />
        {children}
      </div>
    )),
    Background: vi.fn(() => <div data-testid="background" />),
    Controls: vi.fn(() => <div data-testid="controls" />),
    MiniMap: vi.fn(() => <div data-testid="minimap" />),
    Panel: vi.fn(({ children, position }) => (
      <div data-testid={`panel-${position}`}>{children}</div>
    )),
    useReactFlow: vi.fn(() => ({
      fitView: vi.fn(),
      setCenter: vi.fn(),
      getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      setViewport: vi.fn(),
    })),
    useNodesState: vi.fn((initial) => [initial, vi.fn(), vi.fn()]),
    useEdgesState: vi.fn((initial) => [initial, vi.fn(), vi.fn()]),
    BackgroundVariant: { Dots: 'dots' },
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock shared components
vi.mock('@/shared/components', () => ({
  Alert: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <div data-testid="alert" data-variant={variant}>{children}</div>
  ),
  Spinner: ({ size }: { size?: string }) => (
    <div data-testid="spinner" data-size={size}>Loading...</div>
  ),
}));

// Mock child components
vi.mock('../../components/CustomNode', () => ({
  CustomNode: ({ data }: { data: { name: string } }) => (
    <div data-testid="custom-node">{data.name}</div>
  ),
}));

vi.mock('../../components/FilterPanel', () => ({
  FilterPanel: () => <div data-testid="filter-panel">Filters</div>,
}));

vi.mock('../../components/SearchBar', () => ({
  SearchBar: () => <div data-testid="search-bar">Search</div>,
}));

vi.mock('../../components/DetailPanel', () => ({
  DetailPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="detail-panel">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock cn utility
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) =>
    classes.filter(Boolean).join(' '),
}));

describe('GraphCanvas', () => {
  const mockGraphData = createMockGraphData(5);
  const mockNodes = mockGraphData.nodes;

  const mockFlowNodes = mockNodes.map((node, index) => ({
    id: node.id,
    type: 'customNode',
    position: { x: index * 200, y: 0 },
    data: { ...node, selected: false, highlighted: false, dimmed: false },
  }));

  const mockFlowEdges = mockGraphData.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: 'smoothstep',
    animated: edge.type === 'DEPENDS_ON',
    data: { type: edge.type, confidence: edge.confidence, highlighted: false },
  }));

  const createMockHookReturn = (overrides = {}) => ({
    nodes: mockFlowNodes,
    edges: mockFlowEdges,
    graphData: mockGraphData,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    filters: {
      nodeTypes: [],
      search: '',
      showBlastRadius: false,
    },
    setNodeTypes: vi.fn(),
    toggleNodeType: vi.fn(),
    setSearch: vi.fn(),
    toggleBlastRadius: vi.fn(),
    resetFilters: vi.fn(),
    selectedNodeId: null,
    setSelectedNodeId: vi.fn(),
    selectedNodeDetail: null,
    isLoadingNodeDetail: false,
    blastRadiusData: null,
    isLoadingBlastRadius: false,
    fetchBlastRadius: vi.fn(),
    highlightedNodeIds: new Set<string>(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGraph.mockReturnValue(createMockHookReturn());
  });

  describe('rendering', () => {
    it('should render React Flow canvas when data is loaded', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should render all nodes', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByTestId('nodes-container')).toBeInTheDocument();
      // Nodes should be present in the container
      mockFlowNodes.forEach((node) => {
        expect(screen.getByTestId(`node-${node.id}`)).toBeInTheDocument();
      });
    });

    it('should render background', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByTestId('background')).toBeInTheDocument();
    });

    it('should render controls', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByTestId('controls')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when isLoading is true', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({ isLoading: true }));

      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading graph data/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error alert when isError is true', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        isError: true,
        error: { message: 'Failed to load' },
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByTestId('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load graph/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no nodes', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        graphData: { nodes: [], edges: [], metadata: mockGraphData.metadata },
        nodes: [],
        edges: [],
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByText(/no dependencies found/i)).toBeInTheDocument();
    });

    it('should show empty state when graphData is null', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        graphData: null,
        nodes: [],
        edges: [],
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByText(/no dependencies found/i)).toBeInTheDocument();
    });
  });

  describe('minimap', () => {
    it('should render minimap when showMinimap is true', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" showMinimap />);

      expect(screen.getByTestId('minimap')).toBeInTheDocument();
    });

    it('should not render minimap when showMinimap is false', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" showMinimap={false} />);

      expect(screen.queryByTestId('minimap')).not.toBeInTheDocument();
    });
  });

  describe('filter panel', () => {
    it('should render filter panel when showFilters is true', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" showFilters />);

      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    it('should not render filter panel when showFilters is false', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" showFilters={false} />);

      expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();
    });
  });

  describe('search bar', () => {
    it('should render search bar when showSearch is true', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" showSearch />);

      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    it('should not render search bar when showSearch is false', () => {
      renderWithProviders(<GraphCanvas scanId="test-scan" showSearch={false} />);

      expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument();
    });
  });

  describe('detail panel', () => {
    it('should render detail panel when node is selected and showDetails is true', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        selectedNodeId: 'node-1',
        selectedNodeDetail: createMockNode({ id: 'node-1' }),
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" showDetails />);

      expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
    });

    it('should not render detail panel when no node is selected', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        selectedNodeId: null,
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" showDetails />);

      expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
    });

    it('should not render detail panel when showDetails is false', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        selectedNodeId: 'node-1',
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" showDetails={false} />);

      expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
    });
  });

  describe('fetching indicator', () => {
    it('should show fetching indicator when isFetching but not isLoading', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        isFetching: true,
        isLoading: false,
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      expect(screen.getByText(/updating/i)).toBeInTheDocument();
    });

    it('should not show fetching indicator when isLoading is true', () => {
      mockUseGraph.mockReturnValue(createMockHookReturn({
        isFetching: true,
        isLoading: true,
      }));

      renderWithProviders(<GraphCanvas scanId="test-scan" />);

      // Loading state takes precedence
      expect(screen.queryByText(/updating/i)).not.toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithProviders(
        <GraphCanvas scanId="test-scan" className="custom-canvas" />
      );

      expect(container.firstChild).toHaveClass('custom-canvas');
    });
  });

  describe('onNodeSelect callback', () => {
    it('should be provided to internal handlers', () => {
      const onNodeSelect = vi.fn();
      renderWithProviders(
        <GraphCanvas scanId="test-scan" onNodeSelect={onNodeSelect} />
      );

      // The component is rendered with the callback
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });
});
