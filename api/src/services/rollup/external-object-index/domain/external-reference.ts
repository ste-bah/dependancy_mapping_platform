/**
 * External Reference Value Object
 * @module services/rollup/external-object-index/domain/external-reference
 *
 * Immutable value object representing an external reference (ARN, Resource ID, etc.)
 * with validation and normalization logic.
 *
 * TASK-ROLLUP-003: Domain layer value objects
 */

import { Result, ValidationError, ValidationResult } from './result.js';
import {
  ExternalRefType,
  CloudProvider,
  ReferenceHash,
  computeReferenceHash,
  CreateExternalReferenceParams,
  ExternalReferenceDTO,
  ARN_PATTERN,
  CONTAINER_IMAGE_PATTERN,
  GIT_URL_PATTERNS,
  S3_PATH_PATTERN,
  GCS_PATH_PATTERN,
  K8S_REFERENCE_PATTERN,
  NodeReferenceSource,
  isExternalRefType,
} from './types.js';

// ============================================================================
// External Reference Value Object
// ============================================================================

/**
 * Immutable value object representing an external reference.
 * External references are pointers to cloud resources, container images,
 * Git repositories, or other external entities.
 *
 * Value objects are compared by their contents, not identity.
 *
 * @example
 * ```typescript
 * const arnRef = ExternalReferenceVO.create({
 *   refType: 'arn',
 *   identifier: 'arn:aws:s3:::my-bucket',
 *   provider: 'aws',
 *   confidence: 1.0,
 * });
 *
 * if (Result.isOk(arnRef)) {
 *   console.log(arnRef.value.referenceHash);
 * }
 * ```
 */
export class ExternalReferenceVO {
  /**
   * Private constructor - use factory methods
   */
  private constructor(
    /** Type of external reference */
    public readonly refType: ExternalRefType,
    /** The reference identifier (e.g., ARN string) */
    public readonly identifier: string,
    /** Cloud provider (if applicable) */
    public readonly provider: CloudProvider | null,
    /** Additional attributes (immutable) */
    public readonly attributes: ReadonlyMap<string, string>,
    /** Confidence score (0.0 to 1.0) */
    public readonly confidence: number
  ) {
    // Freeze attributes to ensure immutability
    Object.freeze(this);
  }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Get the reference hash for lookups
   * Computed lazily and cached via memoization pattern
   */
  get referenceHash(): ReferenceHash {
    return computeReferenceHash(this.refType, this.identifier);
  }

  /**
   * Get normalized identifier for matching
   */
  get normalizedIdentifier(): string {
    return this.identifier.toLowerCase().trim();
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new ExternalReferenceVO with validation
   *
   * @param params - Creation parameters
   * @returns Result containing the value object or validation error
   *
   * @example
   * ```typescript
   * const result = ExternalReferenceVO.create({
   *   refType: 'arn',
   *   identifier: 'arn:aws:s3:::my-bucket',
   *   confidence: 0.95,
   * });
   * ```
   */
  static create(params: CreateExternalReferenceParams): ValidationResult<ExternalReferenceVO> {
    // Validate refType
    if (!isExternalRefType(params.refType)) {
      return Result.err(
        ValidationError.invalidValue('refType', params.refType, 'Unknown reference type')
      );
    }

    // Validate identifier
    if (!params.identifier || typeof params.identifier !== 'string') {
      return Result.err(ValidationError.required('identifier'));
    }

    const trimmedIdentifier = params.identifier.trim();
    if (trimmedIdentifier.length === 0) {
      return Result.err(
        ValidationError.invalidValue('identifier', params.identifier, 'Identifier cannot be empty')
      );
    }

    // Validate identifier format based on type
    const formatValidation = ExternalReferenceVO.validateFormat(
      params.refType,
      trimmedIdentifier
    );
    if (Result.isErr(formatValidation)) {
      return formatValidation;
    }

    // Validate confidence score
    const confidence = params.confidence ?? 1.0;
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      return Result.err(
        ValidationError.invalidValue('confidence', confidence, 'Confidence must be a number')
      );
    }
    if (confidence < 0.0 || confidence > 1.0) {
      return Result.err(ValidationError.outOfRange('confidence', 0.0, 1.0));
    }

    // Convert attributes to ReadonlyMap
    let attributesMap: ReadonlyMap<string, string>;
    if (params.attributes instanceof Map) {
      attributesMap = params.attributes;
    } else if (params.attributes && typeof params.attributes === 'object') {
      attributesMap = new Map(Object.entries(params.attributes));
    } else {
      attributesMap = new Map();
    }

    // Detect provider if not specified
    const provider = params.provider ?? ExternalReferenceVO.detectProvider(
      params.refType,
      trimmedIdentifier
    );

    return Result.ok(
      new ExternalReferenceVO(
        params.refType,
        trimmedIdentifier,
        provider,
        attributesMap,
        confidence
      )
    );
  }

