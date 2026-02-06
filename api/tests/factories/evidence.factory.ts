/**
 * Evidence Test Factories
 * @module tests/factories/evidence
 *
 * Factory functions for creating evidence and scoring test data.
 */

import type {
  Evidence,
  EvidenceType,
  EvidenceCategory,
  EvidenceMethod,
  EvidenceLocation,
  EvidenceCollection,
  ConfidenceScore,
  ConfidenceLevel,
  ConfidenceBreakdown,
  ScoringRule,
  ScoringCondition,
} from '@/types/evidence';

// ============================================================================
// Evidence Location Factories
// ============================================================================

export function createEvidenceLocation(
  overrides: Partial<EvidenceLocation> = {}
): EvidenceLocation {
  return {
    file: 'main.tf',
    lines: { start: 1, end: 5 },
    ...overrides,
  };
}

// ============================================================================
// Evidence Factories
// ============================================================================

let evidenceCounter = 0;

export interface EvidenceOptions {
  id?: string;
  type?: EvidenceType;
  description?: string;
  category?: EvidenceCategory;
  location?: Partial<EvidenceLocation>;
  confidence?: number;
  raw?: unknown;
  method?: EvidenceMethod;
}

export function createEvidence(options: EvidenceOptions = {}): Evidence {
  evidenceCounter++;

  const {
    id = `evidence-${evidenceCounter}`,
    type = 'explicit_reference',
    description = 'Test evidence',
    category = 'syntax',
    location = {},
    confidence = 85,
    raw,
    method = 'ast_analysis',
  } = options;

  return {
    id,
    type,
    description,
    category,
    location: createEvidenceLocation(location),
    confidence,
    raw,
    collectedAt: new Date(),
    method,
  };
}

export function createExplicitReferenceEvidence(
  targetRef: string,
  confidence: number = 95
): Evidence {
  return createEvidence({
    type: 'explicit_reference',
    description: `Direct reference to ${targetRef}`,
    category: 'syntax',
    confidence,
  });
}

export function createDependsOnEvidence(
  dependency: string,
  confidence: number = 98
): Evidence {
  return createEvidence({
    type: 'depends_on_directive',
    description: `Explicit depends_on to ${dependency}`,
    category: 'explicit',
    confidence,
  });
}

export function createModuleSourceEvidence(
  source: string,
  confidence: number = 95
): Evidence {
  return createEvidence({
    type: 'module_source',
    description: `Module source: ${source}`,
    category: 'explicit',
    confidence,
  });
}

export function createHeuristicEvidence(
  pattern: string,
  confidence: number = 60
): Evidence {
  return createEvidence({
    type: 'naming_convention',
    description: `Naming pattern match: ${pattern}`,
    category: 'heuristic',
    confidence,
    method: 'rule_engine',
  });
}

export function createInterpolationEvidence(
  expression: string,
  confidence: number = 85
): Evidence {
  return createEvidence({
    type: 'interpolation',
    description: `String interpolation: ${expression}`,
    category: 'semantic',
    confidence,
    method: 'semantic_analysis',
  });
}

export function createFunctionCallEvidence(
  funcName: string,
  args: string[],
  confidence: number = 80
): Evidence {
  return createEvidence({
    type: 'function_call',
    description: `Function call: ${funcName}(${args.join(', ')})`,
    category: 'semantic',
    confidence,
    method: 'ast_analysis',
  });
}

export function createLabelMatchingEvidence(
  selector: string,
  matched: string,
  confidence: number = 90
): Evidence {
  return createEvidence({
    type: 'label_matching',
    description: `Label selector ${selector} matches ${matched}`,
    category: 'structural',
    confidence,
    method: 'graph_traversal',
  });
}

// ============================================================================
// Evidence Collection Factories
// ============================================================================

export function createEvidenceCollection(
  items: Evidence[] = [],
  overrides: Partial<EvidenceCollection> = {}
): EvidenceCollection {
  const aggregatedConfidence = items.length > 0
    ? items.reduce((sum, e) => sum + e.confidence, 0) / items.length
    : 0;

  const primaryEvidence = items.length > 0
    ? items.reduce((max, e) => e.confidence > max.confidence ? e : max, items[0])
    : null;

  const countByType: Record<EvidenceType, number> = {} as Record<EvidenceType, number>;
  const countByCategory: Record<EvidenceCategory, number> = {} as Record<EvidenceCategory, number>;

  for (const item of items) {
    countByType[item.type] = (countByType[item.type] ?? 0) + 1;
    countByCategory[item.category] = (countByCategory[item.category] ?? 0) + 1;
  }

  return {
    items,
    aggregatedConfidence: Math.round(aggregatedConfidence),
    primaryEvidence,
    countByType,
    countByCategory,
    ...overrides,
  };
}

export function createHighConfidenceCollection(): EvidenceCollection {
  return createEvidenceCollection([
    createDependsOnEvidence('aws_vpc.main'),
    createExplicitReferenceEvidence('aws_vpc.main.id'),
    createModuleSourceEvidence('./modules/vpc'),
  ]);
}

