/**
 * Graph Type Guards Tests
 * @module tests/types/graph-type-guards
 *
 * TASK-TG-032: Unit tests for Terragrunt type guard functions.
 * Tests for isTerragruntIncludeNode, isTerragruntDependencyNode, and isTerragruntNode.
 *
 * Coverage targets: 100% for all type guard functions
 */

import { describe, it, expect } from 'vitest';
import {
  isTerraformNode,
  isK8sNode,
  isHelmNode,
  isTerragruntConfigNode,
  isTerragruntIncludeNode,
  isTerragruntDependencyNode,
  isTerragruntNode,
  type NodeType,
  type TerraformResourceNode,
  type TerraformModuleNode,
  type TerragruntConfigNode,
  type TerragruntIncludeNode,
  type TerragruntDependencyNode,
  type K8sDeploymentNode,
  type HelmChartNode,
  type NodeLocation,
} from '../../src/types/graph';

// ============================================================================
// Test Fixtures
// ============================================================================

const createLocation = (): NodeLocation => ({
  file: 'test.hcl',
  lineStart: 1,
  lineEnd: 10,
});

const createTerraformResourceNode = (): TerraformResourceNode => ({
  type: 'terraform_resource',
  id: 'aws_vpc.main',
  name: 'main',
  location: createLocation(),
  metadata: {},
  resourceType: 'aws_vpc',
  provider: 'aws',
  dependsOn: [],
});

const createTerraformModuleNode = (): TerraformModuleNode => ({
  type: 'terraform_module',
  id: 'module.vpc',
  name: 'vpc',
  location: createLocation(),
  metadata: {},
  source: './modules/vpc',
  sourceType: 'local',
  providers: {},
});

const createK8sDeploymentNode = (): K8sDeploymentNode => ({
  type: 'k8s_deployment',
  id: 'default/api',
  name: 'api',
  location: createLocation(),
  metadata: {},
  namespace: 'default',
  replicas: 3,
  selector: { app: 'api' },
  containers: [{ name: 'api', image: 'api:latest' }],
});

const createHelmChartNode = (): HelmChartNode => ({
  type: 'helm_chart',
  id: 'chart/nginx',
  name: 'nginx',
  location: createLocation(),
  metadata: {},
  chartName: 'nginx',
  chartVersion: '1.0.0',
});

const createTerragruntConfigNode = (): TerragruntConfigNode => ({
  type: 'tg_config',
  id: 'config-123',
  name: 'dev',
  location: createLocation(),
  metadata: {},
  terraformSource: 'git::https://example.com/modules//vpc',
  hasRemoteState: true,
  remoteStateBackend: 's3',
  includeCount: 2,
  dependencyCount: 3,
  inputCount: 5,
  generateBlocks: Object.freeze(['provider', 'backend']),
});

const createTerragruntIncludeNode = (): TerragruntIncludeNode => ({
  type: 'tg_include',
  id: 'include-123',
  name: 'root',
  location: createLocation(),
  metadata: {},
  label: 'root',
  path: 'find_in_parent_folders("root.hcl")',
  resolvedPath: '/repo/root.hcl',
  expose: true,
  mergeStrategy: 'deep',
});

const createTerragruntDependencyNode = (): TerragruntDependencyNode => ({
  type: 'tg_dependency',
  id: 'dep-123',
  name: 'vpc',
  location: createLocation(),
  metadata: {},
  dependencyName: 'vpc',
  configPath: '../vpc',
  resolvedPath: '/repo/vpc/terragrunt.hcl',
  skipOutputs: false,
  hasMockOutputs: true,
});

// ============================================================================
// isTerragruntIncludeNode Tests
// ============================================================================

