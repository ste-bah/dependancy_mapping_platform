/**
 * ArgoCD Parser Module
 * @module parsers/argocd
 *
 * Exports all ArgoCD-related types and utilities for Application/ApplicationSet parsing.
 *
 * TASK-XREF-005: ArgoCD Application manifest parsing for GitOps deployment detection
 */

// Types
export * from './types.js';

// Application Parser
export {
  ArgoCDApplicationParser,
  createArgoCDParser,
  parseArgoCDManifest,
  createArgoCDGraph,
} from './application-parser.js';
