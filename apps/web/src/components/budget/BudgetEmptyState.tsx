'use client';

import { Copy, Plus, Sparkles, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BudgetEmptyStateProps {
  currentMonth: string;
  previousMonth: string;
  hasPreviousBudgets: boolean;
  onCopyFromPrevious: () => void;
  onStartFromScratch: () => void;
  onSmartSuggestions?: () => void;
}

export function BudgetEmptyState({
  currentMonth,
  previousMonth,
  hasPreviousBudgets,
  onCopyFromPrevious,
  onStartFromScratch,
  onSmartSuggestions,
}: BudgetEmptyStateProps) {
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="card py-12 px-6 text-center">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <PiggyBank className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        </div>

        {/* Title */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            No budgets for {formatMonth(currentMonth)}
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Set up your monthly budget to track spending and stay on top of your finances.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid gap-3 sm:grid-cols-2 pt-4">
          {/* Copy from Previous */}
          {hasPreviousBudgets && (
            <button
              onClick={onCopyFromPrevious}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed',
                'border-gray-200 dark:border-gray-700',
                'hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20',
                'transition-all duration-200 text-left'
              )}
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Copy className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-white">
                  Copy from {formatMonth(previousMonth)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Use last month's budget as a template
                </p>
              </div>
            </button>
          )}

          {/* Start from Scratch */}
          <button
            onClick={onStartFromScratch}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed',
              'border-gray-200 dark:border-gray-700',
              'hover:border-success-500 hover:bg-success-50 dark:hover:bg-success-900/20',
              'transition-all duration-200 text-left',
              !hasPreviousBudgets && 'sm:col-span-2'
            )}
          >
            <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <Plus className="h-5 w-5 text-success-600 dark:text-success-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900 dark:text-white">
                Start from Scratch
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create a new budget manually
              </p>
            </div>
          </button>
        </div>

        {/* Smart Suggestions (if available) */}
        {onSmartSuggestions && (
          <div className="pt-2">
            <button
              onClick={onSmartSuggestions}
              className={cn(
                'w-full flex items-center justify-center gap-2 p-3 rounded-lg',
                'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
                'border border-purple-200 dark:border-purple-800',
                'hover:from-purple-500/20 hover:to-pink-500/20',
                'transition-all duration-200'
              )}
            >
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Use Smart Suggestions
              </span>
              <span className="text-xs text-purple-500 dark:text-purple-400">
                Based on your spending history
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
