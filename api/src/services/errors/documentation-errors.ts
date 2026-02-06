/**
 * Documentation Service Error Mappers
 * @module services/errors/documentation-errors
 *
 * Error mapper functions for converting domain errors to API errors
 * in the documentation service layer.
 *
 * TASK-FINAL-004: Documentation system error handling
 */

import {
  // Domain errors
  DocPageNotFoundError,
  SlugExistsError,
  InvalidCategoryError,
  InvalidStatusTransitionError,
  PublishFailedError,
  PageVersionConflictError,
  InvalidPageContentError,
  BetaCustomerNotFoundError,
  EmailExistsError,
  NdaNotSignedError,
  InvalidOnboardingStatusError,
  OnboardingIncompleteError,
  CustomerAlreadyOnboardedError,
  InvalidTierError,
  ChecklistItemNotFoundError,
  BlockedByDependencyError,
  LaunchCircularDependencyError,
  InvalidTargetDateError,
  ItemAlreadyCompletedError,
  LaunchCategoryNotFoundError,
  InvalidPriorityError,
  // API errors
  ApiError,
  ApiNotFoundError,
  ApiConflictError,
  BadRequestError,
  ApiInternalError,
  ApiValidationError,
  DocPageNotFoundApiError,
  SlugExistsApiError,
  InvalidCategoryApiError,
  InvalidStatusTransitionApiError,
  BetaCustomerNotFoundApiError,
  BetaEmailExistsApiError,
  NdaRequiredApiError,
  ChecklistItemNotFoundApiError,
  BlockedByDependencyApiError,
  CircularDependencyApiError,
  InvalidTargetDateApiError,
} from '../../errors/index.js';

// ============================================================================
// Documentation Page Error Mappers
// ============================================================================

/**
 * Map documentation domain errors to API errors
 */
export function mapDocumentationError(error: Error): ApiError {
  // Documentation page errors
  if (error instanceof DocPageNotFoundError) {
    return new DocPageNotFoundApiError(error.pageId);
  }

  if (error instanceof SlugExistsError) {
    return new SlugExistsApiError(error.slug);
  }

  if (error instanceof InvalidCategoryError) {
    return new InvalidCategoryApiError(error.category, error.validCategories);
  }

  if (error instanceof InvalidStatusTransitionError) {
    return new InvalidStatusTransitionApiError(error.currentStatus, error.targetStatus);
  }

  if (error instanceof PublishFailedError) {
    return new ApiInternalError(`Failed to publish page: ${error.reason}`);
  }

  if (error instanceof PageVersionConflictError) {
    return new ApiConflictError(
      `Version conflict: expected ${error.expectedVersion}, found ${error.actualVersion}`,
      { pageId: error.pageId, expectedVersion: error.expectedVersion, actualVersion: error.actualVersion }
    );
  }

  if (error instanceof InvalidPageContentError) {
    const fieldErrors: Record<string, string[]> = {};
    error.validationErrors.forEach(({ field, message }) => {
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(message);
    });
    return new ApiValidationError('Invalid page content', fieldErrors);
  }

  // Default fallback
  return new ApiInternalError(error.message);
}

// ============================================================================
// Beta Customer Error Mappers
// ============================================================================

/**
 * Map beta customer domain errors to API errors
 */
export function mapBetaCustomerError(error: Error): ApiError {
  if (error instanceof BetaCustomerNotFoundError) {
    return new BetaCustomerNotFoundApiError(error.identifier);
  }

  if (error instanceof EmailExistsError) {
    return new BetaEmailExistsApiError(error.email);
  }

  if (error instanceof NdaNotSignedError) {
    return new NdaRequiredApiError();
  }

  if (error instanceof InvalidOnboardingStatusError) {
    return new BadRequestError(
      `Invalid onboarding status transition from '${error.currentStatus}' to '${error.targetStatus}'`,
      { customerId: error.customerId, currentStatus: error.currentStatus, targetStatus: error.targetStatus }
    );
  }

  if (error instanceof OnboardingIncompleteError) {
    return new BadRequestError(
      `Onboarding incomplete. Missing steps: ${error.missingSteps.join(', ')}`,
      { customerId: error.customerId, missingSteps: error.missingSteps }
    );
  }

  if (error instanceof CustomerAlreadyOnboardedError) {
    return new ApiConflictError(
      `Customer has already been onboarded`,
      { customerId: error.customerId, onboardedAt: error.onboardedAt.toISOString() }
    );
  }

  if (error instanceof InvalidTierError) {
    return new BadRequestError(
      `Invalid tier '${error.tier}'. Valid tiers: ${error.validTiers.join(', ')}`,
      { tier: error.tier, validTiers: error.validTiers }
    );
  }

  // Default fallback
  return new ApiInternalError(error.message);
}

