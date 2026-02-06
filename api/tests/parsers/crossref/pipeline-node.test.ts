/**
 * Pipeline Node Type Tests
 * @module tests/parsers/crossref/pipeline-node
 *
 * Comprehensive tests for the Pipeline Node type implementation.
 * Tests node creation, ID generation, trigger parsing, operation extraction,
 * validation, and job linking functionality.
 *
 * TASK-XREF-007: PIPELINE Node Type Implementation - Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Pipeline Node imports
import {
  // Types
  CIPipelineType,
  TriggerType,
  OperationType,
  PipelineTrigger,
  JobOperation,
  JobArtifact,
  PipelineNodeMetadata,
  PipelineNode,
  PipelineJobNodeMetadata,
  PipelineJobNode,
  PipelineContainsEdge,
  JobDependsOnEdge,
  OperatesOnEdge,
  ParsedWorkflow,
  ParsedJob,
  ParsedStep,

  // ID Generation
  generatePipelineNodeId,
  generateJobNodeId,
  generateEdgeId,

  // Trigger Parsing
  parseTriggers,

  // Operation Extraction
  extractOperations,

  // Node Creation
  createPipelineNodes,

  // Validation
  isPipelineNode,
  isPipelineJobNode,
  isPipelineContainsEdge,
  isJobDependsOnEdge,
  isOperatesOnEdge,

  // Utilities
  getTerraformOperations,
  getHelmOperations,
  hasInfraOperations,
  getDependentJobs,
  getJobDependencies,
  pipelineNodeToDbFormat,
  jobNodeToDbFormat,

  // Constants
  VALID_PIPELINE_TYPES,
  VALID_TRIGGER_TYPES,
  VALID_OPERATION_TYPES,
} from '@/parsers/crossref/pipeline-node';

// Job Linker imports
import {
  // Types
  TerraformNode,
  HelmNode,
  LinkResult,
  LinkMatch,
  MatchReason,
  LinkingOptions,
  DEFAULT_LINKING_OPTIONS,

  // Linking Functions
  linkJobToTerraform,
  linkJobToHelm,
  linkJobToInfrastructure,
  linkAllJobsToInfrastructure,

  // Query Functions
  getOperatedNodes,
  getOperatingJobs,
  getLinkingStats,
  filterEdgesByConfidence,
  filterEdgesByOperationType,

  // Validation
  isValidTerraformNode,
  isValidHelmNode,
  isValidLinkMatch,

  // Database Format
  operatesOnEdgeToDbFormat,

  // Utilities
  normalizePath,
  getDirectory,
  arePathsRelated,
  calculatePathSimilarity,
  calculateNameSimilarity,
} from '@/parsers/crossref/job-linker';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock ParsedWorkflow for testing.
 */
function createMockParsedWorkflow(overrides: Partial<ParsedWorkflow> = {}): ParsedWorkflow {
  const defaultJobs = new Map<string, ParsedJob>([
    ['terraform', {
      id: 'terraform',
      name: 'Terraform Apply',
      stage: 'deploy',
      runsOn: 'ubuntu-latest',
      needs: [],
      steps: [
        { index: 0, name: 'Checkout', uses: 'actions/checkout@v4' },
        { index: 1, name: 'Setup Terraform', uses: 'hashicorp/setup-terraform@v3' },
        { index: 2, name: 'Terraform Init', run: 'terraform init', workingDirectory: './infra' },
        { index: 3, name: 'Terraform Apply', run: 'terraform apply -auto-approve', workingDirectory: './infra' },
      ],
      outputs: { vpc_id: '${{ steps.apply.outputs.vpc_id }}' },
      location: { lineStart: 10, lineEnd: 30 },
    }],
    ['helm-deploy', {
      id: 'helm-deploy',
      name: 'Helm Deploy',
      stage: 'deploy',
      runsOn: 'ubuntu-latest',
      needs: ['terraform'],
      environment: 'production',
      steps: [
        { index: 0, name: 'Checkout', uses: 'actions/checkout@v4' },
        { index: 1, name: 'Setup Helm', uses: 'azure/setup-helm@v3' },
        { index: 2, name: 'Helm Upgrade', run: 'helm upgrade --install myapp ./charts/myapp -n production' },
      ],
      location: { lineStart: 35, lineEnd: 55 },
    }],
  ]);

  return {
    name: 'Deploy Infrastructure',
    filePath: '.github/workflows/deploy.yml',
    pipelineType: 'github_actions',
    triggers: [
      { type: 'push', branches: ['main'] },
      { type: 'workflow_dispatch' },
    ],
    jobs: defaultJobs,
    defaultBranch: 'main',
    location: { lineStart: 1, lineEnd: 60 },
    ...overrides,
  };
}

/**
 * Create a mock PipelineNode for testing.
 */
function createMockPipelineNode(overrides: Partial<PipelineNode> = {}): PipelineNode {
  return {
    id: 'pipeline-abc123def456',
    type: 'ci_pipeline',
    name: 'Deploy Infrastructure',
    filePath: '.github/workflows/deploy.yml',
    lineStart: 1,
    lineEnd: 60,
    scanId: 'scan-123',
    metadata: {
      pipelineType: 'github_actions',
      name: 'Deploy Infrastructure',
      triggers: [{ type: 'push', branches: ['main'] }],
      jobCount: 2,
      hasTerraformJobs: true,
      hasHelmJobs: true,
      defaultBranch: 'main',
    },
    ...overrides,
  };
}

/**
 * Create a mock PipelineJobNode for testing.
 */
function createMockJobNode(overrides: Partial<PipelineJobNode> = {}): PipelineJobNode {
  return {
    id: 'job-abc123def456',
    type: 'ci_job',
    name: 'Terraform Apply',
    filePath: '.github/workflows/deploy.yml',
    lineStart: 10,
    lineEnd: 30,
    scanId: 'scan-123',
    metadata: {
      pipelineId: 'pipeline-abc123def456',
      jobName: 'terraform',
      stage: 'deploy',
      runsOn: 'ubuntu-latest',
      dependsOn: [],
      operations: [
        { type: 'terraform', command: 'init', stepIndex: 2, workingDir: './infra' },
        { type: 'terraform', command: 'apply', stepIndex: 3, workingDir: './infra' },
      ],
      artifacts: [],
    },
    ...overrides,
  };
}

