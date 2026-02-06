/**
 * Infrastructure Error Classes
 * @module errors/infrastructure
 *
 * Infrastructure-level error classes for external services, database,
 * and system-level failures.
 *
 * TASK-DETECT: Error handling infrastructure
 */

import { BaseError, ErrorContext } from './base';
import {
  ErrorCode,
  RepositoryErrorCodes,
  ExternalServiceErrorCodes,
  HttpErrorCodes,
} from './codes';

// ============================================================================
// Database Errors
// ============================================================================

/**
 * Base class for database-related errors
 */
export class DatabaseError extends BaseError {
  public readonly operation: string;

  constructor(
    message: string,
    operation: string,
    code: ErrorCode = RepositoryErrorCodes.DATABASE_ERROR,
    context: ErrorContext = {}
  ) {
    super(message, code, context, false); // Not operational - requires attention
    this.name = 'DatabaseError';
    this.operation = operation;
  }
}

/**
 * Database connection error
 */
export class ConnectionError extends DatabaseError {
  public readonly target: string;
  public readonly retryable: boolean;

  constructor(
    target: string,
    context: ErrorContext = {}
  ) {
    super(
      `Failed to connect to database: ${target}`,
      'connect',
      RepositoryErrorCodes.CONNECTION_ERROR,
      context
    );
    this.name = 'ConnectionError';
    this.target = target;
    this.retryable = true;
  }
}

/**
 * Database query error
 */
export class QueryError extends DatabaseError {
  public readonly query?: string;

  constructor(
    message: string,
    query?: string,
    context: ErrorContext = {}
  ) {
    super(message, 'query', RepositoryErrorCodes.QUERY_ERROR, context);
    this.name = 'QueryError';
    // Sanitize query to avoid exposing sensitive data
    this.query = query?.substring(0, 200);
  }
}

/**
 * Database transaction error
 */
export class TransactionError extends DatabaseError {
  public readonly transactionId?: string;

  constructor(
    message: string,
    transactionId?: string,
    context: ErrorContext = {}
  ) {
    super(message, 'transaction', RepositoryErrorCodes.TRANSACTION_ERROR, context);
    this.name = 'TransactionError';
    this.transactionId = transactionId;
  }
}

/**
 * Constraint violation error
 */
export class ConstraintViolationError extends DatabaseError {
  public readonly constraint: string;
  public readonly table?: string;

  constructor(
    constraint: string,
    table?: string,
    context: ErrorContext = {}
  ) {
    super(
      `Constraint violation: ${constraint}${table ? ` on table ${table}` : ''}`,
      'insert/update',
      RepositoryErrorCodes.CONSTRAINT_VIOLATION,
      context
    );
    this.name = 'ConstraintViolationError';
    this.constraint = constraint;
    this.table = table;
  }
}

// ============================================================================
// Repository/Git Errors
// ============================================================================

/**
 * Base class for repository-related errors
 */
export class RepositoryError extends BaseError {
  public readonly repositoryId?: string;

  constructor(
    message: string,
    code: ErrorCode = RepositoryErrorCodes.REPOSITORY_NOT_FOUND,
    repositoryId?: string,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'RepositoryError';
    this.repositoryId = repositoryId;
  }
}

/**
 * Repository not found error
 */
export class RepositoryNotFoundError extends RepositoryError {
  constructor(identifier: string, context: ErrorContext = {}) {
    super(
      `Repository not found: ${identifier}`,
      RepositoryErrorCodes.REPOSITORY_NOT_FOUND,
      identifier,
      context
    );
    this.name = 'RepositoryNotFoundError';
  }
}

/**
 * Repository access denied error
 */
export class RepositoryAccessDeniedError extends RepositoryError {
  constructor(repositoryId: string, reason?: string, context: ErrorContext = {}) {
    super(
      `Access denied to repository: ${repositoryId}${reason ? ` - ${reason}` : ''}`,
      RepositoryErrorCodes.REPOSITORY_ACCESS_DENIED,
      repositoryId,
      context
    );
    this.name = 'RepositoryAccessDeniedError';
  }
}

/**
 * Clone error
 */
export class CloneError extends RepositoryError {
  public readonly cloneUrl: string;

  constructor(
    repositoryId: string,
    cloneUrl: string,
    context: ErrorContext = {}
  ) {
    super(
      `Failed to clone repository: ${repositoryId}`,
      RepositoryErrorCodes.CLONE_ERROR,
      repositoryId,
      context
    );
    this.name = 'CloneError';
    this.cloneUrl = cloneUrl;
  }
}

