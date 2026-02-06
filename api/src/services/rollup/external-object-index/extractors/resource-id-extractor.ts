/**
 * Resource ID Extractor
 * @module services/rollup/external-object-index/extractors/resource-id-extractor
 *
 * Extracts cloud resource ID references from nodes.
 * Supports AWS, GCP, and Azure resource ID formats.
 *
 * TASK-ROLLUP-003: External Object Index resource ID extraction
 */

import { NodeType } from '../../../../types/graph.js';
import type { ExtractedReference } from '../interfaces.js';
import { BaseExtractor } from './base-extractor.js';

/**
 * Cloud provider detection
 */
type CloudProvider = 'aws' | 'gcp' | 'azure' | 'unknown';

/**
 * Resource ID patterns by provider
 */
interface ResourceIdPattern {
  readonly provider: CloudProvider;
  readonly pattern: RegExp;
  readonly prefix: string;
}

/**
 * Resource ID extractor for cloud resources.
 * Handles various cloud provider resource ID formats.
 */
export class ResourceIdExtractor extends BaseExtractor {
  readonly referenceType = 'resource_id' as const;

  protected readonly supportedNodeTypes = [
    'terraform_resource',
    'terraform_data',
    'terraform_module',
    'terraform_output',
    'terraform_local',
    'terraform_variable',
  ];

  protected readonly searchAttributes = [
    'id',
    'resource_id',
    'instance_id',
    'subnet_id',
    'vpc_id',
    'security_group_id',
    'volume_id',
    'snapshot_id',
    'image_id',
    'ami',
    'launch_template_id',
    'cluster_id',
    'node_group_id',
    'service_id',
    'task_id',
    'load_balancer_id',
    'target_group_id',
    'db_instance_identifier',
    'db_cluster_identifier',
    'self_link',
    'project',
    'zone',
    'attributes.id',
    'attributes.resource_id',
    'computed.id',
  ];

