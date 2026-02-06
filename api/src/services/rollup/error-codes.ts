/**
 * Rollup Error Codes and Messages
 * @module services/rollup/error-codes
 *
 * Exhaustive error code enumeration with user-friendly messages,
 * severity levels, and suggested actions for the Rollup feature.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation error handling
 */

// ============================================================================
// Error Severity Levels
// ============================================================================

/**
 * Error severity level for categorizing error impact
 */
export enum RollupErrorSeverity {
  /** Informational - no action required */
  INFO = 'info',
  /** Warning - operation continued with degraded functionality */
  WARNING = 'warning',
  /** Error - operation failed but system is stable */
  ERROR = 'error',
  /** Critical - system integrity may be compromised */
  CRITICAL = 'critical',
}

// ============================================================================
// Error Code Enumeration
// ============================================================================

/**
 * Comprehensive rollup error codes
 * Format: ROLLUP_<CATEGORY>_<SPECIFIC_ERROR>
 */
export const RollupErrorCode = {
  // =========================================================================
  // General Errors (ROLLUP_GEN_*)
  // =========================================================================
  /** Generic rollup error */
  GEN_ERROR: 'ROLLUP_GEN_ERROR',
  /** Operation not supported */
  GEN_NOT_SUPPORTED: 'ROLLUP_GEN_NOT_SUPPORTED',
  /** Internal error */
  GEN_INTERNAL: 'ROLLUP_GEN_INTERNAL',

  // =========================================================================
  // Validation Errors (ROLLUP_VAL_*)
  // =========================================================================
  /** General validation error */
  VAL_ERROR: 'ROLLUP_VAL_ERROR',
  /** Invalid rollup configuration */
  VAL_INVALID_CONFIG: 'ROLLUP_VAL_INVALID_CONFIG',
  /** Invalid matcher configuration */
  VAL_INVALID_MATCHER: 'ROLLUP_VAL_INVALID_MATCHER',
  /** Invalid merge options */
  VAL_INVALID_MERGE_OPTIONS: 'ROLLUP_VAL_INVALID_MERGE_OPTIONS',
  /** Missing required field */
  VAL_MISSING_FIELD: 'ROLLUP_VAL_MISSING_FIELD',
  /** Invalid field value */
  VAL_INVALID_FIELD: 'ROLLUP_VAL_INVALID_FIELD',
  /** Invalid ARN pattern */
  VAL_INVALID_ARN_PATTERN: 'ROLLUP_VAL_INVALID_ARN_PATTERN',
  /** Invalid regex pattern */
  VAL_INVALID_REGEX: 'ROLLUP_VAL_INVALID_REGEX',
  /** Invalid cron expression */
  VAL_INVALID_CRON: 'ROLLUP_VAL_INVALID_CRON',
  /** Insufficient repositories */
  VAL_INSUFFICIENT_REPOS: 'ROLLUP_VAL_INSUFFICIENT_REPOS',

  // =========================================================================
  // Resource Errors (ROLLUP_RES_*)
  // =========================================================================
  /** Rollup not found */
  RES_NOT_FOUND: 'ROLLUP_RES_NOT_FOUND',
  /** Rollup already exists */
  RES_ALREADY_EXISTS: 'ROLLUP_RES_ALREADY_EXISTS',
  /** Execution not found */
  RES_EXEC_NOT_FOUND: 'ROLLUP_RES_EXEC_NOT_FOUND',
  /** Repository not found */
  RES_REPO_NOT_FOUND: 'ROLLUP_RES_REPO_NOT_FOUND',
  /** Scan not found */
  RES_SCAN_NOT_FOUND: 'ROLLUP_RES_SCAN_NOT_FOUND',
  /** Graph not found */
  RES_GRAPH_NOT_FOUND: 'ROLLUP_RES_GRAPH_NOT_FOUND',
  /** Version conflict (optimistic locking) */
  RES_VERSION_CONFLICT: 'ROLLUP_RES_VERSION_CONFLICT',
  /** Resource locked */
  RES_LOCKED: 'ROLLUP_RES_LOCKED',

  // =========================================================================
  // Execution Errors (ROLLUP_EXEC_*)
  // =========================================================================
  /** General execution error */
  EXEC_ERROR: 'ROLLUP_EXEC_ERROR',
  /** Execution failed */
  EXEC_FAILED: 'ROLLUP_EXEC_FAILED',
  /** Execution timeout */
  EXEC_TIMEOUT: 'ROLLUP_EXEC_TIMEOUT',
  /** Execution cancelled */
  EXEC_CANCELLED: 'ROLLUP_EXEC_CANCELLED',
  /** Execution already in progress */
  EXEC_IN_PROGRESS: 'ROLLUP_EXEC_IN_PROGRESS',
  /** Fetch phase failed */
  EXEC_FETCH_FAILED: 'ROLLUP_EXEC_FETCH_FAILED',
  /** Matching phase failed */
  EXEC_MATCH_FAILED: 'ROLLUP_EXEC_MATCH_FAILED',
  /** Merge phase failed */
  EXEC_MERGE_FAILED: 'ROLLUP_EXEC_MERGE_FAILED',
  /** Storage phase failed */
  EXEC_STORE_FAILED: 'ROLLUP_EXEC_STORE_FAILED',
  /** Callback delivery failed */
  EXEC_CALLBACK_FAILED: 'ROLLUP_EXEC_CALLBACK_FAILED',

  // =========================================================================
  // Matching Errors (ROLLUP_MATCH_*)
  // =========================================================================
  /** General matching error */
  MATCH_ERROR: 'ROLLUP_MATCH_ERROR',
  /** No matches found */
  MATCH_NONE_FOUND: 'ROLLUP_MATCH_NONE_FOUND',
  /** Matcher not supported */
  MATCH_NOT_SUPPORTED: 'ROLLUP_MATCH_NOT_SUPPORTED',
  /** Low confidence matches */
  MATCH_LOW_CONFIDENCE: 'ROLLUP_MATCH_LOW_CONFIDENCE',
  /** Ambiguous matches */
  MATCH_AMBIGUOUS: 'ROLLUP_MATCH_AMBIGUOUS',

  // =========================================================================
  // Merge Errors (ROLLUP_MERGE_*)
  // =========================================================================
  /** General merge error */
  MERGE_ERROR: 'ROLLUP_MERGE_ERROR',
  /** Merge conflict */
  MERGE_CONFLICT: 'ROLLUP_MERGE_CONFLICT',
  /** Merge validation failed */
  MERGE_VALIDATION_FAILED: 'ROLLUP_MERGE_VALIDATION_FAILED',
  /** Cyclic dependency detected */
  MERGE_CYCLIC_DEPENDENCY: 'ROLLUP_MERGE_CYCLIC_DEPENDENCY',
  /** Invalid edge created */
  MERGE_INVALID_EDGE: 'ROLLUP_MERGE_INVALID_EDGE',

  // =========================================================================
  // Blast Radius Errors (ROLLUP_BLAST_*)
  // =========================================================================
  /** General blast radius error */
  BLAST_ERROR: 'ROLLUP_BLAST_ERROR',
  /** Blast radius exceeded limit */
  BLAST_EXCEEDED: 'ROLLUP_BLAST_EXCEEDED',
  /** No graph data available */
  BLAST_NO_DATA: 'ROLLUP_BLAST_NO_DATA',
  /** Traversal depth exceeded */
  BLAST_DEPTH_EXCEEDED: 'ROLLUP_BLAST_DEPTH_EXCEEDED',

  // =========================================================================
  // Limit Errors (ROLLUP_LIMIT_*)
  // =========================================================================
  /** Max nodes exceeded */
  LIMIT_MAX_NODES: 'ROLLUP_LIMIT_MAX_NODES',
  /** Max repositories exceeded */
  LIMIT_MAX_REPOS: 'ROLLUP_LIMIT_MAX_REPOS',
  /** Max matchers exceeded */
  LIMIT_MAX_MATCHERS: 'ROLLUP_LIMIT_MAX_MATCHERS',
  /** Max concurrent executions exceeded */
  LIMIT_MAX_CONCURRENT: 'ROLLUP_LIMIT_MAX_CONCURRENT',
  /** Rate limit exceeded */
  LIMIT_RATE: 'ROLLUP_LIMIT_RATE',
  /** Quota exceeded */
  LIMIT_QUOTA: 'ROLLUP_LIMIT_QUOTA',

  // =========================================================================
  // Permission Errors (ROLLUP_PERM_*)
  // =========================================================================
  /** Permission denied */
  PERM_DENIED: 'ROLLUP_PERM_DENIED',
  /** Repository access denied */
  PERM_REPO_ACCESS: 'ROLLUP_PERM_REPO_ACCESS',
  /** Scan access denied */
  PERM_SCAN_ACCESS: 'ROLLUP_PERM_SCAN_ACCESS',
  /** Insufficient privileges */
  PERM_INSUFFICIENT: 'ROLLUP_PERM_INSUFFICIENT',

  // =========================================================================
  // Infrastructure Errors (ROLLUP_INFRA_*)
  // =========================================================================
  /** Database error */
  INFRA_DATABASE: 'ROLLUP_INFRA_DATABASE',
  /** Connection error */
  INFRA_CONNECTION: 'ROLLUP_INFRA_CONNECTION',
  /** External service error */
  INFRA_EXTERNAL: 'ROLLUP_INFRA_EXTERNAL',
  /** Queue error */
  INFRA_QUEUE: 'ROLLUP_INFRA_QUEUE',
  /** Cache error */
  INFRA_CACHE: 'ROLLUP_INFRA_CACHE',

  // =========================================================================
  // State Errors (ROLLUP_STATE_*)
  // =========================================================================
  /** Invalid state transition */
  STATE_INVALID_TRANSITION: 'ROLLUP_STATE_INVALID_TRANSITION',
  /** Rollup is archived */
  STATE_ARCHIVED: 'ROLLUP_STATE_ARCHIVED',
  /** Rollup is disabled */
  STATE_DISABLED: 'ROLLUP_STATE_DISABLED',
} as const;

