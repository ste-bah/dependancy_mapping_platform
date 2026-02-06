/**
 * Domain Validators for External Object Index
 * @module services/rollup/external-object-index/domain/validators
 *
 * Validation utilities for domain objects including ARN, container image,
 * Git URL, S3 path, and other external reference formats.
 *
 * TASK-ROLLUP-003: Domain layer validation rules
 */

import { Result, ValidationError, ValidationResult } from './result.js';
import {
  ExternalRefType,
  ARN_PATTERN,
  CONTAINER_IMAGE_PATTERN,
  GIT_URL_PATTERNS,
  S3_PATH_PATTERN,
  GCS_PATH_PATTERN,
  AZURE_BLOB_PATTERN,
  K8S_REFERENCE_PATTERN,
} from './types.js';

// ============================================================================
// ARN Validation
// ============================================================================

/**
 * Parsed ARN components
 */
export interface ParsedArn {
  readonly partition: string;
  readonly service: string;
  readonly region: string;
  readonly account: string;
  readonly resource: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}

/**
 * Validate and parse an ARN string
 *
 * @param arn - The ARN string to validate
 * @returns Result containing parsed ARN or validation error
 *
 * @example
 * ```typescript
 * const result = validateArn('arn:aws:s3:::my-bucket');
 * if (Result.isOk(result)) {
 *   console.log(result.value.service); // 's3'
 * }
 * ```
 */
export function validateArn(arn: string): ValidationResult<ParsedArn> {
  if (!arn || typeof arn !== 'string') {
    return Result.err(ValidationError.required('arn'));
  }

  const trimmed = arn.trim();
  if (!trimmed.startsWith('arn:')) {
    return Result.err(
      ValidationError.invalidFormat('arn', 'Must start with "arn:"')
    );
  }

  const match = trimmed.match(ARN_PATTERN);
  if (!match) {
    return Result.err(
      ValidationError.invalidFormat(
        'arn',
        'arn:partition:service:region:account-id:resource'
      )
    );
  }

  const [, partition, service, region, account, resource] = match;

  // Parse resource component (may have type:id or type/id format)
  let resourceType: string | undefined;
  let resourceId: string | undefined;

  const slashIndex = resource.indexOf('/');
  const colonIndex = resource.indexOf(':');

  if (slashIndex > 0 && (colonIndex < 0 || slashIndex < colonIndex)) {
    resourceType = resource.substring(0, slashIndex);
    resourceId = resource.substring(slashIndex + 1);
  } else if (colonIndex > 0) {
    resourceType = resource.substring(0, colonIndex);
    resourceId = resource.substring(colonIndex + 1);
  }

  return Result.ok({
    partition,
    service,
    region,
    account,
    resource,
    resourceType,
    resourceId,
  });
}

/**
 * Check if a string is a valid ARN (without parsing)
 */
export function isValidArn(arn: string): boolean {
  return Result.isOk(validateArn(arn));
}

/**
 * Normalize an ARN for comparison
 * - Lowercases partition and service
 * - Removes region and account for cross-region matching
 */
export function normalizeArn(arn: string): string {
  const result = validateArn(arn);
  if (Result.isErr(result)) {
    return arn.toLowerCase().trim();
  }

  const { partition, service, resource } = result.value;
  return `arn:${partition}:${service}:::${resource}`.toLowerCase();
}

// ============================================================================
// Container Image Validation
// ============================================================================

/**
 * Parsed container image components
 */
export interface ParsedContainerImage {
  readonly registry?: string;
  readonly repository: string;
  readonly tag?: string;
  readonly digest?: string;
}

/**
 * Validate and parse a container image reference
 *
 * @param image - The image reference to validate
 * @returns Result containing parsed image or validation error
 *
 * @example
 * ```typescript
 * const result = validateContainerImage('nginx:latest');
 * if (Result.isOk(result)) {
 *   console.log(result.value.tag); // 'latest'
 * }
 * ```
 */
export function validateContainerImage(image: string): ValidationResult<ParsedContainerImage> {
  if (!image || typeof image !== 'string') {
    return Result.err(ValidationError.required('image'));
  }

  const trimmed = image.trim();
  if (trimmed.length === 0) {
    return Result.err(
      ValidationError.invalidValue('image', image, 'Image cannot be empty')
    );
  }

  // Parse components
  let registry: string | undefined;
  let remainder = trimmed;

  // Check for registry prefix
  const firstSlash = trimmed.indexOf('/');
  if (firstSlash > 0) {
    const potentialRegistry = trimmed.substring(0, firstSlash);
    // Registry typically contains a dot or colon (for port)
    if (potentialRegistry.includes('.') || potentialRegistry.includes(':')) {
      registry = potentialRegistry;
      remainder = trimmed.substring(firstSlash + 1);
    }
  }

  // Parse tag and digest
  let repository = remainder;
  let tag: string | undefined;
  let digest: string | undefined;

  const atIndex = remainder.indexOf('@');
  if (atIndex > 0) {
    digest = remainder.substring(atIndex + 1);
    remainder = remainder.substring(0, atIndex);
  }

  const colonIndex = remainder.lastIndexOf(':');
  if (colonIndex > 0) {
    tag = remainder.substring(colonIndex + 1);
    repository = remainder.substring(0, colonIndex);
  } else {
    repository = remainder;
  }

  // Validate repository name
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(repository)) {
    return Result.err(
      ValidationError.invalidFormat('image', '[registry/]repository[:tag][@digest]')
    );
  }

  return Result.ok({
    registry,
    repository,
    tag,
    digest,
  });
}

