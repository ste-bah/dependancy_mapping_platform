/**
 * Terraform HCL2 Parser
 * TASK-DETECT-001: Parse Terraform files into AST
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  TerraformFile,
  TerraformBlock,
  TerraformBlockType,
  SourceLocation,
  ParseError,
  ParserOptions,
  DEFAULT_PARSER_OPTIONS,
  HCLExpression,
} from './types';
import { ExpressionParser } from './expression-parser';

// ============================================================================
// HCL Lexer Tokens
// ============================================================================

type TokenType =
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'BOOL'
  | 'NULL'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'EQUALS'
  | 'COMMA'
  | 'DOT'
  | 'NEWLINE'
  | 'HEREDOC'
  | 'COMMENT'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// ============================================================================
// HCL Lexer
// ============================================================================

class HCLLexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    tokens.push({ type: 'EOF', value: '', line: this.line, column: this.column });
    return tokens;
  }

  private nextToken(): Token | null {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return null;
    }

    const startLine = this.line;
    const startColumn = this.column;
    const char = this.input[this.pos];

    // Comments
    if (char === '#' || (char === '/' && this.input[this.pos + 1] === '/')) {
      return this.readLineComment(startLine, startColumn);
    }
    if (char === '/' && this.input[this.pos + 1] === '*') {
      return this.readBlockComment(startLine, startColumn);
    }

    // Newlines (significant in HCL)
    if (char === '\n') {
      this.pos++;
      this.line++;
      this.column = 1;
      return { type: 'NEWLINE', value: '\n', line: startLine, column: startColumn };
    }

    // Heredoc
    if (char === '<' && this.input[this.pos + 1] === '<') {
      return this.readHeredoc(startLine, startColumn);
    }

    // String
    if (char === '"') {
      return this.readString(startLine, startColumn);
    }

    // Numbers
    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(this.input[this.pos + 1] || ''))) {
      return this.readNumber(startLine, startColumn);
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      return this.readIdentifier(startLine, startColumn);
    }

    // Single character tokens
    const singleCharTokens: Record<string, TokenType> = {
      '{': 'LBRACE',
      '}': 'RBRACE',
      '[': 'LBRACKET',
      ']': 'RBRACKET',
      '(': 'LPAREN',
      ')': 'RPAREN',
      '=': 'EQUALS',
      ',': 'COMMA',
      '.': 'DOT',
    };

    if (char in singleCharTokens) {
      this.pos++;
      this.column++;
      return { type: singleCharTokens[char], value: char, line: startLine, column: startColumn };
    }

    // Skip unknown characters
    this.pos++;
    this.column++;
    return null;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === ' ' || char === '\t' || char === '\r') {
        this.pos++;
        this.column++;
      } else {
        break;
      }
    }
  }

  private readLineComment(line: number, column: number): Token {
    const start = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.pos++;
      this.column++;
    }
    return { type: 'COMMENT', value: this.input.slice(start, this.pos), line, column };
  }

  private readBlockComment(line: number, column: number): Token {
    const start = this.pos;
    this.pos += 2;
    this.column += 2;

    while (this.pos < this.input.length - 1) {
      if (this.input[this.pos] === '*' && this.input[this.pos + 1] === '/') {
        this.pos += 2;
        this.column += 2;
        break;
      }
      if (this.input[this.pos] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }

    return { type: 'COMMENT', value: this.input.slice(start, this.pos), line, column };
  }

  private readString(line: number, column: number): Token {
    const start = this.pos;
    this.pos++; // Skip opening quote
    this.column++;

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (char === '\\' && this.pos + 1 < this.input.length) {
        this.pos += 2;
        this.column += 2;
        continue;
      }

      if (char === '"') {
        this.pos++;
        this.column++;
        break;
      }

      if (char === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }

    return { type: 'STRING', value: this.input.slice(start, this.pos), line, column };
  }

  private readHeredoc(line: number, column: number): Token {
    const start = this.pos;
    this.pos += 2; // Skip <<
    this.column += 2;

    // Check for indented heredoc
    const indented = this.input[this.pos] === '-';
    if (indented) {
      this.pos++;
      this.column++;
    }

    // Read delimiter
    let delimiter = '';
    while (this.pos < this.input.length && /[A-Z_]/.test(this.input[this.pos])) {
      delimiter += this.input[this.pos];
      this.pos++;
      this.column++;
    }

    // Skip to newline
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.pos++;
      this.column++;
    }
    if (this.input[this.pos] === '\n') {
      this.pos++;
      this.line++;
      this.column = 1;
    }

    // Read until delimiter
    const delimiterPattern = indented
      ? new RegExp(`^\\s*${delimiter}\\s*$`, 'm')
      : new RegExp(`^${delimiter}\\s*$`, 'm');

    while (this.pos < this.input.length) {
      const lineStart = this.pos;
      let lineEnd = this.pos;

      while (lineEnd < this.input.length && this.input[lineEnd] !== '\n') {
        lineEnd++;
      }

      const currentLine = this.input.slice(lineStart, lineEnd);

      if (delimiterPattern.test(currentLine)) {
        this.pos = lineEnd;
        if (this.input[this.pos] === '\n') {
          this.pos++;
          this.line++;
          this.column = 1;
        }
        break;
      }

      this.pos = lineEnd;
      if (this.input[this.pos] === '\n') {
        this.pos++;
        this.line++;
        this.column = 1;
      }
    }

    return { type: 'HEREDOC', value: this.input.slice(start, this.pos), line, column };
  }

  private readNumber(line: number, column: number): Token {
    const start = this.pos;

    if (this.input[this.pos] === '-') {
      this.pos++;
      this.column++;
    }

    while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
      this.pos++;
      this.column++;
    }

    if (this.input[this.pos] === '.' && /[0-9]/.test(this.input[this.pos + 1] || '')) {
      this.pos++;
      this.column++;
      while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
        this.pos++;
        this.column++;
      }
    }

    if (/[eE]/.test(this.input[this.pos] || '')) {
      this.pos++;
      this.column++;
      if (/[+-]/.test(this.input[this.pos] || '')) {
        this.pos++;
        this.column++;
      }
      while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
        this.pos++;
        this.column++;
      }
    }

    return { type: 'NUMBER', value: this.input.slice(start, this.pos), line, column };
  }

  private readIdentifier(line: number, column: number): Token {
    const start = this.pos;

    while (this.pos < this.input.length && /[a-zA-Z0-9_-]/.test(this.input[this.pos])) {
      this.pos++;
      this.column++;
    }

    const value = this.input.slice(start, this.pos);

    if (value === 'true' || value === 'false') {
      return { type: 'BOOL', value, line, column };
    }
    if (value === 'null') {
      return { type: 'NULL', value, line, column };
    }

    return { type: 'IDENTIFIER', value, line, column };
  }
}

// ============================================================================
// HCL Parser
// ============================================================================

export class HCLParser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private filePath: string = '';
  private errors: ParseError[] = [];
  private options: ParserOptions;
  private expressionParser: ExpressionParser;

  constructor(options: Partial<ParserOptions> = {}) {
    this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
    this.expressionParser = new ExpressionParser({ includeRaw: this.options.includeRaw });
  }

  /**
   * Parse a Terraform file from disk
   */
  async parseFile(filePath: string): Promise<TerraformFile> {
    const stats = await fs.promises.stat(filePath);

    if (stats.size > this.options.maxFileSize) {
      return {
        path: filePath,
        blocks: [],
        errors: [{
          message: `File size ${stats.size} exceeds maximum ${this.options.maxFileSize}`,
          location: null,
          severity: 'error',
          code: 'FILE_TOO_LARGE',
        }],
        encoding: this.options.encoding,
        size: stats.size,
      };
    }

    const content = await fs.promises.readFile(filePath, this.options.encoding);
    return this.parse(content, filePath);
  }

  /**
   * Parse HCL content string
   */
  parse(content: string, filePath: string = '<input>'): TerraformFile {
    this.filePath = filePath;
    this.errors = [];
    this.pos = 0;

    try {
      const lexer = new HCLLexer(content);
      this.tokens = lexer.tokenize().filter(t => t.type !== 'COMMENT');
    } catch (err) {
      return {
        path: filePath,
        blocks: [],
        errors: [{
          message: `Lexer error: ${err instanceof Error ? err.message : String(err)}`,
          location: null,
          severity: 'error',
          code: 'LEXER_ERROR',
        }],
        encoding: this.options.encoding,
        size: content.length,
      };
    }

    const blocks: TerraformBlock[] = [];

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      try {
        const block = this.parseBlock();
        if (block) {
          blocks.push(block);
        }
      } catch (err) {
        if (this.options.errorRecovery) {
          this.errors.push({
            message: err instanceof Error ? err.message : String(err),
            location: this.currentLocation(),
            severity: 'error',
            code: 'PARSE_ERROR',
          });
          this.recoverFromError();
        } else {
          throw err;
        }
      }
    }

    return {
      path: filePath,
      blocks,
      errors: this.errors,
      encoding: this.options.encoding,
      size: content.length,
    };
  }

  // ============================================================================
  // Block Parsing
  // ============================================================================

  private parseBlock(): TerraformBlock | null {
    const startToken = this.current();

    if (startToken.type !== 'IDENTIFIER') {
      return null;
    }

    const blockType = startToken.value as TerraformBlockType;
    const validBlockTypes = ['resource', 'data', 'module', 'variable', 'output', 'locals', 'provider', 'terraform', 'moved', 'import'];

    if (!validBlockTypes.includes(blockType)) {
      // This might be an attribute at root level (invalid in proper TF but handle gracefully)
      this.advance();
      if (this.check('EQUALS')) {
        this.advance();
        this.parseExpression();
        return null;
      }
      return null;
    }

    this.advance();
    const labels: string[] = [];

    // Read labels (strings or identifiers before the opening brace)
    while (!this.check('LBRACE') && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check('STRING')) {
        labels.push(this.stripQuotes(this.current().value));
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
        message: `Expected '{' after block labels`,
        location: this.currentLocation(),
        severity: 'error',
      });
      return null;
    }

    const startLine = this.current().line;
    this.advance(); // consume '{'

    const { attributes, nestedBlocks } = this.parseBlockBody();

    const endLine = this.current().line;

    if (this.check('RBRACE')) {
      this.advance();
    }

    return {
      type: blockType,
      labels,
      attributes,
      nestedBlocks,
      location: {
        file: this.filePath,
        lineStart: startToken.line,
        lineEnd: endLine,
        columnStart: startToken.column,
        columnEnd: this.current().column,
      },
      raw: '',
    };
  }

  private parseBlockBody(): { attributes: Record<string, HCLExpression>; nestedBlocks: TerraformBlock[] } {
    const attributes: Record<string, HCLExpression> = {};
    const nestedBlocks: TerraformBlock[] = [];

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
          this.pos--; // Back up to re-read the identifier
          const nestedBlock = this.parseNestedBlock(name);
          if (nestedBlock && this.options.parseNestedBlocks) {
            nestedBlocks.push(nestedBlock);
          }
        }
      } else {
        this.advance();
      }
    }

    return { attributes, nestedBlocks };
  }

  private parseNestedBlock(blockType: string): TerraformBlock | null {
    const startToken = this.current();
    this.advance(); // Skip block type identifier

    const labels: string[] = [];

    while (!this.check('LBRACE') && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check('STRING')) {
        labels.push(this.stripQuotes(this.current().value));
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

    const startLine = this.current().line;
    this.advance();

    const { attributes, nestedBlocks } = this.parseBlockBody();

    const endLine = this.current().line;

    if (this.check('RBRACE')) {
      this.advance();
    }

    return {
      type: blockType as TerraformBlockType,
      labels,
      attributes,
      nestedBlocks,
      location: {
        file: this.filePath,
        lineStart: startToken.line,
        lineEnd: endLine,
        columnStart: startToken.column,
        columnEnd: this.current().column,
      },
      raw: '',
    };
  }

  // ============================================================================
  // Expression Parsing
  // ============================================================================

  private parseExpression(): HCLExpression {
    const exprStr = this.readExpressionString();
    return this.expressionParser.parse(exprStr);
  }

  private readExpressionString(): string {
    const parts: string[] = [];
    let depth = 0;
    let parenDepth = 0;

    while (!this.isAtEnd()) {
      const token = this.current();

      // End of expression markers
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
  // Helper Methods
  // ============================================================================

  private current(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '', line: 0, column: 0 };
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  private stripQuotes(str: string): string {
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    return str;
  }

  private currentLocation(): SourceLocation {
    const token = this.current();
    return {
      file: this.filePath,
      lineStart: token.line,
      lineEnd: token.line,
      columnStart: token.column,
      columnEnd: token.column,
    };
  }

  private recoverFromError(): void {
    // Skip until we find a block boundary or EOF
    while (!this.isAtEnd()) {
      if (this.check('RBRACE')) {
        this.advance();
        break;
      }
      this.advance();
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse all Terraform files in a directory
 */
export async function parseTerraformDirectory(
  dirPath: string,
  options: Partial<ParserOptions> = {}
): Promise<TerraformFile[]> {
  const parser = new HCLParser(options);
  const files: TerraformFile[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and typical non-terraform directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walk(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.tf') || entry.name.endsWith('.tf.json'))) {
        const result = await parser.parseFile(fullPath);
        files.push(result);
      }
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Get all blocks of a specific type from parsed files
 */
export function getBlocksByType(files: TerraformFile[], type: TerraformBlockType): TerraformBlock[] {
  return files.flatMap(file => file.blocks.filter(block => block.type === type));
}

export const hclParser = new HCLParser();
