#!/usr/bin/env tsx
/**
 * Dependency Analysis Script for E2E Testing Module
 * @module e2e/scripts/analyze-dependencies
 *
 * Analyzes dependencies for security vulnerabilities, outdated packages,
 * unused dependencies, and license compliance.
 *
 * Usage:
 *   npx tsx scripts/analyze-dependencies.ts [--json] [--fix]
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface DependencyNode {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  dependencies: string[];
  dependents: string[];
  size?: number;
  license?: string;
}

interface OutdatedDependency {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: string;
}

interface Vulnerability {
  name: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  via: string[];
  range: string;
  fixAvailable: boolean;
}

interface LicenseInfo {
  package: string;
  license: string;
  allowed: boolean;
  reason?: string;
}

interface ComplianceCheck {
  rule: string;
  passed: boolean;
  details: string;
}

interface SecuritySummary {
  totalDependencies: number;
  directDependencies: number;
  vulnerabilitiesCount: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  licenseIssues: number;
  outdatedPackages: number;
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  cycles: string[][];
  unused: string[];
  outdated: OutdatedDependency[];
  vulnerabilities: Vulnerability[];
}

interface SecurityReport {
  timestamp: string;
  summary: SecuritySummary;
  vulnerabilities: Vulnerability[];
  licenses: LicenseInfo[];
  recommendations: string[];
  compliance: ComplianceCheck[];
  graph?: DependencyGraph;
}

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'WTFPL',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'Zlib',
  'BlueOak-1.0.0',
];

const BANNED_PACKAGES = [
  'event-stream', // Known supply chain attack
  'flatmap-stream', // Malicious package
  'ua-parser-js', // Known malicious versions
  'coa', // Known hijacked versions
  'rc', // Known hijacked versions
];

const E2E_ROOT = join(__dirname, '..');

// ============================================================================
// Utility Functions
// ============================================================================

function runCommand(cmd: string): string | null {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      cwd: E2E_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      return (error as { stdout: string }).stdout || null;
    }
    return null;
  }
}

function readPackageJson(): Record<string, unknown> {
  const packagePath = join(E2E_ROOT, 'package.json');
  if (!existsSync(packagePath)) {
    throw new Error(`package.json not found at ${packagePath}`);
  }
  return JSON.parse(readFileSync(packagePath, 'utf-8')) as Record<string, unknown>;
}

// ============================================================================
// Analysis Functions
// ============================================================================

function detectCircularDependencies(nodes: Map<string, DependencyNode>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeName: string): void {
    visited.add(nodeName);
    recursionStack.add(nodeName);
    path.push(nodeName);

    const node = nodes.get(nodeName);
    if (node) {
      for (const dep of node.dependencies) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          const cycleStart = path.indexOf(dep);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }
    }

    path.pop();
    recursionStack.delete(nodeName);
  }

  for (const nodeName of nodes.keys()) {
    if (!visited.has(nodeName)) {
      dfs(nodeName);
    }
  }

  return cycles;
}

async function findUnusedDependencies(): Promise<string[]> {
  const output = runCommand('npx depcheck --json 2>/dev/null');
  if (!output) {
    return [];
  }

  try {
    const result = JSON.parse(output) as {
      dependencies: string[];
      devDependencies: string[];
    };
    return [...(result.dependencies || []), ...(result.devDependencies || [])];
  } catch {
    return [];
  }
}

async function findOutdatedDependencies(): Promise<OutdatedDependency[]> {
  const output = runCommand('npm outdated --json 2>/dev/null');
  if (!output) {
    return [];
  }

  try {
    const result = JSON.parse(output) as Record<
      string,
      { current: string; wanted: string; latest: string; type: string }
    >;
    return Object.entries(result).map(([name, info]) => ({
      name,
      current: info.current,
      wanted: info.wanted,
      latest: info.latest,
      type: info.type,
    }));
  } catch {
    return [];
  }
}

async function findVulnerabilities(): Promise<Vulnerability[]> {
  const output = runCommand('npm audit --json 2>/dev/null');
  if (!output) {
    return [];
  }

  try {
    const result = JSON.parse(output) as {
      vulnerabilities?: Record<
        string,
        {
          name: string;
          severity: string;
          via: Array<string | { name: string }>;
          range: string;
          fixAvailable: boolean | { name: string };
        }
      >;
    };
    return Object.values(result.vulnerabilities || {}).map((v) => ({
      name: v.name,
      severity: v.severity as Vulnerability['severity'],
      via: v.via.map((via) => (typeof via === 'string' ? via : via.name)),
      range: v.range || 'Unknown',
      fixAvailable: v.fixAvailable !== false,
    }));
  } catch {
    return [];
  }
}

async function checkLicenses(): Promise<LicenseInfo[]> {
  const output = runCommand('npx license-checker --json 2>/dev/null');
  if (!output) {
    return [];
  }

  try {
    const licenses = JSON.parse(output) as Record<string, { licenses?: string }>;
    return Object.entries(licenses).map(([pkg, info]) => {
      const license = info.licenses || 'Unknown';
      const allowed = ALLOWED_LICENSES.some((l) => license.includes(l));
      return {
        package: pkg,
        license,
        allowed,
        reason: allowed ? undefined : 'License not in allowed list',
      };
    });
  } catch {
    return [];
  }
}

async function analyzeDependencies(): Promise<DependencyGraph> {
  const packageJson = readPackageJson();
  const graph: DependencyGraph = {
    nodes: new Map(),
    cycles: [],
    unused: [],
    outdated: [],
    vulnerabilities: [],
  };

  // Build dependency nodes
  const dependencies = (packageJson.dependencies || {}) as Record<string, string>;
  const devDependencies = (packageJson.devDependencies || {}) as Record<string, string>;
  const allDeps = { ...dependencies, ...devDependencies };

  for (const [name, version] of Object.entries(allDeps)) {
    const type: 'production' | 'development' = dependencies[name] ? 'production' : 'development';

    graph.nodes.set(name, {
      name,
      version: version,
      type,
      dependencies: [],
      dependents: [],
    });
  }

  // Check for circular dependencies
  graph.cycles = detectCircularDependencies(graph.nodes);

  // Check for unused dependencies
  graph.unused = await findUnusedDependencies();

  // Check for outdated dependencies
  graph.outdated = await findOutdatedDependencies();

  // Check for vulnerabilities
  graph.vulnerabilities = await findVulnerabilities();

  return graph;
}

async function runSecurityScan(): Promise<SecurityReport> {
  const packageJson = readPackageJson();
  const dependencies = (packageJson.dependencies || {}) as Record<string, string>;
  const devDependencies = (packageJson.devDependencies || {}) as Record<string, string>;
  const allDeps = { ...dependencies, ...devDependencies };

  const report: SecurityReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDependencies: Object.keys(allDeps).length,
      directDependencies: Object.keys(dependencies).length,
      vulnerabilitiesCount: { critical: 0, high: 0, moderate: 0, low: 0 },
      licenseIssues: 0,
      outdatedPackages: 0,
    },
    vulnerabilities: [],
    licenses: [],
    recommendations: [],
    compliance: [],
  };

  // Find vulnerabilities
  report.vulnerabilities = await findVulnerabilities();

  // Count by severity
  for (const vuln of report.vulnerabilities) {
    if (vuln.severity in report.summary.vulnerabilitiesCount) {
      report.summary.vulnerabilitiesCount[vuln.severity]++;
    }
  }

  // Check licenses
  report.licenses = await checkLicenses();
  report.summary.licenseIssues = report.licenses.filter((l) => !l.allowed).length;

  // Check for banned packages
  for (const banned of BANNED_PACKAGES) {
    if (allDeps[banned]) {
      report.vulnerabilities.push({
        name: banned,
        severity: 'critical',
        via: ['Known malicious package'],
        range: allDeps[banned],
        fixAvailable: true,
      });
      report.summary.vulnerabilitiesCount.critical++;
    }
  }

  // Check for outdated
  const outdated = await findOutdatedDependencies();
  report.summary.outdatedPackages = outdated.length;

  // Compliance checks
  report.compliance = [
    {
      rule: 'No critical vulnerabilities',
      passed: report.summary.vulnerabilitiesCount.critical === 0,
      details: `Found ${report.summary.vulnerabilitiesCount.critical} critical vulnerabilities`,
    },
    {
      rule: 'No high vulnerabilities',
      passed: report.summary.vulnerabilitiesCount.high === 0,
      details: `Found ${report.summary.vulnerabilitiesCount.high} high vulnerabilities`,
    },
    {
      rule: 'All licenses approved',
      passed: report.summary.licenseIssues === 0,
      details: `Found ${report.summary.licenseIssues} unapproved licenses`,
    },
    {
      rule: 'No banned packages',
      passed: !report.vulnerabilities.some((v) => BANNED_PACKAGES.includes(v.name)),
      details: 'Checking for known malicious packages',
    },
    {
      rule: 'Lock file exists',
      passed: existsSync(join(E2E_ROOT, 'package-lock.json')),
      details: existsSync(join(E2E_ROOT, 'package-lock.json'))
        ? 'package-lock.json found'
        : 'package-lock.json missing',
    },
  ];

  // Generate recommendations
  if (report.summary.vulnerabilitiesCount.critical > 0) {
    report.recommendations.push(
      'URGENT: Fix critical vulnerabilities immediately with `npm audit fix`'
    );
  }
  if (report.summary.vulnerabilitiesCount.high > 0) {
    report.recommendations.push('Address high severity vulnerabilities within 24 hours');
  }
  if (report.summary.licenseIssues > 0) {
    report.recommendations.push('Review and replace packages with non-compliant licenses');
  }
  if (report.summary.outdatedPackages > 5) {
    report.recommendations.push(
      `Update ${report.summary.outdatedPackages} outdated packages with \`npm update\``
    );
  }

  return report;
}

// ============================================================================
// Report Formatters
// ============================================================================

function formatSecurityReport(report: SecurityReport): string {
  const lines: string[] = [];

  lines.push('# E2E Dependency Security Report\n');
  lines.push(`Generated: ${report.timestamp}\n`);

  // Compliance Status
  lines.push('## Compliance Status\n');
  const allPassed = report.compliance.every((c) => c.passed);
  lines.push(`**Overall Status**: ${allPassed ? 'PASSED' : 'FAILED'}\n`);

  for (const check of report.compliance) {
    const icon = check.passed ? '[PASS]' : '[FAIL]';
    lines.push(`- ${icon} ${check.rule}: ${check.details}`);
  }
  lines.push('');

  // Summary
  lines.push('## Summary\n');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Dependencies | ${report.summary.totalDependencies} |`);
  lines.push(`| Direct Dependencies | ${report.summary.directDependencies} |`);
  lines.push(`| Outdated Packages | ${report.summary.outdatedPackages} |`);
  lines.push(`| License Issues | ${report.summary.licenseIssues} |`);
  lines.push('');

  // Vulnerabilities
  lines.push('## Vulnerability Summary\n');
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Critical | ${report.summary.vulnerabilitiesCount.critical} |`);
  lines.push(`| High | ${report.summary.vulnerabilitiesCount.high} |`);
  lines.push(`| Moderate | ${report.summary.vulnerabilitiesCount.moderate} |`);
  lines.push(`| Low | ${report.summary.vulnerabilitiesCount.low} |`);
  lines.push('');

  // Detailed Vulnerabilities
  if (report.vulnerabilities.length > 0) {
    lines.push('## Vulnerability Details\n');
    for (const vuln of report.vulnerabilities.slice(0, 10)) {
      lines.push(`### ${vuln.name} (${vuln.severity.toUpperCase()})`);
      lines.push(`- **Range**: ${vuln.range}`);
      lines.push(`- **Via**: ${vuln.via.join(', ')}`);
      lines.push(`- **Fix available**: ${vuln.fixAvailable ? 'Yes' : 'No'}`);
      lines.push('');
    }
    if (report.vulnerabilities.length > 10) {
      lines.push(`... and ${report.vulnerabilities.length - 10} more vulnerabilities\n`);
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations\n');
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatGraphReport(graph: DependencyGraph): string {
  const lines: string[] = [];

  lines.push('# Dependency Graph Analysis\n');

  // Summary
  const prodDeps = [...graph.nodes.values()].filter((n) => n.type === 'production');
  const devDeps = [...graph.nodes.values()].filter((n) => n.type === 'development');

  lines.push('## Summary\n');
  lines.push(`- Total Dependencies: ${graph.nodes.size}`);
  lines.push(`- Production Dependencies: ${prodDeps.length}`);
  lines.push(`- Development Dependencies: ${devDeps.length}`);
  lines.push(`- Circular Dependencies: ${graph.cycles.length}`);
  lines.push(`- Unused Dependencies: ${graph.unused.length}`);
  lines.push(`- Outdated Dependencies: ${graph.outdated.length}`);
  lines.push('');

  // Circular dependencies
  if (graph.cycles.length > 0) {
    lines.push('## Circular Dependencies\n');
    lines.push('**Warning**: These circular dependencies may cause issues:\n');
    for (const cycle of graph.cycles) {
      lines.push(`- ${cycle.join(' -> ')} -> ${cycle[0]}`);
    }
    lines.push('');
  }

  // Unused dependencies
  if (graph.unused.length > 0) {
    lines.push('## Unused Dependencies\n');
    lines.push('Consider removing these unused dependencies:\n');
    for (const dep of graph.unused) {
      lines.push(`- \`${dep}\``);
    }
    lines.push('');
  }

  // Outdated dependencies
  if (graph.outdated.length > 0) {
    lines.push('## Outdated Dependencies\n');
    lines.push('| Package | Current | Wanted | Latest |');
    lines.push('|---------|---------|--------|--------|');
    for (const dep of graph.outdated.slice(0, 20)) {
      lines.push(`| ${dep.name} | ${dep.current} | ${dep.wanted} | ${dep.latest} |`);
    }
    if (graph.outdated.length > 20) {
      lines.push(`\n... and ${graph.outdated.length - 20} more outdated packages`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const shouldFix = args.includes('--fix');

  console.log('E2E Dependency Analyzer\n');
  console.log('Running analysis...\n');

  // Run security scan
  const securityReport = await runSecurityScan();

  // Run dependency graph analysis
  const graph = await analyzeDependencies();

  if (jsonOutput) {
    // Output JSON report
    const fullReport = {
      security: securityReport,
      graph: {
        ...graph,
        nodes: Object.fromEntries(graph.nodes),
      },
    };
    console.log(JSON.stringify(fullReport, null, 2));
  } else {
    // Output formatted report
    console.log(formatSecurityReport(securityReport));
    console.log('\n' + '='.repeat(60) + '\n');
    console.log(formatGraphReport(graph));
  }

  // Auto-fix if requested
  if (shouldFix) {
    console.log('\nAttempting to fix issues...\n');

    // Run npm audit fix
    if (
      securityReport.summary.vulnerabilitiesCount.critical > 0 ||
      securityReport.summary.vulnerabilitiesCount.high > 0
    ) {
      console.log('Running npm audit fix...');
      runCommand('npm audit fix');
    }

    // Update outdated packages
    if (graph.outdated.length > 0) {
      console.log('Running npm update...');
      runCommand('npm update');
    }

    console.log('\nFix attempt completed. Re-run analysis to verify.');
  }

  // Exit with error if compliance failed
  const allPassed = securityReport.compliance.every((c) => c.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Analysis failed:', error);
  process.exit(1);
});
