/**
 * Service Mock Utilities
 * @module tests/mocks/services.mock
 *
 * Provides mock implementations for core services used in the
 * IaC Dependency Detection system.
 *
 * TASK-DETECT-001 through TASK-DETECT-010 implementation
 * Agent #33 of 47 | Phase 5: Testing
 */

import { vi, type Mock } from 'vitest';
import type { NodeType, GraphEdge, DependencyGraph } from '@/types/graph';
import type { Evidence, ConfidenceScore, ConfidenceLevel } from '@/types/evidence';

/**
 * Mock Parser Orchestrator
 */
export interface MockParserOrchestrator {
  parseFiles: Mock;
  parseFile: Mock;
  registerParser: Mock;
  getParser: Mock;
  getSupportedExtensions: Mock;
  getStats: Mock;
}

export function createMockParserOrchestrator(
  defaultNodes: NodeType[] = []
): MockParserOrchestrator {
  return {
    parseFiles: vi.fn().mockResolvedValue({
      nodes: defaultNodes,
      errors: [],
      stats: {
        filesProcessed: 1,
        totalDuration: 100,
        parseErrors: 0,
      },
    }),

    parseFile: vi.fn().mockResolvedValue({
      nodes: defaultNodes,
      errors: [],
    }),

    registerParser: vi.fn(),

    getParser: vi.fn().mockReturnValue({
      parse: vi.fn().mockResolvedValue({ nodes: defaultNodes, errors: [] }),
      supports: vi.fn().mockReturnValue(true),
    }),

    getSupportedExtensions: vi.fn().mockReturnValue(['.tf', '.yaml', '.yml']),

    getStats: vi.fn().mockReturnValue({
      parsersRegistered: 3,
      filesParsed: 0,
      totalParseTime: 0,
    }),
  };
}

/**
 * Mock Detection Orchestrator
 */
export interface MockDetectionOrchestrator {
  detect: Mock;
  detectDependencies: Mock;
  registerDetector: Mock;
  getDetector: Mock;
  runDetector: Mock;
  getStats: Mock;
}

export function createMockDetectionOrchestrator(
  defaultEdges: GraphEdge[] = [],
  defaultEvidence: Evidence[] = []
): MockDetectionOrchestrator {
  return {
    detect: vi.fn().mockResolvedValue({
      edges: defaultEdges,
      evidence: defaultEvidence,
      stats: {
        detectorsRun: 3,
        edgesCreated: defaultEdges.length,
        evidenceCollected: defaultEvidence.length,
        totalDuration: 50,
      },
    }),

    detectDependencies: vi.fn().mockResolvedValue({
      edges: defaultEdges,
      evidence: defaultEvidence,
    }),

    registerDetector: vi.fn(),

    getDetector: vi.fn().mockReturnValue({
      detect: vi.fn().mockResolvedValue({ edges: defaultEdges, evidence: defaultEvidence }),
      name: 'mock-detector',
    }),

    runDetector: vi.fn().mockResolvedValue({
      edges: defaultEdges,
      evidence: defaultEvidence,
    }),

    getStats: vi.fn().mockReturnValue({
      detectorsRegistered: 5,
      totalDetections: 0,
      totalEdgesFound: 0,
    }),
  };
}

/**
 * Mock Scoring Service
 */
export interface MockScoringService {
  scoreEdges: Mock;
  scoreEvidence: Mock;
  calculateConfidence: Mock;
  getLevel: Mock;
  validate: Mock;
  merge: Mock;
}

