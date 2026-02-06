/**
 * Shared Module Index
 * Re-exports all shared utilities and components
 * @module shared
 */

// Utilities
export {
  cn,
  createVariants,
  focusRing,
  disabledClasses,
  componentClasses,
  type VariantConfig,
  type VariantProps,
} from './utils';

// Components
export {
  // Button
  Button,
  IconButton,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  type IconButtonProps,

  // Card
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  useCardContext,
  type CardProps,
  type CardHeaderProps,
  type CardTitleProps,
  type CardDescriptionProps,
  type CardContentProps,
  type CardFooterProps,

  // Form
  Input,
  Textarea,
  Select,
  FormGroup,
  type InputProps,
  type TextareaProps,
  type SelectProps,
  type SelectOption,
  type FormGroupProps,

  // Loading
  Spinner,
  DotsSpinner,
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
  PageLoader,
  InlineLoader,
  LoadingContent,
  LoadingGate,
  type SpinnerProps,
  type DotsSpinnerProps,
  type SkeletonProps,
  type PageLoaderProps,
  type InlineLoaderProps,
  type LoadingContentProps,
  type LoadingGateProps,

  // Alert
  Alert,
  AlertDescription,
  InlineAlert,
  type AlertProps,
  type AlertVariant,
  type AlertDescriptionProps,
  type InlineAlertProps,

  // Badge
  Badge,
  StatusBadge,
  CountBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type StatusBadgeProps,
  type StatusType,
  type CountBadgeProps,
} from './components';
