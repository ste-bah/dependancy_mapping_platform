/**
 * GitHub Actions Parser
 * @module parsers/github-actions/gha-parser
 *
 * Parses GitHub Actions workflow files (.github/workflows/*.yml)
 * Extracts workflow structure, jobs, steps, triggers, and tool detection.
 *
 * TASK-XREF-001: GitHub Actions Parser
 * TASK-GHA-001: Workflow structure parsing
 * TASK-GHA-002: Job and step extraction
 * TASK-GHA-003: Terraform/Helm step detection
 */

import * as yaml from 'yaml';
import * as path from 'path';
import {
  BaseParser,
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
} from '../base/parser';
import {
  GhaParseResult,
  GhaWorkflow,
  GhaJob,
  GhaStep,
  GhaRunStep,
  GhaUsesStep,
  GhaTrigger,
  GhaTriggerType,
  GhaPushTrigger,
  GhaPullRequestTrigger,
  GhaWorkflowDispatchTrigger,
  GhaScheduleTrigger,
  GhaWorkflowCallTrigger,
  GhaWorkflowRunTrigger,
  GhaParserOptions,
  GhaParseError,
  GhaExpression,
  GhaExpressionType,
  GhaExpressionContext,
  GhaContextReference,
  GhaFunctionCall,
  TerraformStepInfo,
  TerraformCommand,
  HelmStepInfo,
  HelmCommand,
  GhaDefaults,
  GhaPermissions,
  GhaConcurrency,
  GhaStrategy,
  GhaMatrix,
  GhaContainer,
  GhaEnvironment,
  GhaWorkflowInput,
  DEFAULT_GHA_PARSER_OPTIONS,
  TERRAFORM_ACTIONS,
  TERRAFORM_COMMAND_PATTERNS,
  HELM_ACTIONS,
  HELM_COMMAND_PATTERNS,
  createGhaParseMetadata,
  createEmptyGhaParseResult,
} from './types';
import { SourceLocation } from '../terraform/types';

// ============================================================================
// Expression Parser
// ============================================================================

/**
 * Parser for GitHub Actions expressions (${{ ... }})
 */
export class GhaExpressionParser {
  /** Regex to match GitHub Actions expressions */
  private readonly expressionRegex = /\$\{\{\s*(.+?)\s*\}\}/g;

  /** Known contexts in GitHub Actions */
  private readonly knownContexts: readonly GhaExpressionContext[] = [
    'github', 'env', 'vars', 'job', 'jobs', 'steps',
    'runner', 'secrets', 'strategy', 'matrix', 'needs', 'inputs',
  ];

  /** Known functions in GitHub Actions expressions */
  private readonly knownFunctions = [
    'contains', 'startsWith', 'endsWith', 'format', 'join',
    'toJSON', 'fromJSON', 'hashFiles', 'success', 'always',
    'cancelled', 'failure',
  ];

  /**
   * Extract all expressions from content
   * @param content - YAML content to parse
   * @returns Array of extracted expressions
   */
  extractExpressions(content: string): readonly GhaExpression[] {
    const expressions: GhaExpression[] = [];
    const lines = content.split('\n');
    let match: RegExpExecArray | null;

    // Reset regex state
    this.expressionRegex.lastIndex = 0;

    while ((match = this.expressionRegex.exec(content)) !== null) {
      const raw = match[0];
      const body = match[1].trim();
      const startIndex = match.index;

      // Calculate line/column
      const lineInfo = this.getLineInfo(content, startIndex);

      const expression = this.parseExpression(raw, body, lineInfo);
      expressions.push(expression);
    }

    return expressions;
  }

  /**
   * Parse a single expression
   */
  private parseExpression(
    raw: string,
    body: string,
    location: SourceLocation
  ): GhaExpression {
    const type = this.classifyExpression(body);
    const contextReferences = this.extractContextReferences(body);
    const functions = this.extractFunctionCalls(body);
    const references = contextReferences.map(ref => ref.fullPath);
    const context = contextReferences.length > 0 ? contextReferences[0].context : undefined;
    const functionName = functions.length > 0 ? functions[0].name : undefined;

    return {
      raw,
      content: body,
      body,
      type,
      location,
      context,
      function: functionName,
      references,
      contextReferences,
      functions,
    };
  }

