/**
 * Reference Resolver Tests
 * @module tests/detectors/reference-resolver
 *
 * Unit tests for Terraform reference resolution.
 * TASK-DETECT-003: Reference resolution for dependency detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReferenceResolver,
  createReferenceResolver,
  resolveReferences,
} from '@/detectors/reference-resolver';
import { createDetectionContext } from '@/detectors/base/detector';
import {
  createTerraformFile,
  createResourceBlock,
  createVariableBlock,
  createOutputBlock,
  createDataBlock,
  createModuleBlock,
  createLocalsBlock,
  createLiteralExpression,
  createReferenceExpression,
  createFunctionExpression,
  createTerraformResourceNode,
  createTerraformVariableNode,
  createTerraformDataNode,
  createTerraformModuleNode,
  createTerraformLocalNode,
} from '../factories/terraform.factory';
import type { TerraformFile } from '@/parsers/terraform/types';
import type { NodeType } from '@/types/graph';

describe('ReferenceResolver', () => {
  let resolver: ReferenceResolver;

  beforeEach(() => {
    resolver = createReferenceResolver();
  });

  describe('canDetect', () => {
    it('should return true for valid input with files', () => {
      const input = {
        files: [createTerraformFile()],
        nodes: new Map<string, NodeType>(),
      };

      expect(resolver.canDetect(input)).toBe(true);
    });

    it('should return false for empty files array', () => {
      const input = {
        files: [],
        nodes: new Map<string, NodeType>(),
      };

      expect(resolver.canDetect(input)).toBe(false);
    });

    it('should return false for undefined files', () => {
      const input = {
        files: undefined as unknown as TerraformFile[],
        nodes: new Map<string, NodeType>(),
      };

      expect(resolver.canDetect(input)).toBe(false);
    });
  });

  describe('variable reference resolution', () => {
    it('should resolve var.x references', async () => {
      const variableNode = createTerraformVariableNode({
        id: 'var.ami_id',
        name: 'ami_id',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          ami: createReferenceExpression(['var', 'ami_id']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [variableNode.id, variableNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.edges.length).toBeGreaterThanOrEqual(1);
        const varEdge = result.edges.find(e => e.target === 'var.ami_id');
        expect(varEdge).toBeDefined();
        expect(varEdge?.type).toBe('input_variable');
      }
    });

    it('should handle unresolved variable references', async () => {
      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          ami: createReferenceExpression(['var', 'undefined_var']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>();

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      // Should still succeed - unresolved refs are tracked but don't fail
      expect(result.success).toBe(true);
    });
  });

  describe('local reference resolution', () => {
    it('should resolve local.x references', async () => {
      const localNode = createTerraformLocalNode({
        id: 'local.common_tags',
        name: 'common_tags',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          tags: createReferenceExpression(['local', 'common_tags']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [localNode.id, localNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const localEdge = result.edges.find(e => e.target === 'local.common_tags');
        expect(localEdge).toBeDefined();
        expect(localEdge?.type).toBe('local_reference');
      }
    });
  });

  describe('resource reference resolution', () => {
    it('should resolve resource.type.name.attr references', async () => {
      const vpcNode = createTerraformResourceNode({
        id: 'aws_vpc.main',
        name: 'main',
        resourceType: 'aws_vpc',
      });

      const subnetBlock = createResourceBlock({
        resourceType: 'aws_subnet',
        name: 'public',
        attributes: {
          vpc_id: createReferenceExpression(['aws_vpc', 'main', 'id']),
        },
      });

      const files = [createTerraformFile({ blocks: [subnetBlock] })];
      const nodes = new Map<string, NodeType>([
        [vpcNode.id, vpcNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const refEdge = result.edges.find(e => e.target === 'aws_vpc.main');
        expect(refEdge).toBeDefined();
        expect(refEdge?.type).toBe('references');
      }
    });

    it('should handle chained attribute references', async () => {
      const vpcNode = createTerraformResourceNode({
        id: 'aws_vpc.main',
        name: 'main',
        resourceType: 'aws_vpc',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_route_table',
        name: 'main',
        attributes: {
          vpc_id: createReferenceExpression(['aws_vpc', 'main', 'id']),
          tags: createReferenceExpression(['aws_vpc', 'main', 'tags']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [vpcNode.id, vpcNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        // Multiple references to same resource
        const vpcEdges = result.edges.filter(e => e.target === 'aws_vpc.main');
        expect(vpcEdges.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('data source reference resolution', () => {
    it('should resolve data.type.name references', async () => {
      const dataNode = createTerraformDataNode({
        id: 'data.aws_ami.latest',
        name: 'latest',
        dataType: 'aws_ami',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          ami: createReferenceExpression(['data', 'aws_ami', 'latest', 'id']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [dataNode.id, dataNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const dataEdge = result.edges.find(e => e.target === 'data.aws_ami.latest');
        expect(dataEdge).toBeDefined();
        expect(dataEdge?.type).toBe('data_reference');
      }
    });
  });

  describe('module reference resolution', () => {
    it('should resolve module.name.output references', async () => {
      const moduleNode = createTerraformModuleNode({
        id: 'module.vpc',
        name: 'vpc',
        source: './modules/vpc',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          subnet_id: createReferenceExpression(['module', 'vpc', 'public_subnet_ids', '0']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [moduleNode.id, moduleNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const moduleEdge = result.edges.find(e =>
          e.target === 'module.vpc' || e.target.startsWith('module.vpc')
        );
        expect(moduleEdge).toBeDefined();
      }
    });
  });

  describe('contextual references', () => {
    it('should handle count.index references', async () => {
      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          count: createLiteralExpression(3),
          tags: {
            type: 'object',
            attributes: {
              Name: createReferenceExpression(['count', 'index']),
            },
            raw: '{ Name = count.index }',
          },
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>();

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      // count.index is contextual, doesn't create edges
      expect(result.success).toBe(true);
    });

    it('should handle each.key and each.value references', async () => {
      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          for_each: createReferenceExpression(['var', 'instances']),
          name: createReferenceExpression(['each', 'key']),
          instance_type: createReferenceExpression(['each', 'value', 'type']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>();

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
    });

    it('should handle self.x references', async () => {
      const resourceBlock = {
        ...createResourceBlock({
          resourceType: 'aws_instance',
          name: 'web',
        }),
        nestedBlocks: [{
          type: 'provisioner',
          labels: ['local-exec'],
          attributes: {
            command: createReferenceExpression(['self', 'public_ip']),
          },
          nestedBlocks: [],
          location: { file: 'main.tf', lineStart: 5, lineEnd: 7, columnStart: 1, columnEnd: 1 },
        }],
      };

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>();

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
    });

    it('should handle path.module references', async () => {
      const resourceBlock = createResourceBlock({
        resourceType: 'aws_s3_object',
        name: 'config',
        attributes: {
          source: createReferenceExpression(['path', 'module']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>();

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
    });
  });

  describe('complex expressions', () => {
    it('should extract references from function calls', async () => {
      const vpcNode = createTerraformResourceNode({
        id: 'aws_vpc.main',
        name: 'main',
        resourceType: 'aws_vpc',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_subnet',
        name: 'public',
        attributes: {
          cidr_block: createFunctionExpression('cidrsubnet', [
            createReferenceExpression(['aws_vpc', 'main', 'cidr_block']),
            createLiteralExpression(8),
            createLiteralExpression(0),
          ]),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [vpcNode.id, vpcNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const vpcEdge = result.edges.find(e => e.target === 'aws_vpc.main');
        expect(vpcEdge).toBeDefined();
      }
    });
  });

  describe('confidence scoring', () => {
    it('should assign high confidence to explicit references', async () => {
      const vpcNode = createTerraformResourceNode({
        id: 'aws_vpc.main',
        name: 'main',
        resourceType: 'aws_vpc',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_subnet',
        name: 'public',
        attributes: {
          vpc_id: createReferenceExpression(['aws_vpc', 'main', 'id']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [vpcNode.id, vpcNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const edge = result.edges.find(e => e.target === 'aws_vpc.main');
        expect(edge?.metadata.confidence).toBeGreaterThanOrEqual(85);
      }
    });
  });

  describe('edge creation', () => {
    it('should create correct edge types for different reference types', async () => {
      const varNode = createTerraformVariableNode({ id: 'var.env', name: 'env' });
      const localNode = createTerraformLocalNode({ id: 'local.tags', name: 'tags' });
      const dataNode = createTerraformDataNode({
        id: 'data.aws_caller_identity.current',
        name: 'current',
        dataType: 'aws_caller_identity',
      });

      const resourceBlock = createResourceBlock({
        resourceType: 'aws_instance',
        name: 'web',
        attributes: {
          environment: createReferenceExpression(['var', 'env']),
          tags: createReferenceExpression(['local', 'tags']),
          owner: createReferenceExpression(['data', 'aws_caller_identity', 'current', 'account_id']),
        },
      });

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [varNode.id, varNode],
        [localNode.id, localNode],
        [dataNode.id, dataNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const varEdge = result.edges.find(e => e.target === 'var.env');
        const localEdge = result.edges.find(e => e.target === 'local.tags');
        const dataEdge = result.edges.find(e => e.target === 'data.aws_caller_identity.current');

        expect(varEdge?.type).toBe('input_variable');
        expect(localEdge?.type).toBe('local_reference');
        expect(dataEdge?.type).toBe('data_reference');
      }
    });
  });

  describe('nested block processing', () => {
    it('should process references in nested blocks', async () => {
      const sgNode = createTerraformResourceNode({
        id: 'aws_security_group.allow_ssh',
        name: 'allow_ssh',
        resourceType: 'aws_security_group',
      });

      const resourceBlock = {
        ...createResourceBlock({
          resourceType: 'aws_instance',
          name: 'web',
        }),
        nestedBlocks: [{
          type: 'network_interface',
          labels: [],
          attributes: {
            security_groups: createReferenceExpression(['aws_security_group', 'allow_ssh', 'id']),
          },
          nestedBlocks: [],
          location: { file: 'main.tf', lineStart: 5, lineEnd: 8, columnStart: 1, columnEnd: 1 },
        }],
      };

      const files = [createTerraformFile({ blocks: [resourceBlock] })];
      const nodes = new Map<string, NodeType>([
        [sgNode.id, sgNode],
      ]);

      const context = createDetectionContext(process.cwd(), ['main.tf']);
      const result = await resolver.detect({ files, nodes }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const sgEdge = result.edges.find(e => e.target === 'aws_security_group.allow_ssh');
        expect(sgEdge).toBeDefined();
      }
    });
  });
});

describe('resolveReferences convenience function', () => {
  it('should resolve references from files', async () => {
    const vpcBlock = createResourceBlock({
      resourceType: 'aws_vpc',
      name: 'main',
      attributes: {
        cidr_block: createLiteralExpression('10.0.0.0/16'),
      },
    });

    const subnetBlock = createResourceBlock({
      resourceType: 'aws_subnet',
      name: 'public',
      attributes: {
        vpc_id: createReferenceExpression(['aws_vpc', 'main', 'id']),
      },
    });

    const files = [
      createTerraformFile({
        path: 'main.tf',
        blocks: [vpcBlock, subnetBlock],
      }),
    ];

    const vpcNode = createTerraformResourceNode({
      id: 'aws_vpc.main',
      name: 'main',
      resourceType: 'aws_vpc',
    });

    const result = await resolveReferences(
      files,
      new Map([[vpcNode.id, vpcNode]])
    );

    expect(result.success).toBe(true);
  });
});

describe('createReferenceResolver factory', () => {
  it('should create resolver with default options', () => {
    const resolver = createReferenceResolver();

    expect(resolver).toBeInstanceOf(ReferenceResolver);
    expect(resolver.name).toBe('terraform-reference-resolver');
    expect(resolver.version).toBe('1.0.0');
  });

  it('should create resolver with custom options', () => {
    const resolver = createReferenceResolver({
      maxDepth: 5,
      resolveBuiltins: false,
    });

    expect(resolver).toBeInstanceOf(ReferenceResolver);
  });
});
