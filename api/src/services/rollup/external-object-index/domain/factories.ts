/**
 * Domain Factories for External Object Index
 * @module services/rollup/external-object-index/domain/factories
 *
 * Factory implementations for creating and reconstituting domain entities.
 * Provides centralized creation logic with validation and dependency injection support.
 *
 * TASK-ROLLUP-003: Domain layer factory implementations
 */

import { randomUUID } from 'crypto';
import { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';
import { NodeType } from '../../../../types/graph.js';
import { Result, ValidationResult, ValidationError } from './result.js';
import { ExternalReferenceVO } from './external-reference.js';
import { IndexEntryAggregate, createIndexEntryWithReferences } from './index-entry.js';
import {
  ExternalRefType,
  CloudProvider,
  IndexEntryId,
  createIndexEntryId,
  ExternalReferenceDTO,
  IndexEntryDTO,
  NodeReferenceSource,
} from './types.js';

// ============================================================================
// Factory Interfaces
// ============================================================================

/**
 * Interface for ID generation (for testing/DI)
 */
export interface IdGenerator {
  generate(): string;
}

/**
 * Default UUID generator
 */
export const defaultIdGenerator: IdGenerator = {
  generate: () => randomUUID(),
};

// ============================================================================
// External Reference Factory
// ============================================================================

/**
 * Factory for creating ExternalReferenceVO instances.
 * Provides various creation methods for different reference types.
 */
export class ExternalReferenceFactory {
  /**
   * Create an ARN reference
   *
   * @param arn - AWS ARN string
   * @param confidence - Confidence score (default: 1.0)
   * @returns Result containing the reference or validation error
   */
  createArn(arn: string, confidence: number = 1.0): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: 'arn',
      identifier: arn,
      provider: CloudProvider.AWS,
      confidence,
    });
  }

  /**
   * Create a resource ID reference
   *
   * @param resourceId - Resource identifier
   * @param provider - Cloud provider (optional)
   * @param confidence - Confidence score (default: 0.8)
   * @returns Result containing the reference or validation error
   */
  createResourceId(
    resourceId: string,
    provider?: CloudProvider,
    confidence: number = 0.8
  ): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: 'resource_id',
      identifier: resourceId,
      provider,
      confidence,
    });
  }

  /**
   * Create a Kubernetes reference
   *
   * @param namespace - K8s namespace
   * @param kind - Resource kind
   * @param name - Resource name
   * @param confidence - Confidence score (default: 1.0)
   * @returns Result containing the reference or validation error
   */
  createK8sReference(
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
   * Create a container image reference
   *
   * @param image - Container image reference
   * @param confidence - Confidence score (default: 0.9)
   * @returns Result containing the reference or validation error
   */
  createContainerImage(
    image: string,
    confidence: number = 0.9
  ): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: 'container_image',
      identifier: image,
      confidence,
    });
  }

  /**
   * Create a storage path reference (S3, GCS)
   *
   * @param path - Storage path (s3:// or gs://)
   * @param confidence - Confidence score (default: 1.0)
   * @returns Result containing the reference or validation error
   */
  createStoragePath(
    path: string,
    confidence: number = 1.0
  ): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: 'storage_path',
      identifier: path,
      confidence,
    });
  }

  /**
   * Create a GCP resource reference
   *
   * @param resourceId - GCP resource identifier
   * @param confidence - Confidence score (default: 1.0)
   * @returns Result containing the reference or validation error
   */
  createGcpResource(
    resourceId: string,
    confidence: number = 1.0
  ): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: 'gcp_resource',
      identifier: resourceId,
      provider: CloudProvider.GCP,
      confidence,
    });
  }

  /**
   * Create an Azure resource reference
   *
   * @param resourceId - Azure resource identifier
   * @param confidence - Confidence score (default: 1.0)
   * @returns Result containing the reference or validation error
   */
  createAzureResource(
    resourceId: string,
    confidence: number = 1.0
  ): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: 'azure_resource',
      identifier: resourceId,
      provider: CloudProvider.AZURE,
      confidence,
    });
  }

  /**
   * Create a Git URL reference
   *
   * @param url - Git repository URL
   * @param confidence - Confidence score (default: 1.0)
   * @returns Result containing the reference or validation error
   */
  createGitUrl(
    url: string,
    confidence: number = 1.0
  ): ValidationResult<ExternalReferenceVO> {
    return ExternalReferenceVO.create({
      refType: 'git_url',
      identifier: url,
      confidence,
    });
  }

  /**
   * Reconstitute a reference from persisted data
   *
   * @param dto - Data transfer object
   * @returns ExternalReferenceVO instance
   */
  reconstitute(dto: ExternalReferenceDTO): ExternalReferenceVO {
    return ExternalReferenceVO.reconstitute(dto);
  }

  /**
   * Extract references from a graph node
   *
   * @param node - Graph node to extract from
   * @returns Array of extracted references
   */
  extractFromNode(node: NodeType): ExternalReferenceVO[] {
    const source: NodeReferenceSource = {
      id: node.id,
      type: node.type,
      name: node.name,
      metadata: node.metadata,
      location: node.location,
    };
    return ExternalReferenceVO.fromNode(source);
  }
}

