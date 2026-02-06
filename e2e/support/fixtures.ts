/**
 * E2E Test Fixtures
 * @module e2e/support/fixtures
 *
 * Provides fixture loading and management for E2E tests:
 * - Load terraform fixtures from disk
 * - Load helm chart fixtures
 * - Create test users and sessions
 * - Manage test data lifecycle
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TenantId, RepositoryId, ScanId } from '../../api/src/types/entities.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Terraform fixture configuration
 */
export interface TerraformFixture {
  /** Fixture name/identifier */
  readonly name: string;
  /** Directory path relative to fixtures/repos */
  readonly path: string;
  /** Main .tf files in the fixture */
  readonly mainFiles: string[];
  /** Module directories if any */
  readonly modules: string[];
  /** Expected node count after parsing */
  readonly expectedNodeCount: number;
  /** Expected edge count after parsing */
  readonly expectedEdgeCount: number;
  /** Description of what this fixture tests */
  readonly description: string;
}

/**
 * Helm fixture configuration
 */
export interface HelmFixture {
  /** Fixture name/identifier */
  readonly name: string;
  /** Directory path relative to fixtures/repos */
  readonly path: string;
  /** Chart.yaml path */
  readonly chartFile: string;
  /** Values files */
  readonly valuesFiles: string[];
  /** Template files */
  readonly templateFiles: string[];
  /** Expected node count after parsing */
  readonly expectedNodeCount: number;
  /** Description of what this fixture tests */
  readonly description: string;
}

/**
 * User fixture configuration
 */
export interface UserFixture {
  /** User ID */
  readonly userId: string;
  /** Email address */
  readonly email: string;
  /** Display name */
  readonly name: string;
  /** GitHub ID */
  readonly githubId: number;
  /** Avatar URL */
  readonly avatarUrl?: string;
  /** Associated tenant ID */
  readonly tenantId: TenantId;
}

/**
 * Repository fixture configuration
 */
export interface RepositoryFixture {
  /** Repository ID */
  readonly id: RepositoryId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Git provider */
  readonly provider: 'github' | 'gitlab' | 'bitbucket';
  /** Repository owner */
  readonly owner: string;
  /** Repository name */
  readonly name: string;
  /** Clone URL */
  readonly cloneUrl: string;
  /** Default branch */
  readonly defaultBranch: string;
  /** Associated fixture path */
  readonly fixturePath?: string;
}

/**
 * Scan fixture configuration
 */
export interface ScanFixture {
  /** Scan ID */
  readonly id: ScanId;
  /** Repository ID */
  readonly repositoryId: RepositoryId;
  /** Commit SHA */
  readonly commitSha: string;
  /** Branch name */
  readonly branch: string;
  /** Scan status */
  readonly status: 'pending' | 'completed' | 'failed';
  /** Node count */
  readonly nodeCount: number;
  /** Edge count */
  readonly edgeCount: number;
}

/**
 * Loaded fixture with content
 */
export interface LoadedFixture<T> {
  /** Fixture configuration */
  readonly config: T;
  /** Loaded file contents */
  readonly files: Map<string, string>;
  /** Base directory path */
  readonly basePath: string;
}

/**
 * Graph node fixture
 */
export interface GraphNodeFixture {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly qualifiedName: string;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Graph edge fixture
 */
export interface GraphEdgeFixture {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly type: string;
  readonly confidence: number;
  readonly evidence: Record<string, unknown>;
}

// ============================================================================
// Fixture Registry
// ============================================================================

/**
 * Pre-defined Terraform fixtures
 */
export const TERRAFORM_FIXTURES: Record<string, TerraformFixture> = {
  'terraform-simple': {
    name: 'terraform-simple',
    path: 'terraform-simple',
    mainFiles: ['main.tf', 'variables.tf', 'outputs.tf'],
    modules: [],
    expectedNodeCount: 5,
    expectedEdgeCount: 3,
    description: 'Basic Terraform configuration with S3 bucket and IAM role',
  },
  'terraform-modules': {
    name: 'terraform-modules',
    path: 'terraform-modules',
    mainFiles: ['main.tf', 'variables.tf'],
    modules: ['modules/vpc', 'modules/ec2'],
    expectedNodeCount: 15,
    expectedEdgeCount: 12,
    description: 'Terraform configuration with local modules and cross-module dependencies',
  },
  'terraform-remote-state': {
    name: 'terraform-remote-state',
    path: 'terraform-remote-state',
    mainFiles: ['main.tf', 'backend.tf'],
    modules: [],
    expectedNodeCount: 8,
    expectedEdgeCount: 5,
    description: 'Terraform with remote state data sources',
  },
};

/**
 * Pre-defined Helm fixtures
 */
export const HELM_FIXTURES: Record<string, HelmFixture> = {
  'helm-simple': {
    name: 'helm-simple',
    path: 'helm-simple',
    chartFile: 'Chart.yaml',
    valuesFiles: ['values.yaml'],
    templateFiles: ['templates/deployment.yaml', 'templates/service.yaml'],
    expectedNodeCount: 4,
    description: 'Basic Helm chart with deployment and service',
  },
  'helm-dependencies': {
    name: 'helm-dependencies',
    path: 'helm-dependencies',
    chartFile: 'Chart.yaml',
    valuesFiles: ['values.yaml', 'values-prod.yaml'],
    templateFiles: ['templates/deployment.yaml', 'templates/configmap.yaml'],
    expectedNodeCount: 8,
    description: 'Helm chart with external dependencies',
  },
};

/**
 * Pre-defined user fixtures
 */
export const USER_FIXTURES: Record<string, UserFixture> = {
  'test-user': {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    name: 'Test User',
    githubId: 12345,
    tenantId: '00000000-0000-0000-0000-000000000001' as TenantId,
  },
  'admin-user': {
    userId: '00000000-0000-0000-0000-000000000002',
    email: 'admin@example.com',
    name: 'Admin User',
    githubId: 12346,
    tenantId: '00000000-0000-0000-0000-000000000001' as TenantId,
  },
  'other-tenant-user': {
    userId: '00000000-0000-0000-0000-000000000003',
    email: 'other@example.com',
    name: 'Other Tenant User',
    githubId: 12347,
    tenantId: '00000000-0000-0000-0000-000000000002' as TenantId,
  },
};

// ============================================================================
// Fixture Loader
// ============================================================================

/**
 * Fixture loader class for loading and managing test fixtures
 */
export class FixtureLoader {
  private readonly basePath: string;
  private readonly loadedFixtures = new Map<string, LoadedFixture<unknown>>();

