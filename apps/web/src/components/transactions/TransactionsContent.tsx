'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, Filter, Check, X, ChevronDown, Plus, Wand2 } from 'lucide-react';
import { TransactionSummary } from './TransactionSummary';
import { AddTransactionDialog } from './AddTransactionDialog';
import { AICategoryBadgeCompact } from './AICategoryBadge';

interface Category {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
}

interface TransactionsContentProps {
  categories: Category[];
  initialNeedsReview?: boolean;
}

export function TransactionsContent({
  categories,
  initialNeedsReview = false,
}: TransactionsContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [needsReviewFilter, setNeedsReviewFilter] = useState(initialNeedsReview);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data: transactionsData } = trpc.transactions.list.useQuery({
    limit: 50,
    offset: 0,
    needsReview: needsReviewFilter || undefined,
    categoryId: selectedCategory || undefined,
    search: searchQuery || undefined,
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

  const transactions = transactionsData?.transactions ?? [];

  const handleRecategorize = (transactionId: string, categoryId: string, createRule: boolean) => {
    recategorizeMutation.mutate({
      transactionId,
      categoryId,
      createRule,
    });
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500">
            {transactionsData?.total ?? 0} transactions
            {needsReviewFilter && ' needing review'}
          </p>
        </div>
        <button
          onClick={() => setIsAddDialogOpen(true)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </button>
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
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Account
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className={cn(
                  'hover:bg-gray-50',
                  tx.needsReview && 'bg-warning-50'
                )}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {tx.description}
                    </p>
                    {tx.merchant && (
                      <p className="text-xs text-gray-500">{tx.merchant}</p>
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
                            ? 'text-gray-700 hover:bg-gray-100'
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
                <td className="px-4 py-3 text-sm text-gray-500">
                  {tx.account?.name}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      tx.direction === 'income'
                        ? 'text-success-600'
                        : 'text-gray-900'
                    )}
                  >
                    {tx.direction === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {tx.needsReview && (
                    <span className="badge badge-warning text-xs">
                      Review
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
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
}

function CategorySelector({
  categories,
  currentCategoryId,
  onSelect,
  onCancel,
}: {
  categories: Category[];
  currentCategoryId?: string;
  onSelect: (categoryId: string, createRule: boolean) => void;
  onCancel: () => void;
}) {
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
      <label className="flex items-center gap-1 text-xs text-gray-500">
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
}

