/**
 * Helm Template Analyzer
 * @module parsers/helm/template-analyzer
 *
 * Analyzes Helm templates including _helpers.tpl, extracts K8s resource definitions,
 * and detects template function calls and includes.
 *
 * TASK-DETECT-007: Helm template analysis and K8s resource extraction
 */

import * as yaml from 'yaml';
import {
  BaseParser,
  ParseResult,
  ParserOptions,
} from '../base/parser';
import {
  HelmTemplateFile,
  HelmTemplateCall,
  HelmInclude,
  ValuesReference,
  K8sResourceExtraction,
  K8sResourceKind,
  K8sSpecAnalysis,
  TemplateExpression,
  TemplateExpressionType,
  HelmValuesPath,
  ContainerImageRef,
  ConfigMapRef,
  SecretRef,
  VolumeMountRef,
  PortRef,
  ResourceRequirements,
  createHelmValuesPath,
} from './types';
import { NodeLocation } from '../../types/graph';

// ============================================================================
// Template Analysis Result Types
// ============================================================================

/**
 * Result of analyzing a Helm template file
 */
export interface TemplateAnalysisResult {
  /** Template file metadata */
  readonly file: HelmTemplateFile;
  /** Named templates defined in this file */
  readonly definedTemplates: readonly DefinedTemplate[];
  /** Template includes/calls made */
  readonly templateCalls: readonly HelmTemplateCall[];
  /** Values references */
  readonly valuesRefs: readonly ValuesReference[];
  /** K8s resources extracted */
  readonly resources: readonly K8sResourceExtraction[];
  /** All template expressions found */
  readonly expressions: readonly TemplateExpression[];
}

/**
 * Named template definition (from {{- define "name" }})
 */
export interface DefinedTemplate {
  readonly name: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
}

// ============================================================================
// Template Expression Patterns
// ============================================================================

const TEMPLATE_PATTERNS = {
  // Define block: {{- define "name" }}...{{- end }}
  define: /\{\{-?\s*define\s+["']([^"']+)["']\s*-?\}\}/g,

  // Include/template call: {{ include "name" . }} or {{ template "name" . }}
  include: /\{\{-?\s*(?:include|template)\s+["']([^"']+)["']\s+([^}]*?)\s*-?\}\}/g,

  // Values reference: .Values.x.y.z
  valuesRef: /\.Values((?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[[^\]]+\])+)/g,

  // Release reference: .Release.Name, .Release.Namespace, etc.
  releaseRef: /\.Release\.([a-zA-Z_][a-zA-Z0-9_]*)/g,

  // Chart reference: .Chart.Name, .Chart.Version, etc.
  chartRef: /\.Chart\.([a-zA-Z_][a-zA-Z0-9_]*)/g,

  // Capabilities reference: .Capabilities.APIVersions, etc.
  capabilitiesRef: /\.Capabilities\.([a-zA-Z_][a-zA-Z0-9_.]*)/g,

  // Files reference: .Files.Get, .Files.GetBytes, etc.
  filesRef: /\.Files\.(Get|GetBytes|Lines|AsConfig|AsSecrets)(?:\s+["']([^"']+)["'])?/g,

  // Template expression: {{ ... }}
  templateExpr: /\{\{-?\s*([^}]+?)\s*-?\}\}/g,

  // Range loop: {{- range ... }}
  rangeExpr: /\{\{-?\s*range\s+([^}]+?)\s*-?\}\}/g,

  // Conditional: {{- if/else/else if ... }}
  conditionalExpr: /\{\{-?\s*(if|else\s+if|else)\s*([^}]*?)\s*-?\}\}/g,

  // With block: {{- with ... }}
  withExpr: /\{\{-?\s*with\s+([^}]+?)\s*-?\}\}/g,

  // Function calls: funcname args
  functionCall: /\b(include|template|toYaml|toJson|fromYaml|fromJson|indent|nindent|quote|squote|trim|trimPrefix|trimSuffix|upper|lower|title|replace|split|join|default|empty|coalesce|required|fail|print|printf|lookup|b64enc|b64dec|sha256sum|randAlphaNum|now|date|dateModify|htmlDate|dateInZone|duration|durationRound|ago|unixEpoch|toDate)\s*[(\s]/g,

  // K8s resource markers
  k8sApiVersion: /^apiVersion:\s*(.+)$/m,
  k8sKind: /^kind:\s*(.+)$/m,
  k8sMetadataName: /^metadata:\s*\n\s+name:\s*(.+)$/m,
};

