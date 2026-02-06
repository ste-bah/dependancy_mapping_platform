/**
 * Terragrunt Parser Configuration
 * @module parsers/terragrunt/config
 *
 * TASK-TG-027: Configuration management for Terragrunt node creation and parsing options.
 * TASK-TG-008: Configuration management for edge factory and TF linker.
 *
 * Provides a unified configuration system for:
 * - Parser behavior (include depth, error recovery)
 * - File system scanning (patterns, exclusions)
 * - Node creation options (dependency hints, generate blocks)
 * - Edge factory configuration (confidence levels, evidence limits)
 * - TF linker configuration (synthetic nodes, source resolution)
 * - Validation and safety checks
 *
 * @example
 * ```typescript
 * import {
 *   createTerragruntConfig,
 *   validateConfig,
 *   DEFAULT_TERRAGRUNT_CONFIG,
 *   DEFAULT_TERRAGRUNT_EDGE_CONFIG,
 *   DEFAULT_TF_LINKER_CONFIG,
 * } from './config';
 *
 * // Create config with defaults
 * const config = createTerragruntConfig();
 *
 * // Create config with overrides
 * const customConfig = createTerragruntConfig({
 *   maxIncludeDepth: 5,
 *   excludePatterns: ['.terragrunt-cache', 'archived'],
 * });
 *
 * // Validate config before use
 * const errors = validateConfig(customConfig);
 * if (errors.length > 0) {
 *   throw new ConfigValidationError(errors);
 * }
 *
 * // Use edge factory config
 * const edgeConfig = createTerragruntEdgeConfig({
 *   defaultExplicitConfidence: 100,
 *   maxEvidencePerEdge: 15,
 * });
 *
 * // Use TF linker config
 * const linkerConfig = createTfLinkerConfig({
 *   createSyntheticNodes: true,
 *   localSourceConfidence: 100,
 * });
 * ```
 */

// ============================================================================
// Configuration Interface
// ============================================================================

/**
 * Comprehensive configuration for Terragrunt parsing and node creation.
 *
 * This interface consolidates all configurable options for the Terragrunt
 * parser ecosystem, including parsing behavior, file scanning, and node
 * factory settings.
 */
export interface TerragruntParserConfig {
  // -------------------------------------------------------------------------
  // Parser Behavior
  // -------------------------------------------------------------------------

  /** Maximum include depth to prevent infinite loops (1-50) */
  readonly maxIncludeDepth: number;

  /** Whether to resolve filesystem paths for includes and dependencies */
  readonly resolveFileSystem: boolean;

  /** Whether to parse generate blocks and extract their metadata */
  readonly parseGenerateBlocks: boolean;

  /** Whether to extract dependency hints for edge creation in graph */
  readonly extractDependencyHints: boolean;

  /** Continue parsing after encountering errors */
  readonly errorRecovery: boolean;

  /** Maximum file size in bytes to parse (default: 10MB) */
  readonly maxFileSize: number;

  /** File encoding for reading Terragrunt files */
  readonly encoding: BufferEncoding;

  /** Include raw HCL text in parsed AST nodes */
  readonly includeRaw: boolean;

  // -------------------------------------------------------------------------
  // File Scanning
  // -------------------------------------------------------------------------

  /** File patterns to consider as Terragrunt configs (glob patterns) */
  readonly filePatterns: readonly string[];

  /** Directories to exclude from scanning (glob patterns) */
  readonly excludePatterns: readonly string[];

  /** Whether to follow symbolic links when scanning */
  readonly followSymlinks: boolean;

  /** Maximum directory depth for recursive scanning (0 = unlimited) */
  readonly maxScanDepth: number;

  // -------------------------------------------------------------------------
  // Node Creation
  // -------------------------------------------------------------------------

  /** Whether to generate unique IDs for nodes (vs deterministic) */
  readonly generateRandomIds: boolean;

  /** Prefix for generated node IDs */
  readonly nodeIdPrefix: string;

  /** Whether to include absolute paths in node metadata */
  readonly includeAbsolutePaths: boolean;

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  /** Enable caching of parsed files */
  readonly enableCache: boolean;

  /** Maximum number of files to cache */
  readonly maxCacheSize: number;

