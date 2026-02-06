/**
 * GitHub Actions Tool Detector
 * @module parsers/github-actions/tool-detector
 *
 * Detects Terraform, Helm, and other infrastructure tools in GitHub Actions workflow steps.
 * Analyzes both action references (uses:) and shell commands (run:) to identify tool usage.
 *
 * TASK-XREF-001: GitHub Actions Parser - Tool Detection
 * TASK-GHA-003: Terraform/Helm step detection
 */

import { SourceLocation } from '../terraform/types';
import {
  GhaStep,
  GhaJob,
  TerraformStepInfo,
  HelmStepInfo,
  TerraformCommand,
  HelmCommand,
  TerraformBackendInfo,
  isGhaRunStep,
  isGhaUsesStep,
  TERRAFORM_ACTIONS,
  HELM_ACTIONS,
  TERRAFORM_COMMAND_PATTERNS,
  HELM_COMMAND_PATTERNS,
} from './types';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Command detection result for internal use
 */
interface CommandDetection {
  readonly command: string;
  readonly confidence: number;
}

/**
 * Options for tool detection
 */
export interface ToolDetectorOptions {
  /** Default job ID when not provided */
  readonly defaultJobId?: string;
  /** Minimum confidence threshold (0-100) */
  readonly minConfidence?: number;
  /** Include low-confidence detections */
  readonly includeLowConfidence?: boolean;
}

/**
 * Default options for tool detection
 */
const DEFAULT_OPTIONS: Required<ToolDetectorOptions> = {
  defaultJobId: 'unknown',
  minConfidence: 50,
  includeLowConfidence: true,
};

// ============================================================================
// GhaToolDetector Class
// ============================================================================

/**
 * Detects infrastructure tool usage in GitHub Actions workflow steps.
 *
 * Supports detection of:
 * - Terraform (CLI commands and actions like hashicorp/setup-terraform)
 * - Helm (CLI commands and actions like azure/setup-helm)
 * - Terragrunt (CLI commands)
 *
 * @example
 * ```typescript
 * const detector = new GhaToolDetector();
 * const terraformSteps = detector.detectTerraformSteps(job.steps, job.id);
 * const helmSteps = detector.detectHelmSteps(job.steps, job.id);
 * ```
 */
export class GhaToolDetector {
  private readonly options: Required<ToolDetectorOptions>;

  // ============================================================================
  // Terraform Detection Patterns
  // ============================================================================

  /**
   * Known Terraform-related GitHub Actions
   */
  private static readonly TERRAFORM_ACTION_PREFIXES: readonly string[] = [
    'hashicorp/setup-terraform',
    'hashicorp/terraform-github-actions',
    'hashicorp/tfc-workflows-tooling',
    'dflook/terraform-',
    'gruntwork-io/terragrunt-action',
  ];

  /**
   * Terraform command patterns with corresponding command types
   */
  private static readonly TERRAFORM_COMMANDS: readonly {
    readonly pattern: RegExp;
    readonly command: TerraformCommand;
  }[] = [
    { pattern: /\bterraform\s+init\b/i, command: 'init' },
    { pattern: /\bterraform\s+plan\b/i, command: 'plan' },
    { pattern: /\bterraform\s+apply\b/i, command: 'apply' },
    { pattern: /\bterraform\s+destroy\b/i, command: 'destroy' },
    { pattern: /\bterraform\s+validate\b/i, command: 'validate' },
    { pattern: /\bterraform\s+fmt\b/i, command: 'fmt' },
    { pattern: /\bterraform\s+output\b/i, command: 'output' },
    { pattern: /\bterraform\s+import\b/i, command: 'import' },
    { pattern: /\bterraform\s+state\b/i, command: 'state' },
    { pattern: /\bterraform\s+workspace\b/i, command: 'workspace' },
    { pattern: /\bterraform\s+refresh\b/i, command: 'refresh' },
    { pattern: /\bterraform\s+taint\b/i, command: 'taint' },
    { pattern: /\bterraform\s+untaint\b/i, command: 'untaint' },
    { pattern: /\bterraform\s+force-unlock\b/i, command: 'force-unlock' },
    // Terragrunt commands map to terraform commands
    { pattern: /\bterragrunt\s+init\b/i, command: 'init' },
    { pattern: /\bterragrunt\s+plan\b/i, command: 'plan' },
    { pattern: /\bterragrunt\s+apply\b/i, command: 'apply' },
    { pattern: /\bterragrunt\s+destroy\b/i, command: 'destroy' },
    { pattern: /\bterragrunt\s+validate\b/i, command: 'validate' },
    { pattern: /\bterragrunt\s+run-all\b/i, command: 'apply' },
    // Short tf alias
    { pattern: /\btf\s+init\b/i, command: 'init' },
    { pattern: /\btf\s+plan\b/i, command: 'plan' },
    { pattern: /\btf\s+apply\b/i, command: 'apply' },
    { pattern: /\btf\s+destroy\b/i, command: 'destroy' },
  ];

