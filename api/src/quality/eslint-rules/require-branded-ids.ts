/**
 * Custom ESLint Rule: Require branded types for entity IDs
 * @module quality/eslint-rules/require-branded-ids
 *
 * Enforces the use of branded/nominal types for entity ID properties
 * instead of raw string or number types. This prevents accidentally
 * mixing up different types of IDs (e.g., passing a UserId where a ScanId is expected).
 *
 * Pattern enforced:
 * - Properties named 'id', '*Id', '*_id' should use branded types like ScanId, NodeId, etc.
 */

import type { TSESTree } from '@typescript-eslint/utils';

// ============================================================================
// Rule Configuration
// ============================================================================

/**
 * Patterns that identify ID properties
 */
const ID_PROPERTY_PATTERNS = [
  /^id$/,                    // Exact 'id'
  /^[a-z]+Id$/,              // camelCase ending in Id (userId, scanId)
  /^[A-Z][a-zA-Z]*Id$/,      // PascalCase ending in Id (UserId, ScanId)
  /^[a-z]+_id$/,             // snake_case ending in _id (user_id, scan_id)
  /Id$/,                     // Any property ending in Id
] as const;

/**
 * Known branded ID types in the codebase
 */
const KNOWN_BRANDED_TYPES = new Set([
  'ScanId',
  'DbNodeId',
  'DbEdgeId',
  'RepositoryId',
  'TenantId',
  'UserId',
  'ApiKeyId',
  'NodeId',
  'EdgeId',
  'GraphId',
] as const);

/**
 * Primitive types that should be flagged
 */
const PRIMITIVE_ID_TYPES = new Set([
  'string',
  'number',
  'String',
  'Number',
] as const);

// ============================================================================
// Rule Metadata
// ============================================================================

export const ruleName = 'require-branded-ids';

export const meta = {
  type: 'suggestion' as const,
  docs: {
    description: 'Require branded types for entity ID properties',
    recommended: true,
    url: 'https://docs.iac-mapper.dev/rules/require-branded-ids',
  },
  messages: {
    useBrandedId: 'Property "{{name}}" should use a branded ID type (e.g., ScanId, NodeId) instead of {{type}}.',
    useBrandedIdSuggestion: 'Property "{{name}}" uses {{type}}. Consider using {{suggestion}} or create a new branded type.',
    missingBrandedType: 'ID property "{{name}}" should use a branded type. Create one like: type {{suggestion}} = string & { readonly __brand: "{{suggestion}}" };',
  },
  schema: [
    {
      type: 'object' as const,
      properties: {
        additionalIdPatterns: {
          type: 'array' as const,
          items: { type: 'string' as const },
          default: [],
        },
        additionalBrandedTypes: {
          type: 'array' as const,
          items: { type: 'string' as const },
          default: [],
        },
        ignoreInterfaces: {
          type: 'array' as const,
          items: { type: 'string' as const },
          default: [],
        },
        reportLevel: {
          type: 'string' as const,
          enum: ['error', 'warning', 'suggestion'] as const,
          default: 'suggestion',
        },
      },
      additionalProperties: false,
    },
  ],
  fixable: undefined as const,
  hasSuggestions: true,
} as const;

// ============================================================================
// Rule Options
// ============================================================================

export interface RuleOptions {
  additionalIdPatterns?: string[];
  additionalBrandedTypes?: string[];
  ignoreInterfaces?: string[];
  reportLevel?: 'error' | 'warning' | 'suggestion';
}

const defaultOptions: RuleOptions = {
  additionalIdPatterns: [],
  additionalBrandedTypes: [],
  ignoreInterfaces: [],
  reportLevel: 'suggestion',
};

// ============================================================================
// Rule Implementation
// ============================================================================

export interface RuleContext {
  getFilename(): string;
  report(descriptor: ReportDescriptor): void;
  options: [RuleOptions?];
}

export interface ReportDescriptor {
  node: TSESTree.Node;
  messageId: string;
  data?: Record<string, string>;
}

/**
 * Check if a property name matches ID patterns
 */
function isIdProperty(name: string, customPatterns: string[]): boolean {
  // Check built-in patterns
  for (const pattern of ID_PROPERTY_PATTERNS) {
    if (pattern.test(name)) {
      return true;
    }
  }

  // Check custom patterns
  for (const patternStr of customPatterns) {
    try {
      const pattern = new RegExp(patternStr);
      if (pattern.test(name)) {
        return true;
      }
    } catch {
      // Invalid pattern, skip
    }
  }

  return false;
}

/**
 * Check if a type is a known branded type
 */
function isBrandedType(typeName: string, customBrandedTypes: string[]): boolean {
  if (KNOWN_BRANDED_TYPES.has(typeName as typeof KNOWN_BRANDED_TYPES extends Set<infer T> ? T : never)) {
    return true;
  }

  if (customBrandedTypes.includes(typeName)) {
    return true;
  }

  // Check for branded type pattern (ends with Id and is PascalCase)
  if (/^[A-Z][a-zA-Z]*Id$/.test(typeName)) {
    return true;
  }

  return false;
}

/**
 * Check if a type node represents a primitive type
 */
function isPrimitiveType(node: TSESTree.TypeNode): { isPrimitive: boolean; typeName: string } {
  if (node.type === 'TSStringKeyword') {
    return { isPrimitive: true, typeName: 'string' };
  }

  if (node.type === 'TSNumberKeyword') {
    return { isPrimitive: true, typeName: 'number' };
  }

  if (node.type === 'TSTypeReference' && node.typeName.type === 'Identifier') {
    const name = node.typeName.name;
    if (PRIMITIVE_ID_TYPES.has(name as typeof PRIMITIVE_ID_TYPES extends Set<infer T> ? T : never)) {
      return { isPrimitive: true, typeName: name };
    }
  }

  return { isPrimitive: false, typeName: '' };
}

