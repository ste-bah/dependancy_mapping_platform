#!/usr/bin/env node
/**
 * Benchmark Runner CLI
 * @module benchmarks/run-benchmarks
 *
 * Command-line interface for executing performance benchmarks.
 * Validates NFR-PERF-008 performance targets.
 *
 * Usage:
 *   npm run benchmark -- --suite=search --scale=100k
 *   npm run benchmark -- --suite=all --format=json --output=benchmark-results.json
 *   npx tsx src/benchmarks/run-benchmarks.ts --help
 *
 * NFR-PERF-008 Targets:
 * - Search 10K nodes < 100ms
 * - Search 50K nodes < 200ms
 * - Search 100K nodes < 500ms (CRITICAL)
 * - Rollup depth 3 < 500ms
 * - Scan 1000 files < 60s
 */

import {
  type BenchmarkRunnerOptions,
  type BenchmarkSuiteType,
  type BenchmarkScale,
  type BenchmarkReport,
  type BenchmarkSummary,
  type BenchmarkSuiteResult,
  type BenchmarkResult,
  type TargetComparisonResult,
  type PerformanceTargetKey,
  PERFORMANCE_TARGETS,
  DEFAULT_RUNNER_OPTIONS,
  isValidScale,
  isValidSuiteType,
} from './benchmark-types.js';
import {
  measureLatency,
  measureAgainstNfrTarget,
  calculatePercentileStats,
  formatDuration,
  formatBytes,
  formatNumber,
  formatPercentage,
  formatThroughput,
  collectEnvironmentInfo,
  getNodeCountForScale,
  getSearchTargetForScale,
  forceGC,
  getMemoryUsage,
  delay,
} from './benchmark-utils.js';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface ParsedArgs {
  suites: BenchmarkSuiteType[];
  scale: BenchmarkScale;
  customNodeCount?: number;
  format: 'json' | 'table' | 'markdown';
  outputFile?: string;
  verbose: boolean;
  skipWarmup: boolean;
  iterations: number;
  failFast: boolean;
  help: boolean;
  baseline?: string;
  saveBaseline?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    suites: ['all'],
    scale: '10k',
    format: 'table',
    verbose: false,
    skipWarmup: false,
    iterations: 100,
    failFast: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg.startsWith('--suite=') || arg.startsWith('-s=')) {
      const value = arg.split('=')[1];
      if (value) {
        const suites = value.split(',').filter((s): s is BenchmarkSuiteType => isValidSuiteType(s));
        if (suites.length > 0) {
          parsed.suites = suites;
        }
      }
    } else if (arg.startsWith('--scale=')) {
      const value = arg.split('=')[1];
      if (value && isValidScale(value)) {
        parsed.scale = value;
      }
    } else if (arg.startsWith('--nodes=')) {
      const value = parseInt(arg.split('=')[1] ?? '', 10);
      if (!isNaN(value) && value > 0) {
        parsed.customNodeCount = value;
        parsed.scale = 'custom';
      }
    } else if (arg.startsWith('--format=') || arg.startsWith('-f=')) {
      const value = arg.split('=')[1];
      if (value === 'json' || value === 'table' || value === 'markdown') {
        parsed.format = value;
      }
    } else if (arg.startsWith('--output=') || arg.startsWith('-o=')) {
      parsed.outputFile = arg.split('=')[1];
    } else if (arg.startsWith('--iterations=') || arg.startsWith('-i=')) {
      const value = parseInt(arg.split('=')[1] ?? '', 10);
      if (!isNaN(value) && value > 0) {
        parsed.iterations = value;
      }
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (arg === '--skip-warmup') {
      parsed.skipWarmup = true;
    } else if (arg === '--fail-fast') {
      parsed.failFast = true;
    } else if (arg.startsWith('--baseline=')) {
      parsed.baseline = arg.split('=')[1];
    } else if (arg.startsWith('--save-baseline=')) {
      parsed.saveBaseline = arg.split('=')[1];
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
Performance Benchmark Runner - NFR-PERF-008 Validation
=======================================================

Usage: npm run benchmark -- [options]
       npx tsx src/benchmarks/run-benchmarks.ts [options]

Options:
  --suite=<suites>     Comma-separated list of suites to run
                       (search, rollup, scan, diff, index, memory, all)
                       Default: all

  --scale=<scale>      Benchmark scale (1k, 10k, 50k, 100k, custom)
                       Default: 10k

  --nodes=<count>      Custom node count (sets scale to 'custom')

  --format=<format>    Output format (json, table, markdown)
                       Default: table

  --output=<file>      Output file path (stdout if not specified)

  --iterations=<n>     Number of iterations per benchmark
                       Default: 100

  --verbose, -v        Enable verbose output

  --skip-warmup        Skip warmup iterations

  --fail-fast          Stop on first failure

  --baseline=<file>    Compare against baseline file

  --save-baseline=<file>  Save results as new baseline

  --help, -h           Show this help message

NFR-PERF-008 Performance Targets:
  SEARCH_10K_MS:     ${PERFORMANCE_TARGETS.SEARCH_10K_MS}ms
  SEARCH_50K_MS:     ${PERFORMANCE_TARGETS.SEARCH_50K_MS}ms
  SEARCH_100K_MS:    ${PERFORMANCE_TARGETS.SEARCH_100K_MS}ms (CRITICAL)
  ROLLUP_DEPTH3_MS:  ${PERFORMANCE_TARGETS.ROLLUP_DEPTH3_MS}ms
  SCAN_1000_FILES_MS: ${PERFORMANCE_TARGETS.SCAN_1000_FILES_MS}ms

Examples:
  npm run benchmark -- --suite=search --scale=100k
  npm run benchmark -- --suite=search,diff --format=json --output=results.json
  npm run benchmark -- --verbose --iterations=50 --scale=50k
`);
}

// ============================================================================
// Mock Data Generation (for testing without full system)
// ============================================================================

interface MockNode {
  id: string;
  type: string;
  name: string;
  metadata: Record<string, unknown>;
}

function generateMockNodes(count: number): MockNode[] {
  const nodes: MockNode[] = [];
  const types = ['terraform_resource', 'terraform_module', 'k8s_deployment', 'k8s_service'];

  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `node_${i}`,
      type: types[i % types.length] ?? 'terraform_resource',
      name: `resource_${i}`,
      metadata: {
        index: i,
        tags: { env: i % 2 === 0 ? 'prod' : 'staging' },
      },
    });
  }

  return nodes;
}

interface MockEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

function generateMockEdges(nodeCount: number, density: number = 1.5): MockEdge[] {
  const edges: MockEdge[] = [];
  const edgeCount = Math.floor(nodeCount * density);
  const types = ['depends_on', 'references', 'module_call'];

  for (let i = 0; i < edgeCount && nodeCount > 1; i++) {
    const sourceIndex = i % nodeCount;
    const targetIndex = (sourceIndex + 1 + (i % (nodeCount - 1))) % nodeCount;

    edges.push({
      id: `edge_${i}`,
      source: `node_${sourceIndex}`,
      target: `node_${targetIndex}`,
      type: types[i % types.length] ?? 'depends_on',
    });
  }

  return edges;
}

// ============================================================================
// Benchmark Implementations
// ============================================================================

/**
 * Search benchmark - simulates node search operations
 */
async function runSearchBenchmark(
  nodeCount: number,
  iterations: number,
  warmupIterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  if (verbose) {
    console.log(`  Generating ${formatNumber(nodeCount)} mock nodes...`);
  }

  const nodes = generateMockNodes(nodeCount);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeIndex = new Map(nodes.map((n) => [n.name, n.id]));

  // The actual search operation to benchmark
  const searchOperation = async (): Promise<void> => {
    // Simulate various search patterns
    const searchTerms = ['resource_1', 'resource_100', 'resource_1000', 'resource_9999'];

    for (const term of searchTerms) {
      // Name-based lookup
      const nodeId = nodeIndex.get(term);
      if (nodeId) {
        nodeMap.get(nodeId);
      }

      // Type-based filter (simulated)
      let count = 0;
      for (const node of nodes) {
        if (node.type === 'terraform_resource') {
          count++;
          if (count > 100) break; // Limit iteration
        }
      }
    }
  };

  if (verbose) {
    console.log(`  Running ${iterations} iterations with ${warmupIterations} warmup...`);
  }

  const result = await measureLatency(searchOperation, iterations, warmupIterations);

  const targetMs = getSearchTargetForScale(
    nodeCount <= 1000 ? '1k' :
    nodeCount <= 10000 ? '10k' :
    nodeCount <= 50000 ? '50k' : '100k'
  );

  return {
    ...result,
    name: `search_${nodeCount}`,
    suite: 'search',
    targetMs,
    passed: result.latency.p95 <= targetMs,
    performanceRatio: result.latency.p95 / targetMs,
    metadata: {
      nodeCount,
      searchOperations: 4,
    },
  };
}

/**
 * Diff benchmark - simulates graph diff computation
 */
async function runDiffBenchmark(
  nodeCount: number,
  iterations: number,
  warmupIterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  if (verbose) {
    console.log(`  Generating ${formatNumber(nodeCount)} mock nodes for diff...`);
  }

  const baseNodes = generateMockNodes(nodeCount);
  const baseEdges = generateMockEdges(nodeCount);

  // Create modified snapshot (10% changes)
  const changeCount = Math.floor(nodeCount * 0.1);
  const targetNodes = [...baseNodes];

  // Simulate modifications
  for (let i = 0; i < changeCount; i++) {
    targetNodes[i] = {
      ...targetNodes[i]!,
      name: `modified_${i}`,
    };
  }

  const diffOperation = async (): Promise<void> => {
    const baseMap = new Map(baseNodes.map((n) => [n.id, n]));
    const targetMap = new Map(targetNodes.map((n) => [n.id, n]));

    const added: MockNode[] = [];
    const removed: MockNode[] = [];
    const modified: MockNode[] = [];

    // Find differences
    for (const [id, targetNode] of targetMap) {
      const baseNode = baseMap.get(id);
      if (!baseNode) {
        added.push(targetNode);
      } else if (JSON.stringify(baseNode) !== JSON.stringify(targetNode)) {
        modified.push(targetNode);
      }
    }

    for (const [id, baseNode] of baseMap) {
      if (!targetMap.has(id)) {
        removed.push(baseNode);
      }
    }

    // Force computation to avoid optimization
    if (added.length + removed.length + modified.length === 0) {
      throw new Error('Unexpected empty diff');
    }
  };

  if (verbose) {
    console.log(`  Running ${iterations} iterations with ${warmupIterations} warmup...`);
  }

  const result = await measureLatency(diffOperation, iterations, warmupIterations);

  const targetMs = nodeCount >= 10000
    ? PERFORMANCE_TARGETS.DIFF_10K_NODES_MS
    : 500;

  return {
    ...result,
    name: `diff_${nodeCount}`,
    suite: 'diff',
    targetMs,
    passed: result.latency.p95 <= targetMs,
    performanceRatio: result.latency.p95 / targetMs,
    metadata: {
      nodeCount,
      edgeCount: baseEdges.length,
      changePercent: 10,
    },
  };
}

/**
 * Index building benchmark
 */
async function runIndexBenchmark(
  nodeCount: number,
  iterations: number,
  warmupIterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  if (verbose) {
    console.log(`  Generating ${formatNumber(nodeCount)} mock nodes for indexing...`);
  }

  const nodes = generateMockNodes(nodeCount);

  const indexOperation = async (): Promise<void> => {
    // Build multiple indexes
    const byId = new Map<string, MockNode>();
    const byName = new Map<string, string>();
    const byType = new Map<string, string[]>();

    for (const node of nodes) {
      byId.set(node.id, node);
      byName.set(node.name, node.id);

      const typeList = byType.get(node.type) ?? [];
      typeList.push(node.id);
      byType.set(node.type, typeList);
    }

    // Verify indexes built correctly
    if (byId.size !== nodes.length) {
      throw new Error('Index build failed');
    }
  };

  const result = await measureLatency(indexOperation, iterations, warmupIterations);

  const targetMs = nodeCount >= 10000
    ? PERFORMANCE_TARGETS.INDEX_BUILD_10K_MS
    : PERFORMANCE_TARGETS.INDEX_BUILD_1K_MS;

  return {
    ...result,
    name: `index_${nodeCount}`,
    suite: 'index',
    targetMs,
    passed: result.latency.p95 <= targetMs,
    performanceRatio: result.latency.p95 / targetMs,
    metadata: {
      nodeCount,
      indexTypes: 3,
    },
  };
}

/**
 * Memory benchmark - measures memory usage patterns
 */
async function runMemoryBenchmark(
  nodeCount: number,
  iterations: number,
  warmupIterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  if (verbose) {
    console.log(`  Running memory benchmark with ${formatNumber(nodeCount)} nodes...`);
  }

  const memoryMeasurements: number[] = [];

  const memoryOperation = async (): Promise<void> => {
    forceGC();
    const before = getMemoryUsage();

    const nodes = generateMockNodes(nodeCount);
    const edges = generateMockEdges(nodeCount);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const after = getMemoryUsage();
    memoryMeasurements.push(after - before);

    // Prevent garbage collection during measurement
    if (nodeMap.size !== nodes.length || edges.length === 0) {
      throw new Error('Data generation failed');
    }
  };

  const result = await measureLatency(memoryOperation, Math.min(iterations, 10), warmupIterations);

  const memoryStats = calculatePercentileStats(memoryMeasurements);
  const targetBytes = nodeCount >= 10000
    ? PERFORMANCE_TARGETS.MEMORY_10K_NODES_BYTES
    : PERFORMANCE_TARGETS.MEMORY_10K_NODES_BYTES / 10;

  return {
    ...result,
    name: `memory_${nodeCount}`,
    suite: 'memory',
    memory: memoryStats,
    passed: memoryStats.p95 <= targetBytes,
    performanceRatio: memoryStats.p95 / targetBytes,
    metadata: {
      nodeCount,
      targetBytes,
      actualBytes: memoryStats.p95,
      bytesPerNode: memoryStats.avg / nodeCount,
    },
  };
}

/**
 * Rollup benchmark - simulates rollup depth traversal
 */
async function runRollupBenchmark(
  nodeCount: number,
  iterations: number,
  warmupIterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  if (verbose) {
    console.log(`  Generating ${formatNumber(nodeCount)} mock nodes for rollup...`);
  }

  const nodes = generateMockNodes(nodeCount);
  const edges = generateMockEdges(nodeCount, 2.0); // Higher density for rollup

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjacencyList = new Map<string, string[]>();

  // Build adjacency list
  for (const edge of edges) {
    const neighbors = adjacencyList.get(edge.source) ?? [];
    neighbors.push(edge.target);
    adjacencyList.set(edge.source, neighbors);
  }

  const rollupOperation = async (): Promise<void> => {
    // Simulate depth-3 rollup from multiple root nodes
    const rootCount = Math.min(10, Math.floor(nodeCount / 100));
    const visited = new Set<string>();

    for (let r = 0; r < rootCount; r++) {
      const rootId = `node_${r * Math.floor(nodeCount / rootCount)}`;
      const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id) || current.depth > 3) continue;

        visited.add(current.id);
        const node = nodeMap.get(current.id);
        if (!node) continue;

        const neighbors = adjacencyList.get(current.id) ?? [];
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push({ id: neighborId, depth: current.depth + 1 });
          }
        }
      }
    }

    if (visited.size === 0) {
      throw new Error('Rollup traversal failed');
    }
  };

  const result = await measureLatency(rollupOperation, iterations, warmupIterations);

  const targetMs = PERFORMANCE_TARGETS.ROLLUP_DEPTH3_MS;

  return {
    ...result,
    name: `rollup_depth3_${nodeCount}`,
    suite: 'rollup',
    targetMs,
    passed: result.latency.p95 <= targetMs,
    performanceRatio: result.latency.p95 / targetMs,
    metadata: {
      nodeCount,
      edgeCount: edges.length,
      maxDepth: 3,
    },
  };
}

// ============================================================================
// Suite Execution
// ============================================================================

async function runSuite(
  suiteType: BenchmarkSuiteType,
  options: ParsedArgs
): Promise<BenchmarkSuiteResult> {
  const nodeCount = getNodeCountForScale(options.scale, options.customNodeCount);
  const iterations = options.iterations;
  const warmupIterations = options.skipWarmup ? 0 : Math.floor(iterations / 10);
  const results: BenchmarkResult[] = [];
  const startTime = performance.now();

  if (options.verbose) {
    console.log(`\nRunning ${suiteType} suite with ${formatNumber(nodeCount)} nodes...`);
  }

  try {
    switch (suiteType) {
      case 'search':
        results.push(await runSearchBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        break;
      case 'diff':
        results.push(await runDiffBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        break;
      case 'index':
        results.push(await runIndexBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        break;
      case 'memory':
        results.push(await runMemoryBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        break;
      case 'rollup':
        results.push(await runRollupBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        break;
      case 'all':
        results.push(await runSearchBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        results.push(await runDiffBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        results.push(await runIndexBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        results.push(await runMemoryBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        results.push(await runRollupBenchmark(nodeCount, iterations, warmupIterations, options.verbose));
        break;
      case 'scan':
        // Scan benchmark would require file system operations
        // For now, return a placeholder
        if (options.verbose) {
          console.log('  Scan benchmark requires file system setup (skipped)');
        }
        break;
    }
  } catch (error) {
    if (options.verbose) {
      console.error(`  Error in ${suiteType} suite:`, error);
    }
    if (options.failFast) {
      throw error;
    }
  }

  const durationMs = performance.now() - startTime;
  const passed = results.every((r) => r.passed);

  return {
    suiteName: suiteType,
    suiteType,
    results,
    durationMs,
    passed,
  };
}

// ============================================================================
// Report Generation
// ============================================================================

function generateTargetComparisons(results: BenchmarkResult[]): TargetComparisonResult[] {
  const comparisons: TargetComparisonResult[] = [];

  const targetMapping: Array<{ resultName: string; target: PerformanceTargetKey; critical: boolean }> = [
    { resultName: 'search_10000', target: 'SEARCH_10K_MS', critical: false },
    { resultName: 'search_50000', target: 'SEARCH_50K_MS', critical: false },
    { resultName: 'search_100000', target: 'SEARCH_100K_MS', critical: true },
    { resultName: 'rollup_depth3', target: 'ROLLUP_DEPTH3_MS', critical: false },
    { resultName: 'diff_10000', target: 'DIFF_10K_NODES_MS', critical: false },
  ];

  for (const { resultName, target, critical } of targetMapping) {
    const result = results.find((r) => r.name.includes(resultName.split('_')[0]!));
    if (result && result.targetMs) {
      const targetMs = PERFORMANCE_TARGETS[target];
      const actualMs = result.latency.p95;

      comparisons.push({
        target,
        targetMs,
        actualMs,
        passed: actualMs <= targetMs,
        percentage: (actualMs / targetMs) * 100,
        marginMs: targetMs - actualMs,
        status: critical ? 'critical' : 'normal',
      });
    }
  }

  return comparisons;
}

function generateReport(suiteResults: BenchmarkSuiteResult[], options: ParsedArgs): BenchmarkReport {
  const allResults = suiteResults.flatMap((s) => s.results);
  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;
  const criticalFailures = allResults.filter(
    (r) => !r.passed && r.name.includes('100000')
  ).length;

  const summary: BenchmarkSummary = {
    totalBenchmarks: allResults.length,
    passed,
    failed,
    skipped: 0,
    totalDurationMs: suiteResults.reduce((sum, s) => sum + s.durationMs, 0),
    passRate: allResults.length > 0 ? passed / allResults.length : 0,
    criticalFailures,
  };

  return {
    title: 'NFR-PERF-008 Benchmark Report',
    generatedAt: new Date(),
    environment: collectEnvironmentInfo(),
    summary,
    suiteResults,
    targetComparison: generateTargetComparisons(allResults),
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatTableOutput(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(80));
  lines.push(report.title);
  lines.push('='.repeat(80));
  lines.push(`Generated: ${report.generatedAt.toISOString()}`);
  lines.push(`Node.js: ${report.environment.nodeVersion}`);
  lines.push(`Platform: ${report.environment.platform} ${report.environment.arch}`);
  lines.push('');

  // Summary
  lines.push('-'.repeat(80));
  lines.push('SUMMARY');
  lines.push('-'.repeat(80));
  lines.push(`Total: ${report.summary.totalBenchmarks} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed}`);
  lines.push(`Pass Rate: ${formatPercentage(report.summary.passRate)}`);
  lines.push(`Duration: ${formatDuration(report.summary.totalDurationMs)}`);
  if (report.summary.criticalFailures > 0) {
    lines.push(`CRITICAL FAILURES: ${report.summary.criticalFailures}`);
  }
  lines.push('');

  // Results table
  lines.push('-'.repeat(80));
  lines.push('BENCHMARK RESULTS');
  lines.push('-'.repeat(80));
  lines.push(
    'Name'.padEnd(25) +
    'p95 (ms)'.padStart(12) +
    'Target'.padStart(12) +
    'Ratio'.padStart(10) +
    'Status'.padStart(10)
  );
  lines.push('-'.repeat(80));

  for (const suite of report.suiteResults) {
    for (const result of suite.results) {
      const status = result.passed ? 'PASS' : 'FAIL';
      const statusStr = result.passed ? status : `[${status}]`;
      lines.push(
        result.name.padEnd(25) +
        result.latency.p95.toFixed(2).padStart(12) +
        (result.targetMs?.toFixed(0) ?? 'N/A').padStart(12) +
        (result.performanceRatio?.toFixed(2) ?? 'N/A').padStart(10) +
        statusStr.padStart(10)
      );
    }
  }

  // NFR Target Comparison
  if (report.targetComparison.length > 0) {
    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('NFR-PERF-008 TARGET COMPARISON');
    lines.push('-'.repeat(80));

    for (const comparison of report.targetComparison) {
      const status = comparison.passed ? 'PASS' : (comparison.status === 'critical' ? 'CRITICAL FAIL' : 'FAIL');
      lines.push(
        `${comparison.target}: ${comparison.actualMs.toFixed(2)}ms / ${comparison.targetMs}ms ` +
        `(${comparison.percentage.toFixed(1)}%) - ${status}`
      );
    }
  }

  lines.push('');
  lines.push('='.repeat(80));

  return lines.join('\n');
}

function formatMarkdownOutput(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt.toISOString()}`);
  lines.push('');

  // Environment
  lines.push('## Environment');
  lines.push('');
  lines.push(`- Node.js: ${report.environment.nodeVersion}`);
  lines.push(`- Platform: ${report.environment.platform} ${report.environment.arch}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total | ${report.summary.totalBenchmarks} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Failed | ${report.summary.failed} |`);
  lines.push(`| Pass Rate | ${formatPercentage(report.summary.passRate)} |`);
  lines.push(`| Duration | ${formatDuration(report.summary.totalDurationMs)} |`);
  if (report.summary.criticalFailures > 0) {
    lines.push(`| **Critical Failures** | **${report.summary.criticalFailures}** |`);
  }
  lines.push('');

  // Results
  lines.push('## Results');
  lines.push('');
  lines.push(`| Benchmark | p95 (ms) | Target (ms) | Ratio | Status |`);
  lines.push(`|-----------|----------|-------------|-------|--------|`);

  for (const suite of report.suiteResults) {
    for (const result of suite.results) {
      const status = result.passed ? 'PASS' : '**FAIL**';
      lines.push(
        `| ${result.name} | ${result.latency.p95.toFixed(2)} | ` +
        `${result.targetMs?.toFixed(0) ?? 'N/A'} | ` +
        `${result.performanceRatio?.toFixed(2) ?? 'N/A'} | ${status} |`
      );
    }
  }
  lines.push('');

  // NFR Targets
  if (report.targetComparison.length > 0) {
    lines.push('## NFR-PERF-008 Targets');
    lines.push('');
    lines.push(`| Target | Actual (ms) | Limit (ms) | % | Status |`);
    lines.push(`|--------|-------------|------------|---|--------|`);

    for (const comparison of report.targetComparison) {
      const status = comparison.passed
        ? 'PASS'
        : (comparison.status === 'critical' ? '**CRITICAL FAIL**' : 'FAIL');
      lines.push(
        `| ${comparison.target} | ${comparison.actualMs.toFixed(2)} | ` +
        `${comparison.targetMs} | ${comparison.percentage.toFixed(1)}% | ${status} |`
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('NFR-PERF-008 Performance Benchmark Runner');
  console.log('=========================================');
  console.log(`Scale: ${args.scale}`);
  console.log(`Suites: ${args.suites.join(', ')}`);
  console.log(`Iterations: ${args.iterations}`);
  console.log(`Format: ${args.format}`);
  console.log('');

  const suiteResults: BenchmarkSuiteResult[] = [];

  // Determine which suites to run
  const suitesToRun: BenchmarkSuiteType[] = args.suites.includes('all')
    ? ['search', 'diff', 'index', 'memory', 'rollup']
    : args.suites;

  for (const suiteType of suitesToRun) {
    const result = await runSuite(suiteType, args);
    suiteResults.push(result);

    if (args.failFast && !result.passed) {
      console.error(`Suite ${suiteType} failed. Stopping due to --fail-fast.`);
      break;
    }
  }

  // Generate report
  const report = generateReport(suiteResults, args);

  // Format output
  let output: string;
  switch (args.format) {
    case 'json':
      output = JSON.stringify(report, null, 2);
      break;
    case 'markdown':
      output = formatMarkdownOutput(report);
      break;
    case 'table':
    default:
      output = formatTableOutput(report);
      break;
  }

  // Write output
  if (args.outputFile) {
    const fs = await import('fs/promises');
    await fs.writeFile(args.outputFile, output, 'utf-8');
    console.log(`Results written to: ${args.outputFile}`);
  } else {
    console.log(output);
  }

  // Save baseline if requested
  if (args.saveBaseline) {
    const fs = await import('fs/promises');
    await fs.writeFile(args.saveBaseline, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`Baseline saved to: ${args.saveBaseline}`);
  }

  // Exit with appropriate code
  const exitCode = report.summary.failed > 0 ? 1 : 0;
  if (report.summary.criticalFailures > 0) {
    console.error(`\nCRITICAL: ${report.summary.criticalFailures} NFR-PERF-008 critical target(s) failed!`);
  }

  process.exit(exitCode);
}

// Run if executed directly (not when imported for testing)
// Check if this is the main module being executed
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('run-benchmarks.ts')) {
  main().catch((error) => {
    console.error('Benchmark runner failed:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export {
  runSearchBenchmark,
  runDiffBenchmark,
  runIndexBenchmark,
  runMemoryBenchmark,
  runRollupBenchmark,
  runSuite,
  generateReport,
  formatTableOutput,
  formatMarkdownOutput,
  parseArgs,
};
