/**
 * Custom ESLint Rules Index
 * @module quality/eslint-rules
 *
 * Export all custom ESLint rules for the IaC Dependency Mapping Platform.
 * These rules enforce project-specific coding standards and type safety.
 */

export { noAnyInDomain, ruleName as noAnyInDomainName } from './no-any-in-domain.js';
export { requireBrandedIds, ruleName as requireBrandedIdsName } from './require-branded-ids.js';

// Rule configuration helper for ESLint config
export const rules = {
  'no-any-in-domain': 'error',
  'require-branded-ids': 'warn',
} as const;

// Plugin configuration for ESLint
export const plugin = {
  rules: {
    'no-any-in-domain': require('./no-any-in-domain.js').noAnyInDomain,
    'require-branded-ids': require('./require-branded-ids.js').requireBrandedIds,
  },
};
