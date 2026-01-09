import { View, type ViewProps } from 'react-native';
import { cn } from '../utils';

export interface ProgressBarProps extends ViewProps {
  className?: string;
  progress: number; // 0 to 1
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showOverflow?: boolean;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const variantClasses = {
  default: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
};

export function ProgressBar({
  className,
  progress,
  variant = 'default',
  size = 'md',
  showOverflow = false,
  ...props
}: ProgressBarProps) {
  // Clamp progress between 0 and 1 (unless showOverflow)
  const clampedProgress = showOverflow
    ? Math.min(progress, 1.5) // Cap at 150% for visual
    : Math.max(0, Math.min(progress, 1));

  // Determine color based on progress if no variant specified
  let effectiveVariant = variant;
  if (variant === 'default' && progress > 1) {
    effectiveVariant = 'danger';
  } else if (variant === 'default' && progress > 0.8) {
    effectiveVariant = 'warning';
  }

  return (
    <View
      className={cn(
        'w-full overflow-hidden rounded-full bg-gray-200',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <View
        className={cn('h-full rounded-full', variantClasses[effectiveVariant])}
        style={{ width: `${clampedProgress * 100}%` }}
      />
    </View>
  );
}

/**
 * Progress bar with budget-aware coloring
 */
export function BudgetProgress({
  planned,
  actual,
  limit,
  className,
  ...props
}: Omit<ProgressBarProps, 'progress' | 'variant'> & {
  planned: number;
  actual: number;
  limit?: number | null;
}) {
  const progress = planned > 0 ? actual / planned : 0;
  const limitProgress = limit && limit > 0 ? actual / limit : progress;

  let variant: 'default' | 'success' | 'warning' | 'danger' = 'success';

  if (limit) {
    if (limitProgress >= 1) {
      variant = 'danger';
    } else if (limitProgress >= 0.8) {
      variant = 'warning';
    }
  } else {
    if (progress >= 1) {
      variant = 'danger';
    } else if (progress >= 0.8) {
      variant = 'warning';
    }
  }

  return (
    <ProgressBar
      progress={progress}
      variant={variant}
      showOverflow={progress > 1}
      className={className}
      {...props}
    />
  );
}
