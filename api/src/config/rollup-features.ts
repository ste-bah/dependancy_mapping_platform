/**
 * Rollup Feature Flags
 * @module config/rollup-features
 *
 * Feature flag definitions for the cross-repository aggregation (rollup) feature.
 * Supports A/B testing, gradual rollouts, and tenant-specific overrides.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation
 */

import pino from 'pino';
import { z } from 'zod';
import type { FeatureFlag, FeatureFlagContext, IFeatureFlagProvider } from './feature-flags.js';

const logger = pino({ name: 'rollup-features' });

// ============================================================================
// Rollup Feature Flag Names
// ============================================================================

/**
 * Rollup-specific feature flag names
 */
export const RollupFeatureFlags = {
  /** Enable the rollup feature entirely */
  ROLLUP_ENABLED: 'rollupEnabled',
  /** Enable cross-repository scanning */
  CROSS_REPO_SCANNING: 'rollupCrossRepoScanning',
  /** Enable blast radius analysis */
  BLAST_RADIUS_ANALYSIS: 'rollupBlastRadiusAnalysis',
  /** Enable semantic matching */
  SEMANTIC_MATCHING: 'rollupSemanticMatching',
  /** Enable async execution via queue */
  ASYNC_EXECUTION: 'rollupAsyncExecution',
  /** Enable result caching */
  RESULT_CACHING: 'rollupResultCaching',
  /** Enable webhooks for rollup events */
  WEBHOOKS: 'rollupWebhooks',
  /** Enable metrics collection */
  METRICS: 'rollupMetrics',
  /** Enable GraphQL API for rollups */
  GRAPHQL_API: 'rollupGraphQLApi',
  /** Enable experimental parallel processing */
  PARALLEL_PROCESSING: 'rollupParallelProcessing',
  /** Enable experimental AI-powered matching */
  AI_MATCHING: 'rollupAIMatching',
  /** Enable debug mode for rollups */
  DEBUG_MODE: 'rollupDebugMode',
} as const;

export type RollupFeatureFlagName = typeof RollupFeatureFlags[keyof typeof RollupFeatureFlags];

// ============================================================================
// Rollup Feature Flag Schema
// ============================================================================

/**
 * Zod schema for rollup feature flags
 */
export const RollupFeatureFlagsSchema = z.object({
  /** Enable the rollup feature entirely */
  rollupEnabled: z.coerce.boolean().default(true),
  /** Enable cross-repository scanning */
  rollupCrossRepoScanning: z.coerce.boolean().default(true),
  /** Enable blast radius analysis */
  rollupBlastRadiusAnalysis: z.coerce.boolean().default(true),
  /** Enable semantic matching */
  rollupSemanticMatching: z.coerce.boolean().default(false),
  /** Enable async execution via queue */
  rollupAsyncExecution: z.coerce.boolean().default(true),
  /** Enable result caching */
  rollupResultCaching: z.coerce.boolean().default(true),
  /** Enable webhooks for rollup events */
  rollupWebhooks: z.coerce.boolean().default(true),
  /** Enable metrics collection */
  rollupMetrics: z.coerce.boolean().default(true),
  /** Enable GraphQL API for rollups */
  rollupGraphQLApi: z.coerce.boolean().default(false),
  /** Enable experimental parallel processing */
  rollupParallelProcessing: z.coerce.boolean().default(false),
  /** Enable experimental AI-powered matching */
  rollupAIMatching: z.coerce.boolean().default(false),
  /** Enable debug mode for rollups */
  rollupDebugMode: z.coerce.boolean().default(false),
});

export type RollupFeatureFlags = z.infer<typeof RollupFeatureFlagsSchema>;

// ============================================================================
// Default Feature Flag Definitions
// ============================================================================

/**
 * Default rollup feature flag definitions with metadata
 */
