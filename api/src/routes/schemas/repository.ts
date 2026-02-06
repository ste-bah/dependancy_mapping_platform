/**
 * Repository API Schemas
 * @module routes/schemas/repository
 *
 * TypeBox schemas for repository management API endpoints.
 */

import { Type, Static } from '@sinclair/typebox';
import { PaginationQuerySchema, PaginationInfoSchema } from './common.js';

// ============================================================================
// Git Provider Schema
// ============================================================================

export const GitProviderSchema = Type.Union([
  Type.Literal('github'),
  Type.Literal('gitlab'),
  Type.Literal('bitbucket'),
  Type.Literal('azure_devops'),
]);

export type GitProvider = Static<typeof GitProviderSchema>;

// ============================================================================
// Repository Schemas
// ============================================================================

/**
 * Repository response schema
 */
export const RepositoryResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  provider: GitProviderSchema,
  providerId: Type.String({ description: 'Provider repository ID' }),
  owner: Type.String({ description: 'Repository owner/org' }),
  name: Type.String({ description: 'Repository name' }),
  fullName: Type.String({ description: 'Full name (owner/name)' }),
  defaultBranch: Type.String({ description: 'Default branch' }),
  cloneUrl: Type.String({ format: 'uri', description: 'Clone URL' }),
  htmlUrl: Type.String({ format: 'uri', description: 'Web URL' }),
  description: Type.Optional(Type.String({ description: 'Repository description' })),
  isPrivate: Type.Boolean({ description: 'Whether repository is private' }),
  isArchived: Type.Boolean({ description: 'Whether repository is archived' }),
  webhookEnabled: Type.Boolean({ description: 'Whether webhook is registered' }),
  lastScan: Type.Optional(Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.String(),
    ref: Type.String(),
    completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  })),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type RepositoryResponse = Static<typeof RepositoryResponseSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Add repository request
 */
export const AddRepositoryRequestSchema = Type.Object({
  provider: GitProviderSchema,
  owner: Type.String({ minLength: 1, maxLength: 100, description: 'Repository owner/org' }),
  name: Type.String({ minLength: 1, maxLength: 100, description: 'Repository name' }),
  enableWebhook: Type.Optional(Type.Boolean({ default: false, description: 'Register webhook for auto-scan' })),
  autoScan: Type.Optional(Type.Boolean({ default: false, description: 'Trigger initial scan after adding' })),
});

export type AddRepositoryRequest = Static<typeof AddRepositoryRequestSchema>;

/**
 * Update repository request
 */
export const UpdateRepositoryRequestSchema = Type.Partial(Type.Object({
  enableWebhook: Type.Boolean({ description: 'Enable/disable webhook' }),
  defaultBranch: Type.String({ description: 'Update default branch' }),
}));

export type UpdateRepositoryRequest = Static<typeof UpdateRepositoryRequestSchema>;

/**
 * List repositories query parameters
 */
export const ListRepositoriesQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    provider: Type.Optional(GitProviderSchema),
    owner: Type.Optional(Type.String({ description: 'Filter by owner' })),
    search: Type.Optional(Type.String({ description: 'Search in name and owner' })),
    hasWebhook: Type.Optional(Type.Boolean({ description: 'Filter by webhook status' })),
    sortBy: Type.Optional(Type.Union([
      Type.Literal('name'),
      Type.Literal('createdAt'),
      Type.Literal('lastScannedAt'),
    ], { default: 'createdAt' })),
    sortOrder: Type.Optional(Type.Union([
      Type.Literal('asc'),
      Type.Literal('desc'),
    ], { default: 'desc' })),
  }),
]);

export type ListRepositoriesQuery = Static<typeof ListRepositoriesQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Repository list response
 */
export const RepositoryListResponseSchema = Type.Object({
  data: Type.Array(RepositoryResponseSchema),
  pagination: PaginationInfoSchema,
});

export type RepositoryListResponse = Static<typeof RepositoryListResponseSchema>;

/**
 * Repository deletion response
 */
export const RepositoryDeletedResponseSchema = Type.Object({
  deleted: Type.Literal(true),
  id: Type.String({ format: 'uuid' }),
  scansDeleted: Type.Number({ description: 'Number of scans deleted' }),
});

export type RepositoryDeletedResponse = Static<typeof RepositoryDeletedResponseSchema>;

/**
 * Repository webhook status
 */
export const RepositoryWebhookStatusSchema = Type.Object({
  enabled: Type.Boolean(),
  webhookId: Type.Optional(Type.String()),
  events: Type.Optional(Type.Array(Type.String())),
  lastDelivery: Type.Optional(Type.Object({
    id: Type.String(),
    status: Type.Union([Type.Literal('success'), Type.Literal('failure')]),
    timestamp: Type.String({ format: 'date-time' }),
  })),
});

export type RepositoryWebhookStatus = Static<typeof RepositoryWebhookStatusSchema>;
