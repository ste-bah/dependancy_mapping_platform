/**
 * Terragrunt HCL Parser
 * @module parsers/terragrunt/tg-parser
 *
 * TASK-TG-001: Parse Terragrunt HCL files into typed AST
 *
 * Main parser class for Terragrunt configuration files. Extends BaseParser<T>
 * and uses composition with TerragruntLexer, TerragruntFunctionParser, and
 * IncludeResolver for complete parsing functionality.
 *
 * Supports:
 * - All 13 Terragrunt block types
 * - All 27 Terragrunt built-in functions
 * - Hierarchical include resolution
 * - Dependency tracking
 * - Error recovery mode
 */

import * as path from 'path';
import {
  BaseParser,
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
} from '../base/parser';
import { SourceLocation, HCLExpression } from '../terraform/types';
import { ExpressionParser } from '../terraform/expression-parser';
import {
  TerragruntLexer,
  TerragruntToken,
  TerragruntTokenType,
  filterTokensForParsing,
  extractStringContent,
} from './tg-lexer';
import { TerragruntFunctionParser } from './function-parser';
import { IncludeResolver, createIncludeResolver } from './include-resolver';
import {
  TerragruntFile,
  TerragruntBlock,
  TerragruntBlockType,
  TerragruntParseError,
  TerragruntParserOptions,
  DEFAULT_TERRAGRUNT_PARSER_OPTIONS,
  // Block types
  TerraformBlock,
  RemoteStateBlock,
  IncludeBlock,
  LocalsBlock,
  DependencyBlock,
  DependenciesBlock,
  GenerateBlock,
  InputsBlock,
  IamRoleBlock,
  RetryConfigBlock,
  SimpleConfigBlock,
  TerraformExtraArguments,
  TerraformHook,
  RemoteStateGenerate,
  ResolvedInclude,
  ResolvedDependency,
} from './types';

// ============================================================================
// Valid Block Types
// ============================================================================

/**
 * Set of valid Terragrunt block type names
 */
const VALID_BLOCK_TYPES = new Set<string>([
  'terraform',
  'remote_state',
  'include',
  'locals',
  'dependency',
  'dependencies',
  'generate',
  'inputs',
  'download_dir',
  'prevent_destroy',
  'skip',
  'iam_role',
  'retry_config',
]);

/**
 * Block types that are attribute assignments (not block declarations)
 */
const ATTRIBUTE_BLOCK_TYPES = new Set<string>([
  'inputs',
  'download_dir',
  'prevent_destroy',
  'skip',
]);

// ============================================================================
// Terragrunt Parser Class
// ============================================================================

/**
 * Parser for Terragrunt HCL configuration files.
 *
 * Implements BaseParser<TerragruntFile> and provides full parsing support
 * for all Terragrunt configuration constructs.
 *
 * @example
 * ```typescript
 * const parser = new TerragruntParser();
 *
 * // Parse string content
 * const result = await parser.parse(content, 'terragrunt.hcl');
 *
 * // Parse file from disk
 * const fileResult = await parser.parseFile('/path/to/terragrunt.hcl');
 *
 * // Check if file is a Terragrunt config
 * const canParse = parser.canParse('terragrunt.hcl');
 * ```
 */
export class TerragruntParser extends BaseParser<TerragruntFile> {
  readonly name = 'terragrunt-hcl';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.hcl'];
  readonly supportedMimeTypes = ['text/x-hcl', 'application/x-terragrunt'];

  private tokens: TerragruntToken[] = [];
  private pos: number = 0;
  private filePath: string = '';
  private errors: TerragruntParseError[] = [];
  private readonly expressionParser: ExpressionParser;
  private readonly functionParser: TerragruntFunctionParser;
  private readonly tgOptions: TerragruntParserOptions;

  constructor(options: Partial<TerragruntParserOptions & ParserOptions> = {}) {
    super(options);
    this.tgOptions = { ...DEFAULT_TERRAGRUNT_PARSER_OPTIONS, ...options };
    this.expressionParser = new ExpressionParser({
      includeRaw: this.tgOptions.includeRaw,
      useCache: true,
    });
    this.functionParser = new TerragruntFunctionParser({
      strictMode: false,
      includeRaw: this.tgOptions.includeRaw,
    });
  }

