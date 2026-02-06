/**
 * GitLab CI Include Resolver
 * @module parsers/ci/gitlab-include-resolver
 *
 * Resolves GitLab CI include directives and extends inheritance.
 * Handles all 4 include types: local, template, remote, project.
 * Supports circular dependency detection and deep merge for extends.
 *
 * TASK-GITLAB-004: Include Resolution
 * TASK-GITLAB-005: Extends Inheritance Resolution
 */

import * as path from 'path';
import * as yaml from 'yaml';
import {
  GitLabInclude,
  GitLabLocalInclude,
  GitLabTemplateInclude,
  GitLabRemoteInclude,
  GitLabProjectInclude,
  GitLabFileInclude,
  GitLabComponentInclude,
  GitLabJob,
  GitLabCIParseError,
  isGitLabLocalInclude,
  isGitLabTemplateInclude,
  isGitLabRemoteInclude,
  isGitLabProjectInclude,
  isGitLabFileInclude,
  isGitLabComponentInclude,
} from './types';
import { SourceLocation } from '../terraform/types';

// ============================================================================
// Types
// ============================================================================

/**
 * FileSystem adapter interface for abstraction
 * Allows for testing and different implementations (local, git, etc.)
 */
export interface FileSystemAdapter {
  /** Read file content */
  readFile(filePath: string): Promise<string>;
  /** Check if file exists */
  exists(filePath: string): Promise<boolean>;
  /** Resolve relative path from base */
  resolvePath(from: string, to: string): string;
  /** Get absolute path */
  absolutePath(filePath: string): string;
}

/**
 * HTTP adapter for fetching remote includes
 */
export interface HttpAdapter {
  /** Fetch content from URL */
  fetch(url: string): Promise<string>;
}

/**
 * GitLab API adapter for project includes
 */
export interface GitLabApiAdapter {
  /** Fetch file from GitLab project */
  fetchProjectFile(
    project: string,
    file: string,
    ref?: string
  ): Promise<string>;
  /** Check if project file exists */
  projectFileExists(
    project: string,
    file: string,
    ref?: string
  ): Promise<boolean>;
}

/**
 * Resolved include with content
 */
export interface ResolvedInclude {
  /** Original include directive */
  readonly include: GitLabInclude;
  /** Resolved path or URL */
  readonly resolvedPath: string;
  /** File content (null if not resolved) */
  readonly content: string | null;
  /** Parsed YAML content */
  readonly parsed?: unknown;
  /** Error message if resolution failed */
  readonly error?: string;
  /** Depth in include hierarchy */
  readonly depth: number;
  /** Source location */
  readonly location?: SourceLocation;
}

/**
 * Failed include resolution
 */
export interface FailedInclude {
  /** Original include directive */
  readonly include: GitLabInclude;
  /** Attempted path */
  readonly attemptedPath: string;
  /** Error message */
  readonly error: string;
  /** Error code */
  readonly code: GitLabCIParseError['code'];
  /** Depth at failure */
  readonly depth: number;
}

/**
 * Circular dependency information
 */
export interface CircularDependency {
  /** Path where cycle was detected */
  readonly path: string;
  /** Chain of includes forming the cycle */
  readonly chain: readonly string[];
  /** Type of circular reference */
  readonly type: 'include' | 'extends';
}

/**
 * Include resolution result
 */
export interface IncludeResolutionResult {
  /** Successfully resolved includes */
  readonly resolved: readonly ResolvedInclude[];
  /** Failed includes */
  readonly failed: readonly FailedInclude[];
  /** Circular dependencies detected */
  readonly circularDependencies: readonly CircularDependency[];
  /** All parsed content merged */
  readonly mergedContent?: Record<string, unknown>;
}

/**
 * Resolver options
 */
export interface GitLabIncludeResolverOptions {
  /** Maximum include depth (default: 10) */
  readonly maxDepth?: number;
  /** Enable caching (default: true) */
  readonly enableCache?: boolean;
  /** Resolve remote includes (default: false for security) */
  readonly resolveRemote?: boolean;
  /** Resolve project includes (default: false, requires API) */
  readonly resolveProject?: boolean;
  /** Template base URL (default: GitLab templates) */
  readonly templateBaseUrl?: string;
  /** Strict mode - fail on any resolution error */
  readonly strict?: boolean;
}