/**
 * Create a mock TerraformNode for linking tests.
 */
function createMockTerraformNode(overrides: Partial<TerraformNode> = {}): TerraformNode {
  return {
    id: 'tf-node-123',
    type: 'terraform_module',
    name: 'vpc-module',
    filePath: './infra/main.tf',
    modulePath: './infra',
    metadata: {
      moduleName: 'vpc',
    },
    ...overrides,
  };
}

/**
 * Create a mock HelmNode for linking tests.
 */
function createMockHelmNode(overrides: Partial<HelmNode> = {}): HelmNode {
  return {
    id: 'helm-node-456',
    type: 'helm_release',
    name: 'myapp-release',
    filePath: './charts/myapp/Chart.yaml',
    chartPath: './charts/myapp',
    releaseName: 'myapp',
    metadata: {
      chartName: 'myapp',
      namespace: 'production',
    },
    ...overrides,
  };
}

// ============================================================================
// ID Generation Tests
// ============================================================================

describe('ID Generation', () => {
  describe('generatePipelineNodeId', () => {
    it('generates deterministic ID from file path', () => {
      const id1 = generatePipelineNodeId('.github/workflows/deploy.yml');
      const id2 = generatePipelineNodeId('.github/workflows/deploy.yml');

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^pipeline-[a-f0-9]{16}$/);
    });

    it('generates different IDs for different paths', () => {
      const id1 = generatePipelineNodeId('.github/workflows/deploy.yml');
      const id2 = generatePipelineNodeId('.github/workflows/build.yml');

      expect(id1).not.toBe(id2);
    });

    it('normalizes path separators', () => {
      const id1 = generatePipelineNodeId('.github/workflows/deploy.yml');
      const id2 = generatePipelineNodeId('.github\\workflows\\deploy.yml');

      expect(id1).toBe(id2);
    });

    it('handles case differences', () => {
      const id1 = generatePipelineNodeId('.github/workflows/Deploy.yml');
      const id2 = generatePipelineNodeId('.github/workflows/deploy.yml');

      expect(id1).toBe(id2);
    });

    it('handles empty path', () => {
      const id = generatePipelineNodeId('');
      expect(id).toMatch(/^pipeline-[a-f0-9]{16}$/);
    });
  });

  describe('generateJobNodeId', () => {
    it('generates deterministic ID from file path and job name', () => {
      const id1 = generateJobNodeId('.github/workflows/deploy.yml', 'terraform');
      const id2 = generateJobNodeId('.github/workflows/deploy.yml', 'terraform');

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^job-[a-f0-9]{16}$/);
    });

    it('generates different IDs for different job names', () => {
      const id1 = generateJobNodeId('.github/workflows/deploy.yml', 'terraform');
      const id2 = generateJobNodeId('.github/workflows/deploy.yml', 'helm');

      expect(id1).not.toBe(id2);
    });

    it('generates different IDs for different file paths', () => {
      const id1 = generateJobNodeId('.github/workflows/deploy.yml', 'terraform');
      const id2 = generateJobNodeId('.github/workflows/build.yml', 'terraform');

      expect(id1).not.toBe(id2);
    });

    it('handles special characters in job name', () => {
      const id = generateJobNodeId('.github/workflows/deploy.yml', 'build-and-test');
      expect(id).toMatch(/^job-[a-f0-9]{16}$/);
    });
  });

  describe('generateEdgeId', () => {
    it('generates deterministic edge ID', () => {
      const id1 = generateEdgeId('PIPELINE_CONTAINS', 'source-1', 'target-1');
      const id2 = generateEdgeId('PIPELINE_CONTAINS', 'source-1', 'target-1');

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^pipeline-contains-[a-f0-9]{16}$/);
    });

    it('generates different IDs for different edge types', () => {
      const id1 = generateEdgeId('PIPELINE_CONTAINS', 'source-1', 'target-1');
      const id2 = generateEdgeId('JOB_DEPENDS_ON', 'source-1', 'target-1');

      expect(id1).not.toBe(id2);
    });

    it('generates different IDs for different source/target', () => {
      const id1 = generateEdgeId('OPERATES_ON', 'job-1', 'tf-1');
      const id2 = generateEdgeId('OPERATES_ON', 'job-1', 'tf-2');

      expect(id1).not.toBe(id2);
    });
  });
});

// ============================================================================
// Trigger Parsing Tests
// ============================================================================

