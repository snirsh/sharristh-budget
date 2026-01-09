'use client';

import { useState } from 'react';
import { formatCurrency, formatPercent, getStatusBadgeClass, getStatusLabel, cn, formatDate } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertTriangle,
  ArrowRight,
  Receipt,
  CreditCard,
  Calendar,
  Repeat,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { MonthSelector } from '@/components/layout/MonthSelector';
import { useMonth } from '@/lib/useMonth';
import { trpc } from '@/lib/trpc/client';
import type { RouterOutputs } from '@sfam/api';
import { InsightCard } from './InsightCard';
import { TopMerchantsList } from './TopMerchantsList';
import { LargestTransactionsList } from './LargestTransactionsList';

type DashboardData = RouterOutputs['dashboard']['getFullDashboard'];
type ExpenseInsightsData = RouterOutputs['dashboard']['getExpenseInsights'];

// Helper to format relative time
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';
  
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date));
}

// Helper to get sync status color
function getSyncStatusColor(date: Date | null): string {
  if (!date) return 'text-gray-400 dark:text-gray-500';
  
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = diff / 3600000;
  
  if (hours < 24) return 'text-success-500 dark:text-success-400';
  if (hours < 168) return 'text-warning-500 dark:text-warning-400'; // 7 days
  return 'text-danger-500 dark:text-danger-400';
}

type DashboardClientProps = {
  initialData: DashboardData;
  initialMonth: string;
  initialInsights?: ExpenseInsightsData;
};

