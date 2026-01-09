'use client';

import { CategoryCombobox } from '@/components/ui/CategoryCombobox';
import { trpc } from '@/lib/trpc/client';
import { cn, formatCurrency, formatDate, formatMonth } from '@/lib/utils';
import {
  BookmarkPlus,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AICategoryBadgeCompact } from './AICategoryBadge';
import { AddTransactionDialog } from './AddTransactionDialog';
import { RecurringBadgeCompact } from './RecurringBadge';
import { TransactionSummary } from './TransactionSummary';

type Category = {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
};

type TransactionsContentProps = {
  categories: Category[];
  initialNeedsReview?: boolean;
  initialMonth?: string;
};

export const TransactionsContent = ({
  categories,
  initialNeedsReview = false,
  initialMonth,
}: TransactionsContentProps) => {
  // When month is undefined (e.g., showing all needs review), currentMonth is null
  const [currentMonth, setCurrentMonth] = useState<string | null>(initialMonth ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [needsReviewFilter, setNeedsReviewFilter] = useState(initialNeedsReview);
  const [showIgnored, setShowIgnored] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchCategoryId, setBatchCategoryId] = useState<string>('');

  // Calculate date range for the current month in Israel timezone
  // Returns undefined dates when showing all transactions (no month filter)
  const { startDate, endDate } = useMemo(() => {
    if (!currentMonth) {
      // No date filtering - show all transactions
      return { startDate: undefined, endDate: undefined };
    }

    const [year, monthNum] = currentMonth.split('-').map(Number);

    // Create dates at midnight Israel time (UTC+2) to match server-side transaction dates
    // First day of month at 00:00:00 Israel time
    const firstDay = `${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+02:00`;

    // Last day of month at 23:59:59.999 Israel time
    const lastDay = new Date(year!, monthNum!, 0); // Gets last day number
    const lastDayStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}T23:59:59.999+02:00`;

    return {
      startDate: new Date(firstDay),
      endDate: new Date(lastDayStr),
    };
  }, [currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    // If currently showing all time, start from current month
    const baseMonth = currentMonth ?? new Date().toISOString().slice(0, 7);
    const [year, monthNum] = baseMonth.split('-').map(Number);
    const date = new Date(year!, monthNum! - 1);
    date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const showAllTime = () => {
    setCurrentMonth(null);
  };

  // Use infinite query for proper pagination
  const {
    data: transactionsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = trpc.transactions.list.useInfiniteQuery(
    {
      limit: 100, // Max allowed by schema
      startDate,
      endDate,
      needsReview: needsReviewFilter || undefined,
      categoryId: selectedCategory || undefined,
      search: searchQuery || undefined,
      includeIgnored: showIgnored || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      // Always enable the query so it can refetch after mutations
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    }
  );

  // Flatten all pages into a single transactions array
  const transactions = transactionsPages?.pages.flatMap((page) => page.transactions) ?? [];
  const total = transactionsPages?.pages[0]?.total ?? 0;
  const hasMore = hasNextPage ?? false;

  // Fetch monthly summary from server (calculates from ALL transactions in DB)
  // Works for both specific month and all-time views
  const { data: monthlySummary, refetch: refetchSummary } =
    trpc.transactions.monthlySummary.useQuery({
      startDate,
      endDate,
      includeIgnored: showIgnored || undefined,
    });

  const utils = trpc.useUtils();

  const recategorizeMutation = trpc.transactions.recategorize.useMutation({
    onSuccess: (data, variables) => {
      // Cast to access new fields (TypeScript doesn't know about them yet)
      const result = data as typeof data & { additionalUpdated?: number; ruleCreated?: boolean };

      // If additional transactions were updated by the rule, invalidate the cache
      // to show all the updates
      if (result.additionalUpdated && result.additionalUpdated > 0) {
        utils.transactions.list.invalidate();
        // Show user feedback about the rule being applied
        setTimeout(() => {
          alert(
            `Category saved! Also applied the rule to ${result.additionalUpdated} other matching transaction(s).`
          );
        }, 100);
      } else {
        // Optimistically update the cache for immediate feedback
        utils.transactions.list.setInfiniteData(
          {
            limit: 100,
            startDate,
            endDate,
            needsReview: needsReviewFilter || undefined,
            categoryId: selectedCategory || undefined,
            search: searchQuery || undefined,
            includeIgnored: showIgnored || undefined,
          },
          (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                transactions: page.transactions.map((tx) =>
                  tx.id === variables.transactionId
                    ? {
                        ...tx,
                        categoryId: variables.categoryId,
                        categorizationSource: 'manual',
                        confidence: 1,
                        needsReview: false,
                      }
                    : tx
                ),
              })),
            };
          }
        );
      }
      setEditingTransaction(null);
      // Refetch in background to ensure consistency
      refetch();
      refetchSummary();
    },
  });

  const applyCategorizationMutation = trpc.transactions.applyCategorization.useMutation({
    onSuccess: (data) => {
      // Immediately invalidate and refetch all transaction queries
      utils.transactions.list.invalidate();
      utils.transactions.monthlySummary.invalidate();
      refetch();
      refetchSummary();
      // Show message in a less intrusive way
      if (data.remaining && data.remaining > 0) {
        // If there are more to process, show a notification
        alert(`${data.message}\n\nClick "Auto-Categorize" again to continue.`);
      } else {
        alert(data.message);
      }
    },
  });

  const toggleIgnoreMutation = trpc.transactions.toggleIgnore.useMutation({
    onSuccess: () => {
      refetch();
      refetchSummary();
    },
  });

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      refetch();
      refetchSummary();
    },
  });

  const batchApproveMutation = trpc.transactions.batchApprove.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedIds(new Set());
    },
  });

  const batchIgnoreMutation = trpc.transactions.batchIgnore.useMutation({
    onSuccess: () => {
      refetch();
      refetchSummary();
      setSelectedIds(new Set());
    },
  });

  const batchDeleteMutation = trpc.transactions.batchDelete.useMutation({
    onSuccess: () => {
      refetch();
      refetchSummary();
      setSelectedIds(new Set());
    },
  });

  const batchRecategorizeMutation = trpc.transactions.batchRecategorize.useMutation({
    onSuccess: (data) => {
      // Cast to access new fields
      const result = data as typeof data & { ruleCreated?: boolean; additionalUpdated?: number };

      utils.transactions.list.invalidate();
      refetch();
      refetchSummary();
      setSelectedIds(new Set());
      setBatchCategoryId('');
      // Notify user if a rule was created and applied
      if (result.ruleCreated && result.additionalUpdated && result.additionalUpdated > 0) {
        alert(
          `Updated ${result.updated} selected transaction(s) and ${result.additionalUpdated} additional matching transaction(s) with the new rule.`
        );
      }
    },
  });

  // Infinite scroll: automatically load more when scrolling near bottom
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreRefMobile = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desktopElement = loadMoreRef.current;
    const mobileElement = loadMoreRefMobile.current;

    if ((!desktopElement && !mobileElement) || !hasMore || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // Trigger 100px before reaching the element
    );

    // Observe both desktop and mobile elements (only one will be visible at a time)
    if (desktopElement) observer.observe(desktopElement);
    if (mobileElement) observer.observe(mobileElement);

    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  // Selection helpers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)));
    }
  };

  const isAllSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < transactions.length;

  // Batch actions
  const handleBatchApprove = () => {
    batchApproveMutation.mutate({ transactionIds: Array.from(selectedIds) });
  };

  const handleBatchIgnore = (isIgnored: boolean) => {
    batchIgnoreMutation.mutate({ transactionIds: Array.from(selectedIds), isIgnored });
  };

  const handleBatchDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.size} transaction(s)?`)) {
      batchDeleteMutation.mutate({ transactionIds: Array.from(selectedIds) });
    }
  };

  const handleBatchRecategorize = () => {
    if (!batchCategoryId) return;
    batchRecategorizeMutation.mutate({
      transactionIds: Array.from(selectedIds),
      categoryId: batchCategoryId,
      createRule: false,
    });
  };

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

  // Show loading skeleton on initial load
  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
            <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-9 w-9 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Summary Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Filters Skeleton */}
        <div className="flex flex-wrap gap-3">
          <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        {/* Table Skeleton */}
        <div className="card p-0 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="px-4 py-4 flex items-center gap-4">
                <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                  <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              Loading transactions...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {transactions.length} {total > 0 && total !== transactions.length ? `of ${total}` : ''}{' '}
            transactions
            {needsReviewFilter && ' needing review'}
            {showIgnored && ' (including ignored)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsAddDialogOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Add Transaction
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigateMonth('prev')} className="btn-outline btn-sm">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {currentMonth ? (
              <button
                onClick={showAllTime}
                className="text-lg font-medium min-w-[160px] text-center hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                title="Click to show all time"
              >
                {formatMonth(currentMonth)}
              </button>
            ) : (
              <span className="text-lg font-medium min-w-[160px] text-center text-primary-600 dark:text-primary-400">
                All Time
              </span>
            )}
            <button onClick={() => navigateMonth('next')} className="btn-outline btn-sm">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Summary */}
      <TransactionSummary
        totalIncome={monthlySummary?.totalIncome ?? 0}
        totalExpenses={monthlySummary?.totalExpenses ?? 0}
        netBalance={monthlySummary?.netBalance ?? 0}
      />

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
          className={cn('btn', needsReviewFilter ? 'btn-primary' : 'btn-outline')}
        >
          <Filter className="h-4 w-4 mr-2" />
          Needs Review
        </button>

        <button
          onClick={() => setShowIgnored(!showIgnored)}
          className={cn('btn', showIgnored ? 'btn-primary' : 'btn-outline')}
          title={showIgnored ? 'Hide ignored transactions' : 'Show ignored transactions'}
        >
          {showIgnored ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          {showIgnored ? 'Showing Ignored' : 'Show Ignored'}
        </button>

        <button
          onClick={() => applyCategorizationMutation.mutate(undefined)}
          disabled={applyCategorizationMutation.isPending}
          className="btn btn-outline"
          title="Apply categorization rules to uncategorized transactions"
        >
          <Wand2 className="h-4 w-4 mr-2" />
          {applyCategorizationMutation.isPending ? 'Applying...' : 'Auto-Categorize'}
        </button>
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 card p-3 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-primary-200 dark:bg-primary-700" />
          <button
            onClick={handleBatchApprove}
            disabled={batchApproveMutation.isPending}
            className="btn btn-sm bg-success-500 text-white hover:bg-success-600"
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Approve
          </button>
          <button
            onClick={() => handleBatchIgnore(true)}
            disabled={batchIgnoreMutation.isPending}
            className="btn btn-sm btn-outline"
          >
            <EyeOff className="h-4 w-4 mr-1" />
            Ignore
          </button>
          <div className="flex items-center gap-2">
            <CategoryCombobox
              categories={categories}
              value={batchCategoryId}
              placeholder="Set category..."
              className="w-44"
              onSelect={(catId) => setBatchCategoryId(catId)}
            />
            <button
              onClick={handleBatchRecategorize}
              disabled={!batchCategoryId || batchRecategorizeMutation.isPending}
              className="btn btn-sm btn-primary disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleBatchDelete}
            disabled={batchDeleteMutation.isPending}
            className="btn btn-sm btn-danger"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn btn-sm btn-ghost text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Transactions List - Desktop Table View */}
      <div className="hidden md:block card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 w-10">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center w-5 h-5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={isAllSelected ? 'Deselect all' : 'Select all'}
                >
                  {isAllSelected ? (
                    <Check className="h-3 w-3 text-primary-600" />
                  ) : isSomeSelected ? (
                    <Minus className="h-3 w-3 text-primary-600" />
                  ) : null}
                </button>
              </th>
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
                  tx.isIgnored && 'opacity-50 bg-gray-100 dark:bg-gray-900',
                  selectedIds.has(tx.id) && 'bg-primary-50 dark:bg-primary-900/20'
                )}
              >
                <td className="px-4 py-3 w-10">
                  <button
                    onClick={() => toggleSelection(tx.id)}
                    className={cn(
                      'flex items-center justify-center w-5 h-5 rounded border transition-colors',
                      selectedIds.has(tx.id)
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    {selectedIds.has(tx.id) && <Check className="h-3 w-3" />}
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        tx.isIgnored
                          ? 'text-gray-500 dark:text-gray-400 line-through'
                          : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {tx.description}
                    </p>
                    {tx.merchant && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{tx.merchant}</p>
                    )}
                    {tx.isIgnored && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                        Ignored
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingTransaction === tx.id ? (
                    <CategorySelector
                      categories={categories}
                      currentCategoryId={tx.category?.id}
                      transactionDirection={tx.direction as 'income' | 'expense'}
                      transactionMerchant={tx.merchant}
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
                            ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                            : 'text-warning-700 bg-warning-100 hover:bg-warning-200 dark:bg-warning-900/40 dark:text-warning-400 dark:hover:bg-warning-900/60'
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
                      <RecurringBadgeCompact recurringTemplate={tx.recurringTemplate} />
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
                      <span className="badge badge-warning text-xs mr-2">Review</span>
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
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="space-y-2">
                    <p>
                      {currentMonth
                        ? `No transactions found for ${formatMonth(currentMonth)}`
                        : needsReviewFilter
                          ? 'No transactions need review'
                          : 'No transactions found'}
                    </p>
                    {currentMonth && (
                      <p className="text-sm">
                        Try navigating to a previous month using the arrows above, or{' '}
                        <button
                          onClick={() => navigateMonth('prev')}
                          className="text-primary-500 hover:underline"
                        >
                          go to{' '}
                          {formatMonth(
                            (() => {
                              const [year, monthNum] = currentMonth.split('-').map(Number);
                              const date = new Date(year!, monthNum! - 1);
                              date.setMonth(date.getMonth() - 1);
                              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                            })()
                          )}
                        </button>
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Infinite scroll loading indicator - Desktop */}
        {(hasMore || isFetchingNextPage) && (
          <div
            ref={loadMoreRef}
            className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Loading more transactions...
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {total - transactions.length} more transactions available
              </span>
            )}
          </div>
        )}
      </div>

      {/* Transactions List - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {transactions.length > 0 && (
          <div className="flex items-center justify-between px-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400"
            >
              <div
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded border-2 transition-colors',
                  isAllSelected
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {isAllSelected ? (
                  <Check className="h-4 w-4" />
                ) : isSomeSelected ? (
                  <Minus className="h-4 w-4 text-primary-600" />
                ) : null}
              </div>
              {isAllSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className={cn(
              'card p-4 relative',
              tx.needsReview && 'border-l-4 border-warning-500',
              tx.isIgnored && 'opacity-50 bg-gray-100 dark:bg-gray-900',
              selectedIds.has(tx.id) &&
                'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20'
            )}
          >
            {/* Checkbox and Date Row */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => toggleSelection(tx.id)}
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded border-2 transition-colors',
                  selectedIds.has(tx.id)
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'border-gray-300 dark:border-gray-600 active:bg-gray-100 dark:active:bg-gray-700'
                )}
              >
                {selectedIds.has(tx.id) && <Check className="h-4 w-4" />}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(tx.date)}
                </span>
                {tx.needsReview && <span className="badge badge-warning text-xs">Review</span>}
              </div>
            </div>

            {/* Description and Merchant */}
            <div className="mb-3">
              <p
                className={cn(
                  'font-medium',
                  tx.isIgnored
                    ? 'text-gray-500 dark:text-gray-400 line-through'
                    : 'text-gray-900 dark:text-white'
                )}
              >
                {tx.description}
              </p>
              {tx.merchant && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{tx.merchant}</p>
              )}
              {tx.isIgnored && (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic">Ignored</span>
              )}
            </div>

            {/* Category Selector */}
            <div className="mb-3">
              {editingTransaction === tx.id ? (
                <MobileCategorySelector
                  categories={categories}
                  currentCategoryId={tx.category?.id}
                  transactionDirection={tx.direction as 'income' | 'expense'}
                  transactionMerchant={tx.merchant}
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
                      'flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      tx.category
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-200 dark:active:bg-gray-600'
                        : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400 active:bg-warning-200 dark:active:bg-warning-900/60'
                    )}
                  >
                    <span className="text-lg">{tx.category?.icon || '❓'}</span>
                    <span>{tx.category?.name || 'Set Category'}</span>
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </button>
                  <AICategoryBadgeCompact
                    source={tx.categorizationSource}
                    confidence={tx.confidence}
                  />
                  <RecurringBadgeCompact recurringTemplate={tx.recurringTemplate} />
                </div>
              )}
            </div>

            {/* Amount and Account Row */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tx.account?.name}</span>
              <span
                className={cn(
                  'text-lg font-semibold',
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
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleToggleIgnore(tx.id, !tx.isIgnored)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
                  tx.isIgnored
                    ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400 active:bg-success-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 active:bg-gray-200 dark:active:bg-gray-600'
                )}
              >
                {tx.isIgnored ? (
                  <>
                    <Eye className="h-4 w-4" />
                    <span>Restore</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span>Ignore</span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleDelete(tx.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-400 active:bg-danger-200 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="card p-12 text-center text-gray-500 dark:text-gray-400">
            <div className="space-y-2">
              <p>
                {currentMonth
                  ? `No transactions found for ${formatMonth(currentMonth)}`
                  : needsReviewFilter
                    ? 'No transactions need review'
                    : 'No transactions found'}
              </p>
              {currentMonth && (
                <p className="text-sm">
                  Try navigating to a previous month using the arrows above, or{' '}
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="text-primary-500 hover:underline"
                  >
                    go to{' '}
                    {formatMonth(
                      (() => {
                        const [year, monthNum] = currentMonth.split('-').map(Number);
                        const date = new Date(year!, monthNum! - 1);
                        date.setMonth(date.getMonth() - 1);
                        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      })()
                    )}
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
        {/* Infinite scroll loading indicator - Mobile */}
        {(hasMore || isFetchingNextPage) && (
          <div ref={loadMoreRefMobile} className="card p-6 flex items-center justify-center">
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Loading more...
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {total - transactions.length} more available
              </span>
            )}
          </div>
        )}
      </div>

      {/* Add Transaction Dialog */}
      <AddTransactionDialog
        categories={categories}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={() => {
          refetch();
          refetchSummary();
        }}
      />
    </div>
  );
};

const CategorySelector = ({
  categories,
  currentCategoryId,
  transactionDirection,
  transactionMerchant,
  onSelect,
  onCancel,
}: {
  categories: Category[];
  currentCategoryId?: string;
  transactionDirection: 'income' | 'expense';
  transactionMerchant?: string | null;
  onSelect: (categoryId: string, createRule: boolean) => void;
  onCancel: () => void;
}) => {
  const [createRule, setCreateRule] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);

  // When a category is selected, either save immediately or show rule option
  const handleCategorySelect = (categoryId: string) => {
    if (createRule || pendingCategoryId) {
      // Already in "rule mode", just update the selection
      setPendingCategoryId(categoryId);
    } else {
      // Quick save - just apply the category immediately
      onSelect(categoryId, false);
    }
  };

  // Handle saving with rule creation
  const handleSaveWithRule = () => {
    const catId = pendingCategoryId || currentCategoryId;
    if (catId) {
      onSelect(catId, createRule);
    }
  };

  // When "create rule" is toggled, keep category selection pending
  const handleCreateRuleToggle = (checked: boolean) => {
    setCreateRule(checked);
    if (checked && !pendingCategoryId && currentCategoryId) {
      setPendingCategoryId(currentCategoryId);
    }
  };

  const showRuleControls = createRule || pendingCategoryId;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CategoryCombobox
        categories={categories}
        value={pendingCategoryId || currentCategoryId}
        transactionDirection={transactionDirection}
        placeholder="Search categories..."
        autoFocus
        className="w-48"
        onSelect={handleCategorySelect}
        onCancel={onCancel}
      />

      <label
        className={cn(
          'flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer transition-colors',
          createRule
            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
        title={
          transactionMerchant
            ? `Create rule for "${transactionMerchant}"`
            : 'Create rule for this pattern'
        }
      >
        <input
          type="checkbox"
          checked={createRule}
          onChange={(e) => handleCreateRuleToggle(e.target.checked)}
          className="rounded w-3.5 h-3.5"
        />
        <BookmarkPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Rule</span>
      </label>

      {showRuleControls && (
        <>
          <button
            onClick={handleSaveWithRule}
            disabled={!pendingCategoryId}
            className="p-1.5 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/30 rounded disabled:opacity-50 transition-colors"
            title="Save with rule"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};

const MobileCategorySelector = ({
  categories,
  currentCategoryId,
  transactionDirection,
  transactionMerchant,
  onSelect,
  onCancel,
}: {
  categories: Category[];
  currentCategoryId?: string;
  transactionDirection: 'income' | 'expense';
  transactionMerchant?: string | null;
  onSelect: (categoryId: string, createRule: boolean) => void;
  onCancel: () => void;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(currentCategoryId || '');
  const [createRule, setCreateRule] = useState(false);

  // Filter categories based on transaction direction and search
  const filteredCategories = useMemo(() => {
    let filtered = categories.filter((cat) => {
      if (transactionDirection === 'income') {
        return cat.type === 'income';
      }
      return cat.type !== 'income';
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (cat) => cat.name.toLowerCase().includes(query) || (cat.icon && cat.icon.includes(query))
      );
    }

    return filtered;
  }, [categories, transactionDirection, searchQuery]);

  // Quick select - immediately saves when tapping a category (unless createRule is on)
  const handleQuickSelect = (categoryId: string) => {
    if (createRule) {
      setSelectedId(categoryId);
    } else {
      onSelect(categoryId, false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          className="input w-full pl-10 text-base py-3"
          autoFocus
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Category Grid */}
      <div className="max-h-64 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleQuickSelect(cat.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-3 rounded-lg text-left transition-colors',
                cat.id === selectedId
                  ? 'bg-primary-100 dark:bg-primary-900/50 border-2 border-primary-500'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              )}
            >
              <span className="text-xl">{cat.icon || '📁'}</span>
              <span
                className={cn(
                  'text-sm truncate',
                  cat.id === selectedId
                    ? 'font-medium text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-200'
                )}
              >
                {cat.name}
              </span>
            </button>
          ))}
        </div>
        {filteredCategories.length === 0 && (
          <p className="text-center py-8 text-gray-500 dark:text-gray-400">No categories found</p>
        )}
      </div>

      {/* Rule Toggle */}
      <label
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors',
          createRule
            ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800'
            : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        )}
      >
        <input
          type="checkbox"
          checked={createRule}
          onChange={(e) => setCreateRule(e.target.checked)}
          className="rounded w-5 h-5 text-primary-600"
        />
        <div className="flex-1">
          <span
            className={cn(
              'text-sm font-medium',
              createRule
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300'
            )}
          >
            Create rule for this pattern
          </span>
          {transactionMerchant && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Will apply to "{transactionMerchant}" in future
            </p>
          )}
        </div>
        <BookmarkPlus
          className={cn(
            'h-5 w-5',
            createRule ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
          )}
        />
      </label>

      {/* Action Buttons - Only show if createRule is on */}
      {createRule && (
        <div className="flex gap-2">
          <button
            onClick={() => selectedId && onSelect(selectedId, createRule)}
            disabled={!selectedId}
            className="flex-1 btn btn-primary py-3 disabled:opacity-50"
          >
            <Check className="h-5 w-5 mr-2" />
            Save with Rule
          </button>
          <button onClick={onCancel} className="btn btn-outline py-3">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Cancel only button when not in rule mode */}
      {!createRule && (
        <button onClick={onCancel} className="w-full btn btn-ghost py-2 text-gray-500">
          Cancel
        </button>
      )}
    </div>
  );
};
