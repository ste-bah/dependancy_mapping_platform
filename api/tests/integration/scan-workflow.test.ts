/**
 * Scan Workflow Integration Tests
 * @module tests/integration/scan-workflow
 *
 * Integration tests for the complete dependency detection workflow.
 * Tests the full pipeline from file parsing through graph construction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTerraformFile,
  createResourceBlock,
  createVariableBlock,
  createOutputBlock,
  createDataBlock,
  createModuleBlock,
  createLocalsBlock,
  createLiteralExpression,
  createReferenceExpression,
  createFunctionExpression,
  createArrayExpression,
  createVPCScenario,
  createModuleCallScenario,
} from '../factories/terraform.factory';
import {
  createEvidence,
  createExplicitReferenceEvidence,
  createEvidenceCollection,
} from '../factories/evidence.factory';
import {
  createGraphBuilder,
  createEmptyGraph,
  createTerraformResourceNode,
  createTerraformVariableNode,
  createTerraformModuleNode,
  createTerraformDataNode,
} from '../factories/graph.factory';
import { ScoringEngine, createScoringEngine } from '@/scoring/scoring-engine';
import {
  GraphBuilder,
  GraphValidator,
  createGraphBuilder as createBuilder,
} from '@/graph/graph-builder';
import {
  parseModuleSource,
  ModuleDetector,
} from '@/parsers/terraform/module-detector';
import type { TerraformFile } from '@/parsers/terraform/types';
import type { NodeType, GraphEdge, DependencyGraph } from '@/types/graph';
import type { Evidence, ConfidenceScore } from '@/types/evidence';

/**
 * Simulated scan workflow that mimics the full detection pipeline.
 * This represents what a real scan service would do.
 */
class ScanWorkflow {
  private scoringEngine: ScoringEngine;
  private moduleDetector: ModuleDetector;
  private graphValidator: GraphValidator;

  constructor() {
    this.scoringEngine = createScoringEngine();
    this.moduleDetector = new ModuleDetector();
    this.graphValidator = new GraphValidator();
  }

