/**
 * Terragrunt Parser Module Tests
 * @module tests/parsers/terragrunt/index.test
 *
 * Tests for the main index exports to ensure API stability.
 */

import { describe, it, expect } from 'vitest';
import * as terragruntModule from '../../../src/parsers/terragrunt';

describe('Terragrunt Module Exports', () => {
  describe('Type exports', () => {
    it('should export TERRAGRUNT_FUNCTIONS constant', () => {
      expect(terragruntModule.TERRAGRUNT_FUNCTIONS).toBeDefined();
      expect(Array.isArray(terragruntModule.TERRAGRUNT_FUNCTIONS)).toBe(true);
      expect(terragruntModule.TERRAGRUNT_FUNCTIONS).toHaveLength(27);
    });

    it('should export TERRAGRUNT_FUNCTION_NAMES set', () => {
      expect(terragruntModule.TERRAGRUNT_FUNCTION_NAMES).toBeDefined();
      expect(terragruntModule.TERRAGRUNT_FUNCTION_NAMES).toBeInstanceOf(Set);
      expect(terragruntModule.TERRAGRUNT_FUNCTION_NAMES.size).toBe(27);
    });

    it('should export DEFAULT_TERRAGRUNT_PARSER_OPTIONS', () => {
      expect(terragruntModule.DEFAULT_TERRAGRUNT_PARSER_OPTIONS).toBeDefined();
      expect(terragruntModule.DEFAULT_TERRAGRUNT_PARSER_OPTIONS.errorRecovery).toBe(true);
    });
  });

  describe('Type guard exports', () => {
    it('should export block type guards', () => {
      expect(typeof terragruntModule.isTerraformBlock).toBe('function');
      expect(typeof terragruntModule.isRemoteStateBlock).toBe('function');
      expect(typeof terragruntModule.isIncludeBlock).toBe('function');
      expect(typeof terragruntModule.isLocalsBlock).toBe('function');
      expect(typeof terragruntModule.isDependencyBlock).toBe('function');
      expect(typeof terragruntModule.isDependenciesBlock).toBe('function');
      expect(typeof terragruntModule.isGenerateBlock).toBe('function');
      expect(typeof terragruntModule.isInputsBlock).toBe('function');
      expect(typeof terragruntModule.isIamRoleBlock).toBe('function');
      expect(typeof terragruntModule.isRetryConfigBlock).toBe('function');
      expect(typeof terragruntModule.isSimpleConfigBlock).toBe('function');
    });

    it('should export function utilities', () => {
      expect(typeof terragruntModule.isTerragruntFunction).toBe('function');
      expect(typeof terragruntModule.getTerragruntFunctionDef).toBe('function');
    });

    it('should export parse result type guards', () => {
      expect(typeof terragruntModule.isParseSuccess).toBe('function');
      expect(typeof terragruntModule.isParseFailure).toBe('function');
    });
  });

  describe('Branded type creators', () => {
    it('should export branded type creators', () => {
      expect(typeof terragruntModule.createTerragruntFilePath).toBe('function');
      expect(typeof terragruntModule.createIncludeLabel).toBe('function');
      expect(typeof terragruntModule.createDependencyName).toBe('function');
      expect(typeof terragruntModule.createGenerateLabel).toBe('function');
    });
  });

  describe('Visitor utilities', () => {
    it('should export visitor utilities', () => {
      expect(typeof terragruntModule.visitBlock).toBe('function');
      expect(typeof terragruntModule.assertNeverBlock).toBe('function');
      expect(typeof terragruntModule.getBlockType).toBe('function');
    });
  });

  describe('Lexer exports', () => {
    it('should export TerragruntLexer class', () => {
      expect(terragruntModule.TerragruntLexer).toBeDefined();
      expect(typeof terragruntModule.TerragruntLexer).toBe('function');
    });

    it('should export lexer utility functions', () => {
      expect(typeof terragruntModule.filterTokensForParsing).toBe('function');
      expect(typeof terragruntModule.extractStringContent).toBe('function');
      expect(typeof terragruntModule.extractHeredocContent).toBe('function');
    });
  });

  describe('Function parser exports', () => {
    it('should export TerragruntFunctionParser class', () => {
      expect(terragruntModule.TerragruntFunctionParser).toBeDefined();
      expect(typeof terragruntModule.TerragruntFunctionParser).toBe('function');
    });

    it('should export function parser utilities', () => {
      expect(typeof terragruntModule.containsTerragruntFunctions).toBe('function');
      expect(typeof terragruntModule.getTerragruntFunctionCalls).toBe('function');
      expect(typeof terragruntModule.validateFunctionCalls).toBe('function');
      expect(typeof terragruntModule.createFunctionParser).toBe('function');
    });
  });

  describe('Include resolver exports', () => {
    it('should export IncludeResolver class', () => {
      expect(terragruntModule.IncludeResolver).toBeDefined();
      expect(typeof terragruntModule.IncludeResolver).toBe('function');
    });

    it('should export resolver utilities', () => {
      expect(typeof terragruntModule.createIncludeResolver).toBe('function');
      expect(typeof terragruntModule.resolveReferences).toBe('function');
    });
  });

  describe('Main parser exports', () => {
    it('should export TerragruntParser class', () => {
      expect(terragruntModule.TerragruntParser).toBeDefined();
      expect(typeof terragruntModule.TerragruntParser).toBe('function');
    });

    it('should export parser factory functions', () => {
      expect(typeof terragruntModule.createTerragruntParser).toBe('function');
      expect(typeof terragruntModule.parseTerragrunt).toBe('function');
      expect(typeof terragruntModule.parseTerragruntFile).toBe('function');
    });

    it('should export default parser instance', () => {
      expect(terragruntModule.terragruntParser).toBeDefined();
      expect(terragruntModule.terragruntParser).toBeInstanceOf(terragruntModule.TerragruntParser);
    });
  });

  describe('Service exports', () => {
    it('should export TerragruntParserService', () => {
      expect(terragruntModule.TerragruntParserService).toBeDefined();
      expect(typeof terragruntModule.TerragruntParserService).toBe('function');
    });

    it('should export parser service functions', () => {
      expect(typeof terragruntModule.getParserService).toBe('function');
      expect(typeof terragruntModule.parseFile).toBe('function');
      expect(typeof terragruntModule.parseContent).toBe('function');
      expect(typeof terragruntModule.parseDirectory).toBe('function');
      expect(typeof terragruntModule.quickParse).toBe('function');
      expect(typeof terragruntModule.batchParse).toBe('function');
    });

    it('should export TerragruntHierarchyService', () => {
      expect(terragruntModule.TerragruntHierarchyService).toBeDefined();
      expect(typeof terragruntModule.TerragruntHierarchyService).toBe('function');
    });

    it('should export hierarchy service functions', () => {
      expect(typeof terragruntModule.createHierarchyService).toBe('function');
      expect(typeof terragruntModule.buildHierarchy).toBe('function');
      expect(typeof terragruntModule.getMergedConfiguration).toBe('function');
      expect(typeof terragruntModule.buildDependencyGraph).toBe('function');
      expect(typeof terragruntModule.getExecutionOrder).toBe('function');
    });

    it('should export TerragruntValidationService', () => {
      expect(terragruntModule.TerragruntValidationService).toBeDefined();
      expect(typeof terragruntModule.TerragruntValidationService).toBe('function');
    });

    it('should export validation service functions', () => {
      expect(typeof terragruntModule.createValidationService).toBe('function');
      expect(typeof terragruntModule.validateFile).toBe('function');
      expect(typeof terragruntModule.validateBlock).toBe('function');
      expect(typeof terragruntModule.getValidationRules).toBe('function');
      expect(terragruntModule.BUILTIN_RULES).toBeDefined();
    });
  });
});