  // ============================================================================
  // Helm Detection Patterns
  // ============================================================================

  /**
   * Known Helm-related GitHub Actions
   */
  private static readonly HELM_ACTION_PREFIXES: readonly string[] = [
    'azure/setup-helm',
    'azure/helm-deploy',
    'azure/k8s-bake',
    'deliverybot/helm',
    'WyriHaximus/github-action-helm3',
    'bitovi/github-actions-deploy-eks-helm',
  ];

  /**
   * Helm command patterns with corresponding command types
   */
  private static readonly HELM_COMMANDS: readonly {
    readonly pattern: RegExp;
    readonly command: HelmCommand;
  }[] = [
    { pattern: /\bhelm\s+install\b/i, command: 'install' },
    { pattern: /\bhelm\s+upgrade\b/i, command: 'upgrade' },
    { pattern: /\bhelm\s+uninstall\b/i, command: 'uninstall' },
    { pattern: /\bhelm\s+rollback\b/i, command: 'rollback' },
    { pattern: /\bhelm\s+template\b/i, command: 'template' },
    { pattern: /\bhelm\s+lint\b/i, command: 'lint' },
    { pattern: /\bhelm\s+package\b/i, command: 'package' },
    { pattern: /\bhelm\s+push\b/i, command: 'push' },
    { pattern: /\bhelm\s+pull\b/i, command: 'pull' },
    { pattern: /\bhelm\s+repo\b/i, command: 'repo' },
    { pattern: /\bhelm\s+dependency\b/i, command: 'dependency' },
    { pattern: /\bhelm\s+test\b/i, command: 'test' },
    // Helmfile commands
    { pattern: /\bhelmfile\s+apply\b/i, command: 'upgrade' },
    { pattern: /\bhelmfile\s+sync\b/i, command: 'upgrade' },
    { pattern: /\bhelmfile\s+diff\b/i, command: 'template' },
    { pattern: /\bhelmfile\s+template\b/i, command: 'template' },
    { pattern: /\bhelmfile\s+lint\b/i, command: 'lint' },
  ];

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Creates a new GhaToolDetector instance
   * @param options - Detection options
   */
  constructor(options: ToolDetectorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ============================================================================
  // Public API - Terraform Detection
  // ============================================================================

  /**
   * Detects Terraform-related steps in a job's steps array
   *
   * @param steps - Array of steps to analyze
   * @param jobId - ID of the parent job
   * @returns Array of detected Terraform step information
   *
   * @example
   * ```typescript
   * const detector = new GhaToolDetector();
   * const terraformSteps = detector.detectTerraformSteps(job.steps, job.id);
   * for (const tf of terraformSteps) {
   *   console.log(`Found ${tf.command} at step ${tf.stepIndex}`);
   * }
   * ```
   */
  detectTerraformSteps(
    steps: readonly GhaStep[],
    jobId: string = this.options.defaultJobId
  ): TerraformStepInfo[] {
    const results: TerraformStepInfo[] = [];

    steps.forEach((step, index) => {
      const info = this.detectTerraformInStep(step, index, jobId);
      if (info && info.confidence >= this.options.minConfidence) {
        results.push(info);
      }
    });

    return results;
  }

  /**
   * Detects Terraform steps across all jobs in a workflow
   *
   * @param jobs - Map of job ID to job definition
   * @returns Array of all detected Terraform step information
   */
  detectTerraformStepsInJobs(
    jobs: ReadonlyMap<string, GhaJob>
  ): TerraformStepInfo[] {
    const results: TerraformStepInfo[] = [];

    for (const [jobId, job] of jobs) {
      const jobResults = this.detectTerraformSteps(job.steps, jobId);
      results.push(...jobResults);
    }

    return results;
  }

  // ============================================================================
  // Public API - Helm Detection
  // ============================================================================

  /**
   * Detects Helm-related steps in a job's steps array
   *
   * @param steps - Array of steps to analyze
   * @param jobId - ID of the parent job
   * @returns Array of detected Helm step information
   *
   * @example
   * ```typescript
   * const detector = new GhaToolDetector();
   * const helmSteps = detector.detectHelmSteps(job.steps, job.id);
   * for (const helm of helmSteps) {
   *   console.log(`Found ${helm.command} for release ${helm.releaseName}`);
   * }
   * ```
   */
  detectHelmSteps(
    steps: readonly GhaStep[],
    jobId: string = this.options.defaultJobId
  ): HelmStepInfo[] {
    const results: HelmStepInfo[] = [];

    steps.forEach((step, index) => {
      const info = this.detectHelmInStep(step, index, jobId);
      if (info && info.confidence >= this.options.minConfidence) {
        results.push(info);
      }
    });

    return results;
  }

  /**
   * Detects Helm steps across all jobs in a workflow
   *
   * @param jobs - Map of job ID to job definition
   * @returns Array of all detected Helm step information
   */
  detectHelmStepsInJobs(
    jobs: ReadonlyMap<string, GhaJob>
  ): HelmStepInfo[] {
    const results: HelmStepInfo[] = [];

    for (const [jobId, job] of jobs) {
      const jobResults = this.detectHelmSteps(job.steps, jobId);
      results.push(...jobResults);
    }

    return results;
  }

  // ============================================================================
  // Private - Terraform Detection
  // ============================================================================

  /**
   * Detects Terraform usage in a single step
   */
  private detectTerraformInStep(
    step: GhaStep,
    index: number,
    jobId: string
  ): TerraformStepInfo | null {
    // Check uses field for Terraform actions
    if (isGhaUsesStep(step)) {
      return this.detectTerraformAction(step, index, jobId);
    }

    // Check run field for terraform commands
    if (isGhaRunStep(step)) {
      return this.detectTerraformCommand(step, index, jobId);
    }

    return null;
  }

  /**
   * Detects Terraform from action reference (uses:)
   */
  private detectTerraformAction(
    step: GhaStep & { type: 'uses'; uses: string },
    index: number,
    jobId: string
  ): TerraformStepInfo | null {
    const uses = step.uses;

    for (const actionPrefix of GhaToolDetector.TERRAFORM_ACTION_PREFIXES) {
      if (uses.startsWith(actionPrefix)) {
        // Determine command from action name
        const command = this.inferTerraformCommandFromAction(uses);

        // Extract working directory from with inputs
        const workingDirectory = this.extractWithValue(step.with, 'working-directory', 'terraform_wrapper_dir', 'path');

        // Extract workspace from with inputs
        const workspace = this.extractWithValue(step.with, 'terraform_workspace', 'workspace');

        // Check for Terraform Cloud usage
        const usesCloud = this.detectTerraformCloud(step.with);

        return {
          stepIndex: index,
          stepId: step.id,
          jobId,
          command,
          actionRef: uses,
          workingDirectory,
          workspace,
          usesCloud,
          varFiles: this.extractTerraformVarFiles(step.with),
          variables: this.extractTerraformVariables(step.with),
          arguments: this.extractTerraformArguments(step.with),
          envVars: step.env ?? {},
          backend: undefined,
          confidence: 95,
          location: step.location,
        };
      }
    }

    return null;
  }

  /**
   * Detects Terraform from shell command (run:)
   */
  private detectTerraformCommand(
    step: GhaStep & { type: 'run'; run: string },
    index: number,
    jobId: string
  ): TerraformStepInfo | null {
    const runContent = step.run;

    for (const { pattern, command } of GhaToolDetector.TERRAFORM_COMMANDS) {
      if (pattern.test(runContent)) {
        // Extract additional context from the command
        const workingDirectory = step.workingDirectory ?? this.extractWorkingDirectoryFromRun(runContent);
        const workspace = this.extractTerraformWorkspaceFromRun(runContent);
        const varFiles = this.extractTerraformVarFilesFromRun(runContent);
        const variables = this.extractTerraformVarsFromRun(runContent);
        const backend = this.extractTerraformBackendFromRun(runContent);
        const usesCloud = this.detectTerraformCloudFromRun(runContent);

        // Determine confidence based on detection specificity
        const confidence = this.calculateTerraformConfidence(runContent, command);

        return {
          stepIndex: index,
          stepId: step.id,
          jobId,
          command,
          workingDirectory,
          workspace,
          usesCloud,
          varFiles,
          variables,
          arguments: this.extractTerraformArgumentsFromRun(runContent),
          envVars: step.env ?? {},
          backend,
          actionRef: undefined,
          confidence,
          location: step.location,
        };
      }
    }

    return null;
  }

  /**
   * Infers Terraform command from action reference
   */
  private inferTerraformCommandFromAction(uses: string): TerraformCommand {
    const lowerUses = uses.toLowerCase();

    if (lowerUses.includes('setup-terraform')) return 'init';
    if (lowerUses.includes('terraform-plan') || lowerUses.includes('/plan')) return 'plan';
    if (lowerUses.includes('terraform-apply') || lowerUses.includes('/apply')) return 'apply';
    if (lowerUses.includes('terraform-destroy') || lowerUses.includes('/destroy')) return 'destroy';
    if (lowerUses.includes('terraform-fmt') || lowerUses.includes('/fmt')) return 'fmt';
    if (lowerUses.includes('terraform-validate') || lowerUses.includes('/validate')) return 'validate';
    if (lowerUses.includes('terraform-output') || lowerUses.includes('/output')) return 'output';

    return 'init'; // Default for setup actions
  }

  /**
   * Extracts a value from with inputs, checking multiple possible keys
   */
  private extractWithValue(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined,
    ...keys: string[]
  ): string | undefined {
    if (!withInputs) return undefined;

    for (const key of keys) {
      const value = withInputs[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }

    return undefined;
  }

  /**
   * Detects Terraform Cloud usage from action inputs
   */
  private detectTerraformCloud(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined
  ): boolean {
    if (!withInputs) return false;

    return Boolean(
      withInputs['cli_config_credentials_hostname'] ||
      withInputs['cli_config_credentials_token'] ||
      withInputs['terraform_cloud_token']
    );
  }

  /**
   * Extracts Terraform var files from action inputs
   */
  private extractTerraformVarFiles(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined
  ): readonly string[] {
    if (!withInputs) return [];

    const varFile = withInputs['var-file'] ?? withInputs['var_file'];
    if (typeof varFile === 'string') {
      return varFile.split(/[\s,]+/).filter(Boolean);
    }

    return [];
  }

  /**
   * Extracts Terraform variables from action inputs
   */
  private extractTerraformVariables(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined
  ): Readonly<Record<string, string>> | undefined {
    if (!withInputs) return undefined;

    const vars = withInputs['variables'] ?? withInputs['vars'];
    if (typeof vars === 'string') {
      // Parse HCL-style variable definitions
      const result: Record<string, string> = {};
      const matches = vars.matchAll(/(\w+)\s*=\s*"?([^"\n]+)"?/g);
      for (const match of matches) {
        result[match[1]] = match[2];
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }

    return undefined;
  }

  /**
   * Extracts Terraform arguments from action inputs
   */
  private extractTerraformArguments(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined
  ): readonly string[] | undefined {
    if (!withInputs) return undefined;

    const args = withInputs['args'] ?? withInputs['arguments'];
    if (typeof args === 'string') {
      return args.split(/\s+/).filter(Boolean);
    }

    return undefined;
  }

  /**
   * Extracts working directory from run command
   */
  private extractWorkingDirectoryFromRun(run: string): string | undefined {
    // Check for cd commands
    const cdMatch = run.match(/\bcd\s+([^\s;&|]+)/);
    if (cdMatch) {
      return cdMatch[1];
    }

    // Check for -chdir flag
    const chdirMatch = run.match(/-chdir=([^\s]+)/);
    if (chdirMatch) {
      return chdirMatch[1];
    }

    return undefined;
  }

  /**
   * Extracts Terraform workspace from run command
   */
  private extractTerraformWorkspaceFromRun(run: string): string | undefined {
    // terraform workspace select <name>
    const selectMatch = run.match(/terraform\s+workspace\s+(?:select|new)\s+([^\s;&|]+)/i);
    if (selectMatch) {
      return selectMatch[1];
    }

    // TF_WORKSPACE environment variable
    const envMatch = run.match(/TF_WORKSPACE=([^\s;&|]+)/);
    if (envMatch) {
      return envMatch[1];
    }

    return undefined;
  }

  /**
   * Extracts Terraform var files from run command
   */
  private extractTerraformVarFilesFromRun(run: string): readonly string[] {
    const varFiles: string[] = [];

    // -var-file=<file> or -var-file <file>
    const matches = run.matchAll(/-var-file[=\s]([^\s]+)/gi);
    for (const match of matches) {
      varFiles.push(match[1]);
    }

    return varFiles;
  }

  /**
   * Extracts Terraform -var values from run command
   */
  private extractTerraformVarsFromRun(run: string): Readonly<Record<string, string>> | undefined {
    const vars: Record<string, string> = {};

    // -var 'key=value' or -var="key=value"
    const matches = run.matchAll(/-var[=\s]['"]?(\w+)=([^'"]+)['"]?/gi);
    for (const match of matches) {
      vars[match[1]] = match[2];
    }

    return Object.keys(vars).length > 0 ? vars : undefined;
  }

  /**
   * Extracts Terraform backend configuration from run command
   */
  private extractTerraformBackendFromRun(run: string): TerraformBackendInfo | undefined {
    // -backend-config=<file> or -backend-config="key=value"
    const configs: Record<string, string> = {};

    const matches = run.matchAll(/-backend-config[=\s]["']?([^"'\s]+)["']?/gi);
    for (const match of matches) {
      const config = match[1];
      if (config.includes('=')) {
        const [key, value] = config.split('=', 2);
        configs[key] = value;
      } else {
        // It's a file reference
        configs['config_file'] = config;
      }
    }

    if (Object.keys(configs).length > 0) {
      return {
        type: 'configured',
        config: configs,
      };
    }

    return undefined;
  }

  /**
   * Detects Terraform Cloud usage from run command
   */
  private detectTerraformCloudFromRun(run: string): boolean {
    return (
      run.includes('TF_CLOUD_') ||
      run.includes('terraform cloud') ||
      run.includes('app.terraform.io') ||
      /terraform\s+login/i.test(run)
    );
  }

  /**
   * Extracts Terraform arguments from run command
   */
  private extractTerraformArgumentsFromRun(run: string): readonly string[] | undefined {
    // Extract the terraform command with all its arguments
    const match = run.match(/terraform\s+(\w+)\s+(.+?)(?:$|[;&|])/i);
    if (match && match[2]) {
      return match[2].split(/\s+/).filter(arg => arg && !arg.startsWith('#'));
    }

    return undefined;
  }

  /**
   * Calculates confidence score for Terraform detection
   */
  private calculateTerraformConfidence(run: string, command: TerraformCommand): number {
    let confidence = 85; // Base confidence for CLI detection

    // Increase confidence for explicit terraform binary
    if (/\bterraform\s+/i.test(run)) {
      confidence += 5;
    }

    // Increase for common flags
    if (/-auto-approve|-input=false|-no-color/.test(run)) {
      confidence += 3;
    }

    // Decrease for potential false positives
    if (run.includes('echo') || run.includes('grep')) {
      confidence -= 10;
    }

    return Math.max(50, Math.min(100, confidence));
  }

  // ============================================================================
  // Private - Helm Detection
  // ============================================================================

  /**
   * Detects Helm usage in a single step
   */
  private detectHelmInStep(
    step: GhaStep,
    index: number,
    jobId: string
  ): HelmStepInfo | null {
    // Check uses field for Helm actions
    if (isGhaUsesStep(step)) {
      return this.detectHelmAction(step, index, jobId);
    }

    // Check run field for helm commands
    if (isGhaRunStep(step)) {
      return this.detectHelmCommand(step, index, jobId);
    }

    return null;
  }

  /**
   * Detects Helm from action reference (uses:)
   */
  private detectHelmAction(
    step: GhaStep & { type: 'uses'; uses: string },
    index: number,
    jobId: string
  ): HelmStepInfo | null {
    const uses = step.uses;

    for (const actionPrefix of GhaToolDetector.HELM_ACTION_PREFIXES) {
      if (uses.startsWith(actionPrefix)) {
        // Determine command from action name
        const command = this.inferHelmCommandFromAction(uses);

        // Extract chart and release info from with inputs
        const chartPath = this.extractWithValue(step.with, 'chart-path', 'chart', 'chart-name');
        const chartRepository = this.extractWithValue(step.with, 'chart-repository', 'repository', 'repo');
        const releaseName = this.extractWithValue(step.with, 'release-name', 'release', 'name');
        const namespace = this.extractWithValue(step.with, 'namespace', 'ns');
        const valuesFiles = this.extractHelmValuesFiles(step.with);
        const setValues = this.extractHelmSetValues(step.with);

        return {
          stepIndex: index,
          stepId: step.id,
          jobId,
          command,
          chartPath,
          chart: chartPath,
          chartRepository,
          releaseName,
          namespace,
          valuesFiles,
          setValues,
          actionRef: uses,
          dryRun: this.extractBooleanValue(step.with, 'dry-run', 'dryRun'),
          atomic: this.extractBooleanValue(step.with, 'atomic'),
          wait: this.extractBooleanValue(step.with, 'wait'),
          confidence: 95,
          location: step.location,
        };
      }
    }

    return null;
  }

  /**
   * Detects Helm from shell command (run:)
   */
  private detectHelmCommand(
    step: GhaStep & { type: 'run'; run: string },
    index: number,
    jobId: string
  ): HelmStepInfo | null {
    const runContent = step.run;

    for (const { pattern, command } of GhaToolDetector.HELM_COMMANDS) {
      if (pattern.test(runContent)) {
        // Extract additional context from the command
        const chartPath = this.extractHelmChartPath(runContent);
        const releaseName = this.extractHelmReleaseName(runContent);
        const namespace = this.extractHelmNamespace(runContent);
        const valuesFiles = this.extractHelmValuesFilesFromRun(runContent);
        const setValues = this.extractHelmSetValuesFromRun(runContent);
        const chartRepository = this.extractHelmRepository(runContent);

        // Determine confidence based on detection specificity
        const confidence = this.calculateHelmConfidence(runContent, command);

        return {
          stepIndex: index,
          stepId: step.id,
          jobId,
          command,
          chartPath,
          chart: chartPath,
          chartRepository,
          releaseName,
          namespace,
          valuesFiles,
          setValues,
          actionRef: undefined,
          dryRun: this.detectHelmDryRun(runContent),
          atomic: /--atomic\b/.test(runContent),
          wait: /--wait\b/.test(runContent),
          confidence,
          location: step.location,
        };
      }
    }

    return null;
  }

  /**
   * Infers Helm command from action reference
   */
  private inferHelmCommandFromAction(uses: string): HelmCommand {
    const lowerUses = uses.toLowerCase();

    if (lowerUses.includes('setup-helm')) return 'upgrade'; // Setup typically precedes upgrade
    if (lowerUses.includes('helm-deploy') || lowerUses.includes('deploy')) return 'upgrade';
    if (lowerUses.includes('k8s-bake')) return 'template';

    return 'upgrade'; // Default for deployment actions
  }

  /**
   * Extracts Helm values files from action inputs
   */
  private extractHelmValuesFiles(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined
  ): readonly string[] {
    if (!withInputs) return [];

    const valuesFile = withInputs['values-files'] ?? withInputs['values'] ?? withInputs['value-files'];
    if (typeof valuesFile === 'string') {
      return valuesFile.split(/[\s,\n]+/).filter(Boolean);
    }

    return [];
  }

  /**
   * Extracts Helm set values from action inputs
   */
  private extractHelmSetValues(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined
  ): Readonly<Record<string, string>> {
    const result: Record<string, string> = {};

    if (!withInputs) return result;

    const setValues = withInputs['set'] ?? withInputs['set-values'];
    if (typeof setValues === 'string') {
      // Parse key=value pairs
      const matches = setValues.matchAll(/(\S+)=(\S+)/g);
      for (const match of matches) {
        result[match[1]] = match[2];
      }
    }

    return result;
  }

  /**
   * Extracts boolean value from action inputs
   */
  private extractBooleanValue(
    withInputs: Readonly<Record<string, string | number | boolean>> | undefined,
    ...keys: string[]
  ): boolean {
    if (!withInputs) return false;

    for (const key of keys) {
      const value = withInputs[key];
      if (value === true || value === 'true' || value === '1') {
        return true;
      }
    }

    return false;
  }

  /**
   * Extracts chart path from helm command
   * Handles: helm upgrade release ./charts/app
   *          helm install release oci://registry/chart
   *          helm template ./chart
   */
  private extractHelmChartPath(run: string): string | undefined {
    // helm upgrade/install <release> <chart>
    const upgradeMatch = run.match(/helm\s+(?:upgrade|install)\s+(?:--install\s+)?[\w-]+\s+([\w./:@-]+)/i);
    if (upgradeMatch) {
      const chart = upgradeMatch[1];
      // Skip if it looks like a flag
      if (!chart.startsWith('-')) {
        return chart;
      }
    }

    // helm template <chart>
    const templateMatch = run.match(/helm\s+template\s+(?:[\w-]+\s+)?([\w./:@-]+)/i);
    if (templateMatch) {
      const chart = templateMatch[1];
      if (!chart.startsWith('-')) {
        return chart;
      }
    }

    return undefined;
  }

  /**
   * Extracts release name from helm command
   */
  private extractHelmReleaseName(run: string): string | undefined {
    // helm upgrade/install <release> ...
    const match = run.match(/helm\s+(?:upgrade|install)\s+(?:--install\s+)?([\w-]+)/i);
    if (match) {
      const release = match[1];
      // Skip if it looks like a flag
      if (!release.startsWith('-')) {
        return release;
      }
    }

    // helm uninstall/rollback <release>
    const uninstallMatch = run.match(/helm\s+(?:uninstall|rollback)\s+([\w-]+)/i);
    if (uninstallMatch) {
      return uninstallMatch[1];
    }

    return undefined;
  }

  /**
   * Extracts namespace from helm command
   */
  private extractHelmNamespace(run: string): string | undefined {
    const match = run.match(/(?:-n|--namespace)\s+([\w-]+)/);
    return match?.[1];
  }

  /**
   * Extracts Helm values files from run command
   */
  private extractHelmValuesFilesFromRun(run: string): readonly string[] {
    const valuesFiles: string[] = [];

    // -f <file> or --values <file> or --values=<file>
    const matches = run.matchAll(/(?:-f|--values)[=\s]([^\s]+)/gi);
    for (const match of matches) {
      valuesFiles.push(match[1]);
    }

    return valuesFiles;
  }

  /**
   * Extracts Helm --set values from run command
   */
  private extractHelmSetValuesFromRun(run: string): Readonly<Record<string, string>> {
    const result: Record<string, string> = {};

    // --set key=value or --set-string key=value
    const matches = run.matchAll(/--set(?:-string)?[=\s]([^\s,]+)=([^\s,]+)/gi);
    for (const match of matches) {
      result[match[1]] = match[2];
    }

    return result;
  }

  /**
   * Extracts Helm repository from run command
   */
  private extractHelmRepository(run: string): string | undefined {
    // helm repo add <name> <url>
    const repoAddMatch = run.match(/helm\s+repo\s+add\s+[\w-]+\s+(https?:\/\/[^\s]+)/i);
    if (repoAddMatch) {
      return repoAddMatch[1];
    }

    // OCI registry reference
    if (run.includes('oci://')) {
      const ociMatch = run.match(/(oci:\/\/[^\s]+)/);
      if (ociMatch) {
        return ociMatch[1];
      }
    }

    return undefined;
  }

  /**
   * Detects dry-run flag in helm command
   */
  private detectHelmDryRun(run: string): boolean {
    return /--dry-run\b/.test(run);
  }

  /**
   * Calculates confidence score for Helm detection
   */
  private calculateHelmConfidence(run: string, command: HelmCommand): number {
    let confidence = 85; // Base confidence for CLI detection

    // Increase confidence for explicit helm binary
    if (/\bhelm\s+/i.test(run)) {
      confidence += 5;
    }

    // Increase for common flags that indicate real helm usage
    if (/--namespace|--release-name|-n\s/.test(run)) {
      confidence += 3;
    }

    // Increase for values files
    if (/-f\s|--values/.test(run)) {
      confidence += 2;
    }

    // Decrease for potential false positives
    if (run.includes('echo') || run.includes('grep') || run.includes('which helm')) {
      confidence -= 10;
    }

    return Math.max(50, Math.min(100, confidence));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new GhaToolDetector instance with the given options
 *
 * @param options - Detection options
 * @returns New GhaToolDetector instance
 */
export function createToolDetector(options?: ToolDetectorOptions): GhaToolDetector {
  return new GhaToolDetector(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a step contains any Terraform-related content
 * Quick check without full detection
 *
 * @param step - Step to check
 * @returns True if step may contain Terraform
 */
export function mightContainTerraform(step: GhaStep): boolean {
  if (isGhaUsesStep(step)) {
    const uses = step.uses.toLowerCase();
    return (
      uses.includes('terraform') ||
      uses.includes('terragrunt') ||
      uses.includes('hashicorp')
    );
  }

  if (isGhaRunStep(step)) {
    const run = step.run.toLowerCase();
    return (
      run.includes('terraform') ||
      run.includes('terragrunt') ||
      /\btf\s+(?:init|plan|apply|destroy)\b/.test(run)
    );
  }

  return false;
}

/**
 * Checks if a step contains any Helm-related content
 * Quick check without full detection
 *
 * @param step - Step to check
 * @returns True if step may contain Helm
 */
export function mightContainHelm(step: GhaStep): boolean {
  if (isGhaUsesStep(step)) {
    const uses = step.uses.toLowerCase();
    return (
      uses.includes('helm') ||
      uses.includes('k8s-bake') ||
      uses.includes('deliverybot')
    );
  }

  if (isGhaRunStep(step)) {
    const run = step.run.toLowerCase();
    return run.includes('helm') || run.includes('helmfile');
  }

  return false;
}
