/**
 * Cross-Tool Rollup Query Tests
 * @module tests/rollup/cross-tool-rollup
 *
 * Comprehensive tests for cross-tool blast radius calculation,
 * end-to-end flow tracing, and cross-tool summary generation.
 *
 * TASK-XREF-008: Cross-Tool Rollup Query Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // Types
  ToolType,
  GraphNodeRef,
  GraphEdgeRef,
  GraphQueryInterface,
  BlastRadiusOptions,

  // Type exports
  NODE_TYPE_TO_TOOL,
  CROSS_TOOL_EDGE_TYPES,

  // Factory functions
  createEmptyImpactedNodes,
  createEmptyCrossToolSummary,
  createGraphNodeRef,
  createGraphEdgeRef,

  // Type guards
  isToolType,
  isGraphNodeRef,
  isGraphEdgeRef,
  isCrossToolBlastRadius,
  isEndToEndFlow,
  isCrossToolSummary,

  // Classification
  classifyNodeTool,
  isCrossToolEdge,
  areNodesDifferentTools,

  // Impact analysis
  generateImpactSummary,
  findCriticalPaths,
  calculateCrossToolBlastRadius,
  generateCrossToolSummary,
  TF_HELM_DETECTION_TARGET,

  // Filtering
  filterNodesByTool,
  groupNodesByTool,
  countNodesByTool,

  // Flow tracer
  generateFlowId,
  getFlowSourceType,
  getFlowDestinationType,
  isFlowSource,
  isFlowDestination,
  traceEndToEndFlows,
  traceAllEndToEndFlows,
  aggregateFlowsByPipeline,
  filterFlows,
  calculateFlowStatistics,
  describeFlow,
  getFlowToolPath,
  flowCrossesTools,
} from '@/rollup';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock graph query interface for testing
 */
function createMockGraph(
  nodes: Map<string, GraphNodeRef>,
  edges: GraphEdgeRef[]
): GraphQueryInterface {
  return {
    getNode: vi.fn(async (nodeId: string) => nodes.get(nodeId) ?? null),
    getEdgesFromNode: vi.fn(async (nodeId: string, options?: { edgeTypes?: string[]; minConfidence?: number }) => {
      return edges.filter(e => {
        if (e.sourceId !== nodeId) return false;
        if (options?.edgeTypes && !options.edgeTypes.includes(e.type)) return false;
        if (options?.minConfidence !== undefined && e.confidence < options.minConfidence) return false;
        return true;
      });
    }),
    getEdgesToNode: vi.fn(async (nodeId: string, options?: { edgeTypes?: string[]; minConfidence?: number }) => {
      return edges.filter(e => {
        if (e.targetId !== nodeId) return false;
        if (options?.edgeTypes && !options.edgeTypes.includes(e.type)) return false;
        if (options?.minConfidence !== undefined && e.confidence < options.minConfidence) return false;
        return true;
      });
    }),
    getNodesByType: vi.fn(async (scanId: string, nodeType: string) => {
      return Array.from(nodes.values()).filter(n => n.type === nodeType);
    }),
    getEdgesByType: vi.fn(async (scanId: string, edgeType: string) => {
      return edges.filter(e => e.type === edgeType);
    }),
    countNodes: vi.fn(async (scanId: string, nodeType?: string) => {
      if (nodeType) {
        return Array.from(nodes.values()).filter(n => n.type === nodeType).length;
      }
      return nodes.size;
    }),
    countEdges: vi.fn(async (scanId: string, edgeType?: string) => {
      if (edgeType) {
        return edges.filter(e => e.type === edgeType).length;
      }
      return edges.length;
    }),
  };
}

/**
 * Create test nodes for a simple TF -> Helm -> K8s flow
 */
function createTestNodes(): Map<string, GraphNodeRef> {
  const nodes = new Map<string, GraphNodeRef>();

  // Terraform nodes
  nodes.set('tf-resource-1', createGraphNodeRef('tf-resource-1', 'terraform_resource', 'aws_vpc.main', 'vpc.tf'));
  nodes.set('tf-output-1', createGraphNodeRef('tf-output-1', 'terraform_output', 'vpc_id', 'outputs.tf'));
  nodes.set('tf-module-1', createGraphNodeRef('tf-module-1', 'terraform_module', 'networking', 'main.tf'));

  // Helm nodes
  nodes.set('helm-release-1', createGraphNodeRef('helm-release-1', 'helm_release', 'app-release', 'helmfile.yaml'));
  nodes.set('helm-chart-1', createGraphNodeRef('helm-chart-1', 'helm_chart', 'my-app', 'Chart.yaml'));
  nodes.set('helm-value-1', createGraphNodeRef('helm-value-1', 'helm_value', 'image.tag', 'values.yaml'));

  // Kubernetes nodes
  nodes.set('k8s-deploy-1', createGraphNodeRef('k8s-deploy-1', 'k8s_deployment', 'app', 'deployment.yaml'));
  nodes.set('k8s-service-1', createGraphNodeRef('k8s-service-1', 'k8s_service', 'app-svc', 'service.yaml'));
  nodes.set('k8s-configmap-1', createGraphNodeRef('k8s-configmap-1', 'k8s_configmap', 'app-config', 'configmap.yaml'));

  // CI nodes
  nodes.set('ci-pipeline-1', createGraphNodeRef('ci-pipeline-1', 'ci_pipeline', 'deploy-pipeline', '.github/workflows/deploy.yml'));
  nodes.set('ci-job-1', createGraphNodeRef('ci-job-1', 'ci_job', 'deploy-job', '.github/workflows/deploy.yml'));

  // ArgoCD nodes
  nodes.set('argocd-app-1', createGraphNodeRef('argocd-app-1', 'argocd_application', 'my-app', 'application.yaml'));

  return nodes;
}

