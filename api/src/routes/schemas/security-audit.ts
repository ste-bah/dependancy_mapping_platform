/**
 * Security Audit API Schemas
 * @module routes/schemas/security-audit
 *
 * TypeBox schemas for security audit API endpoints.
 * Provides request/response validation for security audit operations.
 *
 * TASK-SECURITY: Security audit route schemas
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// Audit Item Response Schema
// ============================================================================

/**
 * Individual audit item status
 */
export const AuditItemStatusSchema = Type.Union([
  Type.Literal('PASS'),
  Type.Literal('FAIL'),
  Type.Literal('PARTIAL'),
  Type.Literal('N/A'),
  Type.Literal('pending'),
  Type.Literal('WARNING'),
  Type.Literal('SKIP'),
  Type.Literal('ERROR'),
]);

/**
 * Individual audit item response
 */
export const AuditItemResponseSchema = Type.Object({
  id: Type.String({ description: 'Audit item identifier' }),
  item: Type.String({ description: 'Audit checklist item description' }),
  status: AuditItemStatusSchema,
  evidence: Type.Optional(Type.String({ description: 'Evidence or notes supporting the status' })),
  cweId: Type.Optional(Type.String({
    pattern: '^CWE-\\d+$',
    description: 'Related CWE identifier (e.g., CWE-79)',
  })),
  severity: Type.Optional(Type.Union([
    Type.Literal('critical'),
    Type.Literal('high'),
    Type.Literal('medium'),
    Type.Literal('low'),
    Type.Literal('info'),
  ], { description: 'Severity if this is a failure' })),
  remediation: Type.Optional(Type.String({ description: 'Remediation steps if applicable' })),
});

export type AuditItemResponse = Static<typeof AuditItemResponseSchema>;

// ============================================================================
// Audit Category Response Schema
// ============================================================================

/**
 * Audit category with items
 */
export const AuditCategoryResponseSchema = Type.Object({
  name: Type.String({ description: 'Category name (e.g., Authentication, Dependencies)' }),
  description: Type.Optional(Type.String({ description: 'Category description' })),
  passRate: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Percentage of items with PASS status',
  }),
  items: Type.Array(AuditItemResponseSchema),
  frameworks: Type.Optional(Type.Array(Type.Union([
    Type.Literal('OWASP'),
    Type.Literal('CWE'),
    Type.Literal('NIST'),
    Type.Literal('SOC2'),
    Type.Literal('PCI-DSS'),
    Type.Literal('HIPAA'),
    Type.Literal('GDPR'),
  ]), { description: 'Compliance frameworks this category relates to' })),
});

export type AuditCategoryResponse = Static<typeof AuditCategoryResponseSchema>;

// ============================================================================
// Audit Summary Schema
// ============================================================================

/**
 * Audit summary statistics
 */
export const AuditSummarySchema = Type.Object({
  totalChecks: Type.Number({ minimum: 0, description: 'Total number of checks performed' }),
  passedChecks: Type.Number({ minimum: 0, description: 'Number of passed checks' }),
  failedChecks: Type.Number({ minimum: 0, description: 'Number of failed checks' }),
  warnings: Type.Number({ minimum: 0, description: 'Number of warnings' }),
  skipped: Type.Number({ minimum: 0, description: 'Number of skipped checks' }),
  errors: Type.Number({ minimum: 0, description: 'Number of errors during checking' }),
});

export type AuditSummary = Static<typeof AuditSummarySchema>;

// ============================================================================
// Audit Report Response Schema
// ============================================================================

/**
 * Complete audit report response
 */
export const AuditReportResponseSchema = Type.Object({
  timestamp: Type.String({ format: 'date-time', description: 'When the report was generated' }),
  reportId: Type.Optional(Type.String({ description: 'Report version/identifier' })),
  overallScore: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Overall security score (0-100)',
  }),
  categories: Type.Array(AuditCategoryResponseSchema),
  criticalIssues: Type.Array(Type.String({ description: 'Critical issues that need immediate attention' })),
  recommendations: Type.Array(Type.String({ description: 'Recommendations for improvement' })),
  summary: Type.Optional(AuditSummarySchema),
});

export type AuditReportResponse = Static<typeof AuditReportResponseSchema>;

// ============================================================================
// Dependency Audit Response Schema
// ============================================================================

/**
 * Vulnerability counts by severity
 */
export const VulnerabilityCountsSchema = Type.Object({
  critical: Type.Number({ minimum: 0, description: 'Count of critical vulnerabilities' }),
  high: Type.Number({ minimum: 0, description: 'Count of high severity vulnerabilities' }),
  medium: Type.Number({ minimum: 0, description: 'Count of medium severity vulnerabilities' }),
  low: Type.Number({ minimum: 0, description: 'Count of low severity vulnerabilities' }),
  info: Type.Optional(Type.Number({ minimum: 0, description: 'Count of informational findings' })),
});

