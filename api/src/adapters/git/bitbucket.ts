/**
 * Bitbucket Adapter
 * Implements GitAdapter interface for Bitbucket operations
 * @module adapters/git/bitbucket
 */

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
const logger = pino({ name: 'bitbucket-adapter' });

/**
 * Bitbucket API base URL
 */
const BITBUCKET_API_BASE = 'https://api.bitbucket.org/2.0';

/**
 * Default webhook events to subscribe to
 */
const DEFAULT_WEBHOOK_EVENTS = ['repo:push', 'pullrequest:created', 'pullrequest:updated'];

/**
 * Rate limit retry configuration
 */
const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
};

/**
 * Bitbucket-specific error class
 */
export class BitbucketError extends AppError {
  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message, statusCode, 'BITBUCKET_ERROR', details);
  }
}

/**
 * Rate limit exceeded error
 */
export class BitbucketRateLimitError extends BitbucketError {
  constructor(public readonly resetAt: Date) {
    super(
      `Bitbucket API rate limit exceeded. Resets at ${resetAt.toISOString()}`,
      429
    );
  }
}

/**
 * Bitbucket repository response type
 */
interface BitbucketRepository {
  uuid: string;
  name: string;
  slug: string;
  full_name: string;
  is_private: boolean;
  mainbranch?: {
    name: string;
    type: string;
  };
  links: {
    clone: Array<{ href: string; name: string }>;
    html: { href: string };
  };
  description: string;
  updated_on: string;
  workspace: {
    slug: string;
    name: string;
    uuid: string;
  };
  owner?: {
    username?: string;
    display_name?: string;
    nickname?: string;
    uuid: string;
  };
}

/**
 * Bitbucket commit response type
 */
interface BitbucketCommit {
  hash: string;
  message: string;
  author: {
    raw: string;
    user?: {
      display_name: string;
      nickname: string;
    };
  };
  date: string;
}

/**
 * Bitbucket webhook response type
 */
interface BitbucketWebhook {
  uuid: string;
  url: string;
  events: string[];
  active: boolean;
  description?: string;
}

/**
 * Bitbucket paginated response type
 */
interface BitbucketPaginatedResponse<T> {
  values: T[];
  page?: number;
  size: number;
  pagelen: number;
  next?: string;
  previous?: string;
}

/**
 * Bitbucket workspace permission response
 */
interface BitbucketWorkspacePermission {
  workspace: {
    slug: string;
    name: string;
    uuid: string;
  };
  permission: string;
}

/**
 * Bitbucket adapter implementation
 */
export class BitbucketAdapter implements GitAdapter {
  readonly provider = 'bitbucket' as const;
  private readonly accessToken: string;
  private lastRateLimitInfo: RateLimitInfo | null = null;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Create a new BitbucketAdapter instance
   */
  static create(accessToken: string): BitbucketAdapter {
    return new BitbucketAdapter(accessToken);
  }

  /**
   * Make authenticated request to Bitbucket API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${BITBUCKET_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    // Update rate limit info from headers
    this.updateRateLimitFromHeaders(response.headers);

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Bitbucket API error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // Use default error message
      }

      throw this.createErrorFromResponse(response.status, errorMessage, errorBody);
    }

    // Handle empty responses (e.g., DELETE requests)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Create appropriate error from response status
   */
  private createErrorFromResponse(
    status: number,
    message: string,
    details?: unknown
  ): Error {
    switch (status) {
      case 429:
        const resetAt = this.lastRateLimitInfo?.resetAt || new Date(Date.now() + 60000);
        return new BitbucketRateLimitError(resetAt);
      case 404:
        return new BitbucketError('Repository not found', 404, details);
      case 401:
        return new BitbucketError('Bitbucket authentication failed', 401, details);
      case 403:
        return new BitbucketError('Bitbucket access forbidden', 403, details);
      default:
        return new BitbucketError(message, status, details);
    }
  }

