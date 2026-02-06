/**
 * Terragrunt HCL Lexer
 * @module parsers/terragrunt/tg-lexer
 *
 * TASK-TG-001: Tokenize Terragrunt HCL files
 *
 * Extends the standard HCL lexer with Terragrunt-specific token handling.
 * Supports all HCL2 syntax including heredocs, template strings, and comments.
 */

import { SourceLocation } from '../terraform/types';

// ============================================================================
// Token Types
// ============================================================================

/**
 * Token types for Terragrunt HCL
 */
export type TerragruntTokenType =
  | 'IDENTIFIER'    // Block types, attribute names, function names
  | 'STRING'        // Quoted strings
  | 'NUMBER'        // Integer and float numbers
  | 'BOOL'          // true/false literals
  | 'NULL'          // null literal
  | 'LBRACE'        // {
  | 'RBRACE'        // }
  | 'LBRACKET'      // [
  | 'RBRACKET'      // ]
  | 'LPAREN'        // (
  | 'RPAREN'        // )
  | 'EQUALS'        // =
  | 'COMMA'         // ,
  | 'DOT'           // .
  | 'COLON'         // :
  | 'ARROW'         // =>
  | 'ELLIPSIS'      // ...
  | 'QUESTION'      // ?
  | 'NEWLINE'       // Line break (significant in HCL)
  | 'HEREDOC'       // <<EOF...EOF heredoc strings
  | 'COMMENT'       // # or // or /* */ comments
  | 'INTERPOLATION' // ${ } template interpolation
  | 'DIRECTIVE'     // %{ } template directives
  | 'EOF';          // End of file

/**
 * Token representing a lexical unit
 */
export interface TerragruntToken {
  readonly type: TerragruntTokenType;
  readonly value: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
}

/**
 * Lexer error details
 */
export interface LexerError {
  readonly message: string;
  readonly location: SourceLocation;
  readonly code: 'UNTERMINATED_STRING' | 'UNTERMINATED_HEREDOC' | 'INVALID_CHARACTER' | 'INVALID_NUMBER';
}

/**
 * Lexer result
 */
export interface LexerResult {
  readonly tokens: readonly TerragruntToken[];
  readonly errors: readonly LexerError[];
}

// ============================================================================
// Terragrunt Lexer
// ============================================================================

/**
 * Lexer for Terragrunt HCL syntax.
 * Tokenizes input into a stream of tokens for the parser.
 *
 * @example
 * ```typescript
 * const lexer = new TerragruntLexer(hclContent);
 * const result = lexer.tokenize();
 * if (result.errors.length === 0) {
 *   // Process tokens
 * }
 * ```
 */
export class TerragruntLexer {
  private readonly input: string;
  private readonly filePath: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private readonly errors: LexerError[] = [];

  constructor(input: string, filePath: string = '<input>') {
    this.input = input;
    this.filePath = filePath;
  }