  /**
   * Resource ID patterns for various cloud providers
   */
  private readonly patterns: ResourceIdPattern[] = [
    // AWS EC2 resources
    { provider: 'aws', pattern: /^i-[0-9a-f]{8,17}$/, prefix: 'i-' },
    { provider: 'aws', pattern: /^vol-[0-9a-f]{8,17}$/, prefix: 'vol-' },
    { provider: 'aws', pattern: /^snap-[0-9a-f]{8,17}$/, prefix: 'snap-' },
    { provider: 'aws', pattern: /^ami-[0-9a-f]{8,17}$/, prefix: 'ami-' },
    { provider: 'aws', pattern: /^vpc-[0-9a-f]{8,17}$/, prefix: 'vpc-' },
    { provider: 'aws', pattern: /^subnet-[0-9a-f]{8,17}$/, prefix: 'subnet-' },
    { provider: 'aws', pattern: /^sg-[0-9a-f]{8,17}$/, prefix: 'sg-' },
    { provider: 'aws', pattern: /^rtb-[0-9a-f]{8,17}$/, prefix: 'rtb-' },
    { provider: 'aws', pattern: /^igw-[0-9a-f]{8,17}$/, prefix: 'igw-' },
    { provider: 'aws', pattern: /^nat-[0-9a-f]{8,17}$/, prefix: 'nat-' },
    { provider: 'aws', pattern: /^eni-[0-9a-f]{8,17}$/, prefix: 'eni-' },
    { provider: 'aws', pattern: /^acl-[0-9a-f]{8,17}$/, prefix: 'acl-' },
    { provider: 'aws', pattern: /^eipalloc-[0-9a-f]{8,17}$/, prefix: 'eipalloc-' },
    { provider: 'aws', pattern: /^lt-[0-9a-f]{8,17}$/, prefix: 'lt-' },
    { provider: 'aws', pattern: /^asg-[0-9a-f]{8,17}$/, prefix: 'asg-' },
    // AWS EKS/ECS
    { provider: 'aws', pattern: /^cluster\/[a-zA-Z0-9_-]+$/, prefix: 'cluster/' },
    // GCP resources
    { provider: 'gcp', pattern: /^projects\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/, prefix: 'projects/' },
    { provider: 'gcp', pattern: /^https:\/\/www\.googleapis\.com\/compute\/v1\/projects\//, prefix: 'https://' },
    // Azure resources
    { provider: 'azure', pattern: /^\/subscriptions\/[0-9a-f-]+\//, prefix: '/subscriptions/' },
  ];

  /**
   * Pattern to detect resource IDs in strings
   */
  private readonly resourceIdSearchPatterns = [
    // AWS patterns
    /\b(i|vol|snap|ami|vpc|subnet|sg|rtb|igw|nat|eni|acl|eipalloc|lt|asg)-[0-9a-f]{8,17}\b/g,
    // GCP self_link pattern
    /https:\/\/www\.googleapis\.com\/compute\/v1\/projects\/[^\s"']+/g,
    // Azure resource ID pattern
    /\/subscriptions\/[0-9a-f-]+\/resourceGroups\/[^\s"']+/g,
  ];

  /**
   * Normalize resource ID for consistent matching
   */
  normalize(externalId: string): string {
    // Remove protocol for GCP self-links
    let normalized = externalId;
    if (normalized.startsWith('https://')) {
      normalized = normalized.replace('https://www.googleapis.com/compute/v1/', '');
    }

    // Lowercase for case-insensitive matching
    return normalized.toLowerCase().trim();
  }

  /**
   * Parse resource ID into components
   */
  parseComponents(externalId: string): Record<string, string> | null {
    const provider = this.detectProvider(externalId);
    const components: Record<string, string> = {
      provider,
      raw: externalId,
    };

    switch (provider) {
      case 'aws':
        return this.parseAwsComponents(externalId, components);
      case 'gcp':
        return this.parseGcpComponents(externalId, components);
      case 'azure':
        return this.parseAzureComponents(externalId, components);
      default:
        return components;
    }
  }

  /**
   * Check if value is a valid resource ID
   */
  protected isValidExternalId(value: string): boolean {
    return this.patterns.some((p) => p.pattern.test(value));
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
      // Direct resource ID value
      if (this.isValidExternalId(value)) {
        const provider = this.detectProvider(value);
        references.push(
          this.createReference(value, sourceAttribute, { provider })
        );
      } else {
        // Search for resource IDs within the string
        for (const pattern of this.resourceIdSearchPatterns) {
          const matches = value.match(pattern);
          if (matches) {
            for (const match of matches) {
              const provider = this.detectProvider(match);
              references.push(
                this.createReference(match, sourceAttribute, {
                  provider,
                  extractedFrom: 'embedded',
                })
              );
            }
          }
        }
      }
    } else if (Array.isArray(value)) {
      // Array of resource IDs
      for (const item of value) {
        if (typeof item === 'string') {
          const refs = this.extractFromValue(item, sourceAttribute);
          references.push(...refs);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      // Search object for resource ID values
      const strings = this.findAllStrings(value, sourceAttribute);
      for (const { path, value: strValue } of strings) {
        const refs = this.extractFromValue(strValue, path);
        references.push(...refs);
      }
    }

    return references;
  }

  /**
   * Extract resource IDs from node-specific fields
   */
  protected extractFromNodeFields(node: NodeType): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // For Terraform resources, check resource type specific IDs
    if (node.type === 'terraform_resource' && 'resourceType' in node) {
      const resourceType = (node as { resourceType: string }).resourceType;
      const metadata = node.metadata;

      // Map of resource types to ID attributes
      const idAttributes: Record<string, string[]> = {
        'aws_instance': ['id', 'instance_id'],
        'aws_vpc': ['id', 'vpc_id'],
        'aws_subnet': ['id', 'subnet_id'],
        'aws_security_group': ['id', 'security_group_id'],
        'aws_s3_bucket': ['id', 'bucket'],
        'aws_db_instance': ['id', 'identifier', 'db_instance_identifier'],
        'aws_rds_cluster': ['id', 'cluster_identifier'],
        'google_compute_instance': ['self_link', 'instance_id'],
        'google_compute_network': ['self_link', 'id'],
        'azurerm_virtual_machine': ['id'],
        'azurerm_resource_group': ['id'],
      };

      const attrs = idAttributes[resourceType];
      if (attrs) {
        for (const attr of attrs) {
          const value = this.getNestedValue(metadata, attr) as string | undefined;
          if (value && this.isValidExternalId(value)) {
            const provider = this.detectProvider(value);
            references.push(
              this.createReference(value, `resource.${attr}`, {
                provider,
                resourceType,
              })
            );
          }
        }
      }
    }

    return references;
  }

  /**
   * Detect cloud provider from resource ID
   */
  private detectProvider(resourceId: string): CloudProvider {
    for (const pattern of this.patterns) {
      if (resourceId.startsWith(pattern.prefix) || pattern.pattern.test(resourceId)) {
        return pattern.provider;
      }
    }
    return 'unknown';
  }

  /**
   * Parse AWS resource ID components
   */
  private parseAwsComponents(
    resourceId: string,
    components: Record<string, string>
  ): Record<string, string> {
    // Extract prefix (resource type indicator)
    const prefixMatch = resourceId.match(/^([a-z]+)-/);
    if (prefixMatch) {
      components['resourceType'] = prefixMatch[1];
      components['resourceId'] = resourceId.substring(prefixMatch[0].length);
    }

    // Map prefixes to AWS resource types
    const prefixMap: Record<string, string> = {
      'i': 'instance',
      'vol': 'volume',
      'snap': 'snapshot',
      'ami': 'ami',
      'vpc': 'vpc',
      'subnet': 'subnet',
      'sg': 'security_group',
      'rtb': 'route_table',
      'igw': 'internet_gateway',
      'nat': 'nat_gateway',
      'eni': 'network_interface',
      'acl': 'network_acl',
      'eipalloc': 'elastic_ip',
      'lt': 'launch_template',
      'asg': 'autoscaling_group',
    };

    if (components['resourceType'] && prefixMap[components['resourceType']]) {
      components['awsResourceType'] = prefixMap[components['resourceType']];
    }

    return components;
  }

  /**
   * Parse GCP resource ID components
   */
  private parseGcpComponents(
    resourceId: string,
    components: Record<string, string>
  ): Record<string, string> {
    // Handle self_link format
    if (resourceId.startsWith('https://')) {
      const url = resourceId.replace('https://www.googleapis.com/compute/v1/', '');
      const parts = url.split('/');

      if (parts.length >= 2 && parts[0] === 'projects') {
        components['project'] = parts[1];

        if (parts.length >= 4) {
          components['resourceType'] = parts[2];
          components['zone'] = parts[3];
        }

        if (parts.length >= 6) {
          components['resourceKind'] = parts[4];
          components['resourceName'] = parts[5];
        }
      }
    } else if (resourceId.startsWith('projects/')) {
      const parts = resourceId.split('/');
      if (parts.length >= 2) {
        components['project'] = parts[1];
      }
      if (parts.length >= 4) {
        components['resourceType'] = parts[2];
        components['resourceName'] = parts[3];
      }
    }

    return components;
  }

  /**
   * Parse Azure resource ID components
   */
  private parseAzureComponents(
    resourceId: string,
    components: Record<string, string>
  ): Record<string, string> {
    // Azure resource ID format:
    // /subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{type}/{name}
    const parts = resourceId.split('/').filter((p) => p.length > 0);

    for (let i = 0; i < parts.length - 1; i += 2) {
      const key = parts[i].toLowerCase();
      const value = parts[i + 1];

      switch (key) {
        case 'subscriptions':
          components['subscription'] = value;
          break;
        case 'resourcegroups':
          components['resourceGroup'] = value;
          break;
        case 'providers':
          components['provider'] = value;
          break;
        default:
          // Resource type and name
          if (i >= 6) {
            components['resourceType'] = key;
            components['resourceName'] = value;
          }
      }
    }

    return components;
  }
}

/**
 * Create a ResourceIdExtractor instance
 */
export function createResourceIdExtractor(): ResourceIdExtractor {
  return new ResourceIdExtractor();
}
