/**
 * Security Audit Type Definitions
 * @module types/security-audit
 *
 * TypeBox schemas and TypeScript types for security audit preparation.
 * Includes STRIDE threat modeling, audit checklists, pentest scopes,
 * SBOM (CycloneDX 1.5), and security test results.
 *
 * Supports OWASP compliance checks, dependency audits, SBOM generation,
 * and security test result tracking.
 *
 * Follows established TypeBox patterns from auth.ts, entities.ts, and api.ts.
 *
 * TASK-SECURITY: Security audit type definitions
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// STRIDE Threat Model Types
// ============================================================================

/**
 * STRIDE threat categories
 */
export const ThreatCategory = {
  SPOOFING: 'Spoofing',
  TAMPERING: 'Tampering',
  REPUDIATION: 'Repudiation',
  INFORMATION_DISCLOSURE: 'Information Disclosure',
  DENIAL_OF_SERVICE: 'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege',
} as const;

export type ThreatCategory = typeof ThreatCategory[keyof typeof ThreatCategory];

/**
 * Threat category TypeBox schema
 */
export const ThreatCategorySchema = Type.Union([
  Type.Literal('Spoofing'),
  Type.Literal('Tampering'),
  Type.Literal('Repudiation'),
  Type.Literal('Information Disclosure'),
  Type.Literal('Denial of Service'),
  Type.Literal('Elevation of Privilege'),
]);

/**
 * Likelihood levels for threats
 */
export const ThreatLikelihood = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
} as const;

export type ThreatLikelihood = typeof ThreatLikelihood[keyof typeof ThreatLikelihood];

/**
 * Threat likelihood TypeBox schema
 */
export const ThreatLikelihoodSchema = Type.Union([
  Type.Literal('Low'),
  Type.Literal('Medium'),
  Type.Literal('High'),
]);

/**
 * Impact levels for threats
 */
export const ThreatImpact = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
} as const;

export type ThreatImpact = typeof ThreatImpact[keyof typeof ThreatImpact];

/**
 * Threat impact TypeBox schema
 */
export const ThreatImpactSchema = Type.Union([
  Type.Literal('Low'),
  Type.Literal('Medium'),
  Type.Literal('High'),
  Type.Literal('Critical'),
]);

/**
 * Mitigation status for threats
 */
export const ThreatStatus = {
  IMPLEMENTED: 'Implemented',
  IN_PROGRESS: 'In Progress',
  PLANNED: 'Planned',
  ACCEPTED_RISK: 'Accepted Risk',
} as const;

export type ThreatStatus = typeof ThreatStatus[keyof typeof ThreatStatus];

/**
 * Threat status TypeBox schema
 */
export const ThreatStatusSchema = Type.Union([
  Type.Literal('Implemented'),
  Type.Literal('In Progress'),
  Type.Literal('Planned'),
  Type.Literal('Accepted Risk'),
]);

/**
 * STRIDE threat TypeBox schema
 * ID format: STRIDE category prefix followed by 3 digits (e.g., S-001, T-002)
 */
export const ThreatSchema = Type.Object({
  id: Type.String({
    pattern: '^[STRIDE]-\\d{3}$',
    description: 'Threat ID in format: S-001, T-002, R-003, I-004, D-005, E-006',
  }),
  category: ThreatCategorySchema,
  title: Type.String({ description: 'Brief title of the threat' }),
  description: Type.String({ description: 'Detailed description of the threat vector' }),
  likelihood: ThreatLikelihoodSchema,
  impact: ThreatImpactSchema,
  mitigation: Type.String({ description: 'Mitigation strategy or control' }),
  status: ThreatStatusSchema,
});

export type Threat = Static<typeof ThreatSchema>;

/**
 * Threat model summary TypeBox schema
 */
export const ThreatModelSummarySchema = Type.Object({
  totalThreats: Type.Number({ minimum: 0 }),
  byCategory: Type.Record(Type.String(), Type.Number()),
  byStatus: Type.Record(Type.String(), Type.Number()),
  highRiskCount: Type.Number({ minimum: 0, description: 'Threats with High/Critical impact' }),
  mitigatedCount: Type.Number({ minimum: 0 }),
  lastUpdated: Type.String({ format: 'date-time' }),
});

