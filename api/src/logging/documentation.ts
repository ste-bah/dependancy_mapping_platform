/**
 * Documentation Module Logger
 * @module logging/documentation
 *
 * Provides structured logging for the documentation system including:
 * - Documentation page lifecycle (create, publish, delete)
 * - Beta customer management (registration, NDA, onboarding)
 * - Launch checklist tracking
 * - OpenAPI generation
 *
 * TASK-FINAL-004: Documentation system logging infrastructure
 */

import { getLogger, StructuredLogger } from './logger.js';

// ============================================================================
// PII Masking Utilities
// ============================================================================

/**
 * Masks an email address for logging (e.g., "jo***@example.com")
 */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '[INVALID_EMAIL]';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Masks a customer name for logging
 */
function maskName(name: string): string {
  if (!name || name.length < 2) {
    return '[REDACTED]';
  }
  return `${name[0]}${'*'.repeat(Math.min(name.length - 1, 5))}`;
}

// ============================================================================
// Child Loggers
// ============================================================================

/**
 * Main documentation module logger
 */
export const documentationLogger: StructuredLogger = getLogger().child({
  module: 'documentation',
});

/**
 * Beta customer subsystem logger
 */
export const betaLogger: StructuredLogger = documentationLogger.child({
  subsystem: 'beta',
});

/**
 * Launch checklist subsystem logger
 */
export const launchLogger: StructuredLogger = documentationLogger.child({
  subsystem: 'launch',
});

/**
 * OpenAPI generation subsystem logger
 */
export const openApiLogger: StructuredLogger = documentationLogger.child({
  subsystem: 'openapi',
});

// ============================================================================
// Documentation Page Logging Functions
// ============================================================================

/**
 * Logs when a documentation page is created
 */
export function logDocPageCreated(
  pageId: string,
  title: string,
  author: string,
  metadata?: Record<string, unknown>
): void {
  documentationLogger.info(
    {
      event: 'doc_page_created',
      pageId,
      title,
      author,
      ...metadata,
    },
    `Documentation page created: "${title}"`
  );
}

/**
 * Logs when a documentation page is updated
 */
export function logDocPageUpdated(
  pageId: string,
  title: string,
  updatedBy: string,
  changes?: string[]
): void {
  documentationLogger.info(
    {
      event: 'doc_page_updated',
      pageId,
      title,
      updatedBy,
      changes,
      changeCount: changes?.length,
    },
    `Documentation page updated: "${title}"`
  );
}

/**
 * Logs when a documentation page is published
 */
export function logDocPagePublished(
  pageId: string,
  publishedBy: string,
  version?: string
): void {
  documentationLogger.info(
    {
      event: 'doc_page_published',
      pageId,
      publishedBy,
      version,
    },
    `Documentation page published`
  );
}

/**
 * Logs when a documentation page is unpublished/archived
 */
export function logDocPageArchived(pageId: string, archivedBy: string, reason?: string): void {
  documentationLogger.info(
    {
      event: 'doc_page_archived',
      pageId,
      archivedBy,
      reason,
    },
    `Documentation page archived`
  );
}

/**
 * Logs when a documentation page is deleted (with warning level)
 */
export function logDocPageDeleted(pageId: string, deletedBy: string, reason?: string): void {
  documentationLogger.warn(
    {
      event: 'doc_page_deleted',
      pageId,
      deletedBy,
      reason,
    },
    `Documentation page deleted`
  );
}

/**
 * Logs when a documentation page is viewed
 */
export function logDocPageViewed(
  pageId: string,
  viewerId?: string,
  sessionId?: string
): void {
  documentationLogger.debug(
    {
      event: 'doc_page_viewed',
      pageId,
      viewerId,
      sessionId,
    },
    `Documentation page viewed`
  );
}

// ============================================================================
// Beta Customer Logging Functions
// ============================================================================

/**
 * Logs when a beta customer is registered (with PII masking)
 */
export function logBetaCustomerRegistered(
  customerId: string,
  email: string,
  metadata?: Record<string, unknown>
): void {
  betaLogger.info(
    {
      event: 'beta_customer_registered',
      customerId,
      email: maskEmail(email),
      ...metadata,
    },
    `Beta customer registered`
  );
}

/**
 * Logs when a beta customer signs the NDA
 */
export function logNdaSigned(
  customerId: string,
  ndaVersion?: string,
  signedAt?: Date
): void {
  betaLogger.info(
    {
      event: 'nda_signed',
      customerId,
      ndaVersion,
      signedAt: signedAt?.toISOString(),
    },
    `NDA signed`
  );
}

/**
 * Logs when customer onboarding starts
 */
export function logOnboardingStarted(
  customerId: string,
  onboardingType?: string
): void {
  betaLogger.info(
    {
      event: 'onboarding_started',
      customerId,
      onboardingType,
    },
    `Onboarding started`
  );
}

/**
 * Logs onboarding step completion
 */
export function logOnboardingStepCompleted(
  customerId: string,
  stepId: string,
  stepNumber: number,
  totalSteps: number
): void {
  betaLogger.info(
    {
      event: 'onboarding_step_completed',
      customerId,
      stepId,
      stepNumber,
      totalSteps,
      progress: Math.round((stepNumber / totalSteps) * 100),
    },
    `Onboarding step ${stepNumber}/${totalSteps} completed`
  );
}

/**
 * Logs when customer onboarding is completed
 */