export const DEFAULT_ROLLUP_FLAGS: Record<RollupFeatureFlagName, FeatureFlag> = {
  [RollupFeatureFlags.ROLLUP_ENABLED]: {
    name: RollupFeatureFlags.ROLLUP_ENABLED,
    enabled: true,
    description: 'Enable the cross-repository aggregation (rollup) feature',
    metadata: {
      category: 'core',
      since: '1.0.0',
    },
  },
  [RollupFeatureFlags.CROSS_REPO_SCANNING]: {
    name: RollupFeatureFlags.CROSS_REPO_SCANNING,
    enabled: true,
    description: 'Enable scanning across multiple repositories in a single rollup',
    metadata: {
      category: 'core',
      since: '1.0.0',
    },
  },
  [RollupFeatureFlags.BLAST_RADIUS_ANALYSIS]: {
    name: RollupFeatureFlags.BLAST_RADIUS_ANALYSIS,
    enabled: true,
    description: 'Enable blast radius analysis for dependency impact assessment',
    metadata: {
      category: 'analysis',
      since: '1.0.0',
    },
  },
  [RollupFeatureFlags.SEMANTIC_MATCHING]: {
    name: RollupFeatureFlags.SEMANTIC_MATCHING,
    enabled: false,
    description: 'Enable semantic matching using ML embeddings',
    rolloutPercentage: 0,
    metadata: {
      category: 'experimental',
      since: '1.1.0',
      requires: ['ml-service'],
    },
  },
  [RollupFeatureFlags.ASYNC_EXECUTION]: {
    name: RollupFeatureFlags.ASYNC_EXECUTION,
    enabled: true,
    description: 'Enable asynchronous execution via job queue',
    metadata: {
      category: 'performance',
      since: '1.0.0',
    },
  },
  [RollupFeatureFlags.RESULT_CACHING]: {
    name: RollupFeatureFlags.RESULT_CACHING,
    enabled: true,
    description: 'Enable caching of rollup results',
    metadata: {
      category: 'performance',
      since: '1.0.0',
    },
  },
  [RollupFeatureFlags.WEBHOOKS]: {
    name: RollupFeatureFlags.WEBHOOKS,
    enabled: true,
    description: 'Enable webhook notifications for rollup events',
    metadata: {
      category: 'integration',
      since: '1.0.0',
    },
  },
  [RollupFeatureFlags.METRICS]: {
    name: RollupFeatureFlags.METRICS,
    enabled: true,
    description: 'Enable metrics collection for rollup operations',
    metadata: {
      category: 'observability',
      since: '1.0.0',
    },
  },
  [RollupFeatureFlags.GRAPHQL_API]: {
    name: RollupFeatureFlags.GRAPHQL_API,
    enabled: false,
    description: 'Enable GraphQL API for querying rollups',
    rolloutPercentage: 0,
    metadata: {
      category: 'api',
      since: '1.2.0',
    },
  },
  [RollupFeatureFlags.PARALLEL_PROCESSING]: {
    name: RollupFeatureFlags.PARALLEL_PROCESSING,
    enabled: false,
    description: 'Enable experimental parallel processing for rollup execution',
    rolloutPercentage: 10,
    metadata: {
      category: 'experimental',
      since: '1.1.0',
    },
    environmentOverrides: {
      development: true,
      test: false,
      staging: true,
      production: false,
    },
  },
  [RollupFeatureFlags.AI_MATCHING]: {
    name: RollupFeatureFlags.AI_MATCHING,
    enabled: false,
    description: 'Enable AI-powered pattern matching for rollup rules',
    rolloutPercentage: 0,
    enabledForGroups: ['beta-testers', 'enterprise'],
    metadata: {
      category: 'experimental',
      since: '1.2.0',
      requires: ['ai-service'],
    },
  },
  [RollupFeatureFlags.DEBUG_MODE]: {
    name: RollupFeatureFlags.DEBUG_MODE,
    enabled: false,
    description: 'Enable debug mode with verbose logging for rollup operations',
    environmentOverrides: {
      development: true,
      test: false,
      staging: false,
      production: false,
    },
    metadata: {
      category: 'debugging',
      since: '1.0.0',
    },
  },
};

// ============================================================================
// A/B Test Configuration
// ============================================================================

/**
 * A/B test definition
 */
