/**
 * ARN Extractor
 * @module services/rollup/external-object-index/extractors/arn-extractor
 *
 * Extracts AWS ARN (Amazon Resource Name) references from nodes.
 * Supports various ARN formats and partial ARN matching.
 *
 * ARN Format: arn:partition:service:region:account-id:resource-type/resource-id
 *
 * TASK-ROLLUP-003: External Object Index ARN extraction
 */

import { NodeType } from '../../../../types/graph.js';
import type { ExtractedReference } from '../interfaces.js';
import { BaseExtractor } from './base-extractor.js';

/**
 * Parsed ARN structure
 */
interface ParsedArn {
  readonly partition: string;
  readonly service: string;
  readonly region: string;
  readonly account: string;
  readonly resource: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}

/**
 * ARN reference extractor for AWS resources.
 * Extracts and normalizes ARN references from Terraform and other IaC nodes.
 */
export class ArnExtractor extends BaseExtractor {
  readonly referenceType = 'arn' as const;

  protected readonly supportedNodeTypes = [
    'terraform_resource',
    'terraform_data',
    'terraform_module',
    'terraform_output',
    'terraform_local',
  ];

  protected readonly searchAttributes = [
    'arn',
    'resource_arn',
    'target_arn',
    'function_arn',
    'bucket_arn',
    'role_arn',
    'topic_arn',
    'queue_arn',
    'stream_arn',
    'table_arn',
    'cluster_arn',
    'task_definition_arn',
    'execution_role_arn',
    'task_role_arn',
    'kms_key_arn',
    'certificate_arn',
    'sns_topic_arn',
    'sqs_queue_arn',
    'lambda_function_arn',
    'attributes.arn',
    'attributes.resource_arn',
    'computed.arn',
  ];

  /**
   * ARN regex pattern
   */
  private readonly arnPattern = /^arn:([a-z-]+):([a-z0-9-]+):([a-z0-9-]*):([0-9]*):(.+)$/;