export function logOnboardingCompleted(
  customerId: string,
  durationMs?: number
): void {
  betaLogger.info(
    {
      event: 'onboarding_completed',
      customerId,
      durationMs,
    },
    `Onboarding completed`
  );
}

/**
 * Logs when beta access is granted to a customer
 */
export function logBetaAccessGranted(
  customerId: string,
  features: string[],
  expiresAt?: Date
): void {
  betaLogger.info(
    {
      event: 'beta_access_granted',
      customerId,
      features,
      featureCount: features.length,
      expiresAt: expiresAt?.toISOString(),
    },
    `Beta access granted for ${features.length} features`
  );
}

/**
 * Logs when beta access is revoked
 */
export function logBetaAccessRevoked(
  customerId: string,
  reason: string
): void {
  betaLogger.warn(
    {
      event: 'beta_access_revoked',
      customerId,
      reason,
    },
    `Beta access revoked: ${reason}`
  );
}

// ============================================================================
// Launch Checklist Logging Functions
// ============================================================================

/**
 * Logs when a checklist item is completed
 */
export function logChecklistItemCompleted(
  itemId: string,
  completedBy: string,
  category?: string
): void {
  launchLogger.info(
    {
      event: 'checklist_item_completed',
      itemId,
      completedBy,
      category,
    },
    `Checklist item completed: ${itemId}`
  );
}

/**
 * Logs when a checklist item is marked incomplete
 */
export function logChecklistItemUncompleted(
  itemId: string,
  uncheckedBy: string,
  reason?: string
): void {
  launchLogger.info(
    {
      event: 'checklist_item_uncompleted',
      itemId,
      uncheckedBy,
      reason,
    },
    `Checklist item unchecked: ${itemId}`
  );
}

/**
 * Logs when a blocker is identified
 */
export function logBlockerIdentified(
  blockerId: string,
  severity: 'critical' | 'high' | 'medium' | 'low',
  description: string,
  assignee?: string
): void {
  const logMethod = severity === 'critical' ? 'error' : 'warn';
  launchLogger[logMethod](
    {
      event: 'blocker_identified',
      blockerId,
      severity,
      description,
      assignee,
    },
    `Blocker identified (${severity}): ${description}`
  );
}

/**
 * Logs when a blocker is resolved
 */
export function logBlockerResolved(
  blockerId: string,
  resolvedBy: string,
  resolutionNotes?: string
): void {
  launchLogger.info(
    {
      event: 'blocker_resolved',
      blockerId,
      resolvedBy,
      resolutionNotes,
    },
    `Blocker resolved: ${blockerId}`
  );
}

/**
 * Logs launch readiness assessment
 */
export function logLaunchReadinessAssessed(
  progress: number,
  readyForLaunch: boolean,
  blockerCount?: number,
  metadata?: Record<string, unknown>
): void {
  launchLogger.info(
    {
      event: 'launch_readiness_assessed',
      progress,
      readyForLaunch,
      blockerCount,
      ...metadata,
    },
    `Launch readiness: ${progress}% complete, ${readyForLaunch ? 'READY' : 'NOT READY'}`
  );
}

/**
 * Logs when launch approval is granted
 */
export function logLaunchApproved(
  approvedBy: string,
  targetDate: Date,
  notes?: string
): void {
  launchLogger.info(
    {
      event: 'launch_approved',
      approvedBy,
      targetDate: targetDate.toISOString(),
      notes,
    },
    `Launch approved for ${targetDate.toISOString()}`
  );
}

// ============================================================================
// OpenAPI Generation Logging Functions
// ============================================================================

/**
 * Logs when OpenAPI spec generation starts
 */
export function logOpenApiGenerationStarted(
  outputPath: string,
  format: 'json' | 'yaml' | 'both'
): void {
  openApiLogger.info(
    {
      event: 'openapi_generation_started',
      outputPath,
      format,
    },
    `OpenAPI generation started (${format})`
  );
}

/**
 * Logs when OpenAPI spec is successfully generated
 */
export function logOpenApiGenerated(
  outputPath: string,
  format: 'json' | 'yaml',
  endpointCount?: number,
  schemaCount?: number
): void {
  openApiLogger.info(
    {
      event: 'openapi_generated',
      outputPath,
      format,
      endpointCount,
      schemaCount,
    },
    `OpenAPI spec generated: ${outputPath}`
  );
}

/**
 * Logs OpenAPI generation failure
 */
export function logOpenApiGenerationFailed(
  error: Error,
  format: 'json' | 'yaml'
): void {
  openApiLogger.error(
    {
      event: 'openapi_generation_failed',
      format,
      err: error,
      errorCode: (error as any).code,
    },
    `OpenAPI generation failed: ${error.message}`
  );
}

/**
 * Logs OpenAPI validation results
 */
export function logOpenApiValidated(
  outputPath: string,
  isValid: boolean,
  errors?: string[],
  warnings?: string[]
): void {
  if (isValid) {
    openApiLogger.info(
      {
        event: 'openapi_validated',
        outputPath,
        isValid,
        warningCount: warnings?.length || 0,
      },
      `OpenAPI spec validated successfully`
    );
  } else {
    openApiLogger.warn(
      {
        event: 'openapi_validated',
        outputPath,
        isValid,
        errors,
        errorCount: errors?.length || 0,
      },
      `OpenAPI spec validation failed with ${errors?.length || 0} errors`
    );
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

export { maskEmail, maskName };
