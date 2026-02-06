/**
 * E2E Regression Test Suite
 * @module e2e/tests/regression/regression.spec
 *
 * End-to-end regression tests for the Code Reviewer platform.
 * Tests API stability, parser output consistency, graph structure
 * determinism, and performance regression detection.
 *
 * TASK-DETECT: Regression testing for dependency detection pipeline
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'crypto';
import {
  E2ETestContext,
  createTestAppBuilder,
} from '../../support/test-context.js';
import {
  generateGraphNodeFixtures,
  generateGraphEdgeFixtures,
  generateTerraformFixtureContent,
} from '../../support/fixtures.js';
import {
  assertGraph,
  createGraphStructure,
} from '../../support/assertions.js';
import {
  createApiClient,
  TestApiClient,
} from '../../support/api-client.js';
import type { TenantId } from '../../../api/src/types/entities.js';

// ============================================================================
// Baseline Types
// ============================================================================

interface BaselineEntry {
  version: string;
  createdAt: string;
  hash: string;
  data: unknown;
}

interface RegressionResult {
  testName: string;
  status: 'passed' | 'regressed' | 'improved' | 'new';
  baselineHash?: string;
  currentHash?: string;
  diff?: string;
}

interface PerformanceBaseline {
  metricName: string;
  baselineValue: number;
  currentValue: number;
  percentChange: number;
  threshold: number;
  status: 'within_tolerance' | 'regressed' | 'improved';
}

// ============================================================================
// Utility Functions
// ============================================================================

function hashObject(obj: unknown): string {
  const normalized = JSON.stringify(obj, Object.keys(obj as object).sort());
  return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

function compareWithTolerance(
  baseline: number,
  current: number,
  tolerancePercent: number
): PerformanceBaseline['status'] {
  const percentChange = baseline !== 0 ? ((current - baseline) / baseline) * 100 : 0;

  if (percentChange > tolerancePercent) {
    return 'regressed';
  } else if (percentChange < -tolerancePercent) {
    return 'improved';
  }
  return 'within_tolerance';
}

// ============================================================================
// Test Suite
// ============================================================================

describe('E2E Regression Tests', () => {
  let ctx: E2ETestContext;
  let apiClient: TestApiClient;
  let testTenantId: TenantId;

  beforeAll(async () => {
    ctx = createTestAppBuilder()
      .withTimeout(60000)
      .withMocking(true)
      .build();

    await ctx.setup();

    testTenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
    apiClient = createApiClient(ctx.getApp(), testTenantId);
    apiClient.setAuth(ctx.createAuthContext({ tenantId: testTenantId }));
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  // ==========================================================================
  // API Response Stability
  // ==========================================================================

  describe('API Response Stability', () => {
    describe('Health Endpoint Regression', () => {
      it('should maintain health response structure', async () => {
        const response = await apiClient.getHealth();

        // Core fields must exist (contract stability)
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('uptime');

        // Status must be valid enum value
        expect(['healthy', 'unhealthy', 'degraded']).toContain(response.body.status);

        // Uptime must be numeric and non-negative
        expect(typeof response.body.uptime).toBe('number');
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      });

      it('should maintain detailed health response structure', async () => {
        const response = await apiClient.getDetailedHealth();

        // Accept both ready and not-ready states
        expect([200, 503]).toContain(response.statusCode);

        // Structure must be maintained regardless of status
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('checks');

        // Checks structure
        if (response.body.checks) {
          expect(response.body.checks).toHaveProperty('database');
          expect(response.body.checks).toHaveProperty('memory');
        }
      });
    });

    describe('Error Response Regression', () => {
      it('should maintain 404 error response structure', async () => {
        const response = await apiClient.getScan(
          '00000000-0000-0000-0000-000000000999' as any
        );

        expect(response.statusCode).toBe(404);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');

        // Error field should indicate not found
        expect(response.body.error).toContain('Not Found');
      });

      it('should maintain error response fields across all error types', async () => {
        const response = await apiClient.createScan({
          // Invalid repository ID to trigger validation error
          repositoryId: 'invalid-uuid-format' as any,
        });

        // Should return 400 or 404 depending on validation order
        expect([400, 404]).toContain(response.statusCode);

        if (response.statusCode === 400) {
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('message');
        }
      });
    });
  });

  // ==========================================================================
  // Parser Output Consistency
  // ==========================================================================

  describe('Parser Output Consistency', () => {
    describe('Terraform Fixture Generation', () => {
      it('should produce deterministic fixture content', () => {
        // Generate fixtures twice
        const content1 = generateTerraformFixtureContent();
        const content2 = generateTerraformFixtureContent();

        // Same files should be generated
        expect(content1.size).toBe(content2.size);

        // File names should match
        const files1 = Array.from(content1.keys()).sort();
        const files2 = Array.from(content2.keys()).sort();
        expect(files1).toEqual(files2);

        // Content should be identical
        for (const file of files1) {
          expect(content1.get(file)).toBe(content2.get(file));
        }
      });

      it('should maintain expected Terraform block types', () => {
        const content = generateTerraformFixtureContent();
        const mainTf = content.get('main.tf');

        expect(mainTf).toBeDefined();

        // Expected resource types
        expect(mainTf).toContain('resource "aws_s3_bucket"');
        expect(mainTf).toContain('resource "aws_iam_role"');
        expect(mainTf).toContain('resource "aws_lambda_function"');

        // Variable file checks
        const variablesTf = content.get('variables.tf');
        expect(variablesTf).toBeDefined();
        expect(variablesTf).toContain('variable "');

        // Output file checks
        const outputsTf = content.get('outputs.tf');
        expect(outputsTf).toBeDefined();
        expect(outputsTf).toContain('output "');
      });

      it('should maintain cross-resource reference patterns', () => {
        const content = generateTerraformFixtureContent();
        const mainTf = content.get('main.tf');

        // Reference patterns that must be preserved
        expect(mainTf).toContain('aws_s3_bucket.main');
        expect(mainTf).toContain('aws_iam_role.lambda_role');
      });
    });

    describe('Graph Node Generation', () => {
      it('should produce consistent node IDs', () => {
        const nodes1 = generateGraphNodeFixtures(10);
        const nodes2 = generateGraphNodeFixtures(10);

        // Node IDs should follow pattern
        for (let i = 0; i < 10; i++) {
          expect(nodes1[i].id).toMatch(/^node_\d{3}$/);
          expect(nodes2[i].id).toMatch(/^node_\d{3}$/);
        }
      });

      it('should maintain node type distribution', () => {
        const nodes = generateGraphNodeFixtures(30);

        const typeCount = {
          tf_resource: 0,
          tf_variable: 0,
          tf_output: 0,
        };

        for (const node of nodes) {
          if (node.type in typeCount) {
            typeCount[node.type as keyof typeof typeCount]++;
          }
        }

        // Should have roughly equal distribution
        const expectedPerType = 10;
        const tolerance = 3;

        expect(typeCount.tf_resource).toBeGreaterThanOrEqual(expectedPerType - tolerance);
        expect(typeCount.tf_variable).toBeGreaterThanOrEqual(expectedPerType - tolerance);
        expect(typeCount.tf_output).toBeGreaterThanOrEqual(expectedPerType - tolerance);
      });

      it('should include required node fields', () => {
        const nodes = generateGraphNodeFixtures(5);

        for (const node of nodes) {
          expect(node).toHaveProperty('id');
          expect(node).toHaveProperty('type');
          expect(node).toHaveProperty('name');
          expect(node).toHaveProperty('filePath');
          expect(node).toHaveProperty('lineStart');
          expect(node).toHaveProperty('lineEnd');
        }
      });
    });
  });

  // ==========================================================================
  // Graph Structure Determinism
  // ==========================================================================

  describe('Graph Structure Determinism', () => {
    describe('Graph Construction', () => {
      it('should produce deterministic graph for same input', () => {
        const nodes = generateGraphNodeFixtures(10);
        const edges = generateGraphEdgeFixtures(nodes, 0.3);

        // Build graph twice
        const graph1 = createGraphStructure(nodes, edges);
        const graph2 = createGraphStructure(nodes, edges);

        // Node counts should match
        expect(graph1.nodes.length).toBe(graph2.nodes.length);

        // Edge counts should match
        expect(graph1.edges.length).toBe(graph2.edges.length);

        // Node IDs should be in same order
        const ids1 = graph1.nodes.map((n: any) => n.id);
        const ids2 = graph2.nodes.map((n: any) => n.id);
        expect(ids1).toEqual(ids2);
      });

      it('should maintain graph invariants', () => {
        const nodes = generateGraphNodeFixtures(15);
        const edges = generateGraphEdgeFixtures(nodes, 0.4);
        const graph = createGraphStructure(nodes, edges);

        // All edge sources must reference existing nodes
        const nodeIds = new Set(graph.nodes.map((n: any) => n.id));

        for (const edge of graph.edges) {
          expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
          expect(nodeIds.has(edge.targetNodeId)).toBe(true);
        }
      });

      it('should maintain acyclic property for dependency graphs', () => {
        const nodes = generateGraphNodeFixtures(10);
        // Create linear edges (no cycles possible)
        const edges = nodes.slice(0, -1).map((node, i) => ({
          id: `edge_${i}`,
          sourceNodeId: node.id,
          targetNodeId: nodes[i + 1].id,
          type: 'depends_on',
          confidence: 1.0,
          evidence: {
            sourceFile: node.filePath,
            targetFile: nodes[i + 1].filePath,
            expression: `ref:${nodes[i + 1].name}`,
          },
        }));

        const graph = createGraphStructure(nodes, edges);

        assertGraph(graph).isAcyclic();
      });
    });

    describe('Edge Generation', () => {
      it('should generate edges with valid evidence', () => {
        const nodes = generateGraphNodeFixtures(5);
        const edges = generateGraphEdgeFixtures(nodes, 0.8);

        for (const edge of edges) {
          expect(edge).toHaveProperty('evidence');
          expect(edge.evidence).toHaveProperty('sourceFile');
          expect(edge.evidence).toHaveProperty('targetFile');
          expect(edge.evidence).toHaveProperty('expression');
        }
      });

      it('should maintain confidence score ranges', () => {
        const nodes = generateGraphNodeFixtures(10);
        const edges = generateGraphEdgeFixtures(nodes, 0.5);

        for (const edge of edges) {
          expect(edge.confidence).toBeGreaterThanOrEqual(0);
          expect(edge.confidence).toBeLessThanOrEqual(1);
        }
      });

      it('should support expected edge types', () => {
        const nodes = generateGraphNodeFixtures(10);
        const edges = generateGraphEdgeFixtures(nodes, 0.5);

        const validEdgeTypes = ['depends_on', 'references', 'uses', 'creates'];

        for (const edge of edges) {
          expect(validEdgeTypes).toContain(edge.type);
        }
      });
    });
  });

  // ==========================================================================
  // Performance Regression Detection
  // ==========================================================================

  describe('Performance Regression Detection', () => {
    const PERFORMANCE_THRESHOLDS = {
      fixtureGeneration: { baseline: 50, tolerance: 25 }, // ms
      graphConstruction: { baseline: 30, tolerance: 25 }, // ms
      graphValidation: { baseline: 20, tolerance: 25 }, // ms
    };

    it('should generate fixtures within performance baseline', async () => {
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const nodes = generateGraphNodeFixtures(100);
        generateGraphEdgeFixtures(nodes, 0.3);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const { baseline, tolerance } = PERFORMANCE_THRESHOLDS.fixtureGeneration;
      const maxAllowed = baseline * (1 + tolerance / 100);

      expect(avgTime).toBeLessThan(maxAllowed);
    });

    it('should construct graphs within performance baseline', async () => {
      const nodes = generateGraphNodeFixtures(50);
      const edges = generateGraphEdgeFixtures(nodes, 0.3);

      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        createGraphStructure(nodes, edges);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const { baseline, tolerance } = PERFORMANCE_THRESHOLDS.graphConstruction;
      const maxAllowed = baseline * (1 + tolerance / 100);

      expect(avgTime).toBeLessThan(maxAllowed);
    });

    it('should validate graphs within performance baseline', async () => {
      const nodes = generateGraphNodeFixtures(50);
      const edges = generateGraphEdgeFixtures(nodes, 0.25);
      const graph = createGraphStructure(nodes, edges);

      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        assertGraph(graph)
          .hasAtLeastNodes(50)
          .allEdgesHaveValidReferences();
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const { baseline, tolerance } = PERFORMANCE_THRESHOLDS.graphValidation;
      const maxAllowed = baseline * (1 + tolerance / 100);

      expect(avgTime).toBeLessThan(maxAllowed);
    });

    it('should handle large graphs efficiently', async () => {
      const start = performance.now();

      const nodes = generateGraphNodeFixtures(500);
      const edges = generateGraphEdgeFixtures(nodes, 0.1);
      const graph = createGraphStructure(nodes, edges);

      const duration = performance.now() - start;

      // Large graph generation should complete within 500ms
      expect(duration).toBeLessThan(500);

      // Graph should be valid
      assertGraph(graph)
        .hasNodeCount(500)
        .allEdgesHaveValidReferences();
    });
  });

  // ==========================================================================
  // Breaking Change Detection
  // ==========================================================================

  describe('Breaking Change Detection', () => {
    describe('Graph Assertion API Stability', () => {
      it('should support all expected assertion methods', () => {
        const nodes = generateGraphNodeFixtures(5);
        const edges = generateGraphEdgeFixtures(nodes, 0.3);
        const graph = createGraphStructure(nodes, edges);

        const assertion = assertGraph(graph);

        // These methods must exist (API contract)
        expect(typeof assertion.hasAtLeastNodes).toBe('function');
        expect(typeof assertion.hasNodeCount).toBe('function');
        expect(typeof assertion.hasAtLeastEdges).toBe('function');
        expect(typeof assertion.allNodesHaveFields).toBe('function');
        expect(typeof assertion.allEdgesHaveValidReferences).toBe('function');
        expect(typeof assertion.hasNodeTypes).toBe('function');
        expect(typeof assertion.isAcyclic).toBe('function');
      });

      it('should maintain assertion chaining', () => {
        const nodes = generateGraphNodeFixtures(10);
        const edges = generateGraphEdgeFixtures(nodes, 0.3);
        const graph = createGraphStructure(nodes, edges);

        // Chaining must work
        const result = assertGraph(graph)
          .hasAtLeastNodes(1)
          .allEdgesHaveValidReferences();

        // Should return the assertion object for chaining
        expect(result).toBeDefined();
      });
    });

    describe('Fixture API Stability', () => {
      it('should maintain fixture generator signatures', () => {
        // generateGraphNodeFixtures takes count
        expect(typeof generateGraphNodeFixtures).toBe('function');
        const nodes = generateGraphNodeFixtures(5);
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes).toHaveLength(5);

        // generateGraphEdgeFixtures takes nodes and density
        expect(typeof generateGraphEdgeFixtures).toBe('function');
        const edges = generateGraphEdgeFixtures(nodes, 0.5);
        expect(Array.isArray(edges)).toBe(true);

        // generateTerraformFixtureContent returns Map
        expect(typeof generateTerraformFixtureContent).toBe('function');
        const content = generateTerraformFixtureContent();
        expect(content instanceof Map).toBe(true);
      });
    });

    describe('API Client Stability', () => {
      it('should maintain API client method signatures', () => {
        // Core methods must exist
        expect(typeof apiClient.getHealth).toBe('function');
        expect(typeof apiClient.getReadiness).toBe('function');
        expect(typeof apiClient.getScan).toBe('function');
        expect(typeof apiClient.createScan).toBe('function');
        expect(typeof apiClient.getRepository).toBe('function');
        expect(typeof apiClient.setAuth).toBe('function');
      });
    });
  });

  // ==========================================================================
  // Baseline Comparison
  // ==========================================================================

  describe('Baseline Comparison', () => {
    it('should produce consistent hashes for fixture data', () => {
      const nodes = generateGraphNodeFixtures(10);

      // Hash the node structure (excluding volatile fields)
      const normalizedNodes = nodes.map((n) => ({
        type: n.type,
        name: n.name,
        filePath: n.filePath,
      }));

      const hash1 = hashObject(normalizedNodes);
      const hash2 = hashObject(normalizedNodes);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should detect changes in fixture structure', () => {
      const nodes1 = generateGraphNodeFixtures(5);
      const nodes2 = generateGraphNodeFixtures(6); // Different count

      const hash1 = hashObject(nodes1.map((n) => n.id));
      const hash2 = hashObject(nodes2.map((n) => n.id));

      expect(hash1).not.toBe(hash2);
    });

    it('should track graph structure fingerprint', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.3);
      const graph = createGraphStructure(nodes, edges);

      const fingerprint = {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        nodeTypes: [...new Set(graph.nodes.map((n: any) => n.type))].sort(),
        edgeTypes: [...new Set(graph.edges.map((e: any) => e.type))].sort(),
      };

      const hash = hashObject(fingerprint);

      // Hash should be consistent
      expect(hash).toHaveLength(16);

      // Fingerprint should capture key structure
      expect(fingerprint.nodeCount).toBe(10);
      expect(fingerprint.nodeTypes).toContain('tf_resource');
    });
  });
});
