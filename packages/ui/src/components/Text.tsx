import { type VariantProps, cva } from 'class-variance-authority';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '../utils';

const textVariants = cva('text-gray-900', {
  variants: {
    variant: {
      default: 'text-base',
      heading: 'text-2xl font-bold',
      subheading: 'text-lg font-semibold',
      body: 'text-base',
      caption: 'text-sm text-gray-500',
      label: 'text-sm font-medium',
      muted: 'text-gray-500',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {
  className?: string;
}

export function Text({ className, variant, size, weight, align, ...props }: TextProps) {
  return (
    <RNText className={cn(textVariants({ variant, size, weight, align }), className)} {...props} />
  );
}