  /** Cache TTL in milliseconds (0 = no expiration) */
  readonly cacheTtlMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values for Terragrunt parsing.
 *
 * These defaults are designed for typical Terragrunt project structures
 * with reasonable safety limits to prevent resource exhaustion.
 */
export const DEFAULT_TERRAGRUNT_CONFIG: TerragruntParserConfig = {
  // Parser behavior
  maxIncludeDepth: 10,
  resolveFileSystem: true,
  parseGenerateBlocks: true,
  extractDependencyHints: true,
  errorRecovery: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  encoding: 'utf-8',
  includeRaw: true,

  // File scanning
  filePatterns: ['terragrunt.hcl', '*.hcl'],
  excludePatterns: [
    '.terragrunt-cache',
    '.terraform',
    'node_modules',
    '.git',
    'vendor',
  ],
  followSymlinks: false,
  maxScanDepth: 0, // Unlimited

  // Node creation
  generateRandomIds: true,
  nodeIdPrefix: 'tg-',
  includeAbsolutePaths: true,

  // Caching
  enableCache: true,
  maxCacheSize: 1000,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
} as const;

// ============================================================================
// Configuration Factory
// ============================================================================

/**
 * Create a Terragrunt parser configuration with optional overrides.
 *
 * Merges provided overrides with default values, ensuring all required
 * fields are present. Array fields (filePatterns, excludePatterns) are
 * replaced entirely, not merged.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete configuration with all fields populated
 *
 * @example
 * ```typescript
 * // Use all defaults
 * const config = createTerragruntConfig();
 *
 * // Override specific settings
 * const config = createTerragruntConfig({
 *   maxIncludeDepth: 5,
 *   errorRecovery: false,
 * });
 *
 * // Replace file patterns entirely
 * const config = createTerragruntConfig({
 *   filePatterns: ['terragrunt.hcl'], // Only match exact filename
 * });
 * ```
 */
export function createTerragruntConfig(
  overrides?: Partial<TerragruntParserConfig>
): TerragruntParserConfig {
  if (!overrides) {
    return { ...DEFAULT_TERRAGRUNT_CONFIG };
  }

  return {
    ...DEFAULT_TERRAGRUNT_CONFIG,
    ...overrides,
    // Ensure arrays are properly handled (replace, not merge)
    filePatterns: overrides.filePatterns ?? DEFAULT_TERRAGRUNT_CONFIG.filePatterns,
    excludePatterns: overrides.excludePatterns ?? DEFAULT_TERRAGRUNT_CONFIG.excludePatterns,
  };
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validation error details for a specific configuration field.
 */
export interface ConfigValidationIssue {
  /** The field path that failed validation */
  readonly field: string;
  /** Human-readable error message */
  readonly message: string;
  /** The actual value that failed validation */
  readonly value: unknown;
  /** Severity of the issue */
  readonly severity: 'error' | 'warning';
}

/**
 * Validate a Terragrunt parser configuration.
 *
 * Checks all configuration values against safety constraints and
 * returns an array of validation issues. An empty array indicates
 * the configuration is valid.
 *
 * @param config - Configuration to validate
 * @returns Array of validation issues (empty if valid)
 *
 * @example
 * ```typescript
 * const config = createTerragruntConfig({ maxIncludeDepth: 100 });
 * const issues = validateConfig(config);
 *
 * if (issues.length > 0) {
 *   const errors = issues.filter(i => i.severity === 'error');
 *   if (errors.length > 0) {
 *     throw new ConfigValidationError(errors);
 *   }
 * }
 * ```
 */
export function validateConfig(config: TerragruntParserConfig): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];

  // Validate maxIncludeDepth
  if (config.maxIncludeDepth < 1) {
    issues.push({
      field: 'maxIncludeDepth',
      message: 'maxIncludeDepth must be at least 1',
      value: config.maxIncludeDepth,
      severity: 'error',
    });
  }

  if (config.maxIncludeDepth > 50) {
    issues.push({
      field: 'maxIncludeDepth',
      message: 'maxIncludeDepth exceeds safe limit of 50',
      value: config.maxIncludeDepth,
      severity: 'error',
    });
  }

