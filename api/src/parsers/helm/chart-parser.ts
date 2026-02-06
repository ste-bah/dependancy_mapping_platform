/**
 * Helm Chart Parser
 * @module parsers/helm/chart-parser
 *
 * Parses Chart.yaml and requirements.yaml files for Helm charts.
 * Handles both Helm 2 (requirements.yaml) and Helm 3 (dependencies in Chart.yaml) formats.
 *
 * TASK-DETECT-006: Helm chart structure detection
 */

import * as yaml from 'yaml';
import {
  BaseParser,
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
} from '../base/parser';
import {
  ChartMetadata,
  ChartDependency,
  ChartApiVersion,
  ChartType,
  ChartMaintainer,
  ChartValueImport,
  HelmParseError,
  HelmParseErrorCode,
  HelmChartNodeData,
  HelmValuesFile,
  HelmTemplateFile,
  K8sResourceExtraction,
  createHelmChartId,
  createEmptyChartMetadata,
} from './types';
import { NodeLocation } from '../../types/graph';

// ============================================================================
// Chart Parse Result Types
// ============================================================================

/**
 * Result of parsing a Chart.yaml file
 */
export interface ChartParseResult {
  /** Chart metadata */
  readonly metadata: ChartMetadata;
  /** Dependencies (from Chart.yaml or requirements.yaml) */
  readonly dependencies: readonly ChartDependency[];
  /** Source location */
  readonly location: NodeLocation;
  /** Parse warnings */
  readonly warnings: readonly HelmParseError[];
}

/**
 * Input for chart parsing - raw YAML content
 */
export interface ChartParseInput {
  /** Chart.yaml content */
  readonly chartYaml: string;
  /** Optional requirements.yaml content (Helm 2) */
  readonly requirementsYaml?: string;
  /** File path for error reporting */
  readonly filePath: string;
}

// ============================================================================
// Helm Chart Parser
// ============================================================================

/**
 * Parser for Helm Chart.yaml and requirements.yaml files.
 * Supports both Helm v2 and v3 chart formats.
 */
export class HelmChartParser extends BaseParser<ChartParseResult> {
  readonly name = 'helm-chart-parser';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yaml', '.yml'];
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml'];

