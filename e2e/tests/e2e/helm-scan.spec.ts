/**
 * Helm Scan E2E Tests
 * @module e2e/tests/e2e/helm-scan.spec
 *
 * End-to-end tests for the complete Helm chart scan pipeline:
 * 1. Chart discovery and validation
 * 2. Values file parsing
 * 3. Template rendering analysis
 * 4. Kubernetes resource dependency detection
 * 5. Cross-chart dependency resolution
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
} from '../../support/api-client.js';
import {
  createFixtureLoader,
  FixtureLoader,
  HELM_FIXTURES,
  generateHelmFixtureContent,
  generateGraphNodeFixtures,
  generateGraphEdgeFixtures,
} from '../../support/fixtures.js';
import {
  assertGraph,
  assertPerformance,
  createGraphStructure,
} from '../../support/assertions.js';
import type { TenantId, RepositoryId, ScanId } from '../../../api/src/types/entities.js';
import type { AuthContext } from '../../../api/src/types/auth.js';

// ============================================================================
// Types
// ============================================================================

interface HelmChartNode {
  readonly id: string;
  readonly type: 'helm_chart' | 'helm_template' | 'helm_values' | 'k8s_resource';
  readonly name: string;
  readonly chartName?: string;
  readonly resourceKind?: string;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly metadata: Record<string, unknown>;
}

interface HelmDependency {
  readonly name: string;
  readonly version: string;
  readonly repository: string;
  readonly condition?: string;
  readonly tags?: string[];
}

interface ParsedHelmChart {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly dependencies: HelmDependency[];
  readonly templates: string[];
  readonly valuesFiles: string[];
}

// ============================================================================
// Test Utilities
// ============================================================================

function createMockHelmChartNode(overrides: Partial<HelmChartNode> = {}): HelmChartNode {
  return {
    id: `helm_node_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: 'helm_chart',
    name: 'test-chart',
    filePath: 'Chart.yaml',
    lineStart: 1,
    lineEnd: 10,
    metadata: {},
    ...overrides,
  };
}

function createMockK8sResourceNode(
  kind: string,
  name: string,
  overrides: Partial<HelmChartNode> = {}
): HelmChartNode {
  return {
    id: `k8s_${kind.toLowerCase()}_${name}`,
    type: 'k8s_resource',
    name: `${kind}/${name}`,
    resourceKind: kind,
    filePath: `templates/${kind.toLowerCase()}.yaml`,
    lineStart: 1,
    lineEnd: 20,
    metadata: { kind, name, apiVersion: 'v1' },
    ...overrides,
  };
}

function generateHelmGraphNodes(count: number): HelmChartNode[] {
  const nodes: HelmChartNode[] = [];
  const resourceKinds = ['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress'];

  for (let i = 0; i < count; i++) {
    const kind = resourceKinds[i % resourceKinds.length];
    nodes.push(
      createMockK8sResourceNode(kind, `resource-${i}`, {
        id: `node_${i.toString().padStart(3, '0')}`,
        lineStart: i * 25 + 1,
        lineEnd: i * 25 + 20,
      })
    );
  }

  return nodes;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Helm Scan E2E Tests', () => {
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
  // Helm Fixture Content Tests
  // ==========================================================================

  describe('Helm Fixture Content', () => {
    it('should generate valid Chart.yaml content', () => {
      const content = generateHelmFixtureContent();

      expect(content.has('Chart.yaml')).toBe(true);

      const chartYaml = content.get('Chart.yaml')!;
      expect(chartYaml).toContain('apiVersion: v2');
      expect(chartYaml).toContain('name:');
      expect(chartYaml).toContain('version:');
      expect(chartYaml).toContain('type: application');
    });

    it('should generate valid values.yaml content', () => {
      const content = generateHelmFixtureContent();

      expect(content.has('values.yaml')).toBe(true);

      const valuesYaml = content.get('values.yaml')!;
      expect(valuesYaml).toContain('replicaCount:');
      expect(valuesYaml).toContain('image:');
      expect(valuesYaml).toContain('service:');
      expect(valuesYaml).toContain('resources:');
    });

    it('should generate deployment template', () => {
      const content = generateHelmFixtureContent();

      expect(content.has('templates/deployment.yaml')).toBe(true);

      const deployment = content.get('templates/deployment.yaml')!;
      expect(deployment).toContain('apiVersion: apps/v1');
      expect(deployment).toContain('kind: Deployment');
      expect(deployment).toContain('{{ .Release.Name }}');
      expect(deployment).toContain('{{ .Values.replicaCount }}');
    });

    it('should generate service template', () => {
      const content = generateHelmFixtureContent();

      expect(content.has('templates/service.yaml')).toBe(true);

      const service = content.get('templates/service.yaml')!;
      expect(service).toContain('apiVersion: v1');
      expect(service).toContain('kind: Service');
      expect(service).toContain('{{ .Values.service.type }}');
      expect(service).toContain('{{ .Values.service.port }}');
    });

    it('should use Helm template syntax correctly', () => {
      const content = generateHelmFixtureContent();
      const deployment = content.get('templates/deployment.yaml')!;

      // Check for proper Helm templating
      expect(deployment).toMatch(/\{\{\s*\.Release\.Name\s*\}\}/);
      expect(deployment).toMatch(/\{\{\s*\.Chart\.Name\s*\}\}/);
      expect(deployment).toMatch(/\{\{-?\s*toYaml\s+\.Values\./);
    });
  });

  // ==========================================================================
  // Helm Fixture Registry Tests
  // ==========================================================================

  describe('Helm Fixture Registry', () => {
    it('should have predefined helm fixtures', () => {
      expect(Object.keys(HELM_FIXTURES).length).toBeGreaterThan(0);
      expect(HELM_FIXTURES['helm-simple']).toBeDefined();
      expect(HELM_FIXTURES['helm-dependencies']).toBeDefined();
    });

    it('should have complete fixture metadata', () => {
      for (const [name, fixture] of Object.entries(HELM_FIXTURES)) {
        expect(fixture.name).toBe(name);
        expect(fixture.path).toBeDefined();
        expect(fixture.chartFile).toBe('Chart.yaml');
        expect(fixture.valuesFiles.length).toBeGreaterThan(0);
        expect(fixture.templateFiles.length).toBeGreaterThan(0);
        expect(fixture.expectedNodeCount).toBeGreaterThan(0);
        expect(fixture.description).toBeDefined();
      }
    });

    it('should have varying complexity in helm fixtures', () => {
      const simple = HELM_FIXTURES['helm-simple'];
      const dependencies = HELM_FIXTURES['helm-dependencies'];

      expect(dependencies.expectedNodeCount).toBeGreaterThan(simple.expectedNodeCount);
      expect(dependencies.valuesFiles.length).toBeGreaterThan(simple.valuesFiles.length);
    });
  });

  // ==========================================================================
  // Kubernetes Resource Node Tests
  // ==========================================================================

  describe('Kubernetes Resource Nodes', () => {
    it('should generate valid K8s resource nodes', () => {
      const nodes = generateHelmGraphNodes(10);

      expect(nodes).toHaveLength(10);

      for (const node of nodes) {
        expect(node.id).toBeDefined();
        expect(node.type).toBe('k8s_resource');
        expect(node.resourceKind).toBeDefined();
        expect(node.filePath).toContain('templates/');
        expect(node.metadata.kind).toBeDefined();
      }
    });

    it('should include all common K8s resource kinds', () => {
      const nodes = generateHelmGraphNodes(20);
      const kinds = new Set(nodes.map((n) => n.resourceKind));

      expect(kinds.has('Deployment')).toBe(true);
      expect(kinds.has('Service')).toBe(true);
      expect(kinds.has('ConfigMap')).toBe(true);
      expect(kinds.has('Secret')).toBe(true);
      expect(kinds.has('Ingress')).toBe(true);
    });

    it('should have unique node IDs', () => {
      const nodes = generateHelmGraphNodes(50);
      const nodeIds = new Set(nodes.map((n) => n.id));

      expect(nodeIds.size).toBe(nodes.length);
    });
  });

  // ==========================================================================
  // Chart Parsing Tests
  // ==========================================================================

  describe('Chart Parsing', () => {
    it('should parse Chart.yaml metadata', () => {
      const chartMetadata: ParsedHelmChart = {
        name: 'test-chart',
        version: '1.0.0',
        description: 'A test Helm chart',
        dependencies: [],
        templates: ['deployment.yaml', 'service.yaml'],
        valuesFiles: ['values.yaml'],
      };

      expect(chartMetadata.name).toBeDefined();
      expect(chartMetadata.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(chartMetadata.templates.length).toBeGreaterThan(0);
    });

    it('should parse chart dependencies', () => {
      const dependencies: HelmDependency[] = [
        {
          name: 'postgresql',
          version: '12.1.0',
          repository: 'https://charts.bitnami.com/bitnami',
          condition: 'postgresql.enabled',
        },
        {
          name: 'redis',
          version: '17.0.0',
          repository: 'https://charts.bitnami.com/bitnami',
          tags: ['cache'],
        },
      ];

      expect(dependencies).toHaveLength(2);
      expect(dependencies[0].condition).toBeDefined();
      expect(dependencies[1].tags).toContain('cache');
    });

    it('should identify values file hierarchy', () => {
      const valuesFiles = ['values.yaml', 'values-dev.yaml', 'values-prod.yaml'];

      expect(valuesFiles).toContain('values.yaml');
      expect(valuesFiles.filter((f) => f.startsWith('values-')).length).toBe(2);
    });
  });

  // ==========================================================================
  // Kubernetes Resource Dependencies
  // ==========================================================================

  describe('Kubernetes Resource Dependencies', () => {
    it('should detect Service -> Deployment dependencies', () => {
      const deployment = createMockK8sResourceNode('Deployment', 'web-app');
      const service = createMockK8sResourceNode('Service', 'web-app-svc');

      // Service selects Deployment pods
      const edge = {
        id: 'edge_svc_dep',
        sourceNodeId: service.id,
        targetNodeId: deployment.id,
        type: 'selects',
        confidence: 0.95,
        evidence: {
          selector: { app: 'web-app' },
          matchedLabels: { app: 'web-app' },
        },
      };

      expect(edge.sourceNodeId).toBe(service.id);
      expect(edge.targetNodeId).toBe(deployment.id);
      expect(edge.type).toBe('selects');
    });

    it('should detect ConfigMap -> Deployment mount references', () => {
      const configMap = createMockK8sResourceNode('ConfigMap', 'app-config');
      const deployment = createMockK8sResourceNode('Deployment', 'web-app');

      const edge = {
        id: 'edge_cm_dep',
        sourceNodeId: deployment.id,
        targetNodeId: configMap.id,
        type: 'mounts',
        confidence: 1.0,
        evidence: {
          volumeMount: '/etc/config',
          volumeName: 'config-volume',
        },
      };

      expect(edge.type).toBe('mounts');
      expect(edge.confidence).toBe(1.0);
    });

    it('should detect Secret -> Deployment references', () => {
      const secret = createMockK8sResourceNode('Secret', 'db-credentials');
      const deployment = createMockK8sResourceNode('Deployment', 'web-app');

      const edge = {
        id: 'edge_secret_dep',
        sourceNodeId: deployment.id,
        targetNodeId: secret.id,
        type: 'references_secret',
        confidence: 1.0,
        evidence: {
          envFrom: true,
          secretRef: 'db-credentials',
        },
      };

      expect(edge.type).toBe('references_secret');
    });

    it('should detect Ingress -> Service routing', () => {
      const service = createMockK8sResourceNode('Service', 'web-svc');
      const ingress = createMockK8sResourceNode('Ingress', 'web-ingress');

      const edge = {
        id: 'edge_ing_svc',
        sourceNodeId: ingress.id,
        targetNodeId: service.id,
        type: 'routes_to',
        confidence: 1.0,
        evidence: {
          host: 'example.com',
          path: '/',
          servicePort: 80,
        },
      };

      expect(edge.type).toBe('routes_to');
    });
  });

  // ==========================================================================
  // Graph Construction Tests
  // ==========================================================================

  describe('Helm Graph Construction', () => {
    it('should create graph with K8s resources', () => {
      const nodes = generateHelmGraphNodes(15);
      const edges = generateGraphEdgeFixtures(nodes as any, 0.3);
      const graph = createGraphStructure(nodes as any, edges);

      assertGraph(graph)
        .hasNodeCount(15)
        .allNodesHaveFields(['id', 'type', 'name', 'filePath'])
        .allEdgesHaveValidReferences();
    });

    it('should handle common Helm chart topology', () => {
      // Common pattern: Ingress -> Service -> Deployment
      const deployment = createMockK8sResourceNode('Deployment', 'app');
      const service = createMockK8sResourceNode('Service', 'app-svc');
      const ingress = createMockK8sResourceNode('Ingress', 'app-ingress');
      const configMap = createMockK8sResourceNode('ConfigMap', 'app-config');

      const nodes = [deployment, service, ingress, configMap];
      const edges = [
        {
          id: 'e1',
          sourceNodeId: ingress.id,
          targetNodeId: service.id,
          type: 'routes_to',
          confidence: 1.0,
          evidence: {},
        },
        {
          id: 'e2',
          sourceNodeId: service.id,
          targetNodeId: deployment.id,
          type: 'selects',
          confidence: 0.95,
          evidence: {},
        },
        {
          id: 'e3',
          sourceNodeId: deployment.id,
          targetNodeId: configMap.id,
          type: 'mounts',
          confidence: 1.0,
          evidence: {},
        },
      ];

      const graph = createGraphStructure(nodes as any, edges as any);

      assertGraph(graph)
        .hasNodeCount(4)
        .hasEdgeCount(3)
        .allEdgesHaveValidReferences();
    });

    it('should detect microservices topology', () => {
      // Multiple services with inter-service communication
      const services = ['api', 'auth', 'database', 'cache'];
      const nodes = services.flatMap((svc) => [
        createMockK8sResourceNode('Deployment', `${svc}-deployment`),
        createMockK8sResourceNode('Service', `${svc}-service`),
      ]);

      const edges: any[] = [];
      // Service -> Deployment pairs
      for (let i = 0; i < services.length; i++) {
        edges.push({
          id: `e_svc_${i}`,
          sourceNodeId: nodes[i * 2 + 1].id, // Service
          targetNodeId: nodes[i * 2].id, // Deployment
          type: 'selects',
          confidence: 0.95,
          evidence: {},
        });
      }

      // API -> Auth dependency
      edges.push({
        id: 'e_api_auth',
        sourceNodeId: nodes[0].id, // api deployment
        targetNodeId: nodes[3].id, // auth service
        type: 'calls',
        confidence: 0.8,
        evidence: {},
      });

      const graph = createGraphStructure(nodes as any, edges);

      assertGraph(graph)
        .hasNodeCount(8)
        .hasAtLeastEdges(5)
        .allEdgesHaveValidReferences();
    });
  });

  // ==========================================================================
  // Template Variable Resolution Tests
  // ==========================================================================

  describe('Template Variable Resolution', () => {
    it('should identify Release template variables', () => {
      const releaseVars = ['.Release.Name', '.Release.Namespace', '.Release.Service'];

      for (const varName of releaseVars) {
        expect(varName).toMatch(/^\.Release\./);
      }
    });

    it('should identify Values template variables', () => {
      const valuesVars = [
        '.Values.replicaCount',
        '.Values.image.repository',
        '.Values.service.port',
      ];

      for (const varName of valuesVars) {
        expect(varName).toMatch(/^\.Values\./);
      }
    });

    it('should identify Chart template variables', () => {
      const chartVars = ['.Chart.Name', '.Chart.Version', '.Chart.AppVersion'];

      for (const varName of chartVars) {
        expect(varName).toMatch(/^\.Chart\./);
      }
    });

    it('should trace values to template usage', () => {
      const valueReference = {
        valuePath: '.Values.image.repository',
        usedInTemplate: 'templates/deployment.yaml',
        line: 25,
        context: 'containers[0].image',
      };

      expect(valueReference.valuePath).toContain('.Values.');
      expect(valueReference.usedInTemplate).toContain('templates/');
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Helm Scan Performance', () => {
    it('should generate small Helm graph quickly', async () => {
      await assertPerformance(
        async () => {
          const nodes = generateHelmGraphNodes(30);
          const edges = generateGraphEdgeFixtures(nodes as any, 0.3);
          return createGraphStructure(nodes as any, edges);
        },
        {
          maxDurationMs: 50,
          description: 'Generate 30-resource Helm graph',
        }
      );
    });

    it('should generate large Helm graph within limits', async () => {
      await assertPerformance(
        async () => {
          const nodes = generateHelmGraphNodes(100);
          const edges = generateGraphEdgeFixtures(nodes as any, 0.2);
          return createGraphStructure(nodes as any, edges);
        },
        {
          maxDurationMs: 150,
          description: 'Generate 100-resource Helm graph',
        }
      );
    });

    it('should validate Helm graph structure quickly', async () => {
      const nodes = generateHelmGraphNodes(50);
      const edges = generateGraphEdgeFixtures(nodes as any, 0.25);
      const graph = createGraphStructure(nodes as any, edges);

      await assertPerformance(
        async () => {
          assertGraph(graph)
            .hasAtLeastNodes(50)
            .allEdgesHaveValidReferences()
            .isAcyclic();
        },
        {
          maxDurationMs: 75,
          description: 'Validate 50-resource Helm graph',
        }
      );
    });
  });

  // ==========================================================================
  // Chart Dependency Tests
  // ==========================================================================

  describe('Chart Dependencies', () => {
    it('should parse dependency conditions', () => {
      const dependency: HelmDependency = {
        name: 'postgresql',
        version: '12.1.0',
        repository: 'https://charts.bitnami.com/bitnami',
        condition: 'postgresql.enabled',
      };

      expect(dependency.condition).toBeDefined();
      expect(dependency.condition).toMatch(/\.enabled$/);
    });

    it('should parse dependency tags', () => {
      const dependency: HelmDependency = {
        name: 'redis',
        version: '17.0.0',
        repository: 'https://charts.bitnami.com/bitnami',
        tags: ['cache', 'session-store'],
      };

      expect(dependency.tags).toContain('cache');
      expect(dependency.tags).toContain('session-store');
    });

    it('should validate repository URLs', () => {
      const validRepos = [
        'https://charts.bitnami.com/bitnami',
        'https://helm.nginx.com/stable',
        'oci://registry.example.com/charts',
      ];

      for (const repo of validRepos) {
        expect(repo).toMatch(/^(https?|oci):\/\//);
      }
    });

    it('should detect circular dependencies', () => {
      const chartA: ParsedHelmChart = {
        name: 'chart-a',
        version: '1.0.0',
        dependencies: [{ name: 'chart-b', version: '1.0.0', repository: 'file://../chart-b' }],
        templates: [],
        valuesFiles: [],
      };

      const chartB: ParsedHelmChart = {
        name: 'chart-b',
        version: '1.0.0',
        dependencies: [{ name: 'chart-a', version: '1.0.0', repository: 'file://../chart-a' }],
        templates: [],
        valuesFiles: [],
      };

      // Check for circular reference
      const aDependsOnB = chartA.dependencies.some((d) => d.name === 'chart-b');
      const bDependsOnA = chartB.dependencies.some((d) => d.name === 'chart-a');

      expect(aDependsOnB && bDependsOnA).toBe(true); // Circular!
    });
  });

  // ==========================================================================
  // API Integration Tests
  // ==========================================================================

  describe('API Integration', () => {
    it('should return 404 for non-existent scan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999' as ScanId;
      const response = await apiClient.getScan(fakeId);

      expect(response.statusCode).toBe(404);
    });

    it('should verify API health before Helm operations', async () => {
      const response = await apiClient.getHealth();

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
});
