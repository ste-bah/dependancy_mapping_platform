/**
 * Configuration Module
 * @module config
 *
 * Centralized configuration management with type-safe access,
 * multi-source loading, and feature flags.
 *
 * TASK-DETECT: Configuration management
 *
 * @example
 * ```typescript
 * import { getConfig, isFeatureEnabled, config } from './config';
 *
 * // Get the full configuration
 * const config = getConfig();
 * console.log(config.server.port);
 *
 * // Check a feature flag
 * if (await isFeatureEnabled('enableAsyncScanning')) {
 *   // Use async scanning
 * }
 *
 * // Access config singleton
 * import { config } from './config';
 * console.log(config.database.host);
 * ```
 */

import pino from 'pino';
import {
  ConfigLoader,
  createConfigLoader,
  loadConfig as loadConfigAsync,
  ConfigLoaderOptions,
  ConfigValidationError,
  ConfigSource,
  EnvironmentConfigSource,
  FileConfigSource,
  DotenvConfigSource,
  getEnvironmentDefaults,
  validateConfig,
} from './loader.js';
import {
  FeatureFlagService,
  createFeatureFlagService,
  FeatureFlagServiceOptions,
  FeatureFlagContext,
  createFlagContextFromRequest,
  isFeatureEnabled as checkFeature,
  isFeatureEnabledSync,
  withFeatureFlag,
  StaticFeatureFlagProvider,
  IFeatureFlagProvider,
  FeatureFlag,
  FeatureFlagName,
} from './feature-flags.js';
import {
  AppConfig,
  AppConfigSchema,
  Environment,
  ServerConfig,
  DatabaseConfig,
  RedisConfig,
  QueueConfig,
  ParserConfig,
  DetectionConfig,
  ExternalServicesConfig,
  AuthConfig,
  FeatureFlags,
  LoggingConfig,
  MonitoringConfig,
  StorageConfig,
  PartialAppConfig,
  // Documentation types (TASK-FINAL-004)
  DocumentationConfig,
} from './schema.js';
import {
  RollupConfig,
  PartialRollupConfig,
  RollupConfigBuilder,
  createRollupConfigBuilder,
  MatchingStrategies,
  MatchingStrategy,
  RollupPriorities,
  RollupEnvVars,
} from './rollup.types.js';
import {
  RollupConfigSchema,
  loadRollupConfigFromEnv,
  validateRollupConfig,
  validatePartialRollupConfig,
  isValidRollupConfig,
  getDefaultRollupConfig,
  mergeRollupConfigs,
  getRollupEnvironmentDefaults,
  getRollupConfigSummary,
  RollupConfigValidationError,
} from './rollup.config.js';
import {
  RollupFeatureFlags as RollupFeatureFlagsType,
  RollupFeatureFlagsSchema,
  RollupFeatureFlags,
  RollupFeatureFlagName,
  RollupFeatureFlagProvider,
  createRollupFeatureFlagProvider,
  loadRollupFeaturesFromEnv,
  isRollupFeatureEnabledSync,
  getRollupFeatureFlagNames,
  getRollupFeatureFlagMetadata,
  TenantFeatureOverrideStore,
  DEFAULT_ROLLUP_FLAGS,
  DEFAULT_AB_TESTS,
  DEFAULT_GRADUAL_ROLLOUTS,
} from './rollup-features.js';

const logger = pino({ name: 'config' });

// ============================================================================
// Singleton Configuration
// ============================================================================

/**
 * Singleton configuration instance
 */
let configInstance: AppConfig | null = null;

/**
 * Singleton config loader instance
 */
let configLoaderInstance: ConfigLoader | null = null;

/**
 * Singleton feature flag service instance
 */
let featureFlagServiceInstance: FeatureFlagService | null = null;

/**
 * Singleton rollup configuration instance
 */
let rollupConfigInstance: RollupConfig | null = null;

/**
 * Singleton rollup feature flag provider instance
 */
let rollupFeatureFlagProviderInstance: RollupFeatureFlagProvider | null = null;

/**
 * Flag indicating if config has been initialized
 */
let isInitialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Configuration initialization options
 */
export interface ConfigInitOptions extends ConfigLoaderOptions {
  /** Feature flag service options */
  featureFlags?: FeatureFlagServiceOptions;
  /** Skip validation (for testing) */
  skipValidation?: boolean;
  /** Rollup configuration overrides */
  rollupConfig?: PartialRollupConfig;
  /** Rollup feature flag overrides */
  rollupFeatures?: Partial<RollupFeatureFlagsType>;
}

