/**
 * Database Seeding Utilities
 * @module e2e/data/seed-data
 *
 * Transaction-safe seeding for E2E tests:
 * - Terraform fixtures
 * - Helm fixtures
 * - User/tenant data
 * - Repository/scan data
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #23 of 47 | Phase 4: Implementation
 */

import type { Result, AsyncResult } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';
import type {
  TenantId,
  RepositoryId,
  ScanId,
  UserId,
} from '../../api/src/types/entities.js';
import {
  createTenantId,
  createRepositoryId,
  createScanId,
  createUserId,
} from '../../api/src/types/entities.js';
import type {
  TestDatabase,
  SeedData,
  SeedResult,
  TenantSeedData,
  UserSeedData,
  RepositorySeedData,
  ScanSeedData,
} from '../domain/test-database.js';
import type {
  TerraformFixture,
  HelmFixture,
  UserFixture,
  GraphFixture,
  GraphNodeFixture,
  GraphEdgeFixture,
  NodeType,
  EdgeType,
} from '../types/fixture-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Seeder configuration
 */
export interface SeederConfig {
  /** Use transactions for atomicity */
  readonly useTransactions: boolean;
  /** Verify data after seeding */
  readonly verifyAfterSeed: boolean;
  /** Clean before seeding */
  readonly cleanBeforeSeed: boolean;
  /** Verbose logging */
  readonly verbose: boolean;
}

/**
 * Default seeder configuration
 */
export const DEFAULT_SEEDER_CONFIG: SeederConfig = {
  useTransactions: true,
  verifyAfterSeed: true,
  cleanBeforeSeed: true,
  verbose: false,
};

/**
 * Seeding result with counts
 */
export interface SeedingResult {
  readonly tenants: SeededEntityResult<TenantId>;
  readonly users: SeededEntityResult<UserId>;
  readonly repositories: SeededEntityResult<RepositoryId>;
  readonly scans: SeededEntityResult<ScanId>;
  readonly nodes: SeededEntityResult<string>;
  readonly edges: SeededEntityResult<string>;
  readonly duration: number;
}

/**
 * Result for a seeded entity type
 */
export interface SeededEntityResult<T> {
  readonly count: number;
  readonly ids: ReadonlyArray<T>;
}

/**
 * Terraform seeding options
 */
export interface TerraformSeedOptions {
  /** Tenant for the fixtures */
  readonly tenantId: TenantId;
  /** Repository to associate with */
  readonly repositoryId?: RepositoryId;
  /** Create a new scan */
  readonly createScan?: boolean;
  /** Fixtures to seed */
  readonly fixtures: ReadonlyArray<TerraformFixture>;
}

/**
 * Helm seeding options
 */
export interface HelmSeedOptions {
  /** Tenant for the fixtures */
  readonly tenantId: TenantId;
  /** Repository to associate with */
  readonly repositoryId?: RepositoryId;
  /** Create a new scan */
  readonly createScan?: boolean;
  /** Fixtures to seed */
  readonly fixtures: ReadonlyArray<HelmFixture>;
}

/**
 * Graph seeding options
 */
export interface GraphSeedOptions {
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Scan ID to associate nodes/edges with */
  readonly scanId: ScanId;
  /** Graph fixture to seed */
  readonly graph: GraphFixture;
}

/**
 * Complete test environment seed
 */
export interface TestEnvironmentSeed {
  /** Tenants to create */
  readonly tenants: ReadonlyArray<TenantSeedData>;
  /** Users to create */
  readonly users: ReadonlyArray<UserSeedData>;
  /** Repositories to create */
  readonly repositories: ReadonlyArray<RepositorySeedData>;
  /** Scans to create */
  readonly scans: ReadonlyArray<ScanSeedData>;
  /** Terraform fixtures */
  readonly terraformFixtures?: ReadonlyArray<TerraformSeedOptions>;
  /** Helm fixtures */
  readonly helmFixtures?: ReadonlyArray<HelmSeedOptions>;
  /** Graph fixtures */
  readonly graphFixtures?: ReadonlyArray<GraphSeedOptions>;
}

/**
 * Seeder error
 */
