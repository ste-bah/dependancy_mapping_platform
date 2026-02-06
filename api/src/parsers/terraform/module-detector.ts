/**
 * Terraform Module Detector
 * TASK-DETECT-002: Detect and resolve Terraform module references
 */

import * as path from 'path';
import { TerraformBlock, SourceLocation, HCLExpression } from './types';

// ============================================================================
// Module Source Types
// ============================================================================

export type ModuleSource =
  | LocalModuleSource
  | RegistryModuleSource
  | GitHubModuleSource
  | GitModuleSource
  | S3ModuleSource
  | GCSModuleSource
  | UnknownModuleSource;

export interface LocalModuleSource {
  type: 'local';
  path: string;
  resolvedPath: string;
}

export interface RegistryModuleSource {
  type: 'registry';
  hostname: string;
  namespace: string;
  name: string;
  provider: string;
  version: string | null;
}

export interface GitHubModuleSource {
  type: 'github';
  owner: string;
  repo: string;
  path: string | null;
  ref: string | null;
  isSSH: boolean;
}

export interface GitModuleSource {
  type: 'git';
  url: string;
  ref: string | null;
  path: string | null;
}

export interface S3ModuleSource {
  type: 's3';
  bucket: string;
  key: string;
  region: string | null;
}

export interface GCSModuleSource {
  type: 'gcs';
  bucket: string;
  path: string;
}

export interface UnknownModuleSource {
  type: 'unknown';
  raw: string;
}

// ============================================================================
// Module Node
// ============================================================================

export interface ModuleNode {
  id: string;
  type: 'terraform_module';
  name: string;
  source: ModuleSource;
  version: string | null;
  providers: Record<string, string>;
  variables: Record<string, unknown>;
  count: HCLExpression | null;
  forEach: HCLExpression | null;
  dependsOn: string[];
  location: SourceLocation;
}

// ============================================================================
// Source Parser
// ============================================================================

