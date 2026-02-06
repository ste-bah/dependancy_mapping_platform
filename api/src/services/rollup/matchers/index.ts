/**
 * Rollup Matchers Module Exports
 * @module services/rollup/matchers
 *
 * Central exports for all matcher implementations in the Cross-Repository Aggregation system.
 * Provides 4 matching strategies: ARN, Resource ID, Name, and Tag.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation matchers
 */

// Base matcher class
export { BaseMatcher } from './base-matcher.js';

// Concrete matcher implementations
export { ArnMatcher } from './arn-matcher.js';
export { ResourceIdMatcher } from './resource-id-matcher.js';
export { NameMatcher } from './name-matcher.js';
export { TagMatcher } from './tag-matcher.js';

// Matcher factory
export {
  MatcherFactory,
  createMatcherFactory,
  getDefaultMatcherFactory,
  resetDefaultMatcherFactory,
} from './matcher-factory.js';
