/**
 * Graph Builder Tests
 * @module tests/graph/graph-builder
 *
 * Unit tests for dependency graph construction and validation.
 * TASK-DETECT-010: Graph builder for IaC dependency detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GraphBuilder,
  GraphMerger,
  GraphValidator,
  createGraphBuilder,
  createEmptyGraph,
  mergeGraphs,
} from '@/graph/graph-builder';
import {
  createTerraformResourceNode,
  createTerraformModuleNode,
  createK8sDeploymentNode,
  createK8sServiceNode,
  createHelmChartNode,
  createEdge,
  createReferenceEdge,
  createDependsOnEdge,
  createModuleCallEdge,
  createK8sSelectorEdge,
  createSimpleVPCGraph,
  createCyclicGraph,
  createGraphWithNodes,
  createGraphWithEdges,
  resetEdgeCounter,
} from '../factories/graph.factory';
import type { NodeType, GraphEdge, EdgeType } from '@/types/graph';

describe('GraphBuilder', () => {
  let builder: GraphBuilder;

  beforeEach(() => {
    builder = new GraphBuilder();
    resetEdgeCounter();
  });

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const node = createTerraformResourceNode('aws_vpc', 'main');

      builder.addNode(node);

      expect(builder.hasNode(node.id)).toBe(true);
      expect(builder.getNode(node.id)).toEqual(node);
    });

    it('should overwrite existing node with same id', () => {
      const node1 = createTerraformResourceNode('aws_vpc', 'main');
      const node2 = createTerraformResourceNode('aws_vpc', 'main', {
        metadata: { updated: true },
      });

      builder.addNode(node1);
      builder.addNode(node2);

      const retrieved = builder.getNode(node1.id);
      expect(retrieved?.metadata).toEqual({ updated: true });
    });

    it('should validate node when validateOnAdd is enabled', () => {
      const validBuilder = new GraphBuilder({ validateOnAdd: true });
      const invalidNode = { type: 'terraform_resource' } as unknown as NodeType;

      expect(() => validBuilder.addNode(invalidNode)).toThrow('Node must have an id');
    });

    it('should skip validation when validateOnAdd is disabled', () => {
      const permissiveBuilder = new GraphBuilder({ validateOnAdd: false });
      const node = createTerraformResourceNode('aws_vpc', 'main');

      expect(() => permissiveBuilder.addNode(node)).not.toThrow();
    });
  });

  describe('addNodes', () => {
    it('should add multiple nodes', () => {
      const nodes = [
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_subnet', 'public'),
        createTerraformResourceNode('aws_instance', 'web'),
      ];

      builder.addNodes(nodes);

      expect(builder.getNodes()).toHaveLength(3);
      nodes.forEach(node => {
        expect(builder.hasNode(node.id)).toBe(true);
      });
    });
  });

  describe('addEdge', () => {
    it('should add an edge to the graph', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNode(vpc);
      builder.addNode(subnet);

      const edge = createReferenceEdge(subnet.id, vpc.id);
      builder.addEdge(edge);

      expect(builder.hasEdge(subnet.id, vpc.id)).toBe(true);
      expect(builder.getEdges()).toHaveLength(1);
    });

    it('should skip duplicate edges when allowDuplicateEdges is false', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNode(vpc);
      builder.addNode(subnet);

      const edge1 = createReferenceEdge(subnet.id, vpc.id);
      const edge2 = createEdge({
        id: 'different-id',
        source: subnet.id,
        target: vpc.id,
        type: 'references',
      });

      builder.addEdge(edge1);
      builder.addEdge(edge2);

      expect(builder.getEdges()).toHaveLength(1);
    });

    it('should allow duplicate edges when allowDuplicateEdges is true', () => {
      const dupBuilder = new GraphBuilder({
        allowDuplicateEdges: true,
        validateOnAdd: false,
      });

      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      dupBuilder.addNode(vpc);
      dupBuilder.addNode(subnet);

      const edge1 = createReferenceEdge(subnet.id, vpc.id);
      const edge2 = createEdge({
        id: 'different-id',
        source: subnet.id,
        target: vpc.id,
        type: 'references',
      });

      dupBuilder.addEdge(edge1);
      dupBuilder.addEdge(edge2);

      expect(dupBuilder.getEdges()).toHaveLength(2);
    });

    it('should validate edge source exists when validateOnAdd is true', () => {
      const validBuilder = new GraphBuilder({ validateOnAdd: true });
      const vpc = createTerraformResourceNode('aws_vpc', 'main');

      validBuilder.addNode(vpc);

      const edge = createReferenceEdge('nonexistent', vpc.id);

      expect(() => validBuilder.addEdge(edge)).toThrow('Source node not found');
    });

    it('should validate edge target exists when validateOnAdd is true', () => {
      const validBuilder = new GraphBuilder({ validateOnAdd: true });
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      validBuilder.addNode(subnet);

      const edge = createReferenceEdge(subnet.id, 'nonexistent');

      expect(() => validBuilder.addEdge(edge)).toThrow('Target node not found');
    });
  });

  describe('addEdgeByIds', () => {
    it('should create and add edge by source and target ids', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNode(vpc);
      builder.addNode(subnet);

      const edge = builder.addEdgeByIds(subnet.id, vpc.id, 'references', {
        attribute: 'id',
      });

      expect(edge.source).toBe(subnet.id);
      expect(edge.target).toBe(vpc.id);
      expect(edge.type).toBe('references');
      expect(edge.metadata.attribute).toBe('id');
      expect(builder.getEdges()).toHaveLength(1);
    });

    it('should auto-generate edge id', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNode(vpc);
      builder.addNode(subnet);

      const edge = builder.addEdgeByIds(subnet.id, vpc.id, 'references');

      expect(edge.id).toContain(subnet.id);
      expect(edge.id).toContain(vpc.id);
      expect(edge.id).toContain('references');
    });
  });

  describe('addEdges', () => {
    it('should add multiple edges', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');
      const instance = createTerraformResourceNode('aws_instance', 'web');

      builder.addNodes([vpc, subnet, instance]);

      const edges = [
        createReferenceEdge(subnet.id, vpc.id),
        createReferenceEdge(instance.id, subnet.id),
      ];

      builder.addEdges(edges);

      expect(builder.getEdges()).toHaveLength(2);
    });
  });

  describe('hasNode', () => {
    it('should return true for existing node', () => {
      const node = createTerraformResourceNode('aws_vpc', 'main');
      builder.addNode(node);

      expect(builder.hasNode(node.id)).toBe(true);
    });

    it('should return false for non-existing node', () => {
      expect(builder.hasNode('nonexistent')).toBe(false);
    });
  });

  describe('hasEdge', () => {
    it('should return true for existing edge', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNode(vpc);
      builder.addNode(subnet);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));

      expect(builder.hasEdge(subnet.id, vpc.id)).toBe(true);
    });

    it('should return true for edge with specific type', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNode(vpc);
      builder.addNode(subnet);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));

      expect(builder.hasEdge(subnet.id, vpc.id, 'references')).toBe(true);
      expect(builder.hasEdge(subnet.id, vpc.id, 'depends_on')).toBe(false);
    });

    it('should return false for non-existing edge', () => {
      expect(builder.hasEdge('a', 'b')).toBe(false);
    });
  });

  describe('getNode', () => {
    it('should return node by id', () => {
      const node = createTerraformResourceNode('aws_vpc', 'main');
      builder.addNode(node);

      expect(builder.getNode(node.id)).toEqual(node);
    });

    it('should return undefined for non-existing node', () => {
      expect(builder.getNode('nonexistent')).toBeUndefined();
    });
  });

  describe('getNodes', () => {
    it('should return all nodes', () => {
      const nodes = [
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_subnet', 'public'),
      ];

      builder.addNodes(nodes);

      expect(builder.getNodes()).toHaveLength(2);
      expect(builder.getNodes()).toEqual(expect.arrayContaining(nodes));
    });

    it('should return empty array for empty builder', () => {
      expect(builder.getNodes()).toEqual([]);
    });
  });

  describe('getEdges', () => {
    it('should return all edges', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNode(vpc);
      builder.addNode(subnet);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));

      expect(builder.getEdges()).toHaveLength(1);
    });

    it('should return empty array for no edges', () => {
      expect(builder.getEdges()).toEqual([]);
    });
  });

  describe('getOutgoingEdges', () => {
    it('should return edges from a node', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');
      const instance = createTerraformResourceNode('aws_instance', 'web');

      builder.addNodes([vpc, subnet, instance]);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));
      builder.addEdge(createReferenceEdge(instance.id, subnet.id));
      builder.addEdge(createReferenceEdge(instance.id, vpc.id));

      const outgoing = builder.getOutgoingEdges(instance.id);

      expect(outgoing).toHaveLength(2);
      expect(outgoing.every(e => e.source === instance.id)).toBe(true);
    });

    it('should return empty array for node with no outgoing edges', () => {
      const node = createTerraformResourceNode('aws_vpc', 'main');
      builder.addNode(node);

      expect(builder.getOutgoingEdges(node.id)).toEqual([]);
    });
  });

  describe('getIncomingEdges', () => {
    it('should return edges to a node', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');
      const rtb = createTerraformResourceNode('aws_route_table', 'main');

      builder.addNodes([vpc, subnet, rtb]);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));
      builder.addEdge(createReferenceEdge(rtb.id, vpc.id));

      const incoming = builder.getIncomingEdges(vpc.id);

      expect(incoming).toHaveLength(2);
      expect(incoming.every(e => e.target === vpc.id)).toBe(true);
    });
  });

  describe('removeNode', () => {
    it('should remove node and its edges', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNodes([vpc, subnet]);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));

      const result = builder.removeNode(vpc.id);

      expect(result).toBe(true);
      expect(builder.hasNode(vpc.id)).toBe(false);
      expect(builder.getEdges()).toHaveLength(0);
    });

    it('should return false for non-existing node', () => {
      expect(builder.removeNode('nonexistent')).toBe(false);
    });
  });

  describe('removeEdge', () => {
    it('should remove edge by id', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNodes([vpc, subnet]);
      const edge = createReferenceEdge(subnet.id, vpc.id);
      builder.addEdge(edge);

      const result = builder.removeEdge(edge.id);

      expect(result).toBe(true);
      expect(builder.getEdges()).toHaveLength(0);
      expect(builder.hasEdge(subnet.id, vpc.id)).toBe(false);
    });

    it('should return false for non-existing edge', () => {
      expect(builder.removeEdge('nonexistent')).toBe(false);
    });
  });

  describe('build', () => {
    it('should build dependency graph', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');

      builder.addNodes([vpc, subnet]);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));

      const graph = builder.build();

      expect(graph.id).toBeDefined();
      expect(graph.nodes.size).toBe(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.metadata.createdAt).toBeInstanceOf(Date);
    });

    it('should calculate node counts by type', () => {
      builder.addNodes([
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_subnet', 'a'),
        createTerraformResourceNode('aws_subnet', 'b'),
        createTerraformModuleNode('vpc', './vpc'),
      ]);

      const graph = builder.build();

      expect(graph.metadata.nodeCounts['terraform_resource']).toBe(3);
      expect(graph.metadata.nodeCounts['terraform_module']).toBe(1);
    });

    it('should calculate edge counts by type', () => {
      const vpc = createTerraformResourceNode('aws_vpc', 'main');
      const subnet = createTerraformResourceNode('aws_subnet', 'public');
      const instance = createTerraformResourceNode('aws_instance', 'web');

      builder.addNodes([vpc, subnet, instance]);
      builder.addEdge(createReferenceEdge(subnet.id, vpc.id));
      builder.addEdge(createDependsOnEdge(instance.id, subnet.id));

      const graph = builder.build();

      expect(graph.metadata.edgeCounts['references']).toBe(1);
      expect(graph.metadata.edgeCounts['depends_on']).toBe(1);
    });

    it('should collect unique source files', () => {
      builder.addNodes([
        createTerraformResourceNode('aws_vpc', 'main', {
          location: { file: 'vpc.tf', lineStart: 1, lineEnd: 5 },
        }),
        createTerraformResourceNode('aws_subnet', 'public', {
          location: { file: 'subnets.tf', lineStart: 1, lineEnd: 5 },
        }),
        createTerraformResourceNode('aws_subnet', 'private', {
          location: { file: 'subnets.tf', lineStart: 10, lineEnd: 15 },
        }),
      ]);

      const graph = builder.build();

      expect(graph.metadata.sourceFiles).toHaveLength(2);
      expect(graph.metadata.sourceFiles).toContain('vpc.tf');
      expect(graph.metadata.sourceFiles).toContain('subnets.tf');
    });

    it('should track build time', () => {
      builder.addNode(createTerraformResourceNode('aws_vpc', 'main'));

      const graph = builder.build();

      expect(graph.metadata.buildTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clear', () => {
    it('should remove all nodes and edges', () => {
      builder.addNodes([
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_subnet', 'public'),
      ]);
      builder.addEdgeByIds('aws_subnet.public', 'aws_vpc.main', 'references');

      builder.clear();

      expect(builder.getNodes()).toHaveLength(0);
      expect(builder.getEdges()).toHaveLength(0);
    });
  });
});

describe('GraphMerger', () => {
  let merger: GraphMerger;

  beforeEach(() => {
    merger = new GraphMerger();
    resetEdgeCounter();
  });

  describe('merge', () => {
    it('should merge empty graphs', () => {
      const result = merger.merge([]);

      expect(result.nodes.size).toBe(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should merge single graph', () => {
      const graph = createSimpleVPCGraph();

      const result = merger.merge([graph]);

      expect(result.nodes.size).toBe(graph.nodes.size);
      expect(result.edges).toHaveLength(graph.edges.length);
    });

    it('should merge multiple graphs', () => {
      const graph1 = createGraphWithNodes([
        createTerraformResourceNode('aws_vpc', 'main'),
      ]);
      const graph2 = createGraphWithNodes([
        createTerraformResourceNode('aws_subnet', 'public'),
      ]);

      const result = merger.merge([graph1, graph2]);

      expect(result.nodes.size).toBe(2);
    });

    it('should handle node conflicts with keep-first strategy', () => {
      const node1 = createTerraformResourceNode('aws_vpc', 'main', {
        metadata: { version: 1 },
      });
      const node2 = createTerraformResourceNode('aws_vpc', 'main', {
        metadata: { version: 2 },
      });

      const graph1 = createGraphWithNodes([node1]);
      const graph2 = createGraphWithNodes([node2]);

      const result = merger.merge([graph1, graph2], {
        nodeConflictStrategy: 'keep-first',
      });

      expect(result.nodes.get(node1.id)?.metadata.version).toBe(1);
    });

    it('should handle node conflicts with keep-last strategy', () => {
      const node1 = createTerraformResourceNode('aws_vpc', 'main', {
        metadata: { version: 1 },
      });
      const node2 = createTerraformResourceNode('aws_vpc', 'main', {
        metadata: { version: 2 },
      });

      const graph1 = createGraphWithNodes([node1]);
      const graph2 = createGraphWithNodes([node2]);

      const result = merger.merge([graph1, graph2], {
        nodeConflictStrategy: 'keep-last',
      });

      expect(result.nodes.get(node1.id)?.metadata.version).toBe(2);
    });

    it('should handle node conflicts with merge strategy', () => {
      const node1 = createTerraformResourceNode('aws_vpc', 'main', {
        metadata: { key1: 'value1' },
      });
      const node2 = createTerraformResourceNode('aws_vpc', 'main', {
        metadata: { key2: 'value2' },
      });

      const graph1 = createGraphWithNodes([node1]);
      const graph2 = createGraphWithNodes([node2]);

      const result = merger.merge([graph1, graph2], {
        nodeConflictStrategy: 'merge',
      });

      const mergedNode = result.nodes.get(node1.id);
      expect(mergedNode?.metadata.key1).toBe('value1');
      expect(mergedNode?.metadata.key2).toBe('value2');
    });

    it('should throw on node conflict with error strategy', () => {
      const node1 = createTerraformResourceNode('aws_vpc', 'main');
      const node2 = createTerraformResourceNode('aws_vpc', 'main');

      const graph1 = createGraphWithNodes([node1]);
      const graph2 = createGraphWithNodes([node2]);

      expect(() =>
        merger.merge([graph1, graph2], { nodeConflictStrategy: 'error' })
      ).toThrow('Node conflict');
    });

    it('should apply node ID prefix', () => {
      const graph = createGraphWithNodes([
        createTerraformResourceNode('aws_vpc', 'main'),
      ]);

      const result = merger.merge([graph], {
        nodeIdPrefix: 'module_',
      });

      expect(result.nodes.has('module_0_aws_vpc.main')).toBe(true);
    });
  });
});

describe('GraphValidator', () => {
  let validator: GraphValidator;

  beforeEach(() => {
    validator = new GraphValidator();
    resetEdgeCounter();
  });

  describe('validate', () => {
    it('should validate valid graph', () => {
      const graph = createSimpleVPCGraph();

      const result = validator.validate(graph);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect dangling source edge', () => {
      const node = createTerraformResourceNode('aws_vpc', 'main');
      const graph = createGraphWithEdges(
        [node],
        [createReferenceEdge('nonexistent', node.id)]
      );

      const result = validator.validate(graph);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'DANGLING_SOURCE')).toBe(true);
    });

    it('should detect dangling target edge', () => {
      const node = createTerraformResourceNode('aws_vpc', 'main');
      const graph = createGraphWithEdges(
        [node],
        [createReferenceEdge(node.id, 'nonexistent')]
      );

      const result = validator.validate(graph);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'DANGLING_TARGET')).toBe(true);
    });

    it('should warn about self-loops', () => {
      const node = createTerraformResourceNode('aws_vpc', 'main');
      const graph = createGraphWithEdges(
        [node],
        [createReferenceEdge(node.id, node.id)]
      );

      const result = validator.validate(graph);

      // Self-loops are warnings, not errors
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'SELF_LOOP')).toBe(true);
    });

    it('should warn about orphan nodes', () => {
      const graph = createGraphWithNodes([
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_isolated', 'orphan'),
      ]);

      const result = validator.validate(graph);

      expect(result.warnings.some(w => w.code === 'ORPHAN_NODE')).toBe(true);
    });

    it('should warn about cycles', () => {
      const graph = createCyclicGraph();

      const result = validator.validate(graph);

      expect(result.warnings.some(w => w.code === 'CYCLE_DETECTED')).toBe(true);
    });
  });

  describe('hasCycles', () => {
    it('should return false for acyclic graph', () => {
      const graph = createSimpleVPCGraph();

      expect(validator.hasCycles(graph)).toBe(false);
    });

    it('should return true for cyclic graph', () => {
      const graph = createCyclicGraph();

      expect(validator.hasCycles(graph)).toBe(true);
    });

    it('should return false for empty graph', () => {
      const graph = createEmptyGraph();

      expect(validator.hasCycles(graph)).toBe(false);
    });

    it('should handle complex graphs', () => {
      // Diamond dependency (no cycle)
      const nodes = [
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_subnet', 'a'),
        createTerraformResourceNode('aws_subnet', 'b'),
        createTerraformResourceNode('aws_instance', 'web'),
      ];
      const edges = [
        createReferenceEdge('aws_subnet.a', 'aws_vpc.main'),
        createReferenceEdge('aws_subnet.b', 'aws_vpc.main'),
        createReferenceEdge('aws_instance.web', 'aws_subnet.a'),
        createReferenceEdge('aws_instance.web', 'aws_subnet.b'),
      ];
      const graph = createGraphWithEdges(nodes, edges);

      expect(validator.hasCycles(graph)).toBe(false);
    });
  });

  describe('findOrphanNodes', () => {
    it('should find orphan nodes', () => {
      const graph = createGraphWithNodes([
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_orphan', 'lonely'),
      ]);

      const orphans = validator.findOrphanNodes(graph);

      expect(orphans).toHaveLength(2); // Both are orphans in this case
    });

    it('should not include connected nodes', () => {
      const graph = createSimpleVPCGraph();

      const orphans = validator.findOrphanNodes(graph);

      expect(orphans).toHaveLength(0);
    });
  });

  describe('findUnreachableNodes', () => {
    it('should find unreachable nodes from starting point', () => {
      const nodes = [
        createTerraformResourceNode('aws_vpc', 'main'),
        createTerraformResourceNode('aws_subnet', 'public'),
        createTerraformResourceNode('aws_isolated', 'orphan'),
      ];
      const edges = [
        createReferenceEdge('aws_subnet.public', 'aws_vpc.main'),
      ];
      const graph = createGraphWithEdges(nodes, edges);

      const unreachable = validator.findUnreachableNodes(graph, 'aws_vpc.main');

      expect(unreachable).toContain('aws_isolated.orphan');
    });

    it('should return all nodes for non-existent starting point', () => {
      const graph = createSimpleVPCGraph();

      const unreachable = validator.findUnreachableNodes(graph, 'nonexistent');

      expect(unreachable).toHaveLength(graph.nodes.size);
    });

    it('should return empty for fully connected graph from proper start', () => {
      // Linear chain: A -> B -> C
      const nodes = [
        createTerraformResourceNode('aws_a', 'a'),
        createTerraformResourceNode('aws_b', 'b'),
        createTerraformResourceNode('aws_c', 'c'),
      ];
      const edges = [
        createReferenceEdge('aws_a.a', 'aws_b.b'),
        createReferenceEdge('aws_b.b', 'aws_c.c'),
      ];
      const graph = createGraphWithEdges(nodes, edges);

      const unreachable = validator.findUnreachableNodes(graph, 'aws_a.a');

      expect(unreachable).toHaveLength(0);
    });
  });
});

describe('Factory Functions', () => {
  describe('createGraphBuilder', () => {
    it('should create builder with default options', () => {
      const builder = createGraphBuilder();

      expect(builder).toBeDefined();
      expect(builder.getNodes()).toEqual([]);
    });

    it('should create builder with custom options', () => {
      const builder = createGraphBuilder({
        validateOnAdd: false,
        allowDuplicateEdges: true,
      });

      expect(builder).toBeDefined();
    });
  });

  describe('createEmptyGraph', () => {
    it('should create empty graph with default id', () => {
      const graph = createEmptyGraph();

      expect(graph.id).toContain('graph-');
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('should create empty graph with custom id', () => {
      const graph = createEmptyGraph('my-graph');

      expect(graph.id).toBe('my-graph');
    });
  });

  describe('mergeGraphs', () => {
    it('should merge graphs using convenience function', () => {
      const graph1 = createGraphWithNodes([
        createTerraformResourceNode('aws_vpc', 'main'),
      ]);
      const graph2 = createGraphWithNodes([
        createTerraformResourceNode('aws_subnet', 'public'),
      ]);

      const result = mergeGraphs([graph1, graph2]);

      expect(result.nodes.size).toBe(2);
    });
  });
});
