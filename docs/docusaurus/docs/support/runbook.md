---
id: runbook
title: Support Runbook
sidebar_position: 3
description: Operational runbook for DMP support and incident response
---

# Support Runbook

This runbook provides procedures for operating and supporting the Dependency Mapping Platform.

:::info Internal Document
This document is intended for support staff and platform operators. Some sections reference internal tools and procedures.
:::

## Service Overview

### Architecture Components

| Component | Purpose | Health Check |
|-----------|---------|--------------|
| API Server | REST API endpoints | `GET /health` |
| Worker Pool | Async job processing | `GET /health/workers` |
| PostgreSQL | Primary database | `pg_isready` |
| Redis | Cache and queue | `redis-cli ping` |
| MinIO/S3 | Object storage | `mc admin info` |

### Critical Paths

1. **Authentication Flow**: OAuth -> API -> Database
2. **Scan Pipeline**: API -> Queue -> Worker -> Parser -> Database
3. **Graph Queries**: API -> Cache -> Database

## Health Checks

### API Health

```bash
# Quick health check
curl https://api.code-reviewer.io/health

# Detailed health (authenticated)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.code-reviewer.io/health/detailed
```

Expected response:

```json
{
  "status": "healthy",
  "version": "1.2.3",
  "components": {
    "database": "healthy",
    "cache": "healthy",
    "queue": "healthy",
    "storage": "healthy"
  }
}
```

### Database Health

```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Check replication lag
psql $DATABASE_URL -c "SELECT pg_last_wal_replay_lsn()"

# Active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"
```

### Queue Health

```bash
# Check queue depth
redis-cli -u $REDIS_URL llen scan_queue

# Check worker status
redis-cli -u $REDIS_URL hgetall workers
```

## Common Issues

### Issue: Scans Stuck in Pending

**Symptoms**: Scans remain in "pending" state for >5 minutes

**Diagnosis**:

```bash
# Check queue depth
redis-cli -u $REDIS_URL llen scan_queue

# Check worker heartbeats
redis-cli -u $REDIS_URL hgetall workers

# Check for dead workers
redis-cli -u $REDIS_URL zrangebyscore worker_heartbeats 0 $(date +%s -d '5 minutes ago')
```

**Resolution**:

1. **If queue is backed up**: Scale workers
   ```bash
   kubectl scale deployment/scan-workers --replicas=5
   ```

2. **If workers are dead**: Restart worker pool
   ```bash
   kubectl rollout restart deployment/scan-workers
   ```

3. **If specific scan is stuck**: Manual intervention
   ```bash
   # Update scan status
   psql $DATABASE_URL -c "UPDATE scans SET status='failed', error_message='Timeout - manual intervention' WHERE id='$SCAN_ID'"
   ```

### Issue: High Database CPU

**Symptoms**: Slow queries, connection timeouts

**Diagnosis**:

```sql
-- Find slow queries
SELECT pid, query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Check for locks
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_query
FROM pg_locks blocked_locks
JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
WHERE NOT blocked_locks.granted;
```

**Resolution**:

1. **Kill long-running queries**:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE query_start < NOW() - INTERVAL '5 minutes'
   AND state != 'idle';
   ```

2. **Scale read replicas**: Add replicas for read-heavy loads

3. **Enable query caching**: Check Redis cache hit rates

### Issue: Authentication Failures

**Symptoms**: Users cannot log in, 401 errors

**Diagnosis**:

```bash
# Check OAuth provider status
curl -I https://api.github.com/

# Check JWT signing key
kubectl get secret jwt-keys -o yaml

# Check recent auth errors
kubectl logs -l app=api --since=10m | grep "auth error"
```

**Resolution**:

1. **OAuth provider down**: Enable cached token refresh
2. **JWT key rotation**: Rollback if recent rotation
3. **Rate limiting**: Check if user is rate limited

### Issue: Graph Queries Timeout

**Symptoms**: Graph visualization fails to load, 504 errors

**Diagnosis**:

```sql
-- Check graph size
SELECT scan_id, COUNT(*) as nodes
FROM nodes
GROUP BY scan_id
ORDER BY nodes DESC
LIMIT 10;

-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM nodes WHERE scan_id = 'xxx';
```

**Resolution**:

1. **Add index if missing**:
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_scan
   ON nodes(scan_id);
   ```

2. **Enable query caching**: Ensure Redis is working

3. **Implement pagination**: For very large graphs

### Issue: Webhook Delivery Failures

