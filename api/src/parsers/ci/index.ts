/**
 * GitLab CI Parser Module
 * @module parsers/ci
 *
 * Comprehensive GitLab CI/CD pipeline parsing and dependency detection.
 * Provides complete parsing of .gitlab-ci.yml files with:
 * - Pipeline structure extraction (stages, jobs, includes)
 * - Tool detection (Terraform, Helm, Kubernetes, Docker)
 * - Dependency graph generation (nodes and edges)
 * - Include resolution with circular dependency detection
 *
 * TASK-XREF-002: GitLab CI Parser - Main export barrel
 *
 * @example
 * ```typescript
 * import {
 *   GitLabCIParser,
 *   parseGitLabCI,
 *   createGitLabCIParser,
 * } from '@parsers/ci';
 *
 * const parser = createGitLabCIParser({ detectTerraform: true });
 * const result = await parser.parse(content, '.gitlab-ci.yml');
 *
 * if (result.success) {
 *   console.log(`Found ${result.data.nodes.length} nodes`);
 *   console.log(`Found ${result.data.edges.length} edges`);
 * }
 * ```
 */

// ============================================================================
// Types - All type exports from types.ts
// ============================================================================

export * from './types';

// ============================================================================
// Parser - Main GitLab CI parser
// ============================================================================

export {
  GitLabCIParser,
  createGitLabCIParser,
  parseGitLabCI,
} from './gitlab-ci-parser';

// ============================================================================
// Include Resolver - Include directive resolution
// ============================================================================

export {
  GitLabIncludeResolver,
  NodeFileSystemAdapter as DefaultFileSystemAdapter,
  DefaultHttpAdapter,
  createGitLabIncludeResolver,
  createGitLabIncludeResolverWithAdapters,
} from './gitlab-include-resolver';

export type {
  FileSystemAdapter,
  HttpAdapter,
  GitLabApiAdapter,
  ResolvedInclude,
  FailedInclude,
  CircularDependency,
  IncludeResolutionResult,
  GitLabIncludeResolverOptions,
  RawGitLabJob,
  ResolvedGitLabJob,
} from './gitlab-include-resolver';

// ============================================================================
// Tool Detector - IaC tool detection in jobs
// ============================================================================

export {
  GitLabToolDetector,
  detectToolsInJob,
  toGitLabTerraformDetectionInfo,
  toGitLabHelmDetectionInfo,
  createGitLabToolDetector,
  // Pattern constants
  TERRAFORM_PATTERNS,
  TERRAFORM_IMAGES,
  HELM_PATTERNS,
  HELM_IMAGES,
  TF_CLOUD_INDICATORS,
} from './gitlab-tool-detector';

export type {
  ToolDetectionResult,
  DetectedCommand,
  CommandMatch,
  CommandArgs,
  TerraformArgs,
  HelmArgs,
  TerraformJobInfo,
  HelmJobInfo,
  DetectionEvidence,
} from './gitlab-tool-detector';

// ============================================================================
// Node Factory - Graph node creation
// ============================================================================

export {
  GitLabNodeFactory,
  createGitLabNodeFactory,
  createGitLabNodes,
  createGitLabPipelineNode,
  createGitLabStageNode,
  createGitLabJobNode,
  GitLabPipelineNodeBuilder,
  GitLabStageNodeBuilder,
  GitLabJobNodeBuilder,
} from './gitlab-node-factory';

export type {
  GitLabNodeCreationResult,
} from './gitlab-node-factory';

// ============================================================================
// Edge Factory - Graph edge creation
// ============================================================================

export {
  GitLabEdgeFactory,
  createGitLabEdgeFactory,
  createGitLabEdges,
  // Type guards
  isGitLabStageOrderEdge,
  isGitLabNeedsEdge,
  isGitLabDependenciesEdge,
  isGitLabExtendsEdge,
  isGitLabIncludesEdge,
  isGitLabUsesTfEdge,
  isGitLabUsesHelmEdge,
  isGitLabArtifactFlowEdge,
  isTerraformToHelmFlowEdge,
} from './gitlab-edge-factory';

export type {
  GitLabEdgeEvidence,
  GitLabEdgeCreationResult,
} from './gitlab-edge-factory';

// ============================================================================
// Convenience Factory Functions
// ============================================================================

import { GitLabCIParser } from './gitlab-ci-parser';
import { GitLabCIParserOptions, GitLabCIParseResult } from './types';
import { ParseResult, ParserOptions } from '../base/parser';

