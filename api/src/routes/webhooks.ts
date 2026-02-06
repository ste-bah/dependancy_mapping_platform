/**
 * Webhook Routes
 * @module routes/webhooks
 *
 * REST API endpoints for receiving webhooks from Git providers.
 * Handles push events to trigger automatic scans.
 *
 * Endpoints:
 * - POST /api/v1/webhooks/github - GitHub push webhook
 * - POST /api/v1/webhooks/gitlab - GitLab push webhook
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import crypto from 'crypto';
import {
  AppError,
  UnauthorizedError,
  ValidationError,
} from '../middleware/error-handler.js';
import {
  ErrorResponseSchema,
} from './schemas/common.js';
import {
  GitHubPushPayloadSchema,
  GitLabPushPayloadSchema,
  WebhookAckResponseSchema,
  isGitHubPushPayload,
  isGitLabPushPayload,
  type GitHubPushPayload,
  type GitLabPushPayload,
  type WebhookAckResponse,
} from './schemas/webhook.js';
import { Type } from '@sinclair/typebox';

const logger = pino({ name: 'webhook-routes' });

// ============================================================================
// Signature Verification Utilities
// ============================================================================

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  // Support both SHA-1 (legacy) and SHA-256
  const isSha256 = signature.startsWith('sha256=');
  const algorithm = isSha256 ? 'sha256' : 'sha1';
  const prefix = isSha256 ? 'sha256=' : 'sha1=';

  const expectedSignature = prefix + crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify GitLab webhook token
 */
function verifyGitLabToken(
  receivedToken: string | undefined,
  expectedToken: string
): boolean {
  if (!receivedToken || !expectedToken) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(receivedToken),
    Buffer.from(expectedToken)
  );
}

/**
 * Extract branch name from git ref
 */
