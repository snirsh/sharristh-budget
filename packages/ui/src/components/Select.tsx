import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View, type ViewProps } from 'react-native';
import { cn } from '../utils';

export interface SelectOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ViewProps, 'children'> {
  className?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export function Select({
  className,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  error,
  disabled,
  ...props
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <View className={cn('w-full', className)} {...props}>
      {label && <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>}
      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        className={cn(
          'flex-row items-center justify-between rounded-lg border bg-white px-4 py-3',
          error ? 'border-danger-500' : 'border-gray-300',
          disabled && 'opacity-50'
        )}
      >
        <Text className={cn('text-base', selectedOption ? 'text-gray-900' : 'text-gray-400')}>
          {selectedOption?.label || placeholder}
        </Text>
        <Text className="text-gray-400">▼</Text>
      </Pressable>
      {error && <Text className="mt-1 text-sm text-danger-500">{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setIsOpen(false)}>
          <View className="max-h-96 rounded-t-2xl bg-white p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-semibold">{label || 'Select Option'}</Text>
              <Pressable onPress={() => setIsOpen(false)}>
                <Text className="text-primary-500 font-medium">Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (!item.disabled) {
                      onChange?.(item.value);
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    'flex-row items-center justify-between border-b border-gray-100 py-3',
                    item.disabled && 'opacity-50'
                  )}
                >
                  <View className="flex-row items-center">
                    {item.icon && <View className="mr-3">{item.icon}</View>}
                    <Text
                      className={cn(
                        'text-base',
                        item.value === value ? 'font-medium text-primary-500' : 'text-gray-900'
                      )}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {item.value === value && <Text className="text-primary-500">✓</Text>}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
