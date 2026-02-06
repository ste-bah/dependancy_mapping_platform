/**
 * Module Detector Tests
 * @module tests/parsers/terraform/module-detector
 *
 * Unit tests for Terraform module source detection and parsing.
 * TASK-DETECT-002: Module dependency detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseModuleSource,
  parseVersionConstraint,
  ModuleDetector,
  moduleDetector,
} from '@/parsers/terraform/module-detector';
import {
  createModuleBlock,
  createLiteralExpression,
  createReferenceExpression,
  createArrayExpression,
} from '../../factories/terraform.factory';

describe('parseModuleSource', () => {
  const callerDir = '/project/terraform';

  describe('local paths', () => {
    it('should parse relative local path', () => {
      const result = parseModuleSource('./modules/vpc', callerDir);

      expect(result.type).toBe('local');
      if (result.type === 'local') {
        expect(result.path).toBe('./modules/vpc');
        expect(result.resolvedPath).toBe('/project/terraform/modules/vpc');
      }
    });

    it('should parse parent directory path', () => {
      const result = parseModuleSource('../shared/modules/vpc', callerDir);

      expect(result.type).toBe('local');
      if (result.type === 'local') {
        expect(result.path).toBe('../shared/modules/vpc');
        expect(result.resolvedPath).toBe('/project/shared/modules/vpc');
      }
    });

    it('should parse absolute path', () => {
      const result = parseModuleSource('/opt/terraform/modules/vpc', callerDir);

      expect(result.type).toBe('local');
      if (result.type === 'local') {
        expect(result.path).toBe('/opt/terraform/modules/vpc');
        expect(result.resolvedPath).toBe('/opt/terraform/modules/vpc');
      }
    });
  });

  describe('registry modules', () => {
    it('should parse public registry module', () => {
      const result = parseModuleSource('hashicorp/consul/aws', callerDir);

      expect(result.type).toBe('registry');
      if (result.type === 'registry') {
        expect(result.namespace).toBe('hashicorp');
        expect(result.name).toBe('consul');
        expect(result.provider).toBe('aws');
        expect(result.hostname).toBe('registry.terraform.io');
        expect(result.version).toBeNull();
      }
    });

    it('should parse terraform-aws-modules source', () => {
      const result = parseModuleSource('terraform-aws-modules/vpc/aws', callerDir);

      expect(result.type).toBe('registry');
      if (result.type === 'registry') {
        expect(result.namespace).toBe('terraform-aws-modules');
        expect(result.name).toBe('vpc');
        expect(result.provider).toBe('aws');
      }
    });

    it('should parse private registry module with hostname', () => {
      const result = parseModuleSource('app.terraform.io/myorg/vpc/aws', callerDir);

      expect(result.type).toBe('registry');
      if (result.type === 'registry') {
        expect(result.hostname).toBe('app.terraform.io');
        expect(result.namespace).toBe('myorg');
        expect(result.name).toBe('vpc');
        expect(result.provider).toBe('aws');
      }
    });
  });

  describe('GitHub sources', () => {
    it('should parse GitHub HTTPS source', () => {
      const result = parseModuleSource('github.com/hashicorp/example', callerDir);

      expect(result.type).toBe('github');
      if (result.type === 'github') {
        expect(result.owner).toBe('hashicorp');
        expect(result.repo).toBe('example');
        expect(result.isSSH).toBe(false);
      }
    });

    it('should parse GitHub HTTPS with subpath', () => {
      const result = parseModuleSource('github.com/hashicorp/terraform-modules//aws/vpc', callerDir);

      expect(result.type).toBe('github');
      if (result.type === 'github') {
        expect(result.owner).toBe('hashicorp');
        expect(result.repo).toBe('terraform-modules');
        expect(result.path).toBe('aws/vpc');
      }
    });

    it('should parse GitHub SSH source', () => {
      const result = parseModuleSource('git@github.com:hashicorp/example.git', callerDir);

      expect(result.type).toBe('github');
      if (result.type === 'github') {
        expect(result.owner).toBe('hashicorp');
        expect(result.repo).toBe('example');
        expect(result.isSSH).toBe(true);
      }
    });

    it('should parse GitHub with ref', () => {
      const result = parseModuleSource('github.com/hashicorp/example?ref=v1.0.0', callerDir);

      expect(result.type).toBe('github');
      if (result.type === 'github') {
        expect(result.ref).toBe('v1.0.0');
      }
    });
  });

  describe('Git sources', () => {
    it('should parse generic git URL', () => {
      const result = parseModuleSource('git::https://example.com/modules.git', callerDir);

      expect(result.type).toBe('git');
      if (result.type === 'git') {
        expect(result.url).toContain('example.com');
      }
    });

    it('should parse git URL with ref', () => {
      const result = parseModuleSource('git::https://example.com/modules.git?ref=v2.0.0', callerDir);

      expect(result.type).toBe('git');
      if (result.type === 'git') {
        expect(result.ref).toBe('v2.0.0');
      }
    });

    it('should parse git SSH URL', () => {
      const result = parseModuleSource('git::ssh://git@example.com/modules.git', callerDir);

      expect(result.type).toBe('git');
      if (result.type === 'git') {
        expect(result.url).toContain('ssh://');
      }
    });
  });

  describe('S3 sources', () => {
    it('should parse S3 source', () => {
      const result = parseModuleSource(
        's3::https://s3-eu-west-1.amazonaws.com/mybucket/module.zip',
        callerDir
      );

      expect(result.type).toBe('s3');
      if (result.type === 's3') {
        expect(result.bucket).toBe('mybucket');
        expect(result.region).toBe('eu-west-1');
      }
    });

    it('should parse S3 source without region', () => {
      const result = parseModuleSource(
        's3::https://s3.amazonaws.com/mybucket/modules/vpc.zip',
        callerDir
      );

      expect(result.type).toBe('s3');
      if (result.type === 's3') {
        expect(result.bucket).toBe('mybucket');
        expect(result.region).toBeNull();
      }
    });
  });

  describe('GCS sources', () => {
    it('should parse GCS source', () => {
      const result = parseModuleSource(
        'gcs::https://www.googleapis.com/storage/v1/mybucket/modules/vpc',
        callerDir
      );

      expect(result.type).toBe('gcs');
      if (result.type === 'gcs') {
        expect(result.bucket).toBe('mybucket');
        expect(result.path).toBe('modules/vpc');
      }
    });
  });

  describe('unknown sources', () => {
    it('should handle unknown source format', () => {
      const result = parseModuleSource('some-unknown-format', callerDir);

      expect(result.type).toBe('unknown');
      if (result.type === 'unknown') {
        expect(result.raw).toBe('some-unknown-format');
      }
    });
  });
});

describe('parseVersionConstraint', () => {
  it('should parse single version', () => {
    const result = parseVersionConstraint('1.0.0');

    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('=');
    expect(result[0].version).toBe('1.0.0');
  });

  it('should parse explicit equals', () => {
    const result = parseVersionConstraint('= 1.0.0');

    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('=');
    expect(result[0].version).toBe('1.0.0');
  });

  it('should parse pessimistic constraint', () => {
    const result = parseVersionConstraint('~> 1.0');

    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('~>');
    expect(result[0].version).toBe('1.0');
  });

  it('should parse greater than or equal', () => {
    const result = parseVersionConstraint('>= 1.0.0');

    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('>=');
    expect(result[0].version).toBe('1.0.0');
  });

  it('should parse less than', () => {
    const result = parseVersionConstraint('< 2.0.0');

    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('<');
    expect(result[0].version).toBe('2.0.0');
  });

  it('should parse compound constraint', () => {
    const result = parseVersionConstraint('>= 1.0.0, < 2.0.0');

    expect(result).toHaveLength(2);
    expect(result[0].operator).toBe('>=');
    expect(result[0].version).toBe('1.0.0');
    expect(result[1].operator).toBe('<');
    expect(result[1].version).toBe('2.0.0');
  });

  it('should parse pessimistic with patch version', () => {
    const result = parseVersionConstraint('~> 1.0.4');

    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('~>');
    expect(result[0].version).toBe('1.0.4');
  });

  it('should parse not equal', () => {
    const result = parseVersionConstraint('!= 1.5.0');

    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('!=');
    expect(result[0].version).toBe('1.5.0');
  });
});

describe('ModuleDetector', () => {
  let detector: ModuleDetector;
  const callerDir = '/project/terraform';

  beforeEach(() => {
    detector = new ModuleDetector();
  });

  describe('detectModules', () => {
    it('should detect local module', () => {
      const blocks = [
        createModuleBlock({
          name: 'vpc',
          source: './modules/vpc',
          variables: {
            cidr: createLiteralExpression('10.0.0.0/16'),
          },
        }),
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe('vpc');
      expect(modules[0].source.type).toBe('local');
      expect(modules[0].variables.cidr).toBe('10.0.0.0/16');
    });

    it('should detect registry module with version', () => {
      const blocks = [
        createModuleBlock({
          name: 'networking',
          source: 'terraform-aws-modules/vpc/aws',
          version: '3.0.0',
        }),
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(1);
      expect(modules[0].source.type).toBe('registry');
      expect(modules[0].version).toBe('3.0.0');
      if (modules[0].source.type === 'registry') {
        expect(modules[0].source.version).toBe('3.0.0');
      }
    });

    it('should detect module with providers mapping', () => {
      const blocks = [
        createModuleBlock({
          name: 'vpc',
          source: './modules/vpc',
          variables: {
            providers: {
              type: 'object',
              attributes: {
                aws: createReferenceExpression(['aws', 'west']),
              },
              raw: '{ aws = aws.west }',
            },
          },
        }),
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(1);
    });

    it('should detect module with depends_on', () => {
      const blocks = [
        {
          ...createModuleBlock({
            name: 'app',
            source: './modules/app',
          }),
          attributes: {
            source: createLiteralExpression('./modules/app'),
            depends_on: createArrayExpression([
              createReferenceExpression(['module', 'vpc']),
            ]),
          },
        },
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(1);
      expect(modules[0].dependsOn).toContain('module.vpc');
    });

    it('should detect module with count', () => {
      const blocks = [
        {
          ...createModuleBlock({
            name: 'worker',
            source: './modules/worker',
          }),
          attributes: {
            source: createLiteralExpression('./modules/worker'),
            count: createReferenceExpression(['var', 'worker_count']),
          },
        },
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(1);
      expect(modules[0].count).not.toBeNull();
    });

    it('should detect module with for_each', () => {
      const blocks = [
        {
          ...createModuleBlock({
            name: 'cluster',
            source: './modules/cluster',
          }),
          attributes: {
            source: createLiteralExpression('./modules/cluster'),
            for_each: createReferenceExpression(['var', 'clusters']),
          },
        },
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(1);
      expect(modules[0].forEach).not.toBeNull();
    });

    it('should handle multiple modules', () => {
      const blocks = [
        createModuleBlock({ name: 'vpc', source: './modules/vpc' }),
        createModuleBlock({ name: 'database', source: './modules/database' }),
        createModuleBlock({ name: 'compute', source: './modules/compute' }),
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(3);
      expect(modules.map(m => m.name)).toEqual(['vpc', 'database', 'compute']);
    });

    it('should ignore non-module blocks', () => {
      const blocks = [
        {
          type: 'resource',
          labels: ['aws_instance', 'web'],
          attributes: {},
          nestedBlocks: [],
          location: { file: 'main.tf', lineStart: 1, lineEnd: 5, columnStart: 1, columnEnd: 1 },
        },
        createModuleBlock({ name: 'vpc', source: './modules/vpc' }),
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe('vpc');
    });

    it('should skip module blocks without source', () => {
      const blocks = [
        {
          type: 'module',
          labels: ['invalid'],
          attributes: {},
          nestedBlocks: [],
          location: { file: 'main.tf', lineStart: 1, lineEnd: 5, columnStart: 1, columnEnd: 1 },
        },
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules).toHaveLength(0);
    });

    it('should preserve source location', () => {
      const blocks = [
        createModuleBlock({
          name: 'vpc',
          source: './modules/vpc',
          location: { file: 'modules.tf', lineStart: 10, lineEnd: 20 },
        }),
      ];

      const modules = detector.detectModules(blocks, callerDir);

      expect(modules[0].location.file).toBe('modules.tf');
      expect(modules[0].location.lineStart).toBe(10);
      expect(modules[0].location.lineEnd).toBe(20);
    });
  });
});

describe('moduleDetector singleton', () => {
  it('should be a ModuleDetector instance', () => {
    expect(moduleDetector).toBeInstanceOf(ModuleDetector);
  });

  it('should detect modules', () => {
    const blocks = [
      createModuleBlock({ name: 'test', source: './test' }),
    ];

    const modules = moduleDetector.detectModules(blocks, '/project');

    expect(modules).toHaveLength(1);
  });
});
