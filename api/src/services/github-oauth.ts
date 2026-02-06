/**
 * GitHub OAuth Service
 * Handles GitHub OAuth2 authorization flow
 * @module services/github-oauth
 */

import pino from 'pino';
import type { GitHubUser } from '../types/auth.js';
import { AppError, UnauthorizedError } from '../middleware/error-handler.js';

const logger = pino({ name: 'github-oauth' });

/**
 * GitHub OAuth Configuration
 */
interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Get GitHub OAuth configuration from environment
 */
function getGitHubConfig(): GitHubOAuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables are required');
  }

  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback',
    scopes: (process.env.GITHUB_SCOPES || 'read:user,user:email').split(','),
  };
}

/**
 * GitHub API base URL
 */
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

/**
 * Generate GitHub OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const config = getGitHubConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    allow_signup: 'true',
  });

  const url = `${GITHUB_AUTH_URL}?${params.toString()}`;

  logger.debug({ state }, 'Generated GitHub authorization URL');

  return url;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const config = getGitHubConfig();

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    logger.error({ status: response.status }, 'GitHub token exchange failed');
    throw new AppError('Failed to exchange authorization code', 502, 'GITHUB_TOKEN_ERROR');
  }

  const data = await response.json() as { access_token?: string; error?: string; error_description?: string };

  if (data.error) {
    logger.error({ error: data.error, description: data.error_description }, 'GitHub OAuth error');
    throw new UnauthorizedError(data.error_description || 'GitHub authentication failed');
  }

  if (!data.access_token) {
    throw new AppError('No access token received from GitHub', 502, 'GITHUB_TOKEN_ERROR');
  }

  logger.debug('Successfully exchanged code for GitHub access token');

  return data.access_token;
}

/**
 * Fetch user profile from GitHub API
 */
export async function fetchUserProfile(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    logger.error({ status: response.status }, 'Failed to fetch GitHub user profile');
    throw new AppError('Failed to fetch GitHub user profile', 502, 'GITHUB_API_ERROR');
  }

  const userData = await response.json() as GitHubUser;

  // If email is not public, fetch from /user/emails endpoint
  if (!userData.email) {
    const emailResponse = await fetch(`${GITHUB_API_URL}/user/emails`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (emailResponse.ok) {
      const emails = await emailResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      if (primaryEmail) {
        userData.email = primaryEmail.email;
      }
    }
  }

  logger.debug({ githubId: userData.id, login: userData.login }, 'Fetched GitHub user profile');

  return userData;
}

/**
 * Generate a cryptographically secure state parameter
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
