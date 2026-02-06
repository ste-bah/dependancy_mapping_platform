/**
 * Configuration Loader
 * @module config/loader
 *
 * Multi-source configuration loading with validation, caching,
 * and environment-specific overrides.
 *
 * TASK-DETECT: Configuration management
 */

import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import pino from 'pino';
import {
  AppConfig,
  AppConfigSchema,
  Environment,
  PartialAppConfig,
  DatabaseConfigSchema,
  RedisConfigSchema,
  FeatureFlagsSchema,
  AuthConfigSchema,
} from './schema.js';
import { ConfigurationError } from '../errors/index.js';

const logger = pino({ name: 'config-loader' });

// ============================================================================
// Configuration Source Interface
// ============================================================================

/**
 * Configuration source interface
 * Sources are loaded in order of priority (lowest first, highest overrides)
 */
export interface ConfigSource {
  /** Unique name for the source */
  name: string;
  /** Priority level (higher = overrides lower) */
  priority: number;
  /** Load configuration from this source */
  load(): Promise<PartialAppConfig>;
  /** Whether this source is available */
  isAvailable(): boolean;
}

// ============================================================================
// Environment Variable Configuration Source
// ============================================================================

/**
 * Environment variable configuration source
 * Maps environment variables to configuration structure
 */
export class EnvironmentConfigSource implements ConfigSource {
  public readonly name = 'environment';
  public readonly priority = 10;

  isAvailable(): boolean {
    return true;
  }

