/**
 * Helm Values Parser
 * @module parsers/helm/values-parser
 *
 * Parses values.yaml files for Helm charts.
 * Detects external references (image repos, configmaps, secrets) and tracks value overrides.
 *
 * TASK-DETECT-008: Helm values parsing and reference detection
 */

import * as yaml from 'yaml';
import {
  BaseParser,
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
} from '../base/parser';
import {
  HelmValuesFile,
  HelmValuesPath,
  HelmValueType,
  ValuesReference,
  HelmParseError,
  createHelmValuesPath,
} from './types';
import { NodeLocation } from '../../types/graph';

// ============================================================================
// Values Parse Result Types
// ============================================================================

/**
 * Result of parsing a values.yaml file
 */
export interface ValuesParseResult {
  /** Parsed values as a nested object */
  readonly values: Record<string, unknown>;
  /** All flattened paths in the values hierarchy */
  readonly paths: readonly HelmValuesPath[];
  /** External references detected */
  readonly externalRefs: readonly ExternalReference[];
  /** Value type annotations */
  readonly typeAnnotations: ReadonlyMap<HelmValuesPath, HelmValueType>;
  /** Source location */
  readonly location: NodeLocation;
  /** Parse warnings */
  readonly warnings: readonly HelmParseError[];
}

/**
 * External reference detected in values
 */
export interface ExternalReference {
  /** Reference type */
  readonly type: ExternalRefType;
  /** Path in values where reference is found */
  readonly path: HelmValuesPath;
  /** Reference value */
  readonly value: string;
  /** Additional metadata */
  readonly metadata: ExternalRefMetadata;
}

/**
 * Types of external references
 */
export type ExternalRefType =
  | 'image_repository'  // Container image repository
  | 'image_tag'         // Container image tag
  | 'configmap'         // ConfigMap reference
  | 'secret'            // Secret reference
  | 'pvc'              // PersistentVolumeClaim
  | 'service'          // Service reference
  | 'ingress_host'     // Ingress hostname
  | 'storage_class'    // StorageClass reference
  | 'external_url'     // External URL/endpoint
  | 'resource_name';   // Generic resource name

/**
 * Metadata for external references
 */
export interface ExternalRefMetadata {
  /** Whether the value uses a template expression */
  readonly hasTemplateExpression: boolean;
  /** Confidence level of detection (0-100) */
  readonly confidence: number;
  /** Detection method used */
  readonly method: 'path_pattern' | 'value_pattern' | 'structure_analysis';
}

// ============================================================================
// Path Patterns for Reference Detection
// ============================================================================

const REFERENCE_PATTERNS: Record<ExternalRefType, { paths: RegExp[]; values?: RegExp[] }> = {
  image_repository: {
    paths: [
      /\.image\.repository$/i,
      /\.image$/i,
      /\.repository$/i,
      /images?\[\d+\]\.repository$/i,
      /containers?\[\d+\]\.image$/i,
    ],
    values: [
      /^[a-z0-9-]+(\.[a-z0-9-]+)*\/[a-z0-9-]+$/i, // registry/image
      /^[a-z0-9-]+\/[a-z0-9-]+$/i, // org/image
    ],
  },
  image_tag: {
    paths: [
      /\.image\.tag$/i,
      /\.tag$/i,
      /images?\[\d+\]\.tag$/i,
    ],
    values: [
      /^v?\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i, // semver
      /^[a-f0-9]{7,40}$/i, // git sha
      /^(latest|stable|edge|canary)$/i, // common tags
    ],
  },
  configmap: {
    paths: [
      /\.configMap$/i,
      /\.configMapRef$/i,
      /\.configMapName$/i,
      /configMaps?\[\d+\]\.name$/i,
      /\.envFrom\[\d+\]\.configMapRef\.name$/i,
    ],
  },
  secret: {
    paths: [
      /\.secret$/i,
      /\.secretRef$/i,
      /\.secretName$/i,
      /secrets?\[\d+\]\.name$/i,
      /\.envFrom\[\d+\]\.secretRef\.name$/i,
      /\.tls\[\d+\]\.secretName$/i,
      /\.imagePullSecrets?\[\d+\]\.name$/i,
    ],
  },
  pvc: {
    paths: [
      /\.persistentVolumeClaim$/i,
      /\.pvc$/i,
      /\.claimName$/i,
      /\.volumes?\[\d+\]\.persistentVolumeClaim\.claimName$/i,
    ],
  },
  service: {
    paths: [
      /\.serviceName$/i,
      /\.service\.name$/i,
      /\.backend\.serviceName$/i,
      /\.backend\.service\.name$/i,
    ],
  },
  ingress_host: {
    paths: [
      /\.ingress\.hosts?\[\d+\]$/i,
      /\.ingress\.hosts?\[\d+\]\.host$/i,
      /\.hostname$/i,
      /\.hosts?\[\d+\]$/i,
    ],
    values: [
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i, // hostname
    ],
  },
  storage_class: {
    paths: [
      /\.storageClass$/i,
      /\.storageClassName$/i,
    ],
  },
  external_url: {
    paths: [
      /\.url$/i,
      /\.endpoint$/i,
      /\.externalUrl$/i,
      /\.apiUrl$/i,
    ],
    values: [
      /^https?:\/\//i,
      /^postgresql:\/\//i,
      /^mysql:\/\//i,
      /^mongodb:\/\//i,
      /^redis:\/\//i,
    ],
  },
  resource_name: {
    paths: [
      /\.name$/i,
      /\.fullnameOverride$/i,
      /\.nameOverride$/i,
    ],
  },
};

