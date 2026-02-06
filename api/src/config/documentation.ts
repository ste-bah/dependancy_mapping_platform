/**
 * Documentation Configuration Loader
 * @module config/documentation
 *
 * TASK-FINAL-004: Documentation system configuration
 * Loads and validates documentation-related configuration from environment variables.
 *
 * Configuration Categories:
 * - Swagger/OpenAPI UI settings
 * - OpenAPI specification metadata
 * - Docusaurus documentation site
 * - Beta program parameters
 * - Launch readiness configuration
 */

import {
  DocumentationConfig,
  DocumentationConfigSchema,
  SwaggerConfig,
  OpenAPIConfig,
  DocusaurusConfig,
  BetaProgramConfig,
  LaunchConfig,
} from './schema.js';

// ============================================================================
// Environment Variable Loading
// ============================================================================

/**
 * Load Swagger configuration from environment variables
 */
function loadSwaggerConfig(): Partial<SwaggerConfig> {
  return {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    routePrefix: process.env.SWAGGER_ROUTE_PREFIX || '/docs',
    exposeRoute: process.env.SWAGGER_EXPOSE_ROUTE !== 'false',
  };
}

/**
 * Load OpenAPI configuration from environment variables
 */
function loadOpenAPIConfig(): Partial<OpenAPIConfig> {
  return {
    title: process.env.OPENAPI_TITLE || 'Code-Reviewer API',
    version: process.env.OPENAPI_VERSION || '1.0.0',
    description: process.env.OPENAPI_DESCRIPTION || undefined,
    contactEmail: process.env.OPENAPI_CONTACT_EMAIL || undefined,
    license: process.env.OPENAPI_LICENSE || 'MIT',
    externalDocsUrl: process.env.OPENAPI_EXTERNAL_DOCS_URL || undefined,
  };
}

/**
 * Load Docusaurus configuration from environment variables
 */
function loadDocusaurusConfig(): Partial<DocusaurusConfig> {
  return {
    baseUrl: process.env.DOCS_BASE_URL || '/',
    deployUrl: process.env.DOCS_DEPLOY_URL || undefined,
    enableEditLinks: process.env.DOCS_ENABLE_EDIT_LINKS !== 'false',
    githubOrg: process.env.DOCS_GITHUB_ORG || undefined,
    githubRepo: process.env.DOCS_GITHUB_REPO || undefined,
  };
}

/**
 * Load beta program configuration from environment variables
 */
function loadBetaProgramConfig(): Partial<BetaProgramConfig> {
  const maxCustomers = process.env.BETA_MAX_CUSTOMERS;
  return {
    maxCustomers: maxCustomers ? parseInt(maxCustomers, 10) : 50,
    requireNdaForOnboarding: process.env.BETA_REQUIRE_NDA !== 'false',
    startDate: process.env.BETA_START_DATE || undefined,
    endDate: process.env.BETA_END_DATE || undefined,
    waitlistEnabled: process.env.BETA_WAITLIST_ENABLED !== 'false',
    feedbackEnabled: process.env.BETA_FEEDBACK_ENABLED !== 'false',
  };
}

/**
 * Load launch configuration from environment variables
 */
function loadLaunchConfig(): Partial<LaunchConfig> {
  const minTestCoverage = process.env.LAUNCH_MIN_TEST_COVERAGE;
  return {
    targetDate: process.env.LAUNCH_TARGET_DATE || undefined,
    criticalItemsRequired: process.env.LAUNCH_CRITICAL_ITEMS_REQUIRED !== 'false',
    minTestCoverage: minTestCoverage ? parseFloat(minTestCoverage) : 80,
    requireSecurityAudit: process.env.LAUNCH_REQUIRE_SECURITY_AUDIT !== 'false',
    requirePerformanceBenchmarks: process.env.LAUNCH_REQUIRE_PERF_BENCHMARKS !== 'false',
    environment: (process.env.LAUNCH_ENVIRONMENT as 'staging' | 'production') || 'production',
  };
}

// ============================================================================
// Main Configuration Loader
// ============================================================================

