'use client';

import { MonthSelector } from '@/components/layout/MonthSelector';
import { trpc } from '@/lib/trpc/client';
import { useMonth } from '@/lib/useMonth';
import {
  cn,
  formatCurrency,
  formatPercent,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/utils';
import { AlertCircle, Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AddBudgetDialog } from './AddBudgetDialog';
import { BudgetCard } from './BudgetCard';
import { BudgetEmptyState } from './BudgetEmptyState';
import { CopyBudgetsDialog } from './CopyBudgetsDialog';

// Helper to get previous month in YYYY-MM format
function getPreviousMonth(currentMonth: string): string {
  const [year, month] = currentMonth.split('-').map(Number);
  const prevDate = new Date(year!, month! - 2, 1); // month is 0-indexed, so -2
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

// Helper to get progress bar color class based on percentage
function getProgressBarColor(percentUsed: number): string {
  if (percentUsed > 1.0) return 'bg-danger-500'; // Red: exceeded (>100%)
  if (percentUsed > 0.7) return 'bg-warning-500'; // Yellow: nearing limit (70-100%)
  return 'bg-success-500'; // Green: on track (0-70%)
}

export const BudgetContent = () => {
  const { currentMonth } = useMonth();
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    plannedAmount: number;
    limitAmount: number | null;
    limitType: string | null;
  }>({ plannedAmount: 0, limitAmount: null, limitType: null });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);

  const previousMonth = useMemo(() => getPreviousMonth(currentMonth), [currentMonth]);

  const utils = trpc.useUtils();

  const {
    data: budgets = [],
    isLoading,
    isError,
    error,
  } = trpc.budgets.forMonth.useQuery(currentMonth);

  // Check if previous month has budgets (for copy feature)
  const { data: previousMonthSummary } = trpc.budgets.summaryForMonth.useQuery(previousMonth, {
    enabled: budgets.length === 0 && !isLoading, // Only fetch when current month is empty
  });

  const upsertMutation = trpc.budgets.upsert.useMutation({
    onSuccess: () => {
      utils.budgets.forMonth.invalidate(currentMonth);
      setEditingBudget(null);
    },
  });

  const deleteMutation = trpc.budgets.delete.useMutation({
    onSuccess: () => {
      utils.budgets.forMonth.invalidate(currentMonth);
    },
  });

  const startEditing = (evaluation: (typeof budgets)[number]) => {
    setEditingBudget(evaluation.budget.categoryId);
    setEditValues({
      plannedAmount: evaluation.budget.plannedAmount,
      limitAmount: evaluation.budget.limitAmount ?? null,
      limitType: evaluation.budget.limitType ?? null,
    });
  };

  const saveEdit = (categoryId: string) => {
    upsertMutation.mutate({
      categoryId,
      month: currentMonth,
      plannedAmount: editValues.plannedAmount,
      limitAmount: editValues.limitAmount ?? undefined,
      limitType: (editValues.limitType as 'soft' | 'hard') ?? undefined,
    });
  };

  const handleDelete = (budgetId: string) => {
    if (confirm('Are you sure you want to delete this budget?')) {
      deleteMutation.mutate(budgetId);
    }
  };

  type BudgetEvaluation = (typeof budgets)[number];
  const totalPlanned = budgets.reduce(
    (sum: number, b: BudgetEvaluation) => sum + b.budget.plannedAmount,
    0
  );
  const totalActual = budgets.reduce((sum: number, b: BudgetEvaluation) => sum + b.actualAmount, 0);

  return (
    <div className="space-y-6 animate-in">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budget</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your monthly spending limits</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsCreateDialogOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Add Budget
          </button>
          <MonthSelector />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">Loading budgets...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-danger-50 dark:bg-danger-900/30 border-danger-200 dark:border-danger-800">
          <div className="flex items-center gap-2 text-danger-700 dark:text-danger-400">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">Failed to load budgets</p>
          </div>
          <p className="text-sm text-danger-600 dark:text-danger-400 mt-1">
            {error?.message || 'An error occurred while loading budgets'}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Planned</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalPlanned)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalActual)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  totalPlanned - totalActual >= 0 ? 'text-success-600' : 'text-danger-600'
                )}
              >
                {formatCurrency(totalPlanned - totalActual)}
              </p>
            </div>
          </div>

          {/* Budget Cards (Mobile View) */}
          {budgets.length > 0 && (
            <div className="grid gap-4 md:hidden">
              {budgets.map((evaluation: BudgetEvaluation) => (
                <BudgetCard
                  key={evaluation.budget.id}
                  evaluation={evaluation}
                  onEdit={() => startEditing(evaluation)}
                  onDelete={() => handleDelete(evaluation.budget.id)}
                />
              ))}
            </div>
          )}

          {/* Budget Table (Desktop View) */}
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Planned
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Limit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Spent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {budgets.map((evaluation: BudgetEvaluation) => {
                  const isEditing = editingBudget === evaluation.budget.categoryId;
                  const progressWidth = Math.min(evaluation.percentUsed * 100, 100);

                  return (
                    <tr
                      key={evaluation.budget.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{evaluation.category?.icon || '📁'}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {evaluation.category?.name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.plannedAmount}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                plannedAmount: Number(e.target.value),
                              })
                            }
                            className="input text-right w-28 py-1"
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white">
                            {formatCurrency(evaluation.budget.plannedAmount)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editValues.limitAmount || ''}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  limitAmount: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              placeholder="No limit"
                              className="input text-right w-24 py-1"
                            />
                            <select
                              value={editValues.limitType || ''}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  limitType: e.target.value || null,
                                })
                              }
                              className="input w-20 py-1 text-xs"
                            >
                              <option value="">None</option>
                              <option value="soft">Soft</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">
                            {evaluation.budget.limitAmount
                              ? `${formatCurrency(evaluation.budget.limitAmount)} (${evaluation.budget.limitType})`
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn('font-medium', evaluation.isOverLimit && 'text-danger-600')}
                        >
                          {formatCurrency(evaluation.actualAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              getProgressBarColor(evaluation.percentUsed)
                            )}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatPercent(evaluation.percentUsed)} used
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn('badge text-xs', getStatusBadgeClass(evaluation.status))}
                        >
                          {getStatusLabel(evaluation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => saveEdit(evaluation.budget.categoryId)}
                              className="p-1 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/30 rounded"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingBudget(null)}
                              className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => startEditing(evaluation)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Edit budget"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(evaluation.budget.id)}
                              className="p-1 text-danger-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded"
                              title="Delete budget"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty State */}
      {!isLoading && !isError && budgets.length === 0 && (
        <BudgetEmptyState
          currentMonth={currentMonth}
          previousMonth={previousMonth}
          hasPreviousBudgets={(previousMonthSummary?.count ?? 0) > 0}
          onCopyFromPrevious={() => setIsCopyDialogOpen(true)}
          onStartFromScratch={() => setIsCreateDialogOpen(true)}
        />
      )}

      {/* Add Budget Dialog */}
      <AddBudgetDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        currentMonth={currentMonth}
      />

      {/* Copy Budgets Dialog */}
      <CopyBudgetsDialog
        isOpen={isCopyDialogOpen}
        onClose={() => setIsCopyDialogOpen(false)}
        fromMonth={previousMonth}
        toMonth={currentMonth}
      />
    </div>
  );
};
