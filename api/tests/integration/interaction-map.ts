/**
 * Integration Test Interaction Map
 * @module tests/integration/interaction-map
 *
 * Documents and tracks component interactions for integration testing.
 * Provides coverage analysis and visualization data.
 *
 * Agent #34 of 47 | Phase 5: Testing
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Component node in the interaction map
 */
export interface ComponentNode {
  readonly id: string;
  readonly name: string;
  readonly type: 'service' | 'repository' | 'controller' | 'middleware' | 'external' | 'detector';
  readonly dependencies: string[];
  readonly layer: 'api' | 'service' | 'domain' | 'infrastructure';
}

/**
 * Interaction between components
 */
export interface Interaction {
  readonly from: string;
  readonly to: string;
  readonly type: 'sync' | 'async' | 'event' | 'factory';
  readonly description: string;
  readonly testIds: string[];
  readonly coverage: 'full' | 'partial' | 'none';
}

/**
 * Test coverage map
 */
export interface TestCoverageMap {
  readonly totalInteractions: number;
  readonly testedInteractions: number;
  readonly coveragePercent: number;
  readonly untestedPaths: string[];
  readonly partiallyTestedPaths: string[];
}

/**
 * Complete interaction map
 */
export interface InteractionMap {
  readonly components: ComponentNode[];
  readonly interactions: Interaction[];
  readonly testCoverage: TestCoverageMap;
}

// ============================================================================
// Component Definitions
// ============================================================================

/**
 * All components in the code-reviewer system
 */
export const COMPONENTS: ComponentNode[] = [
  // API Layer (Controllers/Handlers)
  {
    id: 'scan-handler',
    name: 'ScanHandler',
    type: 'controller',
    dependencies: ['scan-service', 'auth-middleware'],
    layer: 'api',
  },
  {
    id: 'rollup-handler',
    name: 'RollupHandler',
    type: 'controller',
    dependencies: ['rollup-service', 'auth-middleware'],
    layer: 'api',
  },
  {
    id: 'health-handler',
    name: 'HealthHandler',
    type: 'controller',
    dependencies: [],
    layer: 'api',
  },
  {
    id: 'auth-middleware',
    name: 'AuthMiddleware',
    type: 'middleware',
    dependencies: ['jwt-service'],
    layer: 'api',
  },

  // Service Layer
  {
    id: 'scan-service',
    name: 'ScanService',
    type: 'service',
    dependencies: [
      'parser-orchestrator',
      'detection-orchestrator',
      'scoring-service',
      'graph-service',
      'scan-repository',
      'file-discovery',
    ],
    layer: 'service',
  },
  {
    id: 'parser-orchestrator',
    name: 'ParserOrchestrator',
    type: 'service',
    dependencies: ['terraform-parser', 'helm-parser', 'k8s-parser'],
    layer: 'service',
  },
  {
    id: 'detection-orchestrator',
    name: 'DetectionOrchestrator',
    type: 'service',
    dependencies: ['module-detector', 'reference-resolver', 'data-source-detector'],
    layer: 'service',
  },
  {
    id: 'scoring-service',
    name: 'ScoringService',
    type: 'service',
    dependencies: ['evidence-repository'],
    layer: 'service',
  },
  {
    id: 'graph-service',
    name: 'GraphService',
    type: 'service',
    dependencies: ['graph-builder', 'graph-validator', 'graph-merger'],
    layer: 'service',
  },
  {
    id: 'rollup-service',
    name: 'RollupService',
    type: 'service',
    dependencies: [
      'rollup-repository',
      'merge-engine',
      'blast-radius-engine',
      'matcher-factory',
    ],
    layer: 'service',
  },
  {
    id: 'jwt-service',
    name: 'JWTService',
    type: 'service',
    dependencies: [],
    layer: 'service',
  },
  {
    id: 'file-discovery',
    name: 'FileDiscovery',
    type: 'service',
    dependencies: [],
    layer: 'service',
  },

  // Domain Layer (Detectors, Engines)
  {
    id: 'module-detector',
    name: 'ModuleDetector',
    type: 'detector',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'reference-resolver',
    name: 'ReferenceResolver',
    type: 'detector',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'data-source-detector',
    name: 'DataSourceDetector',
    type: 'detector',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'graph-builder',
    name: 'GraphBuilder',
    type: 'service',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'graph-validator',
    name: 'GraphValidator',
    type: 'service',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'graph-merger',
    name: 'GraphMerger',
    type: 'service',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'merge-engine',
    name: 'MergeEngine',
    type: 'service',
    dependencies: ['matcher-factory'],
    layer: 'domain',
  },
  {
    id: 'blast-radius-engine',
    name: 'BlastRadiusEngine',
    type: 'service',
    dependencies: ['graph-service'],
    layer: 'domain',
  },
  {
    id: 'matcher-factory',
    name: 'MatcherFactory',
    type: 'service',
    dependencies: [],
    layer: 'domain',
  },

  // Infrastructure Layer (Repositories)
  {
    id: 'scan-repository',
    name: 'ScanRepository',
    type: 'repository',
    dependencies: ['database'],
    layer: 'infrastructure',
  },
  {
    id: 'node-repository',
    name: 'NodeRepository',
    type: 'repository',
    dependencies: ['database'],
    layer: 'infrastructure',
  },
  {
    id: 'edge-repository',
    name: 'EdgeRepository',
    type: 'repository',
    dependencies: ['database'],
    layer: 'infrastructure',
  },
  {
    id: 'evidence-repository',
    name: 'EvidenceRepository',
    type: 'repository',
    dependencies: ['database'],
    layer: 'infrastructure',
  },
  {
    id: 'rollup-repository',
    name: 'RollupRepository',
    type: 'repository',
    dependencies: ['database'],
    layer: 'infrastructure',
  },

  // External Dependencies
  {
    id: 'database',
    name: 'PostgreSQL',
    type: 'external',
    dependencies: [],
    layer: 'infrastructure',
  },
  {
    id: 'terraform-parser',
    name: 'TerraformParser',
    type: 'external',
    dependencies: [],
    layer: 'infrastructure',
  },
  {
    id: 'helm-parser',
    name: 'HelmParser',
    type: 'external',
    dependencies: [],
    layer: 'infrastructure',
  },
  {
    id: 'k8s-parser',
    name: 'K8sParser',
    type: 'external',
    dependencies: [],
    layer: 'infrastructure',
  },
];

