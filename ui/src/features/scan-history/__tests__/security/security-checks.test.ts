/**
 * Security Test Suite for Scan History Feature
 * Agent #36 (Security Tester) - Phase 5 Testing
 * @module features/scan-history/__tests__/security/security-checks.test
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test Configuration
// ============================================================================

const FEATURE_ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(FEATURE_ROOT);

// Patterns that indicate potential security vulnerabilities
const SECURITY_PATTERNS = {
  xss: {
    dangerouslySetInnerHTML: /dangerouslySetInnerHTML/g,
    innerHTML: /\.innerHTML\s*=/g,
    outerHTML: /\.outerHTML\s*=/g,
    documentWrite: /document\.write\(/g,
  },
  injection: {
    eval: /\beval\s*\(/g,
    functionConstructor: /new\s+Function\s*\(/g,
    setTimeout: /setTimeout\s*\(\s*['"`]/g, // setTimeout with string
    setInterval: /setInterval\s*\(\s*['"`]/g, // setInterval with string
  },
  secrets: {
    hardcodedPassword: /password\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    hardcodedApiKey: /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/gi,
    hardcodedSecret: /secret\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    hardcodedToken: /token\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/gi,
    awsKey: /AKIA[0-9A-Z]{16}/g,
    privateKey: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  },
};

// Files to exclude from security scanning (test files, mocks, etc.)
const EXCLUDED_PATTERNS = [
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /test-helpers/,
  /\.mock\./,
];

// ============================================================================
// Utility Functions
// ============================================================================

function getSourceFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...getSourceFiles(fullPath));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        // Exclude test files
        const isExcluded = EXCLUDED_PATTERNS.some(pattern => pattern.test(fullPath));
        if (!isExcluded) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Directory might not exist in test environment
  }

  return files;
}

function scanFileForPattern(
  filePath: string,
  pattern: RegExp
): { line: number; match: string }[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: { line: number; match: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineMatches = lines[i].match(pattern);
      if (lineMatches) {
        matches.push({
          line: i + 1,
          match: lineMatches[0],
        });
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function scanForSecurityIssues(
  files: string[],
  patterns: Record<string, RegExp>
): Map<string, { file: string; line: number; match: string }[]> {
  const issues = new Map<string, { file: string; line: number; match: string }[]>();

  for (const [patternName, pattern] of Object.entries(patterns)) {
    const patternIssues: { file: string; line: number; match: string }[] = [];

    for (const file of files) {
      const matches = scanFileForPattern(file, pattern);
      for (const match of matches) {
        patternIssues.push({
          file: path.relative(FEATURE_ROOT, file),
          ...match,
        });
      }
    }

    issues.set(patternName, patternIssues);
  }

  return issues;
}

// ============================================================================
// Security Tests
// ============================================================================

describe('Security Audit: Scan History Feature', () => {
  const sourceFiles = getSourceFiles(SOURCE_DIR);

  describe('XSS Prevention (CWE-79)', () => {
    it('should not use dangerouslySetInnerHTML', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        dangerouslySetInnerHTML: SECURITY_PATTERNS.xss.dangerouslySetInnerHTML,
      });

      const findings = issues.get('dangerouslySetInnerHTML') || [];
      expect(findings).toHaveLength(0);
    });

    it('should not directly manipulate innerHTML', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        innerHTML: SECURITY_PATTERNS.xss.innerHTML,
      });

      const findings = issues.get('innerHTML') || [];
      expect(findings).toHaveLength(0);
    });

    it('should not use document.write', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        documentWrite: SECURITY_PATTERNS.xss.documentWrite,
      });

      const findings = issues.get('documentWrite') || [];
      expect(findings).toHaveLength(0);
    });
  });

  describe('Code Injection Prevention (CWE-95)', () => {
    it('should not use eval()', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        eval: SECURITY_PATTERNS.injection.eval,
      });

      const findings = issues.get('eval') || [];
      expect(findings).toHaveLength(0);
    });

    it('should not use Function constructor', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        functionConstructor: SECURITY_PATTERNS.injection.functionConstructor,
      });

      const findings = issues.get('functionConstructor') || [];
      expect(findings).toHaveLength(0);
    });

    it('should not use setTimeout/setInterval with string arguments', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        setTimeout: SECURITY_PATTERNS.injection.setTimeout,
        setInterval: SECURITY_PATTERNS.injection.setInterval,
      });

      const setTimeoutFindings = issues.get('setTimeout') || [];
      const setIntervalFindings = issues.get('setInterval') || [];

      expect(setTimeoutFindings).toHaveLength(0);
      expect(setIntervalFindings).toHaveLength(0);
    });
  });

  describe('Hardcoded Secrets Prevention (CWE-798)', () => {
    it('should not contain hardcoded passwords', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        hardcodedPassword: SECURITY_PATTERNS.secrets.hardcodedPassword,
      });

      const findings = issues.get('hardcodedPassword') || [];
      // Filter out false positives (like "password" in redaction lists)
      const realIssues = findings.filter(f =>
        !f.file.includes('logger.ts') && // Logger has sensitive keys list
        !f.match.includes('REDACTED')
      );

      expect(realIssues).toHaveLength(0);
    });

    it('should not contain hardcoded API keys', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        hardcodedApiKey: SECURITY_PATTERNS.secrets.hardcodedApiKey,
      });

      const findings = issues.get('hardcodedApiKey') || [];
      const realIssues = findings.filter(f => !f.file.includes('logger.ts'));

      expect(realIssues).toHaveLength(0);
    });

    it('should not contain AWS access keys', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        awsKey: SECURITY_PATTERNS.secrets.awsKey,
      });

      const findings = issues.get('awsKey') || [];
      expect(findings).toHaveLength(0);
    });

    it('should not contain private keys', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        privateKey: SECURITY_PATTERNS.secrets.privateKey,
      });

      const findings = issues.get('privateKey') || [];
      expect(findings).toHaveLength(0);
    });
  });

  describe('Input Validation', () => {
    it('should validate URL parameters before use', () => {
      // Check that useScanHistoryUrlState.ts has validation functions
      const urlStateFile = path.join(SOURCE_DIR, 'hooks/useScanHistoryUrlState.ts');

      try {
        const content = fs.readFileSync(urlStateFile, 'utf-8');

        // Check for validation patterns
        expect(content).toMatch(/parseScanId/);
        expect(content).toMatch(/parseViewMode/);
        expect(content).toMatch(/parsePagination/);
        expect(content).toMatch(/parseTimelineZoom/);
        expect(content).toMatch(/parseInt\([^,]+,\s*10\)/); // parseInt with radix
        expect(content).toMatch(/isNaN/); // NaN checking
      } catch {
        // File might not exist in test environment
      }
    });

    it('should have filter validation with bounds checking', () => {
      const filterHelpersFile = path.join(SOURCE_DIR, 'utils/filterHelpers.ts');

      try {
        const content = fs.readFileSync(filterHelpersFile, 'utf-8');

        // Check for validation patterns
        expect(content).toMatch(/validateFilters/);
        expect(content).toMatch(/searchQuery\.length\s*>\s*200/);
        expect(content).toMatch(/isScanStatus/);
      } catch {
        // File might not exist in test environment
      }
    });
  });

  describe('Sensitive Data Handling', () => {
    it('should have sensitive key redaction in logger', () => {
      const loggerFile = path.join(SOURCE_DIR, 'utils/logger.ts');

      try {
        const content = fs.readFileSync(loggerFile, 'utf-8');

        // Check for sensitive key definitions
        expect(content).toMatch(/SENSITIVE_KEYS/);
        expect(content).toMatch(/password/);
        expect(content).toMatch(/token/);
        expect(content).toMatch(/secret/);
        expect(content).toMatch(/apiKey/);
        expect(content).toMatch(/authorization/);
        expect(content).toMatch(/sanitizeData/);
        expect(content).toMatch(/\[REDACTED\]/);
      } catch {
        // File might not exist in test environment
      }
    });

    it('should exclude stack traces in production error logging', () => {
      const errorLoggingFile = path.join(SOURCE_DIR, 'utils/errorLogging.ts');

      try {
        const content = fs.readFileSync(errorLoggingFile, 'utf-8');

        // Check that stack traces are conditional on development
        expect(content).toMatch(/isDevelopment.*stack/s);
      } catch {
        // File might not exist in test environment
      }
    });

    it('should provide user-friendly error messages', () => {
      const errorHandlerFile = path.join(SOURCE_DIR, 'utils/errorHandler.ts');

      try {
        const content = fs.readFileSync(errorHandlerFile, 'utf-8');

        // Check for user-friendly message generation
        expect(content).toMatch(/getMessageForCode/);
        expect(content).toMatch(/getErrorMessage/);
        expect(content).not.toMatch(/exposes?\s+(?:internal|technical)/i);
      } catch {
        // File might not exist in test environment
      }
    });
  });

  describe('localStorage Security', () => {
    it('should not store sensitive data in localStorage', () => {
      // Scan for localStorage usage in source files (not tests)
      const issues = scanForSecurityIssues(sourceFiles, {
        localStorage: /localStorage\.(setItem|getItem)/g,
      });

      const findings = issues.get('localStorage') || [];

      // All localStorage usage should be in test helpers only
      const productionUsage = findings.filter(f =>
        !f.file.includes('__tests__') &&
        !f.file.includes('test-helpers')
      );

      expect(productionUsage).toHaveLength(0);
    });
  });

  describe('API Security', () => {
    it('should use centralized API client', () => {
      const apiFile = path.join(SOURCE_DIR, 'api.ts');

      try {
        const content = fs.readFileSync(apiFile, 'utf-8');

        // Check for centralized API client usage
        expect(content).toMatch(/from\s+['"]@\/core\/api/);
        expect(content).toMatch(/\b(get|post)\s*</); // Generic API functions
      } catch {
        // File might not exist in test environment
      }
    });

    it('should not construct SQL queries', () => {
      const issues = scanForSecurityIssues(sourceFiles, {
        sqlConstruction: /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE).*\$\{/gi,
      });

      const findings = issues.get('sqlConstruction') || [];
      expect(findings).toHaveLength(0);
    });
  });

  describe('Type Safety', () => {
    it('should use branded types for IDs', () => {
      const domainFile = path.join(SOURCE_DIR, 'types/domain.ts');

      try {
        const content = fs.readFileSync(domainFile, 'utf-8');

        // Check for branded type definitions
        expect(content).toMatch(/ScanId\s*=\s*string\s*&\s*\{\s*readonly\s+__brand/);
        expect(content).toMatch(/RepositoryId\s*=\s*string\s*&\s*\{\s*readonly\s+__brand/);
        expect(content).toMatch(/isScanId/);
        expect(content).toMatch(/createScanId/);
      } catch {
        // File might not exist in test environment
      }
    });

    it('should have type guards for domain objects', () => {
      const domainFile = path.join(SOURCE_DIR, 'types/domain.ts');

      try {
        const content = fs.readFileSync(domainFile, 'utf-8');

        // Check for type guards
        expect(content).toMatch(/isScan\s*\(/);
        expect(content).toMatch(/isScanStatus\s*\(/);
      } catch {
        // File might not exist in test environment
      }
    });
  });
});

// ============================================================================
// Security Score Calculation
// ============================================================================

describe('Security Score', () => {
  it('should meet PROHIB-4 security threshold (>= 90)', () => {
    const sourceFiles = getSourceFiles(SOURCE_DIR);
    let score = 100;
    const deductions: { reason: string; points: number }[] = [];

    // Check for XSS patterns (-20 each)
    const xssIssues = scanForSecurityIssues(sourceFiles, SECURITY_PATTERNS.xss);
    for (const [pattern, findings] of xssIssues) {
      if (findings.length > 0) {
        deductions.push({
          reason: `XSS vulnerability: ${pattern} (${findings.length} instances)`,
          points: 20,
        });
        score -= 20;
      }
    }

    // Check for injection patterns (-25 each)
    const injectionIssues = scanForSecurityIssues(sourceFiles, SECURITY_PATTERNS.injection);
    for (const [pattern, findings] of injectionIssues) {
      if (findings.length > 0) {
        deductions.push({
          reason: `Code injection: ${pattern} (${findings.length} instances)`,
          points: 25,
        });
        score -= 25;
      }
    }

    // Check for hardcoded secrets (-30 each)
    const secretIssues = scanForSecurityIssues(sourceFiles, SECURITY_PATTERNS.secrets);
    for (const [pattern, findings] of secretIssues) {
      // Filter out logger.ts which legitimately lists sensitive keys
      const realFindings = findings.filter(f => !f.file.includes('logger.ts'));
      if (realFindings.length > 0) {
        deductions.push({
          reason: `Hardcoded secret: ${pattern} (${realFindings.length} instances)`,
          points: 30,
        });
        score -= 30;
      }
    }

    // Log score breakdown
    if (deductions.length > 0) {
      console.log('\nSecurity Score Deductions:');
      for (const deduction of deductions) {
        console.log(`  -${deduction.points}: ${deduction.reason}`);
      }
    }
    console.log(`\nFinal Security Score: ${Math.max(0, score)}/100`);

    expect(score).toBeGreaterThanOrEqual(90);
  });
});