export interface ABTest {
  /** Unique test ID */
  id: string;
  /** Test name */
  name: string;
  /** Test description */
  description?: string;
  /** Associated feature flag */
  featureFlag: RollupFeatureFlagName;
  /** Percentage of users in test group (0-100) */
  testGroupPercentage: number;
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Whether the test is active */
  active: boolean;
  /** Metrics to track */
  metrics: string[];
}

/**
 * Default A/B test configurations
 */
export const DEFAULT_AB_TESTS: ABTest[] = [
  {
    id: 'rollup-parallel-processing-v1',
    name: 'Parallel Processing v1',
    description: 'Test parallel processing impact on rollup performance',
    featureFlag: RollupFeatureFlags.PARALLEL_PROCESSING,
    testGroupPercentage: 20,
    active: false,
    metrics: [
      'rollup_execution_time_ms',
      'rollup_memory_usage_bytes',
      'rollup_error_rate',
    ],
  },
  {
    id: 'rollup-semantic-matching-v1',
    name: 'Semantic Matching v1',
    description: 'Test semantic matching accuracy and performance',
    featureFlag: RollupFeatureFlags.SEMANTIC_MATCHING,
    testGroupPercentage: 10,
    active: false,
    metrics: [
      'rollup_match_accuracy',
      'rollup_match_latency_ms',
      'rollup_false_positive_rate',
    ],
  },
];

// ============================================================================
// Gradual Rollout Configuration
// ============================================================================

/**
 * Gradual rollout stage
 */
export interface RolloutStage {
  /** Stage name */
  name: string;
  /** Target percentage */
  percentage: number;
  /** Duration in days before advancing to next stage */
  durationDays: number;
  /** Conditions to advance */
  advanceConditions?: {
    /** Maximum error rate allowed */
    maxErrorRate?: number;
    /** Minimum success count required */
    minSuccessCount?: number;
    /** Maximum latency P99 in ms */
    maxLatencyP99Ms?: number;
  };
}

/**
 * Gradual rollout configuration
 */
export interface GradualRollout {
  /** Feature flag being rolled out */
  featureFlag: RollupFeatureFlagName;
  /** Rollout stages */
  stages: RolloutStage[];
  /** Current stage index */
  currentStage: number;
  /** Whether the rollout is paused */
  paused: boolean;
  /** Rollback condition */
  rollbackConditions?: {
    errorRateThreshold: number;
    latencyThreshold: number;
  };
}

/**
 * Default gradual rollout configurations
 */
export const DEFAULT_GRADUAL_ROLLOUTS: GradualRollout[] = [
  {
    featureFlag: RollupFeatureFlags.PARALLEL_PROCESSING,
    stages: [
      { name: 'canary', percentage: 1, durationDays: 3, advanceConditions: { maxErrorRate: 0.01 } },
      { name: 'early-adopters', percentage: 5, durationDays: 5, advanceConditions: { maxErrorRate: 0.02 } },
      { name: 'expanded', percentage: 20, durationDays: 7, advanceConditions: { maxErrorRate: 0.02 } },
      { name: 'wide', percentage: 50, durationDays: 7, advanceConditions: { maxErrorRate: 0.01 } },
      { name: 'ga', percentage: 100, durationDays: 0 },
    ],
    currentStage: 0,
    paused: true,
    rollbackConditions: {
      errorRateThreshold: 0.05,
      latencyThreshold: 10000,
    },
  },
];

// ============================================================================
// Tenant Override Configuration
// ============================================================================

/**
 * Tenant-specific feature override
 */
export interface TenantFeatureOverride {
  /** Tenant ID */
  tenantId: string;
  /** Feature overrides (flag name -> enabled) */
  overrides: Partial<Record<RollupFeatureFlagName, boolean>>;
  /** Override reason */
  reason?: string;
  /** Expiration date */
  expiresAt?: Date;
}

/**
 * Tenant override store
 */
export class TenantFeatureOverrideStore {
  private overrides: Map<string, TenantFeatureOverride> = new Map();

  /**
   * Set override for a tenant
   */
  setOverride(override: TenantFeatureOverride): void {
    this.overrides.set(override.tenantId, override);
    logger.info(
      { tenantId: override.tenantId, overrides: override.overrides },
      'Tenant feature override set'
    );
  }

