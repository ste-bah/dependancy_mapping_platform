/**
 * HCL Expression Parser
 * TASK-DETECT-001: Parse HCL2 expressions including references, functions, templates
 *
 * Performance optimizations:
 * - LRU cache for parsed expressions (10,000 entries)
 * - Lazy regex compilation
 * - Optimized string operations
 */

import {
  HCLExpression,
  HCLLiteralExpression,
  HCLReferenceExpression,
  HCLFunctionExpression,
  HCLTemplateExpression,
  HCLForExpression,
  HCLConditionalExpression,
  HCLIndexExpression,
  HCLSplatExpression,
  HCLObjectExpression,
  HCLArrayExpression,
} from './types';

// Performance optimization: Import caching utilities
import { getExpressionCache } from '../../optimization/cache.js';

// ============================================================================
// Expression Parsing Patterns
// ============================================================================

const PATTERNS = {
  // Reference patterns: var.name, local.x, aws_instance.web.id, data.aws_ami.ubuntu.id
  reference: /^([a-zA-Z_][a-zA-Z0-9_-]*)(?:\.([a-zA-Z_][a-zA-Z0-9_.-]*))*$/,

  // Function call: func(args)
  functionCall: /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*)\)$/,

  // Template string: "...${expr}..."
  templateString: /\$\{([^}]+)\}/g,

  // For expression: [for k, v in collection : value if condition]
  forExpr: /^\[\s*for\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([\s\S]+?)\s*:\s*([\s\S]+?)(?:\s+if\s+([\s\S]+?))?\s*\]$/,

  // Object for: {for k, v in collection : key => value if condition}
  forObjExpr: /^\{\s*for\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([\s\S]+?)\s*:\s*([\s\S]+?)\s*=>\s*([\s\S]+?)(?:\s+if\s+([\s\S]+?))?\s*\}$/,

  // Conditional: condition ? true : false
  conditional: /^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/,

  // Index access: expr[key]
  indexAccess: /^(.+)\[([^\]]+)\]$/,

  // Splat: expr[*].attr
  splatAccess: /^(.+)\[\*\](.*)$/,

  // Numeric literal
  number: /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/,

  // Boolean literal
  boolean: /^(true|false)$/,

  // Null literal
  nullLiteral: /^null$/,

  // String (quoted)
  quotedString: /^"([^"\\]|\\.)*"$|^'([^'\\]|\\.)*'$/,

  // Heredoc
  heredoc: /^<<-?([A-Z_]+)\n([\s\S]*?)\n\1$/,
};

// ============================================================================
// Expression Parser Class
// ============================================================================

export class ExpressionParser {
  private includeRaw: boolean;
  private useCache: boolean;

  constructor(options: { includeRaw?: boolean; useCache?: boolean } = {}) {
    this.includeRaw = options.includeRaw ?? true;
    this.useCache = options.useCache ?? true;
  }

  /**
   * Parse an HCL expression string into an AST node
   * Performance: Uses LRU cache to avoid re-parsing identical expressions
   */
  parse(input: string): HCLExpression {
    const trimmed = input.trim();

    if (!trimmed) {
      return this.literal(null, input);
    }

    // Performance optimization: Check cache first
    if (this.useCache) {
      const cache = getExpressionCache();
      return cache.getOrCompute(trimmed, () => this.parseUncached(trimmed));
    }

    return this.parseUncached(trimmed);
  }

  /**
   * Parse without caching (internal use)
   */
  private parseUncached(trimmed: string): HCLExpression {
    // Try each expression type in order of precedence
    return (
      this.tryParseNull(trimmed) ??
      this.tryParseBoolean(trimmed) ??
      this.tryParseNumber(trimmed) ??
      this.tryParseString(trimmed) ??
      this.tryParseHeredoc(trimmed) ??
      this.tryParseArray(trimmed) ??
      this.tryParseObject(trimmed) ??
      this.tryParseFor(trimmed) ??
      this.tryParseConditional(trimmed) ??
      this.tryParseSplat(trimmed) ??
      this.tryParseIndex(trimmed) ??
      this.tryParseFunction(trimmed) ??
      this.tryParseTemplate(trimmed) ??
      this.tryParseReference(trimmed) ??
      this.literal(trimmed, trimmed) // Fallback to literal
    );
  }