  // ============================================================================
  // BaseParser Implementation
  // ============================================================================

  /**
   * Check if this parser can handle the given file.
   * Detects terragrunt.hcl files by filename.
   */
  override canParse(filePath: string, content?: string): boolean {
    const filename = path.basename(filePath).toLowerCase();

    // Primary check: filename is terragrunt.hcl
    if (filename === 'terragrunt.hcl') {
      return true;
    }

    // Secondary check: .hcl file with terragrunt content markers
    if (filename.endsWith('.hcl') && content) {
      return this.hasTerragruntMarkers(content);
    }

    return false;
  }

  /**
   * Perform the actual parsing of Terragrunt HCL content
   */
  protected async doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<TerragruntFile>> {
    const startTime = performance.now();
    this.reset(filePath);

    // Tokenize
    const lexer = new TerragruntLexer(content, filePath);
    const lexerResult = lexer.tokenize();

    // Convert lexer errors to parse errors
    for (const error of lexerResult.errors) {
      this.errors.push({
        message: error.message,
        location: error.location,
        severity: 'error',
        code: 'SYNTAX_ERROR',
      });
    }

    // Filter tokens for parsing
    this.tokens = filterTokensForParsing(lexerResult.tokens) as TerragruntToken[];
    this.pos = 0;

    // Parse blocks
    const blocks: TerragruntBlock[] = [];

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      try {
        const block = this.parseTopLevelBlock();
        if (block) {
          blocks.push(block);
        }
      } catch (error) {
        if (this.tgOptions.errorRecovery) {
          this.errors.push({
            message: error instanceof Error ? error.message : String(error),
            location: this.currentLocation(),
            severity: 'error',
            code: 'SYNTAX_ERROR',
          });
          this.recoverFromError();
        } else {
          return this.createFailure(
            [{
              code: 'SYNTAX_ERROR',
              message: error instanceof Error ? error.message : String(error),
              location: this.currentLocation(),
              severity: 'fatal',
            }],
            null,
            this.createMetadata(filePath, startTime, content)
          );
        }
      }
    }

    // Resolve includes and dependencies
    let includes: readonly ResolvedInclude[] = [];
    let dependencies: readonly ResolvedDependency[] = [];

    if (this.tgOptions.resolveIncludes || this.tgOptions.resolveDependencies) {
      const preliminaryFile: TerragruntFile = {
        path: filePath,
        blocks,
        includes: [],
        dependencies: [],
        errors: this.errors,
        encoding: this.tgOptions.encoding,
        size: content.length,
      };

      const resolver = createIncludeResolver({
        baseDir: this.tgOptions.baseDir,
        maxDepth: this.tgOptions.maxIncludeDepth,
        resolveFileSystem: true,
      });

      const resolution = resolver.resolveAll(preliminaryFile);
      includes = resolution.includes;
      dependencies = resolution.dependencies;

      // Add resolution errors
      this.errors.push(...resolution.errors);
    }

    // Create final result
    const terragruntFile: TerragruntFile = {
      path: filePath,
      blocks,
      includes,
      dependencies,
      errors: this.errors,
      encoding: this.tgOptions.encoding,
      size: content.length,
    };

    // Convert to ParseResult
    const warnings = this.errors.filter(e => e.severity === 'warning');
    const fatalErrors = this.errors.filter(e => e.severity === 'error');

    if (fatalErrors.length > 0 && !this.tgOptions.errorRecovery) {
      return this.createFailure(
        fatalErrors.map(e => ({
          code: e.code,
          message: e.message,
          location: e.location,
          severity: 'error' as const,
        })),
        terragruntFile,
        this.createMetadata(filePath, startTime, content)
      );
    }