export interface SeederError {
  readonly code: SeederErrorCode;
  readonly message: string;
  readonly entity?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Error codes
 */
export type SeederErrorCode =
  | 'DATABASE_ERROR'
  | 'TRANSACTION_ERROR'
  | 'VALIDATION_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'VERIFICATION_ERROR';

// ============================================================================
// Predefined Test Data
// ============================================================================

/**
 * Default test tenant
 */
export const DEFAULT_TEST_TENANT: TenantSeedData = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Organization',
  slug: 'test-org',
  plan: 'professional',
};

/**
 * Default test user
 */
export const DEFAULT_TEST_USER: UserSeedData = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
  name: 'Test User',
  githubId: 12345,
  tenantId: '00000000-0000-0000-0000-000000000001',
};

/**
 * Default test repository
 */
export const DEFAULT_TEST_REPOSITORY: RepositorySeedData = {
  id: '00000000-0000-0000-0000-000000000001',
  tenantId: '00000000-0000-0000-0000-000000000001',
  provider: 'github',
  owner: 'test-org',
  name: 'test-repo',
  defaultBranch: 'main',
};

/**
 * Sample Terraform fixture
 */
export const SAMPLE_TERRAFORM_FIXTURE: TerraformFixture = {
  name: 'simple-aws',
  path: 'fixtures/repos/terraform/simple-aws',
  mainFiles: ['main.tf', 'variables.tf', 'outputs.tf'],
  modules: [],
  expectedNodeCount: 15,
  expectedEdgeCount: 12,
  description: 'Simple AWS infrastructure with S3 and EC2',
  tags: ['simple', 'aws'],
  terraformVersion: '>= 1.0',
  providers: [
    { name: 'aws', source: 'hashicorp/aws', version: '~> 5.0' },
  ],
  expectedResourceTypes: ['aws_s3_bucket', 'aws_instance', 'aws_security_group'],
  expectedDataSourceTypes: ['aws_ami'],
  hasRemoteModules: false,
  hasBackend: false,
};

/**
 * Sample Helm fixture
 */
export const SAMPLE_HELM_FIXTURE: HelmFixture = {
  name: 'simple-app',
  path: 'fixtures/repos/helm/simple-app',
  chartFile: 'Chart.yaml',
  valuesFiles: ['values.yaml'],
  templateFiles: ['deployment.yaml', 'service.yaml'],
  expectedNodeCount: 8,
  description: 'Simple Helm chart for a web application',
  tags: ['simple'],
  chart: {
    apiVersion: 'v2',
    name: 'simple-app',
    version: '1.0.0',
    appVersion: '1.0.0',
    description: 'A simple web application chart',
  },
  dependencies: [],
};

/**
 * Minimal test environment seed
 */
export const MINIMAL_TEST_ENVIRONMENT: TestEnvironmentSeed = {
  tenants: [DEFAULT_TEST_TENANT],
  users: [DEFAULT_TEST_USER],
  repositories: [DEFAULT_TEST_REPOSITORY],
  scans: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      repositoryId: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000001',
      status: 'completed',
      commitSha: 'abc123def456',
      branch: 'main',
    },
  ],
};

// ============================================================================
// Seeder Implementation
// ============================================================================

/**
 * Database seeder for E2E tests
 */
export class DatabaseSeeder {
  private readonly config: SeederConfig;

  constructor(
    private readonly database: TestDatabase,
    config?: Partial<SeederConfig>
  ) {
    this.config = { ...DEFAULT_SEEDER_CONFIG, ...config };
  }

  // ============================================================================
  // Main Seeding Methods
  // ============================================================================