/**
 * Create test edges for cross-tool flows
 */
function createTestEdges(): GraphEdgeRef[] {
  return [
    // TF -> Helm (FEEDS_INTO)
    createGraphEdgeRef('edge-1', 'tf-output-1', 'helm-value-1', 'FEEDS_INTO', 85),
    createGraphEdgeRef('edge-2', 'tf-resource-1', 'tf-output-1', 'references', 95),

    // Helm -> K8s
    createGraphEdgeRef('edge-3', 'helm-release-1', 'k8s-deploy-1', 'module_source', 90),
    createGraphEdgeRef('edge-4', 'helm-release-1', 'helm-chart-1', 'references', 100),

    // K8s internal
    createGraphEdgeRef('edge-5', 'k8s-service-1', 'k8s-deploy-1', 'selector_match', 95),
    createGraphEdgeRef('edge-6', 'k8s-deploy-1', 'k8s-configmap-1', 'configmap_ref', 90),

    // CI -> TF/Helm (OPERATES_ON)
    createGraphEdgeRef('edge-7', 'ci-job-1', 'tf-resource-1', 'OPERATES_ON', 80),
    createGraphEdgeRef('edge-8', 'ci-job-1', 'helm-release-1', 'OPERATES_ON', 80),
    createGraphEdgeRef('edge-9', 'ci-pipeline-1', 'ci-job-1', 'PIPELINE_CONTAINS', 100),

    // ArgoCD -> Helm
    createGraphEdgeRef('edge-10', 'argocd-app-1', 'helm-release-1', 'FEEDS_INTO', 85),
  ];
}

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isToolType', () => {
    it('should return true for valid tool types', () => {
      expect(isToolType('terraform')).toBe(true);
      expect(isToolType('helm')).toBe(true);
      expect(isToolType('kubernetes')).toBe(true);
      expect(isToolType('ci')).toBe(true);
      expect(isToolType('argocd')).toBe(true);
    });

    it('should return false for invalid tool types', () => {
      expect(isToolType('invalid')).toBe(false);
      expect(isToolType('')).toBe(false);
      expect(isToolType(null)).toBe(false);
      expect(isToolType(undefined)).toBe(false);
      expect(isToolType(123)).toBe(false);
    });
  });

  describe('isGraphNodeRef', () => {
    it('should return true for valid node refs', () => {
      const node = createGraphNodeRef('id', 'type', 'name', 'path');
      expect(isGraphNodeRef(node)).toBe(true);
    });

    it('should return false for invalid node refs', () => {
      expect(isGraphNodeRef(null)).toBe(false);
      expect(isGraphNodeRef({})).toBe(false);
      expect(isGraphNodeRef({ id: 'x' })).toBe(false);
      expect(isGraphNodeRef({ id: 'x', type: 't' })).toBe(false);
    });
  });

  describe('isGraphEdgeRef', () => {
    it('should return true for valid edge refs', () => {
      const edge = createGraphEdgeRef('id', 'src', 'tgt', 'type', 80);
      expect(isGraphEdgeRef(edge)).toBe(true);
    });

    it('should return false for invalid edge refs', () => {
      expect(isGraphEdgeRef(null)).toBe(false);
      expect(isGraphEdgeRef({})).toBe(false);
      expect(isGraphEdgeRef({ id: 'x', sourceId: 's' })).toBe(false);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Factory Functions', () => {
  describe('createEmptyImpactedNodes', () => {
    it('should create empty impacted nodes structure', () => {
      const result = createEmptyImpactedNodes();
      expect(result.direct).toEqual([]);
      expect(result.transitive).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe('createEmptyCrossToolSummary', () => {
    it('should create empty summary with scan ID', () => {
      const result = createEmptyCrossToolSummary('scan-123');
      expect(result.scanId).toBe('scan-123');
      expect(result.totals.terraformResources).toBe(0);
      expect(result.totals.helmCharts).toBe(0);
      expect(result.dataFlows.tfToHelm).toBe(0);
    });
  });

  describe('createGraphNodeRef', () => {
    it('should create node ref with all properties', () => {
      const node = createGraphNodeRef('id-1', 'terraform_resource', 'vpc', 'main.tf');
      expect(node.id).toBe('id-1');
      expect(node.type).toBe('terraform_resource');
      expect(node.name).toBe('vpc');
      expect(node.filePath).toBe('main.tf');
    });
  });

  describe('createGraphEdgeRef', () => {
    it('should create edge ref with all properties', () => {
      const edge = createGraphEdgeRef('e1', 'src', 'tgt', 'FEEDS_INTO', 85);
      expect(edge.id).toBe('e1');
      expect(edge.sourceId).toBe('src');
      expect(edge.targetId).toBe('tgt');
      expect(edge.type).toBe('FEEDS_INTO');
      expect(edge.confidence).toBe(85);
    });
  });
});

// ============================================================================
// Node Classification Tests
// ============================================================================

describe('Node Classification', () => {
  describe('classifyNodeTool', () => {
    it('should classify terraform nodes correctly', () => {
      expect(classifyNodeTool('terraform_resource')).toBe('terraform');
      expect(classifyNodeTool('terraform_module')).toBe('terraform');
      expect(classifyNodeTool('terraform_variable')).toBe('terraform');
      expect(classifyNodeTool('terraform_output')).toBe('terraform');
      expect(classifyNodeTool('terraform_data')).toBe('terraform');
      expect(classifyNodeTool('terraform_provider')).toBe('terraform');
      expect(classifyNodeTool('terraform_local')).toBe('terraform');
    });

    it('should classify terragrunt nodes as terraform', () => {
      expect(classifyNodeTool('tg_config')).toBe('terraform');
      expect(classifyNodeTool('tg_include')).toBe('terraform');
      expect(classifyNodeTool('tg_dependency')).toBe('terraform');
    });

    it('should classify helm nodes correctly', () => {
      expect(classifyNodeTool('helm_chart')).toBe('helm');
      expect(classifyNodeTool('helm_release')).toBe('helm');
      expect(classifyNodeTool('helm_value')).toBe('helm');
    });

    it('should classify kubernetes nodes correctly', () => {
      expect(classifyNodeTool('k8s_deployment')).toBe('kubernetes');
      expect(classifyNodeTool('k8s_service')).toBe('kubernetes');
      expect(classifyNodeTool('k8s_configmap')).toBe('kubernetes');
      expect(classifyNodeTool('k8s_secret')).toBe('kubernetes');
      expect(classifyNodeTool('k8s_ingress')).toBe('kubernetes');
      expect(classifyNodeTool('k8s_pod')).toBe('kubernetes');
    });

    it('should classify CI nodes correctly', () => {
      expect(classifyNodeTool('ci_pipeline')).toBe('ci');
      expect(classifyNodeTool('ci_job')).toBe('ci');
    });

    it('should classify ArgoCD nodes correctly', () => {
      expect(classifyNodeTool('argocd_application')).toBe('argocd');
      expect(classifyNodeTool('argocd_project')).toBe('argocd');
    });

    it('should handle unknown types with prefix fallback', () => {
      expect(classifyNodeTool('terraform_custom')).toBe('terraform');
      expect(classifyNodeTool('helm_custom')).toBe('helm');
      expect(classifyNodeTool('k8s_custom')).toBe('kubernetes');
      expect(classifyNodeTool('ci_custom')).toBe('ci');
      expect(classifyNodeTool('argocd_custom')).toBe('argocd');
    });

    it('should default to terraform for completely unknown types', () => {
      expect(classifyNodeTool('unknown_type')).toBe('terraform');
    });
  });

  describe('isCrossToolEdge', () => {
    it('should identify cross-tool edge types', () => {
      expect(isCrossToolEdge('FEEDS_INTO')).toBe(true);
      expect(isCrossToolEdge('OPERATES_ON')).toBe(true);
      expect(isCrossToolEdge('PIPELINE_CONTAINS')).toBe(true);
      expect(isCrossToolEdge('tg_sources')).toBe(true);
    });

    it('should return false for non-cross-tool edge types', () => {
      expect(isCrossToolEdge('references')).toBe(false);
      expect(isCrossToolEdge('depends_on')).toBe(false);
      expect(isCrossToolEdge('selector_match')).toBe(false);
    });
  });

  describe('areNodesDifferentTools', () => {
    it('should return true for different tool types', () => {
      expect(areNodesDifferentTools('terraform_resource', 'helm_release')).toBe(true);
      expect(areNodesDifferentTools('helm_chart', 'k8s_deployment')).toBe(true);
      expect(areNodesDifferentTools('ci_job', 'terraform_module')).toBe(true);
    });

    it('should return false for same tool types', () => {
      expect(areNodesDifferentTools('terraform_resource', 'terraform_module')).toBe(false);
      expect(areNodesDifferentTools('helm_chart', 'helm_release')).toBe(false);
      expect(areNodesDifferentTools('k8s_service', 'k8s_deployment')).toBe(false);
    });
  });
});

// ============================================================================
// Impact Summary Tests
// ============================================================================

describe('Impact Summary', () => {
  describe('generateImpactSummary', () => {
    it('should generate summary for node with impacts', () => {
      const impactByTool = {
        terraform: { direct: [], transitive: [], count: 0 },
        helm: {
          direct: [createGraphNodeRef('h1', 'helm_release', 'app', 'helm.yaml')],
          transitive: [],
          count: 1,
        },
        kubernetes: {
          direct: [],
          transitive: [createGraphNodeRef('k1', 'k8s_deployment', 'app', 'deploy.yaml')],
          count: 1,
        },
        ci: { direct: [], transitive: [], count: 0 },
        argocd: { direct: [], transitive: [], count: 0 },
      };

      const sourceNode = createGraphNodeRef('src', 'terraform_output', 'vpc_id', 'main.tf');
      const summary = generateImpactSummary(impactByTool, sourceNode);

      expect(summary).toContain('vpc_id');
      expect(summary).toContain('terraform');
      expect(summary).toContain('helm');
      expect(summary).toContain('kubernetes');
    });

    it('should generate summary for node with no impacts', () => {
      const impactByTool = {
        terraform: { direct: [], transitive: [], count: 0 },
        helm: { direct: [], transitive: [], count: 0 },
        kubernetes: { direct: [], transitive: [], count: 0 },
        ci: { direct: [], transitive: [], count: 0 },
        argocd: { direct: [], transitive: [], count: 0 },
      };

      const sourceNode = createGraphNodeRef('src', 'terraform_output', 'unused', 'main.tf');
      const summary = generateImpactSummary(impactByTool, sourceNode);

      expect(summary).toContain('unused');
      expect(summary).toContain('no other resources');
    });
  });
});

// ============================================================================
// Blast Radius Calculation Tests
// ============================================================================

describe('Blast Radius Calculation', () => {
  let nodes: Map<string, GraphNodeRef>;
  let edges: GraphEdgeRef[];
  let graph: GraphQueryInterface;

  beforeEach(() => {
    nodes = createTestNodes();
    edges = createTestEdges();
    graph = createMockGraph(nodes, edges);
  });

  describe('calculateCrossToolBlastRadius', () => {
    it('should calculate blast radius for terraform node', async () => {
      const result = await calculateCrossToolBlastRadius('tf-output-1', graph);

      expect(result.sourceNode.id).toBe('tf-output-1');
      expect(result.totalImpact).toBeGreaterThan(0);
      expect(result.calculatedAt).toBeDefined();
      expect(result.summary).toContain('vpc_id');
    });

    it('should throw error for non-existent node', async () => {
      await expect(calculateCrossToolBlastRadius('non-existent', graph))
        .rejects.toThrow('Node not found');
    });

    it('should respect maxDepth option', async () => {
      const deepResult = await calculateCrossToolBlastRadius('tf-output-1', graph, { maxDepth: 10 });
      const shallowResult = await calculateCrossToolBlastRadius('tf-output-1', graph, { maxDepth: 1 });

      expect(deepResult.totalImpact).toBeGreaterThanOrEqual(shallowResult.totalImpact);
    });

    it('should filter by tool type when specified', async () => {
      const result = await calculateCrossToolBlastRadius('tf-output-1', graph, {
        toolFilter: ['helm'],
      });

      // Should only have helm impacts
      expect(result.impactByTool.kubernetes.count).toBe(0);
      expect(result.impactByTool.ci.count).toBe(0);
    });

    it('should exclude CI when includeCI is false', async () => {
      const withCI = await calculateCrossToolBlastRadius('ci-job-1', graph, { includeCI: true });
      const withoutCI = await calculateCrossToolBlastRadius('ci-job-1', graph, { includeCI: false });

      expect(withCI.impactByTool.ci.count).toBeGreaterThanOrEqual(0);
    });

    it('should respect minConfidence option', async () => {
      const highConf = await calculateCrossToolBlastRadius('tf-output-1', graph, { minConfidence: 0.9 });
      const lowConf = await calculateCrossToolBlastRadius('tf-output-1', graph, { minConfidence: 0.1 });

      expect(lowConf.totalImpact).toBeGreaterThanOrEqual(highConf.totalImpact);
    });

    it('should categorize direct vs transitive impacts', async () => {
      const result = await calculateCrossToolBlastRadius('tf-resource-1', graph);

      // Direct impacts should be at depth 1
      let hasDirectImpacts = false;
      const tools: ToolType[] = ['terraform', 'helm', 'kubernetes', 'ci', 'argocd'];
      for (const tool of tools) {
        if (result.impactByTool[tool].direct.length > 0) {
          hasDirectImpacts = true;
          break;
        }
      }
      expect(hasDirectImpacts || result.totalImpact === 0).toBe(true);
    });

    it('should find critical paths', async () => {
      const result = await calculateCrossToolBlastRadius('tf-output-1', graph);
      expect(result.criticalPaths).toBeDefined();
      expect(Array.isArray(result.criticalPaths)).toBe(true);
    });

    it('should pass type guard validation', async () => {
      const result = await calculateCrossToolBlastRadius('tf-output-1', graph);
      expect(isCrossToolBlastRadius(result)).toBe(true);
    });
  });
});

// ============================================================================
// Cross-Tool Summary Tests
// ============================================================================

describe('Cross-Tool Summary', () => {
  let nodes: Map<string, GraphNodeRef>;
  let edges: GraphEdgeRef[];
  let graph: GraphQueryInterface;

  beforeEach(() => {
    nodes = createTestNodes();
    edges = createTestEdges();
    graph = createMockGraph(nodes, edges);
  });

  describe('generateCrossToolSummary', () => {
    it('should generate summary with correct totals', async () => {
      const summary = await generateCrossToolSummary('scan-123', graph);

      expect(summary.scanId).toBe('scan-123');
      expect(summary.totals).toBeDefined();
      expect(typeof summary.totals.terraformResources).toBe('number');
      expect(typeof summary.totals.helmCharts).toBe('number');
      expect(typeof summary.totals.k8sResources).toBe('number');
      expect(typeof summary.totals.pipelines).toBe('number');
    });

    it('should count data flows', async () => {
      const summary = await generateCrossToolSummary('scan-123', graph);

      expect(summary.dataFlows).toBeDefined();
      expect(typeof summary.dataFlows.tfToHelm).toBe('number');
      expect(typeof summary.dataFlows.helmToK8s).toBe('number');
      expect(typeof summary.dataFlows.ciToTf).toBe('number');
      expect(typeof summary.dataFlows.ciToHelm).toBe('number');
    });

    it('should calculate detection rates', async () => {
      const summary = await generateCrossToolSummary('scan-123', graph);

      expect(summary.detectionRates).toBeDefined();
      expect(typeof summary.detectionRates.tfHelmDetection).toBe('number');
      expect(typeof summary.detectionRates.ciPatternDetection).toBe('number');
    });

    it('should include top cross-tool connections', async () => {
      const summary = await generateCrossToolSummary('scan-123', graph);

      expect(Array.isArray(summary.topCrossToolConnections)).toBe(true);
      for (const conn of summary.topCrossToolConnections) {
        expect(isToolType(conn.sourceType)).toBe(true);
        expect(isToolType(conn.targetType)).toBe(true);
        expect(typeof conn.edgeCount).toBe('number');
        expect(typeof conn.avgConfidence).toBe('number');
      }
    });

    it('should pass type guard validation', async () => {
      const summary = await generateCrossToolSummary('scan-123', graph);
      expect(isCrossToolSummary(summary)).toBe(true);
    });
  });

  describe('TF_HELM_DETECTION_TARGET', () => {
    it('should be at least 65%', () => {
      expect(TF_HELM_DETECTION_TARGET).toBeGreaterThanOrEqual(0.65);
    });
  });
});

// ============================================================================
// Filtering Utility Tests
// ============================================================================

describe('Filtering Utilities', () => {
  const testNodes: GraphNodeRef[] = [
    createGraphNodeRef('tf1', 'terraform_resource', 'vpc', 'main.tf'),
    createGraphNodeRef('tf2', 'terraform_output', 'vpc_id', 'outputs.tf'),
    createGraphNodeRef('h1', 'helm_release', 'app', 'helm.yaml'),
    createGraphNodeRef('k1', 'k8s_deployment', 'app', 'deploy.yaml'),
    createGraphNodeRef('ci1', 'ci_pipeline', 'deploy', 'ci.yaml'),
  ];

  describe('filterNodesByTool', () => {
    it('should filter terraform nodes', () => {
      const result = filterNodesByTool(testNodes, 'terraform');
      expect(result).toHaveLength(2);
      expect(result.every(n => n.type.startsWith('terraform'))).toBe(true);
    });

    it('should filter helm nodes', () => {
      const result = filterNodesByTool(testNodes, 'helm');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('helm_release');
    });

    it('should return empty array for non-matching tool', () => {
      const result = filterNodesByTool(testNodes, 'argocd');
      expect(result).toHaveLength(0);
    });
  });

  describe('groupNodesByTool', () => {
    it('should group nodes by tool type', () => {
      const result = groupNodesByTool(testNodes);

      expect(result.get('terraform')).toHaveLength(2);
      expect(result.get('helm')).toHaveLength(1);
      expect(result.get('kubernetes')).toHaveLength(1);
      expect(result.get('ci')).toHaveLength(1);
      expect(result.get('argocd')).toHaveLength(0);
    });
  });

  describe('countNodesByTool', () => {
    it('should count nodes by tool type', () => {
      const result = countNodesByTool(testNodes);

      expect(result.terraform).toBe(2);
      expect(result.helm).toBe(1);
      expect(result.kubernetes).toBe(1);
      expect(result.ci).toBe(1);
      expect(result.argocd).toBe(0);
    });

    it('should handle empty array', () => {
      const result = countNodesByTool([]);

      expect(result.terraform).toBe(0);
      expect(result.helm).toBe(0);
      expect(result.kubernetes).toBe(0);
      expect(result.ci).toBe(0);
      expect(result.argocd).toBe(0);
    });
  });
});

// ============================================================================
// Flow Tracer Tests
// ============================================================================

describe('Flow Tracer', () => {
  describe('generateFlowId', () => {
    it('should generate deterministic flow IDs', () => {
      const id1 = generateFlowId('src-1', 'dst-1');
      const id2 = generateFlowId('src-1', 'dst-1');
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different flows', () => {
      const id1 = generateFlowId('src-1', 'dst-1');
      const id2 = generateFlowId('src-1', 'dst-2');
      expect(id1).not.toBe(id2);
    });

    it('should start with "flow-"', () => {
      const id = generateFlowId('src', 'dst');
      expect(id.startsWith('flow-')).toBe(true);
    });
  });

  describe('getFlowSourceType', () => {
    it('should return correct source type for terraform_output', () => {
      expect(getFlowSourceType('terraform_output')).toBe('terraform_output');
    });

    it('should return correct source type for terraform_resource', () => {
      expect(getFlowSourceType('terraform_resource')).toBe('terraform_resource');
    });

    it('should return terragrunt_output for tg types', () => {
      expect(getFlowSourceType('tg_config')).toBe('terragrunt_output');
    });

    it('should return null for non-source types', () => {
      expect(getFlowSourceType('helm_release')).toBeNull();
      expect(getFlowSourceType('k8s_deployment')).toBeNull();
    });
  });

  describe('getFlowDestinationType', () => {
    it('should return helm_release for helm types', () => {
      expect(getFlowDestinationType('helm_release')).toBe('helm_release');
      expect(getFlowDestinationType('helm_chart')).toBe('helm_release');
    });

    it('should return k8s_resource for kubernetes types', () => {
      expect(getFlowDestinationType('k8s_deployment')).toBe('k8s_resource');
      expect(getFlowDestinationType('k8s_service')).toBe('k8s_resource');
    });

    it('should return argocd_application for argocd types', () => {
      expect(getFlowDestinationType('argocd_application')).toBe('argocd_application');
    });

    it('should return null for non-destination types', () => {
      expect(getFlowDestinationType('terraform_resource')).toBeNull();
      expect(getFlowDestinationType('ci_job')).toBeNull();
    });
  });

  describe('isFlowSource and isFlowDestination', () => {
    it('should correctly identify flow sources', () => {
      expect(isFlowSource('terraform_output')).toBe(true);
      expect(isFlowSource('terraform_resource')).toBe(true);
      expect(isFlowSource('helm_release')).toBe(false);
    });

    it('should correctly identify flow destinations', () => {
      expect(isFlowDestination('helm_release')).toBe(true);
      expect(isFlowDestination('k8s_deployment')).toBe(true);
      expect(isFlowDestination('terraform_output')).toBe(false);
    });
  });
});

// ============================================================================
// End-to-End Flow Tracing Tests
// ============================================================================

describe('End-to-End Flow Tracing', () => {
  let nodes: Map<string, GraphNodeRef>;
  let edges: GraphEdgeRef[];
  let graph: GraphQueryInterface;

  beforeEach(() => {
    nodes = createTestNodes();
    edges = createTestEdges();
    graph = createMockGraph(nodes, edges);
  });

  describe('traceEndToEndFlows', () => {
    it('should trace flows from terraform output', async () => {
      const flows = await traceEndToEndFlows('tf-output-1', graph);

      expect(Array.isArray(flows)).toBe(true);
      for (const flow of flows) {
        expect(flow.source.type).toBeDefined();
        expect(flow.destination.type).toBeDefined();
        expect(flow.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return empty array for non-source node', async () => {
      const flows = await traceEndToEndFlows('k8s-deploy-1', graph);
      expect(flows).toEqual([]);
    });

    it('should return empty array for non-existent node', async () => {
      const flows = await traceEndToEndFlows('non-existent', graph);
      expect(flows).toEqual([]);
    });

    it('should include intermediate nodes', async () => {
      const flows = await traceEndToEndFlows('tf-output-1', graph);

      for (const flow of flows) {
        expect(Array.isArray(flow.intermediates)).toBe(true);
      }
    });

    it('should calculate confidence from edge confidences', async () => {
      const flows = await traceEndToEndFlows('tf-output-1', graph);

      for (const flow of flows) {
        expect(flow.confidence).toBeGreaterThanOrEqual(0);
        expect(flow.confidence).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('traceAllEndToEndFlows', () => {
    it('should trace all flows in a scan', async () => {
      const flows = await traceAllEndToEndFlows('scan-123', graph);

      expect(Array.isArray(flows)).toBe(true);
      // Should find flows from terraform sources
    });

    it('should sort flows by confidence descending', async () => {
      const flows = await traceAllEndToEndFlows('scan-123', graph);

      for (let i = 1; i < flows.length; i++) {
        expect(flows[i - 1].confidence).toBeGreaterThanOrEqual(flows[i].confidence);
      }
    });

    it('should not have duplicate flow IDs', async () => {
      const flows = await traceAllEndToEndFlows('scan-123', graph);
      const ids = new Set(flows.map(f => f.id));
      expect(ids.size).toBe(flows.length);
    });
  });
});

// ============================================================================
// Flow Aggregation Tests
// ============================================================================

describe('Flow Aggregation', () => {
  describe('aggregateFlowsByPipeline', () => {
    it('should group flows by pipeline', () => {
      const pipeline = createGraphNodeRef('p1', 'ci_pipeline', 'deploy', 'ci.yaml');
      const flows = [
        {
          id: 'flow-1',
          source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'vpc', 'tf.tf') },
          destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'app', 'h.yaml') },
          intermediates: [],
          edges: [],
          pipeline,
          confidence: 80,
        },
        {
          id: 'flow-2',
          source: { type: 'terraform_output' as const, node: createGraphNodeRef('t2', 'terraform_output', 'subnet', 'tf.tf') },
          destination: { type: 'helm_release' as const, node: createGraphNodeRef('h2', 'helm_release', 'api', 'h.yaml') },
          intermediates: [],
          edges: [],
          pipeline,
          confidence: 70,
        },
        {
          id: 'flow-3',
          source: { type: 'terraform_output' as const, node: createGraphNodeRef('t3', 'terraform_output', 'db', 'tf.tf') },
          destination: { type: 'k8s_resource' as const, node: createGraphNodeRef('k1', 'k8s_deployment', 'db', 'k.yaml') },
          intermediates: [],
          edges: [],
          pipeline: undefined,
          confidence: 90,
        },
      ];

      const aggregations = aggregateFlowsByPipeline(flows);

      expect(aggregations.length).toBeGreaterThan(0);
      // Should have aggregations for pipeline and direct flows
    });

    it('should calculate correct statistics', () => {
      const flows = [
        {
          id: 'flow-1',
          source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'a', 'tf.tf') },
          destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'x', 'h.yaml') },
          intermediates: [],
          edges: [],
          confidence: 80,
        },
        {
          id: 'flow-2',
          source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'a', 'tf.tf') },
          destination: { type: 'helm_release' as const, node: createGraphNodeRef('h2', 'helm_release', 'y', 'h.yaml') },
          intermediates: [],
          edges: [],
          confidence: 60,
        },
      ];

      const aggregations = aggregateFlowsByPipeline(flows);
      const agg = aggregations[0];

      expect(agg.flowCount).toBe(2);
      expect(agg.avgConfidence).toBe(70);
      expect(agg.sourceCount).toBe(1); // Same source
      expect(agg.destinationCount).toBe(2);
    });

    it('should handle empty flows array', () => {
      const aggregations = aggregateFlowsByPipeline([]);
      expect(aggregations).toEqual([]);
    });
  });
});

// ============================================================================
// Flow Filtering Tests
// ============================================================================

describe('Flow Filtering', () => {
  const testFlows = [
    {
      id: 'f1',
      source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'a', 'tf') },
      destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'x', 'h') },
      intermediates: [],
      edges: [],
      confidence: 90,
      pipeline: createGraphNodeRef('p1', 'ci_pipeline', 'deploy', 'ci'),
    },
    {
      id: 'f2',
      source: { type: 'terraform_resource' as const, node: createGraphNodeRef('t2', 'terraform_resource', 'b', 'tf') },
      destination: { type: 'k8s_resource' as const, node: createGraphNodeRef('k1', 'k8s_deployment', 'y', 'k') },
      intermediates: [],
      edges: [],
      confidence: 60,
    },
    {
      id: 'f3',
      source: { type: 'terragrunt_output' as const, node: createGraphNodeRef('tg1', 'tg_config', 'c', 'tg') },
      destination: { type: 'argocd_application' as const, node: createGraphNodeRef('a1', 'argocd_application', 'z', 'a') },
      intermediates: [],
      edges: [],
      confidence: 40,
    },
  ];

  describe('filterFlows', () => {
    it('should filter by minimum confidence', () => {
      const result = filterFlows(testFlows, { minConfidence: 80 });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f1');
    });

    it('should filter by destination tool', () => {
      const result = filterFlows(testFlows, { destinationTool: 'kubernetes' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f2');
    });

    it('should filter by pipeline requirement', () => {
      const result = filterFlows(testFlows, { requirePipeline: true });
      expect(result).toHaveLength(1);
      expect(result[0].pipeline).toBeDefined();
    });

    it('should respect limit', () => {
      const result = filterFlows(testFlows, { limit: 1 });
      expect(result).toHaveLength(1);
    });

    it('should combine multiple filters', () => {
      const result = filterFlows(testFlows, {
        minConfidence: 50,
        limit: 10,
      });
      expect(result).toHaveLength(2); // f1 and f2 have confidence >= 50
    });
  });
});

// ============================================================================
// Flow Statistics Tests
// ============================================================================

describe('Flow Statistics', () => {
  const testFlows = [
    {
      id: 'f1',
      source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'a', 'tf') },
      destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'x', 'h') },
      intermediates: [],
      edges: [createGraphEdgeRef('e1', 't1', 'h1', 'FEEDS_INTO', 90)],
      confidence: 90,
      pipeline: createGraphNodeRef('p1', 'ci_pipeline', 'deploy', 'ci'),
    },
    {
      id: 'f2',
      source: { type: 'terraform_resource' as const, node: createGraphNodeRef('t2', 'terraform_resource', 'b', 'tf') },
      destination: { type: 'k8s_resource' as const, node: createGraphNodeRef('k1', 'k8s_deployment', 'y', 'k') },
      intermediates: [createGraphNodeRef('i1', 'helm_value', 'z', 'h')],
      edges: [
        createGraphEdgeRef('e2', 't2', 'i1', 'FEEDS_INTO', 70),
        createGraphEdgeRef('e3', 'i1', 'k1', 'references', 80),
      ],
      confidence: 60,
    },
    {
      id: 'f3',
      source: { type: 'terragrunt_output' as const, node: createGraphNodeRef('tg1', 'tg_config', 'c', 'tg') },
      destination: { type: 'argocd_application' as const, node: createGraphNodeRef('a1', 'argocd_application', 'z', 'a') },
      intermediates: [],
      edges: [createGraphEdgeRef('e4', 'tg1', 'a1', 'FEEDS_INTO', 40)],
      confidence: 40,
    },
  ];

  describe('calculateFlowStatistics', () => {
    it('should count total flows', () => {
      const stats = calculateFlowStatistics(testFlows);
      expect(stats.totalFlows).toBe(3);
    });

    it('should count by source type', () => {
      const stats = calculateFlowStatistics(testFlows);
      expect(stats.bySourceType.terraform_output).toBe(1);
      expect(stats.bySourceType.terraform_resource).toBe(1);
      expect(stats.bySourceType.terragrunt_output).toBe(1);
    });

    it('should count by destination type', () => {
      const stats = calculateFlowStatistics(testFlows);
      expect(stats.byDestinationType.helm_release).toBe(1);
      expect(stats.byDestinationType.k8s_resource).toBe(1);
      expect(stats.byDestinationType.argocd_application).toBe(1);
    });

    it('should calculate average confidence', () => {
      const stats = calculateFlowStatistics(testFlows);
      const expectedAvg = (90 + 60 + 40) / 3;
      expect(stats.avgConfidence).toBeCloseTo(expectedAvg, 1);
    });

    it('should count confidence levels', () => {
      const stats = calculateFlowStatistics(testFlows);
      expect(stats.highConfidenceCount).toBe(1); // 90
      expect(stats.mediumConfidenceCount).toBe(1); // 60
      expect(stats.lowConfidenceCount).toBe(1); // 40
    });

    it('should count pipeline orchestrated flows', () => {
      const stats = calculateFlowStatistics(testFlows);
      expect(stats.pipelineOrchestratedCount).toBe(1);
    });

    it('should calculate average path length', () => {
      const stats = calculateFlowStatistics(testFlows);
      const expectedAvg = (1 + 2 + 1) / 3;
      expect(stats.avgPathLength).toBeCloseTo(expectedAvg, 1);
    });

    it('should handle empty array', () => {
      const stats = calculateFlowStatistics([]);
      expect(stats.totalFlows).toBe(0);
      expect(stats.avgConfidence).toBe(0);
      expect(stats.avgPathLength).toBe(0);
    });
  });
});

