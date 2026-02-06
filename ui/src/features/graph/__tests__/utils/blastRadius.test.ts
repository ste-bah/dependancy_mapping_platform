/**
 * Blast Radius Tests
 * Tests for blast radius calculation and utilities
 * @module features/graph/__tests__/utils/blastRadius.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAffectedNodeIds,
  getAffectedByType,
  getAffectedByDepth,
  getImpactLevel,
  getImpactSeverityFromScore,
  getImpactColor,
  getImpactColorFromScore,
  sortByImpact,
  sortFlowNodesByImpact,
  calculateClientBlastRadius,
  clientBlastRadiusToResponse,
  isNodeAffected,
  isDirectlyAffected,
  getBlastRadiusSummary,
  getAffectedEdgeIds,
} from '../../utils/blastRadius';
import {
  createMockNode,
  createMockNodes,
  createMockFlowNode,
  createMockFlowEdge,
  createMockFlowNodes,
  createMockBlastRadius,
  createMockAffectedNode,
  resetIdCounters,
} from './testUtils';
import { IMPACT_COLORS } from '../../utils/constants';
import type { BlastRadiusResponse, FlowEdge } from '../../types';

describe('blastRadius', () => {
  beforeEach(() => {
    resetIdCounters();
  });

  describe('getAffectedNodeIds', () => {
    it('should return empty set for null/undefined', () => {
      expect(getAffectedNodeIds(null as any)).toEqual(new Set());
      expect(getAffectedNodeIds(undefined as any)).toEqual(new Set());
    });

    it('should return empty set when no affected nodes', () => {
      const blastRadius = createMockBlastRadius({ affectedNodes: [] });

      const ids = getAffectedNodeIds(blastRadius);

      expect(ids.size).toBe(0);
    });

    it('should return set of all affected node IDs', () => {
      const blastRadius = createMockBlastRadius({
        affectedNodes: [
          createMockAffectedNode({ id: 'node-1' }),
          createMockAffectedNode({ id: 'node-2' }),
          createMockAffectedNode({ id: 'node-3' }),
        ],
      });

      const ids = getAffectedNodeIds(blastRadius);

      expect(ids.size).toBe(3);
      expect(ids.has('node-1')).toBe(true);
      expect(ids.has('node-2')).toBe(true);
      expect(ids.has('node-3')).toBe(true);
    });
  });

  describe('getAffectedByType', () => {
    it('should separate direct and transitive affected nodes', () => {
      const blastRadius = createMockBlastRadius({
        affectedNodes: [
          createMockAffectedNode({ id: 'direct-1', isDirect: true }),
          createMockAffectedNode({ id: 'direct-2', isDirect: true }),
          createMockAffectedNode({ id: 'transitive-1', isDirect: false }),
        ],
      });

      const { direct, transitive } = getAffectedByType(blastRadius);

      expect(direct).toHaveLength(2);
      expect(transitive).toHaveLength(1);
      expect(direct.every((n) => n.isDirect)).toBe(true);
      expect(transitive.every((n) => !n.isDirect)).toBe(true);
    });

    it('should return empty arrays for null/undefined', () => {
      const { direct, transitive } = getAffectedByType(null as any);

      expect(direct).toEqual([]);
      expect(transitive).toEqual([]);
    });
  });

  describe('getAffectedByDepth', () => {
    it('should group affected nodes by depth level', () => {
      const blastRadius = createMockBlastRadius({
        affectedNodes: [
          createMockAffectedNode({ id: 'depth1-a', depth: 1 }),
          createMockAffectedNode({ id: 'depth1-b', depth: 1 }),
          createMockAffectedNode({ id: 'depth2', depth: 2 }),
          createMockAffectedNode({ id: 'depth3', depth: 3 }),
        ],
      });

      const byDepth = getAffectedByDepth(blastRadius);

      expect(byDepth.get(1)).toHaveLength(2);
      expect(byDepth.get(2)).toHaveLength(1);
      expect(byDepth.get(3)).toHaveLength(1);
    });

    it('should return empty map for no affected nodes', () => {
      const byDepth = getAffectedByDepth(createMockBlastRadius({ affectedNodes: [] }));

      expect(byDepth.size).toBe(0);
    });
  });

  describe('getImpactLevel', () => {
    it('should return -1 when node is not affected', () => {
      const blastRadius = createMockBlastRadius({
        affectedNodes: [createMockAffectedNode({ id: 'other' })],
      });

      expect(getImpactLevel('not-affected', blastRadius)).toBe(-1);
    });

    it('should return depth level of affected node', () => {
      const blastRadius = createMockBlastRadius({
        affectedNodes: [
          createMockAffectedNode({ id: 'node-1', depth: 1 }),
          createMockAffectedNode({ id: 'node-2', depth: 3 }),
        ],
      });

      expect(getImpactLevel('node-1', blastRadius)).toBe(1);
      expect(getImpactLevel('node-2', blastRadius)).toBe(3);
    });

    it('should return -1 for null/undefined blast radius', () => {
      expect(getImpactLevel('node', null as any)).toBe(-1);
      expect(getImpactLevel('node', undefined as any)).toBe(-1);
    });
  });

  describe('getImpactSeverityFromScore', () => {
    it('should return critical for scores >= 0.8', () => {
      expect(getImpactSeverityFromScore(0.8)).toBe('critical');
      expect(getImpactSeverityFromScore(0.95)).toBe('critical');
      expect(getImpactSeverityFromScore(1.0)).toBe('critical');
    });

    it('should return high for scores >= 0.6', () => {
      expect(getImpactSeverityFromScore(0.6)).toBe('high');
      expect(getImpactSeverityFromScore(0.79)).toBe('high');
    });

    it('should return medium for scores >= 0.4', () => {
      expect(getImpactSeverityFromScore(0.4)).toBe('medium');
      expect(getImpactSeverityFromScore(0.59)).toBe('medium');
    });

    it('should return low for scores >= 0.2', () => {
      expect(getImpactSeverityFromScore(0.2)).toBe('low');
      expect(getImpactSeverityFromScore(0.39)).toBe('low');
    });

    it('should return minimal for scores < 0.2', () => {
      expect(getImpactSeverityFromScore(0.1)).toBe('minimal');
      expect(getImpactSeverityFromScore(0)).toBe('minimal');
    });
  });

  describe('getImpactColor', () => {
    it('should return correct color for each severity', () => {
      expect(getImpactColor('critical')).toBe(IMPACT_COLORS.critical);
      expect(getImpactColor('high')).toBe(IMPACT_COLORS.high);
      expect(getImpactColor('medium')).toBe(IMPACT_COLORS.medium);
      expect(getImpactColor('low')).toBe(IMPACT_COLORS.low);
      expect(getImpactColor('minimal')).toBe(IMPACT_COLORS.minimal);
    });
  });

  describe('getImpactColorFromScore', () => {
    it('should return color based on score severity', () => {
      expect(getImpactColorFromScore(0.9)).toBe(IMPACT_COLORS.critical);
      expect(getImpactColorFromScore(0.5)).toBe(IMPACT_COLORS.medium);
      expect(getImpactColorFromScore(0.1)).toBe(IMPACT_COLORS.minimal);
    });
  });

  describe('sortByImpact', () => {
    it('should sort nodes by impact depth (lowest first)', () => {
      const nodes = [
        createMockNode({ id: 'depth3' }),
        createMockNode({ id: 'depth1' }),
        createMockNode({ id: 'depth2' }),
        createMockNode({ id: 'unaffected' }),
      ];
      const blastRadius = createMockBlastRadius({
        affectedNodes: [
          createMockAffectedNode({ id: 'depth1', depth: 1 }),
          createMockAffectedNode({ id: 'depth2', depth: 2 }),
          createMockAffectedNode({ id: 'depth3', depth: 3 }),
        ],
      });

      const sorted = sortByImpact(nodes, blastRadius);

      expect(sorted[0].id).toBe('depth1');
      expect(sorted[1].id).toBe('depth2');
      expect(sorted[2].id).toBe('depth3');
      expect(sorted[3].id).toBe('unaffected');
    });

    it('should not mutate original array', () => {
      const nodes = [createMockNode({ id: 'a' }), createMockNode({ id: 'b' })];
      const blastRadius = createMockBlastRadius({
        affectedNodes: [createMockAffectedNode({ id: 'b', depth: 1 })],
      });

      const sorted = sortByImpact(nodes, blastRadius);

      expect(nodes[0].id).toBe('a');
      expect(sorted[0].id).toBe('b');
    });
  });

  describe('sortFlowNodesByImpact', () => {
    it('should sort FlowNodes by impact', () => {
      const graphNodes = createMockNodes(3);
      graphNodes[0].id = 'depth2';
      graphNodes[1].id = 'depth1';
      graphNodes[2].id = 'unaffected';
      const flowNodes = createMockFlowNodes(graphNodes);
      const blastRadius = createMockBlastRadius({
        affectedNodes: [
          createMockAffectedNode({ id: 'depth1', depth: 1 }),
          createMockAffectedNode({ id: 'depth2', depth: 2 }),
        ],
      });

      const sorted = sortFlowNodesByImpact(flowNodes, blastRadius);

      expect(sorted[0].id).toBe('depth1');
      expect(sorted[1].id).toBe('depth2');
    });
  });

  describe('calculateClientBlastRadius', () => {
    it('should calculate blast radius from edge connections', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'center', target: 'direct1' },
        { ...createMockFlowEdge(), source: 'center', target: 'direct2' },
        { ...createMockFlowEdge(), source: 'direct1', target: 'transitive1' },
      ];

      const result = calculateClientBlastRadius('center', edges, 4);

      expect(result.nodeId).toBe('center');
      expect(result.directDependents).toBe(2);
      expect(result.transitiveDependents).toBe(1);
      expect(result.affectedNodeIds.has('direct1')).toBe(true);
      expect(result.affectedNodeIds.has('direct2')).toBe(true);
      expect(result.affectedNodeIds.has('transitive1')).toBe(true);
      expect(result.affectedNodeIds.has('center')).toBe(false); // Not in affected set
    });

    it('should respect maxDepth', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'a', target: 'b' },
        { ...createMockFlowEdge(), source: 'b', target: 'c' },
        { ...createMockFlowEdge(), source: 'c', target: 'd' },
      ];

      const result = calculateClientBlastRadius('a', edges, 4, 1);

      expect(result.affectedNodeIds.has('b')).toBe(true);
      expect(result.affectedNodeIds.has('c')).toBe(false);
    });

    it('should calculate impact score correctly', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'center', target: 'a' },
        { ...createMockFlowEdge(), source: 'center', target: 'b' },
      ];

      const result = calculateClientBlastRadius('center', edges, 5);

      // 2 affected out of 4 other nodes = 0.5
      expect(result.impactScore).toBe(0.5);
    });

    it('should group affected by depth', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'a', target: 'b' },
        { ...createMockFlowEdge(), source: 'b', target: 'c' },
      ];

      const result = calculateClientBlastRadius('a', edges, 3);

      expect(result.affectedByDepth.get(1)).toContain('b');
      expect(result.affectedByDepth.get(2)).toContain('c');
    });

    it('should determine severity from impact score', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), source: 'a', target: 'b' },
      ];

      const lowResult = calculateClientBlastRadius('a', edges, 10);
      expect(lowResult.severity).toBe('minimal'); // 1/9 = ~0.11
    });
  });

  describe('clientBlastRadiusToResponse', () => {
    it('should convert client result to API response format', () => {
      const clientResult = {
        nodeId: 'center',
        directDependents: 2,
        transitiveDependents: 1,
        impactScore: 0.5,
        severity: 'medium' as const,
        affectedNodeIds: new Set(['a', 'b', 'c']),
        affectedByDepth: new Map([
          [1, ['a', 'b']],
          [2, ['c']],
        ]),
      };
      const nodeMap = new Map([
        ['a', createMockNode({ id: 'a', name: 'Node A', type: 'terraform_resource' })],
        ['b', createMockNode({ id: 'b', name: 'Node B', type: 'helm_chart' })],
        ['c', createMockNode({ id: 'c', name: 'Node C', type: 'k8s_resource' })],
      ]);

      const response = clientBlastRadiusToResponse(clientResult, nodeMap);

      expect(response.nodeId).toBe('center');
      expect(response.directDependents).toBe(2);
      expect(response.transitiveDependents).toBe(1);
      expect(response.impactScore).toBe(0.5);
      expect(response.severity).toBe('medium');
      expect(response.affectedNodes).toHaveLength(3);

      const nodeA = response.affectedNodes.find((n) => n.id === 'a');
      expect(nodeA?.isDirect).toBe(true);
      expect(nodeA?.depth).toBe(1);

      const nodeC = response.affectedNodes.find((n) => n.id === 'c');
      expect(nodeC?.isDirect).toBe(false);
      expect(nodeC?.depth).toBe(2);
    });
  });

  describe('isNodeAffected', () => {
    it('should return false for null blast radius', () => {
      expect(isNodeAffected('node', null)).toBe(false);
    });

    it('should return true if node is in affected list', () => {
      const blastRadius = createMockBlastRadius({
        affectedNodes: [createMockAffectedNode({ id: 'affected-node' })],
      });

      expect(isNodeAffected('affected-node', blastRadius)).toBe(true);
      expect(isNodeAffected('other-node', blastRadius)).toBe(false);
    });
  });

  describe('isDirectlyAffected', () => {
    it('should return false for null blast radius', () => {
      expect(isDirectlyAffected('node', null)).toBe(false);
    });

    it('should return true only for direct dependents', () => {
      const blastRadius = createMockBlastRadius({
        affectedNodes: [
          createMockAffectedNode({ id: 'direct', isDirect: true }),
          createMockAffectedNode({ id: 'transitive', isDirect: false }),
        ],
      });

      expect(isDirectlyAffected('direct', blastRadius)).toBe(true);
      expect(isDirectlyAffected('transitive', blastRadius)).toBe(false);
    });
  });

  describe('getBlastRadiusSummary', () => {
    it('should calculate summary statistics', () => {
      const blastRadius = createMockBlastRadius({
        directDependents: 3,
        transitiveDependents: 7,
        impactScore: 0.65,
        severity: 'high',
        affectedNodes: [
          createMockAffectedNode({ depth: 1 }),
          createMockAffectedNode({ depth: 1 }),
          createMockAffectedNode({ depth: 1 }),
          createMockAffectedNode({ depth: 2 }),
          createMockAffectedNode({ depth: 2 }),
          createMockAffectedNode({ depth: 3 }),
        ],
      });

      const summary = getBlastRadiusSummary(blastRadius);

      expect(summary.totalAffected).toBe(10);
      expect(summary.directPercent).toBe(30);
      expect(summary.transitivePercent).toBe(70);
      expect(summary.maxDepth).toBe(3);
      expect(summary.severity).toBe('high');
      expect(summary.color).toBe(IMPACT_COLORS.high);
    });

    it('should handle zero affected nodes', () => {
      const blastRadius = createMockBlastRadius({
        directDependents: 0,
        transitiveDependents: 0,
        affectedNodes: [],
      });

      const summary = getBlastRadiusSummary(blastRadius);

      expect(summary.totalAffected).toBe(0);
      expect(summary.directPercent).toBe(0);
      expect(summary.maxDepth).toBe(0);
    });
  });

  describe('getAffectedEdgeIds', () => {
    it('should return edges where both endpoints are affected', () => {
      const edges: FlowEdge[] = [
        { ...createMockFlowEdge(), id: 'e1', source: 'a', target: 'b' },
        { ...createMockFlowEdge(), id: 'e2', source: 'b', target: 'c' },
        { ...createMockFlowEdge(), id: 'e3', source: 'c', target: 'd' },
      ];
      const affectedIds = new Set(['a', 'b', 'c']);

      const edgeIds = getAffectedEdgeIds(edges, affectedIds);

      expect(edgeIds.has('e1')).toBe(true);
      expect(edgeIds.has('e2')).toBe(true);
      expect(edgeIds.has('e3')).toBe(false); // d is not affected
    });

    it('should return empty set for empty affected IDs', () => {
      const edges = [createMockFlowEdge()];

      const edgeIds = getAffectedEdgeIds(edges, new Set());

      expect(edgeIds.size).toBe(0);
    });
  });
});