  /**
   * Pattern to find ARNs in any string
   */
  private readonly arnSearchPattern = /arn:[a-z-]+:[a-z0-9-]+:[a-z0-9-]*:[0-9]*:[^\s"'}\]]+/g;

  /**
   * Normalize ARN for consistent matching
   */
  normalize(externalId: string): string {
    const parsed = this.parseArn(externalId);
    if (!parsed) {
      return externalId.toLowerCase().trim();
    }

    // Normalize to lowercase, remove region and account for cross-region matching
    return `arn:${parsed.partition}:${parsed.service}:::${parsed.resource}`.toLowerCase();
  }

  /**
   * Parse ARN into components
   */
  parseComponents(externalId: string): Record<string, string> | null {
    const parsed = this.parseArn(externalId);
    if (!parsed) {
      return null;
    }

    const components: Record<string, string> = {
      partition: parsed.partition,
      service: parsed.service,
      region: parsed.region || '',
      account: parsed.account || '',
      resource: parsed.resource,
    };

    if (parsed.resourceType) {
      components['resourceType'] = parsed.resourceType;
    }
    if (parsed.resourceId) {
      components['resourceId'] = parsed.resourceId;
    }

    return components;
  }

  /**
   * Check if value is a valid ARN
   */
  protected isValidExternalId(value: string): boolean {
    return this.arnPattern.test(value);
  }

  /**
   * Extract references from a value
   */
  protected extractFromValue(
    value: unknown,
    sourceAttribute: string
  ): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    if (typeof value === 'string') {
      // Direct ARN value
      if (this.isValidExternalId(value)) {
        references.push(this.createReference(value, sourceAttribute));
      } else {
        // Search for ARNs within the string
        const matches = value.match(this.arnSearchPattern);
        if (matches) {
          for (const match of matches) {
            references.push(
              this.createReference(match, sourceAttribute, {
                extractedFrom: 'embedded',
              })
            );
          }
        }
      }
    } else if (Array.isArray(value)) {
      // Array of ARNs
      for (const item of value) {
        if (typeof item === 'string' && this.isValidExternalId(item)) {
          references.push(
            this.createReference(item, sourceAttribute, { fromArray: true })
          );
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      // Search object for ARN values
      const strings = this.findAllStrings(value, sourceAttribute);
      for (const { path, value: strValue } of strings) {
        const matches = strValue.match(this.arnSearchPattern);
        if (matches) {
          for (const match of matches) {
            references.push(this.createReference(match, path));
          }
        }
      }
    }

    return references;
  }

  /**
   * Extract ARNs from node-specific fields
   */
  protected extractFromNodeFields(node: NodeType): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // For Terraform resources, check the resource type for AWS
    if (node.type === 'terraform_resource' && 'resourceType' in node) {
      const resourceType = (node as { resourceType: string }).resourceType;

      // Check if this is an AWS resource
      if (resourceType.startsWith('aws_')) {
        // Try to construct ARN from resource attributes
        const constructedArn = this.constructArnFromResource(node);
        if (constructedArn) {
          references.push(
            this.createReference(constructedArn, 'constructed', {
              source: 'resource_inference',
            })
          );
        }
      }
    }

    // Scan all metadata for any ARN patterns
    const allStrings = this.findAllStrings(node.metadata, 'metadata');
    for (const { path, value } of allStrings) {
      const matches = value.match(this.arnSearchPattern);
      if (matches) {
        for (const match of matches) {
          // Avoid duplicates from searchAttributes
          if (!this.searchAttributes.some((attr) => path.endsWith(attr))) {
            references.push(
              this.createReference(match, path, { discovered: true })
            );
          }
        }
      }
    }

    return references;
  }

  /**
   * Parse an ARN string into its components
   */
  private parseArn(arn: string): ParsedArn | null {
    if (!arn || !arn.startsWith('arn:')) {
      return null;
    }

    const match = arn.match(this.arnPattern);
    if (!match) {
      return null;
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

    return {
      partition,
      service,
      region,
      account,
      resource,
      resourceType,
      resourceId,
    };
  }

  /**
   * Attempt to construct an ARN from resource attributes
   */
  private constructArnFromResource(node: NodeType): string | null {
    if (node.type !== 'terraform_resource' || !('resourceType' in node)) {
      return null;
    }

    const resourceType = (node as { resourceType: string }).resourceType;
    const metadata = node.metadata;

    // Get common attributes
    const region = this.getNestedValue(metadata, 'region') as string | undefined;
    const accountId = this.getNestedValue(metadata, 'account_id') as string | undefined;

    // Map Terraform resource types to ARN service names
    const serviceMap: Record<string, string> = {
      'aws_instance': 'ec2',
      'aws_s3_bucket': 's3',
      'aws_lambda_function': 'lambda',
      'aws_sqs_queue': 'sqs',
      'aws_sns_topic': 'sns',
      'aws_dynamodb_table': 'dynamodb',
      'aws_rds_cluster': 'rds',
      'aws_ecs_cluster': 'ecs',
      'aws_ecs_service': 'ecs',
      'aws_iam_role': 'iam',
      'aws_iam_policy': 'iam',
    };

    const service = serviceMap[resourceType];
    if (!service) {
      return null;
    }

    // Get resource name
    const name = node.name || (this.getNestedValue(metadata, 'name') as string);
    if (!name) {
      return null;
    }

    // Construct ARN based on service type
    const partition = 'aws';
    const regionPart = region || '*';
    const accountPart = accountId || '*';

    // Different services have different ARN formats
    switch (service) {
      case 's3':
        return `arn:${partition}:s3:::${name}`;
      case 'iam':
        return resourceType.includes('role')
          ? `arn:${partition}:iam::${accountPart}:role/${name}`
          : `arn:${partition}:iam::${accountPart}:policy/${name}`;
      case 'lambda':
        return `arn:${partition}:lambda:${regionPart}:${accountPart}:function:${name}`;
      case 'dynamodb':
        return `arn:${partition}:dynamodb:${regionPart}:${accountPart}:table/${name}`;
      case 'sqs':
        return `arn:${partition}:sqs:${regionPart}:${accountPart}:${name}`;
      case 'sns':
        return `arn:${partition}:sns:${regionPart}:${accountPart}:${name}`;
      default:
        return null;
    }
  }
}

/**
 * Create an ArnExtractor instance
 */
export function createArnExtractor(): ArnExtractor {
  return new ArnExtractor();
}
