/**
 * Terraform Parser Types
 * TASK-DETECT-001: Core type definitions for HCL2 parsing
 */

// ============================================================================
// Source Location Types
// ============================================================================

export interface SourceLocation {
  file: string;
  lineStart: number;
  lineEnd: number;
  columnStart: number;
  columnEnd: number;
}

// ============================================================================
// HCL Expression Types
// ============================================================================

export type HCLExpression =
  | HCLLiteralExpression
  | HCLReferenceExpression
  | HCLFunctionExpression
  | HCLTemplateExpression
  | HCLForExpression
  | HCLConditionalExpression
  | HCLIndexExpression
  | HCLSplatExpression
  | HCLObjectExpression
  | HCLArrayExpression;

export interface HCLLiteralExpression {
  type: 'literal';
  value: string | number | boolean | null;
  raw: string;
}

export interface HCLReferenceExpression {
  type: 'reference';
  parts: string[];  // e.g., ['var', 'name'] or ['aws_instance', 'web', 'id']
  raw: string;
}

export interface HCLFunctionExpression {
  type: 'function';
  name: string;
  args: HCLExpression[];
  raw: string;
}

export interface HCLTemplateExpression {
  type: 'template';
  parts: (string | HCLExpression)[];
  raw: string;
}

export interface HCLForExpression {
  type: 'for';
  keyVar: string | null;
  valueVar: string;
  collection: HCLExpression;
  valueExpr: HCLExpression;
  keyExpr: HCLExpression | null;
  condition: HCLExpression | null;
  isObject: boolean;
  raw: string;
}

export interface HCLConditionalExpression {
  type: 'conditional';
  condition: HCLExpression;
  trueResult: HCLExpression;
  falseResult: HCLExpression;
  raw: string;
}

export interface HCLIndexExpression {
  type: 'index';
  collection: HCLExpression;
  key: HCLExpression;
  raw: string;
}

export interface HCLSplatExpression {
  type: 'splat';
  source: HCLExpression;
  each: HCLExpression | null;
  raw: string;
}

export interface HCLObjectExpression {
  type: 'object';
  attributes: Record<string, HCLExpression>;
  raw: string;
}

export interface HCLArrayExpression {
  type: 'array';
  elements: HCLExpression[];
  raw: string;
}

// ============================================================================
// Terraform Block Types
// ============================================================================

export type TerraformBlockType =
  | 'resource'
  | 'data'
  | 'module'
  | 'variable'
  | 'output'
  | 'locals'
  | 'provider'
  | 'terraform'
  | 'moved'
  | 'import';

export interface TerraformBlock {
  type: TerraformBlockType;
  labels: string[];  // e.g., ["aws_instance", "web"] for resource blocks
  attributes: Record<string, HCLExpression>;
  nestedBlocks: TerraformBlock[];
  location: SourceLocation;
  raw: string;
}

// ============================================================================
// Parse Result Types
// ============================================================================

export interface ParseError {
  message: string;
  location: SourceLocation | null;
  severity: 'error' | 'warning';
  code?: string;
}

export interface TerraformFile {
  path: string;
  blocks: TerraformBlock[];
  errors: ParseError[];
  encoding: string;
  size: number;
}

// ============================================================================
// Node Types for Graph Building
// ============================================================================

export interface TerraformResourceNode {
  id: string;
  type: 'terraform_resource';
  resourceType: string;  // e.g., "aws_instance"
  name: string;          // e.g., "web"
  provider: string;      // e.g., "aws"
  attributes: Record<string, unknown>;
  count: HCLExpression | null;
  forEach: HCLExpression | null;
  dependsOn: string[];
  lifecycle: LifecycleBlock | null;
  location: SourceLocation;
}

export interface LifecycleBlock {
  createBeforeDestroy: boolean;
  preventDestroy: boolean;
  ignoreChanges: string[] | 'all';
  replaceTriggeredBy: string[];
}

export interface TerraformVariableNode {
  id: string;
  type: 'terraform_variable';
  name: string;
  variableType: string | null;
  default: HCLExpression | null;
  description: string | null;
  sensitive: boolean;
  nullable: boolean;
  validation: ValidationBlock[];
  location: SourceLocation;
}

export interface ValidationBlock {
  condition: HCLExpression;
  errorMessage: string;
}

export interface TerraformOutputNode {
  id: string;
  type: 'terraform_output';
  name: string;
  value: HCLExpression;
  description: string | null;
  sensitive: boolean;
  dependsOn: string[];
  location: SourceLocation;
}

export interface TerraformLocalNode {
  id: string;
  type: 'terraform_local';
  name: string;
  value: HCLExpression;
  location: SourceLocation;
}

export interface TerraformProviderNode {
  id: string;
  type: 'terraform_provider';
  name: string;
  alias: string | null;
  version: string | null;
  attributes: Record<string, unknown>;
  location: SourceLocation;
}

// ============================================================================
// Parser Options
// ============================================================================

export interface ParserOptions {
  /** Continue parsing after errors */
  errorRecovery: boolean;
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize: number;
  /** File encoding (default: utf-8) */
  encoding: BufferEncoding;
  /** Include raw HCL text in expressions */
  includeRaw: boolean;
  /** Parse nested blocks recursively */
  parseNestedBlocks: boolean;
}

export const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  errorRecovery: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  encoding: 'utf-8',
  includeRaw: true,
  parseNestedBlocks: true,
};
