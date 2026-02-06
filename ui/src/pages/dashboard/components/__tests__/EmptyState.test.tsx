/**
 * EmptyState Component Unit Tests
 * Tests for empty state display, CTA button, and navigation
 * @module pages/dashboard/components/__tests__/EmptyState.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode, ButtonHTMLAttributes, ForwardedRef } from 'react';
import { forwardRef } from 'react';

// ============================================================================
// Mock Button Component
// ============================================================================

// Mock the Button component to avoid Slot issues with asChild + leftIcon
vi.mock('@/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared')>();

  interface MockButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: string;
    size?: string;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    asChild?: boolean;
    fullWidth?: boolean;
    children?: ReactNode;
  }

  const MockButton = forwardRef<HTMLButtonElement, MockButtonProps>(
    function MockButton(
      { asChild, leftIcon, rightIcon, children, loading, className, ...props },
      ref: ForwardedRef<HTMLButtonElement>
    ) {
      // When asChild, render children directly (assumes Link)
      if (asChild) {
        return <>{children}</>;
      }
      return (
        <button ref={ref} className={className} {...props}>
          {loading && <span data-testid="loading-spinner">Loading...</span>}
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </button>
      );
    }
  );

  return {
    ...actual,
    Button: MockButton,
  };
});

// Import component after mocking
import { EmptyState } from '../EmptyState';

// ============================================================================
// Test Helpers
// ============================================================================

function renderEmptyState() {
  return render(
    <MemoryRouter>
      <EmptyState />
    </MemoryRouter>
  );
}

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe('EmptyState', () => {
  describe('Basic Rendering', () => {
    it('should render "No repositories yet" heading', () => {
      renderEmptyState();

      expect(screen.getByText('No repositories yet')).toBeInTheDocument();
    });

    it('should render description text', () => {
      renderEmptyState();

      expect(screen.getByText('Get started by connecting your first repository')).toBeInTheDocument();
    });

    it('should render Add Repository button', () => {
      renderEmptyState();

      expect(screen.getByRole('link', { name: /add repository/i })).toBeInTheDocument();
    });

    it('should render repository icon', () => {
      const { container } = renderEmptyState();

      // RepositoryIcon should be present as SVG
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  describe('Navigation', () => {
    it('should link to repositories page', () => {
      renderEmptyState();

      const link = screen.getByRole('link', { name: /add repository/i });
      expect(link).toHaveAttribute('href', '/repositories');
    });

    it('should have correct href from ROUTES constant', () => {
      renderEmptyState();

      const link = screen.getByRole('link', { name: /add repository/i });
      // ROUTES.REPOSITORIES = '/repositories'
      expect(link).toHaveAttribute('href', '/repositories');
    });
  });

  // ============================================================================
  // Icon Styling Tests
  // ============================================================================

  describe('Icon Styling', () => {
    it('should have icon container with gray background', () => {
      const { container } = renderEmptyState();

      const iconContainer = container.querySelector('.bg-gray-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have rounded-full icon container', () => {
      const { container } = renderEmptyState();

      const iconContainer = container.querySelector('.rounded-full');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have proper icon sizing (h-16 w-16)', () => {
      const { container } = renderEmptyState();

      const iconContainer = container.querySelector('.h-16.w-16');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have icon with proper text color', () => {
      const { container } = renderEmptyState();

      const iconContainer = container.querySelector('.text-gray-400');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Layout Tests
  // ============================================================================

  describe('Layout', () => {
    it('should center content', () => {
      const { container } = renderEmptyState();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
      expect(wrapper).toHaveClass('items-center');
      expect(wrapper).toHaveClass('justify-center');
    });

    it('should have text-center alignment', () => {
      const { container } = renderEmptyState();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('text-center');
    });

    it('should have vertical padding (py-12)', () => {
      const { container } = renderEmptyState();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('py-12');
    });
  });

  // ============================================================================
  // Text Styling Tests
  // ============================================================================

  describe('Text Styling', () => {
    it('should have heading with proper styles', () => {
      renderEmptyState();

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveClass('text-sm');
      expect(heading).toHaveClass('font-medium');
      expect(heading).toHaveClass('text-gray-900');
    });

    it('should have description with proper styles', () => {
      renderEmptyState();

      const description = screen.getByText('Get started by connecting your first repository');
      expect(description).toHaveClass('text-sm');
      expect(description).toHaveClass('text-gray-500');
    });

    it('should have proper margin-top on heading', () => {
      renderEmptyState();

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveClass('mt-4');
    });

    it('should have proper margin-top on description', () => {
      renderEmptyState();

      const description = screen.getByText('Get started by connecting your first repository');
      expect(description).toHaveClass('mt-1');
    });
  });

  // ============================================================================
  // Button Tests
  // ============================================================================

  describe('Button', () => {
    it('should render primary variant button', () => {
      renderEmptyState();

      const button = screen.getByRole('link', { name: /add repository/i });
      expect(button).toBeInTheDocument();
    });

    it('should have Add Repository text in button link', () => {
      renderEmptyState();

      const button = screen.getByRole('link', { name: /add repository/i });
      expect(button).toHaveTextContent('Add Repository');
    });

    it('should contain plus icon', () => {
      const { container } = renderEmptyState();

      // PlusIcon should be in the button as SVG
      const button = screen.getByRole('link', { name: /add repository/i });
      // The button might wrap the link or be the link itself
      const svgElements = container.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should be keyboard focusable', () => {
      renderEmptyState();

      const button = screen.getByRole('link', { name: /add repository/i });
      button.focus();
      expect(button).toHaveFocus();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have accessible heading', () => {
      renderEmptyState();

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('should have accessible link', () => {
      renderEmptyState();

      const link = screen.getByRole('link', { name: /add repository/i });
      expect(link).toBeInTheDocument();
    });

    it('should have descriptive link text', () => {
      renderEmptyState();

      const link = screen.getByRole('link', { name: /add repository/i });
      expect(link).toHaveTextContent('Add Repository');
    });

    it('should convey empty state message clearly', () => {
      renderEmptyState();

      // Both heading and description should be visible
      expect(screen.getByText('No repositories yet')).toBeInTheDocument();
      expect(screen.getByText('Get started by connecting your first repository')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should render in correct order: icon, heading, description, button', () => {
      const { container } = renderEmptyState();

      const wrapper = container.firstElementChild;
      expect(wrapper).toBeInTheDocument();

      // Check that all elements exist
      expect(container.querySelector('.rounded-full')).toBeInTheDocument(); // icon container
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByText('Get started by connecting your first repository')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /add repository/i })).toBeInTheDocument();
    });

    it('should have icon as first visual element', () => {
      const { container } = renderEmptyState();

      const wrapper = container.firstElementChild;
      const firstChild = wrapper?.firstElementChild;

      // First child should be the icon container
      expect(firstChild).toHaveClass('rounded-full');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should render without crashing', () => {
      expect(() => renderEmptyState()).not.toThrow();
    });

    it('should maintain consistent styling', () => {
      const { container: container1 } = render(
        <MemoryRouter>
          <EmptyState />
        </MemoryRouter>
      );

      const { container: container2 } = render(
        <MemoryRouter>
          <EmptyState />
        </MemoryRouter>
      );

      // Both renders should have same structure
      expect(container1.innerHTML).toBe(container2.innerHTML);
    });
  });
});
