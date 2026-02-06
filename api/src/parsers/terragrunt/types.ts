/**
 * Terragrunt Parser Types
 * @module parsers/terragrunt/types
 *
 * TASK-TG-001: Core type definitions for Terragrunt HCL parsing
 *
 * Terragrunt extends Terraform HCL with 13 special block types and
 * 27 built-in functions for configuration hierarchy management.
 */

import { SourceLocation, HCLExpression } from '../terraform/types';

// ============================================================================
// Terragrunt Block Types - 13 Terragrunt-specific block types
// ============================================================================

/**
 * All Terragrunt-specific block types
 */
export type TerragruntBlockType =
  | 'terraform'        // Terraform configuration block
  | 'remote_state'     // Remote state configuration
  | 'include'          // Include parent configurations
  | 'locals'           // Local variables
  | 'dependency'       // Module dependencies
  | 'dependencies'     // Multiple module dependencies
  | 'generate'         // Generate files (providers, backends)
  | 'inputs'           // Input variables to Terraform
  | 'download_dir'     // Override download directory
  | 'prevent_destroy'  // Prevent terraform destroy
  | 'skip'             // Skip this configuration
  | 'iam_role'         // IAM role to assume
  | 'retry_config';    // Retry configuration for errors

/**
 * Base interface for all Terragrunt blocks
 */
export interface TerragruntBlockBase {
  readonly type: TerragruntBlockType;
  readonly location: SourceLocation;
  readonly raw: string;
}

// ============================================================================
// Individual Block Type Definitions
// ============================================================================

/**
 * terraform {} block - configures Terraform execution
 */
export interface TerraformBlock extends TerragruntBlockBase {
  readonly type: 'terraform';
  /** Source of Terraform module (local path, Git URL, registry) */
  readonly source: HCLExpression | null;
  /** Extra arguments for terraform commands */
  readonly extraArguments: TerraformExtraArguments[];
  /** Before hooks */
  readonly beforeHooks: TerraformHook[];
  /** After hooks */
  readonly afterHooks: TerraformHook[];
  /** Error hooks */
  readonly errorHooks: TerraformHook[];
  /** Include files in Terraform module copy */
  readonly includeInCopy: readonly string[];
}

/**
 * Extra arguments configuration for terraform commands
 */
export interface TerraformExtraArguments {
  readonly name: string;
  readonly commands: readonly string[];
  readonly arguments: readonly string[];
  readonly envVars: Record<string, HCLExpression>;
  readonly requiredVarFiles: readonly string[];
  readonly optionalVarFiles: readonly string[];
}

/**
 * Terraform hook configuration
 */
export interface TerraformHook {
  readonly name: string;
  readonly commands: readonly string[];
  readonly execute: readonly string[];
  readonly runOnError: boolean;
}

/**
 * remote_state {} block - configures Terraform remote state
 */
export interface RemoteStateBlock extends TerragruntBlockBase {
  readonly type: 'remote_state';
  /** Backend type (s3, gcs, azurerm, etc.) */
  readonly backend: string;
  /** Generate backend configuration file */
  readonly generate: RemoteStateGenerate | null;
  /** Backend configuration */
  readonly config: Record<string, HCLExpression>;
  /** Disable initialization of backend */
  readonly disableInit: boolean;
  /** Disable backend dependency optimization */
  readonly disableDependencyOptimization: boolean;
}

/**
 * Remote state generate configuration
 */
export interface RemoteStateGenerate {
  readonly path: string;
  readonly ifExists: 'overwrite' | 'skip' | 'overwrite_terragrunt';
}

/**
 * include {} block - include parent configuration
 */
export interface IncludeBlock extends TerragruntBlockBase {
  readonly type: 'include';
  /** Label for named includes (empty for default) */
  readonly label: string;
  /** Path to parent configuration */
  readonly path: HCLExpression;
  /** Expose include configuration in parent */
  readonly exposeAsVariable: boolean;
  /** Merge strategy */
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
}

/**
 * locals {} block - local variable definitions
 */
export interface LocalsBlock extends TerragruntBlockBase {
  readonly type: 'locals';
  /** Local variable assignments */
  readonly variables: Record<string, HCLExpression>;
}

/**
 * dependency {} block - single module dependency
 */
