/**
 * Helmfile Parser
 * @module parsers/helmfile/helmfile-parser
 *
 * Parses helmfile.yaml configurations that orchestrate multiple Helm releases.
 * Extracts release definitions, values file references, environment overrides,
 * and release dependencies.
 *
 * TASK-XREF-004: Helmfile parser for Helm release orchestration
 */

import * as yaml from 'yaml';
import * as path from 'path';
import {
  BaseParser,
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
} from '../base/parser';
import { NodeLocation, EdgeMetadata } from '../../types/graph';

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Branded type for Helmfile IDs
 */
export type HelmfileId = string & { readonly __brand: 'HelmfileId' };

/**
 * Branded type for Helmfile Release IDs
 */
export type HelmfileReleaseId = string & { readonly __brand: 'HelmfileReleaseId' };

// ============================================================================
// Core Types
// ============================================================================

/**
 * Helm defaults configuration
 */
export interface HelmDefaults {
  readonly wait?: boolean;
  readonly timeout?: number;
  readonly recreatePods?: boolean;
  readonly force?: boolean;
  readonly atomic?: boolean;
  readonly cleanupOnFail?: boolean;
  readonly tillerNamespace?: string;
  readonly tillerless?: boolean;
  readonly kubeContext?: string;
  readonly verify?: boolean;
  readonly createNamespace?: boolean;
}

/**
 * Set value for inline Helm values
 */
export interface SetValue {
  readonly name: string;
  readonly value: string | number | boolean;
  readonly file?: string;
}

/**
 * Helmfile release definition
 */
export interface HelmfileRelease {
  readonly name: string;
  readonly namespace: string;
  readonly chart: string;
  readonly version?: string;
  readonly needs: readonly string[];
  readonly values: readonly string[];
  readonly set: readonly SetValue[];
  readonly condition?: string;
  readonly installed?: boolean;
  readonly wait?: boolean;
  readonly timeout?: number;
  readonly atomic?: boolean;
  readonly force?: boolean;
  readonly recreatePods?: boolean;
  readonly createNamespace?: boolean;
  readonly labels?: Record<string, string>;
  readonly missingFileHandler?: 'Error' | 'Warn' | 'Info' | 'Debug';
  readonly hooks?: readonly HelmfileHook[];
  readonly secrets?: readonly string[];
  readonly lineNumber?: number;
}

/**
 * Helmfile hook definition
 */
export interface HelmfileHook {
  readonly events: readonly string[];
  readonly command: string;
  readonly args?: readonly string[];
  readonly showlogs?: boolean;
}

/**
 * Helmfile environment configuration
 */
export interface HelmfileEnvironment {
  readonly name: string;
  readonly values: readonly string[];
  readonly secrets: readonly string[];
  readonly kubeContext?: string;
  readonly missingFileHandler?: 'Error' | 'Warn' | 'Info' | 'Debug';
}

/**
 * Helmfile repository definition
 */
export interface HelmRepository {
  readonly name: string;
  readonly url: string;
  readonly oci?: boolean;
  readonly certFile?: string;
  readonly keyFile?: string;
  readonly caFile?: string;
  readonly username?: string;
  readonly passCredentials?: boolean;
}

/**
 * Complete Helmfile structure
 */
export interface Helmfile {
  readonly filePath: string;
  readonly helmDefaults: HelmDefaults;
  readonly environments: ReadonlyMap<string, HelmfileEnvironment>;
  readonly repositories: readonly HelmRepository[];
  readonly releases: readonly HelmfileRelease[];
  readonly bases?: readonly string[];
  readonly helmBinary?: string;
  readonly location: NodeLocation;
}

// ============================================================================
// Graph Node Types
// ============================================================================

/**
 * Helmfile release node for dependency graph
 */
export interface HelmfileReleaseNode {
  readonly id: string;
  readonly type: 'helmfile_release';
  readonly name: string;
  readonly filePath: string;
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly location: NodeLocation;
  readonly metadata: {
    readonly releaseName: string;
    readonly namespace: string;
    readonly chartSource: string;
    readonly chartVersion?: string;
    readonly environmentSpecific: boolean;
    readonly valuesFiles: readonly string[];
    readonly dependencyCount: number;
  };
}

