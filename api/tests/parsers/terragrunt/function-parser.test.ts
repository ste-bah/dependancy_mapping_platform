/**
 * Terragrunt Function Parser Unit Tests
 * @module tests/parsers/terragrunt/function-parser.test
 *
 * Tests for parsing and validating all 27 Terragrunt built-in functions.
 * Target: 80%+ coverage for function-parser.ts
 */

import { describe, it, expect } from 'vitest';
import {
  TerragruntFunctionParser,
  createFunctionParser,
  containsTerragruntFunctions,
  getTerragruntFunctionCalls,
  validateFunctionCalls,
} from '../../../src/parsers/terragrunt/function-parser';
import { TERRAGRUNT_FUNCTIONS } from '../../../src/parsers/terragrunt/types';

// ============================================================================
// TerragruntFunctionParser Tests
// ============================================================================

describe('TerragruntFunctionParser', () => {
  describe('instantiation', () => {
    it('should create parser with default options', () => {
      const parser = new TerragruntFunctionParser();
      expect(parser).toBeDefined();
    });

    it('should create parser with custom options', () => {
      const parser = new TerragruntFunctionParser({
        strictMode: true,
        includeRaw: false,
      });
      expect(parser).toBeDefined();
    });

    it('should create parser using factory function', () => {
      const parser = createFunctionParser();
      expect(parser).toBeInstanceOf(TerragruntFunctionParser);
    });
  });

  describe('isTerragruntFunction', () => {
    let parser: TerragruntFunctionParser;

    beforeEach(() => {
      parser = new TerragruntFunctionParser();
    });

    it('should identify all 27 Terragrunt functions', () => {
      for (const func of TERRAGRUNT_FUNCTIONS) {
        expect(parser.isTerragruntFunction(func.name)).toBe(true);
      }
    });

    it('should return false for non-Terragrunt functions', () => {
      expect(parser.isTerragruntFunction('unknown_func')).toBe(false);
      expect(parser.isTerragruntFunction('terraform_func')).toBe(false);
      expect(parser.isTerragruntFunction('file')).toBe(false);
      expect(parser.isTerragruntFunction('jsonencode')).toBe(false);
    });
  });

  describe('getTerragruntFunctionNames', () => {
    it('should return all 27 function names', () => {
      const parser = new TerragruntFunctionParser();
      const names = parser.getTerragruntFunctionNames();

      expect(names).toHaveLength(27);
      expect(names).toContain('find_in_parent_folders');
      expect(names).toContain('get_terragrunt_dir');
      expect(names).toContain('get_aws_account_id');
    });
  });
});

// ============================================================================
// Path Functions Tests (6 functions)
// ============================================================================