export type RollupErrorCodeType = typeof RollupErrorCode[keyof typeof RollupErrorCode];

// ============================================================================
// Error Messages
// ============================================================================

/**
 * User-friendly error messages for each error code
 */
export const RollupErrorMessage: Record<RollupErrorCodeType, string> = {
  // General
  [RollupErrorCode.GEN_ERROR]: 'An error occurred during the rollup operation.',
  [RollupErrorCode.GEN_NOT_SUPPORTED]: 'This operation is not supported.',
  [RollupErrorCode.GEN_INTERNAL]: 'An internal error occurred. Please try again later.',

  // Validation
  [RollupErrorCode.VAL_ERROR]: 'Validation failed for the rollup configuration.',
  [RollupErrorCode.VAL_INVALID_CONFIG]: 'The rollup configuration is invalid.',
  [RollupErrorCode.VAL_INVALID_MATCHER]: 'One or more matcher configurations are invalid.',
  [RollupErrorCode.VAL_INVALID_MERGE_OPTIONS]: 'The merge options are invalid.',
  [RollupErrorCode.VAL_MISSING_FIELD]: 'A required field is missing.',
  [RollupErrorCode.VAL_INVALID_FIELD]: 'A field value is invalid.',
  [RollupErrorCode.VAL_INVALID_ARN_PATTERN]: 'The ARN pattern is malformed or invalid.',
  [RollupErrorCode.VAL_INVALID_REGEX]: 'The regular expression pattern is invalid.',
  [RollupErrorCode.VAL_INVALID_CRON]: 'The cron expression is invalid.',
  [RollupErrorCode.VAL_INSUFFICIENT_REPOS]: 'At least two repositories are required for a rollup.',

  // Resource
  [RollupErrorCode.RES_NOT_FOUND]: 'The specified rollup was not found.',
  [RollupErrorCode.RES_ALREADY_EXISTS]: 'A rollup with this name already exists.',
  [RollupErrorCode.RES_EXEC_NOT_FOUND]: 'The specified execution was not found.',
  [RollupErrorCode.RES_REPO_NOT_FOUND]: 'One or more specified repositories were not found.',
  [RollupErrorCode.RES_SCAN_NOT_FOUND]: 'One or more specified scans were not found.',
  [RollupErrorCode.RES_GRAPH_NOT_FOUND]: 'The dependency graph was not found.',
  [RollupErrorCode.RES_VERSION_CONFLICT]: 'The rollup was modified by another operation. Please refresh and try again.',
  [RollupErrorCode.RES_LOCKED]: 'The resource is currently locked by another operation.',

  // Execution
  [RollupErrorCode.EXEC_ERROR]: 'The rollup execution encountered an error.',
  [RollupErrorCode.EXEC_FAILED]: 'The rollup execution failed.',
  [RollupErrorCode.EXEC_TIMEOUT]: 'The rollup execution timed out.',
  [RollupErrorCode.EXEC_CANCELLED]: 'The rollup execution was cancelled.',
  [RollupErrorCode.EXEC_IN_PROGRESS]: 'A rollup execution is already in progress.',
  [RollupErrorCode.EXEC_FETCH_FAILED]: 'Failed to fetch source graphs from repositories.',
  [RollupErrorCode.EXEC_MATCH_FAILED]: 'Failed during the node matching phase.',
  [RollupErrorCode.EXEC_MERGE_FAILED]: 'Failed during the graph merge phase.',
  [RollupErrorCode.EXEC_STORE_FAILED]: 'Failed to store the rollup results.',
  [RollupErrorCode.EXEC_CALLBACK_FAILED]: 'Failed to deliver the execution callback.',

  // Matching
  [RollupErrorCode.MATCH_ERROR]: 'An error occurred during node matching.',
  [RollupErrorCode.MATCH_NONE_FOUND]: 'No matching nodes were found across repositories.',
  [RollupErrorCode.MATCH_NOT_SUPPORTED]: 'The matching strategy is not supported.',
  [RollupErrorCode.MATCH_LOW_CONFIDENCE]: 'All matches have low confidence scores.',
  [RollupErrorCode.MATCH_AMBIGUOUS]: 'Ambiguous matches detected. Multiple nodes match with similar confidence.',

  // Merge
  [RollupErrorCode.MERGE_ERROR]: 'An error occurred during graph merging.',
  [RollupErrorCode.MERGE_CONFLICT]: 'A merge conflict was detected between nodes.',
  [RollupErrorCode.MERGE_VALIDATION_FAILED]: 'The merged graph failed validation.',
  [RollupErrorCode.MERGE_CYCLIC_DEPENDENCY]: 'A cyclic dependency was detected in the merged graph.',
  [RollupErrorCode.MERGE_INVALID_EDGE]: 'An invalid edge was created during merge.',

  // Blast Radius
  [RollupErrorCode.BLAST_ERROR]: 'An error occurred during blast radius analysis.',
  [RollupErrorCode.BLAST_EXCEEDED]: 'The blast radius exceeds the configured limit.',
  [RollupErrorCode.BLAST_NO_DATA]: 'No graph data is available for blast radius analysis.',
  [RollupErrorCode.BLAST_DEPTH_EXCEEDED]: 'The traversal depth limit was exceeded.',

  // Limits
  [RollupErrorCode.LIMIT_MAX_NODES]: 'The maximum number of nodes has been exceeded.',
  [RollupErrorCode.LIMIT_MAX_REPOS]: 'The maximum number of repositories has been exceeded.',
  [RollupErrorCode.LIMIT_MAX_MATCHERS]: 'The maximum number of matchers has been exceeded.',
  [RollupErrorCode.LIMIT_MAX_CONCURRENT]: 'The maximum number of concurrent executions has been reached.',
  [RollupErrorCode.LIMIT_RATE]: 'Rate limit exceeded. Please try again later.',
  [RollupErrorCode.LIMIT_QUOTA]: 'Your rollup quota has been exceeded.',

  // Permissions
  [RollupErrorCode.PERM_DENIED]: 'Permission denied for this operation.',
  [RollupErrorCode.PERM_REPO_ACCESS]: 'Access denied to one or more repositories.',
  [RollupErrorCode.PERM_SCAN_ACCESS]: 'Access denied to one or more scans.',
  [RollupErrorCode.PERM_INSUFFICIENT]: 'Insufficient privileges for this operation.',

  // Infrastructure
  [RollupErrorCode.INFRA_DATABASE]: 'A database error occurred.',
  [RollupErrorCode.INFRA_CONNECTION]: 'A connection error occurred.',
  [RollupErrorCode.INFRA_EXTERNAL]: 'An external service error occurred.',
  [RollupErrorCode.INFRA_QUEUE]: 'A job queue error occurred.',
  [RollupErrorCode.INFRA_CACHE]: 'A cache error occurred.',

  // State
  [RollupErrorCode.STATE_INVALID_TRANSITION]: 'Invalid state transition.',
  [RollupErrorCode.STATE_ARCHIVED]: 'The rollup is archived and cannot be modified.',
  [RollupErrorCode.STATE_DISABLED]: 'The rollup is disabled.',
};

