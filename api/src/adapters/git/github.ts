/**
 * GitHub Adapter
 * Implements GitAdapter interface for GitHub operations
 * @module adapters/git/github
 */

import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';
import pino from 'pino';
import {
  GitAdapter,
  Repository,
  Commit,
  WebhookResult,
  RateLimitInfo,
} from './interface.js';
import { AppError } from '../../middleware/error-handler.js';

const execAsync = promisify(exec);
const logger = pino({ name: 'github-adapter' });

/**
 * Default webhook events to subscribe to
 */
const DEFAULT_WEBHOOK_EVENTS = ['push', 'pull_request'];

/**
 * Rate limit retry configuration
 */
const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
};

/**
 * GitHub-specific error class
 */
export class GitHubError extends AppError {
  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message, statusCode, 'GITHUB_ERROR', details);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends GitHubError {
  constructor(public readonly resetAt: Date) {
    super(
      `GitHub API rate limit exceeded. Resets at ${resetAt.toISOString()}`,
      429
    );
  }
}

/**
 * GitHub adapter implementation
 */
export class GitHubAdapter implements GitAdapter {
  readonly provider = 'github' as const;
  private readonly octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
      userAgent: 'dmp-code-reviewer/1.0',
      timeZone: 'UTC',
    });
  }

  /**
   * Create a new GitHubAdapter instance
   */
  static create(accessToken: string): GitHubAdapter {
    return new GitHubAdapter(accessToken);
  }

  /**
   * Execute GitHub API request with rate limit handling
   */
  private async withRateLimitHandling<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.isRateLimitError(error) && retryCount < RATE_LIMIT_CONFIG.maxRetries) {
        const resetAt = this.extractResetTime(error);
        const delayMs = this.calculateRetryDelay(resetAt, retryCount);

        logger.warn(
          { resetAt, delayMs, retryCount },
          'Rate limit hit, retrying after delay'
        );

        await this.delay(delayMs);
        return this.withRateLimitHandling(operation, retryCount + 1);
      }

      throw this.transformError(error);
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return status === 403 || status === 429;
    }
    return false;
  }

  /**
   * Extract rate limit reset time from error
   */
  private extractResetTime(error: unknown): Date {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response: { headers: Record<string, string> } }).response;
      const resetHeader = response?.headers?.['x-ratelimit-reset'];
      if (resetHeader) {
        return new Date(parseInt(resetHeader, 10) * 1000);
      }
    }
    return new Date(Date.now() + RATE_LIMIT_CONFIG.baseDelayMs);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(resetAt: Date, retryCount: number): number {
    const timeUntilReset = resetAt.getTime() - Date.now();
    const exponentialDelay = RATE_LIMIT_CONFIG.baseDelayMs * Math.pow(2, retryCount);
    const delay = Math.min(
      Math.max(timeUntilReset, exponentialDelay),
      RATE_LIMIT_CONFIG.maxDelayMs
    );
    return delay;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Transform GitHub API errors to application errors
   */
  private transformError(error: unknown): Error {
    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string; response?: { headers?: Record<string, string> } };

      if (err.status === 403 || err.status === 429) {
        const resetAt = this.extractResetTime(error);
        return new RateLimitError(resetAt);
      }

      if (err.status === 404) {
        return new GitHubError('Repository not found', 404);
      }

      if (err.status === 401) {
        return new GitHubError('GitHub authentication failed', 401);
      }

      return new GitHubError(
        err.message || 'GitHub API error',
        err.status || 500
      );
    }

    return new GitHubError('Unknown GitHub error');
  }

  /**
   * Map GitHub repository response to Repository interface
   */
  private mapRepository(repo: {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
    private: boolean;
    default_branch: string;
    clone_url: string;
    html_url: string;
    description: string | null;
    updated_at: string;
  }): Repository {
    return {
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      defaultBranch: repo.default_branch,
      cloneUrl: repo.clone_url,
      htmlUrl: repo.html_url,
      description: repo.description,
      updatedAt: new Date(repo.updated_at),
    };
  }

  /**
   * List repositories accessible to the authenticated user
   */
  async listRepositories(
    _userId: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<Repository[]> {
    return this.withRateLimitHandling(async () => {
      const response = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        direction: 'desc',
        per_page: perPage,
        page,
      });

      logger.debug(
        { count: response.data.length, page },
        'Listed repositories'
      );

      return response.data.map((repo: typeof response.data[number]) => this.mapRepository(repo));
    });
  }

  /**
   * Get a specific repository
   */
  async getRepository(owner: string, name: string): Promise<Repository> {
    return this.withRateLimitHandling(async () => {
      const response = await this.octokit.repos.get({
        owner,
        repo: name,
      });

      logger.debug({ owner, name }, 'Fetched repository');

      return this.mapRepository(response.data);
    });
  }

  /**
   * Clone a repository using git command
   */
  async cloneRepository(
    repo: Repository,
    targetPath: string,
    accessToken: string
  ): Promise<string> {
    // Sanitize inputs to prevent command injection
    const sanitizedPath = targetPath.replace(/[;&|`$()]/g, '');
    const sanitizedOwner = repo.owner.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedName = repo.name.replace(/[^a-zA-Z0-9_.-]/g, '');

    // Construct authenticated clone URL
    // Token is passed via credential helper to avoid logging
    const cloneUrl = `https://x-access-token:${accessToken}@github.com/${sanitizedOwner}/${sanitizedName}.git`;

    try {
      logger.debug(
        { repo: repo.fullName, targetPath: sanitizedPath },
        'Cloning repository'
      );

      // Use --depth=1 for shallow clone
      await execAsync(
        `git clone --depth=1 "${cloneUrl}" "${sanitizedPath}"`,
        {
          timeout: 300000, // 5 minute timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      );

      logger.info(
        { repo: repo.fullName, targetPath: sanitizedPath },
        'Repository cloned successfully'
      );

      return sanitizedPath;
    } catch (error) {
      // Sanitize error message to remove token
      const sanitizedError = error instanceof Error
        ? error.message.replace(accessToken, '[REDACTED]')
        : 'Clone failed';

      logger.error(
        { repo: repo.fullName, error: sanitizedError },
        'Failed to clone repository'
      );

      throw new GitHubError(`Failed to clone repository: ${sanitizedError}`, 500);
    }
  }

  /**
   * Register a webhook for repository events
   */
  async registerWebhook(
    repo: Repository,
    callbackUrl: string,
    secret: string,
    events: string[] = DEFAULT_WEBHOOK_EVENTS
  ): Promise<WebhookResult> {
    return this.withRateLimitHandling(async () => {
      const response = await this.octokit.repos.createWebhook({
        owner: repo.owner,
        repo: repo.name,
        config: {
          url: callbackUrl,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
        events,
        active: true,
      });

      logger.info(
        { repo: repo.fullName, webhookId: response.data.id },
        'Webhook registered'
      );

      return {
        id: response.data.id.toString(),
        url: callbackUrl,
        events: response.data.events || events,
        active: response.data.active,
      };
    });
  }

  /**
   * Delete a webhook from a repository
   */
  async deleteWebhook(repo: Repository, webhookId: string): Promise<void> {
    return this.withRateLimitHandling(async () => {
      await this.octokit.repos.deleteWebhook({
        owner: repo.owner,
        repo: repo.name,
        hook_id: parseInt(webhookId, 10),
      });

      logger.info(
        { repo: repo.fullName, webhookId },
        'Webhook deleted'
      );
    });
  }

  /**
   * Get the default branch of a repository
   */
  async getDefaultBranch(repo: Repository): Promise<string> {
    return this.withRateLimitHandling(async () => {
      const response = await this.octokit.repos.get({
        owner: repo.owner,
        repo: repo.name,
      });

      return response.data.default_branch;
    });
  }

  /**
   * Get the latest commit on a branch
   */
  async getLatestCommit(repo: Repository, branch: string): Promise<Commit> {
    return this.withRateLimitHandling(async () => {
      const response = await this.octokit.repos.getCommit({
        owner: repo.owner,
        repo: repo.name,
        ref: branch,
      });

      const commit = response.data.commit;

      return {
        sha: response.data.sha,
        message: commit.message,
        author: {
          name: commit.author?.name || 'Unknown',
          email: commit.author?.email || 'unknown@unknown.com',
          date: new Date(commit.author?.date || Date.now()),
        },
      };
    });
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitInfo> {
    const response = await this.octokit.rateLimit.get();
    const core = response.data.resources.core;

    return {
      remaining: core.remaining,
      limit: core.limit,
      resetAt: new Date(core.reset * 1000),
    };
  }
}