  /**
   * Tokenize the entire input
   */
  tokenize(): LexerResult {
    const tokens: TerragruntToken[] = [];

    while (this.pos < this.input.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    tokens.push(this.createToken('EOF', '', this.line, this.column));

    return {
      tokens,
      errors: this.errors,
    };
  }

  /**
   * Read the next token from input
   */
  private nextToken(): TerragruntToken | null {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return null;
    }

    const startLine = this.line;
    const startColumn = this.column;
    const char = this.current();

    // Comments
    if (char === '#' || (char === '/' && this.peek() === '/')) {
      return this.readLineComment(startLine, startColumn);
    }
    if (char === '/' && this.peek() === '*') {
      return this.readBlockComment(startLine, startColumn);
    }

    // Newlines (significant in HCL)
    if (char === '\n') {
      this.advance();
      this.line++;
      this.column = 1;
      return this.createToken('NEWLINE', '\n', startLine, startColumn);
    }

    // Skip carriage return
    if (char === '\r') {
      this.advance();
      return null;
    }

    // Heredoc
    if (char === '<' && this.peek() === '<') {
      return this.readHeredoc(startLine, startColumn);
    }

    // Strings
    if (char === '"') {
      return this.readString(startLine, startColumn);
    }

    // Numbers
    if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek() ?? ''))) {
      return this.readNumber(startLine, startColumn);
    }

    // Identifiers and keywords
    if (this.isIdentifierStart(char)) {
      return this.readIdentifier(startLine, startColumn);
    }

    // Multi-character operators
    if (char === '=' && this.peek() === '>') {
      this.advance();
      this.advance();
      return this.createToken('ARROW', '=>', startLine, startColumn);
    }

    if (char === '.' && this.peek() === '.' && this.input[this.pos + 2] === '.') {
      this.advance();
      this.advance();
      this.advance();
      return this.createToken('ELLIPSIS', '...', startLine, startColumn);
    }

    // Template interpolation start
    if (char === '$' && this.peek() === '{') {
      this.advance();
      this.advance();
      return this.createToken('INTERPOLATION', '${', startLine, startColumn);
    }

    // Template directive start
    if (char === '%' && this.peek() === '{') {
      this.advance();
      this.advance();
      return this.createToken('DIRECTIVE', '%{', startLine, startColumn);
    }

    // Single character tokens
    const singleCharTokens: Record<string, TerragruntTokenType> = {
      '{': 'LBRACE',
      '}': 'RBRACE',
      '[': 'LBRACKET',
      ']': 'RBRACKET',
      '(': 'LPAREN',
      ')': 'RPAREN',
      '=': 'EQUALS',
      ',': 'COMMA',
      '.': 'DOT',
      ':': 'COLON',
      '?': 'QUESTION',
    };

    if (char in singleCharTokens) {
      this.advance();
      return this.createToken(singleCharTokens[char], char, startLine, startColumn);
    }

    // Unknown character - skip and record error
    this.errors.push({
      message: `Invalid character: '${char}'`,
      location: this.createLocation(startLine, startColumn),
      code: 'INVALID_CHARACTER',
    });
    this.advance();
    return null;
  }

  // ============================================================================
  // Token Reading Methods
  // ============================================================================

  /**
   * Read a line comment (# or //)
   */
  private readLineComment(line: number, column: number): TerragruntToken {
    const start = this.pos;
    while (this.pos < this.input.length && this.current() !== '\n') {
      this.advance();
    }
    return this.createToken('COMMENT', this.input.slice(start, this.pos), line, column);
  }

  /**
   * Read a block comment
   */
  private readBlockComment(line: number, column: number): TerragruntToken {
    const start = this.pos;
    this.advance(); // Skip /
    this.advance(); // Skip *

    while (this.pos < this.input.length - 1) {
      if (this.current() === '*' && this.peek() === '/') {
        this.advance();
        this.advance();
        break;
      }
      if (this.current() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }

    return this.createToken('COMMENT', this.input.slice(start, this.pos), line, column);
  }

  /**
   * Read a quoted string, handling escapes and interpolations
   */
  private readString(line: number, column: number): TerragruntToken {
    const start = this.pos;
    this.advance(); // Skip opening quote

    while (this.pos < this.input.length) {
      const char = this.current();

      // Handle escape sequences
      if (char === '\\' && this.pos + 1 < this.input.length) {
        this.advance();
        this.advance();
        continue;
      }

      // End of string
      if (char === '"') {
        this.advance();
        break;
      }

      // Track newlines in multi-line strings
      if (char === '\n') {
        this.line++;
        this.column = 0;
      }

      this.advance();
    }

    // Check for unterminated string
    if (this.input[this.pos - 1] !== '"') {
      this.errors.push({
        message: 'Unterminated string literal',
        location: this.createLocation(line, column),
        code: 'UNTERMINATED_STRING',
      });
    }

    return this.createToken('STRING', this.input.slice(start, this.pos), line, column);
  }

  /**
   * Read a heredoc string
   */
  private readHeredoc(line: number, column: number): TerragruntToken {
    const start = this.pos;
    this.advance(); // Skip <
    this.advance(); // Skip <

    // Check for indented heredoc
    const indented = this.current() === '-';
    if (indented) {
      this.advance();
    }

    // Read delimiter
    let delimiter = '';
    while (this.pos < this.input.length && /[A-Z_0-9]/i.test(this.current())) {
      delimiter += this.current();
      this.advance();
    }

    if (!delimiter) {
      this.errors.push({
        message: 'Heredoc missing delimiter',
        location: this.createLocation(line, column),
        code: 'UNTERMINATED_HEREDOC',
      });
      return this.createToken('HEREDOC', this.input.slice(start, this.pos), line, column);
    }

    // Skip to newline
    while (this.pos < this.input.length && this.current() !== '\n') {
      this.advance();
    }
    if (this.current() === '\n') {
      this.advance();
      this.line++;
      this.column = 1;
    }

    // Read content until delimiter
    const delimiterPattern = indented
      ? new RegExp(`^\\s*${delimiter}\\s*$`, 'm')
      : new RegExp(`^${delimiter}\\s*$`, 'm');

    let found = false;
    while (this.pos < this.input.length) {
      const lineStart = this.pos;
      let lineEnd = this.pos;

      // Find end of current line
      while (lineEnd < this.input.length && this.input[lineEnd] !== '\n') {
        lineEnd++;
      }

      const currentLine = this.input.slice(lineStart, lineEnd);

      if (delimiterPattern.test(currentLine)) {
        this.pos = lineEnd;
        found = true;
        if (this.input[this.pos] === '\n') {
          this.advance();
          this.line++;
          this.column = 1;
        }
        break;
      }

      this.pos = lineEnd;
      if (this.input[this.pos] === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      }
    }

    if (!found) {
      this.errors.push({
        message: `Unterminated heredoc: expected '${delimiter}'`,
        location: this.createLocation(line, column),
        code: 'UNTERMINATED_HEREDOC',
      });
    }

    return this.createToken('HEREDOC', this.input.slice(start, this.pos), line, column);
  }

  /**
   * Read a number (integer or float)
   */
  private readNumber(line: number, column: number): TerragruntToken {
    const start = this.pos;

    // Handle negative sign
    if (this.current() === '-') {
      this.advance();
    }

    // Read integer part
    while (this.pos < this.input.length && this.isDigit(this.current())) {
      this.advance();
    }

    // Read decimal part
    if (this.current() === '.' && this.isDigit(this.peek() ?? '')) {
      this.advance();
      while (this.pos < this.input.length && this.isDigit(this.current())) {
        this.advance();
      }
    }

    // Read exponent
    if (/[eE]/.test(this.current())) {
      this.advance();
      if (/[+-]/.test(this.current())) {
        this.advance();
      }
      if (!this.isDigit(this.current())) {
        this.errors.push({
          message: 'Invalid number: expected exponent digits',
          location: this.createLocation(line, column),
          code: 'INVALID_NUMBER',
        });
      }
      while (this.pos < this.input.length && this.isDigit(this.current())) {
        this.advance();
      }
    }

    return this.createToken('NUMBER', this.input.slice(start, this.pos), line, column);
  }

  /**
   * Read an identifier or keyword
   */
  private readIdentifier(line: number, column: number): TerragruntToken {
    const start = this.pos;

    while (this.pos < this.input.length && this.isIdentifierChar(this.current())) {
      this.advance();
    }

    const value = this.input.slice(start, this.pos);

    // Check for boolean literals
    if (value === 'true' || value === 'false') {
      return this.createToken('BOOL', value, line, column);
    }

    // Check for null literal
    if (value === 'null') {
      return this.createToken('NULL', value, line, column);
    }

    return this.createToken('IDENTIFIER', value, line, column);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Skip whitespace (but not newlines)
   */
  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.current();
      if (char === ' ' || char === '\t') {
        this.advance();
      } else {
        break;
      }
    }
  }

  /**
   * Get current character
   */
  private current(): string {
    return this.input[this.pos];
  }

  /**
   * Peek at next character
   */
  private peek(): string | undefined {
    return this.input[this.pos + 1];
  }

  /**
   * Advance position
   */
  private advance(): void {
    this.pos++;
    this.column++;
  }

  /**
   * Check if character is a digit
   */
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Check if character can start an identifier
   */
  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  /**
   * Check if character can be part of an identifier
   */
  private isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9_-]/.test(char);
  }

  /**
   * Create a token
   */
  private createToken(
    type: TerragruntTokenType,
    value: string,
    line: number,
    column: number
  ): TerragruntToken {
    const lines = value.split('\n');
    const endLine = line + lines.length - 1;
    const endColumn = lines.length > 1 ? lines[lines.length - 1].length + 1 : column + value.length;

    return {
      type,
      value,
      line,
      column,
      endLine,
      endColumn,
    };
  }

  /**
   * Create a source location
   */
  private createLocation(line: number, column: number): SourceLocation {
    return {
      file: this.filePath,
      lineStart: line,
      lineEnd: line,
      columnStart: column,
      columnEnd: column,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Filter out comment and newline tokens for parsing
 */
export function filterTokensForParsing(tokens: readonly TerragruntToken[]): TerragruntToken[] {
  return tokens.filter(t => t.type !== 'COMMENT');
}

/**
 * Extract string content from a STRING token (removes quotes and unescapes)
 */
export function extractStringContent(token: TerragruntToken): string {
  if (token.type !== 'STRING') {
    return token.value;
  }

  const content = token.value.slice(1, -1);
  // Use placeholder for escaped backslashes first to avoid interference with other escapes
  return content
    .replace(/\\\\/g, '\x00')  // Placeholder for literal backslash
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\x00/g, '\\');   // Restore literal backslashes
}

/**
 * Extract heredoc content
 */
export function extractHeredocContent(token: TerragruntToken): string {
  if (token.type !== 'HEREDOC') {
    return token.value;
  }

  const match = token.value.match(/^<<-?([A-Z_0-9]+)\n([\s\S]*?)\n\s*\1\s*$/i);
  if (match) {
    return match[2];
  }
  return token.value;
}