describe('API Stability', () => {
  it('should maintain consistent type guard behavior', () => {
    const mockTerraformBlock = {
      type: 'terraform' as const,
      source: null,
      extraArguments: [],
      beforeHooks: [],
      afterHooks: [],
      errorHooks: [],
      includeInCopy: [],
      location: { file: 'test', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 1 },
      raw: '',
    };

    expect(terragruntModule.isTerraformBlock(mockTerraformBlock)).toBe(true);
    expect(terragruntModule.isRemoteStateBlock(mockTerraformBlock)).toBe(false);
  });

  it('should maintain consistent function lookup', () => {
    // All documented functions should be found
    const functionNames = [
      'find_in_parent_folders',
      'get_terragrunt_dir',
      'get_aws_account_id',
      'get_env',
    ];

    for (const name of functionNames) {
      expect(terragruntModule.isTerragruntFunction(name)).toBe(true);
      expect(terragruntModule.getTerragruntFunctionDef(name)).toBeDefined();
    }
  });

  it('should maintain consistent parser instantiation', async () => {
    const parser = terragruntModule.createTerragruntParser();
    expect(parser.name).toBe('terragrunt-hcl');
    expect(parser.version).toBe('1.0.0');
    expect(parser.supportedExtensions).toContain('.hcl');
  });

  it('should parse simple configuration correctly', async () => {
    const content = `
terraform {
  source = "module"
}
`;
    const result = await terragruntModule.parseTerragrunt(content);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks).toHaveLength(1);
      expect(result.data.blocks[0].type).toBe('terraform');
    }
  });
});
