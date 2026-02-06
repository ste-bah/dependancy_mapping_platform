/**
 * Snapshot Testing Suite
 * @module tests/regression/snapshots
 *
 * Vitest snapshot testing for complex data structures and outputs.
 * Uses snapshots to detect unintended changes in parser output,
 * graph structures, and API responses.
 *
 * TASK-DETECT: Snapshot-based regression testing
 */

import { describe, it, expect } from 'vitest';

import {
  createTerraformFile,
  createResourceBlock,
  createVariableBlock,
  createModuleBlock,
  createDataBlock,
  createOutputBlock,
  createLocalsBlock,
  createProviderBlock,
  createVPCScenario,
  createModuleCallScenario,
  createReferenceExpression,
  createLiteralExpression,
  createFunctionExpression,
  createArrayExpression,
} from '../factories/terraform.factory';
import {
  createEvidence,
  createEvidenceCollection,
  createExplicitReferenceEvidence,
} from '../factories/evidence.factory';
import {
  createGraphBuilder,
  createTerraformResourceNode,
  createTerraformVariableNode,
  createTerraformModuleNode,
  createTerraformDataNode,
} from '../factories/graph.factory';

import type { NodeType, GraphEdge, DependencyGraph } from '@/types/graph';

// ============================================================================
// Parser Output Snapshots
// ============================================================================

