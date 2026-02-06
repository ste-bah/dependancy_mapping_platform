/**
 * Transformer Tests
 * Tests for API to Flow data transformations
 * @module features/graph/__tests__/utils/transformers.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformToFlowNode,
  transformToFlowNodes,
  transformToFlowEdge,
  transformToFlowEdges,
  transformToFlowEdgesValidated,
  transformGraphData,
  updateNodeData,
  updateEdgeData,
  updateNodesState,
  updateEdgesState,
  flowNodeToGraphNode,
  flowNodesToGraphNodes,
  flowEdgeToGraphEdge,
  flowEdgesToGraphEdges,
  createNodeMap,
  createEdgeMap,
  getConnectedEdges,
} from '../../utils/transformers';
import {
  createMockNode,
  createMockNodes,
  createMockEdge,
  createMockFlowNode,
  createMockFlowEdge,
  createMockGraphData,
  resetIdCounters,
} from './testUtils';
import type { GraphNode, GraphEdge, FlowNode, FlowEdge } from '../../types';

describe('transformers', () => {
  beforeEach(() => {
    resetIdCounters();
  });

  describe('transformToFlowNode', () => {
    it('should transform a GraphNode to FlowNode', () => {
      const node: GraphNode = {
        id: 'test-node',
        name: 'Test Resource',
        type: 'terraform_resource',
        location: { filePath: '/main.tf', startLine: 1, endLine: 10 },
        metadata: { provider: 'aws' },
      };

      const result = transformToFlowNode(node);

      expect(result.id).toBe('test-node');
      expect(result.type).toBe('customNode');
      expect(result.position).toEqual({ x: 0, y: 0 });
      expect(result.data.id).toBe('test-node');
      expect(result.data.name).toBe('Test Resource');
      expect(result.data.type).toBe('terraform_resource');
      expect(result.data.location).toEqual(node.location);
      expect(result.data.metadata).toEqual(node.metadata);
      expect(result.data.selected).toBe(false);
      expect(result.data.highlighted).toBe(false);
      expect(result.data.dimmed).toBe(false);
    });

    it('should apply custom position', () => {
      const node = createMockNode();
      const position = { x: 100, y: 200 };

      const result = transformToFlowNode(node, position);

      expect(result.position).toEqual(position);
    });

    it('should handle node without optional fields', () => {
      const node: GraphNode = {
        id: 'minimal-node',
        name: 'Minimal',
        type: 'external_reference',
      };

      const result = transformToFlowNode(node);

      expect(result.data.location).toBeUndefined();
      expect(result.data.metadata).toBeUndefined();
    });
  });

  describe('transformToFlowNodes', () => {
    it('should return empty array for empty input', () => {
      expect(transformToFlowNodes([])).toEqual([]);
    });

    it('should return empty array for null/undefined input', () => {
      expect(transformToFlowNodes(null as unknown as GraphNode[])).toEqual([]);
      expect(transformToFlowNodes(undefined as unknown as GraphNode[])).toEqual([]);
    });

    it('should transform multiple nodes', () => {
      const nodes = createMockNodes(3);

      const result = transformToFlowNodes(nodes);

      expect(result).toHaveLength(3);
      result.forEach((flowNode, i) => {
        expect(flowNode.id).toBe(nodes[i].id);
        expect(flowNode.data.name).toBe(nodes[i].name);
      });
    });
  });

  describe('transformToFlowEdge', () => {
    it('should transform a GraphEdge to FlowEdge', () => {
      const edge: GraphEdge = {
        id: 'edge-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        type: 'DEPENDS_ON',
        confidence: 0.95,
      };

      const result = transformToFlowEdge(edge);

      expect(result.id).toBe('edge-1');
      expect(result.source).toBe('node-a');
      expect(result.target).toBe('node-b');
      expect(result.type).toBe('smoothstep');
      expect(result.animated).toBe(true); // DEPENDS_ON is animated
      expect(result.data?.type).toBe('DEPENDS_ON');
      expect(result.data?.confidence).toBe(0.95);
      expect(result.data?.highlighted).toBe(false);
    });

    it('should not animate non-DEPENDS_ON edges', () => {
      const edge = createMockEdge({ type: 'REFERENCES' });

      const result = transformToFlowEdge(edge);

      expect(result.animated).toBe(false);
    });

    it('should apply correct styles based on edge type', () => {
      const dependsOnEdge = transformToFlowEdge(createMockEdge({ type: 'DEPENDS_ON' }));
      const referencesEdge = transformToFlowEdge(createMockEdge({ type: 'REFERENCES' }));

      // Different edge types should have different stroke colors
      expect(dependsOnEdge.style?.stroke).toBeDefined();
      expect(referencesEdge.style?.stroke).toBeDefined();
    });
  });

  describe('transformToFlowEdges', () => {
    it('should return empty array for empty input', () => {
      expect(transformToFlowEdges([])).toEqual([]);
    });

    it('should transform multiple edges', () => {
      const edges = [
        createMockEdge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' }),
        createMockEdge({ id: 'e2', sourceNodeId: 'b', targetNodeId: 'c' }),
      ];

      const result = transformToFlowEdges(edges);

      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('a');
      expect(result[1].source).toBe('b');
    });
  });

  describe('transformToFlowEdgesValidated', () => {
    it('should filter out edges with invalid source', () => {
      const edges = [
        createMockEdge({ sourceNodeId: 'valid', targetNodeId: 'valid2' }),
        createMockEdge({ sourceNodeId: 'invalid', targetNodeId: 'valid' }),
      ];
      const nodeIds = new Set(['valid', 'valid2']);

      const result = transformToFlowEdgesValidated(edges, nodeIds);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('valid');
    });

    it('should filter out edges with invalid target', () => {
      const edges = [
        createMockEdge({ sourceNodeId: 'a', targetNodeId: 'b' }),
        createMockEdge({ sourceNodeId: 'a', targetNodeId: 'missing' }),
      ];
      const nodeIds = new Set(['a', 'b']);

      const result = transformToFlowEdgesValidated(edges, nodeIds);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no nodes', () => {
      const edges = [createMockEdge()];

      const result = transformToFlowEdgesValidated(edges, new Set());

      expect(result).toHaveLength(0);
    });
  });

  describe('transformGraphData', () => {
    it('should transform complete graph data', () => {
      const graphData = createMockGraphData();

      const result = transformGraphData(graphData);

      expect(result.nodes).toHaveLength(graphData.nodes.length);
      // Edges that connect existing nodes
      expect(result.edges.length).toBeLessThanOrEqual(graphData.edges.length);
    });

    it('should return empty arrays for null/undefined', () => {
      expect(transformGraphData(null as any)).toEqual({ nodes: [], edges: [] });
      expect(transformGraphData(undefined as any)).toEqual({ nodes: [], edges: [] });
    });

    it('should validate edges against node IDs', () => {
      const graphData = {
        nodes: [createMockNode({ id: 'only-node' })],
        edges: [
          createMockEdge({ sourceNodeId: 'only-node', targetNodeId: 'missing' }),
        ],
      };

      const result = transformGraphData(graphData);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('updateNodeData', () => {
    it('should update node data preserving position', () => {
      const node = createMockFlowNode();
      node.position = { x: 100, y: 200 };

      const result = updateNodeData(node, {
        selected: true,
        highlighted: true,
      });

      expect(result.position).toEqual({ x: 100, y: 200 });
      expect(result.data.selected).toBe(true);
      expect(result.data.highlighted).toBe(true);
      expect(result.data.name).toBe(node.data.name); // Preserved
    });

    it('should not mutate original node', () => {
      const node = createMockFlowNode();
      const originalSelected = node.data.selected;

      updateNodeData(node, { selected: !originalSelected });

      expect(node.data.selected).toBe(originalSelected);
    });
  });

  describe('updateEdgeData', () => {
    it('should update edge data', () => {
      const edge = createMockFlowEdge();

      const result = updateEdgeData(edge, { highlighted: true });

      expect(result.data?.highlighted).toBe(true);
      expect(result.data?.type).toBe(edge.data?.type); // Preserved
    });
  });

  describe('updateNodesState', () => {
    it('should set selected state for matching node', () => {
      const nodes = [
        createMockFlowNode(),
        createMockFlowNode(),
        createMockFlowNode(),
      ];
      nodes[0].id = 'node-1';
      nodes[1].id = 'node-2';
      nodes[2].id = 'node-3';

      const result = updateNodesState(nodes, 'node-2', new Set());

      expect(result[0].data.selected).toBe(false);
      expect(result[1].data.selected).toBe(true);
      expect(result[2].data.selected).toBe(false);
    });

    it('should set highlighted state for nodes in set', () => {
      const nodes = [
        { ...createMockFlowNode(), id: 'node-1' },
        { ...createMockFlowNode(), id: 'node-2' },
        { ...createMockFlowNode(), id: 'node-3' },
      ];

      const result = updateNodesState(nodes, null, new Set(['node-1', 'node-3']));

      expect(result[0].data.highlighted).toBe(true);
      expect(result[1].data.highlighted).toBe(false);
      expect(result[2].data.highlighted).toBe(true);
    });

    it('should dim non-selected non-highlighted nodes when selection exists', () => {
      const nodes = [
        { ...createMockFlowNode(), id: 'selected' },
        { ...createMockFlowNode(), id: 'highlighted' },
        { ...createMockFlowNode(), id: 'other' },
      ];

      const result = updateNodesState(nodes, 'selected', new Set(['highlighted']));

      expect(result[0].data.dimmed).toBe(false); // Selected
      expect(result[1].data.dimmed).toBe(false); // Highlighted
      expect(result[2].data.dimmed).toBe(true); // Neither
    });
  });

  describe('updateEdgesState', () => {
    it('should highlight edges by their IDs', () => {
      const edges = [
        { ...createMockFlowEdge(), id: 'edge-a-b', source: 'a', target: 'b' },
        { ...createMockFlowEdge(), id: 'edge-b-c', source: 'b', target: 'c' },
        { ...createMockFlowEdge(), id: 'edge-c-d', source: 'c', target: 'd' },
      ];

      const highlightedEdgeIds = new Set(['edge-a-b']);
      const result = updateEdgesState(edges, highlightedEdgeIds);

      expect(result[0].data?.highlighted).toBe(true); // edge-a-b is in set
      expect(result[1].data?.highlighted).toBe(false); // edge-b-c not in set
      expect(result[2].data?.highlighted).toBe(false); // edge-c-d not in set
    });
  });

  describe('flowNodeToGraphNode', () => {
    it('should extract GraphNode from FlowNode', () => {
      const flowNode = createMockFlowNode();
      flowNode.data.id = 'test-id';
      flowNode.data.name = 'Test Name';
      flowNode.data.type = 'helm_chart';

      const result = flowNodeToGraphNode(flowNode);

      expect(result.id).toBe('test-id');
      expect(result.name).toBe('Test Name');
      expect(result.type).toBe('helm_chart');
      expect(result.location).toEqual(flowNode.data.location);
      expect(result.metadata).toEqual(flowNode.data.metadata);
    });
  });

  describe('flowNodesToGraphNodes', () => {
    it('should convert multiple flow nodes', () => {
      const flowNodes = [createMockFlowNode(), createMockFlowNode()];

      const result = flowNodesToGraphNodes(flowNodes);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(flowNodes[0].data.id);
    });
  });

  describe('flowEdgeToGraphEdge', () => {
    it('should extract GraphEdge from FlowEdge', () => {
      const flowEdge = createMockFlowEdge();
      flowEdge.id = 'edge-test';
      flowEdge.source = 'src';
      flowEdge.target = 'tgt';
      flowEdge.data = { type: 'CONTAINS', confidence: 0.8, highlighted: false };

      const result = flowEdgeToGraphEdge(flowEdge);

      expect(result.id).toBe('edge-test');
      expect(result.sourceNodeId).toBe('src');
      expect(result.targetNodeId).toBe('tgt');
      expect(result.type).toBe('CONTAINS');
      expect(result.confidence).toBe(0.8);
    });

    it('should use defaults when data is missing', () => {
      const flowEdge = {
        id: 'e',
        source: 's',
        target: 't',
        type: 'smoothstep' as const,
      } as FlowEdge;

      const result = flowEdgeToGraphEdge(flowEdge);

      expect(result.type).toBe('DEPENDS_ON'); // Default
      expect(result.confidence).toBe(1); // Default
    });
  });

  describe('createNodeMap', () => {
    it('should create map from node ID to FlowNode', () => {
      const nodes = [
        { ...createMockFlowNode(), id: 'alpha' },
        { ...createMockFlowNode(), id: 'beta' },
      ];

      const map = createNodeMap(nodes);

      expect(map.size).toBe(2);
      expect(map.get('alpha')?.id).toBe('alpha');
      expect(map.get('beta')?.id).toBe('beta');
      expect(map.get('gamma')).toBeUndefined();
    });
  });

  describe('createEdgeMap', () => {
    it('should create map from source->target to FlowEdge', () => {
      const edges = [
        { ...createMockFlowEdge(), id: 'e1', source: 'a', target: 'b' },
        { ...createMockFlowEdge(), id: 'e2', source: 'b', target: 'c' },
      ];

      const map = createEdgeMap(edges);

      expect(map.size).toBe(2);
      expect(map.get('a->b')?.id).toBe('e1');
      expect(map.get('b->c')?.id).toBe('e2');
    });
  });

  describe('getConnectedEdges', () => {
    it('should return incoming and outgoing edges', () => {
      const edges = [
        { ...createMockFlowEdge(), source: 'a', target: 'center' },
        { ...createMockFlowEdge(), source: 'b', target: 'center' },
        { ...createMockFlowEdge(), source: 'center', target: 'c' },
        { ...createMockFlowEdge(), source: 'center', target: 'd' },
        { ...createMockFlowEdge(), source: 'x', target: 'y' }, // Unrelated
      ];

      const result = getConnectedEdges('center', edges);

      expect(result.incoming).toHaveLength(2);
      expect(result.outgoing).toHaveLength(2);
      expect(result.incoming.every((e) => e.target === 'center')).toBe(true);
      expect(result.outgoing.every((e) => e.source === 'center')).toBe(true);
    });

    it('should return empty arrays for isolated node', () => {
      const edges = [
        { ...createMockFlowEdge(), source: 'a', target: 'b' },
      ];

      const result = getConnectedEdges('isolated', edges);

      expect(result.incoming).toHaveLength(0);
      expect(result.outgoing).toHaveLength(0);
    });
  });
});
