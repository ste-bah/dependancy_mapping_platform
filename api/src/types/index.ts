/**
 * TypeBox Schema Definitions
 * @module types
 */

import { Type, Static } from '@sinclair/typebox';

/**
 * Health Check Response Schema
 */
export const HealthCheckSchema = Type.Object({
  status: Type.Union([
    Type.Literal('healthy'),
    Type.Literal('unhealthy'),
    Type.Literal('degraded'),
  ]),
  timestamp: Type.String({ format: 'date-time' }),
  version: Type.String(),
  uptime: Type.Number(),
});

export type HealthCheck = Static<typeof HealthCheckSchema>;

/**
 * Detailed Health Check Response Schema
 */
export const DetailedHealthCheckSchema = Type.Object({
  status: Type.Union([
    Type.Literal('healthy'),
    Type.Literal('unhealthy'),
    Type.Literal('degraded'),
  ]),
  timestamp: Type.String({ format: 'date-time' }),
  version: Type.String(),
  uptime: Type.Number(),
  checks: Type.Object({
    database: Type.Object({
      status: Type.Union([
        Type.Literal('up'),
        Type.Literal('down'),
      ]),
      latency: Type.Optional(Type.Number()),
      message: Type.Optional(Type.String()),
    }),
    memory: Type.Object({
      status: Type.Union([
        Type.Literal('up'),
        Type.Literal('down'),
      ]),
      heapUsed: Type.Number(),
      heapTotal: Type.Number(),
      external: Type.Number(),
    }),
  }),
});

export type DetailedHealthCheck = Static<typeof DetailedHealthCheckSchema>;

/**
 * Liveness Probe Response Schema
 */
export const LivenessProbeSchema = Type.Object({
  alive: Type.Boolean(),
  timestamp: Type.String({ format: 'date-time' }),
});

export type LivenessProbe = Static<typeof LivenessProbeSchema>;

/**
 * Readiness Probe Response Schema
 */
export const ReadinessProbeSchema = Type.Object({
  ready: Type.Boolean(),
  timestamp: Type.String({ format: 'date-time' }),
  dependencies: Type.Object({
    database: Type.Boolean(),
  }),
});

export type ReadinessProbe = Static<typeof ReadinessProbeSchema>;

/**
 * Error Response Schema
 */
export const ErrorResponseSchema = Type.Object({
  statusCode: Type.Number(),
  error: Type.String(),
  message: Type.String(),
  code: Type.Optional(Type.String()),
  details: Type.Optional(Type.Unknown()),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

/**
 * Tenant Context Type
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
}

/**
 * Fastify Request with Tenant Context
 */
declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantContext;
  }
}

// Re-export repository types
export * from './repository.js';

// Re-export graph types (NodeType, EdgeType)
export * from './graph.js';

// Re-export evidence types (Evidence, EvidencePointer, ConfidenceScore, ScoringRule)
export * from './evidence.js';

// Re-export entity types (Scan, Repository, Tenant, Node, Edge database representations)
export * from './entities.js';

// Re-export API types (ScanRequest, ScanResponse, GraphQuery, Webhooks)
export * from './api.js';

// Re-export utility types (Brand, Result, DeepPartial, etc.)
export * from './utility.js';

// Re-export auth types (JWT, Session, etc.)
export * from './auth.js';

// Re-export API key types
export * from './api-key.js';

// Re-export rollup types (Cross-Repository Aggregation)
export * from './rollup.js';

// Re-export rollup type guards
export * from './rollup-guards.js';

// Re-export rollup utility types and functions
export * from './rollup-utils.js';

// Re-export rollup mappers
export * from './rollup-mappers.js';

// Re-export rollup event types
export * from './rollup-events.js';

// Re-export external object index types (TASK-ROLLUP-003)
export * from './external-object-index.js';

// Re-export security audit types (TASK-SECURITY)
export * from './security-audit.js';

// Re-export documentation types (TASK-FINAL-004)
export * from './documentation.js';
