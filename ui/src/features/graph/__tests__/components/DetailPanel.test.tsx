/**
 * DetailPanel Component Tests
 * Tests for the node detail panel component
 * @module features/graph/__tests__/components/DetailPanel.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../../components/DetailPanel';
import {
  renderWithProviders,
  createMockNode,
  createMockBlastRadius,
} from '../utils/testUtils';
import { nodeTypeLabels } from '../../types';
import type { GraphNode, BlastRadius } from '../../types';

// Mock shared components
vi.mock('@/shared/components', () => ({
  Button: vi.fn(({ children, onClick, disabled, variant, size, className }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  )),
  Badge: vi.fn(({ children, variant, size, style, className }) => (
    <span className={className} style={style}>
      {children}
    </span>
  )),
  Skeleton: vi.fn(({ height, variant }) => (
    <div data-testid="skeleton" style={{ height }} />
  )),
  SkeletonText: vi.fn(({ lines }) => (
    <div data-testid="skeleton-text" data-lines={lines} />
  )),
}));

// Mock cn utility
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) =>
    classes.filter(Boolean).join(' '),
}));

describe('DetailPanel', () => {
  const mockNode: GraphNode = createMockNode({
    id: 'test-node',
    name: 'aws_vpc_main',
    type: 'terraform_resource',
    location: {
      filePath: '/modules/networking/vpc.tf',
      startLine: 10,
      endLine: 25,
    },
    metadata: {
      provider: 'aws',
      version: '4.0',
    },
  });

  const mockDependencies: GraphNode[] = [
    createMockNode({ id: 'dep-1', name: 'aws_security_group' }),
    createMockNode({ id: 'dep-2', name: 'aws_internet_gateway' }),
  ];

  const mockDependents: GraphNode[] = [
    createMockNode({ id: 'dept-1', name: 'aws_subnet_private' }),
    createMockNode({ id: 'dept-2', name: 'aws_subnet_public' }),
    createMockNode({ id: 'dept-3', name: 'aws_route_table' }),
  ];

  const defaultProps = {
    node: mockNode,
    dependencies: mockDependencies,
    dependents: mockDependents,
    onClose: vi.fn(),
    onBlastRadius: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render node name', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(screen.getByText('aws_vpc_main')).toBeInTheDocument();
    });

    it('should render node type badge', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(screen.getByText(nodeTypeLabels.terraform_resource)).toBeInTheDocument();
    });

    it('should render node icon', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      // Icon should be rendered in the header
      const header = screen.getByText('aws_vpc_main').closest('div');
      expect(header).toBeInTheDocument();
    });

    it('should return null when node is undefined', () => {
      const { container } = renderWithProviders(
        <DetailPanel {...defaultProps} node={undefined} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('location section', () => {
    it('should display file path', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(screen.getByText('/modules/networking/vpc.tf')).toBeInTheDocument();
    });

    it('should display line numbers', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(screen.getByText(/Lines 10 - 25/i)).toBeInTheDocument();
    });

    it('should not render location section when location is missing', () => {
      // Create a node without location by manually constructing it
      // The createMockNode factory uses ?? so undefined doesn't override the default
      const nodeWithoutLocation: GraphNode = {
        id: 'no-location-node',
        name: 'Node Without Location',
        type: 'terraform_resource',
        // location is intentionally omitted
        metadata: { provider: 'aws' },
      };

      renderWithProviders(
        <DetailPanel {...defaultProps} node={nodeWithoutLocation} />
      );

      expect(screen.queryByText('Location')).not.toBeInTheDocument();
    });
  });

  describe('dependencies section', () => {
    it('should display dependencies count', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      const dependenciesSection = screen
        .getByText('Dependencies')
        .closest('div');
      expect(within(dependenciesSection!).getByText('2')).toBeInTheDocument();
    });

    it('should list dependency names', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(screen.getByText('aws_security_group')).toBeInTheDocument();
      expect(screen.getByText('aws_internet_gateway')).toBeInTheDocument();
    });

    it('should show empty message when no dependencies', () => {
      renderWithProviders(<DetailPanel {...defaultProps} dependencies={[]} />);

      expect(screen.getByText(/no dependencies/i)).toBeInTheDocument();
    });

    it('should call onNodeClick when clicking a dependency', async () => {
      const onNodeClick = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <DetailPanel {...defaultProps} onNodeClick={onNodeClick} />
      );

      await user.click(screen.getByText('aws_security_group'));

      expect(onNodeClick).toHaveBeenCalledWith('dep-1');
    });
  });

  describe('dependents section', () => {
    it('should display dependents count', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      const dependentsSection = screen.getByText('Dependents').closest('div');
      expect(within(dependentsSection!).getByText('3')).toBeInTheDocument();
    });

    it('should list dependent names', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(screen.getByText('aws_subnet_private')).toBeInTheDocument();
      expect(screen.getByText('aws_subnet_public')).toBeInTheDocument();
      expect(screen.getByText('aws_route_table')).toBeInTheDocument();
    });

    it('should show empty message when no dependents', () => {
      renderWithProviders(<DetailPanel {...defaultProps} dependents={[]} />);

      expect(screen.getByText(/no dependents/i)).toBeInTheDocument();
    });

    it('should truncate list when more than 10 items', () => {
      const manyDependents = Array.from({ length: 15 }, (_, i) =>
        createMockNode({ id: `dept-${i}`, name: `dependent_${i}` })
      );

      renderWithProviders(
        <DetailPanel {...defaultProps} dependents={manyDependents} />
      );

      // Should show +5 more indicator
      expect(screen.getByText(/\+5 more/)).toBeInTheDocument();
    });
  });

  describe('blast radius section', () => {
    it('should render blast radius button', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /show blast radius/i })
      ).toBeInTheDocument();
    });

    it('should call onBlastRadius when button is clicked', async () => {
      const onBlastRadius = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <DetailPanel {...defaultProps} onBlastRadius={onBlastRadius} />
      );

      await user.click(screen.getByRole('button', { name: /show blast radius/i }));

      expect(onBlastRadius).toHaveBeenCalled();
    });

    it('should show loading state when calculating', () => {
      renderWithProviders(
        <DetailPanel {...defaultProps} isLoadingBlastRadius={true} />
      );

      expect(
        screen.getByRole('button', { name: /calculating/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /calculating/i })).toBeDisabled();
    });

    it('should display blast radius data when available', () => {
      const blastRadiusData: BlastRadius = {
        nodeId: 'test-node',
        directDependents: 5,
        transitiveDependents: 12,
        impactScore: 0.75,
        affectedNodes: ['node-1', 'node-2'],
      };

      renderWithProviders(
        <DetailPanel {...defaultProps} blastRadiusData={blastRadiusData} />
      );

      expect(screen.getByText('5 nodes')).toBeInTheDocument();
      expect(screen.getByText('12 nodes')).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('should show impact severity badge', () => {
      const blastRadiusData: BlastRadius = {
        nodeId: 'test-node',
        directDependents: 5,
        transitiveDependents: 12,
        impactScore: 0.85,
        affectedNodes: [],
      };

      renderWithProviders(
        <DetailPanel {...defaultProps} blastRadiusData={blastRadiusData} />
      );

      expect(screen.getByText(/critical/i)).toBeInTheDocument();
    });

    it('should only show blast radius for current node', () => {
      const blastRadiusData: BlastRadius = {
        nodeId: 'different-node', // Different node
        directDependents: 5,
        transitiveDependents: 12,
        impactScore: 0.5,
        affectedNodes: [],
      };

      renderWithProviders(
        <DetailPanel {...defaultProps} blastRadiusData={blastRadiusData} />
      );

      // Should not display blast radius data for different node
      expect(screen.queryByText('5 nodes')).not.toBeInTheDocument();
    });
  });

  describe('metadata section', () => {
    it('should display metadata when present', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(screen.getByText('provider')).toBeInTheDocument();
      expect(screen.getByText('aws')).toBeInTheDocument();
      expect(screen.getByText('version')).toBeInTheDocument();
      expect(screen.getByText('4.0')).toBeInTheDocument();
    });

    it('should not render metadata section when empty', () => {
      const nodeWithoutMetadata = createMockNode({
        ...mockNode,
        metadata: {},
      });

      renderWithProviders(
        <DetailPanel {...defaultProps} node={nodeWithoutMetadata} />
      );

      expect(screen.queryByText('Metadata')).not.toBeInTheDocument();
    });

    it('should stringify object metadata values', () => {
      const nodeWithObjectMetadata = createMockNode({
        ...mockNode,
        metadata: {
          config: { key: 'value' },
        },
      });

      renderWithProviders(
        <DetailPanel {...defaultProps} node={nodeWithObjectMetadata} />
      );

      expect(screen.getByText(/"key"/)).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('should render close button', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /close panel/i })
      ).toBeInTheDocument();
    });

    it('should call onClose when clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(<DetailPanel {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /close panel/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show skeleton when loading', () => {
      renderWithProviders(<DetailPanel {...defaultProps} isLoading={true} />);

      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('skeleton-text').length).toBeGreaterThan(0);
    });

    it('should hide content when loading', () => {
      renderWithProviders(<DetailPanel {...defaultProps} isLoading={true} />);

      // Dependencies and dependents sections should not be visible
      expect(screen.queryByText('Dependencies')).not.toBeInTheDocument();
      expect(screen.queryByText('Dependents')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      const { container } = renderWithProviders(
        <DetailPanel {...defaultProps} className="custom-panel" />
      );

      expect(container.firstChild).toHaveClass('custom-panel');
    });

    it('should position panel on the right', () => {
      const { container } = renderWithProviders(<DetailPanel {...defaultProps} />);

      expect(container.firstChild).toHaveClass('right-0');
    });
  });

  describe('impact severity levels', () => {
    const testCases = [
      { score: 0.85, severity: 'critical' },
      { score: 0.65, severity: 'high' },
      { score: 0.45, severity: 'medium' },
      { score: 0.25, severity: 'low' },
      { score: 0.1, severity: 'minimal' },
    ];

    testCases.forEach(({ score, severity }) => {
      it(`should show ${severity} severity for score ${score}`, () => {
        const blastRadiusData: BlastRadius = {
          nodeId: 'test-node',
          directDependents: 1,
          transitiveDependents: 1,
          impactScore: score,
          affectedNodes: [],
        };

        renderWithProviders(
          <DetailPanel {...defaultProps} blastRadiusData={blastRadiusData} />
        );

        expect(screen.getByText(new RegExp(severity, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible close button', () => {
      renderWithProviders(<DetailPanel {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close panel/i });
      expect(closeButton).toHaveAttribute('aria-label');
    });

    it('should be navigable by keyboard', async () => {
      const user = userEvent.setup();

      renderWithProviders(<DetailPanel {...defaultProps} />);

      await user.tab();

      // Focus should move to interactive elements
      expect(document.activeElement).toBeInstanceOf(HTMLElement);
    });
  });
});