/**
 * Create a fully configured GitLab CI parser with default options.
 *
 * This is the simplest way to create a parser - it uses all default
 * settings optimized for common use cases.
 *
 * @param options - Optional parser options to override defaults
 * @returns Configured GitLabCIParser instance
 *
 * @example
 * ```typescript
 * // Use all defaults
 * const parser = createDefaultGitLabCIParser();
 *
 * // Override specific options
 * const parser = createDefaultGitLabCIParser({
 *   detectTerraform: true,
 *   detectHelm: true,
 *   resolveIncludes: false,
 * });
 * ```
 */
export function createDefaultGitLabCIParser(
  options?: Partial<GitLabCIParserOptions>
): GitLabCIParser {
  return new GitLabCIParser({
    errorRecovery: true,
    detectTerraform: true,
    detectHelm: true,
    resolveExtends: true,
    ...options,
  });
}

/**
 * Parse a GitLab CI configuration file with a throwing interface.
 *
 * Unlike the regular parse methods, this function throws an error
 * if parsing fails, making it easier to use in async/await code
 * where you want to handle failures with try/catch.
 *
 * @param content - YAML content of the .gitlab-ci.yml file
 * @param filePath - Path to the file (for error reporting)
 * @param options - Optional parser options
 * @returns Parsed result data (throws if parsing fails)
 * @throws Error if parsing fails
 *
 * @example
 * ```typescript
 * try {
 *   const result = await parseGitLabCIOrThrow(content, '.gitlab-ci.yml');
 *   console.log(`Found ${result.pipeline?.jobs.size} jobs`);
 * } catch (error) {
 *   console.error('Parsing failed:', error.message);
 * }
 * ```
 */
export async function parseGitLabCIOrThrow(
  content: string,
  filePath: string,
  options?: Partial<GitLabCIParserOptions & ParserOptions>
): Promise<GitLabCIParseResult> {
  const parser = new GitLabCIParser(options);
  const result = await parser.parse(content, filePath, options);

  if (!result.success) {
    const errorMessages = result.diagnostics
      ?.filter(d => d.severity === 'fatal' || d.severity === 'error')
      .map(d => d.message)
      .join('; ');
    throw new Error(`Failed to parse GitLab CI: ${errorMessages || 'Unknown error'}`);
  }

  return result.data!;
}

/**
 * Quick check if content appears to be a GitLab CI configuration.
 *
 * This is a fast heuristic check that looks for common GitLab CI
 * patterns without doing a full parse. Useful for filtering files
 * before attempting to parse them.
 *
 * @param content - File content to check
 * @returns True if content looks like GitLab CI configuration
 *
 * @example
 * ```typescript
 * if (isGitLabCIContent(fileContent)) {
 *   const result = await parseGitLabCI(fileContent, filePath);
 * }
 * ```
 */
export function isGitLabCIContent(content: string): boolean {
  // Check for common GitLab CI patterns
  return (
    /^stages:/m.test(content) ||
    /^include:/m.test(content) ||
    /^\.[a-zA-Z_-]+:/m.test(content) || // Hidden jobs
    (/^[a-zA-Z_-]+:/m.test(content) && /\bscript:/m.test(content)) ||
    /^default:/m.test(content) ||
    /^workflow:/m.test(content) ||
    (/^variables:/m.test(content) && /\bstages:/m.test(content))
  );
}

/**
 * Quick check if a file path appears to be a GitLab CI configuration.
 *
 * @param filePath - File path to check
 * @returns True if path looks like GitLab CI configuration file
 *
 * @example
 * const files = await glob('**\/*.yml');
 * const ciFiles = files.filter(isGitLabCIFilePath);
 */
export function isGitLabCIFilePath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const fileName = normalizedPath.split('/').pop() ?? '';

  // Direct match for .gitlab-ci.yml
  if (fileName === '.gitlab-ci.yml' || fileName === '.gitlab-ci.yaml') {
    return true;
  }

  // Files in .gitlab/ci/ directory
  if (normalizedPath.includes('.gitlab/ci/') ||
      normalizedPath.includes('gitlab-ci/') ||
      normalizedPath.includes('/ci/')) {
    return fileName.endsWith('.yml') || fileName.endsWith('.yaml');
  }

  return false;
}

// ============================================================================
// Re-export common types for convenience
// ============================================================================

export type {
  // From base parser
  ParseResult,
  ParserOptions,
} from '../base/parser';

export type {
  // From graph types
  BaseNode,
  NodeLocation,
  GraphEdge,
  EdgeMetadata,
  EdgeEvidence,
} from '../../types/graph';
