'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  formatCurrency,
  formatPercent,
  formatMonth,
  getStatusBadgeClass,
  getStatusLabel,
  cn,
} from '@/lib/utils';
import { Edit2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface BudgetContentProps {
  month: string;
}

export function BudgetContent({ month: initialMonth }: BudgetContentProps) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    plannedAmount: number;
    limitAmount: number | null;
    limitType: string | null;
  }>({ plannedAmount: 0, limitAmount: null, limitType: null });

  const utils = trpc.useUtils();

  const { data: budgets = [] } = trpc.budgets.forMonth.useQuery(currentMonth);

  const upsertMutation = trpc.budgets.upsert.useMutation({
    onSuccess: () => {
      utils.budgets.forMonth.invalidate(currentMonth);
      setEditingBudget(null);
    },
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, monthNum] = currentMonth.split('-').map(Number);
    const date = new Date(year!, monthNum! - 1);
    date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  };

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

  const totalPlanned = budgets.reduce((sum, b) => sum + b.budget.plannedAmount, 0);
  const totalActual = budgets.reduce((sum, b) => sum + b.actualAmount, 0);

  return (
    <div className="space-y-6 animate-in">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-500">Manage your monthly spending limits</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="btn-outline btn-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-lg font-medium min-w-[160px] text-center">
            {formatMonth(currentMonth)}
          </span>
          <button
            onClick={() => navigateMonth('next')}
            className="btn-outline btn-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Total Planned</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalPlanned)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalActual)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Remaining</p>
          <p
            className={cn(
              'text-2xl font-bold',
              totalPlanned - totalActual >= 0
                ? 'text-success-600'
                : 'text-danger-600'
            )}
          >
            {formatCurrency(totalPlanned - totalActual)}
          </p>
        </div>
      </div>

      {/* Budget List */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Planned
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Limit
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Spent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                Progress
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {budgets.map((evaluation) => {
              const isEditing = editingBudget === evaluation.budget.categoryId;
              const progressWidth = Math.min(evaluation.percentUsed * 100, 100);

              return (
                <tr key={evaluation.budget.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {evaluation.category?.icon || '📁'}
                      </span>
                      <span className="font-medium text-gray-900">
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
                      <span className="text-gray-900">
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
                              limitAmount: e.target.value
                                ? Number(e.target.value)
                                : null,
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
                      <span className="text-gray-500">
                        {evaluation.budget.limitAmount
                          ? `${formatCurrency(evaluation.budget.limitAmount)} (${evaluation.budget.limitType})`
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        'font-medium',
                        evaluation.isOverLimit && 'text-danger-600'
                      )}
                    >
                      {formatCurrency(evaluation.actualAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          evaluation.status === 'exceeded_hard'
                            ? 'bg-danger-500'
                            : evaluation.status === 'exceeded_soft' ||
                              evaluation.status === 'nearing_limit'
                            ? 'bg-warning-500'
                            : 'bg-success-500'
                        )}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatPercent(evaluation.percentUsed)} used
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'badge text-xs',
                        getStatusBadgeClass(evaluation.status)
                      )}
                    >
                      {getStatusLabel(evaluation.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(evaluation.budget.categoryId)}
                          className="p-1 text-success-600 hover:bg-success-50 rounded"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingBudget(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(evaluation)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {budgets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No budgets set for this month
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

