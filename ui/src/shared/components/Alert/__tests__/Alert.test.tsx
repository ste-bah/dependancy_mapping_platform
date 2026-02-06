/**
 * Alert Component Tests
 * Comprehensive tests for Alert, InlineAlert, and AlertDescription components
 * @module shared/components/Alert/__tests__/Alert.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Alert,
  InlineAlert,
  AlertDescription,
  type AlertProps,
  type AlertVariant,
} from '../Alert';

// ============================================================================
// Test Utilities
// ============================================================================

const renderAlert = (props: Partial<AlertProps> = {}) => {
  return render(
    <Alert {...props}>
      {props.children ?? 'Alert message content'}
    </Alert>
  );
};

const TestIcon = () => (
  <svg data-testid="custom-icon" className="h-5 w-5">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

// ============================================================================
// Alert Component Tests
// ============================================================================

describe('Alert', () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render alert with children', () => {
      renderAlert();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Alert message content')).toBeInTheDocument();
    });

    it('should render with title', () => {
      renderAlert({ title: 'Alert Title' });

      expect(screen.getByText('Alert Title')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Alert Title');
    });

    it('should forward ref', () => {
      const ref = vi.fn();
      render(<Alert ref={ref}>Test</Alert>);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });

    it('should apply custom className', () => {
      render(
        <Alert className="custom-class">Test</Alert>
      );

      expect(screen.getByRole('alert')).toHaveClass('custom-class');
    });

    it('should spread additional props', () => {
      render(
        <Alert data-testid="custom-alert" id="alert-1">
          Test
        </Alert>
      );

      const alert = screen.getByTestId('custom-alert');
      expect(alert).toHaveAttribute('id', 'alert-1');
    });
  });

  // ==========================================================================
  // Variant Tests
  // ==========================================================================

  describe('Variants', () => {
    const variants: AlertVariant[] = ['info', 'success', 'warning', 'error'];

    it.each(variants)('should render %s variant', (variant) => {
      renderAlert({ variant });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should use info variant by default', () => {
      renderAlert();

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('border-primary-200');
      expect(alert).toHaveClass('bg-primary-50');
    });

    it('should apply success variant styles', () => {
      renderAlert({ variant: 'success' });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-success-50');
    });

    it('should apply warning variant styles', () => {
      renderAlert({ variant: 'warning' });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-warning-50');
    });

    it('should apply error variant styles', () => {
      renderAlert({ variant: 'error' });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-error-50');
    });
  });

  // ==========================================================================
  // Icon Tests
  // ==========================================================================

  describe('Icons', () => {
    it('should render default icon for info variant', () => {
      renderAlert({ variant: 'info' });

      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render default icon for success variant', () => {
      renderAlert({ variant: 'success' });

      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render default icon for warning variant', () => {
      renderAlert({ variant: 'warning' });

      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render default icon for error variant', () => {
      renderAlert({ variant: 'error' });

      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render custom icon when provided', () => {
      renderAlert({ icon: <TestIcon /> });

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should apply variant-specific icon color', () => {
      renderAlert({ variant: 'error' });

      const iconContainer = screen.getByRole('alert').querySelector('.text-error-500');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Action Tests
  // ==========================================================================

  describe('Actions', () => {
    it('should render action element', () => {
      renderAlert({
        action: <button data-testid="action-button">Retry</button>,
      });

      expect(screen.getByTestId('action-button')).toBeInTheDocument();
    });

    it('should position action below content', () => {
      renderAlert({
        title: 'Error',
        action: <button>Retry</button>,
        children: 'Something went wrong',
      });

      const actionButton = screen.getByRole('button', { name: 'Retry' });
      expect(actionButton.parentElement).toHaveClass('mt-3');
    });

    it('should handle action button clicks', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      renderAlert({
        action: <button onClick={onClick}>Retry</button>,
      });

      await user.click(screen.getByRole('button', { name: 'Retry' }));

      expect(onClick).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Dismissible Tests
  // ==========================================================================

  describe('Dismissible', () => {
    it('should render dismiss button when dismissible is true', () => {
      renderAlert({ dismissible: true });

      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });

    it('should not render dismiss button when dismissible is false', () => {
      renderAlert({ dismissible: false });

      expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    });

    it('should call onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();

      renderAlert({ dismissible: true, onDismiss });

      await user.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should apply focus ring style based on variant', () => {
      renderAlert({ variant: 'error', dismissible: true });

      const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismissButton).toHaveClass('focus:ring-error-500');
    });

    it('should have proper dismiss button icon', () => {
      renderAlert({ dismissible: true });

      const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
      const icon = dismissButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ==========================================================================
  // Title and Content Tests
  // ==========================================================================

  describe('Title and Content', () => {
    it('should render title as h3 heading', () => {
      renderAlert({ title: 'Important Notice' });

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Important Notice');
      expect(heading).toHaveClass('font-medium');
    });

    it('should render content below title', () => {
      renderAlert({
        title: 'Title',
        children: 'Description text',
      });

      const description = screen.getByText('Description text');
      expect(description).toHaveClass('mt-1');
    });

    it('should not add margin when no title', () => {
      renderAlert({ children: 'Just content' });

      const content = screen.getByText('Just content');
      expect(content).not.toHaveClass('mt-1');
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have role="alert"', () => {
      renderAlert();

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-hidden on decorative icon', () => {
      renderAlert();

      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have accessible dismiss button', () => {
      renderAlert({ dismissible: true });

      const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss');
    });
  });

  // ==========================================================================
  // Layout Tests
  // ==========================================================================

  describe('Layout', () => {
    it('should use flex layout', () => {
      renderAlert();

      const alert = screen.getByRole('alert');
      const flexContainer = alert.querySelector('.flex');
      expect(flexContainer).toBeInTheDocument();
    });

    it('should have rounded corners', () => {
      renderAlert();

      expect(screen.getByRole('alert')).toHaveClass('rounded-lg');
    });

    it('should have border', () => {
      renderAlert();

      expect(screen.getByRole('alert')).toHaveClass('border');
    });

    it('should have padding', () => {
      renderAlert();

      expect(screen.getByRole('alert')).toHaveClass('p-4');
    });
  });
});

// ============================================================================
// AlertDescription Tests
// ============================================================================

describe('AlertDescription', () => {
  it('should render children', () => {
    render(<AlertDescription>Additional details here</AlertDescription>);

    expect(screen.getByText('Additional details here')).toBeInTheDocument();
  });

  it('should apply margin top', () => {
    render(<AlertDescription>Details</AlertDescription>);

    const description = screen.getByText('Details');
    expect(description).toHaveClass('mt-2');
  });

  it('should apply custom className', () => {
    render(
      <AlertDescription className="custom-class">Details</AlertDescription>
    );

    expect(screen.getByText('Details')).toHaveClass('custom-class');
  });

  it('should use text-sm for sizing', () => {
    render(<AlertDescription>Details</AlertDescription>);

    expect(screen.getByText('Details')).toHaveClass('text-sm');
  });

  it('should have reduced opacity', () => {
    render(<AlertDescription>Details</AlertDescription>);

    expect(screen.getByText('Details')).toHaveClass('opacity-90');
  });

  it('should work within Alert', () => {
    render(
      <Alert title="Warning" variant="warning">
        Main content
        <AlertDescription>Additional info</AlertDescription>
      </Alert>
    );

    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Additional info')).toBeInTheDocument();
  });
});

// ============================================================================
// InlineAlert Tests
// ============================================================================

describe('InlineAlert', () => {
  it('should render with children', () => {
    render(<InlineAlert>Inline message</InlineAlert>);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Inline message')).toBeInTheDocument();
  });

  it('should use info variant by default', () => {
    render(<InlineAlert>Message</InlineAlert>);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('text-primary-500');
  });

  it('should apply variant colors', () => {
    const { rerender } = render(
      <InlineAlert variant="success">Success message</InlineAlert>
    );
    expect(screen.getByRole('alert')).toHaveClass('text-success-500');

    rerender(<InlineAlert variant="warning">Warning message</InlineAlert>);
    expect(screen.getByRole('alert')).toHaveClass('text-warning-500');

    rerender(<InlineAlert variant="error">Error message</InlineAlert>);
    expect(screen.getByRole('alert')).toHaveClass('text-error-500');
  });

  it('should display variant icon', () => {
    render(<InlineAlert variant="error">Error</InlineAlert>);

    const icon = screen.getByRole('alert').querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<InlineAlert className="my-custom-class">Message</InlineAlert>);

    expect(screen.getByRole('alert')).toHaveClass('my-custom-class');
  });

  it('should use flex layout with gap', () => {
    render(<InlineAlert>Message</InlineAlert>);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('flex');
    expect(alert).toHaveClass('items-center');
    expect(alert).toHaveClass('gap-1.5');
  });

  it('should have text-sm sizing', () => {
    render(<InlineAlert>Message</InlineAlert>);

    expect(screen.getByRole('alert')).toHaveClass('text-sm');
  });

  it('should work for form field validation', () => {
    render(
      <div>
        <input type="email" aria-describedby="email-error" />
        <InlineAlert variant="error">
          Please enter a valid email address
        </InlineAlert>
      </div>
    );

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Alert Integration', () => {
  it('should render complete alert with all features', () => {
    const onDismiss = vi.fn();

    render(
      <Alert
        variant="warning"
        title="Account Verification Required"
        icon={<TestIcon />}
        action={<button>Verify Now</button>}
        dismissible
        onDismiss={onDismiss}
      >
        Your account needs to be verified within 24 hours.
        <AlertDescription>
          Click the verification link sent to your email.
        </AlertDescription>
      </Alert>
    );

    // Check all elements are present
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Account Verification Required')).toBeInTheDocument();
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('Your account needs to be verified within 24 hours.')).toBeInTheDocument();
    expect(screen.getByText('Click the verification link sent to your email.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('should handle multiple alerts on page', () => {
    render(
      <>
        <Alert variant="info" title="Info">Info message</Alert>
        <Alert variant="success" title="Success">Success message</Alert>
        <Alert variant="error" title="Error">Error message</Alert>
      </>
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(3);
  });
});
