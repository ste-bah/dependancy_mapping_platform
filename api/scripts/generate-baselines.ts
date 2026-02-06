/**
 * Baseline Generator Script
 * @module scripts/generate-baselines
 *
 * Generates baseline snapshots for regression testing.
 * Run with: npx tsx scripts/generate-baselines.ts
 *
 * Options:
 *   --update    Update existing baselines instead of failing if they exist
 *   --verbose   Show detailed output during generation
 *
 * TASK-DETECT: Baseline generation for regression testing
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface Baseline<T> {
  version: string;
  createdAt: string;
  updatedAt: string;
  hash: string;
  generator: string;
  data: T;
}

interface GeneratorOptions {
  update: boolean;
  verbose: boolean;
}

interface BaselineResult {
  name: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped';
  path: string;
}

// ============================================================================
// Configuration
// ============================================================================

const BASELINE_DIR = join(__dirname, '../tests/regression/baselines');
const VERSION = '1.0.0';
const GENERATOR = 'generate-baselines.ts';

// ============================================================================
// Utilities
// ============================================================================

function hashObject(obj: unknown): string {
  const normalized = JSON.stringify(obj, Object.keys(obj as object).sort());
  return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadExistingBaseline<T>(path: string): Baseline<T> | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as Baseline<T>;
  } catch {
    return null;
  }
}

function saveBaseline<T>(name: string, data: T, options: GeneratorOptions): BaselineResult {
  const path = join(BASELINE_DIR, `${name}.json`);
  const existing = loadExistingBaseline<T>(path);
  const hash = hashObject(data);
  const now = new Date().toISOString();

  if (existing && !options.update) {
    if (existing.hash === hash) {
      if (options.verbose) {
        console.log(`[UNCHANGED] ${name}`);
      }
      return { name, status: 'unchanged', path };
    }
    console.log(`[SKIPPED] ${name} - baseline exists and differs. Use --update to overwrite.`);
    return { name, status: 'skipped', path };
  }

  const baseline: Baseline<T> = {
    version: VERSION,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    hash,
    generator: GENERATOR,
    data,
  };

  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(baseline, null, 2));

  const status = existing ? 'updated' : 'created';
  if (options.verbose) {
    console.log(`[${status.toUpperCase()}] ${name}`);
  }
  return { name, status, path };
}

// ============================================================================
// Baseline Generators
// ============================================================================

function generateApiContractBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    scanRequest: {
      required: ['repositoryId'],
      optional: ['ref', 'config', 'priority', 'callbackUrl'],
      configFields: [
        'detectTypes',
        'includeImplicit',
        'minConfidence',
        'maxDepth',
        'includePatterns',
        'excludePatterns',
        'analyzeHelmCharts',
        'resolveRemoteModules',
      ],
    },
    scanResponse: {
      required: ['id', 'repositoryId', 'status', 'ref', 'config', 'createdAt'],
      optional: [
        'commitSha',
        'progress',
        'resultSummary',
        'errorMessage',
        'startedAt',
        'completedAt',
      ],
      statusValues: ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled'],
    },
    graphQueryRequest: {
      required: ['scanId'],
      optional: ['query', 'traversal', 'format'],
      formatValues: ['full', 'compact', 'adjacency'],
    },
    graphQueryResponse: {
      required: ['scanId', 'nodes', 'edges', 'stats'],
      nodeFields: ['id', 'type', 'name', 'location'],
      edgeFields: ['id', 'source', 'target', 'type', 'confidence', 'isImplicit'],
    },
  };

  return saveBaseline('api-contract', data, options);
}

function generateNodeTypesBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    terraform: [
      'terraform_resource',
      'terraform_data',
      'terraform_module',
      'terraform_variable',
      'terraform_output',
      'terraform_local',
      'terraform_provider',
    ],
    kubernetes: [
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
      'k8s_namespace',
      'k8s_serviceaccount',
      'k8s_role',
      'k8s_rolebinding',
      'k8s_clusterrole',
      'k8s_clusterrolebinding',
      'k8s_persistentvolume',
      'k8s_persistentvolumeclaim',
      'k8s_storageclass',
      'k8s_networkpolicy',
    ],
    helm: ['helm_chart', 'helm_release', 'helm_value'],
    counts: {
      terraform: 7,
      kubernetes: 20,
      helm: 3,
      total: 30,
    },
  };

  return saveBaseline('node-types', data, options);
}

function generateEdgeTypesBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    resourceDependencies: ['depends_on', 'references', 'creates', 'destroys'],
    moduleDependencies: ['module_call', 'module_source', 'module_provider'],
    variableFlow: ['input_variable', 'output_value', 'local_reference'],
    providerRelationships: ['provider_config', 'provider_alias'],
    dataSourceDependencies: ['data_source', 'data_reference'],
    kubernetesDependencies: [
      'selector_match',
      'namespace_member',
      'volume_mount',
      'service_target',
      'ingress_backend',
      'rbac_binding',
      'configmap_ref',
      'secret_ref',
    ],
    count: 22,
  };

  return saveBaseline('edge-types', data, options);
}

function generateEvidenceTypesBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    syntactic: [
      'explicit_reference',
      'depends_on_directive',
      'module_source',
      'provider_alias',
      'variable_default',
    ],
    semantic: [
      'interpolation',
      'function_call',
      'for_expression',
      'conditional',
      'splat_operation',
    ],
    structural: ['block_nesting', 'attribute_assignment', 'label_matching', 'namespace_scoping'],
    heuristic: [
      'naming_convention',
      'resource_proximity',
      'provider_inference',
      'type_compatibility',
    ],
    categories: ['syntax', 'semantic', 'structural', 'heuristic', 'explicit'],
    methods: [
      'ast_analysis',
      'regex_pattern',
      'semantic_analysis',
      'graph_traversal',
      'machine_learning',
      'rule_engine',
    ],
    confidenceLevels: {
      certain: { min: 95, max: 100 },
      high: { min: 80, max: 94 },
      medium: { min: 60, max: 79 },
      low: { min: 40, max: 59 },
      uncertain: { min: 0, max: 39 },
    },
  };

  return saveBaseline('evidence-types', data, options);
}

function generateErrorCodesBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    http: [
      'BAD_REQUEST',
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMITED',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT',
    ],
    parser: [
      'PARSE_ERROR',
      'SYNTAX_ERROR',
      'INVALID_HCL',
      'INVALID_YAML',
      'INVALID_CHART',
      'FILE_READ_ERROR',
    ],
    detection: [
      'DETECTION_ERROR',
      'DETECTION_TIMEOUT',
      'UNRESOLVED_REFERENCE',
      'CIRCULAR_REFERENCE',
      'MODULE_NOT_FOUND',
    ],
    graph: [
      'GRAPH_ERROR',
      'GRAPH_BUILD_ERROR',
      'GRAPH_VALIDATION_ERROR',
      'CYCLE_DETECTED',
      'INVALID_NODE',
      'INVALID_EDGE',
    ],
    scan: [
      'SCAN_ERROR',
      'SCAN_FAILED',
      'SCAN_TIMEOUT',
      'SCAN_CANCELLED',
      'SCAN_NOT_FOUND',
      'SCAN_ALREADY_RUNNING',
    ],
    httpStatusMappings: {
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
      SERVICE_UNAVAILABLE: 503,
      TIMEOUT: 504,
    },
  };

  return saveBaseline('error-codes', data, options);
}

function generateParserTerraformBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    supportedBlockTypes: [
      'resource',
      'data',
      'module',
      'variable',
      'output',
      'locals',
      'provider',
      'terraform',
    ],
    expressionTypes: ['literal', 'reference', 'function', 'array', 'object', 'conditional', 'for'],
    moduleSourceTypes: ['local', 'registry', 'git', 'github', 's3', 'gcs', 'unknown'],
    sampleVPCOutput: {
      expectedNodeCount: 4,
      expectedEdgeCount: 3,
      nodeTypes: ['terraform_resource', 'terraform_variable'],
      edgeTypes: ['references', 'input_variable'],
    },
    sampleModuleOutput: {
      expectedNodeCount: 2,
      expectedEdgeCount: 1,
      nodeTypes: ['terraform_resource', 'terraform_module'],
      edgeTypes: ['module_call'],
    },
  };

  return saveBaseline('parser-terraform', data, options);
}

function generateParserHelmBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    chartYamlFields: {
      required: ['apiVersion', 'name', 'version'],
      optional: ['appVersion', 'description', 'type', 'dependencies', 'maintainers', 'keywords'],
    },
    valuesYamlTypes: ['string', 'number', 'boolean', 'array', 'object', 'null'],
    templateFunctions: ['include', 'required', 'default', 'toYaml', 'toJson', 'indent', 'nindent'],
    dependencyFields: ['name', 'version', 'repository', 'condition', 'tags', 'alias'],
    sampleChartOutput: {
      expectedNodeCount: 3,
      nodeTypes: ['helm_chart', 'helm_release', 'helm_value'],
    },
  };

  return saveBaseline('parser-helm', data, options);
}

function generateDetectionEdgesBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    vpcScenario: {
      input: {
        files: 2,
        blocks: 4,
        blockTypes: ['resource', 'variable'],
      },
      expectedOutput: {
        nodes: 4,
        edges: 3,
        edgeTypes: ['references', 'input_variable'],
        minConfidence: 80,
        maxConfidence: 100,
      },
    },
    moduleCallScenario: {
      input: {
        files: 1,
        blocks: 2,
        blockTypes: ['module', 'resource'],
      },
      expectedOutput: {
        nodes: 2,
        edges: 1,
        edgeTypes: ['module_call'],
        minConfidence: 90,
      },
    },
    dataSourceScenario: {
      input: {
        files: 1,
        blocks: 2,
        blockTypes: ['data', 'resource'],
      },
      expectedOutput: {
        nodes: 2,
        edges: 1,
        edgeTypes: ['data_reference'],
        minConfidence: 85,
      },
    },
  };

  return saveBaseline('detection-edges', data, options);
}

function generateGraphStructureBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    simpleGraph: {
      nodes: ['aws_vpc.main', 'aws_subnet.public'],
      edges: [{ source: 'aws_subnet.public', target: 'aws_vpc.main', type: 'references' }],
      nodeCounts: { terraform_resource: 2 },
      edgeCounts: { references: 1 },
    },
    complexGraph: {
      nodes: [
        'aws_vpc.main',
        'aws_subnet.public',
        'aws_instance.web',
        'var.env',
        'module.rds',
        'data.aws_ami.latest',
      ],
      edgeCount: 4,
      edgeTypes: ['references', 'input_variable', 'data_reference'],
      nodeCounts: {
        terraform_resource: 3,
        terraform_variable: 1,
        terraform_module: 1,
        terraform_data: 1,
      },
    },
    metadata: {
      requiredFields: ['createdAt', 'sourceFiles', 'nodeCounts', 'edgeCounts', 'buildTimeMs'],
    },
  };

  return saveBaseline('graph-structure', data, options);
}

function generateConfidenceScoringBaseline(options: GeneratorOptions): BaselineResult {
  const data = {
    baseScores: {
      explicit_reference: 90,
      depends_on_directive: 98,
      interpolation: 85,
      function_call: 80,
      naming_convention: 55,
      resource_proximity: 45,
    },
    aggregationRules: {
      method: 'weighted_average',
      diminishingReturns: true,
      maxScore: 100,
      minScore: 0,
    },
    levelThresholds: {
      certain: 95,
      high: 80,
      medium: 60,
      low: 40,
      uncertain: 0,
    },
    bonuses: {
      multipleEvidenceTypes: 10,
      explicitDeclaration: 5,
      crossFileConsistency: 3,
    },
    penalties: {
      heuristicOnly: -15,
      ambiguousReference: -10,
    },
  };

  return saveBaseline('confidence-scoring', data, options);
}

// ============================================================================
// Main
// ============================================================================

function parseArgs(): GeneratorOptions {
  const args = process.argv.slice(2);
  return {
    update: args.includes('--update'),
    verbose: args.includes('--verbose'),
  };
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('Baseline Generator');
  console.log('='.repeat(60));
  console.log(`Options: update=${options.update}, verbose=${options.verbose}`);
  console.log(`Output directory: ${BASELINE_DIR}`);
  console.log('');

  ensureDir(BASELINE_DIR);

  const generators = [
    { name: 'API Contract', fn: generateApiContractBaseline },
    { name: 'Node Types', fn: generateNodeTypesBaseline },
    { name: 'Edge Types', fn: generateEdgeTypesBaseline },
    { name: 'Evidence Types', fn: generateEvidenceTypesBaseline },
    { name: 'Error Codes', fn: generateErrorCodesBaseline },
    { name: 'Parser Terraform', fn: generateParserTerraformBaseline },
    { name: 'Parser Helm', fn: generateParserHelmBaseline },
    { name: 'Detection Edges', fn: generateDetectionEdgesBaseline },
    { name: 'Graph Structure', fn: generateGraphStructureBaseline },
    { name: 'Confidence Scoring', fn: generateConfidenceScoringBaseline },
  ];

  const results: BaselineResult[] = [];

  for (const { name, fn } of generators) {
    console.log(`Generating: ${name}...`);
    try {
      const result = fn(options);
      results.push(result);
    } catch (error) {
      console.error(`  ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.push({ name: name.toLowerCase().replace(' ', '-'), status: 'skipped', path: '' });
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));

  const created = results.filter((r) => r.status === 'created').length;
  const updated = results.filter((r) => r.status === 'updated').length;
  const unchanged = results.filter((r) => r.status === 'unchanged').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  console.log(`Created:   ${created}`);
  console.log(`Updated:   ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Total:     ${results.length}`);

  if (skipped > 0 && !options.update) {
    console.log('');
    console.log('Note: Some baselines were skipped because they already exist and differ.');
    console.log('Use --update to overwrite existing baselines.');
  }

  console.log('');
  console.log('Done!');
}

main().catch(console.error);
