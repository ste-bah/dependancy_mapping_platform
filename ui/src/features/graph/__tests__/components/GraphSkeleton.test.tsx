/**
 * GraphSkeleton Component Tests
 * Tests for the loading skeleton component
 * @module features/graph/__tests__/components/GraphSkeleton.test
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { GraphSkeleton } from '../../components/GraphSkeleton';
import { renderWithProviders } from '../utils/testUtils';

// Mock shared utils - must include all exports used by components
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) =>
    classes.filter(Boolean).join(' '),
  createVariants: (config: { base?: string; variants?: Record<string, Record<string, string>>; defaultVariants?: Record<string, string> }) => {
    return (props: Record<string, string> = {}) => {
      const classes: string[] = [];
      if (config.base) classes.push(config.base);
      if (config.variants) {
        for (const [key, variants] of Object.entries(config.variants)) {
          const value = props[key] ?? config.defaultVariants?.[key];
          if (value && variants[value]) {
            classes.push(variants[value]);
          }
        }
      }
      return classes.filter(Boolean).join(' ');
    };
  },
  focusRing: () => 'focus:outline-none focus:ring-2',
  disabledClasses: () => 'disabled:opacity-50',
  componentClasses: (base: string, className?: string) => className ? `${base} ${className}` : base,
}));

// Mock Skeleton component
vi.mock('@/shared', () => ({
  Skeleton: ({ width, height, variant, circle }: { width?: number | string; height?: number | string; variant?: string; circle?: boolean }) => (
    <div
      data-testid="skeleton"
      aria-hidden="true"
      className={`bg-gray-200 ${circle ? 'rounded-full' : variant === 'rounded' ? 'rounded-lg' : 'rounded'} animate-pulse`}
      style={{ width: typeof width === 'number' ? `${width}px` : width, height: typeof height === 'number' ? `${height}px` : height }}
    />
  ),
}));

describe('GraphSkeleton', () => {
  describe('rendering', () => {
    it('should render skeleton container', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render skeleton elements', () => {
      renderWithProviders(<GraphSkeleton />);

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('animation', () => {
    it('should have animation classes', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      // Skeleton elements should have pulse animation
      expect(container.innerHTML).toContain('animate-pulse');
    });
  });

  describe('layout', () => {
    it('should fill container with w-full and h-full', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      expect(container.firstChild).toHaveClass('w-full');
      expect(container.firstChild).toHaveClass('h-full');
    });

    it('should apply custom className', () => {
      const { container } = renderWithProviders(
        <GraphSkeleton className="custom-skeleton" />
      );

      expect(container.firstChild).toHaveClass('custom-skeleton');
    });
  });

  describe('filters panel skeleton', () => {
    it('should show filters skeleton when showFilters is true (default)', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      // Filter panel is shown by default - check for filter-related structure
      // The filter skeleton has specific structure with skeleton elements
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(5);
    });

    it('should hide filters skeleton when showFilters is false', () => {
      const beforeRender = renderWithProviders(<GraphSkeleton showFilters />);
      const countWithFilters = beforeRender.container.querySelectorAll('[data-testid="skeleton"]').length;
      beforeRender.unmount();

      const afterRender = renderWithProviders(<GraphSkeleton showFilters={false} />);
      const countWithoutFilters = afterRender.container.querySelectorAll('[data-testid="skeleton"]').length;

      expect(countWithoutFilters).toBeLessThan(countWithFilters);
    });
  });

  describe('search bar skeleton', () => {
    it('should show search skeleton when showSearch is true (default)', () => {
      renderWithProviders(<GraphSkeleton showSearch />);

      // Search bar has a skeleton inside
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should hide search skeleton when showSearch is false', () => {
      const beforeRender = renderWithProviders(<GraphSkeleton showSearch />);
      const countWithSearch = beforeRender.container.querySelectorAll('[data-testid="skeleton"]').length;
      beforeRender.unmount();

      const afterRender = renderWithProviders(<GraphSkeleton showSearch={false} />);
      const countWithoutSearch = afterRender.container.querySelectorAll('[data-testid="skeleton"]').length;

      expect(countWithoutSearch).toBeLessThan(countWithSearch);
    });
  });

  describe('minimap skeleton', () => {
    it('should show minimap skeleton when showMinimap is true (default)', () => {
      const { container } = renderWithProviders(<GraphSkeleton showMinimap />);

      // Minimap is rendered at bottom-left
      expect(container.querySelector('.bottom-4.left-4')).toBeInTheDocument();
    });

    it('should hide minimap skeleton when showMinimap is false', () => {
      const beforeRender = renderWithProviders(<GraphSkeleton showMinimap />);
      const countWithMinimap = beforeRender.container.querySelectorAll('[data-testid="skeleton"]').length;
      beforeRender.unmount();

      const afterRender = renderWithProviders(<GraphSkeleton showMinimap={false} />);
      const countWithoutMinimap = afterRender.container.querySelectorAll('[data-testid="skeleton"]').length;

      expect(countWithoutMinimap).toBeLessThan(countWithMinimap);
    });
  });

  describe('accessibility', () => {
    it('should have role="status"', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      expect(container.firstChild).toHaveAttribute('role', 'status');
    });

    it('should have aria-label', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      expect(container.firstChild).toHaveAttribute('aria-label', 'Loading graph...');
    });

    it('should have screen reader text', () => {
      renderWithProviders(<GraphSkeleton />);

      // There should be a sr-only element with loading text
      const srOnly = document.querySelector('.sr-only');
      expect(srOnly).toBeInTheDocument();
      expect(srOnly).toHaveTextContent(/loading/i);
    });
  });

  describe('background', () => {
    it('should render dots pattern background', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      // Background should have radial-gradient pattern
      expect(container.innerHTML).toContain('radial-gradient');
    });
  });

  describe('node skeletons', () => {
    it('should render node skeleton elements in the center area', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      // The component renders GraphNodeSkeleton components in various positions
      // They are positioned absolutely within a relative container
      const centralContainer = container.querySelector('.relative.w-\\[600px\\].h-\\[400px\\]');
      expect(centralContainer).toBeInTheDocument();
    });

    it('should render different size node skeletons', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      // There should be lg, md, and sm node skeletons
      expect(container.innerHTML).toContain('w-40'); // lg
      expect(container.innerHTML).toContain('w-32'); // md
      expect(container.innerHTML).toContain('w-24'); // sm
    });
  });

  describe('controls skeleton', () => {
    it('should render controls skeleton at bottom-right', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      const controlsArea = container.querySelector('.bottom-4.right-4');
      expect(controlsArea).toBeInTheDocument();
    });
  });

  describe('responsive behavior', () => {
    it('should adapt to container size', () => {
      const { container } = renderWithProviders(<GraphSkeleton />);

      expect(container.firstChild).toHaveClass('w-full', 'h-full');
    });
  });
});