  // Validate filePatterns
  if (!config.filePatterns || config.filePatterns.length === 0) {
    issues.push({
      field: 'filePatterns',
      message: 'filePatterns must contain at least one pattern',
      value: config.filePatterns,
      severity: 'error',
    });
  }

  // Validate maxFileSize
  if (config.maxFileSize < 1024) {
    issues.push({
      field: 'maxFileSize',
      message: 'maxFileSize must be at least 1KB (1024 bytes)',
      value: config.maxFileSize,
      severity: 'error',
    });
  }

  if (config.maxFileSize > 100 * 1024 * 1024) {
    issues.push({
      field: 'maxFileSize',
      message: 'maxFileSize exceeds recommended limit of 100MB',
      value: config.maxFileSize,
      severity: 'warning',
    });
  }

  // Validate maxScanDepth
  if (config.maxScanDepth < 0) {
    issues.push({
      field: 'maxScanDepth',
      message: 'maxScanDepth must be non-negative (0 = unlimited)',
      value: config.maxScanDepth,
      severity: 'error',
    });
  }

  // Validate maxCacheSize
  if (config.enableCache && config.maxCacheSize < 1) {
    issues.push({
      field: 'maxCacheSize',
      message: 'maxCacheSize must be at least 1 when caching is enabled',
      value: config.maxCacheSize,
      severity: 'error',
    });
  }

  // Validate cacheTtlMs
  if (config.cacheTtlMs < 0) {
    issues.push({
      field: 'cacheTtlMs',
      message: 'cacheTtlMs must be non-negative (0 = no expiration)',
      value: config.cacheTtlMs,
      severity: 'error',
    });
  }

  // Validate encoding
  const validEncodings: BufferEncoding[] = [
    'utf-8', 'utf8', 'ascii', 'utf16le', 'ucs2', 'ucs-2',
    'base64', 'base64url', 'latin1', 'binary', 'hex',
  ];
  if (!validEncodings.includes(config.encoding)) {
    issues.push({
      field: 'encoding',
      message: `Invalid encoding: ${config.encoding}`,
      value: config.encoding,
      severity: 'error',
    });
  }