/**
 * Initialize configuration system
 * Should be called once at application startup
 */
export async function initConfig(options: ConfigInitOptions = {}): Promise<AppConfig> {
  if (isInitialized && configInstance) {
    logger.warn('Configuration already initialized, returning existing config');
    return configInstance;
  }

  logger.info('Initializing configuration...');

  // Create config loader
  configLoaderInstance = createConfigLoader(options);

  // Load configuration
  configInstance = await configLoaderInstance.load();

  // Create feature flag service
  featureFlagServiceInstance = createFeatureFlagService(
    configInstance.features,
    {
      ...options.featureFlags,
      defaultContext: {
        environment: configInstance.env,
      },
    }
  );

  // Initialize rollup configuration
  const envRollupConfig = loadRollupConfigFromEnv();
  const envDefaults = getRollupEnvironmentDefaults(configInstance.env);
  rollupConfigInstance = mergeRollupConfigs(
    getDefaultRollupConfig(),
    envDefaults,
    envRollupConfig,
    options.rollupConfig ?? {}
  );

  // Initialize rollup feature flag provider
  const rollupFeaturesFromEnv = loadRollupFeaturesFromEnv();
  rollupFeatureFlagProviderInstance = createRollupFeatureFlagProvider({
    ...rollupFeaturesFromEnv,
    ...options.rollupFeatures,
  });

  isInitialized = true;

  logger.info(
    {
      env: configInstance.env,
      version: configInstance.version,
      port: configInstance.server.port,
      rollupMaxRepos: rollupConfigInstance.repositoryLimits.maxRepositoriesPerRollup,
      rollupCacheEnabled: rollupConfigInstance.cache.enabled,
    },
    'Configuration initialized successfully'
  );

  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
  configLoaderInstance = null;
  featureFlagServiceInstance = null;
  rollupConfigInstance = null;
  rollupFeatureFlagProviderInstance = null;
  isInitialized = false;
  logger.debug('Configuration reset');
}

// ============================================================================
// Configuration Access
// ============================================================================

/**
 * Get the current configuration
 * Throws if configuration has not been initialized
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    throw new Error(
      'Configuration not initialized. Call initConfig() first or use getConfigAsync().'
    );
  }
  return configInstance;
}

/**
 * Get configuration asynchronously, initializing if needed
 */
export async function getConfigAsync(options?: ConfigInitOptions): Promise<AppConfig> {
  if (!configInstance) {
    return initConfig(options);
  }
  return configInstance;
}

/**
 * Get the config loader instance
 */
export function getConfigLoader(): ConfigLoader {
  if (!configLoaderInstance) {
    throw new Error('Configuration not initialized. Call initConfig() first.');
  }
  return configLoaderInstance;
}

/**
 * Check if configuration has been initialized
 */
export function isConfigInitialized(): boolean {
  return isInitialized && configInstance !== null;
}

// ============================================================================
// Feature Flag Access
// ============================================================================

/**
 * Get the feature flag service
 */
export function getFeatureFlagService(): FeatureFlagService {
  if (!featureFlagServiceInstance) {
    throw new Error('Configuration not initialized. Call initConfig() first.');
  }
  return featureFlagServiceInstance;
}

/**
 * Check if a feature is enabled
 */
export async function isFeatureEnabled(
  flagName: FeatureFlagName,
  context?: FeatureFlagContext
): Promise<boolean> {
  const service = getFeatureFlagService();
  return service.isEnabled(flagName, context);
}

/**
 * Get all enabled features
 */
export async function getEnabledFeatures(
  context?: FeatureFlagContext
): Promise<Record<string, boolean>> {
  const service = getFeatureFlagService();
  return service.getEnabledFlags(context);
}

// ============================================================================
// Configuration Sections (Typed Accessors)
// ============================================================================

/**
 * Get server configuration
 */
export function getServerConfig(): ServerConfig {
  return getConfig().server;
}

/**
 * Get database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
  return getConfig().database;
}

/**
 * Get Redis configuration
 */
export function getRedisConfig(): RedisConfig | undefined {
  return getConfig().redis;
}

/**
 * Get queue configuration
 */
export function getQueueConfig(): QueueConfig {
  return getConfig().queue;
}

/**
 * Get parser configuration
 */