// ============================================================================
// Index Entry Factory
// ============================================================================

/**
 * Factory for creating IndexEntryAggregate instances.
 * Handles creation, extraction, and reconstitution.
 */
export class IndexEntryFactory {
  private readonly referenceFactory: ExternalReferenceFactory;
  private readonly idGenerator: IdGenerator;

  /**
   * Create an IndexEntryFactory
   *
   * @param deps - Optional dependencies for DI
   */
  constructor(deps?: {
    referenceFactory?: ExternalReferenceFactory;
    idGenerator?: IdGenerator;
  }) {
    this.referenceFactory = deps?.referenceFactory ?? new ExternalReferenceFactory();
    this.idGenerator = deps?.idGenerator ?? defaultIdGenerator;
  }

  /**
   * Create an empty index entry
   *
   * @param params - Entry parameters
   * @returns Result containing the entry or validation error
   */
  create(params: {
    nodeId: string;
    scanId: ScanId;
    repositoryId: RepositoryId;
    tenantId: TenantId;
  }): ValidationResult<IndexEntryAggregate> {
    return IndexEntryAggregate.create({
      id: this.idGenerator.generate(),
      nodeId: params.nodeId,
      scanId: params.scanId,
      repositoryId: params.repositoryId,
      tenantId: params.tenantId,
    });
  }

  /**
   * Create an index entry with references
   *
   * @param params - Entry parameters
   * @param references - Initial references
   * @returns Result containing the entry or validation error
   */
  createWithReferences(
    params: {
      nodeId: string;
      scanId: ScanId;
      repositoryId: RepositoryId;
      tenantId: TenantId;
    },
    references: ExternalReferenceVO[]
  ): ValidationResult<IndexEntryAggregate> {
    return createIndexEntryWithReferences(
      {
        id: this.idGenerator.generate(),
        nodeId: params.nodeId,
        scanId: params.scanId,
        repositoryId: params.repositoryId,
        tenantId: params.tenantId,
      },
      references
    );
  }

  /**
   * Create an index entry from a graph node by extracting references
   *
   * @param node - Graph node to process
   * @param context - Processing context
   * @returns Result containing the entry or validation error
   */
  createFromNode(
    node: NodeType,
    context: {
      scanId: ScanId;
      repositoryId: RepositoryId;
      tenantId: TenantId;
    }
  ): ValidationResult<IndexEntryAggregate> {
    const references = this.referenceFactory.extractFromNode(node);

    return this.createWithReferences(
      {
        nodeId: node.id,
        scanId: context.scanId,
        repositoryId: context.repositoryId,
        tenantId: context.tenantId,
      },
      references
    );
  }

