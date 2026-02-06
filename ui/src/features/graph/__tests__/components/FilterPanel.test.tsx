/**
 * FilterPanel Component Tests
 * Tests for the graph filter panel component
 * @module features/graph/__tests__/components/FilterPanel.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from '../../components/FilterPanel';
import { renderWithProviders, createMockFilters } from '../utils/testUtils';
import { nodeTypeLabels } from '../../types';
import type { GraphFilters, GraphNodeType } from '../../types';

// All node types as defined in the component
const ALL_NODE_TYPES: GraphNodeType[] = [
  'terraform_resource',
  'terraform_module',
  'terraform_data_source',
  'helm_chart',
  'k8s_resource',
  'external_reference',
];

// Mock shared components
vi.mock('@/shared/components', () => ({
  Button: vi.fn(({ children, onClick, variant, size, className, ...props }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  )),
  Badge: vi.fn(({ children, ...props }) => <span {...props}>{children}</span>),
}));

describe('FilterPanel', () => {
  const defaultFilters = createMockFilters();
  const onFilterChange = vi.fn();
  const onReset = vi.fn();

  const defaultProps = {
    filters: defaultFilters,
    onFilterChange,
    onReset,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to expand the filter panel
  const expandPanel = async (user: ReturnType<typeof userEvent.setup>) => {
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);
  };

  describe('rendering', () => {
    it('should render filter panel header', () => {
      renderWithProviders(<FilterPanel {...defaultProps} />);

      expect(screen.getByText(/filters/i)).toBeInTheDocument();
    });

    it('should render all node type checkboxes when expanded', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FilterPanel {...defaultProps} />);

      await expandPanel(user);

      ALL_NODE_TYPES.forEach((type) => {
        expect(screen.getByText(nodeTypeLabels[type])).toBeInTheDocument();
      });
    });

    it('should render blast radius toggle when expanded', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FilterPanel {...defaultProps} />);

      await expandPanel(user);

      expect(screen.getByText(/blast radius/i)).toBeInTheDocument();
      expect(screen.getByText(/highlight impact area/i)).toBeInTheDocument();
    });

    it('should render reset button when filters are active', async () => {
      const user = userEvent.setup();
      // Filter with fewer than all node types selected to trigger hasActiveFilters
      const filters = createMockFilters({
        nodeTypes: ['terraform_resource'],
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument();
    });

    it('should not render reset button when onReset is not provided', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({
        nodeTypes: ['terraform_resource'],
      });

      renderWithProviders(
        <FilterPanel filters={filters} onFilterChange={onFilterChange} />
      );

      await expandPanel(user);

      expect(screen.queryByRole('button', { name: /reset filters/i })).not.toBeInTheDocument();
    });
  });

  describe('node type filters', () => {
    it('should show checked state for active node types', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({
        nodeTypes: ['terraform_resource', 'helm_chart'],
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      // Find the labels for node types
      const terraformLabel = screen.getByText(nodeTypeLabels.terraform_resource).closest('label');
      const helmLabel = screen.getByText(nodeTypeLabels.helm_chart).closest('label');
      const moduleLabel = screen.getByText(nodeTypeLabels.terraform_module).closest('label');

      // Get the checkboxes within the labels
      const terraformCheckbox = terraformLabel?.querySelector('input[type="checkbox"]');
      const helmCheckbox = helmLabel?.querySelector('input[type="checkbox"]');
      const moduleCheckbox = moduleLabel?.querySelector('input[type="checkbox"]');

      expect(terraformCheckbox).toBeChecked();
      expect(helmCheckbox).toBeChecked();
      expect(moduleCheckbox).not.toBeChecked();
    });

    it('should call onFilterChange when checkbox label is clicked', async () => {
      const user = userEvent.setup();
      // Start with all types except the one we'll click
      const filters = createMockFilters({
        nodeTypes: ALL_NODE_TYPES.filter(t => t !== 'terraform_resource'),
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      // Click on the label to toggle the checkbox
      const label = screen.getByText(nodeTypeLabels.terraform_resource).closest('label');
      await user.click(label!);

      expect(onFilterChange).toHaveBeenCalledWith({
        ...filters,
        nodeTypes: expect.arrayContaining(['terraform_resource']),
      });
    });

    it('should not allow deselecting the last node type', async () => {
      const user = userEvent.setup();
      // Only one node type selected
      const filters = createMockFilters({
        nodeTypes: ['terraform_resource'],
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      // Try to click on the only selected type
      const label = screen.getByText(nodeTypeLabels.terraform_resource).closest('label');
      await user.click(label!);

      // Should not have been called since it's the last type
      expect(onFilterChange).not.toHaveBeenCalled();
    });

    it('should show count badge when some types are hidden', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({
        nodeTypes: ['terraform_resource'],
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      // Badge should be visible in the header (before expanding)
      expect(screen.getByText(`1/${ALL_NODE_TYPES.length}`)).toBeInTheDocument();
    });
  });

  describe('blast radius toggle', () => {
    it('should show blast radius as off by default', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({ showBlastRadius: false });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      const blastToggle = screen.getByText(/blast radius/i).closest('label');
      const checkbox = blastToggle?.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeChecked();
    });

    it('should show blast radius as on when enabled', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({ showBlastRadius: true });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      const blastToggle = screen.getByText(/blast radius/i).closest('label');
      const checkbox = blastToggle?.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeChecked();
    });

    it('should call onFilterChange when blast radius is toggled', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({ showBlastRadius: false });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      const blastToggle = screen.getByText(/blast radius/i).closest('label');
      await user.click(blastToggle!);

      expect(onFilterChange).toHaveBeenCalledWith({
        ...filters,
        showBlastRadius: true,
      });
    });
  });

  describe('reset functionality', () => {
    it('should call onReset when reset button is clicked', async () => {
      const user = userEvent.setup();
      // Need active filters to show reset button
      const filters = createMockFilters({
        nodeTypes: ['terraform_resource'],
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      await user.click(screen.getByRole('button', { name: /reset filters/i }));

      expect(onReset).toHaveBeenCalled();
    });

    it('should not show reset when all types selected and blast radius off', async () => {
      const user = userEvent.setup();
      // Default filters = all node types and showBlastRadius: false
      const filters = createMockFilters({
        nodeTypes: ALL_NODE_TYPES,
        showBlastRadius: false,
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      // Reset button should not be present
      expect(screen.queryByRole('button', { name: /reset filters/i })).not.toBeInTheDocument();
    });

    it('should show reset when blast radius is enabled', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({
        nodeTypes: ALL_NODE_TYPES,
        showBlastRadius: true,
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument();
    });
  });

  describe('select all functionality', () => {
    it('should show select all option when not all types are selected', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({ nodeTypes: ['terraform_resource'] });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      expect(screen.getByText(/select all/i)).toBeInTheDocument();
    });

    it('should call onFilterChange with all types when select all is clicked', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({ nodeTypes: ['terraform_resource'] });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      await user.click(screen.getByText(/select all/i));

      expect(onFilterChange).toHaveBeenCalledWith({
        ...filters,
        nodeTypes: ALL_NODE_TYPES,
      });
    });

    it('should not show select all when all types are selected', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({ nodeTypes: ALL_NODE_TYPES });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
    });
  });

  describe('collapsed state', () => {
    it('should start collapsed by default', () => {
      renderWithProviders(<FilterPanel {...defaultProps} />);

      // Content should not be visible
      expect(screen.queryByText(/node types/i)).not.toBeInTheDocument();
    });

    it('should expand when header button is clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<FilterPanel {...defaultProps} />);

      await expandPanel(user);

      // Content should now be visible
      expect(screen.getByText(/node types/i)).toBeInTheDocument();
    });

    it('should collapse when header button is clicked again', async () => {
      const user = userEvent.setup();

      renderWithProviders(<FilterPanel {...defaultProps} />);

      // Expand
      await expandPanel(user);
      expect(screen.getByText(/node types/i)).toBeInTheDocument();

      // Collapse
      await expandPanel(user);
      expect(screen.queryByText(/node types/i)).not.toBeInTheDocument();
    });
  });

  describe('node type groups', () => {
    it('should display node type section header', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FilterPanel {...defaultProps} />);

      await expandPanel(user);

      expect(screen.getByText(/node types/i)).toBeInTheDocument();
    });

    it('should display terraform-related node types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FilterPanel {...defaultProps} />);

      await expandPanel(user);

      expect(screen.getByText(nodeTypeLabels.terraform_resource)).toBeInTheDocument();
      expect(screen.getByText(nodeTypeLabels.terraform_module)).toBeInTheDocument();
      expect(screen.getByText(nodeTypeLabels.terraform_data_source)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have clickable labels that toggle checkboxes', async () => {
      const user = userEvent.setup();
      // Start with helm_chart not selected
      const filters = createMockFilters({
        nodeTypes: ALL_NODE_TYPES.filter(t => t !== 'helm_chart'),
      });

      renderWithProviders(<FilterPanel {...defaultProps} filters={filters} />);

      await expandPanel(user);

      const label = screen.getByText(nodeTypeLabels.helm_chart).closest('label');
      expect(label).toBeInTheDocument();

      await user.click(label!);

      expect(onFilterChange).toHaveBeenCalled();
    });

    it('should support keyboard navigation to expand panel', async () => {
      const user = userEvent.setup();

      renderWithProviders(<FilterPanel {...defaultProps} />);

      // Focus the toggle button
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      toggleButton.focus();

      // Press Enter to expand
      await user.keyboard('{Enter}');

      // Panel should be expanded
      expect(screen.getByText(/node types/i)).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithProviders(
        <FilterPanel {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
