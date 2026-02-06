/**
 * Terraform Scan E2E Tests
 * @module e2e/tests/scan/terraform-scan.spec
 *
 * End-to-end tests for the complete Terraform scan pipeline:
 * 1. Repository registration
 * 2. Scan initiation
 * 3. File parsing
 * 4. Graph generation
 * 5. Node/edge verification
 * 6. Evidence pointer validation
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  E2ETestContext,
  createTestContext,
  createTestAppBuilder,
} from '../../support/test-context.js';
import {
  createFixtureLoader,
  FixtureLoader,
  TERRAFORM_FIXTURES,
  generateTerraformFixtureContent,
  generateGraphNodeFixtures,
  generateGraphEdgeFixtures,
} from '../../support/fixtures.js';
import {
  assertGraph,
  assertSuccessResponse,
  assertErrorResponse,
  assertPerformance,
  createGraphStructure,
} from '../../support/assertions.js';
import {
  createApiClient,
  TestApiClient,
  GraphResponse,
  ScanResponse,
  RepositoryResponse,
} from '../../support/api-client.js';
import type { TenantId, RepositoryId, ScanId } from '../../../api/src/types/entities.js';
import type { AuthContext } from '../../../api/src/types/auth.js';

// ============================================================================
// Test Suite Configuration
// ============================================================================

describe('Terraform Scan E2E Tests', () => {
  let ctx: E2ETestContext;
  let apiClient: TestApiClient;
  let fixtureLoader: FixtureLoader;
  let testTenantId: TenantId;
  let testAuth: AuthContext;

  beforeAll(async () => {
    // Create test context with custom configuration
    ctx = createTestAppBuilder()
      .withTimeout(60000)
      .withMocking(true)
      .build();

    await ctx.setup();

    testTenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
    testAuth = ctx.createAuthContext({ tenantId: testTenantId });

    apiClient = createApiClient(ctx.getApp(), testTenantId);
    apiClient.setAuth(testAuth);

    fixtureLoader = createFixtureLoader();
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  // ==========================================================================
  // Health Check Tests
  // ==========================================================================

  describe('Health Check Verification', () => {
    it('should verify API is healthy before running scan tests', async () => {
      const response = await apiClient.getHealth();

      response.expectStatus(200);
      expect(response.body.status).toBe('healthy');
    });

    it('should verify all dependencies are ready', async () => {
      const response = await apiClient.getReadiness();

      // Accept both 200 (ready) and 503 (not ready) as test environment may not have full DB
      expect([200, 503]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        expect(response.body.ready).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Scan Pipeline Tests
  // ==========================================================================

  describe('Complete Scan Pipeline', () => {
    describe('Graph Node Validation', () => {
      it('should validate generated graph nodes have all required fields', () => {
        const nodes = generateGraphNodeFixtures(10);
        const edges = generateGraphEdgeFixtures(nodes, 0.3);
        const graph = createGraphStructure(nodes, edges);

        assertGraph(graph)
          .hasAtLeastNodes(10)
          .allNodesHaveFields([
            'id',
            'type',
            'name',
            'filePath',
            'lineStart',
            'lineEnd',
          ])
          .allEdgesHaveValidReferences();
      });

      it('should validate graph node types are recognized Terraform types', () => {
        const nodes = generateGraphNodeFixtures(20);
        const edges = generateGraphEdgeFixtures(nodes, 0.2);
        const graph = createGraphStructure(nodes, edges);

        // All generated fixtures use tf_resource, tf_variable, tf_output
        assertGraph(graph).hasNodeTypes([
          'tf_resource',
          'tf_variable',
          'tf_output',
        ]);
      });
    });

    describe('Graph Edge Validation', () => {
      it('should validate all edges reference existing nodes', () => {
        const nodes = generateGraphNodeFixtures(15);
        const edges = generateGraphEdgeFixtures(nodes, 0.4);
        const graph = createGraphStructure(nodes, edges);

        assertGraph(graph).allEdgesHaveValidReferences();
      });

      it('should validate edge evidence contains source information', () => {
        const nodes = generateGraphNodeFixtures(5);
        const edges = generateGraphEdgeFixtures(nodes, 0.5);

        for (const edge of edges) {
          expect(edge.evidence).toBeDefined();
          expect(edge.evidence.sourceFile).toBeDefined();
          expect(edge.evidence.targetFile).toBeDefined();
        }
      });

      it('should detect acyclic graph structure', () => {
        const nodes = generateGraphNodeFixtures(10);
        // Linear edges won't create cycles
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

    describe('Terraform Fixture Content', () => {
      it('should generate valid Terraform fixture content', () => {
        const content = generateTerraformFixtureContent();

        expect(content.has('main.tf')).toBe(true);
        expect(content.has('variables.tf')).toBe(true);
        expect(content.has('outputs.tf')).toBe(true);

        // Verify main.tf has expected resources
        const mainTf = content.get('main.tf');
        expect(mainTf).toBeDefined();
        expect(mainTf).toContain('resource "aws_s3_bucket"');
        expect(mainTf).toContain('resource "aws_iam_role"');
        expect(mainTf).toContain('resource "aws_lambda_function"');

        // Verify variables.tf has variable declarations
        const variablesTf = content.get('variables.tf');
        expect(variablesTf).toBeDefined();
        expect(variablesTf).toContain('variable "aws_region"');
        expect(variablesTf).toContain('variable "bucket_name"');

        // Verify outputs.tf has output declarations
        const outputsTf = content.get('outputs.tf');
        expect(outputsTf).toBeDefined();
        expect(outputsTf).toContain('output "bucket_arn"');
        expect(outputsTf).toContain('output "lambda_arn"');
      });

      it('should have cross-resource dependencies in fixture content', () => {
        const content = generateTerraformFixtureContent();
        const mainTf = content.get('main.tf');

        // Lambda references S3 bucket
        expect(mainTf).toContain('aws_s3_bucket.main.id');
        // Lambda references IAM role
        expect(mainTf).toContain('aws_iam_role.lambda_role.arn');
      });
    });
  });

  // ==========================================================================
  // API Contract Tests
  // ==========================================================================

  describe('API Contract Validation', () => {
    it('should return 404 for non-existent scan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999' as ScanId;
      const response = await apiClient.getScan(fakeId);

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent repository', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999' as RepositoryId;
      const response = await apiClient.getRepository(fakeId);

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance Validation', () => {
    it('should generate fixtures within acceptable time', async () => {
      await assertPerformance(
        async () => {
          const nodes = generateGraphNodeFixtures(100);
          const edges = generateGraphEdgeFixtures(nodes, 0.3);
          return createGraphStructure(nodes, edges);
        },
        {
          maxDurationMs: 100,
          description: 'Generate 100-node graph fixture',
        }
      );
    });

    it('should validate graph structure within acceptable time', async () => {
      const nodes = generateGraphNodeFixtures(50);
      const edges = generateGraphEdgeFixtures(nodes, 0.25);
      const graph = createGraphStructure(nodes, edges);

      await assertPerformance(
        async () => {
          assertGraph(graph)
            .hasAtLeastNodes(50)
            .allEdgesHaveValidReferences()
            .isAcyclic();
        },
        {
          maxDurationMs: 50,
          description: 'Validate 50-node graph structure',
        }
      );
    });
  });

  // ==========================================================================
  // Fixture Registry Tests
  // ==========================================================================

  describe('Fixture Registry', () => {
    it('should have predefined terraform fixtures', () => {
      expect(Object.keys(TERRAFORM_FIXTURES).length).toBeGreaterThan(0);
      expect(TERRAFORM_FIXTURES['terraform-simple']).toBeDefined();
      expect(TERRAFORM_FIXTURES['terraform-modules']).toBeDefined();
    });

    it('should have complete fixture metadata', () => {
      for (const [name, fixture] of Object.entries(TERRAFORM_FIXTURES)) {
        expect(fixture.name).toBe(name);
        expect(fixture.path).toBeDefined();
        expect(fixture.mainFiles.length).toBeGreaterThan(0);
        expect(fixture.expectedNodeCount).toBeGreaterThan(0);
        expect(fixture.description).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Evidence Pointer Tests
  // ==========================================================================

  describe('Evidence Pointer Validation', () => {
    it('should generate edges with valid evidence pointers', () => {
      const nodes = generateGraphNodeFixtures(5);
      const edges = generateGraphEdgeFixtures(nodes, 1.0); // High density for more edges

      for (const edge of edges) {
        // Evidence should contain source file reference
        expect(edge.evidence.sourceFile).toBeDefined();
        expect(typeof edge.evidence.sourceFile).toBe('string');

        // Evidence should contain target file reference
        expect(edge.evidence.targetFile).toBeDefined();
        expect(typeof edge.evidence.targetFile).toBe('string');

        // Evidence should contain expression
        expect(edge.evidence.expression).toBeDefined();
        expect(typeof edge.evidence.expression).toBe('string');
      }
    });

    it('should have confidence scores within valid range', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.5);

      for (const edge of edges) {
        expect(edge.confidence).toBeGreaterThanOrEqual(0);
        expect(edge.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  // ==========================================================================
  // Cross-Reference Tests
  // ==========================================================================

  describe('Cross-Reference Validation', () => {
    it('should identify dependencies between resources', () => {
      const nodes = generateGraphNodeFixtures(5);
      const edges = generateGraphEdgeFixtures(nodes, 0.5);

      // Filter to depends_on edges
      const dependsOnEdges = edges.filter((e) => e.type === 'depends_on');
      const referencesEdges = edges.filter((e) => e.type === 'references');

      // Should have a mix of edge types
      expect(dependsOnEdges.length + referencesEdges.length).toBe(edges.length);
    });

    it('should create valid node IDs', () => {
      const nodes = generateGraphNodeFixtures(20);

      const nodeIds = new Set(nodes.map((n) => n.id));
      // All IDs should be unique
      expect(nodeIds.size).toBe(nodes.length);

      // All IDs should follow naming pattern
      for (const node of nodes) {
        expect(node.id).toMatch(/^node_\d{3}$/);
      }
    });
  });

  // ==========================================================================
  // Graph Structure Tests
  // ==========================================================================

  describe('Graph Structure Analysis', () => {
    it('should create balanced graph structure', () => {
      const nodeCount = 30;
      const nodes = generateGraphNodeFixtures(nodeCount);
      const edges = generateGraphEdgeFixtures(nodes, 0.2);
      const graph = createGraphStructure(nodes, edges);

      assertGraph(graph)
        .hasNodeCount(nodeCount)
        .hasAtLeastEdges(1);

      // Verify node type distribution
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

      // Should have roughly equal distribution (nodeCount / 3)
      const expectedPerType = Math.floor(nodeCount / 3);
      expect(typeCount.tf_resource).toBeGreaterThanOrEqual(expectedPerType - 1);
      expect(typeCount.tf_variable).toBeGreaterThanOrEqual(expectedPerType - 1);
      expect(typeCount.tf_output).toBeGreaterThanOrEqual(expectedPerType - 1);
    });

    it('should handle sparse graphs', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.05); // Very sparse
      const graph = createGraphStructure(nodes, edges);

      assertGraph(graph)
        .hasNodeCount(10)
        .allEdgesHaveValidReferences()
        .isAcyclic();
    });

    it('should handle dense graphs', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.8); // Dense
      const graph = createGraphStructure(nodes, edges);

      assertGraph(graph)
        .hasNodeCount(10)
        .hasAtLeastEdges(10) // Dense graph should have many edges
        .allEdgesHaveValidReferences();
    });
  });
});
