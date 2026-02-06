/**
 * Terraform Test Factories
 * @module tests/factories/terraform
 *
 * Factory functions for creating Terraform test data.
 * Used across unit and integration tests for consistent test data.
 */

import { vi } from 'vitest';
import type {
  TerraformBlock,
  TerraformFile,
  SourceLocation,
  HCLExpression,
  HCLLiteralExpression,
  HCLReferenceExpression,
  HCLFunctionExpression,
  HCLArrayExpression,
  HCLObjectExpression,
} from '@/parsers/terraform/types';
import type {
  TerraformResourceNode,
  TerraformDataNode,
  TerraformModuleNode,
  TerraformVariableNode,
  TerraformOutputNode,
  TerraformLocalNode,
  NodeLocation,
} from '@/types/graph';

// ============================================================================
// Source Location Factories
// ============================================================================

export function createSourceLocation(overrides: Partial<SourceLocation> = {}): SourceLocation {
  return {
    file: 'main.tf',
    lineStart: 1,
    lineEnd: 5,
    columnStart: 1,
    columnEnd: 1,
    ...overrides,
  };
}

export function createNodeLocation(overrides: Partial<NodeLocation> = {}): NodeLocation {
  return {
    file: 'main.tf',
    lineStart: 1,
    lineEnd: 5,
    columnStart: 1,
    columnEnd: 1,
    ...overrides,
  };
}

// ============================================================================
// HCL Expression Factories
// ============================================================================

export function createLiteralExpression(
  value: string | number | boolean,
  overrides: Partial<HCLLiteralExpression> = {}
): HCLLiteralExpression {
  return {
    type: 'literal',
    value,
    raw: String(value),
    ...overrides,
  };
}

export function createReferenceExpression(
  parts: string[],
  overrides: Partial<HCLReferenceExpression> = {}
): HCLReferenceExpression {
  return {
    type: 'reference',
    parts,
    raw: parts.join('.'),
    ...overrides,
  };
}

export function createFunctionExpression(
  name: string,
  args: HCLExpression[],
  overrides: Partial<HCLFunctionExpression> = {}
): HCLFunctionExpression {
  return {
    type: 'function',
    name,
    args,
    raw: `${name}(${args.map(a => a.raw).join(', ')})`,
    ...overrides,
  };
}

export function createArrayExpression(
  elements: HCLExpression[],
  overrides: Partial<HCLArrayExpression> = {}
): HCLArrayExpression {
  return {
    type: 'array',
    elements,
    raw: `[${elements.map(e => e.raw).join(', ')}]`,
    ...overrides,
  };
}

export function createObjectExpression(
  attributes: Record<string, HCLExpression>,
  overrides: Partial<HCLObjectExpression> = {}
): HCLObjectExpression {
  return {
    type: 'object',
    attributes,
    raw: `{${Object.entries(attributes).map(([k, v]) => `${k} = ${v.raw}`).join(', ')}}`,
    ...overrides,
  };
}

// ============================================================================
// Terraform Block Factories
// ============================================================================

export interface ResourceBlockOptions {
  resourceType?: string;
  name?: string;
  attributes?: Record<string, HCLExpression>;
  nestedBlocks?: TerraformBlock[];
  location?: Partial<SourceLocation>;
}

export function createResourceBlock(options: ResourceBlockOptions = {}): TerraformBlock {
  const {
    resourceType = 'aws_instance',
    name = 'web',
    attributes = {},
    nestedBlocks = [],
    location = {},
  } = options;

  return {
    type: 'resource',
    labels: [resourceType, name],
    attributes: {
      ami: createLiteralExpression('ami-12345'),
      instance_type: createLiteralExpression('t2.micro'),
      ...attributes,
    },
    nestedBlocks,
    location: createSourceLocation(location),
  };
}

export interface DataBlockOptions {
  dataType?: string;
  name?: string;
  attributes?: Record<string, HCLExpression>;
  location?: Partial<SourceLocation>;
}

export function createDataBlock(options: DataBlockOptions = {}): TerraformBlock {
  const {
    dataType = 'aws_ami',
    name = 'latest',
    attributes = {},
    location = {},
  } = options;

  return {
    type: 'data',
    labels: [dataType, name],
    attributes: {
      most_recent: createLiteralExpression(true),
      ...attributes,
    },
    nestedBlocks: [],
    location: createSourceLocation(location),
  };
}

