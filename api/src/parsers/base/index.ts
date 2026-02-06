/**
 * Parser Base Module Exports
 * @module parsers/base
 *
 * Core parser infrastructure for IaC dependency detection.
 * TASK-DETECT-001: Parser interface and base implementation
 */

export {
  // Types
  type ParseResult,
  type ParseSuccess,
  type ParseFailure,
  type ParseError,
  type ParseDiagnostic,
  type ParseMetadata,
  type ParseErrorCode,
  type IParser,
  type ParserOptions,
  type ParserCapability,
  type IaCFormat,

  // Classes
  BaseParser,

  // Constants
  DEFAULT_PARSER_OPTIONS,

  // Type Guards
  isParseSuccess,
  isParseFailure,
} from './parser';
