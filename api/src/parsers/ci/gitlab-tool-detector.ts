/**
 * GitLab Tool Detector
 * @module parsers/ci/gitlab-tool-detector
 *
 * Advanced detection of IaC tool usage in GitLab CI jobs including
 * Terraform, Terragrunt, OpenTofu, Helm, and Helmfile operations.
 *
 * TASK-XREF-002: GitLab CI Parser - Tool detection
 * TASK-GITLAB-003: Terraform/Helm step detection
 */

import {
  GitLabJob,
  GitLabImage,
  TerraformCommand,
  HelmCommand,
  GitLabTerraformDetectionInfo,
  GitLabHelmDetectionInfo,
} from './types';

// ============================================================================
// Detection Pattern Constants
// ============================================================================

/**
 * Terraform command patterns for detection
 */
export const TERRAFORM_PATTERNS: readonly RegExp[] = [
  /\bterraform\s+(init|plan|apply|destroy|validate|fmt|output|import|state|workspace|refresh|taint|untaint|force-unlock|providers|graph|show|console|login|logout|version)/i,
  /\bterragrunt\s+(init|plan|apply|destroy|validate|run-all|output|state|render-json|hclfmt|terragrunt-info|output-module-groups|graph-dependencies|scaffold|catalog)/i,
  /\btofu\s+(init|plan|apply|destroy|validate|fmt|output|import|state|workspace|refresh)/i,
  /\bgitlab-terraform\s+(init|plan|apply|destroy|validate)/i,
];

/**
 * Terraform image patterns for detection
 */
export const TERRAFORM_IMAGES: readonly RegExp[] = [
  /^hashicorp\/terraform/i,
  /\/terraform:/i,
  /\/terragrunt:/i,
  /\/tofu:/i,
  /\/opentofu:/i,
  /registry\.gitlab\.com\/gitlab-org\/terraform-images/i,
  /hashicorp\/terraform-github-actions/i,
  /ghcr\.io\/opentofu\/opentofu/i,
  /alpine\/terragrunt/i,
];

/**
 * Helm command patterns for detection
 */
export const HELM_PATTERNS: readonly RegExp[] = [
  /\bhelm\s+(install|upgrade|uninstall|rollback|template|lint|package|push|pull|repo|dependency|test|show|get|status|history|list|search|verify|create|env)/i,
  /\bhelmfile\s+(apply|sync|diff|template|lint|repos|deps|write-values|build|destroy|status|test|fetch)/i,
  /\bhelm\s+(upgrade\s+--install|install\s+--replace)/i,
];

/**
 * Helm image patterns for detection
 */
export const HELM_IMAGES: readonly RegExp[] = [
  /^alpine\/helm/i,
  /\/helm:/i,
  /dtzar\/helm-kubectl/i,
  /lachlanevenson\/k8s-helm/i,
  /alpine\/k8s/i,
  /ghcr\.io\/helm\/chart-testing/i,
  /helmfile\/helmfile/i,
  /chatwork\/helmfile/i,
];

/**
 * Terraform Cloud/Enterprise indicators
 */