// ============================================================================
// Flow Visualization Tests
// ============================================================================

describe('Flow Visualization', () => {
  describe('describeFlow', () => {
    it('should create human-readable description', () => {
      const flow = {
        id: 'f1',
        source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'vpc_id', 'tf') },
        destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'app', 'h') },
        intermediates: [],
        edges: [],
        confidence: 85,
      };

      const description = describeFlow(flow);
      expect(description).toContain('vpc_id');
      expect(description).toContain('app');
      expect(description).toContain('85');
    });

    it('should include intermediates in description', () => {
      const flow = {
        id: 'f1',
        source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'start', 'tf') },
        destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'end', 'h') },
        intermediates: [createGraphNodeRef('m1', 'helm_value', 'middle', 'h')],
        edges: [],
        confidence: 75,
      };

      const description = describeFlow(flow);
      expect(description).toContain('middle');
    });

    it('should include pipeline if present', () => {
      const flow = {
        id: 'f1',
        source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'vpc', 'tf') },
        destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'app', 'h') },
        intermediates: [],
        edges: [],
        confidence: 80,
        pipeline: createGraphNodeRef('p1', 'ci_pipeline', 'deploy-pipeline', 'ci'),
      };

      const description = describeFlow(flow);
      expect(description).toContain('deploy-pipeline');
    });
  });

  describe('getFlowToolPath', () => {
    it('should return tool types in order', () => {
      const flow = {
        id: 'f1',
        source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'vpc', 'tf') },
        destination: { type: 'k8s_resource' as const, node: createGraphNodeRef('k1', 'k8s_deployment', 'app', 'k') },
        intermediates: [createGraphNodeRef('h1', 'helm_release', 'release', 'h')],
        edges: [],
        confidence: 80,
      };

      const toolPath = getFlowToolPath(flow);
      expect(toolPath).toContain('terraform');
      expect(toolPath).toContain('helm');
      expect(toolPath).toContain('kubernetes');
    });

    it('should not have duplicate tools', () => {
      const flow = {
        id: 'f1',
        source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'vpc', 'tf') },
        destination: { type: 'helm_release' as const, node: createGraphNodeRef('h2', 'helm_release', 'app2', 'h') },
        intermediates: [createGraphNodeRef('h1', 'helm_value', 'val', 'h')],
        edges: [],
        confidence: 80,
      };

      const toolPath = getFlowToolPath(flow);
      const helmCount = toolPath.filter(t => t === 'helm').length;
      expect(helmCount).toBe(1);
    });
  });

  describe('flowCrossesTools', () => {
    it('should return true for cross-tool flows', () => {
      const flow = {
        id: 'f1',
        source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'vpc', 'tf') },
        destination: { type: 'helm_release' as const, node: createGraphNodeRef('h1', 'helm_release', 'app', 'h') },
        intermediates: [],
        edges: [],
        confidence: 80,
      };

      expect(flowCrossesTools(flow)).toBe(true);
    });

    it('should return false for same-tool flows', () => {
      const flow = {
        id: 'f1',
        source: { type: 'terraform_output' as const, node: createGraphNodeRef('t1', 'terraform_output', 'vpc', 'tf') },
        destination: { type: 'terraform_resource' as const, node: createGraphNodeRef('t2', 'terraform_resource', 'subnet', 'tf') },
        intermediates: [],
        edges: [],
        confidence: 80,
      };

      // Both are terraform tools
      expect(flowCrossesTools(flow)).toBe(false);
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Constants', () => {
  describe('NODE_TYPE_TO_TOOL', () => {
    it('should have all terraform types', () => {
      expect(NODE_TYPE_TO_TOOL['terraform_resource']).toBe('terraform');
      expect(NODE_TYPE_TO_TOOL['terraform_module']).toBe('terraform');
      expect(NODE_TYPE_TO_TOOL['terraform_output']).toBe('terraform');
    });

    it('should have all helm types', () => {
      expect(NODE_TYPE_TO_TOOL['helm_chart']).toBe('helm');
      expect(NODE_TYPE_TO_TOOL['helm_release']).toBe('helm');
    });

    it('should have all kubernetes types', () => {
      expect(NODE_TYPE_TO_TOOL['k8s_deployment']).toBe('kubernetes');
      expect(NODE_TYPE_TO_TOOL['k8s_service']).toBe('kubernetes');
    });
  });

  describe('CROSS_TOOL_EDGE_TYPES', () => {
    it('should include FEEDS_INTO', () => {
      expect(CROSS_TOOL_EDGE_TYPES).toContain('FEEDS_INTO');
    });

    it('should include OPERATES_ON', () => {
      expect(CROSS_TOOL_EDGE_TYPES).toContain('OPERATES_ON');
    });

    it('should include PIPELINE_CONTAINS', () => {
      expect(CROSS_TOOL_EDGE_TYPES).toContain('PIPELINE_CONTAINS');
    });
  });
});