const SOURCE_PATTERNS = {
  // Local paths
  local: /^\.\.?\/|^\//,

  // Terraform Registry (official or private)
  // Format: [hostname/]namespace/name/provider
  registry: /^(?:([a-z0-9.-]+)\/)?([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\/([a-z]+)$/,

  // GitHub shortcuts (with optional ?ref= query string)
  github: /^github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\/\/(.+?))?(?:\?ref=(.+))?$/,
  githubSSH: /^git@github\.com:([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/\/(.+?))?(?:\?ref=(.+))?$/,

  // Generic Git
  git: /^git::(https?:\/\/.+?)(?:\?ref=(.+))?$/,
  gitSSH: /^git::ssh:\/\/(.+?)(?:\?ref=(.+))?$/,

  // S3
  s3: /^s3::https?:\/\/s3(?:-([a-z0-9-]+))?\.amazonaws\.com\/([a-zA-Z0-9._-]+)\/(.+)$/,

  // GCS
  gcs: /^gcs::https:\/\/www\.googleapis\.com\/storage\/v1\/([a-zA-Z0-9._-]+)\/(.+)$/,

  // Bitbucket
  bitbucket: /^bitbucket\.org\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/,
};

/**
 * Parse a module source string into a structured ModuleSource
 */
export function parseModuleSource(source: string, callerDir: string): ModuleSource {
  const trimmed = source.trim();

  // Local path
  if (SOURCE_PATTERNS.local.test(trimmed)) {
    return {
      type: 'local',
      path: trimmed,
      resolvedPath: path.resolve(callerDir, trimmed),
    };
  }

  // GitHub HTTPS
  const githubMatch = trimmed.match(SOURCE_PATTERNS.github);
  if (githubMatch) {
    const [, owner, repo, subpath, queryRef] = githubMatch;
    const { cleanRepo, ref } = parseGitRef(repo);
    return {
      type: 'github',
      owner,
      repo: cleanRepo,
      path: subpath || null,
      ref: queryRef || ref, // Prefer query string ref over repo suffix ref
      isSSH: false,
    };
  }

  // GitHub SSH
  const githubSSHMatch = trimmed.match(SOURCE_PATTERNS.githubSSH);
  if (githubSSHMatch) {
    const [, owner, repo, subpath, queryRef] = githubSSHMatch;
    const { cleanRepo, ref } = parseGitRef(repo);
    return {
      type: 'github',
      owner,
      repo: cleanRepo,
      path: subpath || null,
      ref: queryRef || ref, // Prefer query string ref over repo suffix ref
      isSSH: true,
    };
  }

  // Generic Git
  const gitMatch = trimmed.match(SOURCE_PATTERNS.git);
  if (gitMatch) {
    const [, url, ref] = gitMatch;
    const { basePath, subPath } = parseGitPath(url);
    return {
      type: 'git',
      url: basePath,
      ref: ref || null,
      path: subPath,
    };
  }

  // Git SSH
  const gitSSHMatch = trimmed.match(SOURCE_PATTERNS.gitSSH);
  if (gitSSHMatch) {
    const [, url, ref] = gitSSHMatch;
    return {
      type: 'git',
      url: `ssh://${url}`,
      ref: ref || null,
      path: null,
    };
  }

  // S3
  const s3Match = trimmed.match(SOURCE_PATTERNS.s3);
  if (s3Match) {
    const [, region, bucket, key] = s3Match;
    return {
      type: 's3',
      bucket,
      key,
      region: region || null,
    };
  }

  // GCS
  const gcsMatch = trimmed.match(SOURCE_PATTERNS.gcs);
  if (gcsMatch) {
    const [, bucket, gcsPath] = gcsMatch;
    return {
      type: 'gcs',
      bucket,
      path: gcsPath,
    };
  }

  // Terraform Registry
  const registryMatch = trimmed.match(SOURCE_PATTERNS.registry);
  if (registryMatch) {
    const [, hostname, namespace, name, provider] = registryMatch;
    return {
      type: 'registry',
      hostname: hostname || 'registry.terraform.io',
      namespace,
      name,
      provider,
      version: null, // Version comes from the version attribute
    };
  }

  // Unknown
  return {
    type: 'unknown',
    raw: trimmed,
  };
}

function parseGitRef(repo: string): { cleanRepo: string; ref: string | null } {
  const refMatch = repo.match(/\?ref=(.+)$/);
  if (refMatch) {
    return {
      cleanRepo: repo.replace(/\?ref=.+$/, ''),
      ref: refMatch[1],
    };
  }
  return { cleanRepo: repo, ref: null };
}

function parseGitPath(url: string): { basePath: string; subPath: string | null } {
  const doubleslashIndex = url.indexOf('//');
  if (doubleslashIndex > 0 && url.charAt(doubleslashIndex - 1) !== ':') {
    return {
      basePath: url.slice(0, doubleslashIndex),
      subPath: url.slice(doubleslashIndex + 2),
    };
  }
  return { basePath: url, subPath: null };
}

// ============================================================================
// Module Detector
// ============================================================================

export class ModuleDetector {
  /**
   * Extract module nodes from parsed Terraform blocks
   */
  detectModules(blocks: TerraformBlock[], callerDir: string): ModuleNode[] {
    const modules: ModuleNode[] = [];

    for (const block of blocks) {
      if (block.type === 'module' && block.labels.length > 0) {
        const moduleNode = this.parseModuleBlock(block, callerDir);
        if (moduleNode) {
          modules.push(moduleNode);
        }
      }
    }

    return modules;
  }

  private parseModuleBlock(block: TerraformBlock, callerDir: string): ModuleNode | null {
    const name = block.labels[0];
    const sourceExpr = block.attributes['source'];

    if (!sourceExpr) {
      return null;
    }

    const sourceString = this.extractStringValue(sourceExpr);
    if (!sourceString) {
      return null;
    }

    const source = parseModuleSource(sourceString, callerDir);

    // Extract version if present
    let version: string | null = null;
    const versionExpr = block.attributes['version'];
    if (versionExpr) {
      version = this.extractStringValue(versionExpr);
    }

    // Update registry source with version
    if (source.type === 'registry' && version) {
      source.version = version;
    }

    // Extract providers mapping
    const providers = this.extractProviders(block.attributes['providers']);

    // Extract variables (all other attributes except reserved ones)
    const reservedAttrs = ['source', 'version', 'providers', 'count', 'for_each', 'depends_on'];
    const variables: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(block.attributes)) {
      if (!reservedAttrs.includes(key)) {
        variables[key] = this.expressionToValue(value);
      }
    }

    // Extract depends_on
    const dependsOn = this.extractDependsOn(block.attributes['depends_on']);

    return {
      id: `module.${name}`,
      type: 'terraform_module',
      name,
      source,
      version,
      providers,
      variables,
      count: block.attributes['count'] || null,
      forEach: block.attributes['for_each'] || null,
      dependsOn,
      location: block.location,
    };
  }

  private extractStringValue(expr: HCLExpression): string | null {
    if (expr.type === 'literal' && typeof expr.value === 'string') {
      return expr.value;
    }
    return null;
  }

  private extractProviders(expr: HCLExpression | undefined): Record<string, string> {
    const providers: Record<string, string> = {};

    if (!expr || expr.type !== 'object') {
      return providers;
    }

    for (const [key, value] of Object.entries(expr.attributes)) {
      if (value.type === 'reference') {
        providers[key] = value.parts.join('.');
      } else if (value.type === 'literal' && typeof value.value === 'string') {
        providers[key] = value.value;
      }
    }

    return providers;
  }

  private extractDependsOn(expr: HCLExpression | undefined): string[] {
    const deps: string[] = [];

    if (!expr || expr.type !== 'array') {
      return deps;
    }

    for (const element of expr.elements) {
      if (element.type === 'reference') {
        deps.push(element.parts.join('.'));
      }
    }

    return deps;
  }

  private expressionToValue(expr: HCLExpression): unknown {
    switch (expr.type) {
      case 'literal':
        return expr.value;
      case 'reference':
        return `\${${expr.parts.join('.')}}`;
      case 'array':
        return expr.elements.map(e => this.expressionToValue(e));
      case 'object':
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(expr.attributes)) {
          obj[k] = this.expressionToValue(v);
        }
        return obj;
      default:
        return expr.raw || null;
    }
  }
}

// ============================================================================
// Version Constraint Parsing
// ============================================================================

export interface VersionConstraint {
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | '~>';
  version: string;
}

/**
 * Parse Terraform version constraint string
 */
export function parseVersionConstraint(constraint: string): VersionConstraint[] {
  const constraints: VersionConstraint[] = [];
  const parts = constraint.split(',').map(p => p.trim());

  for (const part of parts) {
    const match = part.match(/^(=|!=|>=?|<=?|~>)?\s*(.+)$/);
    if (match) {
      const [, op, ver] = match;
      constraints.push({
        operator: (op || '=') as VersionConstraint['operator'],
        version: ver.trim(),
      });
    }
  }

  return constraints;
}

export const moduleDetector = new ModuleDetector();
