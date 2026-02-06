# Rollup Feature Dependencies

> TASK-ROLLUP-001: Cross-Repository Aggregation Dependency Documentation

## Overview

This document describes all dependencies used by the Rollup (Cross-Repository Aggregation) feature, version requirements, peer dependencies, and upgrade considerations.

---

## Production Dependencies

### Core Framework

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `fastify` | ^4.28.0 | HTTP server framework | API routes, middleware |
| `@fastify/type-provider-typebox` | ^4.0.0 | TypeBox integration for Fastify | Route schema validation |
| `fastify-plugin` | ^4.5.1 | Plugin creation utilities | Service plugins |

### Schema & Validation

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `@sinclair/typebox` | ^0.32.35 | TypeScript-first schema builder | `types/rollup.ts`, all schemas |
| `zod` | ^3.23.8 | Runtime config validation | Configuration validation |

### Database & Persistence

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `pg` | ^8.12.0 | PostgreSQL client | `IRollupRepository` implementations |
| `pg-pool` | ^3.6.2 | Connection pooling | Database connections |
| `node-pg-migrate` | ^7.0.0 | Database migrations | Schema migrations |

### Caching & Queuing

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `ioredis` | ^5.4.1 | Redis client | Event emitter, caching, pub/sub |
| `bullmq` | ^5.12.0 | Job queue management | Async rollup execution |

### Observability

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `prom-client` | ^15.1.3 | Prometheus metrics | `metrics.ts` - all rollup metrics |
| `pino` | ^9.2.0 | Structured logging | `logger.ts` - rollup logging |
| `pino-pretty` | ^11.2.1 | Development log formatting | Dev environment |
| `@opentelemetry/api` | ^1.9.0 | Tracing API | `tracing.ts` - span management |
| `@opentelemetry/sdk-node` | ^0.52.1 | Node.js tracing SDK | Tracing initialization |
| `@opentelemetry/sdk-trace-node` | ^1.25.1 | Trace SDK | Span processing |
| `@opentelemetry/exporter-trace-otlp-http` | ^0.52.1 | OTLP export | Trace export to collectors |
| `@opentelemetry/resources` | ^1.25.1 | Resource attributes | Service identification |
| `@opentelemetry/semantic-conventions` | ^1.25.1 | Standard attribute names | Semantic conventions |
| `@opentelemetry/core` | ^1.25.1 | Core utilities | W3C context propagation |
| `@opentelemetry/instrumentation` | ^0.52.1 | Auto-instrumentation | Instrumentation base |
| `@opentelemetry/instrumentation-http` | ^0.52.1 | HTTP instrumentation | HTTP tracing |
| `@opentelemetry/instrumentation-pg` | ^0.43.0 | PostgreSQL instrumentation | DB tracing |
| `@opentelemetry/instrumentation-fastify` | ^0.38.0 | Fastify instrumentation | Route tracing |
| `@opentelemetry/instrumentation-ioredis` | ^0.42.0 | ioredis instrumentation | Redis tracing |

### Utilities

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `lodash-es` | ^4.17.21 | Utility functions | Data manipulation |
| `nanoid` | ^5.0.7 | ID generation | Entity ID creation |
| `ms` | ^2.1.3 | Time parsing | Timeout configurations |
| `dotenv` | ^16.4.5 | Environment variables | Configuration loading |

---

## Development Dependencies

### TypeScript & Build

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.5.3 | TypeScript compiler |
| `tsx` | ^4.16.2 | TypeScript execution |
| `@types/node` | ^20.14.11 | Node.js type definitions |
| `@types/pg` | ^8.11.6 | PostgreSQL type definitions |
| `@types/lodash-es` | ^4.17.12 | Lodash type definitions |

### Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^2.0.3 | Test runner |
| `@vitest/coverage-v8` | ^2.0.3 | Coverage reporting |
| `@vitest/ui` | ^2.0.3 | Test UI |
| `@faker-js/faker` | ^8.4.1 | Test data generation |
| `supertest` | ^7.0.0 | HTTP testing |
| `@types/supertest` | ^6.0.2 | Supertest types |

### Linting & Formatting

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^8.57.0 | Linting |
| `@typescript-eslint/eslint-plugin` | ^7.16.1 | TypeScript ESLint rules |
| `@typescript-eslint/parser` | ^7.16.1 | TypeScript ESLint parser |
| `eslint-config-prettier` | ^9.1.0 | Prettier ESLint config |
| `eslint-plugin-import` | ^2.29.1 | Import linting |
| `prettier` | ^3.3.3 | Code formatting |

### Dependency Management

| Package | Version | Purpose |
|---------|---------|---------|
| `depcheck` | ^1.4.7 | Unused dependency detection |
| `npm-check-updates` | ^16.14.20 | Version update checking |

---

## Peer Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `typescript` | >=5.0.0 | Required for TypeScript compilation |

---

## Engine Requirements

