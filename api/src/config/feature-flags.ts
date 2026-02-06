/**
 * Feature Flag Service
 * @module config/feature-flags
 *
 * Runtime feature flag checking with caching, percentage rollouts,
 * user/group targeting, and dynamic updates.
 *
 * TASK-DETECT: Configuration management
 */

import pino from 'pino';
import { z } from 'zod';
import { FeatureFlags, FeatureFlagsSchema } from './schema.js';

const logger = pino({ name: 'feature-flags' });

// ============================================================================
// Feature Flag Types
// ============================================================================

/**
 * Feature flag definition with metadata
 */
export interface FeatureFlag {
  /** Unique flag name */
  name: string;
  /** Whether the flag is enabled by default */
  enabled: boolean;
  /** Human-readable description */
  description?: string;
  /** Percentage of users to enable for (0-100) */
  rolloutPercentage?: number;
  /** Specific user IDs to enable for */
  enabledForUsers?: string[];
  /** Specific groups to enable for */
  enabledForGroups?: string[];
  /** Environment-specific overrides */
  environmentOverrides?: Record<string, boolean>;
  /** Tenant-specific overrides */
  tenantOverrides?: Record<string, boolean>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Created timestamp */
  createdAt?: Date;
  /** Last updated timestamp */
  updatedAt?: Date;
}

/**
 * Context for evaluating feature flags
 */
export interface FeatureFlagContext {
  /** Current user ID */
  userId?: string;
  /** User's groups/roles */
  userGroups?: string[];
  /** Current environment */
  environment?: string;
  /** Current tenant ID */
  tenantId?: string;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Feature flag provider interface
 */
export interface IFeatureFlagProvider {
  /**
   * Check if a flag is enabled
   */
  isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean>;

  /**
   * Get a flag's full definition
   */
  getFlag(flagName: string): Promise<FeatureFlag | null>;

  /**
   * Get all flag definitions
   */
  getAllFlags(): Promise<FeatureFlag[]>;

  /**
   * Update a flag's value (for runtime overrides)
   */
  setFlag?(flagName: string, enabled: boolean, context?: FeatureFlagContext): Promise<void>;
}

// ============================================================================
// Static Feature Flag Provider
// ============================================================================

/**
 * Default feature flags with descriptions
 */
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  enableAsyncScanning: {
    name: 'enableAsyncScanning',
    enabled: true,
    description: 'Enable asynchronous background scanning of repositories',
  },
  enableWebhooks: {
    name: 'enableWebhooks',
    enabled: true,
    description: 'Enable webhook notifications for scan events',
  },
  enableMetrics: {
    name: 'enableMetrics',
    enabled: true,
    description: 'Enable Prometheus metrics collection',
  },
  enableCaching: {
    name: 'enableCaching',
    enabled: true,
    description: 'Enable Redis caching for detection results',
  },
  enableGraphQL: {
    name: 'enableGraphQL',
    enabled: false,
    description: 'Enable GraphQL API endpoint',
  },
  experimentalHelmV3: {
    name: 'experimentalHelmV3',
    enabled: false,
    description: 'Enable experimental Helm V3 chart parsing features',
  },
  experimentalKubernetesOperators: {
    name: 'experimentalKubernetesOperators',
    enabled: false,
    description: 'Enable detection of Kubernetes operator dependencies',
  },
  experimentalAIDetection: {
    name: 'experimentalAIDetection',
    enabled: false,
    description: 'Enable AI-assisted dependency detection',
    rolloutPercentage: 0,
  },
  debugMode: {
    name: 'debugMode',
    enabled: false,
    description: 'Enable debug mode with verbose logging',
    environmentOverrides: {
      development: true,
      test: false,
      staging: false,
      production: false,
    },
  },
  verboseErrors: {
    name: 'verboseErrors',
    enabled: false,
    description: 'Include detailed error information in API responses',
    environmentOverrides: {
      development: true,
      test: true,
      staging: false,
      production: false,
    },
  },
};

/**
 * Static feature flag provider using in-memory configuration
 */
export class StaticFeatureFlagProvider implements IFeatureFlagProvider {
  private readonly flags: Map<string, FeatureFlag>;

