/**
 * Terragrunt Validation Service
 * @module parsers/terragrunt/services/validation.service
 *
 * TASK-TG-001: Service for validating Terragrunt configurations
 *
 * Provides:
 * - Block validation rules for all 13 block types
 * - Cross-reference validation (includes, dependencies)
 * - Configuration completeness checks
 * - Best practice validation
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  TerragruntFile,
  TerragruntBlock,
  TerragruntBlockType,
  TerragruntParseError,
  TerragruntParseErrorCode,
  BlockValidationResult,
  FileValidationResult,
  // Block types
  TerraformBlock,
  RemoteStateBlock,
  IncludeBlock,
  LocalsBlock,
  DependencyBlock,
  DependenciesBlock,
  GenerateBlock,
  InputsBlock,
  IamRoleBlock,
  RetryConfigBlock,
  SimpleConfigBlock,
  // Type guards
  isTerraformBlock,
  isRemoteStateBlock,
  isIncludeBlock,
  isLocalsBlock,
  isDependencyBlock,
  isDependenciesBlock,
  isGenerateBlock,
  isInputsBlock,
  isIamRoleBlock,
  isRetryConfigBlock,
  isSimpleConfigBlock,
  visitBlock,
  TerragruntBlockVisitor,
  TERRAGRUNT_FUNCTION_NAMES,
} from '../types';
import { HCLExpression } from '../../terraform/types';
import { SourceLocation } from '../../terraform/types';

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Severity level for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue
 */
export interface ValidationIssue {
  /** Issue code for programmatic handling */
  readonly code: string;
  /** Human-readable message */
  readonly message: string;
  /** Severity level */
  readonly severity: ValidationSeverity;
  /** Source location if available */
  readonly location: SourceLocation | null;
  /** Block type that caused the issue */
  readonly blockType: TerragruntBlockType | null;
  /** Suggested fix */
  readonly suggestion?: string;
  /** Reference URL for more information */
  readonly docUrl?: string;
}

/**
 * Validation rule definition
 */
export interface ValidationRule {
  /** Rule identifier */
  readonly id: string;
  /** Rule description */
  readonly description: string;
  /** Severity if rule is violated */
  readonly severity: ValidationSeverity;
  /** Block types this rule applies to (empty = all) */
  readonly appliesTo: readonly TerragruntBlockType[];
  /** Whether this rule is enabled by default */
  readonly enabledByDefault: boolean;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Check for required blocks */
  readonly checkRequiredBlocks?: boolean;
  /** Check for duplicate blocks */
  readonly checkDuplicateBlocks?: boolean;
  /** Check cross-references */
  readonly checkCrossReferences?: boolean;
  /** Check best practices */
  readonly checkBestPractices?: boolean;
  /** Disabled rule IDs */
  readonly disabledRules?: readonly string[];
  /** Custom rules */
  readonly customRules?: readonly ValidationRule[];
  /** Base directory for path resolution */
  readonly baseDir?: string;
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  readonly valid: boolean;
  /** All issues found */
  readonly issues: readonly ValidationIssue[];
  /** Error count */
  readonly errorCount: number;
  /** Warning count */
  readonly warningCount: number;
  /** Info count */
  readonly infoCount: number;
  /** Rules checked */
  readonly rulesChecked: readonly string[];
  /** Validation duration in ms */
  readonly duration: number;
}

// ============================================================================
// Built-in Validation Rules
// ============================================================================

/**
 * Built-in validation rules
 */