  // ============================================================================
  // Literal Parsers
  // ============================================================================

  private tryParseNull(input: string): HCLLiteralExpression | null {
    if (PATTERNS.nullLiteral.test(input)) {
      return this.literal(null, input);
    }
    return null;
  }

  private tryParseBoolean(input: string): HCLLiteralExpression | null {
    if (PATTERNS.boolean.test(input)) {
      return this.literal(input === 'true', input);
    }
    return null;
  }

  private tryParseNumber(input: string): HCLLiteralExpression | null {
    if (PATTERNS.number.test(input)) {
      return this.literal(parseFloat(input), input);
    }
    return null;
  }

  private tryParseString(input: string): HCLExpression | null {
    if (PATTERNS.quotedString.test(input)) {
      const content = input.slice(1, -1);

      // Check for template interpolations
      if (content.includes('${')) {
        return this.parseTemplateString(content, input);
      }

      // Unescape the string
      const unescaped = this.unescapeString(content);
      return this.literal(unescaped, input);
    }
    return null;
  }

  private tryParseHeredoc(input: string): HCLLiteralExpression | null {
    const match = input.match(PATTERNS.heredoc);
    if (match) {
      return this.literal(match[2], input);
    }
    return null;
  }

  // ============================================================================
  // Collection Parsers
  // ============================================================================

