'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import { formatCurrency, formatDate, formatMonth, cn } from '@/lib/utils';
import { Search, Filter, Check, X, ChevronDown, ChevronLeft, ChevronRight, Plus, Wand2, EyeOff, Eye, Trash2 } from 'lucide-react';
import { TransactionSummary } from './TransactionSummary';
import { AddTransactionDialog } from './AddTransactionDialog';
import { AICategoryBadgeCompact } from './AICategoryBadge';

type Category = {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
};

type TransactionsContentProps = {
  categories: Category[];
  initialNeedsReview?: boolean;
  month: string;
};

export const TransactionsContent = ({
  categories,
  initialNeedsReview = false,
  month: initialMonth,
}: TransactionsContentProps) => {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [needsReviewFilter, setNeedsReviewFilter] = useState(initialNeedsReview);
  const [showIgnored, setShowIgnored] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  // Calculate date range for the current month
  const { startDate, endDate } = useMemo(() => {
    const [year, monthNum] = currentMonth.split('-').map(Number);
    return {
      startDate: new Date(year!, monthNum! - 1, 1),
      endDate: new Date(year!, monthNum!, 0), // Last day of month
    };
  }, [currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, monthNum] = currentMonth.split('-').map(Number);
    const date = new Date(year!, monthNum! - 1);
    date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const { data: transactionsData } = trpc.transactions.list.useQuery({
    limit: 100,
    offset: 0,
    startDate,
    endDate,
    needsReview: needsReviewFilter || undefined,
    categoryId: selectedCategory || undefined,
    search: searchQuery || undefined,
    includeIgnored: showIgnored || undefined,
  });

  const recategorizeMutation = trpc.transactions.recategorize.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      setEditingTransaction(null);
    },
  });

  const applyCategorizationMutation = trpc.transactions.applyCategorization.useMutation({
    onSuccess: (data) => {
      utils.transactions.list.invalidate();
      alert(data.message);
    },
  });

  const toggleIgnoreMutation = trpc.transactions.toggleIgnore.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
    },
  });

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
    },
  });

  const transactions = transactionsData?.transactions ?? [];

  const handleRecategorize = (transactionId: string, categoryId: string, createRule: boolean) => {
    recategorizeMutation.mutate({
      transactionId,
      categoryId,
      createRule,
    });
  };

  const handleToggleIgnore = (transactionId: string, isIgnored: boolean) => {
    toggleIgnoreMutation.mutate({
      transactionId,
      isIgnored,
    });
  };

  const handleDelete = (transactionId: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteMutation.mutate(transactionId);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {transactionsData?.total ?? 0} transactions
            {needsReviewFilter && ' needing review'}
            {showIgnored && ' (including ignored)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            Add Transaction
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="btn-outline btn-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-lg font-medium min-w-[160px] text-center">
              {formatMonth(currentMonth)}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="btn-outline btn-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Summary */}
      <TransactionSummary transactions={transactions} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setNeedsReviewFilter(!needsReviewFilter)}
          className={cn(
            'btn',
            needsReviewFilter ? 'btn-primary' : 'btn-outline'
          )}
        >
          <Filter className="h-4 w-4 mr-2" />
          Needs Review
        </button>

        <button
          onClick={() => setShowIgnored(!showIgnored)}
          className={cn(
            'btn',
            showIgnored ? 'btn-primary' : 'btn-outline'
          )}
          title={showIgnored ? 'Hide ignored transactions' : 'Show ignored transactions'}
        >
          {showIgnored ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          {showIgnored ? 'Showing Ignored' : 'Show Ignored'}
        </button>

        <button
          onClick={() => applyCategorizationMutation.mutate()}
          disabled={applyCategorizationMutation.isPending}
          className="btn btn-outline"
          title="Apply categorization rules to uncategorized transactions"
        >
          <Wand2 className="h-4 w-4 mr-2" />
          {applyCategorizationMutation.isPending ? 'Applying...' : 'Auto-Categorize'}
        </button>
      </div>

      {/* Transactions List */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Account
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className={cn(
                  'hover:bg-gray-50 dark:hover:bg-gray-800',
                  tx.needsReview && 'bg-warning-50 dark:bg-warning-900/30',
                  tx.isIgnored && 'opacity-50 bg-gray-100 dark:bg-gray-900'
                )}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      tx.isIgnored 
                        ? 'text-gray-500 dark:text-gray-400 line-through' 
                        : 'text-gray-900 dark:text-white'
                    )}>
                      {tx.description}
                    </p>
                    {tx.merchant && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{tx.merchant}</p>
                    )}
                    {tx.isIgnored && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">Ignored</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingTransaction === tx.id ? (
                    <CategorySelector
                      categories={categories}
                      currentCategoryId={tx.category?.id}
                      onSelect={(catId, createRule) => {
                        handleRecategorize(tx.id, catId, createRule);
                      }}
                      onCancel={() => setEditingTransaction(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingTransaction(tx.id)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded text-sm',
                          tx.category
                            ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100'
                            : 'text-warning-700 bg-warning-100 hover:bg-warning-200'
                        )}
                      >
                        <span>{tx.category?.icon || '❓'}</span>
                        <span>{tx.category?.name || 'Uncategorized'}</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <AICategoryBadgeCompact
                        source={tx.categorizationSource}
                        confidence={tx.confidence}
                      />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {tx.account?.name}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      tx.isIgnored
                        ? 'text-gray-400 dark:text-gray-500'
                        : tx.direction === 'income'
                          ? 'text-success-600'
                          : 'text-gray-900 dark:text-white'
                    )}
                  >
                    {tx.direction === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {tx.needsReview && (
                      <span className="badge badge-warning text-xs mr-2">
                        Review
                      </span>
                    )}
                    <button
                      onClick={() => handleToggleIgnore(tx.id, !tx.isIgnored)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        tx.isIgnored
                          ? 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                      title={tx.isIgnored ? 'Restore transaction' : 'Ignore transaction'}
                    >
                      {tx.isIgnored ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                      title="Delete transaction"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Transaction Dialog */}
      <AddTransactionDialog
        categories={categories}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={() => utils.transactions.list.invalidate()}
      />
    </div>
  );
};

const CategorySelector = ({
  categories,
  currentCategoryId,
  onSelect,
  onCancel,
}: {
  categories: Category[];
  currentCategoryId?: string;
  onSelect: (categoryId: string, createRule: boolean) => void;
  onCancel: () => void;
}) => {
  const [selectedId, setSelectedId] = useState(currentCategoryId || '');
  const [createRule, setCreateRule] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="input text-sm py-1 w-40"
        autoFocus
      >
        <option value="">Select category...</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.icon} {cat.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <input
          type="checkbox"
          checked={createRule}
          onChange={(e) => setCreateRule(e.target.checked)}
          className="rounded"
        />
        Create rule
      </label>
      <button
        onClick={() => selectedId && onSelect(selectedId, createRule)}
        disabled={!selectedId}
        className="p-1 text-success-600 hover:bg-success-50 rounded disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={onCancel}
        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