export function createLowConfidenceCollection(): EvidenceCollection {
  return createEvidenceCollection([
    createHeuristicEvidence('vpc-*', 55),
    createEvidence({
      type: 'resource_proximity',
      description: 'Resources in same file',
      category: 'heuristic',
      confidence: 40,
    }),
  ]);
}

export function createMixedConfidenceCollection(): EvidenceCollection {
  return createEvidenceCollection([
    createExplicitReferenceEvidence('aws_instance.web.id', 90),
    createHeuristicEvidence('web-server', 50),
    createInterpolationEvidence('${aws_instance.web.private_ip}', 75),
  ]);
}

// ============================================================================
// Confidence Score Factories
// ============================================================================

export function createConfidenceBreakdown(
  overrides: Partial<ConfidenceBreakdown> = {}
): ConfidenceBreakdown {
  return {
    baseScore: 70,
    evidenceMultiplier: 1.2,
    explicitBonus: 10,
    heuristicPenalty: 0,
    patternBonus: 5,
    ...overrides,
  };
}

export function createConfidenceScore(
  overrides: Partial<ConfidenceScore> = {}
): ConfidenceScore {
  const value = overrides.value ?? 85;
  const level = overrides.level ?? getConfidenceLevel(value);

  return {
    value,
    breakdown: overrides.breakdown ?? createConfidenceBreakdown(),
    level,
    positiveFactors: overrides.positiveFactors ?? ['Explicit reference found'],
    negativeFactors: overrides.negativeFactors ?? [],
  };
}

export function createCertainConfidenceScore(): ConfidenceScore {
  return createConfidenceScore({
    value: 98,
    level: 'certain',
    breakdown: createConfidenceBreakdown({
      baseScore: 90,
      explicitBonus: 20,
    }),
    positiveFactors: [
      'Explicit depends_on declaration',
      'Multiple evidence sources',
    ],
  });
}

export function createHighConfidenceScore(): ConfidenceScore {
  return createConfidenceScore({
    value: 85,
    level: 'high',
    positiveFactors: ['Direct attribute reference', 'Semantic analysis confirmed'],
  });
}

export function createMediumConfidenceScore(): ConfidenceScore {
  return createConfidenceScore({
    value: 65,
    level: 'medium',
    breakdown: createConfidenceBreakdown({
      baseScore: 60,
      evidenceMultiplier: 1.0,
      explicitBonus: 5,
    }),
    positiveFactors: ['Interpolation reference'],
    negativeFactors: ['Single evidence source'],
  });
}

export function createLowConfidenceScore(): ConfidenceScore {
  return createConfidenceScore({
    value: 45,
    level: 'low',
    breakdown: createConfidenceBreakdown({
      baseScore: 50,
      evidenceMultiplier: 0.9,
      explicitBonus: 0,
      heuristicPenalty: 10,
    }),
    positiveFactors: ['Naming pattern match'],
    negativeFactors: ['Heuristic-only evidence', 'No explicit declaration'],
  });
}

export function createUncertainConfidenceScore(): ConfidenceScore {
  return createConfidenceScore({
    value: 25,
    level: 'uncertain',
    breakdown: createConfidenceBreakdown({
      baseScore: 30,
      evidenceMultiplier: 0.8,
      explicitBonus: 0,
      heuristicPenalty: 15,
      patternBonus: 0,
    }),
    positiveFactors: [],
    negativeFactors: ['Weak heuristic evidence only', 'No semantic confirmation'],
  });
}

// ============================================================================
// Scoring Rule Factories
// ============================================================================

export function createScoringCondition(
  overrides: Partial<ScoringCondition> = {}
): ScoringCondition {
  return {
    field: 'confidence',
    operator: 'gt',
    value: 50,
    ...overrides,
  };
}

export function createScoringRule(
  overrides: Partial<ScoringRule> = {}
): ScoringRule {
  return {
    id: `rule-${Date.now()}`,
    name: 'Test Rule',
    description: 'A test scoring rule',
    appliesTo: ['explicit_reference'],
    baseScore: 20,
    multiplier: 1.0,
    conditions: [],
    priority: 50,
    ...overrides,
  };
}

export function createExplicitReferenceRule(): ScoringRule {
  return createScoringRule({
    id: 'explicit-reference-rule',
    name: 'Explicit Reference',
    description: 'Bonus for explicit attribute references',
    appliesTo: ['explicit_reference', 'depends_on_directive'],
    baseScore: 35,
    multiplier: 1.2,
    priority: 100,
  });
}

export function createHeuristicPenaltyRule(): ScoringRule {
  return createScoringRule({
    id: 'heuristic-penalty-rule',
    name: 'Heuristic Penalty',
    description: 'Penalty for heuristic-only evidence',
    appliesTo: ['naming_convention', 'resource_proximity'],
    baseScore: -10,
    multiplier: 1.0,
    priority: 20,
    conditions: [
      createScoringCondition({
        field: 'confidence',
        operator: 'lt',
        value: 60,
      }),
    ],
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 95) return 'certain';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'uncertain';
}

/**
 * Reset evidence counter (useful for test isolation)
 */
export function resetEvidenceCounter(): void {
  evidenceCounter = 0;
}