  private tryParseArray(input: string): HCLArrayExpression | null {
    if (!input.startsWith('[') || !input.endsWith(']')) {
      return null;
    }

    // Check for for expression first
    if (input.match(/^\[\s*for\s+/)) {
      return null; // Let tryParseFor handle it
    }

    const content = input.slice(1, -1).trim();
    if (!content) {
      return {
        type: 'array',
        elements: [],
        raw: this.includeRaw ? input : '',
      };
    }

    const elements = this.splitByComma(content).map(el => this.parse(el.trim()));
    return {
      type: 'array',
      elements,
      raw: this.includeRaw ? input : '',
    };
  }

  private tryParseObject(input: string): HCLObjectExpression | null {
    if (!input.startsWith('{') || !input.endsWith('}')) {
      return null;
    }

    // Check for for expression first
    if (input.match(/^\{\s*for\s+/)) {
      return null; // Let tryParseFor handle it
    }

    const content = input.slice(1, -1).trim();
    if (!content) {
      return {
        type: 'object',
        attributes: {},
        raw: this.includeRaw ? input : '',
      };
    }

    const attributes: Record<string, HCLExpression> = {};
    const pairs = this.splitObjectPairs(content);

    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.slice(0, eqIndex).trim().replace(/^["']|["']$/g, '');
        const value = pair.slice(eqIndex + 1).trim();
        attributes[key] = this.parse(value);
      }
    }

    return {
      type: 'object',
      attributes,
      raw: this.includeRaw ? input : '',
    };
  }

  // ============================================================================
  // Complex Expression Parsers
  // ============================================================================

  private tryParseFor(input: string): HCLForExpression | null {
    // Array for expression
    const arrayMatch = input.match(PATTERNS.forExpr);
    if (arrayMatch) {
      return {
        type: 'for',
        keyVar: arrayMatch[1] || null,
        valueVar: arrayMatch[2],
        collection: this.parse(arrayMatch[3]),
        valueExpr: this.parse(arrayMatch[4]),
        keyExpr: null,
        condition: arrayMatch[5] ? this.parse(arrayMatch[5]) : null,
        isObject: false,
        raw: this.includeRaw ? input : '',
      };
    }

    // Object for expression
    const objMatch = input.match(PATTERNS.forObjExpr);
    if (objMatch) {
      return {
        type: 'for',
        keyVar: objMatch[1] || null,
        valueVar: objMatch[2],
        collection: this.parse(objMatch[3]),
        keyExpr: this.parse(objMatch[4]),
        valueExpr: this.parse(objMatch[5]),
        condition: objMatch[6] ? this.parse(objMatch[6]) : null,
        isObject: true,
        raw: this.includeRaw ? input : '',
      };
    }

    return null;
  }

  private tryParseConditional(input: string): HCLConditionalExpression | null {
    // Must have both ? and : not inside strings or nested structures
    const qIndex = this.findOperator(input, '?');
    if (qIndex < 0) return null;

    const colonIndex = this.findOperator(input.slice(qIndex + 1), ':');
    if (colonIndex < 0) return null;

    const condition = input.slice(0, qIndex).trim();
    const trueResult = input.slice(qIndex + 1, qIndex + 1 + colonIndex).trim();
    const falseResult = input.slice(qIndex + 1 + colonIndex + 1).trim();

    return {
      type: 'conditional',
      condition: this.parse(condition),
      trueResult: this.parse(trueResult),
      falseResult: this.parse(falseResult),
      raw: this.includeRaw ? input : '',
    };
  }

  private tryParseSplat(input: string): HCLSplatExpression | null {
    const match = input.match(PATTERNS.splatAccess);
    if (match) {
      return {
        type: 'splat',
        source: this.parse(match[1]),
        each: match[2] ? this.parse(match[2].replace(/^\./, '')) : null,
        raw: this.includeRaw ? input : '',
      };
    }
    return null;
  }

  private tryParseIndex(input: string): HCLIndexExpression | null {
    const match = input.match(PATTERNS.indexAccess);
    if (match && !input.startsWith('[')) { // Avoid matching arrays
      return {
        type: 'index',
        collection: this.parse(match[1]),
        key: this.parse(match[2]),
        raw: this.includeRaw ? input : '',
      };
    }
    return null;
  }

  private tryParseFunction(input: string): HCLFunctionExpression | null {
    const match = input.match(PATTERNS.functionCall);
    if (match) {
      const args = match[2].trim()
        ? this.splitByComma(match[2]).map(arg => this.parse(arg.trim()))
        : [];

      return {
        type: 'function',
        name: match[1],
        args,
        raw: this.includeRaw ? input : '',
      };
    }
    return null;
  }

  private tryParseTemplate(input: string): HCLTemplateExpression | null {
    if (!input.includes('${')) {
      return null;
    }
    return this.parseTemplateString(input, input);
  }

  private parseTemplateString(content: string, raw: string): HCLTemplateExpression {
    const parts: (string | HCLExpression)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const regex = new RegExp(PATTERNS.templateString.source, 'g');

    while ((match = regex.exec(content)) !== null) {
      // Add string part before interpolation
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }

      // Add interpolation expression
      parts.push(this.parse(match[1]));
      lastIndex = regex.lastIndex;
    }

    // Add remaining string
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return {
      type: 'template',
      parts,
      raw: this.includeRaw ? raw : '',
    };
  }

  private tryParseReference(input: string): HCLReferenceExpression | null {
    if (PATTERNS.reference.test(input)) {
      const parts = input.split('.');
      return {
        type: 'reference',
        parts,
        raw: this.includeRaw ? input : '',
      };
    }
    return null;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private literal(value: string | number | boolean | null, raw: string): HCLLiteralExpression {
    return {
      type: 'literal',
      value,
      raw: this.includeRaw ? raw : '',
    };
  }

  private unescapeString(input: string): string {
    return input
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Split string by comma, respecting nested structures
   */
  private splitByComma(input: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const prevChar = i > 0 ? input[i - 1] : '';

      if (inString) {
        current += char;
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '[' || char === '{' || char === '(') {
        depth++;
        current += char;
        continue;
      }

      if (char === ']' || char === '}' || char === ')') {
        depth--;
        current += char;
        continue;
      }

      if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Split object content into key=value pairs
   */
  private splitObjectPairs(input: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const prevChar = i > 0 ? input[i - 1] : '';

      if (inString) {
        current += char;
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '[' || char === '{' || char === '(') {
        depth++;
        current += char;
        continue;
      }

      if (char === ']' || char === '}' || char === ')') {
        depth--;
        current += char;
        continue;
      }

      if ((char === '\n' || char === ',') && depth === 0) {
        if (current.trim()) {
          result.push(current.trim());
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Find operator position, skipping nested structures
   */
  private findOperator(input: string, operator: string): number {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const prevChar = i > 0 ? input[i - 1] : '';

      if (inString) {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '[' || char === '{' || char === '(') {
        depth++;
        continue;
      }

      if (char === ']' || char === '}' || char === ')') {
        depth--;
        continue;
      }

      if (depth === 0 && input.slice(i, i + operator.length) === operator) {
        return i;
      }
    }

    return -1;
  }
}

// ============================================================================
// Extract References from Expression
// ============================================================================

export interface ExtractedReference {
  type: 'resource' | 'data' | 'module' | 'var' | 'local' | 'each' | 'count' | 'self' | 'path';
  parts: string[];
  attribute: string | null;
  raw: string;
}

/**
 * Extract all references from an HCL expression
 */
export function extractReferences(expr: HCLExpression): ExtractedReference[] {
  const refs: ExtractedReference[] = [];
  walkExpression(expr, refs);
  return refs;
}

function walkExpression(expr: HCLExpression, refs: ExtractedReference[]): void {
  switch (expr.type) {
    case 'reference':
      refs.push(parseReference(expr.parts, expr.raw));
      break;

    case 'function':
      for (const arg of expr.args) {
        walkExpression(arg, refs);
      }
      break;

    case 'template':
      for (const part of expr.parts) {
        if (typeof part !== 'string') {
          walkExpression(part, refs);
        }
      }
      break;

    case 'for':
      walkExpression(expr.collection, refs);
      walkExpression(expr.valueExpr, refs);
      if (expr.keyExpr) walkExpression(expr.keyExpr, refs);
      if (expr.condition) walkExpression(expr.condition, refs);
      break;

    case 'conditional':
      walkExpression(expr.condition, refs);
      walkExpression(expr.trueResult, refs);
      walkExpression(expr.falseResult, refs);
      break;

    case 'index':
      walkExpression(expr.collection, refs);
      walkExpression(expr.key, refs);
      break;

    case 'splat':
      walkExpression(expr.source, refs);
      if (expr.each) walkExpression(expr.each, refs);
      break;

    case 'object':
      for (const value of Object.values(expr.attributes)) {
        walkExpression(value, refs);
      }
      break;

    case 'array':
      for (const element of expr.elements) {
        walkExpression(element, refs);
      }
      break;
  }
}

function parseReference(parts: string[], raw: string): ExtractedReference {
  const [first, ...rest] = parts;

  // Special references
  if (first === 'var') {
    return { type: 'var', parts: rest, attribute: rest.slice(1).join('.') || null, raw };
  }
  if (first === 'local') {
    return { type: 'local', parts: rest, attribute: rest.slice(1).join('.') || null, raw };
  }
  if (first === 'module') {
    return { type: 'module', parts: rest, attribute: rest.slice(1).join('.') || null, raw };
  }
  if (first === 'data') {
    return { type: 'data', parts: rest, attribute: rest.slice(2).join('.') || null, raw };
  }
  if (first === 'each') {
    return { type: 'each', parts: rest, attribute: rest.join('.') || null, raw };
  }
  if (first === 'count') {
    return { type: 'count', parts: rest, attribute: rest.join('.') || null, raw };
  }
  if (first === 'self') {
    return { type: 'self', parts: rest, attribute: rest.join('.') || null, raw };
  }
  if (first === 'path') {
    return { type: 'path', parts: rest, attribute: rest.join('.') || null, raw };
  }

  // Resource reference: resource_type.name.attribute
  return {
    type: 'resource',
    parts,
    attribute: parts.slice(2).join('.') || null,
    raw,
  };
}

export const expressionParser = new ExpressionParser();