export type VulnerabilityCounts = Static<typeof VulnerabilityCountsSchema>;

/**
 * Individual vulnerability finding
 */
export const VulnerabilityFindingSchema = Type.Object({
  id: Type.String({ description: 'Vulnerability identifier' }),
  title: Type.String({ description: 'Vulnerability title' }),
  description: Type.Optional(Type.String({ description: 'Detailed description' })),
  severity: Type.Union([
    Type.Literal('critical'),
    Type.Literal('high'),
    Type.Literal('medium'),
    Type.Literal('low'),
    Type.Literal('info'),
  ]),
  cvssScore: Type.Optional(Type.Number({ minimum: 0, maximum: 10, description: 'CVSS score' })),
  cveId: Type.Optional(Type.String({ description: 'CVE identifier' })),
  cweId: Type.Optional(Type.String({ description: 'CWE identifier' })),
  packageName: Type.Optional(Type.String({ description: 'Affected package name' })),
  affectedVersions: Type.Optional(Type.String({ description: 'Affected version range' })),
  fixedIn: Type.Optional(Type.String({ description: 'Fixed in version' })),
  remediation: Type.Optional(Type.String({ description: 'Recommended remediation' })),
  references: Type.Optional(Type.Array(Type.String(), { description: 'Reference URLs' })),
});

export type VulnerabilityFinding = Static<typeof VulnerabilityFindingSchema>;

/**
 * Dependency audit response
 */
export const DependencyAuditResponseSchema = Type.Object({
  vulnerabilities: VulnerabilityCountsSchema,
  passed: Type.Boolean({ description: 'Whether the audit passed (no critical/high issues)' }),
  findings: Type.Optional(Type.Array(VulnerabilityFindingSchema)),
  totalDependencies: Type.Optional(Type.Number({ minimum: 0, description: 'Total dependencies scanned' })),
  vulnerableDependencies: Type.Optional(Type.Number({ minimum: 0, description: 'Dependencies with vulnerabilities' })),
  source: Type.Optional(Type.String({ description: 'Audit source (e.g., npm audit)' })),
  auditedAt: Type.String({ format: 'date-time', description: 'When the audit was performed' }),
});

export type DependencyAuditResponse = Static<typeof DependencyAuditResponseSchema>;

// ============================================================================
// Audit Trigger Response Schema
// ============================================================================

/**
 * Response when triggering a new audit
 */
export const AuditTriggerResponseSchema = Type.Object({
  message: Type.String({ description: 'Status message' }),
  auditId: Type.String({ description: 'Identifier for the triggered audit' }),
});

export type AuditTriggerResponse = Static<typeof AuditTriggerResponseSchema>;

// ============================================================================
// Compliance Check Schemas
// ============================================================================

/**
 * Compliance status for a framework
 */
export const ComplianceStatusResponseSchema = Type.Object({
  framework: Type.Union([
    Type.Literal('OWASP'),
    Type.Literal('CWE'),
    Type.Literal('NIST'),
    Type.Literal('SOC2'),
    Type.Literal('PCI-DSS'),
    Type.Literal('HIPAA'),
    Type.Literal('GDPR'),
  ], { description: 'Compliance framework' }),
  compliant: Type.Boolean({ description: 'Overall compliance status' }),
  percentage: Type.Number({ minimum: 0, maximum: 100, description: 'Compliance percentage' }),
  failedControls: Type.Array(Type.String(), { description: 'Failed controls' }),
  passedControls: Type.Array(Type.String(), { description: 'Passed controls' }),
});

export type ComplianceStatusResponse = Static<typeof ComplianceStatusResponseSchema>;

/**
 * Compliance check request
 */
export const ComplianceCheckRequestSchema = Type.Object({
  frameworks: Type.Array(Type.Union([
    Type.Literal('OWASP'),
    Type.Literal('CWE'),
    Type.Literal('NIST'),
    Type.Literal('SOC2'),
    Type.Literal('PCI-DSS'),
    Type.Literal('HIPAA'),
    Type.Literal('GDPR'),
  ]), { minItems: 1, description: 'Frameworks to check compliance against' }),
});

export type ComplianceCheckRequest = Static<typeof ComplianceCheckRequestSchema>;

/**
 * Compliance check response
 */
export const ComplianceCheckResponseSchema = Type.Object({
  results: Type.Array(ComplianceStatusResponseSchema),
  checkedAt: Type.String({ format: 'date-time', description: 'When the check was performed' }),
});

export type ComplianceCheckResponse = Static<typeof ComplianceCheckResponseSchema>;
