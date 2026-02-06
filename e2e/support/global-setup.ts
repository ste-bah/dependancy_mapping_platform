/**
 * Vitest Global Setup
 * @module e2e/support/global-setup
 *
 * Global setup file that runs once before all tests.
 * Sets up shared resources like database containers.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

/**
 * Global setup function
 * Called once before all test files run
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  console.log('[E2E] Starting global setup...');

  const startTime = Date.now();

  // Create necessary directories
  await ensureDirectories();

  // Generate fixture files if needed
  await generateFixtures();

  // Record setup info
  const setupInfo = {
    startedAt: new Date().toISOString(),
    pid: process.pid,
    nodeVersion: process.version,
  };

  await writeFile(
    join(process.cwd(), 'e2e', '.setup-info.json'),
    JSON.stringify(setupInfo, null, 2)
  );

  const duration = Date.now() - startTime;
  console.log(`[E2E] Global setup complete in ${duration}ms`);

  // Return teardown function
  return async () => {
    console.log('[E2E] Starting global teardown...');

    // Cleanup setup info file
    try {
      await rm(join(process.cwd(), 'e2e', '.setup-info.json'));
    } catch {
      // Ignore if file doesn't exist
    }

    console.log('[E2E] Global teardown complete');
  };
}

/**
 * Ensure required directories exist
 */
async function ensureDirectories(): Promise<void> {
  const dirs = [
    'e2e/fixtures/repos/terraform-simple',
    'e2e/fixtures/repos/terraform-modules',
    'e2e/fixtures/repos/terraform-modules/modules/vpc',
    'e2e/fixtures/repos/terraform-modules/modules/ec2',
    'e2e/fixtures/repos/terraform-remote-state',
    'e2e/fixtures/repos/helm-simple/templates',
    'e2e/fixtures/repos/helm-dependencies/templates',
    'e2e/fixtures/users',
    'e2e/reports',
    'e2e/test-results',
  ];

  for (const dir of dirs) {
    try {
      await mkdir(join(process.cwd(), dir), { recursive: true });
    } catch (error) {
      // Directory may already exist
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        console.warn(`[E2E] Warning: Could not create directory ${dir}`);
      }
    }
  }
}

/**
 * Generate fixture files for testing
 */
async function generateFixtures(): Promise<void> {
  // Generate terraform-simple fixtures
  await generateTerraformSimpleFixture();

  // Generate helm-simple fixtures
  await generateHelmSimpleFixture();

  // Generate user fixtures
  await generateUserFixtures();
}

/**
 * Generate terraform-simple fixture files
 */
async function generateTerraformSimpleFixture(): Promise<void> {
  const basePath = join(process.cwd(), 'e2e', 'fixtures', 'repos', 'terraform-simple');

  const mainTf = `# Simple Terraform Configuration
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
  }
}

resource "aws_iam_role" "lambda" {
  name = "lambda-role"

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
`;

  const variablesTf = `variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "bucket_name" {
  type = string
}

variable "environment" {
  type    = string
  default = "test"
}
`;

  const outputsTf = `output "bucket_arn" {
  value = aws_s3_bucket.main.arn
}

output "role_arn" {
  value = aws_iam_role.lambda.arn
}
`;

  try {
    await writeFile(join(basePath, 'main.tf'), mainTf);
    await writeFile(join(basePath, 'variables.tf'), variablesTf);
    await writeFile(join(basePath, 'outputs.tf'), outputsTf);
  } catch (error) {
    console.warn('[E2E] Warning: Could not write terraform-simple fixtures');
  }
}

/**
 * Generate helm-simple fixture files
 */
async function generateHelmSimpleFixture(): Promise<void> {
  const basePath = join(process.cwd(), 'e2e', 'fixtures', 'repos', 'helm-simple');

  const chartYaml = `apiVersion: v2
name: test-chart
description: A test Helm chart
type: application
version: 1.0.0
appVersion: "1.0.0"
`;

  const valuesYaml = `replicaCount: 1

image:
  repository: nginx
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
`;

  const deploymentYaml = `apiVersion: apps/v1
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
`;

  try {
    await writeFile(join(basePath, 'Chart.yaml'), chartYaml);
    await writeFile(join(basePath, 'values.yaml'), valuesYaml);
    await writeFile(join(basePath, 'templates', 'deployment.yaml'), deploymentYaml);
  } catch (error) {
    console.warn('[E2E] Warning: Could not write helm-simple fixtures');
  }
}

/**
 * Generate user fixtures
 */
async function generateUserFixtures(): Promise<void> {
  const basePath = join(process.cwd(), 'e2e', 'fixtures', 'users');

  const testUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    name: 'Test User',
    githubId: 12345,
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  try {
    await writeFile(join(basePath, 'test-user.json'), JSON.stringify(testUser, null, 2));
  } catch (error) {
    console.warn('[E2E] Warning: Could not write user fixtures');
  }
}