describe('Trigger Parsing', () => {
  describe('parseTriggers - GitHub Actions', () => {
    it('parses simple string trigger', () => {
      const workflow = { on: 'push' };
      const triggers = parseTriggers(workflow, 'github_actions');

      expect(triggers).toHaveLength(1);
      expect(triggers[0].type).toBe('push');
    });

    it('parses array of triggers', () => {
      const workflow = { on: ['push', 'pull_request'] };
      const triggers = parseTriggers(workflow, 'github_actions');

      expect(triggers).toHaveLength(2);
      expect(triggers.map(t => t.type)).toContain('push');
      expect(triggers.map(t => t.type)).toContain('pull_request');
    });

    it('parses object triggers with branches', () => {
      const workflow = {
        on: {
          push: { branches: ['main', 'develop'] },
          pull_request: { branches: ['main'] },
        },
      };
      const triggers = parseTriggers(workflow, 'github_actions');

      expect(triggers).toHaveLength(2);

      const pushTrigger = triggers.find(t => t.type === 'push');
      expect(pushTrigger?.branches).toEqual(['main', 'develop']);
    });

    it('parses workflow_dispatch trigger', () => {
      const workflow = { on: { workflow_dispatch: {} } };
      const triggers = parseTriggers(workflow, 'github_actions');

      expect(triggers).toHaveLength(1);
      expect(triggers[0].type).toBe('workflow_dispatch');
    });

    it('parses schedule trigger', () => {
      const workflow = {
        on: {
          schedule: [{ cron: '0 0 * * *' }],
        },
      };
      const triggers = parseTriggers(workflow, 'github_actions');

      expect(triggers).toHaveLength(1);
      expect(triggers[0].type).toBe('schedule');
    });

    it('parses paths filter', () => {
      const workflow = {
        on: {
          push: {
            branches: ['main'],
            paths: ['src/**', 'tests/**'],
          },
        },
      };
      const triggers = parseTriggers(workflow, 'github_actions');

      expect(triggers[0].paths).toEqual(['src/**', 'tests/**']);
    });

    it('parses tags filter', () => {
      const workflow = {
        on: {
          push: {
            tags: ['v*'],
          },
        },
      };
      const triggers = parseTriggers(workflow, 'github_actions');

      expect(triggers[0].tags).toEqual(['v*']);
    });

    it('handles empty workflow', () => {
      const triggers = parseTriggers({}, 'github_actions');
      expect(triggers).toHaveLength(0);
    });

    it('handles null workflow', () => {
      const triggers = parseTriggers(null, 'github_actions');
      expect(triggers).toHaveLength(0);
    });
  });

  describe('parseTriggers - GitLab CI', () => {
    it('adds default push trigger when no explicit triggers', () => {
      const workflow = { stages: ['build', 'test'] };
      const triggers = parseTriggers(workflow, 'gitlab_ci');

      expect(triggers).toHaveLength(1);
      expect(triggers[0].type).toBe('push');
    });

    it('parses workflow rules for push', () => {
      const workflow = {
        workflow: {
          rules: [
            { if: '$CI_PIPELINE_SOURCE == "push"' },
          ],
        },
      };
      const triggers = parseTriggers(workflow, 'gitlab_ci');

      expect(triggers.some(t => t.type === 'push')).toBe(true);
    });

    it('parses workflow rules for merge requests', () => {
      const workflow = {
        workflow: {
          rules: [
            { if: '$CI_PIPELINE_SOURCE == "merge_request_event"' },
          ],
        },
      };
      const triggers = parseTriggers(workflow, 'gitlab_ci');

      expect(triggers.some(t => t.type === 'pull_request')).toBe(true);
    });
  });

  describe('parseTriggers - Azure Pipelines', () => {
    it('parses trigger branches', () => {
      const workflow = {
        trigger: ['main', 'develop'],
      };
      const triggers = parseTriggers(workflow, 'azure_pipelines');

      expect(triggers).toHaveLength(1);
      expect(triggers[0].type).toBe('push');
      expect(triggers[0].branches).toEqual(['main', 'develop']);
    });

    it('parses PR trigger', () => {
      const workflow = {
        pr: ['main'],
      };
      const triggers = parseTriggers(workflow, 'azure_pipelines');

      expect(triggers).toHaveLength(1);
      expect(triggers[0].type).toBe('pull_request');
    });

    it('parses schedule trigger', () => {
      const workflow = {
        schedules: [
          { cron: '0 0 * * *' },
        ],
      };
      const triggers = parseTriggers(workflow, 'azure_pipelines');

      expect(triggers).toHaveLength(1);
      expect(triggers[0].type).toBe('schedule');
    });

    it('handles trigger: none', () => {
      const workflow = { trigger: 'none' };
      const triggers = parseTriggers(workflow, 'azure_pipelines');

      expect(triggers).toHaveLength(0);
    });
  });
});

// ============================================================================
// Operation Extraction Tests
// ============================================================================

describe('Operation Extraction', () => {
  describe('extractOperations', () => {
    it('extracts Terraform operations from run steps', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'terraform init', workingDirectory: './infra' },
        { index: 1, run: 'terraform plan -out=plan.out' },
        { index: 2, run: 'terraform apply plan.out' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(3);
      expect(operations[0].type).toBe('terraform');
      expect(operations[0].command).toBe('init');
      expect(operations[0].workingDir).toBe('./infra');
      expect(operations[1].command).toBe('plan');
      expect(operations[2].command).toBe('apply');
    });

    it('extracts Terraform operations from uses steps', () => {
      const steps: ParsedStep[] = [
        { index: 0, uses: 'hashicorp/setup-terraform@v3' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('terraform');
    });

    it('extracts Helm operations', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'helm upgrade --install myapp ./chart -n prod' },
        { index: 1, run: 'helm rollback myapp 1' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('helm');
      expect(operations[0].command).toBe('upgrade');
      expect(operations[1].command).toBe('rollback');
    });

    it('extracts kubectl operations', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'kubectl apply -f manifests/' },
        { index: 1, run: 'kubectl rollout status deployment/myapp' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('kubectl');
      expect(operations[0].command).toBe('apply');
      expect(operations[1].command).toBe('rollout');
    });

    it('extracts Docker operations', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'docker build -t myimage .' },
        { index: 1, run: 'docker push myimage:latest' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('docker');
      expect(operations[0].command).toBe('build');
      expect(operations[1].command).toBe('push');
    });

    it('extracts Terragrunt operations', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'terragrunt run-all apply' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('terraform');
      expect(operations[0].command).toBe('run-all');
    });

    it('extracts Helmfile operations', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'helmfile sync' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('helm');
      expect(operations[0].command).toBe('sync');
    });

    it('detects script operations for non-tool commands', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'echo "Hello World"' },
        { index: 1, run: 'npm install && npm test' },
      ];

      const operations = extractOperations(steps);

      expect(operations).toHaveLength(2);
      expect(operations.every(op => op.type === 'script')).toBe(true);
    });

    it('extracts outputs from Terraform output commands', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'terraform output -raw vpc_id' },
        { index: 1, run: 'terraform output -json cluster_info' },
      ];

      const operations = extractOperations(steps);

      expect(operations[0].outputs).toContain('vpc_id');
      expect(operations[1].outputs).toContain('cluster_info');
    });

    it('preserves step index', () => {
      const steps: ParsedStep[] = [
        { index: 0, run: 'echo setup' },
        { index: 5, run: 'terraform apply' },
        { index: 10, run: 'helm upgrade app ./chart' },
      ];

      const operations = extractOperations(steps);

      expect(operations[1].stepIndex).toBe(5);
      expect(operations[2].stepIndex).toBe(10);
    });

    it('handles empty steps array', () => {
      const operations = extractOperations([]);
      expect(operations).toHaveLength(0);
    });

    it('handles steps without run or uses', () => {
      const steps: ParsedStep[] = [
        { index: 0, name: 'Empty step' },
      ];

      const operations = extractOperations(steps);
      expect(operations).toHaveLength(0);
    });
  });
});

