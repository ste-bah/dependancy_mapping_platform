/**
 * Error Codes Enumeration
 * @module errors/codes
 *
 * Centralized error codes for the IaC dependency detection system.
 * Provides typed error codes for consistent error handling across the application.
 *
 * TASK-DETECT: Error handling infrastructure
 */

// ============================================================================
// Error Code Categories
// ============================================================================

/**
 * HTTP/API Error Codes (4xx, 5xx mapped)
 */
export const HttpErrorCodes = {
  // 400 Bad Request
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MALFORMED_REQUEST: 'MALFORMED_REQUEST',

  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  MISSING_AUTH: 'MISSING_AUTH',

  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',

  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',

  // 409 Conflict
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',

  // 422 Unprocessable Entity
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  SEMANTIC_ERROR: 'SEMANTIC_ERROR',

  // 429 Too Many Requests
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // 500 Internal Server Error
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',

  // 502 Bad Gateway
  BAD_GATEWAY: 'BAD_GATEWAY',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',

  // 503 Service Unavailable
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE: 'MAINTENANCE',

  // 504 Gateway Timeout
  TIMEOUT: 'TIMEOUT',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
} as const;

export type HttpErrorCode = typeof HttpErrorCodes[keyof typeof HttpErrorCodes];

/**
 * Parser Error Codes
 */
export const ParserErrorCodes = {
  // Lexer errors
  LEXER_ERROR: 'LEXER_ERROR',
  INVALID_TOKEN: 'INVALID_TOKEN',
  UNTERMINATED_STRING: 'UNTERMINATED_STRING',
  INVALID_ESCAPE_SEQUENCE: 'INVALID_ESCAPE_SEQUENCE',

  // Parser errors
  PARSE_ERROR: 'PARSE_ERROR',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  UNEXPECTED_TOKEN: 'UNEXPECTED_TOKEN',
  MISSING_REQUIRED: 'MISSING_REQUIRED',

  // File errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_ENCODING: 'UNSUPPORTED_ENCODING',
  FILE_READ_ERROR: 'FILE_READ_ERROR',

  // HCL-specific
  INVALID_HCL: 'INVALID_HCL',
  INVALID_BLOCK_TYPE: 'INVALID_BLOCK_TYPE',
  INVALID_ATTRIBUTE: 'INVALID_ATTRIBUTE',
  INVALID_EXPRESSION: 'INVALID_EXPRESSION',

  // YAML/Kubernetes-specific
  INVALID_YAML: 'INVALID_YAML',
  INVALID_MANIFEST: 'INVALID_MANIFEST',
  UNSUPPORTED_API_VERSION: 'UNSUPPORTED_API_VERSION',

  // Helm-specific
  INVALID_CHART: 'INVALID_CHART',
  INVALID_VALUES: 'INVALID_VALUES',
  TEMPLATE_ERROR: 'TEMPLATE_ERROR',
} as const;

export type ParserErrorCode = typeof ParserErrorCodes[keyof typeof ParserErrorCodes];

/**
 * Detection Error Codes
 */
export const DetectionErrorCodes = {
  // General detection errors
  DETECTION_ERROR: 'DETECTION_ERROR',
  DETECTION_TIMEOUT: 'DETECTION_TIMEOUT',
  DETECTION_CANCELLED: 'DETECTION_CANCELLED',

  // Reference errors
  UNRESOLVED_REFERENCE: 'UNRESOLVED_REFERENCE',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  AMBIGUOUS_REFERENCE: 'AMBIGUOUS_REFERENCE',

  // Module errors
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  MODULE_RESOLUTION_ERROR: 'MODULE_RESOLUTION_ERROR',
  REMOTE_MODULE_ERROR: 'REMOTE_MODULE_ERROR',

  // Dependency errors
  INVALID_DEPENDENCY: 'INVALID_DEPENDENCY',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',

  // Feature support
  UNSUPPORTED_FEATURE: 'UNSUPPORTED_FEATURE',
  UNSUPPORTED_PROVIDER: 'UNSUPPORTED_PROVIDER',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
} as const;

