'use client';

import { formatCurrency } from '@/lib/utils';
import { Target, TrendingDown, TrendingUp } from 'lucide-react';

interface CategoryGroupSummaryProps {
  categoryName: string;
  categoryIcon: string | null;
  categoryType: string; // 'income' | 'expense'
  totalAmount: number;
  plannedAmount: number | null;
  transactionCount: number;
}

export const CategoryGroupSummary = ({
  categoryName,
  categoryIcon,
  categoryType,
  totalAmount,
  plannedAmount,
  transactionCount,
}: CategoryGroupSummaryProps) => {
  const isIncome = categoryType === 'income';
  const hasbudget = plannedAmount !== null && plannedAmount > 0;

  // Calculate progress percentage for expenses
  const progressPct = hasbudget ? Math.min((totalAmount / plannedAmount) * 100, 100) : 0;
  const overBudget = hasbudget && totalAmount > plannedAmount;
  const remaining = hasbudget ? plannedAmount - totalAmount : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Amount Card */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {isIncome ? 'Total Income' : 'Total Expenses'}
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${isIncome ? 'text-success-600' : 'text-danger-600'}`}
            >
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{transactionCount} transactions</p>
          </div>
          <div className={`p-3 rounded-lg ${isIncome ? 'bg-success-100' : 'bg-danger-100'}`}>
            {isIncome ? (
              <TrendingUp
                className={`h-6 w-6 ${isIncome ? 'text-success-600' : 'text-danger-600'}`}
              />
            ) : (
              <TrendingDown className="h-6 w-6 text-danger-600" />
            )}
          </div>
        </div>
      </div>

      {/* Budget/Predicted Amount Card */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {isIncome ? 'Expected Income' : 'Budget Amount'}
            </p>
            <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
              {hasbudget ? formatCurrency(plannedAmount) : '—'}
            </p>
            {hasbudget && !isIncome && (
              <p className="text-xs text-gray-400 mt-1">{progressPct.toFixed(0)}% used</p>
            )}
          </div>
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Target className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
        </div>
      </div>

      {/* Remaining/Status Card */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {isIncome
                ? 'vs Expected'
                : hasbudget
                  ? overBudget
                    ? 'Over Budget'
                    : 'Remaining'
                  : 'No Budget Set'}
            </p>
            {hasbudget ? (
              <>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    isIncome
                      ? totalAmount >= plannedAmount
                        ? 'text-success-600'
                        : 'text-warning-600'
                      : overBudget
                        ? 'text-danger-600'
                        : 'text-success-600'
                  }`}
                >
                  {isIncome
                    ? `${totalAmount >= plannedAmount ? '+' : ''}${formatCurrency(totalAmount - plannedAmount)}`
                    : overBudget
                      ? `-${formatCurrency(Math.abs(remaining!))}`
                      : formatCurrency(remaining!)}
                </p>
                {!isIncome && (
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        overBudget
                          ? 'bg-danger-500'
                          : progressPct > 80
                            ? 'bg-warning-500'
                            : 'bg-success-500'
                      }`}
                      style={{ width: `${Math.min(progressPct, 100)}%` }}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-2xl font-bold mt-1 text-gray-400">—</p>
            )}
          </div>
          <div
            className={`p-3 rounded-lg ${
              !hasbudget
                ? 'bg-gray-100 dark:bg-gray-800'
                : isIncome
                  ? totalAmount >= plannedAmount
                    ? 'bg-success-100'
                    : 'bg-warning-100'
                  : overBudget
                    ? 'bg-danger-100'
                    : 'bg-success-100'
            }`}
          >
            <span className="text-2xl">{categoryIcon || '📁'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
