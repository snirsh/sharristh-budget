import { View, Text, type ViewProps } from 'react-native';
import { cn } from '../utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva('rounded-full px-2.5 py-0.5', {
  variants: {
    variant: {
      default: 'bg-gray-100',
      primary: 'bg-primary-100',
      secondary: 'bg-secondary-100',
      success: 'bg-success-100',
      warning: 'bg-warning-100',
      danger: 'bg-danger-100',
      outline: 'border border-gray-300 bg-transparent',
    },
    size: {
      sm: 'px-2 py-0.5',
      md: 'px-2.5 py-1',
      lg: 'px-3 py-1.5',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

const badgeTextVariants = cva('font-medium', {
  variants: {
    variant: {
      default: 'text-gray-700',
      primary: 'text-primary-700',
      secondary: 'text-secondary-700',
      success: 'text-success-700',
      warning: 'text-warning-700',
      danger: 'text-danger-700',
      outline: 'text-gray-700',
    },
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}

export function Badge({
  className,
  textClassName,
  variant,
  size,
  children,
  ...props
}: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {typeof children === 'string' ? (
        <Text className={cn(badgeTextVariants({ variant, size }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

/**
 * Convenience component for budget status badges
 */
export function StatusBadge({
  status,
  className,
  ...props
}: Omit<BadgeProps, 'variant' | 'children'> & {
  status: 'ok' | 'nearing_limit' | 'exceeded_soft' | 'exceeded_hard' | string;
}) {
  const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    ok: 'success',
    nearing_limit: 'warning',
    exceeded_soft: 'warning',
    exceeded_hard: 'danger',
  };

  const labelMap: Record<string, string> = {
    ok: 'On Track',
    nearing_limit: 'Nearing Limit',
    exceeded_soft: 'Over Budget',
    exceeded_hard: 'Exceeded',
  };

  return (
    <Badge
      variant={variantMap[status] || 'default'}
      className={className}
      {...props}
    >
      {labelMap[status] || status}
    </Badge>
  );
}