  /**
   * Classify the expression type
   */
  private classifyExpression(body: string): GhaExpressionType {
    // Check for logical operators
    if (/\s+(&&|\|\|)\s+/.test(body)) {
      return 'logical';
    }

    // Check for comparison operators
    if (/\s*(==|!=|<|>|<=|>=)\s*/.test(body)) {
      return 'comparison';
    }

    // Check for function calls
    const hasFunctionCall = this.knownFunctions.some(fn =>
      new RegExp(`\\b${fn}\\s*\\(`).test(body)
    );
    if (hasFunctionCall) {
      return 'function';
    }

    // Check for literal values
    if (/^(true|false|null|\d+|'[^']*'|"[^"]*")$/.test(body.trim())) {
      return 'literal';
    }

    // Check for context access
    const hasContext = this.knownContexts.some(ctx =>
      new RegExp(`^${ctx}\\.`).test(body)
    );
    if (hasContext) {
      return 'context';
    }

    return 'mixed';
  }

  /**
   * Extract context references from expression body
   */
  private extractContextReferences(body: string): readonly GhaContextReference[] {
    const references: GhaContextReference[] = [];
    const contextPattern = /\b(github|env|vars|job|jobs|steps|runner|secrets|strategy|matrix|needs|inputs)\.([a-zA-Z0-9_.*\[\]]+)/g;

    let match: RegExpExecArray | null;
    while ((match = contextPattern.exec(body)) !== null) {
      const context = match[1] as GhaExpressionContext;
      const pathStr = match[2];
      const path = pathStr.split('.').filter(p => p.length > 0);

      references.push({
        context,
        path,
        fullPath: `${context}.${pathStr}`,
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    return references;
  }

  /**
   * Extract function calls from expression body
   */
  private extractFunctionCalls(body: string): readonly GhaFunctionCall[] {
    const functions: GhaFunctionCall[] = [];
    const functionPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;

    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(body)) !== null) {
      const name = match[1];
      if (this.knownFunctions.includes(name)) {
        const argsStr = match[2];
        const args = argsStr
          .split(',')
          .map(arg => arg.trim())
          .filter(arg => arg.length > 0);

        functions.push({
          name,
          arguments: args,
          position: {
            start: match.index,
            end: match.index + match[0].length,
          },
        });
      }
    }

    return functions;
  }

  /**
   * Get line/column info for a character index
   */
  private getLineInfo(content: string, index: number): SourceLocation {
    const before = content.substring(0, index);
    const lines = before.split('\n');
    const lineStart = lines.length;
    const columnStart = lines[lines.length - 1].length + 1;

    return {
      file: '',
      lineStart,
      lineEnd: lineStart,
      columnStart,
      columnEnd: columnStart,
    };
  }
}

// ============================================================================
// Tool Detector
// ============================================================================

/**
 * Detector for IaC tools in GitHub Actions steps
 */
export class GhaToolDetector {
  /**
   * Detect Terraform steps in a list of steps
   * @param steps - Steps to analyze
   * @returns Array of detected Terraform step info
   */
  detectTerraformSteps(steps: readonly GhaStep[]): readonly TerraformStepInfo[] {
    const terraformSteps: TerraformStepInfo[] = [];

    steps.forEach((step, index) => {
      const detection = this.detectTerraformInStep(step, index);
      if (detection) {
        terraformSteps.push(detection);
      }
    });

    return terraformSteps;
  }

  /**
   * Detect Helm steps in a list of steps
   * @param steps - Steps to analyze
   * @returns Array of detected Helm step info
   */
  detectHelmSteps(steps: readonly GhaStep[]): readonly HelmStepInfo[] {
    const helmSteps: HelmStepInfo[] = [];

    steps.forEach((step, index) => {
      const detection = this.detectHelmInStep(step, index);
      if (detection) {
        helmSteps.push(detection);
      }
    });

    return helmSteps;
  }