  /**
   * Get override for a tenant
   */
  getOverride(tenantId: string): TenantFeatureOverride | undefined {
    const override = this.overrides.get(tenantId);

    // Check expiration
    if (override?.expiresAt && override.expiresAt < new Date()) {
      this.overrides.delete(tenantId);
      logger.info({ tenantId }, 'Tenant feature override expired');
      return undefined;
    }

    return override;
  }

  /**
   * Remove override for a tenant
   */
  removeOverride(tenantId: string): boolean {
    const existed = this.overrides.has(tenantId);
    this.overrides.delete(tenantId);
    if (existed) {
      logger.info({ tenantId }, 'Tenant feature override removed');
    }
    return existed;
  }

  /**
   * Check if a feature is overridden for a tenant
   */
  isOverridden(tenantId: string, flagName: RollupFeatureFlagName): boolean | undefined {
    const override = this.getOverride(tenantId);
    return override?.overrides[flagName];
  }

  /**
   * Get all overrides
   */
  getAllOverrides(): TenantFeatureOverride[] {
    return Array.from(this.overrides.values());
  }

  /**
   * Clear all overrides
   */
  clear(): void {
    this.overrides.clear();
  }
}

// ============================================================================
// Rollup Feature Flag Provider
// ============================================================================

/**
 * Rollup-specific feature flag provider
 */
export class RollupFeatureFlagProvider implements IFeatureFlagProvider {
  private readonly flags: Map<string, FeatureFlag>;
  private readonly tenantOverrides: TenantFeatureOverrideStore;

  constructor(
    overrides: Partial<RollupFeatureFlags> = {},
    tenantOverrides: TenantFeatureOverrideStore = new TenantFeatureOverrideStore()
  ) {
    this.flags = new Map();
    this.tenantOverrides = tenantOverrides;

    // Load default flags
    for (const [name, flag] of Object.entries(DEFAULT_ROLLUP_FLAGS)) {
      this.flags.set(name, { ...flag });
    }

    // Apply overrides
    for (const [name, enabled] of Object.entries(overrides)) {
      const existing = this.flags.get(name);
      if (existing) {
        existing.enabled = enabled as boolean;
      }
    }

    // Load from environment
    this.loadFromEnvironment();

    logger.debug({ flagCount: this.flags.size }, 'Rollup feature flag provider initialized');
  }

  async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    const flag = await this.getFlag(flagName);

    if (!flag) {
      logger.warn({ flagName }, 'Unknown rollup feature flag');
      return false;
    }