// ============================================================================
// Interaction Definitions
// ============================================================================

/**
 * All component interactions with test coverage
 */
export const INTERACTIONS: Interaction[] = [
  // API -> Service interactions
  {
    from: 'scan-handler',
    to: 'scan-service',
    type: 'sync',
    description: 'Scan CRUD operations',
    testIds: ['api-endpoints-scan-create', 'api-endpoints-scan-status'],
    coverage: 'partial',
  },
  {
    from: 'rollup-handler',
    to: 'rollup-service',
    type: 'sync',
    description: 'Rollup CRUD and execution',
    testIds: ['rollup-api-create', 'rollup-api-execute', 'rollup-api-list'],
    coverage: 'full',
  },
  {
    from: 'scan-handler',
    to: 'auth-middleware',
    type: 'sync',
    description: 'Request authentication',
    testIds: ['api-endpoints-auth-required'],
    coverage: 'full',
  },

  // ScanService -> Dependencies
  {
    from: 'scan-service',
    to: 'parser-orchestrator',
    type: 'sync',
    description: 'Parse IaC files',
    testIds: ['scan-workflow-parsing', 'scan-workflow-vpc'],
    coverage: 'full',
  },
  {
    from: 'scan-service',
    to: 'detection-orchestrator',
    type: 'sync',
    description: 'Detect dependencies',
    testIds: ['scan-workflow-detection', 'detection-pipeline-module'],
    coverage: 'full',
  },
  {
    from: 'scan-service',
    to: 'scoring-service',
    type: 'sync',
    description: 'Score edge confidence',
    testIds: ['scan-workflow-scoring', 'confidence-scoring-integration'],
    coverage: 'full',
  },
  {
    from: 'scan-service',
    to: 'graph-service',
    type: 'sync',
    description: 'Build dependency graph',
    testIds: ['scan-workflow-graph', 'graph-construction-build'],
    coverage: 'full',
  },
  {
    from: 'scan-service',
    to: 'scan-repository',
    type: 'async',
    description: 'Persist scan data',
    testIds: ['scan-workflow-persistence'],
    coverage: 'full',
  },
  {
    from: 'scan-service',
    to: 'file-discovery',
    type: 'sync',
    description: 'Discover IaC files',
    testIds: ['scan-workflow-discovery'],
    coverage: 'full',
  },

  // DetectionOrchestrator -> Detectors
  {
    from: 'detection-orchestrator',
    to: 'module-detector',
    type: 'sync',
    description: 'Detect module references',
    testIds: ['detection-pipeline-module-local', 'detection-pipeline-module-registry'],
    coverage: 'full',
  },
  {
    from: 'detection-orchestrator',
    to: 'reference-resolver',
    type: 'sync',
    description: 'Resolve resource references',
    testIds: ['detection-pipeline-resource-ref', 'detection-pipeline-variable-ref'],
    coverage: 'full',
  },
  {
    from: 'detection-orchestrator',
    to: 'data-source-detector',
    type: 'sync',
    description: 'Detect data source dependencies',
    testIds: ['detection-pipeline-data-source'],
    coverage: 'full',
  },

  // GraphService -> Components
  {
    from: 'graph-service',
    to: 'graph-builder',
    type: 'factory',
    description: 'Create graph instances',
    testIds: ['graph-construction-build', 'graph-construction-validate'],
    coverage: 'full',
  },
  {
    from: 'graph-service',
    to: 'graph-validator',
    type: 'sync',
    description: 'Validate graph integrity',
    testIds: ['graph-construction-validate', 'graph-construction-orphans'],
    coverage: 'full',
  },
  {
    from: 'graph-service',
    to: 'graph-merger',
    type: 'sync',
    description: 'Merge multiple graphs',
    testIds: ['graph-construction-merge'],
    coverage: 'full',
  },

  // RollupService -> Components
  {
    from: 'rollup-service',
    to: 'merge-engine',
    type: 'sync',
    description: 'Merge nodes across repos',
    testIds: ['rollup-execution-merge', 'merge-engine-test'],
    coverage: 'full',
  },
  {
    from: 'rollup-service',
    to: 'blast-radius-engine',
    type: 'sync',
    description: 'Analyze impact',
    testIds: ['rollup-api-blast-radius', 'blast-radius-engine-test'],
    coverage: 'full',
  },
  {
    from: 'rollup-service',
    to: 'rollup-repository',
    type: 'async',
    description: 'Persist rollup data',
    testIds: ['rollup-database-crud'],
    coverage: 'full',
  },
  {
    from: 'rollup-service',
    to: 'matcher-factory',
    type: 'factory',
    description: 'Create matchers',
    testIds: ['matcher-factory-test'],
    coverage: 'full',
  },

  // Repository -> Database
  {
    from: 'scan-repository',
    to: 'database',
    type: 'async',
    description: 'Scan CRUD operations',
    testIds: ['scan-workflow-persistence'],
    coverage: 'partial',
  },
  {
    from: 'node-repository',
    to: 'database',
    type: 'async',
    description: 'Node CRUD operations',
    testIds: [],
    coverage: 'partial',
  },
  {
    from: 'edge-repository',
    to: 'database',
    type: 'async',
    description: 'Edge CRUD operations',
    testIds: [],
    coverage: 'partial',
  },
  {
    from: 'evidence-repository',
    to: 'database',
    type: 'async',
    description: 'Evidence CRUD operations',
    testIds: [],
    coverage: 'partial',
  },
  {
    from: 'rollup-repository',
    to: 'database',
    type: 'async',
    description: 'Rollup CRUD operations',
    testIds: ['rollup-database-crud'],
    coverage: 'full',
  },

  // Parser orchestrator -> Parsers
  {
    from: 'parser-orchestrator',
    to: 'terraform-parser',
    type: 'sync',
    description: 'Parse Terraform files',
    testIds: ['parser-pipeline-terraform'],
    coverage: 'full',
  },
  {
    from: 'parser-orchestrator',
    to: 'helm-parser',
    type: 'sync',
    description: 'Parse Helm charts',
    testIds: ['parser-pipeline-helm'],
    coverage: 'full',
  },
  {
    from: 'parser-orchestrator',
    to: 'k8s-parser',
    type: 'sync',
    description: 'Parse Kubernetes manifests',
    testIds: ['parser-pipeline-k8s'],
    coverage: 'partial',
  },

  // Cross-cutting
  {
    from: 'blast-radius-engine',
    to: 'graph-service',
    type: 'sync',
    description: 'Graph traversal for impact',
    testIds: ['blast-radius-engine-traversal'],
    coverage: 'full',
  },
];

