/**
 * ActivityItem Component Unit Tests
 * Tests for activity display, status badges, icons, and timestamps
 * @module pages/dashboard/components/__tests__/ActivityItem.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ActivityItem, type ActivityItemProps, type ActivityType, type ActivityStatus } from '../ActivityItem';

// ============================================================================
// Test Helpers
// ============================================================================

const defaultProps: ActivityItemProps = {
  type: 'scan',
  title: 'Scan completed for test-repo',
  description: 'Full dependency scan',
  timestamp: '5 min ago',
};

function renderActivityItem(props: Partial<ActivityItemProps> = {}) {
  return render(<ActivityItem {...defaultProps} {...props} />);
}

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe('ActivityItem', () => {
  describe('Basic Rendering', () => {
    it('should render title correctly', () => {
      renderActivityItem({ title: 'Repository added' });

      expect(screen.getByText('Repository added')).toBeInTheDocument();
    });

    it('should render description correctly', () => {
      renderActivityItem({ description: 'New repository connected' });

      expect(screen.getByText('New repository connected')).toBeInTheDocument();
    });

    it('should render timestamp correctly', () => {
      renderActivityItem({ timestamp: '2 hours ago' });

      expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    });

    it('should render all content together', () => {
      renderActivityItem({
        title: 'Scan failed',
        description: 'Parse error occurred',
        timestamp: 'Yesterday',
      });

      expect(screen.getByText('Scan failed')).toBeInTheDocument();
      expect(screen.getByText('Parse error occurred')).toBeInTheDocument();
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Activity Type Icon Tests
  // ============================================================================

  describe('Activity Type Icons', () => {
    it('should render scan icon for scan type', () => {
      const { container } = renderActivityItem({ type: 'scan' });

      // Should contain an SVG icon
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render repository icon for repository type', () => {
      const { container } = renderActivityItem({ type: 'repository' });

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render dependency icon for dependency type', () => {
      const { container } = renderActivityItem({ type: 'dependency' });

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have icon container with proper styling', () => {
      const { container } = renderActivityItem();

      const iconContainer = container.querySelector('.h-8.w-8');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass('rounded-full');
    });
  });

  // ============================================================================
  // Status Badge Tests
  // ============================================================================

  describe('Status Badge', () => {
    it('should render success status badge', () => {
      renderActivityItem({ status: 'success' });

      expect(screen.getByText('success')).toBeInTheDocument();
    });

    it('should render pending status badge', () => {
      renderActivityItem({ status: 'pending' });

      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    it('should render error status badge', () => {
      renderActivityItem({ status: 'error' });

      expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('should not render badge when status is undefined', () => {
      renderActivityItem({ status: undefined });

      expect(screen.queryByText('success')).not.toBeInTheDocument();
      expect(screen.queryByText('pending')).not.toBeInTheDocument();
      expect(screen.queryByText('error')).not.toBeInTheDocument();
    });

    it('should render badge next to title', () => {
      const { container } = renderActivityItem({
        title: 'Scan completed',
        status: 'success',
      });

      // Badge and title should be in the same flex container
      const titleContainer = container.querySelector('.flex.items-center.gap-2');
      expect(titleContainer).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Activity Type Combinations
  // ============================================================================

  describe('Activity Type Combinations', () => {
    const activityTypes: ActivityType[] = ['scan', 'repository', 'dependency'];
    const statuses: (ActivityStatus | undefined)[] = ['success', 'pending', 'error', undefined];

    activityTypes.forEach((type) => {
      statuses.forEach((status) => {
        it(`should render ${type} type with ${status ?? 'no'} status`, () => {
          renderActivityItem({ type, status });

          // Component should render without error
          expect(screen.getByText('Scan completed for test-repo')).toBeInTheDocument();
        });
      });
    });
  });

  // ============================================================================
  // Timestamp Format Tests
  // ============================================================================

  describe('Timestamp Formats', () => {
    it('should display "Just now" timestamp', () => {
      renderActivityItem({ timestamp: 'Just now' });

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should display minutes ago timestamp', () => {
      renderActivityItem({ timestamp: '5 min ago' });

      expect(screen.getByText('5 min ago')).toBeInTheDocument();
    });

    it('should display hours ago timestamp', () => {
      renderActivityItem({ timestamp: '2 hours ago' });

      expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    });

    it('should display Yesterday timestamp', () => {
      renderActivityItem({ timestamp: 'Yesterday' });

      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });

    it('should display days ago timestamp', () => {
      renderActivityItem({ timestamp: '3 days ago' });

      expect(screen.getByText('3 days ago')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Styling Tests
  // ============================================================================

  describe('Styling', () => {
    it('should have flex layout', () => {
      const { container } = renderActivityItem();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('items-start');
    });

    it('should have proper spacing', () => {
      const { container } = renderActivityItem();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('gap-4');
      expect(wrapper).toHaveClass('py-3');
    });

    it('should have truncate class on title for overflow', () => {
      const { container } = renderActivityItem({
        title: 'This is a very long title that might overflow the container',
      });

      const title = container.querySelector('.truncate');
      expect(title).toBeInTheDocument();
    });

    it('should have shrink-0 on timestamp', () => {
      const { container } = renderActivityItem();

      const timestamp = container.querySelector('.shrink-0.text-xs');
      expect(timestamp).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Content Overflow Tests
  // ============================================================================

  describe('Content Overflow', () => {
    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(200);
      renderActivityItem({ title: longTitle });

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'B'.repeat(500);
      renderActivityItem({ description: longDescription });

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('should handle empty description', () => {
      renderActivityItem({ description: '' });

      // Component should still render
      expect(screen.getByText('Scan completed for test-repo')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle special characters in title', () => {
      renderActivityItem({ title: 'Scan for repo/sub-repo@v1.2.3' });

      expect(screen.getByText('Scan for repo/sub-repo@v1.2.3')).toBeInTheDocument();
    });

    it('should handle special characters in description', () => {
      renderActivityItem({ description: 'Error: "Invalid config" <file.json>' });

      expect(screen.getByText('Error: "Invalid config" <file.json>')).toBeInTheDocument();
    });

    it('should handle HTML entities in content', () => {
      renderActivityItem({ title: 'Test & verify' });

      expect(screen.getByText('Test & verify')).toBeInTheDocument();
    });

    it('should handle emoji in title', () => {
      renderActivityItem({ title: 'Scan completed successfully' });

      expect(screen.getByText('Scan completed successfully')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have accessible text content', () => {
      renderActivityItem({
        title: 'Repository added',
        description: 'New repo connected',
        timestamp: '5 min ago',
      });

      expect(screen.getByText('Repository added')).toBeInTheDocument();
      expect(screen.getByText('New repo connected')).toBeInTheDocument();
      expect(screen.getByText('5 min ago')).toBeInTheDocument();
    });

    it('should not hide important content from screen readers', () => {
      renderActivityItem({ status: 'success' });

      // Status badge should be visible to screen readers
      expect(screen.getByText('success')).toBeInTheDocument();
    });
  });
});