/**
 * Edge representing a dependency between Helmfile releases.
 * Uses 'depends_on' to match existing EdgeType from graph.ts
 */
export interface HelmfileDependsOnEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: 'depends_on';
  readonly label?: string;
  readonly metadata: EdgeMetadata & {
    readonly dependencyName: string;
    readonly isExplicitNeed: boolean;
    readonly isHelmfileRelease: boolean;
  };
}

// ============================================================================
// Parse Error Types
// ============================================================================

/**
 * Helmfile parse error codes
 */
export type HelmfileParseErrorCode =
  | 'INVALID_YAML'
  | 'INVALID_HELMFILE'
  | 'MISSING_RELEASE_NAME'
  | 'MISSING_RELEASE_CHART'
  | 'INVALID_RELEASE'
  | 'INVALID_ENVIRONMENT'
  | 'INVALID_REPOSITORY'
  | 'CIRCULAR_DEPENDENCY'
  | 'UNKNOWN_DEPENDENCY'
  | 'YAML_PARSE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Helmfile parse error
 */
export interface HelmfileParseError {
  readonly message: string;
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly severity: 'error' | 'warning';
  readonly code: HelmfileParseErrorCode;
}

// ============================================================================
// Parse Result Types
// ============================================================================

/**
 * Helmfile parse result
 */
export interface HelmfileParseResult {
  readonly success: boolean;
  readonly helmfile?: Helmfile;
  readonly nodes: readonly HelmfileReleaseNode[];
  readonly edges: readonly HelmfileDependsOnEdge[];
  readonly errors: readonly HelmfileParseError[];
  readonly warnings: readonly HelmfileParseError[];
  readonly metadata: HelmfileParseMetadata;
}

/**
 * Helmfile parse metadata
 */
export interface HelmfileParseMetadata {
  readonly filePath: string;
  readonly parserName: string;
  readonly parserVersion: string;
  readonly parseTimeMs: number;
  readonly fileSize: number;
  readonly lineCount: number;
  readonly releaseCount: number;
  readonly environmentCount: number;
  readonly repositoryCount: number;
}

// ============================================================================
// Parser Options
// ============================================================================

/**
 * Helmfile parser options
 */
export interface HelmfileParserOptions extends ParserOptions {
  /** Resolve environment templating ({{ .Environment.Name }}) */
  readonly resolveEnvironmentTemplates?: boolean;
  /** Default environment name for resolution */
  readonly defaultEnvironment?: string;
  /** Validate release dependencies exist */
  readonly validateDependencies?: boolean;
  /** Strict YAML parsing */
  readonly strictYaml?: boolean;
  /** Include bases in resolution */
  readonly resolveBases?: boolean;
}

/**
 * Default Helmfile parser options
 */
export const DEFAULT_HELMFILE_PARSER_OPTIONS: Required<HelmfileParserOptions> = {
  errorRecovery: true,
  maxFileSize: 10 * 1024 * 1024,
  encoding: 'utf-8',
  includeRaw: false,
  parseNestedBlocks: true,
  strictMode: false,
  timeout: 30000,
  enableCache: true,
  resolveEnvironmentTemplates: false,
  defaultEnvironment: 'default',
  validateDependencies: true,
  strictYaml: false,
  resolveBases: false,
};

// ============================================================================
// Factory Functions for IDs
// ============================================================================

/**
 * Create a HelmfileId from file path
 */
export function createHelmfileId(filePath: string): HelmfileId {
  return `helmfile-${path.basename(filePath, path.extname(filePath))}` as HelmfileId;
}

/**
 * Create a HelmfileReleaseId from helmfile and release name
 */
export function createHelmfileReleaseId(
  helmfileId: string,
  releaseName: string
): HelmfileReleaseId {
  return `${helmfileId}-release-${releaseName}` as HelmfileReleaseId;
}

// ============================================================================
// Helmfile Parser
// ============================================================================

/**
 * Parser for helmfile.yaml configurations.
 * Handles release definitions, values files, environments, and dependencies.
 */
export class HelmfileParser extends BaseParser<HelmfileParseResult> {
  readonly name = 'helmfile-parser';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yaml', '.yml'] as const;
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml'] as const;

