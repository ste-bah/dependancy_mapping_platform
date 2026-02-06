/**
 * GitLab Adapter
 * Implements GitAdapter interface for GitLab operations
 * @module adapters/git/gitlab
 */

import { Gitlab } from '@gitbeaker/rest';
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
const logger = pino({ name: 'gitlab-adapter' });

/**
 * Default webhook events to subscribe to
 */
const DEFAULT_WEBHOOK_EVENTS = ['push_events', 'merge_requests_events'];

/**
 * Rate limit retry configuration
 */
const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
};

/**
 * GitLab-specific error class
 */
export class GitLabError extends AppError {
  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message, statusCode, 'GITLAB_ERROR', details);
  }
}

/**
 * Rate limit exceeded error
 */
export class GitLabRateLimitError extends GitLabError {
  constructor(public readonly resetAt: Date) {
    super(
      `GitLab API rate limit exceeded. Resets at ${resetAt.toISOString()}`,
      429
    );
  }
}

/**
 * GitLab project response type
 */
interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  namespace: {
    path: string;
    full_path: string;
  };
  visibility: string;
  default_branch: string;
  http_url_to_repo: string;
  web_url: string;
  description: string | null;
  last_activity_at: string;
}

/**
 * GitLab commit response type
 */
interface GitLabCommit {
  id: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
}

/**
 * GitLab webhook response type
 */
interface GitLabWebhook {
  id: number;
  url: string;
  push_events: boolean;
  merge_requests_events: boolean;
  issues_events: boolean;
  tag_push_events: boolean;
  note_events: boolean;
  job_events: boolean;
  pipeline_events: boolean;
  wiki_page_events: boolean;
  deployment_events: boolean;
  releases_events: boolean;
  enable_ssl_verification: boolean;
}

/**
 * GitLab adapter implementation
 */
export class GitLabAdapter implements GitAdapter {
  readonly provider = 'gitlab' as const;
  private readonly client: InstanceType<typeof Gitlab>;
  private readonly instanceUrl: string;
  private lastRateLimitInfo: RateLimitInfo | null = null;

  constructor(token: string, instanceUrl: string = 'https://gitlab.com') {
    this.instanceUrl = instanceUrl.replace(/\/$/, ''); // Remove trailing slash
    this.client = new Gitlab({
      token: token,
      host: this.instanceUrl,
    });
  }

  /**
   * Create a new GitLabAdapter instance
   */
  static create(accessToken: string, instanceUrl?: string): GitLabAdapter {
    return new GitLabAdapter(accessToken, instanceUrl);
  }

