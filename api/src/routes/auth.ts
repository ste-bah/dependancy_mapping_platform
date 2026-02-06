/**
 * Authentication Routes
 * GitHub OAuth2 authentication endpoints
 * @module routes/auth
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { randomUUID } from 'crypto';
import {
  AuthTokenResponseSchema,
  RefreshTokenRequestSchema,
  UserProfileSchema,
  type AuthTokenResponse,
  type RefreshTokenRequest,
  type UserProfile,
} from '../types/auth.js';
import { ErrorResponseSchema } from '../types/index.js';
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  fetchUserProfile,
  generateState,
} from '../services/github-oauth.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getAccessTokenTTL,
  getRefreshTokenTTL,
} from '../services/jwt.js';
import {
  storeSession,
  getSession,
  deleteSession,
  storeOAuthState,
  verifyOAuthState,
} from '../cache/redis.js';
import { query } from '../db/connection.js';
import { UnauthorizedError, ValidationError } from '../middleware/error-handler.js';
import { requireAuth, getAuthContext } from '../middleware/auth.js';

const logger = pino({ name: 'auth-routes' });

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

/**
 * Cookie configuration
 */
function getCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

/**
 * Find or create user in database
 */
async function findOrCreateUser(githubUser: { id: number; login: string; email: string | null; name: string | null; avatar_url: string }): Promise<{
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  githubId: number;
  createdAt: Date;
}> {
  // First try to find existing user by GitHub ID
  const existingUser = await query<{
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    github_id: number;
    created_at: Date;
  }>(
    'SELECT id, email, name, avatar_url, github_id, created_at FROM users WHERE github_id = $1',
    [githubUser.id]
  );

  if (existingUser.rows.length > 0) {
    const user = existingUser.rows[0];
    // Update user info if changed
    await query(
      'UPDATE users SET email = $1, name = $2, avatar_url = $3, updated_at = NOW() WHERE id = $4',
      [githubUser.email, githubUser.name || githubUser.login, githubUser.avatar_url, user.id]
    );
    return {
      id: user.id,
      email: githubUser.email || user.email,
      name: githubUser.name || githubUser.login,
      avatarUrl: githubUser.avatar_url,
      githubId: user.github_id,
      createdAt: user.created_at,
    };
  }

  // Create new user
  const userId = randomUUID();
  const email = githubUser.email || `${githubUser.id}@github.local`;
  const name = githubUser.name || githubUser.login;

  await query(
    `INSERT INTO users (id, email, name, avatar_url, github_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [userId, email, name, githubUser.avatar_url, githubUser.id]
  );

  logger.info({ userId, githubId: githubUser.id }, 'New user created');

  return {
    id: userId,
    email,
    name,
    avatarUrl: githubUser.avatar_url,
    githubId: githubUser.id,
    createdAt: new Date(),
  };
}

/**
 * Authentication routes plugin
 */
const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * Initiate GitHub OAuth flow
   * GET /auth/github
   */
  fastify.get(
    '/github',
    {
      schema: {
        tags: ['Auth'],
        response: {
          302: { type: 'null' },
        },
      },
      config: {
        rateLimit: {
          max: RATE_LIMIT_MAX,
          timeWindow: RATE_LIMIT_WINDOW,
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const state = generateState();

      // Store state in Redis for CSRF protection
      await storeOAuthState(state, 600); // 10 minutes TTL

      const authUrl = getAuthorizationUrl(state);

      logger.debug({ state }, 'Redirecting to GitHub OAuth');

      return reply.redirect(authUrl);
    }
  );

  /**
   * GitHub OAuth callback
   * GET /auth/github/callback
   */
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string; error_description?: string };
  }>(
    '/github/callback',
    {
      schema: {
        tags: ['Auth'],
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
        response: {
          200: AuthTokenResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: RATE_LIMIT_MAX,
          timeWindow: RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const { code, state, error, error_description } = request.query;

      // Handle OAuth error from GitHub
      if (error) {
        logger.warn({ error, error_description }, 'GitHub OAuth error');
        throw new UnauthorizedError(error_description || 'GitHub authentication failed');
      }

      // Validate required parameters
      if (!code || !state) {
        throw new ValidationError('Missing code or state parameter');
      }

      // Verify state parameter (CSRF protection)
      const validState = await verifyOAuthState(state);
      if (!validState) {
        throw new UnauthorizedError('Invalid or expired state parameter');
      }

      // Exchange code for GitHub access token
      const githubAccessToken = await exchangeCodeForToken(code);

      // Fetch user profile from GitHub
      const githubUser = await fetchUserProfile(githubAccessToken);

      // Find or create user in database
      const user = await findOrCreateUser(githubUser);

      // Generate JWT tokens
      const accessToken = await signAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl || undefined,
        githubId: user.githubId,
      });

      const refreshToken = await signRefreshToken(user.id);

      // Store session in Redis
      const sessionId = randomUUID();
      await storeSession(sessionId, {
        userId: user.id,
        refreshToken,
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + getRefreshTokenTTL() * 1000).toISOString(),
      }, getRefreshTokenTTL());

      // Set refresh token in HTTP-only cookie
      reply.setCookie('refreshToken', refreshToken, getCookieOptions(getRefreshTokenTTL() * 1000));
      reply.setCookie('sessionId', sessionId, getCookieOptions(getRefreshTokenTTL() * 1000));

      logger.info({ userId: user.id, githubId: user.githubId }, 'User authenticated via GitHub');

      const response: AuthTokenResponse = {
        accessToken,
        refreshToken,
        expiresIn: getAccessTokenTTL(),
        tokenType: 'Bearer',
      };

      return reply.status(200).send(response);
    }
  );

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  fastify.post<{
    Body: RefreshTokenRequest;
  }>(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        body: RefreshTokenRequestSchema,
        response: {
          200: AuthTokenResponseSchema,
          401: ErrorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: RATE_LIMIT_MAX,
          timeWindow: RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      // Verify refresh token
      const { userId } = await verifyRefreshToken(refreshToken);

      // Check if session exists in Redis (token not revoked)
      const sessionId = request.cookies.sessionId;
      if (sessionId) {
        const session = await getSession(sessionId);
        if (!session || session.refreshToken !== refreshToken) {
          throw new UnauthorizedError('Session has been revoked');
        }
      }

      // Fetch user from database
      const userResult = await query<{
        id: string;
        email: string;
        name: string;
        avatar_url: string | null;
        github_id: number;
      }>(
        'SELECT id, email, name, avatar_url, github_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedError('User not found');
      }

      const user = userResult.rows[0];

      // Generate new access token
      const accessToken = await signAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url || undefined,
        githubId: user.github_id,
      });

      logger.debug({ userId }, 'Access token refreshed');

      const response: AuthTokenResponse = {
        accessToken,
        refreshToken, // Return same refresh token
        expiresIn: getAccessTokenTTL(),
        tokenType: 'Bearer',
      };

      return reply.status(200).send(response);
    }
  );

  /**
   * Logout user
   * POST /auth/logout
   */
  fastify.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);

      // Delete session from Redis
      const sessionId = request.cookies.sessionId;
      if (sessionId) {
        await deleteSession(sessionId);
      }

      // Clear cookies
      reply.clearCookie('refreshToken', { path: '/' });
      reply.clearCookie('sessionId', { path: '/' });

      logger.info({ userId: auth.userId }, 'User logged out');

      return reply.status(200).send({ success: true });
    }
  );

  /**
   * Get current user profile
   * GET /auth/me
   */
  fastify.get<{
    Reply: UserProfile;
  }>(
    '/me',
    {
      schema: {
        tags: ['Auth'],
        response: {
          200: UserProfileSchema,
          401: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const auth = getAuthContext(request);

      // Fetch full user profile from database
      const userResult = await query<{
        id: string;
        email: string;
        name: string;
        avatar_url: string | null;
        github_id: number;
        created_at: Date;
      }>(
        'SELECT id, email, name, avatar_url, github_id, created_at FROM users WHERE id = $1',
        [auth.userId]
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedError('User not found');
      }

      const user = userResult.rows[0];

      const profile: UserProfile = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url || undefined,
        githubId: user.github_id,
        createdAt: user.created_at.toISOString(),
      };

      return reply.status(200).send(profile);
    }
  );
};

export default authRoutes;
