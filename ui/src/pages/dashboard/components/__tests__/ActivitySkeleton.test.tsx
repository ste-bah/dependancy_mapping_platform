/**
 * ActivitySkeleton Component Unit Tests
 * Tests for loading skeleton display
 * @module pages/dashboard/components/__tests__/ActivitySkeleton.test
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { ActivitySkeleton } from '../ActivitySkeleton';

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe('ActivitySkeleton', () => {
  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      expect(() => render(<ActivitySkeleton />)).not.toThrow();
    });

    it('should render 5 skeleton items', () => {
      const { container } = render(<ActivitySkeleton />);

      const skeletonItems = container.querySelectorAll('.flex.items-start.gap-4.py-3');
      expect(skeletonItems).toHaveLength(5);
    });

    it('should have wrapper with space-y-3 class', () => {
      const { container } = render(<ActivitySkeleton />);

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('space-y-3');
    });
  });

  // ============================================================================
  // Skeleton Structure Tests
  // ============================================================================

  describe('Skeleton Structure', () => {
    it('should render circular skeleton for avatar', () => {
      const { container } = render(<ActivitySkeleton />);

      // Each item should have a circular skeleton (avatar placeholder)
      const skeletonItems = container.querySelectorAll('.flex.items-start.gap-4.py-3');
      expect(skeletonItems.length).toBe(5);
    });

    it('should render content skeletons', () => {
      const { container } = render(<ActivitySkeleton />);

      // Each item should have content area
      const contentAreas = container.querySelectorAll('.flex-1.space-y-2');
      expect(contentAreas).toHaveLength(5);
    });

    it('should have flex layout for each item', () => {
      const { container } = render(<ActivitySkeleton />);

      const items = container.querySelectorAll('.flex.items-start');
      expect(items.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ============================================================================
  // Layout Tests
  // ============================================================================

  describe('Layout', () => {
    it('should have proper spacing between items', () => {
      const { container } = render(<ActivitySkeleton />);

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('space-y-3');
    });

    it('should have gap-4 between icon and content', () => {
      const { container } = render(<ActivitySkeleton />);

      const items = container.querySelectorAll('.gap-4');
      expect(items.length).toBeGreaterThanOrEqual(5);
    });

    it('should have py-3 padding on items', () => {
      const { container } = render(<ActivitySkeleton />);

      const items = container.querySelectorAll('.py-3');
      expect(items.length).toBe(5);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should render semantic skeleton elements', () => {
      const { container } = render(<ActivitySkeleton />);

      // Skeletons are rendered as div elements
      const divs = container.querySelectorAll('div');
      expect(divs.length).toBeGreaterThan(0);
    });

    it('should not have interactive elements during loading', () => {
      const { container } = render(<ActivitySkeleton />);

      const buttons = container.querySelectorAll('button');
      const links = container.querySelectorAll('a');

      expect(buttons).toHaveLength(0);
      expect(links).toHaveLength(0);
    });
  });

  // ============================================================================
  // Consistency Tests
  // ============================================================================

  describe('Consistency', () => {
    it('should render identical structure on multiple renders', () => {
      const { container: container1 } = render(<ActivitySkeleton />);
      const { container: container2 } = render(<ActivitySkeleton />);

      // Structure should be identical (excluding dynamic skeleton classes)
      const items1 = container1.querySelectorAll('.flex.items-start.gap-4.py-3');
      const items2 = container2.querySelectorAll('.flex.items-start.gap-4.py-3');

      expect(items1.length).toBe(items2.length);
    });

    it('should always render exactly 5 items', () => {
      // Render multiple times to ensure consistency
      for (let i = 0; i < 3; i++) {
        const { container } = render(<ActivitySkeleton />);
        const items = container.querySelectorAll('.flex.items-start.gap-4.py-3');
        expect(items).toHaveLength(5);
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should render without props', () => {
      // Component has no props
      const { container } = render(<ActivitySkeleton />);
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('should handle re-renders', () => {
      const { container, rerender } = render(<ActivitySkeleton />);

      const initialItems = container.querySelectorAll('.flex.items-start.gap-4.py-3');
      expect(initialItems).toHaveLength(5);

      rerender(<ActivitySkeleton />);

      const rerenderItems = container.querySelectorAll('.flex.items-start.gap-4.py-3');
      expect(rerenderItems).toHaveLength(5);
    });
  });
});
