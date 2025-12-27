import { View, Text, ScrollView, TextInput, Pressable, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Mock data
const mockTransactions = [
  { id: '1', description: 'Monthly Rent', merchant: 'Landlord', amount: 5500, date: 'Dec 1', category: { name: 'Rent', icon: '🏠' }, direction: 'expense' },
  { id: '2', description: "Alex's Salary", merchant: 'TechCorp', amount: 18000, date: 'Dec 1', category: { name: 'Salary', icon: '💰' }, direction: 'income' },
  { id: '3', description: 'Weekly Groceries', merchant: 'Shufersal', amount: 350, date: 'Dec 3', category: { name: 'Supermarket', icon: '🛒' }, direction: 'expense' },
  { id: '4', description: 'Coffee Meeting', merchant: 'Aroma', amount: 85, date: 'Dec 4', category: { name: 'Eating Outside', icon: '🍽️' }, direction: 'expense' },
  { id: '5', description: 'Gas Station', merchant: 'Paz', amount: 280, date: 'Dec 5', category: { name: 'Car Expenses', icon: '🚗' }, direction: 'expense' },
  { id: '6', description: 'Online Shopping', merchant: 'Amazon', amount: 450, date: 'Dec 6', category: { name: 'Varying Expenses', icon: '❓' }, direction: 'expense', needsReview: true },
  { id: '7', description: 'Restaurant Dinner', merchant: 'Moses', amount: 280, date: 'Dec 7', category: { name: 'Eating Outside', icon: '🍽️' }, direction: 'expense' },
  { id: '8', description: 'Pharmacy', merchant: 'Super-Pharm', amount: 120, date: 'Dec 8', category: { name: 'Pharmacy', icon: '💊' }, direction: 'expense' },
  { id: '9', description: "Jordan's Salary", merchant: 'DesignStudio', amount: 15000, date: 'Dec 10', category: { name: 'Salary', icon: '💰' }, direction: 'income' },
  { id: '10', description: 'Bus Card', merchant: 'Rav-Kav', amount: 100, date: 'Dec 12', category: { name: 'Transportation', icon: '🚌' }, direction: 'expense' },
];

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString()}`;
}

export default function TransactionsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'review'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const filteredTransactions = mockTransactions.filter((tx) => {
    // Filter by type
    if (filter === 'income' && tx.direction !== 'income') return false;
    if (filter === 'expense' && tx.direction !== 'expense') return false;
    if (filter === 'review' && !('needsReview' in tx)) return false;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tx.description.toLowerCase().includes(query) ||
        tx.merchant?.toLowerCase().includes(query) ||
        tx.category.name.toLowerCase().includes(query)
      );
    }

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
            <FilterChip
              label="All"
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
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
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="p-4">
          {filteredTransactions.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
              <Text className="text-gray-500 mt-4">No transactions found</Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))
          )}
        </View>
      </ScrollView>
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
      <Text className={active ? 'text-white font-medium' : 'text-gray-600'}>
        {label}
      </Text>
    </Pressable>
  );
}

function TransactionItem({
  transaction,
}: {
  transaction: (typeof mockTransactions)[0];
}) {
  const isIncome = transaction.direction === 'income';
  const needsReview = 'needsReview' in transaction && transaction.needsReview;

  return (
    <Pressable
      className={`flex-row items-center bg-white rounded-xl p-4 mb-2 shadow-sm ${
        needsReview ? 'border-l-4 border-warning-500' : ''
      }`}
    >
      <Text className="text-2xl mr-3">{transaction.category.icon}</Text>
      <View className="flex-1">
        <Text className="font-medium text-gray-900">
          {transaction.description}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-xs text-gray-500">{transaction.date}</Text>
          {transaction.merchant && (
            <>
              <Text className="text-xs text-gray-300 mx-1">•</Text>
              <Text className="text-xs text-gray-500">{transaction.merchant}</Text>
            </>
          )}
        </View>
      </View>
      <View className="items-end">
        <Text
          className={`font-semibold ${
            isIncome ? 'text-success-600' : 'text-gray-900'
          }`}
        >
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

