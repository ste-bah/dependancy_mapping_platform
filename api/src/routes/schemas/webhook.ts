/**
 * Webhook API Schemas
 * @module routes/schemas/webhook
 *
 * TypeBox schemas for webhook endpoints including
 * GitHub and GitLab push event payloads.
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// GitHub Webhook Schemas
// ============================================================================

/**
 * GitHub push event commit schema
 */
export const GitHubCommitSchema = Type.Object({
  id: Type.String({ description: 'Commit SHA' }),
  tree_id: Type.String(),
  distinct: Type.Boolean(),
  message: Type.String({ description: 'Commit message' }),
  timestamp: Type.String({ format: 'date-time' }),
  url: Type.String({ format: 'uri' }),
  author: Type.Object({
    name: Type.String(),
    email: Type.String({ format: 'email' }),
    username: Type.Optional(Type.String()),
  }),
  committer: Type.Object({
    name: Type.String(),
    email: Type.String({ format: 'email' }),
    username: Type.Optional(Type.String()),
  }),
  added: Type.Array(Type.String()),
  removed: Type.Array(Type.String()),
  modified: Type.Array(Type.String()),
});

export type GitHubCommit = Static<typeof GitHubCommitSchema>;

/**
 * GitHub push event repository schema
 */
export const GitHubRepositorySchema = Type.Object({
  id: Type.Number(),
  node_id: Type.String(),
  name: Type.String(),
  full_name: Type.String(),
  private: Type.Boolean(),
  owner: Type.Object({
    login: Type.String(),
    id: Type.Number(),
    node_id: Type.String(),
    avatar_url: Type.String({ format: 'uri' }),
    type: Type.String(),
  }),
  html_url: Type.String({ format: 'uri' }),
  description: Type.Union([Type.String(), Type.Null()]),
  clone_url: Type.String({ format: 'uri' }),
  ssh_url: Type.String(),
  default_branch: Type.String(),
});

export type GitHubRepository = Static<typeof GitHubRepositorySchema>;

/**
 * GitHub push event payload schema
 */
export const GitHubPushPayloadSchema = Type.Object({
  ref: Type.String({ description: 'The full git ref that was pushed (e.g., refs/heads/main)' }),
  before: Type.String({ description: 'The SHA of the most recent commit before the push' }),
  after: Type.String({ description: 'The SHA of the most recent commit after the push' }),
  created: Type.Boolean(),
  deleted: Type.Boolean(),
  forced: Type.Boolean(),
  base_ref: Type.Union([Type.String(), Type.Null()]),
  compare: Type.String({ format: 'uri' }),
  commits: Type.Array(GitHubCommitSchema),
  head_commit: Type.Union([GitHubCommitSchema, Type.Null()]),
  repository: GitHubRepositorySchema,
  pusher: Type.Object({
    name: Type.String(),
    email: Type.Optional(Type.String({ format: 'email' })),
  }),
  sender: Type.Object({
    login: Type.String(),
    id: Type.Number(),
    node_id: Type.String(),
    avatar_url: Type.String({ format: 'uri' }),
    type: Type.String(),
  }),
  installation: Type.Optional(Type.Object({
    id: Type.Number(),
    node_id: Type.String(),
  })),
});

export type GitHubPushPayload = Static<typeof GitHubPushPayloadSchema>;

// ============================================================================
// GitLab Webhook Schemas
// ============================================================================

/**
 * GitLab push event commit schema
 */
export const GitLabCommitSchema = Type.Object({
  id: Type.String({ description: 'Commit SHA' }),
  message: Type.String(),
  title: Type.String(),
  timestamp: Type.String({ format: 'date-time' }),
  url: Type.String({ format: 'uri' }),
  author: Type.Object({
    name: Type.String(),
    email: Type.String({ format: 'email' }),
  }),
  added: Type.Array(Type.String()),
  modified: Type.Array(Type.String()),
  removed: Type.Array(Type.String()),
});

export type GitLabCommit = Static<typeof GitLabCommitSchema>;

/**
 * GitLab push event project schema
 */
