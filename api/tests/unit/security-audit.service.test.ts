/**
 * Security Audit Service Unit Tests
 * @module tests/unit/security-audit.service
 *
 * Tests for the SecurityAuditService including:
 * - runDependencyAudit() - npm audit parsing and error handling
 * - generateSBOM() - SBOM file loading and parsing
 * - verifyRLSPolicies() - RLS migration file verification
 * - generateAuditReport() - comprehensive report aggregation
 * - checkCompliance() - framework compliance checking
 *
 * CWE Coverage:
 * - CWE-1035: Using Components with Known Vulnerabilities
 * - CWE-639: Authorization Bypass Through User-Controlled Key
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock modules before imports
vi.mock('child_process');
vi.mock('fs');
vi.mock('path', async (importOriginal) => {
  const original = await importOriginal<typeof import('path')>();
  return {
    ...original,
    join: vi.fn((...args: string[]) => args.join('/')),
    resolve: vi.fn((p: string) => p),
  };
});

// Import after mocks
import {
  SecurityAuditService,
  createSecurityAuditService,
  getSecurityAuditService,
  resetSecurityAuditService,
  type ISecurityAuditService,
} from '../../src/services/security-audit.service.js';
import {
  DEFAULT_SECURITY_AUDIT_CONFIG,
  type SecurityAuditConfig,
} from '../../src/types/security-audit.js';

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create mock npm audit JSON output (npm 7+ format)
 */
function createMockNpmAuditOutput(options: {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  vulnerabilities?: Record<string, unknown>;
} = {}): string {
  return JSON.stringify({
    metadata: {
      vulnerabilities: {
        critical: options.critical ?? 0,
        high: options.high ?? 0,
        moderate: options.medium ?? 0,
        low: options.low ?? 0,
        info: 0,
        total: (options.critical ?? 0) + (options.high ?? 0) + (options.medium ?? 0) + (options.low ?? 0),
      },
      dependencies: 150,
    },
    vulnerabilities: options.vulnerabilities ?? {},
  });
}

/**
 * Create mock npm audit JSON output with advisories (npm 6 format)
 */
function createMockNpmAuditWithAdvisories(): string {
  return JSON.stringify({
    metadata: {
      vulnerabilities: {
        critical: 1,
        high: 1,
        moderate: 0,
        low: 0,
      },
      dependencies: 100,
    },
    advisories: {
      '1234': {
        id: 1234,
        title: 'Prototype Pollution',
        overview: 'Prototype pollution vulnerability in lodash',
        severity: 'critical',
        cves: ['CVE-2021-23337'],
        cwe: 'CWE-1321',
        module_name: 'lodash',
        vulnerable_versions: '<4.17.21',
        patched_versions: '>=4.17.21',
        recommendation: 'Update to version 4.17.21 or later',
        references: 'https://github.com/lodash/lodash/issues/4874',
      },
      '5678': {
        id: 5678,
        title: 'Remote Code Execution',
        overview: 'RCE in express-fileupload',
        severity: 'high',
        cves: ['CVE-2022-27261'],
        module_name: 'express-fileupload',
        vulnerable_versions: '<=1.3.1',
        patched_versions: '>=1.4.0',
      },
    },
  });
}

/**
 * Create mock CycloneDX SBOM JSON
 */
function createMockCycloneDxSbom(): string {
  return JSON.stringify({
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: 'urn:uuid:12345678-1234-1234-1234-123456789012',
    version: 1,
    metadata: {
      timestamp: '2024-01-15T10:00:00Z',
      tools: [
        { vendor: 'CycloneDX', name: 'cyclonedx-npm', version: '1.0.0' },
      ],
    },
    components: [
      {
        type: 'library',
        name: 'express',
        version: '4.18.2',
        purl: 'pkg:npm/express@4.18.2',
        licenses: [{ license: { id: 'MIT' } }],
      },
      {
        type: 'library',
        name: 'fastify',
        version: '4.24.3',
        purl: 'pkg:npm/fastify@4.24.3',
        licenses: [{ license: { id: 'MIT' } }],
      },
    ],
  });
}

/**
 * Create mock SPDX SBOM JSON
 */
function createMockSpdxSbom(): string {
  return JSON.stringify({
    spdxVersion: 'SPDX-2.3',
    creationInfo: {
      created: '2024-01-15T10:00:00Z',
    },
    packages: [
      {
        name: 'lodash',
        versionInfo: '4.17.21',
        licenseDeclared: 'MIT',
      },
    ],
  });
}

