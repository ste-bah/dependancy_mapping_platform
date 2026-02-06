/**
 * Common API Schemas
 * @module routes/schemas/common
 *
 * Shared TypeBox schemas for API request/response validation.
 * Provides reusable schemas for pagination, errors, and common types.
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// Error Schemas
// ============================================================================

/**
 * API Error response schema
 */
export const ErrorResponseSchema = Type.Object({
  statusCode: Type.Number({ description: 'HTTP status code' }),
  error: Type.String({ description: 'Error type' }),
  message: Type.String({ description: 'Human-readable error message' }),
  code: Type.Optional(Type.String({ description: 'Error code for programmatic handling' })),
  details: Type.Optional(Type.Unknown({ description: 'Additional error details' })),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

// ============================================================================
// Pagination Schemas
// ============================================================================

/**
 * Pagination query parameters
 */
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1, description: 'Page number' })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20, description: 'Items per page' })),
});

export type PaginationQuery = Static<typeof PaginationQuerySchema>;

/**
 * Pagination info in response
 */
export const PaginationInfoSchema = Type.Object({
  page: Type.Number(),
  pageSize: Type.Number(),
  total: Type.Number(),
  totalPages: Type.Number(),
  hasNext: Type.Boolean(),
  hasPrevious: Type.Boolean(),
});

export type PaginationInfo = Static<typeof PaginationInfoSchema>;

/**
 * Create pagination info from results
 */
export function createPaginationInfo(
  page: number,
  pageSize: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

// ============================================================================
// Common Parameter Schemas
// ============================================================================

/**
 * UUID parameter schema
 */
export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid', description: 'Resource UUID' }),
});

export type UuidParam = Static<typeof UuidParamSchema>;

/**
 * Scan ID parameter schema
 */
export const ScanIdParamSchema = Type.Object({
  scanId: Type.String({ format: 'uuid', description: 'Scan UUID' }),
});

export type ScanIdParam = Static<typeof ScanIdParamSchema>;

/**
 * Node ID parameter schema
 */
export const NodeIdParamSchema = Type.Object({
  scanId: Type.String({ format: 'uuid', description: 'Scan UUID' }),
  nodeId: Type.String({ description: 'Node ID' }),
});

export type NodeIdParam = Static<typeof NodeIdParamSchema>;

// ============================================================================
// Common Response Schemas
// ============================================================================

/**
 * Empty success response
 */
export const EmptySuccessSchema = Type.Object({
  success: Type.Literal(true),
});

export type EmptySuccess = Static<typeof EmptySuccessSchema>;

/**
 * Message response schema
 */
export const MessageResponseSchema = Type.Object({
  message: Type.String(),
});

export type MessageResponse = Static<typeof MessageResponseSchema>;

// ============================================================================
// Sort/Filter Schemas
// ============================================================================

/**
 * Sort order enum
 */
export const SortOrderSchema = Type.Union([
  Type.Literal('asc'),
  Type.Literal('desc'),
], { default: 'desc' });

export type SortOrder = Static<typeof SortOrderSchema>;
