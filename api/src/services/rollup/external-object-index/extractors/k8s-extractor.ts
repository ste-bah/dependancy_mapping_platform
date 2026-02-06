/**
 * Kubernetes Reference Extractor
 * @module services/rollup/external-object-index/extractors/k8s-extractor
 *
 * Extracts Kubernetes resource references from nodes.
 * Supports ConfigMap, Secret, Service, and other K8s resource references.
 *
 * TASK-ROLLUP-003: External Object Index K8s extraction
 */

import { NodeType } from '../../../../types/graph.js';
import type { ExtractedReference } from '../interfaces.js';
import { BaseExtractor } from './base-extractor.js';

/**
 * Kubernetes reference types
 */
type K8sReferenceKind =
  | 'ConfigMap'
  | 'Secret'
  | 'Service'
  | 'ServiceAccount'
  | 'PersistentVolumeClaim'
  | 'Role'
  | 'ClusterRole'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'Namespace'
  | 'Unknown';

/**
 * Kubernetes reference extractor.
 * Extracts references to K8s resources from deployment configurations.
 */
export class K8sExtractor extends BaseExtractor {
  readonly referenceType = 'k8s_reference' as const;

  protected readonly supportedNodeTypes = [
    'k8s_deployment',
    'k8s_service',
    'k8s_configmap',
    'k8s_secret',
    'k8s_ingress',
    'k8s_pod',
    'k8s_statefulset',
    'k8s_daemonset',
    'k8s_job',
    'k8s_cronjob',
    'k8s_serviceaccount',
    'k8s_role',
    'k8s_rolebinding',
    'k8s_clusterrole',
    'k8s_clusterrolebinding',
    'k8s_persistentvolumeclaim',
    'k8s_networkpolicy',
    'helm_release',
    'helm_chart',
  ];

  protected readonly searchAttributes = [
    'configMapRef',
    'secretRef',
    'serviceAccountName',
    'serviceName',
    'claimName',
    'roleRef.name',
    'subjects',
    'selector',
    'envFrom',
    'volumeMounts',
    'volumes',
    'containers',
    'spec.serviceName',
    'spec.selector',
    'spec.template.spec.serviceAccountName',
  ];

  /**
   * Normalize K8s reference for consistent matching
   */
  normalize(externalId: string): string {
    // Format: namespace/kind/name -> normalized to lowercase
    return externalId.toLowerCase().trim();
  }

  /**
   * Parse K8s reference into components
   */
  parseComponents(externalId: string): Record<string, string> | null {
    // Expected format: namespace/kind/name or kind/name
    const parts = externalId.split('/');

    if (parts.length === 3) {
      return {
        namespace: parts[0],
        kind: parts[1],
        name: parts[2],
      };
    } else if (parts.length === 2) {
      return {
        namespace: 'default',
        kind: parts[0],
        name: parts[1],
      };
    } else if (parts.length === 1) {
      return {
        namespace: 'default',
        kind: 'Unknown',
        name: parts[0],
      };
    }

    return null;
  }

  /**
   * Check if value is a valid K8s reference
   */
  protected isValidExternalId(value: string): boolean {
    // K8s names must match DNS subdomain naming rules
    const namePattern = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    const parts = value.split('/');

    if (parts.length > 3 || parts.length === 0) {
      return false;
    }

    // Check each part is a valid K8s name
    return parts.every((part) => namePattern.test(part) || this.isValidKind(part));
  }