describe('isTerragruntIncludeNode', () => {
  describe('when given a tg_include node', () => {
    it('should return true for a valid TerragruntIncludeNode', () => {
      const node = createTerragruntIncludeNode();

      expect(isTerragruntIncludeNode(node)).toBe(true);
    });

    it('should return true for include node with minimal properties', () => {
      const node: TerragruntIncludeNode = {
        type: 'tg_include',
        id: 'inc-min',
        name: 'unnamed',
        location: createLocation(),
        metadata: {},
        label: '',
        path: '',
        resolvedPath: null,
        expose: false,
        mergeStrategy: 'no_merge',
      };

      expect(isTerragruntIncludeNode(node)).toBe(true);
    });

    it('should return true for include node with all merge strategies', () => {
      const mergeStrategies: Array<'no_merge' | 'shallow' | 'deep'> = ['no_merge', 'shallow', 'deep'];

      for (const strategy of mergeStrategies) {
        const node: TerragruntIncludeNode = {
          ...createTerragruntIncludeNode(),
          mergeStrategy: strategy,
        };

        expect(isTerragruntIncludeNode(node)).toBe(true);
      }
    });
  });

  describe('when given other node types', () => {
    it('should return false for TerragruntConfigNode', () => {
      const node = createTerragruntConfigNode();

      expect(isTerragruntIncludeNode(node)).toBe(false);
    });

    it('should return false for TerragruntDependencyNode', () => {
      const node = createTerragruntDependencyNode();

      expect(isTerragruntIncludeNode(node)).toBe(false);
    });

    it('should return false for TerraformResourceNode', () => {
      const node = createTerraformResourceNode();

      expect(isTerragruntIncludeNode(node)).toBe(false);
    });

    it('should return false for TerraformModuleNode', () => {
      const node = createTerraformModuleNode();

      expect(isTerragruntIncludeNode(node)).toBe(false);
    });

    it('should return false for K8sDeploymentNode', () => {
      const node = createK8sDeploymentNode();

      expect(isTerragruntIncludeNode(node)).toBe(false);
    });

    it('should return false for HelmChartNode', () => {
      const node = createHelmChartNode();

      expect(isTerragruntIncludeNode(node)).toBe(false);
    });
  });

  describe('type narrowing', () => {
    it('should narrow type correctly in conditional', () => {
      const node: NodeType = createTerragruntIncludeNode();

      if (isTerragruntIncludeNode(node)) {
        // TypeScript should allow access to TerragruntIncludeNode properties
        expect(node.label).toBe('root');
        expect(node.mergeStrategy).toBe('deep');
        expect(node.expose).toBe(true);
        expect(node.resolvedPath).toBe('/repo/root.hcl');
      } else {
        throw new Error('Expected node to be TerragruntIncludeNode');
      }
    });
  });
});

// ============================================================================
// isTerragruntDependencyNode Tests
// ============================================================================

describe('isTerragruntDependencyNode', () => {
  describe('when given a tg_dependency node', () => {
    it('should return true for a valid TerragruntDependencyNode', () => {
      const node = createTerragruntDependencyNode();

      expect(isTerragruntDependencyNode(node)).toBe(true);
    });

    it('should return true for dependency node with minimal properties', () => {
      const node: TerragruntDependencyNode = {
        type: 'tg_dependency',
        id: 'dep-min',
        name: 'unnamed',
        location: createLocation(),
        metadata: {},
        dependencyName: '',
        configPath: '',
        resolvedPath: null,
        skipOutputs: false,
        hasMockOutputs: false,
      };

      expect(isTerragruntDependencyNode(node)).toBe(true);
    });

    it('should return true for dependency node with skipOutputs enabled', () => {
      const node: TerragruntDependencyNode = {
        ...createTerragruntDependencyNode(),
        skipOutputs: true,
      };

      expect(isTerragruntDependencyNode(node)).toBe(true);
    });

    it('should return true for dependency node with null resolvedPath', () => {
      const node: TerragruntDependencyNode = {
        ...createTerragruntDependencyNode(),
        resolvedPath: null,
      };

      expect(isTerragruntDependencyNode(node)).toBe(true);
    });
  });

  describe('when given other node types', () => {
    it('should return false for TerragruntConfigNode', () => {
      const node = createTerragruntConfigNode();

      expect(isTerragruntDependencyNode(node)).toBe(false);
    });

    it('should return false for TerragruntIncludeNode', () => {
      const node = createTerragruntIncludeNode();

      expect(isTerragruntDependencyNode(node)).toBe(false);
    });

    it('should return false for TerraformResourceNode', () => {
      const node = createTerraformResourceNode();

      expect(isTerragruntDependencyNode(node)).toBe(false);
    });

    it('should return false for TerraformModuleNode', () => {
      const node = createTerraformModuleNode();

      expect(isTerragruntDependencyNode(node)).toBe(false);
    });

    it('should return false for K8sDeploymentNode', () => {
      const node = createK8sDeploymentNode();

      expect(isTerragruntDependencyNode(node)).toBe(false);
    });

    it('should return false for HelmChartNode', () => {
      const node = createHelmChartNode();

      expect(isTerragruntDependencyNode(node)).toBe(false);
    });
  });

  describe('type narrowing', () => {
    it('should narrow type correctly in conditional', () => {
      const node: NodeType = createTerragruntDependencyNode();

      if (isTerragruntDependencyNode(node)) {
        // TypeScript should allow access to TerragruntDependencyNode properties
        expect(node.dependencyName).toBe('vpc');
        expect(node.configPath).toBe('../vpc');
        expect(node.skipOutputs).toBe(false);
        expect(node.hasMockOutputs).toBe(true);
      } else {
        throw new Error('Expected node to be TerragruntDependencyNode');
      }
    });
  });
});

