/**
 * Terragrunt Lexer Unit Tests
 * @module tests/parsers/terragrunt/tg-lexer.test
 *
 * Tests for HCL tokenization including all token types, heredocs,
 * template strings, and error handling.
 * Target: 80%+ coverage for tg-lexer.ts
 */

import { describe, it, expect } from 'vitest';
import {
  TerragruntLexer,
  filterTokensForParsing,
  extractStringContent,
  extractHeredocContent,
  type TerragruntToken,
  type TerragruntTokenType,
} from '../../../src/parsers/terragrunt/tg-lexer';

// ============================================================================
// Basic Tokenization Tests
// ============================================================================

describe('TerragruntLexer', () => {
  describe('basic tokenization', () => {
    it('should tokenize empty input', () => {
      const lexer = new TerragruntLexer('');
      const result = lexer.tokenize();

      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].type).toBe('EOF');
      expect(result.errors).toHaveLength(0);
    });

    it('should tokenize identifiers', () => {
      const lexer = new TerragruntLexer('terraform include locals');
      const result = lexer.tokenize();

      const identifiers = result.tokens.filter(t => t.type === 'IDENTIFIER');
      expect(identifiers).toHaveLength(3);
      expect(identifiers.map(t => t.value)).toEqual(['terraform', 'include', 'locals']);
    });

    it('should tokenize identifiers with underscores and hyphens', () => {
      const lexer = new TerragruntLexer('remote_state my-module var_123');
      const result = lexer.tokenize();

      const identifiers = result.tokens.filter(t => t.type === 'IDENTIFIER');
      expect(identifiers).toHaveLength(3);
      expect(identifiers.map(t => t.value)).toEqual(['remote_state', 'my-module', 'var_123']);
    });
  });

  describe('string tokenization', () => {
    it('should tokenize simple strings', () => {
      const lexer = new TerragruntLexer('"hello world"');
      const result = lexer.tokenize();

      const strings = result.tokens.filter(t => t.type === 'STRING');
      expect(strings).toHaveLength(1);
      expect(strings[0].value).toBe('"hello world"');
    });

    it('should tokenize strings with escape sequences', () => {
      const lexer = new TerragruntLexer('"hello\\nworld\\t\\"quoted\\""');
      const result = lexer.tokenize();

      const strings = result.tokens.filter(t => t.type === 'STRING');
      expect(strings).toHaveLength(1);
      expect(strings[0].value).toContain('\\n');
    });

    it('should handle multi-line strings', () => {
      const lexer = new TerragruntLexer('"line1\nline2\nline3"');
      const result = lexer.tokenize();

      const strings = result.tokens.filter(t => t.type === 'STRING');
      expect(strings).toHaveLength(1);
      expect(strings[0].endLine).toBeGreaterThan(strings[0].line);
    });

    it('should report error for unterminated strings', () => {
      const lexer = new TerragruntLexer('"unterminated');
      const result = lexer.tokenize();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('UNTERMINATED_STRING');
    });
  });

  describe('number tokenization', () => {
    it('should tokenize integers', () => {
      const lexer = new TerragruntLexer('42 0 123456');
      const result = lexer.tokenize();

      const numbers = result.tokens.filter(t => t.type === 'NUMBER');
      expect(numbers).toHaveLength(3);
      expect(numbers.map(t => t.value)).toEqual(['42', '0', '123456']);
    });

    it('should tokenize negative numbers', () => {
      const lexer = new TerragruntLexer('-42 -0 -123');
      const result = lexer.tokenize();

      const numbers = result.tokens.filter(t => t.type === 'NUMBER');
      expect(numbers).toHaveLength(3);
      expect(numbers.map(t => t.value)).toEqual(['-42', '-0', '-123']);
    });

    it('should tokenize floating point numbers', () => {
      const lexer = new TerragruntLexer('3.14 0.5 123.456');
      const result = lexer.tokenize();

      const numbers = result.tokens.filter(t => t.type === 'NUMBER');
      expect(numbers).toHaveLength(3);
      expect(numbers.map(t => t.value)).toEqual(['3.14', '0.5', '123.456']);
    });

    it('should tokenize numbers with exponents', () => {
      const lexer = new TerragruntLexer('1e10 2.5E-3 3e+2');
      const result = lexer.tokenize();

      const numbers = result.tokens.filter(t => t.type === 'NUMBER');
      expect(numbers).toHaveLength(3);
    });

    it('should report error for invalid exponents', () => {
      const lexer = new TerragruntLexer('1e');
      const result = lexer.tokenize();

      expect(result.errors.some(e => e.code === 'INVALID_NUMBER')).toBe(true);
    });
  });

  describe('boolean and null tokenization', () => {
    it('should tokenize true', () => {
      const lexer = new TerragruntLexer('true');
      const result = lexer.tokenize();

      const bools = result.tokens.filter(t => t.type === 'BOOL');
      expect(bools).toHaveLength(1);
      expect(bools[0].value).toBe('true');
    });

    it('should tokenize false', () => {
      const lexer = new TerragruntLexer('false');
      const result = lexer.tokenize();

      const bools = result.tokens.filter(t => t.type === 'BOOL');
      expect(bools).toHaveLength(1);
      expect(bools[0].value).toBe('false');
    });

    it('should tokenize null', () => {
      const lexer = new TerragruntLexer('null');
      const result = lexer.tokenize();

      const nulls = result.tokens.filter(t => t.type === 'NULL');
      expect(nulls).toHaveLength(1);
      expect(nulls[0].value).toBe('null');
    });
  });

  describe('operator and punctuation tokenization', () => {
    it('should tokenize braces', () => {
      const lexer = new TerragruntLexer('{}');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'LBRACE')).toBe(true);
      expect(result.tokens.some(t => t.type === 'RBRACE')).toBe(true);
    });

    it('should tokenize brackets', () => {
      const lexer = new TerragruntLexer('[]');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'LBRACKET')).toBe(true);
      expect(result.tokens.some(t => t.type === 'RBRACKET')).toBe(true);
    });

    it('should tokenize parentheses', () => {
      const lexer = new TerragruntLexer('()');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'LPAREN')).toBe(true);
      expect(result.tokens.some(t => t.type === 'RPAREN')).toBe(true);
    });

    it('should tokenize equals sign', () => {
      const lexer = new TerragruntLexer('=');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'EQUALS')).toBe(true);
    });

    it('should tokenize arrow operator', () => {
      const lexer = new TerragruntLexer('=>');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'ARROW')).toBe(true);
    });

    it('should tokenize ellipsis', () => {
      const lexer = new TerragruntLexer('...');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'ELLIPSIS')).toBe(true);
    });

    it('should tokenize comma', () => {
      const lexer = new TerragruntLexer(',');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'COMMA')).toBe(true);
    });

    it('should tokenize dot', () => {
      const lexer = new TerragruntLexer('.');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'DOT')).toBe(true);
    });

    it('should tokenize colon', () => {
      const lexer = new TerragruntLexer(':');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'COLON')).toBe(true);
    });

    it('should tokenize question mark', () => {
      const lexer = new TerragruntLexer('?');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'QUESTION')).toBe(true);
    });
  });

  describe('template syntax tokenization', () => {
    it('should tokenize interpolation start', () => {
      const lexer = new TerragruntLexer('${');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'INTERPOLATION')).toBe(true);
    });

    it('should tokenize directive start', () => {
      const lexer = new TerragruntLexer('%{');
      const result = lexer.tokenize();

      expect(result.tokens.some(t => t.type === 'DIRECTIVE')).toBe(true);
    });
  });

  describe('comment tokenization', () => {
    it('should tokenize hash comments', () => {
      const lexer = new TerragruntLexer('# this is a comment\nidentifier');
      const result = lexer.tokenize();

      const comments = result.tokens.filter(t => t.type === 'COMMENT');
      expect(comments).toHaveLength(1);
      expect(comments[0].value).toBe('# this is a comment');
    });

    it('should tokenize double-slash comments', () => {
      const lexer = new TerragruntLexer('// this is also a comment\nidentifier');
      const result = lexer.tokenize();

      const comments = result.tokens.filter(t => t.type === 'COMMENT');
      expect(comments).toHaveLength(1);
      expect(comments[0].value).toBe('// this is also a comment');
    });

    it('should tokenize block comments', () => {
      const lexer = new TerragruntLexer('/* multi\nline\ncomment */');
      const result = lexer.tokenize();

      const comments = result.tokens.filter(t => t.type === 'COMMENT');
      expect(comments).toHaveLength(1);
      expect(comments[0].value).toContain('multi');
    });
  });

  describe('heredoc tokenization', () => {
    it('should tokenize simple heredoc', () => {
      const content = `<<EOF
content line 1
content line 2
EOF`;
      const lexer = new TerragruntLexer(content);
      const result = lexer.tokenize();

      const heredocs = result.tokens.filter(t => t.type === 'HEREDOC');
      expect(heredocs).toHaveLength(1);
    });

    it('should tokenize indented heredoc', () => {
      const content = `<<-EOF
  content line 1
  content line 2
  EOF`;
      const lexer = new TerragruntLexer(content);
      const result = lexer.tokenize();

      const heredocs = result.tokens.filter(t => t.type === 'HEREDOC');
      expect(heredocs).toHaveLength(1);
    });

    it('should report error for unterminated heredoc', () => {
      const content = `<<EOF
content without terminator`;
      const lexer = new TerragruntLexer(content);
      const result = lexer.tokenize();

      expect(result.errors.some(e => e.code === 'UNTERMINATED_HEREDOC')).toBe(true);
    });

    it('should report error for heredoc without delimiter', () => {
      const content = `<<\ncontent`;
      const lexer = new TerragruntLexer(content);
      const result = lexer.tokenize();

      expect(result.errors.some(e => e.code === 'UNTERMINATED_HEREDOC')).toBe(true);
    });
  });

  describe('newline handling', () => {
    it('should tokenize newlines', () => {
      const lexer = new TerragruntLexer('a\nb\nc');
      const result = lexer.tokenize();

      const newlines = result.tokens.filter(t => t.type === 'NEWLINE');
      expect(newlines).toHaveLength(2);
    });

    it('should skip carriage returns', () => {
      const lexer = new TerragruntLexer('a\r\nb');
      const result = lexer.tokenize();

      // Should have one newline, not carriage return
      const newlines = result.tokens.filter(t => t.type === 'NEWLINE');
      expect(newlines).toHaveLength(1);
    });
  });

  describe('whitespace handling', () => {
    it('should skip spaces and tabs', () => {
      const lexer = new TerragruntLexer('a   b\t\tc');
      const result = lexer.tokenize();

      const identifiers = result.tokens.filter(t => t.type === 'IDENTIFIER');
      expect(identifiers).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should report error for invalid characters', () => {
      const lexer = new TerragruntLexer('@invalid');
      const result = lexer.tokenize();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_CHARACTER');
    });

    it('should continue after invalid character', () => {
      const lexer = new TerragruntLexer('@valid');
      const result = lexer.tokenize();

      const identifiers = result.tokens.filter(t => t.type === 'IDENTIFIER');
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].value).toBe('valid');
    });
  });

  describe('line and column tracking', () => {
    it('should track line numbers correctly', () => {
      const lexer = new TerragruntLexer('a\nb\nc');
      const result = lexer.tokenize();

      const identifiers = result.tokens.filter(t => t.type === 'IDENTIFIER');
      expect(identifiers[0].line).toBe(1);
      expect(identifiers[1].line).toBe(2);
      expect(identifiers[2].line).toBe(3);
    });

    it('should track column numbers correctly', () => {
      const lexer = new TerragruntLexer('abc def ghi');
      const result = lexer.tokenize();

      const identifiers = result.tokens.filter(t => t.type === 'IDENTIFIER');
      expect(identifiers[0].column).toBe(1);
      expect(identifiers[1].column).toBe(5);
      expect(identifiers[2].column).toBe(9);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Lexer Utility Functions', () => {
  describe('filterTokensForParsing', () => {
    it('should remove comment tokens', () => {
      const tokens: TerragruntToken[] = [
        { type: 'IDENTIFIER', value: 'test', line: 1, column: 1, endLine: 1, endColumn: 5 },
        { type: 'COMMENT', value: '# comment', line: 1, column: 6, endLine: 1, endColumn: 15 },
        { type: 'EQUALS', value: '=', line: 1, column: 16, endLine: 1, endColumn: 17 },
      ];

      const filtered = filterTokensForParsing(tokens);
      expect(filtered).toHaveLength(2);
      expect(filtered.some(t => t.type === 'COMMENT')).toBe(false);
    });

    it('should preserve all other tokens', () => {
      const tokens: TerragruntToken[] = [
        { type: 'IDENTIFIER', value: 'test', line: 1, column: 1, endLine: 1, endColumn: 5 },
        { type: 'NEWLINE', value: '\n', line: 1, column: 5, endLine: 1, endColumn: 6 },
        { type: 'STRING', value: '"value"', line: 2, column: 1, endLine: 2, endColumn: 8 },
      ];

      const filtered = filterTokensForParsing(tokens);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('extractStringContent', () => {
    it('should extract content from quoted string', () => {
      const token: TerragruntToken = {
        type: 'STRING',
        value: '"hello world"',
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 14,
      };

      expect(extractStringContent(token)).toBe('hello world');
    });

    it('should unescape escape sequences', () => {
      const token: TerragruntToken = {
        type: 'STRING',
        value: '"hello\\nworld\\t\\"test\\""',
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 25,
      };

      const content = extractStringContent(token);
      expect(content).toBe('hello\nworld\t"test"');
    });

    it('should unescape backslash', () => {
      const token: TerragruntToken = {
        type: 'STRING',
        value: '"path\\\\to\\\\file"',
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 18,
      };

      const content = extractStringContent(token);
      expect(content).toBe('path\\to\\file');
    });

    it('should return value unchanged for non-string tokens', () => {
      const token: TerragruntToken = {
        type: 'IDENTIFIER',
        value: 'test',
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 5,
      };

      expect(extractStringContent(token)).toBe('test');
    });
  });

  describe('extractHeredocContent', () => {
    it('should extract content from heredoc', () => {
      const token: TerragruntToken = {
        type: 'HEREDOC',
        value: '<<EOF\ncontent line 1\ncontent line 2\nEOF',
        line: 1,
        column: 1,
        endLine: 4,
        endColumn: 4,
      };

      const content = extractHeredocContent(token);
      expect(content).toBe('content line 1\ncontent line 2');
    });

    it('should handle indented heredoc', () => {
      const token: TerragruntToken = {
        type: 'HEREDOC',
        value: '<<-EOF\n  content\n  EOF',
        line: 1,
        column: 1,
        endLine: 3,
        endColumn: 6,
      };

      const content = extractHeredocContent(token);
      expect(content).toContain('content');
    });

    it('should return value unchanged for non-heredoc tokens', () => {
      const token: TerragruntToken = {
        type: 'STRING',
        value: '"test"',
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 7,
      };

      expect(extractHeredocContent(token)).toBe('"test"');
    });

    it('should return raw value if pattern does not match', () => {
      const token: TerragruntToken = {
        type: 'HEREDOC',
        value: '<<EOF\nunterminated',
        line: 1,
        column: 1,
        endLine: 2,
        endColumn: 12,
      };

      expect(extractHeredocContent(token)).toBe('<<EOF\nunterminated');
    });
  });
});

// ============================================================================
// Complex Input Tests
// ============================================================================

describe('Complex Input Tokenization', () => {
  it('should tokenize a complete terragrunt block', () => {
    const content = `
terraform {
  source = "git::https://example.com/module.git"
}
`;
    const lexer = new TerragruntLexer(content);
    const result = lexer.tokenize();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'terraform')).toBe(true);
    expect(result.tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'source')).toBe(true);
    expect(result.tokens.some(t => t.type === 'STRING')).toBe(true);
    expect(result.tokens.some(t => t.type === 'LBRACE')).toBe(true);
    expect(result.tokens.some(t => t.type === 'RBRACE')).toBe(true);
  });

  it('should tokenize include with function call', () => {
    const content = `
include "root" {
  path = find_in_parent_folders()
}
`;
    const lexer = new TerragruntLexer(content);
    const result = lexer.tokenize();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'include')).toBe(true);
    expect(result.tokens.some(t => t.type === 'STRING' && t.value === '"root"')).toBe(true);
    expect(result.tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'find_in_parent_folders')).toBe(true);
    expect(result.tokens.some(t => t.type === 'LPAREN')).toBe(true);
    expect(result.tokens.some(t => t.type === 'RPAREN')).toBe(true);
  });

  it('should tokenize inputs with object values', () => {
    const content = `
inputs = {
  region = "us-east-1"
  count  = 3
  tags   = {
    env = "prod"
  }
}
`;
    const lexer = new TerragruntLexer(content);
    const result = lexer.tokenize();

    expect(result.errors).toHaveLength(0);
    const lbraces = result.tokens.filter(t => t.type === 'LBRACE');
    const rbraces = result.tokens.filter(t => t.type === 'RBRACE');
    expect(lbraces.length).toBe(rbraces.length);
  });

  it('should tokenize template with interpolation', () => {
    const content = `"prefix-\${var.name}-suffix"`;
    const lexer = new TerragruntLexer(content);
    const result = lexer.tokenize();

    // The string contains interpolation markers
    expect(result.tokens.some(t => t.type === 'STRING')).toBe(true);
  });

  it('should tokenize conditional expression', () => {
    const content = `value = var.enabled ? "yes" : "no"`;
    const lexer = new TerragruntLexer(content);
    const result = lexer.tokenize();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.some(t => t.type === 'QUESTION')).toBe(true);
    expect(result.tokens.some(t => t.type === 'COLON')).toBe(true);
  });

  it('should tokenize for expression', () => {
    const content = `[for item in var.list : item.name]`;
    const lexer = new TerragruntLexer(content);
    const result = lexer.tokenize();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'for')).toBe(true);
    expect(result.tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'in')).toBe(true);
    expect(result.tokens.some(t => t.type === 'COLON')).toBe(true);
  });

  it('should handle file path with comments', () => {
    const content = `
# Comment before
terraform {
  # Comment inside
  source = "module"  # Comment after
}
# Comment after
`;
    const lexer = new TerragruntLexer(content);
    const result = lexer.tokenize();

    expect(result.errors).toHaveLength(0);
    const comments = result.tokens.filter(t => t.type === 'COMMENT');
    expect(comments.length).toBe(4);
  });
});
