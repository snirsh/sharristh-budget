import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { trpc } from '../../lib/trpc';

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString()}`;
}

function formatDate(dateStr: string | Date): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TransactionsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'review'>('all');

  // Calculate current month date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    return {
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }, []);

  // Fetch transactions from API
  const { data, isLoading, refetch, isRefetching } = trpc.transactions.list.useQuery({
    limit: 100,
    startDate,
    endDate,
    needsReview: filter === 'review' ? true : undefined,
    search: searchQuery || undefined,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const transactions = data?.transactions || [];

  // Apply local filtering for direction
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'income' && tx.direction !== 'income') return false;
    if (filter === 'expense' && tx.direction !== 'expense') return false;
    return true;
  });

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search & Filters */}
      <View className="bg-white p-4 border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-3">
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-gray-900"
            placeholder="Search transactions..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip
              label="Income"
              active={filter === 'income'}
              onPress={() => setFilter('income')}
              icon="trending-up"
            />
            <FilterChip
              label="Expenses"
              active={filter === 'expense'}
              onPress={() => setFilter('expense')}
              icon="trending-down"
            />
            <FilterChip
              label="Needs Review"
              active={filter === 'review'}
              onPress={() => setFilter('review')}
              icon="alert-circle"
            />
          </View>
        </ScrollView>
      </View>

      {/* Transaction List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00d7cd" />
          <Text className="text-gray-500 mt-4">Loading transactions...</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        >
          <View className="p-4">
            {filteredTransactions.length === 0 ? (
              <View className="items-center justify-center py-12">
                <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
                <Text className="text-gray-500 mt-4">No transactions found</Text>
              </View>
            ) : (
              filteredTransactions.map((tx) => <TransactionItem key={tx.id} transaction={tx} />)
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-3 py-2 rounded-full ${
        active ? 'bg-primary-500' : 'bg-gray-100'
      }`}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={active ? '#ffffff' : '#6b7280'}
          style={{ marginRight: 4 }}
        />
      )}
      <Text className={active ? 'text-white font-medium' : 'text-gray-600'}>{label}</Text>
    </Pressable>
  );
}

function TransactionItem({ transaction }: { transaction: any }) {
  const isIncome = transaction.direction === 'income';
  const needsReview = transaction.needsReview;

  return (
    <Pressable
      className={`flex-row items-center bg-white rounded-xl p-4 mb-2 shadow-sm ${
        needsReview ? 'border-l-4 border-warning-500' : ''
      }`}
    >
      <Text className="text-2xl mr-3">{transaction.category?.icon || '❓'}</Text>
      <View className="flex-1">
        <Text className="font-medium text-gray-900">{transaction.description}</Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-xs text-gray-500">{formatDate(transaction.date)}</Text>
          {transaction.merchant && (
            <>
              <Text className="text-xs text-gray-300 mx-1">•</Text>
              <Text className="text-xs text-gray-500">{transaction.merchant}</Text>
            </>
          )}
        </View>
      </View>
      <View className="items-end">
        <Text className={`font-semibold ${isIncome ? 'text-success-600' : 'text-gray-900'}`}>
          {isIncome ? '+' : '-'}
          {formatCurrency(transaction.amount)}
        </Text>
        {needsReview && (
          <View className="bg-warning-100 px-2 py-0.5 rounded mt-1">
            <Text className="text-xs text-warning-700 font-medium">Review</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
