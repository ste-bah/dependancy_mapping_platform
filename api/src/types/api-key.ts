/**
 * API Key Type Definitions
 * @module types/api-key
 */

import { Type, Static } from '@sinclair/typebox';

/**
 * Valid API key scopes
 */
export const ApiKeyScopeSchema = Type.Union([
  Type.Literal('read'),
  Type.Literal('write'),
  Type.Literal('admin'),
]);

export type ApiKeyScope = Static<typeof ApiKeyScopeSchema>;

/**
 * API key type (live or test)
 */
export const ApiKeyTypeSchema = Type.Union([
  Type.Literal('live'),
  Type.Literal('test'),
]);

export type ApiKeyType = Static<typeof ApiKeyTypeSchema>;

/**
 * API Key Schema (for responses - excludes sensitive data)
 */
export const ApiKeySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  tenantId: Type.String({ format: 'uuid' }),
  userId: Type.Optional(Type.String({ format: 'uuid' })),
  name: Type.String({ minLength: 1, maxLength: 255 }),
  keyPrefix: Type.String(),
  scopes: Type.Array(ApiKeyScopeSchema),
  lastUsedAt: Type.Optional(Type.String({ format: 'date-time' })),
  requestCount: Type.Number({ minimum: 0 }),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
  revokedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type ApiKey = Static<typeof ApiKeySchema>;

/**
 * Create API Key Request Schema
 */
export const CreateApiKeyRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  type: ApiKeyTypeSchema,
  scopes: Type.Optional(Type.Array(ApiKeyScopeSchema, { default: ['read'] })),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type CreateApiKeyRequest = Static<typeof CreateApiKeyRequestSchema>;

/**
 * Create API Key Response Schema (includes full key, shown only once)
 */
export const CreateApiKeyResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  key: Type.String({ description: 'Full API key - shown only once' }),
  keyPrefix: Type.String(),
  scopes: Type.Array(ApiKeyScopeSchema),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
});

export type CreateApiKeyResponse = Static<typeof CreateApiKeyResponseSchema>;

/**
 * List API Keys Response Schema
 */
export const ListApiKeysResponseSchema = Type.Object({
  keys: Type.Array(ApiKeySchema),
  total: Type.Number(),
});

export type ListApiKeysResponse = Static<typeof ListApiKeysResponseSchema>;

/**
 * Rotate API Key Response Schema
 */
export const RotateApiKeyResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  key: Type.String({ description: 'New API key - shown only once' }),
  keyPrefix: Type.String(),
  scopes: Type.Array(ApiKeyScopeSchema),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
  rotatedAt: Type.String({ format: 'date-time' }),
});

export type RotateApiKeyResponse = Static<typeof RotateApiKeyResponseSchema>;

/**
 * API Key Validation Result
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  tenantId?: string;
  userId?: string;
  scopes?: ApiKeyScope[];
}

/**
 * API Key Context for Request
 */
export interface ApiKeyContext {
  apiKeyId: string;
  tenantId: string;
  userId?: string;
  scopes: ApiKeyScope[];
  keyType: ApiKeyType;
}

/**
 * Extend Fastify Request with API Key Context
 */
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyContext;
  }
}