  private readonly helmfileOptions: Required<HelmfileParserOptions>;

  constructor(options?: ParserOptions & Partial<HelmfileParserOptions>) {
    super(options);
    this.helmfileOptions = { ...DEFAULT_HELMFILE_PARSER_OPTIONS, ...options };
  }

  /**
   * Parse a helmfile.yaml file content synchronously
   */
  parseContent(content: string, filePath: string): Helmfile {
    const result = this.parseSync(content, filePath);
    if (!result.helmfile) {
      throw new Error(`Failed to parse helmfile: ${result.errors.map(e => e.message).join(', ')}`);
    }
    return result.helmfile;
  }

  /**
   * Parse helmfile synchronously (internal helper)
   */
  private parseSync(content: string, filePath: string): HelmfileParseResult {
    const startTime = performance.now();
    const errors: HelmfileParseError[] = [];
    const warnings: HelmfileParseError[] = [];

    try {
      const parsed = this.parseYaml(content, filePath, errors);
      if (!parsed || typeof parsed !== 'object') {
        return this.createEmptyResult(filePath, startTime, content, errors, warnings);
      }

      const data = parsed as Record<string, unknown>;

      // Extract components
      const helmDefaults = this.extractHelmDefaults(data.helmDefaults);
      const environments = this.extractEnvironments(data.environments, filePath, errors, warnings);
      const repositories = this.extractRepositories(data.repositories, filePath, errors, warnings);
      const releases = this.extractReleases(data.releases, filePath, errors, warnings);
      const bases = this.extractBases(data.bases);

      // Validate dependencies if enabled
      if (this.helmfileOptions.validateDependencies) {
        this.validateReleaseDependencies(releases, filePath, errors);
      }

      // Create Helmfile object
      const helmfile: Helmfile = {
        filePath,
        helmDefaults,
        environments,
        repositories,
        releases,
        bases,
        helmBinary: typeof data.helmBinary === 'string' ? data.helmBinary : undefined,
        location: {
          file: filePath,
          lineStart: 1,
          lineEnd: content.split('\n').length,
        },
      };

      // Create graph nodes and edges
      const nodes = this.createReleaseNodes(helmfile);
      const edges = this.createDependencyEdges(helmfile);

      return {
        success: errors.filter(e => e.severity === 'error').length === 0,
        helmfile,
        nodes,
        edges,
        errors,
        warnings,
        metadata: this.createHelmfileMetadata(filePath, startTime, content, helmfile),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        message: `Failed to parse helmfile: ${message}`,
        file: filePath,
        severity: 'error',
        code: 'UNKNOWN_ERROR',
      });
      return this.createEmptyResult(filePath, startTime, content, errors, warnings);
    }
  }

  /**
   * Check if content looks like a helmfile
   */
  canParse(filePath: string, content?: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileName = path.basename(normalizedPath).toLowerCase();

    // Check for helmfile filename patterns
    if (
      fileName === 'helmfile.yaml' ||
      fileName === 'helmfile.yml' ||
      fileName.startsWith('helmfile.') ||
      fileName.includes('helmfile')
    ) {
      return true;
    }

    // If content provided, check for helmfile markers
    if (content) {
      return this.hasHelmfileMarkers(content);
    }

    return false;
  }

  /**
   * Check if content has helmfile markers
   */
  private hasHelmfileMarkers(content: string): boolean {
    return (
      /^releases:/m.test(content) ||
      (/^repositories:/m.test(content) && /\bchart:/m.test(content)) ||
      /^helmDefaults:/m.test(content) ||
      (/^environments:/m.test(content) && /\breleases:/m.test(content))
    );
  }

  /**
   * Extract release dependencies
   */
  getReleaseDependencies(helmfile: Helmfile): ReadonlyMap<string, readonly string[]> {
    const dependencies = new Map<string, readonly string[]>();
    for (const release of helmfile.releases) {
      dependencies.set(release.name, release.needs);
    }
    return dependencies;
  }

  /**
   * Get releases in dependency order (topological sort)
   */
  getReleasesInOrder(helmfile: Helmfile): readonly HelmfileRelease[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: HelmfileRelease[] = [];
    const releaseMap = new Map(helmfile.releases.map(r => [r.name, r]));

    const visit = (releaseName: string): void => {
      if (visited.has(releaseName)) return;
      if (visiting.has(releaseName)) {
        throw new Error(`Circular dependency detected: ${releaseName}`);
      }

      visiting.add(releaseName);
      const release = releaseMap.get(releaseName);
      if (release) {
        for (const dep of release.needs) {
          visit(dep);
        }
        visited.add(releaseName);
        result.push(release);
      }
      visiting.delete(releaseName);
    };

    for (const release of helmfile.releases) {
      visit(release.name);
    }

    return result;
  }

  /**
   * Find releases that use a specific chart
   */
  findReleasesByChart(
    helmfile: Helmfile,
    chartPattern: string
  ): readonly HelmfileRelease[] {
    const regex = new RegExp(chartPattern, 'i');
    return helmfile.releases.filter(release => regex.test(release.chart));
  }

  // ============================================================================
  // Protected Parse Implementation
  // ============================================================================

  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<HelmfileParseResult>> {
    const startTime = performance.now();
    const result = this.parseSync(content, filePath);

    if (!result.success && !this.helmfileOptions.errorRecovery) {
      return this.createFailure(
        result.errors.map(e => ({
          code: 'SYNTAX_ERROR' as const,
          message: e.message,
          location: e.line
            ? { file: filePath, lineStart: e.line, lineEnd: e.line, columnStart: 0, columnEnd: 0 }
            : null,
          severity: 'fatal' as const,
        })),
        null,
        this.createMetadata(filePath, startTime, content)
      );
    }

    return this.createSuccess(
      result,
      result.warnings.map(w => ({
        code: w.code,
        message: w.message,
        location: w.line
          ? { file: filePath, lineStart: w.line, lineEnd: w.line, columnStart: 0, columnEnd: 0 }
          : null,
        severity: 'warning' as const,
      })),
      this.createMetadata(filePath, startTime, content)
    );
  }

  // ============================================================================
  // YAML Parsing
  // ============================================================================

  private parseYaml(
    content: string,
    filePath: string,
    errors: HelmfileParseError[]
  ): unknown {
    try {
      const doc = yaml.parseDocument(content, {
        strict: this.helmfileOptions.strictYaml,
        uniqueKeys: false,
      });

      if (doc.errors.length > 0) {
        for (const err of doc.errors) {
          errors.push({
            message: err.message,
            file: filePath,
            line: err.linePos?.[0]?.line,
            column: err.linePos?.[0]?.col,
            severity: 'error',
            code: 'YAML_PARSE_ERROR',
          });
        }

        if (!this.helmfileOptions.errorRecovery) {
          return null;
        }
      }

      return doc.toJSON();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        message: `YAML parse error: ${message}`,
        file: filePath,
        severity: 'error',
        code: 'YAML_PARSE_ERROR',
      });
      return null;
    }
  }

  // ============================================================================
  // Component Extractors
  // ============================================================================

  private extractHelmDefaults(value: unknown): HelmDefaults {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const d = value as Record<string, unknown>;
    return {
      wait: typeof d.wait === 'boolean' ? d.wait : undefined,
      timeout: typeof d.timeout === 'number' ? d.timeout : undefined,
      recreatePods: typeof d.recreatePods === 'boolean' ? d.recreatePods : undefined,
      force: typeof d.force === 'boolean' ? d.force : undefined,
      atomic: typeof d.atomic === 'boolean' ? d.atomic : undefined,
      cleanupOnFail: typeof d.cleanupOnFail === 'boolean' ? d.cleanupOnFail : undefined,
      tillerNamespace: typeof d.tillerNamespace === 'string' ? d.tillerNamespace : undefined,
      tillerless: typeof d.tillerless === 'boolean' ? d.tillerless : undefined,
      kubeContext: typeof d.kubeContext === 'string' ? d.kubeContext : undefined,
      verify: typeof d.verify === 'boolean' ? d.verify : undefined,
      createNamespace: typeof d.createNamespace === 'boolean' ? d.createNamespace : undefined,
    };
  }

  private extractEnvironments(
    value: unknown,
    filePath: string,
    errors: HelmfileParseError[],
    warnings: HelmfileParseError[]
  ): ReadonlyMap<string, HelmfileEnvironment> {
    const environments = new Map<string, HelmfileEnvironment>();

    if (!value || typeof value !== 'object') {
      return environments;
    }

    for (const [name, envConfig] of Object.entries(value as Record<string, unknown>)) {
      if (!envConfig || typeof envConfig !== 'object') {
        warnings.push({
          message: `Environment "${name}" has invalid configuration`,
          file: filePath,
          severity: 'warning',
          code: 'INVALID_ENVIRONMENT',
        });
        continue;
      }

      const e = envConfig as Record<string, unknown>;
      environments.set(name, {
        name,
        values: this.extractStringArray(e.values),
        secrets: this.extractStringArray(e.secrets),
        kubeContext: typeof e.kubeContext === 'string' ? e.kubeContext : undefined,
        missingFileHandler: this.extractMissingFileHandler(e.missingFileHandler),
      });
    }

    return environments;
  }

  private extractRepositories(
    value: unknown,
    filePath: string,
    errors: HelmfileParseError[],
    warnings: HelmfileParseError[]
  ): readonly HelmRepository[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((repo): repo is Record<string, unknown> => {
        if (!repo || typeof repo !== 'object') {
          warnings.push({
            message: 'Repository entry is not an object',
            file: filePath,
            severity: 'warning',
            code: 'INVALID_REPOSITORY',
          });
          return false;
        }
        return true;
      })
      .map(repo => ({
        name: String(repo.name ?? ''),
        url: String(repo.url ?? ''),
        oci: typeof repo.oci === 'boolean' ? repo.oci : undefined,
        certFile: typeof repo.certFile === 'string' ? repo.certFile : undefined,
        keyFile: typeof repo.keyFile === 'string' ? repo.keyFile : undefined,
        caFile: typeof repo.caFile === 'string' ? repo.caFile : undefined,
        username: typeof repo.username === 'string' ? repo.username : undefined,
        passCredentials: typeof repo.passCredentials === 'boolean' ? repo.passCredentials : undefined,
      }))
      .filter(repo => {
        if (!repo.name || !repo.url) {
          warnings.push({
            message: 'Repository missing required name or url',
            file: filePath,
            severity: 'warning',
            code: 'INVALID_REPOSITORY',
          });
          return false;
        }
        return true;
      });
  }

  private extractReleases(
    value: unknown,
    filePath: string,
    errors: HelmfileParseError[],
    warnings: HelmfileParseError[]
  ): readonly HelmfileRelease[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((release, index) => this.extractRelease(release, index, filePath, errors, warnings))
      .filter((release): release is HelmfileRelease => release !== null);
  }

  private extractRelease(
    value: unknown,
    index: number,
    filePath: string,
    errors: HelmfileParseError[],
    warnings: HelmfileParseError[]
  ): HelmfileRelease | null {
    if (!value || typeof value !== 'object') {
      errors.push({
        message: `Release at index ${index} is not an object`,
        file: filePath,
        severity: 'error',
        code: 'INVALID_RELEASE',
      });
      return null;
    }

    const r = value as Record<string, unknown>;

    // Validate required fields
    if (!r.name || typeof r.name !== 'string') {
      errors.push({
        message: `Release at index ${index} missing required field 'name'`,
        file: filePath,
        severity: 'error',
        code: 'MISSING_RELEASE_NAME',
      });
      return null;
    }

    if (!r.chart || typeof r.chart !== 'string') {
      errors.push({
        message: `Release "${r.name}" missing required field 'chart'`,
        file: filePath,
        severity: 'error',
        code: 'MISSING_RELEASE_CHART',
      });
      return null;
    }

    return {
      name: r.name as string,
      namespace: typeof r.namespace === 'string' ? r.namespace : 'default',
      chart: r.chart as string,
      version: typeof r.version === 'string' ? r.version : undefined,
      needs: this.extractNeeds(r.needs),
      values: this.extractValues(r.values),
      set: this.extractSetValues(r.set),
      condition: typeof r.condition === 'string' ? r.condition : undefined,
      installed: typeof r.installed === 'boolean' ? r.installed : undefined,
      wait: typeof r.wait === 'boolean' ? r.wait : undefined,
      timeout: typeof r.timeout === 'number' ? r.timeout : undefined,
      atomic: typeof r.atomic === 'boolean' ? r.atomic : undefined,
      force: typeof r.force === 'boolean' ? r.force : undefined,
      recreatePods: typeof r.recreatePods === 'boolean' ? r.recreatePods : undefined,
      createNamespace: typeof r.createNamespace === 'boolean' ? r.createNamespace : undefined,
      labels: this.extractLabels(r.labels),
      missingFileHandler: this.extractMissingFileHandler(r.missingFileHandler),
      hooks: this.extractHooks(r.hooks),
      secrets: this.extractStringArray(r.secrets),
      lineNumber: index + 1,
    };
  }

  private extractNeeds(value: unknown): readonly string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((v): v is string => typeof v === 'string');
  }

  private extractValues(value: unknown): readonly string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((v): v is string | Record<string, unknown> =>
        typeof v === 'string' || (typeof v === 'object' && v !== null)
      )
      .map(v => {
        if (typeof v === 'string') {
          return v;
        }
        // Handle inline values - convert to JSON string for identification
        return `<inline:${JSON.stringify(v).substring(0, 50)}>`;
      });
  }

  private extractSetValues(value: unknown): readonly SetValue[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((v): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null
      )
      .map(v => ({
        name: String(v.name ?? ''),
        value: v.value as string | number | boolean,
        file: typeof v.file === 'string' ? v.file : undefined,
      }))
      .filter(v => v.name !== '');
  }

  private extractLabels(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const labels: Record<string, string> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      labels[key] = String(val);
    }
    return Object.keys(labels).length > 0 ? labels : undefined;
  }

  private extractHooks(value: unknown): readonly HelmfileHook[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .filter((v): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null
      )
      .map(v => ({
        events: this.extractStringArray(v.events),
        command: String(v.command ?? ''),
        args: this.extractStringArray(v.args),
        showlogs: typeof v.showlogs === 'boolean' ? v.showlogs : undefined,
      }))
      .filter(h => h.command !== '');
  }

  private extractBases(value: unknown): readonly string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const bases = value.filter((v): v is string => typeof v === 'string');
    return bases.length > 0 ? bases : undefined;
  }

  private extractMissingFileHandler(
    value: unknown
  ): 'Error' | 'Warn' | 'Info' | 'Debug' | undefined {
    const valid = ['Error', 'Warn', 'Info', 'Debug'];
    if (typeof value === 'string' && valid.includes(value)) {
      return value as 'Error' | 'Warn' | 'Info' | 'Debug';
    }
    return undefined;
  }

  private extractStringArray(value: unknown): readonly string[] {
    if (!value) return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return [];
  }

  // ============================================================================
  // Dependency Validation
  // ============================================================================

  private validateReleaseDependencies(
    releases: readonly HelmfileRelease[],
    filePath: string,
    errors: HelmfileParseError[]
  ): void {
    const releaseNames = new Set(releases.map(r => r.name));

    for (const release of releases) {
      for (const need of release.needs) {
        if (!releaseNames.has(need)) {
          errors.push({
            message: `Release "${release.name}" depends on unknown release "${need}"`,
            file: filePath,
            severity: 'error',
            code: 'UNKNOWN_DEPENDENCY',
          });
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(releases, filePath, errors);
  }

  private detectCircularDependencies(
    releases: readonly HelmfileRelease[],
    filePath: string,
    errors: HelmfileParseError[]
  ): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const releaseMap = new Map(releases.map(r => [r.name, r]));

    const visit = (name: string, pathHistory: string[]): boolean => {
      if (visited.has(name)) return false;
      if (visiting.has(name)) {
        errors.push({
          message: `Circular dependency detected: ${[...pathHistory, name].join(' -> ')}`,
          file: filePath,
          severity: 'error',
          code: 'CIRCULAR_DEPENDENCY',
        });
        return true;
      }

      visiting.add(name);
      const release = releaseMap.get(name);
      if (release) {
        for (const dep of release.needs) {
          if (visit(dep, [...pathHistory, name])) {
            return true;
          }
        }
      }
      visiting.delete(name);
      visited.add(name);
      return false;
    };

    for (const release of releases) {
      visit(release.name, []);
    }
  }

  // ============================================================================
  // Graph Generation
  // ============================================================================

  createReleaseNodes(helmfile: Helmfile): readonly HelmfileReleaseNode[] {
    const helmfileId = createHelmfileId(helmfile.filePath);

    return helmfile.releases.map(release => {
      const nodeId = createHelmfileReleaseId(helmfileId, release.name);

      return {
        id: nodeId,
        type: 'helmfile_release' as const,
        name: release.name,
        filePath: helmfile.filePath,
        lineStart: release.lineNumber,
        lineEnd: release.lineNumber,
        location: {
          file: helmfile.filePath,
          lineStart: release.lineNumber ?? 1,
          lineEnd: release.lineNumber ?? 1,
        },
        metadata: {
          releaseName: release.name,
          namespace: release.namespace,
          chartSource: release.chart,
          chartVersion: release.version,
          environmentSpecific: this.hasEnvironmentTemplates(release),
          valuesFiles: release.values,
          dependencyCount: release.needs.length,
        },
      };
    });
  }

  createDependencyEdges(helmfile: Helmfile): readonly HelmfileDependsOnEdge[] {
    const helmfileId = createHelmfileId(helmfile.filePath);
    const edges: HelmfileDependsOnEdge[] = [];

    for (const release of helmfile.releases) {
      for (const need of release.needs) {
        const sourceId = createHelmfileReleaseId(helmfileId, release.name);
        const targetId = createHelmfileReleaseId(helmfileId, need);

        edges.push({
          id: `${sourceId}-depends-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'depends_on',
          label: `${release.name} needs ${need}`,
          metadata: {
            implicit: false,
            confidence: 100,
            dependencyName: need,
            isExplicitNeed: true,
            isHelmfileRelease: true,
          },
        });
      }
    }

    return edges;
  }

  /**
   * Check if release contains environment template expressions
   */
  private hasEnvironmentTemplates(release: HelmfileRelease): boolean {
    const checkString = (s: string): boolean =>
      /\{\{\s*\.Environment\./i.test(s) ||
      /\{\{\s*\.Values\./i.test(s) ||
      /\{\{\s*\.StateValues\./i.test(s);

    // Check values files
    for (const value of release.values) {
      if (checkString(value)) return true;
    }

    // Check condition
    if (release.condition && checkString(release.condition)) return true;

    // Check chart
    if (checkString(release.chart)) return true;

    return false;
  }

  // ============================================================================
  // Result Builders
  // ============================================================================

  private createEmptyResult(
    filePath: string,
    startTime: number,
    content: string,
    errors: HelmfileParseError[],
    warnings: HelmfileParseError[]
  ): HelmfileParseResult {
    return {
      success: false,
      helmfile: undefined,
      nodes: [],
      edges: [],
      errors,
      warnings,
      metadata: {
        filePath,
        parserName: this.name,
        parserVersion: this.version,
        parseTimeMs: performance.now() - startTime,
        fileSize: content.length,
        lineCount: content.split('\n').length,
        releaseCount: 0,
        environmentCount: 0,
        repositoryCount: 0,
      },
    };
  }

  private createHelmfileMetadata(
    filePath: string,
    startTime: number,
    content: string,
    helmfile: Helmfile
  ): HelmfileParseMetadata {
    return {
      filePath,
      parserName: this.name,
      parserVersion: this.version,
      parseTimeMs: performance.now() - startTime,
      fileSize: content.length,
      lineCount: content.split('\n').length,
      releaseCount: helmfile.releases.length,
      environmentCount: helmfile.environments.size,
      repositoryCount: helmfile.repositories.length,
    };
  }
}

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Create graph nodes and edges from a parsed Helmfile
 */
export function createHelmfileGraph(helmfile: Helmfile): {
  nodes: readonly HelmfileReleaseNode[];
  edges: readonly HelmfileDependsOnEdge[];
} {
  const parser = new HelmfileParser();
  const nodes = parser.createReleaseNodes(helmfile);
  const edges = parser.createDependencyEdges(helmfile);
  return { nodes, edges };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Helmfile parser instance
 */
export function createHelmfileParser(
  options?: ParserOptions & Partial<HelmfileParserOptions>
): HelmfileParser {
  return new HelmfileParser(options);
}

/**
 * Parse a helmfile.yaml configuration using async parser
 */
export async function parseHelmfileAsync(
  content: string,
  filePath: string,
  options?: ParserOptions & Partial<HelmfileParserOptions>
): Promise<ParseResult<HelmfileParseResult>> {
  const parser = createHelmfileParser(options);
  return parser.parse(content, filePath);
}

/**
 * Parse helmfile content synchronously
 */
export function parseHelmfileSync(
  content: string,
  filePath: string,
  options?: ParserOptions & Partial<HelmfileParserOptions>
): Helmfile {
  const parser = createHelmfileParser(options);
  return parser.parseContent(content, filePath);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for HelmfileReleaseNode
 */
export function isHelmfileReleaseNode(node: unknown): node is HelmfileReleaseNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'helmfile_release'
  );
}

/**
 * Type guard for HelmfileDependsOnEdge
 */
export function isHelmfileDependsOnEdge(edge: unknown): edge is HelmfileDependsOnEdge {
  return (
    typeof edge === 'object' &&
    edge !== null &&
    'type' in edge &&
    (edge as { type: unknown }).type === 'depends_on' &&
    'metadata' in edge &&
    typeof (edge as any).metadata === 'object' &&
    (edge as any).metadata !== null &&
    'isHelmfileRelease' in (edge as any).metadata &&
    (edge as any).metadata.isHelmfileRelease === true
  );
}

// ============================================================================
// ID Generation Helper Functions
// ============================================================================

/** Counter for unique ID generation */
let nodeIdCounter = 0;
let edgeIdCounter = 0;

/**
 * Generate a unique node ID for Helmfile graph nodes.
 * @param prefix - Optional prefix for the ID (default: 'hf-node')
 * @returns A unique node ID string
 */
export function generateNodeId(prefix: string = 'hf-node'): string {
  return `${prefix}-${++nodeIdCounter}-${Date.now().toString(36)}`;
}

/**
 * Generate a unique edge ID for Helmfile graph edges.
 * @param prefix - Optional prefix for the ID (default: 'hf-edge')
 * @returns A unique edge ID string
 */
export function generateEdgeId(prefix: string = 'hf-edge'): string {
  return `${prefix}-${++edgeIdCounter}-${Date.now().toString(36)}`;
}

/**
 * Reset ID counters (useful for testing).
 */
export function resetIdCounters(): void {
  nodeIdCounter = 0;
  edgeIdCounter = 0;
}

// ============================================================================
// Need Reference Parser
// ============================================================================

/**
 * Parsed need reference structure
 */
export interface ParsedNeedReference {
  /** Namespace of the dependency (if specified) */
  readonly namespace: string | null;
  /** Release name of the dependency */
  readonly releaseName: string;
  /** Original raw reference string */
  readonly raw: string;
}

/**
 * Parse a Helmfile need reference string.
 * Handles both simple release names and "namespace/release" format.
 *
 * @param reference - The need reference string (e.g., "nginx" or "kube-system/nginx")
 * @returns Parsed need reference with namespace and release name
 *
 * @example
 * parseNeedReference("nginx")
 * // Returns: { namespace: null, releaseName: "nginx", raw: "nginx" }
 *
 * @example
 * parseNeedReference("kube-system/nginx")
 * // Returns: { namespace: "kube-system", releaseName: "nginx", raw: "kube-system/nginx" }
 */
export function parseNeedReference(reference: string): ParsedNeedReference {
  const trimmed = reference.trim();

  // Check for namespace/release format
  const slashIndex = trimmed.indexOf('/');

  if (slashIndex > 0 && slashIndex < trimmed.length - 1) {
    return {
      namespace: trimmed.substring(0, slashIndex),
      releaseName: trimmed.substring(slashIndex + 1),
      raw: trimmed,
    };
  }

  // Simple release name without namespace
  return {
    namespace: null,
    releaseName: trimmed,
    raw: trimmed,
  };
}

/**
 * Format a need reference from namespace and release name.
 * @param namespace - Optional namespace
 * @param releaseName - Release name
 * @returns Formatted reference string
 */
export function formatNeedReference(namespace: string | null, releaseName: string): string {
  if (namespace) {
    return `${namespace}/${releaseName}`;
  }
  return releaseName;
}
