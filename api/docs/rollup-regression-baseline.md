# Rollup Service Regression Testing Baseline

## Overview

This document defines the baseline metrics, regression thresholds, critical paths, and CI/CD checks for the Cross-Repository Aggregation (Rollup) service.

**Version:** 1.0.0
**Last Updated:** 2024-01-28
**Task Reference:** TASK-ROLLUP-001

---

## Performance Baselines

### Matcher Operations

| Metric | Baseline | Tolerance | Unit | Description |
|--------|----------|-----------|------|-------------|
| Candidate Extraction (1000 nodes) | 50 | 20% | ms | Time to extract match candidates from 1000 nodes |
| Candidate Extraction (5000 nodes) | 250 | 20% | ms | Time to extract match candidates from 5000 nodes |
| Match Comparison (10000 comparisons) | 100 | 20% | ms | Time to perform 10000 candidate comparisons |

### Merge Operations

| Metric | Baseline | Tolerance | Unit | Description |
|--------|----------|-----------|------|-------------|
| Small Merge (2 graphs, 100 nodes each) | 20 | 25% | ms | Time to merge small graphs |
| Medium Merge (5 graphs, 500 nodes each) | 100 | 25% | ms | Time to merge medium graphs |
| Large Merge (10 graphs, 1000 nodes each) | 500 | 30% | ms | Time to merge large graphs |

### Full Execution

| Metric | Baseline | Tolerance | Unit | Description |
|--------|----------|-----------|------|-------------|
| Small Rollup (100 nodes) | 100 | 25% | ms | Complete execution for small rollup |
| Medium Rollup (1000 nodes) | 500 | 25% | ms | Complete execution for medium rollup |
| Large Rollup (5000 nodes) | 2000 | 30% | ms | Complete execution for large rollup |

### Memory Usage

| Metric | Baseline | Tolerance | Unit | Description |
|--------|----------|-----------|------|-------------|
| Small Operations | 10 | 50% | MB | Memory for small operations |
| Medium Operations | 50 | 50% | MB | Memory for medium operations |
| Large Operations | 200 | 50% | MB | Memory for large operations |

### Throughput

| Metric | Baseline | Tolerance | Unit | Description |
|--------|----------|-----------|------|-------------|
| Node Processing | 10,000 | 20% | nodes/sec | Nodes processed per second |
| Match Comparisons | 50,000 | 20% | cmp/sec | Match comparisons per second |

---

## Regression Thresholds

### Severity Levels

| Level | Deviation | Action |
|-------|-----------|--------|
| **Critical** | >50% degradation | Block deployment, immediate investigation |
| **Major** | 25-50% degradation | Flag for review, may block deployment |
| **Minor** | 10-25% degradation | Log warning, monitor trend |
| **Within Tolerance** | <10% deviation | Pass, no action required |

### Automatic Failure Triggers

The following conditions trigger automatic test failure:

1. **Performance Regression**: Any metric exceeds baseline + tolerance
2. **API Breaking Change**: Required field removed or renamed
3. **Type Change**: Field type changed from baseline
4. **Interface Method Missing**: Any required interface method not implemented
5. **Memory Leak**: Memory usage increases >100% over baseline

---

## Critical Paths Monitored

### API Contracts

| Path | Priority | Impact |
|------|----------|--------|
| `RollupConfig` schema | Critical | All clients depend on this structure |
| `RollupExecutionResult` schema | Critical | Execution results affect downstream processing |
| `MatchResult` schema | High | Match data used for merging decisions |
| `MergedNode` schema | High | Final output consumed by blast radius |
| `BlastRadiusResponse` schema | High | Impact analysis data |
| Matcher config schemas | Medium | Configuration validation |

### Service Methods

| Method | Priority | Regression Check |
|--------|----------|------------------|
| `createRollup` | Critical | Parameter signature, return type |
| `executeRollup` | Critical | Execution flow, stats accuracy |
| `getBlastRadius` | Critical | Impact calculation accuracy |
| `listRollups` | High | Pagination structure |
| `validateConfiguration` | Medium | Validation completeness |

### Interface Implementations

| Interface | Priority | Key Methods |
|-----------|----------|-------------|
| `IRollupService` | Critical | All 9 methods |
| `IMatcherFactory` | Critical | `createMatcher`, `createMatchers` |
| `IMatcher` | High | `extractCandidates`, `compare` |
| `IMergeEngine` | High | `merge` |
| `IBlastRadiusEngine` | High | `analyze` |

---

## CI/CD Regression Checks

### Pre-Commit Checks

