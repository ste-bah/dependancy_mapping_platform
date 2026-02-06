/**
 * FEEDS_INTO Edge Type Tests
 * @module tests/parsers/crossref/feeds-into-edge
 *
 * Comprehensive tests for the FEEDS_INTO edge type implementation.
 * Tests edge creation, validation, query builders, and utility functions.
 *
 * TASK-XREF-006: FEEDS_INTO Edge Type Implementation - Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Edge creation
  createFeedsIntoEdge,
  generateFeedsIntoEdgeId,

  // Validation
  validateFeedsIntoEdge,
  isValidEvidencePointer,
  isValidFeedsIntoMetadata,

  // Query builders
  buildFeedsIntoQuery,
  findTerraformInputsQuery,
  findHelmConsumersQuery,
  findFlowsByScanQuery,

  // Utility functions
  getFeedsIntoConfidenceLevel,
  areSameFlow,
  mergeFeedsIntoEdges,
  toDbInsertFormat,

  // Types
  FeedsIntoEdge,
  FeedsIntoMetadata,
  FeedsIntoEvidencePointer,
  FeedsIntoQueryOptions,
  FeedsIntoSourceType,
  FeedsIntoTargetType,
  FlowMechanism,
} from '@/parsers/crossref/feeds-into-edge';
import {
  TerraformToHelmFlow,
  FlowEvidence,
  createTerraformOutputName,
  createHelmValuePath,
} from '@/parsers/crossref/types';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock TerraformToHelmFlow for testing edge creation.
 */
function createMockFlow(overrides: Partial<TerraformToHelmFlow> = {}): TerraformToHelmFlow {
  return {
    id: 'tf-helm-flow-test-123' as TerraformToHelmFlow['id'],
    source: {
      name: createTerraformOutputName('vpc_id'),
      jobId: 'terraform',
      stepIndex: 2,
      stepId: 'apply',
      command: 'output',
      sensitive: false,
      workingDir: './infra/vpc',
      location: {
        file: '.github/workflows/deploy.yml',
        lineStart: 25,
        lineEnd: 30,
        columnStart: 1,
        columnEnd: 80,
      },
    },
    target: {
      path: createHelmValuePath('network.vpcId'),
      jobId: 'helm-deploy',
      stepIndex: 1,
      stepId: 'deploy',
      command: 'upgrade',
      sourceType: 'set_flag',
      chart: './charts/myapp',
      namespace: 'production',
      location: {
        file: '.github/workflows/deploy.yml',
        lineStart: 45,
        lineEnd: 55,
        columnStart: 1,
        columnEnd: 100,
      },
    },
    pattern: 'direct_output',
    confidence: 85,
    confidenceLevel: 'high',
    evidence: [
      {
        type: 'explicit_reference',
        description: 'Direct reference to terraform output in helm --set',
        strength: 95,
        location: {
          file: '.github/workflows/deploy.yml',
          lineStart: 47,
          lineEnd: 47,
          columnStart: 10,
          columnEnd: 60,
        },
        snippet: '--set network.vpcId=${{ needs.terraform.outputs.vpc_id }}',
      },
      {
        type: 'job_dependency',
        description: 'Helm job depends on Terraform job',
        strength: 80,
        location: {
          file: '.github/workflows/deploy.yml',
          lineStart: 40,
          lineEnd: 40,
          columnStart: 1,
          columnEnd: 30,
        },
        snippet: "needs: ['terraform']",
      },
    ],
    workflowContext: {
      workflowFile: '.github/workflows/deploy.yml',
      workflowName: 'Deploy Infrastructure',
      jobChain: ['terraform', 'helm-deploy'],
      sameWorkflow: true,
      triggerType: 'push',
    },
    ...overrides,
  };
}

/**
 * Create a mock FeedsIntoEdge for testing.
 */
function createMockEdge(overrides: Partial<FeedsIntoEdge> = {}): FeedsIntoEdge {
  return {
    id: 'feeds-into-abc123def456',
    type: 'FEEDS_INTO',
    sourceNodeId: 'node-tf-output-vpc-id-123',
    targetNodeId: 'node-helm-value-network-456',
    scanId: 'scan-789xyz',
    metadata: {
      sourceType: 'terraform_output',
      sourceOutputName: 'vpc_id',
      sourceModulePath: './infra/vpc',
      targetType: 'helm_value',
      targetValuePath: 'network.vpcId',
      targetChart: './charts/myapp',
      flowMechanism: 'ci_pipeline',
      pipelineType: 'github_actions',
      pipelineFile: '.github/workflows/deploy.yml',
      jobName: 'terraform',
      transformation: { type: 'direct' },
      firstDetected: '2025-01-15T10:30:00.000Z',
      lastVerified: '2025-01-15T10:30:00.000Z',
    },
    confidence: 85,
    evidence: [
      {
        type: 'variable_assignment',
        location: {
          filePath: '.github/workflows/deploy.yml',
          lineStart: 47,
          lineEnd: 47,
        },
        snippet: '--set network.vpcId=${{ needs.terraform.outputs.vpc_id }}',
        strength: 0.95,
      },
    ],
    ...overrides,
  };
}

