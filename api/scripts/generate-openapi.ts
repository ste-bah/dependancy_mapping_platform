#!/usr/bin/env tsx
/**
 * OpenAPI Specification Generator
 * @module scripts/generate-openapi
 *
 * Generates OpenAPI specification files (JSON and YAML) from the
 * running Fastify application's swagger configuration.
 *
 * TASK-FINAL-004: Documentation and Beta Launch
 *
 * Usage:
 *   npm run openapi:generate
 *   tsx scripts/generate-openapi.ts
 *   tsx scripts/generate-openapi.ts --json-only
 *   tsx scripts/generate-openapi.ts --output ./custom/path
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { stringify as yamlStringify } from 'yaml';

// ============================================================================
// Types
// ============================================================================

interface GenerateOptions {
  outputDir: string;
  jsonOnly: boolean;
  yamlOnly: boolean;
  verbose: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_OUTPUT_DIR = resolve(dirname(new URL(import.meta.url).pathname), '../../docs/api');

// ============================================================================
// Helpers
// ============================================================================

function parseArgs(): GenerateOptions {
  const args = process.argv.slice(2);

  const options: GenerateOptions = {
    outputDir: DEFAULT_OUTPUT_DIR,
    jsonOnly: false,
    yamlOnly: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--output' || arg === '-o') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options.outputDir = resolve(process.cwd(), nextArg);
        i++;
      }
    } else if (arg === '--json-only') {
      options.jsonOnly = true;
    } else if (arg === '--yaml-only') {
      options.yamlOnly = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
OpenAPI Specification Generator

Usage:
  tsx scripts/generate-openapi.ts [options]

Options:
  -o, --output <dir>   Output directory (default: docs/api)
  --json-only          Generate only JSON format
  --yaml-only          Generate only YAML format
  -v, --verbose        Enable verbose output
  -h, --help           Show this help message

Examples:
  tsx scripts/generate-openapi.ts
  tsx scripts/generate-openapi.ts --output ./specs
  tsx scripts/generate-openapi.ts --json-only
`);
}

function ensureDirectory(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function log(message: string, verbose: boolean = false): void {
  if (!verbose || process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.log(message);
  }
}

// ============================================================================
// Application Builder (Minimal Version for Spec Generation)
// ============================================================================

async function buildMinimalApp() {
  // Dynamic imports to avoid loading all dependencies at module level
  const Fastify = (await import('fastify')).default;
  const swaggerPlugin = (await import('../src/plugins/swagger.js')).default;

  const app = Fastify({
    logger: false,
  });

  // Register swagger plugin with default options
  await app.register(swaggerPlugin, {
    exposeRoute: false, // Don't need UI routes for spec generation
  });

  // Import and register routes to get all schemas
  // We need to import routes but with minimal middleware
  try {
    const routes = (await import('../src/routes/index.js')).default;
    await app.register(routes);
  } catch (error) {
    // If routes fail to load (e.g., missing db connection),
    // we'll still have the base swagger spec
    console.warn('Warning: Could not load routes - generating base spec only');
    console.warn(`  Reason: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return app;
}

// ============================================================================
// Main
// ============================================================================

async function generateOpenAPI(): Promise<void> {
  const options = parseArgs();

  console.log('OpenAPI Specification Generator');
  console.log('================================\n');

  log(`Output directory: ${options.outputDir}`, true);

  // Ensure output directory exists
  ensureDirectory(options.outputDir);

  console.log('Building application...');

  let app;
  try {
    app = await buildMinimalApp();
    await app.ready();
  } catch (error) {
    console.error('Failed to build application:', error instanceof Error ? error.message : error);
    console.log('\nTrying alternative approach with full app...');

    // Try with the full buildApp function
    try {
      const { buildApp } = await import('../src/app.js');
      app = await buildApp({ logger: false });

      // Register swagger if not already registered
      const swaggerPlugin = (await import('../src/plugins/swagger.js')).default;
      await app.register(swaggerPlugin, { exposeRoute: false });

      await app.ready();
    } catch (fullAppError) {
      console.error('Failed to build full application:', fullAppError instanceof Error ? fullAppError.message : fullAppError);
      process.exit(1);
    }
  }

  console.log('Generating OpenAPI specification...\n');

  // Get the swagger specification
  const spec = app.swagger();

  // Generate JSON file
  if (!options.yamlOnly) {
    const jsonPath = resolve(options.outputDir, 'openapi.json');
    const jsonContent = JSON.stringify(spec, null, 2);
    writeFileSync(jsonPath, jsonContent, 'utf-8');
    console.log(`  Created: ${jsonPath}`);
    log(`    Size: ${(jsonContent.length / 1024).toFixed(2)} KB`, true);
  }

  // Generate YAML file
  if (!options.jsonOnly) {
    const yamlPath = resolve(options.outputDir, 'openapi.yaml');
    const yamlContent = yamlStringify(spec, {
      lineWidth: 120,
      minContentWidth: 20,
    });
    writeFileSync(yamlPath, yamlContent, 'utf-8');
    console.log(`  Created: ${yamlPath}`);
    log(`    Size: ${(yamlContent.length / 1024).toFixed(2)} KB`, true);
  }

  // Generate summary
  console.log('\nSpecification Summary:');
  console.log('----------------------');

  const info = spec as { info?: { title?: string; version?: string }; paths?: Record<string, unknown>; tags?: unknown[] };
  console.log(`  Title: ${info.info?.title ?? 'Unknown'}`);
  console.log(`  Version: ${info.info?.version ?? 'Unknown'}`);
  console.log(`  Paths: ${Object.keys(info.paths ?? {}).length}`);
  console.log(`  Tags: ${(info.tags as unknown[])?.length ?? 0}`);

  // Count operations
  let operationCount = 0;
  const paths = info.paths ?? {};
  for (const path of Object.values(paths)) {
    const pathItem = path as Record<string, unknown>;
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']) {
      if (pathItem[method]) {
        operationCount++;
      }
    }
  }
  console.log(`  Operations: ${operationCount}`);

  // Close the app
  await app.close();

  console.log('\nOpenAPI specification generated successfully!');
}

// ============================================================================
// Entry Point
// ============================================================================

generateOpenAPI().catch((error) => {
  console.error('Failed to generate OpenAPI specification:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
