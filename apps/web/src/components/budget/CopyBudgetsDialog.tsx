'use client';

import { trpc } from '@/lib/trpc/client';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, Copy, Loader2, X } from 'lucide-react';

interface CopyBudgetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fromMonth: string;
  toMonth: string;
}

export function CopyBudgetsDialog({ isOpen, onClose, fromMonth, toMonth }: CopyBudgetsDialogProps) {
  const utils = trpc.useUtils();

  const { data: summary, isLoading } = trpc.budgets.summaryForMonth.useQuery(fromMonth, {
    enabled: isOpen,
  });

  const copyMutation = trpc.budgets.copyMonth.useMutation({
    onSuccess: () => {
      utils.budgets.forMonth.invalidate(toMonth);
      onClose();
    },
  });

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleCopy = () => {
    copyMutation.mutate({ fromMonth, toMonth });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Copy Budgets</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading budget summary...</span>
            </div>
          ) : summary && summary.count > 0 ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  Copy <strong>{summary.count} budget items</strong> totaling{' '}
                  <strong>{formatCurrency(summary.totalPlanned)}</strong> from{' '}
                  {formatMonth(fromMonth)} to {formatMonth(toMonth)}.
                </p>
              </div>

              {/* Budget List Preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Budgets to copy:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {summary.budgets.map((budget) => (
                    <div
                      key={budget.categoryId}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{budget.categoryIcon || '📁'}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {budget.categoryName}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(budget.plannedAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Existing budgets for {formatMonth(toMonth)} will not be overwritten.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No budgets found in {formatMonth(fromMonth)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline flex-1"
            disabled={copyMutation.isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            className="btn btn-primary flex-1"
            disabled={copyMutation.isPending || !summary || summary.count === 0}
          >
            {copyMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Copying...
              </>
            ) : copyMutation.isSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy {summary?.count || 0} Budgets
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
