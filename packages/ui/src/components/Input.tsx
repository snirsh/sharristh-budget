import { type VariantProps, cva } from 'class-variance-authority';
import { forwardRef } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';
import { cn } from '../utils';

const inputVariants = cva('rounded-lg border bg-white px-4 py-3 text-base text-gray-900', {
  variants: {
    variant: {
      default: 'border-gray-300 focus:border-primary-500',
      error: 'border-danger-500',
      success: 'border-success-500',
    },
    inputSize: {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-5 py-4 text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    inputSize: 'md',
  },
});

export interface InputProps
  extends Omit<TextInputProps, 'size'>,
    VariantProps<typeof inputVariants> {
  className?: string;
  containerClassName?: string;
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      className,
      containerClassName,
      variant,
      inputSize,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    return (
      <View className={cn('w-full', containerClassName)}>
        {label && <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>}
        <View className="relative">
          {leftIcon && (
            <View className="absolute left-3 top-1/2 z-10 -translate-y-1/2">{leftIcon}</View>
          )}
          <TextInput
            ref={ref}
            className={cn(
              inputVariants({ variant: hasError ? 'error' : variant, inputSize }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            placeholderTextColor="#9ca3af"
            {...props}
          />
          {rightIcon && (
            <View className="absolute right-3 top-1/2 z-10 -translate-y-1/2">{rightIcon}</View>
          )}
        </View>
        {(error || helperText) && (
          <Text className={cn('mt-1 text-sm', hasError ? 'text-danger-500' : 'text-gray-500')}>
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';