export interface DependencyBlock extends TerragruntBlockBase {
  readonly type: 'dependency';
  /** Dependency name (label) */
  readonly name: string;
  /** Path to dependent module */
  readonly configPath: HCLExpression;
  /** Skip outputs check */
  readonly skipOutputs: boolean;
  /** Mock outputs for plan */
  readonly mockOutputs: Record<string, HCLExpression>;
  /** Mock outputs merge strategy */
  readonly mockOutputsMergeStrategyWithState: 'no_merge' | 'shallow' | 'deep';
  /** Allowed commands for mock outputs */
  readonly mockOutputsAllowedTerraformCommands: readonly string[];
}

/**
 * dependencies {} block - multiple module dependencies
 */
export interface DependenciesBlock extends TerragruntBlockBase {
  readonly type: 'dependencies';
  /** Paths to dependent modules */
  readonly paths: HCLExpression;
}

/**
 * generate {} block - generate configuration files
 */
export interface GenerateBlock extends TerragruntBlockBase {
  readonly type: 'generate';
  /** Label/name for the generated file */
  readonly label: string;
  /** Path where file will be generated */
  readonly path: HCLExpression;
  /** Content to write */
  readonly contents: HCLExpression;
  /** If exists behavior */
  readonly ifExists: 'overwrite' | 'skip' | 'overwrite_terragrunt';
  /** Comment prefix for generated content */
  readonly commentPrefix: string;
  /** Disable signature in generated file */
  readonly disableSignature: boolean;
}

/**
 * inputs = {} - input variables for Terraform
 */
export interface InputsBlock extends TerragruntBlockBase {
  readonly type: 'inputs';
  /** Input variable values */
  readonly values: Record<string, HCLExpression>;
}

/**
 * iam_role {} block - AWS IAM role configuration
 */
export interface IamRoleBlock extends TerragruntBlockBase {
  readonly type: 'iam_role';
  /** IAM role ARN */
  readonly roleArn: HCLExpression;
  /** IAM session duration */
  readonly sessionDuration: number | null;
  /** Web identity token for OIDC */
  readonly webIdentityToken: HCLExpression | null;
}

/**
 * retry_config {} block - retry configuration
 */
export interface RetryConfigBlock extends TerragruntBlockBase {
  readonly type: 'retry_config';
  /** Retryable errors regex patterns */
  readonly retryableErrors: readonly string[];
  /** Maximum retry attempts */
  readonly maxRetryAttempts: number;
  /** Sleep between retries */
  readonly sleepBetweenRetries: number;
}

/**
 * Simple configuration blocks (no nested structure)
 */
export interface SimpleConfigBlock extends TerragruntBlockBase {
  readonly type: 'download_dir' | 'prevent_destroy' | 'skip';
  readonly value: HCLExpression;
}

// ============================================================================
// Discriminated Union of All Block Types
// ============================================================================

/**
 * Union type for all Terragrunt blocks
 */
export type TerragruntBlock =
  | TerraformBlock
  | RemoteStateBlock
  | IncludeBlock
  | LocalsBlock
  | DependencyBlock
  | DependenciesBlock
  | GenerateBlock
  | InputsBlock
  | IamRoleBlock
  | RetryConfigBlock
  | SimpleConfigBlock;

// ============================================================================
// Terragrunt Functions - 27 built-in functions
// ============================================================================

/**
 * Terragrunt built-in function categories
 */
export type TerragruntFunctionCategory =
  | 'path'           // Path-related functions
  | 'include'        // Include-related functions
  | 'dependency'     // Dependency functions
  | 'read'           // File reading functions
  | 'aws'            // AWS-specific functions
  | 'runtime'        // Runtime information
  | 'utility';       // Utility functions

/**
 * Terragrunt function return types
 * Note: 'passthrough' is used for functions like mark_as_read that return
 * the same type as their input (cannot be statically determined)
 */
export type TerragruntFunctionReturnType =
  | 'string'
  | 'object'
  | 'list'
  | 'bool'
  | 'passthrough';  // For functions that return their input type unchanged

/**
 * Terragrunt function definition
 */
export interface TerragruntFunctionDef {
  readonly name: string;
  readonly category: TerragruntFunctionCategory;
  readonly description: string;
  readonly minArgs: number;
  readonly maxArgs: number;
  readonly returnType: TerragruntFunctionReturnType;
}

/**
 * All 27 Terragrunt built-in functions
 */
