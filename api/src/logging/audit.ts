/**
 * Audit Logger
 * @module logging/audit
 *
 * Provides audit logging for compliance and security tracking.
 * Records user actions, access events, and configuration changes.
 *
 * TASK-DETECT: Logging infrastructure
 */

import { randomUUID } from 'crypto';
import { StructuredLogger, createLogger, getLogger } from './logger';
import { getRequestContext } from './request-context';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_LOGIN_FAILED = 'auth.login_failed',
  AUTH_TOKEN_ISSUED = 'auth.token_issued',
  AUTH_TOKEN_REVOKED = 'auth.token_revoked',
  AUTH_PASSWORD_CHANGED = 'auth.password_changed',
  AUTH_MFA_ENABLED = 'auth.mfa_enabled',
  AUTH_MFA_DISABLED = 'auth.mfa_disabled',

  // Authorization events
  AUTHZ_ACCESS_GRANTED = 'authz.access_granted',
  AUTHZ_ACCESS_DENIED = 'authz.access_denied',
  AUTHZ_PERMISSION_CHANGED = 'authz.permission_changed',
  AUTHZ_ROLE_ASSIGNED = 'authz.role_assigned',
  AUTHZ_ROLE_REVOKED = 'authz.role_revoked',

  // Resource events
  RESOURCE_CREATED = 'resource.created',
  RESOURCE_READ = 'resource.read',
  RESOURCE_UPDATED = 'resource.updated',
  RESOURCE_DELETED = 'resource.deleted',
  RESOURCE_EXPORTED = 'resource.exported',

  // Scan events
  SCAN_INITIATED = 'scan.initiated',
  SCAN_COMPLETED = 'scan.completed',
  SCAN_FAILED = 'scan.failed',
  SCAN_CANCELLED = 'scan.cancelled',

  // Repository events
  REPO_CONNECTED = 'repo.connected',
  REPO_DISCONNECTED = 'repo.disconnected',
  REPO_ACCESS_CONFIGURED = 'repo.access_configured',

  // API events
  API_KEY_CREATED = 'api.key_created',
  API_KEY_REVOKED = 'api.key_revoked',
  API_RATE_LIMITED = 'api.rate_limited',

  // Configuration events
  CONFIG_CHANGED = 'config.changed',
  CONFIG_IMPORTED = 'config.imported',
  CONFIG_EXPORTED = 'config.exported',

  // User management events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_SUSPENDED = 'user.suspended',
  USER_REACTIVATED = 'user.reactivated',

  // Organization events
  ORG_CREATED = 'org.created',
  ORG_UPDATED = 'org.updated',
  ORG_DELETED = 'org.deleted',
  ORG_MEMBER_ADDED = 'org.member_added',
  ORG_MEMBER_REMOVED = 'org.member_removed',

  // Data events
  DATA_EXPORTED = 'data.exported',
  DATA_IMPORTED = 'data.imported',
  DATA_PURGED = 'data.purged',

  // Security events
  SECURITY_ALERT = 'security.alert',
  SECURITY_INCIDENT = 'security.incident',
  SECURITY_SCAN_TRIGGERED = 'security.scan_triggered',
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Audit event outcome
 */
export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  UNKNOWN = 'unknown',
}

/**
 * Actor information (who performed the action)
 */
export interface AuditActor {
  /** User ID */
  id?: string;
  /** Username or email */
  username?: string;
  /** Actor type */
  type: 'user' | 'service' | 'system' | 'anonymous';
  /** IP address */
  ip?: string;
  /** User agent string */
  userAgent?: string;
  /** Session ID */
  sessionId?: string;
}

/**
 * Target information (what was affected)
 */
export interface AuditTarget {
  /** Target resource type */
  type: string;
  /** Target resource ID */
  id?: string;
  /** Target resource name */
  name?: string;
  /** Additional target identifiers */
  identifiers?: Record<string, string>;
}

/**
 * Audit event data
 */