export type ThreatModelSummary = Static<typeof ThreatModelSummarySchema>;

/**
 * Complete threat model TypeBox schema
 */
export const ThreatModelSchema = Type.Object({
  version: Type.String({ description: 'Threat model version' }),
  projectName: Type.String(),
  lastReviewDate: Type.String({ format: 'date-time' }),
  reviewers: Type.Array(Type.String()),
  threats: Type.Array(ThreatSchema),
  summary: ThreatModelSummarySchema,
});

export type ThreatModel = Static<typeof ThreatModelSchema>;

// ============================================================================
// Audit Status Types
// ============================================================================

/**
 * Status of an audit check item (legacy type for backward compatibility)
 */
export type AuditStatus = 'PASS' | 'FAIL' | 'WARNING' | 'SKIP' | 'ERROR';

/**
 * Severity level for audit findings
 */
export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Compliance framework identifiers
 */
export type ComplianceFramework = 'OWASP' | 'CWE' | 'NIST' | 'SOC2' | 'PCI-DSS' | 'HIPAA' | 'GDPR';

/**
 * Audit item status for TypeBox schemas
 */
export const AuditItemStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PARTIAL: 'PARTIAL',
  NA: 'N/A',
  PENDING: 'pending',
} as const;

export type AuditItemStatus = typeof AuditItemStatus[keyof typeof AuditItemStatus];

/**
 * Audit item status TypeBox schema
 */
export const AuditItemStatusSchema = Type.Union([
  Type.Literal('PASS'),
  Type.Literal('FAIL'),
  Type.Literal('PARTIAL'),
  Type.Literal('N/A'),
  Type.Literal('pending'),
]);

// ============================================================================
// Audit Item Types (TypeBox Schemas)
// ============================================================================

/**
 * Audit item TypeBox schema
 */
export const AuditItemSchema = Type.Object({
  id: Type.String({ description: 'Unique item identifier' }),
  item: Type.String({ description: 'Audit checklist item description' }),
  status: AuditItemStatusSchema,
  evidence: Type.Optional(Type.String({ description: 'Evidence or notes supporting the status' })),
  cweId: Type.Optional(Type.String({
    pattern: '^CWE-\\d+$',
    description: 'Related CWE identifier (e.g., CWE-79)',
  })),
});

export type AuditItemTyped = Static<typeof AuditItemSchema>;

/**
 * Audit category TypeBox schema
 */
export const AuditCategorySchema = Type.Object({
  name: Type.String({ description: 'Category name (e.g., Authentication, Input Validation)' }),
  items: Type.Array(AuditItemSchema),
  passRate: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Percentage of items with PASS status',
  }),
});

export type AuditCategoryTyped = Static<typeof AuditCategorySchema>;

/**
 * Complete audit checklist TypeBox schema
 */
export const AuditChecklistSchema = Type.Object({
  version: Type.String(),
  auditDate: Type.String({ format: 'date-time' }),
  auditor: Type.Optional(Type.String()),
  categories: Type.Array(AuditCategorySchema),
  overallPassRate: Type.Number({ minimum: 0, maximum: 100 }),
  criticalFindings: Type.Number({ minimum: 0, description: 'Count of critical FAIL items' }),
});

export type AuditChecklist = Static<typeof AuditChecklistSchema>;

// ============================================================================
// Audit Item Types (Legacy Interface for backward compatibility)
// ============================================================================

/**
 * Individual audit check item (legacy interface)
 */