/**
 * Invalid ref error (branch, tag, or commit)
 */
export class InvalidRefError extends RepositoryError {
  public readonly ref: string;

  constructor(
    repositoryId: string,
    ref: string,
    context: ErrorContext = {}
  ) {
    super(
      `Invalid ref '${ref}' for repository ${repositoryId}`,
      RepositoryErrorCodes.INVALID_REF,
      repositoryId,
      context
    );
    this.name = 'InvalidRefError';
    this.ref = ref;
  }
}

// ============================================================================
// External Service Errors
// ============================================================================

/**
 * Base class for external service errors
 */
export class ExternalServiceError extends BaseError {
  public readonly serviceName: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  constructor(
    serviceName: string,
    message: string,
    code: ErrorCode = ExternalServiceErrorCodes.API_ERROR,
    statusCode?: number,
    context: ErrorContext = {}
  ) {
    super(message, code, context, false); // Not operational - external issue
    this.name = 'ExternalServiceError';
    this.serviceName = serviceName;
    this.statusCode = statusCode;
    this.retryable = this.determineRetryability(statusCode);
    this.retryAfter = context.details?.retryAfter as number | undefined;
  }

  private determineRetryability(statusCode?: number): boolean {
    if (!statusCode) return true;
    // 5xx errors and 429 are typically retryable
    return statusCode >= 500 || statusCode === 429;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      serviceName: this.serviceName,
      statusCode: this.statusCode,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * GitHub API error
 */
export class GitHubError extends ExternalServiceError {
  constructor(message: string, statusCode?: number, context: ErrorContext = {}) {
    super('GitHub', message, ExternalServiceErrorCodes.GITHUB_ERROR, statusCode, context);
    this.name = 'GitHubError';
  }
}

/**
 * GitLab API error
 */
export class GitLabError extends ExternalServiceError {
  constructor(message: string, statusCode?: number, context: ErrorContext = {}) {
    super('GitLab', message, ExternalServiceErrorCodes.GITLAB_ERROR, statusCode, context);
    this.name = 'GitLabError';
  }
}

/**
 * Bitbucket API error
 */
export class BitbucketError extends ExternalServiceError {
  constructor(message: string, statusCode?: number, context: ErrorContext = {}) {
    super('Bitbucket', message, ExternalServiceErrorCodes.BITBUCKET_ERROR, statusCode, context);
    this.name = 'BitbucketError';
  }
}

/**
 * Registry error (Terraform, Docker, Helm)
 */
export class RegistryError extends ExternalServiceError {
  public readonly registryType: 'terraform' | 'docker' | 'helm';
  public readonly registryUrl?: string;

  constructor(
    registryType: 'terraform' | 'docker' | 'helm',
    message: string,
    registryUrl?: string,
    statusCode?: number,
    context: ErrorContext = {}
  ) {
    const codeMap = {
      terraform: ExternalServiceErrorCodes.TERRAFORM_REGISTRY_ERROR,
      docker: ExternalServiceErrorCodes.DOCKER_REGISTRY_ERROR,
      helm: ExternalServiceErrorCodes.HELM_REGISTRY_ERROR,
    };

    super(
      `${registryType}-registry`,
      message,
      codeMap[registryType],
      statusCode,
      context
    );
    this.name = 'RegistryError';
    this.registryType = registryType;
    this.registryUrl = registryUrl;
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends ExternalServiceError {
  constructor(
    serviceName: string,
    retryAfterSeconds: number,
    context: ErrorContext = {}
  ) {
    super(
      serviceName,
      `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`,
      ExternalServiceErrorCodes.API_RATE_LIMITED,
      429,
      { ...context, details: { ...context.details, retryAfter: retryAfterSeconds } }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Network error
 */
export class NetworkError extends ExternalServiceError {
  public readonly networkErrorType: 'timeout' | 'dns' | 'ssl' | 'connection' | 'unknown';

  constructor(
    serviceName: string,
    networkErrorType: 'timeout' | 'dns' | 'ssl' | 'connection' | 'unknown',
    context: ErrorContext = {}
  ) {
    const codeMap = {
      timeout: ExternalServiceErrorCodes.CONNECTION_TIMEOUT,
      dns: ExternalServiceErrorCodes.DNS_ERROR,
      ssl: ExternalServiceErrorCodes.SSL_ERROR,
      connection: ExternalServiceErrorCodes.NETWORK_ERROR,
      unknown: ExternalServiceErrorCodes.NETWORK_ERROR,
    };

    super(
      serviceName,
      `Network error (${networkErrorType}): Failed to connect to ${serviceName}`,
      codeMap[networkErrorType],
      undefined,
      context
    );
    this.name = 'NetworkError';
    this.networkErrorType = networkErrorType;
  }
}

/**
 * Webhook error
 */
export class WebhookError extends ExternalServiceError {
  public readonly webhookId?: string;
  public readonly eventType?: string;

  constructor(
    message: string,
    webhookId?: string,
    eventType?: string,
    context: ErrorContext = {}
  ) {
    super('webhook', message, ExternalServiceErrorCodes.WEBHOOK_ERROR, undefined, context);
    this.name = 'WebhookError';
    this.webhookId = webhookId;
    this.eventType = eventType;
  }
}

/**
 * Invalid webhook signature error
 */
export class InvalidWebhookSignatureError extends WebhookError {
  constructor(webhookId?: string, context: ErrorContext = {}) {
    super('Invalid webhook signature', webhookId, undefined, context);
    this.name = 'InvalidWebhookSignatureError';
  }
}

// ============================================================================
// Application Errors (HTTP-related)
// ============================================================================

/**
 * Not found error
 */
export class NotFoundError extends BaseError {
  public readonly resource: string;
  public readonly id?: string;

  constructor(resource: string, id?: string, context: ErrorContext = {}) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, HttpErrorCodes.NOT_FOUND, context, true);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}

/**
 * Validation error
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: ValidationFieldError[];

  constructor(
    message: string,
    errors: ValidationFieldError[] = [],
    context: ErrorContext = {}
  ) {
    super(message, HttpErrorCodes.VALIDATION_ERROR, context, true);
    this.name = 'ValidationError';
    this.validationErrors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors,
    };
  }
}

export interface ValidationFieldError {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends BaseError {
  constructor(message = 'Authentication required', context: ErrorContext = {}) {
    super(message, HttpErrorCodes.UNAUTHORIZED, context, true);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends BaseError {
  public readonly resource?: string;
  public readonly action?: string;

  constructor(resource?: string, action?: string, context: ErrorContext = {}) {
    const message =
      resource && action
        ? `Access denied: cannot ${action} ${resource}`
        : 'Access denied';
    super(message, HttpErrorCodes.FORBIDDEN, context, true);
    this.name = 'ForbiddenError';
    this.resource = resource;
    this.action = action;
  }
}

/**
 * Conflict error
 */
export class ConflictError extends BaseError {
  public readonly conflictingResource?: string;

  constructor(message: string, conflictingResource?: string, context: ErrorContext = {}) {
    super(message, HttpErrorCodes.CONFLICT, context, true);
    this.name = 'ConflictError';
    this.conflictingResource = conflictingResource;
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends BaseError {
  public readonly service: string;
  public readonly retryAfter?: number;

  constructor(service: string, retryAfter?: number, context: ErrorContext = {}) {
    super(
      `Service '${service}' is temporarily unavailable`,
      HttpErrorCodes.SERVICE_UNAVAILABLE,
      context,
      true
    );
    this.name = 'ServiceUnavailableError';
    this.service = service;
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

/**
 * Configuration error
 */
export class ConfigurationError extends BaseError {
  public readonly configKey: string;
  public readonly expectedType?: string;
  public readonly actualValue?: unknown;

  constructor(
    configKey: string,
    message?: string,
    context: ErrorContext = {}
  ) {
    super(
      message ?? `Invalid or missing configuration: ${configKey}`,
      HttpErrorCodes.INTERNAL_ERROR,
      context,
      false // Not operational - requires code/config fix
    );
    this.name = 'ConfigurationError';
    this.configKey = configKey;
  }

  static missing(configKey: string): ConfigurationError {
    return new ConfigurationError(configKey, `Missing required configuration: ${configKey}`);
  }

  static invalid(configKey: string, expectedType: string, actualValue: unknown): ConfigurationError {
    const error = new ConfigurationError(
      configKey,
      `Invalid configuration '${configKey}': expected ${expectedType}, got ${typeof actualValue}`
    );
    (error as { expectedType: string }).expectedType = expectedType;
    (error as { actualValue: unknown }).actualValue = actualValue;
    return error;
  }
}