export interface AuditEvent {
  /** Unique event ID */
  id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event type */
  eventType: AuditEventType;
  /** Event severity */
  severity: AuditSeverity;
  /** Event outcome */
  outcome: AuditOutcome;
  /** Actor who performed the action */
  actor: AuditActor;
  /** Target of the action */
  target?: AuditTarget;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Human-readable description */
  description: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Changes made (for update events) */
  changes?: AuditChange[];
  /** Source of the event */
  source?: {
    service: string;
    version: string;
    component?: string;
  };
}

/**
 * Represents a change in an audit event
 */
export interface AuditChange {
  /** Field that changed */
  field: string;
  /** Previous value (redacted if sensitive) */
  oldValue?: unknown;
  /** New value (redacted if sensitive) */
  newValue?: unknown;
}

/**
 * Options for creating an audit event
 */
export interface CreateAuditEventOptions {
  eventType: AuditEventType;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  actor?: Partial<AuditActor>;
  target?: AuditTarget;
  description: string;
  metadata?: Record<string, unknown>;
  changes?: AuditChange[];
}

// ============================================================================
// Audit Logger Class
// ============================================================================

/**
 * Audit logger for compliance and security tracking
 */
export class AuditLogger {
  private readonly logger: StructuredLogger;
  private readonly serviceName: string;
  private readonly serviceVersion: string;

  constructor(options?: { serviceName?: string; serviceVersion?: string }) {
    this.serviceName = options?.serviceName || process.env.SERVICE_NAME || 'iac-detector';
    this.serviceVersion = options?.serviceVersion || process.env.SERVICE_VERSION || '1.0.0';
    this.logger = createLogger('audit', { component: 'audit' });
  }

  /**
   * Records an audit event
   */
  async record(options: CreateAuditEventOptions): Promise<AuditEvent> {
    const requestContext = getRequestContext();

    const event: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      eventType: options.eventType,
      severity: options.severity || this.inferSeverity(options.eventType),
      outcome: options.outcome || AuditOutcome.SUCCESS,
      actor: this.buildActor(options.actor),
      target: options.target,
      tenantId: requestContext?.tenantId,
      requestId: requestContext?.requestId,
      traceId: requestContext?.traceId,
      description: options.description,
      metadata: this.sanitizeMetadata(options.metadata),
      changes: options.changes?.map((c) => this.sanitizeChange(c)),
      source: {
        service: this.serviceName,
        version: this.serviceVersion,
      },
    };

    // Log the audit event
    this.logEvent(event);

    // Store the event (implement actual persistence)
    await this.persistEvent(event);