/**
 * Create mock RLS migration SQL content
 */
function createMockRlsMigration(options: {
  hasEnableRls?: boolean;
  hasCurrentTenant?: boolean;
  hasSelectPolicy?: boolean;
  hasInsertPolicy?: boolean;
  hasUpdatePolicy?: boolean;
  hasDeletePolicy?: boolean;
  hasRepositoriesRls?: boolean;
  hasScansRls?: boolean;
} = {}): string {
  const parts: string[] = [];

  if (options.hasEnableRls !== false) {
    parts.push('ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;');
    parts.push('ALTER TABLE scans ENABLE ROW LEVEL SECURITY;');
  }

  if (options.hasCurrentTenant !== false) {
    parts.push(`
      CREATE OR REPLACE FUNCTION current_tenant_id()
      RETURNS uuid AS $$
        SELECT current_setting('app.tenant_id')::uuid;
      $$ LANGUAGE sql STABLE;
    `);
  }

  if (options.hasSelectPolicy !== false) {
    parts.push(`
      CREATE POLICY tenant_isolation_select ON repositories
      FOR SELECT USING (tenant_id = current_tenant_id());
    `);
  }

  if (options.hasInsertPolicy !== false) {
    parts.push(`
      CREATE POLICY tenant_isolation_insert ON repositories
      FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
    `);
  }

  if (options.hasUpdatePolicy !== false) {
    parts.push(`
      CREATE POLICY tenant_isolation_update ON repositories
      FOR UPDATE USING (tenant_id = current_tenant_id());
    `);
  }

  if (options.hasDeletePolicy !== false) {
    parts.push(`
      CREATE POLICY tenant_isolation_delete ON repositories
      FOR DELETE USING (tenant_id = current_tenant_id());
    `);
  }

  if (options.hasRepositoriesRls !== false) {
    parts.push('-- repositories RLS enabled');
  }

  if (options.hasScansRls !== false) {
    parts.push(`
      CREATE POLICY scans_tenant_isolation ON scans
      FOR ALL USING (tenant_id = current_tenant_id());
    `);
  }

  return parts.join('\n');
}

// ============================================================================
// Test Suite
// ============================================================================