```yaml
# Run before each commit
regression:
  pre-commit:
    - npm run test:regression:contracts
    - npm run test:regression:interfaces
```

### Pull Request Checks

```yaml
# Run on every PR
regression:
  pr-checks:
    - name: API Contract Tests
      command: npm run test:regression:contracts
      required: true

    - name: Interface Tests
      command: npm run test:regression:interfaces
      required: true

    - name: Performance Tests
      command: npm run test:regression:performance
      required: false  # Warning only on PR

    - name: Snapshot Update Check
      command: npm run test -- --update-snapshot --dry-run
      required: true
```

### Nightly Checks

```yaml
# Run nightly for trend analysis
regression:
  nightly:
    - name: Full Performance Suite
      command: npm run test:regression:performance -- --iterations=10
      store-metrics: true

    - name: Memory Profiling
      command: npm run test:regression:memory -- --expose-gc
      store-metrics: true
```

### Release Checks

```yaml
# Run before release
regression:
  release:
    - name: Full Regression Suite
      command: npm run test:regression
      required: true

    - name: Breaking Change Audit
      command: npm run audit:breaking-changes
      required: true
```

---

## Test File Locations

```
api/src/services/rollup/__tests__/regression/
├── api-contracts.test.ts     # API schema validation
├── performance.test.ts       # Performance benchmarks
├── interfaces.test.ts        # Interface compliance
└── __snapshots__/           # Snapshot baselines
    └── api-contracts.test.ts.snap
```

---

## Baseline Update Process

### When to Update Baselines

1. **Performance Improvement**: When optimizations improve performance by >10%
2. **New Features**: When new fields/methods are added (non-breaking)
3. **Intentional Breaking Changes**: With proper versioning and migration

### How to Update Baselines

```bash
# Update API contract snapshots
npm run test:regression:contracts -- --update-snapshot

# Update performance baselines (edit PERFORMANCE_BASELINES in performance.test.ts)
# Document the change and reason in this file

# Create baseline record
git log -1 --format="%H" > baseline-commit.txt
npm run test:regression -- --json > baseline-metrics.json
```

### Approval Requirements

| Change Type | Approvals Required |
|-------------|-------------------|
| Performance baseline | 1 engineer |
| API schema change | 2 engineers + architect |
| Interface change | 2 engineers |
| Breaking change | Team lead + stakeholders |

---

## Snapshot Testing

### API Response Snapshots

The following response shapes are snapshot tested:

- `RollupConfig` field structure
- `RollupExecutionResult` field structure
- `MatchResult` structure
- `MergedNode` structure
- `BlastRadiusResponse` structure

### Updating Snapshots

```bash
# Review snapshot changes
npm run test:regression:contracts -- --update-snapshot --dry-run

# Update snapshots (after review)
npm run test:regression:contracts -- --update-snapshot

# Commit with explanation
git commit -m "chore: update API snapshots - [reason]"
```

---

## Monitoring and Alerting

### Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Test Pass Rate | CI/CD | <100% |
| Avg Execution Time | Performance tests | >baseline + tolerance |
| Memory Peak | Performance tests | >baseline + tolerance |
| Regression Count | Test results | >0 critical |

### Alert Recipients

- **Critical Regressions**: #alerts-critical, on-call engineer
- **Major Regressions**: #alerts-rollup, team
- **Minor Regressions**: #alerts-rollup (daily digest)

---

## Historical Baseline Records

### v1.0.0 (Initial Baseline)

**Date:** 2024-01-28
**Commit:** (current)

```json
{
  "version": "1.0.0",
  "date": "2024-01-28",
  "environment": {
    "node": "v22.x",
    "platform": "linux"
  },
  "metrics": {
    "matcherExtraction1k": 50,
    "mergeSmall": 20,
    "executionSmall": 100,
    "nodesPerSecond": 10000
  }
}
```

---

## Appendix

### Running Regression Tests

```bash
# Run all regression tests
npm run test -- --testPathPattern=regression

# Run specific suite
npm run test -- --testPathPattern=regression/api-contracts

# Run with verbose output
npm run test -- --testPathPattern=regression --verbose

# Run with metrics collection
npm run test -- --testPathPattern=regression --json > metrics.json
```

### Environment Requirements

- Node.js 18+ (v22 recommended)
- At least 4GB RAM for large tests
- Enable `--expose-gc` for accurate memory tests

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Flaky performance tests | Run with `--iterations=10` to average |
| Memory test failures | Run isolated with `--runInBand` |
| Snapshot failures | Review changes carefully before updating |
| CI failures only | Check for environment differences |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2024-01-28 | Regression Tester Agent | Initial baseline document |
