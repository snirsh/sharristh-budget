'use client';

import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { Edit2, Trash2 } from 'lucide-react';

interface BudgetCardProps {
  evaluation: {
    budget: {
      id: string;
      categoryId: string;
      plannedAmount: number;
      limitAmount?: number | null;
      limitType?: string | null;
    };
    category?: {
      id: string;
      name: string;
      icon?: string | null;
    } | null;
    actualAmount: number;
    percentUsed: number;
    status: string;
    isOverLimit: boolean;
  };
  onEdit: () => void;
  onDelete: () => void;
}

// Helper to get progress bar color class based on percentage
function getProgressBarColor(percentUsed: number): string {
  if (percentUsed > 1.0) return 'bg-danger-500'; // Red: exceeded (>100%)
  if (percentUsed > 0.7) return 'bg-warning-500'; // Yellow: nearing limit (70-100%)
  return 'bg-success-500'; // Green: on track (0-70%)
}

// Helper to get status indicator
function getStatusIndicator(percentUsed: number): { icon: string; color: string } {
  if (percentUsed > 1.0) return { icon: '🔴', color: 'text-danger-600' };
  if (percentUsed > 0.7) return { icon: '⚠️', color: 'text-warning-600' };
  return { icon: '✅', color: 'text-success-600' };
}

export function BudgetCard({ evaluation, onEdit, onDelete }: BudgetCardProps) {
  const remaining = evaluation.budget.plannedAmount - evaluation.actualAmount;
  const progressWidth = Math.min(evaluation.percentUsed * 100, 100);
  const status = getStatusIndicator(evaluation.percentUsed);

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{evaluation.category?.icon || '📁'}</span>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              {evaluation.category?.name || 'Unknown'}
            </h3>
            {evaluation.budget.limitAmount && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Limit: {formatCurrency(evaluation.budget.limitAmount)} (
                {evaluation.budget.limitType})
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-lg"
            title={
              evaluation.percentUsed > 1
                ? 'Exceeded'
                : evaluation.percentUsed > 0.7
                  ? 'Nearing limit'
                  : 'On track'
            }
          >
            {status.icon}
          </span>
          <span className={cn('text-sm font-medium', status.color)}>
            {formatPercent(evaluation.percentUsed)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              getProgressBarColor(evaluation.percentUsed)
            )}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className={cn('font-medium', evaluation.isOverLimit && 'text-danger-600')}>
            {formatCurrency(evaluation.actualAmount)}
          </span>
          <span className="text-gray-400 dark:text-gray-500"> / </span>
          <span className="text-gray-600 dark:text-gray-300">
            {formatCurrency(evaluation.budget.plannedAmount)}
          </span>
        </div>
        <div className={cn('font-medium', remaining >= 0 ? 'text-success-600' : 'text-danger-600')}>
          {remaining >= 0
            ? `${formatCurrency(remaining)} left`
            : `${formatCurrency(Math.abs(remaining))} over`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-danger-600 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded-md transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
