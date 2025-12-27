import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Mock data
const mockBudgets = [
  { id: '1', category: { name: 'Rent', icon: '🏠' }, planned: 5500, actual: 5500, limit: 5500, limitType: 'hard', status: 'ok' },
  { id: '2', category: { name: 'Supermarket', icon: '🛒' }, planned: 3000, actual: 2100, limit: 3500, limitType: 'soft', status: 'ok' },
  { id: '3', category: { name: 'Eating Outside', icon: '🍽️' }, planned: 1500, actual: 1275, limit: 2000, limitType: 'soft', status: 'nearing_limit' },
  { id: '4', category: { name: 'Car Expenses', icon: '🚗' }, planned: 1200, actual: 800, limit: 1500, limitType: 'soft', status: 'ok' },
  { id: '5', category: { name: 'Bills', icon: '📄' }, planned: 800, actual: 450, limit: 1000, limitType: 'soft', status: 'ok' },
  { id: '6', category: { name: 'Transportation', icon: '🚌' }, planned: 400, actual: 320, limit: 500, limitType: 'soft', status: 'ok' },
  { id: '7', category: { name: 'Pharmacy', icon: '💊' }, planned: 300, actual: 180, limit: 500, limitType: 'soft', status: 'ok' },
  { id: '8', category: { name: 'Varying Expenses', icon: '❓' }, planned: 2000, actual: 2400, limit: 3000, limitType: 'soft', status: 'exceeded_soft' },
];

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString()}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ok':
      return '#10b981';
    case 'nearing_limit':
      return '#f59e0b';
    case 'exceeded_soft':
      return '#f59e0b';
    case 'exceeded_hard':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return 'On Track';
    case 'nearing_limit':
      return 'Nearing Limit';
    case 'exceeded_soft':
      return 'Over Budget';
    case 'exceeded_hard':
      return 'Exceeded';
    default:
      return status;
  }
}

export default function BudgetScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const totalPlanned = mockBudgets.reduce((sum, b) => sum + b.planned, 0);
  const totalActual = mockBudgets.reduce((sum, b) => sum + b.actual, 0);
  const remaining = totalPlanned - totalActual;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-sm text-gray-500">Planned</Text>
            <Text className="text-xl font-bold text-gray-900">
              {formatCurrency(totalPlanned)}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-sm text-gray-500">Spent</Text>
            <Text className="text-xl font-bold text-gray-900">
              {formatCurrency(totalActual)}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-sm text-gray-500">Remaining</Text>
            <Text
              className={`text-xl font-bold ${
                remaining >= 0 ? 'text-success-600' : 'text-danger-600'
              }`}
            >
              {formatCurrency(remaining)}
            </Text>
          </View>
        </View>

        {/* Budget List */}
        <View className="bg-white rounded-xl shadow-sm overflow-hidden">
          {mockBudgets.map((budget, index) => {
            const percent = budget.planned > 0 ? (budget.actual / budget.planned) * 100 : 0;
            const progressWidth = Math.min(percent, 100);

            return (
              <View
                key={budget.id}
                className={`p-4 ${
                  index < mockBudgets.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Text className="text-xl mr-2">{budget.category.icon}</Text>
                    <Text className="font-medium text-gray-900">
                      {budget.category.name}
                    </Text>
                  </View>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${getStatusColor(budget.status)}20` }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: getStatusColor(budget.status) }}
                    >
                      {getStatusLabel(budget.status)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm text-gray-500">
                    {formatCurrency(budget.actual)} / {formatCurrency(budget.planned)}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {Math.round(percent)}%
                  </Text>
                </View>

                <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${progressWidth}%`,
                      backgroundColor: getStatusColor(budget.status),
                    }}
                  />
                </View>

                {budget.limit && (
                  <Text className="text-xs text-gray-400 mt-1">
                    Limit: {formatCurrency(budget.limit)} ({budget.limitType})
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

