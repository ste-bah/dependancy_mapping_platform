/**
 * Graph Validation Utilities
 * Input validation with helpful error messages
 * @module features/graph/utils/validation
 */

import { ALL_NODE_TYPES, ALL_EDGE_TYPES } from '../types';
import type { GraphNodeType, EdgeType, GraphFilters, ExtendedGraphFilters } from '../types';

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation result structure
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Specific field that failed validation */
  field?: string;
}

/**
 * Validation error with multiple field errors
 */
export interface ValidationErrors {
  /** Whether all validations passed */
  valid: boolean;
  /** Individual field errors */
  errors: FieldError[];
}

/**
 * Single field validation error
 */
export interface FieldError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code?: string;
}

// ============================================================================
// ID Validation
// ============================================================================

/**
 * UUID v4 pattern for validation
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * General ID pattern (alphanumeric with dashes/underscores)
 */
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate a scan ID
 * Scan IDs should be valid UUIDs or alphanumeric identifiers
 *
 * @param scanId - The scan ID to validate
 * @returns Validation result
 *
 * @example
 * ```ts
 * const result = validateScanId(scanId);
 * if (!result.valid) {
 *   showError(result.error);
 * }
 * ```
 */
export function validateScanId(scanId: string | undefined | null): ValidationResult {
  if (scanId === undefined || scanId === null) {
    return {
      valid: false,
      error: 'Scan ID is required',
      field: 'scanId',
    };
  }

  if (typeof scanId !== 'string') {
    return {
      valid: false,
      error: 'Scan ID must be a string',
      field: 'scanId',
    };
  }

  const trimmed = scanId.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Scan ID cannot be empty',
      field: 'scanId',
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      error: 'Scan ID is too long',
      field: 'scanId',
    };
  }

  // Allow UUIDs or alphanumeric identifiers
  if (!UUID_PATTERN.test(trimmed) && !ID_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid scan ID format',
      field: 'scanId',
    };
  }

  return { valid: true };
}

/**
 * Validate a node ID
 * Node IDs should be non-empty strings with valid characters
 *
 * @param nodeId - The node ID to validate
 * @returns Validation result
 *
 * @example
 * ```ts
 * const result = validateNodeId(nodeId);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateNodeId(nodeId: string | undefined | null): ValidationResult {
  if (nodeId === undefined || nodeId === null) {
    return {
      valid: false,
      error: 'Node ID is required',
      field: 'nodeId',
    };
  }

  if (typeof nodeId !== 'string') {
    return {
      valid: false,
      error: 'Node ID must be a string',
      field: 'nodeId',
    };
  }

  const trimmed = nodeId.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Node ID cannot be empty',
      field: 'nodeId',
    };
  }

  if (trimmed.length > 200) {
    return {
      valid: false,
      error: 'Node ID is too long',
      field: 'nodeId',
    };
  }

  // Node IDs can contain various characters from source code
  // Just check for obviously invalid characters
  if (/[\x00-\x1f]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Node ID contains invalid characters',
      field: 'nodeId',
    };
  }

  return { valid: true };
}

// ============================================================================
// Filter Validation
// ============================================================================

/**
 * Validate a node type
 *
 * @param type - The node type to validate
 * @returns Whether the type is valid
 */
export function isValidNodeType(type: unknown): type is GraphNodeType {
  return typeof type === 'string' && ALL_NODE_TYPES.includes(type as GraphNodeType);
}

/**
 * Validate an edge type
 *
 * @param type - The edge type to validate
 * @returns Whether the type is valid
 */
export function isValidEdgeType(type: unknown): type is EdgeType {
  return typeof type === 'string' && ALL_EDGE_TYPES.includes(type as EdgeType);
}

/**
 * Validate graph filters
 *
 * @param filters - The filters to validate
 * @returns Validation result with errors for invalid fields
 *
 * @example
 * ```ts
 * const result = validateFilters(filters);
 * if (!result.valid) {
 *   result.errors.forEach(err => console.error(err.field, err.message));
 * }
 * ```
 */