  /**
   * Detect Terraform usage in a single step
   */
  private detectTerraformInStep(
    step: GhaStep,
    stepIndex: number
  ): TerraformStepInfo | null {
    // Check uses steps for Terraform actions
    if (step.type === 'uses') {
      const usesStep = step as GhaUsesStep;
      const actionName = usesStep.uses.split('@')[0];

      if (TERRAFORM_ACTIONS.some(action => actionName.includes(action))) {
        return {
          stepIndex,
          stepId: step.id,
          jobId: '',
          command: 'init',
          actionRef: usesStep.uses,
          usesCloud: actionName.includes('tfc-'),
          varFiles: [],
          envVars: step.env ?? {},
          confidence: 95,
          location: step.location,
        };
      }
    }

    // Check run steps for terraform commands
    if (step.type === 'run') {
      const runStep = step as GhaRunStep;
      const runContent = runStep.run;

      for (const pattern of TERRAFORM_COMMAND_PATTERNS) {
        const match = pattern.exec(runContent);
        if (match) {
          const command = this.parseTerraformCommand(match[1]);
          const workingDirectory = this.extractWorkingDirectory(runContent);
          const varFiles = this.extractVarFiles(runContent);
          const variables = this.extractVariables(runContent);

          return {
            stepIndex,
            stepId: step.id,
            jobId: '',
            command,
            workingDirectory: workingDirectory ?? step.workingDirectory,
            usesCloud: runContent.includes('TF_CLOUD_') || runContent.includes('TFE_'),
            varFiles,
            variables,
            envVars: step.env ?? {},
            confidence: 90,
            location: step.location,
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect Helm usage in a single step
   */
  private detectHelmInStep(
    step: GhaStep,
    stepIndex: number
  ): HelmStepInfo | null {
    // Check uses steps for Helm actions
    if (step.type === 'uses') {
      const usesStep = step as GhaUsesStep;
      const actionName = usesStep.uses.split('@')[0];

      if (HELM_ACTIONS.some(action => actionName.includes(action))) {
        return {
          stepIndex,
          stepId: step.id,
          jobId: '',
          command: 'install',
          actionRef: usesStep.uses,
          valuesFiles: [],
          setValues: {},
          dryRun: false,
          atomic: false,
          wait: false,
          confidence: 95,
          location: step.location,
        };
      }
    }

    // Check run steps for helm commands
    if (step.type === 'run') {
      const runStep = step as GhaRunStep;
      const runContent = runStep.run;

      for (const pattern of HELM_COMMAND_PATTERNS) {
        const match = pattern.exec(runContent);
        if (match) {
          const command = this.parseHelmCommand(match[1]);
          const releaseName = this.extractHelmReleaseName(runContent);
          const chartPath = this.extractHelmChart(runContent);
          const namespace = this.extractNamespace(runContent);
          const valuesFiles = this.extractHelmValuesFiles(runContent);

          return {
            stepIndex,
            stepId: step.id,
            jobId: '',
            command,
            releaseName,
            chartPath,
            chart: chartPath,
            namespace,
            valuesFiles,
            setValues: {},
            dryRun: runContent.includes('--dry-run'),
            atomic: runContent.includes('--atomic'),
            wait: runContent.includes('--wait'),
            confidence: 90,
            location: step.location,
          };
        }
      }
    }

    return null;
  }

  private parseTerraformCommand(cmd: string): TerraformCommand {
    const normalized = cmd.toLowerCase();
    const commands: TerraformCommand[] = [
      'init', 'validate', 'plan', 'apply', 'destroy', 'fmt',
      'output', 'import', 'state', 'workspace', 'refresh',
      'taint', 'untaint', 'force-unlock',
    ];

    return commands.find(c => normalized === c) ?? 'unknown';
  }

  private parseHelmCommand(cmd: string): HelmCommand {
    const normalized = cmd.toLowerCase();
    const commands: HelmCommand[] = [
      'install', 'upgrade', 'uninstall', 'rollback', 'template',
      'lint', 'package', 'push', 'pull', 'repo', 'dependency', 'test',
    ];

    return commands.find(c => normalized === c) ?? 'unknown';
  }

  private extractWorkingDirectory(content: string): string | undefined {
    const cdMatch = /cd\s+([^\s;&|]+)/.exec(content);
    if (cdMatch) return cdMatch[1];

    const wdMatch = /working-directory:\s*([^\s]+)/.exec(content);
    if (wdMatch) return wdMatch[1];

    return undefined;
  }

  private extractVarFiles(content: string): readonly string[] {
    const varFiles: string[] = [];
    const varFilePattern = /-var-file[=\s]+["']?([^\s"']+)["']?/g;

    let match: RegExpExecArray | null;
    while ((match = varFilePattern.exec(content)) !== null) {
      varFiles.push(match[1]);
    }

    return varFiles;
  }

  private extractVariables(content: string): Record<string, string> {
    const variables: Record<string, string> = {};
    const varPattern = /-var\s+["']?([^=]+)=([^\s"']+)["']?/g;

    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(content)) !== null) {
      variables[match[1]] = match[2];
    }

    return variables;
  }

  private extractHelmReleaseName(content: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = /helm\s+(install|upgrade)\s+([^\s]+)/.exec(line);
      if (match) return match[2];
    }
    return undefined;
  }

  private extractHelmChart(content: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = /helm\s+(install|upgrade)\s+\S+\s+([^\s]+)/.exec(line);
      if (match) return match[2];
    }
    return undefined;
  }

  private extractNamespace(content: string): string | undefined {
    const match = /-n\s+([^\s]+)|--namespace[=\s]+([^\s]+)/.exec(content);
    if (match) return match[1] || match[2];
    return undefined;
  }

  private extractHelmValuesFiles(content: string): readonly string[] {
    const files: string[] = [];
    const pattern = /-f\s+([^\s]+)|--values[=\s]+([^\s]+)/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      files.push(match[1] || match[2]);
    }

    return files;
  }
}

// ============================================================================
// GitHub Actions Parser
// ============================================================================

/**
 * Parser for GitHub Actions workflow files.
 * Extends BaseParser to provide comprehensive workflow parsing with
 * tool detection for Terraform, Helm, and other IaC tools.
 */
export class GitHubActionsParser extends BaseParser<GhaParseResult> {
  readonly name = 'github-actions-parser';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.yml', '.yaml'] as const;
  readonly supportedMimeTypes = ['application/x-yaml', 'text/yaml'] as const;