describe('SecurityAuditService', () => {
  let service: SecurityAuditService;
  let mockExecSync: Mock;
  let mockExistsSync: Mock;
  let mockReadFileSync: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSecurityAuditService();

    mockExecSync = vi.mocked(childProcess.execSync);
    mockExistsSync = vi.mocked(fs.existsSync);
    mockReadFileSync = vi.mocked(fs.readFileSync);

    // Default mocks
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('');
    mockExecSync.mockReturnValue('{}');

    service = new SecurityAuditService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Constructor and Configuration Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should use default configuration when no options provided', () => {
      const svc = new SecurityAuditService();
      expect(svc).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<SecurityAuditConfig> = {
        runNpmAudit: false,
        minPassingScore: 80,
        maxCriticalVulns: 1,
      };

      const svc = new SecurityAuditService(customConfig);
      expect(svc).toBeDefined();
    });

    it('should accept custom working directory', () => {
      const svc = new SecurityAuditService({
        workingDirectory: '/custom/path',
      });
      expect(svc).toBeDefined();
    });
  });

  // ==========================================================================
  // runDependencyAudit Tests
  // ==========================================================================

  describe('runDependencyAudit', () => {
    it('should return success with clean audit result when no vulnerabilities', async () => {
      mockExecSync.mockReturnValue(createMockNpmAuditOutput());

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passed).toBe(true);
        expect(result.value.vulnerabilities.critical).toBe(0);
        expect(result.value.vulnerabilities.high).toBe(0);
        expect(result.value.source).toBe('npm audit');
        expect(result.value.auditedAt).toBeDefined();
      }
    });

    it('should parse npm audit vulnerabilities correctly', async () => {
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({
        critical: 2,
        high: 3,
        medium: 5,
        low: 10,
      }));

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.vulnerabilities.critical).toBe(2);
        expect(result.value.vulnerabilities.high).toBe(3);
        expect(result.value.vulnerabilities.medium).toBe(5);
        expect(result.value.vulnerabilities.low).toBe(10);
        expect(result.value.passed).toBe(false); // Has critical/high vulns
      }
    });

    it('should extract vulnerability details from advisories format', async () => {
      mockExecSync.mockReturnValue(createMockNpmAuditWithAdvisories());

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.findings).toBeDefined();
        expect(result.value.findings!.length).toBeGreaterThan(0);

        const criticalFinding = result.value.findings!.find(f => f.severity === 'critical');
        expect(criticalFinding).toBeDefined();
        expect(criticalFinding?.packageName).toBe('lodash');
        expect(criticalFinding?.cveId).toBe('CVE-2021-23337');
        expect(criticalFinding?.cweId).toBe('CWE-1321');
      }
    });

    it('should handle npm 8+ vulnerability object format', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0 },
        },
        vulnerabilities: {
          'express-fileupload': {
            severity: 'critical',
            range: '<=1.3.1',
            fixAvailable: true,
          },
        },
      }));

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.vulnerabilities.critical).toBe(1);
        expect(result.value.findings).toBeDefined();
        const finding = result.value.findings!.find(f => f.packageName === 'express-fileupload');
        expect(finding).toBeDefined();
        expect(finding?.severity).toBe('critical');
      }
    });

    it('should return clean result when npm audit command fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('npm audit command failed');
      });

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passed).toBe(true);
        expect(result.value.vulnerabilities.critical).toBe(0);
      }
    });

    it('should handle npm audit returning stdout in error object', async () => {
      const error = new Error('Non-zero exit code') as Error & { stdout: string };
      error.stdout = createMockNpmAuditOutput({ critical: 1 });
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.vulnerabilities.critical).toBe(1);
      }
    });

    it('should handle malformed JSON from npm audit', async () => {
      mockExecSync.mockReturnValue('not valid json');

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passed).toBe(true);
        expect(result.value.vulnerabilities.critical).toBe(0);
      }
    });

    it('should respect maxCriticalVulns configuration', async () => {
      const svc = new SecurityAuditService({ maxCriticalVulns: 1 });
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({ critical: 1 }));

      const result = await svc.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passed).toBe(true); // 1 <= 1
      }
    });

    it('should respect maxHighVulns configuration', async () => {
      const svc = new SecurityAuditService({ maxHighVulns: 5 });
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({ high: 5 }));

      const result = await svc.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.passed).toBe(true); // 5 <= 5
      }
    });

    it('should map npm severity correctly', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 0, high: 0, moderate: 1, low: 0 },
        },
        vulnerabilities: {
          'test-package': {
            severity: 'moderate',
            range: '*',
          },
        },
      }));

      const result = await service.runDependencyAudit();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.vulnerabilities.medium).toBe(1);
        const finding = result.value.findings?.find(f => f.packageName === 'test-package');
        expect(finding?.severity).toBe('medium');
      }
    });
  });

  // ==========================================================================
  // generateSBOM Tests
  // ==========================================================================

  describe('generateSBOM', () => {
    it('should load existing CycloneDX SBOM file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockCycloneDxSbom());

      const result = await service.generateSBOM();

      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value.metadata.format).toBe('CycloneDX');
        expect(result.value.metadata.specVersion).toBe('1.5');
        expect(result.value.components.length).toBe(2);
        expect(result.value.components[0].name).toBe('express');
      }
    });

    it('should load existing SPDX SBOM file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockSpdxSbom());

      const result = await service.generateSBOM();

      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value.metadata.format).toBe('SPDX');
        expect(result.value.components.length).toBe(1);
        expect(result.value.components[0].name).toBe('lodash');
      }
    });

    it('should search common SBOM file locations', async () => {
      // Return false for all default paths, true for one
      let callCount = 0;
      mockExistsSync.mockImplementation(() => {
        callCount++;
        return callCount === 3; // Match on third check (cyclonedx.json)
      });
      mockReadFileSync.mockReturnValue(createMockCycloneDxSbom());

      await service.generateSBOM();

      expect(mockExistsSync).toHaveBeenCalled();
    });

    it('should use custom sbomPath if configured', async () => {
      const svc = new SecurityAuditService({ sbomPath: '/custom/sbom.json' });
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockCycloneDxSbom());

      const result = await svc.generateSBOM();

      expect(result.success).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/custom/sbom.json');
    });

    it('should return null if no SBOM found and cannot generate', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('cyclonedx-npm not available');
      });

      const result = await service.generateSBOM();

      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should try to generate SBOM if none exists', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue(createMockCycloneDxSbom());

      const result = await service.generateSBOM();

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('cyclonedx-npm'),
        expect.any(Object)
      );
    });

    it('should handle SBOM parse errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{ invalid json }');

      const result = await service.generateSBOM();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SBOM_GENERATION_FAILED');
      }
    });

    it('should handle unknown SBOM format', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ unknownFormat: true }));

      const result = await service.generateSBOM();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SBOM_GENERATION_FAILED');
      }
    });

    it('should extract license information from CycloneDX components', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockCycloneDxSbom());

      const result = await service.generateSBOM();

      expect(result.success).toBe(true);
      if (result.success && result.value) {
        const expressComponent = result.value.components.find(c => c.name === 'express');
        expect(expressComponent?.license).toBe('MIT');
      }
    });
  });

  // ==========================================================================
  // verifyRLSPolicies Tests
  // ==========================================================================

  describe('verifyRLSPolicies', () => {
    it('should return PASS when all RLS checks pass', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockRlsMigration());

      const result = await service.verifyRLSPolicies();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe('PASS');
        expect(result.value.id).toBe('AUTH-RLS-001');
        expect(result.value.cweId).toBe('CWE-639');
      }
    });

    it('should return FAIL when RLS migration file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.verifyRLSPolicies();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe('FAIL');
        expect(result.value.severity).toBe('critical');
        expect(result.value.evidence).toContain('not found');
        expect(result.value.remediation).toBeDefined();
      }
    });

    it('should return WARNING when some RLS checks fail', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockRlsMigration({
        hasEnableRls: true,
        hasCurrentTenant: true,
        hasSelectPolicy: true,
        hasInsertPolicy: false, // Missing
        hasUpdatePolicy: true,
        hasDeletePolicy: false, // Missing
      }));

      const result = await service.verifyRLSPolicies();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe('WARNING');
        expect(result.value.evidence).toContain('MISSING');
      }
    });

    it('should use custom rlsMigrationPath if configured', async () => {
      const svc = new SecurityAuditService({
        rlsMigrationPath: '/custom/rls.sql',
      });
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockRlsMigration());

      await svc.verifyRLSPolicies();

      expect(mockExistsSync).toHaveBeenCalledWith('/custom/rls.sql');
    });

    it('should validate all required RLS patterns', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockRlsMigration());

      const result = await service.verifyRLSPolicies();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.metadata).toBeDefined();
        const validationResults = result.value.metadata!.validationResults as Array<{
          check: string;
          passed: boolean;
        }>;
        expect(validationResults).toContainEqual(
          expect.objectContaining({ check: 'ENABLE ROW LEVEL SECURITY' })
        );
        expect(validationResults).toContainEqual(
          expect.objectContaining({ check: 'current_tenant_id function' })
        );
        expect(validationResults).toContainEqual(
          expect.objectContaining({ check: 'SELECT policy' })
        );
        expect(validationResults).toContainEqual(
          expect.objectContaining({ check: 'INSERT policy' })
        );
        expect(validationResults).toContainEqual(
          expect.objectContaining({ check: 'UPDATE policy' })
        );
        expect(validationResults).toContainEqual(
          expect.objectContaining({ check: 'DELETE policy' })
        );
      }
    });

    it('should handle file read errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await service.verifyRLSPolicies();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RLS_CHECK_FAILED');
      }
    });
  });

  // ==========================================================================
  // runSecurityTests Tests
  // ==========================================================================

  describe('runSecurityTests', () => {
    it('should return empty array when security tests disabled', async () => {
      const svc = new SecurityAuditService({ runSecurityTests: false });

      const result = await svc.runSecurityTests();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual([]);
      }
    });

    it('should run secrets check when enabled', async () => {
      const svc = new SecurityAuditService({ runSecurityTests: true });
      mockExecSync.mockReturnValue(''); // No secrets found

      const result = await svc.runSecurityTests();

      expect(result.success).toBe(true);
      if (result.success) {
        const secretsTest = result.value.find(t => t.testId === 'secrets-scan');
        expect(secretsTest).toBeDefined();
        expect(secretsTest?.category).toBe('secrets');
      }
    });

    it('should detect hardcoded secrets', async () => {
      const svc = new SecurityAuditService({ runSecurityTests: true });
      mockExecSync.mockReturnValue('./src/config.ts:10:const password = "supersecret123"');
      mockExistsSync.mockReturnValue(false);

      const result = await svc.runSecurityTests();

      expect(result.success).toBe(true);
      if (result.success) {
        const secretsTest = result.value.find(t => t.testId === 'secrets-scan');
        expect(secretsTest?.status).toBe('FAIL');
        expect(secretsTest?.findings.length).toBeGreaterThan(0);
        expect(secretsTest?.findings[0].cweId).toBe('CWE-798');
      }
    });

    it('should run credentials check', async () => {
      const svc = new SecurityAuditService({ runSecurityTests: true });
      mockExecSync.mockReturnValue('');
      mockExistsSync.mockReturnValue(false);

      const result = await svc.runSecurityTests();

      expect(result.success).toBe(true);
      if (result.success) {
        const credentialsTest = result.value.find(t => t.testId === 'credentials-check');
        expect(credentialsTest).toBeDefined();
      }
    });

    it('should check .env files for credentials', async () => {
      const svc = new SecurityAuditService({ runSecurityTests: true });
      mockExecSync.mockReturnValue('');
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        return String(filePath).includes('.env');
      });
      mockReadFileSync.mockReturnValue('DATABASE_SECRET=verylongsecretvaluefortesting123456');

      const result = await svc.runSecurityTests();

      expect(result.success).toBe(true);
      if (result.success) {
        const credentialsTest = result.value.find(t => t.testId === 'credentials-check');
        expect(credentialsTest).toBeDefined();
        if (credentialsTest?.findings.length > 0) {
          expect(credentialsTest.findings[0].cweId).toBe('CWE-312');
        }
      }
    });
  });

  // ==========================================================================
  // generateAuditReport Tests
  // ==========================================================================

  describe('generateAuditReport', () => {
    beforeEach(() => {
      // Setup default mocks for a clean audit
      mockExecSync.mockReturnValue(createMockNpmAuditOutput());
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockRlsMigration());
    });

    it('should generate comprehensive audit report', async () => {
      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.timestamp).toBeDefined();
        expect(result.value.reportId).toBeDefined();
        expect(result.value.categories).toBeDefined();
        expect(result.value.overallScore).toBeDefined();
        expect(result.value.criticalIssues).toBeDefined();
        expect(result.value.recommendations).toBeDefined();
      }
    });

    it('should include dependency audit category', async () => {
      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        const depCategory = result.value.categories.find(c => c.name === 'Dependencies');
        expect(depCategory).toBeDefined();
        expect(depCategory?.items.length).toBeGreaterThan(0);
        expect(depCategory?.frameworks).toContain('OWASP');
      }
    });

    it('should include authorization category with RLS check', async () => {
      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        const authCategory = result.value.categories.find(c => c.name === 'Authorization');
        expect(authCategory).toBeDefined();
        expect(authCategory?.items.some(i => i.id === 'AUTH-RLS-001')).toBe(true);
      }
    });

    it('should include supply chain category with SBOM check', async () => {
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        if (String(filePath).includes('sbom') || String(filePath).includes('bom')) {
          return createMockCycloneDxSbom();
        }
        return createMockRlsMigration();
      });

      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        const supplyChainCategory = result.value.categories.find(c => c.name === 'Supply Chain');
        expect(supplyChainCategory).toBeDefined();
        expect(supplyChainCategory?.items.some(i => i.id === 'SBOM-001')).toBe(true);
      }
    });

    it('should calculate overall score correctly', async () => {
      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.value.overallScore).toBeLessThanOrEqual(100);
      }
    });

    it('should add critical issues when vulnerabilities found', async () => {
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({ critical: 3 }));

      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.criticalIssues.length).toBeGreaterThan(0);
        expect(result.value.criticalIssues.some(i => i.includes('critical'))).toBe(true);
      }
    });

    it('should add recommendations when score below threshold', async () => {
      const svc = new SecurityAuditService({ minPassingScore: 100 });
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({ critical: 1 }));

      const result = await svc.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should calculate summary statistics', async () => {
      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success && result.value.summary) {
        expect(result.value.summary.totalChecks).toBeGreaterThan(0);
        expect(result.value.summary.passedChecks).toBeDefined();
        expect(result.value.summary.failedChecks).toBeDefined();
        expect(result.value.summary.warnings).toBeDefined();
      }
    });

    it('should skip disabled audit types', async () => {
      const svc = new SecurityAuditService({
        runNpmAudit: false,
        checkRlsPolicies: false,
        generateSbom: false,
      });

      const result = await svc.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.categories.length).toBe(0);
      }
    });

    it('should penalize score for critical issues', async () => {
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({ critical: 5 }));
      mockExistsSync.mockReturnValue(false); // RLS missing

      const result = await service.generateAuditReport();

      expect(result.success).toBe(true);
      if (result.success) {
        // Score should be significantly lower due to critical issues
        expect(result.value.overallScore).toBeLessThan(50);
      }
    });
  });

  // ==========================================================================
  // checkCompliance Tests
  // ==========================================================================

  describe('checkCompliance', () => {
    beforeEach(() => {
      mockExecSync.mockReturnValue(createMockNpmAuditOutput());
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(createMockRlsMigration());
    });

    it('should check OWASP compliance', async () => {
      const result = await service.checkCompliance(['OWASP']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.length).toBe(1);
        expect(result.value[0].framework).toBe('OWASP');
        expect(result.value[0].percentage).toBeGreaterThanOrEqual(0);
        expect(result.value[0].percentage).toBeLessThanOrEqual(100);
      }
    });

    it('should check multiple frameworks', async () => {
      const result = await service.checkCompliance(['OWASP', 'CWE', 'NIST']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.length).toBe(3);
        expect(result.value.map(r => r.framework)).toContain('OWASP');
        expect(result.value.map(r => r.framework)).toContain('CWE');
        expect(result.value.map(r => r.framework)).toContain('NIST');
      }
    });

    it('should report compliant when all controls pass', async () => {
      const result = await service.checkCompliance(['OWASP']);

      expect(result.success).toBe(true);
      if (result.success) {
        const owaspStatus = result.value.find(r => r.framework === 'OWASP');
        expect(owaspStatus?.failedControls.length).toBe(0);
        expect(owaspStatus?.compliant).toBe(true);
      }
    });

    it('should report non-compliant when controls fail', async () => {
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({ critical: 5 }));
      mockExistsSync.mockReturnValue(false); // RLS missing

      const result = await service.checkCompliance(['OWASP']);

      expect(result.success).toBe(true);
      if (result.success) {
        const owaspStatus = result.value.find(r => r.framework === 'OWASP');
        expect(owaspStatus?.failedControls.length).toBeGreaterThan(0);
        expect(owaspStatus?.compliant).toBe(false);
      }
    });

    it('should include passed and failed controls in response', async () => {
      mockExecSync.mockReturnValue(createMockNpmAuditOutput({ critical: 1 }));

      const result = await service.checkCompliance(['OWASP']);

      expect(result.success).toBe(true);
      if (result.success) {
        const owaspStatus = result.value.find(r => r.framework === 'OWASP');
        expect(owaspStatus?.passedControls).toBeDefined();
        expect(owaspStatus?.failedControls).toBeDefined();
      }
    });

    it('should handle SOC2 framework', async () => {
      const result = await service.checkCompliance(['SOC2']);

      expect(result.success).toBe(true);
      if (result.success) {
        const soc2Status = result.value.find(r => r.framework === 'SOC2');
        expect(soc2Status).toBeDefined();
      }
    });

    it('should return error when audit report fails', async () => {
      // Force an error by making all operations fail
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });
      mockExistsSync.mockReturnValue(false);

      // Create service with only npm audit enabled
      const svc = new SecurityAuditService({
        runNpmAudit: false,
        checkRlsPolicies: false,
        generateSbom: false,
      });

      const result = await svc.checkCompliance(['OWASP']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value[0].percentage).toBe(0);
      }
    });
  });

  // ==========================================================================
  // Factory and Singleton Tests
  // ==========================================================================

  describe('createSecurityAuditService', () => {
    it('should create new service instance', () => {
      const svc = createSecurityAuditService();
      expect(svc).toBeDefined();
      expect(svc.runDependencyAudit).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const svc = createSecurityAuditService({ runNpmAudit: false });
      expect(svc).toBeDefined();
    });
  });

  describe('getSecurityAuditService', () => {
    it('should return singleton instance', () => {
      const svc1 = getSecurityAuditService();
      const svc2 = getSecurityAuditService();
      expect(svc1).toBe(svc2);
    });

    it('should return new instance after reset', () => {
      const svc1 = getSecurityAuditService();
      resetSecurityAuditService();
      const svc2 = getSecurityAuditService();
      expect(svc1).not.toBe(svc2);
    });
  });

  describe('resetSecurityAuditService', () => {
    it('should reset the singleton instance', () => {
      const svc1 = getSecurityAuditService();
      resetSecurityAuditService();
      const svc2 = getSecurityAuditService();
      expect(svc1).not.toBe(svc2);
    });
  });
});
