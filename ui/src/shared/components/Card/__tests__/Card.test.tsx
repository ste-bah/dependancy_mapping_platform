/**
 * Card Component Tests
 * Comprehensive tests for Card compound components
 * @module shared/components/Card/__tests__/Card.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  useCardContext,
  type CardProps,
} from '../Card';

// ============================================================================
// Test Utilities
// ============================================================================

const renderCard = (props: Partial<CardProps> = {}) => {
  return render(
    <Card data-testid="card" {...props}>
      {props.children ?? <span>Card content</span>}
    </Card>
  );
};

// Helper component to test context
const ContextConsumer = () => {
  const context = useCardContext();
  return <span data-testid="context">{context.interactive ? 'interactive' : 'static'}</span>;
};

// ============================================================================
// Card Component Tests
// ============================================================================

describe('Card', () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render card with children', () => {
      renderCard();

      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      renderCard();

      const card = screen.getByTestId('card');
      expect(card.tagName).toBe('DIV');
    });

    it('should forward ref', () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Test</Card>);

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });

    it('should apply custom className', () => {
      render(<Card data-testid="card" className="custom-card">Test</Card>);

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-card');
    });

    it('should spread additional props', () => {
      render(<Card data-testid="my-card" id="card-1">Test</Card>);

      const card = screen.getByTestId('my-card');
      expect(card).toHaveAttribute('id', 'card-1');
    });
  });

  // ==========================================================================
  // Variant Tests
  // ==========================================================================

  describe('Variants', () => {
    it('should use default variant by default', () => {
      renderCard();

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('shadow-sm');
    });

    it('should apply outlined variant', () => {
      renderCard({ variant: 'outlined' });

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('border-2');
      expect(card).toHaveClass('bg-white');
    });

    it('should apply elevated variant', () => {
      renderCard({ variant: 'elevated' });

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('shadow-lg');
      expect(card).toHaveClass('bg-white');
    });
  });

  // ==========================================================================
  // Interactive Tests
  // ==========================================================================

  describe('Interactive', () => {
    it('should not be interactive by default', () => {
      renderCard();

      const card = screen.getByTestId('card');
      expect(card).not.toHaveAttribute('role', 'button');
      expect(card).not.toHaveAttribute('tabIndex');
    });

    it('should add button role when interactive', () => {
      renderCard({ interactive: true });

      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('should be focusable when interactive', () => {
      renderCard({ interactive: true });

      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should apply hover styles when interactive', () => {
      renderCard({ interactive: true });

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('cursor-pointer');
      expect(card).toHaveClass('hover:shadow-md');
    });

    it('should handle click when interactive', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<Card data-testid="card" interactive onClick={onClick}>Clickable</Card>);

      await user.click(screen.getByTestId('card'));

      expect(onClick).toHaveBeenCalled();
    });

    it('should be focusable when interactive for keyboard accessibility', () => {
      render(<Card data-testid="card" interactive>Focusable</Card>);

      const card = screen.getByTestId('card');
      card.focus();

      // Card should be focusable (receives focus)
      expect(document.activeElement).toBe(card);
      // Card has role="button" and tabIndex=0 for accessibility
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  // ==========================================================================
  // Padding Tests
  // ==========================================================================

  describe('Padding', () => {
    it('should have padding by default', () => {
      renderCard();

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('p-6');
    });

    it('should remove padding when noPadding is true', () => {
      renderCard({ noPadding: true });

      const card = screen.getByTestId('card');
      expect(card).not.toHaveClass('p-6');
    });
  });

  // ==========================================================================
  // Context Tests
  // ==========================================================================

  describe('Context', () => {
    it('should provide interactive false by default', () => {
      render(
        <Card>
          <ContextConsumer />
        </Card>
      );

      expect(screen.getByTestId('context')).toHaveTextContent('static');
    });

    it('should provide interactive true when card is interactive', () => {
      render(
        <Card interactive>
          <ContextConsumer />
        </Card>
      );

      expect(screen.getByTestId('context')).toHaveTextContent('interactive');
    });
  });

  // ==========================================================================
  // Styling Tests
  // ==========================================================================

  describe('Styling', () => {
    it('should have rounded corners', () => {
      renderCard();

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-lg');
    });
  });
});

// ============================================================================
// CardHeader Tests
// ============================================================================

describe('CardHeader', () => {
  it('should render children', () => {
    render(<CardHeader>Header Content</CardHeader>);

    expect(screen.getByText('Header Content')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardHeader ref={ref}>Header</CardHeader>);

    expect(ref).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<CardHeader data-testid="header" className="my-header">Header</CardHeader>);

    expect(screen.getByTestId('header')).toHaveClass('my-header');
  });

  it('should render action element', () => {
    render(
      <CardHeader action={<button>Action</button>}>
        Header
      </CardHeader>
    );

    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('should use flex layout', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);

    const header = screen.getByTestId('header');
    expect(header).toHaveClass('flex');
    expect(header).toHaveClass('items-start');
    expect(header).toHaveClass('justify-between');
  });

  it('should place action on the right', () => {
    render(
      <CardHeader action={<span data-testid="action">Action</span>}>
        Header
      </CardHeader>
    );

    const action = screen.getByTestId('action').parentElement;
    expect(action).toHaveClass('shrink-0');
  });
});

// ============================================================================
// CardTitle Tests
// ============================================================================

describe('CardTitle', () => {
  it('should render as h3 by default', () => {
    render(<CardTitle>Title</CardTitle>);

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title');
  });

  it('should render as custom heading level', () => {
    render(<CardTitle as="h1">Title</CardTitle>);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
  });

  it('should render as h2', () => {
    render(<CardTitle as="h2">Title</CardTitle>);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardTitle ref={ref}>Title</CardTitle>);

    expect(ref).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<CardTitle className="my-title">Title</CardTitle>);

    expect(screen.getByRole('heading')).toHaveClass('my-title');
  });

  it('should have proper styling', () => {
    render(<CardTitle>Title</CardTitle>);

    const title = screen.getByRole('heading');
    expect(title).toHaveClass('text-lg');
    expect(title).toHaveClass('font-semibold');
    expect(title).toHaveClass('text-gray-900');
  });
});

// ============================================================================
// CardDescription Tests
// ============================================================================

describe('CardDescription', () => {
  it('should render children', () => {
    render(<CardDescription>Description text</CardDescription>);

    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should render as paragraph', () => {
    render(<CardDescription>Description</CardDescription>);

    expect(screen.getByText('Description').tagName).toBe('P');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardDescription ref={ref}>Description</CardDescription>);

    expect(ref).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<CardDescription className="my-desc">Description</CardDescription>);

    expect(screen.getByText('Description')).toHaveClass('my-desc');
  });

  it('should have muted styling', () => {
    render(<CardDescription>Description</CardDescription>);

    const desc = screen.getByText('Description');
    expect(desc).toHaveClass('text-sm');
    expect(desc).toHaveClass('text-gray-500');
  });
});

// ============================================================================
// CardContent Tests
// ============================================================================

describe('CardContent', () => {
  it('should render children', () => {
    render(<CardContent>Content here</CardContent>);

    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardContent ref={ref}>Content</CardContent>);

    expect(ref).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<CardContent data-testid="content" className="my-content">Content</CardContent>);

    expect(screen.getByTestId('content')).toHaveClass('my-content');
  });

  it('should have top margin', () => {
    render(<CardContent data-testid="content">Content</CardContent>);

    expect(screen.getByTestId('content')).toHaveClass('mt-4');
  });
});

// ============================================================================
// CardFooter Tests
// ============================================================================

describe('CardFooter', () => {
  it('should render children', () => {
    render(<CardFooter>Footer content</CardFooter>);

    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardFooter ref={ref}>Footer</CardFooter>);

    expect(ref).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<CardFooter data-testid="footer" className="my-footer">Footer</CardFooter>);

    expect(screen.getByTestId('footer')).toHaveClass('my-footer');
  });

  it('should have border top', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);

    expect(screen.getByTestId('footer')).toHaveClass('border-t');
  });

  it('should have proper spacing', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('mt-6');
    expect(footer).toHaveClass('pt-4');
  });

  describe('Alignment', () => {
    it('should align right by default', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);

      expect(screen.getByTestId('footer')).toHaveClass('justify-end');
    });

    it('should align left', () => {
      render(<CardFooter data-testid="footer" align="left">Footer</CardFooter>);

      expect(screen.getByTestId('footer')).toHaveClass('justify-start');
    });

    it('should align center', () => {
      render(<CardFooter data-testid="footer" align="center">Footer</CardFooter>);

      expect(screen.getByTestId('footer')).toHaveClass('justify-center');
    });

    it('should align between', () => {
      render(<CardFooter data-testid="footer" align="between">Footer</CardFooter>);

      expect(screen.getByTestId('footer')).toHaveClass('justify-between');
    });
  });

  it('should use flex layout with gap', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('flex');
    expect(footer).toHaveClass('items-center');
    expect(footer).toHaveClass('gap-3');
  });
});

// ============================================================================
// Compound Component Integration Tests
// ============================================================================

describe('Card Compound Components', () => {
  it('should render complete card with all subcomponents', () => {
    render(
      <Card>
        <CardHeader action={<button>Edit</button>}>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content goes here</p>
        </CardContent>
        <CardFooter>
          <button>Cancel</button>
          <button>Save</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument();
    expect(screen.getByText('Card description text')).toBeInTheDocument();
    expect(screen.getByText('Main content goes here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('should work as interactive card', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Card interactive onClick={onClick}>
        <CardHeader>
          <CardTitle>Interactive Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Click anywhere on this card</p>
        </CardContent>
      </Card>
    );

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalled();
  });

  it('should support header-only card', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Simple Card</CardTitle>
        </CardHeader>
      </Card>
    );

    expect(screen.getByRole('heading', { name: 'Simple Card' })).toBeInTheDocument();
  });

  it('should support content-only card', () => {
    render(
      <Card>
        <CardContent>
          <p>Just content</p>
        </CardContent>
      </Card>
    );

    expect(screen.getByText('Just content')).toBeInTheDocument();
  });

  it('should support card with footer actions', () => {
    render(
      <Card>
        <CardContent>Content</CardContent>
        <CardFooter align="between">
          <span>Status: Active</span>
          <div>
            <button>Edit</button>
            <button>Delete</button>
          </div>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Status: Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});

// ============================================================================
// useCardContext Hook Tests
// ============================================================================

describe('useCardContext', () => {
  it('should return default context outside Card', () => {
    render(<ContextConsumer />);

    expect(screen.getByTestId('context')).toHaveTextContent('static');
  });

  it('should return correct context from Card', () => {
    render(
      <Card interactive>
        <ContextConsumer />
      </Card>
    );

    expect(screen.getByTestId('context')).toHaveTextContent('interactive');
  });
});
