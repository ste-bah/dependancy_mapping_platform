/**
 * Layout Algorithm Tests
 * Tests for dagre-based graph layout calculation
 * @module features/graph/__tests__/utils/layout.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateLayout,
  calculateGraphBounds,
  getOptimalDirection,
  relayoutSubgraph,
  hasCycles,
} from '../../utils/layout';
import {
  createMockNode,
  createMockNodes,
  createMockEdge,
  createMockEdgeChain,
  createMockFlowNodes,
  resetIdCounters,
  assertValidPositions,
} from './testUtils';
import type { GraphNode, GraphEdge } from '../../types';

describe('layout', () => {
  beforeEach(() => {
    resetIdCounters();
  });

  describe('calculateLayout', () => {
    it('should return empty result for empty graph', () => {
      const result = calculateLayout([], []);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('should calculate positions for single node', () => {
      const nodes = [createMockNode({ id: 'node-1' })];
      const edges: GraphEdge[] = [];

      const result = calculateLayout(nodes, edges);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('node-1');
      expect(result.nodes[0].position).toBeDefined();
      expect(typeof result.nodes[0].position.x).toBe('number');
      expect(typeof result.nodes[0].position.y).toBe('number');
    });

    it('should position nodes hierarchically with default TB direction', () => {
      const nodes = [
        createMockNode({ id: 'parent', name: 'Parent' }),
        createMockNode({ id: 'child', name: 'Child' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'parent', targetNodeId: 'child' }),
      ];

      const result = calculateLayout(nodes, edges);

      expect(result.nodes).toHaveLength(2);
      const parentNode = result.nodes.find((n) => n.id === 'parent');
      const childNode = result.nodes.find((n) => n.id === 'child');

      // In TB direction, parent should be above child (smaller y)
      expect(parentNode!.position.y).toBeLessThan(childNode!.position.y);
    });

    it('should position nodes with LR direction', () => {
      const nodes = [
        createMockNode({ id: 'left', name: 'Left' }),
        createMockNode({ id: 'right', name: 'Right' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'left', targetNodeId: 'right' }),
      ];

      const result = calculateLayout(nodes, edges, { direction: 'LR' });

      const leftNode = result.nodes.find((n) => n.id === 'left');
      const rightNode = result.nodes.find((n) => n.id === 'right');

      // In LR direction, left should have smaller x
      expect(leftNode!.position.x).toBeLessThan(rightNode!.position.x);
    });

    it('should apply custom spacing options', () => {
      const nodes = createMockNodes(3);
      const edges = createMockEdgeChain(nodes.map((n) => n.id));

      const defaultResult = calculateLayout(nodes, edges);
      const spacedResult = calculateLayout(nodes, edges, {
        horizontalSpacing: 200,
        verticalSpacing: 200,
      });

      // Spaced layout should have larger dimensions
      expect(spacedResult.height).toBeGreaterThanOrEqual(defaultResult.height);
    });

    it('should filter out edges with missing nodes', () => {
      const nodes = [createMockNode({ id: 'node-1' })];
      const edges = [
        createMockEdge({
          sourceNodeId: 'node-1',
          targetNodeId: 'missing-node', // This node doesn't exist
        }),
      ];

      const result = calculateLayout(nodes, edges);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0); // Edge should be filtered out
    });

    it('should transform nodes to FlowNode format', () => {
      const nodes = [
        createMockNode({
          id: 'test-node',
          name: 'Test',
          type: 'helm_chart',
          location: { filePath: '/test.yaml', startLine: 1, endLine: 10 },
        }),
      ];

      const result = calculateLayout(nodes, []);

      expect(result.nodes[0].type).toBe('customNode');
      expect(result.nodes[0].data.id).toBe('test-node');
      expect(result.nodes[0].data.name).toBe('Test');
      expect(result.nodes[0].data.type).toBe('helm_chart');
      expect(result.nodes[0].data.location).toBeDefined();
      expect(result.nodes[0].data.selected).toBe(false);
      expect(result.nodes[0].data.highlighted).toBe(false);
      expect(result.nodes[0].data.dimmed).toBe(false);
    });

    it('should transform edges to FlowEdge format', () => {
      const nodes = [
        createMockNode({ id: 'source' }),
        createMockNode({ id: 'target' }),
      ];
      const edges = [
        createMockEdge({
          id: 'edge-1',
          sourceNodeId: 'source',
          targetNodeId: 'target',
          type: 'DEPENDS_ON',
          confidence: 0.9,
        }),
      ];

      const result = calculateLayout(nodes, edges);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('source');
      expect(result.edges[0].target).toBe('target');
      expect(result.edges[0].type).toBe('smoothstep');
      expect(result.edges[0].animated).toBe(true); // DEPENDS_ON edges are animated
      expect(result.edges[0].data?.type).toBe('DEPENDS_ON');
      expect(result.edges[0].data?.confidence).toBe(0.9);
    });

    it('should handle complex graph with multiple paths', () => {
      const nodes = [
        createMockNode({ id: 'root' }),
        createMockNode({ id: 'child1' }),
        createMockNode({ id: 'child2' }),
        createMockNode({ id: 'grandchild' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'root', targetNodeId: 'child1' }),
        createMockEdge({ sourceNodeId: 'root', targetNodeId: 'child2' }),
        createMockEdge({ sourceNodeId: 'child1', targetNodeId: 'grandchild' }),
        createMockEdge({ sourceNodeId: 'child2', targetNodeId: 'grandchild' }),
      ];

      const result = calculateLayout(nodes, edges);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(4);
      assertValidPositions(result.nodes);
    });

    it('should handle disconnected subgraphs', () => {
      const nodes = [
        createMockNode({ id: 'subgraph1-a' }),
        createMockNode({ id: 'subgraph1-b' }),
        createMockNode({ id: 'subgraph2-a' }),
        createMockNode({ id: 'subgraph2-b' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'subgraph1-a', targetNodeId: 'subgraph1-b' }),
        createMockEdge({ sourceNodeId: 'subgraph2-a', targetNodeId: 'subgraph2-b' }),
      ];

      const result = calculateLayout(nodes, edges);

      expect(result.nodes).toHaveLength(4);
      assertValidPositions(result.nodes);
    });
  });

  describe('calculateGraphBounds', () => {
    it('should return zero bounds for empty nodes', () => {
      const bounds = calculateGraphBounds([]);

      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(0);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxY).toBe(0);
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    });

    it('should calculate correct bounds for positioned nodes', () => {
      const nodes = [
        { ...createMockFlowNodes([createMockNode()])[0], position: { x: 100, y: 50 } },
        { ...createMockFlowNodes([createMockNode()])[0], position: { x: 300, y: 200 } },
      ];

      const bounds = calculateGraphBounds(nodes);

      expect(bounds.minX).toBe(100);
      expect(bounds.minY).toBe(50);
      // maxX/maxY include node dimensions (200x80 default)
      expect(bounds.maxX).toBe(500); // 300 + 200
      expect(bounds.maxY).toBe(280); // 200 + 80
      expect(bounds.width).toBe(400);
      expect(bounds.height).toBe(230);
    });

    it('should apply padding correctly', () => {
      const nodes = [
        { ...createMockFlowNodes([createMockNode()])[0], position: { x: 100, y: 100 } },
      ];

      const boundsNoPadding = calculateGraphBounds(nodes, 0);
      const boundsWithPadding = calculateGraphBounds(nodes, 50);

      expect(boundsWithPadding.minX).toBe(boundsNoPadding.minX - 50);
      expect(boundsWithPadding.minY).toBe(boundsNoPadding.minY - 50);
      expect(boundsWithPadding.maxX).toBe(boundsNoPadding.maxX + 50);
      expect(boundsWithPadding.maxY).toBe(boundsNoPadding.maxY + 50);
      expect(boundsWithPadding.width).toBe(boundsNoPadding.width + 100);
      expect(boundsWithPadding.height).toBe(boundsNoPadding.height + 100);
    });
  });

  describe('getOptimalDirection', () => {
    it('should return TB for empty graph', () => {
      const direction = getOptimalDirection([], []);
      expect(direction).toBe('TB');
    });

    it('should return TB for hierarchical graph (more leaves than roots)', () => {
      // Tree structure: 1 root -> 3 leaves
      const nodes = [
        createMockNode({ id: 'root' }),
        createMockNode({ id: 'leaf1' }),
        createMockNode({ id: 'leaf2' }),
        createMockNode({ id: 'leaf3' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'root', targetNodeId: 'leaf1' }),
        createMockEdge({ sourceNodeId: 'root', targetNodeId: 'leaf2' }),
        createMockEdge({ sourceNodeId: 'root', targetNodeId: 'leaf3' }),
      ];

      const direction = getOptimalDirection(nodes, edges);
      expect(direction).toBe('TB');
    });

    it('should return LR for dependency flow graph (more roots than leaves)', () => {
      // Multiple independent chains converging
      const nodes = [
        createMockNode({ id: 'source1' }),
        createMockNode({ id: 'source2' }),
        createMockNode({ id: 'source3' }),
        createMockNode({ id: 'target' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'source1', targetNodeId: 'target' }),
        createMockEdge({ sourceNodeId: 'source2', targetNodeId: 'target' }),
        createMockEdge({ sourceNodeId: 'source3', targetNodeId: 'target' }),
      ];

      const direction = getOptimalDirection(nodes, edges);
      expect(direction).toBe('LR');
    });

    it('should handle isolated nodes', () => {
      const nodes = createMockNodes(5);
      const edges: GraphEdge[] = []; // No edges

      const direction = getOptimalDirection(nodes, edges);
      expect(direction).toBe('TB'); // Default for balanced or no structure
    });
  });

  describe('relayoutSubgraph', () => {
    it('should return original nodes when no nodes to layout', () => {
      const nodes = createMockFlowNodes(createMockNodes(3));
      const edges = [createMockEdge({ sourceNodeId: nodes[0].id, targetNodeId: nodes[1].id })].map(
        (e) => ({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          type: 'smoothstep' as const,
          animated: false,
          data: { type: e.type, confidence: e.confidence, highlighted: false },
        })
      );

      const result = relayoutSubgraph(nodes, edges, new Set());

      expect(result).toEqual(nodes);
    });

    it('should relayout only specified nodes', () => {
      const graphNodes = createMockNodes(4);
      const nodes = createMockFlowNodes(graphNodes);
      // Set specific positions
      nodes[0].position = { x: 0, y: 0 };
      nodes[1].position = { x: 100, y: 100 };
      nodes[2].position = { x: 200, y: 0 };
      nodes[3].position = { x: 300, y: 100 };

      const edges = [
        { id: 'e1', source: nodes[2].id, target: nodes[3].id, type: 'smoothstep' as const, animated: false, data: { type: 'DEPENDS_ON' as const, confidence: 1, highlighted: false } },
      ];

      const nodesToLayout = new Set([nodes[2].id, nodes[3].id]);
      const result = relayoutSubgraph(nodes, edges, nodesToLayout);

      // Fixed nodes should retain positions
      const fixedNode0 = result.find((n) => n.id === nodes[0].id);
      const fixedNode1 = result.find((n) => n.id === nodes[1].id);
      expect(fixedNode0?.position).toEqual({ x: 0, y: 0 });
      expect(fixedNode1?.position).toEqual({ x: 100, y: 100 });

      // Layouted nodes may have new positions
      expect(result).toHaveLength(4);
    });
  });

  describe('hasCycles', () => {
    it('should return false for empty graph', () => {
      expect(hasCycles([], [])).toBe(false);
    });

    it('should return false for acyclic graph', () => {
      const nodes = [
        createMockNode({ id: 'a' }),
        createMockNode({ id: 'b' }),
        createMockNode({ id: 'c' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'a', targetNodeId: 'b' }),
        createMockEdge({ sourceNodeId: 'b', targetNodeId: 'c' }),
      ];

      expect(hasCycles(nodes, edges)).toBe(false);
    });

    it('should return true for simple cycle', () => {
      const nodes = [
        createMockNode({ id: 'a' }),
        createMockNode({ id: 'b' }),
        createMockNode({ id: 'c' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'a', targetNodeId: 'b' }),
        createMockEdge({ sourceNodeId: 'b', targetNodeId: 'c' }),
        createMockEdge({ sourceNodeId: 'c', targetNodeId: 'a' }), // Creates cycle
      ];

      expect(hasCycles(nodes, edges)).toBe(true);
    });

    it('should return true for self-loop', () => {
      const nodes = [createMockNode({ id: 'a' })];
      const edges = [
        createMockEdge({ sourceNodeId: 'a', targetNodeId: 'a' }),
      ];

      expect(hasCycles(nodes, edges)).toBe(true);
    });

    it('should detect cycle in larger graph', () => {
      const nodes = [
        createMockNode({ id: '1' }),
        createMockNode({ id: '2' }),
        createMockNode({ id: '3' }),
        createMockNode({ id: '4' }),
        createMockNode({ id: '5' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: '1', targetNodeId: '2' }),
        createMockEdge({ sourceNodeId: '2', targetNodeId: '3' }),
        createMockEdge({ sourceNodeId: '3', targetNodeId: '4' }),
        createMockEdge({ sourceNodeId: '4', targetNodeId: '2' }), // Cycle: 2 -> 3 -> 4 -> 2
        createMockEdge({ sourceNodeId: '4', targetNodeId: '5' }),
      ];

      expect(hasCycles(nodes, edges)).toBe(true);
    });

    it('should ignore edges with non-existent nodes', () => {
      const nodes = [
        createMockNode({ id: 'a' }),
        createMockNode({ id: 'b' }),
      ];
      const edges = [
        createMockEdge({ sourceNodeId: 'a', targetNodeId: 'b' }),
        createMockEdge({ sourceNodeId: 'b', targetNodeId: 'nonexistent' }),
      ];

      expect(hasCycles(nodes, edges)).toBe(false);
    });
  });
});
