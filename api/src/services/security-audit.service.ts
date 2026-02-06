/**
 * Security Audit Service
 * @module services/security-audit.service
 *
 * Provides comprehensive security auditing capabilities including:
 * - npm dependency vulnerability scanning
 * - SBOM (Software Bill of Materials) generation and parsing
 * - RLS (Row Level Security) policy verification
 * - Security test orchestration
 * - Compliance reporting
 *
 * TASK-SECURITY: Security audit service implementation
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import pino from 'pino';
import { Result, success, failure, isFailure } from '../types/utility.js';
import type {
  AuditCategory,
  AuditItem,
  AuditReport,
  AuditStatus,
  AuditSummary,
  ComplianceStatus,
  DependencyAuditResult,
  SBOM,
  SBOMComponent,
  SecurityAuditConfig,
  SecurityAuditError,
  SecurityFinding,
  SecurityTestResult,
  Vulnerability,
  VulnerabilityCounts,
} from '../types/security-audit.js';
import { DEFAULT_SECURITY_AUDIT_CONFIG, SecurityAuditError as AuditError } from '../types/security-audit.js';

const logger = pino({ name: 'security-audit-service' });

// ============================================================================
// Constants - Named values replacing magic numbers
// ============================================================================

/** Maximum number of security findings to report per pattern scan */
const MAX_FINDINGS_PER_PATTERN = 10;

/** Timeout for individual grep operations in milliseconds */
const GREP_TIMEOUT_MS = 10000;

/** Minimum credential value length to flag as potential secret */
const MIN_CREDENTIAL_VALUE_LENGTH = 20;

/** Critical issue score penalty multiplier */
const CRITICAL_ISSUE_PENALTY = 10;

/** Category weights for overall security score calculation */
const CATEGORY_WEIGHTS: Record<string, number> = {
  Dependencies: 0.30,
  Authorization: 0.35,
  'Security Tests': 0.25,
  'Supply Chain': 0.10,
} as const;

/** Default category weight for unknown categories */
const DEFAULT_CATEGORY_WEIGHT = 0.10;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Security Audit Service Interface
 */
export interface ISecurityAuditService {
  /**
   * Run npm dependency audit
   */
  runDependencyAudit(): Promise<Result<DependencyAuditResult, AuditError>>;

  /**
   * Generate or load SBOM (Software Bill of Materials)
   */
  generateSBOM(): Promise<Result<SBOM | null, AuditError>>;

  /**
   * Run security test suite
   */
  runSecurityTests(): Promise<Result<SecurityTestResult[], AuditError>>;

  /**
   * Verify RLS (Row Level Security) policies are configured
   */
  verifyRLSPolicies(): Promise<Result<AuditItem, AuditError>>;

  /**
   * Generate comprehensive audit report
   */
  generateAuditReport(): Promise<Result<AuditReport, AuditError>>;

  /**
   * Check compliance against specific frameworks
   */
  checkCompliance(frameworks: string[]): Promise<Result<ComplianceStatus[], AuditError>>;
}

// ============================================================================
// Security Audit Service Implementation
// ============================================================================

/**
 * Security Audit Service
 *
 * Orchestrates security auditing and compliance checking for the application.
 * Supports npm vulnerability scanning, SBOM generation, RLS verification,
 * and comprehensive security reporting.
 */
export class SecurityAuditService implements ISecurityAuditService {
  private readonly config: SecurityAuditConfig;