export function getParserConfig(): ParserConfig {
  return getConfig().parsers;
}

/**
 * Get detection configuration
 */
export function getDetectionConfig(): DetectionConfig {
  return getConfig().detection;
}

/**
 * Get external services configuration
 */
export function getExternalServicesConfig(): ExternalServicesConfig {
  return getConfig().externalServices;
}

/**
 * Get authentication configuration
 */
export function getAuthConfig(): AuthConfig {
  return getConfig().auth;
}

/**
 * Get feature flags configuration
 */
export function getFeatureFlags(): FeatureFlags {
  return getConfig().features;
}

/**
 * Get logging configuration
 */
export function getLoggingConfig(): LoggingConfig {
  return getConfig().logging;
}

/**
 * Get monitoring configuration
 */
export function getMonitoringConfig(): MonitoringConfig {
  return getConfig().monitoring;
}

/**
 * Get storage configuration
 */
export function getStorageConfig(): StorageConfig {
  return getConfig().storage;
}

/**
 * Get documentation configuration (TASK-FINAL-004)
 */
export function getDocumentationConfig(): DocumentationConfig {
  return getConfig().documentation;
}

// ============================================================================
// Rollup Configuration Access
// ============================================================================

/**
 * Get rollup configuration
 */
export function getRollupConfig(): RollupConfig {
  if (!rollupConfigInstance) {
    throw new Error('Configuration not initialized. Call initConfig() first.');
  }
  return rollupConfigInstance;
}

/**
 * Get rollup feature flag provider
 */
export function getRollupFeatureFlagProvider(): RollupFeatureFlagProvider {
  if (!rollupFeatureFlagProviderInstance) {
    throw new Error('Configuration not initialized. Call initConfig() first.');
  }
  return rollupFeatureFlagProviderInstance;
}

/**
 * Check if a rollup feature is enabled
 */
export async function isRollupFeatureEnabled(
  flagName: RollupFeatureFlagName,
  context?: FeatureFlagContext
): Promise<boolean> {
  const provider = getRollupFeatureFlagProvider();
  return provider.isEnabled(flagName, context);
}

/**
 * Get rollup matching configuration
 */
export function getRollupMatchingConfig() {
  return getRollupConfig().matching;
}

/**
 * Get rollup timeout configuration
 */
export function getRollupTimeoutConfig() {
  return getRollupConfig().timeouts;
}

/**
 * Get rollup batch configuration
 */
export function getRollupBatchConfig() {
  return getRollupConfig().batch;
}

/**
 * Get rollup rate limit configuration
 */
export function getRollupRateLimitConfig() {
  return getRollupConfig().rateLimit;
}

/**
 * Get rollup cache configuration
 */
export function getRollupCacheConfig() {
  return getRollupConfig().cache;
}

/**
 * Get rollup queue configuration
 */
export function getRollupQueueConfig() {
  return getRollupConfig().queue;
}

/**
 * Get rollup retry configuration
 */
export function getRollupRetryConfig() {
  return getRollupConfig().retry;
}

/**
 * Get rollup blast radius configuration
 */
export function getRollupBlastRadiusConfig() {
  return getRollupConfig().blastRadius;
}

/**
 * Get rollup repository limits configuration
 */
export function getRollupRepositoryLimitsConfig() {
  return getRollupConfig().repositoryLimits;
}

/**
 * Get current environment
 */
export function getEnvironment(): Environment {
  return getConfig().env;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().env === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().env === 'development';
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return getConfig().env === 'test';
}

// ============================================================================
// Proxy Config Object (Lazy Access)
// ============================================================================

/**
 * Lazy configuration proxy that auto-initializes on first access
 * Use this for module-level config access
 */
export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_target, prop: string) {
    if (!configInstance) {
      // In development, provide helpful error
      if (process.env.NODE_ENV === 'development') {
        throw new Error(
          `Configuration accessed before initialization. ` +
          `Property '${prop}' accessed. Call initConfig() first.`
        );
      }
      // In production, try to auto-initialize synchronously (may fail)
      throw new Error('Configuration not initialized');
    }
    return (configInstance as Record<string, unknown>)[prop];
  },
  set() {
    throw new Error('Configuration is read-only');
  },
  has(_target, prop: string) {
    if (!configInstance) return false;
    return prop in configInstance;
  },
  ownKeys() {
    if (!configInstance) return [];
    return Object.keys(configInstance);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    if (!configInstance) return undefined;
    return Object.getOwnPropertyDescriptor(configInstance, prop);
  },
});

