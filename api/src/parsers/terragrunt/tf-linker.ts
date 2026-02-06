/**
 * Terraform Source Linker
 * @module parsers/terragrunt/tf-linker
 *
 * TASK-TG-008: Resolves Terraform source references from Terragrunt configs.
 *
 * This module implements the TG -> TF graph integration via the tg_sources edge type.
 * It parses terraform.source expressions and resolves them to:
 * 1. Existing TerraformModuleNode in the graph (local paths)
 * 2. Synthetic TerraformModuleNode for external modules (registry, git, s3, etc.)
 *
 * Supported Source Types:
 * - local: Relative or absolute paths (./modules/vpc, /path/to/module)
 * - registry: Terraform Registry (hashicorp/consul/aws, registry.terraform.io/...)
 * - git: Git URLs (git::https://..., git@github.com:..., *.git)
 * - github: GitHub URLs (github.com/...)
 * - s3: S3 buckets (s3::...)
 * - gcs: Google Cloud Storage (gcs::...)
 * - http: HTTP URLs (https://..., http://...)
 *
 * Design Principles:
 * - Pure functions where possible (no side effects)
 * - Type-safe source parsing with discriminated unions
 * - Support for version constraints and git refs
 * - Synthetic node creation for external sources
 * - Integration with existing node/edge factory patterns
 */

import * as path from 'path';
import { randomUUID } from 'crypto';
import { TerraformModuleNode, NodeLocation } from '../../types/graph';
import {
  SourceResolutionError,
  wrapSourceError,
  canContinueAfterEdgeError,
} from './errors';

// ============================================================================
// Source Expression Types
// ============================================================================

/**
 * Type of Terraform module source.
 * Covers all source types supported by Terraform/Terragrunt.
 */
export type TerraformSourceType =
  | 'local'
  | 'registry'
  | 'git'
  | 'github'
  | 's3'
  | 'gcs'
  | 'http'
  | 'unknown';

/**
 * Parsed Terraform source expression.
 * Provides structured access to source components for linking.
 */
export interface TerraformSourceExpression {
  /** Original raw source string */
  readonly raw: string;
  /** Detected source type */
  readonly type: TerraformSourceType;
  /** Local path (for local type) or subdirectory (for remote types) */
  readonly path?: string;
  /** Registry address (for registry type) */
  readonly registry?: string;
  /** Git URL (for git/github types) */
  readonly gitUrl?: string;
  /** Git ref (branch, tag, commit) */
  readonly ref?: string;
  /** Subdirectory within the source (// syntax) */
  readonly subdir?: string;
  /** Version constraint (for registry sources) */
  readonly version?: string;
  /** Bucket name (for s3/gcs types) */
  readonly bucket?: string;
  /** HTTP URL (for http type) */
  readonly httpUrl?: string;
}

// ============================================================================
// Context and Result Types
// ============================================================================

/**
 * Context for resolving Terraform source references.
 * Provides the necessary context for path resolution and node lookup.
 */
export interface TfLinkerContext {
  /** Unique identifier for the current scan */
  readonly scanId: string;
  /** Tenant ID for multi-tenant isolation */
  readonly tenantId: string;
  /** Path to the terragrunt.hcl file containing the source */
  readonly configPath: string;
  /** Root directory of the repository */
  readonly repositoryRoot: string;
  /** Map of existing TF module paths to node IDs */
  readonly existingTfModules: Map<string, string>;
}

/**
 * Result of resolving a Terraform source.
 * Contains either a reference to an existing node or a synthetic node.
 */
export interface TfLinkerResult {
  /** ID of the target node (existing or synthetic) */
  readonly targetNodeId: string;
  /** Whether the target is a synthetic (generated) node */
  readonly isSynthetic: boolean;
  /** Synthetic node if one was created */
  readonly syntheticNode?: TerraformModuleNode;
  /** Detected source type */
  readonly sourceType: TerraformSourceType;
  /** Resolved local path (if local type) */
  readonly resolvedPath?: string;
  /** Whether resolution was successful */
  readonly success: boolean;
  /** Error message if resolution failed */
  readonly error?: string;
}

/**
 * Options for creating a TerraformLinker.
 */
export interface TfLinkerOptions {
  /** Custom ID generator for synthetic nodes */
  readonly idGenerator?: () => string;
  /** Whether to normalize paths for comparison */
  readonly normalizePaths?: boolean;
}