// ============================================================================
// isTerragruntNode Tests
// ============================================================================

describe('isTerragruntNode', () => {
  describe('when given Terragrunt node types', () => {
    it('should return true for TerragruntConfigNode', () => {
      const node = createTerragruntConfigNode();

      expect(isTerragruntNode(node)).toBe(true);
    });

    it('should return true for TerragruntIncludeNode', () => {
      const node = createTerragruntIncludeNode();

      expect(isTerragruntNode(node)).toBe(true);
    });

    it('should return true for TerragruntDependencyNode', () => {
      const node = createTerragruntDependencyNode();

      expect(isTerragruntNode(node)).toBe(true);
    });

    it('should return true for all terragrunt node types in array', () => {
      const nodes: NodeType[] = [
        createTerragruntConfigNode(),
        createTerragruntIncludeNode(),
        createTerragruntDependencyNode(),
      ];

      for (const node of nodes) {
        expect(isTerragruntNode(node)).toBe(true);
      }
    });
  });

  describe('when given non-Terragrunt node types', () => {
    it('should return false for TerraformResourceNode', () => {
      const node = createTerraformResourceNode();

      expect(isTerragruntNode(node)).toBe(false);
    });

    it('should return false for TerraformModuleNode', () => {
      const node = createTerraformModuleNode();

      expect(isTerragruntNode(node)).toBe(false);
    });

    it('should return false for K8sDeploymentNode', () => {
      const node = createK8sDeploymentNode();

      expect(isTerragruntNode(node)).toBe(false);
    });

    it('should return false for HelmChartNode', () => {
      const node = createHelmChartNode();

      expect(isTerragruntNode(node)).toBe(false);
    });
  });

  describe('type narrowing', () => {
    it('should narrow to union of all Terragrunt node types', () => {
      const node: NodeType = createTerragruntConfigNode();

      if (isTerragruntNode(node)) {
        // TypeScript should recognize this is a Terragrunt node
        expect(node.type.startsWith('tg_')).toBe(true);
      } else {
        throw new Error('Expected node to be a Terragrunt node');
      }
    });
  });
});

// ============================================================================
// isTerragruntConfigNode Tests
// ============================================================================

describe('isTerragruntConfigNode', () => {
  it('should return true for TerragruntConfigNode', () => {
    const node = createTerragruntConfigNode();

    expect(isTerragruntConfigNode(node)).toBe(true);
  });

  it('should return false for TerragruntIncludeNode', () => {
    const node = createTerragruntIncludeNode();

    expect(isTerragruntConfigNode(node)).toBe(false);
  });

  it('should return false for TerragruntDependencyNode', () => {
    const node = createTerragruntDependencyNode();

    expect(isTerragruntConfigNode(node)).toBe(false);
  });

  it('should return false for TerraformResourceNode', () => {
    const node = createTerraformResourceNode();

    expect(isTerragruntConfigNode(node)).toBe(false);
  });

  describe('type narrowing', () => {
    it('should narrow type correctly in conditional', () => {
      const node: NodeType = createTerragruntConfigNode();

      if (isTerragruntConfigNode(node)) {
        // TypeScript should allow access to TerragruntConfigNode properties
        expect(node.terraformSource).toBe('git::https://example.com/modules//vpc');
        expect(node.hasRemoteState).toBe(true);
        expect(node.remoteStateBackend).toBe('s3');
        expect(node.includeCount).toBe(2);
        expect(node.dependencyCount).toBe(3);
      } else {
        throw new Error('Expected node to be TerragruntConfigNode');
      }
    });
  });
});

// ============================================================================
// Cross-Type Guard Exclusivity Tests
// ============================================================================

