/**
 * Parser Registry
 * @module parsers/registry/parser-registry
 *
 * Central registry for all IaC parsers with auto-discovery capabilities.
 * Implements the Registry pattern from Phase 3 integration-architect design.
 *
 * Features:
 * - Auto-discovery of parsers by file extension
 * - Priority-based parser selection
 * - Plugin architecture for custom parsers
 * - Caching of parse results
 */

import {
  IParser,
  ParserCapability,
  ParseResult,
  ParserOptions,
  IaCFormat,
} from '../base/parser';

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Parser factory function type
 */
export type ParserFactory<T = unknown> = (options?: ParserOptions) => IParser<T>;

/**
 * Registered parser entry
 */
export interface RegisteredParser<T = unknown> {
  /** Parser capability descriptor */
  readonly capability: ParserCapability;
  /** Factory function to create parser instances */
  readonly factory: ParserFactory<T>;
  /** Singleton instance (lazy initialized) */
  instance?: IParser<T>;
}

/**
 * Parser selection criteria
 */
export interface ParserSelectionCriteria {
  /** File path to parse */
  filePath?: string;
  /** File extension */
  extension?: string;
  /** MIME type */
  mimeType?: string;
  /** Specific format */
  format?: IaCFormat;
  /** Include experimental parsers */
  includeExperimental?: boolean;
}

/**
 * Registry configuration options
 */
