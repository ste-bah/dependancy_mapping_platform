/**
 * Pattern Detectors for TF-Helm Cross-Reference Detection
 * @module parsers/crossref/pattern-detectors
 *
 * Implements the 4 primary pattern detectors for identifying Terraform-to-Helm
 * data flows in CI/CD workflows. Each detector implements the Strategy pattern
 * via IPatternDetector interface.
 *
 * TASK-XREF-003: TF-Helm Cross-Reference Detection - Pattern Detection
 *
 * Patterns detected:
 * 1. Direct --set: $(terraform output ...) inside helm --set values
 * 2. Env var intermediate: export VAR=$(terraform output ...) then ${VAR} in helm
 * 3. JSON file transform: terraform output -json > file then jq ... file in helm -f
 * 4. Artifact passing: Job dependencies with artifact passing between TF and Helm jobs
 */

import { SourceLocation } from '../terraform/types';
import {
  TerraformToHelmFlow,
  TfHelmFlowPattern,
  TfHelmDetectionContext,
  TerraformOutputInfo,
  HelmValueSource,
  FlowEvidence,
  FlowEvidenceType,
  WorkflowFlowContext,
  TerraformOutputName,
  HelmValuePath,
  TerraformOutputCommand,
  HelmValueCommand,
  HelmValueSourceType,
  TerraformStepContext,
  HelmStepContext,
  createTfHelmFlowId,
  createTerraformOutputName,
  createHelmValuePath,
  getConfidenceLevel,
  PATTERN_BASE_SCORES,
} from './types';
import { IPatternDetector } from './interfaces';

// ============================================================================
// Regex Patterns for Detection
// ============================================================================

/**
 * Patterns for detecting Terraform output command substitutions
 */