  async load(): Promise<PartialAppConfig> {
    const env = process.env;

    return this.filterUndefined({
      env: env.NODE_ENV as Environment,
      version: env.APP_VERSION,
      server: {
        host: env.HOST,
        port: env.PORT ? parseInt(env.PORT, 10) : undefined,
        cors: {
          origins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(s => s.trim()) : undefined,
          credentials: env.CORS_CREDENTIALS ? env.CORS_CREDENTIALS === 'true' : undefined,
        },
        rateLimit: {
          windowMs: env.RATE_LIMIT_WINDOW_MS ? parseInt(env.RATE_LIMIT_WINDOW_MS, 10) : undefined,
          max: env.RATE_LIMIT_MAX ? parseInt(env.RATE_LIMIT_MAX, 10) : undefined,
        },
        bodyLimit: env.BODY_LIMIT,
        requestTimeout: env.REQUEST_TIMEOUT ? parseInt(env.REQUEST_TIMEOUT, 10) : undefined,
        trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY === 'true' : undefined,
      },
      database: this.loadDatabaseConfig(env),
      redis: this.loadRedisConfig(env),
      queue: {
        concurrency: env.QUEUE_CONCURRENCY ? parseInt(env.QUEUE_CONCURRENCY, 10) : undefined,
        defaultJobOptions: {
          attempts: env.QUEUE_JOB_ATTEMPTS ? parseInt(env.QUEUE_JOB_ATTEMPTS, 10) : undefined,
          backoff: {
            type: env.QUEUE_BACKOFF_TYPE as 'fixed' | 'exponential' | undefined,
            delay: env.QUEUE_BACKOFF_DELAY ? parseInt(env.QUEUE_BACKOFF_DELAY, 10) : undefined,
          },
        },
      },
      parsers: {
        terraform: {
          maxFileSize: env.TERRAFORM_MAX_FILE_SIZE ? parseInt(env.TERRAFORM_MAX_FILE_SIZE, 10) : undefined,
          enableHCL2: env.TERRAFORM_ENABLE_HCL2 ? env.TERRAFORM_ENABLE_HCL2 === 'true' : undefined,
          parseTimeout: env.TERRAFORM_PARSE_TIMEOUT ? parseInt(env.TERRAFORM_PARSE_TIMEOUT, 10) : undefined,
        },
        helm: {
          maxChartSize: env.HELM_MAX_CHART_SIZE ? parseInt(env.HELM_MAX_CHART_SIZE, 10) : undefined,
          parseTimeout: env.HELM_PARSE_TIMEOUT ? parseInt(env.HELM_PARSE_TIMEOUT, 10) : undefined,
        },
      },
      detection: {
        confidenceThreshold: env.DETECTION_CONFIDENCE_THRESHOLD
          ? parseFloat(env.DETECTION_CONFIDENCE_THRESHOLD) : undefined,
        maxGraphDepth: env.DETECTION_MAX_GRAPH_DEPTH
          ? parseInt(env.DETECTION_MAX_GRAPH_DEPTH, 10) : undefined,
        enableCycleDetection: env.DETECTION_ENABLE_CYCLE_DETECTION
          ? env.DETECTION_ENABLE_CYCLE_DETECTION === 'true' : undefined,
        parallelDetectors: env.DETECTION_PARALLEL_DETECTORS
          ? parseInt(env.DETECTION_PARALLEL_DETECTORS, 10) : undefined,
        timeoutPerFile: env.DETECTION_TIMEOUT_PER_FILE
          ? parseInt(env.DETECTION_TIMEOUT_PER_FILE, 10) : undefined,
        totalTimeout: env.DETECTION_TOTAL_TIMEOUT
          ? parseInt(env.DETECTION_TOTAL_TIMEOUT, 10) : undefined,
        maxFilesPerScan: env.DETECTION_MAX_FILES_PER_SCAN
          ? parseInt(env.DETECTION_MAX_FILES_PER_SCAN, 10) : undefined,
        enableCaching: env.DETECTION_ENABLE_CACHING
          ? env.DETECTION_ENABLE_CACHING === 'true' : undefined,
        cacheTtl: env.DETECTION_CACHE_TTL
          ? parseInt(env.DETECTION_CACHE_TTL, 10) : undefined,
      },
      externalServices: {
        terraformRegistry: {
          baseUrl: env.TERRAFORM_REGISTRY_URL,
          timeout: env.TERRAFORM_REGISTRY_TIMEOUT
            ? parseInt(env.TERRAFORM_REGISTRY_TIMEOUT, 10) : undefined,
          retries: env.TERRAFORM_REGISTRY_RETRIES
            ? parseInt(env.TERRAFORM_REGISTRY_RETRIES, 10) : undefined,
          token: env.TERRAFORM_REGISTRY_TOKEN,
        },
        github: {
          apiUrl: env.GITHUB_API_URL,
          token: env.GITHUB_TOKEN,
          appId: env.GITHUB_APP_ID,
          privateKey: env.GITHUB_PRIVATE_KEY,
          installationId: env.GITHUB_INSTALLATION_ID,
          timeout: env.GITHUB_TIMEOUT ? parseInt(env.GITHUB_TIMEOUT, 10) : undefined,
        },
        gitlab: {
          apiUrl: env.GITLAB_API_URL,
          token: env.GITLAB_TOKEN,
          timeout: env.GITLAB_TIMEOUT ? parseInt(env.GITLAB_TIMEOUT, 10) : undefined,
        },
        bitbucket: {
          apiUrl: env.BITBUCKET_API_URL,
          token: env.BITBUCKET_TOKEN,
          username: env.BITBUCKET_USERNAME,
          timeout: env.BITBUCKET_TIMEOUT ? parseInt(env.BITBUCKET_TIMEOUT, 10) : undefined,
        },
      },
      auth: {
        jwt: {
          privateKey: env.JWT_PRIVATE_KEY,
          publicKey: env.JWT_PUBLIC_KEY,
          secret: env.JWT_SECRET,
          algorithm: env.JWT_ALGORITHM as any,
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
          accessTokenTtl: env.ACCESS_TOKEN_TTL ? parseInt(env.ACCESS_TOKEN_TTL, 10) : undefined,
          refreshTokenTtl: env.REFRESH_TOKEN_TTL ? parseInt(env.REFRESH_TOKEN_TTL, 10) : undefined,
        },
        github: env.GITHUB_CLIENT_ID ? {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET!,
          callbackUrl: env.GITHUB_REDIRECT_URI!,
          scopes: env.GITHUB_SCOPES ? env.GITHUB_SCOPES.split(',').map(s => s.trim()) : undefined,
        } : undefined,
        sessionSecret: env.SESSION_SECRET,
        bcryptRounds: env.BCRYPT_ROUNDS ? parseInt(env.BCRYPT_ROUNDS, 10) : undefined,
        enableApiKeys: env.ENABLE_API_KEYS ? env.ENABLE_API_KEYS === 'true' : undefined,
      },
      features: this.loadFeatureFlags(env),
      logging: {
        level: env.LOG_LEVEL as any,
        pretty: env.LOG_PRETTY ? env.LOG_PRETTY === 'true' : undefined,
        destination: env.LOG_DESTINATION as any,
        filePath: env.LOG_FILE_PATH,
        logRequests: env.LOG_REQUESTS ? env.LOG_REQUESTS === 'true' : undefined,
        logResponses: env.LOG_RESPONSES ? env.LOG_RESPONSES === 'true' : undefined,
      },
      monitoring: {
        sentryDsn: env.SENTRY_DSN,
        sentryEnvironment: env.SENTRY_ENVIRONMENT,
        prometheusEnabled: env.PROMETHEUS_ENABLED ? env.PROMETHEUS_ENABLED === 'true' : undefined,
        prometheusPath: env.PROMETHEUS_PATH,
        healthCheckEnabled: env.HEALTH_CHECK_ENABLED
          ? env.HEALTH_CHECK_ENABLED === 'true' : undefined,
        healthCheckPath: env.HEALTH_CHECK_PATH,
      },
      storage: {
        provider: env.STORAGE_PROVIDER as any,
        localPath: env.STORAGE_LOCAL_PATH,
        s3Bucket: env.S3_BUCKET,
        s3Region: env.S3_REGION,
        s3Endpoint: env.S3_ENDPOINT,
        gcsBucket: env.GCS_BUCKET,
        azureContainer: env.AZURE_CONTAINER,
        maxUploadSize: env.MAX_UPLOAD_SIZE ? parseInt(env.MAX_UPLOAD_SIZE, 10) : undefined,
      },
    });
  }