export function createMockScoringService(
  defaultConfidence: number = 85
): MockScoringService {
  const getLevel = (value: number): ConfidenceLevel => {
    if (value >= 95) return 'certain';
    if (value >= 80) return 'high';
    if (value >= 60) return 'medium';
    if (value >= 40) return 'low';
    return 'uncertain';
  };

  return {
    scoreEdges: vi.fn().mockImplementation((edges: GraphEdge[]) =>
      edges.map((edge) => ({
        edgeId: edge.id,
        confidence: defaultConfidence,
        level: getLevel(defaultConfidence),
      }))
    ),

    scoreEvidence: vi.fn().mockImplementation((evidence: Evidence[]) => ({
      value: defaultConfidence,
      level: getLevel(defaultConfidence),
      positiveFactors: ['Multiple evidence sources'],
      negativeFactors: [],
      breakdown: { base: 50, adjustments: defaultConfidence - 50 },
    })),

    calculateConfidence: vi.fn().mockReturnValue(defaultConfidence),

    getLevel: vi.fn().mockImplementation(getLevel),

    validate: vi.fn().mockReturnValue(true),

    merge: vi.fn().mockImplementation((scores: ConfidenceScore[]) => {
      if (scores.length === 0) {
        return {
          value: 0,
          level: 'uncertain' as ConfidenceLevel,
          positiveFactors: [],
          negativeFactors: [],
          breakdown: { base: 0, adjustments: 0 },
        };
      }
      const avg = scores.reduce((sum, s) => sum + s.value, 0) / scores.length;
      return {
        value: avg,
        level: getLevel(avg),
        positiveFactors: scores.flatMap((s) => s.positiveFactors),
        negativeFactors: scores.flatMap((s) => s.negativeFactors),
        breakdown: { base: avg, adjustments: 0 },
      };
    }),
  };
}

/**
 * Mock Graph Service
 */
export interface MockGraphService {
  buildGraph: Mock;
  getGraph: Mock;
  addNode: Mock;
  addEdge: Mock;
  removeNode: Mock;
  removeEdge: Mock;
  getImpactAnalysis: Mock;
  findPath: Mock;
  getAncestors: Mock;
  getDescendants: Mock;
  validate: Mock;
  merge: Mock;
  clear: Mock;
}

export function createMockGraphService(): MockGraphService {
  const nodes = new Map<string, NodeType>();
  const edges: GraphEdge[] = [];

  const buildGraph = (): DependencyGraph => ({
    id: `graph-${Date.now()}`,
    nodes,
    edges,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      sourceFiles: [],
      nodeCounts: {},
      edgeCounts: {},
      buildTimeMs: 0,
    },
  });

  return {
    buildGraph: vi.fn().mockImplementation(() => Promise.resolve(buildGraph())),

    getGraph: vi.fn().mockImplementation(() => buildGraph()),

    addNode: vi.fn().mockImplementation((node: NodeType) => {
      nodes.set(node.id, node);
      return node;
    }),

    addEdge: vi.fn().mockImplementation((edge: GraphEdge) => {
      edges.push(edge);
      return edge;
    }),

    removeNode: vi.fn().mockImplementation((id: string) => {
      return nodes.delete(id);
    }),

    removeEdge: vi.fn().mockImplementation((id: string) => {
      const index = edges.findIndex((e) => e.id === id);
      if (index >= 0) {
        edges.splice(index, 1);
        return true;
      }
      return false;
    }),

    getImpactAnalysis: vi.fn().mockResolvedValue({
      impactedNodes: [],
      depth: 0,
      paths: [],
    }),

    findPath: vi.fn().mockResolvedValue([]),

    getAncestors: vi.fn().mockResolvedValue([]),

    getDescendants: vi.fn().mockResolvedValue([]),

    validate: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
    }),

    merge: vi.fn().mockImplementation((graphs: DependencyGraph[]) => {
      const merged = buildGraph();
      for (const g of graphs) {
        for (const [id, node] of g.nodes) {
          merged.nodes.set(id, node);
        }
        merged.edges.push(...g.edges);
      }
      return merged;
    }),

    clear: vi.fn().mockImplementation(() => {
      nodes.clear();
      edges.length = 0;
    }),
  };
}

/**
 * Mock Scan Service
 */
export interface MockScanService {
  createScan: Mock;
  getScan: Mock;
  updateScanStatus: Mock;
  completeScan: Mock;
  failScan: Mock;
  listScans: Mock;
  deleteScan: Mock;
}