  // Validate nodeIdPrefix
  if (config.nodeIdPrefix && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.nodeIdPrefix)) {
    issues.push({
      field: 'nodeIdPrefix',
      message: 'nodeIdPrefix must start with a letter and contain only alphanumeric characters, underscores, and hyphens',
      value: config.nodeIdPrefix,
      severity: 'warning',
    });
  }

  // Validate pattern arrays don't contain empty strings
  for (const pattern of config.filePatterns) {
    if (!pattern || pattern.trim() === '') {
      issues.push({
        field: 'filePatterns',
        message: 'filePatterns contains an empty or whitespace-only pattern',
        value: pattern,
        severity: 'error',
      });
    }
  }

  for (const pattern of config.excludePatterns) {
    if (!pattern || pattern.trim() === '') {
      issues.push({
        field: 'excludePatterns',
        message: 'excludePatterns contains an empty or whitespace-only pattern',
        value: pattern,
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * Check if a configuration is valid (has no error-level issues).
 *
 * @param config - Configuration to check
 * @returns True if configuration has no error-level issues
 */
export function isValidConfig(config: TerragruntParserConfig): boolean {
  const issues = validateConfig(config);
  return !issues.some(issue => issue.severity === 'error');
}

/**
 * Validate configuration and throw if invalid.
 *
 * @param config - Configuration to validate
 * @throws ConfigValidationError if configuration has error-level issues
 */
export function validateConfigOrThrow(config: TerragruntParserConfig): void {
  const issues = validateConfig(config);
  const errors = issues.filter(issue => issue.severity === 'error');

  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
}

// ============================================================================
// Configuration Error
// ============================================================================

/**
 * Error thrown when configuration validation fails.
 */
export class ConfigValidationError extends Error {
  /** The validation issues that caused the error */
  readonly issues: readonly ConfigValidationIssue[];

  constructor(issues: readonly ConfigValidationIssue[]) {
    const errorMessages = issues
      .filter(i => i.severity === 'error')
      .map(i => `${i.field}: ${i.message}`)
      .join('; ');

    super(`Terragrunt configuration validation failed: ${errorMessages}`);

    this.name = 'ConfigValidationError';
    this.issues = issues;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigValidationError);
    }
  }

  /**
   * Get only error-level issues.
   */
  getErrors(): readonly ConfigValidationIssue[] {
    return this.issues.filter(i => i.severity === 'error');
  }

  /**
   * Get only warning-level issues.
   */
  getWarnings(): readonly ConfigValidationIssue[] {
    return this.issues.filter(i => i.severity === 'warning');
  }
}

// ============================================================================
// Configuration Presets
// ============================================================================

/**
 * Preset configurations for common use cases.
 */
export const CONFIG_PRESETS = {
  /**
   * Default configuration - balanced for most use cases.
   */
  default: DEFAULT_TERRAGRUNT_CONFIG,

  /**
   * Strict configuration - minimal caching, no error recovery.
   * Good for CI/CD validation pipelines.
   */
  strict: createTerragruntConfig({
    errorRecovery: false,
    enableCache: false,
    maxIncludeDepth: 5,
  }),

  /**
   * Performance configuration - aggressive caching, larger limits.
   * Good for IDE integrations and development.
   */
  performance: createTerragruntConfig({
    enableCache: true,
    maxCacheSize: 5000,
    cacheTtlMs: 30 * 60 * 1000, // 30 minutes
    maxIncludeDepth: 20,
  }),

  /**
   * Minimal configuration - reduced functionality for quick scans.
   */
  minimal: createTerragruntConfig({
    resolveFileSystem: false,
    parseGenerateBlocks: false,
    extractDependencyHints: false,
    includeRaw: false,
    enableCache: false,
  }),

  /**
   * Safe configuration - conservative limits for untrusted input.
   */
  safe: createTerragruntConfig({
    maxIncludeDepth: 3,
    maxFileSize: 1024 * 1024, // 1MB
    maxScanDepth: 10,
    followSymlinks: false,
    maxCacheSize: 100,
  }),
} as const;

/**
 * Available preset names.
 */
export type ConfigPresetName = keyof typeof CONFIG_PRESETS;

/**
 * Get a preset configuration by name.
 *
 * @param name - Preset name
 * @returns The preset configuration
 */
export function getConfigPreset(name: ConfigPresetName): TerragruntParserConfig {
  return CONFIG_PRESETS[name];
}

// ============================================================================
// Configuration Conversion
// ============================================================================

/**
 * Convert TerragruntParserConfig to TerragruntParserOptions (from types.ts).
 *
 * This allows using the high-level config interface with the existing
 * parser implementation that expects TerragruntParserOptions.
 */
export function toParserOptions(
  config: TerragruntParserConfig,
  baseDir: string
): import('./types').TerragruntParserOptions {
  return {
    errorRecovery: config.errorRecovery,
    maxFileSize: config.maxFileSize,
    encoding: config.encoding,
    includeRaw: config.includeRaw,
    resolveIncludes: config.resolveFileSystem,
    maxIncludeDepth: config.maxIncludeDepth,
    resolveDependencies: config.resolveFileSystem,
    baseDir,
  };
}

/**
 * Convert TerragruntParserConfig to BatchParseOptions (from services).
 */
export function toBatchParseOptions(
  config: TerragruntParserConfig
): Partial<import('./services').BatchParseOptions> {
  return {
    continueOnError: config.errorRecovery,
    excludePatterns: [...config.excludePatterns],
    maxConcurrency: undefined, // Let batch parser decide
    recursive: config.maxScanDepth === 0 || config.maxScanDepth > 1,
  };
}

// ============================================================================
// Edge Factory Configuration (TASK-TG-008)
// ============================================================================

/**
 * Configuration for Terragrunt edge factory functions.
 *
 * Controls confidence levels, evidence handling, and validation
 * for edge creation in the dependency graph.
 */
export interface TerragruntEdgeConfig {
  // -------------------------------------------------------------------------
  // Confidence Defaults
  // -------------------------------------------------------------------------

  /** Default confidence for explicit edge relationships (0-100) */
  readonly defaultExplicitConfidence: number;

  /** Default confidence for inferred edge relationships (0-100) */
  readonly defaultInferredConfidence: number;

  /** Default confidence for heuristic edge relationships (0-100) */
  readonly defaultHeuristicConfidence: number;

  // -------------------------------------------------------------------------
  // Evidence Handling
  // -------------------------------------------------------------------------

  /** Maximum evidence items per edge */
  readonly maxEvidencePerEdge: number;

  // -------------------------------------------------------------------------
  // Edge Creation Options
  // -------------------------------------------------------------------------

  /** Whether to create containment edges for nested relationships */
  readonly createContainmentEdges: boolean;

  /** Whether to validate edges on creation */
  readonly validateOnCreate: boolean;
}

/**
 * Default configuration values for Terragrunt edge factory.
 *
 * These defaults provide sensible confidence levels:
 * - Explicit: 100 (direct, unambiguous relationships)
 * - Inferred: 85 (logically derived relationships)
 * - Heuristic: 70 (pattern-based relationships)
 */
export const DEFAULT_TERRAGRUNT_EDGE_CONFIG: TerragruntEdgeConfig = {
  // Confidence defaults
  defaultExplicitConfidence: 100,
  defaultInferredConfidence: 85,
  defaultHeuristicConfidence: 70,

  // Evidence handling
  maxEvidencePerEdge: 10,

  // Edge creation options
  createContainmentEdges: false,
  validateOnCreate: true,
} as const;

/**
 * Create a Terragrunt edge factory configuration with optional overrides.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete configuration with all fields populated
 *
 * @example
 * ```typescript
 * // Use all defaults
 * const config = createTerragruntEdgeConfig();
 *
 * // Override specific settings
 * const config = createTerragruntEdgeConfig({
 *   defaultInferredConfidence: 90,
 *   maxEvidencePerEdge: 20,
 * });
 * ```
 */
export function createTerragruntEdgeConfig(
  overrides?: Partial<TerragruntEdgeConfig>
): TerragruntEdgeConfig {
  if (!overrides) {
    return { ...DEFAULT_TERRAGRUNT_EDGE_CONFIG };
  }

  return {
    ...DEFAULT_TERRAGRUNT_EDGE_CONFIG,
    ...overrides,
  };
}

/**
 * Validate a Terragrunt edge factory configuration.
 *
 * @param config - Configuration to validate
 * @returns Array of validation issues (empty if valid)
 */
export function validateEdgeConfig(config: TerragruntEdgeConfig): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];

  // Validate confidence ranges (0-100)
  if (config.defaultExplicitConfidence < 0 || config.defaultExplicitConfidence > 100) {
    issues.push({
      field: 'defaultExplicitConfidence',
      message: 'defaultExplicitConfidence must be between 0 and 100',
      value: config.defaultExplicitConfidence,
      severity: 'error',
    });
  }

  if (config.defaultInferredConfidence < 0 || config.defaultInferredConfidence > 100) {
    issues.push({
      field: 'defaultInferredConfidence',
      message: 'defaultInferredConfidence must be between 0 and 100',
      value: config.defaultInferredConfidence,
      severity: 'error',
    });
  }

  if (config.defaultHeuristicConfidence < 0 || config.defaultHeuristicConfidence > 100) {
    issues.push({
      field: 'defaultHeuristicConfidence',
      message: 'defaultHeuristicConfidence must be between 0 and 100',
      value: config.defaultHeuristicConfidence,
      severity: 'error',
    });
  }

  // Validate maxEvidencePerEdge
  if (config.maxEvidencePerEdge < 1) {
    issues.push({
      field: 'maxEvidencePerEdge',
      message: 'maxEvidencePerEdge must be at least 1',
      value: config.maxEvidencePerEdge,
      severity: 'error',
    });
  }

  if (config.maxEvidencePerEdge > 100) {
    issues.push({
      field: 'maxEvidencePerEdge',
      message: 'maxEvidencePerEdge exceeds recommended limit of 100',
      value: config.maxEvidencePerEdge,
      severity: 'warning',
    });
  }

  // Validate boolean fields
  if (typeof config.createContainmentEdges !== 'boolean') {
    issues.push({
      field: 'createContainmentEdges',
      message: 'createContainmentEdges must be a boolean',
      value: config.createContainmentEdges,
      severity: 'error',
    });
  }

  if (typeof config.validateOnCreate !== 'boolean') {
    issues.push({
      field: 'validateOnCreate',
      message: 'validateOnCreate must be a boolean',
      value: config.validateOnCreate,
      severity: 'error',
    });
  }

  return issues;
}

