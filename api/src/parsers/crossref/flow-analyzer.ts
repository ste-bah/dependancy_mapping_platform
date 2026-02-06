/**
 * Flow Analyzer for TF-Helm Cross-Reference Detection
 * @module parsers/crossref/flow-analyzer
 *
 * Implements IFlowAnalyzer for analyzing CI workflow steps and tracing
 * data flows between Terraform outputs and Helm value inputs.
 *
 * TASK-XREF-003: Terraform Output to Helm Variable Detection
 */

import { SourceLocation } from '../terraform/types';
import {
  TerraformOutputInfo,
  HelmValueSource,
  VariableOrigin,
  VariableOriginType,
  TerraformOutputName,
  HelmValuePath,
  TerraformOutputCommand,
  HelmValueCommand,
  HelmValueSourceType,
  createTerraformOutputName,
  createHelmValuePath,
} from './types';
import {
  IFlowAnalyzer,
  TerraformStepInfo,
  HelmStepInfo,
  TraceContext,
} from './interfaces';

// ============================================================================
// Regex Patterns for Terraform Output Detection
// ============================================================================

/**
 * Patterns for detecting Terraform output commands and references
 */
const TF_OUTPUT_PATTERNS = {
  /** terraform output [-json] [-raw] [name] */
  OUTPUT_CMD: /terraform\s+output\s+(?:(-json)\s+)?(?:(-raw)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)?/gi,

  /** Variable capture: VAR=$(terraform output ...) */
  VAR_CAPTURE: /([a-zA-Z_][a-zA-Z0-9_]*)=\$\(\s*terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/gi,

  /** GHA output set: echo "name=value" >> $GITHUB_OUTPUT */
  GHA_OUTPUT: /echo\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)=([^"'\n]+)["']?\s*>>\s*\$GITHUB_OUTPUT/gi,

  /** Backtick command substitution: `terraform output ...` */
  BACKTICK_CMD: /`terraform\s+output\s+(?:-(?:raw|json)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)`/gi,

  /** Direct terraform output name extraction */
  OUTPUT_NAME_ONLY: /terraform\s+output\s+(?:-(?:raw|json)\s+)*([a-zA-Z_][a-zA-Z0-9_]*)/gi,
} as const;

// ============================================================================
// Regex Patterns for Helm Value Detection
// ============================================================================

/**
 * Patterns for detecting Helm value references and commands
 */
const HELM_PATTERNS = {
  /** --set key=value or --set-string key=value */
  SET_VALUE: /--set(?:-string)?\s+([^=\s]+)=([^\s]+)/g,

  /** -f values.yaml or --values values.yaml */
  VALUES_FILE: /(?:-f\s+|--values[=\s]+)([^\s]+)/g,

  /** Helm upgrade/install command detection */
  HELM_CMD: /helm\s+(upgrade|install|template|lint)\s+/i,

  /** Release name extraction */
  RELEASE_NAME: /helm\s+(?:upgrade|install)\s+([a-zA-Z0-9_-]+)\s+/i,

  /** Chart reference extraction */
  CHART_REF: /helm\s+(?:upgrade|install)\s+[^\s]+\s+([^\s]+)/i,

  /** Namespace flag */
  NAMESPACE: /(?:-n|--namespace)[=\s]+([^\s]+)/i,
} as const;

// ============================================================================
// GHA Expression Patterns
// ============================================================================

/**
 * Patterns for GitHub Actions expression parsing
 */
const GHA_EXPR_PATTERNS = {
  /** ${{ needs.job.outputs.name }} */
  NEEDS_OUTPUT: /\$\{\{\s*needs\.([a-zA-Z_][a-zA-Z0-9_-]*)\.outputs\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/gi,

  /** ${{ steps.id.outputs.name }} */
  STEP_OUTPUT: /\$\{\{\s*steps\.([a-zA-Z_][a-zA-Z0-9_-]*)\.outputs\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/gi,

  /** ${{ env.NAME }} */
  ENV_REF: /\$\{\{\s*env\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/gi,

  /** Shell variable: $VAR or ${VAR} */
  SHELL_VAR: /\$([a-zA-Z_][a-zA-Z0-9_]*)|\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
} as const;

// ============================================================================
// FlowAnalyzer Implementation
// ============================================================================

/**
 * Implements workflow flow analysis for TF-Helm cross-reference detection.
 * Analyzes CI workflow steps to identify Terraform outputs and Helm value inputs,
 * and traces variable origins to establish data flow connections.
 *
 * @implements {IFlowAnalyzer}
 *
 * @example
 * ```typescript
 * const analyzer = new FlowAnalyzer();
 * const tfSteps = analyzer.findTerraformSteps(job.steps, 'terraform-job');
 * const helmSteps = analyzer.findHelmSteps(job.steps, 'deploy-job');
 * const origins = analyzer.traceVariable('cluster_endpoint', 'needs', ctx);
 * ```
 */
export class FlowAnalyzer implements IFlowAnalyzer {
  // ==========================================================================
  // Step Detection Methods
  // ==========================================================================

  /**
   * Find all Terraform steps in a job's steps array.
   * Identifies steps that run Terraform commands, especially those producing outputs.
   *
   * @param steps - Array of workflow steps
   * @param jobId - ID of the containing job
   * @returns Array of Terraform step information
   */
  findTerraformSteps(
    steps: readonly unknown[],
    jobId: string
  ): TerraformStepInfo[] {
    const tfSteps: TerraformStepInfo[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as Record<string, unknown>;
      const run = step?.run as string | undefined;

      if (!run) continue;

      // Check for terraform commands
      if (this.containsTerraformCommand(run)) {
        const outputs = this.extractTerraformOutputsFromCommand(run);
        const command = this.detectTerraformCommand(run);

        // Include step if it has outputs or is an apply/output/plan command
        if (
          outputs.length > 0 ||
          command === 'output' ||
          command === 'apply' ||
          command === 'plan'
        ) {
          const envVars = this.extractStepEnvVars(step);

          tfSteps.push({
            stepIndex: i,
            stepId: step?.id as string | undefined,
            command,
            outputs: outputs,
            workingDir: this.extractWorkingDir(run),
            envVars,
          });
        }
      }
    }

    return tfSteps;
  }

  /**
   * Find all Helm steps in a job's steps array.
   * Identifies steps that run Helm commands with value inputs.
   *
   * @param steps - Array of workflow steps
   * @param jobId - ID of the containing job
   * @returns Array of Helm step information
   */
  findHelmSteps(steps: readonly unknown[], jobId: string): HelmStepInfo[] {
    const helmSteps: HelmStepInfo[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as Record<string, unknown>;
      const run = step?.run as string | undefined;

      if (!run) continue;

      // Check for helm commands
      if (this.containsHelmCommand(run)) {
        const setValues = this.extractHelmSetValuesFromCommand(run);
        const valuesFiles = this.extractHelmValuesFiles(run);
        const command = this.detectHelmCommand(run);

        helmSteps.push({
          stepIndex: i,
          stepId: step?.id as string | undefined,
          command,
          setValues,
          valuesFiles,
          releaseName: this.extractHelmReleaseName(run),
          chart: this.extractHelmChart(run),
          namespace: this.extractHelmNamespace(run),
        });
      }
    }

    return helmSteps;
  }

  // ==========================================================================
  // Variable Tracing Methods
  // ==========================================================================

  /**
   * Trace the origin of a variable value through the workflow.
   * Follows variable references to identify if they originate from Terraform outputs.
   *
   * @param name - Variable name to trace
   * @param scope - Scope where variable is used ('needs', 'env', 'steps', etc.)
   * @param ctx - Trace context with workflow information
   * @returns Array of possible variable origins
   */
  traceVariable(
    name: string,
    scope: string,
    ctx: TraceContext
  ): VariableOrigin[] {
    const origins: VariableOrigin[] = [];

    switch (scope) {
      case 'needs':
        origins.push(...this.traceNeedsVariable(name, ctx));
        break;
      case 'env':
        origins.push(...this.traceEnvVariable(name, ctx));
        break;
      case 'steps':
        origins.push(...this.traceStepVariable(name, ctx));
        break;
      default:
        // Unknown scope - try to infer from naming conventions
        origins.push(...this.traceByNamingConvention(name, ctx));
    }

    return origins;
  }

  /**
   * Trace a variable from needs.jobId.outputs context.
   */
  private traceNeedsVariable(
    namePath: string,
    ctx: TraceContext
  ): VariableOrigin[] {
    const origins: VariableOrigin[] = [];

    // Parse: jobId.outputs.outputName or just outputName
    const parts = namePath.split('.');
    let jobId: string;
    let outputName: string;

    if (parts.length >= 2) {
      // Format: jobId.outputs.outputName or jobId.outputName
      jobId = parts[0];
      outputName = parts[parts.length - 1];
    } else {
      // Just the output name, need to search dependent jobs
      outputName = namePath;
      jobId = '';
    }

    // Search in dependent jobs for Terraform outputs
    for (const [depJobId, depJob] of Array.from(ctx.dependentJobs)) {
      if (jobId && depJobId !== jobId) continue;

      const jobSteps =
        (depJob as Record<string, unknown>)?.steps as readonly unknown[];
      if (!jobSteps) continue;

      const tfSteps = this.findTerraformSteps(jobSteps, depJobId);
      const hasTfOutput = tfSteps.some(
        (s) => s.command === 'output' || s.outputs.includes(outputName)
      );

      if (hasTfOutput) {
        origins.push({
          type: 'terraform_output',
          source: `${depJobId}.outputs.${outputName}`,
          confidence: 85,
          transformations: [],
        });
      } else if (tfSteps.length > 0) {
        // Job has TF steps but no direct output match - medium confidence
        origins.push({
          type: 'job_output',
          source: `${depJobId}.outputs.${outputName}`,
          confidence: 60,
          transformations: [],
        });
      }
    }

    // Check available outputs from context
    if (ctx.availableOutputs.has(jobId || '')) {
      const jobOutputs = ctx.availableOutputs.get(jobId || '');
      if (jobOutputs?.has(outputName)) {
        const outputValue = jobOutputs.get(outputName);
        if (
          outputValue &&
          (outputValue.includes('terraform') || outputValue.includes('TF_'))
        ) {
          origins.push({
            type: 'terraform_output',
            source: `${jobId}.outputs.${outputName}`,
            confidence: 75,
            transformations: [
              { type: 'expression', description: 'GHA output reference' },
            ],
          });
        }
      }
    }

    return origins;
  }

  /**
   * Trace a variable from env context.
   */
  private traceEnvVariable(name: string, ctx: TraceContext): VariableOrigin[] {
    const origins: VariableOrigin[] = [];

    // Check job-level env
    const job = ctx.job as Record<string, unknown>;
    const jobEnv = job?.env as Record<string, string> | undefined;

    if (jobEnv?.[name]) {
      const envValue = jobEnv[name];
      const hasTfRef =
        envValue.includes('terraform output') ||
        (envValue.includes('needs.') && envValue.includes('outputs'));

      origins.push({
        type: hasTfRef ? 'terraform_output' : 'env_variable',
        source: `env.${name}`,
        confidence: hasTfRef ? 80 : 40,
        transformations: hasTfRef
          ? [{ type: 'env_expansion', description: 'Environment variable' }]
          : [],
      });
    }

    // Check scope env vars
    if (ctx.envInScope[name]) {
      const scopeValue = ctx.envInScope[name];
      const hasTfRef =
        scopeValue.includes('terraform') || /TF_|_OUTPUT/i.test(scopeValue);

      origins.push({
        type: hasTfRef ? 'terraform_output' : 'env_variable',
        source: `env.${name}`,
        confidence: hasTfRef ? 70 : 35,
        transformations: [],
      });
    }

    return origins;
  }

  /**
   * Trace a variable from steps context.
   */
  private traceStepVariable(
    name: string,
    ctx: TraceContext
  ): VariableOrigin[] {
    const origins: VariableOrigin[] = [];

    // Parse: stepId.outputs.outputName
    const parts = name.split('.');
    const stepId = parts[0];
    const outputName = parts.length > 1 ? parts[parts.length - 1] : name;

    // Search through steps for the source
    for (let i = 0; i < ctx.steps.length; i++) {
      const step = ctx.steps[i] as Record<string, unknown>;
      if (stepId && step?.id !== stepId) continue;

      const run = step?.run as string | undefined;
      if (!run) continue;

      if (this.containsTerraformCommand(run)) {
        const outputs = this.extractTerraformOutputsFromCommand(run);
        if (outputs.includes(outputName) || run.includes('terraform output')) {
          origins.push({
            type: 'terraform_output',
            source: `steps.${stepId}.outputs.${outputName}`,
            confidence: 90,
            transformations: [],
          });
        }
      }
    }

    return origins;
  }

  /**
   * Trace variable using naming conventions.
   */
  private traceByNamingConvention(
    name: string,
    ctx: TraceContext
  ): VariableOrigin[] {
    const origins: VariableOrigin[] = [];

    // Common TF output naming patterns
    const tfOutputPatterns = [
      /^tf_/i,
      /_output$/i,
      /^terraform_/i,
      /cluster_endpoint/i,
      /vpc_id/i,
      /subnet_ids/i,
      /security_group/i,
      /arn$/i,
      /rds_/i,
      /eks_/i,
    ];

    const matchesPattern = tfOutputPatterns.some((p) => p.test(name));

    if (matchesPattern) {
      origins.push({
        type: 'terraform_output',
        source: name,
        confidence: 45,
        transformations: [
          { type: 'expression', description: 'Naming convention inference' },
        ],
      });
    }

    return origins;
  }

  // ==========================================================================
  // Command Analysis Methods
  // ==========================================================================

  /**
   * Analyze a Terraform command string for output information.
   * Extracts details about terraform output commands including format flags.
   *
   * @param cmd - Terraform command string
   * @returns Output information if detectable, null otherwise
   */
  analyzeTerraformCommand(cmd: string): TerraformOutputInfo | null {
    const match = cmd.match(
      /terraform\s+output\s+(?:(-json)\s+)?(?:(-raw)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)?/i
    );

    if (!match) return null;

    const [, jsonFlag, rawFlag, name] = match;

    // Determine the command type
    let outputCommand: TerraformOutputCommand = 'output';
    if (cmd.includes('terraform apply')) {
      outputCommand = 'apply';
    } else if (cmd.includes('terraform plan')) {
      outputCommand = 'plan';
    } else if (cmd.includes('terraform show')) {
      outputCommand = 'show';
    }

    return {
      name: createTerraformOutputName(name || ''),
      jobId: '', // To be filled by caller
      stepIndex: 0, // To be filled by caller
      command: outputCommand,
      sensitive: false, // Would need TF config to determine
      location: this.createDefaultLocation(),
    };
  }

  /**
   * Analyze Helm step for set values and their sources.
   * Extracts all --set values and determines if they reference Terraform outputs.
   *
   * @param step - Helm step object
   * @returns Array of Helm value sources
   */
  analyzeHelmSetValues(step: unknown): HelmValueSource[] {
    const sources: HelmValueSource[] = [];
    const stepObj = step as Record<string, unknown>;
    const run = stepObj?.run as string | undefined;

    if (!run) return sources;

    // Extract --set values
    const setMatches = run.matchAll(/--set(?:-string)?\s+([^=\s]+)=([^\s]+)/g);

    for (const match of Array.from(setMatches)) {
      const [fullMatch, path, value] = match;
      const usesTfOutput = this.valueReferencesTfOutput(value);
      const sourceType = this.determineHelmSourceType(fullMatch);

      sources.push({
        path: createHelmValuePath(path),
        jobId: '', // To be filled by caller
        stepIndex: 0, // To be filled by caller
        command: this.detectHelmCommand(run) as HelmValueCommand,
        sourceType,
        location: this.createDefaultLocation(),
      });
    }

    return sources;
  }

  // ==========================================================================
  // Extraction Methods
  // ==========================================================================

  /**
   * Extract output names from Terraform output command.
   *
   * @param command - Full command string
   * @returns Array of Terraform output names
   */
  extractTerraformOutputNames(command: string): TerraformOutputName[] {
    const names: TerraformOutputName[] = [];
    const outputs = this.extractTerraformOutputsFromCommand(command);

    for (const output of outputs) {
      names.push(createTerraformOutputName(output));
    }

    return names;
  }

  /**
   * Extract value paths from Helm set flags.
   *
   * @param setFlags - Array of --set flag values
   * @returns Array of Helm value paths
   */
  extractHelmValuePaths(setFlags: readonly string[]): HelmValuePath[] {
    const paths: HelmValuePath[] = [];

    for (const flag of setFlags) {
      // Extract the key part from key=value
      const match = flag.match(/^([^=]+)=/);
      if (match) {
        paths.push(createHelmValuePath(match[1]));
      }
    }

    return paths;
  }

  // ==========================================================================
  // Type Check Methods
  // ==========================================================================

  /**
   * Check if a step is a Terraform step.
   *
   * @param step - Step to check
   * @returns True if step runs Terraform
   */
  isTerraformStep(step: unknown): boolean {
    const stepObj = step as Record<string, unknown>;
    const run = stepObj?.run as string | undefined;

    if (run && this.containsTerraformCommand(run)) {
      return true;
    }

    // Check for terraform actions
    const uses = stepObj?.uses as string | undefined;
    if (uses && uses.includes('terraform')) {
      return true;
    }

    return false;
  }

  /**
   * Check if a step is a Helm step.
   *
   * @param step - Step to check
   * @returns True if step runs Helm
   */
  isHelmStep(step: unknown): boolean {
    const stepObj = step as Record<string, unknown>;
    const run = stepObj?.run as string | undefined;

    if (run && this.containsHelmCommand(run)) {
      return true;
    }

    // Check for helm actions
    const uses = stepObj?.uses as string | undefined;
    if (uses && (uses.includes('helm') || uses.includes('azure/setup-helm'))) {
      return true;
    }

    return false;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Check if command string contains Terraform commands.
   */
  private containsTerraformCommand(cmd: string): boolean {
    return /terraform\s+/i.test(cmd);
  }

  /**
   * Check if command string contains Helm commands.
   */
  private containsHelmCommand(cmd: string): boolean {
    return /helm\s+/i.test(cmd);
  }

  /**
   * Extract Terraform output names from a command string.
   */
  private extractTerraformOutputsFromCommand(run: string): string[] {
    const outputs: string[] = [];

    // Match: terraform output [-raw|-json] name
    const outputMatches = run.matchAll(
      /terraform\s+output\s+(?:-(?:raw|json)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi
    );
    for (const match of Array.from(outputMatches)) {
      if (match[1]) outputs.push(match[1]);
    }

    // Match: VAR=$(terraform output ...)
    const varMatches = run.matchAll(
      /([a-zA-Z_][a-zA-Z0-9_]*)=\$\(\s*terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/gi
    );
    for (const match of Array.from(varMatches)) {
      if (match[2]) outputs.push(match[2]);
    }

    // Match: `terraform output ...`
    const backtickMatches = run.matchAll(
      /`terraform\s+output\s+(?:-(?:raw|json)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)`/gi
    );
    for (const match of Array.from(backtickMatches)) {
      if (match[1]) outputs.push(match[1]);
    }

    return Array.from(new Set(outputs));
  }

  /**
   * Extract --set values from Helm command as a Map.
   */
  private extractHelmSetValuesFromCommand(
    run: string
  ): ReadonlyMap<string, string> {
    const values = new Map<string, string>();
    const matches = run.matchAll(/--set(?:-string)?\s+([^=\s]+)=([^\s]+)/g);

    for (const match of Array.from(matches)) {
      values.set(match[1], match[2]);
    }

    return values;
  }

  /**
   * Extract values files from Helm command.
   */
  private extractHelmValuesFiles(run: string): string[] {
    const files: string[] = [];

    // -f values.yaml
    const fMatches = run.matchAll(/-f\s+([^\s]+)/g);
    for (const match of Array.from(fMatches)) {
      // Exclude flags that start with -
      if (!match[1].startsWith('-')) {
        files.push(match[1]);
      }
    }

    // --values values.yaml or --values=values.yaml
    const valuesMatches = run.matchAll(/--values[=\s]+([^\s]+)/g);
    for (const match of Array.from(valuesMatches)) {
      files.push(match[1]);
    }

    return files;
  }

  /**
   * Detect the Terraform command type from a run string.
   */
  private detectTerraformCommand(run: string): string {
    if (/terraform\s+output/i.test(run)) return 'output';
    if (/terraform\s+apply/i.test(run)) return 'apply';
    if (/terraform\s+plan/i.test(run)) return 'plan';
    if (/terraform\s+init/i.test(run)) return 'init';
    if (/terraform\s+show/i.test(run)) return 'show';
    if (/terraform\s+destroy/i.test(run)) return 'destroy';
    return 'other';
  }

  /**
   * Detect the Helm command type from a run string.
   */
  private detectHelmCommand(run: string): string {
    if (/helm\s+upgrade/i.test(run)) return 'upgrade';
    if (/helm\s+install/i.test(run)) return 'install';
    if (/helm\s+template/i.test(run)) return 'template';
    if (/helm\s+lint/i.test(run)) return 'lint';
    return 'other';
  }

  /**
   * Extract working directory from command (terraform -chdir or cd command).
   */
  private extractWorkingDir(run: string): string | undefined {
    // Check for -chdir flag
    const chdirMatch = run.match(/-chdir=([^\s]+)/);
    if (chdirMatch) return chdirMatch[1];

    // Check for cd command before terraform
    const cdMatch = run.match(/cd\s+([^\s;&|]+)/);
    if (cdMatch) return cdMatch[1];

    return undefined;
  }

  /**
   * Extract Helm release name from command.
   */
  private extractHelmReleaseName(run: string): string | undefined {
    const match = run.match(
      /helm\s+(?:upgrade|install)\s+([a-zA-Z0-9_-]+)\s+/i
    );
    return match?.[1];
  }

  /**
   * Extract Helm chart reference from command.
   */
  private extractHelmChart(run: string): string | undefined {
    const match = run.match(/helm\s+(?:upgrade|install)\s+[^\s]+\s+([^\s]+)/i);
    // Exclude flags
    if (match?.[1] && !match[1].startsWith('-')) {
      return match[1];
    }
    return undefined;
  }

  /**
   * Extract Helm namespace from command.
   */
  private extractHelmNamespace(run: string): string | undefined {
    const match = run.match(/(?:-n|--namespace)[=\s]+([^\s]+)/i);
    return match?.[1];
  }

  /**
   * Extract environment variables from a step.
   */
  private extractStepEnvVars(
    step: Record<string, unknown>
  ): Readonly<Record<string, string>> {
    const env = step?.env as Record<string, string> | undefined;
    return env ? Object.freeze({ ...env }) : Object.freeze({});
  }

  /**
   * Check if a value expression references a Terraform output.
   */
  private valueReferencesTfOutput(value: string): boolean {
    // Check for GHA needs output reference
    if (/\$\{\{\s*needs\.[a-zA-Z_][a-zA-Z0-9_-]*\.outputs\.[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/.test(value)) {
      return true;
    }

    // Check for shell variable that might be TF output
    if (/\$\(\s*terraform\s+output/i.test(value)) {
      return true;
    }

    // Check for steps output reference
    if (/\$\{\{\s*steps\.[a-zA-Z_][a-zA-Z0-9_-]*\.outputs\.[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/.test(value)) {
      return true;
    }

    // Check for common TF output variable patterns
    if (/\$\{?TF_|_OUTPUT\}?/i.test(value)) {
      return true;
    }

    // Check for backtick terraform command
    if (/`terraform\s+output/i.test(value)) {
      return true;
    }

    return false;
  }

  /**
   * Determine the Helm value source type from a set flag.
   */
  private determineHelmSourceType(setFlag: string): HelmValueSourceType {
    if (setFlag.startsWith('--set-string')) return 'set_string';
    if (setFlag.startsWith('--set-file')) return 'set_file';
    return 'set_flag';
  }

  /**
   * Create a default source location for analysis results.
   */
  private createDefaultLocation(): SourceLocation {
    return {
      file: '',
      lineStart: 0,
      lineEnd: 0,
      columnStart: 0,
      columnEnd: 0,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create a FlowAnalyzer instance.
 * Provides a clean way to instantiate the analyzer for dependency injection.
 *
 * @returns A new IFlowAnalyzer instance
 *
 * @example
 * ```typescript
 * const analyzer = createFlowAnalyzer();
 * const tfSteps = analyzer.findTerraformSteps(steps, jobId);
 * ```
 */
export function createFlowAnalyzer(): IFlowAnalyzer {
  return new FlowAnalyzer();
}

// ============================================================================
// Exported Pattern Constants (for testing and extension)
// ============================================================================

export { TF_OUTPUT_PATTERNS, HELM_PATTERNS, GHA_EXPR_PATTERNS };