/**
 * Check if a string is a valid container image reference
 */
export function isValidContainerImage(image: string): boolean {
  return Result.isOk(validateContainerImage(image));
}

// ============================================================================
// Git URL Validation
// ============================================================================

/**
 * Parsed Git URL components
 */
export interface ParsedGitUrl {
  readonly protocol: 'https' | 'ssh';
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
}

/**
 * Validate and parse a Git repository URL
 *
 * @param url - The Git URL to validate
 * @returns Result containing parsed URL or validation error
 *
 * @example
 * ```typescript
 * const result = validateGitUrl('https://github.com/owner/repo.git');
 * if (Result.isOk(result)) {
 *   console.log(result.value.owner); // 'owner'
 * }
 * ```
 */
export function validateGitUrl(url: string): ValidationResult<ParsedGitUrl> {
  if (!url || typeof url !== 'string') {
    return Result.err(ValidationError.required('url'));
  }

  const trimmed = url.trim();

  // Try HTTPS format
  const httpsMatch = trimmed.match(/^https?:\/\/([\w.-]+)\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (httpsMatch) {
    const [, host, owner, repo] = httpsMatch;
    return Result.ok({
      protocol: 'https',
      host,
      owner,
      repo: repo.replace(/\.git$/, ''),
    });
  }

  // Try SSH format
  const sshMatch = trimmed.match(/^git@([\w.-]+):([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    return Result.ok({
      protocol: 'ssh',
      host,
      owner,
      repo: repo.replace(/\.git$/, ''),
    });
  }

  return Result.err(
    ValidationError.invalidFormat(
      'url',
      'https://host/owner/repo or git@host:owner/repo'
    )
  );
}

/**
 * Check if a string is a valid Git URL
 */
export function isValidGitUrl(url: string): boolean {
  return Result.isOk(validateGitUrl(url));
}

// ============================================================================
// Storage Path Validation
// ============================================================================

/**
 * Parsed storage path components
 */
export interface ParsedStoragePath {
  readonly provider: 'aws' | 'gcp' | 'azure';
  readonly bucket: string;
  readonly key?: string;
}

/**
 * Validate and parse a cloud storage path (S3, GCS, Azure Blob)
 *
 * @param path - The storage path to validate
 * @returns Result containing parsed path or validation error
 *
 * @example
 * ```typescript
 * const result = validateStoragePath('s3://my-bucket/path/to/object');
 * if (Result.isOk(result)) {
 *   console.log(result.value.bucket); // 'my-bucket'
 * }
 * ```
 */
export function validateStoragePath(path: string): ValidationResult<ParsedStoragePath> {
  if (!path || typeof path !== 'string') {
    return Result.err(ValidationError.required('path'));
  }

  const trimmed = path.trim();

  // Try S3 format
  const s3Match = trimmed.match(/^s3:\/\/([\w.-]+)(?:\/(.*))?$/);
  if (s3Match) {
    const [, bucket, key] = s3Match;
    return Result.ok({
      provider: 'aws',
      bucket,
      key: key || undefined,
    });
  }

  // Try GCS format
  const gcsMatch = trimmed.match(/^gs:\/\/([\w.-]+)(?:\/(.*))?$/);
  if (gcsMatch) {
    const [, bucket, key] = gcsMatch;
    return Result.ok({
      provider: 'gcp',
      bucket,
      key: key || undefined,
    });
  }

  // Try Azure Blob format
  const azureMatch = trimmed.match(
    /^https:\/\/([\w.-]+)\.blob\.core\.windows\.net\/([\w.-]+)(?:\/(.*))?$/
  );
  if (azureMatch) {
    const [, , container, key] = azureMatch;
    return Result.ok({
      provider: 'azure',
      bucket: container,
      key: key || undefined,
    });
  }

  return Result.err(
    ValidationError.invalidFormat(
      'path',
      's3://bucket/key, gs://bucket/key, or https://account.blob.core.windows.net/container/key'
    )
  );
}

/**
 * Check if a string is a valid storage path
 */
export function isValidStoragePath(path: string): boolean {
  return Result.isOk(validateStoragePath(path));
}

// ============================================================================
// Kubernetes Reference Validation
// ============================================================================

/**
 * Parsed Kubernetes reference components
 */
export interface ParsedK8sReference {
  readonly namespace?: string;
  readonly kind: string;
  readonly name: string;
}

/**
 * Validate and parse a Kubernetes resource reference
 *
 * @param ref - The K8s reference to validate
 * @returns Result containing parsed reference or validation error
 *
 * @example
 * ```typescript
 * const result = validateK8sReference('default/deployment/nginx');
 * if (Result.isOk(result)) {
 *   console.log(result.value.kind); // 'deployment'
 * }
 * ```
 */
export function validateK8sReference(ref: string): ValidationResult<ParsedK8sReference> {
  if (!ref || typeof ref !== 'string') {
    return Result.err(ValidationError.required('reference'));
  }

  const trimmed = ref.trim();
  const parts = trimmed.split('/');

  if (parts.length === 2) {
    // kind/name format
    const [kind, name] = parts;
    if (!kind || !name) {
      return Result.err(
        ValidationError.invalidFormat('reference', 'kind/name or namespace/kind/name')
      );
    }
    return Result.ok({ kind, name });
  }

  if (parts.length === 3) {
    // namespace/kind/name format
    const [namespace, kind, name] = parts;
    if (!namespace || !kind || !name) {
      return Result.err(
        ValidationError.invalidFormat('reference', 'kind/name or namespace/kind/name')
      );
    }
    return Result.ok({ namespace, kind, name });
  }

  return Result.err(
    ValidationError.invalidFormat('reference', 'kind/name or namespace/kind/name')
  );
}

/**
 * Check if a string is a valid K8s reference
 */
export function isValidK8sReference(ref: string): boolean {
  return Result.isOk(validateK8sReference(ref));
}

// ============================================================================
// Confidence Validation
// ============================================================================

/**
 * Validate a confidence score
 *
 * @param confidence - The confidence value to validate
 * @returns Result containing the validated confidence or error
 */
export function validateConfidence(confidence: unknown): ValidationResult<number> {
  if (confidence === undefined || confidence === null) {
    return Result.ok(1.0); // Default to full confidence
  }

  if (typeof confidence !== 'number') {
    return Result.err(
      ValidationError.invalidValue('confidence', confidence, 'Must be a number')
    );
  }

  if (isNaN(confidence)) {
    return Result.err(
      ValidationError.invalidValue('confidence', confidence, 'Cannot be NaN')
    );
  }

  if (confidence < 0.0 || confidence > 1.0) {
    return Result.err(ValidationError.outOfRange('confidence', 0.0, 1.0));
  }

  return Result.ok(confidence);
}

// ============================================================================
// Generic Validation Utilities
// ============================================================================

/**
 * Validate a non-empty string
 */
export function validateNonEmptyString(
  field: string,
  value: unknown
): ValidationResult<string> {
  if (value === undefined || value === null) {
    return Result.err(ValidationError.required(field));
  }

  if (typeof value !== 'string') {
    return Result.err(
      ValidationError.invalidValue(field, value, 'Must be a string')
    );
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return Result.err(
      ValidationError.invalidValue(field, value, 'Cannot be empty')
    );
  }

  return Result.ok(trimmed);
}

/**
 * Validate an external reference based on its type
 *
 * @param refType - The reference type
 * @param identifier - The reference identifier
 * @returns Result indicating validity or error
 */
export function validateExternalReference(
  refType: ExternalRefType,
  identifier: string
): ValidationResult<void> {
  switch (refType) {
    case 'arn':
      return Result.map(validateArn(identifier), () => undefined);

    case 'container_image':
      return Result.map(validateContainerImage(identifier), () => undefined);

    case 'git_url':
      return Result.map(validateGitUrl(identifier), () => undefined);

    case 'storage_path':
      return Result.map(validateStoragePath(identifier), () => undefined);

    case 'k8s_reference':
      return Result.map(validateK8sReference(identifier), () => undefined);

    case 'resource_id':
    case 'gcp_resource':
    case 'azure_resource':
      // Generic resource IDs have flexible formats - just check non-empty
      return Result.map(validateNonEmptyString('identifier', identifier), () => undefined);

    default:
      return Result.ok(undefined);
  }
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validation result for batch operations
 */
export interface BatchValidationResult<T> {
  readonly valid: T[];
  readonly invalid: Array<{
    index: number;
    value: unknown;
    error: ValidationError;
  }>;
}

/**
 * Validate an array of values and separate valid from invalid
 *
 * @param values - Array of values to validate
 * @param validator - Validation function
 * @returns Batch validation result
 */
export function validateBatch<T, V>(
  values: V[],
  validator: (value: V) => ValidationResult<T>
): BatchValidationResult<T> {
  const valid: T[] = [];
  const invalid: Array<{ index: number; value: unknown; error: ValidationError }> = [];

  values.forEach((value, index) => {
    const result = validator(value);
    if (Result.isOk(result)) {
      valid.push(result.value);
    } else {
      invalid.push({ index, value, error: result.error });
    }
  });

  return { valid, invalid };
}
