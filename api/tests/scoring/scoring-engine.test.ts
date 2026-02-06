/**
 * Scoring Engine Tests
 * @module tests/scoring/scoring-engine
 *
 * Unit tests for confidence scoring engine.
 * TASK-DETECT-009: Confidence scoring implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScoringEngine,
  RuleEngine,
  createScoringEngine,
  evaluateRules,
  normalizeScore,
  DEFAULT_SCORING_CONFIG,
  CONFIDENCE_THRESHOLDS,
} from '@/scoring/scoring-engine';
import {
  createEvidence,
  createExplicitReferenceEvidence,
  createDependsOnEvidence,
  createHeuristicEvidence,
  createInterpolationEvidence,
  createFunctionCallEvidence,
  createScoringRule,
  createScoringCondition,
  createExplicitReferenceRule,
  createHeuristicPenaltyRule,
  resetEvidenceCounter,
} from '../factories/evidence.factory';
import type { Evidence, EvidenceType, ScoringRule, ScoringCondition } from '@/types/evidence';

describe('ScoringEngine', () => {
  let engine: ScoringEngine;

  beforeEach(() => {
    engine = new ScoringEngine();
    resetEvidenceCounter();
  });

  describe('calculate', () => {
    it('should return zero score for empty evidence', () => {
      const result = engine.calculate({ evidence: [] });

      expect(result.value).toBe(0);
      expect(result.level).toBe('uncertain');
      expect(result.negativeFactors).toContain('No evidence provided');
    });

    it('should calculate high confidence for explicit evidence', () => {
      // Use single explicit evidence to avoid +20 bonus from multiple explicit items
      // Base: 75 * 1.0 = 75, Explicit bonus: 10, rules may add more, cap at <95
      const evidence: Evidence[] = [
        createDependsOnEvidence('aws_vpc.main', 75),
      ];

      const result = engine.calculate({ evidence });

      expect(result.value).toBeGreaterThanOrEqual(80);
      expect(result.value).toBeLessThan(95); // High is 80-94, certain is >= 95
      expect(result.level).toBe('high');
      expect(result.positiveFactors.length).toBeGreaterThan(0);
    });

    it('should calculate medium confidence for semantic evidence', () => {
      const evidence: Evidence[] = [
        createInterpolationEvidence('${aws_instance.web.id}', 75),
      ];

      const result = engine.calculate({ evidence });

      expect(result.value).toBeGreaterThanOrEqual(60);
      expect(result.value).toBeLessThan(95);
    });

    it('should apply heuristic penalty for heuristic-only evidence', () => {
      const evidence: Evidence[] = [
        createHeuristicEvidence('vpc-*', 45),
        createEvidence({
          type: 'resource_proximity',
          description: 'Same file',
          category: 'heuristic',
          confidence: 40,
        }),
      ];

      const result = engine.calculate({ evidence });

      expect(result.breakdown.heuristicPenalty).toBeGreaterThan(0);
      expect(result.negativeFactors.some(f => f.includes('Heuristic'))).toBe(true);
    });

    it('should apply explicit bonus for explicit evidence', () => {
      const evidence: Evidence[] = [
        createEvidence({
          type: 'depends_on_directive',
          description: 'Explicit depends_on',
          category: 'explicit',
          confidence: 98,
        }),
      ];

      const result = engine.calculate({ evidence });

      expect(result.breakdown.explicitBonus).toBeGreaterThan(0);
    });

    it('should apply pattern bonus for multiple categories', () => {
      const evidence: Evidence[] = [
        createEvidence({ type: 'explicit_reference', category: 'syntax', confidence: 90 }),
        createEvidence({ type: 'interpolation', category: 'semantic', confidence: 80 }),
        createEvidence({ type: 'block_nesting', category: 'structural', confidence: 70 }),
      ];

      const result = engine.calculate({ evidence });

      expect(result.breakdown.patternBonus).toBeGreaterThan(0);
      expect(result.positiveFactors.some(f => f.includes('multiple categories'))).toBe(true);
    });

    it('should apply evidence multiplier with diminishing returns', () => {
      const singleEvidence: Evidence[] = [
        createExplicitReferenceEvidence('ref1', 90),
      ];

      const multipleEvidence: Evidence[] = [
        createExplicitReferenceEvidence('ref1', 90),
        createExplicitReferenceEvidence('ref2', 90),
        createExplicitReferenceEvidence('ref3', 90),
      ];

      const singleResult = engine.calculate({ evidence: singleEvidence });
      const multipleResult = engine.calculate({ evidence: multipleEvidence });

      expect(multipleResult.breakdown.evidenceMultiplier).toBeGreaterThan(
        singleResult.breakdown.evidenceMultiplier
      );
      // But not 3x higher due to diminishing returns
      expect(multipleResult.breakdown.evidenceMultiplier).toBeLessThan(1.5);
    });

    it('should respect custom configuration', () => {
      const evidence: Evidence[] = [
        createHeuristicEvidence('pattern', 50),
      ];

      const result = engine.calculate({
        evidence,
        config: {
          heuristicWeight: 0.3, // Lower weight
        },
      });

      // Lower weight should result in lower score
      expect(result.value).toBeLessThan(50);
    });

    it('should apply custom rules', () => {
      const customRule: ScoringRule = createScoringRule({
        id: 'custom-bonus',
        name: 'Custom Bonus',
        appliesTo: ['explicit_reference'],
        baseScore: 50,
        multiplier: 1.5,
        priority: 200,
      });

      const evidence: Evidence[] = [
        createExplicitReferenceEvidence('test', 80),
      ];

      const resultWithRule = engine.calculate({
        evidence,
        customRules: [customRule],
      });

      const resultWithoutRule = engine.calculate({ evidence });

      // Custom rule should increase the score
      expect(resultWithRule.value).toBeGreaterThan(resultWithoutRule.value);
    });

    it('should normalize score to bounds', () => {
      const veryHighEvidence: Evidence[] = Array.from({ length: 10 }, (_, i) =>
        createDependsOnEvidence(`ref${i}`, 100)
      );

      const result = engine.calculate({ evidence: veryHighEvidence });

      expect(result.value).toBeLessThanOrEqual(100);
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it('should collect positive factors', () => {
      const evidence: Evidence[] = [
        createEvidence({ category: 'explicit', confidence: 95 }),
        createEvidence({ category: 'syntax', confidence: 85 }),
      ];

      const result = engine.calculate({ evidence });

      expect(result.positiveFactors.some(f => f.includes('Explicit'))).toBe(true);
      expect(result.positiveFactors.some(f => f.includes('Multiple'))).toBe(true);
    });
  });

  describe('getLevel', () => {
    it('should return certain for 95+', () => {
      expect(engine.getLevel(95)).toBe('certain');
      expect(engine.getLevel(100)).toBe('certain');
    });

    it('should return high for 80-94', () => {
      expect(engine.getLevel(80)).toBe('high');
      expect(engine.getLevel(94)).toBe('high');
    });

    it('should return medium for 60-79', () => {
      expect(engine.getLevel(60)).toBe('medium');
      expect(engine.getLevel(79)).toBe('medium');
    });

    it('should return low for 40-59', () => {
      expect(engine.getLevel(40)).toBe('low');
      expect(engine.getLevel(59)).toBe('low');
    });

    it('should return uncertain for 0-39', () => {
      expect(engine.getLevel(0)).toBe('uncertain');
      expect(engine.getLevel(39)).toBe('uncertain');
    });
  });

  describe('validate', () => {
    it('should validate correct confidence score', () => {
      const score = engine.calculate({
        evidence: [createExplicitReferenceEvidence('test', 90)],
      });

      expect(engine.validate(score)).toBe(true);
    });

    it('should reject score with mismatched level', () => {
      const score = {
        value: 95,
        level: 'low' as const, // Wrong level for 95
        breakdown: {
          baseScore: 95,
          evidenceMultiplier: 1,
          explicitBonus: 0,
          heuristicPenalty: 0,
          patternBonus: 0,
        },
        positiveFactors: [],
        negativeFactors: [],
      };

      expect(engine.validate(score)).toBe(false);
    });

    it('should reject out-of-bounds score', () => {
      const score = {
        value: 150, // Out of bounds
        level: 'certain' as const,
        breakdown: {
          baseScore: 150,
          evidenceMultiplier: 1,
          explicitBonus: 0,
          heuristicPenalty: 0,
          patternBonus: 0,
        },
        positiveFactors: [],
        negativeFactors: [],
      };

      expect(engine.validate(score)).toBe(false);
    });
  });

  describe('merge', () => {
    it('should return empty score for empty array', () => {
      const result = engine.merge([]);

      expect(result.value).toBe(0);
      expect(result.level).toBe('uncertain');
    });

    it('should return same score for single item', () => {
      const score = engine.calculate({
        evidence: [createExplicitReferenceEvidence('test', 85)],
      });

      const merged = engine.merge([score]);

      expect(merged.value).toBe(score.value);
    });

    it('should merge multiple scores with weighted average', () => {
      const score1 = engine.calculate({
        evidence: [createDependsOnEvidence('ref1', 95)],
      });
      const score2 = engine.calculate({
        evidence: [createHeuristicEvidence('pattern', 45)],
      });

      const merged = engine.merge([score1, score2]);

      // Should be between the two scores
      expect(merged.value).toBeLessThan(score1.value);
      expect(merged.value).toBeGreaterThan(score2.value);
    });

    it('should merge positive and negative factors', () => {
      const score1 = engine.calculate({
        evidence: [createDependsOnEvidence('ref1', 95)],
      });
      const score2 = engine.calculate({
        evidence: [createHeuristicEvidence('pattern', 45)],
      });

      const merged = engine.merge([score1, score2]);

      // Should contain factors from both
      expect(merged.positiveFactors.length).toBeGreaterThan(0);
    });

    it('should merge breakdowns', () => {
      const score1 = engine.calculate({
        evidence: [createEvidence({ category: 'explicit', confidence: 90 })],
      });
      const score2 = engine.calculate({
        evidence: [createHeuristicEvidence('pattern', 50)],
      });

      const merged = engine.merge([score1, score2]);

      expect(merged.breakdown.explicitBonus).toBeGreaterThan(0);
    });
  });
});

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    resetEvidenceCounter();
  });

  describe('evaluate', () => {
    it('should evaluate rules against evidence', () => {
      const rules: ScoringRule[] = [createExplicitReferenceRule()];
      const evidence: Evidence[] = [
        createExplicitReferenceEvidence('test', 90),
      ];

      const results = ruleEngine.evaluate(evidence, rules);

      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].scoreContribution).toBeGreaterThan(0);
    });

    it('should not match rules for wrong evidence type', () => {
      const rules: ScoringRule[] = [createExplicitReferenceRule()];
      const evidence: Evidence[] = [
        createHeuristicEvidence('pattern', 50),
      ];

      const results = ruleEngine.evaluate(evidence, rules);

      expect(results[0].matched).toBe(false);
      expect(results[0].scoreContribution).toBe(0);
    });

    it('should evaluate conditions', () => {
      const rule: ScoringRule = createScoringRule({
        appliesTo: ['explicit_reference'],
        conditions: [
          createScoringCondition({ field: 'confidence', operator: 'gt', value: 80 }),
        ],
      });

      const highConfidence = createExplicitReferenceEvidence('test', 90);
      const lowConfidence = createExplicitReferenceEvidence('test2', 60);

      const highResults = ruleEngine.evaluate([highConfidence], [rule]);
      const lowResults = ruleEngine.evaluate([lowConfidence], [rule]);

      expect(highResults[0].matched).toBe(true);
      expect(lowResults[0].matched).toBe(false);
    });

    it('should sort rules by priority', () => {
      const lowPriority = createScoringRule({ id: 'low', priority: 10 });
      const highPriority = createScoringRule({ id: 'high', priority: 100 });

      const evidence: Evidence[] = [createEvidence()];
      const results = ruleEngine.evaluate(evidence, [lowPriority, highPriority]);

      // First result should be from high priority rule
      expect(results[0].rule.id).toBe('high');
    });

    it('should calculate score contribution based on matched evidence count', () => {
      const rule: ScoringRule = createScoringRule({
        appliesTo: ['explicit_reference'],
        baseScore: 10,
        multiplier: 1.0,
      });

      const evidence: Evidence[] = [
        createExplicitReferenceEvidence('test1', 90),
        createExplicitReferenceEvidence('test2', 85),
        createExplicitReferenceEvidence('test3', 80),
      ];

      const results = ruleEngine.evaluate(evidence, [rule]);

      // 3 matches * 10 baseScore * 1.0 multiplier = 30
      expect(results[0].scoreContribution).toBe(30);
    });
  });

  describe('matchCondition', () => {
    const evidence = createEvidence({ confidence: 75 });

    it('should match equals condition', () => {
      const condition: ScoringCondition = {
        field: 'type',
        operator: 'equals',
        value: 'explicit_reference',
      };

      expect(ruleEngine.matchCondition(evidence, condition)).toBe(true);
    });

    it('should not match equals with wrong value', () => {
      const condition: ScoringCondition = {
        field: 'type',
        operator: 'equals',
        value: 'heuristic',
      };

      expect(ruleEngine.matchCondition(evidence, condition)).toBe(false);
    });

    it('should match contains condition', () => {
      const evidenceWithDesc = createEvidence({
        description: 'Reference to aws_vpc.main',
      });
      const condition: ScoringCondition = {
        field: 'description',
        operator: 'contains',
        value: 'aws_vpc',
      };

      expect(ruleEngine.matchCondition(evidenceWithDesc, condition)).toBe(true);
    });

    it('should match regex condition', () => {
      const evidenceWithDesc = createEvidence({
        description: 'Reference to aws_vpc.main.id',
      });
      const condition: ScoringCondition = {
        field: 'description',
        operator: 'matches',
        value: 'aws_[a-z]+\\.[a-z]+',
      };

      expect(ruleEngine.matchCondition(evidenceWithDesc, condition)).toBe(true);
    });

    it('should match greater than condition', () => {
      const condition: ScoringCondition = {
        field: 'confidence',
        operator: 'gt',
        value: 70,
      };

      expect(ruleEngine.matchCondition(evidence, condition)).toBe(true);
    });

    it('should match less than condition', () => {
      const condition: ScoringCondition = {
        field: 'confidence',
        operator: 'lt',
        value: 80,
      };

      expect(ruleEngine.matchCondition(evidence, condition)).toBe(true);
    });

    it('should match exists condition', () => {
      const condition: ScoringCondition = {
        field: 'category',
        operator: 'exists',
        value: true,
      };

      expect(ruleEngine.matchCondition(evidence, condition)).toBe(true);
    });

    it('should handle nested field access', () => {
      const evidenceWithLocation = createEvidence({
        location: { file: 'main.tf', lines: { start: 1, end: 5 } },
      });
      const condition: ScoringCondition = {
        field: 'location.file',
        operator: 'equals',
        value: 'main.tf',
      };

      expect(ruleEngine.matchCondition(evidenceWithLocation, condition)).toBe(true);
    });
  });

  describe('getApplicableRules', () => {
    it('should filter rules by evidence type', () => {
      const rules: ScoringRule[] = [
        createScoringRule({ appliesTo: ['explicit_reference'] }),
        createScoringRule({ appliesTo: ['naming_convention'] }),
        createScoringRule({ appliesTo: ['explicit_reference', 'interpolation'] }),
      ];

      const applicable = ruleEngine.getApplicableRules('explicit_reference', rules);

      expect(applicable).toHaveLength(2);
    });

    it('should return empty array for no matching rules', () => {
      const rules: ScoringRule[] = [
        createScoringRule({ appliesTo: ['naming_convention'] }),
      ];

      const applicable = ruleEngine.getApplicableRules('explicit_reference', rules);

      expect(applicable).toHaveLength(0);
    });
  });
});

describe('normalizeScore', () => {
  it('should return value within bounds', () => {
    expect(normalizeScore(50, 0, 100)).toBe(50);
  });

  it('should clamp to minimum', () => {
    expect(normalizeScore(-10, 0, 100)).toBe(0);
  });

  it('should clamp to maximum', () => {
    expect(normalizeScore(150, 0, 100)).toBe(100);
  });

  it('should handle custom bounds', () => {
    expect(normalizeScore(5, 10, 20)).toBe(10);
    expect(normalizeScore(25, 10, 20)).toBe(20);
    expect(normalizeScore(15, 10, 20)).toBe(15);
  });
});

describe('evaluateRules convenience function', () => {
  it('should evaluate rules using new engine instance', () => {
    const rules: ScoringRule[] = [createExplicitReferenceRule()];
    const evidence: Evidence[] = [createExplicitReferenceEvidence('test', 90)];

    const results = evaluateRules(evidence, rules);

    expect(results).toHaveLength(1);
    expect(results[0].matched).toBe(true);
  });
});

describe('createScoringEngine factory', () => {
  it('should create engine with default config', () => {
    const engine = createScoringEngine();

    expect(engine).toBeDefined();
    expect(engine.getLevel(95)).toBe('certain');
  });

  it('should create engine with custom config', () => {
    const engine = createScoringEngine({
      heuristicWeight: 0.3,
      enableDiminishingReturns: false,
    });

    expect(engine).toBeDefined();
  });
});

describe('DEFAULT_SCORING_CONFIG', () => {
  it('should have valid default values', () => {
    expect(DEFAULT_SCORING_CONFIG.minScore).toBe(0);
    expect(DEFAULT_SCORING_CONFIG.maxScore).toBe(100);
    expect(DEFAULT_SCORING_CONFIG.explicitWeight).toBe(1.0);
    expect(DEFAULT_SCORING_CONFIG.heuristicWeight).toBeLessThan(1.0);
    expect(DEFAULT_SCORING_CONFIG.enableDiminishingReturns).toBe(true);
  });
});

describe('CONFIDENCE_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(CONFIDENCE_THRESHOLDS.certain).toBe(95);
    expect(CONFIDENCE_THRESHOLDS.high).toBe(80);
    expect(CONFIDENCE_THRESHOLDS.medium).toBe(60);
    expect(CONFIDENCE_THRESHOLDS.low).toBe(40);
    expect(CONFIDENCE_THRESHOLDS.uncertain).toBe(0);
  });
});
