/**
 * External Object Index Test Suite Index
 * @module services/rollup/external-object-index/__tests__
 *
 * Central export for all test utilities and fixtures.
 *
 * TASK-ROLLUP-003: External Object Index comprehensive testing
 *
 * Test Coverage Summary:
 * =====================
 * - Unit Tests (80%+ target)
 *   - Domain layer: ExternalReferenceVO, IndexEntryAggregate, types, Result
 *   - Service layer: ExternalObjectIndexService
 *   - Repository layer: ExternalObjectRepository
 *   - Cache layer: ExternalObjectCache (3-tier: L1, L2, L3)
 *   - Extractors: ArnExtractor, K8sExtractor, ResourceIdExtractor
 *   - Error classes: All custom error types
 *
 * - Integration Tests
 *   - Cache invalidation across tiers
 *   - Repository batch operations
 *   - Transaction rollback scenarios
 *   - Event handler coordination
 *
 * - E2E/API Tests
 *   - All 14 REST endpoints
 *   - Authentication/authorization
 *   - Rate limiting
 *   - Error responses
 *
 * - Performance Tests (NFR-PERF-008)
 *   - Lookup latency < 100ms
 *   - Reverse lookup < 500ms at 100K nodes
 *   - Cache hit/miss scenarios
 *   - Bulk operation throughput
 *
 * Running Tests:
 * ==============
 * All tests:       npm test -- src/services/rollup/external-object-index
 * Unit only:       npm test -- src/services/rollup/external-object-index/__tests__/*.test.ts
 * Integration:     npm test -- src/services/rollup/external-object-index/__tests__/integration
 * Performance:     npm test -- src/services/rollup/external-object-index/__tests__/performance
 * API tests:       npm test -- src/services/rollup/external-object-index/__tests__/api
 * Coverage:        npm test -- --coverage src/services/rollup/external-object-index
 */

// Export test fixtures
export * from './fixtures/index.js';

// Test file organization:
// ----------------------
//
// __tests__/
// ├── domain/
// │   ├── external-reference.test.ts     (ExternalReferenceVO tests)
// │   ├── index-entry.test.ts            (IndexEntryAggregate tests)
// │   ├── validators.test.ts             (Validation logic tests)
// │   └── index.ts
// │
// ├── extractors/
// │   ├── arn-extractor.test.ts          (ARN pattern extraction)
// │   └── k8s-extractor.test.ts          (K8s reference extraction)
// │
// ├── integration/
// │   └── cache-integration.test.ts      (Multi-tier cache integration)
// │
// ├── performance/
// │   └── lookup-performance.test.ts     (NFR-PERF-008 benchmarks)
// │
// ├── api/
// │   └── external-index-routes.test.ts  (REST API endpoint tests)
// │
// ├── fixtures/
// │   └── index.ts                       (Test data factories)
// │
// ├── external-object-index-service.test.ts  (Service layer tests)
// ├── external-object-cache.test.ts          (Cache layer tests)
// ├── external-object-repository.test.ts     (Repository layer tests)
// ├── errors.test.ts                         (Error class tests)
// ├── index-engine.test.ts                   (Index engine tests)
// └── index.ts                               (This file)