  /**
   * Execute Bitbucket API request with rate limit handling
   */
  private async withRateLimitHandling<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof BitbucketRateLimitError && retryCount < RATE_LIMIT_CONFIG.maxRetries) {
        const delayMs = this.calculateRetryDelay(error.resetAt, retryCount);

        logger.warn(
          { resetAt: error.resetAt, delayMs, retryCount },
          'Rate limit hit, retrying after delay'
        );

        await this.delay(delayMs);
        return this.withRateLimitHandling(operation, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimitFromHeaders(headers: Headers): void {
    // Bitbucket uses different header names
    const remaining = headers.get('x-ratelimit-remaining');
    const limit = headers.get('x-ratelimit-limit');
    const reset = headers.get('x-ratelimit-reset');

    if (remaining && limit) {
      this.lastRateLimitInfo = {
        remaining: parseInt(remaining, 10),
        limit: parseInt(limit, 10),
        resetAt: reset ? new Date(parseInt(reset, 10) * 1000) : new Date(Date.now() + 3600000),
      };
    }
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
   * Extract HTTPS clone URL from repository links
   */
  private getCloneUrl(repo: BitbucketRepository): string {
    const httpsLink = repo.links.clone?.find((link) => link.name === 'https');
    if (httpsLink) {
      return httpsLink.href;
    }
    // Fallback: construct URL from full_name
    return `https://bitbucket.org/${repo.full_name}.git`;
  }

  /**
   * Extract owner (workspace) from repository
   */
  private getOwner(repo: BitbucketRepository): string {
    return repo.workspace?.slug || repo.full_name.split('/')[0];
  }

  /**
   * Map Bitbucket repository response to Repository interface
   */
  private mapRepository(repo: BitbucketRepository): Repository {
    return {
      id: repo.uuid,
      name: repo.name,
      fullName: repo.full_name,
      owner: this.getOwner(repo),
      private: repo.is_private,
      defaultBranch: repo.mainbranch?.name || 'main',
      cloneUrl: this.getCloneUrl(repo),
      htmlUrl: repo.links.html?.href || `https://bitbucket.org/${repo.full_name}`,
      description: repo.description || null,
      updatedAt: new Date(repo.updated_on),
    };
  }

  /**
   * Parse author info from Bitbucket raw format
   * Format: "Name <email@example.com>"
   */
  private parseAuthor(raw: string): { name: string; email: string } {
    const match = raw.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: raw, email: 'unknown@unknown.com' };
  }

  /**
   * Get list of accessible workspaces
   */
  private async getWorkspaces(): Promise<string[]> {
    const response = await this.request<BitbucketPaginatedResponse<BitbucketWorkspacePermission>>(
      '/user/permissions/workspaces'
    );

    return response.values.map((perm) => perm.workspace.slug);
  }

  /**
   * List repositories accessible to the authenticated user
   * Fetches repositories across all accessible workspaces
   */
  async listRepositories(
    _userId: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<Repository[]> {
    return this.withRateLimitHandling(async () => {
      const repositories: Repository[] = [];

      // Get all accessible workspaces
      const workspaces = await this.getWorkspaces();

      logger.debug({ workspaceCount: workspaces.length }, 'Fetched accessible workspaces');

      // Fetch repositories from each workspace
      for (const workspace of workspaces) {
        try {
          const response = await this.request<BitbucketPaginatedResponse<BitbucketRepository>>(
            `/repositories/${encodeURIComponent(workspace)}?page=${page}&pagelen=${perPage}&sort=-updated_on`
          );

          const mapped = response.values.map((repo) => this.mapRepository(repo));
          repositories.push(...mapped);
        } catch (error) {
          // Log but continue with other workspaces
          logger.warn(
            { workspace, error: error instanceof Error ? error.message : 'Unknown error' },
            'Failed to fetch repositories from workspace'
          );
        }
      }

      // Sort by updatedAt descending and limit to perPage
      repositories.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const paginatedRepos = repositories.slice(0, perPage);

      logger.debug(
        { count: paginatedRepos.length, page },
        'Listed repositories'
      );

      return paginatedRepos;
    });
  }

  /**
   * Get a specific repository by owner (workspace) and name (slug)
   */
  async getRepository(owner: string, name: string): Promise<Repository> {
    return this.withRateLimitHandling(async () => {
      const response = await this.request<BitbucketRepository>(
        `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
      );

      logger.debug({ owner, name }, 'Fetched repository');

      return this.mapRepository(response);
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

    // Construct authenticated clone URL for Bitbucket
    // Format: https://x-token-auth:{token}@bitbucket.org/{workspace}/{repo_slug}.git
    const cloneUrl = `https://x-token-auth:${accessToken}@bitbucket.org/${sanitizedOwner}/${sanitizedName}.git`;

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

      throw new BitbucketError(`Failed to clone repository: ${sanitizedError}`, 500);
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
      const webhookPayload = {
        description: 'DMP Code Reviewer Webhook',
        url: callbackUrl,
        active: true,
        events,
        // Bitbucket uses 'secret' in the callback URL or as a separate auth mechanism
        // The secret is used to validate incoming webhook payloads
        secret,
      };

      const response = await this.request<BitbucketWebhook>(
        `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/hooks`,
        {
          method: 'POST',
          body: JSON.stringify(webhookPayload),
        }
      );

      logger.info(
        { repo: repo.fullName, webhookId: response.uuid },
        'Webhook registered'
      );

      return {
        id: response.uuid,
        url: response.url,
        events: response.events,
        active: response.active,
      };
    });
  }

  /**
   * Delete a webhook from a repository
   */
  async deleteWebhook(repo: Repository, webhookId: string): Promise<void> {
    return this.withRateLimitHandling(async () => {
      // Bitbucket webhook UUIDs include curly braces, ensure proper encoding
      const encodedWebhookId = encodeURIComponent(webhookId);

      await this.request<void>(
        `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/hooks/${encodedWebhookId}`,
        {
          method: 'DELETE',
        }
      );

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
      const response = await this.request<BitbucketRepository>(
        `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`
      );

      return response.mainbranch?.name || 'main';
    });
  }

  /**
   * Get the latest commit on a branch
   */
  async getLatestCommit(repo: Repository, branch: string): Promise<Commit> {
    return this.withRateLimitHandling(async () => {
      const response = await this.request<BitbucketPaginatedResponse<BitbucketCommit>>(
        `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits/${encodeURIComponent(branch)}?pagelen=1`
      );

      if (!response.values || response.values.length === 0) {
        throw new BitbucketError(`No commits found on branch ${branch}`, 404);
      }

      const commit = response.values[0];
      const author = this.parseAuthor(commit.author.raw);

      return {
        sha: commit.hash,
        message: commit.message,
        author: {
          name: commit.author.user?.display_name || author.name,
          email: author.email,
          date: new Date(commit.date),
        },
      };
    });
  }

  /**
   * Get current rate limit status
   * Bitbucket returns rate limit info in response headers
   */
  async getRateLimitStatus(): Promise<RateLimitInfo> {
    // If we have cached rate limit info, return it
    if (this.lastRateLimitInfo) {
      return this.lastRateLimitInfo;
    }

    // Make a lightweight API call to get rate limit headers
    try {
      await this.request<unknown>('/user');

      // If we still don't have rate limit info after the call,
      // return default values (Bitbucket may not always return these headers)
      if (!this.lastRateLimitInfo) {
        return {
          remaining: 1000, // Bitbucket default
          limit: 1000,
          resetAt: new Date(Date.now() + 3600000), // 1 hour from now
        };
      }

      return this.lastRateLimitInfo;
    } catch (error) {
      // If the call fails, return conservative defaults
      logger.warn({ error }, 'Failed to fetch rate limit status');
      return {
        remaining: 100,
        limit: 1000,
        resetAt: new Date(Date.now() + 3600000),
      };
    }
  }
}

/**
 * Factory function to create Bitbucket adapter
 */
export function createBitbucketAdapter(accessToken: string): BitbucketAdapter {
  return BitbucketAdapter.create(accessToken);
}
