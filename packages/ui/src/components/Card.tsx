import { type VariantProps, cva } from 'class-variance-authority';
import { View, type ViewProps } from 'react-native';
import { cn } from '../utils';

const cardVariants = cva('rounded-xl', {
  variants: {
    variant: {
      default: 'bg-white shadow-md',
      elevated: 'bg-white shadow-lg',
      outlined: 'border border-gray-200 bg-white',
      filled: 'bg-gray-50',
    },
    padding: {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
});

export interface CardProps extends ViewProps, VariantProps<typeof cardVariants> {
  className?: string;
}

export function Card({ className, variant, padding, ...props }: CardProps) {
  return <View className={cn(cardVariants({ variant, padding }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('mb-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('flex-row items-center justify-between', className)} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('mt-4 flex-row justify-end', className)} {...props} />;
}
