/**
 * Documentation System Error Classes
 * @module errors/documentation
 *
 * Domain-specific error classes for the documentation system including
 * documentation pages, beta customer management, and launch checklist features.
 *
 * TASK-FINAL-004: Documentation system error handling
 */

import { BaseError, ErrorContext } from './base.js';
import {
  DocumentationErrorCodes,
  BetaCustomerErrorCodes,
  LaunchChecklistErrorCodes,
} from './codes.js';

// ============================================================================
// Documentation Page Errors
// ============================================================================

/**
 * Base class for documentation-related errors
 */
export class DocumentationError extends BaseError {
  constructor(
    message: string,
    code: string,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'DocumentationError';
  }
}

/**
 * Documentation page not found error
 */
export class DocPageNotFoundError extends DocumentationError {
  public readonly pageId: string;

  constructor(pageId: string, context: ErrorContext = {}) {
    super(
      `Documentation page not found: ${pageId}`,
      DocumentationErrorCodes.PAGE_NOT_FOUND,
      { ...context, details: { ...context.details, pageId } }
    );
    this.name = 'DocPageNotFoundError';
    this.pageId = pageId;
  }
}

/**
 * Invalid documentation category error
 */
export class InvalidCategoryError extends DocumentationError {
  public readonly category: string;
  public readonly validCategories?: string[];

  constructor(category: string, validCategories?: string[], context: ErrorContext = {}) {
    const message = validCategories
      ? `Invalid documentation category '${category}'. Valid categories: ${validCategories.join(', ')}`
      : `Invalid documentation category: ${category}`;
    super(
      message,
      DocumentationErrorCodes.INVALID_CATEGORY,
      { ...context, details: { ...context.details, category, validCategories } }
    );
    this.name = 'InvalidCategoryError';
    this.category = category;
    this.validCategories = validCategories;
  }
}

/**
 * Slug already exists error
 */
export class SlugExistsError extends DocumentationError {
  public readonly slug: string;
  public readonly existingPageId?: string;

  constructor(slug: string, existingPageId?: string, context: ErrorContext = {}) {
    super(
      `Page with slug '${slug}' already exists`,
      DocumentationErrorCodes.SLUG_EXISTS,
      { ...context, details: { ...context.details, slug, existingPageId } }
    );
    this.name = 'SlugExistsError';
    this.slug = slug;
    this.existingPageId = existingPageId;
  }
}

/**
 * Invalid page status transition error
 */
export class InvalidStatusTransitionError extends DocumentationError {
  public readonly currentStatus: string;
  public readonly targetStatus: string;
  public readonly allowedTransitions?: string[];

  constructor(
    currentStatus: string,
    targetStatus: string,
    allowedTransitions?: string[],
    context: ErrorContext = {}
  ) {
    const message = allowedTransitions
      ? `Cannot transition page from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowedTransitions.join(', ')}`
      : `Invalid page status transition from '${currentStatus}' to '${targetStatus}'`;
    super(
      message,
      DocumentationErrorCodes.INVALID_STATUS_TRANSITION,
      { ...context, details: { ...context.details, currentStatus, targetStatus, allowedTransitions } }
    );
    this.name = 'InvalidStatusTransitionError';
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
    this.allowedTransitions = allowedTransitions;
  }
}

/**
 * Page publish failed error
 */
export class PublishFailedError extends DocumentationError {
  public readonly pageId: string;
  public readonly reason: string;

  constructor(pageId: string, reason: string, context: ErrorContext = {}) {
    super(
      `Failed to publish page '${pageId}': ${reason}`,
      DocumentationErrorCodes.PUBLISH_FAILED,
      { ...context, details: { ...context.details, pageId, reason } }
    );
    this.name = 'PublishFailedError';
    this.pageId = pageId;
    this.reason = reason;
  }
}

/**
 * Page version conflict error (optimistic locking)
 */
export class PageVersionConflictError extends DocumentationError {
  public readonly pageId: string;
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(
    pageId: string,
    expectedVersion: number,
    actualVersion: number,
    context: ErrorContext = {}
  ) {
    super(
      `Version conflict for page '${pageId}': expected version ${expectedVersion}, but found ${actualVersion}`,
      DocumentationErrorCodes.PAGE_VERSION_CONFLICT,
      { ...context, details: { ...context.details, pageId, expectedVersion, actualVersion } }
    );
    this.name = 'PageVersionConflictError';
    this.pageId = pageId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Invalid page content error
 */
export class InvalidPageContentError extends DocumentationError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    validationErrors: Array<{ field: string; message: string }>,
    context: ErrorContext = {}
  ) {
    super(
      `Invalid page content: ${validationErrors.map(e => e.message).join('; ')}`,
      DocumentationErrorCodes.INVALID_PAGE_CONTENT,
      { ...context, details: { ...context.details, validationErrors } }
    );
    this.name = 'InvalidPageContentError';
    this.validationErrors = validationErrors;
  }
}

