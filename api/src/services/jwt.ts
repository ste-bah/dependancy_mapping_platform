/**
 * JWT Service
 * RS256 token signing and verification using jose library
 * @module services/jwt
 */

import * as jose from 'jose';
import pino from 'pino';
import type { JWTClaims } from '../types/auth.js';
import { UnauthorizedError } from '../middleware/error-handler.js';

const logger = pino({ name: 'jwt-service' });

/**
 * JWT Configuration
 */
interface JWTConfig {
  privateKey: string;
  publicKey: string;
  issuer: string;
  accessTokenTTL: number; // seconds
  refreshTokenTTL: number; // seconds
}

/**
 * Get JWT configuration from environment
 */
function getJWTConfig(): JWTConfig {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required');
  }

  return {
    privateKey: privateKey.replace(/\\n/g, '\n'),
    publicKey: publicKey.replace(/\\n/g, '\n'),
    issuer: process.env.JWT_ISSUER || 'code-reviewer-api',
    accessTokenTTL: parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10), // 15 minutes
    refreshTokenTTL: parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10), // 7 days
  };
}

/**
 * Cached key instances
 */
let privateKeyInstance: jose.KeyLike | null = null;
let publicKeyInstance: jose.KeyLike | null = null;

/**
 * Get or create private key instance
 */
async function getPrivateKey(): Promise<jose.KeyLike> {
  if (!privateKeyInstance) {
    const config = getJWTConfig();
    privateKeyInstance = await jose.importPKCS8(config.privateKey, 'RS256');
    logger.debug('Private key imported');
  }
  return privateKeyInstance;
}

/**
 * Get or create public key instance
 */
async function getPublicKey(): Promise<jose.KeyLike> {
  if (!publicKeyInstance) {
    const config = getJWTConfig();
    publicKeyInstance = await jose.importSPKI(config.publicKey, 'RS256');
    logger.debug('Public key imported');
  }
  return publicKeyInstance;
}

/**
 * Generate RSA key pair for JWT signing
 * Use this to generate keys for .env configuration
 */
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
    modulusLength: 2048,
  });

  const publicKeyPem = await jose.exportSPKI(publicKey);
  const privateKeyPem = await jose.exportPKCS8(privateKey);

  logger.info('New RSA key pair generated');

  return {
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
  };
}

/**
 * Sign an access token with user claims
 */
export async function signAccessToken(claims: Omit<JWTClaims, 'iat' | 'exp' | 'iss'>): Promise<string> {
  const config = getJWTConfig();
  const privateKey = await getPrivateKey();

  const jwt = await new jose.SignJWT({
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setSubject(claims.sub)
    .setExpirationTime(`${config.accessTokenTTL}s`)
    .sign(privateKey);

  logger.debug({ userId: claims.sub }, 'Access token signed');

  return jwt;
}

/**
 * Sign a refresh token
 */
export async function signRefreshToken(userId: string): Promise<string> {
  const config = getJWTConfig();
  const privateKey = await getPrivateKey();

  const jwt = await new jose.SignJWT({
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setSubject(userId)
    .setExpirationTime(`${config.refreshTokenTTL}s`)
    .sign(privateKey);

  logger.debug({ userId }, 'Refresh token signed');

  return jwt;
}

/**
 * Verify and decode an access token
 */
export async function verifyAccessToken(token: string): Promise<JWTClaims> {
  const config = getJWTConfig();
  const publicKey = await getPublicKey();

  try {
    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: config.issuer,
    });

    logger.debug({ userId: payload.sub }, 'Access token verified');

    return payload as unknown as JWTClaims;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new UnauthorizedError('Token has expired');
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new UnauthorizedError('Invalid token');
    }
    logger.error({ error }, 'Token verification failed');
    throw new UnauthorizedError('Token verification failed');
  }
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(token: string): Promise<{ userId: string }> {
  const config = getJWTConfig();
  const publicKey = await getPublicKey();

  try {
    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: config.issuer,
    });

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (!payload.sub) {
      throw new UnauthorizedError('Invalid refresh token: missing subject');
    }

    logger.debug({ userId: payload.sub }, 'Refresh token verified');

    return { userId: payload.sub };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error instanceof jose.errors.JWTExpired) {
      throw new UnauthorizedError('Refresh token has expired');
    }
    logger.error({ error }, 'Refresh token verification failed');
    throw new UnauthorizedError('Refresh token verification failed');
  }
}

/**
 * Get access token TTL in seconds
 */
export function getAccessTokenTTL(): number {
  return getJWTConfig().accessTokenTTL;
}

/**
 * Get refresh token TTL in seconds
 */
export function getRefreshTokenTTL(): number {
  return getJWTConfig().refreshTokenTTL;
}