// ============================================================================
// TF Linker Configuration (TASK-TG-008)
// ============================================================================

/**
 * Configuration for Terraform source linker.
 *
 * Controls synthetic node creation, source resolution, and
 * confidence levels for different source types.
 */
export interface TfLinkerConfig {
  // -------------------------------------------------------------------------
  // Synthetic Node Options
  // -------------------------------------------------------------------------

  /** Create synthetic nodes for unresolvable sources */
  readonly createSyntheticNodes: boolean;

  // -------------------------------------------------------------------------
  // Confidence Levels
  // -------------------------------------------------------------------------

  /** Default confidence for local source resolution (0-100) */
  readonly localSourceConfidence: number;

  /** Default confidence for external source resolution (0-100) */
  readonly externalSourceConfidence: number;

  // -------------------------------------------------------------------------
  // Safety Limits
  // -------------------------------------------------------------------------

  /** Maximum recursion depth for circular detection */
  readonly maxRecursionDepth: number;
}

/**
 * Default configuration values for TF linker.
 *
 * These defaults provide:
 * - Synthetic nodes enabled for external modules
 * - Local sources have 100% confidence (exact path match)
 * - External sources have 90% confidence (may have version drift)
 * - Recursion depth of 10 to prevent infinite loops
 */
export const DEFAULT_TF_LINKER_CONFIG: TfLinkerConfig = {
  // Synthetic node options
  createSyntheticNodes: true,

  // Confidence levels
  localSourceConfidence: 100,
  externalSourceConfidence: 90,

  // Safety limits
  maxRecursionDepth: 10,
} as const;

