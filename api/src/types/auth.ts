/**
 * Authentication Type Definitions
 * @module types/auth
 */

import { Type, Static } from '@sinclair/typebox';

/**
 * JWT Claims Schema
 */
export const JWTClaimsSchema = Type.Object({
  sub: Type.String({ description: 'User ID' }),
  email: Type.String({ format: 'email' }),
  name: Type.String(),
  avatarUrl: Type.Optional(Type.String({ format: 'uri' })),
  githubId: Type.Number(),
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  iat: Type.Optional(Type.Number()),
  exp: Type.Optional(Type.Number()),
  iss: Type.Optional(Type.String()),
});

export type JWTClaims = Static<typeof JWTClaimsSchema>;

/**
 * GitHub User Profile Schema
 */
export const GitHubUserSchema = Type.Object({
  id: Type.Number(),
  login: Type.String(),
  email: Type.Union([Type.String({ format: 'email' }), Type.Null()]),
  name: Type.Union([Type.String(), Type.Null()]),
  avatar_url: Type.String({ format: 'uri' }),
});

export type GitHubUser = Static<typeof GitHubUserSchema>;

/**
 * Session Data Schema
 */
export const SessionSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  refreshToken: Type.String(),
  userAgent: Type.Optional(Type.String()),
  ipAddress: Type.Optional(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.String({ format: 'date-time' }),
});

export type Session = Static<typeof SessionSchema>;

/**
 * Auth Token Response Schema
 */
export const AuthTokenResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
  expiresIn: Type.Number({ description: 'Access token expiry in seconds' }),
  tokenType: Type.Literal('Bearer'),
});

export type AuthTokenResponse = Static<typeof AuthTokenResponseSchema>;

/**
 * Refresh Token Request Schema
 */
export const RefreshTokenRequestSchema = Type.Object({
  refreshToken: Type.String(),
});

export type RefreshTokenRequest = Static<typeof RefreshTokenRequestSchema>;

/**
 * User Profile Response Schema
 */
export const UserProfileSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  name: Type.String(),
  avatarUrl: Type.Optional(Type.String({ format: 'uri' })),
  githubId: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
});

export type UserProfile = Static<typeof UserProfileSchema>;

/**
 * Auth Context for Request
 */
export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  githubId: number;
  tenantId?: string;
}

/**
 * Extend Fastify Request with Auth Context
 */
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