export interface RegistryOptions {
  /** Enable auto-discovery of built-in parsers */
  autoDiscover?: boolean;
  /** Allow experimental parsers */
  allowExperimental?: boolean;
  /** Enable parse result caching */
  enableCache?: boolean;
  /** Maximum cache size (number of entries) */
  maxCacheSize?: number;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * Default registry options
 */
export const DEFAULT_REGISTRY_OPTIONS: Required<RegistryOptions> = {
  autoDiscover: true,
  allowExperimental: false,
  enableCache: true,
  maxCacheSize: 100,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cached parse result entry
 */
interface CacheEntry<T> {
  readonly result: ParseResult<T>;
  readonly timestamp: number;
  readonly contentHash: string;
}

// ============================================================================
// Parser Registry Class
// ============================================================================

/**
 * Central registry for IaC parsers.
 *
 * Provides parser discovery, registration, and selection based on
 * file extension, MIME type, or IaC format.
 *
 * @example
 * ```typescript
 * const registry = new ParserRegistry();
 * registry.register(terraformParserCapability, () => new TerraformParser());
 *
 * const parser = registry.getParser('.tf');
 * const result = await parser.parse(content, 'main.tf');
 * ```
 */
export class ParserRegistry {
  private readonly parsers: Map<string, RegisteredParser> = new Map();
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly options: Required<RegistryOptions>;

  constructor(options: RegistryOptions = {}) {
    this.options = { ...DEFAULT_REGISTRY_OPTIONS, ...options };

    if (this.options.autoDiscover) {
      this.discoverBuiltinParsers();
    }
  }

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Register a parser with the registry.
   *
   * @param capability - Parser capability descriptor
   * @param factory - Factory function to create parser instances
   * @throws Error if parser with same name already registered
   */
  register<T>(capability: ParserCapability, factory: ParserFactory<T>): void {
    if (this.parsers.has(capability.name)) {
      throw new Error(`Parser '${capability.name}' is already registered`);
    }

    this.parsers.set(capability.name, {
      capability,
      factory,
    });
  }

  /**
   * Unregister a parser from the registry.
   *
   * @param name - Parser name to unregister
   * @returns Whether the parser was found and removed
   */
  unregister(name: string): boolean {
    return this.parsers.delete(name);
  }

  /**
   * Check if a parser is registered.
   *
   * @param name - Parser name
   * @returns Whether the parser is registered
   */
  has(name: string): boolean {
    return this.parsers.has(name);
  }

  // ============================================================================
  // Parser Retrieval Methods
  // ============================================================================

  /**
   * Get a parser by name.
   *
   * @param name - Parser name
   * @returns Parser instance or undefined
   */
  get<T = unknown>(name: string): IParser<T> | undefined {
    const registered = this.parsers.get(name);
    if (!registered) return undefined;

    // Lazy singleton initialization
    if (!registered.instance) {
      registered.instance = registered.factory();
    }

    return registered.instance as IParser<T>;
  }

  /**
   * Get a parser suitable for the given file.
   *
   * @param criteria - Selection criteria
   * @returns Best matching parser or undefined
   */
  getParser<T = unknown>(criteria: ParserSelectionCriteria | string): IParser<T> | undefined {
    // Allow passing just a file path string
    const normalizedCriteria: ParserSelectionCriteria =
      typeof criteria === 'string' ? { filePath: criteria } : criteria;

    const candidates = this.findMatchingParsers(normalizedCriteria);
    if (candidates.length === 0) return undefined;

    // Sort by priority (descending) and return highest priority
    candidates.sort((a, b) => b.capability.priority - a.capability.priority);

    const selected = candidates[0];

    // Lazy singleton initialization
    if (!selected.instance) {
      selected.instance = selected.factory();
    }

    return selected.instance as IParser<T>;
  }

  /**
   * Get all parsers matching the criteria.
   *
   * @param criteria - Selection criteria
   * @returns Array of matching parser instances
   */
  getAllParsers<T = unknown>(criteria?: ParserSelectionCriteria): IParser<T>[] {
    const candidates = criteria
      ? this.findMatchingParsers(criteria)
      : Array.from(this.parsers.values());

    return candidates.map(entry => {
      if (!entry.instance) {
        entry.instance = entry.factory();
      }
      return entry.instance as IParser<T>;
    });
  }

  /**
   * Get parser capabilities.
   *
   * @returns Array of all registered parser capabilities
   */
  getCapabilities(): ParserCapability[] {
    return Array.from(this.parsers.values()).map(p => p.capability);
  }

  // ============================================================================
  // Parsing Methods with Caching
  // ============================================================================

  /**
   * Parse content using the appropriate parser with caching.
   *
   * @param content - File content
   * @param filePath - File path for parser selection and error reporting
   * @param options - Parser options
   * @returns Parse result
   */
  async parse<T = unknown>(
    content: string,
    filePath: string,
    options?: ParserOptions
  ): Promise<ParseResult<T>> {
    const parser = this.getParser<T>(filePath);
    if (!parser) {
      throw new Error(`No parser found for file: ${filePath}`);
    }

    // Check cache
    if (this.options.enableCache) {
      const cacheKey = this.getCacheKey(filePath, content);
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) return cached;
    }

    // Parse
    const result = await parser.parse(content, filePath, options);

    // Cache result
    if (this.options.enableCache) {
      const cacheKey = this.getCacheKey(filePath, content);
      this.addToCache(cacheKey, result, content);
    }

    return result;
  }

  /**
   * Parse file from filesystem using the appropriate parser.
   *
   * @param filePath - File path
   * @param options - Parser options
   * @returns Parse result
   */
  async parseFile<T = unknown>(
    filePath: string,
    options?: ParserOptions
  ): Promise<ParseResult<T>> {
    const parser = this.getParser<T>(filePath);
    if (!parser) {
      throw new Error(`No parser found for file: ${filePath}`);
    }

    return parser.parseFile(filePath, options);
  }

  // ============================================================================
  // Format Detection
  // ============================================================================

  /**
   * Detect the IaC format of a file.
   *
   * @param filePath - File path
   * @param content - Optional file content for deeper inspection
   * @returns Detected format or undefined
   */
  detectFormat(filePath: string, content?: string): IaCFormat | undefined {
    const parser = this.getParser({ filePath, extension: this.getExtension(filePath) });
    if (!parser) return undefined;

    const capability = Array.from(this.parsers.values())
      .find(p => p.instance === parser)?.capability;

    return capability?.format;
  }

  /**
   * Get all supported file extensions.
   *
   * @returns Array of supported extensions
   */
  getSupportedExtensions(): string[] {
    const extensions = new Set<string>();

    for (const entry of this.parsers.values()) {
      for (const ext of entry.capability.extensions) {
        extensions.add(ext);
      }
    }

    return Array.from(extensions);
  }

  /**
   * Get all supported IaC formats.
   *
   * @returns Array of supported formats
   */
  getSupportedFormats(): IaCFormat[] {
    const formats = new Set<IaCFormat>();

    for (const entry of this.parsers.values()) {
      formats.add(entry.capability.format);
    }

    return Array.from(formats);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear the parse result cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache stats
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      hitRate: 0, // Would need hit/miss tracking for real implementation
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Discover and register built-in parsers
   */
  private discoverBuiltinParsers(): void {
    // Register Terraform HCL parser capability
    // The actual parser will be lazily loaded when needed
    this.register(
      {
        name: 'terraform-hcl',
        version: '1.0.0',
        extensions: ['.tf'],
        mimeTypes: ['text/x-hcl', 'application/x-terraform'],
        format: 'terraform',
        priority: 100,
        experimental: false,
      },
      () => this.createTerraformParser()
    );

    // Register Terraform JSON parser capability
    this.register(
      {
        name: 'terraform-json',
        version: '1.0.0',
        extensions: ['.tf.json'],
        mimeTypes: ['application/json'],
        format: 'terraform-json',
        priority: 90,
        experimental: false,
      },
      () => this.createTerraformJsonParser()
    );

    // Register Terragrunt HCL parser capability (TASK-TG-001)
    this.register(
      {
        name: 'terragrunt-hcl',
        version: '1.0.0',
        extensions: ['.hcl'],
        mimeTypes: ['text/x-hcl', 'application/x-terragrunt'],
        format: 'terragrunt',
        priority: 110, // Higher than terraform to match terragrunt.hcl first
        experimental: false,
      },
      () => this.createTerragruntParser()
    );

    // Placeholder registrations for future parsers
    this.registerPlaceholder('kubernetes', ['.yaml', '.yml'], 80);
    this.registerPlaceholder('helm', ['.yaml', '.yml'], 70);
    this.registerPlaceholder('cloudformation', ['.yaml', '.yml', '.json'], 60);
    this.registerPlaceholder('dockerfile', ['Dockerfile', '.dockerfile'], 50);
  }

  /**
   * Create a Terraform HCL parser instance
   */
  private createTerraformParser(): IParser<unknown> {
    // Dynamic import to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HCLParser } = require('../terraform/hcl-parser');
    return new HCLParser();
  }

  /**
   * Create a Terraform JSON parser instance (placeholder)
   */
  private createTerraformJsonParser(): IParser<unknown> {
    // TODO: Implement Terraform JSON parser
    return this.createPlaceholderParser('terraform-json');
  }

  /**
   * Create a Terragrunt HCL parser instance
   */
  private createTerragruntParser(): IParser<unknown> {
    // Dynamic import to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TerragruntParser } = require('../terragrunt/tg-parser');
    return new TerragruntParser();
  }

  /**
   * Register a placeholder parser for formats not yet implemented
   */
  private registerPlaceholder(
    format: IaCFormat,
    extensions: string[],
    priority: number
  ): void {
    this.register(
      {
        name: `${format}-placeholder`,
        version: '0.0.1',
        extensions,
        mimeTypes: [],
        format,
        priority,
        experimental: true,
      },
      () => this.createPlaceholderParser(format)
    );
  }

  /**
   * Create a placeholder parser that returns an error
   */
  private createPlaceholderParser(format: string): IParser<unknown> {
    return {
      name: `${format}-placeholder`,
      version: '0.0.1',
      supportedExtensions: [],
      supportedMimeTypes: [],

      async parse() {
        return {
          success: false,
          errors: [{
            code: 'UNSUPPORTED_SYNTAX' as const,
            message: `Parser for ${format} format is not yet implemented`,
            location: null,
            severity: 'fatal' as const,
          }],
          partialData: null,
          metadata: {
            filePath: '',
            parserName: `${format}-placeholder`,
            parserVersion: '0.0.1',
            parseTimeMs: 0,
            fileSize: 0,
            encoding: 'utf-8',
            lineCount: 0,
          },
        };
      },

      async parseFile(filePath: string) {
        return this.parse('', filePath);
      },

      canParse() {
        return false;
      },

      async validate() {
        return [{
          code: 'UNSUPPORTED_SYNTAX',
          message: `Parser for ${format} format is not yet implemented`,
          location: null,
          severity: 'warning' as const,
        }];
      },
    };
  }

  /**
   * Find parsers matching the given criteria
   */
  private findMatchingParsers(criteria: ParserSelectionCriteria): RegisteredParser[] {
    const results: RegisteredParser[] = [];

    for (const entry of this.parsers.values()) {
      // Skip experimental parsers if not allowed
      if (entry.capability.experimental && !this.options.allowExperimental) {
        if (!criteria.includeExperimental) continue;
      }

      // Check format match
      if (criteria.format && entry.capability.format !== criteria.format) {
        continue;
      }

      // Check extension match
      if (criteria.extension) {
        if (!entry.capability.extensions.includes(criteria.extension)) {
          continue;
        }
      }

      // Check file path extension
      if (criteria.filePath) {
        const ext = this.getExtension(criteria.filePath);
        if (!entry.capability.extensions.some(e => ext.endsWith(e))) {
          continue;
        }
      }

      // Check MIME type match
      if (criteria.mimeType) {
        if (!entry.capability.mimeTypes.includes(criteria.mimeType)) {
          continue;
        }
      }

      results.push(entry);
    }

    return results;
  }

  /**
   * Extract extension from file path
   */
  private getExtension(filePath: string): string {
    const parts = filePath.split('/').pop()?.split('.') ?? [];
    if (parts.length < 2) return '';

    // Handle compound extensions like .tf.json
    if (parts.length >= 3 && parts[parts.length - 2] === 'tf') {
      return `.${parts.slice(-2).join('.')}`;
    }

    return `.${parts[parts.length - 1]}`;
  }

  /**
   * Generate cache key for content
   */
  private getCacheKey(filePath: string, content: string): string {
    // Simple hash for cache key - in production use a proper hash function
    const contentHash = this.simpleHash(content);
    return `${filePath}:${contentHash}`;
  }

  /**
   * Simple string hash for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get cached parse result
   */
  private getFromCache<T>(key: string): ParseResult<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.options.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.result as ParseResult<T>;
  }

  /**
   * Add result to cache
   */
  private addToCache<T>(key: string, result: ParseResult<T>, content: string): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.options.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      contentHash: this.simpleHash(content),
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default parser registry singleton
 */
export const parserRegistry = new ParserRegistry();

// ============================================================================
// Exports
// ============================================================================

export type {
  ParserFactory,
  RegisteredParser,
  ParserSelectionCriteria,
  RegistryOptions,
};