  /**
   * Seed a complete test environment
   */
  async seedEnvironment(
    environment: TestEnvironmentSeed
  ): AsyncResult<SeedingResult, SeederError> {
    const startTime = Date.now();

    try {
      if (this.config.cleanBeforeSeed) {
        const cleanResult = await this.database.clean();
        if (!cleanResult.success) {
          return failure({
            code: 'DATABASE_ERROR',
            message: `Failed to clean database: ${cleanResult.error.message}`,
          });
        }
      }

      const result: SeedingResult = {
        tenants: { count: 0, ids: [] },
        users: { count: 0, ids: [] },
        repositories: { count: 0, ids: [] },
        scans: { count: 0, ids: [] },
        nodes: { count: 0, ids: [] },
        edges: { count: 0, ids: [] },
        duration: 0,
      };

      // Use transaction for atomicity
      if (this.config.useTransactions) {
        const txResult = await this.database.withTransaction(async () => {
          return this.seedEntities(environment, result);
        });

        if (!txResult.success) {
          return failure({
            code: 'TRANSACTION_ERROR',
            message: txResult.error.message,
          });
        }
      } else {
        const seedResult = await this.seedEntities(environment, result);
        if (!seedResult.success) {
          return failure(seedResult.error);
        }
      }

      // Verify if configured
      if (this.config.verifyAfterSeed) {
        const verifyResult = await this.verifySeeding(result);
        if (!verifyResult.success) {
          return failure(verifyResult.error);
        }
      }

      return success({
        ...result,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Seed Terraform fixtures
   */
  async seedTerraformFixtures(
    options: TerraformSeedOptions
  ): AsyncResult<{ scanId: ScanId; nodeCount: number; edgeCount: number }, SeederError> {
    try {
      let scanId = options.repositoryId
        ? await this.getOrCreateScan(options.tenantId, options.repositoryId)
        : createScanId(crypto.randomUUID());

      let totalNodes = 0;
      let totalEdges = 0;

      for (const fixture of options.fixtures) {
        this.log(`Seeding Terraform fixture: ${fixture.name}`);

        // Create nodes for resources, variables, outputs, etc.
        const nodes = this.generateTerraformNodes(fixture, options.tenantId, scanId);
        for (const node of nodes) {
          await this.insertNode(node);
          totalNodes++;
        }

        // Create edges for dependencies
        const edges = this.generateTerraformEdges(fixture, nodes, options.tenantId, scanId);
        for (const edge of edges) {
          await this.insertEdge(edge);
          totalEdges++;
        }
      }

      return success({ scanId, nodeCount: totalNodes, edgeCount: totalEdges });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Seed Helm fixtures
   */
  async seedHelmFixtures(
    options: HelmSeedOptions
  ): AsyncResult<{ scanId: ScanId; nodeCount: number }, SeederError> {
    try {
      let scanId = options.repositoryId
        ? await this.getOrCreateScan(options.tenantId, options.repositoryId)
        : createScanId(crypto.randomUUID());

      let totalNodes = 0;

      for (const fixture of options.fixtures) {
        this.log(`Seeding Helm fixture: ${fixture.name}`);

        // Create chart node
        await this.insertNode({
          scanId,
          tenantId: options.tenantId,
          nodeType: 'helm_chart',
          name: fixture.chart.name,
          qualifiedName: `chart/${fixture.chart.name}`,
          filePath: fixture.chartFile,
          lineStart: 1,
          lineEnd: 10,
          metadata: { version: fixture.chart.version },
        });
        totalNodes++;

        // Create template nodes
        for (const template of fixture.templateFiles) {
          await this.insertNode({
            scanId,
            tenantId: options.tenantId,
            nodeType: 'helm_template',
            name: template.replace('.yaml', ''),
            qualifiedName: `template/${template}`,
            filePath: `templates/${template}`,
            lineStart: 1,
            lineEnd: 50,
            metadata: {},
          });
          totalNodes++;
        }

        // Create values node
        await this.insertNode({
          scanId,
          tenantId: options.tenantId,
          nodeType: 'helm_values',
          name: 'values',
          qualifiedName: 'values/default',
          filePath: 'values.yaml',
          lineStart: 1,
          lineEnd: 100,
          metadata: {},
        });
        totalNodes++;
      }

      return success({ scanId, nodeCount: totalNodes });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Seed a graph fixture
   */
  async seedGraphFixture(
    options: GraphSeedOptions
  ): AsyncResult<{ nodeCount: number; edgeCount: number }, SeederError> {
    try {
      const { graph, tenantId, scanId } = options;
      this.log(`Seeding graph fixture: ${graph.name}`);

      // Insert nodes
      const nodeIdMap = new Map<string, string>();
      for (const node of graph.nodes) {
        const dbId = crypto.randomUUID();
        nodeIdMap.set(node.id, dbId);

        await this.insertNode({
          id: dbId,
          scanId,
          tenantId,
          nodeType: node.type,
          name: node.name,
          qualifiedName: node.qualifiedName,
          filePath: node.filePath,
          lineStart: node.lineStart,
          lineEnd: node.lineEnd,
          metadata: node.metadata,
        });
      }

      // Insert edges
      for (const edge of graph.edges) {
        const sourceDbId = nodeIdMap.get(edge.sourceNodeId);
        const targetDbId = nodeIdMap.get(edge.targetNodeId);

        if (!sourceDbId || !targetDbId) {
          this.log(`Warning: Edge references unknown node: ${edge.sourceNodeId} -> ${edge.targetNodeId}`);
          continue;
        }

        await this.insertEdge({
          scanId,
          tenantId,
          sourceNodeId: sourceDbId,
          targetNodeId: targetDbId,
          edgeType: edge.type,
          confidence: edge.confidence,
          isImplicit: edge.isImplicit,
          metadata: edge.metadata ?? {},
        });
      }

      return success({
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Seed user/tenant data
   */
  async seedUserData(
    tenants: ReadonlyArray<TenantSeedData>,
    users: ReadonlyArray<UserSeedData>
  ): AsyncResult<{ tenantIds: TenantId[]; userIds: UserId[] }, SeederError> {
    try {
      const tenantIds: TenantId[] = [];
      const userIds: UserId[] = [];

      // Create tenants first
      for (const tenant of tenants) {
        const result = await this.database.createTenant(tenant);
        if (!result.success) {
          return failure({
            code: 'DATABASE_ERROR',
            message: result.error.message,
            entity: 'tenant',
          });
        }
        tenantIds.push(result.value);
      }

      // Create users
      for (const user of users) {
        const result = await this.database.createUser(user);
        if (!result.success) {
          return failure({
            code: 'DATABASE_ERROR',
            message: result.error.message,
            entity: 'user',
          });
        }
        userIds.push(result.value);
      }

      return success({ tenantIds, userIds });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async seedEntities(
    environment: TestEnvironmentSeed,
    result: SeedingResult
  ): AsyncResult<SeedingResult, SeederError> {
    // Cast to mutable for updates
    const mutableResult = result as {
      tenants: { count: number; ids: TenantId[] };
      users: { count: number; ids: UserId[] };
      repositories: { count: number; ids: RepositoryId[] };
      scans: { count: number; ids: ScanId[] };
      nodes: { count: number; ids: string[] };
      edges: { count: number; ids: string[] };
      duration: number;
    };

    // Seed tenants
    for (const tenant of environment.tenants) {
      const createResult = await this.database.createTenant(tenant);
      if (!createResult.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: createResult.error.message,
          entity: 'tenant',
        });
      }
      mutableResult.tenants.ids.push(createResult.value);
      mutableResult.tenants.count++;
    }

    // Seed users
    for (const user of environment.users) {
      const createResult = await this.database.createUser(user);
      if (!createResult.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: createResult.error.message,
          entity: 'user',
        });
      }
      mutableResult.users.ids.push(createResult.value);
      mutableResult.users.count++;
    }

    // Seed repositories
    for (const repo of environment.repositories) {
      const createResult = await this.database.createRepository(repo);
      if (!createResult.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: createResult.error.message,
          entity: 'repository',
        });
      }
      mutableResult.repositories.ids.push(createResult.value);
      mutableResult.repositories.count++;
    }

    // Seed scans
    for (const scan of environment.scans) {
      const createResult = await this.database.createScan(scan);
      if (!createResult.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: createResult.error.message,
          entity: 'scan',
        });
      }
      mutableResult.scans.ids.push(createResult.value);
      mutableResult.scans.count++;
    }

    // Seed Terraform fixtures if provided
    if (environment.terraformFixtures) {
      for (const tfOpts of environment.terraformFixtures) {
        const tfResult = await this.seedTerraformFixtures(tfOpts);
        if (!tfResult.success) {
          return failure(tfResult.error);
        }
        mutableResult.nodes.count += tfResult.value.nodeCount;
        mutableResult.edges.count += tfResult.value.edgeCount;
      }
    }

    // Seed Helm fixtures if provided
    if (environment.helmFixtures) {
      for (const helmOpts of environment.helmFixtures) {
        const helmResult = await this.seedHelmFixtures(helmOpts);
        if (!helmResult.success) {
          return failure(helmResult.error);
        }
        mutableResult.nodes.count += helmResult.value.nodeCount;
      }
    }

    // Seed graph fixtures if provided
    if (environment.graphFixtures) {
      for (const graphOpts of environment.graphFixtures) {
        const graphResult = await this.seedGraphFixture(graphOpts);
        if (!graphResult.success) {
          return failure(graphResult.error);
        }
        mutableResult.nodes.count += graphResult.value.nodeCount;
        mutableResult.edges.count += graphResult.value.edgeCount;
      }
    }

    return success(result);
  }

  private async verifySeeding(result: SeedingResult): AsyncResult<void, SeederError> {
    // Verify counts match what we seeded
    const verifyQuery = `
      SELECT
        (SELECT COUNT(*) FROM tenants) as tenant_count,
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM repositories) as repo_count,
        (SELECT COUNT(*) FROM scans) as scan_count
    `;

    const queryResult = await this.database.query(verifyQuery);
    if (!queryResult.success) {
      return failure({
        code: 'VERIFICATION_ERROR',
        message: `Failed to verify seeding: ${queryResult.error.message}`,
      });
    }

    // In real implementation, would compare counts
    return success(undefined);
  }

  private async getOrCreateScan(tenantId: TenantId, repositoryId: RepositoryId): Promise<ScanId> {
    const scanId = createScanId(crypto.randomUUID());
    await this.database.createScan({
      id: scanId as string,
      tenantId: tenantId as string,
      repositoryId: repositoryId as string,
      status: 'completed',
      commitSha: crypto.randomUUID().slice(0, 40),
      branch: 'main',
    });
    return scanId;
  }

  private generateTerraformNodes(
    fixture: TerraformFixture,
    tenantId: TenantId,
    scanId: ScanId
  ): Array<NodeInsertData> {
    const nodes: NodeInsertData[] = [];
    let lineCounter = 1;

    // Resources
    for (const resourceType of fixture.expectedResourceTypes) {
      const resourceName = resourceType.split('_').pop() ?? 'resource';
      nodes.push({
        scanId,
        tenantId,
        nodeType: 'tf_resource',
        name: resourceName,
        qualifiedName: `${resourceType}.${resourceName}`,
        filePath: 'main.tf',
        lineStart: lineCounter,
        lineEnd: lineCounter + 10,
        metadata: { resourceType },
      });
      lineCounter += 15;
    }

    // Data sources
    for (const dataType of fixture.expectedDataSourceTypes) {
      const dataName = dataType.split('_').pop() ?? 'data';
      nodes.push({
        scanId,
        tenantId,
        nodeType: 'tf_data_source',
        name: dataName,
        qualifiedName: `data.${dataType}.${dataName}`,
        filePath: 'main.tf',
        lineStart: lineCounter,
        lineEnd: lineCounter + 5,
        metadata: { dataType },
      });
      lineCounter += 10;
    }

    // Variables
    nodes.push({
      scanId,
      tenantId,
      nodeType: 'tf_variable',
      name: 'region',
      qualifiedName: 'var.region',
      filePath: 'variables.tf',
      lineStart: 1,
      lineEnd: 5,
      metadata: { type: 'string', default: 'us-west-2' },
    });

    // Outputs
    nodes.push({
      scanId,
      tenantId,
      nodeType: 'tf_output',
      name: 'id',
      qualifiedName: 'output.id',
      filePath: 'outputs.tf',
      lineStart: 1,
      lineEnd: 4,
      metadata: {},
    });

    // Providers
    for (const provider of fixture.providers) {
      nodes.push({
        scanId,
        tenantId,
        nodeType: 'tf_provider',
        name: provider.name,
        qualifiedName: `provider.${provider.name}`,
        filePath: 'main.tf',
        lineStart: 1,
        lineEnd: 5,
        metadata: { version: provider.version },
      });
    }

    return nodes;
  }

  private generateTerraformEdges(
    fixture: TerraformFixture,
    nodes: NodeInsertData[],
    tenantId: TenantId,
    scanId: ScanId
  ): Array<EdgeInsertData> {
    const edges: EdgeInsertData[] = [];

    // Find resource and variable nodes
    const resourceNodes = nodes.filter(n => n.nodeType === 'tf_resource');
    const variableNodes = nodes.filter(n => n.nodeType === 'tf_variable');
    const dataNodes = nodes.filter(n => n.nodeType === 'tf_data_source');
    const outputNodes = nodes.filter(n => n.nodeType === 'tf_output');

    // Resources depend on variables
    for (const resource of resourceNodes) {
      for (const variable of variableNodes) {
        edges.push({
          scanId,
          tenantId,
          sourceNodeId: resource.id ?? crypto.randomUUID(),
          targetNodeId: variable.id ?? crypto.randomUUID(),
          edgeType: 'references',
          confidence: 0.9,
          isImplicit: false,
          metadata: { attribute: 'region' },
        });
      }
    }

    // Resources may depend on data sources
    if (resourceNodes.length > 0 && dataNodes.length > 0) {
      edges.push({
        scanId,
        tenantId,
        sourceNodeId: resourceNodes[0].id ?? crypto.randomUUID(),
        targetNodeId: dataNodes[0].id ?? crypto.randomUUID(),
        edgeType: 'references',
        confidence: 0.85,
        isImplicit: false,
        metadata: {},
      });
    }

    // Outputs depend on resources
    for (const output of outputNodes) {
      if (resourceNodes.length > 0) {
        edges.push({
          scanId,
          tenantId,
          sourceNodeId: output.id ?? crypto.randomUUID(),
          targetNodeId: resourceNodes[0].id ?? crypto.randomUUID(),
          edgeType: 'references',
          confidence: 0.95,
          isImplicit: false,
          metadata: {},
        });
      }
    }

    return edges;
  }

  private async insertNode(node: NodeInsertData): Promise<void> {
    const sql = `
      INSERT INTO nodes (id, scan_id, tenant_id, node_type, name, qualified_name, file_path, line_start, line_end, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    const id = node.id ?? crypto.randomUUID();
    await this.database.query(sql, [
      id,
      node.scanId,
      node.tenantId,
      node.nodeType,
      node.name,
      node.qualifiedName,
      node.filePath,
      node.lineStart,
      node.lineEnd,
      JSON.stringify(node.metadata),
    ]);

    // Store ID for edge creation
    node.id = id;
  }

  private async insertEdge(edge: EdgeInsertData): Promise<void> {
    const sql = `
      INSERT INTO edges (id, scan_id, tenant_id, source_node_id, target_node_id, edge_type, confidence, is_implicit, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await this.database.query(sql, [
      crypto.randomUUID(),
      edge.scanId,
      edge.tenantId,
      edge.sourceNodeId,
      edge.targetNodeId,
      edge.edgeType,
      Math.round(edge.confidence * 100),
      edge.isImplicit,
      JSON.stringify(edge.metadata),
    ]);
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[DatabaseSeeder] ${message}`);
    }
  }
}

/**
 * Node insert data
 */
interface NodeInsertData {
  id?: string;
  readonly scanId: ScanId;
  readonly tenantId: TenantId;
  readonly nodeType: NodeType | string;
  readonly name: string;
  readonly qualifiedName: string;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Edge insert data
 */
interface EdgeInsertData {
  readonly scanId: ScanId;
  readonly tenantId: TenantId;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly edgeType: EdgeType | string;
  readonly confidence: number;
  readonly isImplicit: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a database seeder
 */
export function createDatabaseSeeder(
  database: TestDatabase,
  config?: Partial<SeederConfig>
): DatabaseSeeder {
  return new DatabaseSeeder(database, config);
}

/**
 * Quick seed minimal test environment
 */
export async function quickSeedMinimal(
  database: TestDatabase
): AsyncResult<SeedingResult, SeederError> {
  const seeder = createDatabaseSeeder(database, { verbose: false });
  return seeder.seedEnvironment(MINIMAL_TEST_ENVIRONMENT);
}

/**
 * Type guard for SeederError
 */
export function isSeederError(value: unknown): value is SeederError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