    return event;
  }

  /**
   * Records a successful authentication
   */
  async authLogin(userId: string, username: string, metadata?: Record<string, unknown>): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.AUTH_LOGIN,
      severity: AuditSeverity.INFO,
      outcome: AuditOutcome.SUCCESS,
      actor: { id: userId, username, type: 'user' },
      description: `User ${username} logged in successfully`,
      metadata,
    });
  }

  /**
   * Records a failed authentication attempt
   */
  async authLoginFailed(username: string, reason: string, metadata?: Record<string, unknown>): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      severity: AuditSeverity.MEDIUM,
      outcome: AuditOutcome.FAILURE,
      actor: { username, type: 'anonymous' },
      description: `Login failed for ${username}: ${reason}`,
      metadata: { ...metadata, reason },
    });
  }

  /**
   * Records an access denied event
   */
  async accessDenied(
    resource: string,
    resourceId: string,
    requiredPermission: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.AUTHZ_ACCESS_DENIED,
      severity: AuditSeverity.MEDIUM,
      outcome: AuditOutcome.FAILURE,
      target: { type: resource, id: resourceId },
      description: `Access denied to ${resource}/${resourceId}: missing ${requiredPermission}`,
      metadata: { ...metadata, requiredPermission },
    });
  }

  /**
   * Records a resource creation event
   */
  async resourceCreated(
    resourceType: string,
    resourceId: string,
    resourceName?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.RESOURCE_CREATED,
      severity: AuditSeverity.INFO,
      target: { type: resourceType, id: resourceId, name: resourceName },
      description: `Created ${resourceType}${resourceName ? ` "${resourceName}"` : ''} (${resourceId})`,
      metadata,
    });
  }

  /**
   * Records a resource update event
   */
  async resourceUpdated(
    resourceType: string,
    resourceId: string,
    changes: AuditChange[],
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.RESOURCE_UPDATED,
      severity: AuditSeverity.INFO,
      target: { type: resourceType, id: resourceId },
      description: `Updated ${resourceType} (${resourceId}): ${changes.length} field(s) changed`,
      changes,
      metadata,
    });
  }

  /**
   * Records a resource deletion event
   */
  async resourceDeleted(
    resourceType: string,
    resourceId: string,
    resourceName?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.RESOURCE_DELETED,
      severity: AuditSeverity.MEDIUM,
      target: { type: resourceType, id: resourceId, name: resourceName },
      description: `Deleted ${resourceType}${resourceName ? ` "${resourceName}"` : ''} (${resourceId})`,
      metadata,
    });
  }

  /**
   * Records a scan initiation event
   */
  async scanInitiated(
    scanId: string,
    repositoryId: string,
    repositoryName?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.SCAN_INITIATED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'scan',
        id: scanId,
        identifiers: { repositoryId },
      },
      description: `Scan initiated for repository${repositoryName ? ` "${repositoryName}"` : ''} (${repositoryId})`,
      metadata: { ...metadata, repositoryId, repositoryName },
    });
  }

  /**
   * Records a scan completion event
   */
  async scanCompleted(
    scanId: string,
    repositoryId: string,
    results: { nodeCount: number; edgeCount: number; duration: number },
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.SCAN_COMPLETED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'scan',
        id: scanId,
        identifiers: { repositoryId },
      },
      description: `Scan completed: ${results.nodeCount} nodes, ${results.edgeCount} edges in ${results.duration}ms`,
      metadata: { ...metadata, ...results, repositoryId },
    });
  }

  /**
   * Records a configuration change event
   */
  async configChanged(
    configKey: string,
    changes: AuditChange[],
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.CONFIG_CHANGED,
      severity: AuditSeverity.HIGH,
      target: { type: 'configuration', id: configKey },
      description: `Configuration changed: ${configKey}`,
      changes,
      metadata,
    });
  }

  /**
   * Records a security alert
   */
  async securityAlert(
    alertType: string,
    description: string,
    severity: AuditSeverity = AuditSeverity.HIGH,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.SECURITY_ALERT,
      severity,
      description: `Security alert: ${alertType} - ${description}`,
      metadata: { ...metadata, alertType },
    });
  }

  /**
   * Records data export event
   */
  async dataExported(
    exportType: string,
    recordCount: number,
    format: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: AuditEventType.DATA_EXPORTED,
      severity: AuditSeverity.MEDIUM,
      target: { type: 'export', name: exportType },
      description: `Exported ${recordCount} ${exportType} records in ${format} format`,
      metadata: { ...metadata, recordCount, format, exportType },
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Builds the actor object from partial input and request context
   */
  private buildActor(partial?: Partial<AuditActor>): AuditActor {
    const requestContext = getRequestContext();

    return {
      id: partial?.id || requestContext?.userId,
      username: partial?.username,
      type: partial?.type || (requestContext?.userId ? 'user' : 'anonymous'),
      ip: partial?.ip,
      userAgent: partial?.userAgent,
      sessionId: partial?.sessionId,
    };
  }

  /**
   * Infers severity based on event type
   */
  private inferSeverity(eventType: AuditEventType): AuditSeverity {
    const severityMap: Partial<Record<AuditEventType, AuditSeverity>> = {
      [AuditEventType.AUTH_LOGIN_FAILED]: AuditSeverity.MEDIUM,
      [AuditEventType.AUTHZ_ACCESS_DENIED]: AuditSeverity.MEDIUM,
      [AuditEventType.RESOURCE_DELETED]: AuditSeverity.MEDIUM,
      [AuditEventType.CONFIG_CHANGED]: AuditSeverity.HIGH,
      [AuditEventType.API_KEY_REVOKED]: AuditSeverity.HIGH,
      [AuditEventType.USER_DELETED]: AuditSeverity.HIGH,
      [AuditEventType.DATA_PURGED]: AuditSeverity.HIGH,
      [AuditEventType.SECURITY_ALERT]: AuditSeverity.HIGH,
      [AuditEventType.SECURITY_INCIDENT]: AuditSeverity.CRITICAL,
    };

    return severityMap[eventType] || AuditSeverity.INFO;
  }

  /**
   * Sanitizes metadata to remove sensitive fields
   */
  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    const sensitiveFields = new Set([
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
      'accessToken',
      'refreshToken',
      'privateKey',
      'credentials',
    ]);

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveFields.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitizes a change object
   */
  private sanitizeChange(change: AuditChange): AuditChange {
    const sensitiveFields = new Set([
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
    ]);

    if (sensitiveFields.has(change.field.toLowerCase())) {
      return {
        field: change.field,
        oldValue: change.oldValue !== undefined ? '[REDACTED]' : undefined,
        newValue: change.newValue !== undefined ? '[REDACTED]' : undefined,
      };
    }

    return change;
  }

  /**
   * Logs the audit event using the structured logger
   */
  private logEvent(event: AuditEvent): void {
    const logData = {
      audit: true,
      auditId: event.id,
      eventType: event.eventType,
      severity: event.severity,
      outcome: event.outcome,
      actor: event.actor,
      target: event.target,
      tenantId: event.tenantId,
      requestId: event.requestId,
      traceId: event.traceId,
      changes: event.changes,
      metadata: event.metadata,
    };

    // Use appropriate log level based on severity
    switch (event.severity) {
      case AuditSeverity.CRITICAL:
        this.logger.fatal(logData, `[AUDIT] ${event.description}`);
        break;
      case AuditSeverity.HIGH:
        this.logger.error(logData, `[AUDIT] ${event.description}`);
        break;
      case AuditSeverity.MEDIUM:
        this.logger.warn(logData, `[AUDIT] ${event.description}`);
        break;
      default:
        this.logger.info(logData, `[AUDIT] ${event.description}`);
    }
  }

  /**
   * Persists the audit event to storage
   * Override this method to implement actual persistence
   */
  protected async persistEvent(event: AuditEvent): Promise<void> {
    // Default implementation: no-op
    // In production, implement storage to:
    // - Database table
    // - Separate audit log service
    // - SIEM system
    // - Immutable storage (S3, etc.)
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let auditLoggerInstance: AuditLogger | null = null;

/**
 * Gets the singleton audit logger instance
 */
export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}

/**
 * Creates a new audit logger instance
 */
export function createAuditLogger(options?: {
  serviceName?: string;
  serviceVersion?: string;
}): AuditLogger {
  return new AuditLogger(options);
}

/**
 * Resets the singleton instance (primarily for testing)
 */
export function resetAuditLogger(): void {
  auditLoggerInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Records an audit event using the singleton logger
 */
export async function audit(options: CreateAuditEventOptions): Promise<AuditEvent> {
  return getAuditLogger().record(options);
}

/**
 * Creates a change object for audit logging
 */
export function createAuditChange<T>(
  field: string,
  oldValue: T | undefined,
  newValue: T | undefined
): AuditChange | null {
  if (oldValue === newValue) {
    return null;
  }

  return {
    field,
    oldValue,
    newValue,
  };
}

/**
 * Compares two objects and returns audit changes
 */
export function compareForAudit<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: T,
  fieldsToCompare?: (keyof T)[]
): AuditChange[] {
  const changes: AuditChange[] = [];
  const fields = fieldsToCompare || (Object.keys(newObj) as (keyof T)[]);

  for (const field of fields) {
    const oldValue = oldObj[field];
    const newValue = newObj[field];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: String(field),
        oldValue,
        newValue,
      });
    }
  }

  return changes;
}
