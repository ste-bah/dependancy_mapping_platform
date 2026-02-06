# Regression Testing Suite

This directory contains regression tests for the IaC Dependency Detection API.

## Overview

The regression testing suite ensures:
- API contract stability
- Parser output consistency
- Detection algorithm consistency
- Graph structure determinism
- Type system stability
- Breaking change detection

## Test Suites

### 1. Main Regression Tests (`index.test.ts`)

- **API Contract Stability**: Validates ScanRequest, ScanResponse, and GraphQueryResponse schemas
- **Parser Output Stability**: Ensures consistent Terraform and Helm parser output
- **Detection Consistency**: Verifies reference detection and confidence scoring
- **Graph Structure Stability**: Tests deterministic graph building and topological order
- **Type System Stability**: Validates node types, edge types, and evidence types

### 2. Breaking Change Detection (`breaking-changes.test.ts`)

- **Type Exports**: Validates all public types are exported correctly
- **Function Signatures**: Ensures parser, detector, and builder interfaces are maintained
- **Error Codes**: Verifies all error codes and HTTP status mappings exist
- **API Endpoint Contracts**: Validates request/response schemas for all endpoints
- **Backward Compatibility**: Tests legacy request formats still work

### 3. Snapshot Tests (`snapshots.test.ts`)

- **Parser Output Snapshots**: Terraform blocks, expressions
- **Evidence Snapshots**: Evidence types and collections
- **Graph Snapshots**: Nodes, edges, and complete graphs
- **API Response Snapshots**: Scan responses, graph queries, errors

## Baselines

Baseline files in `baselines/` directory:
- `api-contract.json`: API schema baselines
- `parser-terraform.json`: Terraform parser baselines
- `parser-helm.json`: Helm parser baselines
- `detection-edges.json`: Detection algorithm baselines
- `graph-structure.json`: Graph building baselines

## Running Tests

```bash
# Run all regression tests
npm run test:run tests/regression/

# Update snapshots
npm run test:run tests/regression/snapshots.test.ts --update

# Generate/update baselines
npx tsx scripts/generate-baselines.ts --update
```

## Adding New Regression Tests

1. For API changes: Add tests to `index.test.ts` in "API Contract Stability"
2. For type changes: Add tests to `breaking-changes.test.ts` in "Type Exports"
3. For complex outputs: Add snapshot tests to `snapshots.test.ts`
4. Update baselines using the generator script

## CI Integration

These tests should run on every PR to:
- Detect unintended API changes
- Catch breaking changes in type exports
- Ensure parser output consistency
- Validate graph determinism
