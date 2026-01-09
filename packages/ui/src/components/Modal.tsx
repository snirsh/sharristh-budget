import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal as RNModal,
  type ModalProps as RNModalProps,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import { cn } from '../utils';

export interface ModalProps extends RNModalProps {
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export function Modal({ className, children, onClose, visible, ...props }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} {...props}>
      <Pressable className="flex-1 justify-center bg-black/50 p-4" onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className={cn('rounded-2xl bg-white p-6 shadow-xl', className)}>{children}</View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </RNModal>
  );
}

export function ModalHeader({
  className,
  children,
  onClose,
  ...props
}: ViewProps & { className?: string; onClose?: () => void }) {
  return (
    <View className={cn('mb-4 flex-row items-center justify-between', className)} {...props}>
      {typeof children === 'string' ? (
        <Text className="text-xl font-bold text-gray-900">{children}</Text>
      ) : (
        children
      )}
      {onClose && (
        <Pressable onPress={onClose} className="p-1">
          <Text className="text-2xl text-gray-400">×</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ModalContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('', className)} {...props} />;
}

export function ModalFooter({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('mt-6 flex-row justify-end space-x-3', className)} {...props} />;
}