  constructor(basePath?: string) {
    this.basePath =
      basePath ?? path.join(process.cwd(), 'e2e', 'fixtures', 'repos');
  }

  /**
   * Load a Terraform fixture
   */
  async loadTerraformFixture(
    name: string
  ): Promise<LoadedFixture<TerraformFixture>> {
    const cacheKey = `terraform:${name}`;
    if (this.loadedFixtures.has(cacheKey)) {
      return this.loadedFixtures.get(cacheKey) as LoadedFixture<TerraformFixture>;
    }

    const config = TERRAFORM_FIXTURES[name];
    if (!config) {
      throw new Error(`Terraform fixture not found: ${name}`);
    }

    const fixturePath = path.join(this.basePath, config.path);
    const files = await this.loadDirectoryFiles(fixturePath);

    const loaded: LoadedFixture<TerraformFixture> = {
      config,
      files,
      basePath: fixturePath,
    };

    this.loadedFixtures.set(cacheKey, loaded);
    return loaded;
  }

  /**
   * Load a Helm fixture
   */
  async loadHelmFixture(name: string): Promise<LoadedFixture<HelmFixture>> {
    const cacheKey = `helm:${name}`;
    if (this.loadedFixtures.has(cacheKey)) {
      return this.loadedFixtures.get(cacheKey) as LoadedFixture<HelmFixture>;
    }

    const config = HELM_FIXTURES[name];
    if (!config) {
      throw new Error(`Helm fixture not found: ${name}`);
    }

    const fixturePath = path.join(this.basePath, config.path);
    const files = await this.loadDirectoryFiles(fixturePath);

    const loaded: LoadedFixture<HelmFixture> = {
      config,
      files,
      basePath: fixturePath,
    };

    this.loadedFixtures.set(cacheKey, loaded);
    return loaded;
  }

  /**
   * Load a user fixture
   */
  loadUserFixture(name: string): UserFixture {
    const fixture = USER_FIXTURES[name];
    if (!fixture) {
      throw new Error(`User fixture not found: ${name}`);
    }
    return fixture;
  }

  /**
   * Load all files from a directory recursively
   */
  private async loadDirectoryFiles(
    dirPath: string,
    relativePath = ''
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const relPath = relativePath
          ? path.join(relativePath, entry.name)
          : entry.name;

        if (entry.isDirectory()) {
          const subFiles = await this.loadDirectoryFiles(entryPath, relPath);
          for (const [subPath, content] of subFiles) {
            files.set(subPath, content);
          }
        } else if (entry.isFile()) {
          const content = await fs.readFile(entryPath, 'utf-8');
          files.set(relPath, content);
        }
      }
    } catch (error) {
      // Directory may not exist in test environment
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return files;
  }

  /**
   * Get fixture file content
   */
  getFileContent(fixture: LoadedFixture<unknown>, filePath: string): string {
    const content = fixture.files.get(filePath);
    if (content === undefined) {
      throw new Error(
        `File not found in fixture: ${filePath}. Available: ${Array.from(fixture.files.keys()).join(', ')}`
      );
    }
    return content;
  }

  /**
   * Get fixture absolute file path
   */
  getFilePath(fixture: LoadedFixture<unknown>, filePath: string): string {
    return path.join(fixture.basePath, filePath);
  }

  /**
   * Clear cached fixtures
   */
  clearCache(): void {
    this.loadedFixtures.clear();
  }