const TF_OUTPUT_PATTERNS = {
  /** Direct command substitution: $(terraform output [-raw] name) */
  CMD_SUBST: /\$\(\s*terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g,

  /** Backtick command substitution: `terraform output [-raw] name` */
  BACKTICK_SUBST: /`terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)`/g,

  /** JSON output to file: terraform output -json > file */
  JSON_TO_FILE: /terraform\s+output\s+-json\s*(?:>\s*|>>?\s*)(\S+)/g,

  /** Raw output to file: terraform output -raw name > file */
  RAW_TO_FILE: /terraform\s+output\s+-raw\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:>\s*|>>?\s*)(\S+)/g,

  /** General terraform output with name capture */
  OUTPUT_NAME: /terraform\s+output\s+(?:-(?:raw|json)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi,
} as const;

/**
 * Patterns for detecting environment variable assignments from Terraform
 */
const ENV_VAR_PATTERNS = {
  /** export VAR=$(terraform output ...) */
  EXPORT_TF: /export\s+([a-zA-Z_][a-zA-Z0-9_]*)=\$\(\s*terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g,

  /** VAR=$(terraform output ...) without export */
  ASSIGN_TF: /([a-zA-Z_][a-zA-Z0-9_]*)=\$\(\s*terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g,

  /** GHA env file: echo "VAR=value" >> $GITHUB_ENV */
  GHA_ENV: /echo\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)=([^"'\n]+)["']?\s*>>\s*\$GITHUB_ENV/g,

  /** GHA output: echo "name=value" >> $GITHUB_OUTPUT */
  GHA_OUTPUT: /echo\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)=([^"'\n]+)["']?\s*>>\s*\$GITHUB_OUTPUT/g,
} as const;

/**
 * Patterns for detecting Helm value consumption
 */
const HELM_VALUE_PATTERNS = {
  /** --set with env var: --set key=${VAR} or --set key=$VAR */
  SET_ENVVAR: /--set(?:-string)?\s+([^=\s]+)=\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?/g,

  /** --set with command substitution */
  SET_CMD_SUBST: /--set(?:-string)?\s+([^=\s]+)=\$\([^)]+\)/g,

  /** --set with GHA expression: --set key=${{ ... }} */
  SET_GHA_EXPR: /--set(?:-string)?\s+([^=\s]+)=\$\{\{[^}]+\}\}/g,

  /** -f with process substitution: -f <(jq ... file) */
  VALUES_PROCESS_SUBST: /-f\s+<\(\s*(jq|yq)\s+['"]([^'"]+)['"]\s+(\S+)\s*\)/g,

  /** -f with values file */
  VALUES_FILE: /(?:-f\s+|--values[=\s]+)([^\s]+)/g,
} as const;

/**
 * Patterns for detecting CI/CD artifact operations
 */
const ARTIFACT_PATTERNS = {
  /** GHA upload-artifact action */
  GHA_UPLOAD: /uses:\s*actions\/upload-artifact/,

  /** GHA download-artifact action */
  GHA_DOWNLOAD: /uses:\s*actions\/download-artifact/,

  /** Artifact name in with block */
  ARTIFACT_NAME: /name:\s*["']?([^"'\n]+)["']?/,

  /** Artifact path in with block */
  ARTIFACT_PATH: /path:\s*["']?([^"'\n]+)["']?/,

  /** GitLab CI artifacts */
  GITLAB_ARTIFACTS: /artifacts:\s*\n/,

  /** GitLab CI dependencies */
  GITLAB_DEPENDENCIES: /dependencies:\s*\[/,
} as const;

// ============================================================================
// Base Pattern Detector Abstract Class
// ============================================================================

/**
 * Abstract base class providing common functionality for pattern detectors.
 * Implements shared methods for flow creation, evidence collection, and context building.
 */
abstract class BasePatternDetector implements IPatternDetector {
  abstract readonly pattern: TfHelmFlowPattern;
  abstract readonly description: string;

  get baseConfidence(): number {
    return PATTERN_BASE_SCORES[this.pattern] ?? 50;
  }

  /**
   * Abstract method to be implemented by concrete detectors
   */
  abstract detect(context: TfHelmDetectionContext): TerraformToHelmFlow[];

  /**
   * Check if this detector is applicable to the given context
   */
  isApplicable(context: TfHelmDetectionContext): boolean {
    return context.terraformSteps.length > 0 && context.helmSteps.length > 0;
  }

  /**
   * Get detector priority (higher runs first)
   */
  getPriority(): number {
    // Direct patterns have highest priority
    switch (this.pattern) {
      case 'direct_output':
        return 100;
      case 'output_to_env':
        return 90;
      case 'output_to_file':
        return 80;
      case 'artifact_transfer':
        return 70;
      default:
        return 50;
    }
  }

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  /**
   * Create a Terraform output info structure
   */
  protected createTerraformOutputInfo(
    name: string,
    jobId: string,
    stepIndex: number,
    stepId: string | undefined,
    command: TerraformOutputCommand,
    workingDir: string | undefined,
    location: SourceLocation
  ): TerraformOutputInfo {
    return {
      name: createTerraformOutputName(name),
      jobId,
      stepId,
      stepIndex,
      command,
      workingDir,
      sensitive: false,
      location,
    };
  }

  /**
   * Create a Helm value source structure
   */
  protected createHelmValueSource(
    path: string,
    jobId: string,
    stepIndex: number,
    stepId: string | undefined,
    command: HelmValueCommand,
    sourceType: HelmValueSourceType,
    location: SourceLocation
  ): HelmValueSource {
    return {
      path: createHelmValuePath(path),
      jobId,
      stepId,
      stepIndex,
      command,
      sourceType,
      location,
    };
  }

  /**
   * Create a flow evidence item
   */
  protected createEvidence(
    type: FlowEvidenceType,
    description: string,
    strength: number,
    location?: SourceLocation,
    snippet?: string
  ): FlowEvidence {
    return {
      type,
      description,
      strength: Math.max(0, Math.min(100, strength)),
      location,
      snippet,
    };
  }

  /**
   * Create workflow flow context
   */
  protected createWorkflowContext(
    context: TfHelmDetectionContext,
    sourceJobId: string,
    targetJobId: string
  ): WorkflowFlowContext {
    const jobChain = this.buildJobChain(
      sourceJobId,
      targetJobId,
      context.jobDependencies
    );

    return {
      workflowFile: context.workflowFile,
      workflowName: this.extractWorkflowName(context.workflow),
      jobChain,
      sameWorkflow: true,
      triggerType: this.extractTriggerType(context.workflow),
    };
  }

  /**
   * Create a complete TerraformToHelmFlow
   */
  protected createFlow(
    source: TerraformOutputInfo,
    target: HelmValueSource,
    evidence: readonly FlowEvidence[],
    workflowContext: WorkflowFlowContext
  ): TerraformToHelmFlow {
    const confidence = this.calculateConfidence(evidence);
    const confidenceLevel = getConfidenceLevel(confidence);

    return {
      id: createTfHelmFlowId(source.jobId, target.jobId, source.name as string),
      source,
      target,
      pattern: this.pattern,
      confidence,
      confidenceLevel,
      evidence,
      workflowContext,
    };
  }

  /**
   * Calculate confidence score from evidence
   */
  protected calculateConfidence(evidence: readonly FlowEvidence[]): number {
    if (evidence.length === 0) {
      return Math.round(this.baseConfidence * 0.6);
    }

    const avgStrength =
      evidence.reduce((sum, e) => sum + e.strength, 0) / evidence.length;
    const evidenceBonus = avgStrength * 0.3;
    const countBonus = Math.min(evidence.length * 2, 10);

    return Math.min(100, Math.round(this.baseConfidence + evidenceBonus + countBonus));
  }

  /**
   * Create a default source location
   */
  protected createDefaultLocation(file?: string): SourceLocation {
    return {
      file: file || '',
      lineStart: 0,
      lineEnd: 0,
      columnStart: 0,
      columnEnd: 0,
    };
  }

  /**
   * Build job chain from source to target using dependencies
   */
  protected buildJobChain(
    sourceJobId: string,
    targetJobId: string,
    dependencies: ReadonlyMap<string, readonly string[]>
  ): readonly string[] {
    // Simple BFS to find path from source to target
    const visited = new Set<string>();
    const queue: Array<{ job: string; path: string[] }> = [
      { job: sourceJobId, path: [sourceJobId] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.job === targetJobId) {
        return current.path;
      }

      if (visited.has(current.job)) continue;
      visited.add(current.job);

      // Find jobs that depend on current job
      for (const [jobId, deps] of Array.from(dependencies)) {
        if (deps.includes(current.job) && !visited.has(jobId)) {
          queue.push({ job: jobId, path: [...current.path, jobId] });
        }
      }
    }

    // No direct path found, return simple chain
    return sourceJobId === targetJobId
      ? [sourceJobId]
      : [sourceJobId, targetJobId];
  }

  /**
   * Extract workflow name from parsed workflow
   */
  protected extractWorkflowName(workflow: unknown): string {
    const wf = workflow as Record<string, unknown>;
    return (wf?.name as string) || 'unnamed-workflow';
  }

  /**
   * Extract trigger type from workflow
   */
  protected extractTriggerType(workflow: unknown): string | undefined {
    const wf = workflow as Record<string, unknown>;
    const on = wf?.on;
    if (typeof on === 'string') return on;
    if (on && typeof on === 'object') {
      return Object.keys(on)[0];
    }
    return undefined;
  }

  /**
   * Check if target job depends on source job
   */
  protected jobDependsOn(
    sourceJobId: string,
    targetJobId: string,
    dependencies: ReadonlyMap<string, readonly string[]>
  ): boolean {
    const targetDeps = dependencies.get(targetJobId);
    if (!targetDeps) return false;

    // Direct dependency
    if (targetDeps.includes(sourceJobId)) return true;

    // Transitive dependency (one level deep)
    for (const dep of targetDeps) {
      const depDeps = dependencies.get(dep);
      if (depDeps?.includes(sourceJobId)) return true;
    }

    return false;
  }

  /**
   * Determine Helm command from step info
   */
  protected getHelmCommand(command: string): HelmValueCommand {
    if (command.includes('upgrade')) return 'upgrade';
    if (command.includes('install')) return 'install';
    if (command.includes('template')) return 'template';
    if (command.includes('lint')) return 'lint';
    return 'upgrade';
  }
}

// ============================================================================
// Pattern 1: Direct --set Pattern Detector
// ============================================================================

/**
 * Detects direct Terraform output usage in Helm --set flags.
 * Pattern: helm upgrade --set vpc.id=$(terraform output -raw vpc_id)
 *
 * This is the highest confidence pattern as it shows direct data flow
 * within the same step or sequential steps in the same job.
 *
 * @implements {IPatternDetector}
 *
 * @example
 * ```yaml
 * - name: Deploy
 *   run: |
 *     helm upgrade app ./chart \
 *       --set cluster.endpoint=$(terraform output -raw cluster_endpoint)
 * ```
 */
export class DirectSetPatternDetector extends BasePatternDetector {
  readonly pattern: TfHelmFlowPattern = 'direct_output';
  readonly description =
    'Detects direct $(terraform output ...) usage in helm --set flags';

  detect(context: TfHelmDetectionContext): TerraformToHelmFlow[] {
    const flows: TerraformToHelmFlow[] = [];

    for (const helmStep of context.helmSteps) {
      const detectedFlows = this.detectInHelmStep(helmStep, context);
      flows.push(...detectedFlows);
    }

    return flows;
  }

  /**
   * Detect direct TF output references in a single Helm step
   */
  private detectInHelmStep(
    helmStep: {
      readonly jobId: string;
      readonly stepIndex: number;
      readonly stepId?: string;
      readonly command: string;
      readonly setValues: ReadonlyMap<string, string>;
    },
    context: TfHelmDetectionContext
  ): TerraformToHelmFlow[] {
    const flows: TerraformToHelmFlow[] = [];
    const command = helmStep.command;

    // Check each --set value for TF command substitution
    for (const [valuePath, valueExpr] of Array.from(helmStep.setValues)) {
      const tfOutputMatches = this.extractTfOutputFromExpression(valueExpr);

      for (const tfOutput of tfOutputMatches) {
        // Find the source TF step (same job or dependent job)
        const tfSource = this.findTerraformSource(
          tfOutput.outputName,
          helmStep.jobId,
          context
        );

        if (!tfSource) continue;

        const evidence = this.collectEvidence(
          tfOutput,
          valuePath,
          valueExpr,
          tfSource,
          helmStep,
          context
        );

        const source = this.createTerraformOutputInfo(
          tfOutput.outputName,
          tfSource.jobId,
          tfSource.stepIndex,
          tfSource.stepId,
          'output',
          tfSource.workingDir,
          this.createDefaultLocation(context.workflowFile)
        );

        const target = this.createHelmValueSource(
          valuePath,
          helmStep.jobId,
          helmStep.stepIndex,
          helmStep.stepId,
          this.getHelmCommand(command),
          'set_flag',
          this.createDefaultLocation(context.workflowFile)
        );

        const workflowContext = this.createWorkflowContext(
          context,
          tfSource.jobId,
          helmStep.jobId
        );

        flows.push(this.createFlow(source, target, evidence, workflowContext));
      }
    }

    // Also check command string directly for inline substitutions
    const inlineMatches = this.extractInlineTfOutputs(command);
    for (const match of inlineMatches) {
      // Skip if already detected via setValues
      const alreadyFound = flows.some(
        (f) =>
          (f.source.name as string) === match.outputName &&
          (f.target.path as string) === match.valuePath
      );
      if (alreadyFound) continue;

      const tfSource = this.findTerraformSource(
        match.outputName,
        helmStep.jobId,
        context
      );

      if (!tfSource) continue;

      const evidence = this.collectInlineEvidence(
        match,
        tfSource,
        helmStep,
        context
      );

      const source = this.createTerraformOutputInfo(
        match.outputName,
        tfSource.jobId,
        tfSource.stepIndex,
        tfSource.stepId,
        'output',
        tfSource.workingDir,
        this.createDefaultLocation(context.workflowFile)
      );

      const target = this.createHelmValueSource(
        match.valuePath,
        helmStep.jobId,
        helmStep.stepIndex,
        helmStep.stepId,
        this.getHelmCommand(command),
        'set_flag',
        this.createDefaultLocation(context.workflowFile)
      );

      const workflowContext = this.createWorkflowContext(
        context,
        tfSource.jobId,
        helmStep.jobId
      );

      flows.push(this.createFlow(source, target, evidence, workflowContext));
    }

    return flows;
  }

  /**
   * Extract TF output references from a value expression
   */
  private extractTfOutputFromExpression(
    expr: string
  ): Array<{ outputName: string; raw: boolean; fullMatch: string }> {
    const results: Array<{ outputName: string; raw: boolean; fullMatch: string }> = [];

    // Check command substitution: $(terraform output ...)
    const cmdSubstRegex =
      /\$\(\s*terraform\s+output\s+(?:(-raw)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g;
    let match: RegExpExecArray | null;

    while ((match = cmdSubstRegex.exec(expr)) !== null) {
      results.push({
        outputName: match[2],
        raw: !!match[1],
        fullMatch: match[0],
      });
    }

    // Check backtick substitution: `terraform output ...`
    const backtickRegex =
      /`terraform\s+output\s+(?:(-raw)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)`/g;
    while ((match = backtickRegex.exec(expr)) !== null) {
      results.push({
        outputName: match[2],
        raw: !!match[1],
        fullMatch: match[0],
      });
    }

    return results;
  }

  /**
   * Extract inline TF output references from full Helm command
   */
  private extractInlineTfOutputs(
    command: string
  ): Array<{ outputName: string; valuePath: string; fullMatch: string }> {
    const results: Array<{
      outputName: string;
      valuePath: string;
      fullMatch: string;
    }> = [];

    // Pattern: --set key=$(terraform output [-raw] name)
    const setRegex =
      /--set(?:-string)?\s+([^=\s]+)=\$\(\s*terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g;
    let match: RegExpExecArray | null;

    while ((match = setRegex.exec(command)) !== null) {
      results.push({
        valuePath: match[1],
        outputName: match[2],
        fullMatch: match[0],
      });
    }

    return results;
  }

  /**
   * Find the Terraform step that produces a given output
   */
  private findTerraformSource(
    outputName: string,
    helmJobId: string,
    context: TfHelmDetectionContext
  ): TerraformStepContext | null {
    // First check same job
    for (const tfStep of context.terraformSteps) {
      if (tfStep.jobId === helmJobId) {
        if (
          tfStep.outputs.includes(outputName) ||
          tfStep.command.includes(outputName)
        ) {
          return tfStep;
        }
      }
    }

    // Check dependent jobs
    for (const tfStep of context.terraformSteps) {
      if (this.jobDependsOn(tfStep.jobId, helmJobId, context.jobDependencies)) {
        if (
          tfStep.outputs.includes(outputName) ||
          tfStep.command.includes(outputName)
        ) {
          return tfStep;
        }
      }
    }

    // Fallback: return first TF step with matching output
    for (const tfStep of context.terraformSteps) {
      if (
        tfStep.outputs.includes(outputName) ||
        tfStep.command.includes(outputName)
      ) {
        return tfStep;
      }
    }

    return null;
  }

  /**
   * Collect evidence for a detected direct flow
   */
  private collectEvidence(
    tfOutput: { outputName: string; raw: boolean; fullMatch: string },
    valuePath: string,
    valueExpr: string,
    tfSource: TerraformStepContext,
    helmStep: { jobId: string; stepIndex: number; command: string },
    context: TfHelmDetectionContext
  ): FlowEvidence[] {
    const evidence: FlowEvidence[] = [];

    // Primary evidence: explicit command substitution
    evidence.push(
      this.createEvidence(
        'explicit_reference',
        `Direct terraform output command substitution: ${tfOutput.fullMatch}`,
        95,
        this.createDefaultLocation(context.workflowFile),
        tfOutput.fullMatch
      )
    );

    // Expression match evidence
    evidence.push(
      this.createEvidence(
        'expression_match',
        `Helm --set ${valuePath} receives Terraform output ${tfOutput.outputName}`,
        90,
        this.createDefaultLocation(context.workflowFile),
        `--set ${valuePath}=${valueExpr}`
      )
    );

    // Job dependency evidence if applicable
    if (tfSource.jobId !== helmStep.jobId) {
      if (this.jobDependsOn(tfSource.jobId, helmStep.jobId, context.jobDependencies)) {
        evidence.push(
          this.createEvidence(
            'job_dependency',
            `Helm job depends on Terraform job: ${tfSource.jobId} -> ${helmStep.jobId}`,
            85,
            undefined,
            `needs: [${tfSource.jobId}]`
          )
        );
      }
    } else {
      // Same job - step proximity evidence
      const stepDistance = Math.abs(helmStep.stepIndex - tfSource.stepIndex);
      const proximityStrength = Math.max(50, 90 - stepDistance * 10);
      evidence.push(
        this.createEvidence(
          'step_proximity',
          `Terraform and Helm steps in same job, ${stepDistance} step(s) apart`,
          proximityStrength
        )
      );
    }

    return evidence;
  }

  /**
   * Collect evidence for inline detected flows
   */
  private collectInlineEvidence(
    match: { outputName: string; valuePath: string; fullMatch: string },
    tfSource: TerraformStepContext,
    helmStep: { jobId: string; stepIndex: number },
    context: TfHelmDetectionContext
  ): FlowEvidence[] {
    const evidence: FlowEvidence[] = [];

    evidence.push(
      this.createEvidence(
        'explicit_reference',
        `Inline terraform output substitution detected`,
        95,
        this.createDefaultLocation(context.workflowFile),
        match.fullMatch
      )
    );

    evidence.push(
      this.createEvidence(
        'expression_match',
        `Helm value ${match.valuePath} set from terraform output ${match.outputName}`,
        90
      )
    );

    return evidence;
  }
}

// ============================================================================
// Pattern 2: Environment Variable Intermediate Detector
// ============================================================================

/**
 * Detects Terraform output to Helm flow via environment variables.
 * Pattern: export VPC_ID=$(terraform output -raw vpc_id) then helm --set vpc.id=${VPC_ID}
 *
 * This pattern has medium-high confidence as it requires tracing the
 * variable through the environment.
 *
 * @implements {IPatternDetector}
 *
 * @example
 * ```yaml
 * - name: Get TF outputs
 *   run: |
 *     export CLUSTER_ENDPOINT=$(terraform output -raw cluster_endpoint)
 *     echo "CLUSTER_ENDPOINT=$CLUSTER_ENDPOINT" >> $GITHUB_ENV
 *
 * - name: Deploy
 *   run: helm upgrade app ./chart --set cluster.endpoint=${CLUSTER_ENDPOINT}
 * ```
 */
export class EnvVarPatternDetector extends BasePatternDetector {
  readonly pattern: TfHelmFlowPattern = 'output_to_env';
  readonly description =
    'Detects Terraform outputs passed to Helm via environment variables';

  detect(context: TfHelmDetectionContext): TerraformToHelmFlow[] {
    const flows: TerraformToHelmFlow[] = [];

    // Build map of env vars set from TF outputs
    const tfEnvVars = this.buildTfEnvVarMap(context);

    // Check Helm steps for env var usage
    for (const helmStep of context.helmSteps) {
      const detectedFlows = this.detectEnvVarFlows(
        helmStep,
        tfEnvVars,
        context
      );
      flows.push(...detectedFlows);
    }

    return flows;
  }

  /**
   * Build a map of environment variables set from Terraform outputs
   */
  private buildTfEnvVarMap(
    context: TfHelmDetectionContext
  ): Map<string, { tfOutput: string; tfStep: TerraformStepContext }> {
    const envVars = new Map<
      string,
      { tfOutput: string; tfStep: TerraformStepContext }
    >();

    for (const tfStep of context.terraformSteps) {
      const command = tfStep.command;

      // Find export VAR=$(terraform output ...) patterns
      const exportMatches = command.matchAll(ENV_VAR_PATTERNS.EXPORT_TF);
      for (const match of Array.from(exportMatches)) {
        const [, varName, outputName] = match;
        envVars.set(varName, { tfOutput: outputName, tfStep });
      }

      // Find VAR=$(terraform output ...) patterns
      const assignMatches = command.matchAll(ENV_VAR_PATTERNS.ASSIGN_TF);
      for (const match of Array.from(assignMatches)) {
        const [, varName, outputName] = match;
        envVars.set(varName, { tfOutput: outputName, tfStep });
      }

      // Check for GHA env file writes
      const ghaEnvMatches = command.matchAll(ENV_VAR_PATTERNS.GHA_ENV);
      for (const match of Array.from(ghaEnvMatches)) {
        const [, varName, value] = match;
        // Check if value contains TF output reference
        const tfMatch = value.match(
          /\$\(\s*terraform\s+output\s+(?:-raw\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/
        );
        if (tfMatch) {
          envVars.set(varName, { tfOutput: tfMatch[1], tfStep });
        } else if (
          tfStep.outputs.some((o) => value.includes(o) || value.includes(`$${o}`))
        ) {
          // Variable might be set to a shell var from TF output
          const possibleOutput = tfStep.outputs.find(
            (o) => value.includes(o) || value.includes(`$${o}`)
          );
          if (possibleOutput) {
            envVars.set(varName, { tfOutput: possibleOutput, tfStep });
          }
        }
      }

      // Check step-level env vars
      if (tfStep.envVars) {
        for (const [envName, envValue] of Object.entries(tfStep.envVars)) {
          const tfMatch = envValue.match(
            /\$\(\s*terraform\s+output|needs\.[^.]+\.outputs\./
          );
          if (tfMatch && tfStep.outputs.length > 0) {
            // Associate with first TF output
            envVars.set(envName, { tfOutput: tfStep.outputs[0], tfStep });
          }
        }
      }
    }

    return envVars;
  }

  /**
   * Detect environment variable flows in a Helm step
   */
  private detectEnvVarFlows(
    helmStep: {
      readonly jobId: string;
      readonly stepIndex: number;
      readonly stepId?: string;
      readonly command: string;
      readonly setValues: ReadonlyMap<string, string>;
    },
    tfEnvVars: Map<string, { tfOutput: string; tfStep: TerraformStepContext }>,
    context: TfHelmDetectionContext
  ): TerraformToHelmFlow[] {
    const flows: TerraformToHelmFlow[] = [];
    const command = helmStep.command;

    // Check --set values for env var references
    for (const [valuePath, valueExpr] of Array.from(helmStep.setValues)) {
      const envVarRefs = this.extractEnvVarRefs(valueExpr);

      for (const envVar of envVarRefs) {
        const tfSource = tfEnvVars.get(envVar);
        if (!tfSource) continue;

        const evidence = this.collectEnvEvidence(
          envVar,
          tfSource,
          valuePath,
          valueExpr,
          helmStep,
          context
        );

        const source = this.createTerraformOutputInfo(
          tfSource.tfOutput,
          tfSource.tfStep.jobId,
          tfSource.tfStep.stepIndex,
          tfSource.tfStep.stepId,
          'output',
          tfSource.tfStep.workingDir,
          this.createDefaultLocation(context.workflowFile)
        );

        const target = this.createHelmValueSource(
          valuePath,
          helmStep.jobId,
          helmStep.stepIndex,
          helmStep.stepId,
          this.getHelmCommand(command),
          'env_substitution',
          this.createDefaultLocation(context.workflowFile)
        );

        const workflowContext = this.createWorkflowContext(
          context,
          tfSource.tfStep.jobId,
          helmStep.jobId
        );

        flows.push(this.createFlow(source, target, evidence, workflowContext));
      }
    }

    // Also check command string directly
    const commandEnvRefs = this.extractEnvVarRefs(command);
    for (const envVar of commandEnvRefs) {
      const tfSource = tfEnvVars.get(envVar);
      if (!tfSource) continue;

      // Extract value path from command if possible
      const setMatch = command.match(
        new RegExp(`--set(?:-string)?\\s+([^=\\s]+)=.*\\$\\{?${envVar}\\}?`)
      );
      if (!setMatch) continue;

      const valuePath = setMatch[1];

      // Skip if already found via setValues
      const alreadyFound = flows.some(
        (f) =>
          (f.source.name as string) === tfSource.tfOutput &&
          (f.target.path as string) === valuePath
      );
      if (alreadyFound) continue;

      const evidence = this.collectEnvEvidence(
        envVar,
        tfSource,
        valuePath,
        `$${envVar}`,
        helmStep,
        context
      );

      const source = this.createTerraformOutputInfo(
        tfSource.tfOutput,
        tfSource.tfStep.jobId,
        tfSource.tfStep.stepIndex,
        tfSource.tfStep.stepId,
        'output',
        tfSource.tfStep.workingDir,
        this.createDefaultLocation(context.workflowFile)
      );

      const target = this.createHelmValueSource(
        valuePath,
        helmStep.jobId,
        helmStep.stepIndex,
        helmStep.stepId,
        this.getHelmCommand(command),
        'env_substitution',
        this.createDefaultLocation(context.workflowFile)
      );

      const workflowContext = this.createWorkflowContext(
        context,
        tfSource.tfStep.jobId,
        helmStep.jobId
      );

      flows.push(this.createFlow(source, target, evidence, workflowContext));
    }

    return flows;
  }

  /**
   * Extract environment variable references from an expression
   */
  private extractEnvVarRefs(expr: string): string[] {
    const refs: string[] = [];
    const seen = new Set<string>();

    // $VAR or ${VAR} patterns
    const varRegex = /\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?/g;
    let match: RegExpExecArray | null;

    while ((match = varRegex.exec(expr)) !== null) {
      const varName = match[1];
      // Exclude common non-TF vars
      if (
        !seen.has(varName) &&
        !['GITHUB', 'HOME', 'PATH', 'PWD', 'USER'].some((p) =>
          varName.startsWith(p)
        )
      ) {
        refs.push(varName);
        seen.add(varName);
      }
    }

    // GHA expression: ${{ env.VAR }}
    const ghaEnvRegex = /\$\{\{\s*env\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    while ((match = ghaEnvRegex.exec(expr)) !== null) {
      const varName = match[1];
      if (!seen.has(varName)) {
        refs.push(varName);
        seen.add(varName);
      }
    }

    return refs;
  }

  /**
   * Collect evidence for an environment variable flow
   */
  private collectEnvEvidence(
    envVar: string,
    tfSource: { tfOutput: string; tfStep: TerraformStepContext },
    valuePath: string,
    valueExpr: string,
    helmStep: { jobId: string; stepIndex: number },
    context: TfHelmDetectionContext
  ): FlowEvidence[] {
    const evidence: FlowEvidence[] = [];

    evidence.push(
      this.createEvidence(
        'env_variable',
        `Environment variable ${envVar} propagates Terraform output ${tfSource.tfOutput}`,
        80,
        this.createDefaultLocation(context.workflowFile),
        `export ${envVar}=$(terraform output -raw ${tfSource.tfOutput})`
      )
    );

    evidence.push(
      this.createEvidence(
        'expression_match',
        `Helm --set ${valuePath} uses environment variable ${envVar}`,
        75,
        undefined,
        `--set ${valuePath}=${valueExpr}`
      )
    );

    // Job dependency if cross-job
    if (tfSource.tfStep.jobId !== helmStep.jobId) {
      if (
        this.jobDependsOn(
          tfSource.tfStep.jobId,
          helmStep.jobId,
          context.jobDependencies
        )
      ) {
        evidence.push(
          this.createEvidence(
            'job_dependency',
            `Environment propagation across dependent jobs`,
            70,
            undefined,
            `${tfSource.tfStep.jobId} -> ${helmStep.jobId}`
          )
        );
      }
    }

    return evidence;
  }
}

// ============================================================================
// Pattern 3: JSON File Transformation Detector
// ============================================================================

/**
 * Detects Terraform JSON output transformed and consumed by Helm.
 * Pattern: terraform output -json > outputs.json, then helm -f <(jq '...' outputs.json)
 *
 * This pattern has medium confidence as it involves file-based data transfer
 * and potential transformations.
 *
 * @implements {IPatternDetector}
 *
 * @example
 * ```yaml
 * - name: Export TF outputs
 *   run: terraform output -json > tf-outputs.json
 *
 * - name: Deploy
 *   run: |
 *     helm upgrade app ./chart \
 *       -f <(jq '{cluster: {endpoint: .cluster_endpoint.value}}' tf-outputs.json)
 * ```
 */
export class JsonFilePatternDetector extends BasePatternDetector {
  readonly pattern: TfHelmFlowPattern = 'output_to_file';
  readonly description =
    'Detects Terraform JSON outputs transformed via jq/yq for Helm values';

  detect(context: TfHelmDetectionContext): TerraformToHelmFlow[] {
    const flows: TerraformToHelmFlow[] = [];

    // Find TF JSON output files
    const jsonOutputs = this.findTfJsonOutputFiles(context);

    // Check Helm steps for jq/yq consumption of these files
    for (const helmStep of context.helmSteps) {
      const detectedFlows = this.detectJsonFlows(
        helmStep,
        jsonOutputs,
        context
      );
      flows.push(...detectedFlows);
    }

    return flows;
  }

  /**
   * Find Terraform steps that write JSON output to files
   */
  private findTfJsonOutputFiles(
    context: TfHelmDetectionContext
  ): Array<{ filePath: string; tfStep: TerraformStepContext }> {
    const jsonOutputs: Array<{ filePath: string; tfStep: TerraformStepContext }> =
      [];

    for (const tfStep of context.terraformSteps) {
      const command = tfStep.command;

      // terraform output -json > file
      const jsonToFileRegex =
        /terraform\s+output\s+-json\s*(?:>\s*|>>?\s*)([^\s|;]+)/g;
      let match: RegExpExecArray | null;

      while ((match = jsonToFileRegex.exec(command)) !== null) {
        jsonOutputs.push({ filePath: match[1], tfStep });
      }

      // Also check for tee or pipe to file patterns
      const teeRegex =
        /terraform\s+output\s+-json\s*\|\s*tee\s+([^\s|;]+)/g;
      while ((match = teeRegex.exec(command)) !== null) {
        jsonOutputs.push({ filePath: match[1], tfStep });
      }
    }

    return jsonOutputs;
  }

  /**
   * Detect JSON file transformation flows in a Helm step
   */
  private detectJsonFlows(
    helmStep: {
      readonly jobId: string;
      readonly stepIndex: number;
      readonly stepId?: string;
      readonly command: string;
      readonly valuesFiles: readonly string[];
    },
    jsonOutputs: Array<{ filePath: string; tfStep: TerraformStepContext }>,
    context: TfHelmDetectionContext
  ): TerraformToHelmFlow[] {
    const flows: TerraformToHelmFlow[] = [];
    const command = helmStep.command;

    // Check for process substitution: -f <(jq ... file)
    const processSubstRegex =
      /-f\s+<\(\s*(jq|yq)\s+['"]([^'"]*)['"]\s+([^\s)]+)\s*\)/g;
    let match: RegExpExecArray | null;

    while ((match = processSubstRegex.exec(command)) !== null) {
      const [fullMatch, tool, transform, filePath] = match;

      // Check if this file is a TF JSON output
      const jsonSource = jsonOutputs.find(
        (jo) =>
          jo.filePath === filePath ||
          filePath.endsWith(jo.filePath) ||
          jo.filePath.endsWith(filePath)
      );

      if (!jsonSource) continue;

      const evidence = this.collectJsonEvidence(
        jsonSource,
        tool,
        transform,
        filePath,
        fullMatch,
        helmStep,
        context
      );

      // For JSON pattern, output name is generic since whole JSON is consumed
      const source = this.createTerraformOutputInfo(
        'json_outputs',
        jsonSource.tfStep.jobId,
        jsonSource.tfStep.stepIndex,
        jsonSource.tfStep.stepId,
        'output',
        jsonSource.tfStep.workingDir,
        this.createDefaultLocation(context.workflowFile)
      );

      const target = this.createHelmValueSource(
        this.extractValuesPathFromJq(transform),
        helmStep.jobId,
        helmStep.stepIndex,
        helmStep.stepId,
        this.getHelmCommand(command),
        'values_file',
        this.createDefaultLocation(context.workflowFile)
      );

      const workflowContext = this.createWorkflowContext(
        context,
        jsonSource.tfStep.jobId,
        helmStep.jobId
      );

      flows.push(this.createFlow(source, target, evidence, workflowContext));
    }

    // Check for values files that might be generated from TF outputs
    for (const valuesFile of helmStep.valuesFiles) {
      const jsonSource = jsonOutputs.find(
        (jo) =>
          valuesFile.includes(jo.filePath) ||
          jo.filePath.includes(valuesFile) ||
          this.filesRelated(valuesFile, jo.filePath)
      );

      if (!jsonSource) continue;

      const evidence: FlowEvidence[] = [
        this.createEvidence(
          'file_path_match',
          `Values file ${valuesFile} potentially derived from TF output ${jsonSource.filePath}`,
          60,
          this.createDefaultLocation(context.workflowFile),
          `-f ${valuesFile}`
        ),
      ];

      const source = this.createTerraformOutputInfo(
        'json_outputs',
        jsonSource.tfStep.jobId,
        jsonSource.tfStep.stepIndex,
        jsonSource.tfStep.stepId,
        'output',
        jsonSource.tfStep.workingDir,
        this.createDefaultLocation(context.workflowFile)
      );

      const target = this.createHelmValueSource(
        valuesFile,
        helmStep.jobId,
        helmStep.stepIndex,
        helmStep.stepId,
        this.getHelmCommand(command),
        'values_file',
        this.createDefaultLocation(context.workflowFile)
      );

      const workflowContext = this.createWorkflowContext(
        context,
        jsonSource.tfStep.jobId,
        helmStep.jobId
      );

      flows.push(this.createFlow(source, target, evidence, workflowContext));
    }

    return flows;
  }

  /**
   * Collect evidence for a JSON file transformation flow
   */
  private collectJsonEvidence(
    jsonSource: { filePath: string; tfStep: TerraformStepContext },
    tool: string,
    transform: string,
    filePath: string,
    fullMatch: string,
    helmStep: { jobId: string; stepIndex: number },
    context: TfHelmDetectionContext
  ): FlowEvidence[] {
    const evidence: FlowEvidence[] = [];

    evidence.push(
      this.createEvidence(
        'file_path_match',
        `Helm consumes TF JSON output file: ${filePath}`,
        85,
        this.createDefaultLocation(context.workflowFile),
        `terraform output -json > ${jsonSource.filePath}`
      )
    );

    evidence.push(
      this.createEvidence(
        'expression_match',
        `${tool} transformation extracts values from TF JSON`,
        80,
        undefined,
        fullMatch
      )
    );

    if (jsonSource.tfStep.jobId !== helmStep.jobId) {
      if (
        this.jobDependsOn(
          jsonSource.tfStep.jobId,
          helmStep.jobId,
          context.jobDependencies
        )
      ) {
        evidence.push(
          this.createEvidence(
            'job_dependency',
            `Cross-job JSON file transfer from ${jsonSource.tfStep.jobId} to ${helmStep.jobId}`,
            75
          )
        );
      }
    }

    return evidence;
  }

  /**
   * Extract a values path from a jq transformation expression
   */
  private extractValuesPathFromJq(transform: string): string {
    // Try to extract the first key from jq expression like '{cluster: ...}'
    const keyMatch = transform.match(/\{([a-zA-Z_][a-zA-Z0-9_]*):/);
    if (keyMatch) {
      return keyMatch[1];
    }

    // Try to extract from .key pattern
    const dotMatch = transform.match(/\.([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (dotMatch) {
      return dotMatch[1];
    }

    return 'values';
  }

  /**
   * Check if two file paths are likely related
   */
  private filesRelated(file1: string, file2: string): boolean {
    // Remove path components and extensions
    const base1 = file1.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
    const base2 = file2.replace(/^.*\//, '').replace(/\.[^.]+$/, '');

    // Check for common patterns
    return (
      base1.includes(base2) ||
      base2.includes(base1) ||
      (base1.includes('terraform') && base2.includes('values')) ||
      (base1.includes('tf') && base2.includes('helm')) ||
      (base1.includes('output') && base2.includes('values'))
    );
  }
}

// ============================================================================
// Pattern 4: Artifact Passing Detector
// ============================================================================

/**
 * Detects Terraform-to-Helm flow via CI/CD artifact passing.
 * Pattern: Job 1 artifacts terraform outputs, Job 2 downloads and uses for Helm.
 *
 * This pattern has medium confidence as it requires cross-job analysis
 * and artifact correlation.
 *
 * @implements {IPatternDetector}
 *
 * @example
 * ```yaml
 * terraform-job:
 *   steps:
 *     - run: terraform output -json > tf-outputs.json
 *     - uses: actions/upload-artifact@v3
 *       with:
 *         name: terraform-outputs
 *         path: tf-outputs.json
 *
 * deploy-job:
 *   needs: terraform-job
 *   steps:
 *     - uses: actions/download-artifact@v3
 *       with:
 *         name: terraform-outputs
 *     - run: helm upgrade app ./chart -f tf-outputs.json
 * ```
 */
export class ArtifactPatternDetector extends BasePatternDetector {
  readonly pattern: TfHelmFlowPattern = 'artifact_transfer';
  readonly description =
    'Detects Terraform outputs passed to Helm via CI/CD artifact upload/download';

  detect(context: TfHelmDetectionContext): TerraformToHelmFlow[] {
    const flows: TerraformToHelmFlow[] = [];

    // Find artifact uploads from TF jobs
    const uploadedArtifacts = this.findArtifactUploads(context);

    // Find artifact downloads in Helm jobs
    for (const helmStep of context.helmSteps) {
      const downloads = this.findArtifactDownloads(helmStep.jobId, context);

      for (const download of downloads) {
        // Match downloads to uploads
        const matchingUpload = uploadedArtifacts.find(
          (u) =>
            u.artifactName === download.artifactName ||
            this.artifactNamesRelated(u.artifactName, download.artifactName)
        );

        if (!matchingUpload) continue;

        // Check if Helm step uses files from this artifact
        const usesArtifact = this.helmUsesArtifact(
          helmStep,
          matchingUpload,
          download
        );

        if (!usesArtifact) continue;

        const evidence = this.collectArtifactEvidence(
          matchingUpload,
          download,
          helmStep,
          context
        );

        const outputName = matchingUpload.containsTfOutput
          ? matchingUpload.tfOutputName || 'outputs'
          : 'artifact_data';

        const source = this.createTerraformOutputInfo(
          outputName,
          matchingUpload.tfStep.jobId,
          matchingUpload.tfStep.stepIndex,
          matchingUpload.tfStep.stepId,
          'output',
          matchingUpload.tfStep.workingDir,
          this.createDefaultLocation(context.workflowFile)
        );

        const target = this.createHelmValueSource(
          download.path || 'values',
          helmStep.jobId,
          helmStep.stepIndex,
          helmStep.stepId,
          this.getHelmCommand(helmStep.command),
          'values_file',
          this.createDefaultLocation(context.workflowFile)
        );

        const workflowContext = this.createWorkflowContext(
          context,
          matchingUpload.tfStep.jobId,
          helmStep.jobId
        );

        flows.push(this.createFlow(source, target, evidence, workflowContext));
      }
    }

    return flows;
  }

  /**
   * Find artifact uploads in Terraform jobs
   */
  private findArtifactUploads(
    context: TfHelmDetectionContext
  ): Array<{
    artifactName: string;
    path: string;
    tfStep: TerraformStepContext;
    containsTfOutput: boolean;
    tfOutputName?: string;
  }> {
    const uploads: Array<{
      artifactName: string;
      path: string;
      tfStep: TerraformStepContext;
      containsTfOutput: boolean;
      tfOutputName?: string;
    }> = [];

    for (const [jobId, job] of Array.from(context.jobs)) {
      const tfStepsInJob = context.terraformSteps.filter(
        (s) => s.jobId === jobId
      );
      if (tfStepsInJob.length === 0) continue;

      const jobObj = job as Record<string, unknown>;
      const steps = jobObj?.steps as readonly Record<string, unknown>[];
      if (!steps) continue;

      for (const step of steps) {
        const uses = step?.uses as string;
        if (!uses?.includes('upload-artifact')) continue;

        const withBlock = step?.with as Record<string, string>;
        if (!withBlock) continue;

        const artifactName = withBlock.name || 'artifact';
        const artifactPath = withBlock.path || '';

        // Check if artifact contains TF output files
        const containsTfOutput = this.artifactContainsTfOutput(
          artifactPath,
          tfStepsInJob
        );

        const tfStep = tfStepsInJob[0]; // Associate with first TF step

        uploads.push({
          artifactName,
          path: artifactPath,
          tfStep,
          containsTfOutput,
          tfOutputName: containsTfOutput
            ? this.extractTfOutputNameFromPath(artifactPath)
            : undefined,
        });
      }
    }

    return uploads;
  }

  /**
   * Find artifact downloads in a job
   */
  private findArtifactDownloads(
    jobId: string,
    context: TfHelmDetectionContext
  ): Array<{ artifactName: string; path?: string }> {
    const downloads: Array<{ artifactName: string; path?: string }> = [];

    const job = context.jobs.get(jobId);
    if (!job) return downloads;

    const jobObj = job as Record<string, unknown>;
    const steps = jobObj?.steps as readonly Record<string, unknown>[];
    if (!steps) return downloads;

    for (const step of steps) {
      const uses = step?.uses as string;
      if (!uses?.includes('download-artifact')) continue;

      const withBlock = step?.with as Record<string, string>;
      if (!withBlock) continue;

      downloads.push({
        artifactName: withBlock.name || 'artifact',
        path: withBlock.path,
      });
    }

    return downloads;
  }

  /**
   * Check if Helm step uses files from an artifact
   */
  private helmUsesArtifact(
    helmStep: {
      readonly command: string;
      readonly valuesFiles: readonly string[];
    },
    upload: { path: string },
    download: { path?: string }
  ): boolean {
    const artifactFile = download.path || upload.path;

    // Check if Helm command references the artifact file
    if (helmStep.command.includes(artifactFile)) {
      return true;
    }

    // Check values files
    for (const vf of helmStep.valuesFiles) {
      if (vf === artifactFile || vf.endsWith(artifactFile) || artifactFile.endsWith(vf)) {
        return true;
      }
    }

    // Check for common TF output file patterns in Helm command
    const tfFilePatterns = [
      'tf-output',
      'terraform-output',
      'outputs.json',
      '.tfoutput',
    ];
    return tfFilePatterns.some(
      (p) => helmStep.command.includes(p) && upload.path.includes(p)
    );
  }

  /**
   * Check if artifact path contains Terraform output files
   */
  private artifactContainsTfOutput(
    path: string,
    tfSteps: readonly TerraformStepContext[]
  ): boolean {
    // Check path patterns
    const tfOutputPatterns = [
      /terraform.*output/i,
      /tf.*output/i,
      /\.tfoutput/i,
      /outputs?\.json/i,
    ];

    if (tfOutputPatterns.some((p) => p.test(path))) {
      return true;
    }

    // Check if any TF step outputs to this path
    for (const tfStep of tfSteps) {
      if (
        tfStep.command.includes(path) ||
        tfStep.command.includes(`> ${path}`)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract Terraform output name from file path
   */
  private extractTfOutputNameFromPath(path: string): string {
    // Try to extract meaningful name from path
    const basename = path.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
    return basename || 'outputs';
  }

  /**
   * Check if two artifact names are related
   */
  private artifactNamesRelated(name1: string, name2: string): boolean {
    const n1 = name1.toLowerCase();
    const n2 = name2.toLowerCase();

    return (
      n1 === n2 ||
      n1.includes(n2) ||
      n2.includes(n1) ||
      (n1.includes('terraform') && n2.includes('terraform')) ||
      (n1.includes('tf') && n2.includes('tf')) ||
      (n1.includes('output') && n2.includes('output'))
    );
  }

  /**
   * Collect evidence for an artifact passing flow
   */
  private collectArtifactEvidence(
    upload: {
      artifactName: string;
      path: string;
      tfStep: TerraformStepContext;
      containsTfOutput: boolean;
    },
    download: { artifactName: string; path?: string },
    helmStep: { jobId: string; stepIndex: number },
    context: TfHelmDetectionContext
  ): FlowEvidence[] {
    const evidence: FlowEvidence[] = [];

    evidence.push(
      this.createEvidence(
        'artifact_path',
        `Artifact "${upload.artifactName}" uploaded with TF outputs`,
        75,
        this.createDefaultLocation(context.workflowFile),
        `upload-artifact: ${upload.artifactName}, path: ${upload.path}`
      )
    );

    evidence.push(
      this.createEvidence(
        'artifact_path',
        `Artifact "${download.artifactName}" downloaded for Helm deployment`,
        75,
        undefined,
        `download-artifact: ${download.artifactName}`
      )
    );

    // Job dependency evidence
    if (
      this.jobDependsOn(
        upload.tfStep.jobId,
        helmStep.jobId,
        context.jobDependencies
      )
    ) {
      evidence.push(
        this.createEvidence(
          'job_dependency',
          `Helm job explicitly depends on TF job via needs:`,
          85,
          undefined,
          `${upload.tfStep.jobId} -> ${helmStep.jobId}`
        )
      );
    }

    if (upload.containsTfOutput) {
      evidence.push(
        this.createEvidence(
          'explicit_reference',
          `Artifact contains Terraform output data`,
          80,
          undefined,
          `terraform output -json > ${upload.path}`
        )
      );
    }

    return evidence;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an array of all pattern detectors.
 * Returns detectors in priority order (highest priority first).
 *
 * @returns Frozen array of all IPatternDetector implementations
 *
 * @example
 * ```typescript
 * const detectors = createPatternDetectors();
 * for (const detector of detectors) {
 *   if (detector.isApplicable(context)) {
 *     const flows = detector.detect(context);
 *     allFlows.push(...flows);
 *   }
 * }
 * ```
 */
export function createPatternDetectors(): readonly IPatternDetector[] {
  const detectors: IPatternDetector[] = [
    new DirectSetPatternDetector(),
    new EnvVarPatternDetector(),
    new JsonFilePatternDetector(),
    new ArtifactPatternDetector(),
  ];

  // Sort by priority (descending)
  detectors.sort((a, b) => b.getPriority() - a.getPriority());

  return Object.freeze(detectors);
}

/**
 * Get a specific pattern detector by pattern type
 *
 * @param pattern - The pattern type to get detector for
 * @returns The pattern detector or undefined if not found
 */
export function getPatternDetector(
  pattern: TfHelmFlowPattern
): IPatternDetector | undefined {
  const detectors = createPatternDetectors();
  return detectors.find((d) => d.pattern === pattern);
}

// ============================================================================
// Exported Pattern Constants (for testing and extension)
// ============================================================================

export {
  TF_OUTPUT_PATTERNS,
  ENV_VAR_PATTERNS,
  HELM_VALUE_PATTERNS,
  ARTIFACT_PATTERNS,
};