export type DetectionErrorCode = typeof DetectionErrorCodes[keyof typeof DetectionErrorCodes];

/**
 * Scoring Error Codes
 */
export const ScoringErrorCodes = {
  SCORING_ERROR: 'SCORING_ERROR',
  INVALID_EVIDENCE: 'INVALID_EVIDENCE',
  INVALID_RULE: 'INVALID_RULE',
  RULE_EVALUATION_ERROR: 'RULE_EVALUATION_ERROR',
  SCORE_CALCULATION_ERROR: 'SCORE_CALCULATION_ERROR',
} as const;

export type ScoringErrorCode = typeof ScoringErrorCodes[keyof typeof ScoringErrorCodes];

/**
 * Repository/Storage Error Codes
 */
export const RepositoryErrorCodes = {
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  QUERY_ERROR: 'QUERY_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',

  // Repository errors
  REPOSITORY_NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  REPOSITORY_ACCESS_DENIED: 'REPOSITORY_ACCESS_DENIED',
  REPOSITORY_UNAVAILABLE: 'REPOSITORY_UNAVAILABLE',

  // Clone/fetch errors
  CLONE_ERROR: 'CLONE_ERROR',
  FETCH_ERROR: 'FETCH_ERROR',
  CHECKOUT_ERROR: 'CHECKOUT_ERROR',
  INVALID_REF: 'INVALID_REF',
  REF_NOT_FOUND: 'REF_NOT_FOUND',

  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  OBJECT_NOT_FOUND: 'OBJECT_NOT_FOUND',
} as const;

export type RepositoryErrorCode = typeof RepositoryErrorCodes[keyof typeof RepositoryErrorCodes];

/**
 * Graph Error Codes
 */
export const GraphErrorCodes = {
  GRAPH_ERROR: 'GRAPH_ERROR',
  GRAPH_BUILD_ERROR: 'GRAPH_BUILD_ERROR',
  GRAPH_VALIDATION_ERROR: 'GRAPH_VALIDATION_ERROR',
  INVALID_NODE: 'INVALID_NODE',
  INVALID_EDGE: 'INVALID_EDGE',
  DANGLING_EDGE: 'DANGLING_EDGE',
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  EDGE_NOT_FOUND: 'EDGE_NOT_FOUND',
  TRAVERSAL_ERROR: 'TRAVERSAL_ERROR',
} as const;

export type GraphErrorCode = typeof GraphErrorCodes[keyof typeof GraphErrorCodes];

/**
 * External Service Error Codes
 */
export const ExternalServiceErrorCodes = {
  // Git provider errors
  GIT_PROVIDER_ERROR: 'GIT_PROVIDER_ERROR',
  GITHUB_ERROR: 'GITHUB_ERROR',
  GITLAB_ERROR: 'GITLAB_ERROR',
  BITBUCKET_ERROR: 'BITBUCKET_ERROR',

  // Registry errors
  REGISTRY_ERROR: 'REGISTRY_ERROR',
  TERRAFORM_REGISTRY_ERROR: 'TERRAFORM_REGISTRY_ERROR',
  DOCKER_REGISTRY_ERROR: 'DOCKER_REGISTRY_ERROR',
  HELM_REGISTRY_ERROR: 'HELM_REGISTRY_ERROR',

  // API errors
  API_ERROR: 'API_ERROR',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  DNS_ERROR: 'DNS_ERROR',
  SSL_ERROR: 'SSL_ERROR',

  // Webhook errors
  WEBHOOK_ERROR: 'WEBHOOK_ERROR',
  WEBHOOK_DELIVERY_FAILED: 'WEBHOOK_DELIVERY_FAILED',
  INVALID_WEBHOOK_SIGNATURE: 'INVALID_WEBHOOK_SIGNATURE',
} as const;

export type ExternalServiceErrorCode = typeof ExternalServiceErrorCodes[keyof typeof ExternalServiceErrorCodes];

/**
 * Scan Error Codes
 */
