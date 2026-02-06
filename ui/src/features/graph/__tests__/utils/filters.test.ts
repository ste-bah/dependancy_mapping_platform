/**
 * Filter Logic Tests
 * Tests for graph filtering and highlighting functions
 * @module features/graph/__tests__/utils/filters.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  filterNodes,
  filterNodesByType,
  filterNodesBySearch,
  filterEdges,
  filterEdgesByType,
  filterEdgesByConfidence,
  filterEdgesExtended,
  getConnectedNodeIds,
  filterConnectedNodes,
  applyHighlighting,
  applyEdgeHighlighting,
  clearHighlighting,
  clearEdgeHighlighting,
  applyFiltersAndHighlighting,
} from '../../utils/filters';
import {
  createMockNode,
  createMockFlowNode,
  createMockFlowEdge,
  createMockBlastRadius,
  createMockExtendedFilters,
  resetIdCounters,
} from './testUtils';
import type { FlowNode, FlowEdge, ExtendedGraphFilters } from '../../types';

describe('filters', () => {
  beforeEach(() => {
    resetIdCounters();
  });

  describe('filterNodes', () => {
    it('should return empty array for empty nodes', () => {
      const filters = createMockExtendedFilters();
      expect(filterNodes([], filters)).toEqual([]);
    });

    it('should filter by node type', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, type: 'terraform_resource' } },
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, type: 'helm_chart' } },
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, type: 'k8s_resource' } },
      ];
      const filters = createMockExtendedFilters({
        nodeTypes: ['terraform_resource', 'k8s_resource'],
      });

      const result = filterNodes(nodes, filters);

      expect(result).toHaveLength(2);
      expect(result.every((n) => ['terraform_resource', 'k8s_resource'].includes(n.data.type))).toBe(true);
    });

    it('should return all nodes when nodeTypes is empty', () => {
      const nodes = [createMockFlowNode(), createMockFlowNode()];
      const filters = createMockExtendedFilters({ nodeTypes: [] });

      const result = filterNodes(nodes, filters);

      expect(result).toHaveLength(2);
    });

    it('should filter by search query - name match', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'n1', data: { ...createMockFlowNode().data, name: 'database-main', id: 'n1' } },
        { ...createMockFlowNode(), id: 'n2', data: { ...createMockFlowNode().data, name: 'api-gateway', id: 'n2' } },
        { ...createMockFlowNode(), id: 'n3', data: { ...createMockFlowNode().data, name: 'database-replica', id: 'n3' } },
      ];
      const filters = createMockExtendedFilters({ search: 'database' });

      const result = filterNodes(nodes, filters);

      expect(result).toHaveLength(2);
      expect(result.every((n) => n.data.name.includes('database'))).toBe(true);
    });

    it('should filter by search query - id match', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'aws-s3-bucket', data: { ...createMockFlowNode().data, id: 'aws-s3-bucket', name: 'Storage' } },
        { ...createMockFlowNode(), id: 'aws-rds-instance', data: { ...createMockFlowNode().data, id: 'aws-rds-instance', name: 'Database' } },
      ];
      const filters = createMockExtendedFilters({ search: 's3' });

      const result = filterNodes(nodes, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('aws-s3-bucket');
    });

    it('should filter by search query - path match', () => {
      const nodes: FlowNode[] = [
        {
          ...createMockFlowNode(),
          id: 'n1',
          data: {
            ...createMockFlowNode().data,
            id: 'n1',
            name: 'Resource',
            location: { filePath: '/modules/networking/main.tf', startLine: 1, endLine: 10 },
          },
        },
        {
          ...createMockFlowNode(),
          id: 'n2',
          data: {
            ...createMockFlowNode().data,
            id: 'n2',
            name: 'Other',
            location: { filePath: '/modules/compute/main.tf', startLine: 1, endLine: 10 },
          },
        },
      ];
      const filters = createMockExtendedFilters({ search: 'networking' });

      const result = filterNodes(nodes, filters);

      expect(result).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, name: 'MyDatabase' } },
      ];
      const filters = createMockExtendedFilters({ search: 'mydatabase' });

      const result = filterNodes(nodes, filters);

      expect(result).toHaveLength(1);
    });

    it('should combine type and search filters', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'n1', data: { ...createMockFlowNode().data, id: 'n1', name: 'db-primary', type: 'terraform_resource' } },
        { ...createMockFlowNode(), id: 'n2', data: { ...createMockFlowNode().data, id: 'n2', name: 'db-chart', type: 'helm_chart' } },
        { ...createMockFlowNode(), id: 'n3', data: { ...createMockFlowNode().data, id: 'n3', name: 'api', type: 'terraform_resource' } },
      ];
      const filters = createMockExtendedFilters({
        nodeTypes: ['terraform_resource'],
        search: 'db',
      });

      const result = filterNodes(nodes, filters);

      expect(result).toHaveLength(1);
      expect(result[0].data.name).toBe('db-primary');
    });
  });

  describe('filterNodesByType', () => {
    it('should return all nodes when types array is empty', () => {
      const nodes = [createMockFlowNode(), createMockFlowNode()];

      const result = filterNodesByType(nodes, []);

      expect(result).toHaveLength(2);
    });

    it('should filter by multiple types', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, type: 'terraform_resource' } },
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, type: 'helm_chart' } },
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, type: 'k8s_resource' } },
      ];

      const result = filterNodesByType(nodes, ['terraform_resource', 'helm_chart']);

      expect(result).toHaveLength(2);
    });
  });

  describe('filterNodesBySearch', () => {
    it('should return all nodes for empty query', () => {
      const nodes = [createMockFlowNode(), createMockFlowNode()];

      expect(filterNodesBySearch(nodes, '')).toHaveLength(2);
      expect(filterNodesBySearch(nodes, '   ')).toHaveLength(2);
    });
  });

  describe('filterEdges', () => {
    it('should return empty array for empty edges', () => {
      expect(filterEdges([], new Set(['a', 'b']))).toEqual([]);
    });

    it('should return empty array when no visible nodes', () => {
      const edges = [createMockFlowEdge()];

      expect(filterEdges(edges, new Set())).toEqual([]);
    });

    it('should filter edges to only visible nodes', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'a', target: 'b' },
        { ...createMockFlowEdge(), source: 'b', target: 'c' },
        { ...createMockFlowEdge(), source: 'c', target: 'd' },
      ];
      const visibleNodes = new Set(['a', 'b']);

      const result = filterEdges(edges, visibleNodes);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('a');
      expect(result[0].target).toBe('b');
    });
  });

  describe('filterEdgesByType', () => {
    it('should return all edges when types is empty', () => {
      const edges = [
        { ...createMockFlowEdge(), data: { type: 'DEPENDS_ON' as const, confidence: 1, highlighted: false } },
        { ...createMockFlowEdge(), data: { type: 'REFERENCES' as const, confidence: 1, highlighted: false } },
      ];

      const result = filterEdgesByType(edges, []);

      expect(result).toHaveLength(2);
    });

    it('should filter by edge types', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), data: { type: 'DEPENDS_ON', confidence: 1, highlighted: false } },
        { ...createMockFlowEdge(), data: { type: 'REFERENCES', confidence: 1, highlighted: false } },
        { ...createMockFlowEdge(), data: { type: 'CONTAINS', confidence: 1, highlighted: false } },
      ];

      const result = filterEdgesByType(edges, ['DEPENDS_ON', 'CONTAINS']);

      expect(result).toHaveLength(2);
    });
  });

  describe('filterEdgesByConfidence', () => {
    it('should return all edges when minConfidence is 0', () => {
      const edges = [
        { ...createMockFlowEdge(), data: { type: 'DEPENDS_ON' as const, confidence: 0.5, highlighted: false } },
        { ...createMockFlowEdge(), data: { type: 'DEPENDS_ON' as const, confidence: 0.1, highlighted: false } },
      ];

      const result = filterEdgesByConfidence(edges, 0);

      expect(result).toHaveLength(2);
    });

    it('should filter edges below threshold', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), data: { type: 'DEPENDS_ON', confidence: 0.9, highlighted: false } },
        { ...createMockFlowEdge(), data: { type: 'DEPENDS_ON', confidence: 0.5, highlighted: false } },
        { ...createMockFlowEdge(), data: { type: 'DEPENDS_ON', confidence: 0.3, highlighted: false } },
      ];

      const result = filterEdgesByConfidence(edges, 0.6);

      expect(result).toHaveLength(1);
      expect(result[0].data?.confidence).toBe(0.9);
    });
  });

  describe('getConnectedNodeIds', () => {
    it('should return only start node when no edges', () => {
      const result = getConnectedNodeIds('start', [], 10);

      expect(result.size).toBe(1);
      expect(result.has('start')).toBe(true);
    });

    it('should find directly connected nodes', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'center', target: 'child1' },
        { ...createMockFlowEdge(), source: 'center', target: 'child2' },
        { ...createMockFlowEdge(), source: 'parent', target: 'center' },
      ];

      const result = getConnectedNodeIds('center', edges, 1);

      expect(result.has('center')).toBe(true);
      expect(result.has('child1')).toBe(true);
      expect(result.has('child2')).toBe(true);
      expect(result.has('parent')).toBe(true);
    });

    it('should respect max depth', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'a', target: 'b' },
        { ...createMockFlowEdge(), source: 'b', target: 'c' },
        { ...createMockFlowEdge(), source: 'c', target: 'd' },
      ];

      const depth1 = getConnectedNodeIds('a', edges, 1);
      const depth2 = getConnectedNodeIds('a', edges, 2);

      expect(depth1.has('b')).toBe(true);
      expect(depth1.has('c')).toBe(false);

      expect(depth2.has('b')).toBe(true);
      expect(depth2.has('c')).toBe(true);
      expect(depth2.has('d')).toBe(false);
    });

    it('should support direction filtering - outgoing only', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'center', target: 'out' },
        { ...createMockFlowEdge(), source: 'in', target: 'center' },
      ];

      const result = getConnectedNodeIds('center', edges, 1, 'outgoing');

      expect(result.has('out')).toBe(true);
      expect(result.has('in')).toBe(false);
    });

    it('should support direction filtering - incoming only', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'center', target: 'out' },
        { ...createMockFlowEdge(), source: 'in', target: 'center' },
      ];

      const result = getConnectedNodeIds('center', edges, 1, 'incoming');

      expect(result.has('in')).toBe(true);
      expect(result.has('out')).toBe(false);
    });
  });

  describe('filterConnectedNodes', () => {
    it('should filter to only connected nodes', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'center' },
        { ...createMockFlowNode(), id: 'connected' },
        { ...createMockFlowNode(), id: 'isolated' },
      ];
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'center', target: 'connected' },
      ];

      const result = filterConnectedNodes(nodes, edges, 'center', 1);

      expect(result).toHaveLength(2);
      expect(result.find((n) => n.id === 'center')).toBeDefined();
      expect(result.find((n) => n.id === 'connected')).toBeDefined();
      expect(result.find((n) => n.id === 'isolated')).toBeUndefined();
    });
  });

  describe('applyHighlighting', () => {
    it('should return empty array for empty nodes', () => {
      expect(applyHighlighting([], 'node-1', null)).toEqual([]);
    });

    it('should mark selected node', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'selected' },
        { ...createMockFlowNode(), id: 'other' },
      ];

      const result = applyHighlighting(nodes, 'selected', null);

      expect(result.find((n) => n.id === 'selected')?.data.selected).toBe(true);
      expect(result.find((n) => n.id === 'other')?.data.selected).toBe(false);
    });

    it('should highlight nodes in blast radius', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'source' },
        { ...createMockFlowNode(), id: 'affected1' },
        { ...createMockFlowNode(), id: 'affected2' },
        { ...createMockFlowNode(), id: 'unaffected' },
      ];
      const blastRadius = createMockBlastRadius({
        nodeId: 'source',
        affectedNodes: [
          { id: 'affected1', name: 'A1', type: 'terraform_resource', isDirect: true, depth: 1 },
          { id: 'affected2', name: 'A2', type: 'terraform_resource', isDirect: false, depth: 2 },
        ],
      });

      const result = applyHighlighting(nodes, 'source', blastRadius);

      expect(result.find((n) => n.id === 'source')?.data.highlighted).toBe(true);
      expect(result.find((n) => n.id === 'affected1')?.data.highlighted).toBe(true);
      expect(result.find((n) => n.id === 'affected2')?.data.highlighted).toBe(true);
      expect(result.find((n) => n.id === 'unaffected')?.data.highlighted).toBe(false);
    });

    it('should dim unaffected nodes when blast radius is active', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'source' },
        { ...createMockFlowNode(), id: 'affected' },
        { ...createMockFlowNode(), id: 'unaffected' },
      ];
      const blastRadius = createMockBlastRadius({
        nodeId: 'source',
        affectedNodes: [{ id: 'affected', name: 'A', type: 'terraform_resource', isDirect: true, depth: 1 }],
      });

      const result = applyHighlighting(nodes, 'source', blastRadius);

      expect(result.find((n) => n.id === 'unaffected')?.data.dimmed).toBe(true);
    });
  });

  describe('applyEdgeHighlighting', () => {
    it('should highlight edges between highlighted nodes', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), id: 'e1', source: 'a', target: 'b' },
        { ...createMockFlowEdge(), id: 'e2', source: 'b', target: 'c' },
      ];
      const highlightedNodes = new Set(['a', 'b']);

      const result = applyEdgeHighlighting(edges, highlightedNodes);

      expect(result.find((e) => e.id === 'e1')?.data?.highlighted).toBe(true);
      expect(result.find((e) => e.id === 'e2')?.data?.highlighted).toBe(false);
    });

    it('should reduce opacity of non-highlighted edges', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), id: 'e1', source: 'a', target: 'b' },
        { ...createMockFlowEdge(), id: 'e2', source: 'c', target: 'd' },
      ];
      const highlightedNodes = new Set(['a', 'b']);

      const result = applyEdgeHighlighting(edges, highlightedNodes);

      expect(result.find((e) => e.id === 'e1')?.style?.opacity).toBe(1);
      expect(result.find((e) => e.id === 'e2')?.style?.opacity).toBe(0.3);
    });
  });

  describe('clearHighlighting', () => {
    it('should clear all highlight states', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), data: { ...createMockFlowNode().data, selected: true, highlighted: true, dimmed: true } },
      ];

      const result = clearHighlighting(nodes);

      expect(result[0].data.selected).toBe(false);
      expect(result[0].data.highlighted).toBe(false);
      expect(result[0].data.dimmed).toBe(false);
    });
  });

  describe('clearEdgeHighlighting', () => {
    it('should clear edge highlight states and restore opacity', () => {
      const edges: FlowEdge[] = [
        {
          ...createMockFlowEdge(),
          data: { type: 'DEPENDS_ON', confidence: 1, highlighted: true },
          style: { opacity: 0.3 },
        },
      ];

      const result = clearEdgeHighlighting(edges);

      expect(result[0].data?.highlighted).toBe(false);
      expect(result[0].style?.opacity).toBe(1);
    });
  });

  describe('applyFiltersAndHighlighting', () => {
    it('should apply full filter and highlight pipeline', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'tf1', data: { ...createMockFlowNode().data, id: 'tf1', name: 'TF Resource 1', type: 'terraform_resource' } },
        { ...createMockFlowNode(), id: 'tf2', data: { ...createMockFlowNode().data, id: 'tf2', name: 'TF Resource 2', type: 'terraform_resource' } },
        { ...createMockFlowNode(), id: 'helm1', data: { ...createMockFlowNode().data, id: 'helm1', name: 'Helm Chart', type: 'helm_chart' } },
      ];
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'tf1', target: 'tf2', data: { type: 'DEPENDS_ON', confidence: 1, highlighted: false } },
        { ...createMockFlowEdge(), source: 'tf2', target: 'helm1', data: { type: 'DEPENDS_ON', confidence: 1, highlighted: false } },
      ];
      const filters = createMockExtendedFilters({
        nodeTypes: ['terraform_resource'],
      });

      const result = applyFiltersAndHighlighting(nodes, edges, filters, null, null);

      // Only terraform resources should remain
      expect(result.nodes).toHaveLength(2);
      // Only edge between terraform resources
      expect(result.edges).toHaveLength(1);
    });

    it('should filter to connected nodes when showConnectedOnly is true', () => {
      const nodes: FlowNode[] = [
        { ...createMockFlowNode(), id: 'center' },
        { ...createMockFlowNode(), id: 'connected' },
        { ...createMockFlowNode(), id: 'isolated' },
      ];
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'center', target: 'connected', data: { type: 'DEPENDS_ON', confidence: 1, highlighted: false } },
      ];
      const filters = createMockExtendedFilters({
        showConnectedOnly: true,
        maxDepth: 1,
      });

      const result = applyFiltersAndHighlighting(nodes, edges, filters, 'center', null);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.find((n) => n.id === 'isolated')).toBeUndefined();
    });
  });
});