/**
 * Load documentation configuration from environment variables
 *
 * @returns Validated documentation configuration
 * @throws Error if configuration is invalid
 *
 * @example
 * ```typescript
 * import { loadDocumentationConfig } from './documentation.js';
 *
 * const config = loadDocumentationConfig();
 * console.log(config.swagger.enabled); // true
 * console.log(config.beta.maxCustomers); // 50
 * ```
 */
export function loadDocumentationConfig(): DocumentationConfig {
  const rawConfig = {
    swagger: loadSwaggerConfig(),
    openapi: loadOpenAPIConfig(),
    docusaurus: loadDocusaurusConfig(),
    beta: loadBetaProgramConfig(),
    launch: loadLaunchConfig(),
  };

  // Validate with Zod schema
  const result = DocumentationConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new Error(`Invalid documentation configuration: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.data;
}

// ============================================================================
// Configuration Accessors
// ============================================================================

/**
 * Get Swagger configuration from a DocumentationConfig
 */
export function getSwaggerConfigFrom(config: DocumentationConfig): SwaggerConfig {
  return config.swagger;
}

/**
 * Get OpenAPI configuration from a DocumentationConfig
 */
export function getOpenAPIConfigFrom(config: DocumentationConfig): OpenAPIConfig {
  return config.openapi;
}

/**
 * Get Docusaurus configuration from a DocumentationConfig
 */
export function getDocusaurusConfigFrom(config: DocumentationConfig): DocusaurusConfig {
  return config.docusaurus;
}

/**
 * Get beta program configuration from a DocumentationConfig
 */
export function getBetaProgramConfigFrom(config: DocumentationConfig): BetaProgramConfig {
  return config.beta;
}

/**
 * Get launch configuration from a DocumentationConfig
 */
export function getLaunchConfigFrom(config: DocumentationConfig): LaunchConfig {
  return config.launch;
}

// ============================================================================
// Configuration Validation Helpers
// ============================================================================

/**
 * Check if Swagger documentation is enabled
 */
export function isSwaggerEnabled(config: DocumentationConfig): boolean {
  return config.swagger.enabled;
}

/**
 * Check if beta program is active based on dates
 */
export function isBetaProgramActive(config: DocumentationConfig): boolean {
  const { startDate, endDate } = config.beta;
  const now = new Date();

  if (startDate) {
    const start = new Date(startDate);
    if (now < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (now > end) {
      return false;
    }
  }

  return true;
}

/**
 * Check if beta program has capacity for more customers
 */
export function hasBetaCapacity(config: DocumentationConfig, currentCustomers: number): boolean {
  return currentCustomers < config.beta.maxCustomers;
}

/**
 * Check if launch date has been set
 */
export function hasLaunchDate(config: DocumentationConfig): boolean {
  return config.launch.targetDate !== undefined && config.launch.targetDate.length > 0;
}

/**
 * Check if launch date has passed
 */
export function isLaunchDatePassed(config: DocumentationConfig): boolean {
  if (!config.launch.targetDate) {
    return false;
  }
  const targetDate = new Date(config.launch.targetDate);
  return new Date() >= targetDate;
}

// ============================================================================
// Configuration Summary
// ============================================================================

/**
 * Generate a summary of documentation configuration for logging
 */
export function getDocumentationConfigSummary(config: DocumentationConfig): Record<string, unknown> {
  return {
    swagger: {
      enabled: config.swagger.enabled,
      routePrefix: config.swagger.routePrefix,
    },
    openapi: {
      title: config.openapi.title,
      version: config.openapi.version,
    },
    docusaurus: {
      baseUrl: config.docusaurus.baseUrl,
      hasDeployUrl: !!config.docusaurus.deployUrl,
    },
    beta: {
      maxCustomers: config.beta.maxCustomers,
      requireNda: config.beta.requireNdaForOnboarding,
      isActive: isBetaProgramActive(config),
    },
    launch: {
      targetDate: config.launch.targetDate || 'not set',
      criticalItemsRequired: config.launch.criticalItemsRequired,
      minTestCoverage: config.launch.minTestCoverage,
    },
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  DocumentationConfig,
  SwaggerConfig,
  OpenAPIConfig,
  DocusaurusConfig,
  BetaProgramConfig,
  LaunchConfig,
} from './schema.js';

export { DocumentationConfigSchema } from './schema.js';