  /**
   * Parse Chart.yaml content into chart metadata
   */
  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<ChartParseResult>> {
    const startTime = performance.now();
    const warnings: HelmParseError[] = [];
    const lineCount = content.split('\n').length;

    try {
      // Parse YAML content
      const parsed = this.parseYaml(content, filePath);
      if (!parsed.success) {
        return this.createFailure(
          [{
            code: 'SYNTAX_ERROR',
            message: parsed.error,
            location: this.createLocation(filePath, 1, lineCount, 0, 0),
            severity: 'fatal',
          }],
          null,
          this.createMetadata(filePath, startTime, content)
        );
      }

      const chartData = parsed.data;

      // Validate required fields
      const validationErrors = this.validateChartYaml(chartData, filePath);
      if (validationErrors.length > 0) {
        const fatalErrors = validationErrors.filter(e => e.severity === 'error');
        if (fatalErrors.length > 0 && options.strictMode) {
          return this.createFailure(
            fatalErrors.map(e => ({
              code: 'INVALID_EXPRESSION' as const,
              message: e.message,
              location: this.createLocation(filePath, e.line ?? 1, e.line ?? 1, 0, 0),
              severity: 'error' as const,
            })),
            null,
            this.createMetadata(filePath, startTime, content)
          );
        }
        warnings.push(...validationErrors.filter(e => e.severity === 'warning'));
      }

      // Extract chart metadata
      const metadata = this.extractChartMetadata(chartData, warnings);

      // Extract dependencies
      const dependencies = this.extractDependencies(chartData, warnings);

      const result: ChartParseResult = {
        metadata,
        dependencies,
        location: this.createLocation(filePath, 1, lineCount, 0, content.length),
        warnings,
      };

      return this.createSuccess(
        result,
        warnings.map(w => ({
          code: w.code,
          message: w.message,
          location: w.line ? this.createLocation(filePath, w.line, w.line, w.column ?? 0, w.column ?? 0) : null,
          severity: 'warning' as const,
        })),
        this.createMetadata(filePath, startTime, content)
      );
    } catch (error) {
      return this.createFailure(
        [{
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error),
          location: null,
          severity: 'fatal',
        }],
        null,
        this.createMetadata(filePath, startTime, content)
      );
    }
  }

  /**
   * Check if content looks like a Chart.yaml file
   */
  canParse(filePath: string, content?: string): boolean {
    if (!super.canParse(filePath)) {
      return false;
    }

    // Check filename
    const filename = filePath.split('/').pop()?.toLowerCase();
    if (filename !== 'chart.yaml' && filename !== 'chart.yml') {
      return false;
    }

    // If content provided, check for chart markers
    if (content) {
      return content.includes('apiVersion:') &&
             (content.includes('name:') || content.includes('version:'));
    }

    return true;
  }

  // ============================================================================
  // YAML Parsing
  // ============================================================================

  private parseYaml(content: string, filePath: string): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
    try {
      const data = yaml.parse(content, {
        strict: false,
        uniqueKeys: false,
      });

      if (typeof data !== 'object' || data === null) {
        return { success: false, error: 'Chart.yaml must be a YAML object' };
      }

      return { success: true, data: data as Record<string, unknown> };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `YAML parse error: ${message}` };
    }
  }

  // ============================================================================
  // Validation
  // ============================================================================

  private validateChartYaml(data: Record<string, unknown>, filePath: string): HelmParseError[] {
    const errors: HelmParseError[] = [];

    // Required fields
    if (!data.apiVersion) {
      errors.push({
        message: 'Missing required field: apiVersion',
        file: filePath,
        severity: 'error',
        code: 'INVALID_CHART_YAML',
      });
    }

    if (!data.name) {
      errors.push({
        message: 'Missing required field: name',
        file: filePath,
        severity: 'error',
        code: 'INVALID_CHART_YAML',
      });
    }

    if (!data.version) {
      errors.push({
        message: 'Missing required field: version',
        file: filePath,
        severity: 'error',
        code: 'INVALID_CHART_YAML',
      });
    }

    // Validate apiVersion
    if (data.apiVersion && !['v1', 'v2'].includes(String(data.apiVersion))) {
      errors.push({
        message: `Invalid apiVersion: ${data.apiVersion}. Expected 'v1' or 'v2'`,
        file: filePath,
        severity: 'warning',
        code: 'INVALID_CHART_YAML',
      });
    }

    // Validate chart type (Helm v2 only)
    if (data.type && !['application', 'library'].includes(String(data.type))) {
      errors.push({
        message: `Invalid chart type: ${data.type}. Expected 'application' or 'library'`,
        file: filePath,
        severity: 'warning',
        code: 'INVALID_CHART_YAML',
      });
    }

    // Validate version format (SemVer)
    if (data.version && typeof data.version === 'string') {
      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
      if (!semverRegex.test(data.version)) {
        errors.push({
          message: `Version '${data.version}' does not follow SemVer format`,
          file: filePath,
          severity: 'warning',
          code: 'INVALID_CHART_YAML',
        });
      }
    }

    // Validate dependencies structure
    if (data.dependencies) {
      if (!Array.isArray(data.dependencies)) {
        errors.push({
          message: 'dependencies must be an array',
          file: filePath,
          severity: 'error',
          code: 'INVALID_DEPENDENCY',
        });
      } else {
        data.dependencies.forEach((dep: unknown, index: number) => {
          const depErrors = this.validateDependency(dep, index, filePath);
          errors.push(...depErrors);
        });
      }
    }

    return errors;
  }

  private validateDependency(dep: unknown, index: number, filePath: string): HelmParseError[] {
    const errors: HelmParseError[] = [];
    const prefix = `dependencies[${index}]`;

    if (typeof dep !== 'object' || dep === null) {
      errors.push({
        message: `${prefix} must be an object`,
        file: filePath,
        severity: 'error',
        code: 'INVALID_DEPENDENCY',
      });
      return errors;
    }

    const depObj = dep as Record<string, unknown>;

    if (!depObj.name) {
      errors.push({
        message: `${prefix}: missing required field 'name'`,
        file: filePath,
        severity: 'error',
        code: 'INVALID_DEPENDENCY',
      });
    }

    if (!depObj.version) {
      errors.push({
        message: `${prefix}: missing required field 'version'`,
        file: filePath,
        severity: 'warning',
        code: 'INVALID_DEPENDENCY',
      });
    }

    if (!depObj.repository) {
      errors.push({
        message: `${prefix}: missing required field 'repository'`,
        file: filePath,
        severity: 'warning',
        code: 'INVALID_DEPENDENCY',
      });
    }

    return errors;
  }

  // ============================================================================
  // Metadata Extraction
  // ============================================================================

  private extractChartMetadata(data: Record<string, unknown>, warnings: HelmParseError[]): ChartMetadata {
    const apiVersion = this.parseApiVersion(data.apiVersion);
    const name = String(data.name ?? 'unknown');
    const version = String(data.version ?? '0.0.0');

    return {
      apiVersion,
      name,
      version,
      kubeVersion: this.asOptionalString(data.kubeVersion),
      description: this.asOptionalString(data.description),
      type: this.parseChartType(data.type),
      keywords: this.parseStringArray(data.keywords),
      home: this.asOptionalString(data.home),
      sources: this.parseStringArray(data.sources),
      dependencies: this.extractDependencies(data, warnings),
      maintainers: this.parseMaintainers(data.maintainers),
      icon: this.asOptionalString(data.icon),
      appVersion: this.asOptionalString(data.appVersion),
      deprecated: data.deprecated === true,
      annotations: this.parseAnnotations(data.annotations),
    };
  }

  private parseApiVersion(value: unknown): ChartApiVersion {
    const str = String(value ?? 'v2');
    return str === 'v1' ? 'v1' : 'v2';
  }

  private parseChartType(value: unknown): ChartType {
    if (value === 'library') {
      return 'library';
    }
    return 'application';
  }

  private asOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return String(value);
  }

  private parseStringArray(value: unknown): readonly string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value.filter(v => typeof v === 'string') as string[];
  }

  private parseMaintainers(value: unknown): readonly ChartMaintainer[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map(m => ({
        name: String(m.name ?? ''),
        email: this.asOptionalString(m.email),
        url: this.asOptionalString(m.url),
      }));
  }

  private parseAnnotations(value: unknown): Record<string, string> | undefined {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }

    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = String(val);
    }
    return result;
  }

  // ============================================================================
  // Dependency Extraction
  // ============================================================================

  private extractDependencies(data: Record<string, unknown>, warnings: HelmParseError[]): readonly ChartDependency[] {
    const deps = data.dependencies;
    if (!Array.isArray(deps)) {
      return [];
    }

    return deps
      .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
      .map((d) => this.parseDependency(d, warnings));
  }

  private parseDependency(data: Record<string, unknown>, warnings: HelmParseError[]): ChartDependency {
    const importValues = this.parseImportValues(data.importValues ?? data['import-values']);

    return {
      name: String(data.name ?? ''),
      version: String(data.version ?? '*'),
      repository: String(data.repository ?? ''),
      condition: this.asOptionalString(data.condition),
      tags: this.parseStringArray(data.tags),
      importValues,
      alias: this.asOptionalString(data.alias),
    };
  }

  private parseImportValues(value: unknown): readonly (string | ChartValueImport)[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.map(v => {
      if (typeof v === 'string') {
        return v;
      }
      if (typeof v === 'object' && v !== null) {
        const obj = v as Record<string, unknown>;
        return {
          child: String(obj.child ?? ''),
          parent: String(obj.parent ?? ''),
        };
      }
      return String(v);
    });
  }
}

