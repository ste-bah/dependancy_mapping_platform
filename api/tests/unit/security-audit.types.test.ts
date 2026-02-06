/**
 * Security Audit Types Unit Tests
 * @module tests/unit/security-audit.types
 *
 * Tests for type guards, factory functions, and utility functions
 * in the security-audit types module.
 *
 * Tests cover:
 * - isThreat() - Threat type guard validation
 * - isAuditItemTyped() - Audit item type guard validation
 * - createEmptyThreatModelSummary() - Factory function
 * - calculateThreatRiskScore() - Risk score calculation
 * - calculateAuditPassRate() - Pass rate calculation
 * - Additional type guards and factory functions
 *
 * CWE Coverage:
 * - CWE-20: Improper Input Validation (via type guards)
 */

import { describe, it, expect } from 'vitest';
import {
  // Type guards
  isThreat,
  isAuditItemTyped,
  isPentestTarget,
  isSBOMComponentTyped,
  isSBOMTyped,
  isSecurityTestResultTyped,
  isThreatCategory,
  isAuditItemStatus,
  isVulnerabilitySeverity,
  isCweId,
  isStrideId,
  // Factory functions
  createEmptyThreatModelSummary,
  createEmptySBOMSummary,
  createEmptyTestSuiteSummary,
  // Calculation functions
  calculateThreatRiskScore,
  getRiskLevel,
  calculateAuditPassRate,
  summarizeSBOMVulnerabilities,
  // Types
  ThreatCategory,
  ThreatLikelihood,
  ThreatImpact,
  ThreatStatus,
  AuditItemStatus,
  VulnerabilitySeverity,
  type Threat,
  type AuditItemTyped,
  type PentestTarget,
  type SBOMComponentTyped,
  type SBOMTyped,
  type SecurityTestResultTyped,
  type ThreatModelSummary,
  type SBOMSummary,
} from '../../src/types/security-audit.js';

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create a valid Threat object
 */
function createValidThreat(overrides: Partial<Threat> = {}): Threat {
  return {
    id: 'S-001',
    category: ThreatCategory.SPOOFING,
    title: 'Session Hijacking',
    description: 'Attacker can hijack user sessions via XSS',
    likelihood: ThreatLikelihood.MEDIUM,
    impact: ThreatImpact.HIGH,
    mitigation: 'Implement HttpOnly and Secure cookie flags',
    status: ThreatStatus.IMPLEMENTED,
    ...overrides,
  };
}

/**
 * Create a valid AuditItemTyped object
 */
function createValidAuditItem(overrides: Partial<AuditItemTyped> = {}): AuditItemTyped {
  return {
    id: 'AUTH-001',
    item: 'Authentication tokens have expiration',
    status: AuditItemStatus.PASS,
    evidence: 'JWT tokens expire after 24 hours',
    cweId: 'CWE-613',
    ...overrides,
  };
}

/**
 * Create a valid PentestTarget object
 */
function createValidPentestTarget(overrides: Partial<PentestTarget> = {}): PentestTarget {
  return {
    name: 'API Gateway',
    type: 'api',
    endpoints: ['/api/v1/users', '/api/v1/auth'],
    testTypes: ['injection', 'authentication', 'authorization'],
    ...overrides,
  };
}

/**
 * Create a valid SBOMComponentTyped object
 */
function createValidSBOMComponent(overrides: Partial<SBOMComponentTyped> = {}): SBOMComponentTyped {
  return {
    type: 'library',
    name: 'express',
    version: '4.18.2',
    purl: 'pkg:npm/express@4.18.2',
    licenses: [{ license: { id: 'MIT' } }],
    ...overrides,
  };
}

/**
 * Create a valid SBOMTyped object
 */
function createValidSBOM(overrides: Partial<SBOMTyped> = {}): SBOMTyped {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: 'urn:uuid:12345678-1234-1234-1234-123456789012',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'CycloneDX', name: 'cyclonedx-npm', version: '1.0.0' }],
    },
    components: [createValidSBOMComponent()],
    ...overrides,
  };
}

