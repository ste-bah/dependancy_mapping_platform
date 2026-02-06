/**
 * Match Test Fixtures
 * @module services/rollup/__tests__/fixtures/match-fixtures
 *
 * Expected match results for different scenarios.
 */

import type { MatchResult, MatchingStrategy } from '../../../../types/rollup.js';
import { createRepositoryId } from './rollup-fixtures.js';

// ============================================================================
// ARN Match Fixtures
// ============================================================================

export interface ArnMatchScenario {
  name: string;
  sourceArn: string;
  targetArn: string;
  pattern: string;
  expectedMatch: boolean;
  expectedConfidence?: number;
}

export const ARN_MATCH_SCENARIOS: ArnMatchScenario[] = [
  {
    name: 'exact S3 bucket match',
    sourceArn: 'arn:aws:s3:::my-bucket',
    targetArn: 'arn:aws:s3:::my-bucket',
    pattern: 'arn:aws:s3:::*',
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'different S3 buckets',
    sourceArn: 'arn:aws:s3:::bucket-a',
    targetArn: 'arn:aws:s3:::bucket-b',
    pattern: 'arn:aws:s3:::*',
    expectedMatch: false,
  },
  {
    name: 'same EC2 instance',
    sourceArn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-abc123',
    targetArn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-abc123',
    pattern: 'arn:aws:ec2:*:*:instance/*',
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'different services',
    sourceArn: 'arn:aws:s3:::my-bucket',
    targetArn: 'arn:aws:ec2:us-east-1:123:instance/i-123',
    pattern: 'arn:aws:*:::*',
    expectedMatch: false,
  },
  {
    name: 'Lambda function match',
    sourceArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-func',
    targetArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-func',
    pattern: 'arn:aws:lambda:*:*:function:*',
    expectedMatch: true,
    expectedConfidence: 100,
  },
];

// ============================================================================
// Resource ID Match Fixtures
// ============================================================================

export interface ResourceIdMatchScenario {
  name: string;
  sourceId: string;
  targetId: string;
  resourceType: string;
  normalize: boolean;
  expectedMatch: boolean;
  expectedConfidence?: number;
}

export const RESOURCE_ID_MATCH_SCENARIOS: ResourceIdMatchScenario[] = [
  {
    name: 'exact ID match',
    sourceId: 'bucket-12345',
    targetId: 'bucket-12345',
    resourceType: 'aws_s3_bucket',
    normalize: true,
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'case insensitive match with normalization',
    sourceId: 'BUCKET-12345',
    targetId: 'bucket-12345',
    resourceType: 'aws_s3_bucket',
    normalize: true,
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'case sensitive no match',
    sourceId: 'BUCKET-12345',
    targetId: 'bucket-12345',
    resourceType: 'aws_s3_bucket',
    normalize: false,
    expectedMatch: false,
  },
  {
    name: 'different IDs',
    sourceId: 'bucket-12345',
    targetId: 'bucket-67890',
    resourceType: 'aws_s3_bucket',
    normalize: true,
    expectedMatch: false,
  },
  {
    name: 'ID with whitespace normalized',
    sourceId: '  bucket-12345  ',
    targetId: 'bucket-12345',
    resourceType: 'aws_s3_bucket',
    normalize: true,
    expectedMatch: true,
    expectedConfidence: 100,
  },
];

// ============================================================================
// Name Match Fixtures
// ============================================================================

export interface NameMatchScenario {
  name: string;
  sourceName: string;
  targetName: string;
  caseSensitive: boolean;
  fuzzyThreshold?: number;
  expectedMatch: boolean;
  expectedConfidence?: number;
}

export const NAME_MATCH_SCENARIOS: NameMatchScenario[] = [
  {
    name: 'exact name match',
    sourceName: 'my-service',
    targetName: 'my-service',
    caseSensitive: false,
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'case insensitive match',
    sourceName: 'MY-SERVICE',
    targetName: 'my-service',
    caseSensitive: false,
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'case sensitive no match',
    sourceName: 'MY-SERVICE',
    targetName: 'my-service',
    caseSensitive: true,
    expectedMatch: false,
  },
  {
    name: 'fuzzy match similar names',
    sourceName: 'my-service',
    targetName: 'my-servce',  // typo
    caseSensitive: false,
    fuzzyThreshold: 80,
    expectedMatch: true,
    expectedConfidence: 90,
  },
  {
    name: 'fuzzy match below threshold',
    sourceName: 'my-service',
    targetName: 'totally-different',
    caseSensitive: false,
    fuzzyThreshold: 80,
    expectedMatch: false,
  },
  {
    name: 'empty names no match',
    sourceName: '',
    targetName: '',
    caseSensitive: false,
    expectedMatch: false,
  },
];