// ============================================================================
// Requirements Parser (Helm 2 Compatibility)
// ============================================================================

/**
 * Parser for Helm 2 requirements.yaml files
 */
export class HelmRequirementsParser extends BaseParser<readonly ChartDependency[]> {
  readonly name = 'helm-requirements-parser';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yaml', '.yml'];
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml'];

  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<readonly ChartDependency[]>> {
    const startTime = performance.now();
    const warnings: ParseDiagnostic[] = [];

    try {
      const data = yaml.parse(content);

      if (typeof data !== 'object' || data === null) {
        return this.createFailure(
          [{
            code: 'SYNTAX_ERROR',
            message: 'requirements.yaml must be a YAML object',
            location: null,
            severity: 'fatal',
          }],
          null,
          this.createMetadata(filePath, startTime, content)
        );
      }

      const deps = data.dependencies;
      if (!Array.isArray(deps)) {
        return this.createSuccess(
          [],
          [],
          this.createMetadata(filePath, startTime, content)
        );
      }

      const dependencies: ChartDependency[] = deps
        .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
        .map((d) => ({
          name: String(d.name ?? ''),
          version: String(d.version ?? '*'),
          repository: String(d.repository ?? ''),
          condition: d.condition ? String(d.condition) : undefined,
          tags: Array.isArray(d.tags) ? d.tags.map(String) : undefined,
          alias: d.alias ? String(d.alias) : undefined,
        }));

      return this.createSuccess(
        dependencies,
        warnings,
        this.createMetadata(filePath, startTime, content)
      );
    } catch (error) {
      return this.createFailure(
        [{
          code: 'SYNTAX_ERROR',
          message: error instanceof Error ? error.message : String(error),
          location: null,
          severity: 'fatal',
        }],
        null,
        this.createMetadata(filePath, startTime, content)
      );
    }
  }

  canParse(filePath: string, content?: string): boolean {
    const filename = filePath.split('/').pop()?.toLowerCase();
    return filename === 'requirements.yaml' || filename === 'requirements.yml';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Helm chart parser instance
 */
export function createChartParser(options?: ParserOptions): HelmChartParser {
  return new HelmChartParser(options);
}

/**
 * Create a new requirements parser instance
 */
export function createRequirementsParser(options?: ParserOptions): HelmRequirementsParser {
  return new HelmRequirementsParser(options);
}

/**
 * Parse Chart.yaml content directly
 */
export async function parseChartYaml(
  content: string,
  filePath: string = 'Chart.yaml',
  options?: ParserOptions
): Promise<ParseResult<ChartParseResult>> {
  const parser = createChartParser(options);
  return parser.parse(content, filePath);
}

/**
 * Build a complete HelmChartNodeData from parsed chart data
 */
export function buildChartNode(
  parseResult: ChartParseResult,
  chartPath: string,
  valuesFiles: readonly HelmValuesFile[] = [],
  templates: readonly HelmTemplateFile[] = [],
  resources: readonly K8sResourceExtraction[] = []
): HelmChartNodeData {
  return {
    id: createHelmChartId(parseResult.metadata.name),
    type: 'helm_chart',
    name: parseResult.metadata.name,
    metadata: parseResult.metadata,
    chartPath,
    valuesFiles,
    templates,
    resources,
    dependencies: parseResult.dependencies,
    location: parseResult.location,
  };
}

// ============================================================================
// Note: HelmChartParser and HelmRequirementsParser are exported inline above
// ============================================================================
