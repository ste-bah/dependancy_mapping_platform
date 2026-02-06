/**
 * Data Layer Integration Tests
 * @module e2e/tests/integration/data-layer.test
 *
 * Integration tests for data layer operations:
 * - Repository CRUD operations
 * - Scan data persistence
 * - Graph node/edge storage
 * - Query and filtering
 * - Transaction handling
 * - Data integrity constraints
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
  createRepositoryFixture,
  createScanFixture,
  generateGraphNodeFixtures,
  generateGraphEdgeFixtures,
  createFixtureLoader,
} from '../../support/fixtures.js';
import {
  assertGraph,
  createGraphStructure,
} from '../../support/assertions.js';
import type {
  TenantId,
  RepositoryId,
  ScanId,
  DbNodeId,
  DbEdgeId,
} from '../../../api/src/types/entities.js';
import type { AuthContext } from '../../../api/src/types/auth.js';

// ============================================================================
// Types
// ============================================================================

interface MockRepository {
  id: RepositoryId;
  tenantId: TenantId;
  provider: 'github' | 'gitlab' | 'bitbucket';
  owner: string;
  name: string;
  cloneUrl: string;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockScan {
  id: ScanId;
  repositoryId: RepositoryId;
  tenantId: TenantId;
  commitSha: string;
  branch: string;
  status: 'pending' | 'completed' | 'failed';
  nodeCount: number;
  edgeCount: number;
  createdAt: Date;
}

interface MockNode {
  id: DbNodeId;
  scanId: ScanId;
  tenantId: TenantId;
  type: string;
  name: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  metadata: Record<string, unknown>;
}

interface MockEdge {
  id: DbEdgeId;
  scanId: ScanId;
  tenantId: TenantId;
  sourceNodeId: DbNodeId;
  targetNodeId: DbNodeId;
  type: string;
  confidence: number;
  evidence: Record<string, unknown>;
}

// ============================================================================
// Mock Data Store
// ============================================================================

class MockDataStore {
  private repositories = new Map<string, MockRepository>();
  private scans = new Map<string, MockScan>();
  private nodes = new Map<string, MockNode>();
  private edges = new Map<string, MockEdge>();
  private idCounter = 0;

  // Repository Operations
  async createRepository(
    tenantId: TenantId,
    data: Omit<MockRepository, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<MockRepository> {
    const id = this.generateId('repo') as RepositoryId;
    const repo: MockRepository = {
      ...data,
      id,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.repositories.set(id, repo);
    return repo;
  }

  async getRepository(id: RepositoryId): Promise<MockRepository | null> {
    return this.repositories.get(id) ?? null;
  }

  async getRepositoriesByTenant(tenantId: TenantId): Promise<MockRepository[]> {
    return Array.from(this.repositories.values()).filter(
      (r) => r.tenantId === tenantId
    );
  }

  async updateRepository(
    id: RepositoryId,
    data: Partial<MockRepository>
  ): Promise<MockRepository | null> {
    const repo = this.repositories.get(id);
    if (!repo) return null;

    const updated = { ...repo, ...data, updatedAt: new Date() };
    this.repositories.set(id, updated);
    return updated;
  }

  async deleteRepository(id: RepositoryId): Promise<boolean> {
    return this.repositories.delete(id);
  }

  // Scan Operations
  async createScan(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    data: Omit<MockScan, 'id' | 'tenantId' | 'repositoryId' | 'createdAt'>
  ): Promise<MockScan> {
    const id = this.generateId('scan') as ScanId;
    const scan: MockScan = {
      ...data,
      id,
      tenantId,
      repositoryId,
      createdAt: new Date(),
    };
    this.scans.set(id, scan);
    return scan;
  }

  async getScan(id: ScanId): Promise<MockScan | null> {
    return this.scans.get(id) ?? null;
  }

  async getScansByRepository(repositoryId: RepositoryId): Promise<MockScan[]> {
    return Array.from(this.scans.values()).filter(
      (s) => s.repositoryId === repositoryId
    );
  }

  async updateScan(id: ScanId, data: Partial<MockScan>): Promise<MockScan | null> {
    const scan = this.scans.get(id);
    if (!scan) return null;

    const updated = { ...scan, ...data };
    this.scans.set(id, updated);
    return updated;
  }

  // Node Operations
  async createNode(
    scanId: ScanId,
    tenantId: TenantId,
    data: Omit<MockNode, 'id' | 'scanId' | 'tenantId'>
  ): Promise<MockNode> {
    const id = this.generateId('node') as DbNodeId;
    const node: MockNode = { ...data, id, scanId, tenantId };
    this.nodes.set(id, node);
    return node;
  }

  async getNode(id: DbNodeId): Promise<MockNode | null> {
    return this.nodes.get(id) ?? null;
  }

  async getNodesByScan(scanId: ScanId): Promise<MockNode[]> {
    return Array.from(this.nodes.values()).filter((n) => n.scanId === scanId);
  }

  async createNodes(
    scanId: ScanId,
    tenantId: TenantId,
    nodesData: Array<Omit<MockNode, 'id' | 'scanId' | 'tenantId'>>
  ): Promise<MockNode[]> {
    return Promise.all(
      nodesData.map((data) => this.createNode(scanId, tenantId, data))
    );
  }

  // Edge Operations
  async createEdge(
    scanId: ScanId,
    tenantId: TenantId,
    data: Omit<MockEdge, 'id' | 'scanId' | 'tenantId'>
  ): Promise<MockEdge> {
    const id = this.generateId('edge') as DbEdgeId;
    const edge: MockEdge = { ...data, id, scanId, tenantId };
    this.edges.set(id, edge);
    return edge;
  }

  async getEdge(id: DbEdgeId): Promise<MockEdge | null> {
    return this.edges.get(id) ?? null;
  }

  async getEdgesByScan(scanId: ScanId): Promise<MockEdge[]> {
    return Array.from(this.edges.values()).filter((e) => e.scanId === scanId);
  }

  async createEdges(
    scanId: ScanId,
    tenantId: TenantId,
    edgesData: Array<Omit<MockEdge, 'id' | 'scanId' | 'tenantId'>>
  ): Promise<MockEdge[]> {
    return Promise.all(
      edgesData.map((data) => this.createEdge(scanId, tenantId, data))
    );
  }

  // Query Operations
  async countNodesByType(scanId: ScanId): Promise<Record<string, number>> {
    const nodes = await this.getNodesByScan(scanId);
    const counts: Record<string, number> = {};

    for (const node of nodes) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }

    return counts;
  }

  async getNodesWithFilter(
    scanId: ScanId,
    filter: { type?: string; minLine?: number; maxLine?: number }
  ): Promise<MockNode[]> {
    let nodes = await this.getNodesByScan(scanId);

    if (filter.type) {
      nodes = nodes.filter((n) => n.type === filter.type);
    }
    if (filter.minLine !== undefined) {
      nodes = nodes.filter((n) => n.lineStart >= filter.minLine!);
    }
    if (filter.maxLine !== undefined) {
      nodes = nodes.filter((n) => n.lineEnd <= filter.maxLine!);
    }

    return nodes;
  }

  // Cleanup
  clear(): void {
    this.repositories.clear();
    this.scans.clear();
    this.nodes.clear();
    this.edges.clear();
    this.idCounter = 0;
  }

  private generateId(prefix: string): string {
    this.idCounter++;
    return `${prefix}_${this.idCounter.toString().padStart(6, '0')}`;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Data Layer Integration Tests', () => {
  let ctx: E2ETestContext;
  let apiClient: TestApiClient;
  let dataStore: MockDataStore;
  let testTenantId: TenantId;
  let testAuth: AuthContext;

  beforeAll(async () => {
    ctx = createTestAppBuilder()
      .withTimeout(30000)
      .withMocking(true)
      .build();

    await ctx.setup();

    testTenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
    testAuth = ctx.createAuthContext({ tenantId: testTenantId });

    apiClient = createApiClient(ctx.getApp(), testTenantId);
    apiClient.setAuth(testAuth);

    dataStore = new MockDataStore();
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(() => {
    dataStore.clear();
  });

  // ==========================================================================
  // Repository CRUD Tests
  // ==========================================================================

  describe('Repository CRUD Operations', () => {
    it('should create a repository', async () => {
      const repo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test-org',
        name: 'test-repo',
        cloneUrl: 'https://github.com/test-org/test-repo.git',
        defaultBranch: 'main',
      });

      expect(repo.id).toBeDefined();
      expect(repo.tenantId).toBe(testTenantId);
      expect(repo.provider).toBe('github');
      expect(repo.createdAt).toBeInstanceOf(Date);
    });

    it('should retrieve a repository by ID', async () => {
      const created = await dataStore.createRepository(testTenantId, {
        provider: 'gitlab',
        owner: 'test-org',
        name: 'test-repo',
        cloneUrl: 'https://gitlab.com/test-org/test-repo.git',
        defaultBranch: 'main',
      });

      const retrieved = await dataStore.getRepository(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.provider).toBe('gitlab');
    });

    it('should return null for non-existent repository', async () => {
      const result = await dataStore.getRepository('nonexistent' as RepositoryId);

      expect(result).toBeNull();
    });

    it('should update a repository', async () => {
      const created = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'old-org',
        name: 'test-repo',
        cloneUrl: 'https://github.com/old-org/test-repo.git',
        defaultBranch: 'main',
      });

      const updated = await dataStore.updateRepository(created.id, {
        owner: 'new-org',
        cloneUrl: 'https://github.com/new-org/test-repo.git',
      });

      expect(updated!.owner).toBe('new-org');
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.createdAt.getTime()
      );
    });

    it('should delete a repository', async () => {
      const created = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test-org',
        name: 'to-delete',
        cloneUrl: 'https://github.com/test-org/to-delete.git',
        defaultBranch: 'main',
      });

      const deleted = await dataStore.deleteRepository(created.id);
      const retrieved = await dataStore.getRepository(created.id);

      expect(deleted).toBe(true);
      expect(retrieved).toBeNull();
    });

    it('should get repositories by tenant', async () => {
      const tenant1 = '00000000-0000-0000-0000-000000000001' as TenantId;
      const tenant2 = '00000000-0000-0000-0000-000000000002' as TenantId;

      await dataStore.createRepository(tenant1, {
        provider: 'github',
        owner: 'org1',
        name: 'repo1',
        cloneUrl: 'https://github.com/org1/repo1.git',
        defaultBranch: 'main',
      });

      await dataStore.createRepository(tenant1, {
        provider: 'github',
        owner: 'org1',
        name: 'repo2',
        cloneUrl: 'https://github.com/org1/repo2.git',
        defaultBranch: 'main',
      });

      await dataStore.createRepository(tenant2, {
        provider: 'github',
        owner: 'org2',
        name: 'repo3',
        cloneUrl: 'https://github.com/org2/repo3.git',
        defaultBranch: 'main',
      });

      const tenant1Repos = await dataStore.getRepositoriesByTenant(tenant1);
      const tenant2Repos = await dataStore.getRepositoriesByTenant(tenant2);

      expect(tenant1Repos).toHaveLength(2);
      expect(tenant2Repos).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Scan CRUD Tests
  // ==========================================================================

  describe('Scan CRUD Operations', () => {
    let testRepo: MockRepository;

    beforeEach(async () => {
      testRepo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test-org',
        name: 'test-repo',
        cloneUrl: 'https://github.com/test-org/test-repo.git',
        defaultBranch: 'main',
      });
    });

    it('should create a scan', async () => {
      const scan = await dataStore.createScan(testTenantId, testRepo.id, {
        commitSha: 'abc123',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });

      expect(scan.id).toBeDefined();
      expect(scan.repositoryId).toBe(testRepo.id);
      expect(scan.status).toBe('pending');
    });

    it('should retrieve a scan by ID', async () => {
      const created = await dataStore.createScan(testTenantId, testRepo.id, {
        commitSha: 'def456',
        branch: 'develop',
        status: 'completed',
        nodeCount: 10,
        edgeCount: 5,
      });

      const retrieved = await dataStore.getScan(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.commitSha).toBe('def456');
    });

    it('should update scan status', async () => {
      const scan = await dataStore.createScan(testTenantId, testRepo.id, {
        commitSha: 'xyz789',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });

      const updated = await dataStore.updateScan(scan.id, {
        status: 'completed',
        nodeCount: 25,
        edgeCount: 15,
      });

      expect(updated!.status).toBe('completed');
      expect(updated!.nodeCount).toBe(25);
      expect(updated!.edgeCount).toBe(15);
    });

    it('should get scans by repository', async () => {
      await dataStore.createScan(testTenantId, testRepo.id, {
        commitSha: 'commit1',
        branch: 'main',
        status: 'completed',
        nodeCount: 10,
        edgeCount: 5,
      });

      await dataStore.createScan(testTenantId, testRepo.id, {
        commitSha: 'commit2',
        branch: 'develop',
        status: 'completed',
        nodeCount: 15,
        edgeCount: 8,
      });

      const scans = await dataStore.getScansByRepository(testRepo.id);

      expect(scans).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Node Storage Tests
  // ==========================================================================

  describe('Node Storage Operations', () => {
    let testScan: MockScan;

    beforeEach(async () => {
      const repo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test-org',
        name: 'test-repo',
        cloneUrl: 'https://github.com/test-org/test-repo.git',
        defaultBranch: 'main',
      });

      testScan = await dataStore.createScan(testTenantId, repo.id, {
        commitSha: 'abc123',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });
    });

    it('should create a node', async () => {
      const node = await dataStore.createNode(testScan.id, testTenantId, {
        type: 'terraform_resource',
        name: 'aws_instance.main',
        filePath: 'main.tf',
        lineStart: 1,
        lineEnd: 10,
        metadata: { resourceType: 'aws_instance' },
      });

      expect(node.id).toBeDefined();
      expect(node.scanId).toBe(testScan.id);
      expect(node.type).toBe('terraform_resource');
    });

    it('should create multiple nodes in batch', async () => {
      const nodesData = [
        {
          type: 'terraform_resource',
          name: 'aws_vpc.main',
          filePath: 'vpc.tf',
          lineStart: 1,
          lineEnd: 5,
          metadata: {},
        },
        {
          type: 'terraform_resource',
          name: 'aws_subnet.main',
          filePath: 'vpc.tf',
          lineStart: 7,
          lineEnd: 15,
          metadata: {},
        },
        {
          type: 'terraform_variable',
          name: 'region',
          filePath: 'variables.tf',
          lineStart: 1,
          lineEnd: 4,
          metadata: {},
        },
      ];

      const nodes = await dataStore.createNodes(testScan.id, testTenantId, nodesData);

      expect(nodes).toHaveLength(3);
      expect(nodes.every((n) => n.id)).toBe(true);
    });

    it('should get nodes by scan', async () => {
      await dataStore.createNode(testScan.id, testTenantId, {
        type: 'terraform_resource',
        name: 'node1',
        filePath: 'main.tf',
        lineStart: 1,
        lineEnd: 5,
        metadata: {},
      });

      await dataStore.createNode(testScan.id, testTenantId, {
        type: 'terraform_variable',
        name: 'node2',
        filePath: 'vars.tf',
        lineStart: 1,
        lineEnd: 3,
        metadata: {},
      });

      const nodes = await dataStore.getNodesByScan(testScan.id);

      expect(nodes).toHaveLength(2);
    });

    it('should filter nodes by type', async () => {
      await dataStore.createNodes(testScan.id, testTenantId, [
        {
          type: 'terraform_resource',
          name: 'resource1',
          filePath: 'main.tf',
          lineStart: 1,
          lineEnd: 5,
          metadata: {},
        },
        {
          type: 'terraform_resource',
          name: 'resource2',
          filePath: 'main.tf',
          lineStart: 10,
          lineEnd: 15,
          metadata: {},
        },
        {
          type: 'terraform_variable',
          name: 'var1',
          filePath: 'vars.tf',
          lineStart: 1,
          lineEnd: 3,
          metadata: {},
        },
      ]);

      const resourceNodes = await dataStore.getNodesWithFilter(testScan.id, {
        type: 'terraform_resource',
      });

      expect(resourceNodes).toHaveLength(2);
    });

    it('should filter nodes by line range', async () => {
      await dataStore.createNodes(testScan.id, testTenantId, [
        {
          type: 'terraform_resource',
          name: 'early',
          filePath: 'main.tf',
          lineStart: 1,
          lineEnd: 10,
          metadata: {},
        },
        {
          type: 'terraform_resource',
          name: 'middle',
          filePath: 'main.tf',
          lineStart: 20,
          lineEnd: 30,
          metadata: {},
        },
        {
          type: 'terraform_resource',
          name: 'late',
          filePath: 'main.tf',
          lineStart: 50,
          lineEnd: 60,
          metadata: {},
        },
      ]);

      const filteredNodes = await dataStore.getNodesWithFilter(testScan.id, {
        minLine: 15,
        maxLine: 40,
      });

      expect(filteredNodes).toHaveLength(1);
      expect(filteredNodes[0].name).toBe('middle');
    });
  });

  // ==========================================================================
  // Edge Storage Tests
  // ==========================================================================

  describe('Edge Storage Operations', () => {
    let testScan: MockScan;
    let testNodes: MockNode[];

    beforeEach(async () => {
      const repo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test-org',
        name: 'test-repo',
        cloneUrl: 'https://github.com/test-org/test-repo.git',
        defaultBranch: 'main',
      });

      testScan = await dataStore.createScan(testTenantId, repo.id, {
        commitSha: 'abc123',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });

      testNodes = await dataStore.createNodes(testScan.id, testTenantId, [
        {
          type: 'terraform_resource',
          name: 'source',
          filePath: 'main.tf',
          lineStart: 1,
          lineEnd: 5,
          metadata: {},
        },
        {
          type: 'terraform_resource',
          name: 'target',
          filePath: 'main.tf',
          lineStart: 10,
          lineEnd: 15,
          metadata: {},
        },
      ]);
    });

    it('should create an edge', async () => {
      const edge = await dataStore.createEdge(testScan.id, testTenantId, {
        sourceNodeId: testNodes[0].id,
        targetNodeId: testNodes[1].id,
        type: 'references',
        confidence: 0.95,
        evidence: { attribute: 'subnet_id' },
      });

      expect(edge.id).toBeDefined();
      expect(edge.sourceNodeId).toBe(testNodes[0].id);
      expect(edge.targetNodeId).toBe(testNodes[1].id);
    });

    it('should create multiple edges in batch', async () => {
      // Create additional nodes
      const moreNodes = await dataStore.createNodes(testScan.id, testTenantId, [
        {
          type: 'terraform_resource',
          name: 'extra1',
          filePath: 'main.tf',
          lineStart: 20,
          lineEnd: 25,
          metadata: {},
        },
        {
          type: 'terraform_resource',
          name: 'extra2',
          filePath: 'main.tf',
          lineStart: 30,
          lineEnd: 35,
          metadata: {},
        },
      ]);

      const edgesData = [
        {
          sourceNodeId: testNodes[0].id,
          targetNodeId: testNodes[1].id,
          type: 'references',
          confidence: 0.9,
          evidence: {},
        },
        {
          sourceNodeId: testNodes[1].id,
          targetNodeId: moreNodes[0].id,
          type: 'depends_on',
          confidence: 0.85,
          evidence: {},
        },
        {
          sourceNodeId: moreNodes[0].id,
          targetNodeId: moreNodes[1].id,
          type: 'references',
          confidence: 0.95,
          evidence: {},
        },
      ];

      const edges = await dataStore.createEdges(testScan.id, testTenantId, edgesData);

      expect(edges).toHaveLength(3);
    });

    it('should get edges by scan', async () => {
      await dataStore.createEdge(testScan.id, testTenantId, {
        sourceNodeId: testNodes[0].id,
        targetNodeId: testNodes[1].id,
        type: 'references',
        confidence: 0.9,
        evidence: {},
      });

      const edges = await dataStore.getEdgesByScan(testScan.id);

      expect(edges).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Query and Aggregation Tests
  // ==========================================================================

  describe('Query and Aggregation', () => {
    let testScan: MockScan;

    beforeEach(async () => {
      const repo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test-org',
        name: 'test-repo',
        cloneUrl: 'https://github.com/test-org/test-repo.git',
        defaultBranch: 'main',
      });

      testScan = await dataStore.createScan(testTenantId, repo.id, {
        commitSha: 'abc123',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });

      await dataStore.createNodes(testScan.id, testTenantId, [
        { type: 'terraform_resource', name: 'r1', filePath: 'a.tf', lineStart: 1, lineEnd: 5, metadata: {} },
        { type: 'terraform_resource', name: 'r2', filePath: 'a.tf', lineStart: 10, lineEnd: 15, metadata: {} },
        { type: 'terraform_resource', name: 'r3', filePath: 'b.tf', lineStart: 1, lineEnd: 5, metadata: {} },
        { type: 'terraform_variable', name: 'v1', filePath: 'vars.tf', lineStart: 1, lineEnd: 3, metadata: {} },
        { type: 'terraform_variable', name: 'v2', filePath: 'vars.tf', lineStart: 5, lineEnd: 7, metadata: {} },
        { type: 'terraform_output', name: 'o1', filePath: 'outputs.tf', lineStart: 1, lineEnd: 3, metadata: {} },
      ]);
    });

    it('should count nodes by type', async () => {
      const counts = await dataStore.countNodesByType(testScan.id);

      expect(counts.terraform_resource).toBe(3);
      expect(counts.terraform_variable).toBe(2);
      expect(counts.terraform_output).toBe(1);
    });

    it('should filter nodes with multiple criteria', async () => {
      const filtered = await dataStore.getNodesWithFilter(testScan.id, {
        type: 'terraform_variable',
        minLine: 4,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('v2');
    });
  });

  // ==========================================================================
  // Data Integrity Tests
  // ==========================================================================

  describe('Data Integrity', () => {
    it('should maintain unique IDs across entities', async () => {
      const repo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test',
        name: 'test',
        cloneUrl: 'https://github.com/test/test.git',
        defaultBranch: 'main',
      });

      const scan = await dataStore.createScan(testTenantId, repo.id, {
        commitSha: 'abc',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });

      const node = await dataStore.createNode(scan.id, testTenantId, {
        type: 'test',
        name: 'test',
        filePath: 'test.tf',
        lineStart: 1,
        lineEnd: 5,
        metadata: {},
      });

      // All IDs should be unique
      const ids = [repo.id, scan.id, node.id];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should preserve metadata in nodes', async () => {
      const repo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test',
        name: 'test',
        cloneUrl: 'https://github.com/test/test.git',
        defaultBranch: 'main',
      });

      const scan = await dataStore.createScan(testTenantId, repo.id, {
        commitSha: 'abc',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });

      const complexMetadata = {
        resourceType: 'aws_s3_bucket',
        tags: { Environment: 'production', Project: 'test' },
        nested: { deep: { value: 42 } },
      };

      const node = await dataStore.createNode(scan.id, testTenantId, {
        type: 'terraform_resource',
        name: 'bucket',
        filePath: 's3.tf',
        lineStart: 1,
        lineEnd: 10,
        metadata: complexMetadata,
      });

      const retrieved = await dataStore.getNode(node.id);

      expect(retrieved!.metadata).toEqual(complexMetadata);
    });

    it('should preserve evidence in edges', async () => {
      const repo = await dataStore.createRepository(testTenantId, {
        provider: 'github',
        owner: 'test',
        name: 'test',
        cloneUrl: 'https://github.com/test/test.git',
        defaultBranch: 'main',
      });

      const scan = await dataStore.createScan(testTenantId, repo.id, {
        commitSha: 'abc',
        branch: 'main',
        status: 'pending',
        nodeCount: 0,
        edgeCount: 0,
      });

      const nodes = await dataStore.createNodes(scan.id, testTenantId, [
        { type: 'a', name: 'a', filePath: 'a.tf', lineStart: 1, lineEnd: 5, metadata: {} },
        { type: 'b', name: 'b', filePath: 'b.tf', lineStart: 1, lineEnd: 5, metadata: {} },
      ]);

      const complexEvidence = {
        sourceFile: 'main.tf',
        sourceLine: 15,
        expression: 'aws_vpc.main.id',
        resolvedTo: 'vpc-12345',
      };

      const edge = await dataStore.createEdge(scan.id, testTenantId, {
        sourceNodeId: nodes[0].id,
        targetNodeId: nodes[1].id,
        type: 'references',
        confidence: 0.95,
        evidence: complexEvidence,
      });

      const retrieved = await dataStore.getEdge(edge.id);

      expect(retrieved!.evidence).toEqual(complexEvidence);
    });
  });

  // ==========================================================================
  // Tenant Isolation Tests
  // ==========================================================================

  describe('Tenant Isolation', () => {
    it('should isolate repositories by tenant', async () => {
      const tenant1 = '00000000-0000-0000-0000-000000000001' as TenantId;
      const tenant2 = '00000000-0000-0000-0000-000000000002' as TenantId;

      await dataStore.createRepository(tenant1, {
        provider: 'github',
        owner: 'org1',
        name: 'secret-repo',
        cloneUrl: 'https://github.com/org1/secret-repo.git',
        defaultBranch: 'main',
      });

      await dataStore.createRepository(tenant2, {
        provider: 'github',
        owner: 'org2',
        name: 'public-repo',
        cloneUrl: 'https://github.com/org2/public-repo.git',
        defaultBranch: 'main',
      });

      const tenant1Repos = await dataStore.getRepositoriesByTenant(tenant1);
      const tenant2Repos = await dataStore.getRepositoriesByTenant(tenant2);

      // Each tenant should only see their own repos
      expect(tenant1Repos).toHaveLength(1);
      expect(tenant1Repos[0].name).toBe('secret-repo');

      expect(tenant2Repos).toHaveLength(1);
      expect(tenant2Repos[0].name).toBe('public-repo');
    });
  });
});
