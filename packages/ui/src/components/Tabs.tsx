import { Pressable, Text, View, type ViewProps } from 'react-native';
import { cn } from '../utils';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps extends Omit<ViewProps, 'children'> {
  className?: string;
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({
  className,
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  ...props
}: TabsProps) {
  return (
    <View
      className={cn(
        'flex-row',
        variant === 'pills' && 'rounded-lg bg-gray-100 p-1',
        variant === 'underline' && 'border-b border-gray-200',
        className
      )}
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            className={cn(
              'flex-1 flex-row items-center justify-center py-3',
              variant === 'pills' && 'rounded-md',
              variant === 'underline' && '-mb-px border-b-2',
              isActive && variant === 'pills' && 'bg-white shadow-sm',
              isActive && variant === 'underline' && 'border-primary-500',
              !isActive && variant === 'underline' && 'border-transparent'
            )}
          >
            {tab.icon && <View className="mr-2">{tab.icon}</View>}
            <Text className={cn('font-medium', isActive ? 'text-primary-600' : 'text-gray-500')}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface TabContentProps extends ViewProps {
  className?: string;
  activeTab: string;
  tabId: string;
  children: React.ReactNode;
}

export function TabContent({ className, activeTab, tabId, children, ...props }: TabContentProps) {
  if (activeTab !== tabId) return null;

  return (
    <View className={cn('', className)} {...props}>
      {children}
    </View>
  );
}