export interface ModuleBlockOptions {
  name?: string;
  source?: string;
  version?: string;
  variables?: Record<string, HCLExpression>;
  location?: Partial<SourceLocation>;
}

export function createModuleBlock(options: ModuleBlockOptions = {}): TerraformBlock {
  const {
    name = 'vpc',
    source = './modules/vpc',
    version,
    variables = {},
    location = {},
  } = options;

  const attributes: Record<string, HCLExpression> = {
    source: createLiteralExpression(source),
    ...variables,
  };

  if (version) {
    attributes.version = createLiteralExpression(version);
  }

  return {
    type: 'module',
    labels: [name],
    attributes,
    nestedBlocks: [],
    location: createSourceLocation(location),
  };
}

export interface VariableBlockOptions {
  name?: string;
  varType?: string;
  defaultValue?: unknown;
  description?: string;
  sensitive?: boolean;
  location?: Partial<SourceLocation>;
}

export function createVariableBlock(options: VariableBlockOptions = {}): TerraformBlock {
  const {
    name = 'instance_type',
    varType,
    defaultValue,
    description,
    sensitive = false,
    location = {},
  } = options;

  const attributes: Record<string, HCLExpression> = {};

  if (varType) {
    attributes.type = createLiteralExpression(varType);
  }
  if (defaultValue !== undefined) {
    attributes.default = createLiteralExpression(defaultValue as string | number | boolean);
  }
  if (description) {
    attributes.description = createLiteralExpression(description);
  }
  if (sensitive) {
    attributes.sensitive = createLiteralExpression(true);
  }

  return {
    type: 'variable',
    labels: [name],
    attributes,
    nestedBlocks: [],
    location: createSourceLocation(location),
  };
}

export interface OutputBlockOptions {
  name?: string;
  value?: HCLExpression;
  description?: string;
  sensitive?: boolean;
  location?: Partial<SourceLocation>;
}

export function createOutputBlock(options: OutputBlockOptions = {}): TerraformBlock {
  const {
    name = 'instance_id',
    value = createReferenceExpression(['aws_instance', 'web', 'id']),
    description,
    sensitive = false,
    location = {},
  } = options;

  const attributes: Record<string, HCLExpression> = {
    value,
  };

  if (description) {
    attributes.description = createLiteralExpression(description);
  }
  if (sensitive) {
    attributes.sensitive = createLiteralExpression(true);
  }

  return {
    type: 'output',
    labels: [name],
    attributes,
    nestedBlocks: [],
    location: createSourceLocation(location),
  };
}

export function createLocalsBlock(
  locals: Record<string, HCLExpression>,
  location: Partial<SourceLocation> = {}
): TerraformBlock {
  return {
    type: 'locals',
    labels: [],
    attributes: locals,
    nestedBlocks: [],
    location: createSourceLocation(location),
  };
}

export function createProviderBlock(
  providerName: string,
  alias?: string,
  attributes: Record<string, HCLExpression> = {},
  location: Partial<SourceLocation> = {}
): TerraformBlock {
  const labels = alias ? [providerName, alias] : [providerName];

  return {
    type: 'provider',
    labels,
    attributes,
    nestedBlocks: [],
    location: createSourceLocation(location),
  };
}

// ============================================================================
// Terraform File Factories
// ============================================================================

export interface TerraformFileOptions {
  path?: string;
  blocks?: TerraformBlock[];
}

export function createTerraformFile(options: TerraformFileOptions = {}): TerraformFile {
  const {
    path = 'main.tf',
    blocks = [],
  } = options;

  return {
    path,
    blocks,
    errors: [],
    diagnostics: [],
  };
}

export function createTerraformFileWithResources(
  resourceCount: number = 3,
  path: string = 'main.tf'
): TerraformFile {
  const blocks: TerraformBlock[] = [];

  for (let i = 0; i < resourceCount; i++) {
    blocks.push(createResourceBlock({
      resourceType: 'aws_instance',
      name: `instance_${i}`,
      location: { lineStart: i * 10 + 1, lineEnd: i * 10 + 8 },
    }));
  }

  return createTerraformFile({ path, blocks });
}

// ============================================================================
// Node Factories
// ============================================================================