  /**
   * Extract external references from a node
   *
   * @param node - Node to extract references from
   * @returns Array of extracted references
   *
   * @example
   * ```typescript
   * const refs = ExternalReferenceVO.fromNode(terraformResourceNode);
   * // Returns array of ExternalReferenceVO instances
   * ```
   */
  static fromNode(node: NodeReferenceSource): ExternalReferenceVO[] {
    const references: ExternalReferenceVO[] = [];
    const extractors = [
      ExternalReferenceVO.extractArns,
      ExternalReferenceVO.extractResourceIds,
      ExternalReferenceVO.extractK8sReferences,
      ExternalReferenceVO.extractContainerImages,
      ExternalReferenceVO.extractStoragePaths,
    ];

    for (const extractor of extractors) {
      const extracted = extractor(node);
      references.push(...extracted);
    }

    return references;
  }

  /**
   * Reconstitute from persisted data (no validation)
   * Use when loading from trusted source like database
   *
   * @param dto - Data transfer object
   * @returns ExternalReferenceVO instance
   */
  static reconstitute(dto: ExternalReferenceDTO): ExternalReferenceVO {
    return new ExternalReferenceVO(
      dto.refType,
      dto.identifier,
      dto.provider,
      new Map(Object.entries(dto.attributes)),
      dto.confidence
    );
  }

  // ==========================================================================
  // Equality
  // ==========================================================================

  /**
   * Check equality with another ExternalReferenceVO
   * Value objects are equal if their contents are equal
   *
   * @param other - The other value object to compare
   * @returns True if equal
   */
  equals(other: ExternalReferenceVO): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (!(other instanceof ExternalReferenceVO)) {
      return false;
    }

