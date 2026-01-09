'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { ToggleLeft, ToggleRight, Trash2, Calendar, Play, Plus, Search } from 'lucide-react';
import { AddRecurringDialog } from './AddRecurringDialog';
import { PatternDetectionDialog } from './PatternDetectionDialog';

interface Template {
  id: string;
  name: string;
  direction: string;
  amount: number;
  description?: string | null;
  merchant?: string | null;
  frequency: string;
  interval: number;
  byMonthDay?: number | null;
  startDate: Date;
  endDate?: Date | null;
  isActive: boolean;
  nextRunAt?: Date | null;
  scheduleDescription?: string;
  category?: { id: string; name: string; icon?: string | null } | null;
}

export function RecurringContent() {
  const [showInactive, setShowInactive] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPatternDialogOpen, setIsPatternDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data: templates = [] } = trpc.recurring.list.useQuery({
    includeInactive: showInactive,
  });

  const { data: categories = [] } = trpc.categories.list.useQuery();

  const updateMutation = trpc.recurring.update.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
  });

  const deleteMutation = trpc.recurring.delete.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
  });

  const generateMutation = trpc.recurring.generateOccurrences.useMutation({
    onSuccess: (data) => {
      alert(`Generated ${data.created} transaction(s)`);
      utils.recurring.list.invalidate();
    },
  });

  const toggleActive = (template: Template) => {
    updateMutation.mutate({
      id: template.id,
      data: { isActive: !template.isActive },
    });
  };

  const incomeTemplates = templates.filter((t) => t.direction === 'income');
  const expenseTemplates = templates.filter((t) => t.direction === 'expense');

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage recurring income and expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
          <button
            onClick={() => setIsPatternDialogOpen(true)}
            className="btn btn-outline"
          >
            <Search className="h-4 w-4" />
            Detect Patterns
          </button>
          <button
            onClick={() => {
              generateMutation.mutate({ upToDate: new Date() });
            }}
            disabled={generateMutation.isPending}
            className="btn btn-outline"
          >
            <Play className="h-4 w-4" />
            {generateMutation.isPending ? 'Generating...' : 'Generate Missing'}
          </button>
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            Add Recurring
          </button>
        </div>
      </div>

      {/* Income Templates */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recurring Income</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Regular money coming in</p>
          </div>
          <span className="badge badge-success">{incomeTemplates.length} active</span>
        </div>

        <div className="space-y-3">
          {incomeTemplates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onToggle={() => toggleActive(template)}
              onDelete={() => {
                if (confirm('Delete this recurring transaction?')) {
                  deleteMutation.mutate(template.id);
                }
              }}
            />
          ))}
          {incomeTemplates.length === 0 && (
            <p className="py-4 text-center text-gray-400 dark:text-gray-500">
              No recurring income set up
            </p>
          )}
        </div>
      </div>

      {/* Expense Templates */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recurring Expenses</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Regular bills and payments</p>
          </div>
          <span className="badge badge-warning">{expenseTemplates.length} active</span>
        </div>

        <div className="space-y-3">
          {expenseTemplates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onToggle={() => toggleActive(template)}
              onDelete={() => {
                if (confirm('Delete this recurring transaction?')) {
                  deleteMutation.mutate(template.id);
                }
              }}
            />
          ))}
          {expenseTemplates.length === 0 && (
            <p className="py-4 text-center text-gray-400 dark:text-gray-500">
              No recurring expenses set up
            </p>
          )}
        </div>
      </div>

      {/* Add Recurring Dialog */}
      <AddRecurringDialog
        categories={categories}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={() => utils.recurring.list.invalidate()}
      />
      <PatternDetectionDialog
        isOpen={isPatternDialogOpen}
        onClose={() => setIsPatternDialogOpen(false)}
        onSuccess={() => utils.recurring.list.invalidate()}
      />
    </div>
  );
}

function TemplateRow({
  template,
  onToggle,
  onDelete,
}: {
  template: Template;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border px-4 py-3',
        !template.isActive
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      {/* Icon & Name */}
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xl">{template.category?.icon || '📝'}</span>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{template.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {template.category?.name || 'Uncategorized'}
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p
          className={cn(
            'font-semibold',
            template.direction === 'income'
              ? 'text-success-600'
              : 'text-gray-900 dark:text-white'
          )}
        >
          {template.direction === 'income' ? '+' : '-'}
          {formatCurrency(template.amount)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{template.scheduleDescription}</p>
      </div>

      {/* Next Run */}
      <div className="text-right min-w-[100px]">
        <div className="flex items-center justify-end gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Calendar className="h-3 w-3" />
          {template.nextRunAt ? (
            <span>{formatDate(template.nextRunAt)}</span>
          ) : (
            <span>—</span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Next occurrence</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggle}
          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          {template.isActive ? (
            <ToggleRight className="h-5 w-5 text-success-500" />
          ) : (
            <ToggleLeft className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-danger-600 hover:bg-danger-50 rounded"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