  constructor(
    overrides: Partial<FeatureFlags> = {},
    additionalFlags: Record<string, FeatureFlag> = {}
  ) {
    this.flags = new Map();

    // Load default flags
    for (const [name, flag] of Object.entries(DEFAULT_FLAGS)) {
      this.flags.set(name, { ...flag });
    }

    // Apply schema overrides (from config)
    for (const [name, enabled] of Object.entries(overrides)) {
      const existing = this.flags.get(name);
      if (existing) {
        existing.enabled = enabled as boolean;
      } else {
        this.flags.set(name, {
          name,
          enabled: enabled as boolean,
        });
      }
    }

    // Add any additional custom flags
    for (const [name, flag] of Object.entries(additionalFlags)) {
      this.flags.set(name, flag);
    }

    // Load from environment
    this.loadFromEnvironment();

    logger.debug({ flagCount: this.flags.size }, 'Feature flag provider initialized');
  }

  async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    const flag = await this.getFlag(flagName);

    if (!flag) {
      logger.warn({ flagName }, 'Unknown feature flag, returning false');
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
    } else {
      this.flags.set(flagName, {
        name: flagName,
        enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    logger.info({ flagName, enabled }, 'Feature flag updated');
  }

  /**
   * Evaluate a flag based on context
   */
  private evaluateFlag(flag: FeatureFlag, context?: FeatureFlagContext): boolean {
    // Check tenant-specific override
    if (context?.tenantId && flag.tenantOverrides?.[context.tenantId] !== undefined) {
      return flag.tenantOverrides[context.tenantId];
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
      // Need a user ID for consistent percentage rollout
      if (!context?.userId) {
        // If no user ID, use the base enabled value
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
    // Create a deterministic hash from user ID + flag name
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
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Load flag overrides from environment variables
   */
  private loadFromEnvironment(): void {
    // Support JSON-formatted feature flags
    const envFlags = process.env.FEATURE_FLAGS;
    if (envFlags) {
      try {
        const parsed = JSON.parse(envFlags) as Record<string, boolean | Partial<FeatureFlag>>;
        for (const [name, value] of Object.entries(parsed)) {
          const existing = this.flags.get(name);
          if (typeof value === 'boolean') {
            if (existing) {
              existing.enabled = value;
            } else {
              this.flags.set(name, { name, enabled: value });
            }
          } else {
            this.flags.set(name, {
              name,
              enabled: false,
              ...(existing ?? {}),
              ...value,
            });
          }
        }
      } catch (e) {
        logger.warn({ error: e }, 'Failed to parse FEATURE_FLAGS environment variable');
      }
    }

    // Support individual FEATURE_* environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('FEATURE_') && value !== undefined) {
        // Convert FEATURE_SOME_FLAG to someSomeFlag
        const flagName = key
          .replace('FEATURE_', '')
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        // Check if it maps to a known flag
        const camelCaseName = flagName.charAt(0).toLowerCase() + flagName.slice(1);
        const existing = this.flags.get(camelCaseName);
        const enabled = value.toLowerCase() === 'true' || value === '1';

        if (existing) {
          existing.enabled = enabled;
        }
      }
    }
  }
}

// ============================================================================
// Feature Flag Service
// ============================================================================

/**
 * Feature flag service options
 */
export interface FeatureFlagServiceOptions {
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Default context to use */
  defaultContext?: FeatureFlagContext;
  /** Log flag evaluations */
  logEvaluations?: boolean;
}

/**
 * Feature flag service with caching and logging
 */
export class FeatureFlagService {
  private readonly cache: Map<string, { value: boolean; expiresAt: number }> = new Map();
  private readonly cacheTtlMs: number;
  private readonly defaultContext: FeatureFlagContext;
  private readonly logEvaluations: boolean;

  constructor(
    private readonly provider: IFeatureFlagProvider,
    options: FeatureFlagServiceOptions = {}
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? 60000; // 1 minute default
    this.defaultContext = options.defaultContext ?? {};
    this.logEvaluations = options.logEvaluations ?? false;
  }

  /**
   * Check if a feature flag is enabled
   */
  async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    const mergedContext = { ...this.defaultContext, ...context };
    const cacheKey = this.getCacheKey(flagName, mergedContext);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      if (this.logEvaluations) {
        logger.debug({ flagName, enabled: cached.value, cached: true }, 'Feature flag evaluated');
      }
      return cached.value;
    }

    // Evaluate from provider
    const enabled = await this.provider.isEnabled(flagName, mergedContext);

    // Cache the result
    this.cache.set(cacheKey, {
      value: enabled,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    if (this.logEvaluations) {
      logger.debug({ flagName, enabled, cached: false }, 'Feature flag evaluated');
    }

    return enabled;
  }

  /**
   * Get a feature flag's full definition
   */
  async getFlag(flagName: string): Promise<FeatureFlag | null> {
    return this.provider.getFlag(flagName);
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    return this.provider.getAllFlags();
  }

  /**
   * Get all flags as a simple enabled/disabled map
   */
  async getEnabledFlags(context?: FeatureFlagContext): Promise<Record<string, boolean>> {
    const flags = await this.getAllFlags();
    const result: Record<string, boolean> = {};

    for (const flag of flags) {
      result[flag.name] = await this.isEnabled(flag.name, context);
    }

    return result;
  }

  /**
   * Update a flag's value (if provider supports it)
   */
  async setFlag(flagName: string, enabled: boolean, context?: FeatureFlagContext): Promise<void> {
    if (this.provider.setFlag) {
      await this.provider.setFlag(flagName, enabled, context);
      this.clearCache(flagName);
    } else {
      throw new Error('Feature flag provider does not support runtime updates');
    }
  }

  /**
   * Clear cached value for a flag
   */
  clearCache(flagName?: string): void {
    if (flagName) {
      // Clear all cache entries for this flag
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${flagName}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Generate a cache key for a flag + context combination
   */
  private getCacheKey(flagName: string, context: FeatureFlagContext): string {
    const contextParts = [
      context.userId ?? '',
      context.environment ?? '',
      context.tenantId ?? '',
      (context.userGroups ?? []).sort().join(','),
    ];
    return `${flagName}:${contextParts.join('|')}`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a feature flag service with static provider
 */
export function createFeatureFlagService(
  featureFlags: Partial<FeatureFlags> = {},
  options: FeatureFlagServiceOptions = {}
): FeatureFlagService {
  const provider = new StaticFeatureFlagProvider(featureFlags);
  return new FeatureFlagService(provider, options);
}

/**
 * Create a feature flag context from request
 */
export function createFlagContextFromRequest(
  request: {
    userId?: string;
    tenantId?: string;
    userGroups?: string[];
  },
  environment?: string
): FeatureFlagContext {
  return {
    userId: request.userId,
    tenantId: request.tenantId,
    userGroups: request.userGroups,
    environment: environment ?? process.env.NODE_ENV ?? 'development',
  };
}

// ============================================================================
// Type-Safe Flag Accessors
// ============================================================================

/**
 * Type-safe feature flag names
 */
export type FeatureFlagName = keyof FeatureFlags;

/**
 * Type-safe flag checker
 */
export async function isFeatureEnabled(
  service: FeatureFlagService,
  flagName: FeatureFlagName,
  context?: FeatureFlagContext
): Promise<boolean> {
  return service.isEnabled(flagName, context);
}

/**
 * Synchronous flag checker for pre-loaded flags
 */
export function isFeatureEnabledSync(
  flags: FeatureFlags,
  flagName: FeatureFlagName
): boolean {
  return flags[flagName] ?? false;
}

// ============================================================================
// Decorator for Feature-Gated Functions
// ============================================================================

/**
 * Options for feature-gated execution
 */
export interface FeatureGateOptions {
  /** What to return when flag is disabled */
  disabledReturn?: unknown;
  /** Whether to throw when flag is disabled */
  throwOnDisabled?: boolean;
  /** Error message when throwing */
  errorMessage?: string;
}

/**
 * Execute a function only if a feature flag is enabled
 */
export async function withFeatureFlag<T>(
  service: FeatureFlagService,
  flagName: string,
  fn: () => T | Promise<T>,
  options: FeatureGateOptions = {}
): Promise<T | undefined> {
  const enabled = await service.isEnabled(flagName);

  if (!enabled) {
    if (options.throwOnDisabled) {
      throw new Error(options.errorMessage ?? `Feature '${flagName}' is not enabled`);
    }
    return options.disabledReturn as T | undefined;
  }

  return fn();
}