export function validateFilters(
  filters: Partial<GraphFilters> | undefined | null
): ValidationErrors {
  const errors: FieldError[] = [];

  if (!filters) {
    return { valid: true, errors: [] };
  }

  // Validate nodeTypes
  if (filters.nodeTypes !== undefined) {
    if (!Array.isArray(filters.nodeTypes)) {
      errors.push({
        field: 'nodeTypes',
        message: 'Node types must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      const invalidTypes = filters.nodeTypes.filter(t => !isValidNodeType(t));
      if (invalidTypes.length > 0) {
        errors.push({
          field: 'nodeTypes',
          message: `Invalid node types: ${invalidTypes.join(', ')}`,
          code: 'INVALID_NODE_TYPE',
        });
      }
    }
  }

  // Validate search
  if (filters.search !== undefined) {
    if (typeof filters.search !== 'string') {
      errors.push({
        field: 'search',
        message: 'Search must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (filters.search.length > 200) {
      errors.push({
        field: 'search',
        message: 'Search query is too long (max 200 characters)',
        code: 'TOO_LONG',
      });
    }
  }

  // Validate showBlastRadius
  if (filters.showBlastRadius !== undefined) {
    if (typeof filters.showBlastRadius !== 'boolean') {
      errors.push({
        field: 'showBlastRadius',
        message: 'Show blast radius must be a boolean',
        code: 'INVALID_TYPE',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate extended graph filters
 *
 * @param filters - The extended filters to validate
 * @returns Validation result with errors for invalid fields
 */
export function validateExtendedFilters(
  filters: Partial<ExtendedGraphFilters> | undefined | null
): ValidationErrors {
  // Start with base filter validation
  const baseResult = validateFilters(filters);
  const errors = [...baseResult.errors];

  if (!filters) {
    return { valid: true, errors: [] };
  }

  // Validate edgeTypes
  if (filters.edgeTypes !== undefined) {
    if (!Array.isArray(filters.edgeTypes)) {
      errors.push({
        field: 'edgeTypes',
        message: 'Edge types must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      const invalidTypes = filters.edgeTypes.filter(t => !isValidEdgeType(t));
      if (invalidTypes.length > 0) {
        errors.push({
          field: 'edgeTypes',
          message: `Invalid edge types: ${invalidTypes.join(', ')}`,
          code: 'INVALID_EDGE_TYPE',
        });
      }
    }
  }

  // Validate minConfidence
  if (filters.minConfidence !== undefined) {
    if (typeof filters.minConfidence !== 'number') {
      errors.push({
        field: 'minConfidence',
        message: 'Minimum confidence must be a number',
        code: 'INVALID_TYPE',
      });
    } else if (filters.minConfidence < 0 || filters.minConfidence > 1) {
      errors.push({
        field: 'minConfidence',
        message: 'Minimum confidence must be between 0 and 1',
        code: 'OUT_OF_RANGE',
      });
    }
  }

  // Validate maxDepth
  if (filters.maxDepth !== undefined) {
    if (typeof filters.maxDepth !== 'number' && filters.maxDepth !== Infinity) {
      errors.push({
        field: 'maxDepth',
        message: 'Maximum depth must be a number',
        code: 'INVALID_TYPE',
      });
    } else if (typeof filters.maxDepth === 'number' && filters.maxDepth < 0) {
      errors.push({
        field: 'maxDepth',
        message: 'Maximum depth cannot be negative',
        code: 'OUT_OF_RANGE',
      });
    }
  }

  // Validate showConnectedOnly
  if (filters.showConnectedOnly !== undefined) {
    if (typeof filters.showConnectedOnly !== 'boolean') {
      errors.push({
        field: 'showConnectedOnly',
        message: 'Show connected only must be a boolean',
        code: 'INVALID_TYPE',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Search Validation
// ============================================================================

/**
 * Validate a search query
 *
 * @param query - The search query to validate
 * @returns Validation result
 */
export function validateSearchQuery(query: string | undefined | null): ValidationResult {
  if (query === undefined || query === null) {
    return { valid: true }; // Empty search is valid
  }

  if (typeof query !== 'string') {
    return {
      valid: false,
      error: 'Search query must be a string',
      field: 'search',
    };
  }

  if (query.length > 200) {
    return {
      valid: false,
      error: 'Search query is too long (max 200 characters)',
      field: 'search',
    };
  }

  // Check for potentially malicious input
  if (/[<>]/.test(query)) {
    return {
      valid: false,
      error: 'Search query contains invalid characters',
      field: 'search',
    };
  }

  return { valid: true };
}

// ============================================================================
// Depth Validation
// ============================================================================

/**
 * Maximum allowed depth for graph traversal
 */
export const MAX_DEPTH = 20;

/**
 * Validate a depth value
 *
 * @param depth - The depth value to validate
 * @returns Validation result
 */
export function validateDepth(depth: number | undefined | null): ValidationResult {
  if (depth === undefined || depth === null) {
    return { valid: true }; // Undefined depth is valid (use default)
  }

  if (typeof depth !== 'number' || !Number.isFinite(depth)) {
    return {
      valid: false,
      error: 'Depth must be a number',
      field: 'depth',
    };
  }

  if (!Number.isInteger(depth)) {
    return {
      valid: false,
      error: 'Depth must be a whole number',
      field: 'depth',
    };
  }

  if (depth < 0) {
    return {
      valid: false,
      error: 'Depth cannot be negative',
      field: 'depth',
    };
  }

  if (depth > MAX_DEPTH) {
    return {
      valid: false,
      error: `Depth cannot exceed ${MAX_DEPTH}`,
      field: 'depth',
    };
  }

  return { valid: true };
}

// ============================================================================
// Confidence Validation
// ============================================================================

/**
 * Validate a confidence value
 *
 * @param confidence - The confidence value to validate
 * @returns Validation result
 */
export function validateConfidence(confidence: number | undefined | null): ValidationResult {
  if (confidence === undefined || confidence === null) {
    return { valid: true }; // Undefined confidence is valid (use default)
  }

  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return {
      valid: false,
      error: 'Confidence must be a number',
      field: 'confidence',
    };
  }

  if (confidence < 0) {
    return {
      valid: false,
      error: 'Confidence cannot be negative',
      field: 'confidence',
    };
  }

  if (confidence > 1) {
    return {
      valid: false,
      error: 'Confidence cannot exceed 1',
      field: 'confidence',
    };
  }

  return { valid: true };
}

// ============================================================================
// Composite Validation
// ============================================================================

/**
 * Validate all parameters for a graph fetch operation
 *
 * @param params - Parameters to validate
 * @returns Validation result with all errors
 */
export function validateGraphFetchParams(params: {
  scanId?: string;
  nodeTypes?: GraphNodeType[];
  search?: string;
  maxDepth?: number;
}): ValidationErrors {
  const errors: FieldError[] = [];

  // Validate scanId
  const scanIdResult = validateScanId(params.scanId);
  if (!scanIdResult.valid && scanIdResult.error) {
    errors.push({
      field: scanIdResult.field ?? 'scanId',
      message: scanIdResult.error,
    });
  }

  // Validate nodeTypes
  if (params.nodeTypes) {
    const invalidTypes = params.nodeTypes.filter(t => !isValidNodeType(t));
    if (invalidTypes.length > 0) {
      errors.push({
        field: 'nodeTypes',
        message: `Invalid node types: ${invalidTypes.join(', ')}`,
        code: 'INVALID_NODE_TYPE',
      });
    }
  }

  // Validate search
  const searchResult = validateSearchQuery(params.search);
  if (!searchResult.valid && searchResult.error) {
    errors.push({
      field: searchResult.field ?? 'search',
      message: searchResult.error,
    });
  }

  // Validate depth
  const depthResult = validateDepth(params.maxDepth);
  if (!depthResult.valid && depthResult.error) {
    errors.push({
      field: depthResult.field ?? 'maxDepth',
      message: depthResult.error,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate parameters for a blast radius calculation
 *
 * @param params - Parameters to validate
 * @returns Validation result with all errors
 */
export function validateBlastRadiusParams(params: {
  scanId?: string;
  nodeId?: string;
  maxDepth?: number;
}): ValidationErrors {
  const errors: FieldError[] = [];

  // Validate scanId
  const scanIdResult = validateScanId(params.scanId);
  if (!scanIdResult.valid && scanIdResult.error) {
    errors.push({
      field: scanIdResult.field ?? 'scanId',
      message: scanIdResult.error,
    });
  }

  // Validate nodeId
  const nodeIdResult = validateNodeId(params.nodeId);
  if (!nodeIdResult.valid && nodeIdResult.error) {
    errors.push({
      field: nodeIdResult.field ?? 'nodeId',
      message: nodeIdResult.error,
    });
  }

  // Validate depth
  const depthResult = validateDepth(params.maxDepth);
  if (!depthResult.valid && depthResult.error) {
    errors.push({
      field: depthResult.field ?? 'maxDepth',
      message: depthResult.error,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a validation error message from multiple field errors
 */
export function formatValidationErrors(errors: FieldError[]): string {
  if (errors.length === 0) {
    return '';
  }

  if (errors.length === 1) {
    return errors[0].message;
  }

  return `Multiple validation errors:\n${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`;
}

/**
 * Get the first error message from validation errors
 */
export function getFirstError(result: ValidationErrors): string | undefined {
  return result.errors[0]?.message;
}

/**
 * Check if a validation result has an error for a specific field
 */
export function hasFieldError(result: ValidationErrors, field: string): boolean {
  return result.errors.some(e => e.field === field);
}

/**
 * Get the error message for a specific field
 */
export function getFieldError(result: ValidationErrors, field: string): string | undefined {
  return result.errors.find(e => e.field === field)?.message;
}