// ============================================================================
// Coverage Calculation
// ============================================================================

/**
 * Calculate test coverage from interactions
 */
export function calculateCoverage(interactions: Interaction[]): TestCoverageMap {
  const total = interactions.length;
  const tested = interactions.filter(i => i.coverage !== 'none').length;
  const fullyTested = interactions.filter(i => i.coverage === 'full').length;

  const untestedPaths = interactions
    .filter(i => i.coverage === 'none')
    .map(i => `${i.from} -> ${i.to}`);

  const partiallyTestedPaths = interactions
    .filter(i => i.coverage === 'partial')
    .map(i => `${i.from} -> ${i.to}`);

  return {
    totalInteractions: total,
    testedInteractions: tested,
    coveragePercent: total > 0 ? Math.round((tested / total) * 100) : 0,
    untestedPaths,
    partiallyTestedPaths,
  };
}

/**
 * Generate the complete interaction map
 */
export function generateInteractionMap(): InteractionMap {
  return {
    components: COMPONENTS,
    interactions: INTERACTIONS,
    testCoverage: calculateCoverage(INTERACTIONS),
  };
}

// ============================================================================
// Mermaid Diagram Generation
// ============================================================================

/**
 * Generate Mermaid diagram from interaction map
 */
export function generateMermaidDiagram(map: InteractionMap): string {
  let mermaid = 'graph TB\n';
  mermaid += '    %% Component Interaction Diagram\n\n';

  // Add subgraphs by layer
  const layers = ['api', 'service', 'domain', 'infrastructure'] as const;
  const layerNames: Record<string, string> = {
    api: 'API Layer',
    service: 'Service Layer',
    domain: 'Domain Layer',
    infrastructure: 'Infrastructure Layer',
  };

  for (const layer of layers) {
    const layerComponents = map.components.filter(c => c.layer === layer);
    if (layerComponents.length > 0) {
      mermaid += `    subgraph ${layerNames[layer]}\n`;
      for (const comp of layerComponents) {
        const style = getNodeStyle(comp.type);
        mermaid += `        ${comp.id}["${comp.name}"]${style}\n`;
      }
      mermaid += '    end\n\n';
    }
  }

  // Add edges
  mermaid += '    %% Interactions\n';
  for (const interaction of map.interactions) {
    const arrow = interaction.type === 'async' ? '-.->' : '-->';
    const label = interaction.coverage === 'full' ? '' :
                  interaction.coverage === 'partial' ? ':::partial' : ':::untested';
    mermaid += `    ${interaction.from} ${arrow} ${interaction.to}${label}\n`;
  }

  // Add styles
  mermaid += '\n    %% Styles\n';
  mermaid += '    classDef service fill:#e1f5fe,stroke:#01579b\n';
  mermaid += '    classDef repository fill:#f3e5f5,stroke:#4a148c\n';
  mermaid += '    classDef controller fill:#e8f5e9,stroke:#1b5e20\n';
  mermaid += '    classDef middleware fill:#fff8e1,stroke:#f57f17\n';
  mermaid += '    classDef external fill:#fff3e0,stroke:#e65100\n';
  mermaid += '    classDef detector fill:#fce4ec,stroke:#880e4f\n';
  mermaid += '    classDef partial stroke-dasharray: 5 5\n';
  mermaid += '    classDef untested stroke:#f44336,stroke-width:2px\n';

  return mermaid;
}