/**
 * Create a valid SecurityTestResultTyped object
 */
function createValidSecurityTestResult(
  overrides: Partial<SecurityTestResultTyped> = {}
): SecurityTestResultTyped {
  return {
    testId: 'SEC-001',
    name: 'SQL Injection Test',
    category: 'Injection',
    passed: true,
    duration: 150,
    cweId: 'CWE-89',
    ...overrides,
  };
}

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Security Audit Type Guards', () => {
  describe('isThreat', () => {
    it('should return true for valid Threat object', () => {
      const threat = createValidThreat();
      expect(isThreat(threat)).toBe(true);
    });

    it('should return true for Threat with all STRIDE categories', () => {
      const categories = [
        ThreatCategory.SPOOFING,
        ThreatCategory.TAMPERING,
        ThreatCategory.REPUDIATION,
        ThreatCategory.INFORMATION_DISCLOSURE,
        ThreatCategory.DENIAL_OF_SERVICE,
        ThreatCategory.ELEVATION_OF_PRIVILEGE,
      ];

      for (const category of categories) {
        const threat = createValidThreat({ category });
        expect(isThreat(threat)).toBe(true);
      }
    });

    it('should return true for Threat with all status values', () => {
      const statuses = [
        ThreatStatus.IMPLEMENTED,
        ThreatStatus.IN_PROGRESS,
        ThreatStatus.PLANNED,
        ThreatStatus.ACCEPTED_RISK,
      ];

      for (const status of statuses) {
        const threat = createValidThreat({ status });
        expect(isThreat(threat)).toBe(true);
      }
    });

    it('should return false for null', () => {
      expect(isThreat(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isThreat(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isThreat('string')).toBe(false);
      expect(isThreat(123)).toBe(false);
      expect(isThreat(true)).toBe(false);
      expect(isThreat([])).toBe(false);
    });

    it('should return false when required fields are missing', () => {
      const missingId = { category: 'Spoofing', title: 'Test' };
      const missingCategory = { id: 'S-001', title: 'Test' };
      const missingTitle = { id: 'S-001', category: 'Spoofing' };
      const missingLikelihood = { id: 'S-001', category: 'Spoofing', title: 'Test', impact: 'High', status: 'Implemented' };
      const missingImpact = { id: 'S-001', category: 'Spoofing', title: 'Test', likelihood: 'High', status: 'Implemented' };
      const missingStatus = { id: 'S-001', category: 'Spoofing', title: 'Test', likelihood: 'High', impact: 'High' };

      expect(isThreat(missingId)).toBe(false);
      expect(isThreat(missingCategory)).toBe(false);
      expect(isThreat(missingTitle)).toBe(false);
      expect(isThreat(missingLikelihood)).toBe(false);
      expect(isThreat(missingImpact)).toBe(false);
      expect(isThreat(missingStatus)).toBe(false);
    });

    it('should return true for Threat without optional fields', () => {
      const minimalThreat = {
        id: 'S-001',
        category: 'Spoofing',
        title: 'Test Threat',
        description: 'Description',
        likelihood: 'High',
        impact: 'High',
        mitigation: 'Mitigation',
        status: 'Implemented',
      };
      expect(isThreat(minimalThreat)).toBe(true);
    });
  });

  describe('isAuditItemTyped', () => {
    it('should return true for valid AuditItemTyped object', () => {
      const item = createValidAuditItem();
      expect(isAuditItemTyped(item)).toBe(true);
    });

    it('should return true for AuditItemTyped with all status values', () => {
      const statuses = [
        AuditItemStatus.PASS,
        AuditItemStatus.FAIL,
        AuditItemStatus.PARTIAL,
        AuditItemStatus.NA,
        AuditItemStatus.PENDING,
      ];

      for (const status of statuses) {
        const item = createValidAuditItem({ status });
        expect(isAuditItemTyped(item)).toBe(true);
      }
    });

    it('should return true for AuditItemTyped without optional fields', () => {
      const minimalItem = {
        id: 'AUTH-001',
        item: 'Test item',
        status: 'PASS',
      };
      expect(isAuditItemTyped(minimalItem)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isAuditItemTyped(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isAuditItemTyped(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isAuditItemTyped('string')).toBe(false);
      expect(isAuditItemTyped(123)).toBe(false);
    });

    it('should return false when required fields are missing', () => {
      const missingId = { item: 'Test', status: 'PASS' };
      const missingItem = { id: 'AUTH-001', status: 'PASS' };
      const missingStatus = { id: 'AUTH-001', item: 'Test' };

      expect(isAuditItemTyped(missingId)).toBe(false);
      expect(isAuditItemTyped(missingItem)).toBe(false);
      expect(isAuditItemTyped(missingStatus)).toBe(false);
    });
  });

  describe('isPentestTarget', () => {
    it('should return true for valid PentestTarget object', () => {
      const target = createValidPentestTarget();
      expect(isPentestTarget(target)).toBe(true);
    });

    it('should return true for all target types', () => {
      const types = ['api', 'auth', 'isolation', 'adapter', 'engine'] as const;

      for (const type of types) {
        const target = createValidPentestTarget({ type });
        expect(isPentestTarget(target)).toBe(true);
      }
    });

    it('should return false for null', () => {
      expect(isPentestTarget(null)).toBe(false);
    });

    it('should return false when required fields are missing', () => {
      const missingName = { type: 'api', endpoints: [], testTypes: [] };
      const missingType = { name: 'Test', endpoints: [], testTypes: [] };
      const missingEndpoints = { name: 'Test', type: 'api', testTypes: [] };
      const missingTestTypes = { name: 'Test', type: 'api', endpoints: [] };

      expect(isPentestTarget(missingName)).toBe(false);
      expect(isPentestTarget(missingType)).toBe(false);
      expect(isPentestTarget(missingEndpoints)).toBe(false);
      expect(isPentestTarget(missingTestTypes)).toBe(false);
    });
  });

  describe('isSBOMComponentTyped', () => {
    it('should return true for valid SBOMComponentTyped object', () => {
      const component = createValidSBOMComponent();
      expect(isSBOMComponentTyped(component)).toBe(true);
    });

    it('should return true for all component types', () => {
      const types = ['library', 'framework', 'application'] as const;

      for (const type of types) {
        const component = createValidSBOMComponent({ type });
        expect(isSBOMComponentTyped(component)).toBe(true);
      }
    });

    it('should return true for component without optional fields', () => {
      const minimalComponent = {
        type: 'library',
        name: 'test-lib',
        version: '1.0.0',
      };
      expect(isSBOMComponentTyped(minimalComponent)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSBOMComponentTyped(null)).toBe(false);
    });

    it('should return false when required fields are missing', () => {
      const missingType = { name: 'test', version: '1.0.0' };
      const missingName = { type: 'library', version: '1.0.0' };
      const missingVersion = { type: 'library', name: 'test' };

      expect(isSBOMComponentTyped(missingType)).toBe(false);
      expect(isSBOMComponentTyped(missingName)).toBe(false);
      expect(isSBOMComponentTyped(missingVersion)).toBe(false);
    });
  });

  describe('isSBOMTyped', () => {
    it('should return true for valid SBOMTyped object', () => {
      const sbom = createValidSBOM();
      expect(isSBOMTyped(sbom)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSBOMTyped(null)).toBe(false);
    });

    it('should return false when bomFormat is not CycloneDX', () => {
      const wrongFormat = {
        bomFormat: 'SPDX',
        specVersion: '1.5',
        components: [],
      };
      expect(isSBOMTyped(wrongFormat)).toBe(false);
    });

    it('should return false when required fields are missing', () => {
      const missingBomFormat = { specVersion: '1.5', components: [] };
      const missingSpecVersion = { bomFormat: 'CycloneDX', components: [] };
      const missingComponents = { bomFormat: 'CycloneDX', specVersion: '1.5' };

      expect(isSBOMTyped(missingBomFormat)).toBe(false);
      expect(isSBOMTyped(missingSpecVersion)).toBe(false);
      expect(isSBOMTyped(missingComponents)).toBe(false);
    });
  });

  describe('isSecurityTestResultTyped', () => {
    it('should return true for valid SecurityTestResultTyped object', () => {
      const result = createValidSecurityTestResult();
      expect(isSecurityTestResultTyped(result)).toBe(true);
    });

    it('should return true for both passed and failed results', () => {
      const passedResult = createValidSecurityTestResult({ passed: true });
      const failedResult = createValidSecurityTestResult({ passed: false });

      expect(isSecurityTestResultTyped(passedResult)).toBe(true);
      expect(isSecurityTestResultTyped(failedResult)).toBe(true);
    });

    it('should return true for result without optional fields', () => {
      const minimalResult = {
        testId: 'SEC-001',
        name: 'Test',
        category: 'Security',
        passed: true,
        duration: 100,
      };
      expect(isSecurityTestResultTyped(minimalResult)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSecurityTestResultTyped(null)).toBe(false);
    });

    it('should return false when passed is not boolean', () => {
      const invalidPassed = {
        testId: 'SEC-001',
        name: 'Test',
        category: 'Security',
        passed: 'true', // String instead of boolean
        duration: 100,
      };
      expect(isSecurityTestResultTyped(invalidPassed)).toBe(false);
    });
  });

  describe('isThreatCategory', () => {
    it('should return true for valid threat categories', () => {
      const categories = [
        'Spoofing',
        'Tampering',
        'Repudiation',
        'Information Disclosure',
        'Denial of Service',
        'Elevation of Privilege',
      ];

      for (const category of categories) {
        expect(isThreatCategory(category)).toBe(true);
      }
    });

    it('should return false for invalid categories', () => {
      expect(isThreatCategory('Invalid')).toBe(false);
      expect(isThreatCategory('spoofing')).toBe(false); // Case sensitive
      expect(isThreatCategory('')).toBe(false);
      expect(isThreatCategory(null)).toBe(false);
      expect(isThreatCategory(123)).toBe(false);
    });
  });

  describe('isAuditItemStatus', () => {
    it('should return true for valid audit item statuses', () => {
      const statuses = ['PASS', 'FAIL', 'PARTIAL', 'N/A', 'pending'];

      for (const status of statuses) {
        expect(isAuditItemStatus(status)).toBe(true);
      }
    });

    it('should return false for invalid statuses', () => {
      expect(isAuditItemStatus('pass')).toBe(false); // Case sensitive
      expect(isAuditItemStatus('INVALID')).toBe(false);
      expect(isAuditItemStatus('')).toBe(false);
      expect(isAuditItemStatus(null)).toBe(false);
    });
  });

  describe('isVulnerabilitySeverity', () => {
    it('should return true for valid severities', () => {
      const severities = ['critical', 'high', 'medium', 'low'];

      for (const severity of severities) {
        expect(isVulnerabilitySeverity(severity)).toBe(true);
      }
    });

    it('should return false for invalid severities', () => {
      expect(isVulnerabilitySeverity('Critical')).toBe(false); // Case sensitive
      expect(isVulnerabilitySeverity('info')).toBe(false); // Not in VulnerabilitySeverity
      expect(isVulnerabilitySeverity('')).toBe(false);
      expect(isVulnerabilitySeverity(null)).toBe(false);
    });
  });

  describe('isCweId', () => {
    it('should return true for valid CWE IDs', () => {
      const validIds = ['CWE-79', 'CWE-89', 'CWE-1321', 'CWE-1'];

      for (const id of validIds) {
        expect(isCweId(id)).toBe(true);
      }
    });

    it('should return false for invalid CWE IDs', () => {
      expect(isCweId('CWE')).toBe(false);
      expect(isCweId('CWE-')).toBe(false);
      expect(isCweId('CWE79')).toBe(false);
      expect(isCweId('cwe-79')).toBe(false); // Case sensitive
      expect(isCweId('CVE-2021-1234')).toBe(false);
      expect(isCweId('')).toBe(false);
      expect(isCweId(null)).toBe(false);
    });
  });

  describe('isStrideId', () => {
    it('should return true for valid STRIDE IDs', () => {
      const validIds = ['S-001', 'T-001', 'R-001', 'I-001', 'D-001', 'E-001'];

      for (const id of validIds) {
        expect(isStrideId(id)).toBe(true);
      }
    });

    it('should return true for STRIDE IDs with any 3-digit number', () => {
      expect(isStrideId('S-999')).toBe(true);
      expect(isStrideId('T-100')).toBe(true);
      expect(isStrideId('R-000')).toBe(true);
    });

    it('should return false for invalid STRIDE IDs', () => {
      expect(isStrideId('S-01')).toBe(false); // Only 2 digits
      expect(isStrideId('S-0001')).toBe(false); // 4 digits
      expect(isStrideId('X-001')).toBe(false); // Invalid prefix
      expect(isStrideId('s-001')).toBe(false); // Lowercase
      expect(isStrideId('S001')).toBe(false); // Missing dash
      expect(isStrideId('')).toBe(false);
      expect(isStrideId(null)).toBe(false);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Security Audit Factory Functions', () => {
  describe('createEmptyThreatModelSummary', () => {
    it('should create empty threat model summary with correct structure', () => {
      const summary = createEmptyThreatModelSummary();

      expect(summary.totalThreats).toBe(0);
      expect(summary.byCategory).toEqual({});
      expect(summary.byStatus).toEqual({});
      expect(summary.highRiskCount).toBe(0);
      expect(summary.mitigatedCount).toBe(0);
      expect(summary.lastUpdated).toBeDefined();
    });

    it('should have valid ISO date string for lastUpdated', () => {
      const summary = createEmptyThreatModelSummary();
      const date = new Date(summary.lastUpdated);
      expect(date.toISOString()).toBe(summary.lastUpdated);
    });

    it('should create new object each time', () => {
      const summary1 = createEmptyThreatModelSummary();
      const summary2 = createEmptyThreatModelSummary();
      expect(summary1).not.toBe(summary2);
    });
  });

  describe('createEmptySBOMSummary', () => {
    it('should create empty SBOM summary with correct structure', () => {
      const summary = createEmptySBOMSummary();

      expect(summary.totalComponents).toBe(0);
      expect(summary.byType).toEqual({});
      expect(summary.vulnerabilityCounts).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      });
      expect(summary.licenseCounts).toEqual({});
      expect(summary.generatedAt).toBeDefined();
    });

    it('should have valid ISO date string for generatedAt', () => {
      const summary = createEmptySBOMSummary();
      const date = new Date(summary.generatedAt);
      expect(date.toISOString()).toBe(summary.generatedAt);
    });
  });

  describe('createEmptyTestSuiteSummary', () => {
    it('should create empty test suite summary with correct structure', () => {
      const summary = createEmptyTestSuiteSummary();

      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.skipped).toBe(0);
      expect(summary.passRate).toBe(0);
    });
  });
});

// ============================================================================
// Calculation Function Tests
// ============================================================================

describe('Security Audit Calculation Functions', () => {
  describe('calculateThreatRiskScore', () => {
    it('should calculate correct score for Low likelihood and Low impact', () => {
      const score = calculateThreatRiskScore(ThreatLikelihood.LOW, ThreatImpact.LOW);
      expect(score).toBe(1); // 1 * 1 = 1
    });

    it('should calculate correct score for Medium likelihood and Medium impact', () => {
      const score = calculateThreatRiskScore(ThreatLikelihood.MEDIUM, ThreatImpact.MEDIUM);
      expect(score).toBe(4); // 2 * 2 = 4
    });

    it('should calculate correct score for High likelihood and High impact', () => {
      const score = calculateThreatRiskScore(ThreatLikelihood.HIGH, ThreatImpact.HIGH);
      expect(score).toBe(9); // 3 * 3 = 9
    });

    it('should calculate correct score for High likelihood and Critical impact', () => {
      const score = calculateThreatRiskScore(ThreatLikelihood.HIGH, ThreatImpact.CRITICAL);
      expect(score).toBe(12); // 3 * 4 = 12
    });

    it('should calculate correct score for Low likelihood and Critical impact', () => {
      const score = calculateThreatRiskScore(ThreatLikelihood.LOW, ThreatImpact.CRITICAL);
      expect(score).toBe(4); // 1 * 4 = 4
    });

    it('should calculate all valid combinations correctly', () => {
      // Test all 12 combinations (3 likelihoods x 4 impacts)
      const expectedScores: Record<string, number> = {
        'Low-Low': 1,
        'Low-Medium': 2,
        'Low-High': 3,
        'Low-Critical': 4,
        'Medium-Low': 2,
        'Medium-Medium': 4,
        'Medium-High': 6,
        'Medium-Critical': 8,
        'High-Low': 3,
        'High-Medium': 6,
        'High-High': 9,
        'High-Critical': 12,
      };

      for (const [key, expected] of Object.entries(expectedScores)) {
        const [likelihood, impact] = key.split('-') as [ThreatLikelihood, ThreatImpact];
        const score = calculateThreatRiskScore(likelihood, impact);
        expect(score).toBe(expected);
      }
    });
  });

  describe('getRiskLevel', () => {
    it('should return Low for score < 3', () => {
      expect(getRiskLevel(1)).toBe('Low');
      expect(getRiskLevel(2)).toBe('Low');
    });

    it('should return Medium for score 3-5', () => {
      expect(getRiskLevel(3)).toBe('Medium');
      expect(getRiskLevel(4)).toBe('Medium');
      expect(getRiskLevel(5)).toBe('Medium');
    });

    it('should return High for score 6-8', () => {
      expect(getRiskLevel(6)).toBe('High');
      expect(getRiskLevel(7)).toBe('High');
      expect(getRiskLevel(8)).toBe('High');
    });

    it('should return Critical for score >= 9', () => {
      expect(getRiskLevel(9)).toBe('Critical');
      expect(getRiskLevel(10)).toBe('Critical');
      expect(getRiskLevel(12)).toBe('Critical');
    });

    it('should handle edge cases', () => {
      expect(getRiskLevel(0)).toBe('Low');
      expect(getRiskLevel(-1)).toBe('Low');
    });
  });

  describe('calculateAuditPassRate', () => {
    it('should return 0 for empty items array', () => {
      const passRate = calculateAuditPassRate([]);
      expect(passRate).toBe(0);
    });

    it('should return 100 when all items pass', () => {
      const items: AuditItemTyped[] = [
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'PASS' }),
      ];

      const passRate = calculateAuditPassRate(items);
      expect(passRate).toBe(100);
    });

    it('should return 0 when all items fail', () => {
      const items: AuditItemTyped[] = [
        createValidAuditItem({ status: 'FAIL' }),
        createValidAuditItem({ status: 'FAIL' }),
      ];

      const passRate = calculateAuditPassRate(items);
      expect(passRate).toBe(0);
    });

    it('should calculate correct percentage for mixed results', () => {
      const items: AuditItemTyped[] = [
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'FAIL' }),
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'FAIL' }),
      ];

      const passRate = calculateAuditPassRate(items);
      expect(passRate).toBe(50);
    });

    it('should exclude N/A items from calculation', () => {
      const items: AuditItemTyped[] = [
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'N/A' }),
        createValidAuditItem({ status: 'N/A' }),
      ];

      const passRate = calculateAuditPassRate(items);
      expect(passRate).toBe(100); // 1 pass out of 1 applicable
    });

    it('should return 100 when all items are N/A', () => {
      const items: AuditItemTyped[] = [
        createValidAuditItem({ status: 'N/A' }),
        createValidAuditItem({ status: 'N/A' }),
      ];

      const passRate = calculateAuditPassRate(items);
      expect(passRate).toBe(100);
    });

    it('should round to nearest integer', () => {
      const items: AuditItemTyped[] = [
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'FAIL' }),
      ];

      const passRate = calculateAuditPassRate(items);
      expect(passRate).toBe(67); // 2/3 = 0.666... rounds to 67
    });

    it('should treat PARTIAL and pending as non-passing', () => {
      const items: AuditItemTyped[] = [
        createValidAuditItem({ status: 'PASS' }),
        createValidAuditItem({ status: 'PARTIAL' }),
        createValidAuditItem({ status: 'pending' }),
      ];

      const passRate = calculateAuditPassRate(items);
      expect(passRate).toBe(33); // 1 pass out of 3
    });
  });

  describe('summarizeSBOMVulnerabilities', () => {
    it('should return zero counts for components without vulnerabilities', () => {
      const components: SBOMComponentTyped[] = [
        createValidSBOMComponent(),
        createValidSBOMComponent({ name: 'lodash', version: '4.17.21' }),
      ];

      const counts = summarizeSBOMVulnerabilities(components);

      expect(counts.critical).toBe(0);
      expect(counts.high).toBe(0);
      expect(counts.medium).toBe(0);
      expect(counts.low).toBe(0);
    });

    it('should count vulnerabilities by severity', () => {
      const components: SBOMComponentTyped[] = [
        {
          type: 'library',
          name: 'vulnerable-lib',
          version: '1.0.0',
          vulnerabilities: [
            { id: 'CVE-2023-1234', severity: 'critical' },
            { id: 'CVE-2023-1235', severity: 'high' },
          ],
        },
        {
          type: 'library',
          name: 'another-lib',
          version: '2.0.0',
          vulnerabilities: [
            { id: 'CVE-2023-1236', severity: 'medium' },
            { id: 'CVE-2023-1237', severity: 'low' },
            { id: 'CVE-2023-1238', severity: 'low' },
          ],
        },
      ];

      const counts = summarizeSBOMVulnerabilities(components);

      expect(counts.critical).toBe(1);
      expect(counts.high).toBe(1);
      expect(counts.medium).toBe(1);
      expect(counts.low).toBe(2);
    });

    it('should handle empty components array', () => {
      const counts = summarizeSBOMVulnerabilities([]);

      expect(counts.critical).toBe(0);
      expect(counts.high).toBe(0);
      expect(counts.medium).toBe(0);
      expect(counts.low).toBe(0);
    });

    it('should handle components with empty vulnerabilities array', () => {
      const components: SBOMComponentTyped[] = [
        {
          type: 'library',
          name: 'safe-lib',
          version: '1.0.0',
          vulnerabilities: [],
        },
      ];

      const counts = summarizeSBOMVulnerabilities(components);

      expect(counts.critical).toBe(0);
      expect(counts.high).toBe(0);
      expect(counts.medium).toBe(0);
      expect(counts.low).toBe(0);
    });

    it('should aggregate vulnerabilities across multiple components', () => {
      const components: SBOMComponentTyped[] = [
        {
          type: 'library',
          name: 'lib1',
          version: '1.0.0',
          vulnerabilities: [{ id: 'CVE-1', severity: 'critical' }],
        },
        {
          type: 'library',
          name: 'lib2',
          version: '1.0.0',
          vulnerabilities: [{ id: 'CVE-2', severity: 'critical' }],
        },
        {
          type: 'library',
          name: 'lib3',
          version: '1.0.0',
          vulnerabilities: [{ id: 'CVE-3', severity: 'critical' }],
        },
      ];

      const counts = summarizeSBOMVulnerabilities(components);

      expect(counts.critical).toBe(3);
    });
  });
});

