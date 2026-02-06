/**
 * Documentation Domain Module
 * @module domain/documentation
 *
 * Exports all domain entities, value objects, and types for the documentation system.
 * This module provides the core business logic for documentation pages,
 * beta customer management, and launch readiness tracking.
 *
 * TASK-FINAL-004: Documentation system domain implementation
 */

// ============================================================================
// Result Types and Errors
// ============================================================================

export {
  Result,
  ValidationResult,
  DomainResult,
  ValidationError,
  DomainError,
  isValidationError,
  isDomainError,
} from './result.js';

export type { Result as ResultType } from './result.js';

// ============================================================================
// Documentation Page Entity
// ============================================================================

export {
  DocPageEntity,
  createDocPage,
  reconstituteDocPage,
} from './DocPage.js';

export type {
  CreateDocPageParams,
  DocPageData,
} from './DocPage.js';

// ============================================================================
// Beta Customer Entity
// ============================================================================

export {
  BetaCustomerEntity,
  createBetaCustomer,
  reconstituteBetaCustomer,
} from './BetaCustomer.js';

export type {
  CreateBetaCustomerParams,
  BetaCustomerData,
} from './BetaCustomer.js';

// ============================================================================
// Launch Checklist Aggregate and Value Objects
// ============================================================================

export {
  ChecklistItemVO,
  LaunchChecklistAggregate,
  createChecklistItem,
  createLaunchChecklist,
  reconstituteChecklistItem,
  reconstituteLaunchChecklist,
} from './LaunchChecklist.js';

export type {
  CreateChecklistItemParams,
  CreateLaunchChecklistParams,
} from './LaunchChecklist.js';

// ============================================================================
// Re-export Types from Type Module for Convenience
// ============================================================================

export type {
  DocPage,
  DocPageCategory,
  DocPageStatus,
  DocPageSummary,
  DocNavItem,
  DocTableOfContents,
  BetaCustomer,
  BetaCustomerSummary,
  OnboardingStatus,
  BetaCustomerTier,
  ChecklistItem,
  ChecklistCategory,
  ChecklistPriority,
  LaunchChecklist,
  ChecklistProgressByCategory,
  LaunchReadinessSummary,
} from '../../types/documentation.js';
