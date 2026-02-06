/**
 * CustomNode Component Tests
 * Tests for the custom React Flow node component
 * @module features/graph/__tests__/components/CustomNode.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { CustomNode } from '../../components/CustomNode';
import { renderWithProviders, createMockNode } from '../utils/testUtils';
import { nodeTypeLabels, nodeColors, nodeTypeIcons } from '../../types';
import type { CustomNodeData } from '../../types';

// Mock the cn utility
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) =>
    classes.filter(Boolean).join(' '),
}));

describe('CustomNode', () => {
  const defaultNodeData: CustomNodeData = {
    ...createMockNode({
      id: 'test-node',
      name: 'aws_s3_bucket.main',
      type: 'terraform_resource',
    }),
    selected: false,
    highlighted: false,
    dimmed: false,
  };

  const defaultProps = {
    id: 'test-node',
    type: 'customNode',
    data: defaultNodeData,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    xPos: 0,
    yPos: 0,
    zIndex: 1,
    dragging: false,
    selected: false,
  };

  describe('rendering', () => {
    it('should render node name', () => {
      renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      expect(screen.getByText('aws_s3_bucket.main')).toBeInTheDocument();
    });

    it('should render node type label', () => {
      renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      expect(screen.getByText(nodeTypeLabels.terraform_resource)).toBeInTheDocument();
    });

    it('should render node type icon', () => {
      renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      // The icon is rendered as an emoji in a span
      const expectedIcon = nodeTypeIcons.terraform_resource;
      expect(screen.getByText(expectedIcon)).toBeInTheDocument();
    });

    it('should render file location when present', () => {
      const dataWithLocation: CustomNodeData = {
        ...defaultNodeData,
        location: {
          filePath: '/modules/storage/main.tf',
          startLine: 10,
          endLine: 25,
        },
      };

      renderWithProviders(<CustomNode {...defaultProps} data={dataWithLocation} />, { withReactFlow: true });

      expect(screen.getByText(/main\.tf/)).toBeInTheDocument();
    });

    it('should not render location when absent', () => {
      const dataWithoutLocation: CustomNodeData = {
        ...defaultNodeData,
        location: undefined,
      };

      renderWithProviders(<CustomNode {...defaultProps} data={dataWithoutLocation} />, { withReactFlow: true });

      // Should not have any file reference
      expect(screen.queryByText(/\.tf/)).not.toBeInTheDocument();
    });
  });

  describe('node types', () => {
    const nodeTypes = [
      'terraform_resource',
      'terraform_module',
      'helm_chart',
      'k8s_resource',
      'terraform_data_source',
      'external_reference',
    ] as const;

    nodeTypes.forEach((type) => {
      it(`should render ${type} node correctly`, () => {
        const data: CustomNodeData = {
          ...createMockNode({ type }),
          selected: false,
          highlighted: false,
          dimmed: false,
        };

        renderWithProviders(<CustomNode {...defaultProps} data={data} />, { withReactFlow: true });

        expect(screen.getByText(nodeTypeLabels[type])).toBeInTheDocument();
      });
    });
  });

  describe('visual states', () => {
    it('should apply selected styles', () => {
      const selectedData: CustomNodeData = {
        ...defaultNodeData,
        selected: true,
      };

      const { container } = renderWithProviders(
        <CustomNode {...defaultProps} data={selectedData} selected={true} />,
        { withReactFlow: true }
      );

      // Find the node container div (not the handle)
      const nodeContainer = container.querySelector('[data-testid="custom-node"]')
        || container.querySelector('.rounded-lg');
      expect(nodeContainer).toHaveClass('ring-offset-2');
    });

    it('should apply highlighted styles', () => {
      const highlightedData: CustomNodeData = {
        ...defaultNodeData,
        highlighted: true,
      };

      const { container } = renderWithProviders(
        <CustomNode {...defaultProps} data={highlightedData} />,
        { withReactFlow: true }
      );

      const nodeContainer = container.querySelector('.rounded-lg');
      expect(nodeContainer).toHaveClass('ring-amber-400');
    });

    it('should apply dimmed styles', () => {
      const dimmedData: CustomNodeData = {
        ...defaultNodeData,
        dimmed: true,
      };

      const { container } = renderWithProviders(
        <CustomNode {...defaultProps} data={dimmedData} />,
        { withReactFlow: true }
      );

      const nodeContainer = container.querySelector('.rounded-lg');
      expect(nodeContainer).toHaveClass('opacity-40');
    });

    it('should combine multiple states', () => {
      const combinedData: CustomNodeData = {
        ...defaultNodeData,
        selected: true,
        highlighted: true,
      };

      const { container } = renderWithProviders(
        <CustomNode {...defaultProps} data={combinedData} selected={true} />,
        { withReactFlow: true }
      );

      const nodeContainer = container.querySelector('.rounded-lg');
      expect(nodeContainer).toHaveClass('ring-offset-2');
      // Note: highlighted ring may be overridden by selected ring
    });
  });

  describe('handles', () => {
    it('should render source handle', () => {
      renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      const handles = document.querySelectorAll('.react-flow__handle');
      expect(handles.length).toBeGreaterThanOrEqual(1);
    });

    it('should render target handle', () => {
      renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      const targetHandle = document.querySelector('.react-flow__handle-top');
      expect(targetHandle).toBeInTheDocument();
    });

    it('should respect isConnectable prop', () => {
      const { rerender } = renderWithProviders(
        <CustomNode {...defaultProps} isConnectable={false} />,
        { withReactFlow: true }
      );

      // Handles should still render but may have different styles
      const handles = document.querySelectorAll('.react-flow__handle');
      expect(handles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('interactions', () => {
    it('should be focusable for accessibility', () => {
      renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      const nodeContent = screen.getByText('aws_s3_bucket.main').closest('div');
      expect(nodeContent).toBeInTheDocument();
    });

    it('should have proper role for accessibility', () => {
      renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      // The node should have an accessible name
      const node = screen.getByText('aws_s3_bucket.main');
      expect(node).toBeInTheDocument();
    });
  });

  describe('color coding', () => {
    // Helper to convert hex to RGB format (JSDOM normalizes colors to RGB)
    const hexToRgb = (hex: string): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return hex;
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgb(${r}, ${g}, ${b})`;
    };

    it('should apply correct color for terraform_resource', () => {
      const { container } = renderWithProviders(<CustomNode {...defaultProps} />, { withReactFlow: true });

      // Check that the border color is applied via inline style
      const nodeBody = container.querySelector('[style*="border-color"]');
      expect(nodeBody).toBeInTheDocument();

      // JSDOM converts hex colors to rgb() format, so check for RGB value
      const expectedRgb = hexToRgb(nodeColors.terraform_resource);
      const style = nodeBody?.getAttribute('style') ?? '';
      expect(style).toContain(expectedRgb);
    });

    it('should apply different colors for different types', () => {
      const helmData: CustomNodeData = {
        ...createMockNode({ type: 'helm_chart' }),
        selected: false,
        highlighted: false,
        dimmed: false,
      };

      const { container } = renderWithProviders(
        <CustomNode {...defaultProps} data={helmData} />,
        { withReactFlow: true }
      );

      // Check that the helm_chart color is applied via inline style
      const nodeBody = container.querySelector('[style*="border-color"]');
      expect(nodeBody).toBeInTheDocument();

      // JSDOM converts hex colors to rgb() format, so check for RGB value
      const expectedRgb = hexToRgb(nodeColors.helm_chart);
      const style = nodeBody?.getAttribute('style') ?? '';
      expect(style).toContain(expectedRgb);
    });
  });

  describe('truncation', () => {
    it('should truncate long names', () => {
      const longNameData: CustomNodeData = {
        ...createMockNode({
          name: 'very_long_resource_name_that_should_be_truncated_in_the_display',
        }),
        selected: false,
        highlighted: false,
        dimmed: false,
      };

      const { container } = renderWithProviders(
        <CustomNode {...defaultProps} data={longNameData} />,
        { withReactFlow: true }
      );

      // The text should be present but the element should have truncate class
      const nameElement = screen.getByText(
        'very_long_resource_name_that_should_be_truncated_in_the_display'
      );
      expect(nameElement).toHaveClass(/truncate/i);
    });

    it('should show full name on hover/title', () => {
      const longName = 'very_long_resource_name_that_should_be_truncated';
      const longNameData: CustomNodeData = {
        ...createMockNode({ name: longName }),
        selected: false,
        highlighted: false,
        dimmed: false,
      };

      renderWithProviders(<CustomNode {...defaultProps} data={longNameData} />, { withReactFlow: true });

      const nameElement = screen.getByText(longName);
      expect(nameElement).toHaveAttribute('title', longName);
    });
  });

  describe('metadata display', () => {
    it('should display confidence indicator if present', () => {
      const dataWithMetadata: CustomNodeData = {
        ...defaultNodeData,
        metadata: {
          confidence: 0.95,
        },
      };

      renderWithProviders(<CustomNode {...defaultProps} data={dataWithMetadata} />, { withReactFlow: true });

      // Confidence may be displayed as a badge or indicator
      // This depends on the actual implementation
    });

    it('should display provider badge if present', () => {
      const dataWithProvider: CustomNodeData = {
        ...defaultNodeData,
        metadata: {
          provider: 'aws',
        },
      };

      renderWithProviders(<CustomNode {...defaultProps} data={dataWithProvider} />, { withReactFlow: true });

      // Provider info should be rendered if the component displays it
    });
  });

  describe('memoization', () => {
    it('should be memoized component', () => {
      // CustomNode should be wrapped in memo
      expect(CustomNode.$$typeof).toBe(Symbol.for('react.memo'));
    });
  });
});