// ============================================================================
// Beta Customer Errors
// ============================================================================

/**
 * Base class for beta customer-related errors
 */
export class BetaCustomerError extends BaseError {
  constructor(
    message: string,
    code: string,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'BetaCustomerError';
  }
}

/**
 * Beta customer not found error
 */
export class BetaCustomerNotFoundError extends BetaCustomerError {
  public readonly identifier: string;
  public readonly identifierType: 'id' | 'email';

  constructor(
    identifier: string,
    identifierType: 'id' | 'email' = 'id',
    context: ErrorContext = {}
  ) {
    super(
      `Beta customer not found: ${identifier}`,
      BetaCustomerErrorCodes.CUSTOMER_NOT_FOUND,
      { ...context, details: { ...context.details, identifier, identifierType } }
    );
    this.name = 'BetaCustomerNotFoundError';
    this.identifier = identifier;
    this.identifierType = identifierType;
  }
}

/**
 * Email already registered error
 */
export class EmailExistsError extends BetaCustomerError {
  public readonly email: string;

  constructor(email: string, context: ErrorContext = {}) {
    super(
      `Email '${email}' is already registered for beta program`,
      BetaCustomerErrorCodes.EMAIL_EXISTS,
      { ...context, details: { ...context.details, email } }
    );
    this.name = 'EmailExistsError';
    this.email = email;
  }
}

/**
 * NDA not signed error
 */
export class NdaNotSignedError extends BetaCustomerError {
  public readonly customerId: string;

  constructor(customerId: string, context: ErrorContext = {}) {
    super(
      `NDA must be signed before proceeding with onboarding for customer '${customerId}'`,
      BetaCustomerErrorCodes.NDA_NOT_SIGNED,
      { ...context, details: { ...context.details, customerId } }
    );
    this.name = 'NdaNotSignedError';
    this.customerId = customerId;
  }
}

/**
 * Invalid onboarding status transition error
 */
export class InvalidOnboardingStatusError extends BetaCustomerError {
  public readonly customerId: string;
  public readonly currentStatus: string;
  public readonly targetStatus: string;

