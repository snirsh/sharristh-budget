import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme';

const settingsSections = [
  {
    title: 'Account',
    items: [
      { icon: 'person-outline', label: 'Profile', subtitle: 'The Sharristh Family' },
      { icon: 'wallet-outline', label: 'Accounts', subtitle: '3 connected accounts' },
      { icon: 'people-outline', label: 'Household Members', subtitle: '2 members' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { icon: 'notifications-outline', label: 'Notifications', subtitle: 'Budget alerts on' },
      { icon: 'cash-outline', label: 'Currency', subtitle: 'ILS (₪)' },
    ],
  },
  {
    title: 'Data',
    items: [
      { icon: 'folder-outline', label: 'Categories', subtitle: '13 categories' },
      { icon: 'flash-outline', label: 'Rules', subtitle: '15 auto-categorization rules' },
      { icon: 'repeat-outline', label: 'Recurring', subtitle: '5 recurring transactions' },
    ],
  },
  {
    title: 'About',
    items: [
      { icon: 'help-circle-outline', label: 'Help & Support' },
      { icon: 'document-text-outline', label: 'Privacy Policy' },
      { icon: 'information-circle-outline', label: 'About', subtitle: 'Version 1.0.0' },
    ],
  },
];

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="p-4">
        {/* Header */}
        <View className="bg-primary-500 rounded-xl p-4 mb-6">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3">
              <Text className="text-xl font-bold text-primary-500">S</Text>
            </View>
            <View>
              <Text className="text-white text-lg font-semibold">The Sharristh Family</Text>
              <Text className="text-primary-100">Alex & Jordan</Text>
            </View>
          </View>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <View key={section.title} className="mb-6">
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
              {section.title}
            </Text>
            <View className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Add Dark Mode toggle after Preferences title */}
              {section.title === 'Preferences' && (
                <View className="flex-row items-center p-4 border-b border-gray-100 dark:border-gray-700">
                  <View className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg items-center justify-center mr-3">
                    <Ionicons
                      name={theme === 'dark' ? 'moon' : 'sunny'}
                      size={18}
                      color={theme === 'dark' ? '#60a5fa' : '#6b7280'}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium text-gray-900 dark:text-white">Dark Mode</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      {theme === 'dark' ? 'On' : 'Off'}
                    </Text>
                  </View>
                  <Switch
                    value={theme === 'dark'}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#d1d5db', true: '#00d7cd' }}
                    thumbColor={theme === 'dark' ? '#ffffff' : '#f3f4f6'}
                  />
                </View>
              )}
              {section.items.map((item, itemIndex) => (
                <Pressable
                  key={item.label}
                  className={`flex-row items-center p-4 ${
                    itemIndex < section.items.length - 1
                      ? 'border-b border-gray-100 dark:border-gray-700'
                      : ''
                  }`}
                >
                  <View className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg items-center justify-center mr-3">
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color="#6b7280"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium text-gray-900 dark:text-white">{item.label}</Text>
                    {item.subtitle && (
                      <Text className="text-sm text-gray-500 dark:text-gray-400">
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Version */}
        <Text className="text-center text-gray-400 dark:text-gray-500 text-sm mt-4 mb-8">
          Sharristh Budget v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}
