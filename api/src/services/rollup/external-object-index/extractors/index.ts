/**
 * Extractors Module Exports
 * @module services/rollup/external-object-index/extractors
 *
 * Central exports for external reference extractors.
 *
 * TASK-ROLLUP-003: External Object Index extractors
 */

// Base extractor
export { BaseExtractor } from './base-extractor.js';

// Concrete extractors
export { ArnExtractor, createArnExtractor } from './arn-extractor.js';
export { ResourceIdExtractor, createResourceIdExtractor } from './resource-id-extractor.js';
export { K8sExtractor, createK8sExtractor } from './k8s-extractor.js';

// Factory
export {
  ExtractorFactory,
  createExtractorFactory,
  getDefaultExtractorFactory,
  resetDefaultExtractorFactory,
} from './extractor-factory.js';
