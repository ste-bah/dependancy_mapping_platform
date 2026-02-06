/**
 * Button Component
 * Versatile button with variants, sizes, loading state, and icon support
 * @module shared/components/Button
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ReactElement,
  cloneElement,
  isValidElement,
  Children,
} from 'react';
import { cn, createVariants, focusRing, disabledClasses } from '@/shared/utils';

// ============================================================================
// Slot Implementation (lightweight alternative to @radix-ui/react-slot)
// ============================================================================

interface SlotProps {
  children?: ReactNode;
  [key: string]: unknown;
}

/**
 * Merges props onto child element, enabling the "asChild" pattern
 */
function Slot({ children, ...props }: SlotProps): ReactElement | null {
  if (isValidElement(children)) {
    return cloneElement(children, {
      ...props,
      ...children.props,
      className: cn(props.className as string, children.props.className),
    });
  }

  if (Children.count(children) > 1) {
    Children.only(null); // Throws error for multiple children
  }

  return null;
}

// ============================================================================
// Types
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Show loading spinner */
  loading?: boolean;
  /** Icon to display before text */
  leftIcon?: ReactNode;
  /** Icon to display after text */
  rightIcon?: ReactNode;
  /** Render as child element (Slot pattern) */
  asChild?: boolean;
  /** Full width button */
  fullWidth?: boolean;
}

// ============================================================================
// Variants
// ============================================================================

const buttonVariants = createVariants({
  base: cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium',
    'transition-colors duration-200',
    focusRing('primary'),
    disabledClasses()
  ),
  variants: {
    variant: {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
      outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100',
      ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200',
      danger: 'bg-error-500 text-white hover:bg-error-600 active:bg-error-600',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

// ============================================================================
// Loading Spinner
// ============================================================================

function LoadingSpinner({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// Button Component
// ============================================================================

/**
 * Button component with multiple variants and features
 *
 * @example
 * // Primary button
 * <Button>Click me</Button>
 *
 * @example
 * // With loading state
 * <Button loading>Saving...</Button>
 *
 * @example
 * // With icons
 * <Button leftIcon={<PlusIcon />}>Add item</Button>
 *
 * @example
 * // As a link (Slot pattern)
 * <Button asChild>
 *   <a href="/somewhere">Go somewhere</a>
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      asChild = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    // Spinner sizes based on button size
    const spinnerSizes = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full',
          className
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <LoadingSpinner className={spinnerSizes[size]} />
        )}
        {!loading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </Comp>
    );
  }
);

// ============================================================================
// Icon Button Variant
// ============================================================================

export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'children'> {
  /** Accessible label for the button */
  'aria-label': string;
  /** Icon to display */
  icon: ReactNode;
}

/**
 * Icon-only button with required accessibility label
 *
 * @example
 * <IconButton icon={<TrashIcon />} aria-label="Delete item" variant="danger" />
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { className, size = 'md', icon, ...props },
    ref
  ) {
    // Square sizing for icon buttons
    const iconButtonSizes = {
      sm: 'h-8 w-8 p-0',
      md: 'h-10 w-10 p-0',
      lg: 'h-12 w-12 p-0',
    };

    return (
      <Button
        ref={ref}
        className={cn(iconButtonSizes[size], className)}
        size={size}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

export default Button;