// ============================================================================
// Source Pattern Definitions
// ============================================================================

/**
 * Regular expression patterns for detecting source types.
 * Ordered from most specific to least specific.
 */
export const SOURCE_PATTERNS = {
  /** Local path: starts with ./, ../, or / */
  local: /^(\.\.?\/|\/)/,
  /** Terraform Registry: namespace/name/provider or registry.terraform.io */
  registry: /^([a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+|registry\.terraform\.io\/)/i,
  /** Git protocol: git::, .git suffix, or git@ prefix */
  git: /^git::|\.git(\/|$|\?)|^git@/,
  /** GitHub URLs */
  github: /github\.com/i,
  /** S3 bucket: s3:: prefix */
  s3: /^s3::/,
  /** GCS bucket: gcs:: prefix */
  gcs: /^gcs::/,
  /** HTTP/HTTPS URLs (must check after git/github) */
  http: /^https?:\/\//i,
} as const;

/**
 * Pattern for extracting subdirectory from source (// syntax).
 */
const SUBDIR_PATTERN = /\/\/([^?]+)/;

/**
 * Pattern for extracting git ref from URL (?ref=...).
 */
const REF_PATTERN = /[?&]ref=([^&]+)/;

/**
 * Pattern for extracting version from URL (?version=...).
 */
const VERSION_PATTERN = /[?&]version=([^&]+)/;

/**
 * Pattern for parsing registry module source.
 * Format: namespace/name/provider or namespace/name/provider//subdir
 */
const REGISTRY_PATTERN = /^([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)/i;

/**
 * Pattern for extracting S3 bucket and key.
 * Format: s3::https://s3-region.amazonaws.com/bucket/key
 */
const S3_PATTERN = /^s3::https?:\/\/[^/]+\/([^/]+)\/(.+)/;

/**
 * Pattern for extracting GCS bucket and object.
 * Format: gcs::https://www.googleapis.com/storage/v1/bucket/object
 */
const GCS_PATTERN = /^gcs::https?:\/\/[^/]+\/storage\/v1\/([^/]+)\/(.+)/;

// ============================================================================
// ITerraformLinker Interface
// ============================================================================

/**
 * Interface for resolving Terraform source references.
 *
 * This interface defines the contract for linking Terragrunt configurations
 * to their Terraform module sources, supporting both local and external modules.
 *
 * @example
 * ```typescript
 * const linker = createTerraformLinker();
 *
 * // Parse a source expression
 * const source = linker.parseSource('git::git@github.com:org/modules.git//vpc?ref=v1.0.0');
 * console.log(source.type);   // => 'git'
 * console.log(source.gitUrl); // => 'git@github.com:org/modules.git'
 * console.log(source.subdir); // => 'vpc'
 * console.log(source.ref);    // => 'v1.0.0'
 *
 * // Check if external
 * if (linker.isExternal(source)) {
 *   console.log('This source requires a synthetic node');
 * }
 *
 * // Resolve to a graph node
 * const result = linker.resolve(source, context);
 * if (result.isSynthetic) {
 *   // Add synthetic node to graph
 *   graph.nodes.set(result.targetNodeId, result.syntheticNode!);
 * }
 * ```
 */
export interface ITerraformLinker {
  /**
   * Resolve a parsed source to a graph node reference.
   *
   * For local sources, attempts to find an existing TerraformModuleNode.
   * For external sources, creates a synthetic node.
   *
   * @param source - Parsed source expression
   * @param context - Resolution context with existing module map
   * @returns Resolution result with target node ID
   */
  resolve(source: TerraformSourceExpression, context: TfLinkerContext): TfLinkerResult;

  /**
   * Check if a source expression refers to an external module.
   *
   * External modules are those that cannot be resolved to a local path,
   * including registry, git, s3, gcs, and http sources.
   *
   * @param source - Parsed source expression
   * @returns true if the source is external
   */
  isExternal(source: TerraformSourceExpression): boolean;

  /**
   * Parse a raw source string into a structured expression.
   *
   * Detects the source type and extracts relevant components like
   * git URLs, refs, subdirectories, and version constraints.
   *
   * @param raw - Raw source string from terraform.source
   * @returns Parsed source expression
   */
  parseSource(raw: string): TerraformSourceExpression;
}

// ============================================================================
// TerraformLinker Implementation
// ============================================================================

/**
 * Implementation of ITerraformLinker.
 *
 * Provides comprehensive support for resolving Terraform module sources
 * from Terragrunt configurations to graph nodes.
 */
export class TerraformLinker implements ITerraformLinker {
  private readonly idGenerator: () => string;
  private readonly normalizePaths: boolean;

  constructor(options: TfLinkerOptions = {}) {
    this.idGenerator = options.idGenerator ?? (() => randomUUID());
    this.normalizePaths = options.normalizePaths ?? true;
  }

  /**
   * Resolve a source expression to a graph node reference.
   */
  resolve(source: TerraformSourceExpression, context: TfLinkerContext): TfLinkerResult {
    // Handle local sources
    if (source.type === 'local') {
      return this.resolveLocalSource(source, context);
    }

    // Handle external sources
    return this.resolveExternalSource(source, context);
  }

  /**
   * Check if source is external.
   */
  isExternal(source: TerraformSourceExpression): boolean {
    return source.type !== 'local';
  }

  /**
   * Parse raw source string.
   */
  parseSource(raw: string): TerraformSourceExpression {
    const trimmed = raw.trim();

    // Detect source type
    const type = this.detectSourceType(trimmed);

    // Extract common components
    const subdir = this.extractSubdir(trimmed);
    const ref = this.extractRef(trimmed);
    const version = this.extractVersion(trimmed);

    // Build type-specific expression
    switch (type) {
      case 'local':
        return this.parseLocalSource(trimmed);

      case 'registry':
        return this.parseRegistrySource(trimmed, subdir, version);

      case 'git':
        return this.parseGitSource(trimmed, subdir, ref);

      case 'github':
        return this.parseGitHubSource(trimmed, subdir, ref);

      case 's3':
        return this.parseS3Source(trimmed, subdir);

      case 'gcs':
        return this.parseGcsSource(trimmed, subdir);

      case 'http':
        return this.parseHttpSource(trimmed, subdir);

      default:
        return {
          raw: trimmed,
          type: 'unknown',
          subdir,
        };
    }
  }

  // ============================================================================
  // Private Resolution Methods
  // ============================================================================

  /**
   * Resolve a local source to an existing module or create error.
   */
  private resolveLocalSource(
    source: TerraformSourceExpression,
    context: TfLinkerContext
  ): TfLinkerResult {
    if (!source.path) {
      const error = SourceResolutionError.unresolvable(
        source.raw,
        'local',
        'Local source has no path',
        { configPath: context.configPath }
      );
      return {
        targetNodeId: '',
        isSynthetic: false,
        sourceType: 'local',
        success: false,
        error: error.message,
      };
    }

    // Resolve the path relative to the config file
    const configDir = path.dirname(context.configPath);
    const resolvedPath = this.normalizePaths
      ? path.normalize(path.resolve(configDir, source.path))
      : path.resolve(configDir, source.path);

    // Look up existing module by path
    const existingId = context.existingTfModules.get(resolvedPath);

    if (existingId) {
      return {
        targetNodeId: existingId,
        isSynthetic: false,
        sourceType: 'local',
        resolvedPath,
        success: true,
      };
    }

    // Try with relative path from repo root
    const relativeFromRoot = path.relative(context.repositoryRoot, resolvedPath);
    const existingIdByRelative = context.existingTfModules.get(relativeFromRoot);

    if (existingIdByRelative) {
      return {
        targetNodeId: existingIdByRelative,
        isSynthetic: false,
        sourceType: 'local',
        resolvedPath,
        success: true,
      };
    }

    // Create synthetic node for local module not found in graph
    // This can happen if the TF module wasn't scanned yet
    const syntheticNode = this.createSyntheticNode(
      source,
      context,
      resolvedPath
    );

    return {
      targetNodeId: syntheticNode.id,
      isSynthetic: true,
      syntheticNode,
      sourceType: 'local',
      resolvedPath,
      success: true,
    };
  }

  /**
   * Resolve an external source by creating a synthetic node.
   */
  private resolveExternalSource(
    source: TerraformSourceExpression,
    context: TfLinkerContext
  ): TfLinkerResult {
    const syntheticNode = this.createSyntheticNode(source, context);

    return {
      targetNodeId: syntheticNode.id,
      isSynthetic: true,
      syntheticNode,
      sourceType: source.type,
      success: true,
    };
  }

  /**
   * Create a synthetic TerraformModuleNode for external or unresolved sources.
   */
  private createSyntheticNode(
    source: TerraformSourceExpression,
    context: TfLinkerContext,
    resolvedPath?: string
  ): TerraformModuleNode {
    const nodeId = this.idGenerator();
    const nodeName = this.deriveModuleName(source);

    // Determine location based on source type
    const location: NodeLocation = {
      file: resolvedPath ?? source.raw,
      lineStart: 0,
      lineEnd: 0,
    };

    return {
      id: nodeId,
      type: 'terraform_module',
      name: nodeName,
      location,
      metadata: {
        synthetic: true,
        scanId: context.scanId,
        tenantId: context.tenantId,
        sourceExpression: source.raw,
        ...(source.ref && { gitRef: source.ref }),
        ...(source.version && { versionConstraint: source.version }),
        ...(source.registry && { registryAddress: source.registry }),
        ...(source.bucket && { bucket: source.bucket }),
      },
      source: source.raw,
      sourceType: source.type,
      version: source.version,
      providers: {},
    };
  }

  /**
   * Derive a human-readable module name from source expression.
   */
  private deriveModuleName(source: TerraformSourceExpression): string {
    switch (source.type) {
      case 'local':
        // Use the last path segment
        return source.path
          ? path.basename(source.path)
          : 'unknown-local';

      case 'registry':
        // Use the module name from registry address
        if (source.registry) {
          const parts = source.registry.split('/');
          return parts.length >= 2 ? parts[1] : source.registry;
        }
        return 'unknown-registry';

      case 'git':
      case 'github':
        // Extract repo name from git URL
        if (source.gitUrl) {
          const match = source.gitUrl.match(/\/([^/]+?)(\.git)?$/);
          if (match) {
            return match[1];
          }
        }
        return source.subdir || 'unknown-git';

      case 's3':
      case 'gcs':
        // Use bucket and key
        if (source.bucket) {
          return source.subdir
            ? `${source.bucket}/${source.subdir}`
            : source.bucket;
        }
        return `unknown-${source.type}`;

      case 'http':
        // Extract filename from URL
        if (source.httpUrl) {
          const url = new URL(source.httpUrl);
          const pathParts = url.pathname.split('/').filter(Boolean);
          return pathParts.length > 0
            ? pathParts[pathParts.length - 1]
            : 'unknown-http';
        }
        return 'unknown-http';

      default:
        return 'unknown-module';
    }
  }

  // ============================================================================
  // Private Parsing Methods
  // ============================================================================

  /**
   * Detect the source type from a raw string.
   */
  private detectSourceType(raw: string): TerraformSourceType {
    // Order matters - more specific patterns first
    if (SOURCE_PATTERNS.local.test(raw)) {
      return 'local';
    }
    if (SOURCE_PATTERNS.s3.test(raw)) {
      return 's3';
    }
    if (SOURCE_PATTERNS.gcs.test(raw)) {
      return 'gcs';
    }
    if (SOURCE_PATTERNS.git.test(raw)) {
      return 'git';
    }
    if (SOURCE_PATTERNS.github.test(raw)) {
      return 'github';
    }
    if (SOURCE_PATTERNS.registry.test(raw)) {
      return 'registry';
    }
    if (SOURCE_PATTERNS.http.test(raw)) {
      return 'http';
    }
    return 'unknown';
  }

  /**
   * Extract subdirectory from source (// syntax).
   */
  private extractSubdir(raw: string): string | undefined {
    const match = raw.match(SUBDIR_PATTERN);
    return match ? match[1].split('?')[0] : undefined;
  }

  /**
   * Extract git ref from source.
   */
  private extractRef(raw: string): string | undefined {
    const match = raw.match(REF_PATTERN);
    return match ? match[1] : undefined;
  }

  /**
   * Extract version constraint from source.
   */
  private extractVersion(raw: string): string | undefined {
    const match = raw.match(VERSION_PATTERN);
    return match ? match[1] : undefined;
  }

  /**
   * Parse a local source path.
   */
  private parseLocalSource(raw: string): TerraformSourceExpression {
    // Remove any query parameters
    const cleanPath = raw.split('?')[0];

    return {
      raw,
      type: 'local',
      path: cleanPath,
    };
  }

  /**
   * Parse a Terraform Registry source.
   */
  private parseRegistrySource(
    raw: string,
    subdir?: string,
    version?: string
  ): TerraformSourceExpression {
    // Handle registry.terraform.io prefix
    const normalized = raw.replace(/^registry\.terraform\.io\//, '');

    // Extract namespace/name/provider
    const match = normalized.match(REGISTRY_PATTERN);
    const registry = match
      ? `${match[1]}/${match[2]}/${match[3]}`
      : normalized.split('//')[0].split('?')[0];

    return {
      raw,
      type: 'registry',
      registry,
      subdir,
      version,
    };
  }

  /**
   * Parse a Git source URL.
   */
  private parseGitSource(
    raw: string,
    subdir?: string,
    ref?: string
  ): TerraformSourceExpression {
    // Remove git:: prefix if present
    let gitUrl = raw.replace(/^git::/, '');

    // Remove subdirectory and query params for URL extraction
    gitUrl = gitUrl.split('//')[0].split('?')[0];

    return {
      raw,
      type: 'git',
      gitUrl,
      subdir,
      ref,
    };
  }

  /**
   * Parse a GitHub source URL.
   */
  private parseGitHubSource(
    raw: string,
    subdir?: string,
    ref?: string
  ): TerraformSourceExpression {
    // Extract the GitHub URL
    let gitUrl = raw.split('//')[0].split('?')[0];

    // Ensure .git suffix for consistency
    if (!gitUrl.endsWith('.git')) {
      gitUrl = gitUrl + '.git';
    }

    return {
      raw,
      type: 'github',
      gitUrl,
      subdir,
      ref,
    };
  }

  /**
   * Parse an S3 source URL.
   */
  private parseS3Source(
    raw: string,
    subdir?: string
  ): TerraformSourceExpression {
    const match = raw.match(S3_PATTERN);
    const bucket = match ? match[1] : undefined;
    const objectPath = match ? match[2] : undefined;

    return {
      raw,
      type: 's3',
      bucket,
      path: objectPath,
      subdir,
    };
  }

  /**
   * Parse a GCS source URL.
   */
  private parseGcsSource(
    raw: string,
    subdir?: string
  ): TerraformSourceExpression {
    const match = raw.match(GCS_PATTERN);
    const bucket = match ? match[1] : undefined;
    const objectPath = match ? match[2] : undefined;

    return {
      raw,
      type: 'gcs',
      bucket,
      path: objectPath,
      subdir,
    };
  }

  /**
   * Parse an HTTP source URL.
   */
  private parseHttpSource(
    raw: string,
    subdir?: string
  ): TerraformSourceExpression {
    // Extract URL without subdir or query params
    const httpUrl = raw.split('//')[0].split('?')[0];

    return {
      raw,
      type: 'http',
      httpUrl,
      subdir,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new TerraformLinker instance.
 *
 * @param options - Configuration options
 * @returns New ITerraformLinker instance
 *
 * @example
 * ```typescript
 * const linker = createTerraformLinker({
 *   normalizePaths: true,
 *   idGenerator: () => `tf-${crypto.randomUUID()}`,
 * });
 * ```
 */
export function createTerraformLinker(
  options: TfLinkerOptions = {}
): ITerraformLinker {
  return new TerraformLinker(options);
}

/**
 * Parse a Terraform source string without creating a linker.
 * Convenience function for one-off parsing.
 *
 * @param raw - Raw source string
 * @returns Parsed source expression
 */
export function parseSource(raw: string): TerraformSourceExpression {
  const linker = new TerraformLinker();
  return linker.parseSource(raw);
}

/**
 * Check if a source string is external.
 * Convenience function for one-off checks.
 *
 * @param raw - Raw source string
 * @returns true if external
 */
export function isExternalSource(raw: string): boolean {
  const linker = new TerraformLinker();
  const source = linker.parseSource(raw);
  return linker.isExternal(source);
}

/**
 * Detect the source type from a raw string.
 * Convenience function for one-off type detection.
 *
 * @param raw - Raw source string
 * @returns Detected source type
 */
export function detectSourceType(raw: string): TerraformSourceType {
  const linker = new TerraformLinker();
  return linker.parseSource(raw).type;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a linker context from common parameters.
 *
 * @param scanId - Scan identifier
 * @param tenantId - Tenant identifier
 * @param configPath - Path to terragrunt.hcl
 * @param repositoryRoot - Repository root path
 * @param existingModules - Optional map of existing modules
 * @returns Linker context
 */
export function createLinkerContext(
  scanId: string,
  tenantId: string,
  configPath: string,
  repositoryRoot: string,
  existingModules?: Map<string, string>
): TfLinkerContext {
  return {
    scanId,
    tenantId,
    configPath,
    repositoryRoot,
    existingTfModules: existingModules ?? new Map(),
  };
}

/**
 * Build a module map from an array of TerraformModuleNode.
 *
 * @param modules - Array of module nodes
 * @returns Map from file path to node ID
 */
export function buildModuleMap(
  modules: ReadonlyArray<Pick<TerraformModuleNode, 'id' | 'location'>>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const module of modules) {
    if (module.location?.file) {
      map.set(module.location.file, module.id);
    }
  }

  return map;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for local source expressions.
 */
export function isLocalSource(
  source: TerraformSourceExpression
): source is TerraformSourceExpression & { type: 'local'; path: string } {
  return source.type === 'local' && typeof source.path === 'string';
}

/**
 * Type guard for registry source expressions.
 */
export function isRegistrySource(
  source: TerraformSourceExpression
): source is TerraformSourceExpression & { type: 'registry'; registry: string } {
  return source.type === 'registry' && typeof source.registry === 'string';
}

/**
 * Type guard for git source expressions (includes github).
 */
export function isGitSource(
  source: TerraformSourceExpression
): source is TerraformSourceExpression & { type: 'git' | 'github'; gitUrl: string } {
  return (source.type === 'git' || source.type === 'github') &&
    typeof source.gitUrl === 'string';
}

/**
 * Type guard for S3 source expressions.
 */
export function isS3Source(
  source: TerraformSourceExpression
): source is TerraformSourceExpression & { type: 's3'; bucket: string } {
  return source.type === 's3' && typeof source.bucket === 'string';
}

/**
 * Type guard for GCS source expressions.
 */
export function isGcsSource(
  source: TerraformSourceExpression
): source is TerraformSourceExpression & { type: 'gcs'; bucket: string } {
  return source.type === 'gcs' && typeof source.bucket === 'string';
}

/**
 * Type guard for HTTP source expressions.
 */
export function isHttpSource(
  source: TerraformSourceExpression
): source is TerraformSourceExpression & { type: 'http'; httpUrl: string } {
  return source.type === 'http' && typeof source.httpUrl === 'string';
}

/**
 * Type guard for successful resolution results.
 */
export function isSuccessfulResolution(
  result: TfLinkerResult
): result is TfLinkerResult & { success: true; targetNodeId: string } {
  return result.success === true && typeof result.targetNodeId === 'string' && result.targetNodeId !== '';
}

/**
 * Type guard for synthetic resolution results.
 */
export function isSyntheticResolution(
  result: TfLinkerResult
): result is TfLinkerResult & { isSynthetic: true; syntheticNode: TerraformModuleNode } {
  return result.isSynthetic === true && result.syntheticNode !== undefined;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate linker context.
 *
 * @param context - Context to validate
 * @throws SourceResolutionError if context is invalid
 */
export function validateLinkerContext(context: TfLinkerContext): void {
  if (!context.scanId || typeof context.scanId !== 'string') {
    throw SourceResolutionError.missingContext('scanId');
  }
  if (!context.tenantId || typeof context.tenantId !== 'string') {
    throw SourceResolutionError.missingContext('tenantId');
  }
  if (!context.configPath || typeof context.configPath !== 'string') {
    throw SourceResolutionError.missingContext('configPath');
  }
  if (!context.repositoryRoot || typeof context.repositoryRoot !== 'string') {
    throw SourceResolutionError.missingContext('repositoryRoot');
  }
  if (!(context.existingTfModules instanceof Map)) {
    throw SourceResolutionError.invalidOptions('existingTfModules', 'must be a Map');
  }
}

/**
 * Validate linker options.
 *
 * @param options - Options to validate
 * @throws SourceResolutionError if options are invalid
 */
export function validateLinkerOptions(options: TfLinkerOptions): void {
  if (options.idGenerator !== undefined && typeof options.idGenerator !== 'function') {
    throw SourceResolutionError.invalidOptions('idGenerator', 'must be a function');
  }
  if (options.normalizePaths !== undefined && typeof options.normalizePaths !== 'boolean') {
    throw SourceResolutionError.invalidOptions('normalizePaths', 'must be a boolean');
  }
}
