/**
 * Utilities Module
 * @module utils
 *
 * Exports all utility functions and types including the Result pattern.
 *
 * TASK-DETECT: Final refactoring - Utils barrel export
 */

// ============================================================================
// Result Type Pattern (Core)
// ============================================================================

export {
  // Types
  type Ok,
  type Err,
  type Result,

  // Constructors
  ok,
  err,

  // Type Guards
  isOk,
  isErr,

  // Unwrap Functions
  unwrap,
  unwrapOr,
  unwrapOrElse,
  unwrapErr,
  expect,

  // Transformation Functions
  map,
  mapErr,
  mapOr,
  mapOrElse,

  // Chaining Functions
  andThen,
  orElse,
  or,
  orElseGet,

  // Async Utilities
  tryCatch,
  tryCatchSync,
  mapAsync,
  andThenAsync,

  // Collection Utilities
  collect,
  partition,
  filterOk,
  filterErr,
  combine,
  combine3,

  // Pattern Matching
  match,
} from './result.js';

// ============================================================================
// Domain Result Pattern
// ============================================================================

export {
  // Types
  type DomainError,
  type DomainResult,

  // Domain Error Constructors
  notFound,
  validationErr,
  conflictErr,
  permissionErr,
  externalErr,
  timeoutErr,

  // Pattern Matching
  matchDomain,

  // Utilities
  isDomainErrorType,
  getDomainErrorMessage,
  domainErrorToHttpStatus,
} from './domain-result.js';
