/**
 * Configuration Schema Definitions
 * @module config/schema
 *
 * Zod schemas for validating all application configuration.
 * Provides type-safe configuration with compile-time type inference.
 *
 * TASK-DETECT: Configuration management
 */

import { z } from 'zod';

// ============================================================================
// Environment Enum
// ============================================================================

/**
 * Valid application environments
 */
export const Environment = z.enum(['development', 'staging', 'production', 'test']);
export type Environment = z.infer<typeof Environment>;

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  /** Host to bind to */
  host: z.string().default('0.0.0.0'),
  /** Port to listen on */
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  /** CORS configuration */
  cors: z.object({
    /** Allowed origins */
    origins: z.array(z.string()).default(['*']),
    /** Allow credentials */
    credentials: z.boolean().default(true),
  }).default({}),
  /** Rate limiting configuration */
  rateLimit: z.object({
    /** Time window in milliseconds */
    windowMs: z.coerce.number().int().min(1000).default(60000),
    /** Maximum requests per window */
    max: z.coerce.number().int().min(1).default(100),
  }).default({}),
  /** Maximum body size for requests */
  bodyLimit: z.string().default('10mb'),
  /** Request timeout in milliseconds */
  requestTimeout: z.coerce.number().int().min(1000).default(30000),
  /** Enable trust proxy for reverse proxy setups */
  trustProxy: z.boolean().default(false),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// ============================================================================
// Database Configuration
// ============================================================================

/**
 * Database configuration schema
 */