  private loadDatabaseConfig(env: NodeJS.ProcessEnv): PartialAppConfig['database'] {
    // Support both DATABASE_URL and individual settings
    if (env.DATABASE_URL) {
      const url = new URL(env.DATABASE_URL);
      return {
        connectionString: env.DATABASE_URL,
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 5432,
        database: url.pathname.slice(1),
        username: url.username,
        password: url.password,
        ssl: env.DB_SSL === 'true',
        poolMin: env.DB_POOL_MIN ? parseInt(env.DB_POOL_MIN, 10) : undefined,
        poolMax: env.DB_POOL_MAX ? parseInt(env.DB_POOL_MAX, 10) : undefined,
        connectionTimeout: env.DB_CONNECTION_TIMEOUT
          ? parseInt(env.DB_CONNECTION_TIMEOUT, 10) : undefined,
        idleTimeout: env.DB_IDLE_TIMEOUT ? parseInt(env.DB_IDLE_TIMEOUT, 10) : undefined,
      };
    }

    return {
      host: env.DB_HOST,
      port: env.DB_PORT ? parseInt(env.DB_PORT, 10) : undefined,
      database: env.DB_NAME,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: env.DB_SSL ? env.DB_SSL === 'true' : undefined,
      poolMin: env.DB_POOL_MIN ? parseInt(env.DB_POOL_MIN, 10) : undefined,
      poolMax: env.DB_POOL_MAX ? parseInt(env.DB_POOL_MAX, 10) : undefined,
      connectionTimeout: env.DB_CONNECTION_TIMEOUT
        ? parseInt(env.DB_CONNECTION_TIMEOUT, 10) : undefined,
      idleTimeout: env.DB_IDLE_TIMEOUT ? parseInt(env.DB_IDLE_TIMEOUT, 10) : undefined,
    };
  }

  private loadRedisConfig(env: NodeJS.ProcessEnv): PartialAppConfig['redis'] {
    if (!env.REDIS_HOST && !env.REDIS_URL) {
      return undefined;
    }

    if (env.REDIS_URL) {
      const url = new URL(env.REDIS_URL);
      return {
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 6379,
        password: url.password || undefined,
        db: env.REDIS_DB ? parseInt(env.REDIS_DB, 10) : 0,
        tls: url.protocol === 'rediss:',
        keyPrefix: env.REDIS_KEY_PREFIX,
      };
    }

    return {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT ? parseInt(env.REDIS_PORT, 10) : undefined,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB ? parseInt(env.REDIS_DB, 10) : undefined,
      tls: env.REDIS_TLS ? env.REDIS_TLS === 'true' : undefined,
      keyPrefix: env.REDIS_KEY_PREFIX,
      cluster: env.REDIS_CLUSTER ? env.REDIS_CLUSTER === 'true' : undefined,
    };
  }

