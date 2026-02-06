/**
 * Helm Parser Module
 * @module parsers/helm
 *
 * Exports all Helm-related types and utilities for chart parsing.
 *
 * TASK-DETECT-006: Helm chart structure detection
 * TASK-DETECT-007: Helm template analysis
 * TASK-DETECT-008: Helm values parsing
 */

// Types
export * from './types.js';

// Chart Parser (TASK-DETECT-006)
export {
  HelmChartParser,
  HelmRequirementsParser,
  type ChartParseResult,
  type ChartParseInput,
  createChartParser,
  createRequirementsParser,
  parseChartYaml,
  buildChartNode,
} from './chart-parser.js';

// Values Parser (TASK-DETECT-008)
export {
  HelmValuesParser,
  type ValuesParseResult,
  type ExternalReference,
  type ExternalRefType,
  type ExternalRefMetadata,
  type ValueOverride,
  createValuesParser,
  parseValuesYaml,
  buildValuesFile,
  detectValueOverrides,
} from './values-parser.js';

// Template Analyzer (TASK-DETECT-007)
export {
  HelmTemplateAnalyzer,
  type TemplateAnalysisResult,
  type DefinedTemplate,
  createTemplateAnalyzer,
  analyzeTemplate,
  extractHelpers,
} from './template-analyzer.js';