/**
 * Create a TF linker configuration with optional overrides.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete configuration with all fields populated
 *
 * @example
 * ```typescript
 * // Use all defaults
 * const config = createTfLinkerConfig();
 *
 * // Override specific settings
 * const config = createTfLinkerConfig({
 *   createSyntheticNodes: false,
 *   externalSourceConfidence: 80,
 * });
 * ```
 */
export function createTfLinkerConfig(
  overrides?: Partial<TfLinkerConfig>
): TfLinkerConfig {
  if (!overrides) {
    return { ...DEFAULT_TF_LINKER_CONFIG };
  }

  return {
    ...DEFAULT_TF_LINKER_CONFIG,
    ...overrides,
  };
}

/**
 * Validate a TF linker configuration.
 *
 * @param config - Configuration to validate
 * @returns Array of validation issues (empty if valid)
 */
export function validateTfLinkerConfig(config: TfLinkerConfig): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];

  // Validate confidence ranges (0-100)
  if (config.localSourceConfidence < 0 || config.localSourceConfidence > 100) {
    issues.push({
      field: 'localSourceConfidence',
      message: 'localSourceConfidence must be between 0 and 100',
      value: config.localSourceConfidence,
      severity: 'error',
    });
  }

  if (config.externalSourceConfidence < 0 || config.externalSourceConfidence > 100) {
    issues.push({
      field: 'externalSourceConfidence',
      message: 'externalSourceConfidence must be between 0 and 100',
      value: config.externalSourceConfidence,
      severity: 'error',
    });
  }

  // Validate maxRecursionDepth
  if (config.maxRecursionDepth < 1) {
    issues.push({
      field: 'maxRecursionDepth',
      message: 'maxRecursionDepth must be at least 1',
      value: config.maxRecursionDepth,
      severity: 'error',
    });
  }

  if (config.maxRecursionDepth > 50) {
    issues.push({
      field: 'maxRecursionDepth',
      message: 'maxRecursionDepth exceeds recommended limit of 50',
      value: config.maxRecursionDepth,
      severity: 'warning',
    });
  }

  // Validate boolean fields
  if (typeof config.createSyntheticNodes !== 'boolean') {
    issues.push({
      field: 'createSyntheticNodes',
      message: 'createSyntheticNodes must be a boolean',
      value: config.createSyntheticNodes,
      severity: 'error',
    });
  }

  return issues;
}