  private readonly expressionParser: GhaExpressionParser;
  private readonly toolDetector: GhaToolDetector;
  private readonly ghaOptions: Required<GhaParserOptions>;

  constructor(options?: ParserOptions & Partial<GhaParserOptions>) {
    super(options);
    this.ghaOptions = { ...DEFAULT_GHA_PARSER_OPTIONS, ...options };
    this.expressionParser = new GhaExpressionParser();
    this.toolDetector = new GhaToolDetector();
  }

  /**
   * Check if this parser can handle the given file.
   * Must be in .github/workflows/ directory and be a YAML file.
   */
  canParse(filePath: string, content?: string): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Must be in .github/workflows/ directory
    if (!normalizedPath.includes('.github/workflows/')) {
      return false;
    }

    // Check extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.yml' && ext !== '.yaml') {
      return false;
    }

    // If content provided, check for workflow markers
    if (content) {
      return /^(on|jobs):/m.test(content);
    }

    return true;
  }

  /**
   * Parse GitHub Actions workflow content
   */
  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<GhaParseResult>> {
    const startTime = performance.now();
    const warnings: ParseDiagnostic[] = [];
    const errors: GhaParseError[] = [];

    try {
      // Parse YAML
      const parsed = yaml.parse(content, {
        strict: this.ghaOptions.strictYaml,
        uniqueKeys: false,
      });

      if (!parsed || typeof parsed !== 'object') {
        return this.createFailure(
          [{
            code: 'SYNTAX_ERROR',
            message: 'Invalid workflow: not a YAML object',
            location: null,
            severity: 'fatal',
          }],
          null,
          this.createMetadata(filePath, startTime, content)
        );
      }

      // Extract workflow structure
      const workflow = this.extractWorkflow(parsed, filePath, content, errors);

      // Collect all steps from all jobs
      const allSteps = [...workflow.jobs.values()].flatMap(j => j.steps);

      // Detect Terraform steps
      const terraformSteps = this.ghaOptions.detectTerraform
        ? this.enrichWithJobId(this.toolDetector.detectTerraformSteps(allSteps), workflow)
        : [];

      // Detect Helm steps
      const helmSteps = this.ghaOptions.detectHelm
        ? this.enrichHelmWithJobId(this.toolDetector.detectHelmSteps(allSteps), workflow)
        : [];

      // Extract expressions
      const expressions = this.ghaOptions.parseExpressions
        ? this.enrichExpressionsWithFile(this.expressionParser.extractExpressions(content), filePath)
        : [];

      // Calculate metadata
      const parseTimeMs = performance.now() - startTime;
      const jobCount = workflow.jobs.size;
      const stepCount = allSteps.length;

      const result: GhaParseResult = {
        success: errors.length === 0 || this.ghaOptions.errorRecovery,
        workflow,
        nodes: [], // Populated by node factory
        edges: [], // Populated by edge factory
        expressions,
        terraformSteps,
        helmSteps,
        kubernetesSteps: [],
        awsSteps: [],
        gcpSteps: [],
        azureSteps: [],
        dockerSteps: [],
        allToolSteps: [...terraformSteps, ...helmSteps],
        errors,
        warnings: [],
        metadata: {
          filePath,
          parserName: this.name,
          parserVersion: this.version,
          parseTimeMs,
          fileSize: content.length,
          lineCount: content.split('\n').length,
          jobCount,
          stepCount,
          expressionCount: expressions.length,
          toolDetectionCount: terraformSteps.length + helmSteps.length,
        },
      };

      // Convert GHA warnings to ParseDiagnostic format
      const parseDiagnostics: ParseDiagnostic[] = warnings.map(w => ({
        code: w.code,
        message: w.message,
        location: w.location ?? null,
        severity: 'warning' as const,
      }));

      return this.createSuccess(result, parseDiagnostics, this.createMetadata(filePath, startTime, content));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createFailure(
        [{
          code: 'INTERNAL_ERROR',
          message: `Failed to parse workflow: ${message}`,
          location: null,
          severity: 'fatal',
        }],
        null,
        this.createMetadata(filePath, startTime, content)
      );
    }
  }

  // ============================================================================
  // Workflow Extraction
  // ============================================================================

  private extractWorkflow(
    parsed: Record<string, unknown>,
    filePath: string,
    content: string,
    errors: GhaParseError[]
  ): GhaWorkflow {
    const lineCount = content.split('\n').length;

    // Extract workflow name
    const name = typeof parsed.name === 'string'
      ? parsed.name
      : path.basename(filePath, path.extname(filePath));

    // Extract triggers
    const triggers = this.extractTriggers(parsed.on, filePath, errors);

    // Extract workflow-level env
    const env = this.extractEnv(parsed.env);

    // Extract jobs
    const jobs = this.extractJobs(parsed.jobs, filePath, errors);

    // Extract defaults
    const defaults = this.extractDefaults(parsed.defaults);

    // Extract permissions
    const permissions = this.extractPermissions(parsed.permissions);

    // Extract concurrency
    const concurrency = this.extractConcurrency(parsed.concurrency);

    return {
      name,
      filePath,
      triggers,
      env,
      jobs,
      defaults,
      permissions,
      concurrency,
      location: {
        file: filePath,
        lineStart: 1,
        lineEnd: lineCount,
        columnStart: 1,
        columnEnd: 1,
      },
    };
  }

  // ============================================================================
  // Trigger Extraction
  // ============================================================================

  private extractTriggers(
    on: unknown,
    filePath: string,
    errors: GhaParseError[]
  ): readonly GhaTrigger[] {
    if (!on) {
      errors.push({
        message: 'Workflow missing "on" trigger configuration',
        file: filePath,
        severity: 'warning',
        code: 'INVALID_TRIGGER',
      });
      return [];
    }

    const triggers: GhaTrigger[] = [];

    // Simple string trigger: on: push
    if (typeof on === 'string') {
      triggers.push(this.createTrigger(on as GhaTriggerType, undefined));
      return triggers;
    }

    // Array of triggers: on: [push, pull_request]
    if (Array.isArray(on)) {
      for (const triggerType of on) {
        if (typeof triggerType === 'string') {
          triggers.push(this.createTrigger(triggerType as GhaTriggerType, undefined));
        }
      }
      return triggers;
    }

    // Object triggers: on: { push: { branches: [...] }, ... }
    if (typeof on === 'object') {
      const onObj = on as Record<string, unknown>;

      for (const [triggerType, config] of Object.entries(onObj)) {
        const trigger = this.createTrigger(
          triggerType as GhaTriggerType,
          config as Record<string, unknown> | undefined
        );
        triggers.push(trigger);
      }
    }

    return triggers;
  }

  private createTrigger(type: GhaTriggerType, config?: Record<string, unknown>): GhaTrigger {
    switch (type) {
      case 'push':
        return this.createPushTrigger(config);
      case 'pull_request':
        return this.createPullRequestTrigger(config);
      case 'workflow_dispatch':
        return this.createWorkflowDispatchTrigger(config);
      case 'schedule':
        return this.createScheduleTrigger(config);
      case 'workflow_call':
        return this.createWorkflowCallTrigger(config);
      case 'workflow_run':
        return this.createWorkflowRunTrigger(config);
      default:
        return { type } as GhaTrigger;
    }
  }

  private createPushTrigger(config?: Record<string, unknown>): GhaPushTrigger {
    return {
      type: 'push',
      branches: this.extractStringArray(config?.branches),
      branchesIgnore: this.extractStringArray(config?.['branches-ignore']),
      tags: this.extractStringArray(config?.tags),
      tagsIgnore: this.extractStringArray(config?.['tags-ignore']),
      paths: this.extractStringArray(config?.paths),
      pathsIgnore: this.extractStringArray(config?.['paths-ignore']),
    };
  }

  private createPullRequestTrigger(config?: Record<string, unknown>): GhaPullRequestTrigger {
    return {
      type: 'pull_request',
      branches: this.extractStringArray(config?.branches),
      branchesIgnore: this.extractStringArray(config?.['branches-ignore']),
      paths: this.extractStringArray(config?.paths),
      pathsIgnore: this.extractStringArray(config?.['paths-ignore']),
      types: this.extractStringArray(config?.types) as readonly ('opened' | 'closed' | 'synchronize')[] | undefined,
    };
  }

  private createWorkflowDispatchTrigger(config?: Record<string, unknown>): GhaWorkflowDispatchTrigger {
    const inputs = config?.inputs as Record<string, unknown> | undefined;
    const parsedInputs: Record<string, GhaWorkflowInput> = {};

    if (inputs) {
      for (const [name, inputConfig] of Object.entries(inputs)) {
        const cfg = inputConfig as Record<string, unknown>;
        parsedInputs[name] = {
          description: cfg.description as string | undefined,
          required: cfg.required === true,
          default: cfg.default as string | undefined,
          type: (cfg.type as 'string' | 'boolean' | 'choice' | 'environment') ?? 'string',
          options: this.extractStringArray(cfg.options),
        };
      }
    }

    return {
      type: 'workflow_dispatch',
      inputs: Object.keys(parsedInputs).length > 0 ? parsedInputs : undefined,
    };
  }

  private createScheduleTrigger(config?: Record<string, unknown>): GhaScheduleTrigger {
    let cron: readonly string[] = [];

    if (Array.isArray(config)) {
      cron = config
        .map(item => (item as Record<string, unknown>)?.cron as string)
        .filter((c): c is string => typeof c === 'string');
    }

    return {
      type: 'schedule',
      cron,
    };
  }

  private createWorkflowCallTrigger(config?: Record<string, unknown>): GhaWorkflowCallTrigger {
    return {
      type: 'workflow_call',
      inputs: config?.inputs as Record<string, any> | undefined,
      outputs: config?.outputs as Record<string, any> | undefined,
      secrets: config?.secrets as Record<string, any> | undefined,
    };
  }

  private createWorkflowRunTrigger(config?: Record<string, unknown>): GhaWorkflowRunTrigger {
    return {
      type: 'workflow_run',
      workflows: this.extractStringArray(config?.workflows) ?? [],
      types: this.extractStringArray(config?.types) as readonly ('completed' | 'requested' | 'in_progress')[] | undefined,
      branches: this.extractStringArray(config?.branches),
      branchesIgnore: this.extractStringArray(config?.['branches-ignore']),
    };
  }

  // ============================================================================
  // Job Extraction
  // ============================================================================

  private extractJobs(
    jobsObj: unknown,
    filePath: string,
    errors: GhaParseError[]
  ): ReadonlyMap<string, GhaJob> {
    const jobs = new Map<string, GhaJob>();

    if (!jobsObj || typeof jobsObj !== 'object') {
      errors.push({
        message: 'Workflow missing "jobs" section',
        file: filePath,
        severity: 'error',
        code: 'INVALID_WORKFLOW',
      });
      return jobs;
    }

    const jobsRecord = jobsObj as Record<string, unknown>;

    for (const [jobId, jobConfig] of Object.entries(jobsRecord)) {
      if (!jobConfig || typeof jobConfig !== 'object') {
        errors.push({
          message: `Invalid job definition for "${jobId}"`,
          file: filePath,
          severity: 'error',
          code: 'INVALID_JOB',
        });
        continue;
      }

      const job = this.extractJob(jobId, jobConfig as Record<string, unknown>, filePath, errors);
      jobs.set(jobId, job);
    }

    return jobs;
  }

  private extractJob(
    jobId: string,
    config: Record<string, unknown>,
    filePath: string,
    errors: GhaParseError[]
  ): GhaJob {
    // Extract runs-on
    let runsOn: string | readonly string[] = 'ubuntu-latest';
    if (typeof config['runs-on'] === 'string') {
      runsOn = config['runs-on'];
    } else if (Array.isArray(config['runs-on'])) {
      runsOn = config['runs-on'].map(String);
    }

    // Extract needs
    let needs: readonly string[] = [];
    if (typeof config.needs === 'string') {
      needs = [config.needs];
    } else if (Array.isArray(config.needs)) {
      needs = config.needs.filter((n): n is string => typeof n === 'string');
    }

    // Extract steps
    const steps = this.extractSteps(config.steps, jobId, filePath, errors);

    // Extract outputs
    const outputs: Record<string, string> = {};
    if (config.outputs && typeof config.outputs === 'object') {
      for (const [key, value] of Object.entries(config.outputs as Record<string, unknown>)) {
        outputs[key] = String(value);
      }
    }

    // Extract strategy
    const strategy = this.extractStrategy(config.strategy);

    // Extract container
    const container = this.extractContainer(config.container);

    // Extract environment
    const environment = this.extractEnvironment(config.environment);

    return {
      id: jobId,
      name: typeof config.name === 'string' ? config.name : null,
      runsOn,
      needs,
      outputs,
      steps,
      env: this.extractEnv(config.env),
      if: typeof config.if === 'string' ? config.if : undefined,
      strategy,
      container,
      services: config.services as Record<string, any> | undefined,
      timeoutMinutes: typeof config['timeout-minutes'] === 'number' ? config['timeout-minutes'] : undefined,
      continueOnError: config['continue-on-error'] === true,
      environment,
      permissions: this.extractPermissions(config.permissions),
      concurrency: this.extractConcurrency(config.concurrency),
      defaults: this.extractDefaults(config.defaults),
      location: {
        file: filePath,
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 1,
      },
    };
  }

  // ============================================================================
  // Step Extraction
  // ============================================================================

  private extractSteps(
    stepsArr: unknown,
    jobId: string,
    filePath: string,
    errors: GhaParseError[]
  ): readonly GhaStep[] {
    if (!Array.isArray(stepsArr)) {
      return [];
    }

    const steps: GhaStep[] = [];

    for (let i = 0; i < stepsArr.length; i++) {
      const stepConfig = stepsArr[i];

      if (!stepConfig || typeof stepConfig !== 'object') {
        errors.push({
          message: `Invalid step at index ${i} in job "${jobId}"`,
          file: filePath,
          severity: 'warning',
          code: 'INVALID_STEP',
        });
        continue;
      }

      const step = this.extractStep(stepConfig as Record<string, unknown>, i, filePath);
      steps.push(step);
    }

    return steps;
  }

  private extractStep(
    config: Record<string, unknown>,
    index: number,
    filePath: string
  ): GhaStep {
    const baseProps = {
      id: typeof config.id === 'string' ? config.id : undefined,
      name: typeof config.name === 'string' ? config.name : undefined,
      if: typeof config.if === 'string' ? config.if : undefined,
      env: this.extractEnv(config.env),
      continueOnError: config['continue-on-error'] === true,
      timeoutMinutes: typeof config['timeout-minutes'] === 'number' ? config['timeout-minutes'] : undefined,
      workingDirectory: typeof config['working-directory'] === 'string' ? config['working-directory'] : undefined,
      location: {
        file: filePath,
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 1,
      },
    };

    // Check if it's a uses step
    if (typeof config.uses === 'string') {
      const usesStep: GhaUsesStep = {
        ...baseProps,
        type: 'uses',
        uses: config.uses,
        with: config.with as Record<string, string | number | boolean> | undefined,
      };
      return usesStep;
    }

    // Otherwise it's a run step
    const runStep: GhaRunStep = {
      ...baseProps,
      type: 'run',
      run: typeof config.run === 'string' ? config.run : '',
      shell: config.shell as GhaRunStep['shell'],
    };
    return runStep;
  }

  // ============================================================================
  // Helper Extraction Methods
  // ============================================================================

  private extractEnv(env: unknown): Readonly<Record<string, string>> {
    if (!env || typeof env !== 'object') {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      result[key] = String(value ?? '');
    }
    return result;
  }

  private extractDefaults(defaults: unknown): GhaDefaults | undefined {
    if (!defaults || typeof defaults !== 'object') {
      return undefined;
    }

    const d = defaults as Record<string, unknown>;
    const run = d.run as Record<string, unknown> | undefined;

    if (!run) {
      return undefined;
    }

    return {
      run: {
        shell: run.shell as GhaDefaults['run'] extends { shell?: infer S } ? S : undefined,
        workingDirectory: run['working-directory'] as string | undefined,
      },
    };
  }

  private extractPermissions(permissions: unknown): GhaPermissions | undefined {
    if (!permissions || typeof permissions !== 'object') {
      return undefined;
    }

    const p = permissions as Record<string, unknown>;
    const result: GhaPermissions = {};

    const keys: Array<keyof GhaPermissions> = [
      'actions', 'checks', 'contents', 'deployments', 'discussions',
      'idToken', 'issues', 'packages', 'pages', 'pullRequests',
      'repositoryProjects', 'securityEvents', 'statuses',
    ];

    for (const key of keys) {
      const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      const value = p[kebabKey] ?? p[key];
      if (value === 'read' || value === 'write' || value === 'none') {
        (result as Record<string, string>)[key] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private extractConcurrency(concurrency: unknown): GhaConcurrency | undefined {
    if (!concurrency) {
      return undefined;
    }

    if (typeof concurrency === 'string') {
      return {
        group: concurrency,
        cancelInProgress: false,
      };
    }

    if (typeof concurrency === 'object') {
      const c = concurrency as Record<string, unknown>;
      return {
        group: String(c.group ?? ''),
        cancelInProgress: c['cancel-in-progress'] === true,
      };
    }

    return undefined;
  }

  private extractStrategy(strategy: unknown): GhaStrategy | undefined {
    if (!strategy || typeof strategy !== 'object') {
      return undefined;
    }

    const s = strategy as Record<string, unknown>;
    const matrixConfig = s.matrix as Record<string, unknown> | undefined;

    if (!matrixConfig) {
      return undefined;
    }

    const dimensions: Record<string, readonly unknown[]> = {};
    const include: readonly Record<string, unknown>[] = [];
    const exclude: readonly Record<string, unknown>[] = [];

    for (const [key, value] of Object.entries(matrixConfig)) {
      if (key === 'include' && Array.isArray(value)) {
        (include as Record<string, unknown>[]).push(...value);
      } else if (key === 'exclude' && Array.isArray(value)) {
        (exclude as Record<string, unknown>[]).push(...value);
      } else if (Array.isArray(value)) {
        dimensions[key] = value;
      }
    }

    return {
      matrix: {
        dimensions,
        include: include.length > 0 ? include : undefined,
        exclude: exclude.length > 0 ? exclude : undefined,
      },
      failFast: s['fail-fast'] !== false,
      maxParallel: typeof s['max-parallel'] === 'number' ? s['max-parallel'] : undefined,
    };
  }

  private extractContainer(container: unknown): GhaContainer | undefined {
    if (!container) {
      return undefined;
    }

    if (typeof container === 'string') {
      return {
        image: container,
      };
    }

    if (typeof container === 'object') {
      const c = container as Record<string, unknown>;
      return {
        image: String(c.image ?? ''),
        credentials: c.credentials as GhaContainer['credentials'],
        env: this.extractEnv(c.env),
        ports: c.ports as readonly (number | string)[] | undefined,
        volumes: c.volumes as readonly string[] | undefined,
        options: typeof c.options === 'string' ? c.options : undefined,
      };
    }

    return undefined;
  }

  private extractEnvironment(environment: unknown): GhaEnvironment | undefined {
    if (!environment) {
      return undefined;
    }

    if (typeof environment === 'string') {
      return {
        name: environment,
      };
    }

    if (typeof environment === 'object') {
      const e = environment as Record<string, unknown>;
      return {
        name: String(e.name ?? ''),
        url: typeof e.url === 'string' ? e.url : undefined,
      };
    }

    return undefined;
  }

  private extractStringArray(value: unknown): readonly string[] | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }

    return undefined;
  }

  // ============================================================================
  // Enrichment Methods
  // ============================================================================

  private enrichWithJobId(
    steps: readonly TerraformStepInfo[],
    workflow: GhaWorkflow
  ): readonly TerraformStepInfo[] {
    const result: TerraformStepInfo[] = [];
    let stepOffset = 0;

    for (const [jobId, job] of workflow.jobs) {
      for (let i = 0; i < job.steps.length; i++) {
        const matchingStep = steps.find(s => s.stepIndex === stepOffset + i);
        if (matchingStep) {
          result.push({
            ...matchingStep,
            jobId,
          });
        }
      }
      stepOffset += job.steps.length;
    }

    return result;
  }

  private enrichHelmWithJobId(
    steps: readonly HelmStepInfo[],
    workflow: GhaWorkflow
  ): readonly HelmStepInfo[] {
    const result: HelmStepInfo[] = [];
    let stepOffset = 0;

    for (const [jobId, job] of workflow.jobs) {
      for (let i = 0; i < job.steps.length; i++) {
        const matchingStep = steps.find(s => s.stepIndex === stepOffset + i);
        if (matchingStep) {
          result.push({
            ...matchingStep,
            jobId,
          });
        }
      }
      stepOffset += job.steps.length;
    }

    return result;
  }

  private enrichExpressionsWithFile(
    expressions: readonly GhaExpression[],
    filePath: string
  ): readonly GhaExpression[] {
    return expressions.map(expr => ({
      ...expr,
      location: {
        ...expr.location,
        file: filePath,
      },
    }));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new GitHub Actions parser instance
 * @param options - Parser options
 * @returns Configured parser instance
 */
export function createGitHubActionsParser(
  options?: ParserOptions & Partial<GhaParserOptions>
): GitHubActionsParser {
  return new GitHubActionsParser(options);
}

/**
 * Parse a GitHub Actions workflow directly
 * @param content - YAML content to parse
 * @param filePath - File path for error reporting
 * @param options - Parser options
 * @returns Parse result with workflow structure
 */
export async function parseGitHubActionsWorkflow(
  content: string,
  filePath: string,
  options?: ParserOptions & Partial<GhaParserOptions>
): Promise<ParseResult<GhaParseResult>> {
  const parser = createGitHubActionsParser(options);
  return parser.parse(content, filePath, options);
}

// ============================================================================
// Re-exports for convenience (classes are already exported where defined)
// ============================================================================

// Note: GitHubActionsParser, GhaExpressionParser, and GhaToolDetector
// are already exported via their class definitions above.