  /**
   * Create index entries from multiple nodes in batch
   *
   * @param nodes - Array of graph nodes
   * @param context - Processing context
   * @returns Array of Results for each entry
   */
  createBatch(
    nodes: NodeType[],
    context: {
      scanId: ScanId;
      repositoryId: RepositoryId;
      tenantId: TenantId;
    }
  ): ValidationResult<IndexEntryAggregate>[] {
    return nodes.map(node => this.createFromNode(node, context));
  }

  /**
   * Create successful entries only from a batch (filter errors)
   *
   * @param nodes - Array of graph nodes
   * @param context - Processing context
   * @returns Array of successfully created entries
   */
  createBatchSuccessful(
    nodes: NodeType[],
    context: {
      scanId: ScanId;
      repositoryId: RepositoryId;
      tenantId: TenantId;
    }
  ): {
    entries: IndexEntryAggregate[];
    errors: Array<{ nodeId: string; error: ValidationError }>;
  } {
    const results = this.createBatch(nodes, context);
    const entries: IndexEntryAggregate[] = [];
    const errors: Array<{ nodeId: string; error: ValidationError }> = [];

    results.forEach((result, index) => {
      if (Result.isOk(result)) {
        entries.push(result.value);
      } else {
        errors.push({
          nodeId: nodes[index].id,
          error: result.error,
        });
      }
    });

    return { entries, errors };
  }

  /**
   * Reconstitute an index entry from persisted data
   *
   * @param dto - Data transfer object
   * @returns IndexEntryAggregate instance
   */
  reconstitute(dto: IndexEntryDTO): IndexEntryAggregate {
    const references = dto.references.map(refDto =>
      this.referenceFactory.reconstitute(refDto)
    );

    return IndexEntryAggregate.reconstitute({
      id: dto.id,
      nodeId: dto.nodeId,
      scanId: dto.scanId,
      repositoryId: dto.repositoryId,
      tenantId: dto.tenantId,
      references,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
    });
  }

  /**
   * Reconstitute multiple entries from persisted data
   *
   * @param dtos - Array of data transfer objects
   * @returns Array of IndexEntryAggregate instances
   */
  reconstituteBatch(dtos: IndexEntryDTO[]): IndexEntryAggregate[] {
    return dtos.map(dto => this.reconstitute(dto));
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

/**
 * Get the default ExternalReferenceFactory instance
 */
let defaultReferenceFactory: ExternalReferenceFactory | null = null;

export function getDefaultReferenceFactory(): ExternalReferenceFactory {
  if (!defaultReferenceFactory) {
    defaultReferenceFactory = new ExternalReferenceFactory();
  }
  return defaultReferenceFactory;
}

/**
 * Get the default IndexEntryFactory instance
 */
let defaultEntryFactory: IndexEntryFactory | null = null;

export function getDefaultEntryFactory(): IndexEntryFactory {
  if (!defaultEntryFactory) {
    defaultEntryFactory = new IndexEntryFactory({
      referenceFactory: getDefaultReferenceFactory(),
    });
  }
  return defaultEntryFactory;
}

/**
 * Reset factories (for testing)
 */
export function resetFactories(): void {
  defaultReferenceFactory = null;
  defaultEntryFactory = null;
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create an ARN reference using the default factory
 */
export function createArnRef(
  arn: string,
  confidence?: number
): ValidationResult<ExternalReferenceVO> {
  return getDefaultReferenceFactory().createArn(arn, confidence);
}

/**
 * Create a K8s reference using the default factory
 */
export function createK8sRef(
  namespace: string,
  kind: string,
  name: string,
  confidence?: number
): ValidationResult<ExternalReferenceVO> {
  return getDefaultReferenceFactory().createK8sReference(namespace, kind, name, confidence);
}

/**
 * Create an index entry from a node using the default factory
 */
export function createEntryFromNode(
  node: NodeType,
  context: {
    scanId: ScanId;
    repositoryId: RepositoryId;
    tenantId: TenantId;
  }
): ValidationResult<IndexEntryAggregate> {
  return getDefaultEntryFactory().createFromNode(node, context);
}