// ============================================================================
// Tag Match Fixtures
// ============================================================================

export interface TagMatchScenario {
  name: string;
  sourceTags: Record<string, string>;
  targetTags: Record<string, string>;
  requiredTags: Array<{ key: string; value?: string; valuePattern?: string }>;
  matchMode: 'all' | 'any';
  expectedMatch: boolean;
  expectedConfidence?: number;
}

export const TAG_MATCH_SCENARIOS: TagMatchScenario[] = [
  {
    name: 'all tags match exactly',
    sourceTags: { Environment: 'production', Project: 'myapp' },
    targetTags: { Environment: 'production', Project: 'myapp' },
    requiredTags: [
      { key: 'Environment', value: 'production' },
      { key: 'Project', value: 'myapp' },
    ],
    matchMode: 'all',
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'any tag matches',
    sourceTags: { Environment: 'production', Project: 'myapp' },
    targetTags: { Environment: 'production', Team: 'backend' },
    requiredTags: [
      { key: 'Environment', value: 'production' },
    ],
    matchMode: 'any',
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'missing required tag in all mode',
    sourceTags: { Environment: 'production' },
    targetTags: { Environment: 'production', Project: 'myapp' },
    requiredTags: [
      { key: 'Environment', value: 'production' },
      { key: 'Project', value: 'myapp' },
    ],
    matchMode: 'all',
    expectedMatch: false,
  },
  {
    name: 'tag value mismatch',
    sourceTags: { Environment: 'production' },
    targetTags: { Environment: 'staging' },
    requiredTags: [
      { key: 'Environment', value: 'production' },
    ],
    matchMode: 'all',
    expectedMatch: false,
  },
  {
    name: 'tag key only match (any value)',
    sourceTags: { Environment: 'production' },
    targetTags: { Environment: 'staging' },
    requiredTags: [
      { key: 'Environment' },  // No specific value required
    ],
    matchMode: 'all',
    expectedMatch: true,
    expectedConfidence: 100,
  },
  {
    name: 'tag value pattern match',
    sourceTags: { Environment: 'prod-us-east-1' },
    targetTags: { Environment: 'prod-us-west-2' },
    requiredTags: [
      { key: 'Environment', valuePattern: '^prod-' },
    ],
    matchMode: 'all',
    expectedMatch: true,
    expectedConfidence: 100,
  },
];

// ============================================================================
// Cross-Strategy Match Results
// ============================================================================

export function createExpectedMatchResult(
  strategy: MatchingStrategy,
  confidence: number,
  sourceValue: string,
  targetValue: string
): Omit<MatchResult, 'sourceNodeId' | 'targetNodeId' | 'sourceRepoId' | 'targetRepoId'> {
  return {
    strategy,
    confidence,
    details: {
      matchedAttribute: strategy === 'arn' ? 'arn' :
                        strategy === 'resource_id' ? 'id' :
                        strategy === 'name' ? 'name' :
                        'tags',
      sourceValue,
      targetValue,
      context: {},
    },
  };
}

// ============================================================================
// Confidence Calculation Test Cases
// ============================================================================

export interface ConfidenceTestCase {
  name: string;
  strategy: MatchingStrategy;
  sourceValue: string;
  targetValue: string;
  additionalContext: Record<string, unknown>;
  expectedConfidence: number;
}

export const CONFIDENCE_TEST_CASES: ConfidenceTestCase[] = [
  {
    name: 'ARN exact match full components',
    strategy: 'arn',
    sourceValue: 'arn:aws:s3:::my-bucket',
    targetValue: 'arn:aws:s3:::my-bucket',
    additionalContext: { sameResourceType: true },
    expectedConfidence: 100,
  },
  {
    name: 'Name match different node types',
    strategy: 'name',
    sourceValue: 'my-resource',
    targetValue: 'my-resource',
    additionalContext: { sameNodeType: false },
    expectedConfidence: 95,
  },
  {
    name: 'Tag partial match',
    strategy: 'tag',
    sourceValue: 'Environment=production',
    targetValue: 'Environment=production|Project=myapp',
    additionalContext: { matchedTags: 1, totalTags: 2 },
    expectedConfidence: 52,  // 1/2 * 100 + 5 bonus = ~55, rounded
  },
];