export interface AuditItem {
  /** Unique identifier for this audit item (e.g., AUTH-RLS-001) */
  readonly id: string;
  /** Description of what is being checked */
  readonly item: string;
  /** Current status of this check */
  readonly status: AuditStatus;
  /** Evidence supporting the status (file paths, command output, etc.) */
  readonly evidence?: string;
  /** CWE identifier if applicable */
  readonly cweId?: string;
  /** OWASP category if applicable */
  readonly owaspCategory?: string;
  /** Severity if this is a failure */
  readonly severity?: AuditSeverity;
  /** Remediation steps if applicable */
  readonly remediation?: string;
  /** Timestamp when this check was performed */
  readonly checkedAt?: string;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Category of audit checks (legacy interface)
 */
export interface AuditCategory {
  /** Category name (e.g., Authentication, Dependencies, Data Protection) */
  readonly name: string;
  /** Audit items within this category */
  readonly items: AuditItem[];
  /** Pass rate as percentage (0-100) */
  readonly passRate: number;
  /** Optional description of the category */
  readonly description?: string;
  /** Compliance frameworks this category relates to */
  readonly frameworks?: ComplianceFramework[];
}

// ============================================================================
// Pentest Scope Types
// ============================================================================

/**
 * Pentest target types
 */
export const PentestTargetType = {
  API: 'api',
  AUTH: 'auth',
  ISOLATION: 'isolation',
  ADAPTER: 'adapter',
  ENGINE: 'engine',
} as const;

export type PentestTargetType = typeof PentestTargetType[keyof typeof PentestTargetType];

/**
 * Pentest target type TypeBox schema
 */
export const PentestTargetTypeSchema = Type.Union([
  Type.Literal('api'),
  Type.Literal('auth'),
  Type.Literal('isolation'),
  Type.Literal('adapter'),
  Type.Literal('engine'),
]);

/**
 * Pentest target TypeBox schema
 */
export const PentestTargetSchema = Type.Object({
  name: Type.String({ description: 'Target component name' }),
  type: PentestTargetTypeSchema,
  endpoints: Type.Array(Type.String({ description: 'API endpoints or entry points' })),
  testTypes: Type.Array(Type.String({ description: 'Types of tests to perform' })),
});

export type PentestTarget = Static<typeof PentestTargetSchema>;

/**
 * Pentest methodology
 */
export const PentestMethodology = {
  OWASP: 'OWASP',
  PTES: 'PTES',
  OSSTMM: 'OSSTMM',
  NIST: 'NIST',
} as const;

export type PentestMethodology = typeof PentestMethodology[keyof typeof PentestMethodology];

/**
 * Pentest methodology TypeBox schema
 */
export const PentestMethodologySchema = Type.Union([
  Type.Literal('OWASP'),
  Type.Literal('PTES'),
  Type.Literal('OSSTMM'),
  Type.Literal('NIST'),
]);

/**
 * Pentest scope document TypeBox schema
 */
export const PentestScopeSchema = Type.Object({
  projectName: Type.String(),
  scopeVersion: Type.String(),
  validFrom: Type.String({ format: 'date-time' }),
  validUntil: Type.String({ format: 'date-time' }),
  methodology: Type.Array(PentestMethodologySchema),
  targets: Type.Array(PentestTargetSchema),
  exclusions: Type.Optional(Type.Array(Type.String({ description: 'Out-of-scope items' }))),
  rules: Type.Optional(Type.Object({
    allowedHours: Type.Optional(Type.String({ description: 'Testing window' })),
    maxConcurrentTests: Type.Optional(Type.Number({ minimum: 1 })),
    escalationContact: Type.Optional(Type.String()),
    dataHandling: Type.Optional(Type.String({ description: 'Rules for handling sensitive data' })),
  })),
});

export type PentestScope = Static<typeof PentestScopeSchema>;

// ============================================================================
// Vulnerability Types
// ============================================================================

/**
 * Vulnerability severity levels
 */
export const VulnerabilitySeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type VulnerabilitySeverity = typeof VulnerabilitySeverity[keyof typeof VulnerabilitySeverity];

/**
 * Vulnerability severity TypeBox schema
 */
export const VulnerabilitySeveritySchema = Type.Union([
  Type.Literal('critical'),
  Type.Literal('high'),
  Type.Literal('medium'),
  Type.Literal('low'),
]);

/**
 * Vulnerability counts by severity
 */
export interface VulnerabilityCounts {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly info?: number;
}

/**
 * Individual vulnerability finding
 */
export interface Vulnerability {
  /** Unique vulnerability ID (e.g., CVE-2023-12345) */
  readonly id: string;
  /** Vulnerability title/name */
  readonly title: string;
  /** Detailed description */
  readonly description?: string;
  /** Severity level */
  readonly severity: AuditSeverity;
  /** CVSS score if available */
  readonly cvssScore?: number;
  /** CVE identifier */
  readonly cveId?: string;
  /** CWE identifier */
  readonly cweId?: string;
  /** Affected package name */
  readonly packageName?: string;
  /** Affected version range */
  readonly affectedVersions?: string;
  /** Fixed in version */
  readonly fixedIn?: string;
  /** File paths where vulnerability was found */
  readonly paths?: string[];
  /** Recommended remediation */
  readonly remediation?: string;
  /** References/links for more information */
  readonly references?: string[];
  /** When the vulnerability was published */
  readonly publishedAt?: string;
}

/**
 * Dependency audit result
 */
export interface DependencyAuditResult {
  /** Vulnerability counts by severity */
  readonly vulnerabilities: VulnerabilityCounts;
  /** Whether the audit passed (no critical/high issues) */
  readonly passed: boolean;
  /** Detailed vulnerability findings */
  readonly findings?: Vulnerability[];
  /** Total number of dependencies scanned */
  readonly totalDependencies?: number;
  /** Number of dependencies with vulnerabilities */
  readonly vulnerableDependencies?: number;
  /** Audit source (e.g., 'npm audit', 'snyk', 'trivy') */
  readonly source?: string;
  /** When the audit was performed */
  readonly auditedAt: string;
}

// ============================================================================
// SBOM Types (CycloneDX 1.5 TypeBox Schemas)
// ============================================================================

/**
 * SBOM component types
 */
export const SBOMComponentType = {
  LIBRARY: 'library',
  FRAMEWORK: 'framework',
  APPLICATION: 'application',
} as const;

export type SBOMComponentType = typeof SBOMComponentType[keyof typeof SBOMComponentType];

/**
 * SBOM component type TypeBox schema
 */
export const SBOMComponentTypeSchema = Type.Union([
  Type.Literal('library'),
  Type.Literal('framework'),
  Type.Literal('application'),
]);

/**
 * SBOM vulnerability TypeBox schema
 */
export const SBOMVulnerabilitySchema = Type.Object({
  id: Type.String({ description: 'CVE or vulnerability ID' }),
  severity: VulnerabilitySeveritySchema,
});

export type SBOMVulnerability = Static<typeof SBOMVulnerabilitySchema>;

/**
 * SBOM license TypeBox schema
 */
export const SBOMLicenseSchema = Type.Object({
  license: Type.Object({
    id: Type.Optional(Type.String({ description: 'SPDX license identifier' })),
    name: Type.Optional(Type.String({ description: 'License name' })),
  }),
});

export type SBOMLicense = Static<typeof SBOMLicenseSchema>;

/**
 * SBOM component TypeBox schema (CycloneDX 1.5)
 */
export const SBOMComponentSchema = Type.Object({
  type: SBOMComponentTypeSchema,
  name: Type.String({ description: 'Component name' }),
  version: Type.String({ description: 'Component version' }),
  purl: Type.Optional(Type.String({ description: 'Package URL (purl)' })),
  licenses: Type.Optional(Type.Array(SBOMLicenseSchema)),
  vulnerabilities: Type.Optional(Type.Array(SBOMVulnerabilitySchema)),
});

export type SBOMComponentTyped = Static<typeof SBOMComponentSchema>;

/**
 * SBOM tool information TypeBox schema
 */
export const SBOMToolSchema = Type.Object({
  vendor: Type.String(),
  name: Type.String(),
  version: Type.String(),
});

export type SBOMTool = Static<typeof SBOMToolSchema>;

/**
 * SBOM metadata TypeBox schema (CycloneDX 1.5)
 */
export const SBOMMetadataSchema = Type.Object({
  timestamp: Type.String({ format: 'date-time' }),
  tools: Type.Array(SBOMToolSchema),
});

export type SBOMMetadataTyped = Static<typeof SBOMMetadataSchema>;

/**
 * Complete SBOM (CycloneDX 1.5) TypeBox schema
 */
export const SBOMSchema = Type.Object({
  bomFormat: Type.Literal('CycloneDX'),
  specVersion: Type.String({ description: 'CycloneDX spec version (e.g., 1.5)' }),
  serialNumber: Type.String({ description: 'Unique SBOM identifier' }),
  version: Type.Number({ minimum: 1, description: 'BOM version number' }),
  metadata: SBOMMetadataSchema,
  components: Type.Array(SBOMComponentSchema),
});

export type SBOMTyped = Static<typeof SBOMSchema>;

/**
 * SBOM summary TypeBox schema
 */
export const SBOMSummarySchema = Type.Object({
  totalComponents: Type.Number({ minimum: 0 }),
  byType: Type.Record(Type.String(), Type.Number()),
  vulnerabilityCounts: Type.Object({
    critical: Type.Number({ minimum: 0 }),
    high: Type.Number({ minimum: 0 }),
    medium: Type.Number({ minimum: 0 }),
    low: Type.Number({ minimum: 0 }),
  }),
  licenseCounts: Type.Record(Type.String(), Type.Number()),
  generatedAt: Type.String({ format: 'date-time' }),
});

export type SBOMSummary = Static<typeof SBOMSummarySchema>;

// ============================================================================
// SBOM Types (Legacy Interfaces for backward compatibility)
// ============================================================================

/**
 * SBOM component/dependency entry (legacy interface)
 */
export interface SBOMComponent {
  /** Component name */
  readonly name: string;
  /** Component version */
  readonly version: string;
  /** Package URL (purl) */
  readonly purl?: string;
  /** Component type (e.g., npm, pypi, maven) */
  readonly type: string;
  /** License information */
  readonly license?: string | string[];
  /** Component author/supplier */
  readonly author?: string;
  /** Whether this is a direct or transitive dependency */
  readonly scope?: 'required' | 'optional' | 'dev';
  /** Hash values for verification */
  readonly hashes?: Array<{
    readonly alg: string;
    readonly content: string;
  }>;
  /** External references */
  readonly externalReferences?: Array<{
    readonly type: string;
    readonly url: string;
  }>;
}

/**
 * SBOM metadata (legacy interface)
 */
export interface SBOMMetadata {
  /** SBOM format (e.g., CycloneDX, SPDX) */
  readonly format: 'CycloneDX' | 'SPDX';
  /** SBOM format version */
  readonly specVersion: string;
  /** Tool(s) used to generate the SBOM */
  readonly tools?: Array<{
    readonly name: string;
    readonly version: string;
  }>;
  /** When the SBOM was generated */
  readonly timestamp: string;
  /** Serial number/UUID for this SBOM */
  readonly serialNumber?: string;
}

/**
 * Software Bill of Materials (legacy interface)
 */
export interface SBOM {
  /** SBOM metadata */
  readonly metadata: SBOMMetadata;
  /** Components/dependencies in the SBOM */
  readonly components: SBOMComponent[];
  /** Dependencies/relationships between components */
  readonly dependencies?: Array<{
    readonly ref: string;
    readonly dependsOn: string[];
  }>;
}

// ============================================================================
// Security Test Types (TypeBox Schemas)
// ============================================================================

/**
 * Security test result TypeBox schema
 */
export const SecurityTestResultSchema = Type.Object({
  testId: Type.String({ description: 'Unique test identifier' }),
  name: Type.String({ description: 'Test name' }),
  category: Type.String({ description: 'Test category (e.g., Authentication, Authorization)' }),
  passed: Type.Boolean(),
  duration: Type.Number({ minimum: 0, description: 'Test duration in milliseconds' }),
  cweId: Type.Optional(Type.String({
    pattern: '^CWE-\\d+$',
    description: 'Related CWE identifier',
  })),
  error: Type.Optional(Type.String({ description: 'Error message if test failed' })),
});

export type SecurityTestResultTyped = Static<typeof SecurityTestResultSchema>;

/**
 * Security test suite result TypeBox schema
 */
export const SecurityTestSuiteResultSchema = Type.Object({
  suiteId: Type.String(),
  suiteName: Type.String(),
  executedAt: Type.String({ format: 'date-time' }),
  duration: Type.Number({ minimum: 0, description: 'Total suite duration in milliseconds' }),
  results: Type.Array(SecurityTestResultSchema),
  summary: Type.Object({
    total: Type.Number({ minimum: 0 }),
    passed: Type.Number({ minimum: 0 }),
    failed: Type.Number({ minimum: 0 }),
    skipped: Type.Number({ minimum: 0 }),
    passRate: Type.Number({ minimum: 0, maximum: 100 }),
  }),
});

export type SecurityTestSuiteResult = Static<typeof SecurityTestSuiteResultSchema>;

/**
 * Security test run TypeBox schema
 */
export const SecurityTestRunSchema = Type.Object({
  runId: Type.String({ format: 'uuid' }),
  projectName: Type.String(),
  environment: Type.Union([
    Type.Literal('development'),
    Type.Literal('staging'),
    Type.Literal('production'),
  ]),
  triggeredBy: Type.String(),
  startedAt: Type.String({ format: 'date-time' }),
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  status: Type.Union([
    Type.Literal('running'),
    Type.Literal('completed'),
    Type.Literal('failed'),
    Type.Literal('cancelled'),
  ]),
  suites: Type.Array(SecurityTestSuiteResultSchema),
  overallSummary: Type.Object({
    totalTests: Type.Number({ minimum: 0 }),
    totalPassed: Type.Number({ minimum: 0 }),
    totalFailed: Type.Number({ minimum: 0 }),
    totalSkipped: Type.Number({ minimum: 0 }),
    overallPassRate: Type.Number({ minimum: 0, maximum: 100 }),
    criticalFailures: Type.Number({ minimum: 0 }),
  }),
});

export type SecurityTestRun = Static<typeof SecurityTestRunSchema>;

// ============================================================================
// Security Test Types (Legacy Interfaces for backward compatibility)
// ============================================================================

/**
 * Security test result (legacy interface)
 */
export interface SecurityTestResult {
  /** Test identifier */
  readonly testId: string;
  /** Test name/description */
  readonly testName: string;
  /** Test category (e.g., SAST, DAST, SCA) */
  readonly category: 'SAST' | 'DAST' | 'SCA' | 'secrets' | 'container' | 'iac' | 'other';
  /** Test status */
  readonly status: AuditStatus;
  /** Findings from the test */
  readonly findings: SecurityFinding[];
  /** Test execution time in milliseconds */
  readonly executionTimeMs?: number;
  /** Tool used for testing */
  readonly tool?: string;
  /** When the test was run */
  readonly executedAt: string;
}

/**
 * Individual security finding from a test
 */
export interface SecurityFinding {
  /** Finding identifier */
  readonly id: string;
  /** Finding title */
  readonly title: string;
  /** Detailed description */
  readonly description?: string;
  /** Severity level */
  readonly severity: AuditSeverity;
  /** File path where finding was detected */
  readonly filePath?: string;
  /** Line number in file */
  readonly lineNumber?: number;
  /** Column number in file */
  readonly columnNumber?: number;
  /** Code snippet if available */
  readonly codeSnippet?: string;
  /** CWE identifier */
  readonly cweId?: string;
  /** Recommended fix */
  readonly remediation?: string;
  /** Whether this is a false positive */
  readonly falsePositive?: boolean;
  /** Additional context */
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Audit Report Types
// ============================================================================

/**
 * Complete security audit report
 */
export interface AuditReport {
  /** When the report was generated */
  readonly timestamp: string;
  /** Report version/identifier */
  readonly reportId?: string;
  /** Audit categories with their results */
  readonly categories: AuditCategory[];
  /** Overall security score (0-100) */
  readonly overallScore: number;
  /** Critical issues that need immediate attention */
  readonly criticalIssues: string[];
  /** Recommendations for improvement */
  readonly recommendations: string[];
  /** Summary statistics */
  readonly summary?: AuditSummary;
  /** Compliance status by framework */
  readonly compliance?: ComplianceStatus[];
}

/**
 * Summary statistics for an audit
 */
export interface AuditSummary {
  /** Total number of checks performed */
  readonly totalChecks: number;
  /** Number of passed checks */
  readonly passedChecks: number;
  /** Number of failed checks */
  readonly failedChecks: number;
  /** Number of warnings */
  readonly warnings: number;
  /** Number of skipped checks */
  readonly skipped: number;
  /** Number of errors during checking */
  readonly errors: number;
}

/**
 * Compliance status for a specific framework
 */
export interface ComplianceStatus {
  /** Compliance framework */
  readonly framework: ComplianceFramework;
  /** Overall compliance status */
  readonly compliant: boolean;
  /** Compliance percentage */
  readonly percentage: number;
  /** Failed controls */
  readonly failedControls: string[];
  /** Passed controls */
  readonly passedControls: string[];
}

// ============================================================================
// Service Configuration Types
// ============================================================================

/**
 * Configuration for the security audit service
 */
export interface SecurityAuditConfig {
  /** Whether to run npm audit */
  readonly runNpmAudit: boolean;
  /** Whether to generate SBOM */
  readonly generateSbom: boolean;
  /** Whether to check RLS policies */
  readonly checkRlsPolicies: boolean;
  /** Whether to run security tests */
  readonly runSecurityTests: boolean;
  /** Minimum passing score (0-100) */
  readonly minPassingScore: number;
  /** Maximum allowed critical vulnerabilities */
  readonly maxCriticalVulns: number;
  /** Maximum allowed high vulnerabilities */
  readonly maxHighVulns: number;
  /** Working directory for commands */
  readonly workingDirectory?: string;
  /** Timeout for commands in milliseconds */
  readonly commandTimeoutMs: number;
  /** Custom SBOM path */
  readonly sbomPath?: string;
  /** Custom RLS migration path */
  readonly rlsMigrationPath?: string;
}

/**
 * Default security audit configuration
 */
export const DEFAULT_SECURITY_AUDIT_CONFIG: SecurityAuditConfig = {
  runNpmAudit: true,
  generateSbom: true,
  checkRlsPolicies: true,
  runSecurityTests: false,
  minPassingScore: 70,
  maxCriticalVulns: 0,
  maxHighVulns: 0,
  commandTimeoutMs: 30000,
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Security audit error codes
 */
export type SecurityAuditErrorCode =
  | 'AUDIT_COMMAND_FAILED'
  | 'SBOM_GENERATION_FAILED'
  | 'SBOM_PARSE_FAILED'
  | 'RLS_CHECK_FAILED'
  | 'SECURITY_TEST_FAILED'
  | 'TIMEOUT_ERROR'
  | 'INVALID_CONFIG'
  | 'FILE_NOT_FOUND'
  | 'INTERNAL_ERROR';

/**
 * Security audit error
 */
export class SecurityAuditError extends Error {
  constructor(
    message: string,
    public readonly code: SecurityAuditErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityAuditError';
  }
}

// ============================================================================
// Security Audit Report Types (TypeBox)
// ============================================================================

/**
 * Complete security audit report TypeBox schema
 */
export const SecurityAuditReportSchema = Type.Object({
  reportId: Type.String({ format: 'uuid' }),
  projectName: Type.String(),
  generatedAt: Type.String({ format: 'date-time' }),
  version: Type.String(),
  threatModel: Type.Optional(ThreatModelSchema),
  auditChecklist: Type.Optional(AuditChecklistSchema),
  pentestScope: Type.Optional(PentestScopeSchema),
  sbom: Type.Optional(SBOMSchema),
  testResults: Type.Optional(SecurityTestRunSchema),
  overallRiskRating: Type.Union([
    Type.Literal('Low'),
    Type.Literal('Medium'),
    Type.Literal('High'),
    Type.Literal('Critical'),
  ]),
  recommendations: Type.Array(Type.Object({
    priority: Type.Union([
      Type.Literal('Critical'),
      Type.Literal('High'),
      Type.Literal('Medium'),
      Type.Literal('Low'),
    ]),
    title: Type.String(),
    description: Type.String(),
    affectedComponent: Type.Optional(Type.String()),
    cweIds: Type.Optional(Type.Array(Type.String({ pattern: '^CWE-\\d+$' }))),
  })),
});

export type SecurityAuditReportTyped = Static<typeof SecurityAuditReportSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for Threat
 */
export function isThreat(value: unknown): value is Threat {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'category' in value &&
    'title' in value &&
    'likelihood' in value &&
    'impact' in value &&
    'status' in value
  );
}

/**
 * Type guard for AuditItemTyped
 */
export function isAuditItemTyped(value: unknown): value is AuditItemTyped {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'item' in value &&
    'status' in value
  );
}

/**
 * Type guard for PentestTarget
 */
export function isPentestTarget(value: unknown): value is PentestTarget {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'type' in value &&
    'endpoints' in value &&
    'testTypes' in value
  );
}