  private loadFeatureFlags(env: NodeJS.ProcessEnv): PartialAppConfig['features'] {
    // Support JSON-formatted feature flags
    if (env.FEATURE_FLAGS) {
      try {
        return JSON.parse(env.FEATURE_FLAGS);
      } catch {
        logger.warn('Failed to parse FEATURE_FLAGS environment variable');
      }
    }

    return {
      enableAsyncScanning: env.FEATURE_ASYNC_SCANNING
        ? env.FEATURE_ASYNC_SCANNING === 'true' : undefined,
      enableWebhooks: env.FEATURE_WEBHOOKS ? env.FEATURE_WEBHOOKS === 'true' : undefined,
      enableMetrics: env.FEATURE_METRICS ? env.FEATURE_METRICS === 'true' : undefined,
      enableCaching: env.FEATURE_CACHING ? env.FEATURE_CACHING === 'true' : undefined,
      enableGraphQL: env.FEATURE_GRAPHQL ? env.FEATURE_GRAPHQL === 'true' : undefined,
      experimentalHelmV3: env.FEATURE_EXPERIMENTAL_HELM_V3
        ? env.FEATURE_EXPERIMENTAL_HELM_V3 === 'true' : undefined,
      experimentalKubernetesOperators: env.FEATURE_EXPERIMENTAL_K8S_OPERATORS
        ? env.FEATURE_EXPERIMENTAL_K8S_OPERATORS === 'true' : undefined,
      experimentalAIDetection: env.FEATURE_EXPERIMENTAL_AI_DETECTION
        ? env.FEATURE_EXPERIMENTAL_AI_DETECTION === 'true' : undefined,
      debugMode: env.DEBUG_MODE ? env.DEBUG_MODE === 'true' : undefined,
      verboseErrors: env.VERBOSE_ERRORS ? env.VERBOSE_ERRORS === 'true' : undefined,
    };
  }

  /**
   * Recursively remove undefined values from an object
   */
  private filterUndefined<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue;
      }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const filtered = this.filterUndefined(value as Record<string, unknown>);
        if (Object.keys(filtered).length > 0) {
          result[key] = filtered;
        }
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }
}

// ============================================================================
// File Configuration Source
// ============================================================================

/**
 * JSON/JS file configuration source
 */
export class FileConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority: number;

  constructor(
    private readonly filePath: string,
    priority = 5
  ) {
    this.name = `file:${filePath}`;
    this.priority = priority;
  }

  isAvailable(): boolean {
    return existsSync(this.filePath);
  }

  async load(): Promise<PartialAppConfig> {
    if (!this.isAvailable()) {
      logger.debug({ filePath: this.filePath }, 'Config file not found, skipping');
      return {};
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      logger.debug({ filePath: this.filePath }, 'Loaded config from file');
      return parsed;
    } catch (error) {
      logger.error({ error, filePath: this.filePath }, 'Failed to load config file');
      throw new ConfigurationError(
        `file:${this.filePath}`,
        `Failed to load configuration file: ${(error as Error).message}`
      );
    }
  }
}

// ============================================================================
// Dotenv Configuration Source
// ============================================================================

/**
 * .env file configuration source
 * Loads .env files and populates process.env
 */
export class DotenvConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority: number;

  constructor(
    private readonly envFile: string = '.env',
    priority = 1
  ) {
    this.name = `dotenv:${envFile}`;
    this.priority = priority;
  }

  isAvailable(): boolean {
    const fullPath = resolve(process.cwd(), this.envFile);
    return existsSync(fullPath);
  }

  async load(): Promise<PartialAppConfig> {
    if (!this.isAvailable()) {
      return {};
    }

    const fullPath = resolve(process.cwd(), this.envFile);

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
          continue;
        }

        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();

        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Handle escaped newlines in values
        value = value.replace(/\\n/g, '\n');

        // Only set if not already defined (env vars take precedence)
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      logger.debug({ envFile: this.envFile }, 'Loaded dotenv file');
    } catch (error) {
      logger.warn({ error, envFile: this.envFile }, 'Failed to load dotenv file');
    }

    // Return empty - this source just populates process.env
    // The actual config is loaded by EnvironmentConfigSource
    return {};
  }
}