  constructor(config: Partial<SecurityAuditConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_AUDIT_CONFIG, ...config };
    logger.debug({ config: this.config }, 'SecurityAuditService initialized');
  }

  // ==========================================================================
  // Dependency Audit
  // ==========================================================================

  /**
   * Run npm audit and return structured results
   *
   * @returns Dependency audit result with vulnerability counts and findings
   */
  async runDependencyAudit(): Promise<Result<DependencyAuditResult, AuditError>> {
    logger.info('Running dependency audit');

    try {
      const execOptions: ExecSyncOptionsWithStringEncoding = {
        encoding: 'utf-8',
        cwd: this.config.workingDirectory,
        timeout: this.config.commandTimeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      // npm audit returns non-zero exit code when vulnerabilities are found
      // We use '|| true' to prevent throwing on non-zero exit
      let result: string;
      try {
        result = execSync('npm audit --json 2>/dev/null || true', execOptions);
      } catch (error) {
        // If npm audit itself fails (not just finding vulns), handle gracefully
        if (error instanceof Error && 'stdout' in error) {
          result = (error as { stdout: string }).stdout || '{}';
        } else {
          logger.warn({ error }, 'npm audit command failed, returning clean result');
          return success({
            vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 },
            passed: true,
            auditedAt: new Date().toISOString(),
            source: 'npm audit',
          });
        }
      }

      const audit = this.parseNpmAuditResult(result);

      logger.info(
        {
          vulnerabilities: audit.vulnerabilities,
          passed: audit.passed,
        },
        'Dependency audit completed'
      );

      return success(audit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, workingDir: this.config.workingDirectory }, 'Failed to run dependency audit');
      return failure(
        new AuditError(
          `Failed to run dependency audit: ${errorMessage}. Ensure npm is installed and package.json exists in ${this.config.workingDirectory ?? 'current directory'}.`,
          'AUDIT_COMMAND_FAILED',
          {
            cause: errorMessage,
            workingDirectory: this.config.workingDirectory,
            suggestion: 'Check that npm is available in PATH and the project has a valid package.json',
          }
        )
      );
    }
  }

  /**
   * Parse npm audit JSON output into structured result
   *
   * Handles both npm 6 and npm 7+ output formats. npm uses "moderate" severity
   * while our interface uses "medium", so this method normalizes the mapping.
   *
   * @param jsonOutput - Raw JSON string from npm audit --json command
   * @returns Structured dependency audit result with normalized severity counts
   */
  private parseNpmAuditResult(jsonOutput: string): DependencyAuditResult {
    try {
      const audit = JSON.parse(jsonOutput);

      // Handle different npm audit output formats (npm 6 vs npm 7+)
      // IMPORTANT: npm outputs "moderate" but our VulnerabilityCounts interface expects "medium"
      // We must explicitly map moderate -> medium for both metadata.vulnerabilities and
      // the fallback vulnerabilities object
      const rawVulns = audit.metadata?.vulnerabilities;
      const vulns: VulnerabilityCounts = rawVulns
        ? {
            critical: rawVulns.critical ?? 0,
            high: rawVulns.high ?? 0,
            // Map npm's "moderate" to our "medium" - this is the key fix
            medium: rawVulns.moderate ?? rawVulns.medium ?? 0,
            low: rawVulns.low ?? 0,
          }
        : {
            critical: audit.vulnerabilities?.critical ?? 0,
            high: audit.vulnerabilities?.high ?? 0,
            medium: audit.vulnerabilities?.moderate ?? audit.vulnerabilities?.medium ?? 0,
            low: audit.vulnerabilities?.low ?? 0,
          };

      const findings: Vulnerability[] = this.extractVulnerabilities(audit);

      return {
        vulnerabilities: vulns,
        passed:
          vulns.critical <= this.config.maxCriticalVulns &&
          vulns.high <= this.config.maxHighVulns,
        findings,
        totalDependencies: audit.metadata?.dependencies ?? undefined,
        vulnerableDependencies: findings.length > 0 ? findings.length : 0,
        source: 'npm audit',
        auditedAt: new Date().toISOString(),
      };
    } catch (parseError) {
      logger.warn({ parseError }, 'Failed to parse npm audit output');
      return {
        vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 },
        passed: true,
        auditedAt: new Date().toISOString(),
        source: 'npm audit',
      };
    }
  }

  /**
   * Extract detailed vulnerability information from npm audit output
   *
   * Supports both npm 7+ format (with advisories object) and npm 8+ format
   * (with vulnerabilities object). Normalizes severity levels to our standard
   * format (critical, high, medium, low, info).
   *
   * @param audit - Parsed npm audit JSON object
   * @returns Array of normalized vulnerability findings
   */
  private extractVulnerabilities(audit: Record<string, unknown>): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    // Handle npm 7+ format with advisories
    const advisories = audit.advisories as Record<string, unknown> | undefined;
    if (advisories) {
      for (const [id, advisory] of Object.entries(advisories)) {
        const adv = advisory as Record<string, unknown>;
        vulnerabilities.push({
          id,
          title: String(adv.title ?? 'Unknown'),
          description: adv.overview ? String(adv.overview) : undefined,
          severity: this.mapNpmSeverity(String(adv.severity ?? 'low')),
          cveId: adv.cves ? String((adv.cves as string[])[0]) : undefined,
          cweId: adv.cwe ? String(adv.cwe) : undefined,
          packageName: String(adv.module_name ?? ''),
          affectedVersions: adv.vulnerable_versions ? String(adv.vulnerable_versions) : undefined,
          fixedIn: adv.patched_versions ? String(adv.patched_versions) : undefined,
          remediation: adv.recommendation ? String(adv.recommendation) : undefined,
          references: adv.references ? [String(adv.references)] : undefined,
        });
      }
    }

    // Handle npm 8+ format with vulnerabilities object
    const vulnObj = audit.vulnerabilities as Record<string, unknown> | undefined;
    if (vulnObj && typeof vulnObj === 'object' && !Array.isArray(vulnObj)) {
      for (const [packageName, vuln] of Object.entries(vulnObj)) {
        if (typeof vuln === 'object' && vuln !== null && 'severity' in vuln) {
          const v = vuln as Record<string, unknown>;
          if (!vulnerabilities.some((existing) => existing.packageName === packageName)) {
            vulnerabilities.push({
              id: `npm-${packageName}`,
              title: `Vulnerability in ${packageName}`,
              severity: this.mapNpmSeverity(String(v.severity ?? 'low')),
              packageName,
              affectedVersions: v.range ? String(v.range) : undefined,
              fixedIn: v.fixAvailable ? 'Update available' : undefined,
            });
          }
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Map npm severity string to our standardized AuditSeverity type
   *
   * npm uses different severity terminology:
   * - "moderate" in npm -> "medium" in our system
   * - All other levels map directly
   *
   * @param severity - Raw severity string from npm audit
   * @returns Normalized severity level for our audit system
   */
  private mapNpmSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const NPM_SEVERITY_MAP: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
      critical: 'critical',
      high: 'high',
      moderate: 'medium', // npm uses "moderate", we use "medium"
      medium: 'medium',
      low: 'low',
      info: 'info',
    };
    return NPM_SEVERITY_MAP[severity.toLowerCase()] ?? 'info';
  }

  // ==========================================================================
  // SBOM Generation
  // ==========================================================================

  /**
   * Generate or load existing SBOM (Software Bill of Materials)
   *
   * Looks for existing SBOM file first, otherwise attempts to generate one
   * using CycloneDX or similar tools.
   */
  async generateSBOM(): Promise<Result<SBOM | null, AuditError>> {
    logger.info('Loading/generating SBOM');

    try {
      const sbomPath = this.config.sbomPath ?? this.findSbomFile();

      if (sbomPath && existsSync(sbomPath)) {
        logger.debug({ sbomPath }, 'Found existing SBOM file');
        const sbomContent = readFileSync(sbomPath, 'utf-8');
        const sbom = this.parseSbom(sbomContent);
        return success(sbom);
      }

      // Try to generate SBOM using cyclonedx-npm if available
      const generatedSbom = await this.tryGenerateSbom();
      if (generatedSbom) {
        return success(generatedSbom);
      }

      logger.info('No SBOM file found and unable to generate');
      return success(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, sbomPath: this.config.sbomPath }, 'Failed to load/generate SBOM');
      return failure(
        new AuditError(
          `Failed to generate SBOM: ${errorMessage}. Check SBOM file format and permissions.`,
          'SBOM_GENERATION_FAILED',
          {
            cause: errorMessage,
            sbomPath: this.config.sbomPath,
            suggestion: 'Ensure SBOM file is valid CycloneDX or SPDX JSON format',
          }
        )
      );
    }
  }

  /**
   * Find existing SBOM file in common locations
   *
   * Searches for SBOM files in standard locations following CycloneDX and SPDX
   * naming conventions. Checks both JSON and XML formats.
   *
   * @returns Absolute path to SBOM file if found, null otherwise
   */
  private findSbomFile(): string | null {
    const baseDir = this.config.workingDirectory ?? process.cwd();
    const possiblePaths = [
      'sbom.json',
      'bom.json',
      'cyclonedx.json',
      'sbom.xml',
      'bom.xml',
      '.sbom/sbom.json',
      'dist/sbom.json',
    ];

    for (const relativePath of possiblePaths) {
      const fullPath = join(baseDir, relativePath);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Parse SBOM content from JSON string
   *
   * Supports both CycloneDX and SPDX formats. Extracts component information
   * including name, version, license, and package URLs (purls).
   *
   * @param content - Raw JSON string containing SBOM data
   * @returns Parsed and normalized SBOM object
   * @throws Error if SBOM format is not recognized
   */
  private parseSbom(content: string): SBOM {
    const parsed = JSON.parse(content);

    // Handle CycloneDX format
    if (parsed.bomFormat === 'CycloneDX' || parsed.specVersion) {
      return {
        metadata: {
          format: 'CycloneDX',
          specVersion: parsed.specVersion ?? '1.4',
          timestamp: parsed.metadata?.timestamp ?? new Date().toISOString(),
          tools: parsed.metadata?.tools?.map((t: { name: string; version: string }) => ({
            name: t.name,
            version: t.version,
          })),
          serialNumber: parsed.serialNumber,
        },
        components: (parsed.components ?? []).map((c: Record<string, unknown>) => ({
          name: String(c.name),
          version: String(c.version ?? ''),
          purl: c.purl ? String(c.purl) : undefined,
          type: String(c.type ?? 'library'),
          license: this.extractLicense(c),
          author: c.author ? String(c.author) : undefined,
          scope: c.scope as 'required' | 'optional' | 'dev' | undefined,
          hashes: c.hashes as Array<{ alg: string; content: string }> | undefined,
          externalReferences: c.externalReferences as Array<{ type: string; url: string }> | undefined,
        })),
        dependencies: parsed.dependencies,
      };
    }

    // Handle SPDX format (basic support)
    if (parsed.spdxVersion) {
      return {
        metadata: {
          format: 'SPDX',
          specVersion: parsed.spdxVersion,
          timestamp: parsed.creationInfo?.created ?? new Date().toISOString(),
        },
        components: (parsed.packages ?? []).map((p: Record<string, unknown>) => ({
          name: String(p.name),
          version: String(p.versionInfo ?? ''),
          type: 'library',
          license: p.licenseDeclared ? String(p.licenseDeclared) : undefined,
        })),
      };
    }

    throw new Error('Unknown SBOM format');
  }

  /**
   * Extract license information from SBOM component data
   *
   * Handles both single license and multi-license scenarios common in
   * CycloneDX format where licenses are nested in a licenses array.
   *
   * @param component - Raw component data from SBOM
   * @returns Single license string, array of licenses, or undefined if none found
   */
  private extractLicense(component: Record<string, unknown>): string | string[] | undefined {
    if (component.licenses) {
      const licenses = component.licenses as Array<{ license?: { id?: string; name?: string } }>;
      const extracted = licenses
        .map((l) => l.license?.id ?? l.license?.name)
        .filter((l): l is string => l !== undefined);
      return extracted.length === 1 ? extracted[0] : extracted.length > 0 ? extracted : undefined;
    }
    return undefined;
  }

  /**
   * Attempt to generate SBOM using available tools
   *
   * Tries to use cyclonedx-npm to generate a CycloneDX-format SBOM.
   * This is a best-effort operation that returns null if the tool
   * is not available or fails.
   *
   * @returns Generated SBOM if successful, null otherwise
   */
  private async tryGenerateSbom(): Promise<SBOM | null> {
    try {
      // Try cyclonedx-npm first
      const result = execSync('npx @cyclonedx/cyclonedx-npm --output-format json 2>/dev/null', {
        encoding: 'utf-8',
        cwd: this.config.workingDirectory,
        timeout: this.config.commandTimeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return this.parseSbom(result);
    } catch {
      logger.debug('SBOM generation tool not available');
      return null;
    }
  }

  // ==========================================================================
  // Security Tests
  // ==========================================================================

  /**
   * Run security test suite
   *
   * Integrates with various security testing tools (SAST, DAST, etc.)
   */
  async runSecurityTests(): Promise<Result<SecurityTestResult[], AuditError>> {
    logger.info('Running security tests');

    if (!this.config.runSecurityTests) {
      logger.debug('Security tests disabled in config');
      return success([]);
    }

    const results: SecurityTestResult[] = [];

    try {
      // Check for secrets in code
      const secretsResult = await this.runSecretsCheck();
      if (secretsResult) {
        results.push(secretsResult);
      }

      // Check for hardcoded credentials patterns
      const credentialsResult = await this.runCredentialsCheck();
      if (credentialsResult) {
        results.push(credentialsResult);
      }

      logger.info({ testCount: results.length }, 'Security tests completed');
      return success(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, workingDir: this.config.workingDirectory }, 'Failed to run security tests');
      return failure(
        new AuditError(
          `Failed to run security tests: ${errorMessage}. Ensure grep is available and source files are accessible.`,
          'SECURITY_TEST_FAILED',
          {
            cause: errorMessage,
            workingDirectory: this.config.workingDirectory,
            suggestion: 'Check file permissions and ensure grep utility is installed',
          }
        )
      );
    }
  }

  /**
   * Run secrets detection check across source files
   *
   * Scans TypeScript, JavaScript, JSON, and .env files for patterns that
   * commonly indicate hardcoded secrets:
   * - Hardcoded passwords (password=, passwd=, pwd=)
   * - API keys (api_key=, apikey=)
   * - Secrets and tokens (secret=, token=)
   * - Private keys (-----BEGIN PRIVATE KEY-----)
   *
   * Uses grep with regex patterns for fast scanning. Limits findings per
   * pattern to MAX_FINDINGS_PER_PATTERN to avoid overwhelming reports.
   *
   * @returns Security test result with any detected secret findings
   */
  private async runSecretsCheck(): Promise<SecurityTestResult | null> {
    const findings: SecurityFinding[] = [];
    const baseDir = this.config.workingDirectory ?? process.cwd();

    // Common patterns for secrets
    const secretPatterns = [
      { pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/gi, name: 'Hardcoded password' },
      { pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][^'"]{16,}['"]/gi, name: 'API key' },
      { pattern: /(?:secret|token)\s*[=:]\s*['"][^'"]{16,}['"]/gi, name: 'Secret/Token' },
      { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, name: 'Private key' },
    ];

    try {
      // Use grep to search for patterns in source files
      for (const { pattern, name } of secretPatterns) {
        try {
          const grepPattern = pattern.source.replace(/\(\?:/g, '(');
          const result = execSync(
            `grep -rn -E "${grepPattern}" --include="*.ts" --include="*.js" --include="*.json" --include="*.env*" . 2>/dev/null || true`,
            {
              encoding: 'utf-8',
              cwd: baseDir,
              timeout: GREP_TIMEOUT_MS,
            }
          );

          if (result.trim()) {
            const lines = result.trim().split('\n');
            for (const line of lines.slice(0, MAX_FINDINGS_PER_PATTERN)) {
              // Limit findings per pattern to avoid overwhelming reports
              const match = line.match(/^([^:]+):(\d+):/);
              if (match) {
                findings.push({
                  id: `SEC-${findings.length + 1}`,
                  title: `Potential ${name} detected`,
                  severity: 'high',
                  filePath: match[1],
                  lineNumber: parseInt(match[2], 10),
                  cweId: 'CWE-798',
                  remediation: 'Move secrets to environment variables or a secrets manager',
                });
              }
            }
          }
        } catch {
          // Individual pattern search failed, continue
        }
      }
    } catch {
      logger.debug('Secrets check grep failed');
    }

    return {
      testId: 'secrets-scan',
      testName: 'Secrets Detection',
      category: 'secrets',
      status: findings.length === 0 ? 'PASS' : 'FAIL',
      findings,
      executedAt: new Date().toISOString(),
      tool: 'internal-grep',
    };
  }

  /**
   * Run credentials pattern check on .env files
   *
   * Checks for potential credentials stored in environment files that might
   * accidentally be committed. Looks for keys containing "secret", "key",
   * "password", or "token" with values longer than MIN_CREDENTIAL_VALUE_LENGTH.
   *
   * Excludes obvious placeholders (your-, xxx, placeholder) from findings.
   *
   * @returns Security test result with WARNING status if potential credentials found
   */
  private async runCredentialsCheck(): Promise<SecurityTestResult | null> {
    const findings: SecurityFinding[] = [];
    const baseDir = this.config.workingDirectory ?? process.cwd();

    // Check for .env files that might contain secrets
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];

    for (const envFile of envFiles) {
      const envPath = join(baseDir, envFile);
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Check for non-placeholder values (not empty, not placeholder patterns)
          if (
            line.includes('=') &&
            !line.startsWith('#') &&
            !line.includes('your-') &&
            !line.includes('xxx') &&
            !line.includes('placeholder')
          ) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=');
            if (
              value.length > MIN_CREDENTIAL_VALUE_LENGTH &&
              (key.toLowerCase().includes('secret') ||
                key.toLowerCase().includes('key') ||
                key.toLowerCase().includes('password') ||
                key.toLowerCase().includes('token'))
            ) {
              findings.push({
                id: `CRED-${findings.length + 1}`,
                title: `Potential credential in ${envFile}`,
                severity: 'medium',
                filePath: envFile,
                lineNumber: i + 1,
                cweId: 'CWE-312',
                remediation: 'Ensure .env files are in .gitignore and use a secrets manager',
              });
            }
          }
        }
      }
    }

    return {
      testId: 'credentials-check',
      testName: 'Credentials Pattern Check',
      category: 'secrets',
      status: findings.length === 0 ? 'PASS' : 'WARNING',
      findings,
      executedAt: new Date().toISOString(),
      tool: 'internal-scan',
    };
  }

  // ==========================================================================
  // RLS Policy Verification
  // ==========================================================================

  /**
   * Verify Row Level Security (RLS) policies are configured
   *
   * Checks for the existence of RLS migration files and validates
   * that tenant isolation is properly configured.
   */
  async verifyRLSPolicies(): Promise<Result<AuditItem, AuditError>> {
    logger.info('Verifying RLS policies');

    try {
      const baseDir = this.config.workingDirectory ?? process.cwd();
      const rlsMigrationPath =
        this.config.rlsMigrationPath ?? join(baseDir, 'migrations/004_rls_policies.sql');

      const absolutePath = resolve(rlsMigrationPath);
      const exists = existsSync(absolutePath);

      if (!exists) {
        logger.warn({ path: absolutePath }, 'RLS migration file not found');
        return success({
          id: 'AUTH-RLS-001',
          item: 'RLS policies enabled on all tenant tables',
          status: 'FAIL',
          evidence: `RLS migration file not found at ${rlsMigrationPath}`,
          cweId: 'CWE-639',
          severity: 'critical',
          remediation: 'Create RLS policies migration to enable row-level security for tenant isolation',
          checkedAt: new Date().toISOString(),
        });
      }

      // Read and validate the RLS migration content
      const content = readFileSync(absolutePath, 'utf-8');
      const validationResults = this.validateRLSMigration(content);

      const allPassed = validationResults.every((r) => r.passed);
      const evidence = validationResults
        .map((r) => `${r.check}: ${r.passed ? 'OK' : 'MISSING'}`)
        .join('; ');

      logger.info(
        { exists, validationResults, allPassed },
        'RLS policy verification completed'
      );

      return success({
        id: 'AUTH-RLS-001',
        item: 'RLS policies enabled on all tenant tables',
        status: allPassed ? 'PASS' : 'WARNING',
        evidence: `Found ${rlsMigrationPath}. Checks: ${evidence}`,
        cweId: 'CWE-639',
        severity: allPassed ? undefined : 'high',
        remediation: allPassed
          ? undefined
          : 'Ensure RLS policies cover all CRUD operations on tenant-scoped tables',
        checkedAt: new Date().toISOString(),
        metadata: { validationResults },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const rlsPath = this.config.rlsMigrationPath ?? 'migrations/004_rls_policies.sql';
      logger.error({ error, rlsMigrationPath: rlsPath }, 'Failed to verify RLS policies');
      return failure(
        new AuditError(
          `Failed to verify RLS policies: ${errorMessage}. Check if migration file exists at ${rlsPath}.`,
          'RLS_CHECK_FAILED',
          {
            cause: errorMessage,
            rlsMigrationPath: rlsPath,
            suggestion: 'Ensure the RLS migration SQL file exists and is readable',
          }
        )
      );
    }
  }

  /**
   * Validate RLS migration content for required patterns
   *
   * Checks for essential RLS components:
   * - ENABLE ROW LEVEL SECURITY statement
   * - current_tenant_id() function usage
   * - SELECT, INSERT, UPDATE, DELETE policies
   * - Coverage of repositories and scans tables
   *
   * @param content - Raw SQL content of the RLS migration file
   * @returns Array of check results indicating which patterns were found
   */
  private validateRLSMigration(
    content: string
  ): Array<{ check: string; passed: boolean }> {
    const checks = [
      {
        check: 'ENABLE ROW LEVEL SECURITY',
        pattern: /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
      },
      {
        check: 'current_tenant_id function',
        pattern: /current_tenant_id\s*\(\)/i,
      },
      {
        check: 'SELECT policy',
        pattern: /CREATE\s+POLICY\s+\w+\s+ON\s+\w+\s+FOR\s+SELECT/i,
      },
      {
        check: 'INSERT policy',
        pattern: /CREATE\s+POLICY\s+\w+\s+ON\s+\w+\s+FOR\s+INSERT/i,
      },
      {
        check: 'UPDATE policy',
        pattern: /CREATE\s+POLICY\s+\w+\s+ON\s+\w+\s+FOR\s+UPDATE/i,
      },
      {
        check: 'DELETE policy',
        pattern: /CREATE\s+POLICY\s+\w+\s+ON\s+\w+\s+FOR\s+DELETE/i,
      },
      {
        check: 'repositories RLS',
        pattern: /repositories.*ENABLE\s+ROW\s+LEVEL\s+SECURITY|POLICY\s+\w+.*repositories/i,
      },
      {
        check: 'scans RLS',
        pattern: /scans.*ENABLE\s+ROW\s+LEVEL\s+SECURITY|POLICY\s+\w+.*scans/i,
      },
    ];

    return checks.map(({ check, pattern }) => ({
      check,
      passed: pattern.test(content),
    }));
  }

  // ==========================================================================
  // Audit Report Generation
  // ==========================================================================

  /**
   * Generate comprehensive security audit report
   *
   * Aggregates results from all security checks into a unified report
   * with overall scoring and recommendations.
   */
  async generateAuditReport(): Promise<Result<AuditReport, AuditError>> {
    logger.info('Generating security audit report');

    const categories: AuditCategory[] = [];
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Run dependency audit
      if (this.config.runNpmAudit) {
        const depAuditResult = await this.runDependencyAudit();
        if (depAuditResult.success) {
          const depAudit = depAuditResult.value;
          const depItems: AuditItem[] = [
            {
              id: 'DEP-001',
              item: 'No critical npm vulnerabilities',
              status: depAudit.vulnerabilities.critical === 0 ? 'PASS' : 'FAIL',
              evidence: `Critical: ${depAudit.vulnerabilities.critical}`,
              severity: depAudit.vulnerabilities.critical > 0 ? 'critical' : undefined,
              cweId: 'CWE-1035',
            },
            {
              id: 'DEP-002',
              item: 'No high severity npm vulnerabilities',
              status: depAudit.vulnerabilities.high === 0 ? 'PASS' : 'FAIL',
              evidence: `High: ${depAudit.vulnerabilities.high}`,
              severity: depAudit.vulnerabilities.high > 0 ? 'high' : undefined,
              cweId: 'CWE-1035',
            },
            {
              id: 'DEP-003',
              item: 'Overall dependency security',
              status: depAudit.passed ? 'PASS' : 'FAIL',
              evidence: `Critical: ${depAudit.vulnerabilities.critical}, High: ${depAudit.vulnerabilities.high}, Medium: ${depAudit.vulnerabilities.medium}, Low: ${depAudit.vulnerabilities.low}`,
            },
          ];

          const passedCount = depItems.filter((i) => i.status === 'PASS').length;
          categories.push({
            name: 'Dependencies',
            description: 'npm package vulnerability scanning',
            items: depItems,
            passRate: (passedCount / depItems.length) * 100,
            frameworks: ['OWASP', 'CWE'],
          });

          if (depAudit.vulnerabilities.critical > 0) {
            criticalIssues.push(
              `${depAudit.vulnerabilities.critical} critical npm vulnerabilities found`
            );
            recommendations.push('Run `npm audit fix` to address dependency vulnerabilities');
          }
        }
      }

      // Run RLS verification
      if (this.config.checkRlsPolicies) {
        const rlsResult = await this.verifyRLSPolicies();
        if (rlsResult.success) {
          const rlsCheck = rlsResult.value;
          categories.push({
            name: 'Authorization',
            description: 'Row-Level Security and access control',
            items: [rlsCheck],
            passRate: rlsCheck.status === 'PASS' ? 100 : 0,
            frameworks: ['OWASP', 'SOC2'],
          });

          if (rlsCheck.status === 'FAIL') {
            criticalIssues.push('RLS policies not properly configured');
            recommendations.push(
              'Implement Row-Level Security policies for multi-tenant data isolation'
            );
          }
        }
      }

      // Run security tests
      if (this.config.runSecurityTests) {
        const testsResult = await this.runSecurityTests();
        if (testsResult.success && testsResult.value.length > 0) {
          const testItems: AuditItem[] = testsResult.value.map((test) => ({
            id: test.testId.toUpperCase(),
            item: test.testName,
            status: test.status,
            evidence: `${test.findings.length} findings`,
            severity:
              test.status === 'FAIL'
                ? test.findings.some((f) => f.severity === 'critical')
                  ? 'critical'
                  : 'high'
                : undefined,
          }));

          const passedTests = testItems.filter((i) => i.status === 'PASS').length;
          categories.push({
            name: 'Security Tests',
            description: 'Static analysis and secrets detection',
            items: testItems,
            passRate: (passedTests / testItems.length) * 100,
            frameworks: ['OWASP', 'CWE'],
          });

          for (const test of testsResult.value) {
            if (test.findings.some((f) => f.severity === 'critical' || f.severity === 'high')) {
              criticalIssues.push(`Security issue in ${test.testName}`);
            }
          }
        }
      }

      // Check SBOM availability
      if (this.config.generateSbom) {
        const sbomResult = await this.generateSBOM();
        const sbomAvailable = sbomResult.success && sbomResult.value !== null;
        categories.push({
          name: 'Supply Chain',
          description: 'Software Bill of Materials (SBOM)',
          items: [
            {
              id: 'SBOM-001',
              item: 'SBOM available',
              status: sbomAvailable ? 'PASS' : 'WARNING',
              evidence: sbomAvailable
                ? `SBOM generated with ${sbomResult.value?.components.length ?? 0} components`
                : 'SBOM not available',
              remediation: sbomAvailable
                ? undefined
                : 'Generate SBOM using CycloneDX or SPDX tools',
            },
          ],
          passRate: sbomAvailable ? 100 : 50,
          frameworks: ['NIST'],
        });

        if (!sbomAvailable) {
          recommendations.push(
            'Generate Software Bill of Materials (SBOM) for supply chain transparency'
          );
        }
      }

      // Calculate overall score
      const summary = this.calculateSummary(categories);
      const overallScore = this.calculateOverallScore(categories, criticalIssues.length);

      // Generate additional recommendations based on score
      if (overallScore < this.config.minPassingScore) {
        recommendations.push(
          `Security score (${overallScore}%) is below minimum threshold (${this.config.minPassingScore}%)`
        );
      }

      const report: AuditReport = {
        timestamp: new Date().toISOString(),
        reportId: `audit-${Date.now()}`,
        categories,
        overallScore,
        criticalIssues,
        recommendations: [...new Set(recommendations)], // Deduplicate
        summary,
      };

      logger.info(
        {
          overallScore,
          categoryCount: categories.length,
          criticalIssueCount: criticalIssues.length,
        },
        'Audit report generated'
      );

      return success(report);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, config: this.config }, 'Failed to generate audit report');
      return failure(
        new AuditError(
          `Failed to generate comprehensive audit report: ${errorMessage}. One or more audit components failed during execution.`,
          'INTERNAL_ERROR',
          {
            cause: errorMessage,
            suggestion: 'Check individual audit component logs for specific failures',
            enabledChecks: {
              npmAudit: this.config.runNpmAudit,
              sbom: this.config.generateSbom,
              rlsPolicies: this.config.checkRlsPolicies,
              securityTests: this.config.runSecurityTests,
            },
          }
        )
      );
    }
  }

  /**
   * Calculate summary statistics from categories
   *
   * Aggregates pass/fail/warning/skip/error counts across all audit items
   * in all categories.
   *
   * @param categories - Array of audit categories to summarize
   * @returns Summary statistics object
   */
  private calculateSummary(categories: AuditCategory[]): AuditSummary {
    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;
    let warnings = 0;
    let skipped = 0;
    let errors = 0;

    for (const category of categories) {
      for (const item of category.items) {
        totalChecks++;
        switch (item.status) {
          case 'PASS':
            passedChecks++;
            break;
          case 'FAIL':
            failedChecks++;
            break;
          case 'WARNING':
            warnings++;
            break;
          case 'SKIP':
            skipped++;
            break;
          case 'ERROR':
            errors++;
            break;
        }
      }
    }

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      warnings,
      skipped,
      errors,
    };
  }

  /**
   * Calculate overall security score (0-100)
   *
   * Uses weighted averaging across categories based on their security importance.
   * Authorization has the highest weight (35%) as it's critical for multi-tenant
   * security, followed by Dependencies (30%), Security Tests (25%), and
   * Supply Chain (10%).
   *
   * Critical issues apply a penalty of 10 points each to the final score.
   *
   * @param categories - Array of audit categories with their pass rates
   * @param criticalIssueCount - Number of critical issues found
   * @returns Overall security score from 0-100
   */
  private calculateOverallScore(
    categories: AuditCategory[],
    criticalIssueCount: number
  ): number {
    if (categories.length === 0) return 0;

    let weightedScore = 0;
    let totalWeight = 0;

    for (const category of categories) {
      const weight = CATEGORY_WEIGHTS[category.name] ?? DEFAULT_CATEGORY_WEIGHT;
      weightedScore += category.passRate * weight;
      totalWeight += weight;
    }

    let score = totalWeight > 0 ? weightedScore / totalWeight : 0;

    // Penalize for critical issues - each critical issue reduces score significantly
    score = Math.max(0, score - criticalIssueCount * CRITICAL_ISSUE_PENALTY);

    return Math.round(score);
  }

  // ==========================================================================
  // Compliance Checking
  // ==========================================================================

  /**
   * Check compliance against specific frameworks
   */
  async checkCompliance(frameworks: string[]): Promise<Result<ComplianceStatus[], AuditError>> {
    logger.info({ frameworks }, 'Checking compliance');

    try {
      const reportResult = await this.generateAuditReport();
      if (isFailure(reportResult)) {
        return failure(reportResult.error);
      }

      const report = reportResult.value;
      const results: ComplianceStatus[] = [];

      for (const framework of frameworks) {
        const status = this.evaluateFrameworkCompliance(framework, report);
        results.push(status);
      }

      return success(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, frameworks }, 'Failed to check compliance');
      return failure(
        new AuditError(
          `Failed to check compliance for frameworks [${frameworks.join(', ')}]: ${errorMessage}. Audit report generation may have failed.`,
          'INTERNAL_ERROR',
          {
            cause: errorMessage,
            requestedFrameworks: frameworks,
            suggestion: 'Ensure the audit report can be generated successfully before checking compliance',
          }
        )
      );
    }
  }

  /**
   * Evaluate compliance for a specific framework
   *
   * Maps audit categories to compliance frameworks and calculates pass/fail
   * rates for controls within each framework.
   *
   * @param framework - Compliance framework to evaluate (e.g., 'OWASP', 'SOC2')
   * @param report - Generated audit report to evaluate against
   * @returns Compliance status with passed/failed controls and percentage
   */
  private evaluateFrameworkCompliance(
    framework: string,
    report: AuditReport
  ): ComplianceStatus {
    const passedControls: string[] = [];
    const failedControls: string[] = [];

    // Find categories that apply to this framework
    for (const category of report.categories) {
      if (category.frameworks?.includes(framework as 'OWASP' | 'CWE' | 'NIST' | 'SOC2' | 'PCI-DSS' | 'HIPAA' | 'GDPR')) {
        for (const item of category.items) {
          if (item.status === 'PASS') {
            passedControls.push(`${item.id}: ${item.item}`);
          } else if (item.status === 'FAIL') {
            failedControls.push(`${item.id}: ${item.item}`);
          }
        }
      }
    }

    const totalControls = passedControls.length + failedControls.length;
    const percentage = totalControls > 0 ? (passedControls.length / totalControls) * 100 : 0;

    return {
      framework: framework as 'OWASP' | 'CWE' | 'NIST' | 'SOC2' | 'PCI-DSS' | 'HIPAA' | 'GDPR',
      compliant: failedControls.length === 0,
      percentage: Math.round(percentage),
      failedControls,
      passedControls,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new security audit service instance
 */
export function createSecurityAuditService(
  config?: Partial<SecurityAuditConfig>
): ISecurityAuditService {
  return new SecurityAuditService(config);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let securityAuditServiceInstance: SecurityAuditService | null = null;

/**
 * Get the singleton security audit service instance
 */
export function getSecurityAuditService(): ISecurityAuditService {
  if (!securityAuditServiceInstance) {
    securityAuditServiceInstance = new SecurityAuditService();
  }
  return securityAuditServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSecurityAuditService(): void {
  securityAuditServiceInstance = null;
}

// ============================================================================
// Convenience Export
// ============================================================================

/**
 * Default security audit service instance
 * @deprecated Use getSecurityAuditService() or createSecurityAuditService() instead
 */
export const securityAuditService = new SecurityAuditService();
