# Rollup Feature Delivery Checklist

> TASK-ROLLUP-001: Cross-Repository Aggregation
> Final Refactorer Agent #44 of 47 - Delivery Preparation

---

## Pre-Deployment Checklist

### 1. Code Quality Verification

- [x] **TypeScript Compilation**: All Rollup files compile without errors
- [x] **No Console Statements**: No `console.log/debug/info/warn` in production code
- [x] **No TODO/FIXME**: All task comments have been resolved
- [x] **Import Consistency**: All imports use `.js` extension (ESM compliant)
- [x] **Export Patterns**: Barrel exports via index.ts files
- [x] **Error Handling**: Consistent use of RollupError hierarchy

### 2. Testing Requirements

- [x] **Unit Tests**: `services/rollup/__tests__/*.test.ts`
- [x] **Integration Tests**: `services/rollup/__tests__/integration/*.test.ts`
- [x] **Security Tests**: `services/rollup/__tests__/security/*.test.ts`
- [x] **Performance Tests**: `services/rollup/__tests__/regression/performance.test.ts`
- [x] **Test Fixtures**: Comprehensive fixtures in `__tests__/fixtures/`

### 3. Documentation

- [x] **API Documentation**: JSDoc comments on all public interfaces
- [x] **Frontend Integration**: `docs/frontend-integration-rollup.md`
- [x] **Dependencies**: `docs/rollup-dependencies.md`
- [x] **Implementation Inventory**: `docs/rollup-implementation-inventory.md`

---

## Environment Requirements

### 1. Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis (for events and caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# Rollup Configuration
ROLLUP_MAX_REPOSITORIES=10
ROLLUP_MAX_MATCHERS=20
ROLLUP_EXECUTION_TIMEOUT_MS=300000
ROLLUP_CACHE_ENABLED=true
ROLLUP_CACHE_TTL_SECONDS=3600

# Queue (BullMQ)
ROLLUP_QUEUE_CONCURRENCY=5
ROLLUP_QUEUE_JOB_TIMEOUT_MS=600000

# Feature Flags
FEATURE_ROLLUP_ENABLED=true
FEATURE_ROLLUP_BLAST_RADIUS=true
FEATURE_ROLLUP_ASYNC_EXECUTION=true
```

### 2. Infrastructure Dependencies

| Service | Minimum Version | Purpose |
|---------|-----------------|---------|
| PostgreSQL | 14.0+ | Primary data store |
| Redis | 6.0+ | Event pub/sub, caching |
| Node.js | 18.0+ | Runtime |

### 3. Database Permissions

```sql
-- Application role needs:
GRANT SELECT, INSERT, UPDATE, DELETE ON rollups TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON rollup_executions TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON rollup_matches TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON merged_nodes TO app_role;
GRANT EXECUTE ON FUNCTION get_rollup_execution_summary(UUID) TO app_role;
```

---

## Database Migration Steps

### 1. Pre-Migration Checklist

- [ ] Backup database before migration
- [ ] Verify database connection credentials
- [ ] Check disk space for new indexes
- [ ] Schedule maintenance window if needed

### 2. Migration Commands

```bash
# Run migration in development
npm run db:migrate

# Run migration with specific file
npx knex migrate:run --specific 008_rollup_tables.ts

# Verify migration
npx knex migrate:status
```

### 3. Migration Details

**File:** `db/migrations/008_rollup_tables.ts`

**Tables Created:**
- `rollups` - Rollup configuration storage
- `rollup_executions` - Execution history and results
- `rollup_matches` - Match result storage
- `merged_nodes` - Merged node references

**Indexes Created:**
- 11 indexes on `rollups` table
- 6 indexes on `rollup_executions` table
- 10 indexes on `rollup_matches` table
- 10 indexes on `merged_nodes` table

**RLS Policies:**
- Tenant isolation on all 4 tables
- Uses `app.current_tenant_id` setting

### 4. Rollback Procedure

```bash
# Rollback migration
npx knex migrate:rollback --specific 008_rollup_tables.ts

# Verify rollback
npx knex migrate:status
```

**Warning:** Rollback will delete all rollup data!

---

## Feature Flag Configuration

### 1. Feature Flag Schema

```typescript
interface RollupFeatureFlags {
  // Core feature toggle
  rollupEnabled: boolean;           // Default: false (enable after deployment)

  // Sub-feature toggles
  blastRadiusEnabled: boolean;      // Default: true
  asyncExecutionEnabled: boolean;   // Default: true
  scheduledRollupsEnabled: boolean; // Default: false