// ============================================================================
// Configuration Loader
// ============================================================================

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  /** Additional environment variables to inject */
  envOverride?: Record<string, string>;
  /** Throw on validation errors (default: true) */
  throwOnError?: boolean;
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Custom config sources */
  sources?: ConfigSource[];
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  public readonly errors: z.ZodError;

  constructor(zodError: z.ZodError) {
    const formattedErrors = zodError.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    super(`Configuration validation failed:\n${
      formattedErrors.map(e => `  - ${e.path}: ${e.message}`).join('\n')
    }`);

    this.name = 'ConfigValidationError';
    this.errors = zodError;
  }
}

/**
 * Multi-source configuration loader with validation
 */
export class ConfigLoader {
  private sources: ConfigSource[] = [];
  private config: AppConfig | null = null;
  private validated = false;
  private readonly options: Required<ConfigLoaderOptions>;

  constructor(options: ConfigLoaderOptions = {}) {
    this.options = {
      envOverride: options.envOverride ?? {},
      throwOnError: options.throwOnError ?? true,
      enableCache: options.enableCache ?? true,
      sources: options.sources ?? [],
    };

    // Apply environment overrides
    for (const [key, value] of Object.entries(this.options.envOverride)) {
      process.env[key] = value;
    }

    // Add default sources if none provided
    if (this.options.sources.length === 0) {
      this.initializeDefaultSources();
    } else {
      this.sources = [...this.options.sources];
    }

    // Sort sources by priority (lowest first)
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Initialize default configuration sources
   */
  private initializeDefaultSources(): void {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const cwd = process.cwd();

    // 1. Base .env file (lowest priority)
    this.addSource(new DotenvConfigSource('.env', 1));

    // 2. Environment-specific .env file
    this.addSource(new DotenvConfigSource(`.env.${nodeEnv}`, 2));

    // 3. Local .env override (not committed to git)
    this.addSource(new DotenvConfigSource('.env.local', 3));

    // 4. JSON config file
    this.addSource(new FileConfigSource(join(cwd, 'config', 'config.json'), 5));

    // 5. Environment-specific JSON config
    this.addSource(new FileConfigSource(join(cwd, 'config', `config.${nodeEnv}.json`), 6));

    // 6. Environment variables (highest priority)
    this.addSource(new EnvironmentConfigSource());
  }

  /**
   * Add a configuration source
   */
  addSource(source: ConfigSource): this {
    this.sources.push(source);
    this.sources.sort((a, b) => a.priority - b.priority);
    this.invalidateCache();
    return this;
  }

  /**
   * Remove a configuration source by name
   */
  removeSource(name: string): this {
    this.sources = this.sources.filter(s => s.name !== name);
    this.invalidateCache();
    return this;
  }

  /**
   * Load and validate configuration from all sources
   */
  async load(): Promise<AppConfig> {
    if (this.options.enableCache && this.config && this.validated) {
      return this.config;
    }

    const merged: PartialAppConfig = {};

    // Load from all sources in priority order
    for (const source of this.sources) {
      if (!source.isAvailable()) {
        logger.debug({ source: source.name }, 'Config source not available, skipping');
        continue;
      }

      try {
        const partial = await source.load();
        this.deepMerge(merged, partial);
        logger.debug({ source: source.name }, 'Loaded config from source');
      } catch (error) {
        logger.error({ error, source: source.name }, 'Failed to load config from source');
        if (this.options.throwOnError) {
          throw error;
        }
      }
    }

    // Validate the merged configuration
    const result = AppConfigSchema.safeParse(merged);

    if (!result.success) {
      const validationError = new ConfigValidationError(result.error);
      logger.error({ errors: result.error.errors }, 'Configuration validation failed');

      if (this.options.throwOnError) {
        throw validationError;
      }

      // Return partial config with defaults if not throwing
      return AppConfigSchema.parse({
        env: 'development',
        database: { host: 'localhost', port: 5432, database: 'test', username: 'test', password: 'test' },
      });
    }

    this.config = result.data;
    this.validated = true;

    logger.info({ env: this.config.env }, 'Configuration loaded successfully');

    return this.config;
  }

  /**
   * Get loaded configuration (throws if not loaded)
   */
  get(): AppConfig {
    if (!this.config || !this.validated) {
      throw new ConfigurationError(
        'config',
        'Configuration not loaded. Call load() first.'
      );
    }
    return this.config;
  }

  /**
   * Get a specific configuration value with type inference
   */
  getValue<T extends z.ZodType>(
    path: string,
    schema: T
  ): z.infer<T> {
    const config = this.get();
    const parts = path.split('.');
    let value: unknown = config;

    for (const part of parts) {
      if (value === null || value === undefined || typeof value !== 'object') {
        throw new ConfigurationError(path, `Configuration path '${path}' not found`);
      }
      value = (value as Record<string, unknown>)[part];
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ConfigurationError(
        path,
        `Invalid configuration at '${path}': ${result.error.message}`
      );
    }

    return result.data;
  }

  /**
   * Get an optional configuration value with default
   */
  getOptional<T extends z.ZodType>(
    path: string,
    schema: T,
    defaultValue: z.infer<T>
  ): z.infer<T> {
    try {
      return this.getValue(path, schema);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Check if configuration is loaded and valid
   */
  isLoaded(): boolean {
    return this.config !== null && this.validated;
  }

  /**
   * Invalidate cached configuration
   */
  invalidateCache(): void {
    this.config = null;
    this.validated = false;
  }

  /**
   * Reload configuration from all sources
   */
  async reload(): Promise<AppConfig> {
    this.invalidateCache();
    return this.load();
  }

  /**
   * Deep merge two objects, with source overwriting target
   */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue === undefined) {
        continue;
      }

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge objects
        this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        // Overwrite target value
        target[key] = sourceValue;
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a config loader with default settings
 */
export function createConfigLoader(options?: ConfigLoaderOptions): ConfigLoader {
  return new ConfigLoader(options);
}

/**
 * Load configuration with a single call
 */
export async function loadConfig(options?: ConfigLoaderOptions): Promise<AppConfig> {
  const loader = createConfigLoader(options);
  return loader.load();
}

/**
 * Validate a partial configuration
 */
export function validateConfig(config: unknown): z.SafeParseReturnType<unknown, AppConfig> {
  return AppConfigSchema.safeParse(config);
}

/**
 * Get environment-specific defaults
 */
export function getEnvironmentDefaults(env: Environment): Partial<AppConfig> {
  const defaults: Record<Environment, Partial<AppConfig>> = {
    development: {
      logging: {
        level: 'debug',
        pretty: true,
        redact: [],
        destination: 'console',
        logRequests: true,
        logResponses: false,
      },
      features: {
        debugMode: true,
        verboseErrors: true,
        enableAsyncScanning: true,
        enableWebhooks: true,
        enableMetrics: true,
        enableCaching: true,
        enableGraphQL: false,
        experimentalHelmV3: false,
        experimentalKubernetesOperators: false,
        experimentalAIDetection: false,
      },
    },
    test: {
      logging: {
        level: 'warn',
        pretty: false,
        redact: [],
        destination: 'console',
        logRequests: false,
        logResponses: false,
      },
      features: {
        debugMode: false,
        verboseErrors: true,
        enableAsyncScanning: false,
        enableWebhooks: false,
        enableMetrics: false,
        enableCaching: false,
        enableGraphQL: false,
        experimentalHelmV3: false,
        experimentalKubernetesOperators: false,
        experimentalAIDetection: false,
      },
    },
    staging: {
      logging: {
        level: 'info',
        pretty: false,
        redact: ['password', 'token', 'secret', 'apiKey', 'privateKey'],
        destination: 'console',
        logRequests: true,
        logResponses: false,
      },
      features: {
        debugMode: false,
        verboseErrors: false,
        enableAsyncScanning: true,
        enableWebhooks: true,
        enableMetrics: true,
        enableCaching: true,
        enableGraphQL: false,
        experimentalHelmV3: true,
        experimentalKubernetesOperators: false,
        experimentalAIDetection: false,
      },
    },
    production: {
      logging: {
        level: 'info',
        pretty: false,
        redact: ['password', 'token', 'secret', 'apiKey', 'privateKey', 'accessToken', 'refreshToken', 'authorization'],
        destination: 'console',
        logRequests: true,
        logResponses: false,
      },
      features: {
        debugMode: false,
        verboseErrors: false,
        enableAsyncScanning: true,
        enableWebhooks: true,
        enableMetrics: true,
        enableCaching: true,
        enableGraphQL: false,
        experimentalHelmV3: false,
        experimentalKubernetesOperators: false,
        experimentalAIDetection: false,
      },
    },
  };

  return defaults[env] ?? defaults.development;
}