export const BUILTIN_RULES: readonly ValidationRule[] = [
  // Structure rules
  {
    id: 'TG001',
    description: 'Remote state must specify a backend',
    severity: 'error',
    appliesTo: ['remote_state'],
    enabledByDefault: true,
  },
  {
    id: 'TG002',
    description: 'Include must specify a path',
    severity: 'error',
    appliesTo: ['include'],
    enabledByDefault: true,
  },
  {
    id: 'TG003',
    description: 'Dependency must specify a config_path',
    severity: 'error',
    appliesTo: ['dependency'],
    enabledByDefault: true,
  },
  {
    id: 'TG004',
    description: 'Generate must specify path and contents',
    severity: 'error',
    appliesTo: ['generate'],
    enabledByDefault: true,
  },
  {
    id: 'TG005',
    description: 'Terraform source should be specified',
    severity: 'warning',
    appliesTo: ['terraform'],
    enabledByDefault: true,
  },
  // Duplicate detection
  {
    id: 'TG010',
    description: 'Duplicate include with same label',
    severity: 'error',
    appliesTo: ['include'],
    enabledByDefault: true,
  },
  {
    id: 'TG011',
    description: 'Duplicate dependency with same name',
    severity: 'error',
    appliesTo: ['dependency'],
    enabledByDefault: true,
  },
  {
    id: 'TG012',
    description: 'Duplicate generate with same label',
    severity: 'error',
    appliesTo: ['generate'],
    enabledByDefault: true,
  },
  {
    id: 'TG013',
    description: 'Multiple remote_state blocks',
    severity: 'error',
    appliesTo: ['remote_state'],
    enabledByDefault: true,
  },
  {
    id: 'TG014',
    description: 'Multiple terraform blocks',
    severity: 'error',
    appliesTo: ['terraform'],
    enabledByDefault: true,
  },
  // Cross-reference rules
  {
    id: 'TG020',
    description: 'Include path not found',
    severity: 'error',
    appliesTo: ['include'],
    enabledByDefault: true,
  },
  {
    id: 'TG021',
    description: 'Dependency path not found',
    severity: 'warning',
    appliesTo: ['dependency'],
    enabledByDefault: true,
  },
  {
    id: 'TG022',
    description: 'Circular include detected',
    severity: 'error',
    appliesTo: ['include'],
    enabledByDefault: true,
  },
  {
    id: 'TG023',
    description: 'Circular dependency detected',
    severity: 'error',
    appliesTo: ['dependency', 'dependencies'],
    enabledByDefault: true,
  },
  // Best practices
  {
    id: 'TG030',
    description: 'Dependency should have mock_outputs for plan',
    severity: 'info',
    appliesTo: ['dependency'],
    enabledByDefault: true,
  },
  {
    id: 'TG031',
    description: 'Remote state should use encryption',
    severity: 'warning',
    appliesTo: ['remote_state'],
    enabledByDefault: true,
  },
  {
    id: 'TG032',
    description: 'Generate should specify if_exists',
    severity: 'info',
    appliesTo: ['generate'],
    enabledByDefault: true,
  },
  {
    id: 'TG033',
    description: 'IAM role should specify session duration',
    severity: 'info',
    appliesTo: ['iam_role'],
    enabledByDefault: true,
  },
  {
    id: 'TG034',
    description: 'Locals block should not shadow standard variables',
    severity: 'warning',
    appliesTo: ['locals'],
    enabledByDefault: true,
  },
];

// ============================================================================
// Validation Service Class
// ============================================================================

/**
 * Service for validating Terragrunt configurations.
 *
 * @example
 * ```typescript
 * const service = new TerragruntValidationService();
 *
 * // Validate a parsed file
 * const result = service.validate(parsedFile);
 *
 * // Validate with custom options
 * const customResult = service.validate(parsedFile, {
 *   checkBestPractices: true,
 *   disabledRules: ['TG030'],
 * });
 *
 * // Validate a single block
 * const blockResult = service.validateBlock(block);
 * ```
 */
export class TerragruntValidationService {
  private readonly defaultOptions: Required<ValidationOptions>;
  private readonly rules: Map<string, ValidationRule>;

  constructor(options: Partial<ValidationOptions> = {}) {
    this.defaultOptions = {
      checkRequiredBlocks: options.checkRequiredBlocks ?? true,
      checkDuplicateBlocks: options.checkDuplicateBlocks ?? true,
      checkCrossReferences: options.checkCrossReferences ?? true,
      checkBestPractices: options.checkBestPractices ?? true,
      disabledRules: options.disabledRules ?? [],
      customRules: options.customRules ?? [],
      baseDir: options.baseDir ?? process.cwd(),
    };

    // Build rules map
    this.rules = new Map();
    for (const rule of BUILTIN_RULES) {
      this.rules.set(rule.id, rule);
    }
    for (const rule of this.defaultOptions.customRules) {
      this.rules.set(rule.id, rule);
    }
  }

