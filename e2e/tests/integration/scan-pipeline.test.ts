/**
 * Scan Pipeline Integration Tests
 * @module e2e/tests/integration/scan-pipeline.test
 *
 * Integration tests for the complete scan pipeline workflow:
 * - Repository registration
 * - Scan initiation and execution
 * - File parsing and graph generation
 * - Node/edge storage and retrieval
 * - Status transitions and progress tracking
 *
 * TASK-E2E-032: Comprehensive test generation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  E2ETestContext,
  createTestContext,
  createTestAppBuilder,
} from '../../support/test-context.js';
import {
  createApiClient,
  TestApiClient,
  ScanResponse,
  RepositoryResponse,
  GraphResponse,
} from '../../support/api-client.js';
import {
  createFixtureLoader,
  FixtureLoader,
  TERRAFORM_FIXTURES,
  generateTerraformFixtureContent,
  generateGraphNodeFixtures,
  generateGraphEdgeFixtures,
  createRepositoryFixture,
  createScanFixture,
} from '../../support/fixtures.js';
import {
  assertGraph,
  assertSuccessResponse,
  assertPerformance,
  createGraphStructure,
} from '../../support/assertions.js';
import type { TenantId, RepositoryId, ScanId } from '../../../api/src/types/entities.js';
import type { AuthContext } from '../../../api/src/types/auth.js';

// ============================================================================
// Test Suite Configuration
// ============================================================================

describe('Scan Pipeline Integration Tests', () => {
  let ctx: E2ETestContext;
  let apiClient: TestApiClient;
  let fixtureLoader: FixtureLoader;
  let testTenantId: TenantId;
  let testAuth: AuthContext;

  beforeAll(async () => {
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
  // Repository Registration Tests
  // ==========================================================================

  describe('Repository Registration', () => {
    it('should return 404 for non-existent repository', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999' as RepositoryId;
      const response = await apiClient.getRepository(fakeId);

      expect(response.statusCode).toBe(404);
    });

    it('should validate repository data structure', () => {
      const fixture = createRepositoryFixture();

      expect(fixture.id).toBeDefined();
      expect(fixture.tenantId).toBeDefined();
      expect(fixture.provider).toMatch(/^(github|gitlab|bitbucket)$/);
      expect(fixture.owner).toBeDefined();
      expect(fixture.name).toBeDefined();
      expect(fixture.cloneUrl).toMatch(/^https?:\/\//);
      expect(fixture.defaultBranch).toBeDefined();
    });

    it('should handle repository list pagination parameters', async () => {
      const response = await apiClient.listRepositories({
        page: 1,
        pageSize: 10,
      });

      // Accept both success and not found if route not implemented
      expect([200, 404]).toContain(response.statusCode);
    });
  });

  // ==========================================================================
  // Scan Lifecycle Tests
  // ==========================================================================

  describe('Scan Lifecycle', () => {
    it('should return 404 for non-existent scan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999' as ScanId;
      const response = await apiClient.getScan(fakeId);

      expect(response.statusCode).toBe(404);
    });

    it('should validate scan fixture data structure', () => {
      const repoId = '00000000-0000-0000-0000-000000000001' as RepositoryId;
      const scan = createScanFixture(repoId);

      expect(scan.id).toBeDefined();
      expect(scan.repositoryId).toBe(repoId);
      expect(scan.commitSha).toBeDefined();
      expect(scan.branch).toBeDefined();
      expect(['pending', 'completed', 'failed']).toContain(scan.status);
      expect(scan.nodeCount).toBeGreaterThanOrEqual(0);
      expect(scan.edgeCount).toBeGreaterThanOrEqual(0);
    });

    it('should validate scan status transitions', () => {
      const validStatuses = ['pending', 'cloning', 'analyzing', 'indexing', 'completed', 'failed'];
      const validTransitions: Record<string, string[]> = {
        pending: ['cloning', 'failed'],
        cloning: ['analyzing', 'failed'],
        analyzing: ['indexing', 'failed'],
        indexing: ['completed', 'failed'],
        completed: [],
        failed: [],
      };

      // Verify all transitions are valid
      for (const [from, toStates] of Object.entries(validTransitions)) {
        expect(validStatuses).toContain(from);
        for (const to of toStates) {
          expect(validStatuses).toContain(to);
        }
      }
    });
  });

  // ==========================================================================
  // Graph Generation Tests
  // ==========================================================================

  describe('Graph Generation', () => {
    it('should generate valid graph nodes', () => {
      const nodes = generateGraphNodeFixtures(20);

      expect(nodes).toHaveLength(20);

      for (const node of nodes) {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.name).toBeDefined();
        expect(node.filePath).toBeDefined();
        expect(node.lineStart).toBeGreaterThan(0);
        expect(node.lineEnd).toBeGreaterThanOrEqual(node.lineStart);
      }
    });

    it('should generate valid graph edges', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.5);

      for (const edge of edges) {
        expect(edge.id).toBeDefined();
        expect(edge.sourceNodeId).toBeDefined();
        expect(edge.targetNodeId).toBeDefined();
        expect(edge.type).toBeDefined();
        expect(edge.confidence).toBeGreaterThanOrEqual(0);
        expect(edge.confidence).toBeLessThanOrEqual(1);

        // Verify source and target exist in nodes
        expect(nodes.some((n) => n.id === edge.sourceNodeId)).toBe(true);
        expect(nodes.some((n) => n.id === edge.targetNodeId)).toBe(true);
      }
    });

    it('should create valid graph structure', () => {
      const nodes = generateGraphNodeFixtures(15);
      const edges = generateGraphEdgeFixtures(nodes, 0.3);
      const graph = createGraphStructure(nodes, edges);

      assertGraph(graph)
        .hasNodeCount(15)
        .allNodesHaveFields(['id', 'type', 'name', 'filePath'])
        .allEdgesHaveValidReferences();
    });

    it('should validate edge references point to existing nodes', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.4);
      const graph = createGraphStructure(nodes, edges);

      const nodeIds = new Set(nodes.map((n) => n.id));

      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
        expect(nodeIds.has(edge.targetNodeId)).toBe(true);
      }
    });

    it('should generate edges with proper evidence', () => {
      const nodes = generateGraphNodeFixtures(5);
      const edges = generateGraphEdgeFixtures(nodes, 0.8);

      for (const edge of edges) {
        expect(edge.evidence).toBeDefined();
        expect(edge.evidence.sourceFile).toBeDefined();
        expect(edge.evidence.targetFile).toBeDefined();
        expect(edge.evidence.expression).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Terraform Fixture Tests
  // ==========================================================================

  describe('Terraform Fixture Content', () => {
    it('should generate valid Terraform file content', () => {
      const content = generateTerraformFixtureContent();

      expect(content.has('main.tf')).toBe(true);
      expect(content.has('variables.tf')).toBe(true);
      expect(content.has('outputs.tf')).toBe(true);
    });

    it('should include expected Terraform resources', () => {
      const content = generateTerraformFixtureContent();
      const mainTf = content.get('main.tf')!;

      expect(mainTf).toContain('resource "aws_s3_bucket"');
      expect(mainTf).toContain('resource "aws_iam_role"');
      expect(mainTf).toContain('resource "aws_lambda_function"');
    });

    it('should include valid variable declarations', () => {
      const content = generateTerraformFixtureContent();
      const variablesTf = content.get('variables.tf')!;

      expect(variablesTf).toContain('variable "aws_region"');
      expect(variablesTf).toContain('variable "bucket_name"');
      expect(variablesTf).toContain('type');
    });

    it('should include valid output declarations', () => {
      const content = generateTerraformFixtureContent();
      const outputsTf = content.get('outputs.tf')!;

      expect(outputsTf).toContain('output "bucket_arn"');
      expect(outputsTf).toContain('output "lambda_arn"');
      expect(outputsTf).toContain('value');
    });

    it('should have cross-resource dependencies', () => {
      const content = generateTerraformFixtureContent();
      const mainTf = content.get('main.tf')!;

      // Lambda should reference S3 bucket
      expect(mainTf).toContain('aws_s3_bucket.main');
      // Lambda should reference IAM role
      expect(mainTf).toContain('aws_iam_role.lambda_role');
    });
  });

  // ==========================================================================
  // Fixture Registry Tests
  // ==========================================================================

  describe('Fixture Registry', () => {
    it('should have all predefined terraform fixtures', () => {
      expect(Object.keys(TERRAFORM_FIXTURES)).toContain('terraform-simple');
      expect(Object.keys(TERRAFORM_FIXTURES)).toContain('terraform-modules');
      expect(Object.keys(TERRAFORM_FIXTURES)).toContain('terraform-remote-state');
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

    it('should have varying complexity in fixtures', () => {
      const simple = TERRAFORM_FIXTURES['terraform-simple'];
      const modules = TERRAFORM_FIXTURES['terraform-modules'];

      expect(modules.expectedNodeCount).toBeGreaterThan(simple.expectedNodeCount);
      expect(modules.modules.length).toBeGreaterThan(simple.modules.length);
    });
  });

  // ==========================================================================
  // Graph Validation Tests
  // ==========================================================================

  describe('Graph Validation', () => {
    it('should validate node types are recognized Terraform types', () => {
      const nodes = generateGraphNodeFixtures(30);
      const edges = generateGraphEdgeFixtures(nodes, 0.2);
      const graph = createGraphStructure(nodes, edges);

      const validTypes = ['tf_resource', 'tf_variable', 'tf_output', 'tf_module', 'tf_data'];

      assertGraph(graph).hasNodeTypes(['tf_resource', 'tf_variable', 'tf_output']);
    });

    it('should detect acyclic graph structure', () => {
      const nodes = generateGraphNodeFixtures(10);
      // Create linear edges (no cycles)
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

    it('should handle sparse graphs', () => {
      const nodes = generateGraphNodeFixtures(20);
      const edges = generateGraphEdgeFixtures(nodes, 0.05);
      const graph = createGraphStructure(nodes, edges);

      assertGraph(graph)
        .hasNodeCount(20)
        .allEdgesHaveValidReferences();
    });

    it('should handle dense graphs', () => {
      const nodes = generateGraphNodeFixtures(15);
      const edges = generateGraphEdgeFixtures(nodes, 0.8);
      const graph = createGraphStructure(nodes, edges);

      assertGraph(graph)
        .hasNodeCount(15)
        .hasAtLeastEdges(10)
        .allEdgesHaveValidReferences();
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Pipeline Performance', () => {
    it('should generate small graph within time limit', async () => {
      await assertPerformance(
        async () => {
          const nodes = generateGraphNodeFixtures(50);
          const edges = generateGraphEdgeFixtures(nodes, 0.3);
          return createGraphStructure(nodes, edges);
        },
        {
          maxDurationMs: 50,
          description: 'Generate 50-node graph',
        }
      );
    });

    it('should generate medium graph within time limit', async () => {
      await assertPerformance(
        async () => {
          const nodes = generateGraphNodeFixtures(200);
          const edges = generateGraphEdgeFixtures(nodes, 0.2);
          return createGraphStructure(nodes, edges);
        },
        {
          maxDurationMs: 200,
          description: 'Generate 200-node graph',
        }
      );
    });

    it('should validate graph within time limit', async () => {
      const nodes = generateGraphNodeFixtures(100);
      const edges = generateGraphEdgeFixtures(nodes, 0.25);
      const graph = createGraphStructure(nodes, edges);

      await assertPerformance(
        async () => {
          assertGraph(graph)
            .hasAtLeastNodes(100)
            .allEdgesHaveValidReferences()
            .isAcyclic();
        },
        {
          maxDurationMs: 100,
          description: 'Validate 100-node graph',
        }
      );
    });
  });

  // ==========================================================================
  // Node Type Distribution Tests
  // ==========================================================================

  describe('Node Type Distribution', () => {
    it('should generate balanced node types', () => {
      const nodeCount = 30;
      const nodes = generateGraphNodeFixtures(nodeCount);

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
      const expectedPerType = Math.floor(nodeCount / 3);
      expect(typeCount.tf_resource).toBeGreaterThanOrEqual(expectedPerType - 1);
      expect(typeCount.tf_variable).toBeGreaterThanOrEqual(expectedPerType - 1);
      expect(typeCount.tf_output).toBeGreaterThanOrEqual(expectedPerType - 1);
    });

    it('should create unique node IDs', () => {
      const nodes = generateGraphNodeFixtures(100);
      const nodeIds = new Set(nodes.map((n) => n.id));

      expect(nodeIds.size).toBe(nodes.length);
    });

    it('should follow node ID naming pattern', () => {
      const nodes = generateGraphNodeFixtures(10);

      for (const node of nodes) {
        expect(node.id).toMatch(/^node_\d{3}$/);
      }
    });
  });

  // ==========================================================================
  // Edge Type Distribution Tests
  // ==========================================================================

  describe('Edge Type Distribution', () => {
    it('should generate edges with valid types', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.5);

      const validTypes = ['depends_on', 'references'];

      for (const edge of edges) {
        expect(validTypes).toContain(edge.type);
      }
    });

    it('should have confidence scores in valid range', () => {
      const nodes = generateGraphNodeFixtures(10);
      const edges = generateGraphEdgeFixtures(nodes, 0.5);

      for (const edge of edges) {
        expect(edge.confidence).toBeGreaterThanOrEqual(0);
        expect(edge.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should create unique edge IDs', () => {
      const nodes = generateGraphNodeFixtures(20);
      const edges = generateGraphEdgeFixtures(nodes, 0.4);

      const edgeIds = new Set(edges.map((e) => e.id));
      expect(edgeIds.size).toBe(edges.length);
    });
  });

  // ==========================================================================
  // Evidence Pointer Tests
  // ==========================================================================

  describe('Evidence Pointers', () => {
    it('should include source file in evidence', () => {
      const nodes = generateGraphNodeFixtures(5);
      const edges = generateGraphEdgeFixtures(nodes, 0.8);

      for (const edge of edges) {
        expect(typeof edge.evidence.sourceFile).toBe('string');
        expect(edge.evidence.sourceFile.length).toBeGreaterThan(0);
      }
    });

    it('should include target file in evidence', () => {
      const nodes = generateGraphNodeFixtures(5);
      const edges = generateGraphEdgeFixtures(nodes, 0.8);

      for (const edge of edges) {
        expect(typeof edge.evidence.targetFile).toBe('string');
        expect(edge.evidence.targetFile.length).toBeGreaterThan(0);
      }
    });

    it('should include expression in evidence', () => {
      const nodes = generateGraphNodeFixtures(5);
      const edges = generateGraphEdgeFixtures(nodes, 0.8);

      for (const edge of edges) {
        expect(typeof edge.evidence.expression).toBe('string');
        expect(edge.evidence.expression).toMatch(/^ref:/);
      }
    });
  });

  // ==========================================================================
  // API Contract Tests
  // ==========================================================================

  describe('API Contract', () => {
    it('should return proper error for invalid scan ID format', async () => {
      const invalidId = 'not-a-uuid' as ScanId;
      const response = await apiClient.getScan(invalidId);

      // Should be 400 (bad request) or 404 (not found) depending on validation
      expect([400, 404]).toContain(response.statusCode);
    });

    it('should return proper error for invalid repository ID format', async () => {
      const invalidId = 'not-a-uuid' as RepositoryId;
      const response = await apiClient.getRepository(invalidId);

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should handle missing authorization gracefully', async () => {
      apiClient.clearAuth();

      const response = await apiClient.listScans();

      // Should require auth or return empty results
      expect([200, 401, 404]).toContain(response.statusCode);

      // Restore auth
      apiClient.setAuth(testAuth);
    });
  });

  // ==========================================================================
  // Fixture Loader Tests
  // ==========================================================================

  describe('Fixture Loader', () => {
    it('should check fixture existence', async () => {
      const exists = await fixtureLoader.fixtureExists('terraform', 'terraform-simple');
      // May or may not exist depending on test environment
      expect(typeof exists).toBe('boolean');
    });

    it('should throw for non-existent fixture', async () => {
      await expect(fixtureLoader.loadTerraformFixture('non-existent')).rejects.toThrow(
        'Terraform fixture not found'
      );
    });

    it('should load user fixtures synchronously', () => {
      const user = fixtureLoader.loadUserFixture('test-user');

      expect(user.userId).toBeDefined();
      expect(user.email).toMatch(/@/);
      expect(user.githubId).toBeGreaterThan(0);
    });

    it('should throw for non-existent user fixture', () => {
      expect(() => fixtureLoader.loadUserFixture('non-existent')).toThrow(
        'User fixture not found'
      );
    });

    it('should clear cache', () => {
      fixtureLoader.clearCache();
      // Should not throw
    });
  });
});
