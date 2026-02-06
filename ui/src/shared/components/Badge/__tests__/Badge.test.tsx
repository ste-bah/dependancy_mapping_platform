/**
 * Badge Component Tests
 * Comprehensive tests for Badge, StatusBadge, and CountBadge components
 * @module shared/components/Badge/__tests__/Badge.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Badge,
  StatusBadge,
  CountBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type StatusType,
} from '../Badge';

// ============================================================================
// Test Utilities
// ============================================================================

const renderBadge = (props: Partial<BadgeProps> = {}) => {
  return render(<Badge {...props}>{props.children ?? 'Badge'}</Badge>);
};

const TestIcon = () => (
  <svg data-testid="test-icon" className="h-3 w-3">
    <circle cx="6" cy="6" r="5" />
  </svg>
);

// ============================================================================
// Badge Component Tests
// ============================================================================

describe('Badge', () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render badge with children', () => {
      renderBadge();

      expect(screen.getByText('Badge')).toBeInTheDocument();
    });

    it('should render as span element', () => {
      renderBadge();

      expect(screen.getByText('Badge').tagName).toBe('SPAN');
    });

    it('should forward ref', () => {
      const ref = vi.fn();
      render(<Badge ref={ref}>Test</Badge>);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLSpanElement);
    });

    it('should apply custom className', () => {
      render(<Badge className="custom-class">Test</Badge>);

      expect(screen.getByText('Test')).toHaveClass('custom-class');
    });

    it('should spread additional props', () => {
      render(<Badge data-testid="my-badge" id="badge-1">Test</Badge>);

      const badge = screen.getByTestId('my-badge');
      expect(badge).toHaveAttribute('id', 'badge-1');
    });
  });

  // ==========================================================================
  // Variant Tests
  // ==========================================================================

  describe('Variants', () => {
    const variants: BadgeVariant[] = [
      'default',
      'primary',
      'secondary',
      'success',
      'warning',
      'error',
      'outline',
    ];

    it.each(variants)('should render %s variant', (variant) => {
      renderBadge({ variant });

      expect(screen.getByText('Badge')).toBeInTheDocument();
    });

    it('should use default variant by default', () => {
      renderBadge();

      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('bg-gray-100');
    });

    it('should apply primary variant styles', () => {
      renderBadge({ variant: 'primary' });

      expect(screen.getByText('Badge')).toHaveClass('bg-primary-100');
    });

    it('should apply secondary variant styles', () => {
      renderBadge({ variant: 'secondary' });

      expect(screen.getByText('Badge')).toHaveClass('bg-gray-500');
    });

    it('should apply success variant styles', () => {
      renderBadge({ variant: 'success' });

      expect(screen.getByText('Badge')).toHaveClass('bg-success-50');
    });

    it('should apply warning variant styles', () => {
      renderBadge({ variant: 'warning' });

      expect(screen.getByText('Badge')).toHaveClass('bg-warning-50');
    });

    it('should apply error variant styles', () => {
      renderBadge({ variant: 'error' });

      expect(screen.getByText('Badge')).toHaveClass('bg-error-50');
    });

    it('should apply outline variant styles', () => {
      renderBadge({ variant: 'outline' });

      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('border');
      expect(badge).toHaveClass('bg-transparent');
    });
  });

  // ==========================================================================
  // Size Tests
  // ==========================================================================

  describe('Sizes', () => {
    const sizes: BadgeSize[] = ['sm', 'md', 'lg'];

    it.each(sizes)('should render %s size', (size) => {
      renderBadge({ size });

      expect(screen.getByText('Badge')).toBeInTheDocument();
    });

    it('should use md size by default', () => {
      renderBadge();

      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('px-2');
      expect(badge).toHaveClass('text-xs');
    });

    it('should apply sm size styles', () => {
      renderBadge({ size: 'sm' });

      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('px-1.5');
    });

    it('should apply lg size styles', () => {
      renderBadge({ size: 'lg' });

      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('px-2.5');
      expect(badge).toHaveClass('text-sm');
    });
  });

  // ==========================================================================
  // Dot Indicator Tests
  // ==========================================================================

  describe('Dot Indicator', () => {
    it('should render dot when dot prop is true', () => {
      renderBadge({ dot: true });

      const badge = screen.getByText('Badge');
      const dot = badge.querySelector('.rounded-full');
      expect(dot).toBeInTheDocument();
    });

    it('should not render dot by default', () => {
      renderBadge();

      const badge = screen.getByText('Badge');
      // Check there's no small dot element (icons would be larger)
      const dots = badge.querySelectorAll('.h-1\\.5');
      expect(dots.length).toBe(0);
    });

    it('should apply variant-specific dot color', () => {
      renderBadge({ dot: true, variant: 'success' });

      const badge = screen.getByText('Badge');
      const dot = badge.querySelector('.bg-success-500');
      expect(dot).toBeInTheDocument();
    });

    it('should scale dot based on size', () => {
      const { rerender } = render(<Badge dot size="sm">Small</Badge>);
      let badge = screen.getByText('Small');
      expect(badge.querySelector('.h-1')).toBeInTheDocument();

      rerender(<Badge dot size="lg">Large</Badge>);
      badge = screen.getByText('Large');
      expect(badge.querySelector('.h-2')).toBeInTheDocument();
    });

    it('should have aria-hidden on dot', () => {
      renderBadge({ dot: true });

      const badge = screen.getByText('Badge');
      const dot = badge.querySelector('.rounded-full');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ==========================================================================
  // Icon Tests
  // ==========================================================================

  describe('Icons', () => {
    it('should render icon when provided', () => {
      renderBadge({ icon: <TestIcon /> });

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should not render icon when dot is shown', () => {
      renderBadge({ icon: <TestIcon />, dot: true });

      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();
    });

    it('should hide icon from accessibility tree', () => {
      renderBadge({ icon: <TestIcon /> });

      const iconWrapper = screen.getByTestId('test-icon').parentElement;
      expect(iconWrapper).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ==========================================================================
  // Rounded Tests
  // ==========================================================================

  describe('Rounded', () => {
    it('should be pill-shaped by default', () => {
      renderBadge();

      expect(screen.getByText('Badge')).toHaveClass('rounded-full');
    });

    it('should use regular rounded corners when rounded is false', () => {
      renderBadge({ rounded: false });

      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('rounded');
      expect(badge).not.toHaveClass('rounded-full');
    });
  });

  // ==========================================================================
  // Removable Badge Tests
  // ==========================================================================

  describe('Removable Badge', () => {
    it('should render remove button when onRemove is provided', () => {
      renderBadge({ onRemove: vi.fn() });

      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('should not render remove button when onRemove is not provided', () => {
      renderBadge();

      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('should call onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      renderBadge({ onRemove });

      await user.click(screen.getByRole('button', { name: 'Remove' }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('should stop propagation on remove click', async () => {
      const user = userEvent.setup();
      const onBadgeClick = vi.fn();
      const onRemove = vi.fn();

      render(
        <div onClick={onBadgeClick}>
          <Badge onRemove={onRemove}>Removable</Badge>
        </div>
      );

      await user.click(screen.getByRole('button', { name: 'Remove' }));

      expect(onRemove).toHaveBeenCalled();
      expect(onBadgeClick).not.toHaveBeenCalled();
    });

    it('should scale remove icon based on size', () => {
      const { rerender } = render(<Badge size="sm" onRemove={vi.fn()}>Small</Badge>);
      let button = screen.getByRole('button', { name: 'Remove' });
      expect(button.querySelector('svg')).toHaveClass('h-2.5');

      rerender(<Badge size="md" onRemove={vi.fn()}>Medium</Badge>);
      button = screen.getByRole('button', { name: 'Remove' });
      expect(button.querySelector('svg')).toHaveClass('h-3');
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should use inline-flex for layout', () => {
      renderBadge();

      expect(screen.getByText('Badge')).toHaveClass('inline-flex');
    });

    it('should have accessible remove button', () => {
      renderBadge({ onRemove: vi.fn() });

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      expect(removeButton).toHaveAttribute('aria-label', 'Remove');
    });
  });
});

// ============================================================================
// StatusBadge Tests
// ============================================================================

describe('StatusBadge', () => {
  const statusTypes: StatusType[] = ['active', 'inactive', 'pending', 'error', 'success', 'warning'];

  describe('Rendering', () => {
    it.each(statusTypes)('should render %s status', (status) => {
      render(<StatusBadge status={status} />);

      expect(screen.getByText(status.charAt(0).toUpperCase() + status.slice(1))).toBeInTheDocument();
    });

    it('should use default label from status map', () => {
      render(<StatusBadge status="active" />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should use custom children over default label', () => {
      render(<StatusBadge status="active">Online</StatusBadge>);

      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });
  });

  describe('Dot Display', () => {
    it('should show dot by default', () => {
      render(<StatusBadge status="active" />);

      const badge = screen.getByText('Active');
      const dot = badge.querySelector('.rounded-full');
      expect(dot).toBeInTheDocument();
    });

    it('should hide dot when showDot is false', () => {
      render(<StatusBadge status="active" showDot={false} />);

      const badge = screen.getByText('Active');
      const dots = badge.querySelectorAll('.h-1\\.5.rounded-full');
      expect(dots.length).toBe(0);
    });
  });

  describe('Variant Mapping', () => {
    it('should map active to success variant', () => {
      render(<StatusBadge status="active" />);

      expect(screen.getByText('Active')).toHaveClass('bg-success-50');
    });

    it('should map inactive to default variant', () => {
      render(<StatusBadge status="inactive" />);

      expect(screen.getByText('Inactive')).toHaveClass('bg-gray-100');
    });

    it('should map pending to warning variant', () => {
      render(<StatusBadge status="pending" />);

      expect(screen.getByText('Pending')).toHaveClass('bg-warning-50');
    });

    it('should map error to error variant', () => {
      render(<StatusBadge status="error" />);

      expect(screen.getByText('Error')).toHaveClass('bg-error-50');
    });
  });

  describe('Props Forwarding', () => {
    it('should forward size prop', () => {
      render(<StatusBadge status="active" size="lg" />);

      expect(screen.getByText('Active')).toHaveClass('px-2.5');
    });

    it('should forward className prop', () => {
      render(<StatusBadge status="active" className="my-class" />);

      expect(screen.getByText('Active')).toHaveClass('my-class');
    });
  });
});

// ============================================================================
// CountBadge Tests
// ============================================================================

describe('CountBadge', () => {
  describe('Rendering', () => {
    it('should render count', () => {
      render(<CountBadge count={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render as badge element', () => {
      render(<CountBadge count={5} />);

      expect(screen.getByText('5').tagName).toBe('SPAN');
    });
  });

  describe('Max Count', () => {
    it('should show count as-is when below max', () => {
      render(<CountBadge count={50} max={99} />);

      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should show max+ when count exceeds max', () => {
      render(<CountBadge count={150} max={99} />);

      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should use 99 as default max', () => {
      render(<CountBadge count={100} />);

      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should show exact count when equal to max', () => {
      render(<CountBadge count={99} max={99} />);

      expect(screen.getByText('99')).toBeInTheDocument();
    });

    it('should handle custom max', () => {
      render(<CountBadge count={15} max={10} />);

      expect(screen.getByText('10+')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should use primary variant by default', () => {
      render(<CountBadge count={5} />);

      expect(screen.getByText('5')).toHaveClass('bg-primary-100');
    });

    it('should accept custom variant', () => {
      render(<CountBadge count={5} variant="error" />);

      expect(screen.getByText('5')).toHaveClass('bg-error-50');
    });

    it('should use sm size', () => {
      render(<CountBadge count={5} />);

      expect(screen.getByText('5')).toHaveClass('px-1.5');
    });

    it('should have minimum width for centering', () => {
      render(<CountBadge count={5} />);

      expect(screen.getByText('5')).toHaveClass('min-w-[20px]');
    });

    it('should center content', () => {
      render(<CountBadge count={5} />);

      expect(screen.getByText('5')).toHaveClass('justify-center');
    });

    it('should apply custom className', () => {
      render(<CountBadge count={5} className="my-custom-class" />);

      expect(screen.getByText('5')).toHaveClass('my-custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero count', () => {
      render(<CountBadge count={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle negative count', () => {
      render(<CountBadge count={-5} />);

      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      render(<CountBadge count={1000000} max={999} />);

      expect(screen.getByText('999+')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Badge Integration', () => {
  it('should work with all props combined', () => {
    const onRemove = vi.fn();

    render(
      <Badge
        variant="success"
        size="lg"
        icon={<TestIcon />}
        rounded={false}
        onRemove={onRemove}
        className="my-badge"
      >
        Featured
      </Badge>
    );

    const badge = screen.getByText('Featured');
    expect(badge).toHaveClass('bg-success-50');
    expect(badge).toHaveClass('px-2.5');
    expect(badge).toHaveClass('rounded');
    expect(badge).toHaveClass('my-badge');
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('should handle multiple badges', () => {
    render(
      <>
        <Badge variant="primary">React</Badge>
        <Badge variant="success">TypeScript</Badge>
        <Badge variant="warning">JavaScript</Badge>
      </>
    );

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
  });
});