  // ============================================================================
  // Main Validation Methods
  // ============================================================================

  /**
   * Validate a complete Terragrunt file
   */
  validate(
    file: TerragruntFile,
    options?: Partial<ValidationOptions>
  ): ValidationResult {
    const startTime = performance.now();
    const mergedOptions = { ...this.defaultOptions, ...options };
    const issues: ValidationIssue[] = [];
    const rulesChecked = new Set<string>();

    // Check duplicate blocks
    if (mergedOptions.checkDuplicateBlocks) {
      issues.push(...this.checkDuplicates(file, rulesChecked));
    }

    // Validate each block
    for (const block of file.blocks) {
      const blockIssues = this.validateBlock(block, mergedOptions, rulesChecked);
      issues.push(...blockIssues);
    }

    // Check cross-references
    if (mergedOptions.checkCrossReferences) {
      issues.push(...this.checkCrossReferences(file, rulesChecked));
    }

    // Check best practices
    if (mergedOptions.checkBestPractices) {
      issues.push(...this.checkBestPractices(file, rulesChecked));
    }

    // Filter disabled rules
    const filteredIssues = issues.filter(
      i => !mergedOptions.disabledRules.includes(i.code)
    );

    const errorCount = filteredIssues.filter(i => i.severity === 'error').length;
    const warningCount = filteredIssues.filter(i => i.severity === 'warning').length;
    const infoCount = filteredIssues.filter(i => i.severity === 'info').length;

    return {
      valid: errorCount === 0,
      issues: filteredIssues,
      errorCount,
      warningCount,
      infoCount,
      rulesChecked: Array.from(rulesChecked),
      duration: performance.now() - startTime,
    };
  }

  /**
   * Validate a single block
   */
  validateBlock(
    block: TerragruntBlock,
    options?: Partial<ValidationOptions>,
    rulesChecked?: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const tracked = rulesChecked ?? new Set<string>();

    const visitor: TerragruntBlockVisitor<readonly ValidationIssue[]> = {
      visitTerraform: (b) => this.validateTerraformBlock(b, tracked),
      visitRemoteState: (b) => this.validateRemoteStateBlock(b, tracked),
      visitInclude: (b) => this.validateIncludeBlock(b, tracked),
      visitLocals: (b) => this.validateLocalsBlock(b, tracked),
      visitDependency: (b) => this.validateDependencyBlock(b, tracked),
      visitDependencies: (b) => this.validateDependenciesBlock(b, tracked),
      visitGenerate: (b) => this.validateGenerateBlock(b, tracked),
      visitInputs: (b) => this.validateInputsBlock(b, tracked),
      visitIamRole: (b) => this.validateIamRoleBlock(b, tracked),
      visitRetryConfig: (b) => this.validateRetryConfigBlock(b, tracked),
      visitSimpleConfig: (b) => this.validateSimpleConfigBlock(b, tracked),
    };

    issues.push(...visitBlock(block, visitor));
    return issues;
  }