  /**
   * Check if fixture exists on disk
   */
  async fixtureExists(type: 'terraform' | 'helm', name: string): Promise<boolean> {
    const fixtures = type === 'terraform' ? TERRAFORM_FIXTURES : HELM_FIXTURES;
    const config = fixtures[name];
    if (!config) {
      return false;
    }

    try {
      const fixturePath = path.join(this.basePath, config.path);
      await fs.access(fixturePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Fixture Generators
// ============================================================================

/**
 * Generate sample Terraform fixture content
 */
export function generateTerraformFixtureContent(): Map<string, string> {
  const files = new Map<string, string>();

  files.set(
    'main.tf',
    `# Test Terraform Configuration
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name

  tags = {
    Environment = var.environment
    Project     = "test"
  }
}

resource "aws_iam_role" "lambda_role" {
  name = "test-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_lambda_function" "main" {
  function_name = "test-function"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  s3_bucket = aws_s3_bucket.main.id
  s3_key    = "lambda.zip"
}
`
  );

  files.set(
    'variables.tf',
    `variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "S3 bucket name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "test"
}
`
  );

  files.set(
    'outputs.tf',
    `output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.main.arn
}

output "lambda_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.main.arn
}
`
  );

  return files;
}

/**
 * Generate sample Helm fixture content
 */
export function generateHelmFixtureContent(): Map<string, string> {
  const files = new Map<string, string>();

  files.set(
    'Chart.yaml',
    `apiVersion: v2
name: test-chart
description: A test Helm chart
type: application
version: 1.0.0
appVersion: "1.0.0"
`
  );

  files.set(
    'values.yaml',
    `replicaCount: 1

image:
  repository: nginx
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 50m
    memory: 64Mi
`
  );

  files.set(
    'templates/deployment.yaml',
    `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-deployment
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: 80
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
`
  );

  files.set(
    'templates/service.yaml',
    `apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}-service
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: 80
  selector:
    app: {{ .Release.Name }}
`
  );

  return files;
}

/**
 * Generate graph node fixtures
 */
export function generateGraphNodeFixtures(count: number): GraphNodeFixture[] {
  const nodes: GraphNodeFixture[] = [];

  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `node_${i.toString().padStart(3, '0')}`,
      type: i % 3 === 0 ? 'tf_resource' : i % 3 === 1 ? 'tf_variable' : 'tf_output',
      name: `resource_${i}`,
      qualifiedName: `aws_s3_bucket.resource_${i}`,
      filePath: 'main.tf',
      lineStart: i * 10 + 1,
      lineEnd: i * 10 + 8,
      metadata: {
        arn: `arn:aws:s3:::bucket-${i}`,
        resourceType: 'aws_s3_bucket',
        tags: { Environment: 'test' },
      },
    });
  }

  return nodes;
}

/**
 * Generate graph edge fixtures
 */
export function generateGraphEdgeFixtures(
  nodes: GraphNodeFixture[],
  density = 0.3
): GraphEdgeFixture[] {
  const edges: GraphEdgeFixture[] = [];
  let edgeId = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.random() < density) {
        edges.push({
          id: `edge_${edgeId.toString().padStart(3, '0')}`,
          sourceNodeId: nodes[i].id,
          targetNodeId: nodes[j].id,
          type: Math.random() > 0.5 ? 'depends_on' : 'references',
          confidence: 0.8 + Math.random() * 0.2,
          evidence: {
            sourceFile: nodes[i].filePath,
            targetFile: nodes[j].filePath,
            expression: `ref:${nodes[j].name}`,
          },
        });
        edgeId++;
      }
    }
  }

  return edges;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a fixture loader
 */
export function createFixtureLoader(basePath?: string): FixtureLoader {
  return new FixtureLoader(basePath);
}

/**
 * Create a repository fixture
 */
export function createRepositoryFixture(
  overrides?: Partial<RepositoryFixture>
): RepositoryFixture {
  return {
    id: '00000000-0000-0000-0000-000000000001' as RepositoryId,
    tenantId: '00000000-0000-0000-0000-000000000001' as TenantId,
    provider: 'github',
    owner: 'test-org',
    name: 'test-repo',
    cloneUrl: 'https://github.com/test-org/test-repo.git',
    defaultBranch: 'main',
    ...overrides,
  };
}

/**
 * Create a scan fixture
 */
export function createScanFixture(
  repositoryId: RepositoryId,
  overrides?: Partial<ScanFixture>
): ScanFixture {
  return {
    id: '00000000-0000-0000-0000-000000000001' as ScanId,
    repositoryId,
    commitSha: 'abc123def456',
    branch: 'main',
    status: 'completed',
    nodeCount: 10,
    edgeCount: 5,
    ...overrides,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  TerraformFixture,
  HelmFixture,
  UserFixture,
  RepositoryFixture,
  ScanFixture,
  LoadedFixture,
  GraphNodeFixture,
  GraphEdgeFixture,
  FixtureLoader,
};
