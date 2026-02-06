/**
 * Custom ESLint Rule: Disallow 'any' type in domain layer
 * @module quality/eslint-rules/no-any-in-domain
 *
 * Enforces strict typing in domain layer files by disallowing the 'any' type.
 * Domain layer includes entities, value objects, domain services, and aggregates.
 *
 * This rule helps maintain type safety in critical business logic areas.
 */

import type { TSESTree } from '@typescript-eslint/utils';

// ============================================================================
// Rule Configuration
// ============================================================================

/**
 * Domain layer file patterns - files where 'any' should be disallowed
 */
const DOMAIN_FILE_PATTERNS = [
  /\/domain\//,
  /\/entities\//,
  /\/value-objects\//,
  /\/aggregates\//,
  /\/services\/.*\.service\./,
  /\/types\/entities\./,
  /\/types\/graph\./,
  /\/types\/evidence\./,
] as const;

/**
 * Allowed exceptions - contexts where 'any' may be acceptable
 */
const ALLOWED_CONTEXTS = [
  'catch_clause_variable', // catch (e: any) for error handling
  'type_assertion_to_unknown', // as unknown pattern
] as const;

// ============================================================================
// Rule Metadata
// ============================================================================

export const ruleName = 'no-any-in-domain';

export const meta = {
  type: 'problem' as const,
  docs: {
    description: 'Disallow any type in domain layer files',
    recommended: true,
    url: 'https://docs.iac-mapper.dev/rules/no-any-in-domain',
  },
  messages: {
    noAny: 'Type "any" is not allowed in domain layer. Use specific types or "unknown" instead.',
    noAnyParameter: 'Parameter "{{name}}" should not use type "any". Consider using a generic type or "unknown".',
    noAnyReturn: 'Return type "any" is not allowed. Specify the actual return type or use "unknown".',
    noAnyProperty: 'Property "{{name}}" should not use type "any". Define a proper interface or type.',
    noAnyVariable: 'Variable should not be typed as "any". Use a specific type or type inference.',
    noAnyAssertion: 'Type assertion to "any" is not allowed. Use "unknown" if type is truly unknown.',
  },
  schema: [
    {
      type: 'object' as const,
      properties: {
        allowInCatchClause: {
          type: 'boolean' as const,
          default: true,
        },
        allowExplicitUnknown: {
          type: 'boolean' as const,
          default: true,
        },
        customDomainPatterns: {
          type: 'array' as const,
          items: { type: 'string' as const },
          default: [],
        },
      },
      additionalProperties: false,
    },
  ],
  fixable: undefined as const,
} as const;

// ============================================================================
// Rule Options
// ============================================================================

export interface RuleOptions {
  allowInCatchClause?: boolean;
  allowExplicitUnknown?: boolean;
  customDomainPatterns?: string[];
}

const defaultOptions: RuleOptions = {
  allowInCatchClause: true,
  allowExplicitUnknown: true,
  customDomainPatterns: [],
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
 * Check if a file is in the domain layer
 */
function isDomainFile(filename: string, customPatterns: string[]): boolean {
  // Check built-in patterns
  for (const pattern of DOMAIN_FILE_PATTERNS) {
    if (pattern.test(filename)) {
      return true;
    }
  }

  // Check custom patterns
  for (const patternStr of customPatterns) {
    try {
      const pattern = new RegExp(patternStr);
      if (pattern.test(filename)) {
        return true;
      }
    } catch {
      // Invalid pattern, skip
    }
  }

  return false;
}

/**
 * Check if the node is in a catch clause
 */
function isInCatchClause(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node;
  while (current) {
    if (current.type === 'CatchClause') {
      return true;
    }
    current = (current as TSESTree.Node & { parent?: TSESTree.Node }).parent;
  }
  return false;
}

/**
 * Get the name from an identifier or pattern
 */
function getNodeName(node: TSESTree.Node): string | undefined {
  if (node.type === 'Identifier') {
    return node.name;
  }
  return undefined;
}

/**
 * Create the rule
 */
export function create(context: RuleContext): Record<string, (node: TSESTree.Node) => void> {
  const filename = context.getFilename();
  const options = { ...defaultOptions, ...context.options[0] };

  // Only apply to domain files
  if (!isDomainFile(filename, options.customDomainPatterns ?? [])) {
    return {};
  }

  return {
    /**
     * Check for 'any' keyword in type annotations
     */
    TSAnyKeyword(node: TSESTree.TSAnyKeyword): void {
      // Allow in catch clauses if option is enabled
      if (options.allowInCatchClause && isInCatchClause(node)) {
        return;
      }

      // Get parent to determine context
      const parent = (node as TSESTree.Node & { parent?: TSESTree.Node }).parent;

      if (!parent) {
        context.report({ node, messageId: 'noAny' });
        return;
      }

      // Determine appropriate message based on context
      switch (parent.type) {
        case 'TSTypeAnnotation': {
          const grandparent = (parent as TSESTree.Node & { parent?: TSESTree.Node }).parent;
          if (grandparent) {
            if (grandparent.type === 'Identifier' || grandparent.type === 'Parameter') {
              const name = getNodeName(grandparent as TSESTree.Node);
              if (name) {
                context.report({
                  node,
                  messageId: 'noAnyParameter',
                  data: { name },
                });
                return;
              }
            }
            if (grandparent.type === 'TSPropertySignature' || grandparent.type === 'PropertyDefinition') {
              const keyNode = (grandparent as TSESTree.TSPropertySignature).key;
              const name = keyNode?.type === 'Identifier' ? keyNode.name : undefined;
              if (name) {
                context.report({
                  node,
                  messageId: 'noAnyProperty',
                  data: { name },
                });
                return;
              }
            }
            if (grandparent.type === 'VariableDeclarator') {
              context.report({ node, messageId: 'noAnyVariable' });
              return;
            }
          }
          break;
        }

        case 'TSTypeAssertion':
        case 'TSAsExpression': {
          context.report({ node, messageId: 'noAnyAssertion' });
          return;
        }

        case 'TSFunctionType':
        case 'TSMethodSignature': {
          context.report({ node, messageId: 'noAnyReturn' });
          return;
        }

        default:
          break;
      }

      // Default message
      context.report({ node, messageId: 'noAny' });
    },

    /**
     * Check for explicit 'any' type references
     */
    TSTypeReference(node: TSESTree.TSTypeReference): void {
      if (node.typeName.type === 'Identifier' && node.typeName.name === 'any') {
        // Allow in catch clauses if option is enabled
        if (options.allowInCatchClause && isInCatchClause(node)) {
          return;
        }

        context.report({ node, messageId: 'noAny' });
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
export const noAnyInDomain = {
  meta,
  create,
};

export default noAnyInDomain;
