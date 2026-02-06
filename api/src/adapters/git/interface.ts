/**
 * Git Adapter Interface
 * Provider-agnostic interface for Git operations
 * @module adapters/git/interface
 */

/**
 * Repository representation
 */
export interface Repository {
  /** Unique identifier from the Git provider */
  id: string;
  /** Repository name (e.g., "my-repo") */
  name: string;
  /** Full name including owner (e.g., "owner/my-repo") */
  fullName: string;
  /** Repository owner (user or organization) */
  owner: string;
  /** Whether the repository is private */
  private: boolean;
  /** Default branch name (e.g., "main" or "master") */
  defaultBranch: string;
  /** Clone URL for the repository */
  cloneUrl: string;
  /** Web URL for browsing the repository */
  htmlUrl: string;
  /** Repository description */
  description: string | null;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Commit information
 */
export interface Commit {
  /** Commit SHA hash */
  sha: string;
  /** Commit message */
  message: string;
  /** Author information */
  author: {
    name: string;
    email: string;
    date: Date;
  };
}

/**
 * Webhook registration result
 */
export interface WebhookResult {
  /** Webhook ID from the provider */
  id: string;
  /** Webhook URL */
  url: string;
  /** Events the webhook is subscribed to */
  events: string[];
  /** Whether the webhook is active */
  active: boolean;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Remaining requests */
  remaining: number;
  /** Request limit */
  limit: number;
  /** Reset timestamp */
  resetAt: Date;
}

/**
 * Git provider type
 */
export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

/**
 * Provider-agnostic Git adapter interface
 * All Git provider implementations must implement this interface
 */
export interface GitAdapter {
  /** The Git provider this adapter handles */
  readonly provider: GitProvider;

  /**
   * List repositories accessible to the user
   * @param userId - The user's ID for fetching their repos
   * @param page - Page number for pagination (1-indexed)
   * @param perPage - Number of results per page
   * @returns Array of repositories
   */
  listRepositories(userId: string, page?: number, perPage?: number): Promise<Repository[]>;

  /**
   * Get a specific repository by owner and name
   * @param owner - Repository owner
   * @param name - Repository name
   * @returns Repository details
   */
  getRepository(owner: string, name: string): Promise<Repository>;

  /**
   * Clone a repository to a target path
   * @param repo - Repository to clone
   * @param targetPath - Local path to clone to
   * @param accessToken - Access token for authentication
   * @returns Path to cloned repository
   */
  cloneRepository(repo: Repository, targetPath: string, accessToken: string): Promise<string>;

  /**
   * Register a webhook for repository events
   * @param repo - Repository to register webhook for
   * @param callbackUrl - URL to receive webhook events
   * @param secret - Secret for webhook signature verification
   * @param events - Events to subscribe to
   * @returns Webhook registration result
   */
  registerWebhook(
    repo: Repository,
    callbackUrl: string,
    secret: string,
    events?: string[]
  ): Promise<WebhookResult>;

  /**
   * Delete a webhook from a repository
   * @param repo - Repository containing the webhook
   * @param webhookId - ID of the webhook to delete
   */
  deleteWebhook(repo: Repository, webhookId: string): Promise<void>;

  /**
   * Get the default branch of a repository
   * @param repo - Repository to query
   * @returns Default branch name
   */
  getDefaultBranch(repo: Repository): Promise<string>;

  /**
   * Get the latest commit on a branch
   * @param repo - Repository to query
   * @param branch - Branch name
   * @returns Latest commit information
   */
  getLatestCommit(repo: Repository, branch: string): Promise<Commit>;

  /**
   * Get current rate limit status
   * @returns Rate limit information
   */
  getRateLimitStatus(): Promise<RateLimitInfo>;
}
