/**
 * Service Error Mappers
 * @module services/errors
 *
 * Centralized error mapping utilities for service layer.
 * Converts domain errors to API-appropriate errors.
 *
 * TASK-FINAL-004: Documentation system error handling
 */

export {
  // Documentation error mappers
  mapDocumentationError,
  mapBetaCustomerError,
  mapLaunchChecklistError,
  mapDocumentationSystemError,

  // Type guards
  isDocumentationPageError,
  isBetaCustomerError,
  isLaunchChecklistError,
  isDocumentationSystemError,
} from './documentation-errors.js';