// ============================================================================
// Helm Values Parser
// ============================================================================

/**
 * Parser for Helm values.yaml files.
 * Extracts value paths and detects external references.
 */
export class HelmValuesParser extends BaseParser<ValuesParseResult> {
  readonly name = 'helm-values-parser';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yaml', '.yml'];
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml'];

  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<ValuesParseResult>> {
    const startTime = performance.now();
    const warnings: HelmParseError[] = [];
    const lineCount = content.split('\n').length;

    try {
      // Parse YAML content
      const values = this.parseYaml(content, filePath);
      if (!values.success) {
        return this.createFailure(
          [{
            code: 'SYNTAX_ERROR',
            message: values.error,
            location: this.createLocation(filePath, 1, lineCount, 0, 0),
            severity: 'fatal',
          }],
          null,
          this.createMetadata(filePath, startTime, content)
        );
      }

      // Flatten all paths
      const paths = this.flattenPaths(values.data);

      // Detect external references
      const externalRefs = this.detectExternalReferences(values.data, paths);

      // Annotate value types
      const typeAnnotations = this.annotateValueTypes(values.data, paths);

      const result: ValuesParseResult = {
        values: values.data,
        paths,
        externalRefs,
        typeAnnotations,
        location: this.createLocation(filePath, 1, lineCount, 0, content.length),
        warnings,
      };

      return this.createSuccess(
        result,
        warnings.map(w => ({
          code: w.code,
          message: w.message,
          location: w.line ? this.createLocation(filePath, w.line, w.line, 0, 0) : null,
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

  canParse(filePath: string, content?: string): boolean {
    if (!super.canParse(filePath)) {
      return false;
    }

    const filename = filePath.split('/').pop()?.toLowerCase() ?? '';

    // Match values.yaml, values-*.yaml, values/*.yaml
    return filename === 'values.yaml' ||
           filename === 'values.yml' ||
           filename.startsWith('values-') ||
           filePath.includes('/values/');
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

      // Empty YAML is valid
      if (data === null || data === undefined) {
        return { success: true, data: {} };
      }

      if (typeof data !== 'object') {
        return { success: false, error: 'values.yaml must be a YAML object' };
      }

      return { success: true, data: data as Record<string, unknown> };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `YAML parse error: ${message}` };
    }
  }

  // ============================================================================
  // Path Extraction
  // ============================================================================

  /**
   * Flatten a nested object into dot-separated paths
   */
  private flattenPaths(obj: Record<string, unknown>, prefix: string = ''): readonly HelmValuesPath[] {
    const paths: HelmValuesPath[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      paths.push(createHelmValuesPath(currentPath));

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          const arrayPath = `${currentPath}[${index}]`;
          paths.push(createHelmValuesPath(arrayPath));

          if (typeof item === 'object' && item !== null) {
            paths.push(...this.flattenPaths(item as Record<string, unknown>, arrayPath));
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        paths.push(...this.flattenPaths(value as Record<string, unknown>, currentPath));
      }
    }

    return paths;
  }

  // ============================================================================
  // External Reference Detection
  // ============================================================================

  private detectExternalReferences(
    values: Record<string, unknown>,
    paths: readonly HelmValuesPath[]
  ): readonly ExternalReference[] {
    const refs: ExternalReference[] = [];

    for (const path of paths) {
      const value = this.getValueAtPath(values, path);

      if (typeof value !== 'string' && typeof value !== 'number') {
        continue;
      }

      const stringValue = String(value);
      const detected = this.detectReferenceType(path, stringValue);

      if (detected) {
        refs.push({
          type: detected.type,
          path,
          value: stringValue,
          metadata: {
            hasTemplateExpression: this.hasTemplateExpression(stringValue),
            confidence: detected.confidence,
            method: detected.method,
          },
        });
      }
    }

    return refs;
  }

  private detectReferenceType(
    path: HelmValuesPath,
    value: string
  ): { type: ExternalRefType; confidence: number; method: ExternalRefMetadata['method'] } | null {
    // Check path patterns first (higher confidence)
    for (const [refType, patterns] of Object.entries(REFERENCE_PATTERNS)) {
      for (const pathPattern of patterns.paths) {
        if (pathPattern.test(path)) {
          return {
            type: refType as ExternalRefType,
            confidence: 90,
            method: 'path_pattern',
          };
        }
      }
    }

    // Check value patterns
    for (const [refType, patterns] of Object.entries(REFERENCE_PATTERNS)) {
      if (patterns.values) {
        for (const valuePattern of patterns.values) {
          if (valuePattern.test(value)) {
            return {
              type: refType as ExternalRefType,
              confidence: 70,
              method: 'value_pattern',
            };
          }
        }
      }
    }

    return null;
  }

  private hasTemplateExpression(value: string): boolean {
    return /\{\{.*\}\}/.test(value) || /\$\{.*\}/.test(value);
  }

  // ============================================================================
  // Value Type Annotation
  // ============================================================================

  private annotateValueTypes(
    values: Record<string, unknown>,
    paths: readonly HelmValuesPath[]
  ): ReadonlyMap<HelmValuesPath, HelmValueType> {
    const annotations = new Map<HelmValuesPath, HelmValueType>();

    for (const path of paths) {
      const value = this.getValueAtPath(values, path);
      const type = this.inferValueType(path, value);
      annotations.set(path, type);
    }

    return annotations;
  }

  private inferValueType(path: HelmValuesPath, value: unknown): HelmValueType {
    // Check based on path patterns
    if (/\.image\.repository$/i.test(path) || /\.image$/i.test(path)) {
      return 'image';
    }
    if (/\.secret/i.test(path)) {
      return 'secret';
    }
    if (/\.configMap/i.test(path)) {
      return 'configmap';
    }
    if (/\.port$/i.test(path) || /Port$/i.test(path)) {
      return 'port';
    }
    if (/\.selector/i.test(path)) {
      return 'selector';
    }
    if (/\.resources$/i.test(path) || /\.limits$/i.test(path) || /\.requests$/i.test(path)) {
      return 'resource';
    }

    // Infer from value type
    if (typeof value === 'string') {
      return 'string';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    if (typeof value === 'object' && value !== null) {
      return 'object';
    }

    return 'unknown';
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = this.parsePath(path);
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof part === 'number' && Array.isArray(current)) {
        current = current[part];
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[String(part)];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private parsePath(path: string): (string | number)[] {
    const parts: (string | number)[] = [];
    const regex = /([^.\[\]]+)|\[(\d+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(path)) !== null) {
      if (match[1] !== undefined) {
        parts.push(match[1]);
      } else if (match[2] !== undefined) {
        parts.push(parseInt(match[2], 10));
      }
    }

    return parts;
  }
}

// ============================================================================
// Value Override Detection
// ============================================================================

/**
 * Value override between base and override values
 */
export interface ValueOverride {
  readonly path: HelmValuesPath;
  readonly baseValue: unknown;
  readonly overrideValue: unknown;
  readonly source: string;
}

/**
 * Detect overrides between base values and override values files
 */
export function detectValueOverrides(
  baseValues: Record<string, unknown>,
  overrideValues: Record<string, unknown>,
  overrideSource: string
): readonly ValueOverride[] {
  const parser = new HelmValuesParser();
  const overrides: ValueOverride[] = [];

  const basePaths = flattenObject(baseValues);
  const overridePaths = flattenObject(overrideValues);

  for (const path of Object.keys(overridePaths)) {
    if (path in basePaths) {
      const baseValue = basePaths[path];
      const overrideValue = overridePaths[path];

      if (!deepEqual(baseValue, overrideValue)) {
        overrides.push({
          path: createHelmValuesPath(path),
          baseValue,
          overrideValue,
          source: overrideSource,
        });
      }
    } else {
      // New value added in override
      overrides.push({
        path: createHelmValuesPath(path),
        baseValue: undefined,
        overrideValue: overridePaths[path],
        source: overrideSource,
      });
    }
  }

  return overrides;
}

function flattenObject(obj: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenObject(item as Record<string, unknown>, `${path}[${index}]`));
        } else {
          result[`${path}[${index}]`] = item;
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, path));
    } else {
      result[path] = value;
    }
  }

  return result;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Helm values parser instance
 */
export function createValuesParser(options?: ParserOptions): HelmValuesParser {
  return new HelmValuesParser(options);
}

/**
 * Parse values.yaml content directly
 */
export async function parseValuesYaml(
  content: string,
  filePath: string = 'values.yaml',
  options?: ParserOptions
): Promise<ParseResult<ValuesParseResult>> {
  const parser = createValuesParser(options);
  return parser.parse(content, filePath);
}

/**
 * Build a HelmValuesFile from parse result
 */
export function buildValuesFile(
  parseResult: ValuesParseResult,
  filePath: string
): HelmValuesFile {
  // Get relative path from chart root
  const parts = filePath.split('/');
  const chartIndex = parts.findIndex(p => p === 'charts' || parts[parts.indexOf(p) + 1] === 'Chart.yaml');
  const relativePath = chartIndex >= 0 ? parts.slice(chartIndex).join('/') : filePath;

  return {
    path: relativePath,
    values: parseResult.values,
    paths: parseResult.paths,
    location: parseResult.location,
  };
}

// ============================================================================
// Note: All types/classes exported inline above
// ============================================================================