  /**
   * Execute the full scan workflow
   */
  async scan(files: TerraformFile[]): Promise<ScanResult> {
    const startTime = Date.now();

    // Step 1: Parse and extract nodes
    const nodes = this.extractNodes(files);

    // Step 2: Detect references and build edges
    const { edges, evidence } = this.detectDependencies(files, nodes);

    // Step 3: Calculate confidence scores
    const confidenceScores = this.calculateConfidence(evidence);

    // Step 4: Build the dependency graph
    const graph = this.buildGraph(nodes, edges);

    // Step 5: Validate the graph
    const validation = this.graphValidator.validate(graph);

    return {
      graph,
      nodes: Array.from(nodes.values()),
      edges,
      evidence,
      confidenceScores,
      validation,
      metadata: {
        fileCount: files.length,
        nodeCount: nodes.size,
        edgeCount: edges.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private extractNodes(files: TerraformFile[]): Map<string, NodeType> {
    const nodes = new Map<string, NodeType>();

    for (const file of files) {
      for (const block of file.blocks) {
        const node = this.blockToNode(block, file.path);
        if (node) {
          nodes.set(node.id, node);
        }
      }
    }

    return nodes;
  }

  private blockToNode(
    block: { type: string; labels: string[]; attributes: Record<string, unknown> },
    file: string
  ): NodeType | null {
    const location = { file, lineStart: 1, lineEnd: 10, columnStart: 1, columnEnd: 1 };

    switch (block.type) {
      case 'resource':
        return {
          type: 'terraform_resource',
          id: `${block.labels[0]}.${block.labels[1]}`,
          name: block.labels[1],
          resourceType: block.labels[0],
          provider: block.labels[0].split('_')[0],
          dependsOn: [],
          location,
          metadata: {},
        };

      case 'variable':
        return {
          type: 'terraform_variable',
          id: `var.${block.labels[0]}`,
          name: block.labels[0],
          sensitive: false,
          nullable: true,
          location,
          metadata: {},
        };

      case 'output':
        return {
          type: 'terraform_output',
          id: `output.${block.labels[0]}`,
          name: block.labels[0],
          value: '',
          sensitive: false,
          location,
          metadata: {},
        };

      case 'data':
        return {
          type: 'terraform_data',
          id: `data.${block.labels[0]}.${block.labels[1]}`,
          name: block.labels[1],
          dataType: block.labels[0],
          provider: block.labels[0].split('_')[0],
          location,
          metadata: {},
        };

      case 'module':
        const source = this.extractSource(block.attributes);
        return {
          type: 'terraform_module',
          id: `module.${block.labels[0]}`,
          name: block.labels[0],
          source: source || '',
          sourceType: source?.startsWith('./') ? 'local' : 'registry',
          providers: {},
          location,
          metadata: {},
        };

      default:
        return null;
    }
  }

  private extractSource(attributes: Record<string, unknown>): string | null {
    const source = attributes.source as { value?: string } | undefined;
    return source?.value ?? null;
  }

  private detectDependencies(
    files: TerraformFile[],
    nodes: Map<string, NodeType>
  ): { edges: GraphEdge[]; evidence: Evidence[] } {
    const edges: GraphEdge[] = [];
    const evidence: Evidence[] = [];
    let edgeCounter = 0;

    for (const file of files) {
      for (const block of file.blocks) {
        const sourceId = this.getBlockId(block);
        if (!sourceId || !nodes.has(sourceId)) continue;

        // Extract references from attributes
        for (const [attrName, attrValue] of Object.entries(block.attributes)) {
          const refs = this.extractReferences(attrValue);

          for (const ref of refs) {
            const targetId = this.resolveReference(ref, nodes);
            if (targetId && nodes.has(targetId)) {
              edgeCounter++;
              edges.push({
                id: `edge-${edgeCounter}`,
                source: sourceId,
                target: targetId,
                type: this.getEdgeType(ref),
                metadata: {
                  implicit: false,
                  confidence: 90,
                  attribute: attrName,
                },
              });

              evidence.push(createExplicitReferenceEvidence(
                `${sourceId} -> ${targetId}`,
                90
              ));
            }
          }
        }
      }
    }

    return { edges, evidence };
  }

  private getBlockId(block: { type: string; labels: string[] }): string | null {
    switch (block.type) {
      case 'resource':
        return `${block.labels[0]}.${block.labels[1]}`;
      case 'variable':
        return `var.${block.labels[0]}`;
      case 'output':
        return `output.${block.labels[0]}`;
      case 'data':
        return `data.${block.labels[0]}.${block.labels[1]}`;
      case 'module':
        return `module.${block.labels[0]}`;
      default:
        return null;
    }
  }

  private extractReferences(value: unknown): string[] {
    const refs: string[] = [];

    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;

      if (obj.type === 'reference' && Array.isArray(obj.parts)) {
        refs.push(obj.parts.join('.'));
      }

      // Recursively check nested objects
      for (const v of Object.values(obj)) {
        refs.push(...this.extractReferences(v));
      }
    }

    return refs;
  }

  private resolveReference(ref: string, nodes: Map<string, NodeType>): string | null {
    const parts = ref.split('.');

    if (parts[0] === 'var') {
      return `var.${parts[1]}`;
    }
    if (parts[0] === 'local') {
      return `local.${parts[1]}`;
    }
    if (parts[0] === 'module') {
      return `module.${parts[1]}`;
    }
    if (parts[0] === 'data') {
      return `data.${parts[1]}.${parts[2]}`;
    }

    // Resource reference
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]}`;
    }

    return null;
  }

  private getEdgeType(ref: string): GraphEdge['type'] {
    const parts = ref.split('.');

    if (parts[0] === 'var') return 'input_variable';
    if (parts[0] === 'local') return 'local_reference';
    if (parts[0] === 'module') return 'module_call';
    if (parts[0] === 'data') return 'data_reference';

    return 'references';
  }

  private calculateConfidence(evidence: Evidence[]): Map<string, ConfidenceScore> {
    const scores = new Map<string, ConfidenceScore>();

    // Group evidence by reference
    const evidenceByRef = new Map<string, Evidence[]>();
    for (const e of evidence) {
      const key = e.description;
      const existing = evidenceByRef.get(key) || [];
      existing.push(e);
      evidenceByRef.set(key, existing);
    }

    // Calculate score for each reference
    for (const [ref, refEvidence] of evidenceByRef) {
      const score = this.scoringEngine.calculate({ evidence: refEvidence });
      scores.set(ref, score);
    }

    return scores;
  }

  private buildGraph(nodes: Map<string, NodeType>, edges: GraphEdge[]): DependencyGraph {
    const builder = createBuilder({
      validateOnAdd: false, // Nodes are already validated
    });

    for (const node of nodes.values()) {
      builder.addNode(node);
    }

    for (const edge of edges) {
      builder.addEdge(edge);
    }

    return builder.build();
  }
}

interface ScanResult {
  graph: DependencyGraph;
  nodes: NodeType[];
  edges: GraphEdge[];
  evidence: Evidence[];
  confidenceScores: Map<string, ConfidenceScore>;
  validation: {
    isValid: boolean;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  };
  metadata: {
    fileCount: number;
    nodeCount: number;
    edgeCount: number;
    processingTimeMs: number;
  };
}

describe('Scan Workflow Integration', () => {
  let workflow: ScanWorkflow;

  beforeEach(() => {
    workflow = new ScanWorkflow();
  });

  describe('VPC Infrastructure Scenario', () => {
    it('should detect VPC -> Subnet -> Instance dependency chain', async () => {
      const { files, expectedNodes, expectedEdges } = createVPCScenario();

      const result = await workflow.scan(files);

      expect(result.metadata.nodeCount).toBe(expectedNodes);
      expect(result.edges.length).toBeGreaterThanOrEqual(expectedEdges);

      // Verify specific dependencies
      const subnetToVpc = result.edges.find(
        e => e.source.includes('subnet') && e.target.includes('vpc')
      );
      expect(subnetToVpc).toBeDefined();

      const instanceToSubnet = result.edges.find(
        e => e.source.includes('instance') && e.target.includes('subnet')
      );
      expect(instanceToSubnet).toBeDefined();
    });

    it('should resolve variable references', async () => {
      const { files } = createVPCScenario();

      const result = await workflow.scan(files);

      const varEdge = result.edges.find(e => e.target.startsWith('var.'));
      expect(varEdge).toBeDefined();
      expect(varEdge?.type).toBe('input_variable');
    });

    it('should generate confidence scores for all edges', async () => {
      const { files } = createVPCScenario();

      const result = await workflow.scan(files);

      expect(result.confidenceScores.size).toBeGreaterThan(0);

      for (const score of result.confidenceScores.values()) {
        expect(score.value).toBeGreaterThanOrEqual(0);
        expect(score.value).toBeLessThanOrEqual(100);
        expect(score.level).toBeDefined();
      }
    });

    it('should produce valid graph', async () => {
      const { files } = createVPCScenario();

      const result = await workflow.scan(files);

      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
    });
  });

  describe('Module Call Scenario', () => {
    it('should detect module dependencies', async () => {
      const { files } = createModuleCallScenario();

      const result = await workflow.scan(files);

      const moduleNode = result.nodes.find(n => n.type === 'terraform_module');
      expect(moduleNode).toBeDefined();

      const moduleEdge = result.edges.find(
        e => e.target.startsWith('module.')
      );
      expect(moduleEdge).toBeDefined();
    });
  });

  describe('Data Source Scenario', () => {
    it('should detect data source dependencies', async () => {
      const dataBlock = createDataBlock({
        dataType: 'aws_ami',
        name: 'latest',
        attributes: {
          most_recent: createLiteralExpression(true),
        },
      });

      const instanceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          ami: createReferenceExpression(['data', 'aws_ami', 'latest', 'id']),
        },
      });

      const files = [
        createTerraformFile({
          path: 'main.tf',
          blocks: [dataBlock, instanceBlock],
        }),
      ];

      const result = await workflow.scan(files);

      const dataNode = result.nodes.find(n => n.type === 'terraform_data');
      expect(dataNode).toBeDefined();

      const dataEdge = result.edges.find(e => e.type === 'data_reference');
      expect(dataEdge).toBeDefined();
    });
  });

  describe('Complex Multi-File Scenario', () => {
    it('should handle references across files', async () => {
      const vpcFile = createTerraformFile({
        path: 'vpc.tf',
        blocks: [
          createResourceBlock({
            resourceType: 'aws_vpc',
            name: 'main',
            attributes: {
              cidr_block: createLiteralExpression('10.0.0.0/16'),
            },
          }),
        ],
      });

      const variablesFile = createTerraformFile({
        path: 'variables.tf',
        blocks: [
          createVariableBlock({
            name: 'environment',
            varType: 'string',
            defaultValue: 'dev',
          }),
        ],
      });

      const instanceFile = createTerraformFile({
        path: 'instances.tf',
        blocks: [
          createResourceBlock({
            resourceType: 'aws_instance',
            name: 'web',
            attributes: {
              vpc_security_group_ids: createReferenceExpression(['aws_vpc', 'main', 'default_security_group_id']),
              tags: {
                type: 'object',
                attributes: {
                  Environment: createReferenceExpression(['var', 'environment']),
                },
                raw: '{ Environment = var.environment }',
              },
            },
          }),
        ],
      });

      const result = await workflow.scan([vpcFile, variablesFile, instanceFile]);

      // Should have nodes from all files
      expect(result.nodes.some(n => n.location.file === 'vpc.tf')).toBe(true);
      expect(result.nodes.some(n => n.location.file === 'variables.tf')).toBe(true);
      expect(result.nodes.some(n => n.location.file === 'instances.tf')).toBe(true);

      // Should have cross-file edges
      expect(result.edges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty file list', async () => {
      const result = await workflow.scan([]);

      expect(result.graph.nodes.size).toBe(0);
      expect(result.edges).toHaveLength(0);
      expect(result.metadata.fileCount).toBe(0);
    });

    it('should handle files with no blocks', async () => {
      const emptyFile = createTerraformFile({
        path: 'empty.tf',
        blocks: [],
      });

      const result = await workflow.scan([emptyFile]);

      expect(result.graph.nodes.size).toBe(0);
    });

    it('should skip unresolvable references', async () => {
      const instanceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          subnet_id: createReferenceExpression(['aws_subnet', 'nonexistent', 'id']),
        },
      });

      const files = [createTerraformFile({ blocks: [instanceBlock] })];

      const result = await workflow.scan(files);

      // Instance node should exist, but no edge to nonexistent subnet
      expect(result.nodes.some(n => n.id === 'aws_instance.web')).toBe(true);
      const invalidEdge = result.edges.find(
        e => e.target === 'aws_subnet.nonexistent'
      );
      expect(invalidEdge).toBeUndefined();
    });
  });

  describe('Performance', () => {
    it('should complete scan within reasonable time for small projects', async () => {
      const files: TerraformFile[] = [];

      // Create 10 resources with interconnected dependencies
      for (let i = 0; i < 10; i++) {
        files.push(createTerraformFile({
          path: `resource_${i}.tf`,
          blocks: [
            createResourceBlock({
              resourceType: 'aws_instance',
              name: `instance_${i}`,
              attributes: i > 0
                ? { depends_on: createReferenceExpression(['aws_instance', `instance_${i - 1}`, 'id']) }
                : {},
            }),
          ],
        }));
      }

      const result = await workflow.scan(files);

      expect(result.metadata.processingTimeMs).toBeLessThan(5000); // 5 seconds max
      expect(result.nodes).toHaveLength(10);
    });

    it('should track processing time', async () => {
      const { files } = createVPCScenario();

      const result = await workflow.scan(files);

      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata.processingTimeMs).toBe('number');
    });
  });

  describe('Graph Metadata', () => {
    it('should calculate correct node counts by type', async () => {
      const files = [
        createTerraformFile({
          path: 'main.tf',
          blocks: [
            createResourceBlock({ resourceType: 'aws_vpc', name: 'main' }),
            createResourceBlock({ resourceType: 'aws_subnet', name: 'a' }),
            createResourceBlock({ resourceType: 'aws_subnet', name: 'b' }),
            createVariableBlock({ name: 'env' }),
            createModuleBlock({ name: 'vpc', source: './vpc' }),
          ],
        }),
      ];

      const result = await workflow.scan(files);

      expect(result.graph.metadata.nodeCounts['terraform_resource']).toBe(3);
      expect(result.graph.metadata.nodeCounts['terraform_variable']).toBe(1);
      expect(result.graph.metadata.nodeCounts['terraform_module']).toBe(1);
    });

    it('should track source files', async () => {
      const files = [
        createTerraformFile({ path: 'vpc.tf', blocks: [createResourceBlock()] }),
        createTerraformFile({ path: 'main.tf', blocks: [createResourceBlock({ name: 'other' })] }),
      ];

      const result = await workflow.scan(files);

      expect(result.graph.metadata.sourceFiles).toContain('vpc.tf');
      expect(result.graph.metadata.sourceFiles).toContain('main.tf');
    });
  });
});

describe('Module Source Parsing Integration', () => {
  it('should correctly parse and categorize module sources', () => {
    const testCases = [
      { source: './modules/vpc', expectedType: 'local' },
      { source: 'terraform-aws-modules/vpc/aws', expectedType: 'registry' },
      { source: 'github.com/hashicorp/example', expectedType: 'github' },
      { source: 'git::https://example.com/module.git', expectedType: 'git' },
      { source: 's3::https://s3-us-west-2.amazonaws.com/bucket/key', expectedType: 's3' },
    ];

    for (const { source, expectedType } of testCases) {
      const result = parseModuleSource(source, '/project');
      expect(result.type).toBe(expectedType);
    }
  });
});

describe('Confidence Scoring Integration', () => {
  it('should score explicit references higher than heuristic', () => {
    const engine = createScoringEngine();

    const explicitEvidence = [
      createEvidence({
        type: 'depends_on_directive',
        category: 'explicit',
        confidence: 98,
      }),
    ];

    const heuristicEvidence = [
      createEvidence({
        type: 'naming_convention',
        category: 'heuristic',
        confidence: 55,
      }),
    ];

    const explicitScore = engine.calculate({ evidence: explicitEvidence });
    const heuristicScore = engine.calculate({ evidence: heuristicEvidence });

    expect(explicitScore.value).toBeGreaterThan(heuristicScore.value);
    expect(explicitScore.level).not.toBe('uncertain');
  });

  it('should combine multiple evidence sources', () => {
    const engine = createScoringEngine();

    const combinedEvidence = [
      createEvidence({
        type: 'explicit_reference',
        category: 'syntax',
        confidence: 90,
      }),
      createEvidence({
        type: 'interpolation',
        category: 'semantic',
        confidence: 80,
      }),
      createEvidence({
        type: 'block_nesting',
        category: 'structural',
        confidence: 70,
      }),
    ];

    const score = engine.calculate({ evidence: combinedEvidence });

    // Multiple evidence sources should result in high confidence
    expect(score.value).toBeGreaterThan(70);
    expect(score.positiveFactors.some(f => f.includes('Multiple'))).toBe(true);
  });
});
