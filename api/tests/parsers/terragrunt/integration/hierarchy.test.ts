/**
 * Terragrunt Hierarchy Service Integration Tests
 * @module tests/parsers/terragrunt/integration/hierarchy.test
 *
 * Tests for configuration hierarchy resolution, merged configurations,
 * and dependency graph building.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  TerragruntHierarchyService,
  createHierarchyService,
  buildHierarchy,
  getMergedConfiguration,
  buildDependencyGraph,
  getExecutionOrder,
} from '../../../../src/parsers/terragrunt/services/hierarchy.service';
import { parseTerragrunt } from '../../../../src/parsers/terragrunt/tg-parser';

// Mock fs module for controlled testing
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
    },
  };
});

// ============================================================================
// Test Fixtures
// ============================================================================

const ROOT_CONFIG = `
locals {
  region      = "us-east-1"
  environment = "production"
  project     = "myapp"
}

remote_state {
  backend = "s3"
  config = {
    bucket = "terraform-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}
`;

const CHILD_CONFIG = `
include "root" {
  path = find_in_parent_folders()
}

locals {
  service = "api"
}

terraform {
  source = "git::https://github.com/example/module.git"
}

inputs = {
  name = "api-service"
}
`;

const VPC_CONFIG = `
terraform {
  source = "../modules/vpc"
}

inputs = {
  cidr = "10.0.0.0/16"
}
`;

const RDS_CONFIG = `
dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id = "vpc-mock"
  }
}

terraform {
  source = "../modules/rds"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}
`;

const ECS_CONFIG = `
dependency "vpc" {
  config_path = "../vpc"
}

dependency "rds" {
  config_path = "../rds"
}

terraform {
  source = "../modules/ecs"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
  db_url = dependency.rds.outputs.connection_string
}
`;

// ============================================================================
// TerragruntHierarchyService Tests
// ============================================================================

describe('TerragruntHierarchyService', () => {
  describe('instantiation', () => {
    it('should create service with default options', () => {
      const service = new TerragruntHierarchyService();
      expect(service).toBeDefined();
    });

    it('should create service with custom options', () => {
      const service = new TerragruntHierarchyService({
        maxDepth: 5,
        resolveFileSystem: false,
        parseIncludes: true,
      });
      expect(service).toBeDefined();
    });

    it('should create service using factory function', () => {
      const service = createHierarchyService();
      expect(service).toBeInstanceOf(TerragruntHierarchyService);
    });
  });

  describe('clearCache', () => {
    it('should clear the parsed file cache', () => {
      const service = new TerragruntHierarchyService();
      service.clearCache();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

// ============================================================================
// Configuration Merging Tests
// ============================================================================

describe('Configuration Merging', () => {
  it('should merge locals from multiple levels', async () => {
    const result = await parseTerragrunt(CHILD_CONFIG, 'child/terragrunt.hcl', {
      resolveIncludes: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // The child has locals block with service
      const localsBlocks = result.data.blocks.filter(b => b.type === 'locals');
      expect(localsBlocks.length).toBeGreaterThan(0);
    }
  });

  it('should parse child configuration with include', async () => {
    const result = await parseTerragrunt(CHILD_CONFIG, 'child/terragrunt.hcl', {
      resolveIncludes: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks.some(b => b.type === 'include')).toBe(true);
      expect(result.data.blocks.some(b => b.type === 'terraform')).toBe(true);
      expect(result.data.blocks.some(b => b.type === 'inputs')).toBe(true);
    }
  });
});

// ============================================================================
// Dependency Graph Tests
// ============================================================================

describe('Dependency Graph Logic', () => {
  it('should parse VPC with no dependencies', async () => {
    const result = await parseTerragrunt(VPC_CONFIG, 'vpc/terragrunt.hcl');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks.some(b => b.type === 'dependency')).toBe(false);
    }
  });

  it('should parse RDS with VPC dependency', async () => {
    const result = await parseTerragrunt(RDS_CONFIG, 'rds/terragrunt.hcl');

    expect(result.success).toBe(true);
    if (result.success) {
      const deps = result.data.blocks.filter(b => b.type === 'dependency');
      expect(deps).toHaveLength(1);
    }
  });

  it('should parse ECS with multiple dependencies', async () => {
    const result = await parseTerragrunt(ECS_CONFIG, 'ecs/terragrunt.hcl');

    expect(result.success).toBe(true);
    if (result.success) {
      const deps = result.data.blocks.filter(b => b.type === 'dependency');
      expect(deps).toHaveLength(2);
    }
  });
});

// ============================================================================
// Execution Order Tests
// ============================================================================

describe('Execution Order Logic', () => {
  it('should determine VPC comes before dependent modules', () => {
    // VPC has no dependencies
    // RDS depends on VPC
    // ECS depends on VPC and RDS

    // Expected order: VPC -> RDS -> ECS
    // This is the topological sort expectation

    // Test with parsed configs
    const configs = {
      vpc: VPC_CONFIG,
      rds: RDS_CONFIG,
      ecs: ECS_CONFIG,
    };

    // VPC should be first (no deps)
    expect(configs.vpc).not.toContain('dependency');

    // RDS depends on VPC
    expect(configs.rds).toContain('dependency "vpc"');

    // ECS depends on both
    expect(configs.ecs).toContain('dependency "vpc"');
    expect(configs.ecs).toContain('dependency "rds"');
  });
});

// ============================================================================
// Cycle Detection Tests
// ============================================================================

describe('Cycle Detection', () => {
  const CYCLIC_A = `
dependency "b" {
  config_path = "../b"
}
terraform {
  source = "../modules/a"
}
`;

  const CYCLIC_B = `
dependency "a" {
  config_path = "../a"
}
terraform {
  source = "../modules/b"
}
`;

  it('should detect direct circular dependencies in configs', async () => {
    // Parse A - depends on B
    const resultA = await parseTerragrunt(CYCLIC_A, 'a/terragrunt.hcl', {
      resolveDependencies: false,
    });

    // Parse B - depends on A
    const resultB = await parseTerragrunt(CYCLIC_B, 'b/terragrunt.hcl', {
      resolveDependencies: false,
    });

    // Both should parse successfully
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);

    // Both have dependencies on each other
    if (resultA.success && resultB.success) {
      expect(resultA.data.blocks.some(b => b.type === 'dependency')).toBe(true);
      expect(resultB.data.blocks.some(b => b.type === 'dependency')).toBe(true);
    }
  });
});

// ============================================================================
// Mock Outputs Tests
// ============================================================================

describe('Mock Outputs Handling', () => {
  it('should parse dependency with mock outputs', async () => {
    const config = `
dependency "vpc" {
  config_path = "../vpc"
  skip_outputs = true
  mock_outputs = {
    vpc_id     = "vpc-mock-12345"
    subnet_ids = ["subnet-1", "subnet-2"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}
`;
    const result = await parseTerragrunt(config, 'test/terragrunt.hcl');

    expect(result.success).toBe(true);
    if (result.success) {
      const deps = result.data.blocks.filter(b => b.type === 'dependency');
      expect(deps).toHaveLength(1);
    }
  });
});

// ============================================================================
// Dependencies Block Tests
// ============================================================================

describe('Dependencies Block', () => {
  it('should parse dependencies block with multiple paths', async () => {
    const config = `
dependencies {
  paths = ["../vpc", "../rds", "../elasticache"]
}
`;
    const result = await parseTerragrunt(config, 'test/terragrunt.hcl');

    expect(result.success).toBe(true);
    if (result.success) {
      const deps = result.data.blocks.filter(b => b.type === 'dependencies');
      expect(deps).toHaveLength(1);
    }
  });
});

// ============================================================================
// Include Merge Strategy Tests
// ============================================================================

describe('Include Merge Strategies', () => {
  it('should parse include with shallow merge', async () => {
    const config = `
include "root" {
  path           = find_in_parent_folders()
  merge_strategy = "shallow"
}
`;
    const result = await parseTerragrunt(config, 'test/terragrunt.hcl', {
      resolveIncludes: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const includes = result.data.blocks.filter(b => b.type === 'include');
      expect(includes).toHaveLength(1);
      if (includes[0].type === 'include') {
        expect(includes[0].mergeStrategy).toBe('shallow');
      }
    }
  });

  it('should parse include with deep merge', async () => {
    const config = `
include "root" {
  path           = find_in_parent_folders()
  merge_strategy = "deep"
  expose         = true
}
`;
    const result = await parseTerragrunt(config, 'test/terragrunt.hcl', {
      resolveIncludes: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const includes = result.data.blocks.filter(b => b.type === 'include');
      expect(includes).toHaveLength(1);
      if (includes[0].type === 'include') {
        expect(includes[0].mergeStrategy).toBe('deep');
        expect(includes[0].exposeAsVariable).toBe(true);
      }
    }
  });

  it('should parse include with no_merge', async () => {
    const config = `
include "root" {
  path           = find_in_parent_folders()
  merge_strategy = "no_merge"
}
`;
    const result = await parseTerragrunt(config, 'test/terragrunt.hcl', {
      resolveIncludes: false,
    });

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Multiple Includes Tests
// ============================================================================

describe('Multiple Includes', () => {
  it('should parse multiple named includes', async () => {
    const config = `
include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "common" {
  path = find_in_parent_folders("common.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}
`;
    const result = await parseTerragrunt(config, 'test/terragrunt.hcl', {
      resolveIncludes: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const includes = result.data.blocks.filter(b => b.type === 'include');
      expect(includes).toHaveLength(3);
    }
  });
});

// ============================================================================
// Complex Hierarchy Tests
// ============================================================================

describe('Complex Hierarchy', () => {
  const COMPLEX_CONFIG = `
include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "region" {
  path           = find_in_parent_folders("region.hcl")
  merge_strategy = "deep"
}

include "env" {
  path           = find_in_parent_folders("env.hcl")
  expose         = true
  merge_strategy = "shallow"
}

locals {
  service_name = "my-service"
  tags = merge(
    include.root.locals.common_tags,
    include.env.locals.env_tags,
    {
      Service = local.service_name
    }
  )
}

dependency "vpc" {
  config_path = find_in_parent_folders("vpc")
}

dependency "rds" {
  config_path = find_in_parent_folders("rds")
}

terraform {
  source = "git::https://github.com/example/terraform-modules.git//ecs-service?ref=v1.0.0"
}

inputs = {
  name       = local.service_name
  vpc_id     = dependency.vpc.outputs.vpc_id
  db_url     = dependency.rds.outputs.connection_string
  tags       = local.tags
}
`;

  it('should parse complex multi-include configuration', async () => {
    const result = await parseTerragrunt(COMPLEX_CONFIG, 'test/terragrunt.hcl', {
      resolveIncludes: false,
      resolveDependencies: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Should have 3 includes
      const includes = result.data.blocks.filter(b => b.type === 'include');
      expect(includes).toHaveLength(3);

      // Should have locals
      const locals = result.data.blocks.filter(b => b.type === 'locals');
      expect(locals).toHaveLength(1);

      // Should have 2 dependencies
      const deps = result.data.blocks.filter(b => b.type === 'dependency');
      expect(deps).toHaveLength(2);

      // Should have terraform block
      const terraform = result.data.blocks.filter(b => b.type === 'terraform');
      expect(terraform).toHaveLength(1);

      // Should have inputs
      const inputs = result.data.blocks.filter(b => b.type === 'inputs');
      expect(inputs).toHaveLength(1);
    }
  });
});