// ============================================================================
// Environment-based Configuration
// ============================================================================

/**
 * Create configuration from environment variables.
 *
 * Reads configuration from environment variables with TERRAGRUNT_PARSER_ prefix.
 * Environment variables override defaults but can be further overridden by
 * explicit options.
 *
 * Supported environment variables:
 * - TERRAGRUNT_PARSER_MAX_INCLUDE_DEPTH
 * - TERRAGRUNT_PARSER_MAX_FILE_SIZE
 * - TERRAGRUNT_PARSER_ERROR_RECOVERY
 * - TERRAGRUNT_PARSER_ENABLE_CACHE
 * - TERRAGRUNT_PARSER_MAX_CACHE_SIZE
 * - TERRAGRUNT_PARSER_CACHE_TTL_MS
 *
 * @param overrides - Additional overrides to apply after environment
 * @returns Configuration with environment and override values
 */
export function createConfigFromEnv(
  overrides?: Partial<TerragruntParserConfig>
): TerragruntParserConfig {
  const env = process.env;

  const envOverrides: Partial<TerragruntParserConfig> = {};

  // Parse numeric values
  if (env.TERRAGRUNT_PARSER_MAX_INCLUDE_DEPTH) {
    const value = parseInt(env.TERRAGRUNT_PARSER_MAX_INCLUDE_DEPTH, 10);
    if (!isNaN(value)) {
      envOverrides.maxIncludeDepth = value;
    }
  }

  if (env.TERRAGRUNT_PARSER_MAX_FILE_SIZE) {
    const value = parseInt(env.TERRAGRUNT_PARSER_MAX_FILE_SIZE, 10);
    if (!isNaN(value)) {
      envOverrides.maxFileSize = value;
    }
  }

  if (env.TERRAGRUNT_PARSER_MAX_CACHE_SIZE) {
    const value = parseInt(env.TERRAGRUNT_PARSER_MAX_CACHE_SIZE, 10);
    if (!isNaN(value)) {
      envOverrides.maxCacheSize = value;
    }
  }

  if (env.TERRAGRUNT_PARSER_CACHE_TTL_MS) {
    const value = parseInt(env.TERRAGRUNT_PARSER_CACHE_TTL_MS, 10);
    if (!isNaN(value)) {
      envOverrides.cacheTtlMs = value;
    }
  }

  // Parse boolean values
  if (env.TERRAGRUNT_PARSER_ERROR_RECOVERY) {
    envOverrides.errorRecovery = env.TERRAGRUNT_PARSER_ERROR_RECOVERY.toLowerCase() === 'true';
  }

  if (env.TERRAGRUNT_PARSER_ENABLE_CACHE) {
    envOverrides.enableCache = env.TERRAGRUNT_PARSER_ENABLE_CACHE.toLowerCase() === 'true';
  }

  if (env.TERRAGRUNT_PARSER_RESOLVE_FILE_SYSTEM) {
    envOverrides.resolveFileSystem = env.TERRAGRUNT_PARSER_RESOLVE_FILE_SYSTEM.toLowerCase() === 'true';
  }

  // Merge: defaults < env < explicit overrides
  return createTerragruntConfig({
    ...envOverrides,
    ...overrides,
  });
}

/**
 * Create edge factory configuration from environment variables.
 *
 * Reads configuration from environment variables with TG_EDGE_ prefix.
 * Environment variables override defaults but can be further overridden by
 * explicit options.
 *
 * Supported environment variables:
 * - TG_EDGE_DEFAULT_CONFIDENCE (sets all confidence types)
 * - TG_EDGE_EXPLICIT_CONFIDENCE
 * - TG_EDGE_INFERRED_CONFIDENCE
 * - TG_EDGE_HEURISTIC_CONFIDENCE
 * - TG_EDGE_MAX_EVIDENCE
 * - TG_EDGE_CREATE_CONTAINMENT
 * - TG_EDGE_VALIDATE_ON_CREATE
 *
 * @param overrides - Additional overrides to apply after environment
 * @returns Configuration with environment and override values
 */