function getNodeStyle(type: ComponentNode['type']): string {
  const styles: Record<ComponentNode['type'], string> = {
    service: ':::service',
    repository: ':::repository',
    controller: ':::controller',
    middleware: ':::middleware',
    external: ':::external',
    detector: ':::detector',
  };
  return styles[type] ?? '';
}

// ============================================================================
// Test Matrix Generation
// ============================================================================

/**
 * Generate test matrix for component interactions
 */
export interface TestMatrixEntry {
  readonly componentA: string;
  readonly componentB: string;
  readonly interactionType: string;
  readonly testFile: string;
  readonly coverage: string;
}

export function generateTestMatrix(map: InteractionMap): TestMatrixEntry[] {
  const testFileMap: Record<string, string> = {
    'scan-workflow': 'scan-workflow.test.ts',
    'detection-pipeline': 'detection-pipeline.test.ts',
    'graph-construction': 'graph-construction.test.ts',
    'parser-pipeline': 'parser-pipeline.test.ts',
    'api-endpoints': 'api-endpoints.test.ts',
    'rollup-api': 'rollup-api.test.ts',
    'rollup-database': 'database.test.ts',
    'rollup-execution': 'rollup-execution-flow.test.ts',
    'blast-radius-engine': 'blast-radius-engine.test.ts',
    'merge-engine': 'merge-engine.test.ts',
    'matcher-factory': 'matcher-factory.test.ts',
    'confidence-scoring': 'scoring-engine.test.ts',
  };

  return map.interactions.map(interaction => {
    const testPrefix = interaction.testIds[0]?.split('-').slice(0, 2).join('-') ?? '';
    const testFile = testFileMap[testPrefix] ?? 'unknown';

    return {
      componentA: map.components.find(c => c.id === interaction.from)?.name ?? interaction.from,
      componentB: map.components.find(c => c.id === interaction.to)?.name ?? interaction.to,
      interactionType: interaction.type,
      testFile,
      coverage: interaction.coverage,
    };
  });
}