  // Rate limits
  maxConcurrentExecutions: number;  // Default: 5
  maxRepositoriesPerRollup: number; // Default: 10

  // Canary deployment
  enabledForTenants: string[];      // Default: [] (all when rollupEnabled)
  rolloutPercentage: number;        // Default: 100
}
```

### 2. Gradual Rollout Strategy

1. **Stage 1**: Enable for internal tenants only
   ```json
   { "rollupEnabled": true, "enabledForTenants": ["internal-tenant-id"] }
   ```

2. **Stage 2**: Enable for 10% of tenants
   ```json
   { "rollupEnabled": true, "rolloutPercentage": 10 }
   ```

3. **Stage 3**: Full rollout
   ```json
   { "rollupEnabled": true, "rolloutPercentage": 100 }
   ```

---

## Rollback Procedure

### 1. Application Rollback

```bash
# Disable feature flag immediately
curl -X PATCH /api/v1/admin/features \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rollupEnabled": false}'

# Or via environment variable
export FEATURE_ROLLUP_ENABLED=false

# Restart application
pm2 restart api
```

### 2. Database Rollback (if needed)

```bash
# 1. Stop new rollup operations
export FEATURE_ROLLUP_ENABLED=false

# 2. Wait for in-flight executions to complete (or timeout)
# Check: SELECT COUNT(*) FROM rollup_executions WHERE status = 'running';

# 3. Run migration rollback
npx knex migrate:rollback --specific 008_rollup_tables.ts

# 4. Verify tables are dropped
psql -c "\dt rollup*"
```

### 3. Data Preservation (Optional)

```bash
# Before rollback, export data if needed
pg_dump -t rollups -t rollup_executions -t rollup_matches -t merged_nodes \
  $DATABASE_URL > rollup_backup.sql
```

---

## Health Checks

### 1. API Health Check

```bash
# Verify rollup routes are registered
curl http://localhost:3000/api/v1/rollups -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK with empty array or rollup list
```

### 2. Database Health Check

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'rollup%';

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'rollup%';
```

### 3. Queue Health Check

```bash
# Verify BullMQ queue is accepting jobs
npm run queue:health

# Or via Redis CLI
redis-cli LLEN bull:rollup-execution:wait
```

---

## Monitoring Setup

### 1. Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rollup_executions_total` | Counter | Total executions by status |
| `rollup_execution_duration_seconds` | Histogram | Execution duration |
| `rollup_nodes_matched` | Gauge | Matched nodes by strategy |
| `rollup_blast_radius_depth` | Histogram | Blast radius depth |
| `rollup_cache_hits` | Counter | Cache hit rate |
| `rollup_errors_total` | Counter | Errors by code |

### 2. Alerting Rules

```yaml
groups:
  - name: rollup_alerts
    rules:
      - alert: RollupExecutionHighFailureRate
        expr: rate(rollup_errors_total{severity="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High rollup execution failure rate

      - alert: RollupExecutionSlow
        expr: histogram_quantile(0.95, rollup_execution_duration_seconds) > 300
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Rollup executions taking longer than 5 minutes
```

### 3. Logging

Events logged to:
- Application logs (pino structured JSON)
- Redis pub/sub channels: `rollup:events:lifecycle`, `rollup:events:execution`
- Audit log table (if audit service enabled)

---

## Post-Deployment Verification

### 1. Smoke Tests

```bash
# Create a test rollup
curl -X POST http://localhost:3000/api/v1/rollups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "smoke-test-rollup",
    "repositoryIds": ["repo-1-uuid", "repo-2-uuid"],
    "matchers": [{"type": "name", "enabled": true}]
  }'

# Verify it was created
curl http://localhost:3000/api/v1/rollups -H "Authorization: Bearer $TOKEN"

# Clean up
curl -X DELETE http://localhost:3000/api/v1/rollups/{id} \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Integration Verification

- [ ] API endpoints respond correctly
- [ ] Database records are created
- [ ] Events are published to Redis
- [ ] Queue jobs are processed
- [ ] Metrics are exported

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Implementation Lead | Agent #30 | 2026-01-28 | |
| Test Lead | Agent #31 | 2026-01-28 | |
| Security Review | Agent #35 | 2026-01-28 | |
| Quality Gate | Agent #39 (Sherlock) | Pending | |

---

*Document generated by Final Refactorer Agent #44*
*TASK-ROLLUP-001: Cross-Repository Aggregation*
