/**
 * QuickActionCard Component Unit Tests
 * Tests for navigation, content display, and interaction states
 * @module pages/dashboard/components/__tests__/QuickActionCard.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { QuickActionCard, type QuickActionCardProps } from '../QuickActionCard';

// ============================================================================
// Test Helpers
// ============================================================================

const TestIcon = (): JSX.Element => (
  <svg data-testid="action-icon" className="h-5 w-5" viewBox="0 0 24 24">
    <rect x="4" y="4" width="16" height="16" />
  </svg>
);

const defaultProps: QuickActionCardProps = {
  title: 'Quick Action',
  description: 'Action description text',
  icon: <TestIcon />,
  href: '/action-path',
};

function renderQuickActionCard(props: Partial<QuickActionCardProps> = {}) {
  return render(
    <MemoryRouter>
      <QuickActionCard {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe('QuickActionCard', () => {
  describe('Basic Rendering', () => {
    it('should render title correctly', () => {
      renderQuickActionCard({ title: 'Run New Scan' });

      expect(screen.getByText('Run New Scan')).toBeInTheDocument();
    });

    it('should render description correctly', () => {
      renderQuickActionCard({ description: "Analyze a repository's dependencies" });

      expect(screen.getByText("Analyze a repository's dependencies")).toBeInTheDocument();
    });

    it('should render icon element', () => {
      renderQuickActionCard();

      expect(screen.getByTestId('action-icon')).toBeInTheDocument();
    });

    it('should render as a link element', () => {
      renderQuickActionCard();

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });

    it('should have correct href attribute', () => {
      renderQuickActionCard({ href: '/scans' });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/scans');
    });

    it('should render arrow icon for navigation hint', () => {
      const { container } = renderQuickActionCard();

      // ArrowRightIcon should be present
      const arrowIcons = container.querySelectorAll('svg');
      expect(arrowIcons.length).toBeGreaterThanOrEqual(2); // action icon + arrow icon
    });
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  describe('Navigation', () => {
    it('should link to repositories page', () => {
      renderQuickActionCard({
        title: 'View Repositories',
        href: '/repositories',
      });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/repositories');
    });

    it('should link to settings page', () => {
      renderQuickActionCard({
        title: 'Configure Settings',
        href: '/settings',
      });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/settings');
    });

    it('should link to scans page', () => {
      renderQuickActionCard({
        title: 'Run New Scan',
        href: '/scans',
      });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/scans');
    });

    it('should handle root path', () => {
      renderQuickActionCard({ href: '/' });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/');
    });

    it('should handle nested paths', () => {
      renderQuickActionCard({ href: '/repositories/new' });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/repositories/new');
    });
  });

  // ============================================================================
  // Styling Tests
  // ============================================================================

  describe('Styling', () => {
    it('should have card styling classes', () => {
      renderQuickActionCard();

      const link = screen.getByRole('link');
      expect(link).toHaveClass('rounded-lg');
      expect(link).toHaveClass('border');
      expect(link).toHaveClass('bg-white');
    });

    it('should have hover transition classes', () => {
      renderQuickActionCard();

      const link = screen.getByRole('link');
      expect(link).toHaveClass('transition-all');
    });

    it('should have group class for child hover effects', () => {
      renderQuickActionCard();

      const link = screen.getByRole('link');
      expect(link).toHaveClass('group');
    });

    it('should apply icon container styling', () => {
      const { container } = renderQuickActionCard();

      const iconContainer = container.querySelector('.h-10.w-10');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Content Display Tests
  // ============================================================================

  describe('Content Display', () => {
    it('should display title in heading element', () => {
      renderQuickActionCard({ title: 'Action Title' });

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Action Title');
    });

    it('should display description as paragraph', () => {
      renderQuickActionCard({ description: 'Description text here' });

      expect(screen.getByText('Description text here')).toBeInTheDocument();
    });

    it('should handle long titles', () => {
      renderQuickActionCard({
        title: 'This is a very long action title that might wrap',
      });

      expect(screen.getByText('This is a very long action title that might wrap')).toBeInTheDocument();
    });

    it('should handle long descriptions', () => {
      renderQuickActionCard({
        description: 'This is a very long description that provides detailed information about the action',
      });

      expect(screen.getByText('This is a very long description that provides detailed information about the action')).toBeInTheDocument();
    });

    it('should handle empty description', () => {
      renderQuickActionCard({ description: '' });

      // Component should still render
      expect(screen.getByText('Quick Action')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Icon Tests
  // ============================================================================

  describe('Icon Display', () => {
    it('should render custom icon', () => {
      const CustomIcon = () => <div data-testid="custom-icon">Custom</div>;
      renderQuickActionCard({ icon: <CustomIcon /> });

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should render SVG icon', () => {
      renderQuickActionCard();

      expect(screen.getByTestId('action-icon')).toBeInTheDocument();
    });

    it('should render text-based icon', () => {
      renderQuickActionCard({ icon: <span data-testid="emoji-icon">+</span> });

      expect(screen.getByTestId('emoji-icon')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should be accessible via link role', () => {
      renderQuickActionCard();

      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should have accessible name from title', () => {
      renderQuickActionCard({ title: 'Configure Settings' });

      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('Configure Settings');
    });

    it('should be keyboard focusable', () => {
      renderQuickActionCard();

      const link = screen.getByRole('link');
      link.focus();
      expect(link).toHaveFocus();
    });

    it('should have proper heading hierarchy', () => {
      renderQuickActionCard({ title: 'Action Title' });

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle special characters in title', () => {
      renderQuickActionCard({ title: 'Settings & Preferences' });

      expect(screen.getByText('Settings & Preferences')).toBeInTheDocument();
    });

    it('should handle special characters in description', () => {
      renderQuickActionCard({ description: "Configure your app's settings" });

      expect(screen.getByText("Configure your app's settings")).toBeInTheDocument();
    });

    it('should handle URL with query params', () => {
      renderQuickActionCard({ href: '/scans?filter=recent' });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/scans?filter=recent');
    });

    it('should handle URL with hash', () => {
      renderQuickActionCard({ href: '/settings#notifications' });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/settings#notifications');
    });
  });
});