// ============================================================================
// Export Default Map
// ============================================================================

export const INTERACTION_MAP = generateInteractionMap();
export const MERMAID_DIAGRAM = generateMermaidDiagram(INTERACTION_MAP);
export const TEST_MATRIX = generateTestMatrix(INTERACTION_MAP);

// ============================================================================
// TASK-FINAL-004: Documentation System Components (Added by Integration Tester)
// ============================================================================

/**
 * Documentation system components
 */
export const DOC_SYSTEM_COMPONENTS: ComponentNode[] = [
  // API Layer
  {
    id: 'docs-handler',
    name: 'DocsHandler',
    type: 'controller',
    dependencies: ['documentation-service', 'auth-middleware'],
    layer: 'api',
  },
  {
    id: 'beta-handler',
    name: 'BetaOnboardingHandler',
    type: 'controller',
    dependencies: ['beta-onboarding-service', 'auth-middleware'],
    layer: 'api',
  },
  {
    id: 'launch-handler',
    name: 'LaunchReadinessHandler',
    type: 'controller',
    dependencies: ['launch-readiness-service', 'auth-middleware'],
    layer: 'api',
  },

  // Service Layer
  {
    id: 'documentation-service',
    name: 'DocumentationService',
    type: 'service',
    dependencies: ['doc-page-entity'],
    layer: 'service',
  },
  {
    id: 'beta-onboarding-service',
    name: 'BetaOnboardingService',
    type: 'service',
    dependencies: ['beta-customer-entity'],
    layer: 'service',
  },
  {
    id: 'launch-readiness-service',
    name: 'LaunchReadinessService',
    type: 'service',
    dependencies: ['launch-checklist-aggregate', 'checklist-item-vo'],
    layer: 'service',
  },

  // Domain Layer
  {
    id: 'doc-page-entity',
    name: 'DocPageEntity',
    type: 'service',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'beta-customer-entity',
    name: 'BetaCustomerEntity',
    type: 'service',
    dependencies: [],
    layer: 'domain',
  },
  {
    id: 'launch-checklist-aggregate',
    name: 'LaunchChecklistAggregate',
    type: 'service',
    dependencies: ['checklist-item-vo'],
    layer: 'domain',
  },
  {
    id: 'checklist-item-vo',
    name: 'ChecklistItemVO',
    type: 'service',
    dependencies: [],
    layer: 'domain',
  },
];

