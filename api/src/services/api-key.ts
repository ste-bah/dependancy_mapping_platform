/**
 * API Key Service
 * Secure API key generation, validation, and management
 * @module services/api-key
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import pino from 'pino';
import { query, getClient } from '../db/connection.js';
import { NotFoundError, ForbiddenError } from '../middleware/error-handler.js';
import type {
  ApiKey,
  ApiKeyType,
  ApiKeyScope,
  ApiKeyValidationResult,
} from '../types/api-key.js';

const logger = pino({ name: 'api-key-service' });

/**
 * Base62 character set for key generation
 */
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Key prefixes for different key types
 */
const KEY_PREFIXES = {
  live: 'dmp_live_',
  test: 'dmp_test_',
} as const;

/**
 * Key length in bytes (before base62 encoding)
 */
const KEY_BYTES = 32;

/**
 * Encode bytes to base62 string
 */
function encodeBase62(bytes: Buffer): string {
  let result = '';
  for (const byte of bytes) {
    result += BASE62_CHARS[byte % 62];
  }
  return result;
}

/**
 * Generate a secure random API key
 * Format: dmp_live_<32-base62-chars> or dmp_test_<32-base62-chars>
 */
export function generateApiKey(type: ApiKeyType): {
  key: string;
  hash: string;
  prefix: string;
} {
  const prefix = KEY_PREFIXES[type];
  const randomPart = encodeBase62(randomBytes(KEY_BYTES));
  const key = `${prefix}${randomPart}`;
  const hash = hashApiKey(key);

  return { key, hash, prefix };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Constant-time comparison of two hashes
 */
function compareHashes(hash1: string, hash2: string): boolean {
  try {
    const buf1 = Buffer.from(hash1, 'hex');
    const buf2 = Buffer.from(hash2, 'hex');
    if (buf1.length !== buf2.length) {
      return false;
    }
    return timingSafeEqual(buf1, buf2);
  } catch {
    return false;
  }
}

/**
 * Extract prefix and key type from full key
 */
function extractKeyInfo(fullKey: string): {
  prefix: string;
  type: ApiKeyType;
} | null {
  if (fullKey.startsWith(KEY_PREFIXES.live)) {
    return { prefix: KEY_PREFIXES.live, type: 'live' };
  }
  if (fullKey.startsWith(KEY_PREFIXES.test)) {
    return { prefix: KEY_PREFIXES.test, type: 'test' };
  }
  return null;
}

/**
 * Create a new API key
 */
export async function createApiKey(
  tenantId: string,
  userId: string | undefined,
  name: string,
  type: ApiKeyType,
  scopes: ApiKeyScope[] = ['read'],
  expiresAt?: Date
): Promise<{ apiKey: ApiKey; fullKey: string }> {
  const { key, hash, prefix } = generateApiKey(type);

  const result = await query<{
    id: string;
    tenant_id: string;
    user_id: string | null;
    name: string;
    key_prefix: string;
    scopes: string[];
    expires_at: Date | null;
    created_at: Date;
    request_count: number;
  }>(
    `INSERT INTO api_keys (tenant_id, user_id, name, key_prefix, key_hash, scopes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, tenant_id, user_id, name, key_prefix, scopes, expires_at, created_at, request_count`,
    [tenantId, userId || null, name, prefix, hash, scopes, expiresAt || null]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create API key');
  }

  const row = result.rows[0];

  logger.info({ apiKeyId: row.id, tenantId, userId, name }, 'API key created');

  return {
    apiKey: {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id || undefined,
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes: row.scopes as ApiKeyScope[],
      requestCount: row.request_count,
      expiresAt: row.expires_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
    },
    fullKey: key,
  };
}

/**
 * List API keys for a tenant (masked, no full key)
 */
export async function listApiKeys(
  tenantId: string,
  userId?: string
): Promise<{ keys: ApiKey[]; total: number }> {
  const params: (string | null)[] = [tenantId];
  let whereClause = 'tenant_id = $1';

  if (userId) {
    whereClause += ' AND user_id = $2';
    params.push(userId);
  }

  const result = await query<{
    id: string;
    tenant_id: string;
    user_id: string | null;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: Date | null;
    request_count: string;
    expires_at: Date | null;
    created_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id, tenant_id, user_id, name, key_prefix, scopes,
            last_used_at, request_count, expires_at, created_at, revoked_at
     FROM api_keys
     WHERE ${whereClause}
     ORDER BY created_at DESC`,
    params
  );

  const keys: ApiKey[] = result.rows.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id || undefined,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes as ApiKeyScope[],
    lastUsedAt: row.last_used_at?.toISOString(),
    requestCount: parseInt(row.request_count, 10),
    expiresAt: row.expires_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString(),
  }));

  return { keys, total: keys.length };
}

/**
 * Get a single API key by ID
 */
export async function getApiKey(
  id: string,
  tenantId: string
): Promise<ApiKey | null> {
  const result = await query<{
    id: string;
    tenant_id: string;
    user_id: string | null;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: Date | null;
    request_count: string;
    expires_at: Date | null;
    created_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id, tenant_id, user_id, name, key_prefix, scopes,
            last_used_at, request_count, expires_at, created_at, revoked_at
     FROM api_keys
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id || undefined,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes as ApiKeyScope[],
    lastUsedAt: row.last_used_at?.toISOString(),
    requestCount: parseInt(row.request_count, 10),
    expiresAt: row.expires_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString(),
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  id: string,
  tenantId: string
): Promise<void> {
  const result = await query(
    `UPDATE api_keys
     SET revoked_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [id, tenantId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('API key', id);
  }

  logger.info({ apiKeyId: id, tenantId }, 'API key revoked');
}

/**
 * Rotate an API key (creates new key, revokes old one)
 */
export async function rotateApiKey(
  id: string,
  tenantId: string
): Promise<{ apiKey: ApiKey; fullKey: string }> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get existing key details
    const existing = await client.query<{
      user_id: string | null;
      name: string;
      key_prefix: string;
      scopes: string[];
      expires_at: Date | null;
    }>(
      `SELECT user_id, name, key_prefix, scopes, expires_at
       FROM api_keys
       WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('API key', id);
    }

    const oldKey = existing.rows[0];
    const keyType: ApiKeyType = oldKey.key_prefix === KEY_PREFIXES.live ? 'live' : 'test';

    // Revoke old key
    await client.query(
      `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1`,
      [id]
    );

    // Generate new key
    const { key, hash, prefix } = generateApiKey(keyType);

    // Create new key with same settings
    const result = await client.query<{
      id: string;
      tenant_id: string;
      user_id: string | null;
      name: string;
      key_prefix: string;
      scopes: string[];
      expires_at: Date | null;
      created_at: Date;
      request_count: number;
    }>(
      `INSERT INTO api_keys (tenant_id, user_id, name, key_prefix, key_hash, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, user_id, name, key_prefix, scopes, expires_at, created_at, request_count`,
      [tenantId, oldKey.user_id, oldKey.name, prefix, hash, oldKey.scopes, oldKey.expires_at]
    );

    await client.query('COMMIT');

    const row = result.rows[0];

    logger.info({ oldKeyId: id, newKeyId: row.id, tenantId }, 'API key rotated');

    return {
      apiKey: {
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id || undefined,
        name: row.name,
        keyPrefix: row.key_prefix,
        scopes: row.scopes as ApiKeyScope[],
        requestCount: row.request_count,
        expiresAt: row.expires_at?.toISOString(),
        createdAt: row.created_at.toISOString(),
      },
      fullKey: key,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Validate an API key
 */
export async function validateApiKey(
  fullKey: string
): Promise<ApiKeyValidationResult> {
  // Extract key info
  const keyInfo = extractKeyInfo(fullKey);
  if (!keyInfo) {
    return { valid: false };
  }

  const keyHash = hashApiKey(fullKey);

  // Find keys matching the prefix (active only)
  const result = await query<{
    id: string;
    tenant_id: string;
    user_id: string | null;
    name: string;
    key_prefix: string;
    key_hash: string;
    scopes: string[];
    expires_at: Date | null;
    revoked_at: Date | null;
    last_used_at: Date | null;
    request_count: string;
    created_at: Date;
  }>(
    `SELECT id, tenant_id, user_id, name, key_prefix, key_hash, scopes,
            expires_at, revoked_at, last_used_at, request_count, created_at
     FROM api_keys
     WHERE key_prefix = $1 AND revoked_at IS NULL`,
    [keyInfo.prefix]
  );

  // Find matching key using constant-time comparison
  for (const row of result.rows) {
    if (compareHashes(keyHash, row.key_hash)) {
      // Check expiration
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        logger.warn({ apiKeyId: row.id }, 'API key expired');
        return { valid: false };
      }

      const apiKey: ApiKey = {
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id || undefined,
        name: row.name,
        keyPrefix: row.key_prefix,
        scopes: row.scopes as ApiKeyScope[],
        lastUsedAt: row.last_used_at?.toISOString(),
        requestCount: parseInt(row.request_count, 10),
        expiresAt: row.expires_at?.toISOString(),
        createdAt: row.created_at.toISOString(),
      };

      return {
        valid: true,
        apiKey,
        tenantId: row.tenant_id,
        userId: row.user_id || undefined,
        scopes: row.scopes as ApiKeyScope[],
      };
    }
  }

  return { valid: false };
}

/**
 * Update API key usage (last_used_at and request_count)
 */
export async function updateApiKeyUsage(id: string): Promise<void> {
  await query(
    `UPDATE api_keys
     SET last_used_at = NOW(), request_count = request_count + 1
     WHERE id = $1`,
    [id]
  );
}

/**
 * Check if API key has required scope
 */
export function hasScope(
  keyScopes: ApiKeyScope[],
  requiredScope: ApiKeyScope
): boolean {
  // Admin scope grants all permissions
  if (keyScopes.includes('admin')) {
    return true;
  }
  // Write scope includes read
  if (requiredScope === 'read' && keyScopes.includes('write')) {
    return true;
  }
  return keyScopes.includes(requiredScope);
}
