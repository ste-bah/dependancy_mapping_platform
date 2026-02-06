# IaC Dependency Mapping Platform - Deployment Checklist

## Overview

This checklist ensures all requirements are met before deploying the IaC Dependency Mapping Platform to production. Complete each section and verify all items pass before proceeding with deployment.

---

## Pre-Deployment Verification

### 1. Code Quality

| Item | Status | Notes |
|------|--------|-------|
| All TypeScript strict mode errors resolved | [ ] | Run `npm run typecheck` |
| ESLint passes with no errors | [ ] | Run `npm run lint` |
| No `any` types in domain layer | [ ] | Custom ESLint rule enabled |
| All files under 500 lines | [ ] | Check complexity report |
| Branded types used for all IDs | [ ] | ScanId, NodeId, EdgeId, etc. |
| No console.log in production code | [ ] | Except in logging module |
| No TODO/FIXME blocking delivery | [ ] | Review technical debt |

### 2. Testing

| Item | Status | Notes |
|------|--------|-------|
| Unit test coverage > 80% | [ ] | Run `npm run test:coverage` |
| All unit tests passing | [ ] | Run `npm run test` |
| Integration tests passing | [ ] | Run `npm run test:integration` |
| Security tests passing | [ ] | Run `npm run test:security` |
| Load tests validated | [ ] | Target: 100 concurrent scans |
| E2E tests passing | [ ] | Run `npm run test:e2e` |

### 3. Security

| Item | Status | Notes |
|------|--------|-------|
| Input validation on all endpoints | [ ] | TypeBox schemas |
| Rate limiting configured | [ ] | See RATE_LIMIT constants |
| RBAC policies defined and tested | [ ] | Tenant isolation verified |
| Security headers enabled (Helmet) | [ ] | CSP, HSTS, etc. |
| CORS properly configured | [ ] | Allowlist verified |
| Secrets in environment variables | [ ] | No hardcoded secrets |
| API key authentication working | [ ] | Hash comparison timing-safe |
| JWT secret rotation plan | [ ] | Document procedure |
| Dependency vulnerabilities addressed | [ ] | Run `npm audit` |
| SQL injection prevention verified | [ ] | Parameterized queries |

### 4. Database

| Item | Status | Notes |
|------|--------|-------|
| All migrations tested | [ ] | Run on staging first |
| Indexes created for query patterns | [ ] | See query plan analysis |
| Connection pooling configured | [ ] | See DATABASE constants |
| Backup strategy defined and tested | [ ] | Point-in-time recovery |
| Rollback procedure documented | [ ] | Migration down scripts |
| Query timeout configured | [ ] | 30 seconds default |
| Dead tuple monitoring | [ ] | Autovacuum configured |

### 5. Caching

| Item | Status | Notes |
|------|--------|-------|
| Redis connection pooling | [ ] | Max connections configured |
| Cache TTL values appropriate | [ ] | See CACHE constants |
| Cache invalidation strategy | [ ] | On scan completion |
| Cache memory limits | [ ] | Monitor usage |
| Fallback behavior tested | [ ] | Graceful degradation |

### 6. Monitoring & Observability

| Item | Status | Notes |
|------|--------|-------|
| Prometheus metrics exposed | [ ] | `/metrics` endpoint |
| Structured logging configured | [ ] | JSON format in production |
| Error tracking enabled | [ ] | Sentry/similar integration |
| Health check endpoints | [ ] | `/health`, `/ready`, `/live` |
| Request tracing enabled | [ ] | OpenTelemetry configured |
| Audit logging enabled | [ ] | Sensitive operations tracked |
| Alert thresholds defined | [ ] | Error rate, latency, etc. |

### 7. Documentation

| Item | Status | Notes |
|------|--------|-------|
| API documentation complete | [ ] | OpenAPI spec generated |
| Architecture documentation | [ ] | System diagrams updated |
| Runbook for operations | [ ] | Troubleshooting guide |
| Environment setup guide | [ ] | For new developers |
| API client usage examples | [ ] | SDK documentation |

---

## Environment Variables Required

```env
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgres://user:password@host:5432/iac_deps
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# Redis
REDIS_URL=redis://host:6379
REDIS_TLS=true

# Authentication
JWT_SECRET=<secure-random-256-bit>
JWT_EXPIRY=24h
API_KEY_SALT=<secure-random>

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# External Services
GITHUB_CLIENT_ID=<client-id>
GITHUB_CLIENT_SECRET=<client-secret>
GITHUB_WEBHOOK_SECRET=<webhook-secret>

# Feature Flags
FEATURE_PARALLEL_PARSING=true
FEATURE_GRAPH_CACHING=true

# Monitoring
SENTRY_DSN=<sentry-dsn>
OTEL_EXPORTER_OTLP_ENDPOINT=<collector-endpoint>
```

---

## Deployment Steps

### 1. Pre-deployment

```bash
# Run full test suite
npm run test:all

# Build production artifacts
npm run build

# Verify build output
ls -la dist/
```

### 2. Database Migration

```bash
# Backup current database
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql

# Run pending migrations
npm run db:migrate

# Verify migration status
npm run db:status
```

### 3. Deploy API Service

```bash
# Deploy to staging first
kubectl apply -f k8s/staging/

# Run smoke tests
npm run test:smoke -- --env=staging

# If successful, deploy to production
kubectl apply -f k8s/production/
```

### 4. Post-deployment Verification

```bash
# Verify health endpoints
curl https://api.example.com/health
curl https://api.example.com/ready

# Verify metrics endpoint
curl https://api.example.com/metrics

# Run basic API tests
npm run test:api -- --env=production
```

### 5. Enable Traffic

```bash
# Update load balancer
kubectl patch service api-service -p '{"spec":{"selector":{"version":"v2"}}}'

# Monitor error rates
watch 'kubectl logs -l app=api --tail=100 | grep ERROR'
```

---

## Rollback Procedure

### Immediate Rollback (< 5 minutes)

1. Revert traffic to previous version:
   ```bash
   kubectl patch service api-service -p '{"spec":{"selector":{"version":"v1"}}}'
   ```

2. Verify previous version health:
   ```bash
   curl https://api.example.com/health
   ```

### Database Rollback (if migration issues)

1. Stop all API instances:
   ```bash
   kubectl scale deployment api --replicas=0
   ```

2. Run rollback migration:
   ```bash
   npm run db:migrate:down
   ```

3. Restore from backup if needed:
   ```bash
   psql -h $DB_HOST -U $DB_USER $DB_NAME < backup_YYYYMMDD.sql
   ```

4. Restart with previous version:
   ```bash
   kubectl rollout undo deployment api
   ```

---

## Performance Benchmarks

Minimum requirements before production:

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (p50) | < 100ms | Via metrics |
| API Response Time (p99) | < 500ms | Via metrics |
| Scan Throughput | 100 scans/min | Load test |
| Graph Query Time | < 200ms | For 10k nodes |
| Memory Usage | < 512MB | Per instance |
| Startup Time | < 30s | Cold start |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| QA Lead | | | |
| Security Lead | | | |
| DevOps Lead | | | |
| Product Owner | | | |

---

## Post-Deployment Monitoring

Monitor these metrics for the first 24 hours:

- [ ] Error rate < 0.1%
- [ ] Latency p99 stable
- [ ] Memory usage stable
- [ ] No connection pool exhaustion
- [ ] No rate limit spikes
- [ ] Scan success rate > 99%

---

## Notes

- All secrets must be rotated within 30 days of deployment
- Schedule load testing for off-peak hours
- Keep this checklist updated with lessons learned
