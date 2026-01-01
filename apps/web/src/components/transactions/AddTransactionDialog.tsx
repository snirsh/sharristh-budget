'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
}

interface AddTransactionDialogProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddTransactionDialog({
  categories,
  isOpen,
  onClose,
  onSuccess,
}: AddTransactionDialogProps) {
  const [direction, setDirection] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]!);
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');

  const utils = trpc.useUtils();

  // Ensure default account exists when dialog opens
  const ensureDefaultMutation = trpc.accounts.ensureDefault.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
    },
  });
  const { data: accounts } = trpc.accounts.list.useQuery();

  // Ensure default account exists when dialog opens
  useEffect(() => {
    if (isOpen) {
      ensureDefaultMutation.mutate();
    }
  }, [isOpen]);

  const createMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      onSuccess?.();
      handleClose();
    },
  });

  const handleClose = () => {
    setDirection('expense');
    setDate(new Date().toISOString().split('T')[0]!);
    setDescription('');
    setMerchant('');
    setAmount('');
    setCategoryId('');
    setAccountId('');
    setNotes('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !amount || !accountId) {
      return;
    }

    createMutation.mutate({
      accountId,
      date: new Date(date),
      description,
      merchant: merchant || undefined,
      amount: parseFloat(amount),
      direction,
      categoryId: categoryId || undefined,
      notes: notes || undefined,
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Transaction</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Direction Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('expense')}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  direction === 'expense'
                    ? 'bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-400 border-2 border-danger-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
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
                    ? 'bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-400 border-2 border-success-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                Income
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="input w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this transaction for?"
              required
              className="input w-full"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Account *
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="input w-full"
            >
              <option value="">Select account...</option>
              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input w-full"
            >
              <option value="">Select category (optional)...</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave blank to auto-categorize based on rules
            </p>
          </div>

          {/* Merchant (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Merchant
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Rami Levy, Shufersal..."
              className="input w-full"
            />
          </div>

          {/* Notes (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* Error message */}
          {createMutation.isError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 rounded-lg">
              <p className="text-sm text-danger-700 dark:text-danger-400">
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
              {createMutation.isPending ? 'Adding...' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