// ============================================================================
// Node Creation Tests
// ============================================================================

describe('Node Creation', () => {
  describe('createPipelineNodes', () => {
    it('creates pipeline node with correct ID', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-123');

      const pipelineNode = nodes.find(n => n.type === 'ci_pipeline');
      expect(pipelineNode).toBeDefined();
      expect(pipelineNode?.id).toMatch(/^pipeline-[a-f0-9]{16}$/);
    });

    it('creates job nodes for each job', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-123');

      const jobNodes = nodes.filter(n => n.type === 'ci_job');
      expect(jobNodes).toHaveLength(2);
    });

    it('sets correct metadata on pipeline node', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-123');

      const pipelineNode = nodes.find(n => n.type === 'ci_pipeline') as PipelineNode;
      expect(pipelineNode.metadata.pipelineType).toBe('github_actions');
      expect(pipelineNode.metadata.jobCount).toBe(2);
      expect(pipelineNode.metadata.hasTerraformJobs).toBe(true);
      expect(pipelineNode.metadata.hasHelmJobs).toBe(true);
    });

    it('sets correct metadata on job nodes', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-123');

      const tfJobNode = nodes.find(n =>
        n.type === 'ci_job' && n.name === 'Terraform Apply'
      ) as PipelineJobNode;

      expect(tfJobNode.metadata.jobName).toBe('terraform');
      expect(tfJobNode.metadata.stage).toBe('deploy');
      expect(tfJobNode.metadata.operations.length).toBeGreaterThan(0);
    });

    it('creates PIPELINE_CONTAINS edges', () => {
      const workflow = createMockParsedWorkflow();
      const { edges } = createPipelineNodes(workflow, 'scan-123');

      const containsEdges = edges.filter(e => e.type === 'PIPELINE_CONTAINS');
      expect(containsEdges).toHaveLength(2);
      expect(containsEdges.every(e => e.confidence === 100)).toBe(true);
    });

    it('creates JOB_DEPENDS_ON edges for dependencies', () => {
      const workflow = createMockParsedWorkflow();
      const { edges } = createPipelineNodes(workflow, 'scan-123');

      const dependsOnEdges = edges.filter(e => e.type === 'JOB_DEPENDS_ON');
      expect(dependsOnEdges).toHaveLength(1);
    });

    it('sets scanId on all nodes', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-xyz');

      expect(nodes.every(n => n.scanId === 'scan-xyz')).toBe(true);
    });

    it('handles workflow with no jobs', () => {
      const workflow = createMockParsedWorkflow({
        jobs: new Map(),
      });
      const { nodes, edges } = createPipelineNodes(workflow, 'scan-123');

      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('ci_pipeline');
      expect(edges).toHaveLength(0);
    });

    it('handles workflow with circular dependencies gracefully', () => {
      const jobs = new Map<string, ParsedJob>([
        ['job-a', {
          id: 'job-a',
          steps: [],
          needs: ['job-b'],
        }],
        ['job-b', {
          id: 'job-b',
          steps: [],
          needs: ['job-a'],
        }],
      ]);

      const workflow = createMockParsedWorkflow({ jobs });
      const { edges } = createPipelineNodes(workflow, 'scan-123');

      const dependsOnEdges = edges.filter(e => e.type === 'JOB_DEPENDS_ON');
      expect(dependsOnEdges).toHaveLength(2);
    });

    it('extracts environment from job', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-123');

      const helmJob = nodes.find(n =>
        n.type === 'ci_job' && n.name === 'Helm Deploy'
      ) as PipelineJobNode;

      expect(helmJob.metadata.environment).toBe('production');
    });

    it('extracts outputs from job', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-123');

      const tfJob = nodes.find(n =>
        n.type === 'ci_job' && n.name === 'Terraform Apply'
      ) as PipelineJobNode;

      expect(tfJob.metadata.outputs).toBeDefined();
      expect(tfJob.metadata.outputs?.vpc_id).toBeDefined();
    });
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Validation', () => {
  describe('isPipelineNode', () => {
    it('validates correct pipeline node', () => {
      const node = createMockPipelineNode();
      expect(isPipelineNode(node)).toBe(true);
    });

    it('rejects null', () => {
      expect(isPipelineNode(null)).toBe(false);
    });

    it('rejects wrong type', () => {
      const node = createMockPipelineNode({ type: 'ci_job' as any });
      expect(isPipelineNode(node)).toBe(false);
    });

    it('rejects missing id', () => {
      const node = { ...createMockPipelineNode(), id: '' };
      expect(isPipelineNode(node)).toBe(false);
    });

    it('rejects invalid pipeline type in metadata', () => {
      const node = createMockPipelineNode({
        metadata: {
          ...createMockPipelineNode().metadata,
          pipelineType: 'invalid' as any,
        },
      });
      expect(isPipelineNode(node)).toBe(false);
    });

    it('accepts all valid pipeline types', () => {
      for (const pipelineType of VALID_PIPELINE_TYPES) {
        const node = createMockPipelineNode({
          metadata: {
            ...createMockPipelineNode().metadata,
            pipelineType,
          },
        });
        expect(isPipelineNode(node)).toBe(true);
      }
    });
  });

  describe('isPipelineJobNode', () => {
    it('validates correct job node', () => {
      const node = createMockJobNode();
      expect(isPipelineJobNode(node)).toBe(true);
    });

    it('rejects wrong type', () => {
      const node = createMockJobNode({ type: 'ci_pipeline' as any });
      expect(isPipelineJobNode(node)).toBe(false);
    });

    it('rejects missing pipelineId', () => {
      const node = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          pipelineId: undefined as any,
        },
      });
      expect(isPipelineJobNode(node)).toBe(false);
    });

    it('rejects missing operations array', () => {
      const node = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: undefined as any,
        },
      });
      expect(isPipelineJobNode(node)).toBe(false);
    });
  });

  describe('isPipelineContainsEdge', () => {
    it('validates correct edge', () => {
      const edge: PipelineContainsEdge = {
        id: 'edge-123',
        type: 'PIPELINE_CONTAINS',
        sourceNodeId: 'pipeline-1',
        targetNodeId: 'job-1',
        confidence: 100,
      };
      expect(isPipelineContainsEdge(edge)).toBe(true);
    });

    it('rejects invalid confidence', () => {
      const edge = {
        id: 'edge-123',
        type: 'PIPELINE_CONTAINS',
        sourceNodeId: 'pipeline-1',
        targetNodeId: 'job-1',
        confidence: 150,
      };
      expect(isPipelineContainsEdge(edge)).toBe(false);
    });
  });

  describe('isJobDependsOnEdge', () => {
    it('validates correct edge', () => {
      const edge: JobDependsOnEdge = {
        id: 'edge-123',
        type: 'JOB_DEPENDS_ON',
        sourceNodeId: 'job-1',
        targetNodeId: 'job-2',
        confidence: 100,
        metadata: { artifactRequired: true },
      };
      expect(isJobDependsOnEdge(edge)).toBe(true);
    });

    it('rejects missing metadata', () => {
      const edge = {
        id: 'edge-123',
        type: 'JOB_DEPENDS_ON',
        sourceNodeId: 'job-1',
        targetNodeId: 'job-2',
        confidence: 100,
      };
      expect(isJobDependsOnEdge(edge)).toBe(false);
    });
  });

  describe('isOperatesOnEdge', () => {
    it('validates correct edge', () => {
      const edge: OperatesOnEdge = {
        id: 'edge-123',
        type: 'OPERATES_ON',
        sourceNodeId: 'job-1',
        targetNodeId: 'tf-1',
        confidence: 85,
        metadata: {
          operation: 'apply',
          operationType: 'terraform',
          stepIndex: 3,
        },
      };
      expect(isOperatesOnEdge(edge)).toBe(true);
    });

    it('rejects invalid operation type', () => {
      const edge = {
        id: 'edge-123',
        type: 'OPERATES_ON',
        sourceNodeId: 'job-1',
        targetNodeId: 'tf-1',
        confidence: 85,
        metadata: {
          operation: 'apply',
          operationType: 'invalid',
          stepIndex: 3,
        },
      };
      expect(isOperatesOnEdge(edge)).toBe(false);
    });

    it('accepts all valid operation types', () => {
      for (const opType of VALID_OPERATION_TYPES) {
        const edge: OperatesOnEdge = {
          id: 'edge-123',
          type: 'OPERATES_ON',
          sourceNodeId: 'job-1',
          targetNodeId: 'tf-1',
          confidence: 85,
          metadata: {
            operation: 'apply',
            operationType: opType,
            stepIndex: 0,
          },
        };
        expect(isOperatesOnEdge(edge)).toBe(true);
      }
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('getTerraformOperations', () => {
    it('returns only Terraform operations', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'terraform', command: 'apply', stepIndex: 0 },
            { type: 'helm', command: 'upgrade', stepIndex: 1 },
            { type: 'terraform', command: 'output', stepIndex: 2 },
          ],
        },
      });

      const tfOps = getTerraformOperations(jobNode);
      expect(tfOps).toHaveLength(2);
      expect(tfOps.every(op => op.type === 'terraform')).toBe(true);
    });

    it('returns empty array when no Terraform operations', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'helm', command: 'upgrade', stepIndex: 0 },
          ],
        },
      });

      const tfOps = getTerraformOperations(jobNode);
      expect(tfOps).toHaveLength(0);
    });
  });

  describe('getHelmOperations', () => {
    it('returns only Helm operations', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'terraform', command: 'apply', stepIndex: 0 },
            { type: 'helm', command: 'upgrade', stepIndex: 1 },
            { type: 'helm', command: 'rollback', stepIndex: 2 },
          ],
        },
      });

      const helmOps = getHelmOperations(jobNode);
      expect(helmOps).toHaveLength(2);
      expect(helmOps.every(op => op.type === 'helm')).toBe(true);
    });
  });

  describe('hasInfraOperations', () => {
    it('returns true for Terraform operations', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [{ type: 'terraform', command: 'apply', stepIndex: 0 }],
        },
      });

      expect(hasInfraOperations(jobNode)).toBe(true);
    });

    it('returns true for Helm operations', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [{ type: 'helm', command: 'upgrade', stepIndex: 0 }],
        },
      });

      expect(hasInfraOperations(jobNode)).toBe(true);
    });

    it('returns true for kubectl operations', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [{ type: 'kubectl', command: 'apply', stepIndex: 0 }],
        },
      });

      expect(hasInfraOperations(jobNode)).toBe(true);
    });

    it('returns false for only script operations', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'script', command: 'echo', stepIndex: 0 },
            { type: 'docker', command: 'build', stepIndex: 1 },
          ],
        },
      });

      expect(hasInfraOperations(jobNode)).toBe(false);
    });
  });

  describe('getDependentJobs', () => {
    it('returns job IDs that depend on the given job', () => {
      const edges: JobDependsOnEdge[] = [
        {
          id: 'e1', type: 'JOB_DEPENDS_ON',
          sourceNodeId: 'job-1', targetNodeId: 'job-2',
          confidence: 100, metadata: {},
        },
        {
          id: 'e2', type: 'JOB_DEPENDS_ON',
          sourceNodeId: 'job-1', targetNodeId: 'job-3',
          confidence: 100, metadata: {},
        },
        {
          id: 'e3', type: 'JOB_DEPENDS_ON',
          sourceNodeId: 'job-2', targetNodeId: 'job-4',
          confidence: 100, metadata: {},
        },
      ];

      const dependents = getDependentJobs('job-1', edges);
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('job-2');
      expect(dependents).toContain('job-3');
    });
  });

  describe('getJobDependencies', () => {
    it('returns job IDs that the given job depends on', () => {
      const edges: JobDependsOnEdge[] = [
        {
          id: 'e1', type: 'JOB_DEPENDS_ON',
          sourceNodeId: 'job-1', targetNodeId: 'job-3',
          confidence: 100, metadata: {},
        },
        {
          id: 'e2', type: 'JOB_DEPENDS_ON',
          sourceNodeId: 'job-2', targetNodeId: 'job-3',
          confidence: 100, metadata: {},
        },
      ];

      const deps = getJobDependencies('job-3', edges);
      expect(deps).toHaveLength(2);
      expect(deps).toContain('job-1');
      expect(deps).toContain('job-2');
    });
  });

  describe('pipelineNodeToDbFormat', () => {
    it('converts pipeline node to database format', () => {
      const node = createMockPipelineNode();
      const row = pipelineNodeToDbFormat(node, 'tenant-abc');

      expect(row.id).toBe(node.id);
      expect(row.scan_id).toBe(node.scanId);
      expect(row.tenant_id).toBe('tenant-abc');
      expect(row.type).toBe('ci_pipeline');
      expect(row.metadata).toEqual(node.metadata);
    });
  });

  describe('jobNodeToDbFormat', () => {
    it('converts job node to database format', () => {
      const node = createMockJobNode();
      const row = jobNodeToDbFormat(node, 'tenant-xyz');

      expect(row.id).toBe(node.id);
      expect(row.scan_id).toBe(node.scanId);
      expect(row.tenant_id).toBe('tenant-xyz');
      expect(row.type).toBe('ci_job');
      expect(row.metadata).toEqual(node.metadata);
    });
  });
});