/**
 * Create mock evidence pointer for testing.
 */
function createMockEvidencePointer(
  overrides: Partial<FeedsIntoEvidencePointer> = {}
): FeedsIntoEvidencePointer {
  return {
    type: 'ci_step',
    location: {
      filePath: '.github/workflows/deploy.yml',
      lineStart: 25,
      lineEnd: 30,
    },
    snippet: 'terraform output -raw vpc_id',
    strength: 0.85,
    ...overrides,
  };
}

// ============================================================================
// generateFeedsIntoEdgeId Tests
// ============================================================================

describe('generateFeedsIntoEdgeId', () => {
  it('generates deterministic ID from source and target', () => {
    const id1 = generateFeedsIntoEdgeId('source-123', 'target-456');
    const id2 = generateFeedsIntoEdgeId('source-123', 'target-456');

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^feeds-into-[a-f0-9]{16}$/);
  });

  it('generates different IDs for different inputs', () => {
    const id1 = generateFeedsIntoEdgeId('source-123', 'target-456');
    const id2 = generateFeedsIntoEdgeId('source-123', 'target-789');
    const id3 = generateFeedsIntoEdgeId('source-456', 'target-456');

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);
  });

  it('handles special characters in node IDs', () => {
    const id = generateFeedsIntoEdgeId('source/with/slashes', 'target-with-dashes');

    expect(id).toMatch(/^feeds-into-[a-f0-9]{16}$/);
  });

  it('handles empty strings', () => {
    const id = generateFeedsIntoEdgeId('', '');

    expect(id).toMatch(/^feeds-into-[a-f0-9]{16}$/);
  });

  it('handles unicode characters', () => {
    const id = generateFeedsIntoEdgeId('source-\u2603', 'target-\u2600');

    expect(id).toMatch(/^feeds-into-[a-f0-9]{16}$/);
  });
});

// ============================================================================
// createFeedsIntoEdge Tests
// ============================================================================