/**
 * Raw job configuration from YAML
 */
export interface RawGitLabJob {
  /** Job name */
  readonly name: string;
  /** Stage name */
  readonly stage?: string;
  /** Script commands */
  readonly script?: readonly string[];
  /** Extends reference */
  readonly extends?: string | readonly string[];
  /** All other properties */
  readonly [key: string]: unknown;
}

/**
 * Resolved job with extends merged
 */
export interface ResolvedGitLabJob extends RawGitLabJob {
  /** Resolution metadata */
  readonly _resolution?: {
    readonly extendsChain: readonly string[];
    readonly mergedFrom: readonly string[];
  };
}

// ============================================================================
// Default Implementations
// ============================================================================

/**
 * Default file system adapter using Node.js fs
 */
export class NodeFileSystemAdapter implements FileSystemAdapter {
  private readonly fs: typeof import('fs/promises');

  constructor() {
    // Dynamic import to support both Node.js and browser environments
    this.fs = require('fs/promises');
  }

  async readFile(filePath: string): Promise<string> {
    return this.fs.readFile(filePath, 'utf-8');
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  resolvePath(from: string, to: string): string {
    const baseDir = path.dirname(from);
    return path.resolve(baseDir, to);
  }

  absolutePath(filePath: string): string {
    return path.resolve(filePath);
  }
}

/**
 * Default HTTP adapter using fetch API
 */
export class DefaultHttpAdapter implements HttpAdapter {
  async fetch(url: string): Promise<string> {
    const response = await globalThis.fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  }
}

// ============================================================================
// GitLab Include Resolver Class
// ============================================================================

/**
 * GitLab CI Include Resolver
 *
 * Resolves all types of GitLab CI includes:
 * - local: Relative path includes within the same repository
 * - template: GitLab CI templates (e.g., 'Terraform/Base.gitlab-ci.yml')
 * - remote: HTTP/HTTPS URLs
 * - project: Cross-project includes from other GitLab projects
 *
 * Features:
 * - Circular dependency detection
 * - Content caching
 * - Deep merge for extends resolution
 * - Configurable depth limits
 *
 * @example
 * ```typescript
 * const resolver = new GitLabIncludeResolver(
 *   new NodeFileSystemAdapter(),
 *   { maxDepth: 10 }
 * );
 *
 * const result = await resolver.resolveAll(includes, '/path/to/gitlab-ci.yml');
 * ```
 */
export class GitLabIncludeResolver {
  /** File system adapter */
  private readonly fs: FileSystemAdapter;
  /** HTTP adapter for remote includes */
  private readonly http: HttpAdapter;
  /** GitLab API adapter for project includes */
  private readonly gitlabApi?: GitLabApiAdapter;
  /** Maximum include depth */
  private readonly maxDepth: number;
  /** Content cache */
  private readonly cache: Map<string, string>;
  /** Currently resolving paths (for circular detection) */
  private readonly resolving: Set<string>;
  /** Resolver options */
  private readonly options: Required<Omit<GitLabIncludeResolverOptions, 'maxDepth'>>;

  /** GitLab template base URL */
  private static readonly GITLAB_TEMPLATE_BASE =
    'https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/gitlab/ci/templates';