export const TERRAGRUNT_FUNCTIONS: readonly TerragruntFunctionDef[] = [
  // Path functions (6)
  { name: 'find_in_parent_folders', category: 'path', description: 'Find file in parent directories', minArgs: 0, maxArgs: 2, returnType: 'string' },
  { name: 'path_relative_to_include', category: 'path', description: 'Relative path from include', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'path_relative_from_include', category: 'path', description: 'Relative path to include', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_path_from_repo_root', category: 'path', description: 'Path from repository root', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_path_to_repo_root', category: 'path', description: 'Path to repository root', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_terragrunt_dir', category: 'path', description: 'Directory of terragrunt.hcl', minArgs: 0, maxArgs: 0, returnType: 'string' },

  // Include functions (2)
  { name: 'read_terragrunt_config', category: 'include', description: 'Read another terragrunt config', minArgs: 1, maxArgs: 2, returnType: 'object' },
  { name: 'get_original_terragrunt_dir', category: 'include', description: 'Original terragrunt directory', minArgs: 0, maxArgs: 0, returnType: 'string' },

  // Dependency functions (2)
  { name: 'get_terraform_commands_that_need_vars', category: 'dependency', description: 'Commands requiring vars', minArgs: 0, maxArgs: 0, returnType: 'list' },
  { name: 'get_terraform_commands_that_need_locking', category: 'dependency', description: 'Commands requiring locks', minArgs: 0, maxArgs: 0, returnType: 'list' },

  // Read functions (4)
  { name: 'sops_decrypt_file', category: 'read', description: 'Decrypt SOPS encrypted file', minArgs: 1, maxArgs: 1, returnType: 'string' },
  { name: 'local_exec', category: 'read', description: 'Execute local command', minArgs: 1, maxArgs: 1, returnType: 'string' },
  { name: 'read_tfvars_file', category: 'read', description: 'Read terraform.tfvars file', minArgs: 1, maxArgs: 1, returnType: 'object' },
  { name: 'run_cmd', category: 'read', description: 'Run command and capture output', minArgs: 1, maxArgs: -1, returnType: 'string' },

  // AWS functions (8)
  { name: 'get_aws_account_id', category: 'aws', description: 'Get AWS account ID', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_aws_caller_identity_arn', category: 'aws', description: 'Get AWS caller identity ARN', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_aws_caller_identity_user_id', category: 'aws', description: 'Get AWS caller user ID', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_aws_region', category: 'aws', description: 'Get current AWS region', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_aws_account_alias', category: 'aws', description: 'Get AWS account alias', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_default_retryable_errors', category: 'aws', description: 'Default retryable error patterns', minArgs: 0, maxArgs: 0, returnType: 'list' },
  { name: 'get_terraform_command', category: 'aws', description: 'Current terraform command', minArgs: 0, maxArgs: 0, returnType: 'string' },
  { name: 'get_terraform_cli_args', category: 'aws', description: 'Terraform CLI arguments', minArgs: 0, maxArgs: 0, returnType: 'list' },

  // Runtime functions (2)
  { name: 'get_env', category: 'runtime', description: 'Get environment variable', minArgs: 1, maxArgs: 2, returnType: 'string' },
  { name: 'get_platform', category: 'runtime', description: 'Get current platform', minArgs: 0, maxArgs: 0, returnType: 'string' },

  // Utility functions (3)
  { name: 'mark_as_read', category: 'utility', description: 'Mark value as sensitive', minArgs: 1, maxArgs: 1, returnType: 'passthrough' },
  { name: 'render_aws_provider_settings', category: 'utility', description: 'Render AWS provider settings', minArgs: 0, maxArgs: 1, returnType: 'string' },
  { name: 'parse_aws_arn', category: 'utility', description: 'Parse AWS ARN into components', minArgs: 1, maxArgs: 1, returnType: 'object' },
] as const;

/**
 * Set of Terragrunt function names for fast lookup
 */
export const TERRAGRUNT_FUNCTION_NAMES = new Set(
  TERRAGRUNT_FUNCTIONS.map(f => f.name)
);

// ============================================================================
// Terragrunt File AST
// ============================================================================

/**
 * Parsed Terragrunt configuration file
 */
export interface TerragruntFile {
  /** File path */
  readonly path: string;
  /** All parsed blocks */
  readonly blocks: readonly TerragruntBlock[];
  /** Resolved includes (from include blocks) */
  readonly includes: readonly ResolvedInclude[];
  /** Resolved dependencies (from dependency/dependencies blocks) */
  readonly dependencies: readonly ResolvedDependency[];
  /** Parse errors */
  readonly errors: readonly TerragruntParseError[];
  /** File encoding */
  readonly encoding: string;
  /** File size in bytes */
  readonly size: number;
}

/**
 * Resolved include reference
 */
export interface ResolvedInclude {
  /** Include label (empty for default) */
  readonly label: string;
  /** Original path expression */
  readonly pathExpression: HCLExpression;
  /** Resolved absolute path */
  readonly resolvedPath: string | null;
  /** Whether the include was successfully resolved */
  readonly resolved: boolean;
  /** Merge strategy */
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
}

/**
 * Resolved dependency reference
 */
export interface ResolvedDependency {
  /** Dependency name */
  readonly name: string;
  /** Original config path expression */
  readonly configPathExpression: HCLExpression;
  /** Resolved absolute path */
  readonly resolvedPath: string | null;
  /** Whether the dependency was successfully resolved */
  readonly resolved: boolean;
  /** Output names used from this dependency */
  readonly outputsUsed: readonly string[];
}

/**
 * Terragrunt parse error
 */
export interface TerragruntParseError {
  readonly message: string;
  readonly location: SourceLocation | null;
  readonly severity: 'error' | 'warning';
  readonly code: TerragruntParseErrorCode;
}

/**
 * Parse error codes specific to Terragrunt
 */
export type TerragruntParseErrorCode =
  | 'SYNTAX_ERROR'
  | 'INVALID_BLOCK_TYPE'
  | 'MISSING_REQUIRED_ATTRIBUTE'
  | 'INVALID_ATTRIBUTE_VALUE'
  | 'INCLUDE_NOT_FOUND'
  | 'DEPENDENCY_NOT_FOUND'
  | 'CIRCULAR_INCLUDE'
  | 'CIRCULAR_DEPENDENCY'
  | 'UNKNOWN_FUNCTION'
  | 'INVALID_FUNCTION_ARGS'
  | 'FILE_READ_ERROR';

// ============================================================================
// Parser Options
// ============================================================================

/**
 * Terragrunt parser-specific options
 */
export interface TerragruntParserOptions {
  /** Continue parsing after errors */
  readonly errorRecovery: boolean;
  /** Maximum file size in bytes (default: 10MB) */
  readonly maxFileSize: number;
  /** File encoding (default: utf-8) */
  readonly encoding: BufferEncoding;
  /** Include raw HCL text in AST nodes */
  readonly includeRaw: boolean;
  /** Resolve include paths */
  readonly resolveIncludes: boolean;
  /** Maximum include depth to prevent infinite loops */
  readonly maxIncludeDepth: number;
  /** Resolve dependency paths */
  readonly resolveDependencies: boolean;
  /** Base directory for relative path resolution */
  readonly baseDir: string;
}

/**
 * Default Terragrunt parser options
 */
export const DEFAULT_TERRAGRUNT_PARSER_OPTIONS: TerragruntParserOptions = {
  errorRecovery: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  encoding: 'utf-8',
  includeRaw: true,
  resolveIncludes: true,
  maxIncludeDepth: 10,
  resolveDependencies: true,
  baseDir: process.cwd(),
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TerraformBlock
 */
export function isTerraformBlock(block: TerragruntBlock): block is TerraformBlock {
  return block.type === 'terraform';
}

/**
 * Type guard for RemoteStateBlock
 */
export function isRemoteStateBlock(block: TerragruntBlock): block is RemoteStateBlock {
  return block.type === 'remote_state';
}

/**
 * Type guard for IncludeBlock
 */
export function isIncludeBlock(block: TerragruntBlock): block is IncludeBlock {
  return block.type === 'include';
}

/**
 * Type guard for LocalsBlock
 */
export function isLocalsBlock(block: TerragruntBlock): block is LocalsBlock {
  return block.type === 'locals';
}

/**
 * Type guard for DependencyBlock
 */
export function isDependencyBlock(block: TerragruntBlock): block is DependencyBlock {
  return block.type === 'dependency';
}

/**
 * Type guard for DependenciesBlock
 */
export function isDependenciesBlock(block: TerragruntBlock): block is DependenciesBlock {
  return block.type === 'dependencies';
}

/**
 * Type guard for GenerateBlock
 */
export function isGenerateBlock(block: TerragruntBlock): block is GenerateBlock {
  return block.type === 'generate';
}

/**
 * Type guard for InputsBlock
 */
export function isInputsBlock(block: TerragruntBlock): block is InputsBlock {
  return block.type === 'inputs';
}

/**
 * Type guard for IamRoleBlock
 */
export function isIamRoleBlock(block: TerragruntBlock): block is IamRoleBlock {
  return block.type === 'iam_role';
}

/**
 * Type guard for RetryConfigBlock
 */
export function isRetryConfigBlock(block: TerragruntBlock): block is RetryConfigBlock {
  return block.type === 'retry_config';
}

/**
 * Type guard for SimpleConfigBlock (download_dir, prevent_destroy, skip)
 */
export function isSimpleConfigBlock(block: TerragruntBlock): block is SimpleConfigBlock {
  return block.type === 'download_dir' || block.type === 'prevent_destroy' || block.type === 'skip';
}

/**
 * Check if a function name is a Terragrunt built-in
 */
export function isTerragruntFunction(name: string): boolean {
  return TERRAGRUNT_FUNCTION_NAMES.has(name);
}

/**
 * Get function definition by name
 */
export function getTerragruntFunctionDef(name: string): TerragruntFunctionDef | undefined {
  return TERRAGRUNT_FUNCTIONS.find(f => f.name === name);
}

// ============================================================================
// Branded Types for Type-Safe Identifiers
// ============================================================================

/**
 * Brand utility type for creating nominal types from primitives
 */
type Brand<T, B> = T & { readonly __brand: B };

/**
 * Branded type for Terragrunt file paths (absolute paths to terragrunt.hcl)
 */
export type TerragruntFilePath = Brand<string, 'TerragruntFilePath'>;

/**
 * Branded type for include labels
 */
export type IncludeLabel = Brand<string, 'IncludeLabel'>;

/**
 * Branded type for dependency names
 */
export type DependencyName = Brand<string, 'DependencyName'>;

/**
 * Branded type for generate block labels
 */
export type GenerateLabel = Brand<string, 'GenerateLabel'>;

/**
 * Create a branded TerragruntFilePath
 */
export function createTerragruntFilePath(path: string): TerragruntFilePath {
  return path as TerragruntFilePath;
}

/**
 * Create a branded IncludeLabel
 */
export function createIncludeLabel(label: string): IncludeLabel {
  return label as IncludeLabel;
}

/**
 * Create a branded DependencyName
 */
export function createDependencyName(name: string): DependencyName {
  return name as DependencyName;
}

/**
 * Create a branded GenerateLabel
 */
export function createGenerateLabel(label: string): GenerateLabel {
  return label as GenerateLabel;
}

// ============================================================================
// Exhaustive Check Utilities
// ============================================================================

/**
 * Helper for exhaustive switch statements on TerragruntBlockType.
 * TypeScript will error if not all cases are handled.
 *
 * @example
 * ```typescript
 * function handleBlock(block: TerragruntBlock): string {
 *   switch (block.type) {
 *     case 'terraform': return 'terraform';
 *     case 'remote_state': return 'remote_state';
 *     // ... all other cases
 *     default:
 *       return assertNeverBlock(block);
 *   }
 * }
 * ```
 */
export function assertNeverBlock(block: never, message?: string): never {
  throw new Error(message ?? `Unhandled block type: ${JSON.stringify(block)}`);
}

/**
 * Get the block type from a TerragruntBlock (useful for exhaustive handling)
 */
export function getBlockType(block: TerragruntBlock): TerragruntBlockType {
  return block.type;
}

// ============================================================================
// Parse Result Types
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type ParseResultType<T, E = TerragruntParseError> =
  | { readonly success: true; readonly value: T; readonly warnings: readonly E[] }
  | { readonly success: false; readonly error: E; readonly partialValue?: T };

/**
 * Type guard for successful parse result
 */
export function isParseSuccess<T, E>(
  result: ParseResultType<T, E>
): result is { readonly success: true; readonly value: T; readonly warnings: readonly E[] } {
  return result.success === true;
}

/**
 * Type guard for failed parse result
 */
export function isParseFailure<T, E>(
  result: ParseResultType<T, E>
): result is { readonly success: false; readonly error: E; readonly partialValue?: T } {
  return result.success === false;
}

// ============================================================================
// Block Visitor Types
// ============================================================================

/**
 * Visitor pattern types for processing all block types
 */
export interface TerragruntBlockVisitor<R = void> {
  visitTerraform(block: TerraformBlock): R;
  visitRemoteState(block: RemoteStateBlock): R;
  visitInclude(block: IncludeBlock): R;
  visitLocals(block: LocalsBlock): R;
  visitDependency(block: DependencyBlock): R;
  visitDependencies(block: DependenciesBlock): R;
  visitGenerate(block: GenerateBlock): R;
  visitInputs(block: InputsBlock): R;
  visitIamRole(block: IamRoleBlock): R;
  visitRetryConfig(block: RetryConfigBlock): R;
  visitSimpleConfig(block: SimpleConfigBlock): R;
}

/**
 * Apply a visitor to a block
 */
export function visitBlock<R>(block: TerragruntBlock, visitor: TerragruntBlockVisitor<R>): R {
  switch (block.type) {
    case 'terraform':
      return visitor.visitTerraform(block);
    case 'remote_state':
      return visitor.visitRemoteState(block);
    case 'include':
      return visitor.visitInclude(block);
    case 'locals':
      return visitor.visitLocals(block);
    case 'dependency':
      return visitor.visitDependency(block);
    case 'dependencies':
      return visitor.visitDependencies(block);
    case 'generate':
      return visitor.visitGenerate(block);
    case 'inputs':
      return visitor.visitInputs(block);
    case 'iam_role':
      return visitor.visitIamRole(block);
    case 'retry_config':
      return visitor.visitRetryConfig(block);
    case 'download_dir':
    case 'prevent_destroy':
    case 'skip':
      return visitor.visitSimpleConfig(block);
    default:
      return assertNeverBlock(block);
  }
}

// ============================================================================
// Utility Type Exports
// ============================================================================

/**
 * Extract the type of a specific block from the union
 */
export type ExtractBlock<T extends TerragruntBlockType> = Extract<TerragruntBlock, { type: T }>;

/**
 * All block types that have a label property
 */
export type LabeledBlock = IncludeBlock | GenerateBlock | DependencyBlock;

/**
 * All block types that contain HCL expressions in a map
 */
export type ExpressionMapBlock = LocalsBlock | InputsBlock;

/**
 * Block types that affect Terraform execution
 */
export type ExecutionBlock = TerraformBlock | RemoteStateBlock | IamRoleBlock | RetryConfigBlock;

/**
 * Block types that define references to other configurations
 */
export type ReferenceBlock = IncludeBlock | DependencyBlock | DependenciesBlock;

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result for a single block
 */
export interface BlockValidationResult {
  readonly block: TerragruntBlock;
  readonly valid: boolean;
  readonly errors: readonly TerragruntParseError[];
  readonly warnings: readonly TerragruntParseError[];
}

/**
 * Validation result for an entire Terragrunt file
 */
export interface FileValidationResult {
  readonly file: TerragruntFile;
  readonly valid: boolean;
  readonly blockResults: readonly BlockValidationResult[];
  readonly globalErrors: readonly TerragruntParseError[];
  readonly globalWarnings: readonly TerragruntParseError[];
}

/**
 * Type for block validators
 */
export type BlockValidator = (block: TerragruntBlock) => BlockValidationResult;

// ============================================================================
// Metadata Types for Graph Integration
// ============================================================================

/**
 * Metadata extracted from a TerragruntFile for graph node visualization.
 * Provides summary information about the configuration without exposing
 * the full parsed structure.
 *
 * @remarks
 * TASK-TG-007: This interface is used by the graph visualization to display
 * Terragrunt configuration information in node tooltips and detail panels.
 */
export interface TerragruntNodeMetadata {
  /** Terraform module source (local path, Git URL, or registry) */
  readonly terraformSource: string | null;
  /** Whether a remote_state block is configured */
  readonly hasRemoteState: boolean;
  /** Backend type for remote state (s3, gcs, azurerm, etc.) */
  readonly remoteStateBackend: string | null;
  /** Number of include blocks */
  readonly includeCount: number;
  /** Number of dependency blocks */
  readonly dependencyCount: number;
  /** Number of input variables */
  readonly inputCount: number;
  /** Labels of generate blocks */
  readonly generateBlocks: readonly string[];
  /** Names of declared dependencies */
  readonly dependencyNames: readonly string[];
  /** Labels of include blocks */
  readonly includeLabels: readonly string[];
  /** File encoding */
  readonly encoding: string;
  /** File size in bytes */
  readonly size: number;
  /** Total number of blocks */
  readonly blockCount: number;
  /** Number of parse errors */
  readonly errorCount: number;
}