export function createEdgeConfigFromEnv(
  overrides?: Partial<TerragruntEdgeConfig>
): TerragruntEdgeConfig {
  const env = process.env;

  const envOverrides: Partial<TerragruntEdgeConfig> = {};

  // Parse numeric values

  // TG_EDGE_DEFAULT_CONFIDENCE sets all confidence types if individual ones not set
  if (env.TG_EDGE_DEFAULT_CONFIDENCE) {
    const value = parseInt(env.TG_EDGE_DEFAULT_CONFIDENCE, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      envOverrides.defaultExplicitConfidence = value;
      envOverrides.defaultInferredConfidence = value;
      envOverrides.defaultHeuristicConfidence = value;
    }
  }

  // Individual confidence overrides (take precedence over DEFAULT_CONFIDENCE)
  if (env.TG_EDGE_EXPLICIT_CONFIDENCE) {
    const value = parseInt(env.TG_EDGE_EXPLICIT_CONFIDENCE, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      envOverrides.defaultExplicitConfidence = value;
    }
  }

  if (env.TG_EDGE_INFERRED_CONFIDENCE) {
    const value = parseInt(env.TG_EDGE_INFERRED_CONFIDENCE, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      envOverrides.defaultInferredConfidence = value;
    }
  }

  if (env.TG_EDGE_HEURISTIC_CONFIDENCE) {
    const value = parseInt(env.TG_EDGE_HEURISTIC_CONFIDENCE, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      envOverrides.defaultHeuristicConfidence = value;
    }
  }

  if (env.TG_EDGE_MAX_EVIDENCE) {
    const value = parseInt(env.TG_EDGE_MAX_EVIDENCE, 10);
    if (!isNaN(value) && value >= 1) {
      envOverrides.maxEvidencePerEdge = value;
    }
  }

  // Parse boolean values
  if (env.TG_EDGE_CREATE_CONTAINMENT) {
    envOverrides.createContainmentEdges = env.TG_EDGE_CREATE_CONTAINMENT.toLowerCase() === 'true';
  }

  if (env.TG_EDGE_VALIDATE_ON_CREATE) {
    envOverrides.validateOnCreate = env.TG_EDGE_VALIDATE_ON_CREATE.toLowerCase() === 'true';
  }

  // Merge: defaults < env < explicit overrides
  return createTerragruntEdgeConfig({
    ...envOverrides,
    ...overrides,
  });
}

/**
 * Create TF linker configuration from environment variables.
 *
 * Reads configuration from environment variables with TG_LINKER_ prefix.
 * Environment variables override defaults but can be further overridden by
 * explicit options.
 *
 * Supported environment variables:
 * - TG_LINKER_CREATE_SYNTHETIC
 * - TG_LINKER_LOCAL_CONFIDENCE
 * - TG_LINKER_EXTERNAL_CONFIDENCE
 * - TG_LINKER_MAX_RECURSION
 *
 * @param overrides - Additional overrides to apply after environment
 * @returns Configuration with environment and override values
 */
export function createTfLinkerConfigFromEnv(
  overrides?: Partial<TfLinkerConfig>
): TfLinkerConfig {
  const env = process.env;

  const envOverrides: Partial<TfLinkerConfig> = {};

  // Parse numeric values
  if (env.TG_LINKER_LOCAL_CONFIDENCE) {
    const value = parseInt(env.TG_LINKER_LOCAL_CONFIDENCE, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      envOverrides.localSourceConfidence = value;
    }
  }

  if (env.TG_LINKER_EXTERNAL_CONFIDENCE) {
    const value = parseInt(env.TG_LINKER_EXTERNAL_CONFIDENCE, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      envOverrides.externalSourceConfidence = value;
    }
  }

  if (env.TG_LINKER_MAX_RECURSION) {
    const value = parseInt(env.TG_LINKER_MAX_RECURSION, 10);
    if (!isNaN(value) && value >= 1) {
      envOverrides.maxRecursionDepth = value;
    }
  }

  // Parse boolean values
  if (env.TG_LINKER_CREATE_SYNTHETIC) {
    envOverrides.createSyntheticNodes = env.TG_LINKER_CREATE_SYNTHETIC.toLowerCase() === 'true';
  }

  // Merge: defaults < env < explicit overrides
  return createTfLinkerConfig({
    ...envOverrides,
    ...overrides,
  });
}
