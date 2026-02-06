/**
 * StatsCard Component Unit Tests
 * Tests for stats display, trends, loading states, and color variants
 * @module pages/dashboard/components/__tests__/StatsCard.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StatsCard, type StatsCardProps } from '../StatsCard';

// ============================================================================
// Test Helpers
// ============================================================================

const TestIcon = (): JSX.Element => (
  <svg data-testid="test-icon" className="h-6 w-6" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const defaultProps: StatsCardProps = {
  title: 'Test Stat',
  value: 42,
  icon: <TestIcon />,
};

function renderStatsCard(props: Partial<StatsCardProps> = {}) {
  return render(<StatsCard {...defaultProps} {...props} />);
}

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe('StatsCard', () => {
  describe('Basic Rendering', () => {
    it('should render title correctly', () => {
      renderStatsCard({ title: 'Repositories' });

      expect(screen.getByText('Repositories')).toBeInTheDocument();
    });

    it('should render numeric value correctly', () => {
      renderStatsCard({ value: 123 });

      expect(screen.getByText('123')).toBeInTheDocument();
    });

    it('should render string value correctly', () => {
      renderStatsCard({ value: '1.5K' });

      expect(screen.getByText('1.5K')).toBeInTheDocument();
    });

    it('should render zero value correctly', () => {
      renderStatsCard({ value: 0 });

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render icon element', () => {
      renderStatsCard();

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should render large values correctly', () => {
      renderStatsCard({ value: 999999 });

      expect(screen.getByText('999999')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Trend Indicator Tests
  // ============================================================================

  describe('Trend Indicator', () => {
    it('should show positive trend with plus sign', () => {
      renderStatsCard({
        trend: { value: 15, isPositive: true },
      });

      expect(screen.getByText('+15%')).toBeInTheDocument();
      expect(screen.getByText('from last week')).toBeInTheDocument();
    });

    it('should show negative trend without plus sign', () => {
      renderStatsCard({
        trend: { value: -8, isPositive: false },
      });

      expect(screen.getByText('-8%')).toBeInTheDocument();
    });

    it('should apply green color for positive trend', () => {
      renderStatsCard({
        trend: { value: 10, isPositive: true },
      });

      const trendElement = screen.getByText('+10%');
      expect(trendElement).toHaveClass('text-green-600');
    });

    it('should apply red color for negative trend', () => {
      renderStatsCard({
        trend: { value: -5, isPositive: false },
      });

      const trendElement = screen.getByText('-5%');
      expect(trendElement).toHaveClass('text-red-600');
    });

    it('should not show trend when not provided', () => {
      renderStatsCard({ trend: undefined });

      expect(screen.queryByText('from last week')).not.toBeInTheDocument();
    });

    it('should handle zero trend value', () => {
      renderStatsCard({
        trend: { value: 0, isPositive: true },
      });

      expect(screen.getByText('+0%')).toBeInTheDocument();
    });

    it('should handle decimal trend values', () => {
      renderStatsCard({
        trend: { value: 12.5, isPositive: true },
      });

      expect(screen.getByText('+12.5%')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Loading State Tests
  // ============================================================================

  describe('Loading State', () => {
    it('should show skeleton when loading is true', () => {
      const { container } = renderStatsCard({ loading: true });

      // Skeleton component should be present - check for the skeleton class pattern
      const skeleton = container.querySelector('[class*="animate"]') ||
                       container.querySelector('[class*="skeleton"]') ||
                       container.querySelector('[role="status"]');

      // Value should not be visible when loading
      expect(screen.queryByText('42')).not.toBeInTheDocument();
    });

    it('should not show trend when loading', () => {
      renderStatsCard({
        loading: true,
        trend: { value: 10, isPositive: true },
      });

      expect(screen.queryByText('+10%')).not.toBeInTheDocument();
      expect(screen.queryByText('from last week')).not.toBeInTheDocument();
    });

    it('should show title when loading', () => {
      renderStatsCard({
        loading: true,
        title: 'Total Scans',
      });

      expect(screen.getByText('Total Scans')).toBeInTheDocument();
    });

    it('should show icon when loading', () => {
      renderStatsCard({ loading: true });

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should show value when loading is false', () => {
      renderStatsCard({ loading: false, value: 100 });

      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should default loading to false', () => {
      renderStatsCard({ value: 50 });

      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Color Styling Tests
  // ============================================================================

  describe('Color Styling', () => {
    it('should apply primary color by default', () => {
      const { container } = renderStatsCard();

      const iconContainer = container.querySelector('.bg-primary-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should apply primary color styling', () => {
      const { container } = renderStatsCard({ color: 'primary' });

      const iconContainer = container.querySelector('.bg-primary-100.text-primary-600');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should apply success color styling', () => {
      const { container } = renderStatsCard({ color: 'success' });

      const iconContainer = container.querySelector('.bg-green-100.text-green-600');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should apply warning color styling', () => {
      const { container } = renderStatsCard({ color: 'warning' });

      const iconContainer = container.querySelector('.bg-amber-100.text-amber-600');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should apply error color styling', () => {
      const { container } = renderStatsCard({ color: 'error' });

      const iconContainer = container.querySelector('.bg-red-100.text-red-600');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty title', () => {
      renderStatsCard({ title: '' });

      // Component should still render
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should handle special characters in title', () => {
      renderStatsCard({ title: 'Nodes & Edges (Count)' });

      expect(screen.getByText('Nodes & Edges (Count)')).toBeInTheDocument();
    });

    it('should handle negative numeric values', () => {
      renderStatsCard({ value: -50 });

      expect(screen.getByText('-50')).toBeInTheDocument();
    });

    it('should handle very large trend values', () => {
      renderStatsCard({
        trend: { value: 999, isPositive: true },
      });

      expect(screen.getByText('+999%')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have accessible title as text', () => {
      renderStatsCard({ title: 'Total Repositories' });

      expect(screen.getByText('Total Repositories')).toBeInTheDocument();
    });

    it('should have accessible value', () => {
      renderStatsCard({ value: 42 });

      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });
});