/**
 * Documentation system interactions with test coverage
 */
export const DOC_SYSTEM_INTERACTIONS: Interaction[] = [
  // Documentation Service interactions
  {
    from: 'docs-handler',
    to: 'documentation-service',
    type: 'sync',
    description: 'Documentation page CRUD',
    testIds: ['docs-routes-create', 'docs-routes-update', 'docs-routes-list'],
    coverage: 'full',
  },
  {
    from: 'documentation-service',
    to: 'doc-page-entity',
    type: 'factory',
    description: 'Create and manage doc pages',
    testIds: ['doc-service-create', 'doc-service-lifecycle', 'doc-service-toc'],
    coverage: 'full',
  },

  // Beta Onboarding Service interactions
  {
    from: 'beta-handler',
    to: 'beta-onboarding-service',
    type: 'sync',
    description: 'Beta customer management',
    testIds: ['beta-routes-register', 'beta-routes-nda', 'beta-routes-status'],
    coverage: 'full',
  },
  {
    from: 'beta-onboarding-service',
    to: 'beta-customer-entity',
    type: 'factory',
    description: 'Create and manage customers',
    testIds: ['beta-service-register', 'beta-service-onboarding', 'beta-service-stats'],
    coverage: 'full',
  },

  // Launch Readiness Service interactions
  {
    from: 'launch-handler',
    to: 'launch-readiness-service',
    type: 'sync',
    description: 'Launch checklist management',
    testIds: ['launch-routes-items', 'launch-routes-assess', 'launch-routes-bulk'],
    coverage: 'full',
  },
  {
    from: 'launch-readiness-service',
    to: 'launch-checklist-aggregate',
    type: 'sync',
    description: 'Manage checklist aggregate',
    testIds: ['launch-service-items', 'launch-service-blockers', 'launch-service-assess'],
    coverage: 'full',
  },
  {
    from: 'launch-checklist-aggregate',
    to: 'checklist-item-vo',
    type: 'factory',
    description: 'Create checklist items',
    testIds: ['checklist-item-create', 'checklist-item-complete'],
    coverage: 'full',
  },

  // Cross-service interactions (tested in integration)
  {
    from: 'documentation-service',
    to: 'launch-readiness-service',
    type: 'event',
    description: 'Documentation completion informs launch readiness',
    testIds: ['cross-service-doc-launch'],
    coverage: 'full',
  },
  {
    from: 'beta-onboarding-service',
    to: 'launch-readiness-service',
    type: 'event',
    description: 'Beta metrics inform launch readiness',
    testIds: ['cross-service-beta-launch'],
    coverage: 'full',
  },
];

/**
 * Get the complete interaction map including doc system
 */
export function getCompleteInteractionMap(): InteractionMap {
  const allComponents = [...COMPONENTS, ...DOC_SYSTEM_COMPONENTS];
  const allInteractions = [...INTERACTIONS, ...DOC_SYSTEM_INTERACTIONS];
  
  return {
    components: allComponents,
    interactions: allInteractions,
    testCoverage: calculateCoverage(allInteractions),
  };
}

export const COMPLETE_INTERACTION_MAP = getCompleteInteractionMap();
