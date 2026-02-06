# Regression Testing Guide

## Overview

This directory contains regression testing infrastructure for the Code Reviewer platform. Regression testing ensures that new changes do not break existing functionality, API contracts, parser outputs, or graph structures.

## Testing Strategy

### 1. Baseline Management

Baselines are stored in `/api/tests/regression/baselines/` and contain:

- **api-contract.json**: API request/response schema contracts
- **parser-terraform.json**: Terraform parser output baselines
- **parser-helm.json**: Helm parser output baselines
- **detection-edges.json**: Edge detection baselines
- **graph-structure.json**: Graph structure baselines

#### Baseline Schema

```json
{
  "version": "1.0.0",
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp",
  "hash": "16-character SHA-256 hash",
  "generator": "script that generated this baseline",
  "data": {
    // Baseline-specific data
  }
}
```

#### Updating Baselines

```bash
# Generate new baselines (run from api directory)
npm run test:generate-baselines

# Update specific baseline
npm run test:update-baseline -- --name=api-contract
```

### 2. Snapshot Testing

Vitest snapshot testing is used for:

- Parser output structures
- Graph node/edge shapes
- API response formats
- Configuration objects

#### Snapshot Location

Snapshots are stored in `__snapshots__/` directories adjacent to test files.

#### Updating Snapshots

```bash
# Update all snapshots
npm run test -- -u

# Update specific snapshot
npm run test -- -u --testNamePattern="should match VPC resource block"
```

### 3. API Response Snapshots

API responses are normalized before comparison to handle:

- Dynamic timestamps
- Generated UUIDs
- Request IDs
- Session-specific data

#### Normalization Rules

1. Timestamps are replaced with `[TIMESTAMP]`
2. UUIDs in responses use deterministic test IDs
3. Request IDs are stripped from comparison
4. Version numbers are validated but not exact-matched

### 4. Performance Regression Detection

Performance baselines track:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Response time | +10% | Warning |
| Response time | +25% | Failure |
| Memory usage | +15% | Warning |
| Memory usage | +30% | Failure |
| Bundle size | +5% | Warning |
| Bundle size | +10% | Failure |

#### Running Performance Tests

```bash
# Run performance regression tests
npm run test:perf

# Generate performance report
npm run test:perf -- --reporter=json > perf-report.json
```

## Test Categories

### API Contract Stability Tests

Located in `/api/tests/regression/index.test.ts`

Tests verify:
- Required and optional fields in requests/responses
- Status code contracts
- Error response formats
- Webhook payload structures

### Parser Output Stability Tests

Verify parser outputs remain consistent for:
- Terraform HCL parsing
- Helm chart parsing
- Kubernetes manifest parsing
- Module source detection

### Detection Consistency Tests

Ensure detection algorithms produce:
- Same edges for identical inputs
- Consistent confidence scores
- Stable reference resolution

### Graph Structure Stability Tests

Validate:
- Deterministic node ordering
- Consistent edge generation
- Stable metadata computation
- Topological order consistency

## Breaking Change Detection

### Type Export Tests

Verify all public types remain exported:
- Schema exports
- Type guard functions
- Factory functions
- Error codes

### Function Signature Tests

Ensure function signatures don't change:
- Parser interfaces
- Detector interfaces
- Graph builder interface
- Scoring engine interface

### Error Code Stability

Verify error codes are not removed or changed:
- HTTP error codes
- Parser error codes
- Detection error codes
- Graph error codes

## Running Regression Tests

```bash
# Run all regression tests
npm run test:regression

# Run specific regression category
npm run test:regression -- --grep="API Contract"

# Run with baseline comparison
npm run test:regression -- --compare-baselines

# Generate regression report
npm run test:regression -- --reporter=json > regression-report.json
```

## CI/CD Integration

### Pre-merge Checks

1. All regression tests must pass
2. No baseline drift without explicit approval
3. Performance within thresholds
4. Type exports unchanged

### Baseline Update Workflow

1. Create PR with code changes
2. If baseline drift detected, CI adds `needs-baseline-update` label
3. Reviewer approves baseline changes
4. Run `npm run test:update-baselines`
5. Commit updated baselines
6. CI re-runs and passes

## Handling Failures

### Unintended Regression

1. Identify the failing test
2. Check git diff for related changes
3. Determine if change is intentional
4. If unintentional, fix the code
5. If intentional, update baseline with approval

### Intentional Breaking Change

1. Document the breaking change
2. Update CHANGELOG.md
3. Increment appropriate version number
4. Update baseline files
5. Add migration guide if needed

## Best Practices

1. **Never update baselines without review**
2. **Document all intentional changes**
3. **Run regression tests locally before push**
4. **Keep baseline files small and focused**
5. **Use descriptive test names**
6. **Normalize dynamic data in snapshots**

## File Structure

```
e2e/tests/regression/
  README.md              # This file
  regression.spec.ts     # E2E regression tests
  baseline-compare.ts    # Baseline comparison utilities

api/tests/regression/
  index.test.ts          # API regression tests
  snapshots.test.ts      # Snapshot tests
  breaking-changes.test.ts # Breaking change detection
  baselines/
    api-contract.json
    parser-terraform.json
    parser-helm.json
    detection-edges.json
    graph-structure.json
```

## Metrics and Reporting

### Regression Summary Report

The CI generates a summary showing:
- Total tests run
- Passed/failed/skipped counts
- Baseline comparison status
- Performance delta from baseline
- Breaking changes detected

### Historical Tracking

Regression results are tracked over time in:
- `test-results/regression-history.json`
- Grafana dashboard (if configured)
- Weekly regression summary emails
