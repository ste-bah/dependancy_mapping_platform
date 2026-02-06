/**
 * Git Adapters Module
 * Exports all Git adapter implementations
 * @module adapters/git
 */

// Interface exports
export type {
  Repository,
  Commit,
  WebhookResult,
  RateLimitInfo,
  GitProvider,
  GitAdapter,
} from './interface.js';

// GitHub adapter exports
export { GitHubAdapter, GitHubError, RateLimitError } from './github.js';

// GitLab adapter exports
export {
  GitLabAdapter,
  GitLabError,
  GitLabRateLimitError,
  createGitLabAdapter,
} from './gitlab.js';

// Bitbucket adapter exports
export {
  BitbucketAdapter,
  BitbucketError,
  BitbucketRateLimitError,
  createBitbucketAdapter,
} from './bitbucket.js';