// ============================================================================
// Helm Template Analyzer
// ============================================================================

/**
 * Analyzer for Helm template files.
 * Extracts K8s resources, template calls, and value references.
 */
export class HelmTemplateAnalyzer extends BaseParser<TemplateAnalysisResult> {
  readonly name = 'helm-template-analyzer';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yaml', '.yml', '.tpl'];
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml', 'text/plain'];

  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<TemplateAnalysisResult>> {
    const startTime = performance.now();
    const lines = content.split('\n');
    const lineCount = lines.length;

    try {
      // Extract defined templates
      const definedTemplates = this.extractDefinedTemplates(content, lines);

      // Extract template calls/includes
      const templateCalls = this.extractTemplateCalls(content, lines);

      // Extract includes
      const includes = this.extractIncludes(content, lines);

      // Extract values references
      const valuesRefs = this.extractValuesReferences(content, lines, filePath);

      // Extract all template expressions
      const expressions = this.extractTemplateExpressions(content, lines);

      // Extract K8s resources (only for YAML files, not .tpl)
      const resources = filePath.endsWith('.tpl')
        ? []
        : this.extractK8sResources(content, filePath);

      const file: HelmTemplateFile = {
        path: this.getRelativePath(filePath),
        name: this.extractTemplateName(content, filePath),
        content: options.includeRaw ? content : '',
        resources,
        valuesRefs,
        templateCalls,
        includes,
        location: this.createLocation(filePath, 1, lineCount, 0, content.length),
      };

      const result: TemplateAnalysisResult = {
        file,
        definedTemplates,
        templateCalls,
        valuesRefs,
        resources,
        expressions,
      };

      return this.createSuccess(
        result,
        [],
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
    // Check if file is in templates directory or is a .tpl file
    const isInTemplates = filePath.includes('/templates/');
    const isTpl = filePath.endsWith('.tpl');
    const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');

    return (isInTemplates && (isYaml || isTpl)) || isTpl;
  }

  // ============================================================================
  // Template Definition Extraction
  // ============================================================================

  private extractDefinedTemplates(content: string, lines: string[]): readonly DefinedTemplate[] {
    const templates: DefinedTemplate[] = [];
    const defineRegex = /\{\{-?\s*define\s+["']([^"']+)["']\s*-?\}\}/g;
    const endRegex = /\{\{-?\s*end\s*-?\}\}/g;

    // Find all define blocks
    let match: RegExpExecArray | null;
    const defines: { name: string; startIndex: number; startLine: number }[] = [];

    while ((match = defineRegex.exec(content)) !== null) {
      const startLine = this.getLineNumber(content, match.index);
      defines.push({
        name: match[1],
        startIndex: match.index,
        startLine,
      });
    }

    // For each define, find the matching end
    for (const define of defines) {
      let depth = 1;
      let searchStart = define.startIndex + 10; // Skip past the define
      const nestedDefineRegex = /\{\{-?\s*define\s+["'][^"']+["']\s*-?\}\}/g;
      const endRegexLocal = /\{\{-?\s*end\s*-?\}\}/g;

      // Find matching end by tracking nesting
      const remaining = content.slice(searchStart);
      let endMatch: RegExpExecArray | null;
      let lastEndIndex = searchStart;

      // Simple approach: find the next end after all nested defines are closed
      const allDefines = [...remaining.matchAll(nestedDefineRegex)];
      const allEnds = [...remaining.matchAll(endRegexLocal)];

      let endIndex = 0;
      for (const end of allEnds) {
        const endPosition = end.index!;
        const definesBeforeEnd = allDefines.filter(d => d.index! < endPosition).length;
        const endsBeforeThis = allEnds.slice(0, endIndex).length;

        if (endsBeforeThis >= definesBeforeEnd) {
          // This end matches our define
          const actualEndIndex = searchStart + endPosition;
          const endLine = this.getLineNumber(content, actualEndIndex);
          const templateContent = content.slice(define.startIndex, actualEndIndex + end[0].length);

          templates.push({
            name: define.name,
            startLine: define.startLine,
            endLine,
            content: templateContent,
          });
          break;
        }
        endIndex++;
      }
    }

    return templates;
  }

  // ============================================================================
  // Template Call Extraction
  // ============================================================================

  private extractTemplateCalls(content: string, lines: string[]): readonly HelmTemplateCall[] {
    const calls: HelmTemplateCall[] = [];
    const regex = /\{\{-?\s*(include|template)\s+["']([^"']+)["']\s+([^}]*?)\s*-?\}\}/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      const isDefine = match[1] === 'template';

      calls.push({
        templateName: match[2],
        arguments: this.parseTemplateArguments(match[3]),
        line,
        isDefine,
      });
    }

    return calls;
  }