function extractBranchName(ref: string): string | null {
  const match = ref.match(/^refs\/heads\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Check if push affects IaC files
 */
function hasIaCChanges(commits: Array<{ added: string[]; modified: string[]; removed: string[] }>): boolean {
  const iacPatterns = [
    /\.tf$/,
    /\.tfvars$/,
    /\.yaml$/,
    /\.yml$/,
    /Chart\.yaml$/,
    /values\.yaml$/,
    /kustomization\.yaml$/,
    /\.json$/, // CloudFormation
  ];

  for (const commit of commits) {
    const allFiles = [...commit.added, ...commit.modified, ...commit.removed];
    for (const file of allFiles) {
      if (iacPatterns.some(pattern => pattern.test(file))) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Route Implementation
// ============================================================================

/**
 * Webhook routes plugin
 */
const webhookRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * POST /api/v1/webhooks/github - GitHub push webhook
   */
  fastify.post<{
    Body: GitHubPushPayload;
    Headers: {
      'x-github-event'?: string;
      'x-github-delivery'?: string;
      'x-hub-signature-256'?: string;
      'x-hub-signature'?: string;
    };
  }>('/github', {
    schema: {
      description: 'Receive GitHub push webhook events',
      tags: ['Webhooks'],
      // Note: We use permissive body schema since GitHub sends various event types
      body: Type.Unknown(),
      response: {
        200: WebhookAckResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    // Skip auth middleware - webhooks use signature verification
    config: {
      rawBody: true, // Need raw body for signature verification
    },
  }, async (request, reply): Promise<WebhookAckResponse> => {
    const eventType = request.headers['x-github-event'];
    const deliveryId = request.headers['x-github-delivery'] || crypto.randomUUID();
    const signature = request.headers['x-hub-signature-256'] || request.headers['x-hub-signature'];

    logger.info({ eventType, deliveryId }, 'Received GitHub webhook');

    // Only process push events
    if (eventType !== 'push') {
      logger.debug({ eventType, deliveryId }, 'Ignoring non-push event');
      return {
        received: true,
        eventId: deliveryId,
        action: 'ignored',
        reason: `Event type '${eventType}' is not handled`,
      };
    }

    // Validate payload structure
    const payload = request.body;
    if (!isGitHubPushPayload(payload)) {
      throw new ValidationError('Invalid GitHub push payload structure');
    }

    // Get webhook secret for the repository
    // TODO: Look up webhook secret from repository config
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret) {
      const rawBody = JSON.stringify(payload);
      if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
        logger.warn({ deliveryId, repoId: payload.repository.id }, 'Invalid webhook signature');
        throw new UnauthorizedError('Invalid webhook signature');
      }
    }

    // Extract repository info
    const repo = payload.repository;
    const branch = extractBranchName(payload.ref);

    logger.info({
      deliveryId,
      repo: repo.full_name,
      branch,
      commits: payload.commits.length,
      after: payload.after,
    }, 'Processing GitHub push event');

    // Check if this is a branch deletion
    if (payload.deleted) {
      logger.debug({ deliveryId, branch }, 'Ignoring branch deletion');
      return {
        received: true,
        eventId: deliveryId,
        action: 'ignored',
        reason: 'Branch deletion events are not processed',
      };
    }

    // Check if push contains IaC changes
    if (!hasIaCChanges(payload.commits)) {
      logger.debug({ deliveryId, branch }, 'No IaC file changes detected');
      return {
        received: true,
        eventId: deliveryId,
        action: 'ignored',
        reason: 'No IaC file changes detected in commits',
      };
    }

    // TODO: Look up repository in database
    // const repository = await repositoryRepository.findByProviderId('github', String(repo.id));
    // if (!repository) { ... }

    // TODO: Trigger scan
    // const scan = await scanService.startScan({
    //   repositoryId: repository.id,
    //   tenantId: repository.tenantId,
    //   initiatedBy: 'webhook',
    //   ref: branch || repo.default_branch,
    //   commitSha: payload.after,
    //   basePath: ...,
    // });

    // Mock scan trigger response
    const scanId = crypto.randomUUID();

    logger.info({
      deliveryId,
      scanId,
      repo: repo.full_name,
      ref: branch,
      commitSha: payload.after,
    }, 'Scan triggered via webhook');

    return {
      received: true,
      eventId: deliveryId,
      action: 'scan_triggered',
      scanId,
    };
  });

  /**
   * POST /api/v1/webhooks/gitlab - GitLab push webhook
   */
  fastify.post<{
    Body: GitLabPushPayload;
    Headers: {
      'x-gitlab-event'?: string;
      'x-gitlab-token'?: string;
      'x-gitlab-instance'?: string;
    };
  }>('/gitlab', {
    schema: {
      description: 'Receive GitLab push webhook events',
      tags: ['Webhooks'],
      body: Type.Unknown(),
      response: {
        200: WebhookAckResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply): Promise<WebhookAckResponse> => {
    const eventType = request.headers['x-gitlab-event'];
    const token = request.headers['x-gitlab-token'];
    const instance = request.headers['x-gitlab-instance'];
    const eventId = crypto.randomUUID();

    logger.info({ eventType, instance, eventId }, 'Received GitLab webhook');

    // Validate payload structure
    const payload = request.body;
    if (!isGitLabPushPayload(payload)) {
      // Not a push event or invalid structure
      if (typeof payload === 'object' && payload !== null && 'object_kind' in payload) {
        return {
          received: true,
          eventId,
          action: 'ignored',
          reason: `Event type '${(payload as { object_kind: string }).object_kind}' is not handled`,
        };
      }
      throw new ValidationError('Invalid GitLab webhook payload structure');
    }

    // Verify token if configured
    // TODO: Look up webhook token from repository config
    const webhookToken = process.env.GITLAB_WEBHOOK_TOKEN;

    if (webhookToken && !verifyGitLabToken(token, webhookToken)) {
      logger.warn({ eventId, projectId: payload.project_id }, 'Invalid webhook token');
      throw new UnauthorizedError('Invalid webhook token');
    }

    // Extract project info
    const project = payload.project;
    const branch = extractBranchName(payload.ref);

    logger.info({
      eventId,
      project: project.path_with_namespace,
      branch,
      commits: payload.total_commits_count,
      after: payload.after,
    }, 'Processing GitLab push event');

    // Check if this is a branch deletion (after is all zeros)
    if (payload.after === '0000000000000000000000000000000000000000') {
      logger.debug({ eventId, branch }, 'Ignoring branch deletion');
      return {
        received: true,
        eventId,
        action: 'ignored',
        reason: 'Branch deletion events are not processed',
      };
    }

    // Check if push contains IaC changes
    if (!hasIaCChanges(payload.commits)) {
      logger.debug({ eventId, branch }, 'No IaC file changes detected');
      return {
        received: true,
        eventId,
        action: 'ignored',
        reason: 'No IaC file changes detected in commits',
      };
    }

    // TODO: Look up repository in database
    // const repository = await repositoryRepository.findByProviderId('gitlab', String(project.id));
    // if (!repository) { ... }

    // TODO: Trigger scan
    // const scan = await scanService.startScan({ ... });

    // Mock scan trigger response
    const scanId = crypto.randomUUID();

    logger.info({
      eventId,
      scanId,
      project: project.path_with_namespace,
      ref: branch,
      commitSha: payload.after,
    }, 'Scan triggered via GitLab webhook');

    return {
      received: true,
      eventId,
      action: 'scan_triggered',
      scanId,
    };
  });
};

export default webhookRoutes;
