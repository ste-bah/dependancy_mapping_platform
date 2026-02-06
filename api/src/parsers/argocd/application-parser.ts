/**
 * ArgoCD Application Parser
 * @module parsers/argocd/application-parser
 *
 * Parses ArgoCD Application and ApplicationSet manifests for GitOps deployment pattern detection.
 * Handles both single and multi-document YAML files.
 *
 * TASK-XREF-005: Parse ArgoCD Application manifests to detect GitOps deployment patterns.
 */

import * as yaml from 'yaml';
import {
  BaseParser,
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
} from '../base/parser';
import {
  ArgoCDApplication,
  ArgoCDApplicationSet,
  ArgoCDParseResult,
  ArgoCDParseError,
  ArgoCDParseErrorCode,
  ArgoCDParserOptions,
  ArgoCDApplicationNode,
  ArgoCDApplicationSetNode,
  ArgoCDDeploysEdge,
  ArgoCDGeneratesEdge,
  ApplicationSource,
  ApplicationSourceType,
  ApplicationDestination,
  SyncPolicy,
  HelmSource,
  HelmParameter,
  HelmFileParameter,
  KustomizeSource,
  DirectorySource,
  PluginSource,
  AutomatedSyncPolicy,
  RetryPolicy,
  ApplicationSetGenerator,
  ApplicationSetGeneratorType,
  ApplicationTemplate,
  DEFAULT_ARGOCD_PARSER_OPTIONS,
  ARGOCD_API_VERSIONS,
  ARGOCD_KINDS,
  createArgoCDApplicationId,
  createArgoCDApplicationSetId,
  createEmptyArgoCDParseResult,
  ResourceIgnoreDifferences,
  ApplicationSetSyncPolicy,
  ApplicationSetStrategy,
  ManagedNamespaceMetadata,
} from './types';
import { NodeLocation } from '../../types/graph';

// ============================================================================
// ArgoCD Application Parser
// ============================================================================

/**
 * Parser for ArgoCD Application and ApplicationSet manifests.
 * Extends BaseParser to provide comprehensive ArgoCD manifest parsing with
 * source type detection and graph generation.
 */
export class ArgoCDApplicationParser extends BaseParser<ArgoCDParseResult> {
  readonly name = 'argocd-application-parser';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yml', '.yaml'] as const;
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml'] as const;

  private readonly argoCDOptions: Required<ArgoCDParserOptions>;

  constructor(options?: ParserOptions & Partial<ArgoCDParserOptions>) {
    super(options);
    this.argoCDOptions = { ...DEFAULT_ARGOCD_PARSER_OPTIONS, ...options };
  }

  /**
   * Check if this parser can handle the given file.
   * Looks for ArgoCD API version and Application/ApplicationSet kinds.
   */
  canParse(filePath: string, content?: string): boolean {
    // Check extension first
    const ext = filePath.toLowerCase();
    if (!ext.endsWith('.yml') && !ext.endsWith('.yaml')) {
      return false;
    }

    // If content provided, check for ArgoCD markers
    if (content) {
      return this.isArgoCDApplication(content) || this.isApplicationSet(content);
    }

    return true;
  }

  /**
   * Check if content is an ArgoCD Application manifest
   */
  isArgoCDApplication(content: string): boolean {
    return (
      content.includes('argoproj.io/v1alpha1') &&
      content.includes('kind: Application') &&
      !content.includes('kind: ApplicationSet')
    );
  }

  /**
   * Check if content is an ArgoCD ApplicationSet manifest
   */
  isApplicationSet(content: string): boolean {
    return (
      content.includes('argoproj.io/v1alpha1') &&
      content.includes('kind: ApplicationSet')
    );
  }

