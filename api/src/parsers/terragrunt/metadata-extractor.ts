/**
 * Terragrunt Metadata Extractor
 * @module parsers/terragrunt/metadata-extractor
 *
 * TASK-TG-007: Pure functions for extracting metadata from parsed Terragrunt files.
 *
 * These functions transform a TerragruntFile into TerragruntNodeMetadata
 * for use in graph visualization and summary displays.
 *
 * Design Principles:
 * - Pure functions with no side effects
 * - Graceful handling of missing blocks (returns null/0/empty)
 * - Uses existing type guards from types.ts
 * - No mutations to input data
 */

import {
  TerragruntFile,
  TerragruntBlock,
  TerragruntNodeMetadata,
  isTerraformBlock,
  isRemoteStateBlock,
  isInputsBlock,
  isGenerateBlock,
} from './types';

// ============================================================================
// Main Extractor Function
// ============================================================================

/**
 * Extract metadata from a parsed TerragruntFile for graph visualization.
 *
 * @param file - The parsed TerragruntFile to extract metadata from
 * @returns TerragruntNodeMetadata containing summary information
 *
 * @example
 * ```typescript
 * const file = await parseTerragruntFile('/path/to/terragrunt.hcl');
 * if (isParseSuccess(file)) {
 *   const metadata = extractTerragruntMetadata(file.data);
 *   console.log(metadata.terraformSource);
 *   // => "git::https://github.com/org/modules.git//vpc?ref=v1.0.0"
 * }
 * ```
 */
export function extractTerragruntMetadata(file: TerragruntFile): TerragruntNodeMetadata {
  const blocks = file.blocks;
  const remoteStateInfo = extractRemoteStateInfo(blocks);

  return {
    terraformSource: extractTerraformSource(blocks),
    hasRemoteState: remoteStateInfo.hasRemoteState,
    remoteStateBackend: remoteStateInfo.remoteStateBackend,
    includeCount: file.includes.length,
    dependencyCount: file.dependencies.length,
    inputCount: countInputs(blocks),
    generateBlocks: extractGenerateLabels(blocks),
    dependencyNames: file.dependencies.map(d => d.name),
    includeLabels: file.includes.map(i => i.label),
    encoding: file.encoding,
    size: file.size,
    blockCount: blocks.length,
    errorCount: file.errors.length,
  };
}

// ============================================================================
// Block-Level Extractors
// ============================================================================

/**
 * Extract the Terraform module source from blocks.
 *
 * Finds the first terraform block and extracts its source.
 * Returns the literal value if available, otherwise the raw expression.
 *
 * @param blocks - Array of TerragruntBlock to search
 * @returns The source string or null if not found
 *
 * @example
 * ```typescript
 * const source = extractTerraformSource(file.blocks);
 * // => "git::https://github.com/org/modules.git//vpc"
 * // or null if no terraform block
 * ```
 */
export function extractTerraformSource(
  blocks: readonly TerragruntBlock[]
): string | null {
  const block = blocks.find(isTerraformBlock);

  if (!block?.source) {
    return null;
  }

  // For literal expressions, return the string value
  if (block.source.type === 'literal') {
    const value = block.source.value;
    // Only return if it's a string (source should always be a string)
    return typeof value === 'string' ? value : String(value);
  }

  // For other expression types, return the raw representation
  return block.source.raw;
}

/**
 * Extract remote state information from blocks.
 *
 * Finds the first remote_state block and extracts whether it exists
 * and what backend type is configured.
 *
 * @param blocks - Array of TerragruntBlock to search
 * @returns Object with hasRemoteState boolean and remoteStateBackend string or null
 *
 * @example
 * ```typescript
 * const info = extractRemoteStateInfo(file.blocks);
 * // => { hasRemoteState: true, remoteStateBackend: "s3" }
 * ```
 */
export function extractRemoteStateInfo(
  blocks: readonly TerragruntBlock[]
): { hasRemoteState: boolean; remoteStateBackend: string | null } {
  const block = blocks.find(isRemoteStateBlock);

  return {
    hasRemoteState: block !== undefined,
    remoteStateBackend: block?.backend ?? null,
  };
}