  /**
   * Get all available rules
   */
  getRules(): readonly ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): ValidationRule | undefined {
    return this.rules.get(id);
  }

  // ============================================================================
  // Block Validators
  // ============================================================================

  private validateTerraformBlock(
    block: TerraformBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG005');

    // TG005: Terraform source should be specified
    if (!block.source || this.isNullExpression(block.source)) {
      issues.push({
        code: 'TG005',
        message: 'Terraform block should specify a source',
        severity: 'warning',
        location: block.location,
        blockType: 'terraform',
        suggestion: 'Add source = "<module-source>" to the terraform block',
        docUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform',
      });
    }

    // Validate hooks
    for (const hook of [...block.beforeHooks, ...block.afterHooks, ...block.errorHooks]) {
      if (hook.execute.length === 0) {
        issues.push({
          code: 'TG035',
          message: `Hook "${hook.name}" has no execute commands`,
          severity: 'warning',
          location: block.location,
          blockType: 'terraform',
          suggestion: 'Add execute = ["command", "args..."] to the hook',
        });
      }
    }

    return issues;
  }

  private validateRemoteStateBlock(
    block: RemoteStateBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG001');
    rulesChecked.add('TG031');

    // TG001: Remote state must specify a backend
    if (!block.backend) {
      issues.push({
        code: 'TG001',
        message: 'Remote state must specify a backend',
        severity: 'error',
        location: block.location,
        blockType: 'remote_state',
        suggestion: 'Add backend = "s3" (or gcs, azurerm, etc.) to the remote_state block',
      });
    }

    // TG031: Check for encryption
    if (block.backend === 's3') {
      const encrypt = block.config['encrypt'];
      if (!encrypt || (encrypt.type === 'literal' && encrypt.value !== true)) {
        issues.push({
          code: 'TG031',
          message: 'S3 remote state should enable encryption',
          severity: 'warning',
          location: block.location,
          blockType: 'remote_state',
          suggestion: 'Add encrypt = true to the config block',
        });
      }
    }

    return issues;
  }

  private validateIncludeBlock(
    block: IncludeBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG002');

    // TG002: Include must specify a path
    if (this.isNullExpression(block.path)) {
      issues.push({
        code: 'TG002',
        message: 'Include block must specify a path',
        severity: 'error',
        location: block.location,
        blockType: 'include',
        suggestion: 'Add path = find_in_parent_folders() or a specific path',
      });
    }

    return issues;
  }

  private validateLocalsBlock(
    block: LocalsBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG034');

    // TG034: Check for shadowed variables
    const reservedNames = ['dependency', 'dependencies', 'include', 'local', 'path_relative_to_include'];
    for (const [name] of Object.entries(block.variables)) {
      if (reservedNames.includes(name)) {
        issues.push({
          code: 'TG034',
          message: `Local variable "${name}" shadows a reserved name`,
          severity: 'warning',
          location: block.location,
          blockType: 'locals',
          suggestion: `Rename the local variable to avoid confusion with the built-in "${name}"`,
        });
      }
    }

    return issues;
  }

  private validateDependencyBlock(
    block: DependencyBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG003');
    rulesChecked.add('TG030');

    // TG003: Dependency must specify a config_path
    if (this.isNullExpression(block.configPath)) {
      issues.push({
        code: 'TG003',
        message: 'Dependency block must specify a config_path',
        severity: 'error',
        location: block.location,
        blockType: 'dependency',
        suggestion: 'Add config_path = "../module-name" to the dependency block',
      });
    }

    // TG030: Mock outputs for plan
    if (Object.keys(block.mockOutputs).length === 0 && !block.skipOutputs) {
      issues.push({
        code: 'TG030',
        message: 'Dependency should have mock_outputs for plan commands',
        severity: 'info',
        location: block.location,
        blockType: 'dependency',
        suggestion: 'Add mock_outputs = { ... } to enable terraform plan without apply',
      });
    }

    return issues;
  }

  private validateDependenciesBlock(
    block: DependenciesBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check paths is a valid array
    if (block.paths.type !== 'array' && !this.isNullExpression(block.paths)) {
      issues.push({
        code: 'TG036',
        message: 'Dependencies block paths must be an array',
        severity: 'error',
        location: block.location,
        blockType: 'dependencies',
        suggestion: 'Use paths = ["../module1", "../module2"]',
      });
    }

    return issues;
  }

  private validateGenerateBlock(
    block: GenerateBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG004');
    rulesChecked.add('TG032');

    // TG004: Generate must specify path and contents
    if (this.isNullExpression(block.path)) {
      issues.push({
        code: 'TG004',
        message: 'Generate block must specify a path',
        severity: 'error',
        location: block.location,
        blockType: 'generate',
        suggestion: 'Add path = "filename.tf" to the generate block',
      });
    }

    if (this.isNullExpression(block.contents)) {
      issues.push({
        code: 'TG004',
        message: 'Generate block must specify contents',
        severity: 'error',
        location: block.location,
        blockType: 'generate',
        suggestion: 'Add contents = <<EOF ... EOF to the generate block',
      });
    }

    // TG032: if_exists recommendation
    if (block.ifExists === 'overwrite_terragrunt') {
      // This is the default, fine
    } else if (!block.ifExists) {
      issues.push({
        code: 'TG032',
        message: 'Generate block should specify if_exists behavior',
        severity: 'info',
        location: block.location,
        blockType: 'generate',
        suggestion: 'Add if_exists = "overwrite" or "skip" to be explicit',
      });
    }

    return issues;
  }

  private validateInputsBlock(
    block: InputsBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    // No specific validation rules for inputs currently
    return [];
  }

  private validateIamRoleBlock(
    block: IamRoleBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG033');

    // Check role_arn is specified
    if (this.isNullExpression(block.roleArn)) {
      issues.push({
        code: 'TG037',
        message: 'IAM role block must specify a role_arn',
        severity: 'error',
        location: block.location,
        blockType: 'iam_role',
        suggestion: 'Add role_arn = "arn:aws:iam::..." to the iam_role block',
      });
    }

    // TG033: Session duration recommendation
    if (block.sessionDuration === null) {
      issues.push({
        code: 'TG033',
        message: 'IAM role should specify session duration for clarity',
        severity: 'info',
        location: block.location,
        blockType: 'iam_role',
        suggestion: 'Add session_duration = 3600 (or appropriate value in seconds)',
      });
    }

    return issues;
  }

  private validateRetryConfigBlock(
    block: RetryConfigBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validate reasonable values
    if (block.maxRetryAttempts < 0 || block.maxRetryAttempts > 100) {
      issues.push({
        code: 'TG038',
        message: 'Retry max_retry_attempts should be between 0 and 100',
        severity: 'warning',
        location: block.location,
        blockType: 'retry_config',
        suggestion: 'Use a reasonable value like 3-10',
      });
    }

    if (block.sleepBetweenRetries < 0 || block.sleepBetweenRetries > 3600) {
      issues.push({
        code: 'TG039',
        message: 'Retry sleep_between_retries should be between 0 and 3600 seconds',
        severity: 'warning',
        location: block.location,
        blockType: 'retry_config',
        suggestion: 'Use a reasonable value like 5-30 seconds',
      });
    }

    return issues;
  }

  private validateSimpleConfigBlock(
    block: SimpleConfigBlock,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validate prevent_destroy value type
    if (block.type === 'prevent_destroy') {
      if (block.value.type !== 'literal' || typeof block.value.value !== 'boolean') {
        issues.push({
          code: 'TG040',
          message: 'prevent_destroy should be a boolean value',
          severity: 'error',
          location: block.location,
          blockType: 'prevent_destroy',
          suggestion: 'Use prevent_destroy = true or false',
        });
      }
    }

    // Validate skip value type
    if (block.type === 'skip') {
      if (block.value.type !== 'literal' || typeof block.value.value !== 'boolean') {
        issues.push({
          code: 'TG041',
          message: 'skip should be a boolean value',
          severity: 'error',
          location: block.location,
          blockType: 'skip',
          suggestion: 'Use skip = true or false',
        });
      }
    }

    return issues;
  }

  // ============================================================================
  // Cross-reference Checks
  // ============================================================================

  private checkCrossReferences(
    file: TerragruntFile,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG020');
    rulesChecked.add('TG021');
    rulesChecked.add('TG022');
    rulesChecked.add('TG023');

    // Check include resolutions
    for (const include of file.includes) {
      if (!include.resolved) {
        issues.push({
          code: 'TG020',
          message: `Include path not resolved: ${include.pathExpression.raw}`,
          severity: 'error',
          location: null,
          blockType: 'include',
          suggestion: 'Verify the include path exists and is accessible',
        });
      }
    }

    // Check dependency resolutions
    for (const dep of file.dependencies) {
      if (!dep.resolved) {
        issues.push({
          code: 'TG021',
          message: `Dependency path not resolved: ${dep.configPathExpression.raw}`,
          severity: 'warning',
          location: null,
          blockType: 'dependency',
          suggestion: 'Verify the dependency path exists and contains a terragrunt.hcl',
        });
      }
    }

    // Check for circular references in parse errors
    for (const error of file.errors) {
      if (error.code === 'CIRCULAR_INCLUDE') {
        issues.push({
          code: 'TG022',
          message: error.message,
          severity: 'error',
          location: error.location,
          blockType: 'include',
          suggestion: 'Remove the circular include to fix the hierarchy',
        });
      }
      if (error.code === 'CIRCULAR_DEPENDENCY') {
        issues.push({
          code: 'TG023',
          message: error.message,
          severity: 'error',
          location: error.location,
          blockType: 'dependency',
          suggestion: 'Restructure dependencies to break the cycle',
        });
      }
    }

    return issues;
  }

  // ============================================================================
  // Duplicate Checks
  // ============================================================================

  private checkDuplicates(
    file: TerragruntFile,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    rulesChecked.add('TG010');
    rulesChecked.add('TG011');
    rulesChecked.add('TG012');
    rulesChecked.add('TG013');
    rulesChecked.add('TG014');

    // Track seen items
    const includeLabels = new Map<string, IncludeBlock>();
    const dependencyNames = new Map<string, DependencyBlock>();
    const generateLabels = new Map<string, GenerateBlock>();
    let remoteStateCount = 0;
    let terraformCount = 0;
    let firstRemoteState: RemoteStateBlock | null = null;
    let firstTerraform: TerraformBlock | null = null;

    for (const block of file.blocks) {
      if (isIncludeBlock(block)) {
        const label = block.label || 'default';
        if (includeLabels.has(label)) {
          issues.push({
            code: 'TG010',
            message: `Duplicate include with label "${label}"`,
            severity: 'error',
            location: block.location,
            blockType: 'include',
            suggestion: 'Use unique labels for each include block',
          });
        } else {
          includeLabels.set(label, block);
        }
      }

      if (isDependencyBlock(block)) {
        if (dependencyNames.has(block.name)) {
          issues.push({
            code: 'TG011',
            message: `Duplicate dependency with name "${block.name}"`,
            severity: 'error',
            location: block.location,
            blockType: 'dependency',
            suggestion: 'Use unique names for each dependency block',
          });
        } else {
          dependencyNames.set(block.name, block);
        }
      }

      if (isGenerateBlock(block)) {
        if (generateLabels.has(block.label)) {
          issues.push({
            code: 'TG012',
            message: `Duplicate generate with label "${block.label}"`,
            severity: 'error',
            location: block.location,
            blockType: 'generate',
            suggestion: 'Use unique labels for each generate block',
          });
        } else {
          generateLabels.set(block.label, block);
        }
      }

      if (isRemoteStateBlock(block)) {
        remoteStateCount++;
        if (remoteStateCount === 1) {
          firstRemoteState = block;
        } else {
          issues.push({
            code: 'TG013',
            message: 'Multiple remote_state blocks found',
            severity: 'error',
            location: block.location,
            blockType: 'remote_state',
            suggestion: 'A Terragrunt file should have only one remote_state block',
          });
        }
      }

      if (isTerraformBlock(block)) {
        terraformCount++;
        if (terraformCount === 1) {
          firstTerraform = block;
        } else {
          issues.push({
            code: 'TG014',
            message: 'Multiple terraform blocks found',
            severity: 'error',
            location: block.location,
            blockType: 'terraform',
            suggestion: 'A Terragrunt file should have only one terraform block',
          });
        }
      }
    }

    return issues;
  }

  // ============================================================================
  // Best Practice Checks
  // ============================================================================

  private checkBestPractices(
    file: TerragruntFile,
    rulesChecked: Set<string>
  ): readonly ValidationIssue[] {
    // Best practice checks are already included in block validators
    // This method can be extended for file-level best practices
    return [];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private isNullExpression(expr: HCLExpression | null): boolean {
    if (!expr) return true;
    return expr.type === 'literal' && expr.value === null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new validation service
 */
export function createValidationService(
  options?: Partial<ValidationOptions>
): TerragruntValidationService {
  return new TerragruntValidationService(options);
}

/**
 * Validate a Terragrunt file
 */
export function validateFile(
  file: TerragruntFile,
  options?: Partial<ValidationOptions>
): ValidationResult {
  const service = createValidationService(options);
  return service.validate(file, options);
}

/**
 * Validate a single block
 */
export function validateBlock(
  block: TerragruntBlock,
  options?: Partial<ValidationOptions>
): readonly ValidationIssue[] {
  const service = createValidationService(options);
  return service.validateBlock(block, options);
}

/**
 * Get all validation rules
 */
export function getValidationRules(): readonly ValidationRule[] {
  return BUILTIN_RULES;
}