// ============================================================================
// Job Linker Tests
// ============================================================================

describe('Job Linker', () => {
  describe('Path Utilities', () => {
    describe('normalizePath', () => {
      it('normalizes path separators', () => {
        expect(normalizePath('foo\\bar\\baz')).toBe('foo/bar/baz');
      });

      it('removes leading ./', () => {
        expect(normalizePath('./foo/bar')).toBe('foo/bar');
      });

      it('converts to lowercase', () => {
        expect(normalizePath('Foo/Bar/BAZ')).toBe('foo/bar/baz');
      });
    });

    describe('getDirectory', () => {
      it('extracts directory from file path', () => {
        expect(getDirectory('foo/bar/file.txt')).toBe('foo/bar');
      });

      it('returns . for file in current directory', () => {
        expect(getDirectory('file.txt')).toBe('.');
      });
    });

    describe('arePathsRelated', () => {
      it('returns true for exact match', () => {
        expect(arePathsRelated('foo/bar', 'foo/bar')).toBe(true);
      });

      it('returns true for parent-child relationship', () => {
        expect(arePathsRelated('foo/bar', 'foo/bar/baz')).toBe(true);
        expect(arePathsRelated('foo/bar/baz', 'foo/bar')).toBe(true);
      });

      it('returns true for same directory', () => {
        expect(arePathsRelated('foo/bar/file1.txt', 'foo/bar/file2.txt')).toBe(true);
      });

      it('returns false for unrelated paths', () => {
        expect(arePathsRelated('foo/bar', 'baz/qux')).toBe(false);
      });
    });

    describe('calculatePathSimilarity', () => {
      it('returns 100 for exact match', () => {
        expect(calculatePathSimilarity('foo/bar', 'foo/bar')).toBe(100);
      });

      it('returns high score for similar paths', () => {
        const score = calculatePathSimilarity('foo/bar/baz', 'foo/bar/qux');
        expect(score).toBeGreaterThan(50);
      });

      it('returns low score for different paths', () => {
        const score = calculatePathSimilarity('foo/bar', 'baz/qux');
        expect(score).toBeLessThan(50);
      });
    });

    describe('calculateNameSimilarity', () => {
      it('returns 100 for exact match', () => {
        expect(calculateNameSimilarity('terraform', 'terraform')).toBe(100);
      });

      it('returns 100 for match with different case', () => {
        expect(calculateNameSimilarity('Terraform', 'terraform')).toBe(100);
      });

      it('returns 100 for match with different separators', () => {
        expect(calculateNameSimilarity('terraform-apply', 'terraform_apply')).toBe(100);
      });

      it('returns 80 for substring match', () => {
        expect(calculateNameSimilarity('terraform', 'terraform-module')).toBe(80);
      });

      it('returns low score for different names', () => {
        const score = calculateNameSimilarity('terraform', 'helm');
        expect(score).toBeLessThan(50);
      });
    });
  });

  describe('linkJobToTerraform', () => {
    it('links job to Terraform nodes by working directory', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'terraform', command: 'apply', stepIndex: 0, workingDir: './infra' },
          ],
        },
      });

      const tfNodes = new Map<string, TerraformNode>([
        ['tf-1', createMockTerraformNode({ modulePath: './infra' })],
        ['tf-2', createMockTerraformNode({ modulePath: './other' })],
      ]);

      const edges = linkJobToTerraform(jobNode, tfNodes);

      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(edges.some(e => e.targetNodeId === 'tf-1')).toBe(true);
    });

    it('links job to Terraform output nodes by output reference', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            {
              type: 'terraform', command: 'output', stepIndex: 0,
              outputs: ['vpc_id'],
            },
          ],
        },
      });

      const tfNodes = new Map<string, TerraformNode>([
        ['tf-out-1', {
          id: 'tf-out-1',
          type: 'terraform_output',
          name: 'vpc_id',
          filePath: './infra/outputs.tf',
          metadata: { outputName: 'vpc_id' },
        }],
      ]);

      const edges = linkJobToTerraform(jobNode, tfNodes);

      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(edges[0].confidence).toBeGreaterThanOrEqual(90);
    });

    it('respects minConfidence option', () => {
      const jobNode = createMockJobNode();
      const tfNodes = new Map<string, TerraformNode>([
        ['tf-1', createMockTerraformNode({ modulePath: './other' })],
      ]);

      const edgesLow = linkJobToTerraform(jobNode, tfNodes, { minConfidence: 10 });
      const edgesHigh = linkJobToTerraform(jobNode, tfNodes, { minConfidence: 95 });

      expect(edgesLow.length).toBeGreaterThanOrEqual(edgesHigh.length);
    });

    it('limits edges per operation', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'terraform', command: 'apply', stepIndex: 0, workingDir: './' },
          ],
        },
      });

      const tfNodes = new Map<string, TerraformNode>();
      for (let i = 0; i < 10; i++) {
        tfNodes.set(`tf-${i}`, createMockTerraformNode({
          id: `tf-${i}`,
          modulePath: `./${i}`,
        }));
      }

      const edges = linkJobToTerraform(jobNode, tfNodes, { maxEdgesPerOperation: 3 });

      expect(edges.length).toBeLessThanOrEqual(3);
    });
  });

  describe('linkJobToHelm', () => {
    it('links job to Helm nodes by chart path', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            {
              type: 'helm', command: 'upgrade', stepIndex: 0,
              workingDir: './charts/myapp',
            },
          ],
        },
      });

      const helmNodes = new Map<string, HelmNode>([
        ['helm-1', createMockHelmNode({ chartPath: './charts/myapp' })],
      ]);

      const edges = linkJobToHelm(jobNode, helmNodes);

      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(edges[0].targetNodeId).toBe('helm-1');
    });

    it('links job to Helm nodes by release name', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'helm', command: 'helm upgrade myapp ./chart', stepIndex: 0 },
          ],
        },
      });

      const helmNodes = new Map<string, HelmNode>([
        ['helm-1', createMockHelmNode({ releaseName: 'myapp' })],
      ]);

      const edges = linkJobToHelm(jobNode, helmNodes);

      expect(edges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('linkJobToInfrastructure', () => {
    it('links to both Terraform and Helm nodes', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'terraform', command: 'apply', stepIndex: 0, workingDir: './infra' },
            { type: 'helm', command: 'upgrade', stepIndex: 1, workingDir: './charts/myapp' },
          ],
        },
      });

      const tfNodes = new Map<string, TerraformNode>([
        ['tf-1', createMockTerraformNode({ modulePath: './infra' })],
      ]);

      const helmNodes = new Map<string, HelmNode>([
        ['helm-1', createMockHelmNode({ chartPath: './charts/myapp' })],
      ]);

      const result = linkJobToInfrastructure(jobNode, tfNodes, helmNodes);

      expect(result.edges.some(e => e.metadata.operationType === 'terraform')).toBe(true);
      expect(result.edges.some(e => e.metadata.operationType === 'helm')).toBe(true);
    });

    it('provides match details', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            { type: 'terraform', command: 'apply', stepIndex: 0, workingDir: './infra' },
          ],
        },
      });

      const tfNodes = new Map<string, TerraformNode>([
        ['tf-1', createMockTerraformNode({ modulePath: './infra' })],
      ]);

      const result = linkJobToInfrastructure(jobNode, tfNodes, new Map());

      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.matches[0].matchReason).toBeDefined();
    });
  });

  describe('linkAllJobsToInfrastructure', () => {
    it('links multiple jobs', () => {
      const jobs = [
        createMockJobNode({
          id: 'job-1',
          metadata: {
            ...createMockJobNode().metadata,
            operations: [
              { type: 'terraform', command: 'apply', stepIndex: 0, workingDir: './infra' },
            ],
          },
        }),
        createMockJobNode({
          id: 'job-2',
          metadata: {
            ...createMockJobNode().metadata,
            operations: [
              { type: 'helm', command: 'upgrade', stepIndex: 0, workingDir: './charts/myapp' },
            ],
          },
        }),
      ];

      const tfNodes = new Map<string, TerraformNode>([
        ['tf-1', createMockTerraformNode()],
      ]);

      const helmNodes = new Map<string, HelmNode>([
        ['helm-1', createMockHelmNode()],
      ]);

      const result = linkAllJobsToInfrastructure(jobs, tfNodes, helmNodes);

      expect(result.edges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Query Functions', () => {
    const mockEdges: OperatesOnEdge[] = [
      {
        id: 'e1', type: 'OPERATES_ON',
        sourceNodeId: 'job-1', targetNodeId: 'tf-1',
        confidence: 90,
        metadata: { operation: 'apply', operationType: 'terraform', stepIndex: 0 },
      },
      {
        id: 'e2', type: 'OPERATES_ON',
        sourceNodeId: 'job-1', targetNodeId: 'helm-1',
        confidence: 85,
        metadata: { operation: 'upgrade', operationType: 'helm', stepIndex: 1 },
      },
      {
        id: 'e3', type: 'OPERATES_ON',
        sourceNodeId: 'job-2', targetNodeId: 'tf-1',
        confidence: 60,
        metadata: { operation: 'plan', operationType: 'terraform', stepIndex: 0 },
      },
    ];

    describe('getOperatedNodes', () => {
      it('returns nodes operated by a job', () => {
        const nodes = getOperatedNodes('job-1', mockEdges);

        expect(nodes).toHaveLength(2);
        expect(nodes).toContain('tf-1');
        expect(nodes).toContain('helm-1');
      });
    });

    describe('getOperatingJobs', () => {
      it('returns jobs operating on a node', () => {
        const jobs = getOperatingJobs('tf-1', mockEdges);

        expect(jobs).toHaveLength(2);
        expect(jobs).toContain('job-1');
        expect(jobs).toContain('job-2');
      });
    });

    describe('getLinkingStats', () => {
      it('calculates statistics correctly', () => {
        const stats = getLinkingStats(mockEdges);

        expect(stats.totalEdges).toBe(3);
        expect(stats.byOperationType.terraform).toBe(2);
        expect(stats.byOperationType.helm).toBe(1);
        expect(stats.uniqueJobs).toBe(2);
        expect(stats.uniqueTargets).toBe(2);
      });

      it('calculates confidence distribution', () => {
        const stats = getLinkingStats(mockEdges);

        expect(stats.highConfidenceCount).toBe(2);
        expect(stats.mediumConfidenceCount).toBe(1);
        expect(stats.lowConfidenceCount).toBe(0);
      });
    });

    describe('filterEdgesByConfidence', () => {
      it('filters by minimum confidence', () => {
        const filtered = filterEdgesByConfidence(mockEdges, 80);

        expect(filtered).toHaveLength(2);
        expect(filtered.every(e => e.confidence >= 80)).toBe(true);
      });
    });

    describe('filterEdgesByOperationType', () => {
      it('filters by operation type', () => {
        const filtered = filterEdgesByOperationType(mockEdges, 'terraform');

        expect(filtered).toHaveLength(2);
        expect(filtered.every(e => e.metadata.operationType === 'terraform')).toBe(true);
      });
    });
  });

  describe('Validation Functions', () => {
    describe('isValidTerraformNode', () => {
      it('validates correct node', () => {
        const node = createMockTerraformNode();
        expect(isValidTerraformNode(node)).toBe(true);
      });

      it('rejects invalid type', () => {
        const node = { ...createMockTerraformNode(), type: 'invalid' };
        expect(isValidTerraformNode(node)).toBe(false);
      });
    });

    describe('isValidHelmNode', () => {
      it('validates correct node', () => {
        const node = createMockHelmNode();
        expect(isValidHelmNode(node)).toBe(true);
      });

      it('rejects invalid type', () => {
        const node = { ...createMockHelmNode(), type: 'invalid' };
        expect(isValidHelmNode(node)).toBe(false);
      });
    });

    describe('isValidLinkMatch', () => {
      it('validates correct match', () => {
        const match: LinkMatch = {
          jobNodeId: 'job-1',
          targetNodeId: 'tf-1',
          operation: { type: 'terraform', command: 'apply', stepIndex: 0 },
          matchReason: 'working_dir_match',
          confidence: 90,
        };
        expect(isValidLinkMatch(match)).toBe(true);
      });

      it('rejects invalid confidence', () => {
        const match = {
          jobNodeId: 'job-1',
          targetNodeId: 'tf-1',
          operation: { type: 'terraform', command: 'apply', stepIndex: 0 },
          matchReason: 'working_dir_match',
          confidence: 150,
        };
        expect(isValidLinkMatch(match)).toBe(false);
      });
    });
  });

  describe('operatesOnEdgeToDbFormat', () => {
    it('converts edge to database format', () => {
      const edge: OperatesOnEdge = {
        id: 'edge-123',
        type: 'OPERATES_ON',
        sourceNodeId: 'job-1',
        targetNodeId: 'tf-1',
        confidence: 85,
        metadata: {
          operation: 'apply',
          operationType: 'terraform',
          stepIndex: 3,
        },
      };

      const row = operatesOnEdgeToDbFormat(edge, 'scan-xyz', 'tenant-abc');

      expect(row.id).toBe('edge-123');
      expect(row.scan_id).toBe('scan-xyz');
      expect(row.tenant_id).toBe('tenant-abc');
      expect(row.source_node_id).toBe('job-1');
      expect(row.target_node_id).toBe('tf-1');
      expect(row.confidence).toBeCloseTo(0.85, 2);
      expect(row.operation).toBe('apply');
      expect(row.operation_type).toBe('terraform');
      expect(row.step_index).toBe(3);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  describe('Full Pipeline Processing', () => {
    it('creates complete graph from workflow', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes, edges } = createPipelineNodes(workflow, 'scan-integration');

      // Verify pipeline node
      const pipelineNode = nodes.find(n => n.type === 'ci_pipeline') as PipelineNode;
      expect(pipelineNode).toBeDefined();
      expect(isPipelineNode(pipelineNode)).toBe(true);

      // Verify job nodes
      const jobNodes = nodes.filter(n => n.type === 'ci_job') as PipelineJobNode[];
      expect(jobNodes.every(j => isPipelineJobNode(j))).toBe(true);

      // Verify edges
      const containsEdges = edges.filter(e => e.type === 'PIPELINE_CONTAINS');
      const dependsOnEdges = edges.filter(e => e.type === 'JOB_DEPENDS_ON');

      expect(containsEdges.every(e => isPipelineContainsEdge(e))).toBe(true);
      expect(dependsOnEdges.every(e => isJobDependsOnEdge(e))).toBe(true);

      // Verify structure
      expect(containsEdges.length).toBe(jobNodes.length);
      expect(containsEdges.every(e => e.sourceNodeId === pipelineNode.id)).toBe(true);
    });

    it('links jobs to infrastructure after node creation', () => {
      const workflow = createMockParsedWorkflow();
      const { nodes } = createPipelineNodes(workflow, 'scan-link-test');

      const jobNodes = nodes.filter(n => n.type === 'ci_job') as PipelineJobNode[];

      const tfNodes = new Map<string, TerraformNode>([
        ['tf-1', createMockTerraformNode({ modulePath: './infra' })],
      ]);

      const helmNodes = new Map<string, HelmNode>([
        ['helm-1', createMockHelmNode({ chartPath: './charts/myapp' })],
      ]);

      const result = linkAllJobsToInfrastructure(jobNodes, tfNodes, helmNodes);

      // Should have links for both TF and Helm operations
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Case Handling', () => {
    it('handles job with no operations', () => {
      const workflow = createMockParsedWorkflow({
        jobs: new Map([
          ['empty-job', {
            id: 'empty-job',
            steps: [],
          }],
        ]),
      });

      const { nodes } = createPipelineNodes(workflow, 'scan-empty');

      const jobNode = nodes.find(n =>
        n.type === 'ci_job' && n.name === 'empty-job'
      ) as PipelineJobNode;

      expect(jobNode.metadata.operations).toHaveLength(0);
    });

    it('handles deeply nested working directories', () => {
      const jobNode = createMockJobNode({
        metadata: {
          ...createMockJobNode().metadata,
          operations: [
            {
              type: 'terraform', command: 'apply', stepIndex: 0,
              workingDir: './environments/prod/us-east-1/vpc',
            },
          ],
        },
      });

      const tfNodes = new Map<string, TerraformNode>([
        ['tf-1', createMockTerraformNode({
          modulePath: './environments/prod/us-east-1/vpc',
        })],
      ]);

      const edges = linkJobToTerraform(jobNode, tfNodes);

      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(edges[0].confidence).toBeGreaterThanOrEqual(80);
    });

    it('handles multiple CI systems consistently', () => {
      const systems: CIPipelineType[] = [
        'github_actions',
        'gitlab_ci',
        'azure_pipelines',
        'jenkins',
        'circleci',
      ];

      for (const pipelineType of systems) {
        const workflow = createMockParsedWorkflow({ pipelineType });
        const { nodes } = createPipelineNodes(workflow, `scan-${pipelineType}`);

        const pipelineNode = nodes.find(n => n.type === 'ci_pipeline') as PipelineNode;
        expect(pipelineNode.metadata.pipelineType).toBe(pipelineType);
        expect(isPipelineNode(pipelineNode)).toBe(true);
      }
    });
  });
});