export const TF_CLOUD_INDICATORS: readonly RegExp[] = [
  /TF_CLOUD_ORGANIZATION/i,
  /TF_CLOUD_HOSTNAME/i,
  /TFE_TOKEN/i,
  /TFC_RUN_ID/i,
  /terraform\s+login/i,
  /remote\s*\{/i,
  /cloud\s*\{/i,
];

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Detected command from script parsing
 */
export interface DetectedCommand {
  /** The tool being used (terraform, helm, etc.) */
  readonly tool: 'terraform' | 'terragrunt' | 'tofu' | 'helm' | 'helmfile';
  /** The command/subcommand being executed */
  readonly command: string;
  /** Original line where command was found */
  readonly line: string;
  /** Line number in script (1-based) */
  readonly lineNumber: number;
  /** Parsed arguments */
  readonly args: CommandArgs;
}

/**
 * Parsed command arguments
 */
export interface CommandArgs {
  /** Positional arguments */
  readonly positional: readonly string[];
  /** Flag arguments (e.g., -auto-approve) */
  readonly flags: readonly string[];
  /** Key-value arguments (e.g., -var=value) */
  readonly options: Readonly<Record<string, string>>;
}

/**
 * Command match for confidence calculation
 */
export interface CommandMatch {
  /** Pattern that matched */
  readonly pattern: RegExp;
  /** Matched text */
  readonly match: string;
  /** Command type */
  readonly command: string;
  /** Line number */
  readonly lineNumber: number;
}

/**
 * Evidence for tool detection
 */
export interface DetectionEvidence {
  /** Evidence type */
  readonly type: 'command' | 'image' | 'artifact' | 'variable' | 'template' | 'extends';
  /** Description of evidence */
  readonly description: string;
  /** Confidence score contribution */
  readonly score: number;
  /** Source (line number, variable name, etc.) */
  readonly source?: string;
}

/**
 * Terraform-specific parsed arguments
 */
export interface TerraformArgs {
  /** -var-file arguments */
  readonly varFiles: readonly string[];
  /** -var arguments */
  readonly vars: Readonly<Record<string, string>>;
  /** -backend-config arguments */
  readonly backendConfigs: readonly string[];
  /** -target arguments */
  readonly targets: readonly string[];
  /** -state argument */
  readonly stateFile?: string;
  /** -out argument (for plan) */
  readonly planOutput?: string;
  /** Working directory (-chdir) */
  readonly workingDir?: string;
  /** Flags like -auto-approve, -lock, etc. */
  readonly flags: readonly string[];
}

/**
 * Helm-specific parsed arguments
 */
export interface HelmArgs {
  /** Release name */
  readonly releaseName?: string;
  /** Chart reference */
  readonly chartRef?: string;
  /** Namespace */
  readonly namespace?: string;
  /** -f / --values files */
  readonly valuesFiles: readonly string[];
  /** --set values */
  readonly setValues: Readonly<Record<string, string>>;
  /** --set-string values */
  readonly setStringValues: Readonly<Record<string, string>>;
  /** Version constraint */
  readonly version?: string;
  /** Repository URL */
  readonly repo?: string;
  /** Flags like --atomic, --wait, --dry-run */
  readonly flags: readonly string[];
}

/**
 * Terraform detection result for a job
 */
export interface TerraformJobInfo {
  /** Primary command detected */
  readonly command: TerraformCommand;
  /** All commands detected in the job */
  readonly allCommands: readonly TerraformCommand[];
  /** Working directory */
  readonly workingDirectory?: string;
  /** Var files used */
  readonly varFiles: readonly string[];
  /** Backend type if detected */
  readonly backend?: string;
  /** Uses Terraform Cloud/Enterprise */
  readonly usesCloud: boolean;
  /** Uses Terragrunt */
  readonly usesTerragrunt: boolean;
  /** Uses OpenTofu instead of Terraform */
  readonly usesTofu: boolean;
  /** Detection confidence (0-100) */
  readonly confidence: number;
  /** Evidence for detection */
  readonly evidence: readonly DetectionEvidence[];
  /** Parsed arguments from commands */
  readonly args: TerraformArgs;
}

/**
 * Helm detection result for a job
 */
export interface HelmJobInfo {
  /** Primary command detected */
  readonly command: HelmCommand;
  /** All commands detected in the job */
  readonly allCommands: readonly HelmCommand[];
  /** Release name if detected */
  readonly releaseName?: string;
  /** Chart path/reference */
  readonly chartPath?: string;
  /** Target namespace */
  readonly namespace?: string;
  /** Values files */
  readonly valuesFiles: readonly string[];
  /** Is dry-run */
  readonly dryRun: boolean;
  /** Is atomic */
  readonly atomic: boolean;
  /** Uses helmfile */
  readonly usesHelmfile: boolean;
  /** Detection confidence (0-100) */
  readonly confidence: number;
  /** Evidence for detection */
  readonly evidence: readonly DetectionEvidence[];
  /** Parsed arguments from commands */
  readonly args: HelmArgs;
}

/**
 * Complete tool detection result for a job
 */
export interface ToolDetectionResult {
  /** Terraform detection info (if detected) */
  readonly terraform?: TerraformJobInfo;
  /** Helm detection info (if detected) */
  readonly helm?: HelmJobInfo;
  /** Overall confidence score */
  readonly confidence: number;
  /** All evidence collected */
  readonly evidence: readonly DetectionEvidence[];
  /** Whether any tools were detected */
  readonly hasTools: boolean;
}

// ============================================================================
// GitLab Tool Detector Class
// ============================================================================

/**
 * Detects IaC tool usage in GitLab CI jobs.
 *
 * Analyzes job scripts, images, artifacts, and variables to detect
 * Terraform, Terragrunt, OpenTofu, Helm, and Helmfile operations.
 *
 * @example
 * ```typescript
 * const detector = new GitLabToolDetector();
 * const result = detector.detectInJob(job);
 * if (result.terraform) {
 *   console.log(`Terraform ${result.terraform.command} detected`);
 * }
 * ```
 */
export class GitLabToolDetector {
  // ============================================================================
  // Main Detection Methods
  // ============================================================================

  /**
   * Detect all tools in a GitLab CI job
   *
   * @param job - GitLab CI job to analyze
   * @returns Complete tool detection result
   */
  detectInJob(job: GitLabJob): ToolDetectionResult {
    const scripts = this.getAllScripts(job);
    const image = this.getImageName(job.image);
    const evidence: DetectionEvidence[] = [];

    // Detect Terraform
    const terraform = this.detectTerraform(scripts, image, job, evidence);

    // Detect Helm
    const helm = this.detectHelm(scripts, image, job, evidence);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(terraform, helm);

    return {
      terraform,
      helm,
      confidence,
      evidence,
      hasTools: terraform !== null || helm !== null,
    };
  }

  /**
   * Detect Terraform/Terragrunt/OpenTofu in job scripts
   *
   * @param scripts - Array of script lines
   * @param image - Docker image name (optional)
   * @param job - Full job object for additional context
   * @param evidence - Evidence array to append to
   * @returns Terraform job info or null
   */
  detectTerraform(
    scripts: readonly string[],
    image?: string,
    job?: GitLabJob,
    evidence: DetectionEvidence[] = []
  ): TerraformJobInfo | null {
    const matches: CommandMatch[] = [];
    const allCommands: TerraformCommand[] = [];
    let usesTerragrunt = false;
    let usesTofu = false;

    // Check each script line
    for (let i = 0; i < scripts.length; i++) {
      const line = scripts[i];
      const lineNumber = i + 1;

      for (const pattern of TERRAFORM_PATTERNS) {
        const match = pattern.exec(line);
        if (match) {
          const command = this.parseTerraformCommand(match[1]);
          allCommands.push(command);
          matches.push({
            pattern,
            match: match[0],
            command: match[1],
            lineNumber,
          });

          // Track tool variant
          if (line.toLowerCase().includes('terragrunt')) {
            usesTerragrunt = true;
          }
          if (line.toLowerCase().includes('tofu')) {
            usesTofu = true;
          }

          evidence.push({
            type: 'command',
            description: `Terraform command: ${match[0]}`,
            score: 40,
            source: `line ${lineNumber}`,
          });
        }
      }
    }

    if (matches.length === 0 && !this.hasTerraformImage(image)) {
      // Check for extends that might indicate Terraform
      if (job?.extends && this.hasTerraformExtends(job.extends)) {
        evidence.push({
          type: 'extends',
          description: 'Job extends Terraform template',
          score: 30,
        });

        return {
          command: 'unknown',
          allCommands: [],
          varFiles: [],
          usesCloud: false,
          usesTerragrunt: false,
          usesTofu: false,
          confidence: 30,
          evidence,
          args: this.createEmptyTerraformArgs(),
        };
      }
      return null;
    }

    // Check image
    const imageMatch = this.hasTerraformImage(image);
    if (imageMatch) {
      evidence.push({
        type: 'image',
        description: `Terraform image: ${image}`,
        score: 30,
        source: image,
      });
      if (image?.toLowerCase().includes('terragrunt')) {
        usesTerragrunt = true;
      }
      if (image?.toLowerCase().includes('tofu') || image?.toLowerCase().includes('opentofu')) {
        usesTofu = true;
      }
    }

    // Check artifact reports
    if (job?.artifacts?.reports?.terraform) {
      evidence.push({
        type: 'artifact',
        description: 'Terraform plan artifact report configured',
        score: 20,
      });
    }

    // Check environment variables
    const tfVars = this.findTerraformVariables(job?.variables);
    if (tfVars.length > 0) {
      evidence.push({
        type: 'variable',
        description: `Terraform variables: ${tfVars.slice(0, 3).join(', ')}${tfVars.length > 3 ? '...' : ''}`,
        score: 10,
        source: tfVars.join(', '),
      });
    }

    // Check for Terraform Cloud
    const usesCloud = this.detectsTerraformCloud(scripts, job);
    if (usesCloud) {
      evidence.push({
        type: 'variable',
        description: 'Terraform Cloud/Enterprise integration detected',
        score: 15,
      });
    }

    // Parse arguments from script
    const scriptContent = scripts.join('\n');
    const args = this.extractTerraformArgs(scriptContent);

    // Determine primary command (prefer destructive/state-changing commands)
    const primaryCommand = this.determinePrimaryTerraformCommand(allCommands);

    // Calculate confidence
    const confidence = this.calculateConfidence(matches, imageMatch, evidence);

    return {
      command: primaryCommand,
      allCommands: [...new Set(allCommands)],
      workingDirectory: args.workingDir,
      varFiles: args.varFiles,
      backend: this.detectBackendType(scriptContent),
      usesCloud,
      usesTerragrunt,
      usesTofu,
      confidence,
      evidence,
      args,
    };
  }

  /**
   * Detect Helm/Helmfile in job scripts
   *
   * @param scripts - Array of script lines
   * @param image - Docker image name (optional)
   * @param job - Full job object for additional context
   * @param evidence - Evidence array to append to
   * @returns Helm job info or null
   */
  detectHelm(
    scripts: readonly string[],
    image?: string,
    job?: GitLabJob,
    evidence: DetectionEvidence[] = []
  ): HelmJobInfo | null {
    const matches: CommandMatch[] = [];
    const allCommands: HelmCommand[] = [];
    let usesHelmfile = false;

    // Check each script line
    for (let i = 0; i < scripts.length; i++) {
      const line = scripts[i];
      const lineNumber = i + 1;

      for (const pattern of HELM_PATTERNS) {
        const match = pattern.exec(line);
        if (match) {
          const command = this.parseHelmCommand(match[1]);
          allCommands.push(command);
          matches.push({
            pattern,
            match: match[0],
            command: match[1],
            lineNumber,
          });

          if (line.toLowerCase().includes('helmfile')) {
            usesHelmfile = true;
          }

          evidence.push({
            type: 'command',
            description: `Helm command: ${match[0]}`,
            score: 40,
            source: `line ${lineNumber}`,
          });
        }
      }
    }

    if (matches.length === 0 && !this.hasHelmImage(image)) {
      return null;
    }

    // Check image
    const imageMatch = this.hasHelmImage(image);
    if (imageMatch) {
      evidence.push({
        type: 'image',
        description: `Helm image: ${image}`,
        score: 30,
        source: image,
      });
      if (image?.toLowerCase().includes('helmfile')) {
        usesHelmfile = true;
      }
    }

    // Check environment variables
    const helmVars = this.findHelmVariables(job?.variables);
    if (helmVars.length > 0) {
      evidence.push({
        type: 'variable',
        description: `Helm variables: ${helmVars.slice(0, 3).join(', ')}${helmVars.length > 3 ? '...' : ''}`,
        score: 10,
        source: helmVars.join(', '),
      });
    }

    // Parse arguments from script
    const scriptContent = scripts.join('\n');
    const args = this.extractHelmArgs(scriptContent);

    // Determine primary command
    const primaryCommand = this.determinePrimaryHelmCommand(allCommands);

    // Calculate confidence
    const confidence = this.calculateConfidence(matches, imageMatch, evidence);

    return {
      command: primaryCommand,
      allCommands: [...new Set(allCommands)],
      releaseName: args.releaseName,
      chartPath: args.chartRef,
      namespace: args.namespace,
      valuesFiles: args.valuesFiles,
      dryRun: args.flags.includes('--dry-run'),
      atomic: args.flags.includes('--atomic'),
      usesHelmfile,
      confidence,
      evidence,
      args,
    };
  }

  // ============================================================================
  // Script Line Parsing
  // ============================================================================

  /**
   * Parse a single script line for tool commands
   *
   * @param line - Script line to parse
   * @returns Detected command or null
   */
  parseScriptLine(line: string): DetectedCommand | null {
    // Trim and skip empty/comment lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return null;
    }

    // Check Terraform patterns
    for (const pattern of TERRAFORM_PATTERNS) {
      const match = pattern.exec(trimmed);
      if (match) {
        const tool = this.detectTerraformVariant(trimmed);
        return {
          tool,
          command: match[1],
          line: trimmed,
          lineNumber: 0, // Caller should set this
          args: this.parseCommandArgs(trimmed, tool),
        };
      }
    }

    // Check Helm patterns
    for (const pattern of HELM_PATTERNS) {
      const match = pattern.exec(trimmed);
      if (match) {
        const tool = trimmed.toLowerCase().includes('helmfile') ? 'helmfile' : 'helm';
        return {
          tool,
          command: match[1],
          line: trimmed,
          lineNumber: 0,
          args: this.parseCommandArgs(trimmed, tool),
        };
      }
    }

    return null;
  }

  /**
   * Parse command arguments from a line
   *
   * @param line - Command line
   * @param tool - Tool type
   * @returns Parsed arguments
   */
  private parseCommandArgs(line: string, tool: string): CommandArgs {
    const positional: string[] = [];
    const flags: string[] = [];
    const options: Record<string, string> = {};

    // Split by whitespace, respecting quotes
    const parts = this.splitCommandLine(line);

    // Skip the command itself (terraform, helm, etc.)
    let skipNext = false;
    for (let i = 1; i < parts.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }

      const part = parts[i];

      // Flag with value (--flag=value or -f=value)
      if (part.includes('=')) {
        const [key, ...valueParts] = part.split('=');
        options[key] = valueParts.join('=');
        continue;
      }

      // Flag with separate value (--flag value)
      if (part.startsWith('-')) {
        // Check if next part is the value
        const nextPart = parts[i + 1];
        if (nextPart && !nextPart.startsWith('-')) {
          options[part] = nextPart;
          skipNext = true;
        } else {
          flags.push(part);
        }
        continue;
      }

      // Positional argument
      positional.push(part);
    }

    return { positional, flags, options };
  }

  /**
   * Split command line respecting quotes
   */
  private splitCommandLine(line: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const char of line) {
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  // ============================================================================
  // Argument Extraction
  // ============================================================================

  /**
   * Extract Terraform-specific arguments from script content
   *
   * @param content - Full script content
   * @returns Terraform arguments
   */
  extractTerraformArgs(content: string): TerraformArgs {
    const varFiles: string[] = [];
    const vars: Record<string, string> = {};
    const backendConfigs: string[] = [];
    const targets: string[] = [];
    const flags: string[] = [];

    // -var-file patterns
    const varFilePattern = /-var-file[=\s]+["']?([^\s"']+)["']?/g;
    let match: RegExpExecArray | null;
    while ((match = varFilePattern.exec(content)) !== null) {
      varFiles.push(match[1]);
    }

    // -var patterns
    const varPattern = /-var\s+["']?([^=]+)=([^\s"']+)["']?/g;
    while ((match = varPattern.exec(content)) !== null) {
      vars[match[1]] = match[2];
    }

    // -backend-config patterns
    const backendPattern = /-backend-config[=\s]+["']?([^\s"']+)["']?/g;
    while ((match = backendPattern.exec(content)) !== null) {
      backendConfigs.push(match[1]);
    }

    // -target patterns
    const targetPattern = /-target[=\s]+["']?([^\s"']+)["']?/g;
    while ((match = targetPattern.exec(content)) !== null) {
      targets.push(match[1]);
    }

    // -state pattern
    const stateMatch = /-state[=\s]+["']?([^\s"']+)["']?/.exec(content);
    const stateFile = stateMatch?.[1];

    // -out pattern (for plan)
    const outMatch = /-out[=\s]+["']?([^\s"']+)["']?/.exec(content);
    const planOutput = outMatch?.[1];

    // -chdir pattern
    const chdirMatch = /-chdir[=\s]+["']?([^\s"']+)["']?/.exec(content);
    const workingDir = chdirMatch?.[1] ?? this.extractWorkingDirectory(content);

    // Common flags
    const flagPatterns = [
      '-auto-approve',
      '-lock=false',
      '-lock=true',
      '-input=false',
      '-no-color',
      '-compact-warnings',
      '-json',
      '-refresh-only',
      '-refresh=false',
      '-parallelism',
      '-detailed-exitcode',
    ];
    for (const flag of flagPatterns) {
      if (content.includes(flag)) {
        flags.push(flag);
      }
    }

    return {
      varFiles,
      vars,
      backendConfigs,
      targets,
      stateFile,
      planOutput,
      workingDir,
      flags,
    };
  }

  /**
   * Extract Helm-specific arguments from script content
   *
   * @param content - Full script content
   * @returns Helm arguments
   */
  extractHelmArgs(content: string): HelmArgs {
    const valuesFiles: string[] = [];
    const setValues: Record<string, string> = {};
    const setStringValues: Record<string, string> = {};
    const flags: string[] = [];

    // -f/--values patterns
    const valuesPattern = /(?:-f|--values)[=\s]+["']?([^\s"']+)["']?/g;
    let match: RegExpExecArray | null;
    while ((match = valuesPattern.exec(content)) !== null) {
      valuesFiles.push(match[1]);
    }

    // --set patterns
    const setPattern = /--set[=\s]+["']?([^=]+)=([^\s"',]+)["']?/g;
    while ((match = setPattern.exec(content)) !== null) {
      setValues[match[1]] = match[2];
    }

    // --set-string patterns
    const setStringPattern = /--set-string[=\s]+["']?([^=]+)=([^\s"',]+)["']?/g;
    while ((match = setStringPattern.exec(content)) !== null) {
      setStringValues[match[1]] = match[2];
    }

    // Extract release name and chart
    const installUpgradeMatch = /helm\s+(?:install|upgrade)\s+(?:--install\s+)?["']?([^\s"']+)["']?\s+["']?([^\s"']+)["']?/i.exec(content);
    const releaseName = installUpgradeMatch?.[1];
    const chartRef = installUpgradeMatch?.[2];

    // Namespace
    const nsMatch = /(?:-n|--namespace)[=\s]+["']?([^\s"']+)["']?/.exec(content);
    const namespace = nsMatch?.[1];

    // Version
    const versionMatch = /--version[=\s]+["']?([^\s"']+)["']?/.exec(content);
    const version = versionMatch?.[1];

    // Repo
    const repoMatch = /--repo[=\s]+["']?([^\s"']+)["']?/.exec(content);
    const repo = repoMatch?.[1];

    // Common flags
    const flagPatterns = [
      '--atomic',
      '--wait',
      '--timeout',
      '--dry-run',
      '--debug',
      '--force',
      '--replace',
      '--create-namespace',
      '--dependency-update',
      '--skip-crds',
      '--no-hooks',
      '--cleanup-on-fail',
    ];
    for (const flag of flagPatterns) {
      if (content.includes(flag)) {
        flags.push(flag);
      }
    }

    return {
      releaseName,
      chartRef,
      namespace,
      valuesFiles,
      setValues,
      setStringValues,
      version,
      repo,
      flags,
    };
  }

  // ============================================================================
  // Confidence Calculation
  // ============================================================================

  /**
   * Calculate confidence score based on evidence
   *
   * @param matches - Command matches found
   * @param imageMatch - Whether image matched
   * @param evidence - All evidence collected
   * @returns Confidence score (0-100)
   */
  calculateConfidence(
    matches: readonly CommandMatch[],
    imageMatch: boolean,
    evidence: readonly DetectionEvidence[]
  ): number {
    // Base score from evidence
    let score = evidence.reduce((acc, e) => acc + e.score, 0);

    // Cap at 100
    score = Math.min(score, 100);

    // Minimum score if we have any matches
    if (matches.length > 0 && score < 40) {
      score = 40;
    }

    // Minimum score if we have image match
    if (imageMatch && score < 30) {
      score = 30;
    }

    return score;
  }

  /**
   * Calculate overall confidence from tool detections
   */
  private calculateOverallConfidence(
    terraform: TerraformJobInfo | null,
    helm: HelmJobInfo | null
  ): number {
    const scores: number[] = [];

    if (terraform) {
      scores.push(terraform.confidence);
    }
    if (helm) {
      scores.push(helm.confidence);
    }

    if (scores.length === 0) {
      return 0;
    }

    // Return max confidence
    return Math.max(...scores);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get all scripts from a job (before_script + script + after_script)
   */
  private getAllScripts(job: GitLabJob): readonly string[] {
    const scripts: string[] = [];

    if (job.beforeScript) {
      scripts.push(...job.beforeScript);
    }
    scripts.push(...job.script);
    if (job.afterScript) {
      scripts.push(...job.afterScript);
    }

    return scripts;
  }

  /**
   * Get image name from GitLabImage
   */
  private getImageName(image: GitLabImage | undefined): string | undefined {
    if (!image) return undefined;
    return typeof image === 'string' ? image : image.name;
  }

  /**
   * Check if image is a Terraform image
   */
  private hasTerraformImage(image?: string): boolean {
    if (!image) return false;
    return TERRAFORM_IMAGES.some(pattern => pattern.test(image));
  }

  /**
   * Check if image is a Helm image
   */
  private hasHelmImage(image?: string): boolean {
    if (!image) return false;
    return HELM_IMAGES.some(pattern => pattern.test(image));
  }

  /**
   * Check if job extends Terraform templates
   */
  private hasTerraformExtends(extends_: string | readonly string[]): boolean {
    const extendsArray = Array.isArray(extends_) ? extends_ : [extends_];
    return extendsArray.some(e =>
      e.toLowerCase().includes('terraform') ||
      e.toLowerCase().includes('terragrunt') ||
      e.toLowerCase().includes('.tf')
    );
  }

  /**
   * Detect Terraform variant (terraform, terragrunt, tofu)
   */
  private detectTerraformVariant(line: string): 'terraform' | 'terragrunt' | 'tofu' {
    const lower = line.toLowerCase();
    if (lower.includes('terragrunt')) return 'terragrunt';
    if (lower.includes('tofu')) return 'tofu';
    return 'terraform';
  }

  /**
   * Parse Terraform command to enum
   */
  private parseTerraformCommand(cmd: string): TerraformCommand {
    const normalized = cmd.toLowerCase();
    const commands: TerraformCommand[] = [
      'init', 'validate', 'plan', 'apply', 'destroy', 'fmt',
      'output', 'import', 'state', 'workspace', 'refresh',
      'taint', 'untaint', 'force-unlock',
    ];
    return commands.find(c => normalized === c || normalized.startsWith(c)) ?? 'unknown';
  }

  /**
   * Parse Helm command to enum
   */
  private parseHelmCommand(cmd: string): HelmCommand {
    const normalized = cmd.toLowerCase();
    const commands: HelmCommand[] = [
      'install', 'upgrade', 'uninstall', 'rollback', 'template',
      'lint', 'package', 'push', 'pull', 'repo', 'dependency', 'test',
    ];
    // Handle compound commands
    if (normalized.includes('upgrade') && normalized.includes('install')) {
      return 'upgrade';
    }
    return commands.find(c => normalized === c || normalized.startsWith(c)) ?? 'unknown';
  }

  /**
   * Determine primary Terraform command (most impactful)
   */
  private determinePrimaryTerraformCommand(commands: readonly TerraformCommand[]): TerraformCommand {
    // Priority order for primary command
    const priority: TerraformCommand[] = [
      'destroy', 'apply', 'import', 'state', 'taint', 'untaint',
      'plan', 'refresh', 'init', 'validate', 'fmt', 'output', 'workspace',
    ];

    for (const cmd of priority) {
      if (commands.includes(cmd)) {
        return cmd;
      }
    }

    return commands[0] ?? 'unknown';
  }

  /**
   * Determine primary Helm command (most impactful)
   */
  private determinePrimaryHelmCommand(commands: readonly HelmCommand[]): HelmCommand {
    // Priority order for primary command
    const priority: HelmCommand[] = [
      'uninstall', 'rollback', 'upgrade', 'install',
      'push', 'package', 'template', 'lint', 'test',
      'repo', 'dependency', 'pull',
    ];

    for (const cmd of priority) {
      if (commands.includes(cmd)) {
        return cmd;
      }
    }

    return commands[0] ?? 'unknown';
  }

  /**
   * Detect Terraform Cloud/Enterprise usage
   */
  private detectsTerraformCloud(scripts: readonly string[], job?: GitLabJob): boolean {
    const content = scripts.join('\n');

    // Check script content
    if (TF_CLOUD_INDICATORS.some(pattern => pattern.test(content))) {
      return true;
    }

    // Check job variables
    if (job?.variables) {
      const varNames = Object.keys(job.variables);
      return varNames.some(name =>
        name.startsWith('TF_CLOUD_') ||
        name.startsWith('TFE_') ||
        name === 'TFC_RUN_ID'
      );
    }

    return false;
  }

  /**
   * Find Terraform-related variables
   */
  private findTerraformVariables(
    variables?: Readonly<Record<string, string | { value: string }>>
  ): string[] {
    if (!variables) return [];

    return Object.keys(variables).filter(name =>
      name.startsWith('TF_') ||
      name.startsWith('TF_VAR_') ||
      name.startsWith('TERRAFORM_') ||
      name.startsWith('TG_') ||
      name.startsWith('TERRAGRUNT_')
    );
  }

  /**
   * Find Helm-related variables
   */
  private findHelmVariables(
    variables?: Readonly<Record<string, string | { value: string }>>
  ): string[] {
    if (!variables) return [];

    return Object.keys(variables).filter(name =>
      name.startsWith('HELM_') ||
      name.startsWith('HELMFILE_') ||
      name.includes('CHART_') ||
      name.includes('RELEASE_')
    );
  }

  /**
   * Extract working directory from script
   */
  private extractWorkingDirectory(content: string): string | undefined {
    // cd command
    const cdMatch = /cd\s+["']?([^\s"';&|]+)["']?/.exec(content);
    if (cdMatch) return cdMatch[1];

    // TF_ROOT variable
    const tfRootMatch = /TF_ROOT[=:]\s*["']?([^\s"']+)["']?/i.exec(content);
    if (tfRootMatch) return tfRootMatch[1];

    // TERRAGRUNT_WORKING_DIR
    const tgWdMatch = /TERRAGRUNT_WORKING_DIR[=:]\s*["']?([^\s"']+)["']?/i.exec(content);
    if (tgWdMatch) return tgWdMatch[1];

    return undefined;
  }

  /**
   * Detect backend type from script content
   */
  private detectBackendType(content: string): string | undefined {
    // Check for backend config
    const backendMatch = /-backend-config[=\s]+["']?([^\s"'=]+)["']?/.exec(content);
    if (backendMatch) {
      const config = backendMatch[1];
      if (config.includes('s3') || config.includes('bucket')) return 's3';
      if (config.includes('gcs')) return 'gcs';
      if (config.includes('azurerm')) return 'azurerm';
      if (config.includes('consul')) return 'consul';
      if (config.includes('http')) return 'http';
      if (config.includes('pg') || config.includes('postgres')) return 'pg';
    }

    // Check for remote/cloud backend indicators
    if (content.includes('TF_CLOUD_') || content.includes('TFE_')) {
      return 'remote';
    }

    return undefined;
  }

  /**
   * Create empty Terraform args structure
   */
  private createEmptyTerraformArgs(): TerraformArgs {
    return {
      varFiles: [],
      vars: {},
      backendConfigs: [],
      targets: [],
      flags: [],
    };
  }
}

// ============================================================================
// Factory and Utility Functions
// ============================================================================

/**
 * Create a new GitLab tool detector instance
 *
 * @returns New GitLabToolDetector instance
 */
export function createGitLabToolDetector(): GitLabToolDetector {
  return new GitLabToolDetector();
}

/**
 * Detect tools in a job using a default detector
 *
 * @param job - GitLab CI job to analyze
 * @returns Tool detection result
 */
export function detectToolsInJob(job: GitLabJob): ToolDetectionResult {
  const detector = new GitLabToolDetector();
  return detector.detectInJob(job);
}

/**
 * Convert TerraformJobInfo to GitLabTerraformDetectionInfo format
 *
 * @param info - Terraform job info from detector
 * @returns GitLab CI types format
 */
export function toGitLabTerraformDetectionInfo(
  info: TerraformJobInfo
): GitLabTerraformDetectionInfo {
  return {
    commands: info.allCommands,
    workingDirectory: info.workingDirectory,
    varFiles: info.varFiles,
    usesCloud: info.usesCloud,
    confidence: info.confidence,
  };
}

/**
 * Convert HelmJobInfo to GitLabHelmDetectionInfo format
 *
 * @param info - Helm job info from detector
 * @returns GitLab CI types format
 */
export function toGitLabHelmDetectionInfo(
  info: HelmJobInfo
): GitLabHelmDetectionInfo {
  return {
    commands: info.allCommands,
    releaseName: info.releaseName,
    chartPath: info.chartPath,
    namespace: info.namespace,
    valuesFiles: info.valuesFiles,
    confidence: info.confidence,
  };
}

// ============================================================================
// All constants and classes are exported inline above
// ============================================================================
