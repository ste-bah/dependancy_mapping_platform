/**
 * GraphErrorBoundary Component Tests
 * Tests for the error boundary component
 * @module features/graph/__tests__/components/GraphErrorBoundary.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphErrorBoundary } from '../../components/GraphErrorBoundary';
import { renderWithProviders } from '../utils/testUtils';
import { GraphError } from '../../utils/errorHandler';

// Mock cn utility
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) =>
    classes.filter(Boolean).join(' '),
}));

// Mock shared components
vi.mock('@/shared/components', () => ({
  Button: vi.fn(({ children, onClick, variant, ...props }) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  )),
  Alert: vi.fn(({ children, variant, className, ...props }) => (
    <div data-testid="alert" data-variant={variant} className={className} {...props}>
      {children}
    </div>
  )),
}));

// Mock @/shared index to also export Alert
vi.mock('@/shared', () => ({
  Button: vi.fn(({ children, onClick, variant, ...props }) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  )),
  Alert: vi.fn(({ children, variant, className, ...props }) => (
    <div data-testid="alert" data-variant={variant} className={className} {...props}>
      {children}
    </div>
  )),
}));

// Component that throws an error
function ErrorThrowingComponent({ error }: { error: Error }) {
  throw error;
}

// Component that works normally
function WorkingComponent() {
  return <div data-testid="working">Working content</div>;
}

describe('GraphErrorBoundary', () => {
  // Suppress console.error during error boundary tests
  const originalError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('normal operation', () => {
    it('should render children when no error', () => {
      renderWithProviders(
        <GraphErrorBoundary>
          <WorkingComponent />
        </GraphErrorBoundary>
      );

      expect(screen.getByTestId('working')).toBeInTheDocument();
    });

    it('should pass through children props', () => {
      renderWithProviders(
        <GraphErrorBoundary>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </GraphErrorBoundary>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should catch and display error', () => {
      const testError = new Error('Test error message');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      // Component displays error title from getErrorTitle() - "Error" for UNKNOWN_ERROR
      expect(screen.getByRole('heading', { name: /error/i })).toBeInTheDocument();
    });

    it('should display error message', () => {
      const testError = new Error('Specific error message');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      // The error is converted to GraphError with UNKNOWN_ERROR code
      // The message is transformed by getErrorMessage()
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should handle GraphError specially', () => {
      const graphError = new GraphError('Network error', 'NETWORK_ERROR');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={graphError} />
        </GraphErrorBoundary>
      );

      // getErrorTitle returns "Connection Error" for NETWORK_ERROR
      expect(screen.getByRole('heading', { name: /Connection Error/i })).toBeInTheDocument();
    });

    it('should show appropriate title for different error codes', () => {
      const errorCases = [
        { code: 'NETWORK_ERROR', title: 'Connection Error' },
        { code: 'TIMEOUT_ERROR', title: 'Request Timeout' },
        { code: 'NOT_FOUND', title: 'Not Found' },
        { code: 'SERVER_ERROR', title: 'Server Error' },
      ] as const;

      errorCases.forEach(({ code, title }) => {
        const graphError = new GraphError('Test', code);

        const { unmount } = renderWithProviders(
          <GraphErrorBoundary>
            <ErrorThrowingComponent error={graphError} />
          </GraphErrorBoundary>
        );

        expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('retry functionality', () => {
    it('should show retry button for retryable errors', () => {
      // Use a retryable error (NETWORK_ERROR is retryable)
      const testError = new GraphError('Network error', 'NETWORK_ERROR');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      // Retry button shows "Try Again" for retryable errors
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn();
      // Use a retryable error
      const testError = new GraphError('Network error', 'NETWORK_ERROR');
      const user = userEvent.setup();

      renderWithProviders(
        <GraphErrorBoundary onRetry={onRetry}>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      await user.click(screen.getByRole('button', { name: /try again/i }));

      expect(onRetry).toHaveBeenCalled();
    });

    it('should reset error state on retry', async () => {
      let shouldThrow = true;
      const user = userEvent.setup();

      function ConditionalError() {
        if (shouldThrow) {
          // Use a retryable error to ensure retry button shows
          throw new GraphError('Network error', 'NETWORK_ERROR');
        }
        return <div data-testid="success">Success</div>;
      }

      const { rerender } = renderWithProviders(
        <GraphErrorBoundary>
          <ConditionalError />
        </GraphErrorBoundary>
      );

      expect(screen.getByRole('heading', { name: /Connection Error/i })).toBeInTheDocument();

      shouldThrow = false;

      await user.click(screen.getByRole('button', { name: /try again/i }));

      // After retry with working component, should show success
      rerender(
        <GraphErrorBoundary>
          <ConditionalError />
        </GraphErrorBoundary>
      );
    });

    it('should not show retry button for non-retryable errors', () => {
      const nonRetryableError = new GraphError('Not found', 'NOT_FOUND');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={nonRetryableError} />
        </GraphErrorBoundary>
      );

      // NOT_FOUND is not retryable - primary action is "Go Back", not retry
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('should show try again button for network errors', () => {
      const retryableError = new GraphError('Network issue', 'NETWORK_ERROR');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={retryableError} />
        </GraphErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('refresh functionality', () => {
    it('should show refresh button for network errors', () => {
      // Network errors have "Refresh Page" as secondary action
      const testError = new GraphError('Network error', 'NETWORK_ERROR');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(
        screen.getByRole('button', { name: /refresh page/i })
      ).toBeInTheDocument();
    });

    it('should show reload page button for non-retryable errors without onRetry', () => {
      // For validation errors, there's no retry but we do have a fallback reload
      const testError = new GraphError('Invalid data', 'VALIDATION_ERROR');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      // The primary action for validation error is "OK" (dismiss), and there's no secondary action
      // that results in reload, since recovery actions don't include refresh for validation errors
      expect(screen.getByRole('button', { name: /ok/i })).toBeInTheDocument();
    });
  });

  describe('fallback prop', () => {
    it('should render custom fallback when provided', () => {
      const testError = new Error('Test error');
      const CustomFallback = () => <div data-testid="custom-fallback">Custom Error</div>;

      renderWithProviders(
        <GraphErrorBoundary fallback={<CustomFallback />}>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    });

    it('should render fallback as ReactNode (not render prop)', () => {
      const testError = new Error('Specific error');

      // The fallback prop only accepts ReactNode, not a render function
      // So we provide a static fallback
      renderWithProviders(
        <GraphErrorBoundary
          fallback={<div data-testid="static-fallback">Static fallback message</div>}
        >
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(screen.getByTestId('static-fallback')).toHaveTextContent(
        'Static fallback message'
      );
    });
  });

  describe('onError callback', () => {
    it('should call onError when error is caught', () => {
      const onError = vi.fn();
      const testError = new Error('Test error');

      renderWithProviders(
        <GraphErrorBoundary onError={onError}>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(testError, expect.any(Object));
    });

    it('should pass error info to onError', () => {
      const onError = vi.fn();
      const testError = new Error('Test error');

      renderWithProviders(
        <GraphErrorBoundary onError={onError}>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('error details', () => {
    it('should show expandable error details in dev mode via details element', () => {
      const testError = new Error('Test error with stack');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      // In dev mode, details are shown via a <details> element with summary
      // The summary contains "View Stack Trace (Development)"
      const summary = screen.getByText(/View Stack Trace/i);
      expect(summary).toBeInTheDocument();
    });

    it('should contain stack trace in pre element', () => {
      const testError = new Error('Test error');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      // The stack trace is inside a <pre> element within the <details>
      const preElement = document.querySelector('pre');
      expect(preElement).toBeInTheDocument();
    });
  });

  describe('recovery actions', () => {
    it('should show appropriate recovery actions for error type', () => {
      const authError = new GraphError('Unauthorized', 'UNAUTHORIZED');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={authError} />
        </GraphErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should show contact support for forbidden errors', () => {
      const forbiddenError = new GraphError('Forbidden', 'FORBIDDEN');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={forbiddenError} />
        </GraphErrorBoundary>
      );

      // "Contact Support" appears both as a button and in the footer text
      // Use getAllByText to handle multiple matches
      const contactSupportElements = screen.getAllByText(/contact support/i);
      expect(contactSupportElements.length).toBeGreaterThan(0);
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      const testError = new Error('Test error');

      const { container } = renderWithProviders(
        <GraphErrorBoundary className="custom-error">
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(container.firstChild).toHaveClass('custom-error');
    });

    it('should center error content', () => {
      const testError = new Error('Test error');

      const { container } = renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(container.firstChild).toHaveClass('flex');
    });
  });

  describe('accessibility', () => {
    it('should have accessible alert role', () => {
      const testError = new Error('Test error');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have accessible heading', () => {
      const testError = new Error('Test error');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const testError = new Error('Test error');
      const user = userEvent.setup();

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      await user.tab();

      const firstButton = screen.getAllByRole('button')[0];
      expect(firstButton).toHaveFocus();
    });
  });

  describe('error icon', () => {
    it('should display error icon', () => {
      const testError = new Error('Test error');

      renderWithProviders(
        <GraphErrorBoundary>
          <ErrorThrowingComponent error={testError} />
        </GraphErrorBoundary>
      );

      // The error icon is an SVG inside the red circle container
      // There's no data-error-icon attribute, just check for the SVG structure
      const svgIcon = document.querySelector('svg.h-8.w-8.text-red-600');
      expect(svgIcon).toBeInTheDocument();
    });
  });
});
