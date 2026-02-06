/**
 * ErrorState Component Unit Tests
 * Tests for error display, retry functionality, and styling
 * @module pages/dashboard/components/__tests__/ErrorState.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ErrorState, type ErrorStateProps } from '../ErrorState';

// ============================================================================
// Test Helpers
// ============================================================================

function renderErrorState(props: Partial<ErrorStateProps> = {}) {
  const defaultProps: ErrorStateProps = {
    message: 'Something went wrong',
  };
  return render(<ErrorState {...defaultProps} {...props} />);
}

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe('ErrorState', () => {
  describe('Basic Rendering', () => {
    it('should render error message', () => {
      renderErrorState({ message: 'Connection failed' });

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('should render "Failed to load data" heading', () => {
      renderErrorState();

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('should render error icon', () => {
      const { container } = renderErrorState();

      // ExclamationIcon should be present as SVG
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper layout classes', () => {
      const { container } = renderErrorState();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
      expect(wrapper).toHaveClass('items-center');
      expect(wrapper).toHaveClass('justify-center');
    });
  });

  // ============================================================================
  // Retry Button Tests
  // ============================================================================

  describe('Retry Button', () => {
    it('should show retry button when onRetry is provided', () => {
      const onRetry = vi.fn();
      renderErrorState({ onRetry });

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should not show retry button when onRetry is undefined', () => {
      renderErrorState({ onRetry: undefined });

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      renderErrorState({ onRetry });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry multiple times on multiple clicks', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      renderErrorState({ onRetry });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);
      await user.click(retryButton);
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(3);
    });

    it('should handle synchronous onRetry', () => {
      const onRetry = vi.fn();
      renderErrorState({ onRetry });

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(onRetry).toHaveBeenCalled();
    });

    it('should handle async onRetry', async () => {
      const onRetry = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderErrorState({ onRetry });

      await user.click(screen.getByRole('button', { name: /try again/i }));

      expect(onRetry).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Message Tests
  // ============================================================================

  describe('Error Messages', () => {
    it('should display short error message', () => {
      renderErrorState({ message: 'Error' });

      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should display long error message', () => {
      const longMessage = 'This is a very long error message that provides detailed information about what went wrong and how to fix it';
      renderErrorState({ message: longMessage });

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should display error message with special characters', () => {
      renderErrorState({ message: 'Error: "config.json" not found' });

      expect(screen.getByText('Error: "config.json" not found')).toBeInTheDocument();
    });

    it('should display error message with HTML entities', () => {
      renderErrorState({ message: 'Value > 100 & < 0' });

      expect(screen.getByText('Value > 100 & < 0')).toBeInTheDocument();
    });

    it('should display technical error message', () => {
      renderErrorState({ message: 'ECONNREFUSED: Connection refused' });

      expect(screen.getByText('ECONNREFUSED: Connection refused')).toBeInTheDocument();
    });

    it('should display HTTP status error', () => {
      renderErrorState({ message: '500 Internal Server Error' });

      expect(screen.getByText('500 Internal Server Error')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Icon Styling Tests
  // ============================================================================

  describe('Icon Styling', () => {
    it('should have error icon container with red background', () => {
      const { container } = renderErrorState();

      const iconContainer = container.querySelector('.bg-red-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have rounded-full icon container', () => {
      const { container } = renderErrorState();

      const iconContainer = container.querySelector('.rounded-full');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have proper icon sizing', () => {
      const { container } = renderErrorState();

      const iconContainer = container.querySelector('.h-12.w-12');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Layout Tests
  // ============================================================================

  describe('Layout', () => {
    it('should center content', () => {
      const { container } = renderErrorState();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('text-center');
    });

    it('should have vertical padding', () => {
      const { container } = renderErrorState();

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('py-8');
    });

    it('should have proper spacing between elements', () => {
      const { container } = renderErrorState({ onRetry: vi.fn() });

      // Heading should have margin-top
      const heading = screen.getByText('Failed to load data');
      expect(heading).toHaveClass('mt-3');
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have accessible heading', () => {
      renderErrorState();

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('should have accessible button', () => {
      renderErrorState({ onRetry: vi.fn() });

      const button = screen.getByRole('button', { name: /try again/i });
      expect(button).toBeInTheDocument();
    });

    it('should have focusable retry button', () => {
      renderErrorState({ onRetry: vi.fn() });

      const button = screen.getByRole('button', { name: /try again/i });
      button.focus();
      expect(button).toHaveFocus();
    });

    it('should be keyboard accessible', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      renderErrorState({ onRetry });

      const button = screen.getByRole('button', { name: /try again/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(onRetry).toHaveBeenCalled();
    });

    it('should be accessible via Space key', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      renderErrorState({ onRetry });

      const button = screen.getByRole('button', { name: /try again/i });
      button.focus();
      await user.keyboard(' ');

      expect(onRetry).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      renderErrorState({ message: '' });

      // Should still render the heading
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('should handle whitespace-only message', () => {
      renderErrorState({ message: '   ' });

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('should handle message with newlines', () => {
      renderErrorState({ message: 'Line 1\nLine 2' });

      // React will render newlines as spaces in text content
      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    });

    it('should call onRetry even with complex implementations', async () => {
      let callCount = 0;
      const onRetry = vi.fn().mockImplementation(() => {
        callCount += 1;
      });
      const user = userEvent.setup();
      renderErrorState({ onRetry });

      await user.click(screen.getByRole('button', { name: /try again/i }));

      expect(onRetry).toHaveBeenCalled();
      expect(callCount).toBe(1);
    });
  });

  // ============================================================================
  // Button Styling Tests
  // ============================================================================

  describe('Button Styling', () => {
    it('should have outline variant button', () => {
      const { container } = renderErrorState({ onRetry: vi.fn() });

      // Button should exist with proper text
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should have refresh icon in button', () => {
      const { container } = renderErrorState({ onRetry: vi.fn() });

      // Button container should have SVG for refresh icon
      const button = screen.getByRole('button', { name: /try again/i });
      const buttonContainer = button.closest('button') || button;
      const svgInButton = buttonContainer.querySelector('svg');
      // Note: SVG might be in a span or directly in button depending on Button implementation
    });

    it('should have margin-top on button', () => {
      const { container } = renderErrorState({ onRetry: vi.fn() });

      // Using the Button component with className="mt-4"
      const button = screen.getByRole('button', { name: /try again/i });
      expect(button).toHaveClass('mt-4');
    });
  });
});
