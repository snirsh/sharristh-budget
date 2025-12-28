'use client';

import { formatCurrency, formatPercent, formatMonth, getStatusBadgeClass, getStatusLabel, cn, formatDate } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertTriangle,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardContentProps {
  month: string;
  overview: {
    kpis: {
      totalIncome: number;
      totalExpenses: number;
      netSavings: number;
      savingsRate: number;
    };
    budgetSummary: {
      total: number;
      onTrack: number;
      nearingLimit: number;
      exceededSoft: number;
      exceededHard: number;
    };
    alerts: Array<{
      categoryId: string;
      categoryName?: string;
      status: string;
      percentUsed: number;
      actualAmount: number;
      plannedAmount: number;
      limitAmount?: number | null;
    }>;
    varyingExpenses: {
      count: number;
      total: number;
    };
    needsReviewCount: number;
  };
  categoryBreakdown: Array<{
    category: {
      id: string;
      name: string;
      icon?: string | null;
      color?: string | null;
      type: string;
    };
    plannedAmount: number;
    actualAmount: number;
    percentUsed: number;
    status: string;
  }>;
  recentTransactions: Array<{
    id: string;
    date: Date;
    description: string;
    amount: number;
    direction: string;
    category?: { name: string; icon?: string | null } | null;
  }>;
}

export function DashboardContent({
  month,
  overview,
  categoryBreakdown,
  recentTransactions,
}: DashboardContentProps) {
  const { kpis, budgetSummary, alerts, varyingExpenses, needsReviewCount } = overview;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">{formatMonth(month)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/transactions" className="btn-secondary btn-sm">
            View All Transactions
          </Link>
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

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="card border-l-4 border-warning-500 bg-warning-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-warning-800">Budget Alerts</h3>
              <p className="text-sm text-warning-700 mt-1">
                {alerts.length} {alerts.length === 1 ? 'category' : 'categories'} need attention
              </p>
              <div className="mt-3 space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div key={alert.categoryId} className="flex items-center justify-between text-sm">
                    <span className="text-warning-800">{alert.categoryName}</span>
                    <span className={cn('badge', getStatusBadgeClass(alert.status))}>
                      {getStatusLabel(alert.status)} • {formatPercent(alert.percentUsed)}
                    </span>
                  </div>
                ))}
              </div>
              {alerts.length > 3 && (
                <Link href="/budget" className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-warning-700 hover:text-warning-800">
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
          <div className="card border-l-4 border-primary-500 bg-primary-50 hover:bg-primary-100 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-primary-600" />
                <div>
                  <h3 className="font-semibold text-primary-800">
                    {needsReviewCount} transactions need review
                  </h3>
                  <p className="text-sm text-primary-700">
                    Click to categorize and organize
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-primary-600" />
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
            <Link href="/budget" className="text-sm text-primary-600 hover:text-primary-700">
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
              <p className="text-center text-gray-500 py-8">No expenses this month yet</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Link href="/transactions" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{tx.category?.icon || '📝'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {tx.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(tx.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'font-medium',
                    tx.direction === 'income' ? 'text-success-600' : 'text-gray-900'
                  )}
                >
                  {tx.direction === 'income' ? '+' : '-'}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transactions yet</p>
            )}
          </div>
        </div>
      </div>

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
        <span className="text-sm text-gray-500">{title}</span>
        <span className={trendColors[trend]}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
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
          <span className="text-sm font-medium text-gray-900 truncate">
            {item.category.name}
          </span>
          <span className="text-sm text-gray-500">
            {formatCurrency(item.actualAmount)}
            {item.plannedAmount > 0 && (
              <span className="text-gray-400"> / {formatCurrency(item.plannedAmount)}</span>
            )}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              // Green for 0-100%, red only when exceeded (>100%)
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
    <div className="text-center p-3 rounded-lg bg-gray-50">
      <p
        className={cn(
          'text-2xl font-bold',
          color === 'success' && 'text-success-600',
          color === 'warning' && 'text-warning-600',
          color === 'danger' && 'text-danger-600',
          !color && 'text-gray-900'
        )}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

