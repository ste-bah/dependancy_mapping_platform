/**
 * Redis Cache Connection
 * Session storage and caching using ioredis
 * @module cache/redis
 */

import Redis from 'ioredis';
import pino from 'pino';
import type { Session } from '../types/auth.js';

const logger = pino({ name: 'redis-cache' });

/**
 * Redis client instance type
 */
type RedisClient = InstanceType<typeof Redis>;

/**
 * Redis configuration from environment variables
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetriesPerRequest: number;
}

/**
 * Get Redis configuration from environment
 */
function getRedisConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'code-reviewer:',
    maxRetriesPerRequest: 3,
  };
}

/**
 * Redis client singleton
 */
let client: RedisClient | null = null;

/**
 * Get or create Redis client singleton
 */
export function getClient(): RedisClient {
  if (!client) {
    const config = getRedisConfig();

    client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('error', (err: Error) => {
      logger.error({ err }, 'Redis client error');
    });

    client.on('close', () => {
      logger.debug('Redis connection closed');
    });
  }

  return client;
}

/**
 * Close Redis connection
 */
export async function closeClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    logger.info('Redis client closed');
  }
}

/**
 * Session key prefix
 */
const SESSION_PREFIX = 'session:';

/**
 * Store a session in Redis
 */
export async function storeSession(
  sessionId: string,
  data: Session,
  ttlSeconds: number
): Promise<void> {
  const redis = getClient();
  const key = `${SESSION_PREFIX}${sessionId}`;

  await redis.setex(key, ttlSeconds, JSON.stringify(data));

  logger.debug({ sessionId, ttl: ttlSeconds }, 'Session stored');
}

/**
 * Retrieve a session from Redis
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const redis = getClient();
  const key = `${SESSION_PREFIX}${sessionId}`;

  const data = await redis.get(key);

  if (!data) {
    logger.debug({ sessionId }, 'Session not found');
    return null;
  }

  logger.debug({ sessionId }, 'Session retrieved');

  return JSON.parse(data) as Session;
}

/**
 * Delete a session from Redis
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getClient();
  const key = `${SESSION_PREFIX}${sessionId}`;

  await redis.del(key);

  logger.debug({ sessionId }, 'Session deleted');
}

/**
 * State key prefix for OAuth state parameter
 */
const STATE_PREFIX = 'oauth-state:';

/**
 * Store OAuth state parameter
 */
export async function storeOAuthState(state: string, ttlSeconds: number = 600): Promise<void> {
  const redis = getClient();
  const key = `${STATE_PREFIX}${state}`;

  await redis.setex(key, ttlSeconds, '1');

  logger.debug({ state }, 'OAuth state stored');
}

/**
 * Verify and consume OAuth state parameter
 */
export async function verifyOAuthState(state: string): Promise<boolean> {
  const redis = getClient();
  const key = `${STATE_PREFIX}${state}`;

  const result = await redis.del(key);

  const valid = result > 0;
  logger.debug({ state, valid }, 'OAuth state verification');

  return valid;
}

/**
 * Check Redis connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const redis = getClient();
    await redis.ping();
    return true;
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
}