  /**
   * Check if value is a valid K8s resource kind
   */
  private isValidKind(value: string): boolean {
    const validKinds = [
      'configmap',
      'secret',
      'service',
      'serviceaccount',
      'persistentvolumeclaim',
      'pvc',
      'role',
      'clusterrole',
      'deployment',
      'statefulset',
      'daemonset',
      'namespace',
      'pod',
      'job',
      'cronjob',
      'ingress',
      'networkpolicy',
    ];
    return validKinds.includes(value.toLowerCase());
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
      if (this.isValidExternalId(value)) {
        references.push(this.createReference(value, sourceAttribute));
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle K8s reference objects
      const obj = value as Record<string, unknown>;

      // ConfigMapRef/SecretRef
      if ('name' in obj && typeof obj['name'] === 'string') {
        const kind = this.inferKindFromAttribute(sourceAttribute);
        const refId = this.buildReference(obj['name'], kind);
        references.push(
          this.createReference(refId, sourceAttribute, { kind })
        );
      }

      // EnvFrom
      if (sourceAttribute.includes('envFrom')) {
        if ('configMapRef' in obj) {
          const ref = obj['configMapRef'] as Record<string, unknown>;
          if (ref && typeof ref['name'] === 'string') {
            const refId = this.buildReference(ref['name'], 'ConfigMap');
            references.push(
              this.createReference(refId, `${sourceAttribute}.configMapRef`, {
                kind: 'ConfigMap',
              })
            );
          }
        }
        if ('secretRef' in obj) {
          const ref = obj['secretRef'] as Record<string, unknown>;
          if (ref && typeof ref['name'] === 'string') {
            const refId = this.buildReference(ref['name'], 'Secret');
            references.push(
              this.createReference(refId, `${sourceAttribute}.secretRef`, {
                kind: 'Secret',
              })
            );
          }
        }
      }

      // Recursively search arrays and nested objects
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const itemRefs = this.extractFromValue(value[i], `${sourceAttribute}[${i}]`);
          references.push(...itemRefs);
        }
      }
    }

    return references;
  }

  /**
   * Extract references from node-specific fields
   */
  protected extractFromNodeFields(node: NodeType): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // Handle specific K8s node types
    switch (node.type) {
      case 'k8s_deployment':
      case 'k8s_statefulset':
      case 'k8s_daemonset':
        references.push(...this.extractFromWorkload(node));
        break;
      case 'k8s_service':
        references.push(...this.extractFromService(node));
        break;
      case 'k8s_ingress':
        references.push(...this.extractFromIngress(node));
        break;
      case 'k8s_rolebinding':
      case 'k8s_clusterrolebinding':
        references.push(...this.extractFromRoleBinding(node));
        break;
      case 'k8s_pod':
        references.push(...this.extractFromPod(node));
        break;
    }

    return references;
  }

  /**
   * Extract references from workload nodes (Deployment, StatefulSet, DaemonSet)
   */
  private extractFromWorkload(node: NodeType): ExtractedReference[] {
    const references: ExtractedReference[] = [];
    const metadata = node.metadata;

    // Service account reference
    const serviceAccount = this.getNestedValue(
      metadata,
      'spec.template.spec.serviceAccountName'
    ) as string | undefined;
    if (serviceAccount) {
      references.push(
        this.createReference(
          this.buildReference(serviceAccount, 'ServiceAccount'),
          'serviceAccountName',
          { kind: 'ServiceAccount' }
        )
      );
    }

    // Extract from containers
    const containers = this.getNestedValue(metadata, 'containers') as unknown[] | undefined;
    if (Array.isArray(containers)) {
      for (const container of containers) {
        const containerRefs = this.extractContainerReferences(container as Record<string, unknown>);
        references.push(...containerRefs);
      }
    }

    // Extract from volumes
    const volumes = this.getNestedValue(metadata, 'volumes') as unknown[] | undefined;
    if (Array.isArray(volumes)) {
      for (const volume of volumes) {
        const volumeRefs = this.extractVolumeReferences(volume as Record<string, unknown>);
        references.push(...volumeRefs);
      }
    }

    // StatefulSet serviceName
    if (node.type === 'k8s_statefulset' && 'serviceName' in node) {
      const serviceName = (node as { serviceName: string }).serviceName;
      references.push(
        this.createReference(
          this.buildReference(serviceName, 'Service'),
          'serviceName',
          { kind: 'Service' }
        )
      );
    }

    return references;
  }

  /**
   * Extract references from container spec
   */
  private extractContainerReferences(container: Record<string, unknown>): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // EnvFrom references
    const envFrom = container['envFrom'] as unknown[] | undefined;
    if (Array.isArray(envFrom)) {
      for (const source of envFrom) {
        const sourceObj = source as Record<string, unknown>;

        if (sourceObj['configMapRef']) {
          const ref = sourceObj['configMapRef'] as Record<string, unknown>;
          if (ref['name']) {
            references.push(
              this.createReference(
                this.buildReference(ref['name'] as string, 'ConfigMap'),
                'envFrom.configMapRef',
                { kind: 'ConfigMap', optional: ref['optional'] as boolean }
              )
            );
          }
        }

        if (sourceObj['secretRef']) {
          const ref = sourceObj['secretRef'] as Record<string, unknown>;
          if (ref['name']) {
            references.push(
              this.createReference(
                this.buildReference(ref['name'] as string, 'Secret'),
                'envFrom.secretRef',
                { kind: 'Secret', optional: ref['optional'] as boolean }
              )
            );
          }
        }
      }
    }

    return references;
  }

  /**
   * Extract references from volume spec
   */
  private extractVolumeReferences(volume: Record<string, unknown>): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // ConfigMap volume
    if (volume['configMap']) {
      const configMap = volume['configMap'] as Record<string, unknown>;
      if (configMap['name']) {
        references.push(
          this.createReference(
            this.buildReference(configMap['name'] as string, 'ConfigMap'),
            'volumes.configMap',
            { kind: 'ConfigMap' }
          )
        );
      }
    }

    // Secret volume
    if (volume['secret']) {
      const secret = volume['secret'] as Record<string, unknown>;
      if (secret['secretName']) {
        references.push(
          this.createReference(
            this.buildReference(secret['secretName'] as string, 'Secret'),
            'volumes.secret',
            { kind: 'Secret' }
          )
        );
      }
    }

    // PVC volume
    if (volume['persistentVolumeClaim']) {
      const pvc = volume['persistentVolumeClaim'] as Record<string, unknown>;
      if (pvc['claimName']) {
        references.push(
          this.createReference(
            this.buildReference(pvc['claimName'] as string, 'PersistentVolumeClaim'),
            'volumes.persistentVolumeClaim',
            { kind: 'PersistentVolumeClaim' }
          )
        );
      }
    }

    return references;
  }

  /**
   * Extract references from Service node
   */
  private extractFromService(node: NodeType): ExtractedReference[] {
    // Services don't typically reference other resources directly
    // but may have selector that matches deployments
    return [];
  }

  /**
   * Extract references from Ingress node
   */
  private extractFromIngress(node: NodeType): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // TLS secret references
    if ('tls' in node) {
      const tls = (node as { tls: Array<{ secretName: string }> }).tls;
      for (const tlsConfig of tls) {
        if (tlsConfig.secretName) {
          references.push(
            this.createReference(
              this.buildReference(tlsConfig.secretName, 'Secret'),
              'tls.secretName',
              { kind: 'Secret' }
            )
          );
        }
      }
    }

    // Backend service references from rules
    if ('rules' in node) {
      const rules = (node as { rules: Array<{ paths: Array<{ serviceName: string }> }> }).rules;
      for (const rule of rules) {
        for (const path of rule.paths || []) {
          if (path.serviceName) {
            references.push(
              this.createReference(
                this.buildReference(path.serviceName, 'Service'),
                'rules.paths.serviceName',
                { kind: 'Service' }
              )
            );
          }
        }
      }
    }

    return references;
  }

  /**
   * Extract references from RoleBinding node
   */
  private extractFromRoleBinding(node: NodeType): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // Role reference
    if ('roleRef' in node) {
      const roleRef = (node as { roleRef: { kind: string; name: string } }).roleRef;
      const kind = roleRef.kind === 'ClusterRole' ? 'ClusterRole' : 'Role';
      references.push(
        this.createReference(
          this.buildReference(roleRef.name, kind),
          'roleRef',
          { kind }
        )
      );
    }

    // Subject references
    if ('subjects' in node) {
      const subjects = (node as {
        subjects: Array<{ kind: string; name: string; namespace?: string }>;
      }).subjects;
      for (const subject of subjects) {
        if (subject.kind === 'ServiceAccount') {
          const namespace = subject.namespace || 'default';
          references.push(
            this.createReference(
              `${namespace}/ServiceAccount/${subject.name}`,
              'subjects',
              { kind: 'ServiceAccount', namespace }
            )
          );
        }
      }
    }

    return references;
  }

  /**
   * Extract references from Pod node
   */
  private extractFromPod(node: NodeType): ExtractedReference[] {
    // Similar to workload extraction
    return this.extractFromWorkload(node);
  }

  /**
   * Build a K8s reference string
   */
  private buildReference(
    name: string,
    kind: K8sReferenceKind,
    namespace?: string
  ): string {
    const ns = namespace || 'default';
    return `${ns}/${kind}/${name}`;
  }

  /**
   * Infer K8s resource kind from attribute name
   */
  private inferKindFromAttribute(attribute: string): K8sReferenceKind {
    const attrLower = attribute.toLowerCase();

    if (attrLower.includes('configmap')) return 'ConfigMap';
    if (attrLower.includes('secret')) return 'Secret';
    if (attrLower.includes('serviceaccount')) return 'ServiceAccount';
    if (attrLower.includes('service')) return 'Service';
    if (attrLower.includes('pvc') || attrLower.includes('claim')) return 'PersistentVolumeClaim';
    if (attrLower.includes('role')) return 'Role';

    return 'Unknown';
  }
}

/**
 * Create a K8sExtractor instance
 */
export function createK8sExtractor(): K8sExtractor {
  return new K8sExtractor();
}