// ============================================================================
// Error Severity Mapping
// ============================================================================

/**
 * Severity level for each error code
 */
export const RollupErrorSeverityMap: Record<RollupErrorCodeType, RollupErrorSeverity> = {
  // General
  [RollupErrorCode.GEN_ERROR]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.GEN_NOT_SUPPORTED]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.GEN_INTERNAL]: RollupErrorSeverity.CRITICAL,

  // Validation
  [RollupErrorCode.VAL_ERROR]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INVALID_CONFIG]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INVALID_MATCHER]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INVALID_MERGE_OPTIONS]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_MISSING_FIELD]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INVALID_FIELD]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INVALID_ARN_PATTERN]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INVALID_REGEX]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INVALID_CRON]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.VAL_INSUFFICIENT_REPOS]: RollupErrorSeverity.ERROR,

  // Resource
  [RollupErrorCode.RES_NOT_FOUND]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.RES_ALREADY_EXISTS]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.RES_EXEC_NOT_FOUND]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.RES_REPO_NOT_FOUND]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.RES_SCAN_NOT_FOUND]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.RES_GRAPH_NOT_FOUND]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.RES_VERSION_CONFLICT]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.RES_LOCKED]: RollupErrorSeverity.WARNING,

  // Execution
  [RollupErrorCode.EXEC_ERROR]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.EXEC_FAILED]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.EXEC_TIMEOUT]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.EXEC_CANCELLED]: RollupErrorSeverity.INFO,
  [RollupErrorCode.EXEC_IN_PROGRESS]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.EXEC_FETCH_FAILED]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.EXEC_MATCH_FAILED]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.EXEC_MERGE_FAILED]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.EXEC_STORE_FAILED]: RollupErrorSeverity.CRITICAL,
  [RollupErrorCode.EXEC_CALLBACK_FAILED]: RollupErrorSeverity.WARNING,

  // Matching
  [RollupErrorCode.MATCH_ERROR]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.MATCH_NONE_FOUND]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.MATCH_NOT_SUPPORTED]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.MATCH_LOW_CONFIDENCE]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.MATCH_AMBIGUOUS]: RollupErrorSeverity.WARNING,

  // Merge
  [RollupErrorCode.MERGE_ERROR]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.MERGE_CONFLICT]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.MERGE_VALIDATION_FAILED]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.MERGE_CYCLIC_DEPENDENCY]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.MERGE_INVALID_EDGE]: RollupErrorSeverity.ERROR,

  // Blast Radius
  [RollupErrorCode.BLAST_ERROR]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.BLAST_EXCEEDED]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.BLAST_NO_DATA]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.BLAST_DEPTH_EXCEEDED]: RollupErrorSeverity.WARNING,

  // Limits
  [RollupErrorCode.LIMIT_MAX_NODES]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.LIMIT_MAX_REPOS]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.LIMIT_MAX_MATCHERS]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.LIMIT_MAX_CONCURRENT]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.LIMIT_RATE]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.LIMIT_QUOTA]: RollupErrorSeverity.WARNING,

  // Permissions
  [RollupErrorCode.PERM_DENIED]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.PERM_REPO_ACCESS]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.PERM_SCAN_ACCESS]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.PERM_INSUFFICIENT]: RollupErrorSeverity.WARNING,

  // Infrastructure
  [RollupErrorCode.INFRA_DATABASE]: RollupErrorSeverity.CRITICAL,
  [RollupErrorCode.INFRA_CONNECTION]: RollupErrorSeverity.CRITICAL,
  [RollupErrorCode.INFRA_EXTERNAL]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.INFRA_QUEUE]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.INFRA_CACHE]: RollupErrorSeverity.WARNING,

  // State
  [RollupErrorCode.STATE_INVALID_TRANSITION]: RollupErrorSeverity.ERROR,
  [RollupErrorCode.STATE_ARCHIVED]: RollupErrorSeverity.WARNING,
  [RollupErrorCode.STATE_DISABLED]: RollupErrorSeverity.WARNING,
};