    return this.evaluateFlag(flag, context);
  }

  async getFlag(flagName: string): Promise<FeatureFlag | null> {
    return this.flags.get(flagName) ?? null;
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values());
  }

  async setFlag(flagName: string, enabled: boolean): Promise<void> {
    const existing = this.flags.get(flagName);
    if (existing) {
      existing.enabled = enabled;
      existing.updatedAt = new Date();
      logger.info({ flagName, enabled }, 'Rollup feature flag updated');
    }
  }

  /**
   * Evaluate a flag with context
   */
  private evaluateFlag(flag: FeatureFlag, context?: FeatureFlagContext): boolean {
    // Check tenant-specific override first
    if (context?.tenantId) {
      const tenantOverride = this.tenantOverrides.isOverridden(
        context.tenantId,
        flag.name as RollupFeatureFlagName
      );
      if (tenantOverride !== undefined) {
        return tenantOverride;
      }
    }

    // Check environment-specific override
    if (context?.environment && flag.environmentOverrides?.[context.environment] !== undefined) {
      return flag.environmentOverrides[context.environment];
    }

    // Check user-specific enablement
    if (context?.userId && flag.enabledForUsers?.includes(context.userId)) {
      return true;
    }

    // Check group-specific enablement
    if (context?.userGroups && flag.enabledForGroups) {
      const hasEnabledGroup = context.userGroups.some(
        group => flag.enabledForGroups!.includes(group)
      );
      if (hasEnabledGroup) {
        return true;
      }
    }

    // Check percentage rollout
    if (
      flag.rolloutPercentage !== undefined &&
      flag.rolloutPercentage >= 0 &&
      flag.rolloutPercentage < 100
    ) {
      if (!context?.userId) {
        return flag.enabled;
      }
      return this.isInRollout(context.userId, flag.name, flag.rolloutPercentage);
    }

    return flag.enabled;
  }

  /**
   * Deterministic check if a user is in a percentage rollout
   */
  private isInRollout(userId: string, flagName: string, percentage: number): boolean {
    const hash = this.hashString(`${userId}:${flagName}`);
    const normalizedHash = ((hash % 100) + 100) % 100;
    return normalizedHash < percentage;
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Load overrides from environment variables
   */
  private loadFromEnvironment(): void {
    const env = process.env;

    // Support ROLLUP_FEATURE_* environment variables
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith('ROLLUP_FEATURE_') && value !== undefined) {
        // Convert ROLLUP_FEATURE_SOME_FLAG to rollupSomeFlag
        const flagName = key
          .replace('ROLLUP_FEATURE_', 'rollup')
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        const existing = this.flags.get(flagName);
        if (existing) {
          existing.enabled = value.toLowerCase() === 'true' || value === '1';
        }
      }
    }

    // Support JSON-formatted rollup feature flags
    const envFlags = env.ROLLUP_FEATURE_FLAGS;
    if (envFlags) {
      try {
        const parsed = JSON.parse(envFlags) as Record<string, boolean>;
        for (const [name, enabled] of Object.entries(parsed)) {
          const existing = this.flags.get(name);
          if (existing) {
            existing.enabled = enabled;
          }
        }
      } catch (e) {
        logger.warn({ error: e }, 'Failed to parse ROLLUP_FEATURE_FLAGS environment variable');
      }
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a rollup feature flag provider
 */
export function createRollupFeatureFlagProvider(
  overrides: Partial<RollupFeatureFlags> = {}
): RollupFeatureFlagProvider {
  return new RollupFeatureFlagProvider(overrides);
}

/**
 * Load rollup feature flags from environment
 */
export function loadRollupFeaturesFromEnv(): Partial<RollupFeatureFlags> {
  const result = RollupFeatureFlagsSchema.safeParse({
    rollupEnabled: process.env.ROLLUP_FEATURE_ENABLED,
    rollupCrossRepoScanning: process.env.ROLLUP_FEATURE_CROSS_REPO_SCANNING,
    rollupBlastRadiusAnalysis: process.env.ROLLUP_FEATURE_BLAST_RADIUS_ANALYSIS,
    rollupSemanticMatching: process.env.ROLLUP_FEATURE_SEMANTIC_MATCHING,
    rollupAsyncExecution: process.env.ROLLUP_FEATURE_ASYNC_EXECUTION,
    rollupResultCaching: process.env.ROLLUP_FEATURE_RESULT_CACHING,
    rollupWebhooks: process.env.ROLLUP_FEATURE_WEBHOOKS,
    rollupMetrics: process.env.ROLLUP_FEATURE_METRICS,
    rollupGraphQLApi: process.env.ROLLUP_FEATURE_GRAPHQL_API,
    rollupParallelProcessing: process.env.ROLLUP_FEATURE_PARALLEL_PROCESSING,
    rollupAIMatching: process.env.ROLLUP_FEATURE_AI_MATCHING,
    rollupDebugMode: process.env.ROLLUP_FEATURE_DEBUG_MODE,
  });

  if (result.success) {
    return result.data;
  }

  return {};
}

/**
 * Check if rollup feature is enabled (synchronous, for pre-loaded flags)
 */
export function isRollupFeatureEnabledSync(
  flags: RollupFeatureFlags,
  flagName: RollupFeatureFlagName
): boolean {
  return flags[flagName] ?? false;
}

/**
 * Get all rollup feature flag names
 */
export function getRollupFeatureFlagNames(): RollupFeatureFlagName[] {
  return Object.values(RollupFeatureFlags);
}

/**
 * Get rollup feature flag metadata
 */
export function getRollupFeatureFlagMetadata(flagName: RollupFeatureFlagName): FeatureFlag | undefined {
  return DEFAULT_ROLLUP_FLAGS[flagName];
}
