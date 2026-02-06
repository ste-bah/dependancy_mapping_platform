/**
 * Card Component
 * Compound component for consistent card layouts
 * @module shared/components/Card
 */

import { forwardRef, type HTMLAttributes, type ReactNode, createContext, useContext } from 'react';
import { cn } from '@/shared/utils';

// ============================================================================
// Context for Card State
// ============================================================================

interface CardContextValue {
  /** Whether the card is interactive */
  interactive: boolean;
}

const CardContext = createContext<CardContextValue>({ interactive: false });

// ============================================================================
// Types
// ============================================================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card content */
  children: ReactNode;
  /** Whether the card is interactive (clickable) */
  interactive?: boolean;
  /** Remove padding from card */
  noPadding?: boolean;
  /** Card visual variant */
  variant?: 'default' | 'outlined' | 'elevated';
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Header content */
  children: ReactNode;
  /** Action elements (buttons, icons) for the right side */
  action?: ReactNode;
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Content */
  children: ReactNode;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Footer content */
  children: ReactNode;
  /** Align footer content */
  align?: 'left' | 'center' | 'right' | 'between';
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Title text */
  children: ReactNode;
  /** HTML heading level */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Description text */
  children: ReactNode;
}

// ============================================================================
// Card Components
// ============================================================================

/**
 * Card container component
 *
 * @example
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Optional description</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Card content goes here</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Action</Button>
 *   </CardFooter>
 * </Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    {
      className,
      children,
      interactive = false,
      noPadding = false,
      variant = 'default',
      ...props
    },
    ref
  ) {
    const variantStyles = {
      default: 'border bg-white shadow-sm',
      outlined: 'border-2 bg-white',
      elevated: 'bg-white shadow-lg',
    };

    return (
      <CardContext.Provider value={{ interactive }}>
        <div
          ref={ref}
          className={cn(
            'rounded-lg',
            variantStyles[variant],
            interactive && 'cursor-pointer transition-shadow hover:shadow-md',
            !noPadding && 'p-6',
            className
          )}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          {...props}
        >
          {children}
        </div>
      </CardContext.Provider>
    );
  }
);

/**
 * Card header with optional action slot
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  function CardHeader({ className, children, action, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-start justify-between gap-4', className)}
        {...props}
      >
        <div className="flex-1 space-y-1">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
);

/**
 * Card title
 */
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  function CardTitle({ className, children, as: Component = 'h3', ...props }, ref) {
    return (
      <Component
        ref={ref}
        className={cn('text-lg font-semibold text-gray-900', className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

/**
 * Card description text
 */
export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  function CardDescription({ className, children, ...props }, ref) {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-gray-500', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);

/**
 * Card content area
 */
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  function CardContent({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('mt-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

/**
 * Card footer with alignment options
 */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  function CardFooter(
    { className, children, align = 'right', ...props },
    ref
  ) {
    const alignmentStyles = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'mt-6 flex items-center gap-3 border-t pt-4',
          alignmentStyles[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// Hook for Card Context
// ============================================================================

export function useCardContext(): CardContextValue {
  return useContext(CardContext);
}

export default Card;