// ============================================================================
// Launch Checklist Error Mappers
// ============================================================================

/**
 * Map launch checklist domain errors to API errors
 */
export function mapLaunchChecklistError(error: Error): ApiError {
  if (error instanceof ChecklistItemNotFoundError) {
    return new ChecklistItemNotFoundApiError(error.itemId);
  }

  if (error instanceof BlockedByDependencyError) {
    return new BlockedByDependencyApiError(error.itemId, error.blockerIds);
  }

  if (error instanceof LaunchCircularDependencyError) {
    return new CircularDependencyApiError(error.cycle);
  }

  if (error instanceof InvalidTargetDateError) {
    return new InvalidTargetDateApiError(error.reason);
  }

  if (error instanceof ItemAlreadyCompletedError) {
    return new ApiConflictError(
      `Item has already been completed`,
      { itemId: error.itemId, completedAt: error.completedAt.toISOString() }
    );
  }

  if (error instanceof LaunchCategoryNotFoundError) {
    return new ApiNotFoundError('Launch category', error.categoryId);
  }

  if (error instanceof InvalidPriorityError) {
    return new BadRequestError(
      `Invalid priority '${error.priority}'. Valid priorities: ${error.validPriorities.join(', ')}`,
      { priority: error.priority, validPriorities: error.validPriorities }
    );
  }

  // Default fallback
  return new ApiInternalError(error.message);
}

// ============================================================================
// Combined Error Mapper
// ============================================================================

/**
 * Map any documentation system error to an API error
 */
export function mapDocumentationSystemError(error: Error): ApiError {
  // Try documentation errors first
  if (
    error instanceof DocPageNotFoundError ||
    error instanceof SlugExistsError ||
    error instanceof InvalidCategoryError ||
    error instanceof InvalidStatusTransitionError ||
    error instanceof PublishFailedError ||
    error instanceof PageVersionConflictError ||
    error instanceof InvalidPageContentError
  ) {
    return mapDocumentationError(error);
  }

  // Try beta customer errors
  if (
    error instanceof BetaCustomerNotFoundError ||
    error instanceof EmailExistsError ||
    error instanceof NdaNotSignedError ||
    error instanceof InvalidOnboardingStatusError ||
    error instanceof OnboardingIncompleteError ||
    error instanceof CustomerAlreadyOnboardedError ||
    error instanceof InvalidTierError
  ) {
    return mapBetaCustomerError(error);
  }

  // Try launch checklist errors
  if (
    error instanceof ChecklistItemNotFoundError ||
    error instanceof BlockedByDependencyError ||
    error instanceof LaunchCircularDependencyError ||
    error instanceof InvalidTargetDateError ||
    error instanceof ItemAlreadyCompletedError ||
    error instanceof LaunchCategoryNotFoundError ||
    error instanceof InvalidPriorityError
  ) {
    return mapLaunchChecklistError(error);
  }

  // Default fallback for unknown errors
  return new ApiInternalError(error.message);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is a documentation page error
 */
export function isDocumentationPageError(error: Error): boolean {
  return (
    error instanceof DocPageNotFoundError ||
    error instanceof SlugExistsError ||
    error instanceof InvalidCategoryError ||
    error instanceof InvalidStatusTransitionError ||
    error instanceof PublishFailedError ||
    error instanceof PageVersionConflictError ||
    error instanceof InvalidPageContentError
  );
}

/**
 * Check if error is a beta customer error
 */
export function isBetaCustomerError(error: Error): boolean {
  return (
    error instanceof BetaCustomerNotFoundError ||
    error instanceof EmailExistsError ||
    error instanceof NdaNotSignedError ||
    error instanceof InvalidOnboardingStatusError ||
    error instanceof OnboardingIncompleteError ||
    error instanceof CustomerAlreadyOnboardedError ||
    error instanceof InvalidTierError
  );
}

/**
 * Check if error is a launch checklist error
 */
export function isLaunchChecklistError(error: Error): boolean {
  return (
    error instanceof ChecklistItemNotFoundError ||
    error instanceof BlockedByDependencyError ||
    error instanceof LaunchCircularDependencyError ||
    error instanceof InvalidTargetDateError ||
    error instanceof ItemAlreadyCompletedError ||
    error instanceof LaunchCategoryNotFoundError ||
    error instanceof InvalidPriorityError
  );
}

/**
 * Check if error is any documentation system error
 */
export function isDocumentationSystemError(error: Error): boolean {
  return (
    isDocumentationPageError(error) ||
    isBetaCustomerError(error) ||
    isLaunchChecklistError(error)
  );
}