export const DatabaseConfigSchema = z.object({
  /** Database host */
  host: z.string().default('localhost'),
  /** Database port */
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  /** Database name */
  database: z.string(),
  /** Database username */
  username: z.string(),
  /** Database password */
  password: z.string(),
  /** Enable SSL connection */
  ssl: z.coerce.boolean().default(false),
  /** Minimum pool size */
  poolMin: z.coerce.number().int().min(0).default(2),
  /** Maximum pool size */
  poolMax: z.coerce.number().int().min(1).default(10),
  /** Connection timeout in milliseconds */
  connectionTimeout: z.coerce.number().int().min(1000).default(30000),
  /** Idle timeout in milliseconds */
  idleTimeout: z.coerce.number().int().min(1000).default(30000),
  /** Full connection string (overrides individual settings) */
  connectionString: z.string().optional(),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// ============================================================================
// Redis Configuration
// ============================================================================

/**
 * Redis configuration schema
 */
export const RedisConfigSchema = z.object({
  /** Redis host */
  host: z.string().default('localhost'),
  /** Redis port */
  port: z.coerce.number().int().min(1).max(65535).default(6379),
  /** Redis password */
  password: z.string().optional(),
  /** Redis database number */
  db: z.coerce.number().int().min(0).max(15).default(0),
  /** Enable TLS */
  tls: z.coerce.boolean().default(false),
  /** Key prefix for all keys */
  keyPrefix: z.string().default('code-reviewer:'),
  /** Connection timeout in milliseconds */
  connectTimeout: z.coerce.number().int().min(1000).default(10000),
  /** Command timeout in milliseconds */
  commandTimeout: z.coerce.number().int().min(1000).default(5000),
  /** Enable cluster mode */
  cluster: z.coerce.boolean().default(false),
});

export type RedisConfig = z.infer<typeof RedisConfigSchema>;

// ============================================================================
// Queue Configuration (BullMQ)
// ============================================================================

/**
 * Queue configuration schema
 */
export const QueueConfigSchema = z.object({
  /** Redis connection for queue (uses main Redis if not specified) */
  redis: RedisConfigSchema.optional(),
  /** Default job options */
  defaultJobOptions: z.object({
    /** Maximum retry attempts */
    attempts: z.coerce.number().int().min(1).default(3),
    /** Backoff strategy */
    backoff: z.object({
      /** Backoff type */
      type: z.enum(['fixed', 'exponential']).default('exponential'),
      /** Initial delay in milliseconds */
      delay: z.coerce.number().int().min(100).default(1000),
    }).default({}),
    /** Remove completed jobs (true, false, or max count to keep) */
    removeOnComplete: z.union([z.boolean(), z.coerce.number()]).default(100),
    /** Remove failed jobs (true, false, or max count to keep) */
    removeOnFail: z.union([z.boolean(), z.coerce.number()]).default(500),
  }).default({}),
  /** Concurrent workers per queue */
  concurrency: z.coerce.number().int().min(1).default(5),
  /** Lock duration in milliseconds */
  lockDuration: z.coerce.number().int().min(5000).default(30000),
});

export type QueueConfig = z.infer<typeof QueueConfigSchema>;

// ============================================================================
// Parser Configuration
// ============================================================================

/**
 * Terraform parser configuration
 */
export const TerraformParserConfigSchema = z.object({
  /** Maximum file size to parse in bytes */
  maxFileSize: z.coerce.number().int().default(10 * 1024 * 1024), // 10MB
  /** Supported Terraform versions */
  supportedVersions: z.array(z.string()).default(['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8']),
  /** Enable HCL2 parsing */
  enableHCL2: z.coerce.boolean().default(true),
  /** Parse timeout in milliseconds */
  parseTimeout: z.coerce.number().int().min(1000).default(60000),
});

/**
 * Helm parser configuration
 */
export const HelmParserConfigSchema = z.object({
  /** Maximum chart size in bytes */
  maxChartSize: z.coerce.number().int().default(50 * 1024 * 1024), // 50MB
  /** Supported Helm API versions */
  supportedApiVersions: z.array(z.string()).default(['v1', 'v2']),
  /** Enable values.yaml parsing */
  parseValues: z.coerce.boolean().default(true),
  /** Parse timeout in milliseconds */
  parseTimeout: z.coerce.number().int().min(1000).default(60000),
});

/**
 * Kubernetes parser configuration
 */
export const KubernetesParserConfigSchema = z.object({
  /** Supported Kubernetes API versions */
  supportedApiVersions: z.array(z.string()).default([
    'v1',
    'apps/v1',
    'batch/v1',
    'networking.k8s.io/v1',
    'rbac.authorization.k8s.io/v1',
    'autoscaling/v2',
    'policy/v1',
  ]),
  /** Parse timeout in milliseconds */
  parseTimeout: z.coerce.number().int().min(1000).default(60000),
});

/**
 * Combined parser configuration
 */
export const ParserConfigSchema = z.object({
  terraform: TerraformParserConfigSchema.default({}),
  helm: HelmParserConfigSchema.default({}),
  kubernetes: KubernetesParserConfigSchema.default({}),
});

export type ParserConfig = z.infer<typeof ParserConfigSchema>;

// ============================================================================
// Detection Configuration
// ============================================================================

/**
 * Detection engine configuration
 */
export const DetectionConfigSchema = z.object({
  /** Minimum confidence threshold for dependencies (0-1) */
  confidenceThreshold: z.coerce.number().min(0).max(1).default(0.7),
  /** Maximum depth for graph traversal */
  maxGraphDepth: z.coerce.number().int().min(1).default(50),
  /** Enable circular dependency detection */
  enableCycleDetection: z.coerce.boolean().default(true),
  /** Number of parallel detectors */
  parallelDetectors: z.coerce.number().int().min(1).default(4),
  /** Detection timeout per file in milliseconds */
  timeoutPerFile: z.coerce.number().int().min(1000).default(30000),
  /** Total detection timeout in milliseconds */
  totalTimeout: z.coerce.number().int().min(5000).default(300000), // 5 minutes
  /** Maximum files to process per scan */
  maxFilesPerScan: z.coerce.number().int().min(1).default(10000),
  /** Maximum graph nodes */
  maxGraphNodes: z.coerce.number().int().min(1).default(100000),
  /** Enable caching of detection results */
  enableCaching: z.coerce.boolean().default(true),
  /** Cache TTL in seconds */
  cacheTtl: z.coerce.number().int().min(60).default(3600),
});

export type DetectionConfig = z.infer<typeof DetectionConfigSchema>;

// ============================================================================
// External Services Configuration
// ============================================================================

/**
 * Terraform Registry configuration
 */
export const TerraformRegistryConfigSchema = z.object({
  /** Registry base URL */
  baseUrl: z.string().url().default('https://registry.terraform.io'),
  /** Request timeout in milliseconds */
  timeout: z.coerce.number().int().min(1000).default(10000),
  /** Maximum retry attempts */
  retries: z.coerce.number().int().min(0).default(3),
  /** API token (optional) */
  token: z.string().optional(),
});

/**
 * Helm Repository configuration
 */
export const HelmRepositoryConfigSchema = z.object({
  /** Repository name */
  name: z.string(),
  /** Repository URL */
  url: z.string().url(),
  /** Authentication username */
  username: z.string().optional(),
  /** Authentication password */
  password: z.string().optional(),
});

/**
 * GitHub provider configuration
 */
export const GitHubConfigSchema = z.object({
  /** GitHub API URL */
  apiUrl: z.string().url().default('https://api.github.com'),
  /** Personal access token */
  token: z.string().optional(),
  /** App ID for GitHub Apps */
  appId: z.string().optional(),
  /** Private key for GitHub Apps */
  privateKey: z.string().optional(),
  /** Installation ID for GitHub Apps */
  installationId: z.string().optional(),
  /** Request timeout in milliseconds */
  timeout: z.coerce.number().int().min(1000).default(30000),
});

/**
 * GitLab provider configuration
 */
export const GitLabConfigSchema = z.object({
  /** GitLab API URL */
  apiUrl: z.string().url().default('https://gitlab.com/api/v4'),
  /** Personal access token */
  token: z.string().optional(),
  /** Request timeout in milliseconds */
  timeout: z.coerce.number().int().min(1000).default(30000),
});

/**
 * Bitbucket provider configuration
 */
export const BitbucketConfigSchema = z.object({
  /** Bitbucket API URL */
  apiUrl: z.string().url().default('https://api.bitbucket.org/2.0'),
  /** App password or token */
  token: z.string().optional(),
  /** Username for authentication */
  username: z.string().optional(),
  /** Request timeout in milliseconds */
  timeout: z.coerce.number().int().min(1000).default(30000),
});

/**
 * External services configuration
 */
export const ExternalServicesConfigSchema = z.object({
  terraformRegistry: TerraformRegistryConfigSchema.default({}),
  helmRepositories: z.array(HelmRepositoryConfigSchema).default([]),
  github: GitHubConfigSchema.default({}),
  gitlab: GitLabConfigSchema.default({}),
  bitbucket: BitbucketConfigSchema.default({}),
});

export type ExternalServicesConfig = z.infer<typeof ExternalServicesConfigSchema>;

// ============================================================================
// Authentication Configuration
// ============================================================================

/**
 * JWT configuration
 */
export const JwtConfigSchema = z.object({
  /** JWT private key (for RS256) */
  privateKey: z.string().optional(),
  /** JWT public key (for RS256) */
  publicKey: z.string().optional(),
  /** JWT secret (for HS256) */
  secret: z.string().min(32).optional(),
  /** JWT algorithm */
  algorithm: z.enum(['RS256', 'RS384', 'RS512', 'HS256', 'HS384', 'HS512']).default('RS256'),
  /** Token issuer */
  issuer: z.string().default('code-reviewer-api'),
  /** Token audience */
  audience: z.string().optional(),
  /** Access token TTL in seconds */
  accessTokenTtl: z.coerce.number().int().min(60).default(900), // 15 minutes
  /** Refresh token TTL in seconds */
  refreshTokenTtl: z.coerce.number().int().min(3600).default(604800), // 7 days
});

/**
 * OAuth provider configuration
 */
export const OAuthProviderConfigSchema = z.object({
  /** OAuth client ID */
  clientId: z.string(),
  /** OAuth client secret */
  clientSecret: z.string(),
  /** Callback URL */
  callbackUrl: z.string().url(),
  /** OAuth scopes */
  scopes: z.array(z.string()).default([]),
});

/**
 * Authentication configuration
 */
export const AuthConfigSchema = z.object({
  jwt: JwtConfigSchema.default({}),
  github: OAuthProviderConfigSchema.optional(),
  gitlab: OAuthProviderConfigSchema.optional(),
  bitbucket: OAuthProviderConfigSchema.optional(),
  /** Session secret for cookie signing */
  sessionSecret: z.string().min(32).optional(),
  /** Bcrypt rounds for password hashing */
  bcryptRounds: z.coerce.number().int().min(10).max(15).default(12),
  /** Enable API key authentication */
  enableApiKeys: z.coerce.boolean().default(true),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// ============================================================================
// Feature Flags Configuration
// ============================================================================

/**
 * Feature flags schema
 */
export const FeatureFlagsSchema = z.object({
  /** Enable asynchronous scanning */
  enableAsyncScanning: z.coerce.boolean().default(true),
  /** Enable webhook notifications */
  enableWebhooks: z.coerce.boolean().default(true),
  /** Enable metrics collection */
  enableMetrics: z.coerce.boolean().default(true),
  /** Enable caching layer */
  enableCaching: z.coerce.boolean().default(true),
  /** Enable GraphQL API */
  enableGraphQL: z.coerce.boolean().default(false),
  /** Enable experimental Helm V3 features */
  experimentalHelmV3: z.coerce.boolean().default(false),
  /** Enable experimental Kubernetes operator detection */
  experimentalKubernetesOperators: z.coerce.boolean().default(false),
  /** Enable experimental AI-assisted detection */
  experimentalAIDetection: z.coerce.boolean().default(false),
  /** Enable debug mode */
  debugMode: z.coerce.boolean().default(false),
  /** Enable detailed error messages */
  verboseErrors: z.coerce.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

// ============================================================================
// Logging Configuration
// ============================================================================

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  /** Log level */
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  /** Enable pretty printing (development only) */
  pretty: z.coerce.boolean().default(false),
  /** Fields to redact from logs */
  redact: z.array(z.string()).default([
    'password',
    'token',
    'secret',
    'apiKey',
    'privateKey',
    'accessToken',
    'refreshToken',
    'authorization',
  ]),
  /** Log destination */
  destination: z.enum(['console', 'file', 'both']).default('console'),
  /** Log file path (when destination is file or both) */
  filePath: z.string().optional(),
  /** Enable request logging */
  logRequests: z.coerce.boolean().default(true),
  /** Enable response logging */
  logResponses: z.coerce.boolean().default(false),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// ============================================================================
// Monitoring Configuration
// ============================================================================

/**
 * Monitoring and observability configuration
 */
export const MonitoringConfigSchema = z.object({
  /** Enable Sentry error tracking */
  sentryDsn: z.string().url().optional(),
  /** Sentry environment */
  sentryEnvironment: z.string().optional(),
  /** Enable Prometheus metrics */
  prometheusEnabled: z.coerce.boolean().default(false),
  /** Prometheus metrics path */
  prometheusPath: z.string().default('/metrics'),
  /** Enable health checks */
  healthCheckEnabled: z.coerce.boolean().default(true),
  /** Health check path */
  healthCheckPath: z.string().default('/health'),
});

export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

// ============================================================================
// Storage Configuration
// ============================================================================

/**
 * Storage configuration for file uploads and artifacts
 */
export const StorageConfigSchema = z.object({
  /** Storage provider type */
  provider: z.enum(['local', 's3', 'gcs', 'azure']).default('local'),
  /** Local storage path */
  localPath: z.string().default('/tmp/code-reviewer'),
  /** S3 bucket name */
  s3Bucket: z.string().optional(),
  /** S3 region */
  s3Region: z.string().optional(),
  /** S3 endpoint (for S3-compatible services) */
  s3Endpoint: z.string().url().optional(),
  /** GCS bucket name */
  gcsBucket: z.string().optional(),
  /** Azure container name */
  azureContainer: z.string().optional(),
  /** Maximum upload size in bytes */
  maxUploadSize: z.coerce.number().int().default(100 * 1024 * 1024), // 100MB
});

export type StorageConfig = z.infer<typeof StorageConfigSchema>;

// ============================================================================
// Documentation Configuration
// ============================================================================
// TASK-FINAL-004: Documentation system configuration for API docs and launch

/**
 * Swagger/OpenAPI documentation configuration
 */
export const SwaggerConfigSchema = z.object({
  /** Enable Swagger UI */
  enabled: z.coerce.boolean().default(true),
  /** Route prefix for Swagger UI */
  routePrefix: z.string().default('/docs'),
  /** Expose the route publicly */
  exposeRoute: z.coerce.boolean().default(true),
});

export type SwaggerConfig = z.infer<typeof SwaggerConfigSchema>;

/**
 * OpenAPI specification configuration
 */
export const OpenAPIConfigSchema = z.object({
  /** API title */
  title: z.string().default('Code-Reviewer API'),
  /** API version */
  version: z.string().default('1.0.0'),
  /** API description */
  description: z.string().optional(),
  /** Contact email */
  contactEmail: z.string().email().optional(),
  /** License name */
  license: z.string().default('MIT'),
  /** External documentation URL */
  externalDocsUrl: z.string().url().optional(),
});

export type OpenAPIConfig = z.infer<typeof OpenAPIConfigSchema>;

/**
 * Docusaurus documentation site configuration
 */
export const DocusaurusConfigSchema = z.object({
  /** Base URL for documentation site */
  baseUrl: z.string().default('/'),
  /** Deployment URL */
  deployUrl: z.string().url().optional(),
  /** Enable edit links to GitHub */
  enableEditLinks: z.coerce.boolean().default(true),
  /** GitHub organization for docs */
  githubOrg: z.string().optional(),
  /** GitHub repository for docs */
  githubRepo: z.string().optional(),
});

export type DocusaurusConfig = z.infer<typeof DocusaurusConfigSchema>;

/**
 * Beta program configuration
 */
export const BetaProgramConfigSchema = z.object({
  /** Maximum number of beta customers */
  maxCustomers: z.coerce.number().int().min(1).default(50),
  /** Require NDA for onboarding */
  requireNdaForOnboarding: z.coerce.boolean().default(true),
  /** Beta program start date */
  startDate: z.string().optional(),
  /** Beta program end date */
  endDate: z.string().optional(),
  /** Waitlist enabled */
  waitlistEnabled: z.coerce.boolean().default(true),
  /** Feedback collection enabled */
  feedbackEnabled: z.coerce.boolean().default(true),
});

export type BetaProgramConfig = z.infer<typeof BetaProgramConfigSchema>;

/**
 * Launch configuration
 */
export const LaunchConfigSchema = z.object({
  /** Target launch date (YYYY-MM-DD format) */
  targetDate: z.string().optional(),
  /** All critical items must be complete before launch */
  criticalItemsRequired: z.coerce.boolean().default(true),
  /** Minimum test coverage percentage required */
  minTestCoverage: z.coerce.number().min(0).max(100).default(80),
  /** Require security audit before launch */
  requireSecurityAudit: z.coerce.boolean().default(true),
  /** Require performance benchmarks before launch */
  requirePerformanceBenchmarks: z.coerce.boolean().default(true),
  /** Launch environment */
  environment: z.enum(['staging', 'production']).default('production'),
});

export type LaunchConfig = z.infer<typeof LaunchConfigSchema>;

/**
 * Combined documentation configuration schema
 * TASK-FINAL-004: Comprehensive documentation system configuration
 */
export const DocumentationConfigSchema = z.object({
  /** Swagger/OpenAPI UI configuration */
  swagger: SwaggerConfigSchema.default({}),
  /** OpenAPI specification configuration */
  openapi: OpenAPIConfigSchema.default({}),
  /** Docusaurus documentation site configuration */
  docusaurus: DocusaurusConfigSchema.default({}),
  /** Beta program configuration */
  beta: BetaProgramConfigSchema.default({}),
  /** Launch configuration */
  launch: LaunchConfigSchema.default({}),
});

export type DocumentationConfig = z.infer<typeof DocumentationConfigSchema>;

// ============================================================================
// Complete Application Configuration
// ============================================================================

/**
 * Complete application configuration schema
 */
export const AppConfigSchema = z.object({
  /** Environment name */
  env: Environment,
  /** Application version */
  version: z.string().default('0.1.0'),
  /** Server configuration */
  server: ServerConfigSchema.default({}),
  /** Database configuration */
  database: DatabaseConfigSchema,
  /** Redis configuration */
  redis: RedisConfigSchema.optional(),
  /** Queue configuration */
  queue: QueueConfigSchema.default({}),
  /** Parser configuration */
  parsers: ParserConfigSchema.default({}),
  /** Detection configuration */
  detection: DetectionConfigSchema.default({}),
  /** External services configuration */
  externalServices: ExternalServicesConfigSchema.default({}),
  /** Authentication configuration */
  auth: AuthConfigSchema.default({}),
  /** Feature flags */
  features: FeatureFlagsSchema.default({}),
  /** Logging configuration */
  logging: LoggingConfigSchema.default({}),
  /** Monitoring configuration */
  monitoring: MonitoringConfigSchema.default({}),
  /** Storage configuration */
  storage: StorageConfigSchema.default({}),
  /** Documentation configuration (TASK-FINAL-004) */
  documentation: DocumentationConfigSchema.default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// ============================================================================
// Partial Configuration Types
// ============================================================================

/**
 * Partial configuration for merging from multiple sources
 */
export type PartialAppConfig = z.input<typeof AppConfigSchema>;

/**
 * Deep partial configuration
 */
export type DeepPartialAppConfig = {
  [K in keyof AppConfig]?: AppConfig[K] extends object
    ? Partial<AppConfig[K]>
    : AppConfig[K];
};