describe('Type Guard Exclusivity', () => {
  describe('Terragrunt type guards are mutually exclusive', () => {
    it('TerragruntConfigNode passes only isTerragruntConfigNode', () => {
      const node = createTerragruntConfigNode();

      expect(isTerragruntConfigNode(node)).toBe(true);
      expect(isTerragruntIncludeNode(node)).toBe(false);
      expect(isTerragruntDependencyNode(node)).toBe(false);
      expect(isTerragruntNode(node)).toBe(true); // Union guard includes it
    });

    it('TerragruntIncludeNode passes only isTerragruntIncludeNode', () => {
      const node = createTerragruntIncludeNode();

      expect(isTerragruntConfigNode(node)).toBe(false);
      expect(isTerragruntIncludeNode(node)).toBe(true);
      expect(isTerragruntDependencyNode(node)).toBe(false);
      expect(isTerragruntNode(node)).toBe(true);
    });

    it('TerragruntDependencyNode passes only isTerragruntDependencyNode', () => {
      const node = createTerragruntDependencyNode();

      expect(isTerragruntConfigNode(node)).toBe(false);
      expect(isTerragruntIncludeNode(node)).toBe(false);
      expect(isTerragruntDependencyNode(node)).toBe(true);
      expect(isTerragruntNode(node)).toBe(true);
    });
  });

  describe('Non-Terragrunt nodes fail all Terragrunt guards', () => {
    it('TerraformResourceNode fails all Terragrunt guards', () => {
      const node = createTerraformResourceNode();

      expect(isTerragruntConfigNode(node)).toBe(false);
      expect(isTerragruntIncludeNode(node)).toBe(false);
      expect(isTerragruntDependencyNode(node)).toBe(false);
      expect(isTerragruntNode(node)).toBe(false);
      expect(isTerraformNode(node)).toBe(true); // Should pass Terraform guard
    });

    it('K8sDeploymentNode fails all Terragrunt guards', () => {
      const node = createK8sDeploymentNode();

      expect(isTerragruntConfigNode(node)).toBe(false);
      expect(isTerragruntIncludeNode(node)).toBe(false);
      expect(isTerragruntDependencyNode(node)).toBe(false);
      expect(isTerragruntNode(node)).toBe(false);
      expect(isK8sNode(node)).toBe(true); // Should pass K8s guard
    });

    it('HelmChartNode fails all Terragrunt guards', () => {
      const node = createHelmChartNode();

      expect(isTerragruntConfigNode(node)).toBe(false);
      expect(isTerragruntIncludeNode(node)).toBe(false);
      expect(isTerragruntDependencyNode(node)).toBe(false);
      expect(isTerragruntNode(node)).toBe(false);
      expect(isHelmNode(node)).toBe(true); // Should pass Helm guard
    });
  });
});

// ============================================================================
// Filter Array Tests
// ============================================================================

describe('Type Guards with Array Filtering', () => {
  it('should correctly filter Terragrunt nodes from mixed array', () => {
    const nodes: NodeType[] = [
      createTerraformResourceNode(),
      createTerragruntConfigNode(),
      createK8sDeploymentNode(),
      createTerragruntIncludeNode(),
      createHelmChartNode(),
      createTerragruntDependencyNode(),
      createTerraformModuleNode(),
    ];

    const terragruntNodes = nodes.filter(isTerragruntNode);

    expect(terragruntNodes).toHaveLength(3);
    expect(terragruntNodes.every(n => n.type.startsWith('tg_'))).toBe(true);
  });

  it('should correctly filter TerragruntIncludeNodes from mixed array', () => {
    const nodes: NodeType[] = [
      createTerragruntConfigNode(),
      createTerragruntIncludeNode(),
      createTerragruntDependencyNode(),
      createTerragruntIncludeNode(), // Second include
    ];

    const includeNodes = nodes.filter(isTerragruntIncludeNode);

    expect(includeNodes).toHaveLength(2);
    expect(includeNodes.every(n => n.type === 'tg_include')).toBe(true);
  });

  it('should correctly filter TerragruntDependencyNodes from mixed array', () => {
    const nodes: NodeType[] = [
      createTerragruntConfigNode(),
      createTerragruntDependencyNode(),
      createTerragruntIncludeNode(),
      createTerragruntDependencyNode(), // Second dependency
      createTerragruntDependencyNode(), // Third dependency
    ];

    const dependencyNodes = nodes.filter(isTerragruntDependencyNode);

    expect(dependencyNodes).toHaveLength(3);
    expect(dependencyNodes.every(n => n.type === 'tg_dependency')).toBe(true);
  });

  it('should return empty array when no matching nodes', () => {
    const nodes: NodeType[] = [
      createTerraformResourceNode(),
      createK8sDeploymentNode(),
      createHelmChartNode(),
    ];

    const terragruntNodes = nodes.filter(isTerragruntNode);

    expect(terragruntNodes).toHaveLength(0);
  });
});
