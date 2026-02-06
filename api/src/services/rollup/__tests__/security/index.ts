/**
 * Security Test Suite Index
 * @module services/rollup/__tests__/security
 *
 * Exports security test utilities and types for the Rollup service.
 *
 * Test Suites:
 * - owasp.test.ts: OWASP Top 10 vulnerability tests
 * - auth.test.ts: Authentication and authorization tests
 * - input-validation.test.ts: Input validation and injection prevention tests
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation security testing
 */

// Re-export test utilities from parent utils
export {
  createMockMatcherFactory,
  createMockMergeEngine,
  createMockBlastRadiusEngine,
  createMockEventEmitter,
  createMockGraphService,
  createMockMatcher,
  expectValidationError,
  expectValidationWarning,
  expectNoValidationErrors,
} from '../utils/test-helpers.js';

// Re-export fixtures
export {
  createTenantId,
  createRepositoryId,
  createScanId,
  createRollupId,
  createExecutionId,
  createRollupCreateRequest,
  createRollupConfig,
  createArnMatcherConfig,
  createResourceIdMatcherConfig,
  createNameMatcherConfig,
  createTagMatcherConfig,
  createMatchResult,
  createMergedNode,
  createExecutionStats,
  createExecutionResult,
  INVALID_ARN_PATTERNS,
  VALID_ARN_PATTERNS,
  SAMPLE_ARNS,
  PLACEHOLDER_VALUES,
} from '../fixtures/rollup-fixtures.js';

// Security test constants
export const SECURITY_TEST_CONSTANTS = {
  /** Maximum allowed name length */
  MAX_NAME_LENGTH: 255,

  /** Minimum required repositories */
  MIN_REPOSITORIES: 2,

  /** Maximum allowed repositories (default config) */
  MAX_REPOSITORIES: 10,

  /** Minimum required matchers */
  MIN_MATCHERS: 1,

  /** Maximum allowed matchers (default config) */
  MAX_MATCHERS: 20,

  /** Default security score threshold */
  SECURITY_SCORE_THRESHOLD: 90,
} as const;

// Common malicious payloads for testing
export const MALICIOUS_PAYLOADS = {
  sql: [
    "'; DROP TABLE rollups; --",
    "1' OR '1'='1",
    "' UNION SELECT * FROM users--",
    "1; DELETE FROM users;--",
  ],
  nosql: [
    '{"$gt": ""}',
    '{"$ne": null}',
    '{"$where": "sleep(5000)"}',
    '{"$regex": ".*"}',
  ],
  command: [
    '$(cat /etc/passwd)',
    '`whoami`',
    '; rm -rf /',
    '| cat /etc/shadow',
  ],
  xss: [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '"><script>alert(1)</script>',
  ],
  template: [
    '{{constructor.constructor("return this")()}}',
    '${7*7}',
    '<%= 7*7 %>',
    '#{7*7}',
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '/etc/passwd',
    'file:///etc/passwd',
  ],
} as const;

// Security test type definitions
export interface SecurityTestResult {
  category: string;
  testName: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  finding?: string;
  evidence?: string;
}

export interface SecurityAuditSummary {
  totalTests: number;
  passed: number;
  failed: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  score: number;
}