// ============================================================================
// Suggested Actions
// ============================================================================

/**
 * Suggested user actions for each error code
 */
export const RollupErrorAction: Record<RollupErrorCodeType, string> = {
  // General
  [RollupErrorCode.GEN_ERROR]: 'Review the error details and retry the operation.',
  [RollupErrorCode.GEN_NOT_SUPPORTED]: 'Check the documentation for supported operations.',
  [RollupErrorCode.GEN_INTERNAL]: 'If the problem persists, contact support.',

  // Validation
  [RollupErrorCode.VAL_ERROR]: 'Review and correct the configuration.',
  [RollupErrorCode.VAL_INVALID_CONFIG]: 'Verify all configuration fields are correct.',
  [RollupErrorCode.VAL_INVALID_MATCHER]: 'Review matcher configurations and correct any errors.',
  [RollupErrorCode.VAL_INVALID_MERGE_OPTIONS]: 'Review merge options and correct any errors.',
  [RollupErrorCode.VAL_MISSING_FIELD]: 'Add the required field to your request.',
  [RollupErrorCode.VAL_INVALID_FIELD]: 'Correct the invalid field value.',
  [RollupErrorCode.VAL_INVALID_ARN_PATTERN]: 'Verify the ARN pattern follows AWS ARN format.',
  [RollupErrorCode.VAL_INVALID_REGEX]: 'Verify the regex pattern is syntactically correct.',
  [RollupErrorCode.VAL_INVALID_CRON]: 'Verify the cron expression follows standard cron format.',
  [RollupErrorCode.VAL_INSUFFICIENT_REPOS]: 'Add at least two repositories to the rollup.',

  // Resource
  [RollupErrorCode.RES_NOT_FOUND]: 'Verify the rollup ID is correct.',
  [RollupErrorCode.RES_ALREADY_EXISTS]: 'Use a different name or update the existing rollup.',
  [RollupErrorCode.RES_EXEC_NOT_FOUND]: 'Verify the execution ID is correct.',
  [RollupErrorCode.RES_REPO_NOT_FOUND]: 'Verify all repository IDs are correct and accessible.',
  [RollupErrorCode.RES_SCAN_NOT_FOUND]: 'Verify all scan IDs are correct or run new scans.',
  [RollupErrorCode.RES_GRAPH_NOT_FOUND]: 'Run a scan on the repository to generate the graph.',
  [RollupErrorCode.RES_VERSION_CONFLICT]: 'Refresh the rollup data and retry your changes.',
  [RollupErrorCode.RES_LOCKED]: 'Wait for the current operation to complete.',

  // Execution
  [RollupErrorCode.EXEC_ERROR]: 'Review the error details and retry the execution.',
  [RollupErrorCode.EXEC_FAILED]: 'Check the error details and fix any configuration issues.',
  [RollupErrorCode.EXEC_TIMEOUT]: 'Try reducing the scope or increasing the timeout.',
  [RollupErrorCode.EXEC_CANCELLED]: 'Start a new execution when ready.',
  [RollupErrorCode.EXEC_IN_PROGRESS]: 'Wait for the current execution to complete.',
  [RollupErrorCode.EXEC_FETCH_FAILED]: 'Verify repository access and scan availability.',
  [RollupErrorCode.EXEC_MATCH_FAILED]: 'Review matcher configurations.',
  [RollupErrorCode.EXEC_MERGE_FAILED]: 'Review merge options and conflict resolution settings.',
  [RollupErrorCode.EXEC_STORE_FAILED]: 'Retry the execution. Contact support if persists.',
  [RollupErrorCode.EXEC_CALLBACK_FAILED]: 'Verify the callback URL is accessible.',

  // Matching
  [RollupErrorCode.MATCH_ERROR]: 'Review matcher configurations and retry.',
  [RollupErrorCode.MATCH_NONE_FOUND]: 'Adjust matcher configurations or add more matchers.',
  [RollupErrorCode.MATCH_NOT_SUPPORTED]: 'Use a supported matching strategy.',
  [RollupErrorCode.MATCH_LOW_CONFIDENCE]: 'Lower the minimum confidence threshold or adjust patterns.',
  [RollupErrorCode.MATCH_AMBIGUOUS]: 'Add more specific matchers or adjust priorities.',

  // Merge
  [RollupErrorCode.MERGE_ERROR]: 'Review merge options and retry.',
  [RollupErrorCode.MERGE_CONFLICT]: 'Change conflict resolution strategy or resolve manually.',
  [RollupErrorCode.MERGE_VALIDATION_FAILED]: 'Review the merged graph for invalid structures.',
  [RollupErrorCode.MERGE_CYCLIC_DEPENDENCY]: 'Review cross-repo edges for unintended cycles.',
  [RollupErrorCode.MERGE_INVALID_EDGE]: 'Review edge type preservation settings.',

  // Blast Radius
  [RollupErrorCode.BLAST_ERROR]: 'Retry the analysis with fewer nodes.',
  [RollupErrorCode.BLAST_EXCEEDED]: 'Reduce the blast radius limit or scope the analysis.',
  [RollupErrorCode.BLAST_NO_DATA]: 'Execute the rollup before analyzing blast radius.',
  [RollupErrorCode.BLAST_DEPTH_EXCEEDED]: 'Reduce the maximum traversal depth.',

  // Limits
  [RollupErrorCode.LIMIT_MAX_NODES]: 'Reduce the scope or use node type filters.',
  [RollupErrorCode.LIMIT_MAX_REPOS]: 'Reduce the number of repositories.',
  [RollupErrorCode.LIMIT_MAX_MATCHERS]: 'Consolidate or remove some matchers.',
  [RollupErrorCode.LIMIT_MAX_CONCURRENT]: 'Wait for running executions to complete.',
  [RollupErrorCode.LIMIT_RATE]: 'Wait before making more requests.',
  [RollupErrorCode.LIMIT_QUOTA]: 'Contact support to increase your quota.',

  // Permissions
  [RollupErrorCode.PERM_DENIED]: 'Request access from an administrator.',
  [RollupErrorCode.PERM_REPO_ACCESS]: 'Request access to the required repositories.',
  [RollupErrorCode.PERM_SCAN_ACCESS]: 'Request access to the required scans.',
  [RollupErrorCode.PERM_INSUFFICIENT]: 'Contact an administrator for elevated privileges.',

  // Infrastructure
  [RollupErrorCode.INFRA_DATABASE]: 'Retry the operation. Contact support if persists.',
  [RollupErrorCode.INFRA_CONNECTION]: 'Check your network connection and retry.',
  [RollupErrorCode.INFRA_EXTERNAL]: 'Retry the operation. The external service may be unavailable.',
  [RollupErrorCode.INFRA_QUEUE]: 'Retry the operation. Contact support if persists.',
  [RollupErrorCode.INFRA_CACHE]: 'Retry the operation.',

  // State
  [RollupErrorCode.STATE_INVALID_TRANSITION]: 'Check the current state before performing this action.',
  [RollupErrorCode.STATE_ARCHIVED]: 'Restore the rollup from archive first.',
  [RollupErrorCode.STATE_DISABLED]: 'Enable the rollup first.',
};