  constructor(
    fs: FileSystemAdapter,
    options: GitLabIncludeResolverOptions = {},
    http?: HttpAdapter,
    gitlabApi?: GitLabApiAdapter
  ) {
    this.fs = fs;
    this.http = http ?? new DefaultHttpAdapter();
    this.gitlabApi = gitlabApi;
    this.maxDepth = options.maxDepth ?? 10;
    this.cache = new Map();
    this.resolving = new Set();
    this.options = {
      enableCache: options.enableCache ?? true,
      resolveRemote: options.resolveRemote ?? false,
      resolveProject: options.resolveProject ?? false,
      templateBaseUrl: options.templateBaseUrl ?? GitLabIncludeResolver.GITLAB_TEMPLATE_BASE,
      strict: options.strict ?? false,
    };
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Resolve all includes from a GitLab CI configuration
   *
   * @param includes - Array of include directives
   * @param basePath - Base path of the main configuration file
   * @returns Resolution result with resolved and failed includes
   */
  async resolveAll(
    includes: readonly GitLabInclude[],
    basePath: string
  ): Promise<IncludeResolutionResult> {
    const resolved: ResolvedInclude[] = [];
    const failed: FailedInclude[] = [];
    const circularDependencies: CircularDependency[] = [];

    // Reset resolving set for new resolution
    this.resolving.clear();

    for (const include of includes) {
      try {
        const result = await this.resolveInclude(include, basePath, 0, [basePath]);

        if (result.error) {
          failed.push({
            include,
            attemptedPath: result.resolvedPath,
            error: result.error,
            code: 'INCLUDE_RESOLUTION_FAILED',
            depth: result.depth,
          });
        } else {
          resolved.push(result);

          // Recursively resolve nested includes
          if (result.parsed && typeof result.parsed === 'object') {
            const nestedIncludes = this.extractIncludes(result.parsed as Record<string, unknown>);
            if (nestedIncludes.length > 0 && result.depth < this.maxDepth) {
              const nestedResult = await this.resolveNestedIncludes(
                nestedIncludes,
                result.resolvedPath,
                result.depth + 1,
                [...(result as any)._chain ?? [basePath], result.resolvedPath]
              );
              resolved.push(...nestedResult.resolved);
              failed.push(...nestedResult.failed);
              circularDependencies.push(...nestedResult.circularDependencies);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for circular dependency
        if (errorMessage.includes('Circular')) {
          const pathMatch = errorMessage.match(/path: (.+)$/);
          circularDependencies.push({
            path: pathMatch?.[1] ?? 'unknown',
            chain: [],
            type: 'include',
          });
        }

        failed.push({
          include,
          attemptedPath: this.getIncludePath(include),
          error: errorMessage,
          code: 'INCLUDE_RESOLUTION_FAILED',
          depth: 0,
        });
      }
    }

    // Merge all resolved content
    let mergedContent: Record<string, unknown> | undefined;
    if (resolved.length > 0) {
      mergedContent = this.mergeResolvedContent(resolved);
    }

    return {
      resolved,
      failed,
      circularDependencies,
      mergedContent,
    };
  }

  /**
   * Resolve extends inheritance for a job
   *
   * @param job - Job with extends reference
   * @param allJobs - Map of all jobs (including templates)
   * @returns Resolved job with extends merged
   */
  async resolveExtends(
    job: RawGitLabJob,
    allJobs: Map<string, RawGitLabJob>
  ): Promise<ResolvedGitLabJob> {
    if (!job.extends) {
      return job as ResolvedGitLabJob;
    }

    const extendsArray = Array.isArray(job.extends)
      ? job.extends
      : [job.extends];

    const resolved = new Set<string>();
    const resolving = new Set<string>();
    const mergedFrom: string[] = [];

    const resolveJobExtends = (
      currentJob: RawGitLabJob,
      chain: string[]
    ): RawGitLabJob => {
      if (!currentJob.extends) {
        return currentJob;
      }

      const jobExtendsArray = Array.isArray(currentJob.extends)
        ? currentJob.extends
        : [currentJob.extends];

      let mergedJob = { ...currentJob };
      delete (mergedJob as any).extends; // Remove extends from result

      for (const parentName of jobExtendsArray) {
        // Check for circular reference
        if (resolving.has(parentName)) {
          throw new Error(
            `Circular extends detected: ${[...chain, parentName].join(' -> ')}`
          );
        }

        const parentJob = allJobs.get(parentName);
        if (!parentJob) {
          // Parent not found - skip with warning
          continue;
        }

        resolving.add(parentName);

        // Recursively resolve parent's extends
        const resolvedParent = resolved.has(parentName)
          ? parentJob
          : resolveJobExtends(parentJob, [...chain, parentName]);

        resolving.delete(parentName);
        resolved.add(parentName);
        mergedFrom.push(parentName);

        // Merge parent into current job
        mergedJob = this.mergeJobConfigs(resolvedParent, mergedJob);
      }

      return mergedJob;
    };

    try {
      resolving.add(job.name);
      const mergedJob = resolveJobExtends(job, [job.name]);
      resolving.delete(job.name);

      return {
        ...mergedJob,
        _resolution: {
          extendsChain: extendsArray as string[],
          mergedFrom,
        },
      } as ResolvedGitLabJob;
    } catch (error) {
      // Return original job on circular dependency
      return {
        ...job,
        _resolution: {
          extendsChain: extendsArray as string[],
          mergedFrom: [],
        },
      } as ResolvedGitLabJob;
    }
  }

  /**
   * Resolve all extends for a map of jobs
   *
   * @param jobs - Map of job name to raw job
   * @returns Map of resolved jobs with circular dependencies
   */
  async resolveAllExtends(
    jobs: Map<string, RawGitLabJob>
  ): Promise<{
    resolved: Map<string, ResolvedGitLabJob>;
    circularDependencies: CircularDependency[];
  }> {
    const resolved = new Map<string, ResolvedGitLabJob>();
    const circularDependencies: CircularDependency[] = [];

    for (const [name, job] of jobs) {
      try {
        const resolvedJob = await this.resolveExtends(job, jobs);
        resolved.set(name, resolvedJob);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('Circular')) {
          circularDependencies.push({
            path: name,
            chain: errorMessage.match(/: (.+)$/)?.[1]?.split(' -> ') ?? [],
            type: 'extends',
          });
        }

        // Keep original job on error
        resolved.set(name, job as ResolvedGitLabJob);
      }
    }

    return { resolved, circularDependencies };
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  // ============================================================================
  // Private Resolution Methods
  // ============================================================================

  /**
   * Resolve a single include directive
   */
  private async resolveInclude(
    include: GitLabInclude,
    basePath: string,
    depth: number,
    chain: string[]
  ): Promise<ResolvedInclude> {
    // Check depth limit
    if (depth >= this.maxDepth) {
      return {
        include,
        resolvedPath: this.getIncludePath(include),
        content: null,
        depth,
        error: `Maximum include depth (${this.maxDepth}) exceeded`,
      };
    }

    // Route to appropriate resolver based on include type
    if (isGitLabLocalInclude(include)) {
      return this.resolveLocalInclude(include, basePath, depth, chain);
    }

    if (isGitLabFileInclude(include)) {
      return this.resolveFileInclude(include, basePath, depth, chain);
    }

    if (isGitLabTemplateInclude(include)) {
      return this.resolveTemplateInclude(include, depth, chain);
    }

    if (isGitLabRemoteInclude(include)) {
      return this.resolveRemoteInclude(include, depth, chain);
    }

    if (isGitLabProjectInclude(include)) {
      return this.resolveProjectInclude(include, depth, chain);
    }

    if (isGitLabComponentInclude(include)) {
      return this.resolveComponentInclude(include, depth, chain);
    }

    // Unknown include type
    return {
      include,
      resolvedPath: 'unknown',
      content: null,
      depth,
      error: `Unknown include type: ${(include as any).type}`,
    };
  }

  /**
   * Resolve a local include
   */
  private async resolveLocalInclude(
    include: GitLabLocalInclude,
    basePath: string,
    depth: number,
    chain: string[]
  ): Promise<ResolvedInclude> {
    const localPath = include.local;

    // Resolve relative path
    let resolvedPath: string;
    if (path.isAbsolute(localPath)) {
      resolvedPath = localPath;
    } else if (localPath.startsWith('/')) {
      // GitLab treats paths starting with / as relative to repo root
      // For now, resolve relative to base path's directory
      resolvedPath = this.fs.resolvePath(basePath, '.' + localPath);
    } else {
      resolvedPath = this.fs.resolvePath(basePath, localPath);
    }

    resolvedPath = this.fs.absolutePath(resolvedPath);

    // Check for circular include
    if (this.detectCircularDependency(resolvedPath, chain)) {
      return {
        include,
        resolvedPath,
        content: null,
        depth,
        error: `Circular include detected: ${resolvedPath}`,
      };
    }

    // Check cache
    if (this.options.enableCache && this.cache.has(resolvedPath)) {
      const content = this.cache.get(resolvedPath)!;
      return {
        include,
        resolvedPath,
        content,
        parsed: this.parseYaml(content, resolvedPath),
        depth,
      };
    }

    // Read file
    try {
      const exists = await this.fs.exists(resolvedPath);
      if (!exists) {
        return {
          include,
          resolvedPath,
          content: null,
          depth,
          error: `Include file not found: ${resolvedPath}`,
        };
      }

      const content = await this.fs.readFile(resolvedPath);

      // Cache the content
      if (this.options.enableCache) {
        this.cache.set(resolvedPath, content);
      }

      return {
        include,
        resolvedPath,
        content,
        parsed: this.parseYaml(content, resolvedPath),
        depth,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        include,
        resolvedPath,
        content: null,
        depth,
        error: `Failed to read include file: ${errorMessage}`,
      };
    }
  }

  /**
   * Resolve a file include (multiple files from same project)
   */
  private async resolveFileInclude(
    include: GitLabFileInclude,
    basePath: string,
    depth: number,
    chain: string[]
  ): Promise<ResolvedInclude> {
    const files = include.file;

    // For simplicity, treat as local includes
    // In a real GitLab environment, this would reference files in the same repo
    const firstFile = files[0];
    if (!firstFile) {
      return {
        include,
        resolvedPath: 'unknown',
        content: null,
        depth,
        error: 'File include has no files specified',
      };
    }

    const localInclude: GitLabLocalInclude = {
      type: 'local',
      local: firstFile,
      location: include.location,
    };

    return this.resolveLocalInclude(localInclude, basePath, depth, chain);
  }

  /**
   * Resolve a GitLab template include
   */
  private async resolveTemplateInclude(
    include: GitLabTemplateInclude,
    depth: number,
    chain: string[]
  ): Promise<ResolvedInclude> {
    const templateName = include.template;
    const templateUrl = `${this.options.templateBaseUrl}/${templateName}`;

    // Check cache
    if (this.options.enableCache && this.cache.has(templateUrl)) {
      const content = this.cache.get(templateUrl)!;
      return {
        include,
        resolvedPath: templateUrl,
        content,
        parsed: this.parseYaml(content, templateUrl),
        depth,
      };
    }

    // Template resolution is essentially a remote fetch
    if (!this.options.resolveRemote) {
      return {
        include,
        resolvedPath: templateUrl,
        content: null,
        depth,
        error: 'Remote resolution disabled - template cannot be fetched',
      };
    }

    try {
      const content = await this.http.fetch(templateUrl);

      // Cache the content
      if (this.options.enableCache) {
        this.cache.set(templateUrl, content);
      }

      return {
        include,
        resolvedPath: templateUrl,
        content,
        parsed: this.parseYaml(content, templateUrl),
        depth,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        include,
        resolvedPath: templateUrl,
        content: null,
        depth,
        error: `Failed to fetch template: ${errorMessage}`,
      };
    }
  }

  /**
   * Resolve a remote HTTP/HTTPS include
   */
  private async resolveRemoteInclude(
    include: GitLabRemoteInclude,
    depth: number,
    chain: string[]
  ): Promise<ResolvedInclude> {
    const remoteUrl = include.remote;

    // Check cache
    if (this.options.enableCache && this.cache.has(remoteUrl)) {
      const content = this.cache.get(remoteUrl)!;
      return {
        include,
        resolvedPath: remoteUrl,
        content,
        parsed: this.parseYaml(content, remoteUrl),
        depth,
      };
    }

    // Remote resolution must be explicitly enabled
    if (!this.options.resolveRemote) {
      return {
        include,
        resolvedPath: remoteUrl,
        content: null,
        depth,
        error: 'Remote include resolution is disabled for security',
      };
    }

    try {
      const content = await this.http.fetch(remoteUrl);

      // Cache the content
      if (this.options.enableCache) {
        this.cache.set(remoteUrl, content);
      }

      return {
        include,
        resolvedPath: remoteUrl,
        content,
        parsed: this.parseYaml(content, remoteUrl),
        depth,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        include,
        resolvedPath: remoteUrl,
        content: null,
        depth,
        error: `Failed to fetch remote include: ${errorMessage}`,
      };
    }
  }

  /**
   * Resolve a project include (cross-project)
   */
  private async resolveProjectInclude(
    include: GitLabProjectInclude,
    depth: number,
    chain: string[]
  ): Promise<ResolvedInclude> {
    const { project, file, ref } = include;
    const fileStr = Array.isArray(file) ? file[0] : file;
    const cacheKey = `project:${project}:${fileStr}:${ref ?? 'default'}`;

    // Check cache
    if (this.options.enableCache && this.cache.has(cacheKey)) {
      const content = this.cache.get(cacheKey)!;
      return {
        include,
        resolvedPath: cacheKey,
        content,
        parsed: this.parseYaml(content, cacheKey),
        depth,
      };
    }

    // Project resolution requires GitLab API
    if (!this.options.resolveProject || !this.gitlabApi) {
      return {
        include,
        resolvedPath: cacheKey,
        content: null,
        depth,
        error: 'Project include resolution is disabled or GitLab API not configured',
      };
    }

    try {
      const content = await this.gitlabApi.fetchProjectFile(project, fileStr, ref);

      // Cache the content
      if (this.options.enableCache) {
        this.cache.set(cacheKey, content);
      }

      return {
        include,
        resolvedPath: cacheKey,
        content,
        parsed: this.parseYaml(content, cacheKey),
        depth,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        include,
        resolvedPath: cacheKey,
        content: null,
        depth,
        error: `Failed to fetch project include: ${errorMessage}`,
      };
    }
  }

  /**
   * Resolve a component include (CI/CD Catalog)
   */
  private async resolveComponentInclude(
    include: GitLabComponentInclude,
    depth: number,
    chain: string[]
  ): Promise<ResolvedInclude> {
    // Component includes are a newer GitLab feature
    // They reference CI/CD Catalog components
    const componentPath = include.component;

    return {
      include,
      resolvedPath: componentPath,
      content: null,
      depth,
      error: 'Component includes are not yet supported for resolution',
    };
  }

  /**
   * Resolve nested includes from parsed content
   */
  private async resolveNestedIncludes(
    includes: GitLabInclude[],
    basePath: string,
    depth: number,
    chain: string[]
  ): Promise<IncludeResolutionResult> {
    const resolved: ResolvedInclude[] = [];
    const failed: FailedInclude[] = [];
    const circularDependencies: CircularDependency[] = [];

    for (const include of includes) {
      try {
        const result = await this.resolveInclude(include, basePath, depth, chain);

        if (result.error) {
          failed.push({
            include,
            attemptedPath: result.resolvedPath,
            error: result.error,
            code: 'INCLUDE_RESOLUTION_FAILED',
            depth: result.depth,
          });
        } else {
          resolved.push(result);

          // Continue recursively
          if (result.parsed && typeof result.parsed === 'object') {
            const nestedIncludes = this.extractIncludes(result.parsed as Record<string, unknown>);
            if (nestedIncludes.length > 0 && depth < this.maxDepth) {
              const nestedResult = await this.resolveNestedIncludes(
                nestedIncludes,
                result.resolvedPath,
                depth + 1,
                [...chain, result.resolvedPath]
              );
              resolved.push(...nestedResult.resolved);
              failed.push(...nestedResult.failed);
              circularDependencies.push(...nestedResult.circularDependencies);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({
          include,
          attemptedPath: this.getIncludePath(include),
          error: errorMessage,
          code: 'INCLUDE_RESOLUTION_FAILED',
          depth,
        });
      }
    }

    return { resolved, failed, circularDependencies };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Detect circular dependency
   */
  private detectCircularDependency(path: string, chain: string[]): boolean {
    const normalizedPath = this.normalizePath(path);
    return chain.some(p => this.normalizePath(p) === normalizedPath);
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(filePath: string): string {
    return path.normalize(filePath).toLowerCase();
  }

  /**
   * Get path/URL from include for error messages
   */
  private getIncludePath(include: GitLabInclude): string {
    if (isGitLabLocalInclude(include)) return include.local;
    if (isGitLabFileInclude(include)) return include.file[0] ?? 'unknown';
    if (isGitLabRemoteInclude(include)) return include.remote;
    if (isGitLabTemplateInclude(include)) return include.template;
    if (isGitLabProjectInclude(include)) {
      const file = Array.isArray(include.file) ? include.file[0] : include.file;
      return `${include.project}:${file}`;
    }
    if (isGitLabComponentInclude(include)) return include.component;
    return 'unknown';
  }

  /**
   * Parse YAML content safely
   */
  private parseYaml(content: string, source: string): unknown {
    try {
      return yaml.parse(content, { strict: false });
    } catch (error) {
      // Return null on parse error, error will be handled upstream
      return null;
    }
  }

  /**
   * Extract includes from parsed YAML
   */
  private extractIncludes(parsed: Record<string, unknown>): GitLabInclude[] {
    const includeValue = parsed.include;
    if (!includeValue) return [];

    const includes: GitLabInclude[] = [];

    const processInclude = (item: unknown): void => {
      if (typeof item === 'string') {
        includes.push({ type: 'local', local: item });
      } else if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        if ('local' in obj) {
          includes.push({ type: 'local', local: obj.local as string });
        } else if ('file' in obj) {
          const files = Array.isArray(obj.file) ? obj.file : [obj.file];
          includes.push({
            type: 'file',
            file: files.filter((f): f is string => typeof f === 'string'),
          });
        } else if ('remote' in obj) {
          includes.push({ type: 'remote', remote: obj.remote as string });
        } else if ('template' in obj) {
          includes.push({ type: 'template', template: obj.template as string });
        } else if ('project' in obj) {
          includes.push({
            type: 'project',
            project: obj.project as string,
            file: (obj.file as string | string[]) ?? '',
            ref: obj.ref as string | undefined,
          });
        } else if ('component' in obj) {
          includes.push({
            type: 'component',
            component: obj.component as string,
            inputs: obj.inputs as Record<string, unknown> | undefined,
          });
        }
      }
    };

    if (Array.isArray(includeValue)) {
      includeValue.forEach(processInclude);
    } else {
      processInclude(includeValue);
    }

    return includes;
  }

  /**
   * Merge resolved include contents
   * Later includes override earlier ones (GitLab merge strategy)
   */
  private mergeResolvedContent(
    resolved: readonly ResolvedInclude[]
  ): Record<string, unknown> {
    let merged: Record<string, unknown> = {};

    for (const include of resolved) {
      if (include.parsed && typeof include.parsed === 'object') {
        merged = this.deepMerge(merged, include.parsed as Record<string, unknown>);
      }
    }

    return merged;
  }

  /**
   * Merge two job configurations following GitLab's merge strategy
   *
   * Strategy:
   * - Arrays: concatenate (child after parent)
   * - Objects: deep merge
   * - Primitives: child overrides parent
   */
  mergeJobConfigs(base: RawGitLabJob, extending: RawGitLabJob): RawGitLabJob {
    const result: Record<string, unknown> = {};

    // Get all keys from both jobs
    const allKeys = new Set([
      ...Object.keys(base),
      ...Object.keys(extending),
    ]);

    for (const key of allKeys) {
      const baseValue = (base as any)[key];
      const extValue = (extending as any)[key];

      // Skip internal resolution metadata
      if (key === '_resolution') continue;

      // If only one has the value, use it
      if (extValue === undefined) {
        result[key] = baseValue;
        continue;
      }
      if (baseValue === undefined) {
        result[key] = extValue;
        continue;
      }

      // Both have values - apply merge strategy
      if (Array.isArray(baseValue) && Array.isArray(extValue)) {
        // Special case: script, before_script, after_script
        // Child script completely replaces parent script (per GitLab docs)
        if (key === 'script' || key === 'before_script' || key === 'after_script') {
          result[key] = extValue;
        } else {
          // Other arrays: concatenate
          result[key] = [...baseValue, ...extValue];
        }
      } else if (
        typeof baseValue === 'object' &&
        baseValue !== null &&
        !Array.isArray(baseValue) &&
        typeof extValue === 'object' &&
        extValue !== null &&
        !Array.isArray(extValue)
      ) {
        // Objects: deep merge
        result[key] = this.deepMerge(
          baseValue as Record<string, unknown>,
          extValue as Record<string, unknown>
        );
      } else {
        // Primitives: child overrides
        result[key] = extValue;
      }
    }

    return result as RawGitLabJob;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        result[key] = sourceValue;
      }
    }

    return result;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new GitLab include resolver with default adapters
 */
export function createGitLabIncludeResolver(
  options?: GitLabIncludeResolverOptions
): GitLabIncludeResolver {
  return new GitLabIncludeResolver(
    new NodeFileSystemAdapter(),
    options
  );
}

/**
 * Create resolver with custom adapters
 */
export function createGitLabIncludeResolverWithAdapters(
  fs: FileSystemAdapter,
  options?: GitLabIncludeResolverOptions,
  http?: HttpAdapter,
  gitlabApi?: GitLabApiAdapter
): GitLabIncludeResolver {
  return new GitLabIncludeResolver(fs, options, http, gitlabApi);
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  GitLabIncludeResolver,
  NodeFileSystemAdapter,
  DefaultHttpAdapter,
};
