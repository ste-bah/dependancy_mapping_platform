/**
 * Input Component Tests
 * Comprehensive tests for Input and Textarea components
 * @module shared/components/Form/__tests__/Input.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, Textarea, type InputProps } from '../Input';

// ============================================================================
// Test Utilities
// ============================================================================

const renderInput = (props: Partial<InputProps> = {}) => {
  return render(<Input {...props} />);
};

const SearchIcon = () => (
  <svg data-testid="search-icon" className="h-4 w-4">
    <circle cx="11" cy="11" r="8" />
  </svg>
);

// ============================================================================
// Input Component Tests
// ============================================================================

describe('Input', () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render input element', () => {
      renderInput();

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render with label', () => {
      renderInput({ label: 'Email Address' });

      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    });

    it('should forward ref', () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
    });

    it('should apply custom className', () => {
      render(<Input className="custom-input" />);

      expect(screen.getByRole('textbox')).toHaveClass('custom-input');
    });

    it('should spread additional props', () => {
      render(<Input data-testid="my-input" name="email" />);

      const input = screen.getByTestId('my-input');
      expect(input).toHaveAttribute('name', 'email');
    });

    it('should render placeholder', () => {
      render(<Input placeholder="Enter your email" />);

      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Label Tests
  // ==========================================================================

  describe('Label', () => {
    it('should associate label with input', () => {
      renderInput({ label: 'Username' });

      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
    });

    it('should use provided id for label association', () => {
      renderInput({ label: 'Username', id: 'custom-id' });

      const input = screen.getByLabelText('Username');
      expect(input).toHaveAttribute('id', 'custom-id');
    });

    it('should generate id when not provided', () => {
      renderInput({ label: 'Username' });

      const input = screen.getByLabelText('Username');
      expect(input.id).toBeTruthy();
    });

    it('should apply label size styles', () => {
      renderInput({ label: 'Username', size: 'lg' });

      const label = screen.getByText('Username');
      expect(label).toHaveClass('text-base');
    });

    it('should dim label when disabled', () => {
      renderInput({ label: 'Username', disabled: true });

      const label = screen.getByText('Username');
      expect(label).toHaveClass('opacity-50');
    });
  });

  // ==========================================================================
  // Size Tests
  // ==========================================================================

  describe('Sizes', () => {
    it('should use md size by default', () => {
      renderInput();

      expect(screen.getByRole('textbox')).toHaveClass('h-10');
    });

    it('should apply sm size styles', () => {
      renderInput({ size: 'sm' });

      expect(screen.getByRole('textbox')).toHaveClass('h-8');
    });

    it('should apply lg size styles', () => {
      renderInput({ size: 'lg' });

      expect(screen.getByRole('textbox')).toHaveClass('h-12');
    });
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  describe('Error State', () => {
    it('should render error message', () => {
      renderInput({ error: 'Email is required' });

      expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
    });

    it('should apply error styles to input', () => {
      renderInput({ error: 'Invalid input' });

      expect(screen.getByRole('textbox')).toHaveClass('border-error-500');
    });

    it('should set aria-invalid when error exists', () => {
      renderInput({ error: 'Invalid input' });

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error with input via aria-describedby', () => {
      renderInput({ label: 'Email', error: 'Invalid email', id: 'email' });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
    });

    it('should hide helper text when error is shown', () => {
      renderInput({
        error: 'Invalid email',
        helperText: 'We will never share your email',
      });

      expect(screen.queryByText('We will never share your email')).not.toBeInTheDocument();
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Helper Text Tests
  // ==========================================================================

  describe('Helper Text', () => {
    it('should render helper text', () => {
      renderInput({ helperText: 'Enter your primary email address' });

      expect(screen.getByText('Enter your primary email address')).toBeInTheDocument();
    });

    it('should associate helper text with input', () => {
      renderInput({ helperText: 'Helpful text', id: 'my-input' });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('helper'));
    });

    it('should not show helper when error exists', () => {
      renderInput({
        helperText: 'Helper',
        error: 'Error message',
      });

      expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Addon Tests
  // ==========================================================================

  describe('Left Addon', () => {
    it('should render left addon', () => {
      renderInput({ leftAddon: <SearchIcon /> });

      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('should render text addon', () => {
      renderInput({ leftAddon: 'https://' });

      expect(screen.getByText('https://')).toBeInTheDocument();
    });

    it('should remove left border radius from input', () => {
      renderInput({ leftAddon: 'prefix' });

      expect(screen.getByRole('textbox')).toHaveClass('rounded-l-none');
    });

    it('should hide addon from accessibility tree', () => {
      renderInput({ leftAddon: 'prefix' });

      // The addon wrapper div containing the text has aria-hidden="true"
      // getByText returns the element containing the text (the addon div itself)
      const addonWrapper = screen.getByText('prefix').closest('[aria-hidden="true"]');
      expect(addonWrapper).toBeInTheDocument();
      expect(addonWrapper).toHaveAttribute('aria-hidden', 'true');
    });

    it('should apply error styles to addon when error exists', () => {
      renderInput({ leftAddon: 'prefix', error: 'Error' });

      // The addon wrapper div has the error border class
      const addonWrapper = screen.getByText('prefix').closest('div[aria-hidden="true"]');
      expect(addonWrapper).toHaveClass('border-error-500');
    });
  });

  describe('Right Addon', () => {
    it('should render right addon', () => {
      renderInput({ rightAddon: '.com' });

      expect(screen.getByText('.com')).toBeInTheDocument();
    });

    it('should remove right border radius from input', () => {
      renderInput({ rightAddon: 'suffix' });

      expect(screen.getByRole('textbox')).toHaveClass('rounded-r-none');
    });
  });

  describe('Both Addons', () => {
    it('should render both addons', () => {
      renderInput({ leftAddon: 'https://', rightAddon: '.com' });

      expect(screen.getByText('https://')).toBeInTheDocument();
      expect(screen.getByText('.com')).toBeInTheDocument();
    });

    it('should apply correct border radius with both addons', () => {
      renderInput({ leftAddon: 'left', rightAddon: 'right' });

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('rounded-l-none');
      expect(input).toHaveClass('rounded-r-none');
    });
  });

  // ==========================================================================
  // Full Width Tests
  // ==========================================================================

  describe('Full Width', () => {
    it('should apply full width when fullWidth is true', () => {
      const { container } = renderInput({ fullWidth: true });

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('w-full');
    });

    it('should not have full width by default', () => {
      const { container } = renderInput();

      const wrapper = container.firstChild;
      expect(wrapper).not.toHaveClass('w-full');
    });
  });

  // ==========================================================================
  // Disabled State Tests
  // ==========================================================================

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      renderInput({ disabled: true });

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should apply disabled styles', () => {
      renderInput({ disabled: true });

      expect(screen.getByRole('textbox')).toHaveClass('disabled:opacity-50');
    });
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  describe('Interactions', () => {
    it('should handle onChange', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<Input onChange={onChange} />);

      await user.type(screen.getByRole('textbox'), 'hello');

      expect(onChange).toHaveBeenCalled();
    });

    it('should handle value changes', async () => {
      const { rerender } = render(<Input value="" onChange={() => {}} />);

      rerender(<Input value="test" onChange={() => {}} />);

      expect(screen.getByRole('textbox')).toHaveValue('test');
    });

    it('should be focusable', () => {
      renderInput();

      const input = screen.getByRole('textbox');
      input.focus();

      expect(document.activeElement).toBe(input);
    });

    it('should not be interactive when disabled', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<Input disabled onChange={onChange} />);

      await user.type(screen.getByRole('textbox'), 'test');

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have proper aria-invalid attribute', () => {
      renderInput({ error: 'Error' });

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not have aria-invalid when no error', () => {
      renderInput();

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
    });

    it('should maintain custom aria-describedby', () => {
      renderInput({ 'aria-describedby': 'custom-desc', error: 'Error' });

      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-describedby')).toContain('custom-desc');
    });

    it('should have focus ring styles', () => {
      renderInput();

      const input = screen.getByRole('textbox');
      expect(input.className).toMatch(/focus/);
    });
  });

  // ==========================================================================
  // Input Types Tests
  // ==========================================================================

  describe('Input Types', () => {
    it('should support email type', () => {
      render(<Input type="email" />);

      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    });

    it('should support password type', () => {
      render(<Input type="password" />);

      // Password inputs don't have textbox role
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it('should support number type', () => {
      render(<Input type="number" />);

      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Textarea Component Tests
// ============================================================================

describe('Textarea', () => {
  describe('Rendering', () => {
    it('should render textarea element', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    });

    it('should render with label', () => {
      render(<Textarea label="Description" />);

      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('should forward ref', () => {
      const ref = vi.fn();
      render(<Textarea ref={ref} />);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLTextAreaElement);
    });

    it('should apply custom className', () => {
      render(<Textarea className="custom-textarea" />);

      expect(screen.getByRole('textbox')).toHaveClass('custom-textarea');
    });
  });

  describe('Error State', () => {
    it('should render error message', () => {
      render(<Textarea error="Description is required" />);

      expect(screen.getByRole('alert')).toHaveTextContent('Description is required');
    });

    it('should apply error styles', () => {
      render(<Textarea error="Invalid" />);

      expect(screen.getByRole('textbox')).toHaveClass('border-error-500');
    });

    it('should set aria-invalid when error exists', () => {
      render(<Textarea error="Error" />);

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Helper Text', () => {
    it('should render helper text', () => {
      render(<Textarea helperText="Maximum 500 characters" />);

      expect(screen.getByText('Maximum 500 characters')).toBeInTheDocument();
    });

    it('should hide helper when error exists', () => {
      render(<Textarea helperText="Helper" error="Error" />);

      expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    });
  });

  describe('Full Width', () => {
    it('should apply full width', () => {
      const { container } = render(<Textarea fullWidth />);

      expect(container.firstChild).toHaveClass('w-full');
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Textarea disabled />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should dim label when disabled', () => {
      render(<Textarea label="Description" disabled />);

      expect(screen.getByText('Description')).toHaveClass('opacity-50');
    });
  });

  describe('Styling', () => {
    it('should have minimum height', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toHaveClass('min-h-[80px]');
    });

    it('should be resizable vertically', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toHaveClass('resize-y');
    });
  });

  describe('Interactions', () => {
    it('should handle onChange', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<Textarea onChange={onChange} />);

      await user.type(screen.getByRole('textbox'), 'hello');

      expect(onChange).toHaveBeenCalled();
    });

    it('should support multi-line input', async () => {
      const user = userEvent.setup();

      render(<Textarea />);

      await user.type(screen.getByRole('textbox'), 'line1{enter}line2');

      expect(screen.getByRole('textbox')).toHaveValue('line1\nline2');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Input Integration', () => {
  it('should work in a form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <Input
          label="Email"
          name="email"
          type="email"
          required
        />
        <button type="submit">Submit</button>
      </form>
    );

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('should show validation error', () => {
    render(
      <Input
        label="Email"
        error="Please enter a valid email address"
        leftAddon={<SearchIcon />}
      />
    );

    expect(screen.getByLabelText('Email')).toHaveClass('border-error-500');
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address');
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });
});