export const ScanErrorCodes = {
  SCAN_ERROR: 'SCAN_ERROR',
  SCAN_FAILED: 'SCAN_FAILED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  SCAN_CANCELLED: 'SCAN_CANCELLED',
  SCAN_NOT_FOUND: 'SCAN_NOT_FOUND',
  SCAN_ALREADY_RUNNING: 'SCAN_ALREADY_RUNNING',
  SCAN_LIMIT_EXCEEDED: 'SCAN_LIMIT_EXCEEDED',
  PARTIAL_SCAN_FAILURE: 'PARTIAL_SCAN_FAILURE',
} as const;

export type ScanErrorCode = typeof ScanErrorCodes[keyof typeof ScanErrorCodes];

/**
 * Documentation System Error Codes
 * TASK-FINAL-004: Documentation system error handling
 */
export const DocumentationErrorCodes = {
  // Documentation Page Errors
  PAGE_NOT_FOUND: 'DOC_PAGE_NOT_FOUND',
  INVALID_CATEGORY: 'DOC_INVALID_CATEGORY',
  SLUG_EXISTS: 'DOC_SLUG_EXISTS',
  INVALID_STATUS_TRANSITION: 'DOC_INVALID_STATUS_TRANSITION',
  PUBLISH_FAILED: 'DOC_PUBLISH_FAILED',
  PAGE_VERSION_CONFLICT: 'DOC_PAGE_VERSION_CONFLICT',
  INVALID_PAGE_CONTENT: 'DOC_INVALID_PAGE_CONTENT',
} as const;

export type DocumentationErrorCode = typeof DocumentationErrorCodes[keyof typeof DocumentationErrorCodes];

/**
 * Beta Customer Management Error Codes
 * TASK-FINAL-004: Beta customer onboarding error handling
 */
export const BetaCustomerErrorCodes = {
  // Beta Customer Errors
  CUSTOMER_NOT_FOUND: 'BETA_CUSTOMER_NOT_FOUND',
  EMAIL_EXISTS: 'BETA_EMAIL_EXISTS',
  NDA_NOT_SIGNED: 'BETA_NDA_NOT_SIGNED',
  INVALID_ONBOARDING_STATUS: 'BETA_INVALID_ONBOARDING_STATUS',
  ONBOARDING_INCOMPLETE: 'BETA_ONBOARDING_INCOMPLETE',
  CUSTOMER_ALREADY_ONBOARDED: 'BETA_CUSTOMER_ALREADY_ONBOARDED',
  INVALID_TIER: 'BETA_INVALID_TIER',
} as const;

export type BetaCustomerErrorCode = typeof BetaCustomerErrorCodes[keyof typeof BetaCustomerErrorCodes];

/**
 * Launch Checklist Error Codes
 * TASK-FINAL-004: Launch checklist error handling
 */
export const LaunchChecklistErrorCodes = {
  // Launch Checklist Errors
  ITEM_NOT_FOUND: 'LAUNCH_ITEM_NOT_FOUND',
  BLOCKED_BY_DEPENDENCY: 'LAUNCH_BLOCKED_BY_DEPENDENCY',
  CIRCULAR_DEPENDENCY: 'LAUNCH_CIRCULAR_DEPENDENCY',
  INVALID_TARGET_DATE: 'LAUNCH_INVALID_TARGET_DATE',
  ITEM_ALREADY_COMPLETED: 'LAUNCH_ITEM_ALREADY_COMPLETED',
  CATEGORY_NOT_FOUND: 'LAUNCH_CATEGORY_NOT_FOUND',
  INVALID_PRIORITY: 'LAUNCH_INVALID_PRIORITY',
} as const;

export type LaunchChecklistErrorCode = typeof LaunchChecklistErrorCodes[keyof typeof LaunchChecklistErrorCodes];

// ============================================================================
// Combined Error Codes
// ============================================================================

/**
 * All error codes combined
 */
