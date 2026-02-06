/**
 * Class Name Utility
 * Combines clsx and tailwind-merge for efficient class name handling
 * @module shared/utils/cn
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS conflict resolution
 *
 * This utility combines clsx for conditional class handling
 * with tailwind-merge for deduplicating and merging Tailwind classes.
 *
 * @param inputs - Class values to merge
 * @returns Merged class string
 *
 * @example
 * // Basic usage
 * cn('px-2', 'py-1', 'bg-blue-500')
 * // => 'px-2 py-1 bg-blue-500'
 *
 * @example
 * // With conditionals
 * cn('base-class', isActive && 'active-class', { 'error-class': hasError })
 * // => 'base-class active-class' or 'base-class error-class'
 *
 * @example
 * // Merging conflicting Tailwind classes
 * cn('px-2 py-1', 'p-4')
 * // => 'p-4' (p-4 overrides px-2 and py-1)
 *
 * @example
 * // With arrays
 * cn(['class-a', 'class-b'], 'class-c')
 * // => 'class-a class-b class-c'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Variant Helpers
// ============================================================================

/**
 * Create a variant mapper for component styling
 *
 * @example
 * const buttonVariants = createVariants({
 *   base: 'inline-flex items-center justify-center rounded-md font-medium',
 *   variants: {
 *     variant: {
 *       primary: 'bg-primary text-white hover:bg-primary/90',
 *       secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
 *       outline: 'border border-input bg-background hover:bg-accent',
 *     },
 *     size: {
 *       sm: 'h-8 px-3 text-sm',
 *       md: 'h-10 px-4 text-base',
 *       lg: 'h-12 px-6 text-lg',
 *     },
 *   },
 *   defaultVariants: {
 *     variant: 'primary',
 *     size: 'md',
 *   },
 * });
 *
 * buttonVariants({ variant: 'secondary', size: 'lg' })
 */
export interface VariantConfig<T extends Record<string, Record<string, string>>> {
  base?: string;
  variants: T;
  defaultVariants?: {
    [K in keyof T]?: keyof T[K];
  };
}

export type VariantProps<T extends Record<string, Record<string, string>>> = {
  [K in keyof T]?: keyof T[K];
};

export function createVariants<T extends Record<string, Record<string, string>>>(
  config: VariantConfig<T>
): (props?: VariantProps<T>) => string {
  return (props = {}) => {
    const classes: string[] = [];

    // Add base classes
    if (config.base) {
      classes.push(config.base);
    }

    // Add variant classes
    for (const variantKey of Object.keys(config.variants) as (keyof T)[]) {
      const variantValue =
        props[variantKey] ?? config.defaultVariants?.[variantKey];

      if (variantValue !== undefined) {
        const variantGroup = config.variants[variantKey];
        const variantClasses = variantGroup?.[variantValue as string];
        if (variantClasses) {
          classes.push(variantClasses);
        }
      }
    }

    return cn(...classes);
  };
}

// ============================================================================
// Additional Utilities
// ============================================================================

/**
 * Generate focus ring classes
 */
export function focusRing(color = 'primary'): string {
  return cn(
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    color === 'primary' && 'focus:ring-primary',
    color === 'secondary' && 'focus:ring-secondary',
    color === 'destructive' && 'focus:ring-destructive'
  );
}

/**
 * Generate disabled state classes
 */
export function disabledClasses(): string {
  return 'disabled:pointer-events-none disabled:opacity-50';
}

/**
 * Combine base component classes with custom classes
 */
export function componentClasses(
  base: string,
  className?: string
): string {
  return className ? cn(base, className) : base;
}