    // Compare by hash for efficiency
    return this.referenceHash === other.referenceHash;
  }

  /**
   * Deep equality check including all properties
   *
   * @param other - The other value object to compare
   * @returns True if deeply equal
   */
  deepEquals(other: ExternalReferenceVO): boolean {
    if (!this.equals(other)) {
      return false;
    }

    // Also compare attributes
    if (this.attributes.size !== other.attributes.size) {
      return false;
    }

    for (const [key, value] of this.attributes) {
      if (other.attributes.get(key) !== value) {
        return false;
      }
    }

    return (
      this.provider === other.provider &&
      this.confidence === other.confidence
    );
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object for serialization
   *
   * @returns Plain object representation
   */
  toJSON(): ExternalReferenceDTO {
    return {
      refType: this.refType,
      identifier: this.identifier,
      provider: this.provider,
      attributes: Object.fromEntries(this.attributes),
      confidence: this.confidence,
      referenceHash: this.referenceHash,
    };
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `ExternalReference(${this.refType}:${this.identifier})`;
  }

  // ==========================================================================
  // Transformation
  // ==========================================================================

  /**
   * Create a copy with updated confidence
   *
   * @param confidence - New confidence score
   * @returns New ExternalReferenceVO with updated confidence
   */
  withConfidence(confidence: number): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: this.refType,
      identifier: this.identifier,
      provider: this.provider,
      attributes: this.attributes,
      confidence,
    });
  }

  /**
   * Create a copy with additional attributes
   *
   * @param attributes - Additional attributes to add
   * @returns New ExternalReferenceVO with merged attributes
   */
  withAttributes(attributes: Record<string, string>): ExternalReferenceVO {
    const merged = new Map(this.attributes);
    for (const [key, value] of Object.entries(attributes)) {
      merged.set(key, value);
    }

    return new ExternalReferenceVO(
      this.refType,
      this.identifier,
      this.provider,
      merged,
      this.confidence
    );
  }

  // ==========================================================================
  // Private Validation Methods
  // ==========================================================================

  /**
   * Validate identifier format based on reference type
   */
  private static validateFormat(
    refType: ExternalRefType,
    identifier: string
  ): ValidationResult<void> {
    switch (refType) {
      case 'arn':
        return ExternalReferenceVO.validateArnFormat(identifier);
      case 'container_image':
        return ExternalReferenceVO.validateContainerImageFormat(identifier);
      case 'git_url':
        return ExternalReferenceVO.validateGitUrlFormat(identifier);
      case 'storage_path':
        return ExternalReferenceVO.validateStoragePathFormat(identifier);
      case 'k8s_reference':
        return ExternalReferenceVO.validateK8sReferenceFormat(identifier);
      case 'resource_id':
      case 'gcp_resource':
      case 'azure_resource':
        // Generic resource IDs have flexible formats
        return Result.ok(undefined);
      default:
        return Result.ok(undefined);
    }
  }

  /**
   * Validate ARN format
   */
  private static validateArnFormat(identifier: string): ValidationResult<void> {
    if (!ARN_PATTERN.test(identifier)) {
      return Result.err(
        ValidationError.invalidFormat(
          'identifier',
          'arn:partition:service:region:account-id:resource'
        )
      );
    }
    return Result.ok(undefined);
  }

  /**
   * Validate container image format
   */
  private static validateContainerImageFormat(identifier: string): ValidationResult<void> {
    if (!CONTAINER_IMAGE_PATTERN.test(identifier)) {
      return Result.err(
        ValidationError.invalidFormat(
          'identifier',
          '[registry/]repository[:tag][@digest]'
        )
      );
    }
    return Result.ok(undefined);
  }

  /**
   * Validate Git URL format
   */
  private static validateGitUrlFormat(identifier: string): ValidationResult<void> {
    const isHttps = GIT_URL_PATTERNS.HTTPS.test(identifier);
    const isSsh = GIT_URL_PATTERNS.SSH.test(identifier);

    if (!isHttps && !isSsh) {
      return Result.err(
        ValidationError.invalidFormat(
          'identifier',
          'https://host/owner/repo or git@host:owner/repo'
        )
      );
    }
    return Result.ok(undefined);
  }

  /**
   * Validate storage path format (S3, GCS, Azure Blob)
   */
  private static validateStoragePathFormat(identifier: string): ValidationResult<void> {
    const isS3 = S3_PATH_PATTERN.test(identifier);
    const isGcs = GCS_PATH_PATTERN.test(identifier);

    if (!isS3 && !isGcs) {
      return Result.err(
        ValidationError.invalidFormat(
          'identifier',
          's3://bucket/path or gs://bucket/path'
        )
      );
    }
    return Result.ok(undefined);
  }

  /**
   * Validate K8s reference format
   */
  private static validateK8sReferenceFormat(identifier: string): ValidationResult<void> {
    if (!K8S_REFERENCE_PATTERN.test(identifier)) {
      return Result.err(
        ValidationError.invalidFormat(
          'identifier',
          '[namespace/]kind/name'
        )
      );
    }
    return Result.ok(undefined);
  }

  // ==========================================================================
  // Private Extraction Methods
  // ==========================================================================

  /**
   * Detect cloud provider from reference
   */
  private static detectProvider(
    refType: ExternalRefType,
    identifier: string
  ): CloudProvider | null {
    switch (refType) {
      case 'arn':
        return CloudProvider.AWS;
      case 'gcp_resource':
        return CloudProvider.GCP;
      case 'azure_resource':
        return CloudProvider.AZURE;
      case 'k8s_reference':
        return CloudProvider.KUBERNETES;
      case 'storage_path':
        if (identifier.startsWith('s3://')) return CloudProvider.AWS;
        if (identifier.startsWith('gs://')) return CloudProvider.GCP;
        if (identifier.includes('.blob.core.windows.net')) return CloudProvider.AZURE;
        return null;
      default:
        return null;
    }
  }

  /**
   * Extract ARN references from node metadata
   */
  private static extractArns(node: NodeReferenceSource): ExternalReferenceVO[] {
    const refs: ExternalReferenceVO[] = [];
    const arnPattern = /arn:[a-z-]+:[a-z0-9-]+:[a-z0-9-]*:[0-9]*:[^\s"'}\]]+/g;

    const searchValues = (obj: unknown, path: string): void => {
      if (typeof obj === 'string') {
        const matches = obj.match(arnPattern);
        if (matches) {
          for (const match of matches) {
            const result = ExternalReferenceVO.create({
              refType: 'arn',
              identifier: match,
              attributes: { sourcePath: path },
              confidence: 1.0,
            });
            if (Result.isOk(result)) {
              refs.push(result.value);
            }
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => searchValues(item, `${path}[${index}]`));
      } else if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          searchValues(value, `${path}.${key}`);
        }
      }
    };

    searchValues(node.metadata, 'metadata');
    return refs;
  }

  /**
   * Extract resource ID references from node metadata
   */
  private static extractResourceIds(node: NodeReferenceSource): ExternalReferenceVO[] {
    const refs: ExternalReferenceVO[] = [];
    const resourceIdKeys = ['id', 'resource_id', 'instance_id', 'cluster_id', 'vpc_id'];

    const extractFromObject = (obj: unknown, path: string): void => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          if (
            resourceIdKeys.some(k => lowerKey.includes(k)) &&
            typeof value === 'string' &&
            value.length > 0
          ) {
            const result = ExternalReferenceVO.create({
              refType: 'resource_id',
              identifier: value,
              attributes: { sourceKey: key, sourcePath: `${path}.${key}` },
              confidence: 0.8,
            });
            if (Result.isOk(result)) {
              refs.push(result.value);
            }
          } else if (typeof value === 'object') {
            extractFromObject(value, `${path}.${key}`);
          }
        }
      }
    };

    extractFromObject(node.metadata, 'metadata');
    return refs;
  }

  /**
   * Extract Kubernetes references from node metadata
   */
  private static extractK8sReferences(node: NodeReferenceSource): ExternalReferenceVO[] {
    const refs: ExternalReferenceVO[] = [];

    // Only process K8s node types
    if (!node.type.startsWith('k8s_')) {
      return refs;
    }

    const namespace = (node.metadata['namespace'] as string) || 'default';
    const kind = node.type.replace('k8s_', '');
    const reference = `${namespace}/${kind}/${node.name}`;

    const result = ExternalReferenceVO.create({
      refType: 'k8s_reference',
      identifier: reference,
      provider: CloudProvider.KUBERNETES,
      attributes: {
        namespace,
        kind,
        name: node.name,
      },
      confidence: 1.0,
    });

    if (Result.isOk(result)) {
      refs.push(result.value);
    }

    return refs;
  }

  /**
   * Extract container image references from node metadata
   */
  private static extractContainerImages(node: NodeReferenceSource): ExternalReferenceVO[] {
    const refs: ExternalReferenceVO[] = [];
    const imageKeys = ['image', 'container_image', 'docker_image'];

    const extractFromObject = (obj: unknown, path: string): void => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          if (
            imageKeys.some(k => lowerKey.includes(k)) &&
            typeof value === 'string' &&
            value.length > 0
          ) {
            const result = ExternalReferenceVO.create({
              refType: 'container_image',
              identifier: value,
              attributes: { sourceKey: key, sourcePath: `${path}.${key}` },
              confidence: 0.9,
            });
            if (Result.isOk(result)) {
              refs.push(result.value);
            }
          } else if (typeof value === 'object') {
            extractFromObject(value, `${path}.${key}`);
          }
        }
      }
    };

    extractFromObject(node.metadata, 'metadata');
    return refs;
  }

  /**
   * Extract storage path references from node metadata
   */
  private static extractStoragePaths(node: NodeReferenceSource): ExternalReferenceVO[] {
    const refs: ExternalReferenceVO[] = [];
    const pathPattern = /(s3|gs):\/\/[\w.-]+(?:\/[^\s"'}\]]+)?/g;

    const searchValues = (obj: unknown, path: string): void => {
      if (typeof obj === 'string') {
        const matches = obj.match(pathPattern);
        if (matches) {
          for (const match of matches) {
            const result = ExternalReferenceVO.create({
              refType: 'storage_path',
              identifier: match,
              attributes: { sourcePath: path },
              confidence: 1.0,
            });
            if (Result.isOk(result)) {
              refs.push(result.value);
            }
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => searchValues(item, `${path}[${index}]`));
      } else if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          searchValues(value, `${path}.${key}`);
        }
      }
    };

    searchValues(node.metadata, 'metadata');
    return refs;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an ARN reference with validation
 *
 * @param arn - The ARN string
 * @param confidence - Optional confidence score (default: 1.0)
 * @returns Result containing the reference or validation error
 */
export function createArnReference(
  arn: string,
  confidence: number = 1.0
): ValidationResult<ExternalReferenceVO> {
  return ExternalReferenceVO.create({
    refType: 'arn',
    identifier: arn,
    provider: CloudProvider.AWS,
    confidence,
  });
}

/**
 * Create a K8s reference with validation
 *
 * @param namespace - Kubernetes namespace
 * @param kind - Resource kind
 * @param name - Resource name
 * @param confidence - Optional confidence score (default: 1.0)
 * @returns Result containing the reference or validation error
 */
export function createK8sReference(
  namespace: string,
  kind: string,
  name: string,
  confidence: number = 1.0
): ValidationResult<ExternalReferenceVO> {
  const identifier = `${namespace}/${kind}/${name}`;
  return ExternalReferenceVO.create({
    refType: 'k8s_reference',
    identifier,
    provider: CloudProvider.KUBERNETES,
    attributes: { namespace, kind, name },
    confidence,
  });
}

/**
 * Create a container image reference with validation
 *
 * @param image - The container image reference
 * @param confidence - Optional confidence score (default: 1.0)
 * @returns Result containing the reference or validation error
 */
export function createContainerImageReference(
  image: string,
  confidence: number = 1.0
): ValidationResult<ExternalReferenceVO> {
  return ExternalReferenceVO.create({
    refType: 'container_image',
    identifier: image,
    confidence,
  });
}

/**
 * Create a storage path reference with validation
 *
 * @param path - The storage path (s3:// or gs://)
 * @param confidence - Optional confidence score (default: 1.0)
 * @returns Result containing the reference or validation error
 */
export function createStoragePathReference(
  path: string,
  confidence: number = 1.0
): ValidationResult<ExternalReferenceVO> {
  return ExternalReferenceVO.create({
    refType: 'storage_path',
    identifier: path,
    confidence,
  });
}
