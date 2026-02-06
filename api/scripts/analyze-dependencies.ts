#!/usr/bin/env tsx
/**
 * Dependency Analysis Script
 * @module scripts/analyze-dependencies
 *
 * Analyzes package dependencies for security vulnerabilities,
 * outdated packages, unused dependencies, and license compliance.
 *
 * Usage:
 *   npm run deps:analyze
 *   tsx scripts/analyze-dependencies.ts
 *   tsx scripts/analyze-dependencies.ts --json
 *   tsx scripts/analyze-dependencies.ts --fix
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

interface DependencyNode {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  dependencies: string[];
  dependents: string[];
  size: number;
  license: string;
}

interface OutdatedDependency {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: string;
  location: string;
}

interface Vulnerability {
  name: string;
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  via: string[];
  range: string;
  fixAvailable: boolean;
  directDependency: boolean;
}

interface LicenseInfo {
  package: string;
  version: string;
  license: string;
  allowed: boolean;
  reason?: string;
}

interface DependencyReport {
  timestamp: string;
  summary: {
    totalDependencies: number;
    productionDependencies: number;
    developmentDependencies: number;
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
    outdated: number;
    unused: string[];
    licenseIssues: number;
  };
  vulnerabilities: Vulnerability[];
  outdated: OutdatedDependency[];
  licenses: LicenseInfo[];
  recommendations: string[];
  compliance: {
    rule: string;
    passed: boolean;
    details: string;
  }[];
}

// ============================================================================
// Configuration
// ============================================================================

const ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'Apache 2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'WTFPL',
  'BlueOak-1.0.0',
  'Python-2.0',
];

const BANNED_PACKAGES = [
  'event-stream', // Known supply chain attack
  'flatmap-stream', // Malicious package
  'ua-parser-js', // Had malicious versions
  'coa', // Had malicious versions
  'rc', // Had malicious versions
];

// ============================================================================
// Analysis Functions
// ============================================================================

function execCommand(command: string): string | null {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
  } catch (error) {
    // npm commands often exit with non-zero when findings exist
    if (error instanceof Error && 'stdout' in error) {
      return (error as { stdout: string }).stdout;
    }
    return null;
  }
}

function analyzeVulnerabilities(): Vulnerability[] {
  const output = execCommand('npm audit --json');
  if (output === null) return [];

  try {
    const result = JSON.parse(output);
    const vulns: Vulnerability[] = [];

    if (result.vulnerabilities) {
      for (const [name, data] of Object.entries(result.vulnerabilities)) {
        const v = data as {
          severity: string;
          via: unknown[];
          range: string;
          fixAvailable: boolean | { name: string };
          isDirect: boolean;
        };

        vulns.push({
          name,
          severity: v.severity as Vulnerability['severity'],
          via: v.via
            .map((via) => (typeof via === 'string' ? via : (via as { name?: string }).name ?? ''))
            .filter(Boolean),
          range: v.range,
          fixAvailable: v.fixAvailable !== false,
          directDependency: v.isDirect,
        });
      }
    }

    return vulns;
  } catch {
    return [];
  }
}

function analyzeOutdated(): OutdatedDependency[] {
  const output = execCommand('npm outdated --json');
  if (output === null || output.trim() === '') return [];

  try {
    const result = JSON.parse(output);
    const outdated: OutdatedDependency[] = [];

    for (const [name, data] of Object.entries(result)) {
      const d = data as {
        current: string;
        wanted: string;
        latest: string;
        type: string;
        location: string;
      };

      outdated.push({
        name,
        current: d.current ?? 'N/A',
        wanted: d.wanted ?? 'N/A',
        latest: d.latest ?? 'N/A',
        type: d.type ?? 'dependencies',
        location: d.location ?? '',
      });
    }

    return outdated;
  } catch {
    return [];
  }
}

function analyzeUnused(): string[] {
  const output = execCommand('npx depcheck --json 2>/dev/null');
  if (output === null) return [];

  try {
    const result = JSON.parse(output);
    return [...(result.dependencies ?? []), ...(result.devDependencies ?? [])];
  } catch {
    return [];
  }
}

function analyzeLicenses(): LicenseInfo[] {
  const output = execCommand('npx license-checker --json 2>/dev/null');
  if (output === null) return [];

  try {
    const result = JSON.parse(output);
    const licenses: LicenseInfo[] = [];

    for (const [pkg, data] of Object.entries(result)) {
      const d = data as { licenses?: string; licenseFile?: string };
      const license = d.licenses ?? 'Unknown';
      const allowed = ALLOWED_LICENSES.some(
        (l) => license.includes(l) || license === '(MIT OR Apache-2.0)'
      );

      // Extract package name and version
      const atIndex = pkg.lastIndexOf('@');
      const name = atIndex > 0 ? pkg.substring(0, atIndex) : pkg;
      const version = atIndex > 0 ? pkg.substring(atIndex + 1) : 'unknown';

      licenses.push({
        package: name,
        version,
        license,
        allowed,
        reason: allowed ? undefined : 'License not in approved list',
      });
    }

    return licenses;
  } catch {
    return [];
  }
}

function checkBannedPackages(packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const banned of BANNED_PACKAGES) {
    if (allDeps[banned]) {
      vulns.push({
        name: banned,
        severity: 'critical',
        via: ['BANNED_PACKAGE'],
        range: allDeps[banned] ?? '*',
        fixAvailable: true,
        directDependency: true,
      });
    }
  }

  return vulns;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(): DependencyReport {
  const packageJsonPath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  console.log('Analyzing dependencies...\n');

  console.log('  Checking vulnerabilities...');
  const vulnerabilities = analyzeVulnerabilities();
  const bannedVulns = checkBannedPackages(packageJson);
  const allVulns = [...vulnerabilities, ...bannedVulns];

  console.log('  Checking outdated packages...');
  const outdated = analyzeOutdated();

  console.log('  Checking unused dependencies...');
  const unused = analyzeUnused();

  console.log('  Checking licenses...');
  const licenses = analyzeLicenses();

  const vulnCounts = {
    info: allVulns.filter((v) => v.severity === 'info').length,
    low: allVulns.filter((v) => v.severity === 'low').length,
    moderate: allVulns.filter((v) => v.severity === 'moderate').length,
    high: allVulns.filter((v) => v.severity === 'high').length,
    critical: allVulns.filter((v) => v.severity === 'critical').length,
    total: allVulns.length,
  };

  const licenseIssues = licenses.filter((l) => !l.allowed).length;

  const report: DependencyReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDependencies:
        Object.keys(packageJson.dependencies ?? {}).length +
        Object.keys(packageJson.devDependencies ?? {}).length,
      productionDependencies: Object.keys(packageJson.dependencies ?? {}).length,
      developmentDependencies: Object.keys(packageJson.devDependencies ?? {}).length,
      vulnerabilities: vulnCounts,
      outdated: outdated.length,
      unused,
      licenseIssues,
    },
    vulnerabilities: allVulns,
    outdated,
    licenses: licenses.filter((l) => !l.allowed), // Only include issues
    recommendations: [],
    compliance: [],
  };

  // Generate recommendations
  if (vulnCounts.critical > 0) {
    report.recommendations.push(
      `CRITICAL: ${vulnCounts.critical} critical vulnerabilities found. Run 'npm audit fix' immediately.`
    );
  }

  if (vulnCounts.high > 0) {
    report.recommendations.push(
      `HIGH: ${vulnCounts.high} high severity vulnerabilities. Address within 24 hours.`
    );
  }

  if (outdated.length > 10) {
    report.recommendations.push(
      `${outdated.length} outdated packages. Consider running 'npm run deps:update'.`
    );
  }

  if (unused.length > 0) {
    report.recommendations.push(
      `${unused.length} potentially unused dependencies: ${unused.slice(0, 5).join(', ')}${unused.length > 5 ? '...' : ''}`
    );
  }

  if (licenseIssues > 0) {
    report.recommendations.push(
      `${licenseIssues} packages with non-approved licenses require review.`
    );
  }

  // Compliance checks
  report.compliance = [
    {
      rule: 'No critical vulnerabilities',
      passed: vulnCounts.critical === 0,
      details: vulnCounts.critical > 0 ? `Found ${vulnCounts.critical} critical` : 'Passed',
    },
    {
      rule: 'No high vulnerabilities',
      passed: vulnCounts.high === 0,
      details: vulnCounts.high > 0 ? `Found ${vulnCounts.high} high` : 'Passed',
    },
    {
      rule: 'All licenses approved',
      passed: licenseIssues === 0,
      details: licenseIssues > 0 ? `${licenseIssues} unapproved` : 'Passed',
    },
    {
      rule: 'No banned packages',
      passed: bannedVulns.length === 0,
      details: bannedVulns.length > 0 ? `${bannedVulns.length} banned` : 'Passed',
    },
    {
      rule: 'Lock file exists',
      passed: existsSync(join(process.cwd(), 'package-lock.json')),
      details: 'package-lock.json required',
    },
  ];

  return report;
}

function formatReport(report: DependencyReport): string {
  const lines: string[] = [];

  lines.push('# Dependency Analysis Report\n');
  lines.push(`Generated: ${report.timestamp}\n`);

  // Compliance status
  const allPassed = report.compliance.every((c) => c.passed);
  lines.push(`## Compliance Status: ${allPassed ? 'PASSED' : 'FAILED'}\n`);

  for (const check of report.compliance) {
    const icon = check.passed ? '[PASS]' : '[FAIL]';
    lines.push(`${icon} ${check.rule}: ${check.details}`);
  }
  lines.push('');

  // Summary
  lines.push('## Summary\n');
  lines.push(`- Total dependencies: ${report.summary.totalDependencies}`);
  lines.push(`  - Production: ${report.summary.productionDependencies}`);
  lines.push(`  - Development: ${report.summary.developmentDependencies}`);
  lines.push(`- Vulnerabilities: ${report.summary.vulnerabilities.total}`);
  lines.push(`  - Critical: ${report.summary.vulnerabilities.critical}`);
  lines.push(`  - High: ${report.summary.vulnerabilities.high}`);
  lines.push(`  - Moderate: ${report.summary.vulnerabilities.moderate}`);
  lines.push(`  - Low: ${report.summary.vulnerabilities.low}`);
  lines.push(`- Outdated packages: ${report.summary.outdated}`);
  lines.push(`- Potentially unused: ${report.summary.unused.length}`);
  lines.push(`- License issues: ${report.summary.licenseIssues}`);
  lines.push('');

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations\n');
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Vulnerabilities
  if (report.vulnerabilities.length > 0) {
    lines.push('## Vulnerabilities\n');
    const sorted = [...report.vulnerabilities].sort((a, b) => {
      const severity = ['critical', 'high', 'moderate', 'low', 'info'];
      return severity.indexOf(a.severity) - severity.indexOf(b.severity);
    });

    for (const vuln of sorted) {
      lines.push(`### ${vuln.name} (${vuln.severity.toUpperCase()})`);
      lines.push(`- Range: ${vuln.range}`);
      lines.push(`- Via: ${vuln.via.join(', ')}`);
      lines.push(`- Direct dependency: ${vuln.directDependency ? 'Yes' : 'No'}`);
      lines.push(`- Fix available: ${vuln.fixAvailable ? 'Yes' : 'No'}`);
      lines.push('');
    }
  }

  // Outdated
  if (report.outdated.length > 0) {
    lines.push('## Outdated Packages\n');
    lines.push('| Package | Current | Wanted | Latest |');
    lines.push('|---------|---------|--------|--------|');
    for (const dep of report.outdated.slice(0, 20)) {
      lines.push(`| ${dep.name} | ${dep.current} | ${dep.wanted} | ${dep.latest} |`);
    }
    if (report.outdated.length > 20) {
      lines.push(`\n... and ${report.outdated.length - 20} more`);
    }
    lines.push('');
  }

  // License issues
  if (report.licenses.length > 0) {
    lines.push('## License Issues\n');
    for (const lic of report.licenses) {
      lines.push(`- ${lic.package}@${lic.version}: ${lic.license} (${lic.reason})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const fix = args.includes('--fix');

  const report = generateReport();

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n' + formatReport(report));
  }

  // Run fix if requested
  if (fix && report.summary.vulnerabilities.total > 0) {
    console.log('\nAttempting to fix vulnerabilities...\n');
    execSync('npm audit fix', { stdio: 'inherit' });
  }

  // Exit with error code if compliance failed
  const allPassed = report.compliance.every((c) => c.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

main();