export function createTerraformResourceNode(
  overrides: Partial<TerraformResourceNode> = {}
): TerraformResourceNode {
  return {
    type: 'terraform_resource',
    id: `aws_instance.web`,
    name: 'web',
    resourceType: 'aws_instance',
    provider: 'aws',
    dependsOn: [],
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

export function createTerraformDataNode(
  overrides: Partial<TerraformDataNode> = {}
): TerraformDataNode {
  return {
    type: 'terraform_data',
    id: `data.aws_ami.latest`,
    name: 'latest',
    dataType: 'aws_ami',
    provider: 'aws',
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

export function createTerraformModuleNode(
  overrides: Partial<TerraformModuleNode> = {}
): TerraformModuleNode {
  return {
    type: 'terraform_module',
    id: `module.vpc`,
    name: 'vpc',
    source: './modules/vpc',
    sourceType: 'local',
    providers: {},
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

export function createTerraformVariableNode(
  overrides: Partial<TerraformVariableNode> = {}
): TerraformVariableNode {
  return {
    type: 'terraform_variable',
    id: `var.instance_type`,
    name: 'instance_type',
    sensitive: false,
    nullable: true,
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

export function createTerraformOutputNode(
  overrides: Partial<TerraformOutputNode> = {}
): TerraformOutputNode {
  return {
    type: 'terraform_output',
    id: `output.instance_id`,
    name: 'instance_id',
    value: 'aws_instance.web.id',
    sensitive: false,
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

export function createTerraformLocalNode(
  overrides: Partial<TerraformLocalNode> = {}
): TerraformLocalNode {
  return {
    type: 'terraform_local',
    id: `local.common_tags`,
    name: 'common_tags',
    value: '{}',
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// Complex Scenario Factories
// ============================================================================

/**
 * Create a complete VPC module scenario with resources and references
 */
export function createVPCScenario(): {
  files: TerraformFile[];
  expectedNodes: number;
  expectedEdges: number;
} {
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
      cidr_block: createLiteralExpression('10.0.1.0/24'),
    },
  });

  const instanceBlock = createResourceBlock({
    resourceType: 'aws_instance',
    name: 'web',
    attributes: {
      subnet_id: createReferenceExpression(['aws_subnet', 'public', 'id']),
      ami: createReferenceExpression(['var', 'ami_id']),
    },
  });

  const variableBlock = createVariableBlock({
    name: 'ami_id',
    varType: 'string',
    description: 'AMI ID for the instance',
  });

  const files = [
    createTerraformFile({
      path: 'main.tf',
      blocks: [vpcBlock, subnetBlock, instanceBlock],
    }),
    createTerraformFile({
      path: 'variables.tf',
      blocks: [variableBlock],
    }),
  ];

  return {
    files,
    expectedNodes: 4, // vpc, subnet, instance, variable
    expectedEdges: 3, // vpc->subnet, subnet->instance, var->instance
  };
}

/**
 * Create a module call scenario
 */
export function createModuleCallScenario(): {
  files: TerraformFile[];
  expectedNodes: number;
  expectedEdges: number;
} {
  const moduleBlock = createModuleBlock({
    name: 'networking',
    source: 'terraform-aws-modules/vpc/aws',
    version: '3.0.0',
    variables: {
      cidr: createLiteralExpression('10.0.0.0/16'),
      azs: createArrayExpression([
        createLiteralExpression('us-east-1a'),
        createLiteralExpression('us-east-1b'),
      ]),
    },
  });

  const instanceBlock = createResourceBlock({
    resourceType: 'aws_instance',
    name: 'web',
    attributes: {
      subnet_id: createReferenceExpression(['module', 'networking', 'public_subnets', '0']),
    },
  });

  const files = [
    createTerraformFile({
      path: 'main.tf',
      blocks: [moduleBlock, instanceBlock],
    }),
  ];

  return {
    files,
    expectedNodes: 2,
    expectedEdges: 1,
  };
}

/**
 * Create a circular dependency scenario (should be detected as error)
 */
export function createCircularDependencyScenario(): {
  files: TerraformFile[];
} {
  const sgA = createResourceBlock({
    resourceType: 'aws_security_group',
    name: 'a',
    attributes: {
      ingress: createObjectExpression({
        security_groups: createArrayExpression([
          createReferenceExpression(['aws_security_group', 'b', 'id']),
        ]),
      }),
    },
  });

  const sgB = createResourceBlock({
    resourceType: 'aws_security_group',
    name: 'b',
    attributes: {
      ingress: createObjectExpression({
        security_groups: createArrayExpression([
          createReferenceExpression(['aws_security_group', 'a', 'id']),
        ]),
      }),
    },
  });

  return {
    files: [
      createTerraformFile({
        path: 'security.tf',
        blocks: [sgA, sgB],
      }),
    ],
  };
}