  /**
   * Execute GitLab API request with rate limit handling
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
    if (error && typeof error === 'object') {
      const err = error as { status?: number; response?: { status?: number } };
      const status = err.status || err.response?.status;
      return status === 429;
    }
    return false;
  }

  /**
   * Extract rate limit reset time from error or response headers
   */
  private extractResetTime(error: unknown): Date {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response: { headers?: Record<string, string> } }).response;
      const resetHeader = response?.headers?.['ratelimit-reset'];
      if (resetHeader) {
        return new Date(parseInt(resetHeader, 10) * 1000);
      }
    }
    return new Date(Date.now() + RATE_LIMIT_CONFIG.baseDelayMs);
  }

  /**
   * Update rate limit info from response headers
   * Called internally when processing API responses
   */
  private updateRateLimitFromHeaders(headers: Record<string, string | undefined>): void {
    const remaining = headers['ratelimit-remaining'];
    const limit = headers['ratelimit-limit'];
    const reset = headers['ratelimit-reset'];

    if (remaining && limit && reset) {
      this.lastRateLimitInfo = {
        remaining: parseInt(remaining, 10),
        limit: parseInt(limit, 10),
        resetAt: new Date(parseInt(reset, 10) * 1000),
      };
    }
  }

  /**
   * Process response and extract rate limit headers
   * @internal
   */
  protected processResponseHeaders(response: { headers?: Record<string, string | undefined> }): void {
    if (response?.headers) {
      this.updateRateLimitFromHeaders(response.headers);
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
   * Transform GitLab API errors to application errors
   */
  private transformError(error: unknown): Error {
    if (error && typeof error === 'object') {
      const err = error as {
        status?: number;
        message?: string;
        response?: { status?: number; headers?: Record<string, string> };
      };
      const status = err.status || err.response?.status;

      if (status === 429) {
        const resetAt = this.extractResetTime(error);
        return new GitLabRateLimitError(resetAt);
      }

      if (status === 404) {
        return new GitLabError('Project not found', 404);
      }

      if (status === 401) {
        return new GitLabError('GitLab authentication failed', 401);
      }

      if (status === 403) {
        return new GitLabError('GitLab access forbidden', 403);
      }

      return new GitLabError(
        err.message || 'GitLab API error',
        status || 500
      );
    }

    return new GitLabError('Unknown GitLab error');
  }

  /**
   * Extract owner (namespace) from path_with_namespace
   * e.g., "group/subgroup/project" -> "group/subgroup"
   */
  private extractOwner(pathWithNamespace: string): string {
    const parts = pathWithNamespace.split('/');
    return parts.slice(0, -1).join('/');
  }

  /**
   * URL-encode project path for API requests
   */
  private encodeProjectPath(owner: string, name: string): string {
    const fullPath = owner ? `${owner}/${name}` : name;
    return encodeURIComponent(fullPath);
  }

  /**
   * Map GitLab project response to Repository interface
   */
  private mapProject(project: GitLabProject): Repository {
    return {
      id: project.id.toString(),
      name: project.name,
      fullName: project.path_with_namespace,
      owner: this.extractOwner(project.path_with_namespace),
      private: project.visibility === 'private',
      defaultBranch: project.default_branch || 'main',
      cloneUrl: project.http_url_to_repo,
      htmlUrl: project.web_url,
      description: project.description,
      updatedAt: new Date(project.last_activity_at),
    };
  }

  /**
   * List projects accessible to the authenticated user
   */
  async listRepositories(
    _userId: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<Repository[]> {
    return this.withRateLimitHandling(async () => {
      // Use offset pagination instead of keyset pagination
      // to support traditional page-based navigation
      const projects = await this.client.Projects.all({
        membership: true,
        orderBy: 'last_activity_at',
        sort: 'desc',
        perPage,
        maxPages: 1,
        showExpanded: false,
        pagination: 'offset',
        page,
      } as Parameters<typeof this.client.Projects.all>[0]) as unknown as GitLabProject[];

      logger.debug(
        { count: projects.length, page },
        'Listed projects'
      );

      return projects.map((project) => this.mapProject(project));
    });
  }

  /**
   * Get a specific project by owner (namespace) and name
   */
  async getRepository(owner: string, name: string): Promise<Repository> {
    return this.withRateLimitHandling(async () => {
      const projectPath = this.encodeProjectPath(owner, name);
      const project = await this.client.Projects.show(projectPath) as unknown as GitLabProject;

      logger.debug({ owner, name }, 'Fetched project');

      return this.mapProject(project);
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
    // Allow forward slashes for GitLab namespace paths
    const sanitizedFullName = repo.fullName.replace(/[;&|`$()]/g, '');

    // Extract host from instance URL
    const instanceHost = new URL(this.instanceUrl).host;

    // Construct authenticated clone URL for GitLab
    // Format: https://oauth2:{token}@{host}/{path}.git
    const cloneUrl = `https://oauth2:${accessToken}@${instanceHost}/${sanitizedFullName}.git`;

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

      throw new GitLabError(`Failed to clone repository: ${sanitizedError}`, 500);
    }
  }

  /**
   * Register a webhook for project events
   */
  async registerWebhook(
    repo: Repository,
    callbackUrl: string,
    secret: string,
    events: string[] = DEFAULT_WEBHOOK_EVENTS
  ): Promise<WebhookResult> {
    return this.withRateLimitHandling(async () => {
      const projectPath = this.encodeProjectPath(repo.owner, repo.name);

      // Build webhook configuration based on requested events
      const webhookConfig: Record<string, unknown> = {
        url: callbackUrl,
        token: secret, // GitLab uses 'token' field for webhook secret
        enableSslVerification: true,
        pushEvents: events.includes('push_events') || events.includes('push'),
        mergeRequestsEvents: events.includes('merge_requests_events') || events.includes('merge_request'),
        issuesEvents: events.includes('issues_events') || events.includes('issues'),
        tagPushEvents: events.includes('tag_push_events') || events.includes('tag_push'),
        noteEvents: events.includes('note_events') || events.includes('note'),
        pipelineEvents: events.includes('pipeline_events') || events.includes('pipeline'),
        jobEvents: events.includes('job_events') || events.includes('job'),
        wikiPageEvents: events.includes('wiki_page_events') || events.includes('wiki_page'),
        deploymentEvents: events.includes('deployment_events') || events.includes('deployment'),
        releasesEvents: events.includes('releases_events') || events.includes('releases'),
      };

      const webhook = await this.client.ProjectHooks.add(
        projectPath,
        callbackUrl,
        webhookConfig
      ) as unknown as GitLabWebhook;

      logger.info(
        { repo: repo.fullName, webhookId: webhook.id },
        'Webhook registered'
      );

      // Map GitLab webhook response to normalized events list
      const activeEvents: string[] = [];
      if (webhook.push_events) activeEvents.push('push_events');
      if (webhook.merge_requests_events) activeEvents.push('merge_requests_events');
      if (webhook.issues_events) activeEvents.push('issues_events');
      if (webhook.tag_push_events) activeEvents.push('tag_push_events');
      if (webhook.note_events) activeEvents.push('note_events');
      if (webhook.pipeline_events) activeEvents.push('pipeline_events');
      if (webhook.job_events) activeEvents.push('job_events');
      if (webhook.wiki_page_events) activeEvents.push('wiki_page_events');
      if (webhook.deployment_events) activeEvents.push('deployment_events');
      if (webhook.releases_events) activeEvents.push('releases_events');

      return {
        id: webhook.id.toString(),
        url: webhook.url,
        events: activeEvents,
        active: true,
      };
    });
  }

  /**
   * Delete a webhook from a project
   */
  async deleteWebhook(repo: Repository, webhookId: string): Promise<void> {
    return this.withRateLimitHandling(async () => {
      const projectPath = this.encodeProjectPath(repo.owner, repo.name);

      await this.client.ProjectHooks.remove(
        projectPath,
        parseInt(webhookId, 10)
      );

      logger.info(
        { repo: repo.fullName, webhookId },
        'Webhook deleted'
      );
    });
  }

  /**
   * Get the default branch of a project
   */
  async getDefaultBranch(repo: Repository): Promise<string> {
    return this.withRateLimitHandling(async () => {
      const projectPath = this.encodeProjectPath(repo.owner, repo.name);
      const project = await this.client.Projects.show(projectPath) as unknown as GitLabProject;

      return project.default_branch || 'main';
    });
  }

  /**
   * Get the latest commit on a branch
   */
  async getLatestCommit(repo: Repository, branch: string): Promise<Commit> {
    return this.withRateLimitHandling(async () => {
      const projectPath = this.encodeProjectPath(repo.owner, repo.name);
      const commits = await this.client.Commits.all(projectPath, {
        refName: branch,
        perPage: 1,
      }) as unknown as GitLabCommit[];

      if (!commits || commits.length === 0) {
        throw new GitLabError(`No commits found on branch ${branch}`, 404);
      }

      const commit = commits[0];

      return {
        sha: commit.id,
        message: commit.message,
        author: {
          name: commit.author_name || 'Unknown',
          email: commit.author_email || 'unknown@unknown.com',
          date: new Date(commit.authored_date),
        },
      };
    });
  }

  /**
   * Get current rate limit status
   * GitLab returns rate limit info in response headers
   * This returns the last known rate limit info or makes a lightweight API call
   */
  async getRateLimitStatus(): Promise<RateLimitInfo> {
    // If we have cached rate limit info, return it
    if (this.lastRateLimitInfo) {
      return this.lastRateLimitInfo;
    }

    // Make a lightweight API call to get rate limit headers
    // Use the current user endpoint as it's a simple authenticated call
    try {
      await this.client.Users.showCurrentUser();

      // If we still don't have rate limit info after the call,
      // return default values (GitLab may not always return these headers)
      if (!this.lastRateLimitInfo) {
        return {
          remaining: 2000, // GitLab default for authenticated users
          limit: 2000,
          resetAt: new Date(Date.now() + 60000), // 1 minute from now
        };
      }

      return this.lastRateLimitInfo;
    } catch (error) {
      // If the call fails, return conservative defaults
      logger.warn({ error }, 'Failed to fetch rate limit status');
      return {
        remaining: 100,
        limit: 2000,
        resetAt: new Date(Date.now() + 60000),
      };
    }
  }
}

/**
 * Factory function to create GitLab adapter
 */
export function createGitLabAdapter(accessToken: string, instanceUrl?: string): GitLabAdapter {
  return GitLabAdapter.create(accessToken, instanceUrl);
}