// ============================================================================
// SecurityAuditError Tests
// ============================================================================

describe('SecurityAuditError', () => {
  it('should create error with code and details', async () => {
    const { SecurityAuditError } = await import('../../src/types/security-audit.js');

    const error = new SecurityAuditError('Test error', 'AUDIT_COMMAND_FAILED', {
      command: 'npm audit',
    });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('AUDIT_COMMAND_FAILED');
    expect(error.details).toEqual({ command: 'npm audit' });
    expect(error.name).toBe('SecurityAuditError');
  });

  it('should create error without details', async () => {
    const { SecurityAuditError } = await import('../../src/types/security-audit.js');

    const error = new SecurityAuditError('Simple error', 'INTERNAL_ERROR');

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.details).toBeUndefined();
  });

  it('should be instance of Error', async () => {
    const { SecurityAuditError } = await import('../../src/types/security-audit.js');

    const error = new SecurityAuditError('Test', 'TIMEOUT_ERROR');

    expect(error instanceof Error).toBe(true);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Security Audit Constants', () => {
  describe('DEFAULT_SECURITY_AUDIT_CONFIG', () => {
    it('should have expected default values', async () => {
      const { DEFAULT_SECURITY_AUDIT_CONFIG } = await import('../../src/types/security-audit.js');

      expect(DEFAULT_SECURITY_AUDIT_CONFIG.runNpmAudit).toBe(true);
      expect(DEFAULT_SECURITY_AUDIT_CONFIG.generateSbom).toBe(true);
      expect(DEFAULT_SECURITY_AUDIT_CONFIG.checkRlsPolicies).toBe(true);
      expect(DEFAULT_SECURITY_AUDIT_CONFIG.runSecurityTests).toBe(false);
      expect(DEFAULT_SECURITY_AUDIT_CONFIG.minPassingScore).toBe(70);
      expect(DEFAULT_SECURITY_AUDIT_CONFIG.maxCriticalVulns).toBe(0);
      expect(DEFAULT_SECURITY_AUDIT_CONFIG.maxHighVulns).toBe(0);
      expect(DEFAULT_SECURITY_AUDIT_CONFIG.commandTimeoutMs).toBe(30000);
    });
  });

  describe('ThreatCategory', () => {
    it('should have all STRIDE categories', () => {
      expect(ThreatCategory.SPOOFING).toBe('Spoofing');
      expect(ThreatCategory.TAMPERING).toBe('Tampering');
      expect(ThreatCategory.REPUDIATION).toBe('Repudiation');
      expect(ThreatCategory.INFORMATION_DISCLOSURE).toBe('Information Disclosure');
      expect(ThreatCategory.DENIAL_OF_SERVICE).toBe('Denial of Service');
      expect(ThreatCategory.ELEVATION_OF_PRIVILEGE).toBe('Elevation of Privilege');
    });
  });

  describe('VulnerabilitySeverity', () => {
    it('should have all severity levels', () => {
      expect(VulnerabilitySeverity.CRITICAL).toBe('critical');
      expect(VulnerabilitySeverity.HIGH).toBe('high');
      expect(VulnerabilitySeverity.MEDIUM).toBe('medium');
      expect(VulnerabilitySeverity.LOW).toBe('low');
    });
  });

  describe('AuditItemStatus', () => {
    it('should have all status values', () => {
      expect(AuditItemStatus.PASS).toBe('PASS');
      expect(AuditItemStatus.FAIL).toBe('FAIL');
      expect(AuditItemStatus.PARTIAL).toBe('PARTIAL');
      expect(AuditItemStatus.NA).toBe('N/A');
      expect(AuditItemStatus.PENDING).toBe('pending');
    });
  });
});