describe('Path Functions', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  describe('find_in_parent_folders', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('find_in_parent_folders()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.functionDef?.name).toBe('find_in_parent_folders');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('find_in_parent_folders("common.hcl")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse with two arguments', () => {
      const result = parser.parseFunctionCall('find_in_parent_folders("common.hcl", "fallback.hcl")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for too many arguments', () => {
      const result = parser.parseFunctionCall('find_in_parent_folders("a", "b", "c")');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('INVALID_FUNCTION_ARGS');
    });
  });

  describe('path_relative_to_include', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('path_relative_to_include()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.functionDef?.name).toBe('path_relative_to_include');
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for arguments', () => {
      const result = parser.parseFunctionCall('path_relative_to_include("arg")');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('path_relative_from_include', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('path_relative_from_include()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_path_from_repo_root', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_path_from_repo_root()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_path_to_repo_root', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_path_to_repo_root()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_terragrunt_dir', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_terragrunt_dir()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// Include Functions Tests (2 functions)
// ============================================================================

describe('Include Functions', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  describe('read_terragrunt_config', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('read_terragrunt_config("../parent.hcl")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse with two arguments', () => {
      const result = parser.parseFunctionCall('read_terragrunt_config("../parent.hcl", include())');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for no arguments', () => {
      const result = parser.parseFunctionCall('read_terragrunt_config()');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('get_original_terragrunt_dir', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_original_terragrunt_dir()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// Dependency Functions Tests (2 functions)
// ============================================================================

describe('Dependency Functions', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  describe('get_terraform_commands_that_need_vars', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_terraform_commands_that_need_vars()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_terraform_commands_that_need_locking', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_terraform_commands_that_need_locking()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// Read Functions Tests (4 functions)
// ============================================================================

describe('Read Functions', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  describe('sops_decrypt_file', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('sops_decrypt_file("secrets.enc.json")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for no arguments', () => {
      const result = parser.parseFunctionCall('sops_decrypt_file()');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('local_exec', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('local_exec("echo hello")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('read_tfvars_file', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('read_tfvars_file("terraform.tfvars")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('run_cmd', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('run_cmd("echo", "hello")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse with multiple arguments', () => {
      const result = parser.parseFunctionCall('run_cmd("aws", "s3", "ls")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for no arguments', () => {
      const result = parser.parseFunctionCall('run_cmd()');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// AWS Functions Tests (8 functions)
// ============================================================================

describe('AWS Functions', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  describe('get_aws_account_id', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_aws_account_id()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_aws_caller_identity_arn', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_aws_caller_identity_arn()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_aws_caller_identity_user_id', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_aws_caller_identity_user_id()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_aws_region', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_aws_region()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_aws_account_alias', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_aws_account_alias()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_default_retryable_errors', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_default_retryable_errors()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_terraform_command', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_terraform_command()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('get_terraform_cli_args', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_terraform_cli_args()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// Runtime Functions Tests (2 functions)
// ============================================================================

describe('Runtime Functions', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  describe('get_env', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('get_env("AWS_REGION")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse with two arguments (with default)', () => {
      const result = parser.parseFunctionCall('get_env("AWS_REGION", "us-east-1")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for no arguments', () => {
      const result = parser.parseFunctionCall('get_env()');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('get_platform', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('get_platform()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// Utility Functions Tests (3 functions)
// ============================================================================

describe('Utility Functions', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  describe('mark_as_read', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('mark_as_read(local.secret)');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('render_aws_provider_settings', () => {
    it('should parse with no arguments', () => {
      const result = parser.parseFunctionCall('render_aws_provider_settings()');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('render_aws_provider_settings(local.aws_config)');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('parse_aws_arn', () => {
    it('should parse with one argument', () => {
      const result = parser.parseFunctionCall('parse_aws_arn("arn:aws:s3:::my-bucket")');

      expect(result.isTerragruntFunction).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for no arguments', () => {
      const result = parser.parseFunctionCall('parse_aws_arn()');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Extract Function Calls Tests
// ============================================================================

describe('extractFunctionCalls', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  it('should extract single function call', () => {
    const calls = parser.extractFunctionCalls('find_in_parent_folders()');

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('find_in_parent_folders');
  });

  it('should extract nested function calls', () => {
    const calls = parser.extractFunctionCalls('read_terragrunt_config(find_in_parent_folders("common.hcl"))');

    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.some(c => c.name === 'read_terragrunt_config')).toBe(true);
    expect(calls.some(c => c.name === 'find_in_parent_folders')).toBe(true);
  });

  it('should identify valid calls', () => {
    const calls = parser.extractFunctionCalls('get_aws_account_id()');

    expect(calls).toHaveLength(1);
    expect(calls[0].isValid).toBe(true);
  });

  it('should identify invalid calls', () => {
    const calls = parser.extractFunctionCalls('get_env()');

    expect(calls).toHaveLength(1);
    expect(calls[0].isValid).toBe(false);
    expect(calls[0].errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Validate Function Tests
// ============================================================================

describe('validateFunction', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  it('should return no errors for valid function call', () => {
    const errors = parser.validateFunction('find_in_parent_folders', []);

    expect(errors).toHaveLength(0);
  });

  it('should return errors for too few arguments', () => {
    const errors = parser.validateFunction('get_env', []);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].code).toBe('INVALID_FUNCTION_ARGS');
    expect(errors[0].message).toContain('at least 1');
  });

  it('should return errors for too many arguments', () => {
    const args = [
      { type: 'literal' as const, value: 'a', raw: '"a"' },
      { type: 'literal' as const, value: 'b', raw: '"b"' },
      { type: 'literal' as const, value: 'c', raw: '"c"' },
    ];
    const errors = parser.validateFunction('find_in_parent_folders', args);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].code).toBe('INVALID_FUNCTION_ARGS');
    expect(errors[0].message).toContain('at most 2');
  });
});

// ============================================================================
// Strict Mode Tests
// ============================================================================

describe('Strict Mode', () => {
  it('should warn about unknown functions that look like Terragrunt functions', () => {
    const parser = new TerragruntFunctionParser({ strictMode: true });
    const result = parser.parseFunctionCall('get_aws_account()');

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('UNKNOWN_FUNCTION');
  });

  it('should suggest similar functions', () => {
    const parser = new TerragruntFunctionParser({ strictMode: true });
    const result = parser.parseFunctionCall('get_aws_account()');

    expect(result.errors[0].message).toContain('did you mean');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('containsTerragruntFunctions', () => {
    it('should return true when expression contains Terragrunt functions', () => {
      const expr = {
        type: 'function' as const,
        name: 'find_in_parent_folders',
        args: [],
        raw: 'find_in_parent_folders()',
      };

      expect(containsTerragruntFunctions(expr)).toBe(true);
    });

    it('should return false when expression does not contain Terragrunt functions', () => {
      const expr = {
        type: 'function' as const,
        name: 'file',
        args: [],
        raw: 'file("path")',
      };

      expect(containsTerragruntFunctions(expr)).toBe(false);
    });
  });

  describe('getTerragruntFunctionCalls', () => {
    it('should return only Terragrunt function calls', () => {
      const expr = {
        type: 'function' as const,
        name: 'find_in_parent_folders',
        args: [],
        raw: 'find_in_parent_folders()',
      };

      const calls = getTerragruntFunctionCalls(expr);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every(c => c.def !== null)).toBe(true);
    });
  });

  describe('validateFunctionCalls', () => {
    it('should return validation errors', () => {
      const expr = {
        type: 'function' as const,
        name: 'get_env',
        args: [],
        raw: 'get_env()',
      };

      const errors = validateFunctionCalls(expr);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Non-Function Expression Tests
// ============================================================================

describe('Non-Function Expression Handling', () => {
  let parser: TerragruntFunctionParser;

  beforeEach(() => {
    parser = new TerragruntFunctionParser();
  });

  it('should handle literal expressions', () => {
    const result = parser.parseFunctionCall('"just a string"');

    expect(result.isTerragruntFunction).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('Expected function call');
  });

  it('should handle reference expressions', () => {
    const result = parser.parseFunctionCall('local.variable');

    expect(result.isTerragruntFunction).toBe(false);
  });

  it('should handle array expressions', () => {
    const result = parser.parseFunctionCall('["a", "b"]');

    expect(result.isTerragruntFunction).toBe(false);
  });
});
