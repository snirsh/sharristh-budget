'use client';

import { CategoryCombobox } from '@/components/ui/CategoryCombobox';
import { trpc } from '@/lib/trpc/client';
import { cn, formatCurrency, formatDate, formatMonth } from '@/lib/utils';
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  FolderKanban,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AICategoryBadgeCompact } from './AICategoryBadge';
import { AddTransactionDialog } from './AddTransactionDialog';
import { CategoryGroupSummary } from './CategoryGroupSummary';
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

  // Group by category view state
  const [isGroupByCategory, setIsGroupByCategory] = useState(false);
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState<string | null>(null);

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
    isFetching,
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
  const {
    data: monthlySummary,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = trpc.transactions.monthlySummary.useQuery({
    startDate,
    endDate,
    includeIgnored: showIgnored || undefined,
  });

  // Track if we're refreshing data (not initial load)
  const isRefreshing = (isFetching && !isLoading) || isFetchingSummary;

  // Type for grouped category data
  type GroupedCategoryGroup = {
    categoryId: string;
    category: {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
      type: string;
    } | null;
    totalAmount: number;
    plannedAmount: number | null;
    limitAmount: number | null;
    transactionCount: number;
    transactions: typeof transactions;
  };

  // Fetch grouped by category data when in group view
  const { data: groupedData, isLoading: isLoadingGrouped } =
    trpc.transactions.groupedByCategory.useQuery(
      {
        startDate,
        endDate,
        month: currentMonth ?? undefined,
        includeIgnored: showIgnored || undefined,
      },
      {
        enabled: isGroupByCategory,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      }
    );

  // Get the selected category group data
  const selectedGroupData = useMemo((): GroupedCategoryGroup | null => {
    if (!selectedCategoryGroup || !groupedData) return null;
    return (
      (groupedData.groups as GroupedCategoryGroup[]).find(
        (g) => g.categoryId === selectedCategoryGroup
      ) ?? null
    );
  }, [selectedCategoryGroup, groupedData]);

  // When in group view with a selected category, use the grouped data's transactions
  const displayTransactions = useMemo(() => {
    if (isGroupByCategory && selectedCategoryGroup && selectedGroupData) {
      return selectedGroupData.transactions.map((tx) => ({
        ...tx,
        formattedAmount: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Math.abs(tx.amount)),
        formattedDate: new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(tx.date)),
        categoryPath: tx.category ? tx.category.name : 'Uncategorized',
        recurringTemplate: null as { id: string; name: string; frequency: string } | null,
      }));
    }
    return transactions;
  }, [isGroupByCategory, selectedCategoryGroup, selectedGroupData, transactions]);

  const utils = trpc.useUtils();

  const recategorizeMutation = trpc.transactions.recategorize.useMutation({
    onMutate: (variables) => {
      // Find the selected category for optimistic update
      const selectedCat = categories.find((c) => c.id === variables.categoryId);
      const categoryForUpdate = selectedCat
        ? {
            id: selectedCat.id,
            name: selectedCat.name,
            icon: selectedCat.icon ?? null,
            color: null,
            type: selectedCat.type,
          }
        : null;

      // Optimistically update the local cache for immediate feedback
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
                      category: categoryForUpdate,
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

      // Close the editor immediately for better UX
      setEditingTransaction(null);
    },
    onSuccess: (data, variables) => {
      // Cast to access new fields (TypeScript doesn't know about them yet)
      const result = data as typeof data & { additionalUpdated?: number; ruleCreated?: boolean };
      const selectedCat = categories.find((c) => c.id === variables.categoryId);

      // Show success notification
      if (result.ruleCreated && result.additionalUpdated && result.additionalUpdated > 0) {
        toast.success(`Category updated to ${selectedCat?.name ?? 'Unknown'}`, {
          description: `Rule created and applied to ${result.additionalUpdated} other transaction(s)`,
        });
        // Invalidate cache to show all updated transactions
        utils.transactions.list.invalidate();
      } else if (result.ruleCreated) {
        toast.success(`Category updated to ${selectedCat?.name ?? 'Unknown'}`, {
          description: 'Rule created for future transactions',
        });
      } else {
        toast.success(`Category updated to ${selectedCat?.name ?? 'Unknown'}`);
      }

      // Refetch in background to ensure consistency
      refetch();
      refetchSummary();
    },
    onError: (error) => {
      // Revert optimistic update on error
      utils.transactions.list.invalidate();
      toast.error('Failed to update category', {
        description: error.message,
      });
    },
  });

  const applyCategorizationMutation = trpc.transactions.applyCategorization.useMutation({
    onSuccess: (data) => {
      // Immediately invalidate and refetch all transaction queries
      utils.transactions.list.invalidate();
      utils.transactions.monthlySummary.invalidate();
      refetch();
      refetchSummary();
      // Show toast notification
      if (data.remaining && data.remaining > 0) {
        toast.success(data.message, {
          description: 'Click "Auto-Categorize" again to continue.',
          duration: 5000,
        });
      } else {
        toast.success(data.message);
      }
    },
    onError: (error) => {
      toast.error('Auto-categorization failed', {
        description: error.message,
      });
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
      // Show toast notification
      if (result.ruleCreated && result.additionalUpdated && result.additionalUpdated > 0) {
        toast.success(`Updated ${result.updated} transaction(s)`, {
          description: `Rule created and applied to ${result.additionalUpdated} additional transaction(s)`,
        });
      } else {
        toast.success(`Updated ${result.updated} transaction(s)`);
      }
    },
    onError: (error) => {
      toast.error('Failed to update transactions', {
        description: error.message,
      });
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
    if (selectedIds.size === displayTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayTransactions.map((tx) => tx.id)));
    }
  };

  const isAllSelected =
    displayTransactions.length > 0 && selectedIds.size === displayTransactions.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < displayTransactions.length;

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
      {/* Floating Update Indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50">
          {/* Progress bar */}
          <div className="h-1 bg-primary-100 dark:bg-primary-900/50 overflow-hidden">
            <div className="h-full bg-primary-500 animate-progress-indeterminate" />
          </div>
          {/* Toast notification */}
          <div className="flex justify-center">
            <div className="mt-2 mx-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
              <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Updating transactions...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {displayTransactions.length}{' '}
            {!isGroupByCategory && total > 0 && total !== displayTransactions.length
              ? `of ${total}`
              : ''}{' '}
            transactions
            {needsReviewFilter && ' needing review'}
            {showIgnored && ' (including ignored)'}
            {isGroupByCategory &&
              selectedGroupData &&
              ` in ${selectedGroupData.category?.name || 'Uncategorized'}`}
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

      {/* Transaction Summary - conditionally show category summary or overall summary */}
      {isGroupByCategory && selectedGroupData ? (
        <CategoryGroupSummary
          categoryName={selectedGroupData.category?.name ?? 'Uncategorized'}
          categoryIcon={selectedGroupData.category?.icon ?? null}
          categoryType={selectedGroupData.category?.type ?? 'expense'}
          totalAmount={selectedGroupData.totalAmount}
          plannedAmount={selectedGroupData.plannedAmount}
          transactionCount={selectedGroupData.transactionCount}
        />
      ) : (
        <TransactionSummary
          totalIncome={monthlySummary?.totalIncome ?? 0}
          totalExpenses={monthlySummary?.totalExpenses ?? 0}
          netBalance={monthlySummary?.netBalance ?? 0}
        />
      )}

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

        <button
          onClick={() => {
            setIsGroupByCategory(!isGroupByCategory);
            setSelectedCategoryGroup(null);
          }}
          className={cn('btn', isGroupByCategory ? 'btn-primary' : 'btn-outline')}
          title="Group transactions by category"
        >
          <FolderKanban className="h-4 w-4 mr-2" />
          Group by Category
        </button>
      </div>

      {/* Category Groups View */}
      {isGroupByCategory && !selectedCategoryGroup && (
        <div className="card p-0 overflow-hidden">
          {isLoadingGrouped ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">Loading category groups...</p>
            </div>
          ) : groupedData && groupedData.groups.length > 0 ? (
            <>
              <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categories with Transactions ({groupedData.totalCategories})
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(groupedData.groups as GroupedCategoryGroup[]).map((group) => {
                  const isIncome = group.category?.type === 'income';
                  const hasbudget = group.plannedAmount !== null && group.plannedAmount > 0;
                  const progressPct = hasbudget
                    ? Math.min((group.totalAmount / group.plannedAmount!) * 100, 100)
                    : 0;
                  const overBudget = hasbudget && group.totalAmount > group.plannedAmount!;

                  return (
                    <button
                      key={group.categoryId}
                      onClick={() => setSelectedCategoryGroup(group.categoryId)}
                      className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg text-xl">
                        {group.category?.icon || '❓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {group.category?.name || 'Uncategorized'}
                          </p>
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded-full',
                              isIncome
                                ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            )}
                          >
                            {isIncome ? 'Income' : 'Expense'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {group.transactionCount} transaction
                          {group.transactionCount !== 1 ? 's' : ''}
                        </p>
                        {/* Progress bar for expense categories with budget */}
                        {!isIncome && hasbudget && (
                          <div className="mt-1.5 w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className={cn(
                                'h-1.5 rounded-full transition-all',
                                overBudget
                                  ? 'bg-danger-500'
                                  : progressPct > 80
                                    ? 'bg-warning-500'
                                    : 'bg-success-500'
                              )}
                              style={{ width: `${Math.min(progressPct, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-semibold',
                            isIncome ? 'text-success-600' : 'text-gray-900 dark:text-white'
                          )}
                        >
                          {isIncome ? '+' : ''}
                          {formatCurrency(group.totalAmount)}
                        </p>
                        {hasbudget && (
                          <p
                            className={cn(
                              'text-xs',
                              overBudget ? 'text-danger-600' : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {overBudget ? 'Over ' : ''}budget:{' '}
                            {formatCurrency(group.plannedAmount!)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No transactions found for this period
            </div>
          )}
        </div>
      )}

      {/* Back button when viewing a category group */}
      {isGroupByCategory && selectedCategoryGroup && (
        <button
          onClick={() => setSelectedCategoryGroup(null)}
          className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Categories
        </button>
      )}

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
      {(!isGroupByCategory || selectedCategoryGroup) && (
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
              {displayTransactions.map((tx) => (
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
                        {tx.isIgnored ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
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
              {displayTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
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
          {!isGroupByCategory && (hasMore || isFetchingNextPage) && (
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
                  {total - displayTransactions.length} more transactions available
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transactions List - Mobile Card View */}
      {(!isGroupByCategory || selectedCategoryGroup) && (
        <div className="md:hidden space-y-3">
          {displayTransactions.length > 0 && (
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
          {displayTransactions.map((tx) => (
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
          {displayTransactions.length === 0 && (
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
          {!isGroupByCategory && (hasMore || isFetchingNextPage) && (
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
                  {total - displayTransactions.length} more available
                </span>
              )}
            </div>
          )}
        </div>
      )}

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

  // Always save immediately when a category is selected
  const handleCategorySelect = (categoryId: string) => {
    onSelect(categoryId, createRule);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CategoryCombobox
        categories={categories}
        value={currentCategoryId}
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
          onChange={(e) => setCreateRule(e.target.checked)}
          className="rounded w-3.5 h-3.5"
        />
        <BookmarkPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Rule</span>
      </label>

      <button
        onClick={onCancel}
        className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Cancel"
      >
        <X className="h-4 w-4" />
      </button>
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

  // Always save immediately when tapping a category
  const handleCategorySelect = (categoryId: string) => {
    onSelect(categoryId, createRule);
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

      {/* Rule Toggle - shown first so user can check before selecting */}
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
            Create rule for future transactions
          </span>
          {transactionMerchant && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Will apply to "{transactionMerchant}"
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

      {/* Category Grid - tap to select and save */}
      <div className="max-h-64 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-3 rounded-lg text-left transition-colors',
                cat.id === currentCategoryId
                  ? 'bg-primary-100 dark:bg-primary-900/50 border-2 border-primary-500'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500'
              )}
            >
              <span className="text-xl">{cat.icon || '📁'}</span>
              <span
                className={cn(
                  'text-sm truncate',
                  cat.id === currentCategoryId
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

      {/* Cancel button */}
      <button onClick={onCancel} className="w-full btn btn-ghost py-2 text-gray-500">
        Cancel
      </button>
    </div>
  );
};