// ============================================================================
// HTTP Status Code Mapping
// ============================================================================

/**
 * HTTP status code for each error code
 */
export const RollupErrorHttpStatus: Record<RollupErrorCodeType, number> = {
  // General (500)
  [RollupErrorCode.GEN_ERROR]: 500,
  [RollupErrorCode.GEN_NOT_SUPPORTED]: 501,
  [RollupErrorCode.GEN_INTERNAL]: 500,

  // Validation (400)
  [RollupErrorCode.VAL_ERROR]: 400,
  [RollupErrorCode.VAL_INVALID_CONFIG]: 400,
  [RollupErrorCode.VAL_INVALID_MATCHER]: 400,
  [RollupErrorCode.VAL_INVALID_MERGE_OPTIONS]: 400,
  [RollupErrorCode.VAL_MISSING_FIELD]: 400,
  [RollupErrorCode.VAL_INVALID_FIELD]: 400,
  [RollupErrorCode.VAL_INVALID_ARN_PATTERN]: 400,
  [RollupErrorCode.VAL_INVALID_REGEX]: 400,
  [RollupErrorCode.VAL_INVALID_CRON]: 400,
  [RollupErrorCode.VAL_INSUFFICIENT_REPOS]: 400,

  // Resource (404/409)
  [RollupErrorCode.RES_NOT_FOUND]: 404,
  [RollupErrorCode.RES_ALREADY_EXISTS]: 409,
  [RollupErrorCode.RES_EXEC_NOT_FOUND]: 404,
  [RollupErrorCode.RES_REPO_NOT_FOUND]: 404,
  [RollupErrorCode.RES_SCAN_NOT_FOUND]: 404,
  [RollupErrorCode.RES_GRAPH_NOT_FOUND]: 404,
  [RollupErrorCode.RES_VERSION_CONFLICT]: 409,
  [RollupErrorCode.RES_LOCKED]: 423,

  // Execution (500/504)
  [RollupErrorCode.EXEC_ERROR]: 500,
  [RollupErrorCode.EXEC_FAILED]: 500,
  [RollupErrorCode.EXEC_TIMEOUT]: 504,
  [RollupErrorCode.EXEC_CANCELLED]: 200,
  [RollupErrorCode.EXEC_IN_PROGRESS]: 409,
  [RollupErrorCode.EXEC_FETCH_FAILED]: 502,
  [RollupErrorCode.EXEC_MATCH_FAILED]: 500,
  [RollupErrorCode.EXEC_MERGE_FAILED]: 500,
  [RollupErrorCode.EXEC_STORE_FAILED]: 500,
  [RollupErrorCode.EXEC_CALLBACK_FAILED]: 502,

  // Matching (422)
  [RollupErrorCode.MATCH_ERROR]: 422,
  [RollupErrorCode.MATCH_NONE_FOUND]: 422,
  [RollupErrorCode.MATCH_NOT_SUPPORTED]: 422,
  [RollupErrorCode.MATCH_LOW_CONFIDENCE]: 422,
  [RollupErrorCode.MATCH_AMBIGUOUS]: 422,

  // Merge (422)
  [RollupErrorCode.MERGE_ERROR]: 422,
  [RollupErrorCode.MERGE_CONFLICT]: 409,
  [RollupErrorCode.MERGE_VALIDATION_FAILED]: 422,
  [RollupErrorCode.MERGE_CYCLIC_DEPENDENCY]: 422,
  [RollupErrorCode.MERGE_INVALID_EDGE]: 422,

  // Blast Radius (422)
  [RollupErrorCode.BLAST_ERROR]: 422,
  [RollupErrorCode.BLAST_EXCEEDED]: 422,
  [RollupErrorCode.BLAST_NO_DATA]: 404,
  [RollupErrorCode.BLAST_DEPTH_EXCEEDED]: 422,

  // Limits (429)
  [RollupErrorCode.LIMIT_MAX_NODES]: 422,
  [RollupErrorCode.LIMIT_MAX_REPOS]: 422,
  [RollupErrorCode.LIMIT_MAX_MATCHERS]: 422,
  [RollupErrorCode.LIMIT_MAX_CONCURRENT]: 429,
  [RollupErrorCode.LIMIT_RATE]: 429,
  [RollupErrorCode.LIMIT_QUOTA]: 429,

  // Permissions (403)
  [RollupErrorCode.PERM_DENIED]: 403,
  [RollupErrorCode.PERM_REPO_ACCESS]: 403,
  [RollupErrorCode.PERM_SCAN_ACCESS]: 403,
  [RollupErrorCode.PERM_INSUFFICIENT]: 403,

  // Infrastructure (500/503)
  [RollupErrorCode.INFRA_DATABASE]: 500,
  [RollupErrorCode.INFRA_CONNECTION]: 503,
  [RollupErrorCode.INFRA_EXTERNAL]: 502,
  [RollupErrorCode.INFRA_QUEUE]: 503,
  [RollupErrorCode.INFRA_CACHE]: 500,

  // State (409)
  [RollupErrorCode.STATE_INVALID_TRANSITION]: 409,
  [RollupErrorCode.STATE_ARCHIVED]: 409,
  [RollupErrorCode.STATE_DISABLED]: 409,
};