  private extractIncludes(content: string, lines: string[]): readonly HelmInclude[] {
    const includes: HelmInclude[] = [];
    const regex = /\{\{-?\s*include\s+["']([^"']+)["']\s+([^}]*?)\s*-?\}\}/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      includes.push({
        templateName: match[1],
        context: match[2].trim(),
        line: this.getLineNumber(content, match.index),
      });
    }

    return includes;
  }

  private parseTemplateArguments(argsString: string): readonly string[] {
    const trimmed = argsString.trim();
    if (!trimmed || trimmed === '.') {
      return ['.'];
    }
    // Simple split - could be enhanced for complex arguments
    return [trimmed];
  }

  // ============================================================================
  // Values Reference Extraction
  // ============================================================================

  private extractValuesReferences(
    content: string,
    lines: string[],
    filePath: string
  ): readonly ValuesReference[] {
    const refs: ValuesReference[] = [];
    const regex = /\.Values((?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[[^\]]+\])+)/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const path = this.parseValuesPath(match[1]);
      const lineNumber = this.getLineNumber(content, match.index);
      const line = lines[lineNumber - 1] || '';

      // Check if value is required (using required function)
      const isRequired = this.checkIfRequired(content, match.index);

      // Try to extract default value
      const defaultValue = this.extractDefaultValue(content, match.index);

      refs.push({
        path,
        defaultValue,
        templateFile: filePath,
        lineNumber,
        required: isRequired,
        valueType: this.inferValueType(path, line),
      });
    }

    return refs;
  }

  private parseValuesPath(pathStr: string): HelmValuesPath {
    // Convert .foo.bar or .foo["bar"] to dot notation
    const normalized = pathStr
      .replace(/^\./,  '')  // Remove leading dot
      .replace(/\["([^\]]+)"\]/g, '.$1')  // Convert ["x"] to .x
      .replace(/\['([^\]]+)'\]/g, '.$1'); // Convert ['x'] to .x

    return createHelmValuesPath(normalized);
  }

  private checkIfRequired(content: string, matchIndex: number): boolean {
    // Look for 'required' function call around this reference
    const contextStart = Math.max(0, matchIndex - 100);
    const context = content.slice(contextStart, matchIndex + 100);
    return /\brequired\s/.test(context);
  }

  private extractDefaultValue(content: string, matchIndex: number): unknown | undefined {
    // Look for | default "value" pattern
    const after = content.slice(matchIndex, matchIndex + 200);
    const defaultMatch = after.match(/\|\s*default\s+([^\s|}]+)/);

    if (defaultMatch) {
      const valueStr = defaultMatch[1];
      // Parse the default value
      if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
        return valueStr.slice(1, -1);
      }
      if (valueStr === 'true') return true;
      if (valueStr === 'false') return false;
      if (/^\d+$/.test(valueStr)) return parseInt(valueStr, 10);
      if (/^\d+\.\d+$/.test(valueStr)) return parseFloat(valueStr);
      return valueStr;
    }

    return undefined;
  }

  private inferValueType(path: string, context: string): ValuesReference['valueType'] {
    // Infer type from path patterns
    if (/image\.repository/i.test(path) || /\.image$/i.test(path)) return 'image';
    if (/secret/i.test(path)) return 'secret';
    if (/configMap/i.test(path)) return 'configmap';
    if (/port/i.test(path)) return 'port';
    if (/selector/i.test(path)) return 'selector';
    if (/resources/i.test(path)) return 'resource';

    // Infer from context
    if (/replicas/i.test(context)) return 'number';
    if (/enabled/i.test(context)) return 'boolean';

    return undefined;
  }

  // ============================================================================
  // Template Expression Extraction
  // ============================================================================

  private extractTemplateExpressions(content: string, lines: string[]): readonly TemplateExpression[] {
    const expressions: TemplateExpression[] = [];
    const regex = /\{\{-?\s*([^}]+?)\s*-?\}\}/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const exprContent = match[1].trim();
      const line = this.getLineNumber(content, match.index);
      const column = match.index - content.lastIndexOf('\n', match.index) - 1;

      expressions.push({
        raw: match[0],
        type: this.classifyExpression(exprContent),
        valuesPath: this.extractValuesPathFromExpr(exprContent),
        line,
        column,
      });
    }

    return expressions;
  }

  private classifyExpression(expr: string): TemplateExpressionType {
    if (expr.startsWith('define ')) return 'define';
    if (expr.startsWith('range ')) return 'range';
    if (expr.startsWith('if ') || expr === 'else' || expr.startsWith('else if')) return 'conditional';
    if (expr.startsWith('with ')) return 'with';
    if (expr.startsWith('include ') || expr.startsWith('template ')) return 'template';
    if (/^\.Values/.test(expr)) return 'values';
    if (/^\.Release/.test(expr)) return 'release';
    if (/^\.Chart/.test(expr)) return 'chart';
    if (/^\.Files/.test(expr)) return 'files';
    if (/^\.Capabilities/.test(expr)) return 'capabilities';
    if (/^\w+\s/.test(expr)) return 'function';

    return 'unknown';
  }

  private extractValuesPathFromExpr(expr: string): HelmValuesPath | undefined {
    const match = expr.match(/\.Values((?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[[^\]]+\])+)/);
    if (match) {
      return this.parseValuesPath(match[1]);
    }
    return undefined;
  }

  // ============================================================================
  // K8s Resource Extraction
  // ============================================================================

  private extractK8sResources(content: string, filePath: string): readonly K8sResourceExtraction[] {
    const resources: K8sResourceExtraction[] = [];

    // Split by YAML document separator
    const documents = content.split(/^---$/m);

    for (const doc of documents) {
      const trimmed = doc.trim();
      if (!trimmed) continue;

      // Check for apiVersion and kind markers
      const apiVersionMatch = trimmed.match(/^apiVersion:\s*(.+)$/m);
      const kindMatch = trimmed.match(/^kind:\s*(.+)$/m);

      if (apiVersionMatch && kindMatch) {
        const resource = this.parseK8sResource(trimmed, filePath);
        if (resource) {
          resources.push(resource);
        }
      }
    }

    return resources;
  }

  private parseK8sResource(content: string, filePath: string): K8sResourceExtraction | null {
    try {
      // Extract apiVersion and kind first (they're always at root level)
      const apiVersionMatch = content.match(/^apiVersion:\s*(.+)$/m);
      const kindMatch = content.match(/^kind:\s*(.+)$/m);

      if (!apiVersionMatch || !kindMatch) {
        return null;
      }

      const apiVersion = apiVersionMatch[1].trim();
      const kind = kindMatch[1].trim() as K8sResourceKind;

      // Extract name (may contain template expressions)
      const nameMatch = content.match(/metadata:\s*\n(?:.*\n)*?\s*name:\s*(.+)$/m);
      const name = nameMatch ? nameMatch[1].trim() : '{{ .Release.Name }}';

      // Extract namespace
      const namespaceMatch = content.match(/metadata:\s*\n(?:.*\n)*?\s*namespace:\s*(.+)$/m);
      const namespace = namespaceMatch ? namespaceMatch[1].trim() : undefined;

      // Extract labels
      const labels = this.extractLabels(content);

      // Extract annotations
      const annotations = this.extractAnnotations(content);

      // Check for template expressions
      const templateExpressions = this.extractK8sTemplateExpressions(content);
      const hasTemplateExpressions = templateExpressions.length > 0;

      // Get line range
      const lines = content.split('\n');
      const lineRange = {
        start: 1,
        end: lines.length,
      };

      // Analyze spec
      const specAnalysis = this.analyzeK8sSpec(content, kind);

      return {
        apiVersion,
        kind,
        name,
        namespace,
        labels,
        annotations,
        hasTemplateExpressions,
        templateExpressions,
        lineRange,
        specAnalysis,
      };
    } catch (error) {
      // Failed to parse resource, return null
      return null;
    }
  }

  private extractLabels(content: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const labelsSection = content.match(/labels:\s*\n((?:\s+.+\n)*)/);

    if (labelsSection) {
      const labelLines = labelsSection[1].split('\n');
      for (const line of labelLines) {
        const match = line.match(/^\s+([^:]+):\s*(.+)$/);
        if (match) {
          labels[match[1].trim()] = match[2].trim();
        }
      }
    }

    return labels;
  }

  private extractAnnotations(content: string): Record<string, string> {
    const annotations: Record<string, string> = {};
    const annotationsSection = content.match(/annotations:\s*\n((?:\s+.+\n)*)/);

    if (annotationsSection) {
      const annotationLines = annotationsSection[1].split('\n');
      for (const line of annotationLines) {
        const match = line.match(/^\s+([^:]+):\s*(.+)$/);
        if (match) {
          annotations[match[1].trim()] = match[2].trim();
        }
      }
    }

    return annotations;
  }

  private extractK8sTemplateExpressions(content: string): readonly TemplateExpression[] {
    const expressions: TemplateExpression[] = [];
    const regex = /\{\{-?\s*([^}]+?)\s*-?\}\}/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      const column = match.index - content.lastIndexOf('\n', match.index) - 1;

      expressions.push({
        raw: match[0],
        type: this.classifyExpression(match[1].trim()),
        valuesPath: this.extractValuesPathFromExpr(match[1]),
        line,
        column,
      });
    }

    return expressions;
  }

  private analyzeK8sSpec(content: string, kind: K8sResourceKind): K8sSpecAnalysis {
    const analysis: K8sSpecAnalysis = {
      images: [],
      configMapRefs: [],
      secretRefs: [],
      serviceAccountRef: undefined,
      volumeMounts: [],
      selectorLabels: {},
      ports: [],
      resources: undefined,
    };

    // Extract images
    const imageMatches = content.matchAll(/image:\s*(.+)$/gm);
    for (const match of imageMatches) {
      const imageRef = this.parseImageRef(match[1].trim());
      if (imageRef) {
        analysis.images.push(imageRef);
      }
    }

    // Extract ConfigMap references
    const configMapMatches = content.matchAll(/configMapRef:\s*\n\s*name:\s*(.+)$/gm);
    for (const match of configMapMatches) {
      (analysis.configMapRefs as ConfigMapRef[]).push({
        name: match[1].trim(),
        refType: 'envFrom',
      });
    }

    // Extract Secret references
    const secretMatches = content.matchAll(/secretRef:\s*\n\s*name:\s*(.+)$/gm);
    for (const match of secretMatches) {
      (analysis.secretRefs as SecretRef[]).push({
        name: match[1].trim(),
        refType: 'envFrom',
      });
    }

    // Extract serviceAccountName
    const saMatch = content.match(/serviceAccountName:\s*(.+)$/m);
    if (saMatch) {
      (analysis as { serviceAccountRef: string | undefined }).serviceAccountRef = saMatch[1].trim();
    }

    // Extract ports
    const portMatches = content.matchAll(/containerPort:\s*(\d+)/g);
    for (const match of portMatches) {
      (analysis.ports as PortRef[]).push({
        containerPort: parseInt(match[1], 10),
        protocol: 'TCP',
      });
    }

    // Extract selector labels
    const selectorMatch = content.match(/selector:\s*\n\s*matchLabels:\s*\n((?:\s+.+\n)*)/);
    if (selectorMatch) {
      const labelLines = selectorMatch[1].split('\n');
      for (const line of labelLines) {
        const match = line.match(/^\s+([^:]+):\s*(.+)$/);
        if (match) {
          (analysis.selectorLabels as Record<string, string>)[match[1].trim()] = match[2].trim();
        }
      }
    }

    return analysis;
  }

  private parseImageRef(imageStr: string): ContainerImageRef | null {
    // Handle template expressions in image
    const hasTemplate = /\{\{.*\}\}/.test(imageStr);

    // Try to parse image:tag format
    let repository = imageStr;
    let tag = 'latest';

    if (!hasTemplate) {
      const colonIndex = imageStr.lastIndexOf(':');
      if (colonIndex > 0 && !imageStr.slice(colonIndex).includes('/')) {
        repository = imageStr.slice(0, colonIndex);
        tag = imageStr.slice(colonIndex + 1);
      }
    }

    return {
      containerName: '', // Would need context to determine
      repository,
      tag,
      hasTemplateExpression: hasTemplate,
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  private getRelativePath(filePath: string): string {
    const parts = filePath.split('/');
    const templatesIndex = parts.indexOf('templates');
    if (templatesIndex >= 0) {
      return parts.slice(templatesIndex).join('/');
    }
    return parts.pop() || filePath;
  }

  private extractTemplateName(content: string, filePath: string): string | undefined {
    // Try to find define at start of file
    const defineMatch = content.match(/^\{\{-?\s*define\s+["']([^"']+)["']/);
    if (defineMatch) {
      return defineMatch[1];
    }
    return undefined;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new template analyzer instance
 */
export function createTemplateAnalyzer(options?: ParserOptions): HelmTemplateAnalyzer {
  return new HelmTemplateAnalyzer(options);
}

/**
 * Analyze a Helm template file
 */
export async function analyzeTemplate(
  content: string,
  filePath: string,
  options?: ParserOptions
): Promise<ParseResult<TemplateAnalysisResult>> {
  const analyzer = createTemplateAnalyzer(options);
  return analyzer.parse(content, filePath);
}

/**
 * Extract all helpers from _helpers.tpl
 */
export async function extractHelpers(
  content: string,
  filePath: string = '_helpers.tpl'
): Promise<readonly DefinedTemplate[]> {
  const analyzer = createTemplateAnalyzer();
  const result = await analyzer.parse(content, filePath);

  if (result.success) {
    return result.data.definedTemplates;
  }

  return [];
}

// ============================================================================
// Note: All types/classes exported inline above
// ============================================================================