```json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

---

## Rollup-Specific Module Dependencies

### Module: `services/rollup/index.ts`

The main rollup barrel export aggregates these internal modules:

```
rollup/
  interfaces.ts       -> Core interfaces (no external deps beyond types)
  rollup-service.ts   -> pino, types/rollup
  rollup-executor.ts  -> pino, types/rollup
  rollup-event-emitter.ts -> ioredis, pino, nanoid
  factory.ts          -> Aggregates all modules
  matchers/
    base-matcher.ts   -> types/rollup
    arn-matcher.ts    -> types/rollup
    resource-id-matcher.ts -> types/rollup
    name-matcher.ts   -> types/rollup
    tag-matcher.ts    -> types/rollup
    matcher-factory.ts -> types/rollup
  merge-engine.ts     -> types/rollup, types/graph
  blast-radius-engine.ts -> types/rollup
  errors.ts           -> error-codes
  error-codes.ts      -> (no external deps)
  error-recovery.ts   -> pino, errors/recovery
  logger.ts           -> pino
  metrics.ts          -> prom-client, logging/metrics
  tracing.ts          -> @opentelemetry/*
  audit.ts            -> pino
```

### External Service Dependencies

| Service | Package | Connection |
|---------|---------|------------|
| PostgreSQL | `pg` | `DATABASE_URL` env var |
| Redis | `ioredis` | `REDIS_URL` env var |
| BullMQ | `bullmq` | Uses Redis connection |
| OpenTelemetry Collector | `@opentelemetry/*` | `OTEL_EXPORTER_OTLP_ENDPOINT` env var |
| Prometheus | `prom-client` | `/metrics` endpoint |

---

## Version Compatibility Matrix

| Feature | Min Node | Min TypeScript | Notes |
|---------|----------|----------------|-------|
| ES2022 target | 18.0.0 | 4.7.0 | Using `type: "module"` |
| TypeBox generics | - | 5.0.0 | Complex schema inference |
| OpenTelemetry v1 | 18.0.0 | - | Uses async context |
| Vitest v2 | 18.0.0 | - | Native ESM support |

---

## Upgrade Considerations

### Breaking Change Watch List

1. **@sinclair/typebox** (0.x -> 1.0)
   - API changes expected in v1.0
   - Monitor for `Static<>` type inference changes
   - Schema validation semantics may change

2. **bullmq** (5.x -> 6.0)
   - Queue configuration API changes
   - Connection handling updates
   - Worker lifecycle changes

3. **@opentelemetry/*** (0.x -> 1.0)
   - Instrumentation APIs stabilizing
   - Exporter configuration changes
   - Some packages already at 1.x (api, sdk-trace-node)

4. **prom-client** (15.x -> 16.0)
   - Metric type changes
   - Registry API updates
   - Default metric changes

### Security Update Frequency

| Package Type | Recommended Frequency |
|--------------|----------------------|
| Production deps | Weekly audit, monthly updates |
| OpenTelemetry | Bi-weekly (rapidly evolving) |
| Dev deps | Monthly |
| Type definitions | As needed |

### Update Commands

```bash
# Check for outdated packages
npm run deps:check

# Update to latest compatible versions
npm run deps:update

# Security audit
npm audit

# Fix security issues
npm audit fix
```

---

## Dependency Graph (Key Relationships)

```
rollup-service
    |-> IRollupRepository (pg)
    |-> IGraphService
    |-> IMatcherFactory -> arn-matcher, resource-id-matcher, name-matcher, tag-matcher
    |-> IMergeEngine
    |-> IBlastRadiusEngine
    |-> IRollupEventEmitter (ioredis)
    |-> ICacheService (ioredis)
    |-> IQueueService (bullmq -> ioredis)

rollup-metrics (prom-client)
    |-> metricsRegistry

rollup-tracing (@opentelemetry/*)
    |-> NodeSDK
    |-> tracer

rollup-logger (pino)
    |-> structured logging
```

---

## Installation Notes

### Fresh Install

```bash
cd api
npm ci
```

### Development Setup

```bash
# Install all dependencies
npm install

# Generate Prisma client (if applicable)
npm run db:generate

# Run migrations
npm run db:migrate
```

### CI/CD Considerations

- Use `npm ci` for deterministic builds
- Lock file (`package-lock.json`) must be committed
- Node.js 20.x LTS recommended for production
- Set `NODE_ENV=production` to skip devDependencies in production builds

---

## License Compliance

All production dependencies use permissive licenses:

| License | Packages |
|---------|----------|
| MIT | fastify, typebox, pino, lodash-es, bullmq, ioredis, vitest |
| Apache-2.0 | @opentelemetry/*, prom-client |
| ISC | pg |
| BSD-3-Clause | zod |

**No GPL or copyleft licenses in production dependencies.**

---

## Related Documentation

- [Rollup Service Architecture](./architecture/rollup-service.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Frontend Integration](./frontend-integration-rollup.md)

---

*Last updated: 2026-01-28*
*Document version: 1.0.0*