/**
 * Get the type name from a type reference
 */
function getTypeName(node: TSESTree.TypeNode): string | undefined {
  if (node.type === 'TSTypeReference' && node.typeName.type === 'Identifier') {
    return node.typeName.name;
  }
  return undefined;
}

/**
 * Generate a suggested branded type name from property name
 */
function suggestBrandedType(propertyName: string): string {
  // Remove common prefixes/suffixes and convert to PascalCase
  let suggestion = propertyName
    .replace(/_id$/i, '')
    .replace(/Id$/i, '')
    .replace(/^id$/i, 'Entity');

  // Convert to PascalCase
  suggestion = suggestion
    .split(/[_-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  return suggestion + 'Id';
}

/**
 * Check if inside an ignored interface
 */
function isInIgnoredInterface(node: TSESTree.Node, ignoredInterfaces: string[]): boolean {
  let current: TSESTree.Node | undefined = node;

  while (current) {
    if (current.type === 'TSInterfaceDeclaration') {
      const interfaceNode = current as TSESTree.TSInterfaceDeclaration;
      if (interfaceNode.id && ignoredInterfaces.includes(interfaceNode.id.name)) {
        return true;
      }
    }
    if (current.type === 'TSTypeAliasDeclaration') {
      const typeNode = current as TSESTree.TSTypeAliasDeclaration;
      if (typeNode.id && ignoredInterfaces.includes(typeNode.id.name)) {
        return true;
      }
    }
    current = (current as TSESTree.Node & { parent?: TSESTree.Node }).parent;
  }

  return false;
}

/**
 * Create the rule
 */
export function create(context: RuleContext): Record<string, (node: TSESTree.Node) => void> {
  const options = { ...defaultOptions, ...context.options[0] };
  const allBrandedTypes = [...options.additionalBrandedTypes ?? []];

  return {
    /**
     * Check interface property signatures
     */
    TSPropertySignature(node: TSESTree.TSPropertySignature): void {
      // Skip if no type annotation
      if (!node.typeAnnotation?.typeAnnotation) {
        return;
      }

      // Get property name
      if (node.key.type !== 'Identifier') {
        return;
      }

      const propertyName = node.key.name;

      // Check if this is an ID property
      if (!isIdProperty(propertyName, options.additionalIdPatterns ?? [])) {
        return;
      }

      // Skip if in ignored interface
      if (isInIgnoredInterface(node, options.ignoreInterfaces ?? [])) {
        return;
      }

      const typeNode = node.typeAnnotation.typeAnnotation;

      // Check if it's using a primitive type
      const { isPrimitive, typeName } = isPrimitiveType(typeNode);
      if (!isPrimitive) {
        // Check if it's already a branded type
        const usedType = getTypeName(typeNode);
        if (usedType && !isBrandedType(usedType, allBrandedTypes)) {
          // Unknown type that's not branded - might want to warn
          return;
        }
        return; // Already using a non-primitive type
      }

      // Generate suggestion
      const suggestion = suggestBrandedType(propertyName);

      context.report({
        node: node.typeAnnotation,
        messageId: 'useBrandedIdSuggestion',
        data: {
          name: propertyName,
          type: typeName,
          suggestion,
        },
      });
    },

    /**
     * Check class property definitions
     */
    PropertyDefinition(node: TSESTree.PropertyDefinition): void {
      // Skip if no type annotation
      if (!node.typeAnnotation?.typeAnnotation) {
        return;
      }

      // Get property name
      if (node.key.type !== 'Identifier') {
        return;
      }

      const propertyName = node.key.name;

      // Check if this is an ID property
      if (!isIdProperty(propertyName, options.additionalIdPatterns ?? [])) {
        return;
      }

      const typeNode = node.typeAnnotation.typeAnnotation;

      // Check if it's using a primitive type
      const { isPrimitive, typeName } = isPrimitiveType(typeNode);
      if (!isPrimitive) {
        return;
      }

      const suggestion = suggestBrandedType(propertyName);

      context.report({
        node: node.typeAnnotation,
        messageId: 'useBrandedIdSuggestion',
        data: {
          name: propertyName,
          type: typeName,
          suggestion,
        },
      });
    },

    /**
     * Check function parameter types for ID parameters
     */
    'FunctionDeclaration > Identifier[name=/Id$/]'(node: TSESTree.Identifier): void {
      const parent = (node as TSESTree.Node & { parent?: TSESTree.Node }).parent;
      if (!parent || parent.type !== 'FunctionDeclaration') {
        return;
      }

      // Check parameters
      const funcDecl = parent as TSESTree.FunctionDeclaration;
      for (const param of funcDecl.params) {
        if (param.type !== 'Identifier') continue;
        if (!param.typeAnnotation?.typeAnnotation) continue;

        if (!isIdProperty(param.name, options.additionalIdPatterns ?? [])) {
          continue;
        }

        const typeNode = param.typeAnnotation.typeAnnotation;
        const { isPrimitive, typeName } = isPrimitiveType(typeNode);

        if (isPrimitive) {
          const suggestion = suggestBrandedType(param.name);

          context.report({
            node: param.typeAnnotation,
            messageId: 'useBrandedIdSuggestion',
            data: {
              name: param.name,
              type: typeName,
              suggestion,
            },
          });
        }
      }
    },
  };
}

// ============================================================================
// Rule Export (ESLint Plugin Format)
// ============================================================================

/**
 * ESLint rule export
 */
export const requireBrandedIds = {
  meta,
  create,
};

export default requireBrandedIds;