export const ErrorCodes = {
  ...HttpErrorCodes,
  ...ParserErrorCodes,
  ...DetectionErrorCodes,
  ...ScoringErrorCodes,
  ...RepositoryErrorCodes,
  ...GraphErrorCodes,
  ...ExternalServiceErrorCodes,
  ...ScanErrorCodes,
  ...DocumentationErrorCodes,
  ...BetaCustomerErrorCodes,
  ...LaunchChecklistErrorCodes,
} as const;

export type ErrorCode =
  | HttpErrorCode
  | ParserErrorCode
  | DetectionErrorCode
  | ScoringErrorCode
  | RepositoryErrorCode
  | GraphErrorCode
  | ExternalServiceErrorCode
  | ScanErrorCode
  | DocumentationErrorCode
  | BetaCustomerErrorCode
  | LaunchChecklistErrorCode;

// ============================================================================
// Error Code Utilities
// ============================================================================

/**
 * Map error codes to HTTP status codes
 */
export const errorCodeToHttpStatus: Record<string, number> = {
  // 400
  [HttpErrorCodes.BAD_REQUEST]: 400,
  [HttpErrorCodes.VALIDATION_ERROR]: 400,
  [HttpErrorCodes.INVALID_INPUT]: 400,
  [HttpErrorCodes.MALFORMED_REQUEST]: 400,
  [ParserErrorCodes.PARSE_ERROR]: 400,
  [ParserErrorCodes.SYNTAX_ERROR]: 400,
  [ParserErrorCodes.INVALID_HCL]: 400,
  [ParserErrorCodes.INVALID_YAML]: 400,

  // 401
  [HttpErrorCodes.UNAUTHORIZED]: 401,
  [HttpErrorCodes.INVALID_TOKEN]: 401,
  [HttpErrorCodes.TOKEN_EXPIRED]: 401,
  [HttpErrorCodes.MISSING_AUTH]: 401,

  // 403
  [HttpErrorCodes.FORBIDDEN]: 403,
  [HttpErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,
  [HttpErrorCodes.RESOURCE_ACCESS_DENIED]: 403,
  [RepositoryErrorCodes.REPOSITORY_ACCESS_DENIED]: 403,

  // 404
  [HttpErrorCodes.NOT_FOUND]: 404,
  [HttpErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [HttpErrorCodes.ROUTE_NOT_FOUND]: 404,
  [RepositoryErrorCodes.REPOSITORY_NOT_FOUND]: 404,
  [ScanErrorCodes.SCAN_NOT_FOUND]: 404,
  [GraphErrorCodes.NODE_NOT_FOUND]: 404,

  // 409
  [HttpErrorCodes.CONFLICT]: 409,
  [HttpErrorCodes.DUPLICATE_RESOURCE]: 409,
  [HttpErrorCodes.CONCURRENT_MODIFICATION]: 409,
  [ScanErrorCodes.SCAN_ALREADY_RUNNING]: 409,

  // 422
  [HttpErrorCodes.UNPROCESSABLE_ENTITY]: 422,
  [HttpErrorCodes.SEMANTIC_ERROR]: 422,
  [DetectionErrorCodes.UNRESOLVED_REFERENCE]: 422,
  [DetectionErrorCodes.CIRCULAR_REFERENCE]: 422,

  // 429
  [HttpErrorCodes.RATE_LIMITED]: 429,
  [HttpErrorCodes.QUOTA_EXCEEDED]: 429,
  [ExternalServiceErrorCodes.API_RATE_LIMITED]: 429,
  [ScanErrorCodes.SCAN_LIMIT_EXCEEDED]: 429,

  // 500
  [HttpErrorCodes.INTERNAL_ERROR]: 500,
  [HttpErrorCodes.UNEXPECTED_ERROR]: 500,
  [RepositoryErrorCodes.DATABASE_ERROR]: 500,
  [GraphErrorCodes.GRAPH_ERROR]: 500,
  [ScoringErrorCodes.SCORING_ERROR]: 500,

  // 502
  [HttpErrorCodes.BAD_GATEWAY]: 502,
  [HttpErrorCodes.UPSTREAM_ERROR]: 502,
  [ExternalServiceErrorCodes.GIT_PROVIDER_ERROR]: 502,
  [ExternalServiceErrorCodes.REGISTRY_ERROR]: 502,

  // 503
  [HttpErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [HttpErrorCodes.MAINTENANCE]: 503,
  [RepositoryErrorCodes.REPOSITORY_UNAVAILABLE]: 503,
  [ExternalServiceErrorCodes.API_UNAVAILABLE]: 503,

  // 504
  [HttpErrorCodes.TIMEOUT]: 504,
  [HttpErrorCodes.GATEWAY_TIMEOUT]: 504,
  [DetectionErrorCodes.DETECTION_TIMEOUT]: 504,
  [ScanErrorCodes.SCAN_TIMEOUT]: 504,
  [ExternalServiceErrorCodes.CONNECTION_TIMEOUT]: 504,

  // Documentation System Errors (TASK-FINAL-004)
  [DocumentationErrorCodes.PAGE_NOT_FOUND]: 404,
  [DocumentationErrorCodes.INVALID_CATEGORY]: 400,
  [DocumentationErrorCodes.SLUG_EXISTS]: 409,
  [DocumentationErrorCodes.INVALID_STATUS_TRANSITION]: 400,
  [DocumentationErrorCodes.PUBLISH_FAILED]: 500,
  [DocumentationErrorCodes.PAGE_VERSION_CONFLICT]: 409,
  [DocumentationErrorCodes.INVALID_PAGE_CONTENT]: 400,

  // Beta Customer Errors (TASK-FINAL-004)
  [BetaCustomerErrorCodes.CUSTOMER_NOT_FOUND]: 404,
  [BetaCustomerErrorCodes.EMAIL_EXISTS]: 409,
  [BetaCustomerErrorCodes.NDA_NOT_SIGNED]: 400,
  [BetaCustomerErrorCodes.INVALID_ONBOARDING_STATUS]: 400,
  [BetaCustomerErrorCodes.ONBOARDING_INCOMPLETE]: 400,
  [BetaCustomerErrorCodes.CUSTOMER_ALREADY_ONBOARDED]: 409,
  [BetaCustomerErrorCodes.INVALID_TIER]: 400,

  // Launch Checklist Errors (TASK-FINAL-004)
  [LaunchChecklistErrorCodes.ITEM_NOT_FOUND]: 404,
  [LaunchChecklistErrorCodes.BLOCKED_BY_DEPENDENCY]: 409,
  [LaunchChecklistErrorCodes.CIRCULAR_DEPENDENCY]: 400,
  [LaunchChecklistErrorCodes.INVALID_TARGET_DATE]: 400,
  [LaunchChecklistErrorCodes.ITEM_ALREADY_COMPLETED]: 409,
  [LaunchChecklistErrorCodes.CATEGORY_NOT_FOUND]: 404,
  [LaunchChecklistErrorCodes.INVALID_PRIORITY]: 400,
};

/**
 * Get HTTP status code for an error code
 */
export function getHttpStatusForCode(code: string): number {
  return errorCodeToHttpStatus[code] ?? 500;
}

/**
 * Check if an error code represents a client error (4xx)
 */
export function isClientError(code: string): boolean {
  const status = getHttpStatusForCode(code);
  return status >= 400 && status < 500;
}

/**
 * Check if an error code represents a server error (5xx)
 */
export function isServerError(code: string): boolean {
  const status = getHttpStatusForCode(code);
  return status >= 500;
}

/**
 * Check if an error should be retried
 */
export function isRetryableError(code: string): boolean {
  const retryableCodes = new Set([
    HttpErrorCodes.TIMEOUT,
    HttpErrorCodes.GATEWAY_TIMEOUT,
    HttpErrorCodes.SERVICE_UNAVAILABLE,
    HttpErrorCodes.BAD_GATEWAY,
    RepositoryErrorCodes.CONNECTION_ERROR,
    ExternalServiceErrorCodes.NETWORK_ERROR,
    ExternalServiceErrorCodes.CONNECTION_TIMEOUT,
    ExternalServiceErrorCodes.API_UNAVAILABLE,
  ]);
  return retryableCodes.has(code);
}