/**
 * Type guard for SBOMComponentTyped
 */
export function isSBOMComponentTyped(value: unknown): value is SBOMComponentTyped {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'name' in value &&
    'version' in value
  );
}

/**
 * Type guard for SBOMTyped
 */
export function isSBOMTyped(value: unknown): value is SBOMTyped {
  return (
    typeof value === 'object' &&
    value !== null &&
    'bomFormat' in value &&
    (value as Record<string, unknown>).bomFormat === 'CycloneDX' &&
    'specVersion' in value &&
    'components' in value
  );
}

/**
 * Type guard for SecurityTestResultTyped
 */
export function isSecurityTestResultTyped(value: unknown): value is SecurityTestResultTyped {
  return (
    typeof value === 'object' &&
    value !== null &&
    'testId' in value &&
    'name' in value &&
    'category' in value &&
    'passed' in value &&
    typeof (value as Record<string, unknown>).passed === 'boolean'
  );
}

/**
 * Type guard for ThreatCategory
 */
export function isThreatCategory(value: unknown): value is ThreatCategory {
  return (
    typeof value === 'string' &&
    Object.values(ThreatCategory).includes(value as ThreatCategory)
  );
}

/**
 * Type guard for AuditItemStatus
 */
export function isAuditItemStatus(value: unknown): value is AuditItemStatus {
  return (
    typeof value === 'string' &&
    Object.values(AuditItemStatus).includes(value as AuditItemStatus)
  );
}