export function createMockScanService(): MockScanService {
  const scans = new Map<string, any>();

  return {
    createScan: vi.fn().mockImplementation((input: any) => {
      const scan = {
        id: `scan-${Date.now()}`,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      };
      scans.set(scan.id, scan);
      return Promise.resolve(scan);
    }),

    getScan: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(scans.get(id) ?? null)
    ),

    updateScanStatus: vi.fn().mockImplementation((id: string, status: string) => {
      const scan = scans.get(id);
      if (scan) {
        scan.status = status;
        scan.updatedAt = new Date();
      }
      return Promise.resolve(scan ?? null);
    }),

    completeScan: vi.fn().mockImplementation((id: string, result: any) => {
      const scan = scans.get(id);
      if (scan) {
        scan.status = 'completed';
        scan.result = result;
        scan.completedAt = new Date();
        scan.updatedAt = new Date();
      }
      return Promise.resolve(scan ?? null);
    }),

    failScan: vi.fn().mockImplementation((id: string, error: string) => {
      const scan = scans.get(id);
      if (scan) {
        scan.status = 'failed';
        scan.error = error;
        scan.updatedAt = new Date();
      }
      return Promise.resolve(scan ?? null);
    }),

    listScans: vi.fn().mockImplementation(() =>
      Promise.resolve(Array.from(scans.values()))
    ),

    deleteScan: vi.fn().mockImplementation((id: string) => {
      const existed = scans.has(id);
      scans.delete(id);
      return Promise.resolve(existed);
    }),
  };
}

/**
 * Mock File Service
 */
export interface MockFileService {
  readFile: Mock;
  readFiles: Mock;
  writeFile: Mock;
  deleteFile: Mock;
  listFiles: Mock;
  exists: Mock;
  getMetadata: Mock;
}

export function createMockFileService(
  initialFiles: Record<string, string> = {}
): MockFileService {
  const files = new Map<string, { content: string; metadata: any }>(
    Object.entries(initialFiles).map(([path, content]) => [
      path,
      { content, metadata: { size: content.length, createdAt: new Date() } },
    ])
  );

  return {
    readFile: vi.fn().mockImplementation((path: string) => {
      const file = files.get(path);
      return Promise.resolve(file?.content ?? null);
    }),

    readFiles: vi.fn().mockImplementation((paths: string[]) =>
      Promise.resolve(
        paths.map((path) => ({
          path,
          content: files.get(path)?.content ?? null,
          error: files.has(path) ? null : 'File not found',
        }))
      )
    ),

    writeFile: vi.fn().mockImplementation((path: string, content: string) => {
      files.set(path, {
        content,
        metadata: { size: content.length, createdAt: new Date() },
      });
      return Promise.resolve(true);
    }),

    deleteFile: vi.fn().mockImplementation((path: string) => {
      const existed = files.has(path);
      files.delete(path);
      return Promise.resolve(existed);
    }),

    listFiles: vi.fn().mockImplementation((pattern?: string) => {
      let paths = Array.from(files.keys());
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        paths = paths.filter((p) => regex.test(p));
      }
      return Promise.resolve(paths);
    }),

    exists: vi.fn().mockImplementation((path: string) =>
      Promise.resolve(files.has(path))
    ),

    getMetadata: vi.fn().mockImplementation((path: string) =>
      Promise.resolve(files.get(path)?.metadata ?? null)
    ),
  };
}

/**
 * Mock Logger
 */
export interface MockLogger {
  info: Mock;
  warn: Mock;
  error: Mock;
  debug: Mock;
  trace: Mock;
  fatal: Mock;
  child: Mock;
}

export function createMockLogger(): MockLogger {
  const logger: MockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };

  logger.child.mockReturnValue(logger);

  return logger;
}

/**
 * Default mock instances for global use
 */
export const mockParserOrchestrator = createMockParserOrchestrator();
export const mockDetectionOrchestrator = createMockDetectionOrchestrator();
export const mockScoringService = createMockScoringService();
export const mockGraphService = createMockGraphService();
export const mockScanService = createMockScanService();
export const mockFileService = createMockFileService();
export const mockLogger = createMockLogger();