describe('Parser Output Snapshots', () => {
  describe('Terraform Parser Snapshots', () => {
    it('should match VPC resource block snapshot', () => {
      const vpcBlock = createResourceBlock({
        resourceType: 'aws_vpc',
        name: 'main',
        attributes: {
          cidr_block: createLiteralExpression('10.0.0.0/16'),
          enable_dns_hostnames: createLiteralExpression(true),
          enable_dns_support: createLiteralExpression(true),
        },
      });

      // Normalize for snapshot (remove dynamic fields)
      const normalized = {
        type: vpcBlock.type,
        labels: vpcBlock.labels,
        attributeKeys: Object.keys(vpcBlock.attributes).sort(),
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match variable block snapshot', () => {
      const varBlock = createVariableBlock({
        name: 'environment',
        varType: 'string',
        defaultValue: 'production',
        description: 'Deployment environment',
        sensitive: false,
      });

      const normalized = {
        type: varBlock.type,
        labels: varBlock.labels,
        attributeKeys: Object.keys(varBlock.attributes).sort(),
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match module block snapshot', () => {
      const moduleBlock = createModuleBlock({
        name: 'vpc',
        source: 'terraform-aws-modules/vpc/aws',
        version: '3.19.0',
        variables: {
          cidr: createLiteralExpression('10.0.0.0/16'),
          enable_nat_gateway: createLiteralExpression(true),
        },
      });

      const normalized = {
        type: moduleBlock.type,
        labels: moduleBlock.labels,
        attributeKeys: Object.keys(moduleBlock.attributes).sort(),
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match data block snapshot', () => {
      const dataBlock = createDataBlock({
        dataType: 'aws_ami',
        name: 'amazon_linux',
        attributes: {
          most_recent: createLiteralExpression(true),
          owners: createArrayExpression([createLiteralExpression('amazon')]),
        },
      });

      const normalized = {
        type: dataBlock.type,
        labels: dataBlock.labels,
        attributeKeys: Object.keys(dataBlock.attributes).sort(),
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match output block snapshot', () => {
      const outputBlock = createOutputBlock({
        name: 'vpc_id',
        value: createReferenceExpression(['aws_vpc', 'main', 'id']),
        description: 'The ID of the VPC',
        sensitive: false,
      });

      const normalized = {
        type: outputBlock.type,
        labels: outputBlock.labels,
        attributeKeys: Object.keys(outputBlock.attributes).sort(),
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match complex file structure snapshot', () => {
      const { files, expectedNodes, expectedEdges } = createVPCScenario();

      // Normalize file structure for snapshot
      const normalized = files.map((file) => ({
        path: file.path,
        blockCount: file.blocks.length,
        blockTypes: file.blocks.map((b) => b.type).sort(),
        blockLabels: file.blocks.map((b) => b.labels),
      }));

      expect(normalized).toMatchSnapshot();
    });

    it('should match module call scenario snapshot', () => {
      const { files, expectedNodes, expectedEdges } = createModuleCallScenario();

      const normalized = files.map((file) => ({
        path: file.path,
        blockCount: file.blocks.length,
        blockTypes: file.blocks.map((b) => b.type),
      }));

      expect(normalized).toMatchSnapshot();
    });
  });

  describe('Expression Snapshots', () => {
    it('should match reference expression snapshot', () => {
      const refExpr = createReferenceExpression(['aws_vpc', 'main', 'id']);

      expect({
        type: refExpr.type,
        parts: refExpr.parts,
        raw: refExpr.raw,
      }).toMatchSnapshot();
    });

    it('should match function expression snapshot', () => {
      const funcExpr = createFunctionExpression('lookup', [
        createReferenceExpression(['var', 'tags']),
        createLiteralExpression('Name'),
        createLiteralExpression('default'),
      ]);

      expect({
        type: funcExpr.type,
        name: funcExpr.name,
        argCount: funcExpr.args.length,
        argTypes: funcExpr.args.map((a) => a.type),
      }).toMatchSnapshot();
    });

    it('should match array expression snapshot', () => {
      const arrayExpr = createArrayExpression([
        createLiteralExpression('us-east-1a'),
        createLiteralExpression('us-east-1b'),
        createLiteralExpression('us-east-1c'),
      ]);

      expect({
        type: arrayExpr.type,
        elementCount: arrayExpr.elements.length,
        elementTypes: arrayExpr.elements.map((e) => e.type),
      }).toMatchSnapshot();
    });
  });
});

// ============================================================================
// Evidence Snapshots
// ============================================================================

describe('Evidence Snapshots', () => {
  it('should match explicit reference evidence snapshot', () => {
    const evidence = createExplicitReferenceEvidence('aws_vpc.main -> aws_subnet.public', 95);

    const normalized = {
      type: evidence.type,
      category: evidence.category,
      confidence: evidence.confidence,
      method: evidence.method,
    };

    expect(normalized).toMatchSnapshot();
  });

  it('should match heuristic evidence snapshot', () => {
    const evidence = createEvidence({
      type: 'naming_convention',
      category: 'heuristic',
      confidence: 55,
      method: 'rule_engine',
    });

    const normalized = {
      type: evidence.type,
      category: evidence.category,
      confidence: evidence.confidence,
      method: evidence.method,
    };

    expect(normalized).toMatchSnapshot();
  });

  it('should match evidence collection snapshot', () => {
    const evidence1 = createEvidence({ type: 'explicit_reference', confidence: 95 });
    const evidence2 = createEvidence({ type: 'interpolation', confidence: 85 });
    const evidence3 = createEvidence({ type: 'naming_convention', confidence: 60 });

    const collection = createEvidenceCollection([evidence1, evidence2, evidence3]);

    const normalized = {
      itemCount: collection.items.length,
      aggregatedConfidence: collection.aggregatedConfidence,
      hasPrimaryEvidence: collection.primaryEvidence !== null,
      categoryCount: Object.keys(collection.countByCategory).length,
    };

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Graph Structure Snapshots
// ============================================================================

describe('Graph Structure Snapshots', () => {
  describe('Node Snapshots', () => {
    it('should match terraform resource node snapshot', () => {
      const node = createTerraformResourceNode({
        id: 'aws_vpc.main',
        name: 'main',
        resourceType: 'aws_vpc',
        provider: 'aws',
      });

      const normalized = {
        type: node.type,
        id: node.id,
        name: node.name,
        resourceType: node.resourceType,
        provider: node.provider,
        dependsOnCount: node.dependsOn.length,
        hasLocation: !!node.location,
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match terraform variable node snapshot', () => {
      const node = createTerraformVariableNode({
        id: 'var.environment',
        name: 'environment',
        variableType: 'string',
        default: 'production',
        sensitive: false,
        nullable: true,
      });

      const normalized = {
        type: node.type,
        id: node.id,
        name: node.name,
        sensitive: node.sensitive,
        nullable: node.nullable,
        hasLocation: !!node.location,
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match terraform module node snapshot', () => {
      const node = createTerraformModuleNode({
        id: 'module.vpc',
        name: 'vpc',
        source: 'terraform-aws-modules/vpc/aws',
        sourceType: 'registry',
        version: '3.19.0',
      });

      const normalized = {
        type: node.type,
        id: node.id,
        name: node.name,
        source: node.source,
        sourceType: node.sourceType,
        hasVersion: !!node.version,
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match terraform data node snapshot', () => {
      const node = createTerraformDataNode({
        id: 'data.aws_ami.latest',
        name: 'latest',
        dataType: 'aws_ami',
        provider: 'aws',
      });

      const normalized = {
        type: node.type,
        id: node.id,
        name: node.name,
        dataType: node.dataType,
        provider: node.provider,
      };

      expect(normalized).toMatchSnapshot();
    });
  });

  describe('Edge Snapshots', () => {
    it('should match reference edge snapshot', () => {
      const edge: GraphEdge = {
        id: 'edge-1',
        source: 'aws_subnet.public',
        target: 'aws_vpc.main',
        type: 'references',
        label: 'vpc_id',
        metadata: {
          implicit: false,
          confidence: 95,
          attribute: 'vpc_id',
        },
      };

      expect(edge).toMatchSnapshot();
    });

    it('should match module call edge snapshot', () => {
      const edge: GraphEdge = {
        id: 'edge-2',
        source: 'aws_instance.web',
        target: 'module.vpc',
        type: 'module_call',
        metadata: {
          implicit: false,
          confidence: 100,
        },
      };

      expect(edge).toMatchSnapshot();
    });

    it('should match data reference edge snapshot', () => {
      const edge: GraphEdge = {
        id: 'edge-3',
        source: 'aws_instance.web',
        target: 'data.aws_ami.latest',
        type: 'data_reference',
        label: 'ami',
        metadata: {
          implicit: false,
          confidence: 90,
          attribute: 'id',
        },
      };

      expect(edge).toMatchSnapshot();
    });
  });

  describe('Complete Graph Snapshots', () => {
    it('should match simple graph snapshot', () => {
      const builder = createGraphBuilder();

      // Add nodes
      builder.addNode(createTerraformResourceNode({ id: 'aws_vpc.main', name: 'main' }));
      builder.addNode(
        createTerraformResourceNode({
          id: 'aws_subnet.public',
          name: 'public',
          resourceType: 'aws_subnet',
        })
      );

      // Add edge
      builder.addEdge({
        id: 'e1',
        source: 'aws_subnet.public',
        target: 'aws_vpc.main',
        type: 'references',
        metadata: { implicit: false, confidence: 95 },
      });

      const graph = builder.build();

      // Normalize graph for snapshot
      const normalized = {
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
        nodeIds: Array.from(graph.nodes.keys()).sort(),
        edgeTypes: graph.edges.map((e) => e.type).sort(),
        nodeCounts: graph.metadata.nodeCounts,
      };

      expect(normalized).toMatchSnapshot();
    });

    it('should match complex graph snapshot', () => {
      const builder = createGraphBuilder();

      // Add multiple node types
      builder.addNode(createTerraformResourceNode({ id: 'aws_vpc.main', name: 'main' }));
      builder.addNode(
        createTerraformResourceNode({
          id: 'aws_subnet.public',
          name: 'public',
          resourceType: 'aws_subnet',
        })
      );
      builder.addNode(
        createTerraformResourceNode({
          id: 'aws_instance.web',
          name: 'web',
          resourceType: 'aws_instance',
        })
      );
      builder.addNode(createTerraformVariableNode({ id: 'var.env', name: 'env' }));
      builder.addNode(
        createTerraformModuleNode({
          id: 'module.rds',
          name: 'rds',
          source: 'terraform-aws-modules/rds/aws',
        })
      );
      builder.addNode(
        createTerraformDataNode({
          id: 'data.aws_ami.latest',
          name: 'latest',
          dataType: 'aws_ami',
        })
      );

      // Add edges
      builder.addEdge({
        id: 'e1',
        source: 'aws_subnet.public',
        target: 'aws_vpc.main',
        type: 'references',
        metadata: { implicit: false, confidence: 95 },
      });
      builder.addEdge({
        id: 'e2',
        source: 'aws_instance.web',
        target: 'aws_subnet.public',
        type: 'references',
        metadata: { implicit: false, confidence: 95 },
      });
      builder.addEdge({
        id: 'e3',
        source: 'aws_instance.web',
        target: 'var.env',
        type: 'input_variable',
        metadata: { implicit: false, confidence: 100 },
      });
      builder.addEdge({
        id: 'e4',
        source: 'aws_instance.web',
        target: 'data.aws_ami.latest',
        type: 'data_reference',
        metadata: { implicit: false, confidence: 90 },
      });

      const graph = builder.build();

      const normalized = {
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
        nodeIds: Array.from(graph.nodes.keys()).sort(),
        edgeTypes: graph.edges.map((e) => e.type).sort(),
        nodeCounts: graph.metadata.nodeCounts,
        edgeCounts: graph.metadata.edgeCounts,
      };

      expect(normalized).toMatchSnapshot();
    });
  });
});

// ============================================================================
// API Response Snapshots
// ============================================================================

describe('API Response Snapshots', () => {
  it('should match scan response structure snapshot', () => {
    const response = {
      id: 'scan-uuid',
      repositoryId: 'repo-uuid',
      status: 'completed',
      ref: 'main',
      commitSha: 'abc123',
      config: {
        detectTypes: ['terraform'],
        includeImplicit: true,
        minConfidence: 60,
        maxDepth: 10,
      },
      resultSummary: {
        totalNodes: 25,
        totalEdges: 30,
        filesAnalyzed: 10,
        errorCount: 0,
        warningCount: 2,
      },
    };

    // Normalize - remove variable data
    const normalized = {
      hasId: !!response.id,
      hasRepositoryId: !!response.repositoryId,
      status: response.status,
      configKeys: Object.keys(response.config).sort(),
      summaryKeys: Object.keys(response.resultSummary).sort(),
    };

    expect(normalized).toMatchSnapshot();
  });

  it('should match graph query response structure snapshot', () => {
    const response = {
      scanId: 'scan-uuid',
      nodes: [
        {
          id: 'aws_vpc.main',
          type: 'terraform_resource',
          name: 'main',
          location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'aws_vpc.main',
          target: 'aws_subnet.public',
          type: 'references',
          confidence: 95,
          isImplicit: false,
        },
      ],
      stats: {
        totalNodes: 1,
        totalEdges: 1,
        nodesByType: { terraform_resource: 1 },
        edgesByType: { references: 1 },
      },
    };

    const normalized = {
      hasScanId: !!response.scanId,
      nodeCount: response.nodes.length,
      edgeCount: response.edges.length,
      statsKeys: Object.keys(response.stats).sort(),
      firstNodeKeys: Object.keys(response.nodes[0]).sort(),
      firstEdgeKeys: Object.keys(response.edges[0]).sort(),
    };

    expect(normalized).toMatchSnapshot();
  });

  it('should match error response structure snapshot', () => {
    const errorResponse = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid repository ID format',
      code: 'VALIDATION_ERROR',
      details: {
        field: 'repositoryId',
        expected: 'UUID format',
        received: 'invalid-id',
      },
    };

    const normalized = {
      statusCode: errorResponse.statusCode,
      hasError: !!errorResponse.error,
      hasMessage: !!errorResponse.message,
      hasCode: !!errorResponse.code,
      hasDetails: !!errorResponse.details,
    };

    expect(normalized).toMatchSnapshot();
  });

  it('should match webhook payload structure snapshot', () => {
    const webhookPayload = {
      eventId: 'event-uuid',
      eventType: 'scan.completed',
      tenantId: 'tenant-uuid',
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        scanId: 'scan-uuid',
        repositoryId: 'repo-uuid',
        summary: {
          totalNodes: 25,
          totalEdges: 30,
        },
      },
    };

    const normalized = {
      hasEventId: !!webhookPayload.eventId,
      eventType: webhookPayload.eventType,
      version: webhookPayload.version,
      dataKeys: Object.keys(webhookPayload.data).sort(),
    };

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Configuration Snapshots
// ============================================================================

describe('Configuration Snapshots', () => {
  it('should match default scan config snapshot', () => {
    const defaultConfig = {
      detectTypes: ['terraform', 'kubernetes', 'helm'],
      includeImplicit: true,
      minConfidence: 60,
      maxDepth: 10,
      includePatterns: ['**/*.tf', '**/*.yaml', '**/*.yml'],
      excludePatterns: ['**/test/**', '**/tests/**', '**/node_modules/**'],
      analyzeHelmCharts: true,
      resolveRemoteModules: false,
    };

    expect(defaultConfig).toMatchSnapshot();
  });

  it('should match scoring rule config snapshot', () => {
    const scoringRules = {
      explicitReferenceBase: 90,
      interpolationBase: 80,
      heuristicBase: 50,
      multipleEvidenceBonus: 10,
      explicitDeclarationBonus: 5,
      heuristicOnlyPenalty: -15,
      minScore: 0,
      maxScore: 100,
    };

    expect(scoringRules).toMatchSnapshot();
  });
});