/**
 * Count the number of input variables defined in inputs blocks.
 *
 * Finds the first inputs block and counts its key-value pairs.
 * If no inputs block exists, returns 0.
 *
 * @param blocks - Array of TerragruntBlock to search
 * @returns Number of input variables
 *
 * @example
 * ```typescript
 * const count = countInputs(file.blocks);
 * // => 5
 * ```
 */
export function countInputs(blocks: readonly TerragruntBlock[]): number {
  const inputsBlock = blocks.find(isInputsBlock);

  if (!inputsBlock) {
    return 0;
  }

  return Object.keys(inputsBlock.values).length;
}

/**
 * Extract labels from all generate blocks.
 *
 * Finds all generate blocks and extracts their labels.
 * Labels identify what type of file is being generated (e.g., "provider", "backend").
 *
 * @param blocks - Array of TerragruntBlock to search
 * @returns Array of generate block labels
 *
 * @example
 * ```typescript
 * const labels = extractGenerateLabels(file.blocks);
 * // => ["provider", "backend"]
 * ```
 */
export function extractGenerateLabels(
  blocks: readonly TerragruntBlock[]
): readonly string[] {
  return blocks.filter(isGenerateBlock).map(b => b.label);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a TerragruntFile has any configuration errors.
 *
 * @param file - The parsed TerragruntFile to check
 * @returns True if there are any parse errors
 */
export function hasErrors(file: TerragruntFile): boolean {
  return file.errors.length > 0;
}

/**
 * Check if a TerragruntFile has a terraform source configured.
 *
 * @param file - The parsed TerragruntFile to check
 * @returns True if a terraform block with source exists
 */
export function hasTerraformSource(file: TerragruntFile): boolean {
  return extractTerraformSource(file.blocks) !== null;
}

/**
 * Check if a TerragruntFile has remote state configured.
 *
 * @param file - The parsed TerragruntFile to check
 * @returns True if a remote_state block exists
 */
export function hasRemoteState(file: TerragruntFile): boolean {
  return file.blocks.some(isRemoteStateBlock);
}

/**
 * Check if a TerragruntFile has any dependencies.
 *
 * @param file - The parsed TerragruntFile to check
 * @returns True if there are any dependencies
 */
export function hasDependencies(file: TerragruntFile): boolean {
  return file.dependencies.length > 0;
}

/**
 * Check if a TerragruntFile has any includes.
 *
 * @param file - The parsed TerragruntFile to check
 * @returns True if there are any includes
 */
export function hasIncludes(file: TerragruntFile): boolean {
  return file.includes.length > 0;
}

/**
 * Get a summary string describing the configuration.
 *
 * @param metadata - The extracted metadata
 * @returns A human-readable summary string
 *
 * @example
 * ```typescript
 * const summary = getConfigurationSummary(metadata);
 * // => "Terraform module with s3 backend, 3 dependencies, 5 inputs"
 * ```
 */
export function getConfigurationSummary(metadata: TerragruntNodeMetadata): string {
  const parts: string[] = [];

  if (metadata.terraformSource) {
    parts.push('Terraform module');
  } else {
    parts.push('Terragrunt config');
  }

  if (metadata.hasRemoteState && metadata.remoteStateBackend) {
    parts.push(`with ${metadata.remoteStateBackend} backend`);
  }

  if (metadata.dependencyCount > 0) {
    parts.push(`${metadata.dependencyCount} dependenc${metadata.dependencyCount === 1 ? 'y' : 'ies'}`);
  }

  if (metadata.inputCount > 0) {
    parts.push(`${metadata.inputCount} input${metadata.inputCount === 1 ? '' : 's'}`);
  }

  if (metadata.includeCount > 0) {
    parts.push(`${metadata.includeCount} include${metadata.includeCount === 1 ? '' : 's'}`);
  }

  if (metadata.errorCount > 0) {
    parts.push(`${metadata.errorCount} error${metadata.errorCount === 1 ? '' : 's'}`);
  }

  return parts.join(', ');
}
