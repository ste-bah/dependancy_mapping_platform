/**
 * Repository Type Definitions
 * TypeBox schemas for repository-related types
 * @module types/repository
 */

import { Type, Static } from '@sinclair/typebox';

/**
 * Repository Schema
 */
export const RepositorySchema = Type.Object({
  id: Type.String({ description: 'Repository ID from Git provider' }),
  name: Type.String({ description: 'Repository name' }),
  fullName: Type.String({ description: 'Full name (owner/name)' }),
  owner: Type.String({ description: 'Repository owner' }),
  private: Type.Boolean({ description: 'Whether the repository is private' }),
  defaultBranch: Type.String({ description: 'Default branch name' }),
  cloneUrl: Type.String({ format: 'uri', description: 'Clone URL' }),
  htmlUrl: Type.String({ format: 'uri', description: 'Web URL' }),
  description: Type.Union([Type.String(), Type.Null()], { description: 'Repository description' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Last update timestamp' }),
});

export type RepositoryType = Static<typeof RepositorySchema>;

/**
 * Repository List Response Schema
 */
export const RepositoryListResponseSchema = Type.Object({
  repositories: Type.Array(RepositorySchema),
  page: Type.Number({ minimum: 1 }),
  perPage: Type.Number({ minimum: 1, maximum: 100 }),
  hasMore: Type.Boolean(),
});

export type RepositoryListResponse = Static<typeof RepositoryListResponseSchema>;

/**
 * Clone Request Schema
 */
export const CloneRequestSchema = Type.Object({
  branch: Type.Optional(Type.String({ description: 'Branch to clone (defaults to default branch)' })),
  force: Type.Optional(Type.Boolean({ default: false, description: 'Force re-clone even if cached' })),
});

export type CloneRequest = Static<typeof CloneRequestSchema>;

/**
 * Clone Response Schema
 */
export const CloneResponseSchema = Type.Object({
  objectPath: Type.String({ description: 'MinIO object path' }),
  commitSha: Type.String({ description: 'Commit SHA that was cloned' }),
  archiveSize: Type.Number({ description: 'Archive size in bytes' }),
  cached: Type.Boolean({ description: 'Whether this was a cached result' }),
  downloadUrl: Type.Optional(Type.String({ format: 'uri', description: 'Presigned download URL' })),
});

export type CloneResponse = Static<typeof CloneResponseSchema>;

/**
 * Webhook Registration Request Schema
 */
export const WebhookRegisterRequestSchema = Type.Object({
  callbackUrl: Type.String({ format: 'uri', description: 'URL to receive webhook events' }),
  events: Type.Optional(
    Type.Array(Type.String(), {
      default: ['push', 'pull_request'],
      description: 'Events to subscribe to',
    })
  ),
});

export type WebhookRegisterRequest = Static<typeof WebhookRegisterRequestSchema>;

/**
 * Webhook Response Schema
 */
export const WebhookResponseSchema = Type.Object({
  id: Type.String({ description: 'Webhook ID' }),
  url: Type.String({ format: 'uri', description: 'Webhook callback URL' }),
  events: Type.Array(Type.String(), { description: 'Subscribed events' }),
  active: Type.Boolean({ description: 'Whether the webhook is active' }),
});

export type WebhookResponse = Static<typeof WebhookResponseSchema>;

/**
 * Repository Params Schema (owner and name from URL)
 */
export const RepositoryParamsSchema = Type.Object({
  owner: Type.String({ minLength: 1, maxLength: 100 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
});

export type RepositoryParams = Static<typeof RepositoryParamsSchema>;

/**
 * Webhook Params Schema
 */
export const WebhookParamsSchema = Type.Object({
  owner: Type.String({ minLength: 1, maxLength: 100 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  id: Type.String({ description: 'Webhook ID' }),
});

export type WebhookParams = Static<typeof WebhookParamsSchema>;

/**
 * List Query Params Schema
 */
export const ListQueryParamsSchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  perPage: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 30 })),
});

export type ListQueryParams = Static<typeof ListQueryParamsSchema>;
