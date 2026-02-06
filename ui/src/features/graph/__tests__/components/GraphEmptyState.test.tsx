/**
 * GraphEmptyState Component Tests
 * Tests for the empty state component
 * @module features/graph/__tests__/components/GraphEmptyState.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphEmptyState } from '../../components/GraphEmptyState';
import { renderWithProviders } from '../utils/testUtils';

// Mock cn utility
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) =>
    classes.filter(Boolean).join(' '),
}));

// Mock shared components - need to handle leftIcon prop properly
vi.mock('@/shared', () => ({
  Button: vi.fn(({ children, onClick, variant, leftIcon, asChild, ...props }) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {leftIcon}
      {children}
    </button>
  )),
}));

// Mock @/core for ROUTES
vi.mock('@/core', () => ({
  ROUTES: {
    SCANS: '/scans',
    NEW_SCAN: '/scans/new',
  },
}));

describe('GraphEmptyState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render empty state container', () => {
      const { container } = renderWithProviders(<GraphEmptyState />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render default title', () => {
      renderWithProviders(<GraphEmptyState />);

      expect(screen.getByText('No dependencies found')).toBeInTheDocument();
    });

    it('should render custom title', () => {
      renderWithProviders(<GraphEmptyState title="No Resources Found" />);

      expect(screen.getByText('No Resources Found')).toBeInTheDocument();
    });

    it('should render custom message', () => {
      renderWithProviders(
        <GraphEmptyState message="Try adjusting your filters" />
      );

      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
    });

    it('should render default message when not provided', () => {
      renderWithProviders(<GraphEmptyState />);

      expect(screen.getByText(/did not detect any dependency relationships/i)).toBeInTheDocument();
    });
  });

  describe('icons and illustrations', () => {
    it('should render graph icon', () => {
      const { container } = renderWithProviders(<GraphEmptyState />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('should render action button when onAction is provided', () => {
      renderWithProviders(
        <GraphEmptyState
          actionLabel="Reset Filters"
          onAction={() => {}}
        />
      );

      expect(
        screen.getByRole('button', { name: /reset filters/i })
      ).toBeInTheDocument();
    });

    it('should call onAction when button is clicked', async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <GraphEmptyState actionLabel="Reset Filters" onAction={onAction} />
      );

      await user.click(screen.getByRole('button', { name: /reset filters/i }));

      expect(onAction).toHaveBeenCalled();
    });

    it('should render link to new scan when no onAction provided', () => {
      renderWithProviders(<GraphEmptyState />);

      // Without onAction, it renders a Link instead of a Button
      expect(screen.getByRole('link', { name: /run new scan/i })).toBeInTheDocument();
    });

    it('should use custom action label', () => {
      renderWithProviders(
        <GraphEmptyState actionLabel="Start Analysis" onAction={() => {}} />
      );

      expect(screen.getByRole('button', { name: /start analysis/i })).toBeInTheDocument();
    });
  });

  describe('suggestions section', () => {
    it('should show possible reasons list', () => {
      renderWithProviders(<GraphEmptyState />);

      expect(screen.getByText('Possible reasons:')).toBeInTheDocument();
    });

    it('should list supported file types', () => {
      renderWithProviders(<GraphEmptyState />);

      expect(screen.getByText(/terraform, helm, kubernetes/i)).toBeInTheDocument();
    });

    it('should mention parsing errors', () => {
      renderWithProviders(<GraphEmptyState />);

      expect(screen.getByText(/parsing errors/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have status role', () => {
      renderWithProviders(<GraphEmptyState />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label', () => {
      renderWithProviders(<GraphEmptyState />);

      expect(screen.getByLabelText('Empty graph')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      const { container } = renderWithProviders(
        <GraphEmptyState className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should have centered layout', () => {
      const { container } = renderWithProviders(<GraphEmptyState />);

      expect(container.firstChild).toHaveClass('items-center');
      expect(container.firstChild).toHaveClass('justify-center');
    });
  });
});