**Symptoms**: Scans not triggering on push

**Diagnosis**:

```bash
# Check webhook logs
kubectl logs -l app=api --since=1h | grep "webhook"

# Verify webhook secret
kubectl get secret webhook-secrets -o jsonpath='{.data.github}' | base64 -d

# Check outbound connectivity
curl -X POST https://api.github.com/
```

**Resolution**:

1. **Secret mismatch**: Regenerate and update
2. **Network issue**: Check egress rules
3. **Rate limiting**: Implement exponential backoff

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| P1 | Complete service outage | 15 minutes | API down, data loss |
| P2 | Major feature unavailable | 1 hour | Scans failing, auth broken |
| P3 | Minor feature issue | 4 hours | UI glitch, slow performance |
| P4 | Cosmetic/low impact | 24 hours | Typos, minor bugs |

### Incident Procedure

#### 1. Detection

- Automated alerts via PagerDuty
- Customer reports
- Monitoring dashboards

#### 2. Acknowledgment

```bash
# Acknowledge in PagerDuty
pd incident:acknowledge $INCIDENT_ID

# Post to #incidents channel
slack-post "#incidents" "Investigating: $DESCRIPTION"
```

#### 3. Investigation

- Check service health
- Review recent deployments
- Examine error logs
- Identify scope of impact

#### 4. Mitigation

- Apply immediate fix or workaround
- Communicate status to affected users
- Scale resources if needed

#### 5. Resolution

- Deploy permanent fix
- Verify resolution
- Update status page

#### 6. Post-Mortem

Within 48 hours:

1. Document timeline
2. Identify root cause
3. List action items
4. Share learnings

### Rollback Procedure

```bash
# List recent deployments
kubectl rollout history deployment/api

# Rollback to previous version
kubectl rollout undo deployment/api

# Rollback to specific revision
kubectl rollout undo deployment/api --to-revision=5

# Verify rollback
kubectl rollout status deployment/api
```

## Maintenance Procedures

### Database Maintenance

```sql
-- Vacuum and analyze (run weekly)
VACUUM ANALYZE nodes;
VACUUM ANALYZE edges;
VACUUM ANALYZE scans;

-- Reindex if fragmented
REINDEX INDEX CONCURRENTLY idx_nodes_scan;
```

### Cache Maintenance

```bash
# Clear all caches
redis-cli -u $REDIS_URL FLUSHDB

# Clear specific namespace
redis-cli -u $REDIS_URL --scan --pattern "graph:*" | xargs redis-cli DEL

# Check memory usage
redis-cli -u $REDIS_URL INFO memory
```

### Log Rotation

Logs are automatically rotated, but manual cleanup may be needed:

```bash
# Check log volume usage
kubectl exec -it $POD_NAME -- df -h /var/log

# Force rotation
kubectl exec -it $POD_NAME -- logrotate -f /etc/logrotate.conf
```

## Monitoring Dashboards

| Dashboard | Purpose | URL |
|-----------|---------|-----|
| Service Health | Overall system status | /grafana/d/health |
| API Metrics | Request rates, latency | /grafana/d/api |
| Database | Queries, connections | /grafana/d/db |
| Queue | Job processing rates | /grafana/d/queue |
| Business | Scans, users, repos | /grafana/d/business |

## Escalation Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| On-call Engineer | PagerDuty | All incidents |
| Engineering Lead | @eng-lead | P1, P2 unresolved >1hr |
| Database Admin | @dba-team | Database issues |
| Security | @security | Security incidents |

## Useful Commands

### Pod Management

```bash
# Get pod status
kubectl get pods -l app=api

# View logs
kubectl logs -f $POD_NAME

# Exec into pod
kubectl exec -it $POD_NAME -- /bin/sh

# Restart all pods
kubectl rollout restart deployment/api
```

### Database Queries

```bash
# Connect to database
psql $DATABASE_URL

# Count active scans
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM scans GROUP BY status"

# Find large tenants
psql $DATABASE_URL -c "SELECT tenant_id, COUNT(*) FROM repositories GROUP BY tenant_id ORDER BY count DESC LIMIT 10"
```

### Cache Operations

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Monitor real-time
redis-cli -u $REDIS_URL MONITOR

# Get cache stats
redis-cli -u $REDIS_URL INFO stats
```

## Next Steps

- [Troubleshooting Guide](/support/troubleshooting) - User-facing issues
- [FAQ](/support/faq) - Common questions
- [API Error Codes](/api/error-handling) - Error reference
