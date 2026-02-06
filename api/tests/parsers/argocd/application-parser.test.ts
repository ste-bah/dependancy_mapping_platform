/**
 * ArgoCD Application Parser Tests
 * @module tests/parsers/argocd/application-parser
 *
 * Unit tests for ArgoCD Application and ApplicationSet parsing.
 * TASK-XREF-005: ArgoCD GitOps deployment pattern detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArgoCDApplicationParser,
  createArgoCDParser,
  parseArgoCDManifest,
  createArgoCDGraph,
  DEFAULT_ARGOCD_PARSER_OPTIONS,
  isArgoCDApplication,
  isArgoCDApplicationSet,
  isArgoCDApplicationNode,
  isArgoCDApplicationSetNode,
  isArgoCDDeploysEdge,
  isArgoCDGeneratesEdge,
  hasHelmSource,
  hasKustomizeSource,
  createArgoCDApplicationId,
  createArgoCDApplicationSetId,
  ARGOCD_API_VERSIONS,
  ARGOCD_KINDS,
  SYNC_OPTIONS,
  ArgoCDApplication,
  ArgoCDApplicationSet,
} from '@/parsers/argocd/index.js';

// ============================================================================
// Test Data - Application Manifests
// ============================================================================

const BASIC_HELM_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: HEAD
    path: charts/my-app
    helm:
      valueFiles:
        - values.yaml
        - values-prod.yaml
      parameters:
        - name: replicaCount
          value: "3"
        - name: image.tag
          value: v1.2.3
      releaseName: my-app-release
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
`;

const KUSTOMIZE_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kustomize-app
  namespace: argocd
  labels:
    environment: production
    team: platform
spec:
  project: infrastructure
  source:
    repoURL: https://github.com/org/manifests.git
    targetRevision: main
    path: overlays/production
    kustomize:
      namePrefix: prod-
      nameSuffix: -v1
      images:
        - nginx:1.21
        - redis:7.0
      commonLabels:
        app.kubernetes.io/part-of: my-platform
      commonAnnotations:
        owner: platform-team
  destination:
    server: https://kubernetes.default.svc
    namespace: kustomize-ns
`;

const DIRECTORY_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: manifests-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/k8s-manifests.git
    targetRevision: v1.0.0
    path: manifests
    directory:
      recurse: true
      exclude: "*.test.yaml"
      include: "*.yaml"
  destination:
    server: https://kubernetes.default.svc
    namespace: default
`;

const HELM_REPO_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: nginx-ingress
  namespace: argocd
spec:
  project: infrastructure
  source:
    repoURL: https://kubernetes.github.io/ingress-nginx
    chart: ingress-nginx
    targetRevision: 4.7.1
    helm:
      parameters:
        - name: controller.replicaCount
          value: "2"
  destination:
    server: https://kubernetes.default.svc
    namespace: ingress-nginx
`;

const MULTI_SOURCE_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: multi-source-app
  namespace: argocd
spec:
  project: default
  sources:
    - repoURL: https://github.com/org/helm-charts.git
      targetRevision: HEAD
      path: charts/app
      helm:
        valueFiles:
          - $values/values.yaml
    - repoURL: https://github.com/org/config.git
      targetRevision: main
      path: environments/prod
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: multi-source-ns
`;

const APPLICATION_WITH_IGNORE_DIFFERENCES = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-with-ignores
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: HEAD
    path: manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
    - kind: ConfigMap
      name: my-config
      jqPathExpressions:
        - .data.config
`;

const MINIMAL_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: minimal-app
spec:
  project: default
  source:
    repoURL: https://github.com/org/repo.git
    path: .
  destination:
    namespace: default
`;

// ============================================================================
// Test Data - ApplicationSet Manifests
// ============================================================================

const LIST_GENERATOR_APPLICATIONSET = `
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: env-apps
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - cluster: dev
            namespace: dev-ns
          - cluster: staging
            namespace: staging-ns
          - cluster: prod
            namespace: prod-ns
  template:
    metadata:
      name: '{{cluster}}-app'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/app.git
        targetRevision: HEAD
        path: 'envs/{{cluster}}'
      destination:
        server: 'https://{{cluster}}.example.com'
        namespace: '{{namespace}}'
`;

const CLUSTER_GENERATOR_APPLICATIONSET = `
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: cluster-apps
  namespace: argocd
spec:
  generators:
    - clusters:
        selector:
          matchLabels:
            environment: production
  template:
    metadata:
      name: '{{name}}-monitoring'
    spec:
      project: monitoring
      source:
        repoURL: https://github.com/org/monitoring.git
        targetRevision: main
        path: manifests
        helm:
          valueFiles:
            - values.yaml
      destination:
        server: '{{server}}'
        namespace: monitoring
  syncPolicy:
    preserveResourcesOnDeletion: true
`;

const GIT_GENERATOR_APPLICATIONSET = `
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: git-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/apps.git
        revision: HEAD
        directories:
          - path: apps/*
  template:
    metadata:
      name: '{{path.basename}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/apps.git
        targetRevision: HEAD
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path.basename}}'
  goTemplate: true
  goTemplateOptions:
    - missingkey=error
`;

const MATRIX_GENERATOR_APPLICATIONSET = `
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: matrix-apps
  namespace: argocd
spec:
  generators:
    - matrix:
        generators:
          - clusters:
              selector:
                matchLabels:
                  tier: production
          - list:
              elements:
                - app: frontend
                - app: backend
  template:
    metadata:
      name: '{{name}}-{{app}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/apps.git
        targetRevision: HEAD
        path: 'apps/{{app}}'
      destination:
        server: '{{server}}'
        namespace: '{{app}}'
`;

const MERGE_GENERATOR_APPLICATIONSET = `
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: merge-apps
  namespace: argocd
spec:
  generators:
    - merge:
        mergeKeys:
          - name
        generators:
          - list:
              elements:
                - name: app1
                  replicas: 2
                - name: app2
                  replicas: 3
          - list:
              elements:
                - name: app1
                  image: nginx:1.21
                - name: app2
                  image: nginx:1.22
  template:
    metadata:
      name: '{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/apps.git
        path: '{{name}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: default
`;

const APPLICATIONSET_WITH_STRATEGY = `
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: rolling-apps
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - name: app1
          - name: app2
          - name: app3
  strategy:
    type: RollingSync
    rollingSync:
      steps:
        - matchExpressions:
            - key: name
              operator: In
              values:
                - app1
          maxUpdate: 1
        - matchExpressions:
            - key: name
              operator: In
              values:
                - app2
                - app3
          maxUpdate: 50%
  template:
    metadata:
      name: '{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/apps.git
        path: '{{name}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: default
`;

// ============================================================================
// Test Data - Multi-Document YAML
// ============================================================================

const MULTI_DOCUMENT_YAML = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-one
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/repo.git
    path: app-one
  destination:
    server: https://kubernetes.default.svc
    namespace: app-one-ns
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-two
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/repo.git
    path: app-two
  destination:
    server: https://kubernetes.default.svc
    namespace: app-two-ns
---
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: app-set-one
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: dev
  template:
    metadata:
      name: '{{env}}-app'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/repo.git
        path: envs/{{env}}
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{env}}'
`;

// ============================================================================
// Test Data - Invalid/Edge Cases
// ============================================================================

const INVALID_YAML = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: [invalid
  namespace: argocd
`;

const MISSING_SOURCE_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: missing-source
  namespace: argocd
spec:
  project: default
  destination:
    server: https://kubernetes.default.svc
    namespace: default
`;

const NON_ARGOCD_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: app
          image: nginx
`;

// ============================================================================
// Tests
// ============================================================================

describe('ArgoCDApplicationParser', () => {
  let parser: ArgoCDApplicationParser;

  beforeEach(() => {
    parser = createArgoCDParser();
  });

  describe('canParse', () => {
    it('should return true for ArgoCD Application manifest', () => {
      expect(parser.canParse('app.yaml', BASIC_HELM_APPLICATION)).toBe(true);
    });

    it('should return true for ArgoCD ApplicationSet manifest', () => {
      expect(parser.canParse('appset.yaml', LIST_GENERATOR_APPLICATIONSET)).toBe(true);
    });

    it('should return false for non-ArgoCD manifests', () => {
      expect(parser.canParse('deployment.yaml', NON_ARGOCD_MANIFEST)).toBe(false);
    });

    it('should return false for non-YAML files', () => {
      expect(parser.canParse('file.txt')).toBe(false);
      expect(parser.canParse('file.json')).toBe(false);
    });

    it('should return true for YAML files without content check', () => {
      expect(parser.canParse('file.yaml')).toBe(true);
      expect(parser.canParse('file.yml')).toBe(true);
    });
  });

  describe('isArgoCDApplication', () => {
    it('should detect Application kind', () => {
      expect(parser.isArgoCDApplication(BASIC_HELM_APPLICATION)).toBe(true);
    });

    it('should not detect ApplicationSet as Application', () => {
      expect(parser.isArgoCDApplication(LIST_GENERATOR_APPLICATIONSET)).toBe(false);
    });

    it('should not detect non-ArgoCD manifests', () => {
      expect(parser.isArgoCDApplication(NON_ARGOCD_MANIFEST)).toBe(false);
    });
  });

  describe('isApplicationSet', () => {
    it('should detect ApplicationSet kind', () => {
      expect(parser.isApplicationSet(LIST_GENERATOR_APPLICATIONSET)).toBe(true);
    });

    it('should not detect Application as ApplicationSet', () => {
      expect(parser.isApplicationSet(BASIC_HELM_APPLICATION)).toBe(false);
    });
  });
});

describe('Application Parsing', () => {
  let parser: ArgoCDApplicationParser;

  beforeEach(() => {
    parser = createArgoCDParser();
  });

  describe('Basic Helm Application', () => {
    it('should parse basic Helm application', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applications).toHaveLength(1);
        const app = result.data.applications[0];
        expect(app.name).toBe('my-app');
        expect(app.namespace).toBe('argocd');
        expect(app.project).toBe('default');
      }
    });

    it('should parse Helm source configuration', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.sourceType).toBe('helm');
        expect(app.source.repoURL).toBe('https://github.com/org/repo.git');
        expect(app.source.targetRevision).toBe('HEAD');
        expect(app.source.path).toBe('charts/my-app');
      }
    });

    it('should parse Helm value files', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.helm?.valueFiles).toEqual(['values.yaml', 'values-prod.yaml']);
      }
    });

    it('should parse Helm parameters', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.helm?.parameters).toHaveLength(2);
        expect(app.source.helm?.parameters[0]).toEqual({ name: 'replicaCount', value: '3' });
        expect(app.source.helm?.parameters[1]).toEqual({ name: 'image.tag', value: 'v1.2.3' });
      }
    });

    it('should parse Helm release name', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.helm?.releaseName).toBe('my-app-release');
      }
    });

    it('should parse destination', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.destination.server).toBe('https://kubernetes.default.svc');
        expect(app.destination.namespace).toBe('production');
      }
    });

    it('should parse sync policy', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.syncPolicy?.automated?.prune).toBe(true);
        expect(app.syncPolicy?.automated?.selfHeal).toBe(true);
        expect(app.syncPolicy?.syncOptions).toContain('CreateNamespace=true');
        expect(app.syncPolicy?.syncOptions).toContain('PruneLast=true');
      }
    });

    it('should parse retry policy', async () => {
      const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.syncPolicy?.retry?.limit).toBe(5);
        expect(app.syncPolicy?.retry?.backoff?.duration).toBe('5s');
        expect(app.syncPolicy?.retry?.backoff?.factor).toBe(2);
        expect(app.syncPolicy?.retry?.backoff?.maxDuration).toBe('3m');
      }
    });
  });

  describe('Kustomize Application', () => {
    it('should parse Kustomize application', async () => {
      const result = await parseArgoCDManifest(KUSTOMIZE_APPLICATION, '/apps/kustomize-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.name).toBe('kustomize-app');
        expect(app.source.sourceType).toBe('kustomize');
      }
    });

    it('should parse Kustomize name prefix/suffix', async () => {
      const result = await parseArgoCDManifest(KUSTOMIZE_APPLICATION, '/apps/kustomize-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.kustomize?.namePrefix).toBe('prod-');
        expect(app.source.kustomize?.nameSuffix).toBe('-v1');
      }
    });

    it('should parse Kustomize images', async () => {
      const result = await parseArgoCDManifest(KUSTOMIZE_APPLICATION, '/apps/kustomize-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.kustomize?.images).toContain('nginx:1.21');
        expect(app.source.kustomize?.images).toContain('redis:7.0');
      }
    });

    it('should parse Kustomize common labels', async () => {
      const result = await parseArgoCDManifest(KUSTOMIZE_APPLICATION, '/apps/kustomize-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.kustomize?.commonLabels).toEqual({
          'app.kubernetes.io/part-of': 'my-platform',
        });
      }
    });

    it('should parse application labels', async () => {
      const result = await parseArgoCDManifest(KUSTOMIZE_APPLICATION, '/apps/kustomize-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.labels).toEqual({
          environment: 'production',
          team: 'platform',
        });
      }
    });
  });

  describe('Directory Application', () => {
    it('should parse directory application', async () => {
      const result = await parseArgoCDManifest(DIRECTORY_APPLICATION, '/apps/manifests-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.name).toBe('manifests-app');
        expect(app.source.sourceType).toBe('directory');
      }
    });

    it('should parse directory recurse option', async () => {
      const result = await parseArgoCDManifest(DIRECTORY_APPLICATION, '/apps/manifests-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.directory?.recurse).toBe(true);
      }
    });

    it('should parse directory include/exclude patterns', async () => {
      const result = await parseArgoCDManifest(DIRECTORY_APPLICATION, '/apps/manifests-app.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.directory?.exclude).toBe('*.test.yaml');
        expect(app.source.directory?.include).toBe('*.yaml');
      }
    });
  });

  describe('Helm Repository Application', () => {
    it('should parse Helm repository application', async () => {
      const result = await parseArgoCDManifest(HELM_REPO_APPLICATION, '/apps/nginx-ingress.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.name).toBe('nginx-ingress');
        expect(app.source.chart).toBe('ingress-nginx');
        expect(app.source.targetRevision).toBe('4.7.1');
      }
    });

    it('should detect Helm source type for chart references', async () => {
      const result = await parseArgoCDManifest(HELM_REPO_APPLICATION, '/apps/nginx-ingress.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.source.sourceType).toBe('helm');
        expect(hasHelmSource(app.source)).toBe(true);
      }
    });
  });

  describe('Multi-Source Application', () => {
    it('should parse multi-source application', async () => {
      const result = await parseArgoCDManifest(MULTI_SOURCE_APPLICATION, '/apps/multi-source.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.name).toBe('multi-source-app');
        expect(app.sources).toHaveLength(2);
      }
    });

    it('should parse source references', async () => {
      const result = await parseArgoCDManifest(MULTI_SOURCE_APPLICATION, '/apps/multi-source.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.sources?.[1].ref).toBe('values');
      }
    });
  });

  describe('Application with Ignore Differences', () => {
    it('should parse ignore differences', async () => {
      const result = await parseArgoCDManifest(APPLICATION_WITH_IGNORE_DIFFERENCES, '/apps/app-with-ignores.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.ignoreDifferences).toHaveLength(2);
      }
    });

    it('should parse JSON pointers in ignore differences', async () => {
      const result = await parseArgoCDManifest(APPLICATION_WITH_IGNORE_DIFFERENCES, '/apps/app-with-ignores.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        const depIgnore = app.ignoreDifferences?.find(d => d.kind === 'Deployment');
        expect(depIgnore?.jsonPointers).toContain('/spec/replicas');
      }
    });

    it('should parse jq path expressions in ignore differences', async () => {
      const result = await parseArgoCDManifest(APPLICATION_WITH_IGNORE_DIFFERENCES, '/apps/app-with-ignores.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        const cmIgnore = app.ignoreDifferences?.find(d => d.kind === 'ConfigMap');
        expect(cmIgnore?.jqPathExpressions).toContain('.data.config');
      }
    });
  });

  describe('Minimal Application', () => {
    it('should parse minimal application with defaults', async () => {
      const result = await parseArgoCDManifest(MINIMAL_APPLICATION, '/apps/minimal.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const app = result.data.applications[0];
        expect(app.name).toBe('minimal-app');
        expect(app.namespace).toBe('argocd');
        expect(app.destination.server).toBe('https://kubernetes.default.svc');
      }
    });
  });
});

describe('ApplicationSet Parsing', () => {
  let parser: ArgoCDApplicationParser;

  beforeEach(() => {
    parser = createArgoCDParser();
  });

  describe('List Generator', () => {
    it('should parse list generator ApplicationSet', async () => {
      const result = await parseArgoCDManifest(LIST_GENERATOR_APPLICATIONSET, '/apps/env-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applicationSets).toHaveLength(1);
        const appSet = result.data.applicationSets[0];
        expect(appSet.name).toBe('env-apps');
      }
    });

    it('should parse list generator type', async () => {
      const result = await parseArgoCDManifest(LIST_GENERATOR_APPLICATIONSET, '/apps/env-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.generators).toHaveLength(1);
        expect(appSet.generators[0].type).toBe('list');
      }
    });

    it('should parse ApplicationSet template', async () => {
      const result = await parseArgoCDManifest(LIST_GENERATOR_APPLICATIONSET, '/apps/env-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.template.spec.project).toBe('default');
        expect(appSet.template.metadata.name).toBe('{{cluster}}-app');
      }
    });
  });

  describe('Cluster Generator', () => {
    it('should parse cluster generator ApplicationSet', async () => {
      const result = await parseArgoCDManifest(CLUSTER_GENERATOR_APPLICATIONSET, '/apps/cluster-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.name).toBe('cluster-apps');
        expect(appSet.generators[0].type).toBe('clusters');
      }
    });

    it('should parse ApplicationSet sync policy', async () => {
      const result = await parseArgoCDManifest(CLUSTER_GENERATOR_APPLICATIONSET, '/apps/cluster-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.syncPolicy?.preserveResourcesOnDeletion).toBe(true);
      }
    });
  });

  describe('Git Generator', () => {
    it('should parse git generator ApplicationSet', async () => {
      const result = await parseArgoCDManifest(GIT_GENERATOR_APPLICATIONSET, '/apps/git-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.name).toBe('git-apps');
        expect(appSet.generators[0].type).toBe('git');
      }
    });

    it('should parse goTemplate option', async () => {
      const result = await parseArgoCDManifest(GIT_GENERATOR_APPLICATIONSET, '/apps/git-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.goTemplate).toBe(true);
        expect(appSet.goTemplateOptions).toContain('missingkey=error');
      }
    });
  });

  describe('Matrix Generator', () => {
    it('should parse matrix generator ApplicationSet', async () => {
      const result = await parseArgoCDManifest(MATRIX_GENERATOR_APPLICATIONSET, '/apps/matrix-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.name).toBe('matrix-apps');
        expect(appSet.generators[0].type).toBe('matrix');
      }
    });
  });

  describe('Merge Generator', () => {
    it('should parse merge generator ApplicationSet', async () => {
      const result = await parseArgoCDManifest(MERGE_GENERATOR_APPLICATIONSET, '/apps/merge-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.name).toBe('merge-apps');
        expect(appSet.generators[0].type).toBe('merge');
      }
    });
  });

  describe('ApplicationSet with Strategy', () => {
    it('should parse rolling sync strategy', async () => {
      const result = await parseArgoCDManifest(APPLICATIONSET_WITH_STRATEGY, '/apps/rolling-apps.yaml');

      expect(result.success).toBe(true);
      if (result.success) {
        const appSet = result.data.applicationSets[0];
        expect(appSet.strategy?.type).toBe('RollingSync');
        expect(appSet.strategy?.rollingSync?.steps).toHaveLength(2);
      }
    });
  });
});

describe('Multi-Document YAML Parsing', () => {
  it('should parse multiple documents', async () => {
    const result = await parseArgoCDManifest(MULTI_DOCUMENT_YAML, '/apps/multi-doc.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.applications).toHaveLength(2);
      expect(result.data.applicationSets).toHaveLength(1);
    }
  });

  it('should parse metadata for multi-document', async () => {
    const result = await parseArgoCDManifest(MULTI_DOCUMENT_YAML, '/apps/multi-doc.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.documentCount).toBe(3);
      expect(result.data.metadata.applicationCount).toBe(2);
      expect(result.data.metadata.applicationSetCount).toBe(1);
    }
  });

  it('should correctly identify each application', async () => {
    const result = await parseArgoCDManifest(MULTI_DOCUMENT_YAML, '/apps/multi-doc.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      const appNames = result.data.applications.map(a => a.name);
      expect(appNames).toContain('app-one');
      expect(appNames).toContain('app-two');
    }
  });
});

describe('Source Type Detection', () => {
  let parser: ArgoCDApplicationParser;

  beforeEach(() => {
    parser = createArgoCDParser();
  });

  it('should detect Helm source type from helm config', () => {
    const source = { helm: { valueFiles: ['values.yaml'] }, path: 'charts/app' };
    expect(parser.detectSourceType(source)).toBe('helm');
  });

  it('should detect Helm source type from chart field', () => {
    const source = { chart: 'nginx-ingress', repoURL: 'https://charts.example.com' };
    expect(parser.detectSourceType(source)).toBe('helm');
  });

  it('should detect Kustomize source type from kustomize config', () => {
    const source = { kustomize: { namePrefix: 'prod-' }, path: 'overlays/prod' };
    expect(parser.detectSourceType(source)).toBe('kustomize');
  });

  it('should detect Kustomize source type from path hint', () => {
    const source = { path: 'overlays/kustomize' };
    expect(parser.detectSourceType(source)).toBe('kustomize');
  });

  it('should detect plugin source type', () => {
    const source = { plugin: { name: 'my-plugin' }, path: 'manifests' };
    expect(parser.detectSourceType(source)).toBe('plugin');
  });

  it('should default to directory source type', () => {
    const source = { path: 'manifests' };
    expect(parser.detectSourceType(source)).toBe('directory');
  });
});

describe('Error Handling', () => {
  it('should handle invalid YAML gracefully', async () => {
    const result = await parseArgoCDManifest(INVALID_YAML, '/apps/invalid.yaml');

    expect(result.success).toBe(true); // errorRecovery is true by default
    if (result.success) {
      expect(result.data.errors.length).toBeGreaterThan(0);
      expect(result.data.errors[0].code).toBe('INVALID_YAML');
    }
  });

  it('should report missing source error', async () => {
    const result = await parseArgoCDManifest(MISSING_SOURCE_APPLICATION, '/apps/missing-source.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors.some(e => e.code === 'INVALID_SOURCE')).toBe(true);
    }
  });

  it('should skip non-ArgoCD documents silently', async () => {
    const result = await parseArgoCDManifest(NON_ARGOCD_MANIFEST, '/apps/deployment.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.applications).toHaveLength(0);
      expect(result.data.applicationSets).toHaveLength(0);
    }
  });
});

describe('Graph Generation', () => {
  it('should create graph nodes for applications', async () => {
    const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes).toHaveLength(1);
      expect(result.data.nodes[0].type).toBe('argocd_application');
    }
  });

  it('should create graph edges for applications', async () => {
    const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.edges).toHaveLength(1);
      expect(result.data.edges[0].type).toBe('ARGOCD_DEPLOYS');
    }
  });

  it('should create graph nodes for ApplicationSets', async () => {
    const result = await parseArgoCDManifest(LIST_GENERATOR_APPLICATIONSET, '/apps/env-apps.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes).toHaveLength(1);
      expect(result.data.nodes[0].type).toBe('argocd_applicationset');
    }
  });

  it('should create generates edges for ApplicationSets', async () => {
    const result = await parseArgoCDManifest(LIST_GENERATOR_APPLICATIONSET, '/apps/env-apps.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.edges).toHaveLength(1);
      expect(result.data.edges[0].type).toBe('ARGOCD_GENERATES');
    }
  });

  it('should include correct metadata in application nodes', async () => {
    const result = await parseArgoCDManifest(BASIC_HELM_APPLICATION, '/apps/my-app.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.data.nodes[0];
      if (isArgoCDApplicationNode(node)) {
        expect(node.metadata.appName).toBe('my-app');
        expect(node.metadata.project).toBe('default');
        expect(node.metadata.sourceType).toBe('helm');
        expect(node.metadata.autoSync).toBe(true);
        expect(node.metadata.valueFiles).toContain('values.yaml');
      }
    }
  });

  it('should include correct metadata in ApplicationSet nodes', async () => {
    const result = await parseArgoCDManifest(GIT_GENERATOR_APPLICATIONSET, '/apps/git-apps.yaml');

    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.data.nodes[0];
      if (isArgoCDApplicationSetNode(node)) {
        expect(node.metadata.appSetName).toBe('git-apps');
        expect(node.metadata.generatorTypes).toContain('git');
        expect(node.metadata.goTemplateEnabled).toBe(true);
      }
    }
  });

  describe('createArgoCDGraph', () => {
    it('should create graph from applications and applicationsets', () => {
      const apps: ArgoCDApplication[] = [{
        name: 'test-app',
        namespace: 'argocd',
        project: 'default',
        source: {
          repoURL: 'https://github.com/org/repo.git',
          targetRevision: 'HEAD',
          path: 'charts/app',
          sourceType: 'helm',
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'test-ns',
        },
        filePath: '/apps/test-app.yaml',
      }];

      const appSets: ArgoCDApplicationSet[] = [{
        name: 'test-appset',
        namespace: 'argocd',
        generators: [{ type: 'list', config: {} }],
        template: {
          metadata: { name: '{{name}}' },
          spec: {
            project: 'default',
            destination: { server: 'https://kubernetes.default.svc', namespace: 'default' },
          },
        },
        filePath: '/apps/test-appset.yaml',
      }];

      const graph = createArgoCDGraph(apps, appSets);

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(2);
    });
  });
});

describe('Type Guards', () => {
  it('should correctly identify ArgoCDApplication', () => {
    const app = {
      name: 'test',
      namespace: 'argocd',
      project: 'default',
      source: { repoURL: 'https://github.com/test.git', path: '.', targetRevision: 'HEAD', sourceType: 'directory' as const },
      destination: { server: 'https://kubernetes.default.svc', namespace: 'default' },
      filePath: '/test.yaml',
    };

    expect(isArgoCDApplication(app)).toBe(true);
  });

  it('should correctly identify ArgoCDApplicationSet', () => {
    const appSet = {
      name: 'test',
      namespace: 'argocd',
      generators: [],
      template: {
        metadata: {},
        spec: { project: 'default', destination: { server: '', namespace: '' } },
      },
      filePath: '/test.yaml',
    };

    expect(isArgoCDApplicationSet(appSet)).toBe(true);
  });

  it('should correctly identify hasHelmSource', () => {
    const helmSource = { repoURL: '', targetRevision: '', path: '', sourceType: 'helm' as const, helm: { valueFiles: [], parameters: [] } };
    const dirSource = { repoURL: '', targetRevision: '', path: '', sourceType: 'directory' as const };

    expect(hasHelmSource(helmSource)).toBe(true);
    expect(hasHelmSource(dirSource)).toBe(false);
  });

  it('should correctly identify hasKustomizeSource', () => {
    const kustomizeSource = { repoURL: '', targetRevision: '', path: '', sourceType: 'kustomize' as const, kustomize: {} };
    const dirSource = { repoURL: '', targetRevision: '', path: '', sourceType: 'directory' as const };

    expect(hasKustomizeSource(kustomizeSource)).toBe(true);
    expect(hasKustomizeSource(dirSource)).toBe(false);
  });
});

describe('Factory Functions', () => {
  it('should create application ID correctly', () => {
    const id = createArgoCDApplicationId('my-app', 'argocd');
    expect(id).toBe('argocd-app-argocd-my-app');
  });

  it('should create applicationset ID correctly', () => {
    const id = createArgoCDApplicationSetId('my-appset', 'argocd');
    expect(id).toBe('argocd-appset-argocd-my-appset');
  });
});

describe('Constants', () => {
  it('should have correct API versions', () => {
    expect(ARGOCD_API_VERSIONS).toContain('argoproj.io/v1alpha1');
  });

  it('should have correct kinds', () => {
    expect(ARGOCD_KINDS.APPLICATION).toBe('Application');
    expect(ARGOCD_KINDS.APPLICATION_SET).toBe('ApplicationSet');
  });

  it('should have correct sync options', () => {
    expect(SYNC_OPTIONS.CREATE_NAMESPACE).toBe('CreateNamespace=true');
    expect(SYNC_OPTIONS.PRUNE_LAST).toBe('PruneLast=true');
    expect(SYNC_OPTIONS.SERVER_SIDE_APPLY).toBe('ServerSideApply=true');
  });
});

describe('Parser Options', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_ARGOCD_PARSER_OPTIONS.errorRecovery).toBe(true);
    expect(DEFAULT_ARGOCD_PARSER_OPTIONS.parseApplicationSets).toBe(true);
    expect(DEFAULT_ARGOCD_PARSER_OPTIONS.generateGraph).toBe(true);
    expect(DEFAULT_ARGOCD_PARSER_OPTIONS.detectSourceTypes).toBe(true);
  });

  it('should respect custom options', async () => {
    const parser = createArgoCDParser({ parseApplicationSets: false });
    const result = await parseArgoCDManifest(MULTI_DOCUMENT_YAML, '/apps/multi-doc.yaml', { parseApplicationSets: false });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.applicationSets).toHaveLength(0);
    }
  });
});
