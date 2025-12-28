'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { X, Plus, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
}

interface AddRecurringDialogProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddRecurringDialog({
  categories,
  isOpen,
  onClose,
  onSuccess,
}: AddRecurringDialogProps) {
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [interval, setInterval] = useState('1');
  const [byMonthDay, setByMonthDay] = useState('1');

  const utils = trpc.useUtils();

  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: () => {
      utils.recurring.list.invalidate();
      onSuccess?.();
      handleClose();
    },
  });

  const handleClose = () => {
    setName('');
    setDirection('expense');
    setAmount('');
    setCategoryId('');
    setDescription('');
    setFrequency('monthly');
    setInterval('1');
    setByMonthDay('1');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !amount) {
      return;
    }

    createMutation.mutate({
      name,
      direction,
      amount: parseFloat(amount),
      defaultCategoryId: categoryId || undefined,
      description: description || undefined,
      frequency,
      interval: parseInt(interval),
      byMonthDay: frequency === 'monthly' ? parseInt(byMonthDay) : undefined,
      startDate: new Date(),
    });
  };

  // Filter categories by direction
  const filteredCategories = categories.filter((cat) => {
    if (direction === 'income') return cat.type === 'income';
    return cat.type === 'expected' || cat.type === 'varying';
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">Add Recurring Transaction</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mortgage, Salary..."
              required
              className="input w-full"
            />
          </div>

          {/* Direction Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('expense')}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  direction === 'expense'
                    ? 'bg-danger-100 text-danger-700 border-2 border-danger-500'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                )}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setDirection('income')}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  direction === 'income'
                    ? 'bg-success-100 text-success-700 border-2 border-success-500'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                )}
              >
                Income
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (₪) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="input w-full"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input w-full"
            >
              <option value="">Select category...</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Every</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="input w-20"
                />
                <span className="text-sm text-gray-600">
                  {frequency === 'monthly' && interval === '2' ? 'months (bimonthly)' :
                   frequency === 'monthly' ? 'month(s)' :
                   frequency === 'yearly' ? 'year(s)' :
                   frequency === 'weekly' ? 'week(s)' : 'day(s)'}
                </span>
              </div>
            </div>
          </div>

          {/* Day of month (for monthly) */}
          {frequency === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day of month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={byMonthDay}
                onChange={(e) => setByMonthDay(e.target.value)}
                className="input w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Which day of the month (1-31)
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="input w-full"
            />
          </div>

          {/* Error message */}
          {createMutation.isError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-sm text-danger-700">
                {createMutation.error.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-outline flex-1"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={createMutation.isPending}
            >
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? 'Adding...' : 'Add Recurring'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
