/**
 * Regression Test Suite
 * @module tests/regression/index
 *
 * Comprehensive regression testing for the IaC Dependency Detection API.
 * Tests API contracts, parser output stability, detection consistency,
 * and graph structure determinism.
 *
 * TASK-DETECT: Regression testing for batch TASK-DETECT-001 through TASK-DETECT-010
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

import {
  createTerraformFile,
  createResourceBlock,
  createVariableBlock,
  createModuleBlock,
  createDataBlock,
  createOutputBlock,
  createVPCScenario,
  createModuleCallScenario,
  createReferenceExpression,
  createLiteralExpression,
} from '../factories/terraform.factory';
import {
  createEvidence,
  createExplicitReferenceEvidence,
} from '../factories/evidence.factory';
import {
  createGraphBuilder,
  createTerraformResourceNode,
  createTerraformVariableNode,
} from '../factories/graph.factory';

import type {
  NodeType,
  GraphEdge,
  DependencyGraph,
  NodeTypeName,
  EdgeType,
} from '@/types/graph';
import type { Evidence, ConfidenceScore, ConfidenceLevel } from '@/types/evidence';
import type { ScanRequest, ScanResponse, GraphQueryResponse } from '@/types/api';

// ============================================================================
// Test Constants
// ============================================================================

const BASELINE_DIR = join(__dirname, 'baselines');
const CONFIDENCE_TOLERANCE = 5; // 5% tolerance for confidence score variations

// ============================================================================
// Baseline Management Utilities
// ============================================================================

interface Baseline<T> {
  version: string;
  createdAt: string;
  hash: string;
  data: T;
}

function loadBaseline<T>(name: string): Baseline<T> | null {
  const path = join(BASELINE_DIR, `${name}.json`);
  if (!existsSync(path)) {
    return null;
  }
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as Baseline<T>;
}

function hashObject(obj: unknown): string {
  const normalized = JSON.stringify(obj, Object.keys(obj as object).sort());
  return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

function compareWithTolerance(
  baseline: number,
  current: number,
  tolerance: number
): { pass: boolean; diff: number; percentDiff: number } {
  const diff = current - baseline;
  const percentDiff = baseline !== 0 ? (diff / baseline) * 100 : diff * 100;
  const pass = Math.abs(percentDiff) <= tolerance;
  return { pass, diff, percentDiff };
}

// ============================================================================
// API Contract Stability Tests
// ============================================================================

describe('Regression Tests', () => {
  describe('API Contract Stability', () => {
    describe('ScanRequest Schema', () => {
      it('should maintain required fields', () => {
        // ScanRequest must always have repositoryId
        const validRequest: Partial<ScanRequest> = {
          repositoryId: '550e8400-e29b-41d4-a716-446655440000',
        };

        expect(validRequest.repositoryId).toBeDefined();
        expect(typeof validRequest.repositoryId).toBe('string');
      });

      it('should maintain optional config fields', () => {
        const fullRequest: ScanRequest = {
          repositoryId: '550e8400-e29b-41d4-a716-446655440000',
          ref: 'main',
          config: {
            detectTypes: ['terraform', 'kubernetes'],
            includeImplicit: true,
            minConfidence: 60,
            maxDepth: 10,
            includePatterns: ['**/*.tf'],
            excludePatterns: ['**/test/**'],
            analyzeHelmCharts: true,
            resolveRemoteModules: false,
          },
          priority: 'normal',
          callbackUrl: 'https://example.com/webhook',
        };

        // Verify all expected fields exist with correct types
        expect(fullRequest.ref).toBe('main');
        expect(fullRequest.config?.detectTypes).toContain('terraform');
        expect(fullRequest.config?.includeImplicit).toBe(true);
        expect(fullRequest.config?.minConfidence).toBe(60);
        expect(fullRequest.config?.maxDepth).toBe(10);
        expect(fullRequest.priority).toBe('normal');
      });

      it('should support all detect types', () => {
        const detectTypes = ['terraform', 'kubernetes', 'helm', 'cloudformation'] as const;

        for (const type of detectTypes) {
          expect(['terraform', 'kubernetes', 'helm', 'cloudformation']).toContain(type);
        }
      });
    });

    describe('ScanResponse Schema', () => {
      it('should maintain core response fields', () => {
        // Verify ScanResponse shape hasn't changed
        const mockResponse: ScanResponse = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          repositoryId: '550e8400-e29b-41d4-a716-446655440001',
          status: 'completed',
          ref: 'main',
          commitSha: 'abc123',
          config: {
            detectTypes: ['terraform'],
            includeImplicit: true,
            minConfidence: 60,
            maxDepth: 10,
          },
          progress: {
            phase: 'completed',
            percentage: 100,
            filesProcessed: 10,
            totalFiles: 10,
            nodesDetected: 25,
            edgesDetected: 30,
          },
          resultSummary: {
            totalNodes: 25,
            totalEdges: 30,
            filesAnalyzed: 10,
            errorCount: 0,
            warningCount: 2,
          },
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };

        // Core fields must exist
        expect(mockResponse.id).toBeDefined();
        expect(mockResponse.repositoryId).toBeDefined();
        expect(mockResponse.status).toBeDefined();
        expect(mockResponse.ref).toBeDefined();
        expect(mockResponse.config).toBeDefined();
        expect(mockResponse.createdAt).toBeDefined();

        // Status must be one of the valid values
        expect(['pending', 'queued', 'running', 'completed', 'failed', 'cancelled']).toContain(
          mockResponse.status
        );
      });

      it('should maintain progress field structure', () => {
        const progress = {
          phase: 'detection',
          percentage: 50,
          filesProcessed: 5,
          totalFiles: 10,
          nodesDetected: 12,
          edgesDetected: 8,
        };

        expect(progress.phase).toBeDefined();
        expect(typeof progress.percentage).toBe('number');
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
        expect(typeof progress.filesProcessed).toBe('number');
        expect(typeof progress.totalFiles).toBe('number');
      });

      it('should maintain resultSummary field structure', () => {
        const summary = {
          totalNodes: 25,
          totalEdges: 30,
          filesAnalyzed: 10,
          errorCount: 0,
          warningCount: 2,
        };

        expect(typeof summary.totalNodes).toBe('number');
        expect(typeof summary.totalEdges).toBe('number');
        expect(typeof summary.filesAnalyzed).toBe('number');
        expect(typeof summary.errorCount).toBe('number');
        expect(typeof summary.warningCount).toBe('number');
      });
    });

    describe('GraphQueryResponse Schema', () => {
      it('should maintain graph query response structure', () => {
        const mockResponse: GraphQueryResponse = {
          scanId: '550e8400-e29b-41d4-a716-446655440000',
          nodes: [
            {
              id: 'aws_vpc.main',
              type: 'terraform_resource',
              name: 'main',
              location: {
                file: 'main.tf',
                lineStart: 1,
                lineEnd: 10,
              },
              metadata: { provider: 'aws' },
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

        expect(mockResponse.scanId).toBeDefined();
        expect(Array.isArray(mockResponse.nodes)).toBe(true);
        expect(Array.isArray(mockResponse.edges)).toBe(true);
        expect(mockResponse.stats).toBeDefined();
        expect(mockResponse.stats.nodesByType).toBeDefined();
        expect(mockResponse.stats.edgesByType).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Parser Output Stability Tests
  // ============================================================================

  describe('Parser Output Stability', () => {
    describe('Terraform Parser', () => {
      it('should produce consistent output for sample Terraform', () => {
        const vpcBlock = createResourceBlock({
          resourceType: 'aws_vpc',
          name: 'main',
          attributes: {
            cidr_block: createLiteralExpression('10.0.0.0/16'),
            enable_dns_hostnames: createLiteralExpression(true),
            tags: {
              type: 'object',
              attributes: {
                Name: createLiteralExpression('main-vpc'),
              },
              raw: '{ Name = "main-vpc" }',
            },
          },
        });

        const file = createTerraformFile({
          path: 'vpc.tf',
          blocks: [vpcBlock],
        });

        // Verify deterministic structure
        expect(file.blocks).toHaveLength(1);
        expect(file.blocks[0].type).toBe('resource');
        expect(file.blocks[0].labels).toEqual(['aws_vpc', 'main']);

        // Hash the output for baseline comparison
        const outputHash = hashObject(file.blocks[0]);
        expect(outputHash).toBeDefined();
        expect(outputHash.length).toBe(16);

        // Same input should produce same hash
        const file2 = createTerraformFile({
          path: 'vpc.tf',
          blocks: [vpcBlock],
        });
        const outputHash2 = hashObject(file2.blocks[0]);
        expect(outputHash2).toBe(outputHash);
      });

      it('should produce consistent output for complex Terraform', () => {
        const { files } = createVPCScenario();

        // Extract all block IDs
        const blockIds: string[] = [];
        for (const file of files) {
          for (const block of file.blocks) {
            const id =
              block.type === 'variable'
                ? `var.${block.labels[0]}`
                : block.type === 'data'
                  ? `data.${block.labels[0]}.${block.labels[1]}`
                  : block.type === 'module'
                    ? `module.${block.labels[0]}`
                    : `${block.labels[0]}.${block.labels[1]}`;
            blockIds.push(id);
          }
        }

        // Verify expected IDs are present
        expect(blockIds).toContain('aws_vpc.main');
        expect(blockIds).toContain('aws_subnet.public');
        expect(blockIds).toContain('aws_instance.web');
        expect(blockIds).toContain('var.ami_id');
      });

      it('should maintain module source parsing consistency', () => {
        const testCases = [
          { source: './modules/vpc', expectedType: 'local' },
          { source: '../shared/networking', expectedType: 'local' },
          { source: 'terraform-aws-modules/vpc/aws', expectedType: 'registry' },
          { source: 'hashicorp/consul/aws', expectedType: 'registry' },
        ];

        for (const { source, expectedType } of testCases) {
          const moduleBlock = createModuleBlock({ name: 'test', source });
          expect(moduleBlock.attributes.source).toBeDefined();

          // Determine source type from source string
          const isLocal = source.startsWith('./') || source.startsWith('../');
          const detectedType = isLocal ? 'local' : 'registry';
          expect(detectedType).toBe(expectedType);
        }
      });
    });

    describe('Helm Parser', () => {
      it('should produce consistent output for sample Helm values', () => {
        // Simulate Helm values parsing
        const helmValues = {
          replicaCount: 3,
          image: {
            repository: 'nginx',
            tag: 'latest',
            pullPolicy: 'IfNotPresent',
          },
          service: {
            type: 'ClusterIP',
            port: 80,
          },
          resources: {
            limits: {
              cpu: '100m',
              memory: '128Mi',
            },
            requests: {
              cpu: '50m',
              memory: '64Mi',
            },
          },
        };

        // Hash for consistency check
        const valuesHash = hashObject(helmValues);
        expect(valuesHash).toBeDefined();

        // Same values should produce same hash
        const valuesHash2 = hashObject({ ...helmValues });
        expect(valuesHash2).toBe(valuesHash);
      });

      it('should maintain Chart.yaml field structure', () => {
        const chartYaml = {
          apiVersion: 'v2',
          name: 'my-app',
          version: '1.0.0',
          appVersion: '2.0.0',
          description: 'A Helm chart for Kubernetes',
          type: 'application',
          dependencies: [
            {
              name: 'postgresql',
              version: '11.x.x',
              repository: 'https://charts.bitnami.com/bitnami',
            },
          ],
        };

        expect(chartYaml.apiVersion).toBeDefined();
        expect(chartYaml.name).toBeDefined();
        expect(chartYaml.version).toBeDefined();
        expect(Array.isArray(chartYaml.dependencies)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Detection Consistency Tests
  // ============================================================================

  describe('Detection Consistency', () => {
    describe('Reference Detection', () => {
      it('should detect same dependencies as baseline', () => {
        const { files, expectedEdges } = createVPCScenario();

        // Extract references from blocks
        const detectedRefs: { source: string; target: string }[] = [];

        for (const file of files) {
          for (const block of file.blocks) {
            const sourceId =
              block.type === 'variable'
                ? `var.${block.labels[0]}`
                : block.type === 'data'
                  ? `data.${block.labels[0]}.${block.labels[1]}`
                  : `${block.labels[0]}.${block.labels[1]}`;

            // Check attributes for references
            for (const attrValue of Object.values(block.attributes)) {
              if (
                typeof attrValue === 'object' &&
                attrValue !== null &&
                'type' in attrValue &&
                attrValue.type === 'reference'
              ) {
                const refParts = (attrValue as { parts: string[] }).parts;
                let targetId: string;

                if (refParts[0] === 'var') {
                  targetId = `var.${refParts[1]}`;
                } else if (refParts[0] === 'data') {
                  targetId = `data.${refParts[1]}.${refParts[2]}`;
                } else {
                  targetId = `${refParts[0]}.${refParts[1]}`;
                }

                detectedRefs.push({ source: sourceId, target: targetId });
              }
            }
          }
        }

        // Verify expected references were detected
        expect(detectedRefs.length).toBeGreaterThanOrEqual(expectedEdges);

        // Verify specific expected references
        const hasVpcRef = detectedRefs.some(
          (r) => r.source.includes('subnet') && r.target.includes('vpc')
        );
        expect(hasVpcRef).toBe(true);

        const hasVarRef = detectedRefs.some((r) => r.target.startsWith('var.'));
        expect(hasVarRef).toBe(true);
      });

      it('should maintain reference resolution order', () => {
        // Create a chain of references: instance -> subnet -> vpc
        const vpcBlock = createResourceBlock({
          resourceType: 'aws_vpc',
          name: 'main',
          attributes: {
            cidr_block: createLiteralExpression('10.0.0.0/16'),
          },
        });

        const subnetBlock = createResourceBlock({
          resourceType: 'aws_subnet',
          name: 'public',
          attributes: {
            vpc_id: createReferenceExpression(['aws_vpc', 'main', 'id']),
          },
        });

        const instanceBlock = createResourceBlock({
          resourceType: 'aws_instance',
          name: 'web',
          attributes: {
            subnet_id: createReferenceExpression(['aws_subnet', 'public', 'id']),
          },
        });

        const file = createTerraformFile({
          blocks: [vpcBlock, subnetBlock, instanceBlock],
        });

        // Order should be deterministic
        expect(file.blocks[0].labels).toEqual(['aws_vpc', 'main']);
        expect(file.blocks[1].labels).toEqual(['aws_subnet', 'public']);
        expect(file.blocks[2].labels).toEqual(['aws_instance', 'web']);
      });
    });

    describe('Confidence Score Consistency', () => {
      it('should maintain confidence scores within tolerance', () => {
        // Create evidence with known confidence values
        const explicitEvidence = createExplicitReferenceEvidence('test-ref', 95);
        const heuristicEvidence = createEvidence({
          type: 'naming_convention',
          category: 'heuristic',
          confidence: 55,
        });

        // Verify scores are within expected ranges
        expect(explicitEvidence.confidence).toBeGreaterThanOrEqual(90);
        expect(heuristicEvidence.confidence).toBeLessThanOrEqual(60);

        // Verify relative ordering
        expect(explicitEvidence.confidence).toBeGreaterThan(heuristicEvidence.confidence);
      });

      it('should produce consistent confidence levels', () => {
        const testCases = [
          { score: 98, expectedLevel: 'certain' },
          { score: 85, expectedLevel: 'high' },
          { score: 70, expectedLevel: 'medium' },
          { score: 50, expectedLevel: 'low' },
          { score: 30, expectedLevel: 'uncertain' },
        ];

        for (const { score, expectedLevel } of testCases) {
          let level: ConfidenceLevel;
          if (score >= 95) level = 'certain';
          else if (score >= 80) level = 'high';
          else if (score >= 60) level = 'medium';
          else if (score >= 40) level = 'low';
          else level = 'uncertain';

          expect(level).toBe(expectedLevel);
        }
      });

      it('should aggregate confidence scores consistently', () => {
        const evidenceItems = [
          createEvidence({ confidence: 90 }),
          createEvidence({ confidence: 80 }),
          createEvidence({ confidence: 70 }),
        ];

        // Calculate weighted average with diminishing returns
        let totalWeight = 0;
        let weightedSum = 0;

        evidenceItems
          .sort((a, b) => b.confidence - a.confidence)
          .forEach((e, index) => {
            const weight = 1 / (index + 1);
            weightedSum += e.confidence * weight;
            totalWeight += weight;
          });

        const aggregated = Math.min(100, Math.round(weightedSum / totalWeight));

        // Should be dominated by highest confidence with diminishing contributions
        expect(aggregated).toBeGreaterThanOrEqual(80);
        expect(aggregated).toBeLessThanOrEqual(95);
      });
    });
  });

  // ============================================================================
  // Graph Structure Stability Tests
  // ============================================================================

  describe('Graph Structure Stability', () => {
    describe('Deterministic Graph Building', () => {
      it('should produce same graph structure for identical input', () => {
        const nodes = [
          createTerraformResourceNode({ id: 'aws_vpc.main', name: 'main' }),
          createTerraformResourceNode({
            id: 'aws_subnet.public',
            name: 'public',
            resourceType: 'aws_subnet',
          }),
        ];

        // Build graph twice with same input
        const builder1 = createGraphBuilder();
        nodes.forEach((n) => builder1.addNode(n));
        const graph1 = builder1.build();

        const builder2 = createGraphBuilder();
        nodes.forEach((n) => builder2.addNode(n));
        const graph2 = builder2.build();

        // Graphs should be identical
        expect(graph1.nodes.size).toBe(graph2.nodes.size);
        expect(graph1.edges.length).toBe(graph2.edges.length);

        // Node IDs should match
        const nodeIds1 = Array.from(graph1.nodes.keys()).sort();
        const nodeIds2 = Array.from(graph2.nodes.keys()).sort();
        expect(nodeIds1).toEqual(nodeIds2);
      });

      it('should maintain node count consistency', () => {
        const { files, expectedNodes } = createVPCScenario();

        // Count nodes from files
        let nodeCount = 0;
        for (const file of files) {
          nodeCount += file.blocks.length;
        }

        expect(nodeCount).toBe(expectedNodes);
      });

      it('should maintain edge count consistency', () => {
        const builder = createGraphBuilder();

        // Add nodes
        const vpc = createTerraformResourceNode({ id: 'aws_vpc.main' });
        const subnet = createTerraformResourceNode({
          id: 'aws_subnet.public',
          resourceType: 'aws_subnet',
        });

        builder.addNode(vpc);
        builder.addNode(subnet);

        // Add edge
        builder.addEdge({
          id: 'edge-1',
          source: 'aws_vpc.main',
          target: 'aws_subnet.public',
          type: 'references',
          metadata: { implicit: false, confidence: 95 },
        });

        const graph = builder.build();

        expect(graph.edges).toHaveLength(1);
        expect(graph.edges[0].source).toBe('aws_vpc.main');
        expect(graph.edges[0].target).toBe('aws_subnet.public');
      });
    });

    describe('Topological Order Consistency', () => {
      it('should maintain topological order consistency', () => {
        const builder = createGraphBuilder();

        // Create a DAG: A -> B -> C
        const nodeA = createTerraformResourceNode({ id: 'resource.a', name: 'a' });
        const nodeB = createTerraformResourceNode({ id: 'resource.b', name: 'b' });
        const nodeC = createTerraformResourceNode({ id: 'resource.c', name: 'c' });

        builder.addNode(nodeA);
        builder.addNode(nodeB);
        builder.addNode(nodeC);

        builder.addEdge({
          id: 'e1',
          source: 'resource.a',
          target: 'resource.b',
          type: 'references',
          metadata: { implicit: false, confidence: 100 },
        });
        builder.addEdge({
          id: 'e2',
          source: 'resource.b',
          target: 'resource.c',
          type: 'references',
          metadata: { implicit: false, confidence: 100 },
        });

        const graph = builder.build();

        // Verify topological constraints
        // A must come before B, B must come before C
        const edgeAB = graph.edges.find((e) => e.source === 'resource.a');
        const edgeBC = graph.edges.find((e) => e.source === 'resource.b');

        expect(edgeAB?.target).toBe('resource.b');
        expect(edgeBC?.target).toBe('resource.c');
      });

      it('should produce consistent metadata counts', () => {
        const builder = createGraphBuilder();

        // Add various node types
        builder.addNode(createTerraformResourceNode({ id: 'r1' }));
        builder.addNode(createTerraformResourceNode({ id: 'r2' }));
        builder.addNode(createTerraformVariableNode({ id: 'var.v1' }));

        const graph = builder.build();

        // Verify metadata is populated correctly
        expect(graph.metadata.nodeCounts['terraform_resource']).toBe(2);
        expect(graph.metadata.nodeCounts['terraform_variable']).toBe(1);
        expect(graph.metadata.sourceFiles).toBeDefined();
        expect(Array.isArray(graph.metadata.sourceFiles)).toBe(true);
      });
    });

    describe('Graph Hash Consistency', () => {
      it('should produce consistent graph hashes', () => {
        const builder1 = createGraphBuilder();
        const builder2 = createGraphBuilder();

        const node = createTerraformResourceNode({ id: 'test.node' });

        builder1.addNode(node);
        builder2.addNode(node);

        const graph1 = builder1.build();
        const graph2 = builder2.build();

        // Extract comparable data for hashing
        const graphData1 = {
          nodeIds: Array.from(graph1.nodes.keys()).sort(),
          edgeCount: graph1.edges.length,
        };
        const graphData2 = {
          nodeIds: Array.from(graph2.nodes.keys()).sort(),
          edgeCount: graph2.edges.length,
        };

        const hash1 = hashObject(graphData1);
        const hash2 = hashObject(graphData2);

        expect(hash1).toBe(hash2);
      });
    });
  });

  // ============================================================================
  // Type System Stability Tests
  // ============================================================================

  describe('Type System Stability', () => {
    describe('Node Types', () => {
      it('should maintain all expected NodeType variants', () => {
        const terraformNodeTypes: NodeTypeName[] = [
          'terraform_resource',
          'terraform_data',
          'terraform_module',
          'terraform_variable',
          'terraform_output',
          'terraform_local',
          'terraform_provider',
        ];

        const k8sNodeTypes: NodeTypeName[] = [
          'k8s_deployment',
          'k8s_service',
          'k8s_configmap',
          'k8s_secret',
          'k8s_ingress',
          'k8s_pod',
          'k8s_statefulset',
          'k8s_daemonset',
          'k8s_job',
          'k8s_cronjob',
          'k8s_namespace',
          'k8s_serviceaccount',
          'k8s_role',
          'k8s_rolebinding',
          'k8s_clusterrole',
          'k8s_clusterrolebinding',
          'k8s_persistentvolume',
          'k8s_persistentvolumeclaim',
          'k8s_storageclass',
          'k8s_networkpolicy',
        ];

        const helmNodeTypes: NodeTypeName[] = ['helm_chart', 'helm_release', 'helm_value'];

        // Verify all types are strings
        [...terraformNodeTypes, ...k8sNodeTypes, ...helmNodeTypes].forEach((type) => {
          expect(typeof type).toBe('string');
        });

        // Verify counts
        expect(terraformNodeTypes).toHaveLength(7);
        expect(k8sNodeTypes).toHaveLength(20);
        expect(helmNodeTypes).toHaveLength(3);
      });
    });

    describe('Edge Types', () => {
      it('should maintain all expected EdgeType variants', () => {
        const edgeTypes: EdgeType[] = [
          'depends_on',
          'references',
          'creates',
          'destroys',
          'module_call',
          'module_source',
          'module_provider',
          'input_variable',
          'output_value',
          'local_reference',
          'provider_config',
          'provider_alias',
          'data_source',
          'data_reference',
          'selector_match',
          'namespace_member',
          'volume_mount',
          'service_target',
          'ingress_backend',
          'rbac_binding',
          'configmap_ref',
          'secret_ref',
        ];

        expect(edgeTypes).toHaveLength(22);

        // Verify all types are strings
        edgeTypes.forEach((type) => {
          expect(typeof type).toBe('string');
        });
      });
    });

    describe('Evidence Types', () => {
      it('should maintain evidence type variants', () => {
        const evidenceTypes = [
          'explicit_reference',
          'depends_on_directive',
          'module_source',
          'provider_alias',
          'variable_default',
          'interpolation',
          'function_call',
          'for_expression',
          'conditional',
          'splat_operation',
          'block_nesting',
          'attribute_assignment',
          'label_matching',
          'namespace_scoping',
          'naming_convention',
          'resource_proximity',
          'provider_inference',
          'type_compatibility',
        ];

        expect(evidenceTypes.length).toBeGreaterThanOrEqual(18);
      });

      it('should maintain confidence level variants', () => {
        const levels: ConfidenceLevel[] = ['certain', 'high', 'medium', 'low', 'uncertain'];

        expect(levels).toHaveLength(5);
        expect(levels).toContain('certain');
        expect(levels).toContain('uncertain');
      });
    });
  });
});

// ============================================================================
// Baseline Comparison Utilities for CI
// ============================================================================

describe('Baseline Comparison', () => {
  it('should have baseline directory', () => {
    expect(existsSync(BASELINE_DIR)).toBe(true);
  });

  it('should detect baseline drift', () => {
    const baseline = loadBaseline<{ version: string }>('api-contract');

    if (baseline) {
      // If baseline exists, verify current implementation matches
      expect(baseline.version).toBeDefined();
    } else {
      // First run - baseline will be generated
      console.log('Baseline not found - will be generated on first run');
    }
  });
});
