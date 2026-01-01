'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string;
}

export function AddBudgetDialog({
  isOpen,
  onClose,
  currentMonth,
}: AddBudgetDialogProps) {
  const utils = trpc.useUtils();

  const [formData, setFormData] = useState({
    categoryId: '',
    plannedAmount: '',
    limitAmount: '',
    limitType: '' as '' | 'soft' | 'hard',
    alertThresholdPct: '80',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch categories (expected and varying only, not income)
  const { data: categories = [] } = trpc.categories.list.useQuery({
    includeInactive: false,
  });

  type Category = (typeof categories)[number];
  const budgetableCategories = categories.filter(
    (cat: Category) => cat.type === 'expected' || cat.type === 'varying'
  );

  const createMutation = trpc.budgets.upsert.useMutation({
    onSuccess: () => {
      utils.budgets.forMonth.invalidate(currentMonth);
      handleClose();
    },
    onError: (error: { message?: string }) => {
      setErrors({ form: error.message || 'Failed to create budget' });
    },
  });

  const handleClose = () => {
    setFormData({
      categoryId: '',
      plannedAmount: '',
      limitAmount: '',
      limitType: '',
      alertThresholdPct: '80',
    });
    setErrors({});
    onClose();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required';
    }

    const plannedAmount = Number(formData.plannedAmount);
    if (!formData.plannedAmount || plannedAmount <= 0) {
      newErrors.plannedAmount = 'Planned amount must be greater than 0';
    }

    if (formData.limitAmount) {
      const limitAmount = Number(formData.limitAmount);
      if (limitAmount <= 0) {
        newErrors.limitAmount = 'Limit amount must be greater than 0';
      } else if (limitAmount < plannedAmount) {
        newErrors.limitAmount = 'Limit amount should be >= planned amount';
      }

      if (!formData.limitType) {
        newErrors.limitType = 'Limit type is required when limit amount is set';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    createMutation.mutate({
      categoryId: formData.categoryId,
      month: currentMonth,
      plannedAmount: Number(formData.plannedAmount),
      limitAmount: formData.limitAmount ? Number(formData.limitAmount) : undefined,
      limitType: formData.limitType || undefined,
      alertThresholdPct: Number(formData.alertThresholdPct) / 100,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Budget</h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category Select */}
          <div>
            <label className="label">
              Category <span className="text-danger-500">*</span>
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) =>
                setFormData({ ...formData, categoryId: e.target.value })
              }
              className={cn(
                'input',
                errors.categoryId && 'border-danger-500 focus:ring-danger-500'
              )}
            >
              <option value="">Select category...</option>
              {budgetableCategories.map((cat: Category) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-sm text-danger-600 mt-1">{errors.categoryId}</p>
            )}
          </div>

          {/* Planned Amount */}
          <div>
            <label className="label">
              Planned Amount (₪) <span className="text-danger-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.plannedAmount}
              onChange={(e) =>
                setFormData({ ...formData, plannedAmount: e.target.value })
              }
              className={cn(
                'input',
                errors.plannedAmount && 'border-danger-500 focus:ring-danger-500'
              )}
              placeholder="0.00"
            />
            {errors.plannedAmount && (
              <p className="text-sm text-danger-600 mt-1">
                {errors.plannedAmount}
              </p>
            )}
          </div>

          {/* Limit Amount */}
          <div>
            <label className="label">Limit Amount (₪) (optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.limitAmount}
              onChange={(e) =>
                setFormData({ ...formData, limitAmount: e.target.value })
              }
              className={cn(
                'input',
                errors.limitAmount && 'border-danger-500 focus:ring-danger-500'
              )}
              placeholder="No limit"
            />
            {errors.limitAmount && (
              <p className="text-sm text-danger-600 mt-1">{errors.limitAmount}</p>
            )}
          </div>

          {/* Limit Type */}
          {formData.limitAmount && (
            <div>
              <label className="label">
                Limit Type <span className="text-danger-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="limitType"
                    value="soft"
                    checked={formData.limitType === 'soft'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        limitType: e.target.value as 'soft',
                      })
                    }
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Soft Limit</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Warning only, allows exceeding
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="limitType"
                    value="hard"
                    checked={formData.limitType === 'hard'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        limitType: e.target.value as 'hard',
                      })
                    }
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Hard Limit</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Strict limit, prevents exceeding
                    </p>
                  </div>
                </label>
              </div>
              {errors.limitType && (
                <p className="text-sm text-danger-600 mt-1">{errors.limitType}</p>
              )}
            </div>
          )}

          {/* Alert Threshold */}
          <div>
            <label className="label">
              Alert Threshold ({formData.alertThresholdPct}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.alertThresholdPct}
              onChange={(e) =>
                setFormData({ ...formData, alertThresholdPct: e.target.value })
              }
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Get notified when spending reaches this percentage
            </p>
          </div>

          {/* Form Error */}
          {errors.form && (
            <div className="bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 rounded p-3 text-sm text-danger-700 dark:text-danger-400">
              {errors.form}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn-outline flex-1"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Budget'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