// ============================================================================
// Retryability Mapping
// ============================================================================

/**
 * Whether each error code is retryable
 */
export const RollupErrorRetryable: Record<RollupErrorCodeType, boolean> = {
  // General
  [RollupErrorCode.GEN_ERROR]: true,
  [RollupErrorCode.GEN_NOT_SUPPORTED]: false,
  [RollupErrorCode.GEN_INTERNAL]: true,

  // Validation (never retryable - user must fix)
  [RollupErrorCode.VAL_ERROR]: false,
  [RollupErrorCode.VAL_INVALID_CONFIG]: false,
  [RollupErrorCode.VAL_INVALID_MATCHER]: false,
  [RollupErrorCode.VAL_INVALID_MERGE_OPTIONS]: false,
  [RollupErrorCode.VAL_MISSING_FIELD]: false,
  [RollupErrorCode.VAL_INVALID_FIELD]: false,
  [RollupErrorCode.VAL_INVALID_ARN_PATTERN]: false,
  [RollupErrorCode.VAL_INVALID_REGEX]: false,
  [RollupErrorCode.VAL_INVALID_CRON]: false,
  [RollupErrorCode.VAL_INSUFFICIENT_REPOS]: false,

  // Resource (mixed)
  [RollupErrorCode.RES_NOT_FOUND]: false,
  [RollupErrorCode.RES_ALREADY_EXISTS]: false,
  [RollupErrorCode.RES_EXEC_NOT_FOUND]: false,
  [RollupErrorCode.RES_REPO_NOT_FOUND]: false,
  [RollupErrorCode.RES_SCAN_NOT_FOUND]: false,
  [RollupErrorCode.RES_GRAPH_NOT_FOUND]: false,
  [RollupErrorCode.RES_VERSION_CONFLICT]: true,
  [RollupErrorCode.RES_LOCKED]: true,

  // Execution (mixed)
  [RollupErrorCode.EXEC_ERROR]: true,
  [RollupErrorCode.EXEC_FAILED]: true,
  [RollupErrorCode.EXEC_TIMEOUT]: true,
  [RollupErrorCode.EXEC_CANCELLED]: false,
  [RollupErrorCode.EXEC_IN_PROGRESS]: false,
  [RollupErrorCode.EXEC_FETCH_FAILED]: true,
  [RollupErrorCode.EXEC_MATCH_FAILED]: false,
  [RollupErrorCode.EXEC_MERGE_FAILED]: false,
  [RollupErrorCode.EXEC_STORE_FAILED]: true,
  [RollupErrorCode.EXEC_CALLBACK_FAILED]: true,

  // Matching (never retryable)
  [RollupErrorCode.MATCH_ERROR]: false,
  [RollupErrorCode.MATCH_NONE_FOUND]: false,
  [RollupErrorCode.MATCH_NOT_SUPPORTED]: false,
  [RollupErrorCode.MATCH_LOW_CONFIDENCE]: false,
  [RollupErrorCode.MATCH_AMBIGUOUS]: false,

  // Merge (never retryable)
  [RollupErrorCode.MERGE_ERROR]: false,
  [RollupErrorCode.MERGE_CONFLICT]: false,
  [RollupErrorCode.MERGE_VALIDATION_FAILED]: false,
  [RollupErrorCode.MERGE_CYCLIC_DEPENDENCY]: false,
  [RollupErrorCode.MERGE_INVALID_EDGE]: false,

  // Blast Radius (rarely retryable)
  [RollupErrorCode.BLAST_ERROR]: true,
  [RollupErrorCode.BLAST_EXCEEDED]: false,
  [RollupErrorCode.BLAST_NO_DATA]: false,
  [RollupErrorCode.BLAST_DEPTH_EXCEEDED]: false,

  // Limits (rate limit is retryable)
  [RollupErrorCode.LIMIT_MAX_NODES]: false,
  [RollupErrorCode.LIMIT_MAX_REPOS]: false,
  [RollupErrorCode.LIMIT_MAX_MATCHERS]: false,
  [RollupErrorCode.LIMIT_MAX_CONCURRENT]: true,
  [RollupErrorCode.LIMIT_RATE]: true,
  [RollupErrorCode.LIMIT_QUOTA]: false,

  // Permissions (never retryable)
  [RollupErrorCode.PERM_DENIED]: false,
  [RollupErrorCode.PERM_REPO_ACCESS]: false,
  [RollupErrorCode.PERM_SCAN_ACCESS]: false,
  [RollupErrorCode.PERM_INSUFFICIENT]: false,

  // Infrastructure (usually retryable)
  [RollupErrorCode.INFRA_DATABASE]: true,
  [RollupErrorCode.INFRA_CONNECTION]: true,
  [RollupErrorCode.INFRA_EXTERNAL]: true,
  [RollupErrorCode.INFRA_QUEUE]: true,
  [RollupErrorCode.INFRA_CACHE]: true,

  // State (never retryable)
  [RollupErrorCode.STATE_INVALID_TRANSITION]: false,
  [RollupErrorCode.STATE_ARCHIVED]: false,
  [RollupErrorCode.STATE_DISABLED]: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get complete error info for an error code
 */
export interface RollupErrorInfo {
  code: RollupErrorCodeType;
  message: string;
  severity: RollupErrorSeverity;
  action: string;
  httpStatus: number;
  isRetryable: boolean;
}

/**
 * Get all error information for a given code
 */
export function getRollupErrorInfo(code: RollupErrorCodeType): RollupErrorInfo {
  return {
    code,
    message: RollupErrorMessage[code],
    severity: RollupErrorSeverityMap[code],
    action: RollupErrorAction[code],
    httpStatus: RollupErrorHttpStatus[code],
    isRetryable: RollupErrorRetryable[code],
  };
}

/**
 * Check if an error code is a validation error
 */
export function isValidationError(code: string): boolean {
  return code.startsWith('ROLLUP_VAL_');
}

/**
 * Check if an error code is a resource error
 */
export function isResourceError(code: string): boolean {
  return code.startsWith('ROLLUP_RES_');
}

/**
 * Check if an error code is an execution error
 */
export function isExecutionError(code: string): boolean {
  return code.startsWith('ROLLUP_EXEC_');
}

/**
 * Check if an error code is an infrastructure error
 */
export function isInfrastructureError(code: string): boolean {
  return code.startsWith('ROLLUP_INFRA_');
}

/**
 * Check if an error code is a permission error
 */
export function isPermissionError(code: string): boolean {
  return code.startsWith('ROLLUP_PERM_');
}

/**
 * Check if an error code is a limit error
 */
export function isLimitError(code: string): boolean {
  return code.startsWith('ROLLUP_LIMIT_');
}

/**
 * Get error codes by severity
 */
export function getErrorCodesBySeverity(severity: RollupErrorSeverity): RollupErrorCodeType[] {
  return Object.entries(RollupErrorSeverityMap)
    .filter(([, s]) => s === severity)
    .map(([code]) => code as RollupErrorCodeType);
}

/**
 * Get all retryable error codes
 */
export function getRetryableErrorCodes(): RollupErrorCodeType[] {
  return Object.entries(RollupErrorRetryable)
    .filter(([, retryable]) => retryable)
    .map(([code]) => code as RollupErrorCodeType);
}