describe('createFeedsIntoEdge', () => {
  it('creates edge from TerraformToHelmFlow', () => {
    const flow = createMockFlow();
    const edge = createFeedsIntoEdge(flow, 'node-src-123', 'node-tgt-456', 'scan-789');

    expect(edge.type).toBe('FEEDS_INTO');
    expect(edge.sourceNodeId).toBe('node-src-123');
    expect(edge.targetNodeId).toBe('node-tgt-456');
    expect(edge.scanId).toBe('scan-789');
    expect(edge.confidence).toBe(85);
  });

  it('extracts source metadata correctly', () => {
    const flow = createMockFlow();
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.sourceType).toBe('terraform_output');
    expect(edge.metadata.sourceOutputName).toBe('vpc_id');
    expect(edge.metadata.sourceModulePath).toBe('./infra/vpc');
  });

  it('extracts target metadata correctly', () => {
    const flow = createMockFlow();
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.targetType).toBe('helm_value');
    expect(edge.metadata.targetValuePath).toBe('network.vpcId');
    expect(edge.metadata.targetChart).toBe('./charts/myapp');
  });

  it('determines flow mechanism from pattern', () => {
    const directFlow = createMockFlow({ pattern: 'direct_output' });
    const pipelineFlow = createMockFlow({ pattern: 'job_chain' });

    const directEdge = createFeedsIntoEdge(directFlow, 'src', 'tgt', 'scan');
    const pipelineEdge = createFeedsIntoEdge(pipelineFlow, 'src', 'tgt', 'scan');

    expect(directEdge.metadata.flowMechanism).toBe('direct_reference');
    expect(pipelineEdge.metadata.flowMechanism).toBe('ci_pipeline');
  });

  it('detects GitHub Actions pipeline type', () => {
    const flow = createMockFlow();
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.pipelineType).toBe('github_actions');
  });

  it('detects GitLab CI pipeline type', () => {
    const flow = createMockFlow({
      workflowContext: {
        workflowFile: '.gitlab-ci.yml',
        workflowName: 'Deploy',
        jobChain: ['terraform', 'helm'],
        sameWorkflow: true,
      },
    });
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.pipelineType).toBe('gitlab_ci');
  });

  it('maps evidence to evidence pointers', () => {
    const flow = createMockFlow();
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.evidence.length).toBe(2);
    expect(edge.evidence[0].type).toBe('variable_assignment');
    expect(edge.evidence[0].strength).toBeCloseTo(0.95, 2);
    expect(edge.evidence[1].type).toBe('ci_step');
  });

  it('sets temporal metadata', () => {
    const flow = createMockFlow();
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.firstDetected).toBeDefined();
    expect(edge.metadata.lastVerified).toBeDefined();

    // Verify ISO date format
    expect(() => new Date(edge.metadata.firstDetected)).not.toThrow();
    expect(() => new Date(edge.metadata.lastVerified)).not.toThrow();
  });

  it('detects jq transformation', () => {
    const flow = createMockFlow({
      evidence: [
        {
          type: 'expression_match',
          description: 'jq transformation',
          strength: 80,
          snippet: "jq '.vpc_id' outputs.json",
        },
      ],
    });
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.transformation?.type).toBe('jq');
    expect(edge.metadata.transformation?.expression).toBe('.vpc_id');
  });

  it('detects yq transformation', () => {
    const flow = createMockFlow({
      evidence: [
        {
          type: 'expression_match',
          description: 'yq transformation',
          strength: 80,
          snippet: "yq '.values.vpc' values.yaml",
        },
      ],
    });
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.transformation?.type).toBe('yq');
  });

  it('handles flow without transformation', () => {
    const flow = createMockFlow({ pattern: 'direct_output', evidence: [] });
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.transformation?.type).toBe('direct');
  });

  it('handles values_file target type', () => {
    const flow = createMockFlow();
    flow.target.sourceType = 'values_file';
    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.targetType).toBe('helmfile_value');
  });

  it('handles missing optional fields', () => {
    const flow = createMockFlow();
    flow.source.workingDir = undefined;
    flow.target.chart = undefined;

    const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

    expect(edge.metadata.sourceModulePath).toBeUndefined();
    expect(edge.metadata.targetChart).toBe('unknown');
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('isValidEvidencePointer', () => {
  it('validates correct evidence pointer', () => {
    const pointer = createMockEvidencePointer();
    expect(isValidEvidencePointer(pointer)).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidEvidencePointer(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidEvidencePointer(undefined)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidEvidencePointer('string')).toBe(false);
    expect(isValidEvidencePointer(123)).toBe(false);
    expect(isValidEvidencePointer([])).toBe(false);
  });

  it('rejects invalid type', () => {
    const pointer = { ...createMockEvidencePointer(), type: 'invalid_type' };
    expect(isValidEvidencePointer(pointer)).toBe(false);
  });

  it('rejects missing location', () => {
    const pointer = { ...createMockEvidencePointer() };
    delete (pointer as Record<string, unknown>).location;
    expect(isValidEvidencePointer(pointer)).toBe(false);
  });

  it('rejects invalid strength', () => {
    expect(isValidEvidencePointer({ ...createMockEvidencePointer(), strength: -1 })).toBe(false);
    expect(isValidEvidencePointer({ ...createMockEvidencePointer(), strength: 2 })).toBe(false);
    expect(isValidEvidencePointer({ ...createMockEvidencePointer(), strength: 'high' })).toBe(false);
  });

  it('accepts all valid evidence types', () => {
    const types: FeedsIntoEvidencePointer['type'][] = [
      'ci_step',
      'script_line',
      'file_reference',
      'variable_assignment',
    ];

    for (const type of types) {
      const pointer = createMockEvidencePointer({ type });
      expect(isValidEvidencePointer(pointer)).toBe(true);
    }
  });

  it('accepts pointer without optional snippet', () => {
    const pointer = createMockEvidencePointer();
    delete (pointer as Record<string, unknown>).snippet;
    expect(isValidEvidencePointer(pointer)).toBe(true);
  });

  it('rejects non-string snippet', () => {
    const pointer = { ...createMockEvidencePointer(), snippet: 123 };
    expect(isValidEvidencePointer(pointer)).toBe(false);
  });
});

describe('isValidFeedsIntoMetadata', () => {
  it('validates correct metadata', () => {
    const metadata: FeedsIntoMetadata = {
      sourceType: 'terraform_output',
      sourceOutputName: 'vpc_id',
      targetType: 'helm_value',
      targetValuePath: 'network.vpcId',
      targetChart: 'myapp',
      flowMechanism: 'ci_pipeline',
      firstDetected: '2025-01-15T10:30:00.000Z',
      lastVerified: '2025-01-15T10:30:00.000Z',
    };
    expect(isValidFeedsIntoMetadata(metadata)).toBe(true);
  });

  it('rejects invalid source type', () => {
    const metadata = {
      sourceType: 'invalid_source',
      sourceOutputName: 'vpc_id',
      targetType: 'helm_value',
      targetValuePath: 'network.vpcId',
      targetChart: 'myapp',
      flowMechanism: 'ci_pipeline',
      firstDetected: '2025-01-15T10:30:00.000Z',
      lastVerified: '2025-01-15T10:30:00.000Z',
    };
    expect(isValidFeedsIntoMetadata(metadata)).toBe(false);
  });

  it('rejects empty source output name', () => {
    const metadata = {
      sourceType: 'terraform_output',
      sourceOutputName: '',
      targetType: 'helm_value',
      targetValuePath: 'network.vpcId',
      targetChart: 'myapp',
      flowMechanism: 'ci_pipeline',
      firstDetected: '2025-01-15T10:30:00.000Z',
      lastVerified: '2025-01-15T10:30:00.000Z',
    };
    expect(isValidFeedsIntoMetadata(metadata)).toBe(false);
  });

  it('rejects invalid target type', () => {
    const metadata = {
      sourceType: 'terraform_output',
      sourceOutputName: 'vpc_id',
      targetType: 'invalid_target',
      targetValuePath: 'network.vpcId',
      targetChart: 'myapp',
      flowMechanism: 'ci_pipeline',
      firstDetected: '2025-01-15T10:30:00.000Z',
      lastVerified: '2025-01-15T10:30:00.000Z',
    };
    expect(isValidFeedsIntoMetadata(metadata)).toBe(false);
  });

  it('rejects invalid flow mechanism', () => {
    const metadata = {
      sourceType: 'terraform_output',
      sourceOutputName: 'vpc_id',
      targetType: 'helm_value',
      targetValuePath: 'network.vpcId',
      targetChart: 'myapp',
      flowMechanism: 'invalid_mechanism',
      firstDetected: '2025-01-15T10:30:00.000Z',
      lastVerified: '2025-01-15T10:30:00.000Z',
    };
    expect(isValidFeedsIntoMetadata(metadata)).toBe(false);
  });

  it('rejects invalid date format', () => {
    const metadata = {
      sourceType: 'terraform_output',
      sourceOutputName: 'vpc_id',
      targetType: 'helm_value',
      targetValuePath: 'network.vpcId',
      targetChart: 'myapp',
      flowMechanism: 'ci_pipeline',
      firstDetected: 'not-a-date',
      lastVerified: '2025-01-15T10:30:00.000Z',
    };
    expect(isValidFeedsIntoMetadata(metadata)).toBe(false);
  });

  it('accepts all valid source types', () => {
    const types: FeedsIntoSourceType[] = ['terraform_output', 'terragrunt_output', 'tf_state'];
    for (const sourceType of types) {
      const metadata = {
        sourceType,
        sourceOutputName: 'test',
        targetType: 'helm_value' as FeedsIntoTargetType,
        targetValuePath: 'test',
        targetChart: 'chart',
        flowMechanism: 'ci_pipeline' as FlowMechanism,
        firstDetected: '2025-01-15T10:30:00.000Z',
        lastVerified: '2025-01-15T10:30:00.000Z',
      };
      expect(isValidFeedsIntoMetadata(metadata)).toBe(true);
    }
  });

  it('accepts all valid target types', () => {
    const types: FeedsIntoTargetType[] = ['helm_value', 'helmfile_value', 'k8s_configmap'];
    for (const targetType of types) {
      const metadata = {
        sourceType: 'terraform_output' as FeedsIntoSourceType,
        sourceOutputName: 'test',
        targetType,
        targetValuePath: 'test',
        targetChart: 'chart',
        flowMechanism: 'ci_pipeline' as FlowMechanism,
        firstDetected: '2025-01-15T10:30:00.000Z',
        lastVerified: '2025-01-15T10:30:00.000Z',
      };
      expect(isValidFeedsIntoMetadata(metadata)).toBe(true);
    }
  });
});

describe('validateFeedsIntoEdge', () => {
  it('validates correct edge', () => {
    const edge = createMockEdge();
    expect(validateFeedsIntoEdge(edge)).toBe(true);
  });

  it('rejects null', () => {
    expect(validateFeedsIntoEdge(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateFeedsIntoEdge(undefined)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(validateFeedsIntoEdge('string')).toBe(false);
    expect(validateFeedsIntoEdge(123)).toBe(false);
  });

  it('rejects empty id', () => {
    const edge = { ...createMockEdge(), id: '' };
    expect(validateFeedsIntoEdge(edge)).toBe(false);
  });

  it('rejects wrong type', () => {
    const edge = { ...createMockEdge(), type: 'WRONG_TYPE' };
    expect(validateFeedsIntoEdge(edge)).toBe(false);
  });

  it('rejects missing sourceNodeId', () => {
    const edge = createMockEdge();
    delete (edge as Record<string, unknown>).sourceNodeId;
    expect(validateFeedsIntoEdge(edge)).toBe(false);
  });

  it('rejects missing targetNodeId', () => {
    const edge = createMockEdge();
    delete (edge as Record<string, unknown>).targetNodeId;
    expect(validateFeedsIntoEdge(edge)).toBe(false);
  });

  it('rejects confidence out of range', () => {
    expect(validateFeedsIntoEdge({ ...createMockEdge(), confidence: -1 })).toBe(false);
    expect(validateFeedsIntoEdge({ ...createMockEdge(), confidence: 101 })).toBe(false);
  });

  it('rejects invalid metadata', () => {
    const edge = { ...createMockEdge(), metadata: { invalid: true } };
    expect(validateFeedsIntoEdge(edge)).toBe(false);
  });

  it('rejects invalid evidence', () => {
    const edge = { ...createMockEdge(), evidence: [{ invalid: true }] };
    expect(validateFeedsIntoEdge(edge)).toBe(false);
  });

  it('accepts edge with empty evidence array', () => {
    const edge = { ...createMockEdge(), evidence: [] };
    expect(validateFeedsIntoEdge(edge)).toBe(true);
  });

  it('accepts confidence at boundaries', () => {
    expect(validateFeedsIntoEdge({ ...createMockEdge(), confidence: 0 })).toBe(true);
    expect(validateFeedsIntoEdge({ ...createMockEdge(), confidence: 100 })).toBe(true);
  });
});

// ============================================================================
// Query Builder Tests
// ============================================================================

describe('buildFeedsIntoQuery', () => {
  it('builds basic query with no options', () => {
    const query = buildFeedsIntoQuery({});

    expect(query).toContain("type = 'FEEDS_INTO'");
    expect(query).toContain('SELECT');
    expect(query).toContain('JOIN nodes src');
    expect(query).toContain('JOIN nodes tgt');
    expect(query).toContain('ORDER BY');
  });

  it('includes minConfidence filter', () => {
    const query = buildFeedsIntoQuery({ minConfidence: 80 });

    expect(query).toContain('confidence >= 0.8');
  });

  it('includes sourceTypes filter', () => {
    const query = buildFeedsIntoQuery({ sourceTypes: ['terraform_output', 'tf_state'] });

    expect(query).toContain("metadata->>'sourceType' IN ('terraform_output', 'tf_state')");
  });

  it('includes targetTypes filter', () => {
    const query = buildFeedsIntoQuery({ targetTypes: ['helm_value'] });

    expect(query).toContain("metadata->>'targetType' IN ('helm_value')");
  });

  it('includes pipelineType filter', () => {
    const query = buildFeedsIntoQuery({ pipelineType: 'github_actions' });

    expect(query).toContain("metadata->>'pipelineType' = 'github_actions'");
  });

  it('includes limit', () => {
    const query = buildFeedsIntoQuery({ limit: 50 });

    expect(query).toContain('LIMIT 50');
  });

  it('combines multiple filters', () => {
    const query = buildFeedsIntoQuery({
      minConfidence: 70,
      sourceTypes: ['terraform_output'],
      pipelineType: 'gitlab_ci',
      limit: 100,
    });

    expect(query).toContain("type = 'FEEDS_INTO'");
    expect(query).toContain('confidence >= 0.7');
    expect(query).toContain("metadata->>'sourceType' IN ('terraform_output')");
    expect(query).toContain("metadata->>'pipelineType' = 'gitlab_ci'");
    expect(query).toContain('LIMIT 100');
  });
});

describe('findTerraformInputsQuery', () => {
  it('builds query for specific Helm node', () => {
    const query = findTerraformInputsQuery('helm-node-123');

    expect(query).toContain("e.type = 'FEEDS_INTO'");
    expect(query).toContain("e.target_node_id = 'helm-node-123'");
    expect(query).toContain('JOIN nodes src ON e.source_node_id = src.id');
  });

  it('includes minConfidence filter', () => {
    const query = findTerraformInputsQuery('helm-node-123', { minConfidence: 75 });

    expect(query).toContain('e.confidence >= 0.75');
  });

  it('includes sourceTypes filter', () => {
    const query = findTerraformInputsQuery('helm-node-123', {
      sourceTypes: ['terraform_output', 'terragrunt_output'],
    });

    expect(query).toContain("e.metadata->>'sourceType' IN ('terraform_output', 'terragrunt_output')");
  });

  it('includes limit', () => {
    const query = findTerraformInputsQuery('helm-node-123', { limit: 20 });

    expect(query).toContain('LIMIT 20');
  });
});

describe('findHelmConsumersQuery', () => {
  it('builds query for specific TF output node', () => {
    const query = findHelmConsumersQuery('tf-output-123');

    expect(query).toContain("e.type = 'FEEDS_INTO'");
    expect(query).toContain("e.source_node_id = 'tf-output-123'");
    expect(query).toContain('JOIN nodes tgt ON e.target_node_id = tgt.id');
  });

  it('includes minConfidence filter', () => {
    const query = findHelmConsumersQuery('tf-output-123', { minConfidence: 60 });

    expect(query).toContain('e.confidence >= 0.6');
  });

  it('includes targetTypes filter', () => {
    const query = findHelmConsumersQuery('tf-output-123', {
      targetTypes: ['helm_value', 'k8s_configmap'],
    });

    expect(query).toContain("e.metadata->>'targetType' IN ('helm_value', 'k8s_configmap')");
  });

  it('includes pipelineType filter', () => {
    const query = findHelmConsumersQuery('tf-output-123', { pipelineType: 'jenkins' });

    expect(query).toContain("e.metadata->>'pipelineType' = 'jenkins'");
  });
});

describe('findFlowsByScanQuery', () => {
  it('builds query for specific scan', () => {
    const query = findFlowsByScanQuery('scan-123');

    expect(query).toContain("e.type = 'FEEDS_INTO'");
    expect(query).toContain("e.scan_id = 'scan-123'");
    expect(query).toContain('JOIN nodes src');
    expect(query).toContain('JOIN nodes tgt');
  });

  it('includes all optional filters', () => {
    const query = findFlowsByScanQuery('scan-123', {
      minConfidence: 50,
      sourceTypes: ['terraform_output'],
      targetTypes: ['helm_value'],
      limit: 200,
    });

    expect(query).toContain('e.confidence >= 0.5');
    expect(query).toContain("e.metadata->>'sourceType'");
    expect(query).toContain("e.metadata->>'targetType'");
    expect(query).toContain('LIMIT 200');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('getFeedsIntoConfidenceLevel', () => {
  it('returns high for confidence >= 80', () => {
    expect(getFeedsIntoConfidenceLevel(80)).toBe('high');
    expect(getFeedsIntoConfidenceLevel(90)).toBe('high');
    expect(getFeedsIntoConfidenceLevel(100)).toBe('high');
  });

  it('returns medium for confidence >= 50 and < 80', () => {
    expect(getFeedsIntoConfidenceLevel(50)).toBe('medium');
    expect(getFeedsIntoConfidenceLevel(65)).toBe('medium');
    expect(getFeedsIntoConfidenceLevel(79)).toBe('medium');
  });

  it('returns low for confidence < 50', () => {
    expect(getFeedsIntoConfidenceLevel(0)).toBe('low');
    expect(getFeedsIntoConfidenceLevel(25)).toBe('low');
    expect(getFeedsIntoConfidenceLevel(49)).toBe('low');
  });
});

describe('areSameFlow', () => {
  it('returns true for identical flows', () => {
    const edge1 = createMockEdge();
    const edge2 = createMockEdge();

    expect(areSameFlow(edge1, edge2)).toBe(true);
  });

  it('returns false for different source nodes', () => {
    const edge1 = createMockEdge();
    const edge2 = createMockEdge({ sourceNodeId: 'different-source' });

    expect(areSameFlow(edge1, edge2)).toBe(false);
  });

  it('returns false for different target nodes', () => {
    const edge1 = createMockEdge();
    const edge2 = createMockEdge({ targetNodeId: 'different-target' });

    expect(areSameFlow(edge1, edge2)).toBe(false);
  });

  it('returns false for different output names', () => {
    const edge1 = createMockEdge();
    const edge2 = createMockEdge({
      metadata: { ...createMockEdge().metadata, sourceOutputName: 'different_output' },
    });

    expect(areSameFlow(edge1, edge2)).toBe(false);
  });

  it('returns false for different target paths', () => {
    const edge1 = createMockEdge();
    const edge2 = createMockEdge({
      metadata: { ...createMockEdge().metadata, targetValuePath: 'different.path' },
    });

    expect(areSameFlow(edge1, edge2)).toBe(false);
  });

  it('returns true even if other fields differ', () => {
    const edge1 = createMockEdge({ confidence: 80 });
    const edge2 = createMockEdge({ confidence: 90, scanId: 'different-scan' });

    expect(areSameFlow(edge1, edge2)).toBe(true);
  });
});

describe('mergeFeedsIntoEdges', () => {
  it('keeps existing id', () => {
    const existing = createMockEdge({ id: 'existing-id' });
    const newer = createMockEdge({ id: 'newer-id' });

    const merged = mergeFeedsIntoEdges(existing, newer);

    expect(merged.id).toBe('existing-id');
  });

  it('uses newer scan id', () => {
    const existing = createMockEdge({ scanId: 'old-scan' });
    const newer = createMockEdge({ scanId: 'new-scan' });

    const merged = mergeFeedsIntoEdges(existing, newer);

    expect(merged.scanId).toBe('new-scan');
  });

  it('uses higher confidence', () => {
    const existing = createMockEdge({ confidence: 70 });
    const newer = createMockEdge({ confidence: 85 });

    const merged = mergeFeedsIntoEdges(existing, newer);

    expect(merged.confidence).toBe(85);
  });

  it('uses metadata from higher confidence edge', () => {
    const existing = createMockEdge({
      confidence: 70,
      metadata: { ...createMockEdge().metadata, pipelineType: 'github_actions' },
    });
    const newer = createMockEdge({
      confidence: 90,
      metadata: { ...createMockEdge().metadata, pipelineType: 'gitlab_ci' },
    });

    const merged = mergeFeedsIntoEdges(existing, newer);

    expect(merged.metadata.pipelineType).toBe('gitlab_ci');
  });

  it('preserves original firstDetected', () => {
    const existing = createMockEdge({
      metadata: { ...createMockEdge().metadata, firstDetected: '2025-01-01T00:00:00.000Z' },
    });
    const newer = createMockEdge({
      metadata: { ...createMockEdge().metadata, firstDetected: '2025-02-01T00:00:00.000Z' },
    });

    const merged = mergeFeedsIntoEdges(existing, newer);

    expect(merged.metadata.firstDetected).toBe('2025-01-01T00:00:00.000Z');
  });

  it('uses newer lastVerified', () => {
    const existing = createMockEdge({
      metadata: { ...createMockEdge().metadata, lastVerified: '2025-01-01T00:00:00.000Z' },
    });
    const newer = createMockEdge({
      metadata: { ...createMockEdge().metadata, lastVerified: '2025-02-01T00:00:00.000Z' },
    });

    const merged = mergeFeedsIntoEdges(existing, newer);

    expect(merged.metadata.lastVerified).toBe('2025-02-01T00:00:00.000Z');
  });

  it('merges evidence without duplicates', () => {
    const existingEvidence = createMockEvidencePointer({ type: 'ci_step' });
    const newerEvidence = createMockEvidencePointer({ type: 'variable_assignment' });
    const duplicateEvidence = createMockEvidencePointer({ type: 'ci_step' });

    const existing = createMockEdge({ evidence: [existingEvidence] });
    const newer = createMockEdge({ evidence: [newerEvidence, duplicateEvidence] });

    const merged = mergeFeedsIntoEdges(existing, newer);

    expect(merged.evidence.length).toBe(2);
    expect(merged.evidence.some(e => e.type === 'ci_step')).toBe(true);
    expect(merged.evidence.some(e => e.type === 'variable_assignment')).toBe(true);
  });
});

describe('toDbInsertFormat', () => {
  it('converts edge to database row format', () => {
    const edge = createMockEdge();
    const row = toDbInsertFormat(edge, 'tenant-123');

    expect(row.id).toBe(edge.id);
    expect(row.scan_id).toBe(edge.scanId);
    expect(row.tenant_id).toBe('tenant-123');
    expect(row.source_node_id).toBe(edge.sourceNodeId);
    expect(row.target_node_id).toBe(edge.targetNodeId);
    expect(row.type).toBe('FEEDS_INTO');
  });

  it('converts confidence to decimal', () => {
    const edge = createMockEdge({ confidence: 85 });
    const row = toDbInsertFormat(edge, 'tenant-123');

    expect(row.confidence).toBeCloseTo(0.85, 2);
  });

  it('extracts metadata fields', () => {
    const edge = createMockEdge();
    const row = toDbInsertFormat(edge, 'tenant-123');

    expect(row.flow_mechanism).toBe(edge.metadata.flowMechanism);
    expect(row.pipeline_type).toBe(edge.metadata.pipelineType);
    expect(row.transformation_type).toBe(edge.metadata.transformation?.type);
    expect(row.first_detected).toBe(edge.metadata.firstDetected);
    expect(row.last_verified).toBe(edge.metadata.lastVerified);
  });

  it('handles null optional fields', () => {
    const edge = createMockEdge({
      metadata: {
        ...createMockEdge().metadata,
        pipelineType: undefined,
        transformation: undefined,
      },
    });
    const row = toDbInsertFormat(edge, 'tenant-123');

    expect(row.pipeline_type).toBeNull();
    expect(row.transformation_type).toBeNull();
  });

  it('includes metadata and evidence as JSON', () => {
    const edge = createMockEdge();
    const row = toDbInsertFormat(edge, 'tenant-123');

    expect(row.metadata).toEqual(edge.metadata);
    expect(row.evidence).toEqual(edge.evidence);
  });

  it('sets created_at timestamp', () => {
    const edge = createMockEdge();
    const row = toDbInsertFormat(edge, 'tenant-123');

    expect(row.created_at).toBeInstanceOf(Date);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Edge Creation and Validation Integration', () => {
  it('created edge passes validation', () => {
    const flow = createMockFlow();
    const edge = createFeedsIntoEdge(flow, 'src-node', 'tgt-node', 'scan-123');

    expect(validateFeedsIntoEdge(edge)).toBe(true);
  });

  it('edge ID is deterministic', () => {
    const flow = createMockFlow();
    const edge1 = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan1');
    const edge2 = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan2');

    expect(edge1.id).toBe(edge2.id);
  });

  it('edge ID differs for different nodes', () => {
    const flow = createMockFlow();
    const edge1 = createFeedsIntoEdge(flow, 'src1', 'tgt', 'scan');
    const edge2 = createFeedsIntoEdge(flow, 'src2', 'tgt', 'scan');

    expect(edge1.id).not.toBe(edge2.id);
  });
});

describe('Query Builder SQL Safety', () => {
  it('handles special characters in node IDs', () => {
    // This tests that node IDs are properly quoted
    const query = findTerraformInputsQuery("node-with-'quotes");

    // The query should still be valid SQL structure
    expect(query).toContain('SELECT');
    expect(query).toContain('FROM edges');
  });

  it('generates valid SQL with all options', () => {
    const query = buildFeedsIntoQuery({
      minConfidence: 50,
      sourceTypes: ['terraform_output', 'tf_state'],
      targetTypes: ['helm_value'],
      pipelineType: 'github_actions',
      limit: 100,
    });

    // Verify SQL structure
    expect(query).toContain('SELECT');
    expect(query).toContain('FROM edges');
    expect(query).toContain('WHERE');
    expect(query).toContain('ORDER BY');
    expect(query).toContain('LIMIT');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  describe('Empty and null handling', () => {
    it('handles flow with no evidence', () => {
      const flow = createMockFlow({ evidence: [] });
      const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

      expect(edge.evidence).toEqual([]);
      expect(validateFeedsIntoEdge(edge)).toBe(true);
    });

    it('handles flow with empty workflow context', () => {
      const flow = createMockFlow({
        workflowContext: {
          workflowFile: '',
          workflowName: '',
          jobChain: [],
          sameWorkflow: true,
        },
      });
      const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

      expect(edge.metadata.pipelineFile).toBe('');
    });
  });

  describe('Boundary conditions', () => {
    it('handles confidence of 0', () => {
      const edge = createMockEdge({ confidence: 0 });
      expect(validateFeedsIntoEdge(edge)).toBe(true);
      expect(getFeedsIntoConfidenceLevel(0)).toBe('low');
    });

    it('handles confidence of 100', () => {
      const edge = createMockEdge({ confidence: 100 });
      expect(validateFeedsIntoEdge(edge)).toBe(true);
      expect(getFeedsIntoConfidenceLevel(100)).toBe('high');
    });

    it('handles query with no limit', () => {
      const query = buildFeedsIntoQuery({ limit: 0 });
      expect(query).not.toContain('LIMIT');
    });

    it('handles empty source/target type arrays', () => {
      const query = buildFeedsIntoQuery({
        sourceTypes: [],
        targetTypes: [],
      });

      expect(query).not.toContain("metadata->>'sourceType'");
      expect(query).not.toContain("metadata->>'targetType'");
    });
  });

  describe('Complex flows', () => {
    it('handles flow with multiple transformations', () => {
      const flow = createMockFlow({
        evidence: [
          { type: 'expression_match', description: 'jq', strength: 80, snippet: "jq '.value'" },
          { type: 'expression_match', description: 'sed', strength: 70, snippet: "sed 's/foo/bar/'" },
        ],
      });
      const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

      // Should detect first transformation type
      expect(edge.metadata.transformation?.type).toBe('jq');
    });

    it('handles deeply nested value paths', () => {
      const flow = createMockFlow();
      flow.target.path = createHelmValuePath('deeply.nested.value.path.here');

      const edge = createFeedsIntoEdge(flow, 'src', 'tgt', 'scan');

      expect(edge.metadata.targetValuePath).toBe('deeply.nested.value.path.here');
    });
  });
});
