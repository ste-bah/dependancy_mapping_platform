/**
 * Export Service
 * Handles graph export functionality (JSON, SVG, PNG)
 * @module features/graph/services/exportService
 */

import type React from 'react';
import type {
  FlowNode,
  FlowEdge,
  GraphData,
  GraphNode,
  GraphEdge,
} from '../types';
import {
  flowNodesToGraphNodes,
  flowEdgesToGraphEdges,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Export format types
 */
export type ExportFormat = 'json' | 'svg' | 'png' | 'dot';

/**
 * Export options
 */
export interface ExportOptions {
  /** Include metadata in export */
  includeMetadata?: boolean;
  /** Include node positions */
  includePositions?: boolean;
  /** Image scale factor (for PNG) */
  scale?: number;
  /** Background color */
  backgroundColor?: string;
  /** File name without extension */
  fileName?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Export format */
  format: ExportFormat;
  /** Content (string for JSON/SVG/DOT, Blob for PNG) */
  content: string | Blob;
  /** Suggested filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
}

/**
 * DOT graph attributes
 */
interface DotAttributes {
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
  nodesep?: number;
  ranksep?: number;
  splines?: 'ortho' | 'polyline' | 'curved' | 'line';
}

/**
 * Export service configuration
 */
export interface ExportServiceConfig {
  /** Default export options */
  defaultOptions?: ExportOptions;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Service for exporting graph data
 *
 * @example
 * ```ts
 * const service = new ExportService();
 *
 * // Export as JSON
 * const jsonContent = service.exportAsJson(nodes, edges);
 *
 * // Export as SVG
 * const svgContent = await service.exportAsSvg(containerRef);
 *
 * // Export as PNG
 * const pngBlob = await service.exportAsPng(containerRef);
 *
 * // Download file
 * service.downloadFile(jsonContent, 'graph.json');
 * ```
 */
export class ExportService {
  private defaultOptions: ExportOptions;

  constructor(config: ExportServiceConfig = {}) {
    this.defaultOptions = {
      includeMetadata: true,
      includePositions: true,
      scale: 2,
      backgroundColor: '#ffffff',
      fileName: 'graph-export',
      ...config.defaultOptions,
    };
  }

  // ==========================================================================
  // JSON Export
  // ==========================================================================

  /**
   * Export graph as JSON string
   *
   * @param nodes - Flow nodes to export
   * @param edges - Flow edges to export
   * @param options - Export options
   * @returns JSON string
   */
  exportAsJson(
    nodes: FlowNode[],
    edges: FlowEdge[],
    options?: ExportOptions
  ): string {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Convert to GraphNode/GraphEdge format
    const graphNodes = flowNodesToGraphNodes(nodes);
    const graphEdges = flowEdgesToGraphEdges(edges);

    const exportData: GraphData & {
      positions?: Array<{ id: string; x: number; y: number }>;
      exportedAt?: string;
      nodeCount?: number;
      edgeCount?: number;
    } = {
      nodes: graphNodes,
      edges: graphEdges,
    };

    // Include positions if requested
    if (mergedOptions.includePositions) {
      exportData.positions = nodes.map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
      }));
    }

    // Include metadata if requested
    if (mergedOptions.includeMetadata) {
      exportData.exportedAt = new Date().toISOString();
      exportData.nodeCount = nodes.length;
      exportData.edgeCount = edges.length;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export as compact JSON (no formatting)
   *
   * @param nodes - Flow nodes
   * @param edges - Flow edges
   * @returns Compact JSON string
   */
  exportAsCompactJson(nodes: FlowNode[], edges: FlowEdge[]): string {
    const graphNodes = flowNodesToGraphNodes(nodes);
    const graphEdges = flowEdgesToGraphEdges(edges);

    return JSON.stringify({ nodes: graphNodes, edges: graphEdges });
  }

  // ==========================================================================
  // SVG Export
  // ==========================================================================

  /**
   * Export graph as SVG string
   *
   * @param containerRef - React ref to the graph container
   * @param options - Export options
   * @returns SVG string
   */
  async exportAsSvg(
    containerRef: React.RefObject<HTMLElement>,
    options?: ExportOptions
  ): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    if (!containerRef.current) {
      throw new Error('Container reference is not available');
    }

    // Find the SVG element within the React Flow container
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) {
      throw new Error('SVG element not found in container');
    }

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

    // Set background color
    if (mergedOptions.backgroundColor) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', mergedOptions.backgroundColor);
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    }

    // Get computed styles and inline them
    await this.inlineStyles(clonedSvg);

    // Serialize to string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clonedSvg);

    // Add XML declaration
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;

    return svgString;
  }

  /**
   * Inline computed styles into SVG elements
   */
  private async inlineStyles(element: SVGElement): Promise<void> {
    const computedStyle = window.getComputedStyle(element);
    const styleProperties = [
      'fill',
      'stroke',
      'stroke-width',
      'font-family',
      'font-size',
      'font-weight',
      'opacity',
    ];

    let inlineStyle = '';
    for (const prop of styleProperties) {
      const value = computedStyle.getPropertyValue(prop);
      if (value) {
        inlineStyle += `${prop}: ${value}; `;
      }
    }

    if (inlineStyle) {
      element.setAttribute('style', inlineStyle + (element.getAttribute('style') ?? ''));
    }

    // Recursively process children
    for (const child of Array.from(element.children)) {
      if (child instanceof SVGElement) {
        await this.inlineStyles(child);
      }
    }
  }

  // ==========================================================================
  // PNG Export
  // ==========================================================================

  /**
   * Export graph as PNG blob
   *
   * @param containerRef - React ref to the graph container
   * @param options - Export options
   * @returns PNG blob
   */
  async exportAsPng(
    containerRef: React.RefObject<HTMLElement>,
    options?: ExportOptions
  ): Promise<Blob> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const scale = mergedOptions.scale ?? 2;

    // Get SVG string first
    const svgString = await this.exportAsSvg(containerRef, options);

    // Create image from SVG
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(url);

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set background
        if (mergedOptions.backgroundColor) {
          ctx.fillStyle = mergedOptions.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw image
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create PNG blob'));
            }
          },
          'image/png',
          1.0
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };

      img.src = url;
    });
  }

  // ==========================================================================
  // DOT Export
  // ==========================================================================

  /**
   * Export graph as DOT (Graphviz) format
   *
   * @param nodes - Flow nodes
   * @param edges - Flow edges
   * @param attributes - DOT graph attributes
   * @returns DOT format string
   */
  exportAsDot(
    nodes: FlowNode[],
    edges: FlowEdge[],
    attributes?: DotAttributes
  ): string {
    const attrs = {
      rankdir: 'TB',
      nodesep: 0.5,
      ranksep: 1.0,
      splines: 'ortho' as const,
      ...attributes,
    };

    const lines: string[] = [
      'digraph DependencyGraph {',
      `  rankdir=${attrs.rankdir};`,
      `  nodesep=${attrs.nodesep};`,
      `  ranksep=${attrs.ranksep};`,
      `  splines=${attrs.splines};`,
      '',
      '  // Node definitions',
    ];

    // Add nodes
    for (const node of nodes) {
      const label = this.escapeDotString(node.data.name);
      const shape = this.getNodeShape(node.data.type);
      lines.push(`  "${node.id}" [label="${label}" shape=${shape}];`);
    }

    lines.push('');
    lines.push('  // Edge definitions');

    // Add edges
    for (const edge of edges) {
      const style = edge.data?.type === 'DEPENDS_ON' ? 'solid' : 'dashed';
      lines.push(`  "${edge.source}" -> "${edge.target}" [style=${style}];`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Escape string for DOT format
   */
  private escapeDotString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  /**
   * Get DOT shape for node type
   */
  private getNodeShape(type: string): string {
    const shapeMap: Record<string, string> = {
      terraform_resource: 'box',
      terraform_module: 'folder',
      terraform_data_source: 'cylinder',
      helm_chart: 'component',
      k8s_resource: 'box3d',
      external_reference: 'ellipse',
    };
    return shapeMap[type] ?? 'box';
  }

  // ==========================================================================
  // Download Operations
  // ==========================================================================

  /**
   * Download content as a file
   *
   * @param content - File content (string or Blob)
   * @param filename - Download filename
   */
  downloadFile(content: string | Blob, filename: string): void {
    let blob: Blob;
    let mimeType: string;

    if (typeof content === 'string') {
      // Determine MIME type from filename
      if (filename.endsWith('.json')) {
        mimeType = 'application/json';
      } else if (filename.endsWith('.svg')) {
        mimeType = 'image/svg+xml';
      } else if (filename.endsWith('.dot') || filename.endsWith('.gv')) {
        mimeType = 'text/vnd.graphviz';
      } else {
        mimeType = 'text/plain';
      }
      blob = new Blob([content], { type: mimeType });
    } else {
      blob = content;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download in one step
   *
   * @param format - Export format
   * @param nodes - Flow nodes
   * @param edges - Flow edges
   * @param containerRef - Container ref (required for SVG/PNG)
   * @param options - Export options
   */
  async exportAndDownload(
    format: ExportFormat,
    nodes: FlowNode[],
    edges: FlowEdge[],
    containerRef?: React.RefObject<HTMLElement>,
    options?: ExportOptions
  ): Promise<void> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const baseFileName = mergedOptions.fileName ?? 'graph-export';

    let content: string | Blob;
    let filename: string;

    switch (format) {
      case 'json':
        content = this.exportAsJson(nodes, edges, options);
        filename = `${baseFileName}.json`;
        break;

      case 'svg':
        if (!containerRef) {
          throw new Error('Container reference required for SVG export');
        }
        content = await this.exportAsSvg(containerRef, options);
        filename = `${baseFileName}.svg`;
        break;

      case 'png':
        if (!containerRef) {
          throw new Error('Container reference required for PNG export');
        }
        content = await this.exportAsPng(containerRef, options);
        filename = `${baseFileName}.png`;
        break;

      case 'dot':
        content = this.exportAsDot(nodes, edges);
        filename = `${baseFileName}.dot`;
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    this.downloadFile(content, filename);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get export result without downloading
   *
   * @param format - Export format
   * @param nodes - Flow nodes
   * @param edges - Flow edges
   * @param containerRef - Container ref
   * @param options - Export options
   * @returns Export result
   */
  async getExportResult(
    format: ExportFormat,
    nodes: FlowNode[],
    edges: FlowEdge[],
    containerRef?: React.RefObject<HTMLElement>,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const baseFileName = mergedOptions.fileName ?? 'graph-export';

    let content: string | Blob;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        content = this.exportAsJson(nodes, edges, options);
        filename = `${baseFileName}.json`;
        mimeType = 'application/json';
        break;

      case 'svg':
        if (!containerRef) {
          throw new Error('Container reference required for SVG export');
        }
        content = await this.exportAsSvg(containerRef, options);
        filename = `${baseFileName}.svg`;
        mimeType = 'image/svg+xml';
        break;

      case 'png':
        if (!containerRef) {
          throw new Error('Container reference required for PNG export');
        }
        content = await this.exportAsPng(containerRef, options);
        filename = `${baseFileName}.png`;
        mimeType = 'image/png';
        break;

      case 'dot':
        content = this.exportAsDot(nodes, edges);
        filename = `${baseFileName}.dot`;
        mimeType = 'text/vnd.graphviz';
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const size =
      typeof content === 'string'
        ? new Blob([content]).size
        : content.size;

    return {
      format,
      content,
      filename,
      mimeType,
      size,
    };
  }

  /**
   * Get available export formats
   */
  getAvailableFormats(): ExportFormat[] {
    return ['json', 'svg', 'png', 'dot'];
  }

  /**
   * Get default options
   */
  getDefaultOptions(): ExportOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Update default options
   */
  setDefaultOptions(options: Partial<ExportOptions>): void {
    this.defaultOptions = {
      ...this.defaultOptions,
      ...options,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ExportService instance
 *
 * @param config - Service configuration
 * @returns ExportService instance
 */
export function createExportService(
  config: ExportServiceConfig = {}
): ExportService {
  return new ExportService(config);
}

export default ExportService;