export const GitLabProjectSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  web_url: Type.String({ format: 'uri' }),
  git_ssh_url: Type.String(),
  git_http_url: Type.String({ format: 'uri' }),
  namespace: Type.String(),
  visibility_level: Type.Number(),
  path_with_namespace: Type.String(),
  default_branch: Type.String(),
  homepage: Type.Optional(Type.String({ format: 'uri' })),
  url: Type.String(),
  ssh_url: Type.String(),
  http_url: Type.String({ format: 'uri' }),
});

export type GitLabProject = Static<typeof GitLabProjectSchema>;

/**
 * GitLab push event payload schema
 */
export const GitLabPushPayloadSchema = Type.Object({
  object_kind: Type.Literal('push'),
  event_name: Type.Literal('push'),
  before: Type.String({ description: 'SHA before the push' }),
  after: Type.String({ description: 'SHA after the push' }),
  ref: Type.String({ description: 'The full git ref that was pushed' }),
  checkout_sha: Type.Union([Type.String(), Type.Null()]),
  message: Type.Union([Type.String(), Type.Null()]),
  user_id: Type.Number(),
  user_name: Type.String(),
  user_username: Type.String(),
  user_email: Type.Optional(Type.String({ format: 'email' })),
  user_avatar: Type.Optional(Type.String({ format: 'uri' })),
  project_id: Type.Number(),
  project: GitLabProjectSchema,
  commits: Type.Array(GitLabCommitSchema),
  total_commits_count: Type.Number(),
  repository: Type.Object({
    name: Type.String(),
    url: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    homepage: Type.Optional(Type.String({ format: 'uri' })),
    git_http_url: Type.String({ format: 'uri' }),
    git_ssh_url: Type.String(),
    visibility_level: Type.Number(),
  }),
});

export type GitLabPushPayload = Static<typeof GitLabPushPayloadSchema>;

// ============================================================================
// Webhook Response Schemas
// ============================================================================

/**
 * Webhook acknowledgement response
 */
export const WebhookAckResponseSchema = Type.Object({
  received: Type.Literal(true),
  eventId: Type.String({ description: 'Unique event ID for tracking' }),
  action: Type.Union([
    Type.Literal('scan_triggered'),
    Type.Literal('ignored'),
    Type.Literal('queued'),
  ], { description: 'Action taken in response to webhook' }),
  scanId: Type.Optional(Type.String({ format: 'uuid', description: 'Scan ID if triggered' })),
  reason: Type.Optional(Type.String({ description: 'Reason if ignored' })),
});

export type WebhookAckResponse = Static<typeof WebhookAckResponseSchema>;

// ============================================================================
// Webhook Headers Schemas
// ============================================================================

/**
 * GitHub webhook headers
 */
export const GitHubWebhookHeadersSchema = Type.Object({
  'x-github-event': Type.String({ description: 'GitHub event type' }),
  'x-github-delivery': Type.String({ description: 'Unique delivery GUID' }),
  'x-hub-signature-256': Type.Optional(Type.String({ description: 'HMAC SHA-256 signature' })),
  'x-hub-signature': Type.Optional(Type.String({ description: 'HMAC SHA-1 signature (legacy)' })),
});

export type GitHubWebhookHeaders = Static<typeof GitHubWebhookHeadersSchema>;

/**
 * GitLab webhook headers
 */
export const GitLabWebhookHeadersSchema = Type.Object({
  'x-gitlab-event': Type.String({ description: 'GitLab event type' }),
  'x-gitlab-token': Type.Optional(Type.String({ description: 'Secret token for verification' })),
  'x-gitlab-instance': Type.Optional(Type.String({ description: 'GitLab instance URL' })),
});

export type GitLabWebhookHeaders = Static<typeof GitLabWebhookHeadersSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if payload is a GitHub push event
 */
export function isGitHubPushPayload(payload: unknown): payload is GitHubPushPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'ref' in payload &&
    'repository' in payload &&
    typeof (payload as GitHubPushPayload).repository.id === 'number'
  );
}

/**
 * Check if payload is a GitLab push event
 */
export function isGitLabPushPayload(payload: unknown): payload is GitLabPushPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'object_kind' in payload &&
    (payload as GitLabPushPayload).object_kind === 'push' &&
    'project' in payload
  );
}
