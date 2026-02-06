/**
 * Shared Components Index
 * Barrel export for all shared UI components
 * @module shared/components
 */

// ============================================================================
// Button
// ============================================================================

export {
  Button,
  IconButton,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  type IconButtonProps,
} from './Button/Button';

// ============================================================================
// Card
// ============================================================================

export {
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
} from './Card/Card';

// ============================================================================
// Form Components
// ============================================================================

export {
  Input,
  Textarea,
  Select,
  FormGroup,
  type InputProps,
  type TextareaProps,
  type SelectProps,
  type SelectOption,
  type FormGroupProps,
} from './Form';

// ============================================================================
// Loading Components
// ============================================================================

export {
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
} from './Loading';

// ============================================================================
// Alert
// ============================================================================

export {
  Alert,
  AlertDescription,
  InlineAlert,
  type AlertProps,
  type AlertVariant,
  type AlertDescriptionProps,
  type InlineAlertProps,
} from './Alert/Alert';

// ============================================================================
// Badge
// ============================================================================

export {
  Badge,
  StatusBadge,
  CountBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type StatusBadgeProps,
  type StatusType,
  type CountBadgeProps,
} from './Badge/Badge';