/**
 * Type guard for VulnerabilitySeverity
 */
export function isVulnerabilitySeverity(value: unknown): value is VulnerabilitySeverity {
  return (
    typeof value === 'string' &&
    Object.values(VulnerabilitySeverity).includes(value as VulnerabilitySeverity)
  );
}

/**
 * Type guard for CWE ID format
 */
export function isCweId(value: unknown): value is string {
  return typeof value === 'string' && /^CWE-\d+$/.test(value);
}

/**
 * Type guard for STRIDE ID format
 */
export function isStrideId(value: unknown): value is string {
  return typeof value === 'string' && /^[STRIDE]-\d{3}$/.test(value);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty threat model summary
 */
export function createEmptyThreatModelSummary(): ThreatModelSummary {
  return {
    totalThreats: 0,
    byCategory: {},
    byStatus: {},
    highRiskCount: 0,
    mitigatedCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create an empty SBOM summary
 */
export function createEmptySBOMSummary(): SBOMSummary {
  return {
    totalComponents: 0,
    byType: {},
    vulnerabilityCounts: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    licenseCounts: {},
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create an empty security test suite summary
 */
export function createEmptyTestSuiteSummary(): SecurityTestSuiteResult['summary'] {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    passRate: 0,
  };
}

/**
 * Calculate risk score from threat likelihood and impact
 */
export function calculateThreatRiskScore(
  likelihood: ThreatLikelihood,
  impact: ThreatImpact
): number {
  const likelihoodScores: Record<ThreatLikelihood, number> = {
    Low: 1,
    Medium: 2,
    High: 3,
  };

  const impactScores: Record<ThreatImpact, number> = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4,
  };

  return likelihoodScores[likelihood] * impactScores[impact];
}

/**
 * Get risk level from risk score
 */
export function getRiskLevel(
  riskScore: number
): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (riskScore >= 9) return 'Critical';
  if (riskScore >= 6) return 'High';
  if (riskScore >= 3) return 'Medium';
  return 'Low';
}

/**
 * Calculate audit pass rate from items
 */
export function calculateAuditPassRate(items: AuditItemTyped[]): number {
  if (items.length === 0) return 0;

  const applicableItems = items.filter((item) => item.status !== 'N/A');
  if (applicableItems.length === 0) return 100;

  const passedItems = applicableItems.filter((item) => item.status === 'PASS');
  return Math.round((passedItems.length / applicableItems.length) * 100);
}

/**
 * Summarize SBOM vulnerabilities
 */
export function summarizeSBOMVulnerabilities(
  components: SBOMComponentTyped[]
): SBOMSummary['vulnerabilityCounts'] {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const component of components) {
    if (component.vulnerabilities) {
      for (const vuln of component.vulnerabilities) {
        counts[vuln.severity]++;
      }
    }
  }

  return counts;
}