// ============================================================================
// Re-exports
// ============================================================================

// Schema exports
export {
  AppConfig,
  AppConfigSchema,
  Environment,
  ServerConfig,
  DatabaseConfig,
  RedisConfig,
  QueueConfig,
  ParserConfig,
  DetectionConfig,
  ExternalServicesConfig,
  AuthConfig,
  FeatureFlags,
  LoggingConfig,
  MonitoringConfig,
  StorageConfig,
  PartialAppConfig,
  // Documentation configuration types (TASK-FINAL-004)
  DocumentationConfig,
  DocumentationConfigSchema,
  SwaggerConfig,
  SwaggerConfigSchema,
  OpenAPIConfig,
  OpenAPIConfigSchema,
  DocusaurusConfig,
  DocusaurusConfigSchema,
  BetaProgramConfig,
  BetaProgramConfigSchema,
  LaunchConfig,
  LaunchConfigSchema,
} from './schema.js';

// Loader exports
export {
  ConfigLoader,
  createConfigLoader,
  loadConfig as loadConfigAsync,
  ConfigLoaderOptions,
  ConfigValidationError,
  ConfigSource,
  EnvironmentConfigSource,
  FileConfigSource,
  DotenvConfigSource,
  getEnvironmentDefaults,
  validateConfig,
} from './loader.js';

// Feature flag exports
export {
  FeatureFlagService,
  createFeatureFlagService,
  FeatureFlagServiceOptions,
  FeatureFlagContext,
  createFlagContextFromRequest,
  isFeatureEnabledSync,
  withFeatureFlag,
  StaticFeatureFlagProvider,
  IFeatureFlagProvider,
  FeatureFlag,
  FeatureFlagName,
} from './feature-flags.js';

// Rollup type exports
export {
  RollupConfig,
  PartialRollupConfig,
  RollupConfigBuilder,
  createRollupConfigBuilder,
  MatchingStrategies,
  MatchingStrategy,
  RollupPriorities,
  RollupEnvVars,
} from './rollup.types.js';

// Rollup config exports
export {
  RollupConfigSchema,
  loadRollupConfigFromEnv,
  validateRollupConfig,
  validatePartialRollupConfig,
  isValidRollupConfig,
  getDefaultRollupConfig,
  mergeRollupConfigs,
  getRollupEnvironmentDefaults,
  getRollupConfigSummary,
  RollupConfigValidationError,
} from './rollup.config.js';

// Rollup feature flag exports
export {
  RollupFeatureFlagsType,
  RollupFeatureFlagsSchema,
  RollupFeatureFlags,
  RollupFeatureFlagName,
  RollupFeatureFlagProvider,
  createRollupFeatureFlagProvider,
  loadRollupFeaturesFromEnv,
  isRollupFeatureEnabledSync,
  getRollupFeatureFlagNames,
  getRollupFeatureFlagMetadata,
  TenantFeatureOverrideStore,
  DEFAULT_ROLLUP_FLAGS,
  DEFAULT_AB_TESTS,
  DEFAULT_GRADUAL_ROLLOUTS,
} from './rollup-features.js';

// Documentation config exports (TASK-FINAL-004)
export {
  loadDocumentationConfig,
  getSwaggerConfigFrom,
  getOpenAPIConfigFrom,
  getDocusaurusConfigFrom,
  getBetaProgramConfigFrom,
  getLaunchConfigFrom,
  isSwaggerEnabled,
  isBetaProgramActive,
  hasBetaCapacity,
  hasLaunchDate,
  isLaunchDatePassed,
  getDocumentationConfigSummary,
} from './documentation.js';

// ============================================================================
// Module Initialization Helper
// ============================================================================

/**
 * Helper to ensure config is initialized before module execution
 * Usage: await ensureConfigLoaded() at module top level
 */
export async function ensureConfigLoaded(): Promise<void> {
  if (!isInitialized) {
    await initConfig();
  }
}

/**
 * Create a config-aware module initializer
 */
export function createConfiguredModule<T>(
  initializer: (config: AppConfig) => T | Promise<T>
): () => Promise<T> {
  let instance: T | null = null;

  return async () => {
    if (instance) return instance;

    const cfg = await getConfigAsync();
    instance = await initializer(cfg);
    return instance;
  };
}