    return this.createSuccess(
      terragruntFile,
      warnings.map(w => ({
        code: w.code,
        message: w.message,
        location: w.location,
        severity: 'warning' as const,
      })),
      this.createMetadata(filePath, startTime, content)
    );
  }

  // ============================================================================
  // Block Parsing
  // ============================================================================

  /**
   * Parse a top-level block or attribute
   */
  private parseTopLevelBlock(): TerragruntBlock | null {
    const startToken = this.current();

    if (startToken.type !== 'IDENTIFIER') {
      this.advance();
      return null;
    }

    const blockType = startToken.value;

    // Check for valid block type
    if (!VALID_BLOCK_TYPES.has(blockType)) {
      this.errors.push({
        message: `Unknown block type: ${blockType}`,
        location: this.tokenLocation(startToken),
        severity: 'warning',
        code: 'INVALID_BLOCK_TYPE',
      });
      this.advance();
      // Skip to next potential block
      while (!this.isAtEnd() && !this.check('IDENTIFIER')) {
        this.advance();
      }
      return null;
    }

    // Handle attribute-style blocks (inputs = { ... })
    if (ATTRIBUTE_BLOCK_TYPES.has(blockType)) {
      return this.parseAttributeBlock(blockType as TerragruntBlockType, startToken);
    }

    // Parse labeled block
    return this.parseBlockWithLabels(blockType as TerragruntBlockType, startToken);
  }

  /**
   * Parse an attribute-style block (e.g., inputs = { ... })
   */
  private parseAttributeBlock(
    blockType: TerragruntBlockType,
    startToken: TerragruntToken
  ): TerragruntBlock | null {
    this.advance(); // Skip identifier
    this.skipNewlines();

    if (!this.check('EQUALS')) {
      this.errors.push({
        message: `Expected '=' after ${blockType}`,
        location: this.currentLocation(),
        severity: 'error',
        code: 'SYNTAX_ERROR',
      });
      return null;
    }

    this.advance(); // Skip =
    this.skipNewlines();

    const value = this.parseExpression();
    const endToken = this.current();

    const location = this.createBlockLocation(startToken, endToken);

    switch (blockType) {
      case 'inputs':
        return this.createInputsBlock(value, location);

      case 'download_dir':
      case 'prevent_destroy':
      case 'skip':
        return this.createSimpleConfigBlock(blockType, value, location);

      default:
        return null;
    }
  }

  /**
   * Parse a block with labels (e.g., include "label" { ... })
   */
  private parseBlockWithLabels(
    blockType: TerragruntBlockType,
    startToken: TerragruntToken
  ): TerragruntBlock | null {
    this.advance(); // Skip block type identifier

    // Read labels
    const labels: string[] = [];
    while (!this.check('LBRACE') && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check('STRING')) {
        labels.push(extractStringContent(this.current()));
        this.advance();
      } else if (this.check('IDENTIFIER')) {
        labels.push(this.current().value);
        this.advance();
      } else {
        break;
      }
    }

    this.skipNewlines();

    if (!this.check('LBRACE')) {
      this.errors.push({
        message: `Expected '{' after ${blockType} labels`,
        location: this.currentLocation(),
        severity: 'error',
        code: 'SYNTAX_ERROR',
      });
      return null;
    }

    this.advance(); // Skip {

    // Parse block body
    const body = this.parseBlockBody();

    if (this.check('RBRACE')) {
      this.advance(); // Skip }
    }

    const endToken = this.current();
    const location = this.createBlockLocation(startToken, endToken);

    // Create appropriate block type
    return this.createTypedBlock(blockType, labels, body, location, startToken);
  }

  /**
   * Parse block body (attributes and nested blocks)
   */
  private parseBlockBody(): {
    attributes: Record<string, HCLExpression>;
    nestedBlocks: Array<{ type: string; labels: string[]; body: Record<string, HCLExpression> }>;
  } {
    const attributes: Record<string, HCLExpression> = {};
    const nestedBlocks: Array<{ type: string; labels: string[]; body: Record<string, HCLExpression> }> = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check('RBRACE')) break;

      if (this.check('IDENTIFIER')) {
        const name = this.current().value;
        this.advance();
        this.skipNewlines();

        if (this.check('EQUALS')) {
          // Attribute assignment
          this.advance();
          this.skipNewlines();
          attributes[name] = this.parseExpression();
        } else if (this.check('LBRACE') || this.check('STRING') || this.check('IDENTIFIER')) {
          // Nested block
          const nested = this.parseNestedBlock(name);
          if (nested) {
            nestedBlocks.push(nested);
          }
        }
      } else {
        this.advance();
      }
    }

    return { attributes, nestedBlocks };
  }

  /**
   * Parse a nested block within another block
   */
  private parseNestedBlock(
    blockType: string
  ): { type: string; labels: string[]; body: Record<string, HCLExpression> } | null {
    const labels: string[] = [];

    // Read labels
    while (!this.check('LBRACE') && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check('STRING')) {
        labels.push(extractStringContent(this.current()));
        this.advance();
      } else if (this.check('IDENTIFIER')) {
        labels.push(this.current().value);
        this.advance();
      } else {
        break;
      }
    }

    this.skipNewlines();

    if (!this.check('LBRACE')) {
      return null;
    }

    this.advance(); // Skip {

    const { attributes } = this.parseBlockBody();

    if (this.check('RBRACE')) {
      this.advance();
    }

    return { type: blockType, labels, body: attributes };
  }

  // ============================================================================
  // Block Creation Methods
  // ============================================================================

  /**
   * Create a typed block from parsed data
   */
  private createTypedBlock(
    blockType: TerragruntBlockType,
    labels: string[],
    body: { attributes: Record<string, HCLExpression>; nestedBlocks: Array<{ type: string; labels: string[]; body: Record<string, HCLExpression> }> },
    location: SourceLocation,
    startToken: TerragruntToken
  ): TerragruntBlock | null {
    const raw = this.tgOptions.includeRaw ? startToken.value : '';

    switch (blockType) {
      case 'terraform':
        return this.createTerraformBlock(body, location, raw);

      case 'remote_state':
        return this.createRemoteStateBlock(body.attributes, location, raw);

      case 'include':
        return this.createIncludeBlock(labels[0] ?? '', body.attributes, location, raw);

      case 'locals':
        return this.createLocalsBlock(body.attributes, location, raw);

      case 'dependency':
        return this.createDependencyBlock(labels[0] ?? '', body.attributes, location, raw);

      case 'dependencies':
        return this.createDependenciesBlock(body.attributes, location, raw);

      case 'generate':
        return this.createGenerateBlock(labels[0] ?? '', body.attributes, location, raw);

      case 'iam_role':
        return this.createIamRoleBlock(body.attributes, location, raw);

      case 'retry_config':
        return this.createRetryConfigBlock(body.attributes, location, raw);

      default:
        return null;
    }
  }

  /**
   * Create terraform {} block
   */
  private createTerraformBlock(
    body: { attributes: Record<string, HCLExpression>; nestedBlocks: Array<{ type: string; labels: string[]; body: Record<string, HCLExpression> }> },
    location: SourceLocation,
    raw: string
  ): TerraformBlock {
    const extraArguments: TerraformExtraArguments[] = [];
    const beforeHooks: TerraformHook[] = [];
    const afterHooks: TerraformHook[] = [];
    const errorHooks: TerraformHook[] = [];

    for (const nested of body.nestedBlocks) {
      switch (nested.type) {
        case 'extra_arguments':
          extraArguments.push(this.parseExtraArguments(nested.labels[0] ?? '', nested.body));
          break;
        case 'before_hook':
          beforeHooks.push(this.parseHook(nested.labels[0] ?? '', nested.body));
          break;
        case 'after_hook':
          afterHooks.push(this.parseHook(nested.labels[0] ?? '', nested.body));
          break;
        case 'error_hook':
          errorHooks.push(this.parseHook(nested.labels[0] ?? '', nested.body));
          break;
      }
    }

    return {
      type: 'terraform',
      source: body.attributes['source'] ?? null,
      extraArguments,
      beforeHooks,
      afterHooks,
      errorHooks,
      includeInCopy: this.extractStringArray(body.attributes['include_in_copy']),
      location,
      raw,
    };
  }

  /**
   * Create remote_state {} block
   */
  private createRemoteStateBlock(
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): RemoteStateBlock {
    let generate: RemoteStateGenerate | null = null;
    const genAttr = attributes['generate'];
    if (genAttr && genAttr.type === 'object') {
      generate = {
        path: this.extractStringValue(genAttr.attributes['path']) ?? 'backend.tf',
        ifExists: (this.extractStringValue(genAttr.attributes['if_exists']) as RemoteStateGenerate['ifExists']) ?? 'overwrite_terragrunt',
      };
    }

    const config: Record<string, HCLExpression> = {};
    const configAttr = attributes['config'];
    if (configAttr && configAttr.type === 'object') {
      Object.assign(config, configAttr.attributes);
    }

    return {
      type: 'remote_state',
      backend: this.extractStringValue(attributes['backend']) ?? 's3',
      generate,
      config,
      disableInit: this.extractBoolValue(attributes['disable_init']) ?? false,
      disableDependencyOptimization: this.extractBoolValue(attributes['disable_dependency_optimization']) ?? false,
      location,
      raw,
    };
  }

  /**
   * Create include {} block
   */
  private createIncludeBlock(
    label: string,
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): IncludeBlock {
    return {
      type: 'include',
      label,
      path: attributes['path'] ?? this.createNullExpression(),
      exposeAsVariable: this.extractBoolValue(attributes['expose']) ?? false,
      mergeStrategy: (this.extractStringValue(attributes['merge_strategy']) as IncludeBlock['mergeStrategy']) ?? 'no_merge',
      location,
      raw,
    };
  }

  /**
   * Create locals {} block
   */
  private createLocalsBlock(
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): LocalsBlock {
    return {
      type: 'locals',
      variables: attributes,
      location,
      raw,
    };
  }

  /**
   * Create dependency {} block
   */
  private createDependencyBlock(
    name: string,
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): DependencyBlock {
    const mockOutputs: Record<string, HCLExpression> = {};
    const mockAttr = attributes['mock_outputs'];
    if (mockAttr && mockAttr.type === 'object') {
      Object.assign(mockOutputs, mockAttr.attributes);
    }

    return {
      type: 'dependency',
      name,
      configPath: attributes['config_path'] ?? this.createNullExpression(),
      skipOutputs: this.extractBoolValue(attributes['skip_outputs']) ?? false,
      mockOutputs,
      mockOutputsMergeStrategyWithState: (this.extractStringValue(attributes['mock_outputs_merge_strategy_with_state']) as DependencyBlock['mockOutputsMergeStrategyWithState']) ?? 'no_merge',
      mockOutputsAllowedTerraformCommands: this.extractStringArray(attributes['mock_outputs_allowed_terraform_commands']),
      location,
      raw,
    };
  }

  /**
   * Create dependencies {} block
   */
  private createDependenciesBlock(
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): DependenciesBlock {
    return {
      type: 'dependencies',
      paths: attributes['paths'] ?? this.createArrayExpression([]),
      location,
      raw,
    };
  }

  /**
   * Create generate {} block
   */
  private createGenerateBlock(
    label: string,
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): GenerateBlock {
    return {
      type: 'generate',
      label,
      path: attributes['path'] ?? this.createNullExpression(),
      contents: attributes['contents'] ?? this.createNullExpression(),
      ifExists: (this.extractStringValue(attributes['if_exists']) as GenerateBlock['ifExists']) ?? 'overwrite_terragrunt',
      commentPrefix: this.extractStringValue(attributes['comment_prefix']) ?? '# ',
      disableSignature: this.extractBoolValue(attributes['disable_signature']) ?? false,
      location,
      raw,
    };
  }

  /**
   * Create inputs = {} block
   */
  private createInputsBlock(
    value: HCLExpression,
    location: SourceLocation
  ): InputsBlock {
    const values: Record<string, HCLExpression> = {};

    if (value.type === 'object') {
      Object.assign(values, value.attributes);
    }

    return {
      type: 'inputs',
      values,
      location,
      raw: this.tgOptions.includeRaw ? value.raw : '',
    };
  }

  /**
   * Create iam_role {} block
   */
  private createIamRoleBlock(
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): IamRoleBlock {
    return {
      type: 'iam_role',
      roleArn: attributes['role_arn'] ?? this.createNullExpression(),
      sessionDuration: this.extractNumberValue(attributes['session_duration']),
      webIdentityToken: attributes['web_identity_token'] ?? null,
      location,
      raw,
    };
  }

  /**
   * Create retry_config {} block
   */
  private createRetryConfigBlock(
    attributes: Record<string, HCLExpression>,
    location: SourceLocation,
    raw: string
  ): RetryConfigBlock {
    return {
      type: 'retry_config',
      retryableErrors: this.extractStringArray(attributes['retryable_errors']),
      maxRetryAttempts: this.extractNumberValue(attributes['max_retry_attempts']) ?? 3,
      sleepBetweenRetries: this.extractNumberValue(attributes['sleep_between_retries']) ?? 5,
      location,
      raw,
    };
  }

  /**
   * Create simple config block (download_dir, prevent_destroy, skip)
   */
  private createSimpleConfigBlock(
    blockType: 'download_dir' | 'prevent_destroy' | 'skip',
    value: HCLExpression,
    location: SourceLocation
  ): SimpleConfigBlock {
    return {
      type: blockType,
      value,
      location,
      raw: this.tgOptions.includeRaw ? value.raw : '',
    };
  }

  // ============================================================================
  // Helper Parsing Methods
  // ============================================================================

  /**
   * Parse extra_arguments nested block
   */
  private parseExtraArguments(
    name: string,
    body: Record<string, HCLExpression>
  ): TerraformExtraArguments {
    const envVars: Record<string, HCLExpression> = {};
    const envAttr = body['env_vars'];
    if (envAttr && envAttr.type === 'object') {
      Object.assign(envVars, envAttr.attributes);
    }

    return {
      name,
      commands: this.extractStringArray(body['commands']),
      arguments: this.extractStringArray(body['arguments']),
      envVars,
      requiredVarFiles: this.extractStringArray(body['required_var_files']),
      optionalVarFiles: this.extractStringArray(body['optional_var_files']),
    };
  }

  /**
   * Parse hook nested block
   */
  private parseHook(name: string, body: Record<string, HCLExpression>): TerraformHook {
    return {
      name,
      commands: this.extractStringArray(body['commands']),
      execute: this.extractStringArray(body['execute']),
      runOnError: this.extractBoolValue(body['run_on_error']) ?? false,
    };
  }

  /**
   * Parse an expression
   */
  private parseExpression(): HCLExpression {
    const exprStr = this.readExpressionString();
    return this.expressionParser.parse(exprStr);
  }

  /**
   * Read expression as string until end marker
   */
  private readExpressionString(): string {
    const parts: string[] = [];
    let depth = 0;
    let parenDepth = 0;

    while (!this.isAtEnd()) {
      const token = this.current();

      // End markers at depth 0
      if (depth === 0 && parenDepth === 0) {
        if (token.type === 'NEWLINE' || token.type === 'RBRACE' || token.type === 'COMMA') {
          break;
        }
      }

      if (token.type === 'LBRACE' || token.type === 'LBRACKET') {
        depth++;
      } else if (token.type === 'RBRACE' || token.type === 'RBRACKET') {
        if (depth === 0) break;
        depth--;
      } else if (token.type === 'LPAREN') {
        parenDepth++;
      } else if (token.type === 'RPAREN') {
        parenDepth--;
      }

      parts.push(token.value);
      this.advance();
    }

    return parts.join(' ').trim();
  }

  // ============================================================================
  // Value Extraction Helpers
  // ============================================================================

  /**
   * Extract string value from expression
   */
  private extractStringValue(expr: HCLExpression | undefined): string | null {
    if (!expr) return null;
    if (expr.type === 'literal' && typeof expr.value === 'string') {
      return expr.value;
    }
    return null;
  }

  /**
   * Extract boolean value from expression
   */
  private extractBoolValue(expr: HCLExpression | undefined): boolean | null {
    if (!expr) return null;
    if (expr.type === 'literal' && typeof expr.value === 'boolean') {
      return expr.value;
    }
    return null;
  }

  /**
   * Extract number value from expression
   */
  private extractNumberValue(expr: HCLExpression | undefined): number | null {
    if (!expr) return null;
    if (expr.type === 'literal' && typeof expr.value === 'number') {
      return expr.value;
    }
    return null;
  }

  /**
   * Extract string array from expression
   */
  private extractStringArray(expr: HCLExpression | undefined): readonly string[] {
    if (!expr) return [];
    if (expr.type !== 'array') return [];

    return expr.elements
      .filter(el => el.type === 'literal' && typeof el.value === 'string')
      .map(el => (el as { type: 'literal'; value: string }).value);
  }

  /**
   * Create a null expression
   */
  private createNullExpression(): HCLExpression {
    return {
      type: 'literal',
      value: null,
      raw: 'null',
    };
  }

  /**
   * Create an array expression
   */
  private createArrayExpression(elements: HCLExpression[]): HCLExpression {
    return {
      type: 'array',
      elements,
      raw: '[]',
    };
  }

  // ============================================================================
  // Token Helpers
  // ============================================================================

  /**
   * Reset parser state
   */
  private reset(filePath: string): void {
    this.tokens = [];
    this.pos = 0;
    this.filePath = filePath;
    this.errors = [];
  }

  /**
   * Get current token
   */
  private current(): TerragruntToken {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: 0, column: 0, endLine: 0, endColumn: 0 };
  }

  /**
   * Advance to next token
   */
  private advance(): TerragruntToken {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  /**
   * Check current token type
   */
  private check(type: TerragruntTokenType): boolean {
    return this.current().type === type;
  }

  /**
   * Check if at end of tokens
   */
  private isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }

  /**
   * Skip newline tokens
   */
  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  /**
   * Get current location
   */
  private currentLocation(): SourceLocation {
    const token = this.current();
    return {
      file: this.filePath,
      lineStart: token.line,
      lineEnd: token.endLine,
      columnStart: token.column,
      columnEnd: token.endColumn,
    };
  }

  /**
   * Get token location
   */
  private tokenLocation(token: TerragruntToken): SourceLocation {
    return {
      file: this.filePath,
      lineStart: token.line,
      lineEnd: token.endLine,
      columnStart: token.column,
      columnEnd: token.endColumn,
    };
  }

  /**
   * Create block location from start/end tokens
   */
  private createBlockLocation(start: TerragruntToken, end: TerragruntToken): SourceLocation {
    return {
      file: this.filePath,
      lineStart: start.line,
      lineEnd: end.endLine,
      columnStart: start.column,
      columnEnd: end.endColumn,
    };
  }

  /**
   * Recover from parse error by skipping to next block
   */
  private recoverFromError(): void {
    let depth = 0;

    while (!this.isAtEnd()) {
      if (this.check('LBRACE')) {
        depth++;
      } else if (this.check('RBRACE')) {
        if (depth === 0) {
          this.advance();
          break;
        }
        depth--;
      }
      this.advance();
    }
  }

  /**
   * Check if content has Terragrunt markers
   */
  private hasTerragruntMarkers(content: string): boolean {
    const markers = [
      'include',
      'dependency',
      'dependencies',
      'remote_state',
      'terraform',
      'inputs',
      'generate',
      'find_in_parent_folders',
      'get_terragrunt_dir',
      'path_relative_to_include',
    ];

    return markers.some(marker => content.includes(marker));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Terragrunt parser instance
 */
export function createTerragruntParser(
  options?: Partial<TerragruntParserOptions & ParserOptions>
): TerragruntParser {
  return new TerragruntParser(options);
}

/**
 * Parse Terragrunt content directly
 */
export async function parseTerragrunt(
  content: string,
  filePath: string = 'terragrunt.hcl',
  options?: Partial<TerragruntParserOptions & ParserOptions>
): Promise<ParseResult<TerragruntFile>> {
  const parser = createTerragruntParser(options);
  return parser.parse(content, filePath);
}

/**
 * Parse Terragrunt file from disk
 */
export async function parseTerragruntFile(
  filePath: string,
  options?: Partial<TerragruntParserOptions & ParserOptions>
): Promise<ParseResult<TerragruntFile>> {
  const parser = createTerragruntParser(options);
  return parser.parseFile(filePath);
}