  /**
   * Parse ArgoCD manifest content
   */
  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<ArgoCDParseResult>> {
    const startTime = performance.now();
    const errors: ArgoCDParseError[] = [];
    const warnings: ArgoCDParseError[] = [];
    const applications: ArgoCDApplication[] = [];
    const applicationSets: ArgoCDApplicationSet[] = [];
    const lineCount = content.split('\n').length;

    try {
      // Parse multi-document YAML
      const documents = this.parseMultiDocYaml(content, filePath, errors);

      for (const doc of documents) {
        if (!doc || typeof doc !== 'object') {
          continue;
        }

        const docObj = doc as Record<string, unknown>;
        const apiVersion = docObj.apiVersion as string;
        const kind = docObj.kind as string;

        // Validate API version
        if (!ARGOCD_API_VERSIONS.includes(apiVersion as typeof ARGOCD_API_VERSIONS[number])) {
          continue; // Skip non-ArgoCD documents
        }

        // Parse based on kind
        if (kind === ARGOCD_KINDS.APPLICATION) {
          const app = this.parseApplication(docObj, filePath, errors, warnings);
          if (app) {
            applications.push(app);
          }
        } else if (kind === ARGOCD_KINDS.APPLICATION_SET && this.argoCDOptions.parseApplicationSets) {
          const appSet = this.parseApplicationSetDoc(docObj, filePath, errors, warnings);
          if (appSet) {
            applicationSets.push(appSet);
          }
        }
      }

      // Generate graph nodes and edges
      const nodes: (ArgoCDApplicationNode | ArgoCDApplicationSetNode)[] = [];
      const edges: (ArgoCDDeploysEdge | ArgoCDGeneratesEdge)[] = [];

      if (this.argoCDOptions.generateGraph) {
        const graph = createArgoCDGraph(applications, applicationSets);
        nodes.push(...graph.nodes);
        edges.push(...graph.edges);
      }

      const parseTimeMs = performance.now() - startTime;

      const result: ArgoCDParseResult = {
        success: errors.filter(e => e.severity === 'error').length === 0 || this.argoCDOptions.errorRecovery,
        applications,
        applicationSets,
        nodes,
        edges,
        errors,
        warnings,
        metadata: {
          filePath,
          parserName: this.name,
          parserVersion: this.version,
          parseTimeMs,
          fileSize: content.length,
          lineCount,
          applicationCount: applications.length,
          applicationSetCount: applicationSets.length,
          documentCount: documents.length,
        },
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

  // ============================================================================
  // YAML Parsing
  // ============================================================================

  private parseMultiDocYaml(
    content: string,
    filePath: string,
    errors: ArgoCDParseError[]
  ): unknown[] {
    const documents: unknown[] = [];

    try {
      // Use yaml.parseAllDocuments for multi-document support
      const docs = yaml.parseAllDocuments(content, {
        strict: false,
        uniqueKeys: false,
      });

      for (const doc of docs) {
        if (doc.errors && doc.errors.length > 0) {
          for (const err of doc.errors) {
            errors.push({
              message: err.message,
              file: filePath,
              line: err.linePos?.[0]?.line,
              column: err.linePos?.[0]?.col,
              severity: 'error',
              code: 'INVALID_YAML',
            });
          }
        }

        const parsed = doc.toJS();
        if (parsed !== null && parsed !== undefined) {
          documents.push(parsed);
        }
      }
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : String(error),
        file: filePath,
        severity: 'error',
        code: 'INVALID_YAML',
      });
    }

    return documents;
  }

  // ============================================================================
  // Application Parsing
  // ============================================================================

  /**
   * Parse a single ArgoCD Application document (synchronous helper)
   */
  parseSingle(content: string, filePath: string): ArgoCDApplication | null {
    const errors: ArgoCDParseError[] = [];
    const warnings: ArgoCDParseError[] = [];

    try {
      const parsed = yaml.parse(content);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return this.parseApplication(parsed as Record<string, unknown>, filePath, errors, warnings);
    } catch {
      return null;
    }
  }

  private parseApplication(
    doc: Record<string, unknown>,
    filePath: string,
    errors: ArgoCDParseError[],
    warnings: ArgoCDParseError[]
  ): ArgoCDApplication | null {
    const metadata = doc.metadata as Record<string, unknown> | undefined;
    const spec = doc.spec as Record<string, unknown> | undefined;

    if (!metadata || !spec) {
      errors.push({
        message: 'Application missing metadata or spec',
        file: filePath,
        severity: 'error',
        code: 'MISSING_SPEC',
      });
      return null;
    }

    const name = String(metadata.name ?? '');
    const namespace = String(metadata.namespace ?? 'argocd');

    // Parse source(s)
    let source: ApplicationSource;
    let sources: ApplicationSource[] | undefined;

    if (spec.source) {
      source = this.parseSource(spec.source as Record<string, unknown>, errors);
    } else if (spec.sources && Array.isArray(spec.sources)) {
      sources = (spec.sources as Record<string, unknown>[]).map(s => this.parseSource(s, errors));
      source = sources[0]; // Primary source is the first one
    } else {
      errors.push({
        message: 'Application missing source configuration',
        file: filePath,
        severity: 'error',
        code: 'INVALID_SOURCE',
      });
      return null;
    }

    // Parse destination
    const destination = this.parseDestination(spec.destination as Record<string, unknown>, errors);
    if (!destination) {
      return null;
    }

    // Parse sync policy
    const syncPolicy = spec.syncPolicy
      ? this.parseSyncPolicy(spec.syncPolicy as Record<string, unknown>)
      : undefined;

    // Parse ignore differences
    const ignoreDifferences = spec.ignoreDifferences
      ? this.parseIgnoreDifferences(spec.ignoreDifferences as unknown[])
      : undefined;

    return {
      name,
      namespace,
      project: String(spec.project ?? 'default'),
      source,
      sources,
      destination,
      syncPolicy,
      filePath,
      labels: this.parseLabelsAnnotations(metadata.labels),
      annotations: this.parseLabelsAnnotations(metadata.annotations),
      ignoreDifferences,
      finalizers: this.parseStringArray(metadata.finalizers),
    };
  }

  // ============================================================================
  // ApplicationSet Parsing
  // ============================================================================

  /**
   * Parse a single ArgoCD ApplicationSet document (synchronous helper)
   */
  parseApplicationSetSingle(
    content: string | Record<string, unknown>,
    filePath: string
  ): ArgoCDApplicationSet | null {
    const errors: ArgoCDParseError[] = [];
    const warnings: ArgoCDParseError[] = [];

    let doc: Record<string, unknown>;
    if (typeof content === 'string') {
      try {
        doc = yaml.parse(content) as Record<string, unknown>;
      } catch {
        return null;
      }
    } else {
      doc = content;
    }

    if (!doc || typeof doc !== 'object') {
      return null;
    }

    return this.parseApplicationSetDoc(doc, filePath, errors, warnings);
  }

  private parseApplicationSetDoc(
    doc: Record<string, unknown>,
    filePath: string,
    errors: ArgoCDParseError[],
    warnings: ArgoCDParseError[]
  ): ArgoCDApplicationSet | null {
    const metadata = doc.metadata as Record<string, unknown> | undefined;
    const spec = doc.spec as Record<string, unknown> | undefined;

    if (!metadata || !spec) {
      errors.push({
        message: 'ApplicationSet missing metadata or spec',
        file: filePath,
        severity: 'error',
        code: 'MISSING_SPEC',
      });
      return null;
    }

    const name = String(metadata.name ?? '');
    const namespace = String(metadata.namespace ?? 'argocd');

    // Parse generators
    const generators = this.parseGenerators(spec.generators as unknown[], errors);

    // Parse template
    const template = this.parseTemplate(spec.template as Record<string, unknown>, errors);
    if (!template) {
      return null;
    }

    // Parse sync policy
    const syncPolicy = spec.syncPolicy
      ? this.parseAppSetSyncPolicy(spec.syncPolicy as Record<string, unknown>)
      : undefined;

    // Parse strategy
    const strategy = spec.strategy
      ? this.parseStrategy(spec.strategy as Record<string, unknown>)
      : undefined;

    return {
      name,
      namespace,
      generators,
      template,
      filePath,
      syncPolicy,
      goTemplate: spec.goTemplate === true,
      goTemplateOptions: this.parseStringArray(spec.goTemplateOptions),
      strategy,
    };
  }

  // ============================================================================
  // Source Parsing
  // ============================================================================

  private parseSource(
    source: Record<string, unknown>,
    errors: ArgoCDParseError[]
  ): ApplicationSource {
    const repoURL = String(source.repoURL ?? '');
    const targetRevision = String(source.targetRevision ?? 'HEAD');
    const path = String(source.path ?? '');
    const chart = source.chart as string | undefined;

    // Detect source type
    const sourceType = this.detectSourceType(source);

    // Parse helm config
    const helm = source.helm
      ? this.parseHelmSource(source.helm as Record<string, unknown>)
      : undefined;

    // Parse kustomize config
    const kustomize = source.kustomize
      ? this.parseKustomizeSource(source.kustomize as Record<string, unknown>)
      : undefined;

    // Parse directory config
    const directory = source.directory
      ? this.parseDirectorySource(source.directory as Record<string, unknown>)
      : undefined;

    // Parse plugin config
    const plugin = source.plugin
      ? this.parsePluginSource(source.plugin as Record<string, unknown>)
      : undefined;

    return {
      repoURL,
      targetRevision,
      path,
      sourceType,
      helm,
      kustomize,
      directory,
      plugin,
      chart,
      ref: source.ref as string | undefined,
    };
  }

  /**
   * Detect source type from Application spec
   */
  detectSourceType(source: unknown): ApplicationSourceType {
    if (!source || typeof source !== 'object') {
      return 'directory';
    }

    const s = source as Record<string, unknown>;

    // Check for explicit Helm configuration
    if (s.helm || s.chart) {
      return 'helm';
    }

    // Check for Kustomize configuration
    if (s.kustomize) {
      return 'kustomize';
    }

    // Check for plugin configuration
    if (s.plugin) {
      return 'plugin';
    }

    // Check path hints
    const path = String(s.path ?? '');
    if (path.includes('kustomize') || path.endsWith('kustomization.yaml') || path.endsWith('kustomization.yml')) {
      return 'kustomize';
    }

    // Default to directory
    return 'directory';
  }

  private parseHelmSource(helm: Record<string, unknown>): HelmSource {
    return {
      valueFiles: this.parseStringArray(helm.valueFiles) ?? [],
      parameters: this.extractHelmParameters(helm.parameters),
      releaseName: helm.releaseName as string | undefined,
      values: helm.values as string | undefined,
      fileParameters: this.parseHelmFileParameters(helm.fileParameters as unknown[]),
      skipCrds: helm.skipCrds as boolean | undefined,
      passCredentials: helm.passCredentials as boolean | undefined,
      version: helm.version as string | undefined,
      valuesObject: helm.valuesObject as Record<string, unknown> | undefined,
    };
  }

  /**
   * Extract Helm parameters from Application spec
   */
  extractHelmParameters(params: unknown): readonly HelmParameter[] {
    if (!Array.isArray(params)) {
      return [];
    }

    return params
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .map(p => ({
        name: String(p.name ?? ''),
        value: String(p.value ?? ''),
        forceString: p.forceString as boolean | undefined,
      }));
  }

  private parseHelmFileParameters(params: unknown[]): readonly HelmFileParameter[] | undefined {
    if (!Array.isArray(params)) {
      return undefined;
    }

    return params
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .map(p => ({
        name: String(p.name ?? ''),
        path: String(p.path ?? ''),
      }));
  }

  private parseKustomizeSource(kustomize: Record<string, unknown>): KustomizeSource {
    return {
      namePrefix: kustomize.namePrefix as string | undefined,
      nameSuffix: kustomize.nameSuffix as string | undefined,
      images: this.parseStringArray(kustomize.images),
      commonLabels: this.parseLabelsAnnotations(kustomize.commonLabels),
      commonAnnotations: this.parseLabelsAnnotations(kustomize.commonAnnotations),
      forceCommonLabels: kustomize.forceCommonLabels as boolean | undefined,
      forceCommonAnnotations: kustomize.forceCommonAnnotations as boolean | undefined,
      version: kustomize.version as string | undefined,
      namespace: kustomize.namespace as string | undefined,
      replicas: this.parseKustomizeReplicas(kustomize.replicas as unknown[]),
    };
  }

  private parseKustomizeReplicas(replicas: unknown[]) {
    if (!Array.isArray(replicas)) {
      return undefined;
    }

    return replicas
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .map(r => ({
        name: String(r.name ?? ''),
        count: Number(r.count ?? 0),
      }));
  }

  private parseDirectorySource(directory: Record<string, unknown>): DirectorySource {
    return {
      recurse: directory.recurse as boolean | undefined,
      jsonnet: directory.jsonnet as DirectorySource['jsonnet'],
      exclude: directory.exclude as string | undefined,
      include: directory.include as string | undefined,
    };
  }

  private parsePluginSource(plugin: Record<string, unknown>): PluginSource {
    return {
      name: plugin.name as string | undefined,
      env: plugin.env as PluginSource['env'],
      parameters: plugin.parameters as PluginSource['parameters'],
    };
  }

  // ============================================================================
  // Destination Parsing
  // ============================================================================

  private parseDestination(
    dest: Record<string, unknown> | undefined,
    errors: ArgoCDParseError[]
  ): ApplicationDestination | null {
    if (!dest) {
      errors.push({
        message: 'Application missing destination configuration',
        file: '',
        severity: 'error',
        code: 'INVALID_DESTINATION',
      });
      return null;
    }

    return {
      server: String(dest.server ?? 'https://kubernetes.default.svc'),
      namespace: String(dest.namespace ?? 'default'),
      name: dest.name as string | undefined,
    };
  }

  // ============================================================================
  // Sync Policy Parsing
  // ============================================================================

  private parseSyncPolicy(policy: Record<string, unknown>): SyncPolicy {
    const automated = policy.automated
      ? this.parseAutomatedPolicy(policy.automated as Record<string, unknown>)
      : undefined;

    const retry = policy.retry
      ? this.parseRetryPolicy(policy.retry as Record<string, unknown>)
      : undefined;

    const managedNamespaceMetadata = policy.managedNamespaceMetadata
      ? this.parseManagedNamespaceMetadata(policy.managedNamespaceMetadata as Record<string, unknown>)
      : undefined;

    return {
      automated,
      syncOptions: this.parseStringArray(policy.syncOptions),
      retry,
      managedNamespaceMetadata,
    };
  }

  private parseAutomatedPolicy(automated: Record<string, unknown>): AutomatedSyncPolicy {
    return {
      prune: automated.prune === true,
      selfHeal: automated.selfHeal === true,
      allowEmpty: automated.allowEmpty as boolean | undefined,
    };
  }

  private parseRetryPolicy(retry: Record<string, unknown>): RetryPolicy {
    return {
      limit: Number(retry.limit ?? 0),
      backoff: retry.backoff as RetryPolicy['backoff'],
    };
  }

  private parseManagedNamespaceMetadata(metadata: Record<string, unknown>): ManagedNamespaceMetadata {
    return {
      labels: this.parseLabelsAnnotations(metadata.labels),
      annotations: this.parseLabelsAnnotations(metadata.annotations),
    };
  }

  private parseAppSetSyncPolicy(policy: Record<string, unknown>): ApplicationSetSyncPolicy {
    return {
      preserveResourcesOnDeletion: policy.preserveResourcesOnDeletion as boolean | undefined,
      applicationsSync: policy.applicationsSync as ApplicationSetSyncPolicy['applicationsSync'],
    };
  }

  private parseStrategy(strategy: Record<string, unknown>): ApplicationSetStrategy {
    return {
      type: (strategy.type as ApplicationSetStrategy['type']) ?? 'AllAtOnce',
      rollingSync: strategy.rollingSync as ApplicationSetStrategy['rollingSync'],
    };
  }

  // ============================================================================
  // Generator Parsing
  // ============================================================================

  private parseGenerators(
    generators: unknown[],
    errors: ArgoCDParseError[]
  ): readonly ApplicationSetGenerator[] {
    if (!Array.isArray(generators)) {
      return [];
    }

    const result: ApplicationSetGenerator[] = [];

    for (const gen of generators) {
      if (!gen || typeof gen !== 'object') {
        continue;
      }

      const genObj = gen as Record<string, unknown>;
      const parsed = this.parseGenerator(genObj, errors);
      if (parsed) {
        result.push(parsed);
      }
    }

    return result;
  }

  private parseGenerator(
    gen: Record<string, unknown>,
    errors: ArgoCDParseError[]
  ): ApplicationSetGenerator | null {
    // Determine generator type from the key present
    const generatorTypes: ApplicationSetGeneratorType[] = [
      'list', 'clusters', 'git', 'scmProvider',
      'clusterDecisionResource', 'pullRequest', 'matrix', 'merge'
    ];

    for (const type of generatorTypes) {
      if (gen[type] !== undefined) {
        return {
          type,
          config: gen[type] as Record<string, unknown>,
          selector: gen.selector as ApplicationSetGenerator['selector'],
        };
      }
    }

    // Unknown generator type
    return null;
  }

  // ============================================================================
  // Template Parsing
  // ============================================================================

  private parseTemplate(
    template: Record<string, unknown> | undefined,
    errors: ArgoCDParseError[]
  ): ApplicationTemplate | null {
    if (!template) {
      errors.push({
        message: 'ApplicationSet missing template',
        file: '',
        severity: 'error',
        code: 'INVALID_TEMPLATE',
      });
      return null;
    }

    const metadata = template.metadata as Record<string, unknown> | undefined;
    const spec = template.spec as Record<string, unknown> | undefined;

    if (!spec) {
      errors.push({
        message: 'ApplicationSet template missing spec',
        file: '',
        severity: 'error',
        code: 'INVALID_TEMPLATE',
      });
      return null;
    }

    // Parse source(s)
    let source: ApplicationSource | undefined;
    let sources: ApplicationSource[] | undefined;

    if (spec.source) {
      source = this.parseSource(spec.source as Record<string, unknown>, errors);
    } else if (spec.sources && Array.isArray(spec.sources)) {
      sources = (spec.sources as Record<string, unknown>[]).map(s => this.parseSource(s, errors));
    }

    // Parse destination
    const destination = this.parseDestination(spec.destination as Record<string, unknown>, errors);
    if (!destination) {
      return null;
    }

    return {
      metadata: {
        name: metadata?.name as string | undefined,
        namespace: metadata?.namespace as string | undefined,
        labels: this.parseLabelsAnnotations(metadata?.labels),
        annotations: this.parseLabelsAnnotations(metadata?.annotations),
        finalizers: this.parseStringArray(metadata?.finalizers),
      },
      spec: {
        project: String(spec.project ?? 'default'),
        source,
        sources,
        destination,
        syncPolicy: spec.syncPolicy
          ? this.parseSyncPolicy(spec.syncPolicy as Record<string, unknown>)
          : undefined,
        ignoreDifferences: spec.ignoreDifferences
          ? this.parseIgnoreDifferences(spec.ignoreDifferences as unknown[])
          : undefined,
      },
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private parseStringArray(arr: unknown): readonly string[] | undefined {
    if (!Array.isArray(arr)) {
      return undefined;
    }
    return arr.filter((v): v is string => typeof v === 'string');
  }

  private parseLabelsAnnotations(obj: unknown): Readonly<Record<string, string>> | undefined {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = String(value);
    }
    return result;
  }

  private parseIgnoreDifferences(diffs: unknown[]): readonly ResourceIgnoreDifferences[] | undefined {
    if (!Array.isArray(diffs)) {
      return undefined;
    }

    return diffs
      .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
      .map(d => ({
        group: d.group as string | undefined,
        kind: String(d.kind ?? ''),
        name: d.name as string | undefined,
        namespace: d.namespace as string | undefined,
        jsonPointers: this.parseStringArray(d.jsonPointers),
        jqPathExpressions: this.parseStringArray(d.jqPathExpressions),
        managedFieldsManagers: this.parseStringArray(d.managedFieldsManagers),
      }));
  }
}

// ============================================================================
// Graph Generation
// ============================================================================

/**
 * Create graph nodes and edges from parsed ArgoCD resources
 */
export function createArgoCDGraph(
  apps: readonly ArgoCDApplication[],
  appSets: readonly ArgoCDApplicationSet[] = []
): {
  nodes: readonly (ArgoCDApplicationNode | ArgoCDApplicationSetNode)[];
  edges: readonly (ArgoCDDeploysEdge | ArgoCDGeneratesEdge)[];
} {
  const nodes: (ArgoCDApplicationNode | ArgoCDApplicationSetNode)[] = [];
  const edges: (ArgoCDDeploysEdge | ArgoCDGeneratesEdge)[] = [];

  // Create nodes for Applications
  for (const app of apps) {
    const nodeId = createArgoCDApplicationId(app.name, app.namespace);

    const node: ArgoCDApplicationNode = {
      id: nodeId,
      type: 'argocd_application',
      name: app.name,
      filePath: app.filePath,
      metadata: {
        appName: app.name,
        project: app.project,
        sourceRepo: app.source.repoURL,
        sourcePath: app.source.path,
        sourceType: app.source.sourceType,
        targetCluster: app.destination.server,
        targetNamespace: app.destination.namespace,
        autoSync: app.syncPolicy?.automated !== undefined,
        valueFiles: app.source.helm?.valueFiles,
        parameterCount: app.source.helm?.parameters.length,
        isMultiSource: app.sources !== undefined && app.sources.length > 1,
        chartName: app.source.chart,
      },
      location: {
        file: app.filePath,
        lineStart: 1,
        lineEnd: 1,
      },
    };

    nodes.push(node);

    // Create deploy edge
    const edgeId = `${nodeId}-deploys-${app.source.path.replace(/\//g, '-')}`;
    const edge: ArgoCDDeploysEdge = {
      id: edgeId,
      type: 'ARGOCD_DEPLOYS',
      sourceNodeId: nodeId,
      targetNodeId: `target-${app.destination.namespace}-${app.source.path}`,
      confidence: 95,
      metadata: {
        appName: app.name,
        chartPath: app.source.path,
        sourceType: app.source.sourceType,
        repoURL: app.source.repoURL,
        targetRevision: app.source.targetRevision,
      },
    };

    edges.push(edge);
  }

  // Create nodes for ApplicationSets
  for (const appSet of appSets) {
    const nodeId = createArgoCDApplicationSetId(appSet.name, appSet.namespace);

    const templateSource = appSet.template.spec.source ?? appSet.template.spec.sources?.[0];
    const sourceType = templateSource?.sourceType ?? 'directory';

    const node: ArgoCDApplicationSetNode = {
      id: nodeId,
      type: 'argocd_applicationset',
      name: appSet.name,
      filePath: appSet.filePath,
      metadata: {
        appSetName: appSet.name,
        generatorTypes: appSet.generators.map(g => g.type),
        generatorCount: appSet.generators.length,
        templateSourceType: sourceType,
        templateTargetNamespace: appSet.template.spec.destination.namespace,
        goTemplateEnabled: appSet.goTemplate === true,
      },
      location: {
        file: appSet.filePath,
        lineStart: 1,
        lineEnd: 1,
      },
    };

    nodes.push(node);

    // Create generates edge for each generator
    for (let i = 0; i < appSet.generators.length; i++) {
      const gen = appSet.generators[i];
      const edgeId = `${nodeId}-generates-${gen.type}-${i}`;

      const edge: ArgoCDGeneratesEdge = {
        id: edgeId,
        type: 'ARGOCD_GENERATES',
        sourceNodeId: nodeId,
        targetNodeId: `generated-${appSet.name}-${gen.type}-${i}`,
        confidence: 90,
        metadata: {
          appSetName: appSet.name,
          generatorType: gen.type,
        },
      };

      edges.push(edge);
    }
  }

  return { nodes, edges };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ArgoCD Application parser instance
 */
export function createArgoCDParser(
  options?: ParserOptions & Partial<ArgoCDParserOptions>
): ArgoCDApplicationParser {
  return new ArgoCDApplicationParser(options);
}

/**
 * Parse ArgoCD manifest content directly
 */
export async function parseArgoCDManifest(
  content: string,
  filePath: string,
  options?: ParserOptions & Partial<ArgoCDParserOptions>
): Promise<ParseResult<ArgoCDParseResult>> {
  const parser = createArgoCDParser(options);
  return parser.parse(content, filePath, options);
}