export const DashboardClient = ({ initialData, initialMonth, initialInsights }: DashboardClientProps) => {
  const { currentMonth } = useMonth();
  const [isSyncing, setIsSyncing] = useState(false);
  const utils = trpc.useUtils();

  // Sync all bank connections
  const syncAllMutation = trpc.bankConnections.syncAll.useMutation({
    onMutate: () => {
      setIsSyncing(true);
    },
    onSuccess: (data) => {
      // Invalidate and refetch dashboard data after sync
      utils.dashboard.getFullDashboard.invalidate();
      utils.dashboard.getExpenseInsights.invalidate();
      utils.transactions.list.invalidate();
      
      const newCount = data.results?.reduce((sum, r) => sum + (r.transactionsNew ?? 0), 0) ?? 0;
      if (newCount > 0) {
        console.log(`[Sync] Added ${newCount} new transactions`);
      }
    },
    onSettled: () => {
      setIsSyncing(false);
    },
  });

  const handleSyncNow = () => {
    if (!isSyncing) {
      syncAllMutation.mutate({});
    }
  };

  // Only refetch if month changes from initial
  const { data: dashboardData } = trpc.dashboard.getFullDashboard.useQuery(
    {
      month: currentMonth,
      recentLimit: 5,
    },
    {
      initialData: currentMonth === initialMonth ? initialData : undefined,
      // Only refetch when month changes
      enabled: currentMonth !== initialMonth,
    }
  );

  // Fetch expense insights
  const { data: insightsData } = trpc.dashboard.getExpenseInsights.useQuery(
    { month: currentMonth },
    {
      initialData: currentMonth === initialMonth ? initialInsights : undefined,
      enabled: currentMonth !== initialMonth || !initialInsights,
    }
  );

  const overview = dashboardData?.overview;
  const categoryBreakdown = dashboardData?.categoryBreakdown ?? [];
  const recentTransactions = dashboardData?.recentTransactions ?? [];

  const kpis = overview?.kpis ?? { totalIncome: 0, totalExpenses: 0, netSavings: 0, savingsRate: 0 };
  const budgetSummary = overview?.budgetSummary ?? { total: 0, onTrack: 0, nearingLimit: 0, exceededSoft: 0, exceededHard: 0 };
  const alerts = overview?.alerts ?? [];
  const varyingExpenses = overview?.varyingExpenses ?? { count: 0, total: 0 };
  const needsReviewCount = overview?.needsReviewCount ?? 0;

  // Expense insights data
  const insights = insightsData ?? null;

  return (
    <div className="space-y-6 animate-in">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500 dark:text-gray-400">Overview for the selected month</p>
            <div className="flex items-center gap-2">
              {insights?.lastSyncAt && (
                <div className={cn(
                  'flex items-center gap-1.5 text-xs',
                  getSyncStatusColor(insights.lastSyncAt)
                )}>
                  <RefreshCw className="h-3 w-3" />
                  <span>Synced {formatRelativeTime(insights.lastSyncAt)}</span>
                </div>
              )}
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors',
                  'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
                  'hover:bg-primary-200 dark:hover:bg-primary-900/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
                <span>{isSyncing ? 'Syncing...' : 'Sync now'}</span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/transactions?month=${currentMonth}`} className="btn-secondary btn-sm">
            View All Transactions
          </Link>
          <MonthSelector />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Income"
          value={formatCurrency(kpis.totalIncome)}
          icon={<TrendingUp className="h-5 w-5 text-success-500" />}
          trend="up"
        />
        <KPICard
          title="Expenses"
          value={formatCurrency(kpis.totalExpenses)}
          icon={<TrendingDown className="h-5 w-5 text-danger-500" />}
          trend="neutral"
        />
        <KPICard
          title="Net Savings"
          value={formatCurrency(kpis.netSavings)}
          icon={<PiggyBank className="h-5 w-5 text-primary-500" />}
          trend={kpis.netSavings >= 0 ? 'up' : 'down'}
          subtitle={`${formatPercent(kpis.savingsRate)} savings rate`}
        />
        <KPICard
          title="Varying Expenses"
          value={formatCurrency(varyingExpenses.total)}
          icon={<AlertTriangle className="h-5 w-5 text-warning-500" />}
          trend="neutral"
          subtitle={`${varyingExpenses.count} transactions`}
        />
      </div>

      {/* Expense Insights Cards */}
      {insights && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InsightCard
            title="Credit Card"
            value={insights.formattedCreditCardTotal}
            icon={CreditCard}
          />
          <InsightCard
            title="Expected"
            value={insights.formattedExpectedExpenses}
            subtitle="budgeted"
            icon={Calendar}
          />
          <InsightCard
            title="vs Last Month"
            value={insights.monthComparison.formattedPercentChange}
            trend={insights.monthComparison.trend}
            trendValue={insights.monthComparison.formattedCurrentMonth}
            trendPositive="down"
            subtitle="expenses"
          />
          <InsightCard
            title="Recurring"
            value={insights.formattedRecurringTotal}
            subtitle="monthly"
            icon={Repeat}
          />
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="card border-l-4 border-warning-500 bg-warning-50 dark:bg-warning-900/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-600 dark:text-warning-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-warning-800 dark:text-warning-300">Budget Alerts</h3>
              <p className="text-sm text-warning-700 dark:text-warning-400 mt-1">
                {alerts.length} {alerts.length === 1 ? 'category' : 'categories'} need attention
              </p>
              <div className="mt-3 space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div key={alert.categoryId} className="flex items-center justify-between text-sm">
                    <span className="text-warning-800 dark:text-warning-200">{alert.categoryName}</span>
                    <span className={cn('badge', getStatusBadgeClass(alert.status))}>
                      {getStatusLabel(alert.status)} • {formatPercent(alert.percentUsed)}
                    </span>
                  </div>
                ))}
              </div>
              {alerts.length > 3 && (
                <Link href={`/budget?month=${currentMonth}`} className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-warning-700 dark:text-warning-400 hover:text-warning-800 dark:hover:text-warning-300">
                  View all alerts <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Needs Review Banner */}
      {needsReviewCount > 0 && (
        <Link href="/transactions?needsReview=true" className="block">
          <div className="card border-l-4 border-primary-500 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <div>
                  <h3 className="font-semibold text-primary-800 dark:text-primary-300">
                    {needsReviewCount} transactions need review
                  </h3>
                  <p className="text-sm text-primary-700 dark:text-primary-400">
                    Click to categorize and organize
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </Link>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Category Breakdown */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Expense Categories</h2>
            <Link href={`/budget?month=${currentMonth}`} className="text-sm text-primary-600 hover:text-primary-700">
              Manage budgets
            </Link>
          </div>
          <div className="space-y-4">
            {categoryBreakdown
              .filter((c) => c.actualAmount > 0 || c.plannedAmount > 0)
              .sort((a, b) => b.actualAmount - a.actualAmount)
              .slice(0, 6)
              .map((item) => (
                <CategoryRow key={item.category.id} item={item} />
              ))}
            {categoryBreakdown.filter((c) => c.actualAmount > 0).length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No expenses this month yet</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Link href={`/transactions?month=${currentMonth}`} className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{tx.category?.icon || '📝'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                      {tx.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(tx.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'font-medium',
                    tx.direction === 'income' ? 'text-success-600' : 'text-gray-900 dark:text-white'
                  )}
                >
                  {tx.direction === 'income' ? '+' : '-'}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No transactions yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Expense Insights Lists */}
      {insights && (insights.topMerchants.length > 0 || insights.largestTransactions.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TopMerchantsList merchants={insights.topMerchants} />
          <LargestTransactionsList transactions={insights.largestTransactions} />
        </div>
      )}

      {/* Budget Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Budget Overview</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatBox label="Total Budgets" value={budgetSummary.total} />
          <StatBox label="On Track" value={budgetSummary.onTrack} color="success" />
          <StatBox label="Nearing Limit" value={budgetSummary.nearingLimit} color="warning" />
          <StatBox label="Over Budget" value={budgetSummary.exceededSoft} color="warning" />
          <StatBox label="Hard Exceeded" value={budgetSummary.exceededHard} color="danger" />
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  icon,
  trend,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  subtitle?: string;
}) {
  const trendColors = {
    up: 'text-success-600',
    down: 'text-danger-600',
    neutral: 'text-gray-600',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
        <span className={trendColors[trend]}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function CategoryRow({
  item,
}: {
  item: {
    category: { id: string; name: string; icon?: string | null; color?: string | null };
    plannedAmount: number;
    actualAmount: number;
    percentUsed: number;
    status: string;
  };
}) {
  const progressWidth = Math.min(item.percentUsed * 100, 100);

  return (
    <div className="flex items-center gap-4">
      <span className="text-xl">{item.category.icon || '📁'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {item.category.name}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatCurrency(item.actualAmount)}
            {item.plannedAmount > 0 && (
              <span className="text-gray-400 dark:text-gray-500"> / {formatCurrency(item.plannedAmount)}</span>
            )}
          </span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              item.percentUsed <= 1.0
                ? 'bg-success-500'
                : 'bg-danger-500'
            )}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>
      <span className={cn('badge text-xs', getStatusBadgeClass(item.status))}>
        {formatPercent(item.percentUsed)}
      </span>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <p
        className={cn(
          'text-2xl font-bold',
          color === 'success' && 'text-success-600 dark:text-success-400',
          color === 'warning' && 'text-warning-600 dark:text-warning-400',
          color === 'danger' && 'text-danger-600 dark:text-danger-400',
          !color && 'text-gray-900 dark:text-white'
        )}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
