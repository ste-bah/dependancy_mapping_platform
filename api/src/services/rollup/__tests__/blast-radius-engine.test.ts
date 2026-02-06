/**
 * Blast Radius Engine Unit Tests
 * @module services/rollup/__tests__/blast-radius-engine.test
 *
 * Tests for BlastRadiusEngine implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BlastRadiusEngine, createBlastRadiusEngine, DECAY_FACTOR } from '../blast-radius-engine.js';
import type { BlastRadiusQuery, BlastRadiusResponse, RollupExecutionId, MergedNode } from '../../../types/rollup.js';
import type { GraphEdge, EdgeType } from '../../../types/graph.js';
import { createBlastRadiusGraph, createTerraformResourceNode, createEdgeBetweenNodes } from './fixtures/graph-fixtures.js';
import { createRepositoryId } from './fixtures/rollup-fixtures.js';
import { RollupBlastRadiusError } from '../errors.js';

describe('BlastRadiusEngine', () => {
  let engine: BlastRadiusEngine;
  const executionId = 'exec_test_123' as RollupExecutionId;

  beforeEach(() => {
    engine = new BlastRadiusEngine({ cacheTtlMs: 3600000 });
  });

  afterEach(() => {
    engine.clearCache();
    engine.clearGraphData(executionId);
  });

  describe('registerGraph', () => {
    it('should register graph data for execution', () => {
      const { nodes, edges } = createBlastRadiusGraph();
      const repoId = createRepositoryId();

      const mergedNodes: MergedNode[] = Array.from(nodes.values()).map((node) => ({
        id: node.id,
        sourceNodeIds: [node.id],
        sourceRepoIds: [repoId],
        type: node.type,
        name: node.name,
        locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
        metadata: {},
        matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
      }));

      const repositoryNames = new Map([[repoId, 'test-repo']]);

      // Should not throw
      expect(() => {
        engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);
      }).not.toThrow();
    });

    it('should build adjacency lists correctly', async () => {
      const repoId = createRepositoryId();
      const repositoryNames = new Map([[repoId, 'test-repo']]);

      const mergedNodes: MergedNode[] = [
        {
          id: 'node_a',
          sourceNodeIds: ['node_a'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource_a',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'node_b',
          sourceNodeIds: ['node_b'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource_b',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'edge_1',
          source: 'node_a',
          target: 'node_b',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      // Now analyze to verify graph was built correctly
      const query: BlastRadiusQuery = {
        nodeIds: ['node_a'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.directImpact).toHaveLength(1);
      expect(result.directImpact[0].nodeId).toBe('node_b');
    });
  });

  describe('analyze', () => {
    const repoId = createRepositoryId();
    const repositoryNames = new Map([[repoId, 'test-repo']]);

    beforeEach(() => {
      const { nodes, edges } = createBlastRadiusGraph();

      const mergedNodes: MergedNode[] = Array.from(nodes.values()).map((node) => ({
        id: node.id,
        sourceNodeIds: [node.id],
        sourceRepoIds: [repoId],
        type: node.type,
        name: node.name,
        locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
        metadata: {},
        matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
      }));

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);
    });

    it('should find direct impacts', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 1,
        includeCrossRepo: true,
        includeIndirect: false,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.directImpact).toHaveLength(2); // level1_a and level1_b
      expect(result.directImpact.map((i) => i.nodeId)).toContain('level1_a');
      expect(result.directImpact.map((i) => i.nodeId)).toContain('level1_b');
    });

    it('should find indirect impacts with depth', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.directImpact.length).toBeGreaterThan(0);
      expect(result.indirectImpact.length).toBeGreaterThan(0);
      expect(result.summary.totalImpacted).toBe(
        result.directImpact.length + result.indirectImpact.length
      );
    });

    it('should respect maxDepth limit', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 1,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // With maxDepth 1, should only find level1 nodes
      const allImpacted = [...result.directImpact, ...result.indirectImpact];
      expect(allImpacted.every((n) => n.depth <= 1)).toBe(true);
    });

    it('should filter by edge types', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        edgeTypes: ['references'], // No 'depends_on' edges
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // With only 'references' edge type and our test graph uses 'depends_on',
      // we should find no impacts
      expect(result.summary.totalImpacted).toBe(0);
    });

    it('should include paths in indirect impacts', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // Indirect impacts should have path information
      for (const indirect of result.indirectImpact) {
        expect(indirect.path).toBeDefined();
        expect(indirect.path.length).toBeGreaterThan(1);
        expect(indirect.path[0]).toBe('root');
      }
    });

    it('should throw for unregistered execution', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['node_1'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      await expect(
        engine.analyze('non_existent_exec' as RollupExecutionId, query)
      ).rejects.toThrow(RollupBlastRadiusError);
    });

    it('should throw for non-existent node', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['non_existent_node'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      await expect(engine.analyze(executionId, query)).rejects.toThrow(
        RollupBlastRadiusError
      );
    });

    it('should analyze multiple starting nodes', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root', 'level1_a'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.summary.totalImpacted).toBeGreaterThan(0);
    });

    it('should calculate impact by type', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.summary.impactByType).toBeDefined();
      expect(Object.keys(result.summary.impactByType).length).toBeGreaterThan(0);
    });

    it('should calculate impact by depth', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.summary.impactByDepth).toBeDefined();
      expect(result.summary.impactByDepth['1']).toBeGreaterThan(0);
    });

    it('should assign risk levels based on impact', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(['low', 'medium', 'high', 'critical']).toContain(
        result.summary.riskLevel
      );
    });
  });

  describe('risk level calculation', () => {
    const repoId1 = createRepositoryId();
    const repoId2 = createRepositoryId();

    it('should return low risk for zero impacts', async () => {
      const repositoryNames = new Map([[repoId1, 'repo-1']]);

      const mergedNodes: MergedNode[] = [
        {
          id: 'isolated_node',
          sourceNodeIds: ['isolated_node'],
          sourceRepoIds: [repoId1],
          type: 'terraform_resource',
          name: 'isolated',
          locations: [{ repoId: repoId1, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, [], repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['isolated_node'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.summary.riskLevel).toBe('low');
    });

    it('should increase risk for cross-repo impacts', async () => {
      const repositoryNames = new Map([
        [repoId1, 'repo-1'],
        [repoId2, 'repo-2'],
      ]);

      const mergedNodes: MergedNode[] = [
        {
          id: 'node_1',
          sourceNodeIds: ['node_1'],
          sourceRepoIds: [repoId1],
          type: 'terraform_resource',
          name: 'resource_1',
          locations: [{ repoId: repoId1, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'node_2',
          sourceNodeIds: ['node_2'],
          sourceRepoIds: [repoId2],
          type: 'terraform_resource',
          name: 'resource_2',
          locations: [{ repoId: repoId2, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'edge_1',
          source: 'node_1',
          target: 'node_2',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['node_1'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.crossRepoImpact.length).toBeGreaterThan(0);
    });
  });

  describe('DECAY_FACTOR', () => {
    it('should be 0.7 (70% retention per depth)', () => {
      expect(DECAY_FACTOR).toBe(0.7);
    });
  });

  describe('impactScore calculation', () => {
    const repoId = createRepositoryId();
    const repositoryNames = new Map([[repoId, 'test-repo']]);

    it('should calculate impactScore during BFS traversal', async () => {
      // Create a simple chain: source -> target1 -> target2
      // Edge weights for depends_on = 10
      // depth=0: 10 * 0.7^0 = 10.0 (for target1)
      // depth=1: 10 * 0.7^1 = 7.0 (for target2)
      // Total = 17.0
      const mergedNodes: MergedNode[] = [
        {
          id: 'source',
          sourceNodeIds: ['source'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource_source',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'target1',
          sourceNodeIds: ['target1'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource_target1',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'target2',
          sourceNodeIds: ['target2'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource_target2',
          locations: [{ repoId, file: 'main.tf', lineStart: 21, lineEnd: 30 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'edge_1',
          source: 'source',
          target: 'target1',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
        {
          id: 'edge_2',
          source: 'target1',
          target: 'target2',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['source'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // depends_on weight = 10
      // depth 0 -> target1: 10 * 0.7^0 = 10
      // depth 1 -> target2: 10 * 0.7^1 = 7
      // Total = 17
      expect(result.summary.impactScore).toBe(17);
    });

    it('should return 0 impactScore for source node with no edges', async () => {
      const mergedNodes: MergedNode[] = [
        {
          id: 'isolated',
          sourceNodeIds: ['isolated'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'isolated_resource',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, [], repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['isolated'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      expect(result.summary.impactScore).toBe(0);
    });

    it('should weight depends_on edges at 10 with depth decay', async () => {
      // Test the decay formula: weight * Math.pow(0.7, depth)
      // depends_on weight = 10
      // depth=0: 10 * 0.7^0 = 10.0
      // depth=1: 10 * 0.7^1 = 7.0
      // depth=2: 10 * 0.7^2 = 4.9
      const mergedNodes: MergedNode[] = [
        {
          id: 'root',
          sourceNodeIds: ['root'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'root',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'd1',
          sourceNodeIds: ['d1'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'd1',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'd2',
          sourceNodeIds: ['d2'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'd2',
          locations: [{ repoId, file: 'main.tf', lineStart: 21, lineEnd: 30 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'd3',
          sourceNodeIds: ['d3'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'd3',
          locations: [{ repoId, file: 'main.tf', lineStart: 31, lineEnd: 40 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      // Linear chain: root -> d1 -> d2 -> d3
      const edges: GraphEdge[] = [
        {
          id: 'e1',
          source: 'root',
          target: 'd1',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
        {
          id: 'e2',
          source: 'd1',
          target: 'd2',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
        {
          id: 'e3',
          source: 'd2',
          target: 'd3',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // depends_on weight = 10
      // d1 at depth 0: 10 * 0.7^0 = 10
      // d2 at depth 1: 10 * 0.7^1 = 7
      // d3 at depth 2: 10 * 0.7^2 = 4.9
      // Total = 21.9
      expect(result.summary.impactScore).toBe(21.9);
    });

    it('should accumulate scores across multiple paths at same depth', async () => {
      // Fan-out: root -> [branch_a, branch_b] (both at depth 0)
      const mergedNodes: MergedNode[] = [
        {
          id: 'root',
          sourceNodeIds: ['root'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'root',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'branch_a',
          sourceNodeIds: ['branch_a'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'branch_a',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'branch_b',
          sourceNodeIds: ['branch_b'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'branch_b',
          locations: [{ repoId, file: 'main.tf', lineStart: 21, lineEnd: 30 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'e1',
          source: 'root',
          target: 'branch_a',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
        {
          id: 'e2',
          source: 'root',
          target: 'branch_b',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // Both branches at depth 0: 10 * 0.7^0 = 10 each
      // Total = 20
      expect(result.summary.impactScore).toBe(20);
    });

    it('should respect maxDepth for score accumulation', async () => {
      // Chain: root -> d1 -> d2 -> d3
      // With maxDepth=1, only d1 should be scored
      const mergedNodes: MergedNode[] = [
        {
          id: 'root',
          sourceNodeIds: ['root'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'root',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'd1',
          sourceNodeIds: ['d1'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'd1',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'd2',
          sourceNodeIds: ['d2'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'd2',
          locations: [{ repoId, file: 'main.tf', lineStart: 21, lineEnd: 30 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'd3',
          sourceNodeIds: ['d3'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'd3',
          locations: [{ repoId, file: 'main.tf', lineStart: 31, lineEnd: 40 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'e1',
          source: 'root',
          target: 'd1',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
        {
          id: 'e2',
          source: 'd1',
          target: 'd2',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
        {
          id: 'e3',
          source: 'd2',
          target: 'd3',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 1,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // Only d1 at depth 0: 10 * 0.7^0 = 10
      expect(result.summary.impactScore).toBe(10);
    });
  });

  describe('edge type weighting', () => {
    const repoId = createRepositoryId();
    const repositoryNames = new Map([[repoId, 'test-repo']]);

    it('should weight module_call edges at 9 (lower than depends_on at 10)', async () => {
      // depends_on weight = 10, module_call weight = 9
      const mergedNodes: MergedNode[] = [
        {
          id: 'source',
          sourceNodeIds: ['source'],
          sourceRepoIds: [repoId],
          type: 'terraform_module',
          name: 'module.source',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'target',
          sourceNodeIds: ['target'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource.target',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'edge_1',
          source: 'source',
          target: 'target',
          type: 'module_call',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['source'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // module_call weight = 9, depth 0: 9 * 0.7^0 = 9
      expect(result.summary.impactScore).toBe(9);
    });

    it('should weight references edges at 8', async () => {
      const mergedNodes: MergedNode[] = [
        {
          id: 'source',
          sourceNodeIds: ['source'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource.source',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'target',
          sourceNodeIds: ['target'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource.target',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'edge_1',
          source: 'source',
          target: 'target',
          type: 'references',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['source'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // references weight = 8, depth 0: 8 * 0.7^0 = 8
      expect(result.summary.impactScore).toBe(8);
    });

    it('should accumulate mixed edge type weights correctly', async () => {
      // source -> target_a (depends_on, weight 10)
      // source -> target_b (references, weight 8)
      // Both at depth 0
      const mergedNodes: MergedNode[] = [
        {
          id: 'source',
          sourceNodeIds: ['source'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource.source',
          locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'target_a',
          sourceNodeIds: ['target_a'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource.target_a',
          locations: [{ repoId, file: 'main.tf', lineStart: 11, lineEnd: 20 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
        {
          id: 'target_b',
          sourceNodeIds: ['target_b'],
          sourceRepoIds: [repoId],
          type: 'terraform_resource',
          name: 'resource.target_b',
          locations: [{ repoId, file: 'main.tf', lineStart: 21, lineEnd: 30 }],
          metadata: {},
          matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: 'edge_1',
          source: 'source',
          target: 'target_a',
          type: 'depends_on',
          metadata: { implicit: false, confidence: 100 },
        },
        {
          id: 'edge_2',
          source: 'source',
          target: 'target_b',
          type: 'references',
          metadata: { implicit: false, confidence: 100 },
        },
      ];

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['source'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result = await engine.analyze(executionId, query);

      // depends_on (10) + references (8) = 18
      expect(result.summary.impactScore).toBe(18);
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      const { nodes, edges } = createBlastRadiusGraph();
      const repoId = createRepositoryId();
      const repositoryNames = new Map([[repoId, 'test-repo']]);

      const mergedNodes: MergedNode[] = Array.from(nodes.values()).map((node) => ({
        id: node.id,
        sourceNodeIds: [node.id],
        sourceRepoIds: [repoId],
        type: node.type,
        name: node.name,
        locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
        metadata: {},
        matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
      }));

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);
    });

    it('should cache results', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      // First call - should compute
      const result1 = await engine.analyze(executionId, query);

      // Check if cached
      const cached = await engine.getCached(executionId, query.nodeIds);
      expect(cached).not.toBeNull();
      expect(cached).toEqual(result1);
    });

    it('should return cached results', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      const result1 = await engine.analyze(executionId, query);
      const result2 = await engine.analyze(executionId, query);

      expect(result1).toEqual(result2);
    });

    it('should clear cache', async () => {
      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      await engine.analyze(executionId, query);

      engine.clearCache();

      const cached = await engine.getCached(executionId, query.nodeIds);
      expect(cached).toBeNull();
    });

    it('should expire cache after TTL', async () => {
      // Create engine with very short TTL
      const shortTtlEngine = new BlastRadiusEngine({ cacheTtlMs: 10 });

      const { nodes, edges } = createBlastRadiusGraph();
      const repoId = createRepositoryId();
      const repositoryNames = new Map([[repoId, 'test-repo']]);

      const mergedNodes: MergedNode[] = Array.from(nodes.values()).map((node) => ({
        id: node.id,
        sourceNodeIds: [node.id],
        sourceRepoIds: [repoId],
        type: node.type,
        name: node.name,
        locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
        metadata: {},
        matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
      }));

      shortTtlEngine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      await shortTtlEngine.analyze(executionId, query);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      const cached = await shortTtlEngine.getCached(executionId, query.nodeIds);
      expect(cached).toBeNull();
    });
  });

  describe('clearGraphData', () => {
    it('should remove graph data', async () => {
      const { nodes, edges } = createBlastRadiusGraph();
      const repoId = createRepositoryId();
      const repositoryNames = new Map([[repoId, 'test-repo']]);

      const mergedNodes: MergedNode[] = Array.from(nodes.values()).map((node) => ({
        id: node.id,
        sourceNodeIds: [node.id],
        sourceRepoIds: [repoId],
        type: node.type,
        name: node.name,
        locations: [{ repoId, file: 'main.tf', lineStart: 1, lineEnd: 10 }],
        metadata: {},
        matchInfo: { strategy: 'arn', confidence: 100, matchCount: 1 },
      }));

      engine.registerGraph(executionId, mergedNodes, edges, repositoryNames);

      engine.clearGraphData(executionId);

      const query: BlastRadiusQuery = {
        nodeIds: ['root'],
        maxDepth: 5,
        includeCrossRepo: true,
        includeIndirect: true,
      };

      await expect(engine.analyze(executionId, query)).rejects.toThrow(
        RollupBlastRadiusError
      );
    });
  });
});

describe('createBlastRadiusEngine', () => {
  it('should create new engine instance', () => {
    const engine = createBlastRadiusEngine();

    expect(engine).toBeInstanceOf(BlastRadiusEngine);
  });

  it('should accept options', () => {
    const engine = createBlastRadiusEngine({ cacheTtlMs: 60000 });

    expect(engine).toBeInstanceOf(BlastRadiusEngine);
  });
});
