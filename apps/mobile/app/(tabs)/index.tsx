import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Mock data for demonstration (would come from API in real app)
const mockData = {
  month: 'December 2024',
  kpis: {
    totalIncome: 33000,
    totalExpenses: 18500,
    netSavings: 14500,
    savingsRate: 0.44,
  },
  alerts: [
    { category: 'Eating Outside', status: 'nearing_limit', percent: 85 },
    { category: 'Varying Expenses', status: 'exceeded_soft', percent: 120 },
  ],
  categories: [
    { name: 'Rent', icon: '🏠', planned: 5500, actual: 5500, percent: 100 },
    { name: 'Supermarket', icon: '🛒', planned: 3000, actual: 2100, percent: 70 },
    { name: 'Eating Outside', icon: '🍽️', planned: 1500, actual: 1275, percent: 85 },
    { name: 'Car Expenses', icon: '🚗', planned: 1200, actual: 800, percent: 67 },
    { name: 'Bills', icon: '📄', planned: 800, actual: 450, percent: 56 },
  ],
  recentTransactions: [
    { id: '1', description: 'Shufersal', amount: 250, date: 'Dec 24', category: '🛒' },
    { id: '2', description: 'Aroma Cafe', amount: 85, date: 'Dec 24', category: '🍽️' },
    { id: '3', description: 'Paz Gas Station', amount: 320, date: 'Dec 23', category: '🚗' },
    { id: '4', description: 'Electricity Bill', amount: 450, date: 'Dec 22', category: '📄' },
  ],
};

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString()}`;
}

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const { kpis, alerts, categories, recentTransactions } = mockData;

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Month Header */}
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {mockData.month}
        </Text>

        {/* KPI Cards */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          <KPICard
            title="Income"
            value={formatCurrency(kpis.totalIncome)}
            icon="trending-up"
            color="#10b981"
          />
          <KPICard
            title="Expenses"
            value={formatCurrency(kpis.totalExpenses)}
            icon="trending-down"
            color="#ef4444"
          />
          <KPICard
            title="Savings"
            value={formatCurrency(kpis.netSavings)}
            icon="wallet-outline"
            color="#00d7cd"
            subtitle={`${Math.round(kpis.savingsRate * 100)}% rate`}
          />
        </View>

        {/* Alerts */}
        {alerts.length > 0 && (
          <View className="bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-700 rounded-xl p-4 mb-6">
            <View className="flex-row items-center mb-2">
              <Ionicons name="alert-circle" size={20} color="#f59e0b" />
              <Text className="ml-2 font-semibold text-warning-800 dark:text-warning-400">
                Budget Alerts
              </Text>
            </View>
            {alerts.map((alert, index) => (
              <View key={index} className="flex-row justify-between py-1">
                <Text className="text-warning-700 dark:text-warning-400">{alert.category}</Text>
                <Text className="text-warning-800 dark:text-warning-300 font-medium">
                  {alert.percent}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Category Progress */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-6">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Expense Categories
          </Text>
          {categories.map((cat, index) => (
            <View key={index} className="mb-4 last:mb-0">
              <View className="flex-row justify-between mb-1">
                <Text className="text-gray-700 dark:text-gray-300">
                  {cat.icon} {cat.name}
                </Text>
                <Text className="text-gray-500 dark:text-gray-400">
                  {formatCurrency(cat.actual)} / {formatCurrency(cat.planned)}
                </Text>
              </View>
              <View className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <View
                  className={`h-full rounded-full ${
                    cat.percent >= 100
                      ? 'bg-danger-500'
                      : cat.percent >= 80
                      ? 'bg-warning-500'
                      : 'bg-success-500'
                  }`}
                  style={{ width: `${Math.min(cat.percent, 100)}%` }}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Recent Transactions */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Transactions
          </Text>
          {recentTransactions.map((tx) => (
            <View
              key={tx.id}
              className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">{tx.category}</Text>
                <View>
                  <Text className="font-medium text-gray-900 dark:text-white">
                    {tx.description}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{tx.date}</Text>
                </View>
              </View>
              <Text className="font-medium text-gray-900 dark:text-white">
                -{formatCurrency(tx.amount)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function KPICard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
}) {
  return (
    <View className="flex-1 min-w-[140px] bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm text-gray-500 dark:text-gray-400">{title}</Text>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text className="text-xl font-bold text-gray-900 dark:text-white">{value}</Text>
      {subtitle && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</Text>
      )}
    </View>
  );
}

