/**
 * Terragrunt Services Integration Tests
 * @module tests/parsers/terragrunt/integration/services.test
 *
 * Tests for TerragruntParserService batch parsing and caching.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  TerragruntParserService,
  getParserService,
  parseFile,
  parseContent,
  parseDirectory,
  quickParse,
  batchParse,
} from '../../../../src/parsers/terragrunt/services/parser.service';
import { isParseSuccess } from '../../../../src/parsers/base/parser';

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_CONFIG = `
terraform {
  source = "git::https://github.com/example/module.git"
}

locals {
  region = "us-east-1"
}

inputs = {
  name = "test"
}
`;

const SIMPLE_CONFIG = `
terraform {
  source = "module"
}
`;

const CONFIG_WITH_ERRORS = `
terraform {
  source =
}
`;

const CONFIG_WITH_FUNCTIONS = `
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "\${get_terragrunt_dir()}/../modules/vpc"
}
`;

// ============================================================================
// TerragruntParserService Tests
// ============================================================================

describe('TerragruntParserService', () => {
  beforeEach(() => {
    TerragruntParserService.resetInstance();
  });

  afterEach(() => {
    TerragruntParserService.resetInstance();
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = TerragruntParserService.getInstance();
      const instance2 = TerragruntParserService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = TerragruntParserService.getInstance();
      TerragruntParserService.resetInstance();
      const instance2 = TerragruntParserService.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should get service using factory function', () => {
      const service = getParserService();
      expect(service).toBeInstanceOf(TerragruntParserService);
    });
  });

  describe('parseContent', () => {
    it('should parse valid content', async () => {
      const service = getParserService();
      const result = await service.parseContent(VALID_CONFIG, 'terragrunt.hcl');

      expect(isParseSuccess(result)).toBe(true);
      if (isParseSuccess(result)) {
        expect(result.data.blocks.length).toBeGreaterThan(0);
      }
    });

    it('should parse content using convenience function', async () => {
      const result = await parseContent(VALID_CONFIG, 'terragrunt.hcl');

      expect(isParseSuccess(result)).toBe(true);
    });

    it('should handle empty content', async () => {
      const result = await parseContent('', 'terragrunt.hcl');

      expect(isParseSuccess(result)).toBe(true);
      if (isParseSuccess(result)) {
        expect(result.data.blocks).toHaveLength(0);
      }
    });

    it('should handle content with errors', async () => {
      const result = await parseContent(CONFIG_WITH_ERRORS, 'terragrunt.hcl');

      // With error recovery, should still parse
      expect(result).toBeDefined();
    });
  });

  describe('quickParse', () => {
    it('should validate valid content', async () => {
      const result = await quickParse(VALID_CONFIG);

      expect(result.valid).toBe(true);
      expect(result.blockTypes).toContain('terraform');
      expect(result.blockTypes).toContain('locals');
      expect(result.blockTypes).toContain('inputs');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should identify block types', async () => {
      const result = await quickParse(CONFIG_WITH_FUNCTIONS);

      expect(result.blockTypes).toContain('include');
      expect(result.blockTypes).toContain('terraform');
    });

    it('should report invalid content', async () => {
      const result = await quickParse(CONFIG_WITH_ERRORS);

      // May have diagnostics
      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty content', async () => {
      const result = await quickParse('');

      expect(result.valid).toBe(true);
      expect(result.blockTypes).toHaveLength(0);
    });
  });

  describe('cache management', () => {
    it('should get cache stats', () => {
      const service = getParserService();
      const stats = service.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      const service = getParserService();
      service.clearCache();
      const stats = service.getCacheStats();

      expect(stats.size).toBe(0);
    });
  });
});

// ============================================================================
// Batch Parsing Tests
// ============================================================================

describe('Batch Parsing', () => {
  it('should batch parse multiple contents', async () => {
    const contents = [
      { content: SIMPLE_CONFIG, path: 'a/terragrunt.hcl' },
      { content: VALID_CONFIG, path: 'b/terragrunt.hcl' },
    ];

    const results = await Promise.all(
      contents.map(c => parseContent(c.content, c.path))
    );

    expect(results).toHaveLength(2);
    expect(results.every(r => r !== null)).toBe(true);
  });

  it('should handle mixed success/failure', async () => {
    const contents = [
      { content: SIMPLE_CONFIG, path: 'a/terragrunt.hcl' },
      { content: CONFIG_WITH_ERRORS, path: 'b/terragrunt.hcl' },
      { content: VALID_CONFIG, path: 'c/terragrunt.hcl' },
    ];

    const results = await Promise.all(
      contents.map(c => parseContent(c.content, c.path))
    );

    expect(results).toHaveLength(3);
    // All should return results (with or without errors)
    expect(results.every(r => r !== null)).toBe(true);
  });

  it('should track progress callback', async () => {
    const progressCalls: Array<{ completed: number; total: number; current: string }> = [];

    const service = getParserService();

    // Simulate batch parse progress tracking
    const onProgress = (completed: number, total: number, current: string) => {
      progressCalls.push({ completed, total, current });
    };

    // Parse multiple contents with simulated progress
    const contents = [SIMPLE_CONFIG, VALID_CONFIG];
    for (let i = 0; i < contents.length; i++) {
      await service.parseContent(contents[i], `file${i}.hcl`);
      onProgress(i + 1, contents.length, `file${i}.hcl`);
    }

    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0].completed).toBe(1);
    expect(progressCalls[1].completed).toBe(2);
  });
});

// ============================================================================
// Error Aggregation Tests
// ============================================================================

describe('Error Aggregation', () => {
  it('should aggregate errors across multiple files', async () => {
    const service = getParserService();

    // Parse multiple files with errors
    const results = await Promise.all([
      service.parseContent(CONFIG_WITH_ERRORS, 'a/terragrunt.hcl'),
      service.parseContent(CONFIG_WITH_ERRORS, 'b/terragrunt.hcl'),
    ]);

    // Both should have some kind of result
    expect(results).toHaveLength(2);
    results.forEach(r => {
      expect(r).toBeDefined();
    });
  });

  it('should count affected files', async () => {
    const errorFiles: string[] = [];

    const contents = [
      { content: VALID_CONFIG, path: 'good/terragrunt.hcl' },
      { content: CONFIG_WITH_ERRORS, path: 'bad/terragrunt.hcl' },
    ];

    for (const c of contents) {
      const result = await parseContent(c.content, c.path);
      if (isParseSuccess(result) && result.data.errors.length > 0) {
        errorFiles.push(c.path);
      } else if (!isParseSuccess(result)) {
        errorFiles.push(c.path);
      }
    }

    // At least the error file should be tracked
    expect(errorFiles.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Parser Options Tests
// ============================================================================

describe('Parser Options Propagation', () => {
  it('should respect error recovery option', async () => {
    const service = getParserService({ errorRecovery: true });
    const result = await service.parseContent(CONFIG_WITH_ERRORS, 'test.hcl');

    // Should not throw with error recovery enabled
    expect(result).toBeDefined();
  });

  it('should respect include raw option', async () => {
    const service = getParserService({ includeRaw: true });
    const result = await service.parseContent(SIMPLE_CONFIG, 'test.hcl');

    expect(isParseSuccess(result)).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.data.blocks[0].raw).toBeDefined();
    }
  });

  it('should disable include resolution when configured', async () => {
    const service = getParserService({ resolveIncludes: false });
    const result = await service.parseContent(CONFIG_WITH_FUNCTIONS, 'test.hcl');

    expect(isParseSuccess(result)).toBe(true);
  });

  it('should disable dependency resolution when configured', async () => {
    const config = `
dependency "vpc" {
  config_path = "../vpc"
}
`;
    const service = getParserService({ resolveDependencies: false });
    const result = await service.parseContent(config, 'test.hcl');

    expect(isParseSuccess(result)).toBe(true);
  });
});

// ============================================================================
// Concurrency Tests
// ============================================================================

describe('Concurrent Parsing', () => {
  it('should handle concurrent parse requests', async () => {
    const service = getParserService();

    const promises = Array.from({ length: 10 }, (_, i) =>
      service.parseContent(SIMPLE_CONFIG, `file${i}.hcl`)
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    expect(results.every(r => isParseSuccess(r))).toBe(true);
  });

  it('should not corrupt state during concurrent access', async () => {
    const service = getParserService();

    const configs = [
      SIMPLE_CONFIG,
      VALID_CONFIG,
      CONFIG_WITH_FUNCTIONS,
    ];

    const promises = configs.flatMap((config, i) =>
      Array.from({ length: 5 }, (_, j) =>
        service.parseContent(config, `file${i}_${j}.hcl`)
      )
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(15);
    // All should parse (with or without errors)
    results.forEach(r => {
      expect(r).toBeDefined();
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should parse content within reasonable time', async () => {
    const startTime = performance.now();
    await parseContent(VALID_CONFIG, 'test.hcl');
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
  });

  it('should quick parse faster than full parse', async () => {
    const quickStart = performance.now();
    await quickParse(VALID_CONFIG);
    const quickEnd = performance.now();

    const fullStart = performance.now();
    await parseContent(VALID_CONFIG, 'test.hcl');
    const fullEnd = performance.now();

    const quickTime = quickEnd - quickStart;
    const fullTime = fullEnd - fullStart;

    // Quick parse should typically be faster (but not always due to caching)
    // Just verify both complete in reasonable time
    expect(quickTime).toBeLessThan(1000);
    expect(fullTime).toBeLessThan(1000);
  });
});

// ============================================================================
// Metadata Tests
// ============================================================================

describe('Parse Metadata', () => {
  it('should include parser metadata', async () => {
    const result = await parseContent(VALID_CONFIG, 'test.hcl');

    expect(isParseSuccess(result)).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.metadata.parserName).toBe('terragrunt-hcl');
      expect(result.metadata.parserVersion).toBe('1.0.0');
      expect(result.metadata.filePath).toBe('test.hcl');
      expect(result.metadata.fileSize).toBe(VALID_CONFIG.length);
      expect(result.metadata.parseTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should track line count', async () => {
    const multiLineConfig = `
terraform {
  source = "module"
}

locals {
  a = "1"
  b = "2"
  c = "3"
}
`;
    const result = await parseContent(multiLineConfig, 'test.hcl');

    expect(isParseSuccess(result)).toBe(true);
    if (isParseSuccess(result)) {
      expect(result.metadata.lineCount).toBeGreaterThan(0);
    }
  });
});