  constructor(
    customerId: string,
    currentStatus: string,
    targetStatus: string,
    context: ErrorContext = {}
  ) {
    super(
      `Invalid onboarding status transition for customer '${customerId}': cannot change from '${currentStatus}' to '${targetStatus}'`,
      BetaCustomerErrorCodes.INVALID_ONBOARDING_STATUS,
      { ...context, details: { ...context.details, customerId, currentStatus, targetStatus } }
    );
    this.name = 'InvalidOnboardingStatusError';
    this.customerId = customerId;
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

/**
 * Onboarding incomplete error
 */
export class OnboardingIncompleteError extends BetaCustomerError {
  public readonly customerId: string;
  public readonly missingSteps: string[];

  constructor(customerId: string, missingSteps: string[], context: ErrorContext = {}) {
    super(
      `Onboarding incomplete for customer '${customerId}'. Missing steps: ${missingSteps.join(', ')}`,
      BetaCustomerErrorCodes.ONBOARDING_INCOMPLETE,
      { ...context, details: { ...context.details, customerId, missingSteps } }
    );
    this.name = 'OnboardingIncompleteError';
    this.customerId = customerId;
    this.missingSteps = missingSteps;
  }
}

/**
 * Customer already onboarded error
 */
export class CustomerAlreadyOnboardedError extends BetaCustomerError {
  public readonly customerId: string;
  public readonly onboardedAt: Date;

  constructor(customerId: string, onboardedAt: Date, context: ErrorContext = {}) {
    super(
      `Customer '${customerId}' has already been onboarded`,
      BetaCustomerErrorCodes.CUSTOMER_ALREADY_ONBOARDED,
      { ...context, details: { ...context.details, customerId, onboardedAt: onboardedAt.toISOString() } }
    );
    this.name = 'CustomerAlreadyOnboardedError';
    this.customerId = customerId;
    this.onboardedAt = onboardedAt;
  }
}

/**
 * Invalid tier error
 */
export class InvalidTierError extends BetaCustomerError {
  public readonly tier: string;
  public readonly validTiers: string[];

  constructor(tier: string, validTiers: string[], context: ErrorContext = {}) {
    super(
      `Invalid beta tier '${tier}'. Valid tiers: ${validTiers.join(', ')}`,
      BetaCustomerErrorCodes.INVALID_TIER,
      { ...context, details: { ...context.details, tier, validTiers } }
    );
    this.name = 'InvalidTierError';
    this.tier = tier;
    this.validTiers = validTiers;
  }
}

// ============================================================================
// Launch Checklist Errors
// ============================================================================

/**
 * Base class for launch checklist-related errors
 */
export class LaunchChecklistError extends BaseError {
  constructor(
    message: string,
    code: string,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'LaunchChecklistError';
  }
}

/**
 * Checklist item not found error
 */
export class ChecklistItemNotFoundError extends LaunchChecklistError {
  public readonly itemId: string;

  constructor(itemId: string, context: ErrorContext = {}) {
    super(
      `Launch checklist item not found: ${itemId}`,
      LaunchChecklistErrorCodes.ITEM_NOT_FOUND,
      { ...context, details: { ...context.details, itemId } }
    );
    this.name = 'ChecklistItemNotFoundError';
    this.itemId = itemId;
  }
}

/**
 * Blocked by dependency error
 */
export class BlockedByDependencyError extends LaunchChecklistError {
  public readonly itemId: string;
  public readonly blockerIds: string[];
  public readonly blockerNames?: string[];

  constructor(
    itemId: string,
    blockerIds: string[],
    blockerNames?: string[],
    context: ErrorContext = {}
  ) {
    const blockerInfo = blockerNames
      ? blockerNames.map((name, i) => `${name} (${blockerIds[i]})`).join(', ')
      : blockerIds.join(', ');
    super(
      `Item '${itemId}' is blocked by incomplete dependencies: ${blockerInfo}`,
      LaunchChecklistErrorCodes.BLOCKED_BY_DEPENDENCY,
      { ...context, details: { ...context.details, itemId, blockerIds, blockerNames } }
    );
    this.name = 'BlockedByDependencyError';
    this.itemId = itemId;
    this.blockerIds = blockerIds;
    this.blockerNames = blockerNames;
  }
}

/**
 * Circular dependency error
 */
export class LaunchCircularDependencyError extends LaunchChecklistError {
  public readonly cycle: string[];

  constructor(cycle: string[], context: ErrorContext = {}) {
    const cycleStr = cycle.join(' -> ');
    super(
      `Circular dependency detected in launch checklist: ${cycleStr}`,
      LaunchChecklistErrorCodes.CIRCULAR_DEPENDENCY,
      { ...context, details: { ...context.details, cycle } }
    );
    this.name = 'LaunchCircularDependencyError';
    this.cycle = cycle;
  }
}

/**
 * Invalid target date error
 */
export class InvalidTargetDateError extends LaunchChecklistError {
  public readonly targetDate: Date;
  public readonly reason: string;

  constructor(targetDate: Date, reason: string, context: ErrorContext = {}) {
    super(
      `Invalid target launch date: ${reason}`,
      LaunchChecklistErrorCodes.INVALID_TARGET_DATE,
      { ...context, details: { ...context.details, targetDate: targetDate.toISOString(), reason } }
    );
    this.name = 'InvalidTargetDateError';
    this.targetDate = targetDate;
    this.reason = reason;
  }

  /**
   * Create error for date in the past
   */
  static dateInPast(targetDate: Date): InvalidTargetDateError {
    return new InvalidTargetDateError(
      targetDate,
      'Target launch date must be in the future'
    );
  }

  /**
   * Create error for date too far in the future
   */
  static dateTooFar(targetDate: Date, maxDate: Date): InvalidTargetDateError {
    return new InvalidTargetDateError(
      targetDate,
      `Target launch date cannot be more than ${Math.ceil((maxDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days in the future`
    );
  }
}

/**
 * Item already completed error
 */
export class ItemAlreadyCompletedError extends LaunchChecklistError {
  public readonly itemId: string;
  public readonly completedAt: Date;

  constructor(itemId: string, completedAt: Date, context: ErrorContext = {}) {
    super(
      `Checklist item '${itemId}' has already been completed`,
      LaunchChecklistErrorCodes.ITEM_ALREADY_COMPLETED,
      { ...context, details: { ...context.details, itemId, completedAt: completedAt.toISOString() } }
    );
    this.name = 'ItemAlreadyCompletedError';
    this.itemId = itemId;
    this.completedAt = completedAt;
  }
}

/**
 * Launch category not found error
 */
export class LaunchCategoryNotFoundError extends LaunchChecklistError {
  public readonly categoryId: string;

  constructor(categoryId: string, context: ErrorContext = {}) {
    super(
      `Launch checklist category not found: ${categoryId}`,
      LaunchChecklistErrorCodes.CATEGORY_NOT_FOUND,
      { ...context, details: { ...context.details, categoryId } }
    );
    this.name = 'LaunchCategoryNotFoundError';
    this.categoryId = categoryId;
  }
}

/**
 * Invalid priority error
 */
export class InvalidPriorityError extends LaunchChecklistError {
  public readonly priority: string;
  public readonly validPriorities: string[];

  constructor(priority: string, validPriorities: string[], context: ErrorContext = {}) {
    super(
      `Invalid priority '${priority}'. Valid priorities: ${validPriorities.join(', ')}`,
      LaunchChecklistErrorCodes.INVALID_PRIORITY,
      { ...context, details: { ...context.details, priority, validPriorities } }
    );
    this.name = 'InvalidPriorityError';
    this.priority = priority;
    this.validPriorities = validPriorities;
  }
}
