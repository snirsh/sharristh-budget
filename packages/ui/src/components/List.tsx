import { View, Text, Pressable, type ViewProps } from 'react-native';
import { cn } from '../utils';

export interface ListItemProps extends ViewProps {
  className?: string;
  title: string;
  subtitle?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

export function ListItem({
  className,
  title,
  subtitle,
  leftContent,
  rightContent,
  onPress,
  disabled,
  ...props
}: ListItemProps) {
  const content = (
    <View
      className={cn(
        'flex-row items-center border-b border-gray-100 bg-white px-4 py-3',
        disabled && 'opacity-50',
        className
      )}
      {...props}
    >
      {leftContent && <View className="mr-3">{leftContent}</View>}
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">{title}</Text>
        {subtitle && (
          <Text className="mt-0.5 text-sm text-gray-500">{subtitle}</Text>
        )}
      </View>
      {rightContent && <View className="ml-3">{rightContent}</View>}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable onPress={onPress} className="active:opacity-70">
        {content}
      </Pressable>
    );
  }

  return content;
}

export interface ListSectionProps extends ViewProps {
  className?: string;
  title?: string;
  children: React.ReactNode;
}

export function ListSection({
  className,
  title,
  children,
  ...props
}: ListSectionProps) {
  return (
    <View className={cn('mb-6', className)} {...props}>
      {title && (
        <Text className="mb-2 px-4 text-sm font-medium uppercase text-gray-500">
          {title}
        </Text>
      )}
      <View className="overflow-hidden rounded-lg border border-gray-200">
        {children}
      </View>
    </View>
  );
}

export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: ViewProps & {
  className?: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      className={cn('items-center justify-center p-8', className)}
      {...props}
    >
      {icon && <View className="mb-4">{icon}</View>}
      <Text className="text-center text-lg font-semibold text-gray-900">
        {title}
      </Text>
      {description && (
        <Text className="mt-2 text-center text-gray-500">{description}</Text>
      )}
      {action && <View className="mt-4">{action}</View>}
    </View>
  );
}

